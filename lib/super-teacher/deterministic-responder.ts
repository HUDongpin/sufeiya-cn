import {
  SUPER_TEACHER_PROTOCOL,
  type GroundingBundle,
  type LearnerContext,
  type SuperTeacherResponse,
  type TeacherAction,
  type TeacherClaim,
  type TeacherIntent,
} from "@/lib/super-teacher/contracts";
import type { PolicyDecision } from "@/lib/super-teacher/policy";

const skillLabels: Record<string, string> = {
  Reading: "Reading 阅读",
  Listening: "Listening 听力",
  Writing: "Writing 写作",
  Speaking: "Speaking 口语",
  Balanced: "综合训练",
};

export type ApprovedFallback = Pick<
  SuperTeacherResponse,
  "mode" | "headline" | "claims" | "limitations" | "handoffRecommended"
>;

function sourceFor(bundle: GroundingBundle, id: string) {
  return bundle.sources.find((source) => source.id === id);
}

function claim(bundle: GroundingBundle, text: string, sourceIds: string[]): TeacherClaim {
  const citations = sourceIds
    .map((sourceId) => sourceFor(bundle, sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source))
    .map(({ id, title, href, sourceClass }) => ({ id, title, href, sourceClass }));

  if (!citations.length) {
    const boundary = sourceFor(bundle, "sufeiya-ai-boundary-v1") ?? bundle.sources[0];
    if (boundary) citations.push({
      id: boundary.id,
      title: boundary.title,
      href: boundary.href,
      sourceClass: boundary.sourceClass,
    });
  }
  return { text, citations };
}

function progressAction(context?: LearnerContext): TeacherAction {
  if (!context?.prioritySkill) {
    return { label: "继续但不使用 AI：完成六项诊断任务", href: "/diagnostic", kind: "continue_without_ai" };
  }
  if (!context.plan) {
    return { label: "继续但不使用 AI：生成 7 天计划", href: "/plan", kind: "continue_without_ai" };
  }
  if (!context.recommendation) {
    return { label: "继续但不使用 AI：核对推荐", href: "/recommendations", kind: "continue_without_ai" };
  }
  if (!context.progress?.checkInRecorded) {
    return { label: "继续但不使用 AI：完成任务并打卡", href: "/today", kind: "continue_without_ai" };
  }
  if (!context.progress.learnerReviewConfirmed) {
    return { label: "继续但不使用 AI：确认复盘", href: "/review", kind: "continue_without_ai" };
  }
  if (!context.progress.retestRecorded) {
    return { label: "继续但不使用 AI：完成平行微复测", href: "/retest", kind: "continue_without_ai" };
  }
  return { label: "返回学习工作台", href: "/workspace", kind: "continue_without_ai" };
}

export function commonActions(intent: TeacherIntent, context?: LearnerContext): TeacherAction[] {
  const actions: TeacherAction[] = [progressAction(context)];
  if (["why_priority", "explain_recommendation", "resource_navigation"].includes(intent)) {
    actions.push({ label: "查看冻结的公开资源目录", href: "/resources", kind: "resource" });
  }
  actions.push({ label: "查看人工支持路径", href: "#human-support", kind: "handoff" });
  return actions;
}

