import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const diagnosticTaskRegister = JSON.parse(
  await readFile(new URL("../data/diagnostic-task-register.json", import.meta.url), "utf8"),
);
const diagnosticTasks = [...diagnosticTaskRegister.tasks].sort((left, right) => left.order - right.order);
if (
  diagnosticTaskRegister.protocolVersion !== "sufeiya_diagnostic_task_register_v1" ||
  diagnosticTaskRegister.taskSetVersion !== "gate_a_original_6_v1" ||
  diagnosticTasks.length !== 6
) {
  throw new Error("Diagnostic task register is missing the exact Gate A six-task contract.");
}
for (const task of diagnosticTasks) {
  const digest = createHash("sha256").update(JSON.stringify(task.content)).digest("hex");
  if (task.contentHash !== digest) throw new Error(`Diagnostic content hash mismatch: ${task.taskId}`);
}
const diagnosticManifest = diagnosticTasks.map(({ taskId, taskVersion, skill, responseType, constructTag, contentHash }) => ({
  taskId,
  taskVersion,
  skill,
  responseType,
  constructTag,
  contentHash,
}));
const diagnosticTaskSetDigest = createHash("sha256").update(JSON.stringify(diagnosticManifest)).digest("hex");
if (diagnosticTaskRegister.taskSetDigest !== diagnosticTaskSetDigest) {
  throw new Error("Diagnostic task-set digest does not match the six-task manifest.");
}
const staticListeningTask = diagnosticTasks.find((task) => task.content.audioMode === "static_asset");
if (!staticListeningTask?.audioAsset || staticListeningTask.audioAsset.path !== staticListeningTask.content.audioPath) {
  throw new Error("Static diagnostic audio is missing its canonical asset receipt.");
}
const staticListeningBytes = await readFile(new URL(`..${staticListeningTask.audioAsset.path}`, import.meta.url));
if (
  staticListeningBytes.byteLength !== staticListeningTask.audioAsset.bytes ||
  createHash("sha256").update(staticListeningBytes).digest("hex") !== staticListeningTask.audioAsset.sha256
) {
  throw new Error("Static diagnostic audio does not match its canonical asset receipt.");
}
const bilibili = "https://space.bilibili.com/448907095";
const navItems = [
  { key: "learning-path", label: "学习路径", href: "/learning-path" },
  { key: "platform", label: "平台功能", href: "/platform" },
  { key: "resources", label: "学习资源", href: "/resources" },
  { key: "about", label: "关于我们", href: "/about" },
];

