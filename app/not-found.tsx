import type { Metadata } from "next";

import { LegacyPage } from "@/components/legacy-page";

export const metadata: Metadata = {
  title: "页面没有找到｜苏肥鸭多邻国",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  // Static files bypass Clerk middleware. Keep the shared 404 shell useful,
  // but render anonymous account links so a missing asset never requests auth.
  return <LegacyPage pageKey="not-found" authAware={false} />;
}
