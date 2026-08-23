# P0 公开 Reading 纵向切片工程回执

> 候选日期：2026-08-23
>
> 工作树：`/Volumes/WestWorld/Sufeiya/worktrees/learning-platform-next-20260819`
>
> 分支：`codex/learning-platform-next-20260819`
>
> 基线：`bf7cac8b3163ed5c00c5bc57607b63266ff22b21`
>
> 不可变产品评审候选：本文件所在的本地 Git commit；交付时以 `git rev-parse HEAD` 得到并记录完整 SHA
>
> 当前结论：`LOCAL ENGINEERING CANDIDATE / NOT AUTHORIZED FOR PREVIEW OR PUBLIC RELEASE`

本回执记录计划在代码中的落地范围、证据和仍未完成的外部 Gate。它不记录教师接受、隐私/法律批准、Preview deployment、生产发布或线上回归。

## 1. 已落地的用户旅程

```text
首页主 CTA
→ /learn/reading（无需 Clerk，不在 Gate A protected routes）
→ 2 道入门检查
→ 首次作答证据与确定性推荐
→ 版本化微课
→ 3 道主动练习
→ 正确解释或五段式错误反馈
→ 2 道全新短文的独立平行复测
→ 更新“今天优先练什么”
→ 查看 / 导出 / 双确认删除本机记录
→ 获得价值后：本机保留、导出、受邀登录、了解等候名单
```

公开 SignUp 没有进入页面、事件枚举或价值后 CTA。既有 `/practice-reading` 仍属于受邀 Clerk + beta Gate A，未被匿名化。

## 2. 关键实现边界

| 边界 | 实现 |
|---|---|
| 匿名路由 | 新增静态 App Router `/learn/reading`，metadata 为 `index=false, follow=false`，暂不进入 sitemap |
| Clerk 隔离 | Server page → `PublicLearningShell` → `OfflineNavigationBoundary + SiteFrame`；未导入 Clerk provider/hook/access boundary |
| 内容 | `reading_p0_original_v1`，2 baseline + 3 practice + 2 independent retest；每个任务/微课显式绑定来源、权利状态、内容包版本和待审 reviewer；全部为一方原创草案且待教师审核/权利确认 |
| 评分/推荐 | 纯函数、首答证据、少于 2 道返回 `evidence_insufficient`；基线与复测后都显示完整五段证据链，复测剩余错项可更新优先能力 |
| 反馈 | baseline/practice 每题给可行动反馈；两道 retest 先全部锁定首次作答，再统一展示反馈，避免第一题讲解污染第二题测量 |
| 数据 | 两个新本机 namespace；严格 schema、证据顺序、容量上限、Web Lock/CAS、写锁内二次阻断与跨 namespace 生命周期/答案一致性核对 |
| 控制 | 页面内查看、JSON 导出、双确认删除；未知/损坏时逐 namespace 保全原始值并只读；合法状态与滞后事件组合进入显式 `event_degraded`，冻结事件写入但不阻断本机学习 |
| 事件 | 10 个精确事件名、完整生命周期、证据派生 `plan_offered`、逐事件 payload 白名单、`local_only_no_network`、无身份/自由文本/公开注册 |
| 旧边界 | 未修改 `workspace.js`、`journey.js`、`learning-events.js`、`workspace-backup.js`、Clerk protected-route list 或旧任务登记表 |
| 真人/AI | 固定真人教师与 AI 学习助手文案；公开 Reading 明示不启用 AI |
| 首页肖像 | 4:5、640/960/1280、AVIF/WebP、14–73 KiB；原 13.7 MB JPEG 未进入仓库；公开用途仍待接受 |

详细数据合同见 [`public-reading-local-data-contract.md`](./public-reading-local-data-contract.md)，教学审核范围见 [`public-reading-content-review-packet.md`](./public-reading-content-review-packet.md)，肖像工程与用途边界见 [`teacher-portrait-homepage-use-receipt.md`](./teacher-portrait-homepage-use-receipt.md)。

## 3. 本次变更 allowlist

主要新增：

