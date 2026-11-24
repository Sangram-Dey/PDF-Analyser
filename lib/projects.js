import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const file = path.join(process.cwd(), "data", "projects.json");
let pending = Promise.resolve();

export async function getProjects() {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

export async function updateProjects(update) {
  const task = pending.then(async () => {
    const projects = await getProjects();
    const result = await update(projects);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(projects, null, 2));
    return result;
  });
  pending = task.catch(() => {});
  return task;
}

export async function getProject(id) {
  return (await getProjects()).find((project) => project.id === id);
}
