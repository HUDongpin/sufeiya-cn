import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "我的账户｜苏肥鸭多邻国",
  description: "管理苏肥鸭多邻国账户；学习记录仍只保存在当前浏览器。",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const clerkState = getClerkRuntimeState();

  if (!clerkState.configured) {
    return (
      <AuthPage eyebrow="账户" title="账户服务尚未配置。" lead="受保护页面保持关闭，已有的本机学习数据不会被改动。">
        <ClerkUnavailablePanel reason={clerkState.reason} />
      </AuthPage>
    );
  }

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/account" });

  return (
    <AuthPage eyebrow="账户" title="管理你的账户。" lead="你可以在这里管理登录身份；学习闭环与 Sofia 对话仍保存在当前浏览器，不会自动上传或跨设备同步。">
      <div className="account-profile-wrap">
        <UserProfile
          routing="path"
          path="/account"
          appearance={{ elements: { rootBox: { width: "100%" } } }}
        />
      </div>
    </AuthPage>
  );
}