- `app/learn/reading/**`；
- `components/public-learning/**`、`components/public-learning-shell.tsx`；
- `lib/public-learning/**`；
- `tests/public-reading-*.test.ts`；
- `e2e/public-reading/**`、`playwright.public-reading.config.ts`；
- `e2e/offline-navigation/offline-navigation.spec.ts`（首页权威 CTA 改名后的同语义离线定位更新）；
- `playwright.offline.config.ts`（默认端口仍为 `3211`；增加严格数字/非特权端口覆盖，避免碰撞时终止其他工作区服务）；
- `assets/teacher-portrait/**`、`public/assets/teacher-portrait/**`；
- `data/teacher-portrait-assets.v1.json`；
- `docs/p0/public-reading-*` 与教师肖像回执。
- `docs/development-plans/2026-08-19-codex-session-01a01886-learning-platform-development-plan.md`：实现开始前已经存在于本工作树、由用户指定的 governing plan；本候选保留它作为来源文件，不把它冒充实现过程中从其他分支搬入的代码。

权威首页及全站入口调整：

- `scripts/generate-pages.mjs` 与由它生成的 21 个根目录 HTML；
- `styles.css`；
- `components/site-frame.tsx`、`components/clerk-account-controls.tsx`、`components/site-shell.tsx`、`lib/site.ts`；
- `scripts/build-legacy-content.mjs`、`scripts/verify-site.mjs`、`scripts/verify-next-build.mjs`、`package.json`、`README.md`；其中 `verify-next-build.mjs` 负责从生成后的公开 Reading HTML、RSC、route/client manifests 与实际脚本图复验 Clerk/Sofia/API 客户端隔离。

明确 no-touch：

- `workspace.js`、`journey.js`、`learning-events.js`、`workspace-backup.js` 及其旧合同；
- `data/practice-task-register.json`、`data/diagnostic-task-register.json`；
- `lib/auth/clerk-config.ts`、`proxy.ts`；
- `/practice-reading` 的受邀保护、任务正文、数据/事件合同、auth 与现有 protected route wrappers；该页面的全局 header/mobile-nav/footer 外壳与其他生成 HTML 一同由权威生成器更新；
- Sofia/教研/release-governance 业务逻辑。

### 3.1 并行工作树与路径重叠归属

并行 `codex/typed-learning-modules-20260819` 工作树在审计时没有可挑取 commit，且仍是独立的未提交架构实验；本候选没有 bulk copy、cherry-pick 或搬运其中的业务实现。两个工作树共有 20 个被修改路径：

```text
check-in.html
community.html
diagnostic.html
focus.html
my-data.html
package.json
plan.html
practice-listening.html
practice-reading.html
practice-speaking.html
practice-writing.html
practice.html
recommendations.html
retest.html
review.html
scripts/build-legacy-content.mjs
scripts/generate-pages.mjs
scripts/verify-site.mjs
today.html
workspace.html
```

本候选的 16 个 HTML 重叠路径都只是 `scripts/generate-pages.mjs` 可重现的全局 shell/CTA 结果；`package.json` 只接入公开 Reading 单元/E2E；`build-legacy-content.mjs` 只同步首页肖像衍生物；`generate-pages.mjs` 只负责公开入口、首页旅程与人物卡；`verify-site.mjs` 只增加本切片边界验证。逐文件新增行业务比较没有发现共同业务实现。

旧工作树 `/Volumes/WestWorld/Sufeiya/website` 在本候选建立前已经为 `codex/next-clerk-launch-20260809@8f8110b`、相对 `origin/main` 为 `+0/-33`，且只含既有 `app/layout.tsx`、`package-lock.json`、`package.json` 修改与未跟踪 `scripts/generate-next-content.mjs`；四个路径时间均早于 2026-08-19 本工作树建立。本次没有修改、清理、暂存或搬运该旧工作树。

### 3.2 最终候选 Git 快照与 whitespace

