import { Buffer } from "node:buffer";

export const CLERK_PROTECTED_PATHS = [
  "/workspace",
  "/diagnostic",
  "/plan",
  "/recommendations",
  "/today",
  "/practice",
  "/practice-reading",
  "/practice-listening",
  "/practice-writing",
  "/practice-speaking",
  "/focus",
  "/check-in",
  "/review",
  "/community",
  "/retest",
  "/my-data",
  "/teaching-review-demo",
  "/account",
] as const;

export const CLERK_PRODUCTION_AUTHORIZED_PARTIES = [
  "https://sufeiya.cn",
  "https://www.sufeiya.cn",
] as const;

type ClerkInstanceType = "development" | "production";

export type ClerkRuntimeState = {
  configured: boolean;
  instanceType: ClerkInstanceType | null;
  reason: "configured" | "missing_keys" | "invalid_publishable_key" | "invalid_secret_key" | "instance_mismatch";
};

type ClerkEnvironment = {
  [key: string]: string | undefined;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  VERCEL_ENV?: string;
};

type RequestBoundary = Pick<Request, "headers" | "url">;

function publishableKeyType(value: string | undefined): ClerkInstanceType | null {
  const match = value?.match(/^pk_(test|live)_([A-Za-z0-9_-]+)$/);
  if (!match) return null;

  try {
    const decoded = Buffer.from(match[2], "base64url").toString("utf8");
    if (!decoded.endsWith("$") || decoded.slice(0, -1).includes("$") || !decoded.slice(0, -1).includes(".")) {
      return null;
    }
  } catch {
    return null;
  }

  return match[1] === "test" ? "development" : "production";
}

function secretKeyType(value: string | undefined): ClerkInstanceType | null {
  const match = value?.match(/^sk_(test|live)_[A-Za-z0-9_-]{12,}$/);
  if (!match) return null;
  return match[1] === "test" ? "development" : "production";
}

export function getClerkRuntimeState(environment: ClerkEnvironment = process.env): ClerkRuntimeState {
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = environment.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    return { configured: false, instanceType: null, reason: "missing_keys" };
  }

  const publishableType = publishableKeyType(publishableKey);
  if (!publishableType) {
    return { configured: false, instanceType: null, reason: "invalid_publishable_key" };
  }

  const secretType = secretKeyType(secretKey);
  if (!secretType) {
    return { configured: false, instanceType: null, reason: "invalid_secret_key" };
  }

  if (publishableType !== secretType) {
    return { configured: false, instanceType: null, reason: "instance_mismatch" };
  }

  const vercelEnvironment = environment.VERCEL_ENV?.trim();
  if (vercelEnvironment) {
    const requiredType = vercelEnvironment === "production"
      ? "production"
      : vercelEnvironment === "preview" || vercelEnvironment === "development"
        ? "development"
        : null;
    if (!requiredType || publishableType !== requiredType) {
      return { configured: false, instanceType: null, reason: "instance_mismatch" };
    }
  }

  return { configured: true, instanceType: publishableType, reason: "configured" };
}

export function isSameOriginBrowserRequest(request: RequestBoundary) {
  const serializedOrigin = request.headers.get("origin");
  if (!serializedOrigin) return false;

  try {
    const origin = new URL(serializedOrigin);
    const requestOrigin = new URL(request.url).origin;
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) return false;
    return origin.origin === requestOrigin;
  } catch {
    return false;
  }
}

export function hasApplicationJsonContentType(request: Pick<RequestBoundary, "headers">) {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

export function isClerkProtectedPathname(pathname: string) {
  return CLERK_PROTECTED_PATHS.some(
    (protectedPath) => pathname === protectedPath || pathname.startsWith(`${protectedPath}/`),
  );
}

export function getClerkAuthorizedParties(environment: ClerkEnvironment = process.env) {
  if (environment.VERCEL_ENV !== "production") return undefined;
  return [...CLERK_PRODUCTION_AUTHORIZED_PARTIES];
}
