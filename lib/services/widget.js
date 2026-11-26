// Website assistants: each document can have its own chat on other websites, answering from that file only.
//
//   Owner (signed in)   getDocumentWidget / saveDocumentWidget: one file's settings and today's usage (the Embed panel)
//   Public (by key)     findWidget / publicConfig: what widget.js and the /embed page show
//                       startWidgetAnswer: a visitor's question → the same RAG flow, over that one file
//
// The key is public (it's in the website's HTML). It can only ask questions about its own file, within the rate
// limits, and only while that file's assistant is switched on. AI keys and documents never leave the server.
import crypto from "node:crypto";
import { connectDB } from "../db.js";
import { Document } from "../models/Document.js";
import { WidgetHit } from "../models/WidgetHit.js";
import { getProjectOrThrow } from "./projects.js";
import { findDocumentOrThrow } from "./documents.js";
import { answerQuestion } from "./rag.js";
import { HttpError } from "../http.js";

// perProjectPerDay is shared by all of a project's assistants, so many files together can't use up the AI quota.
export const LIMITS = { perVisitorPerHour: 20, perDocumentPerDay: 200, perProjectPerDay: 500 };
const MAX_ORIGINS = 10;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const UNAVAILABLE = "This assistant isn't available.";

// ---- Owner ---------------------------------------------------------------------------------------

// One file's settings and today's usage, creating its public key the first time.
export async function getDocumentWidget(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId); // owner check
  const document = findDocumentOrThrow(project, documentId);
  let { widget } = await Document.findById(document.id, { widget: 1 }).lean();
  if (!widget?.key) {
    const key = `pk_${crypto.randomBytes(16).toString("hex")}`; // 128 random bits: can't be guessed
    ({ widget } = await Document.findOneAndUpdate(
      { _id: document.id, "widget.key": { $exists: false } }, // two tabs opening at once keep the first key
      { $set: { "widget.key": key } },
      { new: true, projection: { widget: 1 } },
    ).lean() ?? (await Document.findById(document.id, { widget: 1 }).lean()));
  }
  return { ...toSettingsJson(widget), usage: await usageToday(document.id) };
}

// Saves one file's settings from the Embed panel. Everything is checked: this is input from the browser.
export async function saveDocumentWidget(userId, projectId, documentId, input) {
  const project = await getProjectOrThrow(userId, projectId); // owner check
  const document = findDocumentOrThrow(project, documentId);
  const text = (value, max, fallback) => (typeof value === "string" ? value.trim().slice(0, max) : fallback);

  const update = {
    "widget.enabled": input.enabled === true,
    "widget.allowedOrigins": parseOrigins(input.allowedOrigins),
    "widget.title": text(input.title, 60, "") || "Ask our documents",
    "widget.welcome": text(input.welcome, 200, ""),
    "widget.color": /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : "",
    "widget.theme": ["auto", "light", "dark"].includes(input.theme) ? input.theme : "auto",
    "widget.position": input.position === "left" ? "left" : "right",
    "widget.showSources": input.showSources !== false,
  };
  await Document.updateOne({ _id: document.id }, { $set: update });
  return getDocumentWidget(userId, projectId, documentId);
}

// Today's questions to this file's assistant (its daily counter), for the Embed panel.
async function usageToday(documentId) {
  const hit = await WidgetHit.findById(`doc:${documentId}:day:${Math.floor(Date.now() / DAY)}`, { count: 1 }).lean();
  return { today: hit?.count ?? 0, limit: LIMITS.perDocumentPerDay };
}

// "localhost:5173", "https://shop.com/page" → "http://localhost:5173", "https://shop.com". Only http(s) sites.
export function parseOrigins(value) {
  const lines = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/) : [];
  const origins = [];
  for (const line of lines) {
    const raw = String(line).trim();
    if (!raw) continue;
    let url;
    try {
      url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
    } catch {
      throw new HttpError(400, `"${raw}" isn't a website address.`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new HttpError(400, `"${raw}" isn't a website address.`);
    if (!origins.includes(url.origin)) origins.push(url.origin);
  }
  if (origins.length > MAX_ORIGINS) throw new HttpError(400, `Add up to ${MAX_ORIGINS} websites.`);
  return origins;
}

function toSettingsJson(widget = {}) {
  return {
    key: widget.key,
    enabled: !!widget.enabled,
    allowedOrigins: widget.allowedOrigins ?? [],
    title: widget.title ?? "Ask our documents",
    welcome: widget.welcome ?? "",
    color: widget.color ?? "",
    theme: widget.theme ?? "auto",
    position: widget.position ?? "right",
    showSources: widget.showSources !== false,
  };
}

// ---- Public --------------------------------------------------------------------------------------

// The file and settings behind a key, or a 404 when the key is unknown or its assistant is switched off.
export async function findWidget(key) {
  if (typeof key !== "string" || !/^pk_[0-9a-f]{32}$/.test(key)) throw new HttpError(404, UNAVAILABLE);
  await connectDB();
  const document = await Document.findOne({ "widget.key": key }, { projectId: 1, suggestions: 1, widget: 1 }).lean();
  if (!document?.widget?.enabled) throw new HttpError(404, UNAVAILABLE);
  return { document, widget: toSettingsJson(document.widget) };
}

// What the website may see: the look and the file's starter questions. Never the file, ids or allowed sites.
export function publicConfig({ widget, document }) {
  return {
    title: widget.title,
    welcome: widget.welcome,
    color: widget.color,
    theme: widget.theme,
    position: widget.position,
    showSources: widget.showSources,
    starterQuestions: (document.suggestions ?? []).slice(0, 3),
  };
}

// A visitor's question: rate limits first, then the same answer flow as the app, over this one file.
// visitor: a stable, anonymous id for the person asking (a hash of their IP address, made by the route).
export async function startWidgetAnswer(key, question, history, visitor) {
  const { document } = await findWidget(key);
  const now = Date.now();
  const hour = Math.floor(now / HOUR);
  const day = Math.floor(now / DAY);
  await countHit(`doc:${document._id}:visitor:${visitor}:${hour}`, document._id, LIMITS.perVisitorPerHour, HOUR, "You've asked a lot of questions. Try again in an hour.");
  await countHit(`doc:${document._id}:day:${day}`, document._id, LIMITS.perDocumentPerDay, DAY, "This assistant is resting for today. Try again tomorrow.");
  await countHit(`project:${document.projectId}:day:${day}`, null, LIMITS.perProjectPerDay, DAY, "This assistant is resting for today. Try again tomorrow.");
  return answerQuestion(document.projectId, document._id, question, history);
}

// Adds one to a counter and refuses once it passes the limit. Atomic, and shared by every server process.
async function countHit(bucket, documentId, limit, ttl, message) {
  const add = () =>
    WidgetHit.findOneAndUpdate(
      { _id: bucket },
      { $inc: { count: 1 }, $setOnInsert: { document: documentId, expiresAt: new Date(Date.now() + ttl) } },
      { upsert: true, new: true, lean: true },
    );
  let hit;
  try {
    hit = await add();
  } catch (error) {
    if (error.code !== 11000) throw error;
    hit = await add(); // two first requests raced to create the counter: the second one now finds it
  }
  if (hit.count > limit) throw new HttpError(429, message);
}
