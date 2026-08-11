import { z } from "zod";

export const CONTENT_GOVERNANCE_PROTOCOL = "sufeiya_content_governance_v2" as const;

export const BLOCKING_SAFETY_FLAGS = Object.freeze([
  "exam_integrity_review",
  "minor",
  "scorecard",
  "chat_screenshot",
  "contact_or_health_risk",
] as const);

const sourceClassSchema = z.enum([
  "platform_direct",
  "official_external",
  "publisher_self_report",
  "student_report",
  "independent_external",
  "analysis_inference",
  "owner_confirmed_scope",
  "unverified_lead",
]);

const claimVerificationStatusSchema = z.enum([
  "directly_observed",
  "owner_confirmed",
  "self_report_only",
  "third_party_report_only",
  "corroborated",
  "independently_verified",
  "inference_labeled",
  "disputed",
  "unverified",
]);

const reviewStatusSchema = z.enum([
  "unreviewed",
  "auto_tagged",
  "teacher_reviewed",
  "superseded",
  "retired",
]);

const reviewedByRoleSchema = z.literal("teaching_content_owner");

const catalogCoverageStatusSchema = z.enum([
  "unassessed",
  "metadata_only",
  "partial",
  "complete",
  "conflict",
  "superseded",
]);

const fullTextTranscriptionStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "reviewable_text_ready",
  "incomplete",
  "blocked",
  "superseded",
]);

const rightsDecisionSchema = z.enum([
  "allowed",
  "denied",
  "pending",
  "not_applicable",
  "revoked",
]);

const rightsStatusSchema = z.object({
  link: rightsDecisionSchema,
  embed: rightsDecisionSchema,
  transcribe: rightsDecisionSchema,
  cache: rightsDecisionSchema,
  rag: rightsDecisionSchema,
  republish: rightsDecisionSchema,
}).strict();

const examVersionStatusSchema = z.enum([
  "not_applicable",
  "current",
  "expired",
  "conflict",
  "pending_review",
]);

const safetyFlagSchema = z.enum(BLOCKING_SAFETY_FLAGS);
const ragEligibilitySchema = z.enum(["blocked", "quarantined", "candidate", "allowed", "revoked"]);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const recordIdSchema = z.string().min(1).max(160);
const evidenceDecisionKindSchema = z.enum([
  "catalog_coverage",
  "full_text_transcription",
  "teacher_review",
  "rag_rights",
  "exam_version",
  "rag_eligibility",
]);
export type ContentGovernanceEvidenceDecisionKind = z.infer<typeof evidenceDecisionKindSchema>;

export const CONTENT_EVIDENCE_REQUIRED_ROLE = Object.freeze({
  catalog_coverage: "engineering_ai_owner",
  full_text_transcription: "teaching_content_owner",
  teacher_review: "teaching_content_owner",
  rag_rights: "legal_contract_owner",
  exam_version: "measurement_review_owner",
  rag_eligibility: "privacy_security_compliance_owner",
} as const satisfies Record<ContentGovernanceEvidenceDecisionKind, string>);

