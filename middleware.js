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
  // Every route except Next.js internals, static files (Clerk's recommended matcher), and the public website
  // widget: its chat page (/embed/…) and API (/api/widget/…) need no account, and skipping sign-in entirely avoids
  // sign-in redirects inside other sites' iframes. (/widget.js is a static file, so it's already skipped.)
  matcher: [
    "/((?!_next|embed|api/widget|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/widget)|trpc)(.*)",
  ],
};
