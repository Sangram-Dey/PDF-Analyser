// One MongoDB connection for the whole app.
// Next.js reloads modules in development and starts many function instances in production,
// so the connection is cached on `global` and reused instead of opening a new one per request.
import mongoose from "mongoose";

const DATABASE_NAME = "sourcework";

const cache = global._mongoose ?? (global._mongoose = { promise: null });

export async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: DATABASE_NAME,
        serverSelectionTimeoutMS: 5000, // fail fast with a clear error if MongoDB is down
      })
      .catch((error) => {
        cache.promise = null; // let the next request try again
        throw error;
      });
  }
  return cache.promise;
}
