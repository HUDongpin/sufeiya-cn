import type { MetadataRoute } from "next";

import { legacyPages, publicPageKeys } from "@/lib/legacy-content.generated";
import { SITE_URL } from "@/lib/site";

const priorities: Record<string, number> = {
  home: 1,
  workspace: 1,
  diagnostic: 0.9,
  plan: 0.9,
  recommendations: 0.9,
  today: 0.9,
  practice: 0.9,
  "practice-reading": 0.8,
  "practice-listening": 0.8,
  "practice-writing": 0.8,
  "practice-speaking": 0.8,
  focus: 0.8,
  "check-in": 0.8,
  review: 0.8,
  community: 0.8,
  retest: 0.9,
  "my-data": 0.5,
  "learning-path": 0.9,
  platform: 0.9,
  resources: 0.9,
  about: 0.8,
};

const frequencies: Record<string, MetadataRoute.Sitemap[number]["changeFrequency"]> = {
  home: "weekly",
  workspace: "weekly",
  diagnostic: "weekly",
  plan: "weekly",
  recommendations: "weekly",
  today: "daily",
  practice: "weekly",
  "check-in": "weekly",
  review: "weekly",
  community: "weekly",
  retest: "weekly",
  resources: "weekly",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const legacyEntries: MetadataRoute.Sitemap = publicPageKeys.map((key) => ({
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
