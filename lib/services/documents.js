// Documents: upload (validate, then hand over to the ingest pipeline), look up and delete.
import { Document, vectorIdsFor } from "../models/Document.js";
import { getVectorStore } from "../rag/store.js";
import { documentFormat } from "../rag/load.js";
import { getProjectOrThrow } from "./projects.js";
import { ingestDocument } from "./ingest.js";
import { HttpError } from "../http.js";
import { deleteFile, loadFile } from "../storage/disk.js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function findDocumentOrThrow(project, documentId, message = "Document not found.") {
  const document = project.documents.find((item) => item.id === documentId);
  if (!document) throw new HttpError(404, message);
  return document;
}

// Checks the upload, then returns a function that indexes it: ingest(onProgress) → the new document.
// The checks run first, so a bad file still gets a normal 400/404 before any progress is streamed.
export async function startUpload(userId, projectId, file) {
  const project = await getProjectOrThrow(userId, projectId);

  if (!(file instanceof File) || !documentFormat(file.name)) {
    throw new HttpError(400, "Choose a PDF or Excel (.xlsx) file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, "Files must be 10 MB or smaller.");
  }

  return (onProgress) => ingestDocument(userId, project, file, onProgress);
}

// Order matters: vectors → original file → document record.
// The record goes last, so if a step fails the document is still listed and the user can retry.
export async function deleteDocument(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId);
  const document = findDocumentOrThrow(project, documentId);

  const store = await getVectorStore(project.id);
  await store.delete({ ids: vectorIdsFor(document.id, document.chunks) });

  const { storageKey } = await Document.findById(document.id, { storageKey: 1 }).lean();
  if (storageKey) await deleteFile(storageKey);

  await Document.deleteOne({ _id: document.id });
}

// The original uploaded file, for download. Only the owner gets here (getProjectOrThrow checks userId).
export async function getOriginalFile(userId, projectId, documentId) {
  const project = await getProjectOrThrow(userId, projectId);
  const document = findDocumentOrThrow(project, documentId);
  const { storageKey } = await Document.findById(document.id, { storageKey: 1 }).lean();
  if (!storageKey) throw new HttpError(404, "The original file of this document was not kept.");

  try {
    return { bytes: await loadFile(storageKey), name: document.name, format: document.format };
  } catch (error) {
    if (error.code === "ENOENT") throw new HttpError(404, "The original file is missing from storage.");
    throw error;
  }
}
