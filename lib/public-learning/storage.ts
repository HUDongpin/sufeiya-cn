import {
  PUBLIC_LEARNING_EVENTS_NAMESPACE,
  PUBLIC_READING_STORAGE_NAMESPACE,
  createEmptyPublicReadingState,
  parsePublicLearningEvent,
  parsePublicReadingState,
  serializePublicReadingState,
  type PublicLearningEvent,
  type PublicReadingState,
  type ReadingObjectiveResponse,
  type SafeContractParseFailureReason,
} from "./contracts";
import {
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  RETEST_READING_TASK_IDS,
  type ReadingTaskPhase,
} from "./content";
import { updateReadingRecommendationAfterRetest } from "./evaluation";

export const PUBLIC_READING_WRITE_LOCK =
  `${PUBLIC_READING_STORAGE_NAMESPACE}:write` as const;
export const PUBLIC_READING_MAX_STATE_BYTES = 64 * 1024;
export const PUBLIC_READING_MAX_EVENT_BYTES = 128 * 1024;
export const PUBLIC_READING_MAX_EVENTS = 128;

export type PublicReadingStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type StoredLoadFailureReason =
  | Exclude<SafeContractParseFailureReason, "missing">
  | "too_large";

export type StoredValueResult<T> =
  | Readonly<{ status: "empty"; raw: null }>
  | Readonly<{ status: "ready"; raw: string; data: T }>
  | Readonly<{
      status: "read_only";
      raw: string;
      reason: StoredLoadFailureReason;
      issues: readonly string[];
    }>;

export type StorageMutationResult =
  | Readonly<{ success: true; raw: string }>
  | Readonly<{
      success: false;
      reason: "conflict" | "capacity" | "storage_unavailable" | "invalid";
      issues: readonly string[];
    }>;

export type PublicReadingSnapshotCompatibility = Readonly<{
  status: "compatible" | "event_degraded" | "not_evaluated";
  issues: readonly string[];
}>;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function readRaw(storage: PublicReadingStorage, key: string): string | null {
  return storage.getItem(key);
}

function readOnlyResult(
  raw: string,
  reason: StoredLoadFailureReason,
  issues: readonly string[],
): StoredValueResult<never> {
  return { status: "read_only", raw, reason, issues };
}

type ExpectedJourneyEvent = Readonly<{
  eventName: PublicLearningEvent["eventName"];
  taskId?: string;
  phase?: ReadingTaskPhase;
}>;

const EXPECTED_PUBLIC_READING_JOURNEY: readonly ExpectedJourneyEvent[] = [
  { eventName: "first_task_started", taskId: BASELINE_READING_TASK_IDS[0] },
  { eventName: "task_answered", taskId: BASELINE_READING_TASK_IDS[0], phase: "baseline" },
  { eventName: "feedback_viewed", taskId: BASELINE_READING_TASK_IDS[0] },
  { eventName: "task_answered", taskId: BASELINE_READING_TASK_IDS[1], phase: "baseline" },
  { eventName: "feedback_viewed", taskId: BASELINE_READING_TASK_IDS[1] },
  { eventName: "next_task_started", taskId: PRACTICE_READING_TASK_IDS[0], phase: "practice" },
  { eventName: "task_answered", taskId: PRACTICE_READING_TASK_IDS[0], phase: "practice" },
  { eventName: "feedback_viewed", taskId: PRACTICE_READING_TASK_IDS[0] },
  { eventName: "next_task_started", taskId: PRACTICE_READING_TASK_IDS[1], phase: "practice" },
  { eventName: "task_answered", taskId: PRACTICE_READING_TASK_IDS[1], phase: "practice" },
  { eventName: "feedback_viewed", taskId: PRACTICE_READING_TASK_IDS[1] },
  { eventName: "next_task_started", taskId: PRACTICE_READING_TASK_IDS[2], phase: "practice" },
  { eventName: "task_answered", taskId: PRACTICE_READING_TASK_IDS[2], phase: "practice" },
  { eventName: "feedback_viewed", taskId: PRACTICE_READING_TASK_IDS[2] },
  { eventName: "practice_completed" },
  { eventName: "retest_started", taskId: RETEST_READING_TASK_IDS[0] },
  { eventName: "task_answered", taskId: RETEST_READING_TASK_IDS[0], phase: "retest" },
  { eventName: "next_task_started", taskId: RETEST_READING_TASK_IDS[1], phase: "retest" },
  { eventName: "task_answered", taskId: RETEST_READING_TASK_IDS[1], phase: "retest" },
  { eventName: "feedback_viewed", taskId: RETEST_READING_TASK_IDS[0] },
  { eventName: "feedback_viewed", taskId: RETEST_READING_TASK_IDS[1] },
  { eventName: "retest_completed" },
  { eventName: "plan_offered" },
];

