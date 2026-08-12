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
  canonicalJson(value: unknown): string;
  sha256Hex(value: string): Promise<string>;
  createEnvelope(workspace: unknown): Promise<MutableRecord>;
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

const runtimeSource = readFileSync(new URL("../workspace-backup.js", import.meta.url), "utf8");
const learningEventsSource = readFileSync(new URL("../learning-events.js", import.meta.url), "utf8");
const journeySource = readFileSync(new URL("../journey.js", import.meta.url), "utf8");
const HASH = "a".repeat(64);

function asRecord(value: unknown): MutableRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as MutableRecord;
}

function hostClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
