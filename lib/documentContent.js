import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import ExcelJS from "exceljs";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

const MAX_CHARACTERS = 300000;
const documentPath = (id) => path.join(process.cwd(), "data", "documents", `${id}.json`);

export function documentFormat(name) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf" || extension === "xlsx" ? extension : null;
}

export async function parseDocument(file) {
  const format = documentFormat(file.name);
  if (!format) throw new Error("Choose a PDF or Excel (.xlsx) file.");
  let sections;
  if (format === "pdf") {
    const pages = await new PDFLoader(file).load();
    sections = pages.map((page, index) => ({
      location: `Page ${page.metadata.loc?.pageNumber ?? index + 1}`,
      text: page.pageContent.trim(),
    })).filter((section) => section.text);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
    sections = [];
    workbook.eachSheet((sheet) => {
      let headers = null;
      sheet.eachRow((row, rowNumber) => {
        const cells = [];
        const rowHeaders = {};
        row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
          const value = cell.text.trim();
          if (value) {
            const column = sheet.getColumn(columnNumber).letter;
            rowHeaders[columnNumber] = value;
            cells.push(`${column}${headers?.[columnNumber] ? ` (${headers[columnNumber]})` : ""}: ${value}`);
          }
        });
        if (cells.length) sections.push({ location: `${sheet.name}, row ${rowNumber}`, text: cells.join(" | ") });
        if (!headers && cells.length) headers = rowHeaders;
      });
    });
  }
  if (!sections.length) throw new Error("No readable text was found in this document.");
  if (sections.reduce((total, section) => total + section.text.length, 0) > MAX_CHARACTERS) {
    throw new Error("This document contains too much text. Use a smaller document (up to 300,000 characters).");
  }
  return { format, sections };
}

export async function saveDocumentContent(id, sections) {
  await mkdir(path.dirname(documentPath(id)), { recursive: true });
  await writeFile(documentPath(id), JSON.stringify(sections));
}

export async function removeDocumentContent(id) {
  try { await unlink(documentPath(id)); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

export async function loadDocumentContent(projectId, document) {
  try { return JSON.parse(await readFile(documentPath(document.id), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }

  const pinecone = new PineconeClient();
  const namespace = pinecone.Index(process.env.PINECONE_INDEX).namespace(projectId);
  const sections = [];
  for (let i = 0; i < document.ids.length; i += 100) {
    const ids = document.ids.slice(i, i + 100);
    const response = await namespace.fetch(ids);
    for (const id of ids) {
      const metadata = response.records?.[id]?.metadata;
      if (typeof metadata?.text === "string") {
        sections.push({ location: metadata.location || `Page ${metadata.page ?? "unknown"}`, text: metadata.text });
      }
    }
  }
  if (!sections.length) throw new Error("The indexed content is unavailable. Re-upload this document to export it.");
  await saveDocumentContent(document.id, sections);
  return sections;
}
