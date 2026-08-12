import sourceRegisterJson from "@/data/super-teacher-source-register.json";
import type {
  GroundingBundle,
  GroundingSource,
  LearnerContext,
  LinkOnlyResource,
  TeacherIntent,
} from "@/lib/super-teacher/contracts";

type StaticClaimSource = GroundingSource & {
  admissionStatus: "product_policy_allowed";
  allowedIntents: TeacherIntent[];
};

type StaticLinkOnlyResource = LinkOnlyResource & {
  admissionStatus: "catalog_link_only";
};

const sourceRegister = sourceRegisterJson as {
  claimSources: StaticClaimSource[];
  linkOnlyResources: StaticLinkOnlyResource[];
};

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
    const sufficiency = context.evidenceSufficiency === "evidence_limited" ? "证据有限" : "证据不足，需要补充";
    const confidence = context.evidenceConfidence === "medium" ? "中等证据覆盖置信度" : "低证据覆盖置信度";
    const basis = context.priorityBasis ? priorityBasisLabels[context.priorityBasis] : "学习者确认的下一条任务方向";
    sources.push({
      id: "learner-local-diagnostic",
      title: "当前浏览器中的 Gate A 摘要",
      href: "/diagnostic",
      sourceClass: "learner_local_record",
      content: `当前浏览器中的摘要显示：六项原创诊断任务均已终结，其中 ${evidenceCount} 项形成完成证据；学习者确认下一条优先任务为 ${priority}。依据类型是${basis}，证据状态为${sufficiency}，置信说明为${confidence}。该摘要只在当前浏览器处理，不包含姓名、客观题答案、Writing 原文、录音或自由文本复盘。`,
    });
  }

  if (context.plan) {
    const focus = skillLabels[context.plan.focusSkill];
    const planStage = context.plan.stage === "provisional_updated"
      ? "临时更新后、仍待具备资质人员确认的"
      : context.plan.stage === "updated"
        ? "更新后"
        : "基础";
    const minimizedProvisional = context.plan.stage === "provisional_updated";
    const task = context.plan.currentTaskSkill
      ? `当前任务技能是 ${skillLabels[context.plan.currentTaskSkill]}。`
      : minimizedProvisional
        ? "当前最小化承接摘要未携带任务技能，不能据此判断任务尚未形成。"
        : "当前任务技能尚未形成。";
    const time = context.plan.dailyMinutes
      ? `每日可用时间为 ${context.plan.dailyMinutes} 分钟。`
      : minimizedProvisional
        ? "当前最小化承接摘要未携带每日时间，不能据此判断计划未设置时间。"
        : "未提供每日可用时间。";
    sources.push({
      id: "learner-local-plan",
      title: "当前浏览器中的 7 天计划摘要",
      href: "/plan",
      sourceClass: "learner_local_record",
      content: `同轮回链的${planStage}计划重点是 ${focus}。${time}${task}该摘要只在当前浏览器处理。`,
    });
  }

  if (context.recommendation) {
    sources.push({
      id: "learner-local-recommendation",
      title: "当前浏览器中的推荐摘要",
      href: "/recommendations",
      sourceClass: "learner_local_record",
      content: `同轮推荐选择状态为${context.recommendation.status === "accepted" ? "已接受" : "已明确跳过"}。该摘要只在当前浏览器处理。`,
    });
  }

  if (context.progress) {
    const progress = context.progress;
    const updatedPlanStatus = progress.humanReviewStatus === "required_not_completed"
      ? "临时更新计划已由学习者确认，仍待具备资质人员确认"
      : `更新计划${progress.updatedPlanConfirmed ? "已确认" : "未确认"}`;
    sources.push({
      id: "learner-local-progress",
      title: "当前浏览器中的闭环进度",
      href: "/workspace",
      sourceClass: "learner_local_record",
      content: `打卡${progress.checkInRecorded ? "已记录" : "未记录"}；学生复盘${progress.learnerReviewConfirmed ? "已确认" : "未确认"}；微复测${progress.retestRecorded ? "已记录" : "未记录"}；${updatedPlanStatus}。该摘要只在当前浏览器处理。`,
    });
  }

  return sources;
}

function selectResources(intent: TeacherIntent, context?: LearnerContext): LinkOnlyResource[] {
  if (!["why_priority", "explain_recommendation", "resource_navigation"].includes(intent)) return [];
  const skill = primarySkill(context);
  return sourceRegister.linkOnlyResources
    .filter((resource) => skill && skill !== "Balanced"
      ? resource.skills.includes(skill)
      : resource.skills.includes("考试概览"))
    .slice(0, 2)
    .map(({ id, title, href, duration, skills }) => ({ id, title, href, duration, skills }));
}

/**
 * Browser-safe grounding for the deterministic Gate A explanation path.
 * It intentionally performs no network access and consumes only the frozen
 * first-party register plus the already-validated local learner summary.
 */
export function buildLocalGroundingBundle(
  intent: TeacherIntent,
  context?: LearnerContext,
): GroundingBundle {
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
    if (source) add({
      id: source.id,
      title: source.title,
      href: source.href,
      sourceClass: source.sourceClass,
      content: source.content,
    });
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

  return { sources: [...allowed.values()], resources: selectResources(intent, context) };
}
