import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_LEARNING_EVENTS_NAMESPACE,
  PUBLIC_READING_STORAGE_NAMESPACE,
  createEmptyPublicReadingState,
  createPublicLearningEvent,
  type PublicLearningEvent,
} from "../lib/public-learning/contracts";
import {
  ALL_READING_TASKS,
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  RETEST_READING_TASK_IDS,
  getReadingTask,
} from "../lib/public-learning/content";
import { updateReadingRecommendationAfterRetest } from "../lib/public-learning/evaluation";
import {
  appendPublicLearningEvent,
  createPublicReadingExport,
  deletePublicReadingLocalData,
  evaluatePublicReadingStoredSnapshotCompatibility,
  loadPublicLearningEvents,
  loadPublicReadingState,
  parsePublicLearningEventLedger,
  storePublicReadingState,
  validatePublicReadingSnapshotCompatibility,
  withPublicReadingWriteLock,
} from "../lib/public-learning/storage";

class MemoryStorage implements Storage {
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.writes.push(`remove:${key}`); this.values.delete(key); }
  setItem(key: string, value: string) { this.writes.push(`set:${key}`); this.values.set(key, value); }
}

function createCanonicalAllCorrectLedger(): {
  events: PublicLearningEvent[];
  responses: Array<{
    taskId: (typeof ALL_READING_TASKS)[number]["id"];
    phase: (typeof ALL_READING_TASKS)[number]["phase"];
    selectedOptionId: string;
  }>;
} {
  const events: PublicLearningEvent[] = [];
  const responses = ALL_READING_TASKS.map((task) => ({
    taskId: task.id,
    phase: task.phase,
    selectedOptionId: task.correctAnswer.optionId,
  }));
  const append = (event: PublicLearningEvent) => events.push(event);

  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  }));
  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "first_task_started",
    payload: { taskId: BASELINE_READING_TASK_IDS[0] },
  }));
  for (const taskId of BASELINE_READING_TASK_IDS) {
    const task = getReadingTask(taskId);
    assert.ok(task);
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "task_answered",
      payload: {
        taskId,
        phase: "baseline",
        selectedOptionId: task.correctAnswer.optionId,
        answerState: "correct",
      },
    }));
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "feedback_viewed",
      payload: { taskId, feedbackType: "correct_confirmation" },
    }));
  }

  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "next_task_started",
    payload: { taskId: PRACTICE_READING_TASK_IDS[0], phase: "practice" },
  }));
  for (const [index, taskId] of PRACTICE_READING_TASK_IDS.entries()) {
    const task = getReadingTask(taskId);
    assert.ok(task);
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "task_answered",
      payload: {
        taskId,
        phase: "practice",
        selectedOptionId: task.correctAnswer.optionId,
        answerState: "correct",
      },
    }));
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "feedback_viewed",
      payload: { taskId, feedbackType: "correct_confirmation" },
    }));
    const nextTaskId = PRACTICE_READING_TASK_IDS[index + 1];
    if (nextTaskId) {
      append(createPublicLearningEvent({
        sequence: events.length,
        eventName: "next_task_started",
        payload: { taskId: nextTaskId, phase: "practice" },
      }));
    }
  }
  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "practice_completed",
    payload: { answeredTaskCount: 3, correctAnswerCount: 3 },
  }));

  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "retest_started",
    payload: { taskId: RETEST_READING_TASK_IDS[0] },
  }));
  for (const [index, taskId] of RETEST_READING_TASK_IDS.entries()) {
    const task = getReadingTask(taskId);
    assert.ok(task);
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "task_answered",
      payload: {
        taskId,
        phase: "retest",
        selectedOptionId: task.correctAnswer.optionId,
        answerState: "correct",
      },
    }));
    const nextTaskId = RETEST_READING_TASK_IDS[index + 1];
    if (nextTaskId) {
      append(createPublicLearningEvent({
        sequence: events.length,
        eventName: "next_task_started",
        payload: { taskId: nextTaskId, phase: "retest" },
      }));
    }
  }
  for (const taskId of RETEST_READING_TASK_IDS) {
    append(createPublicLearningEvent({
      sequence: events.length,
      eventName: "feedback_viewed",
      payload: { taskId, feedbackType: "correct_confirmation" },
    }));
  }
  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "retest_completed",
    payload: { answeredTaskCount: 2, correctAnswerCount: 2 },
  }));

  const recommendation = updateReadingRecommendationAfterRetest(responses);
  assert.equal(recommendation.status, "updated");
  if (recommendation.status !== "updated") throw new Error("Expected an updated recommendation.");
  append(createPublicLearningEvent({
    sequence: events.length,
    eventName: "plan_offered",
    payload: {
      evidenceState: "evidence_available",
      ability: recommendation.ability.id,
      resourceId: recommendation.resource.id,
      taskId: recommendation.task.primaryTaskId,
      retestTaskId: recommendation.retest.completedTaskIds[0],
    },
  }));
  return { events, responses };
}

