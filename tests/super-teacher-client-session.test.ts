import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptySession,
  MAX_PROVISIONAL_HANDOFF_PACKETS,
  MAX_STORED_TURNS,
  parseSession,
  saveSession,
  storedSessionMatches,
  SUPER_TEACHER_CHAT_KEY,
  type LocalSession,
} from "../lib/super-teacher/client-session";
import {
  createProvisionalHandoffPacket,
  type ProvisionalHandoffEvidence,
} from "../lib/super-teacher/provisional-handoff";

function userTurn(index: number) {
  return {
    id: `user-${index}`,
    role: "user" as const,
    text: `question ${index}`,
    createdAt: `2026-08-10T00:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

const provisionalEvidence: ProvisionalHandoffEvidence = {
  cycleId: "cycle-msqhg76f-abc12",
  diagnosticSessionId: "diagnostic-msqhg76g-bcd23",
  basePlanId: "plan-msqhg76h-cde34",
  recommendationId: "recommendation-msqhg76i-def45",
  checkInId: "check-in-msqhg76j",
  reviewId: "review-msqhg76k-efg56",
  peerHelpId: "peer-help-msqhg76m-fgh67",
  peerHelpStatus: "not_needed",
  retestId: "retest-msqhg76n-ghi78",
  updatedPlanId: "plan-msqhg76p-hij89",
  sourceUpdatedAt: "2026-08-10T13:00:00.000Z",
  prioritySkill: "Writing",
  retestEvidenceStatus: "limited_single_task",
  humanConfirmationStatus: "required_not_completed",
};

function provisionalPacket(index: number) {
  return createProvisionalHandoffPacket({
    evidence: provisionalEvidence,
    sourceSnapshotSha256: String(index).padStart(64, "0"),
    createdAt: `2026-08-10T13:0${index}:00.000Z`,
  });
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

    for (const injected of [
      {
        protocolVersion: "sufeiya_super_teacher_v1",
        revision: 0,
        turns: [],
        handoffRequests: [],
        futureNetworkDispatchAuthority: true,
      },
      {
        protocolVersion: "sufeiya_super_teacher_v1",
        revision: 0,
        turns: [{ ...userTurn(1), futureAuthority: true }],
        handoffRequests: [],
      },
      {
        protocolVersion: "sufeiya_super_teacher_v1",
        revision: 0,
        turns: [],
        handoffRequests: [{
          id: "handoff-1",
          createdAt: "2026-08-10T00:01:00.000Z",
          status: "local_not_sent",
          questionPreview: "question",
          networkDispatch: "enabled",
        }],
      },
    ]) {
      const raw = JSON.stringify(injected);
      const parsed = parseSession(raw);
      assert.equal(parsed.status, "corrupt");
      assert.equal(storedSessionMatches(parsed, emptySession()), false);
      assert.equal(raw.includes("futureNetworkDispatchAuthority") || raw.includes("futureAuthority") || raw.includes("networkDispatch"), true);
    }
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

  it("normalizes legacy v1 sessions without provisional packets to an empty strict packet list", () => {
    const parsed = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 4,
      turns: [],
      handoffRequests: [],
    }));
    assert.equal(parsed.status, "valid");
    assert.deepEqual(parsed.session.provisionalHandoffPackets, []);
  });

  it("bounds valid strict packets and rejects unknown packet fields fail-closed", () => {
    const bounded = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 4,
      turns: [],
      handoffRequests: [],
      provisionalHandoffPackets: Array.from(
        { length: MAX_PROVISIONAL_HANDOFF_PACKETS + 2 },
        (_, index) => provisionalPacket(index + 1),
      ),
    }));
    assert.equal(bounded.status, "valid");
    assert.equal(bounded.session.provisionalHandoffPackets.length, MAX_PROVISIONAL_HANDOFF_PACKETS);
    assert.equal(
      bounded.session.provisionalHandoffPackets[0]?.sourceSnapshotSha256,
      String(3).padStart(64, "0"),
    );

    const injected = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 4,
      turns: [],
      handoffRequests: [],
      provisionalHandoffPackets: [{
        ...provisionalPacket(1),
        learnerFreeText: "PRIVATE_FREE_TEXT_MARKER",
      }],
    }));
    assert.equal(injected.status, "corrupt");
    assert.deepEqual(injected.session, emptySession());

    const forbiddenPacketIdentity = parseSession(JSON.stringify({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 4,
      turns: [],
      handoffRequests: [],
      provisionalHandoffPackets: [{
        ...provisionalPacket(1),
        packetId: "user_2abc123",
      }],
    }));
    assert.equal(forbiddenPacketIdentity.status, "corrupt");
    assert.deepEqual(forbiddenPacketIdentity.session, emptySession());
  });

  it("rejects preloaded packets with non-canonical public timestamps as a corrupt session", () => {
    const packet = provisionalPacket(1);
    for (const timestampField of ["createdAt", "sourceUpdatedAt"] as const) {
      const raw = JSON.stringify({
        protocolVersion: "sufeiya_super_teacher_v1",
        revision: 4,
        turns: [],
        handoffRequests: [],
        provisionalHandoffPackets: [{
          ...packet,
          [timestampField]: "2026-08-10T13:05:00.13800138000Z",
        }],
      });
      const parsed = parseSession(raw);
      assert.equal(parsed.status, "corrupt", timestampField);
      assert.deepEqual(parsed.session, emptySession());
      assert.equal(storedSessionMatches(parsed, emptySession()), false);
    }
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
      provisionalHandoffPackets: Array.from(
        { length: MAX_PROVISIONAL_HANDOFF_PACKETS + 1 },
        (_, index) => provisionalPacket(index + 1),
      ),
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
    assert.equal(
      (JSON.parse(value) as LocalSession).provisionalHandoffPackets.length,
      MAX_PROVISIONAL_HANDOFF_PACKETS,
    );
  });
});
