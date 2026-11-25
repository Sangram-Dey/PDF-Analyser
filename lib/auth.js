import { auth } from "@clerk/nextjs/server";
import { HttpError } from "./http.js";

// The signed-in Clerk user's id. Every API route calls this first; services then only touch that user's data.
export async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new HttpError(401, "Sign in to continue.");
  return userId;
}
