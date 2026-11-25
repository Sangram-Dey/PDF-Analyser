import { startUpload, MAX_FILE_BYTES } from "@/lib/services/documents";
import { requireUserId } from "@/lib/auth";
import { HttpError, readFormData, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024; // the file plus room for the form wrapper
const FAILED = "Could not upload this document.";

// Streams the upload's progress as newline-delimited JSON, like /api/rag:
//   {"type":"progress","stage":"reading"|"splitting"|"embedding"|"saving",…} … then {"type":"done","document"} or {"type":"error","message"}
export async function POST(request, { params }) {
  let ingest;
  try {
    const userId = await requireUserId(); // checked before the body is read, so anonymous uploads are never parsed
    const form = await readFormData(request, MAX_REQUEST_BYTES);
    ingest = await startUpload(userId, params.projectId, form.get("file"));
  } catch (error) {
    return toErrorResponse(error, FAILED);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // the browser went away; indexing still finishes, so the document appears on the next refresh
        }
      };
      try {
        const document = await ingest((progress) => send({ type: "progress", ...progress }));
        send({ type: "done", document });
      } catch (error) {
        // Headers are already sent, so a failure becomes an "error" event instead of a status code.
        if (!(error instanceof HttpError)) console.error("Upload failed", error);
        send({ type: "error", message: error instanceof HttpError ? error.message : FAILED });
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(body, {
    status: 201,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
