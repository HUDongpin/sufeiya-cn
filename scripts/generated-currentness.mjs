import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const VERSIONED_LEGACY_SOURCE_PUBLIC_PAIRS = Object.freeze([
  Object.freeze(["data/resources.json", "public/data/resources.json"]),
  Object.freeze(["journey.js", "public/journey.js"]),
  Object.freeze(["learning-events.js", "public/learning-events.js"]),
  Object.freeze(["workspace-backup.js", "public/workspace-backup.js"]),
  Object.freeze(["assets/sufeiya-logo-header.webp", "public/assets/sufeiya-logo-header.webp"]),
  Object.freeze(["assets/listening-writing-center.mp3", "public/assets/listening-writing-center.mp3"]),
  ...[
    "sufeiyalaoshi-homepage-640w.avif",
    "sufeiyalaoshi-homepage-640w.webp",
    "sufeiyalaoshi-homepage-960w.avif",
    "sufeiyalaoshi-homepage-960w.webp",
    "sufeiyalaoshi-homepage-1280w.avif",
    "sufeiyalaoshi-homepage-1280w.webp",
  ].map((filename) => Object.freeze([
    `assets/teacher-portrait/${filename}`,
    `public/assets/teacher-portrait/${filename}`,
  ])),
]);

export const MATERIALIZED_LEGACY_RUNTIME_PAIRS = Object.freeze([
  Object.freeze(["workspace.js", "public/workspace.js"]),
  Object.freeze(["script.js", "public/script.js"]),
  Object.freeze(["resources.js", "public/resources.js"]),
]);

export async function findStaleFilePairs(root, pairs) {
  const stale = [];
  for (const [source, generated] of pairs) {
    try {
      const [sourceBytes, generatedBytes] = await Promise.all([
        readFile(join(root, source)),
        readFile(join(root, generated)),
      ]);
      if (!sourceBytes.equals(generatedBytes)) stale.push(generated);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        stale.push(generated);
        continue;
      }
      throw error;
    }
  }
  return stale;
}
