import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  invokeTeacherModel,
  resolveTeacherModelRuntime,
  teacherModelReleaseStatus,
  type TeacherModelRuntime,
} from "../lib/super-teacher/model-runtime";

const validEnvironment = {
  SUFEIYA_AI_ENABLED: "true",
  SUFEIYA_AI_PROVIDER: "dashscope",
  SUFEIYA_AI_MODEL: "qwen3.7-max",
  DASHSCOPE_API_KEY: "sk-test_credential_123456",
  DASHSCOPE_REGION: "beijing",
};

const runtime: Extract<TeacherModelRuntime, { provider: "dashscope" }> = {
  provider: "dashscope",
  model: "qwen3.7-max",
  region: "beijing",
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-test_credential_123456",
};

function providerResponse(candidate: unknown, init: { status?: number; model?: string; finishReason?: string } = {}) {
  return new Response(JSON.stringify({
    model: init.model ?? "qwen3.7-max",
    choices: [{
      finish_reason: init.finishReason ?? "stop",
      message: { content: JSON.stringify(candidate) },
    }],
  }), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

const validCandidate = {
  headlineId: "headline-1",
  claimIds: ["claim-1"],
  limitationIds: ["limitation-1"],
};

describe("Sofia model runtime configuration", () => {
  it("stays disabled until provider and release switch are both explicit", () => {
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, SUFEIYA_AI_ENABLED: "false" }), null);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, SUFEIYA_AI_PROVIDER: "" }), null);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, DASHSCOPE_API_KEY: "" }), null);
  });

  it("allows only fixed Qwen models, regions, and validated workspace IDs", () => {
    const resolved = resolveTeacherModelRuntime(validEnvironment);
    assert.equal(resolved?.provider, "dashscope");
    assert.equal(resolved?.model, "qwen3.7-max");
    assert.equal(resolved?.provider === "dashscope" ? resolved.endpoint : null, runtime.endpoint);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, SUFEIYA_AI_MODEL: "qwen-plus" }), null);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, DASHSCOPE_REGION: "auto" }), null);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, DASHSCOPE_REGION: "toString" }), null);
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, DASHSCOPE_WORKSPACE_ID: "evil.example/path" }), null);
  });

  it("publishes status without credentials or provider endpoints", () => {
    const status = teacherModelReleaseStatus(validEnvironment);
    assert.deepEqual(status, {
      enabled: true,
      provider: "dashscope",
      model: "qwen3.7-max",
      region: "beijing",
    });
    assert.equal(JSON.stringify(status).includes("credential"), false);
    assert.equal(JSON.stringify(status).includes("dashscope.aliyuncs.com"), false);
  });
});

describe("DashScope approved-ID selection handling", () => {
  it("accepts one bounded JSON candidate and sends only to the fixed endpoint", async () => {
    let calledUrl = "";
    let authorization = "";
    let requestBody: Record<string, unknown> = {};
    const output = await invokeTeacherModel({
      runtime,
      system: "system",
      prompt: "prompt",
      fetchImpl: async (input, init) => {
        calledUrl = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        requestBody = JSON.parse(String(init?.body));
        return providerResponse(validCandidate);
      },
    });
    assert.deepEqual(output, validCandidate);
    assert.equal(calledUrl, `${runtime.endpoint}/chat/completions`);
    assert.equal(authorization, `Bearer ${runtime.apiKey}`);
    assert.equal(requestBody.model, "qwen3.7-max");
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.equal(requestBody.enable_thinking, false);
    assert.equal(requestBody.stream, false);
  });

  it("fails closed on provider errors, wrong models, truncation, and invalid schemas", async () => {
    const cases = [
      new Response("{}", { status: 403, headers: { "content-type": "application/json" } }),
      providerResponse(validCandidate, { model: "qwen3.8-max-preview" }),
      providerResponse(validCandidate, { finishReason: "length" }),
      providerResponse({ ...validCandidate, extra: "not allowed" }),
      new Response("not-json", { headers: { "content-type": "text/plain" } }),
    ];
    for (const response of cases) {
      const output = await invokeTeacherModel({
        runtime,
        system: "system",
        prompt: "prompt",
        fetchImpl: async () => response,
      });
      assert.equal(output, null);
    }
  });

  it("rejects an oversized provider response before parsing", async () => {
    const response = new Response("x", {
      headers: {
        "content-type": "application/json",
        "content-length": "64001",
      },
    });
    const output = await invokeTeacherModel({
      runtime,
      system: "system",
      prompt: "prompt",
      fetchImpl: async () => response,
    });
    assert.equal(output, null);
  });
});
