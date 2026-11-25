// Step 4 — Store: save each chunk's vector and text in Pinecone, so it can be searched later.
// Each project gets its own namespace, so projects never see each other's chunks.
// Vector ids are "<documentId>-0", "<documentId>-1", …, so a document's vectors can be found and deleted by id.
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { BATCH_SIZE, createEmbeddings } from "./embed.js";

const FETCH_BATCH_SIZE = 100; // fetch sends ids in the URL, so batches stay small

function checkCredentials() {
  if (!process.env.GOOGLE_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error("Google and Pinecone credentials must be configured.");
  }
}

// One shared client per server process. A new client first looks up the index address,
// which measured 2–3.5 s per request; a reused client searches in ~0.3 s.
let sharedIndex;
function pineconeIndex() {
  checkCredentials();
  sharedIndex ??= new PineconeClient().Index(process.env.PINECONE_INDEX);
  return sharedIndex;
}

// LangChain's Pinecone store for one project: add, search (also as a retriever) and delete.
export async function getVectorStore(projectId) {
  return PineconeStore.fromExistingIndex(createEmbeddings(), { pineconeIndex: pineconeIndex(), namespace: projectId });
}

// Embeds the chunks (step 3 happens inside addDocuments) and saves them with the info answers need to cite them.
// Goes one embedding batch at a time, so onProgress(done, total) can report real progress to the upload screen.
export async function storeChunks(projectId, documentId, filename, chunks, ids, onProgress = () => {}) {
  const store = await getVectorStore(projectId);
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    await store.addDocuments(
      batch.map((chunk) => ({
        pageContent: chunk.pageContent,
        metadata: { documentId, filename, location: chunk.metadata.location },
      })),
      { ids: ids.slice(start, start + BATCH_SIZE) },
    );
    onProgress(start + batch.length, chunks.length);
  }
}

// Reads chunks back by id, in id order: [{ location, text }]. Export uses this to scan a whole document.
// LangChain saves each chunk's text in the "text" metadata field.
export async function fetchChunks(projectId, ids) {
  const index = pineconeIndex().namespace(projectId);
  const batches = [];
  for (let start = 0; start < ids.length; start += FETCH_BATCH_SIZE) {
    batches.push(ids.slice(start, start + FETCH_BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((batch) => index.fetch(batch)));
  const records = Object.assign({}, ...results.map((result) => result.records));

  return ids
    .map((id) => records[id]?.metadata)
    .filter((metadata) => metadata?.text)
    .map((metadata) => ({ location: chunkLocation(metadata), text: metadata.text }));
}

// "Page 3" or "Sheet1, row 12".
export function chunkLocation(metadata) {
  return metadata.location ?? "Unknown location";
}
