export const PUBLIC_ANALYTICS_EVENT_NAMES = [
  "reading_course_viewed",
  "reading_unit_started",
  "reading_unit_completed",
  "reading_review_viewed",
  "reading_review_completed",
  "sync_offer_viewed",
  "sync_consent_started",
] as const;

export type PublicAnalyticsEventName = (typeof PUBLIC_ANALYTICS_EVENT_NAMES)[number];

const exactPublicPaths = new Set([
  "/",
  "/learning-path",
  "/platform",
  "/resources",
  "/about",
  "/super-teacher",
  "/privacy",
  "/terms",
  "/support",
  "/learn/reading",
]);

const attributeValues = {
  unit_version: new Set(["reading-p0-v1"]),
  runtime_mode: new Set(["browser_local"]),
} as const;

export type PublicAnalyticsAttribute = keyof typeof attributeValues;
export type PublicAnalyticsProperties = Partial<Record<PublicAnalyticsAttribute, string>>;

type AnalyticsEventLike = {
  type: "pageview" | "event";
  url: string;
};

export function isPublicAnalyticsPath(pathname: string) {
  return exactPublicPaths.has(pathname);
}

export function sanitizePublicAnalyticsEvent<T extends AnalyticsEventLike>(event: T): T | null {
  let parsed: URL;
  try {
    parsed = new URL(event.url);
  } catch {
    return null;
  }
  if (
    parsed.origin !== "https://sufeiya.cn"
    || parsed.username
    || parsed.password
    || !isPublicAnalyticsPath(parsed.pathname)
  ) return null;

  return {
    ...event,
    url: `https://sufeiya.cn${parsed.pathname}`,
  };
}

export function sanitizePublicAnalyticsProperties(
  properties: Record<string, unknown> | undefined,
): PublicAnalyticsProperties | null {
  if (!properties) return {};
  const entries = Object.entries(properties);
  if (entries.length > 2) return null;

  const sanitized: PublicAnalyticsProperties = {};
  for (const [key, value] of entries) {
    if (!Object.hasOwn(attributeValues, key) || typeof value !== "string") return null;
    const attribute = key as PublicAnalyticsAttribute;
    if (!attributeValues[attribute].has(value)) return null;
    sanitized[attribute] = value;
  }
  return sanitized;
}

export function createPublicAnalyticsPayload({
  name,
  pathname,
  properties,
}: {
  name: PublicAnalyticsEventName;
  pathname: string;
  properties?: Record<string, unknown>;
}) {
  if (!PUBLIC_ANALYTICS_EVENT_NAMES.includes(name) || !isPublicAnalyticsPath(pathname)) {
    return null;
  }
  const sanitizedProperties = sanitizePublicAnalyticsProperties(properties);
  if (!sanitizedProperties) return null;
  return { name, properties: sanitizedProperties };
}
