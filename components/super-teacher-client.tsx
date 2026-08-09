"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import type {
  LearnerContext,
  SuperTeacherResponse,
  TeacherCitation,
} from "@/lib/super-teacher/contracts";

import styles from "@/app/super-teacher/super-teacher.module.css";

const PROTOCOL_VERSION = "sufeiya_super_teacher_v1";
const WORKSPACE_KEY = "sufeiya_workspace_v1";
const CHAT_KEY = "sufeiya_super_teacher_v1";
const MAX_STORED_TURNS = 12;

function TeacherAvatar() {
  return (
    <span className={styles.avatar} aria-hidden="true">
      <Image
        className={styles.avatarImage}
        src="/assets/sufeiya-super-teacher-avatar.webp"
        alt=""
        width={84}
        height={84}
        sizes="(max-width: 660px) 34px, 42px"
      />
    </span>
  );
}

type UserTurn = { id: string; role: "user"; text: string; createdAt: string };
type AssistantTurn = { id: string; role: "assistant"; response: SuperTeacherResponse; createdAt: string };
type StoredTurn = UserTurn | AssistantTurn;

type LocalSession = {
  protocolVersion: typeof PROTOCOL_VERSION;
  turns: StoredTurn[];
  handoffRequests: Array<{
    id: string;
    createdAt: string;
    status: "local_not_sent";
    questionPreview: string;
  }>;
};

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

function skillValue(value: unknown) {
  return typeof value === "string" && ["Reading", "Listening", "Writing", "Speaking", "Balanced"].includes(value)
    ? (value as "Reading" | "Listening" | "Writing" | "Speaking" | "Balanced")
    : undefined;
}

function readLearnerContext(): LearnerContext | undefined {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return undefined;
    const state = JSON.parse(raw) as unknown;
    if (!isRecord(state) || state.schemaVersion !== 1) return undefined;
    const journey = isRecord(state.journey) && state.journey.protocolVersion === "gate_a_local_v1" ? state.journey : undefined;
    if (!journey) return undefined;

    const diagnostic = isRecord(journey.diagnostic) ? journey.diagnostic : undefined;
    if (diagnostic?.adultConfirmed !== true) return undefined;
    const plan = isRecord(state.plan) ? state.plan : undefined;
    const profile = isRecord(state.profile) ? state.profile : undefined;
    const recommendation = isRecord(journey.recommendation) ? journey.recommendation : undefined;
    const activeCycle = isRecord(journey.activeCycle) ? journey.activeCycle : undefined;
    const review = isRecord(journey.review) ? journey.review : undefined;
    const retest = isRecord(journey.retest) ? journey.retest : undefined;
    const planUpdate = isRecord(journey.planUpdate) ? journey.planUpdate : undefined;
    const days = plan && Array.isArray(plan.days) ? plan.days.filter(isRecord) : [];
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const currentDay = days.find((day) => day.date === dateKey) ?? days[0];
    const tasks = currentDay && Array.isArray(currentDay.tasks) ? currentDay.tasks.filter(isRecord) : [];
    const currentTask = tasks.find((task) => task.skill === currentDay?.coreSkill) ?? tasks[0];
    const prioritySkill = skillValue(diagnostic?.prioritySkill);
    const evidenceSufficiency =
      diagnostic?.evidenceSufficiency === "evidence_limited" || diagnostic?.evidenceSufficiency === "evidence_insufficient"
        ? diagnostic.evidenceSufficiency
        : undefined;
    const completedEvidenceSkills = Array.isArray(diagnostic?.completedEvidenceSkills)
      ? diagnostic.completedEvidenceSkills.map(skillValue).filter((skill): skill is Exclude<ReturnType<typeof skillValue>, undefined | "Balanced"> => Boolean(skill && skill !== "Balanced"))
      : undefined;
    const planFocus = skillValue(profile?.focusSkill ?? currentDay?.coreSkill);
    const currentTaskSkill = skillValue(currentTask?.skill);
    const dailyMinutes = Number(profile?.dailyMinutes);
    const recommendationStatus =
      recommendation?.status === "accepted" || recommendation?.status === "skipped" ? recommendation.status : "pending";

    return {
      protocolVersion: "gate_a_local_v1",
      adultConfirmed: true,
      ...(prioritySkill ? { prioritySkill } : {}),
      ...(evidenceSufficiency ? { evidenceSufficiency } : {}),
      ...(completedEvidenceSkills ? { completedEvidenceSkills } : {}),
      ...(plan && planFocus
        ? {
            plan: {
              focusSkill: planFocus,
              ...(Number.isInteger(dailyMinutes) && dailyMinutes >= 10 && dailyMinutes <= 180 ? { dailyMinutes } : {}),
              ...(currentTaskSkill && currentTaskSkill !== "Balanced" ? { currentTaskSkill } : {}),
            },
          }
        : {}),
      ...(recommendation
        ? {
            recommendation: {
              status: recommendationStatus,
            },
          }
        : {}),
      progress: {
        checkInRecorded: typeof activeCycle?.checkInId === "string",
        learnerReviewConfirmed: review?.learnerConfirmed === true,
        retestRecorded: retest?.status === "completed",
        updatedPlanConfirmed: planUpdate?.learnerConfirmed === true,
      },
    };
  } catch {
    return undefined;
  }
}

