# Sufeiya Website

`sufeiya.cn` 是面向中国大陆 DET 学习者的在线学习平台。本仓库使用 Next.js App Router 承载多页面公开网站、Clerk 账户入口与面向受邀内测账户的学生学习工具，并通过 GitHub 与 Vercel 发布；既有页面内容仍由 `scripts/generate-pages.mjs` 统一生成，再由 Next.js 外壳渲染。

## Local development

```bash
npm ci
npm run check
npm run dev
```

Next.js 本地开发地址默认为 `http://localhost:3000`。

不依赖 Clerk 的离线跨页连续性回归可单独运行 `npm run test:e2e:offline`；它使用公开页面与独立本机端口，不读取 Clerk 密钥或创建账户。该测试先生成 production build，再以真实 Chromium 离线网络状态核对提示、同源跨页阻断、键盘操作、恢复导航与三个本机命名空间零写入。默认端口是 `3211`；若它被另一个本机项目占用，可用经过范围校验的覆盖值运行，例如 `SUFEIYA_OFFLINE_E2E_PORT=3216 npm run test:e2e:offline`。

匿名 Reading P0 使用独立的纯领域测试与真实浏览器回归：`npm run test:public-reading` 核对原创内容包、逐对象来源/权利/版本/审核状态、客观首答证据、复测后确定性推荐、事件生命周期与本机存储失败关闭；`npm run test:e2e:public-reading` 先生成 production build，再核对首页两次点击内开始、五段式反馈、2 + 3 + 2 道不复用内容的闭环、两道复测首答全部锁定后统一反馈、前后完整推荐链、查看/导出/双确认删除、损坏与未知版本保全、多标签页冲突、事件账本降级、四个替代 CTA、公开 SignUp 关闭、全程键盘操作、移动/200% reflow、对比度与旧命名空间不变。它不需要 Clerk 密钥，不创建账户，也不发送写请求。

Clerk Development 认证需要在被 Git 忽略的 `.env.local` 中同时提供同一 Development 实例的 `pk_test_` 与 `sk_test_`。若 Vercel Development 作用域未配置 server-only secret，`vercel env pull` 不能单独形成完整的本机凭据；应使用项目所有者维护的受控本机配置，且仓库和日志均不得保存或输出真实密钥值。

### Clerk Development smoke E2E

`npm run test:e2e:clerk-dev` 使用 project-based Clerk setup 与单个 Chromium worker，验证未登录保护、公开注册页不挂载普通 SignUp、已登录但没有有效资格的账户被学习页面与 Sofia POST 拒绝且不读取上一位使用者的 Sofia 本机命名空间。同一临时账户写入精确 Development 准入 metadata 并强制刷新 Clerk 签名会话令牌后，浏览器会在全新学习工作区中通过真实控件完成全部六项 Gate A 任务：两项 Reading 首答（第二项有意选择不匹配答案，以形成确定的 Reading 计划优先项）、静态 MP3 从头播放至真实 `ended`、设备 `speechSynthesis` 的真实 `start` / `end`、不使用假时钟的 20 秒准备加 90 秒 Speaking，以及真实 180 秒 Writing、逐键输入 29 个英文词与三项自查。主路径要求报告为 6 / 6 完成证据、`medium` 覆盖置信度与 `evidence_limited`，Speaking 不请求麦克风也不录音，Writing 不使用粘贴；随后依次走完计划、推荐、练习、打卡、复盘、互助状态、平行微复测与更新计划，核对 7 / 7、九个领域 ID 与六条哈希回链事件。完成登出与重新保护后，测试还会在真实 Clerk `/sign-in` 表单中输入只存在于当前进程内的合成邮箱和随机密码，重新建立 approved session，核对工作区与本机数据连续性，再次登出并验证保护恢复。

真实 Speaking 与 Writing 计时本身固定占 290 秒，因此该单 worker 测试的总超时上限是 900 秒；这是包含 Clerk、页面导航和备份 I/O 的失败上界，不是承诺的常规耗时。跳过或不可用任务“不按零分处理”的合同继续由静态站点核对覆盖；workspace-backup VM 另验证跳过证据可通过严格 writer union，不为这条边界再创建第二个 Clerk 外部用户。

