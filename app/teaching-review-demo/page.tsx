import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthPage, ClerkUnavailablePanel } from "@/components/auth-page";
import { SiteShell } from "@/components/site-shell";
import { TeachingReviewDemoClient } from "@/components/teaching-review-demo-client";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";
import { evaluateReleaseSurface } from "@/lib/release-governance";

export const metadata: Metadata = {
  title: "Gate A 教研复核演示台｜苏肥鸭多邻国",
  description: "Clerk 保护的浏览器本机教研复核交互演示；只读查看证据并保存独立草稿，不代表真实教师审核。",
  robots: { index: false, follow: false },
};

function GovernanceHold({ reasonCode }: { reasonCode: string }) {
  return (
    <section className="account-deferred-card" aria-labelledby="teaching-review-hold-title">
      <p className="account-mode-kicker">RELEASE GOVERNANCE · DEFAULT DENY</p>
      <h2 id="teaching-review-hold-title">教研复核演示暂未开放。</h2>
      <p>当前发布登记表没有放行本机教研演示面，或其复核日期已经失效。页面不会挂载证据读取器或草稿控件。</p>
      <div className="account-deferred-actions">
        <Link className="tool-action" href="/workspace">返回学习工作台</Link>
        <Link className="text-link" href="/api/governance/status" target="_blank">查看脱敏治理状态 →</Link>
      </div>
      <small>治理代码：{reasonCode}。真实教研身份、人工队列、管理员写入与正式复核回执仍是独立发布闸门。</small>
    </section>
  );
}

export default async function TeachingReviewDemoPage() {
  const clerkState = getClerkRuntimeState();
  if (!clerkState.configured) {
    return (
      <AuthPage
        eyebrow="教研复核演示"
        title="受保护演示页面暂时关闭。"
        lead="此页面要求 Clerk 登录；配置不完整时不会显示本机证据或草稿控件。"
      >
        <ClerkUnavailablePanel reason={clerkState.reason} />
      </AuthPage>
    );
  }

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/teaching-review-demo" });

  const governance = evaluateReleaseSurface("local_teaching_review_demo");
  if (!governance.enabled) {
    return (
      <AuthPage
        eyebrow="教研复核演示"
        title="发布治理保持默认拒绝。"
        lead="登录只证明账户访问；本机演示面还必须通过当前版本的发布决策登记表。"
      >
        <GovernanceHold reasonCode={governance.reasonCode} />
      </AuthPage>
    );
  }

  return (
    <SiteShell pageKey="workspace" sofiaSurface="none">
      <TeachingReviewDemoClient />
    </SiteShell>
  );
}
