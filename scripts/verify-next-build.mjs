import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(join(root, path), "utf8");
const nextStaticRoot = resolve(root, ".next/static");

const appNotFoundHtmlPath = ".next/server/app/_not-found.html";
const pagesNotFoundHtmlPath = ".next/server/pages/404.html";
const clientReferenceManifestPath = ".next/server/app/_not-found/page_client-reference-manifest.js";
const buildManifestPath = ".next/server/app/_not-found/page/build-manifest.json";
const catchAllClientReferenceManifestPath =
  ".next/server/app/[slug]/page_client-reference-manifest.js";
const catchAllBuildManifestPath = ".next/server/app/[slug]/page/build-manifest.json";
const catchAllServerPagePath = ".next/server/app/[slug]/page.js";
const catchAllTracePath = ".next/server/app/[slug]/page.js.nft.json";

const [
  appNotFoundHtml,
  pagesNotFoundHtml,
  clientReferenceManifest,
  buildManifest,
  catchAllClientReferenceManifest,
  catchAllBuildManifest,
  catchAllServerPage,
  catchAllTrace,
] = await Promise.all([
  read(appNotFoundHtmlPath),
  read(pagesNotFoundHtmlPath),
  read(clientReferenceManifestPath),
  read(buildManifestPath),
  read(catchAllClientReferenceManifestPath),
  read(catchAllBuildManifestPath),
  read(catchAllServerPagePath),
  read(catchAllTracePath),
]);

const forbiddenBuildPatterns = [
  ["Clerk browser loader", /clerk\.browser\.js/i],
  ["Clerk script marker", /data-clerk-js-script/i],
  ["Clerk internal path", /__clerk/i],
  ["Clerk package", /@clerk[\\/]/i],
  ["Clerk publishable test key", /pk_test_/i],
  ["Clerk publishable live key", /pk_live_/i],
  ["Clerk account component", /components\/clerk-account-controls/i],
  ["Sofia authenticated boundary", /components\/sofia-access-boundary/i],
  ["Sofia component", /components\/(?:sofia-|super-teacher(?:[\\/-]|\.))/i],
  ["Sofia library", /lib\/super-teacher\//i],
  ["Sofia route module", /app\/super-teacher\//i],
];
const forbiddenCatchAllPatterns = [
  ["routed legacy server component", /components\/routed-legacy-page/i],
  ["legacy page component", /components\/legacy-page/i],
  ["authenticated site shell", /components\/site-shell/i],
];

const assertNoForbiddenContent = (content, label) => {
  for (const [description, pattern] of forbiddenBuildPatterns) {
    if (pattern.test(content)) {
      throw new Error(`${label} unexpectedly contains ${description}.`);
    }
  }
};

const assertNoCatchAllDependency = (content, label) => {
  assertNoForbiddenContent(content, label);
  for (const [description, pattern] of forbiddenCatchAllPatterns) {
    if (pattern.test(content)) {
      throw new Error(`${label} unexpectedly contains ${description}.`);
    }
  }
};

const assertNoForbiddenStructuredValue = (value, label, assertion) => {
  if (typeof value === "string") {
    assertion(value, label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenStructuredValue(entry, `${label}[${index}]`, assertion),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    assertion(key, `${label}:key`);
    assertNoForbiddenStructuredValue(entry, `${label}.${key}`, assertion);
  }
};

for (const [path, html] of [
  [appNotFoundHtmlPath, appNotFoundHtml],
  [pagesNotFoundHtmlPath, pagesNotFoundHtml],
]) {
  if (!html.includes("/workspace-backup.js") || !html.includes("/learning-events.js") || !html.includes("/script.js")) {
    throw new Error(`${path} is missing the expected local site runtimes.`);
  }
  if (!html.includes("这一页暂时没有学习任务。")) {
    throw new Error(`${path} is missing the canonical anonymous 404 content.`);
  }
  assertNoForbiddenContent(html, path);
}

assertNoForbiddenContent(clientReferenceManifest, clientReferenceManifestPath);
assertNoForbiddenContent(buildManifest, buildManifestPath);
assertNoCatchAllDependency(catchAllClientReferenceManifest, catchAllClientReferenceManifestPath);
assertNoCatchAllDependency(catchAllBuildManifest, catchAllBuildManifestPath);
assertNoCatchAllDependency(catchAllServerPage, catchAllServerPagePath);
assertNoCatchAllDependency(catchAllTrace, catchAllTracePath);

const parsedCatchAllTrace = JSON.parse(catchAllTrace);
if (
  Object.keys(parsedCatchAllTrace).sort().join(",") !== "entryHash,fileHashes,files,version" ||
  parsedCatchAllTrace.version !== 1 ||
  !Array.isArray(parsedCatchAllTrace.files) ||
  parsedCatchAllTrace.files.length === 0 ||
  !Array.isArray(parsedCatchAllTrace.fileHashes) ||
  parsedCatchAllTrace.fileHashes.length !== parsedCatchAllTrace.files.length ||
  parsedCatchAllTrace.fileHashes.some(
    (hash) => typeof hash !== "string" || !/^[a-f0-9]{32}$/.test(hash),
  ) ||
  typeof parsedCatchAllTrace.entryHash !== "string" ||
  parsedCatchAllTrace.entryHash.length === 0
) {
  throw new Error(`${catchAllTracePath} has an unreviewed trace shape.`);
}
assertNoForbiddenStructuredValue(
  parsedCatchAllTrace,
  catchAllTracePath,
  assertNoCatchAllDependency,
);

const resolvedRoot = resolve(root);
const catchAllTraceRoot = dirname(join(root, catchAllTracePath));
for (const relativePath of parsedCatchAllTrace.files) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(`${catchAllTracePath} contains an invalid traced file.`);
  }
  const absolutePath = resolve(catchAllTraceRoot, relativePath);
  if (!absolutePath.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`${catchAllTracePath} references a file outside the project: ${relativePath}`);
  }
  assertNoCatchAllDependency(
    await readFile(absolutePath, "utf8"),
    `${catchAllTracePath}:${relativePath}`,
  );
}

