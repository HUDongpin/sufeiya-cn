import { randomBytes } from "node:crypto";

import { createClerkClient } from "@clerk/backend";
import {
  clerk,
  setupClerkTestingToken,
} from "@clerk/testing/playwright";
import {
  expect,
  test,
  type Page,
  type Response as PlaywrightResponse,
} from "@playwright/test";

import {
  assertCanonicalClerkApiEnvironment,
  assertMatchingDevelopmentClerkInstance,
  assertVerifiedClerkTestingHandoff,
  buildClerkDevelopmentSyntheticInvitationEmail,
  CLERK_E2E_API_URL,
  CLERK_E2E_API_VERSION,
  ClerkExactUserDeletionError,
  deleteClerkExactUserWithVerification,
  getClerkDevelopmentE2ESuite,
  getClerkDevelopmentE2ETarget,
  getClerkDevelopmentKeyPair,
  getVercelHostedProtectionBypass,
  installClerkTestingLogRedaction,
  isExactClerkInvitationSignUpRedirect,
  retryClerkIdempotentMutation,
} from "./clerk-development-config";

const APPROVED_INVITATION_METADATA = Object.freeze({
  sufeiyaBetaAccess: Object.freeze({
    protocolVersion: "sufeiya_invite_only_beta_v1",
    status: "approved",
  }),
});

const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
const CLERK_BROWSER_BOOT_TIMEOUT_MS = 90_000;

type InvitationStatus = (typeof INVITATION_STATUSES)[number];
type ClerkClient = ReturnType<typeof createClerkClient>;
type ClerkInvitation = Awaited<ReturnType<ClerkClient["invitations"]["createInvitation"]>>;
type InvitationStatusCounts = Record<InvitationStatus, number>;

type InvitationCleanupState = {
  baselineInvitationCounts: InvitationStatusCounts | null;
  baselineUserCount: number | null;
  browserUiMayContainSecrets: boolean;
  client: ClerkClient;
  creationAttempted: boolean;
  invitationAccepted: boolean;
  invitationEmail: string;
  invitationId: string | null;
  restoreClerkLogs: () => void;
  temporaryUserId: string | null;
};

let invitationCleanupState: InvitationCleanupState | null = null;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value !== "object") throw new Error("unsupported canonical JSON value");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function invitationStatusCountsWithIncrement(
  baseline: InvitationStatusCounts,
  incrementedStatus: InvitationStatus,
): InvitationStatusCounts {
  return Object.fromEntries(INVITATION_STATUSES.map((status) => [
    status,
    baseline[status] + (status === incrementedStatus ? 1 : 0),
  ])) as InvitationStatusCounts;
}

async function readInvitationStatusCounts(client: ClerkClient) {
  const results = await Promise.all(INVITATION_STATUSES.map(async (status) => {
    const page = await retryClerkIdempotentMutation(() => (
      client.invitations.getInvitationList({ limit: 1, status })
    ));
    return [status, page.totalCount] as const;
  }));
  return Object.fromEntries(results) as InvitationStatusCounts;
}

async function readExactInvitations(client: ClerkClient, emailAddress: string) {
  const byId = new Map<string, ClerkInvitation>();
  for (const status of INVITATION_STATUSES) {
    const page = await retryClerkIdempotentMutation(() => (
      client.invitations.getInvitationList({
        limit: 100,
        query: emailAddress,
        status,
      })
    ));
    for (const invitation of page.data) {
      if (invitation.emailAddress === emailAddress) byId.set(invitation.id, invitation);
    }
  }
  return [...byId.values()];
}

async function recoverExactInvitation(client: ClerkClient, emailAddress: string) {
  for (const delayMs of [0, 1_000, 2_500, 5_000] as const) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    const invitations = await readExactInvitations(client, emailAddress);
    if (invitations.length > 1) {
      throw new Error("Clerk Development invitation recovery was ambiguous.");
    }
    if (invitations[0]) return invitations[0];
  }
  return null;
}

