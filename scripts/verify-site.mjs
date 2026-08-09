import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const passes = [];
const pageFiles = [
  ["index.html", "home", "/"],
  ["workspace.html", "workspace", "/workspace"],
  ["plan.html", "plan", "/plan"],
  ["today.html", "today", "/today"],
  ["practice.html", "practice", "/practice"],
  ["practice-reading.html", "practice-reading", "/practice-reading"],
  ["practice-listening.html", "practice-listening", "/practice-listening"],
  ["practice-writing.html", "practice-writing", "/practice-writing"],
  ["practice-speaking.html", "practice-speaking", "/practice-speaking"],
  ["focus.html", "focus", "/focus"],
  ["check-in.html", "check-in", "/check-in"],
  ["my-data.html", "my-data", "/my-data"],
  ["learning-path.html", "learning-path", "/learning-path"],
  ["platform.html", "platform", "/platform"],
  ["resources.html", "resources", "/resources"],
  ["about.html", "about", "/about"],
];
const expectedNavTargets = ["/learning-path", "/platform", "/resources", "/about"];

const check = (condition, message) => {
  if (condition) passes.push(message);
  else failures.push(message);
};

const read = (path) => readFile(join(root, path), "utf8");
const styles = await read("styles.css");
const script = await read("script.js");
const workspaceScript = await read("workspace.js");
const resourcesScript = await read("resources.js");
const notFound = await read("404.html");
const sitemap = await read("sitemap.xml");
const proxy = await read("proxy.ts");

const resolveLocalPath = (urlPath) => {
  const clean = urlPath.split("#")[0].split("?")[0];
  if (clean === "/") return "index.html";
  const relative = clean.replace(/^\/+/, "");
  if (relative.includes(".")) return relative;
  return `${relative}.html`;
};

for (const [filename, pageKey, canonicalPath] of pageFiles) {
  const html = await read(filename);
  const prefix = `${filename}:`;
  check((html.match(/<h1\b/gi) || []).length === 1, `${prefix} exactly one h1`);
  check(/<html\s+lang="zh-CN"/i.test(html), `${prefix} document language is zh-CN`);
  check(new RegExp(`<body data-page="${pageKey}"`).test(html), `${prefix} declares its page identity`);
  check(/<meta\s+name="description"/i.test(html), `${prefix} meta description is present`);
  check(
    html.includes(`<link rel="canonical" href="https://sufeiya.cn${canonicalPath}"`),
    `${prefix} canonical URL is correct`,
  );
  check(/<a class="skip-link" href="#main-content"/i.test(html), `${prefix} keyboard skip link is present`);
  check(/id="main-content"/.test(html), `${prefix} skip-link target exists`);
  check(/aria-controls="mobile-nav"/.test(html), `${prefix} mobile navigation control is labelled`);
  check(!/href="#"/.test(html), `${prefix} has no empty hash links`);
  check(!/\b(TODO|FIXME)\b/i.test(html), `${prefix} has no unfinished marker copy`);
  check(/src="\/assets\/sufeiya-logo\.png" width="2792" height="560"/.test(html), `${prefix} uses the HD logo dimensions`);
  check(/href="\/assets\/sufeiya-mark\.png"/.test(html), `${prefix} uses the official mark favicon`);

  const desktopNavMatch = html.match(/<nav class="desktop-nav"[\s\S]*?<\/nav>/i);
  check(Boolean(desktopNavMatch), `${prefix} desktop navigation exists`);
  if (desktopNavMatch) {
    const targets = [...desktopNavMatch[0].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    check(
      JSON.stringify(targets) === JSON.stringify(expectedNavTargets),
      `${prefix} four navigation buttons each target a distinct page`,
    );
    check(!/(THE|LEARNING|PLATFORM|RESOURCES|ABOUT)\b/.test(desktopNavMatch[0]), `${prefix} navigation labels are Chinese`);
  }

  if (expectedNavTargets.includes(canonicalPath)) {
    check(
      new RegExp(`data-page-link="${pageKey}"[^>]*(?:aria-current="page"|class="is-active")|aria-current="page"[^>]*data-page-link="${pageKey}"`).test(
        html,
      ),
      `${prefix} current page is identified in desktop navigation`,
    );
  }

  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const internalAnchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
  for (const anchor of internalAnchors) {
    check(ids.has(anchor), `${prefix} internal anchor #${anchor} resolves`);
  }

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < headings.length; index += 1) {
    check(headings[index] - headings[index - 1] <= 1, `${prefix} heading levels do not skip`);
  }

  const externalTags = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)].map((match) => match[0]);
  for (const tag of externalTags) {
    check(/rel="[^"]*noopener[^"]*noreferrer[^"]*"/i.test(tag), `${prefix} new-window link is isolated`);
  }

  const localUrls = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of localUrls) {
    const path = resolveLocalPath(url);
    try {
      await access(join(root, path));
      passes.push(`${prefix} local target ${url} exists`);
    } catch {
      failures.push(`${prefix} missing local target ${url} (${path})`);
    }
  }
}

