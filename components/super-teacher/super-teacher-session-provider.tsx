"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  superTeacherResponseSchema,
  type LearnerContext,
  type SuperTeacherResponse,
} from "@/lib/super-teacher/contracts";
import { createLocalTeacherResponse } from "@/lib/super-teacher/deterministic-responder";
import {
  emptySession,
  commitProvisionalHandoffPacket,
  MAX_STORED_TURNS,
  readSession,
  saveSession,
  storedSessionMatches,
  SUPER_TEACHER_CHAT_KEY,
  type AssistantTurn,
  type LocalSession,
  type SessionReadIssue,
  type UserTurn,
} from "@/lib/super-teacher/client-session";
import { deriveLearnerContext } from "@/lib/super-teacher/local-context";
import { buildLocalGroundingBundle } from "@/lib/super-teacher/local-grounding";
import { classifyTeacherQuestion, containsSensitiveData } from "@/lib/super-teacher/policy";
import {
  buildProvisionalHandoffCopyText,
  deriveProvisionalHandoffEvidence,
  findMatchingProvisionalHandoffPacket,
  packetMatchesProvisionalEvidence,
  sha256Hex,
  type ProvisionalHandoffBinding,
  type ProvisionalHandoffPacket,
} from "@/lib/super-teacher/provisional-handoff";

const WORKSPACE_KEY = "sufeiya_workspace_v1";

const skillLabels: Record<string, string> = {
  Reading: "Reading 阅读",
  Listening: "Listening 听力",
  Writing: "Writing 写作",
  Speaking: "Speaking 口语",
  Balanced: "综合训练",
};

