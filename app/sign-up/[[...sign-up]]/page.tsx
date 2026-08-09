import type { Metadata } from "next";

import { AuthPage, LocalOnlyAccountPanel } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "免注册学习｜苏肥鸭多邻国",
  description: "当前 Gate A 学习工具无需注册，学习数据只保存在当前浏览器。",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthPage eyebrow="阶段说明" title="现在不用建立账户。" lead="当前 Gate A 采用免注册、本机保存模式；账户与云端档案将在真实数据阶段前完成治理后再开放。">
      <LocalOnlyAccountPanel />
    </AuthPage>
  );
}
