import { createHash } from "node:crypto";

import { z } from "zod";

import p0DecisionLogJson from "@/data/p0-decision-log.v1.json";
import p0PublishedBaselineJson from "@/data/p0-decision-log-published-baseline.v1.json";
import {
  APPROVED_PLAN_SHA256,
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
} from "@/lib/release-governance";

export const P0_DECISION_PROTOCOL = "sufeiya_p0_decision_log_v1" as const;
export const P0_PUBLISHED_BASELINE_PROTOCOL = "sufeiya_p0_published_baseline_v1" as const;
export const P0_AUTHORITY_POLICY = "decision_log_never_authorizes_release_surfaces" as const;
export const P0_RELEASE_AUTHORIZATION = "separate_explicit_controls_required" as const;
export const P0_CANONICAL_DEFINITION_SET_SHA256 = "aa8541908240f7ed44abf20b25ddf8a2d917f13f94d103f50288323f541c8bfd";
export const P0_REQUIRED_DECISION_ROLE_POLICY_SHA256 = "a058cac9e9abd6e6615fa3bcae4f3cdaa3367c2e68532073bedb2eeb925ea1f6";
export const P0_CURRENT_LEDGER_SHA256 = "0cbccd9dd8c7d149dd2d2d7a23b219d1bd8ca19d200d73ade2e50b1038c1886f";
export const P0_CURRENT_PUBLISHED_BASELINE_SHA256 = "92eb7712ec9e310cc1cf1dc0f76a28cb89195a6585e99d699b7a593bf06a9616";

const canonicalItems = [
  { id: "p0_a01_product_promise_success_metric", order: 1, section: "A", question: "一句话承诺与第一成功指标", sourcePages: [17] },
  { id: "p0_a02_det_score_display", order: 2, section: "A", question: "MVP 是否显示 DET 10-160 估分", sourcePages: [17] },
  { id: "p0_a03_launch_user_cohort", order: 3, section: "A", question: "首发用户与打卡营范围", sourcePages: [17] },
  { id: "p0_a04_brand_scale_claims", order: 4, section: "A", question: "品牌规模与效果数字", sourcePages: [17] },
  { id: "p0_b01_teacher_persona_boundary", order: 5, section: "B", question: "智能老师可模仿的边界", sourcePages: [17] },
  { id: "p0_b02_voice_digital_human", order: 6, section: "B", question: "声音/数字人", sourcePages: [17] },
  { id: "p0_b03_content_transcript_rag_rights", order: 7, section: "B", question: "视频、帖子、转写与 RAG", sourcePages: [17] },
  { id: "p0_b04_exam_integrity_quarantine", order: 8, section: "B", question: "真题/机经与隔离", sourcePages: [17] },
  { id: "p0_b05_student_case_rights", order: 9, section: "B", question: "学生评论/案例（部分已确认）", sourcePages: [17] },
  { id: "p0_b06_existing_custom_ai_audit", order: 10, section: "B", question: "现有定制 AI", sourcePages: [17] },
  { id: "p0_c01_diagnostic_scope_item_approval", order: 11, section: "C", question: "诊断时长、题型和素材审批", sourcePages: [17, 18] },
  { id: "p0_c02_rubric_insufficient_evidence", order: 12, section: "C", question: "量表与不给结论的条件", sourcePages: [18] },
  { id: "p0_c03_recommendation_count_sources", order: 13, section: "C", question: "一次报告的推荐数", sourcePages: [18] },
  { id: "p0_c04_certified_scores_research", order: 14, section: "C", question: "认证成绩与研究", sourcePages: [18] },
  { id: "p0_d01_peer_mentor_qualification", order: 15, section: "D", question: "上岸学员认证与权限", sourcePages: [18] },
  { id: "p0_d02_visibility_direct_messages", order: 16, section: "D", question: "默认可见范围与私信", sourcePages: [18] },
  { id: "p0_d03_moderation_reporting_escalation", order: 17, section: "D", question: "审核、举报、转介", sourcePages: [18] },
  { id: "p0_d04_incentive_policy", order: 18, section: "D", question: "奖学金/激励", sourcePages: [18] },
  { id: "p0_d05_disqualification_exceptions_exit", order: 19, section: "D", question: "取消资格、例外与退出", sourcePages: [18] },
  { id: "p0_d06_mentor_conflicts_review", order: 20, section: "D", question: "导师冲突与复审", sourcePages: [18] },
  { id: "p0_e01_runtime_web_access", order: 21, section: "E", question: "运行时是否自由上网", sourcePages: [18] },
  { id: "p0_e02_source_priority_unknown_handling", order: 22, section: "E", question: "来源优先级与无资料处理", sourcePages: [18] },
  { id: "p0_e03_memory_exam_request_boundary", order: 23, section: "E", question: "长期人格与考试中请求", sourcePages: [18] },
  { id: "p0_e04_human_escalation_capacity", order: 24, section: "E", question: "人工转介值班与容量", sourcePages: [18] },
  { id: "p0_f01_legal_entity_deployment_suppliers", order: 25, section: "F", question: "主办主体、部署与供应商", sourcePages: [18] },
  { id: "p0_f02_audio_chat_training_retention", order: 26, section: "F", question: "音频、聊天与模型训练", sourcePages: [18, 19] },
  { id: "p0_f03_minors_policy", order: 27, section: "F", question: "未成年人", sourcePages: [19] },
  { id: "p0_f04_gate_a_gate_b_scoring_scope", order: 28, section: "F", question: "Gate A / Gate B 与参考评分", sourcePages: [19] },
  { id: "p0_f05_serious_failure_shutdown", order: 29, section: "F", question: "严重失败的停机规则", sourcePages: [19] },
] as const;

