import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  test,
  type BrowserContext,
  type JSHandle,
  type Page,
  type Route,
} from "@playwright/test";

import {
  assertCompatibleClerkProductionHumanEnvironment,
  buildClerkProductionHumanReceipt,
  CLERK_PRODUCTION_ACCOUNT_COMMITMENT_PROTOCOL,
  CLERK_PRODUCTION_CANONICAL_ORIGIN,
  CLERK_PRODUCTION_FRONTEND_API_HOST,
  CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL,
  getClerkProductionHumanAcceptanceInput,
  readClerkProductionHumanSourceSnapshot,
} from "./clerk-production-human-config";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const receiptDirectory = fileURLToPath(
  new URL("../../output/clerk-production-human-receipts/", import.meta.url),
);
const attemptDirectory = fileURLToPath(
  new URL("../../output/clerk-production-human-attempts/", import.meta.url),
);
const HUMAN_STEP_TIMEOUT_MS = 300_000;
const CLERK_RUNTIME_TIMEOUT_MS = 60_000;
const CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES = 1_000_000;

type ProductionHumanStage =
  | "source and run-mode preflight"
  | "persistent local attempt boundary"
  | "Production public Clerk environment preflight"
  | "Production fresh-browser signed-out boundary"
  | "Production invitation handoff"
  | "Production invitation app entry"
  | "Production human SignUp session"
  | "Production credential-page sanitization"
  | "Production signed-in verifier boot"
  | "Production approved workspace"
  | "Production account widget"
  | "Production local workspace canary"
  | "Production browser-internal continuity baseline"
  | "Production first sign-out"
  | "Production first signed-out workspace boundary"
  | "Production human credential re-login"
  | "Production same-account browser-internal continuity"
  | "Production browser-internal account commitment"
  | "Production re-login approved workspace"
  | "Production re-login account widget"
  | "Production final sign-out"
  | "Production final signed-out workspace boundary"
  | "Production browser-state sanitization"
  | "Production browser-context teardown"
  | "source revalidation"
  | "safe receipt write";

type ProductionHumanCleanupState = {
  context: BrowserContext;
  sensitiveUiMayRemain: boolean;
};

let cleanupState: ProductionHumanCleanupState | null = null;

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds);
});

async function waitForBoolean(
  probe: () => Promise<boolean>,
  timeout: number,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await probe()) return;
    } catch {
      // Navigation and Clerk re-render races are retried without retaining details.
    }
    await delay(500);
  }
  throw new Error("bounded browser condition was not reached");
}

async function sanitizeContextPages(context: BrowserContext) {
  for (let attempt = 0; attempt < 2 && context.pages().length > 0; attempt += 1) {
    for (const openPage of context.pages()) {
      await openPage.goto("about:blank", {
        timeout: 5_000,
        waitUntil: "commit",
      }).catch(() => undefined);
      await openPage.close().catch(() => undefined);
    }
  }
  return context.pages().length === 0;
}

async function hasExactCanonicalPath(page: Page, pathname: string) {
  return page.evaluate(({ canonicalOrigin, expectedPathname }) => (
    window.location.origin === canonicalOrigin
    && window.location.pathname === expectedPathname
  ), {
    canonicalOrigin: CLERK_PRODUCTION_CANONICAL_ORIGIN,
    expectedPathname: pathname,
  });
}

async function hasSignedInClerkRuntime(page: Page) {
  return page.evaluate(() => {
    const runtime = (window as Window & {
      Clerk?: {
        loaded?: boolean;
        session?: { currentTask?: unknown | null };
        user?: unknown;
      };
    }).Clerk;
    return runtime?.loaded === true
      && Boolean(runtime.session)
      && runtime.session?.currentTask == null
      && Boolean(runtime.user);
  });
}

async function hasSignedOutClerkRuntime(page: Page) {
  return page.evaluate((expectedFrontendApiHost) => {
    const runtime = (window as Window & {
      Clerk?: {
        frontendApi?: string;
        loaded?: boolean;
        publishableKey?: string;
        session?: unknown | null;
        user?: unknown | null;
      };
    }).Clerk;
    return runtime?.loaded === true
      && runtime.publishableKey?.startsWith("pk_live_") === true
      && runtime.frontendApi === expectedFrontendApiHost
      && runtime.session === null
      && runtime.user === null;
  }, CLERK_PRODUCTION_FRONTEND_API_HOST);
}

