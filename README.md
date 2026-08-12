# Sufeiya Website

`sufeiya.cn` 是面向中国大陆 DET 学习者的在线学习平台。本仓库使用 Next.js App Router 承载多页面公开网站、Clerk 账户入口与面向受邀内测账户的学生学习工具，并通过 GitHub 与 Vercel 发布；既有页面内容仍由 `scripts/generate-pages.mjs` 统一生成，再由 Next.js 外壳渲染。

## Local development

```bash
npm ci
npm run check
npm run dev
```

Next.js 本地开发地址默认为 `http://localhost:3000`。

Clerk Development 认证需要在被 Git 忽略的 `.env.local` 中同时提供同一 Development 实例的 `pk_test_` 与 `sk_test_`。若 Vercel Development 作用域未配置 server-only secret，`vercel env pull` 不能单独形成完整的本机凭据；应使用项目所有者维护的受控本机配置，且仓库和日志均不得保存或输出真实密钥值。

### Clerk Development smoke E2E

`npm run test:e2e:clerk-dev` 使用 project-based Clerk setup 与单个 Chromium worker，验证未登录保护、公开注册页不挂载普通 SignUp、已登录但没有有效资格的账户被学习页面与 Sofia POST 拒绝且不读取上一位使用者的 Sofia 本机命名空间。同一临时账户写入精确 Development 准入 metadata 并强制刷新 Clerk 签名会话令牌后，浏览器会在全新学习工作区中通过真实控件完成 Reading 首项证据与其余五项明确跳过，再依次走完诊断、计划、推荐、练习、打卡、复盘、互助状态、平行微复测与更新计划，核对 7 / 7、九个领域 ID 与六条哈希回链事件。随后测试实际下载 workspace-only 可恢复备份，证明篡改摘要时零写入拒绝、有效文件须先预检再确认、清除与恢复只替换学习命名空间、本站不接收恢复 POST 且任意请求体都不携带备份协议/摘要标记、Sofia 对话与教研草稿原始字节不变，并在恢复后继续得到同一闭环与事件链；最后再验证教研演示、Sofia 本机解释、登出隐私和重新保护。首次运行前如本机尚无对应浏览器，可执行 `npx playwright install chromium`。

本机模式默认启动 `127.0.0.1:3210`。若 Next.js Node `proxy` 的本机 Clerk Development 握手在当前版本触发自代理循环，可对一个显式指定的 Vercel hosted target 运行同一套测试；显式目标只接受规范的 HTTPS `*.vercel.app` origin，且不会启动本机 web server。通用测试配置不把域名语法冒充 Preview 身份；形成 Preview 证据前还须用 Vercel deployment metadata 独立确认目标的 `target=preview` 与不可变 deployment ID：

```bash
SUFEIYA_CLERK_E2E_BASE_URL=https://your-new-preview.vercel.app npm run test:e2e:clerk-dev
```

若 hosted target 保留 Vercel Authentication，测试进程还可显式接收 `SUFEIYA_VERCEL_PROTECTION_BYPASS`。该值只允许在 hosted 模式使用，不写入仓库；测试先向被指定的精确 origin 发出一次 `maxRedirects: 0` 的禁止跟随重定向请求，以 Vercel 官方请求头换取安全 bypass cookie，随后浏览器导航只使用该 cookie，不把 bypass 请求头附加到页面请求或跨源重定向。Vercel 的访问保护本身保持开启。

该测试只接受同一 Clerk Development 实例的 `pk_test_` / `sk_test_`；会解码 Publishable Key 的 Frontend API，并用 Secret Key 读取的实例类型和域名做在线匹配，setup 与主 smoke 在创建用户前都会独立核对，不能用 `--no-deps` 绕过。Clerk Backend API 同样固定为规范的 `https://api.clerk.com` 与 `v1`；自定义协议、主机、端口、路径、查询、片段、凭据或 API 版本都会在 SDK 请求前被拒绝。预置 Testing Token、Frontend API 或 testing debug 状态同样被拒绝，setup 必须从已核对的 Development 实例新取短期 token，并用当前运行标记、签发时间与 HMAC 交接给 smoke；测试期间 Clerk helper 的 log/warning/error 参数统一替换为固定脱敏消息。测试创建唯一 `+clerk_test` 合成用户；同一个已核对 Backend client 只按刚创建的精确 user ID 生成 5 分钟测试 sign-in token，再由 Clerk Frontend API 的 ticket strategy 建立真实 Development session，不做第二次邮箱搜索。身份值只保存在进程内，不写入 storage state、trace、video 或 HAR，也不输出邮箱、密码、token、cookie 或 user ID。配置只在失败时保留页面截图与脱敏阶段，trace、video 与 HAR 继续关闭。无论页面断言是成功、失败还是超时，拥有独立 teardown 超时预算的 `afterEach` 都会按精确 user ID 删除，并验证该 ID 与唯一合成 external ID 已不存在且实例用户总数回到运行前基线；若创建响应不确定，会先用该 external ID 恢复精确 user ID。清理失败会独立令测试失败，因此 smoke 与 cleanup 的脱敏失败事实可以同时保留。为了让全局人数基线有确定含义，运行期间不要并行创建或删除同一 Development 实例中的其他用户。

