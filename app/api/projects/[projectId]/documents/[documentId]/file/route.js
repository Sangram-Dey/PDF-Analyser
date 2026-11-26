import { getOriginalFile } from "@/lib/services/documents";
import { requireUserId } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// The original uploaded file, for its owner only.
//   default   a download (attachment)
//   ?view=1   PDFs only: shown inline, so the browser's own PDF viewer opens it in a new tab (the eye icon).
// Showing it inline is safe because the type is fixed to application/pdf with nosniff (the browser can't treat it as
// a web page), and the upload only kept files the PDF loader could actually read. Excel files are always downloads.
export async function GET(request, { params }) {
  try {
    const file = await getOriginalFile(await requireUserId(), params.projectId, params.documentId);
    const asciiName = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_"); // plain fallback for old browsers
    const inline = file.format === "pdf" && new URL(request.url).searchParams.get("view") === "1";
    return new Response(file.bytes, {
      headers: {
        "Content-Type": CONTENT_TYPES[file.format],
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not download this file.");
  }
}
