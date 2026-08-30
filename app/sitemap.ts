import type { MetadataRoute } from "next";

import { CONTENT_RELEASE_MANIFEST } from "@/lib/content-release-manifest";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return CONTENT_RELEASE_MANIFEST.routes
    .filter((route) => route.sitemap)
    .map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: new Date(route.lastModified),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }));
}
