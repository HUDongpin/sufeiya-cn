import type { Metadata } from "next";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { ClerkWidgetFrame } from "@/components/clerk-widget-frame";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "登录｜苏肥鸭多邻国",
  description: "登录苏肥鸭多邻国后核验邀请制内测资格；资格通过后才能进入学习工作台。",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  const clerkState = getClerkRuntimeState();

  return (
    <AuthPage eyebrow="安全登录" title="登录后核验内测资格。" lead="通过资格核验后才能继续学习；登录本身不代表已获准。浏览器里的学习记录仍保持本机存储，不会因登录自动绑定到身份。">
      {clerkState.configured ? (
        <ClerkWidgetFrame mode="sign-in" />
      ) : <ClerkUnavailablePanel reason={clerkState.reason} />}
    </AuthPage>
  );
}
