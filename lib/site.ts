import type { Metadata } from "next";

import { legacyPages, type LegacyPageKey } from "@/lib/legacy-content.generated";

export const SITE_URL = "https://sufeiya.cn";
export const SITE_NAME = "苏肥鸭多邻国";

export const navItems = [
  { key: "learning-path", label: "学习路径", href: "/learning-path" },
  { key: "platform", label: "平台功能", href: "/platform" },
  { key: "resources", label: "学习资源", href: "/resources" },
  { key: "about", label: "关于我们", href: "/about" },
] as const;

export type NavigationKey = (typeof navItems)[number]["key"] | "home" | "workspace" | "account" | "auth";

export function metadataForPage(key: LegacyPageKey): Metadata {
  const page = legacyPages[key];
  const canonical = page.path === "/404" ? undefined : page.path;

  return {
    title: page.title,
    description: page.description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: SITE_NAME,
      title: page.title,
      description: page.description,
      ...(canonical ? { url: canonical } : {}),
      images: [
        {
          url: "/assets/sufeiya-logo.png",
          width: 2792,
          height: 560,
          alt: "苏肥鸭多邻国品牌标志",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description,
      images: ["/assets/sufeiya-mark.png"],
    },
  };
}
