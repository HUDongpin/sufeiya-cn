import {
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  READING_CONTENT_PACKAGE,
  READING_MICRO_LESSON_ID,
  RETEST_READING_TASK_IDS,
  getReadingTask,
  type ReadingSkill,
  type ReadingTaskId,
  type ReadingTaskPhase,
} from "./content";
import type { ReadingObjectiveResponse } from "./contracts";

export type ObjectiveResponseEvaluation =
  | Readonly<{
      status: "valid";
      taskId: ReadingTaskId;
      phase: ReadingTaskPhase;
      selectedOptionId: string;
      correctOptionId: string;
      isCorrect: boolean;
    }>
  | Readonly<{
      status: "invalid";
      reason: "unknown_task" | "phase_mismatch" | "unknown_option";
    }>;

export type ObjectivePhaseScore = Readonly<{
  phase: ReadingTaskPhase;
  expectedTaskCount: number;
  answeredTaskCount: number;
  correctAnswerCount: number;
  incorrectTaskIds: readonly ReadingTaskId[];
  unansweredTaskIds: readonly ReadingTaskId[];
}>;

export type ReadingEvidenceState = "evidence_insufficient" | "evidence_available";

export type BaselineEvidenceSummary = Readonly<{
  state: ReadingEvidenceState;
  basis: "objective_first_response_pattern";
  requiredBaselineResponseCount: typeof BASELINE_READING_TASK_IDS.length;
  completedBaselineResponseCount: number;
  correctBaselineResponseCount: number;
  observedTaskIds: readonly ReadingTaskId[];
  incorrectTaskIds: readonly ReadingTaskId[];
  unansweredTaskIds: readonly ReadingTaskId[];
  skillEvidence: readonly Readonly<{
    skill: ReadingSkill;
    answeredTaskCount: number;
    correctAnswerCount: number;
  }>[];
  priorityAbility: ReadingSkill | null;
}>;

export type InsufficientEvidenceRecommendation = Readonly<{
  status: "evidence_insufficient";
  requiredBaselineResponseCount: typeof BASELINE_READING_TASK_IDS.length;
  completedBaselineResponseCount: number;
  nextBaselineTaskId: (typeof BASELINE_READING_TASK_IDS)[number] | null;
}>;

export type ReadingRecommendationChain = Readonly<{
  status: "ready";
  evidence: Readonly<{
    state: "evidence_available";
    basis: "objective_first_response_pattern";
    observedTaskIds: readonly ReadingTaskId[];
    incorrectTaskIds: readonly ReadingTaskId[];
  }>;
  ability: Readonly<{
    id: ReadingSkill;
    label: string;
    reasonCode:
      | "first_incorrect_baseline_skill"
      | "higher_complexity_tie_break_after_complete_baseline";
  }>;
  resource: Readonly<{
    id: typeof READING_MICRO_LESSON_ID;
    title: string;
    contentPackageVersion: typeof READING_CONTENT_PACKAGE.version;
  }>;
  task: Readonly<{
    primaryTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
    reinforcementTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
  }>;
  retest: Readonly<{
    focusTaskId: (typeof RETEST_READING_TASK_IDS)[number];
    taskIds: readonly (typeof RETEST_READING_TASK_IDS)[number][];
    timing: "after_all_three_practice_tasks_without_answer_notes";
  }>;
}>;

export type ReadingRecommendation =
  | InsufficientEvidenceRecommendation
  | ReadingRecommendationChain;

export type RetestEvidenceSummary = Readonly<{
  state: "evidence_insufficient" | "retest_evidence_available";
  requiredRetestResponseCount: typeof RETEST_READING_TASK_IDS.length;
  completedRetestResponseCount: number;
  correctRetestResponseCount: number;
  incorrectTaskIds: readonly ReadingTaskId[];
}>;

export type PostRetestInsufficientEvidence = Readonly<{
  status: "evidence_insufficient";
  missingEvidenceStage: "baseline" | "retest";
  requiredResponseCount: number;
  completedResponseCount: number;
}>;

