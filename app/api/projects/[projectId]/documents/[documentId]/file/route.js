import { getOriginalFile } from "@/lib/services/documents";
import { requireUserId } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Downloads the original uploaded file. Always as an attachment, never shown inline, so an uploaded file can't run in this site.
export async function GET(request, { params }) {
  try {
    const file = await getOriginalFile(await requireUserId(), params.projectId, params.documentId);
    const asciiName = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_"); // plain fallback for old browsers
    return new Response(file.bytes, {
      headers: {
        "Content-Type": CONTENT_TYPES[file.format],
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not download this file.");
  }
}
