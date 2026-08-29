"use client";

import { track } from "@vercel/analytics";

import {
  createPublicAnalyticsPayload,
  type PublicAnalyticsEventName,
} from "@/lib/public-analytics-policy";

export function trackPublicAnalyticsEvent(
  name: PublicAnalyticsEventName,
  properties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return false;
  const payload = createPublicAnalyticsPayload({
    name,
    pathname: window.location.pathname,
    properties,
  });
  if (!payload) return false;

  try {
    track(payload.name, payload.properties);
    return true;
  } catch {
    // Analytics must never interrupt learning or data-management actions.
    return false;
  }
}
