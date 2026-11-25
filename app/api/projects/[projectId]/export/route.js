import { buildExport } from "@/lib/services/export";
import { requireUserId } from "@/lib/auth";
import { readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Builds the Excel or PDF file from rows the user already reviewed. No AI call.
export async function POST(request, { params }) {
  try {
    const userId = await requireUserId();
    const body = await readJson(request);
    const file = await buildExport(userId, params.projectId, body);
    return new Response(file.bytes, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not generate the export.");
  }
}
