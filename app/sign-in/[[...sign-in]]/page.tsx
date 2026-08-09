import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "登录｜苏肥鸭多邻国",
  description: "登录苏肥鸭多邻国后进入学习工作台；本机学习数据不会因登录而自动上传或同步。",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  const clerkState = getClerkRuntimeState();

  return (
    <AuthPage eyebrow="安全登录" title="登录后继续学习。" lead="账户用于控制工作台与学习页面访问；浏览器里的学习记录仍保持本机存储，不会因登录自动绑定到身份。">
      {clerkState.configured ? (
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/workspace"
          appearance={{ elements: { rootBox: { width: "100%" } } }}
        />
      ) : <ClerkUnavailablePanel reason={clerkState.reason} />}
    </AuthPage>
  );
}
