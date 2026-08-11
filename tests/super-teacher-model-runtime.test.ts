import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAllowedDashScopeEndpoint,
  invokeTeacherModel,
  parseDashScopeModelResponse,
  resolveTeacherModelConfiguration,
  resolveTeacherModelRuntime,
  teacherModelReleaseStatus,
  type TeacherModelRuntime,
} from "../lib/super-teacher/model-runtime";

const validEnvironment = {
  SUFEIYA_AI_ENABLED: "true",
  SUFEIYA_AI_PROVIDER: "dashscope",
  SUFEIYA_AI_MODEL: "qwen3.8-max",
  DASHSCOPE_API_KEY: "sk-test_credential_123456",
  DASHSCOPE_REGION: "beijing",
};

const runtime: Extract<TeacherModelRuntime, { provider: "dashscope" }> = {
  provider: "dashscope",
  model: "qwen3.8-max",
  region: "beijing",
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-test_credential_123456",
};

function providerResponse(candidate: unknown, init: { status?: number; model?: string; finishReason?: string } = {}) {
  return new Response(JSON.stringify({
    model: init.model ?? "qwen3.8-max",
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
  it("stays disabled until provider configuration and the canonical decision register are both approved", () => {
    assert.equal(resolveTeacherModelRuntime({ ...validEnvironment, SUFEIYA_AI_ENABLED: "false" }), null);
    assert.equal(resolveTeacherModelRuntime(validEnvironment), null);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, SUFEIYA_AI_PROVIDER: "" }), null);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, DASHSCOPE_API_KEY: "" }), null);
  });

  it("validates requested configuration against fixed Qwen models, regions, and workspace IDs before governance", () => {
    const resolved = resolveTeacherModelConfiguration(validEnvironment);
    assert.equal(resolved?.provider, "dashscope");
    assert.equal(resolved?.model, "qwen3.8-max");
    assert.equal(resolved?.provider === "dashscope" ? resolved.endpoint : null, runtime.endpoint);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, SUFEIYA_AI_MODEL: "qwen-plus" }), null);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, DASHSCOPE_REGION: "auto" }), null);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, DASHSCOPE_REGION: "toString" }), null);
    assert.equal(resolveTeacherModelConfiguration({ ...validEnvironment, DASHSCOPE_WORKSPACE_ID: "evil.example/path" }), null);
    assert.equal(
      isAllowedDashScopeEndpoint("https://workspace-1.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", "beijing"),
      true,
    );
    assert.equal(
      isAllowedDashScopeEndpoint("https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1", "singapore"),
      false,
    );
    assert.equal(
      isAllowedDashScopeEndpoint("https://example.invalid/compatible-mode/v1", "beijing"),
      false,
    );
  });

  it("publishes a blocked governance status without credentials or provider endpoints", () => {
    const status = teacherModelReleaseStatus(validEnvironment);
    assert.deepEqual(status, {
      enabled: false,
      configured: true,
      provider: "dashscope",
      model: "qwen3.8-max",
      region: "beijing",
      governanceStatus: "blocked",
      governanceReasonCode: "decision_not_approved",
      governanceProtocolVersion: "sufeiya_release_decisions_v1",
      blockedDecisionIds: [
        "server_student_data_processing",
        "external_text_model_data_flow",
        "external_text_model_retention_deletion",
        "external_provider_region_cross_border",
        "external_text_model_abuse_budget",
        "external_text_model_semantic_citation_validation",
      ],
      blockedBindingIds: [],
    });
    assert.equal(JSON.stringify(status).includes("credential"), false);
    assert.equal(JSON.stringify(status).includes("dashscope.aliyuncs.com"), false);
  });

  it("rejects a Gateway candidate when the recorded supplier decision is DashScope/Qwen", () => {
    const gatewayEnvironment = {
      SUFEIYA_AI_ENABLED: "true",
      SUFEIYA_AI_PROVIDER: "gateway",
      SUFEIYA_AI_MODEL: "openai/not-approved-model",
      AI_GATEWAY_API_KEY: "gateway-test-key",
    };
    assert.equal(resolveTeacherModelConfiguration(gatewayEnvironment)?.provider, "gateway");
    assert.equal(resolveTeacherModelRuntime(gatewayEnvironment), null);
    const status = teacherModelReleaseStatus(gatewayEnvironment);
    assert.equal(status.governanceReasonCode, "binding_mismatch");
    assert.deepEqual(status.blockedBindingIds, [
      "external_text_model_supplier_selection.provider",
      "external_text_model_supplier_selection.model",
    ]);
  });

  it("rejects the Token Plan-only Qwen 3.8 preview from the application backend", () => {
    assert.equal(resolveTeacherModelConfiguration({
      SUFEIYA_AI_ENABLED: "true",
      SUFEIYA_AI_PROVIDER: "dashscope",
      SUFEIYA_AI_MODEL: "qwen3.8-max-preview",
      DASHSCOPE_API_KEY: "sk-valid-test-key-123456",
      DASHSCOPE_REGION: "singapore",
    }), null);
    assert.equal(resolveTeacherModelConfiguration({
      ...validEnvironment,
      DASHSCOPE_API_KEY: "sk-sp-token-plan-key-123456",
    }), null);
  });
});

describe("DashScope approved-ID selection handling", () => {
  it("parses one bounded provider candidate without granting network permission", async () => {
    const output = await parseDashScopeModelResponse(providerResponse(validCandidate), runtime.model);
    assert.deepEqual(output, validCandidate);
  });

  it("fails closed on provider errors, wrong models, truncation, and invalid schemas", async () => {
    const cases = [
      new Response("{}", { status: 403, headers: { "content-type": "application/json" } }),
      providerResponse(validCandidate, { model: "qwen3.7-max" }),
      providerResponse(validCandidate, { finishReason: "length" }),
      providerResponse({ ...validCandidate, extra: "not allowed" }),
      new Response("not-json", { headers: { "content-type": "text/plain" } }),
    ];
    for (const response of cases) {
      const output = await parseDashScopeModelResponse(response, runtime.model);
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
    const output = await parseDashScopeModelResponse(response, runtime.model);
    assert.equal(output, null);
  });

  it("rechecks governance immediately before dispatch and performs zero fetches when blocked", async () => {
    let fetchCalls = 0;
    const output = await invokeTeacherModel({
      runtime,
      system: "system",
      prompt: "prompt",
      fetchImpl: async () => {
        fetchCalls += 1;
        return providerResponse(validCandidate);
      },
    });
    assert.equal(output, null);
    assert.equal(fetchCalls, 0);
  });
});
