import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "我的账户｜苏肥鸭多邻国",
  description: "管理苏肥鸭多邻国账户资料和安全设置。",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=%2Faccount");

  return (
    <SiteShell pageKey="account">
      <main id="main-content" className="account-page">
        <section className="account-page-inner" aria-labelledby="account-title">
          <div className="account-heading">
            <p className="page-label"><span>账户</span>个人中心</p>
            <h1 id="account-title">我的账户</h1>
            <p>在这里管理个人资料与账户安全。学习数据仍保存在当前浏览器，不会因为登录而自动上传或覆盖。</p>
          </div>
          <div className="account-profile-wrap">
            <UserProfile routing="path" path="/account" />
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
