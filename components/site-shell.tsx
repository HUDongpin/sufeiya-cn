/* Full-document links are intentional until the legacy per-page runtimes are migrated to React. */
import { zhCN } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ClerkAccountControls } from "@/components/clerk-account-controls";
import { FullDocumentLink } from "@/components/full-document-link";
import { SiteFrame } from "@/components/site-frame";
import {
  SofiaAccessBoundary,
  SofiaUnavailableBoundary,
} from "@/components/sofia-access-boundary";
import {
  betaAccessContextFromHeader,
  SUFEIYA_BETA_ACCESS_CONTEXT_HEADER,
} from "@/lib/auth/beta-access";
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

const localModeLabels = {
  approved: "邀请制内测 · 学习数据仍在本机",
  invitation_required: "邀请制内测 · 当前账户没有有效内测资格",
  verification_unavailable: "邀请制内测 · 资格暂时无法核验",
  signed_out: "邀请制内测 · 登录后核验资格",
  not_checked: "邀请制内测 · 此页未核验学习区资格",
} satisfies Record<ReturnType<typeof betaAccessContextFromHeader>, string>;

export async function SiteShell({
  pageKey,
  sofiaSurface,
  children,
}: {
  pageKey: NavigationKey;
  sofiaSurface: SofiaSurface;
  children: ReactNode;
}) {
  await connection();
  const clerkState = getClerkRuntimeState();
  const betaAccessContext = clerkState.configured
    ? betaAccessContextFromHeader(
        (await headers()).get(SUFEIYA_BETA_ACCESS_CONTEXT_HEADER),
      )
    : "verification_unavailable";
  const content = sofiaSurface === "none"
    ? children
    : clerkState.configured
      ? (
          <SofiaAccessBoundary
            surface={sofiaSurface}
            betaAccessContext={betaAccessContext}
          >
            {children}
          </SofiaAccessBoundary>
        )
      : <SofiaUnavailableBoundary surface={sofiaSurface}>{children}</SofiaUnavailableBoundary>;

  const shell = (
    <SiteFrame
      pageKey={pageKey}
      desktopAccountControls={clerkState.configured ? (
        <ClerkAccountControls />
      ) : (
        <FullDocumentLink className="auth-link" href="/sign-in">账户未配置</FullDocumentLink>
      )}
      mobileAccountControls={(
        <>
          <FullDocumentLink href="/sign-in">登录受邀账户<span>{clerkState.configured ? "Clerk" : "未配置"}</span></FullDocumentLink>
          <FullDocumentLink href="/sign-up">受邀注册<span>邀请链接</span></FullDocumentLink>
          <FullDocumentLink href="/account">我的账户<span>{clerkState.configured ? "已启用" : "未配置"}</span></FullDocumentLink>
        </>
      )}
      localModeLabel={clerkState.configured
        ? localModeLabels[betaAccessContext]
        : "Clerk 未配置 · 本机保存"}
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