const clientManifestPreamble =
  "globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n";
const expectedClientManifestKeys = [
  "clientModules",
  "edgeRscModuleMapping",
  "edgeSSRModuleMapping",
  "entryCSSFiles",
  "entryJSFiles",
  "moduleLoading",
  "rscModuleMapping",
  "ssrModuleMapping",
];
const parseClientReferenceManifest = ({
  source,
  path,
  routeAssignment,
  requiredEntry,
  structuredAssertion,
}) => {
  const assignment =
    `${clientManifestPreamble}globalThis.__RSC_MANIFEST[${JSON.stringify(routeAssignment)}] = `;
  const normalized = source.trim();
  if (!normalized.startsWith(assignment)) {
    throw new Error(`${path} is missing the expected ${routeAssignment} route assignment.`);
  }

  const serialized = normalized.slice(assignment.length);
  if (!serialized.endsWith(";")) {
    throw new Error(`${path} has an incomplete route assignment.`);
  }

  const parsed = JSON.parse(serialized.slice(0, -1));
  assertNoForbiddenStructuredValue(parsed, path, structuredAssertion);
  if (Object.keys(parsed).sort().join(",") !== expectedClientManifestKeys.join(",")) {
    throw new Error(`${path} has an unreviewed top-level field.`);
  }
  const moduleLoading = parsed.moduleLoading;
  if (
    !moduleLoading ||
    Array.isArray(moduleLoading) ||
    typeof moduleLoading !== "object" ||
    Object.keys(moduleLoading).sort().join(",") !== "crossOrigin,prefix" ||
    moduleLoading.prefix !== "" ||
    moduleLoading.crossOrigin !== "none"
  ) {
    throw new Error(`${path} has an unapproved client chunk prefix.`);
  }
  if (
    !parsed.clientModules ||
    Array.isArray(parsed.clientModules) ||
    typeof parsed.clientModules !== "object" ||
    Object.keys(parsed.clientModules).length === 0 ||
    !parsed.entryJSFiles ||
    Array.isArray(parsed.entryJSFiles) ||
    typeof parsed.entryJSFiles !== "object"
  ) {
    throw new Error(`${path} is missing an inspectable anonymous client graph.`);
  }
  if (
    requiredEntry &&
    (!Array.isArray(parsed.entryJSFiles[requiredEntry]) ||
      parsed.entryJSFiles[requiredEntry].length === 0)
  ) {
    throw new Error(`${path} is missing the required ${requiredEntry} client entry.`);
  }
  return parsed;
};

