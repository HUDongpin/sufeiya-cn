import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

type MutableRecord = Record<string, unknown>;

interface StorageContract {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface BackupRuntime {
  BACKUP_PROTOCOL: string;
  WORKSPACE_NAMESPACE: string;
  MAX_FILE_BYTES: number;
  MAX_WORKSPACE_BYTES: number;
  CAPACITY_LIMITS: Record<string, number>;
  canonicalJson(value: unknown): string;
  sha256Hex(value: string): Promise<string>;
  createEnvelope(workspace: unknown): Promise<MutableRecord>;
  inspectWorkspaceCapacity(workspace: unknown): MutableRecord;
  inspectWorkspaceAppendCapacity(workspace: unknown, additions: MutableRecord): MutableRecord;
  inspectEnvelopeText(
    text: string,
    validateWorkspace: (workspace: unknown) => Promise<MutableRecord>,
  ): Promise<MutableRecord>;
  replaceWorkspaceAtomically(input: {
    storage: StorageContract;
    storageKey?: string;
    candidateRaw: string;
    expectedCurrentRaw: string | null;
    validatePersisted: (raw: string) => Promise<MutableRecord>;
  }): Promise<MutableRecord>;
}

interface LearningEventsRuntime {
  appendDomainEvent(
    state: MutableRecord,
    eventType: string,
    domain: MutableRecord,
  ): Promise<MutableRecord>;
}

interface JourneyValidationHarness {
  backup: BackupRuntime;
  learningEvents: LearningEventsRuntime;
  validateCandidate(candidate: unknown): Promise<MutableRecord>;
  supersededMatchesTerminalHistory(summary: unknown, history: unknown): boolean;
  validDiagnosticEvidence(evidence: unknown, diagnostic: unknown): boolean;
  validDiagnostic(diagnostic: unknown): boolean;
  validRetest(retest: unknown): boolean;
  validProfile(profile: unknown): boolean;
  validPlanGraph(candidate: unknown): boolean;
  validCheckIn(record: unknown, candidate: unknown, options?: unknown): boolean;
  deriveRetestOutcome(skill: string, evidence: unknown): MutableRecord | null;
  buildDiagnosticReport(diagnostic: unknown): MutableRecord;
}

interface WorkspaceWriterHarness {
  backup: BackupRuntime;
  freshState(): MutableRecord;
  getState(): MutableRecord;
  getRaw(): string | null;
  getLastCapacityCandidate(): MutableRecord | null;
  setState(next: MutableRecord): void;
  setNow(value: string): void;
  resolveTodayTaskContext(candidateState?: MutableRecord, date?: string): MutableRecord;
  todayTaskHref(task: MutableRecord, context: MutableRecord): string;
  checkInPlanIdForDate(input: MutableRecord): string | null;
  checkInReflectionTaskForDate(input: MutableRecord): MutableRecord | null;
  commitPlanRegeneration(profile: MutableRecord): Promise<MutableRecord>;
  commitChoicePracticeCompletion(input: MutableRecord): Promise<MutableRecord>;
  commitCheckInRecord(input: MutableRecord): Promise<MutableRecord>;
  commitFocusControlAction(durationMinutes: number): Promise<MutableRecord>;
  commitFocusTerminal(status: string): Promise<MutableRecord>;
}

interface JourneyWriterHarness {
  backup: BackupRuntime;
  learningEvents: LearningEventsRuntime;
  freshState(): MutableRecord;
  getState(): MutableRecord;
  getRaw(): string | null;
  setPersistedRaw(raw: string): void;
  setState(next: MutableRecord): void;
  setNow(value: string): void;
  inspectNextGateACycleAdmission(candidate?: MutableRecord): MutableRecord;
  nextGateACycleRequiredAdditions(candidate?: MutableRecord): MutableRecord;
  validateCandidate(candidate: unknown): Promise<MutableRecord>;
  commitNewDiagnostic(input: MutableRecord): Promise<MutableRecord>;
  commitJourneyPlanClose(focusSkill: string): Promise<MutableRecord>;
  validateCycleEvidence(): MutableRecord;
  buildCommunityVisibilityPreview(chain: MutableRecord): MutableRecord | null;
  recommendationItems(): MutableRecord[];
  createRecommendationBinding(chain: MutableRecord, primary: MutableRecord, createdAt: string): MutableRecord | null;
  buildDiagnosticReport(diagnostic: unknown): MutableRecord;
  deriveRetestOutcome(skill: string, evidence: unknown): MutableRecord | null;
}

const runtimeSource = readFileSync(new URL("../workspace-backup.js", import.meta.url), "utf8");
const learningEventsSource = readFileSync(new URL("../learning-events.js", import.meta.url), "utf8");
const journeySource = readFileSync(new URL("../journey.js", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../workspace.js", import.meta.url), "utf8");
const HASH = "a".repeat(64);

function asRecord(value: unknown): MutableRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as MutableRecord;
}

function hostClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function workspaceTreeNodeCount(value: unknown): number {
  let count = 0;
  const visit = (candidate: unknown) => {
    count += 1;
    if (Array.isArray(candidate)) candidate.forEach(visit);
    else if (candidate && typeof candidate === "object") Object.values(candidate).forEach(visit);
  };
  visit(value);
  return count;
}

function loadRuntime(): BackupRuntime {
  const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
  });
  vm.runInContext(runtimeSource, context, {
    filename: "workspace-backup.js",
  });
  const runtime = vm.runInContext("globalThis.SufeiyaWorkspaceBackup", context) as BackupRuntime | undefined;
  assert.ok(runtime, "workspace-backup.js must expose SufeiyaWorkspaceBackup");
  return runtime;
}

