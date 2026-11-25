// Projects: create, list, look up and delete.
import { connectDB } from "../db.js";
import { Project, toProjectJson } from "../models/Project.js";
import { Document } from "../models/Document.js";
import { getVectorStore } from "../rag/store.js";
import { HttpError } from "../http.js";
import { deleteFolder, projectFolderKey } from "../storage/disk.js";

const MAX_NAME_LENGTH = 80;

// Every function takes the signed-in user's id; a project is only found if that user owns it.

export async function listProjects(userId) {
  await connectDB();
  const projects = await Project.find({ userId }).sort({ createdAt: 1 }).lean();
  const documents = await Document.find({ projectId: { $in: projects.map((project) => project._id) } })
    .sort({ createdAt: 1 })
    .lean();
  return projects.map((project) =>
    toProjectJson(project, documents.filter((document) => document.projectId === project._id)),
  );
}

export async function getProjectOrThrow(userId, projectId) {
  // Ids are strings; anything else (for example {"$ne": null} in a JSON body) is rejected here.
  if (typeof projectId !== "string") throw new HttpError(404, "Project not found.");

  await connectDB();
  // Someone else's project gets the same 404 as a missing one, so ids can't be probed.
  const project = await Project.findOne({ _id: projectId, userId }).lean();
  if (!project) throw new HttpError(404, "Project not found.");

  const documents = await Document.find({ projectId }).sort({ createdAt: 1 }).lean();
  return toProjectJson(project, documents);
}

export async function createProject(userId, name) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName || cleanName.length > MAX_NAME_LENGTH) {
    throw new HttpError(400, `Enter a project name of up to ${MAX_NAME_LENGTH} characters.`);
  }

  await connectDB();
  const project = await Project.create({ userId, name: cleanName });
  return toProjectJson(project, []);
}

// Order matters: vectors → files → documents → project.
// The project record goes last, so if a step fails it is still listed and the user can retry.
export async function deleteProject(userId, projectId) {
  const project = await getProjectOrThrow(userId, projectId);
  if (project.documents.length) {
    const store = await getVectorStore(project.id);
    await store.delete({ deleteAll: true });
  }

  await deleteFolder(projectFolderKey(userId, project.id)); // all original files of this project

  await Document.deleteMany({ projectId: project.id });
  await Project.deleteOne({ _id: project.id });
}
