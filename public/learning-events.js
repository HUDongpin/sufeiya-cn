(() => {
  "use strict";

  const CONTRACT_ID = "sufeiya.learning-event.v2";
  const SCHEMA_VERSION = 2;
  const LEDGER_PROTOCOL_VERSION = "sufeiya_learning_event_ledger_v2";
  const BINDING_PROTOCOL_VERSION = "sufeiya_learning_event_bindings_v2";
  const EXPORT_ELIGIBILITY = "local_user_backup_only_not_lrs_exportable";
  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const SUBJECT_ID_PATTERN = /^anon_([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
  const HASH_PATTERN = /^[0-9a-f]{64}$/;
  const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const MAX_CAPTURE_DELAY_MS = 5 * 60 * 1000;
  const SKILLS = new Set(["Reading", "Listening", "Writing", "Speaking"]);
  const FOCUS_SKILLS = new Set(["Balanced", ...SKILLS]);
  const EVENT_TYPES = Object.freeze([
    "learning_cycle.started",
    "recommendation.decided",
    "practice_attempt.finalized",
    "check_in.committed",
    "retest.completed",
    "learning_cycle.completed",
  ]);
  const EVENT_TYPE_SET = new Set(EVENT_TYPES);
  const RECORD_KINDS = Object.freeze([
    "cycle",
    "diagnostic",
    "plan",
    "recommendation",
    "binding",
    "practiceReceipt",
    "practiceAttempt",
    "task",
    "checkIn",
    "retest",
    "humanReviewReceipt",
    "updatedPlan",
  ]);
  const RECORD_KIND_SET = new Set(RECORD_KINDS);
  const PRACTICE_ACTIVITIES = Object.freeze({
    Reading: Object.freeze({ kind: "practice", id: "https://sufeiya.cn/activities/practice/reading-library/v1", version: "gate_a_local_v1" }),
    Listening: Object.freeze({ kind: "practice", id: "https://sufeiya.cn/activities/practice/listening-club/v1", version: "gate_a_local_v1" }),
    Writing: Object.freeze({ kind: "practice", id: "https://sufeiya.cn/activities/practice/writing-community/v1", version: "gate_a_local_v1" }),
    Speaking: Object.freeze({ kind: "practice", id: "https://sufeiya.cn/activities/practice/speaking-skill/v1", version: "gate_a_local_v1" }),
  });
  const RETEST_ACTIVITIES = Object.freeze({
    Reading: Object.freeze({ kind: "retest", id: "https://sufeiya.cn/activities/retest/reading-parallel/v1", version: "gate_a_local_v1" }),
    Listening: Object.freeze({ kind: "retest", id: "https://sufeiya.cn/activities/retest/listening-parallel/v1", version: "gate_a_local_v1" }),
    Writing: Object.freeze({ kind: "retest", id: "https://sufeiya.cn/activities/retest/writing-parallel/v1", version: "gate_a_local_v1" }),
    Speaking: Object.freeze({ kind: "retest", id: "https://sufeiya.cn/activities/retest/speaking-parallel/v1", version: "gate_a_local_v1" }),
  });
  const FIXED_ACTIVITIES = Object.freeze({
    "learning_cycle.started": Object.freeze({ kind: "learning_cycle", id: "https://sufeiya.cn/activities/learning-cycle/gate-a/v1", version: "gate_a_local_v1" }),
    "recommendation.decided": Object.freeze({ kind: "recommendation", id: "https://sufeiya.cn/activities/recommendations/gate-a/v1", version: "gate_a_local_v1" }),
    "check_in.committed": Object.freeze({ kind: "check_in", id: "https://sufeiya.cn/activities/check-in/evidence/v1", version: "gate_a_local_v1" }),
    "learning_cycle.completed": Object.freeze({ kind: "learning_cycle", id: "https://sufeiya.cn/activities/learning-cycle/gate-a/v1", version: "gate_a_local_v1" }),
  });
  const CONTEXT_RULES = Object.freeze({
    "learning_cycle.started": Object.freeze({ required: Object.freeze(["learningCycleId", "diagnosticSessionId"]), optional: Object.freeze([]) }),
    "recommendation.decided": Object.freeze({
      required: Object.freeze(["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId"]),
      optional: Object.freeze(["causationEventId"]),
    }),
    "practice_attempt.finalized": Object.freeze({
      required: Object.freeze(["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "taskId", "attemptId", "practiceReceiptId"]),
      optional: Object.freeze(["causationEventId"]),
    }),
    "check_in.committed": Object.freeze({
      required: Object.freeze(["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "taskId", "practiceReceiptId", "checkInId"]),
      optional: Object.freeze(["causationEventId"]),
    }),
    "retest.completed": Object.freeze({
      required: Object.freeze(["learningCycleId", "diagnosticSessionId", "planId", "recommendationId", "bindingId", "checkInId", "retestId", "baselinePracticeReceiptId"]),
      optional: Object.freeze(["humanReviewReceiptId", "causationEventId"]),
    }),
    "learning_cycle.completed": Object.freeze({
      required: Object.freeze(["learningCycleId", "diagnosticSessionId", "planId", "retestId", "updatedPlanId"]),
      optional: Object.freeze(["humanReviewReceiptId", "causationEventId"]),
    }),
  });
  const PRIMARY_CONTEXT_KEY = Object.freeze({
    "learning_cycle.started": "learningCycleId",
    "recommendation.decided": "recommendationId",
    "practice_attempt.finalized": "practiceReceiptId",
    "check_in.committed": "checkInId",
    "retest.completed": "retestId",
    "learning_cycle.completed": "updatedPlanId",
  });
  const EVENT_KEYS = Object.freeze([
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
  ]);

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const exactKeys = (value, keys) =>
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  const isExactUtc = (value) =>
    typeof value === "string" && ISO_UTC_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const createUuid = () => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  };
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  };
  const canonicalJson = (value) => JSON.stringify(canonicalize(value));
  const sha256Hex = async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  const hashEvent = async (eventWithoutHash) => sha256Hex(canonicalJson(eventWithoutHash));
  const safeDomainId = (value) => typeof value === "string" && value.length >= 3 && value.length <= 240 && !/[\u0000-\u001f\u007f]/.test(value);
  const allRecordAliases = (bindings) =>
    RECORD_KINDS.flatMap((kind) => Object.values(bindings.records[kind] || {}));

  const createBindings = (recordedAt) => ({
    protocolVersion: BINDING_PROTOCOL_VERSION,
    subjectId: `anon_${createUuid()}`,
    subjectType: "anonymous_installation",
    assignmentBoundary: "local_runtime_csprng",
    createdAt: recordedAt,
    records: Object.fromEntries(RECORD_KINDS.map((kind) => [kind, {}])),
  });

  const bindingShapeValid = (bindings) => {
    if (!exactKeys(bindings, ["protocolVersion", "subjectId", "subjectType", "assignmentBoundary", "createdAt", "records"])) return false;
    if (
      bindings.protocolVersion !== BINDING_PROTOCOL_VERSION ||
      bindings.subjectType !== "anonymous_installation" ||
      bindings.assignmentBoundary !== "local_runtime_csprng" ||
      !SUBJECT_ID_PATTERN.test(bindings.subjectId || "") ||
      !isExactUtc(bindings.createdAt) ||
      !exactKeys(bindings.records, RECORD_KINDS)
    ) return false;
    const aliases = [];
    for (const kind of RECORD_KINDS) {
      const records = bindings.records[kind];
      if (!isRecord(records)) return false;
      for (const [domainId, alias] of Object.entries(records)) {
        if (!safeDomainId(domainId) || !UUID_V4_PATTERN.test(alias || "")) return false;
        aliases.push(alias);
      }
    }
    return aliases.length === new Set(aliases).size && !aliases.includes(bindings.subjectId.replace(/^anon_/, ""));
  };

  const bindDomainId = (bindings, kind, domainId, { allowCreate = true } = {}) => {
    if (!RECORD_KIND_SET.has(kind) || !safeDomainId(domainId)) throw new Error("invalid_domain_binding");
    const existing = bindings.records[kind][domainId];
    if (existing) return existing;
    if (!allowCreate) throw new Error("domain_binding_missing");
    const alias = createUuid();
    if (new Set(allRecordAliases(bindings)).has(alias)) throw new Error("alias_collision");
    bindings.records[kind][domainId] = alias;
    return alias;
  };

  const fixedPrivacy = () => ({
    classification: "pseudonymous_local_learning_metadata",
    containsDirectIdentifier: false,
    containsAccountIdentifier: false,
    containsClerkIdentifier: false,
    containsFreeText: false,
    containsRawResponse: false,
    containsAudio: false,
    containsSofiaContent: false,
  });
  const fixedGovernance = () => ({
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
    exportEligibility: EXPORT_ELIGIBILITY,
  });
  const activityFor = (eventType, skill = null) => {
    if (eventType === "practice_attempt.finalized") {
      return PRACTICE_ACTIVITIES[skill] ? { ...PRACTICE_ACTIVITIES[skill] } : null;
    }
    if (eventType === "retest.completed") {
      return RETEST_ACTIVITIES[skill] ? { ...RETEST_ACTIVITIES[skill] } : null;
    }
    return FIXED_ACTIVITIES[eventType] ? { ...FIXED_ACTIVITIES[eventType] } : null;
  };

  const claimsAreFalse = (attributes, { includeGrowth = false } = {}) => Boolean(
    attributes.automatedScoreProduced === false &&
    attributes.formalDiagnosisProduced === false &&
    attributes.officialEquivalenceClaimed === false &&
    (!includeGrowth || attributes.growthClaimed === false)
  );
  const attributesValid = (eventType, attributes) => {
    if (!isRecord(attributes)) return false;
    if (eventType === "learning_cycle.started") {
      return Boolean(
        exactKeys(attributes, ["outcome", "taskSetVersion", "taskSetDigest"]) &&
        attributes.outcome === "started" &&
        attributes.taskSetVersion === "gate_a_original_6_v1" &&
        attributes.taskSetDigest === "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c"
      );
    }
    if (eventType === "recommendation.decided") {
      return Boolean(
        exactKeys(attributes, ["decision", "bindingReviewStatus"]) &&
        ["accepted", "skipped"].includes(attributes.decision) &&
        attributes.bindingReviewStatus === "gate_a_unreviewed"
      );
    }
    if (eventType === "practice_attempt.finalized") {
      const baseKeys = [
        "outcome",
        "skill",
        "evidenceType",
        "evidenceStatus",
        "automatedScoreProduced",
        "formalDiagnosisProduced",
        "officialEquivalenceClaimed",
      ];
      const skillKeys = ["Reading", "Listening"].includes(attributes.skill) ? ["attemptCount"]
        : attributes.skill === "Writing" ? ["wordCount", "selfCheckCount"]
          : attributes.skill === "Speaking" ? ["selfCheckCount"] : [];
      if (!exactKeys(attributes, [...baseKeys, ...skillKeys])) return false;
      if (!SKILLS.has(attributes.skill) || !claimsAreFalse(attributes)) return false;
      if (["Reading", "Listening"].includes(attributes.skill)) {
        if (!Number.isInteger(attributes.attemptCount) || attributes.attemptCount < 1 || attributes.attemptCount > 1000) return false;
        if (attributes.evidenceStatus === "evidence_limited") {
          return attributes.outcome === "matched" && attributes.evidenceType === "single_task_correct";
        }
        return attributes.skill === "Listening" &&
          attributes.evidenceStatus === "evidence_insufficient" &&
          attributes.outcome === "needs_retry" &&
          attributes.evidenceType === "single_task_needs_retry";
      }
      if (
        attributes.outcome !== "self_review_completed" ||
        attributes.evidenceType !== "task_completed_no_score" ||
        attributes.evidenceStatus !== "evidence_limited"
      ) return false;
      if (attributes.skill === "Writing") {
        return Number.isInteger(attributes.wordCount) && attributes.wordCount >= 20 && attributes.wordCount <= 100000 && attributes.selfCheckCount === 3;
      }
      return attributes.selfCheckCount === 3;
    }
    if (eventType === "check_in.committed") {
      return Boolean(
        exactKeys(attributes, ["outcome", "evidenceClass", "evidenceStatus", "questionStatus"]) &&
        attributes.outcome === "committed" &&
        attributes.evidenceClass === "practice_receipt" &&
        attributes.evidenceStatus === "evidence_limited" &&
        ["has_question", "none"].includes(attributes.questionStatus)
      );
    }
    if (eventType === "retest.completed") {
      if (!exactKeys(attributes, [
        "outcome",
        "skill",
        "evidenceType",
        "evidenceSufficiency",
        "comparabilityClass",
        "humanConfirmationStatus",
        "automatedScoreProduced",
        "formalDiagnosisProduced",
        "growthClaimed",
        "officialEquivalenceClaimed",
      ])) return false;
      if (
        attributes.outcome !== "completed" ||
        !SKILLS.has(attributes.skill) ||
        attributes.comparabilityClass !== "same_skill_unreviewed_construct" ||
        !claimsAreFalse(attributes, { includeGrowth: true })
      ) return false;
      const humanStatus = attributes.humanConfirmationStatus;
      const humanPendingOrComplete = ["required_not_completed", "completed"].includes(humanStatus);
      if (["Writing", "Speaking"].includes(attributes.skill)) {
        return attributes.evidenceType === "task_completed_no_score" &&
          attributes.evidenceSufficiency === "limited_unreviewed_same_skill_task" &&
          humanPendingOrComplete;
      }
      if (attributes.evidenceSufficiency === "insufficient_audio_conditions") {
        return attributes.skill === "Listening" &&
          ["single_task_correct", "single_task_needs_review"].includes(attributes.evidenceType) &&
          humanPendingOrComplete;
      }
      if (attributes.evidenceSufficiency !== "limited_unreviewed_same_skill_task") return false;
      if (attributes.evidenceType === "single_task_correct") return humanStatus === "not_required_for_gate_a_flow";
      return attributes.evidenceType === "single_task_needs_review" && humanPendingOrComplete;
    }
    if (eventType === "learning_cycle.completed") {
      return Boolean(
        exactKeys(attributes, [
          "outcome",
          "nextFocusSkill",
          "humanConfirmationStatus",
          "automatedScoreProduced",
          "formalDiagnosisProduced",
          "growthClaimed",
          "officialEquivalenceClaimed",
        ]) &&
        attributes.outcome === "completed" &&
        FOCUS_SKILLS.has(attributes.nextFocusSkill) &&
        ["not_required_for_gate_a_flow", "completed"].includes(attributes.humanConfirmationStatus) &&
        claimsAreFalse(attributes, { includeGrowth: true })
      );
    }
    return false;
  };

  const activityValid = (event) => {
    const expected = activityFor(event.eventType, event.attributes?.skill || null);
    if (!expected || !exactKeys(event.activity, Object.keys(expected))) return false;
    return Object.entries(expected).every(([key, value]) => event.activity[key] === value);
  };
  const contextValid = (eventType, context) => {
    const rules = CONTEXT_RULES[eventType];
    if (!rules || !isRecord(context)) return false;
    const allowed = [...rules.required, ...rules.optional];
    const actualKeys = Object.keys(context);
    if (
      !actualKeys.length ||
      actualKeys.some((key) => !allowed.includes(key)) ||
      !rules.required.every((key) => actualKeys.includes(key))
    ) return false;
    if (!actualKeys.every((key) => UUID_V4_PATTERN.test(context[key] || ""))) return false;
    if (actualKeys.length !== new Set(Object.values(context)).size) return false;
    return true;
  };
  const privacyValid = (privacy) =>
    exactKeys(privacy, [
      "classification",
      "containsDirectIdentifier",
      "containsAccountIdentifier",
      "containsClerkIdentifier",
      "containsFreeText",
      "containsRawResponse",
      "containsAudio",
      "containsSofiaContent",
    ]) &&
    privacy.classification === "pseudonymous_local_learning_metadata" &&
    privacy.containsDirectIdentifier === false &&
    privacy.containsAccountIdentifier === false &&
    privacy.containsClerkIdentifier === false &&
    privacy.containsFreeText === false &&
    privacy.containsRawResponse === false &&
    privacy.containsAudio === false &&
    privacy.containsSofiaContent === false;
  const governanceValid = (governance) =>
    exactKeys(governance, [
      "captureMode",
      "historicalBackfillAllowed",
      "storageScope",
      "appendPolicy",
      "integrityAssurance",
      "corruptionPolicy",
      "networkDispatch",
      "lrsDispatch",
      "xapiDispatch",
      "sofiaAccess",
      "exportEligibility",
    ]) &&
    governance.captureMode === "forward_only_no_backfill" &&
    governance.historicalBackfillAllowed === false &&
    governance.storageScope === "browser_local_only" &&
    governance.appendPolicy === "application_append_only" &&
    governance.integrityAssurance === "local_hash_chain_not_tamper_proof" &&
    governance.corruptionPolicy === "fail_closed" &&
    governance.networkDispatch === "disabled" &&
    governance.lrsDispatch === "disabled" &&
    governance.xapiDispatch === "disabled" &&
    governance.sofiaAccess === "forbidden" &&
    governance.exportEligibility === EXPORT_ELIGIBILITY;
  const timestampsValid = (occurredAt, recordedAt) => {
    if (!isExactUtc(occurredAt) || !isExactUtc(recordedAt)) return false;
    const captureDelay = Date.parse(recordedAt) - Date.parse(occurredAt);
    return captureDelay >= 0 && captureDelay <= MAX_CAPTURE_DELAY_MS;
  };
  const humanReviewGuardValid = (event) => {
    if (!["retest.completed", "learning_cycle.completed"].includes(event.eventType)) return true;
    const hasHumanReviewReceipt = Object.prototype.hasOwnProperty.call(event.context, "humanReviewReceiptId");
    return event.attributes.humanConfirmationStatus === "completed"
      ? hasHumanReviewReceipt
      : !hasHumanReviewReceipt;
  };

  const eventShapeValid = (event) => Boolean(
    exactKeys(event, EVENT_KEYS) &&
    event.contractId === CONTRACT_ID &&
    event.schemaVersion === SCHEMA_VERSION &&
    UUID_V4_PATTERN.test(event.eventId || "") &&
    UUID_V4_PATTERN.test(event.idempotencyKey || "") &&
    event.idempotencyKey !== event.eventId &&
    EVENT_TYPE_SET.has(event.eventType) &&
    Number.isInteger(event.sequence) &&
    event.sequence >= 1 &&
    timestampsValid(event.occurredAt, event.recordedAt) &&
    exactKeys(event.subject, ["subjectId", "subjectType", "identityAssurance", "assignedBy"]) &&
    SUBJECT_ID_PATTERN.test(event.subject.subjectId || "") &&
    event.subject.subjectType === "anonymous_installation" &&
    event.subject.identityAssurance === "local_random_alias" &&
    event.subject.assignedBy === "local_runtime_csprng" &&
    contextValid(event.eventType, event.context) &&
    activityValid(event) &&
    attributesValid(event.eventType, event.attributes) &&
    humanReviewGuardValid(event) &&
    privacyValid(event.privacy) &&
    governanceValid(event.governance) &&
    (event.previousEventHash === null || HASH_PATTERN.test(event.previousEventHash || "")) &&
    HASH_PATTERN.test(event.eventHash || "") &&
    JSON.stringify(event).length <= 8192
  );

  const ALLOWED_SAME_CYCLE_TRANSITIONS = Object.freeze({
    "learning_cycle.started": Object.freeze(["recommendation.decided"]),
    "recommendation.decided": Object.freeze(["practice_attempt.finalized"]),
    "practice_attempt.finalized": Object.freeze(["practice_attempt.finalized", "check_in.committed"]),
    "check_in.committed": Object.freeze(["retest.completed"]),
    "retest.completed": Object.freeze(["learning_cycle.completed"]),
    "learning_cycle.completed": Object.freeze([]),
  });
  const REQUIRED_TRANSITION_CONTEXT = Object.freeze({
    "learning_cycle.started->recommendation.decided": Object.freeze(["diagnosticSessionId"]),
    "recommendation.decided->practice_attempt.finalized": Object.freeze([
      "diagnosticSessionId",
      "planId",
      "recommendationId",
      "bindingId",
    ]),
    "practice_attempt.finalized->practice_attempt.finalized": Object.freeze([
      "diagnosticSessionId",
      "planId",
      "recommendationId",
      "bindingId",
      "taskId",
    ]),
    "practice_attempt.finalized->check_in.committed": Object.freeze([
      "diagnosticSessionId",
      "planId",
      "recommendationId",
      "bindingId",
      "taskId",
      "practiceReceiptId",
    ]),
    "check_in.committed->retest.completed": Object.freeze([
      "diagnosticSessionId",
      "planId",
      "recommendationId",
      "bindingId",
      "checkInId",
    ]),
    "retest.completed->learning_cycle.completed": Object.freeze([
      "diagnosticSessionId",
      "planId",
      "retestId",
    ]),
  });
  const REQUIRED_TRANSITION_ALIAS_LINKS = Object.freeze({
    "check_in.committed->retest.completed": Object.freeze([
      Object.freeze(["practiceReceiptId", "baselinePracticeReceiptId"]),
    ]),
  });
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const transitionContextValid = (cause, eventType, context) => {
    const transitionKey = `${cause.eventType}->${eventType}`;
    const requiredKeys = REQUIRED_TRANSITION_CONTEXT[transitionKey];
    if (!requiredKeys) return false;
    const repeatPractice = cause.eventType === "practice_attempt.finalized" && eventType === "practice_attempt.finalized";
    const changingEventLocalKeys = repeatPractice ? new Set(["attemptId", "practiceReceiptId"]) : new Set();
    const overlappingKeys = Object.keys(cause.context).filter((key) =>
      key !== "causationEventId" &&
      !changingEventLocalKeys.has(key) &&
      hasOwn(context, key)
    );
    if (overlappingKeys.some((key) => cause.context[key] !== context[key])) return false;
    if (requiredKeys.some((key) => !hasOwn(cause.context, key) || cause.context[key] !== context[key])) return false;
    const aliasLinks = REQUIRED_TRANSITION_ALIAS_LINKS[transitionKey] || [];
    if (aliasLinks.some(([causeKey, nextKey]) => !hasOwn(cause.context, causeKey) || cause.context[causeKey] !== context[nextKey])) return false;
    if (
      repeatPractice &&
      (cause.context.attemptId === context.attemptId || cause.context.practiceReceiptId === context.practiceReceiptId)
    ) return false;
    return true;
  };
  const sameCycleTransitionValid = (events, eventType, context, attributes = null) => {
    const sameCycleEvents = events.filter((event) => event.context?.learningCycleId === context.learningCycleId);
    const hasCausation = hasOwn(context, "causationEventId");
    if (!sameCycleEvents.length) {
      return hasCausation
        ? { ok: false, code: "causation_event_invalid" }
        : { ok: true, cause: null };
    }
    if (
      eventType !== "practice_attempt.finalized" &&
      sameCycleEvents.some((event) => event.eventType === eventType)
    ) return { ok: false, code: "event_cardinality_invalid" };
    const cause = sameCycleEvents.at(-1);
    if (!ALLOWED_SAME_CYCLE_TRANSITIONS[cause.eventType]?.includes(eventType)) {
      return { ok: false, code: "event_transition_invalid" };
    }
    if (!transitionContextValid(cause, eventType, context)) {
      return { ok: false, code: "context_continuity_invalid" };
    }
    if (
      cause.eventType === "retest.completed" &&
      eventType === "learning_cycle.completed" &&
      cause.attributes.humanConfirmationStatus !== attributes?.humanConfirmationStatus
    ) return { ok: false, code: "human_confirmation_transition_invalid" };
    if (eventType === "retest.completed") {
      const baselinePractice = [...sameCycleEvents].reverse().find((event) =>
        event.eventType === "practice_attempt.finalized" &&
        event.context.practiceReceiptId === context.baselinePracticeReceiptId
      );
      if (baselinePractice && baselinePractice.attributes.skill !== attributes?.skill) {
        return { ok: false, code: "retest_skill_continuity_invalid" };
      }
    }
    if (hasCausation && context.causationEventId !== cause.eventId) {
      return { ok: false, code: "causation_event_invalid" };
    }
    return { ok: true, cause };
  };
  const ledgerSemanticsValid = (events) => {
    const acceptedEvents = [];
    const semanticIdentities = new Set();
    for (const event of events) {
      const primaryKey = PRIMARY_CONTEXT_KEY[event.eventType];
      const semanticIdentity = `${event.eventType}:${event.context[primaryKey]}`;
      if (semanticIdentities.has(semanticIdentity)) return { ok: false, code: "event_identity_duplicate" };
      const transition = sameCycleTransitionValid(acceptedEvents, event.eventType, event.context, event.attributes);
      if (!transition.ok) return transition;
      if (transition.cause && event.context.causationEventId !== transition.cause.eventId) {
        return { ok: false, code: "causation_event_missing" };
      }
      semanticIdentities.add(semanticIdentity);
      acceptedEvents.push(event);
    }
    return { ok: true };
  };

  const ledgerShapeValid = (state) => {
    if (!isRecord(state)) return false;
    const events = state.learningEvents;
    const bindings = state.learningEventBindings;
    if (events === undefined && bindings === undefined) return true;
    if (!Array.isArray(events)) return false;
    if (events.length === 0) return bindings === null || bindings === undefined || bindingShapeValid(bindings);
    if (!bindingShapeValid(bindings)) return false;
    const boundAliases = new Set(allRecordAliases(bindings));
    const eventIds = new Set();
    const idempotencyKeys = new Set();
    for (const event of events) {
      if (
        !eventShapeValid(event) ||
        eventIds.has(event.eventId) ||
        idempotencyKeys.has(event.idempotencyKey)
      ) return false;
      if (event.subject.subjectId !== bindings.subjectId) return false;
      for (const [key, alias] of Object.entries(event.context)) {
        if (key === "causationEventId") {
          if (!eventIds.has(alias)) return false;
        } else if (!boundAliases.has(alias)) {
          return false;
        }
      }
      if (Object.values(event.context).includes(bindings.subjectId.replace(/^anon_/, ""))) return false;
      eventIds.add(event.eventId);
      idempotencyKeys.add(event.idempotencyKey);
    }
    return true;
  };

  const validateLedger = async (state) => {
    if (!ledgerShapeValid(state)) return { ok: false, code: "ledger_shape_invalid" };
    const events = Array.isArray(state.learningEvents) ? state.learningEvents : [];
    let previousEventHash = null;
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (event.sequence !== index + 1 || event.previousEventHash !== previousEventHash) {
        return { ok: false, code: "ledger_sequence_invalid", index };
      }
      const withoutHash = { ...event };
      delete withoutHash.eventHash;
      const expectedHash = await hashEvent(withoutHash);
      if (event.eventHash !== expectedHash) return { ok: false, code: "ledger_hash_invalid", index };
      previousEventHash = event.eventHash;
    }
    const semanticStatus = ledgerSemanticsValid(events);
    if (!semanticStatus.ok) return { ok: false, code: semanticStatus.code };
    return { ok: true, code: "ledger_valid", eventCount: events.length, headHash: previousEventHash };
  };

  const addContext = (bindings, context, aliasKey, kind, domainId, options) => {
    if (domainId === null || domainId === undefined) return;
    context[aliasKey] = bindDomainId(bindings, kind, domainId, options);
  };
  const assertIso = (value) => {
    if (!isExactUtc(value)) throw new Error("invalid_domain_timestamp");
    return value;
  };
  const assertSkill = (value) => {
    if (!SKILLS.has(value)) throw new Error("invalid_domain_skill");
    return value;
  };

  const projectDomainEvent = (bindings, eventType, domain, { allowNewBindings = true } = {}) => {
    if (!EVENT_TYPE_SET.has(eventType) || !isRecord(domain)) throw new Error("invalid_domain_event");
    const context = {};
    const bindingOptions = { allowCreate: allowNewBindings };
    if (eventType === "learning_cycle.started") {
      const { cycle, diagnostic } = domain;
      if (
        !isRecord(cycle) ||
        !isRecord(diagnostic) ||
        cycle.protocolVersion !== "gate_a_local_v1" ||
        cycle.status !== "in_progress" ||
        diagnostic.protocolVersion !== "gate_a_local_v1" ||
        diagnostic.status !== "in_progress" ||
        diagnostic.cycleId !== cycle.cycleId ||
        diagnostic.diagnosticSessionId !== cycle.diagnosticSessionId ||
        diagnostic.taskSetVersion !== "gate_a_original_6_v1" ||
        diagnostic.taskSetDigest !== "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c"
      ) throw new Error("invalid_cycle_start_domain");
      addContext(bindings, context, "learningCycleId", "cycle", cycle.cycleId, bindingOptions);
      addContext(bindings, context, "diagnosticSessionId", "diagnostic", cycle.diagnosticSessionId, bindingOptions);
      return {
        context,
        attributes: {
          outcome: "started",
          taskSetVersion: diagnostic.taskSetVersion,
          taskSetDigest: diagnostic.taskSetDigest,
        },
        activity: activityFor(eventType),
        occurredAt: assertIso(cycle.createdAt),
      };
    }
    if (eventType === "recommendation.decided") {
      const record = domain.recommendation;
      if (
        !isRecord(record) ||
        !["accepted", "skipped"].includes(record.status) ||
        !isRecord(record.evidenceBinding) ||
        record.evidenceBinding.cycleId !== record.cycleId ||
        record.evidenceBinding.diagnosticSessionId !== record.diagnosticSessionId ||
        record.evidenceBinding.practiceTaskId !== record.primary?.taskId ||
        record.evidenceBinding.reviewStatus !== "gate_a_unreviewed" ||
        record.evidenceBinding.teacherReviewed !== false ||
        record.evidenceBinding.measurementReviewed !== false
      ) throw new Error("invalid_recommendation_domain");
      assertSkill(record.primary?.skill);
      addContext(bindings, context, "learningCycleId", "cycle", record.cycleId, bindingOptions);
      addContext(bindings, context, "diagnosticSessionId", "diagnostic", record.diagnosticSessionId, bindingOptions);
      addContext(bindings, context, "planId", "plan", record.planId, bindingOptions);
      addContext(bindings, context, "recommendationId", "recommendation", record.recommendationId, bindingOptions);
      addContext(bindings, context, "bindingId", "binding", record.evidenceBinding.bindingId, bindingOptions);
      return {
        context,
        attributes: { decision: record.status, bindingReviewStatus: "gate_a_unreviewed" },
        activity: activityFor(eventType),
        occurredAt: assertIso(record.createdAt),
      };
    }
    if (eventType === "practice_attempt.finalized") {
      const receipt = domain.receipt;
      const recommendation = domain.recommendation;
      const skill = assertSkill(receipt?.skill);
      const expectedActivity = PRACTICE_ACTIVITIES[skill];
      if (
        !isRecord(receipt) ||
        !isRecord(recommendation) ||
        !isRecord(recommendation.evidenceBinding) ||
        receipt.protocolVersion !== "sufeiya_practice_receipt_v2" ||
        receipt.sealed !== true ||
        receipt.status !== "completed" ||
        !UUID_V4_PATTERN.test(receipt.completionReceiptId || "") ||
        !UUID_V4_PATTERN.test(receipt.practiceAttemptId || "") ||
        receipt.activityId !== expectedActivity.id ||
        receipt.activityVersion !== "v1" ||
        !["evidence_limited", "evidence_insufficient"].includes(receipt.evidenceStatus) ||
        !isRecord(receipt.evidence) ||
        !receipt.cycleId ||
        !receipt.diagnosticSessionId ||
        !receipt.planId ||
        !receipt.recommendationId ||
        !receipt.taskId ||
        recommendation.recommendationId !== receipt.recommendationId ||
        recommendation.cycleId !== receipt.cycleId ||
        recommendation.diagnosticSessionId !== receipt.diagnosticSessionId ||
        recommendation.planId !== receipt.planId ||
        recommendation.primary?.skill !== skill ||
        (
          recommendation.status === "accepted"
            ? recommendation.evidenceBinding.practiceTaskId !== receipt.taskId || recommendation.primary?.taskId !== receipt.taskId
            : recommendation.status !== "skipped" ||
              recommendation.evidenceBinding.practiceTaskId !== recommendation.primary?.taskId ||
              recommendation.primary?.taskId === receipt.taskId
        )
      ) throw new Error("invalid_practice_domain");
      addContext(bindings, context, "learningCycleId", "cycle", receipt.cycleId, bindingOptions);
      addContext(bindings, context, "diagnosticSessionId", "diagnostic", receipt.diagnosticSessionId, bindingOptions);
      addContext(bindings, context, "planId", "plan", receipt.planId, bindingOptions);
      addContext(bindings, context, "recommendationId", "recommendation", receipt.recommendationId, bindingOptions);
      addContext(bindings, context, "bindingId", "binding", recommendation.evidenceBinding.bindingId, bindingOptions);
      addContext(bindings, context, "taskId", "task", receipt.taskId, bindingOptions);
      addContext(bindings, context, "attemptId", "practiceAttempt", receipt.practiceAttemptId, bindingOptions);
      addContext(bindings, context, "practiceReceiptId", "practiceReceipt", receipt.completionReceiptId, bindingOptions);
      const objective = ["Reading", "Listening"].includes(skill);
      const attributes = {
        outcome: objective
          ? (receipt.evidenceStatus === "evidence_limited" ? "matched" : "needs_retry")
          : "self_review_completed",
        skill,
        evidenceType: objective
          ? (receipt.evidenceStatus === "evidence_limited" ? "single_task_correct" : "single_task_needs_retry")
          : "task_completed_no_score",
        evidenceStatus: receipt.evidenceStatus,
        automatedScoreProduced: false,
        formalDiagnosisProduced: false,
        officialEquivalenceClaimed: false,
      };
      if (objective) attributes.attemptCount = receipt.evidence.attemptCount;
      if (skill === "Writing") {
        attributes.wordCount = receipt.evidence.wordCount;
        attributes.selfCheckCount = receipt.evidence.selfCheckCount;
      }
      if (skill === "Speaking") attributes.selfCheckCount = receipt.evidence.selfCheckCount;
      return { context, attributes, activity: activityFor(eventType, skill), occurredAt: assertIso(receipt.completedAt) };
    }
    if (eventType === "check_in.committed") {
      const record = domain.checkIn;
      const recommendation = domain.recommendation;
      if (
        !isRecord(record) ||
        !isRecord(recommendation) ||
        !isRecord(recommendation.evidenceBinding) ||
        record.status !== "saved" ||
        record.evidenceClass !== "practice_receipt" ||
        record.practiceReceipt?.protocolVersion !== "sufeiya_practice_receipt_v2" ||
        record.practiceReceipt?.sealed !== true ||
        record.practiceReceipt?.status !== "completed" ||
        record.practiceReceipt?.evidenceStatus !== "evidence_limited" ||
        !["has_question", "none"].includes(record.questionStatus) ||
        recommendation.recommendationId !== record.recommendationId ||
        recommendation.cycleId !== record.cycleId ||
        recommendation.diagnosticSessionId !== record.diagnosticSessionId ||
        recommendation.planId !== record.planId ||
        !record.linkedTaskId ||
        !record.taskCompletionReceiptId ||
        recommendation.primary?.skill !== record.practiceReceipt?.skill ||
        recommendation.evidenceBinding.practiceTaskId !== recommendation.primary?.taskId ||
        record.practiceReceipt?.cycleId !== record.cycleId ||
        record.practiceReceipt?.diagnosticSessionId !== record.diagnosticSessionId ||
        record.practiceReceipt?.planId !== record.planId ||
        record.practiceReceipt?.recommendationId !== record.recommendationId ||
        record.practiceReceipt?.taskId !== record.linkedTaskId ||
        record.practiceReceipt?.completionReceiptId !== record.taskCompletionReceiptId ||
        (
          recommendation.status === "accepted"
            ? record.linkedTaskId !== recommendation.primary?.taskId
            : recommendation.status !== "skipped" || record.linkedTaskId === recommendation.primary?.taskId
        )
      ) throw new Error("invalid_check_in_domain");
      addContext(bindings, context, "learningCycleId", "cycle", record.cycleId, bindingOptions);
      addContext(bindings, context, "diagnosticSessionId", "diagnostic", record.diagnosticSessionId, bindingOptions);
      addContext(bindings, context, "planId", "plan", record.planId, bindingOptions);
      addContext(bindings, context, "recommendationId", "recommendation", record.recommendationId, bindingOptions);
      addContext(bindings, context, "bindingId", "binding", recommendation.evidenceBinding.bindingId, bindingOptions);
      addContext(bindings, context, "taskId", "task", record.linkedTaskId, bindingOptions);
      addContext(bindings, context, "practiceReceiptId", "practiceReceipt", record.taskCompletionReceiptId, bindingOptions);
      addContext(bindings, context, "checkInId", "checkIn", record.checkInId, bindingOptions);
      return {
        context,
        attributes: {
          outcome: "committed",
          evidenceClass: "practice_receipt",
          evidenceStatus: "evidence_limited",
          questionStatus: record.questionStatus,
        },
        activity: activityFor(eventType),
        occurredAt: assertIso(record.savedAt),
      };
    }
    if (eventType === "retest.completed") {
      const record = domain.retest;
      const recommendation = domain.recommendation;
      const skill = assertSkill(record?.skill);
      if (
        !isRecord(record) ||
        !isRecord(recommendation) ||
        !isRecord(recommendation.evidenceBinding) ||
        record.status !== "completed" ||
        record.parallelRetest !== true ||
        record.automatedScoreProduced !== false ||
        record.growthClaimProduced !== false ||
        recommendation.recommendationId !== record.recommendationId ||
        recommendation.cycleId !== record.cycleId ||
        recommendation.diagnosticSessionId !== record.diagnosticSessionId ||
        recommendation.planId !== record.planId ||
        recommendation.primary?.skill !== skill ||
        !record.checkInId ||
        !record.baselinePracticeReceiptId ||
        record.comparability?.constructAlignment !== "same_skill_unreviewed_construct" ||
        record.comparability?.officialEquivalenceClaimed !== false
      ) throw new Error("invalid_retest_domain");
      addContext(bindings, context, "learningCycleId", "cycle", record.cycleId, bindingOptions);
      addContext(bindings, context, "diagnosticSessionId", "diagnostic", record.diagnosticSessionId, bindingOptions);
      addContext(bindings, context, "planId", "plan", record.planId, bindingOptions);
      addContext(bindings, context, "recommendationId", "recommendation", record.recommendationId, bindingOptions);
      addContext(bindings, context, "bindingId", "binding", recommendation.evidenceBinding.bindingId, bindingOptions);
      addContext(bindings, context, "checkInId", "checkIn", record.checkInId, bindingOptions);
      addContext(bindings, context, "retestId", "retest", record.retestId, bindingOptions);
      addContext(bindings, context, "baselinePracticeReceiptId", "practiceReceipt", record.baselinePracticeReceiptId, bindingOptions);
      if (record.humanConfirmationStatus === "completed") {
        addContext(bindings, context, "humanReviewReceiptId", "humanReviewReceipt", domain.humanReviewReceiptId, bindingOptions);
      }
      return {
        context,
        attributes: {
          outcome: "completed",
          skill,
          evidenceType: record.evidence?.resultType,
          evidenceSufficiency: record.evidenceSufficiency,
          comparabilityClass: record.comparability.constructAlignment,
          humanConfirmationStatus: record.humanConfirmationStatus,
          automatedScoreProduced: false,
          formalDiagnosisProduced: false,
          growthClaimed: false,
          officialEquivalenceClaimed: false,
        },
        activity: activityFor(eventType, skill),
        occurredAt: assertIso(record.completedAt),
      };
    }
    const { cycle, retest, planUpdate } = domain;
    if (
      !isRecord(cycle) ||
      !isRecord(retest) ||
      !isRecord(planUpdate) ||
      cycle.status !== "completed" ||
      cycle.cycleId !== retest.cycleId ||
      cycle.diagnosticSessionId !== retest.diagnosticSessionId ||
      cycle.retestId !== retest.retestId ||
      cycle.updatedPlanId !== planUpdate.updatedPlanId ||
      planUpdate.cycleId !== cycle.cycleId ||
      planUpdate.retestId !== retest.retestId ||
      planUpdate.supersedesPlanId !== retest.planId ||
      planUpdate.learnerConfirmed !== true ||
      planUpdate.confirmationClass !== "learner_confirmed_gate_a" ||
      planUpdate.humanConfirmationStatus !== retest.humanConfirmationStatus ||
      planUpdate.automatedAbilityDecision !== false ||
      !["not_required_for_gate_a_flow", "completed"].includes(planUpdate.humanConfirmationStatus) ||
      !FOCUS_SKILLS.has(planUpdate.focusSkill)
    ) throw new Error("invalid_cycle_completion_domain");
    addContext(bindings, context, "learningCycleId", "cycle", cycle.cycleId, bindingOptions);
    addContext(bindings, context, "diagnosticSessionId", "diagnostic", cycle.diagnosticSessionId, bindingOptions);
    addContext(bindings, context, "planId", "plan", planUpdate.supersedesPlanId, bindingOptions);
    addContext(bindings, context, "retestId", "retest", retest.retestId, bindingOptions);
    addContext(bindings, context, "updatedPlanId", "updatedPlan", planUpdate.updatedPlanId, bindingOptions);
    if (planUpdate.humanConfirmationStatus === "completed") {
      addContext(bindings, context, "humanReviewReceiptId", "humanReviewReceipt", domain.humanReviewReceiptId, bindingOptions);
    }
    return {
      context,
      attributes: {
        outcome: "completed",
        nextFocusSkill: planUpdate.focusSkill,
        humanConfirmationStatus: planUpdate.humanConfirmationStatus,
        automatedScoreProduced: false,
        formalDiagnosisProduced: false,
        growthClaimed: false,
        officialEquivalenceClaimed: false,
      },
      activity: activityFor(eventType),
      occurredAt: assertIso(cycle.closedAt),
    };
  };

  const appendDomainEvent = async (state, eventType, domain) => {
    const ledgerStatus = await validateLedger(state);
    if (!ledgerStatus.ok) return { status: "ledger_invalid", code: ledgerStatus.code };
    const eventLimit = globalThis.SufeiyaWorkspaceBackup?.CAPACITY_LIMITS?.learningEvents;
    if (!Number.isInteger(eventLimit) || eventLimit < 1) {
      return { status: "ledger_invalid", code: "capacity_runtime_unavailable" };
    }
    const events = Array.isArray(state.learningEvents) ? clone(state.learningEvents) : [];
    if (events.length > eventLimit) {
      return { status: "ledger_invalid", code: "learning_events_capacity_exceeded" };
    }
    const primaryDomainReference = (() => {
      if (eventType === "learning_cycle.started") return { kind: "cycle", domainId: domain?.cycle?.cycleId };
      if (eventType === "recommendation.decided") return { kind: "recommendation", domainId: domain?.recommendation?.recommendationId };
      if (eventType === "practice_attempt.finalized") return { kind: "practiceReceipt", domainId: domain?.receipt?.completionReceiptId };
      if (eventType === "check_in.committed") return { kind: "checkIn", domainId: domain?.checkIn?.checkInId };
      if (eventType === "retest.completed") return { kind: "retest", domainId: domain?.retest?.retestId };
      if (eventType === "learning_cycle.completed") return { kind: "updatedPlan", domainId: domain?.planUpdate?.updatedPlanId };
      return null;
    })();
    if (events.length === eventLimit) {
      const bindings = state.learningEventBindings ? clone(state.learningEventBindings) : null;
      if (!bindingShapeValid(bindings)) return { status: "ledger_invalid", code: "binding_shape_invalid" };
      if (!primaryDomainReference || !safeDomainId(primaryDomainReference.domainId)) {
        return { status: "domain_invalid", code: "invalid_domain_event" };
      }
      const primaryAlias = bindings.records[primaryDomainReference.kind]?.[primaryDomainReference.domainId];
      if (!primaryAlias) {
        return { status: "capacity_reached", code: "learning_events_capacity_reached", limit: eventLimit };
      }
      const primaryKey = PRIMARY_CONTEXT_KEY[eventType];
      const existing = events.find((event) => event.eventType === eventType && event.context?.[primaryKey] === primaryAlias);
      if (!existing) {
        return { status: "capacity_reached", code: "learning_events_capacity_reached", limit: eventLimit };
      }
      let projection;
      try {
        projection = projectDomainEvent(bindings, eventType, domain, { allowNewBindings: false });
      } catch (error) {
        return { status: "domain_invalid", code: error instanceof Error ? error.message : "domain_invalid" };
      }
      const expectedSubject = {
        subjectId: bindings.subjectId,
        subjectType: bindings.subjectType,
        identityAssurance: "local_random_alias",
        assignedBy: bindings.assignmentBoundary,
      };
      const existingContext = Object.fromEntries(
        Object.entries(existing.context).filter(([key]) => key !== "causationEventId"),
      );
      const semanticReplayMatches =
        canonicalJson(existing.subject) === canonicalJson(expectedSubject) &&
        canonicalJson(existingContext) === canonicalJson(projection.context) &&
        canonicalJson(existing.activity) === canonicalJson(projection.activity) &&
        canonicalJson(existing.attributes) === canonicalJson(projection.attributes) &&
        existing.occurredAt === projection.occurredAt;
      return semanticReplayMatches
        ? { status: "already_recorded", event: clone(existing) }
        : { status: "idempotency_conflict", code: "semantic_replay_mismatch" };
    }
    const recordedAt = new Date().toISOString();
    const bindings = state.learningEventBindings ? clone(state.learningEventBindings) : createBindings(recordedAt);
    if (!bindingShapeValid(bindings)) return { status: "ledger_invalid", code: "binding_shape_invalid" };
    let projection;
    try {
      projection = projectDomainEvent(bindings, eventType, domain);
    } catch (error) {
      return { status: "domain_invalid", code: error instanceof Error ? error.message : "domain_invalid" };
    }
    const primaryKey = PRIMARY_CONTEXT_KEY[eventType];
    const existing = events.find((event) => event.eventType === eventType && event.context?.[primaryKey] === projection.context[primaryKey]);
    if (existing) {
      const expectedSubject = {
        subjectId: bindings.subjectId,
        subjectType: bindings.subjectType,
        identityAssurance: "local_random_alias",
        assignedBy: bindings.assignmentBoundary,
      };
      const existingContext = Object.fromEntries(
        Object.entries(existing.context).filter(([key]) => key !== "causationEventId")
      );
      const semanticReplayMatches =
        canonicalJson(existing.subject) === canonicalJson(expectedSubject) &&
        canonicalJson(existingContext) === canonicalJson(projection.context) &&
        canonicalJson(existing.activity) === canonicalJson(projection.activity) &&
        canonicalJson(existing.attributes) === canonicalJson(projection.attributes) &&
        existing.occurredAt === projection.occurredAt;
      return semanticReplayMatches
        ? { status: "already_recorded", event: clone(existing) }
        : { status: "idempotency_conflict", code: "semantic_replay_mismatch" };
    }
    const transition = sameCycleTransitionValid(events, eventType, projection.context, projection.attributes);
    if (!transition.ok) return { status: "domain_invalid", code: transition.code };
    if (transition.cause) projection.context.causationEventId = transition.cause.eventId;
    if (!contextValid(eventType, projection.context) || !attributesValid(eventType, projection.attributes)) {
      return { status: "domain_invalid", code: "projection_invalid" };
    }
    const eventId = createUuid();
    const usedIdempotencyKeys = new Set(events.map((event) => event.idempotencyKey));
    let idempotencyKey = createUuid();
    while (idempotencyKey === eventId || usedIdempotencyKeys.has(idempotencyKey)) idempotencyKey = createUuid();
    const previousEventHash = events.at(-1)?.eventHash || null;
    const withoutHash = {
      contractId: CONTRACT_ID,
      schemaVersion: SCHEMA_VERSION,
      eventId,
      idempotencyKey,
      eventType,
      sequence: events.length + 1,
      occurredAt: projection.occurredAt,
      recordedAt,
      subject: {
        subjectId: bindings.subjectId,
        subjectType: bindings.subjectType,
        identityAssurance: "local_random_alias",
        assignedBy: bindings.assignmentBoundary,
      },
      context: projection.context,
      activity: projection.activity,
      attributes: projection.attributes,
      privacy: fixedPrivacy(),
      governance: fixedGovernance(),
      previousEventHash,
    };
    const event = { ...withoutHash, eventHash: await hashEvent(withoutHash) };
    if (!eventShapeValid(event)) return { status: "domain_invalid", code: "event_shape_invalid" };
    const nextState = { ...state, learningEvents: [...events, event], learningEventBindings: bindings };
    const nextStatus = await validateLedger(nextState);
    if (!nextStatus.ok) return { status: "ledger_invalid", code: nextStatus.code };
    state.learningEvents = nextState.learningEvents;
    state.learningEventBindings = nextState.learningEventBindings;
    return { status: "appended", event: clone(event), eventCount: nextState.learningEvents.length };
  };

  const summarize = async (state) => {
    const validation = await validateLedger(state);
    if (!validation.ok) return { status: "ledger_invalid", code: validation.code };
    const events = Array.isArray(state?.learningEvents) ? state.learningEvents : [];
    const byType = Object.fromEntries(EVENT_TYPES.map((eventType) => [eventType, events.filter((event) => event?.eventType === eventType).length]));
    return {
      status: "ready",
      contractId: CONTRACT_ID,
      eventCount: events.length,
      byType,
      firstRecordedAt: events[0]?.recordedAt || null,
      lastRecordedAt: events.at(-1)?.recordedAt || null,
      headHash: events.at(-1)?.eventHash || null,
      exportEligibility: EXPORT_ELIGIBILITY,
      networkDispatch: "disabled",
      lrsDispatch: "disabled",
      xapiDispatch: "disabled",
    };
  };
  const createLocalBackup = async (state) => {
    const validation = await validateLedger(state);
    if (!validation.ok) return { status: "ledger_invalid", code: validation.code };
    return {
      status: "ready",
      backup: {
        backupType: EXPORT_ELIGIBILITY,
        contractId: CONTRACT_ID,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        integrity: {
          validation: "valid_at_export",
          hashAlgorithm: "SHA-256",
          eventCount: validation.eventCount,
          headHash: validation.headHash,
        },
        events: clone(Array.isArray(state.learningEvents) ? state.learningEvents : []),
      },
    };
  };
  const clearFromState = (state) => {
    state.learningEvents = [];
    state.learningEventBindings = null;
  };

  window.SufeiyaLearningEvents = Object.freeze({
    CONTRACT_ID,
    SCHEMA_VERSION,
    LEDGER_PROTOCOL_VERSION,
    BINDING_PROTOCOL_VERSION,
    EXPORT_ELIGIBILITY,
    EVENT_TYPES,
    ledgerShapeValid,
    validateLedger,
    appendDomainEvent,
    summarize,
    createLocalBackup,
    clearFromState,
    canonicalJson,
  });
})();
