# Clerk Production 真人受邀验收

这是一条**真人接管、零凭据采集**的 Production 验收路径。它只使用一个已经由项目方和收件人另行授权、已经存在的 Production invitation；运行器不会创建、重发、撤销、删除或查询 Clerk invitation/user，也不会加载 `.env.local`、Clerk 密钥、Testing Token、Vercel bypass 或 storage state。

运行本流程会由真人接受真实 Production invitation，并可能永久创建真实 Clerk user 与 accepted invitation history。邀请创建、具体收件人、邮件投递和运行授权都必须在本流程之外先完成。没有这些授权时，不要运行。

## Owner invitation 创建控制器

Clerk 官方明确说明 Dashboard 创建 application invitation 时不能设置本项目必需的 `redirectUrl` 与嵌套 `publicMetadata`；Dashboard 顶部只有 Email/Role 的快速 Invite 还是 workspace/team 成员邀请，更不是本项目的 application invitation。两者都不得替代本合同。仓库提供一个与 Development E2E、真人 browser harness 永久分离的本机 Owner CLI；它不公开网站 API，也不让 browser harness 持有 Backend key。

控制器固定且不可用环境变量改写的唯一请求为：

```json
{
  "emailAddress": "<仅在进程内使用的 Owner-approved 真实收件人>",
  "expiresInDays": 7,
  "ignoreExisting": false,
  "notify": true,
  "publicMetadata": {
    "sufeiyaBetaAccess": {
      "protocolVersion": "sufeiya_invite_only_beta_v1",
      "status": "approved"
    }
  },
  "redirectUrl": "https://sufeiya.cn/sign-up",
  "templateSlug": "invitation"
}
```

`notify:true` 只证明请求 Clerk 发送真实 invitation email，不证明投递、收取或打开。控制器不支持 `notify:false`，因为它也不会输出或持久化含 ticket 的 invitation URL；无另行批准的安全 handoff 时，`notify:false` 会生成无法安全交付的邀请。七天有效期是当前冻结合同，真正 execute 前必须在 Owner 授权记录中逐字确认；不得用 SDK 默认 30 天或临时环境旋钮替换。

四个命令的权限严格分离。真实 Owner 命令必须由 Owner 本人在系统 Terminal.app 的新独立 shell、仓库根目录直接运行受审启动器；Codex 的 Computer Use 不得打开、聚焦、点击、输入或以其他方式控制 Terminal.app。启动器要求祖先进程链包含系统 `Terminal`，只允许直接 shell/`login` 过渡，并在任何敏感输入前显式拒绝 Codex、ChatGPT/Electron、IDE、`npm`、`npx`、`tsx`、`node --import` 或任何仍存活的 Node/Bun/Deno ancestor；其他未知祖先进程也默认拒绝。下面是唯一受支持的命令形状；固定 Node 路径与摘要是当前 Owner Mac 的受审边界，不能替换为另一个 `node`：

