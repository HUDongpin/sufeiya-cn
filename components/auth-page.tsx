/* Full-document links intentionally reload the legacy learning runtimes. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";

export function AuthPage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return (
    <SiteShell pageKey="auth">
      <main id="main-content" className="auth-page">
        <section className="auth-page-inner" aria-labelledby="auth-page-title">
          <div className="auth-intro">
            <p className="page-label"><span>账户</span>{eyebrow}</p>
            <h1 id="auth-page-title">{title}</h1>
            <p>{lead}</p>
            <div className="auth-privacy-note">
              <strong>Gate A 数据边界</strong>
              <p>计划、练习草稿、专注记录与复盘只保存在当前浏览器，不会自动上传，也不会跨设备同步。</p>
            </div>
          </div>
          <div className="auth-component-wrap">{children}</div>
        </section>
      </main>
    </SiteShell>
  );
}

export function LocalOnlyAccountPanel() {
  return (
    <section className="account-deferred-card" aria-labelledby="account-mode-title">
      <p className="account-mode-kicker">GATE A · LOCAL ONLY</p>
      <h2 id="account-mode-title">现在无需登录。</h2>
      <p>
        当前阶段先验证诊断、计划、推荐、打卡、复盘、社区状态和微复测这条学习闭环。账户、云端学习档案与跨设备同步将在进入真实数据阶段前另行启用。
      </p>
      <div className="account-deferred-actions">
        <a className="tool-action" href="/workspace">直接进入学习工作台</a>
        <a className="text-link" href="/my-data">查看或导出本机数据 →</a>
      </div>
      <small>本页不创建账户，也不上传姓名、答案、作文、录音或复盘。</small>
    </section>
  );
}
