import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

import {
  CANONICAL_LEARNER_STORAGE_KEY,
  TEACHING_REVIEW_DEMO_STORAGE_KEY,
  createTeachingReviewDraft,
  deriveTeachingReviewEvidence,
  inspectTeachingReviewDraft,
  parseTeachingReviewDraft,
  serializeTeachingReviewDraft,
} from "../lib/teaching-review-demo";
import {
  PROVISIONAL_HANDOFF_PROTOCOL,
  buildProvisionalHandoffCopyText,
  canonicalUtcMillisecondTimestampSchema,
  createProvisionalHandoffPacket,
  deriveProvisionalHandoffEvidence,
  findMatchingProvisionalHandoffPacket,
  packetMatchesProvisionalEvidence,
  parseProvisionalHandoffPacket,
  provisionalHandoffEvidenceSchema,
  provisionalHandoffPacketSchema,
  serializeProvisionalHandoffPacket,
  sha256Hex,
} from "../lib/super-teacher/provisional-handoff";
import {
  SUPER_TEACHER_CHAT_KEY,
  commitProvisionalHandoffPacket,
  emptySession,
} from "../lib/super-teacher/client-session";
import { deriveLearnerContext } from "../lib/super-teacher/local-context";

type MutableRecord = Record<string, unknown>;

type ProductionLearningEventsRuntime = {
  appendDomainEvent(
    state: MutableRecord,
    eventType: string,
    domain: MutableRecord,
  ): Promise<MutableRecord>;
  validateProvisionalCycleLedger(
    state: MutableRecord,
    binding: MutableRecord,
  ): Promise<MutableRecord>;
  setNow(value: string): void;
};

const learningEventsSource = readFileSync(new URL("../learning-events.js", import.meta.url), "utf8");
const workspaceBackupSource = readFileSync(new URL("../workspace-backup.js", import.meta.url), "utf8");

function productionLearningEventsRuntime(): ProductionLearningEventsRuntime {
  const NativeDate = Date;
  let currentTime = NativeDate.parse(CREATED_AT);
  class ControlledDate extends NativeDate {
    constructor(value?: string | number) {
      super(value === undefined ? currentTime : value);
    }

    static now(): number {
      return currentTime;
    }
  }
  const sandbox: MutableRecord = {
    crypto: webcrypto,
    Date: ControlledDate,
    TextEncoder,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(workspaceBackupSource, context, { filename: "workspace-backup.js" });
  vm.runInContext(learningEventsSource, context, { filename: "learning-events.js" });
  const runtime = sandbox.SufeiyaLearningEvents as ProductionLearningEventsRuntime | undefined;
  assert.ok(runtime, "production learning-event runtime must be available");
  return {
    ...runtime,
    setNow(value: string) {
      const parsed = NativeDate.parse(value);
      assert.ok(Number.isFinite(parsed), `controlled event clock requires ISO time: ${value}`);
      currentTime = parsed;
    },
  };
}

function productionProvisionalValidator(runtime: ProductionLearningEventsRuntime) {
  return (state: unknown, binding: MutableRecord) =>
    runtime.validateProvisionalCycleLedger(state as MutableRecord, binding);
}

const PROTOCOL_VERSION = "gate_a_local_v1";
const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
const TASK_SET_VERSION = "gate_a_original_6_v1";
const TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
const CYCLE_ID = "cycle-msqhg76f-abc12";
const DIAGNOSTIC_SESSION_ID = "diagnostic-msqhg76g-bcd23";
const BASE_PLAN_ID = "plan-msqhg76h-cde34";
const RECOMMENDATION_ID = "recommendation-msqhg76i-def45";
const PRIMARY_TASK_ID = "plan-task-writing-2026-08-10-1";
const CHECK_IN_ID = "check-in-msqhg76j";
const REVIEW_ID = "review-msqhg76k-efg56";
const PEER_HELP_ID = "peer-help-msqhg76m-fgh67";
const RETEST_ID = "retest-msqhg76n-ghi78";
const UPDATED_PLAN_ID = "plan-msqhg76p-hij89";
const PRACTICE_ATTEMPT_ID = "123e4567-e89b-42d3-a456-426614174000";
const COMPLETION_RECEIPT_ID = "123e4567-e89b-42d3-a456-426614174001";
const CREATED_AT = "2026-08-10T12:00:00.000Z";
const COMPLETED_AT = "2026-08-10T12:30:00.000Z";
const PROVISIONAL_AT = "2026-08-10T13:00:00.000Z";
const WRITING_EXERCISE_ID = "writing-community-v1";
const WRITING_ACTIVITY_ID = "https://sufeiya.cn/activities/practice/writing-community/v1";
const WRITING_CONTENT_HASH = "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b";
const WRITING_REASON = "开放写作任务已完成，但结构与支持细节仍需要人工复核。";
const WRITING_PRIORITY_BASIS = "open_response_coverage_gap";

const diagnosticTaskManifest = [
  {
    taskId: "diagnostic-reading-library-v1",
    taskVersion: "v1",
    skill: "Reading",
    responseType: "single_choice",
    constructTag: "purpose_from_supporting_details",
    contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7",
    status: "completed",
    evidenceStatus: "evidence_limited",
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
    qualityFlags: [],
  },
  {
    taskId: "diagnostic-reading-newsletter-v1",
    taskVersion: "v1",
    skill: "Reading",
    responseType: "single_choice",
    constructTag: "cause_from_text_structure",
    contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca",
    status: "completed",
    evidenceStatus: "evidence_limited",
    attempts: 1,
    firstResponse: "a",
    resultType: "first_response_not_matched",
    qualityFlags: [],
  },
  {
    taskId: "diagnostic-listening-science-club-v1",
    taskVersion: "v1",
    skill: "Listening",
    responseType: "single_choice_audio",
    constructTag: "schedule_change_detail",
    contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308",
    status: "completed",
    evidenceStatus: "evidence_limited",
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
    qualityFlags: [],
  },
  {
    taskId: "diagnostic-listening-language-lab-v1",
    taskVersion: "v1",
    skill: "Listening",
    responseType: "single_choice_audio",
    constructTag: "time_and_location_integration",
    contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd",
    status: "completed",
    evidenceStatus: "evidence_limited",
    attempts: 1,
    firstResponse: "c",
    resultType: "first_response_matched",
    qualityFlags: [],
  },
  {
    taskId: "diagnostic-speaking-learning-skill-v1",
    taskVersion: "v1",
    skill: "Speaking",
    responseType: "timed_self_report",
    constructTag: "task_coverage_and_connected_thoughts_self_report",
    contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9",
    status: "completed",
    evidenceStatus: "evidence_insufficient",
    resultType: "task_completed_no_score",
    qualityFlags: ["audio_not_recorded", "open_response_not_human_reviewed"],
  },
  {
    taskId: "diagnostic-writing-learning-place-v1",
    taskVersion: "v1",
    skill: "Writing",
    responseType: "timed_local_text",
    constructTag: "task_response_structure_self_review",
    contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85",
    status: "completed",
    evidenceStatus: "evidence_insufficient",
    resultType: "task_completed_no_score",
    qualityFlags: ["open_response_not_human_reviewed"],
  },
];

const baseDates = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
];

const updatedDates = [
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
];

function writingContentRef() {
  return {
    exerciseId: WRITING_EXERCISE_ID,
    contentId: WRITING_EXERCISE_ID,
    contentVersion: "v1",
    contentHash: WRITING_CONTENT_HASH,
  };
}

function makeWritingPlan({
  planId,
  dates,
  primaryTaskId,
  provenance,
}: {
  planId: string;
  dates: string[];
  primaryTaskId: string;
  provenance: MutableRecord;
}) {
  return {
    planId,
    createdAt: CREATED_AT,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    status: "active",
    nickname: "Gate A 学习者",
    examDate: "",
    dailyMinutes: 30,
    focusSkill: "Writing",
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    provenance,
    days: dates.map((date, index) => ({
      dayNumber: index + 1,
      date,
      coreSkill: "Writing",
      tasks: [{
        taskId: index === 0 ? primaryTaskId : `${primaryTaskId}-day-${index + 1}`,
        date,
        skill: "Writing",
        titleZh: index === 0 ? "Writing：社区学习空间" : `Writing：第 ${index + 1} 天结构练习`,
        instructionZh: "完成原创英文写作提示，并使用三项英文自查。",
        durationMinutes: 12,
        route: "/practice-writing",
        contentRef: writingContentRef(),
      }],
    })),
  };
}

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordAt(root: unknown, ...keys: string[]): MutableRecord {
  let current = root;
  for (const key of keys) {
    if (!isRecord(current)) throw new TypeError(`Expected record before ${key}`);
    current = current[key];
  }
  if (!isRecord(current)) throw new TypeError(`Expected record at ${keys.join(".")}`);
  return current;
}

function provisionalHistoryCycle(root: MutableRecord): MutableRecord {
  const history = recordAt(root, "journey").history;
  if (!Array.isArray(history) || !isRecord(history[0])) throw new TypeError("Expected provisional history cycle");
  return history[0];
}

function activeCycle(root: MutableRecord): MutableRecord {
  return recordAt(root, "journey", "activeCycle");
}

