import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_READING_TASKS,
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  READING_CONTENT_PACKAGE,
  READING_CONTENT_PACKAGE_VERSION,
  READING_CONTENT_RIGHTS_STATUS,
  READING_CONTENT_REVIEW_STATUS,
  READING_CONTENT_SOURCE,
  READING_MICRO_LESSON_ID,
  RETEST_READING_TASK_IDS,
  getReadingTask,
  type ReadingTaskId,
} from "../lib/public-learning/content";
import {
  PUBLIC_LEARNING_EVENTS_NAMESPACE,
  PUBLIC_LEARNING_EVENT_DISPATCH_MODE,
  PUBLIC_LEARNING_EVENT_NAMES,
  PUBLIC_READING_CONTINUATIONS,
  PUBLIC_READING_STORAGE_NAMESPACE,
  createEmptyPublicReadingState,
  createPublicLearningEvent,
  parsePublicLearningEvent,
  parsePublicReadingState,
  publicLearningEventSchema,
  publicReadingStateSchema,
  serializePublicReadingState,
  type PublicLearningEventInput,
  type ReadingObjectiveResponse,
} from "../lib/public-learning/contracts";
import {
  buildReadingRecommendation,
  evaluateBaselineEvidence,
  evaluateObjectiveResponse,
  evaluateRetestEvidence,
  scoreObjectiveResponses,
  updateReadingRecommendationAfterRetest,
} from "../lib/public-learning/evaluation";

