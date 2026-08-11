# ADR 0002：本机学习事件账本 v2

- 状态：Accepted（runtime-enabled；browser-local only）
- 日期：2026-08-10
- 合同：`sufeiya.learning-event.v2`
- 相关资产：
  - `data/learning-event-register.v2.json`
  - `data/learning-event.schema.v2.json`
  - `data/learning-event-examples.v2.json`

## 背景

已经批准的学生智能诊断与伴学平台方案需要把“诊断—推荐—练习—打卡—复测—更新计划”表达为可追踪的学习闭环。当前 Gate A 已启用本机浏览器内的学习事件 runtime，但仍是证据受限流程：没有 LRS，没有 xAPI 发送，没有历史数据迁移，也没有把学习者身份交给学习事件账本或 Sofia 智能老师的授权。

本 ADR 冻结 browser-local runtime 必须采用的 v2 事件合同、隐私边界与完整性规则，并授权在这些边界内对启用后真实成功提交的动作进行本机追加。它不授权网络请求、LRS/xAPI dispatch、历史回填、Clerk 身份进入账本或 Sofia 数据流。

## 决策

### 1. 固定合同与唯一 allowlist

事件 `contractId` 固定为 `sufeiya.learning-event.v2`，`schemaVersion` 固定为 `2`。首批且唯一允许的事件类型为：

1. `learning_cycle.started`
2. `recommendation.decided`
3. `practice_attempt.finalized`
4. `check_in.committed`
5. `retest.completed`
6. `learning_cycle.completed`

任何未列出的类型均须被 schema 和写入端拒绝。完整新 cycle 的典型阶段顺序为：

`learning_cycle.started` → `recommendation.decided` → 零次或多次 `practice_attempt.finalized` → `check_in.committed` → `retest.completed` → `learning_cycle.completed`

`practice_attempt.finalized` 可以重复，但每次必须使用新的 `eventId`、`idempotencyKey` 和 `attemptId`。账本顺序由顶层单调递增的 `sequence` 表示；事件语义之间的因果关系只能通过 `context` 中的事件层 UUIDv4 alias 表示。

启用边界不是历史迁移边界。runtime 可以把启用后真实成功提交的任一 allowlist 事件作为新账本的 `sequence = 1`；例如一个启用前已经开始的 active cycle，可以从启用后的练习、打卡、复测或完成提交开始记录，不能为了补齐典型序列而伪造更早的 `learning_cycle.started`。一旦某个 cycle 在账本中出现，之后针对该 cycle 的事件只能沿上述阶段向前，不得阶段回退；重复练习仍按 allowlist 规则允许。

### 2. 统一扁平 envelope

每条事件严格采用以下顶层字段，不得增加其他顶层字段：

```text
contractId
schemaVersion
eventId
idempotencyKey
eventType
sequence
occurredAt
recordedAt
subject
context
activity
attributes
privacy
governance
previousEventHash
eventHash
```

`eventId` 与 `idempotencyKey` 都是本机密码学安全随机数生成器产生的 UUIDv4。一次已经成功提交的业务动作重试时必须复用原 `idempotencyKey`，不能为了重试生成第二个语义相同的事件。runtime 读取账本和追加候选事件时都必须检查 `eventId` 与 `idempotencyKey` 分别唯一。

`occurredAt` 是业务提交成功的时间，`recordedAt` 是事件成功追加到账本的时间。runtime 必须保证 `recordedAt >= occurredAt`。点击、表单校验失败、写入失败、未完成步骤以及尚需人工确认的闭环都不得伪装成成功事件。实际 runtime 生成的候选事件必须先按同一合同校验 pre-hash 字段，在补入按合同计算的 `eventHash` 后、追加前通过完整 canonical v2 Schema；不能只校验一套独立的近似 shape。

### 3. 匿名随机 subject；不接入 Clerk 身份

`subject.subjectId` 是形如 `anon_<UUIDv4>` 的本机随机 alias；`subjectType`、`identityAssurance` 和 `assignedBy` 分别固定为 `anonymous_installation`、`local_random_alias` 和 `local_runtime_csprng`。

