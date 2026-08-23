# P0 公开 Reading 本机数据与最小事件合同

> 合同状态：`ENGINEERING CANDIDATE / PENDING PRIVACY-PRODUCT-LEGAL REVIEW`
>
> 初建：2026-08-19；工程收口复核：2026-08-23。本文件描述当前代码实际行为，不把工程实现冒充隐私、法律、教学或发布批准。

## 1. 数据流结论

`/learn/reading` 是无需 Clerk 的客观题纵向切片。它不收集姓名、邮箱、账户 ID、自由文本、作文、录音、麦克风输入或教师信息，不调用远端模型，不向本站 API、LRS、xAPI 或第三方分析服务发送学习写请求。页面加载所需的 HTML、JavaScript、CSS、字体/图片等普通 GET 请求不属于学习记录上传。

当前实现只在学习者的当前浏览器 origin 下使用两个新 namespace：

| 用途 | localStorage key / 协议 | 上限 | 账户绑定 |
|---|---|---:|---|
| Reading 访客状态与 7 条客观首次作答 | `sufeiya_public_reading_p0_v1` | 64 KiB | 否 |
| 最小产品/流程事件列表 | `sufeiya_public_learning_events_v1` | 128 条且不超过 128 KiB | 否 |

两者不会读取、迁移、合并、覆盖或删除以下既有 namespace：

- `sufeiya_workspace_v1`；
- `sufeiya_super_teacher_v1`；
- `sufeiya_teaching_review_demo_v1`；
- 既有 workspace 内的 `sufeiya.learning-event.v2` 账本与 binding。

因此，匿名 Reading 记录不等于账户数据、跨设备记录、教师可见记录或 Gate A 证据。清除浏览器站点数据会使它丢失；登录也不会自动绑定、上传或同步它。

## 2. Reading 状态合同

状态对象必须是严格对象，未知字段和未知版本均拒绝。字段如下：

| 字段 | 类型/枚举 | 含义 |
|---|---|---|
| `protocolVersion` | 固定 `sufeiya_public_reading_p0_v1` | 存储协议与 namespace |
| `contentPackageVersion` | 固定 `reading_p0_original_v1` | 内容、答案与推荐规则绑定版本 |
| `storageMode` | 固定 `browser_local_not_account_bound` | 明示非账户绑定 |
| `revision` | 非负安全整数 | 每次状态变更递增，用于并发核对 |
| `currentStep` | `entry / baseline / lesson / practice / feedback / retest / plan / continuation` | 当前学习阶段 |
| `activeTaskId` | 7 个固定 task ID 或 `null` | 只有 baseline/practice/retest 阶段允许非空，且必须属于同一阶段 |
| `responses` | 最多 7 条严格客观作答 | 每个 task ID 只保留第一次有效选择；没有自由文本 |
| `continuation` | `local_continue / local_export / invite_login / waitlist` 或 `null` | 只有 `continuation` 阶段允许非空 |

每条客观作答只含：

```json
{
  "taskId": "reading_baseline_shade_labels",
  "phase": "baseline",
  "selectedOptionId": "shade_labels_option_a"
}
```

`taskId`、阶段和选项必须与冻结内容包一致。正确性不由存储值声明，而是由版本化内容包重新确定。`responses` 还必须严格等于冻结七题序列的有序、无空洞前缀；每个阶段只接受与已完成证据数量一致的状态，active task 只能是下一道未答题或刚答完、等待继续的题。重复 task、跳题、乱序、未知选项、阶段错配、步骤与 active task 错配、continuation 错位都会使整个状态失败关闭。例如 `practice + 0 baseline responses`、`plan + 0 responses` 和只存第二题都不接受。

## 3. 最小事件字典

事件存储为有界 JSON 数组。每条事件都严格包含：

- `protocolVersion = sufeiya_public_learning_events_v1`；
- `contentPackageVersion = reading_p0_original_v1`；
- `dispatchMode = local_only_no_network`；
- 从 `0` 连续递增的 `sequence`；
- 以下精确 `eventName` 和逐事件白名单 `payload`。