export const P0_DECISION_IDS = Object.freeze(canonicalItems.map((item) => item.id));
export const P0_OWNER_ROLES = [
  "project_owner",
  "product_research_owner",
  "teaching_content_owner",
  "measurement_review_owner",
  "engineering_ai_owner",
  "community_operations_owner",
  "privacy_security_compliance_owner",
  "safety_operations_owner",
  "legal_contract_owner",
] as const;

type P0OwnerRole = (typeof P0_OWNER_ROLES)[number];
type P0CanonicalId = (typeof canonicalItems)[number]["id"];

export const P0_REQUIRED_DECISION_ROLES: Readonly<Record<P0CanonicalId, readonly P0OwnerRole[]>> =
  deepFreeze({
    p0_a01_product_promise_success_metric: ["project_owner", "product_research_owner"],
    p0_a02_det_score_display: ["project_owner", "measurement_review_owner"],
    p0_a03_launch_user_cohort: ["project_owner", "community_operations_owner"],
    p0_a04_brand_scale_claims: ["project_owner", "product_research_owner"],
    p0_b01_teacher_persona_boundary: ["project_owner", "teaching_content_owner"],
    p0_b02_voice_digital_human: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
      "legal_contract_owner",
    ],
    p0_b03_content_transcript_rag_rights: [
      "project_owner",
      "teaching_content_owner",
      "privacy_security_compliance_owner",
      "legal_contract_owner",
    ],
    p0_b04_exam_integrity_quarantine: [
      "project_owner",
      "teaching_content_owner",
      "privacy_security_compliance_owner",
    ],
    p0_b05_student_case_rights: [
      "project_owner",
      "privacy_security_compliance_owner",
      "legal_contract_owner",
    ],
    p0_b06_existing_custom_ai_audit: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
    ],
    p0_c01_diagnostic_scope_item_approval: [
      "project_owner",
      "teaching_content_owner",
      "measurement_review_owner",
    ],
    p0_c02_rubric_insufficient_evidence: [
      "project_owner",
      "teaching_content_owner",
      "measurement_review_owner",
    ],
    p0_c03_recommendation_count_sources: ["project_owner", "teaching_content_owner"],
    p0_c04_certified_scores_research: [
      "project_owner",
      "measurement_review_owner",
      "privacy_security_compliance_owner",
    ],
    p0_d01_peer_mentor_qualification: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_d02_visibility_direct_messages: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_d03_moderation_reporting_escalation: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_d04_incentive_policy: [
      "project_owner",
      "community_operations_owner",
      "legal_contract_owner",
    ],
    p0_d05_disqualification_exceptions_exit: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_d06_mentor_conflicts_review: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_e01_runtime_web_access: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
    ],
    p0_e02_source_priority_unknown_handling: [
      "project_owner",
      "teaching_content_owner",
      "engineering_ai_owner",
    ],
    p0_e03_memory_exam_request_boundary: [
      "project_owner",
      "privacy_security_compliance_owner",
      "safety_operations_owner",
    ],
    p0_e04_human_escalation_capacity: [
      "project_owner",
      "community_operations_owner",
      "safety_operations_owner",
    ],
    p0_f01_legal_entity_deployment_suppliers: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
      "legal_contract_owner",
    ],
    p0_f02_audio_chat_training_retention: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
      "legal_contract_owner",
    ],
    p0_f03_minors_policy: [
      "project_owner",
      "privacy_security_compliance_owner",
      "safety_operations_owner",
      "legal_contract_owner",
    ],
    p0_f04_gate_a_gate_b_scoring_scope: [
      "project_owner",
      "product_research_owner",
      "measurement_review_owner",
      "privacy_security_compliance_owner",
    ],
    p0_f05_serious_failure_shutdown: [
      "project_owner",
      "engineering_ai_owner",
      "privacy_security_compliance_owner",
      "safety_operations_owner",
    ],
  });

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

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

