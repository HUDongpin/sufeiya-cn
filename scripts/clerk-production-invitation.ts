import { createClerkClient } from "@clerk/backend";
import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
} from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertCompatibleClerkProductionHumanEnvironment,
  CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL,
  readClerkProductionGitCommonDirectory,
  readClerkProductionHumanSourceSnapshot,
} from "../e2e/clerk-production/clerk-production-human-config";
import {
  assertClerkProductionInvitationCommandLine,
  buildClerkProductionInstanceBindingCommitment,
  buildClerkProductionRecipientCommitment,
  CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA,
  type ClerkProductionInvitationAttemptMarker,
  type ClerkProductionInvitationCreationReceipt,
  type ClerkProductionInvitationMode,
  type ClerkProductionInvitationOwnerInput,
  type ClerkProductionInvitationPostObservationReceipt,
  getClerkProductionInvitationOwnerInput,
  getClerkProductionInvitationOwnerPublicInput,
  runClerkProductionInvitationOwner,
} from "./clerk-production-invitation-contract";

const CLERK_BACKEND_API_URL = "https://api.clerk.com";
const CLERK_BACKEND_API_VERSION = "v1";
const CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES = 1_000_000;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const GITHUB_DEPLOYMENT_ID = 6_090_377_343;
const GITHUB_DEPLOYMENT_STATUS_ID = 17_321_852_530;
const GITHUB_DEPLOYMENTS_URL =
  "https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments?environment=Production&per_page=1";
const GITHUB_FROZEN_DEPLOYMENT_URL =
  `https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments/${GITHUB_DEPLOYMENT_ID}`;
const GITHUB_DEPLOYMENT_STATUSES_URL =
  `https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments/${GITHUB_DEPLOYMENT_ID}/statuses?per_page=1`;
const GITHUB_FROZEN_DEPLOYMENT_STATUS_URL =
  `https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments/${GITHUB_DEPLOYMENT_ID}/statuses/${GITHUB_DEPLOYMENT_STATUS_ID}`;
const VERCEL_DEPLOYMENT_URL =
  "https://sufeiya-k5kgdj3yi-peter-dongpin-hu-s-projects.vercel.app";

async function readBoundedJson(
  url: string,
  headers: Readonly<Record<string, string>>,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("Production read-only JSON preflight failed");
  }
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = response.headers.get("content-length");
  if (
    response.status !== 200
    || response.url !== url
    || !/^application\/json(?:;|$)/i.test(contentType)
    || (
      declaredLength !== null
      && (
        !/^\d+$/.test(declaredLength)
        || Number(declaredLength) > CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES
      )
    )
    || !response.body
  ) throw new Error("Production read-only JSON preflight failed");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > CLERK_PUBLIC_ENVIRONMENT_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Production read-only JSON preflight failed");
    }
    chunks.push(value);
  }
  if (totalBytes === 0) throw new Error("Production read-only JSON preflight failed");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error("Production read-only JSON preflight failed");
  }
}