```bash
# 纯本机 launch-check：验证Finder/Terminal祖先进程、ambient、摘要与clean Git；
# 不读取key/邮箱，不访问GitHub/Vercel/Clerk，不写marker/receipt，不启动runtime
/usr/bin/env -i \
  PATH='/Users/peter/.local/share/node-v24.18.0-darwin-arm64/bin:/usr/bin:/bin' \
  LANG=C LC_ALL=C \
  ./scripts/clerk-production-invitation-owner launch-check

# 只读 preflight：先由 Owner 签发唯一 run ID；不写 marker/receipt，不创建邀请
/usr/bin/env -i \
  PATH='/Users/peter/.local/share/node-v24.18.0-darwin-arm64/bin:/usr/bin:/bin' \
  LANG=C LC_ALL=C \
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID='<owner-issued-lowercase-v4-uuid>' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA='787142821c2714122deb3a13f5dd12dfb5b74135' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID='dpl_GWc75MJEYkvr6iidFJvth7LhKRrE' \
  ./scripts/clerk-production-invitation-owner preflight

# 唯一写命令：完整 preflight 重跑、durable no-clobber marker、最多一次 createInvitation POST
/usr/bin/env -i \
  PATH='/Users/peter/.local/share/node-v24.18.0-darwin-arm64/bin:/usr/bin:/bin' \
  LANG=C LC_ALL=C \
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID='<same-owner-issued-lowercase-v4-uuid>' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA='787142821c2714122deb3a13f5dd12dfb5b74135' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID='dpl_GWc75MJEYkvr6iidFJvth7LhKRrE' \
  SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA='<preflight-helper-source-git-sha>' \
  SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT='<preflight-provider-baseline-commitment>' \
  SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT='<preflight-recipient-commitment>' \
  SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK='I_AUTHORIZE_ONE_PRODUCTION_CLERK_APPLICATION_INVITATION_FOR_THE_BOUND_RECIPIENT_WITH_SEVEN_DAY_EMAIL_DELIVERY_PERSISTENT_HISTORY_AND_NO_AUTOMATIC_RETRY' \
  ./scripts/clerk-production-invitation-owner execute

# create 响应丢失或中断后的唯一恢复入口：只读完整分页查询，不重发、不撤销、不删除
/usr/bin/env -i \
  PATH='/Users/peter/.local/share/node-v24.18.0-darwin-arm64/bin:/usr/bin:/bin' \
  LANG=C LC_ALL=C \
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID='<same-owner-issued-lowercase-v4-uuid>' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA='787142821c2714122deb3a13f5dd12dfb5b74135' \
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID='dpl_GWc75MJEYkvr6iidFJvth7LhKRrE' \
  ./scripts/clerk-production-invitation-owner status
```

Secret Key 与真实 recipient 不得作为命令参数、环境变量、`.env.local`、聊天、终端历史或仓库文件。`/bin/zsh -f` 启动器先证明系统 Terminal 祖先进程、拒绝 Codex/IDE/npm/tsx/Node ancestors、Clerk state、proxy/TLS/debug/CI/Git override与解释器 preload，核对固定 Node 24.18.0 二进制、已审单文件 runtime 的 SHA-256 和干净工作树；随后以 `env -i` 和 `exec` 进入无 loader 的 bundled runtime。固定 runtime 仍在任何敏感输入前核对共享 one-shot seal、live GitHub deployment/status 与公开 Clerk environment；全部通过后才在同一受控 TTY 读取 hidden live key、hidden recipient，并要求第二次 hidden recipient 逐字相同。输入有固定长度上限，TTY error/end/close 统一恢复 terminal state；敏感值只存在于最终 Node 进程内存。

`launch-check` 只运行 launcher 本地边界并在成功时输出固定 `PASS_LAUNCH_BOUNDARY_NO_SENSITIVE_INPUT; stage=complete`；它不会启动 bundled runtime、不会访问网络，也不会读取敏感值。任一失败只输出固定 `FAIL_REDACTED_BEFORE_SENSITIVE_INPUT; stage=<allowlisted-stage>`，其中 stage 只能来自源码内固定集合，不包含进程名、路径、环境值、key、邮箱或provider响应。它可在修复本机启动边界期间重复运行，不消费 invitation授权；`execute` 仍不得因 launcher失败而擅自重跑。

