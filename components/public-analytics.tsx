"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

import {
  isPublicAnalyticsPath,
  sanitizePublicAnalyticsEvent,
} from "@/lib/public-analytics-policy";

export function PublicAnalytics({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  if (!enabled || !isPublicAnalyticsPath(pathname)) return null;

  return (
    <Analytics beforeSend={sanitizePublicAnalyticsEvent} />
  );
}