证据边界：loopback 模式只证明本机 Next.js 生产构建；显式 hosted 模式只证明该次指定并另行核对 deployment metadata 的 Vercel target。两种模式都只使用所核对的 Clerk Development 实例；浏览器侧还会把目标实际加载的 Clerk Frontend API 与已核对的 Publishable Key 精确绑定，然后用精确临时 user ID 的短期 server-side testing ticket 形成真实 Development session，先验证无有效资格时失败关闭，再验证当前协议的后台 metadata 经会话令牌刷新后放行 `/workspace` 和 `/teaching-review-demo`。它证明的是 metadata approval gate 与这一个受控测试 session，不是 `createInvitation → __clerk_ticket → 受邀注册` 的真实邀请接受链；也不证明 `sufeiya.cn` 的 Production Clerk 登录或生产受邀用户，不覆盖终端用户的邀请邮件、交互式密码、验证码或 MFA，不证明角色、教研资质、成人身份或个案授权，不提供账户级本机数据隔离，也不构成 production release readiness。

## Product boundary

公开学习页源稿仍以经过检查的 HTML 保存。每次修改页面源稿后，先运行 `npm run generate` 生成 HTML 页面，再运行 `npm run check` 完成旧页面结构、TypeScript、ESLint 与生产构建检查。`generate:next-content` 会把页面正文写入 `lib/legacy-content.generated.ts`，并同步浏览器运行时与音频到 `public/`；发布必须来自明确提交的干净工作树。

跨出 Gate A 本机演示边界的能力统一受 `data/release-decision-register.v1.json` 控制。该登记表对本机、预览和生产使用同一版本，默认拒绝；环境变量只能表达请求配置，不能把待审或未批准的能力打开。登记表包含批准方案文件的 SHA-256、结构化证据引用、实施影响、实施状态和复核日期，解析后在运行时深度冻结；外部调用还必须逐项匹配获批的 provider、model、region 与 data mode，并在供应商请求前再次核对。当前只有本机合成学习闭环、Clerk 访问边界、Qwen 供应商选择，以及“项目所有者已声明获得声音授权”这一事实有明确记录；书面授权证据核验、外部文本模型的数据流/留存/地域/预算/语义引用校验、声音的数据流/删除/披露/传输、服务器学生数据、真实社区、真实人工队列、教研管理员写入和真实奖励仍被统一闸门阻断。供应商选择或授权声明不等于发布批准。

Sofia 的 10 条 Gate A 静态解释来源与 5 条仅链接目录另由 `data/content-governance.v2.json` 逐条绑定到来源登记表的 SHA-256；其当前内容协议为 breaking revision `sufeiya_content_governance_v2`。规范字段严格拆分为 `source_class`、`claim_verification_status`、独立的 `catalog_coverage_status` 与 `full_text_transcription_status`、`review_status`、六种用途的 `rights_status`、`exam_version_status`、数组型 `safety_flags` 与 `rag_eligibility`。仅链接目录没有可审核正文或转写，结构上不得直接成为 RAG 材料；未来必须先形成并重新绑定一条目录覆盖完整且可审核正文或转写就绪的完整来源记录。正式教师审核只接受规范角色 `teaching_content_owner`；目录覆盖、正文/转写、教师审核、RAG 权利、考试版本和显式 RAG 决定分别要求绑定到同一条内容记录及其精确载荷 SHA-256 的不透明证据引用。每个引用还必须解析到 v2 `evidenceCatalog` 中唯一、同决定类型、同记录和同载荷的条目，并具有证据工件 SHA-256、该决定规定的核验角色、当前核验状态、严格时间戳及尚未到期的复核时间；未知、错类型、错记录、错载荷、待审、撤销、过期、未来时间、工件摘要复用或引用复用都会失败关闭。RAG 只有在上述结构与证据齐备，同时满足 `rights_status.rag=allowed`、考试版本为 `current` 或 `not_applicable`、`rag_eligibility=allowed` 且无阻断安全旗标时才可准入。当前 15 条逐条登记来源仍保守标记为目录覆盖未评估、正文/转写未开始且证据目录为空，RAG 准入数仍为 0；另有 655 条归档记录整体阻断。Gate A 静态解释可用、公开视频可显示标题链接，与 RAG 准入是三个不同状态；`/api/super-teacher` 的 GET 状态合同因此使用独立的 `sufeiya_super_teacher_status_v4`，通过 `gateAStaticClaimSources` 描述静态来源，并明确拆分浏览器本机解释、第一方服务器处理与外部模型处理状态。当前三者分别为启用、关闭、关闭；`interactionProtocolVersion` 仍单独声明被发布治理阻断的 POST 合同，不再把 10 条静态来源写成 RAG“已准入来源”。