随后测试实际下载 workspace-only 可恢复备份，证明六项 `completed` 诊断、`medium` / `evidence_limited` 报告与 Writing 原文进入本机严格备份，并在原子恢复后逐字保持；作文原文虽然存在于本机未加密工作区和该下载文件中，但不得出现在验证或恢复的任何请求体。测试还证明篡改摘要时零写入拒绝、有效文件须先预检再确认、完整学习工作区的清除与恢复只替换学习命名空间、非空工作区的事件单独清除会零写入阻断、本站不接收恢复 POST、Sofia 对话与教研草稿原始字节不变，并在恢复后继续得到同一闭环与事件链；最后再验证教研演示、Sofia 本机解释、登出隐私和重新保护。首次运行前如本机尚无对应浏览器，可执行 `npx playwright install chromium`。

本机模式默认启动 `127.0.0.1:3210`。若 Next.js Node `proxy` 的本机 Clerk Development 握手在当前版本触发自代理循环，可对一个显式指定的 Vercel hosted target 运行同一套测试；显式目标只接受规范的 HTTPS `*.vercel.app` origin，且不会启动本机 web server。通用测试配置不把域名语法冒充 Preview 身份；形成 Preview 证据前还须用 Vercel deployment metadata 独立确认目标的 `target=preview` 与不可变 deployment ID：

```bash
SUFEIYA_CLERK_E2E_BASE_URL=https://your-new-preview.vercel.app npm run test:e2e:clerk-dev
```

若 hosted target 保留 Vercel Authentication，测试进程还可显式接收 `SUFEIYA_VERCEL_PROTECTION_BYPASS`。该值只允许在 hosted 模式使用，不写入仓库；测试先向被指定的精确 origin 发出一次 `maxRedirects: 0` 的禁止跟随重定向请求，以 Vercel 官方请求头换取安全 bypass cookie，随后浏览器导航只使用该 cookie，不把 bypass 请求头附加到页面请求或跨源重定向。Vercel 的访问保护本身保持开启。

该测试只接受同一 Clerk Development 实例的 `pk_test_` / `sk_test_`；会解码 Publishable Key 的 Frontend API，并用 Secret Key 读取的实例类型和域名做在线匹配，setup 与主 smoke 在创建用户前都会独立核对，不能用 `--no-deps` 绕过。Clerk Backend API 同样固定为规范的 `https://api.clerk.com` 与 `v1`；自定义协议、主机、端口、路径、查询、片段、凭据或 API 版本都会在 SDK 请求前被拒绝。预置 Testing Token、Frontend API 或 testing debug 状态同样被拒绝，setup 必须从已核对的 Development 实例新取短期 token，并用当前运行标记、签发时间与 HMAC 交接给 smoke；测试期间 Clerk helper 的 log/warning/error 参数统一替换为固定脱敏消息。测试创建唯一 `+clerk_test` 合成用户；同一个已核对 Backend client 只按刚创建的精确 user ID 生成 5 分钟测试 sign-in token，再由 Clerk Frontend API 的 ticket strategy 建立第一条真实 Development session，不做第二次邮箱搜索。完整 Gate A 与第一次登出保护通过后，第二条 session 必须由可见 Clerk SignIn 表单提交同一进程内邮箱与密码形成，不复用 Backend sign-in token。密码提交必须先观察已核对精确 Clerk FAPI host 的表单 POST：instant-password UI 只接受精确 `/v1/client/sign_ins`，并要求 `identifier`、`password` 与 `strategy=password` 原样匹配当前进程值；两步 UI 只接受精确 `/v1/client/sign_ins/{sia_id}/attempt_first_factor`，并要求相同 password 与 strategy。随后测试才接受直接 session 或 email-code client-trust 分支：若 Clerk 直接完成，只记录 password session；若当前实例返回 email-code 分支，则 `prepare_second_factor` 和 `attempt_second_factor` 都必须来自同一精确 Clerk FAPI host、POST、200 且 request strategy 精确为 `email_code`，运行时状态必须是 `needs_client_trust` 且唯一可用策略为 email code，OTP 控件还必须精确匹配 `autocomplete=one-time-code`、`inputmode=numeric`、`maxlength=6`，再提交 Clerk 测试邮箱固定码 `424242`。两个分支 waiter 都在密码提交前进入同一竞速，未采用的分支不会形成未处理的超时拒绝。每次运行会用固定脱敏行记录实际选择的分支；`+clerk_test` 模式不会发送真实验证码邮件，所以 email-code 分支只证明 Development test-mode UI/API 链，不是邮件投递。身份值只保存在进程内，不写入 storage state、trace、video、HAR、截图或页面可访问性快照，也不输出邮箱、密码、token、cookie 或 user ID；credential 表单只在同一 browser context 的独立临时页中打开，主 fixture 页会先停在 `about:blank`。普通成功或失败路径会先把临时页导航到 `about:blank` 再关闭；若测试硬超时使函数内 `finally` 来不及完成，拥有独立预算的 `afterEach` 会再次清空并关闭全部页面，再关闭 browser context。此 Clerk E2E 明确关闭自动截图、Playwright error-context 页面快照、trace、video 与 HAR；失败证据只保留脱敏阶段名。无论页面断言是成功、失败还是超时，`afterEach` 也会按精确 user ID 删除，并验证该 ID 与唯一合成 external ID 已不存在且实例用户总数回到运行前基线；若创建响应不确定，会先用该 external ID 恢复精确 user ID。清理失败会独立令测试失败，因此 smoke 与 cleanup 的脱敏失败事实可以同时保留。为了让全局人数基线有确定含义，运行期间不要并行创建或删除同一 Development 实例中的其他用户。

