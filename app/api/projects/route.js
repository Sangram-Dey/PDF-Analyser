import { getProjects, updateProjects } from "../../../lib/projects";

export const runtime = "nodejs";

export async function GET() { return Response.json({ projects: await getProjects() }); }

export async function POST(request) {
  const { name } = await request.json();
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName || cleanName.length > 80) return Response.json({ error: "Enter a project name of up to 80 characters." }, { status: 400 });
  const project = { id: crypto.randomUUID(), name: cleanName, documents: [], createdAt: new Date().toISOString() };
  await updateProjects((projects) => projects.push(project));
  return Response.json({ project }, { status: 201 });
}