批准方案附录 A 的 29 项 P0 另由 `data/p0-decision-log.v1.json` 一对一登记。问题标签采用附录原文；其中 `operationalGuardrail` 是保守的工程摘要，不冒充完整原文默认建议或会议结论。完整定义（含该摘要与固定运行时控制映射）受逐项摘要和集合摘要约束：没有逐项会议事件时一律派生为 `not_approved`。后续采用、拒绝、暂缓或撤销必须新增逐 item、逐 outcome、逐事件摘要绑定的记录；项目特定的多角色书面证据、主/备责任角色、实现影响和复审条件均须齐备。同一个 owner-decision 材料摘要默认不得跨角色或跨项目复用，避免把一份“整体批准”复制成 29 项结论；如未来确需批量会议纪要，须先增加逐项列出 item、outcome、role 与事件摘要的签名 batch manifest，目前没有该放行路径。事件以 SHA-256 回链前一事件，账本修订以 `previousLedgerSha256` 回链；`data/p0-decision-log-published-baseline.v1.json` 进一步封存已发布证据与事件前缀，跨修订校验禁止删除或替换历史。负责人只使用角色 ID，不在仓库或公开 API 中保存个人姓名、联系方式或证据位置。即使 29 项全部形成采用或拒绝结论，该 Decision Log 也不会直接打开任何运行时 surface；现有发布登记表仍须独立满足批准、实施、复核与 provider/model/region/data-mode 绑定。

### Gate 0 离线会议准备包

仓库提供独立的、非权威的 P0 会议准备工具；它不是网站管理页，也不会把普通 Clerk 登录当作 staff 或 owner 权限。生成器把批准稿附录 A 的 29 条默认建议、canonical item 定义、required-role policy 和当前 P0 ledger 摘要绑定进一个自包含 HTML 与初始 JSON。HTML 仅在内存中编辑，CSP 禁止网络连接，不使用 `localStorage` 或 `sessionStorage`；导出的 SHA-256 只是未签名的内容完整性摘要。草稿使用 `propose_*` 词汇和 `prep_ev_*` 候选证据 ID，所有正式权限固定为 `false`，也不能写入 canonical ledger 或 release register。

```bash
npm run generate:p0-prep -- --output-dir /an/explicit/output/directory
npm run validate:p0-prep -- /an/explicit/output/directory/Sufeiya_Gate0_P0_DRAFT_NOT_APPROVAL_YYYY-MM-DD.json
```

生成器默认拒绝覆盖同名文件；验证器分别报告未签名内容完整性和当前 canonical 基线状态。基线改变后，旧包可被识别为 `stale` 并保持只读，但不能继续编辑或导入。只有 owner 与每个 required role 另行形成可核验的书面材料，并明确授权受控仓库导入后，正式 P0 才可能从 0/29 变化；即使 29 项完成，也仍不自动形成正式 Gate 0 PASS 或功能发布批准。

Qwen 后端已按 2026-08-11 最新的 Alibaba Cloud 官方 DashScope/OpenAI 兼容 API 文档锁定正式模型 `qwen3.8-max`。单独的 `qwen3.8-max-preview` Token Plan 模型、`sk-sp` 类凭据与 Token Plan 专用端点仍不允许用于 Sofia 应用后端。模型配置已完成，但在外部数据流、留存删除、地域、预算和语义引用校验获批前，供应商请求仍会以零网络调用失败关闭。

## Page structure

