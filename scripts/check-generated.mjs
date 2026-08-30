import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  VERSIONED_LEGACY_SOURCE_PUBLIC_PAIRS,
  findStaleFilePairs,
} from "./generated-currentness.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), "sufeiya-generated-"));
const generatedFiles = [
  "index.html",
  "workspace.html",
  "diagnostic.html",
  "plan.html",
  "today.html",
  "recommendations.html",
  "practice.html",
  "practice-reading.html",
  "practice-listening.html",
  "practice-writing.html",
  "practice-speaking.html",
  "focus.html",
  "check-in.html",
  "review.html",
  "community.html",
  "retest.html",
  "my-data.html",
  "learning-path.html",
  "platform.html",
  "resources.html",
  "about.html",
  "sitemap.xml",
];

try {
  await Promise.all([
    mkdir(join(temporaryRoot, "scripts"), { recursive: true }),
    mkdir(join(temporaryRoot, "data"), { recursive: true }),
  ]);
  await Promise.all([
    cp(join(root, "scripts/generate-pages.mjs"), join(temporaryRoot, "scripts/generate-pages.mjs")),
    cp(join(root, "data/diagnostic-task-register.json"), join(temporaryRoot, "data/diagnostic-task-register.json")),
    cp(join(root, "data/practice-task-register.json"), join(temporaryRoot, "data/practice-task-register.json")),
    cp(join(root, "data/content-release-manifest.v1.json"), join(temporaryRoot, "data/content-release-manifest.v1.json")),
    cp(join(root, "assets"), join(temporaryRoot, "assets"), { recursive: true }),
  ]);

  const generation = spawnSync(
    process.execPath,
    [join(temporaryRoot, "scripts/generate-pages.mjs")],
    { cwd: temporaryRoot, encoding: "utf8" },
  );
  if (generation.status !== 0) {
    throw new Error(`Temporary generation failed: ${generation.stderr.trim()}`);
  }

  const stale = [];
  for (const relativePath of generatedFiles) {
    const [committed, generated] = await Promise.all([
      readFile(join(root, relativePath)),
      readFile(join(temporaryRoot, relativePath)),
    ]);
    if (!committed.equals(generated)) stale.push(relativePath);
  }

  stale.push(...await findStaleFilePairs(root, VERSIONED_LEGACY_SOURCE_PUBLIC_PAIRS));

  if (stale.length) {
    throw new Error(
      `Generated files are stale: ${stale.join(", ")}. Run npm run generate and review the exact diff.`,
    );
  }
  process.stdout.write(
    `PASS check:generated (${generatedFiles.length + VERSIONED_LEGACY_SOURCE_PUBLIC_PAIRS.length} Git-custodied files; repository unchanged)\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