export type PostRetestReadingRecommendationChain = Readonly<{
  status: "updated";
  evidence: Readonly<{
    state: "retest_evidence_available";
    basis: "baseline_priority_plus_retest_first_response_pattern";
    baselinePriorityAbility: ReadingSkill;
    retestObservedTaskIds: readonly (typeof RETEST_READING_TASK_IDS)[number][];
    retestIncorrectTaskIds: readonly ReadingTaskId[];
  }>;
  ability: Readonly<{
    id: ReadingSkill;
    label: string;
    reasonCode:
      | "retest_remaining_error_overrides_baseline_priority"
      | "retest_remaining_error_confirms_baseline_priority"
      | "complete_retest_continue_reinforcement";
  }>;
  resource: Readonly<{
    id: typeof READING_MICRO_LESSON_ID;
    title: string;
    contentPackageVersion: typeof READING_CONTENT_PACKAGE.version;
  }>;
  task: Readonly<{
    primaryTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
    reinforcementTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
  }>;
  retest: Readonly<{
    completedTaskIds: readonly (typeof RETEST_READING_TASK_IDS)[number][];
    nextCheck: "new_unseen_parallel_items_after_reinforcement";
  }>;
  disposition: "target_remaining_retest_error" | "continue_reinforcement";
  claimBoundary: "same_session_objective_evidence_only";
}>;

export type PostRetestReadingRecommendation =
  | PostRetestInsufficientEvidence
  | PostRetestReadingRecommendationChain;

const expectedTaskIdsByPhase = {
  baseline: BASELINE_READING_TASK_IDS,
  practice: PRACTICE_READING_TASK_IDS,
  retest: RETEST_READING_TASK_IDS,
} as const;

const recommendationByAbility = {
  locate_explicit_evidence: {
    label: "定位原文直接证据",
    primaryTaskId: "reading_practice_return_tray",
    reinforcementTaskId: "reading_practice_reusable_cups",
    focusRetestTaskId: "reading_retest_robotics_bins",
  },
  distinguish_main_idea_from_supporting_detail: {
    label: "区分中心意思与支持细节",
    primaryTaskId: "reading_practice_notebook",
    reinforcementTaskId: "reading_practice_reusable_cups",
    focusRetestTaskId: "reading_retest_cycle_route",
  },
} as const satisfies Record<
  ReadingSkill,
  {
    label: string;
    primaryTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
    reinforcementTaskId: (typeof PRACTICE_READING_TASK_IDS)[number];
    focusRetestTaskId: (typeof RETEST_READING_TASK_IDS)[number];
  }
>;

export function evaluateObjectiveResponse(
  response: ReadingObjectiveResponse,
): ObjectiveResponseEvaluation {
  const task = getReadingTask(response.taskId);
  if (!task) return { status: "invalid", reason: "unknown_task" };
  if (task.phase !== response.phase) {
    return { status: "invalid", reason: "phase_mismatch" };
  }
  if (!task.options.some((option) => option.id === response.selectedOptionId)) {
    return { status: "invalid", reason: "unknown_option" };
  }
  return {
    status: "valid",
    taskId: task.id,
    phase: task.phase,
    selectedOptionId: response.selectedOptionId,
    correctOptionId: task.correctAnswer.optionId,
    isCorrect: response.selectedOptionId === task.correctAnswer.optionId,
  };
}

function firstValidResponsesForPhase(
  responses: readonly ReadingObjectiveResponse[],
  phase: ReadingTaskPhase,
): ReadonlyMap<ReadingTaskId, Extract<ObjectiveResponseEvaluation, { status: "valid" }>> {
  const expectedIds = new Set<string>(expectedTaskIdsByPhase[phase]);
  const firstByTask = new Map<
    ReadingTaskId,
    Extract<ObjectiveResponseEvaluation, { status: "valid" }>
  >();
  for (const response of responses) {
    if (!expectedIds.has(response.taskId) || firstByTask.has(response.taskId)) continue;
    const evaluated = evaluateObjectiveResponse(response);
    if (evaluated.status === "valid" && evaluated.phase === phase) {
      firstByTask.set(evaluated.taskId, evaluated);
    }
  }
  return firstByTask;
}

