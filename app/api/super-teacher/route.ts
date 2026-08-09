import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { SUPER_TEACHER_PROTOCOL, superTeacherRequestSchema } from "@/lib/super-teacher/contracts";
import { classifyTeacherQuestion } from "@/lib/super-teacher/policy";
import { checkSuperTeacherRateLimit } from "@/lib/super-teacher/rate-limit";
import { createTeacherResponse } from "@/lib/super-teacher/responder";
import { admittedSourceCounts, buildGroundingBundle } from "@/lib/super-teacher/sources";

export const maxDuration = 30;

const MAX_BODY_BYTES = 32_000;

function responseHeaders(mode?: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Sufeiya-Account-Mode": "local-only",
    ...(mode ? { "X-Sufeiya-Teacher-Mode": mode } : {}),
  };
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...responseHeaders(), ...init?.headers },
  });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function gatewayConfigured() {
  return process.env.SUFEIYA_AI_ENABLED === "true" &&
    Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function GET() {
  const counts = admittedSourceCounts();
  return json({
    protocolVersion: SUPER_TEACHER_PROTOCOL,
    status: "gate_a_limited",
    answerMode: gatewayConfigured() ? "grounded_ai_with_manual_fallback" : "manual_grounded_fallback",
    modelGenerationEnabled: gatewayConfigured(),
    accountMode: "local-only",
    sourceBoundary: {
      claimSourcesAdmitted: counts.claimSources,
      linkOnlyResources: counts.linkOnlyResources,
      detOfficialSourcesAdmitted: counts.detOfficialSources,
      archivedKnowledgeChunksAdmitted: counts.archivedKnowledgeChunks,
    },
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!isSameOrigin(request)) {
    return json({ error: "origin_not_allowed", requestId }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large", requestId }, { status: 413 });
  }

  const rateLimit = checkSuperTeacherRateLimit(request);
  if (!rateLimit.allowed) {
    return json(
      { error: "rate_limited", requestId, retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return json({ error: "request_too_large", requestId }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json", requestId }, { status: 400 });
  }

  const parsed = superTeacherRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "invalid_request", requestId }, { status: 400 });
  }

  const decision = classifyTeacherQuestion(parsed.data.question);
  const bundle = buildGroundingBundle(decision.intent, parsed.data.learnerContext);
  const answer = await createTeacherResponse({
    request: parsed.data,
    decision,
    bundle,
    requestId,
    abortSignal: request.signal,
  });

  return Response.json(answer, {
    headers: {
      ...responseHeaders(answer.mode),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
}
