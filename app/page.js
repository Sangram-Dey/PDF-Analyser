"use client";

import { useState } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { DocumentsPanel } from "@/components/workspace/DocumentsPanel";
import { ExportSheet } from "@/components/workspace/ExportSheet";
import { EmbedSheet } from "@/components/workspace/EmbedSheet";
import { ProjectHeader } from "@/components/workspace/ProjectHeader";
import { Sidebar } from "@/components/workspace/Sidebar";
import { AiRobot } from "@/components/workspace/AiRobot";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRobot } from "@/hooks/useRobot";
import { cn } from "@/lib/utils";

export default function Home() {
  const workspace = useWorkspace();
  const { selected, busy } = workspace;
  const [documentsCollapsed, setDocumentsCollapsed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  // The lab robot reacts to what's really happening: uploads, the answer stream, typing, errors,
  // and (through cue) your own actions: picking a project or a document, opening a preview.
  const [robot, cue] = useRobot({
    projectId: selected?.id,
    vectors: selected?.documents.reduce((sum, doc) => sum + doc.chunks, 0) ?? 0,
    uploading: workspace.uploading,
    uploadProgress: workspace.uploadProgress,
    answering: busy === "answer",
    latest: workspace.messages.at(-1),
    typing,
    error: workspace.error,
    task: busy,
    deletingName: selected?.documents.find((doc) => doc.id === busy)?.name,
    exportOpen,
    summarizing: workspace.summarizing,
    summarized: workspace.summarized,
  });

  return (
    <main className="min-h-screen sm:flex">
      <Sidebar
        projects={workspace.projects}
        selectedId={selected?.id}
        busy={busy}
        loading={workspace.loading}
        onSelect={(id) => {
          workspace.selectProject(id);
          cue("explore", "projects", `Exploring ${workspace.projects.find((project) => project.id === id)?.name}…`);
        }}
        onCreate={async (name) => {
          const created = await workspace.createProject(name);
          if (created) cue("explore", "projects", `New project "${name}", let's fill it`);
          return created;
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ProjectHeader project={selected} busy={busy} onExport={() => setExportOpen(true)} onEmbed={() => setEmbedOpen(true)} onDelete={workspace.removeProject} />

        {workspace.error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-destructive/10 px-5 py-2 text-sm text-destructive sm:px-9">
            {workspace.error}
            {workspace.retryAsk && !busy && (
              <Button variant="ghost" size="sm" onClick={workspace.retryAsk} className="ml-auto hover:bg-destructive/10 hover:text-destructive">
                Try again
              </Button>
            )}
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
                onSelectChatDocument={(id) => {
                  workspace.selectChatDocument(id);
                  cue("read", "documents", `Reading ${selected.documents.find((doc) => doc.id === id)?.name}`);
                }}
                onPreviewOpen={(doc) => cue("read", "documents", `Opening ${doc.name}`)}
                onLoadPreview={workspace.loadPreview}
                onLoadSummary={workspace.loadSummary}
                onSummarize={workspace.summarize}
                onSummarizeFromCard={workspace.summarizeFromCard}
                summarizing={workspace.summarizing}
                onDeleteSummary={workspace.deleteSummary}
              />
              {/* The chat answers from one file: the one marked "In chat" in the Documents panel. */}
              <ChatPanel
                messages={workspace.messages}
                busy={busy}
                hasDocuments={selected.documents.length > 0}
                documentName={workspace.chatDocument?.name}
                documentChunks={workspace.chatDocument?.chunks}
                suggestions={workspace.chatDocument?.suggestions ?? []}
                onAsk={workspace.ask}
                onTypingChange={setTyping}
              />
            </div>
            {/* key resets the form when you switch projects */}
            <EmbedSheet
              key={`embed-${selected.id}`}
              open={embedOpen}
              onOpenChange={setEmbedOpen}
              project={selected}
              onLoad={workspace.loadWidget}
              onSave={workspace.saveWidget}
              initialDocumentId={workspace.chatDocument?.id}
            />
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

      {/* one robot for the whole page: it glides between its home (the vault), the shredder and the chat */}
      {selected && (
        <AiRobot
          state={robot.state}
          spot={robot.spot}
          badge={robot.badge}
          progress={robot.progress}
          step={robot.step}
          summon={robot.summon}
          onFiles={workspace.uploadFiles}
          canTakeFiles={!busy}
        />
      )}
    </main>
  );
}
