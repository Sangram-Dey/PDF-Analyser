// A project groups documents and belongs to one Clerk user (userId).
// Its id is also the Pinecone namespace that holds the documents' vectors.
import mongoose from "mongoose";
import { toDocumentJson } from "./Document.js";

const projectSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, required: true }, // Clerk user id, e.g. "user_2abc..."
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true }, // adds createdAt and updatedAt
);

// "This user's projects, oldest first" is the sidebar query.
projectSchema.index({ userId: 1, createdAt: 1 });

// Reuse the compiled model when Next.js reloads this file in development.
// Hot reload re-runs this file in dev: replace the cached model, or a new field is silently dropped on save.
if (mongoose.models.Project) mongoose.deleteModel("Project");
export const Project = mongoose.model("Project", projectSchema);

// The shape the API returns (and the UI reads): the project with its documents inside.
export function toProjectJson(project, documents) {
  return {
    id: project._id,
    name: project.name,
    createdAt: project.createdAt,
    documents: documents.map(toDocumentJson),
  };
}