function canonicalProvisionalFixture(): MutableRecord {
  const basePlan = makeWritingPlan({
    planId: BASE_PLAN_ID,
    dates: baseDates,
    primaryTaskId: PRIMARY_TASK_ID,
    provenance: {
      source: "diagnostic_gate_a_original_tasks",
      cycleId: CYCLE_ID,
      diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
      taskSetVersion: TASK_SET_VERSION,
      taskSetDigest: TASK_SET_DIGEST,
    },
  });
  const updatedPlan = makeWritingPlan({
    planId: UPDATED_PLAN_ID,
    dates: updatedDates,
    primaryTaskId: "plan-task-writing-2026-08-17-1",
    provenance: {
      source: "learner_selected_provisional_followup_pending_human_review",
      cycleId: CYCLE_ID,
      diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
      taskSetVersion: TASK_SET_VERSION,
      taskSetDigest: TASK_SET_DIGEST,
      retestId: RETEST_ID,
      supersedesPlanId: BASE_PLAN_ID,
    },
  });
  const diagnostic = {
    protocolVersion: PROTOCOL_VERSION,
    diagnosticProtocolVersion: DIAGNOSTIC_PROTOCOL_VERSION,
    taskSetVersion: TASK_SET_VERSION,
    taskSetDigest: TASK_SET_DIGEST,
    cycleId: CYCLE_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    status: "completed",
    adultConfirmed: true,
    devicePrecheck: { storageStatus: "available", audioStatus: "available" },
    prioritySkill: "Writing",
    priorityBasis: WRITING_PRIORITY_BASIS,
    learnerConfirmedPriority: true,
    completedEvidenceTaskCount: 6,
    completedEvidenceSkills: ["Reading", "Listening", "Speaking", "Writing"],
    evidenceSufficiency: "evidence_limited",
    evidenceConfidence: "medium",
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    report: {
      priorityExplanation: WRITING_REASON,
      priorityBasis: WRITING_PRIORITY_BASIS,
      evidenceSufficiency: "evidence_limited",
      confidence: "medium",
    },
    taskEvidence: structuredClone(diagnosticTaskManifest),
    completedAt: COMPLETED_AT,
    updatedAt: COMPLETED_AT,
  };
  const primary = {
    role: "主任务",
    taskId: PRIMARY_TASK_ID,
    skill: "Writing",
    exerciseId: WRITING_EXERCISE_ID,
    contentId: WRITING_EXERCISE_ID,
    contentVersion: "v1",
    contentHash: WRITING_CONTENT_HASH,
    title: "Writing：社区学习空间",
    route: `/practice-writing?plan_id=${BASE_PLAN_ID}&task_id=${PRIMARY_TASK_ID}`,
    reason: WRITING_REASON,
    duration: "12 分钟",
    source: "Sufeiya 原创 Gate A 微练习 v1 · 未经教研与测量双签",
    verification: "从本绑定入口完成任务并生成本机练习回执，再在复盘页引用同一回执。",
    reviewStatus: "gate_a_unreviewed",
    reviewedAt: null,
    prerequisites: ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"],
  };
  const recommendation = {
    recommendationId: RECOMMENDATION_ID,
    cycleId: CYCLE_ID,
    planId: BASE_PLAN_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    status: "accepted",
    itemCount: 3,
    primary,
    evidenceBinding: {
      bindingId: "recommendation-binding-2026-08-10-writing-1",
      cycleId: CYCLE_ID,
      diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
      errorPatternIds: ["task_response_structure_self_review", WRITING_PRIORITY_BASIS],
      diagnosticEvidenceTaskIds: ["diagnostic-writing-learning-place-v1"],
      diagnosticQualityFlags: ["open_response_not_human_reviewed"],
      practiceTaskId: PRIMARY_TASK_ID,
      exerciseId: WRITING_EXERCISE_ID,
      contentId: WRITING_EXERCISE_ID,
      contentVersion: "v1",
      contentHash: WRITING_CONTENT_HASH,
      bindingReason: WRITING_REASON,
      sourceClass: "first_party_original_gate_a",
      reviewStatus: "gate_a_unreviewed",
      reviewedAt: null,
      teacherReviewed: false,
      measurementReviewed: false,
      videoTimestamp: null,
      prerequisites: ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"],
      createdAt: COMPLETED_AT,
    },
    supplements: [],
    sourceMode: "frozen_local_routes_no_rag",
    learnerChoice: true,
    createdAt: COMPLETED_AT,
    updatedAt: COMPLETED_AT,
  };
  const practiceReceipt = {
    protocolVersion: "sufeiya_practice_receipt_v2",
    practiceAttemptId: PRACTICE_ATTEMPT_ID,
    completionReceiptId: COMPLETION_RECEIPT_ID,
    sealed: true,
    ownerScope: "browser_local_not_account_bound",
    integrityClass: "unsigned_local_receipt",
    activityId: WRITING_ACTIVITY_ID,
    activityVersion: "v1",
    exerciseId: WRITING_EXERCISE_ID,
    contentId: WRITING_EXERCISE_ID,
    contentHash: WRITING_CONTENT_HASH,
    skill: "Writing",
    route: "/practice-writing",
    taskId: PRIMARY_TASK_ID,
    taskDate: baseDates[0],
    planId: BASE_PLAN_ID,
    cycleId: CYCLE_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    recommendationId: RECOMMENDATION_ID,
    taskRef: {
      cycleId: CYCLE_ID,
      diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
      planId: BASE_PLAN_ID,
      taskId: PRIMARY_TASK_ID,
      taskDate: baseDates[0],
    },
    contentRef: writingContentRef(),
    status: "completed",
    completionSource: "guided_practice",
    evidenceClass: "practice_receipt",
    receiptEvidenceClass: "self_reviewed_artifact",
    evidenceType: "task_completed_no_score",
    completionCondition: "minimum_words_and_self_review",
    evidenceStatus: "evidence_limited",
    wordCount: 42,
    selfCheckCount: 3,
    qualityFlags: ["open_response_not_human_reviewed"],
    evidence: {
      wordCount: 42,
      selfChecks: { idea: true, reason: true, edit: true },
      selfCheckCount: 3,
      artifactHash: "a".repeat(64),
      resultType: "completed_no_score",
    },
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    officialEquivalenceClaimed: false,
    completedAt: COMPLETED_AT,
  };
  const checkIn = {
    checkInId: CHECK_IN_ID,
    cycleId: CYCLE_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    planId: BASE_PLAN_ID,
    recommendationId: RECOMMENDATION_ID,
    date: baseDates[0],
    didText: "我完成了今天绑定的原创英文写作练习。",
    evidenceText: "本机已保存写作练习回执与三项自查结果。",
    questionStatus: "has_question",
    questionText: "怎样让支持细节与中心句连接得更清楚？",
    linkedTaskId: PRIMARY_TASK_ID,
    evidenceClass: "practice_receipt",
    practiceAttemptId: PRACTICE_ATTEMPT_ID,
    taskCompletionReceiptId: COMPLETION_RECEIPT_ID,
    practiceReceipt: structuredClone(practiceReceipt),
    visibility: "local_only",
    anomalyReviewStatus: "not_flagged",
    status: "saved",
    learnerConfirmedReview: true,
    reviewId: REVIEW_ID,
    reviewedAt: COMPLETED_AT,
    savedAt: COMPLETED_AT,
    updatedAt: COMPLETED_AT,
  };
  const review = {
    cycleId: CYCLE_ID,
    reviewId: REVIEW_ID,
    checkInId: CHECK_IN_ID,
    learnerConfirmed: true,
    shareStatus: "not_shared",
    reminderStatus: "not_enabled",
    humanEscalationStatus: "not_requested",
    confirmedAt: COMPLETED_AT,
  };
  const peerHelp = {
    peerHelpId: PEER_HELP_ID,
    cycleId: CYCLE_ID,
    planId: BASE_PLAN_ID,
    reviewId: REVIEW_ID,
    status: "not_needed",
    source: "synthetic_demo_card_v1",
    learnerChoice: true,
    realCommunityUsed: false,
    createdAt: COMPLETED_AT,
    updatedAt: COMPLETED_AT,
  };
  const retest = {
    retestId: RETEST_ID,
    cycleId: CYCLE_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    planId: BASE_PLAN_ID,
    recommendationId: RECOMMENDATION_ID,
    checkInId: CHECK_IN_ID,
    reviewId: REVIEW_ID,
    peerHelpId: PEER_HELP_ID,
    skill: "Writing",
    baselineTaskId: PRIMARY_TASK_ID,
    baselinePracticeReceiptId: COMPLETION_RECEIPT_ID,
    parallelTaskId: "retest-writing-study-habit-v1",
    taskVersion: "v1",
    parallelFormPairId: "gate-a-writing-skill-pair-v1",
    status: "completed",
    parallelRetest: true,
    comparability: {
      targetSkill: "Writing",
      sameSkill: true,
      sameAsDiagnosticPriority: true,
      sameAsPlanTask: true,
      sameAsPracticeReceipt: true,
      newOriginalPrompt: true,
      constructAlignment: "same_skill_unreviewed_construct",
      teacherReviewed: false,
      measurementReviewed: false,
      officialEquivalenceClaimed: false,
      comparisonBoundary: "same_skill_only_no_calibrated_construct_or_difficulty_equivalence",
    },
    evidenceStatus: "limited_single_task",
    evidenceSufficiency: "limited_unreviewed_same_skill_task",
    humanConfirmationStatus: "required_not_completed",
    evidence: {
      responseType: "self_reviewed_writing",
      wordCount: 42,
      selfChecksComplete: true,
      resultType: "task_completed_no_score",
    },
    automatedScoreProduced: false,
    growthClaimProduced: false,
    interpretation: "single_task_evidence_only_no_growth_claim",
    completedAt: COMPLETED_AT,
  };
  const planUpdate = {
    cycleId: CYCLE_ID,
    updatedPlanId: UPDATED_PLAN_ID,
    supersedesPlanId: BASE_PLAN_ID,
    retestId: RETEST_ID,
    focusSkill: "Writing",
    learnerConfirmed: true,
    confirmationClass: "provisional_pending_human_review",
    humanConfirmationStatus: "required_not_completed",
    automatedAbilityDecision: false,
    createdAt: PROVISIONAL_AT,
  };
  const cycle = {
    protocolVersion: PROTOCOL_VERSION,
    cycleId: CYCLE_ID,
    diagnosticSessionId: DIAGNOSTIC_SESSION_ID,
    basePlanId: BASE_PLAN_ID,
    recommendationId: RECOMMENDATION_ID,
    checkInId: CHECK_IN_ID,
    reviewId: REVIEW_ID,
    peerHelpId: PEER_HELP_ID,
    retestId: RETEST_ID,
    updatedPlanId: UPDATED_PLAN_ID,
    status: "provisional_pending_human_review",
    closedAt: null,
    provisionalAt: PROVISIONAL_AT,
    createdAt: CREATED_AT,
    updatedAt: PROVISIONAL_AT,
  };
  const historyEntry = {
    ...structuredClone(cycle),
    diagnostic: structuredClone(diagnostic),
    recommendation: structuredClone(recommendation),
    checkIn: structuredClone(checkIn),
    review: structuredClone(review),
    peerHelp: structuredClone(peerHelp),
    retest: structuredClone(retest),
    planUpdate: structuredClone(planUpdate),
  };

  return {
    schemaVersion: 1,
    updatedAt: PROVISIONAL_AT,
    profile: { nickname: "Gate A 学习者", examDate: "", dailyMinutes: 30, focusSkill: "Writing" },
    plan: updatedPlan,
    planHistory: [{ ...basePlan, status: "superseded", supersededAt: PROVISIONAL_AT, supersededByRetestId: RETEST_ID }],
    taskProgress: {
      [PRIMARY_TASK_ID]: {
        status: "completed",
        completedAt: COMPLETED_AT,
        updatedAt: COMPLETED_AT,
        selfReported: false,
        completionClass: "practice_receipt",
        source: "practice",
        practiceReceiptId: COMPLETION_RECEIPT_ID,
      },
    },
    practice: {},
    practiceReceipts: { [COMPLETION_RECEIPT_ID]: structuredClone(practiceReceipt) },
    checkIns: { [baseDates[0]]: structuredClone(checkIn) },
    checkInHistory: [],
    journey: {
      protocolVersion: PROTOCOL_VERSION,
      activeCycle: structuredClone(cycle),
      diagnostic: structuredClone(diagnostic),
      recommendation: structuredClone(recommendation),
      review: structuredClone(review),
      peerHelp: structuredClone(peerHelp),
      retest: structuredClone(retest),
      planUpdate: structuredClone(planUpdate),
      history: [historyEntry],
      supersededCycles: [],
    },
  };
}

