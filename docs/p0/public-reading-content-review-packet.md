# P0 公开 Reading 内容与教学验收包

> 当前状态：`DRAFT_PENDING_TEACHER_REVIEW / NOT RELEASE READY`
>
> 本文件把工程候选内容整理为真人教师可核对的范围。它没有记录教师接受，也不能把单测、截图或浏览器 PASS 解释成教学批准。

## 1. 候选能力与内容来源

- 候选能力：Reading（计划中的默认建议；仍待 Product Owner 与苏肥鸭老师/授权教学内容负责人确认）。
- 内容版本：`reading_p0_original_v1`。
- 来源：`original_first_party_draft`。
- 内容审核：`draft_pending_teacher_review`。
- 权利状态：`pending_content_owner_confirmation`。
- 审核人：`null`（尚无接受者，不代表无需审核）。
- 发布处置：`not_release_ready`。
- 证据边界：`local_objective_response_evidence_only`。
- 目标能力：
  1. `locate_explicit_evidence`：定位原文直接证据；
  2. `distinguish_main_idea_from_supporting_detail`：区分中心意思与支持细节。

内容包、微课和 7 个 task 均显式携带 `contentPackageVersion=reading_p0_original_v1`、上述来源、权利状态、审核状态与 `reviewer=null`。`original_first_party_draft` 只描述工程来源，**不等于** Content Owner 已确认发布权利；权利确认与真人教师教学验收是两个独立的 `PENDING` Gate。

所有 7 篇短文、题目和选项均为本次一方原创草案，不使用旧 Gate A 的 Maya/library 诊断题，也不复用 baseline、practice 与 retest 的 passage、task 或 option ID。工程测试只证明结构独立与规则一致；教师仍须核对语言自然度、难度、教学价值、答案唯一性、干扰项质量和适用学习者范围。

## 2. 7 个任务的固定矩阵

| 阶段 | task ID | 短文 | 能力 | 难度意图 |
|---|---|---|---|---|
| baseline 1/2 | `reading_baseline_shade_labels` | Labels in the Student Garden | 定位直接证据 | entry |
| baseline 2/2 | `reading_baseline_friday_plan` | Amir's Friday Plan | 中心意思 vs 支持细节 | entry |
| practice 1/3 | `reading_practice_return_tray` | The Gray Return Tray | 定位直接证据 | guided |
| practice 2/3 | `reading_practice_notebook` | Mei's Question Notebook | 中心意思 vs 支持细节 | guided |
| practice 3/3 | `reading_practice_reusable_cups` | A Cup Reminder | 两个能力综合 | guided |
| retest 1/2 | `reading_retest_robotics_bins` | Parts for Robotics Club | 定位直接证据 | independent |
| retest 2/2 | `reading_retest_cycle_route` | Jia's New Cycle Route | 中心意思 vs 支持细节 | independent |

独立性工程证据：7 个 task ID、7 个 passage ID、7 段 passage text、全部 option ID 均唯一；retest 两项明确为 `independent`。这证明“没有复用”，不证明两组测量难度已经等值。

逐对象工程字段矩阵：

| 对象 | 数量 | 版本 | 来源 | 权利 | 审核人 | 审核状态 |
|---|---:|---|---|---|---|---|
| 内容包 | 1 | `reading_p0_original_v1` | `original_first_party_draft` | `pending_content_owner_confirmation` | `null` | `draft_pending_teacher_review` |
| 微课 | 1 | `reading_p0_original_v1` | `original_first_party_draft` | `pending_content_owner_confirmation` | `null` | `draft_pending_teacher_review` |
| baseline / practice / retest task | 7 | `reading_p0_original_v1` | `original_first_party_draft` | `pending_content_owner_confirmation` | `null` | `draft_pending_teacher_review` |

## 3. 微课与确定性推荐

微课 `reading_lesson_evidence_and_ideas_v1` 为《先找证据，再分中心与细节》，包含四步：

1. 圈出人物、物品、时间或目的等题干关键词；
2. 回原文寻找关键词或同义表达；
3. 中心意思题检查候选是否覆盖大部分句子；
4. 把只说明一个例子、时间或动作的句子识别为支持细节。

初始推荐只采用两道 baseline 的第一次有效客观作答。少于 2 道时返回 `evidence_insufficient`，不形成能力推荐。完整后使用固定规则显示：

```text
证据 → 能力 → 资源 → 任务 → 复测
```

若两项基线证据并列，固定优先较高复杂度的“中心意思 vs 支持细节”；该 tie-break 是可测试的课程规则，不是 AI、自适应模型、mastery 模型或正式诊断。

