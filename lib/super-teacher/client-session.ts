import {
  SUPER_TEACHER_PROTOCOL,
  superTeacherResponseSchema,
  type SuperTeacherResponse,
} from "@/lib/super-teacher/contracts";
import {
  createProvisionalHandoffPacket as buildProvisionalHandoffPacket,
  deriveProvisionalHandoffEvidence,
  findMatchingProvisionalHandoffPacket,
  parseProvisionalHandoffPacket,
  sha256Hex,
  type ProvisionalHandoffPacket,
} from "@/lib/super-teacher/provisional-handoff";
import {
  browserProvisionalCycleLedgerValidator,
  type ProvisionalCycleLedgerValidator,
} from "@/lib/teaching-review-demo";

export const SUPER_TEACHER_CHAT_KEY = "sufeiya_super_teacher_v1";
export const MAX_STORED_TURNS = 12;
export const MAX_PROVISIONAL_HANDOFF_PACKETS = 3;

export type UserTurn = {
  id: string;
  role: "user";
  text: string;
  createdAt: string;
};

export type AssistantTurn = {
  id: string;
  role: "assistant";
  response: SuperTeacherResponse;
  createdAt: string;
};

export type StoredTurn = UserTurn | AssistantTurn;

export type LocalSession = {
  protocolVersion: typeof SUPER_TEACHER_PROTOCOL;
  revision: number;
  turns: StoredTurn[];
  handoffRequests: Array<{
    id: string;
    createdAt: string;
    status: "local_not_sent";
    questionPreview: string;
  }>;
  provisionalHandoffPackets: ProvisionalHandoffPacket[];
};

export type SessionReadIssue = "unsupported_version" | "corrupt" | "concurrent_change";

export type SessionReadResult = {
  status: "missing" | "valid" | SessionReadIssue;
  session: LocalSession;
};

type LocalStorageAdapter = Pick<Storage, "getItem" | "setItem">;
type TransactionStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ProvisionalHandoffCommitResult =
  | { status: "created" | "existing"; packet: ProvisionalHandoffPacket; session: LocalSession }
  | { status: "workspace_not_ready"; reason: string }
  | { status: "super_teacher_concurrent_change" }
  | { status: "super_teacher_write_failed" }
  | { status: "workspace_changed_during_write" }
  | { status: "super_teacher_write_verification_failed" }
  | { status: "super_teacher_rollback_failed" }
  | { status: "storage_unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
}

function isStoredTurn(value: unknown): value is StoredTurn {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "string") return false;
  if (value.role === "user") {
    return hasExactKeys(value, ["id", "role", "text", "createdAt"]) &&
      typeof value.text === "string" && value.text.length <= 600;
  }
  if (value.role !== "assistant" || !isRecord(value.response)) return false;
  return hasExactKeys(value, ["id", "role", "response", "createdAt"]) &&
    superTeacherResponseSchema.safeParse(value.response).success;
}

function isHandoffRequest(value: unknown): value is LocalSession["handoffRequests"][number] {
  return isRecord(value) &&
    hasExactKeys(value, ["id", "createdAt", "status", "questionPreview"]) &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    value.status === "local_not_sent" &&
    typeof value.questionPreview === "string" &&
    value.questionPreview.length <= 300;
}

export function emptySession(): LocalSession {
  return {
    protocolVersion: SUPER_TEACHER_PROTOCOL,
    revision: 0,
    turns: [],
    handoffRequests: [],
    provisionalHandoffPackets: [],
  };
}