async function readProductionPublicEnvironment() {
  assertCompatibleClerkProductionHumanEnvironment(await readBoundedJson(
    CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL,
    { Accept: "application/json" },
  ));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function readGithubProductionDeploymentBinding(requireLatest: boolean) {
  const [deploymentPayload, statusPayload] = await Promise.all([
    readBoundedJson(requireLatest ? GITHUB_DEPLOYMENTS_URL : GITHUB_FROZEN_DEPLOYMENT_URL, {
      Accept: "application/vnd.github+json",
      "User-Agent": "sufeiya-clerk-production-owner",
    }),
    readBoundedJson(
      requireLatest
        ? GITHUB_DEPLOYMENT_STATUSES_URL
        : GITHUB_FROZEN_DEPLOYMENT_STATUS_URL,
      {
      Accept: "application/vnd.github+json",
      "User-Agent": "sufeiya-clerk-production-owner",
      },
    ),
  ]);
  assertClerkProductionGithubDeploymentBinding(
    deploymentPayload,
    statusPayload,
    requireLatest,
  );
}

export function assertClerkProductionGithubDeploymentBinding(
  deploymentPayload: unknown,
  statusPayload: unknown,
  requireLatest = true,
) {
  const deployments = requireLatest
    ? Array.isArray(deploymentPayload) ? deploymentPayload : []
    : [deploymentPayload];
  const statuses = requireLatest
    ? Array.isArray(statusPayload) ? statusPayload : []
    : [statusPayload];
  const deployment = record(deployments[0]);
  const status = record(statuses[0]);
  if (
    deployments.length !== 1
    || statuses.length !== 1
    || deployment?.id !== GITHUB_DEPLOYMENT_ID
    || deployment.sha !== CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA
    || deployment.environment !== "Production"
    || deployment.statuses_url
      !== `https://api.github.com/repos/HUDongpin/sufeiya-cn/deployments/${GITHUB_DEPLOYMENT_ID}/statuses`
    || status?.id !== GITHUB_DEPLOYMENT_STATUS_ID
    || status.state !== "success"
    || status.environment !== "Production"
    || status.environment_url !== VERCEL_DEPLOYMENT_URL
    || status.target_url !== VERCEL_DEPLOYMENT_URL
  ) throw new Error("Production deployment binding preflight failed");
}

async function isMissing(path: string) {
  try {
    await lstat(path);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

async function syncDirectory(path: string) {
  const directoryHandle = await open(path, "r");
  let syncFailure: unknown;
  try {
    await directoryHandle.sync();
  } catch (error) {
    syncFailure = error;
  }
  try {
    await directoryHandle.close();
  } catch (error) {
    syncFailure ??= error;
  }
  if (syncFailure) throw syncFailure;
}

async function ensurePrivateDirectory(path: string, trustedParent: string) {
  const canonicalParent = await realpath(trustedParent);
  const canonicalRequestedParent = await realpath(dirname(path));
  const requestedName = basename(path);
  if (
    canonicalRequestedParent !== canonicalParent
    || requestedName === ""
    || requestedName === "."
    || requestedName === ".."
  ) throw new Error("Unsafe local receipt directory");
  if (await isMissing(path)) {
    await mkdir(path, { mode: 0o700 });
    await syncDirectory(canonicalParent);
  }
  const directoryStat = await lstat(path);
  const canonicalDirectory = await realpath(path);
  const relativeDirectory = relative(canonicalParent, canonicalDirectory);
  if (
    !directoryStat.isDirectory()
    || directoryStat.isSymbolicLink()
    || relativeDirectory === ".."
    || relativeDirectory.startsWith(`..${sep}`)
    || (directoryStat.mode & 0o077) !== 0
  ) throw new Error("Unsafe local receipt directory");
}

export async function writeClerkProductionJsonNoClobber(
  path: string,
  value: unknown,
) {
  const temporaryPath = resolve(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporaryPath, "wx", 0o600);
  let writeFailure: unknown;
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    writeFailure = error;
  }
  try {
    await handle.close();
  } catch (error) {
    writeFailure ??= error;
  }
  if (writeFailure) {
    await unlink(temporaryPath).catch(() => undefined);
    throw writeFailure;
  }
  try {
    await link(temporaryPath, path);
    await syncDirectory(dirname(path));
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  try {
    await unlink(temporaryPath);
    await syncDirectory(dirname(path));
  } catch {
    // The canonical hard link is already durable; a private temp hard link is harmless.
  }
}

export async function persistClerkProductionInvitationAttempt(
  marker: ClerkProductionInvitationAttemptMarker,
  stateRoot: string,
  gitCommonDirectory: string,
) {
  await ensurePrivateDirectory(stateRoot, gitCommonDirectory);
  const attemptDirectory = resolve(stateRoot, "attempts");
  await ensurePrivateDirectory(attemptDirectory, stateRoot);
  await writeClerkProductionJsonNoClobber(
    resolve(attemptDirectory, "production-one-shot.seal"),
    marker,
  );
}

async function persistCreationReceipt(
  receipt: ClerkProductionInvitationCreationReceipt,
  stateRoot: string,
) {
  const receiptDirectory = resolve(stateRoot, "receipts");
  await ensurePrivateDirectory(receiptDirectory, stateRoot);
  await writeClerkProductionJsonNoClobber(
    resolve(receiptDirectory, `${receipt.authorizationRunId}.creation.json`),
    receipt,
  );
}

async function persistPostObservation(
  receipt: ClerkProductionInvitationPostObservationReceipt,
  stateRoot: string,
) {
  const receiptDirectory = resolve(stateRoot, "receipts");
  await ensurePrivateDirectory(receiptDirectory, stateRoot);
  await writeClerkProductionJsonNoClobber(
    resolve(receiptDirectory, `${receipt.authorizationRunId}.post-observation.json`),
    receipt,
  );
}

async function readAttemptMarker(path: string) {
  const markerStat = await lstat(path);
  if (
    !markerStat.isFile()
    || markerStat.isSymbolicLink()
    || (markerStat.mode & 0o077) !== 0
    || markerStat.size < 2
    || markerStat.size > 16_384
  ) throw new Error("Production invitation status marker mismatch");
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Production invitation status marker mismatch");
  }
  return parsed as Record<string, unknown>;
}

export async function assertClerkProductionInvitationLocalState(
  mode: ClerkProductionInvitationMode,
  stateRoot: string,
) {
  const sealPath = resolve(stateRoot, "attempts", "production-one-shot.seal");
  const sealMissing = await isMissing(sealPath);
  if (mode === "status") {
    if (sealMissing) throw new Error("Production invitation status marker mismatch");
    return;
  }
  if (!sealMissing) {
    throw new Error("Production invitation one-shot controller is already sealed");
  }
}

export async function assertClerkProductionInvitationStatusAttempt(
  input: ClerkProductionInvitationOwnerInput,
  stateRoot: string,
) {
  if (!input.authorizationRunId) {
    throw new Error("Production invitation status marker mismatch");
  }
  const attemptDirectory = resolve(stateRoot, "attempts");
  const seal = await readAttemptMarker(
    resolve(attemptDirectory, "production-one-shot.seal"),
  );
  const expected = {
    authorizationRunId: input.authorizationRunId,
    contractExpiresInDays: 7,
    declaredVercelDeploymentGitSha: input.declaredVercelDeploymentGitSha,
    declaredVercelDeploymentId: input.declaredVercelDeploymentId,
    helperSourceGitSha: input.helperSourceGitSha,
    instanceCommitment: input.productionInstanceBindingCommitment,
    protocolVersion: "sufeiya_clerk_production_invitation_attempt_v1",
    recipientCommitment: buildClerkProductionRecipientCommitment(input),
  };
  const keys = Object.keys(seal).sort();
  const expectedKeys = [
    ...Object.keys(expected),
    "providerBaselineCommitment",
    "startedAt",
  ].sort();
  const startedAt = seal.startedAt;
  const providerBaselineCommitment = seal.providerBaselineCommitment;
  if (
    keys.length !== expectedKeys.length
    || !keys.every((key, index) => key === expectedKeys[index])
    || Object.entries(expected).some(([key, value]) => seal[key] !== value)
    || typeof providerBaselineCommitment !== "string"
    || !/^[0-9a-f]{64}$/.test(providerBaselineCommitment)
    || typeof startedAt !== "string"
    || new Date(startedAt).toISOString() !== startedAt
  ) throw new Error("Production invitation status marker mismatch");
}

async function readHiddenAsciiLine(prompt: string, maximumLength: number) {
  if (
    process.stdin.isTTY !== true
    || process.stderr.isTTY !== true
    || typeof process.stdin.setRawMode !== "function"
  ) throw new Error("Production invitation sensitive input requires a local TTY");
  process.stderr.write(prompt);
  const wasRaw = process.stdin.isRaw === true;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolveInput, rejectInput) => {
    let value = "";
    let settled = false;
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.off("error", onError);
      process.stdin.off("end", onEnd);
      process.stdin.off("close", onEnd);
      process.off("SIGHUP", onSignal);
      process.off("SIGTERM", onSignal);
      try {
        process.stdin.setRawMode(wasRaw);
      } catch {
        // The fixed redacted outer failure handles a terminal that vanished.
      }
      process.stdin.pause();
      process.stderr.write("\n");
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectInput(new Error("Production invitation sensitive input refused"));
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolveInput(value);
    };
    const onError = () => fail();
    const onEnd = () => fail();
    const onSignal = () => fail();
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3 || byte === 4) {
          fail();
          return;
        }
        if (byte === 10 || byte === 13) {
          finish();
          return;
        }
        if (byte === 8 || byte === 127) {
          value = value.slice(0, -1);
          continue;
        }
        if (byte >= 0x20 && byte <= 0x7e) {
          if (value.length >= maximumLength) {
            fail();
            return;
          }
          value += String.fromCharCode(byte);
        }
      }
    };
    process.stdin.on("data", onData);
    process.stdin.on("error", onError);
    process.stdin.on("end", onEnd);
    process.stdin.on("close", onEnd);
    process.once("SIGHUP", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

let activeMode: ClerkProductionInvitationMode | null = null;

async function main() {
  const mode = assertClerkProductionInvitationCommandLine();
  activeMode = mode;
  const source = readClerkProductionHumanSourceSnapshot(repositoryRoot);
  const publicInput = getClerkProductionInvitationOwnerPublicInput(
    source,
    mode,
    process.stdin.isTTY === true
      && process.stdout.isTTY === true
      && process.stderr.isTTY === true,
  );
  const gitCommonDirectory = readClerkProductionGitCommonDirectory(repositoryRoot);
  const stateRoot = resolve(
    gitCommonDirectory,
    "codex-clerk-production-invitation-owner",
  );
  await assertClerkProductionInvitationLocalState(mode, stateRoot);
  await readGithubProductionDeploymentBinding(mode !== "status");
  await readProductionPublicEnvironment();
  const secretKey = await readHiddenAsciiLine(
    "Production Clerk Secret Key (hidden): ",
    512,
  );
  const recipientEmail = await readHiddenAsciiLine(
    "Owner-approved recipient email (hidden): ",
    254,
  );
  const recipientConfirmation = await readHiddenAsciiLine(
    "Confirm Owner-approved recipient email (hidden): ",
    254,
  );
  if (recipientEmail !== recipientConfirmation) {
    throw new Error("Production invitation recipient confirmation mismatch");
  }
  const input = getClerkProductionInvitationOwnerInput(
    publicInput,
    { recipientEmail, secretKey },
  );
  const client = createClerkClient({
    apiUrl: CLERK_BACKEND_API_URL,
    apiVersion: CLERK_BACKEND_API_VERSION,
    secretKey: input.secretKey,
    telemetry: { disabled: true },
  });
  const result = await runClerkProductionInvitationOwner(input, {
    assertStatusAttempt: () => assertClerkProductionInvitationStatusAttempt(
      input,
      stateRoot,
    ),
    createInvitation: (request) => client.invitations.createInvitation(request),
    now: () => new Date(),
    persistAttempt: (marker) => persistClerkProductionInvitationAttempt(
      marker,
      stateRoot,
      gitCommonDirectory,
    ),
    persistCreationReceipt: (receipt) => persistCreationReceipt(receipt, stateRoot),
    persistPostObservation: (receipt) => persistPostObservation(receipt, stateRoot),
    readDeploymentBinding: () => readGithubProductionDeploymentBinding(mode !== "status"),
    readDomains: () => client.domains.list(),
    readInstance: async () => {
      const instance = await client.instance.get();
      return {
        environmentType: instance.environmentType,
        instanceBindingCommitment:
          buildClerkProductionInstanceBindingCommitment(instance.id),
      };
    },
    readInvitations: (params) => client.invitations.getInvitationList(params),
    readGlobalInvitationCount: async (status) => {
      const page = await client.invitations.getInvitationList({ limit: 1, status });
      return page.totalCount;
    },
    readGlobalUserCount: () => client.users.getCount(),
    readPublicEnvironment: readProductionPublicEnvironment,
    readUsers: (params) => client.users.getUserList(params),
  });

  if (result.mode === "preflight") {
    process.stdout.write(
      `[Clerk Production invitation] PASS_PREFLIGHT_NO_WRITES; helper_source_git_sha=${result.helperSourceGitSha}; provider_baseline_commitment=${result.providerBaselineCommitment}; recipient_commitment=${result.recipientCommitment}\n`,
    );
    return;
  }
  if (result.mode === "status") {
    process.stdout.write(
      `[Clerk Production invitation] OBSERVED_STATUS_READ_ONLY; creation_outcome_remains_unknown=true; state=${result.status}; exact_users=${result.exactUserCount}; exact_invitations=${result.exactInvitationCount}; provider_state_commitment=${result.providerStateCommitment}\n`,
    );
    return;
  }
  process.stdout.write(
    `[Clerk Production invitation] PASS_CREATE_RESPONSE_ACKNOWLEDGED_EMAIL_DELIVERY_REQUESTED; outcome=${result.outcome}; post_state=${result.status}; provider_delivery_and_human_acceptance_still_unproven\n`,
  );
}

const directEntryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;
if (directEntryUrl === import.meta.url) {
  void main().catch(() => {
    const message = activeMode === "preflight"
      ? "[Clerk Production invitation] FAIL_PREFLIGHT_NO_WRITES; correct the read-only boundary before retrying the same preflight.\n"
      : activeMode === "status"
        ? "[Clerk Production invitation] FAIL_STATUS_READ_ONLY; creation_outcome_remains_unknown=true; no write was attempted by status.\n"
        : "[Clerk Production invitation] FAIL_REDACTED_NO_RETRY; inspect provider state with the read-only status command before any further action.\n";
    process.stderr.write(message);
    process.exitCode = 1;
  });
}
