import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "登录｜苏肥鸭多邻国",
  description: "登录苏肥鸭多邻国在线学习平台账户。",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthPage eyebrow="登录" title="欢迎回来。" lead="登录后可以管理个人资料；现有学习工具继续支持游客直接使用。">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthPage>
  );
}
