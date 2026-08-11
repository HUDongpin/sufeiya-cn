import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CANONICAL_LEARNER_STORAGE_KEY,
  TEACHING_REVIEW_DEMO_STORAGE_KEY,
  createTeachingReviewDraft,
  deriveTeachingReviewEvidence,
  inspectTeachingReviewDraft,
  parseTeachingReviewDraft,
  serializeTeachingReviewDraft,
} from "../lib/teaching-review-demo";

type MutableRecord = Record<string, unknown>;

const PROTOCOL_VERSION = "gate_a_local_v1";
const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
const TASK_SET_VERSION = "gate_a_original_6_v1";
const TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
const CYCLE_ID = "cycle-2026-08-10-writing-1";
const DIAGNOSTIC_SESSION_ID = "diagnostic-2026-08-10-writing-1";
const BASE_PLAN_ID = "plan-base-2026-08-10-writing-1";
const RECOMMENDATION_ID = "recommendation-2026-08-10-writing-1";
const PRIMARY_TASK_ID = "plan-task-writing-2026-08-10-1";
const CHECK_IN_ID = "check-in-2026-08-10-writing-1";
const REVIEW_ID = "review-2026-08-10-writing-1";
const PEER_HELP_ID = "peer-help-2026-08-10-writing-1";
const RETEST_ID = "retest-2026-08-10-writing-1";
const UPDATED_PLAN_ID = "plan-updated-2026-08-10-writing-1";
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
    },
  };
}

function deriveFixture(root: MutableRecord) {
  return deriveTeachingReviewEvidence(JSON.stringify(root));
}

describe("Teaching review canonical evidence boundary", () => {
  it("accepts a complete canonical provisional cycle as ready", () => {
    const result = deriveFixture(canonicalProvisionalFixture());

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

  it("rejects completed and closed history entries instead of treating them as provisional", () => {
    const completed = canonicalProvisionalFixture();
    provisionalHistoryCycle(completed).status = "completed";
    activeCycle(completed).status = "completed";
    assert.equal(deriveFixture(completed).status, "no_provisional_cycle");

    const closed = canonicalProvisionalFixture();
    provisionalHistoryCycle(closed).closedAt = PROVISIONAL_AT;
    activeCycle(closed).closedAt = PROVISIONAL_AT;
    assert.equal(deriveFixture(closed).status, "no_provisional_cycle");
  });

  it("never substitutes an older provisional history entry for the current active cycle", () => {
    const newCycleInProgress = canonicalProvisionalFixture();
    Object.assign(activeCycle(newCycleInProgress), {
      cycleId: "cycle-new-in-progress",
      diagnosticSessionId: "diagnostic-new-in-progress",
      status: "in_progress",
      provisionalAt: null,
      updatedPlanId: null,
    });
    assert.equal(deriveFixture(newCycleInProgress).status, "no_provisional_cycle");

    const mismatchedProvisional = canonicalProvisionalFixture();
    activeCycle(mismatchedProvisional).cycleId = "cycle-other-provisional";
    assert.deepEqual(deriveFixture(mismatchedProvisional), {
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
      const downstreamMismatch = canonicalProvisionalFixture();
      activeCycle(downstreamMismatch)[field] = `${field}-other`;
      assert.deepEqual(deriveFixture(downstreamMismatch), {
        status: "invalid",
        reason: "active_cycle_history_mismatch",
      }, field);
    }

    const noActiveCycle = canonicalProvisionalFixture();
    recordAt(noActiveCycle, "journey").activeCycle = null;
    assert.equal(deriveFixture(noActiveCycle).status, "no_active_cycle");
  });

  it("rejects evidence linked to another cycle", () => {
    const fixture = canonicalProvisionalFixture();
    recordAt(provisionalHistoryCycle(fixture), "retest").cycleId = "cycle-other";

    assert.deepEqual(deriveFixture(fixture), {
      status: "invalid",
      reason: "cross_cycle_evidence_rejected",
    });
  });

  it("rejects missing task-set, recommendation-binding, receipt, and retest evidence", () => {
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
      const fixture = canonicalProvisionalFixture();
      mutate(fixture);
      assert.deepEqual(deriveFixture(fixture), { status: "invalid", reason }, label);
    }
  });

  it("rejects false human-review claims, unknown quality codes, and invalid objective outcomes", () => {
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
      const fixture = canonicalProvisionalFixture();
      mutate(fixture);
      assert.deepEqual(deriveFixture(fixture), { status: "invalid", reason }, label);
    }
  });

  it("requires own-property membership and the exact six-task manifest set", () => {
    for (const inheritedKey of ["__proto__", "constructor", "toString"]) {
      const taskFixture = canonicalProvisionalFixture();
      const tasks = recordAt(provisionalHistoryCycle(taskFixture), "diagnostic").taskEvidence;
      if (!Array.isArray(tasks) || !isRecord(tasks[0])) throw new TypeError("Expected diagnostic tasks");
      tasks[0] = { ...tasks[0], taskId: inheritedKey };
      assert.deepEqual(deriveFixture(taskFixture), {
        status: "invalid",
        reason: "canonical_binding_or_plan_rejected",
      }, `diagnostic task ${inheritedKey}`);

      const bindingFixture = canonicalProvisionalFixture();
      recordAt(provisionalHistoryCycle(bindingFixture), "recommendation", "evidenceBinding").diagnosticEvidenceTaskIds = [inheritedKey];
      assert.deepEqual(deriveFixture(bindingFixture), {
        status: "invalid",
        reason: "canonical_binding_or_plan_rejected",
      }, `binding task ${inheritedKey}`);
    }
  });

  it("requires the receipt map key, embedded receipt, task progress, and check-in contract to agree", () => {
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
      const fixture = canonicalProvisionalFixture();
      mutate(fixture);
      assert.deepEqual(deriveFixture(fixture), {
        status: "invalid",
        reason: "practice_receipt_boundary_rejected",
      }, label);
    }
  });

  it("projects summaries without diagnostic answers, learner free text, or retest response text", () => {
    const fixture = canonicalProvisionalFixture();
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

    const result = deriveFixture(fixture);
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

describe("Teaching review local draft boundary", () => {
  function readySnapshot() {
    const result = deriveFixture(canonicalProvisionalFixture());
    assert.equal(result.status, "ready");
    if (result.status !== "ready") throw new TypeError("Expected a ready evidence snapshot");
    return result;
  }

  function validDraft() {
    return createTeachingReviewDraft({
      snapshot: readySnapshot(),
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

  it("creates a revisioned, hash-bound draft with fixed false authority boundaries", () => {
    const draft = validDraft();

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

  it("strictly rejects unknown and forbidden fields plus invalid revision/hash values", () => {
    const mutations: Array<[string, (draft: MutableRecord) => void]> = [
      ["unknown root field", (draft) => { draft.unexpectedAuthority = true; }],
      ["forbidden human receipt", (draft) => { draft.humanReviewReceiptId = "human-review-receipt-1"; }],
      ["unknown nested field", (draft) => { recordAt(draft, "recommendationDraft").teacherApproved = true; }],
      ["non-positive revision", (draft) => { draft.revision = 0; }],
      ["unsafe revision", (draft) => { draft.revision = Number.MAX_SAFE_INTEGER + 1; }],
      ["invalid source hash", (draft) => { draft.sourceSnapshotSha256 = "not-a-sha256"; }],
    ];

    for (const [label, mutate] of mutations) {
      const draft = structuredClone(validDraft()) as unknown as MutableRecord;
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