`preflight` 在只读核对 exact recipient 与全局 users/pending/accepted/revoked/expired 分母后，输出 `helper_source_git_sha`、64-hex `provider_baseline_commitment` 与同 run ID 分域的 64-hex `recipient_commitment`。Owner 授权必须把三个值与真实 recipient、七天 `notify:true`、固定请求、当前 deployment 和 run ID 绑定；helper commit 或 generated runtime 变化后必须重新 preflight/重新授权，旧输出不能复用。`preflight` 发现 execute ACK、baseline、外部 recipient commitment 或外部 helper SHA 残留会失败；`execute` 在任何 seal/POST 前逐字匹配当前 clean helper SHA，并复算 recipient commitment匹配 Owner 授权值。`status` 只接受同一 run ID，并拒绝 execute-only 状态；它用同一 hidden key/两次一致的 recipient 复算 canonical seal 中的 HMAC。若 run/source/deployment/instance/recipient 任一不匹配便在 provider GET 前停止。为保住该唯一恢复入口，在 provider/browser closure 完成前必须保留固定 Node 24.18.0 二进制、该 helper commit及其 exact generated runtime；仓库前进后应在独立干净 worktree 恢复 seal 中的原 helper SHA，再运行 status，不能用新 HEAD 冒充。即使 status 观察到 `none`，输出也固定携带 `creation_outcome_remains_unknown=true`，永远不能据此解除 no-retry。

失败输出按权限分层：`preflight` 只可能给固定 `FAIL_PREFLIGHT_NO_WRITES`，纠正只读边界后可在同一 run 上重跑；一旦进入 `execute`，任何失败都按 `FAIL_REDACTED_NO_RETRY` 处理，不根据本机猜测重发；`status` 失败固定为 `FAIL_STATUS_READ_ONLY`，仍保持 `creation_outcome_remains_unknown=true`，可在恢复 exact helper/runtime 后重跑这个只读命令。

控制器用 live key 只读核对编译时固定的 Production instance commitment、非 satellite `sufeiya.cn` domain、`clerk.sufeiya.cn` FAPI、exact recipient 无 user，且四种 invitation 状态的完整分页中均无 exact history。Preflight/execute 在敏感输入前、初始 provider state 与 POST 紧前三次要求 GitHub 最新 Production deployment/status仍为 deployment `6090377343`、success status `17321852530`、Git SHA `787142821c2714122deb3a13f5dd12dfb5b74135` 和已审 Vercel environment URL。`status` 改为按固定历史 deployment ID/status ID 核对不可变记录，不要求旧 deployment 永远保持 latest。Vercel Dashboard 的 apex alias → immutable `dpl_...` 映射仍须在 execute 紧前人工重验，因为公开 GitHub API不直接回显 alias 绑定。

启动器在敏感输入前已经把 clean helper SHA 与已加载 runtime 的固定摘要绑定；此后本机源码变化不会改变当前进程中已加载的 bundle。`execute` 会在同一进程里重新读取 deployment、instance、exact recipient 与全部全局分母，baseline commitment 任一变化都会在占用 one-shot seal 之前失败。全部最终只读门通过后才以临时文件 fsync + 原子 hard-link no-clobber + directory fsync 写入 canonical seal，随后才允许唯一 POST。跨机器和 Clerk Dashboard 仍须由 Owner 维持单写窗口。

`execute` 在唯一 POST 前会写入所有 Git worktree 共用的 Git common directory，而不是当前 worktree 的 `output/`：

```text
<git-common-dir>/codex-clerk-production-invitation-owner/attempts/
```

唯一 canonical run marker 是 `production-one-shot.seal`；不再维护可能出现半写状态的第二份 run marker。写入先完成私有 `0600` 临时文件与 file fsync，再以同目录 atomic hard link取得 canonical 名称并 directory fsync；正常清理还会 unlink 临时名称并再次 fsync。异常文件系统清理失败时可能保留一个同 inode 的私有 `.tmp` hard link，它不是第二个 run marker、不得删除 canonical seal或据此重跑。这是当前目标“一条真实 Production invitation”的永久一次性 seal，不是未来通用 invitation manager。Preflight/execute 在提示敏感输入前要求 seal 不存在，status 要求它存在。成功收到并验证 exact `createInvitation` response 后立即写：

```text
<git-common-dir>/codex-clerk-production-invitation-owner/receipts/<run-id>.creation.json
```

只有这个 creation acknowledgement 已经 fsync 后才开始 provider post-readback；结果另写为：

