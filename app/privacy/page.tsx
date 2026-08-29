import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { PublicDocumentPage } from "@/components/public-document-page";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "隐私说明｜苏肥鸭多邻国",
  description: "了解 Sufeiya 当前公开页面、浏览器本机学习记录、Clerk 邀请账户、已禁用的 Vercel Analytics 与未来云同步的数据边界。",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: false },
};

const sections = [
  {
    id: "current-data-flows",
    title: "当前数据流",
    content: (
      <>
        <p>匿名 Reading、Sofia 本机确定性解释和“我的本机数据”使用浏览器本机存储。学习答案、学习事件、Sofia 对话与本机人工请求不会因访问公开页或登录而自动上传、迁移或绑定账户。</p>
        <p>交互式 Sofia 当前不向本站服务器、Qwen、语音供应商或远程人工队列发送问题、学习摘要、自由文本或录音。可选账户同步和阿里云学习数据库尚未开放，因此当前不会把学习记录发送到阿里云。</p>
      </>
    ),
  },
  {
    id: "accounts-and-vendors",
    title: "账户与外部服务",
    content: (
      <>
        <p>受邀账户由 Clerk 处理登录身份、会话和邀请资格。Clerk 身份数据与当前浏览器中的学习记录是两个不同的数据范围；登录不等于同步。</p>
        <p>Phase 0 已在代码、依赖和构建图中硬禁用 Vercel Web Analytics；公开页面不加载 Analytics 客户端，也不发送页面浏览或自定义分析事件。Vercel 托管和运行日志属于不同的数据流，不能被本项禁用声明覆盖。</p>
      </>
    ),
  },
  {
    id: "your-controls",
    title: "查看、导出与删除",
    content: (
      <>
        <p><FullDocumentLink href="/my-data">“我的本机数据”</FullDocumentLink>无需登录，可用于查看、导出和按命名空间清除当前浏览器中的记录。清除本机记录不会自动删除 Clerk 身份；删除 Clerk 身份也不会替代本机清除。</p>
        <p>可选云同步尚未开放。未来只有在展示精确字段、地域和差异并取得明确同意后才可上传；解除同步与删除云端数据必须是两个独立操作。若无法证明备份删除期限，云同步不会公开启用。</p>
      </>
    ),
  },
  {
    id: "shared-devices",
    title: "共享设备与安全",
    content: (
      <>
        <p>本机记录属于当前浏览器工作区，不按 Clerk 账户自动分区。共用电脑时，下一位使用者可能看到浏览器中保留的记录；交接设备前请先导出并明确清除。</p>
        <p>不要在学习问题、支持请求或自由文本中粘贴密码、验证码、身份证件、支付信息、医疗信息或其他敏感资料。Sufeiya 不会在聊天中索要 Clerk、阿里云或其他服务的凭据。</p>
      </>
    ),
  },
  {
    id: "age-and-contact",
    title: "年龄、支持与更新",
    content: (
      <>
        <p>当前邀请制内测仅面向 18+ 成人；这是一项参与边界，不是自动年龄核验。Sufeiya 是独立学习平台，不是 Duolingo 或 Duolingo English Test 官方服务。</p>
        <p>隐私或数据操作问题请先查看<FullDocumentLink href="/support">支持说明</FullDocumentLink>。产品能力或供应商发生实质变化时，本页应在启用相关能力前更新，并重新记录审核日期。</p>
      </>
    ),
  },
] as const;

export default function PrivacyPage() {
  return (
    <PublicSiteShell pageKey="governance" sofiaIntroduction={false}>
      <PublicDocumentPage
        eyebrow="隐私说明"
        title="数据先留在你看得见的地方。"
        lead="这里把浏览器本机数据、邀请账户、已禁用的匿名分析、未来云同步与未来 AI 数据流分开说明。未开放的能力不会被写成已经上线。"
        sections={sections}
      />
    </PublicSiteShell>
  );
}
