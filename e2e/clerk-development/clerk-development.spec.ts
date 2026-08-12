import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import {
  expect,
  test,
  type Dialog,
  type Locator,
  type Request as PlaywrightRequest,
  type Response as PlaywrightResponse,
} from "@playwright/test";

import {
  assertCanonicalClerkApiEnvironment,
  assertMatchingDevelopmentClerkInstance,
  assertVerifiedClerkTestingHandoff,
  ClerkExactUserDeletionError,
  CLERK_E2E_API_URL,
  CLERK_E2E_API_VERSION,
  deleteClerkExactUserWithVerification,
  getClerkDevelopmentE2ETarget,
  getClerkDevelopmentKeyPair,
  getVercelHostedProtectionBypass,
  installClerkTestingLogRedaction,
  recoverClerkExactUserDuringCreationUncertainty,
  retryClerkIdempotentMutation,
} from "./clerk-development-config";

const SOFIA_WORKSPACE_KEY = "sufeiya_workspace_v1";
const SOFIA_CHAT_KEY = "sufeiya_super_teacher_v1";
const TEACHING_REVIEW_DEMO_KEY = "sufeiya_teaching_review_demo_v1";
const CLERK_BROWSER_BOOT_TIMEOUT_MS = 60_000;

const canonicalJson = (value: unknown): string => {
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
};

type SmokeStage =
  | "testing-token handoff"
  | "Vercel hosted protection bootstrap"
  | "Development instance revalidation"
  | "user-count baseline"
  | "signed-out route navigation"
  | "signed-out route redirect"
  | "signed-out Clerk UI"
  | "signed-out invitation-only registration"
  | "browser runtime instance binding"
  | "temporary synthetic identifier preflight"
  | "temporary synthetic user creation"
  | "temporary synthetic user visibility"
  | "signed-in uninvited Sofia local-data isolation"
  | "signed-in uninvited Sofia page isolation"
  | "signed-in uninvited Sofia page access context"
  | "signed-in uninvited Sofia page copy"
  | "signed-in uninvited Sofia page controls"
  | "signed-in uninvited Sofia page storage"
  | "signed-in uninvited Sofia floating isolation"
  | "signed-in uninvited Sofia marker preservation"
  | "signed-in uninvited workspace denial"
  | "signed-in uninvited API denial"
  | "temporary synthetic invitation approval"
  | "temporary synthetic invitation visibility"
  | "temporary synthetic signed session claim refresh"
  | "anonymous Clerk-free 404 navigation"
  | "anonymous Clerk-free 404 title hydration"
  | "anonymous Clerk-free 404 heading hydration"
  | "anonymous Clerk-free 404 robots metadata"
  | "anonymous Clerk-free 404 account links"
  | "anonymous Clerk-free 404 Sofia absence"
  | "anonymous Clerk-free 404 script hydration"
  | "anonymous Clerk-free 404 network isolation"
  | "anonymous 404 full-document Clerk navigation"
  | "anonymous 404 Clerk document response"
  | "anonymous 404 Clerk account-mode response"
  | "anonymous 404 Clerk strict-CSP response"
  | "real Clerk sign-in"
  | "real Clerk sign-in page"
  | "real Clerk sign-in runtime"
  | "temporary synthetic sign-in token"
  | "real Clerk sign-in session"
  | "signed-in uninvited session claim refresh"
  | "authenticated Gate A fresh workspace"
  | "authenticated Gate A diagnostic preflight"
  | "authenticated Gate A first Reading evidence"
  | "authenticated Gate A remaining task skips"
  | "authenticated Gate A priority confirmation"
  | "authenticated Gate A plan"
  | "authenticated Gate A recommendation"
  | "authenticated Gate A sealed recommendation plan protection"
  | "authenticated Gate A bound Reading practice"
  | "authenticated Gate A evidence check-in"
  | "authenticated Gate A sealed check-in revision protection"
  | "authenticated Gate A learner review"
  | "authenticated Gate A learner review transaction"
  | "authenticated Gate A learner review idempotency"
  | "authenticated Gate A community preview"
  | "authenticated Gate A community decision"
  | "authenticated Gate A community receipt"
  | "authenticated Gate A community idempotency"
  | "authenticated Gate A community mutable choice"
  | "authenticated Gate A community final choice"
  | "authenticated Gate A provisional retest branch"
  | "authenticated Gate A provisional workspace handoff"
  | "authenticated Gate A Sofia strict packet ready state"
  | "authenticated Gate A Sofia strict packet click"
  | "authenticated Gate A Sofia strict packet storage receipt"
  | "authenticated Gate A Sofia strict packet visible notice"
  | "authenticated Gate A Sofia strict packet schema"
  | "authenticated Gate A Sofia stale packet recovery"
  | "authenticated Gate A community downstream seal"
  | "authenticated Gate A community network isolation"
  | "authenticated Gate A Reading retest"
  | "authenticated Gate A updated plan"
  | "authenticated Gate A completed workspace"
  | "authenticated Gate A local-state integrity"
  | "authenticated Gate A next-cycle admission intent"
  | "authenticated Gate A restorable backup export"
  | `authenticated Gate A restorable backup export rejected (${string})`
  | "authenticated Gate A restorable backup continuity projection"
  | "authenticated Gate A workspace-only clear"
  | "authenticated Gate A tampered backup rejection"
  | "authenticated Gate A rehashed invalid-domain backup rejection"
  | "authenticated Gate A valid backup preview"
  | "authenticated Gate A atomic restore"
  | "authenticated Gate A restore network isolation"
  | "authenticated Gate A restore namespace integrity"
  | "authenticated Gate A restored same-page raw export"
  | "authenticated Gate A restored same-page event clear"
  | "authenticated Gate A second atomic restore"
  | "authenticated Gate A restored continuity"
  | "synthetic capacity UI probe only — journey composite, not 7/7 evidence"
  | "synthetic capacity UI probe only — standalone practice, not 7/7 evidence"
  | "synthetic capacity UI probe only — focus terminal, not 7/7 evidence"
  | "synthetic capacity UI probe only — focus start, not 7/7 evidence"
  | "synthetic capacity UI probe only — focus start rejection, not 7/7 evidence"
  | "synthetic capacity UI probe only — focus start restore, not 7/7 evidence"
  | "authenticated teaching-review demo"
  | "authenticated Sofia local explanation"
  | "authenticated Sofia landscape session refresh"
  | "authenticated Sofia landscape navigation"
  | "authenticated Sofia landscape launcher"
  | "authenticated Sofia landscape dialog"
  | "Clerk sign-out"
  | "post-sign-out Sofia privacy"
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

type ClerkCleanupPhase =
  | "identity_recovery"
  | "delete_call"
  | "delete_ack"
  | "exact_absence"
  | "baseline_count";

test.describe.configure({ mode: "serial" });

