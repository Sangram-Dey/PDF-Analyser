import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Runs before every page and API request. Clerk reads the session cookie here, so auth() works in routes.
const isAuthPage = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const isApi = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    // Pages: signed-out visitors are sent to /sign-in.
    // API routes are not redirected here; each one calls requireUserId() and answers 401 as JSON.
    if (!isAuthPage(request) && !isApi(request)) await auth.protect();
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  // Every route except Next.js internals and static files (Clerk's recommended matcher).
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