证据边界：loopback 模式只证明本机 Next.js 生产构建；显式 hosted 模式只证明该次指定并另行核对 deployment metadata 的 Vercel target。两种模式都只使用所核对的 Clerk Development 实例；浏览器侧还会把目标实际加载的 Clerk Frontend API 与已核对的 Publishable Key 精确绑定，然后用精确临时 user ID 的短期 server-side testing ticket 形成第一条真实 Development session，先验证无有效资格时失败关闭，再验证当前协议的后台 metadata 经会话令牌刷新后放行 `/workspace` 和 `/teaching-review-demo`。完整 Gate A、登出和重新保护通过后，同一合成用户必须再经可见 SignIn 邮箱/密码表单形成第二条 session；如果该次运行实际观察到 Development email-code client-trust 分支，还必须完成固定 test code，再次通过 approved workspace、设备本机数据连续性和二次登出保护。它证明的是 metadata approval gate、受控合成用户的密码式 credential re-login、该次实际记录的 Development 认证分支与这两条测试 session，不是 `createInvitation → __clerk_ticket → 受邀注册` 的真实邀请接受链；也不证明 `sufeiya.cn` 的 Production Clerk 登录或生产受邀用户，不覆盖真实邮件投递、首次 invitation 注册邮箱验证、真实验证码、全新设备验证或账户级 MFA，不证明角色、教研资质、成人身份或个案授权，不提供账户级本机数据隔离，也不构成 production release readiness。

### Clerk Development 原生邀请接受 E2E

`npm run test:e2e:clerk-invitation-dev` 是与上述 10 分钟 Gate A smoke 分离的、具有持久外部影响的测试。它默认失败关闭：suite 名称由 npm script 固定，但在调用 Clerk API、启动浏览器或执行 Clerk setup 前，还必须收到以下逐字确认；普通 credential smoke 即使环境里残留该确认值也会拒绝运行：

```bash
SUFEIYA_CLERK_INVITATION_E2E_ACK=I_ACCEPT_ONE_PERSISTENT_CLERK_DEVELOPMENT_INVITATION_HISTORY_USING_SYNTHETIC_EXAMPLE_DOT_COM npm run test:e2e:clerk-invitation-dev
```

