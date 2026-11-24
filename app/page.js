"use client";

import { useEffect, useRef, useState } from "react";
import { FiBookOpen, FiDownload, FiFileText, FiFolder, FiPlus, FiSend, FiTrash2, FiUploadCloud } from "react-icons/fi";
import ReactMarkdown from "react-markdown";

async function api(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [question, setQuestion] = useState("");
  const [exportDocument, setExportDocument] = useState("");
  const [requiredData, setRequiredData] = useState("");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [exportError, setExportError] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const selected = projects.find((project) => project.id === selectedId);
  const exportDocumentId = selected?.documents.some((doc) => doc.id === exportDocument) ? exportDocument : selected?.documents[0]?.id || "";

  useEffect(() => {
    api("/api/projects").then(({ projects }) => {
      setProjects(projects);
      if (projects.length) setSelectedId(projects[0].id);
    }).catch((err) => setError(err.message));
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function refresh() {
    const data = await api("/api/projects");
    setProjects(data.projects);
  }

  async function createProject(event) {
    event.preventDefault();
    if (!projectName.trim()) return;
    setError(""); setBusy("project");
    try {
      const { project } = await api("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: projectName }) });
      await refresh(); setSelectedId(project.id); setProjectName(""); setMessages([]);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function upload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!selected || !files.length) return;
    setError(""); setBusy("upload");
    try {
      for (const file of files) {
        const form = new FormData(); form.append("file", file);
        await api(`/api/projects/${selected.id}/documents`, { method: "POST", body: form });
      }
      await refresh();
    } catch (err) { setError(err.message); await refresh(); } finally { setBusy(""); }
  }

  async function exportData(event) {
    event.preventDefault();
    if (!selected || !exportDocumentId || !requiredData.trim() || busy) return;
    setExportError(""); setBusy("export");
    try {
      const response = await fetch(`/api/projects/${selected.id}/export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: exportDocumentId, requiredData, format: exportFormat }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not generate the export.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `extracted.${exportFormat}`;
      document.body.appendChild(link);
      link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setExportError(err.message); } finally { setBusy(""); }
  }

  async function removeDocument(documentId) {
    if (!selected || !window.confirm("Remove this document and its indexed content?")) return;
    setError(""); setBusy(documentId);
    try {
      await api(`/api/projects/${selected.id}/documents/${documentId}`, { method: "DELETE" });
      await refresh(); setMessages([]);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function removeProject() {
    if (!selected || !window.confirm(`Remove ${selected.name} and all its indexed documents?`)) return;
    setError(""); setBusy("project-delete");
    try {
      await api(`/api/projects/${selected.id}`, { method: "DELETE" });
      const data = await api("/api/projects");
      setProjects(data.projects); setSelectedId(data.projects[0]?.id || ""); setMessages([]);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function ask(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || !selected || busy) return;
    setQuestion(""); setError(""); setBusy("answer");
    setMessages((items) => [...items, { role: "user", text }]);
    try {
      const result = await api("/api/rag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selected.id, question: text }) });
      setMessages((items) => [...items, { role: "assistant", text: result.answer, sources: result.sources }]);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  function selectProject(id) { if (busy) return; setSelectedId(id); setExportDocument(""); setExportError(""); setMessages([]); setError(""); }

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon"><FiBookOpen /></span><span>Sourcework</span></div>
        <div className="section-label">PROJECTS</div>
        <div className="project-list">
          {projects.map((project) => <button key={project.id} onClick={() => selectProject(project.id)} disabled={!!busy} className={`project-item ${selectedId === project.id ? "active" : ""}`}><FiFolder /><span>{project.name}</span><small>{project.documents.length}</small></button>)}
        </div>
        <form className="new-project" onSubmit={createProject}>
          <input aria-label="New project name" placeholder="New project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} />
          <button title="Create project" aria-label="Create project" disabled={!!busy || !projectName.trim()}><FiPlus /></button>
        </form>
        <div className="sidebar-footer">Project knowledge workspace</div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div><div className="eyebrow">WORKSPACE</div><h1>{selected?.name || "Projects"}</h1></div><div className="topbar-actions"><span className="topbar-count">{selected ? `${selected.documents.length} document${selected.documents.length === 1 ? "" : "s"}` : "Select a project"}</span>{selected && <button className="icon-button" title="Remove project" aria-label="Remove project" onClick={removeProject} disabled={!!busy}><FiTrash2 /></button>}</div></header>
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
        {!selected ? <div className="empty-project"><FiFolder /><h2>Create your first project</h2><p>Give it a name in the sidebar to organize documents and questions.</p></div> : <div className="content-grid">
          <div className="documents-panel">
            <div className="panel-heading"><div><h2>Documents</h2><p>PDF and Excel files in this project</p></div><button className="primary-button" onClick={() => fileRef.current?.click()} disabled={!!busy}><FiUploadCloud />{busy === "upload" ? "Indexing..." : "Import"}</button></div>
            <input ref={fileRef} className="sr-only" type="file" accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple onChange={upload} />
            {selected.documents.length ? <div className="document-list">{selected.documents.map((doc) => <div className="document-row" key={doc.id}><span className="file-icon"><FiFileText /></span><div className="document-info"><strong title={doc.name}>{doc.name}</strong><span>{doc.format === "xlsx" ? "Excel" : "PDF"} | {doc.sections ?? doc.pages ?? 0} {doc.format === "xlsx" ? "rows" : "pages"} | {doc.chunks} passages</span></div><button className="icon-button" title={`Remove ${doc.name}`} aria-label={`Remove ${doc.name}`} onClick={() => removeDocument(doc.id)} disabled={!!busy}><FiTrash2 /></button></div>)}</div> : <div className="documents-empty"><FiFileText /><p>No documents yet</p><span>Import a PDF or Excel file to start asking questions.</span></div>}
          </div>
          <div className="chat-panel">
            <div className="chat-heading"><div><h2>Ask your documents</h2><p>Answers are based on this project&apos;s files.</p></div></div>
            <div className="messages">{messages.length ? messages.map((message, index) => <div key={index} className={`message ${message.role}`}><div className="message-label">{message.role === "user" ? "YOU" : "ANSWER"}</div><div className="message-text">{message.role === "assistant" ? <ReactMarkdown>{message.text}</ReactMarkdown> : message.text}</div>{message.sources?.length > 0 && <div className="sources"><div className="source-heading">Sources</div>{message.sources.map((source) => <details key={source.number}><summary>[{source.number}] {source.filename}{source.location ? ` | ${source.location}` : ""}</summary><p>{source.excerpt}</p></details>)}</div>}</div>) : <div className="chat-empty"><FiBookOpen /><h3>Ask a question</h3><p>{selected.documents.length ? "Your answer will include references to the source passages." : "Import a document to begin."}</p></div>}{busy === "answer" && <div className="thinking">Searching documents and preparing an answer...</div>}<div ref={bottomRef} /></div>
            <form className="composer" onSubmit={ask}><input aria-label="Question" placeholder={selected.documents.length ? "Ask about your documents..." : "Upload a PDF to ask a question"} value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!selected.documents.length || !!busy} maxLength={2000} /><button title="Send question" aria-label="Send question" disabled={!question.trim() || !!busy || !selected.documents.length}><FiSend /></button></form>
          </div>
        </div>}
        {selected && <section className="transfer-section" aria-labelledby="transfer-title">
          <div className="transfer-heading"><div className="eyebrow">DOCUMENT TOOLS</div><h2 id="transfer-title">Import &amp; Export</h2></div>
          <div className="transfer-grid">
            <div className="transfer-block"><h3>Import</h3><p>Add PDF or Excel (.xlsx) files to this project.</p><button className="secondary-button" type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}><FiUploadCloud />{busy === "upload" ? "Indexing files..." : "Choose files"}</button><span className="field-hint">Up to 10 MB per file</span></div>
            <form className="transfer-block export-form" onSubmit={exportData}><h3>Export extracted data</h3><p>Choose a document and the fields to collect.</p>
              <label htmlFor="export-document">Document</label><select id="export-document" value={exportDocumentId} onChange={(event) => setExportDocument(event.target.value)} disabled={!!busy || !selected.documents.length}>{selected.documents.length ? selected.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>) : <option value="">No documents available</option>}</select>
              <label htmlFor="required-data">Required data</label><textarea id="required-data" placeholder="Invoice number&#10;Invoice date&#10;Total amount" value={requiredData} onChange={(event) => setRequiredData(event.target.value)} rows={4} maxLength={1600} disabled={!!busy || !selected.documents.length} /><span className="field-hint">One field per line, up to 20 fields</span>
              <label htmlFor="export-format">Export format</label><select id="export-format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} disabled={!!busy}><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF (.pdf)</option></select>
              <button className="primary-button export-button" disabled={!!busy || !exportDocumentId || !requiredData.trim()}><FiDownload />{busy === "export" ? "Extracting data..." : "Export file"}</button>
              {exportError && <p className="export-error" role="alert">{exportError}</p>}
            </form>
          </div>
        </section>}
      </section>
    </main>
  );
}
