(async () => {
  const STORAGE_KEY = "sufeiya_workspace_v1";
  const SUPER_TEACHER_STORAGE_KEY = "sufeiya_super_teacher_v1";
  const TEACHING_REVIEW_DEMO_STORAGE_KEY = "sufeiya_teaching_review_demo_v1";
  const TEACHING_REVIEW_DEMO_PROTOCOL = "sufeiya_teaching_review_demo_v1";
  const SCHEMA_VERSION = 1;
  const PROTOCOL_VERSION = "gate_a_local_v1";
  const DIAGNOSTIC_PROTOCOL_VERSION = "gate_a_diagnostic_evidence_v1";
  const DIAGNOSTIC_TASK_SET_VERSION = "gate_a_original_6_v1";
  const DIAGNOSTIC_TASK_SET_DIGEST = "c1b2922ca96677665690bf790281be2438a016bbbe0d9f85478685af3c8dfc2c";
  const PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v2";
  const LEGACY_PRACTICE_RECEIPT_VERSION = "sufeiya_practice_receipt_v1";
  const learningEventsRuntime = window.SufeiyaLearningEvents;
  const PRACTICE_ACTIVITY_CATALOG = Object.freeze({
    "reading-library-v1": Object.freeze({
      activityId: "https://sufeiya.cn/activities/practice/reading-library/v1",
      activityVersion: "v1",
      contentId: "reading-library-v1",
      contentHash: "7238e32977e09ec90227c0dcbdf85d63506e0f0b9458e6efeafc68f4326bbb6f",
      skill: "Reading",
      route: "/practice-reading",
      receiptEvidenceClass: "objective_response",
      evidenceType: "answer_matched",
      completionCondition: "correct_answer_observed",
      responseType: "single_choice",
      domCompletionRule: "final_answer_correct",
      correctValue: "b",
    }),
    "listening-club-v1": Object.freeze({
      activityId: "https://sufeiya.cn/activities/practice/listening-club/v1",
      activityVersion: "v1",
      contentId: "listening-club-v1",
      contentHash: "1415f88a1903064dbe1fc21384ca5160be811b9bcab691b7fe7afeeb1928c2cb",
      skill: "Listening",
      route: "/practice-listening",
      receiptEvidenceClass: "audio_objective_response",
      evidenceType: "answer_matched",
      completionCondition: "correct_answer_observed",
      responseType: "single_choice_audio",
      domCompletionRule: "final_answer_correct_with_audio_quality",
      correctValue: "b",
    }),
    "writing-community-v1": Object.freeze({
      activityId: "https://sufeiya.cn/activities/practice/writing-community/v1",
      activityVersion: "v1",
      contentId: "writing-community-v1",
      contentHash: "1c52065b38cc80712ef3f8832fe8da110cb547a32c06e3a0e98c79cd8f4bc75b",
      skill: "Writing",
      route: "/practice-writing",
      receiptEvidenceClass: "self_reviewed_artifact",
      evidenceType: "task_completed_no_score",
      completionCondition: "minimum_words_and_self_review",
      responseType: "local_text_self_review",
      domCompletionRule: "minimum_words_and_all_self_checks",
      minimumWords: 20,
    }),
    "speaking-skill-v1": Object.freeze({
      activityId: "https://sufeiya.cn/activities/practice/speaking-skill/v1",
      activityVersion: "v1",
      contentId: "speaking-skill-v1",
      contentHash: "c52c0194f8ee42d677148bc3e54bbf772fa74f8ee1a7d5bd90a21d8dd2a87843",
      skill: "Speaking",
      route: "/practice-speaking",
      receiptEvidenceClass: "timed_self_report",
      evidenceType: "task_completed_no_score",
      completionCondition: "timer_and_self_review",
      responseType: "timed_self_report",
      domCompletionRule: "full_timer_and_all_self_checks",
      prepSeconds: 20,
      responseSeconds: 60,
    }),
  });
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
  const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
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
    practiceReceipts: {},
    learningEvents: [],
    learningEventBindings: null,
    checkIns: {},
    checkInHistory: [],
    focus: { active: null, sessions: [] },
    journey: { protocolVersion: "gate_a_local_v1", activeCycle: null, history: [] },
  });

  let state = freshState();
  let storageWritable = true;
  let rawStoredValue = null;
  let storageWarningShown = false;
  let workspaceStateRecognized = true;

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
  const readTeachingReviewDemoNamespace = () => {
    let raw;
    try {
      raw = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
    } catch {
      return { status: "unavailable", parsed: null, raw: null };
    }
    if (raw === null) return { status: "missing", parsed: null, raw: null };
    if (raw.length > 20_000) return { status: "unrecognized", parsed: null, raw };
    try {
      const value = JSON.parse(raw);
      const topKeys = new Set([
        "protocolVersion", "draftId", "revision", "status", "cycleId", "sourceUpdatedAt",
        "sourceSnapshotSha256", "createdAt", "savedAt", "identityVerified",
        "qualifiedHumanConfirmation", "canonicalLedgerWrite", "cycleClosureAttempted",
        "recommendationDraft", "escalationDraft",
      ]);
      const recommendationKeys = new Set(["focusSkill", "rationale"]);
      const escalationKeys = new Set(["category", "note"]);
      const recognized = Boolean(
        isRecord(value) &&
        Object.keys(value).every((key) => topKeys.has(key)) &&
        Object.keys(value).length === topKeys.size &&
        value.protocolVersion === TEACHING_REVIEW_DEMO_PROTOCOL &&
        UUID_V4_PATTERN.test(value.draftId || "") &&
        Number.isInteger(value.revision) &&
        value.revision > 0 &&
        value.status === "local_demo_draft" &&
        typeof value.cycleId === "string" &&
        value.cycleId.length > 0 &&
        value.cycleId.length <= 180 &&
        (value.sourceUpdatedAt === null || (typeof value.sourceUpdatedAt === "string" && !Number.isNaN(Date.parse(value.sourceUpdatedAt)))) &&
        typeof value.sourceSnapshotSha256 === "string" &&
        /^[0-9a-f]{64}$/.test(value.sourceSnapshotSha256) &&
        typeof value.createdAt === "string" &&
        !Number.isNaN(Date.parse(value.createdAt)) &&
        typeof value.savedAt === "string" &&
        !Number.isNaN(Date.parse(value.savedAt)) &&
        value.identityVerified === false &&
        value.qualifiedHumanConfirmation === false &&
        value.canonicalLedgerWrite === false &&
        value.cycleClosureAttempted === false &&
        isRecord(value.recommendationDraft) &&
        Object.keys(value.recommendationDraft).every((key) => recommendationKeys.has(key)) &&
        Object.keys(value.recommendationDraft).length === recommendationKeys.size &&
        ["Balanced", "Reading", "Listening", "Writing", "Speaking"].includes(value.recommendationDraft.focusSkill) &&
        typeof value.recommendationDraft.rationale === "string" &&
        value.recommendationDraft.rationale.trim().length >= 12 &&
        value.recommendationDraft.rationale.trim().length <= 1_200 &&
        isRecord(value.escalationDraft) &&
        Object.keys(value.escalationDraft).every((key) => escalationKeys.has(key)) &&
        Object.keys(value.escalationDraft).length === escalationKeys.size &&
        ["evidence_quality", "open_response_review", "content_alignment", "other"].includes(value.escalationDraft.category) &&
        typeof value.escalationDraft.note === "string" &&
        value.escalationDraft.note.trim().length >= 12 &&
        value.escalationDraft.note.trim().length <= 1_200
      );
      return recognized
        ? { status: "recognized", parsed: value, raw }
        : { status: "unrecognized", parsed: null, raw };
    } catch {
      return { status: "unrecognized", parsed: null, raw };
    }
  };
  const createUuid = () => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  };
  const sha256Hex = async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };
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
    const planTask = planDay?.tasks?.find((task) => task.taskId === primary.taskId);
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
    const prerequisites = ["18_plus_gate_a", "same_browser_local_storage", "safe_write_lock"];
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
      prerequisites,
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
      prerequisites,
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
      !taskIds.has(recommendation.primary?.taskId) ||
      !recommendationBindingMatches({
        binding: recommendation.evidenceBinding,
        cycle: linked.cycle,
        diagnostic: linked.diagnostic,
        plan: linked.plan,
        primary: recommendation.primary,
      })
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
      practiceReceipts: value.practiceReceipts && typeof value.practiceReceipts === "object" ? value.practiceReceipts : {},
      learningEvents: value.learningEvents === undefined ? [] : value.learningEvents,
      learningEventBindings: value.learningEventBindings === undefined ? null : value.learningEventBindings,
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
        workspaceStateRecognized = false;
        storageWritable = false;
        showStorageWarning("发现无法识别的本机学习数据。为避免覆盖，当前仅以内存模式运行；可前往“我的本机数据”导出原始内容或清除后重建。");
        return;
      }
      state = normalized;
      if (
        !window.__sufeiyaLegacyReceiptWarningShown &&
        Object.values(state.practiceReceipts).some((receipt) => receipt?.protocolVersion === LEGACY_PRACTICE_RECEIPT_VERSION)
      ) {
        window.__sufeiyaLegacyReceiptWarningShown = true;
        showStorageWarning("已保留旧版练习记录，但旧回执缺少可复算证据字段，不会继续推进当前闭环；请从计划或推荐的绑定入口重新完成练习。");
      }
    } catch {
      workspaceStateRecognized = false;
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

  const snapshotState = () => JSON.parse(JSON.stringify(state));
  const withExclusiveWorkspaceWrite = async (write) => {
    if (!storageWritable || !navigator.locks?.request) return { status: "lock_unavailable" };
    try {
      return await navigator.locks.request(`${STORAGE_KEY}:sealed-write`, { mode: "exclusive" }, write);
    } catch {
      return { status: "lock_unavailable" };
    }
  };
  const withWorkspaceRecoveryLock = async (write) => {
    if (!workspaceWriterLeaseAvailable || !navigator.locks?.request) return { status: "lock_unavailable" };
    try {
      return await navigator.locks.request(`${STORAGE_KEY}:sealed-write`, { mode: "exclusive" }, write);
    } catch {
      return { status: "lock_unavailable" };
    }
  };
  const withSuperTeacherWriteLock = async (write) => {
    if (!navigator.locks?.request) return { status: "lock_unavailable" };
    try {
      return await navigator.locks.request(`${SUPER_TEACHER_STORAGE_KEY}:write`, { mode: "exclusive" }, write);
    } catch {
      return { status: "lock_unavailable" };
    }
  };
  const withTeachingReviewDemoWriteLock = async (write) => {
    if (!navigator.locks?.request) return { status: "lock_unavailable" };
    try {
      return await navigator.locks.request(`${TEACHING_REVIEW_DEMO_STORAGE_KEY}:write`, { mode: "exclusive" }, write);
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
  const appendPracticeFinalizationEvent = async (receipt) => {
    if (!receipt?.cycleId) return { status: "not_applicable" };
    return appendLearningEvent("practice_attempt.finalized", {
      receipt,
      recommendation: state.journey?.recommendation,
    });
  };

  const disableWorkspaceControls = ({
    allowEventExport = false,
    allowEventClear = false,
    allowDataReset = false,
  } = {}) => {
    const allowedSelectors = ["[data-export-workspace]"];
    if (allowEventExport) allowedSelectors.push("[data-export-learning-events]");
    if (allowEventClear) allowedSelectors.push("[data-clear-learning-events]");
    if (allowDataReset) {
      allowedSelectors.push(
        "[data-clear-workspace]",
        "[data-clear-super-teacher]",
        "[data-clear-teaching-review-demo]",
        "[data-clear-all-sufeiya]",
      );
    }
    document.querySelectorAll("main button, main input, main select, main textarea").forEach((control) => {
      if (!control.matches(allowedSelectors.join(", "))) control.disabled = true;
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
  let learningLedgerStatus = {
    ok: false,
    code: workspaceStateRecognized ? "runtime_unavailable" : "workspace_state_unrecognized",
  };
  if (workspaceStateRecognized && learningEventsRuntime) {
    try {
      learningLedgerStatus = await learningEventsRuntime.validateLedger(state);
    } catch {
      learningLedgerStatus = { ok: false, code: "runtime_exception" };
    }
  }
  if (!workspaceStateRecognized) {
    disableWorkspaceControls({ allowDataReset: true });
  }
  if (!learningLedgerStatus.ok) {
    storageWritable = false;
    showStorageWarning(
      learningLedgerStatus.code === "runtime_unavailable"
        ? "本机学习事件组件未能加载；为避免保存不完整记录，本页已切换为只读。可先导出全部原始数据，再清除学习闭环或全部本机数据后重建。"
        : "本机学习事件链未通过完整性核对；系统不会自动修复或覆盖。请先在“我的本机数据”导出备份，或仅清除学习事件后再继续。",
    );
    const eventRecoveryAvailable = workspaceStateRecognized && Boolean(learningEventsRuntime);
    disableWorkspaceControls({
      allowEventExport: eventRecoveryAvailable,
      allowEventClear: eventRecoveryAvailable,
      allowDataReset: true,
    });
  }
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
  const practiceCatalogForSkill = (skill) => {
    const match = Object.entries(PRACTICE_ACTIVITY_CATALOG).find(([, entry]) => entry.skill === skill);
    return match ? { exerciseId: match[0], ...match[1] } : null;
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
      const coreTask = day.tasks.find((task) => task.skill === day.coreSkill);
      route.href = coreTask
        ? `${coreTask.route}?${new URLSearchParams({ plan_id: state.plan.planId, task_id: coreTask.taskId }).toString()}`
        : skillRoutes[day.coreSkill];
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
    const linkedDiagnosticAtRender = completedDiagnosticCycle();
    focusSkill.value = linkedDiagnosticAtRender?.diagnostic?.prioritySkill || state.profile.focusSkill || "Balanced";
    const focusNote = document.querySelector("[data-plan-focus-note]");
    if (linkedDiagnosticAtRender) {
      focusSkill.disabled = true;
      if (focusNote) {
        focusNote.textContent = "本轮重点已在诊断页由你确认；为保持 diagnostic_session_id → plan_id 的证据链，此处锁定。需要改变方向时请重新开始诊断。";
      }
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
  const isTaskComplete = (task) => {
    const progress = state.taskProgress[task.taskId];
    if (progress?.status !== "completed") return false;
    if (progress.completionClass !== "practice_receipt") return true;
    return Boolean(practiceReceiptForTask(task));
  };
  const currentPlanTaskById = (taskId) =>
    state.plan?.days?.flatMap((day) => day.tasks || []).find((task) => task.taskId === taskId) || null;
  const boundPracticeHref = (task, planId = state.plan?.planId) => {
    const catalog = task?.contentRef?.exerciseId
      ? PRACTICE_ACTIVITY_CATALOG[task.contentRef.exerciseId]
      : practiceCatalogForSkill(task?.skill);
    if (!task || !planId || !catalog || catalog.route !== task.route) return task?.route || "/practice";
    const query = new URLSearchParams({ plan_id: planId, task_id: task.taskId });
    return `${task.route}?${query.toString()}`;
  };
  const resolvePracticeTaskContext = (skill, exerciseId) => {
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    const currentRoute = window.location.pathname.replace(/\.html$/, "");
    if (!catalog || catalog.skill !== skill || currentRoute !== catalog.route) return null;
    const params = new URLSearchParams(window.location.search);
    const planId = params.get("plan_id");
    const taskId = params.get("task_id");
    if (!planId && !taskId) return null;
    if (!planId || !taskId || state.plan?.planId !== planId) return null;
    const task = currentPlanTaskById(taskId);
    if (!task || task.skill !== skill || task.route !== catalog.route) return null;
    if (
      task.contentRef &&
      (
        task.contentRef.exerciseId !== exerciseId ||
        task.contentRef.contentId !== catalog.contentId ||
        task.contentRef.contentVersion !== catalog.activityVersion ||
        task.contentRef.contentHash !== catalog.contentHash
      )
    ) return null;
    return { plan: state.plan, task };
  };
  const closedLoopPracticeBinding = ({
    task,
    plan,
    cycle = state.journey?.activeCycle,
    recommendation = state.journey?.recommendation,
  } = {}) => {
    const primaryTaskId = recommendation?.primary?.taskId;
    const primarySkill = recommendation?.primary?.skill;
    const bindingTaskId = recommendation?.evidenceBinding?.practiceTaskId;
    const taskMatchesDecision = recommendation?.status === "accepted"
      ? task?.taskId === bindingTaskId && task.taskId === primaryTaskId
      : recommendation?.status === "skipped"
        ? task?.taskId !== bindingTaskId && bindingTaskId === primaryTaskId && task?.skill === primarySkill
        : false;
    if (
      !task ||
      !plan ||
      cycle?.status !== "in_progress" ||
      cycle.basePlanId !== plan.planId ||
      !cycle.recommendationId ||
      recommendation?.recommendationId !== cycle.recommendationId ||
      recommendation.cycleId !== cycle.cycleId ||
      recommendation.diagnosticSessionId !== cycle.diagnosticSessionId ||
      recommendation.planId !== plan.planId ||
      recommendation.evidenceBinding?.cycleId !== cycle.cycleId ||
      recommendation.evidenceBinding?.diagnosticSessionId !== cycle.diagnosticSessionId ||
      !taskMatchesDecision
    ) return null;
    return { cycle, recommendation };
  };
  const renderPracticeBindingStatus = (exerciseId, receipt = null) => {
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    const box = document.querySelector("[data-practice-binding-status]");
    const title = box?.querySelector("[data-practice-binding-title]");
    const copy = box?.querySelector("[data-practice-binding-copy]");
    if (!catalog || !box || !title || !copy) return;
    const context = resolvePracticeTaskContext(catalog.skill, exerciseId);
    if (receipt) {
      const skippedAlternative = Boolean(
        receipt.cycleId &&
        state.journey?.recommendation?.status === "skipped" &&
        receipt.taskId !== state.journey.recommendation.primary?.taskId,
      );
      box.dataset.bindingStatus = receipt.taskRef
        ? (receipt.cycleId ? "bound_cycle_receipt" : "bound_plan_receipt")
        : "standalone_receipt";
      title.textContent = receipt.evidenceStatus === "evidence_limited" ? "本机练习回执已生成" : "本机练习记录已保存，但证据不足";
      copy.textContent = receipt.taskRef
        ? `${receipt.cycleId
          ? (receipt.evidenceStatus === "evidence_limited"
              ? (skippedAlternative ? "已绑定跳过主推荐后的同技能替代任务" : "已绑定本轮主推荐任务")
              : "当前质量条件不足，暂不推进闭环")
          : "已绑定计划任务，但不是本轮推荐所指向的闭环任务"} · completion_receipt_id: ${receipt.completionReceiptId}。它不是能力、分数或防篡改证明。`
        : `当前为独立练习 · completion_receipt_id: ${receipt.completionReceiptId}。记录会保存在本机，但不推进七步闭环。`;
      return;
    }
    if (context) {
      const loopBinding = closedLoopPracticeBinding(context);
      box.dataset.bindingStatus = loopBinding ? "bound_cycle_task" : "bound_plan_task";
      const loopLabel = loopBinding?.recommendation.status === "skipped"
        ? "已绑定跳过主推荐后的同技能替代任务"
        : "已绑定本轮主推荐任务";
      title.textContent = `${loopBinding ? loopLabel : "已绑定计划任务"}：${context.task.titleZh}`;
      copy.textContent = loopBinding
        ? "满足本页完成条件后会生成一条本机练习回执，并推进当前七步闭环。"
        : "满足本页完成条件后会生成一条计划任务回执；它不会替代本轮推荐任务，也不会推进当前七步闭环。";
      return;
    }
    box.dataset.bindingStatus = "standalone";
    title.textContent = "当前是独立练习";
    copy.textContent = window.location.search
      ? "计划或任务参数未通过本机状态核对，已安全降级为独立练习；本次记录不会推进七步闭环。"
      : "当前未从计划任务进入。你仍可练习并保存独立记录，但不会推进七步闭环。";
  };
  const practiceRoot = document.querySelector("[data-exercise-id]");
  const practiceDomMatchesCatalog = (exerciseId) => {
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    if (!practiceRoot || !catalog) return false;
    const fixedMatches = Boolean(
      practiceRoot.dataset.exerciseId === exerciseId &&
      practiceRoot.dataset.activityId === catalog.activityId &&
      practiceRoot.dataset.contentId === catalog.contentId &&
      practiceRoot.dataset.contentVersion === catalog.activityVersion &&
      practiceRoot.dataset.contentHash === catalog.contentHash &&
      practiceRoot.dataset.responseType === catalog.responseType &&
      practiceRoot.dataset.evidenceClass === catalog.receiptEvidenceClass &&
      practiceRoot.dataset.completionRule === catalog.domCompletionRule
    );
    if (!fixedMatches) return false;
    if (catalog.correctValue && practiceRoot.dataset.correctValue !== catalog.correctValue) return false;
    if (catalog.minimumWords && Number(practiceRoot.dataset.minimumWords) !== catalog.minimumWords) return false;
    if (catalog.prepSeconds && Number(practiceRoot.dataset.prepSeconds) !== catalog.prepSeconds) return false;
    if (catalog.responseSeconds && Number(practiceRoot.dataset.responseSeconds) !== catalog.responseSeconds) return false;
    return true;
  };
  const validPracticeReceipt = (receipt, task = null) => {
    if (!hasValidPracticeReceiptShape(receipt, receipt?.completionReceiptId)) return false;
    const catalog = PRACTICE_ACTIVITY_CATALOG[receipt.exerciseId];
    if (
      !catalog ||
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
      !["evidence_limited", "evidence_insufficient"].includes(receipt.evidenceStatus) ||
      receipt.sealed !== true ||
      receipt.ownerScope !== "browser_local_not_account_bound" ||
      receipt.integrityClass !== "unsigned_local_receipt" ||
      receipt.status !== "completed" ||
      !Array.isArray(receipt.qualityFlags) ||
      typeof receipt.completedAt !== "string"
    ) return false;
    if (
      task &&
      (receipt.taskId !== task.taskId || receipt.skill !== task.skill || receipt.route !== task.route)
    ) return false;
    if (
      task?.contentRef &&
      (
        receipt.contentId !== task.contentRef.contentId ||
        receipt.activityVersion !== task.contentRef.contentVersion ||
        receipt.contentHash !== task.contentRef.contentHash ||
        receipt.exerciseId !== task.contentRef.exerciseId
      )
    ) return false;
    return true;
  };
  const practiceReceiptForTask = (task) => {
    if (!task) return null;
    const progress = state.taskProgress[task.taskId];
    const receipt = state.practiceReceipts[progress?.practiceReceiptId];
    if (
      progress?.status !== "completed" ||
      progress?.selfReported !== false ||
      progress?.completionClass !== "practice_receipt" ||
      !validPracticeReceipt(receipt, task)
    ) return null;
    return receipt;
  };
  const qualifyingPracticeReceiptForTask = (task) => {
    const receipt = practiceReceiptForTask(task);
    return receipt?.evidenceStatus === "evidence_limited" ? receipt : null;
  };
  const practiceReceiptMatchesJourneyScope = ({ receipt, task, cycle, recommendation, plan }) => {
    if (!receipt || !task || !plan || receipt.taskId !== task.taskId || receipt.taskRef?.taskId !== task.taskId) return false;
    const loopBinding = closedLoopPracticeBinding({ task, plan, cycle, recommendation });
    if (!loopBinding) {
      return Boolean(
        receipt.planId === plan.planId &&
        receipt.taskRef?.planId === plan.planId &&
        receipt.cycleId === null &&
        receipt.taskRef?.cycleId === null &&
        receipt.diagnosticSessionId === null &&
        receipt.taskRef?.diagnosticSessionId === null &&
        receipt.recommendationId === null
      );
    }
    const activeCycle = loopBinding.cycle;
    const expectedRecommendationId = activeCycle.recommendationId || null;
    return Boolean(
      receipt.planId === activeCycle.basePlanId &&
      receipt.taskRef?.planId === activeCycle.basePlanId &&
      receipt.cycleId === activeCycle.cycleId &&
      receipt.taskRef?.cycleId === activeCycle.cycleId &&
      receipt.diagnosticSessionId === activeCycle.diagnosticSessionId &&
      receipt.taskRef?.diagnosticSessionId === activeCycle.diagnosticSessionId &&
      (receipt.recommendationId || null) === expectedRecommendationId &&
      (expectedRecommendationId === null || recommendation?.recommendationId === expectedRecommendationId)
    );
  };
  const currentPracticeAttemptScope = (skill, exerciseId) => {
    const context = resolvePracticeTaskContext(skill, exerciseId);
    if (!context) {
      return { context: null, key: `standalone:${exerciseId}` };
    }
    const loopBinding = closedLoopPracticeBinding(context);
    const cycle = loopBinding?.cycle || null;
    const cycleId = cycle?.cycleId || null;
    const recommendationId = cycleId ? cycle.recommendationId || null : null;
    const diagnosticSessionId = cycleId ? cycle.diagnosticSessionId || null : null;
    return {
      context,
      key: [
        `plan:${context.plan.planId}`,
        `task:${context.task.taskId}`,
        `cycle:${cycleId || "none"}`,
        `diagnostic:${diagnosticSessionId || "none"}`,
        `recommendation:${recommendationId || "none"}`,
      ].join("|"),
    };
  };
  const practiceReceiptMatchesCurrentPageScope = (receipt, skill, exerciseId) => {
    if (!validPracticeReceipt(receipt) || receipt.skill !== skill || receipt.exerciseId !== exerciseId) return false;
    const { context } = currentPracticeAttemptScope(skill, exerciseId);
    if (!context) {
      return Boolean(
        receipt.taskId === null &&
        receipt.taskRef === null &&
        receipt.planId === null &&
        receipt.cycleId === null &&
        receipt.diagnosticSessionId === null &&
        receipt.recommendationId === null
      );
    }
    if (!validPracticeReceipt(receipt, context.task)) return false;
    const cycle = state.journey?.activeCycle;
    return practiceReceiptMatchesJourneyScope({
      receipt,
      task: context.task,
      cycle,
      recommendation: cycle?.recommendationId ? state.journey?.recommendation : null,
      plan: context.plan,
    });
  };
  const derivePracticeAttemptBoundary = ({ current, latestReceipt, latestReceiptId, scopeKey, now }) => {
    const legacyReceipt = hasSafeLegacyPracticeReceiptShape(latestReceipt, latestReceiptId);
    const scopeChanged = current.attemptScopeKey !== scopeKey;
    const legacyNeedsFreshAttempt = legacyReceipt && current.freshAttemptFromLegacyReceiptId !== latestReceiptId;
    if (!scopeChanged && !legacyNeedsFreshAttempt) {
      return { reset: false, legacyReceipt: false, scopeKey, nextPractice: null };
    }
    return {
      reset: true,
      legacyReceipt,
      scopeKey,
      nextPractice: {
      latestPracticeReceiptId: latestReceiptId,
      attemptScopeKey: scopeKey,
      freshAttemptFromLegacyReceiptId: legacyReceipt ? latestReceiptId : null,
      status: "in_progress",
      selectedAnswer: null,
      firstResponse: null,
      attempts: 0,
      draftText: "",
      selfChecks: {},
      wordCount: 0,
      audioPlayed: false,
      audioCompleted: false,
      audioRecorded: false,
      playCount: 0,
      audioSeekDetected: false,
      audioPlaybackFailed: false,
      audioStartedNearBeginning: false,
      transcriptUsed: false,
      timerCompleted: false,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      },
    };
  };
  const initializePracticeAttemptScope = (skill, exerciseId) => {
    const current = state.practice[exerciseId] || {};
    const latestReceiptId = current.latestPracticeReceiptId || null;
    const latestReceipt = latestReceiptId ? state.practiceReceipts[latestReceiptId] : null;
    const { key } = currentPracticeAttemptScope(skill, exerciseId);
    const boundary = derivePracticeAttemptBoundary({
      current,
      latestReceipt,
      latestReceiptId,
      scopeKey: key,
      now: new Date().toISOString(),
    });
    if (!boundary.reset) return boundary;
    state.practice[exerciseId] = boundary.nextPractice;
    persist();
    return boundary;
  };
  if (practiceRoot?.dataset.exerciseId) {
    const exerciseId = practiceRoot.dataset.exerciseId;
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    const latestReceiptId = state.practice[exerciseId]?.latestPracticeReceiptId;
    const latestReceipt = state.practiceReceipts[latestReceiptId];
    renderPracticeBindingStatus(
      exerciseId,
      catalog && practiceReceiptMatchesCurrentPageScope(latestReceipt, catalog.skill, exerciseId) ? latestReceipt : null,
    );
  }
  const taskEvidenceLabel = (task) => {
    const receipt = practiceReceiptForTask(task);
    if (receipt?.evidenceStatus === "evidence_limited") return "练习记录已留存";
    if (receipt?.evidenceStatus === "evidence_insufficient") return "练习记录证据不足";
    const progress = state.taskProgress[task.taskId];
    if (progress?.status === "completed" && progress?.completionClass === "workflow_receipt") return "页面流程已留存";
    if (progress?.status === "completed" && progress?.selfReported === true) return "学习者自报完成";
    return "尚未完成";
  };

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
      const evidenceBadge = document.createElement("small");
      const receipt = practiceReceiptForTask(task);
      const progressRecord = state.taskProgress[task.taskId];
      evidenceBadge.className = "task-evidence-badge";
      evidenceBadge.dataset.evidenceClass = receipt
        ? "practice_receipt"
        : progressRecord?.completionClass === "workflow_receipt"
          ? "workflow_receipt"
          : progressRecord?.selfReported === true
            ? "learner_self_report"
            : "not_completed";
      evidenceBadge.textContent = taskEvidenceLabel(task);
      label.append(title, detail, evidenceBadge);
      const route = document.createElement("a");
      route.className = "task-route";
      route.href = currentPlanTaskById(task.taskId) && DIAGNOSTIC_SKILLS.has(task.skill)
        ? boundPracticeHref(task, state.plan?.planId)
        : task.route;
      route.textContent = task.skill === "Reflection" ? "去复盘" : "开始";
      item.append(checkbox, label, route);
      list.append(item);
      if (receipt || progressRecord?.completionClass === "workflow_receipt") {
        checkbox.disabled = true;
        checkbox.title = receipt ? "这项完成状态来自已保存的练习记录。" : "这项完成状态来自已保存的页面流程。";
      }
      checkbox.addEventListener("change", () => {
        state.taskProgress[task.taskId] = {
          status: checkbox.checked ? "completed" : "todo",
          updatedAt: new Date().toISOString(),
          completedAt: checkbox.checked ? new Date().toISOString() : null,
          selfReported: true,
          completionClass: checkbox.checked ? "learner_self_report" : "not_completed",
          source: "learner_checkbox",
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

  const sealPracticeReceipt = (skill, exerciseId, evidence = {}) => {
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    if (!catalog || catalog.skill !== skill) return null;
    const taskContext = resolvePracticeTaskContext(skill, exerciseId);
    const task = taskContext?.task || null;
    const existingReceipt = task ? qualifyingPracticeReceiptForTask(task) : null;
    const currentCycle = state.journey?.activeCycle;
    const currentRecommendation = state.journey?.recommendation;
    if (
      existingReceipt &&
      practiceReceiptMatchesJourneyScope({
        receipt: existingReceipt,
        task,
        cycle: currentCycle,
        recommendation: currentCycle?.recommendationId ? currentRecommendation : null,
        plan: taskContext?.plan,
      })
    ) return existingReceipt;
    const completedAt = new Date().toISOString();
    const planId = taskContext?.plan?.planId || null;
    const loopBinding = taskContext
      ? closedLoopPracticeBinding({
          ...taskContext,
          cycle: currentCycle,
          recommendation: currentRecommendation,
        })
      : null;
    const cycle = loopBinding?.cycle || null;
    const cycleId = cycle?.cycleId || null;
    const attemptCount = Number.isInteger(evidence.attemptCount) ? evidence.attemptCount : null;
    const wordCount = Number.isInteger(evidence.wordCount) ? evidence.wordCount : null;
    const selfCheckCount = Number.isInteger(evidence.selfCheckCount) ? evidence.selfCheckCount : null;
    let evidencePayload = null;
    if (["objective_response", "audio_objective_response"].includes(catalog.receiptEvidenceClass)) {
      evidencePayload = {
        firstResponse: evidence.firstResponse,
        finalResponse: evidence.finalResponse,
        attemptCount,
        resultType: "correct",
      };
      if (catalog.receiptEvidenceClass === "audio_objective_response") {
        evidencePayload = {
          ...evidencePayload,
          audioPlayed: evidence.audioPlayed === true,
          audioCompleted: evidence.audioCompleted === true,
          playCount: Number.isInteger(evidence.playCount) ? evidence.playCount : 0,
          transcriptUsed: evidence.transcriptUsed === true,
          seekDetected: evidence.seekDetected === true,
          playbackFailed: evidence.playbackFailed === true,
        };
      }
    } else if (catalog.receiptEvidenceClass === "self_reviewed_artifact") {
      evidencePayload = {
        wordCount,
        selfChecks: {
          idea: evidence.selfChecks?.idea === true,
          reason: evidence.selfChecks?.reason === true,
          edit: evidence.selfChecks?.edit === true,
        },
        selfCheckCount,
        artifactHash: evidence.artifactHash,
        resultType: "completed_no_score",
      };
    } else if (catalog.receiptEvidenceClass === "timed_self_report") {
      evidencePayload = {
        prepSeconds: evidence.prepSeconds,
        responseSeconds: evidence.responseSeconds,
        timerCompleted: evidence.timerCompleted === true,
        selfChecks: {
          answer: evidence.selfChecks?.answer === true,
          example: evidence.selfChecks?.example === true,
          flow: evidence.selfChecks?.flow === true,
        },
        selfCheckCount,
        audioRecorded: evidence.audioRecorded === true,
        resultType: "completed_no_score",
      };
    }
    const receipt = {
      protocolVersion: PRACTICE_RECEIPT_VERSION,
      practiceAttemptId: createUuid(),
      completionReceiptId: createUuid(),
      sealed: true,
      ownerScope: "browser_local_not_account_bound",
      integrityClass: "unsigned_local_receipt",
      exerciseId,
      activityId: catalog.activityId,
      activityVersion: catalog.activityVersion,
      contentId: catalog.contentId,
      contentHash: catalog.contentHash,
      taskId: task?.taskId || null,
      taskDate: task?.date || null,
      planId,
      cycleId,
      diagnosticSessionId: cycleId ? cycle.diagnosticSessionId : null,
      recommendationId: cycleId ? cycle.recommendationId || null : null,
      taskRef: planId
        ? {
            cycleId,
            diagnosticSessionId: cycleId ? cycle.diagnosticSessionId : null,
            planId,
            taskId: task.taskId,
            taskDate: task.date,
          }
        : null,
      contentRef: {
        exerciseId,
        contentId: catalog.contentId,
        contentVersion: catalog.activityVersion,
        contentHash: catalog.contentHash,
      },
      skill,
      route: catalog.route,
      status: "completed",
      completionSource: "guided_practice",
      evidenceClass: "practice_receipt",
      receiptEvidenceClass: catalog.receiptEvidenceClass,
      evidenceType: catalog.evidenceType,
      completionCondition: catalog.completionCondition,
      evidenceStatus: skill === "Listening" && (
        evidence.audioPlayed !== true ||
        evidence.audioCompleted !== true ||
        (Array.isArray(evidence.qualityFlags) && evidence.qualityFlags.some((flag) => ["audio_seek_detected", "audio_playback_failed", "transcript_used"].includes(flag)))
      ) ? "evidence_insufficient" : "evidence_limited",
      attemptCount,
      wordCount,
      selfCheckCount,
      audioPlayed: evidence.audioPlayed === true,
      audioCompleted: evidence.audioCompleted === true,
      audioRecorded: evidence.audioRecorded === true,
      qualityFlags: Array.isArray(evidence.qualityFlags) ? [...new Set(evidence.qualityFlags)] : [],
      evidence: evidencePayload,
      automatedScoreProduced: false,
      formalDiagnosisProduced: false,
      officialEquivalenceClaimed: false,
      startedAt: typeof evidence.startedAt === "string" ? evidence.startedAt : null,
      completedAt,
    };
    if (!hasValidPracticeReceiptShape(receipt, receipt.completionReceiptId)) return null;
    if (task) {
      state.taskProgress[task.taskId] = {
        status: "completed",
        updatedAt: completedAt,
        completedAt,
        selfReported: false,
        completionClass: "practice_receipt",
        source: `practice-${skill.toLowerCase()}`,
        practiceReceiptId: receipt.completionReceiptId,
        evidenceStatus: receipt.evidenceStatus,
        receiptEvidenceClass: receipt.receiptEvidenceClass,
      };
    }
    state.practiceReceipts[receipt.completionReceiptId] = receipt;
    state.practice[exerciseId] = {
      ...(state.practice[exerciseId] || {}),
      latestPracticeReceiptId: receipt.completionReceiptId,
    };
    return receipt;
  };

  const setupChoicePractice = ({ name, exerciseId, buttonSelector, feedbackSelector, explanation, skill }) => {
    const options = [...document.querySelectorAll(`input[name="${name}"]`)];
    const button = document.querySelector(buttonSelector);
    const feedback = document.querySelector(feedbackSelector);
    const restartButton = skill === "Listening" ? document.querySelector("[data-restart-listening]") : null;
    if (!options.length || !button || !feedback) return;
    const catalog = PRACTICE_ACTIVITY_CATALOG[exerciseId];
    if (!catalog || !practiceDomMatchesCatalog(exerciseId)) {
      options.forEach((option) => { option.disabled = true; });
      button.disabled = true;
      if (restartButton) restartButton.hidden = true;
      feedback.textContent = "练习内容版本未通过本机核对；为避免生成错误回执，本页已停止封存。";
      return;
    }
    const attemptBoundary = initializePracticeAttemptScope(skill, exerciseId);
    const saved = state.practice[exerciseId] || {};
    if (saved.selectedAnswer) {
      const selected = options.find((option) => option.value === saved.selectedAnswer);
      if (selected) selected.checked = true;
    }
    const latestReceipt = () => {
      const receiptId = state.practice[exerciseId]?.latestPracticeReceiptId;
      return receiptId ? state.practiceReceipts[receiptId] : null;
    };
    const syncAttemptBoundary = () => {
      const currentReceipt = latestReceipt();
      const currentScopeReceipt = practiceReceiptMatchesCurrentPageScope(currentReceipt, skill, exerciseId);
      const restartRequired = skill === "Listening" && currentScopeReceipt && currentReceipt.evidenceStatus === "evidence_insufficient";
      const sealedComplete = currentScopeReceipt && currentReceipt.evidenceStatus === "evidence_limited";
      options.forEach((option) => { option.disabled = restartRequired || sealedComplete; });
      button.disabled = restartRequired || sealedComplete || !options.some((option) => option.checked);
      if (restartButton) restartButton.hidden = !restartRequired;
      if (sealedComplete) feedback.textContent = "这条练习回执已经封存；需要再次练习时，请从新计划任务开始。";
    };
    syncAttemptBoundary();
    if (attemptBoundary.legacyReceipt) {
      feedback.textContent = "旧版回执已保留，但旧答案和练习证据不会沿用；请重新完成本次练习。";
    } else if (attemptBoundary.reset) {
      feedback.textContent = "已为当前计划任务开始一条新的练习尝试。";
    }
    options.forEach((option) => {
      option.addEventListener("change", () => {
        button.disabled = false;
        const current = state.practice[exerciseId] || {};
        state.practice[exerciseId] = {
          ...current,
          status: "in_progress",
          selectedAnswer: option.value,
          startedAt: current.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persist();
      });
    });
    button.addEventListener("click", async () => {
      const selected = options.find((option) => option.checked);
      if (!selected) {
        feedback.textContent = "请先选择一个答案。";
        return;
      }
      const correct = selected.value === catalog.correctValue;
      if (!correct) {
        const previous = state.practice[exerciseId] || {};
        const attempts = Number(previous.attempts || 0) + 1;
        state.practice[exerciseId] = {
          ...previous,
          status: "checked",
          selectedAnswer: selected.value,
          firstResponse: previous.firstResponse || selected.value,
          attempts,
          startedAt: previous.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        feedback.textContent = `再试一次。${explanation}`;
        persist();
        return;
      }
      options.forEach((option) => { option.disabled = true; });
      button.disabled = true;
      feedback.textContent = "正在核对并封存本机练习回执…";
      const outcome = await withExclusiveWorkspaceWrite(async () => {
        const before = snapshotState();
        const previous = state.practice[exerciseId] || {};
        const attempts = Number(previous.attempts || 0) + 1;
        const firstResponse = previous.firstResponse || selected.value;
        const completedAt = new Date().toISOString();
        state.practice[exerciseId] = {
          ...previous,
          status: "completed",
          selectedAnswer: selected.value,
          firstResponse,
          attempts,
          startedAt: previous.startedAt || completedAt,
          updatedAt: completedAt,
          completedAt,
        };
        const practice = state.practice[exerciseId];
        const qualityFlags = [];
        if (attempts > 1) qualityFlags.push("multiple_attempts");
        if (skill === "Listening") {
          if (practice.audioPlayed !== true) qualityFlags.push("audio_not_played");
          if (practice.audioCompleted !== true) qualityFlags.push("audio_not_completed");
          if (practice.audioSeekDetected === true) qualityFlags.push("audio_seek_detected");
          if (practice.audioPlaybackFailed === true) qualityFlags.push("audio_playback_failed");
          if (practice.transcriptUsed === true) qualityFlags.push("transcript_used");
        }
        const receipt = sealPracticeReceipt(skill, exerciseId, {
          firstResponse,
          finalResponse: selected.value,
          attemptCount: attempts,
          audioPlayed: practice.audioPlayed === true,
          audioCompleted: practice.audioCompleted === true,
          playCount: Number(practice.playCount || 0),
          transcriptUsed: practice.transcriptUsed === true,
          seekDetected: practice.audioSeekDetected === true,
          playbackFailed: practice.audioPlaybackFailed === true,
          qualityFlags,
          startedAt: practice.startedAt,
        });
        if (!receipt) {
          state = before;
          return { status: "receipt_invalid" };
        }
        const eventOutcome = await appendPracticeFinalizationEvent(receipt);
        if (!["appended", "already_recorded", "not_applicable"].includes(eventOutcome.status)) {
          state = before;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        if (!persist()) {
          state = before;
          return { status: "persist_failed" };
        }
        return { status: "saved", receipt };
      });
      if (outcome.status === "saved") {
        feedback.textContent = `回答正确。${explanation}`;
        renderPracticeBindingStatus(exerciseId, outcome.receipt);
      } else {
        feedback.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；本次答案未形成正式回执。"
          : outcome.status === "persist_failed"
            ? "当前无法保存；本次答案未形成正式回执。"
            : "练习证据或本机事件链未通过核对；本次答案未形成正式回执。";
        if (!storageWritable) disableWorkspaceControls();
      }
      updateHeroProgress();
      syncAttemptBoundary();
    });
    restartButton?.addEventListener("click", () => {
      const previous = state.practice[exerciseId] || {};
      const audio = document.querySelector("[data-listening-audio]");
      const transcript = document.querySelector(".listening-transcript");
      audio?.pause();
      audio?.load();
      if (transcript) transcript.open = false;
      state.practice[exerciseId] = {
        latestPracticeReceiptId: previous.latestPracticeReceiptId || null,
        attemptScopeKey: previous.attemptScopeKey,
        freshAttemptFromLegacyReceiptId: previous.freshAttemptFromLegacyReceiptId || null,
        status: "in_progress",
        selectedAnswer: null,
        firstResponse: null,
        attempts: 0,
        audioPlayed: false,
        audioCompleted: false,
        playCount: 0,
        audioSeekDetected: false,
        audioPlaybackFailed: false,
        audioStartedNearBeginning: false,
        transcriptUsed: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      options.forEach((option) => {
        option.checked = false;
        option.disabled = false;
      });
      button.disabled = true;
      restartButton.hidden = true;
      feedback.textContent = "新的听力尝试已开始；请从头完整播放音频后再作答。";
      persist();
    });
  };

  setupChoicePractice({
    name: "reading-answer",
    exerciseId: "reading-library-v1",
    buttonSelector: "[data-check-reading]",
    feedbackSelector: "[data-reading-feedback]",
    explanation: "图书馆设置安静区和讨论区，是为了支持不同的学习方式。",
    skill: "Reading",
  });
  setupChoicePractice({
    name: "listening-answer",
    exerciseId: "listening-club-v1",
    buttonSelector: "[data-check-listening]",
    feedbackSelector: "[data-listening-feedback]",
    explanation: "会议改到 Thursday，但开始时间仍然是 4:30。",
    skill: "Listening",
  });

  const listeningAudio = document.querySelector("[data-listening-audio]");
  const audioStatus = document.querySelector("[data-audio-status]");
  listeningAudio?.addEventListener("error", () => {
    if (audioStatus) audioStatus.textContent = "音频暂时无法播放。请展开英文原文继续练习；本站不会反复自动重试。";
    const current = state.practice["listening-club-v1"] || {};
    state.practice["listening-club-v1"] = { ...current, audioPlaybackFailed: true, updatedAt: new Date().toISOString() };
    persist();
  });
  listeningAudio?.addEventListener("play", () => {
    if (audioStatus) audioStatus.textContent = "正在播放英文材料。";
    const current = state.practice["listening-club-v1"] || {};
    state.practice["listening-club-v1"] = {
      ...current,
      audioPlayed: true,
      audioCompleted: current.audioCompleted === true,
      playCount: Number(current.playCount || 0) + 1,
      audioStartedNearBeginning: current.audioStartedNearBeginning === true || listeningAudio.currentTime <= 0.25,
      startedAt: current.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist();
  });
  listeningAudio?.addEventListener("seeking", () => {
    const current = state.practice["listening-club-v1"] || {};
    state.practice["listening-club-v1"] = { ...current, audioSeekDetected: true, audioCompleted: false, updatedAt: new Date().toISOString() };
    persist();
  });
  listeningAudio?.addEventListener("ended", () => {
    const current = state.practice["listening-club-v1"] || {};
    const audioCompleted = current.audioCompleted === true || (current.audioStartedNearBeginning === true && current.audioSeekDetected !== true);
    state.practice["listening-club-v1"] = { ...current, audioCompleted, updatedAt: new Date().toISOString() };
    if (audioStatus) audioStatus.textContent = audioCompleted
      ? "音频已从开头连续播放完成。"
      : "音频已结束，但播放条件有变化；记录会保留质量限制。";
    persist();
  });
  document.querySelector(".listening-transcript")?.addEventListener("toggle", (event) => {
    if (!event.currentTarget.open) return;
    const current = state.practice["listening-club-v1"] || {};
    state.practice["listening-club-v1"] = { ...current, transcriptUsed: true, updatedAt: new Date().toISOString() };
    persist();
  });

  const writing = document.querySelector("[data-writing-answer]");
  if (writing) {
    const wordCount = document.querySelector("[data-word-count]");
    const saveStatus = document.querySelector("[data-writing-save-status]");
    const completeButton = document.querySelector("[data-complete-writing]");
    const feedback = document.querySelector("[data-writing-feedback]");
    const reviewBoxes = [...document.querySelectorAll("[data-review]")];
    if (!practiceDomMatchesCatalog("writing-community-v1")) {
      writing.disabled = true;
      reviewBoxes.forEach((box) => { box.disabled = true; });
      if (completeButton) completeButton.disabled = true;
      if (feedback) feedback.textContent = "练习内容版本未通过本机核对；为避免生成错误回执，本页已停止封存。";
      return;
    }
    const writingCatalog = PRACTICE_ACTIVITY_CATALOG["writing-community-v1"];
    const attemptBoundary = initializePracticeAttemptScope("Writing", "writing-community-v1");
    const saved = state.practice["writing-community-v1"] || {};
    const savedWritingReceipt = state.practiceReceipts[saved.latestPracticeReceiptId];
    let writingReceiptSealed = practiceReceiptMatchesCurrentPageScope(savedWritingReceipt, "Writing", "writing-community-v1") && savedWritingReceipt.evidenceStatus === "evidence_limited";
    writing.value = saved.draftText || "";
    reviewBoxes.forEach((box) => {
      box.checked = Boolean(saved.selfChecks?.[box.dataset.review]);
    });
    let writingTimer;
    const countWords = () => {
      const words = writing.value.trim() ? writing.value.trim().split(/\s+/).filter(Boolean).length : 0;
      if (wordCount) wordCount.textContent = String(words);
      const ready = words >= writingCatalog.minimumWords && reviewBoxes.every((box) => box.checked);
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
        startedAt: previous.startedAt || new Date().toISOString(),
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
    completeButton?.addEventListener("click", async () => {
      if (writingReceiptSealed) return;
      const normalizedArtifact = writing.value.replace(/\r\n/g, "\n").trim();
      const words = normalizedArtifact ? normalizedArtifact.split(/\s+/).filter(Boolean).length : 0;
      const selfChecks = Object.fromEntries(reviewBoxes.map((box) => [box.dataset.review, box.checked]));
      const selfCheckCount = Object.values(selfChecks).filter(Boolean).length;
      if (words < writingCatalog.minimumWords || selfCheckCount !== reviewBoxes.length) {
        if (feedback) feedback.textContent = `请先达到 ${writingCatalog.minimumWords} 词并完成全部自查。`;
        return;
      }
      writing.disabled = true;
      reviewBoxes.forEach((box) => { box.disabled = true; });
      completeButton.disabled = true;
      window.clearTimeout(writingTimer);
      if (saveStatus) saveStatus.textContent = "正在封存回执…";
      const artifactHash = await sha256Hex(normalizedArtifact);
      const outcome = await withExclusiveWorkspaceWrite(async () => {
        const before = snapshotState();
        const previous = state.practice["writing-community-v1"] || {};
        const completedAt = new Date().toISOString();
        state.practice["writing-community-v1"] = {
          ...previous,
          status: "completed",
          draftText: normalizedArtifact,
          selfChecks,
          wordCount: words,
          completedAt,
          updatedAt: completedAt,
        };
        const receipt = sealPracticeReceipt("Writing", "writing-community-v1", {
          wordCount: words,
          selfCheckCount,
          selfChecks,
          artifactHash,
          qualityFlags: ["open_response_not_human_reviewed"],
          startedAt: state.practice["writing-community-v1"].startedAt,
        });
        if (!receipt) {
          state = before;
          return { status: "receipt_invalid" };
        }
        const eventOutcome = await appendPracticeFinalizationEvent(receipt);
        if (!["appended", "already_recorded", "not_applicable"].includes(eventOutcome.status)) {
          state = before;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        if (!persist()) {
          state = before;
          return { status: "persist_failed" };
        }
        return { status: "saved", receipt };
      });
      if (outcome.status === "saved") {
        writingReceiptSealed = true;
        renderPracticeBindingStatus("writing-community-v1", outcome.receipt);
        if (saveStatus) saveStatus.textContent = "回执已封存";
        if (feedback) feedback.textContent = `已标记为完成。${writingCatalog.minimumWords} 词与三项自查只是完成条件，不是写作能力评分。`;
      } else {
        writing.disabled = false;
        reviewBoxes.forEach((box) => { box.disabled = false; });
        countWords();
        if (saveStatus) saveStatus.textContent = outcome.status === "persist_failed" ? "保存失败，草稿仍保留" : "封存失败，草稿仍保留";
        if (feedback) feedback.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；本次写作未形成正式回执。"
          : "写作证据或本机事件链未通过核对；本次写作未形成正式回执。";
        if (!storageWritable) disableWorkspaceControls();
      }
    });
    countWords();
    if (attemptBoundary.legacyReceipt && feedback) {
      feedback.textContent = "旧版回执已保留，但旧草稿和自查不会沿用；请重新完成本次练习。";
    } else if (attemptBoundary.reset && feedback) {
      feedback.textContent = "已为当前计划任务开始一条新的写作尝试。";
    }
    if (writingReceiptSealed) {
      writing.disabled = true;
      reviewBoxes.forEach((box) => { box.disabled = true; });
      if (completeButton) completeButton.disabled = true;
      if (saveStatus) saveStatus.textContent = "回执已封存";
      if (feedback) feedback.textContent = "这条练习回执已经封存；需要再次练习时，请从新计划任务开始。";
      renderPracticeBindingStatus("writing-community-v1", savedWritingReceipt);
    } else if (saved.draftText && saveStatus) {
      saveStatus.textContent = "已恢复本机草稿";
    }
  }

  const speakingTime = document.querySelector("[data-speaking-time]");
  if (speakingTime) {
    const stateNode = document.querySelector("[data-speaking-state]");
    const announcement = document.querySelector("[data-speaking-announcement]");
    const startButton = document.querySelector("[data-speaking-start]");
    const resetButton = document.querySelector("[data-speaking-reset]");
    const feedback = document.querySelector("[data-speaking-feedback]");
    const checks = [...document.querySelectorAll("[data-speaking-review]")];
    if (!practiceDomMatchesCatalog("speaking-skill-v1")) {
      if (startButton) startButton.disabled = true;
      if (resetButton) resetButton.disabled = true;
      checks.forEach((box) => { box.disabled = true; });
      if (feedback) feedback.textContent = "练习内容版本未通过本机核对；为避免生成错误回执，本页已停止封存。";
      return;
    }
    const speakingCatalog = PRACTICE_ACTIVITY_CATALOG["speaking-skill-v1"];
    const attemptBoundary = initializePracticeAttemptScope("Speaking", "speaking-skill-v1");
    const savedSpeakingReceiptId = state.practice["speaking-skill-v1"]?.latestPracticeReceiptId;
    const savedSpeakingReceipt = state.practiceReceipts[savedSpeakingReceiptId];
    let speakingReceiptSealed = practiceReceiptMatchesCurrentPageScope(savedSpeakingReceipt, "Speaking", "speaking-skill-v1") && savedSpeakingReceipt.evidenceStatus === "evidence_limited";
    let phase = "idle";
    let endAt = null;
    let timerId = null;
    let speakingCommitPending = false;

    const announce = (message) => {
      if (announcement) announcement.textContent = message;
    };
    const updateSpeakingReviews = () => {
      const ready = phase === "complete" || state.practice["speaking-skill-v1"]?.status === "completed";
      checks.forEach((box) => {
        box.disabled = speakingReceiptSealed || !ready;
      });
    };
    const saveSpeakingChecks = async () => {
      if (speakingReceiptSealed || speakingCommitPending) return;
      const previous = state.practice["speaking-skill-v1"] || {};
      const selfChecks = Object.fromEntries(checks.map((box) => [box.dataset.speakingReview, box.checked]));
      const completed = phase === "complete" && checks.every((box) => box.checked);
      if (!completed) {
        state.practice["speaking-skill-v1"] = {
          ...previous,
          status: "checked",
          selfChecks,
          startedAt: previous.startedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: previous.completedAt || null,
        };
        persist();
        return;
      }
      speakingCommitPending = true;
      checks.forEach((box) => { box.disabled = true; });
      if (resetButton) resetButton.disabled = true;
      if (feedback) feedback.textContent = "正在核对并封存本机练习回执…";
      const outcome = await withExclusiveWorkspaceWrite(async () => {
        const before = snapshotState();
        const current = state.practice["speaking-skill-v1"] || {};
        const completedAt = new Date().toISOString();
        state.practice["speaking-skill-v1"] = {
          ...current,
          status: "completed",
          selfChecks,
          startedAt: current.startedAt || completedAt,
          updatedAt: completedAt,
          completedAt,
        };
        const receipt = sealPracticeReceipt("Speaking", "speaking-skill-v1", {
          selfCheckCount: Object.values(selfChecks).filter(Boolean).length,
          selfChecks,
          prepSeconds: speakingCatalog.prepSeconds,
          responseSeconds: speakingCatalog.responseSeconds,
          timerCompleted: true,
          audioRecorded: false,
          qualityFlags: ["audio_not_recorded", "open_response_not_human_reviewed"],
          startedAt: state.practice["speaking-skill-v1"].startedAt,
        });
        if (!receipt) {
          state = before;
          return { status: "receipt_invalid" };
        }
        const eventOutcome = await appendPracticeFinalizationEvent(receipt);
        if (!["appended", "already_recorded", "not_applicable"].includes(eventOutcome.status)) {
          state = before;
          return { status: eventOutcome.status, code: eventOutcome.code };
        }
        if (!persist()) {
          state = before;
          return { status: "persist_failed" };
        }
        return { status: "saved", receipt };
      });
      speakingCommitPending = false;
      if (outcome.status === "saved") {
        speakingReceiptSealed = true;
        renderPracticeBindingStatus("speaking-skill-v1", outcome.receipt);
        if (feedback) feedback.textContent = "练习和三项自查已完成。本页不录音，也不提供发音或流利度评分。";
      } else {
        if (resetButton) resetButton.disabled = false;
        if (feedback) feedback.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；本次口语练习未形成正式回执。"
          : "口语证据或本机事件链未通过核对；本次口语练习未形成正式回执。";
        if (!storageWritable) disableWorkspaceControls();
      }
      updateSpeakingReviews();
    };
    checks.forEach((box) => box.addEventListener("change", () => { void saveSpeakingChecks(); }));
    const tickSpeaking = () => {
      if (!endAt) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      speakingTime.textContent = formatClock(remaining);
      if (remaining > 0) return;
      if (phase === "prep") {
        phase = "speak";
        endAt = Date.now() + speakingCatalog.responseSeconds * 1000;
        speakingTime.textContent = formatClock(speakingCatalog.responseSeconds);
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
        timerCompleted: true,
        updatedAt: new Date().toISOString(),
      };
      persist();
    };
    startButton?.addEventListener("click", () => {
      if (phase !== "idle") return;
      phase = "prep";
      endAt = Date.now() + speakingCatalog.prepSeconds * 1000;
      state.practice["speaking-skill-v1"] = {
        ...(state.practice["speaking-skill-v1"] || {}),
        status: "in_progress",
        timerCompleted: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persist();
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
      speakingTime.textContent = formatClock(speakingCatalog.prepSeconds);
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
    if (savedSpeaking?.timerCompleted === true) {
      phase = "complete";
      speakingTime.textContent = "00:00";
      if (stateNode) stateNode.textContent = "本次练习已完成";
      if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "计时已完成";
      }
    }
    if (speakingReceiptSealed) {
      if (resetButton) resetButton.disabled = true;
      if (feedback) feedback.textContent = "这条练习回执已经封存；需要再次练习时，请从新计划任务开始。";
      renderPracticeBindingStatus("speaking-skill-v1", savedSpeakingReceipt);
    } else if (attemptBoundary.legacyReceipt && feedback) {
      feedback.textContent = "旧版回执已保留，但旧计时和自查不会沿用；请重新完成本次练习。";
    } else if (attemptBoundary.reset && feedback) {
      feedback.textContent = "已为当前计划任务开始一条新的口语尝试。";
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
    const linkedEvidenceStatus = document.querySelector("[data-checkin-evidence-status]");
    const receipt = document.querySelector("[data-checkin-receipt]");
    const reviewLink = document.querySelector("[data-checkin-review-link]");
    let draftTimer;
    let checkInCommitPending = false;
    let checkInControlDisabledSnapshot = null;

    const setCheckInCommitPending = (pending) => {
      checkInCommitPending = pending;
      const controls = [...checkinForm.elements];
      if (pending) {
        checkInControlDisabledSnapshot = new Map(controls.map((control) => [control, control.disabled]));
        controls.forEach((control) => {
          control.disabled = true;
        });
        checkinForm.setAttribute("aria-busy", "true");
        return;
      }
      checkInControlDisabledSnapshot?.forEach((wasDisabled, control) => {
        control.disabled = wasDisabled;
      });
      checkInControlDisabledSnapshot = null;
      checkinForm.removeAttribute("aria-busy");
    };

    const checkInCandidateTasks = () => {
      const todayTasks = getTodayTasks();
      const recommendationChain = completedRecommendationChain();
      if (!recommendationChain) return todayTasks;
      const primaryTask = recommendationChain.plan.days
        .flatMap((day) => day.tasks || [])
        .find((task) => task.taskId === recommendationChain.recommendation.primary?.taskId);
      if (recommendationChain.recommendation.status === "accepted") {
        return [...new Map([...todayTasks, ...(primaryTask ? [primaryTask] : [])].map((task) => [task.taskId, task])).values()];
      }
      const alternativeCoreTasks = recommendationChain.plan.days.flatMap((day) =>
        day.coreSkill === recommendationChain.diagnostic.prioritySkill
          ? (day.tasks || []).filter((task) =>
              task.skill === recommendationChain.diagnostic.prioritySkill &&
              task.taskId !== recommendationChain.recommendation.primary?.taskId,
            )
          : [],
      );
      return [...new Map([...todayTasks, ...alternativeCoreTasks]
        .filter((task) =>
          task.skill === recommendationChain.diagnostic.prioritySkill &&
          task.taskId !== recommendationChain.recommendation.primary?.taskId,
        )
        .map((task) => [task.taskId, task])).values()];
    };
    checkInCandidateTasks().forEach((task) => {
      const option = document.createElement("option");
      option.value = task.taskId;
      option.textContent = `${task.date && task.date !== date ? `${task.date} · ` : ""}${task.titleZh} · ${taskEvidenceLabel(task)}`;
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
    const selectedTask = () => checkInCandidateTasks().find((task) => task.taskId === linkedTaskId?.value) || null;
    const renderLinkedEvidenceStatus = () => {
      if (!linkedEvidenceStatus) return;
      const task = selectedTask();
      if (!task) {
        linkedEvidenceStatus.dataset.evidenceClass = "not_linked";
        linkedEvidenceStatus.textContent = "未关联任务的记录可以作为独立复盘，但不会进入当前七步闭环。";
        return;
      }
      const practiceReceipt = qualifyingPracticeReceiptForTask(task);
      const recommendationChain = completedRecommendationChain();
      const receiptMatchesClosedLoop = recommendationChain && practiceReceiptMatchesJourneyScope({
        receipt: practiceReceipt,
        task,
        cycle: recommendationChain.cycle,
        recommendation: recommendationChain.recommendation,
        plan: recommendationChain.plan,
      });
      if (practiceReceipt && recommendationChain && !receiptMatchesClosedLoop) {
        linkedEvidenceStatus.dataset.evidenceClass = "scope_mismatch";
        linkedEvidenceStatus.textContent = "这条练习记录早于当前推荐或属于不同闭环；请从当前推荐的绑定入口重新完成一次，旧回执会保留。";
        return;
      }
      if (practiceReceipt) {
        linkedEvidenceStatus.dataset.evidenceClass = "practice_receipt";
        linkedEvidenceStatus.textContent = `练习记录已就绪：${skillLabels[task.skill] || task.skill} · ${practiceReceipt.completionReceiptId}`;
        return;
      }
      const insufficientReceipt = practiceReceiptForTask(task);
      if (insufficientReceipt?.evidenceStatus === "evidence_insufficient") {
        linkedEvidenceStatus.dataset.evidenceClass = "evidence_insufficient";
        linkedEvidenceStatus.textContent = "这项练习已保存，但音频或文本稿等质量条件使证据不足；请重新完成一轮符合页面条件的练习。";
        return;
      }
      if (state.taskProgress[task.taskId]?.selfReported === true) {
        linkedEvidenceStatus.dataset.evidenceClass = "learner_self_report";
        linkedEvidenceStatus.textContent = "这项目前只有学习者自报完成；可保留为独立复盘，但闭环打卡仍需先完成对应练习并生成练习记录。";
        return;
      }
      linkedEvidenceStatus.dataset.evidenceClass = "not_completed";
      linkedEvidenceStatus.textContent = "这项尚无练习记录。请先打开对应练习并满足页面完成条件。";
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
      const evidenceClassNode = document.querySelector("[data-checkin-evidence-class]");
      const practiceReceiptNode = document.querySelector("[data-checkin-practice-receipt-id]");
      if (idNode) idNode.textContent = record.checkInId;
      if (planNode) planNode.textContent = record.planId || "独立打卡，未关联闭环计划";
      if (evidenceClassNode) evidenceClassNode.textContent = record.evidenceClass === "practice_receipt" ? "practice_receipt · 练习记录" : "learner_self_report · 学习者自报";
      if (practiceReceiptNode) practiceReceiptNode.textContent = record.taskCompletionReceiptId || "无 · 不计入当前闭环";
    };
    const saveDraft = () => {
      if (checkInCommitPending) return;
      const values = readCheckin();
      const previous = state.checkIns[date] || {};
      const previousSaved = Boolean(previous.checkInId && previous.status === "saved");
      const previousConfirmed = Boolean(
        previousSaved &&
          (previous.learnerConfirmedReview === true || previous.reviewId),
      );
      const contentChanged = !sameCheckinContent(previous, values);
      if (previousSaved && !contentChanged) {
        if (draftStatus) draftStatus.textContent = "内容与已确认版本一致";
        if (noteStatus) noteStatus.textContent = previousConfirmed
          ? "原确认、复盘与后续证据保持有效。"
          : "已保存版本没有变化。";
        return;
      }
      const replacesSavedVersion = previousSaved && contentChanged;
      if (replacesSavedVersion) {
        archiveCheckIn(previous, previousConfirmed ? "learner_revision_after_confirmation" : "learner_revision_after_save");
      }
      state.checkIns[date] = {
        ...previous,
        ...values,
        checkInId: replacesSavedVersion ? null : previous.checkInId || null,
        status: "draft",
        evidenceClass: "draft_unclassified",
        practiceAttemptId: null,
        taskCompletionReceiptId: null,
        practiceReceipt: null,
        learnerConfirmedReview: false,
        reviewId: null,
        reviewedAt: null,
        updatedAt: new Date().toISOString(),
      };
      if (
        state.journey?.activeCycle?.status === "in_progress" &&
        state.journey.activeCycle.reviewId === previous.reviewId
      ) {
        if (replacesSavedVersion && state.journey.activeCycle.checkInId === previous.checkInId) {
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
      if (checkInCommitPending) return;
      toggleQuestion();
      const submitButton = checkinForm.querySelector('button[type="submit"]');
      if (submitButton && storageWritable) submitButton.disabled = false;
      if (draftStatus) draftStatus.textContent = "正在保存草稿…";
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 500);
    });
    checkinForm.addEventListener("change", toggleQuestion);
    linkedTaskId?.addEventListener("change", renderLinkedEvidenceStatus);
    toggleQuestion();
    renderLinkedEvidenceStatus();
    if (saved.status === "saved" && noteStatus) {
      noteStatus.textContent = `打卡已保存于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(saved.savedAt))}`;
    } else if (saved.didText || saved.evidenceText) {
      if (draftStatus) draftStatus.textContent = "已恢复本机草稿";
    }
    renderCheckinReceipt(saved);

    checkinForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (checkInCommitPending) return;
      window.clearTimeout(draftTimer);
      const values = readCheckin();
      const errors = [];
      const activeCycle = state.journey?.activeCycle;
      const baseTaskIds = new Set(state.plan?.days?.flatMap((day) => day.tasks.map((task) => task.taskId)) || []);
      const linkedRecommendation = completedRecommendationChain();
      const pendingClosedLoop = Boolean(linkedRecommendation && values.linkedTaskId);
      const linkedTask = state.plan?.days?.flatMap((day) => day.tasks || []).find((task) => task.taskId === values.linkedTaskId) || null;
      const linkedPracticeReceipt = qualifyingPracticeReceiptForTask(linkedTask);
      const receiptMatchesClosedLoop = Boolean(
        linkedRecommendation &&
        practiceReceiptMatchesJourneyScope({
          receipt: linkedPracticeReceipt,
          task: linkedTask,
          cycle: linkedRecommendation.cycle,
          recommendation: linkedRecommendation.recommendation,
          plan: linkedRecommendation.plan,
        }),
      );
      if (values.didText.length < 10) errors.push(["didText", "“完成内容”至少需要 10 个字。"]);
      if (values.evidenceText.length < 10) errors.push(["evidenceText", "“学习证据”至少需要 10 个字。"]);
      if (pendingClosedLoop && (!values.linkedTaskId || !baseTaskIds.has(values.linkedTaskId))) {
        errors.push(["linkedTaskId", "当前闭环的证据式打卡必须关联本轮计划中的一项任务。"]);
      }
      if (pendingClosedLoop && linkedTask?.skill !== linkedRecommendation.diagnostic.prioritySkill) {
        errors.push(["linkedTaskId", `当前闭环需要关联本轮优先技能 ${skillLabels[linkedRecommendation.diagnostic.prioritySkill]} 的计划任务。`]);
      }
      if (
        pendingClosedLoop &&
        linkedRecommendation.recommendation.status === "accepted" &&
        values.linkedTaskId !== linkedRecommendation.recommendation.primary?.taskId
      ) {
        errors.push(["linkedTaskId", "你已接受主任务；本轮打卡必须关联该主任务的练习记录。"]);
      }
      if (
        pendingClosedLoop &&
        linkedRecommendation.recommendation.status === "skipped" &&
        values.linkedTaskId === linkedRecommendation.recommendation.primary?.taskId
      ) {
        errors.push(["linkedTaskId", "你已明确跳过主任务；请选择本轮计划内另一项同技能核心练习并生成新的练习记录。"]);
      }
      if (pendingClosedLoop && (!linkedPracticeReceipt || !receiptMatchesClosedLoop)) {
        errors.push(["linkedTaskId", "学习者自报、旧推荐回执或其他闭环回执不能代替当前记录；请从当前推荐的绑定入口重新完成练习并生成 completion_receipt_id。"]);
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
        baseTaskIds.has(values.linkedTaskId) &&
        linkedTask?.skill === linkedRecommendation.diagnostic.prioritySkill &&
        linkedPracticeReceipt &&
        receiptMatchesClosedLoop &&
        (
          (linkedRecommendation.recommendation.status === "accepted" &&
            values.linkedTaskId === linkedRecommendation.recommendation.primary?.taskId) ||
          (linkedRecommendation.recommendation.status === "skipped" &&
            values.linkedTaskId !== linkedRecommendation.recommendation.primary?.taskId)
        ),
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
      const previousSaved = Boolean(previous.checkInId && previous.status === "saved");
      const previousConfirmed = Boolean(previousSaved && (previous.learnerConfirmedReview === true || previous.reviewId));
      const contentChanged = !sameCheckinContent(previous, values);
      if (previousSaved && sameScope && !contentChanged) {
        renderCheckinReceipt(previous);
        if (draftStatus) draftStatus.textContent = previousConfirmed ? "证据式打卡与已确认版本一致" : "证据式打卡与已保存版本一致";
        if (noteStatus) noteStatus.textContent = previousConfirmed
          ? "内容没有变化；原确认、复盘与后续证据保持有效。"
          : "内容没有变化；原打卡记录保持有效。";
        return;
      }
      const submitButton = checkinForm.querySelector('button[type="submit"]');
      if (noteStatus) noteStatus.textContent = "正在核对证据并保存…";
      setCheckInCommitPending(true);
      let outcome;
      try {
        outcome = await withExclusiveWorkspaceWrite(async () => {
          const before = snapshotState();
          const currentPrevious = state.checkIns[date] || {};
          const currentPreviousSaved = Boolean(currentPrevious.checkInId && currentPrevious.status === "saved");
          const currentPreviousConfirmed = Boolean(
            currentPreviousSaved && (currentPrevious.learnerConfirmedReview === true || currentPrevious.reviewId),
          );
          const currentContentChanged = !sameCheckinContent(currentPrevious, values);
          const currentSameScope = Boolean(
            currentPrevious.checkInId &&
            currentPrevious.cycleId === cycleId &&
            currentPrevious.planId === planId &&
            (currentPrevious.recommendationId || null) === recommendationId,
          );
          const replacesSavedVersion = currentPreviousSaved && currentContentChanged;
          if (currentPrevious.checkInId && (replacesSavedVersion || !currentSameScope)) {
            archiveCheckIn(
              currentPrevious,
              replacesSavedVersion
                ? (currentPreviousConfirmed ? "learner_revision_after_confirmation" : "learner_revision_after_save")
                : "scope_changed",
            );
          }
          const savedAt = new Date().toISOString();
          state.checkIns[date] = {
            ...values,
            checkInId:
              currentSameScope && !replacesSavedVersion
                ? currentPrevious.checkInId
                : `check-in-${Date.now().toString(36)}`,
            cycleId,
            planId,
            diagnosticSessionId: cycleEligible ? activeCycle.diagnosticSessionId : null,
            recommendationId,
            evidenceClass: linkedPracticeReceipt ? "practice_receipt" : "learner_self_report",
            practiceAttemptId: linkedPracticeReceipt?.practiceAttemptId || null,
            taskCompletionReceiptId: linkedPracticeReceipt?.completionReceiptId || null,
            practiceReceipt: linkedPracticeReceipt ? JSON.parse(JSON.stringify(linkedPracticeReceipt)) : null,
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
          const reflectionTask = getTodayTasks().find((task) => task.skill === "Reflection");
          if (reflectionTask) {
            state.taskProgress[reflectionTask.taskId] = {
              status: "completed",
              completedAt: savedAt,
              updatedAt: savedAt,
              selfReported: false,
              completionClass: "workflow_receipt",
              source: "check-in",
              workflowReceipt: {
                protocolVersion: "sufeiya_check_in_completion_v1",
                checkInId: state.checkIns[date].checkInId,
                taskId: reflectionTask.taskId,
                completedAt: savedAt,
              },
            };
          }
          if (cycleEligible) {
            const eventOutcome = await appendLearningEvent("check_in.committed", {
              checkIn: state.checkIns[date],
              recommendation: state.journey?.recommendation,
            });
            if (!["appended", "already_recorded"].includes(eventOutcome.status)) {
              state = before;
              return { status: eventOutcome.status, code: eventOutcome.code };
            }
          }
          if (!persist()) {
            state = before;
            return { status: "persist_failed" };
          }
          return { status: "saved", record: state.checkIns[date] };
        });
      } catch {
        outcome = { status: "runtime_exception" };
      } finally {
        setCheckInCommitPending(false);
      }
      if (outcome.status !== "saved") {
        if (submitButton && storageWritable) submitButton.disabled = false;
        if (noteStatus) noteStatus.textContent = outcome.status === "lock_unavailable"
          ? "当前浏览器无法取得安全写入锁；本次打卡尚未形成正式记录。"
          : outcome.status === "persist_failed"
            ? "当前无法保存；本次打卡尚未形成正式记录。"
            : "打卡证据或本机事件链未通过核对；本次打卡尚未形成正式记录。";
        if (!storageWritable) disableWorkspaceControls();
        return;
      }
      if (submitButton) submitButton.disabled = true;
      renderCheckinReceipt(outcome.record);
      if (draftStatus) draftStatus.textContent = "证据式打卡已保存";
      if (noteStatus) {
        noteStatus.textContent = cycleEligible
          ? `已保存于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date())}；请进入下一页确认复盘。`
          : "已保存为独立本机打卡；未满足当前闭环前置条件，因此不会计入七步路径。";
      }
    });
  }

  const updateDataPage = async () => {
    const status = document.querySelector("[data-data-status]");
    const summary = document.querySelector("[data-data-summary]");
    if (!summary) return;
    const completedTasks = Object.values(state.taskProgress).filter((item) => item?.status === "completed").length;
    const practiceReceiptTasks = Object.values(state.taskProgress).filter(
      (item) => item?.status === "completed" && item?.completionClass === "practice_receipt",
    ).length;
    const selfReportedTasks = Object.values(state.taskProgress).filter(
      (item) => item?.status === "completed" && item?.selfReported === true,
    ).length;
    const completedPractice = Object.values(state.practice).filter((item) => item?.status === "completed").length;
    const practiceReceipts = Object.values(state.practiceReceipts);
    const limitedPracticeReceipts = practiceReceipts.filter((item) => item?.evidenceStatus === "evidence_limited").length;
    const insufficientPracticeReceipts = practiceReceipts.filter((item) => item?.evidenceStatus === "evidence_insufficient").length;
    const savedCheckins = Object.values(state.checkIns).filter((item) => item?.status === "saved").length;
    const confirmedReviews = Object.values(state.checkIns).filter(
      (item) => item?.status === "saved" && item?.learnerConfirmedReview === true && item?.reviewId,
    ).length;
    const completedCycles = state.journey.history.filter((item) => item?.status === "completed").length;
    const provisionalCycles = state.journey.history.filter(
      (item) => item?.status === "provisional_pending_human_review",
    ).length;
    const learningEventSummary = learningLedgerStatus.ok && learningEventsRuntime
      ? await learningEventsRuntime.summarize(state)
      : { status: "ledger_invalid", eventCount: null, headHash: null };
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
    const teachingReviewNamespace = readTeachingReviewDemoNamespace();
    const teachingReviewDraftSummary = teachingReviewNamespace.status === "recognized"
      ? "1 份 · 仅本机演示草稿"
      : teachingReviewNamespace.status === "missing"
        ? "0 份"
        : teachingReviewNamespace.status === "unrecognized"
          ? "1 份未识别原始值 · 可导出或清除"
          : "当前浏览器不允许读取";
    clearChildren(summary);
    const rows = [
      ["7 天计划", state.plan ? `当前 1 份 · 历史 ${state.planHistory.length} 份` : "尚未生成"],
      ["已完成任务", `${completedTasks} 项`],
      ["带练习记录的任务", `${practiceReceiptTasks} 项`],
      ["仅学习者自报的任务", `${selfReportedTasks} 项`],
      ["已完成微练习", `${completedPractice} 项`],
      ["本机练习回执", `${practiceReceipts.length} 条 · 可用于 Gate A ${limitedPracticeReceipts} 条 · 证据不足 ${insufficientPracticeReceipts} 条`],
      ["证据式打卡", `${savedCheckins} 条`],
      ["学生确认复盘", `${confirmedReviews} 条`],
      ["完整演示闭环", `${completedCycles} 轮`],
      ["待人工复核的临时轮次", `${provisionalCycles} 轮`],
      ["本机学习事件", learningEventSummary.status === "ready"
        ? `${learningEventSummary.eventCount} 条 · ${learningEventsRuntime?.CONTRACT_ID || "组件未加载"}`
        : `不可投影 · ${learningEventsRuntime?.CONTRACT_ID || "组件未加载"}`],
      ["事件链完整性", learningLedgerStatus.ok
        ? `${learningLedgerStatus.eventCount} 条已核对 · ${learningLedgerStatus.headHash ? `链头 ${learningLedgerStatus.headHash.slice(0, 12)}…` : "尚无事件"}`
        : "核对失败 · 已停止自动写入，不会自动修复"],
      ["专注记录", `${state.focus.sessions.length} 次`],
      ["Sofia智能老师对话消息", teacherTurns + " 条"],
      ["未发送人工请求", handoffRequests + " 条"],
      ["教研复核演示草稿", teachingReviewDraftSummary],
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
    if (status) status.textContent = learningLedgerStatus.ok
      ? (storageWritable ? "本机存储与事件链可用" : "当前为只读模式")
      : "学习事件链需要处理";
  };
  await updateDataPage();

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
      const teachingReviewNamespace = readTeachingReviewDemoNamespace();
      const workspaceData = rawStoredValue && !storageWritable ? null : state;
      const content = JSON.stringify({
        exportProtocol: "sufeiya_local_export_v2",
        exportedAt: new Date().toISOString(),
        learningEventGovernance: {
          contractId: learningEventsRuntime?.CONTRACT_ID || null,
          exportEligibility: learningEventsRuntime?.EXPORT_ELIGIBILITY || "local_user_backup_only_not_lrs_exportable",
          lrsOrXapiExport: false,
        },
        namespaces: {
          [STORAGE_KEY]: {
            parsed: workspaceData,
            raw: workspaceData ? null : rawStoredValue,
          },
          [SUPER_TEACHER_STORAGE_KEY]: {
            parsed: teacherData,
            raw: teacherData || !teacherRaw ? null : teacherRaw,
          },
          [TEACHING_REVIEW_DEMO_STORAGE_KEY]: {
            parsed: teachingReviewNamespace.status === "recognized" ? teachingReviewNamespace.parsed : null,
            raw: teachingReviewNamespace.status === "unrecognized" ? teachingReviewNamespace.raw : null,
            readStatus: teachingReviewNamespace.status,
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
      if (message) message.textContent = "包含学习闭环、Sofia智能老师与教研复核演示三个命名空间的 JSON 备份已导出到下载目录。";
    });
  });

  document.querySelectorAll("[data-export-learning-events]").forEach((button) => {
    button.addEventListener("click", async () => {
      const message = document.querySelector("[data-data-message]");
      if (!learningEventsRuntime) {
        if (message) message.textContent = "学习事件组件未加载，无法生成事件备份；可先导出全部本机原始数据。";
        return;
      }
      const result = await learningEventsRuntime.createLocalBackup(state);
      if (result.status !== "ready") {
        if (message) message.textContent = "事件链未通过完整性核对，未生成事件专用备份；请导出全部本机原始数据后再处理。";
        return;
      }
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sufeiya-learning-events-local-backup-${todayKey()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (message) message.textContent = "学习事件个人备份已导出；它不是 LRS 或 xAPI 导出，且不包含 Sofia 对话。";
    });
  });

  document.querySelectorAll("[data-clear-learning-events]").forEach((button) => {
    button.addEventListener("click", async () => {
      const message = document.querySelector("[data-data-message]");
      if (!window.confirm("确定仅清除学习事件账本和本机事件别名吗？计划、练习回执、打卡、复测、Sofia智能老师对话与教研复核演示草稿都会保留；清除后不会回填历史事件，此操作无法撤销。")) return;
      if (!workspaceStateRecognized || !workspaceWriterLeaseAvailable || !learningEventsRuntime || !navigator.locks?.request) {
        if (message) message.textContent = "当前无法安全识别或锁定本机学习数据；请先导出全部原始数据，不会自动清除。";
        return;
      }
      const before = snapshotState();
      try {
        const cleared = await navigator.locks.request(`${STORAGE_KEY}:sealed-write`, { mode: "exclusive" }, () => {
          learningEventsRuntime.clearFromState(state);
          state.updatedAt = new Date().toISOString();
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          return true;
        });
        if (!cleared) throw new Error("clear_not_committed");
      } catch {
        state = before;
        if (message) message.textContent = "浏览器未能安全清除学习事件；计划、练习与原事件均保持不变。";
        return;
      }
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-workspace]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确定仅清除这个浏览器中的 Sufeiya 学习闭环数据吗？Sofia智能老师对话与教研复核演示草稿不会被删除；此操作无法撤销。")) return;
      const outcome = await withWorkspaceRecoveryLock(() => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
          return { status: "cleared" };
        } catch {
          return { status: "clear_failed" };
        }
      });
      if (outcome.status !== "cleared") {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前无法取得学习区写入锁；请关闭其他 Sufeiya 学习页、刷新后再清除。"
          : "浏览器未允许清除学习闭环数据；原始本机数据保持不变。";
        return;
      }
      state = freshState();
      rawStoredValue = null;
      storageWritable = true;
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-super-teacher]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确定仅清除这个浏览器中的 Sofia智能老师对话和未发送人工请求吗？学习闭环数据与教研复核演示草稿不会被删除；此操作无法撤销。")) return;
      const outcome = await withSuperTeacherWriteLock(() => {
        try {
          window.localStorage.removeItem(SUPER_TEACHER_STORAGE_KEY);
          return { status: "cleared" };
        } catch {
          return { status: "clear_failed" };
        }
      });
      if (outcome.status !== "cleared") {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前无法取得 Sofia 写入锁；请关闭其他 Sofia 对话页、刷新后再清除。"
          : "浏览器未允许清除 Sofia智能老师数据。";
        return;
      }
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-teaching-review-demo]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确定仅清除这个浏览器中的教研复核演示草稿吗？学习闭环数据与 Sofia智能老师对话不会被删除；此操作无法撤销。")) return;
      const outcome = await withTeachingReviewDemoWriteLock(() => {
        try {
          window.localStorage.removeItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
          return { status: "cleared" };
        } catch {
          return { status: "clear_failed" };
        }
      });
      if (outcome.status !== "cleared") {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = outcome.status === "lock_unavailable"
          ? "当前无法取得教研演示草稿写入锁；请关闭其他教研复核演示页、刷新后再清除。"
          : "浏览器未允许清除教研复核演示草稿；原始本机数据保持不变。";
        return;
      }
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-clear-all-sufeiya]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("确定清除这个浏览器中的全部 Sufeiya 学习闭环、Sofia智能老师对话、未发送人工请求与教研复核演示草稿吗？此操作无法撤销。")) return;
      const outcome = await withWorkspaceRecoveryLock(() => withSuperTeacherWriteLock(() => withTeachingReviewDemoWriteLock(() => {
        let snapshots;
        try {
          snapshots = [
            [STORAGE_KEY, window.localStorage.getItem(STORAGE_KEY)],
            [SUPER_TEACHER_STORAGE_KEY, window.localStorage.getItem(SUPER_TEACHER_STORAGE_KEY)],
            [TEACHING_REVIEW_DEMO_STORAGE_KEY, window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY)],
          ];
        } catch {
          return { status: "clear_failed" };
        }
        try {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(SUPER_TEACHER_STORAGE_KEY);
          window.localStorage.removeItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
          return { status: "cleared" };
        } catch {
          let rollbackFailed = false;
          for (const [key, before] of snapshots) {
            try {
              if (before === null) window.localStorage.removeItem(key);
              else window.localStorage.setItem(key, before);
            } catch {
              rollbackFailed = true;
            }
          }
          return { status: rollbackFailed ? "rollback_failed" : "clear_failed" };
        }
      })));
      if (outcome.status !== "cleared") {
        const message = document.querySelector("[data-data-message]");
        if (message) message.textContent = outcome.status === "rollback_failed"
          ? "清除未能完整提交，且浏览器未能恢复原值；请立即导出全部原始数据并停止继续写入。"
          : outcome.status === "lock_unavailable"
            ? "当前无法同时取得学习区、Sofia 与教研演示草稿写入锁；请关闭其他 Sufeiya 页面、刷新后再清除。"
            : "浏览器未允许清除全部本机数据；原始值已恢复。";
        return;
      }
      state = freshState();
      rawStoredValue = null;
      storageWritable = true;
      window.location.reload();
    });
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === SUPER_TEACHER_STORAGE_KEY ||
      event.key === TEACHING_REVIEW_DEMO_STORAGE_KEY
    ) window.location.reload();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
})();