async function preflightProductionPublicClerkEnvironment() {
  const response = await fetch(CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = response.headers.get("content-length");
  if (
    response.status !== 200
    || response.url !== CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL
    || !/^application\/json(?:;|$)/i.test(contentType)
    || (
      declaredLength !== null
      && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES)
    )
  ) {
    throw new Error("Production public Clerk environment response mismatch");
  }
  if (!response.body) {
    throw new Error("Production public Clerk environment response body missing");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Production public Clerk environment payload size mismatch");
    }
    chunks.push(value);
  }
  if (totalBytes === 0) {
    throw new Error("Production public Clerk environment payload size mismatch");
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const snapshot = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  assertCompatibleClerkProductionHumanEnvironment(snapshot);
}

async function hasExactProductionInvitationUrlShape(page: Page) {
  return page.evaluate((canonicalOrigin) => {
    const url = new URL(window.location.href);
    const ticketValues = url.searchParams.getAll("__clerk_ticket");
    const statusValues = url.searchParams.getAll("__clerk_status");
    const queryKeys = [...url.searchParams.keys()];
    const documentedTicketOnly = queryKeys.length === 1
      && statusValues.length === 0;
    const observedTicketAndStatus = queryKeys.length === 2
      && statusValues.length === 1
      && statusValues[0] === "sign_up";
    return url.origin === canonicalOrigin
      && url.pathname === "/sign-up"
      && !url.username
      && !url.password
      && !url.hash
      && queryKeys.every((key) => (
        key === "__clerk_ticket" || key === "__clerk_status"
      ))
      && ticketValues.length === 1
      && ticketValues[0].length > 0
      && ticketValues[0].length <= 4_096
      && (documentedTicketOnly || observedTicketAndStatus);
  }, CLERK_PRODUCTION_CANONICAL_ORIGIN);
}

async function hasNativeProductionTicketSignUpRuntime(page: Page) {
  return page.evaluate(() => {
    const runtime = (window as Window & {
      Clerk?: {
        client?: {
          signUp?: {
            createdSessionId?: string | null;
            createdUserId?: string | null;
            hasPassword?: boolean;
            missingFields?: string[];
            status?: string | null;
            verifications?: {
              emailAddress?: {
                status?: string | null;
                strategy?: string | null;
              };
            };
          };
        };
        loaded?: boolean;
        publishableKey?: string;
        session?: unknown | null;
        user?: unknown | null;
      };
    }).Clerk;
    const signUp = runtime?.client?.signUp;
    const missingFields = [...(signUp?.missingFields ?? [])];
    return runtime?.loaded === true
      && runtime.publishableKey?.startsWith("pk_live_") === true
      && runtime.session === null
      && runtime.user === null
      && signUp?.status === "missing_requirements"
      && signUp.hasPassword === false
      && signUp.createdSessionId == null
      && signUp.createdUserId == null
      && missingFields.includes("password")
      && new Set(missingFields).size === missingFields.length
      && missingFields.every((field) => (
        field === "password" || field === "protect_check"
      ))
      && signUp.verifications?.emailAddress?.status === "verified"
      && signUp.verifications.emailAddress.strategy === "ticket";
  });
}

