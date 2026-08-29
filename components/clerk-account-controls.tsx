"use client";

import { Show, UserButton } from "@clerk/nextjs";

import { FullDocumentLink } from "@/components/full-document-link";

export function ClerkAccountControls() {
  return (
    <div className="clerk-account-controls" aria-label="账户">
      <Show when="signed-out">
        <FullDocumentLink className="auth-link auth-link-primary" href="/sign-in">受邀内测登录</FullDocumentLink>
      </Show>
      <Show when="signed-in">
        <FullDocumentLink className="auth-link" href="/account">我的账户</FullDocumentLink>
        <UserButton
          appearance={{ elements: { avatarBox: { width: "36px", height: "36px" } } }}
        />
      </Show>
    </div>
  );
}

export function ClerkMobileAccountControls() {
  return (
    <>
      <Show when="signed-out">
        <FullDocumentLink href="/sign-in">受邀账户登录<span>邀请制</span></FullDocumentLink>
        <FullDocumentLink href="/sign-up">使用邀请链接注册<span>非公开注册</span></FullDocumentLink>
      </Show>
      <Show when="signed-in">
        <FullDocumentLink href="/account">账户与数据<span>登录后管理</span></FullDocumentLink>
      </Show>
    </>
  );
}