function taskIdFromEvent(event: PublicLearningEvent): string | undefined {
  return "taskId" in event.payload ? event.payload.taskId : undefined;
}

function phaseFromEvent(event: PublicLearningEvent): ReadingTaskPhase | undefined {
  return "phase" in event.payload ? event.payload.phase : undefined;
}

function validatePublicLearningEventLifecycle(
  events: readonly PublicLearningEvent[],
): readonly string[] {
  if (events.length === 0) return [];
  if (events[0]?.eventName !== "learning_entry_viewed") {
    return ["The event ledger must begin with learning_entry_viewed."];
  }

  const journeyEvents = events.filter((event) => event.eventName !== "learning_entry_viewed");
  const answerStates = new Map<string, "correct" | "incorrect">();
  const objectiveResponses: ReadingObjectiveResponse[] = [];

  for (let index = 0; index < journeyEvents.length; index += 1) {
    const event = journeyEvents[index]!;
    const expected = EXPECTED_PUBLIC_READING_JOURNEY[index];
    if (!expected) {
      if (event.eventName !== "post_value_continuation_started") {
        return [`Journey event ${index + 1} occurs after the completed plan without an approved continuation.`];
      }
      continue;
    }
    if (event.eventName !== expected.eventName) {
      return [
        `Journey event ${index + 1} must be ${expected.eventName}, not ${event.eventName}.`,
      ];
    }
    if (expected.taskId && taskIdFromEvent(event) !== expected.taskId) {
      return [`Journey event ${index + 1} does not reference the expected task.`];
    }
    if (expected.phase && phaseFromEvent(event) !== expected.phase) {
      return [`Journey event ${index + 1} does not reference the expected phase.`];
    }

    if (event.eventName === "task_answered") {
      answerStates.set(event.payload.taskId, event.payload.answerState);
      objectiveResponses.push({
        taskId: event.payload.taskId,
        phase: event.payload.phase,
        selectedOptionId: event.payload.selectedOptionId,
      });
    }
    if (event.eventName === "feedback_viewed") {
      const answerState = answerStates.get(event.payload.taskId);
      const expectedFeedback = answerState === "correct"
        ? "correct_confirmation"
        : answerState === "incorrect"
          ? "five_part_wrong"
          : null;
      if (event.payload.feedbackType !== expectedFeedback) {
        return [`Feedback for ${event.payload.taskId} does not match its first objective answer.`];
      }
    }
    if (event.eventName === "practice_completed") {
      const correctAnswerCount = PRACTICE_READING_TASK_IDS.filter(
        (taskId) => answerStates.get(taskId) === "correct",
      ).length;
      if (event.payload.correctAnswerCount !== correctAnswerCount) {
        return ["practice_completed does not match the preceding objective answers."];
      }
    }
    if (event.eventName === "retest_completed") {
      const correctAnswerCount = RETEST_READING_TASK_IDS.filter(
        (taskId) => answerStates.get(taskId) === "correct",
      ).length;
      if (event.payload.correctAnswerCount !== correctAnswerCount) {
        return ["retest_completed does not match the preceding objective answers."];
      }
    }
    if (event.eventName === "plan_offered") {
      const recommendation = updateReadingRecommendationAfterRetest(objectiveResponses);
      if (recommendation.status !== "updated") {
        return ["plan_offered requires seven complete objective first responses."];
      }
      const expectedRetestTaskId =
        RETEST_READING_TASK_IDS.find((taskId) =>
          recommendation.evidence.retestIncorrectTaskIds.includes(taskId),
        ) ?? recommendation.retest.completedTaskIds[0];
      if (
        event.payload.ability !== recommendation.ability.id ||
        event.payload.resourceId !== recommendation.resource.id ||
        event.payload.taskId !== recommendation.task.primaryTaskId ||
        event.payload.retestTaskId !== expectedRetestTaskId
      ) {
        return ["plan_offered does not match the recommendation derived from objective evidence."];
      }
    }
  }

  return [];
}

