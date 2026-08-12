(() => {
  "use strict";

  const BACKUP_PROTOCOL = "sufeiya_workspace_backup_v1";
  const WORKSPACE_NAMESPACE = "sufeiya_workspace_v1";
  const WORKSPACE_SCHEMA_VERSION = 1;
  const RESTORE_POLICY = "replace_only_no_merge";
  const CANONICALIZATION = "sufeiya_canonical_json_v1";
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_WORKSPACE_BYTES = 1024 * 1024;
  const MAX_DEPTH = 24;
  const MAX_NODES = 25_000;
  const MAX_STRING_LENGTH = 4_096;
  const HASH_PATTERN = /^[0-9a-f]{64}$/;
  const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const FORBIDDEN_IDENTITY_KEYS = new Set([
    "accountid",
    "accountidentifier",
    "clerkid",
    "clerkidentifier",
    "clerkuserid",
    "email",
    "emailaddress",
    "rawresponse",
    "userid",
  ]);
  const ENVELOPE_KEYS = Object.freeze([
    "accountBinding",
    "backupProtocol",
    "exportedAt",
    "integrity",
    "namespace",
    "networkDispatch",
    "restorePolicy",
    "schemaVersion",
    "workspace",
  ].sort());
  const INTEGRITY_KEYS = Object.freeze([
    "algorithm",
    "byteLength",
    "canonicalization",
    "learningEventCount",
    "learningEventHeadHash",
    "sha256",
  ].sort());
  const WORKSPACE_KEYS = Object.freeze([
    "checkInHistory",
    "checkIns",
    "focus",
    "journey",
    "learningEventBindings",
    "learningEvents",
    "plan",
    "planHistory",
    "practice",
    "practiceReceipts",
    "profile",
    "schemaVersion",
    "taskProgress",
    "updatedAt",
  ].sort());
  const JOURNEY_KEYS = Object.freeze([
    "activeCycle",
    "diagnostic",
    "history",
    "peerHelp",
    "planUpdate",
    "protocolVersion",
    "recommendation",
    "retest",
    "review",
    "supersededCycles",
  ].sort());
  const COUNT_LIMITS = Object.freeze({
    planHistory: 64,
    taskProgress: 2_048,
    practice: 16,
    practiceReceipts: 256,
    learningEvents: 512,
    checkIns: 366,
    checkInHistory: 256,
    focusSessions: 512,
    journeyHistory: 64,
    supersededCycles: 64,
    bindingAliases: 4_096,
  });

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const exactKeys = (value, keys) =>
    isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys);
  const exactUtc = (value) => {
    if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  };
  const canonicalJson = (value) => JSON.stringify(canonicalize(value));
  const byteLength = (value) => new TextEncoder().encode(value).byteLength;
  const sha256Hex = async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
  };
  const withinCount = (value, maximum) => Array.isArray(value) && value.length <= maximum;
  const recordWithinCount = (value, maximum) => isRecord(value) && Object.keys(value).length <= maximum;

  const scanJsonTree = (value) => {
    let nodes = 0;
    const visit = (candidate, depth) => {
      nodes += 1;
      if (nodes > MAX_NODES) return { ok: false, code: "too_many_values" };
      if (depth > MAX_DEPTH) return { ok: false, code: "too_deep" };
      if (candidate === null || typeof candidate === "boolean") return { ok: true };
      if (typeof candidate === "string") {
        if (candidate.length > MAX_STRING_LENGTH) return { ok: false, code: "string_too_long" };
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(candidate)) {
          return { ok: false, code: "invalid_control_character" };
        }
        return { ok: true };
      }
      if (typeof candidate === "number") {
        return Number.isFinite(candidate) ? { ok: true } : { ok: false, code: "invalid_number" };
      }
      if (Array.isArray(candidate)) {
        for (const child of candidate) {
          const result = visit(child, depth + 1);
          if (!result.ok) return result;
        }
        return { ok: true };
      }
      if (!isRecord(candidate)) return { ok: false, code: "unsupported_value" };
      for (const [key, child] of Object.entries(candidate)) {
        if (key.length === 0 || key.length > 240) return { ok: false, code: "invalid_key_length" };
        const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
        if (FORBIDDEN_KEYS.has(key.toLowerCase()) || FORBIDDEN_IDENTITY_KEYS.has(normalizedKey)) {
          return { ok: false, code: "forbidden_key" };
        }
        const result = visit(child, depth + 1);
        if (!result.ok) return result;
      }
      return { ok: true };
    };
    return visit(value, 0);
  };

  const workspaceCountBoundariesValid = (workspace) => {
    if (
      !withinCount(workspace.planHistory, COUNT_LIMITS.planHistory) ||
      !recordWithinCount(workspace.taskProgress, COUNT_LIMITS.taskProgress) ||
      !recordWithinCount(workspace.practice, COUNT_LIMITS.practice) ||
      !recordWithinCount(workspace.practiceReceipts, COUNT_LIMITS.practiceReceipts) ||
      !withinCount(workspace.learningEvents, COUNT_LIMITS.learningEvents) ||
      !recordWithinCount(workspace.checkIns, COUNT_LIMITS.checkIns) ||
      !withinCount(workspace.checkInHistory, COUNT_LIMITS.checkInHistory) ||
      !isRecord(workspace.focus) ||
      !withinCount(workspace.focus.sessions, COUNT_LIMITS.focusSessions) ||
      !exactKeys(workspace.journey, JOURNEY_KEYS) ||
      !withinCount(workspace.journey.history, COUNT_LIMITS.journeyHistory) ||
      !withinCount(workspace.journey.supersededCycles, COUNT_LIMITS.supersededCycles)
    ) return false;
    const bindingRecords = workspace.learningEventBindings?.records;
    if (bindingRecords === undefined || bindingRecords === null) return true;
    if (!isRecord(bindingRecords)) return false;
    let aliases = 0;
    for (const records of Object.values(bindingRecords)) {
      if (!isRecord(records)) return false;
      aliases += Object.keys(records).length;
      if (aliases > COUNT_LIMITS.bindingAliases) return false;
    }
    return true;
  };

  const buildIntegrity = async (workspace) => {
    const canonical = canonicalJson(workspace);
    const events = Array.isArray(workspace.learningEvents) ? workspace.learningEvents : [];
    return {
      algorithm: "SHA-256",
      byteLength: byteLength(canonical),
      canonicalization: CANONICALIZATION,
      learningEventCount: events.length,
      learningEventHeadHash: events.at(-1)?.eventHash || null,
      sha256: await sha256Hex(canonical),
    };
  };

  const createEnvelope = async (workspace) => {
    if (!exactKeys(workspace, WORKSPACE_KEYS) || workspace.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      return { status: "invalid_workspace", code: "workspace_shape" };
    }
    const scan = scanJsonTree(workspace);
    if (!scan.ok) return { status: "invalid_workspace", code: scan.code };
    if (!workspaceCountBoundariesValid(workspace)) {
      return { status: "invalid_workspace", code: "workspace_count_limit" };
    }
    const integrity = await buildIntegrity(workspace);
    if (integrity.byteLength > MAX_WORKSPACE_BYTES) {
      return { status: "invalid_workspace", code: "workspace_too_large" };
    }
    const envelope = {
      backupProtocol: BACKUP_PROTOCOL,
      exportedAt: new Date().toISOString(),
      namespace: WORKSPACE_NAMESPACE,
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      restorePolicy: RESTORE_POLICY,
      accountBinding: false,
      networkDispatch: "disabled",
      integrity,
      workspace: clone(workspace),
    };
    return { status: "ready", envelope };
  };

  const inspectEnvelopeText = async (text, validateWorkspace) => {
    if (typeof text !== "string") return { status: "invalid", code: "not_text" };
    const fileBytes = byteLength(text);
    if (fileBytes === 0) return { status: "invalid", code: "empty_file" };
    if (fileBytes > MAX_FILE_BYTES) return { status: "invalid", code: "file_too_large" };
    let envelope;
    try {
      envelope = JSON.parse(text);
    } catch {
      return { status: "invalid", code: "invalid_json" };
    }
    if (!exactKeys(envelope, ENVELOPE_KEYS)) return { status: "invalid", code: "envelope_shape" };
    if (
      envelope.backupProtocol !== BACKUP_PROTOCOL ||
      !exactUtc(envelope.exportedAt) ||
      Date.parse(envelope.exportedAt) > Date.now() + 5 * 60 * 1000 ||
      envelope.namespace !== WORKSPACE_NAMESPACE ||
      envelope.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
      envelope.restorePolicy !== RESTORE_POLICY ||
      envelope.accountBinding !== false ||
      envelope.networkDispatch !== "disabled" ||
      !exactKeys(envelope.integrity, INTEGRITY_KEYS) ||
      envelope.integrity.algorithm !== "SHA-256" ||
      envelope.integrity.canonicalization !== CANONICALIZATION ||
      !Number.isInteger(envelope.integrity.byteLength) ||
      envelope.integrity.byteLength < 0 ||
      !Number.isInteger(envelope.integrity.learningEventCount) ||
      envelope.integrity.learningEventCount < 0 ||
      !HASH_PATTERN.test(envelope.integrity.sha256 || "") ||
      !(envelope.integrity.learningEventHeadHash === null || HASH_PATTERN.test(envelope.integrity.learningEventHeadHash || ""))
    ) return { status: "invalid", code: "envelope_contract" };
    const workspace = envelope.workspace;
    if (!exactKeys(workspace, WORKSPACE_KEYS) || workspace.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      return { status: "invalid", code: "workspace_shape" };
    }
    const scan = scanJsonTree(workspace);
    if (!scan.ok) return { status: "invalid", code: scan.code };
    if (!workspaceCountBoundariesValid(workspace)) {
      return { status: "invalid", code: "workspace_count_limit" };
    }
    const canonical = canonicalJson(workspace);
    const workspaceBytes = byteLength(canonical);
    if (workspaceBytes > MAX_WORKSPACE_BYTES) return { status: "invalid", code: "workspace_too_large" };
    const events = workspace.learningEvents;
    const expectedHeadHash = events.at(-1)?.eventHash || null;
    if (
      envelope.integrity.byteLength !== workspaceBytes ||
      envelope.integrity.learningEventCount !== events.length ||
      envelope.integrity.learningEventHeadHash !== expectedHeadHash ||
      envelope.integrity.sha256 !== await sha256Hex(canonical)
    ) return { status: "invalid", code: "integrity_mismatch" };
    let validation;
    try {
      validation = await validateWorkspace(clone(workspace));
    } catch {
      return { status: "invalid", code: "workspace_validation_exception" };
    }
    if (!validation?.ok) {
      return { status: "invalid", code: validation?.code || "workspace_invalid" };
    }
    return {
      status: "ready",
      envelope: clone(envelope),
      workspace: clone(workspace),
      canonicalWorkspace: canonical,
      validation,
    };
  };

  const replaceWorkspaceAtomically = async ({
    storage,
    storageKey = WORKSPACE_NAMESPACE,
    candidateRaw,
    expectedCurrentRaw,
    validatePersisted,
  }) => {
    let before;
    try {
      before = storage.getItem(storageKey);
    } catch {
      return { status: "read_failed" };
    }
    if (before !== expectedCurrentRaw) return { status: "stale" };
    const rollbackIfCandidateStillOwned = () => {
      let current;
      try {
        current = storage.getItem(storageKey);
      } catch {
        return { status: "rollback_failed" };
      }
      if (current !== candidateRaw) {
        return { status: current === before ? "restore_failed" : "concurrent_write" };
      }
      try {
        if (before === null) storage.removeItem(storageKey);
        else storage.setItem(storageKey, before);
        if (storage.getItem(storageKey) !== before) return { status: "rollback_failed" };
      } catch {
        return { status: "rollback_failed" };
      }
      return { status: "restore_failed" };
    };
    try {
      storage.setItem(storageKey, candidateRaw);
    } catch {
      return rollbackIfCandidateStillOwned();
    }
    let afterWrite;
    try {
      afterWrite = storage.getItem(storageKey);
    } catch {
      return { status: "read_failed_after_write" };
    }
    if (afterWrite !== candidateRaw) {
      return { status: afterWrite === before ? "restore_failed" : "concurrent_write" };
    }
    let persistedValidation;
    try {
      persistedValidation = await validatePersisted(candidateRaw);
    } catch {
      persistedValidation = { ok: false };
    }
    let afterValidation;
    try {
      afterValidation = storage.getItem(storageKey);
    } catch {
      return { status: "read_failed_after_write" };
    }
    if (afterValidation !== candidateRaw) return { status: "concurrent_write" };
    if (!persistedValidation?.ok) return rollbackIfCandidateStillOwned();
    return { status: "restored" };
  };

  globalThis.SufeiyaWorkspaceBackup = Object.freeze({
    BACKUP_PROTOCOL,
    WORKSPACE_NAMESPACE,
    WORKSPACE_SCHEMA_VERSION,
    RESTORE_POLICY,
    MAX_FILE_BYTES,
    MAX_WORKSPACE_BYTES,
    WORKSPACE_KEYS,
    JOURNEY_KEYS,
    canonicalJson,
    sha256Hex,
    scanJsonTree,
    createEnvelope,
    inspectEnvelopeText,
    replaceWorkspaceAtomically,
  });
})();