const isoTimestampSchema = z.string().refine(isStrictRfc3339, "expected a strict RFC 3339 timestamp with an explicit zone");
const p0IdSchema = z.string().regex(/^p0_[a-f][0-9]{2}_[a-z0-9_]{3,64}$/);
const evidenceIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{2,119}$/);
const roleIdSchema = z.enum(P0_OWNER_ROLES);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const releaseControlIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,79}$/);
const releaseSurfaceSchema = z.enum(RELEASE_SURFACES);
const p0DecisionOutcomeSchema = z.enum(["adopted", "rejected", "deferred", "revoked"]);
const p0DecisionIdSchema = z.string().regex(/^p0_[a-f][0-9]{2}_[a-z0-9_]{3,64}__d[0-9]{4}$/);
const p0DecisionBindingSchema = z.object({
  itemId: p0IdSchema,
  decisionId: p0DecisionIdSchema,
  outcome: p0DecisionOutcomeSchema,
  decisionEventSha256: sha256Schema,
}).strict();

const p0EvidenceSchema = z.object({
  id: evidenceIdSchema,
  kind: z.enum([
    "owner_decision",
    "authorization",
    "contract",
    "content_rights_review",
    "measurement_review",
    "operations_review",
    "privacy_security_review",
    "technical_review",
    "test_receipt",
  ]),
  verificationStatus: z.enum(["verified_current", "pending_review", "revoked"]),
  reviewedAt: isoTimestampSchema,
  reviewedByRole: roleIdSchema,
  contentSha256: sha256Schema,
  decisionBinding: p0DecisionBindingSchema.nullable(),
}).strict();

const p0DecisionEventSchema = z.object({
  id: p0DecisionIdSchema,
  outcome: p0DecisionOutcomeSchema,
  decisionSummary: z.string().min(1).max(800),
  ownerRole: roleIdSchema,
  backupOwnerRole: roleIdSchema,
  decidedAt: isoTimestampSchema,
  evidenceReferenceIds: z.array(evidenceIdSchema).min(1).max(12),
  implementationImpact: z.string().min(1).max(800),
  implementationDueAt: isoTimestampSchema.nullable(),
  reviewCondition: z.string().min(1).max(800),
  reviewDueAt: isoTimestampSchema,
  permittedImpactSurfaceIds: z.array(releaseSurfaceSchema).max(RELEASE_SURFACES.length),
  supersedesDecisionId: z.string().min(1).max(120).nullable(),
  previousDecisionSha256: sha256Schema.nullable(),
  eventSha256: sha256Schema,
}).strict();

const p0ItemSchema = z.object({
  id: p0IdSchema,
  order: z.number().int().min(1).max(29),
  section: z.enum(["A", "B", "C", "D", "E", "F"]),
  question: z.string().min(1).max(120),
  operationalGuardrail: z.string().min(1).max(1200),
  sourcePages: z.array(z.number().int().min(17).max(19)).min(1).max(3),
  definitionSha256: sha256Schema,
  decisionDueAt: isoTimestampSchema.nullable(),
  relatedReleaseControlIds: z.array(releaseControlIdSchema).max(12),
  decisionHistory: z.array(p0DecisionEventSchema).max(20),
}).strict();

type P0ItemDefinitionInput = Pick<
  z.input<typeof p0ItemSchema>,
  "id" | "order" | "section" | "question" | "operationalGuardrail" | "sourcePages" | "relatedReleaseControlIds"
>;

export function computeP0ItemDefinitionSha256(item: P0ItemDefinitionInput): string {
  return canonicalSha256({
    id: item.id,
    order: item.order,
    section: item.section,
    question: item.question,
    operationalGuardrail: item.operationalGuardrail,
    sourcePages: item.sourcePages,
    relatedReleaseControlIds: item.relatedReleaseControlIds,
  });
}

export function computeP0DefinitionSetSha256(items: readonly P0ItemDefinitionInput[]): string {
  return canonicalSha256(items.map((item) => computeP0ItemDefinitionSha256(item)));
}

export function computeP0DecisionEventSha256(
  itemDefinitionSha256: string,
  event: z.input<typeof p0DecisionEventSchema>,
): string {
  const eventWithoutDigest: Record<string, unknown> = { ...event };
  delete eventWithoutDigest.eventSha256;
  return canonicalSha256({ itemDefinitionSha256, ...eventWithoutDigest });
}

export function computeP0DecisionLogContentSha256(candidate: Record<string, unknown>): string {
  const ledgerWithoutDigest = { ...candidate };
  delete ledgerWithoutDigest.ledgerContentSha256;
  return canonicalSha256(ledgerWithoutDigest);
}

