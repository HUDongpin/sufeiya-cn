/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
import { legacyPages } from "@/lib/legacy-content.generated";
import { FullDocumentLink } from "@/components/full-document-link";
import { SiteFrame } from "@/components/site-frame";
import type { NavigationKey } from "@/lib/site";

export function AnonymousNotFoundPage() {
  const page = legacyPages["not-found"];

  return (
    <SiteFrame
      pageKey={page.nav as NavigationKey}
      desktopAccountControls={(
        <FullDocumentLink className="auth-link" href="/support#account-and-data">账户服务迁移中</FullDocumentLink>
      )}
      mobileAccountControls={(
        <FullDocumentLink href="/support#account-and-data">账户与邀请暂停<span>大陆迁移中</span></FullDocumentLink>
      )}
      localModeLabel="公开页面 · 本机优先 · 账户迁移中"
    >
      <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: page.mainHtml }} />
    </SiteFrame>
  );
}
