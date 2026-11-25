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

export async function readFormData(request, maxBytes) {
  // Reject oversized uploads before reading them into memory.
  // shortcut: a request without Content-Length is still read in full; Phase 3 moves uploads to direct-to-storage.
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) throw new HttpError(413, "Files must be 10 MB or smaller.");

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