这个确认值不是密钥，而是对不可回滚 Clerk invitation history 的单次操作授权。测试只接受已在线匹配的 `pk_test_` / `sk_test_` Development 实例和同一受限 loopback / Vercel target；在创建 invitation 前，还会向已核对的精确 FAPI origin 发出一次不携带密钥的只读 `/v1/environment` GET，验证当前 ClerkJS 主版本、Development test mode、ticket/password/email-code 因子、唯一 Email + Password 字段、无 MFA/法律同意/额外动作、允许 `+clerk_test` 子地址，以及进程内随机密码符合当前长度与字符合同。响应 origin、状态、媒体类型、大小、JSON 或任一设置漂移都会在留下新 history 前失败关闭。通过后，测试以当前 run UUID 构造唯一、无真实收件人的 `+clerk_test@example.com` 地址，预检用户与四种 invitation 状态均无同标识记录，再调用一次 `createInvitation({ notify:false })`，把 redirect 精确绑定到目标 `/sign-up`，public metadata 精确绑定到当前 `sufeiyaBetaAccess` 协议。创建调用不做盲目重试；响应不确定时只按唯一邮箱恢复刚才的 invitation，避免重复留下历史。

浏览器只接受已核对 Clerk FAPI host 的 `/v1/tickets/accept` URL。Testing Token 的 context 级 JSON 拦截器会继续覆盖后续 Clerk API，但这个唯一、已验证的顶层接受 URL 会由更精确的临时 route 直接交给浏览器原生处理 303，跳转后立即撤销；因此不会让 JSON helper 自动跟随到本站 HTML、重试或改写 invitation handoff。浏览器随后要求 Clerk 把同一 ticket 转成本站 `/sign-up`。查询参数必须符合 Clerk application invitation 文档规定的单个 `__clerk_ticket`；若当前实例同时附加状态，则只接受另外一个单值 `__clerk_status=sign_up`，两者顺序可交换，重复、其他状态或任意附加参数都失败关闭。随后测试必须先在 request 层观察同一 ticket 对已核对 FAPI host 的精确 form POST `/v1/client/sign_ups`，其中 `strategy=ticket` 与 ticket 都必须单值且原样匹配；再从 Clerk 运行时确认 ticket 已绑定精确邮箱、SignUp 处于 `missing_requirements`、尚未设置密码且缺失字段必须包含 password，除 Clerk 类型声明的可选 `protect_check` 外不得有其他缺失字段。若出现 `protect_check`，必须等待预构建组件完成该中间 challenge、runtime 最终只剩唯一 password 且真实 password input 可见，测试才会填写进程内随机密码。成功必须同时证明：邀请邮箱由 invitation 自动验证、用户启用密码、invitation metadata 原样复制到新用户、invitation 从 pending 变成 accepted、刷新后的签名 session 以 `x-sufeiya-beta-access: approved` 放行 workspace；随后还要登出、用可见 SignIn 邮箱/密码重新登录、再次放行 workspace，并二次登出恢复保护。该凭据重登同样先在 request 层绑定精确表单 POST：既兼容带单值 identifier 的 `/v1/client/sign_ins` 即时密码合同，也兼容无 identifier 的 `/v1/client/sign_ins/{sia_id}/attempt_first_factor` 两步合同；两者都要求同一进程内 password 与单值 `strategy=password` 原样匹配。它不通过 Backend `createUser`、metadata patch 或 sign-in ticket 代替这些证据。

无论成功或失败，临时 user 都按精确 ID 删除并验证总人数回到基线。区别在于 invitation 没有 delete API：成功或已接受后的失败会永久增加一条 accepted history；创建已发生但接受前失败会尝试精确 revoke，并永久增加一条 revoked history；只有 Clerk 根本没有提交创建时四种计数才保持不变。页面 ticket、邮箱和密码不写入 storage state、日志、截图、trace、video、HAR 或 Playwright 页面快照，测试结束后还会清空并关闭全部页面。该测试不得与同一 Development 实例的用户或 invitation 增删并行运行，也不得在没有 Owner 明确确认上述历史影响时执行。它仍不证明真实邮件投递、Production invitation、`sufeiya.cn` Production 登录、真实用户、全新设备或账户 MFA。

