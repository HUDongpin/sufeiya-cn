# Phase 0 中国大陆个人信息保护内部合规 Gate

## 决定

Phase 0 不再把外部律师、律所或其他外部专业人士的签字作为一般发布前置条件。此前准备的专业审查 DOCX、ZIP、conflicts、费用和私有传输流程保留为历史/可选材料，但不再是当前 Gate 的必需证据。

这项决定只移除过重的外部签署形式，不表示中国大陆没有个人信息保护或网络数据义务，也不把当前页面直接判定为合规通过。

当前 Gate 改为：由 Owner 组织并签署中国大陆个人信息保护内部合规复核；如以后依法触发监管部门要求的专业机构审计，再按该要求执行。

## 官方依据与边界

- [《中华人民共和国个人信息保护法》](https://www.npc.gov.cn/WZWSREL25wYy9jMi9jMzA4MzQvMjAyMTA4L3QyMDIxMDgyMF8zMTMwODguaHRtbD9yZWY9aW1i)规定个人信息处理告知、未满十四周岁个人信息、跨境提供、影响评估和定期合规审计等实质义务。
- [《网络数据安全管理条例》](https://app.www.gov.cn/govdata/gov/202409/30/520076/article.html)第二十条、第二十一条、第二十三条、第二十四条、第二十七条和第三十五条分别覆盖投诉举报渠道、个人信息处理规则、个人权利、删除/匿名化、定期合规审计和跨境条件。
- [《个人信息保护合规审计管理办法》](https://www.cac.gov.cn/2025-02/14/c_1741233507681519.htm)第三条允许个人信息处理者由内部机构自行开展合规审计，或委托专业机构；第五条所列监管要求情形才会要求委托专业机构。第四条的固定两年频率适用于处理超过一千万人个人信息的处理者。
- [《促进和规范数据跨境流动规定》](https://www.cac.gov.cn/2024-03/22/c_1712776612187994.htm)对部分低数量、非敏感个人信息出境免除安全评估、标准合同或认证程序，但不当然免除告知、单独同意和个人信息保护影响评估等其他义务。

本文件是工程发布治理说明，不是法律意见。

## 当前 exact-head 已完成

- Vercel Web Analytics 已从运行时、依赖和构建图中硬禁用；未来重新启用必须作为新处理活动另行决定。
- 公开 Reading、Gate A、Sofia 和教研演示的学习 payload 保持浏览器本机，不自动上传。
- `/my-data` 允许查看、导出和按 namespace 删除本机记录。
- Clerk Production Access mode 已改为 Invite-only；该变更没有创建邀请或用户。
- `/privacy`、`/terms`、`/support` 已存在并在 Gate 关闭前保持 `noindex,nofollow`。

## Owner 已提供并签署的事实

1. 个人信息处理者：Dr. Peter Hu。
2. 内部合规责任人：Dr. Peter Hu。该项目治理指定不声称已经达到《个人信息保护合规审计管理办法》第十二条的法定规模门槛。
3. 指定公开微信 `SofiaTang2020` 接受一般支持、个人信息权利请求和网络数据投诉。
4. Owner 声明当前不是关键信息基础设施运营者，不处理重要数据，不主动处理或向境外提供敏感个人信息。
5. Owner 声明当年累计向境外提供个人信息的去重人数低于十万人，并以“很少”描述；该声明不是精确人数统计。
6. Owner 决定迁往中国大陆阿里云并停止使用现有境外处理路径。该决定尚未证明迁移已经完成。

上述事实绑定在 `PHASE0-MAINLAND-CHINA-OWNER-FACTS-AND-ALICLOUD-MIGRATION-DECISION-C79E51B.json`；原始“`不出力`”只按明显笔误规范化为“`不处理`”，原文仍保留在回执中。

## 当前仍需冻结的实施与证据

1. Vercel 托管/函数/日志的实际字段、目的、保存期限或确定方法、访问角色、合同主体、境外接收方和个人权利路径，直至阿里云 canonical cutover 完成并核验旧路径停止。
2. Clerk 既有身份/会话/邀请数据的准确字段、cookie/安全日志、活动账户和终止后保存期限，以及迁移、删除或停止处理的可核验结果。
3. 阿里云 `cn-beijing` 资源、费用、RAM/KMS、备案、域名、日志、备份和删除配置；Owner 已于 2026-08-30 只批准 `sufeiya-phase0-preview-71f2982` staging、无 SLS、exact staging DNS 和 200 元/月预算告警，资源创建与生效仍须控制面证据，其他 provider-side write 继续冻结。
4. 境内替代身份方案；不得把 Clerk 作为默认兜底继续启用。
5. 权利与投诉渠道的收件、最小身份核验、处理、拒绝理由、升级和结案记录模板及实际可用性。
6. 面对偶发未满十四周岁使用者时的最小流程：停止继续收集/建号/邀请，删除或隔离非必要信息；只有决定继续处理时才取得监护人同意并制定专门规则。
7. 复核日期、下次日期或触发条件、事件响应、删除回执、供应商变更监控和阈值计数方法。
8. 新 exact SHA 的双 CI、本地/境内部署浏览器验收、Owner 接受及独立 merge/Production 决定。

未知事实不得用占位符、推测或“可能”措辞伪装成已完成披露。

## Gate 关闭条件

Phase 0 中国大陆内部合规 Gate 只有在以下条件全部满足后才可关闭：

1. 上述事实被 Owner 以 exact evidence 冻结；
2. `/privacy`、`/terms`、`/support` 与实际数据流逐项一致；
3. 当前处理活动、保存/删除、个人权利、投诉、未成年人、Vercel/Clerk 退出和阿里云迁移记录均完成；
4. Owner 签署绑定 exact candidate SHA 和文案哈希的内部复核回执；
5. 新 SHA 完成双 CI、Preview 和 Owner exact-head 接受。

该 Gate 关闭只允许开始下一阶段的 Reading Teacher/rights acceptance，不自动授权 Clerk invitation、同步、教师服务、Grounded Sofia、索引、merge 或 Production。
