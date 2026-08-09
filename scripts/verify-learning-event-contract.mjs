import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const registry = JSON.parse(await read("data/sufeiya-learning-event-register-v1.json"));
const schema = JSON.parse(await read("schemas/sufeiya-learning-event-v1.schema.json"));
const examples = JSON.parse(await read("data/sufeiya-learning-event-examples-v1.json"));
const scriptSource = await read("scripts/verify-learning-event-contract.mjs");
const journeySource = await read("journey.js");
const teacherContractsSource = await read("lib/super-teacher/contracts.ts");

class ContractError extends Error {
  constructor(code, path = "$") {
    super(`${code}:${path}`);
    this.name = "ContractError";
    this.code = code;
    this.path = path;
  }
}

const passes = [];
const failures = [];
const check = (condition, message) => {
  if (condition) passes.push(message);
  else failures.push(message);
};
const reject = (code, path) => {
  throw new ContractError(code, path);
};
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isPlainObject = (value) => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
const sorted = (values) => [...values].sort();
const quotedValues = (source) => [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

function sourceSetValues(name) {
  const body = journeySource.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`))?.[1];
  if (!body) return [];
  return quotedValues(body);
}

function assertPlainTree(value, path = "$", depth = 0) {
  if (depth > 4) reject("EVENT_TOO_DEEP", path);
  if (["string", "boolean"].includes(typeof value) || value === null) return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject("NON_FINITE_NUMBER", path);
    return;
  }
  if (["undefined", "function", "symbol", "bigint"].includes(typeof value)) reject("UNSERIALIZABLE_VALUE", path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainTree(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (!isPlainObject(value)) reject("NON_PLAIN_OBJECT", path);
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) reject("PROTOTYPE_KEY", `${path}.${key}`);
    assertPlainTree(child, `${path}.${key}`, depth + 1);
  }
}

function resolveRef(ref) {
  if (!ref.startsWith("#/")) reject("UNSUPPORTED_SCHEMA_REF", "$schema");
  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((node, part) => node?.[part], schema);
}

function validateWithSchema(value, node, path = "$") {
  if (node.$ref) return validateWithSchema(value, resolveRef(node.$ref), path);
  if (hasOwn(node, "const") && value !== node.const) reject("SCHEMA_CONST", path);
  if (node.enum && !node.enum.includes(value)) reject("SCHEMA_ENUM", path);

  if (node.type === "object") {
    if (!isPlainObject(value)) reject("SCHEMA_OBJECT", path);
    for (const key of node.required ?? []) {
      if (!hasOwn(value, key)) reject("SCHEMA_REQUIRED", `${path}.${key}`);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!hasOwn(node.properties ?? {}, key)) reject("SCHEMA_UNKNOWN_FIELD", `${path}.${key}`);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (node.properties?.[key]) validateWithSchema(child, node.properties[key], `${path}.${key}`);
    }
  } else if (node.type === "array") {
    if (!Array.isArray(value)) reject("SCHEMA_ARRAY", path);
    if (node.maxItems !== undefined && value.length > node.maxItems) reject("SCHEMA_MAX_ITEMS", path);
    if (node.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) reject("SCHEMA_UNIQUE_ITEMS", path);
    value.forEach((item, index) => validateWithSchema(item, node.items, `${path}[${index}]`));
  } else if (node.type === "string") {
    if (typeof value !== "string") reject("SCHEMA_STRING", path);
    if (node.minLength !== undefined && value.length < node.minLength) reject("SCHEMA_MIN_LENGTH", path);
    if (node.maxLength !== undefined && value.length > node.maxLength) reject("SCHEMA_MAX_LENGTH", path);
    if (node.pattern && !new RegExp(node.pattern).test(value)) reject("SCHEMA_PATTERN", path);
    if (node.format === "date-time") {
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) reject("SCHEMA_DATE_TIME", path);
    }
    if (node.format === "uri") {
      try {
        new URL(value);
      } catch {
        reject("SCHEMA_URI", path);
      }
    }
  } else if (node.type === "integer") {
    if (!Number.isInteger(value)) reject("SCHEMA_INTEGER", path);
    if (node.minimum !== undefined && value < node.minimum) reject("SCHEMA_MINIMUM", path);
    if (node.maximum !== undefined && value > node.maximum) reject("SCHEMA_MAXIMUM", path);
  } else if (node.type === "boolean" && typeof value !== "boolean") {
    reject("SCHEMA_BOOLEAN", path);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(event) {
  const withoutIntegrity = { ...event };
  delete withoutIntegrity.integrity;
  return createHash("sha256").update(stableJson(withoutIntegrity)).digest("hex");
}

if (process.argv.includes("--print-hashes")) {
  for (const [index, event] of examples.events.entries()) {
    console.log(`${index + 1} ${event.eventType} ${payloadHash(event)}`);
  }
  process.exit(0);
}

const forbiddenKeyNames = new Set([
  "name", "fullname", "firstname", "lastname", "displayname", "email", "emailaddress", "mbox", "phone", "phonenumber",
  "mobile", "tel", "wechat", "openid", "school", "classname", "profile", "avatar", "password", "token", "accesstoken",
  "refreshtoken", "jwt", "cookie", "authorization", "clerkuser", "clerksession", "essay", "writing", "draft", "answertext",
  "responsetext", "response", "submissiontext", "document", "editorstate", "content", "text", "audio", "recording", "voice",
  "transcript", "waveform", "blob", "buffer", "base64", "dataurl", "file", "attachment", "mediaurl", "storagekey", "signedurl",
  "prompt", "completion", "messages", "conversation", "chathistory", "assistantmessage", "usermessage", "systemmessage", "modelinput",
  "modeloutput", "sofiamessage", "sofiaconversation", "toolcall", "reasoning", "ip", "ipaddress", "useragent", "fingerprint",
  "latitude", "longitude", "requestbody", "responsebody", "headers", "stack", "localstorage", "dom", "html", "metadata", "payload",
  "details", "properties", "note", "comment", "message", "query", "raw"
]);
const normalizedKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
const forbiddenValuePatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|[^A-Za-z0-9])(?:\+?86[- ]?)?1[3-9]\d{9}(?:$|[^A-Za-z0-9])/,
  /%[0-9a-f]{2}/i,
  /data:(?:audio|application)\//i,
  /\.(?:mp3|wav|m4a|ogg)(?:\?|#|$)/i,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+/i
];

function decodesToReadablePayload(candidate) {
  if (candidate.length < 12 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(candidate)) return false;
  const normalized = candidate.replaceAll("-", "+").replaceAll("_", "/");
  try {
    const decoded = Buffer.from(`${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`, "base64").toString("utf8");
    if (decoded.length < 6 || decoded.includes("\ufffd")) return false;
    const characters = [...decoded];
    const readable = characters.filter((character) => character >= " " && character !== "\u007f").length;
    return readable / characters.length >= 0.85;
  } catch {
    return false;
  }
}

function assertNoEncodedPayload(value, path) {
  const candidates = new Set([value]);
  for (const match of value.matchAll(/[A-Za-z0-9+/_-]{12,}={0,2}/g)) candidates.add(match[0]);
  for (const segment of value.split(/[.:/_-]/)) candidates.add(segment);
  if ([...candidates].some(decodesToReadablePayload)) reject("FORBIDDEN_ENCODED_VALUE", path);
}

function assertNoForbiddenPayload(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeyNames.has(normalizedKey(key))) reject("FORBIDDEN_FIELD", `${path}.${key}`);
      assertNoForbiddenPayload(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    if (path === "$.subject.subjectId" && /(?:\+?86[- ]?)?1[3-9]\d{9}/.test(value)) reject("FORBIDDEN_VALUE", path);
    if (forbiddenValuePatterns.some((pattern) => pattern.test(value))) reject("FORBIDDEN_VALUE", path);
    assertNoEncodedPayload(value, path);
  }
}

const eventSpecs = new Map(registry.eventTypes.map((event) => [event.eventType, event]));
const approvedTaskSetDigests = new Set(registry.taskSets.map((taskSet) => taskSet.taskSetDigest));
const approvedSourceProtocols = new Set(registry.sourceProtocolVersions);
const approvedDiagnosticProtocols = new Set(registry.diagnosticProtocolVersions);
const approvedApplicationReleases = new Map(registry.applicationReleases.map((release) => [release.appRelease, release]));
const approvedNoticeVersions = new Set(registry.noticeVersions);
const activityCatalog = new Map(registry.activityCatalog.map((activity) => [activity.activityId, activity]));
const semanticRules = registry.semanticRules;
const matrixAllows = (matrix, key, value) => Array.isArray(matrix[key]) && matrix[key].includes(value);
const qualityFlagMaskFor = (flags) => flags.reduce((mask, flag) => mask | (1 << semanticRules.qualityFlagBitOrder.indexOf(flag)), 0);

function validateGovernance(event) {
  const { subject, governance } = event;
  if (governance.xapiDispatchPolicy !== "disabled") reject("LRS_DISPATCH_NOT_DEFERRED", "$.governance.xapiDispatchPolicy");
  if (governance.dataUse === "local_only_demo") {
    if (subject.subjectType !== "anonymous_installation" || subject.identityAssurance !== "local_device" || subject.assignedBy !== "local_runtime") reject("LOCAL_IDENTITY_MISMATCH", "$.subject");
    if (governance.retentionClass !== "local_until_cleared" || governance.exportEligibility !== "local_only_not_exportable") {
      reject("LOCAL_GOVERNANCE_MISMATCH", "$.governance");
    }
    if (hasOwn(governance, "consentReceiptId")) reject("LOCAL_CONSENT_RECEIPT_FORBIDDEN", "$.governance.consentReceiptId");
  }
  if (governance.dataUse === "first_party_learning_record") {
    if (subject.subjectType !== "registered_account" || subject.identityAssurance !== "authenticated_account" || subject.assignedBy !== "sufeiya_identity_service") reject("ACCOUNT_IDENTITY_REQUIRED", "$.subject");
    if (governance.retentionClass !== "account_lifecycle" || governance.exportEligibility !== "server_event_not_lrs_exportable") {
      reject("FIRST_PARTY_GOVERNANCE_MISMATCH", "$.governance");
    }
  }
  if (governance.dataUse === "consented_xapi_pilot") {
    if (subject.subjectType !== "registered_account" || subject.identityAssurance !== "authenticated_account" || subject.assignedBy !== "sufeiya_identity_service") reject("PILOT_ACCOUNT_REQUIRED", "$.subject");
    if (governance.retentionClass !== "pilot_bounded" || governance.exportEligibility !== "lrs_export_approved") {
      reject("PILOT_GOVERNANCE_MISMATCH", "$.governance");
    }
    if (!governance.consentReceiptId) reject("PILOT_CONSENT_REQUIRED", "$.governance.consentReceiptId");
  }
}

function validateSubjectIdentity(subject) {
  if (subject.subjectType === "anonymous_installation" && !subject.subjectId.startsWith("anon_")) reject("SUBJECT_ID_PREFIX_MISMATCH", "$.subject.subjectId");
  if (subject.subjectType === "registered_account" && !subject.subjectId.startsWith("sub_")) reject("SUBJECT_ID_PREFIX_MISMATCH", "$.subject.subjectId");
}

function validateAliasSeparation(event) {
  const aliases = [
    ["$.eventId", event.eventId],
    ["$.subject.subjectId", event.subject.subjectId.replace(/^(?:anon|sub)_/, "")],
    ...Object.entries(event.context).map(([key, value]) => [`$.context.${key}`, value]),
    ...(event.governance.consentReceiptId ? [["$.governance.consentReceiptId", event.governance.consentReceiptId]] : [])
  ];
  const seen = new Map();
  for (const [path, alias] of aliases) {
    if (seen.has(alias)) reject("ALIAS_COLLISION", path);
    seen.set(alias, path);
  }
}

function validateEvent(event) {
  assertPlainTree(event);
  let serialized;
  try {
    serialized = JSON.stringify(event);
  } catch {
    reject("UNSERIALIZABLE_EVENT", "$");
  }
  if (Buffer.byteLength(serialized, "utf8") > 2048) reject("EVENT_TOO_LARGE", "$");
  validateWithSchema(event, schema);
  assertNoForbiddenPayload(event);
  validateSubjectIdentity(event.subject);
  validateAliasSeparation(event);
  const spec = eventSpecs.get(event.eventType);
  if (!spec) reject("UNREGISTERED_EVENT", "$.eventType");
  if (event.idempotencyKey !== `evt:${event.eventId}`) reject("IDEMPOTENCY_KEY_MISMATCH", "$.idempotencyKey");
  if (!approvedApplicationReleases.has(event.source.appRelease)) reject("UNREGISTERED_APP_RELEASE", "$.source.appRelease");
  if (!approvedSourceProtocols.has(event.source.protocolVersion)) reject("UNREGISTERED_SOURCE_PROTOCOL", "$.source.protocolVersion");
  if (!approvedNoticeVersions.has(event.governance.noticeVersion)) reject("UNREGISTERED_NOTICE_VERSION", "$.governance.noticeVersion");
  if (!registry.noticeDataUse[event.governance.noticeVersion]?.includes(event.governance.dataUse)) reject("NOTICE_DATA_USE_MISMATCH", "$.governance.dataUse");
  if (event.activity.activityKind !== spec.activityKind) reject("ACTIVITY_KIND_MISMATCH", "$.activity.activityKind");
  if (!spec.allowedActivityIds.includes(event.activity.activityId)) reject("EVENT_ACTIVITY_NOT_ALLOWED", "$.activity.activityId");
  const catalogActivity = activityCatalog.get(event.activity.activityId);
  if (!catalogActivity || catalogActivity.activityKind !== event.activity.activityKind || catalogActivity.activityVersion !== event.activity.activityVersion) reject("ACTIVITY_CATALOG_MISMATCH", "$.activity");
  if (catalogActivity.skill && event.attributes.skill !== catalogActivity.skill) reject("ACTIVITY_SKILL_MISMATCH", "$.attributes.skill");
  for (const key of spec.requiredContextKeys) {
    if (!hasOwn(event.context, key)) reject("EVENT_CONTEXT_REQUIRED", `$.context.${key}`);
  }
  const allowedContextKeys = new Set([...spec.requiredContextKeys, ...spec.optionalContextKeys]);
  for (const key of Object.keys(event.context)) {
    if (!allowedContextKeys.has(key)) reject("EVENT_CONTEXT_NOT_ALLOWED", `$.context.${key}`);
  }
  for (const key of spec.requiredAttributeKeys) {
    if (!hasOwn(event.attributes, key)) reject("EVENT_ATTRIBUTE_REQUIRED", `$.attributes.${key}`);
  }
  const allowedAttributeKeys = new Set([...spec.requiredAttributeKeys, ...spec.optionalAttributeKeys]);
  for (const key of Object.keys(event.attributes)) {
    if (!allowedAttributeKeys.has(key)) reject("EVENT_ATTRIBUTE_NOT_ALLOWED", `$.attributes.${key}`);
  }
  for (const [key, value] of Object.entries(spec.requiredAttributeValues)) {
    if (event.attributes[key] !== value) reject("EVENT_ATTRIBUTE_VALUE", `$.attributes.${key}`);
  }
  if (hasOwn(event.attributes, "skill") && !semanticRules.eventSkillAllowlist[event.eventType]?.includes(event.attributes.skill)) {
    reject("EVENT_SKILL_INVALID", "$.attributes.skill");
  }
  for (const [attribute, skills] of Object.entries(semanticRules.eventAttributeSkillAllowlist[event.eventType] ?? {})) {
    if (hasOwn(event.attributes, attribute) && !skills.includes(event.attributes.skill)) reject("EVENT_ATTRIBUTE_SKILL_MISMATCH", `$.attributes.${attribute}`);
  }
  if (hasOwn(event.attributes, "taskSetDigest") && !approvedTaskSetDigests.has(event.attributes.taskSetDigest)) {
    reject("UNREGISTERED_TASK_SET_DIGEST", "$.attributes.taskSetDigest");
  }
  if (event.eventType === "diagnostic_task.terminal") {
    const { skill, terminalStatus, evidenceType } = event.attributes;
    if (!semanticRules.diagnosticSkills.includes(skill)) reject("DIAGNOSTIC_SKILL_INVALID", "$.attributes.skill");
    if (!matrixAllows(semanticRules.diagnosticTerminalEvidenceMatrix, terminalStatus, evidenceType)) reject("DIAGNOSTIC_TERMINAL_EVIDENCE_MISMATCH", "$.attributes.evidenceType");
    if (!matrixAllows(semanticRules.diagnosticTerminalSkillMatrix, terminalStatus, skill)) reject("DIAGNOSTIC_TERMINAL_SKILL_MISMATCH", "$.attributes.skill");
    if (terminalStatus === "completed" && !matrixAllows(semanticRules.diagnosticCompletedEvidenceBySkill, skill, evidenceType)) reject("DIAGNOSTIC_SKILL_EVIDENCE_MISMATCH", "$.attributes.evidenceType");
    if (hasOwn(event.attributes, "qualityFlagMask")) {
      const allowedMask = qualityFlagMaskFor(semanticRules.diagnosticQualityFlagsBySkill[skill]);
      if ((event.attributes.qualityFlagMask & ~allowedMask) !== 0) reject("DIAGNOSTIC_QUALITY_SKILL_MISMATCH", "$.attributes.qualityFlagMask");
    }
  }
  if (event.eventType === "diagnostic.completed") {
    if (!semanticRules.diagnosticSkills.includes(event.attributes.skill)) reject("DIAGNOSTIC_SKILL_INVALID", "$.attributes.skill");
    if (!semanticRules.diagnosticConfidenceValues.includes(event.attributes.evidenceConfidence)) reject("DIAGNOSTIC_CONFIDENCE_INVALID", "$.attributes.evidenceConfidence");
    if (event.attributes.evidenceCount > 6) reject("DIAGNOSTIC_EVIDENCE_COUNT_INVALID", "$.attributes.evidenceCount");
  }
  if (event.eventType === "practice_attempt.finalized") {
    const { practiceOutcome, evidenceType, skill } = event.attributes;
    if (!matrixAllows(semanticRules.practiceOutcomeEvidenceMatrix, practiceOutcome, evidenceType)) reject("PRACTICE_OUTCOME_EVIDENCE_MISMATCH", "$.attributes.evidenceType");
    if (!matrixAllows(semanticRules.practiceOutcomeSkills, practiceOutcome, skill)) reject("PRACTICE_OUTCOME_SKILL_MISMATCH", "$.attributes.skill");
  }
  if (event.eventType === "planned_task.status_changed" && event.attributes.taskStatus === "reopened" && !semanticRules.plannedTaskReopenSources.includes(event.attributes.completionSource)) {
    reject("PLANNED_TASK_REOPEN_SOURCE_INVALID", "$.attributes.completionSource");
  }
  if (event.eventType === "retest.completed") {
    if (!matrixAllows(semanticRules.retestSkillEvidenceMatrix, event.attributes.skill, event.attributes.evidenceType)) reject("RETEST_SKILL_EVIDENCE_MISMATCH", "$.attributes.evidenceType");
  }
  if (event.eventType === "focus_session.ended" && hasOwn(event.attributes, "activeDurationMs") && event.attributes.activeDurationMs > event.attributes.plannedDurationMs) {
    reject("ACTIVE_DURATION_EXCEEDS_PLAN", "$.attributes.activeDurationMs");
  }
  if (event.eventType === "learning_support.interaction_finished") {
    const { supportOutcome, teacherMode, citationCount, handoffRecommended, errorCode } = event.attributes;
    if (supportOutcome === "error") {
      if (!errorCode || errorCode === "none") reject("SUPPORT_ERROR_CODE_REQUIRED", "$.attributes.errorCode");
      if (teacherMode !== undefined || citationCount !== undefined || handoffRecommended !== undefined) reject("SUPPORT_ERROR_SHAPE_INVALID", "$.attributes");
    } else {
      if (!event.context.requestId) reject("SUPPORT_REQUEST_ID_REQUIRED", "$.context.requestId");
      if (!teacherMode) reject("SUPPORT_MODE_REQUIRED", "$.attributes.teacherMode");
      if (citationCount === undefined) reject("SUPPORT_CITATION_COUNT_REQUIRED", "$.attributes.citationCount");
      if (handoffRecommended === undefined) reject("SUPPORT_HANDOFF_FLAG_REQUIRED", "$.attributes.handoffRecommended");
      if (errorCode !== undefined && errorCode !== "none") reject("SUPPORT_NON_ERROR_CODE_INVALID", "$.attributes.errorCode");
      const modeRule = semanticRules.supportModeRules[teacherMode];
      if (!modeRule || Object.entries(modeRule).some(([key, value]) => event.attributes[key] !== value)) reject("SUPPORT_MODE_OUTCOME_MISMATCH", "$.attributes.teacherMode");
    }
  }
  if (Date.parse(event.recordedAt) < Date.parse(event.occurredAt)) reject("RECORDED_BEFORE_OCCURRED", "$.recordedAt");
  validateGovernance(event);
  if (event.integrity.payloadSha256 !== payloadHash(event)) reject("PAYLOAD_HASH_MISMATCH", "$.integrity.payloadSha256");
  return true;
}

function withHash(event) {
  const copy = structuredClone(event);
  copy.integrity.payloadSha256 = payloadHash(copy);
  return copy;
}

function expectReject(label, event, expectedCode) {
  try {
    validateEvent(event);
    failures.push(`${label}: invalid event was accepted`);
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : String(error);
    const leaked = ["student@example.com", "13800138000", "My private essay", "secret Sofia question"].some((secret) => safeMessage.includes(secret));
    check(error instanceof ContractError, `${label}: rejects with a bounded ContractError`);
    check(!leaked, `${label}: rejection message does not echo sensitive values`);
    if (expectedCode) check(error.code === expectedCode, `${label}: rejects with ${expectedCode}`);
  }
}

function expectAccept(label, event) {
  try {
    validateEvent(event);
    passes.push(`${label}: valid event is accepted`);
  } catch (error) {
    failures.push(`${label}: valid event failed with ${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
}

const contextDefaults = {
  registrationId: "20000000-0000-4000-8000-000000000001",
  learningSessionId: "21000000-0000-4000-8000-000000000001",
  learningCycleId: "22000000-0000-4000-8000-000000000001",
  diagnosticSessionId: "23000000-0000-4000-8000-000000000001",
  planId: "24000000-0000-4000-8000-000000000001",
  recommendationId: "25000000-0000-4000-8000-000000000001",
  checkInId: "26000000-0000-4000-8000-000000000001",
  reviewId: "27000000-0000-4000-8000-000000000001",
  peerHelpId: "28000000-0000-4000-8000-000000000001",
  retestId: "29000000-0000-4000-8000-000000000001",
  updatedPlanId: "2a000000-0000-4000-8000-000000000001",
  supersedingCycleId: "2b000000-0000-4000-8000-000000000001",
  taskId: "2c000000-0000-4000-8000-000000000001",
  attemptId: "2d000000-0000-4000-8000-000000000001",
  focusSessionId: "2e000000-0000-4000-8000-000000000001",
  interactionId: "2f000000-0000-4000-8000-000000000001",
  requestId: "40000000-0000-4000-8000-000000000001",
  causationEventId: "41000000-0000-4000-8000-000000000001",
  supersedesEventId: "42000000-0000-4000-8000-000000000001"
};
const attributeDefaults = {
  outcome: "completed",
  terminalStatus: "completed",
  decision: "accepted",
  taskStatus: "completed",
  completionSource: "learner_checkbox",
  practiceOutcome: "matched",
  sessionOutcome: "completed",
  preference: "declined",
  supportOutcome: "fallback",
  skill: "Listening",
  durationMs: 60000,
  plannedDurationMs: 1500000,
  activeDurationMs: 1200000,
  latencyMs: 42,
  dailyMinutes: 30,
  attemptCount: 1,
  taskCount: 3,
  evidenceCount: 6,
  wordCount: 0,
  selfCheckCount: 0,
  qualityFlagMask: 0,
  evidenceType: "task_completed_no_score",
  evidenceConfidence: "low",
  taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
  issuePresent: false,
  teacherMode: "manual_grounded",
  modelAttempted: false,
  citationCount: 2,
  handoffRecommended: false,
  errorCode: "none",
  automatedScoreProduced: false,
  formalDiagnosisProduced: false,
  growthClaimProduced: false,
  officialEquivalenceClaimed: false
};

function syntheticEventFor(spec, index, includeOptional = false, optionalSkill = null) {
  const suffix = (index + 1).toString(16).padStart(12, "0");
  const eventId = `30000000-0000-4000-8000-${suffix}`;
  const skillActivity = optionalSkill
    ? registry.activityCatalog.find((entry) => spec.allowedActivityIds.includes(entry.activityId) && entry.skill === optionalSkill)
    : null;
  const activityId = skillActivity?.activityId ?? spec.allowedActivityIds[0];
  const catalogEntry = registry.activityCatalog.find((entry) => entry.activityId === activityId);
  const attributeSkillRules = semanticRules.eventAttributeSkillAllowlist[spec.eventType] ?? {};
  const optionalAttributeKeys = includeOptional
    ? spec.optionalAttributeKeys.filter((key) => !hasOwn(attributeSkillRules, key) || attributeSkillRules[key].includes(optionalSkill))
    : [];
  const event = {
    contractId: "sufeiya.learning-event.v1",
    schemaVersion: 1,
    eventId,
    idempotencyKey: `evt:${eventId}`,
    eventType: spec.eventType,
    occurredAt: "2026-08-10T09:00:00.000Z",
    recordedAt: "2026-08-10T09:00:01.000Z",
    subject: {
      subjectId: "anon_90000000-0000-4000-8000-000000000001",
      subjectType: "anonymous_installation",
      identityAssurance: "local_device",
      assignedBy: "local_runtime"
    },
    source: { surface: "web", appRelease: "a4c34445ebd8", locale: "zh-CN", protocolVersion: "gate_a_local_v1" },
    context: Object.fromEntries([...spec.requiredContextKeys, ...(includeOptional ? spec.optionalContextKeys : [])].map((key) => [key, contextDefaults[key]])),
    activity: {
      activityId,
      activityVersion: catalogEntry.activityVersion,
      activityKind: spec.activityKind
    },
    attributes: Object.fromEntries([...spec.requiredAttributeKeys, ...optionalAttributeKeys].map((key) => [key, attributeDefaults[key]])),
    privacy: {
      classification: "pseudonymous_learning_metadata",
      containsDirectIdentifier: false,
      containsFreeText: false,
      containsRawResponse: false,
      containsAudio: false,
      containsConversationContent: false
    },
    governance: {
      dataUse: "local_only_demo",
      noticeVersion: "gate-a-v1",
      retentionClass: "local_until_cleared",
      exportEligibility: "local_only_not_exportable",
      xapiDispatchPolicy: "disabled"
    },
    integrity: {
      canonicalization: "rfc8785-jcs",
      hashScope: "event_without_integrity",
      payloadSha256: "0".repeat(64),
      registryVersion: "sufeiya_learning_event_registry_v1"
    }
  };
  if (catalogEntry.skill && hasOwn(event.attributes, "skill")) event.attributes.skill = catalogEntry.skill;
  if (spec.eventType === "learning_cycle.started") event.attributes.outcome = "started";
  if (spec.eventType === "learning_cycle.superseded") event.attributes.outcome = "superseded";
  if (spec.eventType === "plan.committed" || spec.eventType === "check_in.committed") event.attributes.outcome = "committed";
  if (spec.eventType === "review.confirmed") event.attributes.outcome = "confirmed";
  if (spec.eventType === "diagnostic_task.terminal") {
    event.attributes.evidenceType = ["Writing", "Speaking"].includes(event.attributes.skill) ? "task_completed_no_score" : "first_response_matched";
  }
  if (spec.eventType === "practice_attempt.finalized") {
    if (["Writing", "Speaking"].includes(event.attributes.skill)) {
      event.attributes.practiceOutcome = "self_review_completed";
      event.attributes.evidenceType = "task_completed_no_score";
    } else {
      event.attributes.evidenceType = "first_response_matched";
    }
  }
  if (spec.eventType === "retest.completed") {
    event.attributes.evidenceType = ["Writing", "Speaking"].includes(event.attributes.skill) ? "task_completed_no_score" : "single_task_correct";
  }
  if (spec.eventType === "learning_support.interaction_finished") {
    event.context.requestId = contextDefaults.requestId;
    event.attributes.teacherMode = "manual_grounded";
    event.attributes.citationCount = 2;
    event.attributes.handoffRecommended = false;
  }
  return withHash(event);
}

function maximalShapeEventFor(spec, index, maximalSkill = null) {
  const event = structuredClone(syntheticEventFor(spec, index, true, maximalSkill));
  const attributeKeys = Object.keys(event.attributes);
  for (const key of attributeKeys) {
    const property = schema.$defs.attributes.properties[key];
    if (property.type === "integer" && property.maximum !== undefined) event.attributes[key] = property.maximum;
    if (property.enum) event.attributes[key] = [...property.enum].sort((left, right) => right.length - left.length)[0];
  }
  Object.assign(event.attributes, spec.requiredAttributeValues);
  const setActivityForSkill = (skill) => {
    const candidate = spec.allowedActivityIds
      .map((activityId) => activityCatalog.get(activityId))
      .filter((activity) => activity?.skill === skill)
      .sort((left, right) => right.activityId.length - left.activityId.length)[0];
    if (candidate) {
      event.activity = { activityId: candidate.activityId, activityVersion: candidate.activityVersion, activityKind: candidate.activityKind };
      event.attributes.skill = skill;
    }
  };
  if (spec.eventType === "diagnostic_task.terminal") {
    const skill = maximalSkill ?? "Writing";
    setActivityForSkill(skill);
    Object.assign(
      event.attributes,
      ["Reading", "Listening"].includes(skill)
        ? { terminalStatus: "completed", evidenceType: "first_response_not_matched" }
        : { terminalStatus: skill === "Writing" ? "evidence_insufficient" : "completed", evidenceType: "task_completed_no_score" },
    );
    if (hasOwn(event.attributes, "qualityFlagMask")) event.attributes.qualityFlagMask = qualityFlagMaskFor(semanticRules.diagnosticQualityFlagsBySkill[skill]);
  }
  if (spec.eventType === "diagnostic.completed") Object.assign(event.attributes, { skill: "Listening", evidenceCount: 6, evidenceConfidence: "medium" });
  if (spec.eventType === "plan.committed") event.attributes.skill = "Listening";
  if (spec.eventType === "practice_attempt.finalized") {
    const skill = maximalSkill ?? "Writing";
    setActivityForSkill(skill);
    Object.assign(
      event.attributes,
      ["Reading", "Listening"].includes(skill)
        ? { practiceOutcome: "needs_retry", evidenceType: "first_response_not_matched" }
        : { practiceOutcome: "self_review_completed", evidenceType: "task_completed_no_score" },
    );
  }
  if (spec.eventType === "planned_task.status_changed") Object.assign(event.attributes, { taskStatus: "completed", completionSource: "learner_checkbox" });
  if (spec.eventType === "retest.completed") {
    const skill = maximalSkill ?? "Writing";
    setActivityForSkill(skill);
    event.attributes.evidenceType = ["Reading", "Listening"].includes(skill) ? "single_task_needs_review" : "task_completed_no_score";
  }
  if (spec.eventType === "learning_cycle.completed") event.attributes.skill = "Listening";
  if (spec.eventType === "learning_support.interaction_finished") {
    Object.assign(event.attributes, {
      supportOutcome: "refused",
      modelAttempted: false,
      teacherMode: "insufficient_sources",
      citationCount: semanticRules.supportCitationCountRange.maximum,
      handoffRecommended: true,
      errorCode: "none"
    });
  }
  return withHash(event);
}

check(registry.protocolVersion === "sufeiya_learning_event_registry_v1", "registry protocol version is frozen");
check(registry.decisionStatus === "approved_xapi_ready_lrs_deferred", "registry records the approved defer-LRS decision");
check(registry.xapiTargetVersion === "2.0.0", "draft projection target is frozen to xAPI 2.0");
check(registry.xapiNamespace === "https://sufeiya.cn/xapi/v1/", "custom xAPI vocabulary uses the registered Sufeiya namespace");
check(registry.eventFieldPolicy === "required_plus_optional_keys_only", "registry uses per-event field allowlists");
check(registry.identifierPolicy.subjectIdFormat === "typed_prefix_plus_csprng_uuid_v4", "subject identifiers require typed CSPRNG UUID aliases");
check(registry.identifierPolicy.contextIdFormat === "event_layer_csprng_uuid_v4_alias", "context identifiers require event-layer CSPRNG UUID aliases");
check(registry.identifierPolicy.idempotencyFormat === "evt_colon_event_id", "idempotency keys are derived only from event IDs");
check(registry.identifierPolicy.sourceReleaseFormat === "registered_lowercase_hex_commit_alias_7_to_12", "source releases use registered bounded commit aliases");
check(registry.identifierPolicy.rawDomainIdsAllowed === false && registry.identifierPolicy.identityDerivedIdsAllowed === false, "raw domain and identity-derived identifiers are forbidden");
check(Array.isArray(registry.sourceProtocolVersions) && registry.sourceProtocolVersions.includes("gate_a_local_v1"), "registry allowlists the active Gate A source protocol");
check(Array.isArray(registry.applicationReleases) && registry.applicationReleases.length > 0, "registry contains at least one approved application release");
check(approvedApplicationReleases.size === registry.applicationReleases.length, "application release aliases contain no duplicates");
check(registry.applicationReleases.every((release) => /^[0-9a-f]{7,12}$/.test(release.appRelease) && /^[0-9a-f]{40}$/.test(release.gitCommit) && release.gitCommit.startsWith(release.appRelease)), "each application release alias resolves to one matching full Git commit");
check(Array.isArray(registry.noticeVersions) && registry.noticeVersions.includes("gate-a-v1"), "registry allowlists the active privacy notice version");
check(registry.noticeVersions.every((noticeVersion) => Array.isArray(registry.noticeDataUse[noticeVersion]) && registry.noticeDataUse[noticeVersion].length > 0), "every notice version has an explicit allowed data-use scope");
check(Array.isArray(registry.taskSets) && registry.taskSets.length > 0, "registry contains at least one approved task set digest");
check(new Set(registry.taskSets.map((taskSet) => taskSet.taskSetDigest)).size === registry.taskSets.length, "task set digest allowlist contains no duplicates");
check(registry.taskSets.every((taskSet) => /^[0-9a-f]{64}$/.test(taskSet.taskSetDigest)), "approved task set digests are SHA-256 shaped");
check(Array.isArray(registry.activityCatalog) && registry.activityCatalog.length > 0, "registry contains a first-party activity catalog");
check(activityCatalog.size === registry.activityCatalog.length, "activity catalog contains no duplicate activity IDs");
check(registry.activityCatalog.every((activity) => /^https:\/\/sufeiya\.cn\/activities\//.test(activity.activityId)), "activity catalog uses only the first-party activity namespace");
check(registry.activityCatalog.every((activity) => activity.skill === undefined || registry.semanticRules.diagnosticSkills.includes(activity.skill)), "activity skill bindings use registered diagnostic skills");
const activeProtocol = journeySource.match(/const PROTOCOL_VERSION = "([^"]+)"/)?.[1];
const activeDiagnosticProtocol = journeySource.match(/const DIAGNOSTIC_PROTOCOL_VERSION = "([^"]+)"/)?.[1];
const activeTaskSetDigest = journeySource.match(/const DIAGNOSTIC_TASK_SET_DIGEST = "([0-9a-f]{64})"/)?.[1];
check(approvedSourceProtocols.has(activeProtocol), "active Gate A protocol is registered without renaming");
check(approvedDiagnosticProtocols.has(activeDiagnosticProtocol), "active diagnostic evidence protocol is registered separately from the event-source protocol");
check(approvedTaskSetDigests.has(activeTaskSetDigest), "active Gate A task-set digest is registered exactly");
const sourceValidSkills = sourceSetValues("VALID_SKILLS");
check(JSON.stringify(sorted(sourceValidSkills.filter((skill) => skill !== "Balanced"))) === JSON.stringify(sorted(semanticRules.diagnosticSkills)), "diagnostic skills equal the active Gate A skills except Balanced");
check(JSON.stringify(sorted(sourceValidSkills)) === JSON.stringify(sorted(semanticRules.cycleCompletionSkills)), "cycle completion skills include every active learner-selected focus");
check(JSON.stringify(sorted(sourceValidSkills)) === JSON.stringify(sorted(schema.$defs.attributes.properties.skill.enum)), "schema skill values equal the active Gate A vocabulary");
check(JSON.stringify(sorted(sourceSetValues("DIAGNOSTIC_TERMINAL_STATES"))) === JSON.stringify(sorted(schema.$defs.attributes.properties.terminalStatus.enum)), "diagnostic terminal states match the active Gate A vocabulary exactly");
check(JSON.stringify(sourceSetValues("DIAGNOSTIC_QUALITY_FLAGS")) === JSON.stringify(semanticRules.qualityFlagBitOrder), "diagnostic quality-flag bit order matches the active Gate A vocabulary exactly");
check(schema.$defs.attributes.properties.qualityFlagMask.maximum === (2 ** semanticRules.qualityFlagBitOrder.length) - 1, "quality-flag mask covers exactly the registered bits");
check(JSON.stringify(sorted(Object.keys(semanticRules.diagnosticQualityFlagsBySkill))) === JSON.stringify(sorted(semanticRules.diagnosticSkills)), "every diagnostic skill has a quality-flag allowlist");
check(Object.values(semanticRules.diagnosticQualityFlagsBySkill).flat().every((flag) => semanticRules.qualityFlagBitOrder.includes(flag)), "skill-specific quality flags use only registered bit positions");
check(JSON.stringify(sorted([...new Set(Object.values(semanticRules.diagnosticQualityFlagsBySkill).flat())])) === JSON.stringify(sorted(semanticRules.qualityFlagBitOrder)), "skill-specific quality rules cover every active Gate A flag");
check(JSON.stringify(sorted(Object.keys(semanticRules.diagnosticTerminalSkillMatrix))) === JSON.stringify(sorted(schema.$defs.attributes.properties.terminalStatus.enum)), "every diagnostic terminal state has an explicit skill matrix");
const sourceResultTypes = [...new Set(journeySource.split("\n").flatMap((line) => {
  const marker = line.indexOf("resultType:");
  return marker < 0 ? [] : quotedValues(line.slice(marker));
}))];
const sourceConfidenceValues = quotedValues(journeySource.match(/const confidence = [^;]+;/)?.[0] ?? "");
check(JSON.stringify(sorted(sourceResultTypes)) === JSON.stringify(sorted(semanticRules.sourceResultTypes)), "source result types match the machine-readable event semantic registry exactly");
check(JSON.stringify(sorted(sourceConfidenceValues)) === JSON.stringify(sorted(semanticRules.diagnosticConfidenceValues)), "diagnostic confidence values match the machine-readable event semantic registry exactly");
check(JSON.stringify(sorted([...semanticRules.sourceResultTypes, ...semanticRules.derivedEventEvidenceTypes])) === JSON.stringify(sorted(schema.$defs.attributes.properties.evidenceType.enum)), "schema evidence types equal source results plus registered derived states");
check(JSON.stringify(sorted(semanticRules.diagnosticConfidenceValues)) === JSON.stringify(sorted(schema.$defs.attributes.properties.evidenceConfidence.enum)), "schema confidence values equal the active Gate A confidence registry");
const teacherModeBody = teacherContractsSource.match(/export type TeacherResponseMode\s*=([\s\S]*?);/)?.[1] ?? "";
check(JSON.stringify(sorted(quotedValues(teacherModeBody))) === JSON.stringify(sorted(schema.$defs.attributes.properties.teacherMode.enum)), "Sofia teacher modes match the active response contract exactly");
check(schema.$defs.attributes.properties.citationCount.minimum === semanticRules.supportCitationCountRange.minimum && schema.$defs.attributes.properties.citationCount.maximum === semanticRules.supportCitationCountRange.maximum, "Sofia aggregate citation count uses the registered bounded range");
check(registry.xapiProjectionRules.statementIdSource === "eventId" && registry.xapiProjectionRules.registrationSource === "context.registrationId", "draft xAPI identifiers map event and registration UUIDs explicitly");
check(registry.xapiProjectionRules.timestampSource === "occurredAt" && registry.xapiProjectionRules.storedPolicy === "lrs_assigned_never_recordedAt", "draft xAPI time mapping keeps LRS stored time authoritative");
check(registry.xapiProjectionRules.futureTimestampPolicy === "mapper_hold_or_reject_never_send_future_timestamp" && registry.xapiProjectionRules.clockSkewPolicy.includes("never_substitute_stored"), "draft xAPI mapper cannot send a future learner-device timestamp or replace it with stored time");
check(registry.xapiProjectionRules.durationEncoding === "iso8601_2004_duration_max_centisecond_precision" && registry.xapiProjectionRules.plannedDurationPolicy.includes("never_result.duration"), "draft xAPI duration mapping distinguishes observed and planned time");
check(schema.$defs.utcTimestamp.minLength === 24 && schema.$defs.utcTimestamp.maxLength === 24, "event timestamps use a fixed UTC millisecond representation");
check(registry.defaultDispatchPolicy === "disabled", "registry defaults xAPI dispatch to disabled");
check(registry.deliveryBoundary.learningEventRuntimeEnabled === false, "learning-event runtime emission remains explicitly disabled");
check(registry.deliveryBoundary.productionLrsEnabled === false, "production LRS is explicitly disabled");
check(registry.deliveryBoundary.browserMayHoldLrsCredentials === false, "browser credentials are forbidden");
check(registry.deliveryBoundary.browserMayWriteDirectlyToLrs === false, "browser-to-LRS writes are forbidden");
check(registry.deliveryBoundary.studentWorkflowMayDependSynchronouslyOnLrs === false, "student workflow cannot depend on LRS availability");

const registryTypes = registry.eventTypes.map((event) => event.eventType);
const schemaTypes = schema.properties.eventType.enum;
check(new Set(registryTypes).size === registryTypes.length, "event registry contains no duplicate event types");
check(registry.canonicalEventCount === registryTypes.length && registryTypes.length === 15, "registry contains the approved fifteen canonical events");
check(JSON.stringify([...registryTypes].sort()) === JSON.stringify([...schemaTypes].sort()), "schema and registry contain exactly the same event types");
check(registry.xapiEligibleEventCount === registry.eventTypes.filter((event) => event.xapiEligible).length, "xAPI-eligible count matches the registry");
check(!registryTypes.includes("priority_skill.confirmed"), "diagnostic completion does not double-count priority confirmation");
check(!registryTypes.includes("plan.updated"), "cycle completion does not double-count updated-plan confirmation");
check(!registryTypes.includes("recommendation.accepted") && !registryTypes.includes("recommendation.skipped"), "recommendation decision uses one canonical event");
check(typeof eventSpecs.get("learning_cycle.superseded")?.emissionGuard === "string" && eventSpecs.get("learning_cycle.superseded").emissionGuard.includes("successor"), "cycle supersession requires a committed successor and excludes reset-only paths");

for (const [eventType, attributeRules] of Object.entries(semanticRules.eventAttributeSkillAllowlist)) {
  const spec = eventSpecs.get(eventType);
  check(Boolean(spec) && hasOwn(semanticRules.eventSkillAllowlist, eventType), `${eventType}: attribute-by-skill rules belong to a skill-bearing event`);
  for (const [attribute, skills] of Object.entries(attributeRules)) {
    check([...spec.requiredAttributeKeys, ...spec.optionalAttributeKeys].includes(attribute), `${eventType}.${attribute}: skill-scoped attribute is allowed by the event`);
    check(skills.every((skill) => semanticRules.eventSkillAllowlist[eventType].includes(skill)), `${eventType}.${attribute}: attribute skill values stay within the event allowlist`);
  }
}

for (const spec of registry.eventTypes) {
  check(Array.isArray(spec.optionalContextKeys), `${spec.eventType}: optional context allowlist is explicit`);
  check(Array.isArray(spec.optionalAttributeKeys), `${spec.eventType}: optional attribute allowlist is explicit`);
  check(isPlainObject(spec.requiredAttributeValues), `${spec.eventType}: fixed attribute values are explicit`);
  check(Array.isArray(spec.allowedActivityIds) && spec.allowedActivityIds.length > 0, `${spec.eventType}: activity allowlist is explicit`);
  check(spec.allowedActivityIds.every((activityId) => activityCatalog.has(activityId)), `${spec.eventType}: every allowed activity is cataloged`);
  check(spec.allowedActivityIds.every((activityId) => activityCatalog.get(activityId)?.activityKind === spec.activityKind), `${spec.eventType}: activity catalog kind matches the event`);
  check(new Set([...spec.requiredContextKeys, ...spec.optionalContextKeys]).size === spec.requiredContextKeys.length + spec.optionalContextKeys.length, `${spec.eventType}: context allowlists contain no duplicates`);
  check(new Set([...spec.requiredAttributeKeys, ...spec.optionalAttributeKeys]).size === spec.requiredAttributeKeys.length + spec.optionalAttributeKeys.length, `${spec.eventType}: attribute allowlists contain no duplicates`);
  const carriesSkill = [...spec.requiredAttributeKeys, ...spec.optionalAttributeKeys].includes("skill");
  check(carriesSkill === hasOwn(semanticRules.eventSkillAllowlist, spec.eventType), `${spec.eventType}: skill-bearing events have one explicit skill allowlist`);
  if (carriesSkill) check(semanticRules.eventSkillAllowlist[spec.eventType].every((skill) => schema.$defs.attributes.properties.skill.enum.includes(skill)), `${spec.eventType}: allowed skills exist in the schema`);
  check(schema.$defs.activity.properties.activityKind.enum.includes(spec.activityKind), `${spec.eventType}: activity kind is registered in the schema`);
  check([...spec.requiredContextKeys, ...spec.optionalContextKeys].every((key) => hasOwn(schema.$defs.context.properties, key)), `${spec.eventType}: allowed context keys exist in the schema`);
  check([...spec.requiredAttributeKeys, ...spec.optionalAttributeKeys].every((key) => hasOwn(schema.$defs.attributes.properties, key)), `${spec.eventType}: allowed attribute keys exist in the schema`);
  check(Object.keys(spec.requiredAttributeValues).every((key) => spec.requiredAttributeKeys.includes(key)), `${spec.eventType}: fixed values apply only to required attributes`);
  if (spec.xapiEligible) {
    check(spec.xapiDraft?.mappingStatus === "provisional_not_for_production_delivery", `${spec.eventType}: xAPI mapping remains provisional`);
    const verbAllowed = /^http:\/\/adlnet\.gov\/expapi\/verbs\//.test(spec.xapiDraft?.verbId ?? "") || spec.xapiDraft?.verbId?.startsWith(`${registry.xapiNamespace}verbs/`);
    check(verbAllowed, `${spec.eventType}: verb IRI uses the approved ADL or Sufeiya namespace`);
    check(spec.xapiDraft?.activityTypeId?.startsWith(`${registry.xapiNamespace}activity-types/`), `${spec.eventType}: activity type uses the Sufeiya namespace`);
  } else {
    check(!hasOwn(spec, "xapiDraft"), `${spec.eventType}: non-eligible event has no draft xAPI mapping`);
    check(typeof spec.xapiExclusionReason === "string" && spec.xapiExclusionReason.length > 20, `${spec.eventType}: xAPI exclusion is explained`);
  }
  try {
    validateEvent(syntheticEventFor(spec, registry.eventTypes.indexOf(spec)));
    passes.push(`${spec.eventType}: generated strict event validates`);
  } catch (error) {
    failures.push(`${spec.eventType}: generated event failed with ${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
  const skillScopedShapes = hasOwn(semanticRules.eventAttributeSkillAllowlist, spec.eventType)
    ? semanticRules.eventSkillAllowlist[spec.eventType]
    : [null];
  for (const skill of skillScopedShapes) {
    const shapeLabel = skill ? `${spec.eventType}/${skill}` : spec.eventType;
    const completeShapeEvent = syntheticEventFor(spec, registry.eventTypes.indexOf(spec), true, skill);
    try {
      validateEvent(completeShapeEvent);
      passes.push(`${shapeLabel}: every semantically applicable optional field fits the strict event envelope`);
    } catch (error) {
      failures.push(`${shapeLabel}: complete-shape event (${Buffer.byteLength(JSON.stringify(completeShapeEvent), "utf8")} bytes) failed with ${error instanceof Error ? error.message : "UNKNOWN"}`);
    }
    const maximalShapeEvent = maximalShapeEventFor(spec, registry.eventTypes.indexOf(spec), skill);
    try {
      validateEvent(maximalShapeEvent);
      passes.push(`${shapeLabel}: maximum-width registered values fit the strict event envelope (${Buffer.byteLength(JSON.stringify(maximalShapeEvent), "utf8")} bytes)`);
    } catch (error) {
      failures.push(`${shapeLabel}: maximum-width event (${Buffer.byteLength(JSON.stringify(maximalShapeEvent), "utf8")} bytes) failed with ${error instanceof Error ? error.message : "UNKNOWN"}`);
    }
  }
}

check(eventSpecs.get("peer_help.preference_recorded")?.xapiEligible === false, "synthetic peer-help preference is not xAPI-eligible");
check(eventSpecs.get("learning_support.interaction_finished")?.xapiEligible === false, "Sofia support telemetry is not xAPI-eligible");
check(examples.examplesAreSynthetic === true, "all committed examples are explicitly synthetic");
for (const event of examples.events) {
  try {
    validateEvent(event);
    passes.push(`${event.eventType}: committed example validates`);
  } catch (error) {
    failures.push(`${event.eventType}: committed example failed with ${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
}

const base = withHash(examples.events[0]);
const mutateAndHash = (mutator) => {
  const event = structuredClone(base);
  mutator(event);
  return withHash(event);
};
const syntheticByType = (eventType) => {
  const index = registry.eventTypes.findIndex((spec) => spec.eventType === eventType);
  return syntheticEventFor(registry.eventTypes[index], index);
};
const startedWithWrongOutcome = syntheticByType("learning_cycle.started");
startedWithWrongOutcome.attributes.outcome = "completed";
const focusWithImpossibleDuration = syntheticByType("focus_session.ended");
focusWithImpossibleDuration.attributes.activeDurationMs = focusWithImpossibleDuration.attributes.plannedDurationMs + 1;
const supportWithoutRequest = structuredClone(examples.events.find((event) => event.eventType === "learning_support.interaction_finished"));
delete supportWithoutRequest.context.requestId;
const supportModeMismatch = structuredClone(examples.events.find((event) => event.eventType === "learning_support.interaction_finished"));
supportModeMismatch.attributes.teacherMode = "ai_grounded";
supportModeMismatch.attributes.supportOutcome = "answered";
const supportManualAnswered = structuredClone(examples.events.find((event) => event.eventType === "learning_support.interaction_finished"));
supportManualAnswered.attributes.supportOutcome = "answered";
const supportWithoutCitations = structuredClone(examples.events.find((event) => event.eventType === "learning_support.interaction_finished"));
supportWithoutCitations.attributes.citationCount = 0;
const supportInsufficientWithoutHandoff = structuredClone(examples.events.find((event) => event.eventType === "learning_support.interaction_finished"));
supportInsufficientWithoutHandoff.attributes.teacherMode = "insufficient_sources";
supportInsufficientWithoutHandoff.attributes.supportOutcome = "refused";
supportInsufficientWithoutHandoff.attributes.handoffRecommended = false;
const diagnosticWithInvalidSkill = syntheticByType("diagnostic.completed");
diagnosticWithInvalidSkill.attributes.skill = "Balanced";
const planWithBalancedSkill = syntheticByType("plan.committed");
planWithBalancedSkill.attributes.skill = "Balanced";
const terminalEvidenceMismatch = structuredClone(base);
terminalEvidenceMismatch.attributes.terminalStatus = "skipped";
const unavailableReadingTask = structuredClone(base);
unavailableReadingTask.attributes.terminalStatus = "unavailable";
unavailableReadingTask.attributes.evidenceType = "not_assessed";
const readingWithAudioQualityFlag = structuredClone(base);
readingWithAudioQualityFlag.attributes.qualityFlagMask = qualityFlagMaskFor(["audio_not_played"]);
const diagnosticActivitySkillMismatch = structuredClone(base);
diagnosticActivitySkillMismatch.attributes.skill = "Listening";
const practiceEvidenceMismatch = syntheticByType("practice_attempt.finalized");
practiceEvidenceMismatch.attributes.practiceOutcome = "needs_retry";
const practiceActivitySkillMismatch = syntheticByType("practice_attempt.finalized");
practiceActivitySkillMismatch.attributes.skill = "Listening";
const reopenedByPractice = syntheticByType("planned_task.status_changed");
reopenedByPractice.attributes.taskStatus = "reopened";
reopenedByPractice.attributes.completionSource = "practice";
const retestWithBalancedSkill = syntheticByType("retest.completed");
retestWithBalancedSkill.attributes.skill = "Balanced";
const retestActivitySkillMismatch = syntheticByType("retest.completed");
retestActivitySkillMismatch.attributes.skill = "Listening";
const retestWordCountOnObjectiveTask = syntheticByType("retest.completed");
retestWordCountOnObjectiveTask.attributes.wordCount = 20;
const cycleWithBalancedFocus = syntheticByType("learning_cycle.completed");
cycleWithBalancedFocus.attributes.skill = "Balanced";
const encodedFreeText = Buffer.from("My private essay for Sofia", "utf8").toString("base64url");

expectReject("unknown top-level metadata", mutateAndHash((event) => { event.metadata = {}; }), "SCHEMA_UNKNOWN_FIELD");
expectReject("nested email field", mutateAndHash((event) => { event.context.emailAddress = "student@example.com"; }), "SCHEMA_UNKNOWN_FIELD");
expectReject("writing content field", mutateAndHash((event) => { event.attributes.essay = "My private essay"; }), "SCHEMA_UNKNOWN_FIELD");
expectReject("audio reference field", mutateAndHash((event) => { event.attributes.audio = "https://example.com/private.mp3"; }), "SCHEMA_UNKNOWN_FIELD");
expectReject("Sofia conversation field", mutateAndHash((event) => { event.attributes.messages = ["secret Sofia question"]; }), "SCHEMA_UNKNOWN_FIELD");
expectReject("phone-shaped subject", mutateAndHash((event) => { event.subject.subjectId = "anon_13800138000abcdefghijk"; }), "SCHEMA_PATTERN");
expectReject("direct-name subject", mutateAndHash((event) => { event.subject.subjectId = "anon_PeterHuPeterHuPeterHu22"; }), "SCHEMA_PATTERN");
expectReject("email-derived hash subject", mutateAndHash((event) => { event.subject.subjectId = `sub_${createHash("sha256").update("student@example.com").digest("hex")}`; }), "SCHEMA_PATTERN");
expectReject("anonymous subject cannot use registered prefix", mutateAndHash((event) => { event.subject.subjectId = "sub_90000000-0000-4000-8000-000000000001"; }), "SUBJECT_ID_PREFIX_MISMATCH");
expectReject("registered subject cannot use anonymous prefix", mutateAndHash((event) => {
  event.subject = { subjectId: "anon_90000000-0000-4000-8000-000000000001", subjectType: "registered_account", identityAssurance: "authenticated_account", assignedBy: "sufeiya_identity_service" };
}), "SUBJECT_ID_PREFIX_MISMATCH");
expectReject("subject alias cannot reuse the event ID", mutateAndHash((event) => { event.subject.subjectId = `anon_${event.eventId}`; }), "ALIAS_COLLISION");
expectReject("distinct context records cannot share one alias", mutateAndHash((event) => { event.context.learningCycleId = event.context.diagnosticSessionId; }), "ALIAS_COLLISION");
expectReject("phone cannot hide in timestamp fractional seconds", mutateAndHash((event) => { event.occurredAt = "2026-08-10T09:00:00.13800138000Z"; }), "SCHEMA_MAX_LENGTH");
expectReject("normalized invalid calendar date", mutateAndHash((event) => { event.occurredAt = "2026-02-31T09:00:00.000Z"; }), "SCHEMA_DATE_TIME");
expectReject("email hidden in activity ID", mutateAndHash((event) => { event.activity.activityId = "student@example.com"; }), "SCHEMA_PATTERN");
expectReject("percent-encoded identifier", mutateAndHash((event) => { event.activity.activityId = "https://sufeiya.cn/activities/student%40example.com/v1"; }), "SCHEMA_PATTERN");
expectReject("base64url-encoded free text", mutateAndHash((event) => { event.activity.activityVersion = encodedFreeText; }), "FORBIDDEN_ENCODED_VALUE");
expectReject("binary payload cannot use a bounded field", mutateAndHash((event) => { event.activity.activityVersion = Buffer.alloc(96, 1).toString("base64url"); }), "SCHEMA_MAX_LENGTH");
expectReject("idempotency key must derive from event ID", mutateAndHash((event) => { event.idempotencyKey = "evt:ffffffff-ffff-4fff-8fff-ffffffffffff"; }), "IDEMPOTENCY_KEY_MISMATCH");
expectReject("uncataloged activity", mutateAndHash((event) => { event.activity.activityId = "https://sufeiya.cn/activities/diagnostic/unregistered/v1"; }), "EVENT_ACTIVITY_NOT_ALLOWED");
expectReject("activity catalog version mismatch", mutateAndHash((event) => { event.activity.activityVersion = "v2"; }), "ACTIVITY_CATALOG_MISMATCH");
expectReject("diagnostic activity and skill mismatch", withHash(diagnosticActivitySkillMismatch), "ACTIVITY_SKILL_MISMATCH");
expectReject("practice activity and skill mismatch", withHash(practiceActivitySkillMismatch), "ACTIVITY_SKILL_MISMATCH");
expectReject("retest activity and skill mismatch", withHash(retestActivitySkillMismatch), "ACTIVITY_SKILL_MISMATCH");
expectReject("objective retest cannot claim a writing word count", withHash(retestWordCountOnObjectiveTask), "EVENT_ATTRIBUTE_SKILL_MISMATCH");
expectReject("unregistered notice", mutateAndHash((event) => { event.governance.noticeVersion = "unknown-v1"; }), "UNREGISTERED_NOTICE_VERSION");
expectReject("privacy flag claims free text", mutateAndHash((event) => { event.privacy.containsFreeText = true; }), "SCHEMA_CONST");
expectReject("missing event-specific context", mutateAndHash((event) => { delete event.context.diagnosticSessionId; }), "EVENT_CONTEXT_REQUIRED");
expectReject("cross-event context field", mutateAndHash((event) => { event.context.requestId = "40000000-0000-4000-8000-000000000099"; }), "EVENT_CONTEXT_NOT_ALLOWED");
expectReject("cross-event attribute field", mutateAndHash((event) => { event.attributes.citationCount = 1; }), "EVENT_ATTRIBUTE_NOT_ALLOWED");
expectReject("fixed event semantic value", withHash(startedWithWrongOutcome), "EVENT_ATTRIBUTE_VALUE");
expectReject("focus active duration exceeds plan", withHash(focusWithImpossibleDuration), "ACTIVE_DURATION_EXCEEDS_PLAN");
expectReject("support response without request ID", withHash(supportWithoutRequest), "SUPPORT_REQUEST_ID_REQUIRED");
expectReject("support mode and outcome mismatch", withHash(supportModeMismatch), "SUPPORT_MODE_OUTCOME_MISMATCH");
expectReject("manual support cannot claim AI-style answer", withHash(supportManualAnswered), "SUPPORT_MODE_OUTCOME_MISMATCH");
expectReject("support response must retain at least one source citation", withHash(supportWithoutCitations), "SCHEMA_MINIMUM");
expectReject("insufficient-source response must retain the handoff recommendation", withHash(supportInsufficientWithoutHandoff), "SUPPORT_MODE_OUTCOME_MISMATCH");
expectReject("diagnostic completed with non-priority skill", withHash(diagnosticWithInvalidSkill), "EVENT_SKILL_INVALID");
expectReject("base plan cannot use Balanced focus", withHash(planWithBalancedSkill), "EVENT_SKILL_INVALID");
expectReject("diagnostic terminal/evidence mismatch", withHash(terminalEvidenceMismatch), "DIAGNOSTIC_TERMINAL_EVIDENCE_MISMATCH");
expectReject("only Listening diagnostic tasks can be unavailable", withHash(unavailableReadingTask), "DIAGNOSTIC_TERMINAL_SKILL_MISMATCH");
expectReject("Reading diagnostic cannot carry an audio quality flag", withHash(readingWithAudioQualityFlag), "DIAGNOSTIC_QUALITY_SKILL_MISMATCH");
expectReject("practice outcome/evidence mismatch", withHash(practiceEvidenceMismatch), "PRACTICE_OUTCOME_EVIDENCE_MISMATCH");
expectReject("planned task reopened by automated practice", withHash(reopenedByPractice), "PLANNED_TASK_REOPEN_SOURCE_INVALID");
expectReject("retest with Balanced skill", withHash(retestWithBalancedSkill), "ACTIVITY_SKILL_MISMATCH");
expectAccept("completed cycle may use learner-confirmed Balanced focus", withHash(cycleWithBalancedFocus));
expectReject("unregistered task-set digest", mutateAndHash((event) => { event.attributes.taskSetDigest = "f".repeat(64); }), "UNREGISTERED_TASK_SET_DIGEST");
expectReject("unregistered source protocol", mutateAndHash((event) => { event.source.protocolVersion = "gate_a_unknown_v1"; }), "UNREGISTERED_SOURCE_PROTOCOL");
expectReject("well-shaped release alias must belong to the release manifest", mutateAndHash((event) => { event.source.appRelease = "5065746572"; }), "UNREGISTERED_APP_RELEASE");
expectReject("full release hash exceeds the compact event contract", mutateAndHash((event) => { event.source.appRelease = "a".repeat(40); }), "SCHEMA_MAX_LENGTH");
expectReject("quality flag mask cannot set unregistered bits", mutateAndHash((event) => { event.attributes.qualityFlagMask = 2097152; }), "SCHEMA_MAXIMUM");
expectReject("invalid UUID", mutateAndHash((event) => { event.eventId = "event-not-uuid"; }), "SCHEMA_PATTERN");
expectReject("local event marked exportable", mutateAndHash((event) => { event.governance.exportEligibility = "lrs_export_approved"; }), "LOCAL_GOVERNANCE_MISMATCH");
expectReject("dispatch enabled", mutateAndHash((event) => { event.governance.xapiDispatchPolicy = "enabled"; }), "SCHEMA_CONST");
expectReject("local notice cannot authorize first-party upload", mutateAndHash((event) => {
  event.subject = { subjectId: "sub_91000000-0000-4000-8000-000000000001", subjectType: "registered_account", identityAssurance: "authenticated_account", assignedBy: "sufeiya_identity_service" };
  event.governance = {
    dataUse: "first_party_learning_record",
    noticeVersion: "gate-a-v1",
    retentionClass: "account_lifecycle",
    exportEligibility: "server_event_not_lrs_exportable",
    xapiDispatchPolicy: "disabled"
  };
}), "NOTICE_DATA_USE_MISMATCH");
expectReject("pilot without consent", mutateAndHash((event) => {
  event.subject = { subjectId: "sub_91000000-0000-4000-8000-000000000001", subjectType: "registered_account", identityAssurance: "authenticated_account", assignedBy: "sufeiya_identity_service" };
  event.governance = {
    dataUse: "consented_xapi_pilot",
    noticeVersion: "pilot-v1",
    retentionClass: "pilot_bounded",
    exportEligibility: "lrs_export_approved",
    xapiDispatchPolicy: "disabled"
  };
}), "UNREGISTERED_NOTICE_VERSION");
expectReject("oversized event", mutateAndHash((event) => { event.idempotencyKey = `evt:${"a".repeat(2100)}`; }), "EVENT_TOO_LARGE");
expectReject("prototype key", withHash(JSON.parse(JSON.stringify(base).replace('"attributes":{', '"attributes":{"__proto__":{},'))), "PROTOTYPE_KEY");
const nonPlain = structuredClone(base);
Object.setPrototypeOf(nonPlain.attributes, { inherited: true });
expectReject("non-plain object", nonPlain, "NON_PLAIN_OBJECT");
const nonFinite = structuredClone(base);
nonFinite.attributes.durationMs = Number.POSITIVE_INFINITY;
expectReject("non-finite number", nonFinite, "NON_FINITE_NUMBER");

async function runtimeFiles() {
  const targets = ["app", "components", "lib", "public", "scripts"];
  const files = [
    "package.json",
    "package-lock.json",
    ".env.example",
    "vercel.json",
    "next.config.ts",
    "proxy.ts",
    "journey.js",
    "resources.js",
    "script.js",
    "workspace.js"
  ];
  const walk = async (relative) => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (child !== "scripts/verify-learning-event-contract.mjs" && [".js", ".mjs", ".ts", ".tsx", ".json"].includes(extname(entry.name))) files.push(child);
    }
  };
  for (const target of targets) await walk(target);
  return [...new Set(files)];
}

const runtimeMarkers = [
  /(?:LRS|XAPI)_(?:ENDPOINT|URL|USERNAME|PASSWORD|API_KEY|TOKEN|SECRET)/i,
  /(?:LEARNING_EVENT|EVENT_SINK)_(?:ENDPOINT|URL|TOKEN|SECRET)/i,
  /\/xAPI\/statements/i,
  /X-Experience-API-Version/i,
  /Authorization\s*:\s*["'`]Basic/i,
  /from\s+["'][^"']*(?:tincan|xapi|learninglocker|veracity|lrs)[^"']*["']/i,
  /import\s*\([^)]*(?:tincan|xapi|learninglocker|veracity|lrs)[^)]*\)/i,
  /(?:learninglocker|tincan|xapi[-_]?client|lrs[-_]?(?:client|endpoint|credential))/i,
  /(?:xapi|lrs).{0,40}outbox|outbox.{0,40}(?:xapi|lrs)/i
];
const runtimeContractMarkers = [
  /sufeiya\.learning-event\.v1/,
  /sufeiya_learning_event_registry_v1/,
  /sufeiya-learning-event-(?:register|examples)-v1\.json/,
  /sufeiya-learning-event-v1\.schema\.json/
];
for (const path of await runtimeFiles()) {
  const source = await read(path);
  check(!runtimeMarkers.some((marker) => marker.test(source)), `${path}: contains no LRS endpoint, credential, SDK, or statement transport`);
  if (!["package.json", "package-lock.json"].includes(path)) {
    check(!runtimeContractMarkers.some((marker) => marker.test(source)), `${path}: does not wire the design-only event contract into runtime code`);
  }
}
const packageManifest = JSON.parse(await read("package.json"));
const dependencyNames = Object.keys({
  ...packageManifest.dependencies,
  ...packageManifest.devDependencies,
  ...packageManifest.optionalDependencies
});
check(!dependencyNames.some((name) => /(?:^|[-_/])(?:xapi|tincan|learninglocker|veracity|lrs)(?:$|[-_/])/i.test(name)), "package manifest contains no xAPI or LRS client dependency");
check(!/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\s*\(/.test(scriptSource), "contract verifier has no network transport");

if (failures.length) {
  console.error(`FAIL: ${failures.length} learning-event contract checks failed.`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Verified ${passes.length} learning-event contract checks.`);
console.log("PASS: xAPI-ready event design is strict and production LRS delivery remains disabled.");
