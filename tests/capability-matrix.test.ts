import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CAPABILITY_MATRIX,
  CAPABILITY_STATUSES,
  parseCapabilityMatrix,
  publicCapabilityMatrixSummary,
} from "../lib/capability-matrix";
import {
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
} from "../lib/release-governance";

describe("CapabilityMatrixV1", () => {
  it("parses one versioned, fail-closed matrix with complete governance fields", () => {
    const matrix = parseCapabilityMatrix(CAPABILITY_MATRIX);
    assert.equal(matrix.protocolVersion, "sufeiya_capability_matrix_v1");
    assert.equal(matrix.defaultDisposition, "unavailable_unless_done");
    assert.ok(matrix.capabilities.length >= 10);
    assert.equal(new Set(matrix.capabilities.map((item) => item.id)).size, matrix.capabilities.length);

    for (const capability of matrix.capabilities) {
      assert.ok(CAPABILITY_STATUSES.includes(capability.status));
      assert.ok(capability.owner, capability.id);
      assert.ok(capability.releaseGate, capability.id);
      if (capability.status === "done") {
        assert.equal(capability.reviewStatus, "accepted", capability.id);
        assert.ok(capability.reviewedAt && Date.parse(capability.reviewedAt), capability.id);
        assert.ok(capability.codeEvidence.length > 0, capability.id);
        assert.ok(capability.externalEvidence.length > 0, capability.id);
      } else if (capability.status === "not_started") {
        assert.equal(capability.reviewStatus, "pending", capability.id);
        assert.equal(capability.reviewedAt, null, capability.id);
        assert.deepEqual(capability.codeEvidence, [], capability.id);
        assert.deepEqual(capability.externalEvidence, [], capability.id);
      } else {
        assert.ok(capability.codeEvidence.length > 0, capability.id);
        if (capability.reviewStatus === "pending") assert.equal(capability.reviewedAt, null, capability.id);
      }
    }
  });

  it("keeps cloud sync, real teacher cases, remote Sofia, voice, and microphone blocked", () => {
    const status = Object.fromEntries(
      CAPABILITY_MATRIX.capabilities.map((capability) => [capability.id, capability.status]),
    );
    assert.equal(status.optional_account_sync, "intentionally_blocked");
    assert.equal(status.teacher_case_service, "intentionally_blocked");
    assert.equal(status.grounded_sofia_external_model, "intentionally_blocked");
    assert.equal(status.sofia_voice_output, "intentionally_blocked");
    assert.equal(status.sofia_microphone_input, "intentionally_blocked");
    assert.equal(status.continuous_reading_course, "not_started");
  });

  it("does not treat the unreleased Clerk-free public shell as accepted production", () => {
    const marketing = CAPABILITY_MATRIX.capabilities.find(
      (capability) => capability.id === "public_marketing_information",
    );
    assert.ok(marketing);
    assert.equal(marketing.status, "partial");
    assert.equal(marketing.reviewStatus, "pending");
    assert.equal(marketing.reviewedAt, null);
    assert.equal(marketing.releaseGate, "public_shell_exact_sha_owner_review");
    assert.match(marketing.publicSummary, /exact-SHA CI、Preview 与 Owner 接受/);
  });

  it("rejects unknown fields, duplicate IDs, and done claims with pending evidence", () => {
    assert.throws(() => parseCapabilityMatrix({ ...CAPABILITY_MATRIX, extra: true }));

    const duplicate = structuredClone(CAPABILITY_MATRIX);
    duplicate.capabilities.push(structuredClone(duplicate.capabilities[0]));
    assert.throws(() => parseCapabilityMatrix(duplicate), /duplicate capability/);

    const premature = structuredClone(CAPABILITY_MATRIX);
    const teacherCases = premature.capabilities.find((item) => item.id === "teacher_case_service");
    assert.ok(teacherCases);
    teacherCases.status = "done";
    assert.throws(() => parseCapabilityMatrix(premature), /missing accepted review or verified evidence/);

    const inventedProgress = structuredClone(CAPABILITY_MATRIX);
    const course = inventedProgress.capabilities.find((item) => item.id === "continuous_reading_course");
    assert.ok(course);
    course.codeEvidence.push("app/learn/reading/page.tsx");
    assert.throws(() => parseCapabilityMatrix(inventedProgress), /must not claim implementation or review evidence/);
  });

  it("publishes only the sanitized status view", () => {
    const summary = publicCapabilityMatrixSummary();
    assert.equal(summary.asOf, CAPABILITY_MATRIX.effectiveAt);
    for (const capability of summary.capabilities) {
      for (const forbidden of ["codeEvidence", "externalEvidence", "owner", "reviewedAt"]) {
        assert.equal(Object.hasOwn(capability, forbidden), false, `${capability.id}:${forbidden}`);
      }
    }
    const serialized = JSON.stringify(summary);
    assert.equal(serialized.includes("sk-"), false);
    assert.equal(serialized.includes("CLERK_SECRET_KEY"), false);
  });

  it("binds blocked future capabilities only to existing release controls or surfaces", () => {
    const gates = new Set([
      ...RELEASE_DECISION_REGISTER.controls.map((control) => control.id),
      ...RELEASE_SURFACES,
    ]);
    for (const capability of CAPABILITY_MATRIX.capabilities) {
      if (capability.status === "intentionally_blocked") {
        assert.equal(gates.has(capability.releaseGate), true, capability.id);
      }
    }
  });

  it("keeps Phase 2-4 and typed-learning implementation paths out of Phase 0A", () => {
    const forbiddenPrefixes = [
      "services/",
      "infra/",
      "app/teacher/",
      "lib/learning/",
      "lib/public-learning/reading-course-",
      "components/public-learning/reading-course-",
    ];
    for (const capability of CAPABILITY_MATRIX.capabilities) {
      for (const evidencePath of capability.codeEvidence) {
        assert.equal(
          forbiddenPrefixes.some((prefix) => evidencePath.startsWith(prefix)),
          false,
          `${capability.id}: ${evidencePath}`,
        );
      }
    }
  });

  it("resolves every declared code-evidence path in this exact checkout", async () => {
    for (const capability of CAPABILITY_MATRIX.capabilities) {
      for (const evidencePath of capability.codeEvidence) {
        await assert.doesNotReject(
          access(new URL(`../${evidencePath}`, import.meta.url)),
          `${capability.id}: ${evidencePath}`,
        );
      }
    }
  });

  it("keeps the Sofia public explanation aligned with the matrix claim", async () => {
    const source = await readFile(new URL("../components/sofia-public-access.tsx", import.meta.url), "utf8");
    const claim = CAPABILITY_MATRIX.capabilities.find((item) => item.id === "browser_local_sofia");
    assert.ok(claim);
    assert.ok(source.includes(claim.publicSummary));
  });

  it("does not call currently Vercel-hosted public capabilities vendor-free during migration", () => {
    for (const capabilityId of [
      "public_marketing_information",
      "public_reading_p0",
      "anonymous_local_data_controls",
      "browser_local_sofia",
      "public_legal_information",
    ]) {
      const capability = CAPABILITY_MATRIX.capabilities.find((item) => item.id === capabilityId);
      assert.ok(capability, capabilityId);
      assert.ok(
        capability.externalVendors.some((vendor) => vendor.includes("Vercel")),
        capabilityId,
      );
      assert.ok(
        capability.dataLocations.some((location) => location.includes("Vercel")),
        capabilityId,
      );
    }
  });
});
