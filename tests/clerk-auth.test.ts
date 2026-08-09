import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLERK_PROTECTED_PATHS,
  getClerkRuntimeState,
  isClerkProtectedPathname,
} from "../lib/auth/clerk-config";

function publishableKey(type: "test" | "live") {
  return `pk_${type}_${Buffer.from(`${type}.clerk.accounts.dev$`).toString("base64url")}`;
}

describe("Clerk runtime configuration", () => {
  it("fails closed when keys are absent, malformed, or from different instances", () => {
    assert.deepEqual(getClerkRuntimeState({}), {
      configured: false,
      instanceType: null,
      reason: "missing_keys",
    });
    assert.equal(getClerkRuntimeState({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_not-base64",
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    }).reason, "invalid_publishable_key");
    assert.equal(getClerkRuntimeState({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("test"),
      CLERK_SECRET_KEY: "not-a-secret",
    }).reason, "invalid_secret_key");
    assert.equal(getClerkRuntimeState({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("test"),
      CLERK_SECRET_KEY: "sk_live_abcdefghijklmnop",
    }).reason, "instance_mismatch");
  });

  it("accepts matching development and production key classes without exposing either key", () => {
    const development = getClerkRuntimeState({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("test"),
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    });
    const production = getClerkRuntimeState({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("live"),
      CLERK_SECRET_KEY: "sk_live_abcdefghijklmnop",
    });

    assert.deepEqual(development, { configured: true, instanceType: "development", reason: "configured" });
    assert.deepEqual(production, { configured: true, instanceType: "production", reason: "configured" });
    assert.equal(JSON.stringify({ development, production }).includes("abcdefghijklmnop"), false);
  });
});

describe("Clerk route boundary", () => {
  it("protects the account plus every canonical learner-data surface", () => {
    for (const path of CLERK_PROTECTED_PATHS) {
      assert.equal(isClerkProtectedPathname(path), true, path);
      assert.equal(isClerkProtectedPathname(`${path}/child`), true, `${path}/child`);
    }

    assert.equal(isClerkProtectedPathname("/account/security"), true);

    for (const path of [
      "/",
      "/about",
      "/platform",
      "/resources",
      "/super-teacher",
      "/sign-in",
      "/sign-up",
      "/api/super-teacher",
      "/practice-guide",
      "/community-guidelines",
      "/workspace-preview",
    ]) {
      assert.equal(isClerkProtectedPathname(path), false, path);
    }
  });
});
