import { z } from "zod";

export const SUPER_TEACHER_PROTOCOL = "sufeiya_super_teacher_v1" as const;

export const skillSchema = z.enum(["Reading", "Listening", "Writing", "Speaking", "Balanced"]);

const compactText = (maximum: number) => z.string().trim().min(1).max(maximum);
const localId = z.string().trim().regex(/^[a-z][a-z0-9_-]{2,119}$/i);
const taskSetDigestSchema = z.literal("c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c");

const learnerPlanSchema = z
  .object({
    planId: localId,
    basePlanId: localId,
    cycleId: localId,
    diagnosticSessionId: localId,
    taskSetVersion: z.literal("gate_a_original_6_v1"),
    stage: z.enum(["base", "updated"]),
    focusSkill: skillSchema,
    dailyMinutes: z.number().int().min(10).max(180).optional(),
    currentTaskSkill: skillSchema.exclude(["Balanced"]).optional(),
  })
  .strict();

const learnerRecommendationSchema = z
  .object({
    recommendationId: localId,
    planId: localId,
    cycleId: localId,
    diagnosticSessionId: localId,
    status: z.enum(["accepted", "skipped"]),
  })
  .strict();

const learnerProgressSchema = z
  .object({
    checkInRecorded: z.boolean(),
    learnerReviewConfirmed: z.boolean(),
    retestRecorded: z.boolean(),
    updatedPlanConfirmed: z.boolean(),
    checkInId: localId.optional(),
    reviewId: localId.optional(),
    retestId: localId.optional(),
    updatedPlanId: localId.optional(),
  })
  .strict();

export const learnerContextSchema = z
  .object({
    protocolVersion: z.literal("gate_a_local_v1"),
    adultConfirmed: z.literal(true),
    summaryIntegrity: z.literal("unsigned_device_summary"),
    cycleId: localId,
    diagnosticSessionId: localId,
    taskSetVersion: z.literal("gate_a_original_6_v1"),
    taskSetDigest: taskSetDigestSchema,
    terminalEvidenceTaskCount: z.literal(6),
    prioritySkill: skillSchema.exclude(["Balanced"]),
    evidenceSufficiency: z.enum(["evidence_insufficient", "evidence_limited"]).optional(),
    evidenceConfidence: z.enum(["low", "medium"]).optional(),
    priorityBasis: z
      .enum([
        "objective_first_response_pattern",
        "evidence_quality_gap",
        "open_response_coverage_gap",
        "learner_confirmation_after_multiple_gaps",
        "learner_confirmation_after_tie",
      ])
      .optional(),
    completedEvidenceTaskCount: z.number().int().min(0).max(6).optional(),
    completedEvidenceSkills: z.array(skillSchema.exclude(["Balanced"])).max(4).optional(),
    plan: learnerPlanSchema.optional(),
    recommendation: learnerRecommendationSchema.optional(),
    progress: learnerProgressSchema.optional(),
  })
  .strict()
  .superRefine((context, issue) => {
    const add = (message: string, path: Array<string | number>) => issue.addIssue({ code: z.ZodIssueCode.custom, message, path });
    if (context.plan) {
      if (context.plan.cycleId !== context.cycleId) add("Plan cycle does not match diagnostic cycle.", ["plan", "cycleId"]);
      if (context.plan.diagnosticSessionId !== context.diagnosticSessionId) add("Plan session does not match diagnostic session.", ["plan", "diagnosticSessionId"]);
      if (context.plan.taskSetVersion !== context.taskSetVersion) add("Plan task set does not match diagnostic task set.", ["plan", "taskSetVersion"]);
    }
    if (context.recommendation) {
      if (!context.plan) add("Recommendation requires a validated plan.", ["recommendation"]);
      if (context.recommendation.cycleId !== context.cycleId) add("Recommendation cycle does not match diagnostic cycle.", ["recommendation", "cycleId"]);
      if (context.recommendation.diagnosticSessionId !== context.diagnosticSessionId) add("Recommendation session does not match diagnostic session.", ["recommendation", "diagnosticSessionId"]);
      if (context.plan && context.recommendation.planId !== context.plan.basePlanId) add("Recommendation does not reference the validated base plan.", ["recommendation", "planId"]);
    }
    const progress = context.progress;
    if (!progress) return;
    if (progress.checkInRecorded !== Boolean(progress.checkInId)) add("Check-in state and ID must agree.", ["progress", "checkInId"]);
    if (progress.learnerReviewConfirmed !== Boolean(progress.reviewId)) add("Review state and ID must agree.", ["progress", "reviewId"]);
    if (progress.retestRecorded !== Boolean(progress.retestId)) add("Retest state and ID must agree.", ["progress", "retestId"]);
    if (progress.updatedPlanConfirmed !== Boolean(progress.updatedPlanId)) add("Updated-plan state and ID must agree.", ["progress", "updatedPlanId"]);
    if (progress.checkInRecorded && !context.recommendation) add("Check-in progress requires a validated recommendation.", ["progress", "checkInRecorded"]);
    if (progress.learnerReviewConfirmed && !progress.checkInRecorded) add("Review progress requires a check-in.", ["progress", "learnerReviewConfirmed"]);
    if (progress.retestRecorded && !progress.learnerReviewConfirmed) add("Retest progress requires a confirmed review.", ["progress", "retestRecorded"]);
    if (progress.updatedPlanConfirmed && (!progress.retestRecorded || context.plan?.stage !== "updated" || context.plan.planId !== progress.updatedPlanId)) {
      add("Updated-plan progress requires the validated updated plan and retest.", ["progress", "updatedPlanConfirmed"]);
    }
  });

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

