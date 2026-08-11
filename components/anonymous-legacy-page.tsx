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
        <>
          <FullDocumentLink className="auth-link" href="/sign-in">登录</FullDocumentLink>
          <FullDocumentLink className="auth-link auth-link-primary" href="/sign-up">注册</FullDocumentLink>
        </>
      )}
      mobileAccountControls={(
        <>
          <FullDocumentLink href="/sign-in">登录<span>账户</span></FullDocumentLink>
          <FullDocumentLink href="/sign-up">注册<span>免费</span></FullDocumentLink>
        </>
      )}
      localModeLabel="学习数据仍在本机"
    >
      <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: page.mainHtml }} />
    </SiteFrame>
  );
}