export function parseSession(raw: string | null): SessionReadResult {
  if (!raw) return { status: "missing", session: emptySession() };

  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return { status: "corrupt", session: emptySession() };
    if (value.protocolVersion !== SUPER_TEACHER_PROTOCOL) {
      return { status: "unsupported_version", session: emptySession() };
    }
    if (!hasExactKeys(
      value,
      ["protocolVersion", "turns", "handoffRequests"],
      ["revision", "provisionalHandoffPackets"],
    )) {
      return { status: "corrupt", session: emptySession() };
    }

    const revision = value.revision === undefined ? 0 : value.revision;
    if (!Number.isSafeInteger(revision) || Number(revision) < 0) {
      return { status: "corrupt", session: emptySession() };
    }
    if (!Array.isArray(value.turns) || !value.turns.every(isStoredTurn)) {
      return { status: "corrupt", session: emptySession() };
    }
    if (!Array.isArray(value.handoffRequests)) {
      return { status: "corrupt", session: emptySession() };
    }
    const packetValues = value.provisionalHandoffPackets === undefined ? [] : value.provisionalHandoffPackets;
    if (!Array.isArray(packetValues)) {
      return { status: "corrupt", session: emptySession() };
    }

    const handoffRequests = value.handoffRequests.filter(isHandoffRequest);
    if (handoffRequests.length !== value.handoffRequests.length) {
      return { status: "corrupt", session: emptySession() };
    }
    const provisionalHandoffPackets = packetValues.map(parseProvisionalHandoffPacket);
    if (provisionalHandoffPackets.some((packet) => packet === null)) {
      return { status: "corrupt", session: emptySession() };
    }

    return {
      status: "valid",
      session: {
        protocolVersion: SUPER_TEACHER_PROTOCOL,
        revision: Number(revision),
        turns: value.turns.slice(-MAX_STORED_TURNS),
        handoffRequests: handoffRequests.slice(-3),
        provisionalHandoffPackets: (provisionalHandoffPackets as ProvisionalHandoffPacket[])
          .slice(-MAX_PROVISIONAL_HANDOFF_PACKETS),
      },
    };
  } catch {
    return { status: "corrupt", session: emptySession() };
  }
}

export function readSession(storage: Pick<LocalStorageAdapter, "getItem">): SessionReadResult {
  try {
    return parseSession(storage.getItem(SUPER_TEACHER_CHAT_KEY));
  } catch {
    return { status: "corrupt", session: emptySession() };
  }
}