async function loadWorkspaceGuardHarness(): Promise<{
  cycleHasSealedDownstream(state: unknown, cycle: unknown): boolean;
  sealedCurrentCycleCheckIn(state: unknown, record: unknown): boolean;
}> {
  const storage: StorageContract = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const document = {
    body: { append: () => undefined },
    createElement: () => ({
      addEventListener: () => undefined,
      append: () => undefined,
      focus: () => undefined,
      replaceChildren: () => undefined,
      setAttribute: () => undefined,
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const sandbox: MutableRecord = {
    Blob,
    Date,
    Error,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    crypto: webcrypto,
    document,
    innerWidth: 1024,
    localStorage: storage,
    location: { hash: "", origin: "http://localhost", pathname: "/", search: "" },
    navigator: { onLine: true },
    setInterval,
    setTimeout,
    structuredClone,
    TextEncoder,
    addEventListener: () => undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(runtimeSource, context, { filename: "workspace-backup.js" });
  vm.runInContext(learningEventsSource, context, { filename: "learning-events.js" });
  const instrumented = workspaceSource.replace(
    "  const disableWorkspaceControls = ({",
    "  window.__cycleHasSealedDownstream = cycleHasSealedDownstream;\n  window.__sealedCurrentCycleCheckIn = sealedCurrentCycleCheckIn;\n  const disableWorkspaceControls = ({",
  );
  assert.notEqual(instrumented, workspaceSource, "workspace guard instrumentation anchor must exist");
  await vm.runInContext(instrumented, context, { filename: "workspace.js" });
  const cycleHasSealedDownstream = sandbox.__cycleHasSealedDownstream as
    | ((state: unknown, cycle: unknown) => boolean)
    | undefined;
  const sealedCurrentCycleCheckIn = sandbox.__sealedCurrentCycleCheckIn as
    | ((state: unknown, record: unknown) => boolean)
    | undefined;
  assert.ok(cycleHasSealedDownstream && sealedCurrentCycleCheckIn);
  return { cycleHasSealedDownstream, sealedCurrentCycleCheckIn };
}

function productionVmDocument() {
  return {
    body: { append: () => undefined },
    createElement: () => ({
      addEventListener: () => undefined,
      append: () => undefined,
      click: () => undefined,
      focus: () => undefined,
      remove: () => undefined,
      replaceChildren: () => undefined,
      setAttribute: () => undefined,
      dataset: {},
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    title: "Sufeiya",
    visibilityState: "visible",
    addEventListener: () => undefined,
  };
}

function productionVmStorage(): StorageContract & { raw(): string | null } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    raw: () => values.get("sufeiya_workspace_v1") ?? null,
  };
}

function productionVmLocks() {
  return {
    request: (_name: string, _options: unknown, callback: (lock: MutableRecord) => unknown) =>
      callback({ name: "test-lock" }),
  };
}

async function loadWorkspaceWriterHarness({
  pathname = "/",
  search = "",
}: { pathname?: string; search?: string } = {}): Promise<WorkspaceWriterHarness> {
  const storage = productionVmStorage();
  const NativeDate = Date;
  let currentTime = NativeDate.now();
  class ControlledDate extends NativeDate {
    constructor(value?: string | number) {
      super(value === undefined ? currentTime : value);
    }

    static now(): number {
      return currentTime;
    }
  }
  const sandbox: MutableRecord = {
    Blob,
    Date: ControlledDate,
    Error,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    crypto: webcrypto,
    document: productionVmDocument(),
    innerWidth: 1024,
    localStorage: storage,
    location: { hash: "", origin: "http://localhost", pathname, search, reload: () => undefined },
    navigator: { locks: productionVmLocks(), onLine: true },
    setInterval,
    setTimeout,
    structuredClone,
    TextEncoder,
    addEventListener: () => undefined,
    confirm: () => true,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(runtimeSource, context, { filename: "workspace-backup.js" });
  vm.runInContext(learningEventsSource, context, { filename: "learning-events.js" });
  const withCapacityProbe = workspaceSource.replace(
    "  const workspaceCandidateCapacity = (candidate) => {",
    "  const workspaceCandidateCapacity = (candidate) => {\n    window.__lastWorkspaceCapacityCandidate = JSON.parse(JSON.stringify(candidate));",
  );
  assert.notEqual(withCapacityProbe, workspaceSource, "workspace capacity instrumentation anchor must exist");
  const instrumented = withCapacityProbe.replace(
    '  window.addEventListener("storage", (event) => {',
    `  window.__workspaceWriterHarness = {
    freshState: () => JSON.parse(JSON.stringify(freshState())),
    getState: () => JSON.parse(JSON.stringify(state)),
    getLastCapacityCandidate: () => window.__lastWorkspaceCapacityCandidate
      ? JSON.parse(JSON.stringify(window.__lastWorkspaceCapacityCandidate))
      : null,
    setState: (next) => {
      state = JSON.parse(JSON.stringify(next));
      storageWritable = true;
      workspaceStateRecognized = true;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    resolveTodayTaskContext: (candidateState, date) => JSON.parse(JSON.stringify(
      resolveTodayTaskContext(candidateState === undefined ? state : candidateState, date),
    )),
    todayTaskHref,
    checkInPlanIdForDate,
    checkInReflectionTaskForDate,
    commitPlanRegeneration,
    commitChoicePracticeCompletion,
    commitCheckInRecord,
    commitFocusControlAction,
    commitFocusTerminal,
  };
  window.addEventListener("storage", (event) => {`,
  );
  assert.notEqual(instrumented, withCapacityProbe, "workspace writer instrumentation anchor must exist");
  await vm.runInContext(instrumented, context, { filename: "workspace.js" });
  const exposed = sandbox.__workspaceWriterHarness as Omit<WorkspaceWriterHarness, "backup" | "getRaw"> | undefined;
  const backup = sandbox.SufeiyaWorkspaceBackup as BackupRuntime | undefined;
  assert.ok(exposed && backup);
  return {
    ...exposed,
    backup,
    getRaw: storage.raw,
    setNow: (value: string) => {
      const parsed = NativeDate.parse(value);
      assert.ok(Number.isFinite(parsed), `controlled workspace clock requires an ISO timestamp: ${value}`);
      currentTime = parsed;
    },
  };
}

async function loadJourneyWriterHarness(): Promise<JourneyWriterHarness> {
  const storage = productionVmStorage();
  const NativeDate = Date;
  let currentTime = NativeDate.now();
  class ControlledDate extends NativeDate {
    constructor(value?: string | number) {
      super(value === undefined ? currentTime : value);
    }

    static now(): number {
      return currentTime;
    }
  }
  const sandbox: MutableRecord = {
    AbortController,
    Blob,
    Date: ControlledDate,
    Error,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    crypto: webcrypto,
    document: productionVmDocument(),
    fetch: async () => ({ ok: false, status: 503, headers: { get: () => "application/json" }, text: async () => "{}", url: "http://localhost/api/gate0" }),
    innerWidth: 1024,
    localStorage: storage,
    location: { origin: "http://localhost", pathname: "/diagnostic", search: "", reload: () => undefined },
    navigator: { locks: productionVmLocks(), onLine: true },
    setInterval,
    setTimeout,
    structuredClone,
    TextEncoder,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    confirm: () => true,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(runtimeSource, context, { filename: "workspace-backup.js" });
  vm.runInContext(learningEventsSource, context, { filename: "learning-events.js" });
  const instrumented = journeySource.replace(
    '  window.addEventListener("storage", (event) => {',
    `  window.__journeyWriterHarness = {
    freshState: () => JSON.parse(JSON.stringify(freshState())),
    getState: () => JSON.parse(JSON.stringify(state)),
    setState: (next) => {
      state = JSON.parse(JSON.stringify(next));
      storageWritable = true;
      rawStoredValue = JSON.stringify(state);
      window.localStorage.setItem(STORAGE_KEY, rawStoredValue);
    },
    validateCandidate: validateWorkspaceBackupCandidate,
    commitNewDiagnostic,
    commitJourneyPlanClose,
    inspectNextGateACycleAdmission: (candidate) => JSON.parse(JSON.stringify(inspectNextGateACycleAdmission(candidate || state))),
    nextGateACycleRequiredAdditions: (candidate) => JSON.parse(JSON.stringify(nextGateACycleRequiredAdditions(candidate || state))),
    validateCycleEvidence: () => JSON.parse(JSON.stringify(validateCycleEvidence())),
    buildCommunityVisibilityPreview: (chain) => {
      const preview = buildCommunityVisibilityPreview(chain);
      return preview ? JSON.parse(JSON.stringify(preview)) : null;
    },
    recommendationItems: () => JSON.parse(JSON.stringify(recommendationItems())),
    createRecommendationBinding: (chain, primary, createdAt) => createRecommendationBinding(chain, primary, createdAt),
    buildDiagnosticReport: (diagnostic) => JSON.parse(JSON.stringify(buildDiagnosticReport(diagnostic))),
    deriveRetestOutcome: (skill, evidence) => deriveRetestOutcome(skill, evidence),
  };
  window.addEventListener("storage", (event) => {`,
  );
  assert.notEqual(instrumented, journeySource, "journey writer instrumentation anchor must exist");
  await vm.runInContext(instrumented, context, { filename: "journey.js" });
  const exposed = sandbox.__journeyWriterHarness as Omit<JourneyWriterHarness, "backup" | "learningEvents" | "getRaw" | "setPersistedRaw"> | undefined;
  const backup = sandbox.SufeiyaWorkspaceBackup as BackupRuntime | undefined;
  const learningEvents = sandbox.SufeiyaLearningEvents as LearningEventsRuntime | undefined;
  assert.ok(exposed && backup && learningEvents);
  return {
    ...exposed,
    backup,
    learningEvents,
    getRaw: storage.raw,
    setPersistedRaw: (raw: string) => storage.setItem("sufeiya_workspace_v1", raw),
    setNow: (value: string) => {
      const parsed = NativeDate.parse(value);
      assert.ok(Number.isFinite(parsed), `controlled journey clock requires an ISO timestamp: ${value}`);
      currentTime = parsed;
    },
  };
}

async function loadJourneyValidationHarness(): Promise<JourneyValidationHarness> {
  const storage: StorageContract = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const document = {
    body: { append: () => undefined },
    createElement: () => ({
      addEventListener: () => undefined,
      append: () => undefined,
      canPlayType: () => "",
      click: () => undefined,
      focus: () => undefined,
      remove: () => undefined,
      replaceChildren: () => undefined,
      setAttribute: () => undefined,
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const sandbox: MutableRecord = {
    AbortController,
    Blob,
    Date,
    Error,
    URL,
    URLSearchParams,
    clearInterval,
    clearTimeout,
    console,
    crypto: webcrypto,
    document,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    innerWidth: 1024,
    localStorage: storage,
    location: { origin: "http://localhost", pathname: "/", search: "", reload: () => undefined },
    navigator: { onLine: true },
    setInterval,
    setTimeout,
    structuredClone,
    TextEncoder,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(runtimeSource, context, { filename: "workspace-backup.js" });
  vm.runInContext(learningEventsSource, context, { filename: "learning-events.js" });
  const instrumentedJourney = journeySource.replace(
    "  const WORKSPACE_BACKUP_ERROR_MESSAGES = Object.freeze({",
    "  window.__validateWorkspaceBackupCandidate = validateWorkspaceBackupCandidate;\n  window.__supersededMatchesTerminalHistory = workspaceBackupSupersededMatchesTerminalHistory;\n  window.__validWorkspaceBackupDiagnosticEvidence = validWorkspaceBackupDiagnosticEvidence;\n  window.__validWorkspaceBackupDiagnostic = validWorkspaceBackupDiagnostic;\n  window.__validWorkspaceBackupRetest = validWorkspaceBackupRetest;\n  window.__validWorkspaceBackupProfile = validWorkspaceBackupProfile;\n  window.__validWorkspaceBackupPlanGraph = validWorkspaceBackupPlanGraph;\n  window.__validWorkspaceBackupCheckInRecord = validWorkspaceBackupCheckInRecord;\n  window.__deriveRetestOutcome = deriveRetestOutcome;\n  window.__buildDiagnosticReport = (...args) => buildDiagnosticReport(...args);\n  const WORKSPACE_BACKUP_ERROR_MESSAGES = Object.freeze({",
  );
  assert.notEqual(instrumentedJourney, journeySource, "journey validation instrumentation anchor must exist");
  await vm.runInContext(instrumentedJourney, context, { filename: "journey.js" });
  const backup = sandbox.SufeiyaWorkspaceBackup as BackupRuntime | undefined;
  const learningEvents = sandbox.SufeiyaLearningEvents as LearningEventsRuntime | undefined;
  const validateCandidate = sandbox.__validateWorkspaceBackupCandidate as
    | ((candidate: unknown) => Promise<MutableRecord>)
    | undefined;
  const supersededMatchesTerminalHistory = sandbox.__supersededMatchesTerminalHistory as
    | ((summary: unknown, history: unknown) => boolean)
    | undefined;
  const validDiagnosticEvidence = sandbox.__validWorkspaceBackupDiagnosticEvidence as
    | ((evidence: unknown, diagnostic: unknown) => boolean)
    | undefined;
  const validDiagnostic = sandbox.__validWorkspaceBackupDiagnostic as
    | ((diagnostic: unknown) => boolean)
    | undefined;
  const validRetest = sandbox.__validWorkspaceBackupRetest as
    | ((retest: unknown) => boolean)
    | undefined;
  const validProfile = sandbox.__validWorkspaceBackupProfile as ((profile: unknown) => boolean) | undefined;
  const validPlanGraph = sandbox.__validWorkspaceBackupPlanGraph as ((candidate: unknown) => boolean) | undefined;
  const validCheckIn = sandbox.__validWorkspaceBackupCheckInRecord as
    | ((record: unknown, candidate: unknown, options?: unknown) => boolean)
    | undefined;
  const deriveRetestOutcome = sandbox.__deriveRetestOutcome as
    | ((skill: string, evidence: unknown) => MutableRecord | null)
    | undefined;
  const buildDiagnosticReport = sandbox.__buildDiagnosticReport as
    | ((diagnostic: unknown) => MutableRecord)
    | undefined;
  assert.ok(
    backup && learningEvents && validateCandidate && supersededMatchesTerminalHistory &&
      validDiagnosticEvidence && validDiagnostic && validRetest && validProfile && validPlanGraph && validCheckIn &&
      deriveRetestOutcome && buildDiagnosticReport,
    "production backup validators must load in the VM",
  );
  return {
    backup,
    learningEvents,
    supersededMatchesTerminalHistory,
    validateCandidate,
    validDiagnosticEvidence,
    validDiagnostic,
    validRetest,
    validProfile,
    validPlanGraph,
    validCheckIn,
    deriveRetestOutcome,
    buildDiagnosticReport,
  };
}

function restorableWorkspaceFixture(): MutableRecord {
  return {
    checkInHistory: [],
    checkIns: {},
    focus: { active: null, sessions: [] },
    journey: {
      activeCycle: null,
      diagnostic: null,
      history: [],
      peerHelp: null,
      planUpdate: null,
      protocolVersion: "gate_a_local_v1",
      recommendation: null,
      retest: null,
      review: null,
      supersededCycles: [],
    },
    learningEventBindings: null,
    learningEvents: [],
    plan: null,
    planHistory: [],
    practice: {},
    practiceReceipts: {},
    profile: { dailyMinutes: 30, examDate: "", focusSkill: "Balanced", nickname: "" },
    schemaVersion: 1,
    taskProgress: {},
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

function startedCycleFixture(): { candidate: MutableRecord; cycle: MutableRecord; diagnostic: MutableRecord } {
  const candidate = restorableWorkspaceFixture();
  const createdAt = new Date().toISOString();
  const cycle: MutableRecord = {
    basePlanId: null,
    checkInId: null,
    closedAt: null,
    createdAt,
    cycleId: "cycle-test-v1",
    diagnosticSessionId: "diagnostic-test-v1",
    peerHelpId: null,
    protocolVersion: "gate_a_local_v1",
    provisionalAt: null,
    recommendationId: null,
    retestId: null,
    reviewId: null,
    status: "in_progress",
    updatedAt: createdAt,
    updatedPlanId: null,
  };
  const diagnostic: MutableRecord = {
    activeTaskId: "diagnostic-reading-library-v1",
    adultConfirmed: true,
    automatedScoreProduced: false,
    consent: {
      confirmedAt: createdAt,
      localOnlyConfirmed: true,
      noModelTrainingConfirmed: true,
      noScoreConfirmed: true,
    },
    createdAt,
    cycleId: cycle.cycleId,
    demoGoal: "det_preparation_4_weeks",
    devicePrecheck: {
      audioOutputStatus: "unavailable",
      completedAt: createdAt,
      environmentConfirmed: true,
      keyboardConfirmed: true,
      microphoneMode: "not_requested",
      mp3Supported: false,
      networkAtStart: "offline",
      safeWriteLockSupported: true,
      speechSynthesisSupported: false,
      storageStatus: "available",
      viewportMode: "desktop_or_tablet",
    },
    diagnosticProtocolVersion: "gate_a_diagnostic_evidence_v1",
    diagnosticSessionId: cycle.diagnosticSessionId,
    formalDiagnosisProduced: false,
    officialEquivalenceClaimed: false,
    protocolVersion: "gate_a_local_v1",
    status: "in_progress",
    taskEvidence: [],
    taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
    taskSetVersion: "gate_a_original_6_v1",
    updatedAt: createdAt,
  };
  const journey = asRecord(candidate.journey);
  journey.activeCycle = cycle;
  journey.diagnostic = diagnostic;
  return { candidate, cycle, diagnostic };
}

const DIAGNOSTIC_MANIFEST_FIXTURE: Record<string, MutableRecord> = {
  "diagnostic-reading-library-v1": { taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "purpose_from_supporting_details", contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7", correctValue: "b" },
  "diagnostic-reading-newsletter-v1": { taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "cause_from_text_structure", contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca", correctValue: "b" },
  "diagnostic-listening-science-club-v1": { taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "schedule_change_detail", contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308", correctValue: "b" },
  "diagnostic-listening-language-lab-v1": { taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "time_and_location_integration", contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd", correctValue: "a" },
  "diagnostic-speaking-learning-skill-v1": { taskVersion: "v1", skill: "Speaking", responseType: "timed_self_report", constructTag: "task_coverage_and_connected_thoughts_self_report", contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9" },
  "diagnostic-writing-learning-place-v1": { taskVersion: "v1", skill: "Writing", responseType: "timed_local_text", constructTag: "task_response_structure_self_review", contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85" },
};

function diagnosticTerminalEvidenceFixture(taskId: string): MutableRecord {
  const expected = DIAGNOSTIC_MANIFEST_FIXTURE[taskId];
  assert.ok(expected);
  const common: MutableRecord = {
    taskId,
    taskVersion: expected.taskVersion,
    skill: expected.skill,
    responseType: expected.responseType,
    constructTag: expected.constructTag,
    contentHash: expected.contentHash,
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    startedAt: "2026-08-12T00:01:00.000Z",
    updatedAt: "2026-08-12T00:02:00.000Z",
    completedAt: "2026-08-12T00:02:00.000Z",
  };
  if (expected.skill === "Reading") {
    return { ...common, attempts: 1, durationSeconds: 60, firstResponse: expected.correctValue, resultType: "first_response_matched" };
  }
  if (taskId === "diagnostic-listening-science-club-v1") {
    return {
      ...common,
      attempts: 1,
      audioCompleted: true,
      audioPlaybackCompletedAt: "2026-08-12T00:01:40.000Z",
      audioPlaybackStartedAt: "2026-08-12T00:01:10.000Z",
      audioPlayed: true,
      audioStartedNearBeginning: true,
      durationSeconds: 60,
      firstResponse: expected.correctValue,
      playCount: 1,
      resultType: "first_response_matched",
    };
  }
  if (taskId === "diagnostic-listening-language-lab-v1") {
    return {
      ...common,
      attempts: 1,
      audioCompleted: true,
      audioPlaybackCompletedAt: "2026-08-12T00:01:40.000Z",
      audioPlayed: true,
      durationSeconds: 60,
      firstResponse: expected.correctValue,
      playCount: 1,
      qualityFlags: ["browser_voice_variability"],
      resultType: "first_response_matched",
      speechSynthesisEnded: true,
      speechSynthesisStarted: true,
      speechVoice: { default: false, lang: "en-US", localService: true },
    };
  }
  if (expected.skill === "Speaking") {
    const timerStartedAt = Date.parse("2026-08-12T00:01:05.000Z");
    return {
      ...common,
      audioRecorded: false,
      automatedScoreProduced: false,
      durationSeconds: 90,
      evidenceStatus: "evidence_insufficient",
      qualityFlags: ["audio_not_recorded", "open_response_not_human_reviewed"],
      selfChecks: { connected: true, coverage: true, support: true },
      selfReviewCount: 3,
      timer: {
        endedAt: timerStartedAt + 110_000,
        phase: "review",
        prepEndsAt: timerStartedAt + 20_000,
        responseEndsAt: timerStartedAt + 110_000,
        startedAt: timerStartedAt,
      },
      timerCompleted: true,
      updatedAt: "2026-08-12T00:03:00.000Z",
      completedAt: "2026-08-12T00:03:00.000Z",
    };
  }
  const timerStartedAt = Date.parse("2026-08-12T00:01:00.000Z");
  const responseText = Array.from({ length: 20 }, (_, index) => `word${index + 1}`).join(" ");
  return {
    ...common,
    automatedScoreProduced: false,
    durationSeconds: 180,
    evidenceStatus: "evidence_insufficient",
    qualityFlags: ["open_response_not_human_reviewed"],
    responseText,
    selfChecks: { change: true, reviewed: true, support: true },
    selfReviewCount: 3,
    timer: { endedAt: timerStartedAt + 180_000, endsAt: timerStartedAt + 180_000, phase: "review", startedAt: timerStartedAt },
    timerCompleted: true,
    wordCount: 20,
    updatedAt: "2026-08-12T00:04:10.000Z",
    completedAt: "2026-08-12T00:04:10.000Z",
  };
}

function completedDiagnosticFixture(harness: JourneyValidationHarness): ReturnType<typeof startedCycleFixture> {
  const fixture = startedCycleFixture();
  const createdAt = "2026-08-12T00:00:00.000Z";
  const taskEvidence = Object.keys(DIAGNOSTIC_MANIFEST_FIXTURE).map(diagnosticTerminalEvidenceFixture);
  const taskTimes = [
    ["00:01:00", "00:01:30"], ["00:02:00", "00:02:30"], ["00:03:00", "00:04:00"],
    ["00:05:00", "00:06:00"], ["00:07:00", "00:09:00"], ["00:10:00", "00:13:10"],
  ];
  const at = (clock: string) => `2026-08-12T${clock}.000Z`;
  taskEvidence.forEach((evidence, index) => {
    evidence.startedAt = at(taskTimes[index][0]);
    evidence.updatedAt = at(taskTimes[index][1]);
    evidence.completedAt = at(taskTimes[index][1]);
    if (index < 4) {
      evidence.durationSeconds = Math.round((Date.parse(String(evidence.completedAt)) - Date.parse(String(evidence.startedAt))) / 1000);
    }
  });
  Object.assign(taskEvidence[2], {
    audioPlaybackStartedAt: at("00:03:10"),
    audioPlaybackCompletedAt: at("00:03:40"),
  });
  taskEvidence[3].audioPlaybackCompletedAt = at("00:05:40");
  const speakingTimerStart = Date.parse(at("00:07:05"));
  taskEvidence[4].timer = {
    endedAt: speakingTimerStart + 110_000,
    phase: "review",
    prepEndsAt: speakingTimerStart + 20_000,
    responseEndsAt: speakingTimerStart + 110_000,
    startedAt: speakingTimerStart,
  };
  const writingTimerStart = Date.parse(at("00:10:00"));
  taskEvidence[5].timer = {
    endedAt: writingTimerStart + 180_000,
    endsAt: writingTimerStart + 180_000,
    phase: "review",
    startedAt: writingTimerStart,
  };
  const completedAt = at("00:14:00");
  Object.assign(fixture.cycle, { createdAt, updatedAt: completedAt });
  Object.assign(fixture.diagnostic, {
    activeTaskId: null,
    createdAt,
    updatedAt: completedAt,
    status: "completed",
    taskEvidence,
  });
  asRecord(fixture.diagnostic.consent).confirmedAt = createdAt;
  asRecord(fixture.diagnostic.devicePrecheck).audioOutputStatus = "heard";
  asRecord(fixture.diagnostic.devicePrecheck).completedAt = createdAt;
  const report = hostClone(harness.buildDiagnosticReport(fixture.diagnostic));
  Object.assign(fixture.diagnostic, {
    completedAt,
    completedEvidenceSkills: report.completedEvidenceSkills,
    completedEvidenceTaskCount: report.completedEvidenceTaskCount,
    evidenceConfidence: report.confidence,
    evidenceSufficiency: report.evidenceSufficiency,
    learnerConfirmedPriority: true,
    patternFlags: [],
    priorityBasis: report.priorityBasis,
    prioritySkill: (report.priorityCandidates as string[])[0],
    report,
    suggestedPrioritySkills: report.priorityCandidates,
  });
  asRecord(fixture.candidate.profile).focusSkill = fixture.diagnostic.prioritySkill;
  fixture.candidate.updatedAt = fixture.diagnostic.completedAt;
  return fixture;
}

function retestFixture(harness: JourneyValidationHarness, skill: string): MutableRecord {
  const evidenceBySkill: Record<string, MutableRecord> = {
    Reading: { responseType: "single_choice", resultType: "single_task_correct", selectedAnswer: "b" },
    Listening: {
      audioCompleted: true,
      audioPlayed: true,
      playCount: 1,
      playbackFailed: false,
      responseType: "single_choice_audio",
      resultType: "single_task_correct",
      seekDetected: false,
      selectedAnswer: "c",
      transcriptUsed: false,
    },
    Writing: { responseType: "self_reviewed_writing", resultType: "task_completed_no_score", selfChecksComplete: true, wordCount: 20 },
    Speaking: { audioRecorded: false, responseType: "learner_confirmed_speaking", resultType: "task_completed_no_score", selfChecksComplete: true },
  };
  const catalogBySkill: Record<string, MutableRecord> = {
    Reading: { taskId: "retest-reading-garden-labels-v1", taskVersion: "v1", parallelFormPairId: "gate-a-reading-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct" },
    Listening: { taskId: "retest-listening-writing-center-v1", taskVersion: "v1", parallelFormPairId: "gate-a-listening-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct" },
    Writing: { taskId: "retest-writing-study-habit-v1", taskVersion: "v1", parallelFormPairId: "gate-a-writing-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct" },
    Speaking: { taskId: "retest-speaking-study-place-v1", taskVersion: "v1", parallelFormPairId: "gate-a-speaking-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct" },
  };
  const evidence = evidenceBySkill[skill];
  const catalog = catalogBySkill[skill];
  assert.ok(evidence && catalog);
  const derived = harness.deriveRetestOutcome(skill, evidence);
  assert.ok(derived);
  return {
    automatedScoreProduced: false,
    baselinePracticeReceiptId: `receipt-${skill.toLowerCase()}-v1`,
    baselineTaskId: `task-${skill.toLowerCase()}-v1`,
    checkInId: "check-in-retest-v1",
    comparability: {
      comparisonBoundary: "same_skill_only_no_calibrated_construct_or_difficulty_equivalence",
      constructAlignment: catalog.constructAlignment,
      measurementReviewed: false,
      newOriginalPrompt: true,
      officialEquivalenceClaimed: false,
      sameAsDiagnosticPriority: true,
      sameAsPlanTask: true,
      sameAsPracticeReceipt: true,
      sameSkill: true,
      targetSkill: skill,
      teacherReviewed: false,
    },
    completedAt: "2026-08-12T00:10:00.000Z",
    cycleId: "cycle-retest-v1",
    diagnosticSessionId: "diagnostic-retest-v1",
    evidence,
    evidenceStatus: derived.evidenceStatus,
    evidenceSufficiency: derived.evidenceSufficiency,
    growthClaimProduced: false,
    humanConfirmationStatus: derived.humanConfirmationStatus,
    interpretation: "single_task_evidence_only_no_growth_claim",
    parallelFormPairId: catalog.parallelFormPairId,
    parallelRetest: true,
    parallelTaskId: catalog.taskId,
    peerHelpId: "peer-help-retest-v1",
    planId: "plan-retest-v1",
    recommendationId: "recommendation-retest-v1",
    retestId: `retest-${skill.toLowerCase()}-v1`,
    reviewId: "review-retest-v1",
    skill,
    status: "completed",
    taskVersion: catalog.taskVersion,
  };
}

function standaloneReadingReceiptFixture(): MutableRecord {
  const candidate = restorableWorkspaceFixture();
  const receiptId = "00000000-0000-4000-8000-000000000001";
  const attemptId = "00000000-0000-4000-8000-000000000002";
  const startedAt = "2026-08-12T00:01:00.000Z";
  const completedAt = "2026-08-12T00:02:00.000Z";
  const receipt = {
    activityId: "https://sufeiya.cn/activities/practice/reading-library/v1",
    activityVersion: "v1",
    attemptCount: 1,
    audioCompleted: false,
    audioPlayed: false,
    audioRecorded: false,
    automatedScoreProduced: false,
    completedAt,
    completionCondition: "correct_answer_observed",
    completionReceiptId: receiptId,
    completionSource: "guided_practice",
    contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f",
    contentId: "reading-library-v1",
    contentRef: {
      contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f",
      contentId: "reading-library-v1",
      contentVersion: "v1",
      exerciseId: "reading-library-v1",
    },
    cycleId: null,
    diagnosticSessionId: null,
    evidence: { attemptCount: 1, finalResponse: "b", firstResponse: "b", resultType: "correct" },
    evidenceClass: "practice_receipt",
    evidenceStatus: "evidence_limited",
    evidenceType: "answer_matched",
    exerciseId: "reading-library-v1",
    formalDiagnosisProduced: false,
    integrityClass: "unsigned_local_receipt",
    officialEquivalenceClaimed: false,
    ownerScope: "browser_local_not_account_bound",
    planId: null,
    practiceAttemptId: attemptId,
    protocolVersion: "sufeiya_practice_receipt_v2",
    qualityFlags: [],
    receiptEvidenceClass: "objective_response",
    recommendationId: null,
    route: "/practice-reading",
    sealed: true,
    selfCheckCount: null,
    skill: "Reading",
    startedAt,
    status: "completed",
    taskDate: null,
    taskId: null,
    taskRef: null,
    wordCount: null,
  };
  asRecord(candidate.practiceReceipts)[receiptId] = receipt;
  asRecord(candidate.practice)["reading-library-v1"] = {
    attemptScopeKey: "standalone:reading-library-v1",
    attempts: 1,
    audioCompleted: false,
    audioPlaybackFailed: false,
    audioPlayed: false,
    audioRecorded: false,
    audioSeekDetected: false,
    audioStartedNearBeginning: false,
    completedAt,
    draftText: "",
    firstResponse: "b",
    freshAttemptFromLegacyReceiptId: null,
    latestPracticeReceiptId: receiptId,
    playCount: 0,
    selectedAnswer: "b",
    selfChecks: {},
    startedAt,
    status: "completed",
    timerCompleted: false,
    transcriptUsed: false,
    updatedAt: completedAt,
    wordCount: 0,
  };
  return candidate;
}

function standaloneListeningReceiptFixture(): MutableRecord {
  const candidate = standaloneReadingReceiptFixture();
  const receipts = asRecord(candidate.practiceReceipts);
  const receipt = Object.values(receipts)[0] as MutableRecord;
  receipt.activityId = "https://sufeiya.cn/activities/practice/listening-club/v1";
  receipt.completionCondition = "correct_answer_observed";
  receipt.contentHash = "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb";
  receipt.contentId = "listening-club-v1";
  receipt.contentRef = {
    contentHash: receipt.contentHash,
    contentId: receipt.contentId,
    contentVersion: "v1",
    exerciseId: "listening-club-v1",
  };
  receipt.evidence = {
    attemptCount: 1,
    audioCompleted: true,
    audioPlayed: true,
    finalResponse: "b",
    firstResponse: "b",
    playCount: 1,
    playbackFailed: false,
    resultType: "correct",
    seekDetected: false,
    transcriptUsed: false,
  };
  receipt.exerciseId = "listening-club-v1";
  receipt.receiptEvidenceClass = "audio_objective_response";
  receipt.route = "/practice-listening";
  receipt.skill = "Listening";
  receipt.audioPlayed = true;
  receipt.audioCompleted = true;
  const readingPractice = asRecord(candidate.practice)["reading-library-v1"] as MutableRecord;
  delete asRecord(candidate.practice)["reading-library-v1"];
  asRecord(candidate.practice)["listening-club-v1"] = {
    ...readingPractice,
    attemptScopeKey: "standalone:listening-club-v1",
    audioCompleted: true,
    audioPlayed: true,
    audioStartedNearBeginning: true,
    playCount: 1,
  };
  return candidate;
}

async function standaloneWritingReceiptFixture(harness: JourneyValidationHarness): Promise<MutableRecord> {
  const candidate = restorableWorkspaceFixture();
  const receiptId = "00000000-0000-4000-8000-000000000011";
  const attemptId = "00000000-0000-4000-8000-000000000012";
  const startedAt = "2026-08-12T00:03:00.000Z";
  const completedAt = "2026-08-12T00:04:00.000Z";
  const draftText = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon";
  const selfChecks = { edit: true, idea: true, reason: true };
  const artifactHash = await harness.backup.sha256Hex(draftText);
  asRecord(candidate.practiceReceipts)[receiptId] = {
    activityId: "https://sufeiya.cn/activities/practice/writing-community/v1",
    activityVersion: "v1",
    attemptCount: null,
    audioCompleted: false,
    audioPlayed: false,
    audioRecorded: false,
    automatedScoreProduced: false,
    completedAt,
    completionCondition: "minimum_words_and_self_review",
    completionReceiptId: receiptId,
    completionSource: "guided_practice",
    contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b",
    contentId: "writing-community-v1",
    contentRef: {
      contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b",
      contentId: "writing-community-v1",
      contentVersion: "v1",
      exerciseId: "writing-community-v1",
    },
    cycleId: null,
    diagnosticSessionId: null,
    evidence: {
      artifactHash,
      resultType: "completed_no_score",
      selfCheckCount: 3,
      selfChecks,
      wordCount: 20,
    },
    evidenceClass: "practice_receipt",
    evidenceStatus: "evidence_limited",
    evidenceType: "task_completed_no_score",
    exerciseId: "writing-community-v1",
    formalDiagnosisProduced: false,
    integrityClass: "unsigned_local_receipt",
    officialEquivalenceClaimed: false,
    ownerScope: "browser_local_not_account_bound",
    planId: null,
    practiceAttemptId: attemptId,
    protocolVersion: "sufeiya_practice_receipt_v2",
    qualityFlags: ["open_response_not_human_reviewed"],
    receiptEvidenceClass: "self_reviewed_artifact",
    recommendationId: null,
    route: "/practice-writing",
    sealed: true,
    selfCheckCount: 3,
    skill: "Writing",
    startedAt,
    status: "completed",
    taskDate: null,
    taskId: null,
    taskRef: null,
    wordCount: 20,
  };
  asRecord(candidate.practice)["writing-community-v1"] = {
    attemptScopeKey: "standalone:writing-community-v1",
    attempts: 0,
    audioCompleted: false,
    audioPlaybackFailed: false,
    audioPlayed: false,
    audioRecorded: false,
    audioSeekDetected: false,
    audioStartedNearBeginning: false,
    completedAt,
    draftText,
    firstResponse: null,
    freshAttemptFromLegacyReceiptId: null,
    latestPracticeReceiptId: receiptId,
    playCount: 0,
    selectedAnswer: null,
    selfChecks,
    startedAt,
    status: "completed",
    timerCompleted: false,
    transcriptUsed: false,
    updatedAt: completedAt,
    wordCount: 20,
  };
  return candidate;
}


async function standaloneSpeakingReceiptFixture(harness: JourneyValidationHarness): Promise<MutableRecord> {
  const candidate = await standaloneWritingReceiptFixture(harness);
  const receipt = Object.values(asRecord(candidate.practiceReceipts))[0] as MutableRecord;
  receipt.activityId = "https://sufeiya.cn/activities/practice/speaking-skill/v1";
  receipt.completionCondition = "timer_and_self_review";
  receipt.contentHash = "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843";
  receipt.contentId = "speaking-skill-v1";
  receipt.contentRef = {
    contentHash: receipt.contentHash,
    contentId: receipt.contentId,
    contentVersion: "v1",
    exerciseId: "speaking-skill-v1",
  };
  receipt.evidence = {
    audioRecorded: false,
    prepSeconds: 20,
    responseSeconds: 60,
    resultType: "completed_no_score",
    selfCheckCount: 3,
    selfChecks: { answer: true, example: true, flow: true },
    timerCompleted: true,
  };
  receipt.evidenceType = "task_completed_no_score";
  receipt.exerciseId = "speaking-skill-v1";
  receipt.qualityFlags = ["audio_not_recorded", "open_response_not_human_reviewed"];
  receipt.receiptEvidenceClass = "timed_self_report";
  receipt.route = "/practice-speaking";
  receipt.skill = "Speaking";
  receipt.wordCount = null;
  const writingPractice = asRecord(candidate.practice)["writing-community-v1"] as MutableRecord;
  delete asRecord(candidate.practice)["writing-community-v1"];
  asRecord(candidate.practice)["speaking-skill-v1"] = {
    ...writingPractice,
    attemptScopeKey: "standalone:speaking-skill-v1",
    draftText: "",
    selfChecks: { answer: true, example: true, flow: true },
    timerCompleted: true,
    wordCount: 0,
  };
  return candidate;
}

function expiredActivePlanFixture(): MutableRecord {
  const candidate = restorableWorkspaceFixture();
  const planId = "plan-expired-v1";
  const skills = ["Reading", "Listening", "Writing", "Speaking", "Reading", "Listening", "Writing"];
  const catalogs: Record<string, MutableRecord> = {
    Listening: {
      contentHash: "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb",
      contentId: "listening-club-v1",
      exerciseId: "listening-club-v1",
      route: "/practice-listening",
      title: "完成一段英文听力练习",
      instruction: "记录听到的时间、变化或关键事实",
    },
    Reading: {
      contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f",
      contentId: "reading-library-v1",
      exerciseId: "reading-library-v1",
      route: "/practice-reading",
      title: "完成一篇英文短文阅读",
      instruction: "找出主旨，并说明支持它的一条信息",
    },
    Speaking: {
      contentHash: "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843",
      contentId: "speaking-skill-v1",
      exerciseId: "speaking-skill-v1",
      route: "/practice-speaking",
      title: "完成一次英文口语计时",
      instruction: "回应所有问题，并给出至少一个具体例子",
    },
    Writing: {
      contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b",
      contentId: "writing-community-v1",
      exerciseId: "writing-community-v1",
      route: "/practice-writing",
      title: "完成一个英文写作提示",
      instruction: "写清一个观点，并用理由或例子支持",
    },
  };
  const days = skills.map((skill, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, "0")}`;
    const catalog = catalogs[skill];
    return {
      coreSkill: skill,
      date,
      tasks: [
        {
          date,
          durationMinutes: 6,
          instructionZh: "快速浏览今天的英文提示与关键词，明确任务要求。",
          route: "/practice",
          skill: "General",
          taskId: `${planId}-${date}-warmup`,
          titleZh: "英文热身",
        },
        {
          contentRef: {
            contentHash: catalog.contentHash,
            contentId: catalog.contentId,
            contentVersion: "v1",
            exerciseId: catalog.exerciseId,
          },
          date,
          durationMinutes: 18,
          instructionZh: catalog.instruction,
          route: catalog.route,
          skill,
          taskId: `${planId}-${date}-${skill.toLowerCase()}`,
          titleZh: catalog.title,
        },
        {
          date,
          durationMinutes: 6,
          instructionZh: "写下今天完成了什么、哪里困难，以及明天先做什么。",
          route: "/check-in",
          skill: "Reflection",
          taskId: `${planId}-${date}-reflection`,
          titleZh: "记录学习证据",
        },
      ],
    };
  });
  candidate.plan = {
    createdAt: "2026-08-01T00:00:00.000Z",
    dailyMinutes: 30,
    days,
    diagnosticSessionId: null,
    endDate: "2026-08-07",
    examDate: "",
    focusSkill: "Balanced",
    nickname: "",
    planId,
    provenance: { source: "learner_configured_standalone" },
    startDate: "2026-08-01",
    status: "active",
  };
  const date = "2026-08-12";
  const savedAt = "2026-08-12T00:02:00.000Z";
  const checkInId = "check-in-default-v1";
  asRecord(candidate.checkIns)[date] = {
    anomalyReviewStatus: "not_flagged",
    checkInId,
    cycleId: null,
    date,
    diagnosticSessionId: null,
    didText: "Completed an independent review.",
    evidenceClass: "learner_self_report",
    evidenceText: "Local learner note.",
    learnerConfirmedReview: false,
    linkedTaskId: "",
    planId,
    practiceAttemptId: null,
    practiceReceipt: null,
    questionStatus: "none",
    questionText: "",
    recommendationId: null,
    reviewedAt: null,
    reviewId: null,
    savedAt,
    status: "saved",
    taskCompletionReceiptId: null,
    updatedAt: savedAt,
    visibility: "local_only",
  };
  asRecord(candidate.taskProgress)[`default-${date}-reflection`] = {
    completedAt: savedAt,
    completionClass: "workflow_receipt",
    selfReported: false,
    source: "check-in",
    status: "completed",
    updatedAt: savedAt,
    workflowReceipt: {
      checkInId,
      completedAt: savedAt,
      protocolVersion: "sufeiya_check_in_completion_v1",
      taskId: `default-${date}-reflection`,
    },
  };
  return candidate;
}

function exactPlanFromTemplate({
  planId,
  focusSkill,
  createdAt,
  provenance,
  diagnosticSessionId,
  status = "active",
  supersededAt,
  supersededReason,
  supersededByRetestId,
}: {
  planId: string;
  focusSkill: string;
  createdAt: string;
  provenance: MutableRecord;
  diagnosticSessionId?: string | null;
  status?: string;
  supersededAt?: string;
  supersededReason?: string;
  supersededByRetestId?: string;
}): MutableRecord {
  const sourcePlan = asRecord(expiredActivePlanFixture().plan);
  const sourceDays = sourcePlan.days as MutableRecord[];
  const bySkill = Object.fromEntries(sourceDays.map((day) => {
    const core = (day.tasks as MutableRecord[]).find((task) => task.skill === day.coreSkill) as MutableRecord;
    return [String(day.coreSkill), core];
  })) as Record<string, MutableRecord>;
  const sequences: Record<string, string[]> = {
    Balanced: ["Reading", "Listening", "Writing", "Speaking", "Reading", "Listening", "Writing"],
    Reading: ["Reading", "Listening", "Reading", "Writing", "Reading", "Speaking", "Reading"],
    Listening: ["Listening", "Reading", "Listening", "Writing", "Listening", "Speaking", "Listening"],
    Writing: ["Writing", "Reading", "Writing", "Listening", "Writing", "Speaking", "Writing"],
    Speaking: ["Speaking", "Reading", "Speaking", "Listening", "Speaking", "Writing", "Speaking"],
  };
  const skills = sequences[focusSkill];
  assert.ok(skills);
  const startDate = "2026-08-01";
  const days = skills.map((skill, index) => {
    const date = `2026-08-${String(index + 1).padStart(2, "0")}`;
    const sourceCore = bySkill[skill];
    return {
      coreSkill: skill,
      date,
      tasks: [
        {
          date,
          durationMinutes: 6,
          instructionZh: "快速浏览今天的英文提示与关键词，明确任务要求。",
          route: "/practice",
          skill: "General",
          taskId: `${planId}-${date}-warmup`,
          titleZh: "英文热身",
        },
        {
          contentRef: hostClone(sourceCore.contentRef),
          date,
          durationMinutes: 18,
          instructionZh: sourceCore.instructionZh,
          route: sourceCore.route,
          skill,
          taskId: `${planId}-${date}-${skill.toLowerCase()}`,
          titleZh: sourceCore.titleZh,
        },
        {
          date,
          durationMinutes: 6,
          instructionZh: "写下今天完成了什么、哪里困难，以及明天先做什么。",
          route: "/check-in",
          skill: "Reflection",
          taskId: `${planId}-${date}-reflection`,
          titleZh: "记录学习证据",
        },
      ],
    };
  });
  return {
    createdAt,
    dailyMinutes: 30,
    days,
    ...(diagnosticSessionId !== undefined ? { diagnosticSessionId } : {}),
    endDate: "2026-08-07",
    examDate: "",
    focusSkill,
    nickname: "",
    planId,
    provenance,
    startDate,
    status,
    ...(supersededAt ? { supersededAt } : {}),
    ...(supersededReason ? { supersededReason } : {}),
    ...(supersededByRetestId ? { supersededByRetestId } : {}),
  };
}

function capacityUuid(index: number, family: number): string {
  const tail = (family * 1_000_000 + index + 1).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8${family.toString(16).padStart(3, "0").slice(-3)}-${tail}`;
}

function validStandaloneReceiptHistory(count: number): MutableRecord {
  const templateState = standaloneReadingReceiptFixture();
  const template = hostClone(Object.values(asRecord(templateState.practiceReceipts))[0] as MutableRecord);
  return Object.fromEntries(Array.from({ length: count }, (_, index) => {
    const completionReceiptId = capacityUuid(index, 1);
    const receipt = hostClone(template);
    receipt.completionReceiptId = completionReceiptId;
    receipt.practiceAttemptId = capacityUuid(index, 2);
    return [completionReceiptId, receipt];
  }));
}

function validFocusSessionHistory(count: number): MutableRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    sessionId: `focus-${(index + 1).toString(36)}`,
    status: "completed",
    durationSeconds: 900,
    startedAt: "2026-08-12T00:00:00.000Z",
    endedAt: "2026-08-12T00:15:00.000Z",
  }));
}

function validArchivedCheckInHistory(count: number, state: MutableRecord): MutableRecord[] {
  const current = hostClone(Object.values(asRecord(state.checkIns))[0] as MutableRecord);
  return Array.from({ length: count }, (_, index) => ({
    ...hostClone(current),
    checkInId: `check-in-archived-${(index + 1).toString(36)}`,
    archivedAt: "2026-08-12T00:03:00.000Z",
    archivedReason: "learner_revision_after_save",
  }));
}

function validStandalonePlanHistory(count: number): MutableRecord[] {
  return Array.from({ length: count }, (_, index) => exactPlanFromTemplate({
    planId: `plan-history-${(index + 1).toString(36)}`,
    focusSkill: "Balanced",
    createdAt: "2026-08-01T00:00:00.000Z",
    diagnosticSessionId: null,
    provenance: { source: "learner_configured_standalone" },
    status: "superseded",
    supersededAt: "2026-08-12T00:00:00.000Z",
    supersededReason: "learner_manual_regeneration",
  }));
}

const STRICT_CYCLE_TIMES = Object.freeze({
  createdAt: "2026-08-12T00:00:00.000Z",
  diagnosticCompletedAt: "2026-08-12T00:14:00.000Z",
  planCreatedAt: "2026-08-12T00:15:00.000Z",
  recommendationAt: "2026-08-12T00:16:00.000Z",
  practiceStartedAt: "2026-08-12T00:17:00.000Z",
  practiceCompletedAt: "2026-08-12T00:18:00.000Z",
  checkInAt: "2026-08-12T00:19:00.000Z",
  reviewAt: "2026-08-12T00:20:00.000Z",
  peerHelpAt: "2026-08-12T00:21:00.000Z",
  retestAt: "2026-08-12T00:22:00.000Z",
  closeAt: "2026-08-12T00:23:00.000Z",
});

async function appendJourneyDomainEvent(
  writer: JourneyWriterHarness,
  candidate: MutableRecord,
  eventType: string,
  domain: MutableRecord,
  occurredAt: string,
): Promise<void> {
  writer.setNow(occurredAt);
  const outcome = await writer.learningEvents.appendDomainEvent(candidate, eventType, domain);
  assert.equal(outcome.status, "appended", `${eventType}: ${String(outcome.code || "append failed")}`);
}

async function strictJourneyPreCloseFixture(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
  { stopAfterPractice = false }: { stopAfterPractice?: boolean } = {},
): Promise<MutableRecord> {
  const started = startedCycleFixture();
  const candidate = started.candidate;
  Object.assign(started.cycle, {
    createdAt: STRICT_CYCLE_TIMES.createdAt,
    updatedAt: STRICT_CYCLE_TIMES.createdAt,
  });
  Object.assign(started.diagnostic, {
    createdAt: STRICT_CYCLE_TIMES.createdAt,
    updatedAt: STRICT_CYCLE_TIMES.createdAt,
  });
  asRecord(started.diagnostic.consent).confirmedAt = STRICT_CYCLE_TIMES.createdAt;
  asRecord(started.diagnostic.devicePrecheck).completedAt = STRICT_CYCLE_TIMES.createdAt;
  writer.setNow(STRICT_CYCLE_TIMES.createdAt);
  await appendJourneyDomainEvent(
    writer,
    candidate,
    "learning_cycle.started",
    { cycle: started.cycle, diagnostic: started.diagnostic },
    STRICT_CYCLE_TIMES.createdAt,
  );

  const completed = completedDiagnosticFixture(validation);
  const journey = asRecord(candidate.journey);
  journey.activeCycle = completed.cycle;
  journey.diagnostic = completed.diagnostic;
  candidate.profile = completed.candidate.profile;
  candidate.updatedAt = STRICT_CYCLE_TIMES.diagnosticCompletedAt;
  const cycle = asRecord(journey.activeCycle);
  const diagnostic = asRecord(journey.diagnostic);
  const focusSkill = String(diagnostic.prioritySkill);
  const plan = exactPlanFromTemplate({
    planId: "plan-strict-cycle-base-v1",
    focusSkill,
    createdAt: STRICT_CYCLE_TIMES.planCreatedAt,
    diagnosticSessionId: String(cycle.diagnosticSessionId),
    provenance: {
      source: "learner_configured_after_gate_a_evidence_diagnostic",
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
      priorityBasis: diagnostic.priorityBasis,
    },
  });
  candidate.plan = plan;
  cycle.basePlanId = plan.planId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.planCreatedAt;
  candidate.updatedAt = STRICT_CYCLE_TIMES.planCreatedAt;

  writer.setState(candidate);
  const items = writer.recommendationItems();
  assert.equal(items.length, 3, "strict cycle needs the actual three recommendation items");
  const recommendationId = "recommendation-strict-cycle-v1";
  const recommendationBinding = writer.createRecommendationBinding(
    writer.validateCycleEvidence(),
    items[0],
    STRICT_CYCLE_TIMES.recommendationAt,
  );
  assert.ok(recommendationBinding, "actual recommendation binding must be derivable");
  const recommendation: MutableRecord = {
    recommendationId,
    cycleId: cycle.cycleId,
    planId: cycle.basePlanId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    status: "accepted",
    itemCount: items.length,
    primary: items[0],
    evidenceBinding: recommendationBinding,
    supplements: items.slice(1),
    sourceMode: "frozen_local_routes_no_rag",
    learnerChoice: true,
    updatedAt: STRICT_CYCLE_TIMES.recommendationAt,
    createdAt: STRICT_CYCLE_TIMES.recommendationAt,
  };
  journey.recommendation = recommendation;
  cycle.recommendationId = recommendationId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.recommendationAt;
  candidate.updatedAt = STRICT_CYCLE_TIMES.recommendationAt;
  await appendJourneyDomainEvent(
    writer,
    candidate,
    "recommendation.decided",
    { recommendation },
    STRICT_CYCLE_TIMES.recommendationAt,
  );

  const primary = asRecord(recommendation.primary);
  const receiptId = "00000000-0000-4000-8000-00000000c001";
  const attemptId = "00000000-0000-4000-8000-00000000c002";
  const receipt = hostClone(Object.values(asRecord(standaloneReadingReceiptFixture().practiceReceipts))[0] as MutableRecord);
  Object.assign(receipt, {
    completedAt: STRICT_CYCLE_TIMES.practiceCompletedAt,
    completionReceiptId: receiptId,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    planId: cycle.basePlanId,
    practiceAttemptId: attemptId,
    recommendationId,
    startedAt: STRICT_CYCLE_TIMES.practiceStartedAt,
    taskDate: String(primary.taskId).split("-").slice(-3, -2)[0] || "2026-08-12",
    taskId: primary.taskId,
  });
  const basePlanDay = (plan.days as MutableRecord[]).find((day) =>
    (day.tasks as MutableRecord[]).some((task) => task.taskId === primary.taskId));
  assert.ok(basePlanDay, "recommendation primary must belong to the generated base plan");
  receipt.taskDate = basePlanDay.date;
  receipt.taskRef = {
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    planId: cycle.basePlanId,
    taskDate: receipt.taskDate,
    taskId: receipt.taskId,
  };
  candidate.practiceReceipts = { [receiptId]: receipt };
  asRecord(candidate.taskProgress)[String(receipt.taskId)] = {
    completedAt: receipt.completedAt,
    completionClass: "practice_receipt",
    evidenceStatus: receipt.evidenceStatus,
    practiceReceiptId: receiptId,
    receiptEvidenceClass: receipt.receiptEvidenceClass,
    selfReported: false,
    source: "practice-reading",
    status: "completed",
    updatedAt: receipt.completedAt,
  };
  await appendJourneyDomainEvent(
    writer,
    candidate,
    "practice_attempt.finalized",
    { receipt, recommendation },
    STRICT_CYCLE_TIMES.practiceCompletedAt,
  );
  if (stopAfterPractice) {
    writer.setState(candidate);
    return candidate;
  }

  const checkInId = "check-in-strict-cycle-v1";
  const checkIn: MutableRecord = {
    anomalyReviewStatus: "not_flagged",
    checkInId,
    cycleId: cycle.cycleId,
    date: receipt.taskDate,
    diagnosticSessionId: cycle.diagnosticSessionId,
    didText: "Completed the linked reading task carefully.",
    evidenceClass: "practice_receipt",
    evidenceText: "Saved the exact local practice receipt as evidence.",
    learnerConfirmedReview: false,
    linkedTaskId: receipt.taskId,
    planId: cycle.basePlanId,
    practiceAttemptId: attemptId,
    practiceReceipt: hostClone(receipt),
    questionStatus: "none",
    questionText: "",
    recommendationId,
    reviewedAt: null,
    reviewId: null,
    savedAt: STRICT_CYCLE_TIMES.checkInAt,
    status: "saved",
    taskCompletionReceiptId: receiptId,
    updatedAt: STRICT_CYCLE_TIMES.checkInAt,
    visibility: "local_only",
  };
  asRecord(candidate.checkIns)[String(checkIn.date)] = checkIn;
  const reflectionTask = (basePlanDay.tasks as MutableRecord[]).find((task) => task.skill === "Reflection") as MutableRecord;
  assert.ok(reflectionTask);
  asRecord(candidate.taskProgress)[String(reflectionTask.taskId)] = {
    completedAt: STRICT_CYCLE_TIMES.checkInAt,
    completionClass: "workflow_receipt",
    selfReported: false,
    source: "check-in",
    status: "completed",
    updatedAt: STRICT_CYCLE_TIMES.checkInAt,
    workflowReceipt: {
      checkInId,
      completedAt: STRICT_CYCLE_TIMES.checkInAt,
      protocolVersion: "sufeiya_check_in_completion_v1",
      taskId: reflectionTask.taskId,
    },
  };
  cycle.checkInId = checkInId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.checkInAt;
  candidate.updatedAt = STRICT_CYCLE_TIMES.checkInAt;
  await appendJourneyDomainEvent(
    writer,
    candidate,
    "check_in.committed",
    { checkIn, recommendation },
    STRICT_CYCLE_TIMES.checkInAt,
  );

  const reviewId = "review-strict-cycle-v1";
  const review: MutableRecord = {
    cycleId: cycle.cycleId,
    reviewId,
    checkInId,
    learnerConfirmed: true,
    shareStatus: "not_shared",
    reminderStatus: "not_enabled",
    humanEscalationStatus: "not_requested",
    confirmedAt: STRICT_CYCLE_TIMES.reviewAt,
  };
  journey.review = review;
  Object.assign(checkIn, {
    learnerConfirmedReview: true,
    reviewedAt: STRICT_CYCLE_TIMES.reviewAt,
    reviewId,
    updatedAt: STRICT_CYCLE_TIMES.reviewAt,
  });
  cycle.reviewId = reviewId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.reviewAt;

  const peerHelpId = "peer-help-strict-cycle-v1";
  const peerHelp: MutableRecord = {
    peerHelpId,
    cycleId: cycle.cycleId,
    planId: cycle.basePlanId,
    reviewId,
    status: "not_needed",
    source: "synthetic_demo_card_v1",
    learnerChoice: true,
    realCommunityUsed: false,
    updatedAt: STRICT_CYCLE_TIMES.peerHelpAt,
    createdAt: STRICT_CYCLE_TIMES.peerHelpAt,
  };
  journey.peerHelp = peerHelp;
  cycle.peerHelpId = peerHelpId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.peerHelpAt;

  const retest = retestFixture(validation, focusSkill);
  Object.assign(retest, {
    baselinePracticeReceiptId: receiptId,
    baselineTaskId: receipt.taskId,
    checkInId,
    completedAt: STRICT_CYCLE_TIMES.retestAt,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    peerHelpId,
    planId: cycle.basePlanId,
    recommendationId,
    retestId: "retest-strict-cycle-v1",
    reviewId,
  });
  journey.retest = retest;
  cycle.retestId = retest.retestId;
  cycle.updatedAt = STRICT_CYCLE_TIMES.retestAt;
  candidate.updatedAt = STRICT_CYCLE_TIMES.retestAt;
  await appendJourneyDomainEvent(
    writer,
    candidate,
    "retest.completed",
    { retest, recommendation },
    STRICT_CYCLE_TIMES.retestAt,
  );
  writer.setState(candidate);
  assert.equal(writer.validateCycleEvidence().retestEvidenceComplete, true, "strict cycle must be closable");
  return candidate;
}

function replaceAllStrictIds<T>(value: T, replacements: Map<string, string>): T {
  let serialized = JSON.stringify(value);
  [...replacements.entries()]
    .sort(([left], [right]) => right.length - left.length)
    .forEach(([from, to]) => { serialized = serialized.split(from).join(to); });
  return JSON.parse(serialized) as T;
}

function shiftStrictCycleTimestamps<T>(value: T, days: number): T {
  const offset = days * 24 * 60 * 60 * 1000;
  const visit = (candidate: unknown): unknown => {
    if (typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}T/.test(candidate)) {
      const parsed = Date.parse(candidate);
      return Number.isFinite(parsed) ? new Date(parsed + offset).toISOString() : candidate;
    }
    if (typeof candidate === "number" && candidate >= Date.parse("2020-01-01T00:00:00.000Z")) {
      return candidate + offset;
    }
    if (Array.isArray(candidate)) return candidate.map(visit);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(Object.entries(candidate).map(([key, child]) => [key, visit(child)]));
    }
    return candidate;
  };
  return visit(value) as T;
}

function remapStrictCycleSlice(
  source: MutableRecord,
  index: number,
  { terminal }: { terminal: boolean },
): MutableRecord {
  const journey = asRecord(source.journey);
  const cycle = terminal
    ? asRecord((journey.history as MutableRecord[])[0])
    : asRecord(journey.activeCycle);
  const recommendation = terminal ? asRecord(cycle.recommendation) : asRecord(journey.recommendation);
  const checkIn = terminal ? asRecord(cycle.checkIn) : Object.values(asRecord(source.checkIns))[0] as MutableRecord;
  const receipt = asRecord(checkIn.practiceReceipt);
  const replacements = new Map<string, string>([
    [String(cycle.cycleId), `cycle-capacity-${index.toString(36)}`],
    [String(cycle.diagnosticSessionId), `diagnostic-capacity-${index.toString(36)}`],
    [String(cycle.basePlanId), `plan-capacity-base-${index.toString(36)}`],
    [String(cycle.recommendationId), `recommendation-capacity-${index.toString(36)}`],
    [String(recommendation.evidenceBinding && asRecord(recommendation.evidenceBinding).bindingId), `recommendation-binding-capacity-${index.toString(36)}`],
    [String(cycle.checkInId), `check-in-capacity-${index.toString(36)}`],
    [String(cycle.reviewId), `review-capacity-${index.toString(36)}`],
    [String(cycle.peerHelpId), `peer-help-capacity-${index.toString(36)}`],
    [String(cycle.retestId), `retest-capacity-${index.toString(36)}`],
    [String(receipt.completionReceiptId), capacityUuid(index, 12)],
    [String(receipt.practiceAttemptId), capacityUuid(index, 13)],
  ]);
  if (terminal) replacements.set(String(cycle.updatedPlanId), `plan-capacity-updated-${index.toString(36)}`);
  return shiftStrictCycleTimestamps(replaceAllStrictIds(source, replacements), index);
}

function terminalHistorySupersededSummary(history: MutableRecord, supersededAt: string): MutableRecord {
  const diagnostic = asRecord(history.diagnostic);
  return {
    cycleId: history.cycleId,
    diagnosticSessionId: history.diagnosticSessionId,
    protocolVersion: history.protocolVersion,
    diagnosticProtocolVersion: diagnostic.diagnosticProtocolVersion,
    taskSetVersion: diagnostic.taskSetVersion,
    taskSetDigest: diagnostic.taskSetDigest,
    diagnosticStatus: diagnostic.status,
    taskEvidenceSummary: (diagnostic.taskEvidence as MutableRecord[]).map((item) => ({
      taskId: item.taskId,
      taskVersion: item.taskVersion,
      contentHash: item.contentHash,
      skill: item.skill,
      status: item.status,
      evidenceStatus: item.evidenceStatus,
      qualityFlags: hostClone(item.qualityFlags),
      ...(Number.isFinite(Number(item.durationSeconds)) ? { durationSeconds: Number(item.durationSeconds) } : {}),
      ...(Number.isFinite(Number(item.wordCount)) ? { wordCount: Number(item.wordCount) } : {}),
      ...(Number.isFinite(Number(item.selfReviewCount)) ? { selfReviewCount: Number(item.selfReviewCount) } : {}),
      ...(typeof item.resultType === "string" ? { resultType: item.resultType } : {}),
    })),
    prioritySkill: diagnostic.prioritySkill,
    priorityBasis: diagnostic.priorityBasis,
    evidenceSufficiency: diagnostic.evidenceSufficiency,
    status: "superseded_by_new_diagnostic",
    supersededAt,
    reason: "learner_started_new_gate_a_evidence_pack",
  };
}

async function appendStrictCycleLedger(
  writer: JourneyWriterHarness,
  candidate: MutableRecord,
  cycleRecord: MutableRecord,
): Promise<void> {
  const diagnostic = asRecord(cycleRecord.diagnostic);
  const recommendation = asRecord(cycleRecord.recommendation);
  const checkIn = asRecord(cycleRecord.checkIn);
  const retest = asRecord(cycleRecord.retest);
  const planUpdate = cycleRecord.planUpdate ? asRecord(cycleRecord.planUpdate) : null;
  const startedCycle = {
    basePlanId: null,
    checkInId: null,
    closedAt: null,
    createdAt: cycleRecord.createdAt,
    cycleId: cycleRecord.cycleId,
    diagnosticSessionId: cycleRecord.diagnosticSessionId,
    peerHelpId: null,
    protocolVersion: cycleRecord.protocolVersion,
    provisionalAt: null,
    recommendationId: null,
    retestId: null,
    reviewId: null,
    status: "in_progress",
    updatedAt: cycleRecord.createdAt,
    updatedPlanId: null,
  };
  const startedDiagnostic = {
    cycleId: cycleRecord.cycleId,
    diagnosticSessionId: cycleRecord.diagnosticSessionId,
    protocolVersion: diagnostic.protocolVersion,
    status: "in_progress",
    taskSetDigest: diagnostic.taskSetDigest,
    taskSetVersion: diagnostic.taskSetVersion,
  };
  await appendJourneyDomainEvent(writer, candidate, "learning_cycle.started", {
    cycle: startedCycle,
    diagnostic: startedDiagnostic,
  }, String(cycleRecord.createdAt));
  await appendJourneyDomainEvent(writer, candidate, "recommendation.decided", { recommendation }, String(recommendation.createdAt));
  await appendJourneyDomainEvent(writer, candidate, "practice_attempt.finalized", {
    receipt: checkIn.practiceReceipt,
    recommendation,
  }, String(asRecord(checkIn.practiceReceipt).completedAt));
  await appendJourneyDomainEvent(writer, candidate, "check_in.committed", { checkIn, recommendation }, String(checkIn.savedAt));
  await appendJourneyDomainEvent(writer, candidate, "retest.completed", { retest, recommendation }, String(retest.completedAt));
  if (planUpdate) {
    await appendJourneyDomainEvent(writer, candidate, "learning_cycle.completed", {
      cycle: cycleRecord,
      retest,
      planUpdate,
    }, String(cycleRecord.closedAt));
  }
}

async function strictClosedCycleTemplate(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
): Promise<MutableRecord> {
  const preClose = await strictJourneyPreCloseFixture(writer, validation);
  writer.setNow(STRICT_CYCLE_TIMES.closeAt);
  const outcome = await writer.commitJourneyPlanClose(String(asRecord(preClose.profile).focusSkill));
  assert.equal(outcome.status, "saved", String(outcome.code || "strict close failed"));
  return writer.getState();
}

async function strictTerminalCycleCollection(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
  template: MutableRecord,
  count: number,
): Promise<MutableRecord> {
  assert.ok(Number.isInteger(count) && count >= 1);
  const slices = Array.from({ length: count }, (_, index) =>
    remapStrictCycleSlice(template, index, { terminal: true }));
  const result = writer.freshState();
  result.plan = slices.at(-1)?.plan || null;
  result.planHistory = slices.flatMap((slice, index) => {
    const plans = [hostClone((slice.planHistory as MutableRecord[])[0])];
    if (index < slices.length - 1) {
      const laterCreatedAt = asRecord(asRecord(slices[index + 1].journey).activeCycle).createdAt;
      plans.push({
        ...hostClone(asRecord(slice.plan)),
        status: "superseded",
        supersededAt: laterCreatedAt,
        supersededReason: "learner_started_new_gate_a_evidence_pack",
      });
    }
    return plans;
  });
  const resultJourney = asRecord(result.journey);
  const lastJourney = asRecord(slices.at(-1)?.journey);
  resultJourney.activeCycle = hostClone(lastJourney.activeCycle);
  resultJourney.diagnostic = hostClone(lastJourney.diagnostic);
  resultJourney.recommendation = hostClone(lastJourney.recommendation);
  resultJourney.review = hostClone(lastJourney.review);
  resultJourney.peerHelp = hostClone(lastJourney.peerHelp);
  resultJourney.retest = hostClone(lastJourney.retest);
  resultJourney.planUpdate = hostClone(lastJourney.planUpdate);
  resultJourney.history = slices.map((slice) => hostClone((asRecord(slice.journey).history as MutableRecord[])[0]));
  resultJourney.supersededCycles = slices.slice(0, -1).map((slice, index) => {
    const history = (asRecord(slice.journey).history as MutableRecord[])[0];
    const supersededAt = asRecord(asRecord(slices[index + 1].journey).activeCycle).createdAt;
    return terminalHistorySupersededSummary(history, String(supersededAt));
  });
  result.profile = hostClone(slices.at(-1)?.profile);
  result.practice = {};
  result.practiceReceipts = {};
  result.taskProgress = {};
  result.checkIns = {};
  result.checkInHistory = [];
  result.learningEvents = [];
  result.learningEventBindings = null;
  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index];
    const history = (asRecord(slice.journey).history as MutableRecord[])[0];
    const receipt = asRecord(history.checkIn).practiceReceipt as MutableRecord;
    asRecord(result.practiceReceipts)[String(receipt.completionReceiptId)] = hostClone(receipt);
    Object.assign(asRecord(result.taskProgress), hostClone(slice.taskProgress));
    const checkIn = hostClone(asRecord(history.checkIn));
    if (index === slices.length - 1) {
      asRecord(result.checkIns)[String(checkIn.date)] = checkIn;
    } else {
      (result.checkInHistory as MutableRecord[]).push({
        ...checkIn,
        archivedAt: asRecord(asRecord(slices[index + 1].journey).activeCycle).createdAt,
        archivedReason: "scope_changed",
      });
    }
    await appendStrictCycleLedger(writer, result, history);
  }
  result.updatedAt = asRecord(resultJourney.activeCycle).updatedAt;
  return result;
}

async function strictPreCloseAfterTerminalCycles(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
  closedTemplate: MutableRecord,
  preCloseTemplate: MutableRecord,
  completedCount: number,
): Promise<MutableRecord> {
  const prior = await strictTerminalCycleCollection(writer, validation, closedTemplate, completedCount);
  const next = remapStrictCycleSlice(preCloseTemplate, completedCount, { terminal: false });
  const nextJourney = asRecord(next.journey);
  const nextCycle = asRecord(nextJourney.activeCycle);
  const candidate = hostClone(prior);
  const candidateJourney = asRecord(candidate.journey);
  const previousHistory = (candidateJourney.history as MutableRecord[]).at(-1) as MutableRecord;
  const previousPlan = asRecord(candidate.plan);
  (candidate.planHistory as MutableRecord[]).push({
    ...hostClone(previousPlan),
    status: "superseded",
    supersededAt: nextCycle.createdAt,
    supersededReason: "learner_started_new_gate_a_evidence_pack",
  });
  candidateJourney.supersededCycles = [
    ...(candidateJourney.supersededCycles as MutableRecord[]),
    terminalHistorySupersededSummary(previousHistory, String(nextCycle.createdAt)),
  ];
  const previousCheckIn = hostClone(Object.values(asRecord(candidate.checkIns))[0] as MutableRecord);
  candidate.checkInHistory = [
    ...(candidate.checkInHistory as MutableRecord[]),
    {
      ...previousCheckIn,
      archivedAt: nextCycle.createdAt,
      archivedReason: "scope_changed",
    },
  ];
  candidate.plan = hostClone(next.plan);
  candidateJourney.activeCycle = hostClone(nextJourney.activeCycle);
  candidateJourney.diagnostic = hostClone(nextJourney.diagnostic);
  candidateJourney.recommendation = hostClone(nextJourney.recommendation);
  candidateJourney.review = hostClone(nextJourney.review);
  candidateJourney.peerHelp = hostClone(nextJourney.peerHelp);
  candidateJourney.retest = hostClone(nextJourney.retest);
  candidateJourney.planUpdate = null;
  candidate.profile = hostClone(next.profile);
  candidate.checkIns = hostClone(next.checkIns);
  Object.assign(asRecord(candidate.practiceReceipts), hostClone(next.practiceReceipts));
  Object.assign(asRecord(candidate.taskProgress), hostClone(next.taskProgress));
  const currentCheckIn = Object.values(asRecord(candidate.checkIns))[0] as MutableRecord;
  await appendStrictCycleLedger(writer, candidate, {
    ...hostClone(nextCycle),
    diagnostic: hostClone(nextJourney.diagnostic),
    recommendation: hostClone(nextJourney.recommendation),
    checkIn: hostClone(currentCheckIn),
    review: hostClone(nextJourney.review),
    peerHelp: hostClone(nextJourney.peerHelp),
    retest: hostClone(nextJourney.retest),
    planUpdate: null,
  });
  candidate.updatedAt = nextCycle.updatedAt;
  return candidate;
}

function preCloseSupersededSummary(candidate: MutableRecord, supersededAt: string): MutableRecord {
  const journey = asRecord(candidate.journey);
  const cycle = asRecord(journey.activeCycle);
  const diagnostic = asRecord(journey.diagnostic);
  return {
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    protocolVersion: cycle.protocolVersion,
    diagnosticProtocolVersion: diagnostic.diagnosticProtocolVersion,
    taskSetVersion: diagnostic.taskSetVersion,
    taskSetDigest: diagnostic.taskSetDigest,
    diagnosticStatus: diagnostic.status,
    taskEvidenceSummary: (diagnostic.taskEvidence as MutableRecord[]).map((item) => ({
      taskId: item.taskId,
      taskVersion: item.taskVersion,
      contentHash: item.contentHash,
      skill: item.skill,
      status: item.status,
      evidenceStatus: item.evidenceStatus,
      qualityFlags: hostClone(item.qualityFlags),
      ...(Number.isFinite(Number(item.durationSeconds)) ? { durationSeconds: Number(item.durationSeconds) } : {}),
      ...(Number.isFinite(Number(item.wordCount)) ? { wordCount: Number(item.wordCount) } : {}),
      ...(Number.isFinite(Number(item.selfReviewCount)) ? { selfReviewCount: Number(item.selfReviewCount) } : {}),
      ...(typeof item.resultType === "string" ? { resultType: item.resultType } : {}),
    })),
    prioritySkill: diagnostic.prioritySkill,
    priorityBasis: diagnostic.priorityBasis,
    evidenceSufficiency: diagnostic.evidenceSufficiency,
    status: "superseded_by_new_diagnostic",
    supersededAt,
    reason: "learner_started_new_gate_a_evidence_pack",
  };
}

async function strictSupersededPrefixCollection(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
  preCloseTemplate: MutableRecord,
  cycleCount: number,
  practicesPerCycle: number,
): Promise<MutableRecord> {
  assert.ok(Number.isInteger(cycleCount) && cycleCount >= 1 && cycleCount <= 64);
  assert.ok(Number.isInteger(practicesPerCycle) && practicesPerCycle >= 1 && practicesPerCycle <= 3);
  const result = writer.freshState();
  result.plan = null;
  result.planHistory = [];
  result.practice = {};
  result.practiceReceipts = {};
  result.taskProgress = {};
  result.checkIns = {};
  result.checkInHistory = [];
  result.learningEvents = [];
  result.learningEventBindings = null;
  const resultJourney = asRecord(result.journey);
  resultJourney.activeCycle = null;
  resultJourney.diagnostic = null;
  resultJourney.recommendation = null;
  resultJourney.review = null;
  resultJourney.peerHelp = null;
  resultJourney.retest = null;
  resultJourney.planUpdate = null;
  resultJourney.history = [];
  resultJourney.supersededCycles = [];
  for (let index = 0; index < cycleCount; index += 1) {
    const slice = remapStrictCycleSlice(preCloseTemplate, index, { terminal: false });
    const sliceJourney = asRecord(slice.journey);
    const cycle = asRecord(sliceJourney.activeCycle);
    const recommendation = asRecord(sliceJourney.recommendation);
    recommendation.status = "skipped";
    const sourceReceipt = Object.values(asRecord(slice.practiceReceipts))[0] as MutableRecord;
    const plan = hostClone(asRecord(slice.plan));
    const supersededAt = new Date(Date.parse(String(cycle.updatedAt)) + 60_000).toISOString();
    (result.planHistory as MutableRecord[]).push({
      ...plan,
      status: "superseded",
      supersededAt,
      supersededReason: "learner_started_new_gate_a_evidence_pack",
    });
    (resultJourney.supersededCycles as MutableRecord[]).push(preCloseSupersededSummary(slice, supersededAt));

    const planTasks = (plan.days as MutableRecord[])
      .flatMap((day) => day.tasks as MutableRecord[])
      .filter((task) => task.skill === "Reading" && task.taskId !== asRecord(recommendation.primary).taskId);
    assert.ok(planTasks.length >= practicesPerCycle);
    const receipts: MutableRecord[] = [];
    for (let practiceIndex = 0; practiceIndex < practicesPerCycle; practiceIndex += 1) {
      const task = planTasks[practiceIndex];
      const completedAt = new Date(Date.parse(String(sourceReceipt.completedAt)) + practiceIndex * 10_000).toISOString();
      const startedAt = new Date(Date.parse(completedAt) - 60_000).toISOString();
      const receiptId = capacityUuid(index * 4 + practiceIndex, 14);
      const attemptId = capacityUuid(index * 4 + practiceIndex, 15);
      const receipt: MutableRecord = {
        ...hostClone(sourceReceipt),
        completedAt,
        completionReceiptId: receiptId,
        practiceAttemptId: attemptId,
        startedAt,
        taskDate: task.date,
        taskId: task.taskId,
        taskRef: {
          cycleId: cycle.cycleId,
          diagnosticSessionId: cycle.diagnosticSessionId,
          planId: cycle.basePlanId,
          taskDate: task.date,
          taskId: task.taskId,
        },
      };
      asRecord(result.practiceReceipts)[receiptId] = receipt;
      asRecord(result.taskProgress)[String(task.taskId)] = {
        completedAt,
        completionClass: "practice_receipt",
        evidenceStatus: receipt.evidenceStatus,
        practiceReceiptId: receiptId,
        receiptEvidenceClass: receipt.receiptEvidenceClass,
        selfReported: false,
        source: "practice-reading",
        status: "completed",
        updatedAt: completedAt,
      };
      receipts.push(receipt);
    }
    const sourceCheckIn = Object.values(asRecord(slice.checkIns))[0] as MutableRecord;
    const checkedReceipt = receipts[0];
    const checkIn: MutableRecord = {
      ...hostClone(sourceCheckIn),
      date: checkedReceipt.taskDate,
      linkedTaskId: checkedReceipt.taskId,
      practiceAttemptId: checkedReceipt.practiceAttemptId,
      practiceReceipt: hostClone(checkedReceipt),
      taskCompletionReceiptId: checkedReceipt.completionReceiptId,
      archivedAt: supersededAt,
      archivedReason: "scope_changed",
    };
    (result.checkInHistory as MutableRecord[]).push(checkIn);
    const diagnostic = asRecord(sliceJourney.diagnostic);
    await appendJourneyDomainEvent(writer, result, "learning_cycle.started", {
      cycle: {
        ...hostClone(cycle),
        basePlanId: null,
        recommendationId: null,
        checkInId: null,
        reviewId: null,
        peerHelpId: null,
        retestId: null,
        updatedPlanId: null,
        status: "in_progress",
        updatedAt: cycle.createdAt,
      },
      diagnostic: {
        cycleId: cycle.cycleId,
        diagnosticSessionId: cycle.diagnosticSessionId,
        protocolVersion: diagnostic.protocolVersion,
        status: "in_progress",
        taskSetDigest: diagnostic.taskSetDigest,
        taskSetVersion: diagnostic.taskSetVersion,
      },
    }, String(cycle.createdAt));
    await appendJourneyDomainEvent(writer, result, "recommendation.decided", { recommendation }, String(recommendation.createdAt));
    for (const receipt of receipts) {
      await appendJourneyDomainEvent(writer, result, "practice_attempt.finalized", { receipt, recommendation }, String(receipt.completedAt));
    }
    await appendJourneyDomainEvent(writer, result, "check_in.committed", { checkIn, recommendation }, String(checkIn.savedAt));
    const retest: MutableRecord = {
      ...hostClone(asRecord(sliceJourney.retest)),
      baselinePracticeReceiptId: checkedReceipt.completionReceiptId,
      baselineTaskId: checkedReceipt.taskId,
    };
    await appendJourneyDomainEvent(writer, result, "retest.completed", { retest, recommendation }, String(retest.completedAt));
  }
  result.updatedAt = String((resultJourney.supersededCycles as MutableRecord[]).at(-1)?.supersededAt);
  return result;
}

async function strictMixedSupersededEventCollection(
  writer: JourneyWriterHarness,
  validation: JourneyValidationHarness,
  preCloseTemplate: MutableRecord,
  fullPrefixCount: number,
  totalCycleCount = 64,
): Promise<MutableRecord> {
  assert.ok(Number.isInteger(fullPrefixCount) && fullPrefixCount >= 1 && fullPrefixCount <= totalCycleCount);
  const result = await strictSupersededPrefixCollection(writer, validation, preCloseTemplate, fullPrefixCount, 1);
  const journey = asRecord(result.journey);
  for (let index = fullPrefixCount; index < totalCycleCount; index += 1) {
    const createdAt = new Date(Date.parse(STRICT_CYCLE_TIMES.createdAt) + index * 86_400_000).toISOString();
    const supersededAt = new Date(Date.parse(createdAt) + 60_000).toISOString();
    const cycleId = `cycle-started-only-${index.toString(36)}`;
    const diagnosticSessionId = `diagnostic-started-only-${index.toString(36)}`;
    const cycle = {
      basePlanId: null,
      checkInId: null,
      closedAt: null,
      createdAt,
      cycleId,
      diagnosticSessionId,
      peerHelpId: null,
      protocolVersion: "gate_a_local_v1",
      provisionalAt: null,
      recommendationId: null,
      retestId: null,
      reviewId: null,
      status: "in_progress",
      updatedAt: createdAt,
      updatedPlanId: null,
    };
    const diagnostic = {
      diagnosticSessionId,
      cycleId,
      protocolVersion: "gate_a_local_v1",
      diagnosticProtocolVersion: "gate_a_diagnostic_evidence_v1",
      taskSetVersion: "gate_a_original_6_v1",
      taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
      status: "in_progress",
    };
    (journey.supersededCycles as MutableRecord[]).push({
      cycleId,
      diagnosticSessionId,
      protocolVersion: cycle.protocolVersion,
      diagnosticProtocolVersion: diagnostic.diagnosticProtocolVersion,
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
      diagnosticStatus: "in_progress",
      taskEvidenceSummary: [],
      status: "superseded_by_new_diagnostic",
      supersededAt,
      reason: "learner_started_new_gate_a_evidence_pack",
    });
    await appendJourneyDomainEvent(writer, result, "learning_cycle.started", { cycle, diagnostic }, createdAt);
  }
  result.updatedAt = String((journey.supersededCycles as MutableRecord[]).at(-1)?.supersededAt);
  return result;
}


function planBoundReadingReceiptFixture(): MutableRecord {
  const candidate = expiredActivePlanFixture();
  const standalone = standaloneReadingReceiptFixture();
  const receiptId = Object.keys(asRecord(standalone.practiceReceipts))[0];
  const receipt = hostClone(asRecord(standalone.practiceReceipts)[receiptId] as MutableRecord);
  const plan = asRecord(candidate.plan);
  const firstDay = (plan.days as MutableRecord[])[0];
  const task = (firstDay.tasks as MutableRecord[]).find((item) => item.skill === "Reading") as MutableRecord;
  receipt.taskId = task.taskId;
  receipt.taskDate = task.date;
  receipt.planId = plan.planId;
  receipt.taskRef = {
    cycleId: null,
    diagnosticSessionId: null,
    planId: plan.planId,
    taskDate: task.date,
    taskId: task.taskId,
  };
  candidate.practiceReceipts = { [receiptId]: receipt };
  const practice = hostClone(asRecord(standalone.practice)["reading-library-v1"] as MutableRecord);
  practice.attemptScopeKey = [
    `plan:${String(plan.planId)}`,
    `task:${String(task.taskId)}`,
    "cycle:none",
    "diagnostic:none",
    "recommendation:none",
  ].join("|");
  candidate.practice = { "reading-library-v1": practice };
  asRecord(candidate.taskProgress)[String(task.taskId)] = {
    completedAt: receipt.completedAt,
    completionClass: "practice_receipt",
    evidenceStatus: receipt.evidenceStatus,
    practiceReceiptId: receipt.completionReceiptId,
    receiptEvidenceClass: receipt.receiptEvidenceClass,
    selfReported: false,
    source: "practice-reading",
    status: "completed",
    updatedAt: receipt.completedAt,
  };
  return candidate;
}

async function appendStartedCycleEvent(
  harness: JourneyValidationHarness,
  fixture: ReturnType<typeof startedCycleFixture>,
): Promise<void> {
  const result = await harness.learningEvents.appendDomainEvent(
    fixture.candidate,
    "learning_cycle.started",
    { cycle: fixture.cycle, diagnostic: fixture.diagnostic },
  );
  assert.equal(result.status, "appended", String(result.code || ""));
}

async function inspectProductionCandidate(
  harness: JourneyValidationHarness,
  candidate: MutableRecord,
): Promise<MutableRecord> {
  const created = await harness.backup.createEnvelope(candidate);
  assert.equal(created.status, "ready", `test candidate must receive a newly computed SHA: ${String(created.code || "")}`);
  return harness.backup.inspectEnvelopeText(
    JSON.stringify(created.envelope),
    harness.validateCandidate,
  );
}

async function assertWriterPreStateReady(
  harness: Pick<WorkspaceWriterHarness | JourneyWriterHarness, "backup">,
  candidate: MutableRecord,
  label: string,
): Promise<void> {
  const created = await harness.backup.createEnvelope(candidate);
  assert.equal(created.status, "ready", `${label}: capacity envelope`);
  const validationHarness = await loadJourneyValidationHarness();
  const validation = await validationHarness.validateCandidate(candidate);
  assert.equal(validation.ok, true, `${label}: ${String(validation.code || "workspace invalid")}`);
}

function workspaceFixture(): MutableRecord {
  return {
    checkInHistory: [],
    checkIns: {},
    focus: { sessions: [] },
    journey: {
      activeCycle: null,
      diagnostic: null,
      history: [],
      peerHelp: null,
      planUpdate: null,
      protocolVersion: "gate_a_local_v1",
      recommendation: null,
      retest: null,
      review: null,
      supersededCycles: [],
    },
    learningEventBindings: null,
    learningEvents: [
      {
        eventHash: HASH,
        eventType: "diagnostic_completed",
        occurredAt: "2026-08-12T00:00:00.000Z",
      },
    ],
    plan: null,
    planHistory: [],
    practice: {},
    practiceReceipts: {},
    profile: { nickname: "Gate A 学习者" },
    schemaVersion: 1,
    taskProgress: {},
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

async function readyEnvelope(runtime: BackupRuntime): Promise<MutableRecord> {
  const created = await runtime.createEnvelope(workspaceFixture());
  assert.equal(created.status, "ready");
  return hostClone(asRecord(created.envelope));
}

async function inspect(
  runtime: BackupRuntime,
  envelope: MutableRecord,
): Promise<MutableRecord> {
  return runtime.inspectEnvelopeText(
    JSON.stringify(envelope),
    async () => ({ ok: true, summary: { nextRoute: "/workspace" } }),
  );
}

class MemoryStorage implements StorageContract {
  readonly writes: string[] = [];
  readonly removals: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(key: string, initial: string | null) {
    if (initial !== null) this.values.set(key, initial);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push(value);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.removals.push(key);
    this.values.delete(key);
  }
}

describe("workspace backup envelope", () => {
  it("round-trips one canonical workspace and exposes matching event integrity", async () => {
    const runtime = loadRuntime();
    const workspace = workspaceFixture();
    const created = await runtime.createEnvelope(workspace);

    assert.equal(created.status, "ready");
    const envelope = asRecord(created.envelope);
    const integrity = asRecord(envelope.integrity);
    assert.equal(envelope.backupProtocol, runtime.BACKUP_PROTOCOL);
    assert.equal(envelope.namespace, runtime.WORKSPACE_NAMESPACE);
    assert.equal(integrity.learningEventCount, 1);
    assert.equal(integrity.learningEventHeadHash, HASH);
    assert.match(String(integrity.sha256), /^[0-9a-f]{64}$/);

    const inspected = await inspect(runtime, hostClone(envelope));
    assert.equal(inspected.status, "ready");
    assert.equal(
      runtime.canonicalJson(inspected.workspace),
      runtime.canonicalJson(workspace),
    );
  });

  it("rejects a workspace whose content no longer matches its SHA-256", async () => {
    const runtime = loadRuntime();
    const envelope = await readyEnvelope(runtime);
    asRecord(asRecord(envelope.workspace).profile).nickname = "篡改后的学习者";

    const result = await inspect(runtime, envelope);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "integrity_mismatch");
  });

  it("rejects an integrity byteLength that does not match canonical UTF-8 bytes", async () => {
    const runtime = loadRuntime();
    const envelope = await readyEnvelope(runtime);
    const integrity = asRecord(envelope.integrity);
    integrity.byteLength = Number(integrity.byteLength) + 1;

    const result = await inspect(runtime, envelope);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "integrity_mismatch");
  });

  it("rejects a different backup protocol before workspace validation", async () => {
    const runtime = loadRuntime();
    const envelope = await readyEnvelope(runtime);
    envelope.backupProtocol = "sufeiya_workspace_backup_v0";

    const result = await inspect(runtime, envelope);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "envelope_contract");
  });

  it("rejects unknown envelope fields instead of silently accepting them", async () => {
    const runtime = loadRuntime();
    const envelope = await readyEnvelope(runtime);
    envelope.unexpected = true;

    const result = await inspect(runtime, envelope);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "envelope_shape");
  });

  it("rejects prototype and account identity keys anywhere in the workspace tree", async () => {
    const runtime = loadRuntime();

    for (const dangerousKey of ["__proto__", "clerkUserId"]) {
      const envelope = await readyEnvelope(runtime);
      Object.defineProperty(asRecord(asRecord(envelope.workspace).profile), dangerousKey, {
        configurable: true,
        enumerable: true,
        value: "forbidden",
        writable: true,
      });

      const result = await inspect(runtime, envelope);
      assert.equal(result.status, "invalid", dangerousKey);
      assert.equal(result.code, "forbidden_key", dangerousKey);
    }
  });

  it("rejects files over 2 MiB before parsing and workspaces over 1 MiB before export", async () => {
    const runtime = loadRuntime();
    const oversizedFile = " ".repeat(runtime.MAX_FILE_BYTES + 1);
    const fileResult = await runtime.inspectEnvelopeText(
      oversizedFile,
      async () => ({ ok: true }),
    );
    assert.equal(fileResult.status, "invalid");
    assert.equal(fileResult.code, "file_too_large");

    const workspace = workspaceFixture();
    asRecord(workspace.profile).notes = Array.from(
      { length: 300 },
      (_, index) => `${String(index).padStart(3, "0")}:${"x".repeat(4_080)}`,
    );
    assert.ok(Buffer.byteLength(runtime.canonicalJson(workspace), "utf8") > runtime.MAX_WORKSPACE_BYTES);

    const workspaceResult = await runtime.createEnvelope(workspace);
    assert.equal(workspaceResult.status, "invalid_workspace");
    assert.equal(workspaceResult.code, "workspace_too_large");
  });

  it("accepts 64 superseded cycle receipts and rejects the 65th before hashing", async () => {
    const runtime = loadRuntime();
    const workspace = workspaceFixture();
    const journey = asRecord(workspace.journey);
    journey.supersededCycles = Array.from({ length: 64 }, (_, index) => ({
      cycleId: `cycle-${index}`,
    }));

    const atLimit = await runtime.createEnvelope(workspace);
    assert.equal(atLimit.status, "ready");

    (journey.supersededCycles as unknown[]).push({ cycleId: "cycle-64" });
    const overLimit = await runtime.createEnvelope(workspace);
    assert.equal(overLimit.status, "invalid_workspace");
    assert.equal(overLimit.code, "workspace_count_limit");
  });
});

describe("workspace append capacity contract", () => {
  it("accepts all exact collection ceilings and rejects the next append with current and limit", () => {
    const runtime = loadRuntime();
    const workspace = restorableWorkspaceFixture();
    workspace.planHistory = Array.from({ length: 64 }, () => null);
    asRecord(workspace.journey).history = Array.from({ length: runtime.CAPACITY_LIMITS.journeyHistory }, () => null);
    workspace.practiceReceipts = Object.fromEntries(Array.from({ length: 256 }, (_, index) => [`receipt-${index}`, null]));
    workspace.checkInHistory = Array.from({ length: 256 }, () => null);
    workspace.learningEvents = Array.from({ length: runtime.CAPACITY_LIMITS.learningEvents }, () => null);
    asRecord(workspace.focus).sessions = Array.from({ length: 512 }, () => null);

    assert.equal(runtime.inspectWorkspaceCapacity(workspace).status, "ready");
    for (const field of ["planHistory", "journeyHistory", "practiceReceipts", "checkInHistory", "learningEvents", "focusSessions"]) {
      assert.equal(runtime.inspectWorkspaceAppendCapacity(workspace, { [field]: 0 }).status, "ready", field);
      const rejected = runtime.inspectWorkspaceAppendCapacity(workspace, { [field]: 1 });
      assert.equal(rejected.status, "capacity_reached", field);
      assert.equal(rejected.field, field);
      assert.equal(rejected.current, runtime.CAPACITY_LIMITS[field]);
      assert.equal(rejected.limit, runtime.CAPACITY_LIMITS[field]);
    }
  });

  it("preflights composite writer deltas, including provisional completion without an event", () => {
    const runtime = loadRuntime();
    const workspace = restorableWorkspaceFixture();
    workspace.planHistory = Array.from({ length: 63 }, () => null);
    asRecord(workspace.journey).history = Array.from({ length: runtime.CAPACITY_LIMITS.journeyHistory - 1 }, () => null);
    workspace.practiceReceipts = Object.fromEntries(Array.from({ length: 255 }, (_, index) => [`receipt-${index}`, null]));
    workspace.checkInHistory = Array.from({ length: 255 }, () => null);
    workspace.learningEvents = Array.from({ length: runtime.CAPACITY_LIMITS.learningEvents - 1 }, () => null);
    asRecord(workspace.focus).sessions = Array.from({ length: 511 }, () => null);

    for (const additions of [
      { planHistory: 1, journeyHistory: 1, learningEvents: 1 },
      { planHistory: 1, journeyHistory: 1, learningEvents: 0 },
      { practiceReceipts: 1, learningEvents: 1 },
      { checkInHistory: 1, learningEvents: 1 },
      { focusSessions: 1 },
    ]) {
      assert.equal(runtime.inspectWorkspaceAppendCapacity(workspace, additions).status, "ready");
    }

    workspace.learningEvents = Array.from({ length: runtime.CAPACITY_LIMITS.learningEvents }, () => null);
    assert.equal(
      runtime.inspectWorkspaceAppendCapacity(workspace, { planHistory: 1, journeyHistory: 1, learningEvents: 0 }).status,
      "ready",
      "a provisional close adds no event",
    );
    const terminal = runtime.inspectWorkspaceAppendCapacity(workspace, { planHistory: 1, journeyHistory: 1, learningEvents: 1 });
    assert.equal(terminal.status, "capacity_reached");
    assert.equal(terminal.field, "learningEvents");
  });

  it("rejects workspaces over canonical bytes and JSON nodes through the same pure inspector", () => {
    const runtime = loadRuntime();
    const byteHeavy = restorableWorkspaceFixture();
    byteHeavy.practiceReceipts = Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => [`receipt-${index}`, "x".repeat(4_096)]),
    );
    assert.ok(Buffer.byteLength(runtime.canonicalJson(byteHeavy), "utf8") > runtime.CAPACITY_LIMITS.workspaceBytes);
    const byteResult = runtime.inspectWorkspaceCapacity(byteHeavy);
    assert.equal(byteResult.status, "invalid_workspace");
    assert.equal(byteResult.code, "workspace_too_large");

    const nodeHeavy = restorableWorkspaceFixture();
    asRecord(nodeHeavy.profile).capacityProbe = Array.from({ length: 131_072 }, () => null);
    const nodeResult = runtime.inspectWorkspaceCapacity(nodeHeavy);
    assert.equal(nodeResult.status, "invalid_workspace");
    assert.equal(nodeResult.code, "too_many_values");
  });
});

describe("learning event capacity boundary", () => {
  it("allows an exact semantic replay at 212 and rejects a 213th event without mutation", async () => {
    const harness = await loadJourneyValidationHarness();
    const state = restorableWorkspaceFixture();
    const createdAt = new Date(Date.now() - 1_000).toISOString();
    const domainFor = (index: number): MutableRecord => {
      const cycleId = `cycle-capacity-${index}`;
      const diagnosticSessionId = `diagnostic-capacity-${index}`;
      return {
        cycle: {
          createdAt,
          cycleId,
          diagnosticSessionId,
          protocolVersion: "gate_a_local_v1",
          status: "in_progress",
        },
        diagnostic: {
          cycleId,
          diagnosticSessionId,
          protocolVersion: "gate_a_local_v1",
          status: "in_progress",
          taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
          taskSetVersion: "gate_a_original_6_v1",
        },
      };
    };

    for (let index = 0; index < harness.backup.CAPACITY_LIMITS.learningEvents; index += 1) {
      const result = await harness.learningEvents.appendDomainEvent(state, "learning_cycle.started", domainFor(index));
      assert.equal(result.status, "appended", `event ${index + 1}`);
    }
    assert.equal((state.learningEvents as unknown[]).length, 212);

    const beforeReplay = hostClone(state);
    const replay = await harness.learningEvents.appendDomainEvent(state, "learning_cycle.started", domainFor(0));
    assert.equal(replay.status, "already_recorded");
    assert.deepEqual(hostClone(state), beforeReplay);

    const beforeOverflow = hostClone(state);
    const overflow = await harness.learningEvents.appendDomainEvent(state, "learning_cycle.started", domainFor(212));
    assert.equal(overflow.status, "capacity_reached");
    assert.equal(overflow.code, "learning_events_capacity_reached");
    assert.equal(overflow.limit, 212);
    assert.deepEqual(hostClone(state), beforeOverflow);
  });
});

describe("sealed writer lineage guards", () => {
  it("presents sealed plan recovery before any destructive-plan confirmation", () => {
    const guardIndex = workspaceSource.indexOf("cycleHasSealedDownstream(state, currentCycle)");
    const confirmationIndex = workspaceSource.indexOf('window.confirm("重新生成会替换当前及未来计划');
    assert.ok(guardIndex >= 0 && confirmationIndex >= 0 && guardIndex < confirmationIndex);
    assert.match(workspaceSource, /workspaceSealedAlert/);
    assert.match(workspaceSource, /setAttribute\("role", "alert"\)[\s\S]*setAttribute\("tabindex", "-1"\)/);
    assert.match(workspaceSource, /link\.href = "\/diagnostic"/);
  });

  it("distinguishes a replaceable diagnostic-bound plan from sealed downstream IDs, objects, and events", async () => {
    const guards = await loadWorkspaceGuardHarness();
    const state = restorableWorkspaceFixture();
    const journey = asRecord(state.journey);
    const cycle: MutableRecord = {
      cycleId: "cycle-lineage",
      diagnosticSessionId: "diagnostic-lineage",
      recommendationId: null,
      checkInId: null,
      reviewId: null,
      peerHelpId: null,
      retestId: null,
      updatedPlanId: null,
    };
    journey.activeCycle = cycle;
    assert.equal(guards.cycleHasSealedDownstream(state, cycle), false);

    cycle.recommendationId = "recommendation-lineage";
    assert.equal(guards.cycleHasSealedDownstream(state, cycle), true);
    cycle.recommendationId = null;

    journey.recommendation = { cycleId: cycle.cycleId };
    assert.equal(guards.cycleHasSealedDownstream(state, cycle), true);
    journey.recommendation = null;

    state.learningEventBindings = { records: { cycle: { [String(cycle.cycleId)]: "cycle-alias" } } };
    state.learningEvents = [{ eventType: "recommendation.decided", context: { learningCycleId: "cycle-alias" } }];
    assert.equal(guards.cycleHasSealedDownstream(state, cycle), true);
  });

  it("allows an unsealed standalone revision but blocks a current cycle check-in with its committed event", async () => {
    const guards = await loadWorkspaceGuardHarness();
    const state = restorableWorkspaceFixture();
    const journey = asRecord(state.journey);
    const cycle = { cycleId: "cycle-check-in", checkInId: "check-in-sealed" };
    journey.activeCycle = cycle;
    const record = { status: "saved", cycleId: cycle.cycleId, checkInId: cycle.checkInId };

    assert.equal(guards.sealedCurrentCycleCheckIn(state, record), false);
    state.learningEventBindings = { records: { checkIn: { "check-in-sealed": "check-in-alias" } } };
    state.learningEvents = [{ eventType: "check_in.committed", context: { checkInId: "check-in-alias" } }];
    assert.equal(guards.sealedCurrentCycleCheckIn(state, record), true);
    assert.equal(
      guards.sealedCurrentCycleCheckIn(state, { ...record, cycleId: null, checkInId: "standalone-check-in" }),
      false,
    );
  });
});

describe("Today provenance and cross-date check-in production contracts", () => {
  it("resolves current, absent, future, expired, gap, malformed, and ambiguous plan days without borrowing provenance", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/today" });
    const fresh = harness.freshState();
    const absent = harness.resolveTodayTaskContext(fresh, "2026-08-12");
    assert.equal(absent.source, "standalone_no_plan");
    assert.equal(absent.planId, null);
    assert.equal(
      JSON.stringify((absent.tasks as MutableRecord[]).map((task) => task.taskId)),
      JSON.stringify([
        "default-2026-08-12-reading",
        "default-2026-08-12-writing",
        "default-2026-08-12-reflection",
      ]),
    );

    const active = expiredActivePlanFixture();
    harness.setState(active);
    const current = harness.resolveTodayTaskContext(active, "2026-08-03");
    assert.equal(current.source, "current_plan_day");
    assert.equal(current.planId, asRecord(active.plan).planId);
    const currentTasks = current.tasks as MutableRecord[];
    assert.equal(currentTasks.length, 3);
    assert.ok(currentTasks.every((task) => task.date === "2026-08-03"));
    const core = currentTasks.find((task) => task.skill === "Writing");
    assert.ok(core);
    const boundHref = harness.todayTaskHref(core, current);
    assert.match(boundHref, /^\/practice-writing\?plan_id=/);
    assert.match(boundHref, /&task_id=/);
    const warmup = currentTasks.find((task) => task.skill === "General");
    assert.ok(warmup);
    assert.equal(harness.todayTaskHref(warmup, current), "/practice");

    const future = harness.resolveTodayTaskContext(active, "2026-07-31");
    assert.equal(future.source, "standalone_plan_future");
    assert.equal(future.planId, null);
    assert.equal(harness.todayTaskHref((future.tasks as MutableRecord[])[0], future), "/practice-reading");
    const expired = harness.resolveTodayTaskContext(active, "2026-08-12");
    assert.equal(expired.source, "standalone_plan_expired");
    assert.equal(expired.planId, null);

    const gap = hostClone(active);
    asRecord(gap.plan).days = (asRecord(gap.plan).days as MutableRecord[]).filter((day) => day.date !== "2026-08-03");
    assert.equal(harness.resolveTodayTaskContext(gap, "2026-08-03").source, "standalone_plan_date_gap");

    const truncatedElsewhere = hostClone(active);
    asRecord(truncatedElsewhere.plan).days = (asRecord(truncatedElsewhere.plan).days as MutableRecord[])
      .filter((day) => day.date !== "2026-08-07");
    const truncatedCurrent = harness.resolveTodayTaskContext(truncatedElsewhere, "2026-08-03");
    assert.equal(truncatedCurrent.source, "standalone_plan_unavailable");
    assert.equal(truncatedCurrent.planId, null);
    assert.ok((truncatedCurrent.tasks as MutableRecord[])
      .every((task) => !harness.todayTaskHref(task, truncatedCurrent).includes("plan_id=")));

    const emptyDay = hostClone(active);
    const emptyMatch = (asRecord(emptyDay.plan).days as MutableRecord[]).find((day) => day.date === "2026-08-03");
    assert.ok(emptyMatch);
    emptyMatch.tasks = [];
    const empty = harness.resolveTodayTaskContext(emptyDay, "2026-08-03");
    assert.equal(empty.source, "standalone_plan_day_invalid");
    assert.equal((empty.tasks as MutableRecord[]).length, 3);

    const wrongDate = hostClone(active);
    const wrongDateMatch = (asRecord(wrongDate.plan).days as MutableRecord[]).find((day) => day.date === "2026-08-03");
    assert.ok(wrongDateMatch);
    asRecord((wrongDateMatch.tasks as MutableRecord[])[0]).date = "2026-08-04";
    assert.equal(harness.resolveTodayTaskContext(wrongDate, "2026-08-03").source, "standalone_plan_day_invalid");

    const duplicate = hostClone(active);
    const duplicateMatch = (asRecord(duplicate.plan).days as MutableRecord[]).find((day) => day.date === "2026-08-03");
    assert.ok(duplicateMatch);
    (asRecord(duplicate.plan).days as MutableRecord[]).push(hostClone(duplicateMatch));
    assert.equal(harness.resolveTodayTaskContext(duplicate, "2026-08-03").source, "standalone_plan_day_invalid");

    const crossDayTaskAlias = hostClone(active);
    const aliasedDays = asRecord(crossDayTaskAlias.plan).days as MutableRecord[];
    asRecord((asRecord(aliasedDays[1]).tasks as MutableRecord[])[0]).taskId =
      asRecord((asRecord(aliasedDays[0]).tasks as MutableRecord[])[0]).taskId;
    const aliased = harness.resolveTodayTaskContext(crossDayTaskAlias, "2026-08-03");
    assert.equal(aliased.source, "standalone_plan_unavailable");
    assert.equal(aliased.planId, null);
    assert.ok((aliased.tasks as MutableRecord[]).every((task) => !harness.todayTaskHref(task, aliased).includes("plan_id=")));

    const canonicalPlanDrifts: Array<[string, (candidate: MutableRecord) => void]> = [
      ["missing provenance", (candidate) => {
        delete asRecord(candidate.plan).provenance;
      }],
      ["wrong core-skill sequence", (candidate) => {
        const day = asRecord((asRecord(candidate.plan).days as MutableRecord[])[2]);
        day.coreSkill = "Speaking";
      }],
      ["wrong core route", (candidate) => {
        const day = asRecord((asRecord(candidate.plan).days as MutableRecord[])[2]);
        asRecord((day.tasks as MutableRecord[])[1]).route = "/practice-speaking";
      }],
      ["wrong content hash", (candidate) => {
        const day = asRecord((asRecord(candidate.plan).days as MutableRecord[])[2]);
        asRecord(asRecord((day.tasks as MutableRecord[])[1]).contentRef).contentHash = "f".repeat(64);
      }],
      ["non-canonical task id", (candidate) => {
        const day = asRecord((asRecord(candidate.plan).days as MutableRecord[])[2]);
        asRecord((day.tasks as MutableRecord[])[1]).taskId = "forged-reading-task";
      }],
      ["daily minutes mismatch", (candidate) => {
        const day = asRecord((asRecord(candidate.plan).days as MutableRecord[])[2]);
        asRecord((day.tasks as MutableRecord[])[0]).durationMinutes = 7;
      }],
      ["history plan-id collision", (candidate) => {
        const current = asRecord(candidate.plan);
        candidate.planHistory = [{ ...hostClone(current), status: "superseded" }];
      }],
      ["history task-id collision", (candidate) => {
        const current = asRecord(candidate.plan);
        const historical = hostClone(current);
        historical.planId = "historical-plan-with-task-alias";
        historical.status = "superseded";
        candidate.planHistory = [historical];
      }],
    ];
    for (const [label, mutate] of canonicalPlanDrifts) {
      const candidate = hostClone(active);
      mutate(candidate);
      const fallback = harness.resolveTodayTaskContext(candidate, "2026-08-03");
      assert.equal(fallback.source, "standalone_plan_unavailable", label);
      assert.equal(fallback.planId, null, label);
      harness.setState(candidate);
      assert.ok(
        (fallback.tasks as MutableRecord[]).every((task) => !harness.todayTaskHref(task, fallback).includes("plan_id=")),
        label,
      );
    }
    harness.setState(active);
  });

  it("rejects a stale-date check-in inside the actual writer with byte-for-byte zero mutation", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/check-in" });
    harness.setState(harness.freshState());
    harness.setNow("2026-08-13T00:00:01.000Z");
    const rawBefore = harness.getRaw();
    const stateBefore = harness.backup.canonicalJson(harness.getState());
    const outcome = await harness.commitCheckInRecord({
      date: "2026-08-12",
      values: {
        date: "2026-08-12",
        linkedTaskId: "",
        didText: "Completed a careful independent review.",
        evidenceText: "Saved a specific local learning note.",
        questionStatus: "none",
        questionText: "",
      },
      cycleEligible: false,
      cycleId: null,
      planId: null,
      diagnosticSessionId: null,
      recommendationId: null,
      linkedPracticeReceipt: null,
      reflectionTask: null,
    });
    assert.equal(outcome.status, "date_changed");
    assert.equal(harness.getRaw(), rawBefore);
    assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore);
  });

  it("keeps current-plan independent reflection ownership and uses a default Reflection only for cross-date receipts", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/check-in" });
    const current = expiredActivePlanFixture();
    const plan = asRecord(current.plan);
    const currentDate = String(plan.startDate);
    const currentContext = harness.resolveTodayTaskContext(current, currentDate);
    assert.equal(currentContext.source, "current_plan_day");
    assert.equal(
      harness.checkInPlanIdForDate({ cycleEligible: false, activeCycle: null, date: currentDate, candidateState: current }),
      plan.planId,
    );
    const currentReflection = harness.checkInReflectionTaskForDate({
      date: currentDate,
      linkedPracticeReceipt: null,
      candidateState: current,
    });
    assert.ok(currentReflection);
    assert.equal(currentReflection.taskId, `${String(plan.planId)}-${currentDate}-reflection`);

    const reviewDate = String(asRecord((plan.days as MutableRecord[])[1]).date);
    const scheduledDate = String(asRecord((plan.days as MutableRecord[])[0]).date);
    const crossDateReflection = harness.checkInReflectionTaskForDate({
      date: reviewDate,
      linkedPracticeReceipt: { taskDate: scheduledDate },
      candidateState: current,
    });
    assert.ok(crossDateReflection);
    assert.equal(crossDateReflection.taskId, `default-${reviewDate}-reflection`);
    assert.equal(
      harness.checkInPlanIdForDate({ cycleEligible: false, activeCycle: null, date: "2026-08-12", candidateState: current }),
      null,
    );
  });

  it("preserves the scheduled task date while the actual cross-date check-in and Reflection use the review date", async () => {
    const validation = await loadJourneyValidationHarness();
    const journeyWriter = await loadJourneyWriterHarness();
    const ready = await strictJourneyPreCloseFixture(journeyWriter, validation, { stopAfterPractice: true });
    const harness = await loadWorkspaceWriterHarness({ pathname: "/check-in" });
    harness.setState(ready);
    harness.setNow(STRICT_CYCLE_TIMES.checkInAt);
    const context = harness.resolveTodayTaskContext(ready, "2026-08-12");
    assert.equal(context.source, "standalone_plan_expired");
    const reflection = (context.tasks as MutableRecord[]).find((task) => task.skill === "Reflection");
    assert.ok(reflection);
    const receipt = Object.values(asRecord(ready.practiceReceipts))[0] as MutableRecord;
    const scheduledTaskDate = receipt.taskDate;
    assert.notEqual(scheduledTaskDate, "2026-08-12");
    const cycle = asRecord(asRecord(ready.journey).activeCycle);
    const outcome = await harness.commitCheckInRecord({
      date: "2026-08-12",
      values: {
        date: "2026-08-12",
        linkedTaskId: receipt.taskId,
        didText: "Completed the linked reading task carefully.",
        evidenceText: "Saved the exact local practice receipt as evidence.",
        questionStatus: "none",
        questionText: "",
      },
      cycleEligible: true,
      cycleId: cycle.cycleId,
      planId: cycle.basePlanId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      recommendationId: cycle.recommendationId,
      linkedPracticeReceipt: receipt,
      reflectionTask: reflection,
    });
    assert.equal(outcome.status, "saved");
    const candidate = harness.getState();
    const checkIn = asRecord(asRecord(candidate.checkIns)["2026-08-12"]);
    assert.equal(checkIn.date, "2026-08-12");
    assert.equal(asRecord(checkIn.practiceReceipt).taskDate, scheduledTaskDate);
    assert.equal(asRecord(candidate.practiceReceipts)[String(receipt.completionReceiptId)] &&
      asRecord(asRecord(candidate.practiceReceipts)[String(receipt.completionReceiptId)]).taskDate, scheduledTaskDate);
    const reflectionProgress = asRecord(asRecord(candidate.taskProgress)[String(reflection.taskId)]);
    assert.equal(reflectionProgress.completionClass, "workflow_receipt");
    assert.equal((candidate.learningEvents as MutableRecord[]).filter((event) => event.eventType === "check_in.committed").length, 1);
    const strict = await validation.validateCandidate(candidate);
    assert.equal(strict.ok, true, String(strict.code || "cross-date candidate rejected"));
    const envelope = await harness.backup.createEnvelope(candidate);
    assert.equal(envelope.status, "ready");

    const wrongReflection = hostClone(candidate);
    delete asRecord(wrongReflection.taskProgress)[String(reflection.taskId)];
    const planReflection = (asRecord(wrongReflection.plan).days as MutableRecord[])
      .flatMap((day) => day.tasks as MutableRecord[])
      .find((task) => task.skill === "Reflection") as MutableRecord;
    asRecord(wrongReflection.taskProgress)[String(planReflection.taskId)] = reflectionProgress;
    asRecord(asRecord(wrongReflection.taskProgress)[String(planReflection.taskId)]).workflowReceipt = {
      ...asRecord(reflectionProgress.workflowReceipt),
      taskId: planReflection.taskId,
    };
    const rejected = await validation.validateCandidate(wrongReflection);
    assert.notEqual(rejected.status, "ready");

    const sameDayDefaultReflection = hostClone(candidate);
    const defaultReflectionId = `default-${String(checkIn.date)}-reflection`;
    delete asRecord(sameDayDefaultReflection.taskProgress)[String(reflection.taskId)];
    asRecord(sameDayDefaultReflection.taskProgress)[defaultReflectionId] = {
      ...reflectionProgress,
      workflowReceipt: {
        ...asRecord(reflectionProgress.workflowReceipt),
        taskId: defaultReflectionId,
      },
    };
    asRecord(asRecord(sameDayDefaultReflection.checkIns)[String(checkIn.date)]).practiceReceipt = {
      ...asRecord(checkIn.practiceReceipt),
      taskDate: checkIn.date,
    };
    const rejectedSameDayDefault = await validation.validateCandidate(sameDayDefaultReflection);
    assert.notEqual(rejectedSameDayDefault.status, "ready");
  });
});

describe("production writer capacity transactions", () => {
  const learnerProfile = {
    nickname: "",
    examDate: "",
    dailyMinutes: 30,
    focusSkill: "Balanced",
  };

  it("keeps each independent non-journey collection ceiling production-valid and restorable", async () => {
    const writer = await loadWorkspaceWriterHarness();
    const cases: Array<[string, MutableRecord]> = [];
    const plans = expiredActivePlanFixture();
    plans.planHistory = validStandalonePlanHistory(64);
    cases.push(["planHistory64", plans]);
    const receipts = writer.freshState();
    receipts.practiceReceipts = validStandaloneReceiptHistory(256);
    cases.push(["practiceReceipts256", receipts]);
    const checkins = expiredActivePlanFixture();
    checkins.checkInHistory = validArchivedCheckInHistory(256, checkins);
    cases.push(["checkInHistory256", checkins]);
    const focus = writer.freshState();
    asRecord(focus.focus).sessions = validFocusSessionHistory(512);
    cases.push(["focusSessions512", focus]);
    const validation = await loadJourneyValidationHarness();
    const expected: Record<string, { bytes: number; nodes: number }> = {
      planHistory64: { bytes: 471_641, nodes: 16_119 },
      practiceReceipts256: { bytes: 403_747, nodes: 12_831 },
      checkInHistory256: { bytes: 191_992, nodes: 6_967 },
      focusSessions512: { bytes: 74_240, nodes: 3_103 },
    };
    for (const [name, candidate] of cases) {
      const validationResult = await validation.validateCandidate(candidate);
      assert.equal(validationResult.ok, true, `${name}: ${String(validationResult.code || "domain invalid")}`);
      assert.equal(Buffer.byteLength(writer.backup.canonicalJson(candidate), "utf8"), expected[name].bytes, name);
      assert.equal(workspaceTreeNodeCount(candidate), expected[name].nodes, name);
      assert.equal(writer.backup.inspectWorkspaceCapacity(candidate).status, "ready", name);
      assert.equal((await writer.backup.createEnvelope(candidate)).status, "ready", name);
    }
  });

  it("runs the actual plan writer at 63→64 and rejects 64 without changing state", async () => {
    const harness = await loadWorkspaceWriterHarness();
    const atBoundary = expiredActivePlanFixture();
    atBoundary.planHistory = validStandalonePlanHistory(63);
    await assertWriterPreStateReady(harness, atBoundary, "plan 63");
    harness.setState(atBoundary);

    const saved = await harness.commitPlanRegeneration(learnerProfile);
    assert.equal(saved.status, "saved");
    assert.equal((harness.getState().planHistory as unknown[]).length, 64);
    assert.notEqual(asRecord(harness.getState().plan).planId, asRecord(atBoundary.plan).planId);

    const full = expiredActivePlanFixture();
    full.planHistory = validStandalonePlanHistory(64);
    await assertWriterPreStateReady(harness, full, "plan 64");
    harness.setState(full);
    const rawBefore = harness.getRaw();
    const stateBefore = harness.backup.canonicalJson(harness.getState());
    const rejected = await harness.commitPlanRegeneration(learnerProfile);

    assert.equal(rejected.status, "capacity_reached");
    assert.equal(rejected.field, "planHistory");
    assert.equal(rejected.current, 64);
    assert.equal(rejected.limit, 64);
    assert.equal(harness.getRaw(), rawBefore);
    assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore);
  });

  it("runs the standalone practice writer at 255→256, rejects 256, and makes a sealed replay a zero-delta no-op", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/practice-reading" });
    const atBoundary = harness.freshState();
    atBoundary.practiceReceipts = validStandaloneReceiptHistory(255);
    await assertWriterPreStateReady(harness, atBoundary, "practice 255");
    harness.setState(atBoundary);

    const saved = await harness.commitChoicePracticeCompletion({
      skill: "Reading",
      exerciseId: "reading-library-v1",
      selectedValue: "b",
    });
    assert.equal(saved.status, "saved");
    assert.equal(Object.keys(asRecord(harness.getState().practiceReceipts)).length, 256);
    assert.equal((harness.getState().learningEvents as unknown[]).length, 0, "standalone practice adds no event");

    const sealedRaw = harness.getRaw();
    const sealedState = harness.backup.canonicalJson(harness.getState());
    const replay = await harness.commitChoicePracticeCompletion({
      skill: "Reading",
      exerciseId: "reading-library-v1",
      selectedValue: "b",
    });
    assert.equal(replay.status, "already_saved");
    assert.equal(harness.getRaw(), sealedRaw);
    assert.equal(harness.backup.canonicalJson(harness.getState()), sealedState);

    const full = harness.freshState();
    full.practiceReceipts = validStandaloneReceiptHistory(256);
    await assertWriterPreStateReady(harness, full, "practice 256");
    harness.setState(full);
    const rawBefore = harness.getRaw();
    const stateBefore = harness.backup.canonicalJson(harness.getState());
    const rejected = await harness.commitChoicePracticeCompletion({
      skill: "Reading",
      exerciseId: "reading-library-v1",
      selectedValue: "b",
    });
    assert.equal(rejected.status, "capacity_reached");
    assert.equal(rejected.field, "practiceReceipts");
    assert.equal(rejected.current, 256);
    assert.equal(harness.getRaw(), rawBefore);
    assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore);
  });

  it("runs the actual check-in writer for fresh/no-op and the 255→256/256 archive boundary", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/check-in" });
    const date = "2026-08-12";
    harness.setNow("2026-08-12T08:00:00.000Z");
    const values = {
      date,
      linkedTaskId: "",
      didText: "Completed an independent reading review.",
      evidenceText: "Saved a specific local learning note.",
      questionStatus: "none",
      questionText: "",
    };
    const commit = (planId: unknown) => harness.commitCheckInRecord({
      date,
      values,
      cycleEligible: false,
      cycleId: null,
      planId,
      diagnosticSessionId: null,
      recommendationId: null,
      linkedPracticeReceipt: null,
      reflectionTask: null,
    });

    harness.setState(harness.freshState());
    const fresh = await commit(null);
    assert.equal(fresh.status, "saved");
    assert.equal((harness.getState().checkInHistory as unknown[]).length, 0);
    const noOpRaw = harness.getRaw();
    const noOpState = harness.backup.canonicalJson(harness.getState());
    const noOp = await commit(null);
    assert.equal(noOp.status, "already_saved");
    assert.equal(harness.getRaw(), noOpRaw);
    assert.equal(harness.backup.canonicalJson(harness.getState()), noOpState);

    const atBoundary = expiredActivePlanFixture();
    atBoundary.checkInHistory = validArchivedCheckInHistory(255, atBoundary);
    await assertWriterPreStateReady(harness, atBoundary, "check-in 255");
    harness.setState(atBoundary);
    const planId = asRecord(atBoundary.plan).planId;
    const saved = await commit(planId);
    assert.equal(saved.status, "saved");
    assert.equal((harness.getState().checkInHistory as unknown[]).length, 256);

    const full = expiredActivePlanFixture();
    full.checkInHistory = validArchivedCheckInHistory(256, full);
    await assertWriterPreStateReady(harness, full, "check-in 256");
    harness.setState(full);
    const fullPlanId = asRecord(full.plan).planId;
    const rawBefore = harness.getRaw();
    const stateBefore = harness.backup.canonicalJson(harness.getState());
    const rejected = await commit(fullPlanId);
    assert.equal(rejected.status, "capacity_reached");
    assert.equal(rejected.field, "checkInHistory");
    assert.equal(rejected.current, 256);
    assert.equal(harness.getRaw(), rawBefore);
    assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore);
  });

  it("runs focus start/terminal at 511→512 and enforces both start and terminal gates at 512", async () => {
    const harness = await loadWorkspaceWriterHarness({ pathname: "/focus" });
    const atBoundary = harness.freshState();
    asRecord(atBoundary.focus).sessions = validFocusSessionHistory(511);
    await assertWriterPreStateReady(harness, atBoundary, "focus 511");
    harness.setState(atBoundary);

    const started = await harness.commitFocusControlAction(25);
    assert.equal(started.status, "saved");
    assert.equal(started.action, "started");
    assert.equal((asRecord(harness.getState().focus).sessions as unknown[]).length, 511);
    const completed = await harness.commitFocusTerminal("completed");
    assert.equal(completed.status, "saved");
    assert.equal((asRecord(harness.getState().focus).sessions as unknown[]).length, 512);

    const fullAtStart = harness.freshState();
    asRecord(fullAtStart.focus).sessions = validFocusSessionHistory(512);
    await assertWriterPreStateReady(harness, fullAtStart, "focus 512 start");
    harness.setState(fullAtStart);
    const startRaw = harness.getRaw();
    const startState = harness.backup.canonicalJson(harness.getState());
    const startRejected = await harness.commitFocusControlAction(25);
    assert.equal(startRejected.status, "capacity_reached");
    assert.equal(startRejected.field, "focusSessions");
    assert.equal(harness.getRaw(), startRaw);
    assert.equal(harness.backup.canonicalJson(harness.getState()), startState);

    const fullAtTerminal = harness.freshState();
    asRecord(fullAtTerminal.focus).sessions = validFocusSessionHistory(512);
    asRecord(fullAtTerminal.focus).active = {
      status: "running",
      durationSeconds: 1_500,
      remainingSeconds: 1_500,
      startedAt: "2026-08-12T00:00:00.000Z",
      endsAt: Date.now() + 1_500_000,
    };
    await assertWriterPreStateReady(harness, fullAtTerminal, "focus 512 terminal");
    harness.setState(fullAtTerminal);
    const terminalRaw = harness.getRaw();
    const terminalState = harness.backup.canonicalJson(harness.getState());
    const terminalRejected = await harness.commitFocusTerminal("stopped");
    assert.equal(terminalRejected.status, "capacity_reached");
    assert.equal(terminalRejected.field, "focusSessions");
    assert.equal(harness.getRaw(), terminalRaw);
    assert.equal(harness.backup.canonicalJson(harness.getState()), terminalState);
  });

  it("starts from the strict fresh journey root and gates successive new-diagnostic writers before mutation", async () => {
    const harness = await loadJourneyWriterHarness();
    const fresh = harness.freshState();
    assert.deepEqual(Object.keys(asRecord(fresh.journey)).sort(), [
      "activeCycle", "diagnostic", "history", "peerHelp", "planUpdate", "protocolVersion",
      "recommendation", "retest", "review", "supersededCycles",
    ]);
    harness.setState(fresh);
    const first = await harness.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
      viewportMode: "desktop_or_tablet",
      networkAtStart: "online",
    });
    assert.equal(first.status, "saved");
    assert.equal((harness.getState().learningEvents as unknown[]).length, 1);
    assert.equal(harness.backup.inspectWorkspaceCapacity(harness.getState()).status, "ready");

    const composite = harness.getState();
    composite.plan = expiredActivePlanFixture().plan;
    harness.setState(composite);
    const second = await harness.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    assert.equal(second.status, "saved");
    assert.equal((harness.getState().planHistory as unknown[]).length, 1);
    assert.equal((asRecord(harness.getState().journey).supersededCycles as unknown[]).length, 1);
    assert.equal((harness.getState().learningEvents as unknown[]).length, 2);

    const capacityBase = harness.getState();
    for (const [field, current, mutate] of [
      ["planHistory", 64, (candidate: MutableRecord) => { candidate.planHistory = Array.from({ length: 64 }, () => null); }],
      ["supersededCycles", 64, (candidate: MutableRecord) => { asRecord(candidate.journey).supersededCycles = Array.from({ length: 64 }, () => null); }],
      ["learningEvents", 212, (candidate: MutableRecord) => { candidate.learningEvents = Array.from({ length: 212 }, () => null); }],
    ] as const) {
      const blocked = hostClone(capacityBase);
      blocked.plan = expiredActivePlanFixture().plan;
      const restartedCycle = startedCycleFixture();
      asRecord(blocked.journey).activeCycle = restartedCycle.cycle;
      asRecord(blocked.journey).diagnostic = restartedCycle.diagnostic;
      mutate(blocked);
      harness.setState(blocked);
      const rawBefore = harness.getRaw();
      const stateBefore = harness.backup.canonicalJson(harness.getState());
      const rejected = await harness.commitNewDiagnostic({
        audioOutputStatus: "heard",
        mp3Supported: true,
        speechSupported: true,
      });
      assert.equal(rejected.status, "capacity_reached", field);
      assert.equal(rejected.field, field, field);
      assert.equal(rejected.current, current, field);
      assert.equal(harness.getRaw(), rawBefore, field);
      assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore, field);
    }

  });

  it("closes one strict production journey with one plan-history, history, and event append", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const preClose = await strictJourneyPreCloseFixture(writer, validation);
    const preValidation = await validation.validateCandidate(preClose);
    assert.equal(preValidation.ok, true, String(preValidation.code || "strict pre-close invalid"));
    assert.equal((preClose.planHistory as unknown[]).length, 0);
    assert.equal((asRecord(preClose.journey).history as unknown[]).length, 0);
    assert.equal((preClose.learningEvents as unknown[]).length, 5);

    writer.setNow(STRICT_CYCLE_TIMES.closeAt);
    const closed = await writer.commitJourneyPlanClose(String(asRecord(preClose.profile).focusSkill));
    assert.equal(closed.status, "saved", String(closed.code || "strict close failed"));
    const postClose = writer.getState();
    assert.equal((postClose.planHistory as unknown[]).length, 1);
    assert.equal((asRecord(postClose.journey).history as unknown[]).length, 1);
    assert.equal((postClose.learningEvents as unknown[]).length, 6);
    const postValidation = await validation.validateCandidate(postClose);
    assert.equal(postValidation.ok, true, String(postValidation.code || "strict post-close invalid"));
  });

  it("proves the 19-cycle history ceiling against exact normal-writer state and the 1 MiB bound", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const template = await strictClosedCycleTemplate(writer, validation);
    const atLimit = await strictTerminalCycleCollection(writer, validation, template, 19);
    const overLimit = await strictTerminalCycleCollection(writer, validation, template, 20);
    assert.equal((await validation.validateCandidate(atLimit)).ok, true);
    assert.equal((await validation.validateCandidate(overLimit)).ok, true, "domain graph remains strict before resource policy");
    assert.equal((atLimit.planHistory as unknown[]).length, 37);
    assert.equal((asRecord(atLimit.journey).history as unknown[]).length, 19);
    assert.equal((atLimit.learningEvents as unknown[]).length, 114);
    assert.equal(Buffer.byteLength(writer.backup.canonicalJson(atLimit), "utf8"), 1_009_140);
    assert.equal(workspaceTreeNodeCount(atLimit), 30_014);
    assert.equal(writer.backup.inspectWorkspaceCapacity(atLimit).status, "ready");
    assert.equal((overLimit.planHistory as unknown[]).length, 39);
    assert.equal((asRecord(overLimit.journey).history as unknown[]).length, 20);
    assert.equal((overLimit.learningEvents as unknown[]).length, 120);
    assert.equal(Buffer.byteLength(writer.backup.canonicalJson(overLimit), "utf8"), 1_061_653);
    assert.ok(workspaceTreeNodeCount(overLimit) < writer.backup.CAPACITY_LIMITS.jsonNodes);
    const overResult = writer.backup.inspectWorkspaceCapacity(overLimit);
    assert.equal(overResult.status, "invalid_workspace");
    assert.equal(overResult.code, "workspace_count_limit");
    assert.equal(overResult.field, "journeyHistory");
  });

  it("runs the actual 18→19 close and rejects 19→20 before any state mutation", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const preCloseTemplate = await strictJourneyPreCloseFixture(writer, validation);
    writer.setNow(STRICT_CYCLE_TIMES.closeAt);
    const closedOutcome = await writer.commitJourneyPlanClose(String(asRecord(preCloseTemplate.profile).focusSkill));
    assert.equal(closedOutcome.status, "saved");
    const closedTemplate = writer.getState();
    const beforeNineteenth = await strictPreCloseAfterTerminalCycles(
      writer, validation, closedTemplate, preCloseTemplate, 18,
    );
    assert.equal((await validation.validateCandidate(beforeNineteenth)).ok, true);
    assert.equal(writer.backup.inspectWorkspaceCapacity(beforeNineteenth).status, "ready");
    assert.equal((beforeNineteenth.planHistory as unknown[]).length, 36);
    assert.equal((asRecord(beforeNineteenth.journey).history as unknown[]).length, 18);
    assert.equal((beforeNineteenth.learningEvents as unknown[]).length, 113);
    writer.setState(beforeNineteenth);
    writer.setNow(new Date(Date.parse(STRICT_CYCLE_TIMES.closeAt) + 18 * 86_400_000).toISOString());
    const saved = await writer.commitJourneyPlanClose(String(asRecord(beforeNineteenth.profile).focusSkill));
    assert.equal(saved.status, "saved", String(saved.code || "19th cycle close failed"));
    const nineteenth = writer.getState();
    assert.equal((nineteenth.planHistory as unknown[]).length, 37);
    assert.equal((asRecord(nineteenth.journey).history as unknown[]).length, 19);
    assert.equal((nineteenth.learningEvents as unknown[]).length, 114);
    assert.equal((await validation.validateCandidate(nineteenth)).ok, true);
    assert.equal((await writer.backup.createEnvelope(nineteenth)).status, "ready");

    const beforeTwentieth = await strictPreCloseAfterTerminalCycles(
      writer, validation, closedTemplate, preCloseTemplate, 19,
    );
    assert.equal((await validation.validateCandidate(beforeTwentieth)).ok, true);
    assert.equal(writer.backup.inspectWorkspaceCapacity(beforeTwentieth).status, "ready");
    assert.equal((beforeTwentieth.planHistory as unknown[]).length, 38);
    assert.equal((asRecord(beforeTwentieth.journey).history as unknown[]).length, 19);
    assert.equal((beforeTwentieth.learningEvents as unknown[]).length, 119);
    writer.setState(beforeTwentieth);
    const rawBefore = writer.getRaw();
    const stateBefore = writer.backup.canonicalJson(writer.getState());
    writer.setNow(new Date(Date.parse(STRICT_CYCLE_TIMES.closeAt) + 19 * 86_400_000).toISOString());
    const rejected = await writer.commitJourneyPlanClose(String(asRecord(beforeTwentieth.profile).focusSkill));
    assert.equal(rejected.status, "capacity_reached");
    assert.equal(rejected.field, "journeyHistory");
    assert.equal(rejected.current, 19);
    assert.equal(rejected.limit, 19);
    assert.equal(writer.getRaw(), rawBefore);
    assert.equal(writer.backup.canonicalJson(writer.getState()), stateBefore);
  });

  it("runs the actual new-diagnostic writer at 206→207 and reserves the remaining five-event close budget", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const preCloseTemplate = await strictJourneyPreCloseFixture(writer, validation);
    const before = await strictMixedSupersededEventCollection(writer, validation, preCloseTemplate, 36, 62);
    assert.equal((before.learningEvents as unknown[]).length, 206);
    assert.equal((await validation.validateCandidate(before)).ok, true);
    assert.equal(writer.backup.inspectWorkspaceCapacity(before).status, "ready");
    writer.setState(before);
    writer.setNow(new Date(Date.parse(STRICT_CYCLE_TIMES.createdAt) + 62 * 86_400_000).toISOString());
    const outcome = await writer.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    const after = writer.getState();
    assert.equal(outcome.status, "saved");
    assert.equal((after.learningEvents as unknown[]).length, 207);
    assert.equal(writer.backup.inspectWorkspaceCapacity(after).status, "ready");
    assert.equal((await validation.validateCandidate(after)).ok, true);
    assert.equal((await writer.backup.createEnvelope(after)).status, "ready");

    const rawBefore = writer.getRaw();
    const stateBefore = writer.backup.canonicalJson(writer.getState());
    writer.setNow(new Date(Date.parse(STRICT_CYCLE_TIMES.createdAt) + 63 * 86_400_000).toISOString());
    const rejected = await writer.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    assert.equal(rejected.status, "capacity_reached");
    assert.equal(rejected.field, "learningEvents");
    assert.equal(rejected.current, 207);
    assert.equal(rejected.required, 6);
    assert.equal(rejected.limit, 212);
    assert.equal(writer.getRaw(), rawBefore);
    assert.equal(writer.backup.canonicalJson(writer.getState()), stateBefore);
  });

  it("admits only a complete next-cycle count budget before any diagnostic mutation", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const preCloseTemplate = await strictJourneyPreCloseFixture(writer, validation);
    writer.setNow(STRICT_CYCLE_TIMES.closeAt);
    assert.equal((await writer.commitJourneyPlanClose(String(asRecord(preCloseTemplate.profile).focusSkill))).status, "saved");
    const closedTemplate = writer.getState();

    const beforeNineteenth = await strictPreCloseAfterTerminalCycles(
      writer, validation, closedTemplate, preCloseTemplate, 18,
    );
    writer.setState(beforeNineteenth);
    writer.setNow(new Date(Date.parse(STRICT_CYCLE_TIMES.closeAt) + 18 * 86_400_000).toISOString());
    assert.equal((await writer.commitJourneyPlanClose(String(asRecord(beforeNineteenth.profile).focusSkill))).status, "saved");
    const nineteenth = writer.getState();
    const historyBlocked = writer.inspectNextGateACycleAdmission(nineteenth);
    assert.equal(historyBlocked.status, "capacity_reached");
    assert.equal(historyBlocked.field, "journeyHistory");
    assert.equal(historyBlocked.current, 19);
    assert.equal(historyBlocked.required, 1);
    assert.equal(historyBlocked.limit, 19);
    const historyRaw = writer.getRaw();
    const historyState = writer.backup.canonicalJson(writer.getState());
    const historyRejected = await writer.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    assert.equal(historyRejected.status, "capacity_reached");
    assert.equal(historyRejected.field, "journeyHistory");
    assert.equal(writer.getRaw(), historyRaw);
    assert.equal(writer.backup.canonicalJson(writer.getState()), historyState);

    const eventNearLimit = await strictMixedSupersededEventCollection(
      writer, validation, preCloseTemplate, 36, 63,
    );
    assert.equal((eventNearLimit.learningEvents as unknown[]).length, 207);
    assert.equal((await validation.validateCandidate(eventNearLimit)).ok, true);
    writer.setState(eventNearLimit);
    const eventBlocked = writer.inspectNextGateACycleAdmission(eventNearLimit);
    assert.equal(eventBlocked.status, "capacity_reached");
    assert.equal(eventBlocked.field, "learningEvents");
    assert.equal(eventBlocked.current, 207);
    assert.equal(eventBlocked.required, 6);
    assert.equal(eventBlocked.limit, 212);
    const eventRaw = writer.getRaw();
    const eventState = writer.backup.canonicalJson(writer.getState());
    const eventRejected = await writer.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    assert.equal(eventRejected.status, "capacity_reached");
    assert.equal(eventRejected.field, "learningEvents");
    assert.equal(writer.getRaw(), eventRaw);
    assert.equal(writer.backup.canonicalJson(writer.getState()), eventState);

    writer.setNow("2026-08-12T12:00:00.000Z");
    const fresh = writer.freshState();
    const additions = writer.nextGateACycleRequiredAdditions(fresh);
    assert.deepEqual(hostClone(additions), {
      planHistory: 1,
      journeyHistory: 1,
      practiceReceipts: 1,
      learningEvents: 6,
      checkIns: 1,
      checkInHistory: 0,
      supersededCycles: 0,
      taskProgress: 2,
      bindingAliases: 11,
    });
    assert.equal(writer.inspectNextGateACycleAdmission(fresh).status, "ready");

    const todayDraft = hostClone(fresh);
    asRecord(todayDraft.checkIns)["2026-08-12"] = {
      checkInId: null,
      date: "2026-08-12",
      didText: "",
      evidenceClass: "draft_unclassified",
      evidenceText: "",
      learnerConfirmedReview: false,
      linkedTaskId: "",
      practiceAttemptId: null,
      practiceReceipt: null,
      questionStatus: "has_question",
      questionText: "",
      reviewedAt: null,
      reviewId: null,
      status: "draft",
      taskCompletionReceiptId: null,
      updatedAt: "2026-08-12T12:00:00.000Z",
    };
    assert.equal((await validation.validateCandidate(todayDraft)).ok, true);
    const draftAdditions = writer.nextGateACycleRequiredAdditions(todayDraft);
    assert.equal(draftAdditions.checkIns, 0);
    assert.equal(draftAdditions.checkInHistory, 0);

    const todaySaved = expiredActivePlanFixture();
    assert.equal((await validation.validateCandidate(todaySaved)).ok, true);
    const savedAdditions = writer.nextGateACycleRequiredAdditions(todaySaved);
    assert.equal(savedAdditions.checkIns, 0);
    assert.equal(savedAdditions.checkInHistory, 1);

    writer.setState(fresh);
    const staleStateBefore = writer.backup.canonicalJson(writer.getState());
    const baselineRaw = writer.getRaw();
    assert.equal(baselineRaw, JSON.stringify(fresh));
    const concurrent = hostClone(fresh);
    concurrent.updatedAt = new Date(Date.parse(String(fresh.updatedAt)) + 1_000).toISOString();
    const concurrentRaw = JSON.stringify(concurrent);
    assert.notEqual(concurrentRaw, baselineRaw);
    writer.setPersistedRaw(concurrentRaw);
    const staleRejected = await writer.commitNewDiagnostic({
      audioOutputStatus: "heard",
      mp3Supported: true,
      speechSupported: true,
    });
    assert.equal(staleRejected.status, "stale");
    assert.equal(writer.getRaw(), concurrentRaw);
    assert.equal(writer.backup.canonicalJson(writer.getState()), staleStateBefore);
  });

  it("documents remaining byte headroom after the conservative 212-event governance boundary", async () => {
    const writer = await loadJourneyWriterHarness();
    const validation = await loadJourneyValidationHarness();
    const preCloseTemplate = await strictJourneyPreCloseFixture(writer, validation);
    const atGovernanceLimit = await strictMixedSupersededEventCollection(
      writer, validation, preCloseTemplate, 37,
    );
    const result = await validation.validateCandidate(atGovernanceLimit);
    assert.equal(result.ok, true);
    assert.equal((atGovernanceLimit.learningEvents as unknown[]).length, 212);
    assert.equal(Buffer.byteLength(writer.backup.canonicalJson(atGovernanceLimit), "utf8"), 1_034_376);
    assert.equal(workspaceTreeNodeCount(atGovernanceLimit), 29_991);
    assert.equal(writer.backup.inspectWorkspaceCapacity(atGovernanceLimit).status, "ready");
    assert.ok(
      writer.backup.CAPACITY_LIMITS.workspaceBytes - Buffer.byteLength(writer.backup.canonicalJson(atGovernanceLimit), "utf8") > 0,
      "212 is intentionally conservative; the independent 1 MiB ceiling still has a small margin",
    );
  });

  it("rejects actual plan candidates over byte and node limits without mutation", async () => {
    const harness = await loadWorkspaceWriterHarness();
    const buildNearLimit = (kind: "bytes" | "nodes") => {
      let low = 0;
      let high = kind === "bytes" ? 256 : 150_000;
      let best = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = expiredActivePlanFixture();
        asRecord(candidate.plan)[kind === "bytes" ? "capacityPadding" : "capacityProbe"] = kind === "bytes"
          ? Array.from({ length: middle }, () => "x".repeat(4_096))
          : Array.from({ length: middle }, () => null);
        if (harness.backup.inspectWorkspaceCapacity(candidate).status === "ready") {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      const result = expiredActivePlanFixture();
      asRecord(result.plan)[kind === "bytes" ? "capacityPadding" : "capacityProbe"] = kind === "bytes"
        ? Array.from({ length: best }, () => "x".repeat(4_096))
        : Array.from({ length: best }, () => null);
      assert.equal(harness.backup.inspectWorkspaceCapacity(result).status, "ready", kind);
      return result;
    };

    for (const [kind, expectedCode] of [["bytes", "workspace_too_large"], ["nodes", "too_many_values"]] as const) {
      const nearLimit = buildNearLimit(kind);
      const preStateBytes = Buffer.byteLength(harness.backup.canonicalJson(nearLimit), "utf8");
      if (kind === "nodes") {
        assert.ok(preStateBytes < harness.backup.CAPACITY_LIMITS.workspaceBytes, "node prestate remains below 1 MiB");
      }
      harness.setState(nearLimit);
      const rawBefore = harness.getRaw();
      const stateBefore = harness.backup.canonicalJson(harness.getState());
      const rejected = await harness.commitPlanRegeneration(learnerProfile);
      assert.equal(rejected.status, "capacity_reached", kind);
      assert.equal(rejected.code, expectedCode, kind);
      const inspectedCandidate = harness.getLastCapacityCandidate();
      assert.ok(inspectedCandidate, `${kind}: actual production candidate must reach the shared inspector`);
      if (kind === "nodes") {
        assert.ok(
          Buffer.byteLength(harness.backup.canonicalJson(inspectedCandidate), "utf8") < harness.backup.CAPACITY_LIMITS.workspaceBytes,
          "node-only candidate remains below 1 MiB",
        );
        assert.equal(harness.backup.inspectWorkspaceCapacity(inspectedCandidate).code, "too_many_values");
      }
      assert.equal(harness.getRaw(), rawBefore, kind);
      assert.equal(harness.backup.canonicalJson(harness.getState()), stateBefore, kind);
    }
  });
});

