import { z } from "zod";

export const CANONICAL_LEARNER_STORAGE_KEY = "sufeiya_workspace_v1";
export const TEACHING_REVIEW_DEMO_STORAGE_KEY = "sufeiya_teaching_review_demo_v1";
export const TEACHING_REVIEW_DEMO_PROTOCOL = "sufeiya_teaching_review_demo_v1";

const WORKSPACE_SCHEMA_VERSION = 1;
const JOURNEY_PROTOCOL_VERSION = "gate_a_local_v1";
const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
const PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v2";
const VALID_SKILLS = ["Balanced", "Reading", "Listening", "Writing", "Speaking"] as const;
const VALID_PEER_HELP_STATES = ["used", "declined", "not_needed", "unavailable"] as const;
const DIAGNOSTIC_PRIORITY_BASES = [
  "learner_confirmation_after_multiple_gaps",
  "evidence_quality_gap",
  "open_response_coverage_gap",
  "objective_first_response_pattern",
  "learner_confirmation_after_tie",
] as const;
const DIAGNOSTIC_QUALITY_FLAGS = new Set([
  "audio_not_played",
  "audio_not_completed",
  "audio_seek_detected",
  "audio_playback_failed",
  "audio_output_unavailable",
  "transcript_used",
  "multiple_replays",
  "browser_voice_variability",
  "voice_fallback_used",
  "voice_not_loaded",
  "speech_synthesis_error",
  "learner_skipped",
  "task_unavailable",
  "writing_paste_detected",
  "writing_ended_early",
  "writing_below_completion_condition",
  "speaking_ended_early",
  "self_review_incomplete",
  "audio_not_recorded",
  "open_response_not_human_reviewed",
  "resumed_after_reload",
]);
const PRACTICE_QUALITY_FLAGS = new Set([
  "multiple_attempts",
  "audio_not_played",
  "audio_not_completed",
  "audio_seek_detected",
  "audio_playback_failed",
  "transcript_used",
  "audio_not_recorded",
  "open_response_not_human_reviewed",
]);
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
const DIAGNOSTIC_TASK_MANIFEST = Object.freeze({
  "diagnostic-reading-library-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "purpose_from_supporting_details", contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7" }),
  "diagnostic-reading-newsletter-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "cause_from_text_structure", contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca" }),
  "diagnostic-listening-science-club-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "schedule_change_detail", contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308" }),
  "diagnostic-listening-language-lab-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "time_and_location_integration", contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd" }),
  "diagnostic-speaking-learning-skill-v1": Object.freeze({ taskVersion: "v1", skill: "Speaking", responseType: "timed_self_report", constructTag: "task_coverage_and_connected_thoughts_self_report", contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9" }),
  "diagnostic-writing-learning-place-v1": Object.freeze({ taskVersion: "v1", skill: "Writing", responseType: "timed_local_text", constructTag: "task_response_structure_self_review", contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85" }),
});
const DIAGNOSTIC_TASK_IDS = Object.freeze(Object.keys(DIAGNOSTIC_TASK_MANIFEST));
const RETEST_TASK_CATALOG = Object.freeze({
  Reading: Object.freeze({ taskId: "retest-reading-garden-labels-v1", taskVersion: "v1", parallelFormPairId: "gate-a-reading-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice", correctValue: "b" }),
  Listening: Object.freeze({ taskId: "retest-listening-writing-center-v1", taskVersion: "v1", parallelFormPairId: "gate-a-listening-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice", correctValue: "c" }),
  Writing: Object.freeze({ taskId: "retest-writing-study-habit-v1", taskVersion: "v1", parallelFormPairId: "gate-a-writing-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "self_reviewed_writing", minimumWordCount: 20 }),
  Speaking: Object.freeze({ taskId: "retest-speaking-study-place-v1", taskVersion: "v1", parallelFormPairId: "gate-a-speaking-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "learner_confirmed_speaking" }),
});
const PRACTICE_ACTIVITY_CATALOG = Object.freeze({
  "reading-library-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/reading-library/v1", activityVersion: "v1", contentId: "reading-library-v1", contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f", skill: "Reading", route: "/practice-reading", receiptEvidenceClass: "objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", correctValue: "b" }),
  "listening-club-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/listening-club/v1", activityVersion: "v1", contentId: "listening-club-v1", contentHash: "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb", skill: "Listening", route: "/practice-listening", receiptEvidenceClass: "audio_objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", correctValue: "b" }),
  "writing-community-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/writing-community/v1", activityVersion: "v1", contentId: "writing-community-v1", contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b", skill: "Writing", route: "/practice-writing", receiptEvidenceClass: "self_reviewed_artifact", evidenceType: "task_completed_no_score", completionCondition: "minimum_words_and_self_review", minimumWords: 20 }),
  "speaking-skill-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/speaking-skill/v1", activityVersion: "v1", contentId: "speaking-skill-v1", contentHash: "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843", skill: "Speaking", route: "/practice-speaking", receiptEvidenceClass: "timed_self_report", evidenceType: "task_completed_no_score", completionCondition: "timer_and_self_review", prepSeconds: 20, responseSeconds: 60 }),
});
const ESCALATION_CATEGORIES = [
  "evidence_quality",
  "open_response_review",
  "content_alignment",
  "other",
] as const;
const MAX_CANONICAL_BYTES = 5_000_000;
const MAX_ID_LENGTH = 180;
const MAX_SUMMARY_LENGTH = 600;
const MAX_FLAG_COUNT = 32;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type JsonRecord = Record<string, unknown>;

export type TeachingReviewSkill = (typeof VALID_SKILLS)[number];
export type TeachingReviewEscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

export type DiagnosticTaskSummary = {
  taskId: string;
  skill: TeachingReviewSkill | "Unknown";
  status: string;
  evidenceStatus: string;
  resultType: string | null;
  constructTag: string | null;
  qualityFlags: string[];
};

export type TeachingReviewEvidenceSnapshot = {
  status: "ready";
  sourceStorageKey: typeof CANONICAL_LEARNER_STORAGE_KEY;
  sourceReadMode: "read_only";
  sourceUpdatedAt: string | null;
  integrityClass: "shape_checked_local_evidence_not_cryptographically_verified";
  identityVerified: false;
  qualifiedHumanConfirmation: false;
  canonicalLedgerWriteAllowed: false;
  cycleClosureAllowed: false;
  cycle: {
    cycleId: string;
    status: string;
    provisionalAt: string | null;
    closedAt: null;
    diagnosticSessionId: string | null;
    basePlanId: string | null;
    recommendationId: string | null;
    retestId: string | null;
    updatedPlanId: string | null;
  };
  diagnostic: {
    status: string;
    prioritySkill: TeachingReviewSkill | "Unknown";
    priorityBasis: string | null;
    evidenceSufficiency: string | null;
    confidence: string | null;
    taskSetVersion: string | null;
    taskSetDigest: string | null;
    learnerConfirmedPriority: boolean;
    automatedScoreProduced: boolean;
    formalDiagnosisProduced: boolean;
    tasks: DiagnosticTaskSummary[];
  } | null;
  recommendation: {
    status: string;
    primaryTaskId: string | null;
    primarySkill: TeachingReviewSkill | "Unknown";
    primaryTitle: string | null;
    reason: string | null;
    reviewStatus: string | null;
    teacherReviewed: boolean;
  } | null;
  practice: {
    checkInId: string | null;
    learnerConfirmedReview: boolean;
    evidenceClass: string | null;
    linkedTaskId: string | null;
    completionReceiptId: string | null;
    receiptFound: boolean;
    receiptStatus: string | null;
    receiptEvidenceStatus: string | null;
    receiptIntegrityClass: string | null;
    qualityFlags: string[];
    learnerNarrativeWithheld: true;
  } | null;
  peerHelp: {
    status: string;
    realCommunityUsed: boolean;
  } | null;
  retest: {
    status: string;
    skill: TeachingReviewSkill | "Unknown";
    evidenceStatus: string | null;
    evidenceSufficiency: string | null;
    resultType: string | null;
    humanConfirmationStatus: string | null;
    teacherReviewed: boolean;
    measurementReviewed: boolean;
    officialEquivalenceClaimed: boolean;
    automatedScoreProduced: boolean;
    growthClaimProduced: boolean;
  } | null;
  planUpdate: {
    focusSkill: TeachingReviewSkill | "Unknown";
    confirmationClass: string | null;
    humanConfirmationStatus: string | null;
    learnerConfirmed: boolean;
    provisional: boolean;
  } | null;
};

export type TeachingReviewEvidenceResult =
  | { status: "empty" }
  | { status: "invalid"; reason: string }
  | { status: "no_active_cycle"; sourceUpdatedAt: string | null }
  | { status: "no_provisional_cycle"; sourceUpdatedAt: string | null }
  | TeachingReviewEvidenceSnapshot;

const teachingReviewDraftSchema = z.object({
  protocolVersion: z.literal(TEACHING_REVIEW_DEMO_PROTOCOL),
  draftId: z.string().uuid(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.literal("local_demo_draft"),
  cycleId: z.string().min(1).max(MAX_ID_LENGTH),
  sourceUpdatedAt: z.string().datetime().nullable(),
  sourceSnapshotSha256: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
  savedAt: z.string().datetime(),
  identityVerified: z.literal(false),
  qualifiedHumanConfirmation: z.literal(false),
  canonicalLedgerWrite: z.literal(false),
  cycleClosureAttempted: z.literal(false),
  recommendationDraft: z.object({
    focusSkill: z.enum(VALID_SKILLS),
    rationale: z.string().trim().min(12).max(1_200),
  }).strict(),
  escalationDraft: z.object({
    category: z.enum(ESCALATION_CATEGORIES),
    note: z.string().trim().min(12).max(1_200),
  }).strict(),
}).strict();

export type TeachingReviewDraft = z.infer<typeof teachingReviewDraftSchema>;
export type TeachingReviewDraftInspection =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ready"; draft: TeachingReviewDraft };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value: unknown, maxLength = MAX_SUMMARY_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function safeId(value: unknown): string | null {
  return safeString(value, MAX_ID_LENGTH);
}

function safeIsoDate(value: unknown): string | null {
  const candidate = safeString(value, 80);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function safeSkill(value: unknown): TeachingReviewSkill | "Unknown" {
  return VALID_SKILLS.includes(value as TeachingReviewSkill) ? (value as TeachingReviewSkill) : "Unknown";
}

function safeFlags(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .slice(0, MAX_FLAG_COUNT)
    .map((item) => safeString(item, 120))
    .filter((item): item is string => item !== null && allowed.has(item)))];
}

function flagsAreAllowed(value: unknown, allowed: ReadonlySet<string>) {
  return Array.isArray(value) &&
    value.length <= MAX_FLAG_COUNT &&
    value.every((flag) => typeof flag === "string" && allowed.has(flag));
}

function sameId(actual: unknown, expected: string | null) {
  if (!expected) return true;
  return safeId(actual) === expected;
}

function findPlan(root: JsonRecord, planId: string): JsonRecord | null {
  const candidates = [root.plan, ...(Array.isArray(root.planHistory) ? root.planHistory : [])];
  return candidates.find((candidate): candidate is JsonRecord => isRecord(candidate) && candidate.planId === planId) || null;
}

function planTaskById(plan: JsonRecord, taskId: string): JsonRecord | null {
  if (!Array.isArray(plan.days)) return null;
  for (const day of plan.days) {
    if (!isRecord(day) || !Array.isArray(day.tasks)) continue;
    const task = day.tasks.find((candidate): candidate is JsonRecord => isRecord(candidate) && candidate.taskId === taskId);
    if (task) return task;
  }
  return null;
}

function diagnosticEvidenceValid(diagnostic: JsonRecord) {
  if (!Array.isArray(diagnostic.taskEvidence) || diagnostic.taskEvidence.length !== 6) return false;
  const seen = new Set<string>();
  for (const item of diagnostic.taskEvidence) {
    if (!isRecord(item)) return false;
    const taskId = safeId(item.taskId);
    if (!taskId || seen.has(taskId) || !Object.hasOwn(DIAGNOSTIC_TASK_MANIFEST, taskId)) return false;
    seen.add(taskId);
    const expected = DIAGNOSTIC_TASK_MANIFEST[taskId as keyof typeof DIAGNOSTIC_TASK_MANIFEST];
    if (!Object.entries(expected).every(([key, value]) => item[key] === value)) return false;
    if (!["completed", "skipped", "evidence_insufficient", "unavailable"].includes(String(item.status))) return false;
    if (!["evidence_limited", "evidence_insufficient"].includes(String(item.evidenceStatus))) return false;
    if (!flagsAreAllowed(item.qualityFlags, DIAGNOSTIC_QUALITY_FLAGS)) return false;
    if (["single_choice", "single_choice_audio"].includes(expected.responseType) && item.status === "completed") {
      if (item.attempts !== 1 || !["a", "b", "c"].includes(String(item.firstResponse))) return false;
      if (!["first_response_matched", "first_response_not_matched"].includes(String(item.resultType))) return false;
    }
  }
  return seen.size === DIAGNOSTIC_TASK_IDS.length && DIAGNOSTIC_TASK_IDS.every((taskId) => seen.has(taskId));
}

function deriveRetestBoundary(retest: JsonRecord) {
  const skill = safeSkill(retest.skill);
  if (skill === "Unknown" || skill === "Balanced") return null;
  const catalog = RETEST_TASK_CATALOG[skill];
  const evidence = isRecord(retest.evidence) ? retest.evidence : null;
  if (!evidence || evidence.responseType !== catalog.responseType) return null;
  let resultType: string;
  let audioEvidenceInsufficient = false;
  if (catalog.responseType === "single_choice") {
    if (!["a", "b", "c"].includes(String(evidence.selectedAnswer))) return null;
    resultType = evidence.selectedAnswer === catalog.correctValue ? "single_task_correct" : "single_task_needs_review";
    if (skill === "Listening") {
      if (
        typeof evidence.audioPlayed !== "boolean" ||
        typeof evidence.audioCompleted !== "boolean" ||
        !Number.isInteger(evidence.playCount) ||
        Number(evidence.playCount) < 0 ||
        typeof evidence.transcriptUsed !== "boolean" ||
        typeof evidence.seekDetected !== "boolean" ||
        typeof evidence.playbackFailed !== "boolean" ||
        evidence.audioPlayed !== (Number(evidence.playCount) >= 1)
      ) return null;
      audioEvidenceInsufficient =
        evidence.audioPlayed !== true ||
        evidence.audioCompleted !== true ||
        evidence.transcriptUsed === true ||
        evidence.seekDetected === true ||
        evidence.playbackFailed === true;
    }
  } else if (catalog.responseType === "self_reviewed_writing") {
    if (!Number.isInteger(evidence.wordCount) || Number(evidence.wordCount) < catalog.minimumWordCount || evidence.selfChecksComplete !== true) return null;
    resultType = "task_completed_no_score";
  } else {
    if (evidence.selfChecksComplete !== true || evidence.audioRecorded !== false) return null;
    resultType = "task_completed_no_score";
  }
  const humanReviewRequired = skill === "Writing" || skill === "Speaking" || resultType === "single_task_needs_review" || audioEvidenceInsufficient;
  return {
    catalog,
    resultType,
    evidenceStatus: audioEvidenceInsufficient
      ? "evidence_insufficient"
      : resultType === "single_task_needs_review"
        ? "needs_review"
        : "limited_single_task",
    evidenceSufficiency: audioEvidenceInsufficient
      ? "insufficient_audio_conditions"
      : "limited_unreviewed_same_skill_task",
    humanConfirmationStatus: humanReviewRequired ? "required_not_completed" : "not_required_for_gate_a_flow",
    humanReviewRequired,
  };
}

function practiceEvidenceValid(receipt: JsonRecord, catalog: (typeof PRACTICE_ACTIVITY_CATALOG)[keyof typeof PRACTICE_ACTIVITY_CATALOG]) {
  const evidence = isRecord(receipt.evidence) ? receipt.evidence : null;
  if (!evidence) return false;
  if (catalog.receiptEvidenceClass === "objective_response" || catalog.receiptEvidenceClass === "audio_objective_response") {
    if (!("correctValue" in catalog)) return false;
    const choiceValid =
      ["a", "b", "c"].includes(String(evidence.firstResponse)) &&
      ["a", "b", "c"].includes(String(evidence.finalResponse)) &&
      evidence.finalResponse === catalog.correctValue &&
      Number.isInteger(evidence.attemptCount) &&
      Number(evidence.attemptCount) >= 1 &&
      evidence.attemptCount === receipt.attemptCount &&
      evidence.resultType === "correct" &&
      (Number(evidence.attemptCount) > 1) === (receipt.qualityFlags as unknown[]).includes("multiple_attempts");
    if (!choiceValid) return false;
    if (catalog.receiptEvidenceClass === "objective_response") return receipt.evidenceStatus === "evidence_limited";
    const audioFlags = ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "transcript_used"];
    const qualityFlags = receipt.qualityFlags as unknown[];
    const audioSufficient =
      evidence.audioPlayed === true &&
      evidence.audioCompleted === true &&
      Number.isInteger(evidence.playCount) &&
      Number(evidence.playCount) >= 1 &&
      evidence.transcriptUsed === false &&
      evidence.seekDetected === false &&
      evidence.playbackFailed === false &&
      !qualityFlags.some((flag) => typeof flag === "string" && audioFlags.includes(flag));
    return Boolean(
      evidence.audioPlayed === receipt.audioPlayed &&
      evidence.audioCompleted === receipt.audioCompleted &&
      evidence.transcriptUsed === qualityFlags.includes("transcript_used") &&
      evidence.seekDetected === qualityFlags.includes("audio_seek_detected") &&
      evidence.playbackFailed === qualityFlags.includes("audio_playback_failed") &&
      receipt.evidenceStatus === (audioSufficient ? "evidence_limited" : "evidence_insufficient")
    );
  }
  if (catalog.receiptEvidenceClass === "self_reviewed_artifact") {
    if (!("minimumWords" in catalog)) return false;
    const selfChecks = isRecord(evidence.selfChecks) ? evidence.selfChecks : null;
    return Boolean(
      Number.isInteger(evidence.wordCount) &&
      Number(evidence.wordCount) >= catalog.minimumWords &&
      evidence.wordCount === receipt.wordCount &&
      selfChecks?.idea === true &&
      selfChecks.reason === true &&
      selfChecks.edit === true &&
      evidence.selfCheckCount === 3 &&
      evidence.selfCheckCount === receipt.selfCheckCount &&
      /^[0-9a-f]{64}$/.test(String(evidence.artifactHash || "")) &&
      evidence.resultType === "completed_no_score" &&
      receipt.evidenceStatus === "evidence_limited" &&
      (receipt.qualityFlags as unknown[]).includes("open_response_not_human_reviewed")
    );
  }
  if (!("prepSeconds" in catalog) || !("responseSeconds" in catalog)) return false;
  const selfChecks = isRecord(evidence.selfChecks) ? evidence.selfChecks : null;
  return Boolean(
    evidence.prepSeconds === catalog.prepSeconds &&
    evidence.responseSeconds === catalog.responseSeconds &&
    evidence.timerCompleted === true &&
    selfChecks?.answer === true &&
    selfChecks.example === true &&
    selfChecks.flow === true &&
    evidence.selfCheckCount === 3 &&
    evidence.selfCheckCount === receipt.selfCheckCount &&
    evidence.audioRecorded === false &&
    receipt.audioRecorded === false &&
    evidence.resultType === "completed_no_score" &&
    receipt.evidenceStatus === "evidence_limited" &&
    (receipt.qualityFlags as unknown[]).includes("audio_not_recorded") &&
    (receipt.qualityFlags as unknown[]).includes("open_response_not_human_reviewed")
  );
}