两道 independent retest 采用“先锁定、后统一反馈”：第一题提交后不显示正确性、答案、微课提示或五段反馈，只进入第二篇全新短文；第二题首次作答也锁定后，才统一显示两题依据/五段反馈并更新计划。这样避免第一题教学信息污染第二题。更新规则只在两道 baseline 与两道 retest 首答都齐备时运行：若复测仍有错项，以冻结复测顺序中的第一个剩余错项能力作为下一步；若两题都正确，只建议继续巩固原方向。最终页再次完整显示更新后的 `证据 → 能力 → 资源 → 任务 → 复测` 和更新理由。两种结果都固定标记为同一次短练的客观证据，不能解释为增长证明。

## 4. 五段式错误反馈验收项

每道题的每个错误路径都必须让学习者看到：

1. **错在哪里**：可能混淆的理解或表达问题；
2. **正确答案为什么成立**：直接绑定原文证据；
3. **其他选项为什么不成立**：逐干扰项解释；
4. **回看哪个微课**：绑定上述版本化微课；
5. **立即重练与复测**：给出当前动作和使用全新短文的复测时机。

正确路径也显示答案依据和可迁移的下一动作，而不是只显示“正确”。真人教师需要逐题核对：

- 错因是否准确、尊重学习者且不过度推断；
- 正确依据是否唯一且确实在原文中；
- 干扰项解释是否覆盖所有非正确选项；
- 中英文是否自然、无语法/标点问题；
- 立即练习是否真正帮助完成下一题，而不是泄露复测答案；
- 两道复测之间不显示答案教学、统一反馈时机是否符合预期测量关系；
- 复测剩余错项覆盖基线优先能力的确定性更新规则是否教学合理；
- 复测说明是否避免“能力增长已证明”等不当宣称。

## 5. 禁用宣称

内容、反馈、推荐和最终比较均不得声称：

- 官方 DET 分数、分数等值或官方诊断；
- 正式能力等级、掌握度或自动评分；
- 两次作答差异已经证明学习增长；
- 保证提分、结果或通过考试；
- 固定规则是 AI、智能诊断或自适应模型；
- 未经教师审核的草案已获教师认可。

最终页只能报告本轮 baseline 与独立 retest 的客观正确数、两道题统一反馈和基于剩余错项的下一步，并持续说明“同一次短练中的证据，不是正式诊断、官方分数或增长证明”。

## 6. 真人/AI 身份验收

固定候选文案：

- `苏肥鸭老师｜真人教师 · 教学与内容主理人`；
- `Sofia 智能老师｜AI 学习助手`。

本次公开 Reading 不启用 Sofia、远端模型、语音、录音或数字人。真人照片不能作为 Sofia 头像。首页肖像的源图、6 个机械衍生资源、拟定首页用途、排除用途与撤回流程另见 [`teacher-portrait-homepage-use-receipt.md`](./teacher-portrait-homepage-use-receipt.md)；该回执当前仍为 `PENDING OWNER-TEACHER USE ACCEPTANCE`。

## 7. 教师接受记录（当前留空）

| 决定项 | 当前状态 | 接受者/证据引用 | 阻塞或修改意见 |
|---|---|---|---|
| Reading 作为首个公开能力 | `PENDING` |  |  |
| 7 个任务的内容、难度、答案与干扰项 | `PENDING` |  |  |
| 内容包、微课和 7 个 task 的发布权利 | `PENDING` |  |  |
| 微课教学准确性 | `PENDING` |  |  |
| 每题五段式错误反馈 | `PENDING` |  |  |
| baseline/practice/retest 的测量关系 | `PENDING` |  |  |
| 禁用宣称与最终比较文案 | `PENDING` |  |  |
| 真人/AI 身份文案 | `PENDING` |  |  |
| 首页肖像拟定用途 | `PENDING` |  |  |
| 整体学习体验 | `PENDING` |  |  |

有效接受必须引用不可变候选 commit、完整内容版本、接受者角色、日期和证据位置。口头同意、页面可见、截图、Build PASS 或本文件存在均不能自动填写此表。

## 8. 当前结论

工程候选已经具备“基线检查 → 微课 → 3 道主动练习 → 五段反馈 → 2 道独立平行复测 → 更新计划”的完整结构，且没有开放回答入口，因此真实教师开放题队列这一条件性子项可标记为 `NOT IN SCOPE`。但是 **教学内容、反馈、能力选择、角色文案、肖像用途与整体体验仍全部等待真人教师/授权内容负责人的明确接受**；G1 与 G4 不能因为代码完成而改为 PASS。
