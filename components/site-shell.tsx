/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
/* eslint-disable @next/next/no-html-link-for-pages */
import Script from "next/script";
import type { ReactNode } from "react";

import { ClerkAccountControls } from "@/components/clerk-account-controls";
import {
  SofiaAccessBoundary,
  SofiaUnavailableBoundary,
} from "@/components/sofia-access-boundary";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";
import { navItems, type NavigationKey } from "@/lib/site";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function SiteHeader({ pageKey }: { pageKey: NavigationKey }) {
  const clerkState = getClerkRuntimeState();

  return (
    <>
      <div className="reading-progress" aria-hidden="true"><span /></div>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header" data-header>
        <div className="header-inner">
          <a className="brand" href="/" aria-label="苏肥鸭多邻国首页">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/sufeiya-logo.png" width="2792" height="560" alt="苏肥鸭多邻国" />
          </a>
          <nav className="desktop-nav" aria-label="主导航">
            {navItems.map((item) => {
              const active = pageKey === item.key;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  data-page-link={item.key}
                  className={active ? "is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="header-actions">
            <a
              className={`header-cta${pageKey === "workspace" ? " is-current" : ""}`}
              href="/workspace"
              aria-current={pageKey === "workspace" ? "page" : undefined}
            >
              <span>开始学习</span>
              <ArrowIcon />
            </a>
            <a
              className={`auth-link${pageKey === "super-teacher" ? " is-current" : ""}`}
              href="/super-teacher"
              aria-current={pageKey === "super-teacher" ? "page" : undefined}
            >
              Sofia智能老师
            </a>
            {clerkState.configured ? (
              <ClerkAccountControls />
            ) : (
              <a className="auth-link" href="/sign-in">账户未配置</a>
            )}
            <span className="local-mode-badge">
              {clerkState.configured ? "学习数据仍在本机" : "Clerk 未配置 · 本机保存"}
            </span>
          </div>
          <button className="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="打开导航菜单">
            <span /><span />
          </button>
        </div>
        <nav id="mobile-nav" className="mobile-nav" aria-label="移动端主导航" hidden>
          {navItems.map((item, index) => (
            <a key={item.key} href={item.href} aria-current={pageKey === item.key ? "page" : undefined}>
              {item.label}<span>{String(index + 1).padStart(2, "0")}</span>
            </a>
          ))}
          <a className="mobile-external" href="/workspace" aria-current={pageKey === "workspace" ? "page" : undefined}>
            进入学习工作台
            <ArrowIcon />
          </a>
          <a href="/super-teacher" aria-current={pageKey === "super-teacher" ? "page" : undefined}>Sofia智能老师<span>Gate A</span></a>
          <a href="/my-data">我的本机数据<span>本机</span></a>
          <a href="/teaching-review-demo">教研复核演示<span>本机</span></a>
          <a href="/sign-in">登录或注册<span>{clerkState.configured ? "Clerk" : "未配置"}</span></a>
          <a href="/account">我的账户<span>{clerkState.configured ? "已启用" : "未配置"}</span></a>
        </nav>
      </header>
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <a className="footer-brand" href="/" aria-label="返回首页">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/sufeiya-logo.png" width="2792" height="560" alt="苏肥鸭多邻国" />
        </a>
        <div className="footer-nav">
          <div>
            <strong>页面</strong>
            <a href="/workspace">开始学习</a>
            <a href="/super-teacher">Sofia智能老师</a>
            <a href="/my-data">我的本机数据</a>
            <a href="/learning-path">学习路径</a>
            <a href="/platform">平台功能</a>
            <a href="/resources">学习资源</a>
          </div>
          <div>
            <strong>数据与账户</strong>
            <a href="/my-data">我的本机数据</a>
            <a href="/teaching-review-demo">教研复核演示</a>
            <a href="/sign-in">安全登录</a>
            <a href="/account">账户管理</a>
            <small>登录不会自动上传或同步本机学习数据。</small>
          </div>
          <div>
            <strong>了解更多</strong>
            <a href="/about">关于我们</a>
            <a href="/about#faq">常见问题</a>
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

export type SofiaSurface = "floating" | "page" | "none";

export function SiteShell({
  pageKey,
  sofiaSurface,
  children,
}: {
  pageKey: NavigationKey;
  sofiaSurface: SofiaSurface;
  children: ReactNode;
}) {
  const clerkState = getClerkRuntimeState();
  const content = sofiaSurface === "none"
    ? children
    : clerkState.configured
      ? <SofiaAccessBoundary surface={sofiaSurface}>{children}</SofiaAccessBoundary>
      : <SofiaUnavailableBoundary surface={sofiaSurface}>{children}</SofiaUnavailableBoundary>;

  return (
    <>
      <SiteHeader pageKey={pageKey} />
      {content}
      <SiteFooter />
      <Script id="sufeiya-site-runtime" src="/script.js" strategy="afterInteractive" />
    </>
  );
}
