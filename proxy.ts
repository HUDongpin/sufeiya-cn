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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
