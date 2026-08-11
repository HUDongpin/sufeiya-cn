import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BLOCKING_SAFETY_FLAGS,
  CONTENT_EVIDENCE_REQUIRED_ROLE,
  CONTENT_GOVERNANCE_PROTOCOL,
  contentGovernanceEvidenceSchema,
  contentGovernanceRecordSchema,
  evaluateRagAdmission,
  parseContentGovernanceRegister,
  type ContentGovernanceEvidence,
  type ContentGovernanceEvidenceDecisionKind,
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
  catalog_coverage_status: "complete",
  full_text_transcription_status: "reviewable_text_ready",
  review_status: "teacher_reviewed",
  reviewed_by_role: "teaching_content_owner",
  reviewed_at: "2026-08-11T09:00:00+08:00",
  evidence_refs: {
    catalog_coverage: {
      evidence_id: "cgev_11111111-1111-4111-8111-111111111111",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
    full_text_transcription: {
      evidence_id: "cgev_22222222-2222-4222-8222-222222222222",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
    teacher_review: {
      evidence_id: "cgev_33333333-3333-4333-8333-333333333333",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
    rag_rights: {
      evidence_id: "cgev_44444444-4444-4444-8444-444444444444",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
    exam_version: {
      evidence_id: "cgev_55555555-5555-4555-8555-555555555555",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
    rag_eligibility: {
      evidence_id: "cgev_66666666-6666-4666-8666-666666666666",
      record_id: "synthetic-reviewed-source-v1",
      record_payload_sha256: "a".repeat(64),
    },
  },
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

const EVIDENCE_DECISION_KINDS: readonly ContentGovernanceEvidenceDecisionKind[] = [
  "catalog_coverage",
  "full_text_transcription",
  "teacher_review",
  "rag_rights",
  "exam_version",
  "rag_eligibility",
];

const evidenceVerifiedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const evidenceReviewDueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const fullyAdmittedEvidenceCatalog = EVIDENCE_DECISION_KINDS.map((decisionKind, index) => {
  const reference = fullyAdmittedRecord.evidence_refs[decisionKind];
  assert.ok(reference);
  return contentGovernanceEvidenceSchema.parse({
    evidence_id: reference.evidence_id,
    decision_kind: decisionKind,
    record_id: fullyAdmittedRecord.id,
    record_payload_sha256: fullyAdmittedRecord.record_payload_sha256,
    artifact_content_sha256: (index + 1).toString(16).repeat(64),
    verification_status: "verified_current",
    verified_by_role: CONTENT_EVIDENCE_REQUIRED_ROLE[decisionKind],
    verified_at: evidenceVerifiedAt,
    review_due_at: evidenceReviewDueAt,
  });
});

function rebindEvidenceRefs(recordId: string) {
  return Object.fromEntries(
    Object.entries(fullyAdmittedRecord.evidence_refs).map(([evidenceType, evidence]) => [
      evidenceType,
      evidence ? { ...evidence, record_id: recordId } : null,
    ]),
  );
}

function rebindEvidenceCatalog(
  recordId: string,
  payloadSha256 = fullyAdmittedRecord.record_payload_sha256,
): ContentGovernanceEvidence[] {
  return fullyAdmittedEvidenceCatalog.map((evidence) => ({
    ...evidence,
    record_id: recordId,
    record_payload_sha256: payloadSha256,
  }));
}

function candidateRegister(
  record = fullyAdmittedRecord,
  evidenceCatalog: readonly ContentGovernanceEvidence[] = fullyAdmittedEvidenceCatalog,
) {
  return {
    protocolVersion: CONTENT_GOVERNANCE_PROTOCOL,
    effectiveAt: "2026-08-11T00:00:00+08:00",
    defaultDisposition: "deny",
    admissionContract: {
      required_catalog_coverage_status: "complete",
      required_full_text_transcription_status: "reviewable_text_ready",
      required_review_status: "teacher_reviewed",
      required_reviewed_by_role: "teaching_content_owner",
      required_rag_rights_status: "allowed",
      accepted_exam_version_statuses: ["current", "not_applicable"],
      required_rag_eligibility: "allowed",
      required_bound_evidence: [
        "catalog_coverage",
        "full_text_transcription",
        "teacher_review",
        "rag_rights",
        "exam_version",
        "rag_eligibility",
      ],
      blocking_safety_flags: [...BLOCKING_SAFETY_FLAGS],
    },
    evidenceCatalog: evidenceCatalog.map((evidence) => ({ ...evidence })),
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
    assert.deepEqual(register.evidenceCatalog, []);
    assert.ok(register.records.every((record) =>
      !evaluateRagAdmission(record, register.evidenceCatalog).admitted,
    ));
    assert.ok(register.records.every((record) => record.rag_eligibility === "blocked"));
    assert.ok(register.records.every((record) => record.catalog_coverage_status === "unassessed"));
    assert.ok(register.records.every((record) => record.full_text_transcription_status === "not_started"));
    assert.ok(register.records.every((record) =>
      Object.values(record.evidence_refs).every((evidence) => evidence === null),
    ));

    assert.deepEqual(sourceGovernanceSummary(), {
      protocolVersion: "sufeiya_content_governance_v2",
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
    assert.equal(Object.isFrozen(CONTENT_GOVERNANCE_REGISTER.evidenceCatalog), true);
    assert.equal(Object.isFrozen(CONTENT_GOVERNANCE_REGISTER.records), true);
    assert.equal(Object.isFrozen(firstRecord), true);
    assert.equal(Object.isFrozen(firstRecord.evidence_refs), true);
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
    assert.equal(evaluateRagAdmission(safetyBlockedRecord, fullyAdmittedEvidenceCatalog).admitted, false);
    assert.deepEqual(evaluateRagAdmission(safetyBlockedRecord, fullyAdmittedEvidenceCatalog).reasonCodes, [
      "blocking_safety_flags_present",
    ]);
    assert.deepEqual(sourceGovernanceSummary(), before);
  });

  it("admits a source only when every structural, decision, and evidence gate passes", () => {
    assert.deepEqual(evaluateRagAdmission(fullyAdmittedRecord, fullyAdmittedEvidenceCatalog), {
      admitted: true,
      status: "allowed",
      reasonCodes: [],
    });
    const parsedRegister = parseContentGovernanceRegister(candidateRegister());
    assert.equal(
      evaluateRagAdmission(parsedRegister.records[0]!, parsedRegister.evidenceCatalog).admitted,
      true,
    );

    const failures: Array<[ContentGovernanceRecord, RagAdmissionReasonCode]> = [
      [
        {
          ...fullyAdmittedRecord,
          catalog_coverage_status: "unassessed" as const,
        },
        "catalog_coverage_not_complete",
      ],
      [
        {
          ...fullyAdmittedRecord,
          full_text_transcription_status: "not_started" as const,
        },
        "reviewable_full_text_not_ready",
      ],
      [
        {
          ...fullyAdmittedRecord,
          review_status: "unreviewed" as const,
          reviewed_by_role: null,
          reviewed_at: null,
          evidence_refs: { ...fullyAdmittedRecord.evidence_refs, teacher_review: null },
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
      const evaluation = evaluateRagAdmission(record, fullyAdmittedEvidenceCatalog);
      assert.equal(evaluation.admitted, false, expectedReason);
      assert.equal(evaluation.status, "blocked", expectedReason);
      assert.equal(evaluation.reasonCodes.includes(expectedReason), true, expectedReason);
    }

    const missingEvidenceCases: Array<[
      keyof ContentGovernanceRecord["evidence_refs"],
      RagAdmissionReasonCode,
    ]> = [
      ["catalog_coverage", "catalog_coverage_evidence_missing_or_unbound"],
      ["full_text_transcription", "full_text_evidence_missing_or_unbound"],
      ["teacher_review", "teacher_review_evidence_missing_or_unbound"],
      ["rag_rights", "rag_rights_evidence_missing_or_unbound"],
      ["exam_version", "exam_version_evidence_missing_or_unbound"],
      ["rag_eligibility", "rag_eligibility_evidence_missing_or_unbound"],
    ];

    for (const [evidenceType, expectedReason] of missingEvidenceCases) {
      const record = {
        ...fullyAdmittedRecord,
        evidence_refs: { ...fullyAdmittedRecord.evidence_refs, [evidenceType]: null },
      } as ContentGovernanceRecord;
      const evaluation = evaluateRagAdmission(record, fullyAdmittedEvidenceCatalog);
      assert.equal(evaluation.admitted, false, evidenceType);
      assert.equal(evaluation.reasonCodes.includes(expectedReason), true, evidenceType);
    }
  });

  it("requires every inline reference to resolve to one current, decision-specific catalog entry", () => {
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, []).admitted, false);
    const untypedEvaluator = evaluateRagAdmission as unknown as (
      record: ContentGovernanceRecord,
    ) => ReturnType<typeof evaluateRagAdmission>;
    assert.equal(untypedEvaluator(fullyAdmittedRecord).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, [])),
      /Invalid Sufeiya content governance register/,
    );

    const unknownReferenceRecord = {
      ...fullyAdmittedRecord,
      evidence_refs: {
        ...fullyAdmittedRecord.evidence_refs,
        catalog_coverage: {
          ...fullyAdmittedRecord.evidence_refs.catalog_coverage!,
          evidence_id: "cgev_77777777-7777-4777-8777-777777777777",
        },
      },
    } satisfies ContentGovernanceRecord;
    assert.equal(
      evaluateRagAdmission(unknownReferenceRecord, fullyAdmittedEvidenceCatalog).admitted,
      false,
    );
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(unknownReferenceRecord)),
      /Invalid Sufeiya content governance register/,
    );

    const swappedKindCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0
        ? {
            ...evidence,
            decision_kind: "full_text_transcription" as const,
            verified_by_role: CONTENT_EVIDENCE_REQUIRED_ROLE.full_text_transcription,
          }
        : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, swappedKindCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, swappedKindCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const wrongRecordCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0 ? { ...evidence, record_id: "different-source-v1" } : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, wrongRecordCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, wrongRecordCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const wrongPayloadCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0 ? { ...evidence, record_payload_sha256: "b".repeat(64) } : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, wrongPayloadCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, wrongPayloadCatalog)),
      /Invalid Sufeiya content governance register/,
    );
  });

  it("fails closed for pending, revoked, expired, future, malformed, or wrongly authorized evidence", () => {
    const pendingCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0 ? { ...evidence, verification_status: "pending_review" as const } : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, pendingCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, pendingCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const revokedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const revokedCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0
        ? { ...evidence, verification_status: "revoked" as const, revoked_at: revokedAt }
        : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, revokedCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, revokedCatalog)),
      /Invalid Sufeiya content governance register/,
    );
    assert.equal(contentGovernanceEvidenceSchema.safeParse({
      ...fullyAdmittedEvidenceCatalog[0]!,
      verification_status: "revoked",
    }).success, false);
    assert.equal(contentGovernanceEvidenceSchema.safeParse({
      ...fullyAdmittedEvidenceCatalog[0]!,
      revoked_at: revokedAt,
    }).success, false);
    assert.equal(contentGovernanceEvidenceSchema.safeParse({
      ...fullyAdmittedEvidenceCatalog[0]!,
      verification_status: "revoked",
      revoked_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }).success, false);

    const expiredCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0
        ? { ...evidence, review_due_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
        : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, expiredCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, expiredCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const futureVerifiedAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0
        ? {
            ...evidence,
            verified_at: futureVerifiedAt,
            review_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          }
        : evidence,
    ) as ContentGovernanceEvidence[];
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, futureCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, futureCatalog)),
      /Invalid Sufeiya content governance register/,
    );
    assert.equal(contentGovernanceEvidenceSchema.safeParse({
      ...fullyAdmittedEvidenceCatalog[0]!,
      verified_at: "2026-08-11",
    }).success, false);
    assert.equal(contentGovernanceEvidenceSchema.safeParse({
      ...fullyAdmittedEvidenceCatalog[0]!,
      review_due_at: evidenceVerifiedAt,
    }).success, false);

    const invalidHashCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0 ? { ...evidence, artifact_content_sha256: "not-a-sha256" } : evidence,
    ) as ContentGovernanceEvidence[];
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, invalidHashCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, invalidHashCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const wrongRoleCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 0 ? { ...evidence, verified_by_role: "teaching_content_owner" } : evidence,
    ) as ContentGovernanceEvidence[];
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, wrongRoleCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, wrongRoleCatalog)),
      /Invalid Sufeiya content governance register/,
    );
  });

  it("rejects evidence ID and artifact reuse and exposes no evidence locators", () => {
    const duplicateIdCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 1
        ? { ...evidence, evidence_id: fullyAdmittedEvidenceCatalog[0]!.evidence_id }
        : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, duplicateIdCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, duplicateIdCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    const reusedArtifactCatalog = fullyAdmittedEvidenceCatalog.map((evidence, index) =>
      index === 1
        ? { ...evidence, artifact_content_sha256: fullyAdmittedEvidenceCatalog[0]!.artifact_content_sha256 }
        : evidence,
    );
    assert.equal(evaluateRagAdmission(fullyAdmittedRecord, reusedArtifactCatalog).admitted, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(fullyAdmittedRecord, reusedArtifactCatalog)),
      /Invalid Sufeiya content governance register/,
    );

    assert.deepEqual(Object.keys(fullyAdmittedEvidenceCatalog[0]!).sort(), [
      "artifact_content_sha256",
      "decision_kind",
      "evidence_id",
      "record_id",
      "record_payload_sha256",
      "review_due_at",
      "verification_status",
      "verified_at",
      "verified_by_role",
    ]);
    for (const forbidden of ["locator", "path", "filename", "secret", "api_key", "owner_name"]) {
      assert.equal(JSON.stringify(fullyAdmittedEvidenceCatalog).includes(forbidden), false, forbidden);
    }
  });

  it("never admits link-only metadata without a separately reviewable claim-source payload", () => {
    const linkOnlyId = "synthetic-link-only-source-v1";
    const linkOnlyRecord: ContentGovernanceRecord = {
      ...fullyAdmittedRecord,
      id: linkOnlyId,
      register_section: "link_only_resource",
      evidence_refs: rebindEvidenceRefs(linkOnlyId) as ContentGovernanceRecord["evidence_refs"],
    };
    const linkOnlyEvidenceCatalog = rebindEvidenceCatalog(linkOnlyId);
    assert.deepEqual(evaluateRagAdmission(linkOnlyRecord, linkOnlyEvidenceCatalog), {
      admitted: false,
      status: "blocked",
      reasonCodes: ["link_only_resource_not_rag_material"],
    });
    assert.equal(contentGovernanceRecordSchema.safeParse(linkOnlyRecord).success, false);
    assert.throws(
      () => parseContentGovernanceRegister(candidateRegister(linkOnlyRecord, linkOnlyEvidenceCatalog)),
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
    for (const evidenceType of Object.keys(fullyAdmittedRecord.evidence_refs) as Array<
      keyof ContentGovernanceRecord["evidence_refs"]
    >) {
      assert.throws(
        () => parseContentGovernanceRegister(candidateRegister({
          ...fullyAdmittedRecord,
          evidence_refs: { ...fullyAdmittedRecord.evidence_refs, [evidenceType]: null },
        } as ContentGovernanceRecord)),
        /Invalid Sufeiya content governance register/,
        evidenceType,
      );
    }
  });

  it("rejects protocol drift, duplicate records, incomplete rights, and forged review metadata", () => {
    assert.throws(
      () => parseContentGovernanceRegister({
        ...candidateRegister(),
        protocolVersion: "sufeiya_content_governance_v1",
      }),
      /Invalid Sufeiya content governance register/,
    );
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
    const evidenceReplayRecord = {
      ...fullyAdmittedRecord,
      id: "synthetic-reviewed-source-v2",
      evidence_refs: rebindEvidenceRefs("synthetic-reviewed-source-v2"),
    };
    assert.equal(contentGovernanceRecordSchema.safeParse(evidenceReplayRecord).success, true);
    assert.throws(
      () => parseContentGovernanceRegister({
        ...candidateRegister(),
        records: [fullyAdmittedRecord, evidenceReplayRecord],
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
      reviewed_by_role: "teaching_owner",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      reviewed_by_role: "teacher",
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      evidence_refs: {
        ...fullyAdmittedRecord.evidence_refs,
        teacher_review: {
          ...fullyAdmittedRecord.evidence_refs.teacher_review!,
          record_id: "different-source-v1",
        },
      },
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      evidence_refs: {
        ...fullyAdmittedRecord.evidence_refs,
        teacher_review: {
          ...fullyAdmittedRecord.evidence_refs.teacher_review!,
          record_payload_sha256: "b".repeat(64),
        },
      },
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      evidence_refs: {
        ...fullyAdmittedRecord.evidence_refs,
        teacher_review: {
          evidence_id: "teacher-review-for-source",
          record_id: fullyAdmittedRecord.id,
        },
      },
    }).success, false);
    assert.equal(contentGovernanceRecordSchema.safeParse({
      ...fullyAdmittedRecord,
      evidence_refs: {
        ...fullyAdmittedRecord.evidence_refs,
        rag_rights: fullyAdmittedRecord.evidence_refs.teacher_review,
      },
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