async function recoverSettledExactInvitation(client: ClerkClient, emailAddress: string) {
  let lastObserved: ClerkInvitation | null = null;
  for (const delayMs of [0, 1_000, 2_500, 5_000] as const) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    const invitations = await readExactInvitations(client, emailAddress);
    if (invitations.length > 1) {
      throw new Error("Clerk Development invitation settlement was ambiguous.");
    }
    lastObserved = invitations[0] ?? null;
    if (lastObserved === null || lastObserved.status !== "pending") return lastObserved;
  }
  return lastObserved;
}

async function readExactUsers(client: ClerkClient, emailAddress: string) {
  const users = await retryClerkIdempotentMutation(() => client.users.getUserList({
    emailAddress: [emailAddress],
    limit: 2,
  }));
  return users.data.filter((user) => user.emailAddresses.some(
    (email) => email.emailAddress === emailAddress,
  ));
}

function responseUsesStrategy(response: PlaywrightResponse, strategy: string) {
  const body = response.request().postData() ?? "";
  try {
    return (JSON.parse(body) as { strategy?: string }).strategy === strategy;
  } catch {
    return new URLSearchParams(body).get("strategy") === strategy;
  }
}

function exactFrontendApiResponse(
  response: PlaywrightResponse,
  frontendApiHost: string,
  terminalEndpoint: string,
  strategy: string,
) {
  const url = new URL(response.url());
  return response.request().method() === "POST"
    && url.protocol === "https:"
    && url.host === frontendApiHost
    && url.pathname.split("/").filter(Boolean).at(-1) === terminalEndpoint
    && response.status() === 200
    && responseUsesStrategy(response, strategy);
}

async function expectClearedClerkBrowserSession(page: Page) {
  await expect.poll(async () => page.evaluate(() => ({
    runtimeLoaded: (window as Window & {
      Clerk?: { loaded?: boolean };
    }).Clerk?.loaded === true,
    sessionIsNull: (window as Window & {
      Clerk?: { session?: unknown | null };
    }).Clerk?.session === null,
    userIsNull: (window as Window & {
      Clerk?: { user?: unknown | null };
    }).Clerk?.user === null,
  })), {
    intervals: [250, 500, 1_000, 2_000],
    timeout: 30_000,
  }).toEqual({ runtimeLoaded: true, sessionIsNull: true, userIsNull: true });
}

