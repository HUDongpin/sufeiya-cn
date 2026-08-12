"use client";

import Link from "next/link";

import { SuperTeacherConversation } from "@/components/super-teacher/super-teacher-conversation";
import { useSuperTeacherSession } from "@/components/super-teacher/super-teacher-session-provider";

import styles from "@/app/super-teacher/super-teacher.module.css";

const skillLabels = {
  Reading: "Reading 阅读",
  Listening: "Listening 听力",
  Writing: "Writing 写作",
  Speaking: "Speaking 口语",
} as const;

function compactDigest(value: string | null | undefined) {
  if (!value) return "—";
  return value.length <= 20 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function formatCheckedAt(value: string | null | undefined) {
  if (!value) return "尚未生成";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "无法核对" : date.toLocaleString("zh-CN", { hour12: false });
}

export function SuperTeacherClient() {
  const {
    ready,
    safeWriteLockSupported,
    session,
    learnerContext,
    sessionReadIssue,
    handoffOpen,
    contextSummary,
    provisionalHandoff,
    latestProvisionalHandoffPacket,
    createHandoffRequest,
    createProvisionalHandoffPacket,
    copyHandoffRequest,
    copyProvisionalHandoffPacket,
  } = useSuperTeacherSession();

  const provisionalReady = provisionalHandoff.status === "valid";
  const provisionalInvalid = provisionalHandoff.status === "invalid";
  const provisionalLoading = !ready || provisionalHandoff.status === "loading";
  const provisionalStale = provisionalReady && provisionalHandoff.freshness === "stale";
  const packetCurrent = provisionalReady
    && provisionalHandoff.freshness === "fresh"
    && latestProvisionalHandoffPacket?.sourceSnapshotSha256 === provisionalHandoff.sourceSnapshotSha256;

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero} aria-labelledby="super-teacher-title">
        <div className={styles.heroInner}>
          <div>
            <Link className={styles.backLink} href="/workspace">← 返回学习工作台</Link>
            <p className={styles.eyebrow}>SOFIA AI TEACHER · GATE A</p>
            <h1 id="super-teacher-title">Sofia智能老师</h1>
            <p className={styles.heroLead}>当前以浏览器内确定性规则解释“为什么先练这个”，并逐句显示冻结来源；问题和学习摘要不发送到本站服务端或外部模型。它不是 Sofia 真人实时通话，也不是 Duolingo 或 DET 官方评分员。</p>
          </div>
          <dl className={styles.heroFacts}>
            <div><dt>当前回答模式</dt><dd>本机有来源解释 · Qwen 未启用</dd></div>
            <div><dt>DET / RAG</dt><dd>0 / 0 准入 · 来源不足时停止</dd></div>
            <div><dt>数据边界</dt><dd>浏览器本机处理 · 不绑定 Clerk 账户</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.workspace} aria-label="Sofia智能老师工作区">
        <aside className={styles.contextPanel}>
          <p className={styles.panelKicker}>CURRENT CONTEXT</p>
          <h2>登录后只读取当前设备的字段最小化摘要</h2>
          <p className={styles.contextSummary}>{ready ? contextSummary : "正在读取本机学习摘要…"}</p>
          <ul className={styles.contextList}>
            <li><span>准入</span><p>先在演示性初筛页完成 18+ 本机确认与六项任务</p></li>
            <li><span>身份</span><p>AI 学习助手，不是 Sofia 真人实时通话或官方评分员</p></li>
            <li><span>本机处理</span><p>优先能力、证据数量、计划、推荐与闭环状态</p></li>
            <li><span>不发送</span><p>问题、摘要、姓名、写作答案、录音与打卡自由文本均不离开浏览器</p></li>
            <li><span>共享设备</span><p>Clerk 只控制访问；本机记录不按账户分区。换人前请导出或清除本机数据。</p></li>
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

      <section id="human-support" className={styles.handoffSection} aria-labelledby="human-support-title" tabIndex={-1}>
        <div>
          <p className={styles.panelKicker}>HUMAN SUPPORT</p>
          <h2 id="human-support-title">需要真人判断时，明确转出去。</h2>
          <p>这里不会假装已经建立客服队列。网页只能在本机生成请求；你需要自行复制，并通过已确认的公开个人微信联系苏肥鸭老师。</p>
        </div>
        <div className={styles.handoffStack}>
          <section
            className={styles.provisionalCard}
            data-state={provisionalLoading ? "loading" : provisionalInvalid ? "invalid" : provisionalReady ? (provisionalStale ? "stale" : "ready") : "unavailable"}
            aria-labelledby="provisional-package-title"
            {...(provisionalReady ? { "aria-describedby": "provisional-package-boundary" } : {})}
          >
            <header className={styles.provisionalHeader}>
              <div>
                <span>STRICT LOCAL HANDOFF</span>
                <h3 id="provisional-package-title">Sofia 本机严格承接包</h3>
              </div>
              <strong aria-label={provisionalLoading ? "承接证据正在本机核对" : provisionalReady ? "七步闭环已留下七步证据" : "承接证据尚未通过核对"}>
                {provisionalLoading ? "核对中" : provisionalReady ? "7 / 7" : "未通过"}
              </strong>
            </header>

            {!ready || provisionalHandoff.status === "loading" ? (
              <p className={styles.provisionalStatus} role="status" aria-live="polite">正在本机核对临时轮次；核对期间不会写入或发送数据。</p>
            ) : provisionalReady ? (
              <>
                <div className={styles.provisionalState} role="status" aria-live="polite">
                  <span aria-hidden="true"></span>
                  <div>
                    <strong>待具备资质人员确认</strong>
                    <p>{packetCurrent ? "现有承接包与当前本机快照一致。" : provisionalStale ? "学习快照已经变化；旧包已停用且不可复制，请按当前快照重新生成。" : "严格证据已通过核对，可以在本机准备承接包。"}</p>
                  </div>
                </div>
                <dl className={styles.provisionalFacts}>
                  <div><dt>严格步骤</dt><dd>{provisionalHandoff.stepCount} / 7</dd></div>
                  <div><dt>优先技能</dt><dd>{skillLabels[provisionalHandoff.prioritySkill]}</dd></div>
                  <div><dt>同伴支持状态</dt><dd>{provisionalHandoff.peerHelpStatus}</dd></div>
                  <div><dt>微复测证据</dt><dd>{provisionalHandoff.retestEvidenceStatus}</dd></div>
                  <div><dt>状态</dt><dd>provisional · 未关闭</dd></div>
                  <div><dt>快照</dt><dd>{compactDigest(provisionalHandoff.sourceSnapshotSha256)}</dd></div>
                  <div><dt>freshness</dt><dd>{provisionalStale ? "stale · 已失效" : "fresh · 当前"}</dd></div>
                  <div><dt>本机生成</dt><dd>{formatCheckedAt(latestProvisionalHandoffPacket?.createdAt)}</dd></div>
                </dl>
                <p id="provisional-package-boundary" className={styles.provisionalBoundary}>
                  <strong>最小化白名单投影：</strong>页面、本机包与复制文本都不携带原始领域 ID 或独立包编号；只用当前完整 workspace 的 SHA-256 摘要重新核对同一严格快照。包不从来源投影作文、口语、打卡自由文本、联系方式或 Clerk 身份字段。它仅在本机准备、尚未发送、没有真实队列，也不是人工确认或正式回执。
                </p>
                <div className={styles.provisionalActions}>
                  <button type="button" onClick={() => void createProvisionalHandoffPacket()} disabled={!safeWriteLockSupported || Boolean(sessionReadIssue)}>
                    {packetCurrent ? "重新核对并生成本机包" : provisionalStale ? "按当前快照重新生成" : "在本机生成严格承接包"}
                  </button>
                  <button type="button" onClick={() => void copyProvisionalHandoffPacket()} disabled={!packetCurrent}>复制白名单承接包</button>
                </div>
              </>
            ) : (
              <div className={styles.provisionalFailure} role={provisionalInvalid ? "alert" : "status"} aria-live="polite">
                <strong>{provisionalInvalid ? "已失败关闭：本机证据无法安全承接" : "当前没有可承接的 provisional 轮次"}</strong>
                <p>{provisionalInvalid ? "发现损坏、未知字段或回链不一致时，Sofia 不会猜测、生成或复制承接包。" : "只有 7 / 7 且明确等待具资质人员确认的本机轮次，才能生成严格承接包。"}</p>
                <div>
                  <Link href="/workspace">返回工作台核对闭环</Link>
                  <Link href="/my-data">前往本机数据保全</Link>
                </div>
              </div>
            )}
          </section>

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
        </div>
      </section>
    </main>
  );
}
