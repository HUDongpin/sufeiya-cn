import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isClerkAPIResponseError } from "@clerk/backend/errors";

type ClerkDevelopmentEnvironment = {
  [key: string]: string | undefined;
  CLERK_API_URL?: string;
  CLERK_API_VERSION?: string;
  CLERK_FAPI?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_TESTING_DEBUG?: string;
  CLERK_TESTING_TOKEN?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  SUFEIYA_CLERK_E2E_BASE_URL?: string;
  SUFEIYA_CLERK_E2E_PORT?: string;
  SUFEIYA_CLERK_E2E_RUN_ID?: string;
  SUFEIYA_CLERK_E2E_SETUP_ATTESTATION?: string;
  SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT?: string;
  SUFEIYA_VERCEL_PROTECTION_BYPASS?: string;
};

export type ClerkDevelopmentKeyPair = Readonly<{
  frontendApiHost: string;
  publishableKey: string;
  secretKey: string;
}>;

export type ClerkDevelopmentInstanceSnapshot = Readonly<{
  environmentType: string;
  frontendApiUrls: readonly string[];
}>;

export type ClerkDevelopmentE2ETarget = Readonly<{
  baseURL: string;
  hosted: boolean;
  readinessURL: string | null;
}>;

const VERCEL_PROTECTION_BYPASS_ERROR =
  "The Vercel protection bypass must be an explicit URL-safe secret used only with a hosted Vercel target.";

const DEVELOPMENT_KEY_ERROR =
  "Clerk Development E2E requires one matching pk_test_/sk_test_ pair; production, malformed, or conflicting keys are refused.";

const DEVELOPMENT_INSTANCE_ERROR =
  "Clerk Development E2E refused the configured keys because their Development instance could not be matched.";

const CLERK_API_BOUNDARY_ERROR =
  "Clerk Development E2E only permits the canonical Clerk Backend API origin and version.";

const CLERK_TESTING_BOOTSTRAP_ERROR =
  "Clerk Development E2E refuses ambient Clerk testing state; setup must mint a fresh token.";

const CLERK_TESTING_HANDOFF_ERROR =
  "Clerk Development E2E requires the verified project-based setup handoff before any user operation.";

const CLERK_IDEMPOTENT_MUTATION_RETRY_DELAYS_MS = [1_000, 2_500] as const;
const CLERK_IDEMPOTENT_MUTATION_MAX_RETRY_AFTER_MS = 10_000;
const CLERK_EXACT_DELETION_ABSENCE_POLL_DELAYS_MS = [0, 1_000, 2_500, 5_000] as const;
const CLERK_EXACT_USER_RECOVERY_OBSERVATION_DELAYS_MS = [0, 1_000, 2_500, 5_000] as const;
const CLERK_NETWORK_FAILURE_PATTERN =
  /(?:^fetch failed$|^terminated$|network\s*(?:error|request failed)|socket hang up|\b(?:ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR_[A-Z_]+)\b)/i;

export const CLERK_E2E_API_URL = "https://api.clerk.com";
export const CLERK_E2E_API_VERSION = "v1";

function isClerkNetworkFailure(error: Error) {
  return error.name === "AbortError" || CLERK_NETWORK_FAILURE_PATTERN.test(error.message);
}

export function isRetryableClerkIdempotentMutationError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (!isClerkAPIResponseError(error)) return isClerkNetworkFailure(error);

  const status: unknown = error.status;
  if (typeof status === "number") {
    return status === 408
      || status === 409
      || status === 429
      || (status >= 500 && status <= 599);
  }

  return error.errors.length === 1
    && error.errors[0]?.code === "unexpected_error"
    && isClerkNetworkFailure(new Error(error.errors[0].message));
}