export function buildApprovedFallback(
  decision: PolicyDecision,
  bundle: GroundingBundle,
  context?: LearnerContext,
): ApprovedFallback {
  const priority = context?.prioritySkill ? skillLabels[context.prioritySkill] : null;
  const planFocus = context?.plan ? skillLabels[context.plan.focusSkill] : null;
  const taskSkill = context?.plan?.currentTaskSkill;
  const task = taskSkill ? `${skillLabels[taskSkill]}原创微练习` : null;

  switch (decision.intent) {
    case "prompt_injection":
      return {
        mode: "policy_refusal",
        headline: "我不会更改或公开内部安全规则",
        claims: [
          claim(bundle, "我只能在当前已准入来源和学习边界内解释你的计划，不会执行覆盖规则、泄露提示词或绕过来源限制的要求。", ["sufeiya-ai-boundary-v1"]),
        ],
        limitations: ["你仍可以询问：为什么先练某项能力、当前计划如何形成、怎样验证学习进展。"],
        handoffRecommended: false,
      };
    case "sensitive_data":
      return {
        mode: "policy_refusal",
        headline: "请先删去个人敏感信息",
        claims: [
          claim(bundle, "这条提问可能包含手机号、邮箱、证件号或凭证类信息。请删去这些内容后再描述学习问题。", ["sufeiya-ai-boundary-v1"]),
        ],
        limitations: ["不要在对话中粘贴账号密码、验证码、身份证件、完整联系方式或他人的个人信息。"],
        handoffRecommended: true,
      };
    case "integrity_boundary":
      return {
        mode: "policy_refusal",
        headline: "我可以帮助练习，但不能替你参加考试",
        claims: [
          claim(bundle, "我不能提供真题机经、泄露题目、可直接背诵的固定答案，也不能协助正在进行的考试。", ["sufeiya-ai-boundary-v1"]),
          claim(bundle, "你可以退出对话，使用本站原创微练习练习组织思路、理解信息和自我检查；这些任务不会被包装成官方评分。", ["sufeiya-ai-boundary-v1", "sufeiya-diagnostic-boundary-v1"]),
        ],
        limitations: ["当前 DET 官方考试诚信来源尚未完成准入，因此这里执行更严格的项目边界，而不扩展解释官方规则。"],
        handoffRecommended: false,
      };
    case "source_review_required":
      return {
        mode: "insufficient_sources",
        headline: "这个问题需要已审核的 DET 官方来源",
        claims: [
          claim(bundle, "当前 Sofia智能老师没有任何已准入的 DET 官方规则条目，因此不能可靠回答题型、评分、有效期、费用或认证规则。", ["sufeiya-ai-boundary-v1"]),
          claim(bundle, "我可以继续解释你在本站留下的本机学习证据、7 天计划和推荐，但不会用模型常识补齐缺失来源。", ["sufeiya-ai-boundary-v1", "sufeiya-diagnostic-boundary-v1"]),
        ],
        limitations: ["需要教研、考试版本和权利审核完成后，DET 官方短主张才能进入白名单。"],
        handoffRecommended: true,
      };
    case "handoff":
      return {
        mode: "handoff",
        headline: "可以转到人工支持路径",
        claims: [
          claim(bundle, "你可以在本页生成并复制一份本机人工支持请求，再自行添加公开个人微信 SofiaTang2020 联系苏肥鸭老师。页面不会自动发送消息，也不承诺响应时间。", ["sufeiya-human-handoff-v1"]),
          claim(bundle, "如果你不想联系人工，也可以直接退出 Sofia智能老师，继续完成诊断、计划、任务、复盘和微复测。", ["sufeiya-human-handoff-v1", "sufeiya-ai-boundary-v1"]),
        ],
        limitations: ["人工支持请求默认只保存在当前浏览器；复制前请删除不必要的个人信息。"],
        handoffRecommended: true,
      };
    case "explain_limits":
      return {
        mode: "manual_grounded",
        headline: "它能解释学习依据，但不能替你下结论",
        claims: [
          claim(bundle, "Gate A 只解释本站本机学习证据、计划、推荐和原创任务；它不能自动评分、预测 DET 成绩或保证提分结果。", ["sufeiya-ai-boundary-v1", "sufeiya-diagnostic-boundary-v1"]),
          claim(bundle, "你可以随时停止对话并沿非 AI 路径继续学习，也可以生成本机人工支持请求。", ["sufeiya-ai-boundary-v1", "sufeiya-human-handoff-v1"]),
        ],
        limitations: ["DET 官方规则语料与苏肥鸭课程正文尚未完成准入，当前不会作为回答依据。"],
        handoffRecommended: false,
      };
    case "why_priority": {
      const basisCopy = context?.priorityBasis === "objective_first_response_pattern"
        ? "四项客观任务的首答模式显示这个方向更需要下一条练习证据"
        : context?.priorityBasis === "evidence_quality_gap"
          ? "这个方向存在音频、原文替代、跳过或不可用造成的证据质量缺口"
          : context?.priorityBasis === "open_response_coverage_gap"
            ? "开放作答的计时或自查覆盖仍不完整"
            : context?.priorityBasis === "learner_confirmation_after_multiple_gaps"
              ? "多项能力同时存在证据缺口，系统没有使用隐藏排序，你随后确认了先后顺序"
              : context?.priorityBasis === "learner_confirmation_after_tie"
                ? "Reading 与可解释 Listening 的首答模式并列，你随后确认了先后顺序"
                : "你在本机报告中确认了这个下一条任务方向";
      const firstClaim = priority
        ? `你先练 ${priority}，最直接的依据是：${basisCopy}；这只决定下一条证据任务，不是能力等级。`
        : "我还没有读取到你确认的下一条优先任务，因此不能替你决定先练哪一项；请先完成六项 Gate A 诊断任务。";
      const firstSources = priority
        ? ["learner-local-diagnostic", "sufeiya-diagnostic-boundary-v1"]
        : ["sufeiya-diagnostic-boundary-v1"];
      const claims = [claim(bundle, firstClaim, firstSources)];
      if (planFocus || task) {
        claims.push(claim(
          bundle,
          task
            ? `当前计划把“${task}”作为可执行任务，用来把 ${planFocus ?? priority ?? "这个重点"} 变成一次可以留下证据的练习。`
            : `当前 7 天计划以 ${planFocus} 为重点，把学习者确认的选择转成具体任务；调整计划设置后可以重新生成。`,
          ["learner-local-plan", "learner-local-recommendation", "sufeiya-plan-method-v1"],
        ));
      }
      return {
        mode: "manual_grounded",
        headline: priority ? `为什么先练 ${priority}` : "先补齐优先项证据",
        claims,
        limitations: ["当前六项任务仍是未经教研与测量双签的 Gate A 演示证据；Writing 与 Speaking 未经人工审核，不能用于正式能力判断或 DET 分数预测。"],
        handoffRecommended: !priority,
      };
    }
    case "explain_plan":
      return {
        mode: "manual_grounded",
        headline: planFocus ? `你的计划当前以 ${planFocus} 为重点` : "当前还没有可解释的 7 天计划",
        claims: context?.plan
          ? [
              claim(bundle, `这份计划把你确认的重点和每日可用时间转成具体任务，调整计划设置后可以重新生成；${context.plan.currentTaskSkill ? `当前读取到的任务技能是 ${skillLabels[context.plan.currentTaskSkill]}。` : "当前任务技能尚未形成。"}`, ["learner-local-plan", "sufeiya-plan-method-v1"]),
              claim(bundle, "计划与演示初筛回链，但不会把学习者选择改写成自动诊断结论。", ["sufeiya-plan-method-v1", "sufeiya-diagnostic-boundary-v1"]),
            ]
          : [claim(bundle, "我没有读取到当前本机计划；请先完成演示初筛，再生成 7 天计划。", ["sufeiya-plan-method-v1", "sufeiya-diagnostic-boundary-v1"])],
        limitations: ["计划用于组织行动，不是成绩承诺，也不会跨设备自动同步。"],
        handoffRecommended: false,
      };
    case "explain_recommendation":
      return {
        mode: "manual_grounded",
        headline: context?.recommendation
          ? `当前推荐${context.recommendation.status === "accepted" ? "已接受" : "已跳过"}`
          : "当前推荐还没有形成",
        claims: context?.recommendation
          ? [
              claim(bundle, `你的本机推荐当前状态是“${context.recommendation.status === "accepted" ? "已接受" : "已明确跳过"}”；任务正文和自由文本没有离开当前浏览器。`, ["learner-local-recommendation"]),
              claim(bundle, `推荐页只提供一个主任务和至多两个补充入口；${task ? `当前可沿计划中的 ${task} 继续。` : ""} 你可以接受或明确跳过，打开链接本身不等于完成学习。`, ["learner-local-plan", "sufeiya-recommendation-method-v1"]),
            ]
          : [claim(bundle, "我没有读取到当前推荐记录；请先让演示初筛和 7 天计划形成同一轮证据链。", ["sufeiya-recommendation-method-v1"])],
        limitations: ["推荐来自冻结的本机规则，不是模型评分，也不表示学习结果保证。"],
        handoffRecommended: false,
      };
    case "validate_progress": {
      const progress = context?.progress;
      const status = progress
        ? `打卡${progress.checkInRecorded ? "已记录" : "未记录"}，学生复盘${progress.learnerReviewConfirmed ? "已确认" : "未确认"}，微复测${progress.retestRecorded ? "已记录" : "未记录"}，更新计划${progress.updatedPlanConfirmed ? "已确认" : "未确认"}。`
        : "我没有读取到完整的本机闭环进度。";
      return {
        mode: "manual_grounded",
        headline: "用证据判断下一步，不把完成次数当成能力",
        claims: [
          claim(bundle, status, progress ? ["learner-local-progress"] : ["sufeiya-evidence-loop-v1"]),
          claim(bundle, "一次任务、一次打卡或一次计时不能单独证明能力变化；应结合具体证据、学生确认和平行微复测决定下一轮计划。", ["sufeiya-evidence-loop-v1"]),
        ],
        limitations: ["Gate A 不生成能力等级或 DET 分数，进展解释只服务于下一步学习行动。"],
        handoffRecommended: false,
      };
    }
    case "resource_navigation":
      return {
        mode: "manual_grounded",
        headline: bundle.resources.length ? "这里有与你当前重点相符的公开入口" : "当前没有匹配的 link-only 资源",
        claims: [
          claim(bundle, bundle.resources.length ? "下方资源只展示已选择的公开标题、技能标签、时长和原始链接；我不会把标题推断成视频里的教学结论。" : "现有白名单中没有足够的教学正文来回答这个问题；你仍可以使用本站原创微练习。", ["sufeiya-recommendation-method-v1", "sufeiya-ai-boundary-v1"]),
        ],
        limitations: ["这些公开视频目前是 link-only 目录，不是已准入的课程正文或 RAG 语料。"],
        handoffRecommended: !bundle.resources.length,
      };
    default:
      return {
        mode: "insufficient_sources",
        headline: "当前白名单不足以回答这个问题",
        claims: [
          claim(bundle, "我只能解释本站本机学习证据、计划、推荐、进度和已准入的原创任务；不会用模型常识补齐没有来源的内容。", ["sufeiya-ai-boundary-v1"]),
        ],
        limitations: ["请改问“为什么先练这个”“解释我的计划”“怎样验证进步”，或请求人工帮助。"],
        handoffRecommended: true,
      };
  }
}

