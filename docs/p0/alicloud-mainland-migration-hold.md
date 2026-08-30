# Phase 0 阿里云中国大陆迁移与账户 Hold

## Owner 决定

2026-08-29，Owner Dr. Peter Hu 决定把 Sufeiya canonical 服务迁往中国大陆阿里云，不再把现有 Vercel/Clerk 境外路径作为目标架构。内部合规责任人为 Dr. Peter Hu；公开权利与投诉渠道为微信 `SofiaTang2020`。

这是一项架构决定，不是迁移完成证据。当前 Production 在 canonical cutover 前仍由 Vercel 托管；Clerk 既有数据也不会因代码 Hold 自动删除。

## 当前代码边界

- 公开 Reading、`/my-data`、隐私、条款、支持和营销页面继续匿名可用。
- 登录、注册、邀请、账户、受保护学习区、Sofia 受保护交互、教研演示、`/api/super-teacher` 和 Clerk FAPI proxy 统一返回 `503` 与 `X-Sufeiya-Account-Mode: mainland-migration-hold`。
- Hold 是仓库常量，不读取环境变量，部署方不能通过配置静默绕过。
- Hold 响应不回显邀请 ticket、query、身份或原请求路径，也不调用 Clerk middleware。
- 旧 Clerk 代码只作为待替换材料保留；它不构成获准的 fallback。

## 目标边界

- 已选择地域：阿里云 `cn-beijing`。
- Next.js Web 应用候选：Function Compute Web Function / Web Application。
- 中国内地自定义域名在接入前必须满足适用备案要求；没有备案和域名证据时不得切 canonical alias。
- 账户身份服务必须另行选择境内方案；本文件不预选供应商，也不创建用户、邀请或迁移身份数据。
- 数据库、同步、教师服务和 Grounded Sofia 仍按各自 Gate 关闭，不因托管迁移自动开放。

## Provider-side write 前置

任何 Function Compute、VPC、日志、域名、证书、RAM、KMS、数据库或备案动作都需要 Owner 对目标资源、地域、预估费用和写入范围的单独批准。凭据只由 Owner 在独立系统 Terminal 的隐藏提示中输入；Codex 不启动凭据流程、不读取或传递凭据。

## 2026-08-30 staging 限定授权

Owner 已单独批准以下 staging 范围；授权不扩展到 Production、canonical cutover、Clerk/身份迁移、数据库、VPC、RAM、KMS、OSS、证书或其他资源：

- 阿里云账号只读核验；
- 在 `cn-beijing` 创建 Web Function `sufeiya-phase0-preview-71f2982`；函数名是 Owner 选择的固定 staging 标签，实际源码 SHA 必须读取 artifact receipt，不得从名称反推；
- 规格固定为 `0.5 vCPU / 512 MiB`，单实例并发 `8`，最小实例 `0`，最大实例 `1`；
- 不创建 SLS project、logstore 或日志投递配置；
- 为 Function Compute 设置人民币 `200 元/月`的账单预算告警。该告警只通知、不自动停机，不得描述为硬费用上限；最大实例 `1` 也不能保证网络流量等全部费用不超过 200 元；
- staging hostname 固定为 `phase0-preview.sufeiya.cn`；仅允许在现有 Vercel DNS 增加这一条 exact staging 记录，不允许改变 apex、`www`、nameserver 或 canonical 流量；
- push 前仅允许修改阻止 Vercel Git Preview 的停用/忽略设置。若控制面已经是 `Automatic`/已启用，则保留原值，避免无意义写入；
- 允许把新 exact candidate push 到既有 Draft PR 的 head 分支，以触发 Git Preview；不授权 merge 或 Production promotion。

跟踪合同位于 `deploy/alicloud-fc/phase0-staging.v1.json`。授权本身不是账号核验、资源创建、预算告警生效、DNS/TLS、Preview、Owner 接受或迁移完成证据。

## 必须验证

1. 无密钥架构与费用预检；
2. 备案主体、域名和接入条件；
3. 境内身份替代与既有 Clerk 数据处置；
4. 阿里云 exact artifact/SHA 部署回执；
5. 公共页、账户 Hold、零 Clerk 请求、日志与缓存的浏览器/网络回归；
6. canonical cutover 后 Vercel 不再接收 canonical 请求的独立证据；
7. Owner exact-head 接受；
8. 独立 merge、Production 和 canonical cutover 决定。

## 官方实施参考

- [迁移 Web 应用到函数计算](https://help.aliyun.com/zh/functioncompute/fc-2-0/migrate-web-applications-to-function-compute)
- [Web 函数快速入门](https://help.aliyun.com/zh/functioncompute/web-function-quick-start)
- [配置自定义域名](https://help.aliyun.com/zh/functioncompute/configure-custom-domain-names)

本文件是工程与发布治理记录，不是法律意见；它只授权上述 exact staging 范围，不授权 Production 或 canonical cutover。
