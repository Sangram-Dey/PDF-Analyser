import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getProject, updateProjects } from "../../../../../lib/projects";
import { getVectorStore } from "../../../../../lib/vectorStore";
import {
  documentFormat,
  parseDocument,
  saveDocumentContent,
  removeDocumentContent,
} from "../../../../../lib/documentContent";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const project = await getProject(params.projectId);
  if (!project)
    return Response.json({ error: "Project not found." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !documentFormat(file.name))
    return Response.json(
      { error: "Choose a PDF or Excel (.xlsx) file." },
      { status: 400 },
    );
  if (file.size > 10 * 1024 * 1024)
    return Response.json(
      { error: "Files must be 10 MB or smaller." },
      { status: 400 },
    );
  const documentId = crypto.randomUUID();
  let ids = [];
  try {
    const { format, sections } = await parseDocument(file);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(
      sections.map((section) => ({
        pageContent: section.text,
        metadata: { location: section.location },
      })),
    );
    ids = chunks.map((_, index) => `${documentId}-${index}`);
    const store = await getVectorStore(project.id);
    await store.addDocuments(
      chunks.map((chunk) => ({
        pageContent: chunk.pageContent,
        metadata: {
          documentId,
          filename: file.name,
          location: chunk.metadata.location,
        },
      })),
      { ids },
    );
    await saveDocumentContent(documentId, sections);
    const document = {
      id: documentId,
      name: file.name,
      format,
      sections: sections.length,
      chunks: chunks.length,
      ids,
      uploadedAt: new Date().toISOString(),
    };
    await updateProjects((projects) => {
      const current = projects.find((item) => item.id === project.id);
      if (!current) throw new Error("Project was removed during upload.");
      current.documents.push(document);
    });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (ids.length) {
      try {
        await (await getVectorStore(project.id)).delete({ ids });
      } catch (cleanupError) {
        console.error("Upload cleanup failed", cleanupError);
      }
    }
    try {
      await removeDocumentContent(documentId);
    } catch (cleanupError) {
      console.error("Document cleanup failed", cleanupError);
    }
    console.error(error);
    return Response.json(
      {
        error: ids.length
          ? "Could not index this document. Check the AI service configuration."
          : error.message || "Could not parse this document.",
      },
      { status: ids.length ? 500 : 422 },
    );
  }
}
