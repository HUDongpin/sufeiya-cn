import type { ReactNode } from "react";

import { FullDocumentLink } from "@/components/full-document-link";
import { OfflineNavigationBoundary } from "@/components/offline-navigation-boundary";
import { SiteFrame } from "@/components/site-frame";

export function PublicLearningShell({ children }: { children: ReactNode }) {
  return (
    <>
      <OfflineNavigationBoundary />
      <SiteFrame
        pageKey="public-learning"
        desktopAccountControls={(
          <FullDocumentLink className="auth-link auth-link-primary" href="/sign-in">
            受邀内测登录
          </FullDocumentLink>
        )}
        mobileAccountControls={(
          <FullDocumentLink href="/about#faq">数据与服务边界<span>公开</span></FullDocumentLink>
        )}
        localModeLabel="公开试学 · 本机保存"
      >
        {children}
      </SiteFrame>
    </>
  );
}
