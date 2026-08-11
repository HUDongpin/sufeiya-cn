import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/governance/status/route";
import { RELEASE_SURFACES, releaseGovernanceSummary } from "../lib/release-governance";

describe("sanitized release-governance status route", () => {
  it("returns a no-store GET-only summary without evidence locators, owners, or secrets", async () => {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-sufeiya-governance-mode"), "read-only-no-mutations");
    assert.equal(response.headers.get("x-sufeiya-p0-protocol"), "sufeiya_p0_decision_log_v1");

    const body = await response.json() as Record<string, unknown> & {
      p0Gate: {
        protocolVersion: string;
        status: string;
        total: number;
        resolved: number;
        unresolved: number;
        defaultDisposition: string;
        formalGate0Pass: boolean;
        releaseAuthorization: string;
      };
      sourceGovernance: {
        protocolVersion: string;
        status: string;
        defaultDisposition: string;
        trackedRecords: number;
        gateAClaimSources: number;
        catalogLinkOnly: number;
        ragEligible: number;
        ragBlocked: number;
        blockedArchiveRecords: number;
        criteria: {
          teacherReviewed: number;
          ragRightsAllowed: number;
          examVersionCurrentOrNotApplicable: number;
          explicitRagAllowed: number;
          noBlockingSafetyFlags: number;
        };
      };
      surfaces: Record<string, { enabled: boolean; status: string; reasonCode: string }>;
    };
    assert.deepEqual(Object.keys(body).sort(), [
      "defaultDisposition",
      "mode",
      "p0Gate",
      "protocolVersion",
      "sourceGovernance",
      "surfaces",
    ]);
    assert.equal(body.protocolVersion, "sufeiya_release_decisions_v1");
    assert.equal(body.defaultDisposition, "deny");
    assert.equal(body.mode, "sanitized_read_only_status");
    assert.deepEqual(body.p0Gate, {
      protocolVersion: "sufeiya_p0_decision_log_v1",
      status: "blocked",
      total: 29,
      resolved: 0,
      unresolved: 29,
      defaultDisposition: "deny",
      formalGate0Pass: false,
      releaseAuthorization: "separate_explicit_controls_required",
    });
    assert.deepEqual(body.sourceGovernance, {
      protocolVersion: "sufeiya_content_governance_v1",
      status: "none_admitted",
      defaultDisposition: "deny",
      trackedRecords: 15,
      gateAClaimSources: 10,
      catalogLinkOnly: 5,
      ragEligible: 0,
      ragBlocked: 15,
      blockedArchiveRecords: 655,
      criteria: {
        teacherReviewed: 0,
        ragRightsAllowed: 0,
        examVersionCurrentOrNotApplicable: 10,
        explicitRagAllowed: 0,
        noBlockingSafetyFlags: 15,
      },
    });
    assert.deepEqual(Object.keys(body.surfaces), [...RELEASE_SURFACES]);
    assert.equal(body.surfaces.local_teaching_review_demo?.enabled, true);
    assert.equal(body.surfaces.sofia_external_text_model?.enabled, false);
    assert.equal(
      body.surfaces.sofia_external_text_model?.reasonCode,
      releaseGovernanceSummary().sofia_external_text_model.reasonCode,
    );
    for (const surface of Object.values(body.surfaces)) {
      assert.deepEqual(Object.keys(surface).sort(), ["enabled", "reasonCode", "status"]);
    }

    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "evidenceCatalog",
      "decisionOwner",
      "ownerRole",
      "backupOwnerRole",
      "decisionHistory",
      "defaultRecommendation",
      "operationalGuardrail",
      "relatedReleaseControlIds",
      "record_payload_sha256",
      "source_class",
      "claim_verification_status",
      "review_status",
      "reviewed_by_role",
      "rights_status",
      "exam_version_status",
      "safety_flags",
      "rag_eligibility",
      "effectiveAt",
      "nextRegisterReviewAt",
      "registerReviewStatus",
      "environmentPolicy",
      "blockedDecisionIds",
      "blockedBindingIds",
      "evidenceReferenceIds",
      "decisionBinding",
      "eventSha256",
      "ledgerContentSha256",
      "canonicalDefinitionSetSha256",
      "decisionRolePolicySha256",
      "ownerDecisionArtifactPolicy",
      "contentSha256",
      "locator",
      "p0_a01_product_promise_success_metric",
      "DASHSCOPE_API_KEY",
      "CLERK_SECRET_KEY",
      "sk-",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  });
});
