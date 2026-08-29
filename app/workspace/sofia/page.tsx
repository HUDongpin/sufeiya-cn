import type { Metadata } from "next";

import { SiteShell } from "@/components/site-shell";
import { SuperTeacherClient } from "@/components/super-teacher-client";

export const metadata: Metadata = {
  title: "Sofia 本机学习解释｜苏肥鸭多邻国",
  description: "受邀账户在当前浏览器内使用确定性的 Sofia 学习解释；不发送服务器、外部模型或远程人工队列。",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function WorkspaceSofiaPage() {
  return (
    <SiteShell pageKey="super-teacher" sofiaSurface="page">
      <SuperTeacherClient />
    </SiteShell>
  );
}