| eventName | 允许的 payload | 明确不记录 |
|---|---|---|
| `learning_entry_viewed` | `entryPoint: homepage_primary / direct_public_path` | referrer URL、IP、身份 |
| `first_task_started` | `taskId`（baseline 第一题） | 时间戳、身份、自由备注 |
| `task_answered` | `taskId`、`phase`、`selectedOptionId`、`answerState: correct / incorrect` | 自由文本、停留时间、设备指纹 |
| `feedback_viewed` | `taskId`、`feedbackType: correct_confirmation / five_part_wrong` | 反馈原文、个人备注 |
| `next_task_started` | `taskId`、`phase: practice / retest` | 任意导航 URL |
| `practice_completed` | 固定 `answeredTaskCount: 3`、`correctAnswerCount: 0..3` | 正式分数或能力等级 |
| `retest_started` | `taskId`（retest 第一题） | 个人身份 |
| `retest_completed` | 固定 `answeredTaskCount: 2`、`correctAnswerCount: 0..2` | 增长结论、正式诊断 |
| `plan_offered` | `evidenceState`、固定能力枚举、微课 ID、练习 task ID、复测 task ID | 生成式文案、自由推荐、AI 主张 |
| `post_value_continuation_started` | `continuation: local_continue / local_export / invite_login / waitlist` | 邮箱、账户 ID、公开注册枚举 |

事件没有身份字段和自由文本字段，也没有 `public_signup`。在产品、隐私、服务、删除、支持与目标地区专业法律审查全部完成前，公开 SignUp 保持关闭。

事件数组不仅核对单条 shape 与零起连续 sequence，还核对完整学习生命周期前缀。第一条必须是 `learning_entry_viewed`；之后的任务开始、作答、反馈、练习完成、复测、计划与价值后继续必须按冻结任务顺序出现，完成事件的正确数必须与前面的首次客观作答相符。`plan_offered` 的 ability、resource、task 与 retest task 还必须从前序 7 条 `task_answered` 重新运行同一个确定性推荐函数并逐字段核对；另一个“shape 合法”的能力值也不能通过。重新打开页面可追加新的 `learning_entry_viewed`，但不能借此跳过学习事件。两道独立复测在首次作答都锁定前不发答案反馈；第二题完成后才依次记录两条统一反馈，再记录 `retest_completed` 与 `plan_offered`。

## 4. 读取、写入与并发

1. 首次进入时严格读取两个 key；缺失视为空状态。
2. 无效 JSON、未知协议、未知字段、超限、事件 sequence 不连续或状态内部关系无效时，不做猜测迁移，也不自动覆盖。
3. 持久写入必须进入 Web Lock `sufeiya_public_reading_p0_v1:write`；锁回调内重新核对写入许可和两个 namespace 的原始值，随后执行原始字符串 freshness 检查、写后读回和 schema 校验。锁外预检不被当作并发保证。
4. 不支持 Web Locks 时，不尝试用非原子 `getItem → setItem` 冒充 compare-and-set：两个 key 都为空时，本轮明确降级为仅当前页面内存并可导出；任一 key 已有值时，保持只读恢复。学习者双确认删除是例外的显式控制动作，只删除两个精确 key，并逐 key 读回确认。
5. 同 origin 其他标签页改变任一新 key 时，当前页面读取并严格解析两个 namespace 的最新快照，然后转为只读冲突态；锁内排队的后续写入会重新检查冲突标记和另一 namespace 原始值，因此不会在冲突后追加孤立事件或状态。
6. 启动时除分别解析两个 schema，还把事件中的每条 `task_answered` 与状态 `responses` 逐项比较，并按当前阶段核对完整生命周期边界。两个 namespace 各自合法但答案、数量或阶段边界不同，不会显示为 `ready`。
7. 学习状态与最小事件是两个独立合同，Analytics 失败不得阻断合法学习主路径。若启动时发现上述组合失配（包括一个 key 合法缺失而另一个已推进），页面进入显式 `event_degraded`：缺失 state 按空学习状态、缺失 events 按空 ledger 参与同一个兼容性函数；保留合法学习状态继续保存和导出，冻结事件 ledger、不再追加伪漏斗，并显示“学习可继续 · 事件只读”及具体 issues。当前打开页已经观察到的真实跨标签页变化仍保持只读 `conflict`；刷新后因无法区分“事件写入失败”与“只改一个 key”，只能恢复为诚实的 event-degraded，而不能误报 ready。
8. 浏览器完全拒绝 localStorage 时，页面可以在当前内存中继续，但明确警告刷新/关闭可能丢失，并允许导出当前内存状态。