function emptySession(): LocalSession {
  return { protocolVersion: PROTOCOL_VERSION, turns: [], handoffRequests: [] };
}

function isStoredTurn(value: unknown): value is StoredTurn {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "string") return false;
  if (value.role === "user") return typeof value.text === "string" && value.text.length <= 600;
  if (value.role !== "assistant" || !isRecord(value.response)) return false;
  return responseLooksValid(value.response);
}

function readSession(): LocalSession {
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    if (!raw) return emptySession();
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION || !Array.isArray(value.turns)) return emptySession();
    const turns = value.turns.filter(isStoredTurn).slice(-MAX_STORED_TURNS);
    const handoffRequests = Array.isArray(value.handoffRequests)
      ? value.handoffRequests
          .filter((item): item is LocalSession["handoffRequests"][number] =>
            isRecord(item) &&
            typeof item.id === "string" &&
            typeof item.createdAt === "string" &&
            item.status === "local_not_sent" &&
            typeof item.questionPreview === "string" &&
            item.questionPreview.length <= 300,
          )
          .slice(-3)
      : [];
    return { protocolVersion: PROTOCOL_VERSION, turns, handoffRequests };
  } catch {
    return emptySession();
  }
}

function saveSession(session: LocalSession) {
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify({
      ...session,
      turns: session.turns.slice(-MAX_STORED_TURNS),
      handoffRequests: session.handoffRequests.slice(-3),
    }));
    return true;
  } catch {
    return false;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function citationExternal(citation: TeacherCitation) {
  return citation.href.startsWith("http://") || citation.href.startsWith("https://");
}

function modeLabel(response: SuperTeacherResponse) {
  switch (response.mode) {
    case "ai_grounded":
      return "AI 生成 · 来源编号校验通过";
    case "manual_grounded":
      return response.modelAttempted ? "模型不可用 · 已切换有来源备用回答" : "有来源备用回答";
    case "policy_refusal":
      return "安全边界 · 未调用模型";
    case "handoff":
      return "人工路径 · 未自动发送";
    default:
      return "来源不足 · 未扩写";
  }
}

function responseLooksValid(value: unknown): value is SuperTeacherResponse {
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION) return false;
  const allowedModes = new Set(["ai_grounded", "manual_grounded", "policy_refusal", "insufficient_sources", "handoff"]);
  const claimsValid = Array.isArray(value.claims) && value.claims.length > 0 && value.claims.every((item) =>
    isRecord(item) &&
    typeof item.text === "string" &&
    Array.isArray(item.citations) &&
    item.citations.length > 0 &&
    item.citations.every((citation) =>
      isRecord(citation) &&
      typeof citation.id === "string" &&
      typeof citation.title === "string" &&
      typeof citation.href === "string" &&
      typeof citation.sourceClass === "string",
    ),
  );
  const actionsValid = Array.isArray(value.actions) && value.actions.every((action) =>
    isRecord(action) &&
    typeof action.label === "string" &&
    typeof action.href === "string" &&
    (action.href.startsWith("/") || action.href === "#human-support") &&
    typeof action.kind === "string",
  );
  const resourcesValid = Array.isArray(value.resources) && value.resources.every((resource) =>
    isRecord(resource) &&
    typeof resource.id === "string" &&
    typeof resource.title === "string" &&
    typeof resource.href === "string" &&
    /^https:\/\/www\.bilibili\.com\/video\//.test(resource.href) &&
    typeof resource.duration === "string" &&
    Array.isArray(resource.skills) &&
    resource.skills.every((skill) => typeof skill === "string"),
  );
  return typeof value.requestId === "string" &&
    typeof value.headline === "string" &&
    typeof value.mode === "string" &&
    allowedModes.has(value.mode) &&
    claimsValid &&
    Array.isArray(value.limitations) &&
    value.limitations.every((limit) => typeof limit === "string") &&
    actionsValid &&
    resourcesValid;
}

