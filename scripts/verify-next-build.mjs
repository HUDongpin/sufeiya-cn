import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const nextStaticRoot = resolve(root, ".next/static");

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

const clientManifestAssignment = 'globalThis.__RSC_MANIFEST["/_not-found/page"] = ';
const clientManifestAssignmentIndex = clientReferenceManifest.indexOf(clientManifestAssignment);
if (clientManifestAssignmentIndex === -1) {
  throw new Error(
    `${clientReferenceManifestPath} is missing the expected anonymous 404 route assignment.`,
  );
}

const clientManifestJson = clientReferenceManifest
  .slice(clientManifestAssignmentIndex + clientManifestAssignment.length)
  .trim();
if (!clientManifestJson.endsWith(";")) {
  throw new Error(`${clientReferenceManifestPath} has an incomplete route assignment.`);
}

const parsedClientManifest = JSON.parse(clientManifestJson.slice(0, -1));
if (
  !parsedClientManifest.clientModules ||
  Array.isArray(parsedClientManifest.clientModules) ||
  typeof parsedClientManifest.clientModules !== "object" ||
  Object.keys(parsedClientManifest.clientModules).length === 0 ||
  !parsedClientManifest.entryJSFiles ||
  Array.isArray(parsedClientManifest.entryJSFiles) ||
  typeof parsedClientManifest.entryJSFiles !== "object" ||
  !Array.isArray(parsedClientManifest.entryJSFiles["[project]/app/not-found"]) ||
  parsedClientManifest.entryJSFiles["[project]/app/not-found"].length === 0
) {
  throw new Error(`${clientReferenceManifestPath} is missing the anonymous 404 client graph.`);
}

const parsedBuildManifest = JSON.parse(buildManifest);
if (
  !Array.isArray(parsedBuildManifest.rootMainFiles) ||
  parsedBuildManifest.rootMainFiles.length === 0
) {
  throw new Error(`${buildManifestPath} is missing the expected root client runtime list.`);
}

const executablePaths = new Set();
const allowedPublicScripts = new Map([
  ["/learning-events.js", "public/learning-events.js"],
  ["/script.js", "public/script.js"],
]);
const htmlNextChunkPattern =
  /^\/_next\/static\/(?:immutable\/)?chunks\/[A-Za-z0-9._-]+\.js$/;
const manifestStaticScriptPattern =
  /^(?:\/_next\/)?static\/(?:immutable\/)?chunks\/[A-Za-z0-9._-]+\.js$/;

