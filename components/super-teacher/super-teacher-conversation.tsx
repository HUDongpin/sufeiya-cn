"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import { useSuperTeacherSession } from "@/components/super-teacher/super-teacher-session-provider";
import type { SuperTeacherResponse, TeacherCitation } from "@/lib/super-teacher/contracts";

import styles from "@/app/super-teacher/super-teacher.module.css";

const suggestedQuestions = [
  "为什么先练这个？",
  "解释我的 7 天计划",
  "怎样验证我真的有进步？",
  "Sofia智能老师不能做什么？",
];

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
      <span className={styles.avatarAiBadge}>AI</span>
    </span>
  );
}

function citationExternal(citation: TeacherCitation) {
  return citation.href.startsWith("http://") || citation.href.startsWith("https://");
}

function modeLabel(response: SuperTeacherResponse) {
  switch (response.mode) {
    case "ai_grounded":
      return "AI 选排 · 仅使用服务器批准主张";
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

export function SuperTeacherConversation({
  surface,
  labelledBy,
}: {
  surface: "page" | "dialog";
  labelledBy: string;
}) {
  const {
    safeWriteLockSupported,
    session,
    learnerContext,
    consent,
    input,
    submitting,
    error,
    notice,
    sessionReadIssue,
    setConsent,
    setInput,
    setHandoffOpen,
    submitQuestion,
    clearConversation,
    abortCurrentRequest,
  } = useSuperTeacherSession();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();
  const compact = surface === "dialog";

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    conversationEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [session.turns, submitting]);

  function choosePrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  return (
    <section
      className={`${styles.chatPanel}${compact ? ` ${styles.dialogChatPanel}` : ""}`}
      aria-labelledby={labelledBy}
    >
      {!compact ? (
        <header className={styles.chatHeader}>
          <div>
            <p>GROUNDED EXPLANATION</p>
            <h2 id={labelledBy}>问一个与当前学习有关的问题</h2>
          </div>
          <button
            type="button"
            onClick={() => void clearConversation()}
            disabled={!safeWriteLockSupported || (!sessionReadIssue && !session.turns.length && !session.handoffRequests.length)}
          >
            清除本机对话
          </button>
        </header>
      ) : null}

      <div className={`${styles.suggestions}${compact ? ` ${styles.dialogSuggestions}` : ""}`} aria-label="建议问题">
        {suggestedQuestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => choosePrompt(prompt)}
            disabled={submitting || !safeWriteLockSupported || !learnerContext || Boolean(sessionReadIssue)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div
        className={`${styles.conversation}${compact ? ` ${styles.dialogConversation}` : ""}`}
        aria-live="polite"
        aria-busy={submitting}
      >
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
              <div>
                <span className={styles.messageMeta}>你</span>
                <p>{turn.text}</p>
              </div>
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
                  {turn.response.actions.map((action) =>
                    action.kind === "handoff" ? (
                      <a
                        key={`${action.kind}-${action.href}`}
                        href={compact ? "/super-teacher#human-support" : action.href}
                        onClick={compact ? undefined : () => setHandoffOpen(true)}
                      >
                        {action.label}
                      </a>
                    ) : (
                      <a key={`${action.kind}-${action.href}`} href={action.href}>{action.label}</a>
                    ),
                  )}
                </div>
                <small className={styles.receipt}>request_id: {turn.response.requestId} · DET/RAG 准入：0 / 0</small>
              </div>
            </article>
          ),
        )}

        {submitting ? (
          <article className={`${styles.message} ${styles.assistantMessage}`}>
            <TeacherAvatar />
            <div>
              <span className={styles.messageMeta}>正在核对来源</span>
              <p className={styles.loadingText}>只在当前白名单内组织回答…</p>
            </div>
          </article>
        ) : null}
        <div ref={conversationEndRef} />
      </div>

      <div className={`${styles.composer}${compact ? ` ${styles.dialogComposer}` : ""}`}>
        <label className={styles.consentRow}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.currentTarget.checked)}
            disabled={!safeWriteLockSupported || !learnerContext || Boolean(sessionReadIssue)}
          />
          <span>
            <strong>我同意本次发送</strong>
            <small>模型问答需要已登录账户；我的提问和去标识化学习摘要会发送到本站服务端，只有允许的问题且生产开关已批准启用时才会再发送给模型服务。此勾选只对下一次提交有效；不要粘贴敏感信息，历史对话不发送给模型。</small>
          </span>
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(input);
          }}
        >
          <label htmlFor={inputId} className="sr-only">输入学习问题</label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.currentTarget.value.slice(0, 600))}
            rows={compact ? 2 : 3}
            maxLength={600}
            placeholder="例如：为什么先练这个？"
            disabled={submitting || !safeWriteLockSupported || !learnerContext || Boolean(sessionReadIssue)}
          />
          <div className={styles.composerFooter}>
            <span>{input.length} / 600</span>
            {submitting ? (
              <button type="button" className={styles.stopButton} onClick={abortCurrentRequest}>停止等待</button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !safeWriteLockSupported || !learnerContext || Boolean(sessionReadIssue)}
              >
                核对来源并回答
              </button>
            )}
          </div>
        </form>
        {!learnerContext ? (
          <p className={styles.gateMessage}>
            <Link href="/diagnostic">先完成 18+ 本机确认与六项演示诊断任务 →</Link>
          </p>
        ) : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </div>
    </section>
  );
}