async function waitForInvitationBoundSession(
  context: BrowserContext,
  page: Page,
) {
  const deadline = Date.now() + HUMAN_STEP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (context.pages().length !== 1 || context.pages()[0] !== page) {
      throw new Error("initial invitation flow opened another page");
    }
    try {
      const state = await page.evaluate((canonicalOrigin) => {
        const runtime = (window as Window & {
          Clerk?: {
            client?: {
              signUp?: {
                createdSessionId?: string | null;
                createdUserId?: string | null;
                status?: string | null;
              };
            };
            loaded?: boolean;
            session?: { currentTask?: unknown | null; id?: string };
            user?: { id?: string };
          };
        }).Clerk;
        const signUp = runtime?.client?.signUp;
        const pathname = window.location.pathname;
        return {
          allowedPath: window.location.origin === canonicalOrigin
            && (
              pathname === "/sign-up"
              || pathname.startsWith("/sign-up/")
              || pathname === "/workspace"
              || pathname === "/beta-access"
            ),
          signedInReady: runtime?.loaded === true
            && Boolean(runtime.session)
            && runtime.session?.currentTask == null
            && Boolean(runtime.user)
            && signUp?.status === "complete"
            && Boolean(signUp.createdSessionId)
            && signUp.createdSessionId === runtime.session?.id
            && Boolean(signUp.createdUserId)
            && signUp.createdUserId === runtime.user?.id,
        };
      }, CLERK_PRODUCTION_CANONICAL_ORIGIN);
      if (!state.allowedPath) {
        throw new Error("initial invitation flow left its allowed route set");
      }
      if (state.signedInReady) return;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("initial invitation flow")) {
        throw error;
      }
      // Same-page Clerk transitions may briefly replace the execution context.
    }
    await delay(250);
  }
  throw new Error("invitation-bound session was not established");
}

async function visitApprovedRoute(page: Page, pathname: string) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await page.goto(
        `${CLERK_PRODUCTION_CANONICAL_ORIGIN}${pathname}`,
        { timeout: 30_000, waitUntil: "domcontentloaded" },
      );
      const approved = response?.status() === 200
        && await response.headerValue("x-sufeiya-beta-access") === "approved"
        && await response.headerValue("x-sufeiya-account-mode")
          === "clerk-invite-gated-local-learning-data"
        && (await response.headerValue("cache-control"))?.includes("private") === true
        && (await response.headerValue("cache-control"))?.includes("no-store") === true
        && await response.headerValue("x-robots-tag") === "noindex, nofollow"
        && await hasExactCanonicalPath(page, pathname);
      if (approved) return;
    } catch {
      // A newly issued session may need its normal short token refresh window.
    }
    await delay(2_000);
  }
  throw new Error("approved route did not become available");
}

async function verifyWorkspaceSurface(page: Page) {
  await waitForBoolean(async () => (
    await page.locator("main.workspace-page").isVisible()
    && await page.locator("[data-journey-summary]").evaluate(
      (node) => Boolean(node.textContent?.trim()),
    ).catch(() => false)
    && await page.locator(".local-mode-badge").evaluate(
      (node) => node.textContent?.trim() === "邀请制内测 · 学习数据仍在本机",
    ).catch(() => false)
  ), CLERK_RUNTIME_TIMEOUT_MS);
}

async function verifyAccountSurface(page: Page) {
  const response = await page.goto(
    `${CLERK_PRODUCTION_CANONICAL_ORIGIN}/account`,
    { timeout: 30_000, waitUntil: "domcontentloaded" },
  );
  const responseBoundary = response?.status() === 200
    && await response.headerValue("x-sufeiya-beta-access") === "not_checked"
    && await response.headerValue("x-sufeiya-account-mode")
      === "clerk-invite-gated-local-learning-data"
    && (await response.headerValue("cache-control"))?.includes("private") === true
    && (await response.headerValue("cache-control"))?.includes("no-store") === true
    && await response.headerValue("x-robots-tag") === "noindex, nofollow"
    && await hasExactCanonicalPath(page, "/account");
  if (!responseBoundary) throw new Error("account route boundary mismatch");
  await waitForBoolean(async () => (
    await page.locator("#auth-page-title").evaluate(
      (node) => node.textContent?.trim() === "管理你的账户。",
    ).catch(() => false)
    && await page.locator(".account-profile-wrap").isVisible()
    && await page.locator(".cl-userProfile-root").isVisible()
  ), CLERK_RUNTIME_TIMEOUT_MS);
}

async function createLocalWorkspaceCanary(page: Page) {
  await visitApprovedRoute(page, "/focus");
  const startButton = page.locator("[data-focus-start]");
  const resetButton = page.locator("[data-focus-reset]");
  await waitForBoolean(async () => (
    await startButton.isVisible() && await startButton.isEnabled()
  ), CLERK_RUNTIME_TIMEOUT_MS);
  await startButton.click();
  await waitForBoolean(() => page.locator("[data-focus-state]").evaluate(
    (node) => node.textContent?.trim() === "正在专注",
  ).catch(() => false), CLERK_RUNTIME_TIMEOUT_MS);
  await resetButton.click();
  await waitForBoolean(async () => (
    await page.locator("[data-focus-state]").evaluate(
      (node) => node.textContent?.trim() === "准备开始",
    ).catch(() => false)
    && await page.locator("[data-focus-announcement]").evaluate(
      (node) => node.textContent?.trim() === "专注计时已重置。",
    ).catch(() => false)
    && await page.evaluate(() => {
      const raw = window.localStorage.getItem("sufeiya_workspace_v1");
      return typeof raw === "string" && raw.length > 0;
    })
  ), CLERK_RUNTIME_TIMEOUT_MS);
}