2026-08-28 的第二条且最终一条授权已在 `33a56cf` 上消耗：运行前基线为 users 0、pending 0、accepted 0、revoked 4、expired 0；唯一 invitation 在 `invitation SignUp runtime` 阶段、接受前失败，cleanup 独立核对为 `pre_acceptance_history_revoked; exact_user_cleanup=pass`；运行后基线为 users 0、pending 0、accepted 0、revoked 5、expired 0。当前测试把授权时的运行前基线固化为创建前硬门，因此旧 ACK 在现状下会于 `createInvitation` 之前失败，不能被复用为第三次授权。后续离线修复只细分脱敏阶段并区分合法的可选 `protect_check` 中间状态与真正 password-ready 状态；没有再次执行真实 invitation acceptance，故仍不得声明 accepted 或完整邀请链 PASS。

同日的只读 Dashboard 核对确认 Development 与 Production 实例都已经保存上述精确 session-token template，核对期间没有点击保存或修改配置。最终授权运行对应的 Development Application Logs 依次记录 `invitation.created`、`sign_up.created`、因 Testing Token 跳过 CAPTCHA、ticket 进入 SignUp、邀请邮箱验证，以及稍后的 `invitation.revoked`；另一次只读恢复得到的**当前持久化资源（不是 10:11 的逐字段历史快照）**仍是 `missing_requirements`、只缺 password、`created_user=false`、`created_session=false`。这把失败范围收窄到 password 提交以前的 SignUp/UI harness 阶段，但日志中的 `invitation.accepted` 事件只是 ticket/SignUp handoff 事件，不能覆盖最终 provider 资源的 revoked 状态，也不能改写 accepted 0、users 0 的运行后基线。

### Clerk Production 真人受邀验收

`npm run test:e2e:clerk-production-human` 提供一条完全隔离的 headed Chrome 验收入口，只消费一条**已存在并另行授权**的 Production invitation；它不加载 `.env.local`，不接受 Clerk keys、Testing Token、Development E2E 状态、storage state、remote/reused browser 或 Vercel bypass，也不调用 Backend invitation/user API。Invitation URL、邮箱、密码和 OTP 只由真人在临时浏览器 UI 中输入；URL/ticket 会存在于浏览器导航和 Playwright driver 的瞬时内存，但 harness 业务代码不提取、打印、附件化或持久化这些值，也不读取 Clerk inputs、请求体、cookie 或 token。在提示真人打开 ticket 前，测试会无密钥读取公开 Production Clerk environment，核对 live instance、ticket/password/email-code 因子、必填属性、密码策略及 MFA/法律同意/额外动作边界；随后在浏览器内只返回布尔值地核对精确 ticket query、Production runtime 和 native ticket SignUp，并阻止改走普通 SignIn 或新标签。两次 session 的 opaque user ID 与三个本机 namespace 只在浏览器内部以不可导出的临时 HMAC 做相等性比较；为了把 browser account 与 provider created user 绑定，回执只额外保留一个按固定协议、run ID 和高熵 Clerk user ID 在浏览器内计算的单次 SHA-256 账户承诺，不保存原始 ID。完整 approved workspace、`/account`、非空本机 canary、两次真人登出保护和同账户重登全部通过、临时 context 成功关闭后，才写本地脱敏回执；同一 `authorizationRunId` 的 no-clobber attempt marker 会保留以阻止本机意外重跑。

Production invitation 本身由第三条隔离的 Owner CLI 创建。真实入口只能从系统 Terminal 的干净 shell 直接执行受审的 `scripts/clerk-production-invitation-owner`，不能经 Codex/IDE、npm、tsx、Node loader 或仍存活的 Node parent。Zsh 启动器先拒绝启动钩子/代理/TLS/Git override，核对固定 Node、已生成单文件 runtime 的 SHA-256 与干净 source，再以 `env -i`、`exec` 启动这个固定 runtime；runtime 随后仍在任何敏感输入前核对共享 one-shot seal、冻结 deployment和公开 Clerk environment，全部通过后才用 no-echo TTY 读取 live key 与两次相同的真实 recipient。Preflight 要求 Owner-issued run ID，并同时返回 exact helper source SHA、全局 users/四状态 invitation 分母 commitment 与按同 run ID 分域的 HMAC recipient commitment；`execute` 只有在当前 clean helper SHA 和两个 commitment逐字匹配同一 Owner 授权、七天 `notify:true` 邮件合同、共享 Git-common one-shot seal 与固定 ACK 全部成立后才调用一次 `createInvitation`。`status` 只绑定同一 canonical seal/HMAC recipient 做不确定响应后的只读观察，`none` 也不会解除 no-retry；后续正常部署不会使它依赖“旧 deployment 仍为 latest”。它固定 `ignoreExisting:false`、规范 `/sign-up` redirect 与 approved metadata，不支持 bulk、resend、auto-revoke、delete、force 或 POST retry；marker/receipt 不保存 recipient、email hash、raw Clerk ID、URL、ticket、key 或 SDK error。Exact create response 验证后先立即写独立 creation acknowledgement，再以第二个不可覆盖工件记录 `pending_confirmed`/terminal/unknown post-readback；Clerk resource 不回显 redirect/notify/expiry，所以真实 redirect 仍由 browser handoff证明，邮件投递仍由收件人确认。完整 Owner 输入、共享单写、commitment公式和失败语义见同一 runbook。

