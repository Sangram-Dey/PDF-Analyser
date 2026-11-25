import { deleteDocument } from "@/lib/services/documents";
import { requireUserId } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  try {
    await deleteDocument(await requireUserId(), params.projectId, params.documentId);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not remove this document.");
  }
}
