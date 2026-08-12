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
  const PRACTICE_ACTIVITY_CATALOG = Object.freeze({
    "reading-library-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/reading-library/v1", activityVersion: "v1", contentId: "reading-library-v1", contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f", skill: "Reading", route: "/practice-reading", receiptEvidenceClass: "objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", responseType: "single_choice", domCompletionRule: "final_answer_correct", correctValue: "b" }),
    "listening-club-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/listening-club/v1", activityVersion: "v1", contentId: "listening-club-v1", contentHash: "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb", skill: "Listening", route: "/practice-listening", receiptEvidenceClass: "audio_objective_response", evidenceType: "answer_matched", completionCondition: "correct_answer_observed", responseType: "single_choice_audio", domCompletionRule: "final_answer_correct_with_audio_quality", correctValue: "b" }),
    "writing-community-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/writing-community/v1", activityVersion: "v1", contentId: "writing-community-v1", contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b", skill: "Writing", route: "/practice-writing", receiptEvidenceClass: "self_reviewed_artifact", evidenceType: "task_completed_no_score", completionCondition: "minimum_words_and_self_review", responseType: "local_text_self_review", domCompletionRule: "minimum_words_and_all_self_checks", minimumWords: 20 }),
    "speaking-skill-v1": Object.freeze({ activityId: "https://sufeiya.cn/activities/practice/speaking-skill/v1", activityVersion: "v1", contentId: "speaking-skill-v1", contentHash: "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843", skill: "Speaking", route: "/practice-speaking", receiptEvidenceClass: "timed_self_report", evidenceType: "task_completed_no_score", completionCondition: "timer_and_self_review", responseType: "timed_self_report", domCompletionRule: "full_timer_and_all_self_checks", prepSeconds: 20, responseSeconds: 60 }),
  });
  const RETEST_TASK_CATALOG = Object.freeze({
    Reading: Object.freeze({ taskId: "retest-reading-garden-labels-v1", taskVersion: "v1", parallelFormPairId: "gate-a-reading-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice", correctValue: "b", humanReviewRule: "incorrect_objective_response" }),
    Listening: Object.freeze({ taskId: "retest-listening-writing-center-v1", taskVersion: "v1", parallelFormPairId: "gate-a-listening-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "single_choice", correctValue: "c", humanReviewRule: "incorrect_or_insufficient_audio_evidence", audioEvidenceRule: "full_play_without_seek_transcript_or_failure" }),
    Writing: Object.freeze({ taskId: "retest-writing-study-habit-v1", taskVersion: "v1", parallelFormPairId: "gate-a-writing-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "self_reviewed_writing", minimumWordCount: 20, humanReviewRule: "always_required_for_open_response" }),
    Speaking: Object.freeze({ taskId: "retest-speaking-study-place-v1", taskVersion: "v1", parallelFormPairId: "gate-a-speaking-skill-pair-v1", constructAlignment: "same_skill_unreviewed_construct", responseType: "learner_confirmed_speaking", humanReviewRule: "always_required_for_open_response" }),
  });
  const DIAGNOSTIC_TASK_MANIFEST = Object.freeze({
    "diagnostic-reading-library-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "purpose_from_supporting_details", contentHash: "f1c71d28d6e9b3ebe8b4c29fa5cec52c20b83d737b57f0bc98e15e15f97decd7" }),
    "diagnostic-reading-newsletter-v1": Object.freeze({ taskVersion: "v1", skill: "Reading", responseType: "single_choice", constructTag: "cause_from_text_structure", contentHash: "8b5feb0e382ea0ffe016ab64f17edb30b8467b40fccf5d8b96d3e2bb74ba44ca" }),
    "diagnostic-listening-science-club-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "schedule_change_detail", contentHash: "882abc23a7376b27a0d53e2a4d7b6eb10480bd7b618002fe3e6704922ea67308" }),
    "diagnostic-listening-language-lab-v1": Object.freeze({ taskVersion: "v1", skill: "Listening", responseType: "single_choice_audio", constructTag: "time_and_location_integration", contentHash: "be827c7ed66ed510a9b94aafdd16b35f445c82e14034bce6c971a29b5a8200cd" }),
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
      return Boolean(
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
  const hasValidPracticeReceiptShape = (receipt, receiptId = null) => {
    if (!isRecord(receipt) || receipt.protocolVersion !== PRACTICE_RECEIPT_VERSION) return false;
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
      receipt.status === "completed" &&
      hasValidPracticeEvidencePayload(receipt, catalog)
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
    journey: { protocolVersion: PROTOCOL_VERSION, activeCycle: null, history: [] },
  });

  let state = freshState();
  let storageWritable = true;
  let storageWarningShown = false;

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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      storageWritable = false;
      showStorageWarning("当前浏览器无法持久保存。本次页面仍可查看，但新的闭环证据不会写入本机。");
      disableJourneyControls();
      return false;
    }
  };

  const snapshotState = () => JSON.parse(JSON.stringify(state));

  const persistedStateIsFresh = () => {
    if (!storageWritable) return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const latest = raw ? normalizeState(JSON.parse(raw)) : null;
      return Boolean(latest && latest.updatedAt === state.updatedAt);
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

  const appendLearningEvent = async (eventType, domain) => {
    if (!learningEventsRuntime) return { status: "ledger_invalid", code: "runtime_unavailable" };
    try {
      return await learningEventsRuntime.appendDomainEvent(state, eventType, domain);
    } catch {
      return { status: "ledger_invalid", code: "runtime_exception" };
    }
  };

  const createPlan = ({ nickname, examDate, dailyMinutes, focusSkill }, provenance) => {
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
      createdAt: isoNow(),
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

  const activeCycle = () =>
    isRecord(state.journey.activeCycle) && state.journey.activeCycle.protocolVersion === PROTOCOL_VERSION
      ? state.journey.activeCycle
      : null;
  const allCheckIns = () => [...Object.values(state.checkIns), ...state.checkInHistory].filter(isRecord);
  const getCheckInById = (checkInId) => allCheckIns().find((item) => item.checkInId === checkInId) || null;
  const getCycleCheckIn = () => {
    const cycle = activeCycle();
    if (!cycle?.checkInId) return null;
    const record = getCheckInById(cycle.checkInId);
    return record?.cycleId === cycle.cycleId && record?.planId === cycle.basePlanId ? record : null;
  };

  const planById = (planId) => {
    if (!planId) return null;
    if (state.plan?.planId === planId) return state.plan;
    return state.planHistory.find((plan) => plan?.planId === planId) || null;
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
    if (catalog.responseType === "single_choice") {
      if (!["a", "b", "c"].includes(evidence.selectedAnswer)) return null;
      resultType = evidence.selectedAnswer === catalog.correctValue ? "single_task_correct" : "single_task_needs_review";
      if (skill === "Listening") {
        if (
          typeof evidence.audioPlayed !== "boolean" ||
          typeof evidence.audioCompleted !== "boolean" ||
          !Number.isInteger(evidence.playCount) ||
          evidence.playCount < 0 ||
          typeof evidence.transcriptUsed !== "boolean" ||
          typeof evidence.seekDetected !== "boolean" ||
          typeof evidence.playbackFailed !== "boolean" ||
          evidence.audioPlayed !== (evidence.playCount >= 1)
        ) return null;
        audioEvidenceInsufficient = Boolean(
          evidence.audioPlayed !== true ||
          evidence.audioCompleted !== true ||
          evidence.transcriptUsed === true ||
          evidence.seekDetected === true ||
          evidence.playbackFailed === true
        );
      }
    } else if (catalog.responseType === "self_reviewed_writing") {
      if (!Number.isInteger(evidence.wordCount) || evidence.wordCount < catalog.minimumWordCount || evidence.selfChecksComplete !== true) return null;
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

  const validateCycleEvidence = () => {
    const cycle = activeCycle();
    const diagnostic = state.journey.diagnostic;
    const basePlan = planById(cycle?.basePlanId);
    const baseTaskIds = new Set(basePlan?.days?.flatMap((day) => day.tasks?.map((task) => task.taskId) || []) || []);
    const recommendation = state.journey.recommendation;
    const checkIn = getCycleCheckIn();
    const linkedPracticeTask = planTaskById(basePlan, checkIn?.linkedTaskId);
    const linkedPracticeReceipt = checkIn?.practiceReceipt;
    const storedPracticeReceipt = state.practiceReceipts[linkedPracticeReceipt?.completionReceiptId];
    const linkedTaskProgress = state.taskProgress[checkIn?.linkedTaskId];
    const review = state.journey.review;
    const peerHelp = state.journey.peerHelp;
    const retest = state.journey.retest;
    const retestCatalog = RETEST_TASK_CATALOG[retest?.skill];
    const derivedRetestOutcome = deriveRetestOutcome(retest?.skill, retest?.evidence);
    const planUpdate = state.journey.planUpdate;
    const updatedPlan = planById(cycle?.updatedPlanId);
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
    if (!Object.entries(expected).every(([key, value]) => evidence[key] === value)) return false;
    if (!DIAGNOSTIC_EVIDENCE_STATES.has(evidence.evidenceStatus)) return false;
    if (!Array.isArray(evidence.qualityFlags) || !evidence.qualityFlags.every((flag) => DIAGNOSTIC_QUALITY_FLAGS.has(flag))) return false;
    if (terminal && !DIAGNOSTIC_TERMINAL_STATES.has(evidence.status)) return false;
    if (!terminal && !DIAGNOSTIC_TERMINAL_STATES.has(evidence.status) && evidence.status !== "in_progress") return false;
    if (["single_choice", "single_choice_audio"].includes(expected.responseType) && evidence.status === "completed") {
      if (evidence.attempts !== 1 || !["a", "b", "c"].includes(evidence.firstResponse)) return false;
      if (!["first_response_matched", "first_response_not_matched"].includes(evidence.resultType)) return false;
    }
    return true;
  };
  const diagnosticEvidenceCollectionValid = (diagnostic, { requireAllTerminal = false } = {}) => {
    if (!Array.isArray(diagnostic?.taskEvidence)) return false;
    const ids = diagnostic.taskEvidence.map((item) => item?.taskId);
    if (new Set(ids).size !== ids.length || !diagnostic.taskEvidence.every((item) => evidenceMatchesManifest(item, { terminal: requireAllTerminal }))) return false;
    return !requireAllTerminal || (
      diagnostic.taskEvidence.length === DIAGNOSTIC_TASK_IDS.length &&
      DIAGNOSTIC_TASK_IDS.every((taskId) => ids.includes(taskId))
    );
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
  const archiveSupersededCycle = () => {
    const cycle = activeCycle();
    if (!cycle?.diagnosticSessionId) return;
    const diagnostic = state.journey.diagnostic;
    const archivedEvidence = Array.isArray(diagnostic?.taskEvidence)
      ? diagnostic.taskEvidence.map((item) => ({
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
        }))
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
    const existing = Array.isArray(state.journey.supersededCycles) ? state.journey.supersededCycles : [];
    state.journey.supersededCycles = [...existing, receipt].slice(-10);
  };
  const resetDiagnosticDownstream = () => {
    state.journey.recommendation = null;
    state.journey.review = null;
    state.journey.peerHelp = null;
    state.journey.retest = null;
    state.journey.planUpdate = null;
  };
  const retireCurrentPlanForNewDiagnostic = ({ supersededAt, reason }) => {
    const currentPlan = state.plan;
    if (!currentPlan) return { status: "no_current_plan" };
    if (
      typeof currentPlan.planId !== "string" ||
      !currentPlan.planId ||
      state.planHistory.some((plan) => plan?.planId === currentPlan.planId)
    ) {
      return { status: "plan_history_conflict" };
    }
    state.planHistory = [
      ...state.planHistory,
      {
        ...currentPlan,
        status: "superseded",
        supersededAt,
        supersededReason: reason,
      },
    ];
    state.plan = null;
    return { status: "retired", planId: currentPlan.planId };
  };

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
        return !expected || !Object.entries(expected).every(([key, value]) => actual[key] === value);
      })
    ) {
      showStorageWarning("诊断任务清单与运行时版本不一致；为避免形成错误回执，本页已停止写入。请刷新或联系维护者。");
      disableJourneyControls();
      return;
    }
    const startForm = document.querySelector("#diagnostic-start-form");
    const priorityForm = document.querySelector("#diagnostic-priority-form");
    const message = document.querySelector("[data-diagnostic-message]");
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
      if (hasDownstream && !window.confirm("开始新一轮诊断会关闭当前未完成闭环的后续连接，并仅归档不含作文原文或首答内容的证据摘要；当前计划将作为历史保留，不再显示为当前计划。确定继续吗？")) return;
      const outcome = await withExclusiveJourneyWrite(async () => {
        const snapshot = snapshotState();
        archiveSupersededCycle();
        const diagnosticSessionId = makeId("diagnostic");
        const createdAt = isoNow();
        const retiredPlan = retireCurrentPlanForNewDiagnostic({
          supersededAt: createdAt,
          reason: "learner_started_new_gate_a_evidence_pack",
        });
        if (retiredPlan.status === "plan_history_conflict") {
          state = snapshot;
          return retiredPlan;
        }
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
          createdAt,
          updatedAt: createdAt,
        };
        state.journey.activeCycle = cycle;
        state.journey.diagnostic = {
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
            viewportMode: window.innerWidth >= 820 ? "desktop_or_tablet" : "mobile_lightweight",
            networkAtStart: navigator.onLine ? "online" : "offline",
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
        resetDiagnosticDownstream();
        const eventOutcome = await appendLearningEvent("learning_cycle.started", {
          cycle,
          diagnostic: state.journey.diagnostic,
        });
        if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
          state = snapshot;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        if (!persist()) {
          state = snapshot;
          return { status: "persist_failed" };
        }
        return { status: "saved" };
      });
      if (outcome.status !== "saved") {
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁，新诊断会话未建立。"
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
        const durationSeconds = Math.max(0, Math.round((Date.now() - Date.parse(current.startedAt)) / 1000));
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
        replaceDiagnosticEvidence(diagnostic, {
          ...current,
          audioPlayed: true,
          audioCompleted: false,
          audioStartedNearBeginning: current.audioStartedNearBeginning === true || audio.currentTime <= 0.25,
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
        replaceDiagnosticEvidence(diagnostic, appendQualityFlag({ ...current, audioCompleted: false, audioSeekDetected: true }, "audio_seek_detected"));
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
          replaceDiagnosticEvidence(latest.diagnostic, {
            ...latest.evidence,
            audioPlayed: true,
            audioCompleted: false,
            speechSynthesisStarted: true,
            speechVoice: selectedVoice
              ? { lang: String(selectedVoice.lang || "unknown").slice(0, 20), localService: Boolean(selectedVoice.localService), default: Boolean(selectedVoice.default) }
              : { lang: "browser-default", localService: false, default: true },
            playCount: Number(latest.evidence.playCount || 0) + 1,
            qualityFlags: unique([...(latest.evidence.qualityFlags || []), ...voiceFlags]),
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
      button.addEventListener("click", async () => {
        if (!window.confirm("重新开始会归档当前会话的任务状态与质量摘要（不含作文原文或首答内容），并清除本轮尚未完成的后续连接；当前计划将转入历史，不再显示为当前计划。确定继续吗？")) return;
        const outcome = await withExclusiveJourneyWrite(async () => {
          const snapshot = snapshotState();
          archiveSupersededCycle();
          const retiredPlan = retireCurrentPlanForNewDiagnostic({
            supersededAt: isoNow(),
            reason: "learner_restarted_gate_a_evidence_pack",
          });
          if (retiredPlan.status === "plan_history_conflict") {
            state = snapshot;
            return retiredPlan;
          }
          state.journey.activeCycle = null;
          state.journey.diagnostic = null;
          resetDiagnosticDownstream();
          if (!persist()) {
            state = snapshot;
            return { status: "persist_failed" };
          }
          return { status: "saved" };
        });
        if (outcome.status !== "saved") {
          if (message) message.textContent = outcome.status === "plan_history_conflict"
            ? "当前计划与历史计划出现重复标识；为避免覆盖，本轮没有重新开始。请先导出本机数据后再处理。"
            : outcome.status === "persist_failed"
              ? "当前无法保存；原诊断、计划与闭环记录保持不变。"
              : "当前浏览器无法取得安全写入锁；原诊断、计划与闭环记录保持不变。";
          return;
        }
        clearDiagnosticTimer();
        window.clearTimeout(diagnosticWritingSaveTimer);
        diagnosticWritingSaveTimer = null;
        stopDiagnosticPlayback();
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
  const createRecommendationBinding = (chain, primary) => {
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
      createdAt: isoNow(),
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

        const before = snapshotState();
        const recommendationId = makeId("recommendation");
        const evidenceBinding = createRecommendationBinding(latestChain, items[0]);
        if (!evidenceBinding) return { status: "binding_invalid" };
        state.journey.recommendation = {
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
          updatedAt: isoNow(),
          createdAt: isoNow(),
        };
        latestCycle.recommendationId = recommendationId;
        latestCycle.checkInId = null;
        latestCycle.reviewId = null;
        latestCycle.peerHelpId = null;
        latestCycle.retestId = null;
        latestCycle.updatedPlanId = null;
        latestCycle.updatedAt = isoNow();
        state.journey.review = null;
        state.journey.peerHelp = null;
        state.journey.retest = null;
        state.journey.planUpdate = null;
        const eventOutcome = await appendLearningEvent("recommendation.decided", {
          recommendation: state.journey.recommendation,
        });
        if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
          state = before;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
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
    used: "已使用演示经验卡",
    declined: "谢绝社区互助",
    not_needed: "本轮不需要互助",
    unavailable: "真实社区暂不可用",
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
    setText("[data-community-message]", "自愿状态已保存在本机；四种选择都不会降低服务或阻断闭环。");
  };

  const setupCommunity = () => {
    const form = document.querySelector("#community-form");
    if (!form) return;
    const chain = validateCycleEvidence();
    const cycle = chain.cycle;
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
      form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-community-status]", "互助状态已封存");
      setText("[data-community-message]", "本轮已形成 retest_id 或更新计划；为保护首份平行任务证据，互助状态不能再覆盖。请从新一轮诊断开始变更方向。");
      return;
    }
    if (!gateReady) {
      form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-community-status]", cycle?.status === "completed" ? "上一轮已记录" : "等待学生确认复盘");
      setText("[data-community-message]", "请先在当前 cycle_id 中保存证据式打卡，并由学习者明确确认复盘。 ");
      return;
    }
    renderCommunity();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const selected = form.querySelector('input[name="peerHelpStatus"]:checked')?.value;
      const message = document.querySelector("[data-community-message]");
      if (!VALID_PEER_HELP_STATES.has(selected)) {
        if (message) message.textContent = "请选择一种自愿状态后再保存。";
        form.querySelector('input[name="peerHelpStatus"]')?.focus();
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
      state.journey.peerHelp = {
        peerHelpId,
        cycleId: cycle.cycleId,
        planId: cycle.basePlanId,
        reviewId: cycle.reviewId,
        status: selected,
        source: "synthetic_demo_card_v1",
        learnerChoice: true,
        realCommunityUsed: false,
        updatedAt: isoNow(),
        createdAt: previous?.createdAt || isoNow(),
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

        const before = snapshotState();
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
        state.journey.retest = {
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
        cycle.retestId = retestId;
        cycle.updatedPlanId = null;
        cycle.updatedAt = isoNow();
        state.journey.planUpdate = null;
        const eventOutcome = await appendLearningEvent("retest.completed", {
          retest: state.journey.retest,
          recommendation: state.journey.recommendation,
        });
        if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
          state = before;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
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
      const outcome = await withExclusiveJourneyWrite(async () => {
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

        const stateBeforeUpdate = snapshotState();
        const previousPlan = state.plan;
        const closedAt = isoNow();
        state.planHistory = [
          ...state.planHistory,
          { ...previousPlan, status: "superseded", supersededAt: closedAt, supersededByRetestId: retest.retestId },
        ];
        state.profile = { ...state.profile, focusSkill };
        const nextPlan = createPlan(state.profile, {
          source: provisional
            ? "learner_selected_provisional_followup_pending_human_review"
            : "learner_confirmed_parallel_retest_followup",
          cycleId: cycle.cycleId,
          diagnosticSessionId: cycle.diagnosticSessionId,
          taskSetVersion: state.journey.diagnostic.taskSetVersion,
          taskSetDigest: state.journey.diagnostic.taskSetDigest,
          retestId: retest.retestId,
          supersedesPlanId: cycle.basePlanId,
        });
        state.plan = nextPlan;
        state.journey.planUpdate = {
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
        cycle.updatedPlanId = nextPlan.planId;
        cycle.status = provisional ? "provisional_pending_human_review" : "completed";
        cycle.closedAt = provisional ? null : closedAt;
        cycle.provisionalAt = provisional ? closedAt : null;
        cycle.updatedAt = closedAt;
        state.journey.history = [
          ...state.journey.history,
          {
            ...cycle,
            status: cycle.status,
            diagnostic: state.journey.diagnostic,
            recommendation: state.journey.recommendation,
            checkIn: getCycleCheckIn(),
            review: state.journey.review,
            peerHelp: state.journey.peerHelp,
            retest,
            planUpdate: state.journey.planUpdate,
          },
        ];
        if (!provisional) {
          const eventOutcome = await appendLearningEvent("learning_cycle.completed", {
            cycle,
            retest,
            planUpdate: state.journey.planUpdate,
          });
          if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
            state = stateBeforeUpdate;
            return { status: eventOutcome.status, code: eventOutcome.code };
          }
        }
        if (!persist()) {
          state = stateBeforeUpdate;
          return { status: "persist_failed" };
        }
        return { status: "saved", provisional };
      });
      if (outcome.status !== "saved") {
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；更新计划与闭环关闭均未形成正式本机记录。"
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
