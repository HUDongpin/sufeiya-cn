import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanonicalClerkApiEnvironment,
  assertCleanClerkTestingBootstrap,
  assertCleanClerkTestingInitialEnvironment,
  assertMatchingDevelopmentClerkInstance,
  assertVerifiedClerkTestingHandoff,
  getClerkDevelopmentKeyPair,
  combineClerkE2EFailures,
  createClerkTestingHandoffAttestation,
  getClerkDevelopmentE2ETarget,
  installClerkTestingLogRedaction,
  getVercelHostedProtectionBypass,
} from "../e2e/clerk-development/clerk-development-config";

function developmentPublishableKey(host = "safe-example.clerk.accounts.dev") {
  return `pk_test_${Buffer.from(`${host}$`).toString("base64url")}`;
}

describe("Clerk Development E2E configuration", () => {
  it("uses loopback by default and only accepts a canonical HTTPS hosted Vercel override", () => {
    assert.deepEqual(getClerkDevelopmentE2ETarget({}), {
      baseURL: "http://localhost:3210",
      hosted: false,
      readinessURL: "http://localhost:3210/assets/sufeiya-mark.png",
    });
    assert.deepEqual(getClerkDevelopmentE2ETarget({
      SUFEIYA_CLERK_E2E_BASE_URL: "https://sufeiya-clerk-preview.vercel.app",
    }), {
      baseURL: "https://sufeiya-clerk-preview.vercel.app",
      hosted: true,
      readinessURL: null,
    });

    for (const value of [
      "http://sufeiya-clerk-preview.vercel.app",
      "https://sufeiya.cn",
      "https://sufeiya-clerk-preview.vercel.app/route",
      "https://sufeiya-clerk-preview.vercel.app/",
      "https://credential@sufeiya-clerk-preview.vercel.app",
      "https://sufeiya-clerk-preview.vercel.app?query=1",
      "https://sufeiya-clerk-preview.vercel.app#fragment",
    ]) {
      assert.throws(() => getClerkDevelopmentE2ETarget({
        SUFEIYA_CLERK_E2E_BASE_URL: value,
      }));
    }
  });

  it("accepts an explicit Vercel automation bypass only for a canonical hosted target", () => {
    const localTarget = getClerkDevelopmentE2ETarget({});
    const hostedTarget = getClerkDevelopmentE2ETarget({
      SUFEIYA_CLERK_E2E_BASE_URL: "https://sufeiya-clerk-preview.vercel.app",
    });
    const syntheticBypass = "v".repeat(32);

    assert.equal(getVercelHostedProtectionBypass(hostedTarget, {}), null);
    assert.equal(getVercelHostedProtectionBypass(hostedTarget, {
      SUFEIYA_VERCEL_PROTECTION_BYPASS: syntheticBypass,
    }), syntheticBypass);
    assert.throws(() => getVercelHostedProtectionBypass(localTarget, {
      SUFEIYA_VERCEL_PROTECTION_BYPASS: syntheticBypass,
    }));
    for (const value of ["short", ` ${syntheticBypass}`, `${syntheticBypass}\n`, "x".repeat(257)]) {
      assert.throws(() => getVercelHostedProtectionBypass(hostedTarget, {
        SUFEIYA_VERCEL_PROTECTION_BYPASS: value,
      }));
    }

  });

  it("locks Backend API requests to Clerk's canonical HTTPS origin and v1", () => {
    for (const environment of [
      {},
      { CLERK_API_URL: "https://api.clerk.com" },
      { CLERK_API_URL: "https://API.CLERK.COM/", CLERK_API_VERSION: "v1" },
    ]) {
      assert.doesNotThrow(() => assertCanonicalClerkApiEnvironment(environment));
    }

    for (const environment of [
      { CLERK_API_URL: "http://api.clerk.com" },
      { CLERK_API_URL: "https://api.clerk.com:443" },
      { CLERK_API_URL: "https://api.clerk.com/v1" },
      { CLERK_API_URL: "https://api.clerk.com?target=elsewhere" },
      { CLERK_API_URL: "https://api.clerk.com#fragment" },
      { CLERK_API_URL: "https://credential@api.clerk.com" },
      { CLERK_API_URL: "https://example.com" },
      { CLERK_API_VERSION: "v2" },
    ]) {
      assert.throws(() => assertCanonicalClerkApiEnvironment(environment));
    }
  });

  it("refuses an ambient testing token, FAPI, or debug mode before setup", () => {
    assert.doesNotThrow(() => assertCleanClerkTestingBootstrap({}));
    for (const environment of [
      { CLERK_TESTING_TOKEN: "preexisting-token" },
      { CLERK_FAPI: "other.clerk.accounts.dev" },
      { CLERK_TESTING_DEBUG: "1" },
      { SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: "preexisting-attestation" },
      { SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: "1770000000000" },
    ]) {
      assert.throws(() => assertCleanClerkTestingBootstrap(environment));
    }

    assert.doesNotThrow(() => assertCleanClerkTestingInitialEnvironment({}));
    assert.throws(() => assertCleanClerkTestingInitialEnvironment({
      SUFEIYA_CLERK_E2E_RUN_ID: "87c0c5d4-68fc-45bc-a65e-194c5c96bec9",
    }));
  });

  it("requires an HMAC-bound handoff from the project-based setup", () => {
    const keyPair = getClerkDevelopmentKeyPair({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: developmentPublishableKey(),
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    });
    const testingToken = "short-lived-development-testing-token";
    const runId = "87c0c5d4-68fc-45bc-a65e-194c5c96bec9";
    const issuedAt = Date.now().toString();
    const attestation = createClerkTestingHandoffAttestation(
      keyPair,
      keyPair.frontendApiHost,
      testingToken,
      runId,
      issuedAt,
    );

    assert.doesNotThrow(() => assertVerifiedClerkTestingHandoff(keyPair, {
      CLERK_FAPI: keyPair.frontendApiHost,
      CLERK_TESTING_TOKEN: testingToken,
      SUFEIYA_CLERK_E2E_RUN_ID: runId,
      SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: attestation,
      SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: issuedAt,
    }));
    const staleIssuedAt = (Date.now() - 10 * 60 * 1_000).toString();
    assert.throws(() => assertVerifiedClerkTestingHandoff(keyPair, {
      CLERK_FAPI: keyPair.frontendApiHost,
      CLERK_TESTING_TOKEN: "different-token",
      SUFEIYA_CLERK_E2E_RUN_ID: runId,
      SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: attestation,
      SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: issuedAt,
    }));
    assert.throws(() => assertVerifiedClerkTestingHandoff(keyPair, {
      CLERK_FAPI: "different.clerk.accounts.dev",
      CLERK_TESTING_TOKEN: testingToken,
      SUFEIYA_CLERK_E2E_RUN_ID: runId,
      SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: attestation,
      SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: issuedAt,
    }));
    assert.throws(() => assertVerifiedClerkTestingHandoff(keyPair, {
      CLERK_FAPI: keyPair.frontendApiHost,
      CLERK_TESTING_DEBUG: "1",
      CLERK_TESTING_TOKEN: testingToken,
      SUFEIYA_CLERK_E2E_RUN_ID: runId,
      SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: attestation,
      SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: issuedAt,
    }));
    assert.throws(() => assertVerifiedClerkTestingHandoff(keyPair, {
      CLERK_FAPI: keyPair.frontendApiHost,
      CLERK_TESTING_TOKEN: testingToken,
      SUFEIYA_CLERK_E2E_RUN_ID: runId,
      SUFEIYA_CLERK_E2E_SETUP_ATTESTATION: createClerkTestingHandoffAttestation(
        keyPair,
        keyPair.frontendApiHost,
        testingToken,
        runId,
        staleIssuedAt,
      ),
      SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT: staleIssuedAt,
    }));
  });

  it("redacts Clerk helper warnings and retains simultaneous smoke and cleanup failures", () => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const logs: string[] = [];
    const previousLog = console.log;
    const previousWarn = console.warn;
    const previousError = console.error;
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    console.warn = (...values: unknown[]) => warnings.push(values.join(" "));
    console.error = (...values: unknown[]) => errors.push(values.join(" "));

    try {
      const restore = installClerkTestingLogRedaction();
      console.log("sensitive FAPI request URL");
      console.warn("sensitive email, token, cookie, and user ID");
      console.error(new Error("sensitive response body"));
      restore();
    } finally {
      console.log = previousLog;
      console.warn = previousWarn;
      console.error = previousError;
    }

    assert.equal(logs.length, 1);
    assert.equal(warnings.length, 1);
    assert.equal(errors.length, 1);
    assert.equal(`${logs[0]} ${warnings[0]} ${errors[0]}`.includes("sensitive"), false);

    const combined = combineClerkE2EFailures(
      new Error("sanitized smoke stage"),
      new Error("sanitized cleanup stage"),
    );
    assert.equal(combined instanceof AggregateError, true);
    assert.equal((combined as AggregateError).errors.length, 2);
  });

  it("accepts one syntactically valid Development key pair without exposing it", () => {
    const keyPair = getClerkDevelopmentKeyPair({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: developmentPublishableKey(),
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    });

    assert.equal(keyPair.frontendApiHost, "safe-example.clerk.accounts.dev");
    assert.equal(JSON.stringify({ frontendApiHost: keyPair.frontendApiHost }).includes("sk_test_"), false);
  });

  it("fails closed for missing, production, malformed, or conflicting key material", () => {
    const validPublishableKey = developmentPublishableKey();
    const cases = [
      {},
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: validPublishableKey,
        CLERK_SECRET_KEY: "sk_live_abcdefghijklmnop",
      },
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_not-development",
        CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
      },
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_not-canonical-base64url",
        CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
      },
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: validPublishableKey,
        CLERK_PUBLISHABLE_KEY: developmentPublishableKey("different.clerk.accounts.dev"),
        CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
      },
    ];

    for (const environment of cases) {
      assert.throws(() => getClerkDevelopmentKeyPair(environment));
    }
  });

  it("requires the Secret Key instance to be Development and to own the Publishable Key FAPI", () => {
    const keyPair = getClerkDevelopmentKeyPair({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: developmentPublishableKey(),
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    });

    assert.doesNotThrow(() => assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: "development",
      frontendApiUrls: ["https://safe-example.clerk.accounts.dev"],
    }));
    assert.throws(() => assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: "production",
      frontendApiUrls: ["https://safe-example.clerk.accounts.dev"],
    }));
    assert.throws(() => assertMatchingDevelopmentClerkInstance(keyPair, {
      environmentType: "development",
      frontendApiUrls: ["https://different.clerk.accounts.dev"],
    }));
  });
});