该 alias：

- 不得由 Clerk user ID、OAuth ID、邮箱、手机号、用户名或其他账户标识派生；
- 不得保存上述标识的明文、哈希、加密值、截断值或可逆映射；
- 只在当前本机账本生命周期内提供事件关联，不声明跨设备、跨浏览器或跨账号身份连续性；
- subject 发生重新初始化时必须开始一条 `sequence = 1`、`previousEventHash = null` 的新链，不能拼接到旧链；首条事件可以是启用后真实提交的任一 allowlist 类型。

Clerk 可以作为应用登录方案独立实现，但 Clerk 身份不属于本合同，也不得进入本账本。

### 4. context 只允许事件层 UUID alias

`context` 中的每个值都必须是本机随机 UUIDv4 alias。字段名仅描述事件层关系，例如 `learningCycleId`、`attemptId`、`practiceReceiptId`；值不得复用数据库主键、Clerk ID、URL、课程文本、答案、文件名或其他业务层原始标识。

每类事件允许和必需的 context 字段由 schema 及 register 共同冻结。未登记字段须拒绝，避免以后把身份、自由文本或业务对象悄然塞进 `context`。

### 5. 最小化属性与证据边界

`attributes` 只保存枚举、布尔值和有限计数；不保存自由文本、原始答案、写作正文、音频、转写、Sofia 提示词或 Sofia 回复。技能、活动与结果必须满足 schema 的配对规则。

写作和口语练习只记录 `task_completed_no_score`；阅读和听力可以记录单任务是否匹配。听力练习在音频质量不足时允许 `outcome = needs_retry`、`evidenceType = single_task_needs_retry`、`evidenceStatus = evidence_insufficient`；正常证据使用 `evidence_limited`，且不得把质量不足记录为 matched。听力复测可用 `evidenceSufficiency = insufficient_audio_conditions`，但必须进入 `required_not_completed` 或 `completed` 的人工确认路径并遵守审核收据门槛。所有 `automatedScoreProduced`、`formalDiagnosisProduced`、`growthClaimed` 和 `officialEquivalenceClaimed` 均固定为 `false`。这些事件是本机流程元数据，不构成标准化测评、正式诊断、学习增值或官方等级等值证据。

`learning_cycle.completed.attributes.nextFocusSkill` 除四项技能外可以是 `Balanced`；该值只适用于 cycle completion，practice/retest 的 `skill` 仍严格限于 Reading、Listening、Writing、Speaking。

### 6. 只向前记录，不回填

`governance.captureMode` 固定为 `forward_only_no_backfill`，`historicalBackfillAllowed` 固定为 `false`。

runtime 只能记录功能启用后、且在本次运行中真实成功提交的业务动作。不得扫描、转换、上传或推断现有 localStorage、旧页面状态、历史收据、服务器记录或先前用户活动。即使旧数据看起来可以映射为 v2 事件，也不能回填。启用前已经存在的 active cycle 不要求补发其 earlier phases；账本从启用后第一个实际提交的 allowlist 事件起链，并从该已观察阶段向前。

### 7. 本机哈希链与 fail-closed

每条事件顶层包含：

- `sequence`：从 `1` 开始、逐条加一；
- `previousEventHash`：首条为 `null`，其余等于前一条的 `eventHash`；
- `eventHash`：对“删除顶层 `eventHash` 后的完整事件”执行 RFC 8785 JSON Canonicalization Scheme（JCS），再计算 SHA-256，结果为小写十六进制。

读取或追加前必须校验：canonical v2 Schema、允许事件类型、`recordedAt >= occurredAt`、事件 ID 与幂等键分别唯一、同一匿名 subject、连续 sequence、前向哈希连接和每条重算哈希。runtime 实际生成的候选事件还必须在计算哈希前和补入 `eventHash` 后分别通过适用的合同检查。任一校验失败即 fail-closed：