async function expectSignedOutWorkspaceBoundary(page: Page) {
  await page.goto("/workspace", {
    timeout: 30_000,
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 30_000 });

  let boundaryReady = false;
  for (let attempt = 0; attempt < 2 && !boundaryReady; attempt += 1) {
    try {
      await clerk.loaded({ page });
      await page.locator(".cl-signIn-root").waitFor({ state: "visible", timeout: 30_000 });
      boundaryReady = true;
    } catch {
      if (attempt === 0) {
        await page.reload({ timeout: 30_000, waitUntil: "domcontentloaded" });
        await page.waitForURL((url) => url.pathname === "/sign-in", { timeout: 30_000 });
      }
    }
  }
  expect(boundaryReady).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.afterEach("clean the exact invited Development user and settle invitation history", async ({ context }, testInfo) => {
  testInfo.setTimeout(120_000);
  const cleanupState = invitationCleanupState;
  invitationCleanupState = null;
  if (!cleanupState) return;

  const teardownFailures: Error[] = [];
  let finalInvitationStatus: InvitationStatus | null = null;

  if (cleanupState.browserUiMayContainSecrets) {
    for (let attempt = 0; attempt < 2 && context.pages().length > 0; attempt += 1) {
      for (const openPage of context.pages()) {
        await openPage.goto("about:blank", {
          timeout: 5_000,
          waitUntil: "commit",
        }).catch(() => undefined);
        await openPage.close().catch(() => undefined);
      }
    }
    if (context.pages().length === 0) {
      cleanupState.browserUiMayContainSecrets = false;
    } else {
      teardownFailures.push(new Error(
        "Clerk Development invitation UI sanitization failed without retaining identity details.",
      ));
    }
  }

  if (cleanupState.creationAttempted) {
    try {
      let exactInvitation = await recoverExactInvitation(
        cleanupState.client,
        cleanupState.invitationEmail,
      );
      if (
        exactInvitation !== null
        && cleanupState.invitationId !== null
        && exactInvitation.id !== cleanupState.invitationId
      ) {
        throw new Error("cleanup invitation identity mismatch");
      }
      cleanupState.invitationId = exactInvitation?.id ?? cleanupState.invitationId;

      if (exactInvitation?.status === "pending") {
        try {
          const revoked = await cleanupState.client.invitations.revokeInvitation(
            exactInvitation.id,
          );
          if (revoked.id !== exactInvitation.id || revoked.status !== "revoked") {
            throw new Error("cleanup invitation revoke acknowledgement mismatch");
          }
        } catch {
          // A revoke response can be lost after Clerk commits it. The exact
          // status observation below is the authoritative acknowledgement.
        }
        exactInvitation = await recoverSettledExactInvitation(
          cleanupState.client,
          cleanupState.invitationEmail,
        );
      }

      if (exactInvitation !== null) {
        if (
          cleanupState.invitationId !== exactInvitation.id
          || exactInvitation.emailAddress !== cleanupState.invitationEmail
          || !/^inv_[A-Za-z0-9_-]{1,249}$/.test(exactInvitation.id)
          || !INVITATION_STATUSES.includes(exactInvitation.status)
        ) {
          throw new Error("cleanup invitation boundary mismatch");
        }
        finalInvitationStatus = exactInvitation.status;
      } else if (cleanupState.invitationId !== null) {
        throw new Error("cleanup could not recover the created invitation");
      }
    } catch {
      teardownFailures.push(new Error(
        "Clerk Development invitation cleanup failed during invitation settlement; no identity details were retained.",
      ));
    }

    try {
      const exactUsers = await readExactUsers(
        cleanupState.client,
        cleanupState.invitationEmail,
      );
      if (exactUsers.length > 1) throw new Error("cleanup user recovery was ambiguous");
      let exactUser = exactUsers[0] ?? null;
      if (
        exactUser !== null
        && cleanupState.temporaryUserId !== null
        && exactUser.id !== cleanupState.temporaryUserId
      ) {
        throw new Error("cleanup user identity mismatch");
      }
      if (exactUser === null && cleanupState.temporaryUserId !== null) {
        const recoveredById = await retryClerkIdempotentMutation(() => (
          cleanupState.client.users.getUserList({
            userId: [cleanupState.temporaryUserId!],
            limit: 2,
          })
        ));
        if (recoveredById.data.length > 1) {
          throw new Error("cleanup user ID recovery was ambiguous");
        }
        exactUser = recoveredById.data[0] ?? null;
        if (
          exactUser !== null
          && !exactUser.emailAddresses.some(
            (email) => email.emailAddress === cleanupState.invitationEmail,
          )
        ) {
          throw new Error("cleanup user ID boundary mismatch");
        }
      }
      cleanupState.temporaryUserId = exactUser?.id ?? cleanupState.temporaryUserId;

      if (exactUser !== null) {
        await deleteClerkExactUserWithVerification(exactUser.id, {
          deleteUser: (userId) => cleanupState.client.users.deleteUser(userId),
          getExactUserCount: (userId) => cleanupState.client.users.getCount({ userId: [userId] }),
        });
      }

      for (const delayMs of [0, 2_500] as const) {
        if (delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
        expect(await readExactUsers(
          cleanupState.client,
          cleanupState.invitationEmail,
        )).toEqual([]);
        if (cleanupState.temporaryUserId !== null) {
          expect(await retryClerkIdempotentMutation(
            () => cleanupState.client.users.getCount({
              userId: [cleanupState.temporaryUserId!],
            }),
          )).toBe(0);
        }
        if (cleanupState.baselineUserCount !== null) {
          expect(await retryClerkIdempotentMutation(
            () => cleanupState.client.users.getCount(),
          )).toBe(cleanupState.baselineUserCount);
        }
      }
    } catch (error) {
      const phase = error instanceof ClerkExactUserDeletionError
        ? error.phase
        : "user_settlement";
      teardownFailures.push(new Error(
        `Clerk Development invitation cleanup failed during ${phase}; no identity details were retained.`,
      ));
    }

    try {
      if (cleanupState.baselineInvitationCounts === null) {
        throw new Error("cleanup invitation baseline unavailable");
      }
      if (finalInvitationStatus === "pending" || finalInvitationStatus === "expired") {
        throw new Error("cleanup left the invitation in an unexpected status");
      }
      if (cleanupState.invitationAccepted && finalInvitationStatus !== "accepted") {
        throw new Error("cleanup lost the accepted invitation status");
      }
      if (!cleanupState.invitationAccepted && finalInvitationStatus === "accepted") {
        throw new Error("cleanup observed an unacknowledged accepted invitation");
      }

      const expectedInvitationCounts = finalInvitationStatus === null
        ? cleanupState.baselineInvitationCounts
        : invitationStatusCountsWithIncrement(
          cleanupState.baselineInvitationCounts,
          finalInvitationStatus,
        );
      await expect.poll(
        () => readInvitationStatusCounts(cleanupState.client),
        { intervals: [1_000, 2_500, 5_000], timeout: 30_000 },
      ).toEqual(expectedInvitationCounts);
    } catch {
      teardownFailures.push(new Error(
        "Clerk Development invitation cleanup failed during history audit; no identity details were retained.",
      ));
    }
  }

  try {
    await context.close();
  } catch {
    teardownFailures.push(new Error(
      "Clerk Development invitation browser teardown failed while helper logs were redacted.",
    ));
  } finally {
    cleanupState.restoreClerkLogs();
  }

  if (teardownFailures.length > 1) {
    throw new AggregateError(
      teardownFailures,
      "Clerk Development invitation teardown failed in multiple phases without identity details.",
    );
  }
  if (teardownFailures[0]) throw teardownFailures[0];

  const settledHistory = finalInvitationStatus === "accepted"
    ? "accepted_history_retained"
    : finalInvitationStatus === "revoked"
      ? "pre_acceptance_history_revoked"
      : "no_invitation_committed";
  process.stdout.write(
    `[Clerk Development invitation E2E] ${settledHistory}; exact_user_cleanup=pass.\n`,
  );
});

test("an explicitly authorized Development invitation is accepted through SignUp and survives credential re-login", async ({ page }) => {
  if (getClerkDevelopmentE2ESuite() !== "invitation-acceptance") {
    throw new Error("Clerk Development invitation E2E suite authorization was not retained.");
  }
  assertCanonicalClerkApiEnvironment();
  process.env.CLERK_API_URL = CLERK_E2E_API_URL;
  process.env.CLERK_API_VERSION = CLERK_E2E_API_VERSION;

  const keyPair = getClerkDevelopmentKeyPair();
  const target = getClerkDevelopmentE2ETarget();
  const vercelProtectionBypass = getVercelHostedProtectionBypass(target);
  const client = createClerkClient({
    apiUrl: CLERK_E2E_API_URL,
    apiVersion: CLERK_E2E_API_VERSION,
    publishableKey: keyPair.publishableKey,
    secretKey: keyPair.secretKey,
  });
  const runId = process.env.SUFEIYA_CLERK_E2E_RUN_ID;
  if (!runId) throw new Error("Clerk Development invitation E2E run marker is unavailable.");
  const invitationEmail = buildClerkDevelopmentSyntheticInvitationEmail(runId);
  const temporaryPassword = `S7!${randomBytes(24).toString("base64url")}`;

  if (invitationCleanupState !== null) {
    throw new Error("Clerk Development invitation E2E refused stale cleanup state.");
  }
  const restoreClerkLogs = installClerkTestingLogRedaction();
  const cleanupState: InvitationCleanupState = {
    baselineInvitationCounts: null,
    baselineUserCount: null,
    browserUiMayContainSecrets: false,
    client,
    creationAttempted: false,
    invitationAccepted: false,
    invitationEmail,
    invitationId: null,
    restoreClerkLogs,
    temporaryUserId: null,
  };
  invitationCleanupState = cleanupState;

  let stage: string = "testing-token handoff";
  let flowFailure: Error | null = null;
  let ticketStrategyObserved = false;
  const recordTicketStrategy = (response: PlaywrightResponse) => {
    if (exactFrontendApiResponse(
      response,
      keyPair.frontendApiHost,
      "sign_ups",
      "ticket",
    )) {
      ticketStrategyObserved = true;
    }
  };
  page.on("response", recordTicketStrategy);

  const forceRefreshClerkSessionToken = async () => page.evaluate(async () => {
    const runtime = (window as Window & {
      Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
    }).Clerk;
    if (!runtime?.session) return "session_unavailable" as const;
    try {
      return await runtime.session.getToken({ skipCache: true })
        ? "token_refreshed" as const
        : "token_missing" as const;
    } catch {
      return "refresh_rejected" as const;
    }
  });

  const gotoApprovedWorkspace = async () => {
    const response = await page.goto("/workspace", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-sufeiya-beta-access"]).toBe("approved");
    await expect(page).toHaveURL((url) => url.pathname === "/workspace");
  };

  try {
    assertVerifiedClerkTestingHandoff(keyPair);
    stage = "Development instance revalidation";
    const [instance, domains] = await Promise.all([
      retryClerkIdempotentMutation(() => client.instance.get()),
      retryClerkIdempotentMutation(() => client.domains.list()),
    ]);
    assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: instance.environmentType,
      frontendApiUrls: domains.data.map((domain) => domain.frontendApiUrl),
    });

    stage = "persistent-history baseline";
    cleanupState.baselineUserCount = await retryClerkIdempotentMutation(
      () => client.users.getCount(),
    );
    cleanupState.baselineInvitationCounts = await readInvitationStatusCounts(client);
    expect(await readExactUsers(client, invitationEmail)).toEqual([]);
    expect(await readExactInvitations(client, invitationEmail)).toEqual([]);

    stage = "testing-token browser route";
    await setupClerkTestingToken({
      context: page.context(),
      options: { frontendApiUrl: keyPair.frontendApiHost },
    });

    if (vercelProtectionBypass) {
      stage = "Vercel hosted protection bootstrap";
      const originalCookies = await page.context().cookies(target.baseURL);
      const response = await page.context().request.get(target.baseURL, {
        failOnStatusCode: false,
        headers: {
          "x-vercel-protection-bypass": vercelProtectionBypass,
          "x-vercel-set-bypass-cookie": "true",
        },
        maxRedirects: 0,
        timeout: 20_000,
      });
      const responseStatus = response.status();
      await response.dispose();
      const bypassCookies = await page.context().cookies(target.baseURL);
      const originalCookieValues = new Map(originalCookies.map((cookie) => [
        `${cookie.name}\0${cookie.domain}\0${cookie.path}`,
        cookie.value,
      ]));
      const receivedNewSecureCookie = bypassCookies.some((cookie) => (
        cookie.secure
        && originalCookieValues.get(`${cookie.name}\0${cookie.domain}\0${cookie.path}`)
          !== cookie.value
      ));
      if (responseStatus < 200 || responseStatus >= 400 || !receivedNewSecureCookie) {
        throw new Error("Vercel hosted protection bootstrap failed");
      }
    }

    stage = "application invitation creation";
    cleanupState.creationAttempted = true;
    let invitation: ClerkInvitation | null = null;
    try {
      invitation = await client.invitations.createInvitation({
        emailAddress: invitationEmail,
        expiresInDays: 1,
        ignoreExisting: false,
        notify: false,
        publicMetadata: APPROVED_INVITATION_METADATA,
        redirectUrl: new URL("/sign-up", target.baseURL).toString(),
      });
    } catch {
      invitation = await recoverExactInvitation(client, invitationEmail);
      if (!invitation) throw new Error("application invitation creation was not observed");
    }

    cleanupState.invitationId = invitation.id;
    if (
      !/^inv_[A-Za-z0-9_-]{1,249}$/.test(invitation.id)
      || invitation.emailAddress !== invitationEmail
      || invitation.status !== "pending"
      || invitation.revoked === true
      || canonicalJson(invitation.publicMetadata) !== canonicalJson(APPROVED_INVITATION_METADATA)
      || !invitation.url
    ) {
      throw new Error("application invitation response boundary mismatch");
    }
    const invitationUrl = new URL(invitation.url);
    const invitationTicket = invitationUrl.searchParams.get("ticket");
    if (
      invitationUrl.protocol !== "https:"
      || invitationUrl.host !== keyPair.frontendApiHost
      || invitationUrl.pathname !== "/v1/tickets/accept"
      || invitationUrl.username
      || invitationUrl.password
      || invitationUrl.hash
      || [...invitationUrl.searchParams.keys()].join(",") !== "ticket"
      || !invitationTicket
      || invitationTicket.length < 16
      || invitationTicket.length > 2_048
      || /[\s<>&"']/.test(invitationTicket)
    ) {
      throw new Error("application invitation acceptance URL boundary mismatch");
    }

    stage = "pending invitation visibility";
    await expect.poll(async () => {
      const exact = await readExactInvitations(client, invitationEmail);
      return {
        count: exact.length,
        idMatches: exact[0]?.id === cleanupState.invitationId,
        metadataMatches: exact[0] !== undefined
          && canonicalJson(exact[0].publicMetadata)
            === canonicalJson(APPROVED_INVITATION_METADATA),
        status: exact[0]?.status ?? "missing",
      };
    }, { intervals: [1_000, 2_500, 5_000], timeout: 30_000 }).toEqual({
      count: 1,
      idMatches: true,
      metadataMatches: true,
      status: "pending",
    });
    await expect.poll(
      () => readInvitationStatusCounts(client),
      { intervals: [1_000, 2_500, 5_000], timeout: 30_000 },
    ).toEqual(invitationStatusCountsWithIncrement(
      cleanupState.baselineInvitationCounts,
      "pending",
    ));

    cleanupState.browserUiMayContainSecrets = true;
    stage = "invitation URL handoff";
    await page.goto(invitation.url, {
      timeout: 60_000,
      waitUntil: "domcontentloaded",
    });
    stage = "invitation redirect boundary";
    await page.waitForURL((url) => isExactClerkInvitationSignUpRedirect(
      url,
      new URL(target.baseURL).origin,
      invitationTicket,
    ), { timeout: 60_000 });
    const acceptedEntryUrl = new URL(page.url());
    if (!isExactClerkInvitationSignUpRedirect(
      acceptedEntryUrl,
      new URL(target.baseURL).origin,
      invitationTicket,
    )) {
      throw new Error("invitation ticket redirect boundary mismatch");
    }

    stage = "invitation SignUp runtime";
    await clerk.loaded({ page });
    await expect(page.locator('[data-clerk-invitation-entry="ticket-present"]')).toBeVisible();
    const signUpRoot = page.locator(".cl-signUp-root");
    await expect(signUpRoot).toBeVisible({ timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS });
    await expect.poll(() => page.evaluate(
      (expectedEmail) => {
        const runtime = (window as Window & {
          Clerk?: {
            client?: { signUp?: { emailAddress?: string | null } };
            frontendApi?: string;
          };
        }).Clerk;
        return {
          emailMatches: runtime?.client?.signUp?.emailAddress === expectedEmail,
          runtimeAvailable: Boolean(runtime),
        };
      },
      invitationEmail,
    ), {
      intervals: [250, 500, 1_000, 2_000],
      timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
    }).toEqual({ emailMatches: true, runtimeAvailable: true });
    expect(await page.evaluate(
      (expectedHost) => (window as Window & {
        Clerk?: { frontendApi?: string };
      }).Clerk?.frontendApi === expectedHost,
      keyPair.frontendApiHost,
    )).toBe(true);

    stage = "invitation SignUp form";
    const visibleInputs = signUpRoot.locator("input:visible");
    const visibleInputNames = await visibleInputs.evaluateAll((inputs) => inputs.map(
      (input) => (input as HTMLInputElement).name,
    ));
    expect(visibleInputNames.every((name) => [
      "emailAddress",
      "firstName",
      "lastName",
      "password",
    ].includes(name))).toBe(true);

    const emailInput = signUpRoot.locator('input[name="emailAddress"]:visible');
    if (await emailInput.count()) {
      await expect(emailInput).toHaveValue(invitationEmail);
    }
    const firstNameInput = signUpRoot.locator('input[name="firstName"]:visible');
    if (await firstNameInput.count()) await firstNameInput.fill("Synthetic");
    const lastNameInput = signUpRoot.locator('input[name="lastName"]:visible');
    if (await lastNameInput.count()) await lastNameInput.fill("Invitation");
    const passwordInput = signUpRoot.locator('input[name="password"]:visible');
    await expect(passwordInput).toHaveCount(1);
    await passwordInput.fill(temporaryPassword);

    stage = "invitation SignUp submission";
    const invitationSession = page.waitForFunction(() => Boolean(
      (window as Window & { Clerk?: { session?: unknown } }).Clerk?.session,
    ), undefined, { timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS });
    await passwordInput.press("Enter");
    await invitationSession;
    await expect.poll(() => ticketStrategyObserved, {
      intervals: [250, 500, 1_000],
      timeout: 10_000,
    }).toBe(true);

    stage = "invitation metadata auto-copy";
    let invitedUser = null as Awaited<ReturnType<typeof readExactUsers>>[number] | null;
    await expect.poll(async () => {
      const exactUsers = await readExactUsers(client, invitationEmail);
      invitedUser = exactUsers[0] ?? null;
      return {
        count: exactUsers.length,
        emailVerified: invitedUser?.emailAddresses.find(
          (email) => email.emailAddress === invitationEmail,
        )?.verification?.status === "verified",
        metadataMatches: invitedUser !== null
          && canonicalJson(invitedUser.publicMetadata)
            === canonicalJson(APPROVED_INVITATION_METADATA),
        passwordEnabled: invitedUser?.passwordEnabled === true,
        totalUserCount: await retryClerkIdempotentMutation(() => client.users.getCount()),
      };
    }, { intervals: [1_000, 2_500, 5_000], timeout: 30_000 }).toEqual({
      count: 1,
      emailVerified: true,
      metadataMatches: true,
      passwordEnabled: true,
      totalUserCount: cleanupState.baselineUserCount + 1,
    });
    if (!invitedUser) throw new Error("invited user was not recovered");
    cleanupState.temporaryUserId = invitedUser.id;
    expect(await page.evaluate(
      (expectedUserId) => (window as Window & {
        Clerk?: { user?: { id?: string } };
      }).Clerk?.user?.id === expectedUserId,
      invitedUser.id,
    )).toBe(true);

    stage = "accepted invitation visibility";
    await expect.poll(async () => {
      const exact = await readExactInvitations(client, invitationEmail);
      return {
        count: exact.length,
        idMatches: exact[0]?.id === cleanupState.invitationId,
        metadataMatches: exact[0] !== undefined
          && canonicalJson(exact[0].publicMetadata)
            === canonicalJson(APPROVED_INVITATION_METADATA),
        status: exact[0]?.status ?? "missing",
      };
    }, { intervals: [1_000, 2_500, 5_000], timeout: 30_000 }).toEqual({
      count: 1,
      idMatches: true,
      metadataMatches: true,
      status: "accepted",
    });
    cleanupState.invitationAccepted = true;
    await expect.poll(
      () => readInvitationStatusCounts(client),
      { intervals: [1_000, 2_500, 5_000], timeout: 30_000 },
    ).toEqual(invitationStatusCountsWithIncrement(
      cleanupState.baselineInvitationCounts,
      "accepted",
    ));

    stage = "invitation approved session";
    await expect.poll(forceRefreshClerkSessionToken, {
      intervals: [1_000, 2_000, 5_000, 10_000],
      timeout: 30_000,
    }).toBe("token_refreshed");
    await gotoApprovedWorkspace();

    stage = "post-invitation sign-out";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    await clerk.signOut({ page });
    await expectClearedClerkBrowserSession(page);
    await expectSignedOutWorkspaceBoundary(page);

    stage = "invited credential re-login identifier";
    const signInRoot = page.locator(".cl-signIn-root");
    const identifierInput = signInRoot.locator('input[name="identifier"]');
    const credentialPassword = signInRoot.locator('input[name="password"]');
    await expect(identifierInput).toBeVisible();
    await identifierInput.fill(invitationEmail);
    if (!await credentialPassword.isVisible()) {
      await identifierInput.press("Enter");
      await expect(credentialPassword).toBeVisible({
        timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
      });
    }

    stage = "invited credential re-login password";
    await credentialPassword.fill(temporaryPassword);
    const directCredentialSession = page.waitForFunction(() => Boolean(
      (window as Window & { Clerk?: { session?: unknown } }).Clerk?.session,
    ), undefined, {
      timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
    }).then(() => "direct_session" as const);
    const secondFactorPreparation = page.waitForResponse(
      (response) => exactFrontendApiResponse(
        response,
        keyPair.frontendApiHost,
        "prepare_second_factor",
        "email_code",
      ),
      { timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS },
    ).then(() => "email_code" as const);
    const passwordFirstFactorAttempt = page.waitForResponse(
      (response) => exactFrontendApiResponse(
        response,
        keyPair.frontendApiHost,
        "attempt_first_factor",
        "password",
      ),
      { timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS },
    );
    await credentialPassword.press("Enter");
    const credentialReloginBranch = await Promise.race([
      directCredentialSession,
      secondFactorPreparation,
    ]);
    await passwordFirstFactorAttempt;

    if (credentialReloginBranch === "email_code") {
      stage = "invited credential email-code verification";
      await expect.poll(async () => page.evaluate(() => {
        const signIn = (window as Window & {
          Clerk?: {
            client?: {
              signIn?: {
                status?: string;
                supportedSecondFactors?: Array<{ strategy?: string }> | null;
              };
            };
          };
        }).Clerk?.client?.signIn;
        return {
          status: signIn?.status ?? "unavailable",
          strategies: signIn?.supportedSecondFactors?.map(
            (factor) => factor.strategy ?? "unknown",
          ) ?? [],
        };
      }), {
        intervals: [250, 500, 1_000],
        timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
      }).toEqual({ status: "needs_client_trust", strategies: ["email_code"] });
      const verificationInput = signInRoot.locator(
        'input[autocomplete="one-time-code"][inputmode="numeric"][maxlength="6"]:visible',
      );
      await expect(verificationInput).toHaveCount(1);
      const secondFactorAttempt = page.waitForResponse(
        (response) => exactFrontendApiResponse(
          response,
          keyPair.frontendApiHost,
          "attempt_second_factor",
          "email_code",
        ),
        { timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS },
      );
      const sessionAfterEmailCode = page.waitForFunction(() => Boolean(
        (window as Window & { Clerk?: { session?: unknown } }).Clerk?.session,
      ), undefined, { timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS });
      await verificationInput.fill("424242");
      await Promise.all([secondFactorAttempt, sessionAfterEmailCode]);
      process.stdout.write(
        "[Clerk Development invitation E2E] credential branch: development_email_code_client_trust.\n",
      );
    } else {
      process.stdout.write(
        "[Clerk Development invitation E2E] credential branch: direct_password_session.\n",
      );
    }

    stage = "invited credential approved session";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    expect(await page.evaluate(
      (expectedUserId) => (window as Window & {
        Clerk?: { user?: { id?: string } };
      }).Clerk?.user?.id === expectedUserId,
      invitedUser.id,
    )).toBe(true);
    await expect.poll(forceRefreshClerkSessionToken, {
      intervals: [1_000, 2_000, 5_000, 10_000],
      timeout: 30_000,
    }).toBe("token_refreshed");
    await gotoApprovedWorkspace();

    stage = "final invited credential sign-out";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    await clerk.signOut({ page });
    await expectClearedClerkBrowserSession(page);
    await expectSignedOutWorkspaceBoundary(page);
  } catch {
    flowFailure = new Error(
      `Clerk Development invitation E2E failed during ${stage}.`,
    );
  } finally {
    page.off("response", recordTicketStrategy);
    await page.goto("about:blank", {
      timeout: 5_000,
      waitUntil: "commit",
    }).catch(() => undefined);
    await page.close().catch(() => undefined);
    if (page.context().pages().length === 0) {
      cleanupState.browserUiMayContainSecrets = false;
    }
  }

  if (flowFailure) throw flowFailure;
  if (cleanupState.browserUiMayContainSecrets) {
    throw new Error("Clerk Development invitation UI sanitization did not complete.");
  }
});