const evidenceVerifierRoleSchema = z.enum([
  "engineering_ai_owner",
  "teaching_content_owner",
  "legal_contract_owner",
  "measurement_review_owner",
  "privacy_security_compliance_owner",
]);
const opaqueEvidenceIdSchema = z.string().regex(
  /^cgev_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
const itemBoundEvidenceReferenceSchema = z.object({
  evidence_id: opaqueEvidenceIdSchema,
  record_id: recordIdSchema,
  record_payload_sha256: sha256Schema,
}).strict();
const evidenceReferencesSchema = z.object({
  catalog_coverage: itemBoundEvidenceReferenceSchema.nullable(),
  full_text_transcription: itemBoundEvidenceReferenceSchema.nullable(),
  teacher_review: itemBoundEvidenceReferenceSchema.nullable(),
  rag_rights: itemBoundEvidenceReferenceSchema.nullable(),
  exam_version: itemBoundEvidenceReferenceSchema.nullable(),
  rag_eligibility: itemBoundEvidenceReferenceSchema.nullable(),
}).strict();
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isStrictRfc3339(value: string): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) return false;
  if (zone !== "Z") {
    if (zone === "-00:00") return false;
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

const strictRfc3339TimestampSchema = z.string().refine(
  isStrictRfc3339,
  "expected a strict RFC 3339 timestamp with an explicit zone",
);

const isoTimestampSchema = strictRfc3339TimestampSchema.refine(
  (value) => Date.parse(value) <= Date.now() + MAX_FUTURE_CLOCK_SKEW_MS,
  "future-dated governance evidence is not allowed",
);

const nonFutureEvidenceTimestampSchema = strictRfc3339TimestampSchema.refine(
  (value) => Date.parse(value) <= Date.now(),
  "future-dated catalog evidence is not allowed",
);

export const contentGovernanceEvidenceSchema = z.object({
  evidence_id: opaqueEvidenceIdSchema,
  decision_kind: evidenceDecisionKindSchema,
  record_id: recordIdSchema,
  record_payload_sha256: sha256Schema,
  artifact_content_sha256: sha256Schema,
  verification_status: z.enum(["verified_current", "pending_review", "revoked"]),
  verified_by_role: evidenceVerifierRoleSchema,
  verified_at: nonFutureEvidenceTimestampSchema,
  review_due_at: strictRfc3339TimestampSchema,
  revoked_at: nonFutureEvidenceTimestampSchema.optional(),
}).strict().superRefine((evidence, context) => {
  const requiredRole = CONTENT_EVIDENCE_REQUIRED_ROLE[evidence.decision_kind];
  if (evidence.verified_by_role !== requiredRole) {
    context.addIssue({
      code: "custom",
      message: `evidence for ${evidence.decision_kind} requires ${requiredRole}`,
      path: ["verified_by_role"],
    });
  }

  const verifiedAt = Date.parse(evidence.verified_at);
  const reviewDueAt = Date.parse(evidence.review_due_at);
  if (reviewDueAt <= verifiedAt) {
    context.addIssue({
      code: "custom",
      message: "evidence review due time must follow verification time",
      path: ["review_due_at"],
    });
  }
  if (reviewDueAt <= Date.now()) {
    context.addIssue({
      code: "custom",
      message: "content-governance evidence review is expired",
      path: ["review_due_at"],
    });
  }

  if (evidence.verification_status === "revoked") {
    if (!evidence.revoked_at) {
      context.addIssue({
        code: "custom",
        message: "revoked evidence requires a revocation timestamp",
        path: ["revoked_at"],
      });
    } else if (Date.parse(evidence.revoked_at) < verifiedAt) {
      context.addIssue({
        code: "custom",
        message: "evidence cannot be revoked before it was verified",
        path: ["revoked_at"],
      });
    }
  } else if (evidence.revoked_at !== undefined) {
    context.addIssue({
      code: "custom",
      message: "non-revoked evidence cannot carry a revocation timestamp",
      path: ["revoked_at"],
    });
  }
});

export type ContentGovernanceEvidence = z.infer<typeof contentGovernanceEvidenceSchema>;

export const contentGovernanceRecordSchema = z.object({
  id: recordIdSchema,
  register_section: z.enum(["claim_source", "link_only_resource"]),
  record_payload_sha256: sha256Schema,
  source_class: sourceClassSchema,
  claim_verification_status: claimVerificationStatusSchema,
  catalog_coverage_status: catalogCoverageStatusSchema,
  full_text_transcription_status: fullTextTranscriptionStatusSchema,
  review_status: reviewStatusSchema,
  reviewed_by_role: reviewedByRoleSchema.nullable(),
  reviewed_at: isoTimestampSchema.nullable(),
  evidence_refs: evidenceReferencesSchema,
  rights_status: rightsStatusSchema,
  exam_version_status: examVersionStatusSchema,
  exam_version_reference: z.string().min(1).max(500).nullable(),
  exam_version_verified_at: isoTimestampSchema.nullable(),
  safety_flags: z.array(safetyFlagSchema).max(BLOCKING_SAFETY_FLAGS.length),
  rag_eligibility: ragEligibilitySchema,
}).strict().superRefine((record, context) => {
  const evidenceEntries = Object.entries(record.evidence_refs).filter(
    (entry): entry is [keyof typeof record.evidence_refs, NonNullable<(typeof record.evidence_refs)[keyof typeof record.evidence_refs]>] =>
      entry[1] !== null,
  );
  const evidenceIds = new Set<string>();
  for (const [evidenceType, evidence] of evidenceEntries) {
    if (evidence.record_id !== record.id) {
      context.addIssue({
        code: "custom",
        message: "governance evidence must be bound to the same content record",
        path: ["evidence_refs", evidenceType, "record_id"],
      });
    }
    if (evidence.record_payload_sha256 !== record.record_payload_sha256) {
      context.addIssue({
        code: "custom",
        message: "governance evidence must be bound to the same content payload",
        path: ["evidence_refs", evidenceType, "record_payload_sha256"],
      });
    }
    if (evidenceIds.has(evidence.evidence_id)) {
      context.addIssue({
        code: "custom",
        message: "one opaque evidence ID cannot satisfy multiple decisions",
        path: ["evidence_refs", evidenceType, "evidence_id"],
      });
    }
    evidenceIds.add(evidence.evidence_id);
  }

  if (new Set(record.safety_flags).size !== record.safety_flags.length) {
    context.addIssue({
      code: "custom",
      message: "duplicate safety flag",
      path: ["safety_flags"],
    });
  }

  if (
    record.review_status === "teacher_reviewed" &&
    (
      record.reviewed_by_role !== "teaching_content_owner" ||
      !record.reviewed_at ||
      !record.evidence_refs.teacher_review
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "teacher-reviewed content requires the canonical owner role, review time, and item-bound evidence",
      path: ["review_status"],
    });
  }

  if (
    Boolean(record.reviewed_by_role) !== Boolean(record.reviewed_at) ||
    Boolean(record.reviewed_by_role) !== Boolean(record.evidence_refs.teacher_review)
  ) {
    context.addIssue({
      code: "custom",
      message: "review role, review time, and teacher-review evidence must be recorded together",
      path: ["reviewed_by_role"],
    });
  }

  if (
    ["unreviewed", "auto_tagged"].includes(record.review_status) &&
    (record.reviewed_by_role || record.reviewed_at || record.evidence_refs.teacher_review)
  ) {
    context.addIssue({
      code: "custom",
      message: "unreviewed or auto-tagged content cannot carry teacher-review evidence",
      path: ["reviewed_by_role"],
    });
  }

  if (
    ["allowed", "denied", "revoked"].includes(record.rights_status.rag) &&
    !record.evidence_refs.rag_rights
  ) {
    context.addIssue({
      code: "custom",
      message: "a resolved RAG-rights decision requires item-bound evidence",
      path: ["evidence_refs", "rag_rights"],
    });
  }

  if (
    ["pending", "not_applicable"].includes(record.rights_status.rag) &&
    record.evidence_refs.rag_rights
  ) {
    context.addIssue({
      code: "custom",
      message: "pending or not-applicable RAG rights cannot carry resolved decision evidence",
      path: ["evidence_refs", "rag_rights"],
    });
  }

  if (
    ["current", "expired", "conflict"].includes(record.exam_version_status) &&
    (
      !record.exam_version_reference ||
      !record.exam_version_verified_at ||
      !record.evidence_refs.exam_version
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "resolved exam-version status requires a reference, verification time, and item-bound evidence",
      path: ["exam_version_status"],
    });
  }

  if (
    record.catalog_coverage_status === "complete" &&
    !record.evidence_refs.catalog_coverage
  ) {
    context.addIssue({
      code: "custom",
      message: "complete catalog coverage requires item-bound evidence",
      path: ["evidence_refs", "catalog_coverage"],
    });
  }

  if (
    record.full_text_transcription_status === "reviewable_text_ready" &&
    !record.evidence_refs.full_text_transcription
  ) {
    context.addIssue({
      code: "custom",
      message: "reviewable full text or transcription requires item-bound evidence",
      path: ["evidence_refs", "full_text_transcription"],
    });
  }

  if (
    ["allowed", "revoked"].includes(record.rag_eligibility) &&
    !record.evidence_refs.rag_eligibility
  ) {
    context.addIssue({
      code: "custom",
      message: "a resolved RAG-eligibility decision requires item-bound evidence",
      path: ["evidence_refs", "rag_eligibility"],
    });
  }

  if (
    record.exam_version_status === "not_applicable" &&
    (record.exam_version_reference || record.exam_version_verified_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "not-applicable exam-version status cannot carry a version reference or verification time",
      path: ["exam_version_reference"],
    });
  }

  if (
    record.exam_version_status === "pending_review" &&
    (
      record.exam_version_reference ||
      record.exam_version_verified_at ||
      record.evidence_refs.exam_version
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "pending exam-version status cannot carry resolved evidence",
      path: ["evidence_refs", "exam_version"],
    });
  }

  if (record.register_section === "link_only_resource" && record.rag_eligibility === "allowed") {
    context.addIssue({
      code: "custom",
      message: "link-only metadata cannot be admitted as RAG material",
      path: ["rag_eligibility"],
    });
  }
});

