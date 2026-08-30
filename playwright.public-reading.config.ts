import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const port = 3212;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "output/playwright/public-reading-e2e",
  preserveOutput: "always",
  reporter: [["line"]],
  retries: 0,
  testDir: "./e2e/public-reading",
  timeout: 90_000,
  workers: 1,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    cwd: repositoryRoot,
    reuseExistingServer: false,
    stderr: "ignore",
    stdout: "ignore",
    timeout: 120_000,
    url: `${baseURL}/assets/sufeiya-mark.png`,
  },
  use: {
    actionTimeout: 10_000,
    baseURL,
    locale: "zh-CN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
});
