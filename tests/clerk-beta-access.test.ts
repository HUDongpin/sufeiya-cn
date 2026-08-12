import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  betaAccessContextFromHeader,
  betaAccessFromPublicMetadata,
  betaAccessFromSessionClaims,
  hasClerkInvitationTicket,
  SUFEIYA_BETA_ACCESS_METADATA_KEY,
  SUFEIYA_BETA_ACCESS_PROTOCOL,
} from "../lib/auth/beta-access";

function approvedMetadata() {
  return {
    [SUFEIYA_BETA_ACCESS_METADATA_KEY]: {
      protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL,
      status: "approved",
    },
  };
}

describe("Sufeiya invitation-only metadata", () => {
  it("admits only the exact backend-controlled protocol and approved status", () => {
    assert.deepEqual(betaAccessFromPublicMetadata(approvedMetadata()), {
      approved: true,
      context: "approved",
    });

    for (const metadata of [
      null,
      [],
      {},
      { sufeiyaBetaAccess: true },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL } },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL, status: "pending" } },
      { sufeiyaBetaAccess: { protocolVersion: "sufeiya_invite_only_beta_v0", status: "approved" } },
      { sufeiyaBetaApproved: true },
      { unsafeMetadata: approvedMetadata() },
    ]) {
      assert.deepEqual(betaAccessFromPublicMetadata(metadata), {
        approved: false,
        context: "invitation_required",
      });
    }
  });

  it("admits only the exact Clerk-signed session claim", () => {
    assert.deepEqual(betaAccessFromSessionClaims(approvedMetadata()), {
      approved: true,
      context: "approved",
    });

    for (const claims of [
      { sufeiyaBetaAccess: null },
      { sufeiyaBetaAccess: true },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL } },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL, status: "pending" } },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL, status: "revoked" } },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL, status: "approved " } },
      { sufeiyaBetaAccess: { protocolVersion: SUFEIYA_BETA_ACCESS_PROTOCOL, status: "Approved" } },
      { sufeiyaBetaAccess: { protocolVersion: "sufeiya_invite_only_beta_v0", status: "approved" } },
      { unsafeMetadata: approvedMetadata(), sufeiyaBetaAccess: null },
    ]) {
      assert.deepEqual(betaAccessFromSessionClaims(claims), {
        approved: false,
        context: "invitation_required",
      });
    }
  });

  it("reports a missing session claim as unavailable instead of silently denying", () => {
    for (const claims of [null, undefined, [], {}, { otherClaim: true }]) {
      assert.deepEqual(betaAccessFromSessionClaims(claims), {
        approved: false,
        context: "verification_unavailable",
      });
    }
  });
});

describe("Sufeiya invitation entry boundary", () => {
  it("shows the Clerk sign-up component only for one bounded ticket-shaped value", () => {
    assert.equal(hasClerkInvitationTicket("ticket_1234567890abcdef"), true);
    assert.equal(hasClerkInvitationTicket(undefined), false);
    assert.equal(hasClerkInvitationTicket(["ticket_1234567890abcdef"]), false);
    assert.equal(hasClerkInvitationTicket("short"), false);
    assert.equal(hasClerkInvitationTicket(`ticket_${"x".repeat(2_100)}`), false);
    assert.equal(hasClerkInvitationTicket("ticket_1234567890ab cdef"), false);
    assert.equal(hasClerkInvitationTicket("ticket_1234567890ab<script>"), false);
  });

  it("treats missing or spoofed internal access headers as unavailable", () => {
    assert.equal(betaAccessContextFromHeader("approved"), "approved");
    assert.equal(betaAccessContextFromHeader("invitation_required"), "invitation_required");
    assert.equal(betaAccessContextFromHeader("signed_out"), "signed_out");
    assert.equal(betaAccessContextFromHeader(null), "verification_unavailable");
    assert.equal(betaAccessContextFromHeader("owner"), "verification_unavailable");
  });
});
