import { randomBytes, randomUUID } from "node:crypto";

import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { expect, test } from "@playwright/test";

import {
  assertCanonicalClerkApiEnvironment,
  assertMatchingDevelopmentClerkInstance,
  assertVerifiedClerkTestingHandoff,
  CLERK_E2E_API_URL,
  CLERK_E2E_API_VERSION,
  getClerkDevelopmentE2ETarget,
  getClerkDevelopmentKeyPair,
  getVercelHostedProtectionBypass,
  installClerkTestingLogRedaction,
} from "./clerk-development-config";

type SmokeStage =
  | "testing-token handoff"
  | "Vercel hosted protection bootstrap"
  | "Development instance revalidation"
  | "user-count baseline"
  | "signed-out route protection"
  | "browser runtime instance binding"
  | "temporary synthetic user creation"
  | "real Clerk sign-in"
  | "authenticated workspace"
  | "authenticated teaching-review demo"
  | "Clerk sign-out"
  | "post-sign-out route protection";

type ClerkCleanupState = {
  baselineUserCount: number | null;
  client: ReturnType<typeof createClerkClient>;
  creationAttempted: boolean;
  restoreClerkLogs: () => void;
  temporaryExternalId: string | null;
  temporaryUserId: string | null;
};

let clerkCleanupState: ClerkCleanupState | null = null;

test.describe.configure({ mode: "serial" });

test.afterEach("remove the exact synthetic Development user", async ({ context }, testInfo) => {
  testInfo.setTimeout(60_000);
  const cleanupState = clerkCleanupState;
  clerkCleanupState = null;
  if (!cleanupState) return;

  let cleanupFailure: Error | null = null;
  let contextTeardownFailure: Error | null = null;
  try {
    if (cleanupState.creationAttempted) {
      if (cleanupState.baselineUserCount === null || cleanupState.temporaryExternalId === null) {
        throw new Error("cleanup identity unavailable");
      }

      if (cleanupState.temporaryUserId === null) {
        const recoveredUsers = await cleanupState.client.users.getUserList({
          externalId: [cleanupState.temporaryExternalId],
          limit: 2,
        });
        if (recoveredUsers.data.length > 1) throw new Error("cleanup identity ambiguous");
        cleanupState.temporaryUserId = recoveredUsers.data[0]?.id ?? null;
      }

      if (cleanupState.temporaryUserId !== null) {
        const deleted = await cleanupState.client.users.deleteUser(cleanupState.temporaryUserId);
        if (deleted.id !== cleanupState.temporaryUserId) {
          throw new Error("exact deletion not acknowledged");
        }
      }

      await expect.poll(async () => ({
        exactExternalIdCount: await cleanupState.client.users.getCount({
          externalId: [cleanupState.temporaryExternalId!],
        }),
        exactTemporaryUserCount: cleanupState.temporaryUserId === null
          ? 0
          : await cleanupState.client.users.getCount({ userId: [cleanupState.temporaryUserId] }),
        totalUserCount: await cleanupState.client.users.getCount(),
      }), { timeout: 15_000 }).toEqual({
        exactExternalIdCount: 0,
        exactTemporaryUserCount: 0,
        totalUserCount: cleanupState.baselineUserCount,
      });
    }
  } catch {
    cleanupFailure = new Error(
      "Clerk Development smoke cleanup failed: exact temporary-user deletion or baseline restoration could not be verified.",
    );
  }

  try {
    await context.close();
  } catch {
    contextTeardownFailure = new Error(
      "Clerk Development browser context teardown failed while helper logs were redacted.",
    );
  } finally {
    cleanupState.restoreClerkLogs();
  }

  if (cleanupFailure && contextTeardownFailure) {
    throw new AggregateError(
      [cleanupFailure, contextTeardownFailure],
      "Clerk Development cleanup and browser-context teardown both failed without identity details.",
    );
  }
  if (cleanupFailure) throw cleanupFailure;
  if (contextTeardownFailure) throw contextTeardownFailure;
});