describe("community visibility preview production projection", () => {
  it("projects only the four allowlisted task categories and one fixed completion state", async () => {
    const writer = await loadJourneyWriterHarness();
    const labels: Record<string, string> = {
      Reading: "Reading · 阅读",
      Listening: "Listening · 听力",
      Writing: "Writing · 写作",
      Speaking: "Speaking · 口语",
    };

    for (const [skill, taskCategory] of Object.entries(labels)) {
      const chain: MutableRecord = {
        reviewComplete: true,
        diagnostic: { prioritySkill: skill, privateSentinel: `DIAGNOSTIC-${skill}` },
        linkedPracticeTask: { skill, taskId: `TASK-ID-${skill}`, title: `TASK-TITLE-${skill}` },
        linkedPracticeReceipt: {
          skill,
          status: "completed",
          completionReceiptId: `RECEIPT-ID-${skill}`,
          privateSentinel: `RECEIPT-${skill}`,
        },
        checkIn: {
          didText: `DID-TEXT-${skill}`,
          evidenceText: `EVIDENCE-TEXT-${skill}`,
          questionText: `QUESTION-TEXT-${skill}`,
        },
        profile: { nickname: `NICKNAME-${skill}`, examDate: "2026-08-12" },
      };
      const before = JSON.stringify(chain);
      const result = writer.buildCommunityVisibilityPreview(chain);
      assert.deepEqual(hostClone(result), {
        taskCategory,
        completionStatus: "已完成本机原创练习并确认复盘",
      });
      assert.equal(JSON.stringify(chain), before, `${skill}: projection must not mutate its input`);
      const serialized = JSON.stringify(result);
      for (const forbidden of ["TASK-ID", "TASK-TITLE", "RECEIPT-ID", "DID-TEXT", "EVIDENCE-TEXT", "QUESTION-TEXT", "NICKNAME", "privateSentinel"]) {
        assert.equal(serialized.includes(forbidden), false, `${skill}: preview leaked ${forbidden}`);
      }
    }
  });

  it("fails closed for an incomplete chain, unknown category, unfinished receipt, or mismatched skill", async () => {
    const writer = await loadJourneyWriterHarness();
    const valid: MutableRecord = {
      reviewComplete: true,
      diagnostic: { prioritySkill: "Reading" },
      linkedPracticeTask: { skill: "Reading" },
      linkedPracticeReceipt: { skill: "Reading", status: "completed" },
    };
    const cases = [
      { ...valid, reviewComplete: false },
      { ...valid, linkedPracticeTask: { skill: "Unknown" }, linkedPracticeReceipt: { skill: "Unknown", status: "completed" }, diagnostic: { prioritySkill: "Unknown" } },
      { ...valid, linkedPracticeReceipt: { skill: "Reading", status: "in_progress" } },
      { ...valid, linkedPracticeReceipt: { skill: "Writing", status: "completed" } },
      { ...valid, diagnostic: { prioritySkill: "Listening" } },
      { ...valid, linkedPracticeTask: null },
      { ...valid, linkedPracticeReceipt: null },
    ];
    for (const candidate of cases) {
      assert.equal(writer.buildCommunityVisibilityPreview(candidate), null);
    }
  });
});

