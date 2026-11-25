// Step 2 — Chunk: split pages/rows into small overlapping pieces, so search can find the exact passage.
// The splitter prefers to cut at paragraph, then line, then sentence breaks; each chunk keeps its metadata.location.
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,   // characters (≈250 tokens)
  chunkOverlap: 200, // repeated between neighbours, so a fact cut in half still appears whole in one chunk
});

export function splitIntoChunks(documents) {
  return splitter.splitDocuments(documents);
}
