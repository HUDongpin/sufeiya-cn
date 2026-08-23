import { z } from "zod";

import {
  ALL_READING_TASK_IDS,
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  READING_CONTENT_PACKAGE_VERSION,
  READING_MICRO_LESSON_ID,
  READING_SKILLS,
  RETEST_READING_TASK_IDS,
  getReadingTask,
  type ReadingTaskPhase,
} from "./content";

export const PUBLIC_READING_STORAGE_NAMESPACE = "sufeiya_public_reading_p0_v1" as const;
export const PUBLIC_LEARNING_EVENTS_NAMESPACE = "sufeiya_public_learning_events_v1" as const;
export const PUBLIC_LEARNING_EVENT_DISPATCH_MODE = "local_only_no_network" as const;

export const PUBLIC_READING_CONTINUATIONS = [
  "local_continue",
  "local_export",
  "invite_login",
  "waitlist",
] as const;

export const PUBLIC_LEARNING_EVENT_NAMES = [
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
] as const;

export type PublicReadingContinuation = (typeof PUBLIC_READING_CONTINUATIONS)[number];
export type PublicLearningEventName = (typeof PUBLIC_LEARNING_EVENT_NAMES)[number];

const readingTaskIdSchema = z.enum(ALL_READING_TASK_IDS);
const baselineTaskIdSchema = z.enum(BASELINE_READING_TASK_IDS);
const practiceTaskIdSchema = z.enum(PRACTICE_READING_TASK_IDS);
const retestTaskIdSchema = z.enum(RETEST_READING_TASK_IDS);
const readingSkillSchema = z.enum(READING_SKILLS);
const readingPhaseSchema = z.enum(["baseline", "practice", "retest"]);
const continuationSchema = z.enum(PUBLIC_READING_CONTINUATIONS);
const sequenceSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const PUBLIC_READING_STEPS = [
  "entry",
  "baseline",
  "lesson",
  "practice",
  "feedback",
  "retest",
  "plan",
  "continuation",
] as const;
type PublicReadingStep = (typeof PUBLIC_READING_STEPS)[number];

function addTaskAnswerIssues(
  answer: {
    taskId: string;
    phase: ReadingTaskPhase;
    selectedOptionId: string;
  },
  context: z.RefinementCtx,
  pathPrefix: Array<string | number> = [],
) {
  const task = getReadingTask(answer.taskId);
  if (!task) {
    context.addIssue({
      code: "custom",
      message: "Unknown Reading task.",
      path: [...pathPrefix, "taskId"],
    });
    return;
  }
  if (task.phase !== answer.phase) {
    context.addIssue({
      code: "custom",
      message: "Task phase does not match the content package.",
      path: [...pathPrefix, "phase"],
    });
  }
  if (!task.options.some((option) => option.id === answer.selectedOptionId)) {
    context.addIssue({
      code: "custom",
      message: "Selected option does not belong to the task.",
      path: [...pathPrefix, "selectedOptionId"],
    });
  }
}

export const readingObjectiveResponseSchema = z
  .object({
    taskId: readingTaskIdSchema,
    phase: readingPhaseSchema,
    selectedOptionId: z.string().trim().regex(/^[a-z][a-z0-9_]{2,119}$/),
  })
  .strict()
  .superRefine((answer, context) => addTaskAnswerIssues(answer, context));

export type ReadingObjectiveResponse = z.infer<typeof readingObjectiveResponseSchema>;

