import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertCompatibleClerkProductionHumanEnvironment,
  assertClerkProductionHumanCommandLine,
  buildClerkProductionHumanReceipt,
  CLERK_PRODUCTION_CANONICAL_ORIGIN,
  CLERK_PRODUCTION_HUMAN_ACCEPTANCE_ACK,
  CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS,
  CLERK_PRODUCTION_HUMAN_RECEIPT_PROTOCOL,
  getClerkProductionHumanAcceptanceInput,
} from "../e2e/clerk-production/clerk-production-human-config";

const sourceGitSha = "a".repeat(40);
const vercelDeploymentId = `dpl_${"B".repeat(28)}`;
const validSource = { clean: true, gitSha: sourceGitSha } as const;
const validEnvironment = {
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: "123e4567-e89b-42d3-a456-426614174000",
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: vercelDeploymentId,
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: "b".repeat(40),
  SUFEIYA_CLERK_PRODUCTION_HUMAN_ACK:
    CLERK_PRODUCTION_HUMAN_ACCEPTANCE_ACK,
} as const;

const validChecks = Object.fromEntries(
  CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS.map((key) => [key, true]),
) as Record<typeof CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS[number], boolean>;

const compatibleProductionEnvironment = {
  auth_config: {
    email_address: "on",
    email_address_verification_strategies: ["email_code"],
    first_factors: ["email_code", "password", "reset_password_email_code", "ticket"],
    first_name: "off",
    last_name: "off",
    password: "required",
    phone_number: "off",
    second_factors: [],
    test_mode: false,
    username: "off",
  },
  display_config: {
    clerk_js_version: "6",
    instance_environment_type: "production",
  },
  user_settings: {
    attributes: {
      email_address: {
        enabled: true,
        required: true,
        verifications: ["email_code"],
        verify_at_sign_up: true,
      },
      first_name: { enabled: false, required: false },
      last_name: { enabled: false, required: false },
      password: { enabled: true, required: true },
      phone_number: { enabled: false, required: false },
      username: { enabled: false, required: false },
    },
    password_settings: {
      allowed_special_characters: "!@#$%^&*",
      max_length: 0,
      min_length: 15,
    },
    restrictions: {
      allowlist: { enabled: false },
      block_email_subaddresses: { enabled: false },
      blocklist: { enabled: false },
    },
    sign_up: {
      custom_action_required: false,
      legal_consent_enabled: false,
      mfa: { required: false },
      mode: "public",
      progressive: true,
    },
  },
} as const;

describe("Clerk Production public invitation environment", () => {
  test("accepts the exact live ticket and password registration contract", () => {
    assert.doesNotThrow(() => assertCompatibleClerkProductionHumanEnvironment(
      compatibleProductionEnvironment,
    ));
  });

  test("fails closed before handoff for non-live or incompatible registration settings", () => {
    const candidates = [
      {
        ...compatibleProductionEnvironment,
        display_config: {
          ...compatibleProductionEnvironment.display_config,
          instance_environment_type: "development",
        },
      },
      {
        ...compatibleProductionEnvironment,
        auth_config: {
          ...compatibleProductionEnvironment.auth_config,
          first_factors: ["email_code", "password"],
        },
      },
      {
        ...compatibleProductionEnvironment,
        user_settings: {
          ...compatibleProductionEnvironment.user_settings,
          sign_up: {
            ...compatibleProductionEnvironment.user_settings.sign_up,
            legal_consent_enabled: true,
          },
        },
      },
      {
        ...compatibleProductionEnvironment,
        user_settings: {
          ...compatibleProductionEnvironment.user_settings,
          attributes: {
            ...compatibleProductionEnvironment.user_settings.attributes,
            username: { enabled: true, required: true },
          },
        },
      },
      {
        ...compatibleProductionEnvironment,
        user_settings: {
          ...compatibleProductionEnvironment.user_settings,
          restrictions: {
            ...compatibleProductionEnvironment.user_settings.restrictions,
            allowlist: { enabled: true },
          },
        },
      },
      {
        ...compatibleProductionEnvironment,
        user_settings: {
          ...compatibleProductionEnvironment.user_settings,
          password_settings: {
            ...compatibleProductionEnvironment.user_settings.password_settings,
            min_length: 0,
          },
        },
      },
      {
        ...compatibleProductionEnvironment,
        user_settings: {
          ...compatibleProductionEnvironment.user_settings,
          password_settings: {
            ...compatibleProductionEnvironment.user_settings.password_settings,
            max_length: 14,
          },
        },
      },
      null,
    ];
    for (const candidate of candidates) {
      assert.throws(
        () => assertCompatibleClerkProductionHumanEnvironment(candidate),
        /refused incompatible public Clerk environment settings before invitation handoff/,
      );
    }
  });
});

