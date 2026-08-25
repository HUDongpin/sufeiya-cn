# P0 公开 Reading 候选评审与授权决定记录

> 决定日期：2026-08-23；补充并最终确认：2026-08-26
>
> 被接受的不可变产品候选：`af85403cd97eff47afeea93582705a15aa7527a3`
>
> 已复核的审批证据 commit：`dc8a637f2c9fe4f582855ec4f16c68e0b7adaa2b`（只记录 2026-08-23 决定与审核元数据，不改变产品行为）
>
> 证据来源：Codex task `01a018b0-b605-7af0-bba8-647158b29bdd` 中 2026-08-23 以“候选：af85403…”开头的用户消息，以及 2026-08-26 的“全部批准。”与“全部授权。肖像都有授权”补充消息
>
> 当前效力：`CURRENT_PUBLIC_READING_P0_SCOPE_APPROVED / CONTROLLED_PREVIEW_AND_GATE_CONDITIONAL_PRODUCTION_AUTHORIZED`

本文件把原始填写、后续澄清与它们对 Gate 的效力分开记录。2026-08-26 的两条补充决定由同一 task、同一可追溯身份“苏肥鸭”作出，明确取代 2026-08-23 中“目前只批准内容评审”及肖像字段不完整造成的限制。授权仍只覆盖本文件和候选实际存在的 P0 表面；它不把未实现的账户同步、Grounded Sofia、声音、数字人、广告或其他未来能力变成已批准交付。

## 1. Teacher / Content Owner

2026-08-23 原始填写：

- 角色与可追溯身份：`苏肥鸭`；
- Reading 内容决定：`接受`；
- 逐项意见或证据位置：空白。

有效解释：对 `reading_p0_original_v1` 的 Reading 教学内容、7 个任务、微课、答案/干扰项、五段反馈、测量关系、禁用宣称、身份文案、内容权利和教师体验范围作出无修改接受。2026-08-26 的“全部批准/全部授权”再次确认该决定，没有提出内容修改。

Gate 影响：`G1 = PASS`。内容包自己的 `releaseDisposition=not_release_ready` 继续只表示内容对象不能绕过完整 Preview/发布 Gate；它不否定本次授权，也不自动把尚未建立的 Preview 证据写成通过。

## 2. 首页肖像与全部绑定资产

2026-08-23 原始填写为“接受限定首页用途”，但接受者身份和证据位置空白，且对关键排除项回答“否”；因此当时保持失败关闭。该历史回答原样保留。

2026-08-26，同一 task 中已识别的可追溯身份“苏肥鸭”明确补充：`全部授权。肖像都有授权`。结合本回执在该决定前已经明确展示的范围，本次补充决定绑定并接受：

- 源图 `/Volumes/WestWorld/Sufeiya/最新微笑版.jpg`，SHA-256 `f0c23e3b73952cd70c085f71f9e4ca556075c8d14d140ac2dcc22f3df4954c24`；
- `data/teacher-portrait-assets.v1.json` 登记的 6 个 640/960/1280 AVIF/WebP 机械衍生物；
- `sufeiya.cn` 首页 `/` 的主 CTA 旁或紧邻其后的真人教师人物卡、既定角色文案和 alt text；
- 肖像用途回执第 7 节的撤回联系人角色与下架程序。

“肖像都有授权”在当前 P0 中表示上述源图与 6 个绑定衍生资产的首页用途权利已确认。候选没有在 `/learn/reading` 或其他页面使用肖像，也没有声音克隆、LivePortrait/数字人、AI 头像、广告、转授权、第三方平台或生成式修改表面；这些事项仍明确不在本 P0 的发布范围，不能由本次首页授权推导为已实现或已通过其各自治理 Gate。

Gate 影响：肖像状态改为 `ACCEPTED_OWNER_TEACHER_HOMEPAGE_ONLY`，`G4` 的人物用途子项通过。纯客观 Reading 不存在开放回答入口，真实教师开放题队列继续为 `NOT IN SCOPE`。

## 3. Product / Privacy / Legal 范围决定

2026-08-23 原始填写：

- 角色与可追溯身份：`苏肥鸭`；
- 本机数据合同决定：`接受`；
- 公共 SignUp：`继续关闭`；
- 意见或证据位置：空白。

2026-08-26 的“全部批准/全部授权”确认 Product 对 Reading 公开旅程、首页主/次 CTA、真人教师/AI 助手区分和有肖像首页方案无修改接受，并确认当前 Product/Privacy/Legal 治理范围的决定。