export const publicReadingStateSchema = z
  .object({
    protocolVersion: z.literal(PUBLIC_READING_STORAGE_NAMESPACE),
    contentPackageVersion: z.literal(READING_CONTENT_PACKAGE_VERSION),
    storageMode: z.literal("browser_local_not_account_bound"),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    currentStep: z.enum(PUBLIC_READING_STEPS),
    activeTaskId: readingTaskIdSchema.nullable(),
    responses: z.array(readingObjectiveResponseSchema).max(ALL_READING_TASK_IDS.length),
    continuation: continuationSchema.nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    const responseCount = state.responses.length;
    const activeTask = state.activeTaskId ? getReadingTask(state.activeTaskId) : undefined;
    const taskStep = state.currentStep === "baseline" ||
      state.currentStep === "practice" ||
      state.currentStep === "retest";
    if (taskStep && (!activeTask || activeTask.phase !== state.currentStep)) {
      context.addIssue({
        code: "custom",
        message: "A task step requires one active task from the same phase.",
        path: ["activeTaskId"],
      });
    }
    if (!taskStep && state.activeTaskId !== null) {
      context.addIssue({
        code: "custom",
        message: "A non-task step may not retain an active task.",
        path: ["activeTaskId"],
      });
    }
    if (state.currentStep === "continuation" && state.continuation === null) {
      context.addIssue({
        code: "custom",
        message: "The continuation step requires an approved continuation choice.",
        path: ["continuation"],
      });
    }
    if (state.currentStep !== "continuation" && state.continuation !== null) {
      context.addIssue({
        code: "custom",
        message: "A continuation choice may only be stored at the continuation step.",
        path: ["continuation"],
      });
    }

    const allowedResponseCounts: Readonly<Record<PublicReadingStep, readonly number[]>> = {
      entry: [0],
      baseline: [0, 1, 2],
      lesson: [2],
      practice: [2, 3, 4, 5],
      feedback: [5],
      retest: [5, 6, 7],
      plan: [7],
      continuation: [7],
    };
    if (!allowedResponseCounts[state.currentStep].includes(responseCount)) {
      context.addIssue({
        code: "custom",
        message: "The current step is not supported by the stored objective-evidence prefix.",
        path: ["currentStep"],
      });
    }

    if (taskStep && activeTask) {
      const activeTaskIndex = ALL_READING_TASK_IDS.indexOf(activeTask.id);
      const activeMatchesEvidenceBoundary =
        activeTaskIndex === responseCount || activeTaskIndex === responseCount - 1;
      if (!activeMatchesEvidenceBoundary) {
        context.addIssue({
          code: "custom",
          message: "The active task must be the next unanswered task or the just-answered task at the evidence boundary.",
          path: ["activeTaskId"],
        });
      }
    }

    const seenTaskIds = new Set<string>();
    state.responses.forEach((response, index) => {
      const expectedTaskId = ALL_READING_TASK_IDS[index];
      if (response.taskId !== expectedTaskId) {
        context.addIssue({
          code: "custom",
          message: "Stored objective responses must be the ordered, gap-free prefix of the versioned task sequence.",
          path: ["responses", index, "taskId"],
        });
      }
      if (seenTaskIds.has(response.taskId)) {
        context.addIssue({
          code: "custom",
          message: "A stored state may keep only the first objective response for each task.",
          path: ["responses", index, "taskId"],
        });
      }
      seenTaskIds.add(response.taskId);
    });
  });

export type PublicReadingState = z.infer<typeof publicReadingStateSchema>;

export function createEmptyPublicReadingState(): PublicReadingState {
  return {
    protocolVersion: PUBLIC_READING_STORAGE_NAMESPACE,
    contentPackageVersion: READING_CONTENT_PACKAGE_VERSION,
    storageMode: "browser_local_not_account_bound",
    revision: 0,
    currentStep: "entry",
    activeTaskId: null,
    responses: [],
    continuation: null,
  };
}

const eventEnvelope = {
  protocolVersion: z.literal(PUBLIC_LEARNING_EVENTS_NAMESPACE),
  contentPackageVersion: z.literal(READING_CONTENT_PACKAGE_VERSION),
  dispatchMode: z.literal(PUBLIC_LEARNING_EVENT_DISPATCH_MODE),
  sequence: sequenceSchema,
} as const;

const taskAnsweredPayloadSchema = z
  .object({
    taskId: readingTaskIdSchema,
    phase: readingPhaseSchema,
    selectedOptionId: z.string().trim().regex(/^[a-z][a-z0-9_]{2,119}$/),
    answerState: z.enum(["correct", "incorrect"]),
  })
  .strict()
  .superRefine((payload, context) => {
    addTaskAnswerIssues(payload, context);
    const task = getReadingTask(payload.taskId);
    if (task && task.options.some((option) => option.id === payload.selectedOptionId)) {
      const expectedAnswerState =
        task.correctAnswer.optionId === payload.selectedOptionId ? "correct" : "incorrect";
      if (payload.answerState !== expectedAnswerState) {
        context.addIssue({
          code: "custom",
          message: "Answer state does not match the versioned content package.",
          path: ["answerState"],
        });
      }
    }
  });

const nextTaskPayloadSchema = z
  .object({
    taskId: readingTaskIdSchema,
    phase: z.enum(["practice", "retest"]),
  })
  .strict()
  .superRefine((payload, context) => {
    const task = getReadingTask(payload.taskId);
    if (!task || task.phase !== payload.phase) {
      context.addIssue({
        code: "custom",
        message: "Next task phase does not match the versioned content package.",
        path: ["phase"],
      });
    }
  });

const learningEntryViewedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("learning_entry_viewed"),
    payload: z
      .object({
        entryPoint: z.enum(["homepage_primary", "direct_public_path"]),
      })
      .strict(),
  })
  .strict();

const firstTaskStartedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("first_task_started"),
    payload: z
      .object({
        taskId: baselineTaskIdSchema,
      })
      .strict(),
  })
  .strict();

const taskAnsweredEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("task_answered"),
    payload: taskAnsweredPayloadSchema,
  })
  .strict();

const feedbackViewedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("feedback_viewed"),
    payload: z
      .object({
        taskId: readingTaskIdSchema,
        feedbackType: z.enum(["correct_confirmation", "five_part_wrong"]),
      })
      .strict(),
  })
  .strict();

const nextTaskStartedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("next_task_started"),
    payload: nextTaskPayloadSchema,
  })
  .strict();

const practiceCompletedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("practice_completed"),
    payload: z
      .object({
        answeredTaskCount: z.literal(PRACTICE_READING_TASK_IDS.length),
        correctAnswerCount: z.number().int().min(0).max(PRACTICE_READING_TASK_IDS.length),
      })
      .strict(),
  })
  .strict();

const retestStartedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("retest_started"),
    payload: z
      .object({
        taskId: retestTaskIdSchema,
      })
      .strict(),
  })
  .strict();

const retestCompletedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("retest_completed"),
    payload: z
      .object({
        answeredTaskCount: z.literal(RETEST_READING_TASK_IDS.length),
        correctAnswerCount: z.number().int().min(0).max(RETEST_READING_TASK_IDS.length),
      })
      .strict(),
  })
  .strict();

const planOfferedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("plan_offered"),
    payload: z
      .object({
        evidenceState: z.literal("evidence_available"),
        ability: readingSkillSchema,
        resourceId: z.literal(READING_MICRO_LESSON_ID),
        taskId: practiceTaskIdSchema,
        retestTaskId: retestTaskIdSchema,
      })
      .strict(),
  })
  .strict();

const postValueContinuationStartedEventSchema = z
  .object({
    ...eventEnvelope,
    eventName: z.literal("post_value_continuation_started"),
    payload: z
      .object({
        continuation: continuationSchema,
      })
      .strict(),
  })
  .strict();

export const publicLearningEventSchema = z.discriminatedUnion("eventName", [
  learningEntryViewedEventSchema,
  firstTaskStartedEventSchema,
  taskAnsweredEventSchema,
  feedbackViewedEventSchema,
  nextTaskStartedEventSchema,
  practiceCompletedEventSchema,
  retestStartedEventSchema,
  retestCompletedEventSchema,
  planOfferedEventSchema,
  postValueContinuationStartedEventSchema,
]);

export type PublicLearningEvent = z.infer<typeof publicLearningEventSchema>;
export type PublicLearningEventInput = PublicLearningEvent extends infer Event
  ? Event extends PublicLearningEvent
    ? Omit<Event, "protocolVersion" | "contentPackageVersion" | "dispatchMode">
    : never
  : never;

export type SafeContractParseFailureReason =
  | "missing"
  | "corrupt"
  | "unknown_version"
  | "invalid";

export type SafeContractParseResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{
      success: false;
      reason: SafeContractParseFailureReason;
      issues: readonly string[];
    }>;

type PreparedInput =
  | Readonly<{ success: true; value: unknown }>
  | Readonly<{
      success: false;
      reason: "missing" | "corrupt";
      issues: readonly string[];
    }>;

function prepareInput(input: unknown): PreparedInput {
  if (input === null || input === undefined || input === "") {
    return { success: false, reason: "missing", issues: ["No stored value was provided."] };
  }
  if (typeof input !== "string") return { success: true, value: input };
  if (!input.trim()) {
    return { success: false, reason: "missing", issues: ["No stored value was provided."] };
  }
  try {
    return { success: true, value: JSON.parse(input) as unknown };
  } catch {
    return {
      success: false,
      reason: "corrupt",
      issues: ["Stored value is not valid JSON."],
    };
  }
}

function hasExpectedProtocol(value: unknown, expectedProtocol: string): boolean | "missing" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "missing";
  if (!("protocolVersion" in value)) return "missing";
  return (value as { protocolVersion?: unknown }).protocolVersion === expectedProtocol;
}

function safeParseContract<T>(
  input: unknown,
  expectedProtocol: string,
  schema: z.ZodType<T>,
): SafeContractParseResult<T> {
  const prepared = prepareInput(input);
  if (!prepared.success) return prepared;
  const protocolMatch = hasExpectedProtocol(prepared.value, expectedProtocol);
  if (protocolMatch === false) {
    return {
      success: false,
      reason: "unknown_version",
      issues: ["Stored value uses an unsupported protocol version."],
    };
  }
  const parsed = schema.safeParse(prepared.value);
  if (!parsed.success) {
    return {
      success: false,
      reason: "invalid",
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  }
  return { success: true, data: parsed.data };
}

export function parsePublicReadingState(input: unknown): SafeContractParseResult<PublicReadingState> {
  return safeParseContract(input, PUBLIC_READING_STORAGE_NAMESPACE, publicReadingStateSchema);
}

export const safeParsePublicReadingState = parsePublicReadingState;

export function serializePublicReadingState(state: PublicReadingState): string {
  return JSON.stringify(publicReadingStateSchema.parse(state));
}

export function parsePublicLearningEvent(input: unknown): SafeContractParseResult<PublicLearningEvent> {
  return safeParseContract(input, PUBLIC_LEARNING_EVENTS_NAMESPACE, publicLearningEventSchema);
}

export const safeParsePublicLearningEvent = parsePublicLearningEvent;

export function createPublicLearningEvent(input: PublicLearningEventInput): PublicLearningEvent {
  return publicLearningEventSchema.parse({
    protocolVersion: PUBLIC_LEARNING_EVENTS_NAMESPACE,
    contentPackageVersion: READING_CONTENT_PACKAGE_VERSION,
    dispatchMode: PUBLIC_LEARNING_EVENT_DISPATCH_MODE,
    ...input,
  });
}