```text
<git-common-dir>/codex-clerk-production-invitation-owner/receipts/<run-id>.post-observation.json
```

Creation 回执只包含 run ID、helper/deployment SHA、deployment ID、时间、固定请求/response 布尔值、明确命名的 `createResponseStatus=pending`、授权 baseline/recipient commitments、稳定 instance binding commitment，以及按 run ID 分域的 invitation commitment；没有含义不清的通用 `status` 字段。Post observation 只通过同一 invitation commitment 绑定并记录 `pending_confirmed`、`accepted_observed`、`terminal_state_observed` 或 `unavailable_or_inconsistent`。两者都不包含 recipient、email hash、raw instance/invitation/user ID、URL、ticket、Secret Key 或 SDK error。只有 `pending_confirmed` 才证明当时 readback 为唯一 pending；其他 observation 不能冒充 pending，也绝不触发第二次 POST。若进程在 creation ACK 后、post-readback 前中断，ACK 仍保留，后续只能运行 status。

Commitment 复算合同为：

```text
instanceCommitment = SHA-256(
  "sufeiya_clerk_production_instance_binding_v1" + NUL + Clerk instance ID
)

invitationCommitment = SHA-256(
  "sufeiya_clerk_production_invitation_commitment_v1"
  + NUL + authorizationRunId + NUL + Clerk invitation ID
)

recipientCommitment = HMAC-SHA-256(
  key = 本次 no-echo 输入的同一 Production Secret Key,
  message = "sufeiya_clerk_production_recipient_commitment_v1"
    + NUL + authorizationRunId + NUL + exact recipient email
)

providerBaselineCommitment = SHA-256(
  "sufeiya_clerk_production_provider_baseline_v1"
  + NUL + totalUsers
  + NUL + pendingInvitations
  + NUL + acceptedInvitations
  + NUL + revokedInvitations
  + NUL + expiredInvitations
)
```

稳定 instance commitment 用于绑定同一 Production instance，不按 run ID 变化；invitation 与 recipient commitment 都按 run ID 分域。Recipient commitment由 preflight 输出、Owner 授权、execute 复算，并进入 canonical seal 与 creation receipt；它不进入 browser receipt。Invitation resource 不回显 `redirectUrl`、`notify`、expiry 或 template，因此创建回执只准确声明**固定请求参数已由受审源码提交**；provider resource readback证明 status/metadata，最终 browser ticket handoff再证明实际落到规范 `/sign-up`。不能把这三层证据互相冒充。

## 成功证据与上限

一次 PASS 同时证明：

- 真人 ticket handoff 前，无密钥读取的 Production `/v1/environment` 已核对 live instance、ClerkJS、ticket/password/email-code 因子、必填属性、密码策略、MFA、法律同意、额外动作与 allow/block 边界兼容；
- 真人在 `https://sufeiya.cn/sign-up` 进入应用自己的 invitation marker；浏览器内部同时核对精确 ticket query 形状、`pk_live_` runtime、ticket 已验证邮箱且只待受邀 SignUp 要求，再在同一页完成 Clerk 步骤；
- Production session 以签名 claim 放行 `/workspace`，响应同时满足 `200`、`x-sufeiya-beta-access: approved`、私有缓存和 noindex 边界；
- `/account` 的真实 Clerk `UserProfile` 挂载；
- 在 `/focus` 通过真实“开始专注 → 重置”生成一个不含自由文本或身份字段的非空本机 workspace canary；
- 首次登出后 `/workspace` 重新跳转 `/sign-in`；
- 真人再次登录后，浏览器内部比较两次 opaque `Clerk.user.id` 的 HMAC 结果为相同，且 approved workspace 与 `/account` 再次通过；
- 三个本机 namespace 在同一临时 browser context 中逐字节连续，最后再次登出并恢复保护。

