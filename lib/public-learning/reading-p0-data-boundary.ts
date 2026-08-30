export const PUBLIC_READING_P0_STATE_KEY = "sufeiya_public_reading_p0_v1" as const;
export const PUBLIC_READING_P0_EVENTS_KEY = "sufeiya_public_learning_events_v1" as const;
export const PUBLIC_READING_P0_DELETE_PHRASE = "删除 Reading P0 本机数据" as const;
export const PUBLIC_READING_P0_WRITE_LOCK = `${PUBLIC_READING_P0_STATE_KEY}:write` as const;

export type ReadingP0LocalStorage = Pick<Storage, "getItem" | "removeItem">;
export type ReadingP0Raw =
  | Readonly<{ status: "missing"; raw: null; bytes: 0 }>
  | Readonly<{ status: "ready"; raw: string; bytes: number }>
  | Readonly<{ status: "unknown"; raw: null; bytes: null }>;

export type ReadingP0Snapshot = Readonly<{
  state: ReadingP0Raw;
  events: ReadingP0Raw;
}>;

export type ReadingP0DeleteResult = Readonly<{
  success: boolean;
  status: "complete" | "confirmation_required" | "partial" | "unknown";
  removed: readonly string[];
  remaining: readonly string[];
  unknown: readonly string[];
}>;

function readRaw(storage: ReadingP0LocalStorage, key: string): ReadingP0Raw {
  try {
    const raw = storage.getItem(key);
    return raw === null
      ? { status: "missing", raw: null, bytes: 0 }
      : { status: "ready", raw, bytes: new TextEncoder().encode(raw).byteLength };
  } catch {
    return { status: "unknown", raw: null, bytes: null };
  }
}

export function inspectReadingP0Data(storage: ReadingP0LocalStorage): ReadingP0Snapshot {
  return {
    state: readRaw(storage, PUBLIC_READING_P0_STATE_KEY),
    events: readRaw(storage, PUBLIC_READING_P0_EVENTS_KEY),
  };
}

export function createReadingP0OpaqueExport(snapshot: ReadingP0Snapshot, exportedAt: string) {
  return {
    exportVersion: "sufeiya_public_reading_p0_opaque_export_v1" as const,
    exportedAt,
    storageMode: "browser_local_not_account_bound" as const,
    state: snapshot.state,
    events: snapshot.events,
    networkUploadPerformed: false,
  };
}

export function deleteReadingP0Data(
  storage: ReadingP0LocalStorage,
  confirmation: Readonly<{
    acknowledgedPermanentLocalDeletion: boolean;
    typedPhrase: string;
  }>,
): ReadingP0DeleteResult {
  if (
    !confirmation.acknowledgedPermanentLocalDeletion
    || confirmation.typedPhrase !== PUBLIC_READING_P0_DELETE_PHRASE
  ) {
    return {
      success: false,
      status: "confirmation_required",
      removed: [],
      remaining: [PUBLIC_READING_P0_STATE_KEY, PUBLIC_READING_P0_EVENTS_KEY],
      unknown: [],
    };
  }

  const removed: string[] = [];
  const remaining: string[] = [];
  const unknown: string[] = [];
  for (const key of [PUBLIC_READING_P0_STATE_KEY, PUBLIC_READING_P0_EVENTS_KEY]) {
    try {
      storage.removeItem(key);
    } catch {
      // Exact per-key read-back below determines the reported outcome.
    }
    const after = readRaw(storage, key);
    if (after.status === "missing") removed.push(key);
    else if (after.status === "ready") remaining.push(key);
    else unknown.push(key);
  }
  const success = removed.length === 2 && remaining.length === 0 && unknown.length === 0;
  return {
    success,
    status: success ? "complete" : unknown.length > 0 ? "unknown" : "partial",
    removed,
    remaining,
    unknown,
  };
}

export function readingP0WriteLocksSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
}

export async function withReadingP0WriteLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!readingP0WriteLocksSupported()) throw new Error("reading_p0_write_lock_unavailable");
  return navigator.locks.request(PUBLIC_READING_P0_WRITE_LOCK, { mode: "exclusive" }, operation);
}
