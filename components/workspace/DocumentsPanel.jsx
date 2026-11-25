"use client";

import { useRef, useState } from "react";
import { Check, Circle, Download, FileSpreadsheet, FileText, Loader2, PanelLeftClose, PanelLeftOpen, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "./ConfirmDelete";

const ACCEPTED_FILES = ".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const UPLOAD_STEPS = ["uploading", "reading", "splitting", "embedding", "saving"]; // the stages the server streams (lib/services/ingest.js)

function formatSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ format }) {
  return (
    <span className="grid h-10 w-9 shrink-0 place-items-center rounded-md bg-secondary text-primary">
      {format === "xlsx" ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
    </span>
  );
}

// Click or drop files here. The dashed border drifts; dragging a file over it lights it up.
function DropZone({ large, disabled, onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function drop(event) {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length && !disabled) onFiles(files);
  }

  function pick(event) {
    const files = [...event.target.files];
    event.target.value = ""; // lets the same file be picked again
    if (files.length) onFiles(files);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={drop}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-lg text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          large ? "flex-col justify-center px-6 py-12 text-center" : "px-4 py-3.5",
          dragging ? "scale-[1.01] bg-secondary shadow-[0_0_28px_hsl(var(--glow)/0.35)]" : "bg-card hover:bg-secondary/60",
        )}
      >
        {/* Animated dashed border (an SVG rectangle, because CSS borders can't move their dashes) */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <rect
            width="100%" height="100%" rx="8"
            fill="none" strokeWidth={dragging ? 2 : 1.5} strokeDasharray="6 4"
            className={cn("stroke-primary/50 animate-dash motion-reduce:animate-none", dragging && "stroke-glow")}
          />
        </svg>
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-glow text-white",
            large ? "size-12 animate-float motion-reduce:animate-none" : "size-9",
            dragging && "shadow-[0_0_20px_hsl(var(--glow)/0.6)]",
          )}
        >
          <UploadCloud className={large ? "size-6" : "size-4"} />
        </span>
        <span className={large ? "mt-3" : ""}>
          <span className="block text-sm font-semibold">{dragging ? "Drop to import" : "Drop files here or click to browse"}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">PDF or Excel (.xlsx), up to 10 MB each</span>
        </span>
      </button>
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-label="Import documents" accept={ACCEPTED_FILES} multiple onChange={pick} />
    </>
  );
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// One line per stage. Finished stages show what they found ("Read 12 pages"); the current one shows live progress.
function stepLabel(step, progress, finished) {
  if (step === "uploading") return finished ? "Uploaded" : "Uploading the file";
  if (step === "reading") return finished && progress.parts ? `Read ${plural(progress.parts, progress.unit)}` : "Reading the file";
  if (step === "splitting") return finished && progress.total ? `Split into ${plural(progress.total, "passage")}` : "Splitting into passages";
  if (step === "embedding") {
    if (finished) return "Embedded every passage";
    return progress.total ? `Embedding passages · ${progress.done} of ${progress.total}` : "Embedding passages";
  }
  return "Saving to your project";
}

// 0–100. Embedding takes most of the time, so it fills most of the bar, batch by batch.
function percentDone(progress) {
  if (progress.stage === "saving") return 95;
  if (progress.stage === "embedding") return 25 + Math.round((65 * progress.done) / (progress.total || 1));
  return { reading: 10, splitting: 20 }[progress.stage] ?? 3;
}

// A small page whose lines light up one after another, like it's being read.
function ReadingIcon() {
  return (
    <span aria-hidden="true" className="flex h-10 w-9 shrink-0 flex-col justify-center gap-1 rounded-md bg-secondary px-2">
      {[100, 75, 90, 55].map((width, index) => (
        <span
          key={index}
          className="h-0.5 rounded-full bg-primary/40 motion-safe:animate-pulse"
          style={{ width: `${width}%`, animationDelay: `${index * 250}ms` }}
        />
      ))}
    </span>
  );
}

