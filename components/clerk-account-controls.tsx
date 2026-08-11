"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function ClerkAccountControls() {
  return (
    <div className="clerk-account-controls" aria-label="账户">
      <Show when="signed-out">
        <Link className="auth-link auth-link-primary" href="/sign-in">登录</Link>
      </Show>
      <Show when="signed-in">
        <Link className="auth-link" href="/account">我的账户</Link>
        <UserButton
          appearance={{ elements: { avatarBox: { width: "36px", height: "36px" } } }}
        />
      </Show>
    </div>
  );
}
