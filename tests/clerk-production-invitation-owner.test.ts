import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertClerkProductionInvitationCommandLine,
  buildClerkProductionInvitationRequest,
  buildClerkProductionProviderBaselineCommitment,
  buildClerkProductionRecipientCommitment,
  CLERK_PRODUCTION_INVITATION_CREATE_ACK,
  CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION,
  CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA,
  CLERK_PRODUCTION_INVITATION_DEPLOYMENT_ID,
  CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS,
  CLERK_PRODUCTION_INVITATION_RECEIPT_CHECKS,
  CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT,
  type ClerkProductionInvitationAttemptMarker,
  type ClerkProductionProviderCounts,
  getClerkProductionInvitationOwnerInput,
  getClerkProductionInvitationOwnerPublicInput,
  runClerkProductionInvitationOwner,
} from "../scripts/clerk-production-invitation-contract";
import {
  assertClerkProductionInvitationLocalState,
  assertClerkProductionInvitationStatusAttempt,
  assertClerkProductionGithubDeploymentBinding,
  persistClerkProductionInvitationAttempt,
  writeClerkProductionJsonNoClobber,
} from "../scripts/clerk-production-invitation";

const sourceGitSha = "a".repeat(40);
const deploymentGitSha = CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA;
const deploymentId = CLERK_PRODUCTION_INVITATION_DEPLOYMENT_ID;
const authorizationRunId = "123e4567-e89b-42d3-a456-426614174000";
const recipientEmail = "owner-approved@real-recipient.org";
const secretKey = `sk_live_${"A".repeat(40)}`;
const emptyProviderCounts = {
  invitations: { accepted: 0, expired: 0, pending: 0, revoked: 0 },
  users: 0,
} as const;
const emptyProviderBaselineCommitment =
  buildClerkProductionProviderBaselineCommitment(emptyProviderCounts);
const recipientCommitment = buildClerkProductionRecipientCommitment({
  authorizationRunId,
  recipientEmail,
  secretKey,
});

const source = { clean: true, gitSha: sourceGitSha } as const;
const commonEnvironment = {
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId,
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: deploymentGitSha,
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: deploymentId,
  SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION:
    CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION,
} as const;

const approvedMetadata = {
  sufeiyaBetaAccess: {
    protocolVersion: "sufeiya_invite_only_beta_v1",
    status: "approved",
  },
} as const;

type InvitationStatus = "accepted" | "expired" | "pending" | "revoked";

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: Date.parse("2026-08-28T08:00:00.000Z"),
    emailAddress: recipientEmail,
    id: "inv_production123",
    publicMetadata: approvedMetadata,
    revoked: false,
    status: "pending" as InvitationStatus,
    updatedAt: Date.parse("2026-08-28T08:00:00.000Z"),
    url: "https://clerk.sufeiya.cn/v1/tickets/accept?ticket=secret-ticket-value",
    ...overrides,
  };
}

function ownerInput(
  mode: "execute" | "preflight" | "status",
  environment: Record<string, string | undefined> = {},
) {
  const publicInput = getClerkProductionInvitationOwnerPublicInput(
    source,
    mode,
    true,
    {
      ...commonEnvironment,
      ...(mode === "execute"
        ? {
          SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA: sourceGitSha,
          SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK:
            CLERK_PRODUCTION_INVITATION_CREATE_ACK,
          SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT:
            emptyProviderBaselineCommitment,
          SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT:
            recipientCommitment,
        }
        : {}),
      ...environment,
    },
  );
  return getClerkProductionInvitationOwnerInput(
    publicInput,
    { recipientEmail, secretKey },
  );
}

