// Original uploaded files, kept on the server's disk under ./storage (or STORAGE_DIR).
// Keys look like "<userId>/<projectId>/<documentId>.pdf" and are always built here, never taken from a request.
// shortcut: local disk only works on one server; move to R2 (STORAGE_PLAN.md) before deploying to Vercel or several servers.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SAFE_PART = /^[A-Za-z0-9_-]{1,100}$/;

function storageRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
}

export function storageKeyFor(userId, projectId, documentId, format) {
  for (const part of [userId, projectId, documentId]) {
    if (typeof part !== "string" || !SAFE_PART.test(part)) throw new Error("Unsafe storage key part.");
  }
  if (format !== "pdf" && format !== "xlsx") throw new Error("Unsupported file format.");
  return `${userId}/${projectId}/${documentId}.${format}`;
}

// The folder that holds one project's files, for deleting them all at once.
export function projectFolderKey(userId, projectId) {
  for (const part of [userId, projectId]) {
    if (typeof part !== "string" || !SAFE_PART.test(part)) throw new Error("Unsafe storage key part.");
  }
  return `${userId}/${projectId}`;
}

// Turns a key into an absolute path and refuses anything that would land outside the storage folder.
function pathFor(key) {
  const root = storageRoot();
  const fullPath = path.resolve(root, key);
  if (!fullPath.startsWith(root + path.sep)) throw new Error("Storage key escapes the storage folder.");
  return fullPath;
}

// Writes to a temporary file first, then renames it, so a crash never leaves half a file.
export async function saveFile(key, bytes) {
  const fullPath = pathFor(key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  const tempPath = `${fullPath}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempPath, bytes);
  await rename(tempPath, fullPath);
}

export async function loadFile(key) {
  return readFile(pathFor(key));
}

// Missing files are fine: deleting twice must not fail.
export async function deleteFile(key) {
  await rm(pathFor(key), { force: true });
}

export async function deleteFolder(key) {
  await rm(pathFor(key), { recursive: true, force: true });
}