export type ContentGovernanceRecord = z.infer<typeof contentGovernanceRecordSchema>;

export const RAG_ADMISSION_REASON_CODES = Object.freeze([
  "link_only_resource_not_rag_material",
  "catalog_coverage_not_complete",
  "catalog_coverage_evidence_missing_or_unbound",
  "reviewable_full_text_not_ready",
  "full_text_evidence_missing_or_unbound",
  "review_not_teacher_reviewed",
  "teacher_review_evidence_missing_or_unbound",
  "rag_rights_not_allowed",
  "rag_rights_evidence_missing_or_unbound",
  "exam_version_not_current_or_not_applicable",
  "exam_version_evidence_missing_or_unbound",
  "rag_eligibility_not_allowed",
  "rag_eligibility_evidence_missing_or_unbound",
  "blocking_safety_flags_present",
] as const);

export type RagAdmissionReasonCode = (typeof RAG_ADMISSION_REASON_CODES)[number];

export type RagAdmissionEvaluation = {
  admitted: boolean;
  status: "allowed" | "blocked";
  reasonCodes: RagAdmissionReasonCode[];
};

function hasCurrentCatalogEvidence(
  record: ContentGovernanceRecord,
  evidenceType: ContentGovernanceEvidenceDecisionKind,
  evidenceCatalog: readonly ContentGovernanceEvidence[],
  now: number,
): boolean {
  const reference = record.evidence_refs[evidenceType];
  if (!reference) return false;

  const repeatedReferenceCount = Object.values(record.evidence_refs).filter(
    (candidate) => candidate?.evidence_id === reference.evidence_id,
  ).length;
  if (repeatedReferenceCount !== 1) return false;

  const matchingEvidence = evidenceCatalog.filter(
    (candidate) => candidate.evidence_id === reference.evidence_id,
  );
  if (matchingEvidence.length !== 1) return false;

  const parsed = contentGovernanceEvidenceSchema.safeParse(matchingEvidence[0]);
  if (!parsed.success) return false;
  const evidence = parsed.data;
  const repeatedArtifactCount = evidenceCatalog.filter(
    (candidate) => candidate.artifact_content_sha256 === evidence.artifact_content_sha256,
  ).length;

  return (
    repeatedArtifactCount === 1 &&
    evidence.decision_kind === evidenceType &&
    evidence.record_id === record.id &&
    evidence.record_payload_sha256 === record.record_payload_sha256 &&
    reference.record_id === evidence.record_id &&
    reference.record_payload_sha256 === evidence.record_payload_sha256 &&
    evidence.verification_status === "verified_current" &&
    evidence.verified_by_role === CONTENT_EVIDENCE_REQUIRED_ROLE[evidenceType] &&
    Date.parse(evidence.verified_at) <= now &&
    Date.parse(evidence.review_due_at) > Date.parse(evidence.verified_at) &&
    Date.parse(evidence.review_due_at) > now &&
    evidence.revoked_at === undefined
  );
}