function fakeDependencies(options: {
  createError?: Error;
  createResponse?: ReturnType<typeof invitation>;
  invitations?: Partial<
    Record<InvitationStatus, ReadonlyArray<ReturnType<typeof invitation>>>
  >;
  users?: ReadonlyArray<{
    emailAddresses: ReadonlyArray<{ emailAddress: string }>;
    id: string;
    publicMetadata: unknown;
  }>;
  onCreationReceipt?: (receipt: unknown) => void;
  onPostObservation?: (receipt: unknown) => void;
  onAttempt?: (marker: unknown) => void;
  postCreateInvitation?: ReturnType<typeof invitation> | null;
  postCreateUsers?: ReadonlyArray<{
    emailAddresses: ReadonlyArray<{ emailAddress: string }>;
    id: string;
    publicMetadata: unknown;
  }>;
  statusAttemptValid?: boolean;
  providerCounts?: ClerkProductionProviderCounts;
  postProviderCounts?: ClerkProductionProviderCounts;
} = {}) {
  const events: string[] = [];
  let createCalls = 0;
  let invitationReads = 0;
  let createdInvitation: ReturnType<typeof invitation> | null = null;
  const requests: unknown[] = [];
  let statusAttemptChecks = 0;
  const invitations = options.invitations ?? {};
  const providerCounts = options.providerCounts ?? {
    invitations: {
      accepted: invitations.accepted?.length ?? 0,
      expired: invitations.expired?.length ?? 0,
      pending: invitations.pending?.length ?? 0,
      revoked: invitations.revoked?.length ?? 0,
    },
    users: options.users?.length ?? 0,
  };
  const postCounts = () => {
    if (options.postProviderCounts) return options.postProviderCounts;
    const visibleCreatedInvitation = Object.hasOwn(options, "postCreateInvitation")
      ? options.postCreateInvitation ?? null
      : createdInvitation;
    const next = {
      invitations: { ...providerCounts.invitations },
      users: providerCounts.users,
    };
    if (visibleCreatedInvitation) {
      next.invitations[visibleCreatedInvitation.status] += 1;
      if (visibleCreatedInvitation.status === "accepted") next.users += 1;
    }
    return next;
  };
  return {
    dependencies: {
      assertStatusAttempt: async () => {
        statusAttemptChecks += 1;
        if (options.statusAttemptValid === false) {
          throw new Error("status marker mismatch sentinel");
        }
      },
      createInvitation: async (request: unknown) => {
        events.push("create");
        createCalls += 1;
        requests.push(request);
        if (options.createError) throw options.createError;
        createdInvitation = options.createResponse ?? invitation();
        return createdInvitation;
      },
      now: () => new Date("2026-08-28T08:00:00.000Z"),
      persistAttempt: async (marker: unknown) => {
        events.push("attempt");
        options.onAttempt?.(marker);
      },
      persistCreationReceipt: async (receipt: unknown) => {
        events.push("creation-receipt");
        options.onCreationReceipt?.(receipt);
      },
      persistPostObservation: async (receipt: unknown) => {
        events.push("post-observation");
        options.onPostObservation?.(receipt);
      },
      readDeploymentBinding: async () => undefined,
      readDomains: async () => ({
        data: [{
          frontendApiUrl: "https://clerk.sufeiya.cn",
          isSatellite: false,
          name: "sufeiya.cn",
        }],
      }),
      readInstance: async () => ({
        environmentType: "production",
        instanceBindingCommitment: CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT,
      }),
      readInvitations: async ({ limit, offset, status }: {
        limit: number;
        offset: number;
        query: string;
        status: InvitationStatus;
      }) => {
        invitationReads += 1;
        const data = [...(invitations[status] ?? [])];
        const visibleCreatedInvitation = createCalls === 0
          ? null
          : Object.hasOwn(options, "postCreateInvitation")
            ? options.postCreateInvitation ?? null
            : createdInvitation;
        if (
          visibleCreatedInvitation?.status === status
          && !data.some((candidate) => candidate.id === visibleCreatedInvitation?.id)
        ) data.push(visibleCreatedInvitation);
        return { data: data.slice(offset, offset + limit), totalCount: data.length };
      },
      readGlobalInvitationCount: async (status: InvitationStatus) => (
        createCalls > 0
          ? postCounts().invitations[status]
          : providerCounts.invitations[status]
      ),
      readGlobalUserCount: async () => (
        createCalls > 0 ? postCounts().users : providerCounts.users
      ),
      readPublicEnvironment: async () => undefined,
      readUsers: async ({ limit, offset }: { emailAddress: string[]; limit: number; offset: number }) => {
        const data = createCalls > 0 && options.postCreateUsers
          ? options.postCreateUsers
          : options.users ?? [];
        return { data: data.slice(offset, offset + limit), totalCount: data.length };
      },
    },
    events,
    getCreateCalls: () => createCalls,
    getInvitationReads: () => invitationReads,
    getRequests: () => requests,
    getStatusAttemptChecks: () => statusAttemptChecks,
  };
}