export async function retryClerkIdempotentMutation<T>(
  operation: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => (
    new Promise((resolve) => setTimeout(resolve, milliseconds))
  ),
): Promise<T> {
  for (let failureIndex = 0; ; failureIndex += 1) {
    try {
      return await operation();
    } catch (error) {
      const fallbackDelayMs = CLERK_IDEMPOTENT_MUTATION_RETRY_DELAYS_MS[failureIndex];
      if (fallbackDelayMs === undefined || !isRetryableClerkIdempotentMutationError(error)) {
        throw error;
      }

      const retryAfterSeconds = isClerkAPIResponseError(error) ? error.retryAfter : undefined;
      const retryAfterMs = typeof retryAfterSeconds === "number"
        && Number.isFinite(retryAfterSeconds)
        && retryAfterSeconds >= 0
        ? retryAfterSeconds * 1_000
        : 0;
      if (retryAfterMs > CLERK_IDEMPOTENT_MUTATION_MAX_RETRY_AFTER_MS) throw error;
      await sleep(Math.max(fallbackDelayMs, retryAfterMs));
    }
  }
}

export type ClerkExactUserDeletionFailurePhase =
  | "delete_call"
  | "delete_ack"
  | "exact_absence";

export class ClerkExactUserDeletionError extends Error {
  readonly phase: ClerkExactUserDeletionFailurePhase;

  constructor(phase: ClerkExactUserDeletionFailurePhase) {
    super(`Clerk Development exact-user cleanup failed during ${phase}.`);
    this.name = "ClerkExactUserDeletionError";
    this.phase = phase;
  }
}

