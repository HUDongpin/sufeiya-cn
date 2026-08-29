import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { PublicDocumentPage } from "@/components/public-document-page";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "获得支持｜苏肥鸭多邻国",
  description: "查找 Sufeiya 本机数据、受邀账户、学习内容和服务边界的支持路径。",
  alternates: { canonical: "/support" },
  robots: { index: false, follow: false },
};

const sections = [
  {
    id: "self-service",
    title: "先使用自助路径",
    content: (
      <ul>
        <li>本机记录：前往<FullDocumentLink href="/my-data">“我的本机数据”</FullDocumentLink>查看、导出或明确清除。</li>
        <li>受邀账户：前往<FullDocumentLink href="/sign-in">受邀账户登录</FullDocumentLink>；没有邀请链接时不会开放注册。</li>
        <li>功能与数据边界：查看<FullDocumentLink href="/about#faq">常见问题</FullDocumentLink>和<FullDocumentLink href="/privacy">隐私说明</FullDocumentLink>。</li>
        <li>公开课程：从<FullDocumentLink href="/resources">资源目录</FullDocumentLink>回到 Bilibili 原始发布页核对。</li>
      </ul>
    ),
  },
  {
    id: "human-contact",
    title: "人工联系路径",
    content: (
      <>
        <p>当前没有自动客服或教师案例队列。需要人工帮助时，可由你本人在微信中搜索公开个人微信 <strong>SofiaTang2020</strong>，发送前自行检查并删除不必要的个人信息。</p>
        <p>网站不会自动发送本机 Sofia 请求，也不承诺响应时间。任何“已提交”“已分配”或“教师已确认”状态，只有在未来真实队列和正式回执上线后才可显示。</p>
      </>
    ),
  },
  {
    id: "report-details",
    title: "报告问题时请提供什么",
    content: (
      <>
        <p>请提供页面路径、发生时间、浏览器与设备类型、可重复步骤以及不含身份或答案的错误文字。可以提供经过检查的截图，但请遮盖姓名、邮箱、邀请票据、验证码、答案和本机导出内容。</p>
        <p>不要发送密码、Clerk 会话、API key、身份证件、支付信息、录音、完整 localStorage 或未经授权的私有媒体。</p>
      </>
    ),
  },
  {
    id: "account-and-data",
    title: "账户与数据删除",
    content: (
      <>
        <p>本机学习数据与 Clerk 身份是两个不同范围。先在<FullDocumentLink href="/my-data">“我的本机数据”</FullDocumentLink>导出或清除当前浏览器记录，再在登录后的账户管理中处理身份。</p>
        <p>云同步尚未开放，因此当前没有可由本站删除的阿里云学习记录。未来如开放同步，云端导出、解除同步与删除必须提供独立、可核验的操作。</p>
      </>
    ),
  },
  {
    id: "urgent-safety",
    title: "紧急与安全事项",
    content: (
      <p>Sufeiya 不是紧急服务、医疗服务、危机热线或考试官方支持。若存在人身危险、健康危机、诈骗或账户被盗，请优先联系当地紧急服务、相关平台官方支持或可信任的专业人员。</p>
    ),
  },
] as const;

export default function SupportPage() {
  return (
    <PublicSiteShell pageKey="governance" sofiaIntroduction={false}>
      <PublicDocumentPage
        eyebrow="获得支持"
        title="先保全数据，再把问题说清楚。"
        lead="当前支持是学习者主动发起的人工联系路径，不是自动队列。这里给出自助步骤、最小化问题信息和凭据边界。"
        sections={sections}
      />
    </PublicSiteShell>
  );
}
