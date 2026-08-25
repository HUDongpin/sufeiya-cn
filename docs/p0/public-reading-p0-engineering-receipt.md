# P0 公开 Reading 纵向切片工程回执

> 候选日期：2026-08-23；全部授权确认：2026-08-26
>
> 工作树：`/Volumes/WestWorld/Sufeiya/worktrees/learning-platform-next-20260819`
>
> 分支：`codex/learning-platform-next-20260819`
>
> 基线：`bf7cac8b3163ed5c00c5bc57607b63266ff22b21`
>
> 被接受的不可变产品候选：`af85403cd97eff47afeea93582705a15aa7527a3`
>
> 第一份后续证据 commit：`dc8a637f2c9fe4f582855ec4f16c68e0b7adaa2b`，只记录 2026-08-23 接受决定与内容审核元数据，不改学习文本、答案、反馈、推荐、数据合同实现或用户旅程
>
> 当前结论：`PUBLIC READING P0 RELEASED / G0a–G7 PASS`

本回执记录计划在代码中的落地范围、技术证据、真人/Owner 决定、Preview、生产 deployment 与规范域名回归。2026-08-26 的全部授权允许 push、PR、受控 Preview，以及在精确候选的发布前 Gate 全部通过后生产发布；授权本身没有冒充部署证据，G5–G7 只在外部系统与真实浏览器分别形成证据后关闭。

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
| 内容 | `reading_p0_original_v1`，2 baseline + 3 practice + 2 independent retest；2026-08-23 已由苏肥鸭以 Teacher / Content Owner 身份接受候选 `af85403…`，每个任务/微课显式绑定来源、权利状态、内容版本、审核人/角色、日期、候选 commit 与证据引用；独立 Preview/发布/G7 证据形成后为 `released_public_reading_p0` |
| 评分/推荐 | 纯函数、首答证据、少于 2 道返回 `evidence_insufficient`；基线与复测后都显示完整五段证据链，复测剩余错项可更新优先能力 |
| 反馈 | baseline/practice 每题给可行动反馈；两道 retest 先全部锁定首次作答，再统一展示反馈，避免第一题讲解污染第二题测量 |
| 数据 | 两个新本机 namespace；严格 schema、证据顺序、容量上限、Web Lock/CAS、写锁内二次阻断与跨 namespace 生命周期/答案一致性核对 |
| 控制 | 页面内查看、JSON 导出、双确认删除；未知/损坏时逐 namespace 保全原始值并只读；合法状态与滞后事件组合进入显式 `event_degraded`，冻结事件写入但不阻断本机学习 |
| 事件 | 10 个精确事件名、完整生命周期、证据派生 `plan_offered`、逐事件 payload 白名单、`local_only_no_network`、无身份/自由文本/公开注册 |
| 旧边界 | 未修改 `workspace.js`、`journey.js`、`learning-events.js`、`workspace-backup.js`、Clerk protected-route list 或旧任务登记表 |
| 真人/AI | 固定真人教师与 AI 学习助手文案；公开 Reading 明示不启用 AI |
| 首页肖像 | 4:5、640/960/1280、AVIF/WebP、14–73 KiB；原 13.7 MB JPEG 未进入仓库；2026-08-26，同一可追溯身份“苏肥鸭”明确“全部授权，肖像都有授权”，绑定源图 SHA-256、全部 6 个衍生物、限定首页人物卡与撤回流程；P0 外用途仍不在发布面 |

