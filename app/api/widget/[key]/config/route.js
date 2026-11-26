import { findWidget, publicConfig } from "@/lib/services/widget";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

// Public: the widget's look, fetched by widget.js on the website that shows it.
// That's a request from another site, so CORS applies: only the owner's allowed sites may read the answer.
export async function GET(request, { params }) {
  try {
    const found = await findWidget(params.key);
    const origin = request.headers.get("origin");
    const cors = origin && found.widget.allowedOrigins.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {};
    return Response.json(publicConfig(found), { headers: { ...cors, Vary: "Origin", "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error, "This assistant isn't available.");
  }
}
