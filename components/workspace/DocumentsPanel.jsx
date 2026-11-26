"use client";

import { useId, useRef, useState } from "react";
import { Cpu, Download, FileScan, FileSpreadsheet, Eye, FileText, Loader2, PanelLeftClose, PanelLeftOpen, Scissors, ScrollText, Vault } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilePreview } from "./FilePreview";
import { SummarySheet } from "./SummarySheet";
import { ConfirmDelete } from "./ConfirmDelete";

const ACCEPTED_FILES = ".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// The card's Summarize button while its summary is made: short, so it fits beside View and Download.
function summaryStep({ stage, done = 0, total = 0 }) {
  if (stage === "combining") return "Combining…";
  if (stage === "summarizing" && total > 1) return `Part ${done + 1}/${total}`;
  return stage === "summarizing" ? "Summarizing…" : "Reading…";
}

// A small labelled action button on a document card (View, Summary, Download).
const ACTION = "h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-glow [&_svg]:size-3.5";
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

// What the shredder says while it works. stage comes from the server's real upload progress.
const SHREDDER_LABELS = {
  uploading: "Feeding the file in",
  reading: "Reading the pages",
  splitting: "Shredding into passages",
  embedding: "Embedding the strips",
  saving: "Storing in the vault",
};

// The upload machine, drawn in SVG. Every motion follows the real upload stage:
//   idle       slot glows softly; a page hovers over it on hover or while a file is dragged in
//   uploading,
//   reading    the page slides down into the slot
//   splitting,
//   embedding  the cutter wheels turn and strips fall into the bin
//   fill       how full the bin is: the real share of passages embedded so far (0–1)
// With reduced motion nothing moves, but the bin level and lit slot still show the state.
function Shredder({ stage, fill, hot }) {
  const feeding = stage === "uploading" || stage === "reading";
  const shredding = stage === "splitting" || stage === "embedding";
  const clipId = useId();

  return (
    <svg viewBox="0 0 160 150" aria-hidden="true" className="size-full overflow-visible">
      <defs>
        <clipPath id={`${clipId}-above-slot`}>
          <rect x="0" y="-20" width="160" height="76" />
        </clipPath>
        <clipPath id={`${clipId}-bin`}>
          <path d="M34 104 H126 L120 144 H40 Z" />
        </clipPath>
      </defs>

      {/* The page: only drawn above the slot, so it disappears into the machine */}
      <g clipPath={`url(#${clipId}-above-slot)`}>
        <g
          className={cn(
            "transition-opacity duration-300",
            feeding ? "motion-safe:animate-feed" : "motion-safe:animate-float",
            feeding || hot ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <rect x="58" y="6" width="44" height="50" rx="3" className="fill-foreground/90" />
          {[28, 20, 26, 16, 24].map((width, index) => (
            <rect key={index} x="64" y={14 + index * 7} width={width} height="2" rx="1" className="fill-background/40" />
          ))}
        </g>
      </g>

      {/* Machine body, with a glass window over two cutter wheels */}
      <rect x="24" y="56" width="112" height="42" rx="8" strokeWidth="1.2" className="fill-card stroke-glow/40" />
      <rect x="44" y="66" width="72" height="22" rx="5" className="fill-background stroke-border" />
      {[64, 96].map((cx) => (
        <g key={cx} style={{ transformBox: "fill-box", transformOrigin: "center" }} className={cn(shredding && "motion-safe:animate-cut")}>
          <circle cx={cx} cy="77" r="8" strokeWidth="1.5" strokeDasharray="3 2.3" className="fill-none stroke-glow/70" />
          <circle cx={cx} cy="77" r="2" className="fill-glow/70" />
        </g>
      ))}
      <circle cx="127" cy="64" r="2.2" className={stage ? "fill-glow motion-safe:animate-pulse" : "fill-muted-foreground/50"} />

      {/* The glowing insertion slot: brighter while working or when a file hovers over it */}
      <rect
        x="50" y="53" width="60" height="4" rx="2"
        className={cn(
          "fill-glow drop-shadow-[0_0_6px_hsl(var(--glow))] transition-opacity",
          stage || hot ? "opacity-100" : "opacity-50 motion-safe:animate-pulse",
        )}
      />

      {/* Output mouth and falling strips */}
      <rect x="48" y="96" width="64" height="4" rx="1" className="fill-background stroke-border" />
      {shredding &&
        [0, 1, 2, 3, 4, 5].map((index) => (
          <rect
            key={index}
            x={54 + index * 10} y="100" width="3" height="14" rx="1"
            className="fill-foreground/80 opacity-0 motion-safe:animate-fall motion-reduce:opacity-60"
            style={{ animationDelay: `${index * 140}ms` }}
          />
        ))}

      {/* The bin: the pile rises with the real embedding progress */}
      <path d="M34 104 H126 L120 144 H40 Z" strokeWidth="1.2" className="fill-background/60 stroke-glow/30" />
      <g clipPath={`url(#${clipId}-bin)`}>
        <rect x="34" y={144 - 40 * fill} width="92" height={40 * fill} className="fill-glow/25 transition-all duration-700" />
      </g>
    </svg>
  );
}

// Click or drop files here: the shredder. Dragging a file over it lights the slot and shows the page waiting.
// stage, fill and fileName come from the upload in progress (empty when idle).
function DropZone({ large, disabled, onFiles, stage, fill = 0, fileName }) {
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
        data-robot-spot="shredder" // the robot comes here to help while a file is shredded
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-lg border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
          large ? "flex-col justify-center px-6 py-8 text-center" : "px-3 py-2.5",
          // while it shreds, the machine stays bright even though the button is disabled
          stage ? "border-glow/40 bg-card shadow-[0_0_24px_hsl(var(--glow)/0.12)]" : "disabled:opacity-60",
          dragging ? "scale-[1.01] border-glow bg-secondary shadow-[0_0_28px_hsl(var(--glow)/0.35)]" : !stage && "bg-card hover:border-glow/40",
        )}
      >
        <span className={cn("shrink-0", large ? "h-36 w-40" : "h-20 w-[5.5rem]")}>
          <Shredder stage={stage} fill={fill} hot={dragging} />
        </span>
        <span className={cn("min-w-0", large && "mt-2")} aria-live="polite">
          {stage ? (
            <>
              <span className="block text-sm font-semibold text-primary">{SHREDDER_LABELS[stage]}…</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={fileName}>{fileName}</span>
            </>
          ) : (
            <>
              <span className="block text-sm font-semibold">{dragging ? "Release to shred and index" : "Feed the shredder"}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Drop a PDF or Excel (.xlsx) file, or click to browse · up to 5 MB</span>
            </>
          )}
        </span>
      </button>
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-label="Import documents" accept={ACCEPTED_FILES} multiple onChange={pick} />
    </>
  );
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The lab pipeline: four stations, each busy during some of the server's upload stages (lib/services/ingest.js).
// The vault is busy while embedding too, because each batch is stored in Pinecone as soon as it is embedded.
const PIPELINE = [
  { name: "Shredder", Icon: FileScan, busy: ["uploading", "reading"] },
  { name: "Chunks", Icon: Scissors, busy: ["splitting"] },
  { name: "Embed core", Icon: Cpu, busy: ["embedding"] },
  { name: "Vault", Icon: Vault, busy: ["embedding", "saving"] },
];