describe("Clerk Production human acceptance input", () => {
  test("accepts only the exact authorization, clean harness source, run ID, and declared deployment", () => {
    assert.deepEqual(
      getClerkProductionHumanAcceptanceInput(validSource, validEnvironment),
      {
        authorizationRunId: "123e4567-e89b-42d3-a456-426614174000",
        canonicalOrigin: CLERK_PRODUCTION_CANONICAL_ORIGIN,
        declaredVercelDeploymentGitSha: "b".repeat(40),
        declaredVercelDeploymentId: vercelDeploymentId,
        harnessSourceGitSha: sourceGitSha,
      },
    );
  });

  test("fails closed on missing authorization, a dirty source, or malformed deployment metadata", () => {
    for (const [source, environment] of [
      [validSource, { ...validEnvironment, SUFEIYA_CLERK_PRODUCTION_HUMAN_ACK: "wrong" }],
      [{ ...validSource, clean: false }, validEnvironment],
      [validSource, { ...validEnvironment, SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA: "not-a-sha" }],
      [validSource, { ...validEnvironment, SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: "not-a-uuid" }],
      [validSource, { ...validEnvironment, SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID: "123E4567-E89B-42D3-A456-426614174000" }],
      [validSource, { ...validEnvironment, SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID: "production" }],
    ] as const) {
      assert.throws(
        () => getClerkProductionHumanAcceptanceInput(source, environment),
        /exact authorization, clean harness source, owner-issued run ID, and declared Vercel deployment ID plus Git SHA/,
      );
    }
  });

  test("refuses every local Clerk, testing, storage-state, or bypass input", () => {
    for (const forbiddenKey of [
      "CLERK_SECRET_KEY",
      "CLERK_PUBLISHABLE_KEY",
      "CLERK_TESTING_TOKEN",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "SUFEIYA_CLERK_E2E_SUITE",
      "SUFEIYA_CLERK_INVITATION_E2E_ACK",
      "SUFEIYA_VERCEL_PROTECTION_BYPASS",
      "VERCEL_AUTOMATION_BYPASS_SECRET",
      "PLAYWRIGHT_STORAGE_STATE",
      "PWDEBUG",
      "PWDEBUGIMPL",
      "PWPAUSE",
      "DEBUG",
      "DEBUG_FILE",
      "SSLKEYLOGFILE",
      "GIT_INDEX_FILE",
      "PLAYWRIGHT_DASHBOARD",
      "PLAYWRIGHT_BROWSERS_PATH",
      "PLAYWRIGHT_CLI_SESSION",
      "PLAYWRIGHT_LAST_RUN_OUTPUT_FILE",
      "PLAYWRIGHT_HTML_OUTPUT_DIR",
      "PLAYWRIGHT_JUNIT_OUTPUT_NAME",
      "PLAYWRIGHT_JSON_OUTPUT_NAME",
      "PLAYWRIGHT_BLOB_OUTPUT_DIR",
      "PLAYWRIGHT_MCP_BROWSER",
      "PW_CHROMIUM_ATTACH_TO_OTHER",
      "PWTEST_PROFILE_DIR",
      "PWTEST_EXTENSION_USER_DATA_DIR",
      "PW_TEST_CONNECT_WS_ENDPOINT",
      "PW_TEST_CONNECT_HEADERS",
      "PW_TEST_CONNECT_EXPOSE_NETWORK",
      "PW_TEST_REUSE_CONTEXT",
      "PW_TEST_REPORTER",
      "SELENIUM_REMOTE_URL",
      "SELENIUM_REMOTE_HEADERS",
      "SELENIUM_REMOTE_CAPABILITIES",
    ]) {
      assert.throws(
        () => getClerkProductionHumanAcceptanceInput(validSource, {
          ...validEnvironment,
          [forbiddenKey]: "present",
        }),
        /refuses local Clerk keys, testing\/debug state, storage state, and deployment bypass state/,
      );
    }
  });

  test("accepts only the package script's exact Playwright command line", () => {
    for (const argv of [
      ["node", "playwright", "--debug"],
      ["node", "playwright", "test", "--debug=inspector"],
      ["node", "playwright", "--ui"],
      ["node", "playwright", "--ui=host"],
      ["node", "playwright", "test", "--ui-host", "127.0.0.1"],
      ["node", "playwright", "test", "--ui-port=9323"],
      ["node", "playwright", "--trace", "on"],
      ["node", "playwright", "--trace=retain-on-failure"],
      ["node", "playwright", "test", "--output", "."],
      ["node", "playwright", "test", "--reporter=html"],
      ["node", "playwright", "test", "--config=playwright.clerk-production-human.config.ts", "--list"],
    ]) {
      assert.throws(
        () => assertClerkProductionHumanCommandLine(argv),
        /exact package script without additional Playwright arguments/,
      );
    }
    assert.doesNotThrow(() => assertClerkProductionHumanCommandLine([
      "node",
      "playwright",
      "test",
      "--config=playwright.clerk-production-human.config.ts",
    ]));
  });
});

