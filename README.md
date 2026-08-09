# Sufeiya Website

`sufeiya.cn` 是面向中国大陆 DET 学习者的在线学习平台。本仓库承载多页面公开网站与可直接使用的学生学习工具，采用无框架、无第三方前端依赖的静态实现，适合直接部署到 Vercel。

## Local development

```bash
npm run check
npm run dev
```

本地默认地址为 `http://127.0.0.1:4173`。可以通过 `SUFEIYA_PORT` 指定其他端口。

## Product boundary

每次修改页面源稿后，先运行 `npm run generate` 生成 HTML 页面，再运行 `npm run check` 完成结构与安全检查。

## Page structure

- `/`：精炼首页与四个页面入口；
- `/workspace`：学生学习工作台，只提供独立功能页入口；
- `/plan`：7 天学习计划生成器；
- `/today`：今日任务清单与进度；
- `/practice`：四项英文练习入口；
- `/practice-reading`、`/practice-listening`、`/practice-writing`、`/practice-speaking`：四个独立英文微练习；
- `/focus`：15 / 25 / 45 分钟专注计时器；
- `/check-in`：结构化学习证据与复盘；
- `/my-data`：本机数据统计、JSON 导出与定向清除；
- `/learning-path`：七步学习闭环；
- `/platform`：四项平台功能与开放状态；
- `/resources`：中文界面/英文备考材料规则和 Bilibili 学习资源；
- `/about`：团队角色、平台边界与常见问题。

每个顶部导航按钮进入一个独立页面，不使用单页长滚动替代多页面导航。

学生当前可以直接使用：

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

工具数据使用单一 `sufeiya_workspace_v1` 本机存储命名空间，不要求登录、不调用模型、不上传姓名、答案、录音或复盘。清除浏览器网站数据会导致记录丢失，当前也不会跨设备同步。

正式诊断、AI 智能老师、带教打卡营和社区注册仍将分阶段开放。当前工具不提供正式诊断、DET 分数预测、AI 评分、真题机经、考试中协助或结果保证，也不使用未经独立核验的学员数量与效果数字。

## Deployment

项目使用 `vercel.json` 配置干净 URL 与基础安全响应头。`.vercel/` 是本机项目链接信息，不进入版本控制。

生产规范域名：`https://sufeiya.cn/`。
