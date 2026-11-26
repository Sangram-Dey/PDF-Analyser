import { getSpreadsheetPreview } from "@/lib/services/documents";
import { requireUserId } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Read-only: the cells of an uploaded Excel file, for the preview drawer. Only the project's owner gets them.
export async function GET(request, { params }) {
  try {
    const preview = await getSpreadsheetPreview(await requireUserId(), params.projectId, params.documentId);
    return Response.json(preview, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return toErrorResponse(error, "Could not preview this file.");
  }
}