Owner CLI 会在 marker 前和 POST 紧前无密钥验证 GitHub 最新 Production deployment/status仍为冻结 ID、success 与 Git SHA；GitHub API不直接证明 Vercel apex alias，因此运行前仍必须在 Vercel Dashboard 独立核对 `sufeiya.cn` alias → immutable deployment。运行后还必须取得单独的 provider accepted/user/metadata/commitment 回执。当前尚未获得具体 Production 收件人与 invitation 运行授权，因此 Owner CLI 与 human harness 都只完成离线实现，**没有运行，也不得声明 Production 真人邀请链 PASS**。操作硬门、固定 ACK、现场步骤、失败后的禁止盲重试和回执字段见 [`docs/runbooks/clerk-production-human-acceptance.md`](./docs/runbooks/clerk-production-human-acceptance.md)。

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
- `/learn/reading`：无需登录的 Reading P0 纵向切片；使用 2 道入门检查、版本化微课、3 道主动练习与 2 道不复用短文/题目的独立平行复测，显示五段式错误反馈及复测前后的 `证据 → 能力 → 资源 → 任务 → 复测` 推荐链。本轮客观首答状态与最小事件账本分别保存在 `sufeiya_public_reading_p0_v1` 和 `sufeiya_public_learning_events_v1`，可在本页查看、导出和双确认删除；若学习状态合法而事件账本滞后，页面明确进入 `event_degraded`、冻结事件写入但继续本机学习，并把失配原因写入导出包。该路由不读取、迁移或写入 Gate A、Sofia 或教研命名空间；四个价值后入口只有本机保留、导出、受邀登录和等候名单，公开 SignUp 继续关闭。内容已由苏肥鸭以 Teacher / Content Owner 身份绑定候选 `af85403…` 接受；2026-08-26 的补充决定又接受 Product 公开旅程、当前本机数据/隐私/Legal 治理范围与首页肖像限定用途。PR #15 以 merge commit `1d39883…` 进入 Production deployment `6090012530`，规范域名 G7 回归通过；页面仍有意保持 `noindex, nofollow` 并排除在 sitemap 外，不构成正式诊断、官方分数、学习增长证明，也不能以本段文字代替完整 deployment/commit 回执；
- `/workspace`：七阶段 Gate A 闭环进度、独立功能页入口、只投影中央校验器已确认 ID 的本轮证据链总览、最近最多 10 轮的本机计划版本历史、完成后经整轮本机容量预检开放的“开始下一轮”入口、临时更新计划专用的待资质人员确认承接卡、脱敏的 29 项 P0 书面决定汇总，以及逐条来源治理/RAG 准入的只读计数；
- `/super-teacher`：有来源的 Gate A 学习解释、拒答边界、非 AI 退出，以及只对同时通过共享 v2 完整账本—领域覆盖核对、且当前 provisional 事件片段位于账本连续尾部的轮次开放的 Sofia 本机承接包与未发送人工支持请求；
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
- `/teaching-review-demo`：Clerk 保护且由发布治理放行的 Gate A 本机教研复核演示；只读查看同时通过共享 v2 完整账本—领域覆盖核对、且当前 provisional 事件片段位于账本连续尾部的临时轮次证据，并把修订建议与升级说明保存为独立本机草稿；
- `/my-data`：三个本机命名空间的数据统计与原始保全导出、学习工作区的可验证备份恢复、按命名空间定向清除，以及只读的学习事件清除边界核对；非空学习工作区不能只删事件，须在保全后明确清除整个学习工作区；
- `/learning-path`：七步学习闭环；
- `/platform`：四项平台功能与开放状态；
- `/resources`：中文界面/英文备考材料规则和 Bilibili 学习资源；
- `/about`：团队角色、平台边界与常见问题；
- `/sign-in`：已有受邀账户的 Clerk 登录入口；
- `/sign-up`：邀请制注册说明；只有带 Clerk invitation ticket 的入口才挂载 SignUp，最终访问仍须服务器核验当前内测 metadata；
- `/beta-access`：不读取学习记录的邀请资格状态与重试入口；
- `/account`：登录后账户资料页，未登录访问会返回登录页。

