import { createHash } from "node:crypto";

import { z } from "zod";

import contentGovernanceRegisterJson from "@/data/content-governance.v2.json";
import sourceRegisterJson from "@/data/super-teacher-source-register.json";
import {
  BLOCKING_SAFETY_FLAGS,
  evaluateRagAdmission,
  parseContentGovernanceRegister,
} from "@/lib/content-governance";
import type {
  GroundingBundle,
  GroundingSource,
  LearnerContext,
  LinkOnlyResource,
  TeacherIntent,
} from "@/lib/super-teacher/contracts";

const claimSourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    href: z.string().regex(/^\/(?:[a-z0-9-]+)?(?:#[a-z0-9-]+)?$/),
    sourceClass: z.enum(["first_party_product_policy", "first_party_original_task"]),
    admissionStatus: z.literal("product_policy_allowed"),
    content: z.string().min(1),
    allowedIntents: z.array(z.string()).min(1),
  })
  .strict();

const linkOnlyResourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    href: z.string().url(),
    duration: z.string().min(1),
    skills: z.array(z.string().min(1)).min(1),
    admissionStatus: z.literal("catalog_link_only"),
    restriction: z.string().min(1),
  })
  .strict();

const registerSchema = z
  .object({
    protocolVersion: z.literal("sufeiya_super_teacher_sources_v1"),
    admittedAt: z.string().min(1),
    admissionBoundary: z.string().min(1),
    claimSources: z.array(claimSourceSchema).min(1),
    linkOnlyResources: z.array(linkOnlyResourceSchema),
    blockedFamilies: z.array(
      z
        .object({
          id: z.string().min(1),
          recordCount: z.number().int().nonnegative(),
          reason: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((register, context) => {
    const sourceIds = new Map<string, string>();
    [
      ...register.claimSources.map((source, index) => ({ id: source.id, section: "claimSources" as const, index })),
      ...register.linkOnlyResources.map((source, index) => ({ id: source.id, section: "linkOnlyResources" as const, index })),
    ].forEach(({ id, section, index }) => {
      const previousSection = sourceIds.get(id);
      if (previousSection) {
        context.addIssue({
          code: "custom",
          message: `duplicate source ID across ${previousSection} and ${section}: ${id}`,
          path: [section, index, "id"],
        });
      }
      sourceIds.set(id, section);
    });

    const blockedFamilyIds = new Set<string>();
    register.blockedFamilies.forEach((family, index) => {
      if (blockedFamilyIds.has(family.id)) {
        context.addIssue({
          code: "custom",
          message: `duplicate blocked-family ID: ${family.id}`,
          path: ["blockedFamilies", index, "id"],
        });
      }
      blockedFamilyIds.add(family.id);
    });
  });

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

const sourceRegister = deepFreeze(registerSchema.parse(sourceRegisterJson));

export const CONTENT_GOVERNANCE_REGISTER = deepFreeze(
  parseContentGovernanceRegister(contentGovernanceRegisterJson),
);

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalClaimSourcePayload(source: (typeof sourceRegister.claimSources)[number]) {
  return JSON.stringify({
    id: source.id,
    title: source.title,
    href: source.href,
    sourceClass: source.sourceClass,
    admissionStatus: source.admissionStatus,
    content: source.content,
    allowedIntents: source.allowedIntents,
  });
}

function canonicalLinkOnlyPayload(resource: (typeof sourceRegister.linkOnlyResources)[number]) {
  return JSON.stringify({
    id: resource.id,
    title: resource.title,
    href: resource.href,
    duration: resource.duration,
    skills: resource.skills,
    admissionStatus: resource.admissionStatus,
    restriction: resource.restriction,
  });
}

const sourcePayloads = new Map<string, { registerSection: "claim_source" | "link_only_resource"; sha256: string }>([
  ...sourceRegister.claimSources.map((source) => [
    source.id,
    { registerSection: "claim_source" as const, sha256: sha256(canonicalClaimSourcePayload(source)) },
  ] as const),
  ...sourceRegister.linkOnlyResources.map((resource) => [
    resource.id,
    { registerSection: "link_only_resource" as const, sha256: sha256(canonicalLinkOnlyPayload(resource)) },
  ] as const),
]);

if (sourcePayloads.size !== CONTENT_GOVERNANCE_REGISTER.records.length) {
  throw new Error("Invalid Sufeiya content governance register at records");
}

for (const record of CONTENT_GOVERNANCE_REGISTER.records) {
  const source = sourcePayloads.get(record.id);
  if (
    !source ||
    source.registerSection !== record.register_section ||
    source.sha256 !== record.record_payload_sha256
  ) {
    throw new Error(`Invalid Sufeiya content governance source binding: ${record.id}`);
  }
}

const skillLabels: Record<string, string> = {
  Reading: "Reading 阅读",
  Listening: "Listening 听力",
  Writing: "Writing 写作",
  Speaking: "Speaking 口语",
  Balanced: "综合训练",
};

const taskSourceIds: Record<string, string> = {
  Reading: "sufeiya-reading-task-v1",
  Listening: "sufeiya-listening-task-v1",
  Writing: "sufeiya-writing-task-v1",
  Speaking: "sufeiya-speaking-task-v1",
};

const priorityBasisLabels: Record<string, string> = {
  objective_first_response_pattern: "四项客观任务的首答模式",
  evidence_quality_gap: "音频、原文替代或任务缺项造成的证据质量缺口",
  open_response_coverage_gap: "开放作答的计时或自查覆盖缺口",
  learner_confirmation_after_multiple_gaps: "多项证据缺口并列后由学习者确认的先后顺序",
  learner_confirmation_after_tie: "客观任务并列后由学习者确认的先后顺序",
};

function primarySkill(context?: LearnerContext) {
  return context?.plan?.currentTaskSkill ?? context?.prioritySkill ?? context?.plan?.focusSkill;
}

function dynamicSources(context?: LearnerContext): GroundingSource[] {
  if (!context) return [];
  const sources: GroundingSource[] = [];

  if (context.prioritySkill || context.evidenceSufficiency || context.completedEvidenceSkills) {
    const priority = context.prioritySkill ? skillLabels[context.prioritySkill] : "尚未确认";
    const evidenceCount = context.completedEvidenceTaskCount ?? context.completedEvidenceSkills?.length ?? 0;
    const sufficiency =
      context.evidenceSufficiency === "evidence_limited" ? "证据有限" : "证据不足，需要补充";
    const confidence = context.evidenceConfidence === "medium" ? "中等证据覆盖置信度" : "低证据覆盖置信度";
    const basis = context.priorityBasis ? priorityBasisLabels[context.priorityBasis] : "学习者确认的下一条任务方向";
    sources.push({
      id: "learner-local-diagnostic",
      title: "用户设备提交的未签名 Gate A 摘要",
      href: "/diagnostic",
      sourceClass: "learner_local_record",
      content: `用户设备提交的未签名本机摘要显示：六项原创诊断任务均已终结，其中 ${evidenceCount} 项形成完成证据；学习者确认下一条优先任务为 ${priority}。依据类型是${basis}，证据状态为${sufficiency}，置信说明为${confidence}。该摘要已经通过同轮 ID 与任务哈希一致性检查，但不是服务器签名的正式记录，也不包含姓名、客观题答案、Writing 原文、录音或自由文本复盘。`,
    });
  }

  if (context.plan) {
    const focus = skillLabels[context.plan.focusSkill];
    const task = context.plan.currentTaskSkill
      ? `当前任务能力是 ${skillLabels[context.plan.currentTaskSkill]}。`
      : "当前任务能力尚未形成。";
    const time = context.plan.dailyMinutes ? `每日可用时间为 ${context.plan.dailyMinutes} 分钟。` : "未提供每日可用时间。";
    sources.push({
      id: "learner-local-plan",
      title: "用户设备提交的未签名 7 天计划摘要",
      href: "/plan",
      sourceClass: "learner_local_record",
      content: `同轮回链的${context.plan.stage === "updated" ? "更新后" : "基础"}计划重点是 ${focus}。${time}${task}这是用户设备提交的未签名摘要，不包含姓名或自由文本作答。`,
    });
  }

  if (context.recommendation) {
    const recommendation = context.recommendation;
    const status = recommendation.status === "accepted"
      ? "已接受"
      : "已明确跳过";
    sources.push({
      id: "learner-local-recommendation",
      title: "用户设备提交的未签名推荐摘要",
      href: "/recommendations",
      sourceClass: "learner_local_record",
      content: `同轮推荐选择状态为${status}。这是用户设备提交的未签名摘要；任务正文、学习者自由文本和外部链接没有被纳入模型证据包，推荐依据由服务器端第一方规则来源解释。`,
    });
  }

  if (context.progress) {
    const progress = context.progress;
    sources.push({
      id: "learner-local-progress",
      title: "用户设备提交的未签名闭环进度",
      href: "/workspace",
      sourceClass: "learner_local_record",
      content: `经同轮前序 ID 检查后：打卡${progress.checkInRecorded ? "已记录" : "未记录"}；学生复盘${progress.learnerReviewConfirmed ? "已确认" : "未确认"}；微复测${progress.retestRecorded ? "已记录" : "未记录"}；更新计划${progress.updatedPlanConfirmed ? "已由学习者确认" : "尚未确认"}。这是用户设备提交的未签名摘要，不是服务器签名审计记录。`,
    });
  }

  return sources;
}

function selectResources(intent: TeacherIntent, context?: LearnerContext): LinkOnlyResource[] {
  if (![
    "why_priority",
    "explain_recommendation",
    "resource_navigation",
  ].includes(intent)) {
    return [];
  }

  const skill = primarySkill(context);
  const matching = sourceRegister.linkOnlyResources.filter((resource) =>
    skill && skill !== "Balanced" ? resource.skills.includes(skill) : resource.skills.includes("考试概览"),
  );
  return matching.slice(0, 2).map(({ id, title, href, duration, skills }) => ({ id, title, href, duration, skills }));
}

export function buildGroundingBundle(intent: TeacherIntent, context?: LearnerContext): GroundingBundle {
  const allowed = new Map<string, GroundingSource>();
  const add = (source: GroundingSource) => allowed.set(source.id, source);

  for (const source of sourceRegister.claimSources) {
    if (source.allowedIntents.includes(intent) || source.id === "sufeiya-ai-boundary-v1") {
      add({
        id: source.id,
        title: source.title,
        href: source.href,
        sourceClass: source.sourceClass,
        content: source.content,
      });
    }
  }

  const skill = primarySkill(context);
  if (skill && taskSourceIds[skill]) {
    const source = sourceRegister.claimSources.find((item) => item.id === taskSourceIds[skill]);
    if (source) {
      add({
        id: source.id,
        title: source.title,
        href: source.href,
        sourceClass: source.sourceClass,
        content: source.content,
      });
    }
  }

  const dynamicSourceIds: Partial<Record<TeacherIntent, string[]>> = {
    why_priority: ["learner-local-diagnostic", "learner-local-plan"],
    explain_plan: ["learner-local-diagnostic", "learner-local-plan"],
    explain_recommendation: ["learner-local-diagnostic", "learner-local-plan", "learner-local-recommendation"],
    validate_progress: ["learner-local-diagnostic", "learner-local-progress"],
    resource_navigation: ["learner-local-diagnostic", "learner-local-plan"],
  };
  const allowedDynamicIds = new Set(dynamicSourceIds[intent] ?? []);
  for (const source of dynamicSources(context)) {
    if (allowedDynamicIds.has(source.id)) add(source);
  }

  return {
    sources: [...allowed.values()],
    resources: selectResources(intent, context),
  };
}

export function admittedSourceCounts() {
  return {
    claimSources: sourceRegister.claimSources.length,
    linkOnlyResources: sourceRegister.linkOnlyResources.length,
    detOfficialSources: 0 as const,
    archivedKnowledgeChunks: 0 as const,
  };
}

export function superTeacherSourceBoundary() {
  const counts = admittedSourceCounts();
  return {
    gateAStaticClaimSources: counts.claimSources,
    linkOnlyResources: counts.linkOnlyResources,
    detOfficialSourcesAdmitted: counts.detOfficialSources,
    archivedKnowledgeChunksAdmitted: counts.archivedKnowledgeChunks,
  };
}

export function sourceGovernanceSummary() {
  const evaluations = CONTENT_GOVERNANCE_REGISTER.records.map((record) => ({
    record,
    evaluation: evaluateRagAdmission(record, CONTENT_GOVERNANCE_REGISTER.evidenceCatalog),
  }));
  const trackedRecords = evaluations.length;
  const ragEligible = evaluations.filter(({ evaluation }) => evaluation.admitted).length;
  const blockedArchiveRecords = sourceRegister.blockedFamilies.reduce(
    (total, family) => total + family.recordCount,
    0,
  );

  return {
    protocolVersion: CONTENT_GOVERNANCE_REGISTER.protocolVersion,
    status: ragEligible === 0
      ? "none_admitted" as const
      : ragEligible === trackedRecords
        ? "all_tracked_admitted" as const
        : "some_admitted" as const,
    defaultDisposition: CONTENT_GOVERNANCE_REGISTER.defaultDisposition,
    trackedRecords,
    gateAClaimSources: sourceRegister.claimSources.length,
    catalogLinkOnly: sourceRegister.linkOnlyResources.length,
    ragEligible,
    ragBlocked: trackedRecords - ragEligible,
    blockedArchiveRecords,
    criteria: {
      teacherReviewed: evaluations.filter(({ record }) => record.review_status === "teacher_reviewed").length,
      ragRightsAllowed: evaluations.filter(({ record }) => record.rights_status.rag === "allowed").length,
      examVersionCurrentOrNotApplicable: evaluations.filter(({ record }) =>
        ["current", "not_applicable"].includes(record.exam_version_status),
      ).length,
      explicitRagAllowed: evaluations.filter(({ record }) => record.rag_eligibility === "allowed").length,
      noBlockingSafetyFlags: evaluations.filter(({ record }) =>
        !record.safety_flags.some((flag) => BLOCKING_SAFETY_FLAGS.includes(flag)),
      ).length,
    },
  };
}