describe("production workspace domain validation", () => {
  it("accepts fresh state and legal standalone historical task/focus records after recomputing SHA", async () => {
    const harness = await loadJourneyValidationHarness();
    const candidate = restorableWorkspaceFixture();
    asRecord(candidate.taskProgress)["default-2026-08-12-reading"] = {
      completedAt: "2026-08-12T00:01:00.000Z",
      completionClass: "learner_self_report",
      selfReported: true,
      source: "learner_checkbox",
      status: "completed",
      updatedAt: "2026-08-12T00:01:00.000Z",
    };
    asRecord(candidate.focus).sessions = [{
      durationSeconds: 900,
      endedAt: "2026-08-12T00:16:00.000Z",
      sessionId: "focus-abc123",
      startedAt: "2026-08-12T00:01:00.000Z",
      status: "completed",
    }];

    const result = await inspectProductionCandidate(harness, candidate);
    assert.equal(result.status, "ready");
  });

  it("accepts a default Reflection workflow carrying the exact current expired plan ID", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = expiredActivePlanFixture();
    assert.equal((await inspectProductionCandidate(harness, legal)).status, "ready");

    const forged = hostClone(legal);
    const checkIn = Object.values(asRecord(forged.checkIns))[0] as MutableRecord;
    checkIn.planId = "plan-unrelated-v1";
    const result = await inspectProductionCandidate(harness, forged);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "auxiliary_state_invalid");
  });

  it("applies the check-in form text contract while preserving incomplete draft states", async () => {
    const harness = await loadJourneyValidationHarness();
    const draft = restorableWorkspaceFixture();
    asRecord(draft.checkIns)["2026-08-12"] = {
      checkInId: null,
      date: "2026-08-12",
      didText: "",
      evidenceClass: "draft_unclassified",
      evidenceText: "",
      learnerConfirmedReview: false,
      linkedTaskId: "",
      practiceAttemptId: null,
      practiceReceipt: null,
      questionStatus: "has_question",
      questionText: "",
      reviewedAt: null,
      reviewId: null,
      status: "draft",
      taskCompletionReceiptId: null,
      updatedAt: "2026-08-12T00:01:00.000Z",
    };
    assert.equal((await inspectProductionCandidate(harness, draft)).status, "ready");

    const legal = expiredActivePlanFixture();
    const mutations = [
      (record: MutableRecord) => { record.didText = "x".repeat(301); },
      (record: MutableRecord) => { record.evidenceText = ""; },
      (record: MutableRecord) => {
        record.questionStatus = "has_question";
        record.questionText = "";
      },
      (record: MutableRecord) => {
        record.questionStatus = "none";
        record.questionText = "stale hidden question";
      },
      (record: MutableRecord) => { record.questionStatus = ""; },
    ];
    for (const mutate of mutations) {
      const candidate = hostClone(legal);
      const record = Object.values(asRecord(candidate.checkIns))[0] as MutableRecord;
      mutate(record);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid");
      assert.equal(result.code, "auxiliary_state_invalid");
    }
  });

  it("enforces exact profile and all three plan provenance writer unions", async () => {
    const harness = await loadJourneyValidationHarness();
    assert.equal(harness.validProfile({ dailyMinutes: 30, examDate: "2024-02-29", focusSkill: "Balanced", nickname: "Sofia" }), true);
    const standalone = expiredActivePlanFixture();
    assert.equal(harness.validPlanGraph(standalone), true, "standalone plan writer union");

    const diagnostic = completedDiagnosticFixture(harness);
    const diagnosticPlanId = "plan-diagnostic-v1";
    const diagnosticPlanCreatedAt = "2026-08-12T00:15:00.000Z";
    diagnostic.candidate.plan = exactPlanFromTemplate({
      planId: diagnosticPlanId,
      focusSkill: "Reading",
      createdAt: diagnosticPlanCreatedAt,
      diagnosticSessionId: String(diagnostic.diagnostic.diagnosticSessionId),
      provenance: {
        cycleId: diagnostic.cycle.cycleId,
        diagnosticSessionId: diagnostic.diagnostic.diagnosticSessionId,
        priorityBasis: diagnostic.diagnostic.priorityBasis,
        source: "learner_configured_after_gate_a_evidence_diagnostic",
        taskSetDigest: diagnostic.diagnostic.taskSetDigest,
        taskSetVersion: diagnostic.diagnostic.taskSetVersion,
      },
    });
    diagnostic.cycle.basePlanId = diagnosticPlanId;
    diagnostic.cycle.updatedAt = diagnosticPlanCreatedAt;
    asRecord(diagnostic.candidate.profile).focusSkill = "Reading";
    assert.equal(harness.validPlanGraph(diagnostic.candidate), true, "diagnostic-bound plan writer union");

    const followup = restorableWorkspaceFixture();
    const cycleId = "cycle-followup-v1";
    const diagnosticSessionId = "diagnostic-followup-v1";
    const retestId = "retest-followup-v1";
    const basePlanId = "plan-followup-base-v1";
    const updatedPlanId = "plan-followup-updated-v1";
    const terminalAt = "2026-08-12T01:00:00.000Z";
    followup.planHistory = [exactPlanFromTemplate({
      planId: basePlanId,
      focusSkill: "Reading",
      createdAt: "2026-08-12T00:30:00.000Z",
      diagnosticSessionId,
      provenance: {
        cycleId,
        diagnosticSessionId,
        priorityBasis: "objective_first_response_pattern",
        source: "learner_configured_after_gate_a_evidence_diagnostic",
        taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
        taskSetVersion: "gate_a_original_6_v1",
      },
      status: "superseded",
      supersededAt: terminalAt,
      supersededByRetestId: retestId,
    })];
    followup.plan = exactPlanFromTemplate({
      planId: updatedPlanId,
      focusSkill: "Listening",
      createdAt: terminalAt,
      provenance: {
        cycleId,
        diagnosticSessionId,
        retestId,
        source: "learner_confirmed_parallel_retest_followup",
        supersedesPlanId: basePlanId,
        taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
        taskSetVersion: "gate_a_original_6_v1",
      },
    });
    asRecord(followup.journey).history = [{
      basePlanId,
      closedAt: terminalAt,
      cycleId,
      diagnostic: {
        diagnosticSessionId,
        priorityBasis: "objective_first_response_pattern",
        status: "completed",
        taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
        taskSetVersion: "gate_a_original_6_v1",
      },
      diagnosticSessionId,
      retestId,
      status: "completed",
      updatedPlanId,
    }];
    assert.equal(harness.validPlanGraph(followup), true, "retest-followup plan writer union");

    const negativeCases: Array<[string, (candidate: MutableRecord) => void, string]> = [
      ["trimmed nickname", (candidate) => { asRecord(candidate.profile).nickname = " Sofia "; }, "workspace_shape_invalid"],
      ["calendar-valid exam date", (candidate) => { asRecord(candidate.profile).examDate = "2026-02-30"; }, "workspace_shape_invalid"],
      ["exact standalone provenance", (candidate) => { asRecord(asRecord(candidate.plan).provenance).cycleId = "cycle-forged-v1"; }, "plan_graph_invalid"],
      ["active plan cannot carry supersession fields", (candidate) => { asRecord(candidate.plan).supersededAt = "2026-08-12T00:00:00.000Z"; }, "plan_graph_invalid"],
    ];
    for (const [label, mutate, code] of negativeCases) {
      const candidate = hostClone(standalone);
      mutate(candidate);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", label);
      assert.equal(result.code, code, label);
    }
  });

  it("enforces the saved, confirmed, archived, and revised-draft check-in unions", async () => {
    const harness = await loadJourneyValidationHarness();
    const revisedDraft = expiredActivePlanFixture();
    const revisedRecord = Object.values(asRecord(revisedDraft.checkIns))[0] as MutableRecord;
    Object.assign(revisedRecord, {
      checkInId: null,
      evidenceClass: "draft_unclassified",
      learnerConfirmedReview: false,
      practiceAttemptId: null,
      practiceReceipt: null,
      reviewId: null,
      reviewedAt: null,
      status: "draft",
      taskCompletionReceiptId: null,
      updatedAt: "2026-08-12T00:03:00.000Z",
    });
    revisedDraft.taskProgress = {};
    assert.equal(harness.validCheckIn(revisedRecord, revisedDraft), true, "draft spread from a saved record");
    assert.equal((await inspectProductionCandidate(harness, revisedDraft)).status, "ready");

    const archived = expiredActivePlanFixture();
    const archivedRecord = Object.values(asRecord(archived.checkIns))[0] as MutableRecord;
    archived.checkIns = {};
    Object.assign(archivedRecord, {
      archivedAt: "2026-08-12T00:03:00.000Z",
      archivedReason: "learner_revision_after_save",
    });
    archived.checkInHistory = [archivedRecord];
    assert.equal(harness.validCheckIn(archivedRecord, archived, { archived: true }), true, "archived unconfirmed saved record");
    assert.equal((await inspectProductionCandidate(harness, archived)).status, "ready");

    const confirmed = planBoundReadingReceiptFixture();
    const confirmedReceipt = Object.values(asRecord(confirmed.practiceReceipts))[0] as MutableRecord;
    const confirmedAt = "2026-08-12T00:03:00.000Z";
    Object.assign(confirmedReceipt, {
      cycleId: "cycle-confirmed-v1",
      diagnosticSessionId: "diagnostic-confirmed-v1",
      recommendationId: "recommendation-confirmed-v1",
    });
    Object.assign(asRecord(confirmedReceipt.taskRef), {
      cycleId: confirmedReceipt.cycleId,
      diagnosticSessionId: confirmedReceipt.diagnosticSessionId,
    });
    const confirmedRecord: MutableRecord = {
      ...(Object.values(asRecord(expiredActivePlanFixture().checkIns))[0] as MutableRecord),
      checkInId: "check-in-confirmed-v1",
      cycleId: "cycle-confirmed-v1",
      date: confirmedReceipt.taskDate,
      diagnosticSessionId: "diagnostic-confirmed-v1",
      evidenceClass: "practice_receipt",
      learnerConfirmedReview: true,
      linkedTaskId: confirmedReceipt.taskId,
      planId: confirmedReceipt.planId,
      practiceAttemptId: confirmedReceipt.practiceAttemptId,
      practiceReceipt: hostClone(confirmedReceipt),
      recommendationId: "recommendation-confirmed-v1",
      reviewedAt: confirmedAt,
      reviewId: "review-confirmed-v1",
      savedAt: "2026-08-12T00:02:00.000Z",
      taskCompletionReceiptId: confirmedReceipt.completionReceiptId,
      updatedAt: confirmedAt,
    };
    asRecord(confirmed.journey).review = {
      checkInId: confirmedRecord.checkInId,
      confirmedAt,
      cycleId: confirmedRecord.cycleId,
      humanEscalationStatus: "not_requested",
      learnerConfirmed: true,
      reminderStatus: "not_enabled",
      reviewId: confirmedRecord.reviewId,
      shareStatus: "not_shared",
    };
    confirmed.checkIns = { [String(confirmedRecord.date)]: confirmedRecord };
    assert.equal(harness.validCheckIn(confirmedRecord, confirmed), true, "confirmed record bound to its unique review");

    const confirmationEnvelope = expiredActivePlanFixture();
    const confirmationRecord = Object.values(asRecord(confirmationEnvelope.checkIns))[0] as MutableRecord;
    const confirmationPlan = asRecord(confirmationEnvelope.plan);
    const confirmationDay = (confirmationPlan.days as MutableRecord[])[0];
    const confirmationReflection = (confirmationDay.tasks as MutableRecord[]).find((task) => task.skill === "Reflection") as MutableRecord;
    Object.assign(confirmationRecord, {
      cycleId: "cycle-confirmation-envelope-v1",
      diagnosticSessionId: "diagnostic-confirmation-envelope-v1",
      learnerConfirmedReview: true,
      recommendationId: "recommendation-confirmation-envelope-v1",
      reviewedAt: confirmedAt,
      reviewId: "review-confirmation-envelope-v1",
      updatedAt: confirmedAt,
    });
    confirmationRecord.date = confirmationReflection.date;
    confirmationEnvelope.checkIns = { [String(confirmationRecord.date)]: confirmationRecord };
    confirmationEnvelope.taskProgress = {
      [String(confirmationReflection.taskId)]: {
        completedAt: confirmationRecord.savedAt,
        completionClass: "workflow_receipt",
        selfReported: false,
        source: "check-in",
        status: "completed",
        updatedAt: confirmationRecord.savedAt,
        workflowReceipt: {
          checkInId: confirmationRecord.checkInId,
          completedAt: confirmationRecord.savedAt,
          protocolVersion: "sufeiya_check_in_completion_v1",
          taskId: confirmationReflection.taskId,
        },
      },
    };
    asRecord(confirmationEnvelope.journey).review = {
      checkInId: confirmationRecord.checkInId,
      confirmedAt,
      cycleId: confirmationRecord.cycleId,
      humanEscalationStatus: "not_requested",
      learnerConfirmed: true,
      reminderStatus: "not_enabled",
      reviewId: confirmationRecord.reviewId,
      shareStatus: "not_shared",
    };
    assert.equal(harness.validCheckIn(confirmationRecord, confirmationEnvelope), true);
    const confirmationBaseline = await inspectProductionCandidate(harness, confirmationEnvelope);
    assert.equal(confirmationBaseline.code, "orphaned_current_object", "confirmation shape must pass before owner closure");

    for (const [label, candidate] of [
      ["confirmed review timestamp", (() => {
        const value = hostClone(confirmationEnvelope);
        const record = Object.values(asRecord(value.checkIns))[0] as MutableRecord;
        record.updatedAt = "2026-08-12T00:03:01.000Z";
        return value;
      })()],
      ["confirmed review ID", (() => {
        const value = hostClone(confirmationEnvelope);
        const record = Object.values(asRecord(value.checkIns))[0] as MutableRecord;
        record.reviewId = null;
        return value;
      })()],
      ["savedAt ordering", (() => {
        const value = expiredActivePlanFixture();
        const record = Object.values(asRecord(value.checkIns))[0] as MutableRecord;
        record.savedAt = "2026-08-12T00:03:00.000Z";
        return value;
      })()],
      ["archivedAt ordering", (() => {
        const value = hostClone(archived);
        const record = (value.checkInHistory as MutableRecord[])[0];
        record.archivedAt = "2026-08-12T00:01:59.999Z";
        return value;
      })()],
    ] as Array<[string, MutableRecord]>) {
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", label);
      assert.equal(result.code, "auxiliary_state_invalid", label);
    }
  });

  it("rejects unknown task-progress fields and unsupported focus durations inside the production validator", async () => {
    const harness = await loadJourneyValidationHarness();
    for (const mutate of [
      (candidate: MutableRecord) => {
        asRecord(candidate.taskProgress)["default-2026-08-12-reading"] = {
          completedAt: null,
          completionClass: "not_completed",
          forged: true,
          selfReported: true,
          source: "learner_checkbox",
          status: "todo",
          updatedAt: "2026-08-12T00:01:00.000Z",
        };
      },
      (candidate: MutableRecord) => {
        asRecord(candidate.focus).sessions = [{
          durationSeconds: 901,
          endedAt: "2026-08-12T00:16:01.000Z",
          sessionId: "focus-abc123",
          startedAt: "2026-08-12T00:01:00.000Z",
          status: "completed",
        }];
      },
    ]) {
      const candidate = restorableWorkspaceFixture();
      mutate(candidate);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid");
      assert.equal(result.code, "auxiliary_state_invalid");
    }
  });

  it("accepts one exact practice writer state and rejects dangling or semantically stale latest receipts", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = restorableWorkspaceFixture();
    asRecord(legal.practice)["reading-library-v1"] = {
      attemptScopeKey: "standalone:reading-library-v1",
      attempts: 0,
      audioCompleted: false,
      audioPlaybackFailed: false,
      audioPlayed: false,
      audioRecorded: false,
      audioSeekDetected: false,
      audioStartedNearBeginning: false,
      completedAt: null,
      draftText: "",
      firstResponse: null,
      freshAttemptFromLegacyReceiptId: null,
      latestPracticeReceiptId: null,
      playCount: 0,
      selectedAnswer: null,
      selfChecks: {},
      startedAt: "2026-08-12T00:01:00.000Z",
      status: "in_progress",
      timerCompleted: false,
      transcriptUsed: false,
      updatedAt: "2026-08-12T00:01:00.000Z",
      wordCount: 0,
    };
    assert.equal((await inspectProductionCandidate(harness, legal)).status, "ready");

    const dangling = hostClone(legal);
    asRecord(asRecord(dangling.practice)["reading-library-v1"] as unknown).latestPracticeReceiptId =
      "00000000-0000-4000-8000-000000000001";
    const result = await inspectProductionCandidate(harness, dangling);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "receipt_graph_invalid");

    const stale = standaloneReadingReceiptFixture();
    const staleReceipts = asRecord(stale.practiceReceipts);
    const older = Object.values(staleReceipts)[0] as MutableRecord;
    const newerId = "00000000-0000-4000-8000-000000000003";
    staleReceipts[newerId] = {
      ...hostClone(older),
      completedAt: "2026-08-12T00:03:00.000Z",
      completionReceiptId: newerId,
      practiceAttemptId: "00000000-0000-4000-8000-000000000004",
    };
    const staleResult = await inspectProductionCandidate(harness, stale);
    assert.equal(staleResult.status, "invalid");
    assert.equal(staleResult.code, "auxiliary_state_invalid");
  });

  it("accepts exact receipt quality flags and rejects duplicate or unknown flags after recomputing SHA", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = standaloneReadingReceiptFixture();
    assert.equal((await inspectProductionCandidate(harness, legal)).status, "ready");

    for (const qualityFlags of [
      ["multiple_attempts"],
      ["unknown_flag"],
      ["multiple_attempts", "multiple_attempts"],
    ]) {
      const candidate = hostClone(legal);
      const receipt = Object.values(asRecord(candidate.practiceReceipts))[0] as MutableRecord;
      receipt.qualityFlags = qualityFlags;
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid");
      assert.equal(result.code, "workspace_normalization_changed");
    }
  });

  it("recomputes the normalized Writing artifact hash and rejects a same-word-count text substitution", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = await standaloneWritingReceiptFixture(harness);
    assert.equal((await inspectProductionCandidate(harness, legal)).status, "ready");

    const substituted = hostClone(legal);
    const practice = asRecord(asRecord(substituted.practice)["writing-community-v1"] as unknown);
    practice.draftText = String(practice.draftText).replace("alpha", "violet");
    const result = await inspectProductionCandidate(harness, substituted);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "auxiliary_state_invalid");
  });

  it("accepts all four writer receipt unions and rejects recomputed-envelope semantic drift per skill", async () => {
    const harness = await loadJourneyValidationHarness();
    const legalBySkill: Record<string, MutableRecord> = {
      Listening: standaloneListeningReceiptFixture(),
      Reading: standaloneReadingReceiptFixture(),
      Speaking: await standaloneSpeakingReceiptFixture(harness),
      Writing: await standaloneWritingReceiptFixture(harness),
    };
    for (const [skill, candidate] of Object.entries(legalBySkill)) {
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "ready", skill);
    }
    const planBound = planBoundReadingReceiptFixture();
    assert.equal((await inspectProductionCandidate(harness, planBound)).status, "ready");

    const mutations: Array<[string, string, (receipt: MutableRecord) => void]> = [
      ["Reading", "catalog contentRef hash", (receipt) => {
        asRecord(receipt.contentRef).contentHash = "b".repeat(64);
      }],
      ["Reading", "impossible audioRecorded mirror", (receipt) => { receipt.audioRecorded = true; }],
      ["Reading", "impossible wordCount mirror", (receipt) => { receipt.wordCount = 999; }],
      ["Reading", "split standalone scope", (receipt) => { receipt.planId = "plan-forged-v1"; }],
      ["Reading", "started after completion", (receipt) => { receipt.startedAt = "2026-08-12T00:02:00.001Z"; }],
      ["Listening", "audio completion mirror", (receipt) => { receipt.audioCompleted = false; }],
      ["Writing", "attempt count mirror", (receipt) => { receipt.attemptCount = 1; }],
      ["Speaking", "self-check count mirror", (receipt) => { receipt.selfCheckCount = 2; }],
    ];
    for (const [skill, label, mutate] of mutations) {
      const candidate = hostClone(legalBySkill[skill]);
      const receipt = Object.values(asRecord(candidate.practiceReceipts))[0] as MutableRecord;
      mutate(receipt);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", `${skill}: ${label}`);
      assert.equal(result.code, "workspace_normalization_changed", `${skill}: ${label}`);
    }

    const splitPlanScope = hostClone(planBound);
    const splitReceipt = Object.values(asRecord(splitPlanScope.practiceReceipts))[0] as MutableRecord;
    splitReceipt.cycleId = "cycle-without-diagnostic-v1";
    const splitResult = await inspectProductionCandidate(harness, splitPlanScope);
    assert.equal(splitResult.status, "invalid");
    assert.equal(splitResult.code, "workspace_normalization_changed");
  });

  it("accepts the exact six-task diagnostic writer union and rejects rehashed semantic drift", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = completedDiagnosticFixture(harness);
    for (const evidence of legal.diagnostic.taskEvidence as MutableRecord[]) {
      assert.equal(harness.validDiagnosticEvidence(evidence, legal.diagnostic), true, String(evidence.taskId));
    }
    assert.equal(harness.validDiagnostic(legal.diagnostic), true);

    const endedAfterSeek = hostClone((legal.diagnostic.taskEvidence as MutableRecord[])[2]);
    Object.assign(endedAfterSeek, {
      audioCompleted: false,
      audioSeekDetected: true,
      evidenceStatus: "evidence_insufficient",
      qualityFlags: ["audio_seek_detected", "audio_not_completed"],
    });
    assert.equal(
      harness.validDiagnosticEvidence(endedAfterSeek, legal.diagnostic),
      true,
      "MP3 ended timestamp remains legal when a seek makes audioCompleted false",
    );

    const skippedReading = {
      ...diagnosticTerminalEvidenceFixture("diagnostic-reading-library-v1"),
      status: "skipped",
      evidenceStatus: "evidence_insufficient",
      qualityFlags: ["learner_skipped"],
      selectedDraft: "a",
    } as MutableRecord;
    for (const key of ["attempts", "durationSeconds", "firstResponse", "resultType"]) delete skippedReading[key];
    assert.equal(harness.validDiagnosticEvidence(skippedReading, legal.diagnostic), true);

    const cases: Array<[string, (candidate: MutableRecord) => void]> = [
      ["objective result is not manifest-derived", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[0].resultType = "first_response_not_matched";
      }],
      ["objective duration is not timestamp-derived", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[0].durationSeconds = Number(evidence[0].durationSeconds) + 1;
      }],
      ["Listening completion contradicts a seek", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[2].audioSeekDetected = true;
        evidence[2].qualityFlags = ["audio_seek_detected"];
        evidence[2].evidenceStatus = "evidence_insufficient";
      }],
      ["Reading carries the Writing-only evidence-insufficient terminal status", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[0].status = "evidence_insufficient";
        evidence[0].evidenceStatus = "evidence_insufficient";
        for (const key of ["attempts", "durationSeconds", "firstResponse", "resultType"]) delete evidence[0][key];
      }],
      ["Writing word count no longer matches text", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[5].wordCount = 21;
      }],
      ["Writing evidence-insufficient terminal omits writer-owned word count", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[5].status = "evidence_insufficient";
        delete evidence[5].wordCount;
      }],
      ["Speaking timer order is impossible", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        asRecord(evidence[4].timer).prepEndsAt = Number(asRecord(evidence[4].timer).startedAt) - 1;
      }],
      ["Speaking carries a Writing-only response field", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[4].responseText = "not a speaking writer field";
      }],
      ["Writing carries a Speaking-only recording field", (candidate) => {
        const evidence = (asRecord(candidate.journey).diagnostic as MutableRecord).taskEvidence as MutableRecord[];
        evidence[5].audioRecorded = false;
      }],
      ["task evidence is not in manifest order", (candidate) => {
        const diagnostic = asRecord(asRecord(candidate.journey).diagnostic);
        const evidence = diagnostic.taskEvidence as MutableRecord[];
        [evidence[0], evidence[1]] = [evidence[1], evidence[0]];
      }],
      ["completed pattern flags are stale", (candidate) => {
        const diagnostic = asRecord(asRecord(candidate.journey).diagnostic);
        diagnostic.patternFlags = ["purpose_from_supporting_details"];
      }],
    ];
    for (const [label, mutate] of cases) {
      const candidate = hostClone(legal.candidate);
      mutate(candidate);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", label);
      assert.equal(result.code, "domain_object_schema_invalid", label);
    }
  });

  it("accepts all four exact retest unions and rejects rehashed skill-specific drift", async () => {
    const harness = await loadJourneyValidationHarness();
    const legalBySkill = Object.fromEntries(
      ["Reading", "Listening", "Writing", "Speaking"].map((skill) => [skill, retestFixture(harness, skill)]),
    ) as Record<string, MutableRecord>;
    for (const [skill, retest] of Object.entries(legalBySkill)) {
      assert.equal(harness.validRetest(retest), true, skill);
      const candidate = restorableWorkspaceFixture();
      asRecord(candidate.journey).retest = hostClone(retest);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", skill);
      assert.equal(result.code, "orphaned_current_object", `${skill} must pass its production schema before owner closure`);
    }

    const cases: Array<[string, string, (retest: MutableRecord) => void]> = [
      ["Reading", "forged result", (retest) => { asRecord(retest.evidence).resultType = "single_task_needs_review"; }],
      ["Listening", "wrong response type", (retest) => { asRecord(retest.evidence).responseType = "single_choice"; }],
      ["Listening", "completed audio with seek", (retest) => { asRecord(retest.evidence).seekDetected = true; }],
      ["Writing", "impossible textarea word count", (retest) => { asRecord(retest.evidence).wordCount = 601; }],
      ["Writing", "incomplete self review", (retest) => { asRecord(retest.evidence).selfChecksComplete = false; }],
      ["Speaking", "forged recording", (retest) => { asRecord(retest.evidence).audioRecorded = true; }],
    ];
    for (const [skill, label, mutate] of cases) {
      const candidate = restorableWorkspaceFixture();
      const retest = hostClone(legalBySkill[skill]);
      mutate(retest);
      asRecord(candidate.journey).retest = retest;
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid", `${skill}: ${label}`);
      assert.equal(result.code, "domain_object_schema_invalid", `${skill}: ${label}`);
    }
  });

  it("accepts a valid active event prefix and rejects wrong-kind, unused, and wrong-owner binding aliases", async () => {
    const harness = await loadJourneyValidationHarness();
    const legal = startedCycleFixture();
    await appendStartedCycleEvent(harness, legal);
    assert.equal((await inspectProductionCandidate(harness, legal.candidate)).status, "ready");

    const cases = [
      (candidate: MutableRecord) => {
        const records = asRecord(asRecord(asRecord(candidate.learningEventBindings).records));
        const diagnostic = asRecord(records.diagnostic);
        const [diagnosticId, alias] = Object.entries(diagnostic)[0];
        delete diagnostic[diagnosticId];
        asRecord(records.task)[diagnosticId] = alias;
      },
      (candidate: MutableRecord) => {
        const records = asRecord(asRecord(asRecord(candidate.learningEventBindings).records));
        asRecord(records.task)["unused-task-v1"] = "00000000-0000-4000-8000-000000000099";
      },
      (candidate: MutableRecord) => {
        const records = asRecord(asRecord(asRecord(candidate.learningEventBindings).records));
        const diagnostic = asRecord(records.diagnostic);
        const [diagnosticId, alias] = Object.entries(diagnostic)[0];
        delete diagnostic[diagnosticId];
        diagnostic["diagnostic-other-v1"] = alias;
      },
    ];
    for (const mutate of cases) {
      const candidate = hostClone(legal.candidate);
      mutate(candidate);
      const result = await inspectProductionCandidate(harness, candidate);
      assert.equal(result.status, "invalid");
      assert.equal(result.code, "ledger_domain_coverage_invalid");
    }

    const staleCycleClock = hostClone(legal.candidate);
    const staleJourney = asRecord(staleCycleClock.journey);
    const staleDiagnostic = asRecord(staleJourney.diagnostic);
    staleDiagnostic.updatedAt = new Date(Date.parse(String(staleDiagnostic.updatedAt)) + 1_000).toISOString();
    const staleClockResult = await inspectProductionCandidate(harness, staleCycleClock);
    assert.equal(staleClockResult.status, "invalid");
    assert.equal(staleClockResult.code, "active_milestone_order_invalid");
  });

  it("accepts a superseded started-only history and rejects an event timestamp after supersession", async () => {
    const harness = await loadJourneyValidationHarness();
    const fixture = startedCycleFixture();
    await appendStartedCycleEvent(harness, fixture);
    const journey = asRecord(fixture.candidate.journey);
    const startedAt = String(fixture.cycle.createdAt);
    const supersededAt = new Date(Date.parse(startedAt) + 1_000).toISOString();
    journey.supersededCycles = [{
      cycleId: fixture.cycle.cycleId,
      diagnosticProtocolVersion: fixture.diagnostic.diagnosticProtocolVersion,
      diagnosticSessionId: fixture.cycle.diagnosticSessionId,
      diagnosticStatus: "in_progress",
      protocolVersion: "gate_a_local_v1",
      reason: "learner_started_new_gate_a_evidence_pack",
      status: "superseded_by_new_diagnostic",
      supersededAt,
      taskEvidenceSummary: [],
      taskSetDigest: fixture.diagnostic.taskSetDigest,
      taskSetVersion: fixture.diagnostic.taskSetVersion,
    }];
    journey.activeCycle = null;
    journey.diagnostic = null;
    assert.equal((await inspectProductionCandidate(harness, fixture.candidate)).status, "ready");

    const impossiblePhaseKeys = hostClone(fixture.candidate);
    const phaseSummaries = asRecord(impossiblePhaseKeys.journey).supersededCycles as MutableRecord[];
    phaseSummaries[0].prioritySkill = "Reading";
    const phaseResult = await inspectProductionCandidate(harness, impossiblePhaseKeys);
    assert.equal(phaseResult.status, "invalid");
    assert.equal(phaseResult.code, "superseded_cycle_invalid");

    const impossibleTime = hostClone(fixture.candidate);
    const summaries = asRecord(impossibleTime.journey).supersededCycles as MutableRecord[];
    summaries[0].supersededAt = new Date(Date.parse(startedAt) - 1).toISOString();
    const result = await inspectProductionCandidate(harness, impossibleTime);
    assert.equal(result.status, "invalid");
    assert.equal(result.code, "ledger_domain_coverage_invalid");
  });

  it("requires a superseded summary overlapping terminal history to mirror diagnostic identity and evidence", async () => {
    const harness = await loadJourneyValidationHarness();
    const terminalAt = "2026-08-12T00:10:00.000Z";
    const taskEvidence = [{
      contentHash: "a".repeat(64),
      durationSeconds: 60,
      evidenceStatus: "evidence_limited",
      qualityFlags: [],
      resultType: "first_response_matched",
      skill: "Reading",
      status: "completed",
      taskId: "diagnostic-reading-library-v1",
      taskVersion: "v1",
    }];
    const history = {
      closedAt: terminalAt,
      cycleId: "cycle-terminal-v1",
      diagnostic: {
        diagnosticProtocolVersion: "gate_a_diagnostic_evidence_v1",
        diagnosticSessionId: "diagnostic-terminal-v1",
        evidenceSufficiency: "limited_unreviewed_evidence",
        priorityBasis: "objective_first_response_pattern",
        prioritySkill: "Reading",
        protocolVersion: "gate_a_local_v1",
        status: "completed",
        taskEvidence,
        taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
        taskSetVersion: "gate_a_original_6_v1",
      },
      diagnosticSessionId: "diagnostic-terminal-v1",
      protocolVersion: "gate_a_local_v1",
      provisionalAt: null,
      status: "completed",
    };
    const summary = {
      cycleId: history.cycleId,
      diagnosticProtocolVersion: history.diagnostic.diagnosticProtocolVersion,
      diagnosticSessionId: history.diagnosticSessionId,
      diagnosticStatus: history.diagnostic.status,
      evidenceSufficiency: history.diagnostic.evidenceSufficiency,
      priorityBasis: history.diagnostic.priorityBasis,
      prioritySkill: history.diagnostic.prioritySkill,
      protocolVersion: history.protocolVersion,
      reason: "learner_started_new_gate_a_evidence_pack",
      status: "superseded_by_new_diagnostic",
      supersededAt: "2026-08-12T00:11:00.000Z",
      taskEvidenceSummary: taskEvidence,
      taskSetDigest: history.diagnostic.taskSetDigest,
      taskSetVersion: history.diagnostic.taskSetVersion,
    };
    assert.equal(harness.supersededMatchesTerminalHistory(summary, history), true);

    const wrongDiagnostic = hostClone(summary);
    wrongDiagnostic.diagnosticSessionId = "diagnostic-drift-v1";
    assert.equal(harness.supersededMatchesTerminalHistory(wrongDiagnostic, history), false);

    const wrongEvidence = hostClone(summary);
    (wrongEvidence.taskEvidenceSummary as MutableRecord[])[0].evidenceStatus = "insufficient_audio_conditions";
    assert.equal(harness.supersededMatchesTerminalHistory(wrongEvidence, history), false);

    const impossibleTime = hostClone(summary);
    impossibleTime.supersededAt = "2026-08-12T00:09:59.999Z";
    assert.equal(harness.supersededMatchesTerminalHistory(impossibleTime, history), false);
  });
});

