import { FileOutput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "./ConfirmDelete";

export function ProjectHeader({ project, busy, onExport, onDelete }) {
  const count = project?.documents.length ?? 0;

  return (
    <header className="flex items-center justify-between gap-5 border-b bg-card px-5 py-5 sm:px-9 sm:py-6">
      <div className="min-w-0">
        <p className="mb-1.5 text-[10px] font-bold tracking-widest text-primary">WORKSPACE</p>
        <h1 className="break-words text-xl font-bold sm:text-2xl">{project?.name || "Projects"}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {project ? `${count} document${count === 1 ? "" : "s"}` : "Select a project"}
        </span>
        {project && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={!count}>
            <FileOutput />
            Export data
          </Button>
        )}
        {project && (
          <ConfirmDelete
            label="Remove project"
            title={`Delete "${project.name}"?`}
            description="This removes the project, all its documents and their indexed content. This can't be undone."
            disabled={!!busy}
            loading={busy === "project-delete"}
            onConfirm={onDelete}
          />
        )}
      </div>
    </header>
  );
}
