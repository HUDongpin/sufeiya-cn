import type { Metadata } from "next";

import { SuperTeacherClient } from "@/components/super-teacher-client";
import { SiteShell } from "@/components/site-shell";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Sofia智能老师｜有来源的 Gate A 学习解释";
const description = "解释本机学习证据、7 天计划与推荐依据，逐句显示来源；来源不足时明确停止，并保留非 AI 与人工支持路径。";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/super-teacher" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE_NAME,
    title,
    description,
    url: "/super-teacher",
    images: [{ url: "/assets/sufeiya-logo.png", width: 2792, height: 560, alt: "苏肥鸭多邻国品牌标志" }],
  },
  twitter: { card: "summary", title, description, images: ["/assets/sufeiya-mark.png"] },
};

export default function SuperTeacherPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Sofia智能老师",
    alternateName: "Sofia AI Teacher",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/super-teacher`,
    inLanguage: "zh-CN",
    description,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <SiteShell pageKey="super-teacher" sofiaSurface="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SuperTeacherClient />
    </SiteShell>
  );
}
