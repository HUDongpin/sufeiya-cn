import { NextResponse } from "next/server";

const contentSecurityPolicy = [
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

export default function proxy() {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Sufeiya-Account-Mode", "local-only");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/(api|trpc)(.*)",
  ],
};
