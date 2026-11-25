import { listProjects, createProject } from "@/lib/services/projects";
import { requireUserId } from "@/lib/auth";
import { readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh data, never a cached build-time copy

export async function GET() {
  try {
    const projects = await listProjects(await requireUserId());
    return Response.json({ projects });
  } catch (error) {
    return toErrorResponse(error, "Could not load projects.");
  }
}

export async function POST(request) {
  try {
    const userId = await requireUserId();
    const { name } = await readJson(request);
    const project = await createProject(userId, name);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the project.");
  }
}