function computeP0EvidenceFingerprint(evidence: z.input<typeof p0EvidenceSchema>): string {
  return canonicalSha256(evidence);
}

export const p0DecisionLogSchema = z.object({
  protocolVersion: z.literal(P0_DECISION_PROTOCOL),
  ledgerRevision: z.number().int().min(1),
  previousLedgerSha256: sha256Schema.nullable(),
  ledgerContentSha256: sha256Schema,
  effectiveAt: isoTimestampSchema,
  nextRegisterReviewAt: isoTimestampSchema,
  registerStatus: z.enum(["open_with_unresolved_p0", "decision_complete", "due", "superseded", "revoked"]),
  defaultDisposition: z.literal("deny"),
  authorityPolicy: z.literal(P0_AUTHORITY_POLICY),
  guardrailTextPolicy: z.literal("conservative_source_paraphrase_never_a_meeting_outcome"),
  evidenceLocatorPolicy: z.literal("opaque_ids_only_no_locators_in_repository"),
  ownerDecisionArtifactPolicy: z.literal("unique_artifact_per_item_role_event_until_signed_batch_manifest_v1"),
  historyPolicy: z.literal("hash_chained_events_with_published_baseline"),
  amendmentPolicy: z.string().min(1).max(800),
  canonicalDefinitionSetSha256: sha256Schema,
  decisionRolePolicySha256: sha256Schema,
  sourcePlan: z.object({
    evidenceReferenceId: z.literal("approved_plan_2026-08-09"),
    contentSha256: z.literal(APPROVED_PLAN_SHA256),
    appendixId: z.literal("A"),
    pages: z.tuple([z.literal(17), z.literal(18), z.literal(19)]),
    expectedItemCount: z.literal(29),
  }).strict(),
  evidenceCatalog: z.array(p0EvidenceSchema).max(200),
  items: z.array(p0ItemSchema).length(29),
}).strict().superRefine((log, context) => {
  const now = Date.now();
  const effectiveAt = Date.parse(log.effectiveAt);
  if ((log.ledgerRevision === 1 && log.previousLedgerSha256 !== null) ||
      (log.ledgerRevision > 1 && log.previousLedgerSha256 === null)) {
    context.addIssue({ code: "custom", message: "P0 ledger revision has an invalid predecessor link", path: ["previousLedgerSha256"] });
  }
  if (computeP0DecisionLogContentSha256(log as unknown as Record<string, unknown>) !== log.ledgerContentSha256) {
    context.addIssue({ code: "custom", message: "P0 ledger content digest mismatch", path: ["ledgerContentSha256"] });
  }
  if (
    log.canonicalDefinitionSetSha256 !== P0_CANONICAL_DEFINITION_SET_SHA256 ||
    computeP0DefinitionSetSha256(log.items) !== P0_CANONICAL_DEFINITION_SET_SHA256
  ) {
    context.addIssue({ code: "custom", message: "P0 canonical definition set digest mismatch", path: ["canonicalDefinitionSetSha256"] });
  }
  if (
    log.decisionRolePolicySha256 !== P0_REQUIRED_DECISION_ROLE_POLICY_SHA256 ||
    canonicalSha256(P0_REQUIRED_DECISION_ROLES) !== P0_REQUIRED_DECISION_ROLE_POLICY_SHA256
  ) {
    context.addIssue({ code: "custom", message: "P0 decision-role policy digest mismatch", path: ["decisionRolePolicySha256"] });
  }
  if (effectiveAt > now) {
    context.addIssue({ code: "custom", message: "P0 register effective time is in the future", path: ["effectiveAt"] });
  }
  if (Date.parse(log.nextRegisterReviewAt) <= effectiveAt) {
    context.addIssue({ code: "custom", message: "P0 register review must follow its effective time", path: ["nextRegisterReviewAt"] });
  }

  const evidenceCatalog = new Map<string, (typeof log.evidenceCatalog)[number]>();
  const ownerDecisionArtifactHashes = new Set<string>();
  log.evidenceCatalog.forEach((evidence, index) => {
    if (evidenceCatalog.has(evidence.id)) {
      context.addIssue({ code: "custom", message: `duplicate P0 evidence: ${evidence.id}`, path: ["evidenceCatalog", index, "id"] });
    }
    evidenceCatalog.set(evidence.id, evidence);
    if (Date.parse(evidence.reviewedAt) > now) {
      context.addIssue({ code: "custom", message: `future-dated P0 evidence: ${evidence.id}`, path: ["evidenceCatalog", index, "reviewedAt"] });
    }
    if (evidence.kind === "owner_decision" && evidence.decisionBinding === null) {
      context.addIssue({ code: "custom", message: `owner-decision evidence is not bound to one P0 event: ${evidence.id}`, path: ["evidenceCatalog", index, "decisionBinding"] });
    }
    if (evidence.kind === "owner_decision") {
      if (ownerDecisionArtifactHashes.has(evidence.contentSha256)) {
        context.addIssue({ code: "custom", message: `owner-decision artifact reuse is forbidden without a signed batch manifest: ${evidence.id}`, path: ["evidenceCatalog", index, "contentSha256"] });
      }
      ownerDecisionArtifactHashes.add(evidence.contentSha256);
    }
  });

  const runtimeControlIds = new Set(RELEASE_DECISION_REGISTER.controls.map((control) => control.id));
  const seenItemIds = new Set<string>();
  const seenOrders = new Set<number>();
  const expectedSectionCounts = new Map([["A", 4], ["B", 6], ["C", 4], ["D", 6], ["E", 4], ["F", 5]]);
  const actualSectionCounts = new Map<string, number>();

  log.items.forEach((item, itemIndex) => {
    const canonical = canonicalItems[itemIndex];
    if (
      !canonical ||
      item.id !== canonical.id ||
      item.order !== canonical.order ||
      item.section !== canonical.section ||
      item.question !== canonical.question ||
      JSON.stringify(item.sourcePages) !== JSON.stringify(canonical.sourcePages)
    ) {
      context.addIssue({ code: "custom", message: `P0 item does not match Appendix A at position ${itemIndex + 1}`, path: ["items", itemIndex] });
    }
    if (seenItemIds.has(item.id)) {
      context.addIssue({ code: "custom", message: `duplicate P0 item: ${item.id}`, path: ["items", itemIndex, "id"] });
    }
    if (seenOrders.has(item.order)) {
      context.addIssue({ code: "custom", message: `duplicate P0 order: ${item.order}`, path: ["items", itemIndex, "order"] });
    }
    seenItemIds.add(item.id);
    seenOrders.add(item.order);
    actualSectionCounts.set(item.section, (actualSectionCounts.get(item.section) ?? 0) + 1);

    const computedDefinitionSha256 = computeP0ItemDefinitionSha256(item);
    if (item.definitionSha256 !== computedDefinitionSha256) {
      context.addIssue({ code: "custom", message: `P0 item definition digest mismatch: ${item.id}`, path: ["items", itemIndex, "definitionSha256"] });
    }

    if (new Set(item.relatedReleaseControlIds).size !== item.relatedReleaseControlIds.length) {
      context.addIssue({ code: "custom", message: `duplicate runtime control mapping: ${item.id}`, path: ["items", itemIndex, "relatedReleaseControlIds"] });
    }
    item.relatedReleaseControlIds.forEach((controlId, controlIndex) => {
      if (!runtimeControlIds.has(controlId)) {
        context.addIssue({ code: "custom", message: `unknown runtime control ${controlId} linked by ${item.id}`, path: ["items", itemIndex, "relatedReleaseControlIds", controlIndex] });
      }
    });
    if (item.decisionDueAt && Date.parse(item.decisionDueAt) <= effectiveAt) {
      context.addIssue({ code: "custom", message: `P0 decision due time does not follow register effective time: ${item.id}`, path: ["items", itemIndex, "decisionDueAt"] });
    }

    const requiredDecisionRoles = P0_REQUIRED_DECISION_ROLES[item.id as P0CanonicalId] ?? [];
    const seenDecisionIds = new Set<string>();
    let priorDecision: (typeof item.decisionHistory)[number] | null = null;
    item.decisionHistory.forEach((decision, decisionIndex) => {
      const expectedDecisionId = `${item.id}__d${String(decisionIndex + 1).padStart(4, "0")}`;
      if (decision.id !== expectedDecisionId) {
        context.addIssue({ code: "custom", message: `non-canonical P0 decision ID: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "id"] });
      }
      if (seenDecisionIds.has(decision.id)) {
        context.addIssue({ code: "custom", message: `duplicate P0 decision event: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "id"] });
      }
      seenDecisionIds.add(decision.id);
      if (decision.ownerRole === decision.backupOwnerRole) {
        context.addIssue({ code: "custom", message: `P0 decision owner and backup must differ: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "backupOwnerRole"] });
      }
      if (!requiredDecisionRoles.includes(decision.ownerRole) || !requiredDecisionRoles.includes(decision.backupOwnerRole)) {
        context.addIssue({ code: "custom", message: `P0 decision owners lack item-specific authority: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "ownerRole"] });
      }

      const decidedAt = Date.parse(decision.decidedAt);
      if (decidedAt < effectiveAt || decidedAt > now) {
        context.addIssue({ code: "custom", message: `P0 decision time is outside the active ledger window: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "decidedAt"] });
      }
      if (priorDecision && decidedAt <= Date.parse(priorDecision.decidedAt)) {
        context.addIssue({ code: "custom", message: `P0 decision history is not strictly chronological: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "decidedAt"] });
      }
      if (Date.parse(decision.reviewDueAt) <= decidedAt) {
        context.addIssue({ code: "custom", message: `P0 review is not after its decision: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "reviewDueAt"] });
      }
      if (decision.implementationDueAt && Date.parse(decision.implementationDueAt) <= decidedAt) {
        context.addIssue({ code: "custom", message: `P0 implementation due time is not after its decision: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "implementationDueAt"] });
      }
      if (new Set(decision.evidenceReferenceIds).size !== decision.evidenceReferenceIds.length) {
        context.addIssue({ code: "custom", message: `duplicate P0 decision evidence: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds"] });
      }
      if (new Set(decision.permittedImpactSurfaceIds).size !== decision.permittedImpactSurfaceIds.length) {
        context.addIssue({ code: "custom", message: `duplicate permitted-impact surface: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "permittedImpactSurfaceIds"] });
      }

      if (decisionIndex === 0) {
        if (decision.supersedesDecisionId !== null || decision.previousDecisionSha256 !== null) {
          context.addIssue({ code: "custom", message: `first P0 decision cannot link to a predecessor: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex] });
        }
        if (decision.outcome === "revoked") {
          context.addIssue({ code: "custom", message: `revocation cannot be the first P0 event: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "outcome"] });
        }
      } else if (
        decision.supersedesDecisionId !== priorDecision?.id ||
        decision.previousDecisionSha256 !== priorDecision.eventSha256
      ) {
        context.addIssue({ code: "custom", message: `P0 decision does not hash-link the immediately prior event: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex] });
      }

      const computedEventSha256 = computeP0DecisionEventSha256(item.definitionSha256, decision);
      if (decision.eventSha256 !== computedEventSha256) {
        context.addIssue({ code: "custom", message: `P0 decision event digest mismatch: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "eventSha256"] });
      }

      const ownerDecisionRoles = new Set<P0OwnerRole>();
      decision.evidenceReferenceIds.forEach((evidenceId, evidenceIndex) => {
        const evidence = evidenceCatalog.get(evidenceId);
        if (!evidence || evidence.verificationStatus !== "verified_current") {
          context.addIssue({ code: "custom", message: `P0 decision references missing or non-current evidence: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds", evidenceIndex] });
          return;
        }
        if (evidence.kind !== "owner_decision") return;
        const binding = evidence.decisionBinding;
        if (
          !binding ||
          binding.itemId !== item.id ||
          binding.decisionId !== decision.id ||
          binding.outcome !== decision.outcome ||
          binding.decisionEventSha256 !== decision.eventSha256
        ) {
          context.addIssue({ code: "custom", message: `owner-decision evidence is not bound to the exact P0 event: ${evidence.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds", evidenceIndex] });
          return;
        }
        if (!requiredDecisionRoles.includes(evidence.reviewedByRole)) {
          context.addIssue({ code: "custom", message: `owner-decision evidence uses an unauthorized role: ${evidence.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds", evidenceIndex] });
          return;
        }
        if (Date.parse(evidence.reviewedAt) < decidedAt) {
          context.addIssue({ code: "custom", message: `owner-decision evidence predates its bound decision: ${evidence.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds", evidenceIndex] });
          return;
        }
        ownerDecisionRoles.add(evidence.reviewedByRole);
      });
      requiredDecisionRoles.forEach((requiredRole) => {
        if (!ownerDecisionRoles.has(requiredRole)) {
          context.addIssue({ code: "custom", message: `P0 event lacks item-specific approval evidence from ${requiredRole}: ${decision.id}`, path: ["items", itemIndex, "decisionHistory", decisionIndex, "evidenceReferenceIds"] });
        }
      });
      priorDecision = decision;
    });
  });

  expectedSectionCounts.forEach((expected, section) => {
    if (actualSectionCounts.get(section) !== expected) {
      context.addIssue({ code: "custom", message: `incorrect P0 section count: ${section}`, path: ["items"] });
    }
  });
});