- 分支：`codex/learning-platform-next-20260819`；
- 候选 parent：`bf7cac8b3163ed5c00c5bc57607b63266ff22b21`；不可变产品候选为本文件所在 commit，交付时另行记录完整 SHA；
- upstream：`origin/main`；产品候选相对上游为 `ahead 1 / behind 0`；
- 提交前候选快照为 34 个 tracked modified + 30 个实际 untracked = 64 个文件；64 个精确路径全部进入同一个产品评审 commit，提交后没有 staged、unstaged 或 untracked 候选残留；
- tracked `git diff --check`：PASS；
- 18 个 untracked 文本/JSON/TypeScript/CSS/Markdown 文件逐项执行等价 `git diff --no-index --check /dev/null <path>`：`18/18 PASS`；其余 untracked 为 12 个已登记的 AVIF/WebP 二进制衍生物；
- 21 个被修改的根 HTML 与权威生成器清单完全相同，并在全新临时副本中重跑为 `21/21` byte-identical；
- `next-env.d.ts` 与 HEAD 相同；`.next/`、`output/`、`.playwright-cli/` 均被忽略，`test-results/` 与 `playwright-report/` 不存在，没有诊断副产物进入候选 diff。

## 4. 本机技术证据

### 建立实现前的基线

- `git diff --check`：PASS。
- `npm run check`：PASS；legacy `1674` checks、Node `246/246`、TypeScript、Next build 与匿名 404 bundle verifier 均通过；ESLint 为 0 error、6 个既有 `journey.js` warning。
- `npm run test:e2e:offline`：`2/2 PASS`。

### 当前安装版本说明复核

当前安装版本为 Next.js `16.3.0`。计划要求的“修改前先读当前安装文档”没有在最初实现时留下可追溯回执；为避免反向补写成未发生的事实，本候选把它如实记录为交付前补充审查。已完整复核当前安装包内与本路由有关的：

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`；
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`；
- `node_modules/next/dist/docs/01-app/02-guides/package-bundling.md`。

复核结果与当前设计一致：route `page.tsx` 保持 Server Component，交互面通过最小 Client Component 边界进入；`metadata` 在服务端静态声明；构建级 verifier 从生成后的 route HTML/RSC/client manifests 收集实际脚本并检查 Clerk/Sofia/API 隔离。

### 当前候选的最终本机技术证据

- `npm run check`：PASS。它在当前候选上重新生成受管 Next 内容，并依次通过：
  - legacy verifier `1758 checks`；
  - Node 测试 `274/274`（Clerk `25`、offline unit `3`、public Reading `28`、governance `28`、workspace backup `73`、teaching review `28`、super-teacher `89`）；
  - TypeScript；
  - ESLint `0 errors / 6 warnings`，6 条均位于本次 no-touch 的 `journey.js`；
  - Next.js `16.3.0` production build、`32/32` 静态页面生成；
  - build verifier：匿名 404 的 15 个实际引用脚本与公开 Reading 的 17 个实际引用脚本均不含被禁止的 Clerk/Sofia/API 客户端依赖。
- `npx playwright test --config=playwright.public-reading.config.ts`：`11/11 PASS`（fresh production build），覆盖：
  1. 首页两次点击、匿名进入、旧 namespace 不变、零写请求；
  2. 同标签页快速双提交串行化；
  3. 7 题完整闭环、两题复测先锁定后统一反馈、前后五段推荐链、24 条学习事件；
  4. 四个价值后替代 CTA、29 条含 continuation 的 local-only 事件、下载导出、公开 SignUp 关闭；
  5. 合法形状但证据矛盾的 `plan_offered` 恢复失败关闭；
  6. 损坏/未知版本与两个 namespace 单边损坏逐项保全；
  7. 无 Web Locks 时已有记录只读、空记录只在内存继续；
  8. 多标签页 state/events 冲突后只读并导出最新快照；
  9. state/event 都存在且各自合法但不一致时 `event_degraded`、继续学习、导出标记、删除与新一轮重启；
  10. state 或 events 单个 namespace 合法缺失时，启动、查看与下载导出共享同一空值语义，并保留 `event_degraded + issues`；
  11. 全程键盘操作、焦点迁移、390×844 移动、横屏、200% reflow、文字和非文字控件对比度、零横向溢出与零 console error。