- 不得继续追加；
- 不得把损坏链的部分结果投影成学习状态；
- 不得静默截断、自动修复、跳过坏事件或另起分叉继续写入；
- 不得把账本、绑定关系或派生结果提供给 Sofia；
- 事件专用“有效账本备份”必须拒绝损坏账本，不能把损坏链标成 `valid_at_export`；
- 全量原始数据的用户主动隔离导出仍可包含未解释、未修复的损坏事件数据，但必须明确标记为 invalid/quarantined，不能提供部分投影、LRS/xAPI 导出或 Sofia 输入；
- 可以提供明确的“清空并重新开始”操作，但必须由用户主动发起。

哈希链只能检测常见的本机损坏或不一致。能够修改本机存储的恶意用户或程序也能够重写事件并重新计算整条链，因此本合同明确采用 `integrityAssurance = local_hash_chain_not_tamper_proof`，不把它表述为防篡改日志、数字签名、可信时间戳或审计证明。

### 8. 应用层 append-only

正常应用路径只能在尾部追加新事件。更正通过新的后续事件表达，不得原地改写已经成功追加的事件。这里的 append-only 是应用行为约束，不是操作系统、数据库或密码学层面的不可变性保证。

### 9. 无网络、无 LRS、无 xAPI dispatch

以下 governance 值在每条事件中固定：

- `storageScope = browser_local_only`
- `networkDispatch = disabled`
- `lrsDispatch = disabled`
- `xapiDispatch = disabled`
- `exportEligibility = local_user_backup_only_not_lrs_exportable`

“本地用户备份”只表示用户可以下载或复制自己的原始本机账本用于个人恢复。该备份不是 LRS 导出包，不得自动上传、批量转发、改名为 xAPI statement，亦不得被 Sofia 或第三方模型消费。

### 10. Sofia 隔离

`governance.sofiaAccess` 固定为 `forbidden`。Sofia 智能老师不得读取或接收：

- 原始事件账本；
- context alias 或推荐/任务 binding；
- 哈希、幂等键、sequence；
- 从账本计算出的学习者画像、提示词上下文或个性化输入。

任何未来把学习事件用于 Sofia 个性化的方案，都需要新的数据最小化设计、单独批准和新的 ADR；不能通过修改本合同的示例或 register 暗中启用。

### 11. 人工确认门槛

`retest.completed` 可以明确记录 `humanConfirmationStatus = required_not_completed`，但此时不得发出 `learning_cycle.completed`。

当复测证据需要人工确认时，只有 `humanConfirmationStatus = completed` 且 `context.humanReviewReceiptId` 存在，才允许追加 `learning_cycle.completed`。不需要人工确认的客观阅读/听力匹配结果使用 `not_required_for_gate_a_flow`，且不得虚构人工审核收据。

## 非目标

本 ADR 与配套 JSON 资产以及已启用的 browser-local runtime 不实现或证明：

- 数据库、outbox、worker、队列、服务器 API 或遥测；
- LRS 账户、端点、凭据、SDK、xAPI statement 或网络发送；
- Clerk 与匿名 subject 的绑定、跨设备合并或账号恢复；
- 旧数据回填、迁移、上传或推断；
- Sofia 对账本、binding 或派生画像的读取；
- 反恶意篡改、可信审计、正式研究采集或合规认证；
- 对学习效果、正式诊断、分数增长或官方等级等值的证明。

## 后果

优点是：browser-local runtime 有一个严格、最小、可在离线环境校验的事件边界；身份泄露、自由文本进入账本、隐式回填、Sofia 越权和误接 LRS 都会被合同明确拒绝。

代价是：runtime 只在当前浏览器本机追加启用后的真实事件，不提供跨设备同步、远程分析、历史补齐或身份连续性；本机用户可以重算整条链，哈希链不能作为外部可信证据。若以后需要 Clerk 绑定、Sofia 个性化、研究导出或 LRS/xAPI，必须分别提出新方案并完成新的隐私、安全和证据审查。
