import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import {
  assertClerkProductionHumanCommandLine,
  CLERK_PRODUCTION_CANONICAL_ORIGIN,
  getClerkProductionHumanAcceptanceInput,
  readClerkProductionHumanSourceSnapshot,
} from "./e2e/clerk-production/clerk-production-human-config";

// Playwright 1.62 otherwise captures an ARIA page snapshot in error-context.md.
// This visible-browser flow may contain a real identity, password, or OTP.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
assertClerkProductionHumanCommandLine();
getClerkProductionHumanAcceptanceInput(
  readClerkProductionHumanSourceSnapshot(repositoryRoot),
);

export default defineConfig({
  expect: { timeout: 30_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "output/playwright/clerk-production-human-runtime",
  preserveOutput: "never",
  reporter: [["line"]],
  retries: 0,
  testDir: "./e2e/clerk-production",
  timeout: 1_200_000,
  workers: 1,
  use: {
    acceptDownloads: false,
    actionTimeout: 30_000,
    baseURL: CLERK_PRODUCTION_CANONICAL_ORIGIN,
    headless: false,
    ignoreHTTPSErrors: false,
    locale: "zh-CN",
    navigationTimeout: 30_000,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "clerk-production-human-acceptance",
      testMatch: /clerk-production-human\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