describe("atomic workspace replacement", () => {
  it("replaces the expected value only after write-back validation succeeds", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, "before");
    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async (raw) => ({ ok: raw === "after" }),
    });

    assert.equal(result.status, "restored");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), "after");
    assert.deepEqual(storage.writes, ["after"]);
  });

  it("returns stale without writing when the compare-and-swap precondition changed", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, "newer-tab-value");
    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "older-page-value",
      validatePersisted: async () => ({ ok: true }),
    });

    assert.equal(result.status, "stale");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), "newer-tab-value");
    assert.deepEqual(storage.writes, []);
  });

  it("rolls back when the candidate write throws", async () => {
    const runtime = loadRuntime();
    let value = "before";
    const writes: string[] = [];
    const storage: StorageContract = {
      getItem: () => value,
      setItem: (_key, next) => {
        writes.push(next);
        if (next === "after") throw new Error("quota exceeded");
        value = next;
      },
      removeItem: () => {
        value = "";
      },
    };

    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => ({ ok: true }),
    });

    assert.equal(result.status, "restore_failed");
    assert.equal(value, "before");
    assert.deepEqual(writes, ["after"]);
  });

  it("preserves a concurrent value when write-back differs from both candidate and prior state", async () => {
    const runtime = loadRuntime();
    let value = "before";
    let reads = 0;
    const storage: StorageContract = {
      getItem: () => {
        reads += 1;
        if (reads === 2) value = "third-party-after-write";
        return value;
      },
      setItem: (_key, next) => {
        value = next;
      },
      removeItem: () => {
        value = "";
      },
    };

    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => ({ ok: true }),
    });

    assert.equal(result.status, "concurrent_write");
    assert.equal(value, "third-party-after-write");
    assert.equal(reads, 2);
  });

  it("rolls back when persisted validation fails", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, "before");
    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => ({ ok: false, code: "invalid_workspace" }),
    });

    assert.equal(result.status, "restore_failed");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), "before");
    assert.deepEqual(storage.writes, ["after", "before"]);
  });

  it("removes the candidate when a null prior value fails persisted validation", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, null);
    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: null,
      validatePersisted: async () => ({ ok: false, code: "invalid_workspace" }),
    });

    assert.equal(result.status, "restore_failed");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), null);
    assert.deepEqual(storage.writes, ["after"]);
    assert.deepEqual(storage.removals, [runtime.WORKSPACE_NAMESPACE]);
  });

  it("restores the prior value when setItem writes the candidate before throwing", async () => {
    const runtime = loadRuntime();
    let value = "before";
    const writes: string[] = [];
    const storage: StorageContract = {
      getItem: () => value,
      setItem: (_key, next) => {
        writes.push(next);
        value = next;
        if (next === "after") throw new Error("write reported failure after mutation");
      },
      removeItem: () => {
        value = "";
      },
    };

    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => ({ ok: true }),
    });

    assert.equal(result.status, "restore_failed");
    assert.equal(value, "before");
    assert.deepEqual(writes, ["after", "before"]);
  });

  it("preserves a concurrent value written while successful asynchronous validation is pending", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, "before");
    let signalValidationStarted!: () => void;
    let releaseValidation!: () => void;
    const validationStarted = new Promise<void>((resolve) => {
      signalValidationStarted = resolve;
    });
    const validationRelease = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });

    const replacement = runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => {
        signalValidationStarted();
        await validationRelease;
        return { ok: true };
      },
    });
    await validationStarted;
    storage.setItem(runtime.WORKSPACE_NAMESPACE, "third-party-during-validation");
    releaseValidation();
    const result = await replacement;

    assert.equal(result.status, "concurrent_write");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), "third-party-during-validation");
    assert.deepEqual(storage.writes, ["after", "third-party-during-validation"]);
  });

  it("does not roll back over a concurrent value when asynchronous validation fails", async () => {
    const runtime = loadRuntime();
    const storage = new MemoryStorage(runtime.WORKSPACE_NAMESPACE, "before");
    let signalValidationStarted!: () => void;
    let releaseValidation!: () => void;
    const validationStarted = new Promise<void>((resolve) => {
      signalValidationStarted = resolve;
    });
    const validationRelease = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });

    const replacement = runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => {
        signalValidationStarted();
        await validationRelease;
        return { ok: false, code: "invalid_workspace" };
      },
    });
    await validationStarted;
    storage.setItem(runtime.WORKSPACE_NAMESPACE, "third-party-before-invalid-result");
    releaseValidation();
    const result = await replacement;

    assert.equal(result.status, "concurrent_write");
    assert.equal(storage.getItem(runtime.WORKSPACE_NAMESPACE), "third-party-before-invalid-result");
    assert.deepEqual(storage.writes, ["after", "third-party-before-invalid-result"]);
  });

  it("reports rollback_failed when the prior value cannot be restored", async () => {
    const runtime = loadRuntime();
    let value = "before";
    const storage: StorageContract = {
      getItem: () => value,
      setItem: (_key, next) => {
        if (next === "before" && value === "after") throw new Error("rollback denied");
        value = next;
      },
      removeItem: () => {
        value = "";
      },
    };

    const result = await runtime.replaceWorkspaceAtomically({
      storage,
      candidateRaw: "after",
      expectedCurrentRaw: "before",
      validatePersisted: async () => ({ ok: false }),
    });

    assert.equal(result.status, "rollback_failed");
    assert.equal(value, "after");
  });
});