export function computeP0PublishedBaselineContentSha256(candidate: Record<string, unknown>): string {
  const baselineWithoutDigest = { ...candidate };
  delete baselineWithoutDigest.baselineContentSha256;
  return canonicalSha256(baselineWithoutDigest);
}

export const p0PublishedBaselineSchema = z.object({
  protocolVersion: z.literal(P0_PUBLISHED_BASELINE_PROTOCOL),
  sourceLedgerRevision: z.number().int().min(1),
  sourceLedgerContentSha256: sha256Schema,
  canonicalDefinitionSetSha256: sha256Schema,
  decisionRolePolicySha256: sha256Schema,
  evidenceFingerprints: z.array(z.object({
    id: evidenceIdSchema,
    fingerprintSha256: sha256Schema,
  }).strict()).max(200),
  itemHistoryHeads: z.array(z.object({
    itemId: p0IdSchema,
    eventSha256s: z.array(sha256Schema).max(20),
  }).strict()).length(29),
  baselineContentSha256: sha256Schema,
}).strict().superRefine((baseline, context) => {
  if (baseline.canonicalDefinitionSetSha256 !== P0_CANONICAL_DEFINITION_SET_SHA256) {
    context.addIssue({ code: "custom", message: "published P0 baseline definition digest mismatch", path: ["canonicalDefinitionSetSha256"] });
  }
  if (baseline.decisionRolePolicySha256 !== P0_REQUIRED_DECISION_ROLE_POLICY_SHA256) {
    context.addIssue({ code: "custom", message: "published P0 baseline role-policy digest mismatch", path: ["decisionRolePolicySha256"] });
  }
  if (computeP0PublishedBaselineContentSha256(baseline as unknown as Record<string, unknown>) !== baseline.baselineContentSha256) {
    context.addIssue({ code: "custom", message: "published P0 baseline content digest mismatch", path: ["baselineContentSha256"] });
  }
  if (new Set(baseline.evidenceFingerprints.map((entry) => entry.id)).size !== baseline.evidenceFingerprints.length) {
    context.addIssue({ code: "custom", message: "published P0 baseline repeats an evidence ID", path: ["evidenceFingerprints"] });
  }
  baseline.itemHistoryHeads.forEach((head, index) => {
    if (head.itemId !== canonicalItems[index]?.id) {
      context.addIssue({ code: "custom", message: "published P0 baseline item order drifted", path: ["itemHistoryHeads", index, "itemId"] });
    }
  });
});