function provisionalLedgerBinding(root: MutableRecord): MutableRecord {
  const cycle = provisionalHistoryCycle(root);
  const recommendation = recordAt(cycle, "recommendation");
  const checkIn = recordAt(cycle, "checkIn");
  const receipt = recordAt(checkIn, "practiceReceipt");
  return {
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    planId: cycle.basePlanId,
    recommendationId: cycle.recommendationId,
    bindingId: recordAt(recommendation, "evidenceBinding").bindingId,
    taskId: checkIn.linkedTaskId,
    practiceAttemptId: receipt.practiceAttemptId,
    practiceReceiptId: receipt.completionReceiptId,
    checkInId: cycle.checkInId,
    retestId: cycle.retestId,
    updatedPlanId: cycle.updatedPlanId,
  };
}

async function appendCanonicalProvisionalLedger(
  root: MutableRecord,
  runtime = productionLearningEventsRuntime(),
): Promise<ProductionLearningEventsRuntime> {
  const cycle = provisionalHistoryCycle(root);
  const diagnostic = recordAt(cycle, "diagnostic");
  const recommendation = recordAt(cycle, "recommendation");
  const checkIn = recordAt(cycle, "checkIn");
  const retest = recordAt(cycle, "retest");
  const startedCycle = {
    protocolVersion: cycle.protocolVersion,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    basePlanId: null,
    recommendationId: null,
    checkInId: null,
    reviewId: null,
    peerHelpId: null,
    retestId: null,
    updatedPlanId: null,
    status: "in_progress",
    closedAt: null,
    provisionalAt: null,
    createdAt: cycle.createdAt,
    updatedAt: cycle.createdAt,
  };
  const startedDiagnostic = {
    protocolVersion: diagnostic.protocolVersion,
    cycleId: diagnostic.cycleId,
    diagnosticSessionId: diagnostic.diagnosticSessionId,
    taskSetVersion: diagnostic.taskSetVersion,
    taskSetDigest: diagnostic.taskSetDigest,
    status: "in_progress",
  };
  const receipt = recordAt(checkIn, "practiceReceipt");
  const domains: Array<[string, MutableRecord, string]> = [
    ["learning_cycle.started", { cycle: startedCycle, diagnostic: startedDiagnostic }, String(startedCycle.createdAt)],
    ["recommendation.decided", { recommendation }, String(recommendation.createdAt)],
    ["practice_attempt.finalized", { receipt, recommendation }, String(receipt.completedAt)],
    ["check_in.committed", { checkIn, recommendation }, String(checkIn.savedAt)],
    ["retest.completed", { retest, recommendation }, String(retest.completedAt)],
  ];
  for (const [eventType, domain, recordedAt] of domains) {
    runtime.setNow(recordedAt);
    const outcome = await runtime.appendDomainEvent(root, eventType, domain);
    assert.equal(outcome.status, "appended", `${eventType}: ${String(outcome.code || "append failed")}`);
  }
  return runtime;
}

function startedOnlyCycleDomain({
  cycleId,
  diagnosticSessionId,
  createdAt,
}: {
  cycleId: string;
  diagnosticSessionId: string;
  createdAt: string;
}) {
  return {
    cycle: {
      protocolVersion: PROTOCOL_VERSION,
      cycleId,
      diagnosticSessionId,
      basePlanId: null,
      recommendationId: null,
      checkInId: null,
      reviewId: null,
      peerHelpId: null,
      retestId: null,
      updatedPlanId: null,
      status: "in_progress",
      closedAt: null,
      provisionalAt: null,
      createdAt,
      updatedAt: createdAt,
    },
    diagnostic: {
      protocolVersion: PROTOCOL_VERSION,
      diagnosticProtocolVersion: DIAGNOSTIC_PROTOCOL_VERSION,
      cycleId,
      diagnosticSessionId,
      taskSetVersion: TASK_SET_VERSION,
      taskSetDigest: TASK_SET_DIGEST,
      status: "in_progress",
    },
  };
}

function startedOnlySupersededSummary(
  domain: ReturnType<typeof startedOnlyCycleDomain>,
  supersededAt: string,
) {
  return {
    cycleId: domain.cycle.cycleId,
    diagnosticProtocolVersion: DIAGNOSTIC_PROTOCOL_VERSION,
    diagnosticSessionId: domain.cycle.diagnosticSessionId,
    diagnosticStatus: "in_progress",
    protocolVersion: PROTOCOL_VERSION,
    reason: "learner_started_new_gate_a_evidence_pack",
    status: "superseded_by_new_diagnostic",
    supersededAt,
    taskEvidenceSummary: [],
    taskSetDigest: TASK_SET_DIGEST,
    taskSetVersion: TASK_SET_VERSION,
  };
}

async function canonicalProvisionalLedgerFixture(): Promise<{
  fixture: MutableRecord;
  runtime: ProductionLearningEventsRuntime;
}> {
  const fixture = canonicalProvisionalFixture();
  const runtime = await appendCanonicalProvisionalLedger(fixture);
  const verdict = await runtime.validateProvisionalCycleLedger(
    fixture,
    provisionalLedgerBinding(fixture),
  );
  assert.equal(verdict.ok, true, String(verdict.code || "production provisional admission failed"));
  return { fixture, runtime };
}

async function deriveFixture(
  root: MutableRecord,
  runtime: ProductionLearningEventsRuntime,
) {
  return deriveTeachingReviewEvidence(
    JSON.stringify(root),
    productionProvisionalValidator(runtime),
  );
}