Invitation URL/ticket 必然存在于浏览器导航和 Playwright driver 的瞬时进程内存；本 harness 业务代码不调用 `page.url()`、不把 URL/query 值返回测试进程，也不打印、附件化或持久化这些值。账户 ID、三个 namespace 原始字节、不可导出的 HMAC key 与 HMAC 值只由浏览器内比较代码处理。为把 browser account 与 provider created user 交叉绑定，浏览器还会持久化一个按 `SHA-256("sufeiya_clerk_production_account_commitment_v1" + NUL + authorizationRunId + NUL + Clerk.user.id)` 计算的 64 字符小写十六进制账户承诺；原始 user ID 不离开浏览器。该承诺按 run ID 分域、面向高熵 opaque Clerk ID，但仍是可由持有该 user ID 的 provider 审计者复算的伪名标识，不能用于别的目的或跨 run 关联。关闭全部 artifact 和输出通道只能证明没有设计外落盘，不能声称敏感值从未进入浏览器/driver 内存。

这次 PASS **不单独证明**：

- Clerk provider 中 invitation 的最终状态为 `accepted`；这仍需一份独立、只读、脱敏的 Dashboard/Backend 回执，并通过同一个 Owner-issued `authorizationRunId` 与 browser receipt 交叉绑定；
- 邀请邮件真实投递，或真人具体走了 password、email code、passkey、device verification、MFA 中哪一条分支；运行器不读取表单或 FAPI 请求体；
- 本机数据绑定到账户、账户级隔离、云同步或跨设备连续；canary 只证明同一 origin、同一临时 browser context 跨 logout/re-login 不变；
- Git SHA 与 Vercel deployment 的真实绑定；运行器会分别记录自动读取的干净 `harnessSourceGitSha` 与人工声明的 `declaredVercelDeploymentGitSha`，但 deployment ID/SHA 的对应关系仍必须先在 Vercel Dashboard 独立核实。

## 运行前硬门

必须逐项完成：

1. 在 Vercel Dashboard 核对 `sufeiya.cn` 当前 Production alias 指向一个不可变、READY 的 deployment，并记录该 deployment ID 与 Git SHA。本地验收器工作树必须干净；它的 HEAD 会作为独立的 `harnessSourceGitSha` 自动记录，不要求与被测 deployment Git SHA 相同。
2. 只读核对 Production Clerk `Sessions → Customize session token` 仍为：

   ```json
   {
     "sufeiyaBetaAccess": "{{user.public_metadata.sufeiyaBetaAccess}}"
   }
   ```

3. Owner 授权记录已把本次 `authorizationRunId` 绑定到同一 Production instance 的一个不透明 invitation ID；项目方与收件人已明确批准接受这一条 invitation，收件人可以在现场自行访问邮件、设置密码并完成 Clerk 实际要求的验证码或 MFA。运行前只读 provider 预检必须证明：该 ID 唯一存在且仍为 `pending`，没有过期、撤销或接受；public metadata 精确为当前 approved 协议；该 recipient 尚无 exact Clerk user。Redirect 证据来自 Owner helper 的固定 exact-request receipt，不能谎称由不含该字段的 Invitation resource readback；真人 harness 仍须实际证明 ticket 落到 `https://sufeiya.cn/sign-up`。回执只保留 opaque ID/commitment 与布尔值，不保留 ticket，邮箱是否保留由项目方敏感数据规则决定。
4. 使用不会保存 Playwright profile 的本机，关闭屏幕录制、共享、终端录制和外部浏览器自动填充日志。不要把 invitation URL、邮箱、密码、OTP、cookie 或 token 交给操作者之外的人。
5. 从仓库根运行；工作树必须干净。不要 `source .env.local`。任何本机 Clerk key/testing state、Development E2E state、storage state 或 Vercel bypass 环境变量都会在浏览器启动前失败关闭。
6. 不给 npm script 追加任何 Playwright 参数。配置加载只接受 package script 固定的 `test --config=playwright.clerk-production-human.config.ts`；`--output`、reporter、UI、Inspector、trace、retry、repeat 等所有附加参数都会在 Playwright 清理输出目录前失败关闭。配置同时拒绝 remote browser、复用 context、Selenium、dashboard、debug、reporter-output 等环境状态，并固定 headed Chrome、单 worker、零 retry，关闭 screenshot、trace、video、HAR 与 Playwright error-context 页面快照。
7. Recipient 在 Owner CLI 完成并得到 `post_state=pending` 前不得打开 invitation 邮件或链接。Owner CLI 完成后关闭该受控 shell；在新的干净 shell 中只提供下面四个 human-harness 非密钥变量。不得继承 create ACK、provider baseline 或任何 Owner CLI state。先启动 headed harness，看到它已完成无票据 `/sign-up`/public environment preflight 并等待真人 ticket handoff 后，recipient 才打开邮件并在该临时浏览器继续。

