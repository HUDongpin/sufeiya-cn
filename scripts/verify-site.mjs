import { createHash, webcrypto } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import Ajv from "ajv";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const passes = [];
const pageFiles = [
  ["index.html", "home", "/"],
  ["workspace.html", "workspace", "/workspace"],
  ["diagnostic.html", "diagnostic", "/diagnostic"],
  ["plan.html", "plan", "/plan"],
  ["today.html", "today", "/today"],
  ["recommendations.html", "recommendations", "/recommendations"],
  ["practice.html", "practice", "/practice"],
  ["practice-reading.html", "practice-reading", "/practice-reading"],
  ["practice-listening.html", "practice-listening", "/practice-listening"],
  ["practice-writing.html", "practice-writing", "/practice-writing"],
  ["practice-speaking.html", "practice-speaking", "/practice-speaking"],
  ["focus.html", "focus", "/focus"],
  ["check-in.html", "check-in", "/check-in"],
  ["review.html", "review", "/review"],
  ["community.html", "community", "/community"],
  ["retest.html", "retest", "/retest"],
  ["my-data.html", "my-data", "/my-data"],
  ["learning-path.html", "learning-path", "/learning-path"],
  ["platform.html", "platform", "/platform"],
  ["resources.html", "resources", "/resources"],
  ["about.html", "about", "/about"],
];
const expectedNavTargets = ["/learning-path", "/platform", "/resources", "/about"];
const protectedLearnerPaths = [
  "/workspace",
  "/diagnostic",
  "/plan",
  "/recommendations",
  "/today",
  "/practice",
  "/practice-reading",
  "/practice-listening",
  "/practice-writing",
  "/practice-speaking",
  "/focus",
  "/check-in",
  "/review",
  "/community",
  "/retest",
  "/my-data",
  "/teaching-review-demo",
  "/account",
];
const betaProtectedLearnerPaths = protectedLearnerPaths.filter((path) => path !== "/account");
const sitemapPublicPaths = ["/", "/super-teacher", "/learning-path", "/platform", "/resources", "/about"];
const nextOnlyTargets = new Map([
  ["/super-teacher", "app/super-teacher/page.tsx"],
  ["/teaching-review-demo", "app/teaching-review-demo/page.tsx"],
  ["/assets/sufeiya-super-teacher-avatar.webp", "public/assets/sufeiya-super-teacher-avatar.webp"],
]);

const check = (condition, message) => {
  if (condition) passes.push(message);
  else failures.push(message);
};

const checkExecutable = (message, assertion) => {
  try {
    check(Boolean(assertion()), message);
  } catch (error) {
    failures.push(`${message}: executable fixture failed with ${error instanceof Error ? error.message : String(error)}`);
  }
};

const checkExecutableAsync = async (message, assertion) => {
  try {
    check(Boolean(await assertion()), message);
  } catch (error) {
    failures.push(`${message}: executable fixture failed with ${error instanceof Error ? error.message : String(error)}`);
  }
};

const srgbLuminance = (rgb) => {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground, background) => {
  const foregroundLuminance = srgbLuminance(foreground);
  const backgroundLuminance = srgbLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};

const compositeRgb = (foreground, background, alpha) =>
  foreground.map((channel, index) => alpha * channel + (1 - alpha) * background[index]);

const read = (path) => readFile(join(root, path), "utf8");
const styles = await read("styles.css");
const nextOverrides = await read("app/next-overrides.css");
const script = await read("script.js");
const workspaceScript = await read("workspace.js");
const journeyScript = await read("journey.js");
const workspaceBackupScript = await read("workspace-backup.js");
const learningEventsScript = await read("learning-events.js");
const publicWorkspaceScript = await read("public/workspace.js");
const publicJourneyScript = await read("public/journey.js");
const publicWorkspaceBackupScript = await read("public/workspace-backup.js");
const publicLearningEventsScript = await read("public/learning-events.js");
const resourcesScript = await read("resources.js");
const notFound = await read("404.html");
const sitemap = await read("sitemap.xml");
const nextSitemap = await read("app/sitemap.ts");
const nextConfig = await read("next.config.ts");
const rootLayout = await read("app/layout.tsx");
const notFoundRoute = await read("app/not-found.tsx");
const dynamicLegacyPage = await read("app/[slug]/page.tsx");
const routedLegacyPage = await read("components/routed-legacy-page.tsx");
const explicitLegacyRouteSources = new Map(
  await Promise.all(
    pageFiles
      .filter(([, key]) => key !== "home")
      .map(async ([, key]) => [key, await read(`app/${key}/page.tsx`)]),
  ),
);
const topLevelAppPageSegments = (
  await Promise.all(
    (await readdir(join(root, "app"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          await access(join(root, "app", entry.name, "page.tsx"));
          return entry.name;
        } catch (error) {
          if (error?.code === "ENOENT") return null;
          throw error;
        }
      }),
  )
).filter(Boolean).sort();
const legacyPageComponent = await read("components/legacy-page.tsx");
const anonymousLegacyPage = await read("components/anonymous-legacy-page.tsx");
const fullDocumentLink = await read("components/full-document-link.tsx");
const siteShell = await read("components/site-shell.tsx");
const siteFrame = await read("components/site-frame.tsx");
const authPage = await read("components/auth-page.tsx");
const betaAccessPage = await read("app/beta-access/page.tsx");
const clerkWidgetFrame = await read("components/clerk-widget-frame.tsx");
const clerkAccountControls = await read("components/clerk-account-controls.tsx");
const clerkConfig = await read("lib/auth/clerk-config.ts");
const betaAccessConfig = await read("lib/auth/beta-access.ts");
const accountPage = await read("app/account/[[...account]]/page.tsx");
const signInPage = await read("app/sign-in/[[...sign-in]]/page.tsx");
const signUpPage = await read("app/sign-up/[[...sign-up]]/page.tsx");
const proxyScript = await read("proxy.ts");
const superTeacherPage = await read("app/super-teacher/page.tsx");
const superTeacherClient = await read("components/super-teacher-client.tsx");
const superTeacherConversation = await read("components/super-teacher/super-teacher-conversation.tsx");
const superTeacherSessionProvider = await read("components/super-teacher/super-teacher-session-provider.tsx");
const superTeacherFloatingAssistant = await read("components/sofia-floating-assistant.tsx");
const superTeacherAccessBoundary = await read("components/sofia-access-boundary.tsx");
const superTeacherPublicAccess = await read("components/sofia-public-access.tsx");
const superTeacherFloatingStyles = await read("components/sofia-floating-assistant.module.css");
const superTeacherClientSession = await read("lib/super-teacher/client-session.ts");
const superTeacherRoute = await read("app/api/super-teacher/route.ts");
const superTeacherStatus = await read("lib/super-teacher/status.ts");
const superTeacherResponder = await read("lib/super-teacher/responder.ts");
const superTeacherDeterministicResponder = await read("lib/super-teacher/deterministic-responder.ts");
const superTeacherLocalGrounding = await read("lib/super-teacher/local-grounding.ts");
const superTeacherModelRuntime = await read("lib/super-teacher/model-runtime.ts");
const superTeacherVoiceRelease = await read("lib/super-teacher/voice-release.ts");
const releaseGovernanceSource = await read("lib/release-governance.ts");
const p0DecisionLogSource = await read("lib/p0-decision-log.ts");
const releaseGovernanceStatusRoute = await read("app/api/governance/status/route.ts");
const teachingReviewPage = await read("app/teaching-review-demo/page.tsx");
const teachingReviewClient = await read("components/teaching-review-demo-client.tsx");
const teachingReviewContract = await read("lib/teaching-review-demo.ts");
const superTeacherVoiceStatusRoute = await read("app/api/super-teacher/voice/status/route.ts");
const superTeacherContracts = await read("lib/super-teacher/contracts.ts");
const superTeacherLocalContext = await read("lib/super-teacher/local-context.ts");
const superTeacherPolicy = await read("lib/super-teacher/policy.ts");
const legacyContent = await read("lib/legacy-content.generated.ts");
const parseDeclaredStringArray = (source, declaration, label) => {
  const match = source.match(
    new RegExp(`(?:export\\s+)?const\\s+${declaration}\\s*=\\s*(\\[[\\s\\S]*?\\])(?:\\s+as\\s+const)?\\s*;`),
  );
  if (!match) throw new Error(`${label} is missing the ${declaration} declaration.`);
  const parsed = JSON.parse(match[1].replace(/,\s*]/g, "]"));
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string" || entry.length === 0) ||
    new Set(parsed).size !== parsed.length
  ) {
    throw new Error(`${label} has an invalid ${declaration} declaration.`);
  }
  return parsed;
};
const explicitLegacyRouteSlugs = pageFiles
  .filter(([, key]) => key !== "home")
  .map(([, key]) => key);
const generatedLegacyRouteSlugs = parseDeclaredStringArray(
  legacyContent,
  "publicRouteSlugs",
  "lib/legacy-content.generated.ts",
);
const configuredCleanRoutes = parseDeclaredStringArray(nextConfig, "cleanRoutes", "next.config.ts");
const configuredProtectedPaths = parseDeclaredStringArray(
  clerkConfig,
  "CLERK_PROTECTED_PATHS",
  "lib/auth/clerk-config.ts",
);
const configuredBetaProtectedPaths = parseDeclaredStringArray(
  clerkConfig,
  "CLERK_BETA_PROTECTED_PATHS",
  "lib/auth/clerk-config.ts",
);
const configuredClerkPublicRuntimePaths = parseDeclaredStringArray(
  clerkConfig,
  "CLERK_PUBLIC_RUNTIME_PATHS",
  "lib/auth/clerk-config.ts",
);
const diagnosticPage = await read("diagnostic.html");
const myDataPage = await read("my-data.html");
const learningEventSchema = JSON.parse(await read("data/learning-event.schema.v2.json"));
const learningEventRegister = JSON.parse(await read("data/learning-event-register.v2.json"));
const learningEventExamples = JSON.parse(await read("data/learning-event-examples.v2.json"));
const diagnosticTaskRegister = JSON.parse(await read("data/diagnostic-task-register.json"));
const practiceTaskRegister = JSON.parse(await read("data/practice-task-register.json"));
const releaseDecisionRegister = JSON.parse(await read("data/release-decision-register.v1.json"));
const p0DecisionLog = JSON.parse(await read("data/p0-decision-log.v1.json"));
const p0PublishedBaseline = JSON.parse(await read("data/p0-decision-log-published-baseline.v1.json"));
const runtimePageSources = new Map(
  await Promise.all(pageFiles.map(async ([filename]) => [filename, await read(filename)])),
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const learningEventSchemaValidator = (() => {
  try {
    const ajv = new Ajv({
      allErrors: true,
      schemaId: "auto",
      meta: false,
      validateSchema: false,
      strictKeywords: false,
      logger: false,
    });
    return ajv.compile(learningEventSchema);
  } catch {
    return null;
  }
})();
const sourceSection = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
};

const eventAppendTransactionsAreAtomic = (source, eventType) => {
  const practiceFinalization = eventType === "practice_attempt.finalized";
  const needle = practiceFinalization
    ? "appendPracticeFinalizationEvent(receipt)"
    : `appendLearningEvent("${eventType}"`;
  const acceptedOutcomePattern = practiceFinalization
    ? /\["appended", "already_recorded", "not_applicable"\]\.includes\(eventOutcome\.status\)/
    : /\["appended", "already_recorded"\]\.includes\(eventOutcome\.status\)/;
  const indices = [];
  let cursor = source.indexOf(needle);
  while (cursor >= 0) {
    indices.push(cursor);
    cursor = source.indexOf(needle, cursor + needle.length);
  }
  return Boolean(
    indices.length &&
      indices.every((index) => {
        const prefix = source.slice(Math.max(0, index - 12000), index);
        const snapshots = [...prefix.matchAll(/const\s+([A-Za-z][A-Za-z0-9]*)\s*=\s*snapshotState\(\);/g)];
        const snapshotMatch = snapshots.at(-1);
        const snapshotName = snapshotMatch?.[1];
        if (!snapshotName || snapshotMatch.index === undefined) return false;
        const businessMutationBody = prefix.slice(snapshotMatch.index + snapshotMatch[0].length);
        const transactionBody = source.slice(index, index + 1800);
        const persistIndex = transactionBody.indexOf("if (!persist())");
        if (persistIndex < 0) return false;
        const eventOutcomeBody = transactionBody.slice(0, persistIndex);
        const persistBody = transactionBody.slice(persistIndex, persistIndex + 420);
        return Boolean(
          /(?:state(?:\.[A-Za-z][A-Za-z0-9]*|\[[^\]]+\])+|(?:cycle|latestCycle|activeCycle)\.[A-Za-z][A-Za-z0-9]*)\s*=/.test(
            businessMutationBody,
          ) &&
          acceptedOutcomePattern.test(eventOutcomeBody) &&
          eventOutcomeBody.includes(`state = ${snapshotName}`) &&
          persistBody.includes(`state = ${snapshotName}`)
        );
      })
  );
};

const createLearningEventsHarness = () => {
  const window = {};
  let networkDispatchCount = 0;
  const forbiddenDispatch = () => {
    networkDispatchCount += 1;
    throw new Error("NETWORK_DISPATCH_FORBIDDEN");
  };
  runInNewContext(learningEventsScript, {
    window,
    crypto: webcrypto,
    TextEncoder,
    fetch: forbiddenDispatch,
    XMLHttpRequest: forbiddenDispatch,
    WebSocket: forbiddenDispatch,
    EventSource: forbiddenDispatch,
    navigator: { sendBeacon: forbiddenDispatch },
  });
  if (!window.SufeiyaLearningEvents) throw new Error("LEARNING_EVENTS_RUNTIME_UNAVAILABLE");
  return {
    runtime: window.SufeiyaLearningEvents,
    networkDispatchCount: () => networkDispatchCount,
  };
};

const createLearningEventDomainFixtures = ({ anchorMs = Date.now() - 1_200 } = {}) => {
  const occurredAt = (offset) => new Date(anchorMs + (offset * 150)).toISOString();
  const ids = {
    cycleId: "cycle-event-fixture",
    diagnosticSessionId: "diagnostic-event-fixture",
    planId: "plan-event-fixture",
    recommendationId: "recommendation-event-fixture",
    bindingId: "binding-event-fixture",
    taskId: "task-event-fixture",
    practiceAttemptId: "11111111-1111-4111-8111-111111111111",
    completionReceiptId: "22222222-2222-4222-8222-222222222222",
    checkInId: "check-in-event-fixture",
    retestId: "retest-event-fixture",
    updatedPlanId: "plan-updated-event-fixture",
  };
  const cycle = {
    protocolVersion: "gate_a_local_v1",
    status: "in_progress",
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    createdAt: occurredAt(0),
  };
  const diagnostic = {
    protocolVersion: "gate_a_local_v1",
    status: "in_progress",
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    taskSetVersion: "gate_a_original_6_v1",
    taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
  };
  const recommendation = {
    status: "accepted",
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    planId: ids.planId,
    recommendationId: ids.recommendationId,
    primary: { skill: "Reading", taskId: ids.taskId },
    evidenceBinding: {
      bindingId: ids.bindingId,
      cycleId: ids.cycleId,
      diagnosticSessionId: ids.diagnosticSessionId,
      practiceTaskId: ids.taskId,
      reviewStatus: "gate_a_unreviewed",
      teacherReviewed: false,
      measurementReviewed: false,
    },
    createdAt: occurredAt(1),
  };
  const receipt = {
    protocolVersion: "sufeiya_practice_receipt_v2",
    sealed: true,
    status: "completed",
    practiceAttemptId: ids.practiceAttemptId,
    completionReceiptId: ids.completionReceiptId,
    activityId: "https://sufeiya.cn/activities/practice/reading-library/v1",
    activityVersion: "v1",
    skill: "Reading",
    evidenceStatus: "evidence_limited",
    evidence: { resultType: "correct", attemptCount: 1 },
    receiptEvidenceClass: "objective_response",
    qualityFlags: [],
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    planId: ids.planId,
    recommendationId: ids.recommendationId,
    taskId: ids.taskId,
    completedAt: occurredAt(2),
  };
  const checkIn = {
    status: "saved",
    evidenceClass: "practice_receipt",
    questionStatus: "none",
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    planId: ids.planId,
    recommendationId: ids.recommendationId,
    linkedTaskId: ids.taskId,
    taskCompletionReceiptId: ids.completionReceiptId,
    practiceReceipt: receipt,
    checkInId: ids.checkInId,
    savedAt: occurredAt(3),
  };
  const retest = {
    status: "completed",
    parallelRetest: true,
    automatedScoreProduced: false,
    growthClaimProduced: false,
    cycleId: ids.cycleId,
    diagnosticSessionId: ids.diagnosticSessionId,
    planId: ids.planId,
    recommendationId: ids.recommendationId,
    checkInId: ids.checkInId,
    baselineTaskId: ids.taskId,
    baselinePracticeReceiptId: ids.completionReceiptId,
    retestId: ids.retestId,
    skill: "Reading",
    evidence: { resultType: "single_task_correct" },
    evidenceStatus: "limited_single_task",
    evidenceSufficiency: "limited_unreviewed_same_skill_task",
    humanConfirmationStatus: "not_required_for_gate_a_flow",
    comparability: {
      constructAlignment: "same_skill_unreviewed_construct",
      officialEquivalenceClaimed: false,
    },
    completedAt: occurredAt(4),
  };
  const completedCycle = {
    ...cycle,
    status: "completed",
    retestId: ids.retestId,
    updatedPlanId: ids.updatedPlanId,
    closedAt: occurredAt(5),
  };
  const planUpdate = {
    cycleId: ids.cycleId,
    retestId: ids.retestId,
    updatedPlanId: ids.updatedPlanId,
    supersedesPlanId: ids.planId,
    learnerConfirmed: true,
    confirmationClass: "learner_confirmed_gate_a",
    humanConfirmationStatus: "not_required_for_gate_a_flow",
    automatedAbilityDecision: false,
    focusSkill: "Reading",
  };
  return {
    ids,
    events: [
      ["learning_cycle.started", { cycle, diagnostic }],
      ["recommendation.decided", { recommendation }],
      ["practice_attempt.finalized", { receipt, recommendation }],
      ["check_in.committed", { checkIn, recommendation }],
      ["retest.completed", { retest, recommendation }],
      ["learning_cycle.completed", { cycle: completedCycle, retest, planUpdate }],
    ],
  };
};

const createListeningHumanReviewedEventFixtures = () => {
  const fixtures = createLearningEventDomainFixtures();
  const recommendation = fixtures.events[1][1].recommendation;
  const receipt = fixtures.events[2][1].receipt;
  const checkIn = fixtures.events[3][1].checkIn;
  const retestDomain = fixtures.events[4][1];
  const completionDomain = fixtures.events[5][1];
  const humanReviewReceiptId = "human-review-receipt-event-fixture";
  recommendation.primary.skill = "Listening";
  receipt.activityId = "https://sufeiya.cn/activities/practice/listening-club/v1";
  receipt.skill = "Listening";
  receipt.evidenceStatus = "evidence_insufficient";
  receipt.receiptEvidenceClass = "audio_objective_response";
  checkIn.practiceReceipt = { ...receipt, evidenceStatus: "evidence_limited" };
  retestDomain.retest.skill = "Listening";
  retestDomain.retest.evidence = { resultType: "single_task_needs_review" };
  retestDomain.retest.evidenceSufficiency = "insufficient_audio_conditions";
  retestDomain.retest.humanConfirmationStatus = "completed";
  retestDomain.humanReviewReceiptId = humanReviewReceiptId;
  completionDomain.planUpdate.focusSkill = "Balanced";
  completionDomain.planUpdate.humanConfirmationStatus = "completed";
  completionDomain.humanReviewReceiptId = humanReviewReceiptId;
  return fixtures;
};

const appendLearningEventFixtures = async (runtime, state, fixtures = createLearningEventDomainFixtures()) => {
  const outcomes = [];
  for (const [eventType, domain] of fixtures.events) {
    outcomes.push(await runtime.appendDomainEvent(state, eventType, domain));
  }
  return { fixtures, outcomes };
};

const expectedLearningEventTypes = [
  "learning_cycle.started",
  "recommendation.decided",
  "practice_attempt.finalized",
  "check_in.committed",
  "retest.completed",
  "learning_cycle.completed",
];