async function readLearnerContext(): Promise<LearnerContext | undefined> {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return undefined;
    const context = await deriveLearnerContext(JSON.parse(raw) as unknown);
    return window.localStorage.getItem(WORKSPACE_KEY) === raw ? context : undefined;
  } catch {
    return undefined;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ProvisionalHandoffState =
  | { status: "loading" }
  | { status: "absent"; reason: "workspace_missing" | "no_active_cycle" | "no_provisional_cycle" }
  | { status: "invalid"; reason: string }
  | ({
    status: "valid";
    freshness: "fresh" | "stale";
    stepCount: 7;
    cycleStatus: "provisional_pending_human_review";
    sourceSnapshotSha256: string;
  } & ProvisionalHandoffBinding);

type SuperTeacherSessionValue = {
  ready: boolean;
  safeWriteLockSupported: boolean;
  session: LocalSession;
  learnerContext?: LearnerContext;
  input: string;
  submitting: boolean;
  error: string;
  notice: string;
  sessionReadIssue?: SessionReadIssue;
  handoffOpen: boolean;
  contextSummary: string;
  provisionalHandoff: ProvisionalHandoffState;
  latestProvisionalHandoffPacket?: ProvisionalHandoffPacket;
  setInput: Dispatch<SetStateAction<string>>;
  setHandoffOpen: Dispatch<SetStateAction<boolean>>;
  submitQuestion: (question: string) => Promise<SuperTeacherResponse | undefined>;
  clearConversation: () => Promise<void>;
  createHandoffRequest: () => Promise<void>;
  copyHandoffRequest: () => Promise<void>;
  refreshProvisionalHandoff: () => Promise<void>;
  createProvisionalHandoffPacket: () => Promise<void>;
  copyProvisionalHandoffPacket: () => Promise<void>;
};

const SuperTeacherSessionContext = createContext<SuperTeacherSessionValue | null>(null);

export function SuperTeacherSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [safeWriteLockSupported, setSafeWriteLockSupported] = useState(false);
  const [session, setSession] = useState<LocalSession>(emptySession);
  const [learnerContext, setLearnerContext] = useState<LearnerContext>();
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionReadIssue, setSessionReadIssue] = useState<SessionReadIssue>();
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [provisionalHandoff, setProvisionalHandoff] = useState<ProvisionalHandoffState>({ status: "loading" });
  const sessionRef = useRef<LocalSession>(emptySession());

  const refreshProvisionalHandoff = useCallback(async () => {
    try {
      const workspaceRaw = window.localStorage.getItem(WORKSPACE_KEY);
      const projection = await deriveProvisionalHandoffEvidence(workspaceRaw);
      if (projection.status === "empty") {
        setProvisionalHandoff({ status: "absent", reason: "workspace_missing" });
        return;
      }
      if (projection.status === "no_active_cycle" || projection.status === "no_provisional_cycle") {
        setProvisionalHandoff({ status: "absent", reason: projection.status });
        return;
      }
      if (projection.status === "invalid" || !workspaceRaw) {
        setProvisionalHandoff({
          status: "invalid",
          reason: projection.status === "invalid" ? projection.reason : "workspace_missing_after_projection",
        });
        return;
      }
      const sourceSnapshotSha256 = await sha256Hex(workspaceRaw);
      if (window.localStorage.getItem(WORKSPACE_KEY) !== workspaceRaw) {
        setProvisionalHandoff({ status: "invalid", reason: "workspace_changed_during_read" });
        return;
      }
      const matching = findMatchingProvisionalHandoffPacket(
        sessionRef.current.provisionalHandoffPackets,
        projection.evidence,
        sourceSnapshotSha256,
      );
      const hasStoredPacket = sessionRef.current.provisionalHandoffPackets.length > 0;
      setProvisionalHandoff({
        status: "valid",
        freshness: matching || !hasStoredPacket ? "fresh" : "stale",
        stepCount: 7,
        cycleStatus: "provisional_pending_human_review",
        sourceSnapshotSha256,
        sourceUpdatedAt: projection.evidence.sourceUpdatedAt,
        peerHelpStatus: projection.evidence.peerHelpStatus,
        prioritySkill: projection.evidence.prioritySkill,
        retestEvidenceStatus: projection.evidence.retestEvidenceStatus,
        humanConfirmationStatus: projection.evidence.humanConfirmationStatus,
      });
    } catch {
      setProvisionalHandoff({ status: "invalid", reason: "browser_local_storage_unavailable" });
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void (async () => {
      const stored = readSession(window.localStorage);
      const supportsSafeWriteLock = Boolean(navigator.locks?.request);
      setSafeWriteLockSupported(supportsSafeWriteLock);
      sessionRef.current = stored.session;
      setSession(stored.session);
      if (stored.status === "unsupported_version" || stored.status === "corrupt") {
        setSessionReadIssue(stored.status);
        setNotice(
          stored.status === "unsupported_version"
            ? "发现较新版本的本机对话。为避免覆盖，当前对话保持只读；你可明确清除后重新开始。"
            : "发现无法识别的本机对话。为避免覆盖，原始记录保持不变；你可明确清除后重新开始。",
        );
      } else if (!supportsSafeWriteLock) {
        setNotice("当前浏览器不支持安全本机写入锁；智能问答和本机人工请求保持只读。请升级到支持 Web Locks 的现代浏览器。");
      }
      setLearnerContext(await readLearnerContext());
      await refreshProvisionalHandoff();
      setReady(true);
    })());
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [refreshProvisionalHandoff]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => void (async () => {
      if (event.key === WORKSPACE_KEY || event.key === null) {
        const nextContext = await readLearnerContext();
        setLearnerContext(nextContext);
        void refreshProvisionalHandoff();
        setNotice(
          nextContext
            ? "另一标签页中的学习闭环已经变化；当前本机摘要已更新。"
            : "另一标签页中的学习闭环已经变化；当前摘要不再满足同轮校验。",
        );
      }
      if (event.key === SUPER_TEACHER_CHAT_KEY || event.key === null) {
        const stored = readSession(window.localStorage);
        if (!storedSessionMatches(stored, sessionRef.current)) {
          setSessionReadIssue("concurrent_change");
          setProvisionalHandoff({ status: "invalid", reason: "super_teacher_concurrent_change" });
          setNotice("另一标签页中的本机对话已经变化；为避免覆盖，新写入已停止。请刷新核对，或明确清除后重新开始。");
        }
      }
    })();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshProvisionalHandoff]);

  async function commitSession(update: (current: LocalSession) => LocalSession) {
    if (!navigator.locks?.request) {
      setError("当前浏览器无法取得安全写入锁；未修改本机对话。请使用最新版浏览器后重试。");
      return false;
    }
    try {
      return await navigator.locks.request(`${SUPER_TEACHER_CHAT_KEY}:write`, { mode: "exclusive" }, () => {
        const stored = readSession(window.localStorage);
        if (!storedSessionMatches(stored, sessionRef.current)) {
          setSessionReadIssue("concurrent_change");
          setNotice("本机对话已在另一个页面发生变化；当前页面已切换为只读，未覆盖原记录。");
          return false;
        }
        const next = { ...update(sessionRef.current), revision: sessionRef.current.revision + 1 };
        if (!saveSession(window.localStorage, next)) {
          setError("当前浏览器无法保存对话；界面与本机记录均未推进，学习工作台数据未受影响。");
          return false;
        }
        sessionRef.current = next;
        setSession(next);
        return true;
      });
    } catch {
      setError("当前浏览器无法安全写入对话；未修改本机记录。");
      return false;
    }
  }

  const contextSummary = useMemo(() => {
    if (!learnerContext) return "尚未完成 18+ 本机确认与六项演示诊断任务";
    if (!learnerContext.prioritySkill) return "已确认 18+ · 尚未读取到本轮优先项";
    if (learnerContext.plan?.stage === "provisional_updated") {
      return `${skillLabels[learnerContext.prioritySkill]} · 7 / 7 步已记录 · 待具备资质人员确认`;
    }
    const evidenceCount = learnerContext.completedEvidenceTaskCount ?? learnerContext.completedEvidenceSkills?.length ?? 0;
    return `${skillLabels[learnerContext.prioritySkill]} · ${evidenceCount} / 6 项本机诊断任务证据`;
  }, [learnerContext]);

  const latestProvisionalHandoffPacket = provisionalHandoff.status === "valid"
    ? findMatchingProvisionalHandoffPacket(
      session.provisionalHandoffPackets,
      provisionalHandoff,
      provisionalHandoff.sourceSnapshotSha256,
    ) ?? session.provisionalHandoffPackets.at(-1)
    : undefined;

  const lastQuestion = [...session.turns].reverse().find((turn): turn is UserTurn => turn.role === "user")?.text ?? "请描述你需要人工帮助的问题。";

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    setError("");
    setNotice("");
    if (sessionReadIssue) {
      setError("现有本机对话无法安全写入。请先使用“清除本机对话”明确重建，原记录不会被页面自动覆盖。");
      return undefined;
    }
    if (!safeWriteLockSupported) {
      setError("当前浏览器不支持安全本机写入锁；本次没有保存、发送或调用模型。");
      return undefined;
    }
    const currentContext = await readLearnerContext();
    setLearnerContext(currentContext);
    if (!currentContext?.adultConfirmed) {
      setError("请先到演示性初筛页完成 18+ 本机确认和六项任务；当前不会保存问题、发送数据或调用模型。");
      return undefined;
    }
    if (!trimmed || trimmed.length > 600 || submitting) return undefined;
    if (containsSensitiveData(trimmed)) {
      setError("这条提问可能包含银行卡号、联系方式、证件号或凭证信息。请先删去敏感内容；本次没有保存、发送或调用模型。");
      return undefined;
    }

    setSubmitting(true);
    try {
      const decision = classifyTeacherQuestion(trimmed);
      const bundle = buildLocalGroundingBundle(decision.intent, currentContext);
      const response = createLocalTeacherResponse({
        decision,
        bundle,
        learnerContext: currentContext,
        requestId: window.crypto.randomUUID(),
      });
      const validatedPayload = superTeacherResponseSchema.safeParse(response);
      if (!validatedPayload.success) throw new Error("返回内容未通过页面校验，请改走非 AI 路径。");
      const createdAt = new Date().toISOString();
      const userTurn: UserTurn = {
        id: uid("user"),
        role: "user",
        text: trimmed,
        createdAt,
      };
      const assistantTurn: AssistantTurn = {
        id: uid("assistant"),
        role: "assistant",
        response: validatedPayload.data,
        createdAt,
      };
      const committed = await commitSession((current) => ({
        ...current,
        turns: [...current.turns, userTurn, assistantTurn].slice(-MAX_STORED_TURNS),
      }));
      if (!committed) return undefined;
      setInput("");
      setNotice("已在当前浏览器内核对冻结来源并生成回答；问题和学习摘要没有发送到本站服务端或外部模型。");
      if (validatedPayload.data.handoffRecommended || validatedPayload.data.mode === "handoff") {
        setHandoffOpen(true);
      }
      return validatedPayload.data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "当前无法在本机生成回答，请稍后再试。");
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }

  async function clearConversation() {
    if (!window.confirm("确定清除这个浏览器中的 Sofia智能老师对话、未发送人工请求和本机严格承接包吗？学习闭环数据不会被删除；此操作无法撤销。")) return;
    if (!navigator.locks?.request) {
      setError("当前浏览器无法取得安全写入锁；原对话未被清除。请使用最新版浏览器后重试。");
      return;
    }
    try {
      await navigator.locks.request(`${SUPER_TEACHER_CHAT_KEY}:write`, { mode: "exclusive" }, () => {
        const stored = readSession(window.localStorage);
        const nextRevision = stored.status === "valid"
          ? stored.session.revision + 1
          : Math.max(sessionRef.current.revision + 1, Date.now());
        const next = { ...emptySession(), revision: nextRevision };
        if (!saveSession(window.localStorage, next)) {
          setError("当前浏览器无法保存清除后的对话状态；原记录保持不变。");
          return;
        }
        sessionRef.current = next;
        setSession(next);
        setError("");
        setNotice("已清除当前浏览器中的 Sofia智能老师对话、本机人工请求和严格承接包。学习工作台数据未受影响。");
        setHandoffOpen(false);
        setSessionReadIssue(undefined);
      });
    } catch {
      setError("当前浏览器无法安全清除对话；原记录保持不变。");
    }
  }

  async function createHandoffRequest() {
    if (sessionReadIssue) {
      setError("现有本机对话处于只读保护状态；请先明确清除后再生成人工支持请求。");
      return;
    }
    const handoff = {
      id: uid("handoff"),
      createdAt: new Date().toISOString(),
      status: "local_not_sent" as const,
      questionPreview: lastQuestion.slice(0, 300),
    };
    if (!(await commitSession((current) => ({
      ...current,
      handoffRequests: [...current.handoffRequests, handoff].slice(-3),
    })))) return;
    setHandoffOpen(true);
    setNotice(`已在本机生成请求 ${handoff.id}；尚未发送给任何人。`);
  }

  async function copyHandoffRequest() {
    const latest = session.handoffRequests.at(-1);
    if (!latest) {
      setError("请先生成一份本机人工支持请求；页面不会自动发送任何内容。");
      return;
    }
    const text = [
      "[Sofia智能老师 Gate A 人工支持请求]",
      `请求编号：${latest.id}`,
      `当前学习摘要：${contextSummary}`,
      `问题：${latest.questionPreview}`,
      "说明：该请求由网页在本机生成，未自动发送；请在发送前删除不必要的个人信息。",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice("人工支持请求已复制。请自行添加公开个人微信 SofiaTang2020，并在发送前再次检查个人信息。");
    } catch {
      setError("浏览器未允许复制。请手动整理问题；页面没有自动发送任何内容。");
    }
  }

  async function createProvisionalHandoffPacket() {
    setError("");
    if (sessionReadIssue) {
      setError("现有 Sofia 本机记录处于只读保护状态；未生成承接包，也没有修改学习工作台。");
      return;
    }
    if (!navigator.locks?.request) {
      setError("当前浏览器无法取得安全写入锁；未生成承接包，也没有发送数据。");
      return;
    }
    try {
      await navigator.locks.request(`${SUPER_TEACHER_CHAT_KEY}:write`, { mode: "exclusive" }, async () => {
        const result = await commitProvisionalHandoffPacket({
          storage: window.localStorage,
          expectedSession: sessionRef.current,
        });
        if (result.status === "created" || result.status === "existing") {
          sessionRef.current = result.session;
          setSession(result.session);
          setNotice(result.status === "existing"
            ? "当前快照已有同一最小化承接包；保持原生成时间，未重复生成。"
            : "已在 Sofia 本机命名空间生成最小化承接包；尚未发送，也未建立真人队列。");
          await refreshProvisionalHandoff();
          return;
        }
        if (result.status === "super_teacher_concurrent_change") {
          setSessionReadIssue("concurrent_change");
          setError("Sofia 本机记录已在另一页面变化；本次没有覆盖，也没有生成新包。");
        } else if (result.status === "workspace_not_ready") {
          setError(`当前临时轮次未通过严格回链检查（${result.reason}）；已失败关闭，未生成承接包。`);
        } else if (result.status === "workspace_changed_during_write") {
          setError("学习工作台在生成期间发生变化；Sofia 写入已恢复到操作前状态，请重新核对。");
        } else if (result.status === "super_teacher_write_verification_failed") {
          setError("承接包写后校验失败；Sofia 本机记录已恢复到操作前状态。");
        } else if (result.status === "super_teacher_rollback_failed") {
          setSessionReadIssue("concurrent_change");
          setError("本机写入状态无法确认且恢复失败；已停止后续操作，请先前往“我的本机数据”保全记录。");
        } else {
          setError("当前浏览器无法安全保存承接包；没有修改学习工作台或教研演示命名空间。");
        }
        await refreshProvisionalHandoff();
      });
    } catch {
      setError("当前浏览器无法完成本机承接包事务；没有发送数据，也没有建立真人队列。");
      await refreshProvisionalHandoff();
    }
  }

  async function copyProvisionalHandoffPacket() {
    setError("");
    const packet = latestProvisionalHandoffPacket;
    if (!packet) {
      setError("请先为当前严格快照生成本机承接包；页面不会自动发送任何内容。");
      return;
    }
    if (!navigator.locks?.request) {
      setError("当前浏览器无法取得 Sofia 本机记录锁；旧包未复制，也没有发送数据。");
      return;
    }
    try {
      await navigator.locks.request(`${SUPER_TEACHER_CHAT_KEY}:write`, { mode: "exclusive" }, async () => {
        const stored = readSession(window.localStorage);
        const storedPacket = stored.status === "valid"
          ? stored.session.provisionalHandoffPackets.find(
            (candidate) => JSON.stringify(candidate) === JSON.stringify(packet),
          )
          : undefined;
        if (
          !storedSessionMatches(stored, sessionRef.current) ||
          !storedPacket ||
          JSON.stringify(storedPacket) !== JSON.stringify(packet)
        ) {
          setSessionReadIssue("concurrent_change");
          setError("Sofia 本机记录已在另一页面清除或替换；已停止复制，请刷新核对。");
          return;
        }
        const workspaceBefore = window.localStorage.getItem(WORKSPACE_KEY);
        const projection = await deriveProvisionalHandoffEvidence(workspaceBefore);
        if (projection.status !== "ready" || !workspaceBefore) {
          setError("当前临时轮次已不再满足严格回链；旧包未复制，请返回工作台核对。");
          await refreshProvisionalHandoff();
          return;
        }
        const digest = await sha256Hex(workspaceBefore);
        const sessionImmediatelyBeforeCopy = readSession(window.localStorage);
        const packetImmediatelyBeforeCopy = sessionImmediatelyBeforeCopy.status === "valid"
          ? sessionImmediatelyBeforeCopy.session.provisionalHandoffPackets.find(
            (candidate) => JSON.stringify(candidate) === JSON.stringify(packet),
          )
          : undefined;
        const workspaceImmediatelyBeforeCopy = window.localStorage.getItem(WORKSPACE_KEY);
        if (
          !storedSessionMatches(sessionImmediatelyBeforeCopy, sessionRef.current) ||
          !packetImmediatelyBeforeCopy ||
          JSON.stringify(packetImmediatelyBeforeCopy) !== JSON.stringify(packet) ||
          workspaceImmediatelyBeforeCopy !== workspaceBefore ||
          !packetMatchesProvisionalEvidence(packet, projection.evidence, digest)
        ) {
          setError("学习快照已变化或承接包不属于当前 cycle；旧包未复制，请按当前快照重新生成。");
          await refreshProvisionalHandoff();
          return;
        }
        await navigator.clipboard.writeText(buildProvisionalHandoffCopyText(packet));
        setNotice("已复制不含原始领域 ID 的最小化白名单承接包。它仍未自动发送；请在发送前再次核对接收方与隐私边界。");
      });
    } catch {
      setError("浏览器未允许安全复制，或本机快照无法复核；页面没有自动发送任何内容。");
    }
  }

  return (
    <SuperTeacherSessionContext.Provider
      value={{
        ready,
        safeWriteLockSupported,
        session,
        learnerContext,
        input,
        submitting,
        error,
        notice,
        sessionReadIssue,
        handoffOpen,
        contextSummary,
        provisionalHandoff,
        latestProvisionalHandoffPacket,
        setInput,
        setHandoffOpen,
        submitQuestion,
        clearConversation,
        createHandoffRequest,
        copyHandoffRequest,
        refreshProvisionalHandoff,
        createProvisionalHandoffPacket,
        copyProvisionalHandoffPacket,
      }}
    >
      {children}
    </SuperTeacherSessionContext.Provider>
  );
}

export function useSuperTeacherSession() {
  const value = useContext(SuperTeacherSessionContext);
  if (!value) throw new Error("useSuperTeacherSession must be used inside SuperTeacherSessionProvider.");
  return value;
}
