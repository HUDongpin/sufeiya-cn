import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import {
  getClerkAuthorizedParties,
  getClerkRuntimeState,
  isConfiguredClerkMiddlewarePathname,
  isClerkProtectedPathname,
} from "@/lib/auth/clerk-config";

const anonymousContentSecurityPolicy = [
  "base-uri 'self'",
  "connect-src 'self'",
  "default-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

const clerkState = getClerkRuntimeState();
const isProtectedRoute = createRouteMatcher(
  (request) => isClerkProtectedPathname(request.nextUrl.pathname),
);

const configuredClerkProxy = clerkState.configured
  ? clerkMiddleware(
      async (auth, request) => {
        if (isProtectedRoute(request)) await auth.protect();
        const response = NextResponse.next();
        response.headers.set("X-Sufeiya-Account-Mode", "clerk-access-local-learning-data");
        return response;
      },
      {
        authorizedParties: getClerkAuthorizedParties(),
        signInUrl: "/sign-in",
        signUpUrl: "/sign-up",
        contentSecurityPolicy: {
          strict: true,
          directives: {
            "base-uri": ["self"],
            "form-action": ["self"],
            "frame-ancestors": ["none"],
            "img-src": ["self", "data:"],
            "media-src": ["self"],
            "object-src": ["none"],
            "script-src-attr": ["none"],
            "worker-src": ["self", "blob:"],
          },
        },
      },
    )
  : null;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (
    configuredClerkProxy
    && isConfiguredClerkMiddlewarePathname(request.nextUrl.pathname)
  ) {
    return configuredClerkProxy(request, event);
  }

  if (isProtectedRoute(request)) {
    return new NextResponse("Account service unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Security-Policy": anonymousContentSecurityPolicy,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Sufeiya-Account-Mode": "clerk-unconfigured",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", anonymousContentSecurityPolicy);
  response.headers.set(
    "X-Sufeiya-Account-Mode",
    clerkState.configured ? "anonymous-no-clerk" : "clerk-unconfigured",
  );
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/workspace/:path*",
    "/diagnostic/:path*",
    "/plan/:path*",
    "/recommendations/:path*",
    "/today/:path*",
    "/practice/:path*",
    "/practice-reading/:path*",
    "/practice-listening/:path*",
    "/practice-writing/:path*",
    "/practice-speaking/:path*",
    "/focus/:path*",
    "/check-in/:path*",
    "/review/:path*",
    "/community/:path*",
    "/retest/:path*",
    "/my-data/:path*",
    "/teaching-review-demo/:path*",
    "/account/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
