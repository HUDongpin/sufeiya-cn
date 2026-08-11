/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { legacyPages } from "@/lib/legacy-content.generated";
import { SiteFrame } from "@/components/site-frame";
import type { NavigationKey } from "@/lib/site";

export function AnonymousNotFoundPage() {
  const page = legacyPages["not-found"];

  return (
    <SiteFrame
      pageKey={page.nav as NavigationKey}
      desktopAccountControls={(
        <>
          <a className="auth-link" href="/sign-in">登录</a>
          <a className="auth-link auth-link-primary" href="/sign-up">注册</a>
        </>
      )}
      mobileAccountControls={(
        <>
          <a href="/sign-in">登录<span>账户</span></a>
          <a href="/sign-up">注册<span>免费</span></a>
        </>
      )}
      localModeLabel="学习数据仍在本机"
    >
      <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: page.mainHtml }} />
    </SiteFrame>
  );
}