function expectedJourneyEventCountForState(state: PublicReadingState): number | null {
  const responseCount = state.responses.length;
  switch (state.currentStep) {
    case "entry":
      return 0;
    case "baseline":
      if (state.activeTaskId === BASELINE_READING_TASK_IDS[0]) {
        return responseCount === 0 ? 1 : responseCount === 1 ? 3 : null;
      }
      if (state.activeTaskId === BASELINE_READING_TASK_IDS[1]) {
        return responseCount === 1 ? 3 : responseCount === 2 ? 5 : null;
      }
      return null;
    case "lesson":
      return 5;
    case "practice":
      if (state.activeTaskId === PRACTICE_READING_TASK_IDS[0]) {
        return responseCount === 2 ? 6 : responseCount === 3 ? 8 : null;
      }
      if (state.activeTaskId === PRACTICE_READING_TASK_IDS[1]) {
        return responseCount === 3 ? 9 : responseCount === 4 ? 11 : null;
      }
      if (state.activeTaskId === PRACTICE_READING_TASK_IDS[2]) {
        return responseCount === 4 ? 12 : responseCount === 5 ? 14 : null;
      }
      return null;
    case "feedback":
      return 15;
    case "retest":
      if (state.activeTaskId === RETEST_READING_TASK_IDS[0]) {
        return responseCount === 5 ? 16 : responseCount === 6 ? 17 : null;
      }
      if (state.activeTaskId === RETEST_READING_TASK_IDS[1]) {
        return responseCount === 6 ? 18 : responseCount === 7 ? 19 : null;
      }
      return null;
    case "plan":
      return EXPECTED_PUBLIC_READING_JOURNEY.length;
    case "continuation":
      return EXPECTED_PUBLIC_READING_JOURNEY.length + 1;
  }
}

export function validatePublicReadingSnapshotCompatibility(
  state: PublicReadingState,
  events: readonly PublicLearningEvent[],
): readonly string[] {
  const journeyEvents = events.filter((event) => event.eventName !== "learning_entry_viewed");
  const eventResponses = journeyEvents.flatMap((event): ReadingObjectiveResponse[] =>
    event.eventName === "task_answered"
      ? [{
          taskId: event.payload.taskId,
          phase: event.payload.phase,
          selectedOptionId: event.payload.selectedOptionId,
        }]
      : [],
  );
  if (JSON.stringify(eventResponses) !== JSON.stringify(state.responses)) {
    return ["The Reading state responses do not match the objective evidence in the event ledger."];
  }
  const expectedCount = expectedJourneyEventCountForState(state);
  if (expectedCount === null) {
    return ["The Reading state does not map to a reviewable event lifecycle boundary."];
  }

  if (state.currentStep === "continuation") {
    if (journeyEvents.length < expectedCount) {
      return ["The Reading continuation state is ahead of its event lifecycle."];
    }
    const lastContinuation = journeyEvents.at(-1);
    if (
      lastContinuation?.eventName !== "post_value_continuation_started" ||
      lastContinuation.payload.continuation !== state.continuation
    ) {
      return ["The Reading continuation choice does not match the latest event evidence."];
    }
    return [];
  }

  if (journeyEvents.length !== expectedCount) {
    return [
      `The Reading state expects ${expectedCount} journey events, but the ledger contains ${journeyEvents.length}.`,
    ];
  }
  return [];
}

