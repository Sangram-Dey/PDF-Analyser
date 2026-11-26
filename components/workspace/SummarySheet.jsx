"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, RefreshCw, ScrollText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDelete } from "./ConfirmDelete";

const MARKDOWN = "space-y-3 text-sm leading-relaxed [&_li]:mt-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5";

function progressText(progress) {
  if (progress.stage === "summarizing" && progress.total > 1) return `Summarizing part ${progress.done + 1} of ${progress.total}…`;
  if (progress.stage === "combining") return "Putting the parts together…";
  if (progress.stage === "summarizing") return "Summarizing…";
  return "Reading the file…";
}

// A file's saved summary: shown at once when it exists, made on request, and re-made with "Re-analyse"
// (the saved one stays until the new one is ready). Closing the sheet doesn't stop a run: the server finishes and saves it.
// document: the file (null when closed). onLoad(document) → summary, onSummarize(document, onProgress) → summary,
// onDelete(document) removes the saved summary.
export function SummarySheet({ document, onOpenChange, onLoad, onSummarize, onDelete }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null); // set while this sheet is making a summary
  const [deleting, setDeleting] = useState(false);
  const documentId = document?.id;

  function load() {
    let current = true; // ignore a slow answer if another file was opened meanwhile
    setSummary(null);
    setError("");
    setProgress(null);
    onLoad(document)
      .then((loaded) => current && setSummary(loaded))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }
  useEffect(() => {
    if (document) return load();
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps -- reload only when the file changes

  async function summarize() {
    setError("");
    setProgress({});
    try {
      setSummary(await onSummarize(document, setProgress));
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    setError("");
    setDeleting(true);
    try {
      await onDelete(document);
      setSummary((current) => ({ ...current, text: "", sections: 0, updatedAt: null }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const working = !!progress;
  const date = summary?.updatedAt ? new Date(summary.updatedAt).toLocaleString() : "";

  return (
    <Sheet open={!!document} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ScrollText className="size-4 text-glow" />
            Summary
          </SheetTitle>
          <SheetDescription className="truncate" title={document?.name}>{document?.name}</SheetDescription>
          {summary?.text && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" size="sm" disabled={working || summary.running} onClick={summarize}>
                {working ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <RefreshCw />}
                Re-analyse
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Made {date}
                {summary.sections > 1 ? ` · read in ${summary.sections} parts` : ""}
              </span>
              <span className="ml-auto">
                <ConfirmDelete
                  label="Delete summary"
                  title="Delete this summary?"
                  description="The saved summary is removed. The file stays, and you can summarize it again any time."
                  disabled={working || summary.running}
                  loading={deleting}
                  onConfirm={remove}
                />
              </span>
            </div>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
          {working && (
            <p role="status" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" />
              {progressText(progress)}
              {summary?.text ? " The current summary stays until the new one is ready." : ""}
            </p>
          )}

          {!summary && !error ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" />
              Loading the summary…
            </p>
          ) : summary?.running && !working ? (
            <div className="grid justify-items-start gap-3 text-sm text-muted-foreground">
              <p>This file is being summarized. It&apos;s saved when ready, even if you close this panel.</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw />
                Check again
              </Button>
            </div>
          ) : summary?.text ? (
            <div className={MARKDOWN}>
              <ReactMarkdown>{summary.text}</ReactMarkdown>
            </div>
          ) : summary && !working ? (
            <div className="grid justify-items-start gap-3">
              <p className="text-sm text-muted-foreground">No summary yet. The whole file is read, however long it is, and the summary is saved for later.</p>
              <Button onClick={summarize}>
                <Sparkles />
                Summarize
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