export function scoreObjectiveResponses(
  responses: readonly ReadingObjectiveResponse[],
  phase: ReadingTaskPhase,
): ObjectivePhaseScore {
  const expectedIds = expectedTaskIdsByPhase[phase];
  const firstByTask = firstValidResponsesForPhase(responses, phase);
  const incorrectTaskIds = expectedIds.filter((taskId) => {
    const result = firstByTask.get(taskId);
    return Boolean(result && !result.isCorrect);
  });
  const unansweredTaskIds = expectedIds.filter((taskId) => !firstByTask.has(taskId));
  return {
    phase,
    expectedTaskCount: expectedIds.length,
    answeredTaskCount: firstByTask.size,
    correctAnswerCount: [...firstByTask.values()].filter((result) => result.isCorrect).length,
    incorrectTaskIds,
    unansweredTaskIds,
  };
}

export function evaluateBaselineEvidence(
  responses: readonly ReadingObjectiveResponse[],
): BaselineEvidenceSummary {
  const score = scoreObjectiveResponses(responses, "baseline");
  const firstByTask = firstValidResponsesForPhase(responses, "baseline");
  const skillEvidence = READING_CONTENT_PACKAGE.objective.skills.map((skill) => {
    const relevantTasks = READING_CONTENT_PACKAGE.baseline.filter((task) =>
      task.skillMapping.includes(skill),
    );
    const relevantResponses = relevantTasks
      .map((task) => firstByTask.get(task.id))
      .filter((result): result is Extract<ObjectiveResponseEvaluation, { status: "valid" }> =>
        Boolean(result),
      );
    return {
      skill,
      answeredTaskCount: relevantResponses.length,
      correctAnswerCount: relevantResponses.filter((result) => result.isCorrect).length,
    };
  });

  const state: ReadingEvidenceState =
    score.answeredTaskCount < BASELINE_READING_TASK_IDS.length
      ? "evidence_insufficient"
      : "evidence_available";

  let priorityAbility: ReadingSkill | null = null;
  if (state === "evidence_available") {
    const explicitEvidence = skillEvidence.find(
      (entry) => entry.skill === "locate_explicit_evidence",
    );
    const mainIdea = skillEvidence.find(
      (entry) => entry.skill === "distinguish_main_idea_from_supporting_detail",
    );
    priorityAbility =
      explicitEvidence && mainIdea && explicitEvidence.correctAnswerCount < mainIdea.correctAnswerCount
        ? "locate_explicit_evidence"
        : "distinguish_main_idea_from_supporting_detail";
  }

  return {
    state,
    basis: "objective_first_response_pattern",
    requiredBaselineResponseCount: BASELINE_READING_TASK_IDS.length,
    completedBaselineResponseCount: score.answeredTaskCount,
    correctBaselineResponseCount: score.correctAnswerCount,
    observedTaskIds: BASELINE_READING_TASK_IDS.filter((taskId) => firstByTask.has(taskId)),
    incorrectTaskIds: score.incorrectTaskIds,
    unansweredTaskIds: score.unansweredTaskIds,
    skillEvidence,
    priorityAbility,
  };
}

export function buildReadingRecommendation(
  evidence: BaselineEvidenceSummary,
): ReadingRecommendation {
  if (evidence.state === "evidence_insufficient" || !evidence.priorityAbility) {
    return {
      status: "evidence_insufficient",
      requiredBaselineResponseCount: BASELINE_READING_TASK_IDS.length,
      completedBaselineResponseCount: evidence.completedBaselineResponseCount,
      nextBaselineTaskId:
        (evidence.unansweredTaskIds[0] as (typeof BASELINE_READING_TASK_IDS)[number] | undefined) ??
        null,
    };
  }

  const mapping = recommendationByAbility[evidence.priorityAbility];
  const firstIncorrectTask = evidence.incorrectTaskIds[0];
  const firstIncorrectTaskSkill = firstIncorrectTask
    ? getReadingTask(firstIncorrectTask)?.skillMapping[0]
    : undefined;
  const reasonCode =
    firstIncorrectTaskSkill === evidence.priorityAbility
      ? "first_incorrect_baseline_skill"
      : "higher_complexity_tie_break_after_complete_baseline";

  return {
    status: "ready",
    evidence: {
      state: "evidence_available",
      basis: evidence.basis,
      observedTaskIds: evidence.observedTaskIds,
      incorrectTaskIds: evidence.incorrectTaskIds,
    },
    ability: {
      id: evidence.priorityAbility,
      label: mapping.label,
      reasonCode,
    },
    resource: {
      id: READING_MICRO_LESSON_ID,
      title: READING_CONTENT_PACKAGE.microLesson.title,
      contentPackageVersion: READING_CONTENT_PACKAGE.version,
    },
    task: {
      primaryTaskId: mapping.primaryTaskId,
      reinforcementTaskId: mapping.reinforcementTaskId,
    },
    retest: {
      focusTaskId: mapping.focusRetestTaskId,
      taskIds: [...RETEST_READING_TASK_IDS],
      timing: "after_all_three_practice_tasks_without_answer_notes",
    },
  };
}

