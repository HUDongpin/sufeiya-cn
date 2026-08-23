# P0 公开 Reading 内容与教学验收包

> 当前状态：`TEACHER_CONTENT_OWNER_ACCEPTED_FOR_AF85403 / NOT RELEASE READY`
>
> 本文件把工程候选内容和 2026-08-23 的真人教师/内容负责人接受记录绑定到精确产品候选。该接受只闭合教学内容与内容权利范围；它不批准肖像、Preview、公开发布或生产部署。

## 1. 候选能力与内容来源

- 候选能力：Reading（已由苏肥鸭以 Teacher / Content Owner 身份接受；Product 对公开旅程的独立决定仍由 G4/G5 记录）。
- 内容版本：`reading_p0_original_v1`。
- 来源：`original_first_party_draft`。
- 内容审核：`accepted_by_teacher_and_content_owner`。
- 权利状态：`confirmed_by_content_owner_for_p0_candidate`。
- 审核人：`苏肥鸭`；角色：`teacher_and_content_owner`。
- 接受日期：`2026-08-23`。
- 被接受的不可变产品候选：`af85403cd97eff47afeea93582705a15aa7527a3`。
- 证据引用：`codex_task_01a018b0_user_acceptance_2026_08_23`。
- 发布处置：`not_release_ready`。
- 证据边界：`local_objective_response_evidence_only`。
- 目标能力：
  1. `locate_explicit_evidence`：定位原文直接证据；
  2. `distinguish_main_idea_from_supporting_detail`：区分中心意思与支持细节。

内容包、微课和 7 个 task 均显式携带 `contentPackageVersion=reading_p0_original_v1`、上述来源、权利状态、审核状态、审核人/角色、日期、候选 commit 与证据引用。`original_first_party_draft` 继续描述素材的工程来源，不覆盖已经另行记录的教师/内容负责人接受，也不等于 Release Owner 已批准公开发布。

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
| 内容包 | 1 | `reading_p0_original_v1` | `original_first_party_draft` | `confirmed_by_content_owner_for_p0_candidate` | `苏肥鸭` | `accepted_by_teacher_and_content_owner` |
| 微课 | 1 | `reading_p0_original_v1` | `original_first_party_draft` | `confirmed_by_content_owner_for_p0_candidate` | `苏肥鸭` | `accepted_by_teacher_and_content_owner` |
| baseline / practice / retest task | 7 | `reading_p0_original_v1` | `original_first_party_draft` | `confirmed_by_content_owner_for_p0_candidate` | `苏肥鸭` | `accepted_by_teacher_and_content_owner` |

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

本次公开 Reading 不启用 Sofia、远端模型、语音、录音或数字人。真人照片不能作为 Sofia 头像。首页肖像的源图、6 个机械衍生资源、拟定首页用途、排除用途与撤回流程另见 [`teacher-portrait-homepage-use-receipt.md`](./teacher-portrait-homepage-use-receipt.md)；2026-08-23 的回复没有提供接受者身份，并对必须明确确认的排除用途回答“否”，所以该回执仍为 `PENDING OWNER-TEACHER USE ACCEPTANCE / CLARIFICATION REQUIRED`。

## 7. 教师与内容负责人接受记录

证据 `E1`：Codex task `01a018b0-b605-7af0-bba8-647158b29bdd` 中 2026-08-23 的用户消息，明确绑定候选 `af85403cd97eff47afeea93582705a15aa7527a3`，以“苏肥鸭”作为 `Teacher / Content Owner` 的可追溯身份，并把 Reading 内容决定填写为“接受”，未列逐项修改意见。

| 决定项 | 当前状态 | 接受者/证据引用 | 阻塞或修改意见 |
|---|---|---|---|
| Reading 作为首个公开能力 | `ACCEPTED` | 苏肥鸭（Teacher / Content Owner）；`E1` | Teacher/Content 范围无修改意见；Product 旅程决定另行记录 |
| 7 个任务的内容、难度、答案与干扰项 | `ACCEPTED` | 苏肥鸭；`E1` | 无修改意见 |
| 内容包、微课和 7 个 task 的发布权利 | `ACCEPTED` | 苏肥鸭（Content Owner）；`E1` | 仅证明内容权利确认，不等于 G6 发布授权 |
| 微课教学准确性 | `ACCEPTED` | 苏肥鸭；`E1` | 无修改意见 |
| 每题五段式错误反馈 | `ACCEPTED` | 苏肥鸭；`E1` | 无修改意见 |
| baseline/practice/retest 的测量关系 | `ACCEPTED` | 苏肥鸭；`E1` | 无修改意见；仍不构成正式诊断或增长证明 |
| 禁用宣称与最终比较文案 | `ACCEPTED` | 苏肥鸭；`E1` | 禁用宣称继续有效 |
| 真人/AI 身份文案 | `ACCEPTED` | 苏肥鸭；`E1` | 不扩展到肖像或 AI 合成授权 |
| 首页肖像拟定用途 | `PENDING` | 见肖像回执 | 缺少接受者身份，且排除用途确认填写为“否” |
| 整体学习体验 | `ACCEPTED` | 苏肥鸭（Teacher）；`E1` | 仅教师体验范围；不等于 Product/Preview/Release 接受 |

本表的 `ACCEPTED` 项均绑定同一不可变产品候选、内容版本、角色、日期和 task 证据引用。页面可见、截图、Build PASS 或本文件存在仍不能自动扩大到肖像、隐私/法律、Preview 或发布 Gate。

## 8. 当前结论

苏肥鸭已以 Teacher / Content Owner 身份接受候选 `af85403…` 的 Reading 内容、权利、反馈、测量关系、身份文案与教师体验范围，因此 G1 可以记录为 `PASS`。本切片没有开放回答入口，真实教师开放题队列子项继续为 `NOT IN SCOPE`。**首页肖像仍未形成有效授权，Product 对公开旅程的独立接受、专业法律审查、Preview 和发布决定也没有发生**；G4–G6 不能由本次内容接受倒推为通过。