- `/`：精炼首页与四个页面入口；
- `/workspace`：七阶段 Gate A 闭环进度、独立功能页入口、只投影中央校验器已确认 ID 的本轮证据链总览、最近最多 10 轮的本机计划版本历史、完成后经整轮本机容量预检开放的“开始下一轮”入口、临时更新计划专用的待资质人员确认承接卡、脱敏的 29 项 P0 书面决定汇总，以及逐条来源治理/RAG 准入的只读计数；
- `/super-teacher`：有来源的 Gate A 学习解释、拒答边界、非 AI 退出，以及只对严格核验 provisional 轮次开放的 Sofia 本机承接包与未发送人工支持请求；
- `/diagnostic`：18+、本机、无评分的六任务诊断证据包（2 Reading + 2 Listening + 90 秒 Speaking + 3 分钟 Writing）；
- `/plan`：7 天学习计划生成器；
- `/recommendations`：一个主任务、至多两个补充的可解释推荐，可接受或明确跳过；
- `/today`：今日任务清单与进度；
- `/practice`：四项英文练习入口；
- `/practice-reading`、`/practice-listening`、`/practice-writing`、`/practice-speaking`：四个独立英文微练习；
- `/focus`：15 / 25 / 45 分钟专注计时器；
- `/check-in`：保存“做了什么 + 学习证据 + 问题”的 `check_in_id`；
- `/review`：由学习者另行核对并生成 `review_id`；
- `/community`：从中央核验闭环只读派生“任务类别 + 完成状态”的本机最小可见信息预览，并提供一张冻结合成经验卡与 `used / declined / not_needed / unavailable` 四种自愿状态；
- `/retest`：原创平行微任务、`retest_id` 与学习者确认的 `updated_plan_id`；
- `/teaching-review-demo`：Clerk 保护且由发布治理放行的 Gate A 本机教研复核演示；只读查看严格回链的临时轮次证据，并把修订建议与升级说明保存为独立本机草稿；
- `/my-data`：三个本机命名空间的数据统计与原始保全导出、学习工作区的可验证备份恢复，以及按命名空间定向清除；
- `/learning-path`：七步学习闭环；
- `/platform`：四项平台功能与开放状态；
- `/resources`：中文界面/英文备考材料规则和 Bilibili 学习资源；
- `/about`：团队角色、平台边界与常见问题；
- `/sign-in`：已有受邀账户的 Clerk 登录入口；
- `/sign-up`：邀请制注册说明；只有带 Clerk invitation ticket 的入口才挂载 SignUp，最终访问仍须服务器核验当前内测 metadata；
- `/beta-access`：不读取学习记录的邀请资格状态与重试入口；
- `/account`：登录后账户资料页，未登录访问会返回登录页。

每个顶部导航按钮进入一个独立页面，不使用单页长滚动替代多页面导航。

具有当前邀请资格的 18+ 成人内测账户可以使用：

