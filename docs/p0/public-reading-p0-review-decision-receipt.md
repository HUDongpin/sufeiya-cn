# P0 公开 Reading 候选评审决定记录

> 记录日期：2026-08-23
>
> 被评审的不可变产品候选：`af85403cd97eff47afeea93582705a15aa7527a3`
>
> 证据来源：Codex task `01a018b0-b605-7af0-bba8-647158b29bdd` 中以“候选：af85403…”开头的用户消息
>
> 当前效力：`CONTENT_ACCEPTED / PRODUCT_PRIVACY_ACCEPTED / PORTRAIT_AND_PROFESSIONAL_LEGAL_PENDING / NO_PREVIEW_OR_RELEASE_AUTHORIZATION`

本文件原样归纳用户填写的决定，并明确每条决定能改变和不能改变的 Gate。它不把空白字段补成同意，不把矛盾回答解释成更宽授权，也不把内容评审批准冒充 Preview 或发布批准。

## 1. Teacher / Content Owner

用户填写：

- 角色与可追溯身份：`苏肥鸭`；
- Reading 内容决定：`接受`；
- 逐项意见或证据位置：空白。

有效解释：对 `reading_p0_original_v1` 及内容验收包中除肖像用途以外的 Reading 教学内容、7 个任务、微课、答案/干扰项、五段反馈、测量关系、禁用宣称、身份文案、内容权利和教师体验范围作出无修改接受。内容包元数据据此记录审核人、角色、日期、候选 commit 和本 task 证据引用，同时继续保持 `releaseDisposition=not_release_ready`。

Gate 影响：`G1 = PASS`。这不批准首页肖像、Product 公开旅程、专业法律审查、Preview 或发布。

## 2. 首页肖像

用户填写：

- 接受者角色与可追溯身份：空白；
- 决定：`接受限定首页用途`；
- 是否明确确认不包含声音克隆、数字人、AI 头像和广告：`否`；
- 证据位置：空白。

有效解释：不是有效的公开用途授权。身份空白，且“限定首页用途”与不确认关键排除用途互相冲突；回复也没有引用完整源图 SHA-256、6 个衍生资源、撤回流程或 Release Owner 发布 Gate。工程必须失败关闭，不能挑选其中更宽松的一半。

Gate 影响：肖像公开用途仍为 `PENDING OWNER-TEACHER USE ACCEPTANCE / CLARIFICATION REQUIRED`；`G4` 不能 PASS。后续要么取得无冲突的完整接受，要么从发布候选撤下肖像。

## 3. Product / Privacy / Legal

用户填写：

- 角色与可追溯身份：`苏肥鸭`；
- 本机数据合同决定：`接受`；
- 公共 SignUp：`继续关闭`；
- 意见或证据位置：空白。

有效解释：记录 Product/Privacy 对当前本机数据合同的接受，并继续 fail-closed 公共 SignUp。没有发现将本机记录上传、账户绑定或加入 `public_signup` 的授权。

专业 Legal review 仍不能标为通过：回复没有识别适用于目标地区的专业法律审查角色/资质，也没有法律意见或证据位置。工程不能把“Product / Privacy / Legal”区块标题本身当成专业法律资格证明。

Gate 影响：`G3 = PENDING`，只剩专业 Legal review 及其可能要求的修改；本次接受不批准 Preview 或发布。

## 4. Release Owner

用户填写：`目前只批准内容评审`。

有效解释：只允许记录和实现上述内容审核元数据。明确不授权 push、PR、Preview deployment、公开发布、生产 alias、生产数据采集或首页肖像公开使用。

Gate 影响：`G5 = PENDING`、`G6 = PENDING`、`G7 = PENDING`。

## 5. 当前 Gate 汇总

| Gate | 状态 | 本次决定的效果 |
|---|---|---|
| G0a | `PASS` | 无变化 |
| G0b | `PASS` | 产品候选归属证据无变化；本记录作为后续审批证据单独提交 |
| G1 | `PASS` | Teacher / Content Owner 已绑定 `af85403…` 接受 Reading 内容和权利 |
| G2 | `IN PROGRESS` | 本机技术证据不变；仍缺真实 Clerk Development 与 Preview 性能 |
| G3 | `PENDING` | Product/Privacy 已接受；专业 Legal review 仍缺 |
| G4 | `PENDING` | 教师内容/体验范围已接受；肖像回复无效且 Product 公开旅程决定未单独闭合 |
| G5 | `PENDING` | Release Owner 明确只批准内容评审 |
| G6 | `PENDING` | 无公开发布授权 |
| G7 | `PENDING` | 无生产部署或线上回归 |
| G8 | `PENDING` | 无账户同步决定 |
| G9 | `BLOCKED` | Grounded Sofia 保持关闭 |
| G10 | `BLOCKED` | 语音/数字人保持关闭 |

## 6. 恢复下一步所需证据

1. 肖像：填写可追溯身份，引用完整源图 SHA-256，明确确认所有排除用途和撤回流程；或明确要求从发布候选撤下。
2. Product：明确接受 Reading 公开旅程、首页主/次 CTA、真人/AI 呈现与无肖像/有肖像方案。
3. Legal：提供适用目标地区的专业审查角色、决定和证据位置。
4. Release Owner：完成上述 Gate 后，另行明确是否授权推送并创建受控 Preview；“只批准内容评审”不能被复用为该授权。
