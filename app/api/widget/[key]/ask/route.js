import crypto from "node:crypto";
import { startWidgetAnswer } from "@/lib/services/widget";
import { HttpError, ndjsonResponse, readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const FAILED = "Could not answer right now. Try again in a moment.";

// Public: a visitor's question from the widget's chat page (/embed/[key]). Streams like the app's /api/rag.
export async function POST(request, { params }) {
  try {
    // Only the widget's own page (this site, inside the iframe) may ask; other sites' pages can't call this directly.
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) throw new HttpError(403, "Not allowed.");

    // An anonymous, stable id per visitor for the rate limit: a hash, so no IP address is stored.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
    const visitor = crypto.createHash("sha256").update(`${params.key}:${ip}`).digest("hex").slice(0, 16);

    const { question, history } = await readJson(request);
    return ndjsonResponse(await startWidgetAnswer(params.key, question, history, visitor), FAILED);
  } catch (error) {
    return toErrorResponse(error, FAILED);
  }
}
