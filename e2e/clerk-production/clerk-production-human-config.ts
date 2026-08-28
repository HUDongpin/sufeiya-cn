import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

export const CLERK_PRODUCTION_CANONICAL_ORIGIN = "https://sufeiya.cn";
export const CLERK_PRODUCTION_FRONTEND_API_HOST = "clerk.sufeiya.cn";
export const CLERK_PRODUCTION_PUBLIC_ENVIRONMENT_URL =
  `https://${CLERK_PRODUCTION_FRONTEND_API_HOST}/v1/environment`;

export const CLERK_PRODUCTION_HUMAN_ACCEPTANCE_ACK =
  "I_HAVE_OWNER_AND_RECIPIENT_AUTHORIZATION_TO_ACCEPT_ONE_EXISTING_PRODUCTION_INVITATION_AND_RELOGIN_TO_THE_SAME_ACCOUNT_IN_A_TEMPORARY_BROWSER";

export const CLERK_PRODUCTION_HUMAN_RECEIPT_PROTOCOL =
  "sufeiya_clerk_production_human_journey_v1";

export const CLERK_PRODUCTION_ACCOUNT_COMMITMENT_PROTOCOL =
  "sufeiya_clerk_production_account_commitment_v1";

export const CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS = [
  "public_clerk_environment_preflight_pass",
  "clerk_invitation_entry_observed",
  "signed_in_session_after_invitation",
  "approved_workspace_pass",
  "workspace_canary_nonempty",
  "account_widget_pass",
  "first_sign_out_boundary_pass",
  "signed_in_session_after_relogin",
  "same_account_browser_internal_pass",
  "local_namespace_digest_continuity_pass",
  "final_sign_out_boundary_pass",
] as const;

type ClerkProductionHumanEnvironment = {
  [key: string]: string | undefined;
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID?: string;
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID?: string;
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA?: string;
  SUFEIYA_CLERK_PRODUCTION_HUMAN_ACK?: string;
};

export type ClerkProductionHumanSourceSnapshot = Readonly<{
  clean: boolean;
  gitSha: string;
}>;

export type ClerkProductionHumanAcceptanceInput = Readonly<{
  authorizationRunId: string;
  canonicalOrigin: typeof CLERK_PRODUCTION_CANONICAL_ORIGIN;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  harnessSourceGitSha: string;
}>;

type ClerkProductionHumanReceiptChecks = {
  [Key in typeof CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS[number]]: boolean;
};

export type ClerkProductionHumanReceipt = Readonly<{
  accountCommitment: string;
  authorizationRunId: string;
  browser: Readonly<{
    name: "chromium";
    version: string;
  }>;
  canonicalOrigin: typeof CLERK_PRODUCTION_CANONICAL_ORIGIN;
  checks: Readonly<ClerkProductionHumanReceiptChecks>;
  completedAt: string;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  harnessSourceGitSha: string;
  protocolVersion: typeof CLERK_PRODUCTION_HUMAN_RECEIPT_PROTOCOL;
  startedAt: string;
}>;

const PRODUCTION_HUMAN_INPUT_ERROR =
  "Production human Clerk acceptance requires the exact authorization, clean harness source, owner-issued run ID, and declared Vercel deployment ID plus Git SHA.";

const PRODUCTION_HUMAN_AMBIENT_STATE_ERROR =
  "Production human Clerk acceptance refuses local Clerk keys, testing/debug state, storage state, and deployment bypass state.";

const PRODUCTION_HUMAN_COMMAND_LINE_ERROR =
  "Production human Clerk acceptance must run through the exact package script without additional Playwright arguments.";

const PRODUCTION_HUMAN_PUBLIC_ENVIRONMENT_ERROR =
  "Production human Clerk acceptance refused incompatible public Clerk environment settings before invitation handoff.";

function clerkEnvironmentRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clerkStringArray(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

export function assertCompatibleClerkProductionHumanEnvironment(snapshot: unknown) {
  const environment = clerkEnvironmentRecord(snapshot);
  const authConfig = clerkEnvironmentRecord(environment?.auth_config);
  const displayConfig = clerkEnvironmentRecord(environment?.display_config);
  const userSettings = clerkEnvironmentRecord(environment?.user_settings);
  const signUpSettings = clerkEnvironmentRecord(userSettings?.sign_up);
  const mfaSettings = clerkEnvironmentRecord(signUpSettings?.mfa);
  const attributes = clerkEnvironmentRecord(userSettings?.attributes);
  const emailAttribute = clerkEnvironmentRecord(attributes?.email_address);
  const passwordAttribute = clerkEnvironmentRecord(attributes?.password);
  const usernameAttribute = clerkEnvironmentRecord(attributes?.username);
  const phoneAttribute = clerkEnvironmentRecord(attributes?.phone_number);
  const firstNameAttribute = clerkEnvironmentRecord(attributes?.first_name);
  const lastNameAttribute = clerkEnvironmentRecord(attributes?.last_name);
  const passwordSettings = clerkEnvironmentRecord(userSettings?.password_settings);
  const restrictions = clerkEnvironmentRecord(userSettings?.restrictions);
  const allowlist = clerkEnvironmentRecord(restrictions?.allowlist);
  const blocklist = clerkEnvironmentRecord(restrictions?.blocklist);
  const blockSubaddresses = clerkEnvironmentRecord(
    restrictions?.block_email_subaddresses,
  );
  const firstFactors = clerkStringArray(authConfig?.first_factors);
  const secondFactors = clerkStringArray(authConfig?.second_factors);
  const emailVerificationStrategies = clerkStringArray(
    authConfig?.email_address_verification_strategies,
  );
  const emailVerifications = clerkStringArray(emailAttribute?.verifications);
  const minimumPasswordLength = passwordSettings?.min_length;
  const maximumPasswordLength = passwordSettings?.max_length;

  if (
    displayConfig?.instance_environment_type !== "production"
    || displayConfig.clerk_js_version !== "6"
    || authConfig?.test_mode !== false
    || authConfig.email_address !== "on"
    || authConfig.password !== "required"
    || authConfig.username !== "off"
    || authConfig.phone_number !== "off"
    || authConfig.first_name !== "off"
    || authConfig.last_name !== "off"
    || firstFactors === null
    || !firstFactors.includes("ticket")
    || !firstFactors.includes("password")
    || secondFactors === null
    || secondFactors.length !== 0
    || emailVerificationStrategies === null
    || emailVerificationStrategies.length !== 1
    || emailVerificationStrategies[0] !== "email_code"
    || signUpSettings?.mode !== "public"
    || signUpSettings.progressive !== true
    || signUpSettings.custom_action_required !== false
    || signUpSettings.legal_consent_enabled !== false
    || mfaSettings?.required !== false
    || emailAttribute?.enabled !== true
    || emailAttribute.required !== true
    || emailAttribute.verify_at_sign_up !== true
    || emailVerifications === null
    || emailVerifications.length !== 1
    || emailVerifications[0] !== "email_code"
    || passwordAttribute?.enabled !== true
    || passwordAttribute.required !== true
    || usernameAttribute?.enabled !== false
    || usernameAttribute.required !== false
    || phoneAttribute?.enabled !== false
    || phoneAttribute.required !== false
    || firstNameAttribute?.enabled !== false
    || firstNameAttribute.required !== false
    || lastNameAttribute?.enabled !== false
    || lastNameAttribute.required !== false
    || allowlist?.enabled !== false
    || blocklist?.enabled !== false
    || blockSubaddresses?.enabled !== false
    || typeof minimumPasswordLength !== "number"
    || !Number.isSafeInteger(minimumPasswordLength)
    || minimumPasswordLength < 1
    || typeof maximumPasswordLength !== "number"
    || !Number.isSafeInteger(maximumPasswordLength)
    || maximumPasswordLength < 0
    || (maximumPasswordLength !== 0 && maximumPasswordLength < minimumPasswordLength)
    || typeof passwordSettings?.allowed_special_characters !== "string"
  ) {
    throw new Error(PRODUCTION_HUMAN_PUBLIC_ENVIRONMENT_ERROR);
  }
}

function hasForbiddenAmbientState(environment: ClerkProductionHumanEnvironment) {
  return Object.entries(environment).some(([key, value]) => {
    if (value === undefined || value === "") return false;
    const changesGitResolution = [
      "GIT_ALTERNATE_OBJECT_DIRECTORIES",
      "GIT_COMMON_DIR",
      "GIT_CONFIG",
      "GIT_CONFIG_GLOBAL",
      "GIT_CONFIG_NOSYSTEM",
      "GIT_CONFIG_SYSTEM",
      "GIT_DIR",
      "GIT_INDEX_FILE",
      "GIT_OBJECT_DIRECTORY",
      "GIT_WORK_TREE",
    ].includes(key)
      || key.startsWith("GIT_CONFIG_KEY_")
      || key.startsWith("GIT_CONFIG_VALUE_");
    const changesPlaywrightRuntime = (
      key.startsWith("PLAYWRIGHT_") && key !== "PLAYWRIGHT_NO_COPY_PROMPT"
    )
      || key.startsWith("PWTEST_")
      || key.startsWith("PW_TEST_");
    return key.startsWith("CLERK_")
      || key.startsWith("NEXT_PUBLIC_CLERK_")
      || key.startsWith("SUFEIYA_CLERK_E2E_")
      || key === "SUFEIYA_CLERK_INVITATION_E2E_ACK"
      || key === "SUFEIYA_VERCEL_PROTECTION_BYPASS"
      || key === "VERCEL_AUTOMATION_BYPASS_SECRET"
      || key === "PWDEBUG"
      || key === "PWDEBUGIMPL"
      || key === "PWPAUSE"
      || key === "DEBUG"
      || key === "DEBUG_FILE"
      || key === "SSLKEYLOGFILE"
      || changesGitResolution
      || changesPlaywrightRuntime
      || key === "PW_CHROMIUM_ATTACH_TO_OTHER"
      || key.startsWith("SELENIUM_REMOTE_");
  });
}

export function assertClerkProductionHumanCommandLine(
  argv: readonly string[] = process.argv,
) {
  const expectedArguments = [
    "test",
    "--config=playwright.clerk-production-human.config.ts",
  ];
  const actualArguments = argv.slice(2);
  if (
    actualArguments.length !== expectedArguments.length
    || !actualArguments.every((argument, index) => argument === expectedArguments[index])
  ) {
    throw new Error(PRODUCTION_HUMAN_COMMAND_LINE_ERROR);
  }
}

export function readClerkProductionHumanSourceSnapshot(
  repositoryRoot: string,
): ClerkProductionHumanSourceSnapshot {
  try {
    const gitEnvironment = { ...process.env } as NodeJS.ProcessEnv;
    for (const key of Object.keys(gitEnvironment)) {
      if (key.startsWith("GIT_")) delete gitEnvironment[key];
    }
    const canonicalRepositoryRoot = realpathSync(repositoryRoot);
    const topLevel = execFileSync("/usr/bin/git", ["rev-parse", "--show-toplevel"], {
      cwd: canonicalRepositoryRoot,
      encoding: "utf8",
      env: gitEnvironment,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (realpathSync(topLevel) !== canonicalRepositoryRoot) {
      throw new Error("repository root mismatch");
    }
    const gitSha = execFileSync("/usr/bin/git", ["rev-parse", "--verify", "HEAD"], {
      cwd: canonicalRepositoryRoot,
      encoding: "utf8",
      env: gitEnvironment,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const status = execFileSync(
      "/usr/bin/git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      {
        cwd: canonicalRepositoryRoot,
        encoding: "utf8",
        env: gitEnvironment,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return { clean: status === "", gitSha };
  } catch {
    throw new Error(PRODUCTION_HUMAN_INPUT_ERROR);
  }
}

export function getClerkProductionHumanAcceptanceInput(
  source: ClerkProductionHumanSourceSnapshot,
  environment: ClerkProductionHumanEnvironment = process.env,
): ClerkProductionHumanAcceptanceInput {
  if (hasForbiddenAmbientState(environment)) {
    throw new Error(PRODUCTION_HUMAN_AMBIENT_STATE_ERROR);
  }

  const deploymentGitSha = environment.SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA;
  const vercelDeploymentId = environment.SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID;
  const authorizationRunId = environment.SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID;
  if (
    environment.SUFEIYA_CLERK_PRODUCTION_HUMAN_ACK
      !== CLERK_PRODUCTION_HUMAN_ACCEPTANCE_ACK
    || !source.clean
    || !/^[0-9a-f]{40}$/.test(source.gitSha)
    || !deploymentGitSha
    || !/^[0-9a-f]{40}$/.test(deploymentGitSha)
    || !authorizationRunId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      authorizationRunId,
    )
    || !vercelDeploymentId
    || !/^dpl_[A-Za-z0-9]{20,64}$/.test(vercelDeploymentId)
  ) {
    throw new Error(PRODUCTION_HUMAN_INPUT_ERROR);
  }

  return Object.freeze({
    authorizationRunId,
    canonicalOrigin: CLERK_PRODUCTION_CANONICAL_ORIGIN,
    declaredVercelDeploymentGitSha: deploymentGitSha,
    declaredVercelDeploymentId: vercelDeploymentId,
    harnessSourceGitSha: source.gitSha,
  });
}

function isExactIsoTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

export function buildClerkProductionHumanReceipt(input: Readonly<{
  accountCommitment: string;
  browserVersion: string;
  checks: Readonly<ClerkProductionHumanReceiptChecks>;
  completedAt: string;
  source: ClerkProductionHumanAcceptanceInput;
  startedAt: string;
}>): ClerkProductionHumanReceipt {
  const checkKeys = Object.keys(input.checks).sort();
  const expectedCheckKeys = [...CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS].sort();
  if (
    checkKeys.length !== expectedCheckKeys.length
    || !checkKeys.every((key, index) => key === expectedCheckKeys[index])
    || !Object.values(input.checks).every((value) => value === true)
    || !isExactIsoTimestamp(input.startedAt)
    || !isExactIsoTimestamp(input.completedAt)
    || new Date(input.completedAt) < new Date(input.startedAt)
    || !/^[0-9a-f]{64}$/.test(input.accountCommitment)
    || !/^[0-9]+(?:\.[0-9]+){1,4}$/.test(input.browserVersion)
  ) {
    throw new Error("Production human Clerk acceptance refused an unsafe receipt.");
  }

  return {
    accountCommitment: input.accountCommitment,
    browser: { name: "chromium", version: input.browserVersion },
    authorizationRunId: input.source.authorizationRunId,
    canonicalOrigin: input.source.canonicalOrigin,
    checks: { ...input.checks },
    completedAt: input.completedAt,
    declaredVercelDeploymentGitSha:
      input.source.declaredVercelDeploymentGitSha,
    protocolVersion: CLERK_PRODUCTION_HUMAN_RECEIPT_PROTOCOL,
    declaredVercelDeploymentId: input.source.declaredVercelDeploymentId,
    harnessSourceGitSha: input.source.harnessSourceGitSha,
    startedAt: input.startedAt,
  };
}