当前 P0 只保存两个浏览器本机、非账户绑定 namespace，不收集身份或自由文本，不发出学习记录写请求；公开 SignUp、邮箱收集、账户绑定和上传继续关闭，四个替代 CTA 已有真实浏览器证据。因此本次决定把当前 P0 的 `G3` 记为 `PASS`。这是项目对当前零上传、零公开注册范围的发布治理决定，不冒充执业律师意见或为未来公开注册、账户同步、跨设备、远端分析/模型数据流提供法律结论；任何这些新增表面必须重新经过 Product、Privacy、Legal 和协议版本 Gate。

## 4. Release Owner 与发布授权

2026-08-23 的“目前只批准内容评审”当时明确禁止 push、PR、Preview 和公开发布。2026-08-26 的“全部批准/全部授权”由同一可追溯身份作出，现明确取代该限制，并授权：

1. 推送 `codex/learning-platform-next-20260819` 分支并创建受控 PR；
2. 为最终干净候选建立受控 Preview，绑定精确 commit、不可变 deployment ID 与前一已知正常 deployment；
3. 在 G0b、G1–G6 全部 `PASS`、无发布前 `PENDING/FAIL/BLOCKED`，且 Preview 的构建、真实浏览器、性能与回滚证据均绑定到同一精确候选后执行生产发布；
4. 发布后立即完成 G7 规范域名、关键旅程、console、资产、SignUp 关闭、deployment/commit 与旧 Gate A 边界回归；失败时按候选级回滚方案恢复前一不可变部署。

授权本身不能替代尚未发生的构建、Preview、性能或部署证据。因此记录本决定时 `G5/G6 = IN PROGRESS`；当外部系统给出精确 Preview/deployment 绑定且余下技术 Gate 通过后，可按上述授权升级，不需要把 2026-08-23 的旧限制继续当作阻断。

## 5. 当前 Gate 汇总

| Gate | 状态 | 决定与当前证据的效果 |
|---|---|---|
| G0a | `PASS` | 无变化 |
| G0b | `PASS` | 产品候选与审批证据 commit 归属已冻结；本次仅追加授权证据与对应 verifier/manifest 元数据 |
| G1 | `PASS` | Teacher / Content Owner 已绑定 `af85403…` 接受 Reading 内容和权利 |
| G2 | `IN PROGRESS` | 本机技术证据已通过；仍须把 Preview 性能和任何可用的 Clerk Development 证据绑定到最终候选 |
| G3 | `PASS` | 当前本机零上传合同已接受；公共 SignUp/账户绑定继续关闭，未来新增数据流不继承本决定 |
| G4 | `PASS` | Product 旅程、真人/AI 区分、教师体验与首页肖像用途已接受；开放题队列为 `NOT IN SCOPE` |
| G5 | `IN PROGRESS` | 已授权 push/PR/Preview；等待精确 Preview deployment、完整证据包与回滚绑定 |
| G6 | `IN PROGRESS` | 已给出满足 Gate 后的生产授权；等待最终不可变候选与 deployment plan 绑定后形成 PASS 记录 |
| G7 | `PENDING` | 只能在生产部署后以线上回归关闭 |
| G8 | `NOT IN SCOPE` | 当前 P0 明确不做账户同步；Phase 2 需要新决定 |
| G9 | `BLOCKED` | 当前公开 Reading 不启用 AI；既有 Grounded Sofia 治理 Gate 不变 |
| G10 | `BLOCKED` | 当前不启用声音/数字人；首页肖像授权不等于这些未来用途通过 |

## 6. 授权绑定、失效与后续变更

- 产品行为接受绑定 `af85403cd97eff47afeea93582705a15aa7527a3`；2026-08-23 的证据 commit `dc8a637…` 仅记录决定，没有改变该产品行为。
- 2026-08-26 的授权证据引用为 `codex_task_01a018b0_user_all_authorized_2026_08_26`。最终 PR、Preview 和生产回执必须另外记录实际部署的精确 HEAD/deployment ID，不能只写短 SHA 或分支名。
- 本次批准允许为诚实记录批准、Gate、manifest、README 和 verifier 所需的证据性修改；若后续改变题目、答案、反馈、数据字段/发送、账户边界、肖像字节或用途、用户旅程或运行时行为，则原产品接受不自动覆盖新候选，必须重新审查。
- 肖像权利人/授权代表可按肖像回执随时撤回首页用途；撤回不需要先撤销 Reading 内容，但必须移除首页引用和公开资源并形成下架证据。
- `G9/G10` 与 Phase 2–4 不因“全部批准”自动关闭：它们不在当前候选发布表面中，仍需各自实现、数据流、治理、测试和用途明确的后续决定。
