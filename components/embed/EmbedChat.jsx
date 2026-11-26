"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ChatPanel } from "@/components/workspace/ChatPanel";
import { RobotDrawing } from "@/components/workspace/AiRobot";
import { readEvents } from "@/hooks/useWorkspace";
import { useRobot } from "@/hooks/useRobot";

// The website widget's chat, shown inside an iframe on the owner's allowed sites (opened by public/widget.js).
//
// Which site is showing it? The loader (widget.js) and this page shake hands with postMessage: this page says
// "ready", the loader answers "hello", and the browser stamps that answer with the real site's address
// (event.origin), which a site can't fake. Only the owner's allowed sites (or this app itself, for the Embed
// panel's preview) get the chat; anywhere else it stays locked.
//
// The chat itself is the app's own ChatPanel (streaming, citations, the vault, follow-ups), and the robot in the
// header reacts to each step with the same states as in the app (hooks/useRobot.js).
export function EmbedChat({ widgetKey, config, allowedOrigins }) {
  const [site, setSite] = useState(null); // the verified site showing this chat
  const [locked, setLocked] = useState(false);
  const siteRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState(""); // offered again with "Try again"
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const own = window.location.origin;
    if (window.parent === window) return setLocked(true); // opened on its own, not inside a website
    function onMessage(event) {
      if (event.source !== window.parent || event.data?.type !== "sourcework:hello") return;
      if (event.origin === own || allowedOrigins.includes(event.origin)) {
        siteRef.current = event.origin;
        setSite(event.origin);
      }
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "sourcework:ready" }, "*"); // carries no data: just "introduce yourself"
    const timer = setTimeout(() => !siteRef.current && setLocked(true), 4000); // no allowed site answered
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, [allowedOrigins]);

  const [robot] = useRobot({
    projectId: widgetKey,
    vectors: 0,
    uploading: [],
    uploadProgress: {},
    answering: busy === "answer",
    latest: messages.at(-1),
    typing,
    error,
    task: "",
    exportOpen: false,
  });

  // Same streaming flow as the app's chat (hooks/useWorkspace.js → ask), sent to the widget's public endpoint.
  async function ask(question) {
    if (busy) return;
    const history = messages.filter((message) => !message.stage).slice(-6).map(({ role, text }) => ({ role, text }));
    const updateAnswer = (patch) =>
      setMessages((items) => [...items.slice(0, -1), { ...items.at(-1), ...(typeof patch === "function" ? patch(items.at(-1)) : patch) }]);
    setError("");
    setFailedQuestion("");
    setBusy("answer");
    setMessages((items) => [...items, { role: "user", text: question }, { role: "assistant", text: "", sources: [], followUps: [], stage: "searching" }]);
    try {
      const response = await fetch(`/api/widget/${widgetKey}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not answer right now.");
      for await (const event of readEvents(response)) {
        if (event.type === "sources") updateAnswer({ sources: event.sources, stage: "reading" });
        else if (event.type === "text") updateAnswer((answer) => ({ text: answer.text + event.text, stage: "writing" }));
        else if (event.type === "done") updateAnswer({ text: event.answer, followUps: event.followUps, stage: undefined });
        else if (event.type === "error") throw new Error(event.message);
      }
    } catch (err) {
      setMessages((items) => items.slice(0, -2)); // drop the question and its unfinished answer: "Try again" re-asks it
      setError(err.message);
      setFailedQuestion(question);
    } finally {
      setBusy("");
    }
  }

  const close = () => siteRef.current && window.parent.postMessage({ type: "sourcework:close" }, siteRef.current);

  return (
    <div className="flex h-dvh flex-col bg-card text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="size-12 shrink-0">
          <RobotDrawing state={robot.state} moving={false} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{config.title}</h1>
          <p role="status" className="truncate text-xs text-muted-foreground">{robot.badge || config.welcome}</p>
        </div>
        {site && (
          <button
            type="button"
            onClick={close}
            aria-label="Close chat"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
          {failedQuestion && !busy && (
            <button type="button" onClick={() => ask(failedQuestion)} className="shrink-0 rounded px-2 py-1 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Try again
            </button>
          )}
        </div>
      )}

      {site ? (
        <ChatPanel
          embedded
          showSources={config.showSources}
          messages={messages}
          busy={busy}
          hasDocuments
          suggestions={config.starterQuestions}
          onAsk={ask}
          onTypingChange={setTyping}
        />
      ) : (
        <p className="m-auto max-w-64 px-4 text-center text-sm text-muted-foreground">
          {locked ? "This assistant can only be used on its own website." : "Starting…"}
        </p>
      )}
    </div>
  );
}