describe("Clerk Production invitation Owner input", () => {
  test("accepts only the exact read-only, execute, and status contracts", () => {
    assert.equal(ownerInput("preflight").mode, "preflight");
    assert.equal(ownerInput("execute").mode, "execute");
    assert.equal(ownerInput("status").mode, "status");

    assert.equal(
      assertClerkProductionInvitationCommandLine(["node", "script", "preflight"]),
      "preflight",
    );
    assert.equal(
      assertClerkProductionInvitationCommandLine(["node", "script", "execute"]),
      "execute",
    );
    assert.equal(
      assertClerkProductionInvitationCommandLine(["node", "script", "status"]),
      "status",
    );
    assert.throws(
      () => assertClerkProductionInvitationCommandLine(["node", "script", "execute", "--force"]),
      /exact direct command/,
    );
  });

  test("fails before provider access on malformed, synthetic, dirty, or ambient input", () => {
    for (const [candidateSource, mode, environment, interactive] of [
      [{ ...source, clean: false }, "preflight", commonEnvironment, true],
      [source, "preflight", {
        SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId,
        SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: deploymentGitSha,
        SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: deploymentId,
      }, true],
      [source, "preflight", { ...commonEnvironment, CLERK_SECRET_KEY: "ambient-secret" }, true],
      [source, "preflight", {
        ...commonEnvironment,
        SUFEIYA_CLERK_PRODUCTION_INVITATION_RECIPIENT_EMAIL: "ambient@example.invalid",
      }, true],
      [source, "execute", {
        ...commonEnvironment,
        SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId,
      }, true],
      [source, "execute", {
        ...commonEnvironment,
        SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId.toUpperCase(),
        SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK:
          CLERK_PRODUCTION_INVITATION_CREATE_ACK,
      }, true],
      [source, "execute", {
        ...commonEnvironment,
        SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId,
        SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK:
          CLERK_PRODUCTION_INVITATION_CREATE_ACK,
      }, false],
      [source, "preflight", { ...commonEnvironment, HTTPS_PROXY: "https://proxy.invalid" }, true],
      [source, "preflight", { ...commonEnvironment, https_proxy: "https://proxy.invalid" }, true],
      [source, "preflight", { ...commonEnvironment, NODE_OPTIONS: "--inspect" }, true],
      [source, "preflight", { ...commonEnvironment, SSL_CERT_FILE: "/tmp/cert" }, true],
      [source, "preflight", { ...commonEnvironment, TSX_TSCONFIG_PATH: "/tmp/config" }, true],
      [source, "preflight", { ...commonEnvironment, CLERK_API_URL: "https://evil.invalid" }, true],
    ] as const) {
      assert.throws(
        () => getClerkProductionInvitationOwnerPublicInput(
          candidateSource,
          mode,
          interactive,
          environment,
        ),
        /Production invitation Owner command refused/,
      );
    }

    const validPublicInput = getClerkProductionInvitationOwnerPublicInput(
      source,
      "preflight",
      true,
      commonEnvironment,
    );
    for (const sensitiveInput of [
      { recipientEmail, secretKey: "sk_test_wrong" },
      { recipientEmail: "synthetic+clerk_test@example.com", secretKey },
      { recipientEmail: "Upper@real-recipient.org", secretKey },
      { recipientEmail: "person@sub.example.com", secretKey },
      { recipientEmail: "person@foo.example", secretKey },
      { recipientEmail: "person@company.local", secretKey },
      { recipientEmail: "person@foo.localhost", secretKey },
      { recipientEmail: "person@sub.clerk.dev", secretKey },
    ]) {
      assert.throws(
        () => getClerkProductionInvitationOwnerInput(validPublicInput, sensitiveInput),
        /Production invitation Owner command refused/,
      );
    }
  });

  test("preflight rejects execute state and status requires the run ID", () => {
    assert.throws(() => ownerInput("preflight", {
      SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK:
        CLERK_PRODUCTION_INVITATION_CREATE_ACK,
    }));
    assert.throws(() => getClerkProductionInvitationOwnerPublicInput(
      source,
      "status",
      true,
      {
        SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: deploymentGitSha,
        SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: deploymentId,
        SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION:
          CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION,
      },
    ));
    assert.throws(() => ownerInput("execute", {
      SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT: "f".repeat(63),
    }));
    assert.throws(() => ownerInput("execute", {
      SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT: "f".repeat(64),
    }));
    assert.throws(() => ownerInput("execute", {
      SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA: "f".repeat(40),
    }));
  });

  test("binds execute to the exact preflight recipient commitment", () => {
    const publicInput = getClerkProductionInvitationOwnerPublicInput(
      source,
      "execute",
      true,
      {
        ...commonEnvironment,
        SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK:
          CLERK_PRODUCTION_INVITATION_CREATE_ACK,
        SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA: sourceGitSha,
        SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT:
          emptyProviderBaselineCommitment,
        SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT: recipientCommitment,
      },
    );
    assert.throws(() => getClerkProductionInvitationOwnerInput(
      publicInput,
      {
        recipientEmail: "different-real-person@real-recipient.org",
        secretKey,
      },
    ));
  });
});

describe("Clerk Production invitation exact request", () => {
  test("freezes email delivery, expiry, metadata, canonical redirect, and duplicate guard", () => {
    assert.deepEqual(buildClerkProductionInvitationRequest(recipientEmail), {
      emailAddress: recipientEmail,
      expiresInDays: CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS,
      ignoreExisting: false,
      notify: true,
      publicMetadata: approvedMetadata,
      redirectUrl: "https://sufeiya.cn/sign-up",
      templateSlug: "invitation",
    });
  });
});