const parsedClientManifests = [
  {
    path: clientReferenceManifestPath,
    parsed: parseClientReferenceManifest({
      source: clientReferenceManifest,
      path: clientReferenceManifestPath,
      routeAssignment: "/_not-found/page",
      requiredEntry: "[project]/app/not-found",
      structuredAssertion: assertNoForbiddenContent,
    }),
  },
  {
    path: catchAllClientReferenceManifestPath,
    parsed: parseClientReferenceManifest({
      source: catchAllClientReferenceManifest,
      path: catchAllClientReferenceManifestPath,
      routeAssignment: "/[slug]/page",
      requiredEntry: null,
      structuredAssertion: assertNoCatchAllDependency,
    }),
  },
];

const parsedCatchAllClientManifest = parsedClientManifests[1].parsed;
const allowedAnonymousProjectClientModules = new Set([
  "[project]/app/error.tsx",
  "[project]/app/global-error.tsx",
  "[project]/components/full-document-link.tsx",
]);
for (const { path, parsed } of parsedClientManifests) {
  const clientModuleNames = Object.keys(parsed.clientModules);
  if (
    clientModuleNames.some(
      (name) =>
        !allowedAnonymousProjectClientModules.has(name) &&
        !name.startsWith("[project]/node_modules/next/"),
    ) ||
    [...allowedAnonymousProjectClientModules].some((name) => !clientModuleNames.includes(name))
  ) {
    throw new Error(`${path} contains an unreviewed anonymous client module.`);
  }
}
if (
  Object.keys(parsedCatchAllClientManifest.clientModules).some((name) =>
    name.includes("[project]/app/[slug]/page"),
  ) ||
  Object.keys(parsedCatchAllClientManifest.entryJSFiles).some((name) =>
    name.includes("[project]/app/[slug]/page"),
  )
) {
  throw new Error(`${catchAllClientReferenceManifestPath} exposes a catch-all page client entry.`);
}
if (
  JSON.stringify(parsedClientManifests[0].parsed) !==
  JSON.stringify(parsedCatchAllClientManifest)
) {
  throw new Error(
    `${catchAllClientReferenceManifestPath} differs from the canonical anonymous 404 client graph.`,
  );
}

const expectedBuildManifestKeys = [
  "ampDevFiles",
  "ampFirstPages",
  "chunkLoadingGlobal",
  "devFiles",
  "lowPriorityFiles",
  "pages",
  "pagesChunkGroupBootstrapParams",
  "polyfillFiles",
  "rootMainFiles",
  "rootMainFilesTree",
];
const parseBuildManifest = ({ source, path, structuredAssertion }) => {
  const parsed = JSON.parse(source);
  assertNoForbiddenStructuredValue(parsed, path, structuredAssertion);
  if (Object.keys(parsed).sort().join(",") !== expectedBuildManifestKeys.join(",")) {
    throw new Error(`${path} has an unreviewed top-level field.`);
  }
  if (!Array.isArray(parsed.rootMainFiles) || parsed.rootMainFiles.length === 0) {
    throw new Error(`${path} is missing the expected root client runtime list.`);
  }
  if (
    !Array.isArray(parsed.ampFirstPages) ||
    parsed.ampFirstPages.length !== 0 ||
    !parsed.pagesChunkGroupBootstrapParams ||
    Array.isArray(parsed.pagesChunkGroupBootstrapParams) ||
    typeof parsed.pagesChunkGroupBootstrapParams !== "object" ||
    Object.keys(parsed.pagesChunkGroupBootstrapParams).length !== 0 ||
    parsed.chunkLoadingGlobal !== "TURBOPACK"
  ) {
    throw new Error(`${path} contains an unreviewed inline bootstrap shape.`);
  }
  return parsed;
};

const parsedBuildManifests = [
  {
    path: buildManifestPath,
    parsed: parseBuildManifest({
      source: buildManifest,
      path: buildManifestPath,
      structuredAssertion: assertNoForbiddenContent,
    }),
  },
  {
    path: catchAllBuildManifestPath,
    parsed: parseBuildManifest({
      source: catchAllBuildManifest,
      path: catchAllBuildManifestPath,
      structuredAssertion: assertNoCatchAllDependency,
    }),
  },
];
if (
  JSON.stringify(parsedBuildManifests[0].parsed) !==
  JSON.stringify(parsedBuildManifests[1].parsed)
) {
  throw new Error(
    `${catchAllBuildManifestPath} differs from the canonical anonymous 404 build graph.`,
  );
}

