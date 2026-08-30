import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  createPublicAnalyticsPayload,
  isPublicAnalyticsPath,
  sanitizePublicAnalyticsEvent,
  sanitizePublicAnalyticsProperties,
} from "../lib/public-analytics-policy";

describe("dormant privacy-scoped public analytics policy", () => {
  it("keeps Phase 0 runtime and dependency surfaces hard-disabled", async () => {
    const root = new URL("../", import.meta.url);
    const sources = await Promise.all([
      "components/public-site-shell.tsx",
      "components/public-learning-shell.tsx",
      "components/public-legacy-page.tsx",
      "package.json",
      "package-lock.json",
    ].map((path) => readFile(new URL(path, root), "utf8")));
    for (const source of sources) {
      assert.doesNotMatch(source, /@vercel\/analytics|PublicAnalytics|analytics=/);
    }
    for (const removedRuntime of [
      "components/public-analytics.tsx",
      "lib/public-analytics.ts",
    ]) {
      await assert.rejects(readFile(new URL(removedRuntime, root), "utf8"), { code: "ENOENT" });
    }
  });

  it("allows only current declared public pages", () => {
    for (const pathname of [
      "/",
      "/resources",
      "/privacy",
      "/learn/reading",
    ]) {
      assert.equal(isPublicAnalyticsPath(pathname), true, pathname);
    }
    for (const pathname of [
      "/my-data",
      "/account",
      "/account/data",
      "/teacher/cases",
      "/api/governance/status",
      "/sign-in",
      "/sign-up",
      "/workspace",
      "/__clerk/ticket_secret",
      "/learn/readingish",
      "/learn/reading/direct-evidence-v1",
      "/learn/reading/review",
      "/learn/reading/private@example.com",
    ]) {
      assert.equal(isPublicAnalyticsPath(pathname), false, pathname);
    }
  });

  it("drops protected URLs and strips every query and fragment from allowed events", () => {
    assert.deepEqual(
      sanitizePublicAnalyticsEvent({
        type: "pageview",
        url: "https://sufeiya.cn/resources?query=email%40example.com&skill=Reading#results",
      }),
      { type: "pageview", url: "https://sufeiya.cn/resources" },
    );
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "pageview",
      url: "https://sufeiya.cn/account?ticket=secret",
    }), null);
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "pageview",
      url: "https://evil.example/about?email=learner@example.com",
    }), null);
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "pageview",
      url: "https://user:password@sufeiya.cn/about",
    }), null);
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "pageview",
      url: "https://preview.example/about",
    }), null);
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "event",
      url: "not a url",
    }), null);
    assert.equal(sanitizePublicAnalyticsEvent({
      type: "pageview",
      url: "/about",
    }), null);
  });

  it("accepts at most two declared enum properties and rejects identity-shaped extras", () => {
    assert.deepEqual(sanitizePublicAnalyticsProperties({
      unit_version: "reading-p0-v1",
      runtime_mode: "browser_local",
    }), {
      unit_version: "reading-p0-v1",
      runtime_mode: "browser_local",
    });
    assert.equal(sanitizePublicAnalyticsProperties({ email: "learner@example.com" }), null);
    assert.equal(sanitizePublicAnalyticsProperties({ response: "answer text" }), null);
    assert.equal(sanitizePublicAnalyticsProperties({ toString: "browser_local" }), null);
    assert.equal(sanitizePublicAnalyticsProperties({ runtime_mode: "unknown" }), null);
    assert.equal(sanitizePublicAnalyticsProperties({
      unit_version: "direct-evidence-v1",
      runtime_mode: "browser_local",
      response: "day_1",
    }), null);
  });

  it("creates only the seven fixed custom events on public paths", () => {
    assert.deepEqual(createPublicAnalyticsPayload({
      name: "reading_course_viewed",
      pathname: "/learn/reading",
      properties: { unit_version: "reading-p0-v1", runtime_mode: "browser_local" },
    }), {
      name: "reading_course_viewed",
      properties: { unit_version: "reading-p0-v1", runtime_mode: "browser_local" },
    });
    assert.equal(createPublicAnalyticsPayload({
      name: "sync_offer_viewed",
      pathname: "/account/data",
    }), null);
  });
});