function responseFor(taskId: ReadingTaskId, correct: boolean): ReadingObjectiveResponse {
  const task = getReadingTask(taskId);
  assert.ok(task);
  const selectedOptionId = correct
    ? task.correctAnswer.optionId
    : task.options.find((option) => option.id !== task.correctAnswer.optionId)?.id;
  assert.ok(selectedOptionId);
  return {
    taskId,
    phase: task.phase,
    selectedOptionId,
  };
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function responsesThrough(count: number, correct = true): ReadingObjectiveResponse[] {
  return ALL_READING_TASKS.slice(0, count).map((task) => responseFor(task.id, correct));
}

describe("public Reading P0 content package", () => {
  it("is one versioned, original, teacher-review-pending objective-response slice", () => {
    assert.equal(READING_CONTENT_PACKAGE.version, READING_CONTENT_PACKAGE_VERSION);
    assert.equal(READING_CONTENT_PACKAGE.version, "reading_p0_original_v1");
    assert.equal(READING_CONTENT_PACKAGE.source, "original_first_party_draft");
    assert.equal(READING_CONTENT_PACKAGE.reviewStatus, "draft_pending_teacher_review");
    assert.equal(READING_CONTENT_PACKAGE.reviewer, null);
    assert.equal(
      READING_CONTENT_PACKAGE.rightsStatus,
      "pending_content_owner_confirmation",
    );
    assert.equal(READING_CONTENT_PACKAGE.releaseDisposition, "not_release_ready");
    assert.equal(
      READING_CONTENT_PACKAGE.learnerEvidenceBoundary,
      "local_objective_response_evidence_only",
    );
    assert.deepEqual(READING_CONTENT_PACKAGE.objective.skills, [
      "locate_explicit_evidence",
      "distinguish_main_idea_from_supporting_detail",
    ]);
    assert.equal(READING_CONTENT_PACKAGE.baseline.length, 2);
    assert.equal(READING_CONTENT_PACKAGE.practice.length, 3);
    assert.equal(READING_CONTENT_PACKAGE.retest.length, 2);
    assert.equal(ALL_READING_TASKS.length, 7);
    assert.ok(Object.isFrozen(READING_CONTENT_PACKAGE));
    assert.ok(Object.isFrozen(READING_CONTENT_PACKAGE.baseline));
    assert.ok(Object.isFrozen(ALL_READING_TASKS[0]));
    assert.ok(
      ALL_READING_TASKS.every(
        (task) =>
          task.source === READING_CONTENT_SOURCE &&
          task.reviewStatus === READING_CONTENT_REVIEW_STATUS &&
          task.contentPackageVersion === READING_CONTENT_PACKAGE_VERSION &&
          task.reviewer === null &&
          task.rightsStatus === READING_CONTENT_RIGHTS_STATUS,
      ),
    );
    assert.equal(READING_CONTENT_PACKAGE.microLesson.source, READING_CONTENT_SOURCE);
    assert.equal(READING_CONTENT_PACKAGE.microLesson.reviewer, null);
    assert.equal(
      READING_CONTENT_PACKAGE.microLesson.rightsStatus,
      READING_CONTENT_RIGHTS_STATUS,
    );
    assert.equal(
      READING_CONTENT_PACKAGE.microLesson.contentPackageVersion,
      READING_CONTENT_PACKAGE_VERSION,
    );
    assert.equal(
      READING_CONTENT_PACKAGE.microLesson.reviewStatus,
      READING_CONTENT_REVIEW_STATUS,
    );
  });

  it("keeps baseline, practice, and independent retest items, passages, text, and all IDs unique", () => {
    const taskIds = ALL_READING_TASKS.map((task) => task.id);
    const passageIds = ALL_READING_TASKS.map((task) => task.passage.id);
    const passageTexts = ALL_READING_TASKS.map((task) => task.passage.text);
    const optionIds = ALL_READING_TASKS.flatMap((task) =>
      task.options.map((option) => option.id),
    );
    const everyId = [...taskIds, ...passageIds, ...optionIds, READING_MICRO_LESSON_ID];

    assert.equal(new Set(taskIds).size, 7);
    assert.equal(new Set(passageIds).size, 7);
    assert.equal(new Set(passageTexts).size, 7);
    assert.equal(new Set(optionIds).size, optionIds.length);
    assert.equal(new Set(everyId).size, everyId.length);

    const phaseSets = [
      new Set(BASELINE_READING_TASK_IDS),
      new Set(PRACTICE_READING_TASK_IDS),
      new Set(RETEST_READING_TASK_IDS),
    ];
    for (let left = 0; left < phaseSets.length; left += 1) {
      for (let right = left + 1; right < phaseSets.length; right += 1) {
        assert.deepEqual(
          [...phaseSets[left]!].filter((id) => phaseSets[right]!.has(id as never)),
          [],
        );
      }
    }
    assert.ok(READING_CONTENT_PACKAGE.baseline.every((task) => task.phase === "baseline"));
    assert.ok(READING_CONTENT_PACKAGE.practice.every((task) => task.phase === "practice"));
    assert.ok(READING_CONTENT_PACKAGE.retest.every((task) => task.phase === "retest"));
    assert.ok(READING_CONTENT_PACKAGE.retest.every((task) => task.difficultyIntent.level === "independent"));
  });

  it("binds every answer, distractor, difficulty intent, skill map, and five-part wrong feedback", () => {
    for (const task of ALL_READING_TASKS) {
      assert.ok(task.skillMapping.length >= 1);
      assert.ok(nonEmpty(task.difficultyIntent.description));
      assert.ok(task.options.length >= 3);
      assert.ok(task.options.some((option) => option.id === task.correctAnswer.optionId));
      assert.ok(nonEmpty(task.correctAnswer.rationale));

      const distractorIds = task.options
        .filter((option) => option.id !== task.correctAnswer.optionId)
        .map((option) => option.id)
        .sort();
      assert.deepEqual(
        task.distractorRationales.map((entry) => entry.optionId).sort(),
        distractorIds,
      );
      assert.ok(task.distractorRationales.every((entry) => nonEmpty(entry.rationale)));

      assert.ok(nonEmpty(task.wrongFeedback.misconception));
      assert.ok(nonEmpty(task.wrongFeedback.whyCorrect));
      assert.deepEqual(
        task.wrongFeedback.whyOthersWrong.map((entry) => entry.optionId).sort(),
        distractorIds,
      );
      assert.ok(
        task.wrongFeedback.whyOthersWrong.every((entry) => nonEmpty(entry.explanation)),
      );
      assert.equal(task.wrongFeedback.lessonRef, READING_MICRO_LESSON_ID);
      assert.ok(nonEmpty(task.wrongFeedback.immediatePractice));
      assert.ok(nonEmpty(task.wrongFeedback.retestTiming));
    }
  });

  it("contains no score-equivalence, formal-assessment, outcome-proof, or guarantee claims", () => {
    const serializedContent = JSON.stringify(READING_CONTENT_PACKAGE);
    const prohibitedClaims = [
      /official\s+det/i,
      /det.{0,24}score/i,
      /formal\s+diagnos/i,
      /proof\s+of\s+growth/i,
      /guaranteed?\s+(?:result|outcome)/i,
      /官方.{0,12}(?:分数|等值)/,
      /正式诊断/,
      /增长证明/,
      /结果保证/,
      /自动评分/,
    ];
    for (const claim of prohibitedClaims) {
      assert.equal(claim.test(serializedContent), false, `content matched ${String(claim)}`);
    }
  });
});

describe("versioned local Reading state contract", () => {
  it("round-trips the empty state in its own browser-local namespace", () => {
    const state = createEmptyPublicReadingState();
    assert.equal(state.protocolVersion, PUBLIC_READING_STORAGE_NAMESPACE);
    assert.equal(state.protocolVersion, "sufeiya_public_reading_p0_v1");
    assert.equal(state.storageMode, "browser_local_not_account_bound");
    assert.deepEqual(state.responses, []);

    const parsed = parsePublicReadingState(serializePublicReadingState(state));
    assert.equal(parsed.success, true);
    if (parsed.success) assert.deepEqual(parsed.data, state);
  });

  it("fails safely for missing, corrupt, unsupported-version, and invalid stored state", () => {
    const missing = parsePublicReadingState(null);
    assert.deepEqual(missing.success ? null : missing.reason, "missing");

    const corrupt = parsePublicReadingState("{not-json");
    assert.deepEqual(corrupt.success ? null : corrupt.reason, "corrupt");

    const unknownVersion = parsePublicReadingState({
      ...createEmptyPublicReadingState(),
      protocolVersion: "sufeiya_public_reading_p0_v2",
    });
    assert.deepEqual(unknownVersion.success ? null : unknownVersion.reason, "unknown_version");

    const invalid = parsePublicReadingState({
      ...createEmptyPublicReadingState(),
      learnerEmail: "not-allowed@example.test",
    });
    assert.deepEqual(invalid.success ? null : invalid.reason, "invalid");

    const duplicateResponse = responseFor(BASELINE_READING_TASK_IDS[0], true);
    assert.equal(
      publicReadingStateSchema.safeParse({
        ...createEmptyPublicReadingState(),
        responses: [duplicateResponse, duplicateResponse],
      }).success,
      false,
    );
    assert.equal(
      publicReadingStateSchema.safeParse({
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: null,
      }).success,
      false,
    );
    assert.equal(
      publicReadingStateSchema.safeParse({
        ...createEmptyPublicReadingState(),
        currentStep: "continuation",
        continuation: null,
      }).success,
      false,
    );
  });

  it("accepts only workflow states supported by an ordered objective-evidence prefix", () => {
    const validStates: unknown[] = [
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[0],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[0],
        responses: responsesThrough(1),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[1],
        responses: responsesThrough(1),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[1],
        responses: responsesThrough(2),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "lesson",
        responses: responsesThrough(2),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[0],
        responses: responsesThrough(2),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[0],
        responses: responsesThrough(3),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[1],
        responses: responsesThrough(3),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[2],
        responses: responsesThrough(5),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "feedback",
        responses: responsesThrough(5),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "retest",
        activeTaskId: RETEST_READING_TASK_IDS[0],
        responses: responsesThrough(5),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "retest",
        activeTaskId: RETEST_READING_TASK_IDS[0],
        responses: responsesThrough(6),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "retest",
        activeTaskId: RETEST_READING_TASK_IDS[1],
        responses: responsesThrough(6),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "retest",
        activeTaskId: RETEST_READING_TASK_IDS[1],
        responses: responsesThrough(7),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "plan",
        responses: responsesThrough(7),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "continuation",
        responses: responsesThrough(7),
        continuation: "local_continue",
      },
    ];

    for (const state of validStates) {
      const parsed = parsePublicReadingState(state);
      assert.equal(
        parsed.success,
        true,
        parsed.success ? undefined : parsed.issues.join("; "),
      );
    }
  });

  it("fails closed for unsupported stages, response holes, and out-of-order evidence", () => {
    const firstBaseline = responseFor(BASELINE_READING_TASK_IDS[0], true);
    const secondBaseline = responseFor(BASELINE_READING_TASK_IDS[1], true);
    const firstPractice = responseFor(PRACTICE_READING_TASK_IDS[0], true);
    const secondPractice = responseFor(PRACTICE_READING_TASK_IDS[1], true);
    const invalidStates: unknown[] = [
      {
        ...createEmptyPublicReadingState(),
        currentStep: "plan",
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[0],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "feedback",
        responses: [firstBaseline, secondBaseline],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[1],
        responses: [secondBaseline],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[1],
        responses: [secondBaseline, firstBaseline],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "lesson",
        responses: [firstBaseline, firstPractice],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[1],
        responses: [firstBaseline, secondBaseline, secondPractice],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "feedback",
        responses: [
          firstBaseline,
          secondBaseline,
          secondPractice,
          firstPractice,
          responseFor(PRACTICE_READING_TASK_IDS[2], true),
        ],
      },
    ];

    for (const state of invalidStates) {
      const parsed = parsePublicReadingState(state);
      assert.equal(parsed.success, false);
      if (!parsed.success) assert.equal(parsed.reason, "invalid");
    }
  });

  it("rejects active tasks that do not sit at the current evidence boundary", () => {
    const invalidActiveStates: unknown[] = [
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[1],
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "baseline",
        activeTaskId: BASELINE_READING_TASK_IDS[0],
        responses: responsesThrough(2),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[1],
        responses: responsesThrough(2),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "practice",
        activeTaskId: PRACTICE_READING_TASK_IDS[0],
        responses: responsesThrough(4),
      },
      {
        ...createEmptyPublicReadingState(),
        currentStep: "retest",
        activeTaskId: RETEST_READING_TASK_IDS[1],
        responses: responsesThrough(5),
      },
    ];

    for (const state of invalidActiveStates) {
      assert.equal(publicReadingStateSchema.safeParse(state).success, false);
    }
  });
});