export function evaluatePublicReadingStoredSnapshotCompatibility(
  state: StoredValueResult<PublicReadingState>,
  events: StoredValueResult<readonly PublicLearningEvent[]>,
): PublicReadingSnapshotCompatibility {
  if (state.status === "read_only" || events.status === "read_only") {
    return { status: "not_evaluated", issues: [] };
  }

  const issues = validatePublicReadingSnapshotCompatibility(
    state.status === "ready" ? state.data : createEmptyPublicReadingState(),
    events.status === "ready" ? events.data : [],
  );
  return {
    status: issues.length > 0 ? "event_degraded" : "compatible",
    issues,
  };
}

export function loadPublicReadingState(
  storage: PublicReadingStorage,
): StoredValueResult<PublicReadingState> {
  const raw = readRaw(storage, PUBLIC_READING_STORAGE_NAMESPACE);
  if (raw === null) return { status: "empty", raw: null };
  if (byteLength(raw) > PUBLIC_READING_MAX_STATE_BYTES) {
    return readOnlyResult(raw, "too_large", ["Stored Reading state exceeds the local size limit."]);
  }

  const parsed = parsePublicReadingState(raw);
  if (!parsed.success) {
    return readOnlyResult(
      raw,
      parsed.reason === "missing" ? "corrupt" : parsed.reason,
      parsed.issues,
    );
  }
  return { status: "ready", raw, data: parsed.data };
}

export function parsePublicLearningEventLedger(
  raw: string,
): StoredValueResult<readonly PublicLearningEvent[]> {
  if (byteLength(raw) > PUBLIC_READING_MAX_EVENT_BYTES) {
    return readOnlyResult(raw, "too_large", ["Stored public learning events exceed the local size limit."]);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw) as unknown;
  } catch {
    return readOnlyResult(raw, "corrupt", ["Stored public learning events are not valid JSON."]);
  }
  if (!Array.isArray(input) || input.length > PUBLIC_READING_MAX_EVENTS) {
    return readOnlyResult(raw, "invalid", ["Stored public learning events are not a bounded event list."]);
  }

  const events: PublicLearningEvent[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const parsed = parsePublicLearningEvent(input[index]);
    if (!parsed.success) {
      return readOnlyResult(raw, parsed.reason === "missing" ? "invalid" : parsed.reason, [
        `Event ${index + 1}: ${parsed.issues.join(" ")}`,
      ]);
    }
    if (parsed.data.sequence !== index) {
      return readOnlyResult(raw, "invalid", [
        `Event ${index + 1} does not have the expected zero-based sequence.`,
      ]);
    }
    events.push(parsed.data);
  }

  const lifecycleIssues = validatePublicLearningEventLifecycle(events);
  if (lifecycleIssues.length > 0) {
    return readOnlyResult(raw, "invalid", lifecycleIssues);
  }

  return { status: "ready", raw, data: events };
}

export function loadPublicLearningEvents(
  storage: PublicReadingStorage,
): StoredValueResult<readonly PublicLearningEvent[]> {
  const raw = readRaw(storage, PUBLIC_LEARNING_EVENTS_NAMESPACE);
  if (raw === null) return { status: "empty", raw: null };
  return parsePublicLearningEventLedger(raw);
}

export function storePublicReadingState(
  storage: PublicReadingStorage,
  state: PublicReadingState,
  expectedRaw: string | null,
): StorageMutationResult {
  let raw: string;
  try {
    raw = serializePublicReadingState(state);
  } catch (error) {
    return {
      success: false,
      reason: "invalid",
      issues: [error instanceof Error ? error.message : "Reading state did not match its contract."],
    };
  }
  if (byteLength(raw) > PUBLIC_READING_MAX_STATE_BYTES) {
    return { success: false, reason: "capacity", issues: ["Reading state exceeds the local size limit."] };
  }

  try {
    if (readRaw(storage, PUBLIC_READING_STORAGE_NAMESPACE) !== expectedRaw) {
      return {
        success: false,
        reason: "conflict",
        issues: ["Reading state changed in another browser context."],
      };
    }
    storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, raw);
    if (readRaw(storage, PUBLIC_READING_STORAGE_NAMESPACE) !== raw) {
      return {
        success: false,
        reason: "storage_unavailable",
        issues: ["The browser did not preserve the written Reading state."],
      };
    }
    return { success: true, raw };
  } catch (error) {
    return {
      success: false,
      reason: "storage_unavailable",
      issues: [error instanceof Error ? error.message : "Browser storage is unavailable."],
    };
  }
}

