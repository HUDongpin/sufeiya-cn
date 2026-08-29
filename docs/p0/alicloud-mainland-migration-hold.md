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

本文件是工程与发布治理记录，不是法律意见，也不授权创建阿里云资源。
