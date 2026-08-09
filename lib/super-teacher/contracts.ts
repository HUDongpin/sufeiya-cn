import { z } from "zod";

export const SUPER_TEACHER_PROTOCOL = "sufeiya_super_teacher_v1" as const;

export const skillSchema = z.enum(["Reading", "Listening", "Writing", "Speaking", "Balanced"]);

const compactText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const learnerContextSchema = z
  .object({
    protocolVersion: z.literal("gate_a_local_v1"),
    adultConfirmed: z.literal(true),
    prioritySkill: skillSchema.optional(),
    evidenceSufficiency: z.enum(["evidence_insufficient", "evidence_limited"]).optional(),
    completedEvidenceSkills: z.array(skillSchema.exclude(["Balanced"])).max(4).optional(),
    plan: z
      .object({
        focusSkill: skillSchema,
        dailyMinutes: z.number().int().min(10).max(180).optional(),
        currentTaskSkill: skillSchema.exclude(["Balanced"]).optional(),
      })
      .strict()
      .optional(),
    recommendation: z
      .object({
        status: z.enum(["pending", "accepted", "skipped"]),
      })
      .strict()
      .optional(),
    progress: z
      .object({
        checkInRecorded: z.boolean(),
        learnerReviewConfirmed: z.boolean(),
        retestRecorded: z.boolean(),
        updatedPlanConfirmed: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const superTeacherRequestSchema = z
  .object({
    protocolVersion: z.literal(SUPER_TEACHER_PROTOCOL),
    consent: z.literal(true),
    question: compactText(600),
    learnerContext: learnerContextSchema,
  })
  .strict();

export const teacherIntentSchema = z.enum([
  "why_priority",
  "explain_plan",
  "explain_recommendation",
  "validate_progress",
  "resource_navigation",
  "explain_limits",
  "integrity_boundary",
  "source_review_required",
  "handoff",
  "prompt_injection",
  "sensitive_data",
  "unsupported",
]);

export type TeacherIntent = z.infer<typeof teacherIntentSchema>;
export type LearnerContext = z.infer<typeof learnerContextSchema>;
export type SuperTeacherRequest = z.infer<typeof superTeacherRequestSchema>;

export const modelTeacherOutputSchema = z
  .object({
    headline: compactText(80).describe("A concise Chinese heading for the answer."),
    claims: z
      .array(
        z
          .object({
            text: compactText(260).describe("One complete Chinese claim supported by every listed source ID."),
            sourceIds: z.array(compactText(100)).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    limitations: z.array(compactText(220)).min(1).max(3),
    handoffRecommended: z.boolean(),
  })
  .strict();

export type ModelTeacherOutput = z.infer<typeof modelTeacherOutputSchema>;

export type GroundingSource = {
  id: string;
  title: string;
  href: string;
  sourceClass: "first_party_product_policy" | "first_party_original_task" | "learner_local_record";
  content: string;
};

export type LinkOnlyResource = {
  id: string;
  title: string;
  href: string;
  duration: string;
  skills: string[];
};

export type GroundingBundle = {
  sources: GroundingSource[];
  resources: LinkOnlyResource[];
};

export type TeacherCitation = Pick<GroundingSource, "id" | "title" | "href" | "sourceClass">;

export type TeacherClaim = {
  text: string;
  citations: TeacherCitation[];
};

export type TeacherAction = {
  label: string;
  href: string;
  kind: "continue_without_ai" | "learning" | "resource" | "handoff";
};

export type TeacherResponseMode =
  | "ai_grounded"
  | "manual_grounded"
  | "policy_refusal"
  | "insufficient_sources"
  | "handoff";

export type SuperTeacherResponse = {
  protocolVersion: typeof SUPER_TEACHER_PROTOCOL;
  requestId: string;
  createdAt: string;
  intent: TeacherIntent;
  mode: TeacherResponseMode;
  modelAttempted: boolean;
  headline: string;
  claims: TeacherClaim[];
  limitations: string[];
  resources: LinkOnlyResource[];
  actions: TeacherAction[];
  handoffRecommended: boolean;
  sourceBoundary: {
    claimSourceCount: number;
    detOfficialSourcesAdmitted: 0;
    archivedKnowledgeChunksAdmitted: 0;
  };
};
