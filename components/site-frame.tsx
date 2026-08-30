/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
import Script from "next/script";
import type { ReactNode } from "react";

import { FullDocumentLink } from "@/components/full-document-link";
import { navItems, type NavigationKey } from "@/lib/site";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function SiteHeader({
  pageKey,
  desktopAccountControls,
  mobileAccountControls,
  localModeLabel,
}: {
  pageKey: NavigationKey;
  desktopAccountControls: ReactNode;
  mobileAccountControls: ReactNode;
  localModeLabel: string;
}) {
  return (
    <>
      <div className="reading-progress" aria-hidden="true"><span /></div>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header" data-header>
        <div className="header-inner">
          <FullDocumentLink className="brand" href="/" aria-label="苏肥鸭多邻国首页">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/sufeiya-logo-header.webp" width="436" height="87" alt="苏肥鸭多邻国" />
          </FullDocumentLink>
          <nav className="desktop-nav" aria-label="主导航">
            {navItems.map((item) => {
              const active = pageKey === item.key;
              return (
                <FullDocumentLink
                  key={item.key}
                  href={item.href}
                  data-page-link={item.key}
                  className={active ? "is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </FullDocumentLink>
              );
            })}
          </nav>
          <div className="header-actions">
            <FullDocumentLink
              className={`header-cta${pageKey === "public-learning" ? " is-current" : ""}`}
              href="/learn/reading"
              aria-current={pageKey === "public-learning" ? "page" : undefined}
            >
              <span>开始 3 分钟入门检查</span>
              <ArrowIcon />
            </FullDocumentLink>
            <FullDocumentLink
              className={`auth-link${pageKey === "super-teacher" ? " is-current" : ""}`}
              href="/super-teacher"
              aria-current={pageKey === "super-teacher" ? "page" : undefined}
            >
              Sofia智能老师
            </FullDocumentLink>
            {desktopAccountControls}
            <span className="local-mode-badge">{localModeLabel}</span>
          </div>
          <button className="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="打开导航菜单">
            <span /><span />
          </button>
        </div>
        <nav id="mobile-nav" className="mobile-nav" aria-label="移动端主导航" hidden>
          <div className="mobile-nav-group" role="group" aria-labelledby="mobile-nav-start">
            <p id="mobile-nav-start">开始学习</p>
            <FullDocumentLink className="mobile-external" href="/learn/reading" aria-current={pageKey === "public-learning" ? "page" : undefined}>
              开始 Reading 入门检查
              <ArrowIcon />
            </FullDocumentLink>
            <FullDocumentLink href="/support#account-and-data">账户学习区<span>大陆迁移中</span></FullDocumentLink>
            <FullDocumentLink href="/super-teacher" aria-current={pageKey === "super-teacher" ? "page" : undefined}>Sofia智能老师<span>本机解释</span></FullDocumentLink>
          </div>
          <div className="mobile-nav-group" role="group" aria-labelledby="mobile-nav-learn">
            <p id="mobile-nav-learn">了解平台</p>
            {navItems.map((item, index) => (
              <FullDocumentLink key={item.key} href={item.href} aria-current={pageKey === item.key ? "page" : undefined}>
                {item.label}<span>{String(index + 1).padStart(2, "0")}</span>
              </FullDocumentLink>
            ))}
          </div>
          <div className="mobile-nav-group" role="group" aria-labelledby="mobile-nav-account">
            <p id="mobile-nav-account">账户与数据</p>
            <FullDocumentLink href="/my-data">我的本机数据<span>无需登录</span></FullDocumentLink>
            {mobileAccountControls}
            <FullDocumentLink href="/privacy">隐私说明<span>公开</span></FullDocumentLink>
            <FullDocumentLink href="/support">获得支持<span>公开</span></FullDocumentLink>
          </div>
        </nav>
      </header>
    </>
  );
}

function SiteFooter({ invitationRegistration }: { invitationRegistration: boolean }) {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <FullDocumentLink className="footer-brand" href="/" aria-label="返回首页">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/sufeiya-logo-header.webp" width="436" height="87" alt="苏肥鸭多邻国" />
        </FullDocumentLink>
        <div className="footer-nav">
          <div>
            <strong>页面</strong>
            <FullDocumentLink href="/learn/reading">3 分钟入门检查</FullDocumentLink>
            <FullDocumentLink href="/support#account-and-data">账户学习区迁移说明</FullDocumentLink>
            <FullDocumentLink href="/super-teacher">Sofia智能老师</FullDocumentLink>
            <FullDocumentLink href="/my-data">我的本机数据</FullDocumentLink>
            <FullDocumentLink href="/learning-path">学习路径</FullDocumentLink>
            <FullDocumentLink href="/platform">平台功能</FullDocumentLink>
            <FullDocumentLink href="/resources">学习资源</FullDocumentLink>
          </div>
          <div>
            <strong>数据与账户</strong>
            <FullDocumentLink href="/my-data">我的本机数据</FullDocumentLink>
            <FullDocumentLink href="/support#account-and-data">登录、邀请与账户暂停</FullDocumentLink>
            {invitationRegistration ? <small>邀请注册在大陆迁移期间保持关闭。</small> : null}
            <FullDocumentLink href="/privacy">隐私说明</FullDocumentLink>
            <small>公开 Reading 与本机数据管理不需要登录。</small>
          </div>
          <div>
            <strong>了解更多</strong>
            <FullDocumentLink href="/about">关于我们</FullDocumentLink>
            <FullDocumentLink href="/about#faq">常见问题</FullDocumentLink>
            <FullDocumentLink href="/terms">使用条款</FullDocumentLink>
            <FullDocumentLink href="/support">获得支持</FullDocumentLink>
            <a href="https://space.bilibili.com/448907095" target="_blank" rel="noopener noreferrer">
              Bilibili <span aria-hidden="true">↗</span>
              <span className="sr-only">（在新窗口打开）</span>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-legal">
        <p>© <span data-current-year>2026</span> Sufeiya. 保留所有权利。</p>
        <p>独立在线学习平台，非 Duolingo 官方服务。Duolingo 和 Duolingo English Test 是其各自权利人的商标。</p>
      </div>
    </footer>
  );
}

export function SiteFrame({
  pageKey,
  desktopAccountControls,
  mobileAccountControls,
  localModeLabel,
  children,
}: {
  pageKey: NavigationKey;
  desktopAccountControls: ReactNode;
  mobileAccountControls: ReactNode;
  localModeLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader
        pageKey={pageKey}
        desktopAccountControls={desktopAccountControls}
        mobileAccountControls={mobileAccountControls}
        localModeLabel={localModeLabel}
      />
      {children}
      <SiteFooter invitationRegistration={pageKey === "auth"} />
      <Script id="sufeiya-site-runtime" src="/script.js" strategy="afterInteractive" />
    </>
  );
}
