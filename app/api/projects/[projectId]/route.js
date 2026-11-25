import { deleteProject } from "@/lib/services/projects";
import { requireUserId } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    await deleteProject(await requireUserId(), params.projectId);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not remove this project.");
  }
}
