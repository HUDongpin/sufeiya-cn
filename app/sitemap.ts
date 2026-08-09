import type { MetadataRoute } from "next";

import { legacyPages, type LegacyPageKey } from "@/lib/legacy-content.generated";
import { SITE_URL } from "@/lib/site";

const sitemapPageKeys = ["home", "learning-path", "platform", "resources", "about"] as const satisfies readonly LegacyPageKey[];

const priorities: Record<string, number> = {
  home: 1,
  "learning-path": 0.9,
  platform: 0.9,
  resources: 0.9,
  about: 0.8,
};

const frequencies: Record<string, MetadataRoute.Sitemap[number]["changeFrequency"]> = {
  home: "weekly",
  resources: "weekly",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const legacyEntries: MetadataRoute.Sitemap = sitemapPageKeys.map((key) => ({
    url: `${SITE_URL}${legacyPages[key].path === "/" ? "/" : legacyPages[key].path}`,
    lastModified: new Date("2026-08-09T00:00:00+08:00"),
    changeFrequency: frequencies[key] ?? "monthly",
    priority: priorities[key] ?? 0.8,
  }));

  return [
    ...legacyEntries,
    {
      url: `${SITE_URL}/super-teacher`,
      lastModified: new Date("2026-08-09T00:00:00+08:00"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
