/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { Show, UserButton } from "@clerk/nextjs";
import Script from "next/script";
import type { ReactNode } from "react";

import { navItems, type NavigationKey } from "@/lib/site";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function SiteHeader({ pageKey, authAware }: { pageKey: NavigationKey; authAware: boolean }) {
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
            {authAware ? (
              <>
                <Show when="signed-out">
                  <a className="auth-link" href="/sign-in">登录</a>
                  <a className="auth-link auth-link-primary" href="/sign-up">注册</a>
                </Show>
                <Show when="signed-in">
                  <a className="auth-link" href="/account">我的账户</a>
                  <UserButton userProfileMode="navigation" userProfileUrl="/account" />
                </Show>
              </>
            ) : (
              <>
                <a className="auth-link" href="/sign-in">登录</a>
                <a className="auth-link auth-link-primary" href="/sign-up">注册</a>
              </>
            )}
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
          {authAware ? (
            <>
              <Show when="signed-out">
                <a href="/sign-in">登录<span>账户</span></a>
                <a href="/sign-up">注册<span>免费</span></a>
              </Show>
              <Show when="signed-in">
                <a href="/account">我的账户<span>资料</span></a>
              </Show>
            </>
          ) : (
            <>
              <a href="/sign-in">登录<span>账户</span></a>
              <a href="/sign-up">注册<span>免费</span></a>
            </>
          )}
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
            <a href="/my-data">我的本机数据</a>
            <a href="/learning-path">学习路径</a>
            <a href="/platform">平台功能</a>
            <a href="/resources">学习资源</a>
          </div>
          <div>
            <strong>账户</strong>
            <a href="/sign-in">登录</a>
            <a href="/sign-up">注册</a>
            <a href="/account">我的账户</a>
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

export function SiteShell({
  pageKey,
  children,
  authAware = true,
}: {
  pageKey: NavigationKey;
  children: ReactNode;
  authAware?: boolean;
}) {
  return (
    <>
      <SiteHeader pageKey={pageKey} authAware={authAware} />
      {children}
      <SiteFooter />
      <Script id="sufeiya-site-runtime" src="/script.js" strategy="afterInteractive" />
    </>
  );
}
