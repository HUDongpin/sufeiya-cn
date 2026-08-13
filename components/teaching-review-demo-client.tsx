"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";

import {
  CANONICAL_LEARNER_STORAGE_KEY,
  TEACHING_REVIEW_DEMO_STORAGE_KEY,
  createTeachingReviewDraft,
  deriveTeachingReviewEvidence,
  inspectTeachingReviewDraft,
  parseTeachingReviewDraft,
  serializeTeachingReviewDraft,
  teachingReviewDemoOptions,
  type TeachingReviewDraft,
  type TeachingReviewEscalationCategory,
  type TeachingReviewEvidenceResult,
  type TeachingReviewEvidenceSnapshot,
  type TeachingReviewSkill,
} from "@/lib/teaching-review-demo";
import styles from "@/app/teaching-review-demo/teaching-review-demo.module.css";

type LoadState = { status: "loading" } | TeachingReviewEvidenceResult;

const skillLabels: Record<TeachingReviewSkill | "Unknown", string> = {
  Balanced: "综合训练",
  Reading: "Reading · 阅读",
  Listening: "Listening · 听力",
  Writing: "Writing · 写作",
  Speaking: "Speaking · 口语",
  Unknown: "未识别技能",
};

const escalationLabels: Record<TeachingReviewEscalationCategory, string> = {
  evidence_quality: "证据质量需核对",
  open_response_review: "开放作答需专业复核",
  content_alignment: "任务与学习目标需对齐",
  other: "其他待人工处理事项",
};

const statusLabels: Record<string, string> = {
  completed: "已留证",
  in_progress: "进行中",
  provisional_pending_human_review: "临时状态，等待人工确认",
  evidence_limited: "证据有限",
  evidence_insufficient: "证据不足",
  required_not_completed: "需要人工确认，尚未完成",
  not_required_for_gate_a_flow: "Gate A 流程不要求人工确认",
  accepted: "学习者已接受",
  skipped: "学习者已跳过",
  saved: "已保存",
  gate_a_unreviewed: "Gate A 未经教研复核",
  declined: "学习者已谢绝",
  used: "学习者选择使用",
  not_needed: "学习者表示不需要",
  unavailable: "当前不可用",
  single_task_correct: "本次单题匹配",
  single_task_needs_review: "本次单题需复核",
  task_completed_no_score: "任务完成，不产生分数",
};

function labelFor(value: string | null | undefined) {
  if (!value) return "暂无记录";
  return statusLabels[value] || value.replaceAll("_", " ");
}

function formatTime(value: string | null | undefined) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间格式未识别";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5.5 5.6v5.5c0 4.2 2.6 7.9 6.5 9.9 3.9-2 6.5-5.7 6.5-9.9V5.6L12 3Z" />
      <path d="m9.2 12 1.7 1.7 3.9-4" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l3 3V20.5H7z" />
      <path d="M14 3.5v3h3M9.5 11h5M9.5 14.5h5" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4l10.7-10.7a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.8 8.2 3 3" />
    </svg>
  );
}

function EscalationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11M8 8l4-4 4 4" />
      <path d="M5 14v5h14v-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function BoundaryCard({ label, value, detail, tone = "neutral" }: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <article className={`${styles.boundaryCard} ${tone === "warning" ? styles.boundaryWarning : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function EvidenceField({ term, value }: { term: string; value: string }) {
  return (
    <div className={styles.evidenceField}>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EvidencePanel({ title, eyebrow, icon, children }: {
  title: string;
  eyebrow: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.evidencePanel}>
      <div className={styles.panelHeading}>
        <span className={styles.panelIcon}>{icon}</span>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyEvidence({ state }: { state: Exclude<LoadState, TeachingReviewEvidenceSnapshot> }) {
  if (state.status === "loading") {
    return <div className={styles.stateCard} role="status">正在从当前浏览器读取本机证据摘要……</div>;
  }
  if (state.status === "empty") {
    return (
      <div className={styles.stateCard} role="status">
        <h2>当前浏览器还没有学习证据。</h2>
        <p>请先在同一浏览器完成诊断与学习流程。此演示台不会从账户、服务器或其他设备拉取数据。</p>
        <Link href="/diagnostic">前往诊断任务 <ArrowIcon /></Link>
      </div>
    );
  }
  if (state.status === "no_active_cycle") {
    return (
      <div className={styles.stateCard} role="status">
        <h2>尚未建立当前学习 cycle。</h2>
        <p>本机数据可读取，但没有活动闭环；最后更新时间为 {formatTime(state.sourceUpdatedAt)}。</p>
        <Link href="/workspace">返回学习工作台 <ArrowIcon /></Link>
      </div>
    );
  }
  if (state.status === "no_provisional_cycle") {
    return (
      <div className={styles.stateCard} role="status">
        <h2>当前没有等待人工复核的临时 cycle。</h2>
        <p>本页只接收状态为 provisional_pending_human_review 且完整回链的本机证据；不会把已完成或进行中的普通 cycle 包装成人工复核案例。</p>
        <Link href="/workspace">返回学习工作台 <ArrowIcon /></Link>
      </div>
    );
  }
  return (
    <div className={`${styles.stateCard} ${styles.stateError}`} role="alert">
      <h2>本机证据未通过只读账本与回链核验。</h2>
      <p>为避免把坏哈希、跨 cycle、未知结构或未绑定事件当作可信证据，本页拒绝展示与草拟。错误代码：<code>{state.reason}</code></p>
      <Link href="/my-data">前往“我的本机数据”检查或导出 <ArrowIcon /></Link>
    </div>
  );
}

function EvidenceWorkspace({ snapshot }: { snapshot: TeachingReviewEvidenceSnapshot }) {
  const diagnostic = snapshot.diagnostic;
  const recommendation = snapshot.recommendation;
  const practice = snapshot.practice;
  const retest = snapshot.retest;
  const planUpdate = snapshot.planUpdate;

  return (
    <div className={styles.evidenceWorkspace}>
      <EvidencePanel title="当前 cycle 与诊断证据" eyebrow="01 · EVIDENCE" icon={<EvidenceIcon />}>
        <dl className={styles.evidenceGrid}>
          <EvidenceField term="Cycle ID" value={snapshot.cycle.cycleId} />
          <EvidenceField term="Cycle 状态" value={labelFor(snapshot.cycle.status)} />
          <EvidenceField term="优先技能" value={skillLabels[diagnostic?.prioritySkill || "Unknown"]} />
          <EvidenceField term="证据充分性" value={labelFor(diagnostic?.evidenceSufficiency)} />
          <EvidenceField term="诊断任务集" value={diagnostic?.taskSetVersion || "未记录"} />
          <EvidenceField term="来源更新时间" value={formatTime(snapshot.sourceUpdatedAt)} />
          <EvidenceField term="当前 cycle 事件" value={`${snapshot.eventLedger.currentCycleEventCount} 条（含 ${snapshot.eventLedger.practiceEventCount} 条练习事件）`} />
          <EvidenceField term="账本完整性" value="v2 结构、绑定、顺序与 SHA-256 哈希链已核验" />
        </dl>
        <div
          className={styles.taskTableWrap}
          role="region"
          aria-label="诊断任务证据摘要表，可横向滚动"
          tabIndex={0}
        >
          <table className={styles.taskTable}>
            <caption>诊断任务证据摘要；不显示原始答案、作文正文或学习者自由文本。</caption>
            <thead>
              <tr>
                <th scope="col">任务</th>
                <th scope="col">技能</th>
                <th scope="col">状态</th>
                <th scope="col">结果边界</th>
                <th scope="col">质量标记</th>
              </tr>
            </thead>
            <tbody>
              {diagnostic?.tasks.length ? diagnostic.tasks.map((task) => (
                <tr key={task.taskId}>
                  <th scope="row"><code>{task.taskId}</code></th>
                  <td>{skillLabels[task.skill]}</td>
                  <td>{labelFor(task.evidenceStatus)}</td>
                  <td>{labelFor(task.resultType)}</td>
                  <td>{task.qualityFlags.length ? task.qualityFlags.join("、") : "无额外标记"}</td>
                </tr>
              )) : (
                <tr><td colSpan={5}>当前 cycle 尚无可显示的诊断任务摘要。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </EvidencePanel>

      <div className={styles.evidenceColumns}>
        <EvidencePanel title="推荐与练习回执" eyebrow="02 · BINDING" icon={<DraftIcon />}>
          <dl className={styles.evidenceGrid}>
            <EvidenceField term="推荐状态" value={labelFor(recommendation?.status)} />
            <EvidenceField term="主任务" value={recommendation?.primaryTitle || "尚未形成推荐"} />
            <EvidenceField term="推荐复核" value={labelFor(recommendation?.reviewStatus)} />
            <EvidenceField term="教师已复核" value={recommendation?.teacherReviewed ? "true" : "false · 未确认"} />
            <EvidenceField term="练习回执" value={practice?.receiptFound ? "已找到本机回执" : "未找到绑定回执"} />
            <EvidenceField term="回执完整性" value={practice?.receiptIntegrityClass || "未记录"} />
          </dl>
          {recommendation?.reason ? <p className={styles.reasonBox}><strong>推荐绑定说明</strong>{recommendation.reason}</p> : null}
          <p className={styles.withheldNote}>学习者打卡正文、问题原文、写作内容和原始答案在本演示台中默认隐藏。</p>
        </EvidencePanel>

        <EvidencePanel title="微复测与人工承接状态" eyebrow="03 · HANDOFF" icon={<EscalationIcon />}>
          <dl className={styles.evidenceGrid}>
            <EvidenceField term="微复测状态" value={labelFor(retest?.status)} />
            <EvidenceField term="微复测结果" value={labelFor(retest?.resultType)} />
            <EvidenceField term="人工确认" value={labelFor(retest?.humanConfirmationStatus)} />
            <EvidenceField term="教研已复核" value={retest?.teacherReviewed ? "true" : "false"} />
            <EvidenceField term="测量已复核" value={retest?.measurementReviewed ? "true" : "false"} />
            <EvidenceField term="增长结论" value={retest?.growthClaimProduced ? "存在（异常）" : "false · 未生成"} />
            <EvidenceField term="计划更新" value={labelFor(planUpdate?.confirmationClass)} />
            <EvidenceField term="真实社区" value={snapshot.peerHelp?.realCommunityUsed ? "true（异常）" : "false · 未使用"} />
          </dl>
          <p className={styles.withheldNote}>即使页面显示“需要人工确认”，本演示台也不能把它改成已完成，不能签发正式复核回执。</p>
        </EvidencePanel>
      </div>
    </div>
  );
}

export function TeachingReviewDemoClient() {
  const canonicalRawRef = useRef<string | null>(null);
  const demoRawRef = useRef<string | null>(null);
  const activeOperationRef = useRef<"refresh" | "save" | "clear" | null>(null);
  const refreshGenerationRef = useRef(0);
  const rationaleRef = useRef<HTMLTextAreaElement | null>(null);
  const escalationRef = useRef<HTMLTextAreaElement | null>(null);
  const [evidence, setEvidence] = useState<LoadState>({ status: "loading" });
  const [storedDraft, setStoredDraft] = useState<TeachingReviewDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<TeachingReviewDraft | null>(null);
  const [sourceSnapshotSha256, setSourceSnapshotSha256] = useState<string | null>(null);
  const [sourceStale, setSourceStale] = useState(false);
  const [demoWriteAvailable, setDemoWriteAvailable] = useState(false);
  const [demoStorageInvalid, setDemoStorageInvalid] = useState(false);
  const [demoStoragePresent, setDemoStoragePresent] = useState(false);
  const [demoStale, setDemoStale] = useState(false);
  const [storageStateUnknown, setStorageStateUnknown] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<"refresh" | "save" | "clear" | null>(null);
  const [focusSkill, setFocusSkill] = useState<TeachingReviewSkill>("Balanced");
  const [rationale, setRationale] = useState("");
  const [category, setCategory] = useState<TeachingReviewEscalationCategory>("evidence_quality");
  const [escalationNote, setEscalationNote] = useState("");
  const [validationError, setValidationError] = useState<"rationale" | "escalation" | null>(null);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    if (activeOperationRef.current) return false;
    const generation = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = generation;
    activeOperationRef.current = "refresh";
    setPendingOperation("refresh");
    try {
      const canonicalRaw = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
      const demoRaw = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
      const nextEvidence = await deriveTeachingReviewEvidence(canonicalRaw);
      const draftInspection = inspectTeachingReviewDraft(demoRaw);
      const nextDraft = draftInspection.status === "ready" ? draftInspection.draft : null;
      const runtimeNavigator = navigator as unknown as { locks?: { request?: unknown } };
      const runtimeCrypto = (globalThis.crypto || {}) as unknown as { subtle?: { digest?: unknown }; randomUUID?: unknown };
      const canWriteDemo = Boolean(
        typeof runtimeNavigator.locks?.request === "function" &&
        typeof runtimeCrypto.subtle?.digest === "function" &&
        typeof runtimeCrypto.randomUUID === "function",
      );
      const nextDigest = nextEvidence.status === "ready" && canonicalRaw && canWriteDemo
        ? await sha256Hex(canonicalRaw)
        : null;
      const canonicalAfterDigest = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
      const demoAfterDigest = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
      if (
        refreshGenerationRef.current !== generation ||
        canonicalAfterDigest !== canonicalRaw ||
        demoAfterDigest !== demoRaw
      ) {
        setSourceStale(canonicalAfterDigest !== canonicalRaw);
        setDemoStale(demoAfterDigest !== demoRaw);
        setFeedback("本机数据在读取期间发生变化；本次快照未采用，请再次重新读取。");
        return false;
      }
      canonicalRawRef.current = canonicalRaw;
      demoRawRef.current = demoRaw;
      setEvidence(nextEvidence);
      setSourceSnapshotSha256(nextDigest);
      setSourceStale(false);
      setDemoWriteAvailable(canWriteDemo);
      setDemoStorageInvalid(draftInspection.status === "invalid");
      setDemoStoragePresent(demoRaw !== null);
      setDemoStale(false);
      setStorageStateUnknown(false);
      setStoredDraft(nextDraft);
      setValidationError(null);
      if (nextEvidence.status === "ready") {
        const matchingDraft =
          nextDraft?.cycleId === nextEvidence.cycle.cycleId &&
          nextDraft.sourceSnapshotSha256 === nextDigest
            ? nextDraft
            : null;
        setSavedDraft(matchingDraft);
        setFocusSkill(matchingDraft?.recommendationDraft.focusSkill || (
          nextEvidence.diagnostic?.prioritySkill !== "Unknown" && nextEvidence.diagnostic?.prioritySkill
            ? nextEvidence.diagnostic.prioritySkill
            : "Balanced"
        ));
        setRationale(matchingDraft?.recommendationDraft.rationale || "");
        setCategory(matchingDraft?.escalationDraft.category || "evidence_quality");
        setEscalationNote(matchingDraft?.escalationDraft.note || "");
      } else {
        setSavedDraft(null);
      }
      return true;
    } catch {
      canonicalRawRef.current = null;
      demoRawRef.current = null;
      setEvidence({ status: "invalid", reason: "browser_local_storage_unavailable" });
      setSourceSnapshotSha256(null);
      setSourceStale(false);
      setDemoWriteAvailable(false);
      setDemoStorageInvalid(false);
      setDemoStoragePresent(false);
      setDemoStale(false);
      setStorageStateUnknown(true);
      setStoredDraft(null);
      setSavedDraft(null);
      setValidationError(null);
      setFeedback("当前浏览器的本机存储状态无法确认；在重新读取成功前不会写入演示草稿。");
      return false;
    } finally {
      if (refreshGenerationRef.current === generation && activeOperationRef.current === "refresh") {
        activeOperationRef.current = null;
        setPendingOperation(null);
      }
    }
  }, []);

  useEffect(() => {
    const initialRead = window.setTimeout(() => void refresh(), 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CANONICAL_LEARNER_STORAGE_KEY) {
        setSourceStale(true);
        setFeedback("学习证据已在另一个标签页变化；请重新读取后再草拟。");
      } else if (event.key === TEACHING_REVIEW_DEMO_STORAGE_KEY) {
        setDemoStale(true);
        setFeedback("本机演示草稿已在另一个标签页变化；当前表单保持原样，请明确重新读取后再操作。");
      }
    };
    const markStaleIfChanged = () => {
      try {
        const canonicalRaw = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        const demoRaw = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
        const canonicalChanged = canonicalRaw !== canonicalRawRef.current;
        const demoChanged = demoRaw !== demoRawRef.current;
        if (canonicalChanged) setSourceStale(true);
        if (demoChanged) setDemoStale(true);
        if (canonicalChanged || demoChanged) {
          setFeedback("本机数据已发生变化；请重新读取后再操作。");
        }
      } catch {
        setSourceStale(true);
        setDemoStale(true);
        setDemoWriteAvailable(false);
        setStorageStateUnknown(true);
        setFeedback("当前无法核对本机存储状态；在重新读取成功前不会继续写入。");
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markStaleIfChanged();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", markStaleIfChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(initialRead);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", markStaleIfChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const snapshot = evidence.status === "ready" ? evidence : null;
  const operationBusy = pendingOperation !== null;
  const savePending = pendingOperation === "save";
  const demoStorageForOtherSnapshot = Boolean(demoStoragePresent && !demoStorageInvalid && !savedDraft);
  const canDraft = Boolean(
    snapshot &&
    sourceSnapshotSha256 &&
    demoWriteAvailable &&
    !demoStorageInvalid &&
    !storageStateUnknown &&
    !demoStorageForOtherSnapshot &&
    !demoStale &&
    !sourceStale &&
    !operationBusy,
  );
  const lastSaved = useMemo(() => storedDraft ? formatTime(storedDraft.savedAt) : "尚未保存", [storedDraft]);

  const restoreDemoRaw = (previousRaw: string | null) => {
    try {
      if (previousRaw === null) window.localStorage.removeItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
      else window.localStorage.setItem(TEACHING_REVIEW_DEMO_STORAGE_KEY, previousRaw);
      return window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY) === previousRaw;
    } catch {
      return false;
    }
  };

  const markStorageStateUnknown = (message: string) => {
    setSourceStale(true);
    setDemoStale(true);
    setDemoWriteAvailable(false);
    setStorageStateUnknown(true);
    setFeedback(message);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !canDraft ||
      !snapshot ||
      !sourceSnapshotSha256 ||
      !navigator.locks?.request ||
      storageStateUnknown ||
      activeOperationRef.current
    ) return;
    if (rationale.trim().length < 12) {
      setValidationError("rationale");
      setFeedback("修订建议理由至少需要 12 个非空白字符。");
      rationaleRef.current?.focus();
      return;
    }
    if (escalationNote.trim().length < 12) {
      setValidationError("escalation");
      setFeedback("交接说明至少需要 12 个非空白字符。");
      escalationRef.current?.focus();
      return;
    }
    setValidationError(null);
    activeOperationRef.current = "save";
    setPendingOperation("save");
    try {
      await navigator.locks.request(`${TEACHING_REVIEW_DEMO_STORAGE_KEY}:write`, { mode: "exclusive" }, async () => {
        const sourceBefore = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        const admittedBeforeWrite = await deriveTeachingReviewEvidence(sourceBefore);
        const sourceAfterAdmission = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        if (
          sourceBefore !== canonicalRawRef.current ||
          sourceAfterAdmission !== sourceBefore ||
          !sourceBefore ||
          await sha256Hex(sourceBefore) !== sourceSnapshotSha256 ||
          admittedBeforeWrite.status !== "ready"
        ) {
          setSourceStale(true);
          setFeedback("学习证据已变化，草稿未保存；请重新读取并复核。");
          return;
        }

        const previousDemoRaw = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
        if (previousDemoRaw !== demoRawRef.current) {
          setDemoStale(true);
          setFeedback("另一标签页已更新本机演示草稿；本次没有覆盖。请重新读取后再保存。");
          return;
        }
        const previousInspection = inspectTeachingReviewDraft(previousDemoRaw);
        if (previousInspection.status === "invalid") {
          setDemoStorageInvalid(true);
          setFeedback("现有演示草稿无法识别，已保持原值且没有覆盖。请先到“我的本机数据”导出或定向清除。");
          return;
        }
        const previousDraft = previousInspection.status === "ready" && previousInspection.draft.cycleId === snapshot.cycle.cycleId
          ? previousInspection.draft
          : null;
        const now = new Date().toISOString();
        const draft = createTeachingReviewDraft({
          snapshot,
          focusSkill,
          rationale,
          category,
          escalationNote,
          sourceSnapshotSha256,
          draftId: previousDraft?.draftId || crypto.randomUUID(),
          revision: previousDraft ? previousDraft.revision + 1 : 1,
          createdAt: previousDraft?.createdAt || now,
          savedAt: now,
        });
        const serialized = serializeTeachingReviewDraft(draft);
        window.localStorage.setItem(TEACHING_REVIEW_DEMO_STORAGE_KEY, serialized);

        const sourceAfter = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        const admittedAfterWrite = await deriveTeachingReviewEvidence(sourceAfter);
        const sourceAfterPostWriteAdmission = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        if (
          sourceAfter !== sourceBefore ||
          sourceAfterPostWriteAdmission !== sourceBefore ||
          admittedAfterWrite.status !== "ready"
        ) {
          setSourceStale(true);
          if (!restoreDemoRaw(previousDemoRaw)) {
            markStorageStateUnknown("保存期间学习证据发生变化，且演示草稿回滚失败；本机草稿状态未知，在重新读取或定向清除前不会继续写入。");
            return;
          }
          setFeedback("保存期间学习证据发生变化，演示草稿已回滚；学习者主账本未被写入。");
          return;
        }

        const persistedDemoRaw = window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
        const verified = persistedDemoRaw === serialized ? parseTeachingReviewDraft(persistedDemoRaw) : null;
        if (
          !verified ||
          verified.draftId !== draft.draftId ||
          verified.revision !== draft.revision ||
          verified.sourceSnapshotSha256 !== draft.sourceSnapshotSha256
        ) {
          if (!restoreDemoRaw(previousDemoRaw)) {
            markStorageStateUnknown("演示草稿写后校验失败，且原值回滚失败；本机草稿状态未知，在重新读取或定向清除前不会继续写入。");
            return;
          }
          setFeedback("演示草稿写后校验失败，原值已恢复；学习者主账本未被修改。");
          return;
        }
        const sourceFinal = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        const admittedFinal = await deriveTeachingReviewEvidence(sourceFinal);
        const sourceAfterFinalAdmission = window.localStorage.getItem(CANONICAL_LEARNER_STORAGE_KEY);
        if (
          sourceFinal !== sourceBefore ||
          sourceAfterFinalAdmission !== sourceBefore ||
          admittedFinal.status !== "ready"
        ) {
          setSourceStale(true);
          if (!restoreDemoRaw(previousDemoRaw)) {
            markStorageStateUnknown("草稿写后终检期间学习证据发生变化，且演示草稿回滚失败；本机草稿状态未知，在重新读取或定向清除前不会继续写入。");
            return;
          }
          setFeedback("草稿写后终检发现学习证据已变化，演示草稿已回滚；学习者主账本未被写入。");
          return;
        }
        setSavedDraft(verified);
        setStoredDraft(verified);
        demoRawRef.current = serialized;
        setDemoStoragePresent(true);
        setDemoStorageInvalid(false);
        setDemoStale(false);
        setStorageStateUnknown(false);
        setFeedback("演示草稿已保存到独立的本机命名空间；学习者主账本未被修改。");
      });
    } catch {
      try {
        if (window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY) !== demoRawRef.current) {
          markStorageStateUnknown("保存操作异常结束，且本机草稿值与操作前不一致；状态未知，在重新读取或定向清除前不会继续写入。");
        } else {
          setFeedback("草稿未保存。请检查字段长度并确认当前浏览器允许本机存储。");
        }
      } catch {
        markStorageStateUnknown("保存操作异常结束，且无法核对本机草稿状态；在重新读取或定向清除前不会继续写入。");
      }
    } finally {
      if (activeOperationRef.current === "save") activeOperationRef.current = null;
      setPendingOperation(null);
    }
  };

  const handleClear = async () => {
    if (!navigator.locks?.request || !demoStoragePresent || demoStale || activeOperationRef.current) return;
    if (!window.confirm("确定仅清除此轮本机教研演示草稿吗？学习者主账本和学习事件不会被删除。")) return;
    activeOperationRef.current = "clear";
    setPendingOperation("clear");
    try {
      await navigator.locks.request(`${TEACHING_REVIEW_DEMO_STORAGE_KEY}:write`, { mode: "exclusive" }, () => {
        if (window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY) !== demoRawRef.current) {
          setDemoStale(true);
          setFeedback("另一标签页已更新本机演示草稿；本次没有清除。请重新读取后再操作。");
          return;
        }
        window.localStorage.removeItem(TEACHING_REVIEW_DEMO_STORAGE_KEY);
        if (window.localStorage.getItem(TEACHING_REVIEW_DEMO_STORAGE_KEY) !== null) {
          markStorageStateUnknown("清除后无法确认演示草稿已移除；本机草稿状态未知，请重新读取或前往“我的本机数据”定向清除。");
          return;
        }
        demoRawRef.current = null;
        setDemoStoragePresent(false);
        setDemoStorageInvalid(false);
        setDemoStale(false);
        setStorageStateUnknown(false);
        setSavedDraft(null);
        setStoredDraft(null);
        setRationale("");
        setCategory("evidence_quality");
        setEscalationNote("");
        setValidationError(null);
        setFeedback("仅本机演示草稿已清除；学习者主账本未被修改。");
      });
    } catch {
      markStorageStateUnknown("清除操作异常结束，无法确认本机演示草稿是否保持原值；请重新读取或前往“我的本机数据”定向清除。");
    } finally {
      if (activeOperationRef.current === "clear") activeOperationRef.current = null;
      setPendingOperation(null);
    }
  };

  const handleRefresh = async () => {
    if (await refresh()) {
      setFeedback("已重新读取当前浏览器中的学习证据与演示草稿；请重新核对后再操作。");
    }
  };

  return (
    <main
      id="main-content"
      className={styles.page}
      data-teaching-review-demo="gate_a_local_only"
      data-evidence-read-mode="read_only"
      data-canonical-ledger-write="false"
      data-identity-verified="false"
      data-qualified-human-confirmation="false"
      data-human-review-receipt-created="false"
      data-cycle-closure-allowed="false"
    >
      <section className={styles.hero} aria-labelledby="review-demo-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>GATE A · LOCAL TEACHING REVIEW DEMO</p>
            <h1 id="review-demo-title">教研复核演示台</h1>
            <p className={styles.lead}>查看当前浏览器里的学习证据摘要，草拟一份修订建议与升级说明。这里演示人工承接流程，不代表真实教师审核已经发生。</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryLink} href="#evidence-review">查看本机证据 <ArrowIcon /></a>
              <Link className={styles.secondaryLink} href="/workspace">返回学习工作台</Link>
            </div>
          </div>
          <aside className={styles.scopeCard} aria-label="演示边界">
            <span className={styles.scopeIcon}><ShieldIcon /></span>
            <p>当前账户只证明“已登录”，不证明教研人员身份、资质、组织归属或个案授权。</p>
            <ul>
              <li>不上传、不跨设备同步</li>
              <li>不修改学习者主账本</li>
              <li>不生成正式人工复核回执</li>
              <li>不关闭临时待复核 cycle</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className={styles.boundarySection} aria-labelledby="boundary-title">
        <div className={styles.sectionHeading}>
          <p>RELEASE BOUNDARY</p>
          <h2 id="boundary-title">先看清“能做什么”和“不能做什么”</h2>
        </div>
        <div className={styles.boundaryGrid}>
          <BoundaryCard label="账户身份" value="未核验教研身份" detail="Clerk 仅提供账户访问控制；当前没有 staff RBAC。" tone="warning" />
          <BoundaryCard label="专业确认" value="false" detail="qualifiedHumanConfirmation 固定为 false。" tone="warning" />
          <BoundaryCard label="学习证据" value="账本已核验 · 只读" detail="同源校验 v2 事件结构、隐私治理、顺序、SHA-256 哈希链与当前 cycle 领域绑定；仍非服务器签名。" />
          <BoundaryCard label="人工回执" value="不生成" detail="草稿合同不包含 humanReviewReceiptId 字段。" tone="warning" />
        </div>
      </section>

      <section id="evidence-review" className={styles.reviewSection} aria-labelledby="evidence-title">
        <div className={styles.sectionHeading}>
          <p>LOCAL EVIDENCE</p>
          <h2 id="evidence-title">本机证据只读视图</h2>
          <span>本机 SHA-256 哈希链与领域绑定核验不等于服务器签名、身份验真或专业测量复核；原始自由文本默认不显示。</span>
        </div>
        {snapshot ? <EvidenceWorkspace snapshot={snapshot} /> : <EmptyEvidence state={evidence as Exclude<LoadState, TeachingReviewEvidenceSnapshot>} />}
      </section>

      <section className={styles.draftSection} aria-labelledby="draft-title">
        <div className={styles.sectionHeading}>
          <p>LOCAL DRAFTS</p>
          <h2 id="draft-title">草拟修订建议与升级说明</h2>
          <span id="teaching-review-draft-boundary">保存只写入 <code>{TEACHING_REVIEW_DEMO_STORAGE_KEY}</code>；不会写入 <code>{CANONICAL_LEARNER_STORAGE_KEY}</code>。</span>
        </div>
        <form className={styles.draftForm} onSubmit={handleSave} aria-describedby="teaching-review-draft-boundary">
          {sourceStale ? (
            <div className={styles.staleNotice} role="alert">学习证据已变化。保存保持禁用，直到你重新读取并核对最新证据。</div>
          ) : null}
          {!demoWriteAvailable && evidence.status !== "loading" ? (
            <div className={styles.staleNotice} role="status">当前浏览器缺少本机锁或摘要能力；证据仍可查看，但演示草稿保持只读。</div>
          ) : null}
          {demoStorageInvalid ? (
            <div className={styles.staleNotice} role="alert">现有演示草稿结构无法识别。本页不会覆盖它；请先到“我的本机数据”导出原始值或仅清除教研演示草稿。</div>
          ) : null}
          {demoStorageForOtherSnapshot ? (
            <div className={styles.staleNotice} role="status">当前浏览器中已有一份属于其他 cycle 或证据快照的演示草稿。本页不会覆盖它；请先导出或明确清除，再为当前证据建立新草稿。</div>
          ) : null}
          <fieldset disabled={!canDraft}>
            <legend>建议草稿</legend>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="teaching-review-focus">建议下一轮重点</label>
                <select id="teaching-review-focus" value={focusSkill} onChange={(event) => setFocusSkill(event.target.value as TeachingReviewSkill)}>
                  {teachingReviewDemoOptions.skills.map((skill) => <option key={skill} value={skill}>{skillLabels[skill]}</option>)}
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="teaching-review-rationale">修订建议理由</label>
                <textarea
                  id="teaching-review-rationale"
                  ref={rationaleRef}
                  value={rationale}
                  onChange={(event) => {
                    setRationale(event.target.value);
                    if (validationError === "rationale") setValidationError(null);
                  }}
                  minLength={12}
                  maxLength={1_200}
                  rows={5}
                  required
                  aria-describedby="teaching-review-rationale-help"
                  aria-invalid={validationError === "rationale"}
                  placeholder="例如：建议先补一条不使用原文的 Listening 证据，再判断是否调整下一轮重点。"
                />
                <small id="teaching-review-rationale-help" className={validationError === "rationale" ? styles.fieldError : undefined}>{validationError === "rationale" ? "请填写至少 12 个非空白字符。" : `${rationale.length} / 1200 · 这是草稿，不会替换学生计划。`}</small>
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!canDraft}>
            <legend>升级草稿</legend>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="teaching-review-category">升级类别</label>
                <select id="teaching-review-category" value={category} onChange={(event) => setCategory(event.target.value as TeachingReviewEscalationCategory)}>
                  {teachingReviewDemoOptions.escalationCategories.map((item) => <option key={item} value={item}>{escalationLabels[item]}</option>)}
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <label htmlFor="teaching-review-escalation">交接说明</label>
                <textarea
                  id="teaching-review-escalation"
                  ref={escalationRef}
                  value={escalationNote}
                  onChange={(event) => {
                    setEscalationNote(event.target.value);
                    if (validationError === "escalation") setValidationError(null);
                  }}
                  minLength={12}
                  maxLength={1_200}
                  rows={5}
                  required
                  aria-describedby="teaching-review-escalation-help"
                  aria-invalid={validationError === "escalation"}
                  placeholder="说明需要哪类具备资质的人员、应复核哪些证据，以及为什么不能由当前自动流程处理。"
                />
                <small id="teaching-review-escalation-help" className={validationError === "escalation" ? styles.fieldError : undefined}>{validationError === "escalation" ? "请填写至少 12 个非空白字符。" : `${escalationNote.length} / 1200 · 不会创建真实队列或通知任何人员；不要填写紧急、安全、健康或身份敏感信息。`}</small>
              </div>
            </div>
          </fieldset>

          <div className={styles.formFooter}>
            <div>
              <strong>本机草稿：{storageStateUnknown ? "状态未知，写入已停止" : savedDraft ? "当前证据已保存" : demoStorageInvalid ? "存在未识别原始值" : demoStorageForOtherSnapshot ? "存在其他证据快照草稿" : "未保存"}</strong>
              <span>最后保存：{lastSaved}</span>
            </div>
            <div className={styles.formActions}>
              <button className={styles.clearButton} type="button" onClick={() => void handleRefresh()} disabled={operationBusy}>重新读取证据</button>
              <button className={styles.clearButton} type="button" onClick={handleClear} disabled={!demoStoragePresent || demoStale || operationBusy}>清除演示草稿</button>
              <button className={styles.saveButton} type="submit" disabled={!canDraft}>{savePending ? "正在核对并保存…" : "保存本机演示草稿"}</button>
            </div>
          </div>
          <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
        </form>
      </section>

      <section className={styles.nextGate} aria-labelledby="next-gate-title">
        <div>
          <p>NEXT RELEASE GATE</p>
          <h2 id="next-gate-title">什么时候才算真实教研承接？</h2>
        </div>
        <ul>
          <li>完成教研人员身份、资质与个案权限的服务端 RBAC。</li>
          <li>批准学生数据上云、留存、删除、审计与跨境边界。</li>
          <li>建立不可伪造的人工复核回执、队列状态与关闭规则。</li>
          <li>通过真实教师、隐私、安全和测量负责人验收。</li>
        </ul>
      </section>
    </main>
  );
}
