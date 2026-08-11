/* Full-document links intentionally reload the legacy learning runtimes. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";
import type { ClerkRuntimeState } from "@/lib/auth/clerk-config";

export function AuthPage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return (
    <SiteShell pageKey="auth" sofiaSurface="none">
      <main id="main-content" className="auth-page">
        <section className="auth-page-inner" aria-labelledby="auth-page-title">
          <div className="auth-intro">
            <p className="page-label"><span>账户</span>{eyebrow}</p>
            <h1 id="auth-page-title">{title}</h1>
            <p>{lead}</p>
            <div className="auth-privacy-note">
              <strong>账户与学习数据边界</strong>
              <p>登录不会自动迁移、上传或绑定当前浏览器中的计划、练习草稿、专注记录、复盘或 Sofia 对话；这些数据仍只保存在本机，也不会自动跨设备同步。</p>
              <p><strong>共享设备提示：</strong>这是设备工作区，不是账户工作区。同一浏览器中下一位已登录使用者可能读取这台设备保留的记录；交接设备前请前往“我的本机数据”导出或明确清除。</p>
            </div>
          </div>
          <div className="auth-component-wrap">{children}</div>
        </section>
      </main>
    </SiteShell>
  );
}

const configurationMessages: Record<ClerkRuntimeState["reason"], string> = {
  configured: "账户服务已配置，请刷新页面后重试。",
  missing_keys: "当前环境尚未提供成对的 Clerk 发布密钥与服务端密钥。",
  invalid_publishable_key: "当前 Clerk 发布密钥未通过格式校验。",
  invalid_secret_key: "当前 Clerk 服务端密钥未通过格式校验。",
  instance_mismatch: "当前 Clerk 发布密钥与服务端密钥不属于同一环境。",
};

export function ClerkUnavailablePanel({ reason }: { reason: ClerkRuntimeState["reason"] }) {
  return (
    <section className="account-deferred-card" aria-labelledby="account-mode-title">
      <p className="account-mode-kicker">CLERK · SAFE CONFIGURATION HOLD</p>
      <h2 id="account-mode-title">账户服务暂不可用。</h2>
      <p>
        {configurationMessages[reason]} 为避免未认证访问，工作台与学习数据页面保持关闭；这不是登录失败，也不会改动你浏览器中已有的本机记录。
      </p>
      <div className="account-deferred-actions">
        <a className="tool-action" href="/">返回公开首页</a>
        <a className="text-link" href="/super-teacher">使用公开的 Sofia 智能老师 →</a>
      </div>
      <small>请由站点管理员在部署环境完成 Clerk 配置。本页不会显示密钥，也不会自动上传、迁移或绑定学习数据。</small>
    </section>
  );
}
