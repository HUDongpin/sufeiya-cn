import { z } from "zod";

export const CONTENT_GOVERNANCE_PROTOCOL = "sufeiya_content_governance_v1" as const;

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

const isoTimestampSchema = z.string().refine(
  isStrictRfc3339,
  "expected a strict RFC 3339 timestamp with an explicit zone",
).refine(
  (value) => Date.parse(value) <= Date.now() + MAX_FUTURE_CLOCK_SKEW_MS,
  "future-dated governance evidence is not allowed",
);

export const contentGovernanceRecordSchema = z.object({
  id: z.string().min(1).max(160),
  register_section: z.enum(["claim_source", "link_only_resource"]),
  record_payload_sha256: sha256Schema,
  source_class: sourceClassSchema,
  claim_verification_status: claimVerificationStatusSchema,
  review_status: reviewStatusSchema,
  reviewed_by_role: z.string().min(1).max(120).nullable(),
  reviewed_at: isoTimestampSchema.nullable(),
  rights_status: rightsStatusSchema,
  exam_version_status: examVersionStatusSchema,
  exam_version_reference: z.string().min(1).max(500).nullable(),
  exam_version_verified_at: isoTimestampSchema.nullable(),
  safety_flags: z.array(safetyFlagSchema).max(BLOCKING_SAFETY_FLAGS.length),
  rag_eligibility: ragEligibilitySchema,
}).strict().superRefine((record, context) => {
  if (new Set(record.safety_flags).size !== record.safety_flags.length) {
    context.addIssue({
      code: "custom",
      message: "duplicate safety flag",
      path: ["safety_flags"],
    });
  }

  if (
    record.review_status === "teacher_reviewed" &&
    (!record.reviewed_by_role || !record.reviewed_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "teacher-reviewed content requires reviewer role and review time",
      path: ["review_status"],
    });
  }

  if (Boolean(record.reviewed_by_role) !== Boolean(record.reviewed_at)) {
    context.addIssue({
      code: "custom",
      message: "review role and review time must be recorded together",
      path: ["reviewed_by_role"],
    });
  }

  if (
    ["unreviewed", "auto_tagged"].includes(record.review_status) &&
    (record.reviewed_by_role || record.reviewed_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "unreviewed or auto-tagged content cannot carry teacher-review evidence",
      path: ["reviewed_by_role"],
    });
  }

  if (
    ["current", "expired", "conflict"].includes(record.exam_version_status) &&
    (!record.exam_version_reference || !record.exam_version_verified_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "resolved exam-version status requires a reference and verification time",
      path: ["exam_version_status"],
    });
  }

  if (
    ["not_applicable", "pending_review"].includes(record.exam_version_status) &&
    (record.exam_version_reference || record.exam_version_verified_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "not-applicable or pending exam-version status cannot carry resolved evidence",
      path: ["exam_version_reference"],
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
  "review_not_teacher_reviewed",
  "rag_rights_not_allowed",
  "exam_version_not_current_or_not_applicable",
  "rag_eligibility_not_allowed",
  "blocking_safety_flags_present",
] as const);

export type RagAdmissionReasonCode = (typeof RAG_ADMISSION_REASON_CODES)[number];

export type RagAdmissionEvaluation = {
  admitted: boolean;
  status: "allowed" | "blocked";
  reasonCodes: RagAdmissionReasonCode[];
};

export function evaluateRagAdmission(record: ContentGovernanceRecord): RagAdmissionEvaluation {
  const reasonCodes: RagAdmissionReasonCode[] = [];
  if (record.register_section !== "claim_source") {
    reasonCodes.push("link_only_resource_not_rag_material");
  }
  if (record.review_status !== "teacher_reviewed") {
    reasonCodes.push("review_not_teacher_reviewed");
  }
  if (record.rights_status.rag !== "allowed") {
    reasonCodes.push("rag_rights_not_allowed");
  }
  if (!["current", "not_applicable"].includes(record.exam_version_status)) {
    reasonCodes.push("exam_version_not_current_or_not_applicable");
  }
  if (record.rag_eligibility !== "allowed") {
    reasonCodes.push("rag_eligibility_not_allowed");
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
  required_review_status: z.literal("teacher_reviewed"),
  required_rag_rights_status: z.literal("allowed"),
  accepted_exam_version_statuses: z.tuple([
    z.literal("current"),
    z.literal("not_applicable"),
  ]),
  required_rag_eligibility: z.literal("allowed"),
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
  records: z.array(contentGovernanceRecordSchema).min(1),
}).strict().superRefine((register, context) => {
  const ids = new Set<string>();
  register.records.forEach((record, index) => {
    if (ids.has(record.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate content-governance record: ${record.id}`,
        path: ["records", index, "id"],
      });
    }
    ids.add(record.id);

    if (record.rag_eligibility === "allowed" && !evaluateRagAdmission(record).admitted) {
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
