import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { LegacyPage, type RoutedLegacyPageKey } from "@/components/legacy-page";
import { getClerkRuntimeState, isClerkProtectedPathname } from "@/lib/auth/clerk-config";
import { metadataForPage } from "@/lib/site";

function pathnameForPage(pageKey: RoutedLegacyPageKey) {
  return pageKey === "home" ? "/" : `/${pageKey}`;
}

export function metadataForRoutedPage(pageKey: RoutedLegacyPageKey): Metadata {
  const metadata = metadataForPage(pageKey);
  return isClerkProtectedPathname(pathnameForPage(pageKey))
    ? { ...metadata, robots: { index: false, follow: false } }
    : metadata;
}

export async function RoutedLegacyPage({ pageKey }: { pageKey: RoutedLegacyPageKey }) {
  const pathname = pathnameForPage(pageKey);
  if (isClerkProtectedPathname(pathname)) {
    const clerkState = getClerkRuntimeState();
    if (!clerkState.configured) {
      return (
        <AuthPage
          eyebrow="账户保护"
          title="学习页面暂时关闭。"
          lead="此页面需要登录；当前部署尚未完成 Clerk 配置，因此不会在未认证状态下显示学习数据或写入控件。"
        >
          <ClerkUnavailablePanel reason={clerkState.reason} />
        </AuthPage>
      );
    }

    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn({ returnBackUrl: pathname });
  }

  return <LegacyPage pageKey={pageKey} />;
}
