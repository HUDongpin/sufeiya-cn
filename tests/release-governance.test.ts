import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
  evaluateReleaseSurface,
  parseReleaseDecisionRegister,
  releaseGovernanceSummary,
} from "../lib/release-governance";

describe("versioned release decision register", () => {
  it("parses the committed register and requires durable evidence for every approval", () => {
    const register = parseReleaseDecisionRegister(RELEASE_DECISION_REGISTER);
    assert.equal(register.protocolVersion, "sufeiya_release_decisions_v1");
    assert.equal(register.defaultDisposition, "deny");
    assert.equal(register.environmentPolicy, "one_register_for_local_preview_and_production");
    assert.equal(register.registerReviewStatus, "active_with_blockers");
    assert.ok(Date.parse(register.nextRegisterReviewAt) > Date.now());
    assert.equal(new Set(register.controls.map((control) => control.id)).size, register.controls.length);
    const planEvidence = register.evidenceCatalog.find((item) => item.id === "approved_plan_2026-08-09");
    assert.equal(planEvidence?.contentSha256, "6ad237bf7433134961c2b4f9de4cb0f055391b9179e6b4632c269cdd84809169");
    assert.equal(planEvidence?.verificationStatus, "verified_file_hash");

    for (const control of register.controls.filter((item) => item.status === "approved")) {
      assert.ok(control.decisionOwner, control.id);
      assert.ok(control.decidedAt, control.id);
      assert.ok(control.reviewDueAt, control.id);
      assert.equal(control.reviewStatus, "current", control.id);
      assert.ok(control.evidenceReferenceIds.length > 0, control.id);
      assert.ok(control.implementationImpact, control.id);
    }
  });

  it("approves only the local teaching-review demonstration surface", () => {
    const summary = releaseGovernanceSummary();
    assert.deepEqual(Object.keys(summary), [...RELEASE_SURFACES]);
    assert.equal(summary.local_teaching_review_demo.enabled, true);
    assert.equal(summary.local_teaching_review_demo.status, "approved");

    for (const surface of RELEASE_SURFACES.filter((item) => item !== "local_teaching_review_demo")) {
      assert.equal(summary[surface].enabled, false, surface);
      assert.equal(summary[surface].status, "blocked", surface);
      assert.ok(summary[surface].blockedControlIds.length > 0, surface);
    }
  });

  it("keeps supplier selections and subject authorization narrower than release approval", () => {
    const text = evaluateReleaseSurface("sofia_external_text_model", {
      provider: "dashscope",
      model: "qwen3.8-max",
      region: "beijing",
      dataMode: "approved_claim_id_ordering_minimized_context_no_history",
    });
    assert.equal(text.blockedControlIds.includes("external_text_model_supplier_selection"), false);
    assert.deepEqual(text.blockedBindingIds, []);
    assert.deepEqual(text.blockedControlIds, [
      "server_student_data_processing",
      "external_text_model_data_flow",
      "external_text_model_retention_deletion",
      "external_provider_region_cross_border",
      "external_text_model_abuse_budget",
      "external_text_model_semantic_citation_validation",
    ]);

    const voice = evaluateReleaseSurface("sofia_voice_output", {
      provider: "dashscope",
      model: "qwen3-tts-vc-realtime-2026-01-15",
      region: "beijing",
      dataMode: "voice_clone_output",
    });
    assert.equal(voice.blockedControlIds.includes("voice_authorization_assertion_received"), false);
    assert.equal(voice.blockedControlIds.includes("voice_written_authorization_verified"), true);
    assert.equal(voice.blockedControlIds.includes("voice_supplier_model_selection"), false);
    assert.equal(voice.blockedControlIds.includes("voice_data_flow"), true);
    assert.deepEqual(voice.blockedBindingIds, []);
  });

  it("binds the recorded supplier decision to exact provider and model context", () => {
    const gateway = evaluateReleaseSurface("sofia_external_text_model", {
      provider: "gateway",
      model: "openai/not-approved-model",
      region: null,
      dataMode: "approved_claim_id_ordering_minimized_context_no_history",
    });
    assert.equal(gateway.enabled, false);
    assert.equal(gateway.reasonCode, "binding_mismatch");
    assert.deepEqual(gateway.blockedBindingIds, [
      "external_text_model_supplier_selection.provider",
      "external_text_model_supplier_selection.model",
    ]);
  });

  it("deep-freezes the canonical register so in-process mutation cannot unlock a surface", () => {
    const before = evaluateReleaseSurface("sofia_external_text_model", {
      provider: "dashscope",
      model: "qwen3.8-max",
      region: "beijing",
      dataMode: "approved_claim_id_ordering_minimized_context_no_history",
    });
    assert.equal(Object.isFrozen(RELEASE_DECISION_REGISTER), true);
    assert.equal(Object.isFrozen(RELEASE_DECISION_REGISTER.controls), true);
    assert.equal(Object.isFrozen(RELEASE_DECISION_REGISTER.controls[0]), true);
    const pending = RELEASE_DECISION_REGISTER.controls.find(
      (control) => control.id === "external_text_model_data_flow",
    );
    assert.ok(pending);
    assert.throws(() => {
      pending.status = "approved";
    }, TypeError);
    const after = evaluateReleaseSurface("sofia_external_text_model", {
      provider: "dashscope",
      model: "qwen3.8-max",
      region: "beijing",
      dataMode: "approved_claim_id_ordering_minimized_context_no_history",
    });
    assert.deepEqual(after, before);
  });

  it("rejects permissive defaults, duplicate controls, dangling requirements, and evidence-free approvals", () => {
    assert.throws(
      () => parseReleaseDecisionRegister({ ...RELEASE_DECISION_REGISTER, defaultDisposition: "allow" }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        controls: [...RELEASE_DECISION_REGISTER.controls, RELEASE_DECISION_REGISTER.controls[0]],
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        controls: RELEASE_DECISION_REGISTER.controls.map((control) =>
          control.id === "external_text_model_data_flow"
            ? {
                ...control,
                status: "approved",
                reviewStatus: "current",
                decisionOwner: "project_owner",
                decidedAt: "2026-08-11T00:00:00+08:00",
                evidenceReferenceIds: ["approved_plan_2026-08-09"],
                implementationStatus: "implemented",
                bindings: null,
              }
            : control
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        surfaceRequirements: {
          ...RELEASE_DECISION_REGISTER.surfaceRequirements,
          real_community: [...RELEASE_DECISION_REGISTER.surfaceRequirements.real_community, "missing_control"],
        },
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        controls: RELEASE_DECISION_REGISTER.controls.map((control) =>
          control.id === "clerk_access_boundary"
            ? { ...control, evidenceReferenceIds: [] }
            : control
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        evidenceCatalog: RELEASE_DECISION_REGISTER.evidenceCatalog.map((evidence) =>
          evidence.id === "approved_plan_2026-08-09"
            ? { ...evidence, contentSha256: null }
            : evidence
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
  });

  it("rejects future-dated decisions, non-current evidence, and an assertion posing as verified authorization", () => {
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        effectiveAt: "2099-01-01T00:00:00+08:00",
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        controls: RELEASE_DECISION_REGISTER.controls.map((control) =>
          control.id === "clerk_access_boundary"
            ? { ...control, decidedAt: "2099-01-01T00:00:00+08:00", reviewDueAt: "2099-02-01T00:00:00+08:00" }
            : control
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        evidenceCatalog: RELEASE_DECISION_REGISTER.evidenceCatalog.map((evidence) =>
          evidence.id === "user_approval_2026-08-11_clerk"
            ? { ...evidence, verificationStatus: "revoked" }
            : evidence
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
    assert.throws(
      () => parseReleaseDecisionRegister({
        ...RELEASE_DECISION_REGISTER,
        controls: RELEASE_DECISION_REGISTER.controls.map((control) =>
          control.id === "voice_written_authorization_verified"
            ? {
                ...control,
                status: "approved",
                reviewStatus: "current",
                decisionOwner: "project_owner",
                decidedAt: "2026-08-11T00:00:00+08:00",
                reviewDueAt: "2026-09-11T23:59:59+08:00",
                evidenceReferenceIds: ["user_assertion_2026-08-10_voice_authorization"],
                implementationStatus: "implemented",
              }
            : control
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
  });
});