详细数据合同见 [`public-reading-local-data-contract.md`](./public-reading-local-data-contract.md)，教学审核范围见 [`public-reading-content-review-packet.md`](./public-reading-content-review-packet.md)，肖像工程与用途边界见 [`teacher-portrait-homepage-use-receipt.md`](./teacher-portrait-homepage-use-receipt.md)，2026-08-23 原始决定与 2026-08-26 最终授权的 Gate 效力见 [`public-reading-p0-review-decision-receipt.md`](./public-reading-p0-review-decision-receipt.md)。

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
- 候选 parent：`bf7cac8b3163ed5c00c5bc57607b63266ff22b21`；被 Teacher / Content Owner 接受的不可变产品候选为 `af85403cd97eff47afeea93582705a15aa7527a3`；
- upstream：`origin/main`；产品候选相对原基线为 `ahead 1 / behind 0`；接受决定与内容审核元数据在其后的第 2 个 commit 中记录；2026-08-26 的全部授权、肖像 manifest 与相应证据/verifier 更新形成第 3 个 commit `b2c3a537f8912fec3e337b69f529fd7baf0aa869`；首个真实 Preview 发现学习页仍显示旧的“待真人教师审核”状态，因此第 4 个 commit `e85ef86b78654c691a04b6e47785d72ac0f9f2fc` 只对齐三处验收状态文案、相应 E2E/verifier 与本回执，不改变题目、答案、反馈、协议或旅程；PR #15 随后以 merge commit `1d39883c6e0aca2c379e80918417c77c2d9c624c` 进入 `origin/main`；
- 提交前候选快照为 34 个 tracked modified + 30 个实际 untracked = 64 个文件；64 个精确路径全部进入同一个产品评审 commit，提交后没有 staged、unstaged 或 untracked 候选残留；
- 审批证据 follow-up 精确修改 8 个既有候选路径并新增 `docs/p0/public-reading-p0-review-decision-receipt.md`，因此当前分支相对基线共有 65 个唯一文件；该 follow-up 不修改题目/短文/选项/答案/反馈/推荐、状态或事件协议、页面交互、图片字节或旧 Gate A 边界；
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
  - legacy verifier `1759 checks`；
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

2026-08-26 在写入全部授权、肖像 manifest 和 Gate 证据后，又对同一 8-path 审批更新候选完整复跑：`npm run check` 再次通过上述 legacy `1758`、Node `274/274`、TypeScript、lint、Next `32/32` 与两组 bundle 隔离；`npx playwright test --config=playwright.public-reading.config.ts` 为 `11/11 PASS`；`SUFEIYA_OFFLINE_E2E_PORT=3216 npm run test:e2e:offline` 为 `2/2 PASS`；`git diff --check` 与 manifest JSON 解析均通过。首次沙箱内运行因 `tsx` Unix IPC socket 被环境以 `EPERM` 拒绝，随后用同一未改代码在允许本机 IPC/浏览器进程的受控执行环境重跑并取得上述真实退出码；该环境限制不被记录为测试 PASS。

### 首个受控 Preview 与发布阻断

PR `#15` 把 base `bf7cac8b3163ed5c00c5bc57607b63266ff22b21`、head `b2c3a537f8912fec3e337b69f529fd7baf0aa869` 与 GitHub Preview deployment `6089410876` 精确绑定；Vercel 返回不可变 deployment `Gn93Lyc5i5L9bmsJeWegDh9RR76T` 和 `success`。回滚目标绑定为最近成功的 Production deployment `5886136926`、SHA `bf7cac8b3163ed5c00c5bc57607b63266ff22b21`。Preview 受 Vercel SSO 保护；匿名 `curl -L` 最终到达登录页，因此没有把登录页的 HTTP 200 冒充应用 PASS，而是使用已获授权的受控浏览器会话读取真实页面。

真实 DOM 检查发现 `/learn/reading` 仍显示“待真人教师审核”“仍在等待明确验收”，与已接受的 Teacher / Content Owner 证据冲突。该 Preview 因此明确判为 `REJECTED_FOR_RELEASE`，未推进生产 alias。组件现改为“已由苏肥鸭以 Teacher / Content Owner 身份接受；公开发布仍须通过独立 Gate”，E2E 新增两条可见文案断言，legacy verifier 新增无旧文案防回归，计数由 `1758` 增至 `1759`。修复候选已通过 `npm run check`、Reading `11/11`、offline `2/2`，须等待新的精确 Preview 后才能关闭 G5。

同一 1280×720、DPR 2 的受控会话中，候选连接复用后的首页 LCP 为 `1.272s`，前一不可变 Vercel deployment 为 `1.136s`，绝对差 `+136ms`；候选 LCP 元素是 45,664-byte 1280w AVIF 肖像。390×844、DPR 2 的设备仿真中，候选 LCP 为 `0.976s`，选择 960w AVIF，横向溢出为 `0`，console error 为 `0`。首次冷访问曾受 TLS/SSO 连接建立影响出现 `8.172s`，因此不把单个冷样本解释成应用回归，也不把单会话观察冒充生产 field Web Vitals；最终修复 Preview 仍须复测。

需要真实 Clerk Development 凭据的既有账户 E2E 本次没有运行；当前工作树没有 `.env.local`，环境也没有形成可用的 Clerk Development 配置。不得把 Clerk 单元合同 `25/25`、公开匿名 E2E、Preview 上的 Development-key warning 或无凭据状态写成真实 Clerk 会话回归 PASS。正式 G2 仍保持 `IN PROGRESS`，直到最终 Preview 技术证据完成并对 Clerk 证据缺口作出适用性结论。

