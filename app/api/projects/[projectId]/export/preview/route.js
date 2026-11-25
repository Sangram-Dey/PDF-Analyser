import { previewExport } from "@/lib/services/export";
import { requireUserId } from "@/lib/auth";
import { readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Runs the AI extraction and returns the rows for the user to review.
export async function POST(request, { params }) {
  try {
    const userId = await requireUserId();
    const body = await readJson(request);
    return Response.json(await previewExport(userId, params.projectId, body));
  } catch (error) {
    return toErrorResponse(error, "Could not extract the data.");
  }
}