export type ClerkExactUserDeletionDependencies = Readonly<{
  deleteUser: (userId: string) => Promise<Readonly<{ id: string }>>;
  getExactUserCount: (userId: string) => Promise<number>;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export type ClerkExactUserDeletionResult =
  | "delete_acknowledged"
  | "exact_absence_verified_after_unacknowledged_delete";

function exactUserCountRecognized(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1;
}

function canonicalClerkUserId(value: string) {
  return value === value.trim() && /^user_[A-Za-z0-9_-]{1,249}$/.test(value);
}

export async function recoverClerkExactUserDuringCreationUncertainty<
  ExactUser extends Readonly<{ id: string }>,
>(
  listExactUsers: () => Promise<readonly ExactUser[]>,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => (
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  ),
): Promise<ExactUser | null> {
  for (const delayMs of CLERK_EXACT_USER_RECOVERY_OBSERVATION_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    const exactUsers = await listExactUsers();
    if (!Array.isArray(exactUsers) || exactUsers.length > 1) {
      throw new Error("Clerk Development exact-user recovery was ambiguous.");
    }
    if (exactUsers.length === 1) {
      const recoveredUserId = exactUsers[0]?.id;
      if (typeof recoveredUserId !== "string" || !canonicalClerkUserId(recoveredUserId)) {
        throw new Error("Clerk Development exact-user recovery returned an invalid identity.");
      }
      return exactUsers[0] ?? null;
    }
  }
  return null;
}

export async function deleteClerkExactUserWithVerification(
  userId: string,
  dependencies: ClerkExactUserDeletionDependencies,
): Promise<ClerkExactUserDeletionResult> {
  if (!canonicalClerkUserId(userId)) {
    throw new ClerkExactUserDeletionError("delete_call");
  }

  const sleep = dependencies.sleep ?? ((milliseconds: number) => (
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  ));
  try {
    const deleted = await retryClerkIdempotentMutation(
      () => dependencies.deleteUser(userId),
      sleep,
    );
    const deletionResponse: unknown = deleted;
    if (
      !deletionResponse
      || typeof deletionResponse !== "object"
      || !("id" in deletionResponse)
      || deletionResponse.id !== userId
    ) {
      throw new ClerkExactUserDeletionError("delete_ack");
    }
  } catch (error) {
    if (error instanceof ClerkExactUserDeletionError) throw error;

    let exactCount: number;
    try {
      exactCount = await retryClerkIdempotentMutation(
        () => dependencies.getExactUserCount(userId),
        sleep,
      );
    } catch {
      throw new ClerkExactUserDeletionError("exact_absence");
    }
    if (!exactUserCountRecognized(exactCount)) {
      throw new ClerkExactUserDeletionError("exact_absence");
    }
    if (exactCount === 0) return "exact_absence_verified_after_unacknowledged_delete";
    throw new ClerkExactUserDeletionError("delete_call");
  }

  for (let attempt = 0; attempt < CLERK_EXACT_DELETION_ABSENCE_POLL_DELAYS_MS.length; attempt += 1) {
    const delayMs = CLERK_EXACT_DELETION_ABSENCE_POLL_DELAYS_MS[attempt];
    if (delayMs > 0) await sleep(delayMs);

    let exactCount: number;
    try {
      exactCount = await retryClerkIdempotentMutation(
        () => dependencies.getExactUserCount(userId),
        sleep,
      );
    } catch {
      throw new ClerkExactUserDeletionError("exact_absence");
    }
    if (!exactUserCountRecognized(exactCount)) {
      throw new ClerkExactUserDeletionError("exact_absence");
    }
    if (exactCount === 0) return "delete_acknowledged";
  }

  throw new ClerkExactUserDeletionError("exact_absence");
}

export function getClerkDevelopmentE2ETarget(
  environment: ClerkDevelopmentEnvironment = process.env,
): ClerkDevelopmentE2ETarget {
  const explicitBaseURL = environment.SUFEIYA_CLERK_E2E_BASE_URL?.trim();
  if (explicitBaseURL) {
    let url: URL;
    try {
      url = new URL(explicitBaseURL);
    } catch {
      throw new Error("SUFEIYA_CLERK_E2E_BASE_URL must be a canonical HTTPS hosted Vercel origin.");
    }
    if (
      url.protocol !== "https:"
      || url.port
      || url.pathname !== "/"
      || url.search
      || url.hash
      || url.username
      || url.password
      || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(url.hostname)
      || url.origin !== explicitBaseURL
    ) {
      throw new Error("SUFEIYA_CLERK_E2E_BASE_URL must be a canonical HTTPS hosted Vercel origin.");
    }
    return Object.freeze({ baseURL: url.origin, hosted: true, readinessURL: null });
  }

  const requestedPort = environment.SUFEIYA_CLERK_E2E_PORT?.trim() || "3210";
  if (
    !/^\d{4,5}$/.test(requestedPort)
    || Number(requestedPort) < 1_024
    || Number(requestedPort) > 65_535
  ) {
    throw new Error("SUFEIYA_CLERK_E2E_PORT must be an unprivileged TCP port.");
  }

  const baseURL = `http://localhost:${requestedPort}`;
  return Object.freeze({
    baseURL,
    hosted: false,
    readinessURL: `${baseURL}/assets/sufeiya-mark.png`,
  });
}

export function getVercelHostedProtectionBypass(
  target: ClerkDevelopmentE2ETarget,
  environment: ClerkDevelopmentEnvironment = process.env,
) {
  const bypassSecret = environment.SUFEIYA_VERCEL_PROTECTION_BYPASS;
  if (bypassSecret === undefined || bypassSecret === "") return null;
  if (
    !target.hosted
    || bypassSecret !== bypassSecret.trim()
    || !/^[A-Za-z0-9_-]{32,256}$/.test(bypassSecret)
  ) {
    throw new Error(VERCEL_PROTECTION_BYPASS_ERROR);
  }
  return bypassSecret;
}

const REDACTED_CLERK_WARNING =
  "[Clerk Development E2E] Clerk helper warning redacted; the current stage will determine test status.";
const REDACTED_CLERK_ERROR =
  "[Clerk Development E2E] Clerk helper error redacted; the current stage will determine test status.";
const REDACTED_CLERK_LOG =
  "[Clerk Development E2E] Clerk helper log redacted; the current stage will determine test status.";

const CLERK_TESTING_HANDOFF_MAX_AGE_MS = 5 * 60 * 1_000;
const CLERK_TESTING_HANDOFF_FUTURE_SKEW_MS = 10_000;

function failKeyPair(): never {
  throw new Error(DEVELOPMENT_KEY_ERROR);
}

export function assertCanonicalClerkApiEnvironment(
  environment: ClerkDevelopmentEnvironment = process.env,
) {
  const configuredApiUrl = environment.CLERK_API_URL?.trim();
  const configuredApiVersion = environment.CLERK_API_VERSION?.trim();

  if (configuredApiUrl) {
    try {
      if (!/^https:\/\/api\.clerk\.com\/?$/i.test(configuredApiUrl)) {
        throw new Error(CLERK_API_BOUNDARY_ERROR);
      }
      const url = new URL(configuredApiUrl);
      if (
        url.protocol !== "https:"
        || url.hostname !== "api.clerk.com"
        || url.host !== "api.clerk.com"
        || url.pathname !== "/"
        || url.search
        || url.hash
        || url.username
        || url.password
      ) {
        throw new Error(CLERK_API_BOUNDARY_ERROR);
      }
    } catch {
      throw new Error(CLERK_API_BOUNDARY_ERROR);
    }
  }

  if (configuredApiVersion && configuredApiVersion !== CLERK_E2E_API_VERSION) {
    throw new Error(CLERK_API_BOUNDARY_ERROR);
  }
}

export function assertCleanClerkTestingBootstrap(
  environment: ClerkDevelopmentEnvironment = process.env,
) {
  if (
    environment.CLERK_FAPI?.trim()
    || environment.CLERK_TESTING_DEBUG?.trim()
    || environment.CLERK_TESTING_TOKEN?.trim()
    || environment.SUFEIYA_CLERK_E2E_SETUP_ATTESTATION?.trim()
    || environment.SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT?.trim()
  ) {
    throw new Error(CLERK_TESTING_BOOTSTRAP_ERROR);
  }
}

export function assertCleanClerkTestingInitialEnvironment(
  environment: ClerkDevelopmentEnvironment = process.env,
) {
  assertCleanClerkTestingBootstrap(environment);
  if (environment.SUFEIYA_CLERK_E2E_RUN_ID?.trim()) {
    throw new Error(CLERK_TESTING_BOOTSTRAP_ERROR);
  }
}

export function createClerkTestingHandoffAttestation(
  keyPair: ClerkDevelopmentKeyPair,
  frontendApiHost: string,
  testingToken: string,
  runId: string,
  issuedAt: string,
) {
  return createHmac("sha256", keyPair.secretKey)
    .update(
      `sufeiya-clerk-development-e2e-v2\0${frontendApiHost}\0${testingToken}\0${runId}\0${issuedAt}`,
    )
    .digest("hex");
}

export function assertVerifiedClerkTestingHandoff(
  keyPair: ClerkDevelopmentKeyPair,
  environment: ClerkDevelopmentEnvironment = process.env,
) {
  const frontendApiHost = environment.CLERK_FAPI?.trim();
  const testingToken = environment.CLERK_TESTING_TOKEN?.trim();
  const runId = environment.SUFEIYA_CLERK_E2E_RUN_ID?.trim();
  const attestation = environment.SUFEIYA_CLERK_E2E_SETUP_ATTESTATION?.trim();
  const issuedAt = environment.SUFEIYA_CLERK_E2E_SETUP_ISSUED_AT?.trim();
  if (
    environment.CLERK_TESTING_DEBUG?.trim()
    || frontendApiHost !== keyPair.frontendApiHost
    || !testingToken
    || !runId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)
    || !issuedAt
    || !/^\d{13}$/.test(issuedAt)
    || !attestation
    || !/^[a-f0-9]{64}$/.test(attestation)
  ) {
    throw new Error(CLERK_TESTING_HANDOFF_ERROR);
  }

  const issuedAtMs = Number(issuedAt);
  const ageMs = Date.now() - issuedAtMs;
  if (
    !Number.isSafeInteger(issuedAtMs)
    || ageMs > CLERK_TESTING_HANDOFF_MAX_AGE_MS
    || ageMs < -CLERK_TESTING_HANDOFF_FUTURE_SKEW_MS
  ) {
    throw new Error(CLERK_TESTING_HANDOFF_ERROR);
  }

  const expected = createClerkTestingHandoffAttestation(
    keyPair,
    frontendApiHost,
    testingToken,
    runId,
    issuedAt,
  );
  if (!timingSafeEqual(Buffer.from(attestation, "hex"), Buffer.from(expected, "hex"))) {
    throw new Error(CLERK_TESTING_HANDOFF_ERROR);
  }
}

