"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import pageStyles from "@/app/super-teacher/super-teacher.module.css";
import floatingStyles from "@/components/sofia-floating-assistant.module.css";

export type SofiaPublicAccessState = "loading" | "signed-out" | "unavailable";

const accessCopy: Record<SofiaPublicAccessState, { eyebrow: string; title: string; body: string }> = {
  loading: {
    eyebrow: "CLERK · VERIFYING SESSION",
    title: "正在核验安全登录。",
    body: "身份状态确认前不会读取这个浏览器中的 Sofia 对话、学习摘要或人工请求。",
  },
  "signed-out": {
    eyebrow: "CLERK · SIGN-IN REQUIRED",
    title: "登录后继续本机学习对话。",
    body: "公开页面只介绍功能。未登录时不会读取或显示这个浏览器中上一位使用者留下的 Sofia 对话、学习摘要或人工请求。",
  },
  unavailable: {
    eyebrow: "CLERK · SAFE CONFIGURATION HOLD",
    title: "账户服务暂不可用。",
    body: "为保护本机学习记录，交互式 Sofia 保持关闭；本页不会读取、迁移或上传已有记录。",
  },
};

export function SofiaPublicPage({ accessState }: { accessState: SofiaPublicAccessState }) {
  const copy = accessCopy[accessState];
  return (
    <main id="main-content" className={pageStyles.page}>
      <section className={pageStyles.hero} aria-labelledby="super-teacher-public-title">
        <div className={pageStyles.heroInner}>
          <div>
            <Link className={pageStyles.backLink} href="/">← 返回公开首页</Link>
            <p className={pageStyles.eyebrow}>SOFIA AI TEACHER · PUBLIC INTRODUCTION</p>
            <h1 id="super-teacher-public-title">Sofia智能老师</h1>
            <p className={pageStyles.heroLead}>解释学习依据、计划与下一步任务的 AI 学习助手。当前获批版本先提供登录后的浏览器内确定性解释；Qwen、学生数据上云、语音与麦克风仍保持关闭。</p>
          </div>
          <dl className={pageStyles.heroFacts}>
            <div><dt>公开页面</dt><dd>只展示介绍，不读取本机记录</dd></div>
            <div><dt>交互入口</dt><dd>Clerk 登录后开放</dd></div>
            <div><dt>当前数据流</dt><dd>浏览器本机处理 · 不发送服务器或模型</dd></div>
          </dl>
        </div>
      </section>

      <section className={pageStyles.accessGate} aria-labelledby="sofia-access-title">
        <div className={pageStyles.accessGateCopy}>
          <p className={pageStyles.panelKicker}>{copy.eyebrow}</p>
          <h2 id="sofia-access-title">{copy.title}</h2>
          <p>{copy.body}</p>
          <div className={pageStyles.accessActions}>
            {accessState === "signed-out" ? <Link href="/sign-in">安全登录并继续</Link> : null}
            <Link href="/about#faq">查看功能与数据边界</Link>
          </div>
        </div>
        <div className={pageStyles.accessCards}>
          <article>
            <span>01</span>
            <h3>身份只是访问门</h3>
            <p>Clerk 登录不会把当前浏览器的学习数据绑定到账户，也不会自动同步到其他设备。</p>
          </article>
          <article>
            <span>02</span>
            <h3>共享设备要主动交接</h3>
            <p>登录后的工作台读取这台设备中的本机记录。共用电脑请先在“我的本机数据”导出或清除，再交给下一位使用者。</p>
          </article>
          <article>
            <span>03</span>
            <h3>模型与语音仍关闭</h3>
            <p>当前不会向 Qwen、语音供应商或远程人工队列发送问题、学习摘要、录音或声音。</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export function SofiaPublicFloatingAssistant({ accessState }: { accessState: SofiaPublicAccessState }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const copy = accessCopy[accessState];

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal !== "function") {
      router.push(accessState === "signed-out" ? "/sign-in" : "/super-teacher");
      return;
    }
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }, [accessState, open, router]);

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

  function closeAssistant() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else setOpen(false);
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={floatingStyles.launcher}
        aria-label="打开 Sofia智能老师公开介绍"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen(true)}
      >
        <Image className={floatingStyles.launcherImage} src="/assets/sufeiya-super-teacher-avatar.webp" alt="" width={144} height={144} sizes="72px" />
        <span className={floatingStyles.launcherAiBadge} aria-hidden="true">AI</span>
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={`${floatingStyles.dialog} ${floatingStyles.publicDialog}`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        onCancel={(event) => {
          event.preventDefault();
          closeAssistant();
        }}
        onClose={() => {
          setOpen(false);
          window.requestAnimationFrame(() => launcherRef.current?.focus());
        }}
      >
        <header className={floatingStyles.dialogHeader}>
          <div className={floatingStyles.identity}>
            <span className={floatingStyles.headerAvatar} aria-hidden="true">
              <Image src="/assets/sufeiya-super-teacher-avatar.webp" alt="" width={96} height={96} sizes="48px" />
              <span>AI</span>
            </span>
            <div>
              <p>SOFIA AI TEACHER</p>
              <h2 id={titleId} ref={titleRef} tabIndex={-1}>Sofia智能老师</h2>
              <small id={descriptionId}>公开介绍 · 当前未读取本机学习记录</small>
            </div>
          </div>
          <div className={floatingStyles.headerActions}>
            <button type="button" className={floatingStyles.closeButton} onClick={closeAssistant} aria-label="关闭 Sofia智能老师介绍">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </header>

        <div className={floatingStyles.contextStrip}>
          <span>隐私状态</span>
          <strong>未读取本机学习摘要或历史对话</strong>
        </div>

        <div className={floatingStyles.publicDialogBody}>
          <p className={floatingStyles.publicDialogEyebrow}>{copy.eyebrow}</p>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
          <ul>
            <li>登录后才挂载 Sofia 本机会话。</li>
            <li>当前回答在浏览器本机生成，不发送服务器或外部模型。</li>
            <li>语音与麦克风仍处于发布闸门关闭状态。</li>
          </ul>
        </div>

        <footer className={floatingStyles.dialogFooter}>
          <section className={floatingStyles.voicePlaceholder} aria-label="语音功能状态" data-voice-enabled="false">
            <span className={floatingStyles.voiceIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-4a3.5 3.5 0 1 0-7 0v4A3.5 3.5 0 0 0 12 15Zm-6-4a6 6 0 0 0 12 0M12 17v4m-3 0h6" /></svg>
            </span>
            <div><strong>语音功能暂未开放</strong><p>当前不会请求麦克风或发送音频。</p></div>
          </section>
          {accessState === "signed-out" ? <Link href="/sign-in">安全登录并继续 →</Link> : <Link href="/super-teacher">打开完整公开介绍 →</Link>}
        </footer>
      </dialog>
    </>
  );
}
