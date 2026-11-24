import { getProject, updateProjects } from "../../../../lib/projects";
import { getVectorStore } from "../../../../lib/vectorStore";
import { removeDocumentContent } from "../../../../lib/documentContent";

export const runtime = "nodejs";

export async function DELETE(request, { params }) {
  const project = await getProject(params.projectId);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  try {
    if (project.documents.length) await (await getVectorStore(project.id)).delete({ deleteAll: true });
    await updateProjects((projects) => {
      const index = projects.findIndex((item) => item.id === project.id);
      if (index !== -1) projects.splice(index, 1);
    });
    for (const document of project.documents) await removeDocumentContent(document.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not remove this project." }, { status: 500 });
  }
}
