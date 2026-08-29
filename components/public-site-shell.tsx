import type { ReactNode } from "react";

import { FullDocumentLink } from "@/components/full-document-link";
import { OfflineNavigationBoundary } from "@/components/offline-navigation-boundary";
import { PublicAnalytics } from "@/components/public-analytics";
import { SiteFrame } from "@/components/site-frame";
import { SofiaPublicFloatingAssistant } from "@/components/sofia-public-access";
import type { NavigationKey } from "@/lib/site";

export function PublicSiteShell({
  pageKey,
  analytics = true,
  sofiaIntroduction = true,
  children,
}: {
  pageKey: NavigationKey;
  analytics?: boolean;
  sofiaIntroduction?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <OfflineNavigationBoundary />
      <SiteFrame
        pageKey={pageKey}
        desktopAccountControls={(
          <FullDocumentLink className="auth-link auth-link-primary" href="/sign-in">
            受邀账户登录
          </FullDocumentLink>
        )}
        mobileAccountControls={(
          <>
            <FullDocumentLink href="/sign-in">受邀账户登录<span>邀请制</span></FullDocumentLink>
            <FullDocumentLink href="/sign-up">使用邀请链接注册<span>非公开注册</span></FullDocumentLink>
          </>
        )}
        localModeLabel="公开页面 · 本机优先"
      >
        {children}
      </SiteFrame>
      {sofiaIntroduction ? <SofiaPublicFloatingAssistant accessState="signed-out" /> : null}
      {analytics ? <PublicAnalytics enabled={process.env.VERCEL_ENV === "production"} /> : null}
    </>
  );
}