export function SuperTeacherClient() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<LocalSession>(emptySession);
  const [learnerContext, setLearnerContext] = useState<LearnerContext>();
  const [consent, setConsent] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSession(readSession());
      setLearnerContext(readLearnerContext());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveSession(session);
  }, [ready, session]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.turns, submitting]);

  const contextSummary = useMemo(() => {
    if (!learnerContext) return "尚未完成 18+ Gate A 本机确认";
    if (!learnerContext.prioritySkill) return "已确认 18+ · 尚未读取到本轮优先项";
    const evidenceCount = learnerContext.completedEvidenceSkills?.length ?? 0;
    return `${skillLabels[learnerContext.prioritySkill]} · ${evidenceCount} 项本机练习证据`;
  }, [learnerContext]);

  const lastQuestion = [...session.turns].reverse().find((turn): turn is UserTurn => turn.role === "user")?.text ?? "请描述你需要人工帮助的问题。";

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    setError("");
    setNotice("");
    if (!consent) {
      setError("请先勾选数据发送说明，再使用智能问答。你也可以直接选择“继续但不使用 AI”。");
      return;
    }
    if (!learnerContext?.adultConfirmed) {
      setError("请先到演示性初筛页完成 18+ 本机确认；当前不会发送问题或调用模型。");
      return;
    }
    if (!trimmed || trimmed.length > 600 || submitting) return;

    const userTurn: UserTurn = { id: uid("user"), role: "user", text: trimmed, createdAt: new Date().toISOString() };
    setSession((current) => ({ ...current, turns: [...current.turns, userTurn].slice(-MAX_STORED_TURNS) }));
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
          protocolVersion: PROTOCOL_VERSION,
          consent: true,
          question: trimmed,
          learnerContext,
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        if (response.status === 429 && isRecord(payload) && typeof payload.retryAfterSeconds === "number") {
          throw new Error(`请求较频繁，请约 ${Math.ceil(payload.retryAfterSeconds / 60)} 分钟后再试。`);
        }
        throw new Error("当前无法生成回答。你仍可继续非 AI 学习路径或请求人工帮助。");
      }
      if (!responseLooksValid(payload)) throw new Error("返回内容未通过页面校验，请改走非 AI 路径。 ");
      const assistantTurn: AssistantTurn = {
        id: uid("assistant"),
        role: "assistant",
        response: payload,
        createdAt: new Date().toISOString(),
      };
      setSession((current) => ({ ...current, turns: [...current.turns, assistantTurn].slice(-MAX_STORED_TURNS) }));
      if (payload.handoffRecommended || payload.mode === "handoff") setHandoffOpen(true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setNotice("已停止等待；提问没有形成新的回答。你可以继续非 AI 学习路径。");
      } else {
        setError(caught instanceof Error ? caught.message : "当前无法生成回答，请稍后再试。");
      }
    } finally {
      abortRef.current = null;
      setSubmitting(false);
    }
  }

  function choosePrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  function clearConversation() {
    if (!window.confirm("确定清除这个浏览器中的超级智能老师对话和未发送人工请求吗？学习闭环数据不会被删除；此操作无法撤销。")) return;
    abortRef.current?.abort();
    const next = emptySession();
    setSession(next);
    setError("");
    setNotice("已清除当前浏览器中的超级智能老师对话和本机人工请求记录。学习工作台数据未受影响。");
    setHandoffOpen(false);
    saveSession(next);
  }

  function createHandoffRequest() {
    const handoff = {
      id: uid("handoff"),
      createdAt: new Date().toISOString(),
      status: "local_not_sent" as const,
      questionPreview: lastQuestion.slice(0, 300),
    };
    setSession((current) => ({ ...current, handoffRequests: [...current.handoffRequests, handoff].slice(-3) }));
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
      "[苏肥鸭超级智能老师 Gate A 人工支持请求]",
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
    <main id="main-content" className={styles.page}>
      <section className={styles.hero} aria-labelledby="super-teacher-title">
        <div className={styles.heroInner}>
          <div>
            <Link className={styles.backLink} href="/workspace">← 返回学习工作台</Link>
            <p className={styles.eyebrow}>SUFEIYA SUPER AGENT · GATE A</p>
            <h1 id="super-teacher-title">苏肥鸭超级智能老师</h1>
            <p className={styles.heroLead}>支持受控大模型调用的 AI 学习助手，解释“为什么先练这个”并逐句显示来源；每条回答都会标明是否实际调用模型。它不是苏肥鸭老师本人，也不是 Duolingo 或 DET 官方评分员。</p>
          </div>
          <dl className={styles.heroFacts}>
            <div><dt>回答范围</dt><dd>本机证据、计划、推荐与原创任务</dd></div>
            <div><dt>DET 官方语料</dt><dd>0 条准入 · 审核前不回答规则事实</dd></div>
            <div><dt>使用边界</dt><dd>18+ 本机确认 · 无需 Clerk</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.workspace} aria-label="超级智能老师工作区">
        <aside className={styles.contextPanel}>
          <p className={styles.panelKicker}>CURRENT CONTEXT</p>
          <h2>它只读取最小化学习摘要</h2>
          <p className={styles.contextSummary}>{ready ? contextSummary : "正在读取本机学习摘要…"}</p>
          <ul className={styles.contextList}>
            <li><span>准入</span><p>先在演示性初筛页完成 18+ 本机确认</p></li>
            <li><span>身份</span><p>AI 学习助手，不是真人教师或官方评分员</p></li>
            <li><span>发送</span><p>优先能力、证据数量、计划与推荐摘要</p></li>
            <li><span>不发送</span><p>姓名、写作答案、录音、打卡自由文本</p></li>
            <li><span>不提供</span><p>正式诊断、分数预测、真题机经、考试中协助</p></li>
          </ul>
          <div className={styles.sourceGate}>
            <strong>来源闸门</strong>
            <p>第一方产品/原创任务来源可以支持回答；5 个公开视频仅显示标题和原始链接。DET 官方索引与 631 个预览块仍被阻断。</p>
            <Link href="/resources">查看公开资源目录 →</Link>
          </div>
          <div className={styles.nonAiCard}>
            <span>WITHOUT AI</span>
            <h3>不使用 AI 也能完成闭环</h3>
            <p>智能老师是可选解释层，不会阻断演示初筛、计划、任务、复盘或微复测。</p>
            <a href={learnerContext?.prioritySkill ? "/recommendations" : "/diagnostic"}>{learnerContext ? "继续但不使用 AI" : "先完成 18+ 演示确认"} →</a>
          </div>
        </aside>

        <section className={styles.chatPanel} aria-labelledby="conversation-title">
          <header className={styles.chatHeader}>
            <div><p>GROUNDED EXPLANATION</p><h2 id="conversation-title">问一个与当前学习有关的问题</h2></div>
            <button type="button" onClick={clearConversation} disabled={!session.turns.length && !session.handoffRequests.length}>清除本机对话</button>
          </header>

          <div className={styles.suggestions} aria-label="建议问题">
            {["为什么先练这个？", "解释我的 7 天计划", "怎样验证我真的有进步？", "超级智能老师不能做什么？"].map((prompt) => (
              <button key={prompt} type="button" onClick={() => choosePrompt(prompt)} disabled={!learnerContext}>{prompt}</button>
            ))}
          </div>

          <div className={styles.conversation} aria-live="polite" aria-busy={submitting}>
            {!session.turns.length ? (
              <article className={`${styles.message} ${styles.assistantMessage}`}>
                <TeacherAvatar />
                <div>
                  <span className={styles.messageMeta}>页面说明 · 未调用模型</span>
                  <h3>我先解释依据，再给你可执行的下一步。</h3>
                  <p>第一版最适合回答“为什么先练这个”“为什么推荐这项任务”“怎样验证进步”。涉及 DET 官方规则时，我会等来源审核通过，而不是猜。</p>
                </div>
              </article>
            ) : null}

            {session.turns.map((turn) =>
              turn.role === "user" ? (
                <article className={`${styles.message} ${styles.userMessage}`} key={turn.id}>
                  <div><span className={styles.messageMeta}>你</span><p>{turn.text}</p></div>
                </article>
              ) : (
                <article className={`${styles.message} ${styles.assistantMessage}`} key={turn.id}>
                  <TeacherAvatar />
                  <div className={styles.answerBody}>
                    <span className={styles.messageMeta}>{modeLabel(turn.response)}</span>
                    <h3>{turn.response.headline}</h3>
                    <ol className={styles.claimList}>
                      {turn.response.claims.map((item, claimIndex) => (
                        <li key={`${turn.id}-claim-${claimIndex}`}>
                          <p>{item.text}</p>
                          <div className={styles.citations} aria-label="这句话的来源">
                            {item.citations.map((citation) => (
                              <a
                                key={citation.id}
                                href={citation.href}
                                {...(citationExternal(citation) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                              >
                                来源：{citation.title}{citationExternal(citation) ? " ↗" : ""}
                              </a>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <details className={styles.limits}>
                      <summary>查看限制与不确定性</summary>
                      <ul>{turn.response.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
                    </details>
                    {turn.response.resources.length ? (
                      <div className={styles.resourceCards}>
                        <strong>可选 link-only 入口</strong>
                        {turn.response.resources.map((resource) => (
                          <a key={resource.id} href={resource.href} target="_blank" rel="noopener noreferrer">
                            <span>{resource.skills.join(" · ")} · {resource.duration}</span>
                            <b>{resource.title}</b>
                            <small>只显示目录元数据；未把视频内容用于回答 ↗</small>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.answerActions}>
                      {turn.response.actions.map((action) => (
                        action.kind === "handoff" ? (
                          <a key={`${action.kind}-${action.href}`} href="#human-support" onClick={() => setHandoffOpen(true)}>{action.label}</a>
                        ) : (
                          <a key={`${action.kind}-${action.href}`} href={action.href}>{action.label}</a>
                        )
                      ))}
                    </div>
                    <small className={styles.receipt}>request_id: {turn.response.requestId} · DET/RAG 准入：0 / 0</small>
                  </div>
                </article>
              ),
            )}
            {submitting ? (
              <article className={`${styles.message} ${styles.assistantMessage}`}>
                <TeacherAvatar />
                <div><span className={styles.messageMeta}>正在核对来源</span><p className={styles.loadingText}>只在当前白名单内组织回答…</p></div>
              </article>
            ) : null}
            <div ref={conversationEndRef} />
          </div>

          <div className={styles.composer}>
            <label className={styles.consentRow}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)} disabled={!learnerContext} />
              <span><strong>我同意本次发送</strong><small>我的提问和去标识化学习摘要会发送到本站服务端；只有允许的问题且生产开关已批准启用时，才会再发送给模型服务。不要粘贴敏感信息；历史对话不发送给模型。</small></span>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(input);
              }}
            >
              <label htmlFor="super-teacher-question" className="sr-only">输入学习问题</label>
              <textarea
                id="super-teacher-question"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.currentTarget.value.slice(0, 600))}
                rows={3}
                placeholder="例如：为什么先练这个？"
                disabled={submitting || !learnerContext}
              />
              <div className={styles.composerFooter}>
                <span>{input.length} / 600</span>
                {submitting ? (
                  <button type="button" className={styles.stopButton} onClick={() => abortRef.current?.abort()}>停止等待</button>
                ) : (
                  <button type="submit" disabled={!input.trim() || !learnerContext}>核对来源并回答</button>
                )}
              </div>
            </form>
            {!learnerContext ? <p className={styles.gateMessage}><Link href="/diagnostic">先到演示性初筛页完成 18+ 本机确认 →</Link></p> : null}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          </div>
        </section>
      </section>

      <section id="human-support" className={styles.handoffSection} aria-labelledby="human-support-title">
        <div>
          <p className={styles.panelKicker}>HUMAN SUPPORT</p>
          <h2 id="human-support-title">需要真人判断时，明确转出去。</h2>
          <p>这里不会假装已经建立客服队列。网页只能在本机生成请求；你需要自行复制，并通过已确认的公开个人微信联系苏肥鸭老师。</p>
        </div>
        <div className={styles.handoffCard}>
          <div><span>公开个人微信</span><strong>SofiaTang2020</strong><small>人物 Sofia 的公开个人微信，不是网站账号或智能体名称。</small></div>
          {!handoffOpen ? (
            <button type="button" onClick={createHandoffRequest}>在本机生成人工支持请求</button>
          ) : session.handoffRequests.length ? (
            <>
              <p><strong>状态：</strong>本机已准备，尚未自动发送。页面不承诺响应时间。</p>
              <button type="button" onClick={() => void copyHandoffRequest()}>复制最近一份请求</button>
            </>
          ) : (
            <>
              <p><strong>状态：</strong>尚未生成本机请求，也没有发送给任何人。</p>
              <button type="button" onClick={createHandoffRequest}>先生成本机请求</button>
            </>
          )}
          <Link href="/workspace">退出智能老师并继续学习 →</Link>
        </div>
      </section>
    </main>
  );
}