describe("Teaching review canonical evidence boundary", () => {
  it("accepts a complete canonical provisional cycle as ready", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const result = await deriveFixture(fixture, runtime);

    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(result.cycle.cycleId, CYCLE_ID);
    assert.equal(result.cycle.status, "provisional_pending_human_review");
    assert.equal(result.cycle.closedAt, null);
    assert.equal(result.diagnostic?.prioritySkill, "Writing");
    assert.equal(result.practice?.receiptFound, true);
    assert.equal(result.retest?.humanConfirmationStatus, "required_not_completed");
    assert.equal(result.planUpdate?.provisional, true);
  });

  it("admits a valid superseded prefix, rejects an ownerless cycle, and requires the provisional fragment at the ledger tail", async () => {
    const fixture = canonicalProvisionalFixture();
    const runtime = productionLearningEventsRuntime();
    const prior = startedOnlyCycleDomain({
      cycleId: "cycle-msqhg70a-prior",
      diagnosticSessionId: "diagnostic-msqhg70b-prior",
      createdAt: "2026-08-10T11:00:00.000Z",
    });
    runtime.setNow(prior.cycle.createdAt);
    assert.equal(
      (await runtime.appendDomainEvent(fixture, "learning_cycle.started", prior)).status,
      "appended",
    );
    const supersededCycles = recordAt(fixture, "journey").supersededCycles;
    assert.ok(Array.isArray(supersededCycles));
    supersededCycles.push(startedOnlySupersededSummary(prior, "2026-08-10T11:30:00.000Z"));
    await appendCanonicalProvisionalLedger(fixture, runtime);
    const binding = provisionalLedgerBinding(fixture);
    assert.equal((await runtime.validateProvisionalCycleLedger(fixture, binding)).ok, true);

    const orphan = startedOnlyCycleDomain({
      cycleId: "cycle-msqhg80a-orphan",
      diagnosticSessionId: "diagnostic-msqhg80b-orphan",
      createdAt: "2026-08-10T14:00:00.000Z",
    });
    runtime.setNow(orphan.cycle.createdAt);
    assert.equal(
      (await runtime.appendDomainEvent(fixture, "learning_cycle.started", orphan)).status,
      "appended",
    );
    const orphanVerdict = await runtime.validateProvisionalCycleLedger(fixture, binding);
    assert.equal(orphanVerdict.ok, false);
    assert.equal(orphanVerdict.code, "ledger_domain_coverage_invalid");

    supersededCycles.push(startedOnlySupersededSummary(orphan, "2026-08-10T14:30:00.000Z"));
    const tailVerdict = await runtime.validateProvisionalCycleLedger(fixture, binding);
    assert.equal(tailVerdict.ok, false);
    assert.equal(tailVerdict.code, "provisional_event_fragment_not_ledger_tail");
  });

  it("rejects completed and closed history entries instead of treating them as provisional", async () => {
    const { fixture: completed, runtime } = await canonicalProvisionalLedgerFixture();
    provisionalHistoryCycle(completed).status = "completed";
    activeCycle(completed).status = "completed";
    assert.equal((await deriveFixture(completed, runtime)).status, "no_provisional_cycle");

    const { fixture: closed } = await canonicalProvisionalLedgerFixture();
    provisionalHistoryCycle(closed).closedAt = PROVISIONAL_AT;
    activeCycle(closed).closedAt = PROVISIONAL_AT;
    assert.equal((await deriveFixture(closed, runtime)).status, "no_provisional_cycle");
  });

  it("never substitutes an older provisional history entry for the current active cycle", async () => {
    const { fixture: newCycleInProgress, runtime } = await canonicalProvisionalLedgerFixture();
    Object.assign(activeCycle(newCycleInProgress), {
      cycleId: "cycle-new-in-progress",
      diagnosticSessionId: "diagnostic-new-in-progress",
      status: "in_progress",
      provisionalAt: null,
      updatedPlanId: null,
    });
    assert.equal((await deriveFixture(newCycleInProgress, runtime)).status, "no_provisional_cycle");

    const { fixture: mismatchedProvisional } = await canonicalProvisionalLedgerFixture();
    activeCycle(mismatchedProvisional).cycleId = "cycle-other-provisional";
    assert.deepEqual(await deriveFixture(mismatchedProvisional, runtime), {
      status: "invalid",
      reason: "active_cycle_history_mismatch",
    });

    for (const field of [
      "diagnosticSessionId",
      "basePlanId",
      "recommendationId",
      "checkInId",
      "reviewId",
      "peerHelpId",
      "retestId",
      "updatedPlanId",
    ]) {
      const { fixture: downstreamMismatch } = await canonicalProvisionalLedgerFixture();
      activeCycle(downstreamMismatch)[field] = `${field}-other`;
      assert.deepEqual(await deriveFixture(downstreamMismatch, runtime), {
        status: "invalid",
        reason: "active_cycle_history_mismatch",
      }, field);
    }

    const { fixture: noActiveCycle } = await canonicalProvisionalLedgerFixture();
    recordAt(noActiveCycle, "journey").activeCycle = null;
    assert.equal((await deriveFixture(noActiveCycle, runtime)).status, "no_active_cycle");
  });

  it("requires the same explicit provisional timestamp on active and history without an updatedAt fallback", async () => {
    const cases: Array<[string, (fixture: MutableRecord) => void]> = [
      [
        "both provisional timestamps missing",
        (fixture) => {
          Reflect.deleteProperty(activeCycle(fixture), "provisionalAt");
          Reflect.deleteProperty(provisionalHistoryCycle(fixture), "provisionalAt");
        },
      ],
      [
        "active provisional timestamp missing",
        (fixture) => {
          Reflect.deleteProperty(activeCycle(fixture), "provisionalAt");
        },
      ],
      [
        "history provisional timestamp missing",
        (fixture) => {
          Reflect.deleteProperty(provisionalHistoryCycle(fixture), "provisionalAt");
        },
      ],
      [
        "active and history provisional timestamps drift",
        (fixture) => {
          activeCycle(fixture).provisionalAt = "2026-08-10T13:00:01.000Z";
        },
      ],
    ];

    for (const [label, mutate] of cases) {
      const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
      mutate(fixture);
      assert.equal((await deriveFixture(fixture, runtime)).status, "invalid", label);
      assert.equal(
        (await deriveProvisionalHandoffEvidence(
          JSON.stringify(fixture),
          productionProvisionalValidator(runtime),
        )).status,
        "invalid",
        `${label} handoff projection`,
      );
    }
  });

  it("rejects evidence linked to another cycle", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    recordAt(provisionalHistoryCycle(fixture), "retest").cycleId = "cycle-other";

    assert.deepEqual(await deriveFixture(fixture, runtime), {
      status: "invalid",
      reason: "cross_cycle_evidence_rejected",
    });
  });

  it("rejects missing task-set, recommendation-binding, receipt, and retest evidence", async () => {
    const cases: Array<[string, (fixture: MutableRecord) => void, string]> = [
      [
        "task set",
        (fixture) => {
          Reflect.deleteProperty(recordAt(provisionalHistoryCycle(fixture), "diagnostic"), "taskSetDigest");
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "recommendation binding",
        (fixture) => {
          Reflect.deleteProperty(recordAt(provisionalHistoryCycle(fixture), "recommendation"), "evidenceBinding");
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "stored practice receipt",
        (fixture) => {
          Reflect.deleteProperty(recordAt(fixture, "practiceReceipts"), COMPLETION_RECEIPT_ID);
        },
        "practice_receipt_boundary_rejected",
      ],
      [
        "embedded practice receipt",
        (fixture) => {
          Reflect.deleteProperty(recordAt(provisionalHistoryCycle(fixture), "checkIn"), "practiceReceipt");
        },
        "practice_receipt_boundary_rejected",
      ],
      [
        "retest evidence",
        (fixture) => {
          Reflect.deleteProperty(recordAt(provisionalHistoryCycle(fixture), "retest"), "evidence");
        },
        "retest_or_plan_update_boundary_rejected",
      ],
    ];

    for (const [label, mutate, reason] of cases) {
      const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
      mutate(fixture);
      assert.deepEqual(await deriveFixture(fixture, runtime), { status: "invalid", reason }, label);
    }
  });

  it("rejects false human-review claims, unknown quality codes, and invalid objective outcomes", async () => {
    const cases: Array<[string, (fixture: MutableRecord) => void, string]> = [
      [
        "primary teacher-reviewed injection",
        (fixture) => {
          recordAt(provisionalHistoryCycle(fixture), "recommendation", "primary").teacherReviewed = true;
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "unknown diagnostic quality flag",
        (fixture) => {
          const tasks = recordAt(provisionalHistoryCycle(fixture), "diagnostic").taskEvidence;
          if (!Array.isArray(tasks) || !isRecord(tasks[0])) throw new TypeError("Expected diagnostic tasks");
          tasks[0].qualityFlags = ["PRIVATE_FREE_TEXT_MARKER"];
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "unknown diagnostic priority basis",
        (fixture) => {
          recordAt(provisionalHistoryCycle(fixture), "diagnostic").priorityBasis = "PRIVATE_FREE_TEXT_MARKER";
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "invalid objective result",
        (fixture) => {
          const tasks = recordAt(provisionalHistoryCycle(fixture), "diagnostic").taskEvidence;
          if (!Array.isArray(tasks) || !isRecord(tasks[0])) throw new TypeError("Expected diagnostic tasks");
          tasks[0].resultType = "PRIVATE_FREE_TEXT_MARKER";
        },
        "canonical_binding_or_plan_rejected",
      ],
      [
        "unknown practice quality flag",
        (fixture) => {
          const storedReceipt = recordAt(fixture, "practiceReceipts", COMPLETION_RECEIPT_ID);
          const embeddedReceipt = recordAt(provisionalHistoryCycle(fixture), "checkIn", "practiceReceipt");
          storedReceipt.qualityFlags = ["open_response_not_human_reviewed", "PRIVATE_FREE_TEXT_MARKER"];
          embeddedReceipt.qualityFlags = ["open_response_not_human_reviewed", "PRIVATE_FREE_TEXT_MARKER"];
        },
        "practice_receipt_boundary_rejected",
      ],
    ];

    for (const [label, mutate, reason] of cases) {
      const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
      mutate(fixture);
      assert.deepEqual(await deriveFixture(fixture, runtime), { status: "invalid", reason }, label);
    }
  });

  it("requires own-property membership and the exact six-task manifest set", async () => {
    for (const inheritedKey of ["__proto__", "constructor", "toString"]) {
      const { fixture: taskFixture, runtime } = await canonicalProvisionalLedgerFixture();
      const tasks = recordAt(provisionalHistoryCycle(taskFixture), "diagnostic").taskEvidence;
      if (!Array.isArray(tasks) || !isRecord(tasks[0])) throw new TypeError("Expected diagnostic tasks");
      tasks[0] = { ...tasks[0], taskId: inheritedKey };
      assert.deepEqual(await deriveFixture(taskFixture, runtime), {
        status: "invalid",
        reason: "canonical_binding_or_plan_rejected",
      }, `diagnostic task ${inheritedKey}`);

      const { fixture: bindingFixture } = await canonicalProvisionalLedgerFixture();
      recordAt(provisionalHistoryCycle(bindingFixture), "recommendation", "evidenceBinding").diagnosticEvidenceTaskIds = [inheritedKey];
      assert.deepEqual(await deriveFixture(bindingFixture, runtime), {
        status: "invalid",
        reason: "canonical_binding_or_plan_rejected",
      }, `binding task ${inheritedKey}`);
    }
  });

  it("requires the receipt map key, embedded receipt, task progress, and check-in contract to agree", async () => {
    const cases: Array<[string, (fixture: MutableRecord) => void]> = [
      ["receipt internal ID", (fixture) => {
        recordAt(fixture, "practiceReceipts", COMPLETION_RECEIPT_ID).completionReceiptId = "123e4567-e89b-42d3-a456-426614174099";
        recordAt(provisionalHistoryCycle(fixture), "checkIn", "practiceReceipt").completionReceiptId = "123e4567-e89b-42d3-a456-426614174099";
      }],
      ["task progress record", (fixture) => {
        Reflect.deleteProperty(recordAt(fixture, "taskProgress"), PRIMARY_TASK_ID);
      }],
      ["task progress receipt link", (fixture) => {
        recordAt(fixture, "taskProgress", PRIMARY_TASK_ID).practiceReceiptId = "123e4567-e89b-42d3-a456-426614174099";
      }],
      ["check-in evidence class", (fixture) => {
        recordAt(provisionalHistoryCycle(fixture), "checkIn").evidenceClass = "self_report";
      }],
      ["check-in did text", (fixture) => {
        recordAt(provisionalHistoryCycle(fixture), "checkIn").didText = "too short";
      }],
      ["check-in evidence text", (fixture) => {
        recordAt(provisionalHistoryCycle(fixture), "checkIn").evidenceText = "too short";
      }],
      ["check-in question text", (fixture) => {
        recordAt(provisionalHistoryCycle(fixture), "checkIn").questionText = "";
      }],
    ];

    for (const [label, mutate] of cases) {
      const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
      mutate(fixture);
      assert.deepEqual(await deriveFixture(fixture, runtime), {
        status: "invalid",
        reason: "practice_receipt_boundary_rejected",
      }, label);
    }
  });

  it("projects summaries without diagnostic answers, learner free text, or retest response text", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const cycle = provisionalHistoryCycle(fixture);
    const diagnosticTasks = recordAt(cycle, "diagnostic").taskEvidence;
    if (!Array.isArray(diagnosticTasks) || !isRecord(diagnosticTasks[0])) throw new TypeError("Expected diagnostic tasks");
    diagnosticTasks[0].rawAnswer = "RAW_DIAGNOSTIC_MARKER";
    const checkIn = recordAt(cycle, "checkIn");
    checkIn.didText = "LEARNER_DID_TEXT_MARKER 以及足够长度的说明";
    checkIn.evidenceText = "LEARNER_EVIDENCE_TEXT_MARKER 以及足够长度的说明";
    checkIn.questionText = "LEARNER_QUESTION_TEXT_MARKER";
    recordAt(cycle, "retest", "evidence").responseText = "RAW_RETEST_TEXT_MARKER";
    const openTask = recordAt(cycle, "diagnostic").taskEvidence;
    if (!Array.isArray(openTask) || !isRecord(openTask[5])) throw new TypeError("Expected open diagnostic task");
    openTask[5].resultType = "OPEN_RESULT_MARKER";
    const primary = recordAt(cycle, "recommendation", "primary");
    const binding = recordAt(cycle, "recommendation", "evidenceBinding");
    primary.title = "PRIMARY_TITLE_MARKER";
    primary.reason = "PRIMARY_REASON_MARKER 以及足够长度的绑定说明";
    binding.bindingReason = primary.reason;

    const result = await deriveFixture(fixture, runtime);
    assert.equal(result.status, "ready");
    const projection = JSON.stringify(result);
    for (const forbidden of [
      "RAW_DIAGNOSTIC_MARKER",
      "LEARNER_DID_TEXT_MARKER",
      "LEARNER_EVIDENCE_TEXT_MARKER",
      "LEARNER_QUESTION_TEXT_MARKER",
      "RAW_RETEST_TEXT_MARKER",
      "OPEN_RESULT_MARKER",
      "PRIMARY_TITLE_MARKER",
      "PRIMARY_REASON_MARKER",
      "rawAnswer",
      "firstResponse",
      "didText",
      "evidenceText",
      "questionText",
      "responseText",
    ]) {
      assert.equal(projection.includes(forbidden), false, forbidden);
    }
    if (result.status !== "ready") return;
    assert.equal(result.practice?.learnerNarrativeWithheld, true);
  });
});

describe("Sofia provisional handoff production boundary", () => {
  async function readyHandoff() {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const raw = JSON.stringify(fixture);
    const result = await deriveProvisionalHandoffEvidence(
      raw,
      productionProvisionalValidator(runtime),
    );
    assert.equal(result.status, "ready");
    if (result.status !== "ready") throw new TypeError("Expected production handoff evidence");
    return { fixture, raw, runtime, evidence: result.evidence, digest: await sha256Hex(raw) };
  }

  it("creates the exact strict local packet schema from the authorized provisional cycle", async () => {
    const { evidence, digest } = await readyHandoff();
    const packet = createProvisionalHandoffPacket({
      evidence,
      sourceSnapshotSha256: digest,
      createdAt: "2026-08-10T13:05:00.000Z",
    });

    assert.equal(provisionalHandoffPacketSchema.safeParse(packet).success, true);
    assert.deepEqual(Object.keys(packet).sort(), [
      "canonicalLedgerWriteAllowed",
      "createdAt",
      "cycleClosureAllowed",
      "humanConfirmationStatus",
      "humanReviewReceiptCreated",
      "identityVerified",
      "kind",
      "learnerNarrativeWithheld",
      "networkDispatch",
      "peerHelpStatus",
      "prioritySkill",
      "protocolVersion",
      "qualifiedHumanConfirmation",
      "realQueueCreated",
      "recordedStepCount",
      "retestEvidenceStatus",
      "sourceClass",
      "sourceSnapshotSha256",
      "sourceStorageKey",
      "sourceUpdatedAt",
      "status",
    ].sort());
    assert.equal(packet.protocolVersion, PROVISIONAL_HANDOFF_PROTOCOL);
    assert.equal(packet.recordedStepCount, 7);
    assert.equal(packet.sourceStorageKey, CANONICAL_LEARNER_STORAGE_KEY);
    assert.equal(packet.sourceSnapshotSha256, digest);
    assert.equal(packet.status, "local_not_sent");
    assert.equal(packet.networkDispatch, "disabled");
    assert.equal(packet.realQueueCreated, false);
    assert.equal(packet.humanReviewReceiptCreated, false);
    assert.equal(packet.qualifiedHumanConfirmation, false);
    assert.equal(packet.identityVerified, false);
    assert.equal(packet.canonicalLedgerWriteAllowed, false);
    assert.equal(packet.cycleClosureAllowed, false);
    assert.equal(packet.learnerNarrativeWithheld, true);
    assert.deepEqual(parseProvisionalHandoffPacket(JSON.parse(serializeProvisionalHandoffPacket(packet))), packet);
    for (const forbiddenField of [
      "packetId",
      "cycleId",
      "diagnosticSessionId",
      "basePlanId",
      "recommendationId",
      "checkInId",
      "reviewId",
      "peerHelpId",
      "retestId",
      "updatedPlanId",
    ]) {
      assert.equal(Object.hasOwn(packet, forbiddenField), false, forbiddenField);
      assert.equal(
        provisionalHandoffPacketSchema.safeParse({ ...packet, [forbiddenField]: "identity-or-contact" }).success,
        false,
        forbiddenField,
      );
    }
    assert.equal(provisionalHandoffEvidenceSchema.safeParse(evidence).success, true);
  });

  it("accepts only canonical UTC millisecond timestamps and fails closed before a poisoned packet can be copied", async () => {
    const canonicalTimestamps = [
      "2026-08-10T13:05:00.000Z",
      "2026-08-10T13:05:00.999Z",
      "2024-02-29T23:59:59.001Z",
    ];
    const nonCanonicalTimestamps = [
      "2026-08-10T13:05:00.13800138000Z",
      "2026-08-10T13:05:00Z",
      "2026-08-10T13:05:00.1Z",
      "2026-08-10T13:05:00.0000Z",
      "2026-08-10T13:05:00.000+00:00",
      "2026-02-30T13:05:00.000Z",
      "2026-08-10t13:05:00.000z",
    ];
    for (const timestamp of canonicalTimestamps) {
      assert.equal(canonicalUtcMillisecondTimestampSchema.safeParse(timestamp).success, true, timestamp);
    }
    for (const timestamp of nonCanonicalTimestamps) {
      assert.equal(canonicalUtcMillisecondTimestampSchema.safeParse(timestamp).success, false, timestamp);
    }

    const { evidence, digest } = await readyHandoff();
    const packet = createProvisionalHandoffPacket({
      evidence,
      sourceSnapshotSha256: digest,
      createdAt: canonicalTimestamps[0],
    });
    const poisonedCreatedAt = {
      ...packet,
      createdAt: "2026-08-10T13:05:00.13800138000Z",
    };
    const poisonedSourceUpdatedAt = {
      ...packet,
      sourceUpdatedAt: "2026-08-10T13:05:00.13800138000Z",
    };
    for (const poisoned of [poisonedCreatedAt, poisonedSourceUpdatedAt]) {
      assert.equal(provisionalHandoffPacketSchema.safeParse(poisoned).success, false);
      assert.equal(parseProvisionalHandoffPacket(poisoned), null);
      assert.throws(() => buildProvisionalHandoffCopyText(poisoned as typeof packet));
    }
    assert.equal(
      provisionalHandoffEvidenceSchema.safeParse({
        ...evidence,
        sourceUpdatedAt: "2026-08-10T13:05:00.13800138000Z",
      }).success,
      false,
    );
  });

  it("derives the minimized 7/7 provisional learner context without claiming completed human review", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const validator = productionProvisionalValidator(runtime);
    const context = await deriveLearnerContext(fixture, validator);
    assert.equal(context?.terminalEvidenceTaskCount, 6);
    assert.equal(context?.completedEvidenceTaskCount, 6);
    assert.equal(context?.plan?.stage, "provisional_updated");
    assert.equal(context?.plan?.planId, UPDATED_PLAN_ID);
    assert.equal(context?.plan?.basePlanId, BASE_PLAN_ID);
    assert.equal(context?.progress?.checkInRecorded, true);
    assert.equal(context?.progress?.learnerReviewConfirmed, true);
    assert.equal(context?.progress?.retestRecorded, true);
    assert.equal(context?.progress?.updatedPlanConfirmed, false);
    assert.equal(context?.progress?.humanReviewStatus, "required_not_completed");

    const { fixture: crossCycle } = await canonicalProvisionalLedgerFixture();
    recordAt(provisionalHistoryCycle(crossCycle), "retest").cycleId = "cycle-other";
    assert.equal(await deriveLearnerContext(crossCycle, validator), undefined);

    const { fixture: unknownStatus } = await canonicalProvisionalLedgerFixture();
    recordAt(provisionalHistoryCycle(unknownStatus), "peerHelp").status = "PRIVATE_FREE_TEXT_MARKER";
    assert.equal(await deriveLearnerContext(unknownStatus, validator), undefined);
  });

  it("fails closed for cross-cycle and unknown evidence while keeping completed and in-progress states unavailable", async () => {
    const { fixture: crossCycle, runtime } = await canonicalProvisionalLedgerFixture();
    const validator = productionProvisionalValidator(runtime);
    recordAt(provisionalHistoryCycle(crossCycle), "retest").cycleId = "cycle-other";
    assert.deepEqual(await deriveProvisionalHandoffEvidence(JSON.stringify(crossCycle), validator), {
      status: "invalid",
      reason: "cross_cycle_evidence_rejected",
    });

    const { fixture: unknownStatus } = await canonicalProvisionalLedgerFixture();
    recordAt(provisionalHistoryCycle(unknownStatus), "peerHelp").status = "PRIVATE_FREE_TEXT_MARKER";
    assert.deepEqual(await deriveProvisionalHandoffEvidence(JSON.stringify(unknownStatus), validator), {
      status: "invalid",
      reason: "provisional_human_review_boundary_rejected",
    });

    const { fixture: disguisedIdentity } = await canonicalProvisionalLedgerFixture();
    const disguisedCycle = provisionalHistoryCycle(disguisedIdentity);
    activeCycle(disguisedIdentity).cycleId = "clerk_user_2abc123";
    disguisedCycle.cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "diagnostic").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "recommendation").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "checkIn").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "review").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "peerHelp").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "retest").cycleId = "clerk_user_2abc123";
    recordAt(disguisedCycle, "planUpdate").cycleId = "clerk_user_2abc123";
    assert.deepEqual(await deriveProvisionalHandoffEvidence(JSON.stringify(disguisedIdentity), validator), {
      status: "invalid",
      reason: "canonical_binding_or_plan_rejected",
    });

    const { fixture: completed } = await canonicalProvisionalLedgerFixture();
    provisionalHistoryCycle(completed).status = "completed";
    activeCycle(completed).status = "completed";
    assert.deepEqual(await deriveProvisionalHandoffEvidence(JSON.stringify(completed), validator), {
      status: "no_provisional_cycle",
    });

    const { fixture: inProgress } = await canonicalProvisionalLedgerFixture();
    Object.assign(activeCycle(inProgress), {
      cycleId: "cycle-new-in-progress",
      diagnosticSessionId: "diagnostic-new-in-progress",
      status: "in_progress",
      provisionalAt: null,
      updatedPlanId: null,
    });
    assert.deepEqual(await deriveProvisionalHandoffEvidence(JSON.stringify(inProgress), validator), {
      status: "no_provisional_cycle",
    });
  });

  it("matches by the full workspace SHA and safe enums without storing raw domain IDs", async () => {
    const { raw, evidence, digest } = await readyHandoff();
    const first = createProvisionalHandoffPacket({
      evidence,
      sourceSnapshotSha256: digest,
      createdAt: "2026-08-10T13:05:00.000Z",
    });
    const duplicate = createProvisionalHandoffPacket({
      evidence,
      sourceSnapshotSha256: digest,
      createdAt: first.createdAt,
    });

    assert.equal(serializeProvisionalHandoffPacket(duplicate), serializeProvisionalHandoffPacket(first));
    assert.equal(findMatchingProvisionalHandoffPacket([first], evidence, digest), first);
    assert.equal(packetMatchesProvisionalEvidence(first, evidence, digest), true);

    const changedRaw = `${raw}\n`;
    const changedDigest = await sha256Hex(changedRaw);
    assert.notEqual(changedDigest, digest);
    assert.equal(packetMatchesProvisionalEvidence(first, evidence, changedDigest), false);
    assert.equal(findMatchingProvisionalHandoffPacket([first], evidence, changedDigest), undefined);

    const otherEvidence = {
      ...evidence,
      cycleId: "cycle-msqhg77f-ijk12",
      diagnosticSessionId: "diagnostic-msqhg77g-jkl23",
      basePlanId: "plan-msqhg77h-klm34",
      recommendationId: "recommendation-msqhg77i-lmn45",
      checkInId: "check-in-msqhg77j",
      reviewId: "review-msqhg77k-mno56",
      peerHelpId: "peer-help-msqhg77m-nop67",
      retestId: "retest-msqhg77n-opq78",
      updatedPlanId: "plan-msqhg77p-pqr89",
    };
    const other = createProvisionalHandoffPacket({
      evidence: otherEvidence,
      sourceSnapshotSha256: digest,
      createdAt: first.createdAt,
    });
    assert.equal(serializeProvisionalHandoffPacket(other), serializeProvisionalHandoffPacket(first));
    assert.equal(findMatchingProvisionalHandoffPacket([first, other], evidence, digest), other);
    assert.equal(findMatchingProvisionalHandoffPacket([first, other], otherEvidence, digest), other);
  });

  it("copies only the strict allowlist and withholds learner, identity, contact, and raw-answer text", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const cycle = provisionalHistoryCycle(fixture);
    recordAt(cycle, "checkIn").questionText = "PRIVATE_QUESTION_MARKER";
    recordAt(cycle, "checkIn").didText = "PRIVATE_DID_MARKER with sufficient learner narrative";
    recordAt(cycle, "checkIn").evidenceText = "PRIVATE_EVIDENCE_MARKER with sufficient learner narrative";
    recordAt(cycle, "retest", "evidence").responseText = "PRIVATE_RETEST_MARKER";
    const diagnosticTasks = recordAt(cycle, "diagnostic").taskEvidence;
    if (!Array.isArray(diagnosticTasks) || !isRecord(diagnosticTasks[0])) throw new TypeError("Expected diagnostic tasks");
    diagnosticTasks[0].rawAnswer = "PRIVATE_RAW_ANSWER_MARKER";
    fixture.clerkUserId = "user_private_clerk_marker";
    fixture.email = "private@example.test";
    fixture.phone = "13800138000";

    const raw = JSON.stringify(fixture);
    const result = await deriveProvisionalHandoffEvidence(
      raw,
      productionProvisionalValidator(runtime),
    );
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    const packet = createProvisionalHandoffPacket({
      evidence: result.evidence,
      sourceSnapshotSha256: await sha256Hex(raw),
      createdAt: "2026-08-10T13:05:00.000Z",
    });
    const copy = buildProvisionalHandoffCopyText(packet);
    const rawDomainIds = [
      result.evidence.cycleId,
      result.evidence.diagnosticSessionId,
      result.evidence.basePlanId,
      result.evidence.recommendationId,
      result.evidence.checkInId,
      result.evidence.reviewId,
      result.evidence.peerHelpId,
      result.evidence.retestId,
      result.evidence.updatedPlanId,
    ];
    for (const forbidden of [
      "packetId",
      ...rawDomainIds,
      "PRIVATE_QUESTION_MARKER",
      "PRIVATE_DID_MARKER",
      "PRIVATE_EVIDENCE_MARKER",
      "PRIVATE_RETEST_MARKER",
      "PRIVATE_RAW_ANSWER_MARKER",
      "user_private_clerk_marker",
      "private@example.test",
      "13800138000",
      "questionText",
      "didText",
      "evidenceText",
      "responseText",
      "rawAnswer",
      "clerkUserId",
      "email",
      "phone",
    ]) {
      assert.equal(JSON.stringify(packet).includes(forbidden), false, `packet: ${forbidden}`);
      assert.equal(copy.includes(forbidden), false, `copy: ${forbidden}`);
    }
    assert.match(copy, new RegExp(packet.sourceSnapshotSha256));
    assert.match(copy, /仅在本机准备，尚未发送/);
    assert.match(copy, /不从来源投影姓名、Clerk 身份、联系方式、原始答案、录音、对话或打卡自由文本字段/);
  });

  it("commits only Sofia bytes, emits zero learning events, and returns the same packet idempotently", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSession = emptySession();
    const initialSofiaRaw = JSON.stringify(initialSession);
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    const writes: string[] = [];
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        writes.push(key);
        values.set(key, value);
      },
      removeItem(key: string) {
        writes.push(key);
        values.delete(key);
      },
    };
    let timeCalls = 0;
    const now = () => {
      timeCalls += 1;
      return "2026-08-10T13:05:00.000Z";
    };

    const created = await commitProvisionalHandoffPacket({
      storage,
      expectedSession: initialSession,
      now,
      ledgerValidator,
    });
    assert.equal(created.status, "created");
    if (created.status !== "created") return;
    assert.equal(Object.hasOwn(created.packet, "packetId"), false);
    assert.equal(timeCalls, 1);
    assert.deepEqual(writes, [SUPER_TEACHER_CHAT_KEY]);
    assert.equal(values.get(CANONICAL_LEARNER_STORAGE_KEY), workspaceRaw);
    assert.equal(values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY), teachingRaw);
    assert.equal(
      JSON.stringify((JSON.parse(values.get(CANONICAL_LEARNER_STORAGE_KEY) ?? "null") as MutableRecord).learningEvents),
      JSON.stringify(fixture.learningEvents),
    );

    const threeNamespaceBytes = {
      workspace: values.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: values.get(SUPER_TEACHER_CHAT_KEY),
      teaching: values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    };
    const writesBeforeReplay = writes.length;
    const replay = await commitProvisionalHandoffPacket({
      storage,
      expectedSession: created.session,
      now,
      ledgerValidator,
    });
    assert.equal(replay.status, "existing");
    if (replay.status !== "existing") return;
    assert.equal(replay.packet.sourceSnapshotSha256, created.packet.sourceSnapshotSha256);
    assert.equal(replay.packet.createdAt, created.packet.createdAt);
    assert.equal(replay.session, created.session);
    assert.equal(timeCalls, 1);
    assert.equal(writes.length, writesBeforeReplay);
    assert.deepEqual({
      workspace: values.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: values.get(SUPER_TEACHER_CHAT_KEY),
      teaching: values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    }, threeNamespaceBytes);
  });

  it("rejects stale workspace and Sofia CAS before timestamp allocation with zero cross-namespace writes", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const changedWorkspaceRaw = `${workspaceRaw}\n`;
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSession = emptySession();
    const initialSofiaRaw = JSON.stringify(initialSession);
    const makeValues = () => new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    let timeCalls = 0;
    const now = () => {
      timeCalls += 1;
      return "2026-08-10T13:05:00.000Z";
    };

    const staleValues = makeValues();
    const staleWrites: string[] = [];
    let workspaceReads = 0;
    const stale = await commitProvisionalHandoffPacket({
      storage: {
        getItem(key: string) {
          if (key === CANONICAL_LEARNER_STORAGE_KEY) {
            workspaceReads += 1;
            if (workspaceReads === 2) staleValues.set(key, changedWorkspaceRaw);
          }
          return staleValues.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          staleWrites.push(key);
          staleValues.set(key, value);
        },
        removeItem(key: string) {
          staleWrites.push(key);
          staleValues.delete(key);
        },
      },
      expectedSession: initialSession,
      now,
      ledgerValidator,
    });
    assert.deepEqual(stale, { status: "workspace_changed_during_write" });
    assert.deepEqual(staleWrites, []);
    assert.equal(staleValues.get(CANONICAL_LEARNER_STORAGE_KEY), changedWorkspaceRaw);
    assert.equal(staleValues.get(SUPER_TEACHER_CHAT_KEY), initialSofiaRaw);
    assert.equal(staleValues.get(TEACHING_REVIEW_DEMO_STORAGE_KEY), teachingRaw);
    assert.equal(timeCalls, 0);

    const casValues = makeValues();
    const casWrites: string[] = [];
    const cas = await commitProvisionalHandoffPacket({
      storage: {
        getItem: (key: string) => casValues.get(key) ?? null,
        setItem(key: string, value: string) {
          casWrites.push(key);
          casValues.set(key, value);
        },
        removeItem(key: string) {
          casWrites.push(key);
          casValues.delete(key);
        },
      },
      expectedSession: { ...initialSession, revision: 1 },
      now,
      ledgerValidator,
    });
    assert.deepEqual(cas, { status: "super_teacher_concurrent_change" });
    assert.deepEqual(casWrites, []);
    assert.deepEqual({
      workspace: casValues.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: casValues.get(SUPER_TEACHER_CHAT_KEY),
      teaching: casValues.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    }, {
      workspace: workspaceRaw,
      sofia: initialSofiaRaw,
      teaching: teachingRaw,
    });
    assert.equal(timeCalls, 0);
  });

  it("rolls Sofia back byte-for-byte when workspace changes after the candidate write", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const changedWorkspaceRaw = `${workspaceRaw}\n`;
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSofiaRaw = JSON.stringify(emptySession());
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    const writes: Array<{ key: string; value: string | null }> = [];
    let workspaceReads = 0;
    const result = await commitProvisionalHandoffPacket({
      storage: {
        getItem(key: string) {
          if (key === CANONICAL_LEARNER_STORAGE_KEY) {
            workspaceReads += 1;
            if (workspaceReads === 4) values.set(key, changedWorkspaceRaw);
          }
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          writes.push({ key, value });
          values.set(key, value);
        },
        removeItem(key: string) {
          writes.push({ key, value: null });
          values.delete(key);
        },
      },
      expectedSession: emptySession(),
      now: () => "2026-08-10T13:05:00.000Z",
      ledgerValidator,
    });

    assert.deepEqual(result, { status: "workspace_changed_during_write" });
    assert.deepEqual(writes.map(({ key }) => key), [SUPER_TEACHER_CHAT_KEY, SUPER_TEACHER_CHAT_KEY]);
    assert.equal(values.get(SUPER_TEACHER_CHAT_KEY), initialSofiaRaw);
    assert.equal(values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY), teachingRaw);
    assert.equal(values.get(CANONICAL_LEARNER_STORAGE_KEY), changedWorkspaceRaw);
    assert.equal(
      JSON.stringify((JSON.parse(values.get(CANONICAL_LEARNER_STORAGE_KEY) ?? "null") as MutableRecord).learningEvents),
      JSON.stringify(fixture.learningEvents),
    );
  });

  it("rolls Sofia back byte-for-byte when post-write session verification fails", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSofiaRaw = JSON.stringify(emptySession());
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    let sofiaWrites = 0;
    const result = await commitProvisionalHandoffPacket({
      storage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem(key: string, value: string) {
          if (key === SUPER_TEACHER_CHAT_KEY) {
            sofiaWrites += 1;
            values.set(key, sofiaWrites === 1 ? "{corrupt-after-write" : value);
            return;
          }
          values.set(key, value);
        },
        removeItem(key: string) {
          values.delete(key);
        },
      },
      expectedSession: emptySession(),
      now: () => "2026-08-10T13:05:00.000Z",
      ledgerValidator,
    });

    assert.deepEqual(result, { status: "super_teacher_write_verification_failed" });
    assert.equal(sofiaWrites, 2);
    assert.deepEqual({
      workspace: values.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: values.get(SUPER_TEACHER_CHAT_KEY),
      teaching: values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    }, {
      workspace: workspaceRaw,
      sofia: initialSofiaRaw,
      teaching: teachingRaw,
    });
  });

  it("recovers the prior Sofia raw when setItem mutates and then throws", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSofiaRaw = '{"protocolVersion":"sufeiya_super_teacher_v1","revision":0,"turns":[],"handoffRequests":[]}';
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    let sofiaWrites = 0;
    const result = await commitProvisionalHandoffPacket({
      storage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem(key: string, value: string) {
          if (key === SUPER_TEACHER_CHAT_KEY) {
            sofiaWrites += 1;
            values.set(key, value);
            if (sofiaWrites === 1) throw new Error("mutated then threw");
            return;
          }
          values.set(key, value);
        },
        removeItem(key: string) {
          values.delete(key);
        },
      },
      expectedSession: emptySession(),
      now: () => "2026-08-10T13:05:00.000Z",
      ledgerValidator,
    });

    assert.deepEqual(result, { status: "super_teacher_write_failed" });
    assert.equal(sofiaWrites, 2);
    assert.deepEqual({
      workspace: values.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: values.get(SUPER_TEACHER_CHAT_KEY),
      teaching: values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    }, {
      workspace: workspaceRaw,
      sofia: initialSofiaRaw,
      teaching: teachingRaw,
    });
  });

  it("rolls Sofia back when the final workspace CAS changes after write verification", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const changedWorkspaceRaw = `${workspaceRaw}\n`;
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSofiaRaw = JSON.stringify(emptySession());
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    let workspaceReads = 0;
    let sofiaWrites = 0;
    const result = await commitProvisionalHandoffPacket({
      storage: {
        getItem(key: string) {
          if (key === CANONICAL_LEARNER_STORAGE_KEY) {
            workspaceReads += 1;
            if (workspaceReads === 7) values.set(key, changedWorkspaceRaw);
          }
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          if (key === SUPER_TEACHER_CHAT_KEY) sofiaWrites += 1;
          values.set(key, value);
        },
        removeItem(key: string) {
          values.delete(key);
        },
      },
      expectedSession: emptySession(),
      now: () => "2026-08-10T13:05:00.000Z",
      ledgerValidator,
    });

    assert.deepEqual(result, { status: "workspace_changed_during_write" });
    assert.equal(workspaceReads, 7);
    assert.equal(sofiaWrites, 2);
    assert.equal(values.get(CANONICAL_LEARNER_STORAGE_KEY), changedWorkspaceRaw);
    assert.equal(values.get(SUPER_TEACHER_CHAT_KEY), initialSofiaRaw);
    assert.equal(values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY), teachingRaw);
    assert.equal(
      JSON.stringify((JSON.parse(values.get(CANONICAL_LEARNER_STORAGE_KEY) ?? "null") as MutableRecord).learningEvents),
      JSON.stringify(fixture.learningEvents),
    );
  });

  it("restores the prior Sofia raw when storage throws after the candidate write", async () => {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const ledgerValidator = productionProvisionalValidator(runtime);
    const workspaceRaw = JSON.stringify(fixture);
    const teachingRaw = '{"strictTeachingDraft":"byte-preserved"}';
    const initialSofiaRaw = JSON.stringify(emptySession());
    const values = new Map<string, string>([
      [CANONICAL_LEARNER_STORAGE_KEY, workspaceRaw],
      [SUPER_TEACHER_CHAT_KEY, initialSofiaRaw],
      [TEACHING_REVIEW_DEMO_STORAGE_KEY, teachingRaw],
    ]);
    let workspaceReads = 0;
    let sofiaWrites = 0;
    const result = await commitProvisionalHandoffPacket({
      storage: {
        getItem(key: string) {
          if (key === CANONICAL_LEARNER_STORAGE_KEY) {
            workspaceReads += 1;
            if (workspaceReads === 4) throw new Error("post-write workspace read failed");
          }
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          if (key === SUPER_TEACHER_CHAT_KEY) sofiaWrites += 1;
          values.set(key, value);
        },
        removeItem(key: string) {
          values.delete(key);
        },
      },
      expectedSession: emptySession(),
      now: () => "2026-08-10T13:05:00.000Z",
      ledgerValidator,
    });

    assert.deepEqual(result, { status: "storage_unavailable" });
    assert.equal(workspaceReads, 4);
    assert.equal(sofiaWrites, 2);
    assert.deepEqual({
      workspace: values.get(CANONICAL_LEARNER_STORAGE_KEY),
      sofia: values.get(SUPER_TEACHER_CHAT_KEY),
      teaching: values.get(TEACHING_REVIEW_DEMO_STORAGE_KEY),
    }, {
      workspace: workspaceRaw,
      sofia: initialSofiaRaw,
      teaching: teachingRaw,
    });
  });
});

