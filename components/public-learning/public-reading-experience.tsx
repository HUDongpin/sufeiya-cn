"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BASELINE_READING_TASK_IDS,
  PRACTICE_READING_TASK_IDS,
  READING_CONTENT_PACKAGE,
  RETEST_READING_TASK_IDS,
  getReadingTask,
  type ReadingTask,
  type ReadingTaskId,
  type ReadingTaskPhase,
} from "@/lib/public-learning/content";
import {
  PUBLIC_LEARNING_EVENTS_NAMESPACE,
  PUBLIC_READING_STORAGE_NAMESPACE,
  createEmptyPublicReadingState,
  createPublicLearningEvent,
  publicReadingStateSchema,
  type PublicLearningEvent,
  type PublicLearningEventInput,
  type PublicReadingContinuation,
  type PublicReadingState,
  type ReadingObjectiveResponse,
} from "@/lib/public-learning/contracts";
import {
  buildReadingRecommendationFromResponses,
  evaluateObjectiveResponse,
  evaluateRetestEvidence,
  scoreObjectiveResponses,
  updateReadingRecommendationAfterRetest,
} from "@/lib/public-learning/evaluation";
import {
  appendPublicLearningEvent,
  createPublicReadingExport,
  deletePublicReadingLocalData,
  evaluatePublicReadingStoredSnapshotCompatibility,
  loadPublicLearningEvents,
  loadPublicReadingState,
  publicReadingWriteLockSupported,
  storePublicReadingState,
  withPublicReadingWriteLock,
  type StoredValueResult,
} from "@/lib/public-learning/storage";

import styles from "./public-reading-experience.module.css";

type RuntimeMode =
  | "booting"
  | "ready"
  | "memory"
  | "event_degraded"
  | "read_only"
  | "conflict";
type EventInputWithoutSequence = PublicLearningEventInput extends infer Event
  ? Event extends PublicLearningEventInput
    ? Omit<Event, "sequence">
    : never
  : never;
type StatePatch = Omit<
  Partial<PublicReadingState>,
  "protocolVersion" | "contentPackageVersion" | "storageMode" | "revision"
>;
type StateTransition = StatePatch | ((current: PublicReadingState) => StatePatch | null);

const phaseCopy = {
  baseline: { label: "入门检查", short: "检查" },
  practice: { label: "主动练习", short: "练习" },
  retest: { label: "独立平行复测", short: "复测" },
} as const;

function taskIdsForPhase(phase: ReadingTaskPhase): readonly ReadingTaskId[] {
  if (phase === "baseline") return BASELINE_READING_TASK_IDS;
  if (phase === "practice") return PRACTICE_READING_TASK_IDS;
  return RETEST_READING_TASK_IDS;
}

function responseForTask(
  responses: readonly ReadingObjectiveResponse[],
  taskId: string,
): ReadingObjectiveResponse | undefined {
  return responses.find((response) => response.taskId === taskId);
}

function taskTitle(taskId: string | null | undefined): string {
  return taskId ? getReadingTask(taskId)?.passage.title ?? taskId : "—";
}

function progressForState(state: PublicReadingState): number {
  if (state.currentStep === "entry") return 0;
  if (state.currentStep === "lesson") return 30;
  if (state.currentStep === "feedback") return 72;
  if (state.currentStep === "plan" || state.currentStep === "continuation") return 100;
  const task = state.activeTaskId ? getReadingTask(state.activeTaskId) : undefined;
  if (!task) return 0;
  const index = taskIdsForPhase(task.phase).indexOf(task.id);
  if (task.phase === "baseline") return 8 + (index + 1) * 10;
  if (task.phase === "practice") return 38 + (index + 1) * 10;
  return 76 + (index + 1) * 10;
}

function stageIndexForState(state: PublicReadingState): number {
  if (state.currentStep === "entry" || state.currentStep === "baseline") return 0;
  if (state.currentStep === "lesson") return 1;
  if (state.currentStep === "practice") return 2;
  if (state.currentStep === "feedback") return 3;
  if (state.currentStep === "retest") return 3;
  return 4;
}

