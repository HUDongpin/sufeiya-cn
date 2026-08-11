import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BLOCKING_SAFETY_FLAGS,
  CONTENT_GOVERNANCE_PROTOCOL,
  contentGovernanceRecordSchema,
  evaluateRagAdmission,
  parseContentGovernanceRegister,
  type ContentGovernanceRecord,
  type RagAdmissionReasonCode,
} from "../lib/content-governance";
import {
  CONTENT_GOVERNANCE_REGISTER,
  sourceGovernanceSummary,
} from "../lib/super-teacher/sources";

const fullyAdmittedRecord = contentGovernanceRecordSchema.parse({
  id: "synthetic-reviewed-source-v1",
  register_section: "claim_source",
  record_payload_sha256: "a".repeat(64),
  source_class: "platform_direct",
  claim_verification_status: "independently_verified",
  review_status: "teacher_reviewed",
  reviewed_by_role: "teaching_owner",
  reviewed_at: "2026-08-11T09:00:00+08:00",
  rights_status: {
    link: "allowed",
    embed: "not_applicable",
    transcribe: "not_applicable",
    cache: "allowed",
    rag: "allowed",
    republish: "pending",
  },
  exam_version_status: "not_applicable",
  exam_version_reference: null,
  exam_version_verified_at: null,
  safety_flags: [],
  rag_eligibility: "allowed",
});

function candidateRegister(record = fullyAdmittedRecord) {
  return {
    protocolVersion: CONTENT_GOVERNANCE_PROTOCOL,
    effectiveAt: "2026-08-11T00:00:00+08:00",
    defaultDisposition: "deny",
    admissionContract: {
      required_review_status: "teacher_reviewed",
      required_rag_rights_status: "allowed",
      accepted_exam_version_statuses: ["current", "not_applicable"],
      required_rag_eligibility: "allowed",
      blocking_safety_flags: [...BLOCKING_SAFETY_FLAGS],
    },
    records: [record],
  };
}