describe("Teaching review local draft boundary", () => {
  async function readySnapshot() {
    const { fixture, runtime } = await canonicalProvisionalLedgerFixture();
    const result = await deriveFixture(fixture, runtime);
    assert.equal(result.status, "ready");
    if (result.status !== "ready") throw new TypeError("Expected a ready evidence snapshot");
    return result;
  }

  async function validDraft() {
    return createTeachingReviewDraft({
      snapshot: await readySnapshot(),
      focusSkill: "Writing",
      rationale: "保留 Writing 为下一轮重点，并请求人工复核开放作答证据。",
      category: "open_response_review",
      escalationNote: "请具备资质的人工复核写作任务、练习回执和同技能 retest 的边界。",
      sourceSnapshotSha256: "b".repeat(64),
      draftId: "123e4567-e89b-42d3-a456-426614174002",
      revision: 7,
      createdAt: PROVISIONAL_AT,
      savedAt: "2026-08-10T13:05:00.000Z",
    });
  }

  it("creates a revisioned, hash-bound draft with fixed false authority boundaries", async () => {
    const draft = await validDraft();

    assert.equal(draft.revision, 7);
    assert.equal(draft.sourceSnapshotSha256, "b".repeat(64));
    assert.equal(draft.identityVerified, false);
    assert.equal(draft.qualifiedHumanConfirmation, false);
    assert.equal(draft.canonicalLedgerWrite, false);
    assert.equal(draft.cycleClosureAttempted, false);
    assert.equal(Object.hasOwn(draft, "humanReviewReceiptId"), false);

    const serialized = serializeTeachingReviewDraft(draft);
    assert.equal(serialized.includes("humanReviewReceiptId"), false);
    assert.deepEqual(parseTeachingReviewDraft(serialized), draft);
    assert.equal(inspectTeachingReviewDraft(serialized).status, "ready");
  });

  it("strictly rejects unknown and forbidden fields plus invalid revision/hash values", async () => {
    const mutations: Array<[string, (draft: MutableRecord) => void]> = [
      ["unknown root field", (draft) => { draft.unexpectedAuthority = true; }],
      ["forbidden human receipt", (draft) => { draft.humanReviewReceiptId = "human-review-receipt-1"; }],
      ["unknown nested field", (draft) => { recordAt(draft, "recommendationDraft").teacherApproved = true; }],
      ["non-positive revision", (draft) => { draft.revision = 0; }],
      ["unsafe revision", (draft) => { draft.revision = Number.MAX_SAFE_INTEGER + 1; }],
      ["invalid source hash", (draft) => { draft.sourceSnapshotSha256 = "not-a-sha256"; }],
    ];

    for (const [label, mutate] of mutations) {
      const draft = structuredClone(await validDraft()) as unknown as MutableRecord;
      mutate(draft);
      const raw = JSON.stringify(draft);
      assert.equal(inspectTeachingReviewDraft(raw).status, "invalid", label);
      assert.equal(parseTeachingReviewDraft(raw), null, label);
    }
  });

  it("treats a present empty-string draft value as invalid rather than absent", () => {
    assert.equal(inspectTeachingReviewDraft(null).status, "empty");
    assert.equal(inspectTeachingReviewDraft("").status, "invalid");
    assert.equal(parseTeachingReviewDraft(""), null);
  });

  it("keeps canonical learner evidence and review drafts in separate storage namespaces", () => {
    assert.equal(CANONICAL_LEARNER_STORAGE_KEY, "sufeiya_workspace_v1");
    assert.equal(TEACHING_REVIEW_DEMO_STORAGE_KEY, "sufeiya_teaching_review_demo_v1");
    assert.notEqual(CANONICAL_LEARNER_STORAGE_KEY, TEACHING_REVIEW_DEMO_STORAGE_KEY);
  });
});
