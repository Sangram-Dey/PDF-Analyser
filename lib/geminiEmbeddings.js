import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const BATCH_SIZE = 50;
const RETRY_DELAY_MS = 30000;
const MAX_RETRIES = 20;

// gemini-embedding-2 rate-limits embeddings to roughly 100 chunks per minute.
// Batches that exceed the limit come back as empty (dimension 0) vectors,
// so embed in small batches and retry after a pause when throttled.
export class BatchedGoogleEmbeddings extends GoogleGenerativeAIEmbeddings {
    async embedDocuments(texts) {
        const results = [];
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const embeddings = await this.embedBatchWithRetry(batch);
            results.push(...embeddings);
        }
        return results;
    }

    async embedBatchWithRetry(batch) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const embeddings = await super.embedDocuments(batch);
            const okCount = embeddings.filter((v) => v.length > 0).length;

            if (okCount === batch.length) {
                return embeddings;
            }

            if (okCount > 0) {
                // Partial success: retry only the failed texts
                const failed = batch.filter(
                    (_, idx) => embeddings[idx].length === 0
                );
                const recovered = await this.embedBatchWithRetry(failed);
                const recoveredIndex = new Map(
                    recovered.map((vec, idx) => [failed[idx], vec])
                );
                return batch.map(
                    (text, idx) => embeddings[idx].length > 0
                        ? embeddings[idx]
                        : recoveredIndex.get(text)
                );
            }

            console.warn(
                `Embedding batch throttled (attempt ${attempt + 1}), waiting ${RETRY_DELAY_MS / 1000}s...`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
        throw new Error(
            "Embedding failed after multiple retries (rate limit). Try again later."
        );
    }
}