const addManifestScript = (resource, label) => {
  if (typeof resource !== "string" || !manifestStaticScriptPattern.test(resource)) {
    throw new Error(`${label} contains an unapproved or non-local script resource: ${resource}`);
  }
  const relativePath = resource.replace(/^\/_next\//, "");
  if (relativePath.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error(`${label} contains a non-canonical script resource: ${resource}`);
  }
  const absolutePath = resolve(root, ".next", relativePath);
  if (!absolutePath.startsWith(`${nextStaticRoot}${sep}`)) {
    throw new Error(`${label} contains a script resource outside .next/static: ${resource}`);
  }
  executablePaths.add(`.next/${relativePath}`);
};

const addHtmlScript = (resource, label) => {
  if (typeof resource !== "string" || resource.length === 0) {
    throw new Error(`${label} contains an empty script resource.`);
  }
  if (allowedPublicScripts.has(resource)) {
    executablePaths.add(allowedPublicScripts.get(resource));
    return;
  }
  if (!htmlNextChunkPattern.test(resource)) {
    throw new Error(`${label} contains an unapproved or non-local script resource: ${resource}`);
  }
  executablePaths.add(`.next/${resource.replace(/^\/_next\//, "")}`);
};

const extractStartTags = (html, tagName) => {
  const tags = [];
  const startPattern = new RegExp(`<${tagName}\\b`, "gi");
  let startMatch;

  while ((startMatch = startPattern.exec(html)) !== null) {
    let quote = null;
    let end = startPattern.lastIndex;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (end === html.length || quote) {
      throw new Error(`HTML contains an unterminated <${tagName}> start tag.`);
    }
    tags.push(html.slice(startMatch.index, end + 1));
    startPattern.lastIndex = end + 1;
  }

  return tags;
};

const parseTagAttributes = (tag, tagName) => {
  const attributes = new Map();
  let index = tagName.length + 1;
  const end = tag.length - 1;
  const isSpace = (character) => /[\t\n\f\r ]/.test(character);

  while (index < end) {
    while (index < end && isSpace(tag[index])) index += 1;
    if (index >= end || (tag[index] === "/" && tag.slice(index + 1, end).trim() === "")) break;

    const nameStart = index;
    while (index < end && !isSpace(tag[index]) && !/[=\/>]/.test(tag[index])) index += 1;
    if (index === nameStart) {
      throw new Error(`HTML contains an invalid <${tagName}> attribute.`);
    }
    const name = tag.slice(nameStart, index).toLowerCase();
    if (attributes.has(name)) {
      throw new Error(`HTML contains a duplicate ${name} attribute on <${tagName}>.`);
    }

    while (index < end && isSpace(tag[index])) index += 1;
    let value = null;
    if (tag[index] === "=") {
      index += 1;
      while (index < end && isSpace(tag[index])) index += 1;
      if (index >= end) {
        throw new Error(`HTML contains an empty ${name} assignment on <${tagName}>.`);
      }
      if (tag[index] === '"' || tag[index] === "'") {
        const quote = tag[index];
        index += 1;
        const valueStart = index;
        while (index < end && tag[index] !== quote) index += 1;
        if (index >= end) {
          throw new Error(`HTML contains an unterminated ${name} value on <${tagName}>.`);
        }
        value = tag.slice(valueStart, index);
        index += 1;
      } else {
        const valueStart = index;
        while (index < end && !isSpace(tag[index]) && tag[index] !== ">") index += 1;
        value = tag.slice(valueStart, index);
      }
    }
    attributes.set(name, value);
  }

  return attributes;
};

for (const [path, html] of [
  [appNotFoundHtmlPath, appNotFoundHtml],
  [pagesNotFoundHtmlPath, pagesNotFoundHtml],
]) {
  const scriptTags = extractStartTags(html, "script");
  if (scriptTags.length === 0) {
    throw new Error(`${path} does not expose an inspectable client script list.`);
  }
  for (const tag of scriptTags) {
    const attributes = parseTagAttributes(tag, "script");
    if (attributes.has("src")) addHtmlScript(attributes.get("src"), path);
  }

  for (const tag of extractStartTags(html, "link")) {
    const attributes = parseTagAttributes(tag, "link");
    const relTokens = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
    if (relTokens.includes("preload") && attributes.get("as")?.toLowerCase() === "script") {
      if (!attributes.has("href")) {
        throw new Error(`${path} contains a script preload without an href.`);
      }
      addHtmlScript(attributes.get("href"), path);
    }
  }
}

for (const [moduleName, moduleEntry] of Object.entries(parsedClientManifest.clientModules)) {
  if (!moduleEntry || typeof moduleEntry !== "object" || !Array.isArray(moduleEntry.chunks)) {
    throw new Error(`${clientReferenceManifestPath} has invalid chunks for ${moduleName}.`);
  }
  for (const resource of moduleEntry.chunks) {
    addManifestScript(resource, `${clientReferenceManifestPath}:${moduleName}`);
  }
}

for (const [entryName, resources] of Object.entries(parsedClientManifest.entryJSFiles)) {
  if (!Array.isArray(resources)) {
    throw new Error(`${clientReferenceManifestPath} has an invalid entry for ${entryName}.`);
  }
  for (const resource of resources) {
    addManifestScript(resource, `${clientReferenceManifestPath}:${entryName}`);
  }
}

for (const field of ["devFiles", "ampDevFiles", "polyfillFiles", "lowPriorityFiles", "rootMainFiles"]) {
  const resources = parsedBuildManifest[field];
  if (!Array.isArray(resources)) {
    throw new Error(`${buildManifestPath} is missing the ${field} script list.`);
  }
  for (const resource of resources) {
    addManifestScript(resource, `${buildManifestPath}:${field}`);
  }
}

if (
  !parsedBuildManifest.pages ||
  Array.isArray(parsedBuildManifest.pages) ||
  typeof parsedBuildManifest.pages !== "object"
) {
  throw new Error(`${buildManifestPath} has an invalid pages script map.`);
}
for (const [pageName, resources] of Object.entries(parsedBuildManifest.pages)) {
  if (!Array.isArray(resources)) {
    throw new Error(`${buildManifestPath} has an invalid pages entry for ${pageName}.`);
  }
  for (const resource of resources) {
    addManifestScript(resource, `${buildManifestPath}:pages:${pageName}`);
  }
}

if (
  !parsedBuildManifest.rootMainFilesTree ||
  Array.isArray(parsedBuildManifest.rootMainFilesTree) ||
  typeof parsedBuildManifest.rootMainFilesTree !== "object"
) {
  throw new Error(`${buildManifestPath} has an invalid route-specific root script map.`);
}
for (const [routeName, resources] of Object.entries(parsedBuildManifest.rootMainFilesTree)) {
  if (!Array.isArray(resources)) {
    throw new Error(`${buildManifestPath} has an invalid root script entry for ${routeName}.`);
  }
  for (const resource of resources) {
    addManifestScript(resource, `${buildManifestPath}:rootMainFilesTree:${routeName}`);
  }
}

if (executablePaths.size === 0) {
  throw new Error("The anonymous 404 build did not expose any inspectable client chunks.");
}

for (const executablePath of executablePaths) {
  assertNoForbiddenContent(await read(executablePath), executablePath);
}

process.stdout.write(
  `PASS: anonymous 404 build excludes Clerk and Sofia client code across ${executablePaths.size} referenced scripts.\n`,
);
