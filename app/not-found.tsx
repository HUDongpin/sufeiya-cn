import type { Metadata } from "next";

import { AnonymousNotFoundPage } from "@/components/anonymous-legacy-page";

export const metadata: Metadata = {
  title: "页面没有找到｜苏肥鸭多邻国",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  // Static files bypass Clerk middleware. This route uses a Clerk-free module
  // graph so a missing asset cannot initialize account or Sofia runtimes.
  return <AnonymousNotFoundPage />;
}