async function createBrowserInternalContinuityBaseline(page: Page) {
  return page.evaluateHandle(async () => {
    const runtime = (window as Window & {
      Clerk?: { user?: { id?: string } };
    }).Clerk;
    const userId = runtime?.user?.id;
    if (!userId) throw new Error("signed-in identity unavailable");

    const key = await window.crypto.subtle.generateKey(
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const encoder = new TextEncoder();
    const sign = async (value: string) => new Uint8Array(
      await window.crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    );
    const namespaceNames = [
      "sufeiya_workspace_v1",
      "sufeiya_super_teacher_v1",
      "sufeiya_teaching_review_demo_v1",
    ] as const;
    const namespaceMacs: Record<string, Uint8Array> = {};
    const namespacePresence: Record<string, boolean> = {};
    for (const name of namespaceNames) {
      const raw = window.localStorage.getItem(name);
      namespacePresence[name] = raw !== null;
      namespaceMacs[name] = await sign(
        `namespace\0${name}\0${raw === null ? "absent" : "present"}\0${raw ?? ""}`,
      );
    }
    return {
      accountMac: await sign(`account\0${userId}`),
      key,
      namespaceMacs,
      namespacePresence,
    };
  });
}

async function compareBrowserInternalContinuity(
  page: Page,
  baseline: JSHandle<unknown>,
) {
  return page.evaluate(async (stored) => {
    const baselineState = stored as {
      accountMac: Uint8Array;
      key: CryptoKey;
      namespaceMacs: Record<string, Uint8Array>;
      namespacePresence: Record<string, boolean>;
    };
    const runtime = (window as Window & {
      Clerk?: { user?: { id?: string } };
    }).Clerk;
    const userId = runtime?.user?.id;
    if (!userId) return {
      allNamespacesEqual: false,
      sameAccount: false,
      workspacePresentBeforeAndAfter: false,
    };

    const encoder = new TextEncoder();
    const sign = async (value: string) => new Uint8Array(
      await window.crypto.subtle.sign(
        "HMAC",
        baselineState.key,
        encoder.encode(value),
      ),
    );
    const equalBytes = (left: Uint8Array, right: Uint8Array) => (
      left.byteLength === right.byteLength
      && left.every((value, index) => value === right[index])
    );
    const namespaceNames = [
      "sufeiya_workspace_v1",
      "sufeiya_super_teacher_v1",
      "sufeiya_teaching_review_demo_v1",
    ] as const;
    const namespaceEqualities: boolean[] = [];
    for (const name of namespaceNames) {
      const raw = window.localStorage.getItem(name);
      const currentMac = await sign(
        `namespace\0${name}\0${raw === null ? "absent" : "present"}\0${raw ?? ""}`,
      );
      namespaceEqualities.push(
        baselineState.namespacePresence[name] === (raw !== null)
        && equalBytes(baselineState.namespaceMacs[name], currentMac),
      );
    }
    const currentAccountMac = await sign(`account\0${userId}`);
    return {
      allNamespacesEqual: namespaceEqualities.every(Boolean),
      sameAccount: equalBytes(baselineState.accountMac, currentAccountMac),
      workspacePresentBeforeAndAfter:
        baselineState.namespacePresence.sufeiya_workspace_v1 === true
        && window.localStorage.getItem("sufeiya_workspace_v1") !== null,
    };
  }, baseline);
}

async function createBrowserAccountCommitment(
  page: Page,
  authorizationRunId: string,
) {
  return page.evaluate(async ({ commitmentProtocol, runId }) => {
    const userId = (window as Window & {
      Clerk?: { user?: { id?: string } };
    }).Clerk?.user?.id;
    if (!userId) return null;
    const bytes = new TextEncoder().encode(
      `${commitmentProtocol}\0${runId}\0${userId}`,
    );
    const digest = new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes));
    return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
  }, {
    commitmentProtocol: CLERK_PRODUCTION_ACCOUNT_COMMITMENT_PROTOCOL,
    runId: authorizationRunId,
  });
}

