import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import {
  getClerkAuthorizedParties,
  getClerkRuntimeState,
  isClerkBetaProtectedPathname,
  isConfiguredClerkMiddlewarePathname,
  isClerkProtectedPathname,
} from "@/lib/auth/clerk-config";
import {
  betaAccessFromSessionClaims,
  SUFEIYA_BETA_ACCESS_CONTEXT_HEADER,
  type SufeiyaBetaAccessContext,
} from "@/lib/auth/beta-access";

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
const isBetaProtectedRoute = createRouteMatcher(
  (request) => isClerkBetaProtectedPathname(request.nextUrl.pathname),
);

function responseHeaders(
  context: SufeiyaBetaAccessContext,
  policy: "public" | "signed-in-public" | "sensitive",
) {
  return {
    ...(policy === "public" ? {} : { "Cache-Control": "private, no-store, max-age=0" }),
    ...(policy === "sensitive" ? { "X-Robots-Tag": "noindex, nofollow" } : {}),
    "X-Sufeiya-Account-Mode": "clerk-invite-gated-local-learning-data",
    "X-Sufeiya-Beta-Access": context,
  };
}

function nextResponseWithBetaContext(
  request: NextRequest,
  context: SufeiyaBetaAccessContext,
  policy: "public" | "signed-in-public" | "sensitive",
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SUFEIYA_BETA_ACCESS_CONTEXT_HEADER, context);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(responseHeaders(context, policy))) {
    response.headers.set(name, value);
  }
  return response;
}

function betaAccessRedirect(request: NextRequest) {
  const target = new URL("/beta-access", request.url);
  target.searchParams.set("return_path", request.nextUrl.pathname);
  const response = NextResponse.redirect(target, 307);
  for (const [name, value] of Object.entries(responseHeaders("invitation_required", "sensitive"))) {
    response.headers.set(name, value);
  }
  return response;
}

function betaVerificationUnavailableResponse() {
  return new NextResponse(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内测资格暂时无法核验｜Sufeiya</title></head>
<body><main><h1>内测资格暂时无法核验。</h1><p>学习页面继续关闭；本机学习记录没有被读取、上传或改动。请稍后重新核验。</p><nav><a href="/beta-access">重新核验</a> · <a href="/account">管理或退出账户</a> · <a href="/">返回公开首页</a></nav></main></body>
</html>`, {
    status: 503,
    headers: {
      ...responseHeaders("verification_unavailable", "sensitive"),
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "30",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isIndexablePublicPath(pathname: string) {
  return pathname === "/"
    || pathname === "/learning-path"
    || pathname === "/platform"
    || pathname === "/resources"
    || pathname === "/about"
    || pathname === "/super-teacher";
}

function responsePolicy(pathname: string, signedIn: boolean) {
  if (!isIndexablePublicPath(pathname)) return "sensitive" as const;
  return signedIn ? "signed-in-public" as const : "public" as const;
}

function needsBetaContext(pathname: string) {
  return isClerkBetaProtectedPathname(pathname)
    || pathname === "/beta-access"
    || pathname === "/super-teacher"
    || pathname === "/"
    || pathname === "/learning-path"
    || pathname === "/platform"
    || pathname === "/resources"
    || pathname === "/about";
}

const configuredClerkProxy = clerkState.configured
  ? clerkMiddleware(
      async (auth, request) => {
        const signedIn = isProtectedRoute(request)
          ? await auth.protect()
          : await auth();
        const policy = responsePolicy(request.nextUrl.pathname, Boolean(signedIn.userId));
        if (!needsBetaContext(request.nextUrl.pathname)) {
          return nextResponseWithBetaContext(
            request,
            signedIn.userId ? "not_checked" : "signed_out",
            policy,
          );
        }
        if (!signedIn.userId) {
          return nextResponseWithBetaContext(request, "signed_out", policy);
        }

        const access = betaAccessFromSessionClaims(signedIn.sessionClaims);
        if (access.context === "verification_unavailable") {
          return isBetaProtectedRoute(request)
            ? betaVerificationUnavailableResponse()
            : nextResponseWithBetaContext(request, access.context, policy);
        }
        if (!access.approved && isBetaProtectedRoute(request)) {
          return betaAccessRedirect(request);
        }
        return nextResponseWithBetaContext(request, access.context, policy);
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
    "/beta-access/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