function currentProvisionalCycle(journey: JsonRecord, activeCycle: JsonRecord): JsonRecord | null {
  if (!Array.isArray(journey.history)) return null;
  const matching = journey.history.filter((entry): entry is JsonRecord =>
    isRecord(entry) &&
    ACTIVE_CYCLE_BINDING_FIELDS.every((field) => entry[field] === activeCycle[field]),
  );
  return matching.length === 1 ? matching[0] : null;
}

function diagnosticSummary(value: unknown): TeachingReviewEvidenceSnapshot["diagnostic"] {
  if (!isRecord(value)) return null;
  const taskEvidence = Array.isArray(value.taskEvidence) ? value.taskEvidence : [];
  if (taskEvidence.length > 12) return null;
  const tasks = taskEvidence.flatMap((entry): DiagnosticTaskSummary[] => {
    if (!isRecord(entry)) return [];
    const taskId = safeId(entry.taskId);
    const status = safeString(entry.status, 80);
    const evidenceStatus = safeString(entry.evidenceStatus, 80);
    if (!taskId || !status || !evidenceStatus) return [];
    return [{
      taskId,
      skill: safeSkill(entry.skill),
      status,
      evidenceStatus,
      resultType: ["single_choice", "single_choice_audio"].includes(String(entry.responseType))
        ? (["first_response_matched", "first_response_not_matched"].includes(String(entry.resultType)) ? String(entry.resultType) : null)
        : entry.status === "completed"
          ? "task_completed_no_score"
          : null,
      constructTag: DIAGNOSTIC_TASK_MANIFEST[taskId as keyof typeof DIAGNOSTIC_TASK_MANIFEST]?.constructTag || null,
      qualityFlags: safeFlags(entry.qualityFlags, DIAGNOSTIC_QUALITY_FLAGS),
    }];
  });
  return {
    status: "completed",
    prioritySkill: safeSkill(value.prioritySkill),
    priorityBasis: DIAGNOSTIC_PRIORITY_BASES.includes(value.priorityBasis as (typeof DIAGNOSTIC_PRIORITY_BASES)[number])
      ? String(value.priorityBasis)
      : null,
    evidenceSufficiency: ["evidence_limited", "evidence_insufficient"].includes(String(value.evidenceSufficiency))
      ? String(value.evidenceSufficiency)
      : null,
    confidence: ["medium", "low"].includes(String(value.evidenceConfidence)) ? String(value.evidenceConfidence) : null,
    taskSetVersion: DIAGNOSTIC_TASK_SET_VERSION,
    taskSetDigest: DIAGNOSTIC_TASK_SET_DIGEST,
    learnerConfirmedPriority: value.learnerConfirmedPriority === true,
    automatedScoreProduced: value.automatedScoreProduced === true,
    formalDiagnosisProduced: value.formalDiagnosisProduced === true,
    tasks,
  };
}

