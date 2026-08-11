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
    assert.equal(new Set(register.controls.map((control) => control.id)).size, register.controls.length);

    for (const control of register.controls.filter((item) => item.status === "approved")) {
      assert.ok(control.decisionOwner, control.id);
      assert.ok(control.decidedAt, control.id);
      assert.ok(control.evidenceReferences.length > 0, control.id);
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
    const text = evaluateReleaseSurface("sofia_external_text_model");
    assert.equal(text.blockedControlIds.includes("external_text_model_supplier_selection"), false);
    assert.deepEqual(text.blockedControlIds, [
      "external_text_model_data_flow",
      "external_text_model_retention_deletion",
      "external_provider_region_cross_border",
      "external_text_model_abuse_budget",
      "external_text_model_semantic_citation_validation",
    ]);

    const voice = evaluateReleaseSurface("sofia_voice_output");
    assert.equal(voice.blockedControlIds.includes("voice_subject_authorization"), false);
    assert.equal(voice.blockedControlIds.includes("voice_supplier_model_selection"), false);
    assert.equal(voice.blockedControlIds.includes("voice_data_flow"), true);
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
            ? { ...control, evidenceReferences: [] }
            : control
        ),
      }),
      /Invalid Sufeiya release decision register/,
    );
  });
});
