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
  it("parses the committed Bilibili-only catalog", () => {
    const parsed = parseResourceCatalog(RESOURCE_CATALOG);
    assert.ok(parsed.length > 0);
    assert.equal(new Set(parsed.map((resource) => resource.id)).size, parsed.length);
    for (const resource of parsed) {
      assert.match(resource.url, /^https:\/\/(www\.)?bilibili\.com\/video\//);
    }
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
