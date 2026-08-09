import { generateText, Output } from "ai";

import {
  modelTeacherSelectionSchema,
  type ModelTeacherSelection,
} from "@/lib/super-teacher/contracts";

const DEFAULT_GATEWAY_MODEL = "zai/glm-4.6v-flash";
const DEFAULT_DASHSCOPE_MODEL = "qwen3.7-max";
const MODEL_TIMEOUT_MS = 15_000;
const MAX_DASHSCOPE_RESPONSE_BYTES = 64_000;

const allowedDashScopeModels = new Set([
  "qwen3.7-max",
  "qwen3.8-max-preview",
]);

const dashScopeLegacyEndpoints = {
  beijing: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  singapore: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
} as const;

type Environment = Record<string, string | undefined>;
type DashScopeRegion = keyof typeof dashScopeLegacyEndpoints;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type TeacherModelRuntime =
  | {
      provider: "gateway";
      model: string;
    }
  | {
      provider: "dashscope";
      model: string;
      region: DashScopeRegion;
      endpoint: string;
      apiKey: string;
    };

function clean(value: string | undefined) {
  return value?.trim() || "";
}

function validGatewayModel(model: string) {
  return /^[a-z0-9][a-z0-9._/-]{1,120}$/i.test(model);
}

function validDashScopeKey(apiKey: string) {
  return /^sk-[A-Za-z0-9_-]{12,}$/.test(apiKey);
}

function validWorkspaceId(workspaceId: string) {
  return /^[A-Za-z0-9-]{3,80}$/.test(workspaceId);
}

function dashScopeEndpoint(region: DashScopeRegion, workspaceId: string) {
  if (!workspaceId) return dashScopeLegacyEndpoints[region];
  if (!validWorkspaceId(workspaceId)) return null;
  const regionalHost = region === "beijing"
    ? `${workspaceId}.cn-beijing.maas.aliyuncs.com`
    : `${workspaceId}.ap-southeast-1.maas.aliyuncs.com`;
  return `https://${regionalHost}/compatible-mode/v1`;
}

export function resolveTeacherModelRuntime(
  environment: Environment = process.env,
): TeacherModelRuntime | null {
  if (environment.SUFEIYA_AI_ENABLED !== "true") return null;

  const provider = clean(environment.SUFEIYA_AI_PROVIDER);
  if (provider === "gateway") {
    if (!clean(environment.AI_GATEWAY_API_KEY) && !clean(environment.VERCEL_OIDC_TOKEN)) {
      return null;
    }
    const model = clean(environment.SUFEIYA_AI_MODEL) || DEFAULT_GATEWAY_MODEL;
    return validGatewayModel(model) ? { provider, model } : null;
  }

  if (provider !== "dashscope") return null;
  const apiKey = clean(environment.DASHSCOPE_API_KEY);
  const region = clean(environment.DASHSCOPE_REGION) as DashScopeRegion;
  const model = clean(environment.SUFEIYA_AI_MODEL) || DEFAULT_DASHSCOPE_MODEL;
  if (
    !validDashScopeKey(apiKey) ||
    !Object.hasOwn(dashScopeLegacyEndpoints, region) ||
    !allowedDashScopeModels.has(model)
  ) {
    return null;
  }
  const endpoint = dashScopeEndpoint(region, clean(environment.DASHSCOPE_WORKSPACE_ID));
  return endpoint ? { provider, model, region, endpoint, apiKey } : null;
}

export function teacherModelReleaseStatus(environment: Environment = process.env) {
  const runtime = resolveTeacherModelRuntime(environment);
  return {
    enabled: Boolean(runtime),
    provider: runtime?.provider ?? null,
    model: runtime?.model ?? null,
    region: runtime?.provider === "dashscope" ? runtime.region : null,
  };
}

async function boundedResponseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DASHSCOPE_RESPONSE_BYTES) {
    return null;
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DASHSCOPE_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function invokeDashScopeModel({
  runtime,
  system,
  prompt,
  abortSignal,
  fetchImpl,
}: {
  runtime: Extract<TeacherModelRuntime, { provider: "dashscope" }>;
  system: string;
  prompt: string;
  abortSignal?: AbortSignal;
  fetchImpl: FetchLike;
}): Promise<ModelTeacherSelection | null> {
  const timeoutSignal = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const signal = abortSignal
    ? AbortSignal.any([abortSignal, timeoutSignal])
    : timeoutSignal;
  const response = await fetchImpl(`${runtime.endpoint}/chat/completions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        {
          role: "system",
          content: [
            system,
            "请严格只输出一个 JSON 对象，不要使用 Markdown 或代码围栏。",
            "JSON 必须且只能包含 headlineId、claimIds、limitationIds 三个字段。",
            "只能返回 APPROVED OUTPUT CATALOG 中已经给出的 ID；不得输出、改写或新增任何自然语言主张。",
          ].join("\n"),
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      enable_thinking: false,
      temperature: 0.1,
      max_completion_tokens: 220,
      stream: false,
    }),
    signal,
  });
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return null;
  }

  const responseText = await boundedResponseText(response);
  if (!responseText) return null;
  let envelope: unknown;
  try {
    envelope = JSON.parse(responseText);
  } catch {
    return null;
  }
  if (!envelope || typeof envelope !== "object") return null;
  const responseObject = envelope as {
    model?: unknown;
    choices?: Array<{
      finish_reason?: unknown;
      message?: { content?: unknown };
    }>;
  };
  const choice = responseObject.choices?.[0];
  if (
    responseObject.model !== runtime.model ||
    responseObject.choices?.length !== 1 ||
    choice?.finish_reason !== "stop" ||
    typeof choice.message?.content !== "string"
  ) {
    return null;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(choice.message.content);
  } catch {
    return null;
  }
  const parsed = modelTeacherSelectionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function invokeTeacherModel({
  runtime,
  system,
  prompt,
  abortSignal,
  fetchImpl = fetch,
}: {
  runtime: TeacherModelRuntime;
  system: string;
  prompt: string;
  abortSignal?: AbortSignal;
  fetchImpl?: FetchLike;
}): Promise<ModelTeacherSelection | null> {
  if (runtime.provider === "dashscope") {
    return invokeDashScopeModel({ runtime, system, prompt, abortSignal, fetchImpl });
  }

  const result = await generateText({
    model: runtime.model,
    system,
    prompt,
    output: Output.object({
      name: "SufeiyaGroundedTeacherAnswer",
      description: "An ordering of server-approved grounded claim IDs; no free-form claims are allowed.",
      schema: modelTeacherSelectionSchema,
    }),
    maxOutputTokens: 220,
    maxRetries: 0,
    timeout: { totalMs: MODEL_TIMEOUT_MS, stepMs: MODEL_TIMEOUT_MS },
    abortSignal,
  });
  const parsed = modelTeacherSelectionSchema.safeParse(result.output);
  return parsed.success ? parsed.data : null;
}
