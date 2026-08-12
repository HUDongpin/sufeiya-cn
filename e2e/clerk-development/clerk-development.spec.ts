import { randomBytes, randomUUID } from "node:crypto";

import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import {
  expect,
  test,
  type Request as PlaywrightRequest,
  type Response as PlaywrightResponse,
} from "@playwright/test";

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

const SOFIA_WORKSPACE_KEY = "sufeiya_workspace_v1";
const SOFIA_CHAT_KEY = "sufeiya_super_teacher_v1";

const sofiaDiagnosticEvidence = [
  {
    taskId: "diagnostic-reading-library-v1",
    taskVersion: "v1",
    skill: "Reading",
    responseType: "single_choice",
    constructTag: "purpose_from_supporting_details",
    contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
  },
  {
    taskId: "diagnostic-reading-newsletter-v1",
    taskVersion: "v1",
    skill: "Reading",
    responseType: "single_choice",
    constructTag: "cause_from_text_structure",
    contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
  },
  {
    taskId: "diagnostic-listening-science-club-v1",
    taskVersion: "v1",
    skill: "Listening",
    responseType: "single_choice_audio",
    constructTag: "schedule_change_detail",
    contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
  },
  {
    taskId: "diagnostic-listening-language-lab-v1",
    taskVersion: "v1",
    skill: "Listening",
    responseType: "single_choice_audio",
    constructTag: "time_and_location_integration",
    contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    attempts: 1,
    firstResponse: "b",
    resultType: "first_response_matched",
  },
  {
    taskId: "diagnostic-speaking-learning-skill-v1",
    taskVersion: "v1",
    skill: "Speaking",
    responseType: "timed_self_report",
    constructTag: "task_coverage_and_connected_thoughts_self_report",
    contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
  },
  {
    taskId: "diagnostic-writing-learning-place-v1",
    taskVersion: "v1",
    skill: "Writing",
    responseType: "timed_local_text",
    constructTag: "task_response_structure_self_review",
    contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85",
    status: "completed",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
  },
] as const;

function createSofiaWorkspaceFixture() {
  return {
    schemaVersion: 1,
    journey: {
      protocolVersion: "gate_a_local_v1",
      activeCycle: {
        protocolVersion: "gate_a_local_v1",
        cycleId: "cycle-clerk-e2e-1",
        status: "in_progress",
        diagnosticSessionId: "diagnostic-clerk-e2e-1",
      },
      diagnostic: {
        protocolVersion: "gate_a_local_v1",
        diagnosticProtocolVersion: "gate_a_diagnostic_evidence_v1",
        taskSetVersion: "gate_a_original_6_v1",
        taskSetDigest: "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c",
        cycleId: "cycle-clerk-e2e-1",
        diagnosticSessionId: "diagnostic-clerk-e2e-1",
        status: "completed",
        adultConfirmed: true,
        devicePrecheck: { storageStatus: "available" },
        learnerConfirmedPriority: true,
        prioritySkill: "Writing",
        priorityBasis: "open_response_coverage_gap",
        evidenceSufficiency: "evidence_limited",
        evidenceConfidence: "medium",
        automatedScoreProduced: false,
        formalDiagnosisProduced: false,
        taskEvidence: sofiaDiagnosticEvidence,
      },
    },
  };
}

const emptySofiaSession = {
  protocolVersion: "sufeiya_super_teacher_v1",
  revision: 0,
  turns: [],
  handoffRequests: [],
} as const;

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
  | "real Clerk sign-in session"
  | "signed-in uninvited session claim refresh"
  | "authenticated workspace"
  | "authenticated teaching-review demo"
  | "authenticated Sofia local explanation"
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
      await page.getByRole("link", { name: "登录", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/sign-in");

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
    await expect(page.locator(".cl-signIn-root")).toBeVisible();

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
    stage = "real Clerk sign-in session";
    await clerk.signIn({
      emailAddress: temporaryEmail,
      page,
      setupClerkTestingTokenOptions: { frontendApiUrl: keyPair.frontendApiHost },
    });

    stage = "signed-in uninvited session claim refresh";
    const refreshedUninvitedSessionClaim = await page.evaluate(async () => {
      const runtime = (window as Window & {
        Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
      }).Clerk;
      if (!runtime?.session) return false;
      return Boolean(await runtime.session.getToken({ skipCache: true }));
    });
    expect(refreshedUninvitedSessionClaim).toBe(true);

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
    await client.users.updateUserMetadata(temporaryUser.id, {
      publicMetadata: {
        sufeiyaBetaAccess: {
          protocolVersion: "sufeiya_invite_only_beta_v1",
          status: "approved",
        },
      },
    });

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
    const refreshedSessionClaim = await page.evaluate(async () => {
      const runtime = (window as Window & {
        Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
      }).Clerk;
      if (!runtime?.session) return false;
      return Boolean(await runtime.session.getToken({ skipCache: true }));
    });
    expect(refreshedSessionClaim).toBe(true);

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

    stage = "authenticated Sofia local explanation";
    const sofiaQuestion = `为什么先练这个？（Clerk E2E ${uniqueSuffix.slice(0, 8)}）`;
    await page.evaluate(
      ({ chatKey, chatSession, workspace, workspaceKey }) => {
        window.localStorage.setItem(workspaceKey, JSON.stringify(workspace));
        window.localStorage.setItem(chatKey, JSON.stringify(chatSession));
      },
      {
        chatKey: SOFIA_CHAT_KEY,
        chatSession: emptySofiaSession,
        workspace: createSofiaWorkspaceFixture(),
        workspaceKey: SOFIA_WORKSPACE_KEY,
      },
    );

    const superTeacherPosts: string[] = [];
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      if (request.method() === "POST" && requestUrl.pathname === "/api/super-teacher") {
        superTeacherPosts.push(request.url());
      }
    });

    await page.goto("/super-teacher", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL((url) => url.pathname === "/super-teacher");
    await expect(page.getByRole("heading", { level: 1, name: "Sofia智能老师" })).toBeVisible();
    await expect(page.getByRole("heading", {
      level: 2,
      name: "问一个与当前学习有关的问题",
    })).toBeVisible();
    await expect(page.getByText("Writing 写作 · 6 / 6 项本机诊断任务证据", { exact: true })).toBeVisible();

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

    stage = "authenticated Sofia landscape dialog";
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto("/resources", { waitUntil: "domcontentloaded" });
    const sofiaLauncher = page.getByRole("button", { name: "打开 Sofia智能老师对话" });
    await expect(sofiaLauncher).toBeVisible();
    await sofiaLauncher.click();

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
    await expect(page.locator(".cl-signIn-root")).toBeVisible();
  } catch {
    throw new Error(`Clerk Development smoke failed during ${stage}.`);
  }
});
