import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { PublicDocumentPage } from "@/components/public-document-page";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "获得支持｜苏肥鸭多邻国",
  description: "查找 Sufeiya 本机数据、个人信息权利、网络数据投诉、账户迁移和学习内容的支持路径。",
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
        <li>账户与邀请：迁往中国大陆阿里云并替换当前身份路径期间保持暂停；不要继续使用旧邀请链接。</li>
        <li>功能与数据边界：查看<FullDocumentLink href="/about#faq">常见问题</FullDocumentLink>和<FullDocumentLink href="/privacy">隐私说明</FullDocumentLink>。</li>
        <li>公开课程：从<FullDocumentLink href="/resources">资源目录</FullDocumentLink>回到 Bilibili 原始发布页核对。</li>
      </ul>
    ),
  },
  {
    id: "human-contact",
    title: "支持、权利请求与投诉",
    content: (
      <>
        <p>个人信息处理者及内部合规责任人为 <strong>Dr. Peter Hu</strong>。需要一般支持、行使个人信息权利或提出网络数据投诉时，可由你本人在微信中搜索指定公开个人微信 <strong>SofiaTang2020</strong>。</p>
        <p>请先写明“支持”“权利请求”或“数据投诉”，再说明涉及的页面或数据范围和希望采取的操作。项目方只在确有必要时要求最少身份核验，并记录收件、处理状态、拒绝理由（如有）和结案结果；发送前请删除不必要的个人信息。</p>
        <p>当前没有自动客服或教师案例队列。网站不会自动发送本机 Sofia 请求，也不承诺响应时间。任何“已提交”“已分配”或“教师已确认”状态，只有在未来真实队列和正式回执上线后才可显示。</p>
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
    title: "账户迁移与数据删除",
    content: (
      <>
        <p>本机学习数据与已有 Clerk 身份是两个不同范围。先在<FullDocumentLink href="/my-data">“我的本机数据”</FullDocumentLink>导出或清除当前浏览器记录；账户服务暂停期间，如需处理已有身份数据，请通过上述指定微信发起请求。</p>
        <p>当前规范 Production 在阿里云部署、备案、身份替换、域名切换与独立回归完成前仍由 Vercel 托管。账户路径已在迁移候选中 fail-closed，但这不等于 Vercel 托管或已有 Clerk 数据已经删除。</p>
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
        lead="当前支持、个人信息权利请求与网络数据投诉都由使用者主动发起，不是自动队列。这里给出自助步骤、最小化信息和凭据边界。"
        sections={sections}
      />
    </PublicSiteShell>
  );
}