function recommendationSummary(value: unknown): TeachingReviewEvidenceSnapshot["recommendation"] {
  if (!isRecord(value)) return null;
  const primary = isRecord(value.primary) ? value.primary : null;
  const skill = safeSkill(primary?.skill);
  return {
    status: value.status === "accepted" ? "accepted" : "skipped",
    primaryTaskId: safeId(primary?.taskId),
    primarySkill: skill,
    primaryTitle: skill === "Unknown" ? null : `${skill} · Gate A 原创练习`,
    reason: "该任务与当前优先技能、冻结内容版本和本轮诊断证据绑定；原始推荐文字在本演示视图中隐藏。",
    reviewStatus: "gate_a_unreviewed",
    teacherReviewed: false,
  };
}

function retestSummary(value: unknown): TeachingReviewEvidenceSnapshot["retest"] {
  if (!isRecord(value)) return null;
  const boundary = deriveRetestBoundary(value);
  if (!boundary) return null;
  return {
    status: "completed",
    skill: safeSkill(value.skill),
    evidenceStatus: boundary.evidenceStatus,
    evidenceSufficiency: boundary.evidenceSufficiency,
    resultType: boundary.resultType,
    humanConfirmationStatus: boundary.humanConfirmationStatus,
    teacherReviewed: false,
    measurementReviewed: false,
    officialEquivalenceClaimed: false,
    automatedScoreProduced: false,
    growthClaimProduced: false,
  };
}

