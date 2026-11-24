# Sourcework

Sourcework is a project-based document workspace built with Next.js, LangChain, Gemini, Pinecone, ExcelJS, and PDFKit. Each project has its own Pinecone namespace.

## Setup

1. Run `npm install`.
2. Copy `.env.copy` to `.env` and set `GOOGLE_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX`.
3. Create a Pinecone index compatible with the `gemini-embedding-2` embedding dimensions.
4. Run `npm run dev` and open the local URL.

Run `npm run verify` for a production build while a dev server is running. It uses a separate `.next-verify` output directory to avoid the Windows `.next/trace` file lock.

## Workflow

1. Create or select a project.
2. Import PDF or Excel (`.xlsx`) files, up to 10 MB each. PDF pages and Excel sheet rows are parsed, split into passages, embedded, and stored in that project's Pinecone namespace.
3. Ask questions. The RAG endpoint searches only the selected project's namespace and returns an answer with source passages.
4. In Import & Export, select a document, enter up to 20 requested fields (one per line), choose Excel or PDF, and export. The server retrieves relevant passages from that document, extracts supported values, marks missing values as `Not found`, and downloads a file with field, value, and source location.

## Storage and limits

`data/projects.json` stores project and document metadata. `data/documents/` stores parsed text for new imports; older PDFs are reconstructed from their indexed Pinecone chunks when exported. Deleting a document or project removes its indexed vectors and local parsed content.

This storage design is for a local or single-server installation with a persistent filesystem. For multi-instance or serverless deployment, move metadata and parsed content to shared storage. The app has no user authentication; protect it before exposing it publicly. Scanned PDFs without embedded text require OCR before import.