### 最终 Preview、发布决定与生产回归

第 4 个提交 `e85ef86b78654c691a04b6e47785d72ac0f9f2fc` 绑定 GitHub Preview deployment `6089850676` 与 Vercel deployment/check ID `3BhSGbbkABrWLQi1G6Qsn5EhB2ix`。受控浏览器确认两条已接受文案可见、旧待审核文案为 0、`/learn/reading` 肖像引用为 0、公共 SignUp 关闭、`/workspace` 无会话时转入邀请登录边界；完整 7 题旅程形成 7 条作答和本机 `local_only_no_network` 事件，捕获到的非 GET/HEAD/OPTIONS 写请求为 0，应用 runtime exception 为 0。390×844 与 1280×720 都无横向溢出。Vercel Preview 工具条尝试注入的 frame/script 被站点 CSP 拒绝，作为第三方 Preview chrome 记录，不冒充应用错误。

最终 Preview 的三次连接复用桌面 LCP 为 `1.356s`、`1.404s`、`0.912s`，中位数 `1.356s`；同一会话的发布前回滚 deployment 为 `0.532s`、`0.492s`、`0.624s`，中位数 `0.532s`。绝对中位差为 `+0.824s`，由 45,664-byte 1280w AVIF 肖像成为 LCP 元素解释，全部候选样本低于 `2.5s`。Preview 移动 LCP 为 `1.480s`，选择 27,436-byte 960w AVIF。它们是单个受控会话的 lab 证据，不是生产 field Web Vitals。

无真实 Clerk 登录凭据的限制继续保留，且没有被改写为“真实 Clerk E2E PASS”。G2 针对本次公开匿名 P0 仍可关闭：`lib/auth/clerk-config.ts`、`proxy.ts`、protected route wrappers 与 Gate A auth 合同均 no-touch；Clerk 单元合同 `25/25`、公开 Reading 17-script 构建级 Clerk-free 隔离、Preview 上 `/sign-up` 无票据 0 表单、`/workspace` 无会话重定向均通过。这个适用性结论不声称已登录 Clerk 账户旅程被重新验证。

PR #15 在 G0b–G6 `PASS` 后合并为 `1d39883c6e0aca2c379e80918417c77c2d9c624c`。GitHub Production deployment `6090012530`、Vercel deployment/check ID `CvMMarFynAJtjc2VWrVLWUJCz8nq` 返回 `success`。规范域名 `https://sufeiya.cn` 随后通过：

- 首页新公开学习文案和授权肖像可见，旧首页/待审核文案为 0；
- `/learn/reading` 为 `noindex, nofollow`，已接受文案可见、旧文案与肖像引用为 0；
- 生产完整旅程为 7 条作答、24 条事件、全部 `local_only_no_network`、非读取型网络写请求 0、runtime/log/loading error 0，最终焦点位于更新计划；
- `/sign-up` 无邀请票据时为邀请制面板、表单 0、输入 0、普通 Clerk SignUp root 0；`/workspace` 无会话时转到规范域名 `/sign-in`；
- 390×844 首页 LCP `1.380s`，选择 960w AVIF；首页与 Reading 横向溢出均为 0；
- 生产桌面连接复用 LCP 四个样本为 `2.420s`、`2.752s`、`1.180s`、`1.380s`，四样本中位数 `1.900s`；其中一个样本高于 `2.5s`，没有被删去或冒充 field 指标，保留为后续监测项。

