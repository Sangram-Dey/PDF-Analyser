// Metadata for one uploaded file. MongoDB never stores document text: the chunks and their text
// live in Pinecone under the ids "<documentId>-0" … "<documentId>-<chunks - 1>",
// and the original file lives on disk at storageKey ("<userId>/<projectId>/<documentId>.pdf").
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    projectId: { type: String, ref: "Project", required: true },
    name: { type: String, required: true },
    format: { type: String, enum: ["pdf", "xlsx"], required: true },
    chunks: { type: Number, required: true },   // number of vectors in Pinecone
    storageKey: { type: String, required: true }, // where the original file is saved (lib/storage/disk.js)
    size: { type: Number, required: true },       // file size in bytes
    suggestions: { type: [String], default: [] },  // starter questions about this file, written at upload
  },
  { timestamps: true },
);

// "All documents of a project, oldest first" is the most common query.
documentSchema.index({ projectId: 1, createdAt: 1 });

// Hot reload re-runs this file in dev: replace the cached model, or a new field is silently dropped on save.
if (mongoose.models.Document) mongoose.deleteModel("Document");
export const Document = mongoose.model("Document", documentSchema);

// The shape the API returns (and the UI reads).
export function toDocumentJson(document) {
  return {
    id: document._id,
    name: document.name,
    format: document.format,
    chunks: document.chunks,
    size: document.size,
    suggestions: document.suggestions ?? [],
    hasFile: Boolean(document.storageKey), // documents uploaded before file storage have no original
    uploadedAt: document.createdAt,
  };
}

// Vector ids are calculated, not stored: a retried upload overwrites the same ids instead of duplicating.
export function vectorIdsFor(documentId, chunks) {
  return Array.from({ length: chunks }, (_, index) => `${documentId}-${index}`);
}