## 启动

下面四个变量不是密钥；deployment SHA 与 deployment ID 必须来自第 1 步的人工核对，UUID 必须由 Owner 为这次具体 invitation 运行单独签发。验收器自己的干净 HEAD 会自动读取，不需要也不允许用环境变量冒充。不要把 invitation URL 放进命令、环境变量、stdin 或测试文件：

```bash
SUFEIYA_CLERK_PRODUCTION_HUMAN_ACK=I_HAVE_OWNER_AND_RECIPIENT_AUTHORIZATION_TO_ACCEPT_ONE_EXISTING_PRODUCTION_INVITATION_AND_RELOGIN_TO_THE_SAME_ACCOUNT_IN_A_TEMPORARY_BROWSER \
SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID=<owner-issued-v4-uuid-for-this-one-run> \
SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA=<40-character-production-deployment-git-sha> \
SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID=<immutable-vercel-deployment-id> \
npm run test:e2e:clerk-production-human
```

运行器会先打开 Production `/sign-up` 的普通邀请说明页，确认 fresh signed-out `pk_live_` runtime 与精确 Frontend API host，再无密钥 GET 公开 `/v1/environment`。只有 Production 设置兼容时才写 no-clobber attempt marker并输出 invitation 提示；设置不兼容会在 ticket handoff 前退出，不消耗 invitation。随后：

1. 只在可见临时 Chrome 的地址栏打开收件人拿到的 invitation URL；不要把 URL 粘贴进终端、Playwright Inspector 或聊天。页面载入后先停住，等终端确认 native ticket SignUp 已绑定再继续。
2. 初次 invitation 阶段禁止新标签、普通 `/sign-in` 与社交登录；真人只在同一邀请页完成 Clerk UI 要求。运行器不定位、不填写、不读取任何 Clerk input，也不读取邮件或 factor 分支；session 还必须没有未完成的 Clerk `currentTask`。
3. 首次 session、approved workspace、account widget 与本机 canary 通过后，真人通过页面头部的账户控件退出；运行器不读取头像、账户菜单或身份文本，只核对 session/user 清空及 `/workspace` 重新保护。
4. 在仍然可见的 `/sign-in` 页面中，真人再次登录**同一账户**并自行完成 Clerk 要求的全部步骤。
5. 浏览器内部完成同账户与本机 namespace 连续性比较；approved workspace 与 account 再次通过后，真人再从页面账户控件退出，最终保护恢复后才产生 PASS。

## 回执与隐私

临时 Chrome fixture 启动并完成普通 `/sign-up` 与公开 Clerk environment 的只读预检后、人工 ticket handoff 之前，运行器会以 `wx` no-clobber 方式按 Owner-issued `authorizationRunId` 写入一个本机 attempt marker：

```text
output/clerk-production-human-attempts/
```

同一受控工作区不能第二次使用同一个 `authorizationRunId`，即使 harness commit 或 declared deployment 发生变化；marker 即使本次失败也保留。它只阻止本机意外重复，不能替代 Clerk provider 状态或跨机器 Owner 治理，不得为绕过失败而删除。

