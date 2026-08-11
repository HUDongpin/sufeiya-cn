import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptySession,
  MAX_STORED_TURNS,
  parseSession,
  saveSession,
  storedSessionMatches,
  SUPER_TEACHER_CHAT_KEY,
  type LocalSession,
} from "../lib/super-teacher/client-session";

function userTurn(index: number) {
  return {
    id: `user-${index}`,
    role: "user" as const,
    text: `question ${index}`,
    createdAt: `2026-08-10T00:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

describe("Super Teacher local session parser", () => {
  it("returns a fresh session when the namespace is missing", () => {
    const parsed = parseSession(null);
    assert.equal(parsed.status, "missing");
    assert.deepEqual(parsed.session, emptySession());
    assert.equal(storedSessionMatches(parsed, emptySession()), true);
  });

  it("keeps unknown and malformed versions read-only", () => {
    const unknown = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v2",
      revision: 1,
      turns: [],
      handoffRequests: [],
    }));
    assert.equal(unknown.status, "unsupported_version");

    const malformed = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: -1,
      turns: [],
      handoffRequests: [],
    }));
    assert.equal(malformed.status, "corrupt");
  });

  it("bounds valid turns and unsent handoff receipts during reads", () => {
    const parsed = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 9,
      turns: Array.from({ length: MAX_STORED_TURNS + 3 }, (_, index) => userTurn(index)),
      handoffRequests: Array.from({ length: 5 }, (_, index) => ({
        id: `handoff-${index}`,
        createdAt: `2026-08-10T00:01:0${index}.000Z`,
        status: "local_not_sent",
        questionPreview: `question ${index}`,
      })),
    }));
    assert.equal(parsed.status, "valid");
    assert.equal(parsed.session.turns.length, MAX_STORED_TURNS);
    assert.equal(parsed.session.turns[0]?.id, "user-3");
    assert.equal(parsed.session.handoffRequests.length, 3);
    assert.equal(parsed.session.handoffRequests[0]?.id, "handoff-2");
  });

  it("rejects response-shaped records that do not pass the response contract", () => {
    const parsed = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 1,
      turns: [{
        id: "assistant-1",
        role: "assistant",
        createdAt: "2026-08-10T00:00:00.000Z",
        response: { headline: "missing audit contract" },
      }],
      handoffRequests: [],
    }));
    assert.equal(parsed.status, "corrupt");
  });

  it("writes only the bounded session to the Sofia namespace", () => {
    let key = "";
    let value = "";
    const session: LocalSession = {
      ...emptySession(),
      revision: 3,
      turns: Array.from({ length: MAX_STORED_TURNS + 1 }, (_, index) => userTurn(index)),
      handoffRequests: [],
    };
    const saved = saveSession({
      setItem(nextKey, nextValue) {
        key = nextKey;
        value = nextValue;
      },
    }, session);
    assert.equal(saved, true);
    assert.equal(key, SUPER_TEACHER_CHAT_KEY);
    assert.equal((JSON.parse(value) as LocalSession).turns.length, MAX_STORED_TURNS);
  });
});
