// Rate-limit counters for the public website widgets: one record per counter, named by its bucket:
//   "doc:<documentId>:visitor:<hash>:<hour>"   one visitor's questions to one file's assistant this hour
//   "doc:<documentId>:day:<day>"               all questions to one file's assistant today
//   "project:<projectId>:day:<day>"            all questions to a project's assistants today (document: null)
// document links a counter to its file (and through it, Document.projectId, to the project).
// MongoDB deletes each counter when it expires (TTL index), so the collection never grows.
// Kept in the database, not in memory, so every server process shares the same counts.
import mongoose from "mongoose";

const widgetHitSchema = new mongoose.Schema({
  _id: { type: String }, // the bucket
  document: { type: String, ref: "Document", default: null }, // Document ids are UUID strings
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
widgetHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
widgetHitSchema.index({ document: 1 });

if (mongoose.models.WidgetHit) mongoose.deleteModel("WidgetHit");
export const WidgetHit = mongoose.model("WidgetHit", widgetHitSchema);