const allowedPublicScripts = new Map([
  ["/workspace-backup.js", "public/workspace-backup.js"],
  ["/learning-events.js", "public/learning-events.js"],
  ["/script.js", "public/script.js"],
]);
const executablePaths = new Set(allowedPublicScripts.values());
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
    tags.push({
      tag: html.slice(startMatch.index, end + 1),
      endIndex: end,
    });
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

const allowedInlineScriptPatterns = [
  /^\(self\.__next_s=self\.__next_s\|\|\[\]\)\.push\(\["\/workspace-backup\.js",\{"id":"sufeiya-workspace-backup-runtime"\}\]\)$/,
  /^\(self\.__next_s=self\.__next_s\|\|\[\]\)\.push\(\["\/learning-events\.js",\{"id":"sufeiya-learning-events-runtime"\}\]\)$/,
  /^\(self\.__next_f=self\.__next_f\|\|\[\]\)\.push\(\[0\]\)$/,
];
const flightInlineScriptPattern =
  /^self\.__next_f\.push\(\[1,"(?:\\[\s\S]|[^"\\])*"\]\)$/;
const flightInlineScriptPrefix = "self.__next_f.push([1,";

const decodeFlightInlineScript = (body, path) => {
  let decoded;
  try {
    decoded = JSON.parse(body.slice(flightInlineScriptPrefix.length, -2));
  } catch (error) {
    throw new Error(`${path} contains malformed inline Flight data: ${error.message}`);
  }
  if (typeof decoded !== "string") {
    throw new Error(`${path} contains non-string inline Flight data.`);
  }
  return decoded;
};

const scriptReferenceVariants = (value) => {
  const variants = new Set([value, value.replaceAll("\\", "/")]);
  let candidate = value;
  for (let depth = 0; depth < 4; depth += 1) {
    let decoded;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      break;
    }
    if (decoded === candidate) break;
    variants.add(decoded);
    variants.add(decoded.replaceAll("\\", "/"));
    candidate = decoded;
  }
  return variants;
};

const looksLikeScriptReference = (value) =>
  [...scriptReferenceVariants(value)].some((variant) => /\.js(?:[^A-Za-z0-9]|$)/i.test(variant));
const allowedAnonymousNonScriptSources = new Set(["/assets/sufeiya-logo.png"]);

const addFlightScriptReferences = (decoded, path) => {
  assertNoCatchAllDependency(decoded, `${path}:decoded Flight`);
  const jsonStringPattern = /"(?:\\[\s\S]|[^"\\])*"/g;
  const stringTokens = [];
  let match;
  let residual = "";
  let cursor = 0;
  while ((match = jsonStringPattern.exec(decoded)) !== null) {
    residual += decoded.slice(cursor, match.index);
    cursor = jsonStringPattern.lastIndex;
    let value;
    try {
      value = JSON.parse(match[0]);
    } catch (error) {
      throw new Error(`${path} contains malformed JSON string data in Flight: ${error.message}`);
    }
    if (typeof value === "string") {
      assertNoCatchAllDependency(value, `${path}:decoded Flight string`);
      stringTokens.push({ start: match.index, end: jsonStringPattern.lastIndex, value });
    }
    if (typeof value === "string" && looksLikeScriptReference(value)) {
      addHtmlScript(value, `${path}:inline Flight`);
    }
  }
  residual += decoded.slice(cursor);
  if (/\.js/i.test(residual)) {
    throw new Error(`${path} contains an unquoted script reference in inline Flight data.`);
  }

  for (let index = 0; index < stringTokens.length; index += 1) {
    const token = stringTokens[index];
    if (token.value !== "src") continue;
    const nextToken = stringTokens[index + 1];
    const separator = decoded.slice(token.end, nextToken?.start ?? decoded.length);
    if (!/^\s*:/.test(separator)) continue;
    if (!nextToken || !/^\s*:\s*$/.test(separator)) {
      throw new Error(`${path} contains a non-string or unreviewed Flight src property.`);
    }
    if (allowedAnonymousNonScriptSources.has(nextToken.value)) continue;
    addHtmlScript(nextToken.value, `${path}:Flight src`);
  }
};

