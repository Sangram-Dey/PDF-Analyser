// Upload pipeline: RAG steps 1–4 (lib/rag/), plus keeping the original file and the MongoDB record.
//
//   1. Load       file → LangChain Documents, one per PDF page or Excel row      (lib/rag/load.js)
//      Save       the original file to disk                                      (lib/storage/disk.js)
//   2. Chunk      Documents → ~1000-character chunks with 200 characters overlap (lib/rag/chunk.js)
//   3+4. Embed and store each chunk's vector and text in Pinecone                (lib/rag/embed.js, store.js)
//      Suggest    3 starter questions about the file, at the same time            (lib/rag/answer.js)
//      Register   the MongoDB Document record: metadata only (this makes it appear in the UI)
//
// If anything after loading fails, everything written so far is removed,
// so a failed upload never leaves half a document behind.
import { loadDocument } from "../rag/load.js";
import { splitIntoChunks } from "../rag/chunk.js";
import { getVectorStore, storeChunks } from "../rag/store.js";
import { suggestQuestions } from "../rag/answer.js";
import { Project } from "../models/Project.js";
import { Document, toDocumentJson, vectorIdsFor } from "../models/Document.js";
import { HttpError } from "../http.js";
import { deleteFile, saveFile, storageKeyFor } from "../storage/disk.js";

// onProgress reports each stage as it starts, for the upload screen:
//   reading → splitting (pages/rows read) → embedding (done/total, after each batch) → saving
// shortcut: loads the in-memory upload; Phase 4 (background jobs) will read the saved file with loadFile(storageKey) instead.
export async function ingestDocument(userId, project, file, onProgress = () => {}) {
  // Step 1: load first. Nothing has been written yet, so an unreadable file needs no cleanup.
  onProgress({ stage: "reading" });
  const { format, documents } = await loadDocument(file);
  onProgress({ stage: "splitting", parts: documents.length, unit: format === "pdf" ? "page" : "row" });

  const documentId = crypto.randomUUID();
  const storageKey = storageKeyFor(userId, project.id, documentId, format);
  let vectorIds = [];

  try {
    await saveFile(storageKey, Buffer.from(await file.arrayBuffer()));

    // Step 2: chunk
    const chunks = await splitIntoChunks(documents);

    // Steps 3 and 4: embed and store, while the starter questions are written (it never throws)
    vectorIds = vectorIdsFor(documentId, chunks.length);
    onProgress({ stage: "embedding", done: 0, total: chunks.length });
    const [, suggestions] = await Promise.all([
      storeChunks(project.id, documentId, file.name, chunks, vectorIds, (done, total) => onProgress({ stage: "embedding", done, total })),
      suggestQuestions(documents),
    ]);

    // Register the document (only if the project wasn't deleted meanwhile)
    onProgress({ stage: "saving" });
    if (!(await Project.exists({ _id: project.id }))) {
      throw new Error("Project was removed during upload.");
    }
    const document = await Document.create({
      _id: documentId,
      projectId: project.id,
      name: file.name,
      format,
      chunks: chunks.length,
      storageKey,
      size: file.size,
      suggestions,
    });
    return toDocumentJson(document);
  } catch (error) {
    console.error("Indexing failed", error);
    await rollback(project.id, documentId, vectorIds, storageKey);
    throw new HttpError(500, "Could not index this document. Check the AI service configuration.");
  }
}

// Best effort: a cleanup failure is logged, never thrown, so the user still sees the real error.
async function rollback(projectId, documentId, vectorIds, storageKey) {
  if (vectorIds.length) {
    try {
      const store = await getVectorStore(projectId);
      await store.delete({ ids: vectorIds });
    } catch (error) {
      console.error("Vector cleanup failed", error);
    }
  }
  try {
    await deleteFile(storageKey);
  } catch (error) {
    console.error("File cleanup failed", error);
  }
  try {
    await Document.deleteOne({ _id: documentId });
  } catch (error) {
    console.error("Database cleanup failed", error);
  }
}
