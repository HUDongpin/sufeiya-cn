# Clerk Production 真人受邀验收

这是一条**真人接管、零凭据采集**的 Production 验收路径。它只使用一个已经由项目方和收件人另行授权、已经存在的 Production invitation；运行器不会创建、重发、撤销、删除或查询 Clerk invitation/user，也不会加载 `.env.local`、Clerk 密钥、Testing Token、Vercel bypass 或 storage state。

运行本流程会由真人接受真实 Production invitation，并可能永久创建真实 Clerk user 与 accepted invitation history。邀请创建、具体收件人、邮件投递和运行授权都必须在本流程之外先完成。没有这些授权时，不要运行。

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

3. Owner 授权记录已把本次 `authorizationRunId` 绑定到同一 Production instance 的一个不透明 invitation ID；项目方与收件人已明确批准接受这一条 invitation，收件人可以在现场自行访问邮件、设置密码并完成 Clerk 实际要求的验证码或 MFA。运行前只读 provider 预检必须证明：该 ID 唯一存在且仍为 `pending`，没有过期、撤销或接受；redirect 精确为 `https://sufeiya.cn/sign-up`；public metadata 精确为当前 approved 协议；该 recipient 尚无 exact Clerk user。回执只保留 opaque ID 与布尔值，不保留 ticket，邮箱是否保留由项目方敏感数据规则决定。
4. 使用不会保存 Playwright profile 的本机，关闭屏幕录制、共享、终端录制和外部浏览器自动填充日志。不要把 invitation URL、邮箱、密码、OTP、cookie 或 token 交给操作者之外的人。
5. 从仓库根运行；工作树必须干净。不要 `source .env.local`。任何本机 Clerk key/testing state、Development E2E state、storage state 或 Vercel bypass 环境变量都会在浏览器启动前失败关闭。
6. 不给 npm script 追加任何 Playwright 参数。配置加载只接受 package script 固定的 `test --config=playwright.clerk-production-human.config.ts`；`--output`、reporter、UI、Inspector、trace、retry、repeat 等所有附加参数都会在 Playwright 清理输出目录前失败关闭。配置同时拒绝 remote browser、复用 context、Selenium、dashboard、debug、reporter-output 等环境状态，并固定 headed Chrome、单 worker、零 retry，关闭 screenshot、trace、video、HAR 与 Playwright error-context 页面快照。

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
2. 若 invitation 已 accepted 或 user 已创建，不能把失败测试当成无外部影响；保留 provider 回执，再决定是否只重做不会消费 invitation 的登录验收。
3. 若 invitation 仍 pending，也不要擅自 revoke；由 Owner 根据具体收件人和下一步决定。
4. 若机器流程全部通过，仍须另做 provider `accepted` 只读回执。该回执至少包含 browser receipt/attempt marker 使用的同一个 `authorizationRunId`、不透明 invitation ID、最终状态与接受时间、Production instance、invitation public metadata 精确匹配当前 approved 协议、对应新 user 存在且 user public metadata 精确匹配同一协议；provider 审计还必须用该 created user 的 opaque ID 按上述固定算法复算账户承诺，并与 browser receipt 逐字相等。每项只持久化 opaque ID、账户承诺或布尔结果，不得包含 ticket，是否保留邮箱由项目方的敏感数据规则决定。Owner 的运行授权记录必须预先把这一 run ID 绑定到该具体 invitation，并用 provider 事件链或同等只读事实把 invitation 与 created user 关联，避免用两个互不关联的回执拼接成同一邀请链。
5. 只有 browser PASS、精确 Production deployment 绑定、provider accepted 回执和真人确认同时存在，才可声明这条 Production 受邀账户链完成。

## 永久分离的 Development 边界

本命令与 `test:e2e:clerk-dev`、`test:e2e:clerk-invitation-dev` 完全分离。它不接受 Development keys、Testing Token、固定测试 OTP、Backend create/update/delete、旧 invitation ACK 或 hosted-preview bypass；本流程的真人 Production invitation 也不得使用 `+clerk_test` 合成地址。当前 Development 最终授权已经消耗且基线为 revoked 5；不得借本 runbook 触发第三次 Development invitation。
