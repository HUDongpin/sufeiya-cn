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
          <FullDocumentLink className="auth-link" href="/support#account-and-data">
            账户服务迁移中
          </FullDocumentLink>
        )}
        mobileAccountControls={(
          <FullDocumentLink href="/about#faq">数据与服务边界<span>公开</span></FullDocumentLink>
        )}
        localModeLabel="公开试学 · 本机保存 · 账户迁移中"
      >
        {children}
      </SiteFrame>
    </>
  );
}
