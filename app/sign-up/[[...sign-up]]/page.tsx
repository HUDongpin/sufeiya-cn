import type { Metadata } from "next";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { ClerkWidgetFrame } from "@/components/clerk-widget-frame";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "注册｜苏肥鸭多邻国",
  description: "创建苏肥鸭多邻国账户后进入学习工作台；本机学习数据不会因注册而自动上传或同步。",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  const clerkState = getClerkRuntimeState();

  return (
    <AuthPage eyebrow="创建账户" title="建立你的学习入口。" lead="账户用于控制工作台与学习页面访问；浏览器里的学习记录仍保持本机存储，不会因注册自动绑定到身份。">
      {clerkState.configured ? (
        <ClerkWidgetFrame mode="sign-up" />
      ) : <ClerkUnavailablePanel reason={clerkState.reason} />}
    </AuthPage>
  );
}