每个顶部导航按钮进入一个独立页面，不使用单页长滚动替代多页面导航。

已加载的页面在浏览器报告离线时会显示非模态提示，并在当前页面内阻止普通同源跨页导航，避免用户误入浏览器错误页；同页锚点、本机下载、外部链接和新窗口操作仍保留浏览器原有行为。网络恢复后会短暂提示可以继续。该边界不读取、写入、迁移或同步任何本机学习命名空间，也不注册 Service Worker、不缓存尚未加载的页面、不承诺刷新、关闭页面或直接离线打开新地址后仍可使用，因此不是 PWA 或完整离线模式。

具有当前邀请资格的 18+ 成人内测账户可以使用：

- 通过同一 `cycle_id` 串联的 Gate A 演示闭环：六任务诊断证据包 → 计划 → 推荐 → 证据式打卡 → 学习者确认 → 自愿互助状态 → 平行微复测 → 更新计划；
- 在互助选择前查看未来成人邀请制小组最多可见的两项本机预览：经白名单映射的任务类别与固定完成状态。预览本身不写入本机状态、不生成 ID 或事件，也不发送网络请求；姓名与账户信息、内部 ID、能力分与诊断结论、首答、作文、录音、打卡自由文本、问题、Sofia 对话和联系方式始终不进入预览。`used` 仍只表示查看了冻结合成经验卡，`realCommunityUsed` 始终为 `false`，不代表已加入、发布或分享给真实社区；
- 在工作台集中核对 `diagnostic_session_id → plan_id → recommendation_id → check_in_id → review_id → peer_help_id/status → retest_id → updated_plan_id`；未通过前序回链的节点不会提前显示。临时更新计划会进入单独的“待具备资质人员确认”承接卡，并通过 `/super-teacher?handoff=provisional#human-support` 进入 Sofia 本机严格承接区。承接区只为 7 / 7 且仍处于 `provisional_pending_human_review` 的当前轮次生成最小化白名单包：生产校验器先用同一共享 v2 真源核对完整账本哈希链、全部事件别名与当前/历史/superseded 领域 owner，再要求本轮 `started → recommendation → 1+ practice → check-in → retest` 是账本连续尾部且没有完成事件或人工回执；页面、本机包和复制文本均不携带原始领域 ID 或独立包编号，只保留严格枚举、状态、时间与当前完整 workspace 的 SHA-256 摘要。旧快照、损坏记录、未知字段、孤儿别名/领域记录、跨轮回链、尾部之后新增事件或非 provisional 状态一律失败关闭，并只提供返回工作台与保全本机数据的路径。它不从来源投影姓名、Clerk 身份、联系方式或学习自由文本字段，也不自动发送、创建真实队列、通知人员、写入 canonical 学习账本、关闭 cycle 或签发正式人工回执；
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
- 本机数据原始保全导出、学习闭环专用的可恢复备份，以及对完整学习闭环、Sofia 对话和教研复核演示草稿的定向清除；学习事件按钮只执行零写入边界核对，不会从非空工作区单独删除账本；
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

