import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLERK_PUBLIC_RUNTIME_PATHS,
  CLERK_PRODUCTION_AUTHORIZED_PARTIES,
  CLERK_PROTECTED_PATHS,
  getClerkAuthorizedParties,
  getClerkRuntimeState,
  hasApplicationJsonContentType,
  isClerkRuntimePathname,
  isConfiguredClerkMiddlewarePathname,
  isClerkProtectedPathname,
  isSameOriginBrowserRequest,
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

  it("binds Vercel production to live keys and preview/development to test keys", () => {
    const developmentPair = {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("test"),
      CLERK_SECRET_KEY: "sk_test_abcdefghijklmnop",
    };
    const productionPair = {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey("live"),
      CLERK_SECRET_KEY: "sk_live_abcdefghijklmnop",
    };

    assert.equal(getClerkRuntimeState({ ...productionPair, VERCEL_ENV: "production" }).configured, true);
    assert.equal(getClerkRuntimeState({ ...developmentPair, VERCEL_ENV: "production" }).reason, "instance_mismatch");
    assert.equal(getClerkRuntimeState({ ...developmentPair, VERCEL_ENV: "preview" }).configured, true);
    assert.equal(getClerkRuntimeState({ ...productionPair, VERCEL_ENV: "preview" }).reason, "instance_mismatch");
    assert.equal(getClerkRuntimeState({ ...developmentPair, VERCEL_ENV: "development" }).configured, true);
    assert.equal(getClerkRuntimeState({ ...productionPair, VERCEL_ENV: "development" }).reason, "instance_mismatch");
    assert.equal(getClerkRuntimeState({ ...developmentPair, VERCEL_ENV: "unexpected" }).reason, "instance_mismatch");

    assert.equal(getClerkRuntimeState(developmentPair).configured, true);
  });
});

describe("browser request boundary", () => {
  function requestBoundary({
    contentType,
    origin,
    url = "https://sufeiya.cn/api/super-teacher",
    forwardedHost,
  }: {
    contentType?: string;
    origin?: string;
    url?: string;
    forwardedHost?: string;
  }) {
    const headers = new Headers();
    if (contentType !== undefined) headers.set("content-type", contentType);
    if (origin !== undefined) headers.set("origin", origin);
    if (forwardedHost !== undefined) headers.set("x-forwarded-host", forwardedHost);
    return { headers, url };
  }

  it("requires an exact schemeful request origin and ignores a spoofed forwarded host", () => {
    assert.equal(isSameOriginBrowserRequest(requestBoundary({ origin: "https://sufeiya.cn" })), true);
    assert.equal(isSameOriginBrowserRequest(requestBoundary({ origin: "https://SUFEIYA.CN:443" })), true);

    for (const boundary of [
      requestBoundary({}),
      requestBoundary({ origin: "null" }),
      requestBoundary({ origin: "not-a-url" }),
      requestBoundary({ origin: "http://sufeiya.cn" }),
      requestBoundary({ origin: "https://www.sufeiya.cn" }),
      requestBoundary({ origin: "https://evil.example" }),
      requestBoundary({ origin: "https://sufeiya.cn/path" }),
      requestBoundary({ origin: "https://user@sufeiya.cn" }),
      requestBoundary({ origin: "https://evil.example", forwardedHost: "evil.example" }),
    ]) {
      assert.equal(isSameOriginBrowserRequest(boundary), false);
    }

    assert.equal(isSameOriginBrowserRequest(requestBoundary({
      origin: "https://preview.example",
      url: "https://preview.example/api/super-teacher",
    })), true);
  });

  it("accepts only the application/json media type, with optional parameters", () => {
    for (const contentType of [
      "application/json",
      "Application/JSON",
      "application/json; charset=utf-8",
      " application/json ; charset=UTF-8",
    ]) {
      assert.equal(hasApplicationJsonContentType(requestBoundary({ contentType })), true, contentType);
    }

    for (const contentType of [
      undefined,
      "text/plain",
      "application/ld+json",
      "application/jsonp",
      "application/json-patch+json",
    ]) {
      assert.equal(hasApplicationJsonContentType(requestBoundary({ contentType })), false, contentType);
    }
  });
});

describe("Clerk route boundary", () => {
  it("restricts authorized parties to canonical production origins only", () => {
    assert.deepEqual(getClerkAuthorizedParties({ VERCEL_ENV: "production" }), [
      "https://sufeiya.cn",
      "https://www.sufeiya.cn",
    ]);
    assert.deepEqual(getClerkAuthorizedParties({ VERCEL_ENV: "production" }), [
      ...CLERK_PRODUCTION_AUTHORIZED_PARTIES,
    ]);
    assert.equal(getClerkAuthorizedParties({ VERCEL_ENV: "preview" }), undefined);
    assert.equal(getClerkAuthorizedParties({}), undefined);
  });

  it("protects the account plus every canonical learner-data surface", () => {
    for (const path of CLERK_PROTECTED_PATHS) {
      assert.equal(isClerkProtectedPathname(path), true, path);
      assert.equal(isClerkProtectedPathname(`${path}/child`), true, `${path}/child`);
    }

    assert.equal(isClerkProtectedPathname("/account/security"), true);

    for (const path of [
      "/",
      "/about",
      "/learning-path",
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

  it("runs Clerk middleware only for declared Clerk UI and server endpoints", () => {
    for (const path of [...CLERK_PROTECTED_PATHS, ...CLERK_PUBLIC_RUNTIME_PATHS]) {
      assert.equal(isClerkRuntimePathname(path), true, path);
      assert.equal(isConfiguredClerkMiddlewarePathname(path), true, path);
    }

    for (const path of [
      "/sign-in/factor-one",
      "/sign-up/verify-email-address",
      "/account/security",
    ]) {
      assert.equal(isClerkRuntimePathname(path), true, path);
      assert.equal(isConfiguredClerkMiddlewarePathname(path), true, path);
    }

    for (const path of [
      "/api/super-teacher",
      "/__clerk",
      "/__clerk/handshake",
    ]) {
      assert.equal(isConfiguredClerkMiddlewarePathname(path), true, path);
    }

    for (const path of [
      "/definitely-missing-route",
      "/definitely/missing-route",
      "/missing-asset.js",
      "/about/unknown-child",
      "/super-teacher/unknown-child",
      "/api",
      "/api/governance/status",
      "/api/super-teacher/voice/status",
      "/api/unknown",
      "/apiary",
      "/trpc",
      "/trpc/learner",
      "/trpc-preview",
      "/__clerkish",
    ]) {
      assert.equal(isClerkRuntimePathname(path), false, path);
      assert.equal(isConfiguredClerkMiddlewarePathname(path), false, path);
    }
  });
});