check(!/\b(innerHTML|eval\s*\()/.test(script), "client script avoids unsafe DOM injection and eval");
check(!/\b(innerHTML|eval\s*\()/.test(workspaceScript), "workspace script avoids unsafe DOM injection and eval");
check(!/\b(innerHTML|eval\s*\()/.test(resourcesScript), "resource script avoids unsafe DOM injection and eval");
check(/event\.key === "Tab"/.test(script), "mobile navigation includes keyboard focus containment");
check(/event\.key === "Escape"/.test(script), "mobile navigation supports Escape");
check(/prefers-reduced-motion:\s*reduce/.test(styles), "reduced-motion preference is supported");
check(/:focus-visible/.test(styles), "visible keyboard focus style is present");
check(/\.hero\s*\{[\s\S]*linear-gradient\(135deg,\s*#fffdf7/i.test(styles), "home hero uses a light background");
check(!/hero-orbit|page-hero-orbit/.test(styles), "navigation-adjacent hero styles contain no decorative orbit lines");
check(!/\.learning-plate::before/.test(styles), "home learning card contains no decorative arc line");
check(/\.system\s*\{[\s\S]*background:\s*var\(--color-sage\)/i.test(styles), "platform section uses a light sage background");
check(/中文讲解[\s\S]*英文材料/.test(await read("resources.html")), "resources page states the Chinese UI and English materials rule");
check(/胡冬品博士（Dr\. Peter Hu）/.test(await read("about.html")), "confirmed Dr. Peter Hu public name is present");
check(/苏肥鸭老师（Sofia）/.test(await read("about.html")), "confirmed Sofia public name is present");

const workspace = await read("workspace.html");
check(!/id="plan-form"/.test(workspace), "workspace is an entry page and does not embed the plan form");
check(!/name="reading-answer"/.test(workspace), "workspace does not embed an English exercise");
check(!/data-focus-time/.test(workspace), "workspace does not embed the focus timer");
check(!/id="checkin-form"/.test(workspace), "workspace does not embed the check-in form");
const workspaceToolTargets = [...workspace.matchAll(/class="workspace-launch-grid"[\s\S]*?<\/div>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(workspaceToolTargets) === JSON.stringify(["/plan", "/today", "/practice", "/focus", "/check-in"]),
  "workspace has five buttons targeting five distinct function pages",
);

const practice = await read("practice.html");
const practiceTargets = [...practice.matchAll(/class="practice-launch-grid"[\s\S]*?<\/div>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(practiceTargets) ===
    JSON.stringify(["/practice-reading", "/practice-listening", "/practice-writing", "/practice-speaking"]),
  "four skill buttons target four distinct practice pages",
);

check(/id="plan-form"/.test(await read("plan.html")), "plan page contains a directly usable plan form");
check(/data-today-tasks/.test(await read("today.html")), "today page contains a directly usable task list");
check(/lang="en"[\s\S]*name="reading-answer"/.test(await read("practice-reading.html")), "reading material is marked as English");
check(/<audio controls preload="metadata"[\s\S]*name="listening-answer"/.test(await read("practice-listening.html")), "listening page includes packaged audio and a question");
check(/textarea[^>]*lang="en"[\s\S]*data-complete-writing/.test(await read("practice-writing.html")), "writing page includes an English response field and completion control");
check(/data-speaking-time[\s\S]*data-speaking-review/.test(await read("practice-speaking.html")), "speaking page includes prepare/speak timing and self-review");
check(/data-focus-time[\s\S]*data-focus-stop/.test(await read("focus.html")), "focus page includes start, pause, stop, and reset-capable controls");
check(/name="didText"[\s\S]*name="evidenceText"[\s\S]*name="questionStatus"/.test(await read("check-in.html")), "check-in page collects action, evidence, and question state");
check(/data-export-workspace[\s\S]*data-clear-workspace/.test(await read("my-data.html")), "data page supports export and scoped clearing");
check(/sufeiya_workspace_v1/.test(workspaceScript), "workspace uses one versioned local-storage namespace");
check(/localStorage\.removeItem\(STORAGE_KEY\)/.test(workspaceScript), "clear action only removes the Sufeiya workspace namespace");
check(/endsAt[\s\S]*Date\.now\(\)/.test(workspaceScript), "focus timer uses an absolute end time for background and reload recovery");
check(/Number\.isFinite\(storedRemaining\)/.test(workspaceScript), "focus timer preserves a completed zero-second value");
check(/hasValidPlanShape\(value\.plan\)/.test(workspaceScript), "stored plans are shape-checked before rendering");
check(!/(?:0\s*[–-]\s*100|10\s*[–-]\s*160|官方估分|预测分数)/.test(workspaceScript), "workspace does not generate score ranges or official predictions");

const resourcesData = JSON.parse(await read("data/resources.json"));
check(resourcesData.length === 16, "public resource catalog contains 16 reviewed metadata entries");
check(new Set(resourcesData.map((item) => item.id)).size === resourcesData.length, "resource catalog IDs are unique");
check(resourcesData.every((item) => /^https:\/\/(www\.)?bilibili\.com\/video\//.test(item.url)), "resource catalog links only to Bilibili video pages");
check(resourcesData.every((item) => Array.isArray(item.skills) && item.skills.length > 0), "every resource entry has at least one skill tag");

const logo = await readFile(join(root, "assets/sufeiya-logo.png"));
check(logo.toString("ascii", 1, 4) === "PNG", "HD logo is PNG");
check(logo.readUInt32BE(16) === 2792 && logo.readUInt32BE(20) === 560, "HD logo is 2792×560");
check(logo[25] === 6, "HD logo has a true alpha channel");

const mark = await readFile(join(root, "assets/sufeiya-mark.png"));
check(mark.readUInt32BE(16) === 512 && mark.readUInt32BE(20) === 512, "favicon mark is 512×512");
check(mark[25] === 6, "favicon mark has a true alpha channel");

const listeningAudio = await stat(join(root, "assets/listening-science-club.mp3"));
check(listeningAudio.size > 50_000, "packaged listening audio has a plausible production size");

for (const path of ["package.json", "vercel.json"]) {
  try {
    JSON.parse(await read(path));
    passes.push(`${path} is valid JSON`);
  } catch (error) {
    failures.push(`${path} is invalid JSON: ${error.message}`);
  }
}

for (const [, , path] of pageFiles) {
  const url = `https://sufeiya.cn${path}`;
  check(sitemap.includes(`<loc>${url}</loc>`), `sitemap includes ${url}`);
}

check((notFound.match(/<h1\b/gi) || []).length === 1, "404 page has one h1");
check(!/favicon\.svg/.test(notFound), "404 page does not use the retired favicon");
check(
  proxy.includes('"/((?!_next/static|_next/image|_next/webpack-hmr).*)"'),
  "Clerk middleware covers public assets and missing dotted paths",
);
check(
  !/jpe\?g\|webp\|png\|gif\|svg|webmanifest\|mp3/.test(proxy),
  "Clerk middleware does not exclude public-file extensions that can fall through to the shared 404 shell",
);

const logoStats = await stat(join(root, "assets/sufeiya-logo.png"));
check(logoStats.size > 100_000 && logoStats.size < 2_000_000, "HD logo has a plausible production size");

process.stdout.write(`Verified ${passes.length} checks.\n`);
if (failures.length) {
  process.stderr.write(`FAILED (${failures.length}):\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}
process.stdout.write("PASS: Sufeiya multi-page site checks completed without errors.\n");
