# Sufeiya Website

`sufeiya.cn` 是面向中国大陆 DET 学习者的在线学习平台。本仓库使用 Next.js App Router 承载公开网站、账户入口与可直接使用的学生学习工具；既有页面内容仍由 `scripts/generate-pages.mjs` 统一生成，再由 Next.js 外壳渲染。

## Local development

```bash
npm run check
npm run dev
```

Next.js 本地开发地址默认为 `http://localhost:3000`。

## Product boundary

每次修改页面源稿后，先运行 `npm run generate` 生成 HTML 页面，再运行 `npm run check` 完成旧页面结构、TypeScript、ESLint 与生产构建检查。`generate:next-content` 会把页面正文写入 `lib/legacy-content.generated.ts`，并同步浏览器运行时与音频到 `public/`。

## Page structure

- `/`：精炼首页与四个页面入口；
- `/workspace`：七阶段 Gate A 闭环进度与独立功能页入口；
- `/super-teacher`：有来源的 Gate A 学习解释、拒答边界、非 AI 退出与本机人工支持请求；
- `/diagnostic`：18+、本机、无评分的六任务诊断证据包（2 Reading + 2 Listening + 90 秒 Speaking + 3 分钟 Writing）；
- `/plan`：7 天学习计划生成器；
- `/recommendations`：一个主任务、至多两个补充的可解释推荐，可接受或明确跳过；
- `/today`：今日任务清单与进度；
- `/practice`：四项英文练习入口；
- `/practice-reading`、`/practice-listening`、`/practice-writing`、`/practice-speaking`：四个独立英文微练习；
- `/focus`：15 / 25 / 45 分钟专注计时器；
- `/check-in`：保存“做了什么 + 学习证据 + 问题”的 `check_in_id`；
- `/review`：由学习者另行核对并生成 `review_id`；
- `/community`：合成经验卡与 `used / declined / not_needed / unavailable` 四种自愿状态；
- `/retest`：原创平行微任务、`retest_id` 与学习者确认的 `updated_plan_id`；
- `/my-data`：本机数据统计、JSON 导出与定向清除；
- `/learning-path`：七步学习闭环；
- `/platform`：四项平台功能与开放状态；
- `/resources`：中文界面/英文备考材料规则和 Bilibili 学习资源；
- `/about`：团队角色、平台边界与常见问题。

每个顶部导航按钮进入一个独立页面，不使用单页长滚动替代多页面导航。

学生当前可以直接使用：

- 通过同一 `cycle_id` 串联的 Gate A 演示闭环：六任务诊断证据包 → 计划 → 推荐 → 证据式打卡 → 学习者确认 → 自愿互助状态 → 平行微复测 → 更新计划；
- 依次完成 2 项 Reading、2 项 Listening、90 秒 Speaking 与 3 分钟 Writing：客观题只封存首答，若本机持久化失败则完整回滚到提交前状态；听力文本替代、播放失败、中断、跳过等情况进入质量标记，最终由学习者确认一条下一步优先任务；
- 纯前端 7 天计划生成器；
- 可跨页面同步的今日任务清单；
- 原创 Reading、Listening、Writing、Speaking 英文微练习；
- 可在刷新后恢复的专注计时器；
- 自动保存草稿的结构化学习复盘；
- 本机数据导出与只清除 Sufeiya 学习数据。
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

计划、推荐与证据式打卡只有在同一 `cycle_id`、`diagnostic_session_id`、任务清单摘要和基础计划回链全部成立时才计入闭环；中央验证链还逐项核对打卡的 `diagnostic_session_id`、互助状态的 `plan_id` 与更新计划的 `focusSkill`。推荐选择和平行复测的首份有效回执封存；形成 `retest_id` 或更新计划后，Community 状态也随即冻结。诊断首答、Community、推荐、平行复测与更新计划在持久化失败时回滚，不能静默覆盖或删除既有回执。

Logo 使用由原始附件精确抠图并进行 4× 重采样的 `2792 × 560` 真透明 PNG；圆形标志另存为 `512 × 512` 透明站点图标。

