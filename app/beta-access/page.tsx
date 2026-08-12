import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AuthPage,
  ClerkUnavailablePanel,
  InvitationOnlyPanel,
} from "@/components/auth-page";
import {
  betaAccessContextFromHeader,
  SUFEIYA_BETA_ACCESS_CONTEXT_HEADER,
} from "@/lib/auth/beta-access";
import {
  getClerkRuntimeState,
  isClerkBetaProtectedPathname,
} from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "邀请制内测｜苏肥鸭多邻国",
  description: "核验 Sufeiya 邀请制内测访问资格。",
  robots: { index: false, follow: false },
};

type BetaAccessSearchParams = Promise<Record<string, string | string[] | undefined>>;

function safeReturnPath(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.length > 256) return "/workspace";
  return isClerkBetaProtectedPathname(value) ? value : "/workspace";
}

export default async function BetaAccessPage({
  searchParams,
}: {
  searchParams: BetaAccessSearchParams;
}) {
  const clerkState = getClerkRuntimeState();
  const returnPath = safeReturnPath((await searchParams).return_path);

  if (!clerkState.configured) {
    return (
      <AuthPage
        eyebrow="邀请制内测"
        title="内测资格核验暂时关闭。"
        lead="账户配置不完整时，学习页面保持关闭；本机学习记录不会被读取、上传或改动。"
      >
        <ClerkUnavailablePanel reason={clerkState.reason} />
      </AuthPage>
    );
  }

  const requestHeaders = await headers();
  const accessContext = betaAccessContextFromHeader(
    requestHeaders.get(SUFEIYA_BETA_ACCESS_CONTEXT_HEADER),
  );

  if (accessContext === "approved") redirect(returnPath);

  if (accessContext === "signed_out") {
    return (
      <AuthPage
        eyebrow="邀请制内测"
        title="先登录受邀账户。"
        lead="项目方发出的邀请会为账户写入当前版本的内测准入标记；Sufeiya 从 Clerk 签名会话令牌核验该标记。首轮仅面向 18+ 成人，普通账户或伪造参数不能打开学习页面。"
      >
        <section className="account-deferred-card" data-beta-access-state="signed-out">
          <p className="account-mode-kicker">CLERK · SIGN-IN REQUIRED</p>
          <h2>登录后核验邀请资格。</h2>
          <p>如果你已经通过邀请创建账户，请登录同一个账户。尚未收到邀请的访客可以继续浏览公开页面。</p>
          <div className="account-deferred-actions">
            <Link className="tool-action" href={`/sign-in?redirect_url=${encodeURIComponent(`/beta-access?return_path=${returnPath}`)}`}>安全登录受邀账户</Link>
            <Link className="text-link" href="/">返回公开首页 →</Link>
          </div>
          <small>登录只用于身份与访问控制；当前浏览器里的学习数据仍不会自动绑定到账户或跨设备同步。</small>
        </section>
      </AuthPage>
    );
  }

  return (
    <AuthPage
      eyebrow="邀请制内测"
      title={accessContext === "invitation_required" ? "当前没有有效内测资格。" : "正在等待资格服务恢复。"}
      lead="学习页面在服务器确认当前账户具有有效邀请资格前保持关闭；公开页面和账户管理仍可使用。"
    >
      <InvitationOnlyPanel
        mode={accessContext === "invitation_required" ? "waiting" : "verification-unavailable"}
      />
    </AuthPage>
  );
}