export function evaluateRagAdmission(
  record: ContentGovernanceRecord,
  evidenceCatalog: readonly ContentGovernanceEvidence[],
): RagAdmissionEvaluation {
  const now = Date.now();
  const resolvedEvidenceCatalog = Array.isArray(evidenceCatalog) ? evidenceCatalog : [];
  const reasonCodes: RagAdmissionReasonCode[] = [];
  if (record.register_section !== "claim_source") {
    reasonCodes.push("link_only_resource_not_rag_material");
  }
  if (record.catalog_coverage_status !== "complete") {
    reasonCodes.push("catalog_coverage_not_complete");
  } else if (!hasCurrentCatalogEvidence(record, "catalog_coverage", resolvedEvidenceCatalog, now)) {
    reasonCodes.push("catalog_coverage_evidence_missing_or_unbound");
  }
  if (record.full_text_transcription_status !== "reviewable_text_ready") {
    reasonCodes.push("reviewable_full_text_not_ready");
  } else if (!hasCurrentCatalogEvidence(record, "full_text_transcription", resolvedEvidenceCatalog, now)) {
    reasonCodes.push("full_text_evidence_missing_or_unbound");
  }
  if (record.review_status !== "teacher_reviewed") {
    reasonCodes.push("review_not_teacher_reviewed");
  } else if (
    record.reviewed_by_role !== "teaching_content_owner" ||
    !record.reviewed_at ||
    !hasCurrentCatalogEvidence(record, "teacher_review", resolvedEvidenceCatalog, now)
  ) {
    reasonCodes.push("teacher_review_evidence_missing_or_unbound");
  }
  if (record.rights_status.rag !== "allowed") {
    reasonCodes.push("rag_rights_not_allowed");
  } else if (!hasCurrentCatalogEvidence(record, "rag_rights", resolvedEvidenceCatalog, now)) {
    reasonCodes.push("rag_rights_evidence_missing_or_unbound");
  }
  if (!["current", "not_applicable"].includes(record.exam_version_status)) {
    reasonCodes.push("exam_version_not_current_or_not_applicable");
  } else if (!hasCurrentCatalogEvidence(record, "exam_version", resolvedEvidenceCatalog, now)) {
    reasonCodes.push("exam_version_evidence_missing_or_unbound");
  }
  if (record.rag_eligibility !== "allowed") {
    reasonCodes.push("rag_eligibility_not_allowed");
  } else if (!hasCurrentCatalogEvidence(record, "rag_eligibility", resolvedEvidenceCatalog, now)) {
    reasonCodes.push("rag_eligibility_evidence_missing_or_unbound");
  }
  if (record.safety_flags.some((flag) => BLOCKING_SAFETY_FLAGS.includes(flag))) {
    reasonCodes.push("blocking_safety_flags_present");
  }
  return {
    admitted: reasonCodes.length === 0,
    status: reasonCodes.length === 0 ? "allowed" : "blocked",
    reasonCodes,
  };
}

