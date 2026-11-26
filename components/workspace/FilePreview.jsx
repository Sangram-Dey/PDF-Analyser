"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TEXT_SIZES = [10, 11, 12, 13, 14, 16]; // Excel preview zoom steps, in px

// "A", "B", … "Z", "AA", … for column headers.
function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

// A readable table of one sheet, with Excel-style column letters and row numbers.
function SheetTable({ sheet, textSize }) {
  const columns = Math.max(0, ...sheet.rows.map((row) => row.length));
  if (!sheet.rows.length) return <p className="p-4 text-sm text-muted-foreground">This sheet is empty.</p>;

  return (
    <table className="border-collapse" style={{ fontSize: `${textSize}px` }}>
      <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
        <tr>
          <th className="sticky left-0 z-20 border bg-secondary px-2 py-1" />
          {Array.from({ length: columns }, (_, index) => (
            <th key={index} className="border px-2 py-1 font-semibold">{columnName(index)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="odd:bg-background/40">
            <th className="sticky left-0 border bg-card px-2 py-1 text-right font-normal text-muted-foreground">{rowIndex + 1}</th>
            {Array.from({ length: columns }, (_, index) => (
              <td key={index} className="max-w-64 truncate border px-2 py-1" title={row[index]}>{row[index]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Preview of an ORIGINAL uploaded Excel file (not the index): sheet tabs, a readable table and text-size zoom.
// PDFs don't come here: they open in a new tab in the browser's own PDF viewer (DocumentsPanel).
// document: the file to show (null when closed). onLoad(document) → { sheets } (hooks/useWorkspace.js).
export function FilePreview({ projectId, document, onOpenChange, onLoad }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [textSize, setTextSize] = useState(2); // index into TEXT_SIZES
  const documentId = document?.id;

  useEffect(() => {
    if (!document) return;
    let current = true; // ignore a slow answer if another file was opened meanwhile
    setPreview(null);
    setError("");
    setSheetIndex(0);
    onLoad(document)
      .then((loaded) => current && setPreview(loaded))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps -- reload only when the file changes

  const sheet = preview?.sheets?.[sheetIndex];
  const fileUrl = document ? `/api/projects/${projectId}/documents/${document.id}/file` : "";

  return (
    <Sheet open={!!document} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Eye className="size-4 text-glow" />
            Preview
          </SheetTitle>
          <SheetDescription className="truncate" title={document?.name}>{document?.name}</SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {document && (
              <Button asChild variant="outline" size="sm">
                <a href={fileUrl} download>
                  <Download />
                  Download
                </a>
              </Button>
            )}
            {sheet && (
              <div className="ml-auto flex items-center gap-1" aria-label="Text size">
                <Button variant="ghost" size="icon" aria-label="Smaller text" disabled={textSize === 0} onClick={() => setTextSize((size) => size - 1)}>
                  <Minus />
                </Button>
                <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{TEXT_SIZES[textSize]}px</span>
                <Button variant="ghost" size="icon" aria-label="Larger text" disabled={textSize === TEXT_SIZES.length - 1} onClick={() => setTextSize((size) => size + 1)}>
                  <Plus />
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {error ? (
          <p role="alert" className="p-5 text-sm text-destructive">{error}</p>
        ) : !preview ? (
          <p role="status" className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" />
            Opening the file…
          </p>
        ) : (
          <>
            {preview.sheets.length > 1 && (
              <div role="tablist" aria-label="Sheets" className="flex gap-1 overflow-x-auto border-b px-5 py-2">
                {preview.sheets.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    role="tab"
                    aria-selected={index === sheetIndex}
                    onClick={() => setSheetIndex(index)}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      index === sheetIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto">{sheet && <SheetTable sheet={sheet} textSize={TEXT_SIZES[textSize]} />}</div>
            {sheet && sheet.totalRows > sheet.rows.length && (
              <p className="border-t px-5 py-2 text-xs text-muted-foreground">
                Showing the first {sheet.rows.length.toLocaleString()} of {sheet.totalRows.toLocaleString()} rows. Download the file to see all of it.
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
