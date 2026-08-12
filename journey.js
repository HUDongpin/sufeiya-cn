(async () => {
  "use strict";

  const STORAGE_KEY = "sufeiya_workspace_v1";
  const SCHEMA_VERSION = 1;
  const PROTOCOL_VERSION = "gate_a_local_v1";
  const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
  const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
  const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
  const GATE0_STATUS_PATH = "/api/governance/status";
  const GATE0_PROTOCOL_VERSION = "sufeiya_p0_decision_log_v1";
  const GATE0_RELEASE_AUTHORIZATION = "separate_explicit_controls_required";
  const SOURCE_GOVERNANCE_PROTOCOL_VERSION = "sufeiya_content_governance_v2";
  const PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v2";
  const LEGACY_PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v1";
  const learningEventsRuntime = window.SufeiyaLearningEvents;
  const workspaceBackupRuntime = window.SufeiyaWorkspaceBackup;
  const PRACTICE_ACTIVITY_CATALOG = Object.freeze({
    "reading-library-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/reading-library/v1", activityVersion: "v1", contentId: "reading-library-v1", contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f", skill: "Reading", route: "/practice-reading", receiptEvidenceClass: "objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", responseType: "single_choice", domCompletionRule: "final_answer_correct", correctValue: "b" }),
    "listening-club-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/listening-club/v1", activityVersion: "v1", contentId: "listening-club-v1", contentHash: "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb", skill: "Listening", route: "/practice-listening", receiptEvidenceClass: "audio_objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", responseType: "single_choice_audio", domCompletionRule: "final_answer_correct_with_audio_quality", correctValue: "b" }),
    "writing-community-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/writing-community/v1", activityVersion: "v1", contentId: "writing-community-v1", contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b", skill: "Writing", route: "/practice-writing", receiptEvidenceClass: "self_reviewed_artifact", evidenceType: "task_completed_no_score", completionCondition: "minimum_words_and_self_review", responseType: "local_text_self_review", domCompletionRule: "minimum_words_and_all_self_checks", minimumWords: 20 }),
    "speaking-skill-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/speaking-skill/v1", activityVersion: "v1", contentId: "speaking-skill-v1", contentHash: "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843", skill: "Speaking", route: "/practice-speaking", receiptEvidenceClass: "timed_self_report", evidenceType: "task_completed_no_score", completionCondition: "timer_and_self_review", responseType: "timed_self_report", domCompletionRule: "full_timer_and_all_self_checks", prepSeconds: 20, responseSeconds: 60 }),
  });
  const RETEST_TASK_CATALOG = Object.freeze({
    Reading: Object.freeze({ taskId: "retest-reading-garden-labels-v1", taskVersion: "v1", parallelFormPairId: "gate-a-reading-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice", correctValue: "b", humanReviewRule: "incorrect_objective_response" }),
    Listening: Object.freeze({ taskId: "retest-listening-writing-center-v1", taskVersion: "v1", parallelFormPairId: "gate-a-listening-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice_audio", correctValue: "c", humanReviewRule: "incorrect_or_insufficient_audio_evidence", audioEvidenceRule: "full_play_without_seek_transcript_or_failure" }),
    Writing: Object.freeze({ taskId: "retest-writing-study-habit-v1", taskVersion: "v1", parallelFormPairId: "gate-a-writing-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "self_reviewed_writing", minimumWordCount: 20, humanReviewRule: "always_required_for_open_response" }),
    Speaking: Object.freeze({ taskId: "retest-speaking-study-place-v1", taskVersion: "v1", parallelFormPairId: "gate-a-speaking-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "learner_confirmed_speaking", humanReviewRule: "always_required_for_open_response" }),
  });
  const RETEST_WRITING_MAX_CHARACTERS = 1200;
  const RETEST_WRITING_MAX_WORDS = Math.floor((RETEST_WRITING_MAX_CHARACTERS + 1) / 2);
  const DIAGNOSTIC_TASK_MANIFEST = Object.freeze({
    "diagnostic-reading-library-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "purpose_from_supporting_details", contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7", correctValue: "b" }),
    "diagnostic-reading-newsletter-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "cause_from_text_structure", contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca", correctValue: "b" }),
    "diagnostic-listening-science-club-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "schedule_change_detail", contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308", correctValue: "b" }),
    "diagnostic-listening-language-lab-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "time_and_location_integration", contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd", correctValue: "a" }),
    "diagnostic-speaking-learning-skill-v1": Object.freeze({ taskVersion: "v1", skill: "Speaking", responseType: "timed_self_report", constructTag: "task_coverage_and_connected_thoughts_self_report", contentHash: "8d40b58172fbd68371784db6caa74a57e37e480c288f64fca9fc1a772d9acdf9" }),
    "diagnostic-writing-learning-place-v1": Object.freeze({ taskVersion: "v1", skill: "Writing", responseType: "timed_local_text", constructTag: "task_response_structure_self_review", contentHash: "83cef1ddc39ff2a78e76fcb89de376c63fe7f6e859e1a3bf16e14b97652b3f85" }),
  });
  const DIAGNOSTIC_TASK_IDS = Object.freeze(Object.keys(DIAGNOSTIC_TASK_MANIFEST));
  const DIAGNOSTIC_TERMINAL_STATES = new Set(["completed", "skipped", "evidence_insufficient", "unavailable"]);
  const DIAGNOSTIC_EVIDENCE_STATES = new Set(["evidence_limited", "evidence_insufficient"]);
  const DIAGNOSTIC_QUALITY_FLAGS = new Set([
    "audio_not_played",
    "audio_not_completed",
    "audio_seek_detected",
    "audio_playback_failed",
    "audio_output_unavailable",
    "transcript_used",
    "multiple_replays",
    "browser_voice_variability",
    "voice_fallback_used",
    "voice_not_loaded",
    "speech_synthesis_error",
    "learner_skipped",
    "task_unavailable",
    "writing_paste_detected",
    "writing_ended_early",
    "writing_below_completion_condition",
    "speaking_ended_early",
    "self_review_incomplete",
    "audio_not_recorded",
    "open_response_not_human_reviewed",
    "resumed_after_reload",
  ]);
  const VALID_SKILLS = new Set(["Balanced", "Reading", "Listening", "Writing", "Speaking"]);
  const VALID_PEER_HELP_STATES = new Set(["used", "declined", "not_needed", "unavailable"]);
  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const skillLabels = {
    Balanced: "综合训练",
    Reading: "Reading · 阅读",
    Listening: "Listening · 听力",
    Writing: "Writing · 写作",
    Speaking: "Speaking · 口语",
    Reflection: "学习复盘",
    General: "英文热身",
  };
  const skillRoutes = {
    Reading: "/practice-reading",
    Listening: "/practice-listening",
    Writing: "/practice-writing",
    Speaking: "/practice-speaking",
    Reflection: "/check-in",
    General: "/practice",
  };
  const skillTasks = {
    Reading: ["完成一篇英文短文阅读", "找出主旨，并说明支持它的一条信息"],
    Listening: ["完成一段英文听力练习", "记录听到的时间、变化或关键事实"],
    Writing: ["完成一个英文写作提示", "写清一个观点，并用理由或例子支持"],
    Speaking: ["完成一次英文口语计时", "回应所有问题，并给出至少一个具体例子"],
  };
  const sequences = {
    Balanced: ["Reading", "Listening", "Writing", "Speaking", "Reading", "Listening", "Writing"],
    Reading: ["Reading", "Listening", "Reading", "Writing", "Reading", "Speaking", "Reading"],
    Listening: ["Listening", "Reading", "Listening", "Writing", "Listening", "Speaking", "Listening"],
    Writing: ["Writing", "Reading", "Writing", "Listening", "Writing", "Speaking", "Writing"],
    Speaking: ["Speaking", "Reading", "Speaking", "Listening", "Speaking", "Writing", "Speaking"],
  };
  const practiceCatalogForSkill = (skill) => {
    const match = Object.entries(PRACTICE_ACTIVITY_CATALOG).find(([, entry]) => entry.skill === skill);
    return match ? { exerciseId: match[0], ...match[1] } : null;
  };
  const priorityBasisLabels = {
    objective_first_response_pattern: "客观题首答模式",
    evidence_quality_gap: "证据质量缺口",
    open_response_coverage_gap: "开放作答覆盖缺口",
    learner_confirmation_after_multiple_gaps: "多项证据缺口后的学习者确认",
    learner_confirmation_after_tie: "证据并列后的学习者确认",
  };

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const exactObjectKeys = (value, expectedKeys) =>
    isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort());
  const isSafeLocalRoute = (route) =>
    typeof route === "string" && route.startsWith("/") && !route.startsWith("//") && !/[\\\u0000-\u001f\u007f]/.test(route);
  const hasValidPlanShape = (plan) => {
    if (plan === null || plan === undefined) return true;
    if (!isRecord(plan) || !Array.isArray(plan.days)) return false;
    return plan.days.every(
      (day) =>
        isRecord(day) &&
        typeof day.date === "string" &&
        typeof day.coreSkill === "string" &&
        Array.isArray(day.tasks) &&
        day.tasks.every(
          (task) =>
            isRecord(task) &&
            typeof task.taskId === "string" &&
            typeof task.titleZh === "string" &&
            typeof task.instructionZh === "string" &&
            Number.isFinite(Number(task.durationMinutes)) &&
            isSafeLocalRoute(task.route),
        ),
    );
  };
  const hasValidPracticeEvidencePayload = (receipt, catalog) => {
    const evidence = receipt.evidence;
    if (!isRecord(evidence)) return false;
    if (["objective_response", "audio_objective_response"].includes(catalog.receiptEvidenceClass)) {
      const choiceValid =
        ["a", "b", "c"].includes(evidence.firstResponse) &&
        ["a", "b", "c"].includes(evidence.finalResponse) &&
        evidence.finalResponse === catalog.correctValue &&
        Number.isInteger(evidence.attemptCount) &&
        evidence.attemptCount >= 1 &&
        evidence.attemptCount === receipt.attemptCount &&
        (evidence.attemptCount === 1
          ? evidence.firstResponse === catalog.correctValue
          : evidence.firstResponse !== catalog.correctValue) &&
        evidence.resultType === "correct" &&
        (evidence.attemptCount > 1) === receipt.qualityFlags.includes("multiple_attempts");
      if (!choiceValid) return false;
      if (catalog.receiptEvidenceClass === "objective_response") {
        return receipt.evidenceStatus === "evidence_limited";
      }
      const audioFlags = ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "transcript_used"];
      const audioSufficient =
        evidence.audioPlayed === true &&
        evidence.audioCompleted === true &&
        Number.isInteger(evidence.playCount) &&
        evidence.playCount >= 1 &&
        evidence.transcriptUsed === false &&
        evidence.seekDetected === false &&
        evidence.playbackFailed === false &&
        !receipt.qualityFlags.some((flag) => audioFlags.includes(flag));
      const audioCompletionCoherent = Boolean(
        evidence.audioCompleted !== true ||
        (evidence.audioPlayed === true && evidence.seekDetected === false && evidence.playbackFailed === false)
      );
      return Boolean(
        audioCompletionCoherent &&
        evidence.audioPlayed === receipt.audioPlayed &&
        evidence.audioCompleted === receipt.audioCompleted &&
        evidence.transcriptUsed === receipt.qualityFlags.includes("transcript_used") &&
        evidence.seekDetected === receipt.qualityFlags.includes("audio_seek_detected") &&
        evidence.playbackFailed === receipt.qualityFlags.includes("audio_playback_failed") &&
        receipt.evidenceStatus === (audioSufficient ? "evidence_limited" : "evidence_insufficient")
      );
    }
    if (catalog.receiptEvidenceClass === "self_reviewed_artifact") {
      return Boolean(
        Number.isInteger(evidence.wordCount) &&
        evidence.wordCount >= catalog.minimumWords &&
        evidence.wordCount === receipt.wordCount &&
        evidence.selfChecks?.idea === true &&
        evidence.selfChecks?.reason === true &&
        evidence.selfChecks?.edit === true &&
        evidence.selfCheckCount === 3 &&
        evidence.selfCheckCount === receipt.selfCheckCount &&
        /^[0-9a-f]{64}$/.test(evidence.artifactHash || "") &&
        evidence.resultType === "completed_no_score" &&
        receipt.evidenceStatus === "evidence_limited" &&
        receipt.qualityFlags.includes("open_response_not_human_reviewed")
      );
    }
    if (catalog.receiptEvidenceClass === "timed_self_report") {
      return Boolean(
        evidence.prepSeconds === catalog.prepSeconds &&
        evidence.responseSeconds === catalog.responseSeconds &&
        evidence.timerCompleted === true &&
        evidence.selfChecks?.answer === true &&
        evidence.selfChecks?.example === true &&
        evidence.selfChecks?.flow === true &&
        evidence.selfCheckCount === 3 &&
        evidence.selfCheckCount === receipt.selfCheckCount &&
        evidence.audioRecorded === false &&
        receipt.audioRecorded === false &&
        evidence.resultType === "completed_no_score" &&
        receipt.evidenceStatus === "evidence_limited" &&
        receipt.qualityFlags.includes("audio_not_recorded") &&
        receipt.qualityFlags.includes("open_response_not_human_reviewed")
      );
    }
    return false;
  };
  const expectedPracticeReceiptQualityFlags = (receipt, catalog) => {
    if (!isRecord(receipt?.evidence) || !catalog) return null;
    if (catalog.skill === "Writing") return ["open_response_not_human_reviewed"];
    if (catalog.skill === "Speaking") {
      return ["audio_not_recorded", "open_response_not_human_reviewed"];
    }
    const flags = [];
    if (receipt.evidence.attemptCount > 1) flags.push("multiple_attempts");
    if (catalog.skill === "Listening") {
      if (receipt.evidence.audioPlayed !== true) flags.push("audio_not_played");
      if (receipt.evidence.audioCompleted !== true) flags.push("audio_not_completed");
      if (receipt.evidence.seekDetected === true) flags.push("audio_seek_detected");
      if (receipt.evidence.playbackFailed === true) flags.push("audio_playback_failed");
      if (receipt.evidence.transcriptUsed === true) flags.push("transcript_used");
    }
    return flags;
  };
  const practiceReceiptExactKeys = (value, keys) => Boolean(
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
  const PRACTICE_RECEIPT_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const exactPracticeReceiptTimestamp = (value) => {
    if (typeof value !== "string" || !PRACTICE_RECEIPT_ISO_PATTERN.test(value)) return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  };
  const practiceReceiptDomainIdValid = (value) => Boolean(
    typeof value === "string" && value.length >= 3 && value.length <= 180 && !/[\u0000-\u001f\u007f]/.test(value)
  );
  const practiceReceiptScopeShapeValid = (receipt) => {
    const scopeValues = [
      receipt.taskId,
      receipt.taskDate,
      receipt.planId,
      receipt.cycleId,
      receipt.diagnosticSessionId,
      receipt.recommendationId,
    ];
    if (scopeValues.every((value) => value === null)) return receipt.taskRef === null;
    if (
      !practiceReceiptDomainIdValid(receipt.taskId) ||
      !practiceReceiptDomainIdValid(receipt.planId) ||
      typeof receipt.taskDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(receipt.taskDate) ||
      !practiceReceiptExactKeys(receipt.taskRef, ["cycleId", "diagnosticSessionId", "planId", "taskDate", "taskId"]) ||
      receipt.taskRef.planId !== receipt.planId ||
      receipt.taskRef.taskId !== receipt.taskId ||
      receipt.taskRef.taskDate !== receipt.taskDate
    ) return false;
    const cycleValues = [receipt.cycleId, receipt.diagnosticSessionId, receipt.recommendationId];
    if (cycleValues.every((value) => value === null)) {
      return receipt.taskRef.cycleId === null && receipt.taskRef.diagnosticSessionId === null;
    }
    return Boolean(
      cycleValues.every(practiceReceiptDomainIdValid) &&
      receipt.taskRef.cycleId === receipt.cycleId &&
      receipt.taskRef.diagnosticSessionId === receipt.diagnosticSessionId
    );
  };
  const validPracticeReceiptWriterSemantics = (receipt, catalog) => {
    if (
      !catalog ||
      receipt.practiceAttemptId === receipt.completionReceiptId ||
      receipt.completionSource !== "guided_practice" ||
      receipt.evidenceClass !== "practice_receipt" ||
      receipt.automatedScoreProduced !== false ||
      receipt.formalDiagnosisProduced !== false ||
      receipt.officialEquivalenceClaimed !== false ||
      !exactPracticeReceiptTimestamp(receipt.startedAt) ||
      !exactPracticeReceiptTimestamp(receipt.completedAt) ||
      Date.parse(receipt.startedAt) > Date.parse(receipt.completedAt) ||
      !practiceReceiptExactKeys(receipt.contentRef, ["contentHash", "contentId", "contentVersion", "exerciseId"]) ||
      receipt.contentRef.exerciseId !== receipt.exerciseId ||
      receipt.contentRef.contentId !== catalog.contentId ||
      receipt.contentRef.contentVersion !== catalog.activityVersion ||
      receipt.contentRef.contentHash !== catalog.contentHash ||
      !practiceReceiptScopeShapeValid(receipt)
    ) return false;

    const evidence = receipt.evidence;
    if (catalog.skill === "Reading") {
      return Boolean(
        practiceReceiptExactKeys(evidence, ["attemptCount", "finalResponse", "firstResponse", "resultType"]) &&
        receipt.attemptCount === evidence.attemptCount &&
        receipt.wordCount === null &&
        receipt.selfCheckCount === null &&
        receipt.audioPlayed === false &&
        receipt.audioCompleted === false &&
        receipt.audioRecorded === false
      );
    }
    if (catalog.skill === "Listening") {
      return Boolean(
        practiceReceiptExactKeys(evidence, [
          "attemptCount", "audioCompleted", "audioPlayed", "finalResponse", "firstResponse", "playCount",
          "playbackFailed", "resultType", "seekDetected", "transcriptUsed",
        ]) &&
        receipt.attemptCount === evidence.attemptCount &&
        receipt.wordCount === null &&
        receipt.selfCheckCount === null &&
        receipt.audioPlayed === evidence.audioPlayed &&
        receipt.audioCompleted === evidence.audioCompleted &&
        receipt.audioRecorded === false &&
        Number.isInteger(evidence.playCount) &&
        evidence.playCount >= 0 &&
        evidence.audioPlayed === (evidence.playCount >= 1) &&
        (evidence.audioCompleted !== true || (
          evidence.audioPlayed === true && evidence.seekDetected === false && evidence.playbackFailed === false
        ))
      );
    }
    if (catalog.skill === "Writing") {
      return Boolean(
        practiceReceiptExactKeys(evidence, ["artifactHash", "resultType", "selfCheckCount", "selfChecks", "wordCount"]) &&
        practiceReceiptExactKeys(evidence.selfChecks, ["edit", "idea", "reason"]) &&
        receipt.attemptCount === null &&
        receipt.wordCount === evidence.wordCount &&
        receipt.selfCheckCount === evidence.selfCheckCount &&
        receipt.audioPlayed === false &&
        receipt.audioCompleted === false &&
        receipt.audioRecorded === false
      );
    }
    if (catalog.skill === "Speaking") {
      return Boolean(
        practiceReceiptExactKeys(evidence, [
          "audioRecorded", "prepSeconds", "responseSeconds", "resultType", "selfCheckCount", "selfChecks",
          "timerCompleted",
        ]) &&
        practiceReceiptExactKeys(evidence.selfChecks, ["answer", "example", "flow"]) &&
        receipt.attemptCount === null &&
        receipt.wordCount === null &&
        receipt.selfCheckCount === evidence.selfCheckCount &&
        receipt.audioPlayed === false &&
        receipt.audioCompleted === false &&
        receipt.audioRecorded === evidence.audioRecorded
      );
    }
    return false;
  };
  const hasValidPracticeReceiptShape = (receipt, receiptId = null) => {
    if (!isRecord(receipt) || receipt.protocolVersion !== PRACTICE_RECEIPT_VERSION) return false;
    const catalog = PRACTICE_ACTIVITY_CATALOG[receipt.exerciseId];
    const expectedQualityFlags = expectedPracticeReceiptQualityFlags(receipt, catalog);
    return Boolean(
      catalog &&
      UUID_V4_PATTERN.test(receipt.practiceAttemptId || "") &&
      UUID_V4_PATTERN.test(receipt.completionReceiptId || "") &&
      (!receiptId || receiptId === receipt.completionReceiptId) &&
      receipt.sealed === true &&
      receipt.ownerScope === "browser_local_not_account_bound" &&
      receipt.integrityClass === "unsigned_local_receipt" &&
      receipt.activityId === catalog.activityId &&
      receipt.activityVersion === catalog.activityVersion &&
      receipt.contentId === catalog.contentId &&
      receipt.contentHash === catalog.contentHash &&
      receipt.skill === catalog.skill &&
      receipt.route === catalog.route &&
      receipt.receiptEvidenceClass === catalog.receiptEvidenceClass &&
      receipt.evidenceType === catalog.evidenceType &&
      receipt.completionCondition === catalog.completionCondition &&
      ["evidence_limited", "evidence_insufficient"].includes(receipt.evidenceStatus) &&
      Array.isArray(receipt.qualityFlags) &&
      JSON.stringify(receipt.qualityFlags) === JSON.stringify(expectedQualityFlags) &&
      receipt.status === "completed" &&
      hasValidPracticeEvidencePayload(receipt, catalog) &&
      validPracticeReceiptWriterSemantics(receipt, catalog)
    );
  };
  const hasSafeLegacyPracticeReceiptShape = (receipt, receiptId = null) => {
    if (
      !isRecord(receipt) ||
      receipt.protocolVersion !== LEGACY_PRACTICE_RECEIPT_VERSION ||
      receipt.evidence !== undefined
    ) return false;
    const catalog = PRACTICE_ACTIVITY_CATALOG[receipt.exerciseId];
    return Boolean(
      catalog &&
      UUID_V4_PATTERN.test(receipt.practiceAttemptId || "") &&
      UUID_V4_PATTERN.test(receipt.completionReceiptId || "") &&
      (!receiptId || receiptId === receipt.completionReceiptId) &&
      receipt.sealed === true &&
      receipt.ownerScope === "browser_local_not_account_bound" &&
      receipt.integrityClass === "unsigned_local_receipt" &&
      receipt.activityId === catalog.activityId &&
      receipt.activityVersion === catalog.activityVersion &&
      receipt.contentId === catalog.contentId &&
      receipt.contentHash === catalog.contentHash &&
      receipt.skill === catalog.skill &&
      receipt.route === catalog.route &&
      receipt.receiptEvidenceClass === catalog.receiptEvidenceClass &&
      receipt.evidenceType === catalog.evidenceType &&
      receipt.completionCondition === catalog.completionCondition &&
      ["evidence_limited", "evidence_insufficient"].includes(receipt.evidenceStatus) &&
      Array.isArray(receipt.qualityFlags) &&
      receipt.qualityFlags.every((flag) => typeof flag === "string") &&
      receipt.status === "completed" &&
      receipt.completionSource === "guided_practice" &&
      receipt.evidenceClass === "practice_receipt" &&
      receipt.automatedScoreProduced === false &&
      receipt.formalDiagnosisProduced === false &&
      receipt.officialEquivalenceClaimed === false &&
      typeof receipt.completedAt === "string" &&
      !Number.isNaN(Date.parse(receipt.completedAt))
    );
  };
  const isoNow = () => new Date().toISOString();
  const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const keyForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };
  const clearChildren = (node) => node?.replaceChildren();
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };

  const freshState = () => ({
    schemaVersion: SCHEMA_VERSION,
    updatedAt: isoNow(),
    profile: { nickname: "", examDate: "", dailyMinutes: 30, focusSkill: "Balanced" },
    plan: null,
    planHistory: [],
    taskProgress: {},
    practice: {},
    practiceReceipts: {},
    learningEvents: [],
    learningEventBindings: null,
    checkIns: {},
    checkInHistory: [],
    focus: { active: null, sessions: [] },
    journey: {
      protocolVersion: PROTOCOL_VERSION,
      activeCycle: null,
      diagnostic: null,
      recommendation: null,
      review: null,
      peerHelp: null,
      retest: null,
      planUpdate: null,
      history: [],
      supersededCycles: [],
    },
  });

  let state = freshState();
  let storageWritable = true;
  let storageWarningShown = false;
  let rawStoredValue = null;

  const acquireSharedWorkspaceWriterLease = () => {
    if (window.__sufeiyaWorkspaceWriterLease?.ready) return window.__sufeiyaWorkspaceWriterLease.ready;
    const lease = { available: false, ready: null };
    lease.ready = new Promise((resolve) => {
      if (!navigator.locks?.request) {
        resolve(false);
        return;
      }
      navigator.locks.request(`${STORAGE_KEY}:page-writer`, { mode: "exclusive", ifAvailable: true }, (lock) => {
        lease.available = Boolean(lock);
        resolve(lease.available);
        if (!lock) return undefined;
        return new Promise((release) => {
          window.addEventListener("pagehide", () => {
            delete window.__sufeiyaWorkspaceWriterLease;
            release();
          }, { once: true });
        });
      }).catch(() => resolve(false));
    });
    window.__sufeiyaWorkspaceWriterLease = lease;
    return lease.ready;
  };

  const showStorageWarning = (message) => {
    if (storageWarningShown) return;
    storageWarningShown = true;
    const banner = document.createElement("div");
    banner.className = "storage-warning";
    banner.setAttribute("role", "alert");
    banner.textContent = message;
    document.querySelector("main")?.before(banner);
  };

  const disableJourneyControls = () => {
    document.querySelectorAll("#diagnostic-start-form, #diagnostic-priority-form, #review-form, #community-form, #retest-form, #plan-update-form").forEach((form) => {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
    });
    document.querySelectorAll("[data-diagnostic-runner] button, [data-diagnostic-restart], [data-accept-recommendation], [data-skip-recommendation]").forEach((control) => {
      control.disabled = true;
    });
  };

  const normalizeState = (value) => {
    if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return null;
    if (!hasValidPlanShape(value.plan)) return null;
    if (value.profile !== undefined && !isRecord(value.profile)) return null;
    if (value.journey !== undefined) {
      if (!isRecord(value.journey) || value.journey.protocolVersion !== PROTOCOL_VERSION) return null;
      if (
        value.journey.activeCycle !== undefined &&
        value.journey.activeCycle !== null &&
        (!isRecord(value.journey.activeCycle) || value.journey.activeCycle.protocolVersion !== PROTOCOL_VERSION)
      ) {
        return null;
      }
    }
    for (const key of ["taskProgress", "practice", "practiceReceipts", "checkIns"]) {
      if (value[key] !== undefined && !isRecord(value[key])) return null;
    }
    if (
      value.practiceReceipts !== undefined &&
      !Object.entries(value.practiceReceipts).every(([receiptId, receipt]) =>
        hasValidPracticeReceiptShape(receipt, receiptId) || hasSafeLegacyPracticeReceiptShape(receipt, receiptId),
      )
    ) return null;
    if (value.planHistory !== undefined && !Array.isArray(value.planHistory)) return null;
    if (Array.isArray(value.planHistory) && !value.planHistory.every(hasValidPlanShape)) return null;
    if (value.checkInHistory !== undefined && !Array.isArray(value.checkInHistory)) return null;
    const base = freshState();
    return {
      ...base,
      ...value,
      profile: { ...base.profile, ...(value.profile || {}) },
      planHistory: Array.isArray(value.planHistory) ? value.planHistory : [],
      taskProgress: value.taskProgress || {},
      practice: value.practice || {},
      practiceReceipts: value.practiceReceipts || {},
      learningEvents: value.learningEvents === undefined ? [] : value.learningEvents,
      learningEventBindings: value.learningEventBindings === undefined ? null : value.learningEventBindings,
      checkIns: value.checkIns || {},
      checkInHistory: Array.isArray(value.checkInHistory) ? value.checkInHistory : [],
      focus: isRecord(value.focus)
        ? { active: value.focus.active || null, sessions: Array.isArray(value.focus.sessions) ? value.focus.sessions : [] }
        : base.focus,
      journey: {
        ...base.journey,
        ...(value.journey || {}),
        history: Array.isArray(value.journey?.history) ? value.journey.history : [],
      },
    };
  };

  const loadState = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      rawStoredValue = raw;
      if (!raw) return;
      const normalized = normalizeState(JSON.parse(raw));
      if (!normalized) {
        storageWritable = false;
        showStorageWarning("发现无法识别的本机学习数据。为避免覆盖，闭环功能已切换为只读；请先在“我的本机数据”导出或清除旧数据。");
        disableJourneyControls();
        return;
      }
      state = normalized;
      if (
        !window.__sufeiyaLegacyReceiptWarningShown &&
        Object.values(state.practiceReceipts).some((receipt) => receipt?.protocolVersion === LEGACY_PRACTICE_RECEIPT_VERSION)
      ) {
        window.__sufeiyaLegacyReceiptWarningShown = true;
        showStorageWarning("已保留旧版练习记录，但旧回执缺少可复算证据字段，不会继续推进当前闭环；请重新完成绑定练习生成 v2 回执。");
      }
    } catch {
      storageWritable = false;
      showStorageWarning("当前本机学习数据无法安全读取。为避免覆盖，闭环功能已切换为只读。");
      disableJourneyControls();
    }
  };

  const persist = () => {
    if (!storageWritable) return false;
    state.updatedAt = isoNow();
    try {
      const nextRaw = JSON.stringify(state);
      window.localStorage.setItem(STORAGE_KEY, nextRaw);
      rawStoredValue = nextRaw;
      return true;
    } catch {
      storageWritable = false;
      showStorageWarning("当前浏览器无法持久保存。本次页面仍可查看，但新的闭环证据不会写入本机。");
      disableJourneyControls();
      return false;
    }
  };

  const snapshotState = () => JSON.parse(JSON.stringify(state));
  const CAPACITY_FIELD_LABELS = Object.freeze({
    planHistory: "历史计划",
    journeyHistory: "闭环历史",
    taskProgress: "任务进度",
    practiceReceipts: "练习回执",
    learningEvents: "学习事件",
    checkIns: "打卡记录",
    checkInHistory: "打卡历史",
    focusSessions: "专注记录",
    supersededCycles: "中止诊断摘要",
    bindingAliases: "事件别名",
  });
  const capacityResultMessage = (result, noun = "本次操作") => {
    if (result?.status === "capacity_reached" && Number.isInteger(result.current) && Number.isInteger(result.limit)) {
      if (Number.isInteger(result.required) && result.required > 0) {
        return `${noun}未写入：${CAPACITY_FIELD_LABELS[result.field] || result.field}当前 ${result.current} 条；完成下一轮至少还需要 ${result.required} 条；安全上限 ${result.limit} 条。`;
      }
      return `${noun}未写入：${CAPACITY_FIELD_LABELS[result.field] || result.field}当前 ${result.current} 条，安全上限 ${result.limit} 条。`;
    }
    if (result?.code === "workspace_too_large") return `${noun}未写入：当前工作区 canonical JSON 已超过 1 MiB 可恢复上限。`;
    if (result?.code === "too_many_values") return `${noun}未写入：当前工作区已超过 131,072 个 JSON 值节点的结构复杂度上限。`;
    return `${noun}未写入：当前工作区未通过可恢复容量合同（${result?.code || "unknown"}）。`;
  };
  const presentCapacityFailure = (result, noun = "本次操作") => {
    let banner = document.querySelector("[data-workspace-capacity-alert]");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "storage-warning";
      banner.dataset.workspaceCapacityAlert = "true";
      banner.setAttribute("role", "alert");
      banner.setAttribute("tabindex", "-1");
      document.querySelector("main")?.before(banner);
    }
    const text = document.createElement("span");
    const recovery = result?.status === "capacity_reached"
      ? "请先到“我的本机数据”导出原始保全 JSON；若严格预检仍通过，再生成可恢复备份。完成保全后，请明确清除整个学习工作区再继续。"
      : "请先到“我的本机数据”导出原始保全 JSON；当前不保证能够生成可恢复备份。完成原始保全后，请明确清除整个学习工作区。";
    text.textContent = `${capacityResultMessage(result, noun)} ${recovery} 系统不会静默删除、截断或覆盖旧证据。 `;
    const link = document.createElement("a");
    link.href = "/my-data";
    link.textContent = "前往我的本机数据 →";
    banner.replaceChildren(text, link);
    banner.focus();
  };
  const workspaceAppendCapacity = (additions) => {
    if (!workspaceBackupRuntime?.inspectWorkspaceAppendCapacity) {
      return { status: "capacity_invalid", code: "capacity_runtime_unavailable" };
    }
    const result = workspaceBackupRuntime.inspectWorkspaceAppendCapacity(state, additions);
    if (result.status === "ready") return result;
    const failure = result.status === "capacity_reached"
      ? result
      : { ...result, status: "capacity_invalid", code: result.code || "workspace_capacity_invalid" };
    presentCapacityFailure(failure);
    return failure;
  };
  const nextGateACycleRequiredAdditions = (candidateState = state) => {
    const date = keyForDate(new Date());
    const checkIns = candidateState?.checkIns || {};
    const hasCheckInForDate = Object.hasOwn(checkIns, date);
    const hasSavedCheckInForDate = Boolean(hasCheckInForDate && checkIns[date]?.checkInId);
    return Object.freeze({
      planHistory: candidateState?.plan ? 2 : 1,
      journeyHistory: 1,
      practiceReceipts: 1,
      learningEvents: 6,
      checkIns: hasCheckInForDate ? 0 : 1,
      checkInHistory: hasSavedCheckInForDate ? 1 : 0,
      supersededCycles: candidateState?.journey?.activeCycle?.diagnosticSessionId ? 1 : 0,
      taskProgress: 2,
      bindingAliases: 11,
    });
  };
  const inspectNextGateACycleAdmission = (candidateState = state) => {
    if (!workspaceBackupRuntime?.inspectWorkspaceCapacity || !workspaceBackupRuntime?.inspectWorkspaceAppendCapacity) {
      return { status: "capacity_invalid", code: "capacity_runtime_unavailable", additions: null };
    }
    const current = workspaceBackupRuntime.inspectWorkspaceCapacity(candidateState);
    if (current.status !== "ready") {
      return {
        ...current,
        status: "capacity_invalid",
        code: current.code || "workspace_capacity_invalid",
        additions: null,
      };
    }
    const additions = nextGateACycleRequiredAdditions(candidateState);
    const result = workspaceBackupRuntime.inspectWorkspaceAppendCapacity(candidateState, additions);
    if (result.status === "ready") {
      return {
        status: "ready",
        code: "next_cycle_count_capacity_ready",
        additions,
        workspaceBytes: result.workspaceBytes,
      };
    }
    const capacityReached = result.status === "capacity_reached";
    return {
      ...result,
      status: capacityReached ? "capacity_reached" : "capacity_invalid",
      code: result.code || "workspace_capacity_invalid",
      required: result.field ? additions[result.field] : undefined,
      additions,
    };
  };
  const enforceNextGateACycleAdmission = (candidateState = state, noun = "开始下一轮") => {
    const result = inspectNextGateACycleAdmission(candidateState);
    if (result.status === "ready") return result;
    presentCapacityFailure(result, noun);
    return result;
  };
  const workspaceCandidateCapacity = (candidate) => {
    if (!workspaceBackupRuntime?.inspectWorkspaceCapacity) {
      return { status: "capacity_invalid", code: "capacity_runtime_unavailable" };
    }
    const result = workspaceBackupRuntime.inspectWorkspaceCapacity(candidate);
    if (result.status === "ready") return result;
    const capacityCodes = new Set(["workspace_count_limit", "workspace_too_large", "too_many_values", "too_deep", "string_too_long"]);
    const failure = {
      ...result,
      status: capacityCodes.has(result.code) ? "capacity_reached" : "capacity_invalid",
      code: result.code || "workspace_capacity_invalid",
    };
    presentCapacityFailure(failure);
    return failure;
  };
  const capacityFailureMessage = (noun, result) =>
    `${capacityResultMessage(result || { status: "capacity_reached" }, noun)} 请先到“我的本机数据”导出原始保全 JSON；若严格预检仍通过，再生成可恢复备份。完成保全后，请明确清除整个学习工作区再继续；系统不会静默删除或截断旧证据。`;
  const invalidCapacityMessage = (noun) =>
    `${noun}未写入：现有本机学习数据已超出可恢复合同。请先到“我的本机数据”导出原始保全 JSON；当前不保证能够生成可恢复备份。完成保全后，请明确清除整个学习工作区；系统不会覆盖现有记录。`;

  const persistedStateIsFresh = () => {
    if (!storageWritable) return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === rawStoredValue;
    } catch {
      return false;
    }
  };

  const withExclusiveJourneyWrite = async (write) => {
    if (!storageWritable || !navigator.locks?.request) return { status: "lock_unavailable" };
    try {
      return await navigator.locks.request(`${STORAGE_KEY}:sealed-write`, { mode: "exclusive" }, write);
    } catch {
      return { status: "lock_unavailable" };
    }
  };

  const appendLearningEvent = async (eventType, domain, targetState = state) => {
    if (!learningEventsRuntime) return { status: "ledger_invalid", code: "runtime_unavailable" };
    try {
      return await learningEventsRuntime.appendDomainEvent(targetState, eventType, domain);
    } catch {
      return { status: "ledger_invalid", code: "runtime_exception" };
    }
  };

  const createPlan = ({ nickname, examDate, dailyMinutes, focusSkill }, provenance, createdAt = isoNow()) => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const planId = makeId("plan");
    const minutes = Number(dailyMinutes);
    const sequence = sequences[focusSkill] || sequences.Balanced;
    const days = sequence.map((skill, index) => {
      const date = keyForDate(addDays(start, index));
      const warmupMinutes = Math.max(3, Math.floor(minutes * 0.2));
      const reflectionMinutes = Math.max(3, Math.floor(minutes * 0.2));
      const coreMinutes = minutes - warmupMinutes - reflectionMinutes;
      const practiceCatalog = practiceCatalogForSkill(skill);
      return {
        date,
        coreSkill: skill,
        tasks: [
          {
            taskId: `${planId}-${date}-warmup`,
            date,
            skill: "General",
            titleZh: "英文热身",
            instructionZh: "快速浏览今天的英文提示与关键词，明确任务要求。",
            durationMinutes: warmupMinutes,
            route: "/practice",
          },
          {
            taskId: `${planId}-${date}-${skill.toLowerCase()}`,
            date,
            skill,
            titleZh: skillTasks[skill][0],
            instructionZh: skillTasks[skill][1],
            durationMinutes: coreMinutes,
            route: skillRoutes[skill],
            contentRef: practiceCatalog
              ? {
                  exerciseId: practiceCatalog.exerciseId,
                  contentId: practiceCatalog.contentId,
                  contentVersion: practiceCatalog.activityVersion,
                  contentHash: practiceCatalog.contentHash,
                }
              : null,
          },
          {
            taskId: `${planId}-${date}-reflection`,
            date,
            skill: "Reflection",
            titleZh: "记录学习证据",
            instructionZh: "写下今天完成了什么、哪里困难，以及明天先做什么。",
            durationMinutes: reflectionMinutes,
            route: "/check-in",
          },
        ],
      };
    });
    return {
      planId,
      createdAt,
      startDate: days[0].date,
      endDate: days[6].date,
      status: "active",
      days,
      nickname,
      examDate,
      dailyMinutes: minutes,
      focusSkill,
      provenance,
    };
  };

  const activeCycle = (candidateState = state) =>
    isRecord(candidateState?.journey?.activeCycle) && candidateState.journey.activeCycle.protocolVersion === PROTOCOL_VERSION
      ? candidateState.journey.activeCycle
      : null;
  const allCheckIns = (candidateState = state) => [
    ...Object.values(candidateState?.checkIns || {}),
    ...(Array.isArray(candidateState?.checkInHistory) ? candidateState.checkInHistory : []),
  ].filter(isRecord);
  const getCheckInById = (checkInId, candidateState = state) =>
    allCheckIns(candidateState).find((item) => item.checkInId === checkInId) || null;
  const getCycleCheckIn = (candidateState = state) => {
    const cycle = activeCycle(candidateState);
    if (!cycle?.checkInId) return null;
    const record = getCheckInById(cycle.checkInId, candidateState);
    return record?.cycleId === cycle.cycleId && record?.planId === cycle.basePlanId ? record : null;
  };

  const planById = (planId, candidateState = state) => {
    if (!planId) return null;
    if (candidateState?.plan?.planId === planId) return candidateState.plan;
    return (Array.isArray(candidateState?.planHistory) ? candidateState.planHistory : [])
      .find((plan) => plan?.planId === planId) || null;
  };
  const planTaskById = (plan, taskId) =>
    plan?.days?.flatMap((day) => day.tasks || []).find((task) => task.taskId === taskId) || null;
  const planTaskBindsPracticeCatalog = (planTask, catalog) => {
    if (!isRecord(planTask) || !catalog) return false;
    if (planTask.contentRef !== undefined && planTask.contentRef !== null) {
      return Boolean(
        planTask.contentRef.exerciseId === catalog.exerciseId &&
        planTask.contentRef.contentId === catalog.contentId &&
        planTask.contentRef.contentVersion === catalog.activityVersion &&
        planTask.contentRef.contentHash === catalog.contentHash
      );
    }
    const routeMatches = Object.entries(PRACTICE_ACTIVITY_CATALOG).filter(
      ([, entry]) => entry.skill === planTask.skill && entry.route === planTask.route,
    );
    return routeMatches.length === 1 && routeMatches[0][0] === catalog.exerciseId;
  };
  const deriveRecommendationBindingCore = ({ cycle, diagnostic, plan, primary }) => {
    if (!cycle || !diagnostic || !plan || !isRecord(primary)) return null;
    const planDay = plan.days?.find((day) => day.tasks?.some((task) => task.taskId === primary.taskId));
    const planTask = planTaskById(plan, primary.taskId);
    const catalog = practiceCatalogForSkill(diagnostic.prioritySkill);
    if (
      !planDay ||
      !planTask ||
      !catalog ||
      planDay.coreSkill !== diagnostic.prioritySkill ||
      planTask.skill !== diagnostic.prioritySkill ||
      planTask.route !== catalog.route ||
      !planTaskBindsPracticeCatalog(planTask, catalog)
    ) return null;

    const expectedPrimary = {
      role: "主任务",
      taskId: planTask.taskId,
      skill: diagnostic.prioritySkill,
      exerciseId: catalog.exerciseId,
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
      title: planTask.titleZh,
      route: `${planTask.route}?${new URLSearchParams({ plan_id: plan.planId, task_id: planTask.taskId }).toString()}`,
      reason: diagnostic.report?.priorityExplanation || `当前 7 天计划把 ${skillLabels[diagnostic.prioritySkill] || diagnostic.prioritySkill} 设为这一天的核心练习。`,
      duration: `${planTask.durationMinutes} 分钟`,
      source: "Sufeiya 原创 Gate A 微练习 v1 · 未经教研与测量双签",
      verification: "从本绑定入口完成任务并生成本机练习回执，再在复盘页引用同一回执。",
      reviewStatus: "gate_a_unreviewed",
      reviewedAt: null,
      prerequisites: ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"],
    };
    const primaryMatches = Object.entries(expectedPrimary).every(([key, value]) =>
      Array.isArray(value)
        ? Array.isArray(primary[key]) && JSON.stringify(primary[key]) === JSON.stringify(value)
        : primary[key] === value,
    );
    if (!primaryMatches) return null;

    const skillEvidence = Array.isArray(diagnostic.taskEvidence)
      ? diagnostic.taskEvidence.filter((item) => item.skill === diagnostic.prioritySkill)
      : [];
    if (!skillEvidence.length) return null;
    const patternEvidence = skillEvidence.filter(
      (item) => item.resultType === "first_response_not_matched" || item.evidenceStatus === "evidence_insufficient" || item.status !== "completed",
    );
    const sourceEvidence = patternEvidence.length ? patternEvidence : skillEvidence;
    const errorPatternIds = [...new Set([
      ...sourceEvidence.map((item) => item.constructTag).filter(Boolean),
      diagnostic.priorityBasis,
    ].filter(Boolean))];
    if (!errorPatternIds.length) return null;
    return {
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      errorPatternIds,
      diagnosticEvidenceTaskIds: sourceEvidence.map((item) => item.taskId),
      diagnosticQualityFlags: [...new Set(sourceEvidence.flatMap((item) => item.qualityFlags || []).filter(Boolean))],
      practiceTaskId: planTask.taskId,
      exerciseId: catalog.exerciseId,
      contentId: catalog.contentId,
      contentVersion: catalog.activityVersion,
      contentHash: catalog.contentHash,
      bindingReason: expectedPrimary.reason,
      sourceClass: "first_party_original_gate_a",
      reviewStatus: "gate_a_unreviewed",
      reviewedAt: null,
      teacherReviewed: false,
      measurementReviewed: false,
      videoTimestamp: null,
      prerequisites: expectedPrimary.prerequisites,
    };
  };
  const recommendationBindingMatches = ({ binding, cycle, diagnostic, plan, primary }) => {
    if (!isRecord(binding) || typeof binding.bindingId !== "string" || !binding.bindingId.startsWith("recommendation-binding-")) return false;
    if (typeof binding.createdAt !== "string" || Number.isNaN(Date.parse(binding.createdAt))) return false;
    const expected = deriveRecommendationBindingCore({ cycle, diagnostic, plan, primary });
    return Boolean(
      expected &&
      Object.entries(expected).every(([key, value]) =>
        Array.isArray(value)
          ? Array.isArray(binding[key]) && JSON.stringify(binding[key]) === JSON.stringify(value)
          : binding[key] === value,
      )
    );
  };
  const deriveRetestOutcome = (skill, evidence) => {
    const catalog = RETEST_TASK_CATALOG[skill];
    if (!catalog || !isRecord(evidence) || evidence.responseType !== catalog.responseType) return null;
    let resultType;
    let audioEvidenceInsufficient = false;
    if (["single_choice", "single_choice_audio"].includes(catalog.responseType)) {
      if (!["a", "b", "c"].includes(evidence.selectedAnswer)) return null;
      resultType = evidence.selectedAnswer === catalog.correctValue ? "single_task_correct" : "single_task_needs_review";
      if (catalog.responseType === "single_choice_audio") {
        if (skill !== "Listening") return null;
        if (
          typeof evidence.audioPlayed !== "boolean" ||
          typeof evidence.audioCompleted !== "boolean" ||
          !Number.isSafeInteger(evidence.playCount) ||
          evidence.playCount < 0 ||
          typeof evidence.transcriptUsed !== "boolean" ||
          typeof evidence.seekDetected !== "boolean" ||
          typeof evidence.playbackFailed !== "boolean" ||
          evidence.audioPlayed !== (evidence.playCount >= 1) ||
          (evidence.audioCompleted === true && (
            evidence.audioPlayed !== true ||
            evidence.seekDetected === true ||
            evidence.playbackFailed === true
          ))
        ) return null;
        audioEvidenceInsufficient = Boolean(
          evidence.audioPlayed !== true ||
          evidence.audioCompleted !== true ||
          evidence.transcriptUsed === true ||
          evidence.seekDetected === true ||
          evidence.playbackFailed === true
        );
      } else if (skill === "Listening") return null;
    } else if (catalog.responseType === "self_reviewed_writing") {
      if (
        !Number.isInteger(evidence.wordCount) ||
        evidence.wordCount < catalog.minimumWordCount ||
        evidence.wordCount > RETEST_WRITING_MAX_WORDS ||
        evidence.selfChecksComplete !== true
      ) return null;
      resultType = "task_completed_no_score";
    } else if (catalog.responseType === "learner_confirmed_speaking") {
      if (evidence.selfChecksComplete !== true || evidence.audioRecorded !== false) return null;
      resultType = "task_completed_no_score";
    } else {
      return null;
    }
    const humanReviewRequired =
      catalog.humanReviewRule === "always_required_for_open_response" ||
      resultType === "single_task_needs_review" ||
      audioEvidenceInsufficient;
    return {
      resultType,
      evidenceStatus: audioEvidenceInsufficient
        ? "evidence_insufficient"
        : resultType === "single_task_needs_review"
          ? "needs_review"
          : "limited_single_task",
      evidenceSufficiency: audioEvidenceInsufficient
        ? "insufficient_audio_conditions"
        : "limited_unreviewed_same_skill_task",
      humanConfirmationStatus: humanReviewRequired ? "required_not_completed" : "not_required_for_gate_a_flow",
      humanReviewRequired,
    };
  };
  const practiceReceiptMatches = ({ receipt, cycle, diagnostic, plan, recommendation, task }) => {
    if (!hasValidPracticeReceiptShape(receipt, receipt?.completionReceiptId)) return false;
    const catalog = PRACTICE_ACTIVITY_CATALOG[receipt.exerciseId];
    if (
      !catalog ||
      !UUID_V4_PATTERN.test(receipt.practiceAttemptId || "") ||
      !UUID_V4_PATTERN.test(receipt.completionReceiptId || "") ||
      receipt.activityId !== catalog.activityId ||
      receipt.activityVersion !== catalog.activityVersion ||
      receipt.contentId !== catalog.contentId ||
      receipt.contentHash !== catalog.contentHash ||
      receipt.skill !== catalog.skill ||
      receipt.route !== catalog.route ||
      receipt.receiptEvidenceClass !== catalog.receiptEvidenceClass ||
      receipt.evidenceType !== catalog.evidenceType ||
      receipt.completionCondition !== catalog.completionCondition ||
      receipt.completionSource !== "guided_practice" ||
      receipt.evidenceClass !== "practice_receipt" ||
      receipt.evidenceStatus !== "evidence_limited" ||
      receipt.sealed !== true ||
      receipt.ownerScope !== "browser_local_not_account_bound" ||
      receipt.integrityClass !== "unsigned_local_receipt" ||
      receipt.status !== "completed" ||
      !Array.isArray(receipt.qualityFlags) ||
      typeof receipt.completedAt !== "string" ||
      receipt.automatedScoreProduced !== false ||
      receipt.formalDiagnosisProduced !== false ||
      receipt.officialEquivalenceClaimed !== false
    ) return false;
    if (
      !cycle ||
      !diagnostic ||
      !plan ||
      !recommendation ||
      !task ||
      receipt.taskId !== task.taskId ||
      receipt.planId !== plan.planId ||
      receipt.cycleId !== cycle.cycleId ||
      receipt.diagnosticSessionId !== cycle.diagnosticSessionId ||
      receipt.recommendationId !== cycle.recommendationId ||
      recommendation.recommendationId !== cycle.recommendationId ||
      receipt.skill !== task.skill ||
      receipt.route !== task.route ||
      receipt.skill !== diagnostic.prioritySkill
    ) return false;
    if (
      receipt.taskRef?.cycleId !== cycle.cycleId ||
      receipt.taskRef?.diagnosticSessionId !== cycle.diagnosticSessionId ||
      receipt.taskRef?.planId !== plan.planId ||
      receipt.taskRef?.taskId !== task.taskId ||
      receipt.taskRef?.taskDate !== task.date ||
      receipt.contentRef?.exerciseId !== receipt.exerciseId ||
      receipt.contentRef?.contentId !== catalog.contentId ||
      receipt.contentRef?.contentVersion !== catalog.activityVersion ||
      receipt.contentRef?.contentHash !== catalog.contentHash
    ) return false;
    if (
      task.contentRef &&
      (
        task.contentRef.exerciseId !== receipt.exerciseId ||
        task.contentRef.contentId !== receipt.contentId ||
        task.contentRef.contentVersion !== receipt.activityVersion ||
        task.contentRef.contentHash !== receipt.contentHash
      )
    ) return false;
    if (recommendation.status === "accepted" && task.taskId !== recommendation.primary?.taskId) return false;
    if (recommendation.status === "skipped" && task.taskId === recommendation.primary?.taskId) return false;
    return true;
  };

  const validateCycleEvidence = (candidateState = state) => {
    const cycle = activeCycle(candidateState);
    const diagnostic = candidateState?.journey?.diagnostic;
    const basePlan = planById(cycle?.basePlanId, candidateState);
    const baseTaskIds = new Set(basePlan?.days?.flatMap((day) => day.tasks?.map((task) => task.taskId) || []) || []);
    const recommendation = candidateState?.journey?.recommendation;
    const checkIn = getCycleCheckIn(candidateState);
    const linkedPracticeTask = planTaskById(basePlan, checkIn?.linkedTaskId);
    const linkedPracticeReceipt = checkIn?.practiceReceipt;
    const storedPracticeReceipt = candidateState?.practiceReceipts?.[linkedPracticeReceipt?.completionReceiptId];
    const linkedTaskProgress = candidateState?.taskProgress?.[checkIn?.linkedTaskId];
    const review = candidateState?.journey?.review;
    const peerHelp = candidateState?.journey?.peerHelp;
    const retest = candidateState?.journey?.retest;
    const retestCatalog = RETEST_TASK_CATALOG[retest?.skill];
    const derivedRetestOutcome = deriveRetestOutcome(retest?.skill, retest?.evidence);
    const planUpdate = candidateState?.journey?.planUpdate;
    const updatedPlan = planById(cycle?.updatedPlanId, candidateState);
    const sixTaskEvidenceComplete =
      diagnostic?.diagnosticProtocolVersion === DIAGNOSTIC_PROTOCOL_VERSION &&
      diagnostic?.taskSetVersion === DIAGNOSTIC_TASK_SET_VERSION &&
      diagnostic?.taskSetDigest === DIAGNOSTIC_TASK_SET_DIGEST &&
      diagnosticEvidenceCollectionValid(diagnostic, { requireAllTerminal: true });

    const diagnosticComplete = Boolean(
      cycle &&
        diagnostic?.protocolVersion === PROTOCOL_VERSION &&
        diagnostic?.cycleId === cycle.cycleId &&
        diagnostic?.diagnosticSessionId === cycle.diagnosticSessionId &&
        diagnostic?.status === "completed" &&
        diagnostic?.adultConfirmed === true &&
        diagnostic?.devicePrecheck?.storageStatus === "available" &&
        sixTaskEvidenceComplete &&
        VALID_SKILLS.has(diagnostic?.prioritySkill) &&
        diagnostic?.prioritySkill !== "Balanced" &&
        diagnostic?.learnerConfirmedPriority === true &&
        diagnostic?.automatedScoreProduced === false &&
        diagnostic?.formalDiagnosisProduced === false,
    );
    const planComplete = Boolean(
      diagnosticComplete &&
        basePlan?.planId === cycle?.basePlanId &&
        basePlan?.provenance?.cycleId === cycle?.cycleId &&
        basePlan?.provenance?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        basePlan?.provenance?.taskSetVersion === diagnostic?.taskSetVersion &&
        basePlan?.provenance?.taskSetDigest === diagnostic?.taskSetDigest,
    );
    const recommendationComplete = Boolean(
      planComplete &&
        recommendation?.cycleId === cycle?.cycleId &&
        recommendation?.recommendationId === cycle?.recommendationId &&
        recommendation?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        recommendation?.planId === cycle?.basePlanId &&
        ["accepted", "skipped"].includes(recommendation?.status) &&
        baseTaskIds.has(recommendation?.primary?.taskId) &&
        recommendation?.primary?.skill === diagnostic?.prioritySkill &&
        recommendationBindingMatches({
          binding: recommendation?.evidenceBinding,
          cycle,
          diagnostic,
          plan: basePlan,
          primary: recommendation?.primary,
        }),
    );
    const checkInComplete = Boolean(
      recommendationComplete &&
        checkIn?.status === "saved" &&
        checkIn?.checkInId === cycle?.checkInId &&
        checkIn?.cycleId === cycle?.cycleId &&
        checkIn?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        checkIn?.planId === cycle?.basePlanId &&
        checkIn?.recommendationId === cycle?.recommendationId &&
        checkIn?.didText?.length >= 10 &&
        checkIn?.evidenceText?.length >= 10 &&
        ["none", "has_question"].includes(checkIn?.questionStatus) &&
        (checkIn.questionStatus !== "has_question" || Boolean(checkIn.questionText)) &&
        baseTaskIds.has(checkIn?.linkedTaskId) &&
        checkIn?.evidenceClass === "practice_receipt" &&
        checkIn?.practiceAttemptId === linkedPracticeReceipt?.practiceAttemptId &&
        checkIn?.taskCompletionReceiptId === linkedPracticeReceipt?.completionReceiptId &&
        linkedTaskProgress?.completionClass === "practice_receipt" &&
        linkedTaskProgress?.practiceReceiptId === linkedPracticeReceipt?.completionReceiptId &&
        isRecord(storedPracticeReceipt) &&
        JSON.stringify(storedPracticeReceipt) === JSON.stringify(linkedPracticeReceipt) &&
        practiceReceiptMatches({
          receipt: linkedPracticeReceipt,
          cycle,
          diagnostic,
          plan: basePlan,
          recommendation,
          task: linkedPracticeTask,
        }),
    );
    const reviewComplete = Boolean(
      checkInComplete &&
        review?.cycleId === cycle?.cycleId &&
        review?.reviewId === cycle?.reviewId &&
        review?.checkInId === cycle?.checkInId &&
        review?.learnerConfirmed === true &&
        checkIn?.reviewId === review?.reviewId &&
        checkIn?.learnerConfirmedReview === true,
    );
    const peerHelpComplete = Boolean(
      reviewComplete &&
        peerHelp?.cycleId === cycle?.cycleId &&
        peerHelp?.peerHelpId === cycle?.peerHelpId &&
        peerHelp?.planId === cycle?.basePlanId &&
        peerHelp?.reviewId === cycle?.reviewId &&
        VALID_PEER_HELP_STATES.has(peerHelp?.status) &&
        peerHelp?.realCommunityUsed === false,
    );
    const retestEvidenceComplete = Boolean(
      peerHelpComplete &&
        retest?.status === "completed" &&
        retest?.cycleId === cycle?.cycleId &&
        retest?.retestId === cycle?.retestId &&
        retest?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        retest?.planId === cycle?.basePlanId &&
        retest?.recommendationId === cycle?.recommendationId &&
        retest?.checkInId === cycle?.checkInId &&
        retest?.reviewId === cycle?.reviewId &&
        retest?.peerHelpId === cycle?.peerHelpId &&
        retest?.skill === diagnostic?.prioritySkill &&
        retest?.skill === linkedPracticeReceipt?.skill &&
        retest?.baselineTaskId === linkedPracticeTask?.taskId &&
        retest?.baselinePracticeReceiptId === linkedPracticeReceipt?.completionReceiptId &&
        retest?.parallelTaskId === retestCatalog?.taskId &&
        retest?.taskVersion === retestCatalog?.taskVersion &&
        retest?.parallelFormPairId === retestCatalog?.parallelFormPairId &&
        retest?.parallelRetest === true &&
        retest?.comparability?.targetSkill === diagnostic?.prioritySkill &&
        retest?.comparability?.sameSkill === true &&
        retest?.comparability?.sameAsDiagnosticPriority === true &&
        retest?.comparability?.sameAsPlanTask === true &&
        retest?.comparability?.sameAsPracticeReceipt === true &&
        retest?.comparability?.newOriginalPrompt === true &&
        retest?.comparability?.constructAlignment === retestCatalog?.constructAlignment &&
        retest?.comparability?.teacherReviewed === false &&
        retest?.comparability?.measurementReviewed === false &&
        retest?.comparability?.officialEquivalenceClaimed === false &&
        retest?.comparability?.comparisonBoundary === "same_skill_only_no_calibrated_construct_or_difficulty_equivalence" &&
        derivedRetestOutcome &&
        retest?.evidence?.resultType === derivedRetestOutcome.resultType &&
        retest?.evidenceStatus === derivedRetestOutcome.evidenceStatus &&
        retest?.evidenceSufficiency === derivedRetestOutcome.evidenceSufficiency &&
        retest?.humanConfirmationStatus === derivedRetestOutcome.humanConfirmationStatus &&
        retest?.automatedScoreProduced === false &&
        retest?.growthClaimProduced === false,
    );
    const planUpdateBaseComplete = Boolean(
      retestEvidenceComplete &&
        planUpdate?.cycleId === cycle?.cycleId &&
        planUpdate?.retestId === cycle?.retestId &&
        planUpdate?.supersedesPlanId === cycle?.basePlanId &&
        planUpdate?.updatedPlanId === cycle?.updatedPlanId &&
        planUpdate?.learnerConfirmed === true &&
        VALID_SKILLS.has(planUpdate?.focusSkill) &&
        updatedPlan?.planId === cycle?.updatedPlanId &&
        updatedPlan?.focusSkill === planUpdate?.focusSkill &&
        updatedPlan?.provenance?.cycleId === cycle?.cycleId &&
        updatedPlan?.provenance?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        updatedPlan?.provenance?.retestId === cycle?.retestId &&
        updatedPlan?.provenance?.supersedesPlanId === cycle?.basePlanId &&
        updatedPlan?.provenance?.taskSetVersion === diagnostic?.taskSetVersion &&
        updatedPlan?.provenance?.taskSetDigest === diagnostic?.taskSetDigest,
    );
    const provisionalUpdateRecorded = Boolean(
      planUpdateBaseComplete &&
        derivedRetestOutcome?.humanReviewRequired === true &&
        retest?.humanConfirmationStatus === "required_not_completed" &&
        cycle?.status === "provisional_pending_human_review" &&
        planUpdate?.confirmationClass === "provisional_pending_human_review" &&
        planUpdate?.humanConfirmationStatus === "required_not_completed",
    );
    const updateComplete = Boolean(
      planUpdateBaseComplete &&
        derivedRetestOutcome?.humanReviewRequired === false &&
        retest?.humanConfirmationStatus === "not_required_for_gate_a_flow" &&
        cycle?.status === "completed" &&
        planUpdate?.confirmationClass === "learner_confirmed_gate_a" &&
        planUpdate?.humanConfirmationStatus === "not_required_for_gate_a_flow",
    );
    const planUpdateRecorded = updateComplete || provisionalUpdateRecorded;

    return {
      cycle,
      diagnostic,
      basePlan,
      recommendation,
      checkIn,
      linkedPracticeTask,
      linkedPracticeReceipt,
      review,
      peerHelp,
      retest,
      planUpdate,
      updatedPlan,
      diagnosticComplete,
      planComplete,
      recommendationComplete,
      checkInComplete,
      reviewComplete,
      peerHelpComplete,
      preRetestComplete: peerHelpComplete,
      retestEvidenceComplete,
      planUpdateRecorded,
      provisionalUpdateRecorded,
      updateComplete,
    };
  };

  const cycleLedgerDefinitions = Object.freeze([
    Object.freeze({ key: "diagnostic", idField: "diagnosticSessionId", recordedKey: "diagnosticComplete" }),
    Object.freeze({ key: "plan", idField: "basePlanId", recordedKey: "planComplete" }),
    Object.freeze({ key: "recommendation", idField: "recommendationId", recordedKey: "recommendationComplete" }),
    Object.freeze({ key: "checkin", idField: "checkInId", recordedKey: "checkInComplete" }),
    Object.freeze({ key: "review", idField: "reviewId", recordedKey: "reviewComplete" }),
    Object.freeze({ key: "peerHelp", idField: "peerHelpId", recordedKey: "peerHelpComplete" }),
    Object.freeze({ key: "retest", idField: "retestId", recordedKey: "retestEvidenceComplete" }),
    Object.freeze({ key: "updatedPlan", idField: "updatedPlanId", recordedKey: "planUpdateRecorded" }),
  ]);

  const displayableCycleLedgerId = (value) =>
    typeof value === "string" && value.length > 0 && value.length <= 180 && !/[\u0000-\u001f\u007f]/.test(value)
      ? value
      : null;

  const buildCycleEvidenceProjection = (chain) => {
    const cycle = isRecord(chain?.cycle) ? chain.cycle : null;
    const details = {
      diagnostic: chain?.diagnostic?.evidenceSufficiency === "evidence_insufficient"
        ? "证据不足 · 已记录"
        : "证据有限 · 已记录",
      plan: "已连接本轮诊断",
      recommendation: chain?.recommendation?.status === "skipped" ? "已明确跳过" : "已接受",
      checkin: "练习回执已绑定",
      review: "learner_confirmed_review",
      peerHelp: VALID_PEER_HELP_STATES.has(chain?.peerHelp?.status)
        ? `${chain.peerHelp.status} · 已记录`
        : "状态已记录",
      retest: ["evidence_insufficient", "needs_review", "limited_single_task"].includes(chain?.retest?.evidenceStatus)
        ? `${chain.retest.evidenceStatus} · 已记录`
        : "平行任务证据已记录",
      updatedPlan: chain?.provisionalUpdateRecorded
        ? "等待具备资质的人工确认"
        : "学习者已确认更新",
    };
    let previousRecorded = true;
    const rows = cycleLedgerDefinitions.map((definition) => {
      const eligible = previousRecorded;
      const value = eligible && chain?.[definition.recordedKey]
        ? displayableCycleLedgerId(cycle?.[definition.idField])
        : null;
      const recorded = Boolean(value);
      const pendingHuman = definition.key === "updatedPlan" && recorded && chain?.provisionalUpdateRecorded;
      const state = recorded ? (pendingHuman ? "pending-human" : "recorded") : eligible ? "current" : "locked";
      previousRecorded = recorded;
      return {
        key: definition.key,
        value,
        state,
        status: recorded ? details[definition.key] : eligible ? "下一条待形成" : "等待前一步",
      };
    });
    const completedCount = [
      chain?.diagnosticComplete,
      chain?.planComplete,
      chain?.recommendationComplete,
      chain?.checkInComplete,
      chain?.reviewComplete,
      chain?.peerHelpComplete,
      chain?.updateComplete,
    ].filter(Boolean).length;
    const recordedCount = rows.filter((row) => row.value).length;
    const state = !cycle
      ? "empty"
      : chain?.updateComplete
        ? "complete"
        : chain?.provisionalUpdateRecorded
          ? "provisional"
          : "in-progress";
    return {
      state,
      cycleId: displayableCycleLedgerId(cycle?.cycleId),
      protocolVersion: PROTOCOL_VERSION,
      completedCount,
      recordedCount,
      status: state === "complete"
        ? "7 / 7 步已留证"
        : state === "provisional"
          ? "7 / 7 步已记录 · 待人工确认"
          : cycle
            ? `${completedCount} / 7 步已留证`
            : "尚未建立本轮证据链",
      copy: state === "complete"
        ? "全部节点已经通过中央闭环校验；这只证明 Gate A 本机演示流程闭合。"
        : state === "provisional"
          ? "八个节点已经回链，但更新计划仍是临时记录；具备资质的人工确认尚未完成。"
          : cycle
            ? "总览只显示已经通过前序回链核对的节点；请继续完成当前步骤。"
            : "从六任务诊断开始后，这里会按顺序显示已经通过核对的节点。",
      rows,
    };
  };

  const cycleHistoryTopLevelKeys = Object.freeze([
    "basePlanId",
    "checkIn",
    "checkInId",
    "closedAt",
    "createdAt",
    "cycleId",
    "diagnostic",
    "diagnosticSessionId",
    "peerHelp",
    "peerHelpId",
    "planUpdate",
    "protocolVersion",
    "provisionalAt",
    "recommendation",
    "recommendationId",
    "retest",
    "retestId",
    "review",
    "reviewId",
    "status",
    "updatedAt",
    "updatedPlanId",
  ].sort());
  const CYCLE_HISTORY_LIMIT = 10;
  const SUPERSEDED_CYCLE_LIMIT = 64;
  const CYCLE_HISTORY_TERMINAL_STATUSES = new Set(["completed", "provisional_pending_human_review"]);
  const CYCLE_HISTORY_FORBIDDEN_KEYS = new Set([
    "accountId",
    "clerkId",
    "conversation",
    "email",
    "examDate",
    "messages",
    "name",
    "nickname",
    "profile",
    "sofiaChat",
    "sofiaMessages",
  ]);
  const CYCLE_HISTORY_ID_FIELDS = Object.freeze([
    "cycleId",
    "diagnosticSessionId",
    "basePlanId",
    "recommendationId",
    "checkInId",
    "reviewId",
    "peerHelpId",
    "retestId",
    "updatedPlanId",
  ]);
  const CYCLE_HISTORY_EVENT_TYPES = Object.freeze([
    "learning_cycle.started",
    "recommendation.decided",
    "practice_attempt.finalized",
    "check_in.committed",
    "retest.completed",
    "learning_cycle.completed",
  ]);
  const ISO_UTC_MILLISECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  const exactHistoryKeys = (value, expectedKeys) =>
    isRecord(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expectedKeys);
  const exactUtcTimestamp = (value) => {
    if (typeof value !== "string" || !ISO_UTC_MILLISECOND_PATTERN.test(value)) return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  };
  const historyIdValid = (value) =>
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 180 &&
    !/[\u0000-\u001f\u007f]/.test(value);
  const historyContainsForbiddenEnvelope = (value, seen = new Set()) => {
    if (!value || typeof value !== "object") return false;
    if (seen.has(value)) return true;
    seen.add(value);
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
    for (const [key, child] of entries) {
      if (CYCLE_HISTORY_FORBIDDEN_KEYS.has(key)) return true;
      if (child && typeof child === "object" && historyContainsForbiddenEnvelope(child, seen)) return true;
    }
    return false;
  };
  const uniquePlanForHistory = (candidateState, planId) => {
    if (!historyIdValid(planId)) return null;
    const plans = [candidateState?.plan, ...(Array.isArray(candidateState?.planHistory) ? candidateState.planHistory : [])]
      .filter((plan) => isRecord(plan) && plan.planId === planId);
    return plans.length === 1 ? plans[0] : null;
  };
  const boundHistoryAlias = (bindings, kind, domainId) => {
    const alias = bindings?.records?.[kind]?.[domainId];
    return UUID_V4_PATTERN.test(alias || "") ? alias : null;
  };
  const historyEventBoundaryValid = (event) => Boolean(
    isRecord(event) &&
    CYCLE_HISTORY_EVENT_TYPES.includes(event.eventType) &&
    UUID_V4_PATTERN.test(event.eventId || "") &&
    /^[0-9a-f]{64}$/.test(event.eventHash || "") &&
    exactUtcTimestamp(event.occurredAt) &&
    isRecord(event.context) &&
    isRecord(event.attributes) &&
    exactHistoryKeys(event.privacy, [
      "classification",
      "containsAccountIdentifier",
      "containsAudio",
      "containsClerkIdentifier",
      "containsDirectIdentifier",
      "containsFreeText",
      "containsRawResponse",
      "containsSofiaContent",
    ]) &&
    event.privacy.classification === "pseudonymous_local_learning_metadata" &&
    event.privacy.containsDirectIdentifier === false &&
    event.privacy.containsAccountIdentifier === false &&
    event.privacy.containsClerkIdentifier === false &&
    event.privacy.containsFreeText === false &&
    event.privacy.containsRawResponse === false &&
    event.privacy.containsAudio === false &&
    event.privacy.containsSofiaContent === false &&
    isRecord(event.governance) &&
    event.governance.storageScope === "browser_local_only" &&
    event.governance.corruptionPolicy === "fail_closed" &&
    event.governance.networkDispatch === "disabled" &&
    event.governance.lrsDispatch === "disabled" &&
    event.governance.xapiDispatch === "disabled" &&
    event.governance.sofiaAccess === "forbidden"
  );

  const historyMilestonesValid = ({ record, diagnostic, basePlan, recommendation, checkIn, review, peerHelp, retest, planUpdate, updatedPlan }) => {
    const terminalAt = record.status === "completed" ? record.closedAt : record.provisionalAt;
    const ordered = [
      record.createdAt,
      diagnostic.completedAt,
      basePlan.createdAt,
      recommendation.evidenceBinding?.createdAt,
      recommendation.createdAt,
      recommendation.updatedAt,
      checkIn.practiceReceipt?.completedAt,
      checkIn.savedAt,
      review.confirmedAt,
      retest.completedAt,
      planUpdate.createdAt,
    ];
    if (!ordered.every(exactUtcTimestamp) || !exactUtcTimestamp(terminalAt) || !exactUtcTimestamp(updatedPlan.createdAt)) return false;
    const times = ordered.map(Date.parse);
    if (times.some((timestamp, index) => index > 0 && timestamp < times[index - 1])) return false;
    if (
      planUpdate.createdAt !== terminalAt ||
      record.updatedAt !== terminalAt ||
      basePlan.status !== "superseded" ||
      basePlan.supersededAt !== terminalAt ||
      basePlan.supersededByRetestId !== record.retestId ||
      checkIn.reviewedAt !== review.confirmedAt ||
      !exactUtcTimestamp(peerHelp.createdAt) ||
      !exactUtcTimestamp(peerHelp.updatedAt) ||
      Date.parse(peerHelp.createdAt) < Date.parse(review.confirmedAt) ||
      Date.parse(peerHelp.updatedAt) < Date.parse(review.confirmedAt) ||
      Date.parse(peerHelp.createdAt) > Date.parse(retest.completedAt) ||
      Date.parse(peerHelp.updatedAt) > Date.parse(retest.completedAt) ||
      Date.parse(updatedPlan.createdAt) < Date.parse(terminalAt) ||
      Date.parse(updatedPlan.createdAt) - Date.parse(terminalAt) > 5 * 60 * 1000
    ) return false;
    if (
      record.status === "completed"
        ? record.provisionalAt !== null || record.closedAt !== terminalAt
        : record.closedAt !== null || record.provisionalAt !== terminalAt
    ) return false;
    return diagnostic.taskEvidence.every((evidence) => Boolean(
      exactUtcTimestamp(evidence.startedAt) &&
      exactUtcTimestamp(evidence.completedAt) &&
      exactUtcTimestamp(evidence.updatedAt) &&
      Date.parse(evidence.startedAt) >= Date.parse(record.createdAt) &&
      Date.parse(evidence.completedAt) >= Date.parse(evidence.startedAt) &&
      Date.parse(evidence.updatedAt) >= Date.parse(evidence.completedAt) &&
      Date.parse(evidence.updatedAt) <= Date.parse(diagnostic.completedAt)
    ));
  };

  const historyEventChainProjection = ({ candidateState, record, diagnostic, recommendation, checkIn, retest, planUpdate }) => {
    const bindings = candidateState?.learningEventBindings;
    const events = Array.isArray(candidateState?.learningEvents) ? candidateState.learningEvents : [];
    const aliases = {
      cycle: boundHistoryAlias(bindings, "cycle", record.cycleId),
      diagnostic: boundHistoryAlias(bindings, "diagnostic", record.diagnosticSessionId),
      plan: boundHistoryAlias(bindings, "plan", record.basePlanId),
      recommendation: boundHistoryAlias(bindings, "recommendation", record.recommendationId),
      binding: boundHistoryAlias(bindings, "binding", recommendation.evidenceBinding?.bindingId),
      task: boundHistoryAlias(bindings, "task", checkIn.linkedTaskId),
      practiceAttempt: boundHistoryAlias(bindings, "practiceAttempt", checkIn.practiceAttemptId),
      practiceReceipt: boundHistoryAlias(bindings, "practiceReceipt", checkIn.taskCompletionReceiptId),
      checkIn: boundHistoryAlias(bindings, "checkIn", record.checkInId),
      retest: boundHistoryAlias(bindings, "retest", record.retestId),
      updatedPlan: record.status === "completed"
        ? boundHistoryAlias(bindings, "updatedPlan", record.updatedPlanId)
        : null,
    };
    const requiredAliases = Object.entries(aliases)
      .filter(([key]) => key !== "updatedPlan" || record.status === "completed")
      .map(([, alias]) => alias);
    if (requiredAliases.some((alias) => !alias)) return null;

    const cycleEvents = events.filter((event) => event?.context?.learningCycleId === aliases.cycle);
    if (!cycleEvents.length || !cycleEvents.every(historyEventBoundaryValid)) return null;
    const types = cycleEvents.map((event) => event.eventType);
    const checkInIndex = types.indexOf("check_in.committed");
    const retestIndex = types.indexOf("retest.completed");
    const completedIndex = types.indexOf("learning_cycle.completed");
    if (
      types[0] !== "learning_cycle.started" ||
      types[1] !== "recommendation.decided" ||
      checkInIndex < 3 ||
      retestIndex !== checkInIndex + 1 ||
      types.slice(2, checkInIndex).some((type) => type !== "practice_attempt.finalized") ||
      (record.status === "completed"
        ? completedIndex !== retestIndex + 1 || completedIndex !== types.length - 1
        : completedIndex !== -1 || retestIndex !== types.length - 1)
    ) return null;

    const startedEvent = cycleEvents[0];
    const recommendationEvent = cycleEvents[1];
    const practiceEvent = cycleEvents.find((event) => event.context?.practiceReceiptId === aliases.practiceReceipt);
    const checkInEvent = cycleEvents[checkInIndex];
    const retestEvent = cycleEvents[retestIndex];
    const completedEvent = record.status === "completed" ? cycleEvents[completedIndex] : null;
    if (
      startedEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      startedEvent.attributes.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      startedEvent.attributes.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      startedEvent.occurredAt !== record.createdAt ||
      recommendationEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      recommendationEvent.context.planId !== aliases.plan ||
      recommendationEvent.context.recommendationId !== aliases.recommendation ||
      recommendationEvent.context.bindingId !== aliases.binding ||
      recommendationEvent.attributes.decision !== recommendation.status ||
      recommendationEvent.occurredAt !== recommendation.createdAt ||
      !practiceEvent ||
      practiceEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      practiceEvent.context.planId !== aliases.plan ||
      practiceEvent.context.recommendationId !== aliases.recommendation ||
      practiceEvent.context.bindingId !== aliases.binding ||
      practiceEvent.context.taskId !== aliases.task ||
      practiceEvent.context.attemptId !== aliases.practiceAttempt ||
      practiceEvent.attributes.skill !== diagnostic.prioritySkill ||
      practiceEvent.occurredAt !== checkIn.practiceReceipt.completedAt ||
      checkInEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      checkInEvent.context.planId !== aliases.plan ||
      checkInEvent.context.recommendationId !== aliases.recommendation ||
      checkInEvent.context.bindingId !== aliases.binding ||
      checkInEvent.context.taskId !== aliases.task ||
      checkInEvent.context.practiceReceiptId !== aliases.practiceReceipt ||
      checkInEvent.context.checkInId !== aliases.checkIn ||
      checkInEvent.occurredAt !== checkIn.savedAt ||
      retestEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      retestEvent.context.planId !== aliases.plan ||
      retestEvent.context.recommendationId !== aliases.recommendation ||
      retestEvent.context.bindingId !== aliases.binding ||
      retestEvent.context.checkInId !== aliases.checkIn ||
      retestEvent.context.retestId !== aliases.retest ||
      retestEvent.context.baselinePracticeReceiptId !== aliases.practiceReceipt ||
      retestEvent.attributes.skill !== diagnostic.prioritySkill ||
      retestEvent.attributes.humanConfirmationStatus !== retest.humanConfirmationStatus ||
      retestEvent.occurredAt !== retest.completedAt
    ) return null;
    if (record.status === "completed" && (
      completedEvent.context.diagnosticSessionId !== aliases.diagnostic ||
      completedEvent.context.planId !== aliases.plan ||
      completedEvent.context.retestId !== aliases.retest ||
      completedEvent.context.updatedPlanId !== aliases.updatedPlan ||
      completedEvent.attributes.nextFocusSkill !== planUpdate.focusSkill ||
      completedEvent.attributes.humanConfirmationStatus !== planUpdate.humanConfirmationStatus ||
      completedEvent.occurredAt !== record.closedAt
    )) return null;
    return { eventCount: cycleEvents.length };
  };

  const projectValidatedCycleHistoryRecord = (candidateState, record) => {
    if (
      !exactHistoryKeys(record, cycleHistoryTopLevelKeys) ||
      historyContainsForbiddenEnvelope(record) ||
      record.protocolVersion !== PROTOCOL_VERSION ||
      !CYCLE_HISTORY_TERMINAL_STATUSES.has(record.status) ||
      CYCLE_HISTORY_ID_FIELDS.some((field) => !historyIdValid(record[field])) ||
      new Set(CYCLE_HISTORY_ID_FIELDS.map((field) => record[field])).size !== CYCLE_HISTORY_ID_FIELDS.length
    ) return null;

    const diagnostic = record.diagnostic;
    const recommendation = record.recommendation;
    const checkIn = record.checkIn;
    const review = record.review;
    const peerHelp = record.peerHelp;
    const retest = record.retest;
    const planUpdate = record.planUpdate;
    const basePlan = uniquePlanForHistory(candidateState, record.basePlanId);
    const updatedPlan = uniquePlanForHistory(candidateState, record.updatedPlanId);
    const linkedPracticeReceipt = checkIn?.practiceReceipt;
    const storedPracticeReceipt = candidateState?.practiceReceipts?.[checkIn?.taskCompletionReceiptId];
    const linkedPracticeTask = planTaskById(basePlan, checkIn?.linkedTaskId);
    const linkedTaskProgress = candidateState?.taskProgress?.[checkIn?.linkedTaskId];
    const retestCatalog = RETEST_TASK_CATALOG[retest?.skill];
    const derivedRetestOutcome = deriveRetestOutcome(retest?.skill, retest?.evidence);

    if (
      !isRecord(diagnostic) ||
      diagnostic.protocolVersion !== PROTOCOL_VERSION ||
      diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
      diagnostic.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      diagnostic.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      diagnostic.cycleId !== record.cycleId ||
      diagnostic.diagnosticSessionId !== record.diagnosticSessionId ||
      diagnostic.status !== "completed" ||
      diagnostic.adultConfirmed !== true ||
      diagnostic.devicePrecheck?.storageStatus !== "available" ||
      diagnosticEvidenceCollectionValid(diagnostic, { requireAllTerminal: true }) !== true ||
      !VALID_SKILLS.has(diagnostic.prioritySkill) ||
      diagnostic.prioritySkill === "Balanced" ||
      diagnostic.learnerConfirmedPriority !== true ||
      diagnostic.automatedScoreProduced !== false ||
      diagnostic.formalDiagnosisProduced !== false ||
      !isRecord(basePlan) ||
      !isRecord(updatedPlan) ||
      basePlan.planId !== record.basePlanId ||
      basePlan.focusSkill !== diagnostic.prioritySkill ||
      basePlan.provenance?.cycleId !== record.cycleId ||
      basePlan.provenance?.diagnosticSessionId !== record.diagnosticSessionId ||
      basePlan.provenance?.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      basePlan.provenance?.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      !VALID_SKILLS.has(updatedPlan.focusSkill) ||
      updatedPlan.provenance?.cycleId !== record.cycleId ||
      updatedPlan.provenance?.diagnosticSessionId !== record.diagnosticSessionId ||
      updatedPlan.provenance?.retestId !== record.retestId ||
      updatedPlan.provenance?.supersedesPlanId !== record.basePlanId ||
      updatedPlan.provenance?.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      updatedPlan.provenance?.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST
    ) return null;

    if (
      !isRecord(recommendation) ||
      recommendation.cycleId !== record.cycleId ||
      recommendation.diagnosticSessionId !== record.diagnosticSessionId ||
      recommendation.planId !== record.basePlanId ||
      recommendation.recommendationId !== record.recommendationId ||
      !["accepted", "skipped"].includes(recommendation.status) ||
      recommendation.primary?.skill !== diagnostic.prioritySkill ||
      !planTaskById(basePlan, recommendation.primary?.taskId) ||
      !recommendationBindingMatches({ binding: recommendation.evidenceBinding, cycle: record, diagnostic, plan: basePlan, primary: recommendation.primary })
    ) return null;

    if (
      !isRecord(checkIn) ||
      checkIn.status !== "saved" ||
      checkIn.cycleId !== record.cycleId ||
      checkIn.diagnosticSessionId !== record.diagnosticSessionId ||
      checkIn.planId !== record.basePlanId ||
      checkIn.recommendationId !== record.recommendationId ||
      checkIn.checkInId !== record.checkInId ||
      checkIn.evidenceClass !== "practice_receipt" ||
      checkIn.practiceAttemptId !== linkedPracticeReceipt?.practiceAttemptId ||
      checkIn.taskCompletionReceiptId !== linkedPracticeReceipt?.completionReceiptId ||
      linkedTaskProgress?.completionClass !== "practice_receipt" ||
      linkedTaskProgress?.practiceReceiptId !== linkedPracticeReceipt?.completionReceiptId ||
      !isRecord(storedPracticeReceipt) ||
      JSON.stringify(storedPracticeReceipt) !== JSON.stringify(linkedPracticeReceipt) ||
      !hasValidPracticeReceiptShape(linkedPracticeReceipt, checkIn.taskCompletionReceiptId) ||
      !practiceReceiptMatches({ receipt: linkedPracticeReceipt, cycle: record, diagnostic, plan: basePlan, recommendation, task: linkedPracticeTask })
    ) return null;

    if (
      !isRecord(review) ||
      review.cycleId !== record.cycleId ||
      review.reviewId !== record.reviewId ||
      review.checkInId !== record.checkInId ||
      review.learnerConfirmed !== true ||
      checkIn.reviewId !== record.reviewId ||
      checkIn.learnerConfirmedReview !== true ||
      !isRecord(peerHelp) ||
      peerHelp.cycleId !== record.cycleId ||
      peerHelp.peerHelpId !== record.peerHelpId ||
      peerHelp.planId !== record.basePlanId ||
      peerHelp.reviewId !== record.reviewId ||
      !VALID_PEER_HELP_STATES.has(peerHelp.status) ||
      peerHelp.realCommunityUsed !== false
    ) return null;

    if (
      !isRecord(retest) ||
      retest.status !== "completed" ||
      retest.cycleId !== record.cycleId ||
      retest.diagnosticSessionId !== record.diagnosticSessionId ||
      retest.planId !== record.basePlanId ||
      retest.recommendationId !== record.recommendationId ||
      retest.checkInId !== record.checkInId ||
      retest.reviewId !== record.reviewId ||
      retest.peerHelpId !== record.peerHelpId ||
      retest.retestId !== record.retestId ||
      retest.skill !== diagnostic.prioritySkill ||
      retest.skill !== linkedPracticeReceipt.skill ||
      retest.baselineTaskId !== linkedPracticeTask?.taskId ||
      retest.baselinePracticeReceiptId !== linkedPracticeReceipt.completionReceiptId ||
      retest.parallelTaskId !== retestCatalog?.taskId ||
      retest.taskVersion !== retestCatalog?.taskVersion ||
      retest.parallelFormPairId !== retestCatalog?.parallelFormPairId ||
      retest.parallelRetest !== true ||
      retest.comparability?.targetSkill !== diagnostic.prioritySkill ||
      retest.comparability?.sameSkill !== true ||
      retest.comparability?.sameAsDiagnosticPriority !== true ||
      retest.comparability?.sameAsPlanTask !== true ||
      retest.comparability?.sameAsPracticeReceipt !== true ||
      retest.comparability?.newOriginalPrompt !== true ||
      retest.comparability?.constructAlignment !== retestCatalog?.constructAlignment ||
      retest.comparability?.teacherReviewed !== false ||
      retest.comparability?.measurementReviewed !== false ||
      retest.comparability?.officialEquivalenceClaimed !== false ||
      retest.comparability?.comparisonBoundary !== "same_skill_only_no_calibrated_construct_or_difficulty_equivalence" ||
      !derivedRetestOutcome ||
      retest.evidence?.resultType !== derivedRetestOutcome.resultType ||
      retest.evidenceStatus !== derivedRetestOutcome.evidenceStatus ||
      retest.evidenceSufficiency !== derivedRetestOutcome.evidenceSufficiency ||
      retest.humanConfirmationStatus !== derivedRetestOutcome.humanConfirmationStatus ||
      retest.automatedScoreProduced !== false ||
      retest.growthClaimProduced !== false
    ) return null;

    const pendingHumanReview = record.status === "provisional_pending_human_review";
    if (
      !isRecord(planUpdate) ||
      planUpdate.cycleId !== record.cycleId ||
      planUpdate.retestId !== record.retestId ||
      planUpdate.supersedesPlanId !== record.basePlanId ||
      planUpdate.updatedPlanId !== record.updatedPlanId ||
      planUpdate.focusSkill !== updatedPlan.focusSkill ||
      planUpdate.learnerConfirmed !== true ||
      planUpdate.automatedAbilityDecision !== false ||
      (pendingHumanReview
        ? derivedRetestOutcome.humanReviewRequired !== true ||
          planUpdate.confirmationClass !== "provisional_pending_human_review" ||
          planUpdate.humanConfirmationStatus !== "required_not_completed"
        : derivedRetestOutcome.humanReviewRequired !== false ||
          planUpdate.confirmationClass !== "learner_confirmed_gate_a" ||
          planUpdate.humanConfirmationStatus !== "not_required_for_gate_a_flow") ||
      !historyMilestonesValid({ record, diagnostic, basePlan, recommendation, checkIn, review, peerHelp, retest, planUpdate, updatedPlan })
    ) return null;

    const eventChain = historyEventChainProjection({ candidateState, record, diagnostic, recommendation, checkIn, retest, planUpdate });
    if (!eventChain) return null;
    const terminalAt = pendingHumanReview ? record.provisionalAt : record.closedAt;
    return {
      cycleId: record.cycleId,
      diagnosticSessionId: record.diagnosticSessionId,
      basePlanId: record.basePlanId,
      recommendationId: record.recommendationId,
      checkInId: record.checkInId,
      reviewId: record.reviewId,
      peerHelpId: record.peerHelpId,
      retestId: record.retestId,
      updatedPlanId: record.updatedPlanId,
      taskSetVersion: diagnostic.taskSetVersion,
      baseFocusSkill: basePlan.focusSkill,
      updatedFocusSkill: updatedPlan.focusSkill,
      terminalAt,
      status: pendingHumanReview ? "pending_qualified_human_review" : "completed_local_cycle",
      eventCount: eventChain.eventCount,
    };
  };

  const buildCycleHistoryProjection = (candidateState, ledgerStatus) => {
    const history = Array.isArray(candidateState?.journey?.history) ? candidateState.journey.history : null;
    if (!history) {
      return { items: [], sourceCount: 0, validCount: 0, invalidCount: 1, currentExcludedCount: 0, hiddenValidCount: 0 };
    }
    if (!ledgerStatus?.ok) {
      return { items: [], sourceCount: history.length, validCount: 0, invalidCount: history.length, currentExcludedCount: 0, hiddenValidCount: 0 };
    }
    const cycleIdCounts = new Map();
    history.forEach((record) => {
      const cycleId = historyIdValid(record?.cycleId) ? record.cycleId : null;
      if (cycleId) cycleIdCounts.set(cycleId, (cycleIdCounts.get(cycleId) || 0) + 1);
    });
    const activeCycleId = historyIdValid(candidateState?.journey?.activeCycle?.cycleId)
      ? candidateState.journey.activeCycle.cycleId
      : null;
    const validated = [];
    let invalidCount = 0;
    let currentExcludedCount = 0;
    history.forEach((record) => {
      if (!historyIdValid(record?.cycleId) || cycleIdCounts.get(record.cycleId) !== 1) {
        invalidCount += 1;
        return;
      }
      const projected = projectValidatedCycleHistoryRecord(candidateState, record);
      if (!projected) {
        invalidCount += 1;
        return;
      }
      if (record.cycleId === activeCycleId) {
        currentExcludedCount += 1;
        return;
      }
      validated.push(projected);
    });
    validated.sort((left, right) => right.terminalAt.localeCompare(left.terminalAt));
    return {
      items: validated.slice(0, CYCLE_HISTORY_LIMIT),
      sourceCount: history.length,
      validCount: validated.length,
      invalidCount,
      currentExcludedCount,
      hiddenValidCount: Math.max(0, validated.length - CYCLE_HISTORY_LIMIT),
    };
  };

  const WORKSPACE_BACKUP_ACTIVE_CYCLE_KEYS = Object.freeze([
    "basePlanId",
    "checkInId",
    "closedAt",
    "createdAt",
    "cycleId",
    "diagnosticSessionId",
    "peerHelpId",
    "protocolVersion",
    "provisionalAt",
    "recommendationId",
    "retestId",
    "reviewId",
    "status",
    "updatedAt",
    "updatedPlanId",
  ].sort());
  const WORKSPACE_BACKUP_PROFILE_KEYS = Object.freeze([
    "dailyMinutes",
    "examDate",
    "focusSkill",
    "nickname",
  ].sort());
  const WORKSPACE_BACKUP_FOCUS_KEYS = Object.freeze(["active", "sessions"].sort());
  const WORKSPACE_BACKUP_PLAN_KEYS = Object.freeze([
    "createdAt", "dailyMinutes", "days", "diagnosticSessionId", "endDate", "examDate", "focusSkill",
    "nickname", "planId", "provenance", "startDate", "status", "supersededAt", "supersededByRetestId",
    "supersededReason",
  ]);
  const WORKSPACE_BACKUP_PLAN_PROVENANCE_KEYS = Object.freeze([
    "cycleId", "diagnosticSessionId", "priorityBasis", "retestId", "source", "supersedesPlanId",
    "taskSetDigest", "taskSetVersion",
  ]);
  const WORKSPACE_BACKUP_PLAN_TASK_KEYS = Object.freeze([
    "contentRef", "date", "durationMinutes", "instructionZh", "route", "skill", "taskId", "titleZh",
  ]);
  const WORKSPACE_BACKUP_CONTENT_REF_KEYS = Object.freeze([
    "contentHash", "contentId", "contentVersion", "exerciseId",
  ].sort());
  const WORKSPACE_BACKUP_RECEIPT_KEYS = Object.freeze([
    "activityId", "activityVersion", "attemptCount", "audioCompleted", "audioPlayed", "audioRecorded",
    "automatedScoreProduced", "completedAt", "completionCondition", "completionReceiptId", "completionSource",
    "contentHash", "contentId", "contentRef", "cycleId", "diagnosticSessionId", "evidence", "evidenceClass",
    "evidenceStatus", "evidenceType", "exerciseId", "formalDiagnosisProduced", "integrityClass",
    "officialEquivalenceClaimed", "ownerScope", "planId", "practiceAttemptId", "protocolVersion", "qualityFlags",
    "receiptEvidenceClass", "recommendationId", "route", "sealed", "selfCheckCount", "skill", "startedAt",
    "status", "taskDate", "taskId", "taskRef", "wordCount",
  ].sort());
  const WORKSPACE_BACKUP_TASK_REF_KEYS = Object.freeze([
    "cycleId", "diagnosticSessionId", "planId", "taskDate", "taskId",
  ].sort());
  const WORKSPACE_BACKUP_CHECK_IN_KEYS = Object.freeze([
    "anomalyReviewStatus", "archivedAt", "archivedReason", "checkInId", "cycleId", "date",
    "diagnosticSessionId", "didText", "evidenceClass", "evidenceText", "learnerConfirmedReview", "linkedTaskId",
    "planId", "practiceAttemptId", "practiceReceipt", "questionStatus", "questionText", "recommendationId",
    "reviewedAt", "reviewId", "savedAt", "status", "taskCompletionReceiptId", "updatedAt", "visibility",
  ]);
  const WORKSPACE_BACKUP_SAVED_CHECK_IN_KEYS = Object.freeze(
    WORKSPACE_BACKUP_CHECK_IN_KEYS.filter((key) => !["archivedAt", "archivedReason"].includes(key)).sort(),
  );
  const WORKSPACE_BACKUP_DRAFT_CHECK_IN_KEYS = Object.freeze([
    "checkInId", "date", "didText", "evidenceClass", "evidenceText", "learnerConfirmedReview", "linkedTaskId",
    "practiceAttemptId", "practiceReceipt", "questionStatus", "questionText", "reviewedAt", "reviewId", "status",
    "taskCompletionReceiptId", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_FOCUS_ACTIVE_KEYS = Object.freeze([
    "durationSeconds", "endsAt", "recordedAt", "remainingSeconds", "startedAt", "status",
  ]);
  const WORKSPACE_BACKUP_FOCUS_SESSION_KEYS = Object.freeze([
    "durationSeconds", "endedAt", "sessionId", "startedAt", "status",
  ].sort());
  const WORKSPACE_BACKUP_FOCUS_DURATIONS = new Set([15 * 60, 25 * 60, 45 * 60]);
  const WORKSPACE_BACKUP_PROGRESS_LEARNER_KEYS = Object.freeze([
    "completedAt", "completionClass", "selfReported", "source", "status", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_PROGRESS_PRACTICE_KEYS = Object.freeze([
    "completedAt", "completionClass", "evidenceStatus", "practiceReceiptId", "receiptEvidenceClass",
    "selfReported", "source", "status", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_PROGRESS_WORKFLOW_KEYS = Object.freeze([
    "completedAt", "completionClass", "selfReported", "source", "status", "updatedAt", "workflowReceipt",
  ].sort());
  const WORKSPACE_BACKUP_WORKFLOW_RECEIPT_KEYS = Object.freeze([
    "checkInId", "completedAt", "protocolVersion", "taskId",
  ].sort());
  const WORKSPACE_BACKUP_PRACTICE_FULL_KEYS = Object.freeze([
    "attemptScopeKey", "attempts", "audioCompleted", "audioPlaybackFailed", "audioPlayed", "audioRecorded",
    "audioSeekDetected", "audioStartedNearBeginning", "completedAt", "draftText", "firstResponse",
    "freshAttemptFromLegacyReceiptId", "latestPracticeReceiptId", "playCount", "selectedAnswer", "selfChecks",
    "startedAt", "status", "timerCompleted", "transcriptUsed", "updatedAt", "wordCount",
  ].sort());
  const WORKSPACE_BACKUP_PRACTICE_LISTENING_COMPACT_KEYS = Object.freeze([
    "attemptScopeKey", "attempts", "audioCompleted", "audioPlaybackFailed", "audioPlayed", "audioSeekDetected",
    "audioStartedNearBeginning", "firstResponse", "freshAttemptFromLegacyReceiptId", "latestPracticeReceiptId",
    "playCount", "selectedAnswer", "startedAt", "status", "transcriptUsed", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_EVENT_CONTEXT_KIND = Object.freeze({
    learningCycleId: "cycle",
    diagnosticSessionId: "diagnostic",
    planId: "plan",
    recommendationId: "recommendation",
    bindingId: "binding",
    taskId: "task",
    attemptId: "practiceAttempt",
    practiceReceiptId: "practiceReceipt",
    baselinePracticeReceiptId: "practiceReceipt",
    checkInId: "checkIn",
    retestId: "retest",
    humanReviewReceiptId: "humanReviewReceipt",
    updatedPlanId: "updatedPlan",
  });
  const WORKSPACE_BACKUP_DIAGNOSTIC_BASE_KEYS = Object.freeze([
    "activeTaskId", "adultConfirmed", "automatedScoreProduced", "consent", "createdAt", "cycleId",
    "demoGoal", "devicePrecheck", "diagnosticProtocolVersion", "diagnosticSessionId", "formalDiagnosisProduced",
    "officialEquivalenceClaimed", "protocolVersion", "status", "taskEvidence", "taskSetDigest", "taskSetVersion",
    "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_DIAGNOSTIC_COMPLETED_KEYS = Object.freeze([
    ...WORKSPACE_BACKUP_DIAGNOSTIC_BASE_KEYS,
    "completedAt", "completedEvidenceSkills", "completedEvidenceTaskCount", "evidenceConfidence",
    "evidenceSufficiency", "learnerConfirmedPriority", "patternFlags", "priorityBasis", "prioritySkill", "report",
    "suggestedPrioritySkills",
  ].sort());
  const WORKSPACE_BACKUP_DIAGNOSTIC_EVIDENCE_KEYS = Object.freeze([
    "attempts", "audioCompleted", "audioPlaybackCompletedAt", "audioPlaybackFailed", "audioPlaybackStartedAt",
    "audioPlayed", "audioRecorded", "audioSeekDetected", "audioStartedNearBeginning", "automatedScoreProduced",
    "completedAt", "constructTag", "contentHash", "durationSeconds", "evidenceStatus", "firstResponse", "pasteDetected",
    "playCount", "qualityFlags", "responseText", "responseType", "resultType", "selectedDraft", "selfChecks",
    "selfReviewCount", "skill", "speechSynthesisEnded", "speechSynthesisStarted", "speechVoice", "startedAt", "status",
    "taskId", "taskVersion", "timer", "timerCompleted", "transcriptUsed", "updatedAt", "wordCount",
  ].sort());
  const WORKSPACE_BACKUP_DIAGNOSTIC_REPORT_KEYS = Object.freeze([
    "completedEvidenceSkills", "completedEvidenceTaskCount", "confidence", "evidenceSufficiency", "patterns",
    "priorityBasis", "priorityCandidates", "priorityExplanation", "quality", "skills",
  ].sort());
  const WORKSPACE_BACKUP_RECOMMENDATION_KEYS = Object.freeze([
    "createdAt", "cycleId", "diagnosticSessionId", "evidenceBinding", "itemCount", "learnerChoice", "planId",
    "primary", "recommendationId", "sourceMode", "status", "supplements", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_RECOMMENDATION_PRIMARY_KEYS = Object.freeze([
    "contentHash", "contentId", "contentVersion", "duration", "exerciseId", "prerequisites", "reason", "reviewStatus",
    "reviewedAt", "role", "route", "skill", "source", "taskId", "title", "verification",
  ].sort());
  const WORKSPACE_BACKUP_RECOMMENDATION_SUPPLEMENT_KEYS = Object.freeze([
    "duration", "reason", "role", "route", "source", "title", "verification",
  ].sort());
  const WORKSPACE_BACKUP_RECOMMENDATION_BINDING_KEYS = Object.freeze([
    "bindingId", "bindingReason", "contentHash", "contentId", "contentVersion", "createdAt", "cycleId",
    "diagnosticEvidenceTaskIds", "diagnosticQualityFlags", "diagnosticSessionId", "errorPatternIds", "exerciseId",
    "measurementReviewed", "practiceTaskId", "prerequisites", "reviewStatus", "reviewedAt", "sourceClass",
    "teacherReviewed", "videoTimestamp",
  ].sort());
  const WORKSPACE_BACKUP_REVIEW_KEYS = Object.freeze([
    "checkInId", "confirmedAt", "cycleId", "humanEscalationStatus", "learnerConfirmed", "reminderStatus",
    "reviewId", "shareStatus",
  ].sort());
  const WORKSPACE_BACKUP_PEER_HELP_KEYS = Object.freeze([
    "createdAt", "cycleId", "learnerChoice", "peerHelpId", "planId", "realCommunityUsed", "reviewId", "source",
    "status", "updatedAt",
  ].sort());
  const WORKSPACE_BACKUP_RETEST_KEYS = Object.freeze([
    "automatedScoreProduced", "baselinePracticeReceiptId", "baselineTaskId", "checkInId", "comparability", "completedAt",
    "cycleId", "diagnosticSessionId", "evidence", "evidenceStatus", "evidenceSufficiency", "growthClaimProduced",
    "humanConfirmationStatus", "interpretation", "parallelFormPairId", "parallelRetest", "parallelTaskId", "peerHelpId",
    "planId", "recommendationId", "retestId", "reviewId", "skill", "status", "taskVersion",
  ].sort());
  const WORKSPACE_BACKUP_RETEST_COMPARABILITY_KEYS = Object.freeze([
    "comparisonBoundary", "constructAlignment", "measurementReviewed", "newOriginalPrompt", "officialEquivalenceClaimed",
    "sameAsDiagnosticPriority", "sameAsPlanTask", "sameAsPracticeReceipt", "sameSkill", "targetSkill", "teacherReviewed",
  ].sort());
  const WORKSPACE_BACKUP_PLAN_UPDATE_KEYS = Object.freeze([
    "automatedAbilityDecision", "confirmationClass", "createdAt", "cycleId", "focusSkill", "humanConfirmationStatus",
    "learnerConfirmed", "retestId", "supersedesPlanId", "updatedPlanId",
  ].sort());
  const WORKSPACE_BACKUP_SUPERSEDED_KEYS = Object.freeze([
    "cycleId", "diagnosticProtocolVersion", "diagnosticSessionId", "diagnosticStatus", "evidenceSufficiency",
    "priorityBasis", "prioritySkill", "protocolVersion", "reason", "status", "supersededAt", "taskEvidenceSummary",
    "taskSetDigest", "taskSetVersion",
  ].sort());
  const WORKSPACE_BACKUP_SUPERSEDED_EVIDENCE_KEYS = Object.freeze([
    "contentHash", "durationSeconds", "evidenceStatus", "qualityFlags", "resultType", "selfReviewCount", "skill",
    "status", "taskId", "taskVersion", "wordCount",
  ].sort());
  const WORKSPACE_BACKUP_STAGE_IDS = Object.freeze([
    "basePlanId",
    "recommendationId",
    "checkInId",
    "reviewId",
    "peerHelpId",
    "retestId",
    "updatedPlanId",
  ]);
  const WORKSPACE_BACKUP_STAGE_OBJECTS = Object.freeze([
    ["recommendationId", "recommendation"],
    ["reviewId", "review"],
    ["peerHelpId", "peerHelp"],
    ["retestId", "retest"],
    ["updatedPlanId", "planUpdate"],
  ]);
  const WORKSPACE_BACKUP_STAGE_LABELS = Object.freeze({
    diagnostic: "诊断进行中",
    plan: "下一步：生成 7 天计划",
    recommendation: "下一步：确认内容推荐",
    practice: "下一步：完成绑定练习",
    checkin: "下一步：保存证据式打卡",
    review: "下一步：确认复盘",
    community: "下一步：选择互助状态",
    retest: "下一步：完成平行微复测",
    update: "下一步：确认更新计划",
    complete: "本轮 Gate A 闭环已完成",
    empty: "尚未开始 Gate A 闭环",
  });

  const cloneJson = (value) => JSON.parse(JSON.stringify(value));
  const onlyAllowedObjectKeys = (value, allowedKeys) =>
    isRecord(value) && Object.keys(value).every((key) => allowedKeys.includes(key));
  const workspaceBackupSnapshot = (candidateState = state) => {
    const normalized = normalizeState(candidateState);
    if (!normalized) return null;
    const journey = normalized.journey || {};
    const active = isRecord(journey.activeCycle)
      ? {
          cycleId: journey.activeCycle.cycleId,
          protocolVersion: journey.activeCycle.protocolVersion,
          status: journey.activeCycle.status,
          diagnosticSessionId: journey.activeCycle.diagnosticSessionId,
          basePlanId: journey.activeCycle.basePlanId ?? null,
          recommendationId: journey.activeCycle.recommendationId ?? null,
          checkInId: journey.activeCycle.checkInId ?? null,
          reviewId: journey.activeCycle.reviewId ?? null,
          peerHelpId: journey.activeCycle.peerHelpId ?? null,
          retestId: journey.activeCycle.retestId ?? null,
          updatedPlanId: journey.activeCycle.updatedPlanId ?? null,
          createdAt: journey.activeCycle.createdAt,
          updatedAt: journey.activeCycle.updatedAt,
          closedAt: journey.activeCycle.closedAt ?? null,
          provisionalAt: journey.activeCycle.provisionalAt ?? null,
        }
      : null;
    return cloneJson({
      schemaVersion: normalized.schemaVersion,
      updatedAt: normalized.updatedAt,
      profile: normalized.profile,
      plan: normalized.plan,
      planHistory: normalized.planHistory,
      taskProgress: normalized.taskProgress,
      practice: normalized.practice,
      practiceReceipts: normalized.practiceReceipts,
      learningEvents: normalized.learningEvents,
      learningEventBindings: normalized.learningEventBindings,
      checkIns: normalized.checkIns,
      checkInHistory: normalized.checkInHistory,
      focus: normalized.focus,
      journey: {
        protocolVersion: journey.protocolVersion,
        activeCycle: active,
        diagnostic: journey.diagnostic ?? null,
        recommendation: journey.recommendation ?? null,
        review: journey.review ?? null,
        peerHelp: journey.peerHelp ?? null,
        retest: journey.retest ?? null,
        planUpdate: journey.planUpdate ?? null,
        history: Array.isArray(journey.history) ? journey.history : [],
        supersededCycles: Array.isArray(journey.supersededCycles) ? journey.supersededCycles : [],
      },
    });
  };

  const workspaceBackupCalendarDateValid = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  };
  const validWorkspaceBackupProfile = (profile) => Boolean(
    exactObjectKeys(profile, WORKSPACE_BACKUP_PROFILE_KEYS) &&
    typeof profile.nickname === "string" &&
    profile.nickname === profile.nickname.trim() &&
    profile.nickname.length <= 20 &&
    typeof profile.examDate === "string" &&
    (profile.examDate === "" || workspaceBackupCalendarDateValid(profile.examDate)) &&
    [15, 30, 45, 60].includes(profile.dailyMinutes) &&
    VALID_SKILLS.has(profile.focusSkill)
  );

  const validWorkspaceBackupDiagnosticReport = (report) => Boolean(
    exactObjectKeys(report, WORKSPACE_BACKUP_DIAGNOSTIC_REPORT_KEYS) &&
    ["evidence_limited", "evidence_insufficient"].includes(report.evidenceSufficiency) &&
    ["low", "medium"].includes(report.confidence) &&
    Number.isInteger(report.completedEvidenceTaskCount) &&
    report.completedEvidenceTaskCount >= 0 &&
    report.completedEvidenceTaskCount <= DIAGNOSTIC_TASK_IDS.length &&
    Array.isArray(report.completedEvidenceSkills) &&
    new Set(report.completedEvidenceSkills).size === report.completedEvidenceSkills.length &&
    report.completedEvidenceSkills.every((skill) => VALID_SKILLS.has(skill) && skill !== "Balanced") &&
    Array.isArray(report.priorityCandidates) &&
    report.priorityCandidates.length >= 1 &&
    new Set(report.priorityCandidates).size === report.priorityCandidates.length &&
    report.priorityCandidates.every((skill) => VALID_SKILLS.has(skill) && skill !== "Balanced") &&
    Object.hasOwn(priorityBasisLabels, report.priorityBasis) &&
    typeof report.priorityExplanation === "string" &&
    Array.isArray(report.patterns) && report.patterns.every((item) => typeof item === "string") &&
    Array.isArray(report.quality) && report.quality.every((item) => typeof item === "string") &&
    exactObjectKeys(report.skills, ["Listening", "Reading", "Speaking", "Writing"]) &&
    Object.values(report.skills).every((summary) =>
      exactObjectKeys(summary, ["detail", "headline", "label"]) &&
      [summary.detail, summary.headline, summary.label].every((value) => typeof value === "string")
    )
  );

  const WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS = Object.freeze([
    "constructTag", "contentHash", "evidenceStatus", "qualityFlags", "responseType", "skill", "startedAt", "status",
    "taskId", "taskVersion", "updatedAt",
  ]);
  const WORKSPACE_BACKUP_DIAGNOSTIC_OBJECTIVE_KEYS = Object.freeze([
    "attempts", "completedAt", "durationSeconds", "firstResponse", "resultType", "selectedDraft",
  ]);
  const WORKSPACE_BACKUP_DIAGNOSTIC_LISTENING_KEYS = Object.freeze([
    "audioCompleted", "audioPlaybackCompletedAt", "audioPlaybackFailed", "audioPlaybackStartedAt", "audioPlayed",
    "audioSeekDetected", "audioStartedNearBeginning", "playCount", "speechSynthesisEnded", "speechSynthesisStarted",
    "speechVoice", "transcriptUsed",
  ]);
  const WORKSPACE_BACKUP_DIAGNOSTIC_SPEAKING_KEYS = Object.freeze([
    "audioRecorded", "automatedScoreProduced", "completedAt", "durationSeconds", "selfChecks", "selfReviewCount",
    "timer", "timerCompleted",
  ]);
  const WORKSPACE_BACKUP_DIAGNOSTIC_WRITING_KEYS = Object.freeze([
    "automatedScoreProduced", "completedAt", "durationSeconds", "pasteDetected", "responseText", "selfChecks",
    "selfReviewCount", "timer", "timerCompleted", "wordCount",
  ]);
  const workspaceBackupSameStringSet = (actual, expected) => Boolean(
    Array.isArray(actual) &&
    new Set(actual).size === actual.length &&
    actual.every((item) => typeof item === "string") &&
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
  const workspaceBackupDiagnosticWordCount = (text) =>
    typeof text === "string" && text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const workspaceBackupValidTimerNumber = (value) => Number.isInteger(value) && value >= 0;
  const workspaceBackupValidDiagnosticTimer = (evidence, expected) => {
    const timer = evidence.timer;
    if (!isRecord(timer)) return false;
    const evidenceStartedAt = Date.parse(evidence.startedAt);
    const evidenceUpdatedAt = Date.parse(evidence.updatedAt);
    if (expected.skill === "Speaking") {
      const review = timer.phase === "review";
      if (!exactObjectKeys(timer, review
        ? ["endedAt", "phase", "prepEndsAt", "responseEndsAt", "startedAt"]
        : ["phase", "prepEndsAt", "responseEndsAt", "startedAt"])) return false;
      if (!["prep", "response", "review"].includes(timer.phase)) return false;
      if (![timer.startedAt, timer.prepEndsAt, timer.responseEndsAt, ...(review ? [timer.endedAt] : [])].every(workspaceBackupValidTimerNumber)) return false;
      if (timer.prepEndsAt - timer.startedAt !== 20_000 || timer.responseEndsAt - timer.prepEndsAt !== 90_000) return false;
      if (timer.startedAt < evidenceStartedAt || timer.startedAt > evidenceUpdatedAt || (review && timer.endedAt > evidenceUpdatedAt)) return false;
      if (!review) return !Object.hasOwn(evidence, "durationSeconds") && !Object.hasOwn(evidence, "timerCompleted");
      if (timer.endedAt < timer.prepEndsAt) return false;
      const expectedDuration = Math.max(0, Math.min(90, Math.round((timer.endedAt - timer.prepEndsAt) / 1000)));
      return Number.isInteger(evidence.durationSeconds) &&
        evidence.durationSeconds === expectedDuration &&
        evidence.timerCompleted === (expectedDuration >= 90);
    }
    if (expected.skill === "Writing") {
      const review = timer.phase === "review";
      if (!exactObjectKeys(timer, review ? ["endedAt", "endsAt", "phase", "startedAt"] : ["endsAt", "phase", "startedAt"])) return false;
      if (!["running", "review"].includes(timer.phase)) return false;
      if (![timer.startedAt, timer.endsAt, ...(review ? [timer.endedAt] : [])].every(workspaceBackupValidTimerNumber)) return false;
      if (timer.endsAt - timer.startedAt !== 180_000) return false;
      if (timer.startedAt < evidenceStartedAt || timer.startedAt > evidenceUpdatedAt || (review && timer.endedAt > evidenceUpdatedAt)) return false;
      if (!review) return !Object.hasOwn(evidence, "durationSeconds") && !Object.hasOwn(evidence, "timerCompleted");
      if (timer.endedAt < timer.startedAt) return false;
      const expectedDuration = Math.max(0, Math.min(180, Math.round((timer.endedAt - timer.startedAt) / 1000)));
      return Number.isInteger(evidence.durationSeconds) &&
        evidence.durationSeconds === expectedDuration &&
        evidence.timerCompleted === (expectedDuration >= 180);
    }
    return false;
  };
  const workspaceBackupValidListeningProgress = (evidence) => {
    const isSpeechTask = evidence.taskId === "diagnostic-listening-language-lab-v1";
    for (const field of ["audioCompleted", "audioPlaybackFailed", "audioPlayed", "audioSeekDetected", "audioStartedNearBeginning", "speechSynthesisEnded", "speechSynthesisStarted", "transcriptUsed"]) {
      if (Object.hasOwn(evidence, field) && typeof evidence[field] !== "boolean") return false;
    }
    if (Object.hasOwn(evidence, "playCount") && (!Number.isInteger(evidence.playCount) || evidence.playCount < 1)) return false;
    for (const field of ["audioPlaybackCompletedAt", "audioPlaybackStartedAt"]) {
      if (Object.hasOwn(evidence, field) && !exactUtcTimestamp(evidence[field])) return false;
    }
    if (isSpeechTask) {
      if (["audioPlaybackStartedAt", "audioSeekDetected", "audioStartedNearBeginning"].some((field) => Object.hasOwn(evidence, field))) return false;
      if (evidence.audioPlayed === true) {
        if (evidence.speechSynthesisStarted !== true || !Number.isInteger(evidence.playCount)) return false;
        if (
          !exactObjectKeys(evidence.speechVoice, ["default", "lang", "localService"]) ||
          typeof evidence.speechVoice.lang !== "string" || evidence.speechVoice.lang.length < 1 || evidence.speechVoice.lang.length > 20 ||
          typeof evidence.speechVoice.localService !== "boolean" || typeof evidence.speechVoice.default !== "boolean"
        ) return false;
      } else if (["audioCompleted", "playCount", "speechSynthesisEnded", "speechSynthesisStarted", "speechVoice"].some((field) => Object.hasOwn(evidence, field))) return false;
      if (evidence.audioCompleted === true) {
        if (
          evidence.audioPlayed !== true || evidence.speechSynthesisEnded !== true || evidence.audioPlaybackFailed === true ||
          !exactUtcTimestamp(evidence.audioPlaybackCompletedAt)
        ) return false;
      } else if (evidence.speechSynthesisEnded === true || Object.hasOwn(evidence, "audioPlaybackCompletedAt")) return false;
    } else {
      if (["speechSynthesisEnded", "speechSynthesisStarted", "speechVoice"].some((field) => Object.hasOwn(evidence, field))) return false;
      if (evidence.audioPlayed === true) {
        if (!Number.isInteger(evidence.playCount) || typeof evidence.audioCompleted !== "boolean" || typeof evidence.audioStartedNearBeginning !== "boolean" || !exactUtcTimestamp(evidence.audioPlaybackStartedAt)) return false;
      } else if (
        (Object.hasOwn(evidence, "audioCompleted") && evidence.audioCompleted !== false) ||
        ["audioPlaybackStartedAt", "audioStartedNearBeginning", "playCount"].some((field) => Object.hasOwn(evidence, field))
      ) return false;
      if (evidence.audioCompleted === true) {
        if (evidence.audioStartedNearBeginning !== true || evidence.audioSeekDetected === true || evidence.audioPlaybackFailed === true || !exactUtcTimestamp(evidence.audioPlaybackCompletedAt)) return false;
      } else if (Object.hasOwn(evidence, "audioPlaybackCompletedAt") && evidence.audioPlayed !== true) return false;
    }
    if (evidence.audioPlaybackCompletedAt && evidence.audioPlaybackStartedAt && Date.parse(evidence.audioPlaybackCompletedAt) < Date.parse(evidence.audioPlaybackStartedAt)) return false;
    for (const field of ["audioPlaybackCompletedAt", "audioPlaybackStartedAt"]) {
      if (
        evidence[field] &&
        (Date.parse(evidence[field]) < Date.parse(evidence.startedAt) || Date.parse(evidence[field]) > Date.parse(evidence.updatedAt))
      ) return false;
    }
    return true;
  };
  const workspaceBackupExpectedDiagnosticQualityFlags = (evidence, diagnostic) => {
    const flags = [];
    const timerStarted = isRecord(evidence.timer) && workspaceBackupValidTimerNumber(evidence.timer.startedAt);
    if (evidence.qualityFlags.includes("resumed_after_reload") && timerStarted) flags.push("resumed_after_reload");
    if (evidence.skill === "Listening") {
      const speechTask = evidence.taskId === "diagnostic-listening-language-lab-v1";
      if (evidence.audioSeekDetected === true) flags.push("audio_seek_detected");
      if (evidence.audioPlaybackFailed === true) flags.push("audio_playback_failed");
      if (speechTask && evidence.audioPlaybackFailed === true) flags.push("speech_synthesis_error");
      if (evidence.transcriptUsed === true) flags.push("transcript_used");
      if (speechTask && (evidence.speechSynthesisStarted === true || evidence.status === "completed")) flags.push("browser_voice_variability");
      if (speechTask && evidence.speechSynthesisStarted === true && evidence.speechVoice?.lang === "browser-default") flags.push("voice_not_loaded");
      if (
        speechTask && evidence.speechSynthesisStarted === true &&
        (evidence.speechVoice?.lang === "browser-default" || evidence.speechVoice?.lang?.toLowerCase() !== "en-us" || evidence.speechVoice?.localService !== true)
      ) flags.push("voice_fallback_used");
      if (evidence.status === "completed") {
        if (evidence.audioPlayed !== true) flags.push("audio_not_played");
        if (evidence.audioPlayed === true && evidence.audioCompleted !== true) flags.push("audio_not_completed");
        if (diagnostic.devicePrecheck.audioOutputStatus !== "heard") flags.push("audio_output_unavailable");
        if (Number(evidence.playCount || 0) > 2) flags.push("multiple_replays");
      }
    }
    if (evidence.skill === "Writing") {
      if (evidence.pasteDetected === true) flags.push("writing_paste_detected");
      if (evidence.timer?.phase === "review" && evidence.timerCompleted !== true) flags.push("writing_ended_early");
    }
    if (evidence.skill === "Speaking" && evidence.timer?.phase === "review" && evidence.timerCompleted !== true) flags.push("speaking_ended_early");
    if (["skipped", "unavailable"].includes(evidence.status)) {
      flags.push(evidence.status === "unavailable" ? "task_unavailable" : "learner_skipped");
    } else if (evidence.skill === "Speaking" && evidence.status === "completed") {
      flags.push("audio_not_recorded", "open_response_not_human_reviewed");
      if (evidence.selfReviewCount < 3) flags.push("self_review_incomplete");
    } else if (evidence.skill === "Writing" && ["completed", "evidence_insufficient"].includes(evidence.status)) {
      flags.push("open_response_not_human_reviewed");
      if (evidence.wordCount < 20) flags.push("writing_below_completion_condition");
      if (evidence.selfReviewCount < 3) flags.push("self_review_incomplete");
    }
    return [...new Set(flags)];
  };
  const validWorkspaceBackupDiagnosticEvidence = (evidence, diagnostic) => {
    const expected = DIAGNOSTIC_TASK_MANIFEST[evidence?.taskId];
    const allowedKeys = expected?.skill === "Listening"
      ? [...WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS, ...WORKSPACE_BACKUP_DIAGNOSTIC_OBJECTIVE_KEYS, ...WORKSPACE_BACKUP_DIAGNOSTIC_LISTENING_KEYS]
      : expected?.skill === "Reading"
        ? [...WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS, ...WORKSPACE_BACKUP_DIAGNOSTIC_OBJECTIVE_KEYS]
        : expected?.skill === "Speaking"
          ? [...WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS, ...WORKSPACE_BACKUP_DIAGNOSTIC_SPEAKING_KEYS]
          : [...WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS, ...WORKSPACE_BACKUP_DIAGNOSTIC_WRITING_KEYS];
    if (
      !expected || !onlyAllowedObjectKeys(evidence, allowedKeys) ||
      !exactObjectKeys(Object.fromEntries(Object.entries(evidence).filter(([key]) => WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS.includes(key))), WORKSPACE_BACKUP_DIAGNOSTIC_COMMON_EVIDENCE_KEYS) ||
      !Object.entries(expected).filter(([key]) => key !== "correctValue").every(([key, value]) => evidence[key] === value) ||
      !DIAGNOSTIC_EVIDENCE_STATES.has(evidence.evidenceStatus) ||
      !exactUtcTimestamp(evidence.startedAt) || !exactUtcTimestamp(evidence.updatedAt) ||
      Date.parse(evidence.updatedAt) < Date.parse(evidence.startedAt) ||
      !Array.isArray(evidence.qualityFlags) ||
      evidence.qualityFlags.some((flag) => !DIAGNOSTIC_QUALITY_FLAGS.has(flag))
    ) return false;
    const terminal = DIAGNOSTIC_TERMINAL_STATES.has(evidence.status);
    if (terminal) {
      if (!exactUtcTimestamp(evidence.completedAt) || evidence.completedAt !== evidence.updatedAt) return false;
    } else if (evidence.status !== "in_progress" || Object.hasOwn(evidence, "completedAt")) return false;
    if (evidence.status === "unavailable" && expected.skill !== "Listening") return false;
    if (
      expected.skill === "Reading" && !["in_progress", "completed", "skipped"].includes(evidence.status) ||
      expected.skill === "Listening" && !["in_progress", "completed", "skipped", "unavailable"].includes(evidence.status)
    ) return false;
    if (
      expected.skill === "Listening" && ["skipped", "unavailable"].includes(evidence.status) &&
      evidence.status !== (
        diagnostic.devicePrecheck.audioOutputStatus === "unavailable" || evidence.audioPlaybackFailed === true
          ? "unavailable"
          : "skipped"
      )
    ) return false;
    if (["skipped", "unavailable"].includes(evidence.status) && evidence.evidenceStatus !== "evidence_insufficient") return false;
    if (evidence.status === "in_progress" && evidence.evidenceStatus !== "evidence_limited") return false;

    if (["Reading", "Listening"].includes(expected.skill)) {
      if (Object.hasOwn(evidence, "selectedDraft") && !["a", "b", "c"].includes(evidence.selectedDraft)) return false;
      if (evidence.status === "completed") {
        if (
          evidence.attempts !== 1 || !["a", "b", "c"].includes(evidence.firstResponse) ||
          Object.hasOwn(evidence, "selectedDraft") || !Number.isInteger(evidence.durationSeconds) || evidence.durationSeconds < 0 ||
          evidence.durationSeconds !== Math.max(0, Math.round((Date.parse(evidence.completedAt) - Date.parse(evidence.startedAt)) / 1000)) ||
          evidence.resultType !== (evidence.firstResponse === expected.correctValue ? "first_response_matched" : "first_response_not_matched")
        ) return false;
      } else if (["attempts", "durationSeconds", "firstResponse", "resultType"].some((field) => Object.hasOwn(evidence, field))) return false;
      if (expected.skill === "Reading" && evidence.status === "completed" && evidence.evidenceStatus !== "evidence_limited") return false;
      if (expected.skill === "Listening") {
        if (!workspaceBackupValidListeningProgress(evidence)) return false;
        if (evidence.status === "completed") {
          const insufficient = ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "speech_synthesis_error", "audio_output_unavailable", "transcript_used"]
            .some((flag) => evidence.qualityFlags.includes(flag));
          if (evidence.evidenceStatus !== (insufficient ? "evidence_insufficient" : "evidence_limited")) return false;
        }
      }
    } else {
      if (Object.hasOwn(evidence, "timer") && !workspaceBackupValidDiagnosticTimer(evidence, expected)) return false;
      if (Object.hasOwn(evidence, "selfChecks")) {
        const keys = expected.skill === "Speaking" ? ["connected", "coverage", "support"] : ["change", "reviewed", "support"];
        if (
          !exactObjectKeys(evidence.selfChecks, keys) ||
          !Object.values(evidence.selfChecks).every((value) => typeof value === "boolean") ||
          evidence.timer?.phase !== "review"
        ) return false;
      }
      if (
        ["durationSeconds", "timerCompleted"].some((field) => Object.hasOwn(evidence, field)) &&
        !isRecord(evidence.timer)
      ) return false;
      if (expected.skill === "Speaking") {
        if (["completed", "evidence_insufficient"].includes(evidence.status) && evidence.status !== "completed") return false;
        if (evidence.status === "completed") {
          if (
            evidence.timer?.phase !== "review" || !isRecord(evidence.selfChecks) ||
            evidence.selfReviewCount !== Object.values(evidence.selfChecks).filter(Boolean).length ||
            evidence.audioRecorded !== false || evidence.automatedScoreProduced !== false ||
            evidence.evidenceStatus !== "evidence_insufficient"
          ) return false;
        } else if (["selfReviewCount", "audioRecorded", "automatedScoreProduced"].some((field) => Object.hasOwn(evidence, field))) return false;
      } else {
        if (
          ["pasteDetected", "responseText", "selfChecks", "wordCount"].some((field) => Object.hasOwn(evidence, field)) &&
          !isRecord(evidence.timer)
        ) return false;
        if (Object.hasOwn(evidence, "responseText") && (typeof evidence.responseText !== "string" || evidence.responseText.length > 1800)) return false;
        if (Object.hasOwn(evidence, "wordCount") && evidence.wordCount !== workspaceBackupDiagnosticWordCount(evidence.responseText)) return false;
        if (Object.hasOwn(evidence, "pasteDetected") && evidence.pasteDetected !== true) return false;
        const submitted = ["completed", "evidence_insufficient"].includes(evidence.status);
        if (submitted) {
          if (
            evidence.timer?.phase !== "review" || typeof evidence.responseText !== "string" || !isRecord(evidence.selfChecks) ||
            !Object.hasOwn(evidence, "wordCount") || !Number.isInteger(evidence.wordCount) ||
            evidence.selfReviewCount !== Object.values(evidence.selfChecks).filter(Boolean).length || evidence.automatedScoreProduced !== false ||
            evidence.status !== (evidence.wordCount >= 20 ? "completed" : "evidence_insufficient") ||
            evidence.evidenceStatus !== "evidence_insufficient"
          ) return false;
        } else if (["selfReviewCount", "automatedScoreProduced"].some((field) => Object.hasOwn(evidence, field))) return false;
        if (Object.hasOwn(evidence, "timer") && typeof evidence.responseText !== "string") return false;
      }
    }
    return workspaceBackupSameStringSet(
      evidence.qualityFlags,
      workspaceBackupExpectedDiagnosticQualityFlags(evidence, diagnostic),
    );
  };

  const validWorkspaceBackupDiagnostic = (diagnostic) => {
    if (!isRecord(diagnostic)) return false;
    const expectedKeys = diagnostic.status === "completed"
      ? WORKSPACE_BACKUP_DIAGNOSTIC_COMPLETED_KEYS
      : diagnostic.status === "awaiting_confirmation"
        ? [...WORKSPACE_BACKUP_DIAGNOSTIC_BASE_KEYS, "reportDraft"]
        : WORKSPACE_BACKUP_DIAGNOSTIC_BASE_KEYS;
    if (
      !exactObjectKeys(diagnostic, expectedKeys) ||
      !["in_progress", "awaiting_confirmation", "completed"].includes(diagnostic.status) ||
      diagnostic.protocolVersion !== PROTOCOL_VERSION ||
      diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
      diagnostic.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      diagnostic.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      !historyIdValid(diagnostic.cycleId) ||
      !historyIdValid(diagnostic.diagnosticSessionId) ||
      diagnostic.adultConfirmed !== true ||
      diagnostic.demoGoal !== "det_preparation_4_weeks" ||
      diagnostic.automatedScoreProduced !== false ||
      diagnostic.formalDiagnosisProduced !== false ||
      diagnostic.officialEquivalenceClaimed !== false ||
      !exactUtcTimestamp(diagnostic.createdAt) ||
      !exactUtcTimestamp(diagnostic.updatedAt) ||
      Date.parse(diagnostic.updatedAt) < Date.parse(diagnostic.createdAt) ||
      !exactObjectKeys(diagnostic.consent, ["confirmedAt", "localOnlyConfirmed", "noModelTrainingConfirmed", "noScoreConfirmed"]) ||
      diagnostic.consent.localOnlyConfirmed !== true ||
      diagnostic.consent.noModelTrainingConfirmed !== true ||
      diagnostic.consent.noScoreConfirmed !== true ||
      !exactUtcTimestamp(diagnostic.consent.confirmedAt) ||
      !exactObjectKeys(diagnostic.devicePrecheck, [
        "audioOutputStatus", "completedAt", "environmentConfirmed", "keyboardConfirmed", "microphoneMode", "mp3Supported",
        "networkAtStart", "safeWriteLockSupported", "speechSynthesisSupported", "storageStatus", "viewportMode",
      ]) ||
      diagnostic.devicePrecheck.storageStatus !== "available" ||
      !["heard", "unavailable"].includes(diagnostic.devicePrecheck.audioOutputStatus) ||
      diagnostic.devicePrecheck.safeWriteLockSupported !== true ||
      diagnostic.devicePrecheck.keyboardConfirmed !== true ||
      diagnostic.devicePrecheck.environmentConfirmed !== true ||
      diagnostic.devicePrecheck.microphoneMode !== "not_requested" ||
      !["desktop_or_tablet", "mobile_lightweight"].includes(diagnostic.devicePrecheck.viewportMode) ||
      !["online", "offline"].includes(diagnostic.devicePrecheck.networkAtStart) ||
      typeof diagnostic.devicePrecheck.mp3Supported !== "boolean" ||
      typeof diagnostic.devicePrecheck.speechSynthesisSupported !== "boolean" ||
      !exactUtcTimestamp(diagnostic.devicePrecheck.completedAt) ||
      diagnostic.consent.confirmedAt !== diagnostic.createdAt ||
      diagnostic.devicePrecheck.completedAt !== diagnostic.createdAt ||
      !Array.isArray(diagnostic.taskEvidence) ||
      !diagnostic.taskEvidence.every((evidence) => validWorkspaceBackupDiagnosticEvidence(evidence, diagnostic)) ||
      !diagnosticEvidenceCollectionValid(diagnostic, { requireAllTerminal: diagnostic.status !== "in_progress" })
    ) return false;
    let previousEvidenceAt = Date.parse(diagnostic.createdAt);
    for (const evidence of diagnostic.taskEvidence) {
      if (
        Date.parse(evidence.startedAt) < previousEvidenceAt ||
        Date.parse(evidence.updatedAt) > Date.parse(diagnostic.updatedAt)
      ) return false;
      previousEvidenceAt = DIAGNOSTIC_TERMINAL_STATES.has(evidence.status)
        ? Date.parse(evidence.completedAt)
        : Date.parse(evidence.startedAt);
    }
    if (diagnostic.status === "in_progress") {
      return true;
    }
    if (diagnostic.activeTaskId !== null) return false;
    const report = diagnostic.status === "completed" ? diagnostic.report : diagnostic.reportDraft;
    if (
      !validWorkspaceBackupDiagnosticReport(report) ||
      workspaceBackupRuntime.canonicalJson(report) !== workspaceBackupRuntime.canonicalJson(buildDiagnosticReport(diagnostic))
    ) return false;
    if (diagnostic.status === "awaiting_confirmation") return true;
    return Boolean(
      exactUtcTimestamp(diagnostic.completedAt) &&
      Date.parse(diagnostic.completedAt) >= Date.parse(diagnostic.createdAt) &&
      VALID_SKILLS.has(diagnostic.prioritySkill) &&
      diagnostic.prioritySkill !== "Balanced" &&
      diagnostic.learnerConfirmedPriority === true &&
      diagnostic.completedEvidenceTaskCount === report.completedEvidenceTaskCount &&
      workspaceBackupRuntime.canonicalJson(diagnostic.completedEvidenceSkills) === workspaceBackupRuntime.canonicalJson(report.completedEvidenceSkills) &&
      diagnostic.evidenceSufficiency === report.evidenceSufficiency &&
      diagnostic.evidenceConfidence === report.confidence &&
      diagnostic.priorityBasis === report.priorityBasis &&
      workspaceBackupRuntime.canonicalJson(diagnostic.suggestedPrioritySkills) === workspaceBackupRuntime.canonicalJson(report.priorityCandidates) &&
      report.priorityCandidates.includes(diagnostic.prioritySkill) &&
      workspaceBackupRuntime.canonicalJson(diagnostic.patternFlags) === workspaceBackupRuntime.canonicalJson(
        terminalDiagnosticEvidence(diagnostic)
          .filter((item) => item.resultType === "first_response_not_matched")
          .map((item) => item.constructTag),
      ) &&
      diagnostic.completedAt === diagnostic.updatedAt &&
      Date.parse(diagnostic.completedAt) >= Math.max(
        Date.parse(diagnostic.createdAt),
        ...diagnostic.taskEvidence.map((item) => Date.parse(item.completedAt)),
      )
    );
  };

  const validWorkspaceBackupRecommendation = (recommendation) => {
    if (!exactObjectKeys(recommendation, WORKSPACE_BACKUP_RECOMMENDATION_KEYS)) return false;
    const primary = recommendation.primary;
    const binding = recommendation.evidenceBinding;
    if (
      !historyIdValid(recommendation.recommendationId) ||
      !historyIdValid(recommendation.cycleId) ||
      !historyIdValid(recommendation.planId) ||
      !historyIdValid(recommendation.diagnosticSessionId) ||
      !["accepted", "skipped"].includes(recommendation.status) ||
      recommendation.itemCount !== 3 ||
      recommendation.learnerChoice !== true ||
      recommendation.sourceMode !== "frozen_local_routes_no_rag" ||
      !exactUtcTimestamp(recommendation.createdAt) ||
      !exactUtcTimestamp(recommendation.updatedAt) ||
      recommendation.updatedAt !== recommendation.createdAt ||
      !exactObjectKeys(primary, WORKSPACE_BACKUP_RECOMMENDATION_PRIMARY_KEYS) ||
      !exactObjectKeys(binding, WORKSPACE_BACKUP_RECOMMENDATION_BINDING_KEYS) ||
      !Array.isArray(recommendation.supplements) ||
      recommendation.supplements.length !== 2 ||
      !recommendation.supplements.every((item) => exactObjectKeys(item, WORKSPACE_BACKUP_RECOMMENDATION_SUPPLEMENT_KEYS))
    ) return false;
    if (
      primary.role !== "主任务" ||
      !VALID_SKILLS.has(primary.skill) || primary.skill === "Balanced" ||
      !isSafeLocalRoute(primary.route) ||
      primary.reviewStatus !== "gate_a_unreviewed" ||
      primary.reviewedAt !== null ||
      primary.source !== "Sufeiya 原创 Gate A 微练习 v1 · 未经教研与测量双签" ||
      workspaceBackupRuntime.canonicalJson(primary.prerequisites) !== workspaceBackupRuntime.canonicalJson(["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"])
    ) return false;
    const expectedSupplements = [
      {
        role: "可选补充 1",
        title: "15 分钟专注计时",
        route: "/focus",
        reason: "为主任务保留一段不被打断的时间；计时不会被当成能力或完成证据。",
        duration: "15 分钟起",
        source: "Sufeiya 本机工具",
        verification: "计时后仍需完成任务并自行复盘。",
      },
      {
        role: "可选补充 2",
        title: "查看已审阅的公开资源目录",
        route: "/resources",
        reason: "需要更多公开材料入口时自行选择；目录不等于 RAG 知识库。",
        duration: "按需",
        source: "本站冻结资源目录",
        verification: "只把实际完成的学习写入复盘，不以打开链接代替完成。",
      },
    ];
    if (workspaceBackupRuntime.canonicalJson(recommendation.supplements) !== workspaceBackupRuntime.canonicalJson(expectedSupplements)) {
      return false;
    }
    if (
      !historyIdValid(binding.bindingId) ||
      !historyIdValid(binding.practiceTaskId) ||
      binding.cycleId !== recommendation.cycleId ||
      binding.diagnosticSessionId !== recommendation.diagnosticSessionId ||
      binding.practiceTaskId !== primary.taskId ||
      binding.exerciseId !== primary.exerciseId ||
      binding.contentId !== primary.contentId ||
      binding.contentVersion !== primary.contentVersion ||
      binding.contentHash !== primary.contentHash ||
      binding.bindingReason !== primary.reason ||
      binding.sourceClass !== "first_party_original_gate_a" ||
      binding.reviewStatus !== "gate_a_unreviewed" ||
      binding.reviewedAt !== null ||
      binding.teacherReviewed !== false ||
      binding.measurementReviewed !== false ||
      binding.videoTimestamp !== null ||
      !exactUtcTimestamp(binding.createdAt) ||
      binding.createdAt !== recommendation.createdAt ||
      ![binding.errorPatternIds, binding.diagnosticEvidenceTaskIds, binding.diagnosticQualityFlags].every((items) =>
        Array.isArray(items) && new Set(items).size === items.length && items.every((item) => typeof item === "string")
      ) ||
      workspaceBackupRuntime.canonicalJson(binding.prerequisites) !== workspaceBackupRuntime.canonicalJson(primary.prerequisites)
    ) return false;
    return recommendation.supplements.every((item) => isSafeLocalRoute(item.route));
  };

  const validWorkspaceBackupReview = (review) => Boolean(
    exactObjectKeys(review, WORKSPACE_BACKUP_REVIEW_KEYS) &&
    [review.cycleId, review.reviewId, review.checkInId].every(historyIdValid) &&
    review.learnerConfirmed === true &&
    review.shareStatus === "not_shared" &&
    review.reminderStatus === "not_enabled" &&
    review.humanEscalationStatus === "not_requested" &&
    exactUtcTimestamp(review.confirmedAt)
  );

  const validWorkspaceBackupPeerHelp = (peerHelp) => Boolean(
    exactObjectKeys(peerHelp, WORKSPACE_BACKUP_PEER_HELP_KEYS) &&
    [peerHelp.cycleId, peerHelp.peerHelpId, peerHelp.planId, peerHelp.reviewId].every(historyIdValid) &&
    VALID_PEER_HELP_STATES.has(peerHelp.status) &&
    peerHelp.source === "synthetic_demo_card_v1" &&
    peerHelp.learnerChoice === true &&
    peerHelp.realCommunityUsed === false &&
    exactUtcTimestamp(peerHelp.createdAt) &&
    exactUtcTimestamp(peerHelp.updatedAt) &&
    Date.parse(peerHelp.updatedAt) >= Date.parse(peerHelp.createdAt)
  );

  const validWorkspaceBackupRetest = (retest) => {
    if (
      !exactObjectKeys(retest, WORKSPACE_BACKUP_RETEST_KEYS) ||
      !exactObjectKeys(retest.comparability, WORKSPACE_BACKUP_RETEST_COMPARABILITY_KEYS) ||
      ![retest.cycleId, retest.retestId, retest.diagnosticSessionId, retest.planId, retest.recommendationId,
        retest.checkInId, retest.reviewId, retest.peerHelpId, retest.baselineTaskId,
        retest.baselinePracticeReceiptId].every(historyIdValid) ||
      !VALID_SKILLS.has(retest.skill) || retest.skill === "Balanced" ||
      retest.status !== "completed" ||
      retest.parallelRetest !== true ||
      retest.automatedScoreProduced !== false ||
      retest.growthClaimProduced !== false ||
      retest.interpretation !== "single_task_evidence_only_no_growth_claim" ||
      !exactUtcTimestamp(retest.completedAt)
    ) return false;
    const catalog = RETEST_TASK_CATALOG[retest.skill];
    const evidenceKeys = retest.skill === "Reading"
      ? ["responseType", "resultType", "selectedAnswer"]
      : retest.skill === "Listening"
        ? ["audioCompleted", "audioPlayed", "playCount", "playbackFailed", "responseType", "resultType", "seekDetected", "selectedAnswer", "transcriptUsed"]
        : retest.skill === "Writing"
          ? ["responseType", "resultType", "selfChecksComplete", "wordCount"]
          : ["audioRecorded", "responseType", "resultType", "selfChecksComplete"];
    const derived = deriveRetestOutcome(retest.skill, retest.evidence);
    return Boolean(
      catalog &&
      exactObjectKeys(retest.evidence, evidenceKeys) &&
      retest.parallelTaskId === catalog.taskId &&
      retest.taskVersion === catalog.taskVersion &&
      retest.parallelFormPairId === catalog.parallelFormPairId &&
      retest.comparability.targetSkill === retest.skill &&
      retest.comparability.sameSkill === true &&
      retest.comparability.sameAsDiagnosticPriority === true &&
      retest.comparability.sameAsPlanTask === true &&
      retest.comparability.sameAsPracticeReceipt === true &&
      retest.comparability.newOriginalPrompt === true &&
      retest.comparability.constructAlignment === catalog.constructAlignment &&
      retest.comparability.teacherReviewed === false &&
      retest.comparability.measurementReviewed === false &&
      retest.comparability.officialEquivalenceClaimed === false &&
      retest.comparability.comparisonBoundary === "same_skill_only_no_calibrated_construct_or_difficulty_equivalence" &&
      derived &&
      retest.evidence.resultType === derived.resultType &&
      retest.evidenceStatus === derived.evidenceStatus &&
      retest.evidenceSufficiency === derived.evidenceSufficiency &&
      retest.humanConfirmationStatus === derived.humanConfirmationStatus
    );
  };

  const validWorkspaceBackupPlanUpdate = (planUpdate) => Boolean(
    exactObjectKeys(planUpdate, WORKSPACE_BACKUP_PLAN_UPDATE_KEYS) &&
    [planUpdate.cycleId, planUpdate.updatedPlanId, planUpdate.supersedesPlanId, planUpdate.retestId].every(historyIdValid) &&
    VALID_SKILLS.has(planUpdate.focusSkill) &&
    planUpdate.learnerConfirmed === true &&
    planUpdate.automatedAbilityDecision === false &&
    (
      (planUpdate.confirmationClass === "learner_confirmed_gate_a" && planUpdate.humanConfirmationStatus === "not_required_for_gate_a_flow") ||
      (planUpdate.confirmationClass === "provisional_pending_human_review" && planUpdate.humanConfirmationStatus === "required_not_completed")
    ) &&
    exactUtcTimestamp(planUpdate.createdAt)
  );

  const validWorkspaceBackupDomainObjects = (candidateState) => {
    const current = candidateState.journey;
    if (current.diagnostic !== null && !validWorkspaceBackupDiagnostic(current.diagnostic)) return false;
    if (current.recommendation !== null && !validWorkspaceBackupRecommendation(current.recommendation)) return false;
    if (current.review !== null && !validWorkspaceBackupReview(current.review)) return false;
    if (current.peerHelp !== null && !validWorkspaceBackupPeerHelp(current.peerHelp)) return false;
    if (current.retest !== null && !validWorkspaceBackupRetest(current.retest)) return false;
    if (current.planUpdate !== null && !validWorkspaceBackupPlanUpdate(current.planUpdate)) return false;
    return current.history.every((record) =>
      exactObjectKeys(record, cycleHistoryTopLevelKeys) &&
      validWorkspaceBackupDiagnostic(record.diagnostic) &&
      validWorkspaceBackupRecommendation(record.recommendation) &&
      validWorkspaceBackupReview(record.review) &&
      validWorkspaceBackupPeerHelp(record.peerHelp) &&
      validWorkspaceBackupRetest(record.retest) &&
      validWorkspaceBackupPlanUpdate(record.planUpdate)
    );
  };

  const validWorkspaceBackupPlanGraph = (candidateState) => {
    const plans = [candidateState.plan, ...candidateState.planHistory].filter((plan) => plan !== null);
    const planIds = plans.map((plan) => plan?.planId);
    if (
      planIds.some((planId) => !historyIdValid(planId)) ||
      new Set(planIds).size !== planIds.length ||
      (candidateState.plan !== null && candidateState.plan?.status !== "active") ||
      candidateState.planHistory.some((plan) => plan?.status !== "superseded")
    ) return false;
    const allTaskIds = [];
    for (const plan of plans) {
      const provenance = plan?.provenance;
      const standalone = provenance?.source === "learner_configured_standalone";
      const diagnosticBound = provenance?.source === "learner_configured_after_gate_a_evidence_diagnostic";
      const retestFollowup = [
        "learner_confirmed_parallel_retest_followup",
        "learner_selected_provisional_followup_pending_human_review",
      ].includes(provenance?.source);
      const provenanceKeys = standalone
        ? ["source"]
        : diagnosticBound
          ? ["cycleId", "diagnosticSessionId", "priorityBasis", "source", "taskSetDigest", "taskSetVersion"]
          : retestFollowup
            ? ["cycleId", "diagnosticSessionId", "retestId", "source", "supersedesPlanId", "taskSetDigest", "taskSetVersion"]
            : [];
      if (!provenanceKeys.length || !exactObjectKeys(provenance, provenanceKeys)) return false;
      const hasTopLevelDiagnostic = Object.hasOwn(plan, "diagnosticSessionId");
      if (
        (standalone && (!hasTopLevelDiagnostic || plan.diagnosticSessionId !== null)) ||
        (diagnosticBound && (!hasTopLevelDiagnostic || plan.diagnosticSessionId !== provenance.diagnosticSessionId)) ||
        (retestFollowup && hasTopLevelDiagnostic)
      ) return false;
      let cycleOwner = null;
      let ownerDiagnostic = null;
      if (!standalone) {
        if (
          !historyIdValid(provenance.cycleId) || !historyIdValid(provenance.diagnosticSessionId) ||
          provenance.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
          provenance.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST
        ) return false;
        cycleOwner = workspaceBackupCycleDomainOwner(candidateState, provenance.cycleId);
        if (!cycleOwner || cycleOwner.cycle.diagnosticSessionId !== provenance.diagnosticSessionId) return false;
        ownerDiagnostic = cycleOwner.kind === "active"
          ? candidateState.journey.diagnostic
          : cycleOwner.kind === "history"
            ? cycleOwner.history?.diagnostic
            : cycleOwner.summary;
        if (
          ownerDiagnostic?.diagnosticSessionId !== provenance.diagnosticSessionId ||
          ownerDiagnostic?.taskSetVersion !== provenance.taskSetVersion ||
          ownerDiagnostic?.taskSetDigest !== provenance.taskSetDigest
        ) return false;
      }
      if (diagnosticBound && (
        (ownerDiagnostic?.diagnosticStatus || ownerDiagnostic?.status) !== "completed" ||
        provenance.priorityBasis !== (ownerDiagnostic?.priorityBasis || null) ||
        !(provenance.priorityBasis === null || Object.hasOwn(priorityBasisLabels, provenance.priorityBasis)) ||
        (exactUtcTimestamp(ownerDiagnostic?.completedAt) && Date.parse(plan.createdAt) < Date.parse(ownerDiagnostic.completedAt)) ||
        (cycleOwner.summary && Date.parse(plan.createdAt) > Date.parse(cycleOwner.summary.supersededAt))
      )) return false;
      if (retestFollowup && (
        cycleOwner.kind === "superseded" ||
        !["completed", "provisional_pending_human_review"].includes(cycleOwner.cycle.status) ||
        !historyIdValid(provenance.retestId) || !historyIdValid(provenance.supersedesPlanId) ||
        cycleOwner.cycle.retestId !== provenance.retestId ||
        cycleOwner.cycle.basePlanId !== provenance.supersedesPlanId ||
        cycleOwner.cycle.updatedPlanId !== plan.planId ||
        plan.createdAt !== (cycleOwner.cycle.status === "completed" ? cycleOwner.cycle.closedAt : cycleOwner.cycle.provisionalAt) ||
        provenance.source !== (cycleOwner.cycle.status === "completed"
          ? "learner_confirmed_parallel_retest_followup"
          : "learner_selected_provisional_followup_pending_human_review")
      )) return false;
      const commonPlanKeys = [
        "createdAt", "dailyMinutes", "days", "endDate", "examDate", "focusSkill", "nickname", "planId",
        "provenance", "startDate", "status", ...(hasTopLevelDiagnostic ? ["diagnosticSessionId"] : []),
      ];
      let retirementKeys = [];
      if (plan.status === "superseded") {
        const retestRetirement = Object.hasOwn(plan, "supersededByRetestId");
        retirementKeys = retestRetirement
          ? ["supersededAt", "supersededByRetestId"]
          : ["supersededAt", "supersededReason"];
        if (
          !exactUtcTimestamp(plan.supersededAt) || Date.parse(plan.supersededAt) < Date.parse(plan.createdAt) ||
          (retestRetirement
            ? !diagnosticBound || !historyIdValid(plan.supersededByRetestId) ||
              cycleOwner?.cycle.retestId !== plan.supersededByRetestId ||
              plan.supersededAt !== (cycleOwner.cycle.status === "completed" ? cycleOwner.cycle.closedAt : cycleOwner.cycle.provisionalAt)
            : !["learner_manual_regeneration", "learner_started_new_gate_a_evidence_pack", "learner_restarted_gate_a_evidence_pack"]
              .includes(plan.supersededReason) ||
              (["learner_started_new_gate_a_evidence_pack", "learner_restarted_gate_a_evidence_pack"].includes(plan.supersededReason) &&
                cycleOwner?.summary && Date.parse(plan.supersededAt) < Date.parse(cycleOwner.summary.supersededAt)))
        ) return false;
      }
      if (
        !exactObjectKeys(plan, [...commonPlanKeys, ...retirementKeys]) ||
        !hasValidPlanShape(plan) ||
        !exactUtcTimestamp(plan.createdAt) ||
        ![15, 30, 45, 60].includes(plan.dailyMinutes) ||
        !VALID_SKILLS.has(plan.focusSkill) ||
        typeof plan.nickname !== "string" ||
        plan.nickname !== plan.nickname.trim() ||
        plan.nickname.length > 20 ||
        typeof plan.examDate !== "string" ||
        (plan.examDate !== "" && !workspaceBackupCalendarDateValid(plan.examDate)) ||
        plan.days.length !== 7 ||
        !workspaceBackupCalendarDateValid(plan.startDate) ||
        !workspaceBackupCalendarDateValid(plan.endDate) ||
        plan.startDate !== plan.days[0]?.date ||
        plan.endDate !== plan.days[6]?.date
      ) return false;
      const expectedSequence = sequences[plan.focusSkill] || sequences.Balanced;
      for (let index = 0; index < plan.days.length; index += 1) {
        const day = plan.days[index];
        const expectedDate = new Date(`${plan.startDate}T12:00:00Z`);
        expectedDate.setUTCDate(expectedDate.getUTCDate() + index);
        const expectedDateString = expectedDate.toISOString().slice(0, 10);
        if (
          day.date !== expectedDateString ||
          day.coreSkill !== expectedSequence[index] ||
          day.tasks.length !== 3 ||
          day.tasks.reduce((sum, task) => sum + Number(task.durationMinutes), 0) !== plan.dailyMinutes
        ) return false;
        const [warmup, core, reflection] = day.tasks;
        const catalog = practiceCatalogForSkill(day.coreSkill);
        if (
          !exactObjectKeys(day, ["coreSkill", "date", "tasks"]) ||
          !exactObjectKeys(warmup, WORKSPACE_BACKUP_PLAN_TASK_KEYS.filter((key) => key !== "contentRef")) ||
          !exactObjectKeys(core, WORKSPACE_BACKUP_PLAN_TASK_KEYS) ||
          !exactObjectKeys(reflection, WORKSPACE_BACKUP_PLAN_TASK_KEYS.filter((key) => key !== "contentRef")) ||
          warmup.taskId !== `${plan.planId}-${day.date}-warmup` ||
          warmup.date !== day.date ||
          warmup.skill !== "General" ||
          warmup.route !== "/practice" ||
          warmup.titleZh !== "英文热身" ||
          warmup.instructionZh !== "快速浏览今天的英文提示与关键词，明确任务要求。" ||
          core.taskId !== `${plan.planId}-${day.date}-${day.coreSkill.toLowerCase()}` ||
          core.date !== day.date ||
          core.skill !== day.coreSkill ||
          core.route !== skillRoutes[day.coreSkill] ||
          core.titleZh !== skillTasks[day.coreSkill]?.[0] ||
          core.instructionZh !== skillTasks[day.coreSkill]?.[1] ||
          reflection.taskId !== `${plan.planId}-${day.date}-reflection` ||
          reflection.date !== day.date ||
          reflection.skill !== "Reflection" ||
          reflection.route !== "/check-in" ||
          reflection.titleZh !== "记录学习证据" ||
          reflection.instructionZh !== "写下今天完成了什么、哪里困难，以及明天先做什么。" ||
          ![warmup, core, reflection].every((task) =>
            historyIdValid(task.taskId) &&
            typeof task.titleZh === "string" &&
            typeof task.instructionZh === "string" &&
            Number.isInteger(task.durationMinutes) &&
            task.durationMinutes > 0
          ) ||
          !catalog ||
          !isRecord(core.contentRef) ||
          !exactObjectKeys(core.contentRef, WORKSPACE_BACKUP_CONTENT_REF_KEYS) ||
          Object.hasOwn(warmup, "contentRef") ||
          Object.hasOwn(reflection, "contentRef") ||
          core.contentRef.exerciseId !== catalog.exerciseId ||
          core.contentRef.contentId !== catalog.contentId ||
          core.contentRef.contentVersion !== catalog.activityVersion ||
          core.contentRef.contentHash !== catalog.contentHash
        ) return false;
        allTaskIds.push(warmup.taskId, core.taskId, reflection.taskId);
      }
    }
    return new Set(allTaskIds).size === allTaskIds.length;
  };

  const validWorkspaceBackupReceiptDomainScope = (candidateState, receipt, catalog) => {
    if (receipt.planId === null) return true;
    const plan = planById(receipt.planId, candidateState);
    const task = planTaskById(plan, receipt.taskId);
    if (
      !plan ||
      !task ||
      task.date !== receipt.taskDate ||
      task.skill !== receipt.skill ||
      task.route !== receipt.route ||
      !isRecord(task.contentRef) ||
      task.contentRef.exerciseId !== receipt.exerciseId ||
      task.contentRef.contentId !== catalog.contentId ||
      task.contentRef.contentVersion !== catalog.activityVersion ||
      task.contentRef.contentHash !== catalog.contentHash
    ) return false;
    if (receipt.cycleId === null) return true;
    const cycleOwner = workspaceBackupCycleDomainOwner(candidateState, receipt.cycleId);
    if (
      !cycleOwner ||
      cycleOwner.cycle.diagnosticSessionId !== receipt.diagnosticSessionId ||
      plan.provenance?.cycleId !== receipt.cycleId ||
      plan.provenance?.diagnosticSessionId !== receipt.diagnosticSessionId
    ) return false;
    return cycleOwner.kind === "superseded" || Boolean(
      cycleOwner.cycle.basePlanId === receipt.planId &&
      cycleOwner.cycle.recommendationId === receipt.recommendationId
    );
  };
  const validWorkspaceBackupReceiptGraph = (candidateState) => {
    const attemptIds = new Set();
    for (const [receiptId, receipt] of Object.entries(candidateState.practiceReceipts)) {
      const catalog = PRACTICE_ACTIVITY_CATALOG[receipt?.exerciseId];
      const evidenceKeys = catalog?.receiptEvidenceClass === "objective_response"
        ? ["attemptCount", "finalResponse", "firstResponse", "resultType"]
        : catalog?.receiptEvidenceClass === "audio_objective_response"
          ? ["attemptCount", "audioCompleted", "audioPlayed", "finalResponse", "firstResponse", "playCount", "playbackFailed", "resultType", "seekDetected", "transcriptUsed"]
          : catalog?.receiptEvidenceClass === "self_reviewed_artifact"
            ? ["artifactHash", "resultType", "selfCheckCount", "selfChecks", "wordCount"]
            : catalog?.receiptEvidenceClass === "timed_self_report"
              ? ["audioRecorded", "prepSeconds", "responseSeconds", "resultType", "selfCheckCount", "selfChecks", "timerCompleted"]
              : [];
      if (
        !exactObjectKeys(receipt, WORKSPACE_BACKUP_RECEIPT_KEYS) ||
        !exactObjectKeys(receipt?.contentRef, WORKSPACE_BACKUP_CONTENT_REF_KEYS) ||
        !(receipt.taskRef === null || exactObjectKeys(receipt.taskRef, WORKSPACE_BACKUP_TASK_REF_KEYS)) ||
        !exactObjectKeys(receipt?.evidence, evidenceKeys) ||
        (receipt.evidence?.selfChecks !== undefined && !onlyAllowedObjectKeys(receipt.evidence.selfChecks, ["answer", "edit", "example", "flow", "idea", "reason"])) ||
        receipt?.protocolVersion !== PRACTICE_RECEIPT_VERSION ||
        !hasValidPracticeReceiptShape(receipt, receiptId) ||
        receipt.completionSource !== "guided_practice" ||
        receipt.evidenceClass !== "practice_receipt" ||
        receipt.automatedScoreProduced !== false ||
        receipt.formalDiagnosisProduced !== false ||
        receipt.officialEquivalenceClaimed !== false ||
        !exactUtcTimestamp(receipt.completedAt) ||
        attemptIds.has(receipt.practiceAttemptId) ||
        !validWorkspaceBackupReceiptDomainScope(candidateState, receipt, catalog)
      ) return false;
      attemptIds.add(receipt.practiceAttemptId);
    }
    for (const [taskId, progress] of Object.entries(candidateState.taskProgress)) {
      if (progress?.completionClass !== "practice_receipt") continue;
      const receipt = candidateState.practiceReceipts[progress.practiceReceiptId];
      if (!receipt || receipt.taskId !== taskId) return false;
    }
    for (const [exerciseId, practice] of Object.entries(candidateState.practice)) {
      if (!Object.hasOwn(PRACTICE_ACTIVITY_CATALOG, exerciseId) || !isRecord(practice)) return false;
      if (practice.latestPracticeReceiptId) {
        const receipt = candidateState.practiceReceipts[practice.latestPracticeReceiptId];
        if (!receipt || receipt.exerciseId !== exerciseId) return false;
      }
    }
    return true;
  };

  const workspaceBackupDiagnosticEvidenceSummary = (item) => ({
    taskId: item.taskId,
    taskVersion: item.taskVersion,
    contentHash: item.contentHash,
    skill: item.skill,
    status: item.status,
    evidenceStatus: item.evidenceStatus,
    qualityFlags: Array.isArray(item.qualityFlags) ? [...item.qualityFlags] : [],
    ...(Number.isFinite(Number(item.durationSeconds)) ? { durationSeconds: Number(item.durationSeconds) } : {}),
    ...(Number.isFinite(Number(item.wordCount)) ? { wordCount: Number(item.wordCount) } : {}),
    ...(Number.isFinite(Number(item.selfReviewCount)) ? { selfReviewCount: Number(item.selfReviewCount) } : {}),
    ...(typeof item.resultType === "string" ? { resultType: item.resultType } : {}),
  });
  const WORKSPACE_BACKUP_SUPERSEDED_BASE_KEYS = Object.freeze(
    WORKSPACE_BACKUP_SUPERSEDED_KEYS.filter((key) => !["evidenceSufficiency", "priorityBasis", "prioritySkill"].includes(key)),
  );
  const WORKSPACE_BACKUP_SUPERSEDED_EVIDENCE_BASE_KEYS = Object.freeze([
    "contentHash", "evidenceStatus", "qualityFlags", "skill", "status", "taskId", "taskVersion",
  ]);
  const workspaceBackupSupersededFlagSetValid = (evidence, expected) => {
    const allowed = new Set();
    if (["Speaking", "Writing"].includes(expected.skill)) allowed.add("resumed_after_reload");
    if (expected.skill === "Listening") {
      ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "audio_output_unavailable", "transcript_used", "multiple_replays"]
        .forEach((flag) => allowed.add(flag));
      if (evidence.taskId === "diagnostic-listening-language-lab-v1") {
        ["browser_voice_variability", "voice_fallback_used", "voice_not_loaded", "speech_synthesis_error"]
          .forEach((flag) => allowed.add(flag));
      }
      if (
        evidence.status !== "completed" &&
        ["audio_not_played", "audio_not_completed", "audio_output_unavailable", "multiple_replays"]
          .some((flag) => evidence.qualityFlags.includes(flag))
      ) return false;
      if ((evidence.qualityFlags.includes("speech_synthesis_error") && !evidence.qualityFlags.includes("audio_playback_failed")) ||
          (evidence.taskId === "diagnostic-listening-language-lab-v1" && evidence.qualityFlags.includes("audio_playback_failed") && !evidence.qualityFlags.includes("speech_synthesis_error")) ||
          (evidence.qualityFlags.includes("voice_not_loaded") && !evidence.qualityFlags.includes("voice_fallback_used")) ||
          (evidence.qualityFlags.includes("voice_fallback_used") && !evidence.qualityFlags.includes("browser_voice_variability")) ||
          (evidence.status === "completed" && evidence.taskId === "diagnostic-listening-language-lab-v1" && !evidence.qualityFlags.includes("browser_voice_variability"))) return false;
      if (evidence.status === "completed") {
        if (evidence.qualityFlags.includes("audio_not_played") && evidence.qualityFlags.includes("audio_not_completed")) return false;
        const insufficient = ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "audio_output_unavailable", "transcript_used"]
          .some((flag) => evidence.qualityFlags.includes(flag));
        if (evidence.evidenceStatus !== (insufficient ? "evidence_insufficient" : "evidence_limited")) return false;
      }
    }
    if (expected.skill === "Writing") allowed.add("writing_paste_detected");
    if (expected.skill === "Speaking" && Object.hasOwn(evidence, "durationSeconds")) {
      allowed.add("speaking_ended_early");
      if ((evidence.durationSeconds < 90) !== evidence.qualityFlags.includes("speaking_ended_early")) return false;
    }
    if (expected.skill === "Writing" && Object.hasOwn(evidence, "durationSeconds")) {
      allowed.add("writing_ended_early");
      if ((evidence.durationSeconds < 180) !== evidence.qualityFlags.includes("writing_ended_early")) return false;
    }
    const required = [];
    if (evidence.status === "skipped") required.push("learner_skipped");
    if (evidence.status === "unavailable") required.push("task_unavailable");
    if (evidence.status === "completed" && expected.skill === "Speaking") {
      required.push("audio_not_recorded", "open_response_not_human_reviewed");
      allowed.add("audio_not_recorded");
      allowed.add("open_response_not_human_reviewed");
      allowed.add("speaking_ended_early");
      allowed.add("self_review_incomplete");
      if ((evidence.selfReviewCount < 3) !== evidence.qualityFlags.includes("self_review_incomplete")) return false;
    }
    if (["completed", "evidence_insufficient"].includes(evidence.status) && expected.skill === "Writing") {
      required.push("open_response_not_human_reviewed");
      ["open_response_not_human_reviewed", "writing_below_completion_condition", "writing_ended_early", "self_review_incomplete"]
        .forEach((flag) => allowed.add(flag));
      if ((evidence.wordCount < 20) !== evidence.qualityFlags.includes("writing_below_completion_condition")) return false;
      if ((evidence.selfReviewCount < 3) !== evidence.qualityFlags.includes("self_review_incomplete")) return false;
    }
    if (["skipped", "unavailable"].includes(evidence.status)) {
      allowed.add(evidence.status === "skipped" ? "learner_skipped" : "task_unavailable");
      if (expected.skill === "Speaking") allowed.add("speaking_ended_early");
      if (expected.skill === "Writing") allowed.add("writing_ended_early");
    }
    const oppositeTerminalFlag = evidence.status === "skipped"
      ? "task_unavailable"
      : evidence.status === "unavailable"
        ? "learner_skipped"
        : null;
    return Boolean(
      Array.isArray(evidence.qualityFlags) &&
      new Set(evidence.qualityFlags).size === evidence.qualityFlags.length &&
      evidence.qualityFlags.every((flag) => allowed.has(flag)) &&
      required.every((flag) => evidence.qualityFlags.includes(flag)) &&
      (!oppositeTerminalFlag || !evidence.qualityFlags.includes(oppositeTerminalFlag))
    );
  };
  const validWorkspaceBackupSupersededEvidence = (evidence) => {
    const expected = DIAGNOSTIC_TASK_MANIFEST[evidence?.taskId];
    if (!expected) return false;
    let optionalKeys = [];
    if (["Reading", "Listening"].includes(expected.skill)) {
      if (evidence.status === "completed") optionalKeys = ["durationSeconds", "resultType"];
      else if (!["in_progress", "skipped", ...(expected.skill === "Listening" ? ["unavailable"] : [])].includes(evidence.status)) return false;
    } else if (expected.skill === "Speaking") {
      if (evidence.status === "completed") optionalKeys = ["durationSeconds", "selfReviewCount"];
      else if (["in_progress", "skipped"].includes(evidence.status)) {
        optionalKeys = Object.hasOwn(evidence, "durationSeconds") ? ["durationSeconds"] : [];
      } else return false;
    } else if (expected.skill === "Writing") {
      if (["completed", "evidence_insufficient"].includes(evidence.status)) {
        optionalKeys = ["durationSeconds", "selfReviewCount", "wordCount"];
      } else if (["in_progress", "skipped"].includes(evidence.status)) {
        optionalKeys = ["durationSeconds", "wordCount"].filter((key) => Object.hasOwn(evidence, key));
      } else return false;
    }
    if (
      !exactObjectKeys(evidence, [...WORKSPACE_BACKUP_SUPERSEDED_EVIDENCE_BASE_KEYS, ...optionalKeys]) ||
      evidence.taskVersion !== expected.taskVersion || evidence.contentHash !== expected.contentHash || evidence.skill !== expected.skill ||
      !DIAGNOSTIC_EVIDENCE_STATES.has(evidence.evidenceStatus) ||
      !workspaceBackupSupersededFlagSetValid(evidence, expected)
    ) return false;
    if (
      (evidence.status === "in_progress" && evidence.evidenceStatus !== "evidence_limited") ||
      (["skipped", "unavailable"].includes(evidence.status) && evidence.evidenceStatus !== "evidence_insufficient")
    ) return false;
    for (const [field, max] of [["durationSeconds", expected.skill === "Speaking" ? 90 : expected.skill === "Writing" ? 180 : Number.MAX_SAFE_INTEGER], ["wordCount", 900], ["selfReviewCount", 3]]) {
      if (Object.hasOwn(evidence, field) && (!Number.isInteger(evidence[field]) || evidence[field] < 0 || evidence[field] > max)) return false;
    }
    if (["Reading", "Listening"].includes(expected.skill)) {
      if (evidence.status === "completed") {
        if (!["first_response_matched", "first_response_not_matched"].includes(evidence.resultType)) return false;
        if (expected.skill === "Reading" && evidence.evidenceStatus !== "evidence_limited") return false;
      } else if (evidence.evidenceStatus !== (evidence.status === "in_progress" ? "evidence_limited" : "evidence_insufficient")) return false;
    }
    if (expected.skill === "Speaking" && evidence.status === "completed" && evidence.evidenceStatus !== "evidence_insufficient") return false;
    if (expected.skill === "Writing" && ["completed", "evidence_insufficient"].includes(evidence.status)) {
      if (evidence.evidenceStatus !== "evidence_insufficient" || evidence.status !== (evidence.wordCount >= 20 ? "completed" : "evidence_insufficient")) return false;
    }
    return true;
  };
  const validWorkspaceBackupSupersededCycles = (candidateState) => {
    const summaries = candidateState.journey.supersededCycles;
    if (summaries.length > SUPERSEDED_CYCLE_LIMIT) return false;
    const ids = [];
    for (const summary of summaries) {
      const completed = summary?.diagnosticStatus === "completed";
      if (
        !exactObjectKeys(summary, completed
          ? [...WORKSPACE_BACKUP_SUPERSEDED_BASE_KEYS, "evidenceSufficiency", "priorityBasis", "prioritySkill"]
          : WORKSPACE_BACKUP_SUPERSEDED_BASE_KEYS) ||
        !historyIdValid(summary.cycleId) ||
        !historyIdValid(summary.diagnosticSessionId) ||
        summary.protocolVersion !== PROTOCOL_VERSION ||
        summary.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
        summary.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
        summary.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
        !["in_progress", "awaiting_confirmation", "completed"].includes(summary.diagnosticStatus) ||
        summary.status !== "superseded_by_new_diagnostic" ||
        summary.reason !== "learner_started_new_gate_a_evidence_pack" ||
        !exactUtcTimestamp(summary.supersededAt) ||
        !Array.isArray(summary.taskEvidenceSummary) ||
        summary.taskEvidenceSummary.length > DIAGNOSTIC_TASK_IDS.length ||
        !summary.taskEvidenceSummary.every((item, index) => item?.taskId === DIAGNOSTIC_TASK_IDS[index]) ||
        !summary.taskEvidenceSummary.every(validWorkspaceBackupSupersededEvidence) ||
        (completed && (!VALID_SKILLS.has(summary.prioritySkill) || summary.prioritySkill === "Balanced" ||
          !Object.hasOwn(priorityBasisLabels, summary.priorityBasis) || !DIAGNOSTIC_EVIDENCE_STATES.has(summary.evidenceSufficiency)))
      ) return false;
      const statuses = summary.taskEvidenceSummary.map((evidence) => evidence.status);
      const firstNonTerminal = statuses.findIndex((status) => !DIAGNOSTIC_TERMINAL_STATES.has(status));
      const terminalCount = firstNonTerminal < 0 ? statuses.length : firstNonTerminal;
      if (
        (firstNonTerminal >= 0 && (firstNonTerminal !== statuses.length - 1 || statuses[firstNonTerminal] !== "in_progress")) ||
        (summary.diagnosticStatus === "in_progress" && terminalCount === DIAGNOSTIC_TASK_IDS.length) ||
        (summary.diagnosticStatus !== "in_progress" && (terminalCount !== DIAGNOSTIC_TASK_IDS.length || statuses.length !== DIAGNOSTIC_TASK_IDS.length))
      ) return false;
      if (completed) {
        const pseudoDiagnostic = {
          taskEvidence: summary.taskEvidenceSummary.map((evidence) => ({
            ...DIAGNOSTIC_TASK_MANIFEST[evidence.taskId],
            ...evidence,
            ...(evidence.skill === "Speaking" ? { timerCompleted: evidence.durationSeconds === 90 } : {}),
            ...(evidence.skill === "Writing" ? { timerCompleted: evidence.durationSeconds === 180 } : {}),
          })),
        };
        const report = buildDiagnosticReport(pseudoDiagnostic);
        if (
          summary.priorityBasis !== report.priorityBasis || summary.evidenceSufficiency !== report.evidenceSufficiency ||
          !report.priorityCandidates.includes(summary.prioritySkill)
        ) return false;
      }
      ids.push(summary.cycleId);
    }
    return new Set(ids).size === ids.length;
  };

  const validWorkspaceBackupCheckInRecord = (record, candidateState, { archived = false, embedded = false } = {}) => {
    const expectedKeys = archived
      ? [...WORKSPACE_BACKUP_SAVED_CHECK_IN_KEYS, "archivedAt", "archivedReason"]
      : WORKSPACE_BACKUP_SAVED_CHECK_IN_KEYS;
    if (record?.status === "saved" && !exactObjectKeys(record, expectedKeys)) return false;
    if (record?.status === "draft") {
      const freshDraft = exactObjectKeys(record, WORKSPACE_BACKUP_DRAFT_CHECK_IN_KEYS);
      const revisedSavedDraft = exactObjectKeys(record, WORKSPACE_BACKUP_SAVED_CHECK_IN_KEYS);
      if (archived || embedded || (!freshDraft && !revisedSavedDraft)) return false;
      if (
        record.checkInId !== null || record.evidenceClass !== "draft_unclassified" ||
        record.practiceAttemptId !== null || record.practiceReceipt !== null || record.taskCompletionReceiptId !== null ||
        record.learnerConfirmedReview !== false || record.reviewId !== null || record.reviewedAt !== null
      ) return false;
      if (revisedSavedDraft && (
        !(record.cycleId === null || historyIdValid(record.cycleId)) ||
        !(record.planId === null || historyIdValid(record.planId)) ||
        !(record.diagnosticSessionId === null || historyIdValid(record.diagnosticSessionId)) ||
        !(record.recommendationId === null || historyIdValid(record.recommendationId)) ||
        (record.cycleId === null) !== (record.diagnosticSessionId === null) ||
        (record.cycleId === null) !== (record.recommendationId === null) ||
        record.visibility !== "local_only" || record.anomalyReviewStatus !== "not_flagged" ||
        !exactUtcTimestamp(record.savedAt) || Date.parse(record.savedAt) > Date.parse(record.updatedAt)
      )) return false;
    } else if (record?.status !== "saved") {
      return false;
    }
    if (
      !workspaceBackupCalendarDateValid(record.date) ||
      typeof record.didText !== "string" || typeof record.evidenceText !== "string" ||
      record.didText !== record.didText.trim() || record.didText.length > 300 ||
      record.evidenceText !== record.evidenceText.trim() || record.evidenceText.length > 500 ||
      !["none", "has_question", ""].includes(record.questionStatus) ||
      typeof record.questionText !== "string" || record.questionText !== record.questionText.trim() ||
      record.questionText.length > 300 ||
      !(record.linkedTaskId === "" || historyIdValid(record.linkedTaskId)) ||
      !exactUtcTimestamp(record.updatedAt)
    ) return false;
    if (record.status === "saved") {
      const reviews = [candidateState.journey.review, ...candidateState.journey.history.map((history) => history?.review)]
        .filter((review) => isRecord(review) && review.checkInId === record.checkInId);
      const confirmationRecords = reviews.filter((review) => review.reviewId === record.reviewId);
      const confirmationCanonical = new Set(confirmationRecords.map((review) => workspaceBackupRuntime.canonicalJson(review)));
      const confirmed = record.learnerConfirmedReview === true;
      if (
        !historyIdValid(record.checkInId) ||
        record.didText.length < 10 ||
        record.evidenceText.length < 10 ||
        !["none", "has_question"].includes(record.questionStatus) ||
        (record.questionStatus === "none" && record.questionText !== "") ||
        (record.questionStatus === "has_question" && record.questionText.length === 0) ||
        !exactUtcTimestamp(record.savedAt) ||
        Date.parse(record.savedAt) > Date.parse(record.updatedAt) ||
        record.visibility !== "local_only" ||
        record.anomalyReviewStatus !== "not_flagged" ||
        !(record.planId === null || historyIdValid(record.planId)) ||
        !(record.cycleId === null || historyIdValid(record.cycleId)) ||
        !(record.diagnosticSessionId === null || historyIdValid(record.diagnosticSessionId)) ||
        !(record.recommendationId === null || historyIdValid(record.recommendationId)) ||
        (record.cycleId === null) !== (record.diagnosticSessionId === null) ||
        (record.cycleId === null) !== (record.recommendationId === null) ||
        typeof record.learnerConfirmedReview !== "boolean" ||
        (confirmed
          ? !historyIdValid(record.reviewId) || !exactUtcTimestamp(record.reviewedAt) || record.updatedAt !== record.reviewedAt ||
            ((!archived || confirmationRecords.length > 0) && (
              confirmationRecords.length === 0 || confirmationCanonical.size !== 1 ||
              confirmationRecords.some((review) =>
                review.cycleId !== record.cycleId || review.confirmedAt !== record.reviewedAt || review.learnerConfirmed !== true
              )
            ))
          : record.reviewId !== null || record.reviewedAt !== null || reviews.length > 0) ||
        !["practice_receipt", "learner_self_report"].includes(record.evidenceClass)
      ) return false;
      if (record.evidenceClass === "practice_receipt") {
        const stored = candidateState.practiceReceipts[record.taskCompletionReceiptId];
        if (
          !stored ||
          workspaceBackupRuntime.canonicalJson(stored) !== workspaceBackupRuntime.canonicalJson(record.practiceReceipt) ||
          record.practiceAttemptId !== stored.practiceAttemptId ||
          record.linkedTaskId !== stored.taskId ||
          record.planId !== stored.planId ||
          record.cycleId !== stored.cycleId ||
          record.diagnosticSessionId !== stored.diagnosticSessionId ||
          record.recommendationId !== stored.recommendationId
        ) return false;
      } else if (
        record.practiceReceipt !== null || record.practiceAttemptId !== null || record.taskCompletionReceiptId !== null
      ) return false;
    }
    if (archived) {
      if (
        !exactUtcTimestamp(record.archivedAt) ||
        Date.parse(record.archivedAt) < Date.parse(record.updatedAt) ||
        !["learner_revision_after_confirmation", "learner_revision_after_save", "scope_changed"].includes(record.archivedReason) ||
        (record.archivedReason === "learner_revision_after_confirmation" && record.learnerConfirmedReview !== true) ||
        (record.archivedReason === "learner_revision_after_save" && record.learnerConfirmedReview !== false)
      ) return false;
    }
    return true;
  };

  const workspaceBackupDateKeyValid = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  };
  const workspaceBackupDefaultTaskOwner = (taskId) => {
    const match = /^default-(\d{4}-\d{2}-\d{2})-(reading|writing|reflection)$/.exec(taskId || "");
    if (!match || !workspaceBackupDateKeyValid(match[1])) return null;
    const skills = { reading: "Reading", writing: "Writing", reflection: "Reflection" };
    return { kind: "standalone", taskId, date: match[1], skill: skills[match[2]], plan: null, task: null };
  };
  const workspaceBackupTaskOwner = (candidateState, taskId) => {
    if (!historyIdValid(taskId)) return null;
    const matches = [candidateState.plan, ...candidateState.planHistory]
      .filter(isRecord)
      .flatMap((plan) => (plan.days || []).flatMap((day) => (day.tasks || [])
        .filter((task) => task?.taskId === taskId)
        .map((task) => ({ kind: "plan", taskId, date: task.date, skill: task.skill, plan, task }))));
    if (matches.length > 1) return null;
    if (matches.length === 1) return matches[0];
    return workspaceBackupDefaultTaskOwner(taskId);
  };
  const workspaceBackupExactCheckInById = (candidateState, checkInId) => {
    const matches = allCheckIns(candidateState).filter((record) => record?.checkInId === checkInId);
    return matches.length === 1 ? matches[0] : null;
  };
  const validWorkspaceBackupTaskProgress = (candidateState) => {
    for (const [taskId, progress] of Object.entries(candidateState.taskProgress)) {
      const owner = workspaceBackupTaskOwner(candidateState, taskId);
      if (!owner || !isRecord(progress)) return false;
      if (progress.completionClass === "learner_self_report" || progress.completionClass === "not_completed") {
        const completed = progress.completionClass === "learner_self_report";
        if (
          !exactObjectKeys(progress, WORKSPACE_BACKUP_PROGRESS_LEARNER_KEYS) ||
          progress.status !== (completed ? "completed" : "todo") ||
          progress.selfReported !== true ||
          progress.source !== "learner_checkbox" ||
          !exactUtcTimestamp(progress.updatedAt) ||
          (completed
            ? !exactUtcTimestamp(progress.completedAt) || Date.parse(progress.completedAt) < Date.parse(progress.updatedAt)
            : progress.completedAt !== null)
        ) return false;
        continue;
      }
      if (progress.completionClass === "practice_receipt") {
        const receipt = candidateState.practiceReceipts[progress.practiceReceiptId];
        if (
          owner.kind !== "plan" ||
          !exactObjectKeys(progress, WORKSPACE_BACKUP_PROGRESS_PRACTICE_KEYS) ||
          progress.status !== "completed" ||
          progress.selfReported !== false ||
          !receipt ||
          receipt.taskId !== taskId ||
          receipt.planId !== owner.plan.planId ||
          progress.source !== `practice-${String(receipt.skill || "").toLowerCase()}` ||
          progress.evidenceStatus !== receipt.evidenceStatus ||
          progress.receiptEvidenceClass !== receipt.receiptEvidenceClass ||
          progress.completedAt !== receipt.completedAt ||
          progress.updatedAt !== receipt.completedAt ||
          !exactUtcTimestamp(progress.completedAt)
        ) return false;
        continue;
      }
      if (progress.completionClass === "workflow_receipt") {
        const workflow = progress.workflowReceipt;
        const checkIn = workspaceBackupExactCheckInById(candidateState, workflow?.checkInId);
        const standaloneIndependentScopeMatches = Boolean(
          (checkIn?.planId === null || Boolean(planById(checkIn?.planId, candidateState))) &&
          checkIn?.cycleId === null &&
          checkIn?.diagnosticSessionId === null &&
          checkIn?.recommendationId === null
        );
        const standaloneCycleScopeMatches = Boolean(
          checkIn?.evidenceClass === "practice_receipt" &&
          isRecord(checkIn.practiceReceipt) &&
          Boolean(planById(checkIn.planId, candidateState)) &&
          checkIn.date !== checkIn.practiceReceipt.taskDate &&
          checkIn.cycleId === checkIn.practiceReceipt.cycleId &&
          checkIn.diagnosticSessionId === checkIn.practiceReceipt.diagnosticSessionId &&
          checkIn.recommendationId === checkIn.practiceReceipt.recommendationId &&
          checkIn.linkedTaskId === checkIn.practiceReceipt.taskId &&
          checkIn.taskCompletionReceiptId === checkIn.practiceReceipt.completionReceiptId
        );
        const standaloneScopeMatches = owner.kind !== "standalone" ||
          standaloneIndependentScopeMatches || standaloneCycleScopeMatches;
        if (
          !exactObjectKeys(progress, WORKSPACE_BACKUP_PROGRESS_WORKFLOW_KEYS) ||
          !exactObjectKeys(workflow, WORKSPACE_BACKUP_WORKFLOW_RECEIPT_KEYS) ||
          progress.status !== "completed" ||
          progress.selfReported !== false ||
          progress.source !== "check-in" ||
          owner.skill !== "Reflection" ||
          workflow.protocolVersion !== "sufeiya_check_in_completion_v1" ||
          workflow.taskId !== taskId ||
          !checkIn ||
          checkIn.status !== "saved" ||
          checkIn.date !== owner.date ||
          (owner.kind === "plan" ? checkIn.planId !== owner.plan.planId : !standaloneScopeMatches) ||
          workflow.completedAt !== checkIn.savedAt ||
          progress.completedAt !== workflow.completedAt ||
          progress.updatedAt !== workflow.completedAt ||
          !exactUtcTimestamp(progress.completedAt)
        ) return false;
        continue;
      }
      return false;
    }

    const receiptsByTask = new Map();
    for (const receipt of Object.values(candidateState.practiceReceipts)) {
      if (!receipt?.taskId) continue;
      const receipts = receiptsByTask.get(receipt.taskId) || [];
      receipts.push(receipt);
      receiptsByTask.set(receipt.taskId, receipts);
    }
    for (const [taskId, receipts] of receiptsByTask) {
      const progress = candidateState.taskProgress[taskId];
      const selected = progress?.completionClass === "practice_receipt"
        ? candidateState.practiceReceipts[progress.practiceReceiptId]
        : null;
      if (!selected || selected.taskId !== taskId) return false;
      const selectedAt = Date.parse(selected.completedAt);
      if (receipts.some((receipt) => Date.parse(receipt.completedAt) > selectedAt)) return false;
    }
    for (const checkIn of Object.values(candidateState.checkIns)) {
      if (checkIn?.status !== "saved") continue;
      const owners = Object.entries(candidateState.taskProgress).filter(([, progress]) =>
        progress?.completionClass === "workflow_receipt" &&
        progress.workflowReceipt?.checkInId === checkIn.checkInId
      );
      if (owners.length !== 1) return false;
      const [taskId, progress] = owners[0];
      if (
        progress.workflowReceipt.taskId !== taskId ||
        progress.workflowReceipt.completedAt !== checkIn.savedAt
      ) return false;
    }
    return true;
  };

  const workspaceBackupParsePracticeScope = (scopeKey, exerciseId) => {
    if (scopeKey === `standalone:${exerciseId}`) {
      return { kind: "standalone", planId: null, taskId: null, cycleId: null, diagnosticSessionId: null, recommendationId: null };
    }
    if (typeof scopeKey !== "string") return null;
    const parts = scopeKey.split("|");
    const prefixes = ["plan:", "task:", "cycle:", "diagnostic:", "recommendation:"];
    if (parts.length !== prefixes.length || parts.some((part, index) => !part.startsWith(prefixes[index]))) return null;
    const values = parts.map((part, index) => part.slice(prefixes[index].length));
    if (values.some((value) => !value || value.includes("|"))) return null;
    const [planId, taskId, cycleValue, diagnosticValue, recommendationValue] = values;
    const allNone = [cycleValue, diagnosticValue, recommendationValue].every((value) => value === "none");
    const allBound = [cycleValue, diagnosticValue, recommendationValue].every((value) => value !== "none" && historyIdValid(value));
    if (!historyIdValid(planId) || !historyIdValid(taskId) || (!allNone && !allBound)) return null;
    return {
      kind: allNone ? "plan" : "cycle",
      planId,
      taskId,
      cycleId: allNone ? null : cycleValue,
      diagnosticSessionId: allNone ? null : diagnosticValue,
      recommendationId: allNone ? null : recommendationValue,
    };
  };
  const workspaceBackupCycleDomainOwner = (candidateState, cycleId) => {
    const active = candidateState.journey.activeCycle?.cycleId === cycleId
      ? candidateState.journey.activeCycle
      : null;
    const histories = candidateState.journey.history.filter((record) => record?.cycleId === cycleId);
    const summaries = candidateState.journey.supersededCycles.filter((record) => record?.cycleId === cycleId);
    if (histories.length > 1 || summaries.length > 1) return null;
    if (active) return { kind: "active", cycle: active, history: histories[0] || null, summary: summaries[0] || null };
    if (histories.length === 1) return { kind: "history", cycle: histories[0], history: histories[0], summary: summaries[0] || null };
    if (summaries.length === 1) return { kind: "superseded", cycle: summaries[0], history: null, summary: summaries[0] };
    return null;
  };
  const workspaceBackupEventDomainId = (candidateState, kind, alias) => {
    if (!UUID_V4_PATTERN.test(alias || "")) return null;
    const records = candidateState.learningEventBindings?.records?.[kind];
    if (!isRecord(records)) return null;
    const matches = Object.entries(records).filter(([, candidateAlias]) => candidateAlias === alias);
    return matches.length === 1 && historyIdValid(matches[0][0]) ? matches[0][0] : null;
  };
  const workspaceBackupScopeMatchesDomain = (candidateState, scope, exerciseId) => {
    if (scope.kind === "standalone") return true;
    const owner = workspaceBackupTaskOwner(candidateState, scope.taskId);
    if (
      owner?.kind !== "plan" ||
      owner.plan.planId !== scope.planId ||
      owner.task.contentRef?.exerciseId !== exerciseId
    ) return false;
    if (scope.kind === "plan") return true;
    const cycleOwner = workspaceBackupCycleDomainOwner(candidateState, scope.cycleId);
    if (!cycleOwner) return false;
    if (cycleOwner.kind !== "superseded") {
      return Boolean(
        cycleOwner.cycle.diagnosticSessionId === scope.diagnosticSessionId &&
        cycleOwner.cycle.basePlanId === scope.planId &&
        cycleOwner.cycle.recommendationId === scope.recommendationId
      );
    }
    if (cycleOwner.summary.diagnosticSessionId !== scope.diagnosticSessionId) return false;
    const cycleAlias = candidateState.learningEventBindings?.records?.cycle?.[scope.cycleId];
    const events = candidateState.learningEvents.filter((event) => event?.context?.learningCycleId === cycleAlias);
    const recommendationEvents = events.filter((event) => event.eventType === "recommendation.decided");
    if (recommendationEvents.length !== 1) return false;
    return Boolean(
      workspaceBackupEventDomainId(candidateState, "plan", recommendationEvents[0].context.planId) === scope.planId &&
      workspaceBackupEventDomainId(candidateState, "recommendation", recommendationEvents[0].context.recommendationId) === scope.recommendationId &&
      workspaceBackupEventDomainId(candidateState, "diagnostic", recommendationEvents[0].context.diagnosticSessionId) === scope.diagnosticSessionId
    );
  };
  const workspaceBackupScopeMatchesReceipt = (scope, receipt) => {
    if (scope.kind === "standalone") {
      return Boolean(
        receipt.taskId === null && receipt.taskRef === null && receipt.planId === null && receipt.cycleId === null &&
        receipt.diagnosticSessionId === null && receipt.recommendationId === null
      );
    }
    if (
      receipt.planId !== scope.planId ||
      receipt.taskId !== scope.taskId ||
      receipt.taskRef?.planId !== scope.planId ||
      receipt.taskRef?.taskId !== scope.taskId
    ) return false;
    if (scope.kind === "plan") {
      return Boolean(
        receipt.cycleId === null && receipt.diagnosticSessionId === null && receipt.recommendationId === null &&
        receipt.taskRef.cycleId === null && receipt.taskRef.diagnosticSessionId === null
      );
    }
    return Boolean(
      receipt.cycleId === scope.cycleId && receipt.diagnosticSessionId === scope.diagnosticSessionId &&
      receipt.recommendationId === scope.recommendationId && receipt.taskRef.cycleId === scope.cycleId &&
      receipt.taskRef.diagnosticSessionId === scope.diagnosticSessionId
    );
  };
  const workspaceBackupSelfChecksValid = (value, keys) => Boolean(
    isRecord(value) &&
    (exactObjectKeys(value, []) || (
      exactObjectKeys(value, keys) && keys.every((key) => typeof value[key] === "boolean")
    ))
  );
  const validWorkspaceBackupPracticeState = async (candidateState) => {
    for (const [exerciseId, practice] of Object.entries(candidateState.practice)) {
      const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
      if (!catalog || !isRecord(practice) || !["in_progress", "checked", "completed"].includes(practice.status)) return false;
      const compactKeys = practice.status === "completed"
        ? [...WORKSPACE_BACKUP_PRACTICE_LISTENING_COMPACT_KEYS, "completedAt"]
        : WORKSPACE_BACKUP_PRACTICE_LISTENING_COMPACT_KEYS;
      const full = exactObjectKeys(practice, WORKSPACE_BACKUP_PRACTICE_FULL_KEYS);
      const compact = exerciseId === "listening-club-v1" && exactObjectKeys(practice, compactKeys);
      if (!full && !compact) return false;
      if (
        ![null, "a", "b", "c"].includes(practice.selectedAnswer) ||
        ![null, "a", "b", "c"].includes(practice.firstResponse) ||
        !Number.isInteger(practice.attempts) || practice.attempts < 0 || practice.attempts > 1000 ||
        ![practice.audioPlayed, practice.audioCompleted, practice.audioSeekDetected, practice.audioPlaybackFailed,
          practice.audioStartedNearBeginning, practice.transcriptUsed].every((value) => typeof value === "boolean") ||
        !Number.isInteger(practice.playCount) || practice.playCount < 0 || practice.playCount > 1000 ||
        practice.freshAttemptFromLegacyReceiptId !== null ||
        !exactUtcTimestamp(practice.startedAt) || !exactUtcTimestamp(practice.updatedAt) ||
        Date.parse(practice.startedAt) > Date.parse(practice.updatedAt)
      ) return false;
      if (full && (
        typeof practice.draftText !== "string" ||
        practice.draftText.length > 4096 ||
        !Number.isInteger(practice.wordCount) || practice.wordCount < 0 || practice.wordCount > 100000 ||
        typeof practice.audioRecorded !== "boolean" ||
        typeof practice.timerCompleted !== "boolean"
      )) return false;
      if (exerciseId === "writing-community-v1") {
        if (!full || !workspaceBackupSelfChecksValid(practice.selfChecks, ["idea", "reason", "edit"]) || practice.status === "checked") return false;
      } else if (exerciseId === "speaking-skill-v1") {
        if (!full || !workspaceBackupSelfChecksValid(practice.selfChecks, ["answer", "example", "flow"])) return false;
      } else if (full && !exactObjectKeys(practice.selfChecks, [])) return false;
      if (full && exerciseId !== "writing-community-v1" && (practice.draftText !== "" || practice.wordCount !== 0)) return false;
      if (full && exerciseId !== "speaking-skill-v1" && practice.timerCompleted !== false) return false;
      if (full && practice.audioRecorded !== false) return false;
      if (exerciseId !== "listening-club-v1" && (
        practice.audioPlayed !== false || practice.audioCompleted !== false || practice.playCount !== 0 ||
        practice.audioSeekDetected !== false || practice.audioPlaybackFailed !== false ||
        practice.audioStartedNearBeginning !== false || practice.transcriptUsed !== false
      )) return false;
      if (["Reading", "Listening"].includes(catalog.skill)) {
        if (practice.status === "checked" && (
          practice.attempts < 1 ||
          !practice.selectedAnswer || practice.selectedAnswer === catalog.correctValue ||
          !practice.firstResponse || practice.firstResponse === catalog.correctValue
        )) return false;
        if (practice.status === "in_progress") {
          if (
            (practice.attempts === 0 && practice.firstResponse !== null) ||
            (practice.attempts > 0 && (!practice.firstResponse || practice.firstResponse === catalog.correctValue))
          ) return false;
        }
        if (practice.status === "completed" && (
          practice.selectedAnswer !== catalog.correctValue ||
          (practice.attempts === 1
            ? practice.firstResponse !== catalog.correctValue
            : practice.attempts < 2 || practice.firstResponse === catalog.correctValue)
        )) return false;
      } else if (practice.selectedAnswer !== null || practice.firstResponse !== null || practice.attempts !== 0) return false;
      if (catalog.skill === "Listening" && practice.audioCompleted === true && (
        practice.audioPlayed !== true ||
        practice.audioStartedNearBeginning !== true ||
        practice.audioSeekDetected !== false ||
        practice.audioPlaybackFailed !== false
      )) return false;

      const scope = workspaceBackupParsePracticeScope(practice.attemptScopeKey, exerciseId);
      if (!scope || !workspaceBackupScopeMatchesDomain(candidateState, scope, exerciseId)) return false;
      const latestReceipt = practice.latestPracticeReceiptId === null
        ? null
        : candidateState.practiceReceipts[practice.latestPracticeReceiptId];
      if (practice.latestPracticeReceiptId !== null && (!latestReceipt || latestReceipt.exerciseId !== exerciseId)) return false;
      if (latestReceipt && Object.values(candidateState.practiceReceipts).some((receipt) =>
        receipt?.exerciseId === exerciseId && Date.parse(receipt.completedAt) > Date.parse(latestReceipt.completedAt)
      )) return false;
      if (practice.status === "completed") {
        if (
          !latestReceipt ||
          !exactUtcTimestamp(practice.completedAt) ||
          practice.completedAt !== practice.updatedAt ||
          practice.completedAt !== latestReceipt.completedAt ||
          practice.startedAt !== latestReceipt.startedAt ||
          !workspaceBackupScopeMatchesReceipt(scope, latestReceipt)
        ) return false;
        if (["Reading", "Listening"].includes(catalog.skill) && (
          practice.selectedAnswer !== latestReceipt.evidence.finalResponse ||
          practice.firstResponse !== latestReceipt.evidence.firstResponse ||
          practice.attempts !== latestReceipt.evidence.attemptCount
        )) return false;
        if (catalog.skill === "Listening" && (
          practice.audioPlayed !== latestReceipt.evidence.audioPlayed ||
          practice.audioCompleted !== latestReceipt.evidence.audioCompleted ||
          practice.playCount !== latestReceipt.evidence.playCount ||
          practice.transcriptUsed !== latestReceipt.evidence.transcriptUsed ||
          practice.audioSeekDetected !== latestReceipt.evidence.seekDetected ||
          practice.audioPlaybackFailed !== latestReceipt.evidence.playbackFailed ||
          (practice.audioCompleted && practice.audioStartedNearBeginning !== true)
        )) return false;
        if (catalog.skill === "Writing") {
          const normalizedArtifact = practice.draftText.replace(/\r\n/g, "\n").trim();
          const words = normalizedArtifact ? normalizedArtifact.split(/\s+/).filter(Boolean).length : 0;
          if (
            practice.draftText !== normalizedArtifact ||
            words !== practice.wordCount ||
            practice.wordCount !== latestReceipt.evidence.wordCount ||
            await workspaceBackupRuntime.sha256Hex(normalizedArtifact) !== latestReceipt.evidence.artifactHash ||
            !["idea", "reason", "edit"].every((key) => practice.selfChecks[key] === true)
          ) return false;
        }
        if (catalog.skill === "Speaking" && (
          practice.timerCompleted !== true ||
          practice.audioRecorded !== false ||
          !["answer", "example", "flow"].every((key) => practice.selfChecks[key] === true)
        )) return false;
      } else if (full ? practice.completedAt !== null : Object.hasOwn(practice, "completedAt")) {
        return false;
      }
    }
    return true;
  };

  const validWorkspaceBackupFocusState = (candidateState) => {
    const sessions = candidateState.focus.sessions;
    const sessionIds = new Set();
    for (const session of sessions) {
      if (
        !exactObjectKeys(session, WORKSPACE_BACKUP_FOCUS_SESSION_KEYS) ||
        !/^focus-[0-9a-z]+$/.test(session.sessionId || "") ||
        sessionIds.has(session.sessionId) ||
        !["completed", "stopped"].includes(session.status) ||
        !WORKSPACE_BACKUP_FOCUS_DURATIONS.has(session.durationSeconds) ||
        !exactUtcTimestamp(session.startedAt) || !exactUtcTimestamp(session.endedAt) ||
        Date.parse(session.endedAt) < Date.parse(session.startedAt)
      ) return false;
      sessionIds.add(session.sessionId);
    }
    const active = candidateState.focus.active;
    if (active === null) return true;
    if (!isRecord(active) || !["running", "paused", "completed", "stopped"].includes(active.status)) return false;
    const terminal = ["completed", "stopped"].includes(active.status);
    const expectedKeys = terminal
      ? [...WORKSPACE_BACKUP_FOCUS_ACTIVE_KEYS]
      : WORKSPACE_BACKUP_FOCUS_ACTIVE_KEYS.filter((key) => key !== "recordedAt");
    if (
      !exactObjectKeys(active, expectedKeys) ||
      !WORKSPACE_BACKUP_FOCUS_DURATIONS.has(active.durationSeconds) ||
      !Number.isInteger(active.remainingSeconds) || active.remainingSeconds < 0 || active.remainingSeconds > active.durationSeconds ||
      !exactUtcTimestamp(active.startedAt)
    ) return false;
    if (active.status === "running") {
      return Number.isInteger(active.endsAt) && active.endsAt >= Date.parse(active.startedAt) && active.remainingSeconds > 0;
    }
    if (active.endsAt !== null) return false;
    if (active.status === "paused") return active.remainingSeconds > 0;
    if (!exactUtcTimestamp(active.recordedAt) || (active.status === "completed" && active.remainingSeconds !== 0)) return false;
    const mirrors = sessions.filter((session) =>
      session.status === active.status &&
      session.durationSeconds === active.durationSeconds &&
      session.startedAt === active.startedAt &&
      Date.parse(session.endedAt) <= Date.parse(active.recordedAt)
    );
    return mirrors.length === 1;
  };

  const validWorkspaceBackupAuxiliaryState = async (candidateState) => {
    for (const [date, record] of Object.entries(candidateState.checkIns)) {
      if (record?.date !== date || !validWorkspaceBackupCheckInRecord(record, candidateState)) return false;
    }
    if (!candidateState.checkInHistory.every((record) => validWorkspaceBackupCheckInRecord(record, candidateState, { archived: true }))) {
      return false;
    }
    if (!candidateState.journey.history.every((record) =>
      validWorkspaceBackupCheckInRecord(record.checkIn, candidateState, { embedded: true })
    )) return false;
    const storedCheckInIds = [
      ...Object.values(candidateState.checkIns),
      ...candidateState.checkInHistory,
    ].map((record) => record?.checkInId).filter(Boolean);
    if (new Set(storedCheckInIds).size !== storedCheckInIds.length) return false;
    return Boolean(
      validWorkspaceBackupTaskProgress(candidateState) &&
      await validWorkspaceBackupPracticeState(candidateState) &&
      validWorkspaceBackupFocusState(candidateState)
    );
  };

  const workspaceBackupCycleStage = (chain, candidateState) => {
    if (!chain.cycle) return { key: "empty", nextRoute: candidateState.plan ? "/today" : "/diagnostic" };
    if (chain.updateComplete || chain.provisionalUpdateRecorded) return { key: "complete", nextRoute: "/plan" };
    if (chain.retestEvidenceComplete) return { key: "update", nextRoute: "/retest" };
    if (chain.peerHelpComplete) return { key: "retest", nextRoute: "/retest" };
    if (chain.reviewComplete) return { key: "community", nextRoute: "/community" };
    if (chain.checkInComplete) return { key: "review", nextRoute: "/review" };
    if (chain.recommendationComplete) {
      const hasReceipt = Object.values(candidateState.practiceReceipts || {}).some((receipt) =>
        receipt?.cycleId === chain.cycle.cycleId,
      );
      return hasReceipt
        ? { key: "checkin", nextRoute: "/check-in" }
        : { key: "practice", nextRoute: chain.recommendation?.primary?.route || "/practice" };
    }
    if (chain.planComplete) return { key: "recommendation", nextRoute: "/recommendations" };
    if (chain.diagnosticComplete) return { key: "plan", nextRoute: "/plan" };
    return { key: "diagnostic", nextRoute: "/diagnostic" };
  };

  const workspaceBackupActiveMilestonesValid = (candidateState, chain) => {
    const cycle = chain.cycle;
    const diagnostic = chain.diagnostic;
    if (!cycle || !diagnostic || diagnostic.createdAt !== cycle.createdAt) return false;
    const milestones = [cycle.createdAt];
    if (diagnostic.status === "completed") milestones.push(diagnostic.completedAt);
    if (chain.basePlan) milestones.push(chain.basePlan.createdAt);
    if (chain.recommendation) {
      milestones.push(chain.recommendation.evidenceBinding?.createdAt, chain.recommendation.createdAt, chain.recommendation.updatedAt);
    }
    if (chain.linkedPracticeReceipt) milestones.push(chain.linkedPracticeReceipt.completedAt);
    if (chain.checkIn?.status === "saved") milestones.push(chain.checkIn.savedAt);
    if (chain.review) milestones.push(chain.review.confirmedAt);
    if (chain.peerHelp) milestones.push(chain.peerHelp.createdAt, chain.peerHelp.updatedAt);
    if (chain.retest) milestones.push(chain.retest.completedAt);
    if (chain.planUpdate) milestones.push(chain.planUpdate.createdAt);
    if (chain.updatedPlan) milestones.push(chain.updatedPlan.createdAt);
    if (!milestones.every(exactUtcTimestamp)) return false;
    const times = milestones.map(Date.parse);
    if (times.some((value, index) => index > 0 && value < times[index - 1])) return false;
    const cycleAlias = workspaceBackupBoundAlias(candidateState, "cycle", cycle.cycleId);
    const eventTimes = cycleAlias
      ? candidateState.learningEvents
        .filter((event) => event?.context?.learningCycleId === cycleAlias)
        .map((event) => Date.parse(event.occurredAt))
      : [];
    const latest = Math.max(Date.parse(diagnostic.updatedAt), ...times, ...eventTimes);
    return Date.parse(cycle.updatedAt) >= latest;
  };

  const validateWorkspaceBackupActiveCycle = (candidateState) => {
    const cycle = activeCycle(candidateState);
    const journey = candidateState.journey;
    const currentObjects = ["diagnostic", "recommendation", "review", "peerHelp", "retest", "planUpdate"];
    if (!cycle) {
      if (currentObjects.some((key) => journey[key] !== null)) return { ok: false, code: "orphaned_current_object" };
      return { ok: true, chain: validateCycleEvidence(candidateState) };
    }
    if (
      !exactObjectKeys(cycle, WORKSPACE_BACKUP_ACTIVE_CYCLE_KEYS) ||
      !["in_progress", "completed", "provisional_pending_human_review"].includes(cycle.status) ||
      !historyIdValid(cycle.cycleId) ||
      !historyIdValid(cycle.diagnosticSessionId) ||
      cycle.protocolVersion !== PROTOCOL_VERSION ||
      !exactUtcTimestamp(cycle.createdAt) ||
      !exactUtcTimestamp(cycle.updatedAt)
    ) return { ok: false, code: "active_cycle_shape" };
    const nonNullIds = [cycle.cycleId, cycle.diagnosticSessionId, ...WORKSPACE_BACKUP_STAGE_IDS.map((field) => cycle[field]).filter(Boolean)];
    if (new Set(nonNullIds).size !== nonNullIds.length) return { ok: false, code: "active_cycle_duplicate_id" };
    let gapFound = false;
    for (const field of WORKSPACE_BACKUP_STAGE_IDS) {
      const value = cycle[field];
      if (value === null) gapFound = true;
      else if (!historyIdValid(value) || gapFound) return { ok: false, code: "active_cycle_stage_gap" };
    }
    if (
      !isRecord(journey.diagnostic) ||
      journey.diagnostic.cycleId !== cycle.cycleId ||
      journey.diagnostic.diagnosticSessionId !== cycle.diagnosticSessionId ||
      journey.diagnostic.protocolVersion !== PROTOCOL_VERSION ||
      journey.diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
      journey.diagnostic.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      journey.diagnostic.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      !["in_progress", "awaiting_confirmation", "completed"].includes(journey.diagnostic.status) ||
      !diagnosticEvidenceCollectionValid(journey.diagnostic)
    ) return { ok: false, code: "active_diagnostic_invalid" };
    for (const [idField, objectField] of WORKSPACE_BACKUP_STAGE_OBJECTS) {
      if ((cycle[idField] === null) !== (journey[objectField] === null)) {
        return { ok: false, code: "active_cycle_object_gap" };
      }
    }
    const chain = validateCycleEvidence(candidateState);
    if (!workspaceBackupActiveMilestonesValid(candidateState, chain)) {
      return { ok: false, code: "active_milestone_order_invalid" };
    }
    const expectedStages = [
      ["basePlanId", "diagnosticComplete"],
      ["recommendationId", "planComplete"],
      ["checkInId", "recommendationComplete"],
      ["reviewId", "checkInComplete"],
      ["peerHelpId", "reviewComplete"],
      ["retestId", "peerHelpComplete"],
      ["updatedPlanId", "retestEvidenceComplete"],
    ];
    for (const [idField, requiredFlag] of expectedStages) {
      if (cycle[idField] !== null && !chain[requiredFlag]) return { ok: false, code: `active_${requiredFlag}_invalid` };
    }
    if (cycle.status === "in_progress") {
      if (cycle.closedAt !== null || cycle.provisionalAt !== null || cycle.updatedPlanId !== null) {
        return { ok: false, code: "active_in_progress_terminal_fields" };
      }
    } else if (cycle.status === "completed") {
      if (!chain.updateComplete || !exactUtcTimestamp(cycle.closedAt) || cycle.provisionalAt !== null) {
        return { ok: false, code: "active_completed_invalid" };
      }
    } else if (!chain.provisionalUpdateRecorded || cycle.closedAt !== null || !exactUtcTimestamp(cycle.provisionalAt)) {
      return { ok: false, code: "active_provisional_invalid" };
    }
    return { ok: true, chain };
  };

  const workspaceBackupFullCycleObject = (candidateState, cycleOwner, objectKey) => {
    if (!cycleOwner || cycleOwner.kind === "superseded") return null;
    return cycleOwner.kind === "active"
      ? candidateState.journey[objectKey]
      : cycleOwner.history?.[objectKey] || null;
  };
  const workspaceBackupSupersededMatchesTerminalHistory = (summary, history) => {
    const diagnostic = history?.diagnostic;
    const terminalAt = history?.status === "completed" ? history.closedAt : history?.provisionalAt;
    if (
      !isRecord(diagnostic) ||
      !exactUtcTimestamp(terminalAt) ||
      Date.parse(summary.supersededAt) < Date.parse(terminalAt)
    ) return false;
    const expected = {
      cycleId: history.cycleId,
      diagnosticSessionId: history.diagnosticSessionId,
      protocolVersion: history.protocolVersion,
      diagnosticProtocolVersion: diagnostic.diagnosticProtocolVersion,
      taskSetVersion: diagnostic.taskSetVersion,
      taskSetDigest: diagnostic.taskSetDigest,
      diagnosticStatus: diagnostic.status,
      taskEvidenceSummary: diagnostic.taskEvidence.map(workspaceBackupDiagnosticEvidenceSummary),
      ...(diagnostic.prioritySkill ? { prioritySkill: diagnostic.prioritySkill } : {}),
      ...(diagnostic.priorityBasis ? { priorityBasis: diagnostic.priorityBasis } : {}),
      ...(diagnostic.evidenceSufficiency ? { evidenceSufficiency: diagnostic.evidenceSufficiency } : {}),
    };
    const metadataKeys = [
      "cycleId", "diagnosticSessionId", "protocolVersion", "diagnosticProtocolVersion", "taskSetVersion",
      "taskSetDigest", "diagnosticStatus", "taskEvidenceSummary", "prioritySkill", "priorityBasis",
      "evidenceSufficiency",
    ];
    const actual = Object.fromEntries(
      metadataKeys.filter((key) => Object.hasOwn(summary, key)).map((key) => [key, summary[key]]),
    );
    return workspaceBackupRuntime.canonicalJson(actual) === workspaceBackupRuntime.canonicalJson(expected);
  };
  const validateWorkspaceBackupLedgerCoverage = (candidateState) => {
    const events = candidateState.learningEvents;
    if (!events.length) return candidateState.learningEventBindings === null;
    const bindings = candidateState.learningEventBindings;
    const records = bindings?.records;
    if (!isRecord(records)) return false;

    const domainCycleIds = new Set([
      candidateState.journey.activeCycle?.cycleId,
      ...candidateState.journey.history.map((record) => record?.cycleId),
      ...candidateState.journey.supersededCycles.map((record) => record?.cycleId),
    ].filter(Boolean));
    if (
      Object.keys(records.cycle || {}).length !== domainCycleIds.size ||
      [...domainCycleIds].some((cycleId) => !UUID_V4_PATTERN.test(records.cycle?.[cycleId] || ""))
    ) return false;

    const usedAliases = new Set();
    const resolvedEvents = [];
    for (const event of events) {
      const resolved = {};
      for (const [contextKey, alias] of Object.entries(event.context || {})) {
        if (contextKey === "causationEventId") continue;
        const kind = WORKSPACE_BACKUP_EVENT_CONTEXT_KIND[contextKey];
        const domainId = kind ? workspaceBackupEventDomainId(candidateState, kind, alias) : null;
        if (!kind || !domainId) return false;
        usedAliases.add(alias);
        resolved[contextKey] = domainId;
      }
      const cycleId = resolved.learningCycleId;
      const cycleOwner = workspaceBackupCycleDomainOwner(candidateState, cycleId);
      if (!cycleOwner || cycleOwner.cycle.diagnosticSessionId !== resolved.diagnosticSessionId) return false;

      if (resolved.planId) {
        const plan = planById(resolved.planId, candidateState);
        if (
          !plan ||
          plan.provenance?.cycleId !== cycleId ||
          plan.provenance?.diagnosticSessionId !== resolved.diagnosticSessionId ||
          (cycleOwner.kind !== "superseded" && cycleOwner.cycle.basePlanId !== resolved.planId)
        ) return false;
      }
      if (resolved.recommendationId) {
        const recommendation = workspaceBackupFullCycleObject(candidateState, cycleOwner, "recommendation");
        if (cycleOwner.kind === "superseded") {
          if (event.eventType === "learning_cycle.completed") return false;
        } else if (
          recommendation?.recommendationId !== resolved.recommendationId ||
          recommendation.cycleId !== cycleId ||
          recommendation.diagnosticSessionId !== resolved.diagnosticSessionId
        ) return false;
      }
      if (resolved.bindingId) {
        const recommendation = workspaceBackupFullCycleObject(candidateState, cycleOwner, "recommendation");
        if (cycleOwner.kind !== "superseded" && recommendation?.evidenceBinding?.bindingId !== resolved.bindingId) return false;
      }
      if (resolved.taskId) {
        const owner = workspaceBackupTaskOwner(candidateState, resolved.taskId);
        if (owner?.kind !== "plan" || owner.plan.planId !== resolved.planId) return false;
      }
      if (resolved.practiceReceiptId) {
        const receipt = candidateState.practiceReceipts[resolved.practiceReceiptId];
        if (!receipt || receipt.cycleId !== cycleId || receipt.diagnosticSessionId !== resolved.diagnosticSessionId) return false;
        if (resolved.planId && receipt.planId !== resolved.planId) return false;
        if (resolved.taskId && receipt.taskId !== resolved.taskId) return false;
      }
      if (resolved.baselinePracticeReceiptId) {
        const receipt = candidateState.practiceReceipts[resolved.baselinePracticeReceiptId];
        if (!receipt || receipt.cycleId !== cycleId || receipt.diagnosticSessionId !== resolved.diagnosticSessionId) return false;
      }
      if (resolved.attemptId) {
        const matches = Object.values(candidateState.practiceReceipts).filter((receipt) =>
          receipt?.practiceAttemptId === resolved.attemptId && receipt?.cycleId === cycleId
        );
        if (matches.length !== 1 || matches[0].completionReceiptId !== resolved.practiceReceiptId) return false;
      }
      if (resolved.checkInId) {
        const checkIn = workspaceBackupExactCheckInById(candidateState, resolved.checkInId);
        if (!checkIn || checkIn.cycleId !== cycleId || checkIn.diagnosticSessionId !== resolved.diagnosticSessionId) return false;
      }
      if (resolved.retestId) {
        const retest = workspaceBackupFullCycleObject(candidateState, cycleOwner, "retest");
        if (cycleOwner.kind !== "superseded" && (
          retest?.retestId !== resolved.retestId || retest.cycleId !== cycleId
        )) return false;
      }
      if (resolved.humanReviewReceiptId) return false;
      if (resolved.updatedPlanId) {
        const planUpdate = workspaceBackupFullCycleObject(candidateState, cycleOwner, "planUpdate");
        const updatedPlan = planById(resolved.updatedPlanId, candidateState);
        if (
          cycleOwner.kind === "superseded" ||
          planUpdate?.updatedPlanId !== resolved.updatedPlanId ||
          planUpdate.cycleId !== cycleId ||
          !updatedPlan ||
          updatedPlan.provenance?.cycleId !== cycleId
        ) return false;
      }
      resolvedEvents.push({ event, resolved, cycleOwner });
    }

    for (const [kind, domainRecords] of Object.entries(records)) {
      if (!isRecord(domainRecords)) return false;
      if (kind === "humanReviewReceipt" && Object.keys(domainRecords).length !== 0) return false;
      for (const alias of Object.values(domainRecords)) {
        if (!usedAliases.has(alias)) return false;
      }
    }

    for (const summary of candidateState.journey.supersededCycles) {
      const matchingHistory = candidateState.journey.history.filter((record) => record?.cycleId === summary.cycleId);
      if (matchingHistory.length) {
        if (
          matchingHistory.length !== 1 ||
          !workspaceBackupSupersededMatchesTerminalHistory(summary, matchingHistory[0])
        ) return false;
        continue;
      }
      const cycleAlias = records.cycle?.[summary.cycleId];
      const cycleEvents = resolvedEvents.filter(({ event }) => event.context.learningCycleId === cycleAlias);
      const startedEvents = cycleEvents.filter(({ event }) => event.eventType === "learning_cycle.started");
      if (
        !cycleEvents.length ||
        startedEvents.length !== 1 ||
        cycleEvents[0] !== startedEvents[0] ||
        cycleEvents.some(({ event, resolved }) => event.eventType === "learning_cycle.completed" || resolved.updatedPlanId) ||
        cycleEvents.some(({ event }) => Date.parse(event.occurredAt) > Date.parse(summary.supersededAt)) ||
        startedEvents[0].resolved.diagnosticSessionId !== summary.diagnosticSessionId ||
        startedEvents[0].event.attributes.taskSetVersion !== summary.taskSetVersion ||
        startedEvents[0].event.attributes.taskSetDigest !== summary.taskSetDigest
      ) return false;
    }
    return true;
  };

  const workspaceBackupBoundAlias = (candidateState, kind, domainId) => {
    if (!historyIdValid(domainId)) return null;
    return boundHistoryAlias(candidateState.learningEventBindings, kind, domainId);
  };

  const workspaceBackupDomainIdForAlias = (candidateState, kind, alias) => {
    return workspaceBackupEventDomainId(candidateState, kind, alias);
  };

  const validateWorkspaceBackupActiveEventPrefix = (candidateState, activeValidation) => {
    const cycle = activeValidation.chain.cycle;
    if (!cycle) return true;
    const cycleAlias = workspaceBackupBoundAlias(candidateState, "cycle", cycle.cycleId);
    const diagnosticAlias = workspaceBackupBoundAlias(candidateState, "diagnostic", cycle.diagnosticSessionId);
    if (!cycleAlias || !diagnosticAlias) return false;
    const cycleEvents = candidateState.learningEvents.filter((event) => event?.context?.learningCycleId === cycleAlias);
    const byType = (type) => cycleEvents.filter((event) => event.eventType === type);
    const started = byType("learning_cycle.started");
    const recommendations = byType("recommendation.decided");
    const practices = byType("practice_attempt.finalized");
    const checkIns = byType("check_in.committed");
    const retests = byType("retest.completed");
    const completions = byType("learning_cycle.completed");
    if (
      started.length !== 1 ||
      recommendations.length !== (cycle.recommendationId ? 1 : 0) ||
      checkIns.length !== (cycle.checkInId ? 1 : 0) ||
      retests.length !== (cycle.retestId ? 1 : 0) ||
      completions.length !== (cycle.status === "completed" ? 1 : 0) ||
      (cycle.checkInId && practices.length === 0) ||
      (!cycle.recommendationId && practices.length > 0)
    ) return false;
    if (
      started[0].context.diagnosticSessionId !== diagnosticAlias ||
      started[0].occurredAt !== cycle.createdAt ||
      started[0].attributes.outcome !== "started" ||
      started[0].attributes.taskSetVersion !== activeValidation.chain.diagnostic?.taskSetVersion ||
      started[0].attributes.taskSetDigest !== activeValidation.chain.diagnostic?.taskSetDigest
    ) return false;

    const recommendation = activeValidation.chain.recommendation;
    const basePlan = activeValidation.chain.basePlan;
    const bindingAlias = recommendation
      ? workspaceBackupBoundAlias(candidateState, "binding", recommendation.evidenceBinding?.bindingId)
      : null;
    const planAlias = basePlan ? workspaceBackupBoundAlias(candidateState, "plan", basePlan.planId) : null;
    const recommendationAlias = recommendation
      ? workspaceBackupBoundAlias(candidateState, "recommendation", recommendation.recommendationId)
      : null;
    if (recommendations.length && (
      !planAlias ||
      !recommendationAlias ||
      !bindingAlias ||
      recommendations[0].context.diagnosticSessionId !== diagnosticAlias ||
      recommendations[0].context.planId !== planAlias ||
      recommendations[0].context.recommendationId !== recommendationAlias ||
      recommendations[0].context.bindingId !== bindingAlias ||
      recommendations[0].occurredAt !== recommendation.createdAt ||
      recommendations[0].attributes.decision !== recommendation.status ||
      recommendations[0].attributes.bindingReviewStatus !== "gate_a_unreviewed"
    )) return false;

    const activeCycleReceipts = Object.values(candidateState.practiceReceipts).filter((receipt) => receipt?.cycleId === cycle.cycleId);
    if (activeCycleReceipts.length !== practices.length) return false;
    const practiceReceiptIds = new Set();
    for (const event of practices) {
      const receiptId = workspaceBackupDomainIdForAlias(candidateState, "practiceReceipt", event.context.practiceReceiptId);
      const attemptId = workspaceBackupDomainIdForAlias(candidateState, "practiceAttempt", event.context.attemptId);
      const taskId = workspaceBackupDomainIdForAlias(candidateState, "task", event.context.taskId);
      const receipt = receiptId ? candidateState.practiceReceipts[receiptId] : null;
      if (
        !receipt ||
        receipt.cycleId !== cycle.cycleId ||
        receipt.diagnosticSessionId !== cycle.diagnosticSessionId ||
        receipt.planId !== cycle.basePlanId ||
        receipt.recommendationId !== cycle.recommendationId ||
        receipt.practiceAttemptId !== attemptId ||
        receipt.taskId !== taskId ||
        practiceReceiptIds.has(receipt.completionReceiptId) ||
        event.context.diagnosticSessionId !== diagnosticAlias ||
        event.context.planId !== planAlias ||
        event.context.recommendationId !== recommendationAlias ||
        event.context.bindingId !== bindingAlias ||
        event.attributes.skill !== receipt.skill ||
        event.occurredAt !== receipt.completedAt ||
        event.attributes.evidenceStatus !== receipt.evidenceStatus ||
        event.attributes.automatedScoreProduced !== false ||
        event.attributes.formalDiagnosisProduced !== false ||
        event.attributes.officialEquivalenceClaimed !== false ||
        (["Reading", "Listening"].includes(receipt.skill) && event.attributes.attemptCount !== receipt.evidence.attemptCount) ||
        (receipt.skill === "Writing" && (
          event.attributes.wordCount !== receipt.evidence.wordCount ||
          event.attributes.selfCheckCount !== receipt.evidence.selfCheckCount
        )) ||
        (receipt.skill === "Speaking" && event.attributes.selfCheckCount !== receipt.evidence.selfCheckCount)
      ) return false;
      practiceReceiptIds.add(receipt.completionReceiptId);
    }

    const checkIn = activeValidation.chain.checkIn;
    if (checkIns.length) {
      const receipt = checkIn?.practiceReceipt;
      if (
        !receipt ||
        checkIns[0].context.diagnosticSessionId !== diagnosticAlias ||
        checkIns[0].context.planId !== planAlias ||
        checkIns[0].context.recommendationId !== recommendationAlias ||
        checkIns[0].context.bindingId !== bindingAlias ||
        checkIns[0].context.taskId !== workspaceBackupBoundAlias(candidateState, "task", checkIn.linkedTaskId) ||
        checkIns[0].context.practiceReceiptId !== workspaceBackupBoundAlias(candidateState, "practiceReceipt", receipt.completionReceiptId) ||
        checkIns[0].context.checkInId !== workspaceBackupBoundAlias(candidateState, "checkIn", checkIn.checkInId) ||
        !practiceReceiptIds.has(receipt.completionReceiptId) ||
        checkIns[0].occurredAt !== checkIn.savedAt ||
        checkIns[0].attributes.outcome !== "committed" ||
        checkIns[0].attributes.questionStatus !== checkIn.questionStatus ||
        checkIns[0].attributes.evidenceClass !== checkIn.evidenceClass ||
        checkIns[0].attributes.evidenceStatus !== receipt.evidenceStatus
      ) return false;
    }

    const retest = activeValidation.chain.retest;
    if (retests.length && (
      !retest ||
      retests[0].context.diagnosticSessionId !== diagnosticAlias ||
      retests[0].context.planId !== planAlias ||
      retests[0].context.recommendationId !== recommendationAlias ||
      retests[0].context.bindingId !== bindingAlias ||
      retests[0].context.checkInId !== workspaceBackupBoundAlias(candidateState, "checkIn", cycle.checkInId) ||
      retests[0].context.retestId !== workspaceBackupBoundAlias(candidateState, "retest", cycle.retestId) ||
      retests[0].context.baselinePracticeReceiptId !== workspaceBackupBoundAlias(candidateState, "practiceReceipt", retest.baselinePracticeReceiptId) ||
      retests[0].attributes.skill !== retest.skill ||
      retests[0].attributes.humanConfirmationStatus !== retest.humanConfirmationStatus ||
      retests[0].occurredAt !== retest.completedAt ||
      retests[0].attributes.outcome !== "completed" ||
      retests[0].attributes.evidenceType !== retest.evidence?.resultType ||
      retests[0].attributes.evidenceSufficiency !== retest.evidenceSufficiency ||
      retests[0].attributes.comparabilityClass !== retest.comparability?.constructAlignment
    )) return false;

    const planUpdate = activeValidation.chain.planUpdate;
    if (completions.length && (
      !planUpdate ||
      completions[0].context.diagnosticSessionId !== diagnosticAlias ||
      completions[0].context.planId !== planAlias ||
      completions[0].context.retestId !== workspaceBackupBoundAlias(candidateState, "retest", cycle.retestId) ||
      completions[0].context.updatedPlanId !== workspaceBackupBoundAlias(candidateState, "updatedPlan", cycle.updatedPlanId) ||
      completions[0].attributes.nextFocusSkill !== planUpdate.focusSkill ||
      completions[0].attributes.humanConfirmationStatus !== planUpdate.humanConfirmationStatus ||
      completions[0].occurredAt !== cycle.closedAt ||
      completions[0].attributes.outcome !== "completed"
    )) return false;
    return true;
  };

  const validateWorkspaceBackupCycleIdentityGraph = (candidateState) => {
    const active = candidateState.journey.activeCycle;
    const history = candidateState.journey.history;
    const sameActiveHistory = active
      ? history.filter((record) => record?.cycleId === active.cycleId)
      : [];
    if (active?.status === "in_progress" && sameActiveHistory.length !== 0) return false;
    if (active && active.status !== "in_progress") {
      if (sameActiveHistory.length !== 1) return false;
      const checkInMatches = allCheckIns(candidateState).filter((record) =>
        record?.checkInId === active.checkInId &&
        record?.cycleId === active.cycleId &&
        record?.planId === active.basePlanId,
      );
      if (checkInMatches.length !== 1) return false;
      const storedCheckIn = checkInMatches[0];
      const projectedCheckIn = { ...storedCheckIn };
      const hasArchivedAt = Object.hasOwn(projectedCheckIn, "archivedAt");
      const hasArchivedReason = Object.hasOwn(projectedCheckIn, "archivedReason");
      if (hasArchivedAt !== hasArchivedReason) return false;
      if (hasArchivedAt) {
        const terminalAt = active.status === "completed" ? active.closedAt : active.provisionalAt;
        if (
          !validWorkspaceBackupCheckInRecord(storedCheckIn, candidateState, { archived: true }) ||
          !exactUtcTimestamp(terminalAt) ||
          Date.parse(storedCheckIn.archivedAt) < Date.parse(terminalAt) ||
          (storedCheckIn.archivedReason === "learner_revision_after_confirmation" &&
            !(storedCheckIn.learnerConfirmedReview === true && historyIdValid(storedCheckIn.reviewId))) ||
          (storedCheckIn.archivedReason === "learner_revision_after_save" &&
            (storedCheckIn.learnerConfirmedReview === true || Boolean(storedCheckIn.reviewId)))
        ) return false;
        delete projectedCheckIn.archivedAt;
        delete projectedCheckIn.archivedReason;
      }
      const expected = {
        ...active,
        diagnostic: candidateState.journey.diagnostic,
        recommendation: candidateState.journey.recommendation,
        checkIn: projectedCheckIn,
        review: candidateState.journey.review,
        peerHelp: candidateState.journey.peerHelp,
        retest: candidateState.journey.retest,
        planUpdate: candidateState.journey.planUpdate,
      };
      if (workspaceBackupRuntime.canonicalJson(sameActiveHistory[0]) !== workspaceBackupRuntime.canonicalJson(expected)) {
        return false;
      }
    }
    const identityOwner = new Map();
    const register = (value, cycleId, role) => {
      if (!historyIdValid(value) || !historyIdValid(cycleId)) return false;
      const owner = identityOwner.get(value);
      if (owner && (owner.cycleId !== cycleId || owner.role !== role)) return false;
      identityOwner.set(value, { cycleId, role });
      return true;
    };
    const cycles = [...history, ...(active ? [active] : [])];
    for (const cycle of cycles) {
      if (!CYCLE_HISTORY_ID_FIELDS.filter((field) => cycle[field] !== null).every((field) => register(cycle[field], cycle.cycleId, field))) {
        return false;
      }
    }
    for (const summary of candidateState.journey.supersededCycles) {
      if (active?.cycleId === summary.cycleId) return false;
      if (
        !register(summary.cycleId, summary.cycleId, "cycleId") ||
        !register(summary.diagnosticSessionId, summary.cycleId, "diagnosticSessionId")
      ) return false;
    }
    return true;
  };

  const validateWorkspaceBackupCandidate = async (candidate) => {
    if (!workspaceBackupRuntime || !learningEventsRuntime) return { ok: false, code: "runtime_unavailable" };
    if (
      !exactObjectKeys(candidate, workspaceBackupRuntime.WORKSPACE_KEYS) ||
      !exactObjectKeys(candidate?.journey, workspaceBackupRuntime.JOURNEY_KEYS) ||
      !exactObjectKeys(candidate?.profile, WORKSPACE_BACKUP_PROFILE_KEYS) ||
      !exactObjectKeys(candidate?.focus, WORKSPACE_BACKUP_FOCUS_KEYS) ||
      candidate.schemaVersion !== SCHEMA_VERSION ||
      candidate.journey.protocolVersion !== PROTOCOL_VERSION ||
      !exactUtcTimestamp(candidate.updatedAt) ||
      !validWorkspaceBackupProfile(candidate.profile) ||
      !isRecord(candidate.taskProgress) ||
      !isRecord(candidate.practice) ||
      !isRecord(candidate.practiceReceipts) ||
      !isRecord(candidate.checkIns) ||
      !Array.isArray(candidate.checkInHistory) ||
      !Array.isArray(candidate.focus.sessions)
    ) return { ok: false, code: "workspace_shape_invalid" };
    const normalized = normalizeState(candidate);
    if (
      !normalized ||
      workspaceBackupRuntime.canonicalJson(normalized) !== workspaceBackupRuntime.canonicalJson(candidate)
    ) return { ok: false, code: "workspace_normalization_changed" };
    if (!validWorkspaceBackupDomainObjects(normalized)) return { ok: false, code: "domain_object_schema_invalid" };
    if (!validWorkspaceBackupPlanGraph(normalized)) return { ok: false, code: "plan_graph_invalid" };
    if (!validWorkspaceBackupReceiptGraph(normalized)) return { ok: false, code: "receipt_graph_invalid" };
    if (!await validWorkspaceBackupAuxiliaryState(normalized)) return { ok: false, code: "auxiliary_state_invalid" };
    if (!validWorkspaceBackupSupersededCycles(normalized)) return { ok: false, code: "superseded_cycle_invalid" };
    let ledgerStatus;
    try {
      ledgerStatus = await learningEventsRuntime.validateLedger(normalized);
    } catch {
      return { ok: false, code: "ledger_validation_exception" };
    }
    if (!ledgerStatus.ok) return { ok: false, code: `ledger_${ledgerStatus.code || "invalid"}` };
    if (!validateWorkspaceBackupLedgerCoverage(normalized)) return { ok: false, code: "ledger_domain_coverage_invalid" };
    const activeValidation = validateWorkspaceBackupActiveCycle(normalized);
    if (!activeValidation.ok) return activeValidation;
    if (!validateWorkspaceBackupActiveEventPrefix(normalized, activeValidation)) {
      return { ok: false, code: "active_event_prefix_invalid" };
    }
    if (!validateWorkspaceBackupCycleIdentityGraph(normalized)) {
      return { ok: false, code: "cycle_identity_graph_invalid" };
    }
    const historyProjection = buildCycleHistoryProjection(normalized, ledgerStatus);
    if (
      historyProjection.invalidCount !== 0 ||
      historyProjection.sourceCount !== historyProjection.validCount + historyProjection.currentExcludedCount
    ) return { ok: false, code: "history_graph_invalid" };
    const stage = workspaceBackupCycleStage(activeValidation.chain, normalized);
    return {
      ok: true,
      candidate: normalized,
      summary: {
        stageKey: stage.key,
        stageLabel: WORKSPACE_BACKUP_STAGE_LABELS[stage.key],
        nextRoute: stage.nextRoute,
        planCount: (normalized.plan ? 1 : 0) + normalized.planHistory.length,
        currentPlanStart: normalized.plan?.startDate || null,
        currentPlanEnd: normalized.plan?.endDate || null,
        completedCycleCount: normalized.journey.history.filter((record) => record?.status === "completed").length,
        provisionalCycleCount: normalized.journey.history.filter((record) => record?.status === "provisional_pending_human_review").length,
        practiceReceiptCount: Object.keys(normalized.practiceReceipts).length,
        checkInCount: Object.values(normalized.checkIns).filter((record) => record?.status === "saved").length,
        learningEventCount: normalized.learningEvents.length,
        learningEventHeadHash: normalized.learningEvents.at(-1)?.eventHash || null,
      },
    };
  };

  const WORKSPACE_BACKUP_ERROR_MESSAGES = Object.freeze({
    empty_file: "所选文件为空；没有修改当前学习数据。",
    envelope_contract: "备份信封版本或安全边界不受支持；没有修改当前学习数据。",
    envelope_shape: "备份信封字段不完整或含有未知字段；没有修改当前学习数据。",
    file_too_large: "备份文件超过 2 MiB 上限；没有读取或修改当前学习数据。",
    forbidden_key: "备份含有不允许的身份或对象字段；没有修改当前学习数据。",
    integrity_mismatch: "备份摘要与内容不一致，可能已损坏或被改动；没有修改当前学习数据。",
    invalid_control_character: "备份含有不允许的控制字符；没有修改当前学习数据。",
    invalid_json: "所选文件不是有效 JSON；没有修改当前学习数据。",
    invalid_key_length: "备份字段名超过安全上限；没有修改当前学习数据。",
    invalid_number: "备份含有无效数值；没有修改当前学习数据。",
    ledger_domain_coverage_invalid: "备份的学习事件与闭环记录无法完整回链；没有修改当前学习数据。",
    not_text: "浏览器无法把所选文件作为文本读取；没有修改当前学习数据。",
    plan_graph_invalid: "备份中的 7 天计划回链不完整；没有修改当前学习数据。",
    receipt_graph_invalid: "备份中的练习回执回链不完整；没有修改当前学习数据。",
    resource_limit_exceeded: "备份超过本机恢复的安全容量；没有修改当前学习数据。",
    runtime_unavailable: "本机备份或事件核对组件未加载；请刷新后重试。",
    string_too_long: "备份中的单项文本超过安全上限；没有修改当前学习数据。",
    superseded_cycle_invalid: "备份中的中止轮次记录不完整；没有修改当前学习数据。",
    too_deep: "备份嵌套层级超过安全上限；没有修改当前学习数据。",
    too_many_values: "备份包含的项目数量超过安全上限；没有修改当前学习数据。",
    unsupported_value: "备份含有不受支持的数据类型；没有修改当前学习数据。",
    workspace_count_limit: "备份中的记录数量超过恢复上限；没有修改当前学习数据。",
    workspace_normalization_changed: "备份不能在当前版本中无损读取；没有修改当前学习数据。",
    workspace_shape: "备份中的学习工作区结构不受支持；没有修改当前学习数据。",
    workspace_shape_invalid: "备份中的学习工作区结构不完整；没有修改当前学习数据。",
    workspace_too_large: "备份中的学习工作区超过 1 MiB 上限；没有修改当前学习数据。",
  });

  const workspaceBackupErrorMessage = (code) => {
    if (typeof code === "string" && code.startsWith("ledger_")) {
      return "备份中的学习事件账本未通过顺序、哈希或状态核对；没有修改当前学习数据。";
    }
    if (typeof code === "string" && (code.startsWith("active_") || code === "orphaned_current_object")) {
      return "备份中的当前学习轮次回链不完整；没有修改当前学习数据。";
    }
    if (code === "history_graph_invalid") {
      return "备份中的历史学习轮次回链不完整；没有修改当前学习数据。";
    }
    return WORKSPACE_BACKUP_ERROR_MESSAGES[code] || "备份未通过严格核对；没有修改当前学习数据。";
  };

  const downloadWorkspaceBackup = (content) => {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sufeiya-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const synchronizeJourneyRuntimeAfterWorkspaceRestore = async (candidateRaw) => {
    try {
      const persistedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (persistedRaw !== candidateRaw) return { status: "concurrent_write" };
      const validation = await validateWorkspaceBackupCandidate(JSON.parse(persistedRaw));
      if (!validation.ok) return { status: "workspace_invalid", code: validation.code };
      const restoredLedgerStatus = await learningEventsRuntime.validateLedger(validation.candidate);
      if (!restoredLedgerStatus?.ok) {
        return { status: "ledger_invalid", code: restoredLedgerStatus?.code || "invalid" };
      }
      const workspacePageRuntime = window.SufeiyaWorkspacePageRuntime;
      if (
        workspacePageRuntime?.protocolVersion !== "sufeiya_workspace_page_runtime_v1" ||
        typeof workspacePageRuntime.refreshAfterWorkspaceRestore !== "function"
      ) return { status: "page_runtime_unavailable" };
      const pageRefresh = await workspacePageRuntime.refreshAfterWorkspaceRestore();
      if (pageRefresh?.status !== "refreshed") {
        return { status: "page_refresh_failed", code: pageRefresh?.status || "unknown" };
      }
      if (window.localStorage.getItem(STORAGE_KEY) !== candidateRaw) return { status: "concurrent_write" };
      state = validation.candidate;
      rawStoredValue = candidateRaw;
      learningLedgerStatus = restoredLedgerStatus;
      storageWritable = Boolean(workspaceWriterLeaseAvailable);
      return { status: "synchronized" };
    } catch {
      return { status: "runtime_sync_failed" };
    }
  };

  const setupWorkspaceBackupControls = ({ currentLedgerStatus }) => {
    const root = document.querySelector("[data-workspace-backup]");
    if (!root) return;
    const exportButton = document.querySelector("[data-export-restorable-workspace]");
    const fileInput = root.querySelector("[data-workspace-backup-file]");
    const validateButton = root.querySelector("[data-validate-workspace-backup]");
    const preview = root.querySelector("[data-workspace-backup-preview]");
    const confirmation = root.querySelector("[data-confirm-workspace-restore]");
    const restoreButton = root.querySelector("[data-restore-workspace-backup]");
    const resetButton = root.querySelector("[data-reset-workspace-backup]");
    const message = root.querySelector("[data-workspace-backup-message]");
    const success = root.querySelector("[data-workspace-restore-success]");
    const successLink = root.querySelector("[data-workspace-restore-next]");
    const fileSummary = root.querySelector("[data-workspace-backup-file-summary]");
    const fileName = root.querySelector("[data-backup-file-name]");
    const fileSize = root.querySelector("[data-backup-file-size]");
    const fileStatus = root.querySelector("[data-backup-file-status]");
    if (
      !exportButton ||
      !fileInput ||
      !validateButton ||
      !preview ||
      !confirmation ||
      !restoreButton ||
      !resetButton ||
      !message ||
      !success ||
      !successLink ||
      !fileSummary ||
      !fileName ||
      !fileSize ||
      !fileStatus
    ) return;

    let inspection = null;
    let expectedCurrentRaw = null;
    let busy = false;
    let committed = false;
    const currentWorkspaceExportable = Boolean(
      workspaceBackupRuntime && currentLedgerStatus?.ok && storageWritable && workspaceWriterLeaseAvailable,
    );
    const restoreLockAvailable = Boolean(workspaceWriterLeaseAvailable && navigator.locks?.request);

    const formattedFileSize = (bytes) => {
      const exact = `${new Intl.NumberFormat("zh-CN").format(bytes)} 字节`;
      if (bytes < 1024) return exact;
      const useMiB = bytes >= 1024 * 1024;
      const value = bytes / (useMiB ? 1024 * 1024 : 1024);
      return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)} ${useMiB ? "MiB" : "KiB"} · ${exact}`;
    };
    const renderFileSummary = (file, status) => {
      if (!file) {
        fileName.textContent = "—";
        fileSize.textContent = "—";
        fileStatus.textContent = status || "等待选择";
        fileSummary.hidden = true;
        return;
      }
      fileName.textContent = file.name;
      fileSize.textContent = formattedFileSize(file.size);
      fileStatus.textContent = status;
      fileSummary.hidden = false;
    };
    const setMessage = (text, { error = false, focus = false, code = null, selectedFileStatus = null } = {}) => {
      message.textContent = text;
      message.setAttribute("role", error ? "alert" : "status");
      message.dataset.state = error ? "error" : text ? "status" : "idle";
      if (code) message.dataset.code = code;
      else delete message.dataset.code;
      if (selectedFileStatus && fileInput.files?.[0]) renderFileSummary(fileInput.files[0], selectedFileStatus);
      if (focus) message.focus();
    };
    const setBusy = (nextBusy) => {
      busy = nextBusy;
      root.setAttribute("aria-busy", String(nextBusy));
      exportButton.disabled = nextBusy || committed || !currentWorkspaceExportable;
      fileInput.disabled = nextBusy || committed;
      validateButton.disabled = nextBusy || committed || !fileInput.files?.length;
      resetButton.disabled = nextBusy || committed || (!fileInput.files?.length && !inspection);
      confirmation.disabled = nextBusy || committed || !inspection;
      restoreButton.disabled = nextBusy || committed || !inspection || !confirmation.checked || !restoreLockAvailable;
    };
    const clearPreview = ({ clearFile = false, clearMessage = false } = {}) => {
      inspection = null;
      expectedCurrentRaw = null;
      preview.hidden = true;
      success.hidden = true;
      confirmation.checked = false;
      confirmation.disabled = true;
      restoreButton.disabled = true;
      if (clearFile) {
        fileInput.value = "";
        renderFileSummary(null, "已重置");
      }
      if (clearMessage) setMessage("");
      setBusy(false);
    };
    const setPreviewText = (selector, value) => {
      const node = preview.querySelector(selector);
      if (node) node.textContent = value;
    };
    const renderInspection = (result) => {
      const summary = result.validation.summary;
      const exportedAt = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(result.envelope.exportedAt));
      const dateRange = summary.currentPlanStart && summary.currentPlanEnd
        ? `${summary.currentPlanStart} 至 ${summary.currentPlanEnd}`
        : "没有当前 7 天计划";
      setPreviewText("[data-backup-exported-at]", exportedAt);
      setPreviewText("[data-backup-stage]", summary.stageLabel);
      setPreviewText("[data-backup-plans]", `${summary.planCount} 份`);
      setPreviewText("[data-backup-date-range]", dateRange);
      setPreviewText(
        "[data-backup-completed-cycles]",
        `${summary.completedCycleCount} 轮完成 · ${summary.provisionalCycleCount} 轮待人工确认`,
      );
      setPreviewText("[data-backup-receipts]", `${summary.practiceReceiptCount} 份`);
      setPreviewText("[data-backup-checkins]", `${summary.checkInCount} 条`);
      setPreviewText("[data-backup-events]", `${summary.learningEventCount} 条`);
      setPreviewText(
        "[data-backup-head-hash]",
        summary.learningEventHeadHash ? `${summary.learningEventHeadHash.slice(0, 12)}…` : "空账本",
      );
      preview.hidden = false;
      confirmation.disabled = false;
      preview.focus();
    };

    exportButton.addEventListener("click", async () => {
      if (busy || committed) return;
      setBusy(true);
      setMessage("正在核对当前学习工作区…");
      try {
        if (!workspaceBackupRuntime || !currentLedgerStatus?.ok || !storageWritable || !workspaceWriterLeaseAvailable) {
          setMessage("当前学习工作区不能生成可恢复备份；请先使用“导出全部原始本机数据”保全原值。", {
            error: true,
            focus: true,
            code: "export_unavailable",
          });
          return;
        }
        const snapshot = workspaceBackupSnapshot(state);
        const validation = snapshot ? await validateWorkspaceBackupCandidate(snapshot) : { ok: false, code: "workspace_shape" };
        if (!validation.ok) {
          setMessage(`${workspaceBackupErrorMessage(validation.code)} 可先导出全部原始本机数据保全原值。`, {
            error: true,
            focus: true,
            code: validation.code,
          });
          return;
        }
        const result = await workspaceBackupRuntime.createEnvelope(validation.candidate);
        if (result.status !== "ready") {
          setMessage(workspaceBackupErrorMessage(result.code), { error: true, focus: true, code: result.code });
          return;
        }
        downloadWorkspaceBackup(JSON.stringify(result.envelope, null, 2));
        setMessage("可恢复的学习工作区备份已下载。文件不含 Sofia 对话或教研复核演示草稿。", { focus: true });
      } catch {
        setMessage("浏览器未能生成可恢复备份；请使用原始本机数据导出保全当前值。", { error: true, focus: true, code: "export_exception" });
      } finally {
        setBusy(false);
      }
    });

    fileInput.addEventListener("change", () => {
      clearPreview();
      validateButton.disabled = !fileInput.files?.length;
      resetButton.disabled = !fileInput.files?.length;
      const file = fileInput.files?.[0] || null;
      renderFileSummary(file, file ? "已选择 · 尚未读取或验证" : "等待选择");
      setMessage(file ? "文件已选择。点击“验证备份”后才会读取并预览；此时不会写入。" : "");
    });

    validateButton.addEventListener("click", async () => {
      if (busy || committed) return;
      clearPreview();
      const file = fileInput.files?.[0];
      if (!file) {
        setMessage("请先选择一个 Sufeiya 学习工作区 JSON 备份。", { error: true, focus: true });
        return;
      }
      if (!workspaceBackupRuntime) {
        setMessage(workspaceBackupErrorMessage("runtime_unavailable"), { error: true, focus: true, selectedFileStatus: "已拒绝 · 验证组件不可用" });
        return;
      }
      if (file.size > workspaceBackupRuntime.MAX_FILE_BYTES) {
        setMessage(workspaceBackupErrorMessage("file_too_large"), { error: true, focus: true, selectedFileStatus: "已拒绝 · 文件超过上限" });
        return;
      }
      setBusy(true);
      setMessage("正在本机验证协议、摘要、事件链与闭环回链…", { selectedFileStatus: "验证中 · 尚未写入" });
      try {
        const text = await file.text();
        const result = await workspaceBackupRuntime.inspectEnvelopeText(text, validateWorkspaceBackupCandidate);
        if (result.status !== "ready") {
          setMessage(workspaceBackupErrorMessage(result.code), { error: true, focus: true, selectedFileStatus: "已拒绝 · 未通过严格验证" });
          return;
        }
        try {
          expectedCurrentRaw = window.localStorage.getItem(STORAGE_KEY);
        } catch {
          setMessage("浏览器无法读取当前学习工作区；没有修改任何本机数据。", { error: true, focus: true, selectedFileStatus: "已拒绝 · 无法核对当前工作区" });
          return;
        }
        inspection = result;
        renderInspection(result);
        setMessage("备份已通过本机严格核对。确认替换范围后，恢复按钮才会启用。", { selectedFileStatus: "已通过 · 等待明确确认" });
      } catch {
        setMessage("浏览器未能安全读取所选文件；没有修改当前学习数据。", { error: true, focus: true, selectedFileStatus: "已拒绝 · 无法安全读取" });
      } finally {
        setBusy(false);
      }
    });

    confirmation.addEventListener("change", () => setBusy(false));
    resetButton.addEventListener("click", () => {
      if (busy || committed) return;
      clearPreview({ clearFile: true, clearMessage: true });
      fileInput.focus();
    });

    restoreButton.addEventListener("click", async () => {
      if (busy || committed || !inspection || !confirmation.checked) return;
      if (!restoreLockAvailable) {
        setMessage("当前无法取得学习区写入锁；请关闭其他 Sufeiya 学习页、刷新后重新验证。", {
          error: true,
          focus: true,
        });
        return;
      }
      setBusy(true);
      setMessage("正在原子替换并重新核对学习工作区…", { selectedFileStatus: "恢复中 · 正在写后复核" });
      const candidateRaw = JSON.stringify(inspection.workspace);
      let outcome;
      try {
        outcome = await navigator.locks.request(`${STORAGE_KEY}:sealed-write`, { mode: "exclusive" }, () =>
          workspaceBackupRuntime.replaceWorkspaceAtomically({
            storage: window.localStorage,
            storageKey: STORAGE_KEY,
            candidateRaw,
            expectedCurrentRaw,
            validatePersisted: async (raw) => {
              try {
                const parsed = JSON.parse(raw);
                const result = await validateWorkspaceBackupCandidate(parsed);
                return {
                  ok: result.ok && workspaceBackupRuntime.canonicalJson(parsed) === workspaceBackupRuntime.canonicalJson(inspection.workspace),
                };
              } catch {
                return { ok: false };
              }
            },
          }),
        );
      } catch {
        outcome = { status: "lock_unavailable" };
      }
      if (outcome.status !== "restored") {
        const failure = outcome.status === "stale"
          ? "验证后当前学习数据发生了变化。没有覆盖新值；请重新选择并验证备份。"
          : outcome.status === "concurrent_write"
            ? "恢复核对期间当前学习数据被其他上下文修改。系统没有覆盖该新值；请刷新后重新验证。"
          : outcome.status === "rollback_failed"
            ? "恢复未能完整提交，且浏览器未能确认原值已回滚。请立即导出全部原始数据并停止继续写入。"
            : outcome.status === "lock_unavailable"
              ? "当前无法取得学习区写入锁；请关闭其他 Sufeiya 学习页、刷新后重新验证。"
              : outcome.status === "read_failed"
                ? "浏览器无法读取当前学习工作区；没有写入备份。"
                : outcome.status === "read_failed_after_write"
                  ? "写入后浏览器无法完成所有权核对。系统已停止继续操作；请立即导出原始数据并刷新核对。"
                : "恢复未能通过写后核对；原学习工作区已回滚。";
        setMessage(failure, { error: true, focus: true, selectedFileStatus: "已拒绝 · 恢复未完成" });
        setBusy(false);
        if (outcome.status === "stale") clearPreview();
        return;
      }
      const synchronization = await synchronizeJourneyRuntimeAfterWorkspaceRestore(candidateRaw);
      if (synchronization.status !== "synchronized") {
        committed = true;
        setMessage("学习工作区已写入，但本页未能同步恢复后的运行状态。为避免旧快照继续操作，正在刷新本页重新核对。", {
          error: true,
          focus: true,
          code: synchronization.status,
          selectedFileStatus: "已恢复 · 页面同步失败并即将复核",
        });
        setBusy(false);
        window.location.reload();
        return;
      }
      committed = true;
      successLink.href = inspection.validation.summary.nextRoute;
      success.hidden = false;
      setMessage("学习工作区已恢复；Sofia 对话与教研复核演示草稿未被读取或修改。", { selectedFileStatus: "已恢复 · 写后复核通过" });
      setBusy(false);
      success.focus();
    });

    clearPreview({ clearMessage: true });
  };

  const diagnosticStatusLabels = {
    completed: "已留证",
    skipped: "已跳过",
    evidence_insufficient: "证据不足",
    unavailable: "当前不可用",
    in_progress: "进行中",
  };
  const qualityFlagLabels = {
    audio_not_played: "Listening 音频未播放，答案不能作为纯听力证据。",
    audio_not_completed: "Listening 音频未完整播放，答案不能作为纯听力证据。",
    audio_seek_detected: "Listening 音频曾被拖动进度，答案不能作为连续完整播放的纯听力证据。",
    audio_playback_failed: "音频播放失败，Listening 证据需补充。",
    audio_output_unavailable: "设备预检未确认声音输出。",
    transcript_used: "使用了英文原文替代，任务不解释为纯听力证据。",
    multiple_replays: "音频播放超过两次；次数只作证据条件说明。",
    browser_voice_variability: "第二段听力由当前设备通用英文语音合成，声音会因设备而异。",
    voice_fallback_used: "设备没有匹配的本机 en-US 语音，使用了较低优先级的英文或默认语音。",
    voice_not_loaded: "设备未返回可识别语音元数据，朗读使用浏览器默认设置。",
    speech_synthesis_error: "设备语音合成在播放时出错，Listening 证据需补充。",
    learner_skipped: "学习者明确跳过了至少一项任务。",
    task_unavailable: "至少一项任务在当前设备或环境中不可用。",
    writing_paste_detected: "Writing 检测到粘贴操作，文本仍保存在本机，但需人工核对证据来源。",
    writing_ended_early: "Writing 在 3 分钟上限前提前结束。",
    writing_below_completion_condition: "Writing 少于 20 词；20 词只是完成条件，不是能力阈值。",
    speaking_ended_early: "Speaking 在 90 秒上限前提前结束。",
    self_review_incomplete: "开放作答的学习者自查未全部完成。",
    audio_not_recorded: "Speaking 未录音，无法判断发音、流利度或实际口语质量。",
    open_response_not_human_reviewed: "Writing 与 Speaking 尚未经过具备资质的人工审核。",
    resumed_after_reload: "计时任务曾刷新恢复；倒计时按绝对结束时间继续。",
  };
  const constructPatternLabels = {
    purpose_from_supporting_details: "Reading 的篇章目的任务",
    cause_from_text_structure: "Reading 的因果与信息结构任务",
    schedule_change_detail: "Listening 的日程变化任务",
    time_and_location_integration: "Listening 的时间与地点整合任务",
  };
  const terminalDiagnosticEvidence = (diagnostic) =>
    (Array.isArray(diagnostic?.taskEvidence) ? diagnostic.taskEvidence : []).filter((item) =>
      DIAGNOSTIC_TERMINAL_STATES.has(item?.status),
    );
  const diagnosticEvidenceById = (diagnostic, taskId) =>
    (Array.isArray(diagnostic?.taskEvidence) ? diagnostic.taskEvidence : []).find((item) => item?.taskId === taskId) || null;
  const replaceDiagnosticEvidence = (diagnostic, nextEvidence) => {
    const current = Array.isArray(diagnostic.taskEvidence) ? diagnostic.taskEvidence : [];
    diagnostic.taskEvidence = [...current.filter((item) => item?.taskId !== nextEvidence.taskId), nextEvidence].sort(
      (left, right) => DIAGNOSTIC_TASK_IDS.indexOf(left.taskId) - DIAGNOSTIC_TASK_IDS.indexOf(right.taskId),
    );
    diagnostic.updatedAt = isoNow();
    const cycle = activeCycle();
    if (cycle?.diagnosticSessionId === diagnostic.diagnosticSessionId) cycle.updatedAt = diagnostic.updatedAt;
  };
  const formatDiagnosticClock = (seconds) => {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };
  const diagnosticWordCount = (text) =>
    typeof text === "string" && text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const taskPanelById = (taskId) =>
    [...document.querySelectorAll("[data-diagnostic-task]")].find((panel) => panel.dataset.taskId === taskId) || null;
  const taskDescriptor = (panel) => ({
    taskId: panel.dataset.taskId,
    taskVersion: panel.dataset.taskVersion,
    skill: panel.dataset.taskSkill,
    responseType: panel.dataset.responseType,
    constructTag: panel.dataset.constructTag,
    contentHash: panel.dataset.contentHash,
  });
  const evidenceMatchesManifest = (evidence, { terminal = false } = {}) => {
    if (!isRecord(evidence)) return false;
    const expected = DIAGNOSTIC_TASK_MANIFEST[evidence.taskId];
    if (!expected) return false;
    if (!Object.entries(expected).filter(([key]) => key !== "correctValue").every(([key, value]) => evidence[key] === value)) return false;
    if (!DIAGNOSTIC_EVIDENCE_STATES.has(evidence.evidenceStatus)) return false;
    if (!Array.isArray(evidence.qualityFlags) || !evidence.qualityFlags.every((flag) => DIAGNOSTIC_QUALITY_FLAGS.has(flag))) return false;
    if (terminal && !DIAGNOSTIC_TERMINAL_STATES.has(evidence.status)) return false;
    if (!terminal && !DIAGNOSTIC_TERMINAL_STATES.has(evidence.status) && evidence.status !== "in_progress") return false;
    if (["single_choice", "single_choice_audio"].includes(expected.responseType) && evidence.status === "completed") {
      if (evidence.attempts !== 1 || !["a", "b", "c"].includes(evidence.firstResponse)) return false;
      if (evidence.resultType !== (evidence.firstResponse === expected.correctValue ? "first_response_matched" : "first_response_not_matched")) return false;
    }
    return true;
  };
  const diagnosticEvidenceCollectionValid = (diagnostic, { requireAllTerminal = false } = {}) => {
    if (!Array.isArray(diagnostic?.taskEvidence)) return false;
    const ids = diagnostic.taskEvidence.map((item) => item?.taskId);
    if (
      JSON.stringify(ids) !== JSON.stringify(DIAGNOSTIC_TASK_IDS.slice(0, ids.length)) ||
      !diagnostic.taskEvidence.every((item) => evidenceMatchesManifest(item, { terminal: requireAllTerminal }))
    ) return false;
    const firstNonTerminal = diagnostic.taskEvidence.findIndex((item) => !DIAGNOSTIC_TERMINAL_STATES.has(item.status));
    if (firstNonTerminal >= 0 && (firstNonTerminal !== diagnostic.taskEvidence.length - 1 || diagnostic.taskEvidence[firstNonTerminal].status !== "in_progress")) return false;
    const terminalCount = firstNonTerminal >= 0 ? firstNonTerminal : diagnostic.taskEvidence.length;
    if (requireAllTerminal) {
      return terminalCount === DIAGNOSTIC_TASK_IDS.length && diagnostic.activeTaskId === null;
    }
    if (diagnostic.status === "in_progress") {
      return terminalCount < DIAGNOSTIC_TASK_IDS.length && diagnostic.activeTaskId === DIAGNOSTIC_TASK_IDS[terminalCount];
    }
    return terminalCount === DIAGNOSTIC_TASK_IDS.length && diagnostic.activeTaskId === null;
  };
  const newTaskEvidence = (panel) => ({
    ...taskDescriptor(panel),
    status: "in_progress",
    evidenceStatus: "evidence_limited",
    qualityFlags: [],
    startedAt: isoNow(),
    updatedAt: isoNow(),
  });
  const hasCurrentDiagnosticShape = (diagnostic) =>
    isRecord(diagnostic) &&
    diagnostic.protocolVersion === PROTOCOL_VERSION &&
    diagnostic.diagnosticProtocolVersion === DIAGNOSTIC_PROTOCOL_VERSION &&
    diagnostic.taskSetVersion === DIAGNOSTIC_TASK_SET_VERSION &&
    diagnostic.taskSetDigest === DIAGNOSTIC_TASK_SET_DIGEST &&
    diagnostic.diagnosticSessionId === activeCycle()?.diagnosticSessionId &&
    diagnostic.cycleId === activeCycle()?.cycleId &&
    diagnosticEvidenceCollectionValid(diagnostic);
  const appendQualityFlag = (evidence, flag) => ({
    ...evidence,
    qualityFlags: unique([...(Array.isArray(evidence.qualityFlags) ? evidence.qualityFlags : []), flag]),
    updatedAt: isoNow(),
  });
  const archiveSupersededCycle = (targetState = state) => {
    const cycle = targetState.journey?.activeCycle;
    if (!cycle?.diagnosticSessionId) return { status: "not_applicable" };
    const existing = Array.isArray(targetState.journey.supersededCycles) ? targetState.journey.supersededCycles : [];
    if (existing.length >= SUPERSEDED_CYCLE_LIMIT) {
      return { status: "capacity_reached", limit: SUPERSEDED_CYCLE_LIMIT };
    }
    if (existing.some((summary) => summary?.cycleId === cycle.cycleId)) {
      return { status: "cycle_conflict" };
    }
    const diagnostic = targetState.journey.diagnostic;
    const archivedEvidence = Array.isArray(diagnostic?.taskEvidence)
      ? diagnostic.taskEvidence.map(workspaceBackupDiagnosticEvidenceSummary)
      : [];
    const receipt = {
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      protocolVersion: cycle.protocolVersion,
      diagnosticProtocolVersion: diagnostic?.diagnosticProtocolVersion || null,
      taskSetVersion: diagnostic?.taskSetVersion || null,
      taskSetDigest: diagnostic?.taskSetDigest || null,
      diagnosticStatus: diagnostic?.status || "missing",
      taskEvidenceSummary: archivedEvidence,
      ...(diagnostic?.prioritySkill ? { prioritySkill: diagnostic.prioritySkill } : {}),
      ...(diagnostic?.priorityBasis ? { priorityBasis: diagnostic.priorityBasis } : {}),
      ...(diagnostic?.evidenceSufficiency ? { evidenceSufficiency: diagnostic.evidenceSufficiency } : {}),
      status: "superseded_by_new_diagnostic",
      supersededAt: isoNow(),
      reason: "learner_started_new_gate_a_evidence_pack",
    };
    targetState.journey.supersededCycles = [...existing, receipt];
    return { status: "archived", cycleId: cycle.cycleId };
  };
  const resetDiagnosticDownstream = (targetState = state) => {
    targetState.journey.recommendation = null;
    targetState.journey.review = null;
    targetState.journey.peerHelp = null;
    targetState.journey.retest = null;
    targetState.journey.planUpdate = null;
  };
  const retireCurrentPlanForNewDiagnostic = ({ supersededAt, reason }, targetState = state) => {
    const currentPlan = targetState.plan;
    if (!currentPlan) return { status: "no_current_plan" };
    if (
      typeof currentPlan.planId !== "string" ||
      !currentPlan.planId ||
      targetState.planHistory.some((plan) => plan?.planId === currentPlan.planId)
    ) {
      return { status: "plan_history_conflict" };
    }
    targetState.planHistory = [
      ...targetState.planHistory,
      {
        ...currentPlan,
        status: "superseded",
        supersededAt,
        supersededReason: reason,
      },
    ];
    targetState.plan = null;
    return { status: "retired", planId: currentPlan.planId };
  };
  const commitNewDiagnostic = ({
    audioOutputStatus,
    mp3Supported,
    speechSupported,
    viewportMode = window.innerWidth >= 820 ? "desktop_or_tablet" : "mobile_lightweight",
    networkAtStart = navigator.onLine ? "online" : "offline",
  }) => withExclusiveJourneyWrite(async () => {
    if (!persistedStateIsFresh()) return { status: "stale" };
    const admission = enforceNextGateACycleAdmission(state, "开始下一轮");
    if (admission.status !== "ready") return admission;
    const snapshot = snapshotState();
    const candidate = snapshotState();
    const archiveOutcome = archiveSupersededCycle(candidate);
    if (!["archived", "not_applicable"].includes(archiveOutcome.status)) {
      return {
        status: archiveOutcome.status === "capacity_reached"
          ? "superseded_cycle_capacity"
          : "superseded_cycle_conflict",
      };
    }
    const diagnosticSessionId = makeId("diagnostic");
    const createdAt = isoNow();
    const retiredPlan = retireCurrentPlanForNewDiagnostic({
      supersededAt: createdAt,
      reason: "learner_started_new_gate_a_evidence_pack",
    }, candidate);
    if (retiredPlan.status === "plan_history_conflict") return retiredPlan;
    const cycle = {
      cycleId: makeId("cycle"),
      protocolVersion: PROTOCOL_VERSION,
      status: "in_progress",
      diagnosticSessionId,
      basePlanId: null,
      recommendationId: null,
      checkInId: null,
      reviewId: null,
      peerHelpId: null,
      retestId: null,
      updatedPlanId: null,
      closedAt: null,
      provisionalAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    candidate.journey.activeCycle = cycle;
    candidate.journey.diagnostic = {
      diagnosticSessionId,
      cycleId: cycle.cycleId,
      protocolVersion: PROTOCOL_VERSION,
      diagnosticProtocolVersion: DIAGNOSTIC_PROTOCOL_VERSION,
      taskSetVersion: DIAGNOSTIC_TASK_SET_VERSION,
      taskSetDigest: DIAGNOSTIC_TASK_SET_DIGEST,
      status: "in_progress",
      adultConfirmed: true,
      consent: {
        localOnlyConfirmed: true,
        noScoreConfirmed: true,
        noModelTrainingConfirmed: true,
        confirmedAt: createdAt,
      },
      demoGoal: "det_preparation_4_weeks",
      devicePrecheck: {
        storageStatus: "available",
        audioOutputStatus,
        mp3Supported,
        speechSynthesisSupported: speechSupported,
        safeWriteLockSupported: true,
        keyboardConfirmed: true,
        environmentConfirmed: true,
        microphoneMode: "not_requested",
        viewportMode,
        networkAtStart,
        completedAt: createdAt,
      },
      taskEvidence: [],
      activeTaskId: DIAGNOSTIC_TASK_IDS[0],
      automatedScoreProduced: false,
      formalDiagnosisProduced: false,
      officialEquivalenceClaimed: false,
      createdAt,
      updatedAt: createdAt,
    };
    resetDiagnosticDownstream(candidate);
    const eventOutcome = await appendLearningEvent("learning_cycle.started", {
      cycle,
      diagnostic: candidate.journey.diagnostic,
    }, candidate);
    if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
      return { status: eventOutcome.status, code: eventOutcome.code };
    }
    const candidateCapacity = workspaceCandidateCapacity(candidate);
    if (candidateCapacity.status !== "ready") return candidateCapacity;
    state = candidate;
    if (!persist()) {
      state = snapshot;
      return { status: "persist_failed" };
    }
    return { status: "saved" };
  });
  const buildDiagnosticReport = (diagnostic) => {
    const taskEvidence = terminalDiagnosticEvidence(diagnostic);
    const bySkill = (skill) => taskEvidence.filter((item) => item.skill === skill);
    const reading = bySkill("Reading");
    const listening = bySkill("Listening");
    const speaking = bySkill("Speaking")[0] || null;
    const writing = bySkill("Writing")[0] || null;
    const readingCompleted = reading.filter((item) => item.status === "completed");
    const listeningCompleted = listening.filter((item) => item.status === "completed");
    const listeningInterpretable = listeningCompleted.filter(
      (item) => !item.qualityFlags?.some((flag) => ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "speech_synthesis_error", "audio_output_unavailable", "transcript_used"].includes(flag)),
    );
    const readingMatched = readingCompleted.filter((item) => item.resultType === "first_response_matched").length;
    const listeningMatched = listeningInterpretable.filter((item) => item.resultType === "first_response_matched").length;
    const readingMissed = readingCompleted.filter((item) => item.resultType === "first_response_not_matched").length;
    const listeningMissed = listeningInterpretable.filter((item) => item.resultType === "first_response_not_matched").length;
    const speakingChecks = Number(speaking?.selfReviewCount || 0);
    const writingChecks = Number(writing?.selfReviewCount || 0);
    const writingWords = Number(writing?.wordCount || 0);
    const allSixTerminal = taskEvidence.length === DIAGNOSTIC_TASK_IDS.length;
    const coverageComplete =
      allSixTerminal &&
      readingCompleted.length === 2 &&
      listeningInterpretable.length === 2 &&
      speaking?.status === "completed" &&
      speaking?.timerCompleted === true &&
      speakingChecks === 3 &&
      writing?.status === "completed" &&
      writing?.timerCompleted === true &&
      writingWords >= 20 &&
      writingChecks === 3 &&
      !writing?.qualityFlags?.includes("writing_paste_detected");
    const evidenceSufficiency = coverageComplete ? "evidence_limited" : "evidence_insufficient";
    const confidence = coverageComplete ? "medium" : "low";
    const completedEvidence = taskEvidence.filter((item) => item.status === "completed");
    const completedEvidenceSkills = unique(completedEvidence.map((item) => item.skill));

    let priorityCandidates;
    let priorityBasis;
    let priorityExplanation;
    const objectiveEvidenceGaps = [];
    const openResponseGaps = [];
    if (readingCompleted.length < 2) objectiveEvidenceGaps.push("Reading");
    if (listeningInterpretable.length < 2) objectiveEvidenceGaps.push("Listening");
    if (
      writing?.status !== "completed" ||
      writing?.timerCompleted !== true ||
      writingWords < 20 ||
      writingChecks < 3 ||
      writing?.qualityFlags?.includes("writing_paste_detected")
    ) openResponseGaps.push("Writing");
    if (speaking?.status !== "completed" || speaking?.timerCompleted !== true || speakingChecks < 3) openResponseGaps.push("Speaking");
    const evidenceGapCandidates = unique([...objectiveEvidenceGaps, ...openResponseGaps]);

    if (completedEvidence.length === 0) {
      priorityCandidates = ["Reading", "Listening", "Writing", "Speaking"];
      priorityBasis = "learner_confirmation_after_multiple_gaps";
      priorityExplanation = "本轮没有形成任何完成证据；系统不据此判断能力，请由你选择下一条先补证的任务方向。";
    } else if (evidenceGapCandidates.length > 1) {
      priorityCandidates = evidenceGapCandidates;
      priorityBasis = "learner_confirmation_after_multiple_gaps";
      priorityExplanation = `${evidenceGapCandidates.map((skill) => skillLabels[skill]).join("、")} 同时存在任务缺项、证据质量或开放作答覆盖缺口；系统不使用隐藏排序，请由你确认先补哪一项。`;
    } else if (objectiveEvidenceGaps.length === 1) {
      priorityCandidates = objectiveEvidenceGaps;
      priorityBasis = "evidence_quality_gap";
      priorityExplanation = objectiveEvidenceGaps[0] === "Reading"
        ? "Reading 有任务被跳过或未形成可解释首答，因此先补一条阅读证据比推断能力更稳妥。"
        : "Listening 有音频未播放完、播放失败或使用原文替代的情况，因此先补纯听力证据。";
    } else if (openResponseGaps.length === 1) {
      priorityCandidates = openResponseGaps;
      priorityBasis = "open_response_coverage_gap";
      priorityExplanation = openResponseGaps[0] === "Writing"
        ? "Writing 的 3 分钟计时、独立输入条件或自查仍不完整；先补一条写作证据。"
        : "Speaking 的计时或自查仍不完整；先补一条口语任务证据。";
    } else if (readingMissed > listeningMissed) {
      priorityCandidates = ["Reading"];
      priorityBasis = "objective_first_response_pattern";
      priorityExplanation = "两项 Reading 的首答未匹配次数多于两项可解释 Listening；这只决定下一条练习，不是能力等级。";
    } else if (listeningMissed > readingMissed) {
      priorityCandidates = ["Listening"];
      priorityBasis = "objective_first_response_pattern";
      priorityExplanation = "两项可解释 Listening 的首答未匹配次数多于 Reading；这只决定下一条练习，不是能力等级。";
    } else {
      priorityCandidates = ["Reading", "Listening"];
      priorityBasis = "learner_confirmation_after_tie";
      priorityExplanation = "Reading 与可解释 Listening 的首答模式并列，系统不使用隐藏排序；请结合自己的近期任务选择一个先练方向。";
    }

    const patterns = [];
    for (const item of [...readingCompleted, ...listeningInterpretable]) {
      if (item.resultType === "first_response_not_matched") {
        patterns.push(`${constructPatternLabels[item.constructTag] || `${item.skill} 客观任务`}的第一次选择未与预设答案一致。`);
      }
    }
    if (!patterns.length && readingCompleted.length === 2 && listeningInterpretable.length === 2) {
      patterns.push("四项可解释客观任务的第一次选择均与预设答案一致；这仍不足以推出稳定能力或 DET 分数。");
    }
    if (completedEvidence.length === 0) {
      patterns.push("本轮六项任务均被记录为跳过、不可用或证据不足，没有形成可解释的完成证据；缺失不按零分处理。");
    }
    patterns.push(
      writing?.status === "completed"
        ? `Writing 留下 ${writingWords} 个英文词与 ${writingChecks} / 3 项自查；没有自动语言评价。`
        : "Writing 未形成完成证据；缺失不按零分处理，也不推断写作能力。",
    );
    patterns.push(
      speaking?.status === "completed"
        ? `Speaking 记录 ${Number(speaking.durationSeconds || 0)} 秒计时与 ${speakingChecks} / 3 项自查；没有录音。`
        : "Speaking 未形成完成证据；缺失不按零分处理，也不推断口语能力。",
    );

    const qualityFlags = unique(taskEvidence.flatMap((item) => (Array.isArray(item.qualityFlags) ? item.qualityFlags : [])));
    const quality = qualityFlags.map((flag) => qualityFlagLabels[flag] || `证据质量标记：${flag}`);
    quality.push(
      confidence === "medium"
        ? "中等只表示本轮六项任务覆盖较完整，不表示语言能力达到中等或任何官方等级。"
        : "低置信度表示本轮任务覆盖或证据条件仍有缺口；缺失不按零分处理。",
    );

    return {
      evidenceSufficiency,
      confidence,
      completedEvidenceTaskCount: completedEvidence.length,
      completedEvidenceSkills,
      priorityCandidates,
      priorityBasis,
      priorityExplanation,
      patterns,
      quality,
      skills: {
        Reading: {
          label: "Reading · 阅读",
          headline: `${readingCompleted.length} / 2 项已留首答`,
          detail: `${readingMatched} 项首答与预设答案一致；只解释本次任务。`,
        },
        Listening: {
          label: "Listening · 听力",
          headline: `${listeningInterpretable.length} / 2 项可作纯听力证据`,
          detail: `${listeningMatched} 项可解释首答与预设答案一致；原文替代另行标记。`,
        },
        Speaking: {
          label: "Speaking · 口语",
          headline: speaking?.status === "completed" ? `${Number(speaking.durationSeconds || 0)} 秒计时已留证` : "未形成完整计时证据",
          detail: speaking?.status === "completed"
            ? `自查 ${speakingChecks} / 3；不录音，不评价发音或流利度。`
            : "跳过、不可用或未满足完成条件；缺失不按零分处理。",
        },
        Writing: {
          label: "Writing · 写作",
          headline: writing?.status === "completed" ? `${writingWords} 词本机作答` : "未形成写作完成证据",
          detail: writing?.status === "completed"
            ? `自查 ${writingChecks} / 3；未经人工审核，不评价语言水平。`
            : "跳过、不可用或未满足完成条件；缺失不按零分处理。",
        },
      },
    };
  };

  let diagnosticTimerId = null;
  let diagnosticWritingSaveTimer = null;
  let diagnosticSpeechToken = null;
  let diagnosticVoices = [];
  let diagnosticNextCycleIntent = false;
  const diagnosticAudioPositions = new WeakMap();
  const clearDiagnosticTimer = () => {
    window.clearInterval(diagnosticTimerId);
    diagnosticTimerId = null;
  };
  const stopDiagnosticPlayback = () => {
    document.querySelectorAll("[data-diagnostic-audio]").forEach((audio) => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Some browsers do not allow seeking until metadata is available.
      }
    });
    diagnosticSpeechToken = null;
    window.speechSynthesis?.cancel();
  };
  const focusDiagnosticTarget = (target) => {
    window.requestAnimationFrame(() => {
      target?.focus?.({ preventScroll: true });
      target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  };

  const ensureActiveTaskEvidence = (diagnostic, panel) => {
    const existing = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
    if (existing) return existing;
    const evidence = newTaskEvidence(panel);
    replaceDiagnosticEvidence(diagnostic, evidence);
    persist();
    return evidence;
  };

  const completeDiagnosticTask = (diagnostic, evidence) => {
    const before = snapshotState();
    replaceDiagnosticEvidence(diagnostic, evidence);
    stopDiagnosticPlayback();
    const nextTaskId = DIAGNOSTIC_TASK_IDS.find((taskId) =>
      !DIAGNOSTIC_TERMINAL_STATES.has(diagnosticEvidenceById(diagnostic, taskId)?.status),
    );
    if (nextTaskId) {
      diagnostic.activeTaskId = nextTaskId;
    } else {
      diagnostic.status = "awaiting_confirmation";
      diagnostic.reportDraft = buildDiagnosticReport(diagnostic);
      diagnostic.activeTaskId = null;
    }
    if (!persist()) {
      state = before;
      renderDiagnostic();
      return false;
    }
    renderDiagnostic();
    const target = diagnostic.status === "awaiting_confirmation"
      ? document.querySelector("#report-title")
      : document.querySelector("[data-diagnostic-task]:not([hidden]) h3");
    focusDiagnosticTarget(target);
    return true;
  };

  const syncDiagnosticTimer = () => {
    const diagnostic = state.journey.diagnostic;
    if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.status !== "in_progress") {
      clearDiagnosticTimer();
      return;
    }
    const panel = taskPanelById(diagnostic.activeTaskId);
    const evidence = panel ? diagnosticEvidenceById(diagnostic, panel.dataset.taskId) : null;
    if (!panel || !evidence || !["Speaking", "Writing"].includes(panel.dataset.taskSkill)) {
      clearDiagnosticTimer();
      return;
    }
    const timer = isRecord(evidence.timer) ? evidence.timer : null;
    if (!timer) return;
    const now = Date.now();
    const timerValue = panel.querySelector("[data-diagnostic-timer]");
    const timerState = panel.querySelector("[data-diagnostic-timer-state]");

    if (panel.dataset.taskSkill === "Speaking") {
      const prepEndsAt = Number(timer.prepEndsAt || 0);
      const responseEndsAt = Number(timer.responseEndsAt || 0);
      const startButton = panel.querySelector("[data-speaking-start]");
      const finishButton = panel.querySelector("[data-speaking-finish]");
      const reviewWrap = panel.querySelector("[data-speaking-review-wrap]");
      const submitWrap = panel.querySelector("[data-speaking-submit-wrap]");
      const skipWrap = panel.querySelector("[data-speaking-skip-wrap]");
      if (now < prepEndsAt) {
        if (timerValue) timerValue.textContent = formatDiagnosticClock((prepEndsAt - now) / 1000);
        if (timerState) timerState.textContent = "准备时间";
        if (startButton) startButton.disabled = true;
        if (finishButton) finishButton.hidden = true;
      } else if (now < responseEndsAt && !timer.endedAt) {
        if (timer.phase !== "response") {
          const next = { ...evidence, timer: { ...timer, phase: "response" }, updatedAt: isoNow() };
          replaceDiagnosticEvidence(diagnostic, next);
          persist();
          const announcement = panel.querySelector("[data-diagnostic-timer-announcement]");
          if (announcement) announcement.textContent = "准备时间结束。现在开始 90 秒英文回答。";
        }
        if (timerValue) timerValue.textContent = formatDiagnosticClock((responseEndsAt - now) / 1000);
        if (timerState) timerState.textContent = "请开始大声回答";
        if (startButton) startButton.disabled = true;
        if (finishButton) finishButton.hidden = false;
      } else {
        const enteringReview = timer.phase !== "review";
        const durationSeconds = timer.endedAt
          ? Math.max(0, Math.min(Number(panel.dataset.responseSeconds), Math.round((Number(timer.endedAt) - prepEndsAt) / 1000)))
          : Number(panel.dataset.responseSeconds);
        const next = {
          ...evidence,
          timer: { ...timer, phase: "review", endedAt: timer.endedAt || now },
          durationSeconds,
          timerCompleted: durationSeconds >= Number(panel.dataset.responseSeconds),
          updatedAt: isoNow(),
        };
        replaceDiagnosticEvidence(diagnostic, next);
        persist();
        if (timerValue) timerValue.textContent = "00:00";
        if (timerState) timerState.textContent = "计时结束，请完成自查";
        if (startButton) startButton.hidden = true;
        if (finishButton) finishButton.hidden = true;
        if (reviewWrap) reviewWrap.hidden = false;
        if (submitWrap) submitWrap.hidden = false;
        if (skipWrap) skipWrap.hidden = true;
        clearDiagnosticTimer();
        if (enteringReview) {
          const announcement = panel.querySelector("[data-diagnostic-timer-announcement]");
          if (announcement) announcement.textContent = "口语计时结束，请完成三项自查。";
          focusDiagnosticTarget(panel.querySelector("[data-speaking-review]"));
        }
      }
      return;
    }

    const endsAt = Number(timer.endsAt || 0);
    const textarea = panel.querySelector("[data-diagnostic-writing-answer]");
    const workspace = panel.querySelector("[data-writing-workspace]");
    const startWrap = panel.querySelector("[data-writing-start-wrap]");
    const reviewWrap = panel.querySelector("[data-writing-review-wrap]");
    const submitWrap = panel.querySelector("[data-writing-submit-wrap]");
    const skipWrap = panel.querySelector("[data-writing-skip-wrap]");
    if (now < endsAt && timer.phase === "running") {
      if (timerValue) timerValue.textContent = formatDiagnosticClock((endsAt - now) / 1000);
      if (timerState) timerState.textContent = "写作计时中";
      if (workspace) workspace.hidden = false;
      if (startWrap) startWrap.hidden = true;
      if (textarea) textarea.disabled = false;
      return;
    }
    const enteringReview = timer.phase === "running";
    if (enteringReview) {
      const next = {
        ...evidence,
        timer: { ...timer, phase: "review", endedAt: now },
        durationSeconds: Number(panel.dataset.responseSeconds),
        timerCompleted: true,
        updatedAt: isoNow(),
      };
      replaceDiagnosticEvidence(diagnostic, next);
      persist();
    }
    if (timerValue) timerValue.textContent = "00:00";
    if (timerState) timerState.textContent = "写作结束，请完成自查";
    if (workspace) workspace.hidden = false;
    if (startWrap) startWrap.hidden = true;
    if (textarea) textarea.disabled = true;
    if (reviewWrap) reviewWrap.hidden = false;
    if (submitWrap) submitWrap.hidden = false;
    if (skipWrap) skipWrap.hidden = true;
    clearDiagnosticTimer();
    if (enteringReview) focusDiagnosticTarget(panel.querySelector("[data-writing-review]"));
  };

  const scheduleDiagnosticTimer = () => {
    clearDiagnosticTimer();
    syncDiagnosticTimer();
    const diagnostic = state.journey.diagnostic;
    const evidence = hasCurrentDiagnosticShape(diagnostic)
      ? diagnosticEvidenceById(diagnostic, diagnostic.activeTaskId)
      : null;
    if (["running", "prep", "response"].includes(evidence?.timer?.phase)) {
      diagnosticTimerId = window.setInterval(syncDiagnosticTimer, 250);
    }
  };

  const renderDiagnosticReport = (diagnostic) => {
    const report = diagnostic.reportDraft || diagnostic.report;
    if (!report) return;
    setText("[data-report-confidence]", report.confidence === "medium" ? "中等证据覆盖置信度" : "低证据覆盖置信度");
    setText(
      "[data-report-summary]",
      `六项任务已有 ${terminalDiagnosticEvidence(diagnostic).length} 项终态，其中 ${report.completedEvidenceTaskCount} 项形成完成证据。报告只描述本次任务条件，不输出能力等级或官方分数。`,
    );
    setText("[data-diagnostic-sufficiency]", report.evidenceSufficiency === "evidence_limited" ? "证据有限，可用于行动规划" : "证据不足，需要补充");
    const evidenceGrid = document.querySelector("[data-report-evidence]");
    clearChildren(evidenceGrid);
    for (const skill of ["Reading", "Listening", "Speaking", "Writing"]) {
      const summary = report.skills?.[skill];
      if (!summary) continue;
      const card = document.createElement("article");
      card.className = "diagnostic-evidence-card";
      const overline = document.createElement("span");
      overline.textContent = skill.toUpperCase();
      const heading = document.createElement("h4");
      heading.textContent = summary.label;
      const headline = document.createElement("strong");
      headline.textContent = summary.headline;
      const detail = document.createElement("p");
      detail.textContent = summary.detail;
      card.append(overline, heading, headline, detail);
      evidenceGrid?.append(card);
    }
    for (const [selector, values] of [["[data-report-patterns]", report.patterns], ["[data-report-quality]", report.quality]]) {
      const list = document.querySelector(selector);
      clearChildren(list);
      for (const value of values || []) {
        const item = document.createElement("li");
        item.textContent = value;
        list?.append(item);
      }
    }
    setText("[data-priority-explanation]", report.priorityExplanation);
    const priorityOptions = document.querySelector("[data-priority-options]");
    clearChildren(priorityOptions);
    priorityOptions?.classList.add("diagnostic-priority-options");
    for (const skill of report.priorityCandidates || []) {
      const label = document.createElement("label");
      label.className = "diagnostic-priority-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "prioritySkill";
      input.value = skill;
      input.checked = diagnostic.prioritySkill === skill || (!diagnostic.prioritySkill && report.priorityCandidates.length === 1);
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = skillLabels[skill];
      const note = document.createElement("small");
      note.textContent = report.completedEvidenceTaskCount === 0
        ? "没有完成证据，由你选择下一条补证任务"
        : report.priorityCandidates.length > 1
          ? "存在多个证据缺口，由你确认先后顺序"
          : priorityBasisLabels[report.priorityBasis] || "下一条证据优先项";
      copy.append(title, note);
      label.append(input, copy);
      priorityOptions?.append(label);
    }
    const priorityForm = document.querySelector("#diagnostic-priority-form");
    const result = document.querySelector("[data-diagnostic-result]");
    const finalized = diagnostic.status === "completed";
    if (priorityForm) priorityForm.hidden = finalized;
    if (result) result.hidden = !finalized;
    if (finalized) {
      setText("[data-diagnostic-id]", diagnostic.diagnosticSessionId);
      setText(
        "[data-diagnostic-result-copy]",
        diagnostic.completedEvidenceTaskCount === 0
          ? `本轮没有形成完成证据；学习者只选择下一步先补 ${skillLabels[diagnostic.prioritySkill]} 的任务证据。这不是自动能力诊断，缺失不按零分处理。`
          : `已形成 ${diagnostic.completedEvidenceTaskCount} 项完成证据，并由学习者确认下一步先关注 ${skillLabels[diagnostic.prioritySkill]}。这不是自动能力诊断。`,
      );
      setText("[data-diagnostic-receipt-sufficiency]", diagnostic.evidenceSufficiency === "evidence_limited" ? "evidence_limited · 证据有限" : "evidence_insufficient · 证据不足");
      setText("[data-diagnostic-priority]", skillLabels[diagnostic.prioritySkill]);
    }
  };

  const renderDiagnostic = () => {
    const app = document.querySelector("[data-diagnostic-app]");
    if (!app) return;
    const preflight = document.querySelector("[data-diagnostic-preflight]");
    const runner = document.querySelector("[data-diagnostic-runner]");
    const reportNode = document.querySelector("[data-diagnostic-report]");
    const diagnostic = state.journey.diagnostic;
    if (diagnosticNextCycleIntent && hasCurrentDiagnosticShape(diagnostic)) {
      if (preflight) preflight.hidden = false;
      if (runner) runner.hidden = true;
      if (reportNode) reportNode.hidden = true;
      setText("[data-diagnostic-status]", "准备下一轮 · 尚未写入");
      clearDiagnosticTimer();
      return;
    }
    if (!hasCurrentDiagnosticShape(diagnostic)) {
      if (preflight) preflight.hidden = false;
      if (runner) runner.hidden = true;
      if (reportNode) reportNode.hidden = true;
      setText("[data-diagnostic-status]", "尚未开始");
      clearDiagnosticTimer();
      return;
    }
    const showReport = ["awaiting_confirmation", "completed"].includes(diagnostic.status);
    if (preflight) preflight.hidden = true;
    if (runner) runner.hidden = showReport;
    if (reportNode) reportNode.hidden = !showReport;
    setText(
      "[data-diagnostic-status]",
      diagnostic.status === "completed" ? "证据报告已确认" : showReport ? "等待确认优先项" : "六项任务进行中",
    );
    if (showReport) {
      renderDiagnosticReport(diagnostic);
      clearDiagnosticTimer();
      return;
    }

    const completed = terminalDiagnosticEvidence(diagnostic);
    const completedIds = new Set(completed.map((item) => item.taskId));
    const activeTaskId = DIAGNOSTIC_TASK_IDS.includes(diagnostic.activeTaskId)
      ? diagnostic.activeTaskId
      : DIAGNOSTIC_TASK_IDS.find((taskId) => !completedIds.has(taskId));
    diagnostic.activeTaskId = activeTaskId;
    document.querySelectorAll("[data-diagnostic-step]").forEach((step) => {
      const evidence = diagnosticEvidenceById(diagnostic, step.dataset.diagnosticStep);
      step.classList.toggle("is-complete", DIAGNOSTIC_TERMINAL_STATES.has(evidence?.status));
      step.classList.toggle("is-current", step.dataset.diagnosticStep === activeTaskId);
      if (step.dataset.diagnosticStep === activeTaskId) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      const label = step.querySelector("[data-step-state]");
      if (label) label.textContent = diagnosticStatusLabels[evidence?.status] || (step.dataset.diagnosticStep === activeTaskId ? "当前任务" : "待开始");
    });
    const activeIndex = Math.max(0, DIAGNOSTIC_TASK_IDS.indexOf(activeTaskId));
    const percent = Math.round((completed.length / DIAGNOSTIC_TASK_IDS.length) * 100);
    setText("[data-diagnostic-progress-label]", `任务 ${activeIndex + 1} / ${DIAGNOSTIC_TASK_IDS.length}`);
    setText("[data-diagnostic-progress-percent]", `${percent}%`);
    const progress = document.querySelector("[data-diagnostic-progress]");
    if (progress) {
      progress.value = completed.length;
      progress.textContent = `${completed.length} / ${DIAGNOSTIC_TASK_IDS.length}`;
    }
    document.querySelectorAll("[data-diagnostic-task]").forEach((panel) => {
      panel.hidden = panel.dataset.taskId !== activeTaskId;
    });
    const activePanel = taskPanelById(activeTaskId);
    if (!activePanel) return;
    const evidence = ensureActiveTaskEvidence(diagnostic, activePanel);
    const taskState = activePanel.querySelector("[data-task-state]");
    if (taskState) taskState.textContent = diagnosticStatusLabels[evidence.status] || "进行中";
    const taskMessage = activePanel.querySelector("[data-task-message]");
    if (taskMessage) taskMessage.textContent = "第一次提交后会封存；本轮结束前不显示逐题答案。";
    const selectedDraft = evidence.selectedDraft;
    if (selectedDraft) {
      const option = activePanel.querySelector(`input[type="radio"][value="${selectedDraft}"]`);
      if (option) option.checked = true;
    }
    const submit = activePanel.querySelector("[data-diagnostic-submit-task]");
    if (submit) submit.disabled = !activePanel.querySelector("input[type=radio]:checked");
    const writing = activePanel.querySelector("[data-diagnostic-writing-answer]");
    if (writing && typeof evidence.responseText === "string" && writing.value !== evidence.responseText) writing.value = evidence.responseText;
    setText("[data-diagnostic-word-count]", diagnosticWordCount(evidence.responseText));
    activePanel.querySelectorAll("[data-speaking-review]").forEach((box) => {
      box.checked = Boolean(evidence.selfChecks?.[box.dataset.speakingReview]);
    });
    activePanel.querySelectorAll("[data-writing-review]").forEach((box) => {
      box.checked = Boolean(evidence.selfChecks?.[box.dataset.writingReview]);
    });
    scheduleDiagnosticTimer();
  };

  const setupDiagnostic = () => {
    const app = document.querySelector("[data-diagnostic-app]");
    if (!app) return;
    if (
      app.dataset.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      app.dataset.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      [...document.querySelectorAll("[data-diagnostic-task]")].some((panel) => {
        const expected = DIAGNOSTIC_TASK_MANIFEST[panel.dataset.taskId];
        const actual = taskDescriptor(panel);
        return !expected ||
          !Object.entries(expected).filter(([key]) => key !== "correctValue").every(([key, value]) => actual[key] === value) ||
          (["single_choice", "single_choice_audio"].includes(expected.responseType) && panel.dataset.correctValue !== expected.correctValue);
      })
    ) {
      showStorageWarning("诊断任务清单与运行时版本不一致；为避免形成错误回执，本页已停止写入。请刷新或联系维护者。");
      disableJourneyControls();
      return;
    }
    const startForm = document.querySelector("#diagnostic-start-form");
    const priorityForm = document.querySelector("#diagnostic-priority-form");
    const message = document.querySelector("[data-diagnostic-message]");
    const intentParams = new URLSearchParams(window.location.search);
    const nextCycleIntentRequested =
      intentParams.getAll("intent").length === 1 && intentParams.get("intent") === "next-cycle";
    const storageAvailable = (() => {
      if (!storageWritable) return false;
      const probeKey = `sufeiya_storage_probe_${Date.now()}`;
      try {
        window.localStorage.setItem(probeKey, "1");
        window.localStorage.removeItem(probeKey);
        return true;
      } catch {
        return false;
      }
    })();
    const audioProbe = document.createElement("audio");
    const mp3Supported = Boolean(audioProbe.canPlayType?.("audio/mpeg"));
    const speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    const safeWriteLockSupported = Boolean(navigator.locks?.request);
    const refreshDiagnosticVoices = () => {
      diagnosticVoices = speechSupported ? window.speechSynthesis.getVoices() : [];
    };
    refreshDiagnosticVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", refreshDiagnosticVoices);
    const restoredDiagnostic = state.journey.diagnostic;
    if (nextCycleIntentRequested && hasCurrentDiagnosticShape(restoredDiagnostic)) {
      const admission = inspectNextGateACycleAdmission(state);
      if (admission.status === "ready") {
        diagnosticNextCycleIntent = true;
        if (message) message.textContent = "下一轮设备预检已打开；当前诊断、计划、历史与事件尚未改写。完成确认并提交后，才会原子建立新一轮。";
      } else {
        presentCapacityFailure(admission, "准备下一轮");
      }
    }
    if (hasCurrentDiagnosticShape(restoredDiagnostic) && restoredDiagnostic.status === "in_progress") {
      const restoredEvidence = diagnosticEvidenceById(restoredDiagnostic, restoredDiagnostic.activeTaskId);
      if (restoredEvidence?.timer?.startedAt && !restoredEvidence.qualityFlags?.includes("resumed_after_reload")) {
        replaceDiagnosticEvidence(restoredDiagnostic, appendQualityFlag(restoredEvidence, "resumed_after_reload"));
        persist();
      }
    }
    const updateDeviceCopy = () => {
      setText("[data-device-storage]", storageAvailable ? "可用 · 本机保存" : "不可用 · 无法留回执");
      setText("[data-device-mp3]", mp3Supported ? "支持" : "未检测到支持");
      setText("[data-device-speech]", speechSupported ? "支持本机合成" : "不可用 · 可看原文");
      setText("[data-device-lock]", safeWriteLockSupported ? "支持 · 防跨页覆盖" : "不支持 · 无法开始闭环");
      setText("[data-device-viewport]", window.innerWidth >= 820 ? "桌面/平板完整模式" : "手机轻量模式");
      setText("[data-device-network]", navigator.onLine ? "页面已连接" : "当前离线");
    };
    updateDeviceCopy();
    window.addEventListener("resize", updateDeviceCopy);
    window.addEventListener("online", updateDeviceCopy);
    window.addEventListener("offline", updateDeviceCopy);

    document.querySelector("[data-audio-test]")?.addEventListener("click", async () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        if (message) message.textContent = "当前浏览器无法播放测试音；请选择“当前听不到”后继续。";
        return;
      }
      try {
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 440;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.82);
        oscillator.addEventListener("ended", () => context.close());
        if (message) message.textContent = "测试音已播放，请选择你是否听到。";
      } catch {
        if (message) message.textContent = "测试音未能播放；请选择“当前听不到”后继续。";
      }
    });

    startForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!storageAvailable) {
        if (message) message.textContent = "当前浏览器无法安全写入本机数据，因此不能生成可追踪诊断回执。请调整隐私设置或使用其他浏览器。";
        message?.focus();
        return;
      }
      if (!safeWriteLockSupported) {
        if (message) message.textContent = "当前浏览器不支持安全本机写入锁，因此不能开始闭环。请升级到支持 Web Locks 的现代浏览器后重试。";
        message?.focus();
        return;
      }
      const requiredChecks = ["adultConfirmed", "localBoundaryConfirmed", "noScoreConfirmed", "environmentConfirmed"];
      const missing = requiredChecks.find((name) => !startForm.elements[name]?.checked);
      if (missing) {
        if (message) message.textContent = "请完成 18+、本机数据、非评分和环境四项确认。";
        startForm.elements[missing]?.focus();
        return;
      }
      if (!String(startForm.elements.keyboardCheck?.value || "").trim()) {
        if (message) message.textContent = "请在键盘预检框输入任意字符。输入内容不会保存。";
        startForm.elements.keyboardCheck?.focus();
        return;
      }
      const audioOutputStatus = startForm.elements.audioOutput?.value;
      if (!['heard', 'unavailable'].includes(audioOutputStatus)) {
        if (message) message.textContent = "请完成声音输出预检；听不到也可以明确选择文本替代。";
        startForm.querySelector('input[name="audioOutput"]')?.focus();
        return;
      }
      const previousCycle = activeCycle();
      const hasDownstream = previousCycle && [previousCycle.basePlanId, previousCycle.recommendationId, previousCycle.checkInId, previousCycle.reviewId, previousCycle.peerHelpId, previousCycle.retestId].some(Boolean);
      if (hasDownstream) {
        const confirmationCopy = ["completed", "provisional_pending_human_review"].includes(previousCycle.status)
          ? "开始新一轮诊断会把当前轮与计划保留为只读历史，再建立新的本机轮次；不会复制作文原文、首答或打卡自由文本。确定继续吗？"
          : "开始新一轮诊断会关闭当前未完成闭环的后续连接，并仅归档不含作文原文或首答内容的证据摘要；当前计划将作为历史保留，不再显示为当前计划。确定继续吗？";
        if (!window.confirm(confirmationCopy)) return;
      }
      const outcome = await commitNewDiagnostic({
        audioOutputStatus,
        mp3Supported,
        speechSupported,
      });
      if (outcome.status !== "saved") {
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁，新诊断会话未建立。"
          : outcome.status === "capacity_invalid"
            ? invalidCapacityMessage("新诊断会话")
            : outcome.status === "capacity_reached"
              ? capacityFailureMessage("新诊断会话", outcome)
          : outcome.status === "superseded_cycle_capacity"
            ? `本机已保留 ${SUPERSEDED_CYCLE_LIMIT} 轮中止诊断摘要；${capacityFailureMessage("本次新诊断")}`
            : outcome.status === "superseded_cycle_conflict"
              ? "当前轮次标识已出现在中止摘要中；为避免覆盖，本次新诊断已停止。请先导出本机数据后核对。"
          : outcome.status === "persist_failed"
            ? "当前无法保存，新诊断会话未建立，原本机记录保持不变。"
            : outcome.status === "plan_history_conflict"
              ? "当前计划与历史计划出现重复标识；为避免覆盖，本次新诊断未建立。请先导出本机数据后再处理。"
            : outcome.status === "stale"
              ? "本机记录已在另一个页面发生变化；新诊断会话未建立，请刷新后重试。"
              : "学习事件链未通过核对；新诊断会话未建立。";
        return;
      }
      startForm.reset();
      diagnosticNextCycleIntent = false;
      renderDiagnostic();
      focusDiagnosticTarget(document.querySelector("[data-diagnostic-task]:not([hidden]) h3"));
    });

    document.querySelectorAll("[data-diagnostic-task]").forEach((panel) => {
      panel.querySelectorAll("input[type=radio]").forEach((option) => {
        option.addEventListener("change", () => {
          const diagnostic = state.journey.diagnostic;
          if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
          const evidence = ensureActiveTaskEvidence(diagnostic, panel);
          replaceDiagnosticEvidence(diagnostic, { ...evidence, selectedDraft: option.value, updatedAt: isoNow() });
          persist();
          const submit = panel.querySelector("[data-diagnostic-submit-task]");
          if (submit) submit.disabled = false;
        });
      });
      panel.querySelector("[data-diagnostic-submit-task]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const selected = panel.querySelector("input[type=radio]:checked");
        if (!selected) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        const flags = [...(current.qualityFlags || [])];
        if (panel.dataset.taskSkill === "Listening") {
          if (!current.audioPlayed) flags.push("audio_not_played");
          if (current.audioPlayed && !current.audioCompleted) flags.push("audio_not_completed");
          if (current.audioSeekDetected) flags.push("audio_seek_detected");
          if (current.audioPlaybackFailed) flags.push("audio_playback_failed");
          if (diagnostic.devicePrecheck?.audioOutputStatus !== "heard") flags.push("audio_output_unavailable");
          if (current.transcriptUsed) flags.push("transcript_used");
          if (Number(current.playCount || 0) > 2) flags.push("multiple_replays");
          if (panel.dataset.audioMode === "browser_speech_synthesis") flags.push("browser_voice_variability");
        }
        const completedAt = isoNow();
        const durationSeconds = Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(current.startedAt)) / 1000));
        const next = {
          ...current,
          status: "completed",
          evidenceStatus: flags.some((flag) => ["audio_not_played", "audio_not_completed", "audio_seek_detected", "audio_playback_failed", "speech_synthesis_error", "audio_output_unavailable", "transcript_used"].includes(flag)) ? "evidence_insufficient" : "evidence_limited",
          firstResponse: selected.value,
          selectedDraft: undefined,
          resultType: selected.value === panel.dataset.correctValue ? "first_response_matched" : "first_response_not_matched",
          attempts: 1,
          durationSeconds,
          qualityFlags: unique(flags),
          completedAt,
          updatedAt: completedAt,
        };
        completeDiagnosticTask(diagnostic, next);
      });
      panel.querySelectorAll("[data-diagnostic-skip-task]").forEach((button) => {
        button.addEventListener("click", () => {
          const diagnostic = state.journey.diagnostic;
          if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
          if (!window.confirm("确定把这项任务记录为跳过或当前不可用吗？它不会被记作零分，但报告会显示证据不足。")) return;
          const current = ensureActiveTaskEvidence(diagnostic, panel);
          const unavailable = panel.dataset.taskSkill === "Listening" && (diagnostic.devicePrecheck?.audioOutputStatus === "unavailable" || current.audioPlaybackFailed);
          const completedAt = isoNow();
          const flags = unique([...(current.qualityFlags || []), unavailable ? "task_unavailable" : "learner_skipped"]);
          completeDiagnosticTask(diagnostic, {
            ...current,
            status: unavailable ? "unavailable" : "skipped",
            evidenceStatus: "evidence_insufficient",
            qualityFlags: flags,
            completedAt,
            updatedAt: completedAt,
          });
        });
      });
      const audio = panel.querySelector("[data-diagnostic-audio]");
      audio?.addEventListener("play", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        if (current.status !== "in_progress") return;
        const {
          audioPlaybackCompletedAt: _completedPlaybackAt,
          audioPlaybackFailed: _playbackFailed,
          ...currentBeforeReplay
        } = current;
        replaceDiagnosticEvidence(diagnostic, {
          ...currentBeforeReplay,
          audioPlayed: true,
          audioCompleted: false,
          audioStartedNearBeginning: audio.currentTime <= 0.25,
          qualityFlags: (current.qualityFlags || []).filter((flag) => flag !== "audio_playback_failed"),
          audioPlaybackStartedAt: isoNow(),
          playCount: Number(current.playCount || 0) + 1,
          updatedAt: isoNow(),
        });
        persist();
        const status = panel.querySelector("[data-diagnostic-audio-status]");
        if (status) status.textContent = "正在播放英文材料。";
      });
      audio?.addEventListener("loadedmetadata", () => diagnosticAudioPositions.set(audio, Number(audio.currentTime || 0)));
      audio?.addEventListener("timeupdate", () => diagnosticAudioPositions.set(audio, Number(audio.currentTime || 0)));
      audio?.addEventListener("seeking", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId || current?.status !== "in_progress") return;
        const previousPosition = Number(diagnosticAudioPositions.get(audio) || 0);
        const nextPosition = Number(audio.currentTime || 0);
        diagnosticAudioPositions.set(audio, nextPosition);
        if (Math.abs(nextPosition - previousPosition) <= 0.05) return;
        const { audioPlaybackCompletedAt: _completedPlaybackAt, ...currentBeforeSeek } = current;
        replaceDiagnosticEvidence(diagnostic, appendQualityFlag({ ...currentBeforeSeek, audioCompleted: false, audioSeekDetected: true }, "audio_seek_detected"));
        persist();
        const status = panel.querySelector("[data-diagnostic-audio-status]");
        if (status) status.textContent = "检测到音频进度被拖动；本题仍可完成，但不会作为连续完整播放的纯听力证据。";
      });
      audio?.addEventListener("ended", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId || current?.status !== "in_progress") return;
        const completePlayback = current.audioStartedNearBeginning === true && current.audioSeekDetected !== true;
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          audioPlayed: true,
          audioCompleted: completePlayback,
          audioPlaybackCompletedAt: isoNow(),
          updatedAt: isoNow(),
        });
        persist();
        const status = panel.querySelector("[data-diagnostic-audio-status]");
        if (status) status.textContent = completePlayback
          ? "英文材料已完整播放，可以保存第一次选择。"
          : "播放已到结尾，但因没有从头连续播放，答案不会作为纯听力证据。";
      });
      audio?.addEventListener("error", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        if (current.status !== "in_progress") return;
        replaceDiagnosticEvidence(diagnostic, appendQualityFlag({ ...current, audioPlaybackFailed: true }, "audio_playback_failed"));
        persist();
        const status = panel.querySelector("[data-diagnostic-audio-status]");
        if (status) status.textContent = "音频无法播放。你可以打开英文原文继续，报告会标记证据不足。";
      });
      panel.querySelector("[data-diagnostic-speech-play]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const status = panel.querySelector("[data-diagnostic-audio-status]");
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        if (current.status !== "in_progress") return;
        if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
          replaceDiagnosticEvidence(
            diagnostic,
            appendQualityFlag(appendQualityFlag({ ...current, audioPlaybackFailed: true }, "audio_playback_failed"), "speech_synthesis_error"),
          );
          persist();
          if (status) status.textContent = "当前设备不支持英文语音合成；请打开原文替代。";
          return;
        }
        diagnosticSpeechToken = null;
        window.speechSynthesis.cancel();
        const transcript = panel.querySelector("[data-diagnostic-transcript-text]")?.textContent || "";
        const utterance = new window.SpeechSynthesisUtterance(transcript);
        utterance.lang = "en-US";
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.volume = 1;
        refreshDiagnosticVoices();
        const localEnUs = diagnosticVoices.find((voice) => voice.lang?.toLowerCase() === "en-us" && voice.localService);
        const anyEnUs = diagnosticVoices.find((voice) => voice.lang?.toLowerCase() === "en-us");
        const localEnglish = diagnosticVoices.find((voice) => voice.lang?.toLowerCase().startsWith("en") && voice.localService);
        const anyEnglish = diagnosticVoices.find((voice) => voice.lang?.toLowerCase().startsWith("en"));
        const selectedVoice = localEnUs || anyEnUs || localEnglish || anyEnglish || null;
        if (selectedVoice) utterance.voice = selectedVoice;
        const token = `${diagnostic.diagnosticSessionId}:${panel.dataset.taskId}:${Date.now()}:${Math.random()}`;
        diagnosticSpeechToken = token;
        const eventStillCurrent = () => {
          const latestDiagnostic = state.journey.diagnostic;
          const latest = diagnosticEvidenceById(latestDiagnostic, panel.dataset.taskId);
          return diagnosticSpeechToken === token && hasCurrentDiagnosticShape(latestDiagnostic) && latestDiagnostic.activeTaskId === panel.dataset.taskId && latest?.status === "in_progress"
            ? { diagnostic: latestDiagnostic, evidence: latest }
            : null;
        };
        utterance.addEventListener("start", () => {
          const latest = eventStillCurrent();
          if (!latest) return;
          const voiceFlags = ["browser_voice_variability"];
          if (!selectedVoice) voiceFlags.push("voice_not_loaded", "voice_fallback_used");
          else if (selectedVoice !== localEnUs) voiceFlags.push("voice_fallback_used");
          const {
            audioPlaybackCompletedAt: _completedPlaybackAt,
            audioPlaybackFailed: _playbackFailed,
            speechSynthesisEnded: _speechSynthesisEnded,
            ...evidenceBeforeReplay
          } = latest.evidence;
          replaceDiagnosticEvidence(latest.diagnostic, {
            ...evidenceBeforeReplay,
            audioPlayed: true,
            audioCompleted: false,
            speechSynthesisStarted: true,
            speechVoice: selectedVoice
              ? { lang: String(selectedVoice.lang || "unknown").slice(0, 20), localService: Boolean(selectedVoice.localService), default: Boolean(selectedVoice.default) }
              : { lang: "browser-default", localService: false, default: true },
            playCount: Number(latest.evidence.playCount || 0) + 1,
            qualityFlags: unique([
              ...(latest.evidence.qualityFlags || []).filter((flag) => !["audio_playback_failed", "speech_synthesis_error"].includes(flag)),
              ...voiceFlags,
            ]),
            updatedAt: isoNow(),
          });
          persist();
          if (status) status.textContent = "当前设备正在朗读英文材料。";
        });
        utterance.addEventListener("end", () => {
          const latest = eventStillCurrent();
          if (!latest) return;
          replaceDiagnosticEvidence(latest.diagnostic, {
            ...latest.evidence,
            audioPlayed: true,
            audioCompleted: true,
            speechSynthesisEnded: true,
            audioPlaybackCompletedAt: isoNow(),
            updatedAt: isoNow(),
          });
          persist();
          diagnosticSpeechToken = null;
          if (status) status.textContent = "英文材料已完整播放，可以保存第一次选择。";
        });
        utterance.addEventListener("error", () => {
          const latest = eventStillCurrent();
          if (!latest) return;
          replaceDiagnosticEvidence(
            latest.diagnostic,
            appendQualityFlag(appendQualityFlag({ ...latest.evidence, audioPlaybackFailed: true }, "audio_playback_failed"), "speech_synthesis_error"),
          );
          persist();
          diagnosticSpeechToken = null;
          if (status) status.textContent = "设备语音未能播放；请打开原文替代。";
        });
        window.speechSynthesis.speak(utterance);
        if (status) status.textContent = "正在等待设备语音开始；开始前不会计入听力证据。";
      });
      panel.querySelector("[data-diagnostic-transcript]")?.addEventListener("toggle", (event) => {
        if (!event.currentTarget.open) return;
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        if (current.status !== "in_progress") return;
        replaceDiagnosticEvidence(diagnostic, appendQualityFlag({ ...current, transcriptUsed: true }, "transcript_used"));
        persist();
      });

      panel.querySelector("[data-speaking-start]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        const now = Date.now();
        const prepSeconds = Number(panel.dataset.prepSeconds);
        const responseSeconds = Number(panel.dataset.responseSeconds);
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          timer: {
            phase: "prep",
            startedAt: now,
            prepEndsAt: now + prepSeconds * 1000,
            responseEndsAt: now + (prepSeconds + responseSeconds) * 1000,
          },
          updatedAt: isoNow(),
        });
        persist();
        scheduleDiagnosticTimer();
        const announcement = panel.querySelector("[data-diagnostic-timer-announcement]");
        if (announcement) announcement.textContent = "20 秒准备计时开始，随后进入 90 秒英文回答。";
      });
      panel.querySelector("[data-speaking-finish]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current?.timer) return;
        const now = Date.now();
        const durationSeconds = Math.max(0, Math.min(Number(panel.dataset.responseSeconds), Math.round((now - Number(current.timer.prepEndsAt)) / 1000)));
        const flags = durationSeconds < Number(panel.dataset.responseSeconds) ? ["speaking_ended_early"] : [];
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          timer: { ...current.timer, phase: "review", endedAt: now },
          durationSeconds,
          timerCompleted: durationSeconds >= Number(panel.dataset.responseSeconds),
          qualityFlags: unique([...(current.qualityFlags || []), ...flags]),
          updatedAt: isoNow(),
        });
        persist();
        renderDiagnostic();
        const announcement = panel.querySelector("[data-diagnostic-timer-announcement]");
        if (announcement) announcement.textContent = "口语回答已提前结束，请完成三项自查。";
        focusDiagnosticTarget(panel.querySelector("[data-speaking-review]"));
      });
      panel.querySelectorAll("[data-speaking-review]").forEach((box) => {
        box.addEventListener("change", () => {
          const diagnostic = state.journey.diagnostic;
          const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
          if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
          const selfChecks = Object.fromEntries([...panel.querySelectorAll("[data-speaking-review]")].map((item) => [item.dataset.speakingReview, item.checked]));
          replaceDiagnosticEvidence(diagnostic, { ...current, selfChecks, updatedAt: isoNow() });
          persist();
        });
      });
      panel.querySelector("[data-speaking-submit]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
        const checks = [...panel.querySelectorAll("[data-speaking-review]")];
        const selfChecks = Object.fromEntries(checks.map((item) => [item.dataset.speakingReview, item.checked]));
        const selfReviewCount = checks.filter((item) => item.checked).length;
        const flags = ["audio_not_recorded", "open_response_not_human_reviewed"];
        if (selfReviewCount < checks.length) flags.push("self_review_incomplete");
        if (!current.timerCompleted) flags.push("speaking_ended_early");
        const completedAt = isoNow();
        completeDiagnosticTask(diagnostic, {
          ...current,
          status: "completed",
          evidenceStatus: "evidence_insufficient",
          selfChecks,
          selfReviewCount,
          audioRecorded: false,
          automatedScoreProduced: false,
          qualityFlags: unique([...(current.qualityFlags || []), ...flags]),
          completedAt,
          updatedAt: completedAt,
        });
      });

      panel.querySelector("[data-writing-start]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.activeTaskId !== panel.dataset.taskId) return;
        const current = ensureActiveTaskEvidence(diagnostic, panel);
        const now = Date.now();
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          timer: { phase: "running", startedAt: now, endsAt: now + Number(panel.dataset.responseSeconds) * 1000 },
          responseText: current.responseText || "",
          updatedAt: isoNow(),
        });
        persist();
        renderDiagnostic();
        panel.querySelector("[data-diagnostic-writing-answer]")?.focus();
      });
      const writingInput = panel.querySelector("[data-diagnostic-writing-answer]");
      writingInput?.addEventListener("input", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
        const wordCount = diagnosticWordCount(writingInput.value);
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          responseText: writingInput.value,
          wordCount,
          updatedAt: isoNow(),
        });
        setText("[data-diagnostic-word-count]", wordCount);
        const saveStatus = panel.querySelector("[data-diagnostic-writing-save]");
        if (saveStatus) saveStatus.textContent = "正在保存…";
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = window.setTimeout(() => {
          persist();
          diagnosticWritingSaveTimer = null;
          if (saveStatus) saveStatus.textContent = storageWritable ? "草稿已保存在本机" : "仅在本页暂存";
        }, 400);
      });
      const markWritingExternalInsert = () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
        replaceDiagnosticEvidence(diagnostic, appendQualityFlag({ ...current, pasteDetected: true }, "writing_paste_detected"));
        persist();
      };
      writingInput?.addEventListener("paste", markWritingExternalInsert);
      writingInput?.addEventListener("drop", markWritingExternalInsert);
      writingInput?.addEventListener("beforeinput", (event) => {
        if (["insertFromPaste", "insertFromDrop"].includes(event.inputType)) markWritingExternalInsert();
      });
      panel.querySelector("[data-writing-finish]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current?.timer) return;
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = null;
        const now = Date.now();
        const responseText = writingInput?.value || current.responseText || "";
        const durationSeconds = Math.max(0, Math.min(Number(panel.dataset.responseSeconds), Math.round((now - Number(current.timer.startedAt)) / 1000)));
        const flags = durationSeconds < Number(panel.dataset.responseSeconds) ? ["writing_ended_early"] : [];
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          timer: { ...current.timer, phase: "review", endedAt: now },
          responseText,
          wordCount: diagnosticWordCount(responseText),
          durationSeconds,
          timerCompleted: durationSeconds >= Number(panel.dataset.responseSeconds),
          qualityFlags: unique([...(current.qualityFlags || []), ...flags]),
          updatedAt: isoNow(),
        });
        persist();
        renderDiagnostic();
        focusDiagnosticTarget(panel.querySelector("[data-writing-review]"));
      });
      panel.querySelectorAll("[data-writing-review]").forEach((box) => {
        box.addEventListener("change", () => {
          const diagnostic = state.journey.diagnostic;
          const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
          if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
          const selfChecks = Object.fromEntries([...panel.querySelectorAll("[data-writing-review]")].map((item) => [item.dataset.writingReview, item.checked]));
          replaceDiagnosticEvidence(diagnostic, { ...current, selfChecks, updatedAt: isoNow() });
          persist();
        });
      });
      panel.querySelector("[data-writing-submit]")?.addEventListener("click", () => {
        const diagnostic = state.journey.diagnostic;
        const current = diagnosticEvidenceById(diagnostic, panel.dataset.taskId);
        if (!hasCurrentDiagnosticShape(diagnostic) || !current) return;
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = null;
        const responseText = writingInput?.value || current.responseText || "";
        const wordCount = diagnosticWordCount(responseText);
        const checks = [...panel.querySelectorAll("[data-writing-review]")];
        const selfChecks = Object.fromEntries(checks.map((item) => [item.dataset.writingReview, item.checked]));
        const selfReviewCount = checks.filter((item) => item.checked).length;
        const flags = ["open_response_not_human_reviewed"];
        if (wordCount < Number(panel.dataset.minimumWords)) flags.push("writing_below_completion_condition");
        if (selfReviewCount < checks.length) flags.push("self_review_incomplete");
        if (!current.timerCompleted) flags.push("writing_ended_early");
        const completedAt = isoNow();
        completeDiagnosticTask(diagnostic, {
          ...current,
          status: wordCount >= Number(panel.dataset.minimumWords) ? "completed" : "evidence_insufficient",
          evidenceStatus: "evidence_insufficient",
          responseText,
          wordCount,
          selfChecks,
          selfReviewCount,
          automatedScoreProduced: false,
          qualityFlags: unique([...(current.qualityFlags || []), ...flags]),
          completedAt,
          updatedAt: completedAt,
        });
      });
    });

    priorityForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const diagnostic = state.journey.diagnostic;
      const priorityMessage = document.querySelector("[data-priority-message]");
      if (!hasCurrentDiagnosticShape(diagnostic) || diagnostic.status !== "awaiting_confirmation") return;
      const selected = priorityForm.querySelector("input[name=prioritySkill]:checked");
      if (!selected || !diagnostic.reportDraft?.priorityCandidates?.includes(selected.value)) {
        if (priorityMessage) priorityMessage.textContent = "请选择报告中显示的一个候选方向。";
        (selected || priorityForm.querySelector("input[name=prioritySkill]"))?.focus();
        return;
      }
      if (!priorityForm.elements.learnerConfirmedPriority.checked) {
        if (priorityMessage) priorityMessage.textContent = "请确认这是你选择的下一条计划重点，而不是能力等级。";
        priorityForm.elements.learnerConfirmedPriority.focus();
        return;
      }
      const snapshot = JSON.parse(JSON.stringify(state));
      const report = diagnostic.reportDraft;
      diagnostic.status = "completed";
      diagnostic.prioritySkill = selected.value;
      diagnostic.suggestedPrioritySkills = report.priorityCandidates;
      diagnostic.priorityBasis = report.priorityBasis;
      diagnostic.learnerConfirmedPriority = true;
      diagnostic.completedEvidenceTaskCount = report.completedEvidenceTaskCount;
      diagnostic.completedEvidenceSkills = report.completedEvidenceSkills;
      diagnostic.evidenceSufficiency = report.evidenceSufficiency;
      diagnostic.evidenceConfidence = report.confidence;
      diagnostic.patternFlags = terminalDiagnosticEvidence(diagnostic)
        .filter((item) => item.resultType === "first_response_not_matched")
        .map((item) => item.constructTag);
      diagnostic.report = report;
      diagnostic.reportDraft = undefined;
      diagnostic.automatedScoreProduced = false;
      diagnostic.formalDiagnosisProduced = false;
      diagnostic.completedAt = isoNow();
      diagnostic.updatedAt = diagnostic.completedAt;
      state.profile = { ...state.profile, focusSkill: selected.value };
      const cycle = activeCycle();
      if (cycle) {
        cycle.diagnosticSessionId = diagnostic.diagnosticSessionId;
        cycle.basePlanId = null;
        cycle.recommendationId = null;
        cycle.checkInId = null;
        cycle.reviewId = null;
        cycle.peerHelpId = null;
        cycle.retestId = null;
        cycle.updatedPlanId = null;
        cycle.status = "in_progress";
        cycle.updatedAt = isoNow();
      }
      if (!persist()) {
        state = snapshot;
        if (priorityMessage) priorityMessage.textContent = "当前无法保存；诊断回执与下一步重点均未写入本机。";
        return;
      }
      if (priorityMessage) priorityMessage.textContent = "诊断回执已保存在本机。";
      renderDiagnostic();
      focusDiagnosticTarget(document.querySelector("[data-diagnostic-result-title]"));
    });

    document.querySelectorAll("[data-diagnostic-restart]").forEach((button) => {
      button.addEventListener("click", () => {
        const admission = inspectNextGateACycleAdmission(state);
        if (admission.status !== "ready") {
          presentCapacityFailure(admission, "准备下一轮");
          if (message) message.textContent = admission.status === "capacity_invalid"
            ? invalidCapacityMessage("准备下一轮")
            : capacityFailureMessage("准备下一轮", admission);
          return;
        }
        clearDiagnosticTimer();
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = null;
        stopDiagnosticPlayback();
        diagnosticNextCycleIntent = true;
        if (message) message.textContent = "下一轮设备预检已打开；当前诊断、计划、历史与事件尚未改写。完成确认并提交后，才会原子建立新一轮。";
        renderDiagnostic();
        focusDiagnosticTarget(document.querySelector("#preflight-title"));
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && diagnosticWritingSaveTimer) {
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = null;
        persist();
      } else if (!document.hidden) {
        syncDiagnosticTimer();
      }
    });
    window.addEventListener("beforeunload", () => {
      window.clearTimeout(diagnosticWritingSaveTimer);
      if (diagnosticWritingSaveTimer) {
        diagnosticWritingSaveTimer = null;
        persist();
      }
      stopDiagnosticPlayback();
    });
    window.addEventListener("pagehide", () => {
      window.clearTimeout(diagnosticWritingSaveTimer);
      if (diagnosticWritingSaveTimer) {
        diagnosticWritingSaveTimer = null;
        persist();
      }
      stopDiagnosticPlayback();
    });
    renderDiagnostic();
  };

  const recommendationItems = () => {
    const diagnosticSkill = state.journey.diagnostic?.prioritySkill;
    const day = state.plan?.days?.find(
      (candidate) => candidate.coreSkill === diagnosticSkill && candidate.tasks?.some((task) => task.skill === diagnosticSkill),
    ) || null;
    if (!day) return [];
    const coreTask = day.tasks?.find((task) => task.skill === day.coreSkill) || day.tasks?.[0];
    if (!coreTask) return [];
    const practiceCatalog = practiceCatalogForSkill(day.coreSkill);
    const diagnosticReason = state.journey.diagnostic?.report?.priorityExplanation;
    const boundRoute = `${coreTask.route}?${new URLSearchParams({ plan_id: state.plan.planId, task_id: coreTask.taskId }).toString()}`;
    return [
      {
        role: "主任务",
        taskId: coreTask.taskId,
        skill: day.coreSkill,
        exerciseId: practiceCatalog?.exerciseId || null,
        contentId: practiceCatalog?.contentId || null,
        contentVersion: practiceCatalog?.activityVersion || null,
        contentHash: practiceCatalog?.contentHash || null,
        title: coreTask.titleZh,
        route: boundRoute,
        reason: diagnosticReason || `当前 7 天计划把 ${skillLabels[day.coreSkill] || day.coreSkill} 设为这一天的核心练习。`,
        duration: `${coreTask.durationMinutes} 分钟`,
        source: "Sufeiya 原创 Gate A 微练习 v1 · 未经教研与测量双签",
        verification: "从本绑定入口完成任务并生成本机练习回执，再在复盘页引用同一回执。",
        reviewStatus: "gate_a_unreviewed",
        reviewedAt: null,
        prerequisites: ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"],
      },
      {
        role: "可选补充 1",
        title: "15 分钟专注计时",
        route: "/focus",
        reason: "为主任务保留一段不被打断的时间；计时不会被当成能力或完成证据。",
        duration: "15 分钟起",
        source: "Sufeiya 本机工具",
        verification: "计时后仍需完成任务并自行复盘。",
      },
      {
        role: "可选补充 2",
        title: "查看已审阅的公开资源目录",
        route: "/resources",
        reason: "需要更多公开材料入口时自行选择；目录不等于 RAG 知识库。",
        duration: "按需",
        source: "本站冻结资源目录",
        verification: "只把实际完成的学习写入复盘，不以打开链接代替完成。",
      },
    ];
  };
  const createRecommendationBinding = (chain, primary, createdAt = isoNow()) => {
    const core = deriveRecommendationBindingCore({
      cycle: chain.cycle,
      diagnostic: chain.diagnostic,
      plan: chain.basePlan,
      primary,
    });
    if (!core) return null;
    return {
      bindingId: makeId("recommendation-binding"),
      ...core,
      createdAt,
    };
  };

  const renderRecommendationCards = (items) => {
    const list = document.querySelector("[data-recommendation-items]");
    clearChildren(list);
    items.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = index === 0 ? "recommendation-card is-primary" : "recommendation-card";
      const role = document.createElement("span");
      const title = document.createElement("h3");
      const reason = document.createElement("p");
      const facts = document.createElement("dl");
      const link = document.createElement("a");
      role.textContent = item.role;
      title.textContent = item.title;
      reason.textContent = item.reason;
      [
        ["预计时长", item.duration],
        ["来源", item.source],
        ...(item.reviewStatus ? [["审核状态", "Gate A 未经教研与测量双签"]] : []),
        ["如何验证", item.verification],
      ].forEach(([term, value]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = term;
        dd.textContent = value;
        row.append(dt, dd);
        facts.append(row);
      });
      link.className = "text-link";
      link.href = item.route;
      link.textContent = "查看此入口 →";
      article.append(role, title, reason, facts, link);
      list?.append(article);
    });
  };

  const renderRecommendationReceipt = (recommendation) => {
    const receipt = document.querySelector("[data-recommendation-receipt]");
    const start = document.querySelector("[data-recommendation-start]");
    const choiceButtons = document.querySelectorAll("[data-accept-recommendation], [data-skip-recommendation]");
    if (!recommendation) {
      if (receipt) receipt.hidden = true;
      if (start) start.hidden = true;
      choiceButtons.forEach((button) => { button.disabled = false; });
      return;
    }
    choiceButtons.forEach((button) => { button.disabled = true; });
    if (receipt) receipt.hidden = false;
    if (start) {
      const acceptedPrimaryRoute = recommendation.status === "accepted" && isSafeLocalRoute(recommendation.primary?.route)
        ? recommendation.primary.route
        : null;
      start.hidden = !acceptedPrimaryRoute;
      if (acceptedPrimaryRoute) start.href = acceptedPrimaryRoute;
    }
    setText("[data-recommendation-id]", recommendation.recommendationId);
    setText("[data-recommendation-plan-id]", recommendation.planId);
    setText("[data-recommendation-binding-id]", recommendation.evidenceBinding?.bindingId || "未形成");
    setText("[data-recommendation-status]", recommendation.status === "accepted" ? "已接受主任务" : "已明确跳过");
    setText(
      "[data-recommendation-message]",
      recommendation.status === "accepted"
        ? "已保存接受状态；完成仍以任务记录与学习复盘为准。"
        : "已保存谢绝状态；不会产生惩罚。若要继续本轮闭环，可在打卡页选择计划内另一项同技能核心练习并生成新回执。",
    );
  };

  const setupRecommendations = () => {
    const empty = document.querySelector("[data-recommendation-empty]");
    const ready = document.querySelector("[data-recommendation-ready]");
    if (!empty || !ready) return;
    const chain = validateCycleEvidence();
    const cycle = chain.cycle;
    const gateReady = Boolean(cycle?.status === "in_progress" && chain.diagnosticComplete && chain.planComplete);
    const items = gateReady ? recommendationItems() : [];
    empty.hidden = gateReady && items.length > 0;
    ready.hidden = !gateReady || items.length === 0;
    if (!gateReady || !items.length) {
      setText("[data-recommendation-status]", cycle?.status === "completed" ? "上一轮闭环已完成" : "等待本轮诊断与计划");
      const title = empty.querySelector("h3");
      const copy = empty.querySelector("p");
      if (title) title.textContent = cycle?.status === "completed" ? "请从新的演示诊断开始下一轮" : "当前计划尚未连接到本轮诊断";
      if (copy) copy.textContent = "推荐必须回链同一 cycle_id 的 diagnostic_session_id 与 base_plan_id；独立计划不会被误计入闭环。";
      return;
    }
    renderRecommendationCards(items);
    const saved =
      chain.recommendationComplete &&
      state.journey.recommendation?.recommendationId === cycle.recommendationId &&
      state.journey.recommendation?.planId === cycle.basePlanId &&
      state.journey.recommendation?.cycleId === cycle.cycleId
        ? state.journey.recommendation
        : null;
    renderRecommendationReceipt(saved);
    if (!saved) setText("[data-recommendation-status]", "等待你的选择");

    const saveChoice = async (status) => {
      const outcome = await withExclusiveJourneyWrite(async () => {
        if (!persistedStateIsFresh()) return { status: "stale" };
        const latestChain = validateCycleEvidence();
        const latestCycle = latestChain.cycle;
        if (
          latestCycle?.cycleId !== cycle.cycleId ||
          !latestChain.diagnosticComplete ||
          !latestChain.planComplete ||
          state.plan?.planId !== latestCycle.basePlanId
        ) return { status: "stale" };
        const previous = state.journey.recommendation;
        if (
          latestChain.recommendationComplete &&
          previous?.recommendationId === latestCycle.recommendationId &&
          previous?.cycleId === latestCycle.cycleId &&
          previous?.planId === latestCycle.basePlanId
        ) return { status: "already_saved", record: previous };

        const appendCapacity = workspaceAppendCapacity({ learningEvents: 1 });
        if (appendCapacity.status !== "ready") return appendCapacity;
        const before = snapshotState();
        const candidate = snapshotState();
        const candidateCycle = candidate.journey.activeCycle;
        const recommendationId = makeId("recommendation");
        const createdAt = isoNow();
        const evidenceBinding = createRecommendationBinding(latestChain, items[0], createdAt);
        if (!evidenceBinding) return { status: "binding_invalid" };
        candidate.journey.recommendation = {
          recommendationId,
          cycleId: latestCycle.cycleId,
          planId: latestCycle.basePlanId,
          diagnosticSessionId: latestCycle.diagnosticSessionId,
          status,
          itemCount: items.length,
          primary: items[0],
          evidenceBinding,
          supplements: items.slice(1),
          sourceMode: "frozen_local_routes_no_rag",
          learnerChoice: true,
          updatedAt: createdAt,
          createdAt,
        };
        candidateCycle.recommendationId = recommendationId;
        candidateCycle.checkInId = null;
        candidateCycle.reviewId = null;
        candidateCycle.peerHelpId = null;
        candidateCycle.retestId = null;
        candidateCycle.updatedPlanId = null;
        candidateCycle.updatedAt = createdAt;
        candidate.journey.review = null;
        candidate.journey.peerHelp = null;
        candidate.journey.retest = null;
        candidate.journey.planUpdate = null;
        const eventOutcome = await appendLearningEvent("recommendation.decided", {
          recommendation: candidate.journey.recommendation,
        }, candidate);
        if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        const candidateCapacity = workspaceCandidateCapacity(candidate);
        if (candidateCapacity.status !== "ready") return candidateCapacity;
        state = candidate;
        if (!persist()) {
          state = before;
          return { status: "persist_failed" };
        }
        return { status: "saved", record: state.journey.recommendation };
      });

      if (outcome.status === "saved") {
        renderRecommendationReceipt(outcome.record);
        return;
      }
      if (outcome.status === "already_saved") {
        renderRecommendationReceipt(outcome.record);
        setText("[data-recommendation-message]", "本轮推荐选择已经封存；如需改变方向，请重新开始诊断或生成新的闭环计划。");
        return;
      }
      setText(
        "[data-recommendation-message]",
        outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁，未保存推荐选择；请使用最新版浏览器后重试。"
          : outcome.status === "capacity_invalid"
            ? invalidCapacityMessage("本次推荐选择")
            : outcome.status === "capacity_reached"
              ? capacityFailureMessage("本次推荐选择")
          : outcome.status === "persist_failed"
            ? "当前无法保存，推荐选择尚未形成正式本机记录。"
            : outcome.status === "binding_invalid"
              ? "诊断证据、计划任务与原创练习版本无法形成精确绑定；未保存推荐，请刷新后重新核对。"
              : "本机记录已在另一个页面发生变化；未覆盖首份选择，请刷新后核对。",
      );
    };
    document.querySelector("[data-accept-recommendation]")?.addEventListener("click", () => saveChoice("accepted"));
    document.querySelector("[data-skip-recommendation]")?.addEventListener("click", () => saveChoice("skipped"));
  };

  const peerHelpLabels = {
    used: "已查看演示经验卡",
    declined: "谢绝社区互助",
    not_needed: "本轮不需要互助",
    unavailable: "真实社区暂不可用",
  };

  const buildCommunityVisibilityPreview = (chain) => {
    if (
      chain?.reviewComplete !== true ||
      !isRecord(chain?.linkedPracticeTask) ||
      !isRecord(chain?.linkedPracticeReceipt)
    ) return null;
    const skill = chain.linkedPracticeTask.skill;
    if (
      !["Reading", "Listening", "Writing", "Speaking"].includes(skill) ||
      chain.linkedPracticeReceipt.status !== "completed" ||
      chain.linkedPracticeReceipt.skill !== skill ||
      chain.diagnostic?.prioritySkill !== skill
    ) return null;
    return Object.freeze({
      taskCategory: skillLabels[skill],
      completionStatus: "已完成本机原创练习并确认复盘",
    });
  };

  const renderCommunityVisibilityPreview = (chain) => {
    const root = document.querySelector("[data-community-privacy-preview]");
    if (!root) return;
    root.hidden = false;
    const preview = buildCommunityVisibilityPreview(chain);
    if (!preview) {
      root.dataset.previewState = "unavailable";
      setText("[data-community-preview-skill]", "暂不能生成安全预览");
      setText("[data-community-preview-completion]", "等待同一轮学习者确认复盘");
      setText(
        "[data-community-preview-boundary]",
        "当前严格闭环尚未完成，因此没有生成任何可见摘要；没有上传、没有加入小组、没有分享给任何人，也没有匹配真人。",
      );
      return;
    }
    root.dataset.previewState = "ready";
    setText("[data-community-preview-skill]", preview.taskCategory);
    setText("[data-community-preview-completion]", preview.completionStatus);
    setText(
      "[data-community-preview-boundary]",
      "本次只在当前浏览器生成预览；没有上传、没有加入小组、没有分享给任何人，也没有匹配真人。",
    );
  };

  const setupReview = () => {
    const form = document.querySelector("#review-form");
    const empty = document.querySelector("[data-review-empty]");
    const ready = document.querySelector("[data-review-ready]");
    const errorMessage = document.querySelector("[data-review-error]");
    const successMessage = document.querySelector("[data-review-message]");
    if (!form || !empty || !ready) return;
    const chain = validateCycleEvidence();
    const cycle = chain.cycle;
    const record = cycle?.status === "in_progress" && chain.checkInComplete ? chain.checkIn : null;
    const checkInReady = Boolean(record);
    empty.hidden = checkInReady;
    ready.hidden = !checkInReady;
    if (!checkInReady) {
      setText("[data-review-status]", cycle?.status === "completed" ? "上一轮已确认" : "等待本轮证据式打卡");
      return;
    }
    setText("[data-review-date]", `${record.date} 的证据式打卡`);
    setText("[data-review-did]", record.didText);
    setText("[data-review-evidence]", record.evidenceText);
    setText("[data-review-evidence-class]", record.evidenceClass === "practice_receipt" ? "practice_receipt · 本机练习回执" : "learner_self_report · 学习者自报");
    setText("[data-review-practice-receipt-id]", record.taskCompletionReceiptId || "无 · 不进入当前闭环");
    setText(
      "[data-review-question]",
      record.questionStatus === "has_question" ? `仍有问题：${record.questionText}` : "暂时没有待解决问题",
    );

    const review = state.journey.review;
    const confirmed = Boolean(
      review?.reviewId === cycle.reviewId &&
        review?.cycleId === cycle.cycleId &&
        review?.checkInId === record.checkInId &&
        review?.learnerConfirmed === true &&
        record.reviewId === review.reviewId &&
        record.learnerConfirmedReview === true,
    );
    const receipt = document.querySelector("[data-review-receipt]");
    const next = document.querySelector("[data-review-next]");
    if (receipt) receipt.hidden = !confirmed;
    if (next) next.hidden = !confirmed;
    if (confirmed) {
      form.hidden = true;
      if (successMessage) successMessage.hidden = false;
      setText("[data-review-status]", "学习者已确认");
      setText("[data-review-id]", review.reviewId);
      setText("[data-review-checkin-id]", record.checkInId);
      setText("[data-review-message]", "这份复盘已经由学习者明确确认并保存在本机。");
      return;
    }
    if (successMessage) successMessage.hidden = true;
    setText("[data-review-status]", "等待你的明确确认");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (errorMessage) errorMessage.textContent = "";
      if (!form.elements.learnerConfirmed.checked) {
        if (errorMessage) errorMessage.textContent = "请先核对记录，并勾选学习者确认。";
        form.elements.learnerConfirmed.focus();
        return;
      }
      const latestChain = validateCycleEvidence();
      if (
        !latestChain.checkInComplete ||
        latestChain.cycle?.cycleId !== cycle.cycleId ||
        latestChain.checkIn?.checkInId !== record.checkInId
      ) {
        if (errorMessage) errorMessage.textContent = "待确认记录已经变化，请刷新后重新核对。";
        return;
      }
      const reviewId = makeId("review");
      const confirmedAt = isoNow();
      const before = snapshotState();
      state.journey.review = {
        cycleId: cycle.cycleId,
        reviewId,
        checkInId: record.checkInId,
        learnerConfirmed: true,
        shareStatus: "not_shared",
        reminderStatus: "not_enabled",
        humanEscalationStatus: "not_requested",
        confirmedAt,
      };
      record.reviewId = reviewId;
      record.learnerConfirmedReview = true;
      record.reviewedAt = confirmedAt;
      record.updatedAt = confirmedAt;
      cycle.reviewId = reviewId;
      cycle.peerHelpId = null;
      cycle.retestId = null;
      cycle.updatedPlanId = null;
      cycle.updatedAt = confirmedAt;
      state.journey.peerHelp = null;
      state.journey.retest = null;
      state.journey.planUpdate = null;
      if (!persist()) {
        state = before;
        if (errorMessage) errorMessage.textContent = "当前无法保存；本次确认尚未形成正式 review_id。";
        return;
      }
      form.hidden = true;
      if (receipt) receipt.hidden = false;
      if (next) next.hidden = false;
      if (successMessage) successMessage.hidden = false;
      setText("[data-review-status]", "学习者已确认");
      setText("[data-review-id]", reviewId);
      setText("[data-review-checkin-id]", record.checkInId);
      setText("[data-review-message]", "复盘确认已保存在本机。");
      successMessage?.focus();
    });
  };

  const renderCommunity = () => {
    const chain = validateCycleEvidence();
    renderCommunityVisibilityPreview(chain);
    const peerHelp = chain.peerHelp;
    const receipt = document.querySelector("[data-community-receipt]");
    const next = document.querySelector("[data-community-next]");
    if (!chain.peerHelpComplete) {
      if (receipt) receipt.hidden = true;
      if (next) next.hidden = true;
      return;
    }
    const radio = document.querySelector(`input[name="peerHelpStatus"][value="${peerHelp.status}"]`);
    if (radio) radio.checked = true;
    if (receipt) receipt.hidden = false;
    if (next) next.hidden = false;
    setText("[data-community-status]", peerHelpLabels[peerHelp.status]);
    setText("[data-community-id]", peerHelp.peerHelpId);
    setText("[data-community-value]", peerHelp.status);
    setText(
      "[data-community-message]",
      peerHelp.status === "used"
        ? "自愿状态已保存在本机；used 只表示已查看合成演示经验卡，没有加入或分享给真实社区。"
        : "自愿状态已保存在本机；四种选择都不会降低服务或阻断闭环。",
    );
  };

  const setupCommunity = () => {
    const form = document.querySelector("#community-form");
    if (!form) return;
    const chain = validateCycleEvidence();
    renderCommunityVisibilityPreview(chain);
    const cycle = chain.cycle;
    const previewConfirmation = form.querySelector("[data-community-preview-confirmation]");
    const previewConfirmationInput = form.elements.localPreviewConfirmed;
    const syncCommunityPreviewConfirmation = () => {
      const selected = form.querySelector('input[name="peerHelpStatus"]:checked')?.value;
      const needsConfirmation = selected === "used";
      if (previewConfirmation) previewConfirmation.hidden = !needsConfirmation;
      if (!needsConfirmation && previewConfirmationInput) previewConfirmationInput.checked = false;
    };
    const gateReady = Boolean(cycle?.status === "in_progress" && chain.reviewComplete);
    const downstreamSealed = Boolean(
      cycle &&
        (cycle.retestId ||
          cycle.updatedPlanId ||
          state.journey.retest?.cycleId === cycle.cycleId ||
          state.journey.planUpdate?.cycleId === cycle.cycleId),
    );
    if (downstreamSealed) {
      renderCommunity();
      if (previewConfirmation) previewConfirmation.hidden = true;
      form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-community-status]", "互助状态已封存");
      setText("[data-community-message]", "本轮已形成 retest_id 或更新计划；为保护首份平行任务证据，互助状态不能再覆盖。请从新一轮诊断开始变更方向。");
      return;
    }
    if (!gateReady) {
      if (previewConfirmation) previewConfirmation.hidden = true;
      form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-community-status]", cycle?.status === "completed" ? "上一轮已记录" : "等待学生确认复盘");
      setText("[data-community-message]", "请先在当前 cycle_id 中保存证据式打卡，并由学习者明确确认复盘。 ");
      return;
    }
    renderCommunity();
    syncCommunityPreviewConfirmation();
    form.querySelectorAll('input[name="peerHelpStatus"]').forEach((control) => {
      control.addEventListener("change", syncCommunityPreviewConfirmation);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = form.querySelector('input[name="peerHelpStatus"]:checked')?.value;
      const message = document.querySelector("[data-community-message]");
      if (!VALID_PEER_HELP_STATES.has(selected)) {
        if (message) message.textContent = "请选择一种自愿状态后再保存。";
        form.querySelector('input[name="peerHelpStatus"]')?.focus();
        return;
      }
      if (selected === "used" && !previewConfirmationInput?.checked) {
        if (message) message.textContent = "请先确认这只是本机预览，不会加入真实小组或发送学习数据。";
        previewConfirmationInput?.focus();
        return;
      }
      const latestChain = validateCycleEvidence();
      if (
        !latestChain.reviewComplete ||
        latestChain.cycle?.cycleId !== cycle.cycleId ||
        latestChain.review?.reviewId !== cycle.reviewId
      ) {
        if (message) message.textContent = "闭环状态已变化，请刷新后重新核对。";
        return;
      }
      const previous = state.journey.peerHelp?.cycleId === cycle.cycleId ? state.journey.peerHelp : null;
      const peerHelpId = previous?.peerHelpId || makeId("peer-help");
      const before = snapshotState();
      const updatedAt = isoNow();
      state.journey.peerHelp = {
        peerHelpId,
        cycleId: cycle.cycleId,
        planId: cycle.basePlanId,
        reviewId: cycle.reviewId,
        status: selected,
        source: "synthetic_demo_card_v1",
        learnerChoice: true,
        realCommunityUsed: false,
        updatedAt,
        createdAt: previous?.createdAt || updatedAt,
      };
      cycle.peerHelpId = peerHelpId;
      cycle.retestId = null;
      cycle.updatedPlanId = null;
      cycle.updatedAt = isoNow();
      state.journey.retest = null;
      state.journey.planUpdate = null;
      if (!persist()) {
        state = before;
        if (message) message.textContent = "当前无法保存，互助状态尚未形成正式本机记录。";
        return;
      }
      renderCommunity();
    });
  };

  const showRetestPanel = (skill) => {
    document.querySelectorAll("[data-retest-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.retestPanel !== skill;
    });
  };

  const retestListeningQuality = {
    audioPlayed: false,
    audioCompleted: false,
    playCount: 0,
    transcriptUsed: false,
    seekDetected: false,
    playbackFailed: false,
    startedNearBeginning: false,
  };

  const readRetestEvidence = (form, skill) => {
    if (skill === "Reading" || skill === "Listening") {
      const fieldName = skill === "Reading" ? "retestReading" : "retestListening";
      const selected = form.querySelector(`input[name="${fieldName}"]:checked`)?.value;
      if (!selected) {
        return {
          error: "请先选择一个答案。",
          errorKey: skill.toLowerCase(),
          target: form.querySelector(`input[name="${fieldName}"]`),
        };
      }
      const taskCatalog = RETEST_TASK_CATALOG[skill];
      return {
        evidence: {
          responseType: taskCatalog.responseType,
          selectedAnswer: selected,
          resultType: selected === taskCatalog.correctValue ? "single_task_correct" : "single_task_needs_review",
          ...(skill === "Listening"
            ? {
                audioPlayed: retestListeningQuality.audioPlayed,
                audioCompleted: retestListeningQuality.audioCompleted,
                playCount: retestListeningQuality.playCount,
                transcriptUsed: retestListeningQuality.transcriptUsed,
                seekDetected: retestListeningQuality.seekDetected,
                playbackFailed: retestListeningQuality.playbackFailed,
              }
            : {}),
        },
      };
    }
    if (skill === "Writing") {
      const value = form.elements.retestWriting.value.trim();
      const words = value ? value.split(/\s+/).filter(Boolean).length : 0;
      const checks = [...form.querySelectorAll("[data-retest-writing-review]")];
      if (value.length > RETEST_WRITING_MAX_CHARACTERS) {
        return {
          error: `Writing 任务最多保存 ${RETEST_WRITING_MAX_CHARACTERS} 个字符。`,
          errorKey: "writing",
          target: form.elements.retestWriting,
        };
      }
      if (words < RETEST_TASK_CATALOG.Writing.minimumWordCount) {
        return {
          error: `Writing 任务需要至少 ${RETEST_TASK_CATALOG.Writing.minimumWordCount} 个英文词。`,
          errorKey: "writing",
          target: form.elements.retestWriting,
        };
      }
      const firstUnchecked = checks.find((item) => !item.checked);
      if (firstUnchecked) {
        return {
          error: "请完成 Writing 的三项自查。",
          errorKey: "writing",
          target: firstUnchecked,
        };
      }
      return { evidence: { responseType: "self_reviewed_writing", wordCount: words, selfChecksComplete: true, resultType: "task_completed_no_score" } };
    }
    if (skill === "Speaking") {
      const checks = [...form.querySelectorAll("[data-retest-speaking-review]")];
      const firstUnchecked = checks.find((item) => !item.checked);
      if (firstUnchecked) {
        return {
          error: "请先大声完成任务并勾选三项自查。",
          errorKey: "speaking",
          target: firstUnchecked,
        };
      }
      return { evidence: { responseType: "learner_confirmed_speaking", selfChecksComplete: true, audioRecorded: false, resultType: "task_completed_no_score" } };
    }
    return { error: "无法识别所选任务，请刷新后重试。", target: document.querySelector("[data-retest-skill-label]") };
  };

  const retestGate = () => {
    const chain = validateCycleEvidence();
    const { cycle, diagnostic, checkIn: record, linkedPracticeTask, linkedPracticeReceipt, review, peerHelp } = chain;
    const evidenceAlreadyRecorded = chain.retestEvidenceComplete;
    const targetSkill = chain.preRetestComplete && linkedPracticeReceipt?.evidenceStatus === "evidence_limited"
      ? linkedPracticeReceipt.skill
      : null;
    const ready = Boolean(
      cycle?.status === "in_progress" &&
        cycle.basePlanId === state.plan?.planId &&
        chain.preRetestComplete &&
        targetSkill &&
        targetSkill === diagnostic?.prioritySkill &&
        targetSkill === linkedPracticeTask?.skill &&
        !evidenceAlreadyRecorded,
    );
    return { cycle, diagnostic, record, linkedPracticeTask, linkedPracticeReceipt, review, peerHelp, targetSkill, ready, evidenceAlreadyRecorded, completed: chain.planUpdateRecorded };
  };

  const renderRetest = ({ focusCompletion = false } = {}) => {
    const chain = validateCycleEvidence();
    const { retest, planUpdate } = chain;
    const result = document.querySelector("[data-retest-result]");
    const updateForm = document.querySelector("#plan-update-form");
    const completion = document.querySelector("[data-plan-update-receipt]");
    if (!chain.retestEvidenceComplete) {
      if (result) result.hidden = true;
      if (updateForm) updateForm.hidden = true;
      if (completion) completion.hidden = true;
      return;
    }
    const selector = document.querySelector("[data-retest-skill]");
    if (selector) selector.value = retest.skill;
    setText("[data-retest-skill-label]", skillLabels[retest.skill] || retest.skill);
    setText("[data-retest-comparability]", "与本轮诊断优先项、计划任务和练习回执保持同技能；构念与难度尚未经教研、测量双签。");
    showRetestPanel(retest.skill);
    if (result) result.hidden = false;
    if (updateForm) updateForm.hidden = false;
    setText(
      "[data-retest-status]",
      retest.humanConfirmationStatus === "required_not_completed" ? "已留证，等待人工确认" : "同技能平行任务已留证",
    );
    setText("[data-retest-id]", retest.retestId);
    setText("[data-retest-target-skill]", retest.comparability.targetSkill);
    setText("[data-retest-same-skill]", retest.comparability.sameSkill ? "true · 已由代码核对" : "false · 不可比较");
    setText("[data-retest-parallel-pair]", retest.parallelFormPairId);
    setText(
      "[data-retest-result-copy]",
      retest.evidenceStatus === "evidence_insufficient"
        ? "本次 Listening 平行任务已保存，但音频未从头完整连续播放、使用了英文原文、发生拖动或播放失败；当前只能形成证据不足记录，需人工确认，不能关闭完整闭环。"
        : retest.evidence.resultType === "single_task_correct"
        ? "本次同技能单题回答正确；只描述当前任务，不证明构念等值、能力增长或分数变化。"
        : retest.humanConfirmationStatus === "required_not_completed"
          ? "本次任务已保存，但开放作答或单题结果仍需具备资质的人工确认；当前不形成趋势、分数、能力等级或增长结论。"
          : "本次任务已经完成并保存；结果不形成分数、能力等级或增长结论。",
    );

    if (chain.planUpdateRecorded) {
      if (completion) completion.hidden = false;
      if (updateForm) updateForm.hidden = true;
      setText("[data-updated-plan-id]", planUpdate.updatedPlanId);
      setText("[data-superseded-plan-id]", planUpdate.supersedesPlanId);
      setText(
        "[data-plan-update-completion-title]",
        chain.provisionalUpdateRecorded
          ? "临时计划已保存在本机"
          : "本机演示闭环已关闭",
      );
      setText(
        "[data-plan-update-completion-copy]",
        chain.provisionalUpdateRecorded
          ? "本轮仍等待具备资质的人工确认，尚未计作完整闭环；这不是正式 Gate A PASS。"
          : "更新计划与旧计划回链已保存在当前浏览器；这不是正式 Gate A PASS、能力增长证明或教师确认。",
      );
      if (focusCompletion) document.querySelector("[data-plan-update-completion-title]")?.focus();
    } else if (completion) {
      completion.hidden = true;
    }
  };

  const commitJourneyPlanClose = (focusSkill) => withExclusiveJourneyWrite(async () => {
    if (!persistedStateIsFresh()) return { status: "stale" };
    const chain = validateCycleEvidence();
    const { cycle, retest } = chain;
    const exactChain = Boolean(
      cycle?.status === "in_progress" &&
      chain.retestEvidenceComplete &&
      state.plan?.planId === cycle.basePlanId,
    );
    if (!exactChain) return { status: "chain_changed" };
    const derivedOutcome = deriveRetestOutcome(retest.skill, retest.evidence);
    if (!derivedOutcome || derivedOutcome.humanConfirmationStatus !== retest.humanConfirmationStatus) {
      return { status: "chain_changed" };
    }
    const provisional = derivedOutcome.humanReviewRequired;
    const appendCapacity = workspaceAppendCapacity({
      planHistory: 1,
      journeyHistory: 1,
      learningEvents: provisional ? 0 : 1,
    });
    if (appendCapacity.status !== "ready") return appendCapacity;
    const stateBeforeUpdate = snapshotState();
    const candidate = snapshotState();
    const candidateCycle = candidate.journey.activeCycle;
    const candidateRetest = candidate.journey.retest;
    const previousPlan = candidate.plan;
    const closedAt = isoNow();
    candidate.planHistory = [
      ...candidate.planHistory,
      { ...previousPlan, status: "superseded", supersededAt: closedAt, supersededByRetestId: retest.retestId },
    ];
    candidate.profile = { ...candidate.profile, focusSkill };
    const nextPlan = createPlan(candidate.profile, {
      source: provisional
        ? "learner_selected_provisional_followup_pending_human_review"
        : "learner_confirmed_parallel_retest_followup",
      cycleId: cycle.cycleId,
      diagnosticSessionId: cycle.diagnosticSessionId,
      taskSetVersion: candidate.journey.diagnostic.taskSetVersion,
      taskSetDigest: candidate.journey.diagnostic.taskSetDigest,
      retestId: retest.retestId,
      supersedesPlanId: cycle.basePlanId,
    }, closedAt);
    candidate.plan = nextPlan;
    candidate.journey.planUpdate = {
      cycleId: cycle.cycleId,
      updatedPlanId: nextPlan.planId,
      supersedesPlanId: cycle.basePlanId,
      retestId: retest.retestId,
      focusSkill,
      learnerConfirmed: true,
      confirmationClass: provisional ? "provisional_pending_human_review" : "learner_confirmed_gate_a",
      humanConfirmationStatus: derivedOutcome.humanConfirmationStatus,
      automatedAbilityDecision: false,
      createdAt: closedAt,
    };
    candidateCycle.updatedPlanId = nextPlan.planId;
    candidateCycle.status = provisional ? "provisional_pending_human_review" : "completed";
    candidateCycle.closedAt = provisional ? null : closedAt;
    candidateCycle.provisionalAt = provisional ? closedAt : null;
    candidateCycle.updatedAt = closedAt;
    candidate.journey.history = [
      ...candidate.journey.history,
      {
        ...candidateCycle,
        status: candidateCycle.status,
        diagnostic: candidate.journey.diagnostic,
        recommendation: candidate.journey.recommendation,
        checkIn: getCycleCheckIn(candidate),
        review: candidate.journey.review,
        peerHelp: candidate.journey.peerHelp,
        retest: candidateRetest,
        planUpdate: candidate.journey.planUpdate,
      },
    ];
    if (!provisional) {
      const eventOutcome = await appendLearningEvent("learning_cycle.completed", {
        cycle: candidateCycle,
        retest: candidateRetest,
        planUpdate: candidate.journey.planUpdate,
      }, candidate);
      if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
        return { status: eventOutcome.status, code: eventOutcome.code };
      }
    }
    const candidateCapacity = workspaceCandidateCapacity(candidate);
    if (candidateCapacity.status !== "ready") return candidateCapacity;
    state = candidate;
    if (!persist()) {
      state = stateBeforeUpdate;
      return { status: "persist_failed" };
    }
    return { status: "saved", provisional };
  });

  const setupRetest = () => {
    const form = document.querySelector("#retest-form");
    if (!form) return;
    const message = document.querySelector("[data-retest-message]");
    const clearRetestValidation = () => {
      form.querySelectorAll("[data-retest-error]").forEach((node) => { node.textContent = ""; });
      form.querySelectorAll('[aria-invalid="true"]').forEach((control) => {
        control.removeAttribute("aria-invalid");
        if (control.getAttribute("aria-describedby")?.startsWith("retest-")) control.removeAttribute("aria-describedby");
      });
    };
    const showRetestValidationError = ({ error, errorKey, target }) => {
      const inlineError = errorKey ? form.querySelector(`[data-retest-error="${errorKey}"]`) : null;
      if (inlineError) inlineError.textContent = error;
      else if (message) message.textContent = error;
      if (target?.focus) {
        target.setAttribute("aria-invalid", "true");
        if (inlineError?.id) target.setAttribute("aria-describedby", inlineError.id);
        target.focus();
      } else {
        message?.focus();
      }
    };
    const clearPanelValidation = (target) => {
      const panel = target?.closest?.("[data-retest-panel]");
      if (!panel) return;
      panel.querySelectorAll("[data-retest-error]").forEach((node) => { node.textContent = ""; });
      panel.querySelectorAll('[aria-invalid="true"]').forEach((control) => {
        control.removeAttribute("aria-invalid");
        if (control.getAttribute("aria-describedby")?.startsWith("retest-")) control.removeAttribute("aria-describedby");
      });
    };
    form.addEventListener("input", (event) => clearPanelValidation(event.target));
    form.addEventListener("change", (event) => clearPanelValidation(event.target));
    const listeningAudio = form.querySelector("[data-retest-listening-audio]");
    const listeningTranscript = form.querySelector('[data-retest-panel="Listening"] .listening-transcript');
    listeningAudio?.addEventListener("play", () => {
      retestListeningQuality.audioPlayed = true;
      retestListeningQuality.playCount += 1;
      retestListeningQuality.startedNearBeginning =
        retestListeningQuality.startedNearBeginning || listeningAudio.currentTime <= 0.25;
    });
    listeningAudio?.addEventListener("seeking", () => {
      retestListeningQuality.seekDetected = true;
      retestListeningQuality.audioCompleted = false;
    });
    listeningAudio?.addEventListener("ended", () => {
      retestListeningQuality.audioCompleted =
        retestListeningQuality.audioCompleted ||
        (retestListeningQuality.startedNearBeginning && !retestListeningQuality.seekDetected);
    });
    listeningAudio?.addEventListener("error", () => {
      retestListeningQuality.playbackFailed = true;
      retestListeningQuality.audioCompleted = false;
    });
    listeningTranscript?.addEventListener("toggle", () => {
      if (listeningTranscript.open) retestListeningQuality.transcriptUsed = true;
    });
    const selector = document.querySelector("[data-retest-skill]");
    const initialGate = retestGate();
    if (selector) selector.value = initialGate.targetSkill || "";
    setText("[data-retest-skill-label]", initialGate.targetSkill ? skillLabels[initialGate.targetSkill] : "等待同技能练习记录");
    setText(
      "[data-retest-comparability]",
      initialGate.targetSkill
        ? "系统已锁定与本轮诊断优先项、计划任务和练习回执相同的技能；构念与难度仍未经教研、测量双签。"
        : "完成前置步骤并留下合格练习记录后，系统才会锁定同技能平行任务。",
    );
    showRetestPanel(initialGate.targetSkill || "");
    const alreadyCompleted = initialGate.completed;
    if (!initialGate.ready && !alreadyCompleted && !initialGate.evidenceAlreadyRecorded) {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-retest-status]", "等待本轮互助状态");
      setText("[data-retest-message]", "请先完成当前 cycle_id 的诊断、计划、推荐、证据式打卡、学生确认与互助选择。 ");
    }
    if (alreadyCompleted || initialGate.evidenceAlreadyRecorded) {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
    }
    renderRetest();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const skill = form.elements.retestSkill.value;
      clearRetestValidation();
      if (message) message.textContent = "";
      const expectedTarget = retestGate().targetSkill;
      if (!VALID_SKILLS.has(skill) || skill === "Balanced" || skill !== expectedTarget) {
        if (message) message.textContent = "平行任务必须与本轮诊断、计划和练习记录保持同技能；当前状态已变化，请刷新后核对。";
        message?.focus();
        return;
      }
      const evidenceResult = readRetestEvidence(form, skill);
      if (evidenceResult.error) {
        showRetestValidationError(evidenceResult);
        return;
      }
      const { evidence } = evidenceResult;
      const outcome = await withExclusiveJourneyWrite(async () => {
        if (!persistedStateIsFresh()) return { status: "stale" };
        const { cycle, diagnostic, record, linkedPracticeTask, linkedPracticeReceipt, review, peerHelp, targetSkill, ready, evidenceAlreadyRecorded } = retestGate();
        if (evidenceAlreadyRecorded) return { status: "already_saved" };
        if (!ready || skill !== targetSkill) return { status: "stale" };

        const appendCapacity = workspaceAppendCapacity({ learningEvents: 1 });
        if (appendCapacity.status !== "ready") return appendCapacity;
        const before = snapshotState();
        const candidate = snapshotState();
        const candidateCycle = candidate.journey.activeCycle;
        const retestId = makeId("retest");
        const taskCatalog = RETEST_TASK_CATALOG[skill];
        const derivedOutcome = deriveRetestOutcome(skill, evidence);
        if (!derivedOutcome) return { status: "evidence_invalid" };
        const comparability = {
          targetSkill,
          sameSkill: skill === targetSkill,
          sameAsDiagnosticPriority: skill === diagnostic.prioritySkill,
          sameAsPlanTask: skill === linkedPracticeTask.skill,
          sameAsPracticeReceipt: skill === linkedPracticeReceipt.skill,
          newOriginalPrompt: true,
          constructAlignment: taskCatalog.constructAlignment,
          teacherReviewed: false,
          measurementReviewed: false,
          officialEquivalenceClaimed: false,
          comparisonBoundary: "same_skill_only_no_calibrated_construct_or_difficulty_equivalence",
        };
        candidate.journey.retest = {
          retestId,
          cycleId: cycle.cycleId,
          diagnosticSessionId: cycle.diagnosticSessionId,
          planId: cycle.basePlanId,
          recommendationId: cycle.recommendationId,
          checkInId: record.checkInId,
          reviewId: review.reviewId,
          peerHelpId: peerHelp.peerHelpId,
          skill,
          baselineTaskId: linkedPracticeTask.taskId,
          baselinePracticeReceiptId: linkedPracticeReceipt.completionReceiptId,
          parallelTaskId: taskCatalog.taskId,
          taskVersion: taskCatalog.taskVersion,
          parallelFormPairId: taskCatalog.parallelFormPairId,
          status: "completed",
          parallelRetest: true,
          comparability,
          evidenceStatus: derivedOutcome.evidenceStatus,
          evidenceSufficiency: derivedOutcome.evidenceSufficiency,
          humanConfirmationStatus: derivedOutcome.humanConfirmationStatus,
          evidence,
          automatedScoreProduced: false,
          growthClaimProduced: false,
          interpretation: "single_task_evidence_only_no_growth_claim",
          completedAt: isoNow(),
        };
        candidateCycle.retestId = retestId;
        candidateCycle.updatedPlanId = null;
        candidateCycle.updatedAt = candidate.journey.retest.completedAt;
        candidate.journey.planUpdate = null;
        const eventOutcome = await appendLearningEvent("retest.completed", {
          retest: candidate.journey.retest,
          recommendation: candidate.journey.recommendation,
        }, candidate);
        if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        const candidateCapacity = workspaceCandidateCapacity(candidate);
        if (candidateCapacity.status !== "ready") return candidateCapacity;
        state = candidate;
        if (!persist()) {
          state = before;
          return { status: "persist_failed" };
        }
        return { status: "saved" };
      });
      if (outcome.status !== "saved") {
        if (message) message.textContent = outcome.status === "already_saved"
          ? "本轮 retest_id 已封存；显示反馈后不能覆盖第一次平行任务证据。"
          : outcome.status === "lock_unavailable"
            ? "当前浏览器无法取得安全写入锁；平行任务尚未形成正式 retest_id。"
            : outcome.status === "capacity_invalid"
              ? invalidCapacityMessage("本次平行任务")
              : outcome.status === "capacity_reached"
                ? capacityFailureMessage("本次平行任务")
            : outcome.status === "persist_failed"
              ? "当前无法保存；平行任务尚未形成正式 retest_id。"
              : outcome.status === "evidence_invalid"
                ? "平行任务答案与冻结任务版本无法重新核对；未保存证据，请刷新后重试。"
              : "本机记录已在另一个页面发生变化；未覆盖首份平行任务，请刷新后核对。";
        if (outcome.status === "already_saved") form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
        return;
      }
      if (message) message.textContent = "平行任务证据已保存在本机；请由你确认下一轮重点。";
      form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
      renderRetest();
      document.querySelector("[data-retest-result]")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("[data-retest-result-title]")?.focus();
    });

    const updateForm = document.querySelector("#plan-update-form");
    updateForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("[data-plan-update-message]");
      const focusSkill = updateForm.elements.nextFocusSkill.value;
      updateForm.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute("aria-invalid"));
      if (message) message.textContent = "";
      if (!VALID_SKILLS.has(focusSkill)) {
        if (message) message.textContent = "请选择可识别的下一轮重点。";
        updateForm.elements.nextFocusSkill.setAttribute("aria-invalid", "true");
        updateForm.elements.nextFocusSkill.focus();
        return;
      }
      if (!updateForm.elements.learnerConfirmed.checked) {
        if (message) message.textContent = "请确认这是你自己的下一轮学习计划选择。";
        updateForm.elements.learnerConfirmed.setAttribute("aria-invalid", "true");
        updateForm.elements.learnerConfirmed.focus();
        return;
      }
      const outcome = await commitJourneyPlanClose(focusSkill);
      if (outcome.status !== "saved") {
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；更新计划与闭环关闭均未形成正式本机记录。"
          : outcome.status === "capacity_invalid"
            ? invalidCapacityMessage("更新计划与闭环关闭")
            : outcome.status === "capacity_reached"
              ? capacityFailureMessage("更新计划与闭环关闭")
          : outcome.status === "persist_failed"
            ? "当前无法保存；更新计划与闭环关闭均未形成正式本机记录。"
            : outcome.status === "chain_changed"
              ? "当前计划与 retest_id 的 base_plan_id 不一致，已停止更新；请返回工作台重新核对。"
              : "本机记录已在另一个页面发生变化；未覆盖首份更新计划，请刷新后核对。";
        return;
      }
      renderRetest({ focusCompletion: true });
    });
  };

  const journeyDefinitions = [
    { key: "diagnostic", title: "让六项诊断任务形成终态", copy: "逐项完成，或明确记录跳过、不可用；缺失不按零分处理，再由学习者确认下一条优先项。", route: "/diagnostic" },
    { key: "plan", title: "生成 7 天计划", copy: "把学习者确认的重点与每天可用时间变成具体任务；调整计划设置后可重新生成。", route: "/plan" },
    { key: "recommendation", title: "接受或明确跳过推荐", copy: "查看原因、时长、来源与验证方式，再保存自己的选择。", route: "/recommendations" },
    { key: "checkin", title: "保存证据式打卡", copy: "同时写清做了什么、一条学习证据和仍待解决的问题。", route: "/check-in" },
    { key: "review", title: "由学习者确认复盘", copy: "核对刚才的打卡内容，确认准确或返回修正。", route: "/review" },
    { key: "community", title: "保存自愿互助状态", copy: "使用、谢绝、不需要或暂不可用，四种选择都可继续。", route: "/community" },
    { key: "retest", title: "完成平行任务并确认更新计划", copy: "保存一条新任务证据，再由你选择下一轮重点。", route: "/retest" },
  ];

  const evaluateJourney = (chain = validateCycleEvidence()) => {
    const { diagnostic, recommendation, peerHelp, retest } = chain;
    const raw = [
      chain.diagnosticComplete,
      chain.planComplete,
      chain.recommendationComplete,
      chain.checkInComplete,
      chain.reviewComplete,
      chain.peerHelpComplete,
      chain.updateComplete,
    ];
    let previousComplete = true;
    const completedEvidenceCount = Number.isInteger(diagnostic?.completedEvidenceTaskCount)
      ? diagnostic.completedEvidenceTaskCount
      : terminalDiagnosticEvidence(diagnostic).filter((item) => item.status === "completed").length;
    const diagnosticLabel = completedEvidenceCount === 0
      ? "六项终态已记录 · 0 项形成完成证据"
      : completedEvidenceCount < DIAGNOSTIC_TASK_IDS.length
        ? `六项终态已记录 · ${completedEvidenceCount} 项形成完成证据`
        : diagnostic?.evidenceSufficiency === "evidence_insufficient"
          ? "6 / 6 项完成 · 证据质量不足"
          : "6 / 6 项完成 · 证据有限";
    const labels = [
      diagnosticLabel,
      "计划已连接",
      recommendation?.status === "skipped" ? "已明确跳过" : "已接受",
      "打卡已保存",
      "学习者已确认",
      peerHelpLabels[peerHelp?.status] || "状态已记录",
      retest?.evidenceStatus === "needs_review" ? "已完成，需复核" : "微复测与计划已更新",
    ];
    const pendingLabels = [null, null, null, null, null, null, chain.provisionalUpdateRecorded ? "等待具备资质的人工确认" : null];
    return journeyDefinitions.map((definition, index) => {
      const complete = Boolean(raw[index] && previousComplete);
      previousComplete = complete;
      return { ...definition, rawComplete: raw[index], complete, completeLabel: labels[index], pendingLabel: pendingLabels[index] };
    });
  };

  const renderCycleEvidenceLedger = (chain) => {
    const root = document.querySelector("[data-cycle-ledger]");
    if (!root) return;
    const projection = buildCycleEvidenceProjection(chain);
    root.dataset.cycleState = projection.state;
    setText("[data-cycle-ledger-status]", projection.status);
    setText("[data-cycle-ledger-copy]", projection.copy);
    setText("[data-cycle-ledger-cycle-id]", projection.cycleId || "尚未形成");
    setText("[data-cycle-ledger-protocol]", projection.protocolVersion);
    setText(
      "[data-cycle-ledger-integrity]",
      learningLedgerStatus.ok
        ? `${learningLedgerStatus.eventCount} 条事件已核对${learningLedgerStatus.headHash ? ` · 链头 ${learningLedgerStatus.headHash.slice(0, 12)}…` : ""}`
        : "核对失败 · 已停止自动写入",
    );
    projection.rows.forEach((entry) => {
      const row = root.querySelector(`[data-cycle-ledger-row="${entry.key}"]`);
      if (!row) return;
      row.dataset.state = entry.state;
      const value = row.querySelector("[data-cycle-ledger-value]");
      const status = row.querySelector("[data-cycle-ledger-row-status]");
      if (value) value.textContent = entry.value || "尚未形成";
      if (status) status.textContent = entry.status;
    });
  };

  const formatCycleHistoryTimestamp = (value) =>
    exactUtcTimestamp(value) ? `${value.slice(0, 10)} · ${value.slice(11, 19)} UTC` : "时间未通过核对";
  const appendCycleHistoryFact = (list, term, value, { code = false } = {}) => {
    const row = document.createElement("div");
    const name = document.createElement("dt");
    const detail = document.createElement("dd");
    name.textContent = term;
    const content = code ? document.createElement("code") : document.createElement("span");
    content.textContent = value;
    detail.append(content);
    row.append(name, detail);
    list.append(row);
  };
  const renderCycleHistory = () => {
    const root = document.querySelector("[data-cycle-history]");
    const list = root?.querySelector("[data-cycle-history-list]");
    const empty = root?.querySelector("[data-cycle-history-empty]");
    const invalid = root?.querySelector("[data-cycle-history-invalid]");
    const summary = root?.querySelector("[data-cycle-history-summary]");
    if (!root || !list || !empty || !invalid || !summary) return;

    const projection = buildCycleHistoryProjection(state, learningLedgerStatus);
    root.dataset.cycleHistoryState = projection.items.length ? "ready" : projection.invalidCount ? "invalid" : "empty";
    clearChildren(list);
    list.hidden = projection.items.length === 0;
    empty.hidden = projection.items.length > 0;
    invalid.hidden = projection.invalidCount === 0;
    invalid.textContent = projection.invalidCount
      ? `${projection.invalidCount} 条本机历史记录未通过完整性、重复或隐私边界核对，已失败关闭且不显示内容。`
      : "";
    const invalidSummary = projection.invalidCount ? `；${projection.invalidCount} 条无效记录未显示` : "";

    if (projection.items.length) {
      summary.textContent = `显示最近 ${projection.items.length} 轮已核对记录${projection.hiddenValidCount ? `；另有 ${projection.hiddenValidCount} 轮较早记录未展开` : ""}${invalidSummary}`;
    } else if (projection.currentExcludedCount) {
      summary.textContent = `当前轮次只在上方本轮回执中显示，历史区不重复列出${invalidSummary}`;
    } else if (projection.invalidCount) {
      summary.textContent = `当前没有可安全显示的历史轮次；${projection.invalidCount} 条无效记录未显示`;
    } else {
      summary.textContent = "尚无已完成或待具备资格人员复核的历史轮次";
    }
    empty.textContent = projection.currentExcludedCount
      ? "当前 cycle_id 已在上方“本轮证据链”中显示；开始新一轮后，上一轮才进入这里的历史对照。"
      : projection.invalidCount
        ? "历史原始内容不会作为降级回退显示。请先在“我的本机数据”导出备份或清除损坏记录。"
        : "完成一轮 Gate A 本机闭环后，这里会显示经过重新核对的计划版本与脱敏 ID 链。";

    projection.items.forEach((item, index) => {
      const entry = document.createElement("li");
      const article = document.createElement("article");
      const header = document.createElement("header");
      const headingGroup = document.createElement("div");
      const overline = document.createElement("span");
      const heading = document.createElement("h3");
      const timestamp = document.createElement("time");
      const badge = document.createElement("strong");
      const comparison = document.createElement("dl");
      const ids = document.createElement("dl");
      const boundary = document.createElement("p");
      const headingId = `cycle-history-entry-${index + 1}`;

      article.setAttribute("aria-labelledby", headingId);
      overline.textContent = `HISTORICAL CYCLE ${String(index + 1).padStart(2, "0")}`;
      heading.id = headingId;
      heading.textContent = `${skillLabels[item.baseFocusSkill] || item.baseFocusSkill} → ${skillLabels[item.updatedFocusSkill] || item.updatedFocusSkill}`;
      timestamp.dateTime = item.terminalAt;
      timestamp.textContent = formatCycleHistoryTimestamp(item.terminalAt);
      badge.dataset.state = item.status;
      badge.textContent = item.status === "completed_local_cycle"
        ? "本机闭环已完成"
        : "待具备资格人员复核";
      headingGroup.append(overline, heading, timestamp);
      header.append(headingGroup, badge);

      comparison.className = "cycle-history-plan-comparison";
      appendCycleHistoryFact(comparison, "基础计划重点", skillLabels[item.baseFocusSkill] || item.baseFocusSkill);
      appendCycleHistoryFact(comparison, "更新计划重点", skillLabels[item.updatedFocusSkill] || item.updatedFocusSkill);
      appendCycleHistoryFact(comparison, "任务集版本", item.taskSetVersion, { code: true });
      appendCycleHistoryFact(comparison, "事件链", `${item.eventCount} 条本机事件已核对`);

      ids.className = "cycle-history-id-chain";
      [
        ["cycle_id", item.cycleId],
        ["diagnostic_session_id", item.diagnosticSessionId],
        ["base_plan_id", item.basePlanId],
        ["recommendation_id", item.recommendationId],
        ["check_in_id", item.checkInId],
        ["review_id", item.reviewId],
        ["peer_help_id", item.peerHelpId],
        ["retest_id", item.retestId],
        ["updated_plan_id", item.updatedPlanId],
      ].forEach(([term, value]) => appendCycleHistoryFact(ids, term, value, { code: true }));

      boundary.textContent = item.status === "completed_local_cycle"
        ? "这表示本机流程与事件回链完成；不表示正式诊断、能力增长、教师复核或防篡改凭证。"
        : "流程节点已经记录，但资格人员复核尚未完成；临时更新计划不得显示成已完成结论。";
      article.append(header, comparison, ids, boundary);
      entry.append(article);
      list.append(entry);
    });
  };

  const gate0PublicKeys = Object.freeze([
    "defaultDisposition",
    "formalGate0Pass",
    "protocolVersion",
    "releaseAuthorization",
    "resolved",
    "status",
    "total",
    "unresolved",
  ].sort());

  const parseGate0PublicSummary = (candidate) => {
    if (!isRecord(candidate)) return null;
    const keys = Object.keys(candidate).sort();
    if (JSON.stringify(keys) !== JSON.stringify(gate0PublicKeys)) return null;
    if (
      candidate.protocolVersion !== GATE0_PROTOCOL_VERSION ||
      !["blocked", "decision_complete"].includes(candidate.status) ||
      candidate.total !== 29 ||
      !Number.isSafeInteger(candidate.resolved) ||
      candidate.resolved < 0 ||
      candidate.resolved > 29 ||
      candidate.unresolved !== 29 - candidate.resolved ||
      candidate.defaultDisposition !== "deny" ||
      candidate.formalGate0Pass !== false ||
      candidate.releaseAuthorization !== GATE0_RELEASE_AUTHORIZATION ||
      (candidate.status === "decision_complete" && candidate.resolved !== 29)
    ) return null;
    return {
      status: candidate.status,
      resolved: candidate.resolved,
      unresolved: candidate.unresolved,
    };
  };

  const sourceGovernancePublicKeys = Object.freeze([
    "blockedArchiveRecords",
    "catalogLinkOnly",
    "criteria",
    "defaultDisposition",
    "gateAClaimSources",
    "protocolVersion",
    "ragBlocked",
    "ragEligible",
    "status",
    "trackedRecords",
  ].sort());
  const sourceGovernanceCriteriaKeys = Object.freeze([
    "examVersionCurrentOrNotApplicable",
    "explicitRagAllowed",
    "noBlockingSafetyFlags",
    "ragRightsAllowed",
    "teacherReviewed",
  ].sort());

  const parseSourceGovernancePublicSummary = (candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.criteria)) return null;
    if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(sourceGovernancePublicKeys)) return null;
    if (JSON.stringify(Object.keys(candidate.criteria).sort()) !== JSON.stringify(sourceGovernanceCriteriaKeys)) return null;
    const counts = [
      candidate.trackedRecords,
      candidate.gateAClaimSources,
      candidate.catalogLinkOnly,
      candidate.ragEligible,
      candidate.ragBlocked,
      candidate.blockedArchiveRecords,
      ...Object.values(candidate.criteria),
    ];
    const criterionCounts = Object.values(candidate.criteria);
    const minimumPossibleEligible = Math.max(
      0,
      criterionCounts.reduce((total, value) => total + value, 0) -
        ((criterionCounts.length - 1) * candidate.trackedRecords),
    );
    if (
      candidate.protocolVersion !== SOURCE_GOVERNANCE_PROTOCOL_VERSION ||
      !["none_admitted", "some_admitted", "all_tracked_admitted"].includes(candidate.status) ||
      candidate.defaultDisposition !== "deny" ||
      !counts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
      candidate.trackedRecords !== 15 ||
      candidate.gateAClaimSources !== 10 ||
      candidate.catalogLinkOnly !== 5 ||
      candidate.gateAClaimSources + candidate.catalogLinkOnly !== candidate.trackedRecords ||
      candidate.ragBlocked !== candidate.trackedRecords - candidate.ragEligible ||
      candidate.ragEligible > candidate.trackedRecords ||
      candidate.ragEligible > candidate.gateAClaimSources ||
      candidate.blockedArchiveRecords !== 655 ||
      criterionCounts.some((value) => value > candidate.trackedRecords) ||
      candidate.criteria.explicitRagAllowed > candidate.gateAClaimSources ||
      criterionCounts.some((value) => candidate.ragEligible > value) ||
      candidate.ragEligible < minimumPossibleEligible ||
      (candidate.status === "none_admitted" && candidate.ragEligible !== 0) ||
      (candidate.status === "some_admitted" && (candidate.ragEligible === 0 || candidate.ragEligible === candidate.trackedRecords)) ||
      (candidate.status === "all_tracked_admitted" && candidate.ragEligible !== candidate.trackedRecords)
    ) return null;
    return candidate;
  };

  const renderGate0Failure = () => {
    const root = document.querySelector("[data-gate0-summary]");
    if (!root) return;
    root.dataset.gate0State = "unavailable";
    const status = root.querySelector("[data-gate0-status]");
    const copy = root.querySelector("[data-gate0-copy]");
    const resolved = root.querySelector("[data-gate0-resolved]");
    const total = root.querySelector("[data-gate0-total]");
    const progress = root.querySelector("[data-gate0-progress]");
    if (status) status.textContent = "暂时无法核对 Gate 0 注册表";
    if (copy) copy.textContent = "为避免把未知状态显示成批准，当前按 Gate 0 未通过处理；学习闭环与未批准能力的边界不变。";
    if (resolved) resolved.textContent = "—";
    if (total) total.textContent = "29";
    if (progress) {
      progress.removeAttribute("value");
      progress.setAttribute("aria-valuetext", "暂时无法核对，按未通过处理");
      progress.textContent = "暂时无法核对";
    }
  };

  const renderGate0Summary = (summary) => {
    const root = document.querySelector("[data-gate0-summary]");
    if (!root) return;
    root.dataset.gate0State = summary.status === "decision_complete" ? "decision-complete" : "blocked";
    const status = root.querySelector("[data-gate0-status]");
    const copy = root.querySelector("[data-gate0-copy]");
    const resolved = root.querySelector("[data-gate0-resolved]");
    const total = root.querySelector("[data-gate0-total]");
    const progress = root.querySelector("[data-gate0-progress]");
    if (status) {
      status.textContent = summary.status === "decision_complete"
        ? "29 项 P0 已形成书面结论"
        : "Gate 0 尚未通过";
    }
    if (copy) {
      copy.textContent = summary.status === "decision_complete"
        ? "逐项采用或拒绝结论已经齐备；这仍不代表 Gate 0 正式 PASS，也不会直接开放任何运行时功能。"
        : `已形成 ${summary.resolved} 项逐项采用或拒绝结论；${summary.unresolved} 项仍未解决。未解决项保持默认不批准。`;
    }
    if (resolved) resolved.textContent = String(summary.resolved);
    if (total) total.textContent = "29";
    if (progress) {
      progress.value = summary.resolved;
      progress.setAttribute("value", String(summary.resolved));
      progress.setAttribute("aria-valuetext", `${summary.resolved} / 29 项已形成逐项书面结论`);
      progress.textContent = `${summary.resolved} / 29`;
    }
  };

  const renderSourceGovernanceFailure = () => {
    const root = document.querySelector("[data-source-governance]");
    if (!root) return;
    root.dataset.sourceGovernanceState = "unavailable";
    const status = root.querySelector("[data-source-governance-status]");
    const copy = root.querySelector("[data-source-governance-copy]");
    if (status) status.textContent = "暂时无法核对来源准入登记";
    if (copy) copy.textContent = "为避免把未知状态显示成可检索，当前 RAG 准入按 0 处理；Gate A 的静态解释边界不变。";
    [
      "[data-source-rag-eligible]",
      "[data-source-tracked]",
      "[data-source-gate-a]",
      "[data-source-link-only]",
      "[data-source-archive-blocked]",
    ].forEach((selector) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = "—";
    });
    root.querySelectorAll("[data-source-criterion]").forEach((element) => {
      element.textContent = "— / —";
    });
  };

  const renderSourceGovernanceSummary = (summary) => {
    const root = document.querySelector("[data-source-governance]");
    if (!root) return;
    root.dataset.sourceGovernanceState = summary.status.replaceAll("_", "-");
    const status = root.querySelector("[data-source-governance-status]");
    const copy = root.querySelector("[data-source-governance-copy]");
    if (status) {
      status.textContent = summary.status === "none_admitted"
        ? "RAG 准入仍为 0 条"
        : summary.status === "all_tracked_admitted"
          ? `${summary.ragEligible} 条均通过逐项准入`
          : `${summary.ragEligible} 条通过逐项准入`;
    }
    if (copy) {
      copy.textContent = summary.ragEligible === 0
        ? "10 条 Gate A 静态解释来源与 5 条仅链接目录都已逐条登记，但没有任何一条通过完整的结构、证据、决定与安全准入合同。"
        : `已有 ${summary.ragEligible} 条通过逐项准入；这仍不代表外部模型、供应商数据流或生产发布已经批准。`;
    }
    const setSourceText = (selector, value) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = String(value);
    };
    setSourceText("[data-source-rag-eligible]", summary.ragEligible);
    setSourceText("[data-source-tracked]", summary.trackedRecords);
    setSourceText("[data-source-gate-a]", `${summary.gateAClaimSources} 条`);
    setSourceText("[data-source-link-only]", `${summary.catalogLinkOnly} 条`);
    setSourceText("[data-source-archive-blocked]", `${summary.blockedArchiveRecords} 条`);
    const criterionCounts = {
      "teacher-reviewed": summary.criteria.teacherReviewed,
      "rag-rights": summary.criteria.ragRightsAllowed,
      "exam-version": summary.criteria.examVersionCurrentOrNotApplicable,
      "explicit-rag": summary.criteria.explicitRagAllowed,
      "no-safety-flags": summary.criteria.noBlockingSafetyFlags,
    };
    Object.entries(criterionCounts).forEach(([criterion, value]) => {
      const element = root.querySelector(`[data-source-criterion="${criterion}"]`);
      if (element) element.textContent = `${value} / ${summary.trackedRecords}`;
    });
  };

  const loadGate0GovernanceStatus = async () => {
    if (
      !document.querySelector("[data-gate0-summary]") &&
      !document.querySelector("[data-source-governance]")
    ) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(GATE0_STATUS_PATH, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "same-origin",
        signal: controller.signal,
      });
      const responseUrl = new URL(response.url);
      const contentType = response.headers.get("content-type") || "";
      if (
        !response.ok ||
        responseUrl.origin !== window.location.origin ||
        responseUrl.pathname !== GATE0_STATUS_PATH ||
        !contentType.toLowerCase().startsWith("application/json")
      ) throw new Error("invalid_gate0_response");
      const raw = await response.text();
      if (raw.length === 0 || raw.length > 20000) throw new Error("invalid_gate0_response_size");
      const body = JSON.parse(raw);
      if (!isRecord(body) || body.mode !== "sanitized_read_only_status") throw new Error("invalid_gate0_envelope");
      const summary = parseGate0PublicSummary(body.p0Gate);
      if (summary) renderGate0Summary(summary);
      else renderGate0Failure();
      const sourceSummary = parseSourceGovernancePublicSummary(body.sourceGovernance);
      if (sourceSummary) renderSourceGovernanceSummary(sourceSummary);
      else renderSourceGovernanceFailure();
    } catch {
      renderGate0Failure();
      renderSourceGovernanceFailure();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const renderNextCycleAdmission = (completed) => {
    const root = document.querySelector("[data-next-cycle-admission]");
    if (!root) return;
    const statusNode = root.querySelector("[data-next-cycle-admission-status]");
    const startLink = root.querySelector("[data-next-cycle-start]");
    const recoveryLink = root.querySelector("[data-next-cycle-recovery]");
    if (!completed) {
      root.hidden = true;
      root.dataset.state = "hidden";
      if (startLink) startLink.hidden = true;
      if (recoveryLink) recoveryLink.hidden = true;
      return;
    }
    root.hidden = false;
    const admission = storageWritable && workspaceWriterLeaseAvailable
      ? inspectNextGateACycleAdmission(state)
      : { status: "capacity_invalid", code: "workspace_writer_unavailable", additions: null };
    if (admission.status === "ready") {
      root.dataset.state = "ready";
      if (statusNode) {
        statusNode.textContent = "当前本机计数空间可容纳下一轮至少 6 条学习事件和 1 条闭环历史；仅打开预检不会改写本轮记录，每一步仍会按实际文件大小与结构严格核对。";
      }
      if (startLink) {
        startLink.hidden = false;
        startLink.href = "/diagnostic?intent=next-cycle";
      }
      if (recoveryLink) recoveryLink.hidden = true;
      return;
    }
    const blocked = admission.status === "capacity_reached";
    root.dataset.state = blocked ? "capacity-blocked" : "invalid";
    if (startLink) startLink.hidden = true;
    if (recoveryLink) recoveryLink.hidden = false;
    if (statusNode) {
      statusNode.textContent = blocked && Number.isInteger(admission.current) && Number.isInteger(admission.limit)
        ? `${CAPACITY_FIELD_LABELS[admission.field] || admission.field}当前 ${admission.current} 条；完成下一轮至少还需要 ${admission.required} 条；安全上限 ${admission.limit} 条。本轮记录保持不变，暂不能开始下一轮。`
        : "当前本机学习工作区未通过下一轮可恢复容量核对；本轮记录保持不变。请先导出原始保全 JSON，再核对或明确清除学习工作区。";
    }
  };

  const renderJourneyDashboard = () => {
    if (!document.querySelector("[data-journey-list]")) return;
    const chain = validateCycleEvidence();
    const status = evaluateJourney(chain);
    const completedCount = status.filter((step) => step.complete).length;
    const next = status.find((step) => !step.complete);
    status.forEach((step) => {
      const item = document.querySelector(`[data-journey-step="${step.key}"]`);
      const label = item?.querySelector("[data-journey-step-status]");
      item?.classList.remove("is-complete", "is-current", "is-locked");
      if (step.complete) {
        item?.classList.add("is-complete");
        if (label) label.textContent = step.completeLabel;
      } else if (next?.key === step.key) {
        item?.classList.add("is-current");
        if (label) label.textContent = step.pendingLabel || "下一步";
      } else {
        item?.classList.add("is-locked");
        if (label) label.textContent = "等待前一步";
      }
    });
    setText("[data-journey-summary]", `${completedCount} / ${journeyDefinitions.length} 步已留证`);
    setText("[data-journey-next-label]", next ? `下一步：${next.title}` : "本轮闭环已完成，可从更新后的计划继续");
    setText("[data-journey-next-title]", next?.title || "本轮 Gate A 闭环已完成");
    setText(
      "[data-journey-next-copy]",
      next?.copy || "所有七个阶段都有本机记录；这只证明演示流程闭合，不代表正式诊断、真实学生试点或学习效果。",
    );
    const link = document.querySelector("[data-journey-next-link]");
    if (link) {
      link.href = next?.route || "/plan";
      link.textContent = next ? "继续下一步 →" : "查看更新后的计划 →";
    }
    renderNextCycleAdmission(!next && completedCount === journeyDefinitions.length);
    renderCycleEvidenceLedger(chain);
    renderCycleHistory();
  };

  void loadGate0GovernanceStatus();
  const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease();
  if (!workspaceWriterLeaseAvailable) storageWritable = false;
  loadState();
  let learningLedgerStatus = { ok: false, code: "runtime_unavailable" };
  if (learningEventsRuntime) {
    try {
      learningLedgerStatus = await learningEventsRuntime.validateLedger(state);
    } catch {
      learningLedgerStatus = { ok: false, code: "runtime_exception" };
    }
  }
  if (!learningLedgerStatus.ok) {
    storageWritable = false;
    showStorageWarning(
      learningLedgerStatus.code === "runtime_unavailable"
        ? "本机学习事件组件未能加载；为避免保存不完整闭环，本页已切换为只读。"
        : "本机学习事件链未通过完整性核对；系统不会自动修复或覆盖。请先在“我的本机数据”导出备份，或仅清除学习事件后再继续。",
    );
    disableJourneyControls();
  }
  if (!workspaceWriterLeaseAvailable) {
    showStorageWarning(
      navigator.locks?.request
        ? "另一个苏肥鸭页面正在编辑本机学习数据。为避免跨标签页覆盖，本页已切换为只读；请关闭其他编辑页后刷新。"
        : "当前浏览器不支持安全本机写入锁，本页已切换为只读；请升级到支持 Web Locks 的现代浏览器。",
    );
    disableJourneyControls();
  }
  setupWorkspaceBackupControls({ currentLedgerStatus: learningLedgerStatus });
  setupDiagnostic();
  setupRecommendations();
  setupReview();
  setupCommunity();
  setupRetest();
  renderJourneyDashboard();

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) window.location.reload();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
})();
