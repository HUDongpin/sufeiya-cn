"use client";

import Link from "next/link";

import { SuperTeacherConversation } from "@/components/super-teacher/super-teacher-conversation";
import { useSuperTeacherSession } from "@/components/super-teacher/super-teacher-session-provider";

import styles from "@/app/super-teacher/super-teacher.module.css";

export function SuperTeacherClient() {
  const {
    ready,
    safeWriteLockSupported,
    session,
    learnerContext,
    sessionReadIssue,
    handoffOpen,
    contextSummary,
    createHandoffRequest,
    copyHandoffRequest,
  } = useSuperTeacherSession();

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero} aria-labelledby="super-teacher-title">
        <div className={styles.heroInner}>
          <div>
            <Link className={styles.backLink} href="/workspace">← 返回学习工作台</Link>
            <p className={styles.eyebrow}>SOFIA AI TEACHER · GATE A</p>
            <h1 id="super-teacher-title">Sofia智能老师</h1>
            <p className={styles.heroLead}>支持受控大模型调用的 AI 学习助手，解释“为什么先练这个”并逐句显示来源；每条回答都会标明是否实际调用模型。它不是 Sofia 真人实时通话，也不是 Duolingo 或 DET 官方评分员。</p>
          </div>
          <dl className={styles.heroFacts}>
            <div><dt>回答范围</dt><dd>本机证据、计划、推荐与原创任务</dd></div>
            <div><dt>DET 官方语料</dt><dd>0 条准入 · 审核前不回答规则事实</dd></div>
            <div><dt>使用边界</dt><dd>18+ 本机确认 · 学习数据不自动绑定账户</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.workspace} aria-label="Sofia智能老师工作区">
        <aside className={styles.contextPanel}>
          <p className={styles.panelKicker}>CURRENT CONTEXT</p>
          <h2>它只读取最小化学习摘要</h2>
          <p className={styles.contextSummary}>{ready ? contextSummary : "正在读取本机学习摘要…"}</p>
          <ul className={styles.contextList}>
            <li><span>准入</span><p>先在演示性初筛页完成 18+ 本机确认与六项任务</p></li>
            <li><span>身份</span><p>AI 学习助手，不是 Sofia 真人实时通话或官方评分员</p></li>
            <li><span>发送</span><p>优先能力、证据数量、计划与推荐摘要</p></li>
            <li><span>不发送</span><p>姓名、写作答案、录音、打卡自由文本</p></li>
            <li><span>安全写入</span><p>{safeWriteLockSupported ? "浏览器写入锁可用，防止跨标签页覆盖" : "浏览器写入锁不可用，智能问答保持只读"}</p></li>
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
            <p>Sofia智能老师是可选解释层，不会阻断演示初筛、计划、任务、复盘或微复测。</p>
            <a href={learnerContext?.prioritySkill ? "/recommendations" : "/diagnostic"}>{learnerContext ? "继续但不使用 AI" : "先完成 18+ 演示确认"} →</a>
          </div>
        </aside>

        <SuperTeacherConversation surface="page" labelledBy="conversation-title" />
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
            <button type="button" onClick={() => void createHandoffRequest()} disabled={!safeWriteLockSupported || Boolean(sessionReadIssue)}>在本机生成人工支持请求</button>
          ) : session.handoffRequests.length ? (
            <>
              <p><strong>状态：</strong>本机已准备，尚未自动发送。页面不承诺响应时间。</p>
              <button type="button" onClick={() => void copyHandoffRequest()}>复制最近一份请求</button>
            </>
          ) : (
            <>
              <p><strong>状态：</strong>尚未生成本机请求，也没有发送给任何人。</p>
              <button type="button" onClick={() => void createHandoffRequest()} disabled={!safeWriteLockSupported || Boolean(sessionReadIssue)}>先生成本机请求</button>
            </>
          )}
          <Link href="/workspace">退出 Sofia智能老师并继续学习 →</Link>
        </div>
      </section>
    </main>
  );
}
