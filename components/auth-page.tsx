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
              <strong>学习数据仍由你掌握</strong>
              <p>注册账户不会自动上传或覆盖当前浏览器中的计划、练习草稿、专注记录与复盘。</p>
            </div>
          </div>
          <div className="auth-component-wrap">{children}</div>
        </section>
      </main>
    </SiteShell>
  );
}