describe("deterministic objective evidence and recommendation", () => {
  it("returns evidence_insufficient for fewer than two valid baseline objective responses", () => {
    const none = evaluateBaselineEvidence([]);
    assert.equal(none.state, "evidence_insufficient");
    assert.equal(none.completedBaselineResponseCount, 0);
    assert.equal(none.priorityAbility, null);

    const one = evaluateBaselineEvidence([responseFor(BASELINE_READING_TASK_IDS[0], true)]);
    assert.equal(one.state, "evidence_insufficient");
    assert.equal(one.completedBaselineResponseCount, 1);
    assert.equal(one.priorityAbility, null);

    const recommendation = buildReadingRecommendation(one);
    assert.deepEqual(recommendation, {
      status: "evidence_insufficient",
      requiredBaselineResponseCount: 2,
      completedBaselineResponseCount: 1,
      nextBaselineTaskId: BASELINE_READING_TASK_IDS[1],
    });
  });

  it("scores versioned answers, keeps the first response, and deterministically selects an ability", () => {
    const explicitWrong = responseFor(BASELINE_READING_TASK_IDS[0], false);
    const explicitCorrectSecondAttempt = responseFor(BASELINE_READING_TASK_IDS[0], true);
    const mainIdeaCorrect = responseFor(BASELINE_READING_TASK_IDS[1], true);
    const responses = [explicitWrong, explicitCorrectSecondAttempt, mainIdeaCorrect];

    assert.deepEqual(evaluateObjectiveResponse(explicitWrong), {
      status: "valid",
      taskId: explicitWrong.taskId,
      phase: "baseline",
      selectedOptionId: explicitWrong.selectedOptionId,
      correctOptionId: getReadingTask(explicitWrong.taskId)?.correctAnswer.optionId,
      isCorrect: false,
    });

    const score = scoreObjectiveResponses(responses, "baseline");
    assert.equal(score.answeredTaskCount, 2);
    assert.equal(score.correctAnswerCount, 1);
    assert.deepEqual(score.incorrectTaskIds, [BASELINE_READING_TASK_IDS[0]]);

    const evidence = evaluateBaselineEvidence(responses);
    assert.equal(evidence.state, "evidence_available");
    assert.equal(evidence.priorityAbility, "locate_explicit_evidence");

    const allCorrect = evaluateBaselineEvidence([
      responseFor(BASELINE_READING_TASK_IDS[0], true),
      responseFor(BASELINE_READING_TASK_IDS[1], true),
    ]);
    assert.equal(
      allCorrect.priorityAbility,
      "distinguish_main_idea_from_supporting_detail",
    );
  });

  it("produces the complete evidence to ability to resource to task to retest chain", () => {
    const evidence = evaluateBaselineEvidence([
      responseFor(BASELINE_READING_TASK_IDS[0], false),
      responseFor(BASELINE_READING_TASK_IDS[1], true),
    ]);
    const recommendation = buildReadingRecommendation(evidence);
    assert.equal(recommendation.status, "ready");
    if (recommendation.status !== "ready") return;

    assert.deepEqual(Object.keys(recommendation), [
      "status",
      "evidence",
      "ability",
      "resource",
      "task",
      "retest",
    ]);
    assert.equal(recommendation.evidence.state, "evidence_available");
    assert.equal(recommendation.ability.id, "locate_explicit_evidence");
    assert.equal(recommendation.resource.id, READING_MICRO_LESSON_ID);
    assert.equal(recommendation.resource.contentPackageVersion, READING_CONTENT_PACKAGE_VERSION);
    assert.ok(PRACTICE_READING_TASK_IDS.includes(recommendation.task.primaryTaskId));
    assert.ok(PRACTICE_READING_TASK_IDS.includes(recommendation.task.reinforcementTaskId));
    assert.ok(RETEST_READING_TASK_IDS.includes(recommendation.retest.focusTaskId));
    assert.deepEqual(recommendation.retest.taskIds, [...RETEST_READING_TASK_IDS]);
    assert.equal(
      recommendation.retest.timing,
      "after_all_three_practice_tasks_without_answer_notes",
    );
  });

  it("reports retest evidence on its own independent items without outcome comparison", () => {
    const oneRetest = evaluateRetestEvidence([responseFor(RETEST_READING_TASK_IDS[0], true)]);
    assert.equal(oneRetest.state, "evidence_insufficient");
    assert.equal(oneRetest.completedRetestResponseCount, 1);

    const completeRetest = evaluateRetestEvidence([
      responseFor(RETEST_READING_TASK_IDS[0], true),
      responseFor(RETEST_READING_TASK_IDS[1], false),
    ]);
    assert.deepEqual(completeRetest, {
      state: "retest_evidence_available",
      requiredRetestResponseCount: 2,
      completedRetestResponseCount: 2,
      correctRetestResponseCount: 1,
      incorrectTaskIds: [RETEST_READING_TASK_IDS[1]],
    });
  });

  it("keeps the post-retest update closed until baseline and both retest first responses exist", () => {
    assert.deepEqual(updateReadingRecommendationAfterRetest([]), {
      status: "evidence_insufficient",
      missingEvidenceStage: "baseline",
      requiredResponseCount: 2,
      completedResponseCount: 0,
    });

    assert.deepEqual(updateReadingRecommendationAfterRetest(responsesThrough(6)), {
      status: "evidence_insufficient",
      missingEvidenceStage: "retest",
      requiredResponseCount: 2,
      completedResponseCount: 1,
    });
  });

  it("updates a conflicting baseline priority from the remaining retest error", () => {
    const responses = [
      responseFor(BASELINE_READING_TASK_IDS[0], false),
      responseFor(BASELINE_READING_TASK_IDS[1], true),
      ...PRACTICE_READING_TASK_IDS.map((taskId) => responseFor(taskId, true)),
      responseFor(RETEST_READING_TASK_IDS[0], true),
      responseFor(RETEST_READING_TASK_IDS[1], false),
    ];
    const baselineRecommendation = buildReadingRecommendation(
      evaluateBaselineEvidence(responses),
    );
    assert.equal(baselineRecommendation.status, "ready");
    if (baselineRecommendation.status !== "ready") return;
    assert.equal(baselineRecommendation.ability.id, "locate_explicit_evidence");

    const updated = updateReadingRecommendationAfterRetest(responses);
    assert.equal(updated.status, "updated");
    if (updated.status !== "updated") return;
    assert.deepEqual(Object.keys(updated), [
      "status",
      "evidence",
      "ability",
      "resource",
      "task",
      "retest",
      "disposition",
      "claimBoundary",
    ]);
    assert.equal(updated.evidence.baselinePriorityAbility, "locate_explicit_evidence");
    assert.deepEqual(updated.evidence.retestIncorrectTaskIds, [RETEST_READING_TASK_IDS[1]]);
    assert.equal(updated.ability.id, "distinguish_main_idea_from_supporting_detail");
    assert.equal(
      updated.ability.reasonCode,
      "retest_remaining_error_overrides_baseline_priority",
    );
    assert.equal(updated.task.primaryTaskId, "reading_practice_notebook");
    assert.equal(updated.disposition, "target_remaining_retest_error");
    assert.equal(updated.claimBoundary, "same_session_objective_evidence_only");
  });

  it("uses each retest task's first response and continues reinforcement when both are correct", () => {
    const firstResponseWins = updateReadingRecommendationAfterRetest([
      ...responsesThrough(5),
      responseFor(RETEST_READING_TASK_IDS[0], false),
      responseFor(RETEST_READING_TASK_IDS[0], true),
      responseFor(RETEST_READING_TASK_IDS[1], true),
    ]);
    assert.equal(firstResponseWins.status, "updated");
    if (firstResponseWins.status === "updated") {
      assert.deepEqual(firstResponseWins.evidence.retestIncorrectTaskIds, [
        RETEST_READING_TASK_IDS[0],
      ]);
      assert.equal(firstResponseWins.ability.id, "locate_explicit_evidence");
      assert.equal(
        firstResponseWins.ability.reasonCode,
        "retest_remaining_error_overrides_baseline_priority",
      );
    }

    const allCorrect = updateReadingRecommendationAfterRetest(responsesThrough(7));
    assert.equal(allCorrect.status, "updated");
    if (allCorrect.status !== "updated") return;
    assert.deepEqual(allCorrect.evidence.retestIncorrectTaskIds, []);
    assert.equal(
      allCorrect.ability.id,
      "distinguish_main_idea_from_supporting_detail",
    );
    assert.equal(
      allCorrect.ability.reasonCode,
      "complete_retest_continue_reinforcement",
    );
    assert.equal(allCorrect.disposition, "continue_reinforcement");
    assert.equal(allCorrect.claimBoundary, "same_session_objective_evidence_only");
    assert.equal(/growth|diagnos|official|guarantee/i.test(JSON.stringify(allCorrect)), false);
  });
});