describe("Clerk Production invitation Owner flow", () => {
  test("preflight is read-only and does not persist local artifacts", async () => {
    const fake = fakeDependencies();
    const result = await runClerkProductionInvitationOwner(
      ownerInput("preflight"),
      fake.dependencies,
    );
    assert.deepEqual(result, {
      helperSourceGitSha: sourceGitSha,
      mode: "preflight",
      providerBaselineCommitment: emptyProviderBaselineCommitment,
      recipientCommitment,
      status: "ready",
    });
    assert.equal(fake.getCreateCalls(), 0);
    assert.deepEqual(fake.events, []);
  });

  test("fails before the marker and POST when an exact user or any invitation history exists", async () => {
    for (const options of [
      {
        users: [{
          emailAddresses: [{ emailAddress: recipientEmail }],
          id: "user_production123",
          publicMetadata: approvedMetadata,
        }],
      },
      { invitations: { accepted: [invitation({ status: "accepted" })] } },
      { invitations: { expired: [invitation({ status: "expired" })] } },
      { invitations: { pending: [invitation()] } },
      { invitations: { revoked: [invitation({ status: "revoked", revoked: true })] } },
    ] as const) {
      const fake = fakeDependencies(options);
      await assert.rejects(
        runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
        /exact recipient baseline/,
      );
      assert.equal(fake.getCreateCalls(), 0);
      assert.deepEqual(fake.events, []);
    }
  });

  test("requires the Owner-approved global provider baseline before the shared seal", async () => {
    const fake = fakeDependencies({
      providerCounts: {
        invitations: { accepted: 0, expired: 0, pending: 0, revoked: 0 },
        users: 5,
      },
    });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /exact recipient baseline/,
    );
    assert.equal(fake.getCreateCalls(), 0);
    assert.deepEqual(fake.events, []);
  });

  test("paginates and exact-filters provider query results", async () => {
    const fuzzy = Array.from({ length: 100 }, (_, index) => invitation({
      emailAddress: `other-${index}@real-recipient.org`,
      id: `inv_fuzzy_${index}`,
    }));
    const fake = fakeDependencies({
      invitations: { pending: [...fuzzy, invitation()] },
    });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /exact recipient baseline/,
    );
    assert.ok(fake.getInvitationReads() >= 5);
    assert.equal(fake.getCreateCalls(), 0);
  });

  test("writes the attempt before one POST and persists only a redacted receipt", async () => {
    let creationReceipt: unknown;
    let postObservation: unknown;
    let marker: unknown;
    const fake = fakeDependencies({
      createResponse: invitation(),
      onAttempt: (value) => { marker = value; },
      onCreationReceipt: (value) => { creationReceipt = value; },
      onPostObservation: (value) => { postObservation = value; },
    });
    const result = await runClerkProductionInvitationOwner(
      ownerInput("execute"),
      fake.dependencies,
    );
    assert.equal(result.mode, "execute");
    assert.equal(result.status, "pending");
    assert.equal(fake.getCreateCalls(), 1);
    assert.deepEqual(fake.getRequests(), [
      buildClerkProductionInvitationRequest(recipientEmail),
    ]);
    assert.deepEqual(fake.events, [
      "attempt",
      "create",
      "creation-receipt",
      "post-observation",
    ]);
    const serialized = JSON.stringify(creationReceipt);
    assert.equal(serialized.includes(recipientEmail), false);
    assert.equal(serialized.includes(secretKey), false);
    assert.equal(serialized.includes("secret-ticket-value"), false);
    assert.equal(serialized.includes("/v1/tickets/accept"), false);
    assert.match(serialized, /invitationCommitment/);
    assert.match(serialized, /email_delivery_requested/);
    assert.match(serialized, /createResponseStatus/);
    assert.equal(serialized.includes('"status":"pending"'), false);
    assert.deepEqual(Object.keys(creationReceipt as Record<string, unknown>).sort(), [
      "acknowledgedAt",
      "authorizationRunId",
      "checks",
      "createResponseStatus",
      "declaredVercelDeploymentGitSha",
      "declaredVercelDeploymentId",
      "emailDeliveryRequested",
      "helperSourceGitSha",
      "instanceCommitment",
      "instanceCommitmentProtocol",
      "invitationCommitment",
      "invitationCommitmentProtocol",
      "outcome",
      "protocolVersion",
      "providerBaselineCommitment",
      "recipientCommitment",
      "requestedExpiresInDays",
      "startedAt",
    ]);
    assert.deepEqual(
      Object.keys(
        (creationReceipt as { checks: Record<string, unknown> }).checks,
      ).sort(),
      [...CLERK_PRODUCTION_INVITATION_RECEIPT_CHECKS].sort(),
    );
    assert.match(JSON.stringify(postObservation), /pending_confirmed/);
    const serializedMarker = JSON.stringify(marker);
    assert.equal(serializedMarker.includes(recipientEmail), false);
    assert.equal(serializedMarker.includes(secretKey), false);
    assert.match(serializedMarker, /recipientCommitment/);
    assert.deepEqual(Object.keys(marker as Record<string, unknown>).sort(), [
      "authorizationRunId",
      "contractExpiresInDays",
      "declaredVercelDeploymentGitSha",
      "declaredVercelDeploymentId",
      "helperSourceGitSha",
      "instanceCommitment",
      "protocolVersion",
      "providerBaselineCommitment",
      "recipientCommitment",
      "startedAt",
    ]);
  });

  test("keeps an acknowledged creation receipt when list readback omits the optional URL", async () => {
    let creationReceipt: unknown;
    let postObservation: unknown;
    const fake = fakeDependencies({
      onCreationReceipt: (value) => { creationReceipt = value; },
      onPostObservation: (value) => { postObservation = value; },
      postCreateInvitation: invitation({ url: undefined }),
    });
    const result = await runClerkProductionInvitationOwner(
      ownerInput("execute"),
      fake.dependencies,
    );
    assert.equal(result.status, "pending");
    assert.match(JSON.stringify(creationReceipt), /createResponseStatus/);
    assert.match(JSON.stringify(postObservation), /pending_confirmed/);
    assert.equal(fake.getCreateCalls(), 1);
  });

  test("preserves response-bound commitments if the invitation is accepted before readback", async () => {
    let creationReceipt: unknown;
    let postObservation: unknown;
    const fake = fakeDependencies({
      onCreationReceipt: (value) => { creationReceipt = value; },
      onPostObservation: (value) => { postObservation = value; },
      postCreateInvitation: invitation({ status: "accepted", url: undefined }),
      postCreateUsers: [{
        emailAddresses: [{ emailAddress: recipientEmail }],
        id: "user_production123",
        publicMetadata: approvedMetadata,
      }],
    });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /provider post-state is not the approved pending handoff/,
    );
    assert.match(JSON.stringify(creationReceipt), /createResponseStatus/);
    const serializedObservation = JSON.stringify(postObservation);
    assert.match(serializedObservation, /accepted_observed/);
    assert.match(serializedObservation, /invitationCommitment/);
    assert.equal(serializedObservation.includes(recipientEmail), false);
  });

  test("persists the create acknowledgement but refuses concurrent global post-state drift", async () => {
    let creationReceipt: unknown;
    let postObservation: unknown;
    const fake = fakeDependencies({
      onCreationReceipt: (value) => { creationReceipt = value; },
      onPostObservation: (value) => { postObservation = value; },
      postProviderCounts: {
        invitations: { accepted: 0, expired: 0, pending: 2, revoked: 0 },
        users: 0,
      },
    });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /provider post-state is not the approved pending handoff/,
    );
    assert.match(JSON.stringify(creationReceipt), /createResponseStatus/);
    assert.match(JSON.stringify(postObservation), /unavailable_or_inconsistent/);
    assert.equal(fake.getCreateCalls(), 1);
    assert.deepEqual(fake.events, [
      "attempt",
      "create",
      "creation-receipt",
      "post-observation",
    ]);
  });

  test("never retries or writes a success receipt after response loss", async () => {
    const fake = fakeDependencies({ createError: new Error(`secret ${recipientEmail} ${secretKey}`) });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /outcome is unknown/,
    );
    assert.equal(fake.getCreateCalls(), 1);
    assert.deepEqual(fake.events, ["attempt", "create"]);
  });

  test("leaves an unknown outcome and marker without a second POST or receipt", async () => {
    const fake = fakeDependencies({ createError: new Error(`secret ${recipientEmail} ${secretKey}`) });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
      /outcome is unknown/,
    );
    assert.equal(fake.getCreateCalls(), 1);
    assert.deepEqual(fake.events, ["attempt", "create"]);
  });

  test("rejects malformed provider responses without exposing ticket-bearing values", async () => {
    for (const response of [
      invitation({ emailAddress: "other@real-recipient.org" }),
      invitation({ publicMetadata: {} }),
      invitation({ status: "accepted" }),
      invitation({ url: "https://clerk.sufeiya.cn/v1/tickets/accept?ticket=one&ticket=two" }),
      invitation({ url: "https://evil.invalid/v1/tickets/accept?ticket=one" }),
    ]) {
      const fake = fakeDependencies({ createResponse: response });
      await assert.rejects(
        runClerkProductionInvitationOwner(ownerInput("execute"), fake.dependencies),
        /response boundary/,
      );
      assert.equal(fake.getCreateCalls(), 1);
      assert.deepEqual(fake.events, ["attempt", "create"]);
    }
  });

  test("status is read-only and reports only the exact provider state", async () => {
    const fake = fakeDependencies({
      invitations: { accepted: [invitation({ status: "accepted" })] },
      users: [{
        emailAddresses: [{ emailAddress: recipientEmail }],
        id: "user_production123",
        publicMetadata: approvedMetadata,
      }],
    });
    const result = await runClerkProductionInvitationOwner(
      ownerInput("status"),
      fake.dependencies,
    );
    assert.deepEqual(result, {
      exactInvitationCount: 1,
      exactUserCount: 1,
      mode: "status",
      providerStateCommitment: buildClerkProductionProviderBaselineCommitment({
        invitations: { accepted: 1, expired: 0, pending: 0, revoked: 0 },
        users: 1,
      }),
      status: "accepted_resource_compatible",
    });
    assert.equal(fake.getCreateCalls(), 0);
    assert.deepEqual(fake.events, []);
    assert.equal(fake.getStatusAttemptChecks(), 1);
  });

  test("status refuses a missing or mismatched run marker before provider reads", async () => {
    const fake = fakeDependencies({ statusAttemptValid: false });
    await assert.rejects(
      runClerkProductionInvitationOwner(ownerInput("status"), fake.dependencies),
      /status marker mismatch sentinel/,
    );
    assert.equal(fake.getInvitationReads(), 0);
    assert.equal(fake.getCreateCalls(), 0);
  });

  test("status validates pending metadata and acceptance URL before reporting compatibility", async () => {
    const compatible = fakeDependencies({ invitations: { pending: [invitation()] } });
    assert.deepEqual(
      await runClerkProductionInvitationOwner(ownerInput("status"), compatible.dependencies),
      {
        exactInvitationCount: 1,
        exactUserCount: 0,
        mode: "status",
        providerStateCommitment: buildClerkProductionProviderBaselineCommitment({
          invitations: { accepted: 0, expired: 0, pending: 1, revoked: 0 },
          users: 0,
        }),
        status: "pending_resource_compatible",
      },
    );
    for (const candidate of [
      invitation({ publicMetadata: {} }),
      invitation({ url: "https://evil.invalid/v1/tickets/accept?ticket=secret-ticket-value" }),
    ]) {
      const incompatible = fakeDependencies({ invitations: { pending: [candidate] } });
      await assert.rejects(
        runClerkProductionInvitationOwner(ownerInput("status"), incompatible.dependencies),
        /boundary/,
      );
      assert.equal(incompatible.getCreateCalls(), 0);
    }
  });

  test("status fails closed on inconsistent invitation and user combinations", async () => {
    for (const options of [
      {
        invitations: { pending: [invitation()] },
        users: [{
          emailAddresses: [{ emailAddress: recipientEmail }],
          id: "user_production123",
          publicMetadata: approvedMetadata,
        }],
      },
      { invitations: { accepted: [invitation({ status: "accepted" })] } },
      {
        invitations: { accepted: [invitation({ status: "accepted" })] },
        users: [{
          emailAddresses: [{ emailAddress: recipientEmail }],
          id: "user_production123",
          publicMetadata: {},
        }],
      },
      {
        users: [{
          emailAddresses: [{ emailAddress: recipientEmail }],
          id: "user_production123",
          publicMetadata: approvedMetadata,
        }],
      },
    ] as const) {
      const fake = fakeDependencies(options);
      const result = await runClerkProductionInvitationOwner(
        ownerInput("status"),
        fake.dependencies,
      );
      assert.equal(result.status, "inconsistent");
    }
  });
});

