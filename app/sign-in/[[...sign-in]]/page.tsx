import type { Metadata } from "next";

import { AuthPage, LocalOnlyAccountPanel } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "免登录学习｜苏肥鸭多邻国",
  description: "当前 Gate A 学习工具无需登录，学习数据只保存在当前浏览器。",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthPage eyebrow="阶段说明" title="先把学习闭环做好。" lead="Clerk 账户接入已延后；当前 Gate A 可以直接进入工作台，不需要登录或注册。">
      <LocalOnlyAccountPanel />
    </AuthPage>
  );
}