test.afterEach("remove the exact synthetic Development user", async ({ context }, testInfo) => {
  testInfo.setTimeout(120_000);
  const cleanupState = clerkCleanupState;
  clerkCleanupState = null;
  if (!cleanupState) return;

  let cleanupFailure: Error | null = null;
  let cleanupPhase: ClerkCleanupPhase = "identity_recovery";
  let contextTeardownFailure: Error | null = null;
  try {
    if (cleanupState.creationAttempted) {
      if (cleanupState.baselineUserCount === null || cleanupState.temporaryExternalId === null) {
        throw new Error("cleanup identity unavailable");
      }

      cleanupPhase = "identity_recovery";
      const recoveredSyntheticUser = await recoverClerkExactUserDuringCreationUncertainty(
        async () => {
          const recoveredUsers = await retryClerkIdempotentMutation(() => (
            cleanupState.client.users.getUserList({
              externalId: [cleanupState.temporaryExternalId!],
              limit: 2,
            })
          ));
          return recoveredUsers.data;
        },
      );
      if (
        recoveredSyntheticUser !== null
        && cleanupState.temporaryUserId !== null
        && recoveredSyntheticUser.id !== cleanupState.temporaryUserId
      ) {
        throw new Error("cleanup recovered identity mismatch");
      }
      cleanupState.temporaryUserId = recoveredSyntheticUser?.id ?? cleanupState.temporaryUserId;

      if (recoveredSyntheticUser !== null) {
        if (
          recoveredSyntheticUser.externalId !== cleanupState.temporaryExternalId
          || recoveredSyntheticUser.privateMetadata.sufeiyaSyntheticClerkE2E !== true
        ) {
          throw new Error("cleanup synthetic identity boundary mismatch");
        }
      } else if (cleanupState.temporaryUserId !== null) {
        const recoveredById = await recoverClerkExactUserDuringCreationUncertainty(
          async () => {
            const recoveredUsers = await retryClerkIdempotentMutation(() => (
              cleanupState.client.users.getUserList({
                userId: [cleanupState.temporaryUserId!],
                limit: 2,
              })
            ));
            return recoveredUsers.data;
          },
        );
        if (recoveredById !== null) {
          if (
            recoveredById.id !== cleanupState.temporaryUserId
            || recoveredById.externalId !== cleanupState.temporaryExternalId
            || recoveredById.privateMetadata.sufeiyaSyntheticClerkE2E !== true
          ) {
            throw new Error("cleanup synthetic identity boundary mismatch");
          }
        } else {
          cleanupState.temporaryUserId = null;
        }
      }

      if (cleanupState.temporaryUserId !== null) {
        cleanupPhase = "delete_call";
        await deleteClerkExactUserWithVerification(cleanupState.temporaryUserId, {
          deleteUser: (userId) => cleanupState.client.users.deleteUser(userId),
          getExactUserCount: (userId) => cleanupState.client.users.getCount({ userId: [userId] }),
        });
      }

      cleanupPhase = "exact_absence";
      for (const observationDelayMs of [0, 5_000] as const) {
        if (observationDelayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, observationDelayMs));
        }
        const exactExternalIdCount = await retryClerkIdempotentMutation(() => (
          cleanupState.client.users.getCount({ externalId: [cleanupState.temporaryExternalId!] })
        ));
        const exactTemporaryUserCount = cleanupState.temporaryUserId === null
          ? 0
          : await retryClerkIdempotentMutation(() => (
            cleanupState.client.users.getCount({ userId: [cleanupState.temporaryUserId!] })
          ));
        expect({ exactExternalIdCount, exactTemporaryUserCount }).toEqual({
          exactExternalIdCount: 0,
          exactTemporaryUserCount: 0,
        });
      }

      cleanupPhase = "baseline_count";
      for (const observationDelayMs of [0, 2_500] as const) {
        if (observationDelayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, observationDelayMs));
        }
        expect(await retryClerkIdempotentMutation(
          () => cleanupState.client.users.getCount(),
        )).toBe(cleanupState.baselineUserCount);
      }
    }
  } catch (error) {
    if (error instanceof ClerkExactUserDeletionError) cleanupPhase = error.phase;
    cleanupFailure = new Error(
      `Clerk Development smoke cleanup failed during ${cleanupPhase}; no identity details were retained.`,
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
  const refreshApprovedSessionBeforeDocumentNavigation = async () => {
    await expect.poll(forceRefreshClerkSessionToken, {
      intervals: [1_000, 2_000, 5_000, 10_000],
      timeout: 30_000,
    }).toBe("token_refreshed");
  };

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
      retryClerkIdempotentMutation(() => client.instance.get()),
      retryClerkIdempotentMutation(() => client.domains.list()),
    ]);
    assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: instance.environmentType,
      frontendApiUrls: domains.data.map((domain) => domain.frontendApiUrl),
    });

    stage = "user-count baseline";
    cleanupState.baselineUserCount = await retryClerkIdempotentMutation(
      () => client.users.getCount(),
    );

    await setupClerkTestingToken({
      page,
      options: { frontendApiUrl: keyPair.frontendApiHost },
    });

    stage = "anonymous Clerk-free 404 navigation";
    const anonymousForbiddenNetworkTargets = new Set<string>();
    const anonymousNextScriptFailures: string[] = [];
    const anonymousNextScriptStatuses = new Map<string, number>();
    const recordAnonymousRequest = (request: PlaywrightRequest) => {
      const requestUrl = new URL(request.url());
      const isDirectClerkRequest =
        requestUrl.hostname === keyPair.frontendApiHost
        || requestUrl.hostname === "clerk-telemetry.com"
        || requestUrl.hostname.endsWith(".clerk.accounts.dev")
        || requestUrl.hostname === "clerk.com"
        || requestUrl.hostname.endsWith(".clerk.com")
        || /clerk\.browser\.js|\/@clerk\//i.test(requestUrl.pathname);
      const isApplicationClerkRequest =
        requestUrl.origin === new URL(target.baseURL).origin
        && (
          requestUrl.pathname === "/__clerk"
          || requestUrl.pathname.startsWith("/__clerk/")
          || requestUrl.pathname === "/api/super-teacher"
          || requestUrl.pathname.startsWith("/api/super-teacher/")
        );
      if (isDirectClerkRequest) {
        anonymousForbiddenNetworkTargets.add(
          `external-clerk:${requestUrl.origin}${requestUrl.pathname}`,
        );
      } else if (isApplicationClerkRequest) {
        anonymousForbiddenNetworkTargets.add(`application:${requestUrl.pathname}`);
      }
    };
    const recordAnonymousRequestFailure = (request: PlaywrightRequest) => {
      const requestPath = new URL(request.url()).pathname;
      if (requestPath.startsWith("/_next/static/") && requestPath.endsWith(".js")) {
        anonymousNextScriptFailures.push(requestPath);
      }
    };
    const recordAnonymousResponse = (response: PlaywrightResponse) => {
      const requestPath = new URL(response.url()).pathname;
      if (requestPath.startsWith("/_next/static/") && requestPath.endsWith(".js")) {
        anonymousNextScriptStatuses.set(requestPath, response.status());
      }
    };
    page.on("request", recordAnonymousRequest);
    page.on("requestfailed", recordAnonymousRequestFailure);
    page.on("response", recordAnonymousResponse);
    try {
      const anonymousResponse = await page.goto(
        "/__codex_clerk_free_404/nested-route",
        { waitUntil: "domcontentloaded" },
      );
      expect(anonymousResponse?.status()).toBe(404);
      const anonymousHeaders = anonymousResponse?.headers() ?? {};
      expect(anonymousHeaders["x-sufeiya-account-mode"]).toBe("anonymous-no-clerk");
      expect(anonymousHeaders["content-security-policy"]).toContain(
        "script-src 'self' 'unsafe-inline'",
      );
      expect(anonymousHeaders["content-security-policy"]).toContain("script-src-attr 'none'");
      expect(anonymousHeaders["content-security-policy"]).not.toMatch(
        /nonce-|strict-dynamic|clerk/i,
      );

      stage = "anonymous Clerk-free 404 title hydration";
      await expect(page).toHaveTitle("页面没有找到｜苏肥鸭多邻国");

      stage = "anonymous Clerk-free 404 heading hydration";
      await expect(page.getByRole("heading", {
        level: 1,
        name: "这一页暂时没有学习任务。",
      })).toHaveCount(1);

      stage = "anonymous Clerk-free 404 robots metadata";
      const anonymousRobotsPolicies = await page.locator('meta[name="robots"]')
        .evaluateAll((metas) => metas.map((meta) => (
          (meta as HTMLMetaElement).content
        )));
      expect(anonymousRobotsPolicies.length).toBeGreaterThan(0);
      expect(anonymousRobotsPolicies.every((policy) => /\bnoindex\b/i.test(policy))).toBe(true);

      stage = "anonymous Clerk-free 404 account links";
      await expect(page.getByRole("link", { name: "登录", exact: true })).toHaveAttribute(
        "href",
        "/sign-in",
      );
      await expect(page.getByRole("link", { name: "登录", exact: true })).toHaveAttribute(
        "target",
        "_top",
      );
      await expect(page.getByRole("link", { name: "登录", exact: true })).toHaveAttribute(
        "data-full-document-navigation-ready",
        "true",
      );
      await expect(page.getByRole("link", { name: "邀请制内测", exact: true })).toHaveAttribute(
        "href",
        "/sign-up",
      );
      await expect(page.getByRole("link", { name: "邀请制内测", exact: true })).toHaveAttribute(
        "target",
        "_top",
      );

      stage = "anonymous Clerk-free 404 Sofia absence";
      await expect(page.getByRole("button", { name: /打开 Sofia智能老师对话/ })).toHaveCount(0);

      stage = "anonymous Clerk-free 404 script hydration";
      const anonymousNextScriptPaths = await page.locator('script[src*="/_next/static/"]')
        .evaluateAll((scripts) => [...new Set(scripts
          .filter((script) => !(script as HTMLScriptElement).noModule)
          .map((script) => new URL((script as HTMLScriptElement).src).pathname))].sort());
      expect(anonymousNextScriptPaths.length).toBeGreaterThan(0);
      await expect.poll(() => anonymousNextScriptPaths.map((path) => (
        anonymousNextScriptStatuses.get(path) ?? null
      ))).toEqual(anonymousNextScriptPaths.map(() => 200));
      expect(anonymousNextScriptFailures).toEqual([]);

      stage = "anonymous Clerk-free 404 network isolation";
      expect([...anonymousForbiddenNetworkTargets].sort()).toEqual([]);
    } finally {
      page.off("request", recordAnonymousRequest);
      page.off("requestfailed", recordAnonymousRequestFailure);
      page.off("response", recordAnonymousResponse);
    }

    stage = "anonymous 404 full-document Clerk navigation";
    const clerkHandoffDocuments: PlaywrightResponse[] = [];
    const recordClerkHandoffDocument = (response: PlaywrightResponse) => {
      if (response.request().resourceType() === "document") {
        clerkHandoffDocuments.push(response);
      }
    };
    page.on("response", recordClerkHandoffDocument);
    try {
      const signInNavigation = page.waitForURL((url) => url.pathname === "/sign-in", {
        waitUntil: "domcontentloaded",
      });
      await page.getByRole("link", { name: "登录", exact: true }).click({ noWaitAfter: true });
      await signInNavigation;

      stage = "anonymous 404 Clerk document response";
      const signInDocument = [...clerkHandoffDocuments].reverse().find((response) => (
        new URL(response.url()).pathname === "/sign-in" && response.status() === 200
      ));
      expect(signInDocument?.status()).toBe(200);
      const signInHeaders = signInDocument?.headers() ?? {};

      stage = "anonymous 404 Clerk account-mode response";
      expect(signInHeaders["x-sufeiya-account-mode"]).toBe(
        "clerk-invite-gated-local-learning-data",
      );
      expect(signInHeaders["x-sufeiya-beta-access"]).toBe("signed_out");

      stage = "anonymous 404 Clerk strict-CSP response";
      expect(signInHeaders["content-security-policy"]).toMatch(/nonce-[^;' ]+/);
      expect(signInHeaders["content-security-policy"]).toContain("strict-dynamic");
    } finally {
      page.off("response", recordClerkHandoffDocument);
    }

    stage = "signed-out route navigation";
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    stage = "signed-out route redirect";
    await page.waitForURL((url) => url.pathname === "/sign-in");
    stage = "signed-out Clerk UI";
    await expect(page.locator(".cl-signIn-root")).toBeVisible({
      timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
    });

    stage = "signed-out invitation-only registration";
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-beta-access-state="registration"]')).toBeVisible();
    await expect(page.locator(".cl-signUp-root")).toHaveCount(0);
    await expect(page.getByRole("heading", {
      level: 2,
      name: "当前仅接受受邀学习者。",
    })).toBeVisible();

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

    stage = "temporary synthetic identifier preflight";
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

    stage = "temporary synthetic user creation";
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

    stage = "temporary synthetic user visibility";
    await expect.poll(async () => ({
      exactTemporaryUserCount: await client.users.getCount({ userId: [cleanupState.temporaryUserId!] }),
      totalUserCount: await client.users.getCount(),
    })).toEqual({
      exactTemporaryUserCount: 1,
      totalUserCount: cleanupState.baselineUserCount + 1,
    });

    stage = "real Clerk sign-in";
    stage = "real Clerk sign-in page";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    stage = "real Clerk sign-in runtime";
    await clerk.loaded({ page });
    stage = "temporary synthetic sign-in token";
    const temporarySignInToken = await client.signInTokens.createSignInToken({
      expiresInSeconds: 300,
      userId: temporaryUser.id,
    });
    stage = "real Clerk sign-in session";
    await clerk.signIn({
      page,
      signInParams: {
        strategy: "ticket",
        ticket: temporarySignInToken.token,
      },
      setupClerkTestingTokenOptions: { frontendApiUrl: keyPair.frontendApiHost },
    });

    stage = "signed-in uninvited session claim refresh";
    await expect.poll(forceRefreshClerkSessionToken, {
      intervals: [1_000, 2_000, 5_000, 10_000],
      timeout: 30_000,
    }).toBe("token_refreshed");

    stage = "signed-in uninvited Sofia local-data isolation";
    await page.evaluate(
      ({ chatKey, workspaceKey }) => {
        window.localStorage.setItem(workspaceKey, JSON.stringify({ previousLearnerMarker: true }));
        window.localStorage.setItem(chatKey, JSON.stringify({ previousPrivateQuestion: true }));
        window.sessionStorage.setItem("sufeiya_clerk_uninvited_storage_probe", "active");
      },
      { chatKey: SOFIA_CHAT_KEY, workspaceKey: SOFIA_WORKSPACE_KEY },
    );
    await page.addInitScript(
      ({ chatKey, workspaceKey }) => {
        if (window.sessionStorage.getItem("sufeiya_clerk_uninvited_storage_probe") !== "active") return;
        const trackedWindow = window as Window & {
          __sufeiyaUninvitedPrivateStorageReads?: string[];
        };
        trackedWindow.__sufeiyaUninvitedPrivateStorageReads = [];
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function getTrackedUninvitedPrivateItem(key: string) {
          if (
            this === window.localStorage
            && (key === chatKey || key === workspaceKey)
          ) {
            trackedWindow.__sufeiyaUninvitedPrivateStorageReads?.push(key);
          }
          return originalGetItem.call(this, key);
        };
      },
      { chatKey: SOFIA_CHAT_KEY, workspaceKey: SOFIA_WORKSPACE_KEY },
    );
    stage = "signed-in uninvited Sofia page isolation";
    const uninvitedSofiaPageResponse = await page.goto("/super-teacher", {
      waitUntil: "domcontentloaded",
    });
    stage = "signed-in uninvited Sofia page access context";
    expect(uninvitedSofiaPageResponse?.status()).toBe(200);
    expect(uninvitedSofiaPageResponse?.headers()["x-sufeiya-beta-access"]).toBe(
      "invitation_required",
    );
    await expect(page.locator('[data-beta-access-state="waiting"]')).toHaveCount(0);
    stage = "signed-in uninvited Sofia page copy";
    await expect(page.getByRole("heading", {
      level: 2,
      name: "当前账户没有有效内测资格。",
    })).toBeVisible();
    stage = "signed-in uninvited Sofia page controls";
    await expect(page.getByRole("textbox", { name: "输入学习问题" })).toHaveCount(0);
    stage = "signed-in uninvited Sofia page storage";
    expect(await page.evaluate(() => (
      window as Window & { __sufeiyaUninvitedPrivateStorageReads?: string[] }
    ).__sufeiyaUninvitedPrivateStorageReads ?? [])).toEqual([]);

    stage = "signed-in uninvited Sofia floating isolation";
    await page.goto("/resources", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "打开 Sofia智能老师公开介绍" }).click();
    await expect(page.getByRole("dialog")).toContainText("当前账户没有有效内测资格。");
    await expect(page.getByRole("textbox", { name: "输入学习问题" })).toHaveCount(0);
    expect(await page.evaluate(() => (
      window as Window & { __sufeiyaUninvitedPrivateStorageReads?: string[] }
    ).__sufeiyaUninvitedPrivateStorageReads ?? [])).toEqual([]);
    stage = "signed-in uninvited Sofia marker preservation";
    const retainedUninvitedMarkers = await page.evaluate(
      ({ chatKey, workspaceKey }) => ({
        chat: window.localStorage.getItem(chatKey),
        workspace: window.localStorage.getItem(workspaceKey),
      }),
      { chatKey: SOFIA_CHAT_KEY, workspaceKey: SOFIA_WORKSPACE_KEY },
    );
    expect(retainedUninvitedMarkers).toEqual({
      chat: JSON.stringify({ previousPrivateQuestion: true }),
      workspace: JSON.stringify({ previousLearnerMarker: true }),
    });
    await page.evaluate(({ chatKey, workspaceKey }) => {
      window.sessionStorage.removeItem("sufeiya_clerk_uninvited_storage_probe");
      window.localStorage.removeItem(chatKey);
      window.localStorage.removeItem(workspaceKey);
    }, { chatKey: SOFIA_CHAT_KEY, workspaceKey: SOFIA_WORKSPACE_KEY });

    stage = "signed-in uninvited workspace denial";
    await page.goto("/workspace/private.js", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => (
      url.pathname === "/beta-access"
      && url.searchParams.get("return_path") === "/workspace/private.js"
    ));
    await expect(page.locator('[data-beta-access-state="waiting"]')).toBeVisible();
    await expect(page.getByRole("heading", {
      level: 2,
      name: "当前账户没有有效内测资格。",
    })).toBeVisible();
    await expect(page.locator("main.workspace-page")).toHaveCount(0);

    stage = "signed-in uninvited API denial";
    const deniedApi = await page.evaluate(async () => {
      const response = await fetch("/api/super-teacher", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return {
        body: await response.json() as { error?: string },
        status: response.status,
      };
    });
    expect(deniedApi).toEqual({
      body: { error: "beta_invitation_required", requestId: expect.any(String) },
      status: 403,
    });

    stage = "temporary synthetic invitation approval";
    await retryClerkIdempotentMutation(() => (
      client.users.updateUserMetadata(temporaryUser.id, {
        publicMetadata: {
          sufeiyaBetaAccess: {
            protocolVersion: "sufeiya_invite_only_beta_v1",
            status: "approved",
          },
        },
      })
    ));

    stage = "temporary synthetic invitation visibility";
    await expect.poll(async () => {
      const visibleUser = await client.users.getUser(temporaryUser.id);
      return visibleUser.publicMetadata;
    }).toEqual({
      sufeiyaBetaAccess: {
        protocolVersion: "sufeiya_invite_only_beta_v1",
        status: "approved",
      },
    });

    stage = "temporary synthetic signed session claim refresh";
    await expect.poll(forceRefreshClerkSessionToken, {
      intervals: [1_000, 2_000, 5_000, 10_000],
      timeout: 30_000,
    }).toBe("token_refreshed");

    const gotoApprovedRoute = async (pathname: string) => {
      const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      expect(response?.headers()["x-sufeiya-beta-access"]).toBe("approved");
      await expect(page).toHaveURL((url) => url.pathname === new URL(pathname, target.baseURL).pathname);
      return response;
    };
    const expectNonemptyText = async (locator: Locator) => {
      await expect(locator).toHaveText(/\S+/);
      return (await locator.textContent())!.trim();
    };
    const readLocalNamespaces = () => page.evaluate(
      ({ chatKey, teachingReviewKey, workspaceKey }) => ({
        chat: window.localStorage.getItem(chatKey),
        teachingReview: window.localStorage.getItem(teachingReviewKey),
        workspace: window.localStorage.getItem(workspaceKey),
      }),
      {
        chatKey: SOFIA_CHAT_KEY,
        teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
        workspaceKey: SOFIA_WORKSPACE_KEY,
      },
    );
    const readWorkspaceByteSnapshot = () => page.evaluate((workspaceKey) => {
      const raw = window.localStorage.getItem(workspaceKey);
      if (raw === null) throw new Error("workspace namespace is unexpectedly absent");
      const parsed = JSON.parse(raw) as {
        journey?: unknown;
        plan?: unknown;
        planHistory?: unknown;
        learningEvents?: unknown;
        learningEventBindings?: unknown;
      };
      return {
        raw,
        stateBytes: JSON.stringify(parsed),
        journeyBytes: JSON.stringify({
          journey: parsed.journey,
          plan: parsed.plan,
          planHistory: parsed.planHistory,
        }),
        ledgerBytes: JSON.stringify({
          learningEvents: parsed.learningEvents,
          learningEventBindings: parsed.learningEventBindings,
        }),
      };
    }, SOFIA_WORKSPACE_KEY);
    const holdSealedWriteForPendingObservation = async () => {
      await page.evaluate(async (workspaceKey) => {
        const scopedWindow = window as Window & typeof globalThis & {
          __sufeiyaE2EReleaseSealedWrite?: () => void;
        };
        if (scopedWindow.__sufeiyaE2EReleaseSealedWrite) {
          throw new Error("sealed-write observation lock is already held");
        }
        let markAcquired: (() => void) | null = null;
        const acquired = new Promise<void>((resolve) => {
          markAcquired = resolve;
        });
        const request = navigator.locks.request(
          `${workspaceKey}:sealed-write`,
          { mode: "exclusive" },
          async (lock) => {
            if (!lock) throw new Error("sealed-write observation lock was unavailable");
            let release: (() => void) | null = null;
            const held = new Promise<void>((resolve) => {
              release = resolve;
            });
            scopedWindow.__sufeiyaE2EReleaseSealedWrite = () => release?.();
            markAcquired?.();
            await held;
          },
        );
        void request.catch(() => undefined);
        await acquired;
      }, SOFIA_WORKSPACE_KEY);

      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await page.evaluate(() => {
          const scopedWindow = window as Window & typeof globalThis & {
            __sufeiyaE2EReleaseSealedWrite?: () => void;
          };
          const release = scopedWindow.__sufeiyaE2EReleaseSealedWrite;
          if (!release) throw new Error("sealed-write observation release is unavailable");
          delete scopedWindow.__sufeiyaE2EReleaseSealedWrite;
          release();
        });
      };
    };

    stage = "authenticated Gate A fresh workspace";
    await gotoApprovedRoute("/workspace");
    await expect(page).toHaveURL((url) => url.pathname === "/workspace");
    await expect(page.locator("main.workspace-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /沿着一条闭环/ })).toBeVisible();
    await expect(page.locator("[data-journey-summary]")).toHaveText("0 / 7 步已留证");
    await expect(page.locator("[data-cycle-ledger]")).toHaveAttribute("data-cycle-state", "empty");
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

    stage = "authenticated Gate A diagnostic preflight";
    await gotoApprovedRoute("/diagnostic");
    await expect(page.locator("[data-device-storage]")).toHaveText("可用 · 本机保存");
    await expect(page.locator("[data-device-lock]")).toHaveText("支持 · 防跨页覆盖");
    const diagnosticStartForm = page.locator("#diagnostic-start-form");
    for (const confirmation of [
      "adultConfirmed",
      "localBoundaryConfirmed",
      "noScoreConfirmed",
      "environmentConfirmed",
    ]) {
      await diagnosticStartForm.locator(`input[name="${confirmation}"]`).check();
    }
    await diagnosticStartForm.locator('input[name="keyboardCheck"]').fill("E2E");
    await diagnosticStartForm.locator("[data-audio-test]").click();
    await diagnosticStartForm.locator('input[name="audioOutput"][value="heard"]').check();
    await diagnosticStartForm.getByRole("button", { name: "开始六项原创任务" }).click();
    await expect(page.locator("[data-diagnostic-status]")).toHaveText("六项任务进行中");
    await expect(page.locator('[data-diagnostic-task][data-task-id="diagnostic-reading-library-v1"]')).toBeVisible();

    stage = "authenticated Gate A first Reading evidence";
    const firstReadingTask = page.locator(
      '[data-diagnostic-task][data-task-id="diagnostic-reading-library-v1"]',
    );
    await firstReadingTask.locator('input[type="radio"][value="b"]').check();
    await firstReadingTask.locator("[data-diagnostic-submit-task]").click();
    await expect(page.locator('[data-diagnostic-step="diagnostic-reading-library-v1"] [data-step-state]'))
      .toHaveText("已留证");

    stage = "authenticated Gate A remaining task skips";
    const acceptDiagnosticSkipDialog = (dialog: Dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("不会被记作零分");
      void dialog.accept();
    };
    page.on("dialog", acceptDiagnosticSkipDialog);
    const skippedDiagnosticTaskIds = [
      "diagnostic-reading-newsletter-v1",
      "diagnostic-listening-science-club-v1",
      "diagnostic-listening-language-lab-v1",
      "diagnostic-speaking-learning-skill-v1",
      "diagnostic-writing-learning-place-v1",
    ];
    for (const [index, taskId] of skippedDiagnosticTaskIds.entries()) {
      const task = page.locator(`[data-diagnostic-task][data-task-id="${taskId}"]`);
      await expect(task).toBeVisible();
      await task.locator("[data-diagnostic-skip-task]:visible").click();
      if (index < skippedDiagnosticTaskIds.length - 1) {
        await expect(page.locator(`[data-diagnostic-step="${taskId}"] [data-step-state]`))
          .toHaveText("已跳过");
      }
    }
    page.off("dialog", acceptDiagnosticSkipDialog);
    await expect(page.locator("[data-diagnostic-report]")).toBeVisible();
    await expect(page.locator("[data-report-summary]")).toContainText(
      "六项任务已有 6 项终态，其中 1 项形成完成证据",
    );

    stage = "authenticated Gate A priority confirmation";
    const diagnosticPriorityForm = page.locator("#diagnostic-priority-form");
    await diagnosticPriorityForm.locator('input[name="prioritySkill"][value="Reading"]').check();
    await diagnosticPriorityForm.locator('input[name="learnerConfirmedPriority"]').check();
    await diagnosticPriorityForm.getByRole("button", { name: "确认并生成诊断回执" }).click();
    await expect(page.locator("[data-diagnostic-result]")).toBeVisible();
    await expect(page.locator("[data-diagnostic-priority]")).toHaveText("Reading · 阅读");
    await expect(page.locator("[data-diagnostic-receipt-sufficiency]"))
      .toHaveText("evidence_insufficient · 证据不足");
    const diagnosticSessionId = await expectNonemptyText(page.locator("[data-diagnostic-id]"));
    expect(diagnosticSessionId).toMatch(/^diagnostic-/);

    stage = "authenticated Gate A plan";
    await gotoApprovedRoute("/plan");
    const planForm = page.locator("#plan-form");
    await expect(planForm.locator('select[name="focusSkill"]')).toBeDisabled();
    await expect(planForm.locator('select[name="focusSkill"]')).toHaveValue("Reading");
    await planForm.locator('select[name="dailyMinutes"]').selectOption("15");
    await planForm.getByRole("button", { name: "生成 7 天计划" }).click();
    await expect(page.locator("[data-plan-result]")).toBeVisible();
    await expect(page.locator("[data-plan-summary]")).toContainText("每天 15 分钟 · 重点：Reading · 阅读");
    const planNext = page.locator("[data-plan-next]");
    await expect(planNext).toBeVisible();
    await expect(planNext).toHaveAttribute("href", "/recommendations");
    await expect(planNext.locator("[data-plan-next-label]")).toHaveText("下一步：查看内容推荐");

    stage = "authenticated Gate A recommendation";
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [recommendationsResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/recommendations"
      )),
      planNext.click(),
    ]);
    expect(recommendationsResponse.status()).toBe(200);
    expect(recommendationsResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");
    await expect(page).toHaveURL((url) => url.pathname === "/recommendations");
    await expect(page.locator("[data-recommendation-ready]")).toBeVisible();
    await expect(page.locator(".recommendation-card.is-primary")).toContainText("Reading");
    await page.locator("[data-accept-recommendation]").click();
    await expect(page.locator("[data-recommendation-receipt]")).toBeVisible();
    await expect(page.locator("[data-recommendation-status]")).toHaveText("已接受主任务");
    const recommendationId = await expectNonemptyText(page.locator("[data-recommendation-id]"));
    const recommendationPlanId = await expectNonemptyText(page.locator("[data-recommendation-plan-id]"));
    await expectNonemptyText(page.locator("[data-recommendation-binding-id]"));
    const recommendationStart = page.locator("[data-recommendation-start]");
    await expect(recommendationStart).toBeVisible();
    await expect(recommendationStart).toHaveAttribute(
      "href",
      /\/practice-reading\?plan_id=[^&]+&task_id=[^&]+/,
    );

    stage = "authenticated Gate A sealed recommendation plan protection";
    const sealedRecommendationSnapshot = await readWorkspaceByteSnapshot();
    await gotoApprovedRoute("/plan");
    await expect(planForm).toBeVisible();
    await expect(planForm.locator('select[name="focusSkill"]')).toBeDisabled();
    await expect(planForm.locator('select[name="focusSkill"]')).toHaveValue("Reading");
    await planForm.locator('select[name="dailyMinutes"]').selectOption("30");
    await planForm.getByRole("button", { name: "生成 7 天计划" }).click();
    const sealedPlanAlert = page.locator("[data-workspace-sealed-alert]");
    await expect(sealedPlanAlert).toBeVisible();
    await expect(sealedPlanAlert).toHaveAttribute("role", "alert");
    await expect(sealedPlanAlert).toHaveAttribute("tabindex", "-1");
    await expect(sealedPlanAlert).toBeFocused();
    await expect(sealedPlanAlert).toContainText("已封存推荐或后续证据");
    await expect(sealedPlanAlert).toContainText("不能手动替换绑定计划");
    await expect(sealedPlanAlert).toContainText("不会删除已封存事件");
    await expect(sealedPlanAlert.getByRole("link", { name: /开始新诊断/ }))
      .toHaveAttribute("href", "/diagnostic");
    expect(await readWorkspaceByteSnapshot()).toEqual(sealedRecommendationSnapshot);

    await gotoApprovedRoute("/recommendations");
    await expect(page.locator("[data-recommendation-receipt]")).toBeVisible();
    await expect(page.locator("[data-recommendation-status]")).toHaveText("已接受主任务");
    expect(await expectNonemptyText(page.locator("[data-recommendation-id]"))).toBe(recommendationId);
    expect(await expectNonemptyText(page.locator("[data-recommendation-plan-id]"))).toBe(recommendationPlanId);
    await expect(recommendationStart).toBeVisible();
    await expect(recommendationStart).toHaveAttribute(
      "href",
      /\/practice-reading\?plan_id=[^&]+&task_id=[^&]+/,
    );
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [practiceResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/practice-reading"
      )),
      recommendationStart.click(),
    ]);
    expect(practiceResponse.status()).toBe(200);
    expect(practiceResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");
    await expect(page).toHaveURL((url) => url.pathname === "/practice-reading");

    stage = "authenticated Gate A bound Reading practice";
    const practiceBinding = page.locator("[data-practice-binding-status]");
    await expect(practiceBinding).toHaveAttribute("data-binding-status", "bound_cycle_task");
    await expect(page.locator("[data-practice-binding-title]")).toContainText("已绑定本轮主推荐任务");
    await page.locator('input[name="reading-answer"][value="b"]').check();
    await page.locator("[data-check-reading]").click();
    await expect(practiceBinding).toHaveAttribute("data-binding-status", "bound_cycle_receipt");
    await expect(page.locator("[data-practice-binding-title]")).toHaveText("本机练习回执已生成");
    const checkInLink = page.locator("[data-practice-checkin-link]");
    await expect(checkInLink).toBeVisible();
    await expect(checkInLink).toHaveAttribute(
      "href",
      /\/check-in#plan_id=.*completion_receipt_id=.*cycle_id=.*recommendation_id=.*/,
    );
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [checkInResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/check-in"
      )),
      checkInLink.click(),
    ]);
    expect(checkInResponse.status()).toBe(200);
    expect(checkInResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");
    await expect(page).toHaveURL((url) => url.pathname === "/check-in");

    stage = "authenticated Gate A evidence check-in";
    const checkInForm = page.locator("#checkin-form");
    await expect(checkInForm.locator("[data-linked-task]")).not.toHaveValue("");
    await expect(page.locator("[data-checkin-evidence-status]"))
      .toHaveAttribute("data-evidence-class", "practice_receipt");
    const savedCheckInDidText = "完成了本轮绑定的阅读练习并核对答案。";
    const savedCheckInEvidenceText = "能够从短文细节判断图书馆改造支持不同学习方式。";
    const transientCheckInQuestionText = "这段暂存问题应在选择暂时没有后被清除。";
    const checkInDidText = checkInForm.locator('textarea[name="didText"]');
    await checkInDidText.fill(savedCheckInDidText);
    await checkInForm.locator('textarea[name="evidenceText"]').fill(savedCheckInEvidenceText);
    const checkInQuestion = checkInForm.locator('textarea[name="questionText"]');
    await checkInForm.locator('input[name="questionStatus"][value="has_question"]').check();
    await expect(checkInForm.locator("[data-question-wrap]")).toBeVisible();
    await checkInQuestion.fill(transientCheckInQuestionText);
    await checkInForm.locator('input[name="questionStatus"][value="none"]').check();
    await expect(checkInForm.locator("[data-question-wrap]")).toBeHidden();
    await checkInForm.getByRole("button", { name: "保存证据式打卡" }).click();
    await expect(checkInForm).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-checkin-receipt]")).toBeVisible();
    await expect(page.locator("[data-checkin-evidence-class]")).toContainText("practice_receipt");
    await expectNonemptyText(page.locator("[data-checkin-practice-receipt-id]"));

    stage = "authenticated Gate A sealed check-in revision protection";
    const sealedCheckInSnapshot = await readWorkspaceByteSnapshot();
    const checkInSubmit = checkInForm.getByRole("button", { name: "保存证据式打卡" });
    const checkInDraftStatus = page.locator("[data-checkin-draft-status]");
    const checkInNoteStatus = page.locator("[data-note-status]");

    await checkInDidText.focus();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" ");
    await page.keyboard.press("Backspace");
    await expect(checkInDidText).toHaveValue(savedCheckInDidText);
    await expect(checkInSubmit).toBeEnabled();
    await checkInSubmit.click();
    await expect(checkInDraftStatus).toHaveText("证据式打卡与已保存版本一致");
    await expect(checkInNoteStatus).toContainText("内容没有变化；原打卡记录保持有效");
    await expect(checkInNoteStatus).not.toContainText("不可变学习事件");
    expect(await readWorkspaceByteSnapshot()).toEqual(sealedCheckInSnapshot);

    await checkInDidText.fill(`${savedCheckInDidText} 这里尝试修改已经封存的闭环打卡。`);
    await expect(checkInSubmit).toBeEnabled();
    await checkInSubmit.click();
    await expect(checkInForm).not.toHaveAttribute("aria-busy", "true");
    await expect(checkInNoteStatus).toContainText("这份闭环打卡已有不可变学习事件");
    await expect(checkInNoteStatus).toContainText("不能在原轮次内修改或换绑");
    await expect(checkInNoteStatus).toContainText("原记录已完整保留");
    await expect(checkInNoteStatus).toContainText("请开始新诊断并进入新闭环");
    expect(await readWorkspaceByteSnapshot()).toEqual(sealedCheckInSnapshot);

    await checkInDidText.fill(savedCheckInDidText);
    await expect(checkInSubmit).toBeEnabled();
    await checkInSubmit.click();
    await expect(checkInDraftStatus).toHaveText("证据式打卡与已保存版本一致");
    await expect(checkInNoteStatus).toContainText("内容没有变化；原打卡记录保持有效");
    expect(await readWorkspaceByteSnapshot()).toEqual(sealedCheckInSnapshot);
    const savedCheckInQuestion = await page.evaluate((workspaceKey) => {
      const parsed = JSON.parse(window.localStorage.getItem(workspaceKey) || "null") as {
        checkIns?: Record<string, { questionStatus?: string; questionText?: string; status?: string }>;
      } | null;
      const saved = Object.values(parsed?.checkIns ?? {}).find((record) => record.status === "saved");
      return saved ? { questionStatus: saved.questionStatus, questionText: saved.questionText } : null;
    }, SOFIA_WORKSPACE_KEY);
    expect(savedCheckInQuestion).toEqual({ questionStatus: "none", questionText: "" });
    const reviewLink = page.locator("[data-checkin-review-link]");
    await expect(reviewLink).toBeVisible();
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [reviewResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/review"
      )),
      reviewLink.click(),
    ]);
    expect(reviewResponse.status()).toBe(200);
    expect(reviewResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");

    stage = "authenticated Gate A learner review";
    await expect(page.locator("[data-review-ready]")).toBeVisible();
    const reviewForm = page.locator("#review-form");
    const reviewConfirmation = reviewForm.locator('input[name="learnerConfirmed"]');
    const reviewSubmit = reviewForm.getByRole("button", { name: "确认这份复盘" });
    const workspaceBeforeReview = await readWorkspaceByteSnapshot();
    await reviewConfirmation.check();
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeReview);

    stage = "authenticated Gate A learner review transaction";
    const releaseReviewWrite = await holdSealedWriteForPendingObservation();
    const reviewSubmitClick = reviewSubmit.click();
    try {
      await expect(reviewForm).toHaveAttribute("data-commit-state", "pending");
      await expect(reviewForm).toHaveAttribute("aria-busy", "true");
      await expect(reviewConfirmation).toBeDisabled();
      await expect(reviewSubmit).toBeDisabled();
      expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeReview);
    } finally {
      await releaseReviewWrite();
    }
    await reviewSubmitClick;
    await expect(page.locator("[data-review-receipt]")).toBeVisible();
    await expect(page.locator("[data-review-status]")).toHaveText("学习者已确认");
    await expect(reviewForm).toHaveAttribute("data-commit-state", "saved");
    await expect(reviewForm).not.toHaveAttribute("aria-busy", "true");
    const reviewId = await expectNonemptyText(page.locator("[data-review-id]"));
    const workspaceAfterReview = await readWorkspaceByteSnapshot();
    expect(workspaceAfterReview.raw).not.toBe(workspaceBeforeReview.raw);

    stage = "authenticated Gate A learner review idempotency";
    await reviewForm.evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page.locator("[data-review-message]")).toContainText(
      "没有生成第二份 review_id",
    );
    await expect(page.locator("[data-review-id]")).toHaveText(reviewId);
    const reviewReplayState = await page.evaluate((workspaceKey) => {
      const parsed = JSON.parse(window.localStorage.getItem(workspaceKey) || "null") as {
        checkIns?: Record<string, { reviewId?: string | null }>;
        journey?: {
          activeCycle?: { reviewId?: string | null };
          review?: { reviewId?: string | null } | null;
        };
      } | null;
      return {
        activeCycleReviewId: parsed?.journey?.activeCycle?.reviewId ?? null,
        checkInReviewIds: Object.values(parsed?.checkIns ?? {})
          .map((checkIn) => checkIn.reviewId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
        receiptReviewId: parsed?.journey?.review?.reviewId ?? null,
      };
    }, SOFIA_WORKSPACE_KEY);
    expect(reviewReplayState).toEqual({
      activeCycleReviewId: reviewId,
      checkInReviewIds: [reviewId],
      receiptReviewId: reviewId,
    });
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceAfterReview);
    const workspaceBeforeCommunityPreview = await readWorkspaceByteSnapshot();
    const communityPrivateState = await page.evaluate((workspaceKey) => {
      const parsed = JSON.parse(window.localStorage.getItem(workspaceKey) || "null") as {
        journey?: {
          activeCycle?: {
            basePlanId?: string | null;
            checkInId?: string | null;
            cycleId?: string | null;
            diagnosticSessionId?: string | null;
            recommendationId?: string | null;
            reviewId?: string | null;
          };
        };
      } | null;
      const cycle = parsed?.journey?.activeCycle;
      const cycleIds = [
        cycle?.cycleId,
        cycle?.diagnosticSessionId,
        cycle?.basePlanId,
        cycle?.recommendationId,
        cycle?.checkInId,
        cycle?.reviewId,
      ].filter((value): value is string => typeof value === "string" && value.length > 0);
      const privateIds = new Set<string>();
      const collectIdValues = (value: unknown, key = "") => {
        if (typeof value === "string") {
          if (/id$/i.test(key) && value.length > 0) privateIds.add(value);
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item) => collectIdValues(item, key));
          return;
        }
        if (value && typeof value === "object") {
          Object.entries(value).forEach(([entryKey, entryValue]) => {
            collectIdValues(entryValue, entryKey);
          });
        }
      };
      collectIdValues(parsed);
      return { cycleIds, privateIds: [...privateIds].sort() };
    }, SOFIA_WORKSPACE_KEY);
    expect(communityPrivateState.cycleIds).toHaveLength(6);
    expect(new Set(communityPrivateState.cycleIds).size).toBe(6);
    expect(communityPrivateState.privateIds.length).toBeGreaterThan(communityPrivateState.cycleIds.length);

    const forbiddenCommunityInteractionRequests: string[] = [];
    const communityApplicationOrigin = new URL(target.baseURL).origin;
    const recordCommunityInteractionRequest = (request: PlaywrightRequest) => {
      const requestUrl = new URL(request.url());
      const resourceType = request.resourceType();
      const isClerkInfrastructure =
        requestUrl.hostname === keyPair.frontendApiHost
        || requestUrl.hostname === "clerk-telemetry.com"
        || requestUrl.hostname.endsWith(".clerk.accounts.dev")
        || requestUrl.hostname === "clerk.com"
        || requestUrl.hostname.endsWith(".clerk.com")
        || (
          requestUrl.origin === communityApplicationOrigin
          && (requestUrl.pathname === "/__clerk" || requestUrl.pathname.startsWith("/__clerk/"))
        );
      if (
        !isClerkInfrastructure
        && (
          !["GET", "HEAD", "OPTIONS"].includes(request.method())
          || (
            requestUrl.origin !== communityApplicationOrigin
            && (resourceType === "fetch" || resourceType === "xhr" || resourceType === "websocket")
          )
        )
      ) {
        forbiddenCommunityInteractionRequests.push(
          `${request.method()}:${resourceType}:${requestUrl.origin}${requestUrl.pathname}`,
        );
      }
    };
    page.on("request", recordCommunityInteractionRequest);

    const communityLink = page.locator("[data-review-next]");
    await expect(communityLink).toBeVisible();
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [communityResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/community"
      )),
      communityLink.click(),
    ]);
    expect(communityResponse.status()).toBe(200);
    expect(communityResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");

    stage = "authenticated Gate A community preview";
    const communityPreview = page.locator("[data-community-privacy-preview]");
    await expect(communityPreview).toBeVisible();
    await expect(communityPreview).toHaveAttribute("data-preview-state", "ready");
    await expect(page.locator("[data-community-preview-skill]")).toHaveText("Reading · 阅读");
    await expect(page.locator("[data-community-preview-completion]"))
      .toHaveText("已完成本机原创练习并确认复盘");
    const communityPreviewBoundary = page.locator("[data-community-preview-boundary]");
    await expect(communityPreviewBoundary).toContainText("没有上传");
    await expect(communityPreviewBoundary).toContainText("没有加入小组");
    await expect(communityPreviewBoundary).toContainText("没有分享给任何人");

    const communityBodyText = await page.locator("body").textContent();
    expect(communityBodyText).not.toBeNull();
    for (const privateValue of [
      savedCheckInDidText,
      savedCheckInEvidenceText,
      transientCheckInQuestionText,
      ...communityPrivateState.privateIds,
    ]) {
      expect(communityBodyText).not.toContain(privateValue);
    }
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeCommunityPreview);

    stage = "authenticated Gate A community decision";
    const communityForm = page.locator("#community-form");
    const communityUsed = communityForm.locator('input[name="peerHelpStatus"][value="used"]');
    const localPreviewConfirmation = communityForm.locator('input[name="localPreviewConfirmed"]');
    const communitySubmit = communityForm.getByRole("button", { name: "保存互助状态" });
    await expect(communityForm.getByText("已查看演示经验卡", { exact: true })).toBeVisible();
    await communityUsed.check();
    await expect(page.locator("[data-community-preview-confirmation]")).toBeVisible();
    await expect(localPreviewConfirmation).not.toBeChecked();
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeCommunityPreview);

    await communitySubmit.click();
    await expect(localPreviewConfirmation).toBeFocused();
    await expect(page.locator("[data-community-message]")).toContainText("请先确认这只是本机预览");
    await expect(page.locator("[data-community-receipt]")).toBeHidden();
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeCommunityPreview);

    await localPreviewConfirmation.check();
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeCommunityPreview);
    const releaseCommunityWrite = await holdSealedWriteForPendingObservation();
    const communitySubmitClick = communitySubmit.click();
    try {
      await expect(communityForm).toHaveAttribute("data-commit-state", "pending");
      await expect(communityForm).toHaveAttribute("aria-busy", "true");
      await expect(communityUsed).toBeDisabled();
      await expect(localPreviewConfirmation).toBeDisabled();
      await expect(communitySubmit).toBeDisabled();
      expect(await readWorkspaceByteSnapshot()).toEqual(workspaceBeforeCommunityPreview);
    } finally {
      await releaseCommunityWrite();
    }
    await communitySubmitClick;

    stage = "authenticated Gate A community receipt";
    await expect(page.locator("[data-community-receipt]")).toBeVisible();
    await expect(page.locator("[data-community-value]")).toHaveText("used");
    const peerHelpId = await expectNonemptyText(page.locator("[data-community-id]"));
    await expect(page.locator("[data-community-message]")).toContainText("used 只表示已查看合成演示经验卡");
    await expect(page.locator("[data-community-message]")).toContainText("没有加入或分享");
    type PeerHelpReceiptState = {
      createdAt: string;
      cycleId: string;
      learnerChoice: boolean;
      peerHelpId: string;
      planId: string;
      realCommunityUsed: boolean;
      reviewId: string;
      source: string;
      status: string;
      updatedAt: string;
    };
    const readPeerHelpReceipt = () => page.evaluate((workspaceKey) => {
      const parsed = JSON.parse(window.localStorage.getItem(workspaceKey) || "null") as {
        journey?: { peerHelp?: PeerHelpReceiptState | null };
      } | null;
      return parsed?.journey?.peerHelp ?? null;
    }, SOFIA_WORKSPACE_KEY);
    const savedPeerHelp = await readPeerHelpReceipt();
    expect(savedPeerHelp).not.toBeNull();
    expect(savedPeerHelp).toEqual({
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      cycleId: communityPrivateState.cycleIds[0],
      learnerChoice: true,
      peerHelpId,
      planId: communityPrivateState.cycleIds[2],
      realCommunityUsed: false,
      reviewId: communityPrivateState.cycleIds[5],
      source: "synthetic_demo_card_v1",
      status: "used",
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    if (!savedPeerHelp) throw new Error("saved peer-help receipt is unavailable");
    const workspaceAfterInitialPeerHelp = await readWorkspaceByteSnapshot();

    stage = "authenticated Gate A community idempotency";
    await communitySubmit.click();
    await expect(page.locator("[data-community-message]")).toContainText(
      "没有生成第二份 peer_help_id，也没有改写时间戳",
    );
    await expect(page.locator("[data-community-id]")).toHaveText(peerHelpId);
    expect(await readPeerHelpReceipt()).toEqual(savedPeerHelp);
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceAfterInitialPeerHelp);

    stage = "authenticated Gate A community mutable choice";
    await page.waitForTimeout(5);
    const communityDeclined = communityForm.locator(
      'input[name="peerHelpStatus"][value="declined"]',
    );
    await communityDeclined.check();
    await expect(page.locator("[data-community-preview-confirmation]")).toBeHidden();
    await expect(localPreviewConfirmation).not.toBeChecked();
    await communitySubmit.click();
    await expect(page.locator("[data-community-value]")).toHaveText("declined");
    const declinedPeerHelp = await readPeerHelpReceipt();
    expect(declinedPeerHelp).not.toBeNull();
    expect(declinedPeerHelp).toMatchObject({
      createdAt: savedPeerHelp.createdAt,
      peerHelpId,
      status: "declined",
    });
    expect(declinedPeerHelp?.updatedAt).not.toBe(savedPeerHelp.updatedAt);

    stage = "authenticated Gate A community final choice";
    await page.waitForTimeout(5);
    await communityUsed.check();
    await expect(page.locator("[data-community-preview-confirmation]")).toBeVisible();
    await localPreviewConfirmation.check();
    await communitySubmit.click();
    await expect(page.locator("[data-community-value]")).toHaveText("used");
    await expect(page.locator("[data-community-id]")).toHaveText(peerHelpId);
    const finalPeerHelp = await readPeerHelpReceipt();
    expect(finalPeerHelp).not.toBeNull();
    expect(finalPeerHelp).toMatchObject({
      createdAt: savedPeerHelp.createdAt,
      peerHelpId,
      status: "used",
    });
    expect(finalPeerHelp?.updatedAt).not.toBe(declinedPeerHelp?.updatedAt);

    const retestLink = page.locator("[data-community-next]");
    await expect(retestLink).toBeVisible();
    await refreshApprovedSessionBeforeDocumentNavigation();
    const [retestResponse] = await Promise.all([
      page.waitForResponse((response) => (
        response.request().resourceType() === "document"
        && new URL(response.url()).pathname === "/retest"
      )),
      retestLink.click(),
    ]);
    expect(retestResponse.status()).toBe(200);
    expect(retestResponse.headers()["x-sufeiya-beta-access"]).toBe("approved");

    const beforeProvisionalBranch = await readLocalNamespaces();
    if (!beforeProvisionalBranch.workspace) throw new Error("pre-retest workspace raw is unavailable");

    stage = "authenticated Gate A provisional retest branch";
    const provisionalRetestForm = page.locator("#retest-form");
    await provisionalRetestForm.locator('input[name="retestReading"][value="a"]').check();
    await provisionalRetestForm.getByRole("button", { name: "保存本次平行任务证据" }).click();
    await expect(page.locator("[data-retest-result]")).toBeVisible();
    await expect(page.locator("[data-retest-status]")).toHaveText("已留证，等待人工确认");
    await expect(page.locator("[data-retest-result-copy]")).toContainText(
      "仍需具备资质的人工确认",
    );
    const provisionalPlanUpdateForm = page.locator("#plan-update-form");
    await expect(provisionalPlanUpdateForm).toBeVisible();
    await provisionalPlanUpdateForm.locator('select[name="nextFocusSkill"]').selectOption("Reading");
    await provisionalPlanUpdateForm.locator('input[name="learnerConfirmed"]').check();
    await provisionalPlanUpdateForm.getByRole("button", { name: "生成更新后的 7 天计划" }).click();
    await expect(page.locator("[data-plan-update-completion-title]")).toHaveText(
      "临时计划已保存在本机",
    );
    await expect(page.locator("[data-plan-update-completion-copy]")).toContainText(
      "仍等待具备资质的人工确认",
    );

    const provisionalPrivateNarratives = [
      savedCheckInDidText,
      savedCheckInEvidenceText,
    ];
    const teachingReviewSentinelRaw = JSON.stringify({
      sentinel: `PRIVATE_TEACHING_REVIEW_${uniqueSuffix}`,
      purpose: "strict-handoff-byte-isolation",
    });
    const provisionalWorkspaceRaw = await page.evaluate(
      ({ workspaceKey, teachingReviewKey, teachingReviewRaw }) => {
        const raw = window.localStorage.getItem(workspaceKey);
        if (!raw) return null;
        window.localStorage.setItem(teachingReviewKey, teachingReviewRaw);
        return raw;
      },
      {
        workspaceKey: SOFIA_WORKSPACE_KEY,
        teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
        teachingReviewRaw: teachingReviewSentinelRaw,
      },
    );
    if (!provisionalWorkspaceRaw) throw new Error("provisional workspace raw is unavailable");
    const provisionalWorkspaceSha256 = createHash("sha256")
      .update(provisionalWorkspaceRaw)
      .digest("hex");
    for (const narrative of provisionalPrivateNarratives) {
      expect(provisionalWorkspaceRaw).toContain(narrative);
    }
    const provisionalEventCount = (JSON.parse(provisionalWorkspaceRaw) as {
      learningEvents?: unknown[];
    }).learningEvents?.length ?? 0;

    stage = "authenticated Gate A provisional workspace handoff";
    await gotoApprovedRoute("/workspace");
    await expect(page.locator("[data-journey-summary]")).toHaveText(
      "7 / 7 步已记录 · 待具备资质人员确认",
    );
    await expect(page.locator("[data-provisional-handoff]")).toBeVisible();
    await expect(page.locator("[data-journey-next-link]")).toBeHidden();
    await expect(page.locator("[data-next-cycle-admission]")).toBeHidden();
    const workspaceHandoffCta = page.locator("[data-provisional-handoff-support]");
    await expect(workspaceHandoffCta).toHaveAttribute(
      "href",
      "/super-teacher?handoff=provisional#human-support",
    );
    const strictNamespacesBefore = await readLocalNamespaces();
    expect(strictNamespacesBefore).toEqual({
      chat: beforeProvisionalBranch.chat,
      teachingReview: teachingReviewSentinelRaw,
      workspace: provisionalWorkspaceRaw,
    });
    await refreshApprovedSessionBeforeDocumentNavigation();
    await Promise.all([
      page.waitForURL((url) => (
        url.pathname === "/super-teacher" && url.searchParams.get("handoff") === "provisional"
      )),
      workspaceHandoffCta.click(),
    ]);

    stage = "authenticated Gate A Sofia strict packet ready state";
    const strictPacketCard = page.locator('section[aria-labelledby="provisional-package-title"]');
    await expect(strictPacketCard).toBeVisible();
    await expect(strictPacketCard).toHaveAttribute("data-state", "ready");
    await expect(strictPacketCard.locator("header").getByText("7 / 7", { exact: true })).toBeVisible();
    await expect(strictPacketCard.getByText("待具备资质人员确认", { exact: true })).toBeVisible();
    const createStrictPacket = strictPacketCard.getByRole("button", {
      name: "在本机生成严格承接包",
    });
    await expect(createStrictPacket).toBeEnabled();

    stage = "authenticated Gate A Sofia strict packet click";
    await createStrictPacket.click();

    stage = "authenticated Gate A Sofia strict packet storage receipt";
    await expect.poll(() => page.evaluate((chatKey) => {
      const raw = window.localStorage.getItem(chatKey);
      try {
        const parsed = JSON.parse(raw || "null") as {
          provisionalHandoffPackets?: unknown[];
          revision?: number;
        } | null;
        return {
          hasRaw: Boolean(raw),
          packetCount: parsed?.provisionalHandoffPackets?.length ?? 0,
          revision: parsed?.revision ?? 0,
        };
      } catch {
        return { hasRaw: Boolean(raw), packetCount: 0, revision: 0 };
      }
    }, SOFIA_CHAT_KEY)).toEqual({ hasRaw: true, packetCount: 1, revision: 1 });

    stage = "authenticated Gate A Sofia strict packet visible notice";
    await expect(page.getByText(/已在 Sofia 本机命名空间生成最小化承接包/)).toBeVisible();

    stage = "authenticated Gate A Sofia strict packet schema";
    const strictPacketSchemaAssessment = await page.evaluate(
      ({
        chatKey,
        expectedEventCount,
        expectedSnapshotSha256,
        expectedTeachingReviewRaw,
        expectedWorkspaceRaw,
        privateNarratives,
        privateSentinels,
        teachingReviewKey,
        workspaceKey,
      }) => {
        const chatRaw = window.localStorage.getItem(chatKey);
        const workspaceRaw = window.localStorage.getItem(workspaceKey);
        const parsedSession = JSON.parse(chatRaw || "null") as {
          provisionalHandoffPackets?: Array<Record<string, unknown>>;
          revision?: number;
        } | null;
        const parsedWorkspace = JSON.parse(workspaceRaw || "null") as {
          learningEvents?: unknown[];
          journey?: {
            activeCycle?: {
              basePlanId?: string;
              checkInId?: string;
              cycleId?: string;
              diagnosticSessionId?: string;
              peerHelpId?: string;
              recommendationId?: string;
              retestId?: string;
              reviewId?: string;
              updatedPlanId?: string;
            };
          };
        } | null;
        const cycle = parsedWorkspace?.journey?.activeCycle;
        const packet = parsedSession?.provisionalHandoffPackets?.at(-1);
        const sourceDomainIds = [
          cycle?.cycleId,
          cycle?.diagnosticSessionId,
          cycle?.basePlanId,
          cycle?.recommendationId,
          cycle?.checkInId,
          cycle?.reviewId,
          cycle?.peerHelpId,
          cycle?.retestId,
          cycle?.updatedPlanId,
        ];
        const expectedKeys = [
          "canonicalLedgerWriteAllowed",
          "createdAt",
          "cycleClosureAllowed",
          "humanConfirmationStatus",
          "humanReviewReceiptCreated",
          "identityVerified",
          "kind",
          "learnerNarrativeWithheld",
          "networkDispatch",
          "peerHelpStatus",
          "prioritySkill",
          "protocolVersion",
          "qualifiedHumanConfirmation",
          "realQueueCreated",
          "recordedStepCount",
          "retestEvidenceStatus",
          "sourceClass",
          "sourceSnapshotSha256",
          "sourceStorageKey",
          "sourceUpdatedAt",
          "status",
        ].sort();
        const serializedPacket = JSON.stringify(packet);
        const forbiddenValues = [
          "packetId",
          ...sourceDomainIds,
          ...privateNarratives,
          ...privateSentinels,
        ];
        (window as Window & { __sufeiyaStrictSessionBytes?: string })
          .__sufeiyaStrictSessionBytes = chatRaw || undefined;
        return {
          eventCountPreserved: (parsedWorkspace?.learningEvents?.length ?? 0) === expectedEventCount,
          exactSchema: JSON.stringify(Object.keys(packet ?? {}).sort()) === JSON.stringify(expectedKeys),
          fixedBoundaries: packet?.protocolVersion === "sufeiya_provisional_handoff_packet_v1" &&
            packet.kind === "provisional_cycle_human_support_handoff" &&
            packet.status === "local_not_sent" &&
            packet.sourceStorageKey === workspaceKey &&
            packet.recordedStepCount === 7 &&
            packet.humanConfirmationStatus === "required_not_completed" &&
            packet.networkDispatch === "disabled" &&
            packet.realQueueCreated === false &&
            packet.humanReviewReceiptCreated === false &&
            packet.qualifiedHumanConfirmation === false &&
            packet.identityVerified === false &&
            packet.canonicalLedgerWriteAllowed === false &&
            packet.cycleClosureAllowed === false &&
            packet.learnerNarrativeWithheld === true,
          sensitiveValuesWithheld: forbiddenValues.every((value) =>
            typeof value === "string" && !serializedPacket.includes(value)
          ),
          snapshotBound: packet?.sourceSnapshotSha256 === expectedSnapshotSha256,
          sourceBindingsPresent: sourceDomainIds.length === 9 &&
            sourceDomainIds.every((value) => typeof value === "string"),
          teachingReviewBytesPreserved:
            window.localStorage.getItem(teachingReviewKey) === expectedTeachingReviewRaw,
          workspaceBytesPreserved: workspaceRaw === expectedWorkspaceRaw,
        };
      },
      {
        chatKey: SOFIA_CHAT_KEY,
        expectedEventCount: provisionalEventCount,
        expectedSnapshotSha256: provisionalWorkspaceSha256,
        expectedTeachingReviewRaw: teachingReviewSentinelRaw,
        expectedWorkspaceRaw: provisionalWorkspaceRaw,
        privateNarratives: provisionalPrivateNarratives,
        privateSentinels: [
          temporaryUser.id,
          temporaryEmail,
          "13800138000",
          "private@example.test",
        ],
        teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
        workspaceKey: SOFIA_WORKSPACE_KEY,
      },
    );
    expect(strictPacketSchemaAssessment).toEqual({
      eventCountPreserved: true,
      exactSchema: true,
      fixedBoundaries: true,
      sensitiveValuesWithheld: true,
      snapshotBound: true,
      sourceBindingsPresent: true,
      teachingReviewBytesPreserved: true,
      workspaceBytesPreserved: true,
    });

    const replayStrictPacket = strictPacketCard.getByRole("button", {
      name: "重新核对并生成本机包",
    });
    await replayStrictPacket.click();
    await expect(page.getByText(/当前快照已有同一最小化承接包/)).toBeVisible();
    expect(await page.evaluate((chatKey) => {
      const before = (window as Window & { __sufeiyaStrictSessionBytes?: string })
        .__sufeiyaStrictSessionBytes;
      return Boolean(before) && window.localStorage.getItem(chatKey) === before;
    }, SOFIA_CHAT_KEY)).toBe(true);

    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", {
        configurable: true,
        get() {
          return {
            async writeText(text: string) {
              (window as Window & { __sufeiyaStrictHandoffCopy?: string })
                .__sufeiyaStrictHandoffCopy = text;
            },
          };
        },
      });
    });
    const copyStrictPacket = strictPacketCard.getByRole("button", {
      name: "复制白名单承接包",
    });
    await expect(copyStrictPacket).toBeEnabled();
    await copyStrictPacket.click();
    await expect(page.getByText(/已复制.*白名单承接包/)).toBeVisible();
    await expect(strictPacketCard).toContainText(
      "页面、本机包与复制文本都不携带原始领域 ID 或独立包编号",
    );
    const strictCopyAssessment = await page.evaluate(({
      expectedSnapshotSha256,
      privateNarratives,
      privateSentinels,
      workspaceKey,
    }) => {
      const copy = (window as Window & { __sufeiyaStrictHandoffCopy?: string })
        .__sufeiyaStrictHandoffCopy ?? "";
      const workspace = JSON.parse(window.localStorage.getItem(workspaceKey) || "null") as {
        journey?: {
          activeCycle?: {
            basePlanId?: string;
            checkInId?: string;
            cycleId?: string;
            diagnosticSessionId?: string;
            peerHelpId?: string;
            recommendationId?: string;
            retestId?: string;
            reviewId?: string;
            updatedPlanId?: string;
          };
        };
      } | null;
      const cycle = workspace?.journey?.activeCycle;
      const sourceDomainIds = [
        cycle?.cycleId,
        cycle?.diagnosticSessionId,
        cycle?.basePlanId,
        cycle?.recommendationId,
        cycle?.checkInId,
        cycle?.reviewId,
        cycle?.peerHelpId,
        cycle?.retestId,
        cycle?.updatedPlanId,
      ];
      const cardText = document.querySelector(
        'section[aria-labelledby="provisional-package-title"]',
      )?.textContent ?? "";
      const forbiddenValues = [
        "packetId",
        ...sourceDomainIds,
        ...privateNarratives,
        ...privateSentinels,
      ];
      return {
        disclosureVisible: cardText.includes(
          "页面、本机包与复制文本都不携带原始领域 ID 或独立包编号",
        ),
        headerPresent: copy.includes("[Sofia智能老师 Gate A 本机临时轮次白名单承接包]"),
        localOnlyBoundaryPresent: copy.includes("仅在本机准备，尚未发送"),
        sensitiveValuesWithheld: forbiddenValues.every((value) =>
          typeof value === "string" && !copy.includes(value) && !cardText.includes(value)
        ),
        snapshotBound: copy.includes(expectedSnapshotSha256),
        sourceFieldNamesWithheld:
          !/questionText|didText|evidenceText|responseText|rawAnswer|Clerk ID：/.test(copy),
      };
    }, {
      expectedSnapshotSha256: provisionalWorkspaceSha256,
      privateNarratives: provisionalPrivateNarratives,
      privateSentinels: [
        temporaryUser.id,
        temporaryEmail,
        "13800138000",
        "private@example.test",
      ],
      workspaceKey: SOFIA_WORKSPACE_KEY,
    });
    expect(strictCopyAssessment).toEqual({
      disclosureVisible: true,
      headerPresent: true,
      localOnlyBoundaryPresent: true,
      sensitiveValuesWithheld: true,
      snapshotBound: true,
      sourceFieldNamesWithheld: true,
    });
    expect(forbiddenCommunityInteractionRequests).toEqual([]);
    expect(await page.evaluate(
      ({ expectedTeachingReviewRaw, expectedWorkspaceRaw, teachingReviewKey, workspaceKey }) =>
        window.localStorage.getItem(teachingReviewKey) === expectedTeachingReviewRaw &&
        window.localStorage.getItem(workspaceKey) === expectedWorkspaceRaw,
      {
        expectedTeachingReviewRaw: teachingReviewSentinelRaw,
        expectedWorkspaceRaw: provisionalWorkspaceRaw,
        teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
        workspaceKey: SOFIA_WORKSPACE_KEY,
      },
    )).toBe(true);

    stage = "authenticated Gate A Sofia stale packet recovery";
    await page.evaluate(({ workspaceKey, workspaceRaw }) => {
      window.localStorage.setItem(workspaceKey, `${workspaceRaw}\n`);
      window.dispatchEvent(new StorageEvent("storage", { key: workspaceKey }));
    }, { workspaceKey: SOFIA_WORKSPACE_KEY, workspaceRaw: provisionalWorkspaceRaw });
    await expect(strictPacketCard).toHaveAttribute("data-state", "stale");
    await expect(strictPacketCard.getByText("stale · 已失效", { exact: true })).toBeVisible();
    await expect(copyStrictPacket).toBeDisabled();

    await page.evaluate(({ workspaceKey, workspaceRaw }) => {
      window.localStorage.setItem(workspaceKey, workspaceRaw);
      window.dispatchEvent(new StorageEvent("storage", { key: workspaceKey }));
    }, { workspaceKey: SOFIA_WORKSPACE_KEY, workspaceRaw: provisionalWorkspaceRaw });
    await expect(strictPacketCard).toHaveAttribute("data-state", "ready");
    await expect(copyStrictPacket).toBeEnabled();
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(provisionalWorkspaceRaw);

    await page.evaluate(({ before, chatKey, teachingReviewKey, workspaceKey }) => {
      const restore = (key: string, raw: string | null) => {
        if (raw === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, raw);
      };
      restore(chatKey, before.chat);
      restore(teachingReviewKey, before.teachingReview);
      restore(workspaceKey, before.workspace);
    }, {
      before: beforeProvisionalBranch,
      chatKey: SOFIA_CHAT_KEY,
      teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
      workspaceKey: SOFIA_WORKSPACE_KEY,
    });
    expect(await readLocalNamespaces()).toEqual(beforeProvisionalBranch);
    await gotoApprovedRoute("/retest");

    stage = "authenticated Gate A Reading retest";
    await expect(page.locator("[data-retest-skill-label]")).toHaveText("Reading · 阅读");
    await expect(page.locator("[data-retest-skill]")).toHaveValue("Reading");
    const retestForm = page.locator("#retest-form");
    await retestForm.locator('input[name="retestReading"][value="b"]').check();
    await retestForm.getByRole("button", { name: "保存本次平行任务证据" }).click();
    await expect(page.locator("[data-retest-result]")).toBeVisible();
    await expect(page.locator("[data-retest-target-skill]")).toHaveText("Reading");
    await expect(page.locator("[data-retest-same-skill]")).toHaveText("true · 已由代码核对");
    const retestId = await expectNonemptyText(page.locator("[data-retest-id]"));

    stage = "authenticated Gate A community downstream seal";
    const workspaceAfterRetest = await readWorkspaceByteSnapshot();
    await gotoApprovedRoute("/community");
    await expect(communityForm).toHaveAttribute("data-commit-state", "saved");
    await expect(communityForm).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-community-status]")).toHaveText("互助状态已封存");
    await expect(page.locator("[data-community-message]")).toContainText(
      "互助状态不能再覆盖",
    );
    await expect(page.locator("[data-community-id]")).toHaveText(peerHelpId);
    await expect(page.locator("[data-community-value]")).toHaveText("used");
    const sealedCommunityControls = await communityForm.locator("input, button").all();
    expect(sealedCommunityControls.length).toBeGreaterThan(0);
    for (const control of sealedCommunityControls) await expect(control).toBeDisabled();
    await communityForm.evaluate((form) => {
      form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceAfterRetest);

    await gotoApprovedRoute("/retest");
    await expect(page.locator("[data-retest-result]")).toBeVisible();
    await expect(page.locator("[data-retest-id]")).toHaveText(retestId);
    await expect(page.locator("#plan-update-form")).toBeVisible();
    expect(await readWorkspaceByteSnapshot()).toEqual(workspaceAfterRetest);

    stage = "authenticated Gate A community network isolation";
    expect(forbiddenCommunityInteractionRequests).toEqual([]);
    page.off("request", recordCommunityInteractionRequest);

    stage = "authenticated Gate A updated plan";
    const planUpdateForm = page.locator("#plan-update-form");
    await expect(planUpdateForm).toBeVisible();
    await planUpdateForm.locator('select[name="nextFocusSkill"]').selectOption("Reading");
    await planUpdateForm.locator('input[name="learnerConfirmed"]').check();
    await planUpdateForm.getByRole("button", { name: "生成更新后的 7 天计划" }).click();
    const planUpdateReceipt = page.locator("[data-plan-update-receipt]");
    const planUpdateCompletionTitle = page.locator("[data-plan-update-completion-title]");
    await expect(planUpdateReceipt).toBeVisible();
    await expect(planUpdateCompletionTitle).toHaveText("本机演示闭环已关闭");
    await expect(planUpdateCompletionTitle).toBeFocused();
    await expect(page.locator("[data-plan-update-completion-copy]"))
      .toContainText("这不是正式 Gate A PASS、能力增长证明或教师确认");
    const updatedPlanId = await expectNonemptyText(page.locator("[data-updated-plan-id]"));
    const supersededPlanId = await expectNonemptyText(page.locator("[data-superseded-plan-id]"));
    expect(updatedPlanId).not.toBe(supersededPlanId);
    expect(supersededPlanId).toBe(recommendationPlanId);

    stage = "authenticated Gate A completed workspace";
    await gotoApprovedRoute("/workspace");
    await expect(page.locator("[data-journey-summary]")).toHaveText("7 / 7 步已留证");
    await expect(page.locator("[data-cycle-ledger]")).toHaveAttribute("data-cycle-state", "complete");
    await expect(page.locator("[data-cycle-ledger-status]")).toHaveText("7 / 7 步已留证");
    await expect(page.locator('[data-cycle-ledger-row][data-state="recorded"]')).toHaveCount(8);
    await expect(page.locator("[data-journey-next-title]")).toHaveText("本轮 Gate A 闭环已完成");
    const completedWorkspacePrimaryAction = page.locator("[data-journey-next-link]");
    await expect(completedWorkspacePrimaryAction).toBeVisible();
    await expect(completedWorkspacePrimaryAction).toHaveAttribute("href", "/plan");
    await expect(page.locator("[data-provisional-handoff]")).toBeHidden();
    await expect(page.locator("[data-next-cycle-admission]")).toBeVisible();
    await expect(page.locator("[data-cycle-history-summary]")).toHaveText(
      "当前轮次只在上方本轮回执中显示，历史区不重复列出",
    );

    stage = "authenticated Gate A local-state integrity";
    const gateAState = await page.evaluate((workspaceKey) => {
      const rawState = window.localStorage.getItem(workspaceKey);
      if (!rawState) return null;
      const state = JSON.parse(rawState) as {
        schemaVersion?: number;
        planHistory?: Array<{ planId?: string; status?: string }>;
        learningEvents?: Array<{
          eventHash?: string;
          eventId?: string;
          eventType?: string;
          previousHash?: string | null;
          sequence?: number;
        }>;
        journey?: {
          protocolVersion?: string;
          activeCycle?: Record<string, unknown>;
          diagnostic?: {
            completedEvidenceTaskCount?: number;
            prioritySkill?: string;
            taskEvidence?: Array<{ status?: string }>;
          };
          history?: Array<Record<string, unknown>>;
          recommendation?: { recommendationId?: string };
          planUpdate?: { supersedesPlanId?: string; updatedPlanId?: string };
        };
      };
      const cycle = state.journey?.activeCycle ?? {};
      const evidence = state.journey?.diagnostic?.taskEvidence ?? [];
      const history = state.journey?.history ?? [];
      const events = state.learningEvents ?? [];
      return {
        rawState,
        schemaVersion: state.schemaVersion,
        protocolVersion: state.journey?.protocolVersion,
        cycleStatus: cycle.status,
        diagnosticSessionId: cycle.diagnosticSessionId,
        prioritySkill: state.journey?.diagnostic?.prioritySkill,
        completedEvidenceTaskCount: state.journey?.diagnostic?.completedEvidenceTaskCount,
        evidenceCount: evidence.length,
        evidenceStatuses: evidence.map((item) => item.status),
        cycleIds: [
          cycle.cycleId,
          cycle.diagnosticSessionId,
          cycle.basePlanId,
          cycle.recommendationId,
          cycle.checkInId,
          cycle.reviewId,
          cycle.peerHelpId,
          cycle.retestId,
          cycle.updatedPlanId,
        ],
        recommendationId: state.journey?.recommendation?.recommendationId,
        planUpdate: state.journey?.planUpdate,
        planHistory: state.planHistory,
        historyStatuses: history.map((item) => item.status),
        historyCycleIds: history.map((item) => item.cycleId),
        eventTypes: events.map((event) => event.eventType),
        eventChain: events.map((event) => ({
          eventHash: event.eventHash,
          eventId: event.eventId,
          eventType: event.eventType,
          previousHash: event.previousHash,
          sequence: event.sequence,
        })),
        eventHeadHash: events.at(-1)?.eventHash ?? null,
      };
    }, SOFIA_WORKSPACE_KEY);
    expect(gateAState).not.toBeNull();
    expect(gateAState).toMatchObject({
      schemaVersion: 1,
      protocolVersion: "gate_a_local_v1",
      cycleStatus: "completed",
      diagnosticSessionId,
      prioritySkill: "Reading",
      completedEvidenceTaskCount: 1,
      evidenceCount: 6,
      evidenceStatuses: ["completed", "skipped", "skipped", "skipped", "skipped", "skipped"],
      recommendationId,
      planUpdate: {
        supersedesPlanId: supersededPlanId,
        updatedPlanId,
      },
      eventTypes: [
        "learning_cycle.started",
        "recommendation.decided",
        "practice_attempt.finalized",
        "check_in.committed",
        "retest.completed",
        "learning_cycle.completed",
      ],
    });
    expect(gateAState!.cycleIds).toHaveLength(9);
    expect(gateAState!.cycleIds.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(gateAState!.cycleIds).size).toBe(9);
    expect(gateAState!.planHistory).toContainEqual(expect.objectContaining({
      planId: supersededPlanId,
      status: "superseded",
    }));
    expect(gateAState!.historyStatuses).toEqual(["completed"]);
    expect(gateAState!.historyCycleIds).toEqual([gateAState!.cycleIds[0]]);
    expect(gateAState!.eventChain).toHaveLength(6);
    expect(gateAState!.eventHeadHash).toMatch(/^[a-f0-9]{64}$/);

    stage = "authenticated Gate A next-cycle admission intent";
    const completedWorkspaceMainCta = page.locator("[data-journey-next-link]");
    await expect(completedWorkspaceMainCta).toBeVisible();
    await expect(completedWorkspaceMainCta).toHaveAttribute("href", "/plan");
    const nextCycleAdmission = page.locator("[data-next-cycle-admission]");
    const nextCycleAdmissionStatus = page.locator("[data-next-cycle-admission-status]");
    const nextCycleStart = page.locator("[data-next-cycle-start]");
    await expect(nextCycleAdmission).toBeVisible();
    await expect(nextCycleAdmission).toHaveAttribute("data-state", "ready");
    await expect(nextCycleAdmissionStatus).toHaveAttribute("role", "status");
    await expect(nextCycleAdmissionStatus).toContainText(
      "可容纳下一轮至少 6 条学习事件和 1 条闭环历史",
    );
    await expect(nextCycleStart).toBeVisible();
    await expect(nextCycleStart).toHaveAttribute(
      "href",
      /^\/diagnostic(?:\?intent=next-cycle)?$/,
    );
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(gateAState!.rawState);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/diagnostic"),
      nextCycleStart.click(),
    ]);
    await expect(page.locator("[data-diagnostic-preflight]")).toBeVisible();
    await expect(page.locator("[data-diagnostic-report]")).toBeHidden();
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(gateAState!.rawState);

    const nextCycleDiagnosticStartForm = page.locator("#diagnostic-start-form");
    for (const confirmation of [
      "adultConfirmed",
      "localBoundaryConfirmed",
      "noScoreConfirmed",
      "environmentConfirmed",
    ]) {
      await nextCycleDiagnosticStartForm.locator(`input[name="${confirmation}"]`).check();
    }
    await nextCycleDiagnosticStartForm.locator('input[name="keyboardCheck"]').fill("NEXT");
    await nextCycleDiagnosticStartForm
      .locator('input[name="audioOutput"][value="heard"]')
      .check();
    const nextCycleConfirmationPromise = page.waitForEvent("dialog");
    const nextCycleSubmitPromise = nextCycleDiagnosticStartForm
      .getByRole("button", { name: "开始六项原创任务" })
      .click();
    const nextCycleConfirmation = await nextCycleConfirmationPromise;
    expect(nextCycleConfirmation.type()).toBe("confirm");
    expect(nextCycleConfirmation.message()).toContain("把当前轮与计划保留为只读历史");
    await nextCycleConfirmation.accept();
    await nextCycleSubmitPromise;
    await expect(page.locator("[data-diagnostic-status]")).toHaveText("六项任务进行中");
    await expect(page.locator(
      '[data-diagnostic-task][data-task-id="diagnostic-reading-library-v1"]',
    )).toBeVisible();
    const nextCycleCommitted = await page.evaluate((workspaceKey) => {
      const rawState = window.localStorage.getItem(workspaceKey);
      if (!rawState) return null;
      const state = JSON.parse(rawState) as {
        planHistory?: Array<{ planId?: string; status?: string }>;
        learningEvents?: Array<{ eventType?: string }>;
        journey?: {
          activeCycle?: Record<string, unknown>;
          diagnostic?: { status?: string };
          history?: Array<{ cycleId?: string }>;
          supersededCycles?: Array<{ cycleId?: string }>;
        };
      };
      return {
        rawState,
        activeCycle: state.journey?.activeCycle ?? null,
        diagnosticStatus: state.journey?.diagnostic?.status ?? null,
        historyCycleIds: (state.journey?.history ?? []).map((item) => item.cycleId),
        supersededCycleIds: (state.journey?.supersededCycles ?? []).map((item) => item.cycleId),
        planHistory: state.planHistory ?? [],
        eventTypes: (state.learningEvents ?? []).map((event) => event.eventType),
      };
    }, SOFIA_WORKSPACE_KEY);
    expect(nextCycleCommitted).not.toBeNull();
    expect(nextCycleCommitted!.rawState).not.toBe(gateAState!.rawState);
    expect(nextCycleCommitted!.activeCycle).toMatchObject({
      status: "in_progress",
      basePlanId: null,
      recommendationId: null,
      checkInId: null,
      reviewId: null,
      peerHelpId: null,
      retestId: null,
      updatedPlanId: null,
    });
    expect(nextCycleCommitted!.activeCycle?.cycleId).not.toBe(gateAState!.cycleIds[0]);
    expect(nextCycleCommitted!.diagnosticStatus).toBe("in_progress");
    expect(nextCycleCommitted!.historyCycleIds).toEqual([gateAState!.cycleIds[0]]);
    expect(nextCycleCommitted!.supersededCycleIds).toContain(gateAState!.cycleIds[0]);
    expect(nextCycleCommitted!.planHistory).toContainEqual(expect.objectContaining({
      planId: gateAState!.cycleIds[8],
      status: "superseded",
    }));
    expect(nextCycleCommitted!.eventTypes).toEqual([
      ...gateAState!.eventTypes,
      "learning_cycle.started",
    ]);
    expect(nextCycleCommitted!.eventTypes).toHaveLength(7);

    await page.evaluate(({ workspaceKey, workspaceRaw }) => {
      window.localStorage.setItem(workspaceKey, workspaceRaw);
    }, {
      workspaceKey: SOFIA_WORKSPACE_KEY,
      workspaceRaw: gateAState!.rawState,
    });
    await gotoApprovedRoute("/workspace");
    await expect(page.locator("[data-journey-summary]")).toHaveText("7 / 7 步已留证");
    await expect(page.locator("[data-cycle-ledger]")).toHaveAttribute("data-cycle-state", "complete");
    await expect(page.locator("[data-next-cycle-admission]")).toHaveAttribute("data-state", "ready");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(gateAState!.rawState);

    stage = "authenticated Gate A restorable backup export";
    await gotoApprovedRoute("/my-data");
    const adjacentNamespaceSentinels = {
      chat: JSON.stringify({
        sentinel: `sofia-adjacent-namespace-${uniqueSuffix}`,
        purpose: "workspace-backup-nonempty-isolation-proof",
      }),
      teachingReview: JSON.stringify({
        sentinel: `teaching-review-adjacent-namespace-${uniqueSuffix}`,
        purpose: "workspace-backup-nonempty-isolation-proof",
      }),
    };
    await page.evaluate(
      ({ chatKey, chatRaw, teachingReviewKey, teachingReviewRaw }) => {
        window.localStorage.setItem(chatKey, chatRaw);
        window.localStorage.setItem(teachingReviewKey, teachingReviewRaw);
      },
      {
        chatKey: SOFIA_CHAT_KEY,
        chatRaw: adjacentNamespaceSentinels.chat,
        teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
        teachingReviewRaw: adjacentNamespaceSentinels.teachingReview,
      },
    );
    const namespaceRawBeforeRestoreExercise = await readLocalNamespaces();
    expect(namespaceRawBeforeRestoreExercise).toEqual({
      chat: adjacentNamespaceSentinels.chat,
      teachingReview: adjacentNamespaceSentinels.teachingReview,
      workspace: gateAState!.rawState,
    });

    const restorableExport = page.locator("[data-export-restorable-workspace]");
    const workspaceBackupStatus = page.locator("[data-workspace-backup-message]");
    await expect(restorableExport).toBeVisible();
    await expect(restorableExport).toBeEnabled();
    const workspaceBackupDownloadPromise = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
    await restorableExport.click();
    await expect(workspaceBackupStatus).not.toHaveText("正在核对当前学习工作区…", { timeout: 30_000 });
    const exportStatus = await workspaceBackupStatus.textContent();
    if (!exportStatus?.includes("可恢复的学习工作区备份已下载")) {
      stage = `authenticated Gate A restorable backup export rejected (${await workspaceBackupStatus.getAttribute("data-code") || "unknown"})`;
      throw new Error("restorable backup export did not reach the fixed local success state");
    }
    const workspaceBackupDownload = await workspaceBackupDownloadPromise;
    if (!workspaceBackupDownload) throw new Error("browser did not emit the workspace backup download");
    const workspaceBackupSuggestedFilename = workspaceBackupDownload.suggestedFilename();
    expect(workspaceBackupSuggestedFilename).toMatch(
      /^sufeiya-workspace-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(await workspaceBackupDownload.failure()).toBeNull();
    const workspaceBackupPath = await workspaceBackupDownload.path();
    if (!workspaceBackupPath) throw new Error("browser did not retain the downloaded workspace backup");
    const workspaceBackupBuffer = await readFile(workspaceBackupPath);
    const workspaceBackupText = workspaceBackupBuffer.toString("utf8");
    expect(workspaceBackupText).not.toContain(SOFIA_CHAT_KEY);
    expect(workspaceBackupText).not.toContain(TEACHING_REVIEW_DEMO_KEY);
    const workspaceBackupEnvelope = JSON.parse(workspaceBackupText) as {
      backupProtocol?: string;
      integrity?: {
        learningEventCount?: number;
        learningEventHeadHash?: string | null;
        sha256?: string;
      };
      namespace?: string;
      restorePolicy?: string;
      workspace?: {
        journey?: {
          activeCycle?: Record<string, unknown>;
          history?: Array<Record<string, unknown>>;
        };
        learningEvents?: Array<{
          eventHash?: string;
          eventId?: string;
          eventType?: string;
          previousHash?: string | null;
          sequence?: number;
        }>;
      };
    };
    expect(workspaceBackupEnvelope).toMatchObject({
      backupProtocol: "sufeiya_workspace_backup_v1",
      namespace: SOFIA_WORKSPACE_KEY,
      restorePolicy: "replace_only_no_merge",
      integrity: {
        learningEventCount: 6,
        learningEventHeadHash: gateAState!.eventHeadHash,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    stage = "authenticated Gate A restorable backup continuity projection";
    expect(workspaceBackupEnvelope.workspace).toBeDefined();
    const exportedWorkspace = workspaceBackupEnvelope.workspace!;
    const exportedCycle = exportedWorkspace.journey?.activeCycle ?? {};
    expect([
      exportedCycle.cycleId,
      exportedCycle.diagnosticSessionId,
      exportedCycle.basePlanId,
      exportedCycle.recommendationId,
      exportedCycle.checkInId,
      exportedCycle.reviewId,
      exportedCycle.peerHelpId,
      exportedCycle.retestId,
      exportedCycle.updatedPlanId,
    ]).toEqual(gateAState!.cycleIds);
    expect(exportedWorkspace.journey?.history?.map((item) => item.status)).toEqual(
      gateAState!.historyStatuses,
    );
    expect((exportedWorkspace.learningEvents ?? []).map((event) => ({
      eventHash: event.eventHash,
      eventId: event.eventId,
      eventType: event.eventType,
      previousHash: event.previousHash,
      sequence: event.sequence,
    }))).toEqual(gateAState!.eventChain);
    const exportedWorkspaceCanonical = canonicalJson(exportedWorkspace);
    await expect(workspaceBackupStatus).toContainText(
      "可恢复的学习工作区备份已下载",
    );

    stage = "authenticated Gate A workspace-only clear";
    const clearWorkspaceButton = page.locator("[data-clear-workspace]");
    await expect(clearWorkspaceButton).toBeEnabled();
    const clearWorkspaceDialog = page.waitForEvent("dialog");
    const clearedWorkspaceReload = page.waitForEvent("load");
    const clearWorkspaceClick = clearWorkspaceButton.click();
    const confirmationDialog = await clearWorkspaceDialog;
    expect(confirmationDialog.type()).toBe("confirm");
    expect(confirmationDialog.message()).toContain("仅清除这个浏览器中的 Sufeiya 学习闭环数据");
    expect(confirmationDialog.message()).toContain("Sofia智能老师对话与教研复核演示草稿不会被删除");
    await confirmationDialog.accept();
    await Promise.all([clearWorkspaceClick, clearedWorkspaceReload]);
    await expect(page).toHaveURL((url) => url.pathname === "/my-data");
    expect(await readLocalNamespaces()).toEqual({
      chat: namespaceRawBeforeRestoreExercise.chat,
      teachingReview: namespaceRawBeforeRestoreExercise.teachingReview,
      workspace: null,
    });

    type BackupInteractionPhase =
      | "tampered_validation"
      | "invalid_domain_validation"
      | "valid_validation"
      | "restore";
    let backupInteractionPhase: BackupInteractionPhase | null = null;
    const backupApplicationPosts: string[] = [];
    const backupPayloadTransmissions: string[] = [];
    const applicationOrigin = new URL(target.baseURL).origin;
    const backupPayloadMarkers = [
      "sufeiya_workspace_backup_v1",
      workspaceBackupEnvelope.integrity?.sha256,
      workspaceBackupEnvelope.integrity?.learningEventHeadHash,
    ].filter((value): value is string => Boolean(value));
    const recordBackupInteractionRequest = (request: PlaywrightRequest) => {
      if (!backupInteractionPhase) return;
      const requestUrl = new URL(request.url());
      const method = request.method();
      const observation = `${backupInteractionPhase}:${method}:${requestUrl.origin}${requestUrl.pathname}`;
      if (method === "POST" && requestUrl.origin === applicationOrigin) {
        backupApplicationPosts.push(observation);
      }
      const requestBody = request.postData();
      if (requestBody && backupPayloadMarkers.some((marker) => requestBody.includes(marker))) {
        backupPayloadTransmissions.push(observation);
      }
    };
    page.on("request", recordBackupInteractionRequest);

    const workspaceBackupFile = page.locator("[data-workspace-backup-file]");
    const validateWorkspaceBackup = page.locator("[data-validate-workspace-backup]");
    const workspaceBackupPreview = page.locator("[data-workspace-backup-preview]");
    const confirmWorkspaceRestore = page.locator("[data-confirm-workspace-restore]");
    const restoreWorkspaceBackup = page.locator("[data-restore-workspace-backup]");
    const workspaceBackupMessage = page.locator("[data-workspace-backup-message]");
    const workspaceBackupFileSummary = page.locator("[data-workspace-backup-file-summary]");
    const workspaceBackupFileName = workspaceBackupFileSummary.locator("[data-backup-file-name]");
    const workspaceBackupFileSize = workspaceBackupFileSummary.locator("[data-backup-file-size]");
    const workspaceBackupFileStatus = workspaceBackupFileSummary.locator("[data-backup-file-status]");

    stage = "authenticated Gate A tampered backup rejection";
    const tamperedEnvelope = JSON.parse(workspaceBackupText) as {
      integrity: { sha256: string };
    };
    tamperedEnvelope.integrity.sha256 = tamperedEnvelope.integrity.sha256 === "0".repeat(64)
      ? "1".repeat(64)
      : "0".repeat(64);
    backupInteractionPhase = "tampered_validation";
    await workspaceBackupFile.setInputFiles({
      name: "tampered-sufeiya-workspace-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(tamperedEnvelope)),
    });
    await expect(workspaceBackupFileSummary).toBeVisible();
    await expect(workspaceBackupFileName).toHaveText("tampered-sufeiya-workspace-backup.json");
    await expect(workspaceBackupFileSize).toContainText("字节");
    await expect(workspaceBackupFileStatus).toHaveText("已选择 · 尚未读取或验证");
    await expect(validateWorkspaceBackup).toBeEnabled();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    await validateWorkspaceBackup.click();
    await expect(workspaceBackupMessage).toHaveAttribute("role", "alert");
    await expect(workspaceBackupMessage).toContainText("可能已损坏或被改动");
    await expect(workspaceBackupMessage).toBeFocused();
    await expect(workspaceBackupPreview).toBeHidden();
    await expect(confirmWorkspaceRestore).toBeDisabled();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    await expect(workspaceBackupFileStatus).toHaveText("已拒绝 · 未通过严格验证");
    expect(await readLocalNamespaces()).toEqual({
      chat: namespaceRawBeforeRestoreExercise.chat,
      teachingReview: namespaceRawBeforeRestoreExercise.teachingReview,
      workspace: null,
    });

    stage = "authenticated Gate A rehashed invalid-domain backup rejection";
    const rehashedInvalidDomainEnvelope = JSON.parse(workspaceBackupText) as {
      integrity: { byteLength: number; sha256: string };
      workspace: { focus: { active: unknown } };
    };
    rehashedInvalidDomainEnvelope.workspace.focus.active = {};
    const rehashedInvalidDomainWorkspace = canonicalJson(
      rehashedInvalidDomainEnvelope.workspace,
    );
    rehashedInvalidDomainEnvelope.integrity.byteLength = Buffer.byteLength(
      rehashedInvalidDomainWorkspace,
      "utf8",
    );
    rehashedInvalidDomainEnvelope.integrity.sha256 = createHash("sha256")
      .update(rehashedInvalidDomainWorkspace, "utf8")
      .digest("hex");
    backupInteractionPhase = "invalid_domain_validation";
    await workspaceBackupFile.setInputFiles({
      name: "rehashed-invalid-domain-sufeiya-workspace-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(rehashedInvalidDomainEnvelope)),
    });
    await expect(workspaceBackupFileName).toHaveText(
      "rehashed-invalid-domain-sufeiya-workspace-backup.json",
    );
    await expect(workspaceBackupFileStatus).toHaveText("已选择 · 尚未读取或验证");
    await expect(validateWorkspaceBackup).toBeEnabled();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    await validateWorkspaceBackup.click();
    await expect(workspaceBackupMessage).toHaveAttribute("role", "alert");
    await expect(workspaceBackupMessage).toContainText("没有修改当前学习数据");
    await expect(workspaceBackupMessage).not.toContainText("摘要与内容不一致");
    await expect(workspaceBackupMessage).toBeFocused();
    await expect(workspaceBackupPreview).toBeHidden();
    await expect(confirmWorkspaceRestore).toBeDisabled();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    await expect(workspaceBackupFileStatus).toHaveText("已拒绝 · 未通过严格验证");
    expect(await readLocalNamespaces()).toEqual({
      chat: namespaceRawBeforeRestoreExercise.chat,
      teachingReview: namespaceRawBeforeRestoreExercise.teachingReview,
      workspace: null,
    });

    stage = "authenticated Gate A valid backup preview";
    backupInteractionPhase = "valid_validation";
    await workspaceBackupFile.setInputFiles({
      name: workspaceBackupSuggestedFilename,
      mimeType: "application/json",
      buffer: workspaceBackupBuffer,
    });
    await expect(workspaceBackupFileName).toHaveText(workspaceBackupSuggestedFilename);
    await expect(workspaceBackupFileSize).toContainText(
      `${new Intl.NumberFormat("zh-CN").format(workspaceBackupBuffer.length)} 字节`,
    );
    await expect(workspaceBackupFileStatus).toHaveText("已选择 · 尚未读取或验证");
    await expect(validateWorkspaceBackup).toBeEnabled();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    await validateWorkspaceBackup.click();
    await expect(workspaceBackupPreview).toBeVisible({ timeout: 15_000 });
    await expect(workspaceBackupPreview).toBeFocused();
    await expect(workspaceBackupFileStatus).toHaveText("已通过 · 等待明确确认");
    await expect(workspaceBackupPreview.locator("[data-backup-stage]")).toHaveText(
      "本轮 Gate A 闭环已完成",
    );
    await expect(workspaceBackupPreview.locator("[data-backup-plans]")).toHaveText("2 份");
    await expect(workspaceBackupPreview.locator("[data-backup-completed-cycles]")).toHaveText(
      "1 轮完成 · 0 轮待人工确认",
    );
    await expect(workspaceBackupPreview.locator("[data-backup-receipts]")).toHaveText("1 份");
    await expect(workspaceBackupPreview.locator("[data-backup-checkins]")).toHaveText("1 条");
    await expect(workspaceBackupPreview.locator("[data-backup-events]")).toHaveText("6 条");
    await expect(workspaceBackupPreview.locator("[data-backup-head-hash]")).toHaveText(
      `${gateAState!.eventHeadHash!.slice(0, 12)}…`,
    );
    await expect(confirmWorkspaceRestore).toBeEnabled();
    await expect(confirmWorkspaceRestore).not.toBeChecked();
    await expect(restoreWorkspaceBackup).toBeDisabled();
    expect(await readLocalNamespaces()).toEqual({
      chat: namespaceRawBeforeRestoreExercise.chat,
      teachingReview: namespaceRawBeforeRestoreExercise.teachingReview,
      workspace: null,
    });
    await confirmWorkspaceRestore.check();
    await expect(restoreWorkspaceBackup).toBeEnabled();
    expect(await readLocalNamespaces()).toEqual({
      chat: namespaceRawBeforeRestoreExercise.chat,
      teachingReview: namespaceRawBeforeRestoreExercise.teachingReview,
      workspace: null,
    });

    stage = "authenticated Gate A atomic restore";
    backupInteractionPhase = "restore";
    await restoreWorkspaceBackup.click();
    const workspaceRestoreSuccess = page.locator("[data-workspace-restore-success]");
    await expect(workspaceRestoreSuccess).toBeVisible({ timeout: 15_000 });
    await expect(workspaceRestoreSuccess).toBeFocused();
    await expect(workspaceBackupMessage).toContainText(
      "Sofia 对话与教研复核演示草稿未被读取或修改",
    );
    await expect(workspaceBackupFileStatus).toHaveText("已恢复 · 写后复核通过");
    backupInteractionPhase = null;
    page.off("request", recordBackupInteractionRequest);
    stage = "authenticated Gate A restore network isolation";
    expect(backupApplicationPosts).toEqual([]);
    expect(backupPayloadTransmissions).toEqual([]);

    stage = "authenticated Gate A restore namespace integrity";
    const restoredNamespaceRaw = await readLocalNamespaces();
    expect(restoredNamespaceRaw.chat).toBe(namespaceRawBeforeRestoreExercise.chat);
    expect(restoredNamespaceRaw.teachingReview).toBe(namespaceRawBeforeRestoreExercise.teachingReview);
    expect(restoredNamespaceRaw.workspace).not.toBeNull();
    const restoredWorkspace = JSON.parse(restoredNamespaceRaw.workspace!) as {
      journey?: { activeCycle?: Record<string, unknown> };
      learningEvents?: Array<{
        eventHash?: string;
        eventId?: string;
        eventType?: string;
        previousHash?: string | null;
        sequence?: number;
      }>;
    };
    expect(canonicalJson(restoredWorkspace)).toBe(exportedWorkspaceCanonical);
    const restoredCycle = restoredWorkspace.journey?.activeCycle ?? {};
    const restoredCycleIds = [
      restoredCycle.cycleId,
      restoredCycle.diagnosticSessionId,
      restoredCycle.basePlanId,
      restoredCycle.recommendationId,
      restoredCycle.checkInId,
      restoredCycle.reviewId,
      restoredCycle.peerHelpId,
      restoredCycle.retestId,
      restoredCycle.updatedPlanId,
    ];
    expect(restoredCycleIds).toEqual(gateAState!.cycleIds);
    const restoredEventChain = (restoredWorkspace.learningEvents ?? []).map((event) => ({
      eventHash: event.eventHash,
      eventId: event.eventId,
      eventType: event.eventType,
      previousHash: event.previousHash,
      sequence: event.sequence,
    }));
    expect(restoredEventChain).toEqual(gateAState!.eventChain);
    expect(restoredEventChain.at(-1)?.eventHash).toBe(gateAState!.eventHeadHash);

    stage = "authenticated Gate A restored same-page raw export";
    const localRawExportDownloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.locator("[data-export-workspace]").click();
    const localRawExportDownload = await localRawExportDownloadPromise;
    expect(await localRawExportDownload.failure()).toBeNull();
    const localRawExportPath = await localRawExportDownload.path();
    if (!localRawExportPath) throw new Error("browser did not retain the same-page raw export");
    const localRawExport = JSON.parse(
      (await readFile(localRawExportPath)).toString("utf8"),
    ) as {
      exportProtocol?: string;
      namespaces?: Record<string, { parsed?: unknown; raw?: string | null }>;
    };
    expect(localRawExport.exportProtocol).toBe("sufeiya_local_export_v2");
    expect(canonicalJson(localRawExport.namespaces?.[SOFIA_WORKSPACE_KEY]?.parsed)).toBe(
      exportedWorkspaceCanonical,
    );
    expect(await readLocalNamespaces()).toEqual(restoredNamespaceRaw);

    stage = "authenticated Gate A restored same-page event clear";
    const clearEventsButton = page.locator("[data-clear-learning-events]");
    await expect(clearEventsButton).toBeEnabled();
    const clearEventsDialog = page.waitForEvent("dialog");
    const clearEventsReload = page.waitForEvent("load");
    const clearEventsClick = clearEventsButton.click();
    const eventsConfirmation = await clearEventsDialog;
    expect(eventsConfirmation.type()).toBe("confirm");
    expect(eventsConfirmation.message()).toContain("仅清除学习事件账本和本机事件别名");
    await eventsConfirmation.accept();
    await Promise.all([clearEventsClick, clearEventsReload]);
    await expect(page).toHaveURL((url) => url.pathname === "/my-data");
    const afterEventClearNamespaces = await readLocalNamespaces();
    expect(afterEventClearNamespaces.chat).toBe(namespaceRawBeforeRestoreExercise.chat);
    expect(afterEventClearNamespaces.teachingReview).toBe(namespaceRawBeforeRestoreExercise.teachingReview);
    expect(afterEventClearNamespaces.workspace).not.toBeNull();
    const eventClearedWorkspace = JSON.parse(afterEventClearNamespaces.workspace!) as Record<string, unknown>;
    expect(eventClearedWorkspace.learningEvents).toEqual([]);
    expect(eventClearedWorkspace.learningEventBindings).toBeNull();
    const eventClearedDomainState = structuredClone(eventClearedWorkspace);
    const restoredDomainState = structuredClone(restoredWorkspace) as Record<string, unknown>;
    ["learningEvents", "learningEventBindings", "updatedAt"].forEach((key) => {
      delete eventClearedDomainState[key];
      delete restoredDomainState[key];
    });
    expect(canonicalJson(eventClearedDomainState)).toBe(canonicalJson(restoredDomainState));

    stage = "authenticated Gate A second atomic restore";
    await workspaceBackupFile.setInputFiles({
      name: workspaceBackupSuggestedFilename,
      mimeType: "application/json",
      buffer: workspaceBackupBuffer,
    });
    await expect(workspaceBackupFileSummary).toBeVisible();
    await expect(workspaceBackupFileName).toHaveText(workspaceBackupSuggestedFilename);
    await expect(workspaceBackupFileSize).toContainText(
      `${new Intl.NumberFormat("zh-CN").format(workspaceBackupBuffer.length)} 字节`,
    );
    await expect(workspaceBackupFileStatus).toHaveText("已选择 · 尚未读取或验证");
    await expect(validateWorkspaceBackup).toBeEnabled();
    await validateWorkspaceBackup.click();
    await expect(workspaceBackupPreview).toBeVisible({ timeout: 15_000 });
    await expect(confirmWorkspaceRestore).toBeEnabled();
    await confirmWorkspaceRestore.check();
    await expect(restoreWorkspaceBackup).toBeEnabled();
    await restoreWorkspaceBackup.click();
    await expect(workspaceRestoreSuccess).toBeVisible({ timeout: 15_000 });
    await expect(workspaceRestoreSuccess).toBeFocused();
    const secondRestoreNamespaces = await readLocalNamespaces();
    expect(secondRestoreNamespaces.chat).toBe(namespaceRawBeforeRestoreExercise.chat);
    expect(secondRestoreNamespaces.teachingReview).toBe(namespaceRawBeforeRestoreExercise.teachingReview);
    expect(secondRestoreNamespaces.workspace).not.toBeNull();
    expect(canonicalJson(JSON.parse(secondRestoreNamespaces.workspace!))).toBe(exportedWorkspaceCanonical);

    stage = "authenticated Gate A restored continuity";
    const workspaceRestoreNext = page.locator("[data-workspace-restore-next]");
    await expect(workspaceRestoreNext).toHaveAttribute("href", "/plan");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/plan"),
      workspaceRestoreNext.click(),
    ]);
    await expect(page).toHaveURL((url) => url.pathname === "/plan");
    await gotoApprovedRoute("/workspace");
    await expect(page.locator("[data-journey-summary]")).toHaveText("7 / 7 步已留证");
    await expect(page.locator("[data-cycle-ledger]")).toHaveAttribute("data-cycle-state", "complete");
    await expect(page.locator('[data-cycle-ledger-row][data-state="recorded"]')).toHaveCount(8);
    const finalNamespaceRaw = await readLocalNamespaces();
    expect(finalNamespaceRaw.chat).toBe(namespaceRawBeforeRestoreExercise.chat);
    expect(finalNamespaceRaw.teachingReview).toBe(namespaceRawBeforeRestoreExercise.teachingReview);
    expect(finalNamespaceRaw.workspace).not.toBeNull();
    expect(canonicalJson(JSON.parse(finalNamespaceRaw.workspace!))).toBe(exportedWorkspaceCanonical);
    expect((JSON.parse(finalNamespaceRaw.workspace!) as { learningEvents?: unknown[] }).learningEvents)
      .toHaveLength(gateAState!.eventChain.length);

    /*
     * Synthetic capacity UI probes only. These fixtures are derived from the already
     * verified/restored Gate A workspace solely to exercise fail-closed writer UI at
     * exact capacity boundaries. They are not positive 7/7 journey evidence. Every
     * probe restores the exact verified raw namespace before and after it runs.
     */
    const verifiedGateAWorkspaceRaw = finalNamespaceRaw.workspace;
    if (!verifiedGateAWorkspaceRaw) throw new Error("verified Gate A workspace raw is unavailable");
    type SyntheticCapacityWorkspace = {
      focus: {
        active: Record<string, unknown> | null;
        sessions: Array<Record<string, unknown>>;
      };
      plan: Record<string, unknown> | null;
      planHistory: Array<Record<string, unknown>>;
      practice: Record<string, Record<string, unknown>>;
      practiceReceipts: Record<string, Record<string, unknown>>;
    } & Record<string, unknown>;
    const replaceWorkspaceRaw = async (raw: string) => {
      await page.evaluate(({ workspaceKey, workspaceRaw }) => {
        window.localStorage.setItem(workspaceKey, workspaceRaw);
      }, {
        workspaceKey: SOFIA_WORKSPACE_KEY,
        workspaceRaw: raw,
      });
      expect(await page.evaluate(
        (workspaceKey) => window.localStorage.getItem(workspaceKey),
        SOFIA_WORKSPACE_KEY,
      )).toBe(raw);
    };
    const restoreVerifiedGateAWorkspace = async () => {
      await replaceWorkspaceRaw(verifiedGateAWorkspaceRaw);
      await gotoApprovedRoute("/workspace");
      expect(await page.evaluate(
        (workspaceKey) => window.localStorage.getItem(workspaceKey),
        SOFIA_WORKSPACE_KEY,
      )).toBe(verifiedGateAWorkspaceRaw);
      await expect(page.locator("[data-journey-summary]")).toHaveText("7 / 7 步已留证");
      await expect(page.locator("[data-cycle-ledger]")).toHaveAttribute("data-cycle-state", "complete");
    };
    const expectFocusedCapacityAlert = async (
      label: string,
      current: number,
      required: number | null,
      limit: number,
    ) => {
      const alert = page.locator("[data-workspace-capacity-alert]");
      await expect(alert).toBeVisible();
      await expect(alert).toHaveAttribute("role", "alert");
      await expect(alert).toHaveAttribute("tabindex", "-1");
      await expect(alert).toBeFocused();
      if (required !== null) {
        await expect(alert).toContainText(`${label}当前 ${current} 条`);
        await expect(alert).toContainText(`完成下一轮至少还需要 ${required} 条`);
        await expect(alert).toContainText(`安全上限 ${limit} 条`);
      } else {
        await expect(alert).toContainText(
          `${label}当前 ${current} 条，安全上限 ${limit} 条`,
        );
      }
      await expect(alert).toContainText("不会静默删除");
      await expect(alert.getByRole("link", { name: /前往我的本机数据/ }))
        .toHaveAttribute("href", "/my-data");
      return alert;
    };
    const parseSyntheticWorkspace = () => (
      JSON.parse(verifiedGateAWorkspaceRaw) as SyntheticCapacityWorkspace
    );

    stage = "synthetic capacity UI probe only — journey composite, not 7/7 evidence";
    await restoreVerifiedGateAWorkspace();
    const journeyCapacityWorkspace = parseSyntheticWorkspace();
    const planTemplate = journeyCapacityWorkspace.planHistory[0]
      ?? journeyCapacityWorkspace.plan;
    if (!planTemplate) throw new Error("synthetic journey capacity probe has no valid plan template");
    const verifiedPlanHistory = structuredClone(journeyCapacityWorkspace.planHistory);
    journeyCapacityWorkspace.planHistory = Array.from({ length: 64 }, (_, index) => (
      index < verifiedPlanHistory.length
        ? verifiedPlanHistory[index]
        : (() => {
            const syntheticPlan = structuredClone(planTemplate) as Record<string, unknown> & {
              createdAt?: string;
              days?: Array<{ tasks?: Array<Record<string, unknown>> }>;
            };
            const syntheticPlanId = `plan-capacity-probe-${String(index).padStart(2, "0")}-${randomUUID()}`;
            delete syntheticPlan.supersededByRetestId;
            syntheticPlan.planId = syntheticPlanId;
            syntheticPlan.status = "superseded";
            syntheticPlan.diagnosticSessionId = null;
            syntheticPlan.provenance = { source: "learner_configured_standalone" };
            syntheticPlan.supersededReason = "learner_manual_regeneration";
            syntheticPlan.supersededAt = new Date(
              Date.parse(syntheticPlan.createdAt ?? "2026-08-12T00:00:00.000Z") + 1,
            ).toISOString();
            syntheticPlan.days = syntheticPlan.days?.map((day, dayIndex) => ({
              ...day,
              tasks: day.tasks?.map((task, taskIndex) => ({
                ...task,
                taskId: `${syntheticPlanId}-day-${dayIndex + 1}-task-${taskIndex + 1}`,
              })),
            }));
            return syntheticPlan;
          })()
    ));
    const journeyCapacityRaw = JSON.stringify(journeyCapacityWorkspace);
    await replaceWorkspaceRaw(journeyCapacityRaw);
    await gotoApprovedRoute("/workspace");
    const blockedNextCycleAdmission = page.locator("[data-next-cycle-admission]");
    const blockedNextCycleAdmissionStatus = page.locator("[data-next-cycle-admission-status]");
    await expect(blockedNextCycleAdmission).toBeVisible();
    await expect(blockedNextCycleAdmission).toHaveAttribute("data-state", "capacity-blocked");
    await expect(blockedNextCycleAdmissionStatus).toHaveAttribute("role", "status");
    await expect(blockedNextCycleAdmissionStatus).toContainText("历史计划当前 64 条");
    await expect(blockedNextCycleAdmissionStatus).toContainText("完成下一轮至少还需要 2 条");
    await expect(blockedNextCycleAdmissionStatus).toContainText("安全上限 64 条");
    await expect(page.locator("[data-next-cycle-start]")).toBeHidden();
    const blockedNextCycleRecovery = page.locator("[data-next-cycle-recovery]");
    await expect(blockedNextCycleRecovery).toBeVisible();
    await expect(blockedNextCycleRecovery).toHaveAttribute("href", "/my-data");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(journeyCapacityRaw);
    await gotoApprovedRoute("/diagnostic");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(journeyCapacityRaw);
    await expect(page.locator("[data-diagnostic-report]")).toBeVisible();
    const restartCompletedDiagnostic = page.getByRole("button", {
      name: "重新完成一轮任务",
    });
    await expect(restartCompletedDiagnostic).toBeVisible();
    let unexpectedRestartDialogCount = 0;
    const dismissUnexpectedRestartDialog = (dialog: Dialog) => {
      unexpectedRestartDialogCount += 1;
      void dialog.dismiss();
    };
    page.on("dialog", dismissUnexpectedRestartDialog);
    await restartCompletedDiagnostic.click();
    page.off("dialog", dismissUnexpectedRestartDialog);
    expect(unexpectedRestartDialogCount).toBe(0);
    await expectFocusedCapacityAlert("历史计划", 64, 2, 64);
    const journeyCapacityAfter = await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    );
    expect(journeyCapacityAfter).toBe(journeyCapacityRaw);
    expect((JSON.parse(journeyCapacityAfter!) as SyntheticCapacityWorkspace).planHistory)
      .toHaveLength(64);
    await restoreVerifiedGateAWorkspace();

    stage = "synthetic capacity UI probe only — standalone practice, not 7/7 evidence";
    await restoreVerifiedGateAWorkspace();
    const practiceCapacityWorkspace = parseSyntheticWorkspace();
    const receiptTemplate = Object.values(practiceCapacityWorkspace.practiceReceipts)[0];
    if (!receiptTemplate) throw new Error("synthetic practice capacity probe has no valid receipt template");
    const saturatedPracticeReceipts: Record<string, Record<string, unknown>> = {};
    for (let index = 0; index < 256; index += 1) {
      const completionReceiptId = index === 0 && typeof receiptTemplate.completionReceiptId === "string"
        ? receiptTemplate.completionReceiptId
        : randomUUID();
      const practiceAttemptId = index === 0 && typeof receiptTemplate.practiceAttemptId === "string"
        ? receiptTemplate.practiceAttemptId
        : randomUUID();
      saturatedPracticeReceipts[completionReceiptId] = {
        ...structuredClone(receiptTemplate),
        completionReceiptId,
        practiceAttemptId,
        ...(index === 0 ? {} : {
          taskId: null,
          taskDate: null,
          planId: null,
          cycleId: null,
          diagnosticSessionId: null,
          recommendationId: null,
          taskRef: null,
        }),
      };
    }
    practiceCapacityWorkspace.practiceReceipts = saturatedPracticeReceipts;
    delete practiceCapacityWorkspace.practice["reading-library-v1"];
    await replaceWorkspaceRaw(JSON.stringify(practiceCapacityWorkspace));
    await gotoApprovedRoute("/practice-reading");
    await expect(page.locator("[data-practice-binding-status]"))
      .toHaveAttribute("data-binding-status", "standalone");
    const syntheticCorrectReadingOption = page.locator('input[name="reading-answer"][value="b"]');
    const syntheticReadingSubmit = page.locator("[data-check-reading]");
    await syntheticCorrectReadingOption.check();
    await expect(syntheticReadingSubmit).toBeEnabled();
    const practiceCapacityBaselineRaw = await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    );
    if (!practiceCapacityBaselineRaw) throw new Error("synthetic practice baseline raw is unavailable");
    expect(Object.keys(
      (JSON.parse(practiceCapacityBaselineRaw) as SyntheticCapacityWorkspace).practiceReceipts,
    )).toHaveLength(256);
    await syntheticReadingSubmit.click();
    await expectFocusedCapacityAlert("练习回执", 256, null, 256);
    await expect(page.locator("[data-reading-feedback]"))
      .toContainText("本次练习回执未写入");
    await expect(syntheticCorrectReadingOption).toBeEnabled();
    await expect(syntheticCorrectReadingOption).toBeChecked();
    await expect(syntheticReadingSubmit).toBeEnabled();
    const practiceCapacityAfter = await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    );
    expect(practiceCapacityAfter).toBe(practiceCapacityBaselineRaw);
    expect(Object.keys(
      (JSON.parse(practiceCapacityAfter!) as SyntheticCapacityWorkspace).practiceReceipts,
    )).toHaveLength(256);
    await restoreVerifiedGateAWorkspace();

    const makeSyntheticFocusSessions = (count: number) => Array.from(
      { length: count },
      (_, index) => {
        const startedAtMs = Date.UTC(2026, 0, 1, 0, 0, 0) + (index * 1_000);
        return {
          sessionId: `focus-capacityprobe${String(index).padStart(3, "0")}`,
          status: "completed",
          durationSeconds: 900,
          startedAt: new Date(startedAtMs).toISOString(),
          endedAt: new Date(startedAtMs + 900_000).toISOString(),
        };
      },
    );

    stage = "synthetic capacity UI probe only — focus terminal, not 7/7 evidence";
    await restoreVerifiedGateAWorkspace();
    const focusReservationWorkspace = parseSyntheticWorkspace();
    focusReservationWorkspace.focus = {
      active: null,
      sessions: makeSyntheticFocusSessions(511),
    };
    const focusReservationRaw = JSON.stringify(focusReservationWorkspace);
    await replaceWorkspaceRaw(focusReservationRaw);
    await gotoApprovedRoute("/focus");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(focusReservationRaw);
    const focusStart = page.locator("[data-focus-start]");
    const focusStop = page.locator("[data-focus-stop]");
    const focusReset = page.locator("[data-focus-reset]");
    const focusState = page.locator("[data-focus-state]");
    const focusAnnouncement = page.locator("[data-focus-announcement]");
    await focusStart.click();
    await expect(focusState).toHaveText("正在专注");
    await expect(focusStart).toHaveText("暂停");
    await expect(focusStop).toBeEnabled();
    const focusStartedRaw = await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    );
    if (!focusStartedRaw) throw new Error("synthetic focus reservation raw is unavailable");
    const focusStartedWorkspace = JSON.parse(focusStartedRaw) as SyntheticCapacityWorkspace;
    expect(focusStartedWorkspace.focus.sessions).toHaveLength(511);
    expect(focusStartedWorkspace.focus.active?.status).toBe("running");

    focusStartedWorkspace.focus.sessions = makeSyntheticFocusSessions(512);
    const focusTerminalCapacityRaw = JSON.stringify(focusStartedWorkspace);
    await replaceWorkspaceRaw(focusTerminalCapacityRaw);
    await gotoApprovedRoute("/focus");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(focusTerminalCapacityRaw);
    await expect(focusState).toHaveText("正在专注");
    await expect(focusStop).toBeEnabled();
    await focusStop.click();
    await expectFocusedCapacityAlert("专注记录", 512, null, 512);
    await expect(focusAnnouncement).toContainText("本轮专注记录未写入");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(focusTerminalCapacityRaw);
    await expect(focusStop).toBeEnabled();
    await expect(focusReset).toBeEnabled();
    await focusReset.click();
    await expect(focusState).toHaveText("准备开始");
    await expect(focusAnnouncement).toHaveText("专注计时已重置。");
    const resetFocusWorkspace = JSON.parse((await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    ))!) as SyntheticCapacityWorkspace;
    expect(resetFocusWorkspace.focus.active).toBeNull();
    expect(resetFocusWorkspace.focus.sessions).toHaveLength(512);
    await restoreVerifiedGateAWorkspace();

    stage = "synthetic capacity UI probe only — focus start, not 7/7 evidence";
    await restoreVerifiedGateAWorkspace();
    const focusStartCapacityWorkspace = parseSyntheticWorkspace();
    focusStartCapacityWorkspace.focus = {
      active: null,
      sessions: makeSyntheticFocusSessions(512),
    };
    const focusStartCapacityRaw = JSON.stringify(focusStartCapacityWorkspace);
    await replaceWorkspaceRaw(focusStartCapacityRaw);
    await gotoApprovedRoute("/focus");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(focusStartCapacityRaw);
    await expect(focusStart).toHaveText("开始专注");
    await expect(focusStart).toBeEnabled();
    stage = "synthetic capacity UI probe only — focus start rejection, not 7/7 evidence";
    await focusStart.click();
    await expectFocusedCapacityAlert("专注记录", 512, null, 512);
    await expect(focusAnnouncement).toContainText("新专注计时未写入");
    expect(await page.evaluate(
      (workspaceKey) => window.localStorage.getItem(workspaceKey),
      SOFIA_WORKSPACE_KEY,
    )).toBe(focusStartCapacityRaw);
    await expect(focusStart).toBeEnabled();
    await expect(focusStop).toBeDisabled();
    await expect(focusReset).toBeEnabled();
    stage = "synthetic capacity UI probe only — focus start restore, not 7/7 evidence";
    await restoreVerifiedGateAWorkspace();

    await page.evaluate(({ chatKey, teachingReviewKey }) => {
      window.localStorage.removeItem(chatKey);
      window.localStorage.removeItem(teachingReviewKey);
    }, {
      chatKey: SOFIA_CHAT_KEY,
      teachingReviewKey: TEACHING_REVIEW_DEMO_KEY,
    });
    expect(await readLocalNamespaces()).toEqual({
      chat: null,
      teachingReview: null,
      workspace: finalNamespaceRaw.workspace,
    });

    stage = "authenticated teaching-review demo";
    await gotoApprovedRoute("/teaching-review-demo");
    await expect(page.locator('[data-teaching-review-demo="gate_a_local_only"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "教研复核演示台" })).toBeVisible();

    stage = "authenticated Sofia local explanation";
    const sofiaQuestion = `为什么先练这个？（Clerk E2E ${uniqueSuffix.slice(0, 8)}）`;
    expect(await page.evaluate((chatKey) => window.localStorage.getItem(chatKey), SOFIA_CHAT_KEY))
      .toBeNull();

    const superTeacherPosts: string[] = [];
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      if (request.method() === "POST" && requestUrl.pathname === "/api/super-teacher") {
        superTeacherPosts.push(request.url());
      }
    });

    await gotoApprovedRoute("/super-teacher");
    await expect(page.getByRole("heading", { level: 1, name: "Sofia智能老师" })).toBeVisible();
    await expect(page.getByRole("heading", {
      level: 2,
      name: "问一个与当前学习有关的问题",
    })).toBeVisible();
    await expect(page.getByText("Reading 阅读 · 1 / 6 项本机诊断任务证据", { exact: true })).toBeVisible();

    const pageConversation = page.locator('section[aria-labelledby="conversation-title"]');
    const pageQuestionInput = pageConversation.getByRole("textbox", { name: "输入学习问题" });
    await expect(pageQuestionInput).toBeEnabled();
    await pageQuestionInput.fill(sofiaQuestion);
    await pageConversation.getByRole("button", { name: "在本机核对并回答" }).click();

    const pageConversationLog = pageConversation.locator('[aria-live="polite"]');
    await expect(pageConversationLog).toHaveAttribute("aria-busy", "false");
    await expect(pageConversationLog.locator("article")).toHaveCount(2);
    await expect(pageConversationLog.getByText(sofiaQuestion, { exact: true })).toHaveCount(1);
    await expect(pageConversationLog.getByText("本机有来源解释 · 未调用模型", { exact: true })).toHaveCount(1);
    await expect(pageConversationLog.getByRole("link", { name: /^来源：/ }).first()).toBeVisible();
    await expect(pageConversation.getByRole("status")).toContainText(
      "问题和学习摘要没有发送到本站服务端或外部模型",
    );

    await expect.poll(async () => {
      const rawSession = await page.evaluate(
        (chatKey) => window.localStorage.getItem(chatKey),
        SOFIA_CHAT_KEY,
      );
      if (!rawSession) return null;
      const storedSession = JSON.parse(rawSession) as {
        protocolVersion?: string;
        revision?: number;
        handoffRequests?: unknown[];
        turns?: Array<{
          createdAt?: string;
          role?: string;
          text?: string;
          response?: {
            claims?: Array<{ citations?: unknown[] }>;
            mode?: string;
            modelAttempted?: boolean;
          };
        }>;
      };
      const turns = storedSession.turns ?? [];
      const userTurn = turns[0];
      const assistantTurn = turns[1];
      return {
        protocolVersion: storedSession.protocolVersion,
        revision: storedSession.revision,
        turnCount: turns.length,
        roles: turns.map((turn) => turn.role),
        question: userTurn?.text,
        responseMode: assistantTurn?.response?.mode,
        modelAttempted: assistantTurn?.response?.modelAttempted,
        hasCitation: Boolean(
          assistantTurn?.response?.claims?.some((claim) => Boolean(claim.citations?.length)),
        ),
        sharedCreatedAt: Boolean(
          userTurn?.createdAt && userTurn.createdAt === assistantTurn?.createdAt,
        ),
        orphanUserTurnCount: turns.filter(
          (turn, index) => turn.role === "user" && turns[index + 1]?.role !== "assistant",
        ).length,
        assistantWithoutUserCount: turns.filter(
          (turn, index) => turn.role === "assistant" && turns[index - 1]?.role !== "user",
        ).length,
        handoffRequestCount: storedSession.handoffRequests?.length,
      };
    }).toEqual({
      protocolVersion: "sufeiya_super_teacher_v1",
      revision: 1,
      turnCount: 2,
      roles: ["user", "assistant"],
      question: sofiaQuestion,
      responseMode: "manual_grounded",
      modelAttempted: false,
      hasCitation: true,
      sharedCreatedAt: true,
      orphanUserTurnCount: 0,
      assistantWithoutUserCount: 0,
      handoffRequestCount: 0,
    });
    expect(superTeacherPosts).toEqual([]);

    stage = "authenticated Sofia landscape session refresh";
    await refreshApprovedSessionBeforeDocumentNavigation();

    stage = "authenticated Sofia landscape navigation";
    await page.setViewportSize({ width: 812, height: 375 });
    await gotoApprovedRoute("/resources");

    stage = "authenticated Sofia landscape launcher";
    const sofiaLauncher = page.getByRole("button", { name: "打开 Sofia智能老师对话" });
    await expect(sofiaLauncher).toBeVisible();
    await sofiaLauncher.click();

    stage = "authenticated Sofia landscape dialog";
    const sofiaDialog = page.getByRole("dialog", { name: "Sofia智能老师" });
    await expect(sofiaDialog).toBeVisible();
    const closeSofiaDialog = sofiaDialog.getByRole("button", { name: "关闭 Sofia智能老师对话" });
    await expect(closeSofiaDialog).toBeInViewport();

    const dialogQuestionInput = sofiaDialog.getByRole("textbox", { name: "输入学习问题" });
    await dialogQuestionInput.scrollIntoViewIfNeeded();
    await expect(dialogQuestionInput).toBeEnabled();
    await expect(dialogQuestionInput).toBeInViewport();
    await dialogQuestionInput.fill("怎样验证我真的有进步？");

    const dialogSubmit = sofiaDialog.getByRole("button", { name: "在本机核对并回答" });
    await dialogSubmit.scrollIntoViewIfNeeded();
    await expect(dialogSubmit).toBeEnabled();
    await expect(dialogSubmit).toBeInViewport();

    const fullPageLink = sofiaDialog.getByRole("link", { name: /打开完整页面与人工支持/ });
    await fullPageLink.scrollIntoViewIfNeeded();
    await expect(fullPageLink).toBeInViewport();
    await expect(closeSofiaDialog).toBeInViewport();

    const landscapeDialogGeometry = await sofiaDialog.evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        clientHeight: dialog.clientHeight,
        scrollHeight: dialog.scrollHeight,
        overflowY: window.getComputedStyle(dialog).overflowY,
      };
    });
    expect(landscapeDialogGeometry.top).toBeGreaterThanOrEqual(0);
    expect(landscapeDialogGeometry.bottom).toBeLessThanOrEqual(376);
    expect(landscapeDialogGeometry.scrollHeight).toBeGreaterThan(landscapeDialogGeometry.clientHeight);
    expect(landscapeDialogGeometry.overflowY).toMatch(/auto|scroll/);
    await closeSofiaDialog.click();
    await expect(sofiaDialog).not.toBeVisible();
    await expect(sofiaLauncher).toBeFocused();
    expect(superTeacherPosts).toEqual([]);

    stage = "Clerk sign-out";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clerk.loaded({ page });
    await clerk.signOut({ page });

    stage = "post-sign-out Sofia privacy";
    await page.addInitScript(
      ({ chatKey, workspaceKey }) => {
        const trackedWindow = window as Window & {
          __sufeiyaPrivateStorageReads?: string[];
        };
        trackedWindow.__sufeiyaPrivateStorageReads = [];
        const originalGetItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function getTrackedPrivateItem(key: string) {
          if (
            this === window.localStorage
            && (key === chatKey || key === workspaceKey)
          ) {
            trackedWindow.__sufeiyaPrivateStorageReads?.push(key);
          }
          return originalGetItem.call(this, key);
        };
      },
      { chatKey: SOFIA_CHAT_KEY, workspaceKey: SOFIA_WORKSPACE_KEY },
    );
    await page.goto("/super-teacher", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => url.pathname === "/super-teacher");
    await expect(page.getByRole("heading", { level: 2, name: "受邀账户登录后继续本机学习对话。" })).toBeVisible();
    await expect(page.getByText(sofiaQuestion, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "输入学习问题" })).toHaveCount(0);
    const publicPagePrivateReads = await page.evaluate(() => (
      window as Window & { __sufeiyaPrivateStorageReads?: string[] }
    ).__sufeiyaPrivateStorageReads ?? []);
    expect(publicPagePrivateReads).toEqual([]);
    const retainedLocalQuestion = await page.evaluate((chatKey) => {
      const rawSession = window.localStorage.getItem(chatKey);
      if (!rawSession) return null;
      const storedSession = JSON.parse(rawSession) as {
        turns?: Array<{ role?: string; text?: string }>;
      };
      return storedSession.turns?.find((turn) => turn.role === "user")?.text ?? null;
    }, SOFIA_CHAT_KEY);
    expect(retainedLocalQuestion).toBe(sofiaQuestion);
    expect(superTeacherPosts).toEqual([]);

    stage = "post-sign-out route protection";
    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname === "/sign-in");
    await expect(page.locator(".cl-signIn-root")).toBeVisible({
      timeout: CLERK_BROWSER_BOOT_TIMEOUT_MS,
    });
  } catch {
    throw new Error(`Clerk Development smoke failed during ${stage}.`);
  }
});
