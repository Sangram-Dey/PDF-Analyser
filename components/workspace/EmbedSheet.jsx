"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Code2, Copy, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LABEL = "text-xs font-semibold";
const SELECT = "h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Website assistants for the selected project: every file can have its own chat on other websites.
// Left: the project's files, each with an on/off dot. Right: the chosen file's own switch, websites, look,
// today's usage, snippet and a live preview of the real widget chat.
// onLoad(documentId) → settings, onSave(documentId, settings) → saved settings (hooks/useWorkspace.js).
export function EmbedSheet({ open, onOpenChange, project, initialDocumentId, onLoad, onSave }) {
  const documents = project.documents;
  const [selectedId, setSelectedId] = useState("");
  const selected = documents.find((doc) => doc.id === selectedId) ?? null;
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const frameRef = useRef(null);

  // Opening the panel starts on the file in the chat (or the first file); a deleted file falls back the same way.
  useEffect(() => {
    if (open && !documents.some((doc) => doc.id === selectedId)) {
      setSelectedId(documents.find((doc) => doc.id === initialDocumentId)?.id ?? documents[0]?.id ?? "");
    }
  }, [open, documents]); // eslint-disable-line react-hooks/exhaustive-deps

  // The chosen file's settings, loaded when it's picked (the list itself needs no extra request).
  useEffect(() => {
    if (!open || !selectedId) return;
    let current = true;
    setSettings(null);
    setError("");
    setSaved(true);
    onLoad(selectedId)
      .then((loaded) => current && setSettings({ ...loaded, originsText: loaded.allowedOrigins.join("\n") }))
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [open, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The preview is the real widget chat: like widget.js, answer its "ready" with "hello" so it unlocks here.
  useEffect(() => {
    function onMessage(event) {
      if (event.source === frameRef.current?.contentWindow && event.origin === window.location.origin && event.data?.type === "sourcework:ready") {
        event.source.postMessage({ type: "sourcework:hello" }, window.location.origin);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const set = (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  function pick(id) {
    if (id === selectedId) return;
    if (!saved && !window.confirm("This file has unsaved changes. Discard them?")) return;
    setSelectedId(id);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await onSave(selectedId, { ...settings, allowedOrigins: settings.originsText });
      setSettings({ ...result, originsText: result.allowedOrigins.join("\n") });
      setSaved(true);
      setPreviewVersion((version) => version + 1); // reload the preview with the new settings
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const snippet = settings && typeof window !== "undefined" ? `<script src="${window.location.origin}/widget.js" data-key="${settings.key}"></script>` : "";
  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b px-6 py-5 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2">
            <Code2 className="size-4 text-glow" />
            Website assistants
          </SheetTitle>
          <SheetDescription className="truncate">
            Project: <span className="font-semibold text-foreground">{project.name}</span> · each file can have its own chat on your websites.
          </SheetDescription>
        </SheetHeader>

        {!documents.length ? (
          <p className="p-6 text-sm text-muted-foreground">Upload a file to give it a website assistant.</p>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[240px_minmax(0,1fr)]">
            {/* The project's files. On phones: a dropdown above the settings. */}
            <nav aria-label="Files" className="border-b md:overflow-y-auto md:border-b-0 md:border-r">
              <label htmlFor="embed-file" className="sr-only">File</label>
              <select id="embed-file" className={cn(SELECT, "m-3 w-[calc(100%-1.5rem)] md:hidden")} value={selectedId} onChange={(event) => pick(event.target.value)}>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.widgetEnabled ? "● " : "○ "}{doc.name}</option>
                ))}
              </select>
              <p className="hidden px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:block">
                Files ({documents.length})
              </p>
              <ul className="hidden p-2 md:block">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      aria-current={doc.id === selectedId}
                      onClick={() => pick(doc.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        doc.id === selectedId ? "bg-secondary font-semibold" : "hover:bg-muted",
                      )}
                    >
                      {doc.format === "xlsx" ? <FileSpreadsheet className="size-3.5 shrink-0 text-primary" /> : <FileText className="size-3.5 shrink-0 text-primary" />}
                      <span className="min-w-0 flex-1 truncate" title={doc.name}>{doc.name}</span>
                      <span
                        title={doc.widgetEnabled ? "On" : "Off"}
                        className={cn("size-2 shrink-0 rounded-full", doc.widgetEnabled ? "bg-glow" : "border border-muted-foreground/50")}
                      />
                      <span className="sr-only">{doc.widgetEnabled ? "on" : "off"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-h-0 overflow-y-auto">
              {!settings ? (
                <p role={error ? "alert" : "status"} className={cn("flex items-center gap-2 p-6 text-sm", error ? "text-destructive" : "text-muted-foreground")}>
                  {!error && <Loader2 className="size-4 animate-spin text-primary motion-reduce:animate-none" />}
                  {error || "Loading this file's settings…"}
                </p>
              ) : (
                <>
                  <form onSubmit={save} className="grid gap-5 px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-bold" title={selected?.name}>{selected?.name}</p>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={settings.enabled}
                          onChange={(event) => set({ enabled: event.target.checked })}
                          className="size-4 accent-[hsl(var(--primary))]"
                        />
                        Assistant is on
                      </label>
                    </div>

                    <div className="grid gap-1.5">
                      <label htmlFor="widget-origins" className={LABEL}>Websites that may show it</label>
                      <Textarea
                        id="widget-origins"
                        rows={3}
                        placeholder={"http://localhost:5173\nhttps://myshop.com"}
                        value={settings.originsText}
                        onChange={(event) => set({ originsText: event.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">One per line, with the port for local sites. On any other site the chat stays locked.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <label htmlFor="widget-title" className={LABEL}>Title</label>
                        <Input id="widget-title" maxLength={60} value={settings.title} onChange={(event) => set({ title: event.target.value })} />
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="widget-welcome" className={LABEL}>Welcome line</label>
                        <Input id="widget-welcome" maxLength={200} value={settings.welcome} onChange={(event) => set({ welcome: event.target.value })} />
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="widget-theme" className={LABEL}>Theme</label>
                        <select id="widget-theme" className={SELECT} value={settings.theme} onChange={(event) => set({ theme: event.target.value })}>
                          <option value="auto">Follow the visitor&apos;s system</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="widget-position" className={LABEL}>Bubble position</label>
                        <select id="widget-position" className={SELECT} value={settings.position} onChange={(event) => set({ position: event.target.value })}>
                          <option value="right">Bottom right</option>
                          <option value="left">Bottom left</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="widget-color" className={LABEL}>Brand colour</label>
                        <div className="flex items-center gap-2">
                          <input id="widget-color" type="color" value={settings.color || "#0f766e"} onChange={(event) => set({ color: event.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-transparent" />
                          {settings.color ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => set({ color: "" })}>Use the app&apos;s colours</Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">The app&apos;s colours</span>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm">
                        <input type="checkbox" checked={settings.showSources} onChange={(event) => set({ showSources: event.target.checked })} className="size-4 accent-[hsl(var(--primary))]" />
                        Show sources under answers
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={saving || saved}>
                        {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Check />}
                        {saved ? "Saved" : "Save"}
                      </Button>
                      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                      <p className="text-[11px] text-muted-foreground">
                        Today: <span className="font-semibold text-foreground">{settings.usage.today} / {settings.usage.limit}</span> questions · 20 per visitor an hour.
                      </p>
                    </div>
                  </form>

                  <div className="grid gap-2 border-t px-6 py-5">
                    <p className={LABEL}>Add this file&apos;s assistant to your website</p>
                    <p className="text-[11px] text-muted-foreground">Paste this line just before &lt;/body&gt; in your site&apos;s index.html (or main layout). One assistant per page.</p>
                    <div className="flex items-start gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 font-mono text-[11px]">{snippet}</code>
                      <Button type="button" variant="outline" size="sm" onClick={copy}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t px-6 py-5">
                    <p className={LABEL}>Live preview</p>
                    {settings.enabled && saved ? (
                      <iframe
                        key={`${selectedId}-${previewVersion}`}
                        ref={frameRef}
                        title="Assistant preview"
                        src={`/embed/${settings.key}`}
                        className="h-[520px] w-full max-w-[380px] rounded-2xl border shadow-lg"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">{settings.enabled ? "Save to see your changes here." : "Switch this file's assistant on and save to try it here."}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