export function createLocalTeacherResponse({
  decision,
  bundle,
  learnerContext,
  requestId,
  createdAt = new Date().toISOString(),
}: {
  decision: PolicyDecision;
  bundle: GroundingBundle;
  learnerContext?: LearnerContext;
  requestId: string;
  createdAt?: string;
}): SuperTeacherResponse {
  const fallback = buildApprovedFallback(decision, bundle, learnerContext);
  const localBoundary = "问题与本机学习摘要只在当前浏览器处理；本次不会发送到本站服务端或外部模型，也不形成正式诊断、DET 官方评分或结果保证。";
  return {
    protocolVersion: SUPER_TEACHER_PROTOCOL,
    requestId,
    createdAt,
    intent: decision.intent,
    mode: fallback.mode,
    modelAttempted: false,
    headline: fallback.headline,
    claims: fallback.claims,
    limitations: [...new Set([...fallback.limitations, localBoundary])].slice(0, 4),
    resources: bundle.resources,
    actions: commonActions(decision.intent, learnerContext),
    handoffRecommended: fallback.handoffRecommended,
    sourceBoundary: {
      claimSourceCount: bundle.sources.length,
      detOfficialSourcesAdmitted: 0,
      archivedKnowledgeChunksAdmitted: 0,
    },
  };
}
