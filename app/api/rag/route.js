import { startAnswer } from "@/lib/services/rag";
import { requireUserId } from "@/lib/auth";
import { ndjsonResponse, readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

const FAILED = "Could not answer right now. Check the AI service configuration.";

// Streams the answer as newline-delimited JSON (lib/http.js → ndjsonResponse).
export async function POST(request) {
  try {
    // Validation and search happen before streaming, so these errors still get a normal status code (401/400/404).
    const userId = await requireUserId();
    const { projectId, documentId, question, history } = await readJson(request);
    return ndjsonResponse(await startAnswer(userId, projectId, documentId, question, history), FAILED);
  } catch (error) {
    return toErrorResponse(error, FAILED);
  }
}