export function buildReadingRecommendationFromResponses(
  responses: readonly ReadingObjectiveResponse[],
): ReadingRecommendation {
  return buildReadingRecommendation(evaluateBaselineEvidence(responses));
}

export function evaluateRetestEvidence(
  responses: readonly ReadingObjectiveResponse[],
): RetestEvidenceSummary {
  const score = scoreObjectiveResponses(responses, "retest");
  return {
    state:
      score.answeredTaskCount < RETEST_READING_TASK_IDS.length
        ? "evidence_insufficient"
        : "retest_evidence_available",
    requiredRetestResponseCount: RETEST_READING_TASK_IDS.length,
    completedRetestResponseCount: score.answeredTaskCount,
    correctRetestResponseCount: score.correctAnswerCount,
    incorrectTaskIds: score.incorrectTaskIds,
  };
}

export function updateReadingRecommendationAfterRetest(
  responses: readonly ReadingObjectiveResponse[],
): PostRetestReadingRecommendation {
  const baselineEvidence = evaluateBaselineEvidence(responses);
  if (baselineEvidence.state === "evidence_insufficient" || !baselineEvidence.priorityAbility) {
    return {
      status: "evidence_insufficient",
      missingEvidenceStage: "baseline",
      requiredResponseCount: baselineEvidence.requiredBaselineResponseCount,
      completedResponseCount: baselineEvidence.completedBaselineResponseCount,
    };
  }

  const retestEvidence = evaluateRetestEvidence(responses);
  if (retestEvidence.state === "evidence_insufficient") {
    return {
      status: "evidence_insufficient",
      missingEvidenceStage: "retest",
      requiredResponseCount: retestEvidence.requiredRetestResponseCount,
      completedResponseCount: retestEvidence.completedRetestResponseCount,
    };
  }

  const firstRemainingRetestError = retestEvidence.incorrectTaskIds[0];
  const remainingErrorAbility = firstRemainingRetestError
    ? getReadingTask(firstRemainingRetestError)?.skillMapping[0]
    : undefined;
  const updatedAbility = remainingErrorAbility ?? baselineEvidence.priorityAbility;
  const mapping = recommendationByAbility[updatedAbility];
  const reasonCode = remainingErrorAbility
    ? remainingErrorAbility === baselineEvidence.priorityAbility
      ? "retest_remaining_error_confirms_baseline_priority"
      : "retest_remaining_error_overrides_baseline_priority"
    : "complete_retest_continue_reinforcement";

  return {
    status: "updated",
    evidence: {
      state: "retest_evidence_available",
      basis: "baseline_priority_plus_retest_first_response_pattern",
      baselinePriorityAbility: baselineEvidence.priorityAbility,
      retestObservedTaskIds: [...RETEST_READING_TASK_IDS],
      retestIncorrectTaskIds: retestEvidence.incorrectTaskIds,
    },
    ability: {
      id: updatedAbility,
      label: mapping.label,
      reasonCode,
    },
    resource: {
      id: READING_MICRO_LESSON_ID,
      title: READING_CONTENT_PACKAGE.microLesson.title,
      contentPackageVersion: READING_CONTENT_PACKAGE.version,
    },
    task: {
      primaryTaskId: mapping.primaryTaskId,
      reinforcementTaskId: mapping.reinforcementTaskId,
    },
    retest: {
      completedTaskIds: [...RETEST_READING_TASK_IDS],
      nextCheck: "new_unseen_parallel_items_after_reinforcement",
    },
    disposition: remainingErrorAbility
      ? "target_remaining_retest_error"
      : "continue_reinforcement",
    claimBoundary: "same_session_objective_evidence_only",
  };
}