// What a station shows. Only numbers the server sent: pages read, chunks made, passages embedded and stored.
function stationValue(name, progress, state) {
  if (state === "waiting") return "—";
  const { stage, parts, unit, done, total } = progress;
  if (name === "Shredder") return state === "done" ? plural(parts, unit) : stage === "uploading" ? "Uploading" : "Extracting";
  if (name === "Chunks") return state === "done" ? plural(total, "chunk") : "Cutting";
  if (name === "Embed core") return state === "done" ? plural(total, "vector") : `${done}/${total}`;
  return stage === "saving" ? "Indexing" : `${done} stored`;
}

// The readout under the pipeline, like a lab console. Real counts only: a PDF is read in one go,
// so there is no live "page 12 of 48"; the page count appears once reading is done.
function statusLine({ stage, parts, unit, done, total, model }) {
  if (stage === "reading") return "Text extraction active";
  if (stage === "splitting") return `${plural(parts, unit)} read · chunking`;
  if (stage === "embedding") return `Embedding ${done} / ${total}${model ? ` · ${model}` : ""}`;
  if (stage === "saving") return `${plural(total, "vector")} stored · writing index record`;
  return "Upload in progress";
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
              <span className={cn("mr-1 size-1.5 rounded-full bg-warning", active && "motion-safe:animate-pulse")} />
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
        <>
          <ol className="mt-3 flex" aria-label="Indexing pipeline">
            {PIPELINE.map(({ name, Icon, busy }, index) => {
              const lastStage = Math.max(...busy.map((stage) => UPLOAD_STEPS.indexOf(stage)));
              const state = busy.includes(progress.stage ?? "uploading") ? "busy" : current > lastStage ? "done" : "waiting";
              const next = PIPELINE[index + 1];
              // the link to the next station carries data while that station is busy or done
              const flowing = next && (next.busy.includes(progress.stage) || current > UPLOAD_STEPS.indexOf(next.busy[0]));
              return (
                <li key={name} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                  {next && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-1/2 top-3.5 h-px w-full",
                        flowing
                          ? "h-0.5 bg-[length:200%_100%] bg-[linear-gradient(90deg,hsl(var(--glow)/0.2),hsl(var(--glow)),hsl(var(--glow)/0.2))] motion-safe:animate-shimmer"
                          : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative grid size-7 place-items-center rounded-full border transition-colors duration-500",
                      state === "busy" && "border-glow bg-secondary text-glow shadow-[0_0_12px_hsl(var(--glow)/0.5)]",
                      state === "done" && "border-primary/60 bg-primary/15 text-primary",
                      state === "waiting" && "border-border bg-card text-muted-foreground/50",
                    )}
                  >
                    <Icon className={cn("size-3.5", state === "busy" && "motion-safe:animate-pulse")} />
                  </span>
                  <span className={cn("mt-1 text-[10px] font-semibold", state === "waiting" && "text-muted-foreground/60")}>{name}</span>
                  <span className={cn("max-w-full truncate text-[10px] tabular-nums", state === "busy" ? "text-glow" : "text-muted-foreground")}>
                    <span className="sr-only">{state === "busy" ? "working" : state}: </span>
                    {stationValue(name, progress, state)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p aria-live="polite" className="mt-2.5 truncate rounded bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-glow/90">
            <span aria-hidden="true">› </span>
            {statusLine(progress)}
          </p>
        </>
      )}
    </li>
  );
}

export function DocumentsPanel({
  projectId, documents, uploading, uploadProgress = {}, chatDocumentId, busy, collapsed,
  onToggleCollapsed, onUpload, onRemove, onSelectChatDocument, onLoadPreview, onPreviewOpen, onLoadSummary, onSummarize, onSummarizeFromCard, onDeleteSummary, summarizing,
}) {
  // The file open in the preview drawer. Looked up by id, so the drawer closes if that file is deleted.
  const [previewingId, setPreviewingId] = useState("");
  const previewing = documents.find((doc) => doc.id === previewingId) ?? null;
  // The file open in the summary sheet, looked up the same way.
  const [summaryId, setSummaryId] = useState("");
  const summaryDocument = documents.find((doc) => doc.id === summaryId) ?? null;

  // A saved summary opens at once. Otherwise the card makes it first (the robot and the card show the progress),
  // then the summary opens in the side panel.
  async function openSummary(doc) {
    if (doc.summaryAt) return setSummaryId(doc.id);
    if (await onSummarizeFromCard(doc)) setSummaryId(doc.id);
  }

  if (collapsed) {
    return (
      <section aria-label="Documents" className="hidden flex-col items-center gap-3 border-r bg-muted/40 py-5 lg:flex">
        <Button variant="ghost" size="icon" title="Show documents" aria-label="Show documents" onClick={onToggleCollapsed}>
          <PanelLeftOpen />
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">{documents.length}</span>
        {uploading.length > 0 && <span className="size-2 rounded-full bg-warning motion-safe:animate-pulse" title="Indexing" />}
      </section>
    );
  }

  return (
    <section aria-labelledby="documents-title" data-robot-hide className="min-w-0 border-b bg-muted/40 lg:border-b-0 lg:border-r">
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
        {/* stays large through the first upload, so the machine doesn't shrink mid-shred */}
        <DropZone
          large={!documents.length}
          disabled={!!busy}
          onFiles={onUpload}
          stage={uploading.length ? uploadProgress.stage ?? "uploading" : undefined}
          fill={uploadProgress.stage === "saving" ? 1 : uploadProgress.stage === "embedding" ? uploadProgress.done / (uploadProgress.total || 1) : 0}
          fileName={uploading[0]}
        />

        {(uploading.length > 0 || documents.length > 0) && (
          <ul data-robot-spot="documents">
            {uploading.map((name, index) => (
              <IndexingCard key={`${name}-${index}`} name={name} active={index === 0} progress={uploadProgress} />
            ))}
            {documents.map((doc) => {
              const chatting = doc.id === chatDocumentId;
              const deleting = busy === doc.id; // removeDocument marks the run with the document's id
              const summarizingThis = summarizing?.documentId === doc.id;
              return (
              <li
                key={doc.id}
                className={cn(
                  "relative mb-1.5 overflow-hidden rounded-lg border px-1.5 pb-1.5 pt-1 transition-colors animate-in fade-in motion-reduce:animate-none",
                  chatting ? "border-glow/50 bg-secondary" : "border-transparent hover:border-border hover:bg-card",
                  deleting && "pointer-events-none opacity-50",
                )}
              >
                {/* The chat document is marked by a teal bar, a tint and "In chat". */}
                {chatting && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                {/* Top: the whole name (up to two lines) and its details. Clicking it asks the chat about this file. */}
                <button
                  type="button"
                  aria-pressed={chatting}
                  title={chatting ? "The chat answers from this file" : `Ask about ${doc.name}`}
                  onClick={() => onSelectChatDocument(doc.id)}
                  className="flex w-full items-start gap-3 rounded-md px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FileIcon format={doc.format} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-xs font-semibold leading-snug" title={doc.name}>{doc.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase">{doc.format}</Badge>
                      <span>
                        {doc.chunks} passage{doc.chunks === 1 ? "" : "s"}
                        {doc.size ? ` · ${formatSize(doc.size)}` : ""}
                      </span>
                      {chatting && (
                        <Badge className="border-transparent bg-primary px-1.5 py-0 text-[10px] text-primary-foreground hover:bg-primary">In chat</Badge>
                      )}
                    </span>
                  </span>
                </button>
                {/* Bottom: the file's actions, labelled, in one row. Delete sits apart on the right. */}
                <div className="mt-0.5 flex items-center gap-0.5 border-t border-border/60 pt-1">
                  {/* View needs the original file (files uploaded before file storage don't have one).
                      PDF: a link that opens it in a new tab, in the browser's own PDF viewer (pages, zoom, search, print).
                      Excel: browsers can't show it, so it opens the preview drawer with sheet tabs. */}
                  {doc.hasFile && doc.format === "pdf" && (
                    <Button asChild variant="ghost" size="sm" className={ACTION}>
                      <a
                        href={`/api/projects/${projectId}/documents/${doc.id}/file?view=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${doc.name} in a new tab`}
                        aria-label={`View ${doc.name} (opens in a new tab)`}
                        onClick={() => onPreviewOpen?.(doc)}
                      >
                        <Eye />
                        View
                      </a>
                    </Button>
                  )}
                  {doc.hasFile && doc.format === "xlsx" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title={`View ${doc.name}`}
                      aria-label={`View ${doc.name}`}
                      onClick={() => {
                        setPreviewingId(doc.id);
                        onPreviewOpen?.(doc);
                      }}
                      className={ACTION}
                    >
                      <Eye />
                      View
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    title={doc.summaryAt ? `Summary of ${doc.name}` : `Summarize ${doc.name}`}
                    aria-label={summarizingThis ? `Summarizing ${doc.name}` : doc.summaryAt ? `Summary of ${doc.name}` : `Summarize ${doc.name}`}
                    aria-busy={summarizingThis}
                    disabled={summarizingThis || (!doc.summaryAt && !!summarizing)}
                    onClick={() => openSummary(doc)}
                    className={cn(ACTION, (doc.summaryAt || summarizingThis) && "text-glow")}
                  >
                    {summarizingThis ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <ScrollText />}
                    {summarizingThis ? summaryStep(summarizing) : doc.summaryAt ? "Summary" : "Summarize"}
                  </Button>
                  {doc.hasFile && (
                    <Button asChild variant="ghost" size="sm" className={ACTION}>
                      <a href={`/api/projects/${projectId}/documents/${doc.id}/file`} download title={`Download ${doc.name}`} aria-label={`Download ${doc.name}`}>
                        <Download />
                        Download
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
                    className="ml-auto size-7 [&_svg]:size-3.5"
                  />
                </div>
                {/* While its summary is made: a scan line along the card's bottom edge (a real bar once there are parts to count). */}
                {summarizingThis && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-glow/15">
                    {summarizing.total > 1 ? (
                      <span className="block h-full bg-glow transition-[width] duration-500" style={{ width: `${((summarizing.done ?? 0) / summarizing.total) * 100}%` }} />
                    ) : (
                      <span className="block h-full w-1/3 bg-glow motion-safe:animate-[summary-scan_1.4s_ease-in-out_infinite]" />
                    )}
                  </span>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>
      <FilePreview projectId={projectId} document={previewing} onOpenChange={(open) => !open && setPreviewingId("")} onLoad={onLoadPreview} />
      <SummarySheet document={summaryDocument} onOpenChange={(open) => !open && setSummaryId("")} onLoad={onLoadSummary} onSummarize={onSummarize} onDelete={onDeleteSummary} />
    </section>
  );
}