const canonicalLearningEventKeys = [
  "contractId",
  "schemaVersion",
  "eventId",
  "idempotencyKey",
  "eventType",
  "sequence",
  "occurredAt",
  "recordedAt",
  "subject",
  "context",
  "activity",
  "attributes",
  "privacy",
  "governance",
  "previousEventHash",
  "eventHash",
];
const canonicalContextKeys = {
  "learning_cycle.started": ["learningCycleId", "diagnosticSessionId"],
  "recommendation.decided": ["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "causationEventId"],
  "practice_attempt.finalized": ["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "taskId", "attemptId", "practiceReceiptId", "causationEventId"],
  "check_in.committed": ["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "taskId", "practiceReceiptId", "checkInId", "causationEventId"],
  "retest.completed": ["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "checkInId", "retestId", "baselinePracticeReceiptId", "causationEventId"],
  "learning_cycle.completed": ["learningCycleId", "diagnosticSessionId", "planId", "retestId", "updatedPlanId", "causationEventId"],
};
const canonicalAttributeKeys = {
  "learning_cycle.started": ["outcome", "taskSetVersion", "taskSetDigest"],
  "recommendation.decided": ["decision", "bindingReviewStatus"],
  "practice_attempt.finalized": ["outcome", "skill", "evidenceType", "evidenceStatus", "automatedScoreProduced", "formalDiagnosisProduced", "officialEquivalenceClaimed", "attemptCount"],
  "check_in.committed": ["outcome", "evidenceClass", "evidenceStatus", "questionStatus"],
  "retest.completed": ["outcome", "skill", "evidenceType", "evidenceSufficiency", "comparabilityClass", "humanConfirmationStatus", "automatedScoreProduced", "formalDiagnosisProduced", "growthClaimed", "officialEquivalenceClaimed"],
  "learning_cycle.completed": ["outcome", "nextFocusSkill", "humanConfirmationStatus", "automatedScoreProduced", "formalDiagnosisProduced", "growthClaimed", "officialEquivalenceClaimed"],
};
const canonicalPrivacy = {
  classification: "pseudonymous_local_learning_metadata",
  containsDirectIdentifier: false,
  containsAccountIdentifier: false,
  containsClerkIdentifier: false,
  containsFreeText: false,
  containsRawResponse: false,
  containsAudio: false,
  containsSofiaContent: false,
};
const canonicalGovernance = {
  captureMode: "forward_only_no_backfill",
  historicalBackfillAllowed: false,
  storageScope: "browser_local_only",
  appendPolicy: "application_append_only",
  integrityAssurance: "local_hash_chain_not_tamper_proof",
  corruptionPolicy: "fail_closed",
  networkDispatch: "disabled",
  lrsDispatch: "disabled",
  xapiDispatch: "disabled",
  sofiaAccess: "forbidden",
  exportEligibility: "local_user_backup_only_not_lrs_exportable",
};
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hasExactKeys = (value, keys) => Boolean(
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
);

checkExecutable("learning-event runtime exposes only the six approved local event types", () => {
  const { runtime, networkDispatchCount } = createLearningEventsHarness();
  return Boolean(
    runtime.CONTRACT_ID === "sufeiya.learning-event.v2" &&
    runtime.SCHEMA_VERSION === 2 &&
    runtime.LEDGER_PROTOCOL_VERSION === "sufeiya_learning_event_ledger_v2" &&
    runtime.BINDING_PROTOCOL_VERSION === "sufeiya_learning_event_bindings_v2" &&
    runtime.EXPORT_ELIGIBILITY === "local_user_backup_only_not_lrs_exportable" &&
    JSON.stringify([...runtime.EVENT_TYPES]) === JSON.stringify(expectedLearningEventTypes) &&
    networkDispatchCount() === 0
  );
});

await checkExecutableAsync(
  "all six canonical events append, chain, summarize, back up, and replay idempotently without network dispatch",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const state = {
      schemaVersion: 1,
      businessSentinel: { preserved: true },
      sofiaConversationSentinel: { turn: "SOFIA_PRIVATE_TURN_MUST_NOT_EXPORT" },
      freeTextSentinel: "LEARNER_FREE_TEXT_MUST_NOT_EXPORT",
    };
    const { fixtures, outcomes } = await appendLearningEventFixtures(runtime, state);
    const validation = await runtime.validateLedger(state);
    const eventIds = new Set(state.learningEvents.map((event) => event.eventId));
    const idempotencyKeys = new Set(state.learningEvents.map((event) => event.idempotencyKey));
    const canonicalEvents = state.learningEvents.every((event, index) => {
      const withoutHash = { ...event };
      delete withoutHash.eventHash;
      return Boolean(
        hasExactKeys(event, canonicalLearningEventKeys) &&
        canonicalLearningEventKeys.length === 16 &&
        uuidV4Pattern.test(event.eventId) &&
        uuidV4Pattern.test(event.idempotencyKey) &&
        event.idempotencyKey !== event.eventId &&
        event.sequence === index + 1 &&
        event.previousEventHash === (index === 0 ? null : state.learningEvents[index - 1].eventHash) &&
        event.eventHash === sha256(runtime.canonicalJson(withoutHash)) &&
        Date.parse(event.recordedAt) >= Date.parse(event.occurredAt) &&
        Date.parse(event.recordedAt) - Date.parse(event.occurredAt) <= 5 * 60 * 1000 &&
        hasExactKeys(event.subject, ["subjectId", "subjectType", "identityAssurance", "assignedBy"]) &&
        /^anon_[0-9a-f-]{36}$/.test(event.subject.subjectId) &&
        event.subject.subjectType === "anonymous_installation" &&
        event.subject.identityAssurance === "local_random_alias" &&
        event.subject.assignedBy === "local_runtime_csprng" &&
        hasExactKeys(event.context, canonicalContextKeys[event.eventType]) &&
        hasExactKeys(event.activity, ["kind", "id", "version"]) &&
        hasExactKeys(event.attributes, canonicalAttributeKeys[event.eventType]) &&
        hasExactKeys(event.privacy, Object.keys(canonicalPrivacy)) &&
        Object.entries(canonicalPrivacy).every(([key, value]) => event.privacy[key] === value) &&
        hasExactKeys(event.governance, Object.keys(canonicalGovernance)) &&
        Object.entries(canonicalGovernance).every(([key, value]) => event.governance[key] === value) &&
        (index === 0
          ? !Object.prototype.hasOwnProperty.call(event.context, "causationEventId")
          : event.context.causationEventId === state.learningEvents[index - 1].eventId)
      );
    });
    const beforeReplay = JSON.stringify(state);
    const replay = await appendLearningEventFixtures(runtime, state, fixtures);
    const summary = await runtime.summarize(state);
    const backupResult = await runtime.createLocalBackup(state);
    const backupJson = JSON.stringify(backupResult.backup);
    return Boolean(
      outcomes.length === expectedLearningEventTypes.length &&
      outcomes.every((outcome) => outcome.status === "appended") &&
      validation.ok &&
      validation.eventCount === expectedLearningEventTypes.length &&
      validation.headHash === state.learningEvents.at(-1)?.eventHash &&
      canonicalEvents &&
      learningEventSchemaValidator &&
      state.learningEvents.every((event) => learningEventSchemaValidator(event)) &&
      eventIds.size === expectedLearningEventTypes.length &&
      idempotencyKeys.size === expectedLearningEventTypes.length &&
      replay.outcomes.every((outcome) => outcome.status === "already_recorded") &&
      JSON.stringify(state) === beforeReplay &&
      summary.status === "ready" &&
      summary.eventCount === expectedLearningEventTypes.length &&
      expectedLearningEventTypes.every((eventType) => summary.byType[eventType] === 1) &&
      summary.headHash === validation.headHash &&
      summary.exportEligibility === "local_user_backup_only_not_lrs_exportable" &&
      summary.networkDispatch === "disabled" &&
      summary.lrsDispatch === "disabled" &&
      summary.xapiDispatch === "disabled" &&
      backupResult.status === "ready" &&
      backupResult.backup.backupType === "local_user_backup_only_not_lrs_exportable" &&
      backupResult.backup.integrity.validation === "valid_at_export" &&
      backupResult.backup.integrity.eventCount === expectedLearningEventTypes.length &&
      backupResult.backup.integrity.headHash === validation.headHash &&
      backupResult.backup.events.length === expectedLearningEventTypes.length &&
      !Object.prototype.hasOwnProperty.call(backupResult.backup, "learningEventBindings") &&
      !backupJson.includes("SOFIA_PRIVATE_TURN_MUST_NOT_EXPORT") &&
      !backupJson.includes("LEARNER_FREE_TEXT_MUST_NOT_EXPORT") &&
      Object.values(fixtures.ids).every((domainId) => !backupJson.includes(domainId)) &&
      state.businessSentinel.preserved === true &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "the skipped-recommendation alternative-task branch forms the same complete auditable event chain",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const fixtures = createLearningEventDomainFixtures();
    const alternateTaskId = "task-event-fixture-alternative";
    const recommendation = fixtures.events[1][1].recommendation;
    const receipt = fixtures.events[2][1].receipt;
    const checkIn = fixtures.events[3][1].checkIn;
    const retest = fixtures.events[4][1].retest;
    recommendation.status = "skipped";
    receipt.taskId = alternateTaskId;
    checkIn.linkedTaskId = alternateTaskId;
    checkIn.practiceReceipt = receipt;
    retest.baselineTaskId = alternateTaskId;
    const state = { schemaVersion: 1 };
    const { outcomes } = await appendLearningEventFixtures(runtime, state, fixtures);
    const validation = await runtime.validateLedger(state);
    const practiceEvent = state.learningEvents?.find((event) => event.eventType === "practice_attempt.finalized");
    const checkInEvent = state.learningEvents?.find((event) => event.eventType === "check_in.committed");
    return Boolean(
      recommendation.evidenceBinding.practiceTaskId === recommendation.primary.taskId &&
      receipt.taskId !== recommendation.primary.taskId &&
      outcomes.every((outcome) => outcome.status === "appended") &&
      validation.ok &&
      validation.eventCount === 6 &&
      practiceEvent?.context.taskId === checkInEvent?.context.taskId &&
      practiceEvent?.context.practiceReceiptId === checkInEvent?.context.practiceReceiptId &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "canonical schema, register, examples, and hashes cross-validate the same six-event contract",
  async () => {
    if (!learningEventSchemaValidator) return false;
    const { runtime } = createLearningEventsHarness();
    const registerTypes = learningEventRegister.allowlist.map((entry) => entry.eventType);
    const schemaTypes = learningEventSchema.properties?.eventType?.enum;
    const exampleEvents = learningEventExamples.events;
    const eventIds = new Set();
    const idempotencyKeys = new Set();
    let previousEventHash = null;
    for (let index = 0; index < exampleEvents.length; index += 1) {
      const event = exampleEvents[index];
      const registerEntry = learningEventRegister.allowlist.find((entry) => entry.eventType === event.eventType);
      if (!registerEntry || !learningEventSchemaValidator(event)) return false;
      if (
        !hasExactKeys(event, canonicalLearningEventKeys) ||
        Object.prototype.hasOwnProperty.call(event, "ledgerProtocolVersion") ||
        !uuidV4Pattern.test(event.eventId) ||
        !uuidV4Pattern.test(event.idempotencyKey) ||
        event.idempotencyKey === event.eventId ||
        eventIds.has(event.eventId) ||
        idempotencyKeys.has(event.idempotencyKey) ||
        event.sequence !== index + 1 ||
        event.previousEventHash !== previousEventHash ||
        Date.parse(event.recordedAt) < Date.parse(event.occurredAt) ||
        !hasExactKeys(event.privacy, Object.keys(canonicalPrivacy)) ||
        !Object.entries(canonicalPrivacy).every(([key, value]) => event.privacy[key] === value) ||
        !hasExactKeys(event.governance, Object.keys(canonicalGovernance)) ||
        !Object.entries(canonicalGovernance).every(([key, value]) => event.governance[key] === value)
      ) return false;
      const expectedContextKeys = [...registerEntry.requiredContext, ...(registerEntry.optionalContext || [])];
      if (!hasExactKeys(event.context, expectedContextKeys)) return false;
      if (index > 0 && event.context.causationEventId !== exampleEvents[index - 1].eventId) return false;
      const attributeKeys = Object.keys(event.attributes);
      if (
        !registerEntry.requiredAttributes.every((key) => attributeKeys.includes(key)) ||
        attributeKeys.some((key) => ![...registerEntry.requiredAttributes, ...(registerEntry.optionalAttributes || [])].includes(key))
      ) return false;
      const matchingActivity = registerEntry.activities.some((activity) => Boolean(
        activity.kind === event.activity.kind &&
        activity.id === event.activity.id &&
        activity.version === event.activity.version &&
        (!activity.skill || activity.skill === event.attributes.skill)
      ));
      if (!matchingActivity) return false;
      const withoutHash = { ...event };
      delete withoutHash.eventHash;
      if (event.eventHash !== sha256(runtime.canonicalJson(withoutHash))) return false;
      eventIds.add(event.eventId);
      idempotencyKeys.add(event.idempotencyKey);
      previousEventHash = event.eventHash;
    }
    const practiceEvent = exampleEvents.find((event) => event.eventType === "practice_attempt.finalized");
    const retestEvent = exampleEvents.find((event) => event.eventType === "retest.completed");
    const completedEvent = exampleEvents.find((event) => event.eventType === "learning_cycle.completed");
    const schemaNegatives = [
      { ...exampleEvents[0], ledgerProtocolVersion: "forbidden_legacy_field" },
      {
        ...practiceEvent,
        attributes: { ...practiceEvent.attributes, outcome: "matched" },
      },
      {
        ...retestEvent,
        attributes: { ...retestEvent.attributes, skill: "Balanced" },
      },
      {
        ...retestEvent,
        context: Object.fromEntries(Object.entries(retestEvent.context).filter(([key]) => key !== "humanReviewReceiptId")),
      },
    ];
    return Boolean(
      learningEventSchema["$schema"] === "https://json-schema.org/draft/2020-12/schema" &&
      learningEventSchema.additionalProperties === false &&
      JSON.stringify(learningEventSchema.required) === JSON.stringify(canonicalLearningEventKeys) &&
      !Object.prototype.hasOwnProperty.call(learningEventSchema.properties, "ledgerProtocolVersion") &&
      JSON.stringify(schemaTypes) === JSON.stringify(expectedLearningEventTypes) &&
      JSON.stringify(registerTypes) === JSON.stringify(expectedLearningEventTypes) &&
      JSON.stringify(learningEventRegister.envelope) === JSON.stringify(canonicalLearningEventKeys) &&
      learningEventRegister.contractId === "sufeiya.learning-event.v2" &&
      learningEventRegister.schemaVersion === 2 &&
      learningEventRegister.schemaPath === "data/learning-event.schema.v2.json" &&
      learningEventRegister.examplesPath === "data/learning-event-examples.v2.json" &&
      hasExactKeys(learningEventRegister.privacy, Object.keys(canonicalPrivacy)) &&
      Object.entries(canonicalPrivacy).every(([key, value]) => learningEventRegister.privacy[key] === value) &&
      hasExactKeys(learningEventRegister.governance, Object.keys(canonicalGovernance)) &&
      Object.entries(canonicalGovernance).every(([key, value]) => learningEventRegister.governance[key] === value) &&
      learningEventRegister.subjectPolicy.subjectType === "anonymous_installation" &&
      learningEventRegister.subjectPolicy.identityAssurance === "local_random_alias" &&
      learningEventRegister.subjectPolicy.assignedBy === "local_runtime_csprng" &&
      learningEventRegister.subjectPolicy.accountBinding === "forbidden" &&
      learningEventRegister.ordering.activationPolicy.firstObservedEventMayBeAnyAllowlistedType === true &&
      learningEventRegister.ordering.activationPolicy.historicalBackfillAllowed === false &&
      learningEventRegister.ordering.repeatable.length === 1 &&
      learningEventRegister.ordering.repeatable[0] === "practice_attempt.finalized" &&
      learningEventRegister.integrity.failureBehavior.includes("reject_event_only_valid_backup_when_corrupt") &&
      learningEventRegister.integrity.failureBehavior.includes("allow_user_initiated_full_raw_quarantine_export") &&
      learningEventExamples.contractId === "sufeiya.learning-event.v2" &&
      learningEventExamples.schemaVersion === 2 &&
      learningEventExamples.ledgerExpectation.eventCount === 6 &&
      learningEventExamples.ledgerExpectation.backupGovernance === "local_user_backup_only_not_lrs_exportable" &&
      exampleEvents.length === 6 &&
      eventIds.size === 6 &&
      idempotencyKeys.size === 6 &&
      previousEventHash === "944593a6245b9fc2485d970fb4b3a715ef724829b348476d35a05536e84457f9" &&
      practiceEvent.attributes.skill === "Listening" &&
      practiceEvent.attributes.outcome === "needs_retry" &&
      practiceEvent.attributes.evidenceType === "single_task_needs_retry" &&
      practiceEvent.attributes.evidenceStatus === "evidence_insufficient" &&
      retestEvent.attributes.skill === "Listening" &&
      retestEvent.attributes.evidenceSufficiency === "insufficient_audio_conditions" &&
      retestEvent.attributes.humanConfirmationStatus === "completed" &&
      uuidV4Pattern.test(retestEvent.context.humanReviewReceiptId) &&
      completedEvent.attributes.nextFocusSkill === "Balanced" &&
      completedEvent.attributes.humanConfirmationStatus === "completed" &&
      completedEvent.context.humanReviewReceiptId === retestEvent.context.humanReviewReceiptId &&
      schemaNegatives.every((event) => !learningEventSchemaValidator(event))
    );
  },
);

await checkExecutableAsync(
  "actual Listening-insufficient human-reviewed Balanced runtime events all satisfy the canonical schema",
  async () => {
    if (!learningEventSchemaValidator) return false;
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const state = { schemaVersion: 1 };
    const fixtures = createListeningHumanReviewedEventFixtures();
    const { outcomes } = await appendLearningEventFixtures(runtime, state, fixtures);
    const validation = await runtime.validateLedger(state);
    const practiceEvent = state.learningEvents.find((event) => event.eventType === "practice_attempt.finalized");
    const retestEvent = state.learningEvents.find((event) => event.eventType === "retest.completed");
    const completionEvent = state.learningEvents.find((event) => event.eventType === "learning_cycle.completed");
    return Boolean(
      outcomes.every((outcome) => outcome.status === "appended") &&
      state.learningEvents.every((event) => learningEventSchemaValidator(event)) &&
      validation.ok &&
      validation.eventCount === 6 &&
      practiceEvent.attributes.skill === "Listening" &&
      practiceEvent.attributes.outcome === "needs_retry" &&
      practiceEvent.attributes.evidenceType === "single_task_needs_retry" &&
      practiceEvent.attributes.evidenceStatus === "evidence_insufficient" &&
      retestEvent.attributes.skill === "Listening" &&
      retestEvent.attributes.evidenceSufficiency === "insufficient_audio_conditions" &&
      retestEvent.attributes.humanConfirmationStatus === "completed" &&
      uuidV4Pattern.test(retestEvent.context.humanReviewReceiptId) &&
      completionEvent.attributes.nextFocusSkill === "Balanced" &&
      completionEvent.attributes.humanConfirmationStatus === "completed" &&
      completionEvent.context.humanReviewReceiptId === retestEvent.context.humanReviewReceiptId &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "forward-only activation may begin independently with every post-activation event type",
  async () => {
    for (const fixture of createLearningEventDomainFixtures().events.slice(1)) {
      const { runtime, networkDispatchCount } = createLearningEventsHarness();
      const state = { schemaVersion: 1 };
      const outcome = await runtime.appendDomainEvent(state, ...fixture);
      const validation = await runtime.validateLedger(state);
      if (
        outcome.status !== "appended" ||
        state.learningEvents.length !== 1 ||
        state.learningEvents[0].eventType !== fixture[0] ||
        state.learningEvents[0].sequence !== 1 ||
        state.learningEvents[0].previousEventHash !== null ||
        Object.prototype.hasOwnProperty.call(state.learningEvents[0].context, "causationEventId") ||
        !validation.ok ||
        validation.eventCount !== 1 ||
        networkDispatchCount() !== 0
      ) return false;
    }
    return true;
  },
);

await checkExecutableAsync(
  "capture timestamps reject future and older-than-five-minute events without mutating local state",
  async () => {
    const cases = [Date.now() + 1_000, Date.now() - (5 * 60 * 1000) - 2_000];
    for (const anchorMs of cases) {
      const { runtime, networkDispatchCount } = createLearningEventsHarness();
      const state = { schemaVersion: 1, sentinel: "unchanged" };
      const before = JSON.stringify(state);
      const fixture = createLearningEventDomainFixtures({ anchorMs }).events[0];
      const outcome = await runtime.appendDomainEvent(state, ...fixture);
      if (
        outcome.status !== "domain_invalid" ||
        outcome.code !== "event_shape_invalid" ||
        JSON.stringify(state) !== before ||
        networkDispatchCount() !== 0
      ) return false;
    }
    return true;
  },
);

await checkExecutableAsync(
  "same-cycle transition and cardinality rules fail closed while repeated distinct practice receipts remain appendable",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const fixtures = createLearningEventDomainFixtures();
    const state = { schemaVersion: 1 };
    const started = await runtime.appendDomainEvent(state, ...fixtures.events[0]);
    if (started.status !== "appended") return false;
    const beforeInvalidTransition = JSON.stringify(state);
    const invalidTransition = await runtime.appendDomainEvent(state, ...fixtures.events[3]);
    if (
      invalidTransition.status !== "domain_invalid" ||
      invalidTransition.code !== "event_transition_invalid" ||
      JSON.stringify(state) !== beforeInvalidTransition
    ) return false;
    const recommendation = await runtime.appendDomainEvent(state, ...fixtures.events[1]);
    if (recommendation.status !== "appended") return false;
    const alternateRecommendation = JSON.parse(JSON.stringify(fixtures.events[1][1]));
    alternateRecommendation.recommendation.recommendationId = "recommendation-event-fixture-alternate";
    alternateRecommendation.recommendation.evidenceBinding.bindingId = "binding-event-fixture-alternate";
    alternateRecommendation.recommendation.createdAt = new Date(Date.now() - 500).toISOString();
    const beforeCardinality = JSON.stringify(state);
    const invalidCardinality = await runtime.appendDomainEvent(
      state,
      "recommendation.decided",
      alternateRecommendation,
    );
    if (
      invalidCardinality.status !== "domain_invalid" ||
      invalidCardinality.code !== "event_cardinality_invalid" ||
      JSON.stringify(state) !== beforeCardinality
    ) return false;
    const firstPractice = await runtime.appendDomainEvent(state, ...fixtures.events[2]);
    if (firstPractice.status !== "appended") return false;
    const secondPracticeDomain = JSON.parse(JSON.stringify(fixtures.events[2][1]));
    secondPracticeDomain.receipt.practiceAttemptId = "55555555-5555-4555-8555-555555555555";
    secondPracticeDomain.receipt.completionReceiptId = "66666666-6666-4666-8666-666666666666";
    secondPracticeDomain.receipt.completedAt = new Date(Date.now() - 250).toISOString();
    const secondPractice = await runtime.appendDomainEvent(
      state,
      "practice_attempt.finalized",
      secondPracticeDomain,
    );
    const validation = await runtime.validateLedger(state);
    return Boolean(
      secondPractice.status === "appended" &&
      secondPractice.event.context.causationEventId === firstPractice.event.eventId &&
      validation.ok &&
      validation.eventCount === 4 &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "semantic replay conflicts never masquerade as idempotent success or mutate the ledger",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const fixtures = createLearningEventDomainFixtures();
    const state = { schemaVersion: 1, businessSentinel: "preserved" };
    const started = await runtime.appendDomainEvent(state, ...fixtures.events[0]);
    const recommendation = await runtime.appendDomainEvent(state, ...fixtures.events[1]);
    if (started.status !== "appended" || recommendation.status !== "appended") return false;

    const conflictingRecommendation = JSON.parse(JSON.stringify(fixtures.events[1][1]));
    conflictingRecommendation.recommendation.status = "skipped";
    const beforeRecommendationConflict = JSON.stringify(state);
    const recommendationConflict = await runtime.appendDomainEvent(
      state,
      "recommendation.decided",
      conflictingRecommendation,
    );
    if (
      recommendationConflict.status !== "idempotency_conflict" ||
      recommendationConflict.code !== "semantic_replay_mismatch" ||
      JSON.stringify(state) !== beforeRecommendationConflict
    ) return false;

    const practice = await runtime.appendDomainEvent(state, ...fixtures.events[2]);
    if (practice.status !== "appended") return false;
    const conflictingPractice = JSON.parse(JSON.stringify(fixtures.events[2][1]));
    conflictingPractice.receipt.evidence.attemptCount = 2;
    const beforePracticeConflict = JSON.stringify(state);
    const practiceConflict = await runtime.appendDomainEvent(
      state,
      "practice_attempt.finalized",
      conflictingPractice,
    );
    return Boolean(
      practiceConflict.status === "idempotency_conflict" &&
      practiceConflict.code === "semantic_replay_mismatch" &&
      JSON.stringify(state) === beforePracticeConflict &&
      state.businessSentinel === "preserved" &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "same-cycle context lineage, receipt aliases, and causal links survive rehash attempts only when continuous",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const fixtures = createLearningEventDomainFixtures();

    const appendMismatchState = { schemaVersion: 1 };
    const started = await runtime.appendDomainEvent(appendMismatchState, ...fixtures.events[0]);
    if (started.status !== "appended") return false;
    const mismatchedRecommendation = JSON.parse(JSON.stringify(fixtures.events[1][1]));
    mismatchedRecommendation.recommendation.diagnosticSessionId = "diagnostic-event-fixture-other";
    mismatchedRecommendation.recommendation.evidenceBinding.diagnosticSessionId = "diagnostic-event-fixture-other";
    const beforeMismatch = JSON.stringify(appendMismatchState);
    const mismatchOutcome = await runtime.appendDomainEvent(
      appendMismatchState,
      "recommendation.decided",
      mismatchedRecommendation,
    );
    if (
      mismatchOutcome.status !== "domain_invalid" ||
      mismatchOutcome.code !== "context_continuity_invalid" ||
      JSON.stringify(appendMismatchState) !== beforeMismatch
    ) return false;

    const baseState = { schemaVersion: 1 };
    const appended = await appendLearningEventFixtures(runtime, baseState, fixtures);
    if (!appended.outcomes.every((outcome) => outcome.status === "appended")) return false;
    const rehash = (candidate) => {
      let previousEventHash = null;
      candidate.learningEvents.forEach((event) => {
        event.previousEventHash = previousEventHash;
        const withoutHash = { ...event };
        delete withoutHash.eventHash;
        event.eventHash = sha256(runtime.canonicalJson(withoutHash));
        previousEventHash = event.eventHash;
      });
    };

    const lineageTamper = JSON.parse(JSON.stringify(baseState));
    const alternateDiagnosticAlias = "33333333-3333-4333-8333-333333333333";
    lineageTamper.learningEventBindings.records.diagnostic["diagnostic-event-fixture-other"] = alternateDiagnosticAlias;
    lineageTamper.learningEvents[1].context.diagnosticSessionId = alternateDiagnosticAlias;
    rehash(lineageTamper);
    const lineageStatus = await runtime.validateLedger(lineageTamper);

    const receiptTamper = JSON.parse(JSON.stringify(baseState));
    const alternateReceiptAlias = "44444444-4444-4444-8444-444444444444";
    receiptTamper.learningEventBindings.records.practiceReceipt["practice-receipt-event-fixture-other"] = alternateReceiptAlias;
    receiptTamper.learningEvents[4].context.baselinePracticeReceiptId = alternateReceiptAlias;
    rehash(receiptTamper);
    const receiptStatus = await runtime.validateLedger(receiptTamper);

    const causeTamper = JSON.parse(JSON.stringify(baseState));
    causeTamper.learningEvents[3].context.causationEventId = causeTamper.learningEvents[1].eventId;
    rehash(causeTamper);
    const causeStatus = await runtime.validateLedger(causeTamper);

    const skillTamper = JSON.parse(JSON.stringify(baseState));
    skillTamper.learningEvents[4].attributes.skill = "Listening";
    skillTamper.learningEvents[4].activity = {
      kind: "retest",
      id: "https://sufeiya.cn/activities/retest/listening-parallel/v1",
      version: "gate_a_local_v1",
    };
    rehash(skillTamper);
    const skillStatus = await runtime.validateLedger(skillTamper);

    const humanStatusTamper = JSON.parse(JSON.stringify(baseState));
    const humanReviewAlias = "55555555-5555-4555-8555-555555555555";
    humanStatusTamper.learningEventBindings.records.humanReviewReceipt["human-review-event-fixture"] = humanReviewAlias;
    humanStatusTamper.learningEvents[5].attributes.humanConfirmationStatus = "completed";
    humanStatusTamper.learningEvents[5].context.humanReviewReceiptId = humanReviewAlias;
    rehash(humanStatusTamper);
    const humanStatus = await runtime.validateLedger(humanStatusTamper);

    return Boolean(
      !lineageStatus.ok &&
      lineageStatus.code === "context_continuity_invalid" &&
      !receiptStatus.ok &&
      receiptStatus.code === "context_continuity_invalid" &&
      !causeStatus.ok &&
      causeStatus.code === "causation_event_invalid" &&
      !skillStatus.ok &&
      skillStatus.code === "retest_skill_continuity_invalid" &&
      !humanStatus.ok &&
      humanStatus.code === "human_confirmation_transition_invalid" &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "learning-event validation fails closed on hash, sequence, subject, context, and unknown-field tampering",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const state = { schemaVersion: 1 };
    const fixtures = createLearningEventDomainFixtures();
    const { outcomes } = await appendLearningEventFixtures(runtime, state, fixtures);
    if (!outcomes.every((outcome) => outcome.status === "appended")) return false;
    const cloneState = () => JSON.parse(JSON.stringify(state));
    const cases = [
      {
        expectedCode: "ledger_hash_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].eventHash = "0".repeat(64); },
      },
      {
        expectedCode: "ledger_sequence_invalid",
        mutate: (candidate) => { candidate.learningEvents[1].sequence = 99; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].subject.subjectId = "anon_33333333-3333-4333-8333-333333333333"; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].context.learningCycleId = "44444444-4444-4444-8444-444444444444"; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].unknownField = true; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[1].idempotencyKey = candidate.learningEvents[0].idempotencyKey; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].privacy.containsFreeText = true; },
      },
      {
        expectedCode: "ledger_shape_invalid",
        mutate: (candidate) => { candidate.learningEvents[0].governance.networkDispatch = "enabled"; },
      },
    ];
    for (const candidateCase of cases) {
      const candidate = cloneState();
      candidateCase.mutate(candidate);
      const result = await runtime.validateLedger(candidate);
      if (result.ok || result.code !== candidateCase.expectedCode) return false;
    }
    const tampered = cloneState();
    tampered.learningEvents[0].eventHash = "0".repeat(64);
    const tamperedBefore = JSON.stringify(tampered);
    const rejectedAppend = await runtime.appendDomainEvent(tampered, ...fixtures.events[0]);
    if (rejectedAppend.status !== "ledger_invalid" || JSON.stringify(tampered) !== tamperedBefore) return false;
    const unknownState = { schemaVersion: 1, sentinel: "unchanged" };
    const unknownBefore = JSON.stringify(unknownState);
    const unknownOutcome = await runtime.appendDomainEvent(unknownState, "xapi.statement.sent", {});
    return Boolean(
      unknownOutcome.status === "domain_invalid" &&
      JSON.stringify(unknownState) === unknownBefore &&
      networkDispatchCount() === 0
    );
  },
);

await checkExecutableAsync(
  "targeted learning-event clear empties and validates the chain while preserving every non-ledger field",
  async () => {
    const { runtime, networkDispatchCount } = createLearningEventsHarness();
    const state = {
      schemaVersion: 1,
      plan: { planId: "plan-preserved" },
      practiceReceipts: { receipt: { completionReceiptId: "receipt-preserved" } },
      checkIns: { today: { checkInId: "check-in-preserved" } },
      retestSentinel: { retestId: "retest-preserved" },
      sofiaConversationSentinel: { turns: ["preserved-separate-namespace"] },
    };
    const appended = await appendLearningEventFixtures(runtime, state);
    if (!appended.outcomes.every((outcome) => outcome.status === "appended")) return false;
    const nonLedgerBefore = JSON.stringify(Object.fromEntries(
      Object.entries(state).filter(([key]) => !["learningEvents", "learningEventBindings"].includes(key)),
    ));
    runtime.clearFromState(state);
    const nonLedgerAfter = JSON.stringify(Object.fromEntries(
      Object.entries(state).filter(([key]) => !["learningEvents", "learningEventBindings"].includes(key)),
    ));
    const validation = await runtime.validateLedger(state);
    return Boolean(
      Array.isArray(state.learningEvents) &&
      state.learningEvents.length === 0 &&
      state.learningEventBindings === null &&
      nonLedgerAfter === nonLedgerBefore &&
      validation.ok &&
      validation.eventCount === 0 &&
      validation.headHash === null &&
      networkDispatchCount() === 0
    );
  },
);

check(
  !/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\s*\(/.test(learningEventsScript) &&
    !/\b(?:Authorization|Bearer|client_secret|api[_-]?key|access[_-]?token|lrs[_-]?(?:endpoint|key|secret|username|password)|xapi[_-]?(?:endpoint|key|secret|username|password))\b/i.test(learningEventsScript) &&
    /networkDispatch:\s*"disabled"/.test(learningEventsScript) &&
    /lrsDispatch:\s*"disabled"/.test(learningEventsScript) &&
    /xapiDispatch:\s*"disabled"/.test(learningEventsScript) &&
    /sofiaAccess:\s*"forbidden"/.test(learningEventsScript) &&
    /exportEligibility:\s*EXPORT_ELIGIBILITY/.test(learningEventsScript),
  "learning-event runtime contains no LRS/xAPI network dispatch or credential path and declares local-backup-only governance",
);

const classicRuntimePages = [...runtimePageSources.entries()].filter(([, html]) =>
  /src="\/(?:workspace|journey)\.js"/.test(html),
);
check(
  classicRuntimePages.length > 0 && classicRuntimePages.every(([, html]) => {
    const learningIndex = html.indexOf('src="/learning-events.js"');
    const businessIndices = [html.indexOf('src="/workspace.js"'), html.indexOf('src="/journey.js"')]
      .filter((index) => index >= 0);
    return learningIndex >= 0 && businessIndices.every((index) => learningIndex < index);
  }) &&
    /id="sufeiya-learning-events-runtime"[\s\S]*src="\/learning-events\.js"[\s\S]*strategy="beforeInteractive"/.test(
      rootLayout,
    ) &&
    /id="sufeiya-workspace-runtime" src="\/workspace\.js" strategy="afterInteractive"/.test(legacyPageComponent) &&
    /id="sufeiya-journey-runtime" src="\/journey\.js" strategy="afterInteractive"/.test(legacyPageComponent),
  "classic pages load learning-events first while Next loads it beforeInteractive ahead of afterInteractive business runtimes",
);

const practiceFinalizationBoundarySource = sourceSection(
  workspaceScript,
  "const appendPracticeFinalizationEvent",
  "const disableWorkspaceControls",
);
check(
  /if \(!receipt\?\.cycleId\) return \{ status: "not_applicable" \}/.test(practiceFinalizationBoundarySource) &&
    /appendLearningEvent\("practice_attempt\.finalized", \{[\s\S]*receipt,[\s\S]*recommendation: state\.journey\?\.recommendation/.test(
      practiceFinalizationBoundarySource,
    ) &&
    (workspaceScript.match(/\["appended", "already_recorded", "not_applicable"\]\.includes\(eventOutcome\.status\)/g) || []).length === 3,
  "standalone practice persists as not_applicable while cycle-bound practice appends a recommendation-bound event",
);

check(
  eventAppendTransactionsAreAtomic(workspaceScript, "practice_attempt.finalized") &&
    eventAppendTransactionsAreAtomic(workspaceScript, "check_in.committed") &&
    eventAppendTransactionsAreAtomic(journeyScript, "learning_cycle.started") &&
    eventAppendTransactionsAreAtomic(journeyScript, "recommendation.decided") &&
    eventAppendTransactionsAreAtomic(journeyScript, "retest.completed") &&
    eventAppendTransactionsAreAtomic(journeyScript, "learning_cycle.completed"),
  "each business mutation appends its learning event before the same persist and rolls back event or persistence failure",
);

const learnerContextContractSource = sourceSection(
  superTeacherContracts,
  "export const learnerContextSchema",
  "export const teacherIntentSchema",
);
check(
  !/learningEvents|learningEventBindings/.test(superTeacherLocalContext) &&
    !/learningEvents|learningEventBindings/.test(superTeacherLocalGrounding) &&
    !/learningEvents|learningEventBindings/.test(learnerContextContractSource) &&
    /buildLocalGroundingBundle\(decision\.intent, currentContext\)/.test(superTeacherSessionProvider) &&
    /learnerContextSchema[\s\S]*?\.strict\(\)[\s\S]*?superTeacherRequestSchema[\s\S]*?\.strict\(\)/.test(
      learnerContextContractSource,
    ),
  "Sofia derives a strict browser-local allowlisted context that cannot include learningEvents or learningEventBindings sentinels",
);

const myDataSummarySource = sourceSection(
  workspaceScript,
  "const updateDataPage",
  'document.querySelectorAll("[data-export-workspace]")',
);
const fullLocalExportSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-export-workspace]")',
  'document.querySelectorAll("[data-export-learning-events]")',
);
const learningEventExportSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-export-learning-events]")',
  'document.querySelectorAll("[data-clear-learning-events]")',
);
const learningEventClearSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-clear-learning-events]")',
  'document.querySelectorAll("[data-clear-workspace]")',
);
check(
  /data-export-learning-events/.test(myDataPage) &&
    /data-clear-learning-events/.test(myDataPage) &&
    /不是 LRS 或 xAPI 导出/.test(myDataPage) &&
    /const updateDataPage = async \(\)/.test(myDataSummarySource) &&
    /learningLedgerStatus\.ok && learningEventsRuntime[\s\S]*await learningEventsRuntime\.summarize\(state\)/.test(
      myDataSummarySource,
    ) &&
    /本机学习事件[\s\S]*learningEventSummary\.status === "ready"[\s\S]*eventCount[\s\S]*事件链完整性[\s\S]*headHash/.test(
      myDataSummarySource,
    ) &&
    /await updateDataPage\(\)/.test(workspaceScript),
  "My Data exposes learning-event summary, chain validation status, event-only export, and targeted clear",
);
check(
  /learningEventGovernance:[\s\S]*contractId:[\s\S]*local_user_backup_only_not_lrs_exportable[\s\S]*lrsOrXapiExport:\s*false/.test(
    fullLocalExportSource,
  ) &&
    /createLocalBackup\(state\)/.test(learningEventExportSource) &&
    /不是 LRS 或 xAPI 导出/.test(learningEventExportSource) &&
    /clearFromState\(state\)[\s\S]*localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(state\)\)/.test(
      learningEventClearSource,
    ) &&
    /const before = snapshotState\(\)[\s\S]*catch \{[\s\S]*state = before/.test(learningEventClearSource) &&
    /计划、练习回执、打卡、复测、Sofia智能老师对话与教研复核演示草稿都会保留/.test(learningEventClearSource),
  "My Data keeps learning-event export local-user-backup-only and targeted clear transactional and namespace-preserving",
);

const workspaceControlPolicySource = sourceSection(
  workspaceScript,
  "const disableWorkspaceControls",
  "const pad",
);
const workspaceRecoveryGateSource = sourceSection(
  workspaceScript,
  "let learningLedgerStatus",
  'document.querySelectorAll("[data-today-date]")',
);
const workspaceClearSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-clear-workspace]")',
  'document.querySelectorAll("[data-clear-super-teacher]")',
);
const superTeacherClearSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-clear-super-teacher]")',
  'document.querySelectorAll("[data-clear-teaching-review-demo]")',
);
const teachingReviewClearSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-clear-teaching-review-demo]")',
  'document.querySelectorAll("[data-clear-all-sufeiya]")',
);
const clearAllSufeiyaSource = sourceSection(
  workspaceScript,
  'document.querySelectorAll("[data-clear-all-sufeiya]")',
  'window.addEventListener("storage"',
);
const recoveryLockSource = sourceSection(
  workspaceScript,
  "const withWorkspaceRecoveryLock",
  "const appendLearningEvent",
);
check(
  /const allowedSelectors = \[[\s\S]*?"\[data-export-workspace\]"[\s\S]*?"\[data-workspace-backup-file\]"[\s\S]*?"\[data-restore-workspace-backup\]"[\s\S]*?\];/.test(workspaceControlPolicySource) &&
    /if \(allowEventExport\)[\s\S]*data-export-learning-events/.test(workspaceControlPolicySource) &&
    /if \(allowEventClear\)[\s\S]*data-clear-learning-events/.test(workspaceControlPolicySource) &&
    /if \(allowDataReset\)[\s\S]*data-clear-workspace[\s\S]*data-clear-super-teacher[\s\S]*data-clear-teaching-review-demo[\s\S]*data-clear-all-sufeiya/.test(
      workspaceControlPolicySource,
    ) &&
    /if \(!workspaceStateRecognized\) \{[\s\S]*allowDataReset:\s*true/.test(workspaceRecoveryGateSource) &&
    /eventRecoveryAvailable = workspaceStateRecognized && Boolean\(learningEventsRuntime\)[\s\S]*allowEventExport: eventRecoveryAvailable[\s\S]*allowEventClear: eventRecoveryAvailable[\s\S]*allowDataReset:\s*true/.test(
      workspaceRecoveryGateSource,
    ),
  "read-only recovery keeps full export and explicit resets available while unknown state disables event-only operations",
);
check(
  /workspaceWriterLeaseAvailable[\s\S]*navigator\.locks\.request\(`\$\{STORAGE_KEY\}:sealed-write`, \{ mode: "exclusive" \}/.test(
    recoveryLockSource,
  ) &&
    /navigator\.locks\.request\(`\$\{SUPER_TEACHER_STORAGE_KEY\}:write`, \{ mode: "exclusive" \}/.test(
      recoveryLockSource,
    ) &&
    /navigator\.locks\.request\(`\$\{TEACHING_REVIEW_DEMO_STORAGE_KEY\}:write`, \{ mode: "exclusive" \}/.test(
      recoveryLockSource,
    ) &&
    /!workspaceStateRecognized \|\| !workspaceWriterLeaseAvailable \|\| !learningEventsRuntime/.test(
      learningEventClearSource,
    ) &&
    /navigator\.locks\.request\(`\$\{STORAGE_KEY\}:sealed-write`/.test(learningEventClearSource),
  "event recovery requires the held page-writer lease and the sealed workspace lock",
);
check(
  /const outcome = await withWorkspaceRecoveryLock\(\(\) => \{[\s\S]*localStorage\.removeItem\(STORAGE_KEY\)[\s\S]*status: "cleared"[\s\S]*status: "clear_failed"/.test(
    workspaceClearSource,
  ) &&
    /if \(outcome\.status !== "cleared"\)[\s\S]*原始本机数据保持不变[\s\S]*return;[\s\S]*state = freshState\(\)[\s\S]*window\.location\.reload\(\)/.test(
      workspaceClearSource,
    ),
  "workspace clear is sealed-lock protected and cannot reset memory or reload after deletion failure",
);
check(
  /const outcome = await withSuperTeacherWriteLock\(\(\) => \{[\s\S]*localStorage\.removeItem\(SUPER_TEACHER_STORAGE_KEY\)[\s\S]*status: "cleared"[\s\S]*status: "clear_failed"/.test(
    superTeacherClearSource,
  ) &&
    /if \(outcome\.status !== "cleared"\)[\s\S]*return;[\s\S]*window\.location\.reload\(\)/.test(
      superTeacherClearSource,
    ),
  "Sofia-only clear uses the Sofia write lock and cannot reload after lock or deletion failure",
);
check(
  /const outcome = await withTeachingReviewDemoWriteLock\(\(\) => \{[\s\S]*localStorage\.removeItem\(TEACHING_REVIEW_DEMO_STORAGE_KEY\)[\s\S]*status: "cleared"[\s\S]*status: "clear_failed"/.test(
    teachingReviewClearSource,
  ) &&
    /if \(outcome\.status !== "cleared"\)[\s\S]*原始本机数据保持不变[\s\S]*return;[\s\S]*window\.location\.reload\(\)/.test(
      teachingReviewClearSource,
    ),
  "teaching-review-only clear uses its independent write lock and cannot reload after failure",
);
check(
  /withWorkspaceRecoveryLock\(\(\) => withSuperTeacherWriteLock\(\(\) => withTeachingReviewDemoWriteLock\(\(\) => \{/.test(clearAllSufeiyaSource) &&
    clearAllSufeiyaSource.indexOf("withWorkspaceRecoveryLock") < clearAllSufeiyaSource.indexOf("withSuperTeacherWriteLock") &&
    clearAllSufeiyaSource.indexOf("withSuperTeacherWriteLock") < clearAllSufeiyaSource.indexOf("withTeachingReviewDemoWriteLock") &&
    /\[STORAGE_KEY, window\.localStorage\.getItem\(STORAGE_KEY\)\][\s\S]*\[SUPER_TEACHER_STORAGE_KEY, window\.localStorage\.getItem\(SUPER_TEACHER_STORAGE_KEY\)\][\s\S]*\[TEACHING_REVIEW_DEMO_STORAGE_KEY, window\.localStorage\.getItem\(TEACHING_REVIEW_DEMO_STORAGE_KEY\)\][\s\S]*removeItem\(STORAGE_KEY\)[\s\S]*removeItem\(SUPER_TEACHER_STORAGE_KEY\)[\s\S]*removeItem\(TEACHING_REVIEW_DEMO_STORAGE_KEY\)/.test(
      clearAllSufeiyaSource,
    ) &&
    /for \(const \[key, before\] of snapshots\)[\s\S]*before === null[\s\S]*setItem\(key, before\)[\s\S]*rollbackFailed = true[\s\S]*rollback_failed/.test(
      clearAllSufeiyaSource,
    ) &&
    /outcome\.status === "rollback_failed"[\s\S]*停止继续写入[\s\S]*return;[\s\S]*state = freshState\(\)/.test(
      clearAllSufeiyaSource,
    ),
  "clear-all acquires workspace, Sofia, then teaching-review locks and independently restores all three namespaces on partial failure",
);

const resolveLocalPath = (urlPath) => {
  const clean = urlPath.split("#")[0].split("?")[0];
  if (clean === "/") return "index.html";
  const relative = clean.replace(/^\/+/, "");
  if (relative.includes(".")) return relative;
  return `${relative}.html`;
};

for (const [filename, pageKey, canonicalPath] of pageFiles) {
  const html = await read(filename);
  const prefix = `${filename}:`;
  check((html.match(/<h1\b/gi) || []).length === 1, `${prefix} exactly one h1`);
  check(/<html\s+lang="zh-CN"/i.test(html), `${prefix} document language is zh-CN`);
  check(new RegExp(`<body data-page="${pageKey}"`).test(html), `${prefix} declares its page identity`);
  check(/<meta\s+name="description"/i.test(html), `${prefix} meta description is present`);
  check(
    html.includes(`<link rel="canonical" href="https://sufeiya.cn${canonicalPath}"`),
    `${prefix} canonical URL is correct`,
  );
  check(/<a class="skip-link" href="#main-content"/i.test(html), `${prefix} keyboard skip link is present`);
  check(/id="main-content"/.test(html), `${prefix} skip-link target exists`);
  check(/aria-controls="mobile-nav"/.test(html), `${prefix} mobile navigation control is labelled`);
  check(!/href="#"/.test(html), `${prefix} has no empty hash links`);
  check(!/\b(TODO|FIXME)\b/i.test(html), `${prefix} has no unfinished marker copy`);
  check(/src="\/assets\/sufeiya-logo\.png" width="2792" height="560"/.test(html), `${prefix} uses the HD logo dimensions`);
  check(/href="\/assets\/sufeiya-mark\.png"/.test(html), `${prefix} uses the official mark favicon`);

  const desktopNavMatch = html.match(/<nav class="desktop-nav"[\s\S]*?<\/nav>/i);
  check(Boolean(desktopNavMatch), `${prefix} desktop navigation exists`);
  if (desktopNavMatch) {
    const targets = [...desktopNavMatch[0].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    check(
      JSON.stringify(targets) === JSON.stringify(expectedNavTargets),
      `${prefix} four navigation buttons each target a distinct page`,
    );
    check(!/(THE|LEARNING|PLATFORM|RESOURCES|ABOUT)\b/.test(desktopNavMatch[0]), `${prefix} navigation labels are Chinese`);
  }

  if (expectedNavTargets.includes(canonicalPath)) {
    check(
      new RegExp(`data-page-link="${pageKey}"[^>]*(?:aria-current="page"|class="is-active")|aria-current="page"[^>]*data-page-link="${pageKey}"`).test(
        html,
      ),
      `${prefix} current page is identified in desktop navigation`,
    );
  }

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const internalAnchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  for (const anchor of internalAnchors) {
    check(ids.has(anchor), `${prefix} internal anchor #${anchor} resolves`);
  }

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < headings.length; index += 1) {
    check(headings[index] - headings[index - 1] <= 1, `${prefix} heading levels do not skip`);
  }

  const externalTags = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map((match) => match[0]);
  for (const tag of externalTags) {
    check(/rel="[^"]*noopener[^"]*noreferrer[^"]*"/i.test(tag), `${prefix} new-window link is isolated`);
  }

  const localUrls = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of localUrls) {
    const cleanUrl = url.split("#")[0].split("?")[0];
    const path = nextOnlyTargets.get(cleanUrl) ?? resolveLocalPath(url);
    try {
      await access(join(root, path));
      passes.push(`${prefix} local target ${url} exists`);
    } catch {
      failures.push(`${prefix} missing local target ${url} (${path})`);
    }
  }
}

check(!/\b(innerHTML|eval\s*\()/.test(script), "client script avoids unsafe DOM injection and eval");
check(!/\b(innerHTML|eval\s*\()/.test(workspaceScript), "workspace script avoids unsafe DOM injection and eval");
check(!/\b(innerHTML|eval\s*\()/.test(journeyScript), "journey script avoids unsafe DOM injection and eval");
check(!/\b(innerHTML|eval\s*\()/.test(resourcesScript), "resource script avoids unsafe DOM injection and eval");
check(/event\.key === "Tab"/.test(script), "mobile navigation includes keyboard focus containment");
check(/event\.key === "Escape"/.test(script), "mobile navigation supports Escape");
check(/prefers-reduced-motion:\s*reduce/.test(styles), "reduced-motion preference is supported");
check(/:focus-visible/.test(styles), "visible keyboard focus style is present");
check(/\.hero\s*\{[\s\S]*linear-gradient\(135deg,\s*#fffdf7/i.test(styles), "home hero uses a light background");
check(!/hero-orbit|page-hero-orbit/.test(styles), "navigation-adjacent hero styles contain no decorative orbit lines");
check(!/\.learning-plate::before/.test(styles), "home learning card contains no decorative arc line");
check(!/\.about::after/.test(styles), "yellow about section contains no decorative fan-shaped arc line");
check(/\.system\s*\{[\s\S]*background:\s*var\(--color-sage\)/i.test(styles), "platform section uses a light sage background");
check(/中文讲解[\s\S]*英文材料/.test(await read("resources.html")), "resources page states the Chinese UI and English materials rule");
check(/胡冬品博士（Dr\. Peter Hu）/.test(await read("about.html")), "confirmed Dr. Peter Hu public name is present");
check(/苏肥鸭老师（Sofia）/.test(await read("about.html")), "confirmed Sofia public name is present");

const workspace = await read("workspace.html");
check(!/id="plan-form"/.test(workspace), "workspace is an entry page and does not embed the plan form");
check(!/name="reading-answer"/.test(workspace), "workspace does not embed an English exercise");
check(!/data-focus-time/.test(workspace), "workspace does not embed the focus timer");
check(!/id="checkin-form"/.test(workspace), "workspace does not embed the check-in form");
const journeyTargets = [...workspace.matchAll(/class="journey-grid"[\s\S]*?<\/ol>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(journeyTargets) ===
    JSON.stringify(["/diagnostic", "/plan", "/recommendations", "/check-in", "/review", "/community", "/retest"]),
  "workspace has seven ordered journey buttons targeting seven functions",
);
const workspaceToolTargets = [...workspace.matchAll(/class="workspace-launch-grid workspace-support-grid"[\s\S]*?<\/div>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(workspaceToolTargets) === JSON.stringify(["/super-teacher", "/today", "/practice", "/focus", "/teaching-review-demo", "/my-data"]),
  "workspace keeps Sofia, the teaching-review demo, and four supporting tools separate from the journey",
);
const cycleLedgerSection = workspace.match(/<section class="cycle-ledger-section[\s\S]*?<\/section>/)?.[0] || "";
const cycleLedgerRows = [...cycleLedgerSection.matchAll(/data-cycle-ledger-row="([^"]+)"/g)].map((match) => match[1]);
check(
  JSON.stringify(cycleLedgerRows) === JSON.stringify([
    "diagnostic",
    "plan",
    "recommendation",
    "checkin",
    "review",
    "peerHelp",
    "retest",
    "updatedPlan",
  ]),
  "workspace exposes the approved diagnostic-to-updated-plan receipt chain in order",
);
check(
  /data-cycle-ledger-status[^>]*aria-live="polite"/.test(cycleLedgerSection) &&
    /diagnostic_session_id[\s\S]*plan_id[\s\S]*recommendation_id[\s\S]*check_in_id[\s\S]*review_id[\s\S]*peer_help_id \/ status[\s\S]*retest_id[\s\S]*updated_plan_id/.test(cycleLedgerSection) &&
    /未签名演示回执/.test(cycleLedgerSection) &&
    !/(?:作文|首答|打卡自由文本|聊天内容)<\/code>/.test(cycleLedgerSection),
  "cycle receipt overview is accessible, complete, and explicitly excludes learner free text",
);
const cycleHistorySection = workspace.match(/<section class="cycle-history-section[\s\S]*?<\/section>/)?.[0] || "";
check(
  /aria-labelledby="cycle-history-title"/.test(cycleHistorySection) &&
    /data-cycle-history-summary[^>]*aria-live="polite"/.test(cycleHistorySection) &&
    /<ol class="cycle-history-list"[^>]*aria-label="已核对的 Gate A 本机轮次历史"/.test(cycleHistorySection) &&
    /最近 10 轮/.test(cycleHistorySection) &&
    /完成本机闭环与“待具备资格人员复核”是两个不同状态/.test(cycleHistorySection) &&
    /姓名、考试日、作文与首答、打卡自由文本、Sofia 对话和账户标识不会进入历史视图/.test(cycleHistorySection),
  "workspace cycle history is accessible, bounded, read-only, and explicit about privacy and review status",
);
const gate0Section = workspace.match(/<section class="gate0-section[\s\S]*?<\/section>/)?.[0] || "";
check(
  workspace.indexOf('class="cycle-ledger-section') < workspace.indexOf('class="gate0-section') &&
    workspace.indexOf('class="cycle-ledger-section') < workspace.indexOf('class="cycle-history-section') &&
    workspace.indexOf('class="cycle-history-section') < workspace.indexOf('class="gate0-section') &&
    workspace.indexOf('class="gate0-section') < workspace.indexOf('class="source-admission-section') &&
    workspace.indexOf('class="source-admission-section') < workspace.indexOf('class="workspace-launch section'),
  "workspace places cycle history after the current receipt and Gate 0 plus source admission before supporting tools",
);
check(
  /aria-labelledby="gate0-title"/.test(gate0Section) &&
    /data-gate0-status[^>]*aria-live="polite"/.test(gate0Section) &&
    /<progress data-gate0-progress max="29"[^>]*aria-label="已形成逐项书面结论"/.test(gate0Section) &&
    /登录成功、页面可访问、模型或功能代码已经配置，都不属于批准证据/.test(gate0Section) &&
    /完整 Decision Log 需要独立 staff RBAC 才能查看/.test(gate0Section),
  "Gate 0 summary is accessible, fail-closed, and separates login, implementation, staff access, and approval",
);
check(
  /\.gate0-boundary-card > p \{[\s\S]*?color: var\(--color-ink-soft\);/.test(styles) &&
    contrastRatio([33, 68, 63], compositeRgb([244, 183, 64], [248, 245, 237], 0.1)) >= 4.5,
  "Gate 0 boundary copy maintains WCAG AA text contrast on its composited card background",
);
check(
  /const GATE0_STATUS_PATH = "\/api\/governance\/status"/.test(journeyScript) &&
    /credentials: "same-origin"[\s\S]*cache: "no-store"[\s\S]*redirect: "error"/.test(journeyScript) &&
    /responseUrl\.origin !== window\.location\.origin[\s\S]*responseUrl\.pathname !== GATE0_STATUS_PATH/.test(journeyScript) &&
    /raw\.length === 0 \|\| raw\.length > 20000/.test(journeyScript) &&
    /parseGate0PublicSummary\(body\.p0Gate\)/.test(journeyScript) &&
    /status\.textContent = "暂时无法核对 Gate 0 注册表"/.test(journeyScript) &&
    /formalGate0Pass !== false/.test(journeyScript),
  "workspace fetches only the bounded same-origin sanitized Gate 0 summary and fails closed on invalid data",
);
const sourceAdmissionSection = workspace.match(/<section class="source-admission-section[\s\S]*?<\/section>/)?.[0] || "";
const sourceAdmissionCriteria = [...sourceAdmissionSection.matchAll(/data-source-criterion="([^"]+)"/g)].map((match) => match[1]);
check(
  /aria-labelledby="source-admission-title"/.test(sourceAdmissionSection) &&
    /data-source-governance-status[^>]*aria-live="polite"/.test(sourceAdmissionSection) &&
    JSON.stringify(sourceAdmissionCriteria) === JSON.stringify([
      "teacher-reviewed",
      "rag-rights",
      "exam-version",
      "explicit-rag",
      "no-safety-flags",
    ]) &&
    /五项核心决定不是完整 Gate/.test(sourceAdmissionSection) &&
    /目录覆盖完整、可审核正文或转写就绪/.test(sourceAdmissionSection) &&
    /六项逐决定证据绑定/.test(sourceAdmissionSection) &&
    /五项计数只表示登记字段的声明状态，不表示证据已经核验/.test(sourceAdmissionSection) &&
    /归档记录继续整体阻断/.test(sourceAdmissionSection) &&
    /RAG 准入与 Gate A 的确定性静态解释是不同状态/.test(sourceAdmissionSection),
  "workspace source-admission view is accessible and separates static, link-only, archived, and RAG states",
);
check(
  /const SOURCE_GOVERNANCE_PROTOCOL_VERSION = "sufeiya_content_governance_v2"/.test(journeyScript) &&
    /parseSourceGovernancePublicSummary\(body\.sourceGovernance\)/.test(journeyScript) &&
    /candidate\.trackedRecords !== 15/.test(journeyScript) &&
    /candidate\.blockedArchiveRecords !== 655/.test(journeyScript) &&
    /candidate\.ragBlocked !== candidate\.trackedRecords - candidate\.ragEligible/.test(journeyScript) &&
    /status\.textContent = "暂时无法核对来源准入登记"/.test(journeyScript),
  "workspace validates the exact sanitized source-governance protocol and fails closed on count drift",
);
check(
  contrastRatio([255, 255, 255], [16, 44, 41]) >= 4.5 &&
    contrastRatio(compositeRgb([255, 255, 255], [16, 44, 41], 0.78), [16, 44, 41]) >= 4.5 &&
    /@media \(max-width: 620px\) \{[\s\S]*?\.source-admission-metrics \{[\s\S]*?grid-template-columns: 1fr;/.test(styles),
  "source-admission status card maintains AA contrast and collapses without mobile horizontal overflow",
);
const gate0RuntimeSource = sourceSection(
  journeyScript,
  "const gate0PublicKeys",
  "const renderJourneyDashboard",
);
await checkExecutableAsync(
  "workspace governance client renders valid Gate 0 and zero-RAG summaries while failing closed on independent protocol drift",
  async () => {
    const makeElement = () => ({
      textContent: "",
      value: undefined,
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      removeAttribute(name) { delete this.attributes[name]; },
    });
    const runGate0Fixture = async (p0Gate, sourceGovernance) => {
      const elements = Object.fromEntries(
        [
          "[data-gate0-status]",
          "[data-gate0-copy]",
          "[data-gate0-resolved]",
          "[data-gate0-total]",
          "[data-gate0-progress]",
        ].map((selector) => [selector, makeElement()]),
      );
      const root = {
        dataset: {},
        querySelector(selector) { return elements[selector] || null; },
      };
      const sourceElements = Object.fromEntries(
        [
          "[data-source-governance-status]",
          "[data-source-governance-copy]",
          "[data-source-rag-eligible]",
          "[data-source-tracked]",
          "[data-source-gate-a]",
          "[data-source-link-only]",
          "[data-source-archive-blocked]",
          '[data-source-criterion="teacher-reviewed"]',
          '[data-source-criterion="rag-rights"]',
          '[data-source-criterion="exam-version"]',
          '[data-source-criterion="explicit-rag"]',
          '[data-source-criterion="no-safety-flags"]',
        ].map((selector) => [selector, makeElement()]),
      );
      const sourceRoot = {
        dataset: {},
        querySelector(selector) { return sourceElements[selector] || null; },
        querySelectorAll(selector) {
          return selector === "[data-source-criterion]"
            ? Object.entries(sourceElements)
                .filter(([key]) => key.startsWith('[data-source-criterion="'))
                .map(([, value]) => value)
            : [];
        },
      };
      let requestOptions = null;
      const context = {
        URL,
        JSON,
        Number,
        Object,
        String,
        Error,
        AbortController: class {
          constructor() { this.signal = {}; }
          abort() {}
        },
        document: {
          querySelector(selector) {
            if (selector === "[data-gate0-summary]") return root;
            if (selector === "[data-source-governance]") return sourceRoot;
            return null;
          },
        },
        window: {
          location: { origin: "https://sufeiya.cn" },
          setTimeout() { return 1; },
          clearTimeout() {},
        },
        fetch: async (_path, options) => {
          requestOptions = options;
          return {
            ok: true,
            url: "https://sufeiya.cn/api/governance/status",
            headers: { get: () => "application/json; charset=utf-8" },
            text: async () => JSON.stringify({ mode: "sanitized_read_only_status", p0Gate, sourceGovernance }),
          };
        },
      };
      await runInNewContext(`
        (async () => {
          const GATE0_STATUS_PATH = "/api/governance/status";
          const GATE0_PROTOCOL_VERSION = "sufeiya_p0_decision_log_v1";
          const GATE0_RELEASE_AUTHORIZATION = "separate_explicit_controls_required";
          const SOURCE_GOVERNANCE_PROTOCOL_VERSION = "sufeiya_content_governance_v2";
          const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
          ${gate0RuntimeSource}
          await loadGate0GovernanceStatus();
        })()
      `, context);
      return { root, elements, sourceRoot, sourceElements, requestOptions };
    };

    const validP0 = {
      protocolVersion: "sufeiya_p0_decision_log_v1",
      status: "blocked",
      total: 29,
      resolved: 0,
      unresolved: 29,
      defaultDisposition: "deny",
      formalGate0Pass: false,
      releaseAuthorization: "separate_explicit_controls_required",
    };
    const validSourceGovernance = {
      protocolVersion: "sufeiya_content_governance_v2",
      status: "none_admitted",
      defaultDisposition: "deny",
      trackedRecords: 15,
      gateAClaimSources: 10,
      catalogLinkOnly: 5,
      ragEligible: 0,
      ragBlocked: 15,
      blockedArchiveRecords: 655,
      criteria: {
        teacherReviewed: 0,
        ragRightsAllowed: 0,
        examVersionCurrentOrNotApplicable: 10,
        explicitRagAllowed: 0,
        noBlockingSafetyFlags: 15,
      },
    };
    const valid = await runGate0Fixture(validP0, validSourceGovernance);
    const gate0Drifted = await runGate0Fixture({
      protocolVersion: "unknown_protocol",
      status: "decision_complete",
      total: 29,
      resolved: 29,
      unresolved: 0,
      defaultDisposition: "deny",
      formalGate0Pass: true,
      releaseAuthorization: "opens_everything",
    }, validSourceGovernance);
    const sourceDrifted = await runGate0Fixture(validP0, {
      ...validSourceGovernance,
      status: "some_admitted",
      ragEligible: 1,
      ragBlocked: 14,
    });
    const sourceLowerBoundDrifted = await runGate0Fixture(validP0, {
      ...validSourceGovernance,
      criteria: {
        teacherReviewed: 15,
        ragRightsAllowed: 15,
        examVersionCurrentOrNotApplicable: 15,
        explicitRagAllowed: 15,
        noBlockingSafetyFlags: 15,
      },
    });
    const sourceLinkOnlyAdmittedDrifted = await runGate0Fixture(validP0, {
      ...validSourceGovernance,
      status: "some_admitted",
      ragEligible: 11,
      ragBlocked: 4,
      criteria: {
        teacherReviewed: 11,
        ragRightsAllowed: 11,
        examVersionCurrentOrNotApplicable: 15,
        explicitRagAllowed: 11,
        noBlockingSafetyFlags: 15,
      },
    });
    const sourceLinkOnlyExplicitDrifted = await runGate0Fixture(validP0, {
      ...validSourceGovernance,
      criteria: {
        ...validSourceGovernance.criteria,
        explicitRagAllowed: 11,
      },
    });

    return valid.root.dataset.gate0State === "blocked" &&
      valid.elements["[data-gate0-status]"].textContent === "Gate 0 尚未通过" &&
      valid.elements["[data-gate0-resolved]"].textContent === "0" &&
      valid.elements["[data-gate0-progress]"].value === 0 &&
      valid.sourceRoot.dataset.sourceGovernanceState === "none-admitted" &&
      valid.sourceElements["[data-source-governance-status]"].textContent === "RAG 准入仍为 0 条" &&
      valid.sourceElements["[data-source-rag-eligible]"].textContent === "0" &&
      valid.sourceElements['[data-source-criterion="exam-version"]'].textContent === "10 / 15" &&
      valid.requestOptions?.method === "GET" &&
      !("body" in valid.requestOptions) &&
      gate0Drifted.root.dataset.gate0State === "unavailable" &&
      gate0Drifted.elements["[data-gate0-resolved]"].textContent === "—" &&
      gate0Drifted.elements["[data-gate0-status]"].textContent === "暂时无法核对 Gate 0 注册表" &&
      gate0Drifted.sourceRoot.dataset.sourceGovernanceState === "none-admitted" &&
      gate0Drifted.sourceElements["[data-source-governance-status]"].textContent === "RAG 准入仍为 0 条" &&
      sourceDrifted.root.dataset.gate0State === "blocked" &&
      sourceDrifted.sourceRoot.dataset.sourceGovernanceState === "unavailable" &&
      sourceDrifted.sourceElements["[data-source-rag-eligible]"].textContent === "—" &&
      sourceDrifted.sourceElements["[data-source-governance-status]"].textContent === "暂时无法核对来源准入登记" &&
      sourceLowerBoundDrifted.root.dataset.gate0State === "blocked" &&
      sourceLowerBoundDrifted.sourceRoot.dataset.sourceGovernanceState === "unavailable" &&
      sourceLowerBoundDrifted.sourceElements["[data-source-rag-eligible]"].textContent === "—" &&
      sourceLinkOnlyAdmittedDrifted.root.dataset.gate0State === "blocked" &&
      sourceLinkOnlyAdmittedDrifted.sourceRoot.dataset.sourceGovernanceState === "unavailable" &&
      sourceLinkOnlyAdmittedDrifted.sourceElements["[data-source-rag-eligible]"].textContent === "—" &&
      sourceLinkOnlyExplicitDrifted.root.dataset.gate0State === "blocked" &&
      sourceLinkOnlyExplicitDrifted.sourceRoot.dataset.sourceGovernanceState === "unavailable" &&
      sourceLinkOnlyExplicitDrifted.sourceElements["[data-source-rag-eligible]"].textContent === "—";
  },
);

const practice = await read("practice.html");
const planPage = await read("plan.html");
const reviewPage = await read("review.html");
const retestPage = await read("retest.html");
const practiceTargets = [...practice.matchAll(/class="practice-launch-grid"[\s\S]*?<\/div>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(practiceTargets) ===
    JSON.stringify(["/practice-reading", "/practice-listening", "/practice-writing", "/practice-speaking"]),
  "four skill buttons target four distinct practice pages",
);

check(/id="plan-form"/.test(planPage), "plan page contains a directly usable plan form");
check(/id="diagnostic-start-form"[\s\S]*name="adultConfirmed"/.test(diagnosticPage), "diagnostic page requires an explicit 18+ demo declaration");
check(/data-recommendation-items[\s\S]*data-accept-recommendation[\s\S]*data-skip-recommendation/.test(await read("recommendations.html")), "recommendation page supports accept and explicit skip states");
check(/data-today-tasks/.test(await read("today.html")), "today page contains a directly usable task list");
check(/lang="en"[\s\S]*name="reading-answer"/.test(await read("practice-reading.html")), "reading material is marked as English");
check(/<audio controls preload="metadata"[\s\S]*name="listening-answer"/.test(await read("practice-listening.html")), "listening page includes packaged audio and a question");
check(
  /textarea[^>]*maxlength="4096"[^>]*lang="en"[^>]*data-writing-answer[\s\S]*data-complete-writing/.test(
    await read("practice-writing.html"),
  ),
  "writing page exposes the 4096-character storage boundary and completion control",
);
check(/data-speaking-time[\s\S]*data-speaking-review/.test(await read("practice-speaking.html")), "speaking page includes prepare/speak timing and self-review");
check(/data-focus-time[\s\S]*data-focus-stop/.test(await read("focus.html")), "focus page includes start, pause, stop, and reset-capable controls");
check(/name="didText"[\s\S]*name="evidenceText"[\s\S]*name="questionStatus"/.test(await read("check-in.html")), "check-in page collects action, evidence, and question state");
check(/data-checkin-receipt[\s\S]*data-checkin-id[\s\S]*data-checkin-plan-id/.test(await read("check-in.html")), "check-in page exposes check_in_id and plan_id receipts");
check(/id="review-form"[\s\S]*name="learnerConfirmed"[\s\S]*data-review-id/.test(reviewPage), "review page requires a distinct learner confirmation and review_id");
check(/value="used"[\s\S]*value="declined"[\s\S]*value="not_needed"[\s\S]*value="unavailable"/.test(await read("community.html")), "community page exposes all four valid voluntary states");
check(/href="\/retest" data-community-next hidden/.test(await read("community.html")), "community keeps the retest action hidden until a voluntary state is validly saved");
check(/data-retest-panel="Reading"[\s\S]*data-retest-panel="Listening"[\s\S]*data-retest-panel="Writing"[\s\S]*data-retest-panel="Speaking"/.test(retestPage), "retest page contains four original parallel task modes");
check(/data-retest-id[\s\S]*data-updated-plan-id[\s\S]*data-superseded-plan-id/.test(retestPage), "retest page exposes retest and updated-plan chain receipts");
check(/data-retest-skill-label[\s\S]*type="hidden"[^>]*name="retestSkill"[\s\S]*data-retest-same-skill[\s\S]*data-retest-parallel-pair/.test(retestPage), "retest target is locked and exposes auditable same-skill evidence");
check(/data-checkin-evidence-status[\s\S]*data-checkin-evidence-class[\s\S]*data-checkin-practice-receipt-id/.test(await read("check-in.html")), "check-in exposes practice-receipt qualification and evidence class");
check(/data-review-evidence-class[\s\S]*data-review-practice-receipt-id/.test(await read("review.html")), "learner review displays the exact check-in evidence source and practice receipt");
check(/data-recommendation-binding-id/.test(await read("recommendations.html")), "recommendation receipt exposes its diagnostic-to-practice binding ID");
const journeyNavigationPages = [
  ["diagnostic.html", "/diagnostic"],
  ["plan.html", "/plan"],
  ["recommendations.html", "/recommendations"],
  ["check-in.html", "/check-in"],
  ["review.html", "/review"],
  ["community.html", "/community"],
  ["retest.html", "/retest"],
];
const expectedJourneyNavigationTargets = [
  "/diagnostic",
  "/plan",
  "/recommendations",
  "/check-in",
  "/review",
  "/community",
  "/retest",
];
check(
  journeyNavigationPages.every(([filename, currentTarget]) => {
    const html = runtimePageSources.get(filename) || "";
    const nav = html.match(/<nav class="study-tool-nav" aria-label="七步学习闭环">([\s\S]*?)<\/nav>/)?.[1] || "";
    const targets = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    return JSON.stringify(targets) === JSON.stringify(expectedJourneyNavigationTargets) &&
      (nav.match(/aria-current="step"/g) || []).length === 1 &&
      new RegExp(`href="${currentTarget}" aria-current="step"`).test(nav);
  }),
  "all seven Gate A pages expose one canonical seven-step navigation with the correct current step",
);
check(
  /data-plan-next[\s\S]*data-plan-next-label/.test(planPage) &&
    /const linkedPlan = completedPlanChain\(\)[\s\S]*continuesCurrentCycle[\s\S]*next\.href = continuesCurrentCycle \? "\/recommendations" : "\/today"/.test(workspaceScript),
  "plan sends diagnostic-bound cycles to recommendations while standalone plans continue to today",
);
check(
  /id="review-form"[\s\S]*data-review-error[\s\S]*<\/form>\s*<p class="review-success-message" data-review-message role="status" aria-live="polite" tabindex="-1" hidden>/.test(reviewPage) &&
    /successMessage\.hidden = false[\s\S]*successMessage\?\.focus\(\)/.test(journeyScript),
  "review success remains visible outside the hidden form and receives programmatic focus after save",
);
check(
  /data-plan-update-receipt hidden aria-live="polite"[\s\S]*data-plan-update-completion-title tabindex="-1"[\s\S]*href="\/workspace"[\s\S]*href="\/plan"/.test(retestPage) &&
    /renderRetest\(\{ focusCompletion: true \}\)/.test(journeyScript) &&
    /Gate A PASS/.test(journeyScript),
  "updated-plan completion stays visible, distinguishes local or provisional status, offers next actions, and receives focus",
);
check(
  (retestPage.match(/data-retest-error=/g) || []).length === 4 &&
    /showRetestValidationError[\s\S]*aria-invalid[\s\S]*aria-describedby[\s\S]*target\.focus\(\)/.test(journeyScript),
  "parallel-retest validation exposes inline errors and focuses an associated invalid control",
);
for (const [file, exerciseId] of [
  ["practice-reading.html", "reading-library-v1"],
  ["practice-listening.html", "listening-club-v1"],
  ["practice-writing.html", "writing-community-v1"],
  ["practice-speaking.html", "speaking-skill-v1"],
]) {
  const page = await read(file);
  check(new RegExp(`data-exercise-id="${exerciseId}"[\\s\\S]*data-practice-binding-status[\\s\\S]*data-practice-checkin-link hidden`).test(page), `${file} exposes its versioned binding, receipt status, and default-hidden contextual check-in action`);
}
check(
  /data-listening-audio aria-label="Listening 原创英文材料；完整播放后可形成练习回执"/.test(await read("practice-listening.html")) &&
    /data-retest-listening-audio aria-label="Listening 平行微复测英文材料；需完整播放后再提交"/.test(await read("retest.html")),
  "practice and parallel-retest Listening audio controls have task-specific accessible names",
);
check(/data-today-plan-boundary/.test(await read("today.html")), "today page exposes whether tasks come from the current plan or independent practice");
check(/data-export-workspace[\s\S]*data-clear-workspace[\s\S]*data-clear-super-teacher[\s\S]*data-clear-teaching-review-demo[\s\S]*data-clear-all-sufeiya/.test(await read("my-data.html")), "data page supports all-data export and three separately scoped namespace clears");
check(/sufeiya_workspace_v1/.test(workspaceScript), "workspace uses one versioned local-storage namespace");
check(/sufeiya_workspace_v1/.test(journeyScript), "journey shares the versioned workspace namespace");
check(/localStorage\.removeItem\(STORAGE_KEY\)/.test(workspaceScript), "clear action only removes the Sufeiya workspace namespace");
check(/SUPER_TEACHER_STORAGE_KEY = "sufeiya_super_teacher_v1"/.test(workspaceScript), "data controls include the versioned Super Teacher namespace");
check(/TEACHING_REVIEW_DEMO_STORAGE_KEY = "sufeiya_teaching_review_demo_v1"/.test(workspaceScript), "data controls include the versioned teaching-review demo namespace");
check(/exportProtocol:\s*"sufeiya_local_export_v2"[\s\S]*SUPER_TEACHER_STORAGE_KEY[\s\S]*TEACHING_REVIEW_DEMO_STORAGE_KEY/.test(workspaceScript), "JSON export v2 contains all three local Sufeiya namespaces");
check(/readTeachingReviewDemoNamespace[\s\S]*status: "unrecognized"[\s\S]*raw[\s\S]*readStatus: teachingReviewNamespace\.status/.test(workspaceScript), "teaching-review data export preserves unrecognized raw values and their read status");
check(/data-clear-super-teacher[\s\S]*removeItem\(SUPER_TEACHER_STORAGE_KEY\)[\s\S]*data-clear-teaching-review-demo[\s\S]*removeItem\(TEACHING_REVIEW_DEMO_STORAGE_KEY\)[\s\S]*data-clear-all-sufeiya/.test(workspaceScript), "Sofia, teaching-review, and all-data clearing are independently implemented");
check(
  /const completedCycles = state\.journey\.history\.filter\(\(item\) => item\?\.status === "completed"\)\.length/.test(workspaceScript) &&
    /provisionalCycles[\s\S]*status === "provisional_pending_human_review"[\s\S]*待人工复核的临时轮次/.test(workspaceScript) &&
    !/status === "completed" \|\| item\?\.updatedPlanId/.test(workspaceScript),
  "My Data counts only completed cycles and reports provisional human-review cycles separately",
);
check(/endsAt[\s\S]*Date\.now\(\)/.test(workspaceScript), "focus timer uses an absolute end time for background and reload recovery");
check(/Number\.isFinite\(storedRemaining\)/.test(workspaceScript), "focus timer preserves a completed zero-second value");
check(/hasValidPlanShape\(value\.plan\)/.test(workspaceScript), "stored plans are shape-checked before rendering");
check(!/(?:0\s*[–-]\s*100|10\s*[–-]\s*160|官方估分|预测分数)/.test(workspaceScript), "workspace does not generate score ranges or official predictions");
check(/activeCycle[\s\S]*cycleId[\s\S]*basePlanId/.test(journeyScript), "journey binds all stages to one active cycle and base plan");
check(/effective|previousComplete/.test(journeyScript), "journey completion is sequential rather than seven independent booleans");
check(/recommendationId[\s\S]*checkInId[\s\S]*reviewId[\s\S]*peerHelpId[\s\S]*retestId[\s\S]*updatedPlanId/.test(journeyScript), "journey implements the complete event-ID chain");
check(
  /const buildCycleEvidenceProjection[\s\S]*diagnosticComplete[\s\S]*planComplete[\s\S]*recommendationComplete[\s\S]*checkInComplete[\s\S]*reviewComplete[\s\S]*peerHelpComplete[\s\S]*retestEvidenceComplete[\s\S]*planUpdateRecorded/.test(journeyScript) &&
    /const chain = validateCycleEvidence\(\)[\s\S]*evaluateJourney\(chain\)[\s\S]*renderCycleEvidenceLedger\(chain\)/.test(journeyScript) &&
    /value\.textContent = entry\.value \|\| "尚未形成"/.test(journeyScript),
  "workspace receipt projection reuses the central validator and writes only safe text nodes",
);
check(
  /const buildCycleHistoryProjection = \(candidateState, ledgerStatus\)/.test(journeyScript) &&
    /validated\.sort\(\(left, right\) => right\.terminalAt\.localeCompare\(left\.terminalAt\)\)/.test(journeyScript) &&
    /validated\.slice\(0, CYCLE_HISTORY_LIMIT\)/.test(journeyScript) &&
    /cycleIdCounts\.get\(record\.cycleId\) !== 1/.test(journeyScript) &&
    /record\.cycleId === activeCycleId/.test(journeyScript) &&
    /renderCycleHistory\(\)/.test(journeyScript),
  "workspace cycle history is newest-first, capped at ten, de-duplicated, and separated from the current receipt",
);
check(
  !/\bfetch\s*\(|localStorage|setItem|persist\(|appendLearningEvent|appendDomainEvent/.test(
    sourceSection(journeyScript, "const cycleHistoryTopLevelKeys", "const WORKSPACE_BACKUP_ACTIVE_CYCLE_KEYS"),
  ) &&
    /textContent = value/.test(journeyScript) &&
    /overflow-wrap:\s*anywhere/.test(styles) &&
    /word-break:\s*break-word/.test(styles) &&
    /@media \(max-width:\s*620px\)[\s\S]*?\.cycle-history-plan-comparison,[\s\S]*?grid-template-columns:\s*1fr;/.test(styles),
  "cycle history projection performs no writes or network calls and wraps long IDs on small screens",
);
check(/const PROTOCOL_VERSION = "gate_a_local_v1"/.test(journeyScript), "journey names one exact Gate A protocol version");
check(/value\.journey\.protocolVersion !== PROTOCOL_VERSION[\s\S]*activeCycle\.protocolVersion !== PROTOCOL_VERSION/.test(journeyScript), "journey rejects missing, empty, or unknown stored protocol versions");
check(
  /#diagnostic-start-form, #diagnostic-priority-form, #review-form, #community-form/.test(journeyScript),
  "journey read-only mode also disables diagnostic and learner review confirmation",
);
check((journeyScript.match(/validateCycleEvidence\(\)/g) || []).length >= 4, "retest, plan update, and dashboard share one cycle-chain validator");
check(/chain\.retestEvidenceComplete[\s\S]*state\.plan\?\.planId === cycle\.basePlanId/.test(journeyScript), "plan update requires the full retest chain and exact active base plan");
check(/stateBeforeUpdate[\s\S]*state = stateBeforeUpdate/.test(journeyScript), "failed updated-plan persistence restores the pre-submit in-memory state");
check(/isSafeLocalRoute\(task\.route\)/.test(journeyScript) && /isSafeLocalRoute\(task\.route\)/.test(workspaceScript), "stored plan links are restricted to safe same-site routes");
check(
  /previousSaved && sameScope && !contentChanged[\s\S]*renderCheckinReceipt\(previous\)[\s\S]*原确认、复盘与后续证据保持有效[\s\S]*return/.test(
    workspaceScript,
  ),
  "unchanged saved check-ins preserve their ID, confirmation, review, and downstream evidence",
);
check(
  /previousSaved && !contentChanged[\s\S]*内容与已确认版本一致[\s\S]*原确认、复盘与后续证据保持有效[\s\S]*return/.test(
    workspaceScript,
  ),
  "autosave preserves every saved check-in when the final content is unchanged",
);
check(
  /const replacesSavedVersion = previousSaved && contentChanged[\s\S]*archiveCheckIn\(previous, previousConfirmed \? "learner_revision_after_confirmation" : "learner_revision_after_save"\)[\s\S]*checkInId: replacesSavedVersion \? null : previous\.checkInId \|\| null/.test(
    workspaceScript,
  ) &&
    /const replacesSavedVersion = currentPreviousSaved && currentContentChanged[\s\S]*archiveCheckIn\([\s\S]*learner_revision_after_confirmation[\s\S]*learner_revision_after_save[\s\S]*currentSameScope && !replacesSavedVersion[\s\S]*currentPrevious\.checkInId[\s\S]*`check-in-\$\{Date\.now\(\)\.toString\(36\)\}`/.test(
      workspaceScript,
    ),
  "every edited saved check-in is archived and forced onto a new evidence ID before or at final save",
);
check(/chain\.checkInComplete[\s\S]*latestChain\.checkInComplete/.test(journeyScript), "review rendering and submission share the central check-in evidence gate");
check(/chain\.reviewComplete[\s\S]*latestChain\.reviewComplete/.test(journeyScript), "community rendering and submission share the central review evidence gate");
check(/VALID_PEER_HELP_STATES[\s\S]*used[\s\S]*declined[\s\S]*not_needed[\s\S]*unavailable/.test(journeyScript), "journey accepts every approved peer-help terminal state");
check(/officialEquivalenceClaimed:\s*false[\s\S]*growthClaimProduced:\s*false/.test(journeyScript), "parallel retest stores no-equivalence and no-growth guards");
check(/learnerConfirmed:\s*true[\s\S]*supersedesPlanId:\s*cycle\.basePlanId/.test(journeyScript), "updated plan requires learner confirmation and supersedes the exact base plan");
check(!/getUserMedia|MediaRecorder/.test(journeyScript), "journey does not request or record microphone data");
check(!/(?:10\s*[–-]\s*160|官方估分|预测分数|真正\s*CAT)/.test(journeyScript), "journey does not generate official score or CAT claims");

const expectedPracticeTasks = [
  ["reading-library-v1", "Reading", "/practice-reading", "objective_response"],
  ["listening-club-v1", "Listening", "/practice-listening", "audio_objective_response"],
  ["writing-community-v1", "Writing", "/practice-writing", "self_reviewed_artifact"],
  ["speaking-skill-v1", "Speaking", "/practice-speaking", "timed_self_report"],
];
const registeredPracticeTasks = Array.isArray(practiceTaskRegister.tasks) ? practiceTaskRegister.tasks : [];
check(
  practiceTaskRegister.protocolVersion === "sufeiya_practice_task_register_v1" &&
    practiceTaskRegister.releaseStatus === "gate_a_demo_only" &&
    practiceTaskRegister.ownerScope === "browser_local_not_account_bound" &&
    practiceTaskRegister.teacherReviewed === false &&
    practiceTaskRegister.measurementReviewed === false,
  "practice task register preserves the local-only unreviewed Gate A boundary",
);
check(
  JSON.stringify(registeredPracticeTasks.map((task) => [task.exerciseId, task.skill, task.route, task.evidenceClass])) === JSON.stringify(expectedPracticeTasks) &&
    new Set(registeredPracticeTasks.map((task) => task.exerciseId)).size === 4 &&
    new Set(registeredPracticeTasks.map((task) => task.route)).size === 4,
  "practice register contains exactly four unique canonical skill routes",
);
check(
  registeredPracticeTasks.every(
    (task) => /^[a-f0-9]{64}$/.test(task.contentHash) && task.contentHash === sha256(JSON.stringify(task.content)),
  ),
  "every practice content SHA-256 matches its canonical content contract",
);
check(
  registeredPracticeTasks.every(
    (task) => workspaceScript.includes(task.exerciseId) && workspaceScript.includes(task.contentHash) && journeyScript.includes(task.exerciseId) && journeyScript.includes(task.contentHash),
  ),
  "workspace and journey validators embed every registered practice ID and content hash",
);

const expectedDiagnosticSkills = ["Reading", "Reading", "Listening", "Listening", "Speaking", "Writing"];
const expectedDiagnosticTaskIds = [
  "diagnostic-reading-library-v1",
  "diagnostic-reading-newsletter-v1",
  "diagnostic-listening-science-club-v1",
  "diagnostic-listening-language-lab-v1",
  "diagnostic-speaking-learning-skill-v1",
  "diagnostic-writing-learning-place-v1",
];
const diagnosticTasks = Array.isArray(diagnosticTaskRegister.tasks) ? diagnosticTaskRegister.tasks : [];
const diagnosticManifest = diagnosticTasks.map(({ taskId, taskVersion, skill, responseType, constructTag, contentHash }) => ({
  taskId,
  taskVersion,
  skill,
  responseType,
  constructTag,
  contentHash,
}));
const expectedDiagnosticTaskSetDigest = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
check(
  diagnosticTaskRegister.protocolVersion === "sufeiya_diagnostic_task_register_v1",
  "diagnostic task register uses the exact canonical register protocol",
);
check(
  diagnosticTaskRegister.taskSetId === "gate-a-original-evidence-pack" &&
    diagnosticTaskRegister.taskSetVersion === "gate_a_original_6_v1" &&
    diagnosticTaskRegister.taskSetDigest === expectedDiagnosticTaskSetDigest &&
    diagnosticTaskRegister.taskSetDigest === sha256(JSON.stringify(diagnosticManifest)),
  "diagnostic task register identifies the exact Gate A six-task set and manifest digest",
);
check(
  diagnosticTaskRegister.releaseStatus === "gate_a_demo_only" &&
    diagnosticTaskRegister.scopeConfirmationStatus === "owner_confirmed" &&
    diagnosticTaskRegister.teacherReviewed === false &&
    diagnosticTaskRegister.measurementReviewed === false,
  "diagnostic task register is owner-scoped but remains an unreviewed Gate A demo rather than a formal assessment",
);
check(
  diagnosticTaskRegister.ragEligibility === "blocked" &&
    diagnosticTaskRegister.rightsStatus?.rag === "denied" &&
    diagnosticTaskRegister.rightsStatus?.cache === "pending" &&
    diagnosticTaskRegister.rightsStatus?.republish === "pending",
  "diagnostic task-set rights remain pending and blocked from RAG admission",
);
check(diagnosticTasks.length === 6, "diagnostic task register contains exactly six tasks");
check(
  JSON.stringify(diagnosticTasks.map((task) => task.order)) === JSON.stringify([1, 2, 3, 4, 5, 6]),
  "diagnostic task register has one contiguous six-task order",
);
check(
  JSON.stringify(diagnosticTasks.map((task) => task.skill)) === JSON.stringify(expectedDiagnosticSkills),
  "diagnostic task order is two Reading, two Listening, Speaking, then Writing",
);
check(
  JSON.stringify(diagnosticTasks.map((task) => task.taskId)) === JSON.stringify(expectedDiagnosticTaskIds) &&
    new Set(diagnosticTasks.map((task) => task.taskId)).size === diagnosticTasks.length,
  "diagnostic task register uses the exact six unique canonical task IDs",
);
check(
  diagnosticTasks.every(
    (task) =>
      typeof task.contentHash === "string" &&
      /^[a-f0-9]{64}$/.test(task.contentHash) &&
      task.contentHash === sha256(JSON.stringify(task.content)),
  ),
  "every diagnostic task content SHA-256 matches its canonical content object",
);
check(
  diagnosticTasks.every(
    (task) =>
      task.contentOriginClass === "first_party_original_task" &&
      task.sourceClass === "owner_confirmed_scope" &&
      task.claimVerificationStatus === "unverified" &&
      task.reviewStatus === "unreviewed",
  ),
  "every diagnostic task is owner-confirmed first-party original scope with unverified claims",
);
check(
  diagnosticTasks.every(
    (task) =>
      task.rightsStatus?.cache === "pending" &&
      task.rightsStatus?.republish === "pending" &&
      task.rightsStatus?.rag === "denied" &&
      (task.skill === "Listening" ? task.rightsStatus?.transcribe === "pending" : task.rightsStatus?.transcribe === "not_applicable") &&
      task.ragEligibility === "blocked",
  ),
  "every diagnostic task preserves pending cache, republish, and applicable transcription rights",
);

const renderedDiagnosticTasks = [...diagnosticPage.matchAll(
  /data-diagnostic-task data-task-id="([^"]+)"[^>]*data-task-order="(\d+)"[^>]*data-task-skill="([^"]+)"[^>]*data-content-hash="([a-f0-9]{64})"/g,
)].map((match) => ({ taskId: match[1], order: Number(match[2]), skill: match[3], contentHash: match[4] }));
const diagnosticReportSource = sourceSection(journeyScript, "const buildDiagnosticReport", "let diagnosticTimerId");
const diagnosticObjectiveSubmitSource = sourceSection(
  journeyScript,
  'panel.querySelector("[data-diagnostic-submit-task]")?.addEventListener',
  'panel.querySelectorAll("[data-diagnostic-skip-task]")',
);
const diagnosticStaticAudioSource = sourceSection(
  journeyScript,
  'const audio = panel.querySelector("[data-diagnostic-audio]")',
  'panel.querySelector("[data-diagnostic-speech-play]")?.addEventListener',
);
const diagnosticSpeechSource = sourceSection(
  journeyScript,
  'panel.querySelector("[data-diagnostic-speech-play]")?.addEventListener',
  'panel.querySelector("[data-diagnostic-transcript]")?.addEventListener',
);
const diagnosticCompleteTaskSource = sourceSection(
  journeyScript,
  "const completeDiagnosticTask",
  "const syncDiagnosticTimer",
);
const diagnosticWritingBeforeInputSource = sourceSection(
  journeyScript,
  'writingInput?.addEventListener("beforeinput"',
  'panel.querySelector("[data-writing-finish]")',
);
const renderDiagnosticReportSource = sourceSection(journeyScript, "const renderDiagnosticReport", "const renderDiagnostic =");
const renderDiagnosticSource = sourceSection(journeyScript, "const renderDiagnostic =", "const refreshDiagnosticVoices");
const retireCurrentPlanSource = sourceSection(
  journeyScript,
  "const retireCurrentPlanForNewDiagnostic",
  "const buildDiagnosticReport",
);
const diagnosticStartSource = sourceSection(
  journeyScript,
  'startForm?.addEventListener("submit"',
  'document.querySelectorAll("[data-diagnostic-task]")',
);
const diagnosticRestartSource = sourceSection(
  journeyScript,
  'document.querySelectorAll("[data-diagnostic-restart]")',
  'document.addEventListener("visibilitychange"',
);
const evaluateJourneySource = sourceSection(journeyScript, "const evaluateJourney", "const renderCycleEvidenceLedger");
const retireCurrentPlanHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        let state;
        ${retireCurrentPlanSource}
        return {
          evaluate(nextState, options) {
            state = JSON.parse(JSON.stringify(nextState));
            const result = retireCurrentPlanForNewDiagnostic(options);
            return { result, state };
          },
        };
      })()`,
    );
  } catch {
    return null;
  }
})();
checkExecutable(
  "starting a new diagnostic retires exactly one current plan without deleting its history",
  () => {
    if (!retireCurrentPlanHarness) return false;
    const currentPlan = { planId: "plan-current", status: "active", days: [] };
    const retired = retireCurrentPlanHarness.evaluate(
      { plan: currentPlan, planHistory: [{ planId: "plan-older", status: "superseded", days: [] }] },
      { supersededAt: "2026-08-12T00:00:00.000Z", reason: "learner_started_new_gate_a_evidence_pack" },
    );
    const conflict = retireCurrentPlanHarness.evaluate(
      { plan: currentPlan, planHistory: [{ ...currentPlan, status: "superseded" }] },
      { supersededAt: "2026-08-12T00:00:00.000Z", reason: "learner_started_new_gate_a_evidence_pack" },
    );
    return retired.result.status === "retired" &&
      retired.state.plan === null &&
      retired.state.planHistory.length === 2 &&
      retired.state.planHistory[1].planId === currentPlan.planId &&
      retired.state.planHistory[1].status === "superseded" &&
      retired.state.planHistory[1].supersededReason === "learner_started_new_gate_a_evidence_pack" &&
      conflict.result.status === "plan_history_conflict" &&
      conflict.state.plan?.planId === currentPlan.planId &&
      conflict.state.planHistory.length === 1;
  },
);
check(
  /const createdAt = isoNow\(\)[\s\S]*retireCurrentPlanForNewDiagnostic\([\s\S]*learner_started_new_gate_a_evidence_pack[\s\S]*state = snapshot;[\s\S]*appendLearningEvent\("learning_cycle\.started"[\s\S]*state = snapshot;[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = snapshot;/.test(
    diagnosticStartSource,
  ) &&
    /withExclusiveJourneyWrite[\s\S]*retireCurrentPlanForNewDiagnostic\([\s\S]*learner_restarted_gate_a_evidence_pack[\s\S]*state = snapshot;[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = snapshot;/.test(
      diagnosticRestartSource,
    ),
  "new-diagnostic start and restart retire the current plan inside rollback-safe exclusive writes",
);
check(
  diagnosticPage.includes(
    `data-diagnostic-app data-task-set-version="gate_a_original_6_v1" data-task-set-digest="${expectedDiagnosticTaskSetDigest}"`,
  ),
  "diagnostic page declares the exact Gate A task-set version and digest",
);
check(
  JSON.stringify(renderedDiagnosticTasks) ===
    JSON.stringify(
      diagnosticTasks.map((task) => ({
        taskId: task.taskId,
        order: task.order,
        skill: task.skill,
        contentHash: task.contentHash,
      })),
    ),
  "diagnostic page renders all six registered tasks, hashes, and canonical order",
);
check(
  /仅限 18\+ 演示/.test(diagnosticPage) &&
    /name="adultConfirmed"/.test(diagnosticPage) &&
    /name="localBoundaryConfirmed"/.test(diagnosticPage) &&
    /name="noScoreConfirmed"/.test(diagnosticPage) &&
    /name="environmentConfirmed"/.test(diagnosticPage),
  "diagnostic page requires 18+, local-only, no-score, and environment confirmations",
);
check(
  /data-device-storage[\s\S]*data-device-mp3[\s\S]*data-device-speech[\s\S]*data-device-lock[\s\S]*data-device-viewport[\s\S]*data-device-network/.test(
    diagnosticPage,
  ) && /data-audio-test/.test(diagnosticPage) && /name="keyboardCheck"/.test(diagnosticPage),
  "diagnostic page provides storage, audio, speech, safe-write-lock, viewport, network, keyboard, and sound-output preflight",
);
check(
  /const safeWriteLockSupported = Boolean\(navigator\.locks\?\.request\)/.test(journeyScript) &&
    /setText\("\[data-device-lock\]", safeWriteLockSupported \? "支持 · 防跨页覆盖" : "不支持 · 无法开始闭环"\)/.test(
      journeyScript,
    ) &&
    /if \(!safeWriteLockSupported\) \{[\s\S]*不支持安全本机写入锁[\s\S]*return;/.test(journeyScript),
  "diagnostic preflight exposes Web Locks capability before blocking an unsafe diagnostic start",
);
check(
  (diagnosticPage.match(/data-diagnostic-submit-task/g) || []).length === 4 &&
    (diagnosticPage.match(/封存第一次选择/g) || []).length === 4 &&
    /firstResponse:\s*selected\.value[\s\S]*attempts:\s*1/.test(journeyScript),
  "four objective diagnostic tasks seal exactly one first response",
);
check(
  /const before = snapshotState\(\)[\s\S]*replaceDiagnosticEvidence\(diagnostic, evidence\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*renderDiagnostic\(\);[\s\S]*return false;/.test(
    diagnosticCompleteTaskSource,
  ) &&
    /firstResponse:\s*selected\.value[\s\S]*attempts:\s*1[\s\S]*completeDiagnosticTask\(diagnostic, next\)/.test(
      diagnosticObjectiveSubmitSource,
    ),
  "a failed first-response persist restores the complete pre-submit diagnostic state",
);
check(
  /const completedAt = isoNow\(\);[\s\S]*const durationSeconds = Math\.max\(0, Math\.round\(\(Date\.parse\(completedAt\) - Date\.parse\(current\.startedAt\)\) \/ 1000\)\)/.test(
    diagnosticObjectiveSubmitSource,
  ) && !/Date\.now\(\) - Date\.parse\(current\.startedAt\)/.test(diagnosticObjectiveSubmitSource),
  "objective diagnostic completion derives duration from its persisted completion timestamp",
);
check(
  /data-prep-seconds="20"[^>]*data-response-seconds="90"/.test(diagnosticPage) &&
    /data-task-skill="Writing"[^>]*data-response-seconds="180"/.test(diagnosticPage),
  "diagnostic page exposes the approved 90-second Speaking and 180-second Writing timers",
);
check(
  (diagnosticPage.match(/data-diagnostic-transcript>/g) || []).length === 2 &&
    /transcript_used/.test(journeyScript) &&
    /audio_not_completed/.test(journeyScript) &&
    /audio_playback_failed/.test(journeyScript) &&
    /task_unavailable/.test(journeyScript) &&
    /resumed_after_reload/.test(journeyScript) &&
    /open_response_not_human_reviewed/.test(journeyScript),
  "diagnostic flow records text-alternative, playback, availability, reload, and human-review quality flags",
);
check(
  /if \(completedEvidence\.length === 0\) \{[\s\S]*priorityCandidates = \["Reading", "Listening", "Writing", "Speaking"\][\s\S]*本轮没有形成任何完成证据/.test(
    diagnosticReportSource,
  ) &&
    /本轮六项任务均被记录为跳过、不可用或证据不足，没有形成可解释的完成证据；缺失不按零分处理/.test(
      diagnosticReportSource,
    ) &&
    /writing\?\.status === "completed"[\s\S]*Writing 未形成完成证据；缺失不按零分处理/.test(diagnosticReportSource) &&
    /speaking\?\.status === "completed"[\s\S]*Speaking 未形成完成证据；缺失不按零分处理/.test(diagnosticReportSource) &&
    !/quality\.includes\(qualityFlagLabels\.open_response_not_human_reviewed\)/.test(diagnosticReportSource) &&
    /diagnostic\.completedEvidenceTaskCount === 0[\s\S]*本轮没有形成完成证据[\s\S]*缺失不按零分处理/.test(
      renderDiagnosticReportSource,
    ) &&
    !/`已完成 \$\{diagnostic\.completedEvidenceTaskCount\} 项任务证据/.test(renderDiagnosticReportSource),
  "an all-terminal zero-evidence diagnostic is described as missing evidence rather than completed work or zero ability",
);
check(
  /completedEvidenceCount === 0[\s\S]*六项终态已记录 · 0 项形成完成证据[\s\S]*completedEvidenceCount < DIAGNOSTIC_TASK_IDS\.length[\s\S]*项形成完成证据[\s\S]*6 \/ 6 项完成 · 证据质量不足/.test(
    evaluateJourneySource,
  ) &&
    !/六任务完成，证据不足/.test(evaluateJourneySource),
  "workspace journey labels distinguish terminal task states from completed evidence counts",
);
check(
  /DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1"/.test(journeyScript) &&
    new RegExp(`DIAGNOSTIC_TASK_SET_DIGEST = "${expectedDiagnosticTaskSetDigest}"`).test(journeyScript) &&
    /diagnostic\?\.taskSetVersion === DIAGNOSTIC_TASK_SET_VERSION/.test(journeyScript) &&
    /diagnostic\?\.taskSetDigest === DIAGNOSTIC_TASK_SET_DIGEST/.test(journeyScript) &&
    /contentHash:\s*panel\.dataset\.contentHash/.test(journeyScript) &&
    /Object\.entries\(expected\)\.filter\(\(\[key\]\) => key !== "correctValue"\)\.every\(\(\[key, value\]\) => evidence\[key\] === value\)/.test(journeyScript) &&
    /automatedScoreProduced:\s*false[\s\S]*formalDiagnosisProduced:\s*false/.test(journeyScript),
  "journey binds runtime evidence to the task-set digest and per-task content hash without scoring",
);
check(
  /current\.audioPlayed && !current\.audioCompleted/.test(diagnosticObjectiveSubmitSource) &&
    /"audio_not_completed"/.test(diagnosticObjectiveSubmitSource) &&
    /current\.audioSeekDetected/.test(diagnosticObjectiveSubmitSource) &&
    /"audio_seek_detected"/.test(diagnosticObjectiveSubmitSource) &&
    /audio_not_completed/.test(diagnosticReportSource) &&
    /audio_seek_detected/.test(diagnosticReportSource) &&
    /audio\?\.addEventListener\("play"/.test(diagnosticStaticAudioSource) &&
    /audioCompleted:\s*false/.test(diagnosticStaticAudioSource) &&
    /audioStartedNearBeginning:[\s\S]*audio\.currentTime <= 0\.25/.test(diagnosticStaticAudioSource) &&
    /audio\?\.addEventListener\("seeking"/.test(diagnosticStaticAudioSource) &&
    /audioSeekDetected:\s*true/.test(diagnosticStaticAudioSource) &&
    /audio\?\.addEventListener\("ended"/.test(diagnosticStaticAudioSource) &&
    /completePlayback = current\.audioStartedNearBeginning === true && current\.audioSeekDetected !== true/.test(
      diagnosticStaticAudioSource,
    ) &&
    /audioCompleted:\s*completePlayback/.test(diagnosticStaticAudioSource),
  "Listening is interpretable only after an uninterrupted static-audio ended event from the beginning",
);
check(
  /utterance\.addEventListener\("start"/.test(diagnosticSpeechSource) &&
    /speechSynthesisStarted:\s*true/.test(diagnosticSpeechSource) &&
    /utterance\.addEventListener\("end"/.test(diagnosticSpeechSource) &&
    /audioCompleted:\s*true/.test(diagnosticSpeechSource) &&
    /utterance\.addEventListener\("error"/.test(diagnosticSpeechSource) &&
    /speech_synthesis_error/.test(diagnosticSpeechSource) &&
    /browser_voice_variability/.test(diagnosticSpeechSource) &&
    /voice_not_loaded/.test(diagnosticSpeechSource) &&
    /voice_fallback_used/.test(diagnosticSpeechSource),
  "browser-synthesized Listening handles start, end, error, and device-voice quality flags",
);
check(
  /writing\?\.timerCompleted === true/.test(diagnosticReportSource) &&
    /!writing\?\.qualityFlags\?\.includes\("writing_paste_detected"\)/.test(diagnosticReportSource) &&
    /writing\?\.timerCompleted !== true/.test(diagnosticReportSource) &&
    /writing\?\.qualityFlags\?\.includes\("writing_paste_detected"\)/.test(diagnosticReportSource) &&
    /addEventListener\("paste", markWritingExternalInsert\)/.test(journeyScript) &&
    /addEventListener\("drop", markWritingExternalInsert\)/.test(journeyScript) &&
    /\["insertFromPaste", "insertFromDrop"\]\.includes\(event\.inputType\)/.test(diagnosticWritingBeforeInputSource) &&
    !/insertReplacementText/.test(diagnosticWritingBeforeInputSource),
  "Writing requires a completed timer, flags explicit paste or drop, and does not misclassify replacement text",
);
check(
  /aria-labelledby="diagnostic-task-title-1"/.test(diagnosticPage) &&
    (diagnosticPage.match(/<h3 id="diagnostic-task-title-\d" tabindex="-1"/g) || []).length === 6 &&
    /setAttribute\("aria-current", "step"\)/.test(renderDiagnosticSource) &&
    /任务 \$\{activeIndex \+ 1\} \/ \$\{DIAGNOSTIC_TASK_IDS\.length\}/.test(renderDiagnosticSource) &&
    /focusDiagnosticTarget\(document\.querySelector\("\[data-diagnostic-task\]:not\(\[hidden\]\) h3"\)\)/.test(journeyScript),
  "diagnostic task transitions expose labelled headings, current-step semantics, progress, and keyboard focus",
);
check(
  /\.diagnostic-task-card audio\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/.test(styles) &&
    /@media \(max-width:\s*560px\)[\s\S]*?\.diagnostic-audio-check\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(styles),
  "diagnostic audio stays within the task card and the audio preflight stacks on narrow screens",
);
check(
  /body\s*\{[\s\S]*?min-width:\s*0;/.test(styles) &&
    /@media \(max-width:\s*1080px\)\s*\{[\s\S]*?\.header-inner\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/.test(
      nextOverrides,
    ) &&
    /@media \(max-width:\s*1080px\)[\s\S]*?\.desktop-nav,\s*\.header-actions\s*\{[\s\S]*?display:\s*none;/.test(
      nextOverrides,
    ) &&
    /@media \(max-width:\s*560px\)[\s\S]*?\.header-inner,[\s\S]*?width:\s*calc\(100% - 32px\);[\s\S]*?\.brand img\s*\{[\s\S]*?width:\s*164px;[\s\S]*?\.nav-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(
      styles,
    ),
  "Next shell preserves the responsive header grid without forcing horizontal overflow",
);
const gate0StatusFetchSource = sourceSection(
  journeyScript,
  "const loadGate0GovernanceStatus",
  "const renderJourneyDashboard",
);
check(
  /数据只保存在当前浏览器，不上传/.test(diagnosticPage) &&
    /不请求麦克风，也不上传自由文本/.test(diagnosticPage) &&
    /microphoneMode:\s*"not_requested"/.test(journeyScript) &&
    (journeyScript.match(/\bfetch\s*\(/g) || []).length === 1 &&
    /fetch\(GATE0_STATUS_PATH,[\s\S]*method: "GET"/.test(gate0StatusFetchSource) &&
    !/\bbody\s*:|localStorage|STORAGE_KEY|state\./.test(gate0StatusFetchSource) &&
    !/getUserMedia|MediaRecorder/.test(journeyScript),
  "diagnostic evidence stays local while the sole GET fetch carries no learner state and reads only governance status",
);

const completedDiagnosticCycleSource = sourceSection(workspaceScript, "const completedDiagnosticCycle", "const completedPlanChain");
const completedPlanChainSource = sourceSection(workspaceScript, "const completedPlanChain", "const completedRecommendationChain");
const completedRecommendationChainSource = sourceSection(workspaceScript, "const completedRecommendationChain", "const showStorageWarning");
const workspaceCheckInSubmitSource = sourceSection(
  workspaceScript,
  'checkinForm.addEventListener("submit"',
  "const updateDataPage",
);
const workspaceCheckInLifecycleSource = sourceSection(
  workspaceScript,
  "let draftTimer;",
  "const updateDataPage",
);
const journeyValidationSource = sourceSection(journeyScript, "const validateCycleEvidence", "const cycleHistoryTopLevelKeys");
const journeyCycleHistoryProjectionSource = sourceSection(
  journeyScript,
  "const cycleHistoryTopLevelKeys",
  "const diagnosticStatusLabels",
);
const journeyPracticeReceiptValidationSource = sourceSection(
  journeyScript,
  "const hasValidPracticeEvidencePayload",
  "const isoNow",
);
const journeyPracticeReceiptMatchesSource = sourceSection(
  journeyScript,
  "const practiceReceiptMatches",
  "const validateCycleEvidence",
);
const journeyEvidenceCatalogSource = sourceSection(
  journeyScript,
  "const PRACTICE_ACTIVITY_CATALOG",
  "const skillLabels",
);
const journeyPracticeCatalogLookupSource = sourceSection(
  journeyScript,
  "const practiceCatalogForSkill",
  "const priorityBasisLabels",
);
const journeyPlanTaskLookupSource = sourceSection(
  journeyScript,
  "const planTaskById",
  "const deriveRecommendationBindingCore",
);
const journeyEvidenceDerivationSource = sourceSection(
  journeyScript,
  "const deriveRecommendationBindingCore",
  "const practiceReceiptMatches",
);
const journeyDiagnosticEvidenceValidationSource = sourceSection(
  journeyScript,
  "const evidenceMatchesManifest",
  "const newTaskEvidence",
);
const workspacePracticeReceiptVersionSource = [
  workspaceScript.match(/const PRACTICE_RECEIPT_VERSION = [^;]+;/)?.[0] || "",
  workspaceScript.match(/const LEGACY_PRACTICE_RECEIPT_VERSION = [^;]+;/)?.[0] || "",
].join("\n");
const workspacePracticeCatalogSource = sourceSection(
  workspaceScript,
  "const PRACTICE_ACTIVITY_CATALOG",
  "const DIAGNOSTIC_TASK_MANIFEST",
);
const workspacePracticeUuidPatternSource = sourceSection(
  workspaceScript,
  "const UUID_V4_PATTERN",
  "const todayKey",
);
const workspacePracticeReceiptValidationSource = sourceSection(
  workspaceScript,
  "const hasValidPracticeEvidencePayload",
  "const completedDiagnosticCycle",
);
const workspacePracticeTaskContextSource = sourceSection(
  workspaceScript,
  "const resolvePracticeTaskContext",
  "const renderPracticeBindingStatus",
);
const workspaceClosedLoopPracticeBindingSource = sourceSection(
  workspaceScript,
  "const closedLoopPracticeBinding",
  "const renderPracticeBindingStatus",
);
const workspacePracticeJourneyScopeSource = sourceSection(
  workspaceScript,
  "const practiceReceiptMatchesJourneyScope",
  "const currentPracticeAttemptScope",
);
const workspaceCurrentPracticeAttemptScopeSource = sourceSection(
  workspaceScript,
  "const currentPracticeAttemptScope",
  "const practiceReceiptMatchesCurrentPageScope",
);
const workspacePracticePageScopeSource = sourceSection(
  workspaceScript,
  "const practiceReceiptMatchesCurrentPageScope",
  "const derivePracticeAttemptBoundary",
);
const workspacePracticeAttemptBoundarySource = sourceSection(
  workspaceScript,
  "const derivePracticeAttemptBoundary",
  "if (practiceRoot?.dataset.exerciseId)",
);
const workspaceNormalizeStateSource = sourceSection(workspaceScript, "const normalizeState", "const loadState");
const workspaceSealPracticeReceiptSource = sourceSection(
  workspaceScript,
  "const sealPracticeReceipt",
  "const setupChoicePractice",
);
const workspaceChoicePracticeSource = sourceSection(
  workspaceScript,
  "const setupChoicePractice",
  "setupChoicePractice({",
);
const workspaceWritingPracticeSource = sourceSection(
  workspaceScript,
  "const writing = document.querySelector",
  "const speakingTime",
);
const workspaceSpeakingPracticeSource = sourceSection(
  workspaceScript,
  "const speakingTime",
  "const focusTime",
);
const workspaceCheckInCandidateSource = sourceSection(
  workspaceScript,
  "const checkInCandidateTasks",
  "checkInCandidateTasks().forEach",
);
const workspaceCheckInSetupSource = sourceSection(
  workspaceScript,
  'const checkinForm = document.querySelector("#checkin-form")',
  "const clearNamespace",
);

const journeyEvidenceHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        const PROTOCOL_VERSION = "gate_a_local_v1";
        const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
        const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
        const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
        ${journeyEvidenceCatalogSource}
        const skillLabels = { Reading: "Reading · 阅读", Listening: "Listening · 听力", Writing: "Writing · 写作", Speaking: "Speaking · 口语" };
        const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        ${journeyPracticeCatalogLookupSource}
        let state = null;
        const activeCycle = () => state?.journey?.activeCycle || null;
        const planById = (planId) => {
          if (!planId) return null;
          if (state?.plan?.planId === planId) return state.plan;
          return state?.planHistory?.find((plan) => plan?.planId === planId) || null;
        };
        const getCycleCheckIn = () => {
          const cycle = activeCycle();
          const records = [
            ...Object.values(state?.checkIns || {}),
            ...(Array.isArray(state?.checkInHistory) ? state.checkInHistory : []),
          ];
          return records.find((record) => record?.checkInId === cycle?.checkInId) || null;
        };
        ${journeyPlanTaskLookupSource}
        ${journeyEvidenceDerivationSource}
        ${journeyDiagnosticEvidenceValidationSource}
        const practiceReceiptMatches = () => true;
        ${journeyValidationSource}
        return {
          PRACTICE_ACTIVITY_CATALOG,
          RETEST_TASK_CATALOG,
          DIAGNOSTIC_TASK_MANIFEST,
          deriveRecommendationBindingCore,
          recommendationBindingMatches,
          deriveRetestOutcome,
          buildCycleEvidenceProjection,
          evaluate(nextState) {
            state = nextState;
            return validateCycleEvidence();
          },
        };
      })()`,
      { URLSearchParams },
    );
  } catch {
    return null;
  }
})();

const cycleHistoryProjectionHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        const PROTOCOL_VERSION = "gate_a_local_v1";
        const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
        const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
        const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
        const PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v2";
        const LEGACY_PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v1";
        ${journeyEvidenceCatalogSource}
        const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        ${journeyPracticeReceiptValidationSource}
        ${journeyPracticeCatalogLookupSource}
        ${journeyPlanTaskLookupSource}
        ${journeyEvidenceDerivationSource}
        ${journeyDiagnosticEvidenceValidationSource}
        ${journeyPracticeReceiptMatchesSource}
        ${journeyCycleHistoryProjectionSource}
        return { buildCycleHistoryProjection };
      })()`,
      { URLSearchParams },
    );
  } catch {
    return null;
  }
})();

const skippedRecommendationJourneyHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        const PROTOCOL_VERSION = "gate_a_local_v1";
        const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
        const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
        const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
        const PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v2";
        const LEGACY_PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v1";
        ${journeyEvidenceCatalogSource}
        const skillLabels = { Reading: "Reading · 阅读", Listening: "Listening · 听力", Writing: "Writing · 写作", Speaking: "Speaking · 口语" };
        const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        ${journeyPracticeReceiptValidationSource}
        ${journeyPracticeCatalogLookupSource}
        let state = null;
        const activeCycle = () => state?.journey?.activeCycle || null;
        const planById = (planId) => {
          if (!planId) return null;
          if (state?.plan?.planId === planId) return state.plan;
          return state?.planHistory?.find((plan) => plan?.planId === planId) || null;
        };
        const getCycleCheckIn = () => {
          const cycle = activeCycle();
          const records = [
            ...Object.values(state?.checkIns || {}),
            ...(Array.isArray(state?.checkInHistory) ? state.checkInHistory : []),
          ];
          return records.find((record) => record?.checkInId === cycle?.checkInId) || null;
        };
        ${journeyPlanTaskLookupSource}
        ${journeyEvidenceDerivationSource}
        ${journeyDiagnosticEvidenceValidationSource}
        ${journeyPracticeReceiptMatchesSource}
        ${journeyValidationSource}
        return {
          PRACTICE_ACTIVITY_CATALOG,
          evaluate(nextState) {
            state = nextState;
            return validateCycleEvidence();
          },
        };
      })()`,
      { URLSearchParams },
    );
  } catch {
    return null;
  }
})();

const skippedRecommendationCandidateHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        let todayTasks = [];
        let recommendationChain = null;
        const getTodayTasks = () => todayTasks;
        const completedRecommendationChain = () => recommendationChain;
        ${workspaceCheckInCandidateSource}
        return {
          evaluate(nextTodayTasks, nextRecommendationChain) {
            todayTasks = nextTodayTasks;
            recommendationChain = nextRecommendationChain;
            return checkInCandidateTasks();
          },
        };
      })()`,
    );
  } catch {
    return null;
  }
})();

const practiceReceiptBoundaryHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        ${workspacePracticeReceiptVersionSource}
        ${workspacePracticeCatalogSource}
        ${workspacePracticeUuidPatternSource}
        const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        ${workspacePracticeReceiptValidationSource}
        ${workspaceClosedLoopPracticeBindingSource}
        ${workspacePracticeJourneyScopeSource}
        let state = null;
        let scopeKey = "standalone:fixture";
        let persistCount = 0;
        const currentPracticeAttemptScope = () => ({ context: null, key: scopeKey });
        const persist = () => {
          persistCount += 1;
          return true;
        };
        ${workspacePracticeAttemptBoundarySource}
        return {
          PRACTICE_ACTIVITY_CATALOG,
          PRACTICE_RECEIPT_VERSION,
          LEGACY_PRACTICE_RECEIPT_VERSION,
          hasValidPracticeReceiptShape,
          hasSafeLegacyPracticeReceiptShape,
          practiceReceiptMatchesJourneyScope,
          derivePracticeAttemptBoundary,
          initializePracticeAttemptScope,
          setState(nextState) {
            state = nextState;
            persistCount = 0;
          },
          getState() {
            return state;
          },
          setScopeKey(nextScopeKey) {
            scopeKey = nextScopeKey;
          },
          getPersistCount() {
            return persistCount;
          },
        };
      })()`,
    );
  } catch {
    return null;
  }
})();

const planBoundPracticeCreationHarness = (() => {
  try {
    return runInNewContext(
      `(() => {
        "use strict";
        ${workspacePracticeReceiptVersionSource}
        ${workspacePracticeCatalogSource}
        ${workspacePracticeUuidPatternSource}
        const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
        ${workspacePracticeReceiptValidationSource}
        let state = null;
        let uuidCounter = 1;
        let appendCallCount = 0;
        const window = { location: { pathname: "/practice-reading", search: "" } };
        const createUuid = () => {
          const suffix = String(uuidCounter).padStart(12, "0");
          uuidCounter += 1;
          return \`00000000-0000-4000-8000-\${suffix}\`;
        };
        const currentPlanTaskById = (taskId) =>
          state.plan?.days?.flatMap((day) => day.tasks || []).find((task) => task.taskId === taskId) || null;
        const qualifyingPracticeReceiptForTask = () => null;
        const practiceReceiptMatchesJourneyScope = () => false;
        ${workspacePracticeTaskContextSource}
        ${workspaceSealPracticeReceiptSource}
        const appendLearningEvent = async () => {
          appendCallCount += 1;
          return { status: "appended" };
        };
        ${practiceFinalizationBoundarySource}
        return {
          PRACTICE_ACTIVITY_CATALOG,
          async execute(nextState, taskId) {
            state = nextState;
            appendCallCount = 0;
            window.location.search = \`?plan_id=\${encodeURIComponent(state.plan.planId)}&task_id=\${encodeURIComponent(taskId)}\`;
            const completedAt = new Date().toISOString();
            const startedAt = new Date(Date.parse(completedAt) - 1000).toISOString();
            const receipt = sealPracticeReceipt("Reading", "reading-library-v1", completedAt, {
              firstResponse: "b",
              finalResponse: "b",
              attemptCount: 1,
              qualityFlags: [],
              startedAt,
            });
            const eventOutcome = receipt
              ? await appendPracticeFinalizationEvent(receipt)
              : { status: "receipt_invalid" };
            return { receipt, eventOutcome, appendCallCount, state, completedAt, startedAt };
          },
        };
      })()`,
      { URLSearchParams, encodeURIComponent, Date },
    );
  } catch {
    return null;
  }
})();

const createPlanBoundPracticeState = ({ withRecommendation, taskId, recommendationStatus = "accepted" }) => {
  if (!planBoundPracticeCreationHarness) throw new Error("PLAN_BOUND_PRACTICE_CREATION_HARNESS_UNAVAILABLE");
  const catalog = planBoundPracticeCreationHarness.PRACTICE_ACTIVITY_CATALOG["reading-library-v1"];
  const planId = "plan-bound-practice-fixture";
  const cycleId = "cycle-bound-practice-fixture";
  const diagnosticSessionId = "diagnostic-bound-practice-fixture";
  const recommendationId = withRecommendation ? "recommendation-bound-practice-fixture" : null;
  const makeTask = (id) => ({
    taskId: id,
    date: "2026-08-10",
    skill: "Reading",
    route: catalog.route,
    contentRef: {
      exerciseId: "reading-library-v1",
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
    },
  });
  const primaryTask = makeTask("task-recommendation-primary-fixture");
  const selectedTask = makeTask(taskId);
  return {
    schemaVersion: 1,
    plan: { planId, days: [{ date: "2026-08-10", tasks: [primaryTask, selectedTask] }] },
    taskProgress: {},
    practice: {},
    practiceReceipts: {},
    journey: {
      activeCycle: {
        status: "in_progress",
        basePlanId: planId,
        cycleId,
        diagnosticSessionId,
        recommendationId,
      },
      recommendation: withRecommendation ? {
        recommendationId,
        cycleId,
        diagnosticSessionId,
        planId,
        status: recommendationStatus,
        primary: { taskId: primaryTask.taskId, skill: primaryTask.skill },
        evidenceBinding: {
          cycleId,
          diagnosticSessionId,
          practiceTaskId: primaryTask.taskId,
        },
      } : null,
    },
  };
};

check(
  Boolean(
    planBoundPracticeCreationHarness &&
    workspacePracticeTaskContextSource &&
    workspaceSealPracticeReceiptSource &&
    practiceFinalizationBoundarySource
  ),
  "plan-bound practice receipt and event-boundary functions load into an executable isolated fixture",
);
await checkExecutableAsync(
  "active cycle without a recommendation creates a plan-bound cycle-null receipt and skips event projection",
  async () => {
    const taskId = "task-plan-before-recommendation-fixture";
    const initialState = createPlanBoundPracticeState({ withRecommendation: false, taskId });
    const result = await planBoundPracticeCreationHarness.execute(initialState, taskId);
    const receipt = result.receipt;
    return Boolean(
      receipt &&
      receipt.planId === initialState.plan.planId &&
      receipt.taskId === taskId &&
      receipt.taskRef?.planId === initialState.plan.planId &&
      receipt.taskRef?.taskId === taskId &&
      receipt.cycleId === null &&
      receipt.taskRef?.cycleId === null &&
      receipt.diagnosticSessionId === null &&
      receipt.taskRef?.diagnosticSessionId === null &&
      receipt.recommendationId === null &&
      receipt.evidenceStatus === "evidence_limited" &&
      receipt.startedAt === result.startedAt &&
      receipt.completedAt === result.completedAt &&
      result.eventOutcome.status === "not_applicable" &&
      result.appendCallCount === 0 &&
      result.state.taskProgress[taskId]?.practiceReceiptId === receipt.completionReceiptId &&
      result.state.taskProgress[taskId]?.updatedAt === result.completedAt &&
      result.state.taskProgress[taskId]?.completedAt === result.completedAt &&
      result.state.practiceReceipts[receipt.completionReceiptId] === receipt
    );
  },
);
await checkExecutableAsync(
  "non-primary task after recommendation stays plan-bound and cycle-null instead of reaching invalid_practice_domain",
  async () => {
    const taskId = "task-non-primary-after-recommendation-fixture";
    const initialState = createPlanBoundPracticeState({ withRecommendation: true, taskId });
    const primaryTaskId = initialState.journey.recommendation.evidenceBinding.practiceTaskId;
    const result = await planBoundPracticeCreationHarness.execute(initialState, taskId);
    const receipt = result.receipt;
    return Boolean(
      taskId !== primaryTaskId &&
      receipt &&
      receipt.planId === initialState.plan.planId &&
      receipt.taskId === taskId &&
      receipt.taskRef?.planId === initialState.plan.planId &&
      receipt.taskRef?.taskId === taskId &&
      receipt.cycleId === null &&
      receipt.taskRef?.cycleId === null &&
      receipt.diagnosticSessionId === null &&
      receipt.taskRef?.diagnosticSessionId === null &&
      receipt.recommendationId === null &&
      receipt.evidenceStatus === "evidence_limited" &&
      result.eventOutcome.status === "not_applicable" &&
      result.eventOutcome.code !== "invalid_practice_domain" &&
      result.appendCallCount === 0 &&
      result.state.taskProgress[taskId]?.practiceReceiptId === receipt.completionReceiptId &&
      result.state.practiceReceipts[receipt.completionReceiptId] === receipt
    );
  },
);
await checkExecutableAsync(
  "a skipped recommendation binds one same-skill non-primary plan task while the skipped primary cannot advance",
  async () => {
    const alternativeTaskId = "task-skipped-alternative-fixture";
    const alternativeState = createPlanBoundPracticeState({
      withRecommendation: true,
      taskId: alternativeTaskId,
      recommendationStatus: "skipped",
    });
    const alternativeResult = await planBoundPracticeCreationHarness.execute(alternativeState, alternativeTaskId);
    const alternativeReceipt = alternativeResult.receipt;
    const primaryTaskId = alternativeState.journey.recommendation.primary.taskId;
    const primaryState = createPlanBoundPracticeState({
      withRecommendation: true,
      taskId: primaryTaskId,
      recommendationStatus: "skipped",
    });
    const primaryResult = await planBoundPracticeCreationHarness.execute(primaryState, primaryTaskId);
    return Boolean(
      alternativeReceipt?.taskId === alternativeTaskId &&
      alternativeReceipt.cycleId === alternativeState.journey.activeCycle.cycleId &&
      alternativeReceipt.diagnosticSessionId === alternativeState.journey.activeCycle.diagnosticSessionId &&
      alternativeReceipt.recommendationId === alternativeState.journey.recommendation.recommendationId &&
      alternativeResult.eventOutcome.status === "appended" &&
      alternativeResult.appendCallCount === 1 &&
      primaryResult.receipt?.taskId === primaryTaskId &&
      primaryResult.receipt.cycleId === null &&
      primaryResult.receipt.diagnosticSessionId === null &&
      primaryResult.receipt.recommendationId === null &&
      primaryResult.eventOutcome.status === "not_applicable" &&
      primaryResult.appendCallCount === 0
    );
  },
);

const createPracticeReceiptBoundaryFixture = ({
  protocolVersion = practiceReceiptBoundaryHarness?.PRACTICE_RECEIPT_VERSION,
  planId = "plan-scope-fixture",
  taskId = "task-scope-fixture",
  cycleId = "cycle-scope-fixture",
  diagnosticSessionId = "diagnostic-scope-fixture",
  recommendationId = "recommendation-scope-fixture",
  practiceAttemptId = "11111111-1111-4111-8111-111111111111",
  completionReceiptId = "22222222-2222-4222-8222-222222222222",
} = {}) => {
  if (!practiceReceiptBoundaryHarness) throw new Error("PRACTICE_RECEIPT_BOUNDARY_HARNESS_UNAVAILABLE");
  const catalog = practiceReceiptBoundaryHarness.PRACTICE_ACTIVITY_CATALOG["reading-library-v1"];
  const taskDate = "2026-08-10";
  const task = {
    taskId,
    date: taskDate,
    skill: catalog.skill,
    route: catalog.route,
    contentRef: {
      exerciseId: "reading-library-v1",
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
    },
  };
  const plan = { planId };
  const cycle = {
    status: "in_progress",
    basePlanId: planId,
    cycleId,
    diagnosticSessionId,
    recommendationId,
  };
  const recommendation = {
    recommendationId,
    cycleId,
    diagnosticSessionId,
    planId,
    status: "accepted",
    primary: { taskId, skill: catalog.skill },
    evidenceBinding: {
      cycleId,
      diagnosticSessionId,
      practiceTaskId: taskId,
    },
  };
  const receipt = {
    protocolVersion,
    practiceAttemptId,
    completionReceiptId,
    sealed: true,
    ownerScope: "browser_local_not_account_bound",
    integrityClass: "unsigned_local_receipt",
    exerciseId: "reading-library-v1",
    activityId: catalog.activityId,
    activityVersion: catalog.activityVersion,
    contentId: catalog.contentId,
    contentHash: catalog.contentHash,
    taskId,
    taskDate,
    planId,
    cycleId,
    diagnosticSessionId,
    recommendationId,
    taskRef: {
      planId,
      taskId,
      taskDate,
      cycleId,
      diagnosticSessionId,
    },
    contentRef: {
      exerciseId: "reading-library-v1",
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
    },
    skill: catalog.skill,
    route: catalog.route,
    status: "completed",
    completionSource: "guided_practice",
    evidenceClass: "practice_receipt",
    receiptEvidenceClass: catalog.receiptEvidenceClass,
    evidenceType: catalog.evidenceType,
    completionCondition: catalog.completionCondition,
    evidenceStatus: "evidence_limited",
    attemptCount: 1,
    wordCount: null,
    selfCheckCount: null,
    audioPlayed: false,
    audioCompleted: false,
    audioRecorded: false,
    qualityFlags: [],
    evidence: {
      firstResponse: catalog.correctValue,
      finalResponse: catalog.correctValue,
      attemptCount: 1,
      resultType: "correct",
    },
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    officialEquivalenceClaimed: false,
    startedAt: "2026-08-10T00:00:00.000Z",
    completedAt: "2026-08-10T00:01:00.000Z",
  };
  if (protocolVersion === practiceReceiptBoundaryHarness.LEGACY_PRACTICE_RECEIPT_VERSION) {
    delete receipt.evidence;
  }
  return { catalog, task, plan, cycle, recommendation, receipt };
};

const createJourneyEvidenceFixture = () => {
  if (!journeyEvidenceHarness) throw new Error("JOURNEY_EVIDENCE_HARNESS_UNAVAILABLE");
  const practiceCatalog = journeyEvidenceHarness.PRACTICE_ACTIVITY_CATALOG["reading-library-v1"];
  const retestCatalog = journeyEvidenceHarness.RETEST_TASK_CATALOG.Reading;
  const cycle = {
    protocolVersion: "gate_a_local_v1",
    cycleId: "cycle-fixture",
    diagnosticSessionId: "diagnostic-fixture",
    basePlanId: "plan-base-fixture",
    recommendationId: "recommendation-fixture",
    checkInId: "check-in-fixture",
    reviewId: "review-fixture",
    peerHelpId: "peer-help-fixture",
    retestId: "retest-fixture",
    updatedPlanId: "plan-updated-fixture",
    status: "completed",
  };
  const diagnosticEvidence = Object.entries(journeyEvidenceHarness.DIAGNOSTIC_TASK_MANIFEST).map(
    ([taskId, expected]) => {
      const objective = ["single_choice", "single_choice_audio"].includes(expected.responseType);
      const isPatternEvidence = taskId === "diagnostic-reading-library-v1";
      const descriptor = Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "correctValue"));
      const firstResponse = isPatternEvidence
        ? (["a", "b", "c"].find((value) => value !== expected.correctValue) || "a")
        : expected.correctValue;
      return {
        taskId,
        ...descriptor,
        status: "completed",
        evidenceStatus: "evidence_limited",
        qualityFlags: [],
        ...(objective
          ? {
              attempts: 1,
              firstResponse,
              resultType: isPatternEvidence ? "first_response_not_matched" : "first_response_matched",
            }
          : {}),
      };
    },
  );
  const diagnostic = {
    protocolVersion: "gate_a_local_v1",
    diagnosticProtocolVersion: "gate_a_diagnostic_evidence_v1",
    taskSetVersion: "gate_a_original_6_v1",
    taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    status: "completed",
    activeTaskId: null,
    adultConfirmed: true,
    devicePrecheck: { storageStatus: "available" },
    taskEvidence: diagnosticEvidence,
    prioritySkill: "Reading",
    priorityBasis: "objective_first_response_pattern",
    learnerConfirmedPriority: true,
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    report: { priorityExplanation: "Reading evidence fixture" },
  };
  const baseTask = {
    taskId: "practice-task-fixture",
    titleZh: "完成一篇英文短文阅读",
    skill: "Reading",
    route: practiceCatalog.route,
    durationMinutes: 20,
    contentRef: {
      exerciseId: "reading-library-v1",
      contentId: practiceCatalog.contentId,
      contentVersion: practiceCatalog.activityVersion,
      contentHash: practiceCatalog.contentHash,
    },
  };
  const basePlan = {
    planId: cycle.basePlanId,
    focusSkill: "Reading",
    days: [{ date: "2026-08-10", coreSkill: "Reading", tasks: [baseTask] }],
    provenance: {
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
    },
  };
  const primary = {
    role: "主任务",
    taskId: baseTask.taskId,
    skill: "Reading",
    exerciseId: "reading-library-v1",
    contentId: practiceCatalog.contentId,
    contentVersion: practiceCatalog.activityVersion,
    contentHash: practiceCatalog.contentHash,
    title: baseTask.titleZh,
    route: `${baseTask.route}?${new URLSearchParams({ plan_id: basePlan.planId, task_id: baseTask.taskId }).toString()}`,
    reason: diagnostic.report.priorityExplanation,
    duration: `${baseTask.durationMinutes} 分钟`,
    source: "Sufeiya 原创 Gate A 微练习 v1 · 未经教研与测量双签",
    verification: "从本绑定入口完成任务并生成本机练习回执，再在复盘页引用同一回执。",
    reviewStatus: "gate_a_unreviewed",
    reviewedAt: null,
    prerequisites: ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"],
  };
  const bindingCore = journeyEvidenceHarness.deriveRecommendationBindingCore({
    cycle,
    diagnostic,
    plan: basePlan,
    primary,
  });
  if (!bindingCore) throw new Error("RECOMMENDATION_BINDING_FIXTURE_INVALID");
  const recommendation = {
    recommendationId: cycle.recommendationId,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    planId: cycle.basePlanId,
    status: "accepted",
    primary,
    evidenceBinding: {
      bindingId: "recommendation-binding-fixture",
      ...bindingCore,
      createdAt: "2026-08-10T00:00:00.000Z",
    },
  };
  const practiceReceipt = {
    practiceAttemptId: "practice-attempt-fixture",
    completionReceiptId: "practice-receipt-fixture",
    skill: "Reading",
  };
  const checkIn = {
    status: "saved",
    checkInId: cycle.checkInId,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    planId: cycle.basePlanId,
    recommendationId: cycle.recommendationId,
    didText: "completed-task",
    evidenceText: "evidence-note",
    questionStatus: "none",
    linkedTaskId: baseTask.taskId,
    evidenceClass: "practice_receipt",
    practiceAttemptId: practiceReceipt.practiceAttemptId,
    taskCompletionReceiptId: practiceReceipt.completionReceiptId,
    practiceReceipt,
    reviewId: cycle.reviewId,
    learnerConfirmedReview: true,
  };
  const derivedRetestOutcome = journeyEvidenceHarness.deriveRetestOutcome("Reading", {
    responseType: retestCatalog.responseType,
    selectedAnswer: retestCatalog.correctValue,
  });
  if (!derivedRetestOutcome) throw new Error("RETEST_OUTCOME_FIXTURE_INVALID");
  const retestEvidence = {
    responseType: retestCatalog.responseType,
    selectedAnswer: retestCatalog.correctValue,
    resultType: derivedRetestOutcome.resultType,
  };
  const updatedPlan = {
    planId: cycle.updatedPlanId,
    focusSkill: "Reading",
    provenance: {
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      retestId: cycle.retestId,
      supersedesPlanId: cycle.basePlanId,
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
    },
  };
  return {
    schemaVersion: 1,
    plan: updatedPlan,
    planHistory: [basePlan],
    taskProgress: {
      [baseTask.taskId]: {
        completionClass: "practice_receipt",
        practiceReceiptId: practiceReceipt.completionReceiptId,
      },
    },
    practiceReceipts: { [practiceReceipt.completionReceiptId]: practiceReceipt },
    checkIns: { fixture: checkIn },
    checkInHistory: [],
    journey: {
      protocolVersion: "gate_a_local_v1",
      activeCycle: cycle,
      diagnostic,
      recommendation,
      review: {
        cycleId: cycle.cycleId,
        reviewId: cycle.reviewId,
        checkInId: cycle.checkInId,
        learnerConfirmed: true,
      },
      peerHelp: {
        cycleId: cycle.cycleId,
        peerHelpId: cycle.peerHelpId,
        planId: cycle.basePlanId,
        reviewId: cycle.reviewId,
        status: "declined",
        realCommunityUsed: false,
      },
      retest: {
        status: "completed",
        retestId: cycle.retestId,
        cycleId: cycle.cycleId,
        diagnosticSessionId: cycle.diagnosticSessionId,
        planId: cycle.basePlanId,
        recommendationId: cycle.recommendationId,
        checkInId: cycle.checkInId,
        reviewId: cycle.reviewId,
        peerHelpId: cycle.peerHelpId,
        skill: "Reading",
        baselineTaskId: baseTask.taskId,
        baselinePracticeReceiptId: practiceReceipt.completionReceiptId,
        parallelTaskId: retestCatalog.taskId,
        taskVersion: retestCatalog.taskVersion,
        parallelFormPairId: retestCatalog.parallelFormPairId,
        parallelRetest: true,
        comparability: {
          targetSkill: "Reading",
          sameSkill: true,
          sameAsDiagnosticPriority: true,
          sameAsPlanTask: true,
          sameAsPracticeReceipt: true,
          newOriginalPrompt: true,
          constructAlignment: retestCatalog.constructAlignment,
          teacherReviewed: false,
          measurementReviewed: false,
          officialEquivalenceClaimed: false,
          comparisonBoundary: "same_skill_only_no_calibrated_construct_or_difficulty_equivalence",
        },
        evidence: retestEvidence,
        evidenceStatus: derivedRetestOutcome.evidenceStatus,
        evidenceSufficiency: derivedRetestOutcome.evidenceSufficiency,
        humanConfirmationStatus: derivedRetestOutcome.humanConfirmationStatus,
        automatedScoreProduced: false,
        growthClaimProduced: false,
      },
      planUpdate: {
        cycleId: cycle.cycleId,
        retestId: cycle.retestId,
        supersedesPlanId: cycle.basePlanId,
        updatedPlanId: cycle.updatedPlanId,
        learnerConfirmed: true,
        focusSkill: "Reading",
        confirmationClass: "learner_confirmed_gate_a",
        humanConfirmationStatus: "not_required_for_gate_a_flow",
      },
      history: [],
    },
  };
};

const createCycleHistoryProjectionFixture = ({ index = 1, provisional = false } = {}) => {
  const token = `fixture-${index}`;
  const state = JSON.parse(JSON.stringify(createJourneyEvidenceFixture()).replaceAll("fixture", token));
  const cycle = state.journey.activeCycle;
  const diagnostic = state.journey.diagnostic;
  const basePlan = state.planHistory[0];
  const updatedPlan = state.plan;
  const recommendation = state.journey.recommendation;
  const checkIn = state.checkIns[token];
  const review = state.journey.review;
  const peerHelp = state.journey.peerHelp;
  const retest = state.journey.retest;
  const planUpdate = state.journey.planUpdate;
  const baseTask = basePlan.days[0].tasks[0];
  const practiceCatalog = journeyEvidenceHarness.PRACTICE_ACTIVITY_CATALOG["reading-library-v1"];
  const day = String(10 + index).padStart(2, "0");
  const at = (clock) => `2026-08-${day}T${clock}.000Z`;
  const uuid = (offset) => `00000000-0000-4${String(index).padStart(3, "0")}-8000-${String(index * 100 + offset).padStart(12, "0")}`;
  const hash = (offset) => (index.toString(16) + offset.toString(16)).padStart(64, "0").slice(-64);
  const practiceAttemptId = uuid(1);
  const practiceReceiptId = uuid(2);

  cycle.createdAt = at("00:00:00");
  cycle.updatedAt = at("00:10:00");
  cycle.closedAt = provisional ? null : at("00:10:00");
  cycle.provisionalAt = provisional ? at("00:10:00") : null;
  cycle.status = provisional ? "provisional_pending_human_review" : "completed";

  diagnostic.createdAt = at("00:00:00");
  diagnostic.completedAt = at("00:02:00");
  diagnostic.updatedAt = diagnostic.completedAt;
  diagnostic.taskEvidence = diagnostic.taskEvidence.map((evidence, evidenceIndex) => ({
    ...evidence,
    startedAt: at(`00:00:${String(10 + evidenceIndex).padStart(2, "0")}`),
    completedAt: at("00:01:00"),
    updatedAt: at("00:01:00"),
  }));

  baseTask.date = `2026-08-${day}`;
  basePlan.createdAt = at("00:03:00");
  basePlan.status = "superseded";
  basePlan.supersededAt = at("00:10:00");
  basePlan.supersededByRetestId = cycle.retestId;
  basePlan.nickname = `PRIVATE-NAME-${index}`;
  basePlan.examDate = `PRIVATE-EXAM-${index}`;
  updatedPlan.createdAt = at("00:10:01");
  updatedPlan.focusSkill = "Listening";

  recommendation.evidenceBinding.createdAt = at("00:04:00");
  recommendation.createdAt = at("00:04:01");
  recommendation.updatedAt = recommendation.createdAt;

  const practiceReceipt = {
    protocolVersion: "sufeiya_practice_receipt_v2",
    practiceAttemptId,
    completionReceiptId: practiceReceiptId,
    sealed: true,
    ownerScope: "browser_local_not_account_bound",
    integrityClass: "unsigned_local_receipt",
    exerciseId: "reading-library-v1",
    activityId: practiceCatalog.activityId,
    activityVersion: practiceCatalog.activityVersion,
    contentId: practiceCatalog.contentId,
    contentHash: practiceCatalog.contentHash,
    taskId: baseTask.taskId,
    taskDate: baseTask.date,
    planId: basePlan.planId,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    recommendationId: cycle.recommendationId,
    taskRef: {
      planId: basePlan.planId,
      taskId: baseTask.taskId,
      taskDate: baseTask.date,
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
    },
    contentRef: {
      exerciseId: "reading-library-v1",
      contentId: practiceCatalog.contentId,
      contentVersion: practiceCatalog.activityVersion,
      contentHash: practiceCatalog.contentHash,
    },
    skill: "Reading",
    route: practiceCatalog.route,
    status: "completed",
    completionSource: "guided_practice",
    evidenceClass: "practice_receipt",
    receiptEvidenceClass: practiceCatalog.receiptEvidenceClass,
    evidenceType: practiceCatalog.evidenceType,
    completionCondition: practiceCatalog.completionCondition,
    evidenceStatus: "evidence_limited",
    attemptCount: 1,
    wordCount: null,
    selfCheckCount: null,
    audioPlayed: false,
    audioCompleted: false,
    audioRecorded: false,
    qualityFlags: [],
    evidence: {
      firstResponse: practiceCatalog.correctValue,
      finalResponse: practiceCatalog.correctValue,
      attemptCount: 1,
      resultType: "correct",
    },
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    officialEquivalenceClaimed: false,
    startedAt: at("00:04:30"),
    completedAt: at("00:05:00"),
  };
  checkIn.practiceAttemptId = practiceAttemptId;
  checkIn.taskCompletionReceiptId = practiceReceiptId;
  checkIn.practiceReceipt = structuredClone(practiceReceipt);
  checkIn.savedAt = at("00:06:00");
  checkIn.updatedAt = at("00:07:00");
  checkIn.reviewedAt = at("00:07:00");
  state.practiceReceipts = { [practiceReceiptId]: structuredClone(practiceReceipt) };
  state.taskProgress = {
    [baseTask.taskId]: {
      status: "completed",
      completionClass: "practice_receipt",
      practiceReceiptId,
    },
  };

  review.confirmedAt = at("00:07:00");
  peerHelp.createdAt = at("00:08:00");
  peerHelp.updatedAt = at("00:08:00");
  retest.baselinePracticeReceiptId = practiceReceiptId;
  retest.completedAt = at("00:09:00");
  if (provisional) {
    retest.evidence.selectedAnswer = "a";
    const derived = journeyEvidenceHarness.deriveRetestOutcome(retest.skill, retest.evidence);
    retest.evidence.resultType = derived.resultType;
    retest.evidenceStatus = derived.evidenceStatus;
    retest.evidenceSufficiency = derived.evidenceSufficiency;
    retest.humanConfirmationStatus = derived.humanConfirmationStatus;
    planUpdate.confirmationClass = "provisional_pending_human_review";
    planUpdate.humanConfirmationStatus = "required_not_completed";
  }
  planUpdate.focusSkill = updatedPlan.focusSkill;
  planUpdate.automatedAbilityDecision = false;
  planUpdate.createdAt = at("00:10:00");

  const alias = {
    cycle: uuid(10),
    diagnostic: uuid(11),
    plan: uuid(12),
    recommendation: uuid(13),
    binding: uuid(14),
    task: uuid(15),
    practiceAttempt: uuid(16),
    practiceReceipt: uuid(17),
    checkIn: uuid(18),
    retest: uuid(19),
    updatedPlan: uuid(20),
  };
  const privacy = {
    classification: "pseudonymous_local_learning_metadata",
    containsDirectIdentifier: false,
    containsAccountIdentifier: false,
    containsClerkIdentifier: false,
    containsFreeText: false,
    containsRawResponse: false,
    containsAudio: false,
    containsSofiaContent: false,
  };
  const governance = {
    storageScope: "browser_local_only",
    corruptionPolicy: "fail_closed",
    networkDispatch: "disabled",
    lrsDispatch: "disabled",
    xapiDispatch: "disabled",
    sofiaAccess: "forbidden",
  };
  const makeEvent = (offset, eventType, occurredAt, context, attributes) => ({
    eventId: uuid(30 + offset),
    eventHash: hash(30 + offset),
    eventType,
    occurredAt,
    context,
    attributes,
    privacy: structuredClone(privacy),
    governance: structuredClone(governance),
  });
  const events = [
    makeEvent(0, "learning_cycle.started", cycle.createdAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
    }, {
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
    }),
    makeEvent(1, "recommendation.decided", recommendation.createdAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
      planId: alias.plan,
      recommendationId: alias.recommendation,
      bindingId: alias.binding,
    }, { decision: recommendation.status }),
    makeEvent(2, "practice_attempt.finalized", practiceReceipt.completedAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
      planId: alias.plan,
      recommendationId: alias.recommendation,
      bindingId: alias.binding,
      taskId: alias.task,
      attemptId: alias.practiceAttempt,
      practiceReceiptId: alias.practiceReceipt,
    }, { skill: diagnostic.prioritySkill }),
    makeEvent(3, "check_in.committed", checkIn.savedAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
      planId: alias.plan,
      recommendationId: alias.recommendation,
      bindingId: alias.binding,
      taskId: alias.task,
      practiceReceiptId: alias.practiceReceipt,
      checkInId: alias.checkIn,
    }, {}),
    makeEvent(4, "retest.completed", retest.completedAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
      planId: alias.plan,
      recommendationId: alias.recommendation,
      bindingId: alias.binding,
      checkInId: alias.checkIn,
      retestId: alias.retest,
      baselinePracticeReceiptId: alias.practiceReceipt,
    }, {
      skill: diagnostic.prioritySkill,
      humanConfirmationStatus: retest.humanConfirmationStatus,
    }),
  ];
  if (!provisional) {
    events.push(makeEvent(5, "learning_cycle.completed", cycle.closedAt, {
      learningCycleId: alias.cycle,
      diagnosticSessionId: alias.diagnostic,
      planId: alias.plan,
      retestId: alias.retest,
      updatedPlanId: alias.updatedPlan,
    }, {
      nextFocusSkill: planUpdate.focusSkill,
      humanConfirmationStatus: planUpdate.humanConfirmationStatus,
    }));
  }

  state.learningEventBindings = {
    records: {
      cycle: { [cycle.cycleId]: alias.cycle },
      diagnostic: { [cycle.diagnosticSessionId]: alias.diagnostic },
      plan: { [cycle.basePlanId]: alias.plan },
      recommendation: { [cycle.recommendationId]: alias.recommendation },
      binding: { [recommendation.evidenceBinding.bindingId]: alias.binding },
      task: { [baseTask.taskId]: alias.task },
      practiceAttempt: { [practiceAttemptId]: alias.practiceAttempt },
      practiceReceipt: { [practiceReceiptId]: alias.practiceReceipt },
      checkIn: { [cycle.checkInId]: alias.checkIn },
      retest: { [cycle.retestId]: alias.retest },
      updatedPlan: { [cycle.updatedPlanId]: alias.updatedPlan },
    },
  };
  state.learningEvents = events;
  state.journey.history = [{
    ...cycle,
    diagnostic,
    recommendation,
    checkIn,
    review,
    peerHelp,
    retest,
    planUpdate,
  }];
  state.journey.activeCycle = null;
  state.sofiaChat = `PRIVATE-SOFIA-${index}`;
  return state;
};

const mergeCycleHistoryProjectionFixtures = (fixtures) => {
  const merged = structuredClone(fixtures[0]);
  merged.plan = null;
  merged.planHistory = [];
  merged.taskProgress = {};
  merged.practiceReceipts = {};
  merged.learningEvents = [];
  merged.learningEventBindings = { records: {} };
  merged.journey.activeCycle = null;
  merged.journey.history = [];
  for (const fixture of fixtures) {
    merged.planHistory.push(fixture.plan, ...fixture.planHistory);
    Object.assign(merged.taskProgress, fixture.taskProgress);
    Object.assign(merged.practiceReceipts, fixture.practiceReceipts);
    merged.learningEvents.push(...fixture.learningEvents);
    merged.journey.history.push(...fixture.journey.history);
    for (const [kind, records] of Object.entries(fixture.learningEventBindings.records)) {
      merged.learningEventBindings.records[kind] = {
        ...(merged.learningEventBindings.records[kind] || {}),
        ...records,
      };
    }
  }
  return merged;
};

const createSkippedRecommendationPracticeReceipt = ({ state, task, practiceAttemptId, completionReceiptId }) => {
  if (!skippedRecommendationJourneyHarness) throw new Error("SKIPPED_RECOMMENDATION_JOURNEY_HARNESS_UNAVAILABLE");
  const cycle = state.journey.activeCycle;
  const recommendation = state.journey.recommendation;
  const plan = state.planHistory.find((candidate) => candidate.planId === cycle.basePlanId);
  const exerciseId = task.contentRef.exerciseId;
  const catalog = skippedRecommendationJourneyHarness.PRACTICE_ACTIVITY_CATALOG[exerciseId];
  if (!plan || !catalog) throw new Error("SKIPPED_RECOMMENDATION_RECEIPT_FIXTURE_INVALID");
  return {
    protocolVersion: "sufeiya_practice_receipt_v2",
    practiceAttemptId,
    completionReceiptId,
    sealed: true,
    ownerScope: "browser_local_not_account_bound",
    integrityClass: "unsigned_local_receipt",
    exerciseId,
    activityId: catalog.activityId,
    activityVersion: catalog.activityVersion,
    contentId: catalog.contentId,
    contentHash: catalog.contentHash,
    taskId: task.taskId,
    taskDate: task.date,
    planId: plan.planId,
    cycleId: cycle.cycleId,
    diagnosticSessionId: cycle.diagnosticSessionId,
    recommendationId: cycle.recommendationId,
    taskRef: {
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      planId: plan.planId,
      taskId: task.taskId,
      taskDate: task.date,
    },
    contentRef: {
      exerciseId,
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
    },
    skill: task.skill,
    route: task.route,
    status: "completed",
    completionSource: "guided_practice",
    evidenceClass: "practice_receipt",
    receiptEvidenceClass: catalog.receiptEvidenceClass,
    evidenceType: catalog.evidenceType,
    completionCondition: catalog.completionCondition,
    evidenceStatus: "evidence_limited",
    attemptCount: 1,
    wordCount: null,
    selfCheckCount: null,
    audioPlayed: false,
    audioCompleted: false,
    audioRecorded: false,
    qualityFlags: [],
    evidence: {
      firstResponse: catalog.correctValue,
      finalResponse: catalog.correctValue,
      attemptCount: 1,
      resultType: "correct",
    },
    automatedScoreProduced: false,
    formalDiagnosisProduced: false,
    officialEquivalenceClaimed: false,
    startedAt: "2026-08-10T03:00:00.000Z",
    completedAt: "2026-08-10T03:01:00.000Z",
    recommendationStatusAtSeal: recommendation.status,
  };
};

const createSkippedRecommendationJourneyFixture = ({ linkedTaskKind = "primary", storage = "current" } = {}) => {
  const state = createJourneyEvidenceFixture();
  const basePlan = state.planHistory[0];
  const primaryTask = basePlan.days[0].tasks[0];
  primaryTask.date = basePlan.days[0].date;
  const alternativeTask = {
    ...structuredClone(primaryTask),
    taskId: "practice-task-alternative-fixture",
    titleZh: "完成另一项同技能英文短文阅读",
  };
  basePlan.days[0].tasks.push(alternativeTask);
  state.journey.recommendation.status = "skipped";
  const linkedTask = linkedTaskKind === "alternative" ? alternativeTask : primaryTask;
  const primaryLinked = linkedTask === primaryTask;
  const practiceReceipt = createSkippedRecommendationPracticeReceipt({
    state,
    task: linkedTask,
    practiceAttemptId: primaryLinked
      ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      : "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    completionReceiptId: primaryLinked
      ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      : "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  });
  const checkIn = structuredClone(state.checkIns.fixture);
  checkIn.linkedTaskId = linkedTask.taskId;
  checkIn.practiceAttemptId = practiceReceipt.practiceAttemptId;
  checkIn.taskCompletionReceiptId = practiceReceipt.completionReceiptId;
  checkIn.practiceReceipt = practiceReceipt;
  state.taskProgress = {
    [linkedTask.taskId]: {
      status: "completed",
      selfReported: false,
      completionClass: "practice_receipt",
      practiceReceiptId: practiceReceipt.completionReceiptId,
    },
  };
  state.practiceReceipts = { [practiceReceipt.completionReceiptId]: practiceReceipt };
  if (storage === "history") {
    state.checkIns = {};
    state.checkInHistory = [checkIn];
  } else {
    state.checkIns = { fixture: checkIn };
    state.checkInHistory = [];
  }
  return { state, basePlan, primaryTask, alternativeTask, linkedTask, practiceReceipt, checkIn };
};

check(
  Boolean(
    journeyEvidenceHarness &&
      journeyEvidenceCatalogSource &&
      journeyPracticeCatalogLookupSource &&
      journeyPlanTaskLookupSource &&
      journeyEvidenceDerivationSource &&
      journeyDiagnosticEvidenceValidationSource &&
      journeyValidationSource
  ),
  "journey evidence pure functions and central validator load into an executable isolated fixture",
);
check(
  Boolean(
    skippedRecommendationJourneyHarness &&
      skippedRecommendationCandidateHarness &&
      journeyPracticeReceiptValidationSource &&
      journeyPracticeReceiptMatchesSource &&
      workspaceCheckInCandidateSource
  ),
  "skipped recommendation candidate and central-validator functions load into executable isolated fixtures",
);
checkExecutable(
  "skipped recommendation candidates exclude the primary even when today tasks inject it and retain a non-primary same-skill task",
  () => {
    if (!skippedRecommendationCandidateHarness) return false;
    const primaryTask = { taskId: "primary-today-fixture", skill: "Reading", titleZh: "Primary" };
    const alternativeTask = { taskId: "alternative-today-fixture", skill: "Reading", titleZh: "Alternative" };
    const otherSkillTask = { taskId: "listening-today-fixture", skill: "Listening", titleZh: "Listening" };
    const recommendationChain = {
      diagnostic: { prioritySkill: "Reading" },
      recommendation: { status: "skipped", primary: { taskId: primaryTask.taskId } },
      plan: {
        days: [
          { coreSkill: "Reading", tasks: [primaryTask, alternativeTask] },
          { coreSkill: "Listening", tasks: [otherSkillTask] },
        ],
      },
    };
    const candidates = skippedRecommendationCandidateHarness.evaluate(
      [primaryTask, alternativeTask, otherSkillTask],
      recommendationChain,
    );
    return Boolean(
      candidates.length === 1 &&
        candidates[0].taskId === alternativeTask.taskId &&
        candidates[0].skill === recommendationChain.diagnostic.prioritySkill
    );
  },
);
checkExecutable(
  "central journey validator rejects a skipped primary receipt from both current and imported-history check-ins",
  () => {
    if (!skippedRecommendationJourneyHarness) return false;
    const currentPrimary = createSkippedRecommendationJourneyFixture({ linkedTaskKind: "primary", storage: "current" });
    const currentResult = skippedRecommendationJourneyHarness.evaluate(currentPrimary.state);
    const historicalPrimary = createSkippedRecommendationJourneyFixture({ linkedTaskKind: "primary", storage: "history" });
    const historicalResult = skippedRecommendationJourneyHarness.evaluate(historicalPrimary.state);
    return [currentResult, historicalResult].every(
      (result) =>
        result.diagnosticComplete === true &&
        result.planComplete === true &&
        result.recommendationComplete === true &&
        result.checkInComplete === false &&
        result.reviewComplete === false &&
        result.peerHelpComplete === false &&
        result.retestEvidenceComplete === false &&
        result.planUpdateRecorded === false &&
        result.updateComplete === false,
    );
  },
);
checkExecutable(
  "central journey validator accepts a valid non-primary same-skill receipt after the primary recommendation was skipped",
  () => {
    if (!skippedRecommendationJourneyHarness) return false;
    const alternative = createSkippedRecommendationJourneyFixture({ linkedTaskKind: "alternative", storage: "current" });
    const result = skippedRecommendationJourneyHarness.evaluate(alternative.state);
    return Boolean(
      result.diagnosticComplete === true &&
        result.planComplete === true &&
        result.recommendationComplete === true &&
        result.linkedPracticeTask?.taskId === alternative.alternativeTask.taskId &&
        result.linkedPracticeReceipt?.taskId === alternative.alternativeTask.taskId &&
        result.checkInComplete === true
    );
  },
);
check(
  /const todayTasks = getTodayTasks\(\)/.test(workspaceCheckInCandidateSource) &&
    /recommendation\.status === "accepted"/.test(workspaceCheckInCandidateSource) &&
    /\[\.\.\.todayTasks, \.\.\.alternativeCoreTasks\][\s\S]*\.filter\(\(task\) =>[\s\S]*task\.skill === recommendationChain\.diagnostic\.prioritySkill[\s\S]*task\.taskId !== recommendationChain\.recommendation\.primary\?\.taskId/.test(
      workspaceCheckInCandidateSource,
    ) &&
    /linkedRecommendation\.recommendation\.status === "skipped"[\s\S]*values\.linkedTaskId === linkedRecommendation\.recommendation\.primary\?\.taskId[\s\S]*errors\.push/.test(
      workspaceCheckInSubmitSource,
    ) &&
    /linkedRecommendation\.recommendation\.status === "skipped"[\s\S]*values\.linkedTaskId !== linkedRecommendation\.recommendation\.primary\?\.taskId/.test(
      workspaceCheckInSubmitSource,
    ),
  "normal check-in candidates, validation errors, and cycle eligibility all enforce the skipped-primary boundary",
);
check(
  /recommendation\.status === "accepted" && task\.taskId !== recommendation\.primary\?\.taskId/.test(
    journeyPracticeReceiptMatchesSource,
  ) &&
    /recommendation\.status === "skipped" && task\.taskId === recommendation\.primary\?\.taskId/.test(
      journeyPracticeReceiptMatchesSource,
    ) &&
    /practiceReceiptMatches\(\{[\s\S]*receipt:\s*linkedPracticeReceipt[\s\S]*recommendation,[\s\S]*task:\s*linkedPracticeTask/.test(
      journeyValidationSource,
    ),
  "central journey validation applies the recommendation decision to the exact linked practice task",
);
check(
  Boolean(
    practiceReceiptBoundaryHarness &&
      workspacePracticeReceiptVersionSource &&
      workspacePracticeCatalogSource &&
      workspacePracticeUuidPatternSource &&
      workspacePracticeReceiptValidationSource &&
      workspacePracticeJourneyScopeSource &&
      workspacePracticeAttemptBoundarySource
  ),
  "practice receipt scope and fresh-attempt functions load into an executable isolated fixture",
);
checkExecutable(
  "executable practice receipt fixture accepts only the exact same plan, task, cycle, diagnostic, and recommendation scope",
  () => {
    const { receipt, task, cycle, recommendation, plan } = createPracticeReceiptBoundaryFixture();
    return Boolean(
      practiceReceiptBoundaryHarness.hasValidPracticeReceiptShape(receipt, receipt.completionReceiptId) &&
        practiceReceiptBoundaryHarness.practiceReceiptMatchesJourneyScope({
          receipt,
          task,
          cycle,
          recommendation,
          plan,
        })
    );
  },
);
checkExecutable(
  "executable practice receipt fixtures reject cross-plan, cycle, diagnostic, recommendation, and stale-recommendation scopes",
  () => {
    const fixture = createPracticeReceiptBoundaryFixture();
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const crossPlanReceipt = clone(fixture.receipt);
    crossPlanReceipt.planId = "plan-other-fixture";
    crossPlanReceipt.taskRef.planId = "plan-other-fixture";
    const crossCycleReceipt = clone(fixture.receipt);
    crossCycleReceipt.cycleId = "cycle-other-fixture";
    crossCycleReceipt.taskRef.cycleId = "cycle-other-fixture";
    const crossDiagnosticReceipt = clone(fixture.receipt);
    crossDiagnosticReceipt.diagnosticSessionId = "diagnostic-other-fixture";
    crossDiagnosticReceipt.taskRef.diagnosticSessionId = "diagnostic-other-fixture";
    const crossRecommendationReceipt = clone(fixture.receipt);
    crossRecommendationReceipt.recommendationId = "recommendation-other-fixture";
    const matches = (receipt, recommendation = fixture.recommendation) =>
      practiceReceiptBoundaryHarness.practiceReceiptMatchesJourneyScope({
        receipt,
        task: fixture.task,
        cycle: fixture.cycle,
        recommendation,
        plan: fixture.plan,
      });
    const oldScopeKey = [
      `plan:${fixture.plan.planId}`,
      `task:${fixture.task.taskId}`,
      `cycle:${fixture.cycle.cycleId}`,
      "diagnostic:diagnostic-other-fixture",
      `recommendation:${fixture.recommendation.recommendationId}`,
    ].join("|");
    const currentScopeKey = [
      `plan:${fixture.plan.planId}`,
      `task:${fixture.task.taskId}`,
      `cycle:${fixture.cycle.cycleId}`,
      `diagnostic:${fixture.cycle.diagnosticSessionId}`,
      `recommendation:${fixture.recommendation.recommendationId}`,
    ].join("|");
    const freshBoundary = practiceReceiptBoundaryHarness.derivePracticeAttemptBoundary({
      current: {
        latestPracticeReceiptId: fixture.receipt.completionReceiptId,
        attemptScopeKey: oldScopeKey,
        status: "completed",
        selectedAnswer: fixture.catalog.correctValue,
        attempts: 1,
      },
      latestReceipt: fixture.receipt,
      latestReceiptId: fixture.receipt.completionReceiptId,
      scopeKey: currentScopeKey,
      now: "2026-08-10T01:00:00.000Z",
    });
    return Boolean(
      !matches(crossPlanReceipt) &&
        !matches(crossCycleReceipt) &&
        !matches(crossDiagnosticReceipt) &&
        !matches(crossRecommendationReceipt) &&
        !matches(fixture.receipt, { recommendationId: "recommendation-stale-fixture" }) &&
        freshBoundary.reset === true &&
        freshBoundary.legacyReceipt === false &&
        freshBoundary.nextPractice?.selectedAnswer === null &&
        freshBoundary.nextPractice?.attempts === 0
    );
  },
);
checkExecutable(
  "executable legacy v1 boundary preserves the original receipt while clearing answer, audio, draft, timer, and self-check evidence",
  () => {
    const fixture = createPracticeReceiptBoundaryFixture({
      protocolVersion: practiceReceiptBoundaryHarness.LEGACY_PRACTICE_RECEIPT_VERSION,
    });
    const receiptId = fixture.receipt.completionReceiptId;
    const scopeKey = [
      `plan:${fixture.plan.planId}`,
      `task:${fixture.task.taskId}`,
      `cycle:${fixture.cycle.cycleId}`,
      `diagnostic:${fixture.cycle.diagnosticSessionId}`,
      `recommendation:${fixture.recommendation.recommendationId}`,
    ].join("|");
    const state = {
      practice: {
        [fixture.receipt.exerciseId]: {
          latestPracticeReceiptId: receiptId,
          attemptScopeKey: scopeKey,
          freshAttemptFromLegacyReceiptId: null,
          status: "completed",
          selectedAnswer: "b",
          firstResponse: "a",
          attempts: 4,
          draftText: "legacy draft must not cross the boundary",
          selfChecks: { idea: true, reason: true, edit: true, answer: true, example: true, flow: true },
          wordCount: 42,
          audioPlayed: true,
          audioCompleted: true,
          audioRecorded: true,
          playCount: 3,
          audioSeekDetected: true,
          audioPlaybackFailed: true,
          audioStartedNearBeginning: true,
          transcriptUsed: true,
          timerCompleted: true,
          timerEndAt: "2026-08-10T00:02:00.000Z",
          artifactHash: "f".repeat(64),
          startedAt: "2026-08-10T00:00:00.000Z",
          updatedAt: "2026-08-10T00:02:00.000Z",
          completedAt: "2026-08-10T00:02:00.000Z",
        },
      },
      practiceReceipts: { [receiptId]: fixture.receipt },
    };
    const originalLedger = JSON.stringify(state.practiceReceipts);
    practiceReceiptBoundaryHarness.setState(state);
    practiceReceiptBoundaryHarness.setScopeKey(scopeKey);
    const boundary = practiceReceiptBoundaryHarness.initializePracticeAttemptScope(
      fixture.receipt.skill,
      fixture.receipt.exerciseId,
    );
    const nextState = practiceReceiptBoundaryHarness.getState();
    const next = nextState.practice[fixture.receipt.exerciseId];
    return Boolean(
      practiceReceiptBoundaryHarness.hasSafeLegacyPracticeReceiptShape(fixture.receipt, receiptId) &&
        !practiceReceiptBoundaryHarness.hasValidPracticeReceiptShape(fixture.receipt, receiptId) &&
        boundary.reset === true &&
        boundary.legacyReceipt === true &&
        next.latestPracticeReceiptId === receiptId &&
        next.freshAttemptFromLegacyReceiptId === receiptId &&
        next.attemptScopeKey === scopeKey &&
        next.status === "in_progress" &&
        next.selectedAnswer === null &&
        next.firstResponse === null &&
        next.attempts === 0 &&
        next.draftText === "" &&
        Object.keys(next.selfChecks).length === 0 &&
        next.wordCount === 0 &&
        next.audioPlayed === false &&
        next.audioCompleted === false &&
        next.audioRecorded === false &&
        next.playCount === 0 &&
        next.audioSeekDetected === false &&
        next.audioPlaybackFailed === false &&
        next.audioStartedNearBeginning === false &&
        next.transcriptUsed === false &&
        next.timerCompleted === false &&
        next.completedAt === null &&
        !("timerEndAt" in next) &&
        !("artifactHash" in next) &&
        JSON.stringify(nextState.practiceReceipts) === originalLedger &&
        nextState.practiceReceipts[receiptId] === fixture.receipt &&
        practiceReceiptBoundaryHarness.getPersistCount() === 1
    );
  },
);
checkExecutable(
  "executable practice attempt boundary is idempotent and rejects malformed legacy v1 receipts",
  () => {
    const legacyFixture = createPracticeReceiptBoundaryFixture({
      protocolVersion: practiceReceiptBoundaryHarness.LEGACY_PRACTICE_RECEIPT_VERSION,
    });
    const v2Fixture = createPracticeReceiptBoundaryFixture();
    const receiptId = legacyFixture.receipt.completionReceiptId;
    const scopeKey = [
      `plan:${legacyFixture.plan.planId}`,
      `task:${legacyFixture.task.taskId}`,
      `cycle:${legacyFixture.cycle.cycleId}`,
      `diagnostic:${legacyFixture.cycle.diagnosticSessionId}`,
      `recommendation:${legacyFixture.recommendation.recommendationId}`,
    ].join("|");
    practiceReceiptBoundaryHarness.setState({
      practice: {
        [legacyFixture.receipt.exerciseId]: {
          latestPracticeReceiptId: receiptId,
          attemptScopeKey: scopeKey,
          freshAttemptFromLegacyReceiptId: null,
          status: "completed",
          selectedAnswer: "b",
        },
      },
      practiceReceipts: { [receiptId]: legacyFixture.receipt },
    });
    practiceReceiptBoundaryHarness.setScopeKey(scopeKey);
    const firstBoundary = practiceReceiptBoundaryHarness.initializePracticeAttemptScope(
      legacyFixture.receipt.skill,
      legacyFixture.receipt.exerciseId,
    );
    const stateAfterFirstBoundary = JSON.stringify(practiceReceiptBoundaryHarness.getState());
    const persistCountAfterFirstBoundary = practiceReceiptBoundaryHarness.getPersistCount();
    const secondBoundary = practiceReceiptBoundaryHarness.initializePracticeAttemptScope(
      legacyFixture.receipt.skill,
      legacyFixture.receipt.exerciseId,
    );
    const sameScopeV2Boundary = practiceReceiptBoundaryHarness.derivePracticeAttemptBoundary({
      current: {
        latestPracticeReceiptId: v2Fixture.receipt.completionReceiptId,
        attemptScopeKey: scopeKey,
        freshAttemptFromLegacyReceiptId: null,
        status: "completed",
        selectedAnswer: "b",
      },
      latestReceipt: v2Fixture.receipt,
      latestReceiptId: v2Fixture.receipt.completionReceiptId,
      scopeKey,
      now: "2026-08-10T02:00:00.000Z",
    });
    const legacyWithEvidence = JSON.parse(JSON.stringify(legacyFixture.receipt));
    legacyWithEvidence.evidence = { finalResponse: "b" };
    const legacyWithWrongHash = JSON.parse(JSON.stringify(legacyFixture.receipt));
    legacyWithWrongHash.contentHash = "0".repeat(64);
    return Boolean(
      firstBoundary.reset === true &&
        secondBoundary.reset === false &&
        secondBoundary.legacyReceipt === false &&
        secondBoundary.nextPractice === null &&
        JSON.stringify(practiceReceiptBoundaryHarness.getState()) === stateAfterFirstBoundary &&
        practiceReceiptBoundaryHarness.getPersistCount() === persistCountAfterFirstBoundary &&
        sameScopeV2Boundary.reset === false &&
        sameScopeV2Boundary.nextPractice === null &&
        !practiceReceiptBoundaryHarness.hasSafeLegacyPracticeReceiptShape(legacyWithEvidence, receiptId) &&
        !practiceReceiptBoundaryHarness.hasSafeLegacyPracticeReceiptShape(legacyWithWrongHash, receiptId) &&
        !practiceReceiptBoundaryHarness.hasSafeLegacyPracticeReceiptShape(
          legacyFixture.receipt,
          "33333333-3333-4333-8333-333333333333",
        )
    );
  },
);

const sealExistingReceiptIndex = workspaceSealPracticeReceiptSource.indexOf("const existingReceipt");
const sealScopeMatchIndex = workspaceSealPracticeReceiptSource.indexOf("practiceReceiptMatchesJourneyScope", sealExistingReceiptIndex);
const sealReuseIndex = workspaceSealPracticeReceiptSource.indexOf("return existingReceipt", sealScopeMatchIndex);
check(
  sealExistingReceiptIndex >= 0 && sealScopeMatchIndex > sealExistingReceiptIndex && sealReuseIndex > sealScopeMatchIndex,
  "practice sealing reuses an existing receipt only after the journey scope matcher accepts it",
);
check(
  workspaceCurrentPracticeAttemptScopeSource.includes("diagnosticSessionId") &&
    workspaceCurrentPracticeAttemptScopeSource.includes("diagnostic:${diagnosticSessionId || \"none\"}") &&
    workspacePracticeJourneyScopeSource.includes("const expectedRecommendationId = activeCycle.recommendationId || null") &&
    workspacePracticeJourneyScopeSource.includes("recommendation?.recommendationId === expectedRecommendationId") &&
    workspacePracticePageScopeSource.includes("practiceReceiptMatchesJourneyScope"),
  "practice page scope keys bind diagnostic identity and use the active cycle recommendation as authoritative",
);
check(
  workspaceChoicePracticeSource.indexOf("practiceDomMatchesCatalog(exerciseId)") >= 0 &&
    workspaceChoicePracticeSource.indexOf("practiceDomMatchesCatalog(exerciseId)") <
      workspaceChoicePracticeSource.indexOf("initializePracticeAttemptScope(skill, exerciseId)") &&
    workspaceChoicePracticeSource.indexOf("initializePracticeAttemptScope(skill, exerciseId)") <
      workspaceChoicePracticeSource.indexOf("if (saved.selectedAnswer)") &&
    workspaceChoicePracticeSource.includes("practiceReceiptMatchesCurrentPageScope") &&
    workspaceWritingPracticeSource.indexOf('practiceDomMatchesCatalog("writing-community-v1")') >= 0 &&
    workspaceWritingPracticeSource.indexOf('practiceDomMatchesCatalog("writing-community-v1")') <
      workspaceWritingPracticeSource.indexOf("const existingWritingPractice") &&
    workspaceWritingPracticeSource.indexOf("const existingWritingPractice") <
      workspaceWritingPracticeSource.indexOf('initializePracticeAttemptScope("Writing", "writing-community-v1")') &&
    workspaceWritingPracticeSource.indexOf('initializePracticeAttemptScope("Writing", "writing-community-v1")') <
      workspaceWritingPracticeSource.indexOf("writing.value = saved.draftText") &&
    workspaceWritingPracticeSource.includes("practiceReceiptMatchesCurrentPageScope") &&
    workspaceSpeakingPracticeSource.indexOf('practiceDomMatchesCatalog("speaking-skill-v1")') >= 0 &&
    workspaceSpeakingPracticeSource.indexOf('practiceDomMatchesCatalog("speaking-skill-v1")') <
      workspaceSpeakingPracticeSource.indexOf('initializePracticeAttemptScope("Speaking", "speaking-skill-v1")') &&
    workspaceSpeakingPracticeSource.indexOf('initializePracticeAttemptScope("Speaking", "speaking-skill-v1")') <
      workspaceSpeakingPracticeSource.indexOf("const savedSpeakingReceiptId") &&
    workspaceSpeakingPracticeSource.includes("practiceReceiptMatchesCurrentPageScope"),
  "choice, writing, and speaking pages validate catalog bindings; writing fails closed on oversized legacy drafts before scope mutation",
);
check(
  /writing\.maxLength !== WRITING_PRACTICE_MAX_CHARACTERS/.test(workspaceWritingPracticeSource) &&
    /existingDraftText\.length > WRITING_PRACTICE_MAX_CHARACTERS[\s\S]*writing\.disabled = true[\s\S]*旧草稿未修改[\s\S]*不会截断、保存或封存/.test(
      workspaceWritingPracticeSource,
    ) &&
    /const saveWriting = \(\) => \{[\s\S]*!writingDraftWithinLimit\(writing\.value\)[\s\S]*reportWritingLengthFailure\(\)[\s\S]*return false;/.test(
      workspaceWritingPracticeSource,
    ) &&
    /const normalizedArtifact = writing\.value\.replace[\s\S]*!writingDraftWithinLimit\(writing\.value\)[\s\S]*!writingDraftWithinLimit\(normalizedArtifact\)[\s\S]*reportWritingLengthFailure\(\)[\s\S]*return;/.test(
      workspaceWritingPracticeSource,
    ),
  "Writing rejects oversized persisted, autosave, and sealing paths without truncating learner text",
);
check(
  /const questionStatus = checkinForm\.querySelector\('input\[name="questionStatus"\]:checked'\)\?\.value \|\| "";[\s\S]*questionText: questionStatus === "has_question" \? questionText\?\.value\.trim\(\) \|\| "" : ""/.test(
    workspaceCheckInSetupSource,
  ) &&
    /const toggleQuestion = \(\) => \{[\s\S]*if \(!hasQuestion && questionText\) questionText\.value = "";/.test(
      workspaceCheckInSetupSource,
    ) &&
    /const values = readCheckin\(\);[\s\S]*state\.checkIns\[date\] = \{[\s\S]*\.\.\.values/.test(
      workspaceCheckInSetupSource,
    ),
  "check-in autosave and commit canonicalize no-question records to an empty questionText",
);
check(
  /hasValidPracticeReceiptShape\(receipt, receiptId\)\s*\|\|\s*hasSafeLegacyPracticeReceiptShape\(receipt, receiptId\)/.test(
    workspaceNormalizeStateSource,
  ) &&
    workspacePracticeAttemptBoundarySource.includes("const boundary = derivePracticeAttemptBoundary") &&
    workspacePracticeAttemptBoundarySource.includes("state.practice[exerciseId] = boundary.nextPractice") &&
    !/state\.practiceReceipts\[[^\]]+\]\s*=/.test(workspacePracticeAttemptBoundarySource) &&
    !/delete\s+state\.practiceReceipts/.test(workspacePracticeAttemptBoundarySource),
  "normalization retains safe legacy receipts and the fresh-attempt initializer mutates only active practice state",
);
check(
  /diagnostic\.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST/.test(completedDiagnosticCycleSource) &&
    /diagnostic\.cycleId !== cycle\.cycleId/.test(completedDiagnosticCycleSource) &&
    /diagnostic\.diagnosticSessionId !== cycle\.diagnosticSessionId/.test(completedDiagnosticCycleSource) &&
    /!evidenceValid/.test(completedDiagnosticCycleSource),
  "plan eligibility requires the complete hashed diagnostic evidence from the active cycle",
);
check(
  /plan\.planId !== linked\.cycle\.basePlanId/.test(completedPlanChainSource) &&
    /plan\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.cycleId !== linked\.cycle\.cycleId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST/.test(completedPlanChainSource),
  "recommendation eligibility requires a plan bound to the complete same-cycle diagnostic manifest",
);
check(
  /recommendation\.recommendationId !== linked\.cycle\.recommendationId/.test(completedRecommendationChainSource) &&
    /recommendation\.cycleId !== linked\.cycle\.cycleId/.test(completedRecommendationChainSource) &&
    /recommendation\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedRecommendationChainSource) &&
    /recommendation\.planId !== linked\.cycle\.basePlanId/.test(completedRecommendationChainSource) &&
    /const linkedRecommendation = completedRecommendationChain\(\)/.test(workspaceCheckInSubmitSource) &&
    /diagnosticSessionId:\s*cycleEligible \? activeCycle\.diagnosticSessionId : null/.test(workspaceCheckInSubmitSource) &&
    /recommendationId,/.test(workspaceCheckInSubmitSource),
  "check-in eligibility requires the complete recommendation, plan, and diagnostic chain from one cycle",
);
check(
  /let checkInCommitPending = false/.test(workspaceCheckInLifecycleSource) &&
    /const saveDraft = \(\) => \{\s*if \(checkInCommitPending\) return;/.test(workspaceCheckInLifecycleSource) &&
    /checkinForm\.addEventListener\("input", \(\) => \{\s*if \(checkInCommitPending\) return;/.test(
      workspaceCheckInLifecycleSource,
    ) &&
    /checkinForm\.addEventListener\("submit", async \(event\) => \{[\s\S]*if \(checkInCommitPending\) return;/.test(
      workspaceCheckInLifecycleSource,
    ) &&
    /checkInControlDisabledSnapshot = new Map\(controls\.map\(\(control\) => \[control, control\.disabled\]\)\)[\s\S]*controls\.forEach\(\(control\) => \{\s*control\.disabled = true;/.test(
      workspaceCheckInLifecycleSource,
    ) &&
    /setCheckInCommitPending\(true\);[\s\S]*try \{[\s\S]*await withExclusiveWorkspaceWrite[\s\S]*\} finally \{\s*setCheckInCommitPending\(false\);/.test(
      workspaceCheckInLifecycleSource,
    ),
  "check-in commit blocks autosave and freezes every form control until the sealed async transaction settles",
);
check(
  /diagnosticComplete &&[\s\S]*basePlan\?\.planId === cycle\?\.basePlanId/.test(journeyValidationSource) &&
    /planComplete &&[\s\S]*recommendation\?\.cycleId === cycle\?\.cycleId/.test(journeyValidationSource) &&
    /recommendationComplete &&[\s\S]*checkIn\?\.cycleId === cycle\?\.cycleId/.test(journeyValidationSource) &&
    /basePlan\?\.provenance\?\.taskSetDigest === diagnostic\?\.taskSetDigest/.test(journeyValidationSource),
  "central journey validation gates plan, recommendation, and check-in sequentially on the same diagnostic cycle",
);
check(
  /checkIn\?\.diagnosticSessionId === cycle\?\.diagnosticSessionId/.test(journeyValidationSource) &&
    /peerHelp\?\.planId === cycle\?\.basePlanId/.test(journeyValidationSource) &&
    /updatedPlan\?\.focusSkill === planUpdate\?\.focusSkill/.test(journeyValidationSource),
  "central journey validation binds check-in session, peer-help plan, and updated-plan focus skill",
);
check(
  /practiceReceipts:\s*\{\}/.test(workspaceScript) &&
    /practiceReceipts:\s*\{\}/.test(journeyScript) &&
    /Object\.entries\(value\.practiceReceipts\)[\s\S]*hasValidPracticeReceiptShape/.test(workspaceScript) &&
    /Object\.entries\(value\.practiceReceipts\)[\s\S]*hasValidPracticeReceiptShape/.test(journeyScript),
  "legacy schema v1 normalizes a missing receipt ledger and fails closed on malformed stored receipts",
);
check(
  /const resolvePracticeTaskContext[\s\S]*plan_id[\s\S]*task_id[\s\S]*state\.plan\?\.planId !== planId[\s\S]*task\.skill !== skill[\s\S]*task\.route !== catalog\.route/.test(workspaceScript) &&
    /plan_id:\s*state\.plan\.planId, task_id:\s*coreTask\.taskId/.test(workspaceScript),
  "practice bindings require exact current plan, task, skill, and route context rather than a skill-only match",
);
check(
  /const sealPracticeReceipt[\s\S]*state\.practiceReceipts\[receipt\.completionReceiptId\] = receipt/.test(workspaceScript) &&
    /sealed:\s*true[\s\S]*ownerScope:\s*"browser_local_not_account_bound"[\s\S]*integrityClass:\s*"unsigned_local_receipt"/.test(workspaceScript) &&
    !/const markMatchingTaskComplete/.test(workspaceScript),
  "practice completion seals an append-only local receipt and no longer completes the first matching skill task",
);
check(
  /const sealPracticeReceipt = \(skill, exerciseId, completedAt, evidence = \{\}\) =>/.test(
    workspaceSealPracticeReceiptSource,
  ) &&
    /typeof completedAt !== "string"[\s\S]*Date\.parse\(completedAt\)[\s\S]*new Date\(completedAt\)\.toISOString\(\) !== completedAt/.test(
      workspaceSealPracticeReceiptSource,
    ) &&
    !/const completedAt = new Date\(\)\.toISOString\(\)/.test(workspaceSealPracticeReceiptSource) &&
    /existingReceipt\.completedAt === completedAt \? existingReceipt : null/.test(workspaceSealPracticeReceiptSource) &&
    /updatedAt: completedAt,[\s\S]*completedAt,[\s\S]*sealPracticeReceipt\(skill, exerciseId, completedAt, \{/.test(
      workspaceChoicePracticeSource,
    ) &&
    /setupChoicePractice\(\{[\s\S]*skill: "Reading"[\s\S]*setupChoicePractice\(\{[\s\S]*skill: "Listening"/.test(
      workspaceScript,
    ) &&
    /updatedAt: completedAt,[\s\S]*sealPracticeReceipt\("Writing", "writing-community-v1", completedAt, \{/.test(
      workspaceWritingPracticeSource,
    ) &&
    /updatedAt: completedAt,[\s\S]*sealPracticeReceipt\("Speaking", "speaking-skill-v1", completedAt, \{/.test(
      workspaceSpeakingPracticeSource,
    ),
  "Reading, Listening, Writing, and Speaking use one caller-owned completion timestamp for practice, receipt, and task progress",
);
check(
  /completionClass:\s*checkbox\.checked \? "learner_self_report"/.test(workspaceScript) &&
    /completionClass:\s*"practice_receipt"[\s\S]*practiceReceiptId:\s*receipt\.completionReceiptId/.test(workspaceScript),
  "today checkboxes and guided practice use visibly distinct completion classes",
);
check(
  /const linkedPracticeReceipt = qualifyingPracticeReceiptForTask\(linkedTask\)/.test(workspaceCheckInSubmitSource) &&
    /practiceAttemptId:\s*linkedPracticeReceipt\?\.practiceAttemptId/.test(workspaceCheckInSubmitSource) &&
    /taskCompletionReceiptId:\s*linkedPracticeReceipt\?\.completionReceiptId/.test(workspaceCheckInSubmitSource) &&
    !/state\.taskProgress\[values\.linkedTaskId\]/.test(workspaceCheckInSubmitSource),
  "check-in references an existing qualifying receipt and never marks the selected core task complete itself",
);
check(
  /practiceReceiptMatches\(\{[\s\S]*receipt:\s*linkedPracticeReceipt[\s\S]*task:\s*linkedPracticeTask/.test(journeyValidationSource) &&
    /linkedTaskProgress\?\.practiceReceiptId === linkedPracticeReceipt\?\.completionReceiptId/.test(journeyValidationSource) &&
    /JSON\.stringify\(storedPracticeReceipt\) === JSON\.stringify\(linkedPracticeReceipt\)/.test(journeyValidationSource),
  "central journey validation rechecks the plan task, receipt ledger, task-progress index, and check-in snapshot",
);
check(
  /const deriveRecommendationBindingCore/.test(workspaceScript) &&
    /const recommendationBindingMatches/.test(workspaceScript) &&
    /const deriveRecommendationBindingCore/.test(journeyScript) &&
    /const recommendationBindingMatches/.test(journeyScript) &&
    /recommendationBindingMatches\(\{[\s\S]*binding:\s*recommendation\.evidenceBinding[\s\S]*diagnostic:\s*linked\.diagnostic[\s\S]*plan:\s*linked\.plan/.test(
      completedRecommendationChainSource,
    ) &&
    /recommendationBindingMatches\(\{[\s\S]*binding:\s*recommendation\?\.evidenceBinding[\s\S]*diagnostic,[\s\S]*plan:\s*basePlan/.test(
      journeyValidationSource,
    ) &&
    /const planTaskBindsPracticeCatalog/.test(journeyPlanTaskLookupSource) &&
    /planTask\.contentRef\.contentHash === catalog\.contentHash/.test(journeyPlanTaskLookupSource) &&
    /!planTaskBindsPracticeCatalog\(planTask, catalog\)/.test(journeyEvidenceDerivationSource) &&
    /diagnosticEvidenceTaskIds:\s*sourceEvidence\.map\(\(item\) => item\.taskId\)/.test(journeyEvidenceDerivationSource) &&
    /diagnosticQualityFlags:\s*\[\.\.\.new Set\(sourceEvidence\.flatMap/.test(journeyEvidenceDerivationSource) &&
    /Object\.entries\(expected\)\.every/.test(journeyEvidenceDerivationSource),
  "recommendation eligibility re-derives the diagnostic-pattern, task, content, and review binding in both runtimes",
);
checkExecutable(
  "executable recommendation fixtures reject forged diagnostic IDs, manifest hashes, and jointly forged practice content bindings",
  () => {
    const baseline = createJourneyEvidenceFixture();
    const baselineResult = journeyEvidenceHarness.evaluate(baseline);
    if (!baselineResult.diagnosticComplete || !baselineResult.recommendationComplete) return false;

    const forgedDiagnosticTask = structuredClone(baseline);
    const forgedEvidence = forgedDiagnosticTask.journey.diagnostic.taskEvidence.find(
      (item) => item.taskId === "diagnostic-reading-library-v1",
    );
    forgedEvidence.taskId = "diagnostic-reading-forged-v1";
    const basePlan = forgedDiagnosticTask.planHistory[0];
    const recommendation = forgedDiagnosticTask.journey.recommendation;
    const bindingRejectsForgedTask = !journeyEvidenceHarness.recommendationBindingMatches({
      binding: recommendation.evidenceBinding,
      cycle: forgedDiagnosticTask.journey.activeCycle,
      diagnostic: forgedDiagnosticTask.journey.diagnostic,
      plan: basePlan,
      primary: recommendation.primary,
    });

    const forgedDiagnosticHash = structuredClone(baseline);
    forgedDiagnosticHash.journey.diagnostic.taskEvidence[0].contentHash = "f".repeat(64);

    const forgedPracticeBinding = structuredClone(baseline);
    const forgedHash = "e".repeat(64);
    forgedPracticeBinding.planHistory[0].days[0].tasks[0].contentRef.contentHash = forgedHash;
    forgedPracticeBinding.journey.recommendation.primary.contentHash = forgedHash;
    forgedPracticeBinding.journey.recommendation.evidenceBinding.contentHash = forgedHash;

    return (
      bindingRejectsForgedTask &&
      !journeyEvidenceHarness.evaluate(forgedDiagnosticTask).diagnosticComplete &&
      !journeyEvidenceHarness.evaluate(forgedDiagnosticHash).diagnosticComplete &&
      !journeyEvidenceHarness.evaluate(forgedPracticeBinding).recommendationComplete
    );
  },
);
check(
  /const retestCatalog = RETEST_TASK_CATALOG\[retest\?\.skill\]/.test(journeyValidationSource) &&
    /const derivedRetestOutcome = deriveRetestOutcome\(retest\?\.skill, retest\?\.evidence\)/.test(journeyValidationSource) &&
    /baselinePracticeReceiptId === linkedPracticeReceipt\?\.completionReceiptId/.test(journeyValidationSource) &&
    /taskVersion === retestCatalog\?\.taskVersion/.test(journeyValidationSource) &&
    /parallelFormPairId === retestCatalog\?\.parallelFormPairId/.test(journeyValidationSource) &&
    /newOriginalPrompt === true/.test(journeyValidationSource) &&
    /constructAlignment === retestCatalog\?\.constructAlignment/.test(journeyValidationSource) &&
    /evidence\?\.resultType === derivedRetestOutcome\.resultType/.test(journeyValidationSource) &&
    /evidenceStatus === derivedRetestOutcome\.evidenceStatus/.test(journeyValidationSource) &&
    /evidenceSufficiency === derivedRetestOutcome\.evidenceSufficiency/.test(journeyValidationSource) &&
    /humanConfirmationStatus === derivedRetestOutcome\.humanConfirmationStatus/.test(journeyValidationSource),
  "central retest validation recomputes outcome and binds receipt, task version, form pair, and comparability to source records",
);
checkExecutable(
  "executable retest fixtures reject a forged objective result and every stored comparability identity field",
  () => {
    const baseline = createJourneyEvidenceFixture();
    const baselineResult = journeyEvidenceHarness.evaluate(baseline);
    if (!baselineResult.retestEvidenceComplete || !baselineResult.updateComplete) return false;

    const forgedObjectiveResult = structuredClone(baseline);
    forgedObjectiveResult.journey.retest.evidence.selectedAnswer = "a";

    const wrongTaskVersion = structuredClone(baseline);
    wrongTaskVersion.journey.retest.taskVersion = "v999";
    const wrongFormPair = structuredClone(baseline);
    wrongFormPair.journey.retest.parallelFormPairId = "forged-form-pair";
    const wrongBaselineReceipt = structuredClone(baseline);
    wrongBaselineReceipt.journey.retest.baselinePracticeReceiptId = "forged-practice-receipt";
    const wrongParallelTask = structuredClone(baseline);
    wrongParallelTask.journey.retest.parallelTaskId = "forged-parallel-task";
    const wrongComparability = structuredClone(baseline);
    wrongComparability.journey.retest.comparability.newOriginalPrompt = false;
    wrongComparability.journey.retest.comparability.constructAlignment = "forged-construct";

    return [
      forgedObjectiveResult,
      wrongTaskVersion,
      wrongFormPair,
      wrongBaselineReceipt,
      wrongParallelTask,
      wrongComparability,
    ].every((candidate) => {
      const result = journeyEvidenceHarness.evaluate(candidate);
      return !result.retestEvidenceComplete && !result.updateComplete;
    });
  },
);
check(
  /const provisionalUpdateRecorded = Boolean\([\s\S]*derivedRetestOutcome\?\.humanReviewRequired === true[\s\S]*cycle\?\.status === "provisional_pending_human_review"[\s\S]*confirmationClass === "provisional_pending_human_review"/.test(
    journeyValidationSource,
  ) &&
    /const updateComplete = Boolean\([\s\S]*derivedRetestOutcome\?\.humanReviewRequired === false[\s\S]*cycle\?\.status === "completed"[\s\S]*confirmationClass === "learner_confirmed_gate_a"/.test(
      journeyValidationSource,
    ) &&
    /const planUpdateRecorded = updateComplete \|\| provisionalUpdateRecorded/.test(journeyValidationSource),
  "central plan validation keeps provisional human-review state distinct from a completed cycle",
);
checkExecutable(
  "an objective answer requiring human review records a provisional plan but never a completed cycle",
  () => {
    const provisional = createJourneyEvidenceFixture();
    const retest = provisional.journey.retest;
    retest.evidence.selectedAnswer = "a";
    const derived = journeyEvidenceHarness.deriveRetestOutcome(retest.skill, retest.evidence);
    if (!derived || derived.humanReviewRequired !== true) return false;
    retest.evidence.resultType = derived.resultType;
    retest.evidenceStatus = derived.evidenceStatus;
    retest.evidenceSufficiency = derived.evidenceSufficiency;
    retest.humanConfirmationStatus = derived.humanConfirmationStatus;
    provisional.journey.activeCycle.status = "provisional_pending_human_review";
    provisional.journey.planUpdate.confirmationClass = "provisional_pending_human_review";
    provisional.journey.planUpdate.humanConfirmationStatus = "required_not_completed";

    const result = journeyEvidenceHarness.evaluate(provisional);
    return (
      result.retestEvidenceComplete &&
      result.provisionalUpdateRecorded &&
      result.planUpdateRecorded &&
      !result.updateComplete
    );
  },
);
checkExecutable(
  "cycle receipt projection exposes only validated IDs and keeps provisional closure distinct",
  () => {
    const complete = createJourneyEvidenceFixture();
    const completeChain = journeyEvidenceHarness.evaluate(complete);
    const completeProjection = journeyEvidenceHarness.buildCycleEvidenceProjection(completeChain);
    const expectedKeys = ["diagnostic", "plan", "recommendation", "checkin", "review", "peerHelp", "retest", "updatedPlan"];
    const expectedValues = [
      complete.journey.activeCycle.diagnosticSessionId,
      complete.journey.activeCycle.basePlanId,
      complete.journey.activeCycle.recommendationId,
      complete.journey.activeCycle.checkInId,
      complete.journey.activeCycle.reviewId,
      complete.journey.activeCycle.peerHelpId,
      complete.journey.activeCycle.retestId,
      complete.journey.activeCycle.updatedPlanId,
    ];
    if (
      completeProjection.state !== "complete" ||
      completeProjection.completedCount !== 7 ||
      completeProjection.recordedCount !== 8 ||
      JSON.stringify(completeProjection.rows.map((row) => row.key)) !== JSON.stringify(expectedKeys) ||
      JSON.stringify(completeProjection.rows.map((row) => row.value)) !== JSON.stringify(expectedValues) ||
      completeProjection.rows.some((row) => row.state !== "recorded") ||
      ["completed-task", "evidence-note", "Reading evidence fixture"].some((marker) => JSON.stringify(completeProjection).includes(marker))
    ) return false;

    const provisional = createJourneyEvidenceFixture();
    const retest = provisional.journey.retest;
    retest.evidence.selectedAnswer = "a";
    const derived = journeyEvidenceHarness.deriveRetestOutcome(retest.skill, retest.evidence);
    if (!derived || derived.humanReviewRequired !== true) return false;
    retest.evidence.resultType = derived.resultType;
    retest.evidenceStatus = derived.evidenceStatus;
    retest.evidenceSufficiency = derived.evidenceSufficiency;
    retest.humanConfirmationStatus = derived.humanConfirmationStatus;
    provisional.journey.activeCycle.status = "provisional_pending_human_review";
    provisional.journey.planUpdate.confirmationClass = "provisional_pending_human_review";
    provisional.journey.planUpdate.humanConfirmationStatus = "required_not_completed";
    const provisionalProjection = journeyEvidenceHarness.buildCycleEvidenceProjection(
      journeyEvidenceHarness.evaluate(provisional),
    );

    const rejected = createJourneyEvidenceFixture();
    rejected.journey.diagnostic.taskEvidence[0].contentHash = "f".repeat(64);
    const rejectedProjection = journeyEvidenceHarness.buildCycleEvidenceProjection(
      journeyEvidenceHarness.evaluate(rejected),
    );
    return (
      provisionalProjection.state === "provisional" &&
      provisionalProjection.completedCount === 6 &&
      provisionalProjection.recordedCount === 8 &&
      provisionalProjection.rows.at(-1)?.state === "pending-human" &&
      provisionalProjection.rows.at(-1)?.status === "等待具备资质的人工确认" &&
      rejectedProjection.rows[0]?.state === "current" &&
      rejectedProjection.rows[0]?.value === null &&
      rejectedProjection.rows.slice(1).every((row) => row.state === "locked" && row.value === null)
    );
  },
);
check(
  Boolean(cycleHistoryProjectionHarness?.buildCycleHistoryProjection),
  "cycle-history projection loads as an executable pure-function harness",
);
checkExecutable(
  "cycle history exposes only allowlisted metadata and keeps completed versus qualified-human-review-pending distinct",
  () => {
    const complete = createCycleHistoryProjectionFixture({ index: 1 });
    const provisional = createCycleHistoryProjectionFixture({ index: 2, provisional: true });
    const completeProjection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(complete, { ok: true });
    const provisionalProjection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(provisional, { ok: true });
    const serialized = JSON.stringify({ completeProjection, provisionalProjection });
    return (
      completeProjection.items.length === 1 &&
      completeProjection.items[0].status === "completed_local_cycle" &&
      completeProjection.items[0].eventCount === 6 &&
      provisionalProjection.items.length === 1 &&
      provisionalProjection.items[0].status === "pending_qualified_human_review" &&
      provisionalProjection.items[0].eventCount === 5 &&
      [
        "completed-task",
        "evidence-note",
        "Reading evidence",
        "PRIVATE-NAME",
        "PRIVATE-EXAM",
        "PRIVATE-SOFIA",
      ].every((marker) => !serialized.includes(marker))
    );
  },
);
checkExecutable(
  "cycle history fails closed on forged IDs, skills, updated plans, timestamps, event privacy, event gaps, and overlong IDs",
  () => {
    const baseline = createCycleHistoryProjectionFixture({ index: 3 });
    const candidates = [];

    const forgedId = structuredClone(baseline);
    forgedId.journey.history[0].checkInId = "check-in-forged";
    candidates.push(forgedId);

    const forgedSkill = structuredClone(baseline);
    forgedSkill.journey.history[0].diagnostic.prioritySkill = "Listening";
    candidates.push(forgedSkill);

    const forgedUpdatedPlan = structuredClone(baseline);
    forgedUpdatedPlan.plan.focusSkill = "Speaking";
    candidates.push(forgedUpdatedPlan);

    const forgedTime = structuredClone(baseline);
    forgedTime.journey.history[0].closedAt = "2026-08-13T00:08:00.000Z";
    candidates.push(forgedTime);

    const privacyLeak = structuredClone(baseline);
    privacyLeak.learningEvents[2].privacy.containsFreeText = true;
    candidates.push(privacyLeak);

    const privacyEnvelope = structuredClone(baseline);
    privacyEnvelope.journey.history[0].sofiaChat = "private conversation";
    candidates.push(privacyEnvelope);

    const missingEvent = structuredClone(baseline);
    missingEvent.learningEvents = missingEvent.learningEvents.filter((event) => event.eventType !== "retest.completed");
    candidates.push(missingEvent);

    const overlongId = structuredClone(baseline);
    overlongId.journey.history[0].cycleId = "x".repeat(181);
    candidates.push(overlongId);

    return candidates.every((candidate) => {
      const projection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(candidate, { ok: true });
      return projection.items.length === 0 && projection.invalidCount === 1;
    });
  },
);
checkExecutable(
  "cycle history rejects duplicate cycle IDs, treats a corrupt global ledger as invalid, and never mixes the current receipt into history",
  () => {
    const duplicate = createCycleHistoryProjectionFixture({ index: 4 });
    duplicate.journey.history.push(structuredClone(duplicate.journey.history[0]));
    const duplicateProjection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(duplicate, { ok: true });

    const corruptLedger = createCycleHistoryProjectionFixture({ index: 5 });
    const corruptProjection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(corruptLedger, { ok: false });

    const currentMix = createCycleHistoryProjectionFixture({ index: 6 });
    currentMix.journey.activeCycle = { cycleId: currentMix.journey.history[0].cycleId };
    const currentProjection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(currentMix, { ok: true });
    return (
      duplicateProjection.items.length === 0 &&
      duplicateProjection.invalidCount === 2 &&
      corruptProjection.items.length === 0 &&
      corruptProjection.invalidCount === 1 &&
      currentProjection.items.length === 0 &&
      currentProjection.invalidCount === 0 &&
      currentProjection.currentExcludedCount === 1
    );
  },
);
checkExecutable(
  "cycle history displays at most ten validated cycles in newest-first order",
  () => {
    const fixtures = Array.from({ length: 11 }, (_, index) => createCycleHistoryProjectionFixture({ index: index + 1 }));
    const merged = mergeCycleHistoryProjectionFixtures(fixtures);
    const projection = cycleHistoryProjectionHarness.buildCycleHistoryProjection(merged, { ok: true });
    return (
      projection.validCount === 11 &&
      projection.items.length === 10 &&
      projection.hiddenValidCount === 1 &&
      projection.items[0].cycleId.endsWith("fixture-11") &&
      projection.items.at(-1).cycleId.endsWith("fixture-2") &&
      projection.items.every((item, index, items) => index === 0 || items[index - 1].terminalAt > item.terminalAt)
    );
  },
);
check(
  /listeningAudio\?\.addEventListener\("play"/.test(workspaceScript) &&
    /listeningAudio\?\.addEventListener\("seeking"/.test(workspaceScript) &&
    /listeningAudio\?\.addEventListener\("ended"/.test(workspaceScript) &&
    /transcriptUsed:\s*true/.test(workspaceScript) &&
    /evidenceStatus:\s*skill === "Listening"/.test(workspaceScript) &&
    /"evidence_insufficient"/.test(workspaceScript),
  "Listening receipts preserve playback, seek, transcript, and evidence-insufficiency conditions",
);

const workspaceWriterLeaseSource = sourceSection(
  workspaceScript,
  "const acquireSharedWorkspaceWriterLease",
  "const isRecord",
);
const journeyWriterLeaseSource = sourceSection(
  journeyScript,
  "const acquireSharedWorkspaceWriterLease",
  "const showStorageWarning",
);
check(
  workspaceWriterLeaseSource.trim() === journeyWriterLeaseSource.trim() &&
    /window\.__sufeiyaWorkspaceWriterLease/.test(workspaceWriterLeaseSource) &&
    /navigator\.locks\.request\(`\$\{STORAGE_KEY\}:page-writer`, \{ mode: "exclusive", ifAvailable: true \}/.test(
      workspaceWriterLeaseSource,
    ) &&
    /window\.addEventListener\("pagehide"[\s\S]*release\(\)/.test(workspaceWriterLeaseSource),
  "workspace and journey share one exclusive page-writer Web Lock lease until pagehide",
);
check(
  /const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease\(\);[\s\S]*if \(!workspaceWriterLeaseAvailable\) storageWritable = false;[\s\S]*loadState\(\);[\s\S]*另一个苏肥鸭页面正在编辑本机学习数据[\s\S]*disableWorkspaceControls\(\)/.test(
    workspaceScript,
  ) &&
    /const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease\(\);[\s\S]*if \(!workspaceWriterLeaseAvailable\) storageWritable = false;[\s\S]*loadState\(\);[\s\S]*另一个苏肥鸭页面正在编辑本机学习数据[\s\S]*disableJourneyControls\(\)/.test(
      journeyScript,
  ),
  "a second workspace writer tab becomes read-only before any page controls are initialized",
);
check(
  publicLearningEventsScript === learningEventsScript &&
    publicWorkspaceScript === workspaceScript &&
    publicJourneyScript === journeyScript &&
    publicWorkspaceBackupScript === workspaceBackupScript,
  "Next.js public learning-events, workspace, journey, and backup runtimes exactly match their authoritative source files",
);
check(
  /supersededCycles:\s*64/.test(workspaceBackupScript) &&
    /const SUPERSEDED_CYCLE_LIMIT = 64/.test(journeyScript) &&
    /status:\s*"capacity_reached"/.test(journeyScript) &&
    /status:\s*"cycle_conflict"/.test(journeyScript) &&
    !/supersededCycles\s*=\s*\[\.\.\.existing, receipt\]\.slice/.test(journeyScript) &&
    (journeyScript.match(/const archiveOutcome = archiveSupersededCycle\(\);/g) || []).length === 2 &&
    (journeyScript.match(/superseded_cycle_capacity/g) || []).length >= 4,
  "superseded diagnostic receipts retain ledger coverage and fail closed at one shared 64-cycle capacity",
);
check(
  /const checkInMatches = allCheckIns\(candidateState\)\.filter/.test(journeyScript) &&
    /checkInMatches\.length !== 1/.test(journeyScript) &&
    /hasArchivedAt !== hasArchivedReason/.test(journeyScript) &&
    /learner_revision_after_confirmation/.test(journeyScript) &&
    /delete projectedCheckIn\.archivedAt;[\s\S]*delete projectedCheckIn\.archivedReason;/.test(journeyScript) &&
    /checkIn:\s*projectedCheckIn/.test(journeyScript),
  "terminal cycle mirror accepts only one strictly validated archived check-in projection",
);
check(
  /const validWorkspaceBackupTaskProgress = \(candidateState\) =>/.test(journeyScript) &&
    /const validWorkspaceBackupPracticeState = async \(candidateState\) =>/.test(journeyScript) &&
    /const validWorkspaceBackupFocusState = \(candidateState\) =>/.test(journeyScript) &&
    /const WORKSPACE_BACKUP_EVENT_CONTEXT_KIND = Object\.freeze/.test(journeyScript) &&
    /JSON\.stringify\(receipt\.qualityFlags\) === JSON\.stringify\(expectedQualityFlags\)/.test(journeyScript) &&
    /for \(const \[kind, domainRecords\] of Object\.entries\(records\)\)/.test(journeyScript) &&
    /if \(!usedAliases\.has\(alias\)\) return false/.test(journeyScript) &&
    /workspaceBackupSupersededMatchesTerminalHistory/.test(journeyScript) &&
    /practice\.draftText\.replace\(\/\\r\\n\/g, "\\n"\)\.trim\(\)/.test(journeyScript) &&
    /await workspaceBackupRuntime\.sha256Hex\(normalizedArtifact\) !== latestReceipt\.evidence\.artifactHash/.test(journeyScript) &&
    /record\.didText\.length > 300/.test(journeyScript) &&
    /record\.evidenceText\.length > 500/.test(journeyScript) &&
    /record\.questionText\.length > 300/.test(journeyScript) &&
    /record\.didText\.length < 10/.test(journeyScript) &&
    /record\.evidenceText\.length < 10/.test(journeyScript) &&
    /record\.questionStatus === "none" && record\.questionText !== ""/.test(journeyScript) &&
    /record\.questionStatus === "has_question" && record\.questionText\.length === 0/.test(journeyScript) &&
    /const validPracticeReceiptWriterSemantics = \(receipt, catalog\) =>/.test(journeyScript) &&
    /receipt\.contentRef\.contentHash !== catalog\.contentHash/.test(journeyScript) &&
    /receipt\.attemptCount === evidence\.attemptCount/.test(journeyScript) &&
    /receipt\.wordCount === evidence\.wordCount/.test(journeyScript) &&
    /receipt\.selfCheckCount === evidence\.selfCheckCount/.test(journeyScript) &&
    /receipt\.audioRecorded === evidence\.audioRecorded/.test(journeyScript) &&
    /const practiceReceiptScopeShapeValid = \(receipt\) =>/.test(journeyScript) &&
    /const validWorkspaceBackupReceiptDomainScope = \(candidateState, receipt, catalog\) =>/.test(journeyScript) &&
    /attemptIds\.has\(receipt\.practiceAttemptId\)/.test(journeyScript),
  "workspace restore validates exact progress, practice, focus, receipt flags, event bindings, and superseded mirrors",
);
check(
  /const workspaceBackupCalendarDateValid = \(value\) =>/.test(journeyScript) &&
    /profile\.nickname === profile\.nickname\.trim\(\)/.test(journeyScript) &&
    /workspaceBackupCalendarDateValid\(profile\.examDate\)/.test(journeyScript) &&
    /const provenanceKeys = standalone[\s\S]*diagnosticBound[\s\S]*retestFollowup/.test(journeyScript) &&
    /learner_configured_standalone/.test(journeyScript) &&
    /learner_configured_after_gate_a_evidence_diagnostic/.test(journeyScript) &&
    /learner_confirmed_parallel_retest_followup/.test(journeyScript) &&
    /learner_selected_provisional_followup_pending_human_review/.test(journeyScript) &&
    /!exactObjectKeys\(plan, \[\.\.\.commonPlanKeys, \.\.\.retirementKeys\]\)/.test(journeyScript) &&
    /const WORKSPACE_BACKUP_DRAFT_CHECK_IN_KEYS = Object\.freeze/.test(journeyScript) &&
    /Date\.parse\(record\.savedAt\) > Date\.parse\(record\.updatedAt\)/.test(journeyScript) &&
    /record\.updatedAt !== record\.reviewedAt/.test(journeyScript) &&
    /confirmationCanonical\.size !== 1/.test(journeyScript) &&
    /Date\.parse\(record\.archivedAt\) < Date\.parse\(record\.updatedAt\)/.test(journeyScript),
  "workspace restore reapplies exact profile, plan provenance, and check-in confirmation writer unions",
);
check(
  /const replaceWorkspaceAtomically = async/.test(workspaceBackupScript) &&
    /afterWrite !== candidateRaw[\s\S]*concurrent_write/.test(workspaceBackupScript) &&
    /afterValidation !== candidateRaw[\s\S]*concurrent_write/.test(workspaceBackupScript) &&
    /rollbackIfCandidateStillOwned/.test(workspaceBackupScript),
  "workspace restore uses precondition, write-back, post-validation CAS, and owned rollback",
);
check(
  /const refreshWorkspacePageRuntimeAfterRestore = async/.test(workspaceScript) &&
    /restoredRaw = window\.localStorage\.getItem\(STORAGE_KEY\)/.test(workspaceScript) &&
    /state = normalized;[\s\S]*rawStoredValue = restoredRaw;[\s\S]*workspaceStateRecognized = true;[\s\S]*learningLedgerStatus = restoredLedgerStatus;[\s\S]*await updateDataPage\(\)/.test(
      workspaceScript,
    ) &&
    /window\.SufeiyaWorkspacePageRuntime = Object\.freeze\([\s\S]*refreshAfterWorkspaceRestore: refreshWorkspacePageRuntimeAfterRestore/.test(
      workspaceScript,
    ) &&
    /const synchronizeJourneyRuntimeAfterWorkspaceRestore = async \(candidateRaw\)/.test(journeyScript) &&
    /persistedRaw !== candidateRaw[\s\S]*validateWorkspaceBackupCandidate\(JSON\.parse\(persistedRaw\)\)[\s\S]*refreshAfterWorkspaceRestore\(\)[\s\S]*state = validation\.candidate;[\s\S]*learningLedgerStatus = restoredLedgerStatus/.test(
      journeyScript,
    ) &&
    /const synchronization = await synchronizeJourneyRuntimeAfterWorkspaceRestore\(candidateRaw\);[\s\S]*synchronization\.status !== "synchronized"[\s\S]*window\.location\.reload\(\);[\s\S]*committed = true;[\s\S]*success\.hidden = false/.test(
      journeyScript,
    ),
  "successful workspace restore synchronizes both page runtimes and refreshes My Data before success is shown",
);
check(
  /const exportButton = document\.querySelector\("\[data-export-restorable-workspace\]"\);/.test(journeyScript) &&
    !/const exportButton = root\.querySelector\("\[data-export-restorable-workspace\]"\);/.test(journeyScript) &&
    /code:\s*"export_unavailable"/.test(journeyScript),
  "restorable export binds the unique export control outside the restore section and reports unavailable state explicitly",
);

const renderPracticeBindingSource = sourceSection(workspaceScript, "const renderPracticeBindingStatus", "const practiceRoot");
const checkInSetupSource = sourceSection(workspaceScript, 'const checkinForm = document.querySelector("#checkin-form")', "const clearNamespace");
const renderTodaySource = sourceSection(workspaceScript, "const renderToday", "renderToday();");
const recommendationReceiptSource = sourceSection(journeyScript, "const renderRecommendationReceipt", "const setupRecommendations");
const renderCommunitySource = sourceSection(journeyScript, "const renderCommunity", "const setupCommunity");
check(
  /checkInLink\.hidden = true/.test(renderPracticeBindingSource) &&
    /receipt\.evidenceStatus === "evidence_limited"/.test(renderPracticeBindingSource) &&
    /practiceReceiptMatchesJourneyScope\([\s\S]*completion_receipt_id[\s\S]*cycle_id[\s\S]*recommendation_id/.test(
      renderPracticeBindingSource,
    ) &&
    /checkInLink\.href = `\/check-in#\$\{fragment\.toString\(\)\}`[\s\S]*checkInLink\.hidden = false/.test(
      renderPracticeBindingSource,
    ),
  "only a qualifying current closed-loop practice receipt exposes a fragment-bound contextual check-in action",
);
check(
  /window\.location\.hash\.replace\(\/\^#\//.test(checkInSetupSource) &&
    /fragmentParams\.get\("plan_id"\) === recommendationChainAtEntry\.plan\.planId/.test(checkInSetupSource) &&
    /fragmentParams\.get\("task_id"\) === task\.taskId/.test(checkInSetupSource) &&
    /fragmentParams\.get\("completion_receipt_id"\) === practiceReceipt\.completionReceiptId/.test(checkInSetupSource) &&
    /fragmentParams\.get\("cycle_id"\) === recommendationChainAtEntry\.cycle\.cycleId/.test(checkInSetupSource) &&
    /fragmentParams\.get\("recommendation_id"\) === recommendationChainAtEntry\.recommendation\.recommendationId/.test(
      checkInSetupSource,
    ) &&
    /!fragmentRequested && closedLoopEntryCandidates\.length === 1/.test(checkInSetupSource) &&
    /savedHasSubstantiveContent[\s\S]*为避免静默覆盖/.test(checkInSetupSource) &&
    /打卡入口参数未通过当前计划、推荐与练习回执的本机核对；没有自动关联任务/.test(checkInSetupSource) &&
    /practiceReceiptMatchesJourneyScope\([\s\S]*pendingClosedLoop[\s\S]*receiptMatchesClosedLoop/.test(checkInSetupSource),
  "check-in revalidates every fragment identifier, preserves existing drafts, and only auto-selects one qualifying current receipt",
);
check(
  /recommendation\.status === "accepted" && isSafeLocalRoute\(recommendation\.primary\?\.route\)[\s\S]*start\.href = acceptedPrimaryRoute/.test(
    recommendationReceiptSource,
  ) && /data-recommendation-start hidden>开始已接受的主任务/.test(await read("recommendations.html")),
  "an accepted recommendation starts its exact validated primary practice route",
);
check(
  /data-today-plan-boundary/.test(await read("today.html")) &&
    /state\.plan[\s\S]*以下任务来自当前 7 天计划[\s\S]*新诊断已经开始，旧计划已归档[\s\S]*独立练习，不推进当前闭环/.test(
      renderTodaySource,
    ),
  "today explicitly distinguishes the current plan from independent fallback practice",
);
check(
  ![workspaceScript, journeyScript, await read("workspace.html"), await read("scripts/generate-pages.mjs"), superTeacherResponder, superTeacherDeterministicResponder, JSON.stringify(await read("data/super-teacher-source-register.json"))]
    .some((source) => /可编辑任务|可编辑的每日任务|生成可编辑的 7 天计划/.test(source)),
  "active plan UI and Sofia grounding do not claim direct per-task editing before that control exists",
);

const communitySetupSource = sourceSection(journeyScript, "const setupCommunity", "const showRetestPanel");
check(
  /const downstreamSealed = Boolean\([\s\S]*cycle\.retestId[\s\S]*cycle\.updatedPlanId[\s\S]*state\.journey\.retest\?\.cycleId === cycle\.cycleId[\s\S]*state\.journey\.planUpdate\?\.cycleId === cycle\.cycleId/.test(
    communitySetupSource,
  ) &&
    /if \(downstreamSealed\) \{[\s\S]*control\.disabled = true;[\s\S]*互助状态已封存[\s\S]*return;/.test(
      communitySetupSource,
    ) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;/.test(communitySetupSource),
  "community freezes after a retest or updated plan and rolls back a failed save",
);
check(
  /const next = document\.querySelector\("\[data-community-next\]"\)/.test(renderCommunitySource) &&
    /if \(!chain\.peerHelpComplete\) \{[\s\S]*next\.hidden = true;[\s\S]*return;/.test(renderCommunitySource) &&
    /if \(next\) next\.hidden = false/.test(renderCommunitySource) &&
    /if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*return;[\s\S]*renderCommunity\(\)/.test(communitySetupSource),
  "community reveals retest only after a centrally valid persisted peer-help receipt",
);

const recommendationSetupSource = sourceSection(journeyScript, "const setupRecommendations", "const peerHelpLabels");
const recommendationSeal = recommendationSetupSource.indexOf('return { status: "already_saved", record: previous }');
const recommendationCreate = recommendationSetupSource.indexOf('makeId("recommendation")');
check(
  recommendationSeal >= 0 &&
    recommendationCreate > recommendationSeal &&
    /withExclusiveJourneyWrite[\s\S]*persistedStateIsFresh\(\)/.test(recommendationSetupSource) &&
    /previous\?\.recommendationId === latestCycle\.recommendationId[\s\S]*previous\?\.cycleId === latestCycle\.cycleId[\s\S]*previous\?\.planId === latestCycle\.basePlanId/.test(
      recommendationSetupSource,
    ) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*status: "persist_failed"/.test(
      recommendationSetupSource,
    ),
  "the first same-cycle recommendation receipt is lock-sealed and failed persistence rolls back",
);
const retestSetupSource = sourceSection(journeyScript, "const setupRetest", "const journeyDefinitions");
const retestSeal = retestSetupSource.indexOf('return { status: "already_saved" }');
const retestCreate = retestSetupSource.indexOf('makeId("retest")');
check(
  /withExclusiveJourneyWrite[\s\S]*persistedStateIsFresh\(\)/.test(retestSetupSource) &&
    /const evidenceAlreadyRecorded = chain\.retestEvidenceComplete/.test(journeyScript) &&
    retestSeal >= 0 &&
    retestCreate > retestSeal &&
    /alreadyCompleted \|\| initialGate\.evidenceAlreadyRecorded[\s\S]*control\.disabled = true/.test(retestSetupSource) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*status: "persist_failed"/.test(
      retestSetupSource,
    ),
  "the first valid parallel-retest receipt is lock-sealed, disabled, and rollback-safe",
);
check(
  /navigator\.locks\?\.request/.test(journeyScript) &&
    /navigator\.locks\.request\(`\$\{STORAGE_KEY\}:sealed-write`, \{ mode: "exclusive" \}/.test(journeyScript) &&
    /latest\.updatedAt === state\.updatedAt/.test(journeyScript),
  "sealed journey receipts use an exclusive browser lock plus a fresh-state compare",
);

check(
  /diagnostic\.taskSetVersion !== TASK_SET_VERSION/.test(superTeacherLocalContext) &&
    /diagnostic\.taskSetDigest !== TASK_SET_DIGEST/.test(superTeacherLocalContext) &&
    /diagnostic\.cycleId !== cycle\.cycleId/.test(superTeacherLocalContext) &&
    /diagnostic\.diagnosticSessionId !== cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /diagnostic\.learnerConfirmedPriority !== true/.test(superTeacherLocalContext) &&
    /evidence\.length !== expectedIds\.length/.test(superTeacherLocalContext) &&
    /!evidence\.every\(validEvidence\)/.test(superTeacherLocalContext),
  "Super Teacher only opens from the current complete hashed diagnostic cycle",
);
const superTeacherContextConstructionSource = sourceSection(
  superTeacherLocalContext,
  "const context: LearnerContext",
  "const basePlan",
);
check(
  /completedEvidenceTaskCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(6\)/.test(superTeacherContracts) &&
    /summaryIntegrity:\s*z\.literal\("unsigned_device_summary"\)/.test(superTeacherContracts) &&
    /terminalEvidenceTaskCount:\s*z\.literal\(6\)/.test(superTeacherContracts) &&
    /taskSetDigest:\s*taskSetDigestSchema/.test(superTeacherContracts) &&
    /learnerContextSchema[\s\S]*?\.strict\(\)[\s\S]*?\.superRefine/.test(superTeacherContracts) &&
    !/taskEvidence|firstResponse|responseText/.test(superTeacherContextConstructionSource) &&
    /buildLocalGroundingBundle\(decision\.intent, currentContext\)/.test(superTeacherSessionProvider) &&
    !/fetch\(|XMLHttpRequest|sendBeacon/.test(superTeacherSessionProvider) &&
    /export function createLocalTeacherResponse/.test(superTeacherDeterministicResponder) &&
    /modelAttempted:\s*false/.test(superTeacherDeterministicResponder) &&
    !/fetch\(|XMLHttpRequest|sendBeacon/.test(superTeacherDeterministicResponder),
  "Super Teacher derives a strict minimal summary and keeps deterministic explanation browser-local",
);
check(
  /export const superTeacherResponseSchema = z[\s\S]*?safeLocalHrefSchema[\s\S]*?bilibiliHrefSchema[\s\S]*?sourceBoundary:[\s\S]*?\.strict\(\);/.test(
    superTeacherContracts,
  ) &&
    /const validatedAnswer = superTeacherResponseSchema\.safeParse\(answer\)/.test(superTeacherRoute) &&
    /Response\.json\(validatedAnswer\.data/.test(superTeacherRoute) &&
    /const validatedPayload = superTeacherResponseSchema\.safeParse\(response\)/.test(superTeacherSessionProvider) &&
    /response:\s*validatedPayload\.data/.test(superTeacherSessionProvider),
  "Super Teacher validates the complete strict response schema on both server and client",
);
const superTeacherSubmitSource = sourceSection(
  superTeacherSessionProvider,
  "async function submitQuestion",
  "async function clearConversation",
);
check(
  /createLocalTeacherResponse\([\s\S]*const userTurn[\s\S]*const assistantTurn[\s\S]*turns: \[\.\.\.current\.turns, userTurn, assistantTurn\]/.test(superTeacherSubmitSource) &&
    !/fetch\(|setConsent|consent: true/.test(superTeacherSubmitSource),
  "Sofia creates one validated local user-and-assistant pair without a server submission",
);
check(
  /银行卡\|银行卡号\|支付账号/.test(superTeacherPolicy) &&
    /digits\.length >= 13 && digits\.length <= 25/.test(superTeacherPolicy) &&
    /if \(containsSensitiveData\(trimmed\)\)/.test(superTeacherSubmitSource) &&
    superTeacherSubmitSource.indexOf("containsSensitiveData(trimmed)") < superTeacherSubmitSource.indexOf("const userTurn") &&
    !/fetch\(/.test(superTeacherSubmitSource),
  "Super Teacher blocks bank-card and long payment-number patterns before local save and performs no network send",
);
check(
  /basePlan\.provenance\.cycleId === cycle\.cycleId/.test(superTeacherLocalContext) &&
    /basePlan\.provenance\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /recommendation\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /checkIn\.recommendationId === cycle\.recommendationId/.test(superTeacherLocalContext) &&
    /retest\?\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /updatedPlan\.provenance\.taskSetDigest === TASK_SET_DIGEST/.test(superTeacherLocalContext),
  "Super Teacher local context includes only plan and progress records proven to share the diagnostic cycle",
);
const superTeacherSessionReadSource = sourceSection(
  superTeacherClientSession,
  "export function parseSession",
  "export function readSession",
);
const superTeacherHydrationSource = sourceSection(
  superTeacherSessionProvider,
  "const frame = window.requestAnimationFrame",
  "useEffect(() => {\n    const handleStorageChange",
);
check(
  /return \{ status: "corrupt", session: emptySession\(\) \}/.test(superTeacherSessionReadSource) &&
    /!Array\.isArray\(value\.turns\) \|\| !value\.turns\.every\(isStoredTurn\)/.test(superTeacherSessionReadSource) &&
    /setSessionReadIssue\(stored\.status\)/.test(superTeacherHydrationSource) &&
    !/saveSession\(/.test(superTeacherHydrationSource) &&
    /if \(sessionReadIssue\)/.test(superTeacherSubmitSource) &&
    /原记录不会被页面自动覆盖/.test(superTeacherSessionProvider),
  "corrupt or unsupported Super Teacher sessions stay read-only until explicit learner clearing",
);
const superTeacherCommitSource = sourceSection(
  superTeacherSessionProvider,
  "async function commitSession",
  "const contextSummary",
);
const superTeacherStorageSyncSource = sourceSection(
  superTeacherSessionProvider,
  "const handleStorageChange",
  "async function commitSession",
);
check(
  /revision:\s*0/.test(superTeacherClientSession) &&
    /Number\.isSafeInteger\(revision\)/.test(superTeacherSessionReadSource) &&
    /event\.key === SUPER_TEACHER_CHAT_KEY/.test(superTeacherStorageSyncSource) &&
    /setSessionReadIssue\("concurrent_change"\)/.test(superTeacherStorageSyncSource) &&
    /navigator\.locks\.request\(`\$\{SUPER_TEACHER_CHAT_KEY\}:write`, \{ mode: "exclusive" \}/.test(superTeacherCommitSource) &&
    /const stored = readSession\(window\.localStorage\)[\s\S]*!storedSessionMatches\(stored, sessionRef\.current\)/.test(superTeacherCommitSource) &&
    /revision:\s*sessionRef\.current\.revision \+ 1/.test(superTeacherCommitSource) &&
    superTeacherCommitSource.indexOf("saveSession(window.localStorage, next)") >= 0 &&
    superTeacherCommitSource.indexOf("saveSession(window.localStorage, next)") <
      superTeacherCommitSource.indexOf("sessionRef.current = next"),
  "Super Teacher detects CHAT_KEY races and compare-locks revisioned writes before advancing UI state",
);
const superTeacherLockDisclosureIndex = superTeacherClient.indexOf("<li><span>安全写入</span>");
const superTeacherQuestionFormIndex = superTeacherClient.indexOf("<SuperTeacherConversation", superTeacherLockDisclosureIndex);
check(
  /const \[safeWriteLockSupported, setSafeWriteLockSupported\] = useState\(false\)/.test(superTeacherSessionProvider) &&
    /const supportsSafeWriteLock = Boolean\(navigator\.locks\?\.request\)/.test(superTeacherSessionProvider) &&
    /浏览器写入锁可用，防止跨标签页覆盖[\s\S]*浏览器写入锁不可用，智能问答保持只读/.test(
      superTeacherClient,
    ) &&
    superTeacherLockDisclosureIndex >= 0 &&
    superTeacherQuestionFormIndex > superTeacherLockDisclosureIndex,
  "Super Teacher discloses Web Locks capability before the learner reaches question controls",
);
check(
  !/<ClerkProvider/.test(rootLayout) &&
    /await connection\(\)/.test(siteShell) &&
    /if \(!clerkState\.configured\) return shell/.test(siteShell) &&
    /<ClerkProvider[\s\S]*dynamic[\s\S]*localization=\{clerkLocalization\}[\s\S]*signInUrl="\/sign-in"[\s\S]*signUpUrl="\/sign-up"[\s\S]*\{shell\}[\s\S]*<\/ClerkProvider>/.test(
      siteShell,
    ) &&
    /formFieldInputPlaceholder__password: "请输入密码"/.test(siteShell) &&
    /formFieldInputPlaceholder__signUpPassword: "请创建密码"/.test(siteShell) &&
    /getClerkRuntimeState/.test(siteShell),
  "configured SiteShell is request-dynamic, mounts Clerk fail-closed, and has complete Chinese password placeholders",
);
check(
  protectedLearnerPaths.every((path) => clerkConfig.includes(`"${path}"`)) &&
    /export function isClerkProtectedPathname\(pathname: string\)/.test(clerkConfig) &&
    /pathname === protectedPath \|\| pathname\.startsWith\(`\$\{protectedPath\}\/`\)/.test(
      clerkConfig,
    ),
  "Clerk protected classifier covers learner and account roots plus all subroutes",
);
check(
  JSON.stringify([...configuredBetaProtectedPaths].sort()) ===
    JSON.stringify([...betaProtectedLearnerPaths].sort()) &&
    /export function isClerkBetaProtectedPathname\(pathname: string\)/.test(clerkConfig) &&
    /SUFEIYA_BETA_ACCESS_PROTOCOL = "sufeiya_invite_only_beta_v1"/.test(betaAccessConfig) &&
    /access\.protocolVersion !== SUFEIYA_BETA_ACCESS_PROTOCOL/.test(betaAccessConfig) &&
    /access\.status !== "approved"/.test(betaAccessConfig) &&
    /betaAccessFromSessionClaims/.test(betaAccessConfig) &&
    /Object\.hasOwn\(claims, SUFEIYA_BETA_ACCESS_METADATA_KEY\)/.test(betaAccessConfig) &&
    /verification_unavailable/.test(betaAccessConfig),
  "application invite gate admits only the exact Clerk-signed claim and fails closed when the claim is unavailable",
);
check(
  /if \(!clerkState\.configured\)/.test(teachingReviewPage) &&
    /const \{ userId, redirectToSignIn \} = await auth\(\)/.test(teachingReviewPage) &&
    /redirectToSignIn\(\{ returnBackUrl: "\/teaching-review-demo" \}\)/.test(teachingReviewPage) &&
    /evaluateReleaseSurface\("local_teaching_review_demo"\)/.test(teachingReviewPage) &&
    /if \(!governance\.enabled\)/.test(teachingReviewPage) &&
    /<SiteShell pageKey="workspace" sofiaSurface="none">/.test(teachingReviewPage),
  "teaching-review demo is Clerk protected, governance gated, and rendered without the Sofia runtime",
);
check(
  /CANONICAL_LEARNER_STORAGE_KEY = "sufeiya_workspace_v1"/.test(teachingReviewContract) &&
    /TEACHING_REVIEW_DEMO_STORAGE_KEY = "sufeiya_teaching_review_demo_v1"/.test(teachingReviewContract) &&
    /identityVerified: z\.literal\(false\)/.test(teachingReviewContract) &&
    /qualifiedHumanConfirmation: z\.literal\(false\)/.test(teachingReviewContract) &&
    /canonicalLedgerWrite: z\.literal\(false\)/.test(teachingReviewContract) &&
    /cycleClosureAttempted: z\.literal\(false\)/.test(teachingReviewContract) &&
    !/humanReviewReceiptId/.test(teachingReviewContract),
  "teaching-review draft contract fixes the non-authoritative boundary and contains no human-review receipt field",
);
check(
  /const ACTIVE_CYCLE_BINDING_FIELDS = \[/.test(teachingReviewContract) &&
    /function currentProvisionalCycle\(journey: JsonRecord, activeCycle: JsonRecord\)/.test(teachingReviewContract) &&
    /ACTIVE_CYCLE_BINDING_FIELDS\.every\(\(field\) => entry\[field\] === activeCycle\[field\]\)/.test(teachingReviewContract) &&
    /matching\.length === 1/.test(teachingReviewContract) &&
    /active_cycle_history_mismatch/.test(teachingReviewContract),
  "teaching-review evidence can only project the one provisional history snapshot fully bound to activeCycle",
);
check(
    /const DIAGNOSTIC_QUALITY_FLAGS = new Set/.test(teachingReviewContract) &&
    /const PRACTICE_QUALITY_FLAGS = new Set/.test(teachingReviewContract) &&
    /Object\.hasOwn\(DIAGNOSTIC_TASK_MANIFEST, taskId\)/.test(teachingReviewContract) &&
    /DIAGNOSTIC_TASK_IDS\.every\(\(taskId\) => seen\.has\(taskId\)\)/.test(teachingReviewContract) &&
    /flagsAreAllowed\(item\.qualityFlags, DIAGNOSTIC_QUALITY_FLAGS\)/.test(teachingReviewContract) &&
    /flagsAreAllowed\(receipt\.qualityFlags, PRACTICE_QUALITY_FLAGS\)/.test(teachingReviewContract) &&
    /primary\.teacherReviewed !== undefined/.test(teachingReviewContract) &&
    /teacherReviewed: false/.test(teachingReviewContract) &&
    /原始推荐文字在本演示视图中隐藏/.test(teachingReviewContract),
  "teaching-review projection allowlists coded flags, fixes human-review authority false, and replaces recommendation free text",
);
check(
  /receipt\.completionReceiptId !== receiptId/.test(teachingReviewContract) &&
    /const linkedTaskProgress =/.test(teachingReviewContract) &&
    /linkedTaskProgress\.completionClass !== "practice_receipt"/.test(teachingReviewContract) &&
    /linkedTaskProgress\.practiceReceiptId !== receiptId/.test(teachingReviewContract) &&
    /checkIn\.evidenceClass !== "practice_receipt"/.test(teachingReviewContract) &&
    /checkIn\.didText\.length < 10/.test(teachingReviewContract) &&
    /checkIn\.evidenceText\.length < 10/.test(teachingReviewContract),
  "teaching-review admission reproduces receipt map-key, task-progress, and check-in closure bindings",
);
check(
  !/fetch\s*\(|sendBeacon|WebSocket|SufeiyaLearningEvents|appendDomainEvent/.test(teachingReviewClient) &&
    !/localStorage\.(?:setItem|removeItem)\(CANONICAL_LEARNER_STORAGE_KEY/.test(teachingReviewClient) &&
    /localStorage\.setItem\(TEACHING_REVIEW_DEMO_STORAGE_KEY/.test(teachingReviewClient) &&
    /sourceAfter !== sourceBefore/.test(teachingReviewClient) &&
    /previousDemoRaw !== demoRawRef\.current/.test(teachingReviewClient) &&
    /!canDraft/.test(teachingReviewClient) &&
    /persistedDemoRaw === serialized/.test(teachingReviewClient) &&
    /verified\.revision !== draft\.revision/.test(teachingReviewClient) &&
    /verified\.sourceSnapshotSha256 !== draft\.sourceSnapshotSha256/.test(teachingReviewClient) &&
    /const restoreDemoRaw =/.test(teachingReviewClient) &&
    /setStorageStateUnknown\(true\)/.test(teachingReviewClient),
  "teaching-review client has zero network dispatch, never writes the learner namespace, compare-locks bytes, and fails closed on rollback uncertainty",
);
check(
  /isClerkProtectedPathname\(pathname\)/.test(routedLegacyPage) &&
    /const metadata = metadataForPage\(pageKey\)/.test(routedLegacyPage) &&
    /isClerkProtectedPathname\(pathnameForPage\(pageKey\)\)/.test(routedLegacyPage) &&
    /robots: \{ index: false, follow: false \}/.test(routedLegacyPage) &&
    /if \(!clerkState\.configured\)/.test(routedLegacyPage) &&
    /const \{ userId, redirectToSignIn \} = await auth\(\)/.test(routedLegacyPage) &&
    /if \(!userId\) return redirectToSignIn\(\{ returnBackUrl: pathname \}\)/.test(
      routedLegacyPage,
    ) &&
    explicitLegacyRouteSources.size === pageFiles.length - 1 &&
    [...explicitLegacyRouteSources].every(
      ([key, source]) =>
        source ===
        `import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";\n\n` +
          `export const metadata = metadataForRoutedPage("${key}");\n\n` +
          `export default function Page() {\n  return <RoutedLegacyPage pageKey="${key}" />;\n}\n`,
    ),
  "explicit canonical learner routes share fail-closed Clerk resource auth and route metadata",
);
check(
  dynamicLegacyPage ===
    `import type { Metadata } from "next";\n` +
      `import { notFound } from "next/navigation";\n\n` +
      `export const metadata: Metadata = {\n` +
      `  title: "页面没有找到｜苏肥鸭多邻国",\n` +
      `  robots: { index: false, follow: false },\n` +
      `};\n\n` +
      `export default function AnonymousCatchAllPage() {\n  notFound();\n}\n` &&
    !/@clerk|AuthPage|LegacyPage|RoutedLegacyPage|SiteShell|SofiaAccessBoundary/.test(
      dynamicLegacyPage,
    ),
  "unknown single-segment routes use a server-only catch-all before any Clerk or Sofia client graph",
);
check(
  JSON.stringify([...generatedLegacyRouteSlugs].sort()) ===
    JSON.stringify([...explicitLegacyRouteSlugs].sort()) &&
    explicitLegacyRouteSlugs.every((key) =>
      legacyContent.includes(
        `  "${key}": {\n    "key": "${key}",\n    "file": "${key}.html",\n    "path": "/${key}",`,
      ),
    ),
  "generated legacy route denominator and canonical paths match all 20 explicit route wrappers",
);
check(
  JSON.stringify([...configuredCleanRoutes].sort()) ===
    JSON.stringify([...explicitLegacyRouteSlugs, "super-teacher"].sort()),
  "clean-route redirects equal the 20 explicit legacy routes plus super-teacher",
);
check(
  JSON.stringify([...configuredProtectedPaths].sort()) ===
    JSON.stringify([...protectedLearnerPaths].sort()) &&
    JSON.stringify(
      explicitLegacyRouteSlugs
        .filter((slug) => !configuredProtectedPaths.includes(`/${slug}`))
        .sort(),
    ) === JSON.stringify(["about", "learning-path", "platform", "resources"]),
  "Clerk path classifier covers exactly 16 protected legacy routes plus account and teaching review",
);
check(
  JSON.stringify([...configuredClerkPublicRuntimePaths].sort()) ===
    JSON.stringify([
      "/",
      "/about",
      "/beta-access",
      "/learning-path",
      "/platform",
      "/resources",
      "/sign-in",
      "/sign-up",
      "/super-teacher",
    ]) &&
    /export function isClerkRuntimePathname\(pathname: string\)/.test(clerkConfig) &&
    /pathname === "\/sign-in" \|\| pathname\.startsWith\("\/sign-in\/"\)/.test(
      clerkConfig,
    ) &&
    /pathname === "\/sign-up" \|\| pathname\.startsWith\("\/sign-up\/"\)/.test(
      clerkConfig,
    ) &&
    /pathname === "\/beta-access" \|\| pathname\.startsWith\("\/beta-access\/"\)/.test(
      clerkConfig,
    ) &&
    /pathname === "\/api\/super-teacher"/.test(clerkConfig) &&
    /pathname === "\/__clerk"[\s\S]*pathname\.startsWith\("\/__clerk\/"\)/.test(
      clerkConfig,
    ),
  "Clerk runtime allowlist covers exact public UI, protected prefixes, auth catch-alls, the Sofia API, and Clerk FAPI proxy",
);
check(
  configuredProtectedPaths.every((path) => proxyScript.includes(`"${path}/:path*"`)) &&
    proxyScript.includes('"/sign-in/:path*"') &&
    proxyScript.includes('"/sign-up/:path*"') &&
    proxyScript.includes('"/beta-access/:path*"') &&
    proxyScript.includes('"/(api|trpc)(.*)"') &&
    proxyScript.includes('"/__clerk/(.*)"'),
  "outer proxy matcher cannot bypass protected or Clerk catch-all paths through file-like child segments",
);
check(
  JSON.stringify(topLevelAppPageSegments) ===
    JSON.stringify(
      [
        "[slug]",
        "beta-access",
        ...explicitLegacyRouteSlugs,
        "super-teacher",
        "teaching-review-demo",
      ].sort(),
    ),
  "top-level App Router page allowlist contains no undeclared explicit route",
);
check(
  /if \(!clerkState\.configured\)/.test(accountPage) &&
    /const \{ userId, redirectToSignIn \} = await auth\(\)/.test(accountPage) &&
    /redirectToSignIn\(\{ returnBackUrl: "\/account" \}\)/.test(accountPage) &&
    /<UserProfile[\s\S]*routing="path"[\s\S]*path="\/account"/.test(accountPage),
  "account route fails closed, verifies a Clerk session, and renders the account profile",
);
check(
  /<ClerkWidgetFrame mode="sign-in" \/>/.test(signInPage) &&
    /<ClerkWidgetFrame mode="sign-up" \/>/.test(signUpPage) &&
    /hasClerkInvitationTicket/.test(signUpPage) &&
    /invitationTicketPresent \? \(/.test(signUpPage) &&
    /<InvitationOnlyPanel \/>/.test(signUpPage) &&
    /<SignIn[\s\S]*routing="path"[\s\S]*fallbackRedirectUrl="\/workspace"[\s\S]*fallback=\{loadingPanel\}/.test(
      clerkWidgetFrame,
    ) &&
    /<SignUp[\s\S]*routing="path"[\s\S]*fallbackRedirectUrl="\/workspace"[\s\S]*fallback=\{loadingPanel\}/.test(
      clerkWidgetFrame,
    ) &&
    /<ClerkLoading>\{loadingPanel\}<\/ClerkLoading>/.test(clerkWidgetFrame) &&
    /<ClerkFailed>[\s\S]*<ClerkConnectionPanel mode="failed" \/>[\s\S]*<\/ClerkFailed>/.test(
      clerkWidgetFrame,
    ) &&
    /<ClerkLoaded>/.test(clerkWidgetFrame) &&
    /ClerkUnavailablePanel/.test(`${signInPage}\n${signUpPage}`),
  "sign-in and invitation-ticket sign-up use Clerk with continuous loading, failure, workspace fallback, and safe unconfigured states",
);
check(
  /SUFEIYA_BETA_ACCESS_CONTEXT_HEADER/.test(betaAccessPage) &&
    /if \(accessContext === "approved"\) redirect\(returnPath\)/.test(betaAccessPage) &&
    /isClerkBetaProtectedPathname\(value\)/.test(betaAccessPage) &&
    /mode=\{accessContext === "invitation_required" \? "waiting" : "verification-unavailable"\}/.test(
      betaAccessPage,
    ) &&
    /APPLICATION INVITE GATE/.test(authPage) &&
    /不等同于 Clerk 付费套餐中的原生 Restricted mode/.test(authPage),
  "beta access page uses the middleware decision, constrains return paths, and discloses the application-gate boundary",
);
check(
  /<Show when="signed-out">[\s\S]*href="\/sign-in"/.test(clerkAccountControls) &&
    /<Show when="signed-in">[\s\S]*href="\/account"[\s\S]*<UserButton/.test(clerkAccountControls) &&
    /学习数据仍在本机/.test(siteShell),
  "site shell exposes session-aware account controls without claiming cloud learning-data storage",
);
check(
  /登录不会自动迁移、上传或绑定当前浏览器/.test(authPage) &&
    /不会自动上传、迁移或绑定学习数据/.test(authPage) &&
    !/LocalOnlyAccountPanel/.test(authPage),
  "account surfaces preserve the independent local-learning-data boundary",
);
check(
  /clerkMiddleware/.test(proxyScript) &&
    /createRouteMatcher/.test(proxyScript) &&
    /await auth\.protect\(\)/.test(proxyScript) &&
    /authorizedParties: getClerkAuthorizedParties\(\)/.test(proxyScript) &&
    /vercelEnvironment === "production"[\s\S]*"production"[\s\S]*vercelEnvironment === "preview" \|\| vercelEnvironment === "development"[\s\S]*"development"/.test(clerkConfig) &&
    /"https:\/\/sufeiya\.cn"/.test(clerkConfig) &&
    /"https:\/\/www\.sufeiya\.cn"/.test(clerkConfig) &&
    /signInUrl: "\/sign-in"/.test(proxyScript) &&
    /signUpUrl: "\/sign-up"/.test(proxyScript) &&
    /contentSecurityPolicy:[\s\S]*strict:\s*true/.test(proxyScript) &&
    /configuredClerkProxy[\s\S]*isConfiguredClerkMiddlewarePathname\(request\.nextUrl\.pathname\)/.test(
      proxyScript,
    ) &&
    /"script-src-attr": \["none"\]/.test(proxyScript) &&
    /"frame-ancestors": \["none"\]/.test(proxyScript) &&
    /"\/__clerk\/\(\.\*\)"/.test(proxyScript) &&
    /betaAccessFromSessionClaims\(signedIn\.sessionClaims\)/.test(proxyScript) &&
    !/clerkClient|users\.getUser|currentUser\(/.test(proxyScript) &&
    /isBetaProtectedRoute\(request\)[\s\S]*betaVerificationUnavailableResponse/.test(proxyScript) &&
    /!access\.approved && isBetaProtectedRoute\(request\)/.test(proxyScript) &&
    /return betaAccessRedirect\(request\)/.test(proxyScript) &&
    /requestHeaders\.set\(SUFEIYA_BETA_ACCESS_CONTEXT_HEADER, context\)/.test(proxyScript) &&
    !/frontendApiProxy/.test(proxyScript),
  "proxy centrally authenticates and invite-gates learner routes with strict CSP, environment-bound instances, and production authorized parties",
);
check(
  /function isIndexablePublicPath/.test(proxyScript) &&
    /policy: "public" \| "signed-in-public" \| "sensitive"/.test(proxyScript) &&
    /policy === "sensitive" \? \{ "X-Robots-Tag": "noindex, nofollow" \} : \{\}/.test(proxyScript) &&
    /return signedIn \? "signed-in-public" as const : "public" as const/.test(proxyScript),
  "public content remains indexable while signed-in public and sensitive responses remain private",
);
check(
  /const anonymousContentSecurityPolicy = \[[\s\S]*"script-src 'self' 'unsafe-inline'"/.test(
    proxyScript,
  ) &&
    /const anonymousContentSecurityPolicy = \[[\s\S]*"script-src-attr 'none'"/.test(
      proxyScript,
    ) &&
    /clerkState\.configured \? "anonymous-no-clerk" : "clerk-unconfigured"/.test(
      proxyScript,
    ) &&
    !/anonymousContentSecurityPolicy[\s\S]{0,500}nonce-|anonymousContentSecurityPolicy[\s\S]{0,500}strict-dynamic/.test(
      proxyScript,
    ),
  "unknown routes bypass Clerk nonce middleware and retain a nonce-free anonymous CSP for static 404 hydration",
);
check(
  /X-Sufeiya-Account-Mode[\s\S]*clerk-invite-gated-local-learning-data/.test(proxyScript) &&
    /X-Sufeiya-Beta-Access/.test(proxyScript) &&
    /X-Sufeiya-Account-Mode[\s\S]*clerk-unconfigured/.test(proxyScript),
  "application responses distinguish invite access state from the fail-closed Clerk configuration state",
);
check(/Sofia智能老师/.test(superTeacherPage), "Sofia AI Teacher has a dedicated Next.js application page");
check(
  /const \{ isLoaded, isSignedIn \} = useAuth\(\)/.test(superTeacherAccessBoundary) &&
    /const interactiveAccess = isLoaded && isSignedIn && betaAccessContext === "approved"/.test(
      superTeacherAccessBoundary,
    ) &&
    /if \(!interactiveAccess\) return <SofiaPublicPage/.test(superTeacherAccessBoundary) &&
    /interactiveAccess \? \([\s\S]*<SuperTeacherSessionProvider>[\s\S]*<SofiaFloatingAssistant/.test(superTeacherAccessBoundary) &&
    /invitation-required/.test(superTeacherPublicAccess) &&
    /未登录时不会读取或显示这个浏览器/.test(superTeacherPublicAccess) &&
    !/localStorage|sessionStorage|useSuperTeacherSession/.test(superTeacherPublicAccess) &&
    /clerkState\.configured[\s\S]*SofiaAccessBoundary[\s\S]*SofiaUnavailableBoundary/.test(siteShell),
  "signed-out and uninvited Sofia surfaces render a public teaser without mounting or reading the local learner session",
);
check(/Sofia智能老师/.test(legacyContent), "generated Next.js legacy content uses the Sofia AI Teacher name");
check(!/苏肥鸭超级智能老师|超级智能老师|超级老师/.test(legacyContent), "generated Next.js legacy content has no retired teacher name");
check(
  /工作台与学习页面先使用 Clerk 登录，再核验 Sufeiya 内测资格/.test(legacyContent) &&
    /账户登录用于保护学习页面/.test(legacyContent) &&
    /不会自动绑定账户、上传或同步到其他设备/.test(legacyContent),
  "generated legacy content describes Clerk access control separately from local learning-data storage",
);
check(
  !/无需注册|没有账号系统|免登录 · 本机保存|不登录、不上传/.test(legacyContent) &&
    !/不登录、不上传/.test(workspace) &&
    /登录只控制访问；学习数据不上传，可随时清除/.test(workspace),
  "generated legacy content has no stale account-deferral claims",
);
check(
  /不会发送到本站服务端、Clerk 或外部模型/.test(superTeacherConversation) &&
    !/fetch\(|history\s*:/.test(superTeacherSubmitSource),
  "Super Teacher discloses and enforces browser-local deterministic processing",
);
const floatingCloseSource = sourceSection(
  superTeacherFloatingAssistant,
  "function closeAssistant",
  "function handleDialogClose",
);
check(
  /<dialog/.test(superTeacherFloatingAssistant) &&
    /dialog\.showModal\(\)/.test(superTeacherFloatingAssistant) &&
    /\.dialog::backdrop/.test(superTeacherFloatingStyles),
  "floating Sofia assistant uses a native modal dialog",
);
check(
  /aria-label="关闭 Sofia智能老师介绍"/.test(superTeacherPublicAccess) &&
    /\.headerActions button:not\(\.closeButton\):first-child/.test(superTeacherFloatingStyles),
  "the mobile public Sofia dialog keeps its only close control visible",
);
check(
  /dialog\.close\(\)/.test(floatingCloseSource) &&
    !/abortCurrentRequest|revokeConsent/.test(floatingCloseSource),
  "closing the browser-local floating Sofia assistant closes the native dialog without a pending network request",
);
check(
  /data-voice-enabled="false"/.test(superTeacherFloatingAssistant) &&
    /语音功能正在完成授权资料、供应商数据流和删除流程复核，当前不会请求麦克风或发送音频。/.test(
      superTeacherFloatingAssistant,
    ) &&
    !/getUserMedia|MediaRecorder|mediaDevices/.test(superTeacherFloatingAssistant),
  "floating Sofia assistant keeps voice visibly disabled without microphone code",
);
check(
  /AI 学习助手，不是 Sofia 真人实时通话/.test(superTeacherFloatingAssistant) &&
    /launcherAiBadge/.test(superTeacherFloatingAssistant),
  "floating Sofia assistant discloses AI identity beside its portrait",
);
check(
  /isSameOrigin[\s\S]*getClerkRuntimeState[\s\S]*await auth\(\)[\s\S]*!userId[\s\S]*betaAccessFromSessionClaims\(sessionClaims\)[\s\S]*!betaAccess\.approved[\s\S]*MAX_BODY_BYTES[\s\S]*checkSuperTeacherRateLimit\(userId\)/.test(
    superTeacherRoute,
  ) && !/clerkClient|users\.getUser|currentUser\(/.test(superTeacherRoute),
  "Super Teacher POST requires a beta-approved Clerk user before rate limiting and model access",
);
check(
  /evaluateReleaseSurface\("sofia_first_party_text_processing"\)/.test(superTeacherRoute) &&
    /if \(!firstPartyProcessing\.enabled\)[\s\S]*student_data_processing_not_approved/.test(superTeacherRoute) &&
    superTeacherRoute.indexOf("student_data_processing_not_approved") < superTeacherRoute.indexOf("await request.text()"),
  "Super Teacher POST fails closed before reading a body while first-party student-data processing is not approved",
);
check(
  /SUPER_TEACHER_STATUS_PROTOCOL = "sufeiya_super_teacher_status_v4"/.test(superTeacherContracts) &&
    /interactionProtocolVersion: SUPER_TEACHER_PROTOCOL/.test(superTeacherStatus) &&
    /gateAStaticClaimSources/.test(superTeacherContracts) &&
    /buildSuperTeacherStatusResponse\(\)/.test(superTeacherRoute) &&
    /teacherSurfaceAccess: "public_teaser"/.test(superTeacherStatus) &&
    /interactiveTeacherAccess: "clerk_invitation_approved"/.test(superTeacherStatus) &&
    /localManualExplanationEnabled: true/.test(superTeacherStatus) &&
    /firstPartyServerProcessingEnabled: firstPartyProcessing\.enabled/.test(superTeacherStatus) &&
    /externalModelProcessingEnabled: modelStatus\.enabled/.test(superTeacherStatus) &&
    /disabled_pending_first_party_processing_approval/.test(superTeacherStatus) &&
    /learningPageAccess: "clerk_invitation_approved"/.test(superTeacherStatus) &&
    /learningDataStorage: "browser_local_not_account_bound"/.test(superTeacherStatus) &&
    /clerk-invite-gated-local-learning-data/.test(superTeacherRoute),
  "Super Teacher status separates the public teaser, invitation-approved local interaction, disabled server/model processing, and browser-local data",
);
check(
  /invokeTeacherModel[\s\S]*materializeApprovedModelSelection/.test(superTeacherResponder) &&
    /exactIdSet\(selection\.claimIds[\s\S]*exactIdSet\(selection\.limitationIds/.test(superTeacherResponder) &&
    /response_format:\s*\{ type: "json_object" \}[\s\S]*modelTeacherSelectionSchema/.test(superTeacherModelRuntime) &&
    /Output\.object[\s\S]*modelTeacherSelectionSchema/.test(superTeacherModelRuntime),
  "Super Teacher lets providers only order exact server-approved claim IDs",
);
check(/manualAnswer[\s\S]*tryModelAnswer[\s\S]*fallback/.test(superTeacherResponder), "Super Teacher has a deterministic grounded fallback");
const p0SectionCounts = Object.fromEntries(
  ["A", "B", "C", "D", "E", "F"].map((section) => [
    section,
    p0DecisionLog.items.filter((item) => item.section === section).length,
  ]),
);
check(
  p0DecisionLog.protocolVersion === "sufeiya_p0_decision_log_v1" &&
    p0DecisionLog.ledgerRevision === 1 &&
    p0DecisionLog.previousLedgerSha256 === null &&
    p0DecisionLog.ledgerContentSha256 === "0cbccd9dd8c7d149dd2d2d7a23b219d1bd8ca19d200d73ade2e50b1038c1886f" &&
    p0DecisionLog.defaultDisposition === "deny" &&
    p0DecisionLog.authorityPolicy === "decision_log_never_authorizes_release_surfaces" &&
    p0DecisionLog.guardrailTextPolicy === "conservative_source_paraphrase_never_a_meeting_outcome" &&
    p0DecisionLog.ownerDecisionArtifactPolicy === "unique_artifact_per_item_role_event_until_signed_batch_manifest_v1" &&
    p0DecisionLog.historyPolicy === "hash_chained_events_with_published_baseline" &&
    p0DecisionLog.canonicalDefinitionSetSha256 === "aa8541908240f7ed44abf20b25ddf8a2d917f13f94d103f50288323f541c8bfd" &&
    p0DecisionLog.decisionRolePolicySha256 === "a058cac9e9abd6e6615fa3bcae4f3cdaa3367c2e68532073bedb2eeb925ea1f6" &&
    p0DecisionLog.sourcePlan.contentSha256 === "6ad237bf7433134961c2b4f9de4cb0f055391b9179e6b4632c269cdd84809169" &&
    p0DecisionLog.sourcePlan.expectedItemCount === 29 &&
    p0DecisionLog.items.length === 29 &&
    new Set(p0DecisionLog.items.map((item) => item.id)).size === 29 &&
    JSON.stringify(p0DecisionLog.items.map((item) => item.order)) === JSON.stringify(Array.from({ length: 29 }, (_, index) => index + 1)) &&
    p0DecisionLog.items[5]?.question === "声音/数字人" &&
    p0DecisionLog.items[8]?.question === "学生评论/案例（部分已确认）" &&
    p0DecisionLog.items[27]?.question === "Gate A / Gate B 与参考评分" &&
    p0DecisionLog.items.every((item) => typeof item.operationalGuardrail === "string" && /^[a-f0-9]{64}$/.test(item.definitionSha256)) &&
    JSON.stringify(p0SectionCounts) === JSON.stringify({ A: 4, B: 6, C: 4, D: 6, E: 4, F: 5 }) &&
    p0DecisionLog.items.every((item) => Array.isArray(item.decisionHistory) && item.decisionHistory.length === 0),
  "Appendix A has a separate fixed 29-item P0 log whose open decisions default to deny and carry no release authority",
);
check(
  p0PublishedBaseline.protocolVersion === "sufeiya_p0_published_baseline_v1" &&
    p0PublishedBaseline.sourceLedgerRevision === p0DecisionLog.ledgerRevision &&
    p0PublishedBaseline.sourceLedgerContentSha256 === p0DecisionLog.ledgerContentSha256 &&
    p0PublishedBaseline.canonicalDefinitionSetSha256 === p0DecisionLog.canonicalDefinitionSetSha256 &&
    p0PublishedBaseline.decisionRolePolicySha256 === p0DecisionLog.decisionRolePolicySha256 &&
    p0PublishedBaseline.baselineContentSha256 === "92eb7712ec9e310cc1cf1dc0f76a28cb89195a6585e99d699b7a593bf06a9616" &&
    p0PublishedBaseline.evidenceFingerprints.length === 0 &&
    p0PublishedBaseline.itemHistoryHeads.length === 29 &&
    p0PublishedBaseline.itemHistoryHeads.every((head, index) =>
      head.itemId === p0DecisionLog.items[index]?.id && head.eventSha256s.length === 0
    ),
  "published P0 baseline seals the current evidence and decision-history prefixes",
);
check(
  /p0DecisionLogSchema[\s\S]*items:\s*z\.array\(p0ItemSchema\)\.length\(29\)/.test(p0DecisionLogSource) &&
    /P0 item does not match Appendix A/.test(p0DecisionLogSource) &&
    /unknown runtime control/.test(p0DecisionLogSource) &&
    /P0 canonical definition set digest mismatch/.test(p0DecisionLogSource) &&
    /P0 decision-role policy digest mismatch/.test(p0DecisionLogSource) &&
    /owner-decision evidence is not bound to the exact P0 event/.test(p0DecisionLogSource) &&
    /owner-decision artifact reuse is forbidden without a signed batch manifest/.test(p0DecisionLogSource) &&
    /lacks item-specific approval evidence/.test(p0DecisionLogSource) &&
    /does not hash-link the immediately prior event/.test(p0DecisionLogSource) &&
    /validateP0DecisionLogAgainstPublishedBaseline/.test(p0DecisionLogSource) &&
    /strict RFC 3339 timestamp with an explicit zone/.test(p0DecisionLogSource) &&
    /function deepFreeze[\s\S]*Object\.freeze/.test(p0DecisionLogSource) &&
    /formalGate0Pass:\s*false/.test(p0DecisionLogSource) &&
    /separate_explicit_controls_required/.test(p0DecisionLogSource),
  "P0 parser freezes the canonical log and rejects drift, dangling controls, weak evidence, and broken append history",
);
check(
  releaseDecisionRegister.protocolVersion === "sufeiya_release_decisions_v1" &&
    releaseDecisionRegister.defaultDisposition === "deny" &&
    releaseDecisionRegister.environmentPolicy === "one_register_for_local_preview_and_production" &&
    Array.isArray(releaseDecisionRegister.controls) &&
    new Set(releaseDecisionRegister.controls.map((control) => control.id)).size === releaseDecisionRegister.controls.length,
  "one versioned release decision register applies a deny-by-default policy to every environment",
);
check(
  releaseDecisionRegister.controls
    .filter((control) => control.status === "approved")
    .every((control) => control.decisionOwner && control.decidedAt && control.reviewDueAt && control.implementationImpact && control.evidenceReferenceIds?.length > 0) &&
    releaseDecisionRegister.evidenceCatalog.some((evidence) =>
      evidence.id === "approved_plan_2026-08-09" &&
      evidence.contentSha256 === "6ad237bf7433134961c2b4f9de4cb0f055391b9179e6b4632c269cdd84809169" &&
      evidence.verificationStatus === "verified_file_hash"
    ) &&
    releaseDecisionRegister.controls.some((control) => control.id === "voice_authorization_assertion_received" && control.status === "approved") &&
    releaseDecisionRegister.controls.some((control) => control.id === "voice_written_authorization_verified" && control.status === "pending_review") &&
    releaseDecisionRegister.controls.some((control) => control.id === "voice_data_flow" && control.status === "pending_review") &&
    releaseDecisionRegister.controls.some((control) => control.id === "server_student_data_processing" && control.status === "not_approved"),
  "approved decisions carry structured evidence, implementation impact, and review dates while a voice assertion remains narrower than verified authorization",
);
check(
  /releaseDecisionRegisterSchema[\s\S]*defaultDisposition:\s*z\.literal\("deny"\)/.test(releaseGovernanceSource) &&
    /approved release control lacks owner, decision time, current review, or evidence/.test(releaseGovernanceSource) &&
    /unknown release control/.test(releaseGovernanceSource) &&
    /approved plan evidence lacks SHA-256/.test(releaseGovernanceSource) &&
    /function deepFreeze[\s\S]*Object\.freeze/.test(releaseGovernanceSource) &&
    /blockedBindingIds/.test(releaseGovernanceSource),
  "release-governance parser rejects permissive, evidence-free, and dangling decisions and deep-freezes the canonical register",
);
check(
  /export async function GET\(\)/.test(releaseGovernanceStatusRoute) &&
    !/export async function (?:POST|PUT|PATCH|DELETE)/.test(releaseGovernanceStatusRoute) &&
    /sanitized_read_only_status/.test(releaseGovernanceStatusRoute) &&
    /private, no-store/.test(releaseGovernanceStatusRoute) &&
    /read-only-no-mutations/.test(releaseGovernanceStatusRoute) &&
    /p0Gate:\s*\{[\s\S]*resolved: p0Summary\.resolved[\s\S]*formalGate0Pass: p0Summary\.formalGate0Pass/.test(releaseGovernanceStatusRoute) &&
    /X-Sufeiya-P0-Protocol/.test(releaseGovernanceStatusRoute) &&
    !/evidenceCatalog|decisionOwner|contentSha256|locator|nextRegisterReviewAt|blockedDecisionIds|blockedBindingIds/.test(releaseGovernanceStatusRoute),
  "governance status API is GET-only, no-store, sanitized, and exposes no mutation surface",
);
check(
    /SUFEIYA_AI_ENABLED !== "true"/.test(superTeacherModelRuntime) &&
    /provider !== "dashscope"/.test(superTeacherModelRuntime) &&
    /allowedDashScopeModels\.has\(model\)/.test(superTeacherModelRuntime) &&
    /!apiKey\.startsWith\("sk-sp-"\)/.test(superTeacherModelRuntime) &&
    /isAllowedDashScopeEndpoint\(runtime\.endpoint, runtime\.region\)/.test(superTeacherModelRuntime) &&
    /allowedDashScopeModels[\s\S]{0,200}qwen3\.8-max/.test(superTeacherModelRuntime) &&
    !/allowedDashScopeModels[\s\S]{0,200}qwen3\.8-max-preview/.test(superTeacherModelRuntime) &&
    /evaluateTeacherModelRuntime\(runtime\)[\s\S]*!governance\.enabled/.test(superTeacherModelRuntime) &&
    /provider:\s*runtime\.provider[\s\S]*model:\s*runtime\.model[\s\S]*region:[\s\S]*dataMode:\s*TEXT_MODEL_DATA_MODE/.test(superTeacherModelRuntime) &&
    /Promise<ModelTeacherSelection \| null> \{[\s\S]*if \(!evaluateTeacherModelRuntime\(runtime\)\.enabled\) return null;[\s\S]*invokeDashScopeModel/.test(superTeacherModelRuntime),
  "model generation is context-bound and rechecks governance immediately before any provider dispatch",
);
check(
  /批准主张排序器，不是自由文本作者/.test(superTeacherResponder) &&
    /不得输出、改写、补充或推断任何自然语言主张/.test(superTeacherResponder) &&
    /fixedLimitation/.test(superTeacherResponder),
  "model prompting forbids free-form claims while the server appends the fixed product boundary",
);
check(
  /qwen3-tts-vc-realtime-2026-01-15/.test(superTeacherVoiceRelease) &&
    /const TRANSPORT_IMPLEMENTED = false/.test(superTeacherVoiceRelease) &&
    /evaluateReleaseSurface\("sofia_voice_output",\s*\{/.test(superTeacherVoiceRelease) &&
    /evaluateReleaseSurface\("sofia_microphone_input",\s*\{/.test(superTeacherVoiceRelease) &&
    /ttsEnabled: TRANSPORT_IMPLEMENTED/.test(superTeacherVoiceRelease) &&
    /microphoneEnabled: TRANSPORT_IMPLEMENTED/.test(superTeacherVoiceRelease),
  "Sofia voice is pinned to the requested model and fails closed behind governance plus a reviewed transport",
);
check(
  /private, no-store/.test(superTeacherVoiceStatusRoute) &&
    /X-Sufeiya-Voice-Mode/.test(superTeacherVoiceStatusRoute) &&
    /sofiaVoiceReleaseStatus\(\)/.test(superTeacherVoiceStatusRoute),
  "Sofia voice status is a no-store server contract that cannot expose credentials",
);
check(
  /AI 学习助手，不是 Sofia 真人实时通话/.test(superTeacherClient) &&
    /不是.*官方评分员/.test(superTeacherClient),
  "Super Teacher visibly discloses that it is neither the human teacher nor an official scorer",
);
check(/position:\s*absolute;[\s\S]*top:\s*100%;[\s\S]*100dvh/.test(styles), "mobile navigation escapes the sticky backdrop fixed-position trap");
check(/\.footer-nav a\s*\{[\s\S]*min-height:\s*44px/.test(styles), "mobile footer links meet the 44px touch target");

const resourcesData = JSON.parse(await read("data/resources.json"));
check(resourcesData.length === 16, "public resource catalog contains 16 reviewed metadata entries");
check(new Set(resourcesData.map((item) => item.id)).size === resourcesData.length, "resource catalog IDs are unique");
check(resourcesData.every((item) => /^https:\/\/(www\.)?bilibili\.com\/video\//.test(item.url)), "resource catalog links only to Bilibili video pages");
check(resourcesData.every((item) => Array.isArray(item.skills) && item.skills.length > 0), "every resource entry has at least one skill tag");

const superTeacherSources = JSON.parse(await read("data/super-teacher-source-register.json"));
check(superTeacherSources.claimSources.length === 10, "Super Teacher admits exactly 10 first-party Gate A claim sources");
check(superTeacherSources.linkOnlyResources.length === 5, "Super Teacher exposes exactly five link-only resource entries");
check(superTeacherSources.blockedFamilies.some((family) => family.id === "archive-det-official-rules" && family.recordCount === 24), "DET official index remains explicitly blocked");
check(superTeacherSources.blockedFamilies.some((family) => family.id === "archive-knowledge-base-preview" && family.recordCount === 631), "631 archive preview chunks remain explicitly blocked");

const expectedDiagnosticAudioHashes = new Map([
  ["/assets/listening-science-club.mp3", "e79ff2075d1786074433c5e044763d0a407e8a0c02a635c52a054d758b37e850"],
]);
const staticDiagnosticListeningTasks = diagnosticTasks.filter(
  (task) => task.skill === "Listening" && task.content?.audioMode === "static_asset",
);
check(staticDiagnosticListeningTasks.length === 1, "diagnostic register declares exactly one packaged Listening asset");
for (const task of staticDiagnosticListeningTasks) {
  const audioPath = task.content?.audioPath;
  const expectedHash = expectedDiagnosticAudioHashes.get(audioPath);
  const receipt = task.audioAsset;
  check(
    typeof audioPath === "string" &&
      /^\/assets\/[a-z0-9-]+\.mp3$/.test(audioPath) &&
      Boolean(expectedHash) &&
      receipt?.path === audioPath &&
      receipt?.sha256 === expectedHash &&
      receipt?.bytes === 155_942 &&
      Math.abs(Number(receipt?.durationSeconds) - 9.659955) < 0.000001 &&
      receipt?.generationOrSpeaker === "existing_project_audio_generator_not_recorded" &&
      receipt?.rightsReviewStatus === "pending",
    `diagnostic Listening asset ${String(audioPath)} has the approved pending-rights metadata receipt`,
  );
  if (typeof audioPath === "string" && expectedHash) {
    try {
      const audio = await readFile(join(root, audioPath.replace(/^\/+/, "")));
      check(audio.length === receipt?.bytes, `diagnostic Listening asset ${audioPath} matches its registered byte count`);
      check(sha256(audio) === receipt?.sha256, `diagnostic Listening asset ${audioPath} matches its registered SHA-256`);
    } catch (error) {
      failures.push(`diagnostic Listening asset ${audioPath} is missing or unreadable: ${error.message}`);
    }
  }
}
const synthesizedDiagnosticListeningTask = diagnosticTasks.find(
  (task) => task.skill === "Listening" && task.content?.audioMode === "browser_speech_synthesis",
);
check(
  synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.lang === "en-US" &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.rate === 0.92 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.pitch === 1 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.volume === 1 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.voiceSelection ===
      "prefer_local_en_us_then_en_then_device_default",
  "browser-synthesized Listening has one canonical device-voice configuration",
);

const logo = await readFile(join(root, "assets/sufeiya-logo.png"));
check(logo.toString("ascii", 1, 4) === "PNG", "HD logo is PNG");
check(logo.readUInt32BE(16) === 2792 && logo.readUInt32BE(20) === 560, "HD logo is 2792×560");
check(logo[25] === 6, "HD logo has a true alpha channel");

const mark = await readFile(join(root, "assets/sufeiya-mark.png"));
check(mark.readUInt32BE(16) === 512 && mark.readUInt32BE(20) === 512, "favicon mark is 512×512");
check(mark[25] === 6, "favicon mark has a true alpha channel");

const listeningAudio = await stat(join(root, "assets/listening-science-club.mp3"));
check(listeningAudio.size > 50_000, "packaged listening audio has a plausible production size");
const retestListeningAudio = await stat(join(root, "assets/listening-writing-center.mp3"));
check(retestListeningAudio.size > 50_000, "parallel retest listening audio has a plausible production size");
const publicJourney = await stat(join(root, "public/journey.js"));
check(publicJourney.size > 20_000, "Next.js public build includes the journey runtime");
const publicWorkspaceBackup = await stat(join(root, "public/workspace-backup.js"));
check(publicWorkspaceBackup.size > 8_000, "Next.js public build includes the workspace backup runtime");

for (const path of ["package.json", "vercel.json"]) {
  try {
    JSON.parse(await read(path));
    passes.push(`${path} is valid JSON`);
  } catch (error) {
    failures.push(`${path} is invalid JSON: ${error.message}`);
  }
}

for (const path of sitemapPublicPaths) {
  const url = `https://sufeiya.cn${path}`;
  check(sitemap.includes(`<loc>${url}</loc>`), `sitemap includes ${url}`);
}

for (const path of protectedLearnerPaths) {
  const url = `https://sufeiya.cn${path}`;
  check(!sitemap.includes(`<loc>${url}</loc>`), `sitemap excludes protected URL ${url}`);
}

check(
  /sitemapPageKeys = \["home", "learning-path", "platform", "resources", "about"\]/.test(nextSitemap) &&
    !/"workspace"|"diagnostic"|"my-data"/.test(nextSitemap),
  "Next.js sitemap contains only public legacy pages plus its explicit public Sofia entry",
);

check((notFound.match(/<h1\b/gi) || []).length === 1, "404 page has one h1");
check(!/favicon\.svg/.test(notFound), "404 page does not use the retired favicon");
check(
  /jpe\?g\|webp\|png\|gif\|svg/.test(proxyScript) && /webmanifest\|mp3/.test(proxyScript),
  "public images and audio bypass Clerk middleware",
);
check(
  /import \{ AnonymousNotFoundPage \} from "@\/components\/anonymous-legacy-page"/.test(
    notFoundRoute,
  ) &&
    /return <AnonymousNotFoundPage \/>/.test(notFoundRoute) &&
    !/LegacyPage|SiteShell|@clerk|ClerkAccountControls|SofiaAccessBoundary/.test(notFoundRoute) &&
    /import \{ FullDocumentLink \} from "@\/components\/full-document-link"/.test(
      anonymousLegacyPage,
    ) &&
    /import \{ SiteFrame \} from "@\/components\/site-frame"/.test(anonymousLegacyPage) &&
    /pageKey=\{page\.nav as NavigationKey\}/.test(anonymousLegacyPage) &&
    /Full-document links are intentional/.test(anonymousLegacyPage) &&
    /Full-document links are intentional/.test(siteFrame) &&
    /<FullDocumentLink className="auth-link" href="\/sign-in">登录<\/FullDocumentLink>/.test(
      anonymousLegacyPage,
    ) &&
    /<FullDocumentLink className="auth-link auth-link-primary" href="\/sign-up">邀请制内测<\/FullDocumentLink>/.test(
      anonymousLegacyPage,
    ) &&
    /import \{ FullDocumentLink \} from "@\/components\/full-document-link"/.test(
      siteFrame,
    ) &&
    /<FullDocumentLink[\s\S]*href=\{item\.href\}/.test(siteFrame) &&
    /<FullDocumentLink[\s\S]*href="\/workspace"/.test(siteFrame) &&
    /<FullDocumentLink[\s\S]*href="\/super-teacher"/.test(siteFrame) &&
    /<FullDocumentLink href="\/sign-in">安全登录<\/FullDocumentLink>/.test(siteFrame) &&
    /^"use client";/m.test(fullDocumentLink) &&
    /data-full-document-navigation="true"/.test(fullDocumentLink) &&
    /data-full-document-navigation-ready="false"/.test(fullDocumentLink) &&
    /setAttribute\("data-full-document-navigation-ready", "true"\)/.test(
      fullDocumentLink,
    ) &&
    /target="_top"/.test(fullDocumentLink) &&
    /onClickCapture=\{navigateOutsideTheAppRouter\}/.test(fullDocumentLink) &&
    /event\.preventDefault\(\)/.test(fullDocumentLink) &&
    /event\.stopPropagation\(\)/.test(fullDocumentLink) &&
    /window\.location\.assign\(event\.currentTarget\.href\)/.test(fullDocumentLink) &&
    !/next\/link|<Link\b/.test(`${anonymousLegacyPage}\n${siteFrame}`) &&
    !/SiteShell|@clerk|ClerkAccountControls|SofiaAccessBoundary|getClerkRuntimeState/.test(
      anonymousLegacyPage,
    ) &&
    !/@clerk|ClerkAccountControls|SofiaAccessBoundary|getClerkRuntimeState/.test(siteFrame) &&
    /Exclude<LegacyPageKey, "not-found">/.test(legacyPageComponent) &&
    !/authAware/.test(`${legacyPageComponent}\n${siteShell}`) &&
    /if \(!clerkState\.configured\) return shell/.test(siteShell),
  "404 uses a separate anonymous module graph with full-document account handoffs and no Clerk or Sofia runtime imports",
);

const faviconStats = await stat(join(root, "app/favicon.ico"));
check(faviconStats.size > 10_000 && faviconStats.size < 100_000, "multi-size favicon has a plausible production size");

const logoStats = await stat(join(root, "assets/sufeiya-logo.png"));
check(logoStats.size > 100_000 && logoStats.size < 2_000_000, "HD logo has a plausible production size");

process.stdout.write(`Verified ${passes.length} checks.\n`);
if (failures.length) {
  process.stderr.write(`FAILED (${failures.length}):\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}
process.stdout.write("PASS: Sufeiya multi-page site checks completed without errors.\n");
