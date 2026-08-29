import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sitemap from "../app/sitemap";
import {
  CONTENT_RELEASE_MANIFEST,
  parseContentReleaseManifest,
} from "../lib/content-release-manifest";

describe("content release manifest", () => {
  it("is the unique source for sitemap lastModified values", () => {
    const manifest = parseContentReleaseManifest(CONTENT_RELEASE_MANIFEST);
    const expected = manifest.routes.filter((route) => route.sitemap);
    const actual = sitemap();
    assert.equal(actual.length, expected.length);
    assert.deepEqual(
      actual.map((entry) => [entry.url, (entry.lastModified as Date).toISOString()]),
      expected.map((route) => [
        `https://sufeiya.cn${route.path}`,
        new Date(route.lastModified).toISOString(),
      ]),
    );
  });

  it("keeps Reading and unreviewed legal drafts out of the sitemap", () => {
    const indexedPaths = CONTENT_RELEASE_MANIFEST.routes
      .filter((route) => route.sitemap)
      .map((route) => route.path);
    for (const path of ["/learn/reading", "/my-data", "/privacy", "/terms", "/support"]) {
      assert.equal(indexedPaths.includes(path), false, path);
    }
  });
});