- 通过同一 `cycle_id` 串联的 Gate A 演示闭环：六任务诊断证据包 → 计划 → 推荐 → 证据式打卡 → 学习者确认 → 自愿互助状态 → 平行微复测 → 更新计划；
- 在互助选择前查看未来成人邀请制小组最多可见的两项本机预览：经白名单映射的任务类别与固定完成状态。预览本身不写入本机状态、不生成 ID 或事件，也不发送网络请求；姓名与账户信息、内部 ID、能力分与诊断结论、首答、作文、录音、打卡自由文本、问题、Sofia 对话和联系方式始终不进入预览。`used` 仍只表示查看了冻结合成经验卡，`realCommunityUsed` 始终为 `false`，不代表已加入、发布或分享给真实社区；
- 在工作台集中核对 `diagnostic_session_id → plan_id → recommendation_id → check_in_id → review_id → peer_help_id/status → retest_id → updated_plan_id`；未通过前序回链的节点不会提前显示。临时更新计划会进入单独的“待具备资质人员确认”承接卡，并通过 `/super-teacher?handoff=provisional#human-support` 进入 Sofia 本机严格承接区。承接区只为 7 / 7 且仍处于 `provisional_pending_human_review` 的当前轮次生成最小化白名单包：生产校验器会在 workspace 内核对完整同轮回链，但页面、本机包和复制文本均不携带原始领域 ID 或独立包编号，只保留严格枚举、状态、时间与当前完整 workspace 的 SHA-256 摘要。旧快照、损坏记录、未知字段、跨轮回链或非 provisional 状态一律失败关闭，并只提供返回工作台与保全本机数据的路径。它不从来源投影姓名、Clerk 身份、联系方式或学习自由文本字段，也不自动发送、创建真实队列、通知人员、写入 canonical 学习账本、关闭 cycle 或签发正式人工回执；
- 在本轮回执之后查看最近最多 10 轮的本机历史与 `base_plan_id → updated_plan_id` 重点对照；历史按结束时间最新在前，同一 `cycle_id` 重复记录全部失败关闭，仍在上方显示的当前轮次不会重复列入历史。每一轮都重新核对完整域 ID 链、`gate_a_original_6_v1` 任务集与摘要、能力方向、计划来源、里程碑 UTC 时间顺序、匿名事件绑定和该轮事件片段；只有“本机闭环已完成”或明确“待具备资格人员复核”的记录可进入投影，二者不会合并计数或混用文案；
- 完成一轮后继续保留“查看更新后的计划”主入口，并另行显示“开始下一轮诊断”。后者先只读核对完成一轮至少需要的计划、闭环历史、练习回执、打卡、任务进度、事件与匿名别名计数；仅打开设备预检不会退休当前计划、归档当前轮次、生成 ID 或追加事件。用户完成预检并提交时，生产 writer 会在独占锁内再次执行同一容量检查，再把旧轮归档与新轮建立作为一个可回滚事务；若完整闭环历史已达 19、学习事件已达 207（完成新轮至少还需 6 条）或其他必需集合余量不足，则在首个写入前显示当前值、所需值与安全上限，并只提供 `/my-data` 保全路径；
- 在工作台查看同源、只读、无缓存的 Gate 0 脱敏汇总；接口异常、协议漂移、超时或字段不完整时按“未通过”处理，不公开 29 项问题文本、负责人、证据、控制映射或复审日期，也不把登录与功能实现计为批准；
- 在工作台查看同一无缓存接口返回的来源治理脱敏汇总：区分 Gate A 静态来源、仅链接目录、逐条 RAG 准入与整体阻断的归档记录，并显示五项核心决定条件的通过计数；目录覆盖、可审核正文/转写及逐决定证据绑定是这些计数之外的结构前提。协议、分项计数、总数或状态关系漂移时只把来源区块降级为“无法核对”，不会把未知状态显示成可检索；
- 依次完成 2 项 Reading、2 项 Listening、90 秒 Speaking 与 3 分钟 Writing：客观题只封存首答，若本机持久化失败则完整回滚到提交前状态；听力文本替代、播放失败、中断、跳过等情况进入质量标记，最终由学习者确认一条下一步优先任务；
- 纯前端 7 天计划生成器；
- 可跨页面同步的今日任务清单；
- 原创 Reading、Listening、Writing、Speaking 英文微练习；
- 可在刷新后恢复的专注计时器；
- 自动保存草稿的结构化学习复盘；
- 本机数据原始保全导出、学习闭环专用的可恢复备份，以及对学习闭环、Sofia 对话和教研复核演示草稿的定向清除；
- 对等待人工确认的临时 cycle 生成 Sofia 本机严格承接包，并进行只读教研流程演示：包和教研草稿分别绑定当前来源快照，均只保存在当前浏览器；当前登录不代表教研身份或资质，内容不会自动发送、不会进入真实人工队列、不会修改学生计划或事件账本，也不会关闭 cycle 或签发人工复核回执；
- 可选的 Sofia智能老师 Gate A：解释本机证据、计划、推荐与原创任务，逐句显示来源；模型不可用时自动回到同一白名单上的确定性备用回答。

公开网站同时展示：

- 苏肥鸭的证据驱动学习路径；
- 已确认的七步学习闭环；
- 四个相互连接的伴学模块设计方向；
- 指向 Bilibili 原始发布页的公开资源入口；
- 团队角色、常见问题与明确的非官方边界。

平台导航、说明、反馈和帮助以简体中文为主；真正用于 DET 备考的题目、阅读、听力、作文与口语材料保留英文。

六任务证据包使用固定的 `gate_a_original_6_v1` 任务集和 SHA-256 任务清单摘要。每条运行时任务证据都必须匹配登记表中的 `contentHash`，诊断会话、计划与更新计划还必须携带同一 `taskSetDigest`；内容来源当前只确认在项目所有者授权的第一方原创范围内，主张核验、教研/测量签核、缓存/再发布/听力转写权利仍为待审，不能进入 RAG。静态 Listening 音频另有路径、字节数、时长、生成方式和文件 SHA-256 回执。

