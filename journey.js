(() => {
  "use strict";

  const STORAGE_KEY = "sufeiya_workspace_v1";
  const SCHEMA_VERSION = 1;
  const PROTOCOL_VERSION = "gate_a_local_v1";
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
  const practiceEvidence = [
    { id: "reading-library-v1", skill: "Reading", label: "Reading 原创微练习" },
    { id: "listening-club-v1", skill: "Listening", label: "Listening 原创微练习" },
    { id: "writing-community-v1", skill: "Writing", label: "Writing 原创微练习" },
    { id: "speaking-skill-v1", skill: "Speaking", label: "Speaking 原创微练习" },
  ];

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
    document.querySelectorAll("#diagnostic-form, #review-form, #community-form, #retest-form, #plan-update-form").forEach((form) => {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
    });
    document.querySelectorAll("[data-accept-recommendation], [data-skip-recommendation]").forEach((control) => {
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

  const completedPracticeEvidence = () =>
    practiceEvidence.filter((item) => state.practice[item.id]?.status === "completed");

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

    const diagnosticComplete = Boolean(
      cycle &&
        diagnostic?.protocolVersion === PROTOCOL_VERSION &&
        diagnostic?.cycleId === cycle.cycleId &&
        diagnostic?.diagnosticSessionId === cycle.diagnosticSessionId &&
        diagnostic?.status === "completed" &&
        diagnostic?.adultConfirmed === true &&
        VALID_SKILLS.has(diagnostic?.prioritySkill) &&
        diagnostic?.prioritySkill !== "Balanced",
    );
    const planComplete = Boolean(
      diagnosticComplete &&
        basePlan?.planId === cycle?.basePlanId &&
        basePlan?.provenance?.cycleId === cycle?.cycleId &&
        basePlan?.provenance?.diagnosticSessionId === cycle?.diagnosticSessionId,
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
        updatedPlan?.provenance?.cycleId === cycle?.cycleId &&
        updatedPlan?.provenance?.diagnosticSessionId === cycle?.diagnosticSessionId &&
        updatedPlan?.provenance?.retestId === cycle?.retestId &&
        updatedPlan?.provenance?.supersedesPlanId === cycle?.basePlanId,
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

  const renderDiagnostic = () => {
    const evidenceList = document.querySelector("[data-diagnostic-evidence]");
    const completed = completedPracticeEvidence();
    setText("[data-diagnostic-evidence-count]", `${completed.length} / ${practiceEvidence.length} 项已完成`);
    clearChildren(evidenceList);
    practiceEvidence.forEach((item) => {
      const row = document.createElement("li");
      const status = state.practice[item.id]?.status === "completed";
      row.className = status ? "is-complete" : "is-pending";
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = item.label;
      value.textContent = status ? "已完成" : "尚无完成证据";
      row.append(label, value);
      evidenceList?.append(row);
    });

    const cycle = activeCycle();
    const diagnostic = state.journey.diagnostic;
    const result = document.querySelector("[data-diagnostic-result]");
    if (!diagnostic || diagnostic.status !== "completed" || diagnostic.diagnosticSessionId !== cycle?.diagnosticSessionId) {
      if (result) result.hidden = true;
      return;
    }
    if (result) result.hidden = false;
    setText("[data-diagnostic-status]", "已建立演示会话");
    setText("[data-diagnostic-id]", diagnostic.diagnosticSessionId);
    setText(
      "[data-diagnostic-sufficiency]",
      diagnostic.evidenceSufficiency === "evidence_insufficient" ? "证据不足，建议补充" : "证据有限，仅供规划",
    );
    setText(
      "[data-diagnostic-result-copy]",
      `已汇总 ${diagnostic.completedEvidenceSkills.length} 项本机练习完成状态；学习者确认先关注 ${skillLabels[diagnostic.prioritySkill]}。这不是自动诊断结论。`,
    );
    const form = document.querySelector("#diagnostic-form");
    if (form) {
      form.elements.prioritySkill.value = diagnostic.prioritySkill;
      form.elements.adultConfirmed.checked = Boolean(diagnostic.adultConfirmed);
    }
  };

  const setupDiagnostic = () => {
    const form = document.querySelector("#diagnostic-form");
    if (!form) return;
    renderDiagnostic();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = document.querySelector("[data-diagnostic-message]");
      if (!form.elements.adultConfirmed.checked) {
        if (message) message.textContent = "请先确认这是 18 岁以上用户使用的本机演示。";
        form.elements.adultConfirmed.focus();
        return;
      }
      const prioritySkill = form.elements.prioritySkill.value;
      if (!VALID_SKILLS.has(prioritySkill) || prioritySkill === "Balanced") {
        if (message) message.textContent = "请选择 Reading、Listening、Writing 或 Speaking。";
        return;
      }
      const completed = completedPracticeEvidence();
      const currentCycle = activeCycle();
      const continuingCycle = currentCycle?.status === "in_progress";
      const previous = continuingCycle ? state.journey.diagnostic : null;
      const diagnosticSessionId = previous?.diagnosticSessionId || makeId("diagnostic");
      const cycle = continuingCycle
        ? currentCycle
        : {
            cycleId: makeId("cycle"),
            protocolVersion: "gate_a_local_v1",
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
          };
      cycle.diagnosticSessionId = diagnosticSessionId;
      cycle.basePlanId = null;
      cycle.recommendationId = null;
      cycle.checkInId = null;
      cycle.reviewId = null;
      cycle.peerHelpId = null;
      cycle.retestId = null;
      cycle.updatedPlanId = null;
      cycle.status = "in_progress";
      cycle.updatedAt = isoNow();
      state.journey.activeCycle = cycle;
      state.journey.diagnostic = {
        diagnosticSessionId,
        cycleId: cycle.cycleId,
        protocolVersion: "gate_a_local_v1",
        status: "completed",
        adultConfirmed: true,
        prioritySkill,
        completedEvidenceSkills: completed.map((item) => item.skill),
        evidenceSufficiency: completed.length < 2 ? "evidence_insufficient" : "evidence_limited",
        evidenceSource: "local_practice_completion_only",
        learnerConfirmedPriority: true,
        automatedScoreProduced: false,
        updatedAt: isoNow(),
        createdAt: previous?.createdAt || isoNow(),
      };
      state.journey.recommendation = null;
      state.journey.review = null;
      state.journey.peerHelp = null;
      state.journey.retest = null;
      state.journey.planUpdate = null;
      state.profile = { ...state.profile, focusSkill: prioritySkill };
      if (!persist()) {
        if (message) message.textContent = "当前无法保存，演示诊断会话尚未形成正式本机记录。";
        return;
      }
      if (message) message.textContent = "演示诊断会话已保存在本机。";
      renderDiagnostic();
      document.querySelector("[data-diagnostic-result]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    if (!recommendation) {
      if (receipt) receipt.hidden = true;
      if (start) start.hidden = true;
      return;
    }
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
    const cycle = activeCycle();
    const gateReady = Boolean(
      cycle?.status === "in_progress" &&
        cycle.basePlanId &&
        cycle.basePlanId === state.plan?.planId &&
        cycle.diagnosticSessionId === state.journey.diagnostic?.diagnosticSessionId &&
        state.plan?.diagnosticSessionId === cycle.diagnosticSessionId,
    );
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

    const saveChoice = (status) => {
      if (activeCycle()?.cycleId !== cycle.cycleId || state.plan?.planId !== cycle.basePlanId) {
        setText("[data-recommendation-message]", "闭环状态已发生变化，请刷新后重新核对计划。");
        return;
      }
      const previous = saved;
      const recommendationId = previous?.recommendationId || makeId("recommendation");
      state.journey.recommendation = {
        recommendationId,
        cycleId: cycle.cycleId,
        planId: cycle.basePlanId,
        diagnosticSessionId: cycle.diagnosticSessionId,
        status,
        itemCount: items.length,
        primary: items[0],
        supplements: items.slice(1),
        sourceMode: "frozen_local_routes_no_rag",
        learnerChoice: true,
        updatedAt: isoNow(),
        createdAt: previous?.createdAt || isoNow(),
      };
      cycle.recommendationId = recommendationId;
      cycle.checkInId = null;
      cycle.reviewId = null;
      cycle.peerHelpId = null;
      cycle.retestId = null;
      cycle.updatedPlanId = null;
      cycle.updatedAt = isoNow();
      state.journey.review = null;
      state.journey.peerHelp = null;
      state.journey.retest = null;
      state.journey.planUpdate = null;
      if (!persist()) {
        setText("[data-recommendation-message]", "当前无法保存，推荐选择尚未形成正式本机记录。");
        return;
      }
      renderRecommendationReceipt(state.journey.recommendation);
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
    const ready = Boolean(
      cycle?.status === "in_progress" &&
        cycle.basePlanId === state.plan?.planId &&
        chain.preRetestComplete,
    );
    return { cycle, record, review, peerHelp, ready, completed: chain.updateComplete };
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
    if (!initialGate.ready && !alreadyCompleted) {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
      setText("[data-retest-status]", "等待本轮互助状态");
      setText("[data-retest-message]", "请先完成当前 cycle_id 的诊断、计划、推荐、证据式打卡、学生确认与互助选择。 ");
    }
    if (alreadyCompleted) {
      form.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = true;
      });
    }
    renderRetest();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const { cycle, record, review, peerHelp, ready } = retestGate();
      const skill = form.elements.retestSkill.value;
      const message = document.querySelector("[data-retest-message]");
      if (!ready) {
        if (message) message.textContent = "闭环前置记录不完整或已经变化，请返回工作台继续当前步骤。";
        return;
      }
      if (!VALID_SKILLS.has(skill) || skill === "Balanced") {
        if (message) message.textContent = "请选择一项平行任务。";
        return;
      }
      const { evidence, error } = readRetestEvidence(form, skill);
      if (error) {
        if (message) message.textContent = error;
        return;
      }
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
        if (message) message.textContent = "当前无法保存；平行任务尚未形成正式 retest_id。";
        return;
      }
      if (message) message.textContent = "平行任务证据已保存在本机；请由你确认下一轮重点。";
      renderRetest();
      document.querySelector("[data-retest-result]")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const updateForm = document.querySelector("#plan-update-form");
    updateForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = document.querySelector("[data-plan-update-message]");
      try {
        const latestRaw = window.localStorage.getItem(STORAGE_KEY);
        const latest = latestRaw ? normalizeState(JSON.parse(latestRaw)) : null;
        if (!latest || latest.updatedAt !== state.updatedAt) {
          if (message) message.textContent = "本机记录已在另一个页面发生变化。为避免覆盖，请刷新后重新核对当前闭环。";
          return;
        }
      } catch {
        if (message) message.textContent = "无法核对最新本机记录，已停止更新计划；请刷新后重试。";
        return;
      }
      const chain = validateCycleEvidence();
      const { cycle, retest } = chain;
      const exactChain = Boolean(
        cycle?.status === "in_progress" &&
          chain.retestEvidenceComplete &&
          state.plan?.planId === cycle.basePlanId,
      );
      if (!exactChain) {
        if (message) message.textContent = "当前计划与 retest_id 的 base_plan_id 不一致，已停止更新；请返回工作台重新核对。";
        return;
      }
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
      const stateBeforeUpdate = JSON.parse(JSON.stringify(state));
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
        if (message) message.textContent = "当前无法保存；更新计划与闭环关闭均未形成正式本机记录。";
        return;
      }
      if (message) message.textContent = "更新后的 7 天计划已生成，旧计划完整归档，本轮闭环已关闭。";
      renderRetest();
    });
  };

  const journeyDefinitions = [
    { key: "diagnostic", title: "建立演示诊断会话", copy: "先确认成人演示边界，并记录当前已有的练习证据。", route: "/diagnostic" },
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
      diagnostic?.evidenceSufficiency === "evidence_insufficient" ? "会话完成，证据不足" : "会话完成，证据有限",
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

  loadState();
  setupDiagnostic();
  setupRecommendations();
  setupReview();
  setupCommunity();
  setupRetest();
  renderJourneyDashboard();

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) window.location.reload();
  });
})();