export function saveSession(storage: Pick<LocalStorageAdapter, "setItem">, session: LocalSession) {
  try {
    storage.setItem(
      SUPER_TEACHER_CHAT_KEY,
      JSON.stringify({
        ...session,
        turns: session.turns.slice(-MAX_STORED_TURNS),
        handoffRequests: session.handoffRequests.slice(-3),
        provisionalHandoffPackets: session.provisionalHandoffPackets.slice(-MAX_PROVISIONAL_HANDOFF_PACKETS),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function sessionsEqual(left: LocalSession, right: LocalSession) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function storedSessionMatches(result: SessionReadResult, expected: LocalSession) {
  if (result.status === "missing") {
    return expected.revision === 0 && expected.turns.length === 0 && expected.handoffRequests.length === 0 &&
      expected.provisionalHandoffPackets.length === 0;
  }
  return result.status === "valid" && sessionsEqual(result.session, expected);
}

function restoreRaw(storage: TransactionStorageAdapter, previousRaw: string | null) {
  try {
    if (previousRaw === null) storage.removeItem(SUPER_TEACHER_CHAT_KEY);
    else storage.setItem(SUPER_TEACHER_CHAT_KEY, previousRaw);
  } catch {
    // Some storage adapters can commit the byte change and then throw. Verify
    // the bytes independently before declaring rollback failure.
  }
  try {
    return storage.getItem(SUPER_TEACHER_CHAT_KEY) === previousRaw;
  } catch {
    return false;
  }
}

/**
 * Runs inside the caller's `${SUPER_TEACHER_CHAT_KEY}:write` Web Lock. It reads
 * the canonical learner namespace, but only ever writes the Sofia namespace.
 */
export async function commitProvisionalHandoffPacket({
  storage,
  expectedSession,
  cryptoProvider = globalThis.crypto,
  now = () => new Date().toISOString(),
  ledgerValidator,
}: {
  storage: TransactionStorageAdapter;
  expectedSession: LocalSession;
  cryptoProvider?: Pick<Crypto, "subtle">;
  now?: () => string;
  ledgerValidator?: ProvisionalCycleLedgerValidator | null;
}): Promise<ProvisionalHandoffCommitResult> {
  let previousSofiaRaw: string | null | undefined;
  let candidateWriteAttempted = false;
  try {
    const admissionValidator = ledgerValidator === undefined
      ? browserProvisionalCycleLedgerValidator()
      : ledgerValidator;
    const workspaceBefore = storage.getItem("sufeiya_workspace_v1");
    const projection = await deriveProvisionalHandoffEvidence(workspaceBefore, admissionValidator);
    if (projection.status !== "ready" || !workspaceBefore) {
      return {
        status: "workspace_not_ready",
        reason: projection.status === "invalid" ? projection.reason : projection.status,
      };
    }
    const sourceSnapshotSha256 = await sha256Hex(workspaceBefore, cryptoProvider);
    previousSofiaRaw = storage.getItem(SUPER_TEACHER_CHAT_KEY);
    const stored = parseSession(previousSofiaRaw);
    if (!storedSessionMatches(stored, expectedSession)) {
      return { status: "super_teacher_concurrent_change" };
    }
    const existing = findMatchingProvisionalHandoffPacket(
      expectedSession.provisionalHandoffPackets,
      projection.evidence,
      sourceSnapshotSha256,
    );
    const workspaceBeforeReturn = storage.getItem("sufeiya_workspace_v1");
    const projectionBeforeReturn = await deriveProvisionalHandoffEvidence(
      workspaceBeforeReturn,
      admissionValidator,
    );
    const workspaceAfterPreWriteValidation = storage.getItem("sufeiya_workspace_v1");
    if (workspaceBeforeReturn !== workspaceBefore ||
      workspaceAfterPreWriteValidation !== workspaceBefore ||
      !workspaceBeforeReturn ||
      await sha256Hex(workspaceBeforeReturn, cryptoProvider) !== sourceSnapshotSha256 ||
      projectionBeforeReturn.status !== "ready") {
      return { status: "workspace_changed_during_write" };
    }
    if (existing) return { status: "existing", packet: existing, session: expectedSession };

    // Timestamp generation happens only after source admission, hash/CAS, and
    // the same-snapshot idempotency check have all succeeded. The minimized
    // packet deliberately has no separately generated or source-domain ID.
    const packet = buildProvisionalHandoffPacket({
      evidence: projection.evidence,
      sourceSnapshotSha256,
      createdAt: now(),
    });
    const next: LocalSession = {
      ...expectedSession,
      revision: expectedSession.revision + 1,
      provisionalHandoffPackets: [...expectedSession.provisionalHandoffPackets, packet]
        .slice(-MAX_PROVISIONAL_HANDOFF_PACKETS),
    };
    candidateWriteAttempted = true;
    if (!saveSession(storage, next)) {
      if (!restoreRaw(storage, previousSofiaRaw)) return { status: "super_teacher_rollback_failed" };
      return { status: "super_teacher_write_failed" };
    }

    const workspaceAfter = storage.getItem("sufeiya_workspace_v1");
    const projectionAfter = await deriveProvisionalHandoffEvidence(workspaceAfter, admissionValidator);
    const workspaceAfterPostWriteValidation = storage.getItem("sufeiya_workspace_v1");
    const sourceStillCurrent = workspaceAfter === workspaceBefore &&
      workspaceAfterPostWriteValidation === workspaceBefore &&
      Boolean(workspaceAfter) &&
      await sha256Hex(workspaceAfter as string, cryptoProvider) === sourceSnapshotSha256 &&
      projectionAfter.status === "ready";
    if (!sourceStillCurrent) {
      if (!restoreRaw(storage, previousSofiaRaw)) return { status: "super_teacher_rollback_failed" };
      return { status: "workspace_changed_during_write" };
    }

    const verified = readSession(storage);
    if (verified.status !== "valid" || !sessionsEqual(verified.session, next)) {
      if (!restoreRaw(storage, previousSofiaRaw)) return { status: "super_teacher_rollback_failed" };
      return { status: "super_teacher_write_verification_failed" };
    }
    const workspaceFinal = storage.getItem("sufeiya_workspace_v1");
    const projectionFinal = await deriveProvisionalHandoffEvidence(workspaceFinal, admissionValidator);
    const workspaceAfterFinalValidation = storage.getItem("sufeiya_workspace_v1");
    if (workspaceFinal !== workspaceBefore ||
      workspaceAfterFinalValidation !== workspaceBefore ||
      !workspaceFinal ||
      await sha256Hex(workspaceFinal, cryptoProvider) !== sourceSnapshotSha256 ||
      projectionFinal.status !== "ready") {
      if (!restoreRaw(storage, previousSofiaRaw)) return { status: "super_teacher_rollback_failed" };
      return { status: "workspace_changed_during_write" };
    }
    return { status: "created", packet, session: next };
  } catch {
    if (candidateWriteAttempted && previousSofiaRaw !== undefined && !restoreRaw(storage, previousSofiaRaw)) {
      return { status: "super_teacher_rollback_failed" };
    }
    return { status: "storage_unavailable" };
  }
}