describe("canonical content-governance register", () => {
  it("binds every current Sofia source and keeps runtime RAG admission at zero", () => {
    const register = parseContentGovernanceRegister(CONTENT_GOVERNANCE_REGISTER);
    assert.equal(register.protocolVersion, CONTENT_GOVERNANCE_PROTOCOL);
    assert.equal(register.defaultDisposition, "deny");
    assert.equal(register.records.length, 15);
    assert.equal(new Set(register.records.map((record) => record.id)).size, 15);
    assert.equal(register.records.filter((record) => record.register_section === "claim_source").length, 10);
    assert.equal(register.records.filter((record) => record.register_section === "link_only_resource").length, 5);
    assert.ok(register.records.every((record) => !evaluateRagAdmission(record).admitted));
    assert.ok(register.records.every((record) => record.rag_eligibility === "blocked"));

    assert.deepEqual(sourceGovernanceSummary(), {
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
  });

  it("deep-freezes the canonical register so in-process mutation cannot create RAG admission", () => {
    const before = sourceGovernanceSummary();
    const firstRecord = CONTENT_GOVERNANCE_REGISTER.records[0];
    assert.ok(firstRecord);
    assert.equal(Object.isFrozen(CONTENT_GOVERNANCE_REGISTER), true);
    assert.equal(Object.isFrozen(CONTENT_GOVERNANCE_REGISTER.admissionContract), true);
    assert.equal(Object.isFrozen(CONTENT_GOVERNANCE_REGISTER.records), true);
    assert.equal(Object.isFrozen(firstRecord), true);
    assert.equal(Object.isFrozen(firstRecord.rights_status), true);
    assert.equal(Object.isFrozen(firstRecord.safety_flags), true);
    assert.throws(() => {
      firstRecord.review_status = "teacher_reviewed";
    }, TypeError);
    assert.throws(() => {
      firstRecord.rights_status.rag = "allowed";
    }, TypeError);
    assert.throws(() => {
      firstRecord.rag_eligibility = "allowed";
    }, TypeError);
    assert.equal(Object.isFrozen(BLOCKING_SAFETY_FLAGS), true);
    assert.throws(() => {
      (BLOCKING_SAFETY_FLAGS as unknown as string[]).splice(0);
    }, TypeError);
    const safetyBlockedRecord: ContentGovernanceRecord = {
      ...fullyAdmittedRecord,
      safety_flags: ["minor"],
    };
    assert.equal(evaluateRagAdmission(safetyBlockedRecord).admitted, false);
    assert.deepEqual(evaluateRagAdmission(safetyBlockedRecord).reasonCodes, [
      "blocking_safety_flags_present",
    ]);
    assert.deepEqual(sourceGovernanceSummary(), before);
  });

  it("admits a source only when all five independent conditions pass", () => {
    assert.deepEqual(evaluateRagAdmission(fullyAdmittedRecord), {
      admitted: true,
      status: "allowed",
      reasonCodes: [],
    });

    const failures: Array<[ContentGovernanceRecord, RagAdmissionReasonCode]> = [
      [
        {
          ...fullyAdmittedRecord,
          review_status: "unreviewed" as const,
          reviewed_by_role: null,
          reviewed_at: null,
        },
        "review_not_teacher_reviewed",
      ],
      [
        {
          ...fullyAdmittedRecord,
          rights_status: { ...fullyAdmittedRecord.rights_status, rag: "pending" as const },
        },
        "rag_rights_not_allowed",
      ],
      [
        {
          ...fullyAdmittedRecord,
          exam_version_status: "pending_review" as const,
        },
        "exam_version_not_current_or_not_applicable",
      ],
      [
        {
          ...fullyAdmittedRecord,
          rag_eligibility: "candidate" as const,
        },
        "rag_eligibility_not_allowed",
      ],
      [
        {
          ...fullyAdmittedRecord,
          safety_flags: ["exam_integrity_review"],
        },
        "blocking_safety_flags_present",
      ],
    ];

    for (const [record, expectedReason] of failures) {
      const evaluation = evaluateRagAdmission(record);
      assert.equal(evaluation.admitted, false, expectedReason);
      assert.equal(evaluation.status, "blocked", expectedReason);
      assert.equal(evaluation.reasonCodes.includes(expectedReason), true, expectedReason);
    }
  });

  it("never admits link-only metadata without a separately reviewable claim-source payload", () => {
    const linkOnlyRecord: ContentGovernanceRecord = {
      ...fullyAdmittedRecord,
      id: "synthetic-link-only-source-v1",
      register_section: "link_only_resource",
    };
    assert.deepEqual(evaluateRagAdmission(linkOnlyRecord), {
      admitted: false,
      status: "blocked",
      reasonCodes: ["link_only_resource_not_rag_material"],
    });
    assert.equal(contentGovernanceRecordSchema.safeParse(linkOnlyRecord).success, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(linkOnlyRecord)),
      /Invalid Sufeiya content governance register/,
    );
  });

  it("rejects an explicit allow label that attempts to bypass another condition", () => {
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister({
        ...fullyAdmittedRecord,
        rights_status: { ...fullyAdmittedRecord.rights_status, rag: "pending" },
      })),
      /Invalid Sufeiya content governance register/,
    );
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister({
        ...fullyAdmittedRecord,
        safety_flags: ["exam_integrity_review"],
      })),
      /Invalid Sufeiya content governance register/,
    );
  });

  it("rejects protocol drift, duplicate records, incomplete rights, and forged review metadata", () => {
    assert.throws(
      () => parseContentGovernanceRegister({ ...candidateRegister(), defaultDisposition: "allow" }),
      /Invalid Sufeiya content governance register/,
    );
    assert.throws(
      () => parseContentGovernanceRegister({
        ...candidateRegister(),
        records: [fullyAdmittedRecord, fullyAdmittedRecord],
      }),
      /Invalid Sufeiya content governance register/,
    );
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      rights_status: { rag: "allowed" },
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      review_status: "unreviewed",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      unexpectedApproval: true,
    }).success, false);
    assert.throws(
      () => parseContentGovernanceRegister({ ...candidateRegister(), effectiveAt: "2999-01-01T00:00:00Z" }),
      /Invalid Sufeiya content governance register/,
    );
    assert.throws(
      () => parseContentGovernanceRegister({ ...candidateRegister(), effectiveAt: "2026-08-11" }),
      /Invalid Sufeiya content governance register/,
    );
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      reviewed_at: "2999-01-01T00:00:00Z",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      reviewed_at: "2026-02-30T00:00:00Z",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      exam_version_status: "current",
      exam_version_reference: "official-version-2999",
      exam_version_verified_at: "2999-01-01T00:00:00Z",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      exam_version_status: "expired",
      exam_version_reference: "official-version-2025",
      exam_version_verified_at: "2026-08-10T09:00:00+08:00",
    }).success, true);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      review_status: "superseded",
    }).success, true);
  });
});
