import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  debug: process.env.CLERK_MIDDLEWARE_DEBUG === "true",
  contentSecurityPolicy: {
    strict: false,
    directives: {
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "img-src": ["'self'", "data:", "https://img.clerk.com"],
      "object-src": ["'none'"],
      "media-src": ["'self'"],
    },
  },
});

export const config = {
  matcher: [
    // Run Clerk for every application and public-file request. Existing public
    // assets are still served normally, while a missing dotted path (for
    // example /favicon.ico) can render the shared 404 shell without calling
    // Clerk outside middleware coverage. Only Next's own immutable internals
    // are skipped.
    "/((?!_next/static|_next/image|_next/webpack-hmr).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
