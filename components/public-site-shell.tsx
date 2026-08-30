import type { ReactNode } from "react";

import { FullDocumentLink } from "@/components/full-document-link";
import { OfflineNavigationBoundary } from "@/components/offline-navigation-boundary";
import { SiteFrame } from "@/components/site-frame";
import { SofiaPublicFloatingAssistant } from "@/components/sofia-public-access";
import type { NavigationKey } from "@/lib/site";

export function PublicSiteShell({
  pageKey,
  sofiaIntroduction = true,
  children,
}: {
  pageKey: NavigationKey;
  sofiaIntroduction?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <OfflineNavigationBoundary />
      <SiteFrame
        pageKey={pageKey}
        desktopAccountControls={(
          <FullDocumentLink className="auth-link" href="/support#account-and-data">
            账户服务迁移中
          </FullDocumentLink>
        )}
        mobileAccountControls={(
          <FullDocumentLink href="/support#account-and-data">账户与邀请暂停<span>大陆迁移中</span></FullDocumentLink>
        )}
        localModeLabel="公开页面 · 本机优先 · 账户迁移中"
      >
        {children}
      </SiteFrame>
      {sofiaIntroduction ? <SofiaPublicFloatingAssistant accessState="unavailable" /> : null}
    </>
  );
}