describe("Clerk Production invitation local persistence boundary", () => {
  test("accepts only the frozen latest successful GitHub Production deployment", () => {
    const deployment = [{
      environment: "Production",
      id: 6_090_377_343,
      sha: deploymentGitSha,
      statuses_url:
        "https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments/6090377343/statuses",
    }];
    const status = [{
      environment: "Production",
      environment_url:
        "https://sufeiya-k5kgdj3yi-peter-dongpin-hu-s-projects.vercel.app",
      id: 17_321_852_530,
      state: "success",
      target_url:
        "https://sufeiya-k5kgdj3yi-peter-dongpin-hu-s-projects.vercel.app",
    }];
    assert.doesNotThrow(() => assertClerkProductionGithubDeploymentBinding(
      deployment,
      status,
    ));
    assert.throws(() => assertClerkProductionGithubDeploymentBinding(
      [{ ...deployment[0], sha: "f".repeat(40) }],
      status,
    ));
    assert.throws(() => assertClerkProductionGithubDeploymentBinding(
      deployment,
      [{ ...status[0], state: "pending" }],
    ));
    assert.doesNotThrow(() => assertClerkProductionGithubDeploymentBinding(
      deployment[0],
      status[0],
      false,
    ));
  });

  test("uses one shared canonical seal for no-clobber and status HMAC binding", async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "sufeiya-clerk-owner-state-"));
    context.after(async () => rm(temporaryRoot, { force: true, recursive: true }));
    const stateRoot = join(temporaryRoot, "owner-state");
    const marker: ClerkProductionInvitationAttemptMarker = {
      authorizationRunId,
      contractExpiresInDays: 7 as const,
      declaredVercelDeploymentGitSha: deploymentGitSha,
      declaredVercelDeploymentId: deploymentId,
      helperSourceGitSha: sourceGitSha,
      instanceCommitment: CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT,
      protocolVersion: "sufeiya_clerk_production_invitation_attempt_v1" as const,
      providerBaselineCommitment: emptyProviderBaselineCommitment,
      recipientCommitment,
      startedAt: "2026-08-28T08:00:00.000Z",
    };

    await assertClerkProductionInvitationLocalState("preflight", stateRoot);
    await persistClerkProductionInvitationAttempt(marker, stateRoot, temporaryRoot);
    await assertClerkProductionInvitationLocalState("status", stateRoot);
    await assertClerkProductionInvitationStatusAttempt(ownerInput("status"), stateRoot);
    await assert.rejects(
      assertClerkProductionInvitationLocalState("execute", stateRoot),
      /already sealed/,
    );
    await assert.rejects(
      persistClerkProductionInvitationAttempt(marker, stateRoot, temporaryRoot),
      (error: NodeJS.ErrnoException) => error.code === "EEXIST",
    );

    const statusPublicInput = getClerkProductionInvitationOwnerPublicInput(
      source,
      "status",
      true,
      commonEnvironment,
    );
    const wrongRecipientInput = getClerkProductionInvitationOwnerInput(
      statusPublicInput,
      {
        recipientEmail: "different-real-person@real-recipient.org",
        secretKey,
      },
    );
    await assert.rejects(
      assertClerkProductionInvitationStatusAttempt(wrongRecipientInput, stateRoot),
      /status marker mismatch/,
    );
    const wrongKeyInput = getClerkProductionInvitationOwnerInput(
      statusPublicInput,
      {
        recipientEmail,
        secretKey: `sk_live_${"B".repeat(40)}`,
      },
    );
    await assert.rejects(
      assertClerkProductionInvitationStatusAttempt(wrongKeyInput, stateRoot),
      /status marker mismatch/,
    );
  });

  test("writes private no-clobber JSON and refuses replacement", async (context) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "sufeiya-clerk-owner-"));
    context.after(async () => rm(temporaryRoot, { force: true, recursive: true }));
    const privateDirectory = join(temporaryRoot, "private");
    await mkdir(privateDirectory, { mode: 0o700 });
    const receiptPath = join(privateDirectory, "receipt.json");
    await writeClerkProductionJsonNoClobber(receiptPath, { safe: true });
    const receiptStat = await stat(receiptPath);
    assert.equal(receiptStat.mode & 0o777, 0o600);
    assert.equal(await readFile(receiptPath, "utf8"), '{\n  "safe": true\n}\n');
    await assert.rejects(
      writeClerkProductionJsonNoClobber(receiptPath, { safe: false }),
      (error: NodeJS.ErrnoException) => error.code === "EEXIST",
    );
    assert.equal(await readFile(receiptPath, "utf8"), '{\n  "safe": true\n}\n');
    assert.deepEqual(await readdir(privateDirectory), ["receipt.json"]);
  });

  test("keeps one audited SDK create call and no bulk, revoke, or delete path", async () => {
    const scriptPath = fileURLToPath(new URL(
      "../scripts/clerk-production-invitation.ts",
      import.meta.url,
    ));
    const sourceText = await readFile(scriptPath, "utf8");
    assert.equal(
      sourceText.match(/client\.invitations\.createInvitation\(/g)?.length,
      1,
    );
    for (const forbidden of [
      "createInvitationBulk",
      "revokeInvitation",
      "deleteUser",
      "createUser",
    ]) assert.equal(sourceText.includes(forbidden), false);
    assert.equal(sourceText.includes("process.env.CLERK_SECRET_KEY"), false);
    assert.equal(
      sourceText.includes("process.env.SUFEIYA_CLERK_PRODUCTION_INVITATION_RECIPIENT_EMAIL"),
      false,
    );
    assert.equal(sourceText.includes("readHiddenAsciiLine"), true);
    const mainSource = sourceText.slice(sourceText.indexOf("async function main()"));
    assert.ok(
      mainSource.indexOf("await readGithubProductionDeploymentBinding")
        < mainSource.indexOf("const secretKey = await readHiddenAsciiLine"),
    );
    assert.ok(
      mainSource.indexOf("await assertClerkProductionInvitationLocalState")
        < mainSource.indexOf("const secretKey = await readHiddenAsciiLine"),
    );
  });

  test("keeps the generated runtime exact and bound to the launcher", async () => {
    const buildScript = fileURLToPath(new URL(
      "../scripts/build-clerk-production-invitation-owner.mjs",
      import.meta.url,
    ));
    const check = spawnSync(process.execPath, [buildScript, "--check"], {
      encoding: "utf8",
    });
    assert.equal(check.status, 0, check.stderr);
    const launcherPath = fileURLToPath(new URL(
      "../scripts/clerk-production-invitation-owner",
      import.meta.url,
    ));
    const runtimePath = fileURLToPath(new URL(
      "../scripts/clerk-production-invitation-owner.mjs",
      import.meta.url,
    ));
    const [launcherSource, runtimeBytes] = await Promise.all([
      readFile(launcherPath, "utf8"),
      readFile(runtimePath),
    ]);
    const expectedRuntimeDigest = launcherSource.match(
      /EXPECTED_RUNTIME_SHA256='([0-9a-f]{64})'/,
    )?.[1];
    assert.equal(
      createHash("sha256").update(runtimeBytes).digest("hex"),
      expectedRuntimeDigest,
    );
    assert.ok((launcherSource.match(/\/usr\/bin\/env -i/g)?.length ?? 0) >= 5);
    assert.match(launcherSource, /PERL5OPT\|PERL5LIB\|PERLLIB/);
    assert.match(
      launcherSource,
      /SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION=/,
    );
    assert.match(launcherSource, /system_terminal_seen=0/);
    assert.match(launcherSource, /system_terminal_seen == 1/);
    assert.match(launcherSource, /readonly owner_uid="\$EUID"/);
    assert.match(launcherSource, /COLUMNS=1000/);
    assert.match(launcherSource, /codex:\*\|chatgpt:\*\|electron:\*\|code:\*/);
    assert.match(launcherSource, /node:\*\|nodejs:\*\|npm:\*\|npx:\*\|tsx:\*\|deno:\*\|bun:\*/);
    assert.match(
      launcherSource,
      /terminal:\/System\/Applications\/Utilities\/Terminal\.app\/Contents\/MacOS\/Terminal/,
    );
    assert.match(launcherSource, /zsh:\/bin\/zsh\|bash:\/bin\/bash\|sh:\/bin\/sh/);
    assert.match(launcherSource, /\*\)\n      fail_closed/);
    assert.match(launcherSource, /mode" == launch-check/);
    assert.match(
      launcherSource,
      /PASS_LAUNCH_BOUNDARY_NO_SENSITIVE_INPUT; stage=complete/,
    );
    for (const stage of [
      "invocation",
      "runtime_path",
      "ambient_environment",
      "node_resolution",
      "node_integrity",
      "runtime_integrity",
      "ancestor_read",
      "ancestor_shape",
      "ancestor_uid",
      "ancestor_allowlist",
      "ancestor_completion",
      "git_config_read",
      "git_config_allowlist",
      "git_top_level",
      "git_status",
      "runtime_exec",
    ]) assert.match(launcherSource, new RegExp(`failure_stage='${stage}'`));
    assert.ok(
      launcherSource.indexOf('if [[ "$mode" == launch-check ]]')
        < launcherSource.indexOf("typeset -a child_environment"),
    );
  });

  test("rejects launcher hooks and automated parents before sensitive input", {
    skip: process.platform !== "darwin" || process.arch !== "arm64",
  }, async () => {
    const launcher = fileURLToPath(new URL(
      "../scripts/clerk-production-invitation-owner",
      import.meta.url,
    ));
    const baseEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: authorizationRunId,
      SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: deploymentGitSha,
      SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: deploymentId,
    };
    const invalidModeLaunch = spawnSync(launcher, ["invalid-mode"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      env: baseEnvironment,
    });
    assert.equal(invalidModeLaunch.status, 1);
    assert.equal(
      invalidModeLaunch.stderr.trim(),
      "[Clerk Production invitation launcher] "
        + "FAIL_REDACTED_BEFORE_SENSITIVE_INPUT; stage=invocation",
    );
    for (const forbiddenEnvironment of [
      { NODE_OPTIONS: "--require=/private/tmp/forbidden-owner-hook.cjs" },
      { TSX_TSCONFIG_PATH: "/private/tmp/forbidden-owner-tsconfig.json" },
      { npm_lifecycle_event: "clerk:production-invitation" },
      { PERL5OPT: "-Mforbidden_owner_perl_hook" },
      { PERL5LIB: "/private/tmp/forbidden-owner-perl-lib" },
    ]) {
      const result = spawnSync(launcher, ["preflight"], {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        encoding: "utf8",
        env: { ...baseEnvironment, ...forbiddenEnvironment },
      });
      assert.equal(result.status, 1);
      assert.equal(
        result.stderr.trim(),
        "[Clerk Production invitation launcher] "
          + "FAIL_REDACTED_BEFORE_SENSITIVE_INPUT; stage=ambient_environment",
      );
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes("forbidden-owner"), false);
    }
    const nodeParentLaunch = spawnSync(launcher, ["preflight"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      env: baseEnvironment,
    });
    assert.equal(nodeParentLaunch.status, 1);
    assert.equal(
      nodeParentLaunch.stderr.trim(),
      "[Clerk Production invitation launcher] "
        + "FAIL_REDACTED_BEFORE_SENSITIVE_INPUT; stage=ancestor_allowlist",
    );
    const nodeParentLaunchCheck = spawnSync(launcher, ["launch-check"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      env: baseEnvironment,
    });
    assert.equal(nodeParentLaunchCheck.status, 1);
    assert.equal(
      nodeParentLaunchCheck.stderr.trim(),
      "[Clerk Production invitation launcher] "
        + "FAIL_REDACTED_BEFORE_SENSITIVE_INPUT; stage=ancestor_allowlist",
    );
  });
});