function TaskFeedback({
  task,
  response,
  onNext,
  nextLabel,
}: {
  task: ReadingTask;
  response: ReadingObjectiveResponse;
  onNext: () => void;
  nextLabel: string;
}) {
  const feedbackRef = useRef<HTMLElement>(null);
  useEffect(() => feedbackRef.current?.focus(), [task.id]);
  const evaluation = evaluateObjectiveResponse(response);
  if (evaluation.status !== "valid") return null;
  const selected = task.options.find((option) => option.id === response.selectedOptionId);
  const correct = task.options.find((option) => option.id === task.correctAnswer.optionId);

  return (
    <section
      ref={feedbackRef}
      className={`${styles.feedback} ${evaluation.isCorrect ? styles.correct : styles.incorrect}`}
      aria-labelledby={`feedback-${task.id}`}
      data-reading-feedback={evaluation.isCorrect ? "correct" : "five-part-wrong"}
      tabIndex={-1}
    >
      <p className={styles.feedbackKicker}>{evaluation.isCorrect ? "证据核对正确" : "先把错误变成下一步"}</p>
      <h3 id={`feedback-${task.id}`}>
        {evaluation.isCorrect
          ? "你选到了原文支持的答案。"
          : <>你的选择“<span lang="en">{selected?.text}</span>”需要再核对。</>}
      </h3>
      {evaluation.isCorrect ? (
        <div className={styles.correctExplanation}>
          <p><strong>为什么成立：</strong>{task.correctAnswer.rationale}</p>
          <p><strong>继续时保留这个动作：</strong>先指出原文证据，再判断答案覆盖的是一个细节还是整段意思。</p>
        </div>
      ) : (
        <ol className={styles.feedbackSteps} aria-label="五段式错误反馈">
          <li>
            <span>01</span>
            <div><strong>错在哪里</strong><p>{task.wrongFeedback.misconception}</p></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>正确答案为什么成立</strong><p><b>正确选项：</b><span lang="en">{correct?.text}</span> {task.wrongFeedback.whyCorrect}</p></div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>其他选项为什么不成立</strong>
              {task.wrongFeedback.whyOthersWrong.map((entry) => (
                <p key={entry.optionId}>
                  <span lang="en">{task.options.find((option) => option.id === entry.optionId)?.text}</span>：{entry.explanation}
                </p>
              ))}
            </div>
          </li>
          <li>
            <span>04</span>
            <div><strong>回看哪个微课</strong><p>《{READING_CONTENT_PACKAGE.microLesson.title}》：先找直接证据，再检查概括范围。</p></div>
          </li>
          <li>
            <span>05</span>
            <div><strong>立即重练与复测</strong><p>{task.wrongFeedback.immediatePractice}</p><p>{task.wrongFeedback.retestTiming}</p></div>
          </li>
        </ol>
      )}
      <button className={styles.primaryButton} type="button" onClick={onNext}>
        {nextLabel}<span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function RetestAnswerLocked({
  task,
  onNext,
  nextLabel,
}: {
  task: ReadingTask;
  onNext: () => void;
  nextLabel: string;
}) {
  const lockedRef = useRef<HTMLElement>(null);
  useEffect(() => lockedRef.current?.focus(), [task.id]);
  return (
    <section
      ref={lockedRef}
      className={styles.retestLocked}
      aria-labelledby={`retest-locked-${task.id}`}
      data-retest-answer-locked={task.id}
      tabIndex={-1}
    >
      <span>FIRST RESPONSE LOCKED</span>
      <h3 id={`retest-locked-${task.id}`}>首次作答已锁定，暂不显示答案教学。</h3>
      <p>为避免影响下一道独立复测题，正确性、依据和需要回看的内容会在两道题全部完成后一起显示。</p>
      <button className={styles.primaryButton} type="button" onClick={onNext}>
        {nextLabel}<span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function ReadingTaskCard({
  task,
  response,
  onAnswer,
  onNext,
  nextLabel,
}: {
  task: ReadingTask;
  response: ReadingObjectiveResponse | undefined;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const taskCardRef = useRef<HTMLElement>(null);
  useEffect(() => taskCardRef.current?.focus(), [task.id]);

  if (response) {
    if (task.phase === "retest") {
      return <RetestAnswerLocked task={task} onNext={onNext} nextLabel={nextLabel} />;
    }
    return <TaskFeedback task={task} response={response} onNext={onNext} nextLabel={nextLabel} />;
  }

  const phaseIds = taskIdsForPhase(task.phase);
  const position = phaseIds.indexOf(task.id) + 1;
  return (
    <section
      ref={taskCardRef}
      className={styles.taskCard}
      aria-labelledby={`task-${task.id}`}
      data-reading-task={task.id}
      tabIndex={-1}
    >
      <header className={styles.taskHeader}>
        <p>{phaseCopy[task.phase].label} · {position}/{phaseIds.length}</p>
        <span>客观题 · 不收集自由文本</span>
      </header>
      <div className={styles.passage} lang="en">
        <span>READING PASSAGE</span>
        <h2>{task.passage.title}</h2>
        <p>{task.passage.text}</p>
      </div>
      <form
        className={styles.answerForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedOptionId) onAnswer(selectedOptionId);
        }}
      >
        <fieldset>
          <legend id={`task-${task.id}`} lang="en">{task.prompt}</legend>
          <div className={styles.options}>
            {task.options.map((option, index) => (
              <label key={option.id} className={selectedOptionId === option.id ? styles.selectedOption : undefined}>
                <input
                  type="radio"
                  name={task.id}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={() => setSelectedOptionId(option.id)}
                />
                <span aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                <strong lang="en">{option.text}</strong>
              </label>
            ))}
          </div>
        </fieldset>
        <button className={styles.primaryButton} type="submit" disabled={!selectedOptionId}>
          提交并查看解释<span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}

function RecommendationLesson({
  responses,
  onStartPractice,
}: {
  responses: readonly ReadingObjectiveResponse[];
  onStartPractice: () => void;
}) {
  const lessonRef = useRef<HTMLElement>(null);
  useEffect(() => lessonRef.current?.focus(), []);
  const recommendation = buildReadingRecommendationFromResponses(responses);
  if (recommendation.status !== "ready") {
    return (
      <section ref={lessonRef} className={styles.recoveryCard} data-reading-stage="lesson" tabIndex={-1}>
        <h2>还缺少一条基线作答证据</h2>
        <p>为了不凭不足证据生成推荐，本页已停止前进。请从本机记录控制中删除本轮草稿后重新开始。</p>
      </section>
    );
  }

  const lesson = READING_CONTENT_PACKAGE.microLesson;
  return (
    <section ref={lessonRef} className={styles.lesson} aria-labelledby="reading-lesson-title" data-reading-stage="lesson" tabIndex={-1}>
      <header className={styles.sectionHeading}>
        <p>基线完成 · 确定性规则推荐</p>
        <h2 id="reading-lesson-title">今天优先练：{recommendation.ability.label}</h2>
        <span>这不是 AI 判断，也不是正式诊断；推荐只依据本轮两道客观题的首次作答。</span>
      </header>
      <div className={styles.recommendationChain} aria-label="推荐证据链">
        <article><span>证据</span><strong>{recommendation.evidence.observedTaskIds.length}/2 道首次作答</strong><small>{recommendation.evidence.incorrectTaskIds.length} 道需要核对</small></article>
        <article><span>能力</span><strong>{recommendation.ability.label}</strong><small>由版本化规则映射</small></article>
        <article><span>资源</span><strong>{recommendation.resource.title}</strong><small>{recommendation.resource.contentPackageVersion}</small></article>
        <article><span>任务</span><strong>{taskTitle(recommendation.task.primaryTaskId)}</strong><small>另有 2 道主动练习</small></article>
        <article><span>复测</span><strong>{taskTitle(recommendation.retest.focusTaskId)}</strong><small>使用全新短文与题目</small></article>
      </div>
      <p className={styles.chainCaption}>证据 → 能力 → 资源 → 任务 → 复测</p>
      <div className={styles.lessonGrid}>
        <div>
          <p className={styles.lessonLabel}>MICRO LESSON</p>
          <h3>{lesson.title}</h3>
          <p>{lesson.summary}</p>
          <ol>{lesson.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
        <aside aria-label="微课示例">
          <span>示例</span>
          <p lang="en">{lesson.workedExample.passage}</p>
          <dl>
            <div><dt>中心意思</dt><dd lang="en">{lesson.workedExample.mainIdea}</dd></div>
            <div><dt>支持细节</dt><dd lang="en">{lesson.workedExample.supportingDetail}</dd></div>
            <div><dt>直接证据</dt><dd lang="en">{lesson.workedExample.explicitEvidence}</dd></div>
          </dl>
        </aside>
      </div>
      <button className={styles.primaryButton} type="button" onClick={onStartPractice}>
        开始 3 道主动练习<span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function PracticeCheckpoint({
  responses,
  onStartRetest,
}: {
  responses: readonly ReadingObjectiveResponse[];
  onStartRetest: () => void;
}) {
  const checkpointRef = useRef<HTMLElement>(null);
  useEffect(() => checkpointRef.current?.focus(), []);
  const score = scoreObjectiveResponses(responses, "practice");
  return (
    <section ref={checkpointRef} className={styles.checkpoint} aria-labelledby="practice-complete-title" data-reading-stage="practice-complete" tabIndex={-1}>
      <span>ACTIVE PRACTICE COMPLETE</span>
      <h2 id="practice-complete-title">3 道主动练习已完成。</h2>
      <p>本轮答对 {score.correctAnswerCount}/3。现在先离开答案说明，再用两篇全新短文检查同一能力。</p>
      <div className={styles.boundaryNote}>
        <strong>平行复测边界</strong>
        <p>复测没有复用基线或练习的短文、题目或选项；结果只描述本轮客观作答，不证明能力增长。</p>
      </div>
      <button className={styles.primaryButton} type="button" onClick={onStartRetest}>
        开始独立平行复测<span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function RetestReview({ responses }: { responses: readonly ReadingObjectiveResponse[] }) {
  return (
    <section className={styles.retestReview} aria-labelledby="retest-review-title">
      <header>
        <span>INDEPENDENT RETEST REVIEW</span>
        <h3 id="retest-review-title">两道首次作答都锁定后，再统一核对。</h3>
      </header>
      {RETEST_READING_TASK_IDS.map((taskId) => {
        const task = getReadingTask(taskId);
        const response = responseForTask(responses, taskId);
        if (!task || !response) return null;
        const evaluation = evaluateObjectiveResponse(response);
        if (evaluation.status !== "valid") return null;
        const selected = task.options.find((option) => option.id === response.selectedOptionId);
        const correct = task.options.find((option) => option.id === task.correctAnswer.optionId);
        return (
          <article key={taskId} data-retest-review={evaluation.isCorrect ? "correct" : "five-part-wrong"}>
            <p>{evaluation.isCorrect ? "证据核对正确" : "需要继续核对"}</p>
            <h4>{task.passage.title}</h4>
            <p>首次选择：<span lang="en">{selected?.text}</span></p>
            {evaluation.isCorrect ? (
              <div>
                <strong>为什么成立</strong>
                <p>{task.correctAnswer.rationale}</p>
              </div>
            ) : (
              <ol aria-label={`${task.passage.title} 五段式复测反馈`}>
                <li><strong>错在哪里</strong><p>{task.wrongFeedback.misconception}</p></li>
                <li><strong>正确答案为什么成立</strong><p><span lang="en">{correct?.text}</span> {task.wrongFeedback.whyCorrect}</p></li>
                <li>
                  <strong>其他选项为什么不成立</strong>
                  {task.wrongFeedback.whyOthersWrong.map((entry) => (
                    <p key={entry.optionId}><span lang="en">{task.options.find((option) => option.id === entry.optionId)?.text}</span>：{entry.explanation}</p>
                  ))}
                </li>
                <li><strong>回看哪个微课</strong><p>《{READING_CONTENT_PACKAGE.microLesson.title}》：先找直接证据，再检查概括范围。</p></li>
                <li><strong>立即重练与复测</strong><p>{task.wrongFeedback.immediatePractice}</p><p>{task.wrongFeedback.retestTiming}</p></li>
              </ol>
            )}
          </article>
        );
      })}
    </section>
  );
}

function FinalPlan({
  state,
  onContinuation,
  onExport,
}: {
  state: PublicReadingState;
  onContinuation: (continuation: PublicReadingContinuation) => void;
  onExport: () => void;
}) {
  const planRef = useRef<HTMLElement>(null);
  useEffect(() => planRef.current?.focus(), []);
  const baseline = scoreObjectiveResponses(state.responses, "baseline");
  const retest = evaluateRetestEvidence(state.responses);
  const recommendation = updateReadingRecommendationAfterRetest(state.responses);
  const ability = recommendation.status === "updated"
    ? recommendation.ability.label
    : "完成全部独立复测后再确定";
  const retestNeedsWork = retest.correctRetestResponseCount < retest.requiredRetestResponseCount;
  const updateReason = recommendation.status === "updated"
    ? {
        retest_remaining_error_overrides_baseline_priority:
          "复测剩余错项指向另一项能力，因此更新原优先项。",
        retest_remaining_error_confirms_baseline_priority:
          "复测剩余错项与入门检查指向同一能力，因此保持优先项。",
        complete_retest_continue_reinforcement:
          "两道独立复测都已答对；继续巩固同一能力，并在下次使用全新材料核对。",
      }[recommendation.ability.reasonCode]
    : "需要完整的入门检查与独立复测首次作答，才能更新推荐。";

  return (
    <section ref={planRef} className={styles.finalPlan} aria-labelledby="updated-plan-title" data-reading-complete="true" data-reading-stage="plan" tabIndex={-1}>
      <header>
        <p>本轮闭环完成</p>
        <h2 id="updated-plan-title">更新后的“今天优先练什么”</h2>
        <span>{retestNeedsWork ? `继续优先：${ability}` : `继续巩固：${ability}`}</span>
      </header>
      <div className={styles.evidenceComparison}>
        <article><span>入门检查</span><strong>{baseline.correctAnswerCount}/{baseline.expectedTaskCount}</strong><small>两道首次客观作答</small></article>
        <i aria-hidden="true">→</i>
        <article><span>独立复测</span><strong>{retest.correctRetestResponseCount}/{retest.requiredRetestResponseCount}</strong><small>两篇全新短文</small></article>
      </div>
      {recommendation.status === "updated" && (
        <>
          <div
            className={styles.recommendationChain}
            data-updated-recommendation-chain
            aria-label="更新后的推荐证据链"
          >
            <article>
              <span>证据</span>
              <strong>{recommendation.evidence.retestIncorrectTaskIds.length > 0
                ? `${recommendation.evidence.retestIncorrectTaskIds.length} 道复测错项`
                : "2 道复测均答对"}</strong>
              <small>{updateReason}</small>
            </article>
            <article>
              <span>能力</span>
              <strong>{recommendation.ability.label}</strong>
              <small>由版本化确定性规则更新</small>
            </article>
            <article>
              <span>资源</span>
              <strong>{recommendation.resource.title}</strong>
              <small>{recommendation.resource.contentPackageVersion}</small>
            </article>
            <article>
              <span>任务</span>
              <strong>{taskTitle(recommendation.task.primaryTaskId)}</strong>
              <small>随后巩固：{taskTitle(recommendation.task.reinforcementTaskId)}</small>
            </article>
            <article>
              <span>复测</span>
              <strong>下次使用全新平行题</strong>
              <small>本轮已锁定 {recommendation.retest.completedTaskIds.length}/2 道首次作答</small>
            </article>
          </div>
          <p className={styles.chainCaption}>证据 → 能力 → 资源 → 任务 → 复测</p>
        </>
      )}
      <RetestReview responses={state.responses} />
      <div className={styles.updatedActions}>
        <h3>接下来的一小步</h3>
        <ol>
          <li>用一句话说明答案对应的原文证据。</li>
          <li>遇到中心意思题，先检查选项能覆盖几句话。</li>
          <li>下一次使用全新短文再复测，不背本轮答案。</li>
        </ol>
      </div>
      <p className={styles.measurementCaveat}>
        以上是同一次短练中的客观作答证据，不是正式诊断、官方分数或能力增长证明。内容版本 {READING_CONTENT_PACKAGE.version} 已由苏肥鸭以 Teacher / Content Owner 身份接受；本次公开版本已通过独立发布 Gate，后续内容变更仍须重新审查。
      </p>
      <div className={styles.continuations} aria-label="获得价值后的继续方式">
        <button type="button" onClick={() => onContinuation("local_continue")}>本机保留，稍后继续</button>
        <button type="button" onClick={onExport}>导出本轮记录</button>
        <button type="button" onClick={() => onContinuation("invite_login")}>受邀内测登录</button>
        <button type="button" onClick={() => onContinuation("waitlist")}>了解等候名单</button>
      </div>
      {state.continuation && (
        <p className={styles.continuationNotice} role="status">
          {state.continuation === "local_continue" && "记录继续保存在这台设备的当前浏览器中；不会跨设备同步。"}
          {state.continuation === "local_export" && "已准备本机导出文件。"}
          {state.continuation === "waitlist" && "等候名单尚未收集身份信息；可先收藏本页，等待正式说明。"}
        </p>
      )}
    </section>
  );
}

function IdentityBoundary() {
  return (
    <section className={styles.identityBoundary} aria-label="真人教师与 AI 角色区分">
      <article>
        <span>HUMAN</span>
        <strong>苏肥鸭老师｜真人教师 · 教学与内容主理人</strong>
        <p>负责课程方向与真人教学审核；本页内容已由苏肥鸭以 Teacher / Content Owner 身份接受。</p>
      </article>
      <article>
        <span>AI</span>
        <strong>Sofia 智能老师｜AI 学习助手</strong>
        <p>本次公开试学不启用 AI、远端模型、录音或数字人；固定规则不会被描述为“智能诊断”。</p>
      </article>
    </section>
  );
}

export function PublicReadingExperience() {
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>("booting");
  const [state, setState] = useState<PublicReadingState>(() => createEmptyPublicReadingState());
  const [events, setEvents] = useState<readonly PublicLearningEvent[]>([]);
  const [selectedDataView, setSelectedDataView] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [eventWarning, setEventWarning] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<StoredValueResult<PublicReadingState> | null>(null);
  const [recoveryEvents, setRecoveryEvents] = useState<StoredValueResult<readonly PublicLearningEvent[]> | null>(null);
  const [stateRaw, setStateRaw] = useState<string | null>(null);
  const [eventRaw, setEventRaw] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const stateRef = useRef(state);
  const stateRawRef = useRef<string | null>(null);
  const eventRawRef = useRef<string | null>(null);
  const eventCountRef = useRef(0);
  const storageAvailableRef = useRef(true);
  const eventWritesBlockedRef = useRef(false);
  const writeBlockedRef = useRef(false);

  const lockForConflict = useCallback((message: string) => {
    writeBlockedRef.current = true;
    setRuntimeMode("conflict");
    setDataNotice(message);
  }, []);

  const recordEvent = useCallback(async (input: EventInputWithoutSequence) => {
    if (
      !storageAvailableRef.current ||
      eventWritesBlockedRef.current ||
      writeBlockedRef.current
    ) return false;
    try {
      return await withPublicReadingWriteLock(() => {
        if (
          !storageAvailableRef.current ||
          eventWritesBlockedRef.current ||
          writeBlockedRef.current
        ) return false;
        if (localStorage.getItem(PUBLIC_READING_STORAGE_NAMESPACE) !== stateRawRef.current) {
          lockForConflict("另一个标签页改变了 Reading 状态。事件写入已停止，避免形成跨 namespace 的不一致记录。");
          return false;
        }
        const event = createPublicLearningEvent({
          ...input,
          sequence: eventCountRef.current,
        } as PublicLearningEventInput);
        const result = appendPublicLearningEvent(localStorage, event, eventRawRef.current);
        if (!result.success) {
          if (result.reason === "conflict") {
            lockForConflict("另一个标签页改变了公开学习事件。为避免覆盖，本页已停止写入；请导出或删除后重新开始。");
          } else {
            setEventWarning("学习仍可继续，但最小本机事件记录未能写入。题目作答状态与事件记录彼此独立。");
          }
          return false;
        }
        eventRawRef.current = result.raw;
        setEventRaw(result.raw);
        eventCountRef.current += 1;
        setEvents((current) => [...current, event]);
        return true;
      });
    } catch {
      storageAvailableRef.current = false;
      setRuntimeMode("memory");
      setEventWarning("安全写锁在操作前失效；事件没有写入，后续学习仅保留在当前页面内存中。");
      return false;
    }
  }, [lockForConflict]);

  const transitionState = useCallback(async (transition: StateTransition) => {
    if (writeBlockedRef.current) return false;

    const applyTransition = () => {
      if (writeBlockedRef.current) return false;
      const currentState = stateRef.current;
      const patch = typeof transition === "function" ? transition(currentState) : transition;
      if (patch === null) return false;
      const candidate = {
        ...currentState,
        ...patch,
        revision: currentState.revision + 1,
      };
      const parsed = publicReadingStateSchema.safeParse(candidate);
      if (!parsed.success) {
        setDataNotice("本次操作不符合版本化学习顺序，页面没有写入或覆盖本机记录。");
        return false;
      }
      const nextState = parsed.data;

      if (!storageAvailableRef.current) {
        stateRef.current = nextState;
        setState(nextState);
        return true;
      }

      if (localStorage.getItem(PUBLIC_LEARNING_EVENTS_NAMESPACE) !== eventRawRef.current) {
        lockForConflict("另一个标签页改变了公开学习事件。状态写入已停止，避免形成跨 namespace 的不一致记录。");
        return false;
      }
      const expectedRaw = stateRawRef.current;
      const result = storePublicReadingState(localStorage, nextState, expectedRaw);
      if (!result.success) {
        if (result.reason === "conflict") {
          lockForConflict("另一个标签页改变了本轮 Reading 记录。为避免覆盖，本页已停止写入；请导出或删除后重新开始。");
        } else {
          storageAvailableRef.current = false;
          setRuntimeMode("memory");
          setDataNotice("浏览器无法继续保存。本页仍可在当前打开状态中完成，但刷新或关闭后可能丢失；你仍可导出当前记录。");
          stateRef.current = nextState;
          setState(nextState);
          return true;
        }
        return false;
      }
      stateRawRef.current = result.raw;
      setStateRaw(result.raw);
      stateRef.current = nextState;
      setState(nextState);
      return true;
    };
    if (!storageAvailableRef.current) return applyTransition();
    try {
      return await withPublicReadingWriteLock(applyTransition);
    } catch {
      storageAvailableRef.current = false;
      setRuntimeMode("memory");
      setDataNotice("安全写锁在操作前失效。本次状态没有写入 localStorage，学习将仅在当前页面内存中继续。");
      return applyTransition();
    }
  }, [lockForConflict]);

  const adoptStateSnapshot = useCallback((snapshot: StoredValueResult<PublicReadingState>) => {
    setRecoveryState(snapshot);
    if (snapshot.status === "ready") {
      stateRef.current = snapshot.data;
      stateRawRef.current = snapshot.raw;
      setState(snapshot.data);
      setStateRaw(snapshot.raw);
    } else if (snapshot.status === "empty") {
      const empty = createEmptyPublicReadingState();
      stateRef.current = empty;
      stateRawRef.current = null;
      setState(empty);
      setStateRaw(null);
    }
  }, []);

  const adoptEventSnapshot = useCallback((snapshot: StoredValueResult<readonly PublicLearningEvent[]>) => {
    setRecoveryEvents(snapshot);
    if (snapshot.status === "ready") {
      eventRawRef.current = snapshot.raw;
      eventCountRef.current = snapshot.data.length;
      setEvents(snapshot.data);
      setEventRaw(snapshot.raw);
    } else if (snapshot.status === "empty") {
      eventRawRef.current = null;
      eventCountRef.current = 0;
      setEvents([]);
      setEventRaw(null);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    const initializationFrame = window.requestAnimationFrame(() => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      void (async () => {
        try {
          const loadedState = loadPublicReadingState(localStorage);
          const loadedEvents = loadPublicLearningEvents(localStorage);
          adoptStateSnapshot(loadedState);
          adoptEventSnapshot(loadedEvents);

          if (loadedState.status === "read_only" || loadedEvents.status === "read_only") {
            writeBlockedRef.current = true;
            setRuntimeMode("read_only");
            setDataNotice("检测到损坏、未知版本或不符合合同的本机记录。两个 namespace 会分别保留其真实可读数据或原始值；你可以先查看或导出，再明确删除。");
            return;
          }

          if (!publicReadingWriteLockSupported()) {
            if (loadedState.status === "ready" || loadedEvents.status === "ready") {
              writeBlockedRef.current = true;
              setRuntimeMode("read_only");
              setDataNotice("此浏览器不支持安全的跨标签页写锁。已有本机记录保持只读，可查看、导出或明确删除；页面不会用不可靠的 compare-and-set 覆盖它。");
            } else {
              storageAvailableRef.current = false;
              setRuntimeMode("memory");
              setDataNotice("此浏览器不支持安全的跨标签页写锁。本轮仍可在当前页面内完成和导出，但不会写入 localStorage；刷新或关闭后会丢失。");
            }
            return;
          }

          const compatibility = evaluatePublicReadingStoredSnapshotCompatibility(
            loadedState,
            loadedEvents,
          );
          if (compatibility.status === "event_degraded") {
            eventWritesBlockedRef.current = true;
            setRuntimeMode("event_degraded");
            setEventWarning(compatibility.issues.join(" "));
            setDataNotice("学习状态与最小事件记录分别通过了 schema，但不属于同一个已完成的生命周期边界。合法学习状态仍可继续和导出；为避免制造伪漏斗，事件记录保持只读且不会再追加。");
            return;
          }

          let entryPoint: "homepage_primary" | "direct_public_path" = "direct_public_path";
          try {
            const referrer = document.referrer ? new URL(document.referrer) : null;
            if (referrer?.origin === window.location.origin && referrer.pathname === "/") {
              entryPoint = "homepage_primary";
            }
          } catch {
            entryPoint = "direct_public_path";
          }
          await recordEvent({ eventName: "learning_entry_viewed", payload: { entryPoint } });
          if (!writeBlockedRef.current) {
            setRuntimeMode(storageAvailableRef.current ? "ready" : "memory");
          }
        } catch {
          storageAvailableRef.current = false;
          stateRef.current = createEmptyPublicReadingState();
          setRuntimeMode("memory");
          setDataNotice("当前浏览器不允许本机存储。本页仍可在内存中完成；请在离开前导出，刷新或关闭后可能丢失。");
        }
      })();
    });
    return () => window.cancelAnimationFrame(initializationFrame);
  }, [adoptEventSnapshot, adoptStateSnapshot, recordEvent]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === PUBLIC_READING_STORAGE_NAMESPACE && event.newValue !== stateRawRef.current) {
        try {
          adoptStateSnapshot(loadPublicReadingState(localStorage));
        } catch {
          setRecoveryState({
            status: "read_only",
            raw: event.newValue ?? "",
            reason: "invalid",
            issues: ["The latest conflicting Reading state could not be read safely."],
          });
        }
        lockForConflict("另一个标签页改变了 Reading 记录。当前页已转为只读，避免覆盖并发修改。");
      }
      if (event.key === PUBLIC_LEARNING_EVENTS_NAMESPACE && event.newValue !== eventRawRef.current) {
        try {
          adoptEventSnapshot(loadPublicLearningEvents(localStorage));
        } catch {
          setRecoveryEvents({
            status: "read_only",
            raw: event.newValue ?? "",
            reason: "invalid",
            issues: ["The latest conflicting event ledger could not be read safely."],
          });
        }
        lockForConflict("另一个标签页改变了公开学习事件。当前页已转为只读，避免覆盖并发修改。");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [adoptEventSnapshot, adoptStateSnapshot, lockForConflict]);

  const answerTask = useCallback(async (task: ReadingTask, selectedOptionId: string) => {
    const response: ReadingObjectiveResponse = {
      taskId: task.id,
      phase: task.phase,
      selectedOptionId,
    };
    const evaluation = evaluateObjectiveResponse(response);
    if (evaluation.status !== "valid") return;
    const saved = await transitionState((current) => {
      if (
        current.currentStep !== task.phase ||
        current.activeTaskId !== task.id ||
        responseForTask(current.responses, task.id)
      ) {
        return null;
      }
      return { responses: [...current.responses, response] };
    });
    if (!saved) return;
    await recordEvent({
      eventName: "task_answered",
      payload: {
        taskId: task.id,
        phase: task.phase,
        selectedOptionId,
        answerState: evaluation.isCorrect ? "correct" : "incorrect",
      },
    });
    if (task.phase !== "retest") {
      await recordEvent({
        eventName: "feedback_viewed",
        payload: {
          taskId: task.id,
          feedbackType: evaluation.isCorrect ? "correct_confirmation" : "five_part_wrong",
        },
      });
    }
  }, [recordEvent, transitionState]);

  const startBaseline = useCallback(async () => {
    const taskId = BASELINE_READING_TASK_IDS[0];
    if (eventCountRef.current === 0) {
      await recordEvent({
        eventName: "learning_entry_viewed",
        payload: { entryPoint: "direct_public_path" },
      });
    }
    const saved = await transitionState((current) => current.currentStep === "entry"
      ? { currentStep: "baseline", activeTaskId: taskId }
      : null);
    if (saved) await recordEvent({ eventName: "first_task_started", payload: { taskId } });
  }, [recordEvent, transitionState]);

  const nextAfterTask = useCallback(async (task: ReadingTask) => {
    const phaseIds = taskIdsForPhase(task.phase);
    const index = phaseIds.indexOf(task.id);
    const nextTaskId = phaseIds[index + 1];
    if (nextTaskId) {
      const saved = await transitionState((current) => (
        current.currentStep === task.phase &&
        current.activeTaskId === task.id &&
        Boolean(responseForTask(current.responses, task.id))
      ) ? { currentStep: task.phase, activeTaskId: nextTaskId } : null);
      if (saved && task.phase !== "baseline") {
        await recordEvent({
          eventName: "next_task_started",
          payload: { taskId: nextTaskId, phase: task.phase },
        });
      }
      return;
    }
    if (task.phase === "baseline") {
      await transitionState((current) => (
        current.currentStep === "baseline" &&
        current.activeTaskId === task.id &&
        Boolean(responseForTask(current.responses, task.id))
      ) ? { currentStep: "lesson", activeTaskId: null } : null);
      return;
    }
    if (task.phase === "practice") {
      const saved = await transitionState((current) => (
        current.currentStep === "practice" &&
        current.activeTaskId === task.id &&
        Boolean(responseForTask(current.responses, task.id))
      ) ? { currentStep: "feedback", activeTaskId: null } : null);
      if (saved) {
        const score = scoreObjectiveResponses(stateRef.current.responses, "practice");
        await recordEvent({
          eventName: "practice_completed",
          payload: { answeredTaskCount: 3, correctAnswerCount: score.correctAnswerCount },
        });
      }
      return;
    }

    const saved = await transitionState((current) => (
      current.currentStep === "retest" &&
      current.activeTaskId === task.id &&
      Boolean(responseForTask(current.responses, task.id))
    ) ? { currentStep: "plan", activeTaskId: null } : null);
    if (!saved) return;
    const retest = evaluateRetestEvidence(stateRef.current.responses);
    const recommendation = updateReadingRecommendationAfterRetest(stateRef.current.responses);
    for (const retestTaskId of RETEST_READING_TASK_IDS) {
      const response = responseForTask(stateRef.current.responses, retestTaskId);
      if (!response) continue;
      const evaluation = evaluateObjectiveResponse(response);
      if (evaluation.status !== "valid") continue;
      await recordEvent({
        eventName: "feedback_viewed",
        payload: {
          taskId: retestTaskId,
          feedbackType: evaluation.isCorrect ? "correct_confirmation" : "five_part_wrong",
        },
      });
    }
    await recordEvent({
      eventName: "retest_completed",
      payload: {
        answeredTaskCount: 2,
        correctAnswerCount: retest.correctRetestResponseCount,
      },
    });
    if (recommendation.status === "updated") {
      await recordEvent({
        eventName: "plan_offered",
        payload: {
          evidenceState: "evidence_available",
          ability: recommendation.ability.id,
          resourceId: recommendation.resource.id,
          taskId: recommendation.task.primaryTaskId,
          retestTaskId:
            RETEST_READING_TASK_IDS.find((taskId) =>
              recommendation.evidence.retestIncorrectTaskIds.includes(taskId)) ??
            recommendation.retest.completedTaskIds[0],
        },
      });
    }
  }, [recordEvent, transitionState]);

  const startPractice = useCallback(async () => {
    const taskId = PRACTICE_READING_TASK_IDS[0];
    const saved = await transitionState((current) => current.currentStep === "lesson"
      ? { currentStep: "practice", activeTaskId: taskId }
      : null);
    if (saved) {
      await recordEvent({ eventName: "next_task_started", payload: { taskId, phase: "practice" } });
    }
  }, [recordEvent, transitionState]);

  const startRetest = useCallback(async () => {
    const taskId = RETEST_READING_TASK_IDS[0];
    const saved = await transitionState((current) => current.currentStep === "feedback"
      ? { currentStep: "retest", activeTaskId: taskId }
      : null);
    if (saved) await recordEvent({ eventName: "retest_started", payload: { taskId } });
  }, [recordEvent, transitionState]);

  const stateSnapshot = useMemo<StoredValueResult<PublicReadingState>>(() => {
    if (recoveryState?.status === "read_only") return recoveryState;
    if (runtimeMode !== "memory" && stateRaw === null) return { status: "empty", raw: null };
    return { status: "ready", raw: stateRaw ?? JSON.stringify(state), data: state };
  }, [recoveryState, runtimeMode, state, stateRaw]);

  const eventSnapshot = useMemo<StoredValueResult<readonly PublicLearningEvent[]>>(() => {
    if (recoveryEvents?.status === "read_only") return recoveryEvents;
    if (runtimeMode !== "memory" && eventRaw === null) return { status: "empty", raw: null };
    return { status: "ready", raw: eventRaw ?? JSON.stringify(events), data: events };
  }, [eventRaw, events, recoveryEvents, runtimeMode]);

  const snapshotCompatibility = useMemo(
    () => evaluatePublicReadingStoredSnapshotCompatibility(stateSnapshot, eventSnapshot),
    [eventSnapshot, stateSnapshot],
  );

  const exportData = useCallback(async (continuation = false) => {
    if (continuation && !writeBlockedRef.current) {
      const saved = await transitionState((current) => (
        (current.currentStep === "plan" || current.currentStep === "continuation") &&
        current.continuation !== "local_export"
      ) ? { currentStep: "continuation", continuation: "local_export" } : null);
      if (saved) {
        await recordEvent({
          eventName: "post_value_continuation_started",
          payload: { continuation: "local_export" },
        });
      }
    }
    let latestState: StoredValueResult<PublicReadingState> = recoveryState?.status === "read_only"
      ? recoveryState
      : {
          status: "ready",
          raw: stateRawRef.current ?? JSON.stringify(stateRef.current),
          data: stateRef.current,
        };
    let latestEvents: StoredValueResult<readonly PublicLearningEvent[]> = recoveryEvents?.status === "read_only"
      ? recoveryEvents
      : {
      status: "ready",
      raw: eventRawRef.current ?? JSON.stringify(events),
      data: events,
    };
    if (storageAvailableRef.current) {
      try {
        latestState = loadPublicReadingState(localStorage);
      } catch {
        // Keep the last strictly parsed in-memory snapshot.
      }
      try {
        latestEvents = loadPublicLearningEvents(localStorage);
      } catch {
        // Keep the last strictly parsed in-memory snapshot.
      }
    }
    const exportEnvelope = createPublicReadingExport(
      latestState,
      latestEvents,
      new Date().toISOString(),
    );
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportEnvelope, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sufeiya-public-reading-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDataNotice("本机记录已导出为 JSON；导出不会删除浏览器中的原记录。");
  }, [events, recordEvent, recoveryEvents, recoveryState, transitionState]);

  const chooseContinuation = useCallback(async (continuation: PublicReadingContinuation) => {
    const saved = await transitionState((current) => (
      (current.currentStep === "plan" || current.currentStep === "continuation") &&
      current.continuation !== continuation
    ) ? { currentStep: "continuation", continuation } : null);
    if (!saved) return;
    await recordEvent({ eventName: "post_value_continuation_started", payload: { continuation } });
    if (continuation === "invite_login") {
      window.location.assign(new URL("/sign-in", window.location.origin).toString());
    }
  }, [recordEvent, transitionState]);

  const deleteData = useCallback(async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setDataNotice("请再确认一次：下一次点击会删除公开 Reading 状态与最小事件记录；旧 Gate A、Sofia 和教研记录不受影响。");
      return;
    }
    try {
      if (publicReadingWriteLockSupported()) {
        await withPublicReadingWriteLock(() => deletePublicReadingLocalData(localStorage));
      } else {
        deletePublicReadingLocalData(localStorage);
      }
      if (
        localStorage.getItem(PUBLIC_READING_STORAGE_NAMESPACE) !== null ||
        localStorage.getItem(PUBLIC_LEARNING_EVENTS_NAMESPACE) !== null
      ) {
        throw new Error("Browser storage did not preserve the explicit deletion.");
      }
      const empty = createEmptyPublicReadingState();
      stateRef.current = empty;
      stateRawRef.current = null;
      eventRawRef.current = null;
      eventCountRef.current = 0;
      eventWritesBlockedRef.current = false;
      writeBlockedRef.current = false;
      const persistentWritesAvailable = publicReadingWriteLockSupported();
      storageAvailableRef.current = persistentWritesAvailable;
      setState(empty);
      setEvents([]);
      setStateRaw(null);
      setEventRaw(null);
      setRecoveryState({ status: "empty", raw: null });
      setRecoveryEvents({ status: "empty", raw: null });
      setEventWarning(null);
      setRuntimeMode(persistentWritesAvailable ? "ready" : "memory");
      setDeleteArmed(false);
      setDataNotice(persistentWritesAvailable
        ? "两类公开 Reading 本机记录已删除。未触碰旧学习工作台、Sofia 或教研演示数据。"
        : "两类公开 Reading 本机记录已删除。此浏览器无安全写锁，接下来的学习只保留在当前页面内存中；旧 namespace 未触碰。");
    } catch {
      setDataNotice("浏览器拒绝删除。本机值未被声称已删除；请检查浏览器存储权限后重试。");
    }
  }, [deleteArmed]);

  const activeTask = state.activeTaskId ? getReadingTask(state.activeTaskId) : undefined;
  const activeResponse = activeTask ? responseForTask(state.responses, activeTask.id) : undefined;
  const activeIds = activeTask ? taskIdsForPhase(activeTask.phase) : [];
  const activePosition = activeTask ? activeIds.indexOf(activeTask.id) : -1;
  const nextLabel = activeTask
    ? activePosition < activeIds.length - 1
      ? `继续下一道${phaseCopy[activeTask.phase].short}`
      : activeTask.phase === "baseline"
        ? "查看推荐与微课"
        : activeTask.phase === "practice"
          ? "准备独立复测"
          : "查看更新后的计划"
    : "继续";

  const dataForDisplay = useMemo(() => ({
    state: stateSnapshot.status === "ready" ? stateSnapshot.data : null,
    events: eventSnapshot.status === "ready" ? eventSnapshot.data : [],
    recovery: {
      stateStatus: stateSnapshot.status,
      stateReason: stateSnapshot.status === "read_only" ? stateSnapshot.reason : null,
      stateRaw: stateSnapshot.status === "read_only" ? stateSnapshot.raw : null,
      eventStatus: eventSnapshot.status,
      eventReason: eventSnapshot.status === "read_only" ? eventSnapshot.reason : null,
      eventRaw: eventSnapshot.status === "read_only" ? eventSnapshot.raw : null,
    },
    compatibility: snapshotCompatibility,
  }), [eventSnapshot, snapshotCompatibility, stateSnapshot]);

  return (
    <main id="main-content" className={styles.experience} data-public-reading-runtime={runtimeMode}>
      <section className={styles.hero} aria-labelledby="public-reading-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span>PUBLIC READING P0</span><i /></p>
          <h1 id="public-reading-title">先完成一次真实学习，<br /><em>再决定下一步。</em></h1>
          <p className={styles.lead}>两道入门检查后，你会看到证据链、微课、三道主动练习和两道全新复测题。无需登录，不收集自由文本，不启用 AI。</p>
          <div className={styles.promiseGrid}>
            <span><strong>≤ 2 次点击</strong>从首页进入并开始</span>
            <span><strong>约 3–5 分钟</strong>看到第一条可行动反馈</span>
            <span><strong>只在本机</strong>可查看、导出和删除</span>
          </div>
          {state.currentStep === "entry" && runtimeMode !== "read_only" && runtimeMode !== "conflict" && (
            <button className={styles.heroButton} type="button" onClick={startBaseline} disabled={runtimeMode === "booting"}>
              {runtimeMode === "booting" ? "正在检查本机记录…" : "开始第 1 道入门检查"}<span aria-hidden="true">→</span>
            </button>
          )}
          {state.currentStep !== "entry" && runtimeMode !== "read_only" && runtimeMode !== "conflict" && (
            <a className={styles.resumeLink} href="#learning-flow">继续当前进度：{state.currentStep === "plan" || state.currentStep === "continuation" ? "查看计划" : "回到学习任务"}</a>
          )}
          <p className={styles.draftNotice}>原创一方内容 · Teacher / Content Owner 已接受 · 非正式诊断 · 暂不索引</p>
        </div>
        <IdentityBoundary />
      </section>

      <section className={styles.flowSection} id="learning-flow" aria-labelledby="flow-title">
        <header className={styles.flowHeader}>
          <div>
            <p>ONE COMPLETE LOOP</p>
            <h2 id="flow-title">检查 → 微课 → 练习 → 复测 → 更新计划</h2>
          </div>
          <strong>{Math.round(progressForState(state))}%</strong>
        </header>
        <div className={styles.progressTrack} aria-label={`本轮学习进度 ${Math.round(progressForState(state))}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressForState(state))}>
          <span style={{ width: `${progressForState(state)}%` }} />
        </div>
        <ol className={styles.stageList} aria-label="学习阶段">
          {["入门检查", "证据微课", "主动练习", "平行复测", "更新计划"].map((label, index) => (
            <li key={label} data-active={stageIndexForState(state) === index} data-complete={stageIndexForState(state) > index}>
              <span>{String(index + 1).padStart(2, "0")}</span>{label}
            </li>
          ))}
        </ol>

        {eventWarning && <p className={styles.warning} role="status">{eventWarning}</p>}
        {(runtimeMode === "read_only" || runtimeMode === "conflict") && (
          <section className={styles.recoveryCard} aria-labelledby="recovery-title">
            <span>FAIL-CLOSED RECOVERY</span>
            <h2 id="recovery-title">本页没有覆盖不确定的本机记录。</h2>
            <p>{dataNotice}</p>
            <p>先在下方查看或导出原始值；只有你完成两次确认后，才会删除两个新的公开 Reading namespace。</p>
            <a href="#local-data-controls">前往本机记录控制</a>
          </section>
        )}
        {runtimeMode === "booting" && <p className={styles.loadingStatus} role="status">正在严格解析本机记录与版本…</p>}
        {runtimeMode !== "booting" && runtimeMode !== "read_only" && runtimeMode !== "conflict" && (
          <>
            {state.currentStep === "entry" && (
              <section className={styles.entryCard}>
                <span>准备就绪</span>
                <h2>从两道客观题开始，不需要账户。</h2>
                <p>首次作答会成为本轮推荐证据。页面不收集姓名、邮箱、录音或开放回答；固定规则只说明“今天优先练什么”。</p>
                <button className={styles.primaryButton} type="button" onClick={startBaseline}>开始第 1 道入门检查<span aria-hidden="true">→</span></button>
              </section>
            )}
            {activeTask && ["baseline", "practice", "retest"].includes(state.currentStep) && (
              <ReadingTaskCard
                key={activeTask.id}
                task={activeTask}
                response={activeResponse}
                onAnswer={(optionId) => void answerTask(activeTask, optionId)}
                onNext={() => void nextAfterTask(activeTask)}
                nextLabel={nextLabel}
              />
            )}
            {state.currentStep === "lesson" && (
              <RecommendationLesson responses={state.responses} onStartPractice={() => void startPractice()} />
            )}
            {state.currentStep === "feedback" && (
              <PracticeCheckpoint responses={state.responses} onStartRetest={() => void startRetest()} />
            )}
            {(state.currentStep === "plan" || state.currentStep === "continuation") && (
              <FinalPlan
                state={state}
                onContinuation={(continuation) => void chooseContinuation(continuation)}
                onExport={() => void exportData(true)}
              />
            )}
          </>
        )}
      </section>

      <section className={styles.dataControls} id="local-data-controls" aria-labelledby="local-data-title">
        <div className={styles.dataIntro}>
          <p>LOCAL DATA CONTROL</p>
          <h2 id="local-data-title">这两类记录始终由你控制。</h2>
          <span>
            学习状态使用 <code>{PUBLIC_READING_STORAGE_NAMESPACE}</code>；最小事件使用 <code>{PUBLIC_LEARNING_EVENTS_NAMESPACE}</code>。两者不绑定账户，不读取或迁移旧 Gate A、Sofia、教研 namespace。
          </span>
        </div>
        <div className={styles.dataSummary}>
          <dl>
            <div><dt>运行模式</dt><dd>{runtimeMode === "ready" ? "当前浏览器本机保存" : runtimeMode === "memory" ? "仅当前页面内存" : runtimeMode === "event_degraded" ? "学习可继续 · 事件只读" : runtimeMode === "booting" ? "检查中" : "只读恢复"}</dd></div>
            <div><dt>客观作答</dt><dd>{state.responses.length}/7</dd></div>
            <div><dt>最小事件</dt><dd>{events.length}</dd></div>
            <div><dt>远端上传</dt><dd>未启用</dd></div>
          </dl>
          <div className={styles.dataActions}>
            <button type="button" onClick={() => setSelectedDataView((visible) => !visible)}>{selectedDataView ? "收起记录" : "查看本机记录"}</button>
            <button type="button" onClick={() => void exportData(false)}>导出 JSON</button>
            <button className={deleteArmed ? styles.deleteArmed : undefined} type="button" onClick={() => void deleteData()}>
              {deleteArmed ? "确认永久删除两类记录" : "删除本机记录"}
            </button>
          </div>
          {dataNotice && <p className={styles.dataNotice} role="status">{dataNotice}</p>}
        </div>
        {selectedDataView && (
          <div className={styles.dataViewer}>
            <div>
              <strong>可读摘要</strong>
              <p>当前阶段：{state.currentStep}；内容版本：{state.contentPackageVersion}；作答 {state.responses.length} 条；事件 {events.length} 条。</p>
            </div>
            <details>
              <summary>展开完整 JSON（包含损坏/未知版本原始值）</summary>
              <pre>{JSON.stringify(dataForDisplay, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
