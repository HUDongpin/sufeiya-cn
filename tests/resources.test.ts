import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { legacyPages } from "../lib/legacy-content.generated";
import {
  filterResources,
  parseResourceCatalog,
  parseResourceFilters,
  RESOURCE_CATALOG,
  splitLegacyResourcesMain,
} from "../lib/resources";

describe("server-rendered resource catalog", () => {
  it("parses the 15-item Teacher-reviewed remediation catalog", () => {
    const parsed = parseResourceCatalog(RESOURCE_CATALOG);
    assert.equal(parsed.length, 15);
    assert.equal(new Set(parsed.map((resource) => resource.id)).size, parsed.length);
    assert.equal(parsed.some((resource) => resource.id === "BV14P411r7hv"), false);
    for (const resource of parsed) {
      assert.equal("url" in resource, false);
      assert.equal(resource.reviewDisposition, "requires_edit");
      assert.equal(resource.reviewStatus, "teacher_reviewed_requires_remediation");
      assert.equal(resource.linkStatus, "blocked_pending_edit");
      assert.ok(resource.requiredEditCodes.includes("link_rights"));
      assert.ok(resource.reviewNote.length > 0);
    }
    assert.equal(parsed.find((resource) => resource.id === "BV1XA411G7Bp")?.publishedAt, "2021-05-19");
    assert.equal(parsed.find((resource) => resource.id === "BV1gg4y1q7QY")?.publishedAt, "2020-06-06");
    assert.throws(() => parseResourceCatalog(parsed.map((resource, index) =>
      index === 0 ? { ...resource, linkStatus: "allowed" } : resource,
    )));
  });

  it("uses one bounded URL query and skill as the filtering source of truth", () => {
    assert.deepEqual(parseResourceFilters({ query: ["Reading"], skill: ["Reading"] }), {
      query: "",
      skill: "all",
    });
    assert.deepEqual(parseResourceFilters({ query: `  ${"x".repeat(140)}  `, skill: "unknown" }), {
      query: "x".repeat(120),
      skill: "all",
    });

    const listening = filterResources({ query: "", skill: "Listening" });
    assert.ok(listening.length > 0);
    assert.ok(listening.every((resource) => resource.skills.includes("Listening")));
    const titleMatch = filterResources({ query: "every day", skill: "all" });
    assert.ok(titleMatch.some((resource) => resource.title.includes("every day")));
  });

  it("replaces exactly the old client-only catalog section", () => {
    const split = splitLegacyResourcesMain(legacyPages.resources.mainHtml);
    assert.match(split.beforeCatalogHtml, /中文讲解/);
    assert.match(split.afterCatalogHtml, /公开学习入口/);
    assert.doesNotMatch(split.beforeCatalogHtml + split.afterCatalogHtml, /data-resource-results/);
  });
});
