import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import {
  assertCanonicalClerkApiEnvironment,
  assertCleanClerkTestingInitialEnvironment,
  CLERK_E2E_API_URL,
  CLERK_E2E_API_VERSION,
  getClerkDevelopmentE2ETarget,
  getClerkDevelopmentE2ESuite,
  getClerkDevelopmentKeyPair,
} from "./e2e/clerk-development/clerk-development-config";

// Playwright 1.62 otherwise captures an ARIA page snapshot in error-context.md.
// Disable that page artifact for this credential-bearing E2E, including when a
// browser failure prevents the explicit about:blank/close cleanup from landing.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const localEnvironmentPath = fileURLToPath(new URL(".env.local", import.meta.url));
const suite = getClerkDevelopmentE2ESuite();
const invitationAcceptanceSuite = suite === "invitation-acceptance";
if (existsSync(localEnvironmentPath)) process.loadEnvFile(localEnvironmentPath);

const runtimeState = globalThis as typeof globalThis & {
  __sufeiyaClerkDevelopmentE2ERunId?: string;
};
if (!runtimeState.__sufeiyaClerkDevelopmentE2ERunId) {
  const workerIndex = process.env.TEST_WORKER_INDEX;
  if (workerIndex !== undefined) {
    const inheritedRunId = process.env.SUFEIYA_CLERK_E2E_RUN_ID;
    if (
      !/^\d+$/.test(workerIndex)
      || !inheritedRunId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inheritedRunId)
    ) {
      throw new Error("Clerk Development E2E worker is missing its current-run marker.");
    }
  } else {
    assertCleanClerkTestingInitialEnvironment();
    delete process.env.CLERK_FAPI;
    delete process.env.CLERK_TESTING_DEBUG;
    delete process.env.CLERK_TESTING_TOKEN;
    delete process.env.SUFEIYA_CLERK_E2E_SETUP_ATTESTATION;
    delete process.env.SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT;
    process.env.SUFEIYA_CLERK_E2E_RUN_ID = randomUUID();
  }
  runtimeState.__sufeiyaClerkDevelopmentE2ERunId = process.env.SUFEIYA_CLERK_E2E_RUN_ID;
} else if (
  process.env.SUFEIYA_CLERK_E2E_RUN_ID
  !== runtimeState.__sufeiyaClerkDevelopmentE2ERunId
) {
  throw new Error("Clerk Development E2E current-run marker changed during configuration.");
}

assertCanonicalClerkApiEnvironment();
process.env.CLERK_API_URL = CLERK_E2E_API_URL;
process.env.CLERK_API_VERSION = CLERK_E2E_API_VERSION;

const keyPair = getClerkDevelopmentKeyPair();
process.env.CLERK_PUBLISHABLE_KEY = keyPair.publishableKey;

const target = getClerkDevelopmentE2ETarget();
const requestedPort = new URL(target.baseURL).port;

export default defineConfig({
  expect: { timeout: 20_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: invitationAcceptanceSuite
    ? "output/playwright/clerk-invitation-development-e2e"
    : "output/playwright/clerk-development-e2e",
  preserveOutput: "failures-only",
  reporter: [["line"]],
  retries: 0,
  testDir: "./e2e/clerk-development",
  // The authenticated happy path deliberately waits through the real Gate A
  // 20 + 90 second Speaking clock and 180 second Writing clock. The 15-minute
  // ceiling leaves bounded room for those 290 seconds plus Clerk and backup I/O.
  // Invitation acceptance is isolated from that long path so one persistent
  // invitation record is not coupled to unrelated learning timers.
  timeout: invitationAcceptanceSuite ? 600_000 : 900_000,
  workers: 1,
  webServer: target.hosted ? undefined : {
    command: `npm run start -- --hostname localhost --port ${requestedPort}`,
    cwd: repositoryRoot,
    reuseExistingServer: false,
    stderr: "ignore",
    stdout: "ignore",
    timeout: 180_000,
    url: target.readinessURL!,
  },
  use: {
    actionTimeout: 20_000,
    baseURL: target.baseURL,
    locale: "zh-CN",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "clerk-development-setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: invitationAcceptanceSuite
        ? "clerk-invitation-development-acceptance"
        : "clerk-development-smoke",
      dependencies: ["clerk-development-setup"],
      testMatch: invitationAcceptanceSuite
        ? /clerk-invitation-development\.spec\.ts/
        : /clerk-development\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
