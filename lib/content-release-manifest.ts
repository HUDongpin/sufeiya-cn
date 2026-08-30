import { z } from "zod";

import contentReleaseManifestJson from "@/data/content-release-manifest.v1.json";

export const CONTENT_RELEASE_MANIFEST_PROTOCOL = "sufeiya_content_release_manifest_v1" as const;

const timestampSchema = z.string().min(1).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "expected an ISO-compatible timestamp",
);
const routeSchema = z.object({
  path: z.string().regex(/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/),
  lastModified: timestampSchema,
  changeFrequency: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]),
  priority: z.number().min(0).max(1),
  sitemap: z.boolean(),
}).strict();

export const contentReleaseManifestSchema = z.object({
  protocolVersion: z.literal(CONTENT_RELEASE_MANIFEST_PROTOCOL),
  effectiveAt: timestampSchema,
  routes: z.array(routeSchema).min(1),
}).strict().superRefine((manifest, context) => {
  const paths = new Set<string>();
  manifest.routes.forEach((route, index) => {
    if (paths.has(route.path)) {
      context.addIssue({
        code: "custom",
        message: `duplicate content release route: ${route.path}`,
        path: ["routes", index, "path"],
      });
    }
    paths.add(route.path);
  });
});

export type ContentReleaseManifestV1 = z.infer<typeof contentReleaseManifestSchema>;

export function parseContentReleaseManifest(candidate: unknown): ContentReleaseManifestV1 {
  const parsed = contentReleaseManifestSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("Invalid Sufeiya content release manifest");
  return parsed.data;
}

export const CONTENT_RELEASE_MANIFEST = Object.freeze(
  parseContentReleaseManifest(contentReleaseManifestJson),
);