export function installClerkTestingLogRedaction() {
  const previousLog = console.log;
  const previousWarn = console.warn;
  const previousError = console.error;

  const redactedLog = () => previousLog.call(console, REDACTED_CLERK_LOG);
  const redactedWarn = () => previousWarn.call(console, REDACTED_CLERK_WARNING);
  const redactedError = () => previousError.call(console, REDACTED_CLERK_ERROR);
  console.log = redactedLog;
  console.warn = redactedWarn;
  console.error = redactedError;

  return () => {
    if (console.log === redactedLog) console.log = previousLog;
    if (console.warn === redactedWarn) console.warn = previousWarn;
    if (console.error === redactedError) console.error = previousError;
  };
}

export function combineClerkE2EFailures(
  smokeFailure: Error | null,
  cleanupFailure: Error | null,
) {
  if (smokeFailure && cleanupFailure) {
    return new AggregateError(
      [smokeFailure, cleanupFailure],
      "Clerk Development smoke and cleanup both failed; both failures are retained without identity details.",
    );
  }
  return cleanupFailure ?? smokeFailure;
}

function frontendApiHostFromPublishableKey(publishableKey: string) {
  const match = publishableKey.match(/^pk_test_([A-Za-z0-9_-]+)$/);
  if (!match) failKeyPair();

  const encoded = match[1];
  let decoded: string;
  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.length === 0 || bytes.toString("base64url") !== encoded) failKeyPair();
    decoded = bytes.toString("utf8");
  } catch {
    failKeyPair();
  }

  if (!decoded.endsWith("$") || decoded.slice(0, -1).includes("$")) failKeyPair();
  const host = decoded.slice(0, -1).toLowerCase();

  try {
    const url = new URL(`https://${host}`);
    if (
      url.hostname !== host
      || url.host !== host
      || url.pathname !== "/"
      || url.search
      || url.hash
      || !host.endsWith(".clerk.accounts.dev")
    ) {
      failKeyPair();
    }
  } catch {
    failKeyPair();
  }

  return host;
}

