import { getProject, updateProjects } from "../../../../../../lib/projects";
import { getVectorStore } from "../../../../../../lib/vectorStore";
import { removeDocumentContent } from "../../../../../../lib/documentContent";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  const project = await getProject(params.projectId);
  const document = project?.documents.find(
    (item) => item.id === params.documentId,
  );
  if (!document)
    return Response.json({ error: "Document not found." }, { status: 404 });
  try {
    await (await getVectorStore(project.id)).delete({ ids: document.ids });
    await updateProjects((projects) => {
      const current = projects.find((item) => item.id === project.id);
      if (current)
        current.documents = current.documents.filter(
          (item) => item.id !== document.id,
        );
    });
    await removeDocumentContent(document.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not remove this document." },
      { status: 500 },
    );
  }
}
