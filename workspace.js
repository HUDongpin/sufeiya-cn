(async () => {
  const STORAGE_KEY = "sufeiya_workspace_v1";
  const SUPER_TEACHER_STORAGE_KEY = "sufeiya_super_teacher_v1";
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
  const DIAGNOSTIC_TERMINAL_STATES = new Set(["completed", "skipped", "evidence_insufficient", "unavailable"]);
  const DIAGNOSTIC_SKILLS = new Set(["Reading", "Listening", "Writing", "Speaking"]);
  const todayKey = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const freshState = () => ({
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    profile: { nickname: "", examDate: "", dailyMinutes: 30, focusSkill: "Balanced" },
    plan: null,
    planHistory: [],
    taskProgress: {},
    practice: {},
    checkIns: {},
    checkInHistory: [],
    focus: { active: null, sessions: [] },
    journey: { protocolVersion: "gate_a_local_v1", activeCycle: null, history: [] },
  });

  let state = freshState();
  let storageWritable = true;
  let rawStoredValue = null;
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
  const completedDiagnosticCycle = () => {
    const cycle = state.journey?.activeCycle;
    const diagnostic = state.journey?.diagnostic;
    const evidence = Array.isArray(diagnostic?.taskEvidence) ? diagnostic.taskEvidence : [];
    const expectedIds = Object.keys(DIAGNOSTIC_TASK_MANIFEST);
    const evidenceIds = evidence.map((item) => item?.taskId);
    const evidenceValid =
      evidence.length === expectedIds.length &&
      new Set(evidenceIds).size === expectedIds.length &&
      expectedIds.every((taskId) => evidenceIds.includes(taskId)) &&
      evidence.every((item) => {
        if (!isRecord(item) || !DIAGNOSTIC_TERMINAL_STATES.has(item.status) || !Array.isArray(item.qualityFlags)) return false;
        const expected = DIAGNOSTIC_TASK_MANIFEST[item.taskId];
        if (!expected || !Object.entries(expected).every(([key, value]) => item[key] === value)) return false;
        if (!['evidence_limited', 'evidence_insufficient'].includes(item.evidenceStatus)) return false;
        if (["single_choice", "single_choice_audio"].includes(expected.responseType) && item.status === "completed") {
          return item.attempts === 1 && ["a", "b", "c"].includes(item.firstResponse) &&
            ["first_response_matched", "first_response_not_matched"].includes(item.resultType);
        }
        return true;
      });
    if (
      !isRecord(cycle) ||
      cycle.protocolVersion !== PROTOCOL_VERSION ||
      cycle.status !== "in_progress" ||
      !isRecord(diagnostic) ||
      diagnostic.protocolVersion !== PROTOCOL_VERSION ||
      diagnostic.diagnosticProtocolVersion !== DIAGNOSTIC_PROTOCOL_VERSION ||
      diagnostic.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      diagnostic.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST ||
      diagnostic.status !== "completed" ||
      diagnostic.adultConfirmed !== true ||
      diagnostic.devicePrecheck?.storageStatus !== "available" ||
      diagnostic.cycleId !== cycle.cycleId ||
      diagnostic.diagnosticSessionId !== cycle.diagnosticSessionId ||
      !DIAGNOSTIC_SKILLS.has(diagnostic.prioritySkill) ||
      diagnostic.learnerConfirmedPriority !== true ||
      diagnostic.automatedScoreProduced !== false ||
      diagnostic.formalDiagnosisProduced !== false ||
      !evidenceValid
    ) return null;
    return { cycle, diagnostic };
  };
  const completedPlanChain = () => {
    const linked = completedDiagnosticCycle();
    const plan = state.plan;
    if (
      !linked ||
      !isRecord(plan) ||
      plan.planId !== linked.cycle.basePlanId ||
      plan.diagnosticSessionId !== linked.cycle.diagnosticSessionId ||
      plan.provenance?.cycleId !== linked.cycle.cycleId ||
      plan.provenance?.diagnosticSessionId !== linked.cycle.diagnosticSessionId ||
      plan.provenance?.taskSetVersion !== DIAGNOSTIC_TASK_SET_VERSION ||
      plan.provenance?.taskSetDigest !== DIAGNOSTIC_TASK_SET_DIGEST
    ) return null;
    return { ...linked, plan };
  };
  const completedRecommendationChain = () => {
    const linked = completedPlanChain();
    const recommendation = state.journey?.recommendation;
    const taskIds = new Set(linked?.plan?.days?.flatMap((day) => day.tasks?.map((task) => task.taskId) || []) || []);
    if (
      !linked ||
      !isRecord(recommendation) ||
      recommendation.recommendationId !== linked.cycle.recommendationId ||
      recommendation.cycleId !== linked.cycle.cycleId ||
      recommendation.diagnosticSessionId !== linked.cycle.diagnosticSessionId ||
      recommendation.planId !== linked.cycle.basePlanId ||
      !["accepted", "skipped"].includes(recommendation.status) ||
      !taskIds.has(recommendation.primary?.taskId)
    ) return null;
    return { ...linked, recommendation };
  };

  const showStorageWarning = (message = "当前浏览器无法持久保存。本次仍可继续，关闭页面后记录可能丢失。") => {
    if (storageWarningShown) return;
    storageWarningShown = true;
    const banner = document.createElement("div");
    banner.className = "storage-warning";
    banner.setAttribute("role", "status");
    banner.textContent = message;
    document.querySelector("main")?.before(banner);
  };

  const normalizeState = (value) => {
    const base = freshState();
    if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) return null;
    if (!hasValidPlanShape(value.plan)) return null;
    if (value.profile !== undefined && !isRecord(value.profile)) return null;
    if (value.journey !== undefined) {
      if (!isRecord(value.journey) || value.journey.protocolVersion !== "gate_a_local_v1") return null;
      if (
        value.journey.activeCycle !== undefined &&
        value.journey.activeCycle !== null &&
        (!isRecord(value.journey.activeCycle) || value.journey.activeCycle.protocolVersion !== "gate_a_local_v1")
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
    if (value.focus !== undefined && !isRecord(value.focus)) return null;
    if (value.focus?.sessions !== undefined && !Array.isArray(value.focus.sessions)) return null;
    if (value.focus?.active !== undefined && value.focus.active !== null && !isRecord(value.focus.active)) return null;
    return {
      ...base,
      ...value,
      profile: { ...base.profile, ...(value.profile || {}) },
      planHistory: Array.isArray(value.planHistory) ? value.planHistory : [],
      taskProgress: value.taskProgress && typeof value.taskProgress === "object" ? value.taskProgress : {},
      practice: value.practice && typeof value.practice === "object" ? value.practice : {},
      checkIns: value.checkIns && typeof value.checkIns === "object" ? value.checkIns : {},
      checkInHistory: Array.isArray(value.checkInHistory) ? value.checkInHistory : [],
      focus: {
        active: value.focus?.active || null,
        sessions: Array.isArray(value.focus?.sessions) ? value.focus.sessions : [],
      },
      journey: {
        ...base.journey,
        ...(value.journey || {}),
        history: Array.isArray(value.journey?.history) ? value.journey.history : [],
      },
    };
  };

  const loadState = () => {
    try {
      rawStoredValue = window.localStorage.getItem(STORAGE_KEY);
      if (!rawStoredValue) return;
      const parsed = JSON.parse(rawStoredValue);
      const normalized = normalizeState(parsed);
      if (!normalized) {
        storageWritable = false;
        showStorageWarning("发现无法识别的本机学习数据。为避免覆盖，当前仅以内存模式运行；可前往“我的本机数据”导出原始内容或清除后重建。");
        return;
      }
      state = normalized;
    } catch {
      storageWritable = false;
      showStorageWarning("当前本机学习数据无法读取。为避免覆盖，当前仅以内存模式运行；可前往“我的本机数据”导出原始内容或清除后重建。");
    }
  };

  const persist = () => {
    state.updatedAt = new Date().toISOString();
    if (!storageWritable) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      storageWritable = false;
      showStorageWarning();
      return false;
    }
  };

  const disableWorkspaceControls = () => {
    document.querySelectorAll("main button, main input, main select, main textarea").forEach((control) => {
      if (!control.matches("[data-export-workspace]")) control.disabled = true;
    });
  };

  const pad = (value) => String(value).padStart(2, "0");
  const formatClock = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(Math.max(0, seconds % 60))}`;
  const formatDate = (value, withYear = false) => {
    const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
    return new Intl.DateTimeFormat("zh-CN", {
      ...(withYear ? { year: "numeric" } : {}),
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(date);
  };
  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };
  const keyForDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
    disableWorkspaceControls();
  }

  document.querySelectorAll("[data-today-date]").forEach((node) => {
    node.dateTime = todayKey();
    node.textContent = formatDate(new Date(), true);
  });
  document.querySelectorAll("[data-checkin-date]").forEach((node) => {
    node.textContent = formatDate(new Date(), true);
  });
  document.querySelectorAll("[data-checkin-date-input]").forEach((node) => {
    node.value = todayKey();
  });
  document.querySelectorAll("[data-exam-date]").forEach((node) => {
    node.min = todayKey();
  });

  const skillLabels = {
    Balanced: "综合",
    Reading: "Reading · 阅读",
    Listening: "Listening · 听力",
    Writing: "Writing · 写作",
    Speaking: "Speaking · 口语",
    Reflection: "复盘",
    General: "热身",
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

  const createPlan = ({ nickname, examDate, dailyMinutes, focusSkill }) => {
    const linkedDiagnostic = completedDiagnosticCycle();
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const planId = `plan-${Date.now().toString(36)}`;
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
      createdAt: new Date().toISOString(),
      startDate: days[0].date,
      endDate: days[6].date,
      status: "active",
      days,
      nickname,
      examDate,
      dailyMinutes: minutes,
      focusSkill,
      diagnosticSessionId: linkedDiagnostic ? linkedDiagnostic.cycle.diagnosticSessionId : null,
      provenance:
        linkedDiagnostic
          ? {
              source: "learner_configured_after_gate_a_evidence_diagnostic",
              cycleId: linkedDiagnostic.cycle.cycleId,
              diagnosticSessionId: linkedDiagnostic.cycle.diagnosticSessionId,
              taskSetVersion: linkedDiagnostic.diagnostic.taskSetVersion,
              taskSetDigest: linkedDiagnostic.diagnostic.taskSetDigest,
              priorityBasis: linkedDiagnostic.diagnostic.priorityBasis || null,
            }
          : { source: "learner_configured_standalone" },
    };
  };

  const clearChildren = (node) => node?.replaceChildren();

  const renderPlan = () => {
    const empty = document.querySelector("[data-plan-empty]");
    const result = document.querySelector("[data-plan-result]");
    const list = document.querySelector("[data-plan-days]");
    const status = document.querySelector("[data-plan-status]");
    if (!empty || !result || !list) return;
    if (!state.plan) {
      empty.hidden = false;
      result.hidden = true;
      if (status) status.textContent = "尚未生成";
      return;
    }

    empty.hidden = true;
    result.hidden = false;
    if (status) status.textContent = `已生成 · ${formatDate(state.plan.startDate)}`;
    const owner = document.querySelector("[data-plan-owner]");
    if (owner) owner.textContent = state.plan.nickname ? `${state.plan.nickname}的` : "你的";
    const summary = document.querySelector("[data-plan-summary]");
    if (summary) {
      const examCopy = state.plan.examDate ? ` · 距预计考试 ${Math.max(0, Math.ceil((new Date(`${state.plan.examDate}T12:00:00`) - new Date()) / 86400000))} 天` : "";
      summary.textContent = `每天 ${state.plan.dailyMinutes} 分钟 · 重点：${skillLabels[state.plan.focusSkill]}${examCopy}`;
    }
    clearChildren(list);
    state.plan.days.forEach((day, index) => {
      const item = document.createElement("li");
      const date = document.createElement("time");
      date.dateTime = day.date;
      date.textContent = formatDate(day.date);
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `第 ${index + 1} 天 · ${skillLabels[day.coreSkill]}`;
      const detail = document.createElement("p");
      detail.textContent = day.tasks.map((task) => `${task.titleZh} ${task.durationMinutes} 分钟`).join(" · ");
      const route = document.createElement("a");
      route.href = skillRoutes[day.coreSkill];
      route.textContent = "打开核心练习 →";
      copy.append(title, detail, route);
      item.append(date, copy);
      list.append(item);
    });
  };

  const planForm = document.querySelector("#plan-form");
  if (planForm) {
    const { nickname, examDate, dailyMinutes, focusSkill } = planForm.elements;
    nickname.value = state.profile.nickname || "";
    examDate.value = state.profile.examDate || "";
    dailyMinutes.value = String(state.profile.dailyMinutes || 30);
    focusSkill.value = state.profile.focusSkill || "Balanced";
    const focusNote = document.querySelector("[data-plan-focus-note]");
    if (focusNote && completedDiagnosticCycle()) {
      focusNote.textContent = "已根据六项任务证据与您的确认预填；仍可修改，最终计划以此处选择为准。";
    }
    renderPlan();

    planForm.addEventListener("submit", (event) => {
      event.preventDefault();
      planForm.querySelectorAll(".form-error").forEach((node) => node.remove());
      const selectedDate = examDate.value;
      if (selectedDate && selectedDate < todayKey()) {
        const error = document.createElement("small");
        error.className = "form-error";
        error.setAttribute("role", "alert");
        error.textContent = "预计考试日期不能早于今天。";
        examDate.closest("label")?.append(error);
        examDate.focus();
        return;
      }
      if (![15, 30, 45, 60].includes(Number(dailyMinutes.value)) || !sequences[focusSkill.value]) {
        showStorageWarning("计划设置无法识别，请刷新页面后重新选择。当前输入尚未丢失。");
        return;
      }
      const hasCompletedHistory = Object.values(state.taskProgress).some((progress) => progress?.status === "completed");
      if (state.plan && hasCompletedHistory && !window.confirm("重新生成会替换当前及未来计划；已经完成的历史记录会保留。确定继续吗？")) return;
      const previousPlan = state.plan;
      state.profile = {
        nickname: nickname.value.trim(),
        examDate: selectedDate,
        dailyMinutes: Number(dailyMinutes.value),
        focusSkill: focusSkill.value,
      };
      if (previousPlan) {
        state.planHistory = [
          ...state.planHistory,
          { ...previousPlan, status: "superseded", supersededAt: new Date().toISOString(), supersededReason: "learner_manual_regeneration" },
        ];
      }
      state.plan = createPlan(state.profile);
      const linkedDiagnostic = completedDiagnosticCycle();
      const activeCycle = linkedDiagnostic?.cycle;
      if (activeCycle && state.plan.diagnosticSessionId === activeCycle.diagnosticSessionId) {
        activeCycle.basePlanId = state.plan.planId;
        activeCycle.recommendationId = null;
        activeCycle.checkInId = null;
        activeCycle.reviewId = null;
        activeCycle.peerHelpId = null;
        activeCycle.retestId = null;
        activeCycle.updatedPlanId = null;
        activeCycle.updatedAt = new Date().toISOString();
        state.journey.recommendation = null;
        state.journey.review = null;
        state.journey.peerHelp = null;
        state.journey.retest = null;
        state.journey.planUpdate = null;
      }
      if (!persist()) return;
      renderPlan();
      document.querySelector("[data-plan-result]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const defaultTodayTasks = () => {
    const date = todayKey();
    return [
      { taskId: `default-${date}-reading`, date, skill: "Reading", titleZh: "Reading 微练习", instructionZh: "阅读本站原创英文短文并完成理解题。", durationMinutes: 8, route: "/practice-reading" },
      { taskId: `default-${date}-writing`, date, skill: "Writing", titleZh: "Writing 微练习", instructionZh: "完成英文写作提示，并使用三项英文自查。", durationMinutes: 10, route: "/practice-writing" },
      { taskId: `default-${date}-reflection`, date, skill: "Reflection", titleZh: "学习复盘", instructionZh: "写下今天完成的内容、具体证据与下一个问题。", durationMinutes: 5, route: "/check-in" },
    ];
  };

  const getTodayTasks = () => state.plan?.days?.find((day) => day.date === todayKey())?.tasks || defaultTodayTasks();
  const isTaskComplete = (task) => state.taskProgress[task.taskId]?.status === "completed";

  const updateHeroProgress = () => {
    const tasks = getTodayTasks();
    const completed = tasks.filter(isTaskComplete).length;
    document.querySelectorAll("[data-hero-progress]").forEach((node) => {
      node.textContent = `${completed} / ${tasks.length} 项任务`;
    });
  };

  const renderToday = () => {
    const list = document.querySelector("[data-today-tasks]");
    const tasks = getTodayTasks();
    const completed = tasks.filter(isTaskComplete).length;
    updateHeroProgress();
    if (!list) return;
    clearChildren(list);
    tasks.forEach((task, index) => {
      const item = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `today-task-${index}`;
      checkbox.checked = isTaskComplete(task);
      checkbox.dataset.taskId = task.taskId;
      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      const title = document.createElement("strong");
      title.textContent = task.titleZh;
      const detail = document.createElement("span");
      detail.textContent = `${task.instructionZh} · ${task.durationMinutes} 分钟`;
      label.append(title, detail);
      const route = document.createElement("a");
      route.className = "task-route";
      route.href = task.route;
      route.textContent = task.skill === "Reflection" ? "去复盘" : "开始";
      item.append(checkbox, label, route);
      list.append(item);
      checkbox.addEventListener("change", () => {
        state.taskProgress[task.taskId] = {
          status: checkbox.checked ? "completed" : "todo",
          updatedAt: new Date().toISOString(),
          completedAt: checkbox.checked ? new Date().toISOString() : null,
          selfReported: true,
        };
        persist();
        item.classList.toggle("is-complete", checkbox.checked);
        const updatedTasks = getTodayTasks();
        const updatedCompleted = updatedTasks.filter(isTaskComplete).length;
        const updatedProgress = document.querySelector("[data-task-progress]");
        if (updatedProgress) updatedProgress.value = updatedCompleted;
        document.querySelectorAll("[data-today-status]").forEach((node) => {
          node.textContent = `${updatedCompleted} / ${updatedTasks.length} 已完成`;
        });
        document.querySelectorAll("[data-task-progress-text]").forEach((node) => {
          node.textContent = `${Math.round((updatedCompleted / updatedTasks.length) * 100)}%`;
        });
        const updatedNext = updatedTasks.find((candidate) => !isTaskComplete(candidate));
        const updatedNextTitle = document.querySelector("[data-next-task]");
        const updatedNextDetail = document.querySelector("[data-next-task-detail]");
        if (updatedNextTitle) updatedNextTitle.textContent = updatedNext ? `下一项：${updatedNext.titleZh}` : "今天的任务已全部完成";
        if (updatedNextDetail) updatedNextDetail.textContent = updatedNext ? updatedNext.instructionZh : "请到学习复盘页记录真实困难与下一步。";
        updateHeroProgress();
      });
    });

    const progress = document.querySelector("[data-task-progress]");
    if (progress) {
      progress.max = tasks.length;
      progress.value = completed;
      progress.textContent = `${completed} / ${tasks.length}`;
    }
    document.querySelectorAll("[data-today-status]").forEach((node) => {
      node.textContent = `${completed} / ${tasks.length} 已完成`;
    });
    document.querySelectorAll("[data-task-progress-text]").forEach((node) => {
      node.textContent = `${Math.round((completed / tasks.length) * 100)}%`;
    });
    const next = tasks.find((task) => !isTaskComplete(task));
    const nextTitle = document.querySelector("[data-next-task]");
    const nextDetail = document.querySelector("[data-next-task-detail]");
    if (nextTitle) nextTitle.textContent = next ? `下一项：${next.titleZh}` : "今天的任务已全部完成";
    if (nextDetail) nextDetail.textContent = next ? next.instructionZh : "请到学习复盘页记录真实困难与下一步。";
  };
  renderToday();

  const markMatchingTaskComplete = (skill) => {
    const task = getTodayTasks().find((candidate) => candidate.skill === skill && !isTaskComplete(candidate));
    if (!task) return;
    state.taskProgress[task.taskId] = {
      status: "completed",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      selfReported: false,
      source: `practice-${skill.toLowerCase()}`,
    };
  };

  const setupChoicePractice = ({ name, exerciseId, correctValue, buttonSelector, feedbackSelector, explanation, skill }) => {
    const options = [...document.querySelectorAll(`input[name="${name}"]`)];
    const button = document.querySelector(buttonSelector);
    const feedback = document.querySelector(feedbackSelector);
    if (!options.length || !button || !feedback) return;
    const saved = state.practice[exerciseId] || {};
    if (saved.selectedAnswer) {
      const selected = options.find((option) => option.value === saved.selectedAnswer);
      if (selected) selected.checked = true;
    }
    button.disabled = !options.some((option) => option.checked);
    options.forEach((option) => {
      option.addEventListener("change", () => {
        button.disabled = false;
        const current = state.practice[exerciseId] || {};
        state.practice[exerciseId] = {
          ...current,
          status: "in_progress",
          selectedAnswer: option.value,
          updatedAt: new Date().toISOString(),
        };
        persist();
      });
    });
    button.addEventListener("click", () => {
      const selected = options.find((option) => option.checked);
      if (!selected) {
        feedback.textContent = "请先选择一个答案。";
        return;
      }
      const correct = selected.value === correctValue;
      const previous = state.practice[exerciseId] || {};
      state.practice[exerciseId] = {
        ...previous,
        status: correct ? "completed" : "checked",
        selectedAnswer: selected.value,
        attempts: Number(previous.attempts || 0) + 1,
        updatedAt: new Date().toISOString(),
        completedAt: correct ? new Date().toISOString() : previous.completedAt || null,
      };
      feedback.textContent = correct ? `回答正确。${explanation}` : `再试一次。${explanation}`;
      if (correct) markMatchingTaskComplete(skill);
      persist();
      updateHeroProgress();
    });
  };

  setupChoicePractice({
    name: "reading-answer",
    exerciseId: "reading-library-v1",
    correctValue: "b",
    buttonSelector: "[data-check-reading]",
    feedbackSelector: "[data-reading-feedback]",
    explanation: "图书馆设置安静区和讨论区，是为了支持不同的学习方式。",
    skill: "Reading",
  });
  setupChoicePractice({
    name: "listening-answer",
    exerciseId: "listening-club-v1",
    correctValue: "b",
    buttonSelector: "[data-check-listening]",
    feedbackSelector: "[data-listening-feedback]",
    explanation: "会议改到 Thursday，但开始时间仍然是 4:30。",
    skill: "Listening",
  });

  const listeningAudio = document.querySelector("[data-listening-audio]");
  const audioStatus = document.querySelector("[data-audio-status]");
  listeningAudio?.addEventListener("error", () => {
    if (audioStatus) audioStatus.textContent = "音频暂时无法播放。请展开英文原文继续练习；本站不会反复自动重试。";
  });
  listeningAudio?.addEventListener("play", () => {
    if (audioStatus) audioStatus.textContent = "正在播放英文材料。";
  });

  const writing = document.querySelector("[data-writing-answer]");
  if (writing) {
    const wordCount = document.querySelector("[data-word-count]");
    const saveStatus = document.querySelector("[data-writing-save-status]");
    const completeButton = document.querySelector("[data-complete-writing]");
    const feedback = document.querySelector("[data-writing-feedback]");
    const reviewBoxes = [...document.querySelectorAll("[data-review]")];
    const saved = state.practice["writing-community-v1"] || {};
    writing.value = saved.draftText || "";
    reviewBoxes.forEach((box) => {
      box.checked = Boolean(saved.selfChecks?.[box.dataset.review]);
    });
    let writingTimer;
    const countWords = () => {
      const words = writing.value.trim() ? writing.value.trim().split(/\s+/).filter(Boolean).length : 0;
      if (wordCount) wordCount.textContent = String(words);
      const ready = words >= 20 && reviewBoxes.every((box) => box.checked);
      if (completeButton) completeButton.disabled = !ready;
      return words;
    };
    const saveWriting = () => {
      const previous = state.practice["writing-community-v1"] || {};
      state.practice["writing-community-v1"] = {
        ...previous,
        status: previous.status === "completed" ? "completed" : "in_progress",
        draftText: writing.value,
        selfChecks: Object.fromEntries(reviewBoxes.map((box) => [box.dataset.review, box.checked])),
        updatedAt: new Date().toISOString(),
      };
      persist();
      if (saveStatus) saveStatus.textContent = storageWritable ? "草稿已保存在本机" : "仅在本页暂存";
      countWords();
    };
    writing.addEventListener("input", () => {
      countWords();
      if (saveStatus) saveStatus.textContent = "正在保存…";
      window.clearTimeout(writingTimer);
      writingTimer = window.setTimeout(saveWriting, 500);
    });
    reviewBoxes.forEach((box) => box.addEventListener("change", saveWriting));
    completeButton?.addEventListener("click", () => {
      saveWriting();
      state.practice["writing-community-v1"].status = "completed";
      state.practice["writing-community-v1"].completedAt = new Date().toISOString();
      markMatchingTaskComplete("Writing");
      persist();
      if (feedback) feedback.textContent = "已标记为完成。20 词与三项自查只是完成条件，不是写作能力评分。";
    });
    countWords();
    if (saved.draftText && saveStatus) saveStatus.textContent = "已恢复本机草稿";
  }

  const speakingTime = document.querySelector("[data-speaking-time]");
  if (speakingTime) {
    const stateNode = document.querySelector("[data-speaking-state]");
    const announcement = document.querySelector("[data-speaking-announcement]");
    const startButton = document.querySelector("[data-speaking-start]");
    const resetButton = document.querySelector("[data-speaking-reset]");
    const feedback = document.querySelector("[data-speaking-feedback]");
    const checks = [...document.querySelectorAll("[data-speaking-review]")];
    let phase = "idle";
    let endAt = null;
    let timerId = null;

    const announce = (message) => {
      if (announcement) announcement.textContent = message;
    };
    const updateSpeakingReviews = () => {
      const ready = phase === "complete" || state.practice["speaking-skill-v1"]?.status === "completed";
      checks.forEach((box) => {
        box.disabled = !ready;
      });
    };
    const saveSpeakingChecks = () => {
      const previous = state.practice["speaking-skill-v1"] || {};
      const selfChecks = Object.fromEntries(checks.map((box) => [box.dataset.speakingReview, box.checked]));
      const completed = phase === "complete" && checks.every((box) => box.checked);
      state.practice["speaking-skill-v1"] = {
        ...previous,
        status: completed ? "completed" : "checked",
        selfChecks,
        updatedAt: new Date().toISOString(),
        completedAt: completed ? new Date().toISOString() : previous.completedAt || null,
      };
      if (completed) {
        markMatchingTaskComplete("Speaking");
        if (feedback) feedback.textContent = "练习和三项自查已完成。本页不录音，也不提供发音或流利度评分。";
      }
      persist();
    };
    checks.forEach((box) => box.addEventListener("change", saveSpeakingChecks));
    const tickSpeaking = () => {
      if (!endAt) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      speakingTime.textContent = formatClock(remaining);
      if (remaining > 0) return;
      if (phase === "prep") {
        phase = "speak";
        endAt = Date.now() + 60000;
        speakingTime.textContent = "01:00";
        if (stateNode) stateNode.textContent = "请开始大声回答";
        if (startButton) startButton.textContent = "正在作答";
        announce("准备时间结束，请开始 60 秒英文回答。");
        return;
      }
      phase = "complete";
      endAt = null;
      window.clearInterval(timerId);
      speakingTime.textContent = "00:00";
      if (stateNode) stateNode.textContent = "练习结束，请完成英文自查";
      if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "计时已完成";
      }
      updateSpeakingReviews();
      announce("60 秒回答结束，请完成三项英文自查。");
      state.practice["speaking-skill-v1"] = {
        ...(state.practice["speaking-skill-v1"] || {}),
        status: "checked",
        updatedAt: new Date().toISOString(),
      };
      persist();
    };
    startButton?.addEventListener("click", () => {
      if (phase !== "idle") return;
      phase = "prep";
      endAt = Date.now() + 20000;
      startButton.textContent = "准备中";
      startButton.disabled = true;
      if (stateNode) stateNode.textContent = "20 秒准备时间";
      announce("20 秒准备计时开始。");
      timerId = window.setInterval(tickSpeaking, 200);
      tickSpeaking();
    });
    resetButton?.addEventListener("click", () => {
      window.clearInterval(timerId);
      phase = "idle";
      endAt = null;
      speakingTime.textContent = "00:20";
      if (stateNode) stateNode.textContent = "准备好后开始";
      if (startButton) {
        startButton.disabled = false;
        startButton.textContent = "开始准备";
      }
      checks.forEach((box) => {
        box.checked = false;
        box.disabled = true;
      });
      delete state.practice["speaking-skill-v1"];
      persist();
      updateHeroProgress();
      announce("口语练习计时已重置。");
    });
    const savedSpeaking = state.practice["speaking-skill-v1"];
    if (savedSpeaking?.selfChecks) {
      checks.forEach((box) => {
        box.checked = Boolean(savedSpeaking.selfChecks[box.dataset.speakingReview]);
      });
    }
    if (savedSpeaking?.status === "completed") {
      phase = "complete";
      speakingTime.textContent = "00:00";
      if (stateNode) stateNode.textContent = "本次练习已完成";
      if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "计时已完成";
      }
    }
    updateSpeakingReviews();
  }

  const focusTime = document.querySelector("[data-focus-time]");
  if (focusTime) {
    const durationSelect = document.querySelector("[data-focus-duration]");
    const startButton = document.querySelector("[data-focus-start]");
    const stopButton = document.querySelector("[data-focus-stop]");
    const resetButton = document.querySelector("[data-focus-reset]");
    const stateNode = document.querySelector("[data-focus-state]");
    const announcement = document.querySelector("[data-focus-announcement]");
    const baseTitle = document.title;
    let timerId;

    const announce = (message) => {
      if (announcement) announcement.textContent = message;
    };
    const remainingSeconds = (active) => {
      if (!active) return Number(durationSelect?.value || 25) * 60;
      if (active.status === "running" && active.endsAt) return Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000));
      const storedRemaining = Number(active.remainingSeconds);
      const fallbackDuration = Number(active.durationSeconds);
      if (Number.isFinite(storedRemaining)) return Math.max(0, storedRemaining);
      return Math.max(0, Number.isFinite(fallbackDuration) ? fallbackDuration : 0);
    };
    const recordFocusSession = (status, active) => {
      if (!active || active.recordedAt) return;
      state.focus.sessions.push({
        sessionId: `focus-${Date.now().toString(36)}`,
        status,
        durationSeconds: active.durationSeconds,
        startedAt: active.startedAt,
        endedAt: new Date().toISOString(),
      });
      active.recordedAt = new Date().toISOString();
    };
    const renderFocus = () => {
      const active = state.focus.active;
      const remaining = remainingSeconds(active);
      focusTime.textContent = formatClock(remaining);
      if (active?.durationSeconds && durationSelect) durationSelect.value = String(active.durationSeconds / 60);
      const status = active?.status || "idle";
      if (stateNode) {
        stateNode.textContent = status === "running" ? "正在专注" : status === "paused" ? "已暂停" : status === "completed" ? "本轮已完成" : status === "stopped" ? "已提前结束" : "准备开始";
      }
      if (startButton) {
        startButton.textContent = status === "running" ? "暂停" : status === "paused" ? "继续" : "开始专注";
        startButton.disabled = status === "completed" || status === "stopped";
      }
      if (stopButton) stopButton.disabled = !["running", "paused"].includes(status);
      if (durationSelect) durationSelect.disabled = ["running", "paused"].includes(status);
      document.title = status === "running" ? `${formatClock(remaining)} · 专注计时` : baseTitle;
    };
    const completeFocus = (status) => {
      const active = state.focus.active;
      if (!active || ["completed", "stopped"].includes(active.status)) return;
      active.status = status;
      active.remainingSeconds = status === "completed" ? 0 : remainingSeconds(active);
      active.endsAt = null;
      recordFocusSession(status, active);
      persist();
      renderFocus();
      announce(status === "completed" ? "本轮专注计时已经完成。" : "本轮专注已提前结束。");
      window.clearInterval(timerId);
    };
    const tickFocus = () => {
      const active = state.focus.active;
      if (active?.status !== "running") return;
      if (remainingSeconds(active) <= 0) completeFocus("completed");
      else renderFocus();
    };
    const beginTicker = () => {
      window.clearInterval(timerId);
      timerId = window.setInterval(tickFocus, 250);
      tickFocus();
    };
    startButton?.addEventListener("click", () => {
      const active = state.focus.active;
      if (!active || ["idle", "completed", "stopped"].includes(active.status)) {
        const durationSeconds = Number(durationSelect.value) * 60;
        state.focus.active = {
          status: "running",
          durationSeconds,
          remainingSeconds: durationSeconds,
          startedAt: new Date().toISOString(),
          endsAt: Date.now() + durationSeconds * 1000,
        };
        announce("专注计时开始。");
      } else if (active.status === "running") {
        active.remainingSeconds = remainingSeconds(active);
        active.status = "paused";
        active.endsAt = null;
        announce("专注计时已暂停。");
      } else if (active.status === "paused") {
        active.status = "running";
        active.endsAt = Date.now() + active.remainingSeconds * 1000;
        announce("专注计时继续。");
      }
      persist();
      renderFocus();
      if (state.focus.active?.status === "running") beginTicker();
      else window.clearInterval(timerId);
    });
    stopButton?.addEventListener("click", () => completeFocus("stopped"));
    resetButton?.addEventListener("click", () => {
      window.clearInterval(timerId);
      state.focus.active = null;
      persist();
      renderFocus();
      announce("专注计时已重置。");
    });
    durationSelect?.addEventListener("change", renderFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tickFocus();
    });
    if (state.focus.active?.status === "running") beginTicker();
    renderFocus();
  }

  const checkinForm = document.querySelector("#checkin-form");
  if (checkinForm) {
    const date = todayKey();
    const saved = state.checkIns[date] || {};
    const didText = checkinForm.elements.didText;
    const evidenceText = checkinForm.elements.evidenceText;
    const linkedTaskId = checkinForm.elements.linkedTaskId;
    const questionText = checkinForm.elements.questionText;
    const questionWrap = document.querySelector("[data-question-wrap]");
    const draftStatus = document.querySelector("[data-checkin-draft-status]");
    const noteStatus = document.querySelector("[data-note-status]");
    const errorBox = document.querySelector("[data-checkin-errors]");
    const taskSelect = document.querySelector("[data-linked-task]");
    const receipt = document.querySelector("[data-checkin-receipt]");
    const reviewLink = document.querySelector("[data-checkin-review-link]");
    let draftTimer;

    getTodayTasks().forEach((task) => {
      const option = document.createElement("option");
      option.value = task.taskId;
      option.textContent = task.titleZh;
      taskSelect?.append(option);
    });
    if (didText) didText.value = saved.didText || "";
    if (evidenceText) evidenceText.value = saved.evidenceText || "";
    if (linkedTaskId) linkedTaskId.value = saved.linkedTaskId || "";
    if (questionText) questionText.value = saved.questionText || "";
    const savedQuestionStatus = saved.questionStatus || "";
    const savedRadio = checkinForm.querySelector(`input[name="questionStatus"][value="${savedQuestionStatus}"]`);
    if (savedRadio) savedRadio.checked = true;

    const readCheckin = () => ({
      date,
      linkedTaskId: linkedTaskId?.value || "",
      didText: didText?.value.trim() || "",
      evidenceText: evidenceText?.value.trim() || "",
      questionStatus: checkinForm.querySelector('input[name="questionStatus"]:checked')?.value || "",
      questionText: questionText?.value.trim() || "",
    });
    const sameCheckinContent = (record, values) =>
      ["linkedTaskId", "didText", "evidenceText", "questionStatus", "questionText"].every(
        (key) => (record?.[key] || "") === (values?.[key] || ""),
      );
    const archiveCheckIn = (record, reason) => {
      if (!record?.checkInId) return;
      state.checkInHistory = [
        ...state.checkInHistory,
        { ...record, archivedAt: new Date().toISOString(), archivedReason: reason },
      ];
    };
    const toggleQuestion = () => {
      const hasQuestion = checkinForm.querySelector('input[name="questionStatus"]:checked')?.value === "has_question";
      if (questionWrap) questionWrap.hidden = !hasQuestion;
    };
    const renderCheckinReceipt = (record) => {
      const hasReceipt = record?.status === "saved" && Boolean(record.checkInId);
      if (receipt) receipt.hidden = !hasReceipt;
      if (reviewLink) {
        reviewLink.hidden = !(
          hasReceipt &&
          record.cycleId &&
          record.cycleId === state.journey?.activeCycle?.cycleId &&
          state.journey.activeCycle.checkInId === record.checkInId
        );
      }
      if (!hasReceipt) return;
      const idNode = document.querySelector("[data-checkin-id]");
      const planNode = document.querySelector("[data-checkin-plan-id]");
      if (idNode) idNode.textContent = record.checkInId;
      if (planNode) planNode.textContent = record.planId || "独立打卡，未关联闭环计划";
    };
    const saveDraft = () => {
      const values = readCheckin();
      const previous = state.checkIns[date] || {};
      const previousConfirmed = Boolean(
        previous.checkInId &&
          previous.status === "saved" &&
          (previous.learnerConfirmedReview === true || previous.reviewId),
      );
      const contentChanged = !sameCheckinContent(previous, values);
      if (previousConfirmed && !contentChanged) {
        if (draftStatus) draftStatus.textContent = "内容与已确认版本一致";
        if (noteStatus) noteStatus.textContent = "原确认、复盘与后续证据保持有效。";
        return;
      }
      const replacesConfirmedVersion = previousConfirmed && contentChanged;
      if (replacesConfirmedVersion) archiveCheckIn(previous, "learner_revision_after_confirmation");
      state.checkIns[date] = {
        ...previous,
        ...values,
        checkInId: replacesConfirmedVersion ? null : previous.checkInId || null,
        status: "draft",
        learnerConfirmedReview: false,
        reviewId: null,
        reviewedAt: null,
        updatedAt: new Date().toISOString(),
      };
      if (
        state.journey?.activeCycle?.status === "in_progress" &&
        state.journey.activeCycle.reviewId === previous.reviewId
      ) {
        if (replacesConfirmedVersion && state.journey.activeCycle.checkInId === previous.checkInId) {
          state.journey.activeCycle.checkInId = null;
        }
        state.journey.activeCycle.reviewId = null;
        state.journey.activeCycle.peerHelpId = null;
        state.journey.activeCycle.retestId = null;
        state.journey.activeCycle.updatedPlanId = null;
        state.journey.review = null;
        state.journey.peerHelp = null;
        state.journey.retest = null;
        state.journey.planUpdate = null;
      }
      persist();
      renderCheckinReceipt(state.checkIns[date]);
      if (draftStatus) draftStatus.textContent = storageWritable ? "草稿已自动保存" : "草稿仅在本页暂存";
      if (noteStatus) noteStatus.textContent = "尚未形成正式证据式打卡。";
    };
    checkinForm.addEventListener("input", () => {
      toggleQuestion();
      if (draftStatus) draftStatus.textContent = "正在保存草稿…";
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 500);
    });
    checkinForm.addEventListener("change", toggleQuestion);
    toggleQuestion();
    if (saved.status === "saved" && noteStatus) {
      noteStatus.textContent = `打卡已保存于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(saved.savedAt))}`;
    } else if (saved.didText || saved.evidenceText) {
      if (draftStatus) draftStatus.textContent = "已恢复本机草稿";
    }
    renderCheckinReceipt(saved);

    checkinForm.addEventListener("submit", (event) => {
      event.preventDefault();
      window.clearTimeout(draftTimer);
      const values = readCheckin();
      const errors = [];
      const activeCycle = state.journey?.activeCycle;
      const baseTaskIds = new Set(state.plan?.days?.flatMap((day) => day.tasks.map((task) => task.taskId)) || []);
      const linkedRecommendation = completedRecommendationChain();
      const pendingClosedLoop = Boolean(linkedRecommendation);
      if (values.didText.length < 10) errors.push(["didText", "“完成内容”至少需要 10 个字。"]);
      if (values.evidenceText.length < 10) errors.push(["evidenceText", "“学习证据”至少需要 10 个字。"]);
      if (pendingClosedLoop && (!values.linkedTaskId || !baseTaskIds.has(values.linkedTaskId))) {
        errors.push(["linkedTaskId", "当前闭环的证据式打卡必须关联本轮计划中的一项任务。"]);
      }
      if (!values.questionStatus) errors.push(["questionStatus", "请选择今天是否还有问题。"]);
      if (values.questionStatus === "has_question" && !values.questionText) errors.push(["questionText", "请写下需要继续解决的问题。"]);
      checkinForm.querySelectorAll("[data-error-for]").forEach((node) => {
        node.textContent = "";
      });
      if (errorBox) {
        errorBox.hidden = errors.length === 0;
        const list = errorBox.querySelector("ul");
        clearChildren(list);
        errors.forEach(([field, message]) => {
          const item = document.createElement("li");
          item.textContent = message;
          list?.append(item);
          const fieldError = checkinForm.querySelector(`[data-error-for="${field}"]`);
          if (fieldError) fieldError.textContent = message;
        });
      }
      if (errors.length) {
        errorBox?.focus();
        const firstName = errors[0][0];
        if (firstName === "questionStatus") checkinForm.querySelector('input[name="questionStatus"]')?.focus();
        else checkinForm.elements[firstName]?.focus();
        return;
      }
      const previous = state.checkIns[date] || {};
      const cycleEligible = Boolean(
        linkedRecommendation &&
        values.linkedTaskId &&
        baseTaskIds.has(values.linkedTaskId),
      );
      const cycleId = cycleEligible ? activeCycle.cycleId : null;
      const planId = cycleEligible ? activeCycle.basePlanId : state.plan?.planId || null;
      const recommendationId = cycleEligible ? activeCycle.recommendationId : null;
      const sameScope = Boolean(
        previous.checkInId &&
          previous.cycleId === cycleId &&
          previous.planId === planId &&
          (previous.recommendationId || null) === recommendationId,
      );
      const previousConfirmed = Boolean(
        previous.checkInId &&
          previous.status === "saved" &&
          (previous.learnerConfirmedReview === true || previous.reviewId),
      );
      const contentChanged = !sameCheckinContent(previous, values);
      if (previousConfirmed && sameScope && !contentChanged) {
        renderCheckinReceipt(previous);
        if (draftStatus) draftStatus.textContent = "证据式打卡与已确认版本一致";
        if (noteStatus) noteStatus.textContent = "内容没有变化；原确认、复盘与后续证据保持有效。";
        return;
      }
      const replacesConfirmedVersion = previousConfirmed && contentChanged;
      if (previous.checkInId && (replacesConfirmedVersion || !sameScope)) {
        archiveCheckIn(previous, replacesConfirmedVersion ? "learner_revision_after_confirmation" : "scope_changed");
      }
      const savedAt = new Date().toISOString();
      state.checkIns[date] = {
        ...values,
        checkInId:
          sameScope && !replacesConfirmedVersion ? previous.checkInId : `check-in-${Date.now().toString(36)}`,
        cycleId,
        planId,
        diagnosticSessionId: cycleEligible ? activeCycle.diagnosticSessionId : null,
        recommendationId,
        visibility: "local_only",
        anomalyReviewStatus: "not_flagged",
        status: "saved",
        learnerConfirmedReview: false,
        reviewId: null,
        reviewedAt: null,
        savedAt,
        updatedAt: savedAt,
      };
      if (cycleEligible) {
        activeCycle.checkInId = state.checkIns[date].checkInId;
        activeCycle.reviewId = null;
        activeCycle.peerHelpId = null;
        activeCycle.retestId = null;
        activeCycle.updatedPlanId = null;
        activeCycle.updatedAt = savedAt;
        state.journey.review = null;
        state.journey.peerHelp = null;
        state.journey.retest = null;
        state.journey.planUpdate = null;
      }
      if (values.linkedTaskId) {
        state.taskProgress[values.linkedTaskId] = {
          ...(state.taskProgress[values.linkedTaskId] || {}),
          status: "completed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          selfReported: true,
        };
      }
      markMatchingTaskComplete("Reflection");
      if (!persist()) {
        if (noteStatus) noteStatus.textContent = "当前无法保存；本次打卡尚未形成正式记录。";
        return;
      }
      renderCheckinReceipt(state.checkIns[date]);
      if (draftStatus) draftStatus.textContent = "证据式打卡已保存";
      if (noteStatus) {
        noteStatus.textContent = cycleEligible
          ? `已保存于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}；请进入下一页确认复盘。`
          : "已保存为独立本机打卡；未满足当前闭环前置条件，因此不会计入七步路径。";
      }
    });
  }

  const updateDataPage = () => {
    const status = document.querySelector("[data-data-status]");
    const summary = document.querySelector("[data-data-summary]");
    if (!summary) return;
    const completedTasks = Object.values(state.taskProgress).filter((item) => item?.status === "completed").length;
    const completedPractice = Object.values(state.practice).filter((item) => item?.status === "completed").length;
    const savedCheckins = Object.values(state.checkIns).filter((item) => item?.status === "saved").length;
    const confirmedReviews = Object.values(state.checkIns).filter(
      (item) => item?.status === "saved" && item?.learnerConfirmedReview === true && item?.reviewId,
    ).length;
    const completedCycles = state.journey.history.filter((item) => item?.status === "completed" || item?.updatedPlanId).length;
    let teacherTurns = 0;
    let handoffRequests = 0;
    try {
      const teacherRaw = window.localStorage.getItem(SUPER_TEACHER_STORAGE_KEY);
      const teacherData = teacherRaw ? JSON.parse(teacherRaw) : null;
      if (isRecord(teacherData) && teacherData.protocolVersion === "sufeiya_super_teacher_v1") {
        teacherTurns = Array.isArray(teacherData.turns) ? teacherData.turns.length : 0;
        handoffRequests = Array.isArray(teacherData.handoffRequests) ? teacherData.handoffRequests.length : 0;
      }
    } catch {
      // Corrupt or unavailable Super Teacher storage is preserved for export or explicit clearing.
    }
    clearChildren(summary);
    const rows = [
      ["7 天计划", state.plan ? `当前 1 份 · 历史 ${state.planHistory.length} 份` : "尚未生成"],
      ["已完成任务", `${completedTasks} 项`],
      ["已完成微练习", `${completedPractice} 项`],
      ["证据式打卡", `${savedCheckins} 条`],
      ["学生确认复盘", `${confirmedReviews} 条`],
      ["完整演示闭环", `${completedCycles} 轮`],
      ["专注记录", `${state.focus.sessions.length} 次`],
      ["超级老师对话消息", teacherTurns + " 条"],
      ["未发送人工请求", handoffRequests + " 条"],
    ];
    rows.forEach(([label, value]) => {
      const row = document.createElement("p");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = label;
      span.textContent = value;
      row.append(strong, span);
      summary.append(row);
    });
    if (status) status.textContent = storageWritable ? "本机存储可用" : "当前为内存模式";
  };
  updateDataPage();

  document.querySelectorAll("[data-export-workspace]").forEach((button) => {
    button.addEventListener("click", () => {
      let teacherRaw = null;
      let teacherData = null;
      try {
        teacherRaw = window.localStorage.getItem(SUPER_TEACHER_STORAGE_KEY);
        teacherData = teacherRaw ? JSON.parse(teacherRaw) : null;
      } catch {
        // Preserve an unreadable raw value below rather than silently omitting it.
      }
      const workspaceData = rawStoredValue && !storageWritable ? null : state;
      const content = JSON.stringify({
        exportProtocol: "sufeiya_local_export_v1",
        exportedAt: new Date().toISOString(),
        namespaces: {
          [STORAGE_KEY]: {
            parsed: workspaceData,
            raw: workspaceData ? null : rawStoredValue,
          },
          [SUPER_TEACHER_STORAGE_KEY]: {
            parsed: teacherData,
            raw: teacherData || !teacherRaw ? null : teacherRaw,
          },
        },
      }, null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sufeiya-local-data-${todayKey()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const message = document.querySelector("[data-data-message]");
      if (message) message.textContent = "包含学习闭环与超级老师命名空间的 JSON 备份已导出到下载目录。";
    });
  });

  document.querySelectorAll("[data-clear-workspace]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("确定仅清除这个浏览器中的 Sufeiya 学习闭环数据吗？超级老师对话不会被删除；此操作无法撤销。")) return;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // In-memory state is still cleared below.
      }
      state = freshState();
      rawStoredValue = null;
      storageWritable = true;
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-super-teacher]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("确定仅清除这个浏览器中的超级老师对话和未发送人工请求吗？学习闭环数据不会被删除；此操作无法撤销。")) return;
      try {
        window.localStorage.removeItem(SUPER_TEACHER_STORAGE_KEY);
      } catch {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = "浏览器未允许清除超级老师数据。";
        return;
      }
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-all-sufeiya]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!window.confirm("确定清除这个浏览器中的全部 Sufeiya 学习闭环、超级老师对话和未发送人工请求吗？此操作无法撤销。")) return;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SUPER_TEACHER_STORAGE_KEY);
      } catch {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = "浏览器未允许清除全部本机数据。";
        return;
      }
      state = freshState();
      rawStoredValue = null;
      storageWritable = true;
      window.location.reload();
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === SUPER_TEACHER_STORAGE_KEY) window.location.reload();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
})();