const anonymousSegmentDirectory = ".next/server/app/_not-found.segments";
const anonymousSegmentEntries = await readdir(join(root, anonymousSegmentDirectory), {
  withFileTypes: true,
});
const anonymousSegmentNames = anonymousSegmentEntries
  .map((entry) => `${entry.isDirectory() ? "directory" : "file"}:${entry.name}`)
  .sort();
const expectedAnonymousSegmentNames = [
  "directory:_not-found",
  "file:_full.segment.rsc",
  "file:_index.segment.rsc",
  "file:_tree.segment.rsc",
];
if (anonymousSegmentNames.join(",") !== expectedAnonymousSegmentNames.join(",")) {
  throw new Error(`${anonymousSegmentDirectory} has an unreviewed artifact set.`);
}
const nestedAnonymousSegmentEntries = await readdir(
  join(root, anonymousSegmentDirectory, "_not-found"),
  { withFileTypes: true },
);
if (
  nestedAnonymousSegmentEntries.length !== 1 ||
  !nestedAnonymousSegmentEntries[0].isFile() ||
  nestedAnonymousSegmentEntries[0].name !== "__PAGE__.segment.rsc"
) {
  throw new Error(`${anonymousSegmentDirectory}/_not-found has an unreviewed artifact set.`);
}

const anonymousRscArtifactPaths = [
  ".next/server/app/_not-found.rsc",
  `${anonymousSegmentDirectory}/_full.segment.rsc`,
  `${anonymousSegmentDirectory}/_index.segment.rsc`,
  `${anonymousSegmentDirectory}/_not-found/__PAGE__.segment.rsc`,
  `${anonymousSegmentDirectory}/_tree.segment.rsc`,
];
for (const path of anonymousRscArtifactPaths) {
  const rsc = await read(path);
  assertNoCatchAllDependency(rsc, path);
  addFlightScriptReferences(rsc, path);
}

const assertAllowedInlineScript = (html, tag, endIndex, path) => {
  if (tag !== "<script>") {
    throw new Error(`${path} contains an inline script with unapproved attributes.`);
  }
  const closingPattern = /<\/script\s*>/gi;
  closingPattern.lastIndex = endIndex + 1;
  const closingMatch = closingPattern.exec(html);
  if (!closingMatch) {
    throw new Error(`${path} contains an unterminated inline script.`);
  }
  const body = html.slice(endIndex + 1, closingMatch.index).trim();
  if (flightInlineScriptPattern.test(body)) {
    return decodeFlightInlineScript(body, path);
  }
  if (!allowedInlineScriptPatterns.some((pattern) => pattern.test(body))) {
    throw new Error(`${path} contains an unapproved inline script.`);
  }
  return null;
};

const assertAllowedResourceScriptAttributes = (attributes, path) => {
  const allowedNames = new Set(["src", "async", "crossorigin", "nomodule", "id"]);
  for (const name of attributes.keys()) {
    if (!allowedNames.has(name)) {
      throw new Error(`${path} contains an unapproved ${name} attribute on a script resource.`);
    }
  }
  for (const name of ["async", "crossorigin", "nomodule"]) {
    if (attributes.has(name) && ![null, ""].includes(attributes.get(name))) {
      throw new Error(`${path} contains an unapproved ${name} value on a script resource.`);
    }
  }
  if (attributes.has("id") && attributes.get("id") !== "_R_") {
    throw new Error(`${path} contains an unapproved id on a script resource.`);
  }
};

const assertEmptyResourceScriptBody = (html, endIndex, path) => {
  const closingPattern = /<\/script\s*>/gi;
  closingPattern.lastIndex = endIndex + 1;
  const closingMatch = closingPattern.exec(html);
  if (!closingMatch) {
    throw new Error(`${path} contains an unterminated script resource.`);
  }
  if (html.slice(endIndex + 1, closingMatch.index).trim() !== "") {
    throw new Error(`${path} contains inline code inside a script resource.`);
  }
};

const assertAllowedScriptPreloadAttributes = (attributes, path) => {
  const allowedNames = new Set(["rel", "as", "fetchpriority", "href", "crossorigin"]);
  for (const name of attributes.keys()) {
    if (!allowedNames.has(name)) {
      throw new Error(`${path} contains an unapproved ${name} attribute on a script preload.`);
    }
  }
  if (
    attributes.has("crossorigin") &&
    ![null, ""].includes(attributes.get("crossorigin"))
  ) {
    throw new Error(`${path} contains an unapproved crossorigin value on a script preload.`);
  }
};

