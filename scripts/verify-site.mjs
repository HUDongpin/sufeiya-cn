import { createHash } from "node:crypto";
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
const nextOverrides = await read("app/next-overrides.css");
const script = await read("script.js");
const workspaceScript = await read("workspace.js");
const journeyScript = await read("journey.js");
const publicWorkspaceScript = await read("public/workspace.js");
const publicJourneyScript = await read("public/journey.js");
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
const superTeacherContracts = await read("lib/super-teacher/contracts.ts");
const superTeacherLocalContext = await read("lib/super-teacher/local-context.ts");
const superTeacherPolicy = await read("lib/super-teacher/policy.ts");
const legacyContent = await read("lib/legacy-content.generated.ts");
const diagnosticPage = await read("diagnostic.html");
const diagnosticTaskRegister = JSON.parse(await read("data/diagnostic-task-register.json"));

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceSection = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
};

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
check(/id="diagnostic-start-form"[\s\S]*name="adultConfirmed"/.test(diagnosticPage), "diagnostic page requires an explicit 18+ demo declaration");
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
check(
  /#diagnostic-start-form, #diagnostic-priority-form, #review-form, #community-form/.test(journeyScript),
  "journey read-only mode also disables diagnostic and learner review confirmation",
);
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

const expectedDiagnosticSkills = ["Reading", "Reading", "Listening", "Listening", "Speaking", "Writing"];
const expectedDiagnosticTaskIds = [
  "diagnostic-reading-library-v1",
  "diagnostic-reading-newsletter-v1",
  "diagnostic-listening-science-club-v1",
  "diagnostic-listening-language-lab-v1",
  "diagnostic-speaking-learning-skill-v1",
  "diagnostic-writing-learning-place-v1",
];
const diagnosticTasks = Array.isArray(diagnosticTaskRegister.tasks) ? diagnosticTaskRegister.tasks : [];
const diagnosticManifest = diagnosticTasks.map(({ taskId, taskVersion, skill, responseType, constructTag, contentHash }) => ({
  taskId,
  taskVersion,
  skill,
  responseType,
  constructTag,
  contentHash,
}));
const expectedDiagnosticTaskSetDigest = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
check(
  diagnosticTaskRegister.protocolVersion === "sufeiya_diagnostic_task_register_v1",
  "diagnostic task register uses the exact canonical register protocol",
);
check(
  diagnosticTaskRegister.taskSetId === "gate-a-original-evidence-pack" &&
    diagnosticTaskRegister.taskSetVersion === "gate_a_original_6_v1" &&
    diagnosticTaskRegister.taskSetDigest === expectedDiagnosticTaskSetDigest &&
    diagnosticTaskRegister.taskSetDigest === sha256(JSON.stringify(diagnosticManifest)),
  "diagnostic task register identifies the exact Gate A six-task set and manifest digest",
);
check(
  diagnosticTaskRegister.releaseStatus === "gate_a_demo_only" &&
    diagnosticTaskRegister.scopeConfirmationStatus === "owner_confirmed" &&
    diagnosticTaskRegister.teacherReviewed === false &&
    diagnosticTaskRegister.measurementReviewed === false,
  "diagnostic task register is owner-scoped but remains an unreviewed Gate A demo rather than a formal assessment",
);
check(
  diagnosticTaskRegister.ragEligibility === "blocked" &&
    diagnosticTaskRegister.rightsStatus?.rag === "denied" &&
    diagnosticTaskRegister.rightsStatus?.cache === "pending" &&
    diagnosticTaskRegister.rightsStatus?.republish === "pending",
  "diagnostic task-set rights remain pending and blocked from RAG admission",
);
check(diagnosticTasks.length === 6, "diagnostic task register contains exactly six tasks");
check(
  JSON.stringify(diagnosticTasks.map((task) => task.order)) === JSON.stringify([1, 2, 3, 4, 5, 6]),
  "diagnostic task register has one contiguous six-task order",
);
check(
  JSON.stringify(diagnosticTasks.map((task) => task.skill)) === JSON.stringify(expectedDiagnosticSkills),
  "diagnostic task order is two Reading, two Listening, Speaking, then Writing",
);
check(
  JSON.stringify(diagnosticTasks.map((task) => task.taskId)) === JSON.stringify(expectedDiagnosticTaskIds) &&
    new Set(diagnosticTasks.map((task) => task.taskId)).size === diagnosticTasks.length,
  "diagnostic task register uses the exact six unique canonical task IDs",
);
check(
  diagnosticTasks.every(
    (task) =>
      typeof task.contentHash === "string" &&
      /^[a-f0-9]{64}$/.test(task.contentHash) &&
      task.contentHash === sha256(JSON.stringify(task.content)),
  ),
  "every diagnostic task content SHA-256 matches its canonical content object",
);
check(
  diagnosticTasks.every(
    (task) =>
      task.contentOriginClass === "first_party_original_task" &&
      task.sourceClass === "owner_confirmed_scope" &&
      task.claimVerificationStatus === "unverified" &&
      task.reviewStatus === "unreviewed",
  ),
  "every diagnostic task is owner-confirmed first-party original scope with unverified claims",
);
check(
  diagnosticTasks.every(
    (task) =>
      task.rightsStatus?.cache === "pending" &&
      task.rightsStatus?.republish === "pending" &&
      task.rightsStatus?.rag === "denied" &&
      (task.skill === "Listening" ? task.rightsStatus?.transcribe === "pending" : task.rightsStatus?.transcribe === "not_applicable") &&
      task.ragEligibility === "blocked",
  ),
  "every diagnostic task preserves pending cache, republish, and applicable transcription rights",
);

