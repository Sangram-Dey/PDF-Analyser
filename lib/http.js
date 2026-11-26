// Shared helpers that keep every route handler the same shape:
//   try { read input → call a service → return JSON } catch (error) { return toErrorResponse(error) }

// Throw this from a service when the user should see the message (bad input, not found, …).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "The request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "The request body must be a JSON object.");
  }
  return body;
}

export async function readFormData(request, maxBytes, tooLargeMessage = "This upload is too large.") {
  // Reject oversized uploads before reading them into memory.
  // shortcut: a request without Content-Length is still read in full; Phase 3 moves uploads to direct-to-storage.
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) throw new HttpError(413, tooLargeMessage);

  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "The request must be a file upload.");
  }
}

// HttpErrors show their own message. Anything else is logged on the server and the
// browser only gets `fallbackMessage`, so stack traces and API details never leak.
export function toErrorResponse(error, fallbackMessage = "Something went wrong. Please try again.") {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}

// Streams answer events as newline-delimited JSON: one event per line ({"type":"sources"|"text"|"done"|"error", …}).
// Used by the app's chat (/api/rag) and the website widget (/api/widget/[key]/ask).
export function ndjsonResponse(events, failedMessage, headers = {}) {
  const encoder = new TextEncoder();
  const line = (event) => encoder.encode(`${JSON.stringify(event)}\n`);

  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) controller.enqueue(line(event));
      } catch (error) {
        // Headers are already sent, so a failure mid-answer becomes an "error" event instead of a status code.
        if (error instanceof HttpError) console.warn(`Answer stream stopped (${error.status}): ${error.message}`);
        else console.error("Answer stream failed", error);
        try {
          // HttpErrors carry a message meant for the user (e.g. the daily AI limit is used up).
          controller.enqueue(line({ type: "error", message: error instanceof HttpError ? error.message : failedMessage }));
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
      events.return?.(); // the visitor left: stop reading from Gemini
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
