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
    fields: { type: [String], default: [] },       // field names the export panel suggests for this file, written at upload
    // This file's own website assistant (lib/services/widget.js), set up in the app's Embed panel.
    // key is public, like a site key: it's in the website's HTML. Made the first time the file's settings are opened.
    widget: {
      key: { type: String, index: { unique: true, sparse: true } },
      enabled: { type: Boolean, default: false },
      allowedOrigins: { type: [String], default: [] }, // sites that may show it, e.g. "http://localhost:5173"
      title: { type: String, default: "Ask our documents" },
      welcome: { type: String, default: "Hi! Ask me anything about this document." },
      color: { type: String, default: "" }, // "#rrggbb" brand colour, or "" for the app's own
      theme: { type: String, default: "auto" }, // auto (visitor's system) | light | dark
      position: { type: String, default: "right" }, // right | left
      showSources: { type: Boolean, default: true },
    },
    // The saved summary (lib/services/summary.js). Re-analysing replaces it in place; status guards against two runs at once.
    summary: {
      text: { type: String, default: "" },
      model: { type: String, default: "" },
      sections: { type: Number, default: 0 }, // how many parts the file was summarized in
      status: { type: String, enum: ["idle", "running"], default: "idle" },
      startedAt: Date,
      updatedAt: Date, // when the saved text was written
    },
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
    fields: document.fields ?? [],
    widgetEnabled: !!document.widget?.enabled, // the Embed panel's on/off dot; the full settings are fetched on demand
    summaryAt: document.summary?.text ? document.summary.updatedAt : null, // the text itself is fetched on demand
    hasFile: Boolean(document.storageKey), // documents uploaded before file storage have no original
    uploadedAt: document.createdAt,
  };
}

// Vector ids are calculated, not stored: a retried upload overwrites the same ids instead of duplicating.
export function vectorIdsFor(documentId, chunks) {
  return Array.from({ length: chunks }, (_, index) => `${documentId}-${index}`);
}
