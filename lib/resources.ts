import { z } from "zod";

import resourcesJson from "@/data/resources.json";

export const RESOURCE_SKILL_FILTERS = [
  "all",
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
  "General",
] as const;

export type ResourceSkillFilter = (typeof RESOURCE_SKILL_FILTERS)[number];

export const RESOURCE_REQUIRED_EDIT_CODES = [
  "current_exam_contract",
  "historical_exam_label",
  "neutralize_source_title_claim",
  "external_material_availability_rights",
  "exam_integrity",
  "language_accuracy",
  "task_timing_and_rubric",
  "unsupported_frequency_claim",
  "link_rights",
] as const;

const resourceRequiredEditCodeSchema = z.enum(RESOURCE_REQUIRED_EDIT_CODES);

const resourceSchema = z.object({
  id: z.string().regex(/^BV[A-Za-z0-9]+$/),
  title: z.string().min(1).max(300),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationText: z.string().min(1).max(80),
  skills: z.array(z.string().min(1).max(80)).min(1).max(8),
  type: z.string().min(1).max(80),
  source: z.string().min(1).max(160),
  reviewDisposition: z.literal("requires_edit"),
  reviewStatus: z.literal("teacher_reviewed_requires_remediation"),
  reviewedAt: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    "expected a UTC review timestamp",
  ),
  examVersionDisposition: z.enum([
    "current_contract_update_required",
    "historical_update_required",
    "general_language_update_required",
  ]),
  linkStatus: z.literal("blocked_pending_edit"),
  requiredEditCodes: z.array(resourceRequiredEditCodeSchema).min(1).max(
    RESOURCE_REQUIRED_EDIT_CODES.length,
  ),
  reviewNote: z.string().min(1).max(500),
}).strict();

const resourceCatalogSchema = z.array(resourceSchema).min(1).superRefine((resources, context) => {
  const ids = new Set<string>();
  resources.forEach((resource, index) => {
    if (ids.has(resource.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate resource: ${resource.id}`,
        path: [index, "id"],
      });
    }
    ids.add(resource.id);
  });
});

export type LearningResource = z.infer<typeof resourceSchema>;

export function parseResourceCatalog(candidate: unknown) {
  const parsed = resourceCatalogSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("Invalid public resource catalog");
  return parsed.data;
}

export const RESOURCE_CATALOG = Object.freeze(parseResourceCatalog(resourcesJson));

export function parseResourceFilters(searchParams: {
  query?: string | string[];
  skill?: string | string[];
}) {
  const rawQuery = typeof searchParams.query === "string" ? searchParams.query : "";
  const query = rawQuery.trim().slice(0, 120);
  const skill = typeof searchParams.skill === "string"
    && RESOURCE_SKILL_FILTERS.includes(searchParams.skill as ResourceSkillFilter)
    ? searchParams.skill as ResourceSkillFilter
    : "all";
  return { query, skill };
}

function matchesSkill(resource: LearningResource, skill: ResourceSkillFilter) {
  if (skill === "all") return true;
  if (skill === "General") {
    return resource.skills.some((value) => ["考试概览", "Vocabulary"].includes(value));
  }
  return resource.skills.includes(skill);
}

export function filterResources({
  resources = RESOURCE_CATALOG,
  query,
  skill,
}: {
  resources?: readonly LearningResource[];
  query: string;
  skill: ResourceSkillFilter;
}) {
  const normalizedQuery = query.toLocaleLowerCase("zh-CN");
  return resources.filter((resource) => {
    const searchable = [resource.title, resource.type, resource.reviewNote, ...resource.skills]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && matchesSkill(resource, skill);
  });
}

export function splitLegacyResourcesMain(mainHtml: string) {
  const openingMain = '<main id="main-content">';
  const browserStartMarker = '<section class="resource-browser section"';
  const followingSectionMarker = '<section class="resources section resources-page"';
  const trimmed = mainHtml.trim();
  if (!trimmed.startsWith(openingMain) || !trimmed.endsWith("</main>")) {
    throw new Error("Legacy resources main has an unexpected outer structure");
  }
  const content = trimmed.slice(openingMain.length, -"</main>".length);
  const browserStart = content.indexOf(browserStartMarker);
  const followingSectionStart = content.indexOf(followingSectionMarker, browserStart);
  if (browserStart < 0 || followingSectionStart < 0) {
    throw new Error("Legacy resources main is missing the catalog boundary");
  }
  return {
    beforeCatalogHtml: content.slice(0, browserStart),
    afterCatalogHtml: content.slice(followingSectionStart),
  };
}