Clerk 负责账户身份与资料；Sufeiya 另行负责学习区邀请准入，不会成为本机学习记录的账户绑定层。学习闭环数据使用 `sufeiya_workspace_v1` 本机存储命名空间；所有 `workspace.js` 与 `journey.js` 页面共享同名的 `page-writer` Web Lock 长租约，同一时间只有一个标签页可写，第二个标签页在初始化控件前切换为只读。诊断预检与 Sofia智能老师上下文区都会在交互前显示浏览器安全写入锁能力；不支持 Web Locks 时不建立新的闭环或问答写入。Sofia智能老师的对话副本、未发送人工请求和严格承接包使用独立的 `sufeiya_super_teacher_v1` 命名空间；承接包以当前完整 provisional workspace 的 SHA-256 作为同快照绑定，只保存严格白名单枚举、固定无权限边界和时间，不保存或复制 workspace 中的原始领域 ID；原始答案、作文、口语、打卡自由文本、联系方式与 Clerk 身份字段也不会进入包。教研复核演示与 Sofia 承接共同依赖生产学习事件运行时的共享 v2 完整账本—领域覆盖校验，并要求当前 provisional 五阶段事件片段位于账本连续尾部；任一消费者都不能绕过该判断自行宣称 ready。教研复核演示草稿使用 `sufeiya_teaching_review_demo_v1`，只读取与当前 `activeCycle` 的 protocol、状态及全部下游 ID 完整一致，且符合固定任务集、计划、推荐、回执、任务进度、打卡、复测和临时计划回链的唯一 provisional 本机快照。教研投影只显示冻结枚举、质量标记白名单与确定性推荐说明，不复制原始答案、开放作答、打卡自由文本或原始推荐文案；草稿保存使用独立 Web Lock、源快照 SHA-256、原始字节 compare-and-set、精确写后校验和可核验回滚，任何未知存储状态都会停止后续写入。`/workspace`、七步闭环、练习、专注、本机数据与 `/teaching-review-demo` 先要求有效 Clerk session，再要求 Clerk 签名会话令牌中的 `sufeiyaBetaAccess` 同时具有 `protocolVersion=sufeiya_invite_only_beta_v1` 与 `status=approved`；字段缺失、旧协议、未知状态或令牌声明未就绪一律失败关闭。该最小声明由 Production 与 Development Clerk 实例的 session token template 从后端可写、前端只读的 `publicMetadata.sufeiyaBetaAccess` 生成，页面请求不再逐次调用 Clerk Backend API。metadata 更新可能在当前短期令牌中短暂滞后；受控批准流程必须强制刷新令牌，撤销最多存在一个 Clerk 短期令牌的传播延迟。`/account` 保留给任何已登录账户管理身份。邀请必须由受控 Clerk Backend API 流程创建，并把同一 metadata 作为 invitation `publicMetadata` 附带；仅出现 `__clerk_ticket`、仅创建账户或仅登录都不能获得学习区访问权。

`/my-data` 的可恢复文件只封装 `sufeiya_workspace_v1`，使用 `sufeiya_workspace_backup_v1`、固定 namespace/schema 与 replace-only 合同；不会读取、复制或覆盖 Sofia 对话和教研草稿。选择文件、SHA-256 核对、严格领域对象/数量上限/事件哈希链/当前与历史轮次回链预检都在浏览器本机完成，文件不会上传；摘要用于发现意外损坏，不是服务器签名，也不能防止恶意本机重算。旧协议、未知字段、身份或原始响应键、超限、摘要不符、事件孤儿和交叉引用漂移全部零写入拒绝。恢复必须由学习者明确勾选完整替换，随后在独占 Web Lock 内进行写前 compare-and-set、写后读回、持久化复验与复验后第二次 compare-and-set；只有仍拥有候选值时才可回滚，绝不以旧值覆盖第三方并发写入。学习事件清除按钮只在锁内重读原始值并做严格只读核对：命名空间不存在或账本与所有事件绑定领域状态均为空时报告 already-empty，任何非空、损坏、并发变化、读锁或运行时异常都零写入阻断；需要重置时先完成原始保全，再明确清除整个 `sufeiya_workspace_v1`。当前版本不做事件单独删除、合并、猜测迁移、账户绑定、云同步或跨设备自动恢复。

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