Listening 只有在静态音频触发完整播放结束，或设备语音合成依次完成开始与结束事件后，才可作为纯听力证据；未播完、拖动音频、播放失败、设备语音错误、语音回退或查看文本替代都会留下相应条件或质量标记。Writing 的 3 分钟计时未完成、明确粘贴或拖放都会降低证据覆盖，不会被隐藏地解释为能力结果；`insertReplacementText` 可能来自输入法或自动纠错，不会单独被误判为粘贴。页面在任务切换时同步当前步骤、进度标签、焦点和 `aria-current`，移动端音频控件限制在任务卡宽度内。

计划、推荐与证据式打卡只有在同一 `cycle_id`、`diagnostic_session_id`、任务清单摘要和基础计划回链全部成立时才计入闭环；中央验证链还逐项核对打卡的 `diagnostic_session_id`、互助状态的 `plan_id` 与更新计划的 `focusSkill`。推荐选择、学习者复盘确认和平行复测的首份有效回执封存；相同复盘或互助状态重放不会生成第二个 ID 或改写时间戳，互助状态只允许在平行微复测前由学习者主动改选，并保留原 `peer_help_id` 与创建时间。形成 `retest_id` 或更新计划后，Community 状态随即冻结。Review 与 Community 和相邻阶段使用同一独占写锁、原始字节 freshness 核对、candidate-only 变更、完整容量与严格可恢复图校验；任何链变化、容量不足或持久化失败都整笔零写入或回滚，不能静默覆盖或删除既有回执。

`/today` 只在本机当前日期与当前计划中的唯一、完整计划日精确匹配时显示“来自 7 天计划”；无计划、计划尚未开始、计划已结束、日期缺口或不可识别计划日都会显示当日独立基础练习，且不会借用计划绑定或推进诊断闭环。任务来源与完成来源分开记录：手动勾选只是学习者自报，练习回执与页面流程回执另行显示。证据式打卡允许学习闭环跨日完成：`checkIn.date` 表示实际复盘日期，封存的 `practiceReceipt.taskDate` 继续表示原计划任务日期；两者不会相互改写，页面会同时披露。跨日时，复盘流程完成记录归属于复盘当日的独立 Reflection 任务，原计划练习任务与回执仍保持原日期和 ID。Today 与打卡页在午夜、页面重新可见或恢复焦点时重新核对本机日期；未经学习者明确切换，不会把午夜后的操作写入旧日期或新日期。

Logo 使用由原始附件精确抠图并进行 4× 重采样的 `2792 × 560` 真透明 PNG；圆形标志另存为 `512 × 512` 透明站点图标。

Clerk 负责账户身份与资料；Sufeiya 另行负责学习区邀请准入，不会成为本机学习记录的账户绑定层。学习闭环数据使用 `sufeiya_workspace_v1` 本机存储命名空间；所有 `workspace.js` 与 `journey.js` 页面共享同名的 `page-writer` Web Lock 长租约，同一时间只有一个标签页可写，第二个标签页在初始化控件前切换为只读。诊断预检与 Sofia智能老师上下文区都会在交互前显示浏览器安全写入锁能力；不支持 Web Locks 时不建立新的闭环或问答写入。Sofia智能老师的对话副本、未发送人工请求和严格承接包使用独立的 `sufeiya_super_teacher_v1` 命名空间；承接包以当前完整 provisional workspace 的 SHA-256 作为同快照绑定，只保存严格白名单枚举、固定无权限边界和时间，不保存或复制 workspace 中的原始领域 ID；原始答案、作文、口语、打卡自由文本、联系方式与 Clerk 身份字段也不会进入包。教研复核演示草稿使用 `sufeiya_teaching_review_demo_v1`，只读取与当前 `activeCycle` 的 protocol、状态及全部下游 ID 完整一致，且符合固定任务集、计划、推荐、回执、任务进度、打卡、复测和临时计划回链的唯一 provisional 本机快照。教研投影只显示冻结枚举、质量标记白名单与确定性推荐说明，不复制原始答案、开放作答、打卡自由文本或原始推荐文案；草稿保存使用独立 Web Lock、源快照 SHA-256、原始字节 compare-and-set、精确写后校验和可核验回滚，任何未知存储状态都会停止后续写入。`/workspace`、七步闭环、练习、专注、本机数据与 `/teaching-review-demo` 先要求有效 Clerk session，再要求 Clerk 签名会话令牌中的 `sufeiyaBetaAccess` 同时具有 `protocolVersion=sufeiya_invite_only_beta_v1` 与 `status=approved`；字段缺失、旧协议、未知状态或令牌声明未就绪一律失败关闭。该最小声明由 Production 与 Development Clerk 实例的 session token template 从后端可写、前端只读的 `publicMetadata.sufeiyaBetaAccess` 生成，页面请求不再逐次调用 Clerk Backend API。metadata 更新可能在当前短期令牌中短暂滞后；受控批准流程必须强制刷新令牌，撤销最多存在一个 Clerk 短期令牌的传播延迟。`/account` 保留给任何已登录账户管理身份。邀请必须由受控 Clerk Backend API 流程创建，并把同一 metadata 作为 invitation `publicMetadata` 附带；仅出现 `__clerk_ticket`、仅创建账户或仅登录都不能获得学习区访问权。

