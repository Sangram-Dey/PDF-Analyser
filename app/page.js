"use client";

import { useState } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { DocumentsPanel } from "@/components/workspace/DocumentsPanel";
import { ExportSheet } from "@/components/workspace/ExportSheet";
import { ProjectHeader } from "@/components/workspace/ProjectHeader";
import { Sidebar } from "@/components/workspace/Sidebar";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

export default function Home() {
  const workspace = useWorkspace();
  const { selected, busy } = workspace;
  const [documentsCollapsed, setDocumentsCollapsed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <main className="min-h-screen sm:flex">
      <Sidebar
        projects={workspace.projects}
        selectedId={selected?.id}
        busy={busy}
        loading={workspace.loading}
        onSelect={workspace.selectProject}
        onCreate={workspace.createProject}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ProjectHeader project={selected} busy={busy} onExport={() => setExportOpen(true)} onDelete={workspace.removeProject} />

        {workspace.error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-destructive/10 px-5 py-2 text-sm text-destructive sm:px-9">
            {workspace.error}
            <Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={workspace.clearError} className="hover:bg-destructive/10 hover:text-destructive">
              <X />
            </Button>
          </div>
        )}

        {workspace.loading ? (
          // First load: a spinner instead of "Create your first project", which would flash for users who have projects.
          <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" />
            Loading your projects…
          </div>
        ) : selected ? (
          <>
            {/* Chat is the main column; the documents panel is narrow and can collapse to a rail. */}
            <div
              className={cn(
                "grid flex-1 transition-[grid-template-columns] duration-300 motion-reduce:transition-none",
                documentsCollapsed ? "lg:grid-cols-[56px_minmax(0,1fr)]" : "lg:grid-cols-[320px_minmax(0,1fr)]",
              )}
            >
              <DocumentsPanel
                projectId={selected.id}
                documents={selected.documents}
                uploading={workspace.uploading}
                uploadProgress={workspace.uploadProgress}
                busy={busy}
                collapsed={documentsCollapsed}
                onToggleCollapsed={() => setDocumentsCollapsed((value) => !value)}
                onUpload={workspace.uploadFiles}
                onRemove={workspace.removeDocument}
                chatDocumentId={workspace.chatDocument?.id}
                onSelectChatDocument={workspace.selectChatDocument}
              />
              {/* The chat answers from one file: the one marked "In chat" in the Documents panel. */}
              <ChatPanel
                messages={workspace.messages}
                busy={busy}
                hasDocuments={selected.documents.length > 0}
                documentName={workspace.chatDocument?.name}
                suggestions={workspace.chatDocument?.suggestions ?? []}
                onAsk={workspace.ask}
              />
            </div>
            {/* key resets the form when you switch projects */}
            <ExportSheet
              key={selected.id}
              open={exportOpen}
              onOpenChange={setExportOpen}
              documents={selected.documents}
              busy={busy}
              onPreview={workspace.previewExport}
              onDownload={workspace.downloadExport}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
            <FolderPlus className="mb-3.5 size-7 text-primary" />
            <h2 className="text-base font-bold">Create your first project</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Give it a name in the sidebar to organize documents and questions.</p>
          </div>
        )}
      </div>
    </main>
  );
}