describe("Clerk Production human acceptance receipt", () => {
  const source = getClerkProductionHumanAcceptanceInput(
    validSource,
    validEnvironment,
  );

  test("emits only the fixed non-sensitive schema after every check passes", () => {
    const receipt = buildClerkProductionHumanReceipt({
      accountCommitment: "c".repeat(64),
      browserVersion: "140.0.7339.16",
      checks: validChecks,
      completedAt: "2026-08-28T03:00:01.000Z",
      source,
      startedAt: "2026-08-28T03:00:00.000Z",
    });
    assert.deepEqual(Object.keys(receipt).sort(), [
      "accountCommitment",
      "authorizationRunId",
      "browser",
      "canonicalOrigin",
      "checks",
      "completedAt",
      "declaredVercelDeploymentGitSha",
      "declaredVercelDeploymentId",
      "harnessSourceGitSha",
      "protocolVersion",
      "startedAt",
    ]);
    assert.equal(receipt.protocolVersion, CLERK_PRODUCTION_HUMAN_RECEIPT_PROTOCOL);
    assert.deepEqual(Object.keys(receipt.checks).sort(), [
      ...CLERK_PRODUCTION_HUMAN_RECEIPT_CHECKS,
    ].sort());
    assert.equal(JSON.stringify(receipt).includes("ticket"), false);
    assert.equal(JSON.stringify(receipt).includes("email"), false);
    assert.equal(JSON.stringify(receipt).includes("password"), false);
    assert.equal(JSON.stringify(receipt).includes("userId"), false);
  });

  test("rejects false, missing, or extra checks and malformed metadata", () => {
    const cases = [
      {
        accountCommitment: "short",
        browserVersion: "140.0.7339.16",
        checks: validChecks,
        completedAt: "2026-08-28T03:00:01.000Z",
        source,
        startedAt: "2026-08-28T03:00:00.000Z",
      },
      {
        accountCommitment: "c".repeat(64),
        browserVersion: "Chrome 140",
        checks: validChecks,
        completedAt: "2026-08-28T03:00:01.000Z",
        source,
        startedAt: "2026-08-28T03:00:00.000Z",
      },
      {
        accountCommitment: "c".repeat(64),
        browserVersion: "140.0.7339.16",
        checks: { ...validChecks, approved_workspace_pass: false },
        completedAt: "2026-08-28T03:00:01.000Z",
        source,
        startedAt: "2026-08-28T03:00:00.000Z",
      },
      {
        accountCommitment: "c".repeat(64),
        browserVersion: "140.0.7339.16",
        checks: { ...validChecks, identity: true },
        completedAt: "2026-08-28T03:00:01.000Z",
        source,
        startedAt: "2026-08-28T03:00:00.000Z",
      },
      {
        accountCommitment: "c".repeat(64),
        browserVersion: "140.0.7339.16",
        checks: validChecks,
        completedAt: "2026-08-28T02:59:59.000Z",
        source,
        startedAt: "2026-08-28T03:00:00.000Z",
      },
    ];
    for (const candidate of cases) {
      assert.throws(
        () => buildClerkProductionHumanReceipt(candidate),
        /refused an unsafe receipt/,
      );
    }
  });
});