test("keeps public Reading state and events in two new namespaces", () => {
  const storage = new MemoryStorage();
  const state = {
    ...createEmptyPublicReadingState(),
    revision: 1,
    currentStep: "baseline" as const,
    activeTaskId: "reading_baseline_shade_labels" as const,
  };
  const stateWrite = storePublicReadingState(storage, state, null);
  assert.equal(stateWrite.success, true);

  const entryEvent = createPublicLearningEvent({
    sequence: 0,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  });
  const eventWrite = appendPublicLearningEvent(storage, entryEvent, null);
  assert.equal(eventWrite.success, true);
  assert.deepEqual(storage.writes, [
    `set:${PUBLIC_READING_STORAGE_NAMESPACE}`,
    `set:${PUBLIC_LEARNING_EVENTS_NAMESPACE}`,
  ]);
  assert.deepEqual(loadPublicReadingState(storage), {
    status: "ready",
    raw: storage.getItem(PUBLIC_READING_STORAGE_NAMESPACE),
    data: state,
  });
  assert.equal(loadPublicLearningEvents(storage).status, "ready");
});

test("fails closed without overwriting corrupt, unknown-version, or concurrent state", () => {
  const storage = new MemoryStorage();
  storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, "{broken");
  const corrupt = loadPublicReadingState(storage);
  assert.equal(corrupt.status, "read_only");
  if (corrupt.status === "read_only") assert.equal(corrupt.reason, "corrupt");
  const corruptWrite = storePublicReadingState(storage, createEmptyPublicReadingState(), null);
  assert.equal(corruptWrite.success, false);
  if (!corruptWrite.success) assert.equal(corruptWrite.reason, "conflict");

  const unknownRaw = JSON.stringify({ protocolVersion: "sufeiya_public_reading_p0_v99" });
  storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, unknownRaw);
  const unknown = loadPublicReadingState(storage);
  assert.equal(unknown.status, "read_only");
  if (unknown.status === "read_only") assert.equal(unknown.reason, "unknown_version");

  const current = JSON.stringify(createEmptyPublicReadingState());
  storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, current);
  storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, JSON.stringify({ external: true }));
  const attempted = storePublicReadingState(storage, createEmptyPublicReadingState(), current);
  assert.equal(attempted.success, false);
  if (!attempted.success) assert.equal(attempted.reason, "conflict");
  assert.equal(storage.getItem(PUBLIC_READING_STORAGE_NAMESPACE), JSON.stringify({ external: true }));
});