`/my-data` 的可恢复文件只封装 `sufeiya_workspace_v1`，使用 `sufeiya_workspace_backup_v1`、固定 namespace/schema 与 replace-only 合同；不会读取、复制或覆盖 Sofia 对话和教研草稿。选择文件、SHA-256 核对、严格领域对象/数量上限/事件哈希链/当前与历史轮次回链预检都在浏览器本机完成，文件不会上传；摘要用于发现意外损坏，不是服务器签名，也不能防止恶意本机重算。旧协议、未知字段、身份或原始响应键、超限、摘要不符、事件孤儿和交叉引用漂移全部零写入拒绝。恢复必须由学习者明确勾选完整替换，随后在独占 Web Lock 内进行写前 compare-and-set、写后读回、持久化复验与复验后第二次 compare-and-set；只有仍拥有候选值时才可回滚，绝不以旧值覆盖第三方并发写入。当前版本不做合并、猜测迁移、账户绑定、云同步或跨设备自动恢复。

同一套纯容量检查同时用于备份预检和页面写入事务：canonical workspace 以 1 MiB 为主要可恢复负载上限，并另设 131,072 个 JSON 值节点的独立结构复杂度防线；后者不是 1 MiB 的数学换算，也不保证所有病态小字节 JSON 都先触发字节上限。当前 append-only 集合的治理上限为历史计划 64、完整闭环历史 19、练习回执 256、打卡历史 256、学习事件 212、专注记录 512 与中止诊断摘要 64。完整闭环历史 19 来自保留计划、回执、打卡、摘要及六事件哈希链的正常多轮写入实测：第 19 轮仍可生成严格备份；由于第 20 轮无法在现有 1 MiB 合同内完整封存，下一轮准入会在用户投入新的六任务之前停止，而不是等到最终更新计划才失败。学习事件 212 是基于 64 个真实轮次锚点、37 个五事件中止前缀与 27 个仅启动前缀测得的保守治理边界；新一轮至少预留完整六事件链，因此 206 条可建立新轮，207 条起在开始前阻断。较轻组合即使仍有少量字节余量也不会继续追加。所有复合写入都在独占锁内先核对当前计数，再检查完整候选的字节、节点与领域回链；任一门槛不足则整笔零写入，并引导先做原始保全、在严格预检仍通过时再生成可恢复备份，绝不静默裁剪封存历史。

这是一道无新增套餐费用的应用级学习区邀请闸门，不等同于 Clerk 原生 Restricted mode：它能阻止未获批准账户进入 Sufeiya 学习页、交互式 Sofia 与 POST 服务，但不能保证用户无法从 Clerk 的其他入口创建一个没有学习权限的 Clerk 身份。公开 `/sign-up` 默认只显示邀请制说明；带 ticket 形状参数的链接只会挂载 Clerk 验证流程，参数形状本身不证明邀请有效。首轮参与边界为 18+ 成人，但 Clerk 登录、获邀或准入 metadata 都不是年龄验证，也不证明教师/教研身份、专业资质、组织关系或个案授权；账户流程不会自动迁移、上传、绑定或按身份隔离现有的三个本机存储命名空间，也不会提供跨设备同步。清除浏览器站点数据会导致这些本机记录丢失。

工作台历史使用 `buildCycleHistoryProjection(state, ledgerStatus)` 生成严格白名单投影。它不读取或写入其他存储命名空间、不调用 `localStorage.setItem`、不追加学习事件，也不发起网络请求；DOM 仅接收计划重点、固定任务集版本、已验证事件数量、UTC 终止时间和 9 个安全长度内的域 ID。原始诊断答案、Writing/Speaking 内容、打卡自由文本、昵称、考试日、账户/Clerk 标识和 Sofia 对话均不会进入投影。任一 ID/技能/任务集/计划来源/时间/匿名事件别名/事件隐私字段不一致，或历史中出现重复 `cycle_id`，该条就只增加脱敏的无效计数而不显示原始内容；全局事件账本校验失败时，全部历史失败关闭。此视图是未签名、本机、只读的流程核对，不是服务器防篡改凭证、正式诊断、学习增长证明或资格人员复核结果。

