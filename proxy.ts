import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import {
  getClerkAuthorizedParties,
  getClerkRuntimeState,
} from "@/lib/auth/clerk-config";

const unconfiguredContentSecurityPolicy = [
  "base-uri 'self'",
  "connect-src 'self'",
  "default-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

const clerkState = getClerkRuntimeState();

const configuredClerkProxy = clerkState.configured
  ? clerkMiddleware(
      () => {
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
  if (configuredClerkProxy) return configuredClerkProxy(request, event);

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", unconfiguredContentSecurityPolicy);
  response.headers.set("X-Sufeiya-Account-Mode", "clerk-unconfigured");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
