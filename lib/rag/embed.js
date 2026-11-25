// Step 3 — Embed: turn each chunk (and later each question) into a vector, a list of numbers that captures its meaning.
// Chunks with similar meaning get vectors that are close together, which is what makes search by meaning work.
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const EMBEDDING_MODEL = "gemini-embedding-2";

export const BATCH_SIZE = 50;
const RETRY_DELAY_MS = 30000;
const MAX_RETRIES = 20;

// LangChain's Gemini embeddings, plus batching and retry:
// gemini-embedding-2 allows roughly 100 chunks per minute, and over-limit batches come back as empty vectors.
class BatchedGoogleEmbeddings extends GoogleGenerativeAIEmbeddings {
  async embedDocuments(texts) {
    const results = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      results.push(...(await this.embedBatchWithRetry(texts.slice(i, i + BATCH_SIZE))));
    }
    return results;
  }

  async embedBatchWithRetry(batch) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const embeddings = await super.embedDocuments(batch);
      const okCount = embeddings.filter((vector) => vector.length > 0).length;
      if (okCount === batch.length) return embeddings;

      if (okCount > 0) {
        // Partial success: retry only the texts that came back empty.
        const failed = batch.filter((_, index) => embeddings[index].length === 0);
        const recovered = await this.embedBatchWithRetry(failed);
        const recoveredByText = new Map(recovered.map((vector, index) => [failed[index], vector]));
        return batch.map((text, index) => (embeddings[index].length > 0 ? embeddings[index] : recoveredByText.get(text)));
      }

      console.warn(`Embedding batch throttled (attempt ${attempt + 1}), waiting ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    throw new Error("Embedding failed after multiple retries (rate limit). Try again later.");
  }
}

// Created on demand, because the constructor needs GOOGLE_API_KEY.
export function createEmbeddings() {
  return new BatchedGoogleEmbeddings({ model: EMBEDDING_MODEL });
}