- `SUFEIYA_OFFLINE_E2E_PORT=3216 npm run test:e2e:offline`：`2/2 PASS`。默认 `3211` 当时被另一个 HELP MATH 工作区的开发服务器占用；没有终止或复用该无关进程，而是使用新增的严格端口覆盖在空闲端口完成同一套 production-build 回归。
- Playwright CLI 人工巡检已打开桌面首页、公开 Reading 首屏、移动 390px 首屏、移动英文任务卡与五段错误反馈；在最新 production build 上又以 1440×1000 完整走完 7 题并目视检查深色最终计划卡，五段推荐链可读且无裁切，console 为 `0 error / 0 warning`。自动化 Chromium 同时断言最终链文字对比度不低于 `4.5:1`。这些都是工程 QA，不是教师体验验收。

需要真实 Clerk Development 凭据的既有账户 E2E 本次没有运行；当前工作树没有 `.env.local`，环境也没有形成可用的 Clerk Development 配置。不得把 Clerk 单元合同 `25/25`、公开匿名 E2E 或无凭据状态写成真实 Clerk 会话回归 PASS。Preview Web Vitals/LCP 也尚未建立，所以正式 G2 仍不能整体升级为 PASS。

## 5. 性能与图片证据

源图 `/Volumes/WestWorld/Sufeiya/最新微笑版.jpg` 为 `3840×5760`、`13,713,402 bytes`，SHA-256 为 `f0c23e3b73952cd70c085f71f9e4ca556075c8d14d140ac2dcc22f3df4954c24`，没有复制进仓库。

首页实际使用 4:5 `picture/srcset`：

| 宽度 | AVIF | WebP |
|---:|---:|---:|
| 640 | 14,218 B | 21,890 B |
| 960 | 27,436 B | 44,824 B |
| 1280 | 45,664 B | 72,744 B |

6 个文件都低于 80 KiB，工程目录与 `public/` 副本逐字节一致，manifest SHA-256 与完整解码通过。真实移动 Chromium 选择响应式 AVIF/WebP，decoded body 小于 80 KiB，未请求原 JPEG。尚未建立 Preview Web Vitals/LCP 基线，故不能声称生产性能改善。

## 6. Gate 状态

状态只使用计划批准的枚举。

| Gate | 当前状态 | 本次证据/阻塞 |
|---|---|---|
| G0a 工作树建立 | `PASS` | 独立工作树来自 `origin/main@bf7cac8b…`；旧工作树未被本次实现修改 |
| G0b 当前发布 diff 与归属 | `PASS` | 64 个候选文件全部落在明确 allowlist/预存 governing plan 内；tracked + untracked whitespace、21/21 生成一致性、no-touch 边界、并行 worktree 归属和诊断副产物均已复核 |
| G1 教学内容 | `PENDING` | 内容包与独立复测齐备，但 Reading 选择、语言、难度、答案、反馈和测量关系均未获真人教师/内容负责人接受 |
| G2 技术与浏览器 | `IN PROGRESS` | 当前本机代码、build、unit、公开 Reading `11/11` 与旧离线 `2/2` 均通过；仍缺真实 Clerk Development E2E、Preview LCP/Web Vitals 与外部验收要求的完整 a11y/performance 证据 |
| G3 数据、隐私与注册边界 | `PENDING` | 工程合同、禁用字段、本机控制与 SignUp 关闭已实现；仍待 Product/Privacy/Legal 对实际数据流和用户说明接受 |
| G4 真人教师、人物用途与条件性队列 | `PENDING` | 纯客观 Reading 无开放题，真实教师开放题队列子项为 `NOT IN SCOPE`；内容/体验/身份文案/首页肖像用途仍待接受 |
| G5 Preview 候选 | `PENDING` | 本地不可变产品评审 commit 与候选级回滚步骤已经形成；仍无 deployment metadata、前一 deployment 绑定、Preview、Preview 性能证据或 Release Owner 决定；本次未部署 |
| G6 公开发布授权 | `PENDING` | 没有绑定不可变候选的授权人发布决定 |
| G7 生产部署与线上回归 | `PENDING` | 没有生产部署；未触碰 `sufeiya.cn` |
| G8 账户同步 | `PENDING` | P0 明确为浏览器本机、非账户绑定；跨设备/RBAC/退出同步后置 |
| G9 Grounded Sofia | `BLOCKED` | 本次公开 Reading 不启用 AI；既有治理 Gate 不变 |
| G10 语音/数字人 | `BLOCKED` | 本次没有录音、语音或数字人；独立授权和治理仍未满足 |

