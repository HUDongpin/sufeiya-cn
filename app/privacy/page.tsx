import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { PublicDocumentPage } from "@/components/public-document-page";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "隐私说明｜苏肥鸭多邻国",
  description: "了解 Sufeiya 当前公开页面、浏览器本机学习记录、暂停中的账户服务、已禁用的 Vercel Analytics 与大陆迁移边界。",
  alternates: { canonical: "/privacy" },
  robots: { index: false, follow: false },
};

const sections = [
  {
    id: "current-data-flows",
    title: "当前数据流",
    content: (
      <>
        <p>匿名 Reading 和“我的本机数据”使用浏览器本机存储。此前已在当前浏览器形成的 Gate A、Sofia 与教研草稿仍留在各自本机命名空间；学习答案、学习事件、Sofia 对话与本机人工请求不会因访问公开页而自动上传、迁移或绑定账户。</p>
        <p>这些本机记录保留到你按命名空间删除、浏览器清除站点数据或浏览器自行回收存储为止；Sufeiya 服务器无法替你读取或恢复当前浏览器中的副本。</p>
        <p>交互式 Sofia 当前不向本站服务器、Qwen、语音供应商或远程人工队列发送问题、学习摘要、自由文本或录音。可选账户同步和阿里云学习数据库尚未开放，因此当前不会把学习记录发送到阿里云。</p>
      </>
    ),
  },
  {
    id: "accounts-and-vendors",
    title: "账户与外部服务",
    content: (
      <>
        <p>Owner 已决定把网站迁往中国大陆阿里云，并替换当前 Clerk 身份路径。迁移完成前，登录、邀请、账户管理与受保护学习区统一暂停；相关请求以 fail-closed 状态结束，不进入 Clerk。已有 Clerk 身份数据不会因为代码暂停而被自动删除，仍需在迁移或删除流程中另行核验。</p>
        <p>当前规范 Production 在完成阿里云部署、备案、域名切换与独立回归前仍由 Vercel 托管；因此网站请求和运行日志的境外处理不能写成已经停止。阿里云目前是已决定但尚未部署的目标，当前没有阿里云学习数据库或账户数据。</p>
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
    id: "handler-and-rights",
    title: "处理者、权利与投诉",
    content: (
      <>
        <p>个人信息处理者及内部合规责任人：<strong>Dr. Peter Hu</strong>。个人信息查阅、复制、更正、补充、删除、限制处理、撤回同意、账户关闭请求，以及网络数据投诉，可由你本人在微信中搜索公开个人微信 <strong>SofiaTang2020</strong> 发起。</p>
        <p>请先注明“权利请求”或“数据投诉”、涉及的页面或数据范围和希望采取的操作。项目方只在确有必要时要求最少身份核验，记录收件、处理状态、拒绝理由（如有）与结案结果；不会在微信中索要密码、验证码、会话令牌或完整本机导出。当前不承诺固定响应时限。</p>
        <p>详细自助和人工路径见<FullDocumentLink href="/support">支持说明</FullDocumentLink>。产品能力、供应商或处理目的发生实质变化时，本页应在启用相关能力前更新，并重新记录审核日期。</p>
      </>
    ),
  },
  {
    id: "age-boundary",
    title: "年龄与服务边界",
    content: (
      <>
        <p>当前服务仅面向 18+ 成人；这是一项参与边界，不是自动年龄核验。若发现未满十四周岁使用者或其个人信息，项目方将停止继续收集、不开设或邀请账户，并删除或隔离能够避免处理的信息；只有决定继续处理时，才会先取得监护人同意并制定专门规则。</p>
        <p>Sufeiya 是独立学习平台，不是 Duolingo 或 Duolingo English Test 官方服务。</p>
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
        lead="这里把浏览器本机数据、暂停中的账户路径、当前 Vercel 托管、已禁用的匿名分析与尚未完成的阿里云迁移分开说明。未完成的迁移不会被写成已经上线。"
        sections={sections}
      />
    </PublicSiteShell>
  );
}