export type P0DecisionLog = z.infer<typeof p0DecisionLogSchema>;
export type P0PublishedBaseline = z.infer<typeof p0PublishedBaselineSchema>;

export function parseP0DecisionLog(candidate: unknown): P0DecisionLog {
  const parsed = p0DecisionLogSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "register";
    throw new Error(`Invalid Sufeiya P0 decision log at ${path}`);
  }
  return parsed.data;
}

export function parseP0PublishedBaseline(candidate: unknown): P0PublishedBaseline {
  const parsed = p0PublishedBaselineSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "baseline";
    throw new Error(`Invalid Sufeiya published P0 baseline at ${path}`);
  }
  return parsed.data;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export function validateP0AppendOnlyRevision(
  previousCandidate: unknown,
  nextCandidate: unknown,
): P0DecisionLog {
  const previous = parseP0DecisionLog(previousCandidate);
  const next = parseP0DecisionLog(nextCandidate);
  if (
    next.ledgerRevision !== previous.ledgerRevision + 1 ||
    next.previousLedgerSha256 !== previous.ledgerContentSha256 ||
    next.canonicalDefinitionSetSha256 !== previous.canonicalDefinitionSetSha256 ||
    next.decisionRolePolicySha256 !== previous.decisionRolePolicySha256
  ) throw new Error("Invalid Sufeiya P0 append-only ledger revision link");
  if (next.evidenceCatalog.length < previous.evidenceCatalog.length) {
    throw new Error("Invalid Sufeiya P0 append-only evidence history");
  }
  previous.evidenceCatalog.forEach((evidence, index) => {
    if (canonicalSha256(next.evidenceCatalog[index]) !== canonicalSha256(evidence)) {
      throw new Error("Invalid Sufeiya P0 append-only evidence history");
    }
  });
  previous.items.forEach((previousItem, itemIndex) => {
    const nextItem = next.items[itemIndex];
    if (!nextItem || nextItem.decisionHistory.length < previousItem.decisionHistory.length) {
      throw new Error("Invalid Sufeiya P0 append-only decision history");
    }
    previousItem.decisionHistory.forEach((event, eventIndex) => {
      if (canonicalSha256(nextItem.decisionHistory[eventIndex]) !== canonicalSha256(event)) {
        throw new Error("Invalid Sufeiya P0 append-only decision history");
      }
    });
  });
  return next;
}