async function verifySignedOutWorkspaceBoundary(page: Page) {
  const response = await page.goto(
    `${CLERK_PRODUCTION_CANONICAL_ORIGIN}/workspace`,
    { timeout: 30_000, waitUntil: "domcontentloaded" },
  );
  const boundary = response?.status() === 200
    && await response.headerValue("x-sufeiya-beta-access") === "signed_out"
    && await response.headerValue("x-sufeiya-account-mode")
      === "clerk-invite-gated-local-learning-data"
    && (await response.headerValue("cache-control"))?.includes("private") === true
    && (await response.headerValue("cache-control"))?.includes("no-store") === true
    && await response.headerValue("x-robots-tag") === "noindex, nofollow"
    && await hasExactCanonicalPath(page, "/sign-in");
  if (!boundary) throw new Error("signed-out workspace boundary mismatch");
  await waitForBoolean(async () => (
    await page.locator("#auth-page-title").evaluate(
      (node) => node.textContent?.trim() === "登录后核验内测资格。",
    ).catch(() => false)
    && await page.locator(".clerk-widget-frame").isVisible()
    && await page.locator(".cl-signIn-root").isVisible()
    && await hasSignedOutClerkRuntime(page)
  ), CLERK_RUNTIME_TIMEOUT_MS);
}

test.describe.configure({ mode: "serial" });

test.afterEach("sanitize and close the temporary Production browser", async ({ context }, testInfo) => {
  testInfo.setTimeout(60_000);
  const state = cleanupState;
  cleanupState = null;
  if (!state) return;

  let sanitizationFailed = false;
  if (state.sensitiveUiMayRemain) {
    sanitizationFailed = !await sanitizeContextPages(state.context);
  }
  let closeFailed = false;
  await context.close().catch(() => {
    closeFailed = true;
  });
  if (sanitizationFailed || closeFailed) {
    throw new Error(
      "Production human Clerk browser teardown failed without retaining identity details.",
    );
  }
});