test("a temporary Development user can traverse the protected smoke path and is removed", async ({ page }) => {
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

  if (clerkCleanupState !== null) {
    throw new Error("Clerk Development smoke refused stale cleanup state.");
  }
  const restoreClerkLogs = installClerkTestingLogRedaction();
  const cleanupState: ClerkCleanupState = {
    baselineUserCount: null,
    client,
    creationAttempted: false,
    restoreClerkLogs,
    temporaryExternalId: null,
    temporaryUserId: null,
  };
  clerkCleanupState = cleanupState;
  let stage: SmokeStage = "testing-token handoff";

  try {
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
      const originalCookieValues = new Map(
        originalCookies.map((cookie) => [
          `${cookie.name}\0${cookie.domain}\0${cookie.path}`,
          cookie.value,
        ]),
      );
      const receivedNewSecureCookie = bypassCookies.some((cookie) => (
        cookie.secure
        && originalCookieValues.get(`${cookie.name}\0${cookie.domain}\0${cookie.path}`)
          !== cookie.value
      ));
      if (responseStatus < 200 || responseStatus >= 400 || !receivedNewSecureCookie) {
        throw new Error("Vercel hosted protection bootstrap failed");
      }
    }

    stage = "testing-token handoff";
    assertVerifiedClerkTestingHandoff(keyPair);

    stage = "Development instance revalidation";
    const [instance, domains] = await Promise.all([
      client.instance.get(),
      client.domains.list(),
    ]);
    assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: instance.environmentType,
      frontendApiUrls: domains.data.map((domain) => domain.frontendApiUrl),
    });

    stage = "user-count baseline";
    cleanupState.baselineUserCount = await client.users.getCount();

    stage = "signed-out route protection";
    await setupClerkTestingToken({
      page,
      options: { frontendApiUrl: keyPair.frontendApiHost },
    });
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/sign-in");
    await expect(page.locator(".cl-signIn-root")).toBeVisible();

    stage = "browser runtime instance binding";
    await clerk.loaded({ page });
    const browserRuntimeMatchesVerifiedInstance = await page.evaluate(
      (expectedFrontendApiHost) => {
        const clerkRuntime = (window as Window & {
          Clerk?: { frontendApi?: string };
        }).Clerk;
        return clerkRuntime?.frontendApi === expectedFrontendApiHost;
      },
      keyPair.frontendApiHost,
    );
    expect(browserRuntimeMatchesVerifiedInstance).toBe(true);

    stage = "temporary synthetic user creation";
    const uniqueSuffix = randomUUID().replaceAll("-", "");
    const temporaryEmail = `sufeiya-e2e+clerk_test_${uniqueSuffix}@example.com`;
    const temporaryPassword = `S7!${randomBytes(24).toString("base64url")}`;
    cleanupState.temporaryExternalId = `sufeiya-clerk-e2e-${uniqueSuffix}`;

    if (
      await client.users.getCount({ emailAddress: [temporaryEmail] }) !== 0
      || await client.users.getCount({ externalId: [cleanupState.temporaryExternalId] }) !== 0
    ) {
      throw new Error("temporary identifier collision");
    }

    cleanupState.creationAttempted = true;
    const temporaryUser = await client.users.createUser({
      emailAddress: [temporaryEmail],
      externalId: cleanupState.temporaryExternalId,
      firstName: "Synthetic",
      lastName: "Learner",
      password: temporaryPassword,
      privateMetadata: { sufeiyaSyntheticClerkE2E: true },
    });
    cleanupState.temporaryUserId = temporaryUser.id;

    await expect.poll(async () => ({
      exactTemporaryUserCount: await client.users.getCount({ userId: [cleanupState.temporaryUserId!] }),
      totalUserCount: await client.users.getCount(),
    })).toEqual({
      exactTemporaryUserCount: 1,
      totalUserCount: cleanupState.baselineUserCount + 1,
    });

    stage = "real Clerk sign-in";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    await clerk.signIn({
      emailAddress: temporaryEmail,
      page,
      setupClerkTestingTokenOptions: { frontendApiUrl: keyPair.frontendApiHost },
    });

    stage = "authenticated workspace";
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => url.pathname === "/workspace");
    await expect(page.locator("main.workspace-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /沿着一条闭环/ })).toBeVisible();
    await expect(page.locator("[data-cycle-history]")).toBeVisible();
    await expect(page.getByRole("heading", {
      level: 2,
      name: /上一轮计划怎么变.*只看通过核对的版本/,
    })).toBeVisible();
    await expect(page.locator("[data-cycle-history-summary]")).toHaveText(
      "尚无已完成或待具备资格人员复核的历史轮次",
    );
    await expect(page.locator("[data-gate0-summary]")).toHaveAttribute("data-gate0-state", "blocked");
    await expect(page.locator("[data-gate0-status]")).toHaveText("Gate 0 尚未通过");
    await expect(page.locator("[data-gate0-resolved]")).toHaveText("0");
    await expect(page.locator("[data-gate0-total]")).toHaveText("29");
    await expect(page.locator("[data-source-governance]")).toHaveAttribute("data-source-governance-state", "none-admitted");
    await expect(page.locator("[data-source-governance-status]")).toHaveText("RAG 准入仍为 0 条");
    await expect(page.locator("[data-source-rag-eligible]")).toHaveText("0");
    await expect(page.locator('[data-source-criterion="exam-version"]')).toHaveText("10 / 15");

    stage = "authenticated teaching-review demo";
    await page.goto("/teaching-review-demo", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => url.pathname === "/teaching-review-demo");
    await expect(page.locator('[data-teaching-review-demo="gate_a_local_only"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "教研复核演示台" })).toBeVisible();

    stage = "Clerk sign-out";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    await clerk.signOut({ page });

    stage = "post-sign-out route protection";
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/sign-in");
    await expect(page.locator(".cl-signIn-root")).toBeVisible();
  } catch {
    throw new Error(`Clerk Development smoke failed during ${stage}.`);
  }
});