const renderedDiagnosticTasks = [...diagnosticPage.matchAll(
  /data-diagnostic-task data-task-id="([^"]+)"[^>]*data-task-order="(\d+)"[^>]*data-task-skill="([^"]+)"[^>]*data-content-hash="([a-f0-9]{64})"/g,
)].map((match) => ({ taskId: match[1], order: Number(match[2]), skill: match[3], contentHash: match[4] }));
const diagnosticReportSource = sourceSection(journeyScript, "const buildDiagnosticReport", "let diagnosticTimerId");
const diagnosticObjectiveSubmitSource = sourceSection(
  journeyScript,
  'panel.querySelector("[data-diagnostic-submit-task]")?.addEventListener',
  'panel.querySelectorAll("[data-diagnostic-skip-task]")',
);
const diagnosticStaticAudioSource = sourceSection(
  journeyScript,
  'const audio = panel.querySelector("[data-diagnostic-audio]")',
  'panel.querySelector("[data-diagnostic-speech-play]")?.addEventListener',
);
const diagnosticSpeechSource = sourceSection(
  journeyScript,
  'panel.querySelector("[data-diagnostic-speech-play]")?.addEventListener',
  'panel.querySelector("[data-diagnostic-transcript]")?.addEventListener',
);
const diagnosticCompleteTaskSource = sourceSection(
  journeyScript,
  "const completeDiagnosticTask",
  "const syncDiagnosticTimer",
);
const diagnosticWritingBeforeInputSource = sourceSection(
  journeyScript,
  'writingInput?.addEventListener("beforeinput"',
  'panel.querySelector("[data-writing-finish]")',
);
const renderDiagnosticSource = sourceSection(journeyScript, "const renderDiagnostic =", "const refreshDiagnosticVoices");
check(
  diagnosticPage.includes(
    `data-diagnostic-app data-task-set-version="gate_a_original_6_v1" data-task-set-digest="${expectedDiagnosticTaskSetDigest}"`,
  ),
  "diagnostic page declares the exact Gate A task-set version and digest",
);
check(
  JSON.stringify(renderedDiagnosticTasks) ===
    JSON.stringify(
      diagnosticTasks.map((task) => ({
        taskId: task.taskId,
        order: task.order,
        skill: task.skill,
        contentHash: task.contentHash,
      })),
    ),
  "diagnostic page renders all six registered tasks, hashes, and canonical order",
);
check(
  /仅限 18\+ 演示/.test(diagnosticPage) &&
    /name="adultConfirmed"/.test(diagnosticPage) &&
    /name="localBoundaryConfirmed"/.test(diagnosticPage) &&
    /name="noScoreConfirmed"/.test(diagnosticPage) &&
    /name="environmentConfirmed"/.test(diagnosticPage),
  "diagnostic page requires 18+, local-only, no-score, and environment confirmations",
);
check(
  /data-device-storage[\s\S]*data-device-mp3[\s\S]*data-device-speech[\s\S]*data-device-lock[\s\S]*data-device-viewport[\s\S]*data-device-network/.test(
    diagnosticPage,
  ) && /data-audio-test/.test(diagnosticPage) && /name="keyboardCheck"/.test(diagnosticPage),
  "diagnostic page provides storage, audio, speech, safe-write-lock, viewport, network, keyboard, and sound-output preflight",
);
check(
  /const safeWriteLockSupported = Boolean\(navigator\.locks\?\.request\)/.test(journeyScript) &&
    /setText\("\[data-device-lock\]", safeWriteLockSupported \? "支持 · 防跨页覆盖" : "不支持 · 无法开始闭环"\)/.test(
      journeyScript,
    ) &&
    /if \(!safeWriteLockSupported\) \{[\s\S]*不支持安全本机写入锁[\s\S]*return;/.test(journeyScript),
  "diagnostic preflight exposes Web Locks capability before blocking an unsafe diagnostic start",
);
check(
  (diagnosticPage.match(/data-diagnostic-submit-task/g) || []).length === 4 &&
    (diagnosticPage.match(/封存第一次选择/g) || []).length === 4 &&
    /firstResponse:\s*selected\.value[\s\S]*attempts:\s*1/.test(journeyScript),
  "four objective diagnostic tasks seal exactly one first response",
);
check(
  /const before = snapshotState\(\)[\s\S]*replaceDiagnosticEvidence\(diagnostic, evidence\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*renderDiagnostic\(\);[\s\S]*return false;/.test(
    diagnosticCompleteTaskSource,
  ) &&
    /firstResponse:\s*selected\.value[\s\S]*attempts:\s*1[\s\S]*completeDiagnosticTask\(diagnostic, next\)/.test(
      diagnosticObjectiveSubmitSource,
    ),
  "a failed first-response persist restores the complete pre-submit diagnostic state",
);
check(
  /data-prep-seconds="20"[^>]*data-response-seconds="90"/.test(diagnosticPage) &&
    /data-task-skill="Writing"[^>]*data-response-seconds="180"/.test(diagnosticPage),
  "diagnostic page exposes the approved 90-second Speaking and 180-second Writing timers",
);
check(
  (diagnosticPage.match(/data-diagnostic-transcript>/g) || []).length === 2 &&
    /transcript_used/.test(journeyScript) &&
    /audio_not_completed/.test(journeyScript) &&
    /audio_playback_failed/.test(journeyScript) &&
    /task_unavailable/.test(journeyScript) &&
    /resumed_after_reload/.test(journeyScript) &&
    /open_response_not_human_reviewed/.test(journeyScript),
  "diagnostic flow records text-alternative, playback, availability, reload, and human-review quality flags",
);
check(
  /DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1"/.test(journeyScript) &&
    new RegExp(`DIAGNOSTIC_TASK_SET_DIGEST = "${expectedDiagnosticTaskSetDigest}"`).test(journeyScript) &&
    /diagnostic\?\.taskSetVersion === DIAGNOSTIC_TASK_SET_VERSION/.test(journeyScript) &&
    /diagnostic\?\.taskSetDigest === DIAGNOSTIC_TASK_SET_DIGEST/.test(journeyScript) &&
    /contentHash:\s*panel\.dataset\.contentHash/.test(journeyScript) &&
    /Object\.entries\(expected\)\.every\(\(\[key, value\]\) => evidence\[key\] === value\)/.test(journeyScript) &&
    /automatedScoreProduced:\s*false[\s\S]*formalDiagnosisProduced:\s*false/.test(journeyScript),
  "journey binds runtime evidence to the task-set digest and per-task content hash without scoring",
);
check(
  /current\.audioPlayed && !current\.audioCompleted/.test(diagnosticObjectiveSubmitSource) &&
    /"audio_not_completed"/.test(diagnosticObjectiveSubmitSource) &&
    /current\.audioSeekDetected/.test(diagnosticObjectiveSubmitSource) &&
    /"audio_seek_detected"/.test(diagnosticObjectiveSubmitSource) &&
    /audio_not_completed/.test(diagnosticReportSource) &&
    /audio_seek_detected/.test(diagnosticReportSource) &&
    /audio\?\.addEventListener\("play"/.test(diagnosticStaticAudioSource) &&
    /audioCompleted:\s*false/.test(diagnosticStaticAudioSource) &&
    /audioStartedNearBeginning:[\s\S]*audio\.currentTime <= 0\.25/.test(diagnosticStaticAudioSource) &&
    /audio\?\.addEventListener\("seeking"/.test(diagnosticStaticAudioSource) &&
    /audioSeekDetected:\s*true/.test(diagnosticStaticAudioSource) &&
    /audio\?\.addEventListener\("ended"/.test(diagnosticStaticAudioSource) &&
    /completePlayback = current\.audioStartedNearBeginning === true && current\.audioSeekDetected !== true/.test(
      diagnosticStaticAudioSource,
    ) &&
    /audioCompleted:\s*completePlayback/.test(diagnosticStaticAudioSource),
  "Listening is interpretable only after an uninterrupted static-audio ended event from the beginning",
);
check(
  /utterance\.addEventListener\("start"/.test(diagnosticSpeechSource) &&
    /speechSynthesisStarted:\s*true/.test(diagnosticSpeechSource) &&
    /utterance\.addEventListener\("end"/.test(diagnosticSpeechSource) &&
    /audioCompleted:\s*true/.test(diagnosticSpeechSource) &&
    /utterance\.addEventListener\("error"/.test(diagnosticSpeechSource) &&
    /speech_synthesis_error/.test(diagnosticSpeechSource) &&
    /browser_voice_variability/.test(diagnosticSpeechSource) &&
    /voice_not_loaded/.test(diagnosticSpeechSource) &&
    /voice_fallback_used/.test(diagnosticSpeechSource),
  "browser-synthesized Listening handles start, end, error, and device-voice quality flags",
);
check(
  /writing\?\.timerCompleted === true/.test(diagnosticReportSource) &&
    /!writing\?\.qualityFlags\?\.includes\("writing_paste_detected"\)/.test(diagnosticReportSource) &&
    /writing\?\.timerCompleted !== true/.test(diagnosticReportSource) &&
    /writing\?\.qualityFlags\?\.includes\("writing_paste_detected"\)/.test(diagnosticReportSource) &&
    /addEventListener\("paste", markWritingExternalInsert\)/.test(journeyScript) &&
    /addEventListener\("drop", markWritingExternalInsert\)/.test(journeyScript) &&
    /\["insertFromPaste", "insertFromDrop"\]\.includes\(event\.inputType\)/.test(diagnosticWritingBeforeInputSource) &&
    !/insertReplacementText/.test(diagnosticWritingBeforeInputSource),
  "Writing requires a completed timer, flags explicit paste or drop, and does not misclassify replacement text",
);
check(
  /aria-labelledby="diagnostic-task-title-1"/.test(diagnosticPage) &&
    (diagnosticPage.match(/<h3 id="diagnostic-task-title-\d" tabindex="-1"/g) || []).length === 6 &&
    /setAttribute\("aria-current", "step"\)/.test(renderDiagnosticSource) &&
    /任务 \$\{activeIndex \+ 1\} \/ \$\{DIAGNOSTIC_TASK_IDS\.length\}/.test(renderDiagnosticSource) &&
    /focusDiagnosticTarget\(document\.querySelector\("\[data-diagnostic-task\]:not\(\[hidden\]\) h3"\)\)/.test(journeyScript),
  "diagnostic task transitions expose labelled headings, current-step semantics, progress, and keyboard focus",
);
check(
  /\.diagnostic-task-card audio\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/.test(styles) &&
    /@media \(max-width:\s*560px\)[\s\S]*?\.diagnostic-audio-check\s*\{[\s\S]*?grid-template-columns:\s*1fr;/.test(styles),
  "diagnostic audio stays within the task card and the audio preflight stacks on narrow screens",
);
check(
  /body\s*\{[\s\S]*?min-width:\s*0;/.test(styles) &&
    /@media \(max-width:\s*1080px\)\s*\{[\s\S]*?\.header-inner\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/.test(
      nextOverrides,
    ) &&
    /@media \(max-width:\s*1080px\)[\s\S]*?\.desktop-nav,\s*\.header-actions\s*\{[\s\S]*?display:\s*none;/.test(
      nextOverrides,
    ) &&
    /@media \(max-width:\s*560px\)[\s\S]*?\.header-inner,[\s\S]*?width:\s*calc\(100% - 32px\);[\s\S]*?\.brand img\s*\{[\s\S]*?width:\s*164px;[\s\S]*?\.nav-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(
      styles,
    ),
  "Next shell preserves the responsive header grid without forcing horizontal overflow",
);
check(
  /数据只保存在当前浏览器，不上传/.test(diagnosticPage) &&
    /不请求麦克风，也不上传自由文本/.test(diagnosticPage) &&
    /microphoneMode:\s*"not_requested"/.test(journeyScript) &&
    !/\bfetch\s*\(/.test(journeyScript) &&
    !/getUserMedia|MediaRecorder/.test(journeyScript),
  "diagnostic evidence stays local with no upload, microphone request, recording, or scoring path",
);

const completedDiagnosticCycleSource = sourceSection(workspaceScript, "const completedDiagnosticCycle", "const completedPlanChain");
const completedPlanChainSource = sourceSection(workspaceScript, "const completedPlanChain", "const completedRecommendationChain");
const completedRecommendationChainSource = sourceSection(workspaceScript, "const completedRecommendationChain", "const showStorageWarning");
const workspaceCheckInSubmitSource = sourceSection(
  workspaceScript,
  'checkinForm.addEventListener("submit"',
  "const updateDataPage",
);
const journeyValidationSource = sourceSection(journeyScript, "const validateCycleEvidence", "const diagnosticStatusLabels");
check(
  /diagnostic\.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST/.test(completedDiagnosticCycleSource) &&
    /diagnostic\.cycleId !== cycle\.cycleId/.test(completedDiagnosticCycleSource) &&
    /diagnostic\.diagnosticSessionId !== cycle\.diagnosticSessionId/.test(completedDiagnosticCycleSource) &&
    /!evidenceValid/.test(completedDiagnosticCycleSource),
  "plan eligibility requires the complete hashed diagnostic evidence from the active cycle",
);
check(
  /plan\.planId !== linked\.cycle\.basePlanId/.test(completedPlanChainSource) &&
    /plan\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.cycleId !== linked\.cycle\.cycleId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION/.test(completedPlanChainSource) &&
    /plan\.provenance\?\.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST/.test(completedPlanChainSource),
  "recommendation eligibility requires a plan bound to the complete same-cycle diagnostic manifest",
);
check(
  /recommendation\.recommendationId !== linked\.cycle\.recommendationId/.test(completedRecommendationChainSource) &&
    /recommendation\.cycleId !== linked\.cycle\.cycleId/.test(completedRecommendationChainSource) &&
    /recommendation\.diagnosticSessionId !== linked\.cycle\.diagnosticSessionId/.test(completedRecommendationChainSource) &&
    /recommendation\.planId !== linked\.cycle\.basePlanId/.test(completedRecommendationChainSource) &&
    /const linkedRecommendation = completedRecommendationChain\(\)/.test(workspaceCheckInSubmitSource) &&
    /diagnosticSessionId:\s*cycleEligible \? activeCycle\.diagnosticSessionId : null/.test(workspaceCheckInSubmitSource) &&
    /recommendationId,/.test(workspaceCheckInSubmitSource),
  "check-in eligibility requires the complete recommendation, plan, and diagnostic chain from one cycle",
);
check(
  /diagnosticComplete &&[\s\S]*basePlan\?\.planId === cycle\?\.basePlanId/.test(journeyValidationSource) &&
    /planComplete &&[\s\S]*recommendation\?\.cycleId === cycle\?\.cycleId/.test(journeyValidationSource) &&
    /recommendationComplete &&[\s\S]*checkIn\?\.cycleId === cycle\?\.cycleId/.test(journeyValidationSource) &&
    /basePlan\?\.provenance\?\.taskSetDigest === diagnostic\?\.taskSetDigest/.test(journeyValidationSource),
  "central journey validation gates plan, recommendation, and check-in sequentially on the same diagnostic cycle",
);
check(
  /checkIn\?\.diagnosticSessionId === cycle\?\.diagnosticSessionId/.test(journeyValidationSource) &&
    /peerHelp\?\.planId === cycle\?\.basePlanId/.test(journeyValidationSource) &&
    /updatedPlan\?\.focusSkill === planUpdate\?\.focusSkill/.test(journeyValidationSource),
  "central journey validation binds check-in session, peer-help plan, and updated-plan focus skill",
);

const workspaceWriterLeaseSource = sourceSection(
  workspaceScript,
  "const acquireSharedWorkspaceWriterLease",
  "const isRecord",
);
const journeyWriterLeaseSource = sourceSection(
  journeyScript,
  "const acquireSharedWorkspaceWriterLease",
  "const showStorageWarning",
);
check(
  workspaceWriterLeaseSource.trim() === journeyWriterLeaseSource.trim() &&
    /window\.__sufeiyaWorkspaceWriterLease/.test(workspaceWriterLeaseSource) &&
    /navigator\.locks\.request\(`\$\{STORAGE_KEY\}:page-writer`, \{ mode: "exclusive", ifAvailable: true \}/.test(
      workspaceWriterLeaseSource,
    ) &&
    /window\.addEventListener\("pagehide"[\s\S]*release\(\)/.test(workspaceWriterLeaseSource),
  "workspace and journey share one exclusive page-writer Web Lock lease until pagehide",
);
check(
  /const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease\(\);[\s\S]*if \(!workspaceWriterLeaseAvailable\) storageWritable = false;[\s\S]*loadState\(\);[\s\S]*另一个苏肥鸭页面正在编辑本机学习数据[\s\S]*disableWorkspaceControls\(\)/.test(
    workspaceScript,
  ) &&
    /const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease\(\);[\s\S]*if \(!workspaceWriterLeaseAvailable\) storageWritable = false;[\s\S]*loadState\(\);[\s\S]*另一个苏肥鸭页面正在编辑本机学习数据[\s\S]*disableJourneyControls\(\)/.test(
      journeyScript,
  ),
  "a second workspace writer tab becomes read-only before any page controls are initialized",
);
check(
  publicWorkspaceScript === workspaceScript && publicJourneyScript === journeyScript,
  "Next.js public workspace and journey runtimes exactly match their authoritative source files",
);

const communitySetupSource = sourceSection(journeyScript, "const setupCommunity", "const showRetestPanel");
check(
  /const downstreamSealed = Boolean\([\s\S]*cycle\.retestId[\s\S]*cycle\.updatedPlanId[\s\S]*state\.journey\.retest\?\.cycleId === cycle\.cycleId[\s\S]*state\.journey\.planUpdate\?\.cycleId === cycle\.cycleId/.test(
    communitySetupSource,
  ) &&
    /if \(downstreamSealed\) \{[\s\S]*control\.disabled = true;[\s\S]*互助状态已封存[\s\S]*return;/.test(
      communitySetupSource,
    ) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;/.test(communitySetupSource),
  "community freezes after a retest or updated plan and rolls back a failed save",
);

const recommendationSetupSource = sourceSection(journeyScript, "const setupRecommendations", "const peerHelpLabels");
const recommendationSeal = recommendationSetupSource.indexOf('return { status: "already_saved", record: previous }');
const recommendationCreate = recommendationSetupSource.indexOf('makeId("recommendation")');
check(
  recommendationSeal >= 0 &&
    recommendationCreate > recommendationSeal &&
    /withExclusiveJourneyWrite[\s\S]*persistedStateIsFresh\(\)/.test(recommendationSetupSource) &&
    /previous\?\.recommendationId === latestCycle\.recommendationId[\s\S]*previous\?\.cycleId === latestCycle\.cycleId[\s\S]*previous\?\.planId === latestCycle\.basePlanId/.test(
      recommendationSetupSource,
    ) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*status: "persist_failed"/.test(
      recommendationSetupSource,
    ),
  "the first same-cycle recommendation receipt is lock-sealed and failed persistence rolls back",
);
const retestSetupSource = sourceSection(journeyScript, "const setupRetest", "const journeyDefinitions");
const retestSeal = retestSetupSource.indexOf('return { status: "already_saved" }');
const retestCreate = retestSetupSource.indexOf('makeId("retest")');
check(
  /withExclusiveJourneyWrite[\s\S]*persistedStateIsFresh\(\)/.test(retestSetupSource) &&
    /const evidenceAlreadyRecorded = chain\.retestEvidenceComplete/.test(journeyScript) &&
    retestSeal >= 0 &&
    retestCreate > retestSeal &&
    /alreadyCompleted \|\| initialGate\.evidenceAlreadyRecorded[\s\S]*control\.disabled = true/.test(retestSetupSource) &&
    /const before = snapshotState\(\)[\s\S]*if \(!persist\(\)\) \{[\s\S]*state = before;[\s\S]*status: "persist_failed"/.test(
      retestSetupSource,
    ),
  "the first valid parallel-retest receipt is lock-sealed, disabled, and rollback-safe",
);
check(
  /navigator\.locks\?\.request/.test(journeyScript) &&
    /navigator\.locks\.request\(`\$\{STORAGE_KEY\}:sealed-write`, \{ mode: "exclusive" \}/.test(journeyScript) &&
    /latest\.updatedAt === state\.updatedAt/.test(journeyScript),
  "sealed journey receipts use an exclusive browser lock plus a fresh-state compare",
);

check(
  /diagnostic\.taskSetVersion !== TASK_SET_VERSION/.test(superTeacherLocalContext) &&
    /diagnostic\.taskSetDigest !== TASK_SET_DIGEST/.test(superTeacherLocalContext) &&
    /diagnostic\.cycleId !== cycle\.cycleId/.test(superTeacherLocalContext) &&
    /diagnostic\.diagnosticSessionId !== cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /diagnostic\.learnerConfirmedPriority !== true/.test(superTeacherLocalContext) &&
    /evidence\.length !== expectedIds\.length/.test(superTeacherLocalContext) &&
    /!evidence\.every\(validEvidence\)/.test(superTeacherLocalContext),
  "Super Teacher only opens from the current complete hashed diagnostic cycle",
);
const superTeacherContextConstructionSource = sourceSection(
  superTeacherLocalContext,
  "const context: LearnerContext",
  "const basePlan",
);
check(
  /completedEvidenceTaskCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(6\)/.test(superTeacherContracts) &&
    /summaryIntegrity:\s*z\.literal\("unsigned_device_summary"\)/.test(superTeacherContracts) &&
    /terminalEvidenceTaskCount:\s*z\.literal\(6\)/.test(superTeacherContracts) &&
    /taskSetDigest:\s*taskSetDigestSchema/.test(superTeacherContracts) &&
    /learnerContextSchema[\s\S]*?\.strict\(\)[\s\S]*?\.superRefine/.test(superTeacherContracts) &&
    !/taskEvidence|firstResponse|responseText/.test(superTeacherContextConstructionSource) &&
    /body:\s*JSON\.stringify\(\{[\s\S]*?protocolVersion:[\s\S]*?consent:\s*true,[\s\S]*?question:\s*trimmed,[\s\S]*?learnerContext:\s*currentContext,[\s\S]*?\}\)/.test(
      superTeacherClient,
    ),
  "Super Teacher derives and sends a strict minimal summary without raw diagnostic answers or writing",
);
check(
  /export const superTeacherResponseSchema = z[\s\S]*?safeLocalHrefSchema[\s\S]*?bilibiliHrefSchema[\s\S]*?sourceBoundary:[\s\S]*?\.strict\(\);/.test(
    superTeacherContracts,
  ) &&
    /const validatedAnswer = superTeacherResponseSchema\.safeParse\(answer\)/.test(superTeacherRoute) &&
    /Response\.json\(validatedAnswer\.data/.test(superTeacherRoute) &&
    /const validatedPayload = superTeacherResponseSchema\.safeParse\(payload\)/.test(superTeacherClient) &&
    /response:\s*validatedPayload\.data/.test(superTeacherClient),
  "Super Teacher validates the complete strict response schema on both server and client",
);
const superTeacherSubmitSource = sourceSection(superTeacherClient, "async function submitQuestion", "function choosePrompt");
check(
  /银行卡\|银行卡号\|支付账号/.test(superTeacherPolicy) &&
    /digits\.length >= 13 && digits\.length <= 25/.test(superTeacherPolicy) &&
    /if \(containsSensitiveData\(trimmed\)\)/.test(superTeacherSubmitSource) &&
    superTeacherSubmitSource.indexOf("containsSensitiveData(trimmed)") < superTeacherSubmitSource.indexOf("const userTurn") &&
    superTeacherSubmitSource.indexOf("containsSensitiveData(trimmed)") < superTeacherSubmitSource.indexOf('fetch("/api/super-teacher"'),
  "Super Teacher blocks bank-card and long payment-number patterns before local save or network send",
);
check(
  /basePlan\.provenance\.cycleId === cycle\.cycleId/.test(superTeacherLocalContext) &&
    /basePlan\.provenance\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /recommendation\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /checkIn\.recommendationId === cycle\.recommendationId/.test(superTeacherLocalContext) &&
    /retest\?\.diagnosticSessionId === cycle\.diagnosticSessionId/.test(superTeacherLocalContext) &&
    /updatedPlan\.provenance\.taskSetDigest === TASK_SET_DIGEST/.test(superTeacherLocalContext),
  "Super Teacher local context includes only plan and progress records proven to share the diagnostic cycle",
);
const superTeacherSessionReadSource = sourceSection(superTeacherClient, "function readSession", "function saveSession");
const superTeacherHydrationSource = sourceSection(
  superTeacherClient,
  "const frame = window.requestAnimationFrame",
  "const handleStorageChange",
);
check(
  /return \{ status: "corrupt", session: emptySession\(\) \}/.test(superTeacherSessionReadSource) &&
    /!Array\.isArray\(value\.turns\) \|\| !value\.turns\.every\(isStoredTurn\)/.test(superTeacherSessionReadSource) &&
    /setSessionReadIssue\(stored\.status\)/.test(superTeacherHydrationSource) &&
    !/saveSession\(/.test(superTeacherHydrationSource) &&
    /if \(sessionReadIssue\)/.test(superTeacherSubmitSource) &&
    /原记录不会被页面自动覆盖/.test(superTeacherClient),
  "corrupt or unsupported Super Teacher sessions stay read-only until explicit learner clearing",
);
const superTeacherCommitSource = sourceSection(superTeacherClient, "async function commitSession", "const contextSummary");
const superTeacherStorageSyncSource = sourceSection(
  superTeacherClient,
  "const handleStorageChange",
  "conversationEndRef.current",
);
check(
  /revision:\s*0/.test(superTeacherClient) &&
    /Number\.isSafeInteger\(revision\)/.test(superTeacherSessionReadSource) &&
    /event\.key === CHAT_KEY/.test(superTeacherStorageSyncSource) &&
    /setSessionReadIssue\("concurrent_change"\)/.test(superTeacherStorageSyncSource) &&
    /navigator\.locks\.request\(`\$\{CHAT_KEY\}:write`, \{ mode: "exclusive" \}/.test(superTeacherCommitSource) &&
    /const stored = readSession\(\)[\s\S]*!storedSessionMatches\(stored, sessionRef\.current\)/.test(superTeacherCommitSource) &&
    /revision:\s*sessionRef\.current\.revision \+ 1/.test(superTeacherCommitSource) &&
    superTeacherCommitSource.indexOf("saveSession(next)") < superTeacherCommitSource.indexOf("sessionRef.current = next"),
  "Super Teacher detects CHAT_KEY races and compare-locks revisioned writes before advancing UI state",
);
const superTeacherLockDisclosureIndex = superTeacherClient.indexOf("<li><span>安全写入</span>");
const superTeacherQuestionFormIndex = superTeacherClient.indexOf("<form", superTeacherLockDisclosureIndex);
check(
  /const \[safeWriteLockSupported, setSafeWriteLockSupported\] = useState\(false\)/.test(superTeacherClient) &&
    /const supportsSafeWriteLock = Boolean\(navigator\.locks\?\.request\)/.test(superTeacherClient) &&
    /浏览器写入锁可用，防止跨标签页覆盖[\s\S]*浏览器写入锁不可用，智能问答保持只读/.test(
      superTeacherClient,
    ) &&
    superTeacherLockDisclosureIndex >= 0 &&
    superTeacherQuestionFormIndex > superTeacherLockDisclosureIndex,
  "Super Teacher discloses Web Locks capability before the learner reaches question controls",
);
check(!/@clerk\//.test(`${rootLayout}\n${siteShell}\n${authPage}\n${accountPage}\n${signInPage}\n${signUpPage}\n${proxyScript}`), "Gate A application runtime has no Clerk imports");
check(/免登录 · 本机保存/.test(siteShell), "Next.js shell exposes the local-only learner mode");
check(/账户功能后续开放/.test(accountPage), "account route explains the deferred account boundary");
check(/不需要登录或注册/.test(signInPage) && /免注册、本机保存模式/.test(signUpPage), "sign-in and sign-up routes route learners into the local-only flow");
check(/X-Sufeiya-Account-Mode[\s\S]*local-only/.test(proxyScript), "application responses identify the local-only account mode");
check(/connect-src 'self'/.test(proxyScript) && !/clerk|stripe/i.test(proxyScript), "Gate A CSP has no Clerk or Stripe runtime origins");
check(/Sofia智能老师/.test(superTeacherPage), "Sofia AI Teacher has a dedicated Next.js application page");
check(/Sofia智能老师/.test(legacyContent), "generated Next.js legacy content uses the Sofia AI Teacher name");
check(!/苏肥鸭超级智能老师|超级智能老师|超级老师/.test(legacyContent), "generated Next.js legacy content has no retired teacher name");
check(/无需注册/.test(legacyContent) && /没有账号系统/.test(legacyContent), "generated Next.js legacy content preserves the local-only account boundary");
check(!/注册与登录已经开放|账户用于注册、登录/.test(legacyContent), "generated Next.js legacy content does not claim deferred account features are live");
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

const expectedDiagnosticAudioHashes = new Map([
  ["/assets/listening-science-club.mp3", "e79ff2075d1786074433c5e044763d0a407e8a0c02a635c52a054d758b37e850"],
]);
const staticDiagnosticListeningTasks = diagnosticTasks.filter(
  (task) => task.skill === "Listening" && task.content?.audioMode === "static_asset",
);
check(staticDiagnosticListeningTasks.length === 1, "diagnostic register declares exactly one packaged Listening asset");
for (const task of staticDiagnosticListeningTasks) {
  const audioPath = task.content?.audioPath;
  const expectedHash = expectedDiagnosticAudioHashes.get(audioPath);
  const receipt = task.audioAsset;
  check(
    typeof audioPath === "string" &&
      /^\/assets\/[a-z0-9-]+\.mp3$/.test(audioPath) &&
      Boolean(expectedHash) &&
      receipt?.path === audioPath &&
      receipt?.sha256 === expectedHash &&
      receipt?.bytes === 155_942 &&
      Math.abs(Number(receipt?.durationSeconds) - 9.659955) < 0.000001 &&
      receipt?.generationOrSpeaker === "existing_project_audio_generator_not_recorded" &&
      receipt?.rightsReviewStatus === "pending",
    `diagnostic Listening asset ${String(audioPath)} has the approved pending-rights metadata receipt`,
  );
  if (typeof audioPath === "string" && expectedHash) {
    try {
      const audio = await readFile(join(root, audioPath.replace(/^\/+/, "")));
      check(audio.length === receipt?.bytes, `diagnostic Listening asset ${audioPath} matches its registered byte count`);
      check(sha256(audio) === receipt?.sha256, `diagnostic Listening asset ${audioPath} matches its registered SHA-256`);
    } catch (error) {
      failures.push(`diagnostic Listening asset ${audioPath} is missing or unreadable: ${error.message}`);
    }
  }
}
const synthesizedDiagnosticListeningTask = diagnosticTasks.find(
  (task) => task.skill === "Listening" && task.content?.audioMode === "browser_speech_synthesis",
);
check(
  synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.lang === "en-US" &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.rate === 0.92 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.pitch === 1 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.volume === 1 &&
    synthesizedDiagnosticListeningTask?.speechSynthesisConfig?.voiceSelection ===
      "prefer_local_en_us_then_en_then_device_default",
  "browser-synthesized Listening has one canonical device-voice configuration",
);

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
