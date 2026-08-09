import "server-only";

import { createHmac, randomBytes } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const MAX_BUCKETS = 1_000;
const ephemeralSalt = randomBytes(32);

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientFingerprint(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const configuredSalt = process.env.SUFEIYA_RATE_LIMIT_SALT;
  const key = configuredSalt ? Buffer.from(configuredSalt) : ephemeralSalt;
  return createHmac("sha256", key).update(ip).digest("hex");
}

export function checkSuperTeacherRateLimit(request: Request) {
  const now = Date.now();
  prune(now);
  const fingerprint = clientFingerprint(request);
  const current = buckets.get(fingerprint);
  if (!current && buckets.size >= MAX_BUCKETS) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }
  if (!current || current.resetAt <= now) {
    buckets.set(fingerprint, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }
  if (current.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - current.count, retryAfterSeconds: 0 };
}
