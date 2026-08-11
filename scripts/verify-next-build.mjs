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
assertNoForbiddenContent(buildManifest, buildManifestPath);

if (
  !clientReferenceManifest.includes('globalThis.__RSC_MANIFEST["/_not-found/page"]') ||
  !clientReferenceManifest.includes('"clientModules":{') ||
  !clientReferenceManifest.includes('"[project]/app/not-found"')
) {
  throw new Error(
    `${clientReferenceManifestPath} is missing the expected anonymous 404 route structure.`,
  );
}

const parsedBuildManifest = JSON.parse(buildManifest);
if (
  !Array.isArray(parsedBuildManifest.rootMainFiles) ||
  parsedBuildManifest.rootMainFiles.length === 0
) {
  throw new Error(`${buildManifestPath} is missing the expected root client runtime list.`);
}

const allowedPublicScripts = new Set(["/learning-events.js", "/script.js"]);
const nextChunkPattern = /^\/_next\/static\/(?:immutable\/)?chunks\/[A-Za-z0-9._-]+\.js$/;

const extractScriptResources = (html) => {
  const resources = [];

  for (const match of html.matchAll(
    /<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,
  )) {
    resources.push(match[1] ?? match[2] ?? match[3]);
  }

  for (const tagMatch of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    if (!/\brel=(?:"preload"|'preload'|preload)(?:\s|\/?>)/i.test(tag)) continue;
    if (!/\bas=(?:"script"|'script'|script)(?:\s|\/?>)/i.test(tag)) continue;
    const hrefMatch = tag.match(/\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    if (hrefMatch) resources.push(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]);
  }

  return resources;
};

const chunkPaths = new Set();
for (const [path, html] of [
  [appNotFoundHtmlPath, appNotFoundHtml],
  [pagesNotFoundHtmlPath, pagesNotFoundHtml],
]) {
  const scriptResources = extractScriptResources(html);
  if (scriptResources.length === 0) {
    throw new Error(`${path} does not expose an inspectable client script list.`);
  }
  for (const resource of scriptResources) {
    if (!allowedPublicScripts.has(resource) && !nextChunkPattern.test(resource)) {
      throw new Error(`${path} contains an unapproved or non-local script resource: ${resource}`);
    }
    if (nextChunkPattern.test(resource)) {
      chunkPaths.add(`.next/${resource.replace(/^\/_next\//, "")}`);
    }
  }
}

for (const artifact of [
  appNotFoundHtml,
  pagesNotFoundHtml,
  clientReferenceManifest,
  buildManifest,
]) {
  for (const match of artifact.matchAll(
    /(?:\/_next\/)?(static\/(?:immutable\/)?chunks\/[A-Za-z0-9._-]+\.js)/g,
  )) {
    chunkPaths.add(`.next/${match[1]}`);
  }
}

if (chunkPaths.size === 0) {
  throw new Error("The anonymous 404 build did not expose any inspectable client chunks.");
}

for (const chunkPath of chunkPaths) {
  assertNoForbiddenContent(await read(chunkPath), chunkPath);
}

process.stdout.write(
  `PASS: anonymous 404 build excludes Clerk and Sofia client code across ${chunkPaths.size} referenced chunks.\n`,
);