export function appendPublicLearningEvent(
  storage: PublicReadingStorage,
  event: PublicLearningEvent,
  expectedRaw: string | null,
): StorageMutationResult {
  const currentEvents = expectedRaw === null
    ? ({ status: "ready", raw: "[]", data: [] } as const)
    : parsePublicLearningEventLedger(expectedRaw);
  if (currentEvents.status !== "ready") {
    return {
      success: false,
      reason: "invalid",
      issues: ["Existing public learning events are not safely writable."],
    };
  }
  if (currentEvents.data.length >= PUBLIC_READING_MAX_EVENTS) {
    return { success: false, reason: "capacity", issues: ["The local event limit has been reached."] };
  }
  if (event.sequence !== currentEvents.data.length) {
    return {
      success: false,
      reason: "invalid",
      issues: ["The event sequence does not continue the stored event list."],
    };
  }

  const parsedEvent = parsePublicLearningEvent(event);
  if (!parsedEvent.success) {
    return { success: false, reason: "invalid", issues: parsedEvent.issues };
  }
  const raw = JSON.stringify([...currentEvents.data, parsedEvent.data]);
  if (byteLength(raw) > PUBLIC_READING_MAX_EVENT_BYTES) {
    return { success: false, reason: "capacity", issues: ["Public learning events exceed the local size limit."] };
  }
  const candidateLedger = parsePublicLearningEventLedger(raw);
  if (candidateLedger.status !== "ready") {
    return {
      success: false,
      reason: "invalid",
      issues: candidateLedger.status === "read_only"
        ? candidateLedger.issues
        : ["The candidate event ledger unexpectedly parsed as empty."],
    };
  }

  try {
    if (readRaw(storage, PUBLIC_LEARNING_EVENTS_NAMESPACE) !== expectedRaw) {
      return {
        success: false,
        reason: "conflict",
        issues: ["Public learning events changed in another browser context."],
      };
    }
    storage.setItem(PUBLIC_LEARNING_EVENTS_NAMESPACE, raw);
    if (readRaw(storage, PUBLIC_LEARNING_EVENTS_NAMESPACE) !== raw) {
      return {
        success: false,
        reason: "storage_unavailable",
        issues: ["The browser did not preserve the written event list."],
      };
    }
    return { success: true, raw };
  } catch (error) {
    return {
      success: false,
      reason: "storage_unavailable",
      issues: [error instanceof Error ? error.message : "Browser storage is unavailable."],
    };
  }
}

export function deletePublicReadingLocalData(storage: PublicReadingStorage): void {
  storage.removeItem(PUBLIC_READING_STORAGE_NAMESPACE);
  storage.removeItem(PUBLIC_LEARNING_EVENTS_NAMESPACE);
}

export function publicReadingWriteLockSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
}

export async function withPublicReadingWriteLock<T>(action: () => T | Promise<T>): Promise<T> {
  if (!publicReadingWriteLockSupported()) {
    throw new Error("Web Locks are unavailable; persistent public Reading writes are disabled.");
  }
  return navigator.locks.request(PUBLIC_READING_WRITE_LOCK, action);
}

export function createPublicReadingExport(
  state: StoredValueResult<PublicReadingState>,
  events: StoredValueResult<readonly PublicLearningEvent[]>,
  exportedAt: string,
) {
  const compatibility = evaluatePublicReadingStoredSnapshotCompatibility(state, events);
  return {
    protocolVersion: "sufeiya.public-reading-export.v1" as const,
    exportedAt,
    state: state.status === "ready" ? state.data : null,
    events: events.status === "ready" ? events.data : [],
    recovery: {
      stateStatus: state.status,
      stateRaw: state.status === "read_only" ? state.raw : null,
      eventStatus: events.status,
      eventRaw: events.status === "read_only" ? events.raw : null,
    },
    compatibility,
  };
}