test("rejects invalid event order and preserves unrelated legacy namespaces on deletion", () => {
  const storage = new MemoryStorage();
  const legacy = [
    "sufeiya_workspace_v1",
    "sufeiya_super_teacher_v1",
    "sufeiya_teaching_review_demo_v1",
  ] as const;
  legacy.forEach((key) => storage.setItem(key, `legacy:${key}`));

  const outOfOrder = createPublicLearningEvent({
    sequence: 1,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  });
  const result = appendPublicLearningEvent(storage, outOfOrder, null);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "invalid");

  storage.setItem(PUBLIC_READING_STORAGE_NAMESPACE, "{broken");
  storage.setItem(PUBLIC_LEARNING_EVENTS_NAMESPACE, "{broken");
  const recoveryExport = createPublicReadingExport(
    loadPublicReadingState(storage),
    loadPublicLearningEvents(storage),
    "2026-08-19T00:00:00.000Z",
  );
  assert.equal(recoveryExport.recovery.stateRaw, "{broken");
  assert.equal(recoveryExport.recovery.eventRaw, "{broken");

  deletePublicReadingLocalData(storage);
  assert.equal(storage.getItem(PUBLIC_READING_STORAGE_NAMESPACE), null);
  assert.equal(storage.getItem(PUBLIC_LEARNING_EVENTS_NAMESPACE), null);
  legacy.forEach((key) => assert.equal(storage.getItem(key), `legacy:${key}`));
});

test("rejects a shape-valid event ledger that skips the public learning lifecycle", () => {
  const taskId = BASELINE_READING_TASK_IDS[0];
  const task = getReadingTask(taskId);
  assert.ok(task);
  const event = createPublicLearningEvent({
    sequence: 0,
    eventName: "task_answered",
    payload: {
      taskId,
      phase: "baseline",
      selectedOptionId: task.correctAnswer.optionId,
      answerState: "correct",
    },
  });
  const parsed = parsePublicLearningEventLedger(JSON.stringify([event]));
  assert.equal(parsed.status, "read_only");
  if (parsed.status === "read_only") {
    assert.equal(parsed.reason, "invalid");
    assert.match(parsed.issues.join(" "), /begin with learning_entry_viewed/);
  }

  const storage = new MemoryStorage();
  const appended = appendPublicLearningEvent(storage, event, null);
  assert.equal(appended.success, false);
  if (!appended.success) assert.equal(appended.reason, "invalid");
  assert.equal(storage.getItem(PUBLIC_LEARNING_EVENTS_NAMESPACE), null);
});

test("derives plan events from objective evidence and rejects a legal but contradictory payload", () => {
  const { events } = createCanonicalAllCorrectLedger();
  assert.equal(events.length, 24);
  assert.equal(parsePublicLearningEventLedger(JSON.stringify(events)).status, "ready");

  const mutated = structuredClone(events);
  const plan = mutated.find((event) => event.eventName === "plan_offered");
  assert.ok(plan && plan.eventName === "plan_offered");
  plan.payload.ability = plan.payload.ability === "locate_explicit_evidence"
    ? "distinguish_main_idea_from_supporting_detail"
    : "locate_explicit_evidence";
  const parsed = parsePublicLearningEventLedger(JSON.stringify(mutated));
  assert.equal(parsed.status, "read_only");
  if (parsed.status === "read_only") {
    assert.match(parsed.issues.join(" "), /does not match the recommendation derived/);
  }
});

