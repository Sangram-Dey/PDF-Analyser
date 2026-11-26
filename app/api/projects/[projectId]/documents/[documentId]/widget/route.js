import { getDocumentWidget, saveDocumentWidget } from "@/lib/services/widget";
import { requireUserId } from "@/lib/auth";
import { readJson, toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

// One file's website-assistant settings and today's usage, for its owner (the Embed panel).
export async function GET(request, { params }) {
  try {
    return Response.json({ widget: await getDocumentWidget(await requireUserId(), params.projectId, params.documentId) });
  } catch (error) {
    return toErrorResponse(error, "Could not load the assistant settings.");
  }
}

export async function PUT(request, { params }) {
  try {
    const userId = await requireUserId();
    return Response.json({ widget: await saveDocumentWidget(userId, params.projectId, params.documentId, await readJson(request)) });
  } catch (error) {
    return toErrorResponse(error, "Could not save the assistant settings.");
  }
}
