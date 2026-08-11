/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { zhCN } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { ClerkAccountControls } from "@/components/clerk-account-controls";
import { SiteFrame } from "@/components/site-frame";
import {
  SofiaAccessBoundary,
  SofiaUnavailableBoundary,
} from "@/components/sofia-access-boundary";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";
import type { NavigationKey } from "@/lib/site";

const clerkLocalization = {
  ...zhCN,
  // These two strings are currently undefined in Clerk's zh-CN bundle and
  // otherwise fall back to English in the sign-in and sign-up cards.
  formFieldInputPlaceholder__password: "请输入密码",
  formFieldInputPlaceholder__signUpPassword: "请创建密码",
};

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

  const shell = (
    <SiteFrame
      pageKey={pageKey}
      desktopAccountControls={clerkState.configured ? (
        <ClerkAccountControls />
      ) : (
        <a className="auth-link" href="/sign-in">账户未配置</a>
      )}
      mobileAccountControls={(
        <>
          <a href="/sign-in">登录或注册<span>{clerkState.configured ? "Clerk" : "未配置"}</span></a>
          <a href="/account">我的账户<span>{clerkState.configured ? "已启用" : "未配置"}</span></a>
        </>
      )}
      localModeLabel={clerkState.configured ? "学习数据仍在本机" : "Clerk 未配置 · 本机保存"}
    >
      {content}
    </SiteFrame>
  );

  if (!clerkState.configured) return shell;

  return (
    <ClerkProvider
      dynamic
      localization={clerkLocalization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {shell}
    </ClerkProvider>
  );
}
