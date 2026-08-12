import { z } from "zod";

export const SUPER_TEACHER_PROTOCOL = "sufeiya_super_teacher_v1" as const;
export const SUPER_TEACHER_STATUS_PROTOCOL = "sufeiya_super_teacher_status_v4" as const;

export const skillSchema = z.enum(["Reading", "Listening", "Writing", "Speaking", "Balanced"]);

const compactText = (maximum: number) => z.string().trim().min(1).max(maximum);
const localId = z.string().trim().regex(/^[a-z][a-z0-9_-]{2,119}$/i);
const taskSetDigestSchema = z.literal("c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c");

const releaseReasonCodeSchema = z.enum([
  "allowed_for_declared_scope",
  "decision_not_approved",
  "implementation_not_ready",
  "register_review_not_current",
  "register_review_expired",
  "review_not_current",
  "review_expired",
  "binding_mismatch",
]);

export const superTeacherStatusResponseSchema = z.object({
  protocolVersion: z.literal(SUPER_TEACHER_STATUS_PROTOCOL),
  interactionProtocolVersion: z.literal(SUPER_TEACHER_PROTOCOL),
  status: z.literal("gate_a_limited"),
  answerMode: z.enum(["grounded_ai_with_local_manual_fallback", "local_manual_grounded"]),
  localManualExplanationEnabled: z.literal(true),
  firstPartyServerProcessingEnabled: z.boolean(),
  externalModelProcessingEnabled: z.boolean(),
  modelGenerationEnabled: z.boolean(),
  modelConfigurationPresent: z.boolean(),
  modelProvider: z.enum(["gateway", "dashscope"]).nullable(),
  model: z.string().trim().min(1).max(160).nullable(),
  modelRegion: z.enum(["beijing", "singapore"]).nullable(),
  releaseGovernance: z.object({
    protocolVersion: z.literal("sufeiya_release_decisions_v1"),
    status: z.enum(["approved", "blocked"]),
    reasonCode: releaseReasonCodeSchema,
    blockedDecisionIds: z.array(z.string().regex(/^[a-z][a-z0-9_]{2,79}$/)).max(100),
    blockedBindingIds: z.array(z.string().regex(/^[a-z][a-z0-9_.]{2,159}$/)).max(100),
  }).strict(),
  teacherSurfaceAccess: z.literal("public_teaser"),
  interactiveTeacherAccess: z.literal("clerk_invitation_approved"),
  modelSubmitAccess: z.enum(["clerk_invitation_approved", "disabled_pending_first_party_processing_approval"]),
  learningPageAccess: z.literal("clerk_invitation_approved"),
  learningDataStorage: z.literal("browser_local_not_account_bound"),
  sourceBoundary: z.object({
    gateAStaticClaimSources: z.number().int().min(0).max(1_000),
    linkOnlyResources: z.number().int().min(0).max(1_000),
    detOfficialSourcesAdmitted: z.literal(0),
    archivedKnowledgeChunksAdmitted: z.literal(0),
  }).strict(),
}).strict().superRefine((status, context) => {
  const configurationFieldsPresent = Boolean(status.modelProvider && status.model);
  if (status.modelConfigurationPresent !== configurationFieldsPresent) {
    context.addIssue({
      code: "custom",
      message: "model configuration status does not match the disclosed provider and model",
      path: ["modelConfigurationPresent"],
    });
  }
  if (status.modelProvider === "dashscope" && !status.modelRegion) {
    context.addIssue({
      code: "custom",
      message: "DashScope status requires its configured region",
      path: ["modelRegion"],
    });
  }
  if (status.modelProvider !== "dashscope" && status.modelRegion) {
    context.addIssue({
      code: "custom",
      message: "only DashScope status may disclose a model region",
      path: ["modelRegion"],
    });
  }
  if (
    status.modelGenerationEnabled !== (status.releaseGovernance.status === "approved") ||
    status.modelGenerationEnabled !== (status.answerMode === "grounded_ai_with_local_manual_fallback") ||
    status.modelGenerationEnabled !== status.externalModelProcessingEnabled ||
    (status.modelGenerationEnabled && !status.modelConfigurationPresent)
  ) {
    context.addIssue({
      code: "custom",
      message: "model generation, answer mode, configuration, and release governance are inconsistent",
      path: ["modelGenerationEnabled"],
    });
  }
  if (status.externalModelProcessingEnabled && !status.firstPartyServerProcessingEnabled) {
    context.addIssue({
      code: "custom",
      message: "external model processing requires approved first-party server processing",
      path: ["externalModelProcessingEnabled"],
    });
  }
  const expectedSubmitAccess = status.firstPartyServerProcessingEnabled
    ? "clerk_invitation_approved"
    : "disabled_pending_first_party_processing_approval";
  if (status.modelSubmitAccess !== expectedSubmitAccess) {
    context.addIssue({
      code: "custom",
      message: "submit access does not match first-party server processing governance",
      path: ["modelSubmitAccess"],
    });
  }
});

export type SuperTeacherStatusResponse = z.infer<typeof superTeacherStatusResponseSchema>;

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

const approvedOutputId = (prefix: string, maximum: number) => z
  .string()
  .regex(new RegExp(`^${prefix}-[1-${maximum}]$`));

export const modelTeacherSelectionSchema = z
  .object({
    headlineId: approvedOutputId("headline", 1),
    claimIds: z.array(approvedOutputId("claim", 4)).min(1).max(4),
    limitationIds: z.array(approvedOutputId("limitation", 3)).min(1).max(3),
  })
  .strict();

export type ModelTeacherSelection = z.infer<typeof modelTeacherSelectionSchema>;

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
