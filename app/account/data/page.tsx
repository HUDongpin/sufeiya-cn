import type { Metadata } from "next";
import { FullDocumentLink } from "@/components/full-document-link";

import { AuthPage } from "@/components/auth-page";
import { CAPABILITY_MATRIX } from "@/lib/capability-matrix";

export const metadata: Metadata = {
  title: "账户与云端数据｜苏肥鸭多邻国",
  description: "查看 Sufeiya 可选账户同步与云端数据治理状态。",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccountDataPage() {
  const capability = CAPABILITY_MATRIX.capabilities.find(
    (entry) => entry.id === "optional_account_sync",
  );
  if (!capability || capability.status !== "intentionally_blocked") {
    throw new Error("Optional account sync must remain intentionally blocked");
  }
  return (
    <AuthPage
      eyebrow="账户与云端数据"
      title="云端学习数据服务保持关闭。"
      lead="这里未来只管理明确同意后的账户同步、云端导出、解除同步与云端删除；本机数据仍由无需登录的“我的本机数据”页面单独管理。"
    >
      <section
        className="account-deferred-card"
        aria-labelledby="account-data-cloud-sync-title"
        data-service-state="governance-hold"
        data-service-reason={capability.releaseGate}
      >
        <p className="account-mode-kicker">OPTIONAL CLOUD SYNC · NOT RELEASED</p>
        <h2 id="account-data-cloud-sync-title">账户同步与云端数据操作尚未开放。</h2>
        <p>{capability.publicSummary}</p>
        <p><strong>当前数据行为：</strong>不会读取本机学习 namespace，不会联系 api.sufeiya.cn，也不会修改或删除本机数据。</p>
        <p><FullDocumentLink href="/my-data">无需登录管理当前浏览器中的本机数据</FullDocumentLink></p>
        <small>当前页面没有同步、云端导出、解除同步或云端删除控件；页面可见不代表服务已发布。</small>
      </section>
    </AuthPage>
  );
}
