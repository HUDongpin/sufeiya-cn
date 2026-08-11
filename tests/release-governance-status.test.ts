import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/governance/status/route";
import { RELEASE_SURFACES } from "../lib/release-governance";

describe("sanitized release-governance status route", () => {
  it("returns a no-store GET-only summary without evidence locators, owners, or secrets", async () => {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.get("x-sufeiya-governance-mode"), "read-only-no-mutations");

    const body = await response.json() as Record<string, unknown> & {
      surfaces: Record<string, { enabled: boolean; status: string; blockedDecisionIds: string[] }>;
    };
    assert.equal(body.protocolVersion, "sufeiya_release_decisions_v1");
    assert.equal(body.defaultDisposition, "deny");
    assert.equal(body.mode, "sanitized_read_only_status");
    assert.deepEqual(Object.keys(body.surfaces), [...RELEASE_SURFACES]);
    assert.equal(body.surfaces.local_teaching_review_demo?.enabled, true);
    assert.equal(body.surfaces.sofia_external_text_model?.enabled, false);
    assert.ok(body.surfaces.sofia_external_text_model?.blockedDecisionIds.length > 0);

    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "evidenceCatalog",
      "decisionOwner",
      "contentSha256",
      "locator",
      "DASHSCOPE_API_KEY",
      "CLERK_SECRET_KEY",
      "sk-",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  });
});
