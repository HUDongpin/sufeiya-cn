import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const passes = [];
const pageFiles = [
  ["index.html", "home", "/"],
  ["workspace.html", "workspace", "/workspace"],
  ["diagnostic.html", "diagnostic", "/diagnostic"],
  ["plan.html", "plan", "/plan"],
  ["today.html", "today", "/today"],
  ["recommendations.html", "recommendations", "/recommendations"],
  ["practice.html", "practice", "/practice"],
  ["practice-reading.html", "practice-reading", "/practice-reading"],
  ["practice-listening.html", "practice-listening", "/practice-listening"],
  ["practice-writing.html", "practice-writing", "/practice-writing"],
  ["practice-speaking.html", "practice-speaking", "/practice-speaking"],
  ["focus.html", "focus", "/focus"],
  ["check-in.html", "check-in", "/check-in"],
  ["review.html", "review", "/review"],
  ["community.html", "community", "/community"],
  ["retest.html", "retest", "/retest"],
  ["my-data.html", "my-data", "/my-data"],
  ["learning-path.html", "learning-path", "/learning-path"],
  ["platform.html", "platform", "/platform"],
  ["resources.html", "resources", "/resources"],
  ["about.html", "about", "/about"],
];
const expectedNavTargets = ["/learning-path", "/platform", "/resources", "/about"];
const nextOnlyTargets = new Map([["/super-teacher", "app/super-teacher/page.tsx"]]);

const check = (condition, message) => {
  if (condition) passes.push(message);
  else failures.push(message);
};