## 7. 明确未完成与不应宣称

当前不得宣称：

- Product Owner/苏肥鸭老师已选择 Reading；
- 7 个任务、微课、反馈或整体体验已经教师审核；
- 首页照片已获得公开使用授权；
- G3 隐私、注册或目标地区法律评审已通过；
- Preview 已建立、HTTP 200 已核验或 deployment metadata 已绑定；
- 已获公开发布授权或已经部署到生产；
- `/learn/reading` 是正式诊断、官方 DET 分数、掌握度、AI 自适应学习或学习增长证明；
- 本机记录可以跨设备、与账户同步、被教师看到或由服务器恢复。

## 8. 发布前必须完成的下一组动作

1. Product Owner 与真人教师/内容负责人对 Reading 选择和 [`public-reading-content-review-packet.md`](./public-reading-content-review-packet.md) 逐项签收或给出阻塞修改。
2. 肖像权利人/授权代表按精确源图 hash、首页位置和排除用途接受 [`teacher-portrait-homepage-use-receipt.md`](./teacher-portrait-homepage-use-receipt.md)，或在候选中撤下图片。
3. Product、Privacy、Legal 按 [`public-reading-local-data-contract.md`](./public-reading-local-data-contract.md) 核对真实数据流、用户说明、支持/删除边界和等候名单/登录文案。
4. 若对本文件所在不可变产品候选再做任何产品、内容、数据合同、资产或验证 wiring 编辑，必须形成新的候选 commit，并重新执行 diff allowlist、whitespace、`npm run check`、公开 Reading 与旧离线 E2E；获得受控 Clerk Development 凭据后还要单独运行/记录既有 Clerk E2E，无凭据不能写成 PASS。
5. 由 Release Owner 决定是否基于该不可变 commit 建立受控 Preview；Preview 成功仍不等于 G6 公开发布授权。
6. 只有 G0b、G1–G6 全部 PASS 且无 PENDING/FAIL/BLOCKED 后才能部署；部署后另做 G7 规范域名回归。

## 9. 候选级回滚与肖像撤回边界

本工作树已经形成一个本地不可变产品评审 commit，但没有 push、Preview deployment 或生产 deployment，因此当前没有可执行的远端回滚动作，也没有改变任何线上 alias。未来 Release Owner 若批准建立 Preview，必须先在决策单中绑定：候选 commit SHA、不可变 deployment ID、当时的前一已知正常 deployment ID、执行人角色和回滚触发条件。

候选级回滚遵循以下顺序：

1. 若尚未提升 alias，停止发布并保留当前生产部署；不得以“Preview 构建成功”代替回滚准备。
2. 若 Preview 或生产 alias 已指向本候选，由 Release Owner 按已绑定的前一不可变 deployment 恢复 alias；仓库侧以一个经过审阅的 revert 还原同一候选 commit，不使用未归因的部分文件覆盖。
3. 代码回滚范围必须一起覆盖首页公开 CTA/文案、`/learn/reading` 路由与 public-learning 模块、两个新 namespace 的 UI/合同、最小事件、肖像衍生物引用、生成 HTML 与 build/verifier wiring。回滚不得删除学习者浏览器中的本机记录；若旧页面不再读取新 namespace，它们保持孤立，后续删除/迁移需另行批准。
4. 回滚后重新核对规范域名 `/`、`/learn/reading`、`/sign-in`、`/workspace`，首页肖像资源 URL、公开 SignUp 关闭、关键旅程、HTTP 状态、console、deployment/commit 绑定与旧 Gate A namespace 未变。
5. 任一步骤无法恢复前一不可变部署或核验失败时，保持 G6/G7 关闭并升级给 Release Owner；不得继续公开发布。

肖像用途撤回是独立控制：权利人可要求从首页撤下肖像并移除相应衍生物引用，而不必回滚整个 Reading 学习切片；反过来，候选级代码回滚也不应被误写成已经处理所有权利撤回请求。具体联系人角色、源图 hash、用途排除与下架流程仍以教师肖像回执为准。