// Live upload progress, streamed by the server (hooks/useWorkspace.js → uploadFiles).
function IndexingCard({ name, active, progress }) {
  const current = Math.max(0, UPLOAD_STEPS.indexOf(progress.stage));
  const percent = active ? percentDone(progress) : 0;

  return (
    <li className="relative mb-2 overflow-hidden rounded-lg border border-glow/40 bg-card px-2.5 py-3 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none">
      {active && (
        <span aria-hidden="true" className="absolute inset-x-0 h-0.5 bg-glow shadow-[0_0_12px_2px_hsl(var(--glow)/0.6)] animate-scan motion-reduce:hidden" />
      )}
      <div className="flex items-center gap-3">
        {active ? <ReadingIcon /> : <FileIcon format={name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "pdf"} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold" title={name}>{name}</p>
            <Badge className="shrink-0 border-transparent bg-warning-foreground px-1.5 py-0 text-[10px] tabular-nums text-warning hover:bg-warning-foreground">
              <span className={cn("mr-1 size-1.5 rounded-full bg-warning", active && "animate-pulse")} />
              {active ? `${percent}%` : "Queued"}
            </Badge>
          </div>
          <div role="progressbar" aria-label={`Indexing ${name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[length:200%_100%] bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--glow)),hsl(var(--primary)))] transition-all duration-700 motion-safe:animate-shimmer"
              style={{ width: `${percent}%` }}
            />
          </div>
          {!active && <p className="mt-1 text-[11px] text-muted-foreground">Waiting for the file before it</p>}
        </div>
      </div>

      {active && (
        <ol className="mt-2.5 space-y-1 pl-12 text-[11px]" aria-live="polite">
          {UPLOAD_STEPS.map((step, index) => (
            <li key={step} className={cn("flex items-center gap-1.5", index > current && "text-muted-foreground/60")}>
              {index < current ? (
                <Check className="size-3 shrink-0 text-primary" />
              ) : index === current ? (
                <Loader2 className="size-3 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
              ) : (
                <Circle className="size-3 shrink-0" />
              )}
              <span className={cn(index === current && "font-medium text-foreground")}>{stepLabel(step, progress, index < current)}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function DocumentsPanel({
  projectId, documents, uploading, uploadProgress = {}, chatDocumentId, busy, collapsed,
  onToggleCollapsed, onUpload, onRemove, onSelectChatDocument,
}) {
  if (collapsed) {
    return (
      <section aria-label="Documents" className="hidden flex-col items-center gap-3 border-r bg-muted/40 py-5 lg:flex">
        <Button variant="ghost" size="icon" title="Show documents" aria-label="Show documents" onClick={onToggleCollapsed}>
          <PanelLeftOpen />
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">{documents.length}</span>
        {uploading.length > 0 && <span className="size-2 animate-pulse rounded-full bg-warning" title="Indexing" />}
      </section>
    );
  }

  return (
    <section aria-labelledby="documents-title" className="min-w-0 border-b bg-muted/40 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-5 sm:px-6 sm:py-6">
        <div>
          <h2 id="documents-title" className="text-base font-bold">Documents</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {documents.length} file{documents.length === 1 ? "" : "s"} in this project
          </p>
        </div>
        <Button variant="ghost" size="icon" title="Hide documents" aria-label="Hide documents" onClick={onToggleCollapsed} className="hidden lg:inline-flex">
          <PanelLeftClose />
        </Button>
      </div>

      <div className="space-y-3 p-3">
        <DropZone large={!documents.length && !uploading.length} disabled={!!busy} onFiles={onUpload} />

        {(uploading.length > 0 || documents.length > 0) && (
          <ul>
            {uploading.map((name, index) => (
              <IndexingCard key={`${name}-${index}`} name={name} active={index === 0} progress={uploadProgress} />
            ))}
            {documents.map((doc) => {
              const chatting = doc.id === chatDocumentId;
              const deleting = busy === doc.id; // removeDocument marks the run with the document's id
              return (
              <li
                key={doc.id}
                className={cn(
                  "relative flex items-center gap-1 rounded-lg border border-transparent px-1 py-1.5 transition-colors animate-in fade-in motion-reduce:animate-none",
                  chatting ? "border-glow/50 bg-secondary" : "hover:bg-card",
                  deleting && "pointer-events-none opacity-50",
                )}
              >
                {/* The chat document is marked by a teal bar, a tint and "In chat". Download and delete stay separate buttons. */}
                {chatting && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                <button
                  type="button"
                  aria-pressed={chatting}
                  title={chatting ? "The chat answers from this file" : `Ask about ${doc.name}`}
                  onClick={() => onSelectChatDocument(doc.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FileIcon format={doc.format} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold" title={doc.name}>{doc.name}</span>
                      {chatting && (
                        <Badge className="shrink-0 border-transparent bg-primary px-1.5 py-0 text-[10px] text-primary-foreground hover:bg-primary">In chat</Badge>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase">{doc.format}</Badge>
                      {doc.chunks} passage{doc.chunks === 1 ? "" : "s"}
                      {doc.size ? ` · ${formatSize(doc.size)}` : ""}
                    </span>
                  </span>
                </button>
                {doc.hasFile && (
                  <Button asChild variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary">
                    <a href={`/api/projects/${projectId}/documents/${doc.id}/file`} download title={`Download ${doc.name}`} aria-label={`Download ${doc.name}`}>
                      <Download />
                    </a>
                  </Button>
                )}
                <ConfirmDelete
                  label={`Remove ${doc.name}`}
                  title={`Delete "${doc.name}"?`}
                  description="This removes the document and its indexed content from this project. This can't be undone."
                  disabled={!!busy}
                  loading={deleting}
                  onConfirm={() => onRemove(doc.id)}
                />
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
