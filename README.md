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
- `/diagnostic`：18+、本机、无评分的演示性初筛；
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

- 通过同一 `cycle_id` 串联的 Gate A 演示闭环：初筛 → 计划 → 推荐 → 证据式打卡 → 学习者确认 → 自愿互助状态 → 平行微复测 → 更新计划；
- 纯前端 7 天计划生成器；
- 可跨页面同步的今日任务清单；
- 原创 Reading、Listening、Writing、Speaking 英文微练习；
- 可在刷新后恢复的专注计时器；
- 自动保存草稿的结构化学习复盘；
- 本机数据导出与只清除 Sufeiya 学习数据。

公开网站同时展示：

- 苏肥鸭的证据驱动学习路径；
- 已确认的七步学习闭环；
- 四个相互连接的伴学模块设计方向；
- 指向 Bilibili 原始发布页的公开资源入口；
- 团队角色、常见问题与明确的非官方边界。

平台导航、说明、反馈和帮助以简体中文为主；真正用于 DET 备考的题目、阅读、听力、作文与口语材料保留英文。

Logo 使用由原始附件精确抠图并进行 4× 重采样的 `2792 × 560` 真透明 PNG；圆形标志另存为 `512 × 512` 透明站点图标。

工具数据使用单一 `sufeiya_workspace_v1` 本机存储命名空间，当前 Gate A 采用免登录、免注册模式。`/sign-in`、`/sign-up` 与 `/account` 仅显示阶段边界说明，不加载 Clerk 运行时；未来账户配置与依赖保留，待云端档案、身份隔离、同意和删除策略完成后再启用。当前工具不调用模型，也不会自动上传姓名、答案、录音或复盘。清除浏览器网站数据会导致记录丢失，当前也不会跨设备同步。

这条纵向路径是 Gate A 本机流程验证，不是正式诊断或真实学生试点。正式诊断、AI 智能老师、带教打卡营和真人社区互助仍将分阶段开放；当前工具不提供 DET 分数预测、AI 评分、RAG 问答、真题机经、考试中协助、真实同伴联系、真实奖励或结果保证，也不使用未经独立核验的学员数量与效果数字。

## Deployment

项目使用 Next.js 与 `vercel.json` 配置路由和基础安全响应头。`.vercel/` 是本机项目链接信息，不进入版本控制；任何真实数据、供应商或 Gate B 试点仍需另行完成文档中的 P0 书面决定。

生产规范域名：`https://sufeiya.cn/`。