export function validateP0DecisionLogAgainstPublishedBaseline(
  log: P0DecisionLog,
  baseline: P0PublishedBaseline,
): P0DecisionLog {
  if (
    log.canonicalDefinitionSetSha256 !== baseline.canonicalDefinitionSetSha256 ||
    log.decisionRolePolicySha256 !== baseline.decisionRolePolicySha256
  ) {
    throw new Error("Invalid Sufeiya P0 published-baseline definition link");
  }
  if (log.ledgerRevision === baseline.sourceLedgerRevision) {
    if (log.ledgerContentSha256 !== baseline.sourceLedgerContentSha256) {
      throw new Error("Invalid Sufeiya P0 published-baseline ledger digest");
    }
  } else if (
    log.ledgerRevision !== baseline.sourceLedgerRevision + 1 ||
    log.previousLedgerSha256 !== baseline.sourceLedgerContentSha256
  ) {
    throw new Error("Invalid Sufeiya P0 published-baseline revision link");
  }
  baseline.evidenceFingerprints.forEach((entry, index) => {
    const evidence = log.evidenceCatalog[index];
    if (!evidence || evidence.id !== entry.id || computeP0EvidenceFingerprint(evidence) !== entry.fingerprintSha256) {
      throw new Error("Invalid Sufeiya P0 published-baseline evidence prefix");
    }
  });
  baseline.itemHistoryHeads.forEach((head, itemIndex) => {
    const item = log.items[itemIndex];
    if (!item || item.id !== head.itemId || item.decisionHistory.length < head.eventSha256s.length) {
      throw new Error("Invalid Sufeiya P0 published-baseline decision prefix");
    }
    head.eventSha256s.forEach((eventSha256, eventIndex) => {
      if (item.decisionHistory[eventIndex]?.eventSha256 !== eventSha256) {
        throw new Error("Invalid Sufeiya P0 published-baseline decision prefix");
      }
    });
  });
  return log;
}

