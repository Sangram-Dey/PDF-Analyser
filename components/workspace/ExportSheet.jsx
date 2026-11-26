"use client";

import { useState } from "react";
import { Check, FileDown, FileSpreadsheet, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Used for files uploaded before field suggestions existed; newer files suggest their own (document.fields).
const GENERAL_FIELDS = ["Invoice number", "Invoice date", "Due date", "Vendor", "Customer", "Total amount"];
const EYEBROW = "text-[10px] font-bold tracking-widest";

function fieldList(text) {
  return [...new Set(text.split(/[\n,]+/).map((field) => field.trim()).filter(Boolean))];
}

// While Gemini works: the requested fields with shimmering placeholders and a scan line.
function ExtractingTable({ fields }) {
  return (
    <div className="relative overflow-hidden rounded-lg border">
      <span aria-hidden="true" className="absolute inset-x-0 z-10 h-0.5 bg-glow shadow-[0_0_12px_2px_hsl(var(--glow)/0.6)] animate-scan motion-reduce:hidden" />
      <Table>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field}>
              <TableCell className="w-2/5 text-xs font-semibold">{field}</TableCell>
              <TableCell>
                <span className="block h-3 w-3/4 rounded bg-[length:200%_100%] bg-[linear-gradient(90deg,hsl(var(--muted)),hsl(var(--secondary)),hsl(var(--muted)))] motion-safe:animate-shimmer" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// The extracted values. Rows slide in one after another; verified values get a ✓.
function ResultsTable({ rows }) {
  const verified = rows.filter((row) => row.source).length;

  return (
    <div>
      <p className={cn(EYEBROW, "mb-2 flex items-center gap-1.5 text-primary")}>
        <Sparkles className="size-3.5" />
        {verified} OF {rows.length} FIELDS VERIFIED
      </p>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-2/5 text-xs">Field</TableHead>
              <TableHead className="text-xs">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.field}
                className="animate-in fade-in slide-in-from-left-2 fill-mode-both motion-reduce:animate-none"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <TableCell className="align-top text-xs font-semibold">{row.field}</TableCell>
                <TableCell className="align-top text-xs">
                  {row.source ? (
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 fill-mode-both duration-300 motion-reduce:animate-none"
                        style={{ animationDelay: `${index * 90 + 200}ms` }}
                        title="Found word for word in the document"
                      >
                        <Check className="size-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words">{row.value}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{row.source}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Minus className="size-4 shrink-0" />
                      Not found
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const keepOpenForRobot = (event) => event.target?.closest?.("[data-robot]") && event.preventDefault();

export function ExportSheet({ open, onOpenChange, documents, busy, onPreview, onDownload }) {
  const [documentId, setDocumentId] = useState("");
  const [fieldsText, setFieldsText] = useState("");
  const [result, setResult] = useState(null); // { documentId, rows } of the last extraction
  const [error, setError] = useState("");
  // Falls back to the first document when nothing (or a deleted one) is chosen.
  const chosenId = documents.some((doc) => doc.id === documentId) ? documentId : documents[0]?.id || "";
  const fields = fieldList(fieldsText);
  // fields written for this file at upload (lib/rag/answer.js → suggestForDocument), like the chat's starter questions
  const fileFields = documents.find((doc) => doc.id === chosenId)?.fields ?? [];
  const suggestedFields = fileFields.length ? fileFields : GENERAL_FIELDS;
  const extracting = busy === "export";
  const downloading = busy === "download";

  // Any change to the inputs makes the shown results out of date.
  function changeDocument(id) {
    setDocumentId(id);
    setResult(null);
  }
  function changeFields(text) {
    setFieldsText(text);
    setResult(null);
  }
  function addField(field) {
    if (!fields.includes(field)) changeFields(fieldsText.trim() ? `${fieldsText.trimEnd()}\n${field}` : field);
  }

  async function extract(event) {
    event.preventDefault();
    if (!chosenId || !fields.length || busy) return;
    setError("");
    setResult(null);
    try {
      const rows = await onPreview({ documentId: chosenId, requiredData: fieldsText });
      setResult({ documentId: chosenId, rows });
    } catch (err) {
      setError(err.message);
    }
  }

  async function download(format) {
    setError("");
    try {
      await onDownload({ documentId: result.documentId, rows: result.rows, format });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
        // the robot helps beside the drawer: touching or dragging it mustn't close the drawer
        onPointerDownOutside={keepOpenForRobot}
        onInteractOutside={keepOpenForRobot}
      >
        {/* data-robot-spot: the robot stands beside the drawer while it extracts and packs your file */}
        <SheetHeader data-robot-spot="export" className="border-b px-6 py-5 text-left">
          <p className={cn(EYEBROW, "text-primary")}>DOCUMENT TOOLS</p>
          <SheetTitle>Export extracted data</SheetTitle>
          <SheetDescription>Pick the fields you need. Each value is checked word for word against the document.</SheetDescription>
        </SheetHeader>

        <form onSubmit={extract} className="grid gap-5 px-6 py-5">
          <div className="grid gap-2">
            <label htmlFor="export-document" className="text-xs font-semibold">Document</label>
            <Select value={chosenId} onValueChange={changeDocument} disabled={!!busy || !documents.length}>
              <SelectTrigger id="export-document">
                <SelectValue placeholder="No documents available" />
              </SelectTrigger>
              <SelectContent>
                {documents.map((doc) => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="required-data" className="text-xs font-semibold">Fields to extract</label>
            <Textarea
              id="required-data"
              placeholder={"Invoice number\nInvoice date\nTotal amount"}
              value={fieldsText}
              onChange={(event) => changeFields(event.target.value)}
              rows={4}
              maxLength={1600}
              disabled={!!busy || !documents.length}
            />
            <p className="text-[11px] text-muted-foreground">
              One field per line, up to 20. Or add {fileFields.length ? "a field found in this file" : "a suggestion"}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedFields.map((field, index) => {
                const added = fields.includes(field);
                return (
                  <Button
                    key={`${chosenId}-${field}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!!busy || added}
                    onClick={() => addField(field)}
                    style={{ animationDelay: `${index * 60}ms` }} // they arrive one after another, like the chat's chips
                    className="h-7 rounded-full px-2.5 text-xs font-normal hover:border-primary hover:text-primary animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none"
                  >
                    {added ? <Check /> : <Plus />}
                    {field}
                  </Button>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={!!busy || !chosenId || !fields.length} className="justify-self-start">
            {extracting ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}
            {extracting ? "Extracting..." : "Extract fields"}
          </Button>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </form>

        {/* data-robot-spot: while extracting, the robot works here, next to the values as they're found */}
        <div data-robot-spot="export-extract" className="flex-1 border-t bg-muted/30 px-6 py-5" aria-live="polite">
          {extracting ? (
            <ExtractingTable fields={fields} />
          ) : result ? (
            <ResultsTable rows={result.rows} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">The extracted values appear here for you to check before downloading.</p>
          )}
        </div>

        {result && !extracting && (
          // data-robot-spot: while packing the download, the robot works here, next to the download buttons
          <div data-robot-spot="export-download" className="flex flex-wrap gap-2 border-t px-6 py-4">
            <Button onClick={() => download("xlsx")} disabled={!!busy}>
              {downloading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <FileSpreadsheet />}
              Download Excel
            </Button>
            <Button variant="outline" onClick={() => download("pdf")} disabled={!!busy}>
              <FileDown />
              Download PDF
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
