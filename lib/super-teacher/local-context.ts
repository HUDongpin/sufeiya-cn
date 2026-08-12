import type { LearnerContext } from "@/lib/super-teacher/contracts";
import { deriveProvisionalHandoffEvidence } from "@/lib/super-teacher/provisional-handoff";
import { deriveTeachingReviewEvidence } from "@/lib/teaching-review-demo";

const WORKSPACE_PROTOCOL = "gate_a_local_v1";
const DIAGNOSTIC_PROTOCOL = "gate_a_diagnostic_evidence_v1";
const TASK_SET_VERSION = "gate_a_original_6_v1";
const TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
const TERMINAL_STATES = new Set(["completed", "skipped", "evidence_insufficient", "unavailable"]);
const SKILLS = new Set(["Reading", "Listening", "Writing", "Speaking"]);
const ALL_SKILLS = new Set([...SKILLS, "Balanced"]);
const PRIORITY_BASES = new Set([
  "objective_first_response_pattern",
  "evidence_quality_gap",
  "open_response_coverage_gap",
  "learner_confirmation_after_multiple_gaps",
  "learner_confirmation_after_tie",
]);

const TASK_MANIFEST: Record<string, Record<string, string>> = {
  "diagnostic-reading-library-v1": { taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "purpose_from_supporting_details", contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7" },
  "diagnostic-reading-newsletter-v1": { taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "cause_from_text_structure", contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca" },
  "diagnostic-listening-science-club-v1": { taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "schedule_change_detail", contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308" },
  "diagnostic-listening-language-lab-v1": { taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "time_and_location_integration", contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd" },
  "diagnostic-speaking-learning-skill-v1": { taskVersion: "v1", skill: "Speaking", responseType: "timed_self_report", constructTag: "task_coverage_and_connected_thoughts_self_report", contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9" },
  "diagnostic-writing-learning-place-v1": { taskVersion: "v1", skill: "Writing", responseType: "timed_local_text", constructTag: "task_response_structure_self_review", contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85" },
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown) {
  return typeof value === "string" && /^[a-z][a-z0-9_-]{2,119}$/i.test(value);
}

function isSkill(value: unknown): value is LearnerContext["prioritySkill"] {
  return typeof value === "string" && SKILLS.has(value);
}

function isAnySkill(value: unknown): value is NonNullable<LearnerContext["plan"]>["focusSkill"] {
  return typeof value === "string" && ALL_SKILLS.has(value);
}

function validEvidence(evidence: unknown) {
  if (!isRecord(evidence) || !isId(evidence.taskId) || !TERMINAL_STATES.has(String(evidence.status))) return false;
  if (!Array.isArray(evidence.qualityFlags) || !evidence.qualityFlags.every((flag) => typeof flag === "string")) return false;
  if (!["evidence_limited", "evidence_insufficient"].includes(String(evidence.evidenceStatus))) return false;
  const expected = TASK_MANIFEST[evidence.taskId as string];
  if (!expected || !Object.entries(expected).every(([key, value]) => evidence[key] === value)) return false;
  if (["single_choice", "single_choice_audio"].includes(expected.responseType) && evidence.status === "completed") {
    return evidence.attempts === 1 && ["a", "b", "c"].includes(String(evidence.firstResponse)) &&
      ["first_response_matched", "first_response_not_matched"].includes(String(evidence.resultType));
  }
  return true;
}

function planById(state: UnknownRecord, planId: unknown) {
  if (!isId(planId)) return undefined;
  const current = isRecord(state.plan) ? state.plan : undefined;
  if (current?.planId === planId) return current;
  const history = Array.isArray(state.planHistory) ? state.planHistory.filter(isRecord) : [];
  return history.find((plan) => plan.planId === planId);
}

function allCheckIns(state: UnknownRecord) {
  const current = isRecord(state.checkIns) ? Object.values(state.checkIns).filter(isRecord) : [];
  const history = Array.isArray(state.checkInHistory) ? state.checkInHistory.filter(isRecord) : [];
  return [...current, ...history];
}

function currentTaskSkill(plan: UnknownRecord) {
  const days = Array.isArray(plan.days) ? plan.days.filter(isRecord) : [];
  if (!days.length) return undefined;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const day = days.find((item) => item.date === today) ?? days[0];
  const tasks = Array.isArray(day.tasks) ? day.tasks.filter(isRecord) : [];
  const task = tasks.find((item) => item.skill === day.coreSkill) ?? tasks[0];
  return isSkill(task?.skill) ? task.skill : undefined;
}

export function deriveLearnerContext(value: unknown): LearnerContext | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.journey)) return undefined;
  const journey = value.journey;
  if (journey.protocolVersion !== WORKSPACE_PROTOCOL) return undefined;
  const cycle = isRecord(journey.activeCycle) ? journey.activeCycle : undefined;
  const diagnostic = isRecord(journey.diagnostic) ? journey.diagnostic : undefined;
  if (cycle?.status === "provisional_pending_human_review") {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      return undefined;
    }
    const handoff = deriveProvisionalHandoffEvidence(raw);
    const authorized = deriveTeachingReviewEvidence(raw);
    if (
      handoff.status !== "ready" ||
      authorized.status !== "ready" ||
      !authorized.diagnostic ||
      !authorized.recommendation ||
      !authorized.planUpdate ||
      authorized.diagnostic.prioritySkill === "Unknown" ||
      authorized.diagnostic.prioritySkill === "Balanced" ||
      authorized.planUpdate.focusSkill === "Unknown" ||
      !["accepted", "skipped"].includes(authorized.recommendation.status)
    ) return undefined;
    const completedEvidence = authorized.diagnostic.tasks.filter((task) => task.status === "completed");
    const completedEvidenceSkills = [...new Set(completedEvidence
      .map((task) => task.skill)
      .filter((skill): skill is LearnerContext["prioritySkill"] => skill !== "Unknown" && skill !== "Balanced"))];
    const context: LearnerContext = {
      protocolVersion: WORKSPACE_PROTOCOL,
      adultConfirmed: true,
      summaryIntegrity: "unsigned_device_summary",
      cycleId: handoff.evidence.cycleId,
      diagnosticSessionId: handoff.evidence.diagnosticSessionId,
      taskSetVersion: TASK_SET_VERSION,
      taskSetDigest: TASK_SET_DIGEST,
      terminalEvidenceTaskCount: 6,
      prioritySkill: authorized.diagnostic.prioritySkill,
      completedEvidenceTaskCount: completedEvidence.length,
      completedEvidenceSkills,
      ...(authorized.diagnostic.evidenceSufficiency === "evidence_limited" ||
      authorized.diagnostic.evidenceSufficiency === "evidence_insufficient"
        ? { evidenceSufficiency: authorized.diagnostic.evidenceSufficiency }
        : {}),
      ...(authorized.diagnostic.confidence === "low" || authorized.diagnostic.confidence === "medium"
        ? { evidenceConfidence: authorized.diagnostic.confidence }
        : {}),
      ...(typeof authorized.diagnostic.priorityBasis === "string" && PRIORITY_BASES.has(authorized.diagnostic.priorityBasis)
        ? { priorityBasis: authorized.diagnostic.priorityBasis as LearnerContext["priorityBasis"] }
        : {}),
      plan: {
        planId: handoff.evidence.updatedPlanId,
        basePlanId: handoff.evidence.basePlanId,
        cycleId: handoff.evidence.cycleId,
        diagnosticSessionId: handoff.evidence.diagnosticSessionId,
        taskSetVersion: TASK_SET_VERSION,
        stage: "provisional_updated",
        focusSkill: authorized.planUpdate.focusSkill,
      },
      recommendation: {
        recommendationId: handoff.evidence.recommendationId,
        planId: handoff.evidence.basePlanId,
        cycleId: handoff.evidence.cycleId,
        diagnosticSessionId: handoff.evidence.diagnosticSessionId,
        status: authorized.recommendation.status as "accepted" | "skipped",
      },
      progress: {
        checkInRecorded: true,
        learnerReviewConfirmed: true,
        retestRecorded: true,
        updatedPlanConfirmed: false,
        checkInId: handoff.evidence.checkInId,
        reviewId: handoff.evidence.reviewId,
        retestId: handoff.evidence.retestId,
        humanReviewStatus: "required_not_completed",
      },
    };
    return context;
  }
  if (
    !cycle ||
    !diagnostic ||
    cycle.protocolVersion !== WORKSPACE_PROTOCOL ||
    !["in_progress", "completed"].includes(String(cycle.status)) ||
    diagnostic.protocolVersion !== WORKSPACE_PROTOCOL ||
    diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL ||
    diagnostic.taskSetVersion !== TASK_SET_VERSION ||
    diagnostic.taskSetDigest !== TASK_SET_DIGEST ||
    diagnostic.status !== "completed" ||
    diagnostic.adultConfirmed !== true ||
    !isRecord(diagnostic.devicePrecheck) ||
    diagnostic.devicePrecheck.storageStatus !== "available" ||
    diagnostic.cycleId !== cycle.cycleId ||
    diagnostic.diagnosticSessionId !== cycle.diagnosticSessionId ||
    !isId(cycle.cycleId) ||
    !isId(cycle.diagnosticSessionId) ||
    diagnostic.learnerConfirmedPriority !== true ||
    !isSkill(diagnostic.prioritySkill) ||
    diagnostic.automatedScoreProduced !== false ||
    diagnostic.formalDiagnosisProduced !== false
  ) return undefined;

  const evidence = Array.isArray(diagnostic.taskEvidence) ? diagnostic.taskEvidence : [];
  const evidenceIds = evidence.filter(isRecord).map((item) => item.taskId);
  const expectedIds = Object.keys(TASK_MANIFEST);
  if (
    evidence.length !== expectedIds.length ||
    new Set(evidenceIds).size !== expectedIds.length ||
    !expectedIds.every((taskId) => evidenceIds.includes(taskId)) ||
    !evidence.every(validEvidence)
  ) return undefined;

  const completedEvidence = evidence.filter((item) => isRecord(item) && item.status === "completed");
  const completedEvidenceSkills = [...new Set(completedEvidence.map((item) => item.skill).filter(isSkill))];
  const context: LearnerContext = {
    protocolVersion: WORKSPACE_PROTOCOL,
    adultConfirmed: true,
    summaryIntegrity: "unsigned_device_summary",
    cycleId: cycle.cycleId as string,
    diagnosticSessionId: cycle.diagnosticSessionId as string,
    taskSetVersion: TASK_SET_VERSION,
    taskSetDigest: TASK_SET_DIGEST,
    terminalEvidenceTaskCount: 6,
    prioritySkill: diagnostic.prioritySkill,
    completedEvidenceTaskCount: completedEvidence.length,
    completedEvidenceSkills,
    ...(diagnostic.evidenceSufficiency === "evidence_limited" || diagnostic.evidenceSufficiency === "evidence_insufficient"
      ? { evidenceSufficiency: diagnostic.evidenceSufficiency }
      : {}),
    ...(diagnostic.evidenceConfidence === "low" || diagnostic.evidenceConfidence === "medium"
      ? { evidenceConfidence: diagnostic.evidenceConfidence }
      : {}),
    ...(typeof diagnostic.priorityBasis === "string" && PRIORITY_BASES.has(diagnostic.priorityBasis)
      ? { priorityBasis: diagnostic.priorityBasis as LearnerContext["priorityBasis"] }
      : {}),
  };

  const basePlan = planById(value, cycle.basePlanId);
  const basePlanValid = Boolean(
    basePlan &&
    basePlan.planId === cycle.basePlanId &&
    basePlan.diagnosticSessionId === cycle.diagnosticSessionId &&
    isRecord(basePlan.provenance) &&
    basePlan.provenance.cycleId === cycle.cycleId &&
    basePlan.provenance.diagnosticSessionId === cycle.diagnosticSessionId &&
    basePlan.provenance.taskSetVersion === TASK_SET_VERSION &&
    basePlan.provenance.taskSetDigest === TASK_SET_DIGEST,
  );
  if (!basePlanValid || !basePlan) return context;

  const recommendation = isRecord(journey.recommendation) ? journey.recommendation : undefined;
  const baseTaskIds = new Set(
    (Array.isArray(basePlan.days) ? basePlan.days.filter(isRecord) : [])
      .flatMap((day) => Array.isArray(day.tasks) ? day.tasks.filter(isRecord).map((task) => task.taskId) : []),
  );
  const recommendationValid = Boolean(
    recommendation &&
    recommendation.recommendationId === cycle.recommendationId &&
    recommendation.cycleId === cycle.cycleId &&
    recommendation.diagnosticSessionId === cycle.diagnosticSessionId &&
    recommendation.planId === cycle.basePlanId &&
    ["accepted", "skipped"].includes(String(recommendation.status)) &&
    isRecord(recommendation.primary) &&
    baseTaskIds.has(recommendation.primary.taskId),
  );

  const review = isRecord(journey.review) ? journey.review : undefined;
  const peerHelp = isRecord(journey.peerHelp) ? journey.peerHelp : undefined;
  const retest = isRecord(journey.retest) ? journey.retest : undefined;
  const planUpdate = isRecord(journey.planUpdate) ? journey.planUpdate : undefined;
  const checkIn = allCheckIns(value).find((item) => item.checkInId === cycle.checkInId);
  const checkInValid = Boolean(
    recommendationValid &&
    checkIn?.status === "saved" &&
    checkIn.checkInId === cycle.checkInId &&
    checkIn.cycleId === cycle.cycleId &&
    checkIn.planId === cycle.basePlanId &&
    checkIn.recommendationId === cycle.recommendationId &&
    baseTaskIds.has(checkIn.linkedTaskId),
  );
  const reviewValid = Boolean(
    checkInValid &&
    review?.reviewId === cycle.reviewId &&
    review?.cycleId === cycle.cycleId &&
    review?.checkInId === cycle.checkInId &&
    review?.learnerConfirmed === true &&
    checkIn?.reviewId === review?.reviewId &&
    checkIn?.learnerConfirmedReview === true,
  );
  const peerHelpValid = Boolean(
    reviewValid &&
    peerHelp?.peerHelpId === cycle.peerHelpId &&
    peerHelp?.cycleId === cycle.cycleId &&
    peerHelp?.reviewId === cycle.reviewId &&
    ["used", "declined", "not_needed", "unavailable"].includes(String(peerHelp?.status)) &&
    peerHelp?.realCommunityUsed === false,
  );
  const retestValid = Boolean(
    peerHelpValid &&
    retest?.status === "completed" &&
    retest?.retestId === cycle.retestId &&
    retest?.cycleId === cycle.cycleId &&
    retest?.diagnosticSessionId === cycle.diagnosticSessionId &&
    retest?.planId === cycle.basePlanId &&
    retest?.recommendationId === cycle.recommendationId &&
    retest?.checkInId === cycle.checkInId &&
    retest?.reviewId === cycle.reviewId &&
    retest?.peerHelpId === cycle.peerHelpId &&
    retest?.parallelRetest === true &&
    retest?.automatedScoreProduced === false &&
    retest?.growthClaimProduced === false,
  );
  const updatedPlan = planById(value, cycle.updatedPlanId);
  const updateValid = Boolean(
    retestValid &&
    cycle.status === "completed" &&
    planUpdate?.cycleId === cycle.cycleId &&
    planUpdate?.updatedPlanId === cycle.updatedPlanId &&
    planUpdate?.supersedesPlanId === cycle.basePlanId &&
    planUpdate?.retestId === cycle.retestId &&
    planUpdate?.learnerConfirmed === true &&
    updatedPlan?.planId === cycle.updatedPlanId &&
    isRecord(updatedPlan?.provenance) &&
    updatedPlan.provenance.cycleId === cycle.cycleId &&
    updatedPlan.provenance.diagnosticSessionId === cycle.diagnosticSessionId &&
    updatedPlan.provenance.taskSetVersion === TASK_SET_VERSION &&
    updatedPlan.provenance.taskSetDigest === TASK_SET_DIGEST &&
    updatedPlan.provenance.retestId === cycle.retestId &&
    updatedPlan.provenance.supersedesPlanId === cycle.basePlanId,
  );
  const selectedPlan = updateValid && updatedPlan ? updatedPlan : basePlan;
  const focusSkill = selectedPlan && isAnySkill(selectedPlan.focusSkill) ? selectedPlan.focusSkill : undefined;
  const dailyMinutes = Number(selectedPlan?.dailyMinutes);
  if (focusSkill && isId(selectedPlan?.planId)) {
    context.plan = {
      planId: selectedPlan.planId as string,
      basePlanId: cycle.basePlanId as string,
      cycleId: cycle.cycleId as string,
      diagnosticSessionId: cycle.diagnosticSessionId as string,
      taskSetVersion: TASK_SET_VERSION,
      stage: updateValid ? "updated" : "base",
      focusSkill,
      ...(Number.isInteger(dailyMinutes) && dailyMinutes >= 10 && dailyMinutes <= 180 ? { dailyMinutes } : {}),
      ...(currentTaskSkill(selectedPlan) ? { currentTaskSkill: currentTaskSkill(selectedPlan) } : {}),
    };
  }
  if (context.plan && recommendationValid && recommendation && isId(recommendation.recommendationId)) {
    context.recommendation = {
      recommendationId: recommendation.recommendationId as string,
      planId: cycle.basePlanId as string,
      cycleId: cycle.cycleId as string,
      diagnosticSessionId: cycle.diagnosticSessionId as string,
      status: recommendation.status as "accepted" | "skipped",
    };
  }
  if (!context.plan) return context;
  context.progress = {
    checkInRecorded: checkInValid,
    learnerReviewConfirmed: reviewValid,
    retestRecorded: retestValid,
    updatedPlanConfirmed: updateValid,
    ...(checkInValid && isId(cycle.checkInId) ? { checkInId: cycle.checkInId as string } : {}),
    ...(reviewValid && isId(cycle.reviewId) ? { reviewId: cycle.reviewId as string } : {}),
    ...(retestValid && isId(cycle.retestId) ? { retestId: cycle.retestId as string } : {}),
    ...(updateValid && isId(cycle.updatedPlanId) ? { updatedPlanId: cycle.updatedPlanId as string } : {}),
  };
  return context;
}
