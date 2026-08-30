import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_READING_P0_DELETE_PHRASE,
  PUBLIC_READING_P0_EVENTS_KEY,
  PUBLIC_READING_P0_STATE_KEY,
  createReadingP0OpaqueExport,
  deleteReadingP0Data,
  inspectReadingP0Data,
} from "../lib/public-learning/reading-p0-data-boundary";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key) ?? null,
  };
}

describe("anonymous Reading P0 data boundary", () => {
  it("inspects and exports only the two opaque P0 namespaces", () => {
    const local = storage({
      [PUBLIC_READING_P0_STATE_KEY]: '{"state":true}',
      [PUBLIC_READING_P0_EVENTS_KEY]: '[{"event":true}]',
      sufeiya_workspace_v1: "preserve-workspace",
    });
    const snapshot = inspectReadingP0Data(local);
    assert.equal(snapshot.state.status, "ready");
    assert.equal(snapshot.events.status, "ready");
    const exported = createReadingP0OpaqueExport(snapshot, "2026-08-29T00:00:00.000Z");
    assert.equal(exported.networkUploadPerformed, false);
    assert.equal(JSON.stringify(exported).includes("preserve-workspace"), false);
  });

  it("requires both confirmation factors", () => {
    const local = storage({ [PUBLIC_READING_P0_STATE_KEY]: "{}" });
    assert.equal(deleteReadingP0Data(local, {
      acknowledgedPermanentLocalDeletion: false,
      typedPhrase: PUBLIC_READING_P0_DELETE_PHRASE,
    }).status, "confirmation_required");
    assert.equal(local.value(PUBLIC_READING_P0_STATE_KEY), "{}");
  });

  it("deletes and verifies only P0 while preserving unrelated namespaces", () => {
    const local = storage({
      [PUBLIC_READING_P0_STATE_KEY]: "{}",
      [PUBLIC_READING_P0_EVENTS_KEY]: "[]",
      sufeiya_workspace_v1: "preserve-workspace",
    });
    const result = deleteReadingP0Data(local, {
      acknowledgedPermanentLocalDeletion: true,
      typedPhrase: PUBLIC_READING_P0_DELETE_PHRASE,
    });
    assert.equal(result.status, "complete");
    assert.equal(result.success, true);
    assert.equal(local.value("sufeiya_workspace_v1"), "preserve-workspace");
  });

  it("reports partial instead of claiming an incomplete delete", () => {
    const values = new Map<string, string>([
      [PUBLIC_READING_P0_STATE_KEY, "{}"],
      [PUBLIC_READING_P0_EVENTS_KEY, "[]"],
    ]);
    const local = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        if (key === PUBLIC_READING_P0_STATE_KEY) values.delete(key);
      },
    };
    const result = deleteReadingP0Data(local, {
      acknowledgedPermanentLocalDeletion: true,
      typedPhrase: PUBLIC_READING_P0_DELETE_PHRASE,
    });
    assert.equal(result.status, "partial");
    assert.deepEqual(result.remaining, [PUBLIC_READING_P0_EVENTS_KEY]);
  });

  it("reports unknown when exact read-back is unavailable", () => {
    const local = {
      getItem: () => { throw new Error("blocked"); },
      removeItem: () => undefined,
    };
    const result = deleteReadingP0Data(local, {
      acknowledgedPermanentLocalDeletion: true,
      typedPhrase: PUBLIC_READING_P0_DELETE_PHRASE,
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.success, false);
  });
});
