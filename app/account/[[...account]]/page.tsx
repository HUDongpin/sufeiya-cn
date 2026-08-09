import type { Metadata } from "next";

import { AuthPage, LocalOnlyAccountPanel } from "@/components/auth-page";

export const metadata: Metadata = {
  title: "账户功能说明｜苏肥鸭多邻国",
  description: "账户与云端档案暂缓开放；当前 Gate A 采用免登录、本机保存模式。",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <AuthPage eyebrow="账户" title="账户功能后续开放。" lead="本阶段不建立学生账户，也不把本机学习记录绑定到身份；你仍可完整使用 Gate A 七步闭环。">
      <LocalOnlyAccountPanel />
    </AuthPage>
  );
}