const arrow = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h13M14 7l5 5-5 5" />
  </svg>`;

const externalArrow = `
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 15 15 5M7 5h8v8" />
  </svg>`;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const header = (page) => `
  <div class="reading-progress" aria-hidden="true"><span></span></div>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <header class="site-header" data-header>
    <div class="header-inner">
      <a class="brand" href="/" aria-label="苏肥鸭多邻国首页">
        <img src="/assets/sufeiya-logo.png" width="2792" height="560" alt="苏肥鸭多邻国" />
      </a>
      <nav class="desktop-nav" aria-label="主导航">
        ${navItems
          .map(
            (item) => `
              <a href="${item.href}" data-page-link="${item.key}"${page === item.key ? ' aria-current="page" class="is-active"' : ""}>
                ${item.label}
              </a>`,
          )
          .join("")}
      </nav>
      <a class="header-cta${page === "workspace" ? " is-current" : ""}" href="/workspace"${page === "workspace" ? ' aria-current="page"' : ""}>
        <span>开始学习</span>
        ${arrow}
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="打开导航菜单">
        <span></span><span></span>
      </button>
    </div>
    <nav id="mobile-nav" class="mobile-nav" aria-label="移动端主导航" hidden>
      ${navItems
        .map(
          (item, index) => `
            <a href="${item.href}"${page === item.key ? ' aria-current="page"' : ""}>
              ${item.label}<span>${String(index + 1).padStart(2, "0")}</span>
            </a>`,
        )
        .join("")}
      <a class="mobile-external" href="/workspace"${page === "workspace" ? ' aria-current="page"' : ""}>
        进入学习工作台
        ${arrow}
      </a>
    </nav>
  </header>`;

const footer = () => `
  <footer class="site-footer">
    <div class="footer-main">
      <a class="footer-brand" href="/" aria-label="返回首页">
        <img src="/assets/sufeiya-logo.png" width="2792" height="560" alt="苏肥鸭多邻国" />
      </a>
      <div class="footer-nav">
        <div>
          <strong>页面</strong>
          <a href="/workspace">开始学习</a>
          <a href="/super-teacher">超级智能老师</a>
          <a href="/my-data">我的本机数据</a>
          <a href="/learning-path">学习路径</a>
          <a href="/platform">平台功能</a>
          <a href="/resources">学习资源</a>
        </div>
        <div>
          <strong>了解更多</strong>
          <a href="/about">关于我们</a>
          <a href="/about#faq">常见问题</a>
          <a href="${bilibili}" target="_blank" rel="noopener noreferrer">
            Bilibili <span aria-hidden="true">↗</span>
            <span class="sr-only">（在新窗口打开）</span>
          </a>
        </div>
      </div>
    </div>
    <div class="footer-legal">
      <p>© <span data-current-year>2026</span> Sufeiya. 保留所有权利。</p>
      <p>独立在线学习平台，非 Duolingo 官方服务。Duolingo 和 Duolingo English Test 是其各自权利人的商标。</p>
    </div>
  </footer>`;

const pageHero = ({ number, label, title, lead, aside }) => `
  <section class="page-hero" aria-labelledby="page-title">
    <div class="page-hero-inner">
      <div class="page-hero-copy">
        <p class="page-label"><span>${number}</span>${label}</p>
        <h1 id="page-title">${title}</h1>
        <p>${lead}</p>
      </div>
      <aside class="page-hero-aside">
        <span class="page-aside-number">${number} / 04</span>
        ${aside}
      </aside>
    </div>
  </section>`;

const nextPage = ({ eyebrow, title, href, label }) => `
  <section class="next-page" aria-label="下一页">
    <div class="next-page-inner">
      <p>${eyebrow}</p>
      <h2>${title}</h2>
      <a class="button button-ink" href="${href}">${label}${arrow}</a>
    </div>
  </section>`;

const homeContent = `
  <main id="main-content">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-grain" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow eyebrow-light">
            <span>SUFEIYA</span><span class="eyebrow-rule"></span><span>中文 DET 在线学习平台</span>
          </p>
          <h1 id="hero-title">为每一次学习，<br />找到<span>清晰的下一步。</span></h1>
          <p class="hero-lead">
            现在就生成 7 天学习计划、完成今日任务、练习英文听说读写并记录复盘。
            不只是了解功能，而是在每一次行动中看见清晰的下一步。
          </p>
          <div class="hero-actions">
            <a class="button button-accent" href="/workspace">开始今日学习${arrow}</a>
            <a class="button button-ghost" href="/learning-path">查看学习路径</a>
          </div>
          <p class="hero-note"><span aria-hidden="true"></span>面向中国大陆学生的中文 DET 在线学习平台</p>
        </div>
        <figure class="learning-plate" aria-labelledby="learning-plate-title">
          <figcaption>
            <div>
              <span class="plate-index">学习闭环 / 01</span>
              <h2 id="learning-plate-title">让证据回到行动</h2>
            </div>
            <span class="plate-status">方法</span>
          </figcaption>
          <div class="plate-core">
            <div class="plate-seal" aria-hidden="true">
              <span>证据</span>
              <svg viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" />
                <path d="M24 37h23M41 30l7 7-7 7" />
              </svg>
              <span>行动</span>
            </div>
            <ol class="mini-loop">
              <li><span>01</span><strong>诊断</strong><small>看见当前证据</small></li>
              <li><span>02</span><strong>计划</strong><small>确定学习优先级</small></li>
              <li><span>03</span><strong>行动</strong><small>完成最小任务</small></li>
              <li><span>04</span><strong>复测</strong><small>验证是否前进</small></li>
            </ol>
          </div>
          <div class="plate-footer"><span>诊断</span><span>计划</span><span>学习</span><span>复盘</span></div>
        </figure>
      </div>
    </section>

    <section class="principle-band" aria-label="平台语言与学习原则">
      <div class="principle-band-inner">
        <p><span>01</span><strong>中文学习界面</strong><small>导航、讲解与反馈清楚易懂</small></p>
        <p><span>02</span><strong>英文备考材料</strong><small>题目与练习保留考试语言</small></p>
        <p><span>03</span><strong>证据学习闭环</strong><small>复测持续更新学习计划</small></p>
      </div>
    </section>

    <section class="home-portal section" aria-labelledby="portal-title">
      <div class="section-inner">
        <div class="section-kicker"><span>01</span><p>页面导航</p></div>
        <div class="portal-heading">
          <h2 id="portal-title">一个入口，一个页面。<br />清楚找到你需要的内容。</h2>
          <p>首页负责给出方向，学习工作台负责真正练习。每一项导航仍进入独立页面，内容不挤在同一条长页面里。</p>
        </div>
        <div class="portal-grid">
          <a href="/learning-path">
            <span>01</span><small>从这里理解方法</small>
            <h3>学习路径</h3><p>了解诊断、计划、学习、复盘与再诊断怎样连成七步闭环。</p>
            <b aria-hidden="true">进入页面 →</b>
          </a>
          <a href="/platform">
            <span>02</span><small>查看平台能力</small>
            <h3>平台功能</h3><p>了解全科诊断、智能老师、打卡营和自愿社区互助。</p>
            <b aria-hidden="true">进入页面 →</b>
          </a>
          <a href="/resources">
            <span>03</span><small>开始使用现有内容</small>
            <h3>学习资源</h3><p>进入课程视频、备考图文与苏肥鸭 Bilibili 学习部落。</p>
            <b aria-hidden="true">进入页面 →</b>
          </a>
          <a href="/about">
            <span>04</span><small>了解平台与团队</small>
            <h3>关于我们</h3><p>认识平台定位、团队角色、常见问题与重要服务边界。</p>
            <b aria-hidden="true">进入页面 →</b>
          </a>
        </div>
      </div>
    </section>

    <section class="current-status" aria-labelledby="status-title">
      <div class="current-status-inner">
        <div>
          <p>平台当前状态</p>
          <h2 id="status-title">学生现在就能开始，<br />高级能力再分阶段开放。</h2>
        </div>
        <dl>
          <div><dt>现在可用</dt><dd>7 天计划、今日清单、四项英文微练习、专注计时与本机复盘</dd></div>
          <div><dt>分阶段开放</dt><dd>正式学习诊断、智能老师、带教打卡营与社区互助</dd></div>
          <div><dt>明确不提供</dt><dd>官方成绩预测、真题机经、考试中协助或结果保证</dd></div>
        </dl>
      </div>
    </section>

    ${nextPage({
      eyebrow: "今天就可以开始",
      title: "生成你的 7 天计划，<br />完成第一组英文练习。",
      href: "/workspace",
      label: "进入学习工作台",
    })}
  </main>`;

const learningPathContent = `
  <main id="main-content">
    ${pageHero({
      number: "01",
      label: "学习路径",
      title: "从诊断到再诊断，<br />把每一步真正连起来。",
      lead: "一次练习只是一张快照。真正有用的是：看见证据，确定优先项，完成任务，再用新的练习验证变化。",
      aside: "<strong>七步闭环</strong><p>诊断 → 计划 → 推荐 → 打卡 → 复盘 → 自愿互助 → 再诊断</p>",
    })}
    <section class="method section" aria-labelledby="method-title">
      <div class="section-inner">
        <div class="section-kicker"><span>01</span><p>学习方法</p></div>
        <div class="method-intro">
          <h2 id="method-title">不是给你更多内容，<br />而是帮助你判断下一步。</h2>
          <div>
            <p>很多学习停滞，并不是因为不够努力，而是任务、问题和目标之间没有清楚的关系。苏肥鸭的伴学方法从可观察的学习证据出发，把“我哪里不会”变成“我现在先做什么”。</p>
            <p class="method-aside">建议必须能解释，行动必须能完成，进步必须能再次验证。</p>
          </div>
        </div>
        <div class="method-grid">
          <article>
            <div class="method-marker"><span>01</span><svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" /><path d="m13 22 5 5 11-12" /></svg></div>
            <h3>证据先于建议</h3><p>区分语言能力、题型熟悉度和准备状态；只基于本次任务中真正观察到的表现提出判断。</p>
          </article>
          <article>
            <div class="method-marker"><span>02</span><svg viewBox="0 0 42 42" aria-hidden="true"><path d="M8 30 21 9l13 21H8Z" /><path d="M15 30h12" /></svg></div>
            <h3>一次只抓住关键</h3><p>将目标拆成明确、可完成的最小任务，让学习者知道为什么先做这一项，而不是被清单淹没。</p>
          </article>
          <article>
            <div class="method-marker"><span>03</span><svg viewBox="0 0 42 42" aria-hidden="true"><path d="M30 13a13 13 0 1 0 3 14" /><path d="M29 7v8h8" /></svg></div>
            <h3>复测更新计划</h3><p>完成任务后重新采集同类证据；有效就继续，无效就调整，让计划随着学习者而变化。</p>
          </article>
        </div>
      </div>
    </section>
    <section class="loop section" aria-labelledby="loop-title">
      <div class="section-inner">
        <div class="loop-heading">
          <div class="section-kicker"><span>02</span><p>七步学习闭环</p></div>
          <h2 id="loop-title">学习不是直线，<br />而是一轮轮更准确的判断。</h2>
        </div>
        <ol class="loop-track">
          <li><span class="loop-number">01</span><div><strong>学习诊断</strong><small>观察任务证据</small></div></li>
          <li><span class="loop-number">02</span><div><strong>学习计划</strong><small>确定优先级</small></div></li>
          <li><span class="loop-number">03</span><div><strong>内容推荐</strong><small>匹配学习任务</small></div></li>
          <li><span class="loop-number">04</span><div><strong>学习打卡</strong><small>留下完成证据</small></div></li>
          <li><span class="loop-number">05</span><div><strong>个人复盘</strong><small>理解困难原因</small></div></li>
          <li><span class="loop-number">06</span><div><strong>社区互助</strong><small>自愿获得经验</small></div></li>
          <li class="loop-emphasis"><span class="loop-number">07</span><div><strong>微复测 / 再诊断</strong><small>更新下一轮计划</small></div></li>
        </ol>
        <div class="loop-caption"><p>每一轮结束，都回到一个简单问题：</p><blockquote>“新的证据，是否支持我们继续这样学？”</blockquote></div>
      </div>
    </section>
    ${nextPage({
      eyebrow: "下一页 · 平台功能",
      title: "这条路径，将由四项相互连接的平台能力支持。",
      href: "/platform",
      label: "查看平台功能",
    })}
  </main>`;

const platformContent = `
  <main id="main-content">
    ${pageHero({
      number: "02",
      label: "平台功能",
      title: "四项平台能力，<br />服务同一条学习路径。",
      lead: "基础学习工具和超级智能老师 Gate A 已经可以直接使用；正式诊断、完整课程知识、带教打卡与社区能力继续分阶段验证。每项能力都服务同一条学习路径。",
      aside: "<strong>现在就能学习</strong><p>进入学习工作台完成七步闭环，或让超级智能老师解释本机证据、计划与推荐依据。</p>",
    })}
    <section class="workspace-entry section" aria-labelledby="workspace-entry-title">
      <div class="section-inner">
        <div class="section-kicker"><span>01</span><p>学生可直接使用</p></div>
        <div class="workspace-entry-heading">
          <div>
            <p class="status-pill"><span></span>学习工作台 · 已开放</p>
            <h2 id="workspace-entry-title">打开网页，<br />今天就能完成一轮学习。</h2>
          </div>
          <div>
            <p>无需注册。计划、打卡与复盘只保存在当前浏览器中，学生可以随时清除，不会上传到网站服务器。</p>
            <a class="button button-ink" href="/workspace">进入学习工作台${arrow}</a>
          </div>
        </div>
        <div class="workspace-entry-grid">
          <article><span>01</span><strong>7 天计划生成器</strong><p>按每日时间与重点能力，生成一份可执行的学习安排。</p></article>
          <article><span>02</span><strong>今日任务与打卡</strong><p>逐项完成任务，实时查看当天进度，并留下复盘记录。</p></article>
          <article><span>03</span><strong>四项英文微练习</strong><p>直接完成 Reading、Listening、Writing 与 Speaking 练习。</p></article>
          <article><span>04</span><strong>专注计时器</strong><p>选择 15、25 或 45 分钟，在浏览器里开始专注学习。</p></article>
        </div>
      </div>
    </section>
    <section class="system section" aria-labelledby="system-title">
      <div class="section-inner">
        <div class="section-kicker section-kicker-dark"><span>02</span><p>分阶段平台能力</p></div>
        <div class="system-heading">
          <div>
            <p class="status-pill"><span></span>进阶能力 · 分阶段开放中</p>
            <h2 id="system-title">每项功能有边界，<br />也都有明确作用。</h2>
          </div>
          <p>平台界面和学习说明以中文为主；真正用于 DET 备考的题目、阅读、听力、写作和口语材料保留英文。</p>
        </div>
        <div class="system-grid">
          <article>
            <div class="system-index"><span>01</span><small>诊断</small></div>
            <div class="system-content"><p class="system-label">全科诊断伴学课</p><h3>先弄清楚，<br />真正值得解决的问题。</h3><p>通过原创、低风险的学习任务观察听、说、读、写证据，呈现强弱项、证据充分性和优先任务；不把短诊断包装成官方 DET 分数。</p></div>
          </article>
          <article>
            <div class="system-index"><span>02</span><small>解释</small></div>
            <div class="system-content"><p class="system-label">苏肥鸭超级智能老师</p><h3>解释为什么，<br />也知道何时停下。</h3><p>Gate A 已开放：逐句引用本站本机证据、计划、推荐与原创任务；DET 官方资料和课程正文完成审核前不会进入回答，并保留非 AI 与人工支持路径。</p><a class="text-link" href="/super-teacher">打开超级智能老师 →</a></div>
          </article>
          <article>
            <div class="system-index"><span>03</span><small>练习</small></div>
            <div class="system-content"><p class="system-label">学习打卡营</p><h3>把计划变成，<br />今天能完成的一小步。</h3><p>将个人计划拆成每日最小任务，记录完成证据、困难和周复盘；用具体反馈支持坚持，不用排行榜、断签惩罚或焦虑制造黏性。</p></div>
          </article>
          <article>
            <div class="system-index"><span>04</span><small>互助</small></div>
            <div class="system-content"><p class="system-label">上岸学员社区互助</p><h3>让真实经验，<br />以有边界的方式流动。</h3><p>计划邀请经核验、培训的上岸学员分享结构化经验；每位学习者是否参加完全自愿，不参加也不会阻断个人学习路径。</p></div>
          </article>
        </div>
        <p class="system-boundary"><strong>当前状态：</strong>基础学习工作台、公开课程入口与超级智能老师 Gate A 已开放；后者只回答已准入范围，当前 DET 官方语料与归档知识块准入均为 0。正式诊断、完整知识服务、带教打卡与社区能力仍分阶段开放。</p>
      </div>
    </section>
    <section class="current-status current-status-light" aria-labelledby="platform-status-title">
      <div class="current-status-inner">
        <div><p>能力状态</p><h2 id="platform-status-title">开放状态必须清楚，<br />不把规划写成现成服务。</h2></div>
        <dl>
          <div><dt>学习工作台</dt><dd>已开放，可直接生成计划、练习、计时并在本机保存复盘</dd></div>
          <div><dt>超级智能老师</dt><dd>Gate A 已开放：有来源解释、明确拒答、非 AI 退出和本机人工请求</dd></div>
          <div><dt>其余进阶能力</dt><dd>完成内容、测评、隐私和运营准备后分阶段开放</dd></div>
          <div><dt>非官方边界</dt><dd>不冒充官方评分，不保证提分、录取或上岸结果</dd></div>
        </dl>
      </div>
    </section>
    ${nextPage({
      eyebrow: "下一页 · 学习资源",
      title: "先从现在已经公开、已经可用的课程内容开始。",
      href: "/resources",
      label: "进入学习资源",
    })}
  </main>`;

const resourcesContent = `
  <main id="main-content">
    ${pageHero({
      number: "03",
      label: "学习资源",
      title: "中文讲解，<br />英文材料。",
      lead: "学习界面帮助中国大陆学生理解目标、方法和反馈；用于 DET 备考的英文短文、音频、写作与口语练习保留英文学习情境。",
      aside: "<strong>语言规则</strong><p>平台操作与说明使用简体中文；备考学习材料根据考试需要使用英文。</p>",
    })}
    <section class="language-policy section" aria-labelledby="language-title">
      <div class="section-inner">
        <div class="section-kicker"><span>01</span><p>平台语言</p></div>
        <div class="language-heading">
          <h2 id="language-title">先用中文弄懂为什么，<br />再用英文完成真正的练习。</h2>
          <p>中文降低理解平台和学习方法的门槛；英文保留考试所需要的输入、输出与语言反应。两者分工清楚，不把英文当装饰。</p>
        </div>
        <div class="language-grid">
          <article><span>中文</span><h3>学习界面与支持</h3><p>导航、学习计划、任务说明、诊断解释、反馈、帮助与安全提示。</p></article>
          <article><span lang="en">English</span><h3>DET 备考材料</h3><p>阅读文章、听力材料、作文题目、口语任务、词汇与必要考试术语。</p></article>
        </div>
        <div class="skills-strip" aria-label="四项英文能力材料">
          <span><b lang="en">Reading</b> 阅读</span>
          <span><b lang="en">Writing</b> 写作</span>
          <span><b lang="en">Listening</b> 听力</span>
          <span><b lang="en">Speaking</b> 口语</span>
        </div>
      </div>
    </section>
    <section class="resource-browser section" aria-labelledby="resource-browser-title">
      <div class="section-inner">
        <div class="section-kicker"><span>02</span><p>站内资源检索</p></div>
        <div class="resource-browser-heading">
          <div>
            <p class="status-pill"><span></span>公开目录 · 可直接搜索</p>
            <h2 id="resource-browser-title">按能力找到课程，<br />再回到原始发布页学习。</h2>
          </div>
          <p>目录只展示公开元数据，点击后进入苏肥鸭 Bilibili 原始页面。课程原文和视频不复制到本站。</p>
        </div>
        <form id="resource-search-form" class="resource-search" role="search">
          <label>
            <span>搜索课程</span>
            <input type="search" name="query" autocomplete="off" placeholder="输入题型、能力或关键词" data-resource-query />
          </label>
          <label>
            <span>能力分类</span>
            <select name="skill" data-resource-skill>
              <option value="all">全部能力</option>
              <option value="Reading">Reading · 阅读</option>
              <option value="Listening">Listening · 听力</option>
              <option value="Writing">Writing · 写作</option>
              <option value="Speaking">Speaking · 口语</option>
              <option value="General">General · 综合</option>
            </select>
          </label>
          <button class="button button-ink" type="submit">查找资源</button>
        </form>
        <p class="resource-results-status" data-resource-status role="status" aria-live="polite">正在读取公开资源目录…</p>
        <div class="resource-catalog" data-resource-results></div>
        <noscript><p class="resource-noscript">启用 JavaScript 后可以使用站内搜索；下方公开入口仍可正常访问。</p></noscript>
      </div>
    </section>
    <section class="resources section resources-page" aria-labelledby="resources-title">
      <div class="section-inner">
        <div class="resources-heading">
          <div><div class="section-kicker"><span>03</span><p>公开学习入口</p></div><h2 id="resources-title">从已经公开的内容开始学习。</h2></div>
          <p>苏肥鸭老师在 Bilibili 持续发布 DET 课程讲解、备考方法与学习复盘。本站先把学习者带回原始发布页。</p>
        </div>
        <div class="resource-list">
          <a href="${bilibili}/upload/video" target="_blank" rel="noopener noreferrer">
            <span class="resource-number">01</span>
            <span class="resource-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="6" y="9" width="36" height="30" rx="2" /><path d="m21 18 10 6-10 6V18Z" /></svg></span>
            <span class="resource-copy"><strong>课程视频与题型讲解</strong><small>从系统课程、能力训练到题型理解，浏览公开视频目录。</small></span>
            <span class="resource-arrow" aria-hidden="true">${externalArrow}</span><span class="sr-only">（在新窗口打开）</span>
          </a>
          <a href="${bilibili}/upload/opus" target="_blank" rel="noopener noreferrer">
            <span class="resource-number">02</span>
            <span class="resource-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M10 6h23l6 6v30H10V6Z" /><path d="M33 6v7h6M17 21h15M17 28h15M17 35h9" /></svg></span>
            <span class="resource-copy"><strong>备考攻略与图文动态</strong><small>查看方法说明、阶段提醒、经验总结与最新内容。</small></span>
            <span class="resource-arrow" aria-hidden="true">${externalArrow}</span><span class="sr-only">（在新窗口打开）</span>
          </a>
          <a href="${bilibili}" target="_blank" rel="noopener noreferrer">
            <span class="resource-number">03</span>
            <span class="resource-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="18" r="8" /><path d="M9 42c1-10 6-15 15-15s14 5 15 15" /><path d="m11 8 5 5M37 8l-5 5" /></svg></span>
            <span class="resource-copy"><strong>苏肥鸭的学习部落</strong><small>访问 Bilibili 主页，关注后续课程与平台动态。</small></span>
            <span class="resource-arrow" aria-hidden="true">${externalArrow}</span><span class="sr-only">（在新窗口打开）</span>
          </a>
        </div>
        <p class="resource-note">学员经验属于个人经历，不构成提分、录取或考试结果保证。课程内容也会随 DET 规则更新而复核。</p>
      </div>
    </section>
    ${nextPage({
      eyebrow: "下一页 · 关于我们",
      title: "了解平台由谁推进，以及我们坚持哪些服务边界。",
      href: "/about",
      label: "了解我们",
    })}
  </main>`;

const aboutContent = `
  <main id="main-content">
    ${pageHero({
      number: "04",
      label: "关于我们",
      title: "让教学经验，<br />成为可以持续使用的学习支持。",
      lead: "Sufeiya 在线学习平台围绕中国大陆 DET 学习者的真实问题，把课程、学习证据、智能辅助与社区支持连接成清晰、负责的学习体验。",
      aside: "<strong>共同推进</strong><p>教学与内容由苏肥鸭老师（Sofia）主理；产品与学习科技由胡冬品博士（Dr. Peter Hu）协作推进。</p>",
    })}
    <section class="about about-page" aria-labelledby="about-title">
      <div class="about-inner">
        <div class="about-statement">
          <div class="section-kicker section-kicker-about"><span>01</span><p>团队角色</p></div>
          <h2 id="about-title">教学经验给出方向，<br />产品与技术让它<span>可以被验证。</span></h2>
          <p>Sufeiya 在线学习平台由苏肥鸭老师（Sofia）与胡冬品博士（Dr. Peter Hu）共同推进，围绕中文 DET 学习者的真实问题，把课程、学习证据、智能辅助与社区支持连接成清晰、可持续的学习体验。</p>
        </div>
        <div class="team-list" aria-label="团队角色">
          <article><div class="team-monogram" aria-hidden="true">苏</div><div><span>教学与内容</span><h3>苏肥鸭老师（Sofia）</h3><p>长期专注 Duolingo English Test 备考研究与中文教学内容，负责学习方法、课程内容与教研判断。</p></div></article>
          <article><div class="team-monogram" aria-hidden="true">胡</div><div><span>产品与学习科技</span><h3>胡冬品博士（Dr. Peter Hu）</h3><p>负责产品与学习科技协作，推动内容治理、学习闭环设计、质量验证与平台实现。</p></div></article>
        </div>
      </div>
    </section>
    <section id="faq" class="faq section" aria-labelledby="faq-title">
      <div class="section-inner faq-inner">
        <div class="faq-heading"><div class="section-kicker"><span>02</span><p>常见问题</p></div><h2 id="faq-title">先把重要的边界说清楚。</h2></div>
        <div class="faq-list">
          <details><summary><span>这个网站是 Duolingo 或 DET 官方网站吗？</span><span class="faq-toggle" aria-hidden="true"></span></summary><p>不是。sufeiya.cn 是独立在线学习平台，与 Duolingo, Inc. 没有官方隶属、授权或合作关系。“Duolingo English Test / DET”用于说明所讨论的考试与学习领域。</p></details>
          <details><summary><span>这里能给出正式 DET 分数或“保分”承诺吗？</span><span class="faq-toggle" aria-hidden="true"></span></summary><p>不能。平台中的学习诊断只用于识别当前证据、错误模式和学习优先级，不冒充官方考试评分，也不承诺提分、录取或上岸结果。</p></details>
          <details><summary><span>“苏肥鸭超级智能老师”现在可以使用吗？</span><span class="faq-toggle" aria-hidden="true"></span></summary><p>可以使用 Gate A 限定版。它只解释本站本机学习证据、计划、推荐与原创任务，逐句显示来源；DET 官方规则和归档课程正文尚无准入条目，因此相关问题会明确停下。使用前需同意本次发送，也可随时改走非 AI 或人工支持路径。</p></details>
          <details><summary><span>网站为什么主要使用中文？</span><span class="faq-toggle" aria-hidden="true"></span></summary><p>平台主要服务中国大陆学生，因此导航、说明、反馈和帮助使用简体中文。真正用于 DET 备考的题目、阅读听力材料、作文与口语任务保留英文。</p></details>
          <details><summary><span>社区互助会是必选环节吗？</span><span class="faq-toggle" aria-hidden="true"></span></summary><p>不会。社区互助是平台计划提供的一种支持能力，但每位学习者是否参与都应当自愿；不参加不会影响个人计划、复盘、再诊断或退出。</p></details>
        </div>
      </div>
    </section>
    ${nextPage({
      eyebrow: "现在开始学习",
      title: "了解边界以后，<br />去完成今天的第一项任务。",
      href: "/workspace",
      label: "进入学习工作台",
    })}
  </main>`;

const workspacePrototype = `
  <main id="main-content" class="workspace-page">
    <section class="workspace-hero" aria-labelledby="workspace-title">
      <div class="workspace-hero-inner">
        <div>
          <p class="page-label"><span>学</span>学生学习工作台</p>
          <h1 id="workspace-title">今天就开始，<br />完成一次真实学习。</h1>
          <p>生成 7 天计划、完成今日清单、练习英文听说读写、启动专注计时并保存复盘。界面与说明使用中文，学习材料使用英文。</p>
          <div class="workspace-hero-actions">
            <a class="button button-accent" href="#plan-tool">生成学习计划${arrow}</a>
            <a class="button button-ghost" href="#practice-tool">直接开始练习</a>
          </div>
        </div>
        <aside class="workspace-today" aria-label="今日学习概览">
          <span>今日 / TODAY</span>
          <time data-today-date></time>
          <strong data-hero-progress>0 / 3 项任务</strong>
          <p>计划与记录只保存在当前浏览器</p>
        </aside>
      </div>
    </section>

    <section class="workspace-shell" aria-labelledby="workspace-tools-title">
      <div class="workspace-shell-inner">
        <header class="workspace-toolbar">
          <div>
            <p class="workspace-overline">YOUR STUDY DESK</p>
            <h2 id="workspace-tools-title">四个工具，一次学习闭环。</h2>
          </div>
          <div class="local-data-note">
            <div><strong>本机保存</strong><span>不登录、不上传，可随时清除</span></div>
            <button type="button" data-clear-workspace>清除我的数据</button>
          </div>
        </header>
        <nav class="workspace-jump" aria-label="学习工具快捷导航">
          <a href="#plan-tool"><span>01</span>7 天计划</a>
          <a href="#today-tool"><span>02</span>今日任务</a>
          <a href="#practice-tool"><span>03</span>英文练习</a>
          <a href="#focus-tool"><span>04</span>专注与复盘</a>
        </nav>

        <section id="plan-tool" class="tool-panel plan-tool" aria-labelledby="plan-title">
          <header class="tool-panel-header">
            <div><span>01</span><div><p>学习计划</p><h2 id="plan-title">生成你的 7 天学习安排</h2></div></div>
            <small data-plan-status>尚未生成</small>
          </header>
          <div class="plan-layout">
            <form id="plan-form" class="plan-form" novalidate>
              <label>
                <span>你的称呼 <small>选填</small></span>
                <input name="nickname" type="text" maxlength="20" autocomplete="nickname" placeholder="例如：小林" />
              </label>
              <label>
                <span>预计考试日期 <small>选填</small></span>
                <input name="examDate" type="date" data-exam-date />
              </label>
              <label>
                <span>每天可学习时间</span>
                <select name="dailyMinutes">
                  <option value="15">15 分钟</option>
                  <option value="30" selected>30 分钟</option>
                  <option value="45">45 分钟</option>
                  <option value="60">60 分钟</option>
                </select>
              </label>
              <label>
                <span>本周重点能力</span>
                <select name="focusSkill">
                  <option value="Balanced">综合训练</option>
                  <option value="Reading">Reading · 阅读</option>
                  <option value="Listening">Listening · 听力</option>
                  <option value="Writing">Writing · 写作</option>
                  <option value="Speaking">Speaking · 口语</option>
                </select>
              </label>
              <button class="button button-ink" type="submit">生成 7 天计划${arrow}</button>
              <p>这是学习安排工具，不是官方 DET 诊断、评分或成绩预测。</p>
            </form>
            <div class="plan-output" aria-live="polite">
              <div class="plan-empty" data-plan-empty>
                <span aria-hidden="true">7</span>
                <h3>填写左侧信息后，<br />这里会出现每天的任务。</h3>
                <p>计划由本机规则即时生成，不会上传姓名或考试日期。</p>
              </div>
              <div data-plan-result hidden>
                <div class="plan-result-heading"><div><span data-plan-owner>你的</span><h3>7 天学习计划</h3></div><p data-plan-summary></p></div>
                <ol class="plan-days" data-plan-days></ol>
              </div>
            </div>
          </div>
        </section>

        <section id="today-tool" class="tool-panel today-tool" aria-labelledby="today-title">
          <header class="tool-panel-header">
            <div><span>02</span><div><p>今日任务</p><h2 id="today-title">完成一项，就留下一个证据</h2></div></div>
            <small data-today-status>0 / 3 已完成</small>
          </header>
          <div class="today-layout">
            <div>
              <div class="task-progress"><progress max="3" value="0" data-task-progress>0 / 3</progress><span data-task-progress-text>0%</span></div>
              <ul class="today-tasks" data-today-tasks>
                <li>
                  <input id="today-task-0" type="checkbox" data-task-index="0" />
                  <label for="today-task-0"><strong>Reading 微练习</strong><span>阅读本站英文短文并完成理解题。</span></label>
                </li>
                <li>
                  <input id="today-task-1" type="checkbox" data-task-index="1" />
                  <label for="today-task-1"><strong>Writing 微练习</strong><span>完成英文写作提示并检查词数。</span></label>
                </li>
                <li>
                  <input id="today-task-2" type="checkbox" data-task-index="2" />
                  <label for="today-task-2"><strong>学习复盘</strong><span>写下今天最需要继续解决的一件事。</span></label>
                </li>
              </ul>
            </div>
            <aside class="today-next">
              <span>NEXT STEP</span>
              <h3 data-next-task>先完成第一项任务</h3>
              <p data-next-task-detail>每项任务完成后，清单会自动保存在当前浏览器。</p>
              <a class="button button-ghost" href="#practice-tool">去做英文练习</a>
            </aside>
          </div>
        </section>

        <section id="practice-tool" class="tool-panel practice-tool" aria-labelledby="practice-title">
          <header class="tool-panel-header">
            <div><span>03</span><div><p>英文微练习</p><h2 id="practice-title">四项能力，直接在页面里练</h2></div></div>
            <small>材料为原创练习，不是真题</small>
          </header>
          <div class="practice-grid">
            <article class="practice-card" data-practice="reading">
              <header><span>Reading</span><small>约 3 分钟</small></header>
              <p class="practice-instruction">阅读英文材料并选择最合适的答案。</p>
              <div class="english-material" lang="en">
                <p>Maya noticed that the school library was busiest just before exams. Instead of adding more desks, the librarian created several quiet zones and one small area for group discussion. After two weeks, students reported that it was easier to choose a space that matched the way they needed to study.</p>
                <fieldset>
                  <legend>Why did the librarian reorganize the space?</legend>
                  <label><input type="radio" name="reading-answer" value="a" /> To make the library look larger.</label>
                  <label><input type="radio" name="reading-answer" value="b" /> To support different ways of studying.</label>
                  <label><input type="radio" name="reading-answer" value="c" /> To reduce the number of students.</label>
                </fieldset>
              </div>
              <button class="tool-action" type="button" data-check-reading>检查答案</button>
              <p class="practice-feedback" data-reading-feedback role="status" aria-live="polite">选择答案后再检查。</p>
            </article>

            <article class="practice-card" data-practice="listening">
              <header><span>Listening</span><small>可重复播放</small></header>
              <p class="practice-instruction">播放英文材料，听完后回答问题。</p>
              <p class="sr-only" data-listening-script lang="en">The science club moved its weekly meeting from Tuesday to Thursday because the laboratory is now used for another class on Tuesday afternoon. The meeting will still begin at four thirty.</p>
              <button class="audio-button" type="button" data-play-listening><span aria-hidden="true">▶</span>播放英文材料</button>
              <div class="english-material" lang="en">
                <fieldset>
                  <legend>When will the science club meet?</legend>
                  <label><input type="radio" name="listening-answer" value="a" /> Tuesday at 4:30.</label>
                  <label><input type="radio" name="listening-answer" value="b" /> Thursday at 4:30.</label>
                  <label><input type="radio" name="listening-answer" value="c" /> Thursday at 3:30.</label>
                </fieldset>
              </div>
              <details class="listening-transcript"><summary>需要时查看英文原文</summary><p lang="en">The science club moved its weekly meeting from Tuesday to Thursday because the laboratory is now used for another class on Tuesday afternoon. The meeting will still begin at four thirty.</p></details>
              <button class="tool-action" type="button" data-check-listening>检查答案</button>
              <p class="practice-feedback" data-listening-feedback role="status" aria-live="polite">先听材料，再选择答案。</p>
            </article>

            <article class="practice-card" data-practice="writing">
              <header><span>Writing</span><small>建议 5 分钟</small></header>
              <p class="practice-instruction">阅读提示后用英文作答；内容自动保存在本机。</p>
              <p class="english-prompt" lang="en">Describe one change that could make your school or community a better place to learn. Explain why it would help.</p>
              <label class="writing-field"><span class="sr-only">英文写作回答</span><textarea rows="8" spellcheck="true" lang="en" data-writing-answer placeholder="Write your response in English..."></textarea></label>
              <div class="writing-meta"><span><b data-word-count>0</b> words</span><span data-writing-save-status>尚未输入</span></div>
              <fieldset class="self-review">
                <legend>完成后自查</legend>
                <label><input type="checkbox" data-review="idea" /> I stated one clear idea.</label>
                <label><input type="checkbox" data-review="reason" /> I explained why it would help.</label>
                <label><input type="checkbox" data-review="edit" /> I checked grammar and spelling.</label>
              </fieldset>
            </article>

            <article class="practice-card" data-practice="speaking">
              <header><span>Speaking</span><small>60 秒</small></header>
              <p class="practice-instruction">阅读英文提示，点击计时后大声回答。不录音、不上传。</p>
              <p class="english-prompt" lang="en">Talk about a skill you would like to learn. What is the skill, why is it useful, and how would you practice it?</p>
              <div class="speaking-clock" aria-live="polite"><strong data-speaking-time>01:00</strong><span data-speaking-state>准备好后开始</span></div>
              <div class="tool-button-row">
                <button class="tool-action" type="button" data-speaking-start>开始 60 秒</button>
                <button class="tool-action tool-action-secondary" type="button" data-speaking-reset>重置</button>
              </div>
              <p class="practice-feedback">建议结构：回答主题 → 给出原因 → 提供具体例子。</p>
            </article>
          </div>
        </section>

        <section id="focus-tool" class="tool-panel focus-tool" aria-labelledby="focus-title">
          <header class="tool-panel-header">
            <div><span>04</span><div><p>专注与复盘</p><h2 id="focus-title">给学习一段不被打断的时间</h2></div></div>
            <small>计时结束后记录真实困难</small>
          </header>
          <div class="focus-layout">
            <div class="focus-timer">
              <label>专注时长
                <select data-focus-duration>
                  <option value="15">15 分钟</option>
                  <option value="25" selected>25 分钟</option>
                  <option value="45">45 分钟</option>
                </select>
              </label>
              <div class="focus-clock" aria-live="polite"><span>FOCUS</span><strong data-focus-time>25:00</strong><p data-focus-state>准备开始</p></div>
              <div class="tool-button-row">
                <button class="button button-ink" type="button" data-focus-start>开始专注</button>
                <button class="button button-ghost" type="button" data-focus-reset>重置</button>
              </div>
            </div>
            <form id="checkin-form" class="checkin-form">
              <label for="daily-note">今日学习复盘</label>
              <p>可以写：今天完成了什么？哪里最困难？明天要先解决什么？</p>
              <textarea id="daily-note" rows="9" maxlength="1200" data-daily-note placeholder="把真实情况写下来，而不是只写“已完成”……"></textarea>
              <div><small><span data-note-count>0</span> / 1200 字</small><button class="button button-accent" type="submit">保存今日复盘</button></div>
              <p class="save-message" data-note-status role="status" aria-live="polite">尚未保存</p>
            </form>
          </div>
        </section>

        <div class="workspace-boundary">
          <strong>学习边界</strong>
          <p>本站练习用于自我学习与计划管理，不提供官方 DET 分数、真题机经、考试中协助或结果保证。需要正式成绩时，请以 Duolingo English Test 官方考试结果为准。</p>
        </div>
      </div>
    </section>
  </main>`;

const studyToolNav = (current) => `
  <nav class="study-tool-nav" aria-label="学生功能导航">
    <a href="/plan"${current === "plan" ? ' aria-current="page"' : ""}><span>01</span>7 天计划</a>
    <a href="/today"${current === "today" ? ' aria-current="page"' : ""}><span>02</span>今日任务</a>
    <a href="/practice"${current === "practice" ? ' aria-current="page"' : ""}><span>03</span>英文练习</a>
    <a href="/focus"${current === "focus" ? ' aria-current="page"' : ""}><span>04</span>专注计时</a>
    <a href="/check-in"${current === "check-in" ? ' aria-current="page"' : ""}><span>05</span>学习复盘</a>
  </nav>`;

const studyPageHero = ({ current, number, label, title, lead, note }) => `
  <section class="study-page-hero" aria-labelledby="study-page-title">
    <div class="study-page-hero-inner">
      <div>
        <a class="study-back" href="/workspace">← 返回学习工作台</a>
        <p class="page-label"><span>${number}</span>${label}</p>
        <h1 id="study-page-title">${title}</h1>
        <p>${lead}</p>
      </div>
      <aside><strong>${note}</strong><span>数据只保存在当前浏览器，不上传。</span></aside>
    </div>
    <div class="study-nav-wrap">${studyToolNav(current)}</div>
  </section>`;

const workspaceContent = `
  <main id="main-content" class="workspace-page">
    <section class="workspace-hero" aria-labelledby="workspace-title">
      <div class="workspace-hero-inner">
        <div>
          <p class="page-label"><span>学</span>学生学习工作台</p>
          <h1 id="workspace-title">沿着一条闭环，<br />完成清楚的下一步。</h1>
          <p>每个按钮仍进入一个独立功能页；工作台负责把演示性初筛、计划、推荐、打卡、复盘、自愿互助与平行微复测连接成一条可追踪路径。</p>
        </div>
        <aside class="workspace-today" aria-label="学习闭环概览">
          <span>GATE A / 本机演示</span>
          <time data-today-date></time>
          <strong data-journey-summary>0 / 7 步已留证</strong>
          <p data-journey-next-label>下一步：完成六任务诊断证据包</p>
        </aside>
      </div>
    </section>
    <section class="journey-section section" aria-labelledby="journey-title">
      <div class="section-inner">
        <div class="journey-heading">
          <div><p class="workspace-overline">SUFEIYA CLOSED LOOP V1</p><h2 id="journey-title">七步各自独立，<br />证据彼此连接。</h2></div>
          <div class="local-data-note"><div><strong>隐私优先</strong><span>不登录、不上传，可随时清除</span></div><button type="button" data-clear-workspace>清除我的数据</button></div>
        </div>
        <ol class="journey-grid" data-journey-list>
          <li data-journey-step="diagnostic"><a href="/diagnostic"><span>01</span><small data-journey-step-status>待开始</small><h3>诊断证据包</h3><p>完成 2 Reading、2 Listening、90 秒 Speaking 与 3 分钟 Writing，再确认优先项。</p><b>进入诊断页 →</b></a></li>
          <li data-journey-step="plan"><a href="/plan"><span>02</span><small data-journey-step-status>待开始</small><h3>7 天计划</h3><p>把优先项与可用时间变成可编辑的每日任务。</p><b>进入计划页 →</b></a></li>
          <li data-journey-step="recommendation"><a href="/recommendations"><span>03</span><small data-journey-step-status>待开始</small><h3>内容推荐</h3><p>查看一个主任务与至多两个补充，并明确接受或跳过。</p><b>进入推荐页 →</b></a></li>
          <li data-journey-step="checkin"><a href="/check-in"><span>04</span><small data-journey-step-status>待开始</small><h3>证据式打卡</h3><p>同时保存做了什么、一条学习证据和仍待解决的问题。</p><b>进入打卡页 →</b></a></li>
          <li data-journey-step="review"><a href="/review"><span>05</span><small data-journey-step-status>待开始</small><h3>学生确认复盘</h3><p>核对刚才的打卡内容，再明确确认或返回修正。</p><b>进入确认页 →</b></a></li>
          <li data-journey-step="community"><a href="/community"><span>06</span><small data-journey-step-status>待开始</small><h3>自愿社区互助</h3><p>可使用演示经验卡，也可谢绝、不需要或标记暂不可用。</p><b>进入互助选择 →</b></a></li>
          <li data-journey-step="retest"><a href="/retest"><span>07</span><small data-journey-step-status>待开始</small><h3>平行微复测</h3><p>完成一条原创平行任务，再由学习者确认下一轮计划。</p><b>进入微复测 →</b></a></li>
        </ol>
        <div class="journey-next-card" aria-live="polite">
          <div><span>NEXT EVIDENCE</span><h3 data-journey-next-title>完成六任务诊断证据包</h3><p data-journey-next-copy>先完成设备预检，再依次留下六项原创任务证据与学习者确认的优先项。</p></div>
          <a class="button button-accent" href="/diagnostic" data-journey-next-link>继续下一步${arrow}</a>
        </div>
        <p class="workspace-launch-boundary">这是 Gate A 本机演示：不接触服务器端学生数据，不提供官方 DET 分数、成绩预测、自动诊断、真题机经、考试中协助、真实社区或结果保证。</p>
      </div>
    </section>
    <section class="workspace-launch section" aria-labelledby="workspace-launch-title">
      <div class="section-inner">
        <div class="workspace-launch-heading">
          <div><p class="workspace-overline">SUPPORTING TOOLS</p><h2 id="workspace-launch-title">闭环之外，<br />按需打开辅助工具。</h2></div>
          <p class="workspace-tools-copy">练习、专注与数据管理都有独立页面；它们不会自动生成能力结论，也不会替代七步闭环中的学生确认。</p>
        </div>
        <div class="workspace-launch-grid workspace-support-grid">
          <a href="/super-teacher"><span>苏</span><small>SUPER TEACHER</small><h3>超级智能老师</h3><p>解释本机证据、计划与推荐依据；来源不足时明确停下。</p><b>有来源地问为什么 →</b></a>
          <a href="/today"><span>今</span><small>TODAY</small><h3>今日任务</h3><p>读取 7 天计划，逐项完成今天的练习与行动。</p><b>查看今日清单 →</b></a>
          <a href="/practice"><span>练</span><small>PRACTICE</small><h3>四项英文微练习</h3><p>Reading、Listening、Writing 与 Speaking 各有独立页面。</p><b>选择练习页 →</b></a>
          <a href="/focus"><span>专</span><small>FOCUS</small><h3>专注计时</h3><p>选择 15、25 或 45 分钟，开始一段不被打断的学习。</p><b>进入计时页 →</b></a>
          <a href="/my-data"><span>数</span><small>MY DATA</small><h3>本机数据</h3><p>查看、导出或仅清除当前浏览器中的 Sufeiya 学习记录。</p><b>管理本机数据 →</b></a>
        </div>
      </div>
    </section>
  </main>`;

const renderDiagnosticChoices = (task) => `
  <fieldset class="diagnostic-choice-list">
    <legend>${escapeHtml(task.content.question)}</legend>
    ${task.content.choices
      .map(
        (choice) => `<label><input type="radio" name="diagnostic-answer-${escapeHtml(task.taskId)}" value="${escapeHtml(choice.value)}" /><span>${escapeHtml(choice.label)}</span></label>`,
      )
      .join("")}
  </fieldset>`;

const renderDiagnosticTask = (task, index) => {
  const headingId = `diagnostic-task-title-${index + 1}`;
  const common = `data-diagnostic-task data-task-id="${escapeHtml(task.taskId)}" data-task-version="${escapeHtml(task.taskVersion)}" data-task-order="${task.order}" data-task-skill="${escapeHtml(task.skill)}" data-response-type="${escapeHtml(task.responseType)}" data-construct-tag="${escapeHtml(task.constructTag)}" data-content-hash="${escapeHtml(task.contentHash)}" aria-labelledby="${headingId}"`;
  const header = `<header class="diagnostic-task-heading"><div><span>${String(index + 1).padStart(2, "0")}</span><div><p>${escapeHtml(task.content.eyebrow)}</p><h3 id="${headingId}" tabindex="-1" lang="en">${escapeHtml(task.content.title)}</h3></div></div><small data-task-state>待开始</small></header><p class="diagnostic-task-instruction">${escapeHtml(task.content.instructionZh)}</p>`;
  const unavailable = `<button class="button button-ghost diagnostic-skip" type="button" data-diagnostic-skip-task>当前无法完成 / 跳过</button>`;

  if (task.skill === "Reading") {
    return `<article class="diagnostic-task-card" ${common} data-correct-value="${escapeHtml(task.content.correctValue)}" hidden>${header}<div class="english-material" lang="en"><p>${escapeHtml(task.content.passage)}</p>${renderDiagnosticChoices(task)}</div><div class="diagnostic-task-actions"><button class="button button-ink" type="button" data-diagnostic-submit-task disabled>封存第一次选择${arrow}</button>${unavailable}</div><p class="practice-feedback" data-task-message role="status" aria-live="polite"></p></article>`;
  }

  if (task.skill === "Listening") {
    const audio = task.content.audioMode === "static_asset"
      ? `<audio controls preload="metadata" data-diagnostic-audio aria-label="Listening 1 英文材料；需完整播放后再提交" src="${escapeHtml(task.content.audioPath)}"><p>当前浏览器无法播放音频，请使用英文原文替代；该任务会标记为证据不足。</p></audio>`
      : `<button class="diagnostic-audio-button" type="button" data-diagnostic-speech-play><span aria-hidden="true">▶</span><span><strong>播放英文音频</strong><small>由当前设备的通用英文语音合成器朗读</small></span></button>`;
    return `<article class="diagnostic-task-card" ${common} data-correct-value="${escapeHtml(task.content.correctValue)}" data-audio-mode="${escapeHtml(task.content.audioMode)}" hidden>${header}${audio}<p class="audio-status" data-diagnostic-audio-status role="status" aria-live="polite">请先播放英文材料；可以重复播放。</p><div class="english-material" lang="en">${renderDiagnosticChoices(task)}</div><details class="listening-transcript diagnostic-transcript" data-diagnostic-transcript><summary>音频不可用或需要无障碍替代时，查看英文原文</summary><p lang="en" data-diagnostic-transcript-text>${escapeHtml(task.content.transcript)}</p><small>打开后仍可完成任务，但不会被解释为纯听力证据。</small></details><div class="diagnostic-task-actions"><button class="button button-ink" type="button" data-diagnostic-submit-task disabled>封存第一次选择${arrow}</button>${unavailable}</div><p class="practice-feedback" data-task-message role="status" aria-live="polite"></p></article>`;
  }

  if (task.skill === "Speaking") {
    return `<article class="diagnostic-task-card" ${common} data-prep-seconds="${task.content.prepSeconds}" data-response-seconds="${task.content.responseSeconds}" hidden>${header}<p class="english-prompt" lang="en">${escapeHtml(task.content.prompt)}</p><div class="speaking-clock diagnostic-clock"><strong data-diagnostic-timer>${String(task.content.prepSeconds).padStart(2, "0")}</strong><span data-diagnostic-timer-state>准备好后开始</span></div><p class="sr-only" data-diagnostic-timer-announcement aria-live="polite"></p><div class="tool-button-row" data-speaking-controls><button class="tool-action" type="button" data-speaking-start>开始 20 秒准备</button><button class="tool-action tool-action-secondary" type="button" data-speaking-finish hidden>提前结束回答</button></div><fieldset class="self-review diagnostic-self-review" data-speaking-review-wrap hidden lang="en"><legend>Self-review after speaking</legend>${task.content.selfReview.map((item) => `<label><input type="checkbox" data-speaking-review="${escapeHtml(item.id)}" /> ${escapeHtml(item.label)}</label>`).join("")}</fieldset><div class="diagnostic-task-actions" data-speaking-submit-wrap hidden><button class="button button-ink" type="button" data-speaking-submit>保存计时与自查${arrow}</button>${unavailable}</div><div class="diagnostic-task-actions" data-speaking-skip-wrap>${unavailable}</div><p class="practice-feedback" data-task-message role="status" aria-live="polite"></p></article>`;
  }

  return `<article class="diagnostic-task-card" ${common} data-response-seconds="${task.content.responseSeconds}" data-minimum-words="${task.content.minimumWordsForCompletion}" hidden>${header}<p class="english-prompt" lang="en">${escapeHtml(task.content.prompt)}</p><div class="diagnostic-writing-start" data-writing-start-wrap><button class="button button-ink" type="button" data-writing-start>开始 3 分钟写作${arrow}</button><p>开始前不会保存任何作文文本。</p></div><div data-writing-workspace hidden><div class="diagnostic-writing-clock"><span>TIME LEFT</span><strong data-diagnostic-timer>03:00</strong><small data-diagnostic-timer-state>尚未开始</small></div><label class="writing-field"><span lang="en">Your response</span><textarea rows="10" maxlength="1800" spellcheck="true" lang="en" data-diagnostic-writing-answer disabled placeholder="Write your response in English..."></textarea></label><div class="writing-meta"><span><b data-diagnostic-word-count>0</b> words</span><span data-diagnostic-writing-save>只在本机保存</span></div><button class="button button-ghost" type="button" data-writing-finish>结束写作并自查</button></div><fieldset class="self-review diagnostic-self-review" data-writing-review-wrap hidden lang="en"><legend>Self-review</legend>${task.content.selfReview.map((item) => `<label><input type="checkbox" data-writing-review="${escapeHtml(item.id)}" /> ${escapeHtml(item.label)}</label>`).join("")}</fieldset><div class="diagnostic-task-actions" data-writing-submit-wrap hidden><button class="button button-ink" type="button" data-writing-submit>保存作答条件与自查${arrow}</button>${unavailable}</div><div class="diagnostic-task-actions" data-writing-skip-wrap>${unavailable}</div><p class="practice-feedback" data-task-message role="status" aria-live="polite"></p></article>`;
};

const diagnosticContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "01", label: "Gate A 诊断证据包", title: "先做六项原创任务，<br />再确认下一步练什么。", lead: "2 项 Reading、2 项 Listening、90 秒 Speaking 与 3 分钟 Writing 共同形成一份本机证据报告。它只验证流程和可解释性，不生成能力等级、DET 估分或自动开放题诊断。", note: "约 10–12 分钟 · 仅限 18+ 演示" })}
    <section class="single-tool-section journey-tool-section" aria-labelledby="diagnostic-title" data-diagnostic-app data-task-set-version="${escapeHtml(diagnosticTaskRegister.taskSetVersion)}" data-task-set-digest="${escapeHtml(diagnosticTaskRegister.taskSetDigest)}">
      <div class="single-tool-inner diagnostic-tool-inner">
        <header class="tool-panel-header"><div><span>01</span><div><p>诊断证据会话</p><h2 id="diagnostic-title">完成设备预检与六项版本化任务</h2></div></div><small data-diagnostic-status>尚未开始</small></header>
        <div class="gate-a-notice"><strong>发布边界</strong><p>本任务集是未经教研与测量双签的 Gate A 原创演示任务，只保存在当前浏览器。客观题只记录首答；Writing 与 Speaking 未经合格人工审核，不会生成正式诊断。旧的平行微复测题继续独立保留。</p></div>

        <section class="diagnostic-preflight" data-diagnostic-preflight aria-labelledby="preflight-title">
          <div class="diagnostic-preflight-copy"><span>DEVICE & DATA CHECK</span><h3 id="preflight-title" tabindex="-1">开始前，用一分钟确认边界与设备</h3><p>固定演示目标：在约四周内完成一轮 DET 备考行动闭环。这里不收集认证成绩，不请求麦克风，也不上传自由文本。</p></div>
          <div class="diagnostic-device-grid" aria-label="自动设备检查结果">
            <div><span>本机存储</span><strong data-device-storage>正在检查</strong></div>
            <div><span>MP3 播放</span><strong data-device-mp3>正在检查</strong></div>
            <div><span>设备语音</span><strong data-device-speech>正在检查</strong></div>
            <div><span>安全写入锁</span><strong data-device-lock>正在检查</strong></div>
            <div><span>当前屏幕</span><strong data-device-viewport>正在检查</strong></div>
            <div><span>麦克风</span><strong>不会请求</strong></div>
            <div><span>网络状态</span><strong data-device-network>正在检查</strong></div>
          </div>
          <form id="diagnostic-start-form" class="diagnostic-start-form" novalidate>
            <label class="consent-check"><input type="checkbox" name="adultConfirmed" /><span><strong>我确认当前使用者已满 18 岁</strong><small>未成年人模式尚未开放；若不符合，请停止并退出本页。</small></span></label>
            <label class="consent-check"><input type="checkbox" name="localBoundaryConfirmed" /><span><strong>我理解这是本机 Gate A 演示</strong><small>作文只存当前浏览器；不上传姓名、成绩、作文或录音，不用于模型训练。</small></span></label>
            <label class="consent-check"><input type="checkbox" name="noScoreConfirmed" /><span><strong>我理解报告不是分数或正式能力诊断</strong><small>它只显示本次任务证据、质量限制、候选优先项与下一条任务。</small></span></label>
            <label class="diagnostic-keyboard-check"><span>键盘预检</span><input type="text" name="keyboardCheck" maxlength="12" autocomplete="off" placeholder="请在这里输入任意字符" /><small>输入内容只用于确认键盘可用，不会写入诊断记录。</small></label>
            <label class="consent-check"><input type="checkbox" name="environmentConfirmed" /><span><strong>我现在可以阅读、听音并大声回答</strong><small>如环境不允许，可把任务标记为跳过或不可用，不会被记作零分。</small></span></label>
            <fieldset class="diagnostic-audio-check"><legend>声音输出预检</legend><button class="button button-ghost" type="button" data-audio-test>播放 1 秒测试音</button><label><input type="radio" name="audioOutput" value="heard" /> 我听到了测试音</label><label><input type="radio" name="audioOutput" value="unavailable" /> 当前听不到，继续使用文本替代</label></fieldset>
            <button class="button button-ink" type="submit">开始六项原创任务${arrow}</button>
            <p class="form-inline-message" data-diagnostic-message role="alert" tabindex="-1"></p>
          </form>
        </section>

        <section class="diagnostic-runner" data-diagnostic-runner hidden aria-labelledby="runner-title">
          <aside class="diagnostic-stepper" aria-label="诊断任务进度"><span>LOCAL EVIDENCE</span><h3 id="runner-title">六项任务</h3><ol>${diagnosticTasks.map((task, index) => `<li data-diagnostic-step="${escapeHtml(task.taskId)}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(task.skill)}</strong><small data-step-state>待开始</small></div></li>`).join("")}</ol><button class="text-link-button" type="button" data-diagnostic-restart>重新开始本轮</button></aside>
          <div class="diagnostic-task-stage">
            <div class="diagnostic-progress"><div><span data-diagnostic-progress-label>任务 1 / 6</span><strong data-diagnostic-progress-percent>0%</strong></div><progress max="6" value="0" data-diagnostic-progress aria-label="六项诊断任务完成进度">0 / 6</progress></div>
            ${diagnosticTasks.map(renderDiagnosticTask).join("")}
          </div>
        </section>

        <section class="diagnostic-report" data-diagnostic-report hidden aria-labelledby="report-title">
          <header><div><span>NON-SCORE REPORT</span><h3 id="report-title" tabindex="-1">本次任务证据报告</h3></div><strong data-report-confidence>低置信度</strong></header>
          <div class="diagnostic-report-lead"><p data-report-summary></p><div><span>证据状态</span><strong data-diagnostic-sufficiency></strong></div></div>
          <div class="diagnostic-evidence-grid" data-report-evidence></div>
          <div class="diagnostic-report-columns"><section><h4>观察到的任务模式</h4><ul data-report-patterns></ul></section><section><h4>证据质量与限制</h4><ul data-report-quality></ul></section></div>
          <form id="diagnostic-priority-form" class="diagnostic-priority-form" novalidate>
            <div><span>NEXT EVIDENCE PRIORITY</span><h4>确认本轮下一条优先任务</h4><p data-priority-explanation></p></div>
            <fieldset><legend>选择一个方向</legend><div data-priority-options></div></fieldset>
            <label class="consent-check"><input type="checkbox" name="learnerConfirmedPriority" /><span><strong>我确认把所选方向作为本轮计划重点</strong><small>这是对下一条任务的选择，不是能力等级；计划页仍可修改。</small></span></label>
            <button class="button button-ink" type="submit">确认并生成诊断回执${arrow}</button>
            <p class="form-inline-message" data-priority-message role="alert"></p>
          </form>
          <div class="chain-receipt" data-diagnostic-result hidden aria-live="polite"><span>DIAGNOSTIC RECEIPT</span><h3 data-diagnostic-result-title tabindex="-1">六项任务证据已留存</h3><p data-diagnostic-result-copy></p><dl><div><dt>diagnostic_session_id</dt><dd data-diagnostic-id></dd></div><div><dt>task_set_version</dt><dd>${escapeHtml(diagnosticTaskRegister.taskSetVersion)}</dd></div><div><dt>证据状态</dt><dd data-diagnostic-receipt-sufficiency></dd></div><div><dt>下一条优先项</dt><dd data-diagnostic-priority></dd></div></dl><div class="diagnostic-next-actions"><a class="button button-accent" href="/plan">下一步：生成 7 天计划${arrow}</a><a class="button button-ghost" href="/super-teacher">问超级老师为什么先练这个${arrow}</a></div></div>
          <button class="text-link-button diagnostic-report-restart" type="button" data-diagnostic-restart>重新完成一轮任务</button>
        </section>
      </div>
    </section>
  </main>`;

const recommendationsContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "03", label: "可解释推荐", title: "一个主任务，<br />至多两个可选补充。", lead: "推荐只基于本机计划与已冻结的原创练习入口；每项显示原因、时长和验证方式。当前不使用 RAG、不自由上网，也不把打开链接当成完成学习。", note: "接受或明确跳过都可留证" })}
    <section class="single-tool-section journey-tool-section" aria-labelledby="recommendation-title"><div class="single-tool-inner">
      <header class="tool-panel-header"><div><span>03</span><div><p>内容推荐</p><h2 id="recommendation-title">今天先做哪一项</h2></div></div><small data-recommendation-status>正在读取计划</small></header>
      <div class="gate-a-notice"><strong>来源边界</strong><p>主任务来自本站原创微练习；补充入口只连接已审阅的公开目录或非评分工具。页面不会声称 Bilibili 目录已经成为 RAG 语料。</p></div>
      <div class="recommendation-empty" data-recommendation-empty><h3>还没有可用计划</h3><p>先完成六任务诊断证据包并生成 7 天计划，推荐页才会生成与当前重点相关的任务。</p><a class="button button-ink" href="/diagnostic">先完成诊断证据包${arrow}</a></div>
      <div data-recommendation-ready hidden><div class="recommendation-list" data-recommendation-items></div><div class="recommendation-actions"><button class="button button-ink" type="button" data-accept-recommendation>接受主任务</button><button class="button button-ghost" type="button" data-skip-recommendation>今天明确跳过</button><a class="button button-accent" href="/today" data-recommendation-start hidden>开始今天的任务${arrow}</a></div><p class="save-message" data-recommendation-message role="status" aria-live="polite"></p><dl class="compact-receipt" data-recommendation-receipt hidden><div><dt>recommendation_id</dt><dd data-recommendation-id></dd></div><div><dt>plan_id</dt><dd data-recommendation-plan-id></dd></div></dl></div>
    </div></section>
  </main>`;

const communityContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "06", label: "自愿社区互助", title: "需要就使用，<br />不需要也不影响学习。", lead: "真实社区、导师与陌生人互动尚未开放。本页只用一张明确标注的合成演示经验卡，验证学习者能主动选择使用、谢绝、不需要或暂不可用。", note: "四种状态都不会阻断闭环" })}
    <section class="single-tool-section journey-tool-section" aria-labelledby="community-title"><div class="single-tool-inner narrow-tool">
      <header class="tool-panel-header"><div><span>06</span><div><p>互助选择</p><h2 id="community-title">记录你的自愿状态</h2></div></div><small data-community-status>尚未选择</small></header>
      <article class="demo-peer-card"><span>合成演示经验卡 · 非真实学员材料</span><h3>先把口语回答写成三行提纲</h3><p>“我会先写主题、一个原因和一个例子，再开始 60 秒练习。这样做只是我的个人练习方式，不代表官方规则，也不保证适合每个人。”</p><small>来源：Gate A 合成示例；不含姓名、成绩、截图或可识别经历。</small></article>
      <form id="community-form" class="journey-form community-form" novalidate>
        <fieldset><legend>这一步如何记录？</legend>
          <label><input type="radio" name="peerHelpStatus" value="used" /><span><strong>已使用</strong><small>我查看了上方演示经验卡。</small></span></label>
          <label><input type="radio" name="peerHelpStatus" value="declined" /><span><strong>谢绝</strong><small>我今天不想使用社区互助。</small></span></label>
          <label><input type="radio" name="peerHelpStatus" value="not_needed" /><span><strong>不需要</strong><small>我能继续个人计划，不需要互助。</small></span></label>
          <label><input type="radio" name="peerHelpStatus" value="unavailable" /><span><strong>暂不可用</strong><small>真实社区尚未开放，记录系统状态。</small></span></label>
        </fieldset>
        <button class="button button-ink" type="submit">保存互助状态${arrow}</button><p class="form-inline-message" data-community-message role="alert"></p>
      </form>
      <dl class="compact-receipt" data-community-receipt hidden><div><dt>peer_help_id</dt><dd data-community-id></dd></div><div><dt>peer_help_status</dt><dd data-community-value></dd></div></dl>
      <a class="button button-accent journey-next-button" href="/retest">下一步：平行微复测${arrow}</a>
    </div></section>
  </main>`;

const retestContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "07", label: "平行微复测与更新计划", title: "再收集一条证据，<br />不把单题写成能力增长。", lead: "选择一项原创平行任务并完成。结果只说明本次任务证据；随后由你确认下一轮重点，系统生成带 updated_plan_id 的新计划。", note: "原创任务 · 不评分 · 可解释更新" })}
    <section class="single-tool-section journey-tool-section" aria-labelledby="retest-title"><div class="single-tool-inner">
      <header class="tool-panel-header"><div><span>07</span><div><p>平行微复测</p><h2 id="retest-title">完成一条可回链的新证据</h2></div></div><small data-retest-status>尚未完成</small></header>
      <div class="gate-a-notice"><strong>解释边界</strong><p>答对一题或完成一次自查都不能证明真实能力增长、教学因果效果或 DET 分数变化。页面只保存任务版本、结果类型和学习者确认的下一步。</p></div>
      <form id="retest-form" class="journey-form retest-form" novalidate>
        <label><span>选择平行任务</span><select name="retestSkill" data-retest-skill><option value="Reading">Reading · 阅读</option><option value="Listening">Listening · 听力</option><option value="Writing">Writing · 写作</option><option value="Speaking">Speaking · 口语</option></select></label>
        <section class="retest-panel" data-retest-panel="Reading"><h3 lang="en">Reading parallel task</h3><div class="english-material" lang="en"><p>After the community garden added labels to each planting area, fewer volunteers placed tools in the wrong shed. The labels did not change the gardening tasks, but they made it easier for new volunteers to understand where materials belonged.</p><fieldset><legend>What was the main effect of the labels?</legend><label><input type="radio" name="retestReading" value="a" /> They reduced the number of gardening tasks.</label><label><input type="radio" name="retestReading" value="b" /> They helped new volunteers organize materials correctly.</label><label><input type="radio" name="retestReading" value="c" /> They encouraged volunteers to plant more vegetables.</label></fieldset></div></section>
        <section class="retest-panel" data-retest-panel="Listening" hidden><h3 lang="en">Listening parallel task</h3><audio controls preload="metadata" data-retest-listening-audio src="/assets/listening-writing-center.mp3"><p>当前浏览器无法播放音频，请展开英文原文继续任务。</p></audio><div class="english-material" lang="en"><fieldset><legend>When and where will the workshop take place?</legend><label><input type="radio" name="retestListening" value="a" /> Wednesday at 2:15 in Room 204.</label><label><input type="radio" name="retestListening" value="b" /> Friday at 2:50 in Room 204.</label><label><input type="radio" name="retestListening" value="c" /> Friday at 2:15 in Room 204.</label></fieldset></div><details class="listening-transcript"><summary>音频不可用或需要核对时，查看英文原文</summary><p lang="en">The campus writing center has changed its workshop schedule. The session originally planned for Wednesday will take place on Friday at two fifteen in Room 204. Students who already registered do not need to sign up again.</p></details></section>
        <section class="retest-panel" data-retest-panel="Writing" hidden><h3 lang="en">Writing parallel task</h3><p class="english-prompt" lang="en">Describe one small habit that can help a student learn more consistently. Explain why it may help.</p><label class="writing-field"><span lang="en">Your response</span><textarea name="retestWriting" rows="8" maxlength="1200" lang="en" spellcheck="true"></textarea></label><fieldset class="self-review" lang="en"><legend>Self-review</legend><label><input type="checkbox" data-retest-writing-review /> I stated one clear habit.</label><label><input type="checkbox" data-retest-writing-review /> I explained why it may help.</label><label><input type="checkbox" data-retest-writing-review /> I checked my response.</label></fieldset></section>
        <section class="retest-panel" data-retest-panel="Speaking" hidden><h3 lang="en">Speaking parallel task</h3><p class="english-prompt" lang="en">Describe a place where you can study effectively. Explain what makes the place useful for you.</p><fieldset class="self-review" lang="en"><legend>After speaking aloud</legend><label><input type="checkbox" data-retest-speaking-review /> I spoke aloud for about 45–60 seconds.</label><label><input type="checkbox" data-retest-speaking-review /> I answered both parts of the prompt.</label><label><input type="checkbox" data-retest-speaking-review /> I gave one specific detail.</label></fieldset><p>本站不请求麦克风权限、不录音；完成状态由你确认。</p></section>
        <button class="button button-ink" type="submit">保存本次平行任务证据${arrow}</button><p class="form-inline-message" data-retest-message role="alert"></p>
      </form>
      <div class="chain-receipt" data-retest-result hidden aria-live="polite"><span>PARALLEL RETEST RECEIPT</span><h3 data-retest-result-title>平行任务已留证</h3><p data-retest-result-copy></p><dl><div><dt>retest_id</dt><dd data-retest-id></dd></div><div><dt>parallel_retest</dt><dd>true</dd></div></dl></div>
      <form id="plan-update-form" class="journey-form plan-update-form" hidden novalidate><h3>由你确认下一轮重点</h3><p>系统不会根据单题自动改分或决定能力。请选择下一轮计划重点；保存后会生成新的 plan_id，并保留上一轮计划的回链。</p><label><span>下一轮重点</span><select name="nextFocusSkill"><option value="Balanced">综合训练</option><option value="Reading">Reading · 阅读</option><option value="Listening">Listening · 听力</option><option value="Writing">Writing · 写作</option><option value="Speaking">Speaking · 口语</option></select></label><label class="consent-check"><input type="checkbox" name="learnerConfirmed" /><span><strong>我确认这是我的学习计划选择</strong><small>它不是系统自动诊断结论。</small></span></label><button class="button button-accent" type="submit">生成更新后的 7 天计划${arrow}</button><p class="form-inline-message" data-plan-update-message role="alert"></p></form>
      <dl class="compact-receipt" data-plan-update-receipt hidden><div><dt>updated_plan_id</dt><dd data-updated-plan-id></dd></div><div><dt>supersedes_plan_id</dt><dd data-superseded-plan-id></dd></div></dl>
    </div></section>
  </main>`;

const planContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({
      current: "plan",
      number: "02",
      label: "7 天学习计划",
      title: "把目标变成，<br />每天能完成的一小步。",
      lead: "选择每天可投入的时间与本周重点，规则生成器会即时制作一份 7 天安排。它用于行动规划，不进行官方评分或成绩预测。",
      note: "约 1 分钟完成设置",
    })}
    <section class="single-tool-section" aria-labelledby="plan-title">
      <div class="single-tool-inner">
        <header class="tool-panel-header"><div><span>01</span><div><p>计划生成器</p><h2 id="plan-title">设置你的学习节奏</h2></div></div><small data-plan-status>尚未生成</small></header>
        <div class="plan-layout">
          <form id="plan-form" class="plan-form" novalidate>
            <label><span>你的称呼 <small>选填</small></span><input name="nickname" type="text" maxlength="20" autocomplete="nickname" placeholder="例如：小林" /></label>
            <label><span>预计考试日期 <small>选填</small></span><input name="examDate" type="date" data-exam-date /></label>
            <label><span>每天可学习时间</span><select name="dailyMinutes"><option value="15">15 分钟</option><option value="30" selected>30 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option></select></label>
            <label><span>本周重点能力</span><select name="focusSkill"><option value="Balanced">综合训练</option><option value="Reading">Reading · 阅读</option><option value="Listening">Listening · 听力</option><option value="Writing">Writing · 写作</option><option value="Speaking">Speaking · 口语</option></select><small class="field-note" data-plan-focus-note>由你自行选择，不是诊断结论或能力评分。</small></label>
            <button class="button button-ink" type="submit">生成 7 天计划${arrow}</button>
            <p>计划由当前浏览器即时生成；姓名与考试日期不会上传。</p>
          </form>
          <div class="plan-output" aria-live="polite">
            <div class="plan-empty" data-plan-empty><span aria-hidden="true">7</span><h3>完成设置后，<br />这里会出现每天的任务。</h3><p>生成后可前往“今日任务”逐项完成。</p></div>
            <div data-plan-result hidden><div class="plan-result-heading"><div><span data-plan-owner>你的</span><h3>7 天学习计划</h3></div><p data-plan-summary></p></div><ol class="plan-days" data-plan-days></ol><a class="button button-accent plan-next-button" href="/today">查看今日任务${arrow}</a></div>
          </div>
        </div>
      </div>
    </section>
  </main>`;

const todayContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({
      current: "today",
      number: "02",
      label: "今日任务",
      title: "完成一项，<br />就留下一个学习证据。",
      lead: "今日清单会读取你的 7 天计划；还没有计划时，也会提供一组可立即开始的基础任务。完成状态按日期保存在本机。",
      note: "今日进度自动保存",
    })}
    <section class="single-tool-section" aria-labelledby="today-title">
      <div class="single-tool-inner">
        <header class="tool-panel-header"><div><span>02</span><div><p>今日清单</p><h2 id="today-title">今天先完成这三项</h2></div></div><small data-today-status>0 / 3 已完成</small></header>
        <div class="today-layout">
          <div><div class="task-progress"><progress max="3" value="0" data-task-progress>0 / 3</progress><span data-task-progress-text>0%</span></div><ul class="today-tasks" data-today-tasks>
            <li><input id="today-task-0" type="checkbox" data-task-index="0" /><label for="today-task-0"><strong>Reading 微练习</strong><span>阅读本站英文短文并完成理解题。</span></label></li>
            <li><input id="today-task-1" type="checkbox" data-task-index="1" /><label for="today-task-1"><strong>Writing 微练习</strong><span>完成英文写作提示并检查词数。</span></label></li>
            <li><input id="today-task-2" type="checkbox" data-task-index="2" /><label for="today-task-2"><strong>学习复盘</strong><span>写下今天最需要继续解决的一件事。</span></label></li>
          </ul></div>
          <aside class="today-next"><span>NEXT STEP</span><h3 data-next-task>先完成第一项任务</h3><p data-next-task-detail>完成状态会自动保存在当前浏览器。</p><a class="button button-ghost" href="/practice">去选择英文练习</a><a class="text-link" href="/plan">重新生成 7 天计划 →</a></aside>
        </div>
      </div>
    </section>
  </main>`;

const practiceContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({
      current: "practice",
      number: "03",
      label: "英文微练习",
      title: "四项能力，<br />各自进入独立练习页。",
      lead: "中文说明帮助你理解任务；真正的短文、音频脚本、写作题目与口语提示保留英文。材料为本站原创练习，不是真题。",
      note: "选择一项即可开始",
    })}
    <section class="practice-launch section" aria-labelledby="practice-launch-title">
      <div class="section-inner">
        <div class="practice-launch-heading"><p class="workspace-overline">CHOOSE ONE SKILL</p><h2 id="practice-launch-title">一个按钮，一个英文练习页面。</h2></div>
        <div class="practice-launch-grid">
          <a href="/practice-reading"><span>R</span><small>约 3 分钟</small><h3 lang="en">Reading</h3><p>阅读原创英文短文，完成一道主旨理解题。</p><b>进入阅读练习 →</b></a>
          <a href="/practice-listening"><span>L</span><small>可重复播放</small><h3 lang="en">Listening</h3><p>播放英文语音材料，捕捉日期与时间信息。</p><b>进入听力练习 →</b></a>
          <a href="/practice-writing"><span>W</span><small>建议 5 分钟</small><h3 lang="en">Writing</h3><p>根据英文提示作答，查看词数并完成三项自查。</p><b>进入写作练习 →</b></a>
          <a href="/practice-speaking"><span>S</span><small>60 秒</small><h3 lang="en">Speaking</h3><p>根据英文提示大声作答，使用页面计时练习。</p><b>进入口语练习 →</b></a>
        </div>
      </div>
    </section>
  </main>`;

const readingPracticeContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "practice", number: "R", label: "Reading 练习", title: "先读懂变化，<br />再判断作者意图。", lead: "阅读一段原创英文材料，选择最合适的答案。提交后会看到解释，不给出官方 DET 分数。", note: "约 3 分钟" })}
    <section class="single-practice-section"><article class="practice-card practice-card-single" data-practice="reading"><header><span>Reading</span><small>原创微练习 · 不是真题</small></header><p class="practice-instruction">阅读英文材料并选择最合适的答案。本题记录仅用于自学，不是官方 DET 评分或成绩预测。</p><div class="english-material" lang="en"><p>Maya noticed that the school library was busiest just before exams. Instead of adding more desks, the librarian created several quiet zones and one small area for group discussion. After two weeks, students reported that it was easier to choose a space that matched the way they needed to study.</p><fieldset><legend>Why did the librarian reorganize the space?</legend><label><input type="radio" name="reading-answer" value="a" /> To make the library look larger.</label><label><input type="radio" name="reading-answer" value="b" /> To support different ways of studying.</label><label><input type="radio" name="reading-answer" value="c" /> To reduce the number of students.</label></fieldset></div><button class="tool-action" type="button" data-check-reading disabled>检查答案</button><p class="practice-feedback" data-reading-feedback role="status" aria-live="polite">请选择一个答案。</p><a class="text-link" href="/practice">← 返回四项练习</a></article></section>
  </main>`;

const listeningPracticeContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "practice", number: "L", label: "Listening 练习", title: "听出关键变化，<br />抓住日期与时间。", lead: "点击播放英文材料，再回答信息理解题。可以重复播放，也可以在需要时查看英文原文。", note: "可重复播放" })}
    <section class="single-practice-section"><article class="practice-card practice-card-single" data-practice="listening"><header><span>Listening</span><small>原创微练习 · 不是真题</small></header><p class="practice-instruction">播放英文材料，听完后回答问题。本题记录仅用于自学，不是官方 DET 评分或成绩预测。</p><audio controls preload="metadata" data-listening-audio src="/assets/listening-science-club.mp3"><p>当前浏览器无法播放音频，请展开下方英文原文继续练习。</p></audio><p class="audio-status" data-audio-status role="status" aria-live="polite">可重复播放英文材料。</p><div class="english-material" lang="en"><fieldset><legend>When will the science club meet?</legend><label><input type="radio" name="listening-answer" value="a" /> Tuesday at 4:30.</label><label><input type="radio" name="listening-answer" value="b" /> Thursday at 4:30.</label><label><input type="radio" name="listening-answer" value="c" /> Thursday at 3:30.</label></fieldset></div><details class="listening-transcript"><summary>音频不可用或需要核对时，查看英文原文</summary><p lang="en">The science club moved its weekly meeting from Tuesday to Thursday because the laboratory is now used for another class on Tuesday afternoon. The meeting will still begin at four thirty.</p></details><button class="tool-action" type="button" data-check-listening disabled>检查答案</button><p class="practice-feedback" data-listening-feedback role="status" aria-live="polite">请先听材料并选择答案。</p><a class="text-link" href="/practice">← 返回四项练习</a></article></section>
  </main>`;

const writingPracticeContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "practice", number: "W", label: "Writing 练习", title: "写清一个观点，<br />再用理由支持它。", lead: "根据英文提示作答。页面会统计英文词数并保存草稿，三项自查帮助你完成一次可解释的自我复核。", note: "建议 5 分钟" })}
    <section class="single-practice-section"><article class="practice-card practice-card-single" data-practice="writing"><header><span>Writing</span><small>原创微练习 · 不是真题</small></header><p class="practice-instruction">阅读提示后用英文作答；内容只保存在本机。本题记录仅用于自学，不是官方 DET 评分或成绩预测。</p><p class="english-prompt" lang="en">Describe one change that could make your school or community a better place to learn. Explain why it would help.</p><label class="writing-field"><span lang="en">Your response</span><textarea rows="10" spellcheck="true" lang="en" data-writing-answer placeholder="Write your response in English..."></textarea></label><div class="writing-meta"><span><b data-word-count>0</b> words</span><span data-writing-save-status>尚未输入</span></div><fieldset class="self-review" lang="en"><legend>Self-review</legend><label><input type="checkbox" data-review="idea" /> I stated one clear idea.</label><label><input type="checkbox" data-review="reason" /> I gave a reason or example.</label><label><input type="checkbox" data-review="edit" /> I checked grammar and spelling.</label></fieldset><button class="tool-action" type="button" data-complete-writing disabled>达到 20 词并完成自查后标记完成</button><p class="practice-feedback" data-writing-feedback role="status" aria-live="polite">20 词只是任务完成条件，不代表写作水平。</p><a class="text-link" href="/practice">← 返回四项练习</a></article></section>
  </main>`;

const speakingPracticeContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "practice", number: "S", label: "Speaking 练习", title: "组织一个回答，<br />并在 60 秒内说出来。", lead: "阅读英文提示后开始计时并大声回答。本站不请求麦克风权限、不录音，也不上传你的声音。", note: "60 秒练习" })}
    <section class="single-practice-section"><article class="practice-card practice-card-single" data-practice="speaking"><header><span>Speaking</span><small>原创微练习 · 不录音</small></header><p class="practice-instruction">先准备 20 秒，再用 60 秒大声回答。本题记录仅用于自学，不是官方 DET 评分或成绩预测。</p><p class="english-prompt" lang="en">Talk about a skill you would like to learn. What is the skill, why is it useful, and how would you practice it?</p><div class="speaking-clock"><strong data-speaking-time>00:20</strong><span data-speaking-state>准备好后开始</span></div><p class="sr-only" data-speaking-announcement aria-live="polite"></p><div class="tool-button-row"><button class="tool-action" type="button" data-speaking-start>开始准备</button><button class="tool-action tool-action-secondary" type="button" data-speaking-reset>重置</button></div><fieldset class="self-review speaking-review" lang="en"><legend>Self-review after speaking</legend><label><input type="checkbox" data-speaking-review="answer" disabled /> I answered all parts of the prompt.</label><label><input type="checkbox" data-speaking-review="example" disabled /> I gave a reason or example.</label><label><input type="checkbox" data-speaking-review="flow" disabled /> I kept speaking in complete thoughts.</label></fieldset><p class="practice-feedback" data-speaking-feedback>建议结构：回答主题 → 给出原因 → 提供具体例子。</p><a class="text-link" href="/practice">← 返回四项练习</a></article></section>
  </main>`;

const focusContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "focus", number: "04", label: "专注计时", title: "给学习一段，<br />不被打断的时间。", lead: "选择 15、25 或 45 分钟，开始、暂停或重置计时。倒计时只在当前页面运行，不发送通知、不跟踪浏览行为。", note: "15 / 25 / 45 分钟" })}
    <section class="single-tool-section focus-single" aria-labelledby="focus-title"><div class="single-tool-inner narrow-tool"><header class="tool-panel-header"><div><span>04</span><div><p>专注计时器</p><h2 id="focus-title">现在开始一轮专注</h2></div></div><small>完成后去写复盘</small></header><div class="focus-timer"><label>专注时长<select data-focus-duration><option value="15">15 分钟</option><option value="25" selected>25 分钟</option><option value="45">45 分钟</option></select></label><div class="focus-clock"><span>FOCUS</span><strong data-focus-time>25:00</strong><p data-focus-state>准备开始</p></div><p class="sr-only" data-focus-announcement aria-live="polite"></p><div class="tool-button-row"><button class="button button-ink" type="button" data-focus-start>开始专注</button><button class="button button-ghost" type="button" data-focus-stop disabled>提前结束</button><button class="button button-ghost" type="button" data-focus-reset>重置</button></div><a class="button button-accent focus-next" href="/check-in">完成后记录学习复盘${arrow}</a></div></div></section>
  </main>`;

const checkInContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "check-in", number: "04", label: "证据式打卡", title: "写下真实困难，<br />让明天更容易开始。", lead: "一次记录同时包含做了什么、具体学习证据与仍待解决的问题。草稿会自动保存在本机；点击保存后，只形成 check_in_id，仍需下一页由你确认复盘。", note: "证据式打卡 · 本机保存" })}
    <section class="single-tool-section checkin-single" aria-labelledby="checkin-title">
      <div class="single-tool-inner narrow-tool">
        <header class="tool-panel-header"><div><span>04</span><div><p>今日打卡</p><h2 id="checkin-title">把今天的证据留下来</h2></div></div><small data-checkin-date></small></header>
        <div class="form-errors" data-checkin-errors role="alert" tabindex="-1" hidden><strong>请检查以下内容：</strong><ul></ul></div>
        <form id="checkin-form" class="checkin-form" novalidate>
          <label><span>复盘日期</span><input type="text" name="date" data-checkin-date-input readonly /></label>
          <label><span>关联今日任务 <small>闭环记录必选；独立打卡可选</small></span><select name="linkedTaskId" data-linked-task><option value="">不关联任务</option></select><small class="field-error" data-error-for="linkedTaskId"></small></label>
          <label><span>今天完成了什么？ <small>10–300 字</small></span><textarea name="didText" rows="5" minlength="10" maxlength="300" data-checkin-field="didText" placeholder="例如：完成了一篇英文短文阅读，并核对了主旨题。"></textarea><small class="field-error" data-error-for="didText"></small></label>
          <label><span>留下什么具体学习证据？ <small>10–500 字</small></span><textarea name="evidenceText" rows="7" minlength="10" maxlength="500" data-checkin-field="evidenceText" placeholder="可以写英文例句、摘要、错误修正或你真正弄懂的一点。"></textarea><small class="field-error" data-error-for="evidenceText"></small></label>
          <fieldset class="question-status"><legend>今天还有需要继续解决的问题吗？</legend><label><input type="radio" name="questionStatus" value="none" /> 暂时没有</label><label><input type="radio" name="questionStatus" value="has_question" /> 有一个问题</label><small class="field-error" data-error-for="questionStatus"></small></fieldset>
          <label data-question-wrap hidden><span>写下这个问题 <small>最多 300 字</small></span><textarea name="questionText" rows="4" maxlength="300" data-checkin-field="questionText" placeholder="明天要先解决的问题是……"></textarea><small class="field-error" data-error-for="questionText"></small></label>
          <div class="checkin-submit"><small data-checkin-draft-status>尚未输入</small><button class="button button-accent" type="submit">保存证据式打卡</button></div>
          <p class="save-message" data-note-status role="status" aria-live="polite">草稿只保存在当前浏览器；保存后还需由你确认复盘。</p>
          <dl class="compact-receipt" data-checkin-receipt hidden><div><dt>check_in_id</dt><dd data-checkin-id></dd></div><div><dt>plan_id</dt><dd data-checkin-plan-id></dd></div></dl>
          <a class="button button-ink journey-next-button" href="/review" data-checkin-review-link hidden>下一步：确认复盘${arrow}</a>
        </form>
      </div>
    </section>
  </main>`;

const reviewContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "05", label: "学生确认复盘", title: "先核对内容，<br />再由你明确确认。", lead: "本页读取当前闭环中刚保存的证据式打卡。你可以返回修正；只有勾选确认并提交后，才生成独立 review_id 与 learner_confirmed_review。", note: "确认与打卡分开留证" })}
    <section class="single-tool-section journey-tool-section" aria-labelledby="review-title"><div class="single-tool-inner narrow-tool">
      <header class="tool-panel-header"><div><span>05</span><div><p>复盘确认</p><h2 id="review-title">这是你愿意确认的记录吗？</h2></div></div><small data-review-status>等待证据式打卡</small></header>
      <div class="review-empty" data-review-empty><h3>当前闭环还没有待确认打卡</h3><p>先保存“做了什么 + 一条学习证据 + 一个问题”，再回到这里核对。</p><a class="button button-ink" href="/check-in">先完成证据式打卡${arrow}</a></div>
      <div class="review-ready" data-review-ready hidden>
        <article class="review-record" aria-labelledby="review-record-title"><span>CHECK-IN DRAFT FOR REVIEW</span><h3 id="review-record-title" data-review-date></h3><dl><div><dt>做了什么</dt><dd data-review-did></dd></div><div><dt>学习证据</dt><dd data-review-evidence></dd></div><div><dt>问题状态</dt><dd data-review-question></dd></div></dl><a class="text-link" href="/check-in">返回修正打卡 →</a></article>
        <form id="review-form" class="journey-form" novalidate><label class="consent-check"><input type="checkbox" name="learnerConfirmed" /><span><strong>我已核对，并确认这份复盘反映了我的学习记录</strong><small>如果内容不准确，请先返回修正；系统不会替你自动确认。</small></span></label><button class="button button-accent" type="submit">确认这份复盘${arrow}</button><p class="form-inline-message" data-review-message role="alert"></p></form>
        <dl class="compact-receipt" data-review-receipt hidden><div><dt>review_id</dt><dd data-review-id></dd></div><div><dt>check_in_id</dt><dd data-review-checkin-id></dd></div><div><dt>learner_confirmed_review</dt><dd>true</dd></div></dl>
        <a class="button button-ink journey-next-button" href="/community" data-review-next hidden>下一步：选择是否使用互助${arrow}</a>
      </div>
    </div></section>
  </main>`;