export function deriveTeachingReviewEvidence(raw: string | null): TeachingReviewEvidenceResult {
  if (!raw) return { status: "empty" };
  if (raw.length > MAX_CANONICAL_BYTES) return { status: "invalid", reason: "canonical_payload_too_large" };

  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "canonical_json_invalid" };
  }

  if (!isRecord(root) || root.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    return { status: "invalid", reason: "canonical_schema_unrecognized" };
  }
  const sourceUpdatedAt = safeIsoDate(root.updatedAt);
  const journey = isRecord(root.journey) ? root.journey : null;
  if (!journey || journey.protocolVersion !== JOURNEY_PROTOCOL_VERSION) {
    return { status: "invalid", reason: "journey_protocol_unrecognized" };
  }
  if (!Array.isArray(journey.history) || (journey.activeCycle !== null && !isRecord(journey.activeCycle))) {
    return { status: "invalid", reason: "journey_state_unrecognized" };
  }
  const activeCycle = isRecord(journey.activeCycle) ? journey.activeCycle : null;
  if (!activeCycle) return { status: "no_active_cycle", sourceUpdatedAt };
  if (
    activeCycle.protocolVersion !== JOURNEY_PROTOCOL_VERSION ||
    activeCycle.status !== "provisional_pending_human_review" ||
    activeCycle.closedAt !== null
  ) {
    return { status: "no_provisional_cycle", sourceUpdatedAt };
  }
  const activeProvisionalAt = safeIsoDate(activeCycle.provisionalAt);
  if (!activeProvisionalAt) {
    return { status: "invalid", reason: "active_cycle_provisional_timestamp_invalid" };
  }
  const cycle = currentProvisionalCycle(journey, activeCycle);
  if (!cycle) return { status: "invalid", reason: "active_cycle_history_mismatch" };
  const historyProvisionalAt = safeIsoDate(cycle.provisionalAt);
  if (
    !historyProvisionalAt ||
    cycle.provisionalAt !== activeCycle.provisionalAt ||
    historyProvisionalAt !== activeProvisionalAt
  ) {
    return { status: "invalid", reason: "active_cycle_history_provisional_timestamp_mismatch" };
  }
  const cycleId = safeId(cycle.cycleId);
  if (!cycleId) return { status: "invalid", reason: "cycle_id_invalid" };

  const diagnostic = isRecord(cycle.diagnostic) ? cycle.diagnostic : null;
  const recommendation = isRecord(cycle.recommendation) ? cycle.recommendation : null;
  const checkIn = isRecord(cycle.checkIn) ? cycle.checkIn : null;
  const review = isRecord(cycle.review) ? cycle.review : null;
  const retest = isRecord(cycle.retest) ? cycle.retest : null;
  const planUpdate = isRecord(cycle.planUpdate) ? cycle.planUpdate : null;
  const peerHelp = isRecord(cycle.peerHelp) ? cycle.peerHelp : null;
  const diagnosticSessionId = safeId(cycle.diagnosticSessionId);
  const basePlanId = safeId(cycle.basePlanId);
  const recommendationId = safeId(cycle.recommendationId);
  const checkInId = safeId(cycle.checkInId);
  const reviewId = safeId(cycle.reviewId);
  const peerHelpId = safeId(cycle.peerHelpId);
  const retestId = safeId(cycle.retestId);
  const updatedPlanId = safeId(cycle.updatedPlanId);
  const provisionalAt = historyProvisionalAt;

  if (
    !diagnosticSessionId ||
    !basePlanId ||
    !recommendationId ||
    !checkInId ||
    !reviewId ||
    !peerHelpId ||
    !retestId ||
    !updatedPlanId ||
    !provisionalAt ||
    !diagnostic ||
    !recommendation ||
    !checkIn ||
    !review ||
    !retest ||
    !planUpdate ||
    !peerHelp
  ) {
    return { status: "invalid", reason: "provisional_evidence_chain_incomplete" };
  }

  const basePlan = findPlan(root, basePlanId);
  const updatedPlan = findPlan(root, updatedPlanId);
  const primary = isRecord(recommendation.primary) ? recommendation.primary : null;
  const binding = isRecord(recommendation.evidenceBinding) ? recommendation.evidenceBinding : null;
  const primaryTaskId = safeId(primary?.taskId);
  const linkedTaskId = safeId(checkIn.linkedTaskId);
  const basePrimaryTask = primaryTaskId && basePlan ? planTaskById(basePlan, primaryTaskId) : null;
  const linkedTask = linkedTaskId && basePlan ? planTaskById(basePlan, linkedTaskId) : null;
  const basePrimaryTaskContentRef = basePrimaryTask && isRecord(basePrimaryTask.contentRef) ? basePrimaryTask.contentRef : null;
  const baseProvenance = basePlan && isRecord(basePlan.provenance) ? basePlan.provenance : null;
  const updatedProvenance = updatedPlan && isRecord(updatedPlan.provenance) ? updatedPlan.provenance : null;
  const bindingPrerequisites = binding && Array.isArray(binding.prerequisites) ? binding.prerequisites : null;
  if (
    diagnostic.protocolVersion !== JOURNEY_PROTOCOL_VERSION ||
    diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
    diagnostic.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
    diagnostic.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
    diagnostic.adultConfirmed !== true ||
    !isRecord(diagnostic.devicePrecheck) ||
    diagnostic.devicePrecheck.storageStatus !== "available" ||
    safeSkill(diagnostic.prioritySkill) === "Unknown" ||
    diagnostic.prioritySkill === "Balanced" ||
    !DIAGNOSTIC_PRIORITY_BASES.includes(diagnostic.priorityBasis as (typeof DIAGNOSTIC_PRIORITY_BASES)[number]) ||
    !["evidence_limited", "evidence_insufficient"].includes(String(diagnostic.evidenceSufficiency)) ||
    !["medium", "low"].includes(String(diagnostic.evidenceConfidence)) ||
    !diagnosticEvidenceValid(diagnostic) ||
    !basePlan ||
    !updatedPlan ||
    !baseProvenance ||
    !updatedProvenance ||
    baseProvenance.cycleId !== cycleId ||
    baseProvenance.diagnosticSessionId !== diagnosticSessionId ||
    baseProvenance.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
    baseProvenance.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
    updatedProvenance.cycleId !== cycleId ||
    updatedProvenance.diagnosticSessionId !== diagnosticSessionId ||
    updatedProvenance.retestId !== retestId ||
    updatedProvenance.supersedesPlanId !== basePlanId ||
    updatedProvenance.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
    updatedProvenance.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
    !primary ||
    !primaryTaskId ||
    !basePrimaryTask ||
    !safeString(primary.title, 240) ||
    !safeString(primary.reason, MAX_SUMMARY_LENGTH) ||
    primary.skill !== diagnostic.prioritySkill ||
    primary.reviewStatus !== "gate_a_unreviewed" ||
    primary.reviewedAt !== null ||
    primary.teacherReviewed !== undefined ||
    basePrimaryTask.skill !== diagnostic.prioritySkill ||
    !basePrimaryTaskContentRef ||
    !binding ||
    !safeId(binding.bindingId)?.startsWith("recommendation-binding-") ||
    !safeIsoDate(binding.createdAt) ||
    binding.cycleId !== cycleId ||
    binding.diagnosticSessionId !== diagnosticSessionId ||
    binding.practiceTaskId !== primaryTaskId ||
    binding.exerciseId !== basePrimaryTaskContentRef.exerciseId ||
    binding.contentId !== basePrimaryTaskContentRef.contentId ||
    binding.contentVersion !== basePrimaryTaskContentRef.contentVersion ||
    binding.contentHash !== basePrimaryTaskContentRef.contentHash ||
    binding.bindingReason !== primary.reason ||
    binding.reviewStatus !== "gate_a_unreviewed" ||
    binding.reviewedAt !== null ||
    binding.videoTimestamp !== null ||
    binding.sourceClass !== "first_party_original_gate_a" ||
    binding.teacherReviewed !== false ||
    binding.measurementReviewed !== false ||
    !Array.isArray(binding.diagnosticEvidenceTaskIds) ||
    binding.diagnosticEvidenceTaskIds.length === 0 ||
    !binding.diagnosticEvidenceTaskIds.every((taskId) => typeof taskId === "string" && Object.hasOwn(DIAGNOSTIC_TASK_MANIFEST, taskId)) ||
    !Array.isArray(binding.errorPatternIds) ||
    binding.errorPatternIds.length === 0 ||
    !binding.errorPatternIds.every((item) => typeof item === "string" && item.length > 0) ||
    !flagsAreAllowed(binding.diagnosticQualityFlags, DIAGNOSTIC_QUALITY_FLAGS) ||
    !bindingPrerequisites ||
    !["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"].every((item) => bindingPrerequisites.includes(item)) ||
    !linkedTaskId ||
    !linkedTask
  ) {
    return { status: "invalid", reason: "canonical_binding_or_plan_rejected" };
  }

  if (
    !sameId(diagnostic.cycleId, cycleId) ||
    !sameId(diagnostic.diagnosticSessionId, diagnosticSessionId) ||
    !sameId(recommendation.cycleId, cycleId) ||
    !sameId(recommendation.diagnosticSessionId, diagnosticSessionId) ||
    !sameId(recommendation.recommendationId, recommendationId) ||
    !sameId(recommendation.planId, basePlanId) ||
    !sameId(checkIn.cycleId, cycleId) ||
    !sameId(checkIn.diagnosticSessionId, diagnosticSessionId) ||
    !sameId(checkIn.checkInId, checkInId) ||
    !sameId(checkIn.planId, basePlanId) ||
    !sameId(checkIn.recommendationId, recommendationId) ||
    !sameId(review.cycleId, cycleId) ||
    !sameId(review.reviewId, reviewId) ||
    !sameId(review.checkInId, checkInId) ||
    !sameId(peerHelp.cycleId, cycleId) ||
    !sameId(peerHelp.peerHelpId, peerHelpId) ||
    !sameId(peerHelp.planId, basePlanId) ||
    !sameId(peerHelp.reviewId, reviewId) ||
    !sameId(retest.cycleId, cycleId) ||
    !sameId(retest.diagnosticSessionId, diagnosticSessionId) ||
    !sameId(retest.retestId, retestId) ||
    !sameId(retest.planId, basePlanId) ||
    !sameId(retest.recommendationId, recommendationId) ||
    !sameId(retest.checkInId, checkInId) ||
    !sameId(retest.reviewId, reviewId) ||
    !sameId(retest.peerHelpId, peerHelpId) ||
    !sameId(planUpdate.cycleId, cycleId) ||
    !sameId(planUpdate.retestId, retestId) ||
    !sameId(planUpdate.supersedesPlanId, basePlanId) ||
    !sameId(planUpdate.updatedPlanId, updatedPlanId)
  ) {
    return { status: "invalid", reason: "cross_cycle_evidence_rejected" };
  }

  const comparability = isRecord(retest.comparability) ? retest.comparability : null;
  if (
    diagnostic.status !== "completed" ||
    diagnostic.learnerConfirmedPriority !== true ||
    diagnostic.automatedScoreProduced !== false ||
    diagnostic.formalDiagnosisProduced !== false ||
    !["accepted", "skipped"].includes(String(recommendation.status)) ||
    checkIn.status !== "saved" ||
    checkIn.learnerConfirmedReview !== true ||
    checkIn.reviewId !== reviewId ||
    review.learnerConfirmed !== true ||
    !VALID_PEER_HELP_STATES.includes(peerHelp.status as (typeof VALID_PEER_HELP_STATES)[number]) ||
    peerHelp.realCommunityUsed !== false ||
    retest.status !== "completed" ||
    retest.humanConfirmationStatus !== "required_not_completed" ||
    retest.automatedScoreProduced !== false ||
    retest.growthClaimProduced !== false ||
    !comparability ||
    comparability.teacherReviewed !== false ||
    comparability.measurementReviewed !== false ||
    comparability.officialEquivalenceClaimed !== false ||
    planUpdate.learnerConfirmed !== true ||
    planUpdate.automatedAbilityDecision !== false ||
    planUpdate.confirmationClass !== "provisional_pending_human_review" ||
    planUpdate.humanConfirmationStatus !== "required_not_completed"
  ) {
    return { status: "invalid", reason: "provisional_human_review_boundary_rejected" };
  }

  const receiptId = safeId(checkIn?.taskCompletionReceiptId);
  const receipts = isRecord(root.practiceReceipts) ? root.practiceReceipts : {};
  const receipt = receiptId && Object.hasOwn(receipts, receiptId) && isRecord(receipts[receiptId]) ? receipts[receiptId] : null;
  const checkInReceipt = isRecord(checkIn.practiceReceipt) ? checkIn.practiceReceipt : null;
  const practiceCatalog = receipt && typeof receipt.exerciseId === "string" && Object.hasOwn(PRACTICE_ACTIVITY_CATALOG, receipt.exerciseId)
    ? PRACTICE_ACTIVITY_CATALOG[receipt.exerciseId as keyof typeof PRACTICE_ACTIVITY_CATALOG]
    : null;
  const receiptTaskRef = receipt && isRecord(receipt.taskRef) ? receipt.taskRef : null;
  const receiptContentRef = receipt && isRecord(receipt.contentRef) ? receipt.contentRef : null;
  const linkedTaskContentRef = linkedTask && isRecord(linkedTask.contentRef) ? linkedTask.contentRef : null;
  const taskProgressRoot = isRecord(root.taskProgress) ? root.taskProgress : null;
  const linkedTaskProgress = taskProgressRoot && linkedTaskId && Object.hasOwn(taskProgressRoot, linkedTaskId) && isRecord(taskProgressRoot[linkedTaskId])
    ? taskProgressRoot[linkedTaskId]
    : null;
  if (
    !receiptId ||
    !receipt ||
    !checkInReceipt ||
    JSON.stringify(checkInReceipt) !== JSON.stringify(receipt) ||
    receipt.protocolVersion !== PRACTICE_RECEIPT_VERSION ||
    !UUID_V4_PATTERN.test(String(receipt.practiceAttemptId || "")) ||
    !UUID_V4_PATTERN.test(String(receipt.completionReceiptId || "")) ||
    receipt.completionReceiptId !== receiptId ||
    receipt.status !== "completed" ||
    receipt.sealed !== true ||
    receipt.ownerScope !== "browser_local_not_account_bound" ||
    receipt.integrityClass !== "unsigned_local_receipt" ||
    receipt.completionSource !== "guided_practice" ||
    receipt.evidenceClass !== "practice_receipt" ||
    receipt.evidenceStatus !== "evidence_limited" ||
    !practiceCatalog ||
    receipt.activityId !== practiceCatalog.activityId ||
    receipt.activityVersion !== practiceCatalog.activityVersion ||
    receipt.contentId !== practiceCatalog.contentId ||
    receipt.contentHash !== practiceCatalog.contentHash ||
    receipt.skill !== practiceCatalog.skill ||
    receipt.route !== practiceCatalog.route ||
    receipt.receiptEvidenceClass !== practiceCatalog.receiptEvidenceClass ||
    receipt.evidenceType !== practiceCatalog.evidenceType ||
    receipt.completionCondition !== practiceCatalog.completionCondition ||
    !flagsAreAllowed(receipt.qualityFlags, PRACTICE_QUALITY_FLAGS) ||
    !practiceEvidenceValid(receipt, practiceCatalog) ||
    !safeIsoDate(receipt.completedAt) ||
    receipt.taskId !== linkedTaskId ||
    receipt.planId !== basePlanId ||
    receipt.recommendationId !== recommendationId ||
    receipt.skill !== diagnostic.prioritySkill ||
    linkedTask.skill !== diagnostic.prioritySkill ||
    typeof checkIn.didText !== "string" ||
    checkIn.didText.length < 10 ||
    typeof checkIn.evidenceText !== "string" ||
    checkIn.evidenceText.length < 10 ||
    !["none", "has_question"].includes(String(checkIn.questionStatus)) ||
    (checkIn.questionStatus === "has_question" && !safeString(checkIn.questionText, 2_000)) ||
    checkIn.evidenceClass !== "practice_receipt" ||
    checkIn.practiceAttemptId !== receipt.practiceAttemptId ||
    !linkedTaskProgress ||
    linkedTaskProgress.status !== "completed" ||
    linkedTaskProgress.selfReported !== false ||
    linkedTaskProgress.completionClass !== "practice_receipt" ||
    linkedTaskProgress.practiceReceiptId !== receiptId ||
    !receiptTaskRef ||
    receiptTaskRef.cycleId !== cycleId ||
    receiptTaskRef.diagnosticSessionId !== diagnosticSessionId ||
    receiptTaskRef.planId !== basePlanId ||
    receiptTaskRef.taskId !== linkedTaskId ||
    receiptTaskRef.taskDate !== linkedTask.date ||
    !receiptContentRef ||
    receiptContentRef.exerciseId !== receipt.exerciseId ||
    receiptContentRef.contentId !== practiceCatalog.contentId ||
    receiptContentRef.contentVersion !== practiceCatalog.activityVersion ||
    receiptContentRef.contentHash !== practiceCatalog.contentHash ||
    !linkedTaskContentRef ||
    linkedTaskContentRef.exerciseId !== receipt.exerciseId ||
    linkedTaskContentRef.contentId !== practiceCatalog.contentId ||
    linkedTaskContentRef.contentVersion !== practiceCatalog.activityVersion ||
    linkedTaskContentRef.contentHash !== practiceCatalog.contentHash ||
    (recommendation.status === "accepted" && linkedTaskId !== primaryTaskId) ||
    (recommendation.status === "skipped" && linkedTaskId === primaryTaskId) ||
    receipt.automatedScoreProduced !== false ||
    receipt.formalDiagnosisProduced !== false ||
    receipt.officialEquivalenceClaimed !== false
  ) {
    return { status: "invalid", reason: "practice_receipt_boundary_rejected" };
  }
  if (receipt && (!sameId(receipt.cycleId, cycleId) || !sameId(receipt.diagnosticSessionId, diagnosticSessionId))) {
    return { status: "invalid", reason: "cross_cycle_practice_receipt_rejected" };
  }

  const retestBoundary = deriveRetestBoundary(retest);
  if (
    !retestBoundary ||
    retestBoundary.humanReviewRequired !== true ||
    retest.parallelTaskId !== retestBoundary.catalog.taskId ||
    retest.taskVersion !== retestBoundary.catalog.taskVersion ||
    retest.parallelFormPairId !== retestBoundary.catalog.parallelFormPairId ||
    retest.parallelRetest !== true ||
    retest.baselineTaskId !== linkedTaskId ||
    retest.baselinePracticeReceiptId !== receiptId ||
    retest.skill !== diagnostic.prioritySkill ||
    retest.evidenceStatus !== retestBoundary.evidenceStatus ||
    retest.evidenceSufficiency !== retestBoundary.evidenceSufficiency ||
    retest.humanConfirmationStatus !== retestBoundary.humanConfirmationStatus ||
    !comparability ||
    comparability.targetSkill !== diagnostic.prioritySkill ||
    comparability.sameSkill !== true ||
    comparability.sameAsDiagnosticPriority !== true ||
    comparability.sameAsPlanTask !== true ||
    comparability.sameAsPracticeReceipt !== true ||
    comparability.newOriginalPrompt !== true ||
    comparability.constructAlignment !== retestBoundary.catalog.constructAlignment ||
    comparability.comparisonBoundary !== "same_skill_only_no_calibrated_construct_or_difficulty_equivalence" ||
    updatedPlan.focusSkill !== planUpdate.focusSkill ||
    updatedPlan.planId !== updatedPlanId
  ) {
    return { status: "invalid", reason: "retest_or_plan_update_boundary_rejected" };
  }

  const projectedDiagnostic = diagnosticSummary(diagnostic);
  const projectedRecommendation = recommendationSummary(recommendation);
  const projectedRetest = retestSummary(retest);
  if (!projectedDiagnostic || projectedDiagnostic.tasks.length !== 6 || !projectedRecommendation || !projectedRetest) {
    return { status: "invalid", reason: "evidence_projection_incomplete" };
  }

  return {
    status: "ready",
    sourceStorageKey: CANONICAL_LEARNER_STORAGE_KEY,
    sourceReadMode: "read_only",
    sourceUpdatedAt,
    integrityClass: "shape_checked_local_evidence_not_cryptographically_verified",
    identityVerified: false,
    qualifiedHumanConfirmation: false,
    canonicalLedgerWriteAllowed: false,
    cycleClosureAllowed: false,
    cycle: {
      cycleId,
      status: "provisional_pending_human_review",
      provisionalAt,
      closedAt: null,
      diagnosticSessionId,
      basePlanId,
      recommendationId,
      retestId,
      updatedPlanId,
    },
    diagnostic: projectedDiagnostic,
    recommendation: projectedRecommendation,
    practice: {
      checkInId: safeId(checkIn.checkInId),
      learnerConfirmedReview: checkIn.learnerConfirmedReview === true,
      evidenceClass: safeString(checkIn.evidenceClass, 120),
      linkedTaskId: safeId(checkIn.linkedTaskId),
      completionReceiptId: receiptId,
      receiptFound: Boolean(receipt),
      receiptStatus: safeString(receipt?.status, 80),
      receiptEvidenceStatus: safeString(receipt?.evidenceStatus, 80),
      receiptIntegrityClass: safeString(receipt?.integrityClass, 120),
      qualityFlags: safeFlags(receipt?.qualityFlags, PRACTICE_QUALITY_FLAGS),
      learnerNarrativeWithheld: true,
    },
    peerHelp: {
      status: safeString(peerHelp.status, 80) || "unknown",
      realCommunityUsed: false,
    },
    retest: projectedRetest,
    planUpdate: {
      focusSkill: safeSkill(planUpdate.focusSkill),
      confirmationClass: safeString(planUpdate.confirmationClass, 120),
      humanConfirmationStatus: safeString(planUpdate.humanConfirmationStatus, 120),
      learnerConfirmed: planUpdate.learnerConfirmed === true,
      provisional:
        planUpdate.confirmationClass === "provisional_pending_human_review" ||
        safeString(cycle.status, 120) === "provisional_pending_human_review",
    },
  };
}