describe("minimal public-learning event contract", () => {
  const eventInputs: readonly PublicLearningEventInput[] = [
    {
      sequence: 0,
      eventName: "learning_entry_viewed",
      payload: { entryPoint: "homepage_primary" },
    },
    {
      sequence: 1,
      eventName: "first_task_started",
      payload: { taskId: BASELINE_READING_TASK_IDS[0] },
    },
    {
      sequence: 2,
      eventName: "task_answered",
      payload: {
        ...responseFor(BASELINE_READING_TASK_IDS[0], true),
        answerState: "correct",
      },
    },
    {
      sequence: 3,
      eventName: "feedback_viewed",
      payload: {
        taskId: BASELINE_READING_TASK_IDS[0],
        feedbackType: "correct_confirmation",
      },
    },
    {
      sequence: 4,
      eventName: "next_task_started",
      payload: { taskId: PRACTICE_READING_TASK_IDS[0], phase: "practice" },
    },
    {
      sequence: 5,
      eventName: "practice_completed",
      payload: { answeredTaskCount: 3, correctAnswerCount: 2 },
    },
    {
      sequence: 6,
      eventName: "retest_started",
      payload: { taskId: RETEST_READING_TASK_IDS[0] },
    },
    {
      sequence: 7,
      eventName: "retest_completed",
      payload: { answeredTaskCount: 2, correctAnswerCount: 1 },
    },
    {
      sequence: 8,
      eventName: "plan_offered",
      payload: {
        evidenceState: "evidence_available",
        ability: "locate_explicit_evidence",
        resourceId: READING_MICRO_LESSON_ID,
        taskId: PRACTICE_READING_TASK_IDS[0],
        retestTaskId: RETEST_READING_TASK_IDS[0],
      },
    },
    {
      sequence: 9,
      eventName: "post_value_continuation_started",
      payload: { continuation: "local_continue" },
    },
  ];

  it("implements exactly the plan's minimal event names in a separate versioned namespace", () => {
    assert.equal(PUBLIC_LEARNING_EVENTS_NAMESPACE, "sufeiya_public_learning_events_v1");
    assert.notEqual(PUBLIC_LEARNING_EVENTS_NAMESPACE, PUBLIC_READING_STORAGE_NAMESPACE);
    assert.deepEqual(PUBLIC_LEARNING_EVENT_NAMES, [
      "learning_entry_viewed",
      "first_task_started",
      "task_answered",
      "feedback_viewed",
      "next_task_started",
      "practice_completed",
      "retest_started",
      "retest_completed",
      "plan_offered",
      "post_value_continuation_started",
    ]);
    assert.deepEqual(
      eventInputs.map((input) => input.eventName),
      [...PUBLIC_LEARNING_EVENT_NAMES],
    );

    for (const input of eventInputs) {
      const event = createPublicLearningEvent(input);
      assert.equal(event.protocolVersion, PUBLIC_LEARNING_EVENTS_NAMESPACE);
      assert.equal(event.contentPackageVersion, READING_CONTENT_PACKAGE_VERSION);
      assert.equal(event.dispatchMode, PUBLIC_LEARNING_EVENT_DISPATCH_MODE);
      assert.equal(event.dispatchMode, "local_only_no_network");
      assert.equal(publicLearningEventSchema.safeParse(event).success, true);
      assert.equal(parsePublicLearningEvent(JSON.stringify(event)).success, true);
    }
  });

  it("rejects unknown, sensitive, identity, and free-text payload fields", () => {
    const validAnswered = createPublicLearningEvent(eventInputs[2]!);
    for (const prohibitedField of [
      { learnerEmail: "learner@example.test" },
      { accountId: "acct_123" },
      { learnerName: "Example Learner" },
      { openResponse: "my full answer" },
      { recording: "audio bytes" },
      { note: "arbitrary analytics note" },
    ]) {
      assert.equal(
        publicLearningEventSchema.safeParse({
          ...validAnswered,
          payload: { ...validAnswered.payload, ...prohibitedField },
        }).success,
        false,
      );
    }
    assert.equal(
      publicLearningEventSchema.safeParse({ ...validAnswered, accountId: "acct_123" }).success,
      false,
    );

    const incorrectIntegrity = {
      ...validAnswered,
      payload: { ...validAnswered.payload, answerState: "incorrect" },
    };
    assert.equal(publicLearningEventSchema.safeParse(incorrectIntegrity).success, false);
  });

  it("fails safely for missing, corrupt, unknown-version, and invalid events", () => {
    const missing = parsePublicLearningEvent(undefined);
    assert.equal(missing.success ? null : missing.reason, "missing");

    const corrupt = parsePublicLearningEvent("[broken");
    assert.equal(corrupt.success ? null : corrupt.reason, "corrupt");

    const event = createPublicLearningEvent(eventInputs[0]!);
    const unknown = parsePublicLearningEvent({
      ...event,
      protocolVersion: "sufeiya_public_learning_events_v2",
    });
    assert.equal(unknown.success ? null : unknown.reason, "unknown_version");

    const invalid = parsePublicLearningEvent({
      ...event,
      payload: { ...event.payload, arbitraryText: "not allowed" },
    });
    assert.equal(invalid.success ? null : invalid.reason, "invalid");
  });

  it("allows only the four currently approved continuation choices", () => {
    assert.deepEqual(PUBLIC_READING_CONTINUATIONS, [
      "local_continue",
      "local_export",
      "invite_login",
      "waitlist",
    ]);

    const state = {
      ...createEmptyPublicReadingState(),
      currentStep: "continuation" as const,
      responses: responsesThrough(7),
    };
    for (const continuation of PUBLIC_READING_CONTINUATIONS) {
      assert.equal(
        publicReadingStateSchema.safeParse({ ...state, continuation }).success,
        true,
      );
      assert.doesNotThrow(() =>
        createPublicLearningEvent({
          sequence: 10,
          eventName: "post_value_continuation_started",
          payload: { continuation },
        }),
      );
    }

    assert.equal(
      publicReadingStateSchema.safeParse({ ...state, continuation: "public_signup" }).success,
      false,
    );
    assert.throws(() =>
      createPublicLearningEvent({
        sequence: 10,
        eventName: "post_value_continuation_started",
        payload: { continuation: "public_signup" },
      } as unknown as PublicLearningEventInput),
    );
  });
});
