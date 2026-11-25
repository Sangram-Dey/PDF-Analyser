import { startAnswer } from "@/lib/services/rag";
import { requireUserId } from "@/lib/auth";
import { HttpError, readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const FAILED = "Could not answer right now. Check the AI service configuration.";

// Streams the answer as newline-delimited JSON: one event per line ({"type":"sources"|"text"|"done"|"error", …}).
export async function POST(request) {
  let events;
  try {
    // Validation and search happen here, so these errors still get a normal status code (401/400/404).
    const userId = await requireUserId();
    const { projectId, documentId, question, history } = await readJson(request);
    events = await startAnswer(userId, projectId, documentId, question, history);
  } catch (error) {
    return toErrorResponse(error, FAILED);
  }

  const encoder = new TextEncoder();
  const line = (event) => encoder.encode(`${JSON.stringify(event)}\n`);

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) controller.enqueue(line(event));
      } catch (error) {
        // Headers are already sent, so a failure mid-answer becomes an "error" event instead of a status code.
        console.error("Answer stream failed", error);
        try {
          // HttpErrors carry a message meant for the user (e.g. the daily AI limit is used up).
          controller.enqueue(line({ type: "error", message: error instanceof HttpError ? error.message : FAILED }));
        } catch {
          // the browser already went away
        }
      }
      try {
        controller.close();
      } catch {
        // already closed by a cancelled request
      }
    },
    cancel() {
      events.return?.(); // the user left: stop reading from Gemini
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
