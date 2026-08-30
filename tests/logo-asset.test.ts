import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { describe, it } from "node:test";

describe("responsive displayed logo", () => {
  it("uses one identical WebP derivative below 64 KiB in source and public assets", async () => {
    const sourceUrl = new URL("../assets/sufeiya-logo-header.webp", import.meta.url);
    const publicUrl = new URL("../public/assets/sufeiya-logo-header.webp", import.meta.url);
    const [sourceStat, publicStat, source, published] = await Promise.all([
      stat(sourceUrl),
      stat(publicUrl),
      readFile(sourceUrl),
      readFile(publicUrl),
    ]);
    assert.ok(sourceStat.size <= 64 * 1024, String(sourceStat.size));
    assert.equal(publicStat.size, sourceStat.size);
    assert.deepEqual(published, source);
  });

  it("keeps the full-resolution PNG for social metadata but not header/footer display", async () => {
    const [frame, generator, buildVerifier, notFound] = await Promise.all([
      readFile(new URL("../components/site-frame.tsx", import.meta.url), "utf8"),
      readFile(new URL("../scripts/generate-pages.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/verify-next-build.mjs", import.meta.url), "utf8"),
      readFile(new URL("../404.html", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(frame, /<img src="\/assets\/sufeiya-logo\.png"/);
    assert.match(frame, /sufeiya-logo-header\.webp/);
    assert.match(generator, /sufeiya-logo-header\.webp/);
    assert.match(buildVerifier, /\/assets\/sufeiya-logo-header\.webp/);
    assert.doesNotMatch(notFound, /sufeiya-logo\.png/);
    assert.match(notFound, /sufeiya-logo-header\.webp/);
  });
});
