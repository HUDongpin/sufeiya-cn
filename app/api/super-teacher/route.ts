import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { auth } from "@clerk/nextjs/server";

import {
  getClerkRuntimeState,
  hasApplicationJsonContentType,
  isSameOriginBrowserRequest,
} from "@/lib/auth/clerk-config";
import { evaluateReleaseSurface } from "@/lib/release-governance";
import {
  superTeacherRequestSchema,
  superTeacherResponseSchema,
} from "@/lib/super-teacher/contracts";
import { classifyTeacherQuestion } from "@/lib/super-teacher/policy";
import { checkSuperTeacherRateLimit } from "@/lib/super-teacher/rate-limit";
import { createTeacherResponse } from "@/lib/super-teacher/responder";
import { buildGroundingBundle } from "@/lib/super-teacher/sources";
import { buildSuperTeacherStatusResponse } from "@/lib/super-teacher/status";

export const maxDuration = 30;

const MAX_BODY_BYTES = 32_000;

function responseHeaders(mode?: string) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Sufeiya-Account-Mode": "clerk-access-local-learning-data",
    ...(mode ? { "X-Sufeiya-Teacher-Mode": mode } : {}),
  };
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...responseHeaders(), ...init?.headers },
  });
}

export async function GET() {
  return json(buildSuperTeacherStatusResponse());
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!isSameOriginBrowserRequest(request)) {
    return json({ error: "origin_not_allowed", requestId }, { status: 403 });
  }
  if (!hasApplicationJsonContentType(request)) {
    return json({ error: "unsupported_media_type", requestId }, { status: 415 });
  }

  const firstPartyProcessing = evaluateReleaseSurface("sofia_first_party_text_processing");
  const clerkState = getClerkRuntimeState();
  if (!clerkState.configured) {
    return json({ error: "account_service_unavailable", requestId }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) {
    return json({ error: "authentication_required", requestId }, { status: 401 });
  }
  if (!firstPartyProcessing.enabled) {
    return json({ error: "student_data_processing_not_approved", requestId }, { status: 503 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large", requestId }, { status: 413 });
  }

  const rateLimit = checkSuperTeacherRateLimit(userId);
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
  const validatedAnswer = superTeacherResponseSchema.safeParse(answer);
  if (!validatedAnswer.success) {
    return json({ error: "invalid_response", requestId }, { status: 500 });
  }

  return Response.json(validatedAnswer.data, {
    headers: {
      ...responseHeaders(validatedAnswer.data.mode),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
}