const ragAdmissionContractSchema = z.object({
  required_catalog_coverage_status: z.literal("complete"),
  required_full_text_transcription_status: z.literal("reviewable_text_ready"),
  required_review_status: z.literal("teacher_reviewed"),
  required_reviewed_by_role: z.literal("teaching_content_owner"),
  required_rag_rights_status: z.literal("allowed"),
  accepted_exam_version_statuses: z.tuple([
    z.literal("current"),
    z.literal("not_applicable"),
  ]),
  required_rag_eligibility: z.literal("allowed"),
  required_bound_evidence: z.tuple([
    z.literal("catalog_coverage"),
    z.literal("full_text_transcription"),
    z.literal("teacher_review"),
    z.literal("rag_rights"),
    z.literal("exam_version"),
    z.literal("rag_eligibility"),
  ]),
  blocking_safety_flags: z.tuple([
    z.literal("exam_integrity_review"),
    z.literal("minor"),
    z.literal("scorecard"),
    z.literal("chat_screenshot"),
    z.literal("contact_or_health_risk"),
  ]),
}).strict();

export const contentGovernanceRegisterSchema = z.object({
  protocolVersion: z.literal(CONTENT_GOVERNANCE_PROTOCOL),
  effectiveAt: isoTimestampSchema,
  defaultDisposition: z.literal("deny"),
  admissionContract: ragAdmissionContractSchema,
  evidenceCatalog: z.array(contentGovernanceEvidenceSchema).max(10_000),
  records: z.array(contentGovernanceRecordSchema).min(1),
}).strict().superRefine((register, context) => {
  const now = Date.now();
  const recordsById = new Map<string, (typeof register.records)[number]>();
  register.records.forEach((record, index) => {
    if (recordsById.has(record.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate content-governance record: ${record.id}`,
        path: ["records", index, "id"],
      });
    }
    recordsById.set(record.id, record);
  });

  const evidenceById = new Map<string, (typeof register.evidenceCatalog)[number]>();
  const artifactDigests = new Set<string>();
  register.evidenceCatalog.forEach((evidence, index) => {
    if (evidenceById.has(evidence.evidence_id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate content-governance evidence: ${evidence.evidence_id}`,
        path: ["evidenceCatalog", index, "evidence_id"],
      });
    }
    evidenceById.set(evidence.evidence_id, evidence);

    if (artifactDigests.has(evidence.artifact_content_sha256)) {
      context.addIssue({
        code: "custom",
        message: `content-governance evidence artifact reused across decisions: ${evidence.evidence_id}`,
        path: ["evidenceCatalog", index, "artifact_content_sha256"],
      });
    }
    artifactDigests.add(evidence.artifact_content_sha256);

    const record = recordsById.get(evidence.record_id);
    if (!record) {
      context.addIssue({
        code: "custom",
        message: `content-governance evidence references an unknown record: ${evidence.evidence_id}`,
        path: ["evidenceCatalog", index, "record_id"],
      });
    } else if (record.record_payload_sha256 !== evidence.record_payload_sha256) {
      context.addIssue({
        code: "custom",
        message: `content-governance evidence is bound to the wrong payload: ${evidence.evidence_id}`,
        path: ["evidenceCatalog", index, "record_payload_sha256"],
      });
    }
  });

  const referencedEvidenceIds = new Set<string>();
  register.records.forEach((record, index) => {
    for (const [evidenceType, reference] of Object.entries(record.evidence_refs) as Array<[
      ContentGovernanceEvidenceDecisionKind,
      NonNullable<ContentGovernanceRecord["evidence_refs"][ContentGovernanceEvidenceDecisionKind]> | null,
    ]>) {
      if (!reference) continue;

      if (referencedEvidenceIds.has(reference.evidence_id)) {
        context.addIssue({
          code: "custom",
          message: `opaque governance evidence ID reused across record decisions: ${reference.evidence_id}`,
          path: ["records", index, "evidence_refs", evidenceType, "evidence_id"],
        });
      }
      referencedEvidenceIds.add(reference.evidence_id);

      const evidence = evidenceById.get(reference.evidence_id);
      const resolvesToCurrentEvidence = evidence &&
        evidence.decision_kind === evidenceType &&
        evidence.record_id === record.id &&
        evidence.record_payload_sha256 === record.record_payload_sha256 &&
        reference.record_id === evidence.record_id &&
        reference.record_payload_sha256 === evidence.record_payload_sha256 &&
        evidence.verification_status === "verified_current" &&
        evidence.verified_by_role === CONTENT_EVIDENCE_REQUIRED_ROLE[evidenceType] &&
        Date.parse(evidence.verified_at) <= now &&
        Date.parse(evidence.review_due_at) > Date.parse(evidence.verified_at) &&
        Date.parse(evidence.review_due_at) > now &&
        evidence.revoked_at === undefined;
      if (!resolvesToCurrentEvidence) {
        context.addIssue({
          code: "custom",
          message: `record decision references missing, mismatched, non-current, or expired evidence: ${reference.evidence_id}`,
          path: ["records", index, "evidence_refs", evidenceType],
        });
      }
    }

    if (
      record.rag_eligibility === "allowed" &&
      !evaluateRagAdmission(record, register.evidenceCatalog).admitted
    ) {
      context.addIssue({
        code: "custom",
        message: `RAG-allowed record fails the canonical admission contract: ${record.id}`,
        path: ["records", index, "rag_eligibility"],
      });
    }
  });
});

export type ContentGovernanceRegister = z.infer<typeof contentGovernanceRegisterSchema>;

export function parseContentGovernanceRegister(candidate: unknown): ContentGovernanceRegister {
  const parsed = contentGovernanceRegisterSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const issuePath = firstIssue?.path.length ? firstIssue.path.join(".") : "register";
    throw new Error(`Invalid Sufeiya content governance register at ${issuePath}`);
  }
  return parsed.data;
}
