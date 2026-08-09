import type { TeacherIntent } from "@/lib/super-teacher/contracts";

const patterns = {
  promptInjection:
    /(忽略|无视|覆盖|删除).{0,16}(之前|上面|系统|开发者|规则|指令)|系统提示词|开发者消息|越狱|jailbreak|system\s*prompt|developer\s*message|ignore.{0,20}(previous|system|instruction)|reveal.{0,20}(prompt|instruction)/i,
  sensitiveData:
    /(?:\+?86[- ]?)?1[3-9](?:[- ]?\d){9}|\b\d{17}[\dXx]\b|\b[A-Z]\d{7,8}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:我叫|我的名字是|姓名\s*[:：]|my name is)\s*[\p{L}·.' -]{2,30}|(?:住址|地址|家庭住址|住在|居住于)\s*[:：]?\s*[^，。；\n]{3,60}|(?:微信|QQ|wx|wechat)\s*(?:号|号码|ID)?\s*[:：]?\s*[A-Z0-9_-]{4,}|(?:学号|student\s*id)\s*[:：]?\s*[A-Z0-9-]{5,}|(?:银行卡|银行卡号|支付账号|身份证|身份证号|护照|护照号|密码|验证码)\s*(?:号|号码)?\s*[:：]?\s*[A-Z0-9 -]{4,}|(?:api[_ -]?key|access[_ -]?token|token|secret|密钥)\s*[:=：]?\s*\S{6,}|\b(?:sk-[A-Z0-9_-]{8,}|gh[pousr]_[A-Z0-9]{10,})/iu,
  activeExam:
    /我(?:正在|现在|此刻).{0,10}(考试|测试|答题)|正在.{0,8}(考试|测试|答题)|考试中|帮我.{0,8}(答|选|提交)|替我.{0,8}(答|写|考)|直接告诉我.{0,8}(答案|选项)|remote.{0,8}exam|live.{0,8}(test|exam)|answer.{0,8}for me/i,
  integrity:
    /真题|机经|原题|题库|泄题|背诵答案|万能模板|代写|代考|预制答案|直接写.{0,12}(作文|口语|答案)|memorized answer|test recall|leaked question/i,
  scorePromise:
    /预测.{0,8}(分|成绩)|能考多少|会考多少|保证.{0,8}(分|提分|录取|上岸)|包过|保分|提分承诺|结果保证|退款承诺|score prediction|guarantee.{0,12}(score|result|admission)/i,
  handoff: /人工|真人|转接|联系老师|找老师|微信|客服|human support|talk to (a )?(teacher|person)/i,
  resource: /资源|视频|课程|哪里练|去哪练|继续练|材料|链接|入口|resource|video|course|practice next/i,
  whyPriority: /为什么.{0,14}(先|练|重点|推荐)|为什么是|先练什么|优先.{0,8}(能力|任务)|why.{0,14}(first|priority|practice)/i,
  plan: /解释.{0,8}计划|我的计划|7\s*天|七天|每天.{0,8}(任务|时间)|plan|schedule/i,
  recommendation: /解释.{0,8}推荐|为什么推荐|主任务|补充任务|接受推荐|跳过推荐|recommendation|recommended task/i,
  progress: /进度|完成了吗|进步|复盘|打卡|复测|证据|怎么验证|怎样验证|progress|improv|evidence|retest|review/i,
  limits: /能做什么|不能做什么|边界|限制|可靠吗|是不是正式|是不是官方|数据.{0,8}(上传|保存)|隐私|AI.{0,8}(怎么用|是否)|limit|privacy|official score/i,
  officialDetFacts:
    /题型|考试结构|考试时长|评分标准|评分规则|分项|有效期|认证|考试费用|报名|设备要求|官方练习测试|官方规则|det\b|duolingo english test|subscore|test structure|scoring/i,
};

function normalizeSensitiveText(value: string) {
  return value
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xfee0))
    .replace(/[－—–]/g, "-")
    .replace(/\u3000/g, " ");
}

export function containsSensitiveData(question: string) {
  const text = normalizeSensitiveText(question);
  if (patterns.sensitiveData.test(text)) return true;
  const numberCandidates = text.match(/\d(?:[ -]?\d){11,24}/g) ?? [];
  return numberCandidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 25;
  });
}

export type PolicyDecision = {
  intent: TeacherIntent;
  allowModel: boolean;
  reason: string;
};

export function classifyTeacherQuestion(question: string): PolicyDecision {
  const text = question.trim();

  if (containsSensitiveData(text)) {
    return {
      intent: "sensitive_data",
      allowModel: false,
      reason: "The question appears to contain personal or credential-like data.",
    };
  }
  if (patterns.promptInjection.test(text)) {
    return {
      intent: "prompt_injection",
      allowModel: false,
      reason: "The question attempts to change or reveal system instructions.",
    };
  }
  if (patterns.activeExam.test(text) || patterns.integrity.test(text)) {
    return {
      intent: "integrity_boundary",
      allowModel: false,
      reason: "The request conflicts with the active-exam or memorized-answer boundary.",
    };
  }
  if (patterns.scorePromise.test(text)) {
    return {
      intent: "explain_limits",
      allowModel: false,
      reason: "The request asks for a score prediction or guaranteed outcome.",
    };
  }
  if (patterns.handoff.test(text)) {
    return { intent: "handoff", allowModel: false, reason: "The learner requested human support." };
  }
  if (patterns.officialDetFacts.test(text)) {
    return {
      intent: "source_review_required",
      allowModel: false,
      reason: "Official DET claims are not admitted until teacher, rights, and version review is complete.",
    };
  }
  if (patterns.whyPriority.test(text)) {
    return { intent: "why_priority", allowModel: true, reason: "Explain the local learning priority." };
  }
  if (patterns.recommendation.test(text)) {
    return { intent: "explain_recommendation", allowModel: true, reason: "Explain the current recommendation." };
  }
  if (patterns.plan.test(text)) {
    return { intent: "explain_plan", allowModel: true, reason: "Explain the current local plan." };
  }
  if (patterns.progress.test(text)) {
    return { intent: "validate_progress", allowModel: true, reason: "Explain progress and evidence limits." };
  }
  if (patterns.resource.test(text)) {
    return { intent: "resource_navigation", allowModel: true, reason: "Navigate admitted or link-only resources." };
  }
  if (patterns.limits.test(text)) {
    return { intent: "explain_limits", allowModel: false, reason: "Explain the Gate A boundary deterministically." };
  }
  return {
    intent: "unsupported",
    allowModel: false,
    reason: "The question is outside the admitted Gate A intents or has no approved source coverage.",
  };
}