完整外部证据位于 [`PR #15 Preview 决策`](https://github.com/HUDongpin/sufeiya-cn/pull/15#issuecomment-5415240829) 和 [`PR #15 G7 回执`](https://github.com/HUDongpin/sufeiya-cn/pull/15#issuecomment-5415305539)。发布前回滚目标继续绑定 Production deployment `5886136926` / `bf7cac8b3163ed5c00c5bc57607b63266ff22b21`；本次没有触发回滚。

G7 之后的证据同步 follow-up 只把内容包的 `releaseDisposition`、逐对象公开权利状态、肖像 manifest deployment、Gate 表与最终页发布状态文案对齐上述已经发生的外部事实，并增加对应合同/E2E/verifier；它不修改短文、题目、选项、正确答案、反馈、推荐规则、存储/事件协议、入口、肖像字节或授权范围。该 11-path follow-up 重新通过 `git diff --check`、manifest JSON、legacy `1759`、Node `274/274`、TypeScript、lint `0 errors / 6 no-touch warnings`、Next `32/32`、两组 build bundle 隔离、Reading E2E `11/11` 与旧离线 E2E `2/2`。

## 5. 性能与图片证据

源图 `/Volumes/WestWorld/Sufeiya/最新微笑版.jpg` 为 `3840×5760`、`13,713,402 bytes`，SHA-256 为 `f0c23e3b73952cd70c085f71f9e4ca556075c8d14d140ac2dcc22f3df4954c24`，没有复制进仓库。

首页实际使用 4:5 `picture/srcset`：

| 宽度 | AVIF | WebP |
|---:|---:|---:|
| 640 | 14,218 B | 21,890 B |
| 960 | 27,436 B | 44,824 B |
| 1280 | 45,664 B | 72,744 B |

6 个文件都低于 80 KiB，工程目录与 `public/` 副本逐字节一致，manifest SHA-256 与完整解码通过。真实移动 Chromium、最终 Preview 与生产规范域名的 390×844 仿真均选择 960w AVIF，decoded body 为 27,436 bytes；桌面生产选择 1280w AVIF，encoded body 为 45,664 bytes；原 JPEG 未被请求或复制进仓库。上节记录全部 Preview/生产样本与波动，不能把它们冒充生产 field Web Vitals 或学习效果证据。

## 6. Gate 状态

状态只使用计划批准的枚举。

| Gate | 当前状态 | 本次证据/阻塞 |
|---|---|---|
| G0a 工作树建立 | `PASS` | 独立工作树来自 `origin/main@bf7cac8b…`；旧工作树未被本次实现修改 |
| G0b 当前发布 diff 与归属 | `PASS` | 64 个产品候选文件加 1 个审批决定回执，共 65 个唯一文件；审批 follow-up 的 9 路径均在 `docs/p0`、内容元数据、对应测试/verifier 与 README allowlist 内，既有 whitespace、21/21 生成一致性、no-touch、并行归属和副产物边界不变 |
| G1 教学内容 | `PASS` | 2026-08-23，苏肥鸭以 Teacher / Content Owner 身份绑定 `af85403…` 接受 Reading 内容、7 个任务、微课、权利、反馈、测量关系、禁用宣称和教师体验范围；内容元数据与决定回执已同步 |
| G2 技术与浏览器 | `PASS` | 最终候选本机 check、公开 Reading `11/11`、旧离线 `2/2`、Preview 完整旅程、桌面/移动/a11y/performance、零写请求与边界回归通过；真实 Clerk 登录未重测的限制按 no-touch Gate A 适用性明确保留 |
| G3 数据、隐私与注册边界 | `PASS` | 苏肥鸭接受当前本机零上传合同与 Product/Privacy/Legal 治理范围；公共 SignUp、身份/自由文本、账户绑定和上传继续关闭，四个替代 CTA 已由真实浏览器验证；不为未来新增数据流提供法律结论 |
| G4 真人教师、人物用途与条件性队列 | `PASS` | 纯客观 Reading 无开放题，教师内容/体验/身份文案与 Product 公开旅程已接受；2026-08-26 又绑定源图 SHA-256、6 个衍生物、限定首页人物卡与撤回流程完成肖像授权 |
| G5 Preview 候选 | `PASS` | `e85ef86…`、GitHub Preview deployment `6089850676`、Vercel `3BhSGbbkABrWLQi1G6Qsn5EhB2ix`、浏览器/性能证据和回滚目标精确绑定 |
| G6 公开发布授权 | `PASS` | 2026-08-26 的全部授权在 G0b–G5 通过后绑定最终候选和 deployment plan，发布决策记录于 PR #15 |
| G7 生产部署与线上回归 | `PASS` | merge commit `1d39883…`、Production deployment `6090012530`、Vercel `CvMMarFynAJtjc2VWrVLWUJCz8nq` 与规范域名完整回归通过 |
| G8 账户同步 | `NOT IN SCOPE` | 当前 P0 明确为浏览器本机、非账户绑定；跨设备/RBAC/退出同步属于 Phase 2 新候选与新决定 |
| G9 Grounded Sofia | `BLOCKED` | 本次公开 Reading 不启用 AI；既有治理 Gate 不变 |
| G10 语音/数字人 | `BLOCKED` | 本次没有录音、语音或数字人；独立授权和治理仍未满足 |

## 7. 明确未完成与不应宣称

当前可以准确宣称：

- Teacher / Content Owner 已接受候选 `af85403…` 的 Reading 教学内容、内容权利和教师体验范围；
- Product 已接受 Reading 公开旅程、首页 CTA、真人/AI 区分和有肖像首页方案；
- Product/Privacy/Legal 项目治理范围已接受当前本机数据合同，并决定公共 SignUp 继续关闭；
- 苏肥鸭已确认精确源图与全部 6 个绑定肖像衍生物的限定首页用途授权，并接受撤回流程；
- Release Owner 已授权 push、PR、受控 Preview，以及精确候选发布前 Gate 全部通过后的生产发布；
- PR #15 已合并，Production deployment `6090012530` 已绑定 merge commit `1d39883…`，规范域名 G7 回归通过。

当前仍不得宣称：

- 该项目治理决定是执业律师意见，或覆盖未来公开注册、账户同步、远端分析/模型、跨地区数据流；
- 第一版 Preview 的 HTTP 200/Ready 可替代其已记录的拒绝结论，或单独证明最终版本通过；
- 一句授权、Vercel Ready、页面截图或本回执单独构成 G2/G5/G6/G7 证据；这些 Gate 的 PASS 依赖上面分层证据；
- `/learn/reading` 是正式诊断、官方 DET 分数、掌握度、AI 自适应学习或学习增长证明；
- 本机记录可以跨设备、与账户同步、被教师看到或由服务器恢复。

## 8. 发布后维护边界

1. 继续观察首页真实 field Web Vitals；当前受控浏览器 LCP 样本不是长期生产指标，任何稳定回退需单独优化并重新经过 Preview。
2. 保持 `/learn/reading` 的 `noindex, nofollow`、sitemap 排除、本机零上传、公共 SignUp 关闭和首页限定肖像范围；改变任一项都形成新候选和新 Gate。
3. 真实 Clerk 已登录账户旅程本次没有重新验证；未来修改 auth、protected wrapper、Clerk 配置或 Gate A 交互时必须取得受控凭据并单独回归。
4. G8–G10 与 Phase 2–4 没有因 P0 发布而通过；账户同步、远端模型、语音、数字人或新肖像用途必须重新授权、建模和验证。
5. 任何规范域名关键旅程、数据边界、肖像用途或 deployment/commit 绑定回归，立即按第 9 节回滚或下架，不以历史 G7 PASS 覆盖新故障。

## 9. 候选级回滚与肖像撤回边界

当前生产部署为 GitHub deployment `6090012530`、Vercel `CvMMarFynAJtjc2VWrVLWUJCz8nq`，绑定 merge commit `1d39883c6e0aca2c379e80918417c77c2d9c624c`。发布前已绑定的回滚目标仍是 Production deployment `5886136926` / `bf7cac8b3163ed5c00c5bc57607b63266ff22b21`。首个 `b2c3a537…` Preview 的拒绝记录继续保留，不能被后续成功覆盖或当作曾经可发布。

候选级回滚遵循以下顺序：

1. 若后续候选尚未提升 alias，停止发布并保留当前已验证 deployment；不得以“Preview 构建成功”代替回滚准备。
2. 若当前 P0 生产 alias 需要回滚，由 Release Owner 把 alias 恢复到已绑定的 `5886136926`，仓库侧以一个经过审阅的 revert 还原 PR #15，不使用未归因的部分文件覆盖。
3. 代码回滚范围必须一起覆盖首页公开 CTA/文案、`/learn/reading` 路由与 public-learning 模块、两个新 namespace 的 UI/合同、最小事件、肖像衍生物引用、生成 HTML 与 build/verifier wiring。回滚不得删除学习者浏览器中的本机记录；若旧页面不再读取新 namespace，它们保持孤立，后续删除/迁移需另行批准。
4. 回滚后重新核对规范域名 `/`、`/learn/reading`、`/sign-in`、`/workspace`，首页肖像资源 URL、公开 SignUp 关闭、关键旅程、HTTP 状态、console、deployment/commit 绑定与旧 Gate A namespace 未变。
5. 任一步骤无法恢复前一不可变部署或核验失败时，保持 G6/G7 关闭并升级给 Release Owner；不得继续公开发布。

肖像用途撤回是独立控制：权利人可要求从首页撤下肖像并移除相应衍生物引用，而不必回滚整个 Reading 学习切片；反过来，候选级代码回滚也不应被误写成已经处理所有权利撤回请求。具体联系人角色、源图 hash、用途排除与下架流程仍以教师肖像回执为准。
