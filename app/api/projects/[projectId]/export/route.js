import { getProject } from "../../../../../lib/projects";
import { parseRequestedFields, extractFields, createExcel, createPdf } from "../../../../../lib/exportData";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const project = await getProject(params.projectId);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const { documentId, requiredData, format } = await request.json();
  const document = project.documents.find((item) => item.id === documentId);
  if (!document) return Response.json({ error: "Select a document in this project." }, { status: 400 });
  if (format !== "xlsx" && format !== "pdf") return Response.json({ error: "Choose Excel or PDF as the export format." }, { status: 400 });
  const fields = parseRequestedFields(requiredData);
  if (!fields.length) return Response.json({ error: "Enter 1 to 20 required fields, each up to 80 characters." }, { status: 400 });
  try {
    const rows = await extractFields(project, document, fields);
    const bytes = format === "xlsx" ? await createExcel(rows, document.name) : await createPdf(rows, document.name);
    const filename = `${document.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "document"}-extracted.${format}`;
    return new Response(bytes, { headers: {
      "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message || "Could not generate the export." }, { status: 500 });
  }
}