function normalizeFrontendApiHost(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getClerkDevelopmentKeyPair(
  environment: ClerkDevelopmentEnvironment = process.env,
): ClerkDevelopmentKeyPair {
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = environment.CLERK_SECRET_KEY?.trim();
  const testingPublishableKey = environment.CLERK_PUBLISHABLE_KEY?.trim();

  if (!publishableKey || !secretKey || !/^sk_test_[A-Za-z0-9_-]{12,}$/.test(secretKey)) {
    failKeyPair();
  }
  if (testingPublishableKey && testingPublishableKey !== publishableKey) failKeyPair();

  return Object.freeze({
    frontendApiHost: frontendApiHostFromPublishableKey(publishableKey),
    publishableKey,
    secretKey,
  });
}

export function assertMatchingDevelopmentClerkInstance(
  keyPair: ClerkDevelopmentKeyPair,
  snapshot: ClerkDevelopmentInstanceSnapshot,
) {
  if (snapshot.environmentType !== "development") throw new Error(DEVELOPMENT_INSTANCE_ERROR);

  const matchingDomain = snapshot.frontendApiUrls.some(
    (value) => normalizeFrontendApiHost(value) === keyPair.frontendApiHost,
  );
  if (!matchingDomain) throw new Error(DEVELOPMENT_INSTANCE_ERROR);
}
