(async () => {
  "use strict";

  const STORAGE_KEY = "sufeiya_workspace_v1";
  const SCHEMA_VERSION = 1;
  const PROTOCOL_VERSION = "gate_a_local_v1";
  const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
  const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
  const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
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
  const todayKey = () => keyForDate(new Date());
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
    for (const key of ["taskProgress", "practice", "checkIns"]) {
      if (value[key] !== undefined && !isRecord(value[key])) return null;
    }
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

  const validateCycleEvidence = () => {
    const cycle = activeCycle();
    const diagnostic = state.journey.diagnostic;
    const basePlan = planById(cycle?.basePlanId);
    const baseTaskIds = new Set(basePlan?.days?.flatMap((day) => day.tasks?.map((task) => task.taskId) || []) || []);
    const recommendation = state.journey.recommendation;
    const checkIn = getCycleCheckIn();
    const review = state.journey.review;
    const peerHelp = state.journey.peerHelp;
    const retest = state.journey.retest;
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
        baseTaskIds.has(recommendation?.primary?.taskId),
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
        baseTaskIds.has(checkIn?.linkedTaskId),
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
        retest?.parallelRetest === true &&
        retest?.automatedScoreProduced === false &&
        retest?.growthClaimProduced === false,
    );
    const updateComplete = Boolean(
      retestEvidenceComplete &&
        cycle?.status === "completed" &&
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

    return {
      cycle,
      diagnostic,
      basePlan,
      recommendation,
      checkIn,
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
      updateComplete,
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

    if (evidenceGapCandidates.length > 1) {
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
    if (writing) patterns.push(`Writing 留下 ${writingWords} 个英文词与 ${writingChecks} / 3 项自查；没有自动语言评价。`);
    if (speaking) patterns.push(`Speaking 记录 ${Number(speaking.durationSeconds || 0)} 秒计时与 ${speakingChecks} / 3 项自查；没有录音。`);

    const qualityFlags = unique(taskEvidence.flatMap((item) => (Array.isArray(item.qualityFlags) ? item.qualityFlags : [])));
    const quality = qualityFlags.map((flag) => qualityFlagLabels[flag] || `证据质量标记：${flag}`);
    if (!quality.includes(qualityFlagLabels.open_response_not_human_reviewed)) {
      quality.push(qualityFlagLabels.open_response_not_human_reviewed);
    }
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
          detail: `自查 ${speakingChecks} / 3；不录音，不评价发音或流利度。`,
        },
        Writing: {
          label: "Writing · 写作",
          headline: writing ? `${writingWords} 词本机作答` : "未形成写作证据",
          detail: `自查 ${writingChecks} / 3；未经人工审核，不评价语言水平。`,
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
      note.textContent = report.priorityCandidates.length > 1 ? "证据并列，由你确认先后顺序" : priorityBasisLabels[report.priorityBasis] || "下一条证据优先项";
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
        `已完成 ${diagnostic.completedEvidenceTaskCount} 项任务证据，并由学习者确认下一步先关注 ${skillLabels[diagnostic.prioritySkill]}。这不是自动能力诊断。`,
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

    startForm?.addEventListener("submit", (event) => {
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
      if (hasDownstream && !window.confirm("开始新一轮诊断会关闭当前未完成闭环的后续连接，并仅归档不含作文原文或首答内容的证据摘要；旧计划本身仍保留。确定继续吗？")) return;
      const snapshot = JSON.parse(JSON.stringify(state));
      archiveSupersededCycle();
      const diagnosticSessionId = makeId("diagnostic");
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
        createdAt: isoNow(),
        updatedAt: isoNow(),
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
          confirmedAt: isoNow(),
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
          completedAt: isoNow(),
        },
        taskEvidence: [],
        activeTaskId: DIAGNOSTIC_TASK_IDS[0],
        automatedScoreProduced: false,
        formalDiagnosisProduced: false,
        officialEquivalenceClaimed: false,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };
      resetDiagnosticDownstream();
      if (!persist()) {
        state = snapshot;
        if (message) message.textContent = "当前无法保存，新诊断会话未建立，原本机记录保持不变。";
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
      button.addEventListener("click", () => {
        if (!window.confirm("重新开始会归档当前会话的任务状态与质量摘要（不含作文原文或首答内容），并清除本轮尚未完成的后续连接；旧计划本身仍保留。确定继续吗？")) return;
        const snapshot = JSON.parse(JSON.stringify(state));
        archiveSupersededCycle();
        state.journey.activeCycle = null;
        state.journey.diagnostic = null;
        resetDiagnosticDownstream();
        if (!persist()) {
          state = snapshot;
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

  const getCurrentPlanDay = () => {
    if (!state.plan?.days?.length) return null;
    return state.plan.days.find((day) => day.date === todayKey()) || state.plan.days[0];
  };

  const recommendationItems = () => {
    const day = getCurrentPlanDay();
    if (!day) return [];
    const coreTask = day.tasks?.find((task) => task.skill === day.coreSkill) || day.tasks?.[0];
    if (!coreTask) return [];
    return [
      {
        role: "主任务",
        taskId: coreTask.taskId,
        contentId: `gate-a-${String(day.coreSkill).toLowerCase()}-practice`,
        contentVersion: "v1",
        title: coreTask.titleZh,
        route: coreTask.route,
        reason: `当前 7 天计划把 ${skillLabels[day.coreSkill] || day.coreSkill} 设为这一天的核心练习。`,
        duration: `${coreTask.durationMinutes} 分钟`,
        source: "Sufeiya 原创 Gate A 微练习 v1",
        verification: "完成任务后，在复盘页留下具体学习证据。",
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
    if (start) start.hidden = recommendation.status !== "accepted";
    setText("[data-recommendation-id]", recommendation.recommendationId);
    setText("[data-recommendation-plan-id]", recommendation.planId);
    setText("[data-recommendation-status]", recommendation.status === "accepted" ? "已接受主任务" : "已明确跳过");
    setText(
      "[data-recommendation-message]",
      recommendation.status === "accepted"
        ? "已保存接受状态；完成仍以任务记录与学习复盘为准。"
        : "已保存谢绝状态；跳过不会产生惩罚或阻断后续步骤。",
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
      state.journey.recommendation?.recommendationId === cycle.recommendationId &&
      state.journey.recommendation?.planId === cycle.basePlanId &&
      state.journey.recommendation?.cycleId === cycle.cycleId
        ? state.journey.recommendation
        : null;
    renderRecommendationReceipt(saved);
    if (!saved) setText("[data-recommendation-status]", "等待你的选择");

    const saveChoice = async (status) => {
      const outcome = await withExclusiveJourneyWrite(() => {
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
          previous?.recommendationId === latestCycle.recommendationId &&
          previous?.cycleId === latestCycle.cycleId &&
          previous?.planId === latestCycle.basePlanId
        ) return { status: "already_saved", record: previous };

        const before = snapshotState();
        const recommendationId = makeId("recommendation");
        state.journey.recommendation = {
          recommendationId,
          cycleId: latestCycle.cycleId,
          planId: latestCycle.basePlanId,
          diagnosticSessionId: latestCycle.diagnosticSessionId,
          status,
          itemCount: items.length,
          primary: items[0],
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
      setText("[data-review-status]", "学习者已确认");
      setText("[data-review-id]", review.reviewId);
      setText("[data-review-checkin-id]", record.checkInId);
      setText("[data-review-message]", "这份复盘已经由学习者明确确认并保存在本机。");
      return;
    }
    setText("[data-review-status]", "等待你的明确确认");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = document.querySelector("[data-review-message]");
      if (!form.elements.learnerConfirmed.checked) {
        if (message) message.textContent = "请先核对记录，并勾选学习者确认。";
        form.elements.learnerConfirmed.focus();
        return;
      }
      const latestChain = validateCycleEvidence();
      if (
        !latestChain.checkInComplete ||
        latestChain.cycle?.cycleId !== cycle.cycleId ||
        latestChain.checkIn?.checkInId !== record.checkInId
      ) {
        if (message) message.textContent = "待确认记录已经变化，请刷新后重新核对。";
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
        if (message) message.textContent = "当前无法保存；本次确认尚未形成正式 review_id。";
        return;
      }
      form.hidden = true;
      if (receipt) receipt.hidden = false;
      if (next) next.hidden = false;
      setText("[data-review-status]", "学习者已确认");
      setText("[data-review-id]", reviewId);
      setText("[data-review-checkin-id]", record.checkInId);
      setText("[data-review-message]", "复盘确认已保存在本机。");
    });
  };

  const renderCommunity = () => {
    const chain = validateCycleEvidence();
    const peerHelp = chain.peerHelp;
    const receipt = document.querySelector("[data-community-receipt]");
    if (!chain.peerHelpComplete) {
      if (receipt) receipt.hidden = true;
      return;
    }
    const radio = document.querySelector(`input[name="peerHelpStatus"][value="${peerHelp.status}"]`);
    if (radio) radio.checked = true;
    if (receipt) receipt.hidden = false;
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

  const readRetestEvidence = (form, skill) => {
    if (skill === "Reading" || skill === "Listening") {
      const fieldName = skill === "Reading" ? "retestReading" : "retestListening";
      const selected = form.querySelector(`input[name="${fieldName}"]:checked`)?.value;
      if (!selected) return { error: "请先选择一个答案。" };
      const correctValue = skill === "Reading" ? "b" : "c";
      return {
        evidence: {
          responseType: "single_choice",
          selectedAnswer: selected,
          resultType: selected === correctValue ? "single_task_correct" : "single_task_needs_review",
        },
      };
    }
    if (skill === "Writing") {
      const value = form.elements.retestWriting.value.trim();
      const words = value ? value.split(/\s+/).filter(Boolean).length : 0;
      const checks = [...form.querySelectorAll("[data-retest-writing-review]")];
      if (words < 20 || !checks.every((item) => item.checked)) {
        return { error: "Writing 任务需要至少 20 个英文词，并完成三项自查。" };
      }
      return { evidence: { responseType: "self_reviewed_writing", wordCount: words, selfChecksComplete: true, resultType: "task_completed_no_score" } };
    }
    if (skill === "Speaking") {
      const checks = [...form.querySelectorAll("[data-retest-speaking-review]")];
      if (!checks.every((item) => item.checked)) return { error: "请先大声完成任务并勾选三项自查。" };
      return { evidence: { responseType: "learner_confirmed_speaking", selfChecksComplete: true, audioRecorded: false, resultType: "task_completed_no_score" } };
    }
    return { error: "无法识别所选任务，请刷新后重试。" };
  };

  const retestGate = () => {
    const chain = validateCycleEvidence();
    const { cycle, checkIn: record, review, peerHelp } = chain;
    const evidenceAlreadyRecorded = chain.retestEvidenceComplete;
    const ready = Boolean(
      cycle?.status === "in_progress" &&
        cycle.basePlanId === state.plan?.planId &&
        chain.preRetestComplete &&
        !evidenceAlreadyRecorded,
    );
    return { cycle, record, review, peerHelp, ready, evidenceAlreadyRecorded, completed: chain.updateComplete };
  };

  const renderRetest = () => {
    const chain = validateCycleEvidence();
    const { retest, planUpdate } = chain;
    const result = document.querySelector("[data-retest-result]");
    const updateForm = document.querySelector("#plan-update-form");
    if (!chain.retestEvidenceComplete) {
      if (result) result.hidden = true;
      if (updateForm) updateForm.hidden = true;
      return;
    }
    const selector = document.querySelector("[data-retest-skill]");
    if (selector) selector.value = retest.skill;
    showRetestPanel(retest.skill);
    if (result) result.hidden = false;
    if (updateForm) updateForm.hidden = false;
    setText(
      "[data-retest-status]",
      retest.evidenceStatus === "needs_review" ? "已完成，单题需复核" : "平行任务已留证",
    );
    setText("[data-retest-id]", retest.retestId);
    setText(
      "[data-retest-result-copy]",
      retest.evidence.resultType === "single_task_correct"
        ? "本次单题回答正确；这只描述当前任务，不证明能力增长或分数变化。"
        : "本次任务已经完成并保存；结果不形成分数、能力等级或增长结论。",
    );

    const receipt = document.querySelector("[data-plan-update-receipt]");
    if (chain.updateComplete) {
      if (receipt) receipt.hidden = false;
      if (updateForm) updateForm.hidden = true;
      setText("[data-updated-plan-id]", planUpdate.updatedPlanId);
      setText("[data-superseded-plan-id]", planUpdate.supersedesPlanId);
      setText("[data-plan-update-message]", "学习者已确认下一轮重点，更新后的计划已保存在本机。");
    } else if (receipt) {
      receipt.hidden = true;
    }
  };

  const setupRetest = () => {
    const form = document.querySelector("#retest-form");
    if (!form) return;
    const selector = document.querySelector("[data-retest-skill]");
    showRetestPanel(selector?.value || "Reading");
    selector?.addEventListener("change", () => showRetestPanel(selector.value));
    const initialGate = retestGate();
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
      const message = document.querySelector("[data-retest-message]");
      if (!VALID_SKILLS.has(skill) || skill === "Balanced") {
        if (message) message.textContent = "请选择一项平行任务。";
        return;
      }
      const { evidence, error } = readRetestEvidence(form, skill);
      if (error) {
        if (message) message.textContent = error;
        return;
      }
      const outcome = await withExclusiveJourneyWrite(() => {
        if (!persistedStateIsFresh()) return { status: "stale" };
        const { cycle, record, review, peerHelp, ready, evidenceAlreadyRecorded } = retestGate();
        if (evidenceAlreadyRecorded) return { status: "already_saved" };
        if (!ready) return { status: "stale" };

        const before = snapshotState();
        const retestId = makeId("retest");
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
          taskVersion: `${skill.toLowerCase()}-parallel-v1`,
          status: "completed",
          parallelRetest: true,
          comparability: { sameSkill: true, newOriginalPrompt: true, officialEquivalenceClaimed: false },
          evidenceStatus: evidence.resultType === "single_task_needs_review" ? "needs_review" : "limited_single_task",
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
              : "本机记录已在另一个页面发生变化；未覆盖首份平行任务，请刷新后核对。";
        if (outcome.status === "already_saved") form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
        return;
      }
      if (message) message.textContent = "平行任务证据已保存在本机；请由你确认下一轮重点。";
      form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
      renderRetest();
      document.querySelector("[data-retest-result]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const updateForm = document.querySelector("#plan-update-form");
    updateForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("[data-plan-update-message]");
      const focusSkill = updateForm.elements.nextFocusSkill.value;
      if (!VALID_SKILLS.has(focusSkill)) {
        if (message) message.textContent = "请选择可识别的下一轮重点。";
        return;
      }
      if (!updateForm.elements.learnerConfirmed.checked) {
        if (message) message.textContent = "请确认这是你自己的下一轮学习计划选择。";
        updateForm.elements.learnerConfirmed.focus();
        return;
      }
      const outcome = await withExclusiveJourneyWrite(() => {
        if (!persistedStateIsFresh()) return { status: "stale" };
        const chain = validateCycleEvidence();
        const { cycle, retest } = chain;
        const exactChain = Boolean(
          cycle?.status === "in_progress" &&
            chain.retestEvidenceComplete &&
            state.plan?.planId === cycle.basePlanId,
        );
        if (!exactChain) return { status: "chain_changed" };

        const stateBeforeUpdate = snapshotState();
        const previousPlan = state.plan;
        const closedAt = isoNow();
        state.planHistory = [
          ...state.planHistory,
          { ...previousPlan, status: "superseded", supersededAt: closedAt, supersededByRetestId: retest.retestId },
        ];
        state.profile = { ...state.profile, focusSkill };
        const nextPlan = createPlan(state.profile, {
          source: "learner_confirmed_parallel_retest_followup",
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
          automatedAbilityDecision: false,
          createdAt: closedAt,
        };
        cycle.updatedPlanId = nextPlan.planId;
        cycle.status = "completed";
        cycle.closedAt = closedAt;
        cycle.updatedAt = closedAt;
        state.journey.history = [
          ...state.journey.history,
          {
            ...cycle,
            status: "completed",
            diagnostic: state.journey.diagnostic,
            recommendation: state.journey.recommendation,
            checkIn: getCycleCheckIn(),
            review: state.journey.review,
            peerHelp: state.journey.peerHelp,
            retest,
            planUpdate: state.journey.planUpdate,
          },
        ];
        if (!persist()) {
          state = stateBeforeUpdate;
          return { status: "persist_failed" };
        }
        return { status: "saved" };
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
      if (message) message.textContent = "更新后的 7 天计划已生成，旧计划完整归档，本轮闭环已关闭。";
      renderRetest();
    });
  };

  const journeyDefinitions = [
    { key: "diagnostic", title: "完成六任务诊断证据包", copy: "先完成设备预检，再依次留下六项原创任务证据与学习者确认的优先项。", route: "/diagnostic" },
    { key: "plan", title: "生成可编辑的 7 天计划", copy: "把学习者确认的重点与每天可用时间变成具体任务。", route: "/plan" },
    { key: "recommendation", title: "接受或明确跳过推荐", copy: "查看原因、时长、来源与验证方式，再保存自己的选择。", route: "/recommendations" },
    { key: "checkin", title: "保存证据式打卡", copy: "同时写清做了什么、一条学习证据和仍待解决的问题。", route: "/check-in" },
    { key: "review", title: "由学习者确认复盘", copy: "核对刚才的打卡内容，确认准确或返回修正。", route: "/review" },
    { key: "community", title: "保存自愿互助状态", copy: "使用、谢绝、不需要或暂不可用，四种选择都可继续。", route: "/community" },
    { key: "retest", title: "完成平行任务并确认更新计划", copy: "保存一条新任务证据，再由你选择下一轮重点。", route: "/retest" },
  ];

  const evaluateJourney = () => {
    const chain = validateCycleEvidence();
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
    const labels = [
      diagnostic?.evidenceSufficiency === "evidence_insufficient" ? "六任务完成，证据不足" : "六任务完成，证据有限",
      "计划已连接",
      recommendation?.status === "skipped" ? "已明确跳过" : "已接受",
      "打卡已保存",
      "学习者已确认",
      peerHelpLabels[peerHelp?.status] || "状态已记录",
      retest?.evidenceStatus === "needs_review" ? "已完成，需复核" : "微复测与计划已更新",
    ];
    return journeyDefinitions.map((definition, index) => {
      const complete = Boolean(raw[index] && previousComplete);
      previousComplete = complete;
      return { ...definition, rawComplete: raw[index], complete, completeLabel: labels[index] };
    });
  };

  const renderJourneyDashboard = () => {
    if (!document.querySelector("[data-journey-list]")) return;
    const status = evaluateJourney();
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
        if (label) label.textContent = "下一步";
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
  };

  const workspaceWriterLeaseAvailable = await acquireSharedWorkspaceWriterLease();
  if (!workspaceWriterLeaseAvailable) storageWritable = false;
  loadState();
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