学习闭环数据使用 `sufeiya_workspace_v1` 本机存储命名空间；所有 `workspace.js` 与 `journey.js` 页面共享同名的 `page-writer` Web Lock 长租约，同一时间只有一个标签页可写，第二个标签页在初始化控件前切换为只读。诊断预检与 Sofia智能老师上下文区都会在交互前显示浏览器安全写入锁能力；不支持 Web Locks 时不建立新的闭环或问答写入。Sofia智能老师的对话副本和未发送人工请求使用独立的 `sufeiya_super_teacher_v1` 命名空间。当前 Gate A 采用免登录、免注册模式。`/sign-in`、`/sign-up` 与 `/account` 仅显示阶段边界说明，不加载 Clerk 运行时；未来账户配置与依赖保留，待云端档案、身份隔离、同意和删除策略完成后再启用。

Sofia智能老师只对已经在六任务诊断证据包中完成 18+ 本机确认、六项任务终态和学习者优先项确认的用户开放，并在每次页面加载后要求另行勾选发送说明；API 同样要求该成人确认字段。页面只构造同轮 `cycle_id` / `diagnostic_session_id`、任务清单摘要、优先能力、证据覆盖数量/置信度、优先项依据、计划、推荐和闭环状态等最小摘要，不接收客户端任务正文、首答、推荐理由或自由文本上下文，不发送姓名、写作答案、录音或打卡自由文本，也不把历史对话发送给模型。请求和响应都使用严格结构校验；银行卡号等敏感内容会在本机保存或发送前拦截，损坏、未知版本或跨标签页已变化的对话保持只读，直到学习者明确清除后重建。

生产默认 `SUFEIYA_AI_ENABLED=false`，因此当前发布先使用确定性的有来源回答。只有供应商/数据流书面闸门、持久化滥用与预算控制、语义级主张—引用支持校验全部关闭后，才可显式设为 `true`，由服务端通过 Vercel AI Gateway 尝试结构化生成；未配置、超时、限流或输出未通过来源编号与安全校验时仍返回同一白名单上的确定性备用回答。即使模型关闭，问题与摘要也会到达本站服务端以执行策略和生成回答，因此不得粘贴敏感信息。

这条纵向路径是 Gate A 本机流程验证，不是正式诊断、正式能力等级、官方 DET 分数或真实学生试点。六任务证据包只报告本轮任务证据、质量限制、低/中等证据覆盖置信度和学习者确认的下一条优先任务；Writing 与 Speaking 在合格人工审核前不形成最终诊断。Sofia智能老师 Gate A 已开放，但知识范围仍被严格限制：只允许 10 条第一方产品政策/原创任务来源支持主张，5 条公开视频仅作 link-only 目录；DET 官方索引与 631 个归档预览块的准入数仍均为 0。正式诊断、完整课程知识、带教打卡营和真人社区互助继续分阶段开放。当前工具不提供 DET 分数预测、AI 评分、泛化 RAG、真题机经、考试中协助、真实同伴联系、真实奖励或结果保证，也不使用未经独立核验的学员数量与效果数字。

## Learning event strategy

项目已经批准版本化的 `sufeiya.learning-event.v1` 内部学习事件设计，使当前学习闭环以后可以在不重写业务语义的前提下投影为 xAPI。事件注册表、严格 JSON Schema、合成示例与离线验证器分别位于 `data/sufeiya-learning-event-register-v1.json`、`schemas/sufeiya-learning-event-v1.schema.json`、`data/sufeiya-learning-event-examples-v1.json` 和 `scripts/verify-learning-event-contract.mjs`；`npm run check:event-contract` 会验证逐事件字段白名单、跨字段语义矩阵、UUID 别名、活动目录、示例哈希与无已声明 LRS 运行时依赖。当前只批准设计，事件运行时采集本身仍为关闭状态。

生产 LRS 的供应商采购、端点、凭据、SDK、服务器事件库、xAPI 投影器、outbox 与网络发送全部暂缓。当前默认 `xapiDispatchPolicy` 固定为 `disabled`，现有本机学习历史标记为不可导出，也不能把 18+ 本机确认解释为云端上传同意。Writing/Speaking 原文或录音、诊断首答、打卡自由文本、Sofia 对话、姓名、邮箱、手机号和认证信息不得进入通用学习事件。完整决策边界见 `docs/decisions/0001-xapi-ready-lrs-deferred.md`，事件语义与未来投影约束见 `docs/learning-events/sufeiya-learning-event-contract-v1.md`。

## Deployment

项目使用 Next.js 与 `vercel.json` 配置路由和基础安全响应头。`.vercel/` 是本机项目链接信息，不进入版本控制；任何真实数据、供应商或 Gate B 试点仍需另行完成文档中的 P0 书面决定。

生产规范域名：`https://sufeiya.cn/`。
