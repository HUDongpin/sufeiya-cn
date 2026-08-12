import type { Metadata } from "next";

import {
  AuthPage,
  ClerkUnavailablePanel,
  InvitationOnlyPanel,
} from "@/components/auth-page";
import { ClerkWidgetFrame } from "@/components/clerk-widget-frame";
import { hasClerkInvitationTicket } from "@/lib/auth/beta-access";
import { getClerkRuntimeState } from "@/lib/auth/clerk-config";

export const metadata: Metadata = {
  title: "受邀注册｜苏肥鸭多邻国",
  description: "Sufeiya 邀请制内测账户入口；只有具有当前内测资格的账户才能进入学习工作台。",
  robots: { index: false, follow: false },
};

type SignUpSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignUpPage({ searchParams }: { searchParams: SignUpSearchParams }) {
  const clerkState = getClerkRuntimeState();
  const invitationTicketPresent = hasClerkInvitationTicket(
    (await searchParams).__clerk_ticket,
  );

  return (
    <AuthPage eyebrow="邀请制内测" title="通过邀请建立学习入口。" lead="带邀请票据参数的链接会进入 Clerk 验证流程；注册或登录后，Sufeiya 仍会从 Clerk 签名会话令牌核验学习区资格。首轮仅面向 18+ 成人，本机学习记录不会因注册自动绑定、上传或同步。">
      {!clerkState.configured ? (
        <ClerkUnavailablePanel reason={clerkState.reason} />
      ) : invitationTicketPresent ? (
        <div data-clerk-invitation-entry="ticket-present">
          <ClerkWidgetFrame mode="sign-up" />
        </div>
      ) : (
        <InvitationOnlyPanel />
      )}
    </AuthPage>
  );
}
