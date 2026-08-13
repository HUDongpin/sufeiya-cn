import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const port = 3211;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: false,
  outputDir: "output/playwright/offline-navigation-e2e",
  preserveOutput: "always",
  reporter: [["line"]],
  retries: 0,
  testDir: "./e2e/offline-navigation",
  timeout: 90_000,
  workers: 1,
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
    ...devices["Desktop Chrome"],
    actionTimeout: 10_000,
    baseURL,
    channel: "chrome",
    locale: "zh-CN",
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
});
