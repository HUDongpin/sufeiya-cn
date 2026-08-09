"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  SUPER_TEACHER_PROTOCOL,
  superTeacherResponseSchema,
  type LearnerContext,
  type SuperTeacherResponse,
} from "@/lib/super-teacher/contracts";
import {
  emptySession,
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
import { containsSensitiveData } from "@/lib/super-teacher/policy";

const WORKSPACE_KEY = "sufeiya_workspace_v1";

const skillLabels: Record<string, string> = {
  Reading: "Reading 阅读",
  Listening: "Listening 听力",
  Writing: "Writing 写作",
  Speaking: "Speaking 口语",
  Balanced: "综合训练",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readLearnerContext(): LearnerContext | undefined {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return undefined;
    return deriveLearnerContext(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type SuperTeacherSessionValue = {
  ready: boolean;
  safeWriteLockSupported: boolean;
  session: LocalSession;
  learnerContext?: LearnerContext;
  consent: boolean;
  input: string;
  submitting: boolean;
  error: string;
  notice: string;
  sessionReadIssue?: SessionReadIssue;
  handoffOpen: boolean;
  contextSummary: string;
  setConsent: Dispatch<SetStateAction<boolean>>;
  setInput: Dispatch<SetStateAction<string>>;
  setHandoffOpen: Dispatch<SetStateAction<boolean>>;
  submitQuestion: (question: string) => Promise<SuperTeacherResponse | undefined>;
  clearConversation: () => Promise<void>;
  createHandoffRequest: () => Promise<void>;
  copyHandoffRequest: () => Promise<void>;
  abortCurrentRequest: () => void;
  revokeConsent: () => void;
};

const SuperTeacherSessionContext = createContext<SuperTeacherSessionValue | null>(null);

export function SuperTeacherSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [safeWriteLockSupported, setSafeWriteLockSupported] = useState(false);
  const [session, setSession] = useState<LocalSession>(emptySession);
  const [learnerContext, setLearnerContext] = useState<LearnerContext>();
  const [consent, setConsent] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionReadIssue, setSessionReadIssue] = useState<SessionReadIssue>();
  const [handoffOpen, setHandoffOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<LocalSession>(emptySession());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
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
      setLearnerContext(readLearnerContext());
      setReady(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === WORKSPACE_KEY || event.key === null) {
        const nextContext = readLearnerContext();
        setLearnerContext(nextContext);
        setConsent(false);
        setNotice(
          nextContext
            ? "另一标签页中的学习闭环已经变化；当前摘要已更新，本次发送同意已撤销。"
            : "另一标签页中的学习闭环已经变化；当前摘要不再满足同轮校验，发送权限已撤销。",
        );
      }
      if (event.key === SUPER_TEACHER_CHAT_KEY || event.key === null) {
        const stored = readSession(window.localStorage);
        if (!storedSessionMatches(stored, sessionRef.current)) {
          setSessionReadIssue("concurrent_change");
          setConsent(false);
          setNotice("另一标签页中的本机对话已经变化；为避免覆盖，新写入已停止。请刷新核对，或明确清除后重新开始。");
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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
          setConsent(false);
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
    const evidenceCount = learnerContext.completedEvidenceTaskCount ?? learnerContext.completedEvidenceSkills?.length ?? 0;
    return `${skillLabels[learnerContext.prioritySkill]} · ${evidenceCount} / 6 项本机诊断任务证据`;
  }, [learnerContext]);

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
    if (!consent) {
      setError("请先勾选数据发送说明，再使用智能问答。你也可以直接选择“继续但不使用 AI”。");
      return undefined;
    }
    const currentContext = readLearnerContext();
    setLearnerContext(currentContext);
    if (!currentContext?.adultConfirmed) {
      setConsent(false);
      setError("请先到演示性初筛页完成 18+ 本机确认和六项任务；当前不会发送问题或调用模型。");
      return undefined;
    }
    if (!trimmed || trimmed.length > 600 || submitting) return undefined;
    if (containsSensitiveData(trimmed)) {
      setError("这条提问可能包含银行卡号、联系方式、证件号或凭证信息。请先删去敏感内容；本次没有保存、发送或调用模型。");
      return undefined;
    }

    // Consent is scoped to one validated submission attempt, regardless of
    // whether the local write, network request, or provider response succeeds.
    setConsent(false);

    const userTurn: UserTurn = {
      id: uid("user"),
      role: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    if (!(await commitSession((current) => ({
      ...current,
      turns: [...current.turns, userTurn].slice(-MAX_STORED_TURNS),
    })))) return undefined;

    setInput("");
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/super-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          protocolVersion: SUPER_TEACHER_PROTOCOL,
          consent: true,
          question: trimmed,
          learnerContext: currentContext,
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("请先登录账户，再发送这次 Sofia 智能问答；本机学习记录不会因登录自动上传。");
        }
        if (response.status === 503) {
          throw new Error("账户服务暂不可用，智能问答保持关闭；你仍可继续非 AI 学习路径。");
        }
        if (response.status === 429 && isRecord(payload) && typeof payload.retryAfterSeconds === "number") {
          throw new Error(`请求较频繁，请约 ${Math.ceil(payload.retryAfterSeconds / 60)} 分钟后再试。`);
        }
        throw new Error("当前无法生成回答。你仍可继续非 AI 学习路径或请求人工帮助。");
      }
      const validatedPayload = superTeacherResponseSchema.safeParse(payload);
      if (!validatedPayload.success) throw new Error("返回内容未通过页面校验，请改走非 AI 路径。");
      const assistantTurn: AssistantTurn = {
        id: uid("assistant"),
        role: "assistant",
        response: validatedPayload.data,
        createdAt: new Date().toISOString(),
      };
      await commitSession((current) => ({
        ...current,
        turns: [...current.turns, assistantTurn].slice(-MAX_STORED_TURNS),
      }));
      if (validatedPayload.data.handoffRecommended || validatedPayload.data.mode === "handoff") {
        setHandoffOpen(true);
      }
      return validatedPayload.data;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setNotice("已停止等待；提问没有形成新的回答。你可以继续非 AI 学习路径。");
      } else {
        setError(caught instanceof Error ? caught.message : "当前无法生成回答，请稍后再试。");
      }
      return undefined;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSubmitting(false);
    }
  }

  function abortCurrentRequest() {
    abortRef.current?.abort();
  }

  function revokeConsent() {
    setConsent(false);
  }

  async function clearConversation() {
    if (!window.confirm("确定清除这个浏览器中的 Sofia智能老师对话和未发送人工请求吗？学习闭环数据不会被删除；此操作无法撤销。")) return;
    abortCurrentRequest();
    setConsent(false);
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
        setNotice("已清除当前浏览器中的 Sofia智能老师对话和本机人工请求记录。学习工作台数据未受影响。");
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

  return (
    <SuperTeacherSessionContext.Provider
      value={{
        ready,
        safeWriteLockSupported,
        session,
        learnerContext,
        consent,
        input,
        submitting,
        error,
        notice,
        sessionReadIssue,
        handoffOpen,
        contextSummary,
        setConsent,
        setInput,
        setHandoffOpen,
        submitQuestion,
        clearConversation,
        createHandoffRequest,
        copyHandoffRequest,
        abortCurrentRequest,
        revokeConsent,
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
