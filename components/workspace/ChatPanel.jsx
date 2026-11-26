"use client";

import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, ChevronRight, FileText, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { linkCitations } from "@/lib/citations";
import { VAULT_LOCK_MS, VaultLoader } from "./VaultLoader";
import { cn } from "@/lib/utils";

const STARTER_QUESTIONS = ["Summarize the key points", "What dates or deadlines are mentioned?", "List every amount and total"];
const EYEBROW = "mb-2 text-[10px] font-bold tracking-widest";
const ENTER = "animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none";

// Smooth scrolling unless the user asked for less motion.
const scrollBehavior = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

function SuggestionChips({ label, questions, disabled, onAsk, centered = false }) {
  return (
    <div className="mt-4 w-full"> {/* full width, so the chips wrap in narrow windows (the website widget) */}
      <p className={cn(EYEBROW, "text-muted-foreground")}>{label}</p>
      <div className={cn("flex flex-wrap gap-2", centered && "justify-center")}>
        {questions.map((question, index) => (
          <Button
            key={question}
            style={{ animationDelay: `${index * 80}ms` }}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onAsk(question)}
            className="h-auto whitespace-normal rounded-full animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none py-1.5 text-left font-normal hover:border-primary hover:text-primary"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Message({ message, isLatest, busy, onAsk, documentChunks, showSources = true }) {
  const isUser = message.role === "user";
  const sources = message.sources ?? [];
  const id = useId();
  const [openSources, setOpenSources] = useState([]);
  const [highlighted, setHighlighted] = useState(null);

  // Before any words arrive, the answer is the vault loader. When the first words come, the vault shuts and
  // locks for a moment, then the answer fades in (the words keep streaming in meanwhile, nothing is lost).
  const loading = !isUser && !!message.stage && !message.text;
  const [locking, setLocking] = useState(false);
  const wasLoading = useRef(loading);
  useEffect(() => {
    const finished = wasLoading.current && !loading;
    wasLoading.current = loading;
    if (!finished) return;
    setLocking(true);
    const timer = setTimeout(() => setLocking(false), VAULT_LOCK_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  function setSourceOpen(number, open) {
    setOpenSources((current) => (open ? [...current, number] : current.filter((item) => item !== number)));
  }

  // Clicking a [n] chip opens that source, scrolls to it and flashes it.
  function showSource(number) {
    if (!openSources.includes(number)) setSourceOpen(number, true);
    document.getElementById(`${id}-source-${number}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
    setHighlighted(number);
    setTimeout(() => setHighlighted(null), 1200);
  }

  const markdownComponents = {
    a({ href = "", children, node, ...props }) {
      if (!href.startsWith("#cite-")) return <a href={href} target="_blank" rel="noreferrer" className="text-primary underline" {...props}>{children}</a>;
      const number = Number(href.slice(6));
      return (
        <button
          type="button"
          onClick={() => showSource(number)}
          aria-label={`Show source ${number}`}
          className="mx-0.5 inline-flex h-[18px] min-w-5 items-center justify-center rounded bg-secondary px-1 align-text-top text-[11px] font-bold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {number}
        </button>
      );
    },
  };

  if (loading || locking) return <VaultLoader stage={locking ? "locking" : message.stage} sources={sources} total={documentChunks} />;
  const writing = message.stage === "writing";

  return (
    <article className={cn("mb-6", ENTER, isUser ? "rounded-lg bg-muted px-4 py-3.5" : "duration-500")}>
      <p className={cn(EYEBROW, "flex items-center gap-1.5 text-primary")}>
        {!isUser && <Sparkles className={cn("size-3.5", writing && "motion-safe:animate-pulse")} />}
        {/* Typing shimmer: a light band sweeps across the label while words stream in. */}
        <span
          className={cn(
            // motion-safe on every class: with reduced motion the label stays plain, readable teal text
            writing && "motion-safe:animate-shimmer motion-safe:bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(var(--glow)),hsl(var(--primary)))] motion-safe:bg-[length:200%_100%] motion-safe:bg-clip-text motion-safe:text-transparent",
          )}
        >
          {isUser ? "YOU" : writing ? "WRITING" : "ANSWER"}
        </span>
      </p>
      {/* The [&_x] classes style the HTML that ReactMarkdown produces. */}
      {/* While writing, a blinking cursor follows the last paragraph. */}
      <div
        className={cn(
          "break-words leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2.5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5",
          writing && "[&>:last-child]:after:ml-0.5 [&>:last-child]:after:text-primary [&>:last-child]:after:content-['▍'] [&>:last-child]:after:motion-safe:animate-pulse",
        )}
      >
        {isUser ? message.text : <ReactMarkdown components={markdownComponents}>{linkCitations(message.text, sources.length)}</ReactMarkdown>}
      </div>

      {showSources && sources.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className={cn(EYEBROW, "text-muted-foreground")}>SOURCES</p>
          {sources.map((source) => (
            <Collapsible
              key={source.number}
              id={`${id}-source-${source.number}`}
              open={openSources.includes(source.number)}
              onOpenChange={(open) => setSourceOpen(source.number, open)}
              className={cn(
                "group mb-1.5 rounded-md border text-xs transition-[box-shadow,background-color] duration-500 motion-reduce:transition-none",
                highlighted === source.number && "border-glow bg-secondary ring-2 ring-glow/50",
              )}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                <span className="grid h-[18px] min-w-5 shrink-0 place-items-center rounded bg-secondary px-1 text-[11px] text-secondary-foreground">{source.number}</span>
                <span className="truncate">
                  {source.filename}
                  {source.location ? ` · ${source.location}` : ""}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="mx-3 mb-2.5 border-l-2 border-glow pl-3 leading-normal text-muted-foreground">{source.excerpt}</p>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {isLatest && !message.stage && message.followUps?.length > 0 && (
        <SuggestionChips label="ASK NEXT" questions={message.followUps} disabled={!!busy} onAsk={onAsk} />
      )}
    </article>
  );
}

// onTypingChange(true/false): tells the page whether a question is being typed, so the lab robot can come and listen.
// embedded: the website widget's version (components/embed/EmbedChat.jsx): no header (the widget draws its own),
// and sources can be hidden by the owner (showSources).
export function ChatPanel({ messages, busy, hasDocuments, documentName, documentChunks, suggestions = [], onAsk, onTypingChange, embedded = false, showSources = true }) {
  const [question, setQuestion] = useState("");
  const logRef = useRef(null);
  const answering = busy === "answer";
  const typing = !!question.trim();

  useEffect(() => {
    onTypingChange?.(typing);
  }, [typing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll only the message list (scrollIntoView would also scroll the whole page, e.g. during uploads).
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: scrollBehavior() });
  }, [messages, answering]);

  function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setQuestion("");
    onAsk(text);
  }

  return (
    <section aria-labelledby={embedded ? undefined : "chat-title"} aria-label={embedded ? "Chat" : undefined} data-robot-hide className={cn("flex min-h-0 min-w-0 flex-col bg-card", embedded && "flex-1")}>
      {!embedded && (
        // data-robot-drop: the robot sometimes drops down into the chat from behind this header (AiRobot.jsx)
        <div data-robot-drop className="border-b px-5 py-5 sm:px-8 sm:py-6">
          <h2 id="chat-title" className="text-base font-bold">Ask your documents</h2>
          <p className="mt-1 text-xs text-muted-foreground">Answers come from the file marked &ldquo;In chat&rdquo;, with every claim linked to its source.</p>
        </div>
      )}

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className={cn("flex-1 overflow-y-auto px-5 py-6", embedded ? "min-h-0" : "min-h-[300px] sm:px-8 lg:max-h-[calc(100vh-250px)]")}
      >
        {messages.length ? (
          // Only the selected file's conversation is passed in (hooks/useWorkspace.js), so each file has its own screen.
          messages.map((message, index) => (
            <Message key={`${message.documentId}-${index}`} message={message} isLatest={index === messages.length - 1} busy={busy} onAsk={onAsk} documentChunks={documentChunks} showSources={showSources} />
          ))
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <span className="mb-3.5 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-glow text-primary-foreground shadow-[0_0_24px_hsl(var(--glow)/0.45)]">
              <BookOpen className="size-5" />
            </span>
            <h3 className="max-w-full truncate px-4 font-semibold">{documentName ? `Ask about ${documentName}` : "Ask a question"}</h3>
            <p className="mt-1 max-w-64 text-xs text-muted-foreground">
              {hasDocuments ? "Your answer will include references to the source passages." : "Import a document to begin."}
            </p>
            {hasDocuments && (
              <SuggestionChips label="TRY ASKING" questions={suggestions.length ? suggestions : STARTER_QUESTIONS} disabled={!!busy} onAsk={onAsk} centered />
            )}
          </div>
        )}
      </div>

      {documentName && (
        <p className="mx-5 mb-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:mx-6">
          <FileText className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">
            Answering from <span className="font-semibold text-foreground">{documentName}</span>
          </span>
          <span className="hidden shrink-0 sm:inline">· pick another file in Documents</span>
        </p>
      )}
      <form
        onSubmit={submit}
        data-robot-spot="chat" // the robot comes here while you ask and it answers
        className={cn(
          "mx-5 mb-5 flex rounded-lg border bg-card p-1.5 shadow-sm transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--glow)/0.25),0_0_24px_hsl(var(--glow)/0.25)] sm:mx-6 sm:mb-6",
          // While answering, the box glows and breathes (a steady glow if motion is reduced).
          answering && "border-glow shadow-[0_0_0_3px_hsl(var(--glow)/0.25),0_0_24px_hsl(var(--glow)/0.35)] motion-safe:animate-glow",
        )}
      >
        <Input
          aria-label="Question"
          placeholder={documentName ? `Ask about ${documentName}...` : hasDocuments ? "Ask a question..." : "Upload a document to ask a question"}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={!hasDocuments || !!busy}
          maxLength={2000}
          className="h-9 border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" title="Send question" aria-label="Send question" disabled={!question.trim() || !!busy || !hasDocuments}>
          <Send />
        </Button>
      </form>
    </section>
  );
}
