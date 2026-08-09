import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "注册｜苏肥鸭多邻国",
  description: "注册苏肥鸭多邻国在线学习平台账户。",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthPage eyebrow="注册" title="建立你的学习账户。" lead="用邮箱完成注册；学习计划和练习记录目前仍保存在你的浏览器中。">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthPage>
  );
}