成功回执只在所有页面清空、临时 browser context 已经成功关闭之后写入被 Git 忽略的：

```text
output/clerk-production-human-receipts/
```

文件以 `0600`、no-clobber 方式创建，只包含：协议版本、规范 origin、Owner-issued authorization run ID、上述单次运行账户承诺、自动读取的 `harnessSourceGitSha`、人工输入的 `declaredVercelDeploymentId` 与 `declaredVercelDeploymentGitSha`、Chrome 版本、开始/结束时间，以及固定白名单上的十一个 `true`（包括公开 Production Clerk environment preflight）。`declared` 明确表示 deployment ID/SHA 是运行前人工核对输入，不是 harness 自动发现的 provider 绑定；也不要求测试代码提交本身先部署到 Production。除明确列出的账户承诺外，回执不包含 email、user ID、invitation ID、ticket、query、密码、OTP、cookie、token、DOM、localStorage 原文、其他摘要、截图或网络载荷。

Playwright runtime 输出目录与上述回执目录分开；screenshot、trace、video、HAR 与 error-context 页面快照都不保留。Playwright 仍可在专用输出目录留下只含状态与失败测试标识的 `.last-run.json`，它不包含页面或凭据。失败时只显示固定脱敏阶段，并先把所有页面导航到 `about:blank` 后关闭临时 context。

## 失败或中断

失败、超时、浏览器关闭或真人中止后：

1. **不要自动重试、删除 attempt marker 或创建另一条 invitation。** 先把当前 invitation/user 状态作为外部事实单独只读核对。
   Owner create 命令若在 POST 前后失败，也只能直接运行 `./scripts/clerk-production-invitation-owner status`；即使 status 暂时观察到零条，也只能报告 outcome unknown，不能推断 Clerk 没收到 POST。
2. 若 invitation 已 accepted 或 user 已创建，不能把失败测试当成无外部影响；保留 provider 回执，再决定是否只重做不会消费 invitation 的登录验收。
3. 若 invitation 仍 pending，也不要擅自 revoke；由 Owner 根据具体收件人和下一步决定。
4. 若机器流程全部通过，仍须另做 provider `accepted` 只读回执。该回执至少包含 browser receipt/canonical seal 使用的同一个 `authorizationRunId`、不透明 invitation ID、最终状态与接受时间、Production instance、invitation public metadata 精确匹配当前 approved 协议、对应新 user 存在且 user public metadata 精确匹配同一协议。Provider 审计必须同时复算并逐字比较三条绑定：Production instance ID → creation receipt 的稳定 `instanceCommitment`；最终 invitation ID + run ID → creation receipt 与 post-observation 中逐字相同的 `invitationCommitment`；created user ID + run ID → browser receipt 的 `accountCommitment`。还要分别核对 creation receipt 的 provider baseline commitment、post-observation 的 provider-state commitment与实际全局分母演变相容。每项只持久化 opaque ID、commitment 或布尔结果，不得包含 ticket，是否保留邮箱由项目方敏感数据规则决定。Owner 的运行授权记录必须预先把这一 run ID 绑定到该具体 invitation，并用 provider 事件链或同等只读事实把 invitation 与 created user 关联，避免用互不关联的回执拼接成同一邀请链。
5. 只有 browser PASS、精确 Production deployment 绑定、provider accepted 回执和真人确认同时存在，才可声明这条 Production 受邀账户链完成。

## 永久分离的 Development 边界

本命令与 `test:e2e:clerk-dev`、`test:e2e:clerk-invitation-dev` 完全分离。它不接受 Development keys、Testing Token、固定测试 OTP、Backend create/update/delete、旧 invitation ACK 或 hosted-preview bypass；本流程的真人 Production invitation 也不得使用 `+clerk_test` 合成地址。当前 Development 最终授权已经消耗且基线为 revoked 5；不得借本 runbook 触发第三次 Development invitation。