const sourceClassSchema = z.enum(["first_party_product_policy", "first_party_original_task", "learner_local_record"]);
const safeLocalHrefSchema = z.string().trim().max(240).refine(
  (href) => (href.startsWith("/") && !href.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(href)) || href === "#human-support",
  "Only safe same-site routes are accepted.",
);
const bilibiliHrefSchema = z.string().url().refine(
  (href) => /^https:\/\/www\.bilibili\.com\/video\/[A-Za-z0-9]+$/.test(href),
  "Only approved Bilibili video URLs are accepted.",
);

export const superTeacherResponseSchema = z
  .object({
    protocolVersion: z.literal(SUPER_TEACHER_PROTOCOL),
    requestId: z.string().uuid(),
    createdAt: z.string().datetime(),
    intent: teacherIntentSchema,
    mode: z.enum(["ai_grounded", "manual_grounded", "policy_refusal", "insufficient_sources", "handoff"]),
    modelAttempted: z.boolean(),
    headline: compactText(120),
    claims: z
      .array(
        z
          .object({
            text: compactText(320),
            citations: z
              .array(
                z
                  .object({
                    id: compactText(120),
                    title: compactText(180),
                    href: safeLocalHrefSchema,
                    sourceClass: sourceClassSchema,
                  })
                  .strict(),
              )
              .min(1)
              .max(3),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    limitations: z.array(compactText(260)).min(1).max(4),
    resources: z
      .array(
        z
          .object({
            id: compactText(120),
            title: compactText(200),
            href: bilibiliHrefSchema,
            duration: compactText(60),
            skills: z.array(compactText(40)).min(1).max(4),
          })
          .strict(),
      )
      .max(5),
    actions: z
      .array(
        z
          .object({
            label: compactText(140),
            href: safeLocalHrefSchema,
            kind: z.enum(["continue_without_ai", "learning", "resource", "handoff"]),
          })
          .strict(),
      )
      .max(4),
    handoffRecommended: z.boolean(),
    sourceBoundary: z
      .object({
        claimSourceCount: z.number().int().min(1).max(50),
        detOfficialSourcesAdmitted: z.literal(0),
        archivedKnowledgeChunksAdmitted: z.literal(0),
      })
      .strict(),
  })
  .strict();

export type SuperTeacherResponse = z.infer<typeof superTeacherResponseSchema>;