export function parseTeachingReviewDraft(raw: string | null): TeachingReviewDraft | null {
  const inspection = inspectTeachingReviewDraft(raw);
  return inspection.status === "ready" ? inspection.draft : null;
}

export function inspectTeachingReviewDraft(raw: string | null): TeachingReviewDraftInspection {
  if (raw === null) return { status: "empty" };
  if (raw.length > 20_000) return { status: "invalid" };
  try {
    return { status: "ready", draft: teachingReviewDraftSchema.parse(JSON.parse(raw)) };
  } catch {
    return { status: "invalid" };
  }
}

export function createTeachingReviewDraft({
  snapshot,
  focusSkill,
  rationale,
  category,
  escalationNote,
  sourceSnapshotSha256,
  draftId,
  revision,
  createdAt,
  savedAt,
}: {
  snapshot: TeachingReviewEvidenceSnapshot;
  focusSkill: TeachingReviewSkill;
  rationale: string;
  category: TeachingReviewEscalationCategory;
  escalationNote: string;
  sourceSnapshotSha256: string;
  draftId: string;
  revision: number;
  createdAt: string;
  savedAt: string;
}): TeachingReviewDraft {
  return teachingReviewDraftSchema.parse({
    protocolVersion: TEACHING_REVIEW_DEMO_PROTOCOL,
    draftId,
    revision,
    status: "local_demo_draft",
    cycleId: snapshot.cycle.cycleId,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    sourceSnapshotSha256,
    createdAt,
    savedAt,
    identityVerified: false,
    qualifiedHumanConfirmation: false,
    canonicalLedgerWrite: false,
    cycleClosureAttempted: false,
    recommendationDraft: {
      focusSkill,
      rationale,
    },
    escalationDraft: {
      category,
      note: escalationNote,
    },
  });
}

export function serializeTeachingReviewDraft(draft: TeachingReviewDraft) {
  return JSON.stringify(teachingReviewDraftSchema.parse(draft));
}

export const teachingReviewDemoOptions = Object.freeze({
  skills: VALID_SKILLS,
  escalationCategories: ESCALATION_CATEGORIES,
});
