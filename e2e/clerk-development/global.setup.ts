import { clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { test as setup } from "@playwright/test";

import {
  assertCanonicalClerkApiEnvironment,
  assertCleanClerkTestingBootstrap,
  assertMatchingDevelopmentClerkInstance,
  CLERK_E2E_API_URL,
  CLERK_E2E_API_VERSION,
  createClerkTestingHandoffAttestation,
  getClerkDevelopmentKeyPair,
  installClerkTestingLogRedaction,
} from "./clerk-development-config";

setup.describe.configure({ mode: "serial" });

setup("validate the Clerk Development instance and obtain a testing token", async () => {
  assertCanonicalClerkApiEnvironment();
  assertCleanClerkTestingBootstrap();
  process.env.CLERK_API_URL = CLERK_E2E_API_URL;
  process.env.CLERK_API_VERSION = CLERK_E2E_API_VERSION;
  delete process.env.CLERK_FAPI;
  delete process.env.CLERK_TESTING_DEBUG;
  delete process.env.CLERK_TESTING_TOKEN;
  delete process.env.SUFEIYA_CLERK_E2E_SETUP_ATTESTATION;
  delete process.env.SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT;

  const keyPair = getClerkDevelopmentKeyPair();
  process.env.CLERK_PUBLISHABLE_KEY = keyPair.publishableKey;
  const restoreClerkLogs = installClerkTestingLogRedaction();

  try {
    const client = createClerkClient({
      apiUrl: CLERK_E2E_API_URL,
      apiVersion: CLERK_E2E_API_VERSION,
      publishableKey: keyPair.publishableKey,
      secretKey: keyPair.secretKey,
    });
    const [instance, domains] = await Promise.all([
      client.instance.get(),
      client.domains.list(),
    ]);

    assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: instance.environmentType,
      frontendApiUrls: domains.data.map((domain) => domain.frontendApiUrl),
    });

    await clerkSetup({
      debug: false,
      dotenv: false,
      frontendApiUrl: keyPair.frontendApiHost,
      publishableKey: keyPair.publishableKey,
      secretKey: keyPair.secretKey,
    });
  } catch {
    throw new Error(
      "Clerk Development E2E setup failed before any temporary user was created; no key or instance detail was logged.",
    );
  } finally {
    restoreClerkLogs();
  }

  if (
    process.env.CLERK_FAPI !== keyPair.frontendApiHost
    || !process.env.CLERK_TESTING_TOKEN
  ) {
    throw new Error("Clerk Development E2E setup did not establish the isolated testing-token context.");
  }

  const runId = process.env.SUFEIYA_CLERK_E2E_RUN_ID;
  if (!runId) {
    throw new Error("Clerk Development E2E setup is missing its current-run marker.");
  }
  const issuedAt = Date.now().toString();
  process.env.SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT = issuedAt;
  process.env.SUFEIYA_CLERK_E2E_SETUP_ATTESTATION = createClerkTestingHandoffAttestation(
    keyPair,
    process.env.CLERK_FAPI,
    process.env.CLERK_TESTING_TOKEN,
    runId,
    issuedAt,
  );
});