Sofia智能老师只对已经在六任务诊断证据包中完成 18+ 本机确认、六项任务终态和学习者优先项确认的用户开放，并在每次页面加载后要求另行勾选发送说明；API 同样要求该成人确认字段。页面只构造同轮 `cycle_id` / `diagnostic_session_id`、任务清单摘要、优先能力、证据覆盖数量/置信度、优先项依据、计划、推荐和闭环状态等最小摘要，不接收客户端任务正文、首答、推荐理由或自由文本上下文，不发送姓名、写作答案、录音或打卡自由文本，也不把历史对话发送给模型。请求和响应都使用严格结构校验；银行卡号等敏感内容会在本机保存或发送前拦截，损坏、未知版本或跨标签页已变化的对话保持只读，直到学习者明确清除后重建。

生产默认 `SUFEIYA_AI_ENABLED=false`，当前获批版本只在浏览器本机使用确定性的有来源回答；问题与字段最小化摘要不会发送到本站服务端或外部模型。即使某个环境把该变量改成 `true` 并配置有效密钥，代码也会先读取版本化决策登记表；数据流、留存/删除、地域/跨境、持久化滥用与预算控制、语义级主张—引用支持校验没有全部批准时，第一方服务端处理与外部模型都保持关闭。仓库中的 POST 路径是失败关闭的未来接口，当前客户端不调用；只有另行批准相应发布表面并明确切换客户端数据流后，服务端才可尝试结构化生成，未配置、超时、限流或输出未通过来源编号与安全校验时仍须返回同一白名单上的确定性备用回答。

这条纵向路径是 Gate A 本机流程验证，不是正式诊断、正式能力等级、官方 DET 分数或真实学生试点。六任务证据包只报告本轮任务证据、质量限制、低/中等证据覆盖置信度和学习者确认的下一条优先任务；Writing 与 Speaking 在合格人工审核前不形成最终诊断。Sofia智能老师 Gate A 已开放，但知识范围仍被严格限制：只允许 10 条第一方产品政策/原创任务来源支持主张，5 条公开视频仅作 link-only 目录；DET 官方索引与 631 个归档预览块的准入数仍均为 0。正式诊断、完整课程知识、带教打卡营和真人社区互助继续分阶段开放。当前工具不提供 DET 分数预测、AI 评分、泛化 RAG、真题机经、考试中协助、真实同伴联系、真实奖励或结果保证，也不使用未经独立核验的学员数量与效果数字。

## Deployment

项目使用 Next.js 与 `vercel.json` 配置干净 URL、旧 `.html` 地址重定向及基础安全响应头。Clerk 密钥只存放在 Vercel 环境变量及被忽略的本机 `.env.local`，不得提交到仓库；`.vercel/` 也只保存本机项目链接信息，不进入版本控制。发布必须来自明确提交的干净工作树；任何真实数据、供应商或 Gate B 试点仍需另行完成文档中的 P0 书面决定。

生产规范域名：`https://sufeiya.cn/`。

Production 与 Development 两个 Clerk 实例都必须分别在 `Sessions → Customize session token` 保存以下精确模板；shortcode 会保留 `sufeiyaBetaAccess` 的对象类型。批准或撤销后若需要立即验收，应在当前浏览器会话调用 Clerk `getToken({ skipCache: true })`，否则等待短期令牌的正常刷新：

```json
{
  "sufeiyaBetaAccess": "{{user.public_metadata.sufeiyaBetaAccess}}"
}
```

创建 Clerk application invitation 时，必须把邀请落点设为 `/sign-up`，并附带以下精确 public metadata；Clerk 会在受邀者完成注册后把它复制到新用户。生产邀请属于有外部影响的操作，必须由项目方提供并确认具体邮箱后，通过受控后台流程执行，仓库不提供公开邀请 API：

```json
{
  "sufeiyaBetaAccess": {
    "protocolVersion": "sufeiya_invite_only_beta_v1",
    "status": "approved"
  }
}
```

支付、订阅和发票功能尚未进入本版代码或页面。
