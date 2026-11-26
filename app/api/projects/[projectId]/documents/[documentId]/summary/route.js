import { deleteSummary, getSummary, startSummary } from "@/lib/services/summary";
import { requireUserId } from "@/lib/auth";
import { HttpError, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300; // long files are summarized in several AI calls

const FAILED = "Could not summarize this document.";

// The saved summary: { summary: { text, model, sections, running, updatedAt } } (text is "" until one is made).
export async function GET(request, { params }) {
  try {
    return Response.json({ summary: await getSummary(await requireUserId(), params.projectId, params.documentId) });
  } catch (error) {
    return toErrorResponse(error, "Could not load the summary.");
  }
}

// Removes the saved summary (the file itself stays).
export async function DELETE(request, { params }) {
  try {
    await deleteSummary(await requireUserId(), params.projectId, params.documentId);
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete the summary.");
  }
}

// Makes the summary, or re-makes it (replacing the saved one once the new one is ready).
// Streams newline-delimited JSON like uploads: {"type":"progress",…} … then {"type":"done","summary"} or {"type":"error","message"}.
export async function POST(request, { params }) {
  let run;
  try {
    run = await startSummary(await requireUserId(), params.projectId, params.documentId);
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
          // the browser went away; the summary still finishes and is saved, so it shows the next time
        }
      };
      try {
        const summary = await run((progress) => send({ type: "progress", ...progress }));
        send({ type: "done", summary });
      } catch (error) {
        if (!(error instanceof HttpError)) console.error("Summary failed", error);
        send({ type: "error", message: error instanceof HttpError ? error.message : FAILED });
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
