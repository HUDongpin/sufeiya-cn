import { z } from "zod";

import sourceRegisterJson from "@/data/super-teacher-source-register.json";
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
  .strict();

const sourceRegister = registerSchema.parse(sourceRegisterJson);

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

function primarySkill(context?: LearnerContext) {
  return context?.plan?.currentTaskSkill ?? context?.prioritySkill ?? context?.plan?.focusSkill;
}

function dynamicSources(context?: LearnerContext): GroundingSource[] {
  if (!context) return [];
  const sources: GroundingSource[] = [];

  if (context.prioritySkill || context.evidenceSufficiency || context.completedEvidenceSkills) {
    const priority = context.prioritySkill ? skillLabels[context.prioritySkill] : "尚未确认";
    const evidenceCount = context.completedEvidenceSkills?.length ?? 0;
    const sufficiency =
      context.evidenceSufficiency === "evidence_limited" ? "证据有限" : "证据不足，需要补充";
    sources.push({
      id: "learner-local-diagnostic",
      title: "你的本机演示初筛记录",
      href: "/diagnostic",
      sourceClass: "learner_local_record",
      content: `学习者在本机主动确认的当前优先能力是 ${priority}；已记录 ${evidenceCount} 项原创微练习完成状态；证据状态为${sufficiency}。这份摘要不包含姓名、答案、录音或自由文本复盘。`,
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
      title: "你的本机 7 天计划摘要",
      href: "/plan",
      sourceClass: "learner_local_record",
      content: `计划重点是 ${focus}。${time}${task}这份摘要不包含姓名或自由文本作答。`,
    });
  }

  if (context.recommendation) {
    const recommendation = context.recommendation;
    const status = recommendation.status === "accepted"
      ? "已接受"
      : recommendation.status === "skipped"
        ? "已明确跳过"
        : "待选择";
    sources.push({
      id: "learner-local-recommendation",
      title: "你的本机推荐记录摘要",
      href: "/recommendations",
      sourceClass: "learner_local_record",
      content: `推荐选择状态为${status}。任务正文、学习者自由文本和外部链接没有被纳入模型证据包；推荐依据由服务器端第一方规则来源解释。`,
    });
  }

  if (context.progress) {
    const progress = context.progress;
    sources.push({
      id: "learner-local-progress",
      title: "你的本机学习闭环进度",
      href: "/workspace",
      sourceClass: "learner_local_record",
      content: `打卡${progress.checkInRecorded ? "已记录" : "未记录"}；学生复盘${progress.learnerReviewConfirmed ? "已确认" : "未确认"}；微复测${progress.retestRecorded ? "已记录" : "未记录"}；更新计划${progress.updatedPlanConfirmed ? "已由学习者确认" : "尚未确认"}。`,
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