const read = (path) => readFile(join(root, path), "utf8");
const styles = await read("styles.css");
const script = await read("script.js");
const workspaceScript = await read("workspace.js");
const journeyScript = await read("journey.js");
const resourcesScript = await read("resources.js");
const notFound = await read("404.html");
const sitemap = await read("sitemap.xml");
const rootLayout = await read("app/layout.tsx");
const siteShell = await read("components/site-shell.tsx");
const authPage = await read("components/auth-page.tsx");
const accountPage = await read("app/account/[[...account]]/page.tsx");
const signInPage = await read("app/sign-in/[[...sign-in]]/page.tsx");
const signUpPage = await read("app/sign-up/[[...sign-up]]/page.tsx");
const proxyScript = await read("proxy.ts");
const superTeacherPage = await read("app/super-teacher/page.tsx");
const superTeacherClient = await read("components/super-teacher-client.tsx");
const superTeacherRoute = await read("app/api/super-teacher/route.ts");
const superTeacherResponder = await read("lib/super-teacher/responder.ts");

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
    const cleanUrl = url.split("#")[0].split("?")[0];
    const path = nextOnlyTargets.get(cleanUrl) ?? resolveLocalPath(url);
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
check(!/\b(innerHTML|eval\s*\()/.test(journeyScript), "journey script avoids unsafe DOM injection and eval");
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
const journeyTargets = [...workspace.matchAll(/class="journey-grid"[\s\S]*?<\/ol>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(journeyTargets) ===
    JSON.stringify(["/diagnostic", "/plan", "/recommendations", "/check-in", "/review", "/community", "/retest"]),
  "workspace has seven ordered journey buttons targeting seven functions",
);
const workspaceToolTargets = [...workspace.matchAll(/class="workspace-launch-grid workspace-support-grid"[\s\S]*?<\/div>/g)]
  .flatMap((match) => [...match[0].matchAll(/href="([^"]+)"/g)].map((link) => link[1]));
check(
  JSON.stringify(workspaceToolTargets) === JSON.stringify(["/super-teacher", "/today", "/practice", "/focus", "/my-data"]),
  "workspace keeps Super Teacher and four supporting tools separate from the journey",
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
check(/id="diagnostic-form"[\s\S]*adultConfirmed/.test(await read("diagnostic.html")), "diagnostic page requires an explicit adult demo declaration");
check(/data-recommendation-items[\s\S]*data-accept-recommendation[\s\S]*data-skip-recommendation/.test(await read("recommendations.html")), "recommendation page supports accept and explicit skip states");
check(/data-today-tasks/.test(await read("today.html")), "today page contains a directly usable task list");
check(/lang="en"[\s\S]*name="reading-answer"/.test(await read("practice-reading.html")), "reading material is marked as English");
check(/<audio controls preload="metadata"[\s\S]*name="listening-answer"/.test(await read("practice-listening.html")), "listening page includes packaged audio and a question");
check(/textarea[^>]*lang="en"[\s\S]*data-complete-writing/.test(await read("practice-writing.html")), "writing page includes an English response field and completion control");
check(/data-speaking-time[\s\S]*data-speaking-review/.test(await read("practice-speaking.html")), "speaking page includes prepare/speak timing and self-review");
check(/data-focus-time[\s\S]*data-focus-stop/.test(await read("focus.html")), "focus page includes start, pause, stop, and reset-capable controls");
check(/name="didText"[\s\S]*name="evidenceText"[\s\S]*name="questionStatus"/.test(await read("check-in.html")), "check-in page collects action, evidence, and question state");
check(/data-checkin-receipt[\s\S]*data-checkin-id[\s\S]*data-checkin-plan-id/.test(await read("check-in.html")), "check-in page exposes check_in_id and plan_id receipts");
check(/id="review-form"[\s\S]*name="learnerConfirmed"[\s\S]*data-review-id/.test(await read("review.html")), "review page requires a distinct learner confirmation and review_id");
check(/value="used"[\s\S]*value="declined"[\s\S]*value="not_needed"[\s\S]*value="unavailable"/.test(await read("community.html")), "community page exposes all four valid voluntary states");
check(/data-retest-panel="Reading"[\s\S]*data-retest-panel="Listening"[\s\S]*data-retest-panel="Writing"[\s\S]*data-retest-panel="Speaking"/.test(await read("retest.html")), "retest page contains four original parallel task modes");
check(/data-retest-id[\s\S]*data-updated-plan-id[\s\S]*data-superseded-plan-id/.test(await read("retest.html")), "retest page exposes retest and updated-plan chain receipts");
check(/data-export-workspace[\s\S]*data-clear-workspace[\s\S]*data-clear-super-teacher[\s\S]*data-clear-all-sufeiya/.test(await read("my-data.html")), "data page supports all-data export and separately scoped clearing");
check(/sufeiya_workspace_v1/.test(workspaceScript), "workspace uses one versioned local-storage namespace");
check(/sufeiya_workspace_v1/.test(journeyScript), "journey shares the versioned workspace namespace");
check(/localStorage\.removeItem\(STORAGE_KEY\)/.test(workspaceScript), "clear action only removes the Sufeiya workspace namespace");
check(/SUPER_TEACHER_STORAGE_KEY = "sufeiya_super_teacher_v1"/.test(workspaceScript), "data controls include the versioned Super Teacher namespace");
check(/exportProtocol:\s*"sufeiya_local_export_v1"[\s\S]*SUPER_TEACHER_STORAGE_KEY/.test(workspaceScript), "JSON export contains both local Sufeiya namespaces");
check(/data-clear-super-teacher[\s\S]*removeItem\(SUPER_TEACHER_STORAGE_KEY\)[\s\S]*data-clear-all-sufeiya/.test(workspaceScript), "Super Teacher and all-data clearing are independently implemented");
check(/endsAt[\s\S]*Date\.now\(\)/.test(workspaceScript), "focus timer uses an absolute end time for background and reload recovery");
check(/Number\.isFinite\(storedRemaining\)/.test(workspaceScript), "focus timer preserves a completed zero-second value");
check(/hasValidPlanShape\(value\.plan\)/.test(workspaceScript), "stored plans are shape-checked before rendering");
check(!/(?:0\s*[–-]\s*100|10\s*[–-]\s*160|官方估分|预测分数)/.test(workspaceScript), "workspace does not generate score ranges or official predictions");
check(/activeCycle[\s\S]*cycleId[\s\S]*basePlanId/.test(journeyScript), "journey binds all stages to one active cycle and base plan");
check(/effective|previousComplete/.test(journeyScript), "journey completion is sequential rather than seven independent booleans");
check(/recommendationId[\s\S]*checkInId[\s\S]*reviewId[\s\S]*peerHelpId[\s\S]*retestId[\s\S]*updatedPlanId/.test(journeyScript), "journey implements the complete event-ID chain");
check(/const PROTOCOL_VERSION = "gate_a_local_v1"/.test(journeyScript), "journey names one exact Gate A protocol version");
check(/value\.journey\.protocolVersion !== PROTOCOL_VERSION[\s\S]*activeCycle\.protocolVersion !== PROTOCOL_VERSION/.test(journeyScript), "journey rejects missing, empty, or unknown stored protocol versions");
check(/#diagnostic-form, #review-form, #community-form/.test(journeyScript), "journey read-only mode also disables learner review confirmation");
check((journeyScript.match(/validateCycleEvidence\(\)/g) || []).length >= 4, "retest, plan update, and dashboard share one cycle-chain validator");
check(/chain\.retestEvidenceComplete[\s\S]*state\.plan\?\.planId === cycle\.basePlanId/.test(journeyScript), "plan update requires the full retest chain and exact active base plan");
check(/stateBeforeUpdate[\s\S]*state = stateBeforeUpdate/.test(journeyScript), "failed updated-plan persistence restores the pre-submit in-memory state");
check(/isSafeLocalRoute\(task\.route\)/.test(journeyScript) && /isSafeLocalRoute\(task\.route\)/.test(workspaceScript), "stored plan links are restricted to safe same-site routes");
check(/previousConfirmed && sameScope && !contentChanged[\s\S]*原确认、复盘与后续证据保持有效/.test(workspaceScript), "unchanged confirmed check-ins preserve their review and downstream evidence");
check(/previousConfirmed && !contentChanged[\s\S]*内容与已确认版本一致[\s\S]*return/.test(workspaceScript), "autosave also preserves a confirmed check-in when the final content is unchanged");
check(/replacesConfirmedVersion[\s\S]*learner_revision_after_confirmation[\s\S]*sameScope && !replacesConfirmedVersion/.test(workspaceScript), "edited confirmed check-ins are archived and receive a new evidence ID even before autosave");
check(/chain\.checkInComplete[\s\S]*latestChain\.checkInComplete/.test(journeyScript), "review rendering and submission share the central check-in evidence gate");
check(/chain\.reviewComplete[\s\S]*latestChain\.reviewComplete/.test(journeyScript), "community rendering and submission share the central review evidence gate");
check(/VALID_PEER_HELP_STATES[\s\S]*used[\s\S]*declined[\s\S]*not_needed[\s\S]*unavailable/.test(journeyScript), "journey accepts every approved peer-help terminal state");
check(/officialEquivalenceClaimed:\s*false[\s\S]*growthClaimProduced:\s*false/.test(journeyScript), "parallel retest stores no-equivalence and no-growth guards");
check(/learnerConfirmed:\s*true[\s\S]*supersedesPlanId:\s*cycle\.basePlanId/.test(journeyScript), "updated plan requires learner confirmation and supersedes the exact base plan");
check(!/getUserMedia|MediaRecorder/.test(journeyScript), "journey does not request or record microphone data");
check(!/(?:10\s*[–-]\s*160|官方估分|预测分数|真正\s*CAT)/.test(journeyScript), "journey does not generate official score or CAT claims");
check(!/@clerk\//.test(`${rootLayout}\n${siteShell}\n${authPage}\n${accountPage}\n${signInPage}\n${signUpPage}\n${proxyScript}`), "Gate A application runtime has no Clerk imports");
check(/免登录 · 本机保存/.test(siteShell), "Next.js shell exposes the local-only learner mode");
check(/账户功能后续开放/.test(accountPage), "account route explains the deferred account boundary");
check(/不需要登录或注册/.test(signInPage) && /免注册、本机保存模式/.test(signUpPage), "sign-in and sign-up routes route learners into the local-only flow");
check(/X-Sufeiya-Account-Mode[\s\S]*local-only/.test(proxyScript), "application responses identify the local-only account mode");
check(/connect-src 'self'/.test(proxyScript) && !/clerk|stripe/i.test(proxyScript), "Gate A CSP has no Clerk or Stripe runtime origins");
check(/苏肥鸭超级智能老师/.test(superTeacherPage), "Super Teacher has a dedicated Next.js application page");
check(/历史对话不发送给模型/.test(superTeacherClient) && !/history,/.test(superTeacherClient), "Super Teacher discloses and enforces no model history forwarding");
check(/isSameOrigin[\s\S]*MAX_BODY_BYTES[\s\S]*checkSuperTeacherRateLimit/.test(superTeacherRoute), "Super Teacher API applies origin, body-size, and rate-limit gates");
check(/Output\.object[\s\S]*modelTeacherOutputSchema[\s\S]*outputIsSafe/.test(superTeacherResponder), "Super Teacher model output is structured and source-ID checked");
check(/manualAnswer[\s\S]*tryModelAnswer[\s\S]*fallback/.test(superTeacherResponder), "Super Teacher has a deterministic grounded fallback");
check(/SUFEIYA_AI_ENABLED !== "true"/.test(superTeacherResponder), "model generation is fail-closed and requires an explicit release switch");
check(/不是苏肥鸭老师本人/.test(superTeacherClient) && /不是.*官方评分员/.test(superTeacherClient), "Super Teacher visibly discloses that it is neither the human teacher nor an official scorer");
check(/position:\s*absolute;[\s\S]*top:\s*100%;[\s\S]*100dvh/.test(styles), "mobile navigation escapes the sticky backdrop fixed-position trap");
check(/\.footer-nav a\s*\{[\s\S]*min-height:\s*44px/.test(styles), "mobile footer links meet the 44px touch target");

const resourcesData = JSON.parse(await read("data/resources.json"));
check(resourcesData.length === 16, "public resource catalog contains 16 reviewed metadata entries");
check(new Set(resourcesData.map((item) => item.id)).size === resourcesData.length, "resource catalog IDs are unique");
check(resourcesData.every((item) => /^https:\/\/(www\.)?bilibili\.com\/video\//.test(item.url)), "resource catalog links only to Bilibili video pages");
check(resourcesData.every((item) => Array.isArray(item.skills) && item.skills.length > 0), "every resource entry has at least one skill tag");

const superTeacherSources = JSON.parse(await read("data/super-teacher-source-register.json"));
check(superTeacherSources.claimSources.length === 10, "Super Teacher admits exactly 10 first-party Gate A claim sources");
check(superTeacherSources.linkOnlyResources.length === 5, "Super Teacher exposes exactly five link-only resource entries");
check(superTeacherSources.blockedFamilies.some((family) => family.id === "archive-det-official-rules" && family.recordCount === 24), "DET official index remains explicitly blocked");
check(superTeacherSources.blockedFamilies.some((family) => family.id === "archive-knowledge-base-preview" && family.recordCount === 631), "631 archive preview chunks remain explicitly blocked");

const logo = await readFile(join(root, "assets/sufeiya-logo.png"));
check(logo.toString("ascii", 1, 4) === "PNG", "HD logo is PNG");
check(logo.readUInt32BE(16) === 2792 && logo.readUInt32BE(20) === 560, "HD logo is 2792×560");
check(logo[25] === 6, "HD logo has a true alpha channel");

const mark = await readFile(join(root, "assets/sufeiya-mark.png"));
check(mark.readUInt32BE(16) === 512 && mark.readUInt32BE(20) === 512, "favicon mark is 512×512");
check(mark[25] === 6, "favicon mark has a true alpha channel");

const listeningAudio = await stat(join(root, "assets/listening-science-club.mp3"));
check(listeningAudio.size > 50_000, "packaged listening audio has a plausible production size");
const retestListeningAudio = await stat(join(root, "assets/listening-writing-center.mp3"));
check(retestListeningAudio.size > 50_000, "parallel retest listening audio has a plausible production size");
const publicJourney = await stat(join(root, "public/journey.js"));
check(publicJourney.size > 20_000, "Next.js public build includes the journey runtime");

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

const logoStats = await stat(join(root, "assets/sufeiya-logo.png"));
check(logoStats.size > 100_000 && logoStats.size < 2_000_000, "HD logo has a plausible production size");

process.stdout.write(`Verified ${passes.length} checks.\n`);
if (failures.length) {
  process.stderr.write(`FAILED (${failures.length}):\n- ${failures.join("\n- ")}\n`);
  process.exit(1);
}
process.stdout.write("PASS: Sufeiya multi-page site checks completed without errors.\n");