const myDataContent = `
  <main id="main-content" class="study-tool-page">
    ${studyPageHero({ current: "", number: "数", label: "我的本机数据", title: "知道数据在哪里，<br />也能自己带走或清除。", lead: "学习闭环数据，以及超级智能老师的对话副本和未发送人工请求，分别保存在当前浏览器的两个版本化命名空间中。本站没有账号系统，也不会自动同步到其他设备。", note: "你掌握数据控制权" })}
    <section class="single-tool-section data-page" aria-labelledby="data-title"><div class="single-tool-inner narrow-tool"><header class="tool-panel-header"><div><span>数</span><div><p>数据控制</p><h2 id="data-title">当前浏览器中的 Sufeiya 数据</h2></div></div><small data-data-status>正在读取</small></header>
      <div class="data-facts"><article><strong>两个本机命名空间</strong><p>学习闭环与超级老师对话分开保存；下方导出和清除会明确列出范围。</p></article><article><strong>本地但未加密</strong><p>同一设备上的其他使用者可能看到这些记录，请勿填写敏感成绩截图或身份材料。</p></article><article><strong>不保存录音</strong><p>口语练习不申请麦克风权限，也不会储存或上传声音。</p></article></div>
      <div class="data-summary" data-data-summary><p>正在统计本机记录…</p></div>
      <div class="data-actions"><button class="button button-ink" type="button" data-export-workspace>导出全部本机 JSON 数据</button><button class="button button-ghost" type="button" data-clear-workspace>仅清除学习闭环数据</button><button class="button button-ghost" type="button" data-clear-super-teacher>仅清除超级老师对话</button><button class="button button-ghost" type="button" data-clear-all-sufeiya>清除全部本机 Sufeiya 数据</button></div>
      <p class="save-message" data-data-message role="status" aria-live="polite">导出文件包含两个命名空间，可用于个人备份；本站目前不提供导入或云同步。</p>
    </div></section>
  </main>`;

const pages = [
  {
    filename: "index.html",
    page: "home",
    path: "/",
    title: "苏肥鸭多邻国｜Sufeiya DET 在线学习平台",
    description: "面向中国大陆 DET 学习者的中文在线学习平台，可直接生成学习计划、完成今日任务、练习英文听说读写并保存复盘。",
    content: homeContent,
  },
  {
    filename: "workspace.html",
    page: "workspace",
    path: "/workspace",
    title: "学习工作台｜苏肥鸭多邻国在线学习平台",
    description: "直接使用 Sufeiya 学习工作台：生成 7 天 DET 学习计划、完成今日任务、练习英文听说读写、专注计时并保存本机复盘。",
    content: workspaceContent,
    scripts: ["/workspace.js", "/journey.js"],
  },
  {
    filename: "diagnostic.html",
    page: "diagnostic",
    path: "/diagnostic",
    title: "演示性初筛｜苏肥鸭学习工作台",
    description: "建立不上传数据、不提供分数的 Gate A 演示诊断会话，汇总本机练习证据并确认学习优先项。",
    content: diagnosticContent,
    scripts: ["/workspace.js", "/journey.js"],
  },
  {
    filename: "plan.html",
    page: "plan",
    path: "/plan",
    title: "7 天学习计划｜苏肥鸭学习工作台",
    description: "按每日时间与重点英文能力，在浏览器中生成一份可执行的 7 天 DET 学习计划。",
    content: planContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "today.html",
    page: "today",
    path: "/today",
    title: "今日任务｜苏肥鸭学习工作台",
    description: "查看并完成今天的 DET 学习任务，实时保存本机进度与下一步提示。",
    content: todayContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "recommendations.html",
    page: "recommendations",
    path: "/recommendations",
    title: "可解释推荐｜苏肥鸭学习工作台",
    description: "根据本机 7 天计划生成一个主任务与至多两个可选补充，明确显示推荐原因、来源、时长和验证方式。",
    content: recommendationsContent,
    scripts: ["/workspace.js", "/journey.js"],
  },
  {
    filename: "practice.html",
    page: "practice",
    path: "/practice",
    title: "英文微练习｜苏肥鸭学习工作台",
    description: "选择 Reading、Listening、Writing 或 Speaking 独立页面，直接开始原创英文微练习。",
    content: practiceContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "practice-reading.html",
    page: "practice-reading",
    path: "/practice-reading",
    title: "Reading 英文微练习｜苏肥鸭学习工作台",
    description: "阅读原创英文短文并完成一题理解练习；本题反馈用于自学，不是官方 DET 评分。",
    content: readingPracticeContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "practice-listening.html",
    page: "practice-listening",
    path: "/practice-listening",
    title: "Listening 英文微练习｜苏肥鸭学习工作台",
    description: "播放原创英文材料并完成一题信息理解练习；本题反馈用于自学，不是官方 DET 评分。",
    content: listeningPracticeContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "practice-writing.html",
    page: "practice-writing",
    path: "/practice-writing",
    title: "Writing 英文微练习｜苏肥鸭学习工作台",
    description: "根据英文提示写作、查看词数并完成英文自查；本站不提供 AI 或官方 DET 评分。",
    content: writingPracticeContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "practice-speaking.html",
    page: "practice-speaking",
    path: "/practice-speaking",
    title: "Speaking 英文微练习｜苏肥鸭学习工作台",
    description: "根据英文提示完成 60 秒口语计时练习；本站不录音、不上传，也不提供官方 DET 评分。",
    content: speakingPracticeContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "focus.html",
    page: "focus",
    path: "/focus",
    title: "专注计时｜苏肥鸭学习工作台",
    description: "使用 15、25 或 45 分钟本机专注计时器，完成一段不被打断的 DET 学习。",
    content: focusContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "check-in.html",
    page: "check-in",
    path: "/check-in",
    title: "学习复盘｜苏肥鸭学习工作台",
    description: "按日期记录今天完成的学习、真实困难与明天的优先行动，内容只保存在当前浏览器。",
    content: checkInContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "review.html",
    page: "review",
    path: "/review",
    title: "学生确认复盘｜苏肥鸭学习工作台",
    description: "核对当前闭环中的证据式打卡，并由学习者明确确认后生成独立 review_id。",
    content: reviewContent,
    scripts: ["/journey.js"],
  },
  {
    filename: "community.html",
    page: "community",
    path: "/community",
    title: "自愿社区互助｜苏肥鸭学习工作台",
    description: "在真实社区尚未开放时，用合成经验卡演示并保存 used、declined、not_needed 或 unavailable 自愿状态。",
    content: communityContent,
    scripts: ["/workspace.js", "/journey.js"],
  },
  {
    filename: "retest.html",
    page: "retest",
    path: "/retest",
    title: "平行微复测与更新计划｜苏肥鸭学习工作台",
    description: "完成一条原创平行微任务，保存可解释证据，并由学习者确认生成更新后的 7 天计划。",
    content: retestContent,
    scripts: ["/workspace.js", "/journey.js"],
  },
  {
    filename: "my-data.html",
    page: "my-data",
    path: "/my-data",
    title: "我的本机数据｜苏肥鸭学习工作台",
    description: "查看、导出或仅清除当前浏览器中的 Sufeiya 学习计划、任务进度、练习草稿与复盘数据。",
    content: myDataContent,
    scripts: ["/workspace.js"],
  },
  {
    filename: "learning-path.html",
    page: "learning-path",
    path: "/learning-path",
    title: "学习路径｜苏肥鸭多邻国在线学习平台",
    description: "了解 Sufeiya 从学习诊断、计划、内容推荐、打卡、复盘到微复测与再诊断的七步学习闭环。",
    content: learningPathContent,
  },
  {
    filename: "platform.html",
    page: "platform",
    path: "/platform",
    title: "平台功能｜苏肥鸭多邻国在线学习平台",
    description: "直接进入基础学习工作台，并了解全科诊断伴学课、苏肥鸭超级智能老师、带教打卡营与自愿社区互助等分阶段能力。",
    content: platformContent,
  },
  {
    filename: "resources.html",
    page: "resources",
    path: "/resources",
    title: "学习资源｜苏肥鸭多邻国在线学习平台",
    description: "以中文学习界面连接英文 DET 备考材料，并访问苏肥鸭老师的 Bilibili 课程视频与图文资源。",
    content: resourcesContent,
    scripts: ["/resources.js"],
  },
  {
    filename: "about.html",
    page: "about",
    path: "/about",
    title: "关于我们｜苏肥鸭多邻国在线学习平台",
    description: "了解 Sufeiya 在线学习平台的团队角色、服务边界、语言规则与常见问题。",
    content: aboutContent,
  },
];

const shell = ({ page, path, title, description, content, scripts = [] }) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="#f8f5ed" />
    <meta name="color-scheme" content="light" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <link rel="canonical" href="https://sufeiya.cn${path}" />
    <link rel="icon" href="/assets/sufeiya-mark.png" type="image/png" />
    <link rel="apple-touch-icon" href="/assets/sufeiya-mark.png" />
    <link rel="preload" href="/assets/sufeiya-logo.png" as="image" />
    <link rel="stylesheet" href="/styles.css" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:site_name" content="苏肥鸭多邻国" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="https://sufeiya.cn${path}" />
    <meta property="og:image" content="https://sufeiya.cn/assets/sufeiya-logo.png" />
    <meta property="og:image:width" content="2792" />
    <meta property="og:image:height" content="560" />
    <meta property="og:image:alt" content="苏肥鸭多邻国品牌标志" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://sufeiya.cn/assets/sufeiya-mark.png" />
    <title>${title}</title>
    <script type="application/ld+json">
      ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": page === "home" ? "WebSite" : "WebPage",
        name: title,
        url: `https://sufeiya.cn${path}`,
        inLanguage: "zh-CN",
        description,
        isPartOf: page === "home" ? undefined : { "@type": "WebSite", name: "苏肥鸭多邻国", url: "https://sufeiya.cn/" },
      }).replace(',"isPartOf":undefined', "")}
    </script>
    <script src="/script.js" defer></script>
    ${scripts.map((source) => `<script src="${source}" defer></script>`).join("\n    ")}
  </head>
  <body data-page="${page}">
    ${header(page)}
    ${content}
    ${footer()}
  </body>
</html>
`;

for (const page of pages) {
  const html = shell(page).replace(/[ \t]+$/gm, "");
  await writeFile(new URL(`../${page.filename}`, import.meta.url), html, "utf8");
}

process.stdout.write(`Generated ${pages.length} Sufeiya pages in ${root}\n`);