test("detects state and event lifecycle drift without treating the legal state as corrupt", () => {
  const entry = createPublicLearningEvent({
    sequence: 0,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  });
  const baselineState = {
    ...createEmptyPublicReadingState(),
    revision: 1,
    currentStep: "baseline" as const,
    activeTaskId: BASELINE_READING_TASK_IDS[0],
  };
  assert.match(
    validatePublicReadingSnapshotCompatibility(baselineState, [entry]).join(" "),
    /expects 1 journey events/,
  );

  const started = createPublicLearningEvent({
    sequence: 1,
    eventName: "first_task_started",
    payload: { taskId: BASELINE_READING_TASK_IDS[0] },
  });
  assert.deepEqual(
    validatePublicReadingSnapshotCompatibility(baselineState, [entry, started]),
    [],
  );

  const { events, responses } = createCanonicalAllCorrectLedger();
  const planState = {
    ...createEmptyPublicReadingState(),
    revision: 12,
    currentStep: "plan" as const,
    responses,
  };
  assert.deepEqual(validatePublicReadingSnapshotCompatibility(planState, events), []);

  const mismatchedResponses = structuredClone(responses);
  const firstTask = getReadingTask(mismatchedResponses[0]!.taskId);
  assert.ok(firstTask);
  mismatchedResponses[0]!.selectedOptionId = firstTask.options.find(
    (option) => option.id !== firstTask.correctAnswer.optionId,
  )!.id;
  assert.match(
    validatePublicReadingSnapshotCompatibility(
      { ...planState, responses: mismatchedResponses },
      events,
    ).join(" "),
    /responses do not match/,
  );
  const degradedExport = createPublicReadingExport(
    {
      status: "ready",
      raw: JSON.stringify({ ...planState, responses: mismatchedResponses }),
      data: { ...planState, responses: mismatchedResponses },
    },
    { status: "ready", raw: JSON.stringify(events), data: events },
    "2026-08-23T00:00:00.000Z",
  );
  assert.equal(degradedExport.compatibility.status, "event_degraded");
  assert.match(degradedExport.compatibility.issues.join(" "), /responses do not match/);
});

test("evaluates compatibility when exactly one public Reading namespace is missing", () => {
  const entry = createPublicLearningEvent({
    sequence: 0,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  });
  const started = createPublicLearningEvent({
    sequence: 1,
    eventName: "first_task_started",
    payload: { taskId: BASELINE_READING_TASK_IDS[0] },
  });
  const baselineState = {
    ...createEmptyPublicReadingState(),
    revision: 1,
    currentStep: "baseline" as const,
    activeTaskId: BASELINE_READING_TASK_IDS[0],
  };
  const emptyState = { status: "empty", raw: null } as const;
  const emptyEvents = { status: "empty", raw: null } as const;
  const readyState = {
    status: "ready",
    raw: JSON.stringify(baselineState),
    data: baselineState,
  } as const;
  const readyEvents = {
    status: "ready",
    raw: JSON.stringify([entry, started]),
    data: [entry, started],
  } as const;

  const eventsMissing = evaluatePublicReadingStoredSnapshotCompatibility(
    readyState,
    emptyEvents,
  );
  assert.equal(eventsMissing.status, "event_degraded");
  assert.match(eventsMissing.issues.join(" "), /expects 1 journey events/);
  const eventsMissingExport = createPublicReadingExport(
    readyState,
    emptyEvents,
    "2026-08-23T00:00:00.000Z",
  );
  assert.deepEqual(eventsMissingExport.compatibility, eventsMissing);

  const stateMissing = evaluatePublicReadingStoredSnapshotCompatibility(
    emptyState,
    readyEvents,
  );
  assert.equal(stateMissing.status, "event_degraded");
  assert.match(stateMissing.issues.join(" "), /expects 0 journey events/);
  const stateMissingExport = createPublicReadingExport(
    emptyState,
    readyEvents,
    "2026-08-23T00:00:00.000Z",
  );
  assert.deepEqual(stateMissingExport.compatibility, stateMissing);

  assert.deepEqual(
    evaluatePublicReadingStoredSnapshotCompatibility(
      readyState,
      {
        status: "read_only",
        raw: "{broken",
        reason: "corrupt",
        issues: ["Stored events are not valid JSON."],
      },
    ),
    { status: "not_evaluated", issues: [] },
  );
});

test("fails closed instead of running a persistent write without Web Locks", async () => {
  const lockDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "locks");
  Object.defineProperty(Navigator.prototype, "locks", {
    configurable: true,
    get: () => undefined,
  });
  let invoked = false;
  try {
    await assert.rejects(
      () => withPublicReadingWriteLock(() => {
        invoked = true;
      }),
      /persistent public Reading writes are disabled/,
    );
    assert.equal(invoked, false);
  } finally {
    if (lockDescriptor) Object.defineProperty(Navigator.prototype, "locks", lockDescriptor);
  }
});
