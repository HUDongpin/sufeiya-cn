import {
  SUPER_TEACHER_PROTOCOL,
  superTeacherResponseSchema,
  type SuperTeacherResponse,
} from "@/lib/super-teacher/contracts";

export const SUPER_TEACHER_CHAT_KEY = "sufeiya_super_teacher_v1";
export const MAX_STORED_TURNS = 12;

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
};

export type SessionReadIssue = "unsupported_version" | "corrupt" | "concurrent_change";

export type SessionReadResult = {
  status: "missing" | "valid" | SessionReadIssue;
  session: LocalSession;
};

type LocalStorageAdapter = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStoredTurn(value: unknown): value is StoredTurn {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "string") return false;
  if (value.role === "user") return typeof value.text === "string" && value.text.length <= 600;
  if (value.role !== "assistant" || !isRecord(value.response)) return false;
  return superTeacherResponseSchema.safeParse(value.response).success;
}

export function emptySession(): LocalSession {
  return {
    protocolVersion: SUPER_TEACHER_PROTOCOL,
    revision: 0,
    turns: [],
    handoffRequests: [],
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

    const handoffRequests = value.handoffRequests.filter(
      (item): item is LocalSession["handoffRequests"][number] =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.createdAt === "string" &&
        item.status === "local_not_sent" &&
        typeof item.questionPreview === "string" &&
        item.questionPreview.length <= 300,
    );
    if (handoffRequests.length !== value.handoffRequests.length) {
      return { status: "corrupt", session: emptySession() };
    }

    return {
      status: "valid",
      session: {
        protocolVersion: SUPER_TEACHER_PROTOCOL,
        revision: Number(revision),
        turns: value.turns.slice(-MAX_STORED_TURNS),
        handoffRequests: handoffRequests.slice(-3),
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
    return expected.revision === 0 && expected.turns.length === 0 && expected.handoffRequests.length === 0;
  }
  return result.status === "valid" && sessionsEqual(result.session, expected);
}
