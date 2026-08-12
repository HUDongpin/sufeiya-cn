import { z } from "zod";

import {
  CANONICAL_LEARNER_STORAGE_KEY,
  deriveTeachingReviewEvidence,
} from "@/lib/teaching-review-demo";

export const PROVISIONAL_HANDOFF_PROTOCOL = "sufeiya_provisional_handoff_packet_v1" as const;

const writerId = (prefix: string) => z.string().regex(
  new RegExp(`^${prefix}-[0-9a-z]{6,10}-[0-9a-z]{5}$`),
);
const cycleIdSchema = writerId("cycle");
const diagnosticSessionIdSchema = writerId("diagnostic");
const planIdSchema = z.string().regex(/^plan-[0-9a-z]{6,10}(?:-[0-9a-z]{5})?$/);
const recommendationIdSchema = writerId("recommendation");
const checkInIdSchema = z.string().regex(/^check-in-[0-9a-z]{6,10}$/);
const reviewIdSchema = writerId("review");
const peerHelpIdSchema = writerId("peer-help");
const retestIdSchema = writerId("retest");
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const prioritySkillSchema = z.enum(["Reading", "Listening", "Writing", "Speaking"]);
const peerHelpStatusSchema = z.enum(["used", "declined", "not_needed", "unavailable"]);
const evidenceStatusSchema = z.enum(["limited_single_task", "needs_review", "evidence_insufficient"]);

export const canonicalUtcMillisecondTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  }, "Timestamp must be the canonical UTC millisecond ISO representation.");

export const provisionalHandoffEvidenceSchema = z.object({
  cycleId: cycleIdSchema,
  diagnosticSessionId: diagnosticSessionIdSchema,
  basePlanId: planIdSchema,
  recommendationId: recommendationIdSchema,
  checkInId: checkInIdSchema,
  reviewId: reviewIdSchema,
  peerHelpId: peerHelpIdSchema,
  peerHelpStatus: peerHelpStatusSchema,
  retestId: retestIdSchema,
  updatedPlanId: planIdSchema,
  sourceUpdatedAt: canonicalUtcMillisecondTimestampSchema.nullable(),
  prioritySkill: prioritySkillSchema,
  retestEvidenceStatus: evidenceStatusSchema,
  humanConfirmationStatus: z.literal("required_not_completed"),
}).strict();

export type ProvisionalHandoffEvidence = z.infer<typeof provisionalHandoffEvidenceSchema>;
export type ProvisionalHandoffBinding = Pick<
  ProvisionalHandoffEvidence,
  | "sourceUpdatedAt"
  | "peerHelpStatus"
  | "prioritySkill"
  | "retestEvidenceStatus"
  | "humanConfirmationStatus"
>;

export type ProvisionalHandoffEvidenceResult =
  | { status: "empty" }
  | { status: "no_active_cycle" }
  | { status: "no_provisional_cycle" }
  | { status: "invalid"; reason: string }
  | { status: "ready"; evidence: ProvisionalHandoffEvidence };

export const provisionalHandoffPacketSchema = z.object({
  protocolVersion: z.literal(PROVISIONAL_HANDOFF_PROTOCOL),
  kind: z.literal("provisional_cycle_human_support_handoff"),
  createdAt: canonicalUtcMillisecondTimestampSchema,
  status: z.literal("local_not_sent"),
  sourceClass: z.literal("strict_local_provisional_snapshot"),
  sourceStorageKey: z.literal(CANONICAL_LEARNER_STORAGE_KEY),
  sourceSnapshotSha256: sha256Schema,
  sourceUpdatedAt: canonicalUtcMillisecondTimestampSchema.nullable(),
  recordedStepCount: z.literal(7),
  peerHelpStatus: peerHelpStatusSchema,
  prioritySkill: prioritySkillSchema,
  retestEvidenceStatus: evidenceStatusSchema,
  humanConfirmationStatus: z.literal("required_not_completed"),
  networkDispatch: z.literal("disabled"),
  realQueueCreated: z.literal(false),
  humanReviewReceiptCreated: z.literal(false),
  qualifiedHumanConfirmation: z.literal(false),
  identityVerified: z.literal(false),
  canonicalLedgerWriteAllowed: z.literal(false),
  cycleClosureAllowed: z.literal(false),
  learnerNarrativeWithheld: z.literal(true),
}).strict();

