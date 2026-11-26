// A file's saved summary: read it, or (re)make it. One summary per file, kept on its Document record,
// so it is deleted with the file. Re-analysing replaces the same record, and only once the new summary is ready.
import { Document, vectorIdsFor } from "../models/Document.js";
import { loadDocument } from "../rag/load.js";
import { fetchChunks } from "../rag/store.js";
import { SUMMARY_MODEL, summarizePieces } from "../rag/summarize.js";
import { loadFile } from "../storage/disk.js";
import { getProjectOrThrow } from "./projects.js";
import { findDocumentOrThrow } from "./documents.js";
import { HttpError } from "../http.js";

// A run that hasn't finished after this long is treated as crashed, so the file can be summarized again.
const STALE_RUN_MS = 10 * 60 * 1000;

export async function getSummary(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId); // owner check
  const document = findDocumentOrThrow(project, documentId);
  const { summary } = await Document.findById(document.id, { summary: 1 }).lean();
  return toSummaryJson(summary);
}

// Removes the saved summary. Refused while a run is going, or that run would save a new one right after.
export async function deleteSummary(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId); // owner check
  const document = findDocumentOrThrow(project, documentId);
  const result = await Document.updateOne(
    { _id: document.id, projectId: project.id, ...notRunning() },
    { $unset: { summary: 1 } },
  );
  if (!result.matchedCount) throw new HttpError(409, "This file is being summarized. Delete the summary once it's ready.");
}

// Matches a file with no run going (a run older than STALE_RUN_MS counts as crashed).
function notRunning(now = Date.now()) {
  return { $or: [{ "summary.status": { $ne: "running" } }, { "summary.startedAt": { $lt: new Date(now - STALE_RUN_MS) } }] };
}

// Checks and claims the file, then returns run(onProgress) → the new summary. The checks run first, so a refusal
// is a normal 404/409 before any progress is streamed (like uploads).
export async function startSummary(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId); // owner check
  const document = findDocumentOrThrow(project, documentId);

  // Claim it in one atomic update: a double-click or a second tab can't start a second run (and spend the quota twice).
  const now = new Date();
  const claimed = await Document.findOneAndUpdate(
    {
      _id: document.id,
      projectId: project.id,
      ...notRunning(now),
    },
    { $set: { "summary.status": "running", "summary.startedAt": now } },
    { projection: { storageKey: 1, chunks: 1, name: 1 }, lean: true },
  );
  if (!claimed) throw new HttpError(409, "This file is already being summarized. Check back in a minute.");

  return async (onProgress = () => {}) => {
    try {
      onProgress({ stage: "reading" });
      const pieces = await readPieces(project.id, claimed);
      const { text, sections } = await summarizePieces(pieces, onProgress);
      if (!text) throw new HttpError(502, "The AI returned an empty summary. Try again.");

      const summary = { text, model: SUMMARY_MODEL, sections, status: "idle", startedAt: now, updatedAt: new Date() };
      await Document.updateOne({ _id: claimed._id }, { $set: { summary } });
      return toSummaryJson(summary);
    } catch (error) {
      // Keep the previous summary; only free the file for the next try.
      await Document.updateOne({ _id: claimed._id }, { $set: { "summary.status": "idle" } }).catch((err) => console.error("Could not free the summary run", err));
      throw error;
    }
  };
}

// The file's full text in order: from the saved original (no chunk overlap), or from the index for files
// uploaded before originals were kept.
async function readPieces(projectId, document) {
  if (!document.storageKey) return fetchChunks(projectId, vectorIdsFor(document._id, document.chunks));
  let bytes;
  try {
    bytes = await loadFile(document.storageKey);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return fetchChunks(projectId, vectorIdsFor(document._id, document.chunks)); // original missing: use the index
  }
  const { documents } = await loadDocument(new File([bytes], document.name));
  return documents.map((page) => ({ location: page.metadata.location, text: page.pageContent }));
}

function toSummaryJson(summary) {
  return {
    text: summary?.text ?? "",
    model: summary?.model ?? "",
    sections: summary?.sections ?? 0,
    running: summary?.status === "running" && summary.startedAt > Date.now() - STALE_RUN_MS,
    updatedAt: summary?.updatedAt ?? null,
  };
}
