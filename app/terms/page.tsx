import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { PublicDocumentPage } from "@/components/public-document-page";
import { PublicSiteShell } from "@/components/public-site-shell";

export const metadata: Metadata = {
  title: "使用条款｜苏肥鸭多邻国",
  description: "Sufeiya 公开试学、邀请制账户、教育用途、内容边界和可接受使用说明。",
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: false },
};

const sections = [
  {
    id: "service-scope",
    title: "服务范围",
    content: (
      <>
        <p>Sufeiya 当前提供公开平台介绍、匿名 Reading 单轮入门检查、公开资源目录，以及邀请制、本机优先的 Gate A 学习原型。持续课程、账户同步、真人教师队列和 Grounded AI 只在各自发布 Gate 通过后开放。</p>
        <p>公开注册、支付、订阅、真实社区、未成年人服务、Writing/Speaking 自动评分、语音、麦克风和数字人不属于当前网站服务。</p>
      </>
    ),
  },
  {
    id: "education-boundary",
    title: "教育用途与非官方声明",
    content: (
      <>
        <p>本站反馈用于自学和形成下一步任务，不构成正式诊断、官方 DET 分数、成绩预测、录取建议或提分保证。Sufeiya 不是 Duolingo 或 Duolingo English Test 官方服务，相关名称和商标归各自权利人所有。</p>
        <p>考试规则可能变化。来源不足、内容过期或答案需要合格人工判断时，平台应明确停止，不用推测替代证据。</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "账户迁移暂停",
    content: (
      <>
        <p>Owner 已决定把网站迁往中国大陆阿里云并替换当前 Clerk 身份路径。迁移、备案、身份替换和独立回归完成前，登录、邀请、账户管理与受保护学习区保持关闭；不要继续使用旧邀请链接。</p>
        <p>公开 Reading 与<FullDocumentLink href="/my-data">本机数据管理</FullDocumentLink>不需要账户。已有身份数据问题请按<FullDocumentLink href="/support#human-contact">支持说明</FullDocumentLink>发起权利请求；暂停代码不会自动删除供应商保存的既有数据。</p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "可接受使用",
    content: (
      <>
        <p>不得利用本站侵害他人权利、绕过邀请或发布 Gate、破坏服务、注入恶意代码、抓取私有内容、冒充教师或官方评分员，或请求协助正在进行的考试作弊。</p>
        <p>公开资源目录仅链接到原始发布页。除非另有明确许可，不得把本站原创内容、教师身份、肖像、声音或学习者数据用于训练、再发布或商业衍生。</p>
      </>
    ),
  },
  {
    id: "changes-and-support",
    title: "变更、中断与支持",
    content: (
      <>
        <p>原型能力可能因安全、内容审核、供应商状态或维护而暂停。一次 CI、HTTP 200、Preview 或截图都不单独构成 Production 完成证明。</p>
        <p>条款实质变化会更新版本日期。数据处理以<FullDocumentLink href="/privacy">隐私说明</FullDocumentLink>为准；支持渠道不承诺响应时限，也不用于紧急服务。</p>
      </>
    ),
  },
] as const;

export default function TermsPage() {
  return (
    <PublicSiteShell pageKey="governance" sofiaIntroduction={false}>
      <PublicDocumentPage
        eyebrow="使用条款"
        title="用真实边界，保护每一次学习。"
        lead="这些条款描述当前可用服务、暂停中的账户路径和教育用途。它不会把阿里云迁移或其他路线图当作已交付承诺。"
        sections={sections}
      />
    </PublicSiteShell>
  );
}
