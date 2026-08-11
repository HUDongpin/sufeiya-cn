import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { LegacyPage, type RoutedLegacyPageKey } from "@/components/legacy-page";
import { getClerkRuntimeState, isClerkProtectedPathname } from "@/lib/auth/clerk-config";
import { legacyPages, publicRouteSlugs } from "@/lib/legacy-content.generated";
import { metadataForPage } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicRouteSlugs.map((slug) => ({ slug }));
}

function routeKey(slug: string): RoutedLegacyPageKey | null {
  if (slug === "home" || slug === "not-found") return null;
  return slug in legacyPages ? (slug as RoutedLegacyPageKey) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const key = routeKey(slug);
  if (!key) return {};
  const metadata = metadataForPage(key);
  return isClerkProtectedPathname(`/${slug}`)
    ? { ...metadata, robots: { index: false, follow: false } }
    : metadata;
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = routeKey(slug);
  if (!key) notFound();

  const pathname = `/${slug}`;
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

  return <LegacyPage pageKey={key} />;
}