test("an authorized human can accept one existing Production invitation and re-login", async ({
  context,
  page: invitationPage,
}, testInfo) => {
  let stage: ProductionHumanStage = "source and run-mode preflight";
  let failure: Error | null = null;
  let accountCommitment: string | null = null;
  let continuityBaseline: JSHandle<unknown> | null = null;
  const startedAt = new Date().toISOString();
  const browserVersion = context.browser()?.version() ?? "";
  cleanupState = { context, sensitiveUiMayRemain: true };

  try {
    if (
      testInfo.retry !== 0
      || testInfo.project.retries !== 0
      || testInfo.project.repeatEach !== 1
    ) {
      throw new Error("Production human Clerk acceptance refuses retries or repetition");
    }
    const source = getClerkProductionHumanAcceptanceInput(
      readClerkProductionHumanSourceSnapshot(repositoryRoot),
    );

    stage = "Production invitation handoff";
    await invitationPage.goto(`${source.canonicalOrigin}/sign-up`, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    stage = "Production fresh-browser signed-out boundary";
    await waitForBoolean(
      () => hasSignedOutClerkRuntime(invitationPage),
      CLERK_RUNTIME_TIMEOUT_MS,
    );

    stage = "Production public Clerk environment preflight";
    await preflightProductionPublicClerkEnvironment();

    stage = "persistent local attempt boundary";
    await mkdir(attemptDirectory, { mode: 0o700, recursive: true });
    await writeFile(
      `${attemptDirectory}${source.authorizationRunId}.json`,
      `${JSON.stringify({
        authorizationRunId: source.authorizationRunId,
        declaredVercelDeploymentGitSha: source.declaredVercelDeploymentGitSha,
        declaredVercelDeploymentId: source.declaredVercelDeploymentId,
        harnessSourceGitSha: source.harnessSourceGitSha,
        protocolVersion: "sufeiya_clerk_production_human_attempt_v1",
        startedAt,
      }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );

    stage = "Production invitation handoff";
    process.stdout.write(
      "[Clerk Production human journey] In the visible temporary Chrome, open the already-authorized Production invitation URL in the address bar, then wait for the next terminal message. Never paste the URL or credentials into this terminal.\n",
    );
    await waitForBoolean(async () => (
      await hasExactCanonicalPath(invitationPage, "/sign-up")
      && await hasExactProductionInvitationUrlShape(invitationPage)
      && await invitationPage.locator(
        '[data-clerk-invitation-entry="ticket-present"]',
      ).isVisible()
    ), HUMAN_STEP_TIMEOUT_MS);

    stage = "Production invitation app entry";
    const signInDocumentPattern = /^https:\/\/sufeiya\.cn\/sign-in(?:[/?#]|$)/;
    const blockInitialSignIn = (route: Route) => route.abort("blockedbyclient");
    await context.route(signInDocumentPattern, blockInitialSignIn);
    process.stdout.write(
      "[Clerk Production human journey] Complete any visible same-page invitation or anti-bot step. Do not open another tab, switch to ordinary sign-in, or use social login.\n",
    );
    try {
      await waitForBoolean(
        () => hasNativeProductionTicketSignUpRuntime(invitationPage),
        CLERK_RUNTIME_TIMEOUT_MS,
      );
      process.stdout.write(
        "[Clerk Production human journey] The native ticket SignUp state is bound. Complete the remaining Clerk steps in this same page; the harness does not inspect any field value.\n",
      );
      stage = "Production human SignUp session";
      await waitForInvitationBoundSession(context, invitationPage);
    } finally {
      await context.unroute(signInDocumentPattern, blockInitialSignIn);
    }

    const sentinelPage = await context.newPage();
    await sentinelPage.goto(source.canonicalOrigin, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    await waitForBoolean(
      () => hasSignedInClerkRuntime(sentinelPage),
      CLERK_RUNTIME_TIMEOUT_MS,
    );
    const verifierPage = await context.newPage();

    stage = "Production credential-page sanitization";
    await invitationPage.goto("about:blank", {
      timeout: 5_000,
      waitUntil: "commit",
    });
    await invitationPage.close();

    stage = "Production signed-in verifier boot";
    await verifierPage.goto(source.canonicalOrigin, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });
    await waitForBoolean(
      () => hasSignedInClerkRuntime(verifierPage),
      CLERK_RUNTIME_TIMEOUT_MS,
    );

    stage = "Production approved workspace";
    await visitApprovedRoute(verifierPage, "/workspace");
    await verifyWorkspaceSurface(verifierPage);

    stage = "Production account widget";
    await verifyAccountSurface(verifierPage);

    stage = "Production local workspace canary";
    await createLocalWorkspaceCanary(verifierPage);

    stage = "Production browser-internal continuity baseline";
    continuityBaseline = await createBrowserInternalContinuityBaseline(sentinelPage);

    stage = "Production first sign-out";
    await verifierPage.bringToFront();
    process.stdout.write(
      "[Clerk Production human acceptance] Use the visible account control to sign out yourself. The harness will only observe that Clerk session and user become null.\n",
    );
    await waitForBoolean(
      () => hasSignedOutClerkRuntime(sentinelPage),
      HUMAN_STEP_TIMEOUT_MS,
    );

    stage = "Production first signed-out workspace boundary";
    await verifySignedOutWorkspaceBoundary(verifierPage);
    process.stdout.write(
      "[Clerk Production human acceptance] In the visible Chrome, sign in again to the same account and complete every Clerk verification step yourself. The harness does not inspect the values or factor branch.\n",
    );

    stage = "Production human credential re-login";
    await waitForBoolean(
      () => hasSignedInClerkRuntime(verifierPage),
      HUMAN_STEP_TIMEOUT_MS,
    );
    await waitForBoolean(
      () => hasSignedInClerkRuntime(sentinelPage),
      CLERK_RUNTIME_TIMEOUT_MS,
    );

    stage = "Production same-account browser-internal continuity";
    const continuity = await compareBrowserInternalContinuity(
      sentinelPage,
      continuityBaseline,
    );
    if (
      !continuity.sameAccount
      || !continuity.allNamespacesEqual
      || !continuity.workspacePresentBeforeAndAfter
    ) {
      throw new Error("browser-internal continuity mismatch");
    }

    stage = "Production browser-internal account commitment";
    accountCommitment = await createBrowserAccountCommitment(
      sentinelPage,
      source.authorizationRunId,
    );
    if (!accountCommitment || !/^[0-9a-f]{64}$/.test(accountCommitment)) {
      throw new Error("browser account commitment unavailable");
    }

    stage = "Production re-login approved workspace";
    await visitApprovedRoute(verifierPage, "/workspace");
    await verifyWorkspaceSurface(verifierPage);

    stage = "Production re-login account widget";
    await verifyAccountSurface(verifierPage);

    stage = "Production final sign-out";
    await verifierPage.bringToFront();
    process.stdout.write(
      "[Clerk Production human acceptance] Use the visible account control to sign out one final time.\n",
    );
    await waitForBoolean(
      () => hasSignedOutClerkRuntime(sentinelPage),
      HUMAN_STEP_TIMEOUT_MS,
    );

    stage = "Production final signed-out workspace boundary";
    await verifySignedOutWorkspaceBoundary(verifierPage);

    stage = "Production browser-state sanitization";
    await continuityBaseline.dispose();
    continuityBaseline = null;
    if (!await sanitizeContextPages(context)) {
      throw new Error("browser-state sanitization failed");
    }
    cleanupState.sensitiveUiMayRemain = false;

    stage = "Production browser-context teardown";
    await context.close();
    cleanupState = null;

    stage = "source revalidation";
    const finalSource = getClerkProductionHumanAcceptanceInput(
      readClerkProductionHumanSourceSnapshot(repositoryRoot),
    );
    if (
      finalSource.authorizationRunId !== source.authorizationRunId
      || finalSource.harnessSourceGitSha !== source.harnessSourceGitSha
      || finalSource.declaredVercelDeploymentGitSha
        !== source.declaredVercelDeploymentGitSha
      || finalSource.declaredVercelDeploymentId !== source.declaredVercelDeploymentId
    ) {
      throw new Error("source binding changed during acceptance");
    }

    stage = "safe receipt write";
    const completedAt = new Date().toISOString();
    const receipt = buildClerkProductionHumanReceipt({
      accountCommitment,
      browserVersion,
      checks: {
        account_widget_pass: true,
        approved_workspace_pass: true,
        clerk_invitation_entry_observed: true,
        final_sign_out_boundary_pass: true,
        first_sign_out_boundary_pass: true,
        local_namespace_digest_continuity_pass: true,
        public_clerk_environment_preflight_pass: true,
        same_account_browser_internal_pass: true,
        signed_in_session_after_invitation: true,
        signed_in_session_after_relogin: true,
        workspace_canary_nonempty: true,
      },
      completedAt,
      source: finalSource,
      startedAt,
    });
    await mkdir(receiptDirectory, { mode: 0o700, recursive: true });
    const receiptName = [
      startedAt.replaceAll(":", "-").replace(".", "-"),
      finalSource.harnessSourceGitSha.slice(0, 12),
      finalSource.declaredVercelDeploymentId,
    ].join("_");
    await writeFile(
      `${receiptDirectory}${receiptName}.json`,
      `${JSON.stringify(receipt, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    process.stdout.write(
      "[Clerk Production human journey] PASS. A redacted local receipt was written after browser teardown; provider invitation status still requires a separate read-only receipt.\n",
    );
  } catch {
    failure = new Error(
      `Clerk Production human acceptance failed during ${stage}; do not retry or create another invitation without a new state review.`,
    );
  } finally {
    await continuityBaseline?.dispose().catch(() => undefined);
    if (cleanupState?.sensitiveUiMayRemain) {
      const sanitized = await sanitizeContextPages(context);
      if (sanitized) cleanupState.sensitiveUiMayRemain = false;
      else if (failure) {
        failure = new AggregateError(
          [failure, new Error("Production browser-state sanitization failed.")],
          "Production human Clerk acceptance and browser sanitization both failed without retaining identity details.",
        );
      } else {
        failure = new Error(
          "Production human Clerk browser sanitization failed without retaining identity details.",
        );
      }
    }
  }

  if (failure) throw failure;
});