for (const [path, html] of [
  [appNotFoundHtmlPath, appNotFoundHtml],
  [pagesNotFoundHtmlPath, pagesNotFoundHtml],
]) {
  const scriptTags = extractStartTags(html, "script");
  const flightSegments = [];
  if (scriptTags.length === 0) {
    throw new Error(`${path} does not expose an inspectable client script list.`);
  }
  for (const { tag, endIndex } of scriptTags) {
    const attributes = parseTagAttributes(tag, "script");
    if (attributes.has("src")) {
      assertAllowedResourceScriptAttributes(attributes, path);
      assertEmptyResourceScriptBody(html, endIndex, path);
      addHtmlScript(attributes.get("src"), path);
    } else {
      const flightSegment = assertAllowedInlineScript(html, tag, endIndex, path);
      if (flightSegment !== null) flightSegments.push(flightSegment);
    }
  }
  if (flightSegments.length === 0) {
    throw new Error(`${path} does not expose inspectable inline Flight data.`);
  }
  addFlightScriptReferences(flightSegments.join(""), path);

  for (const { tag } of extractStartTags(html, "link")) {
    const attributes = parseTagAttributes(tag, "link");
    for (const name of attributes.keys()) {
      if (name.startsWith("on")) {
        throw new Error(`${path} contains an inline event handler on a link.`);
      }
    }
    const relTokens = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
    const isScriptPreload =
      relTokens.includes("preload") && attributes.get("as")?.toLowerCase() === "script";
    const isModulePreload = relTokens.includes("modulepreload");
    if (isScriptPreload || isModulePreload) {
      if (!attributes.has("href")) {
        throw new Error(`${path} contains a script resource preload without an href.`);
      }
      if (
        isModulePreload &&
        attributes.has("as") &&
        attributes.get("as")?.toLowerCase() !== "script"
      ) {
        throw new Error(`${path} contains an unapproved modulepreload as value.`);
      }
      assertAllowedScriptPreloadAttributes(attributes, path);
      addHtmlScript(attributes.get("href"), path);
    }
  }
}

for (const { path, parsed } of parsedClientManifests) {
  for (const [moduleName, moduleEntry] of Object.entries(parsed.clientModules)) {
    if (!moduleEntry || typeof moduleEntry !== "object" || !Array.isArray(moduleEntry.chunks)) {
      throw new Error(`${path} has invalid chunks for ${moduleName}.`);
    }
    for (const resource of moduleEntry.chunks) {
      addManifestScript(resource, `${path}:${moduleName}`);
    }
  }

  for (const [entryName, resources] of Object.entries(parsed.entryJSFiles)) {
    if (!Array.isArray(resources)) {
      throw new Error(`${path} has an invalid entry for ${entryName}.`);
    }
    for (const resource of resources) {
      addManifestScript(resource, `${path}:${entryName}`);
    }
  }
}

for (const { path, parsed } of parsedBuildManifests) {
  for (const field of ["devFiles", "ampDevFiles", "polyfillFiles", "lowPriorityFiles", "rootMainFiles"]) {
    const resources = parsed[field];
    if (!Array.isArray(resources)) {
      throw new Error(`${path} is missing the ${field} script list.`);
    }
    for (const resource of resources) {
      addManifestScript(resource, `${path}:${field}`);
    }
  }

  if (!parsed.pages || Array.isArray(parsed.pages) || typeof parsed.pages !== "object") {
    throw new Error(`${path} has an invalid pages script map.`);
  }
  for (const [pageName, resources] of Object.entries(parsed.pages)) {
    if (!Array.isArray(resources)) {
      throw new Error(`${path} has an invalid pages entry for ${pageName}.`);
    }
    for (const resource of resources) {
      addManifestScript(resource, `${path}:pages:${pageName}`);
    }
  }

  if (
    !parsed.rootMainFilesTree ||
    Array.isArray(parsed.rootMainFilesTree) ||
    typeof parsed.rootMainFilesTree !== "object"
  ) {
    throw new Error(`${path} has an invalid route-specific root script map.`);
  }
  for (const [routeName, resources] of Object.entries(parsed.rootMainFilesTree)) {
    if (!Array.isArray(resources)) {
      throw new Error(`${path} has an invalid root script entry for ${routeName}.`);
    }
    for (const resource of resources) {
      addManifestScript(resource, `${path}:rootMainFilesTree:${routeName}`);
    }
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