## 5. 查看、导出与删除

本页始终显示 `LOCAL DATA CONTROL`：

- **查看**：显示阶段、内容版本、作答数、事件数，以及可展开的完整 JSON；损坏/未知版本时显示未改写的原始字符串；跨 namespace 失配时显示 `compatibility.status=event_degraded` 与 issues。
- **导出**：下载 `sufeiya.public-reading-export.v1` JSON，包含 `exportedAt`、可解析状态、可解析事件、`compatibility` 状态/issues，以及只读恢复状态和原始值。导出不等于云备份或服务器签名。
- **删除**：第一次点击只进入 armed 状态并说明范围；第二次明确点击才删除两个新 key。删除函数只接触这两个 key，并在 UI 中明确说明既有 Gate A、Sofia、教研数据不受影响。

损坏、未知版本和当前页已观察到的并发冲突仍允许查看原始值、导出和双确认删除；主学习流程保持只读。这是恢复通道，不是静默修复。两个 namespace 分别呈现：若状态合法而事件损坏，导出仍包含合法状态与事件原始值；反向情况亦然。若两者各自合法但组合失配，学习状态按上一节的 event-degraded 规则继续，查看/导出必须携带失配说明。跨标签页冲突后，查看/导出使用当前 localStorage 的最新严格解析快照，不用冲突前的陈旧 ref 冒充当前数据。双确认删除成功后会同时清除旧 compatibility warning，重新开始时按 `[learning_entry_viewed, first_task_started]` 建立新 ledger。

## 6. 禁止字段和禁用宣称

当前合同禁止：

- 姓名、邮箱、手机号、账户/Clerk ID、IP、精确地址；
- 作文、开放回答、问题备注、聊天原文、录音、音频、图像或文件；
- 教师身份、审核意见或人工回执；
- 支付、订单、客户、组织或邀请数据；
- 正式诊断、官方 DET 分数、能力等级、掌握度、增长证明或结果保证；
- 远端 dispatch、LRS、xAPI、分析 SDK、模型请求和隐藏表单提交。

任何未来新增字段、网络发送、账户绑定、公共注册或保留周期都属于新数据流，必须提升协议版本、补迁移/删除设计、更新真实浏览器测试，并重新经过 Product、Privacy、Legal 与发布 Gate；不能用环境变量或文案变更绕过。

## 7. 当前验收边界

工程测试覆盖严格解析、有序证据前缀、事件白名单与生命周期、证据派生 `plan_offered`、state/event 同数量答案漂移、两个 key 都存在或单个 key 合法缺失时的 event-degraded 查看/导出/继续/删除、敏感/自由字段拒绝、容量、同标签页重复提交、跨标签页并发冲突、无 Web Locks 降级、未知版本和部分损坏保全、冲突后最新快照查看/导出、双确认删除、删除后重新开始、旧 namespace 字节不变和零非 GET 请求。该证据可以支持 G2 本机技术评审，但 **G3 数据/隐私/注册边界仍为 `PENDING`**，直至 Product、Privacy 与适用的专业法律评审对真实数据流和用户说明作出明确接受。
