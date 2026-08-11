import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");

const appNotFoundHtmlPath = ".next/server/app/_not-found.html";
const pagesNotFoundHtmlPath = ".next/server/pages/404.html";
const clientReferenceManifestPath = ".next/server/app/_not-found/page_client-reference-manifest.js";
const buildManifestPath = ".next/server/app/_not-found/page/build-manifest.json";

const [appNotFoundHtml, pagesNotFoundHtml, clientReferenceManifest, buildManifest] = await Promise.all([
  read(appNotFoundHtmlPath),
  read(pagesNotFoundHtmlPath),
  read(clientReferenceManifestPath),
  read(buildManifestPath),
]);

const forbiddenBuildPatterns = [
  ["Clerk browser loader", /clerk\.browser\.js/i],
  ["Clerk script marker", /data-clerk-js-script/i],
  ["Clerk internal path", /__clerk/i],
  ["Clerk Next.js package", /@clerk\/nextjs/i],
  ["Clerk publishable test key", /pk_test_/i],
  ["Clerk publishable live key", /pk_live_/i],
  ["Clerk account component", /components\/clerk-account-controls/i],
  ["Sofia authenticated boundary", /components\/sofia-access-boundary/i],
];

const assertNoForbiddenContent = (content, label) => {
  for (const [description, pattern] of forbiddenBuildPatterns) {
    if (pattern.test(content)) {
      throw new Error(`${label} unexpectedly contains ${description}.`);
    }
  }
};

for (const [path, html] of [
  [appNotFoundHtmlPath, appNotFoundHtml],
  [pagesNotFoundHtmlPath, pagesNotFoundHtml],
]) {
  if (!html.includes("/learning-events.js") || !html.includes("/script.js")) {
    throw new Error(`${path} is missing the expected local site runtimes.`);
  }
  if (!html.includes("这一页暂时没有学习任务。")) {
    throw new Error(`${path} is missing the canonical anonymous 404 content.`);
  }
  assertNoForbiddenContent(html, path);
}

assertNoForbiddenContent(clientReferenceManifest, clientReferenceManifestPath);

const chunkPaths = new Set();
for (const artifact of [
  appNotFoundHtml,
  pagesNotFoundHtml,
  clientReferenceManifest,
  buildManifest,
]) {
  for (const match of artifact.matchAll(/(?:\/_next\/)?(static\/chunks\/[^"'\\<>\s]+\.js)/g)) {
    chunkPaths.add(`.next/${match[1]}`);
  }
}

for (const chunkPath of chunkPaths) {
  assertNoForbiddenContent(await read(chunkPath), chunkPath);
}

process.stdout.write(
  chunkPaths.size > 0
    ? `PASS: anonymous 404 build excludes Clerk and Sofia client code across ${chunkPaths.size} referenced chunks.\n`
    : "PASS: Vercel-rewritten anonymous 404 artifacts expose no local chunk paths and exclude Clerk and Sofia from HTML and the client manifest.\n",
);
