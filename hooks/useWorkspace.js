"use client";

import { useEffect, useState } from "react";

// All workspace state and API calls live here, so the components only render.

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function postJson(body) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// Reads the answer stream: the server sends one JSON event per line, as soon as each is ready.
// Exported: the website widget's chat (components/embed/EmbedChat.jsx) reads the same stream.
export async function* readEvents(response) {
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader(); // bytes → text
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop(); // an unfinished line waits for the next piece
    for (const line of lines) if (line.trim()) yield JSON.parse(line);
  }
  if (buffer.trim()) yield JSON.parse(buffer); // the last line, if it had no "\n"
}

export function useWorkspace() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true); // the first load of the projects list
  const [busy, setBusy] = useState(""); // which action is running: "upload", "answer", "export", a document id...
  const [error, setError] = useState("");
  const [failedQuestion, setFailedQuestion] = useState(""); // the banner offers it again with "Try again"
  const [uploading, setUploading] = useState([]); // names of files still being indexed
  const [uploadProgress, setUploadProgress] = useState({}); // the current file: { stage, parts, unit, done, total }
  // The summary being made: { documentId, name, stage, done, total } (the robot and the file's card follow it), and the
  // last one finished: { name, at } (the robot's "Summary ready").
  const [summarizing, setSummarizing] = useState(null);
  const [summarized, setSummarized] = useState(null);
  const selected = projects.find((project) => project.id === selectedId);
  // The chat answers from one document at a time. Until one is clicked (or if it was deleted), the newest file.
  const [chatDocumentId, setChatDocumentId] = useState("");
  const chatDocument = selected?.documents.find((doc) => doc.id === chatDocumentId) ?? selected?.documents.at(-1);
  // Each file has its own conversation: all messages are kept (until refresh), and the chat shows this file's only.
  const chatMessages = messages.filter((message) => message.documentId === chatDocument?.id);

  useEffect(() => {
    api("/api/projects")
      .then(({ projects }) => {
        setProjects(projects);
        if (projects.length) setSelectedId(projects[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    const { projects } = await api("/api/projects");
    setProjects(projects);
    return projects;
  }

  // Runs one action: marks it busy, shows any error in the banner, returns true on success.
  async function run(label, action) {
    setError("");
    setFailedQuestion(""); // a new action replaces the old error, and its "Try again"
    setBusy(label);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  function selectProject(id) {
    if (busy) return;
    setSelectedId(id);
    setMessages([]);
    setError("");
  }

  function createProject(name) {
    return run("project", async () => {
      const { project } = await api("/api/projects", postJson({ name }));
      await refresh();
      setSelectedId(project.id);
      setMessages([]);
    });
  }

  // Confirmation happens in the UI (ConfirmDelete) before these are called.
  function removeProject() {
    if (!selected) return;
    return run("project-delete", async () => {
      await api(`/api/projects/${selected.id}`, { method: "DELETE" });
      const remaining = await refresh();
      setSelectedId(remaining[0]?.id || "");
      setMessages([]);
    });
  }

  // Files go one at a time. The server streams each file's progress (reading → splitting → embedding → saving),
  // which the indexing card shows as it happens.
  function uploadFiles(files) {
    if (!selected) return;
    setUploading(files.map((file) => file.name));
    return run("upload", async () => {
      try {
        for (const file of files) {
          setUploadProgress({});
          const form = new FormData();
          form.append("file", file);
          const response = await fetch(`/api/projects/${selected.id}/documents`, { method: "POST", body: form });
          if (!response.ok) {
            const body = await response.json();
            throw new Error(body.error || "Upload failed.");
          }
          for await (const event of readEvents(response)) {
            // merged, so counts from earlier stages (pages read) stay on screen
            if (event.type === "progress") setUploadProgress((progress) => ({ ...progress, ...event }));
            else if (event.type === "done") setChatDocumentId(event.document.id); // ask about the new file next
            else if (event.type === "error") throw new Error(event.message);
          }
          setUploading((names) => names.slice(1));
          await refresh(); // each file appears in the list as soon as it is ready
        }
      } finally {
        setUploading([]);
        setUploadProgress({});
        await refresh(); // show the files that did upload, even if a later one failed
      }
    });
  }

  function removeDocument(documentId) {
    if (!selected) return;
    return run(documentId, async () => {
      await api(`/api/projects/${selected.id}/documents/${documentId}`, { method: "DELETE" });
      await refresh();
      setMessages((items) => items.filter((message) => message.documentId !== documentId)); // only that file's chat goes
    });
  }

  // The answer streams in: an empty assistant message is added at once and filled as events arrive.
  // stage: "searching" (waiting for the server) → "reading" (sources found) → "writing" (text arriving) → done.
  function ask(question) {
    if (!selected || !chatDocument) return;
    const { id: documentId, name: documentName } = chatDocument;
    // Memory: the last 3 finished questions and answers about this same document go with the question,
    // so follow-ups like "and when is it due?" make sense. The server checks and shortens them (lib/services/rag.js).
    const history = messages
      .filter((message) => !message.stage && message.documentId === documentId)
      .slice(-6)
      .map(({ role, text }) => ({ role, text }));
    setFailedQuestion("");
    const updateAnswer = (patch) =>
      setMessages((items) => [...items.slice(0, -1), { ...items.at(-1), ...(typeof patch === "function" ? patch(items.at(-1)) : patch) }]);

    // Each message remembers its document, so the chat can label answers and mark where the document changed.
    setMessages((items) => [
      ...items,
      { role: "user", text: question, documentId, documentName },
      { role: "assistant", text: "", sources: [], followUps: [], stage: "searching", documentId, documentName },
    ]);
    return run("answer", async () => {
      try {
        const response = await fetch("/api/rag", postJson({ projectId: selected.id, documentId, question, history }));
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error || "Request failed.");
        }
        for await (const event of readEvents(response)) {
          if (event.type === "sources") updateAnswer({ sources: event.sources, stage: "reading" });
          else if (event.type === "text") updateAnswer((answer) => ({ text: answer.text + event.text, stage: "writing" }));
          else if (event.type === "done") updateAnswer({ text: event.answer, followUps: event.followUps, stage: undefined });
          else if (event.type === "error") throw new Error(event.message);
        }
      } catch (err) {
        setMessages((items) => items.slice(0, -2)); // drop the question and its unfinished answer: "Try again" re-asks it
        setFailedQuestion(question);
        throw err;
      }
    });
  }

  // One file's website-assistant settings and today's usage, for the Embed panel. Throw on failure; the panel shows the error.
  async function loadWidget(documentId) {
    return (await api(`/api/projects/${selected.id}/documents/${documentId}/widget`)).widget;
  }
  // Saves one file's settings; its on/off dot in the file lists is updated in place.
  async function saveWidget(documentId, settings) {
    const projectId = selected.id;
    const body = JSON.stringify(settings);
    const { widget } = await api(`/api/projects/${projectId}/documents/${documentId}/widget`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
    setProjects((items) => items.map((project) => project.id !== projectId ? project : {
      ...project,
      documents: project.documents.map((doc) => (doc.id === documentId ? { ...doc, widgetEnabled: widget.enabled } : doc)),
    }));
    return widget;
  }

  // A file's saved summary ({ text, running, updatedAt, … }). Throws on failure; the summary sheet shows the error.
  async function loadSummary(doc) {
    return (await api(`/api/projects/${selected.id}/documents/${doc.id}/summary`)).summary;
  }
  // Makes (or re-makes) a file's summary, reporting progress events as they stream in. Doesn't mark the app busy:
  // the chat and other files stay usable meanwhile. Returns the saved summary.
  // One summary at a time in the app, so the robot and the cards follow a single run.
  async function summarize(doc, onProgress) {
    if (summarizing) throw new Error(`Wait for the summary of ${summarizing.name} to finish.`);
    const projectId = selected.id;
    setSummarizing({ documentId: doc.id, name: doc.name, stage: "reading" });
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${doc.id}/summary`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not summarize this document.");
      }
      for await (const event of readEvents(response)) {
        if (event.type === "progress") {
          setSummarizing((current) => ({ ...current, ...event }));
          onProgress?.(event);
        } else if (event.type === "error") throw new Error(event.message);
        else if (event.type === "done") {
          setProjects((items) => items.map((project) => project.id !== projectId ? project : {
            ...project,
            documents: project.documents.map((item) => (item.id === doc.id ? { ...item, summaryAt: event.summary.updatedAt } : item)),
          }));
          setSummarized({ name: doc.name, at: Date.now() });
          return event.summary;
        }
      }
      throw new Error("The summary stopped before it finished. Try again.");
    } finally {
      setSummarizing(null);
    }
  }
  // From a file's card: errors go to the app's error banner. Returns the summary, or null if it failed.
  async function summarizeFromCard(doc) {
    setError("");
    try {
      return await summarize(doc);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }
  // Removes a file's saved summary (not the file). Throws on failure; the summary sheet shows the error.
  async function deleteSummary(doc) {
    const projectId = selected.id;
    await api(`/api/projects/${projectId}/documents/${doc.id}/summary`, { method: "DELETE" });
    setProjects((items) => items.map((project) => project.id !== projectId ? project : {
      ...project,
      documents: project.documents.map((item) => (item.id === doc.id ? { ...item, summaryAt: null } : item)),
    }));
  }

  // An Excel file's cells for the preview drawer ({ sheets }), read from the saved file on the server.
  // Read-only, and doesn't mark the app busy. Throws on failure. (PDFs open in a new tab instead: DocumentsPanel.)
  async function loadPreview(doc) {
    return api(`/api/projects/${selected.id}/documents/${doc.id}/preview`);
  }

  // The two export calls throw on failure, so the export sheet can show the error next to itself.

  // Runs the AI extraction and returns the rows for review.
  async function previewExport({ documentId, requiredData }) {
    setBusy("export");
    try {
      const { rows } = await api(`/api/projects/${selected.id}/export/preview`, postJson({ documentId, requiredData }));
      return rows;
    } finally {
      setBusy("");
    }
  }

  // Builds the file from the reviewed rows (no AI call) and downloads it.
  async function downloadExport({ documentId, rows, format }) {
    setBusy("download");
    try {
      const response = await fetch(`/api/projects/${selected.id}/export`, postJson({ documentId, rows, format }));
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not generate the export.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `extracted.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy("");
    }
  }

  return {
    projects, selected, messages: chatMessages, loading, busy, error, uploading, uploadProgress, chatDocument,
    clearError: () => {
      setError("");
      setFailedQuestion("");
    },
    retryAsk: failedQuestion ? () => ask(failedQuestion) : null, // set after a question failed
    selectChatDocument: setChatDocumentId, // shows that file's own chat; the others are kept for when you switch back
    selectProject, createProject, removeProject,
    uploadFiles, removeDocument, ask, loadPreview, previewExport, downloadExport, loadWidget, saveWidget,
    loadSummary, summarize, summarizeFromCard, deleteSummary, summarizing, summarized,
  };
}