const parsedP0DecisionLog = parseP0DecisionLog(p0DecisionLogJson);
if (parsedP0DecisionLog.ledgerContentSha256 !== P0_CURRENT_LEDGER_SHA256) {
  throw new Error("Invalid Sufeiya current P0 ledger digest");
}
const parsedP0PublishedBaseline = parseP0PublishedBaseline(p0PublishedBaselineJson);
if (parsedP0PublishedBaseline.baselineContentSha256 !== P0_CURRENT_PUBLISHED_BASELINE_SHA256) {
  throw new Error("Invalid Sufeiya current published P0 baseline digest");
}
export const P0_PUBLISHED_BASELINE = deepFreeze(parsedP0PublishedBaseline);
export const P0_DECISION_LOG = deepFreeze(
  validateP0DecisionLogAgainstPublishedBaseline(parsedP0DecisionLog, P0_PUBLISHED_BASELINE),
);

export type P0DerivedStatus = "adopted" | "rejected" | "deferred" | "revoked" | "not_approved" | "needs_renewal";

export type P0DecisionLogSummary = {
  protocolVersion: typeof P0_DECISION_PROTOCOL;
  status: "blocked" | "decision_complete";
  total: 29;
  resolved: number;
  unresolved: number;
  adopted: number;
  rejected: number;
  deferred: number;
  revoked: number;
  notApproved: number;
  needsRenewal: number;
  defaultDisposition: "deny";
  formalGate0Pass: false;
  releaseAuthorization: typeof P0_RELEASE_AUTHORIZATION;
};

export function deriveP0ItemStatus(
  item: P0DecisionLog["items"][number],
  now = Date.now(),
): P0DerivedStatus {
  const decision = item.decisionHistory.at(-1);
  if (!decision) return "not_approved";
  if (["adopted", "rejected"].includes(decision.outcome) && Date.parse(decision.reviewDueAt) <= now) {
    return "needs_renewal";
  }
  return decision.outcome;
}

export function summarizeP0DecisionLog(
  log: P0DecisionLog = P0_DECISION_LOG,
  now = Date.now(),
): P0DecisionLogSummary {
  const statuses = log.items.map((item) => deriveP0ItemStatus(item, now));
  const count = (status: P0DerivedStatus) => statuses.filter((item) => item === status).length;
  const adopted = count("adopted");
  const rejected = count("rejected");
  const resolved = adopted + rejected;
  const complete =
    log.registerStatus === "decision_complete" &&
    !["due", "superseded", "revoked"].includes(log.registerStatus) &&
    Date.parse(log.nextRegisterReviewAt) > now &&
    resolved === 29;

  return {
    protocolVersion: P0_DECISION_PROTOCOL,
    status: complete ? "decision_complete" : "blocked",
    total: 29,
    resolved,
    unresolved: 29 - resolved,
    adopted,
    rejected,
    deferred: count("deferred"),
    revoked: count("revoked"),
    notApproved: count("not_approved"),
    needsRenewal: count("needs_renewal"),
    defaultDisposition: "deny",
    formalGate0Pass: false,
    releaseAuthorization: P0_RELEASE_AUTHORIZATION,
  };
}
