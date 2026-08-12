import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ClerkAPIResponseError } from "@clerk/backend/errors";

import {
  assertCanonicalClerkApiEnvironment,
  assertCleanClerkTestingBootstrap,
  assertCleanClerkTestingInitialEnvironment,
  assertMatchingDevelopmentClerkInstance,
  assertVerifiedClerkTestingHandoff,
  ClerkExactUserDeletionError,
  getClerkDevelopmentKeyPair,
  combineClerkE2EFailures,
  createClerkTestingHandoffAttestation,
  deleteClerkExactUserWithVerification,
  getClerkDevelopmentE2ETarget,
  installClerkTestingLogRedaction,
  isRetryableClerkIdempotentMutationError,
  getVercelHostedProtectionBypass,
  recoverClerkExactUserDuringCreationUncertainty,
  retryClerkIdempotentMutation,
} from "../e2e/clerk-development/clerk-development-config";

function clerkApiError(
  status: number | undefined,
  message = "synthetic failure",
  retryAfter?: number,
) {
  const error = new ClerkAPIResponseError("synthetic", {
    data: [{ code: "synthetic_error", message }],
    status: status ?? 500,
    retryAfter,
  });
  if (status === undefined) {
    Object.defineProperty(error, "status", { configurable: true, value: undefined });
    error.errors = [{ code: "unexpected_error", message }] as typeof error.errors;
  }
  return error;
}

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

  it("retries only transient idempotent Clerk mutations and never masks deterministic failures", async () => {
    for (const status of [408, 409, 429, 500, 501, 503, 599]) {
      assert.equal(isRetryableClerkIdempotentMutationError(clerkApiError(status)), true);
    }
    for (const status of [400, 401, 403, 404, 422, 425]) {
      assert.equal(isRetryableClerkIdempotentMutationError(clerkApiError(status)), false);
    }
    assert.equal(
      isRetryableClerkIdempotentMutationError(clerkApiError(undefined, "fetch failed")),
      true,
    );
    assert.equal(
      isRetryableClerkIdempotentMutationError(clerkApiError(undefined, "Unexpected token in JSON")),
      false,
    );
    assert.equal(isRetryableClerkIdempotentMutationError(new Error("socket hang up")), true);
    assert.equal(isRetryableClerkIdempotentMutationError("ECONNRESET"), false);

    const transientError = clerkApiError(503);
    const delays: number[] = [];
    let calls = 0;
    const result = await retryClerkIdempotentMutation(async () => {
      calls += 1;
      if (calls < 3) throw transientError;
      return "approved";
    }, async (milliseconds) => {
      delays.push(milliseconds);
    });
    assert.equal(result, "approved");
    assert.equal(calls, 3);
    assert.deepEqual(delays, [1_000, 2_500]);

    calls = 0;
    await assert.rejects(
      retryClerkIdempotentMutation(async () => {
        calls += 1;
        throw transientError;
      }, async () => undefined),
      (error) => error === transientError,
    );
    assert.equal(calls, 3);

    const retryAfterError = clerkApiError(429, "rate limited", 2);
    const retryAfterDelays: number[] = [];
    calls = 0;
    await assert.rejects(
      retryClerkIdempotentMutation(async () => {
        calls += 1;
        throw retryAfterError;
      }, async (milliseconds) => {
        retryAfterDelays.push(milliseconds);
      }),
      (error) => error === retryAfterError,
    );
    assert.equal(calls, 3);
    assert.deepEqual(retryAfterDelays, [2_000, 2_500]);

    const overBudgetRetryAfterError = clerkApiError(429, "rate limited", 11);
    calls = 0;
    await assert.rejects(
      retryClerkIdempotentMutation(async () => {
        calls += 1;
        throw overBudgetRetryAfterError;
      }, async () => assert.fail("sleep must not run beyond the retry budget")),
      (error) => error === overBudgetRetryAfterError,
    );
    assert.equal(calls, 1);
  });

  it("deletes only one exact Clerk user and verifies absence across response loss or propagation delay", async () => {
    const exactUserId = "user_synthetic_cleanup";
    let deleteCalls = 0;
    let countCalls = 0;
    const successfulResult = await deleteClerkExactUserWithVerification(exactUserId, {
      deleteUser: async (userId) => {
        deleteCalls += 1;
        assert.equal(userId, exactUserId);
        return { id: userId };
      },
      getExactUserCount: async (userId) => {
        countCalls += 1;
        assert.equal(userId, exactUserId);
        return 0;
      },
      sleep: async () => assert.fail("an acknowledged deletion that is absent must not wait"),
    });
    assert.equal(successfulResult, "delete_acknowledged");
    assert.equal(deleteCalls, 1);
    assert.equal(countCalls, 1);

    deleteCalls = 0;
    countCalls = 0;
    const responseLossDelays: number[] = [];
    const responseLossResult = await deleteClerkExactUserWithVerification(exactUserId, {
      deleteUser: async () => {
        deleteCalls += 1;
        if (deleteCalls === 1) throw new Error("fetch failed");
        throw clerkApiError(404);
      },
      getExactUserCount: async () => {
        countCalls += 1;
        return 0;
      },
      sleep: async (milliseconds) => {
        responseLossDelays.push(milliseconds);
      },
    });
    assert.equal(responseLossResult, "exact_absence_verified_after_unacknowledged_delete");
    assert.equal(deleteCalls, 2);
    assert.equal(countCalls, 1);
    assert.deepEqual(responseLossDelays, [1_000]);

    const propagationCounts = [1, 1, 0];
    const propagationDelays: number[] = [];
    const propagationResult = await deleteClerkExactUserWithVerification(exactUserId, {
      deleteUser: async () => ({ id: exactUserId }),
      getExactUserCount: async () => propagationCounts.shift() ?? 0,
      sleep: async (milliseconds) => {
        propagationDelays.push(milliseconds);
      },
    });
    assert.equal(propagationResult, "delete_acknowledged");
    assert.deepEqual(propagationDelays, [1_000, 2_500]);

    let transientCountCalls = 0;
    const transientCountDelays: number[] = [];
    const transientCountResult = await deleteClerkExactUserWithVerification(exactUserId, {
      deleteUser: async () => ({ id: exactUserId }),
      getExactUserCount: async () => {
        transientCountCalls += 1;
        if (transientCountCalls === 1) throw new Error("socket hang up");
        return 0;
      },
      sleep: async (milliseconds) => {
        transientCountDelays.push(milliseconds);
      },
    });
    assert.equal(transientCountResult, "delete_acknowledged");
    assert.equal(transientCountCalls, 2);
    assert.deepEqual(transientCountDelays, [1_000]);

    await assert.rejects(
      deleteClerkExactUserWithVerification(exactUserId, {
        deleteUser: async () => ({ id: "user_different" }),
        getExactUserCount: async () => assert.fail("a mismatched acknowledgement must fail closed"),
        sleep: async () => undefined,
      }),
      (error) => error instanceof ClerkExactUserDeletionError && error.phase === "delete_ack",
    );

    await assert.rejects(
      deleteClerkExactUserWithVerification(exactUserId, {
        deleteUser: async () => {
          throw clerkApiError(403);
        },
        getExactUserCount: async () => 1,
        sleep: async () => undefined,
      }),
      (error) => error instanceof ClerkExactUserDeletionError && error.phase === "delete_call",
    );

    const permanentPresenceDelays: number[] = [];
    await assert.rejects(
      deleteClerkExactUserWithVerification(exactUserId, {
        deleteUser: async () => ({ id: exactUserId }),
        getExactUserCount: async () => 1,
        sleep: async (milliseconds) => {
          permanentPresenceDelays.push(milliseconds);
        },
      }),
      (error) => error instanceof ClerkExactUserDeletionError && error.phase === "exact_absence",
    );
    assert.deepEqual(permanentPresenceDelays, [1_000, 2_500, 5_000]);

    for (const invalidCount of [-1, 2, Number.NaN, 0.5]) {
      await assert.rejects(
        deleteClerkExactUserWithVerification(exactUserId, {
          deleteUser: async () => ({ id: exactUserId }),
          getExactUserCount: async () => invalidCount,
          sleep: async () => undefined,
        }),
        (error) => error instanceof ClerkExactUserDeletionError && error.phase === "exact_absence",
      );
    }

    const sensitiveSentinel = "sensitive-user-or-token-sentinel";
    await assert.rejects(
      deleteClerkExactUserWithVerification(exactUserId, {
        deleteUser: async () => {
          throw new Error(sensitiveSentinel);
        },
        getExactUserCount: async () => 1,
        sleep: async () => undefined,
      }),
      (error) => (
        error instanceof ClerkExactUserDeletionError
        && error.phase === "delete_call"
        && !error.message.includes(sensitiveSentinel)
        && !JSON.stringify(error).includes(sensitiveSentinel)
      ),
    );

    let invalidIdentityDeleteCalled = false;
    await assert.rejects(
      deleteClerkExactUserWithVerification(" user_not_exact ", {
        deleteUser: async () => {
          invalidIdentityDeleteCalled = true;
          return { id: exactUserId };
        },
        getExactUserCount: async () => 0,
      }),
      (error) => error instanceof ClerkExactUserDeletionError && error.phase === "delete_call",
    );
    assert.equal(invalidIdentityDeleteCalled, false);
  });

  it("observes delayed exact-user visibility without guessing or accepting an ambiguous identity", async () => {
    const observedBatches = [
      [],
      [],
      [{ id: "user_delayed_synthetic", marker: true }],
    ];
    const delays: number[] = [];
    const recovered = await recoverClerkExactUserDuringCreationUncertainty(
      async () => observedBatches.shift() ?? [],
      async (milliseconds) => {
        delays.push(milliseconds);
      },
    );
    assert.deepEqual(recovered, { id: "user_delayed_synthetic", marker: true });
    assert.deepEqual(delays, [1_000, 2_500]);

    let absenceObservations = 0;
    const absent = await recoverClerkExactUserDuringCreationUncertainty(
      async () => {
        absenceObservations += 1;
        return [];
      },
      async () => undefined,
    );
    assert.equal(absent, null);
    assert.equal(absenceObservations, 4);

    await assert.rejects(
      recoverClerkExactUserDuringCreationUncertainty(async () => ([
        { id: "user_first" },
        { id: "user_second" },
      ]), async () => undefined),
      /ambiguous/,
    );
    await assert.rejects(
      recoverClerkExactUserDuringCreationUncertainty(
        async () => ([{ id: "not-a-clerk-user-id" }]),
        async () => undefined,
      ),
      /invalid identity/,
    );
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
