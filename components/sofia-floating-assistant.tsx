"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { SuperTeacherConversation } from "@/components/super-teacher/super-teacher-conversation";
import { useSuperTeacherSession } from "@/components/super-teacher/super-teacher-session-provider";

import styles from "@/components/sofia-floating-assistant.module.css";

export function SofiaFloatingAssistant() {
  const router = useRouter();
  const {
    ready,
    session,
    safeWriteLockSupported,
    sessionReadIssue,
    contextSummary,
    clearConversation,
    abortCurrentRequest,
    revokeConsent,
  } = useSuperTeacherSession();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal !== "function") {
      router.push("/super-teacher");
      return;
    }
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, router]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      right: body.style.right,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.right = "0";
    body.style.left = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.right = previous.right;
      body.style.left = previous.left;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  function openAssistant() {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.showModal !== "function") {
      router.push("/super-teacher");
      return;
    }
    setOpen(true);
  }

  function closeAssistant() {
    abortCurrentRequest();
    revokeConsent();
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else setOpen(false);
  }

  function handleDialogClose() {
    abortCurrentRequest();
    revokeConsent();
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }

  const hasLocalConversation = Boolean(session.turns.length || session.handoffRequests.length || sessionReadIssue);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={styles.launcher}
        aria-label="打开 Sofia智能老师对话"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={openAssistant}
      >
        <Image
          className={styles.launcherImage}
          src="/assets/sufeiya-super-teacher-avatar.webp"
          alt=""
          width={144}
          height={144}
          sizes="72px"
        />
        <span className={styles.launcherAiBadge} aria-hidden="true">AI</span>
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        onCancel={(event) => {
          event.preventDefault();
          closeAssistant();
        }}
        onClose={handleDialogClose}
      >
        <header className={styles.dialogHeader}>
          <div className={styles.identity}>
            <span className={styles.headerAvatar} aria-hidden="true">
              <Image
                src="/assets/sufeiya-super-teacher-avatar.webp"
                alt=""
                width={96}
                height={96}
                sizes="48px"
              />
              <span>AI</span>
            </span>
            <div>
              <p>SOFIA AI TEACHER · GATE A</p>
              <h2 id={titleId} ref={titleRef} tabIndex={-1}>Sofia智能老师</h2>
              <small id={descriptionId}>AI 学习助手，不是 Sofia 真人实时通话</small>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => void clearConversation()}
              disabled={!safeWriteLockSupported || !hasLocalConversation}
            >
              清除
            </button>
            <button type="button" className={styles.closeButton} onClick={closeAssistant} aria-label="关闭 Sofia智能老师对话">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </header>

        <div className={styles.contextStrip}>
          <span>当前最小摘要</span>
          <strong>{ready ? contextSummary : "正在读取本机学习摘要…"}</strong>
        </div>

        <SuperTeacherConversation surface="dialog" labelledBy={titleId} />

        <footer className={styles.dialogFooter}>
          <section className={styles.voicePlaceholder} aria-label="语音功能状态" data-voice-enabled="false">
            <span className={styles.voiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-4a3.5 3.5 0 1 0-7 0v4A3.5 3.5 0 0 0 12 15Zm-6-4a6 6 0 0 0 12 0M12 17v4m-3 0h6" /></svg>
            </span>
            <div>
              <strong>语音功能暂未开放</strong>
              <p>语音功能正在完成授权资料、供应商数据流和删除流程复核，当前不会请求麦克风或发送音频。</p>
            </div>
          </section>
          <Link href="/super-teacher">打开完整页面与人工支持 →</Link>
        </footer>
      </dialog>
    </>
  );
}
