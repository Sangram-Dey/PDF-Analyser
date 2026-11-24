import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { BatchedGoogleEmbeddings } from "./geminiEmbeddings.js";

export async function getVectorStore(projectId) {
  if (!process.env.GOOGLE_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error("Google and Pinecone credentials must be configured.");
  }
  const pinecone = new PineconeClient();
  return PineconeStore.fromExistingIndex(
    new BatchedGoogleEmbeddings({ model: "gemini-embedding-2" }),
    { pineconeIndex: pinecone.Index(process.env.PINECONE_INDEX), namespace: projectId }
  );
}