export type ProvisionalHandoffPacket = z.infer<typeof provisionalHandoffPacketSchema>;

type JsonRecord = Record<string, unknown>;

const ACTIVE_CYCLE_BINDING_FIELDS = [
  "protocolVersion",
  "cycleId",
  "diagnosticSessionId",
  "basePlanId",
  "recommendationId",
  "checkInId",
  "reviewId",
  "peerHelpId",
  "retestId",
  "updatedPlanId",
  "status",
  "closedAt",
  "provisionalAt",
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function currentAuthorizedHistoryRecord(raw: string) {
  try {
    const root = JSON.parse(raw) as unknown;
    if (!isRecord(root) || !isRecord(root.journey)) return null;
    const journey = root.journey;
    const activeCycle = isRecord(journey.activeCycle) ? journey.activeCycle : null;
    if (!activeCycle || !Array.isArray(journey.history)) return null;
    const matching = journey.history.filter((entry): entry is JsonRecord =>
      isRecord(entry) && ACTIVE_CYCLE_BINDING_FIELDS.every((field) => entry[field] === activeCycle[field]),
    );
    return matching.length === 1 ? matching[0] : null;
  } catch {
    return null;
  }
}

export function deriveProvisionalHandoffEvidence(raw: string | null): ProvisionalHandoffEvidenceResult {
  const authorized = deriveTeachingReviewEvidence(raw);
  if (authorized.status === "empty") return { status: "empty" };
  if (authorized.status === "no_active_cycle") return { status: "no_active_cycle" };
  if (authorized.status === "no_provisional_cycle") return { status: "no_provisional_cycle" };
  if (authorized.status === "invalid") return { status: "invalid", reason: authorized.reason };
  if (!raw) return { status: "invalid", reason: "authorized_source_missing" };

  // The teaching-review projection is the sole admission gate. This second pass
  // only copies the already-authorized same-cycle IDs that its minimized public
  // projection intentionally withholds; it does not admit an alternate shape.
  const cycle = currentAuthorizedHistoryRecord(raw);
  const peerHelp = cycle && isRecord(cycle.peerHelp) ? cycle.peerHelp : null;
  const evidence = provisionalHandoffEvidenceSchema.safeParse({
    cycleId: cycle?.cycleId,
    diagnosticSessionId: cycle?.diagnosticSessionId,
    basePlanId: cycle?.basePlanId,
    recommendationId: cycle?.recommendationId,
    checkInId: cycle?.checkInId,
    reviewId: cycle?.reviewId,
    peerHelpId: cycle?.peerHelpId,
    peerHelpStatus: peerHelp?.status,
    retestId: cycle?.retestId,
    updatedPlanId: cycle?.updatedPlanId,
    sourceUpdatedAt: authorized.sourceUpdatedAt,
    prioritySkill: authorized.diagnostic?.prioritySkill,
    retestEvidenceStatus: authorized.retest?.evidenceStatus,
    humanConfirmationStatus: authorized.retest?.humanConfirmationStatus,
  });
  if (!evidence.success) return { status: "invalid", reason: "authorized_binding_projection_failed" };
  if (
    evidence.data.cycleId !== authorized.cycle.cycleId ||
    evidence.data.diagnosticSessionId !== authorized.cycle.diagnosticSessionId ||
    evidence.data.basePlanId !== authorized.cycle.basePlanId ||
    evidence.data.recommendationId !== authorized.cycle.recommendationId ||
    evidence.data.retestId !== authorized.cycle.retestId ||
    evidence.data.updatedPlanId !== authorized.cycle.updatedPlanId ||
    evidence.data.checkInId !== authorized.practice?.checkInId ||
    evidence.data.peerHelpStatus !== authorized.peerHelp?.status ||
    authorized.cycle.status !== "provisional_pending_human_review" ||
    authorized.planUpdate?.provisional !== true ||
    authorized.planUpdate.humanConfirmationStatus !== "required_not_completed"
  ) {
    return { status: "invalid", reason: "authorized_projection_binding_mismatch" };
  }
  return { status: "ready", evidence: evidence.data };
}

export function createProvisionalHandoffPacket({
  evidence,
  sourceSnapshotSha256,
  createdAt,
}: {
  evidence: ProvisionalHandoffEvidence;
  sourceSnapshotSha256: string;
  createdAt: string;
}): ProvisionalHandoffPacket {
  return provisionalHandoffPacketSchema.parse({
    protocolVersion: PROVISIONAL_HANDOFF_PROTOCOL,
    kind: "provisional_cycle_human_support_handoff",
    createdAt,
    status: "local_not_sent",
    sourceClass: "strict_local_provisional_snapshot",
    sourceStorageKey: CANONICAL_LEARNER_STORAGE_KEY,
    sourceSnapshotSha256,
    sourceUpdatedAt: evidence.sourceUpdatedAt,
    recordedStepCount: 7,
    peerHelpStatus: evidence.peerHelpStatus,
    prioritySkill: evidence.prioritySkill,
    retestEvidenceStatus: evidence.retestEvidenceStatus,
    humanConfirmationStatus: "required_not_completed",
    networkDispatch: "disabled",
    realQueueCreated: false,
    humanReviewReceiptCreated: false,
    qualifiedHumanConfirmation: false,
    identityVerified: false,
    canonicalLedgerWriteAllowed: false,
    cycleClosureAllowed: false,
    learnerNarrativeWithheld: true,
  });
}

export function parseProvisionalHandoffPacket(value: unknown): ProvisionalHandoffPacket | null {
  const parsed = provisionalHandoffPacketSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function serializeProvisionalHandoffPacket(packet: ProvisionalHandoffPacket) {
  return JSON.stringify(provisionalHandoffPacketSchema.parse(packet));
}

export function packetMatchesProvisionalEvidence(
  packet: ProvisionalHandoffPacket,
  evidence: ProvisionalHandoffBinding,
  sourceSnapshotSha256: string,
) {
  return packet.sourceSnapshotSha256 === sourceSnapshotSha256 &&
    packet.sourceUpdatedAt === evidence.sourceUpdatedAt &&
    packet.peerHelpStatus === evidence.peerHelpStatus &&
    packet.prioritySkill === evidence.prioritySkill &&
    packet.retestEvidenceStatus === evidence.retestEvidenceStatus &&
    packet.humanConfirmationStatus === evidence.humanConfirmationStatus;
}

export function findMatchingProvisionalHandoffPacket(
  packets: readonly ProvisionalHandoffPacket[],
  evidence: ProvisionalHandoffBinding,
  sourceSnapshotSha256: string,
) {
  return [...packets].reverse().find((packet) =>
    packetMatchesProvisionalEvidence(packet, evidence, sourceSnapshotSha256),
  );
}

export async function sha256Hex(value: string, cryptoProvider: Pick<Crypto, "subtle"> = globalThis.crypto) {
  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildProvisionalHandoffCopyText(packet: ProvisionalHandoffPacket) {
  const safePacket = provisionalHandoffPacketSchema.parse(packet);
  return [
    "[Sofia智能老师 Gate A 本机临时轮次白名单承接包]",
    `本机生成时间：${safePacket.createdAt}`,
    `同伴支持状态：${safePacket.peerHelpStatus}`,
    `优先技能：${safePacket.prioritySkill}`,
    `微复测证据：${safePacket.retestEvidenceStatus}`,
    `人工确认：${safePacket.humanConfirmationStatus}`,
    `来源更新时间：${safePacket.sourceUpdatedAt || "未记录"}`,
    `来源快照 SHA-256：${safePacket.sourceSnapshotSha256}`,
    "状态：仅在本机准备，尚未发送；未建立真人队列或人工复核回执。",
    "权限边界：身份未核验；未写入学习主账本；未形成具资质人工确认；不允许关闭 cycle。",
    "同快照绑定：只使用上列 SHA-256 重新核对完整本机工作区；包不保存或复制任何原始领域 ID。",
    "隐私：不从来源投影姓名、Clerk 身份、联系方式、原始答案、录音、对话或打卡自由文本字段。",
  ].join("\n");
}
