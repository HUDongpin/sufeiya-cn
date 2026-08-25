export const READING_CONTENT_PACKAGE_VERSION = "reading_p0_original_v1" as const;
export const READING_CONTENT_REVIEW_STATUS =
  "accepted_by_teacher_and_content_owner" as const;
export const READING_CONTENT_SOURCE = "original_first_party_draft" as const;
export const READING_CONTENT_RIGHTS_STATUS =
  "confirmed_by_content_owner_for_p0_candidate" as const;
export const READING_CONTENT_REVIEWER = "苏肥鸭" as const;
export const READING_CONTENT_REVIEWER_ROLE = "teacher_and_content_owner" as const;
export const READING_CONTENT_REVIEW_DATE = "2026-08-23" as const;
export const READING_CONTENT_REVIEWED_CANDIDATE_COMMIT =
  "af85403cd97eff47afeea93582705a15aa7527a3" as const;
export const READING_CONTENT_REVIEW_EVIDENCE_REF =
  "codex_task_01a018b0_user_acceptance_2026_08_23" as const;

export const READING_SKILLS = [
  "locate_explicit_evidence",
  "distinguish_main_idea_from_supporting_detail",
] as const;

export const BASELINE_READING_TASK_IDS = [
  "reading_baseline_shade_labels",
  "reading_baseline_friday_plan",
] as const;

export const PRACTICE_READING_TASK_IDS = [
  "reading_practice_return_tray",
  "reading_practice_notebook",
  "reading_practice_reusable_cups",
] as const;

export const RETEST_READING_TASK_IDS = [
  "reading_retest_robotics_bins",
  "reading_retest_cycle_route",
] as const;

export const ALL_READING_TASK_IDS = [
  ...BASELINE_READING_TASK_IDS,
  ...PRACTICE_READING_TASK_IDS,
  ...RETEST_READING_TASK_IDS,
] as const;

export const READING_MICRO_LESSON_ID = "reading_lesson_evidence_and_ideas_v1" as const;

export type ReadingSkill = (typeof READING_SKILLS)[number];
export type ReadingTaskPhase = "baseline" | "practice" | "retest";
export type ReadingTaskId = (typeof ALL_READING_TASK_IDS)[number];
export type ReadingOption = Readonly<{
  id: string;
  text: string;
}>;

export type ReadingWrongFeedback = Readonly<{
  misconception: string;
  whyCorrect: string;
  whyOthersWrong: readonly Readonly<{
    optionId: string;
    explanation: string;
  }>[];
  lessonRef: typeof READING_MICRO_LESSON_ID;
  immediatePractice: string;
  retestTiming: string;
}>;

export type ReadingTask = Readonly<{
  id: ReadingTaskId;
  contentPackageVersion: typeof READING_CONTENT_PACKAGE_VERSION;
  phase: ReadingTaskPhase;
  passage: Readonly<{
    id: string;
    title: string;
    text: string;
  }>;
  prompt: string;
  skillMapping: readonly ReadingSkill[];
  difficultyIntent: Readonly<{
    level: "entry" | "guided" | "independent";
    description: string;
  }>;
  options: readonly ReadingOption[];
  correctAnswer: Readonly<{
    optionId: string;
    rationale: string;
  }>;
  distractorRationales: readonly Readonly<{
    optionId: string;
    rationale: string;
  }>[];
  wrongFeedback: ReadingWrongFeedback;
  reviewStatus: typeof READING_CONTENT_REVIEW_STATUS;
  reviewer: typeof READING_CONTENT_REVIEWER;
  reviewerRole: typeof READING_CONTENT_REVIEWER_ROLE;
  reviewDate: typeof READING_CONTENT_REVIEW_DATE;
  reviewedCandidateCommit: typeof READING_CONTENT_REVIEWED_CANDIDATE_COMMIT;
  reviewEvidenceRef: typeof READING_CONTENT_REVIEW_EVIDENCE_REF;
  rightsStatus: typeof READING_CONTENT_RIGHTS_STATUS;
  source: typeof READING_CONTENT_SOURCE;
}>;

export type ReadingContentPackage = Readonly<{
  version: typeof READING_CONTENT_PACKAGE_VERSION;
  source: typeof READING_CONTENT_SOURCE;
  reviewStatus: typeof READING_CONTENT_REVIEW_STATUS;
  reviewer: typeof READING_CONTENT_REVIEWER;
  reviewerRole: typeof READING_CONTENT_REVIEWER_ROLE;
  reviewDate: typeof READING_CONTENT_REVIEW_DATE;
  reviewedCandidateCommit: typeof READING_CONTENT_REVIEWED_CANDIDATE_COMMIT;
  reviewEvidenceRef: typeof READING_CONTENT_REVIEW_EVIDENCE_REF;
  rightsStatus: typeof READING_CONTENT_RIGHTS_STATUS;
  releaseDisposition: "not_release_ready";
  learnerEvidenceBoundary: "local_objective_response_evidence_only";
  objective: Readonly<{
    title: string;
    description: string;
    skills: readonly ReadingSkill[];
  }>;
  microLesson: Readonly<{
    id: typeof READING_MICRO_LESSON_ID;
    contentPackageVersion: typeof READING_CONTENT_PACKAGE_VERSION;
    title: string;
    summary: string;
    steps: readonly string[];
    workedExample: Readonly<{
      passage: string;
      mainIdea: string;
      supportingDetail: string;
      explicitEvidence: string;
    }>;
    reviewStatus: typeof READING_CONTENT_REVIEW_STATUS;
    reviewer: typeof READING_CONTENT_REVIEWER;
    reviewerRole: typeof READING_CONTENT_REVIEWER_ROLE;
    reviewDate: typeof READING_CONTENT_REVIEW_DATE;
    reviewedCandidateCommit: typeof READING_CONTENT_REVIEWED_CANDIDATE_COMMIT;
    reviewEvidenceRef: typeof READING_CONTENT_REVIEW_EVIDENCE_REF;
    rightsStatus: typeof READING_CONTENT_RIGHTS_STATUS;
    source: typeof READING_CONTENT_SOURCE;
  }>;
  baseline: readonly ReadingTask[];
  practice: readonly ReadingTask[];
  retest: readonly ReadingTask[];
}>;

const sharedRetestTiming =
  "完成三道练习后，先离开答案说明，再完成两道全新短文复测题。";

const reviewedMetadata = {
  contentPackageVersion: READING_CONTENT_PACKAGE_VERSION,
  reviewStatus: READING_CONTENT_REVIEW_STATUS,
  reviewer: READING_CONTENT_REVIEWER,
  reviewerRole: READING_CONTENT_REVIEWER_ROLE,
  reviewDate: READING_CONTENT_REVIEW_DATE,
  reviewedCandidateCommit: READING_CONTENT_REVIEWED_CANDIDATE_COMMIT,
  reviewEvidenceRef: READING_CONTENT_REVIEW_EVIDENCE_REF,
  rightsStatus: READING_CONTENT_RIGHTS_STATUS,
  source: READING_CONTENT_SOURCE,
} as const;

export const READING_CONTENT_PACKAGE: ReadingContentPackage = deepFreeze({
  version: READING_CONTENT_PACKAGE_VERSION,
  source: READING_CONTENT_SOURCE,
  reviewStatus: READING_CONTENT_REVIEW_STATUS,
  reviewer: READING_CONTENT_REVIEWER,
  reviewerRole: READING_CONTENT_REVIEWER_ROLE,
  reviewDate: READING_CONTENT_REVIEW_DATE,
  reviewedCandidateCommit: READING_CONTENT_REVIEWED_CANDIDATE_COMMIT,
  reviewEvidenceRef: READING_CONTENT_REVIEW_EVIDENCE_REF,
  rightsStatus: READING_CONTENT_RIGHTS_STATUS,
  releaseDisposition: "not_release_ready",
  learnerEvidenceBoundary: "local_objective_response_evidence_only",
  objective: {
    title: "从原文证据到中心意思",
    description:
      "先定位短文直接说出的信息，再判断一句话是全文中心意思还是支持中心意思的细节。",
    skills: [...READING_SKILLS],
  },
  microLesson: {
    id: READING_MICRO_LESSON_ID,
    title: "先找证据，再分中心与细节",
    summary:
      "回答阅读客观题时，先把选项和原文逐句对应；判断中心意思时，再检查这个选项能否覆盖全文，而不只是重复一个细节。",
    steps: [
      "圈出题干中的人物、物品、时间或目的等关键词。",
      "回到短文寻找直接包含这些关键词或同义表达的句子。",
      "如果题目问中心意思，检查候选句能否概括大部分句子。",
      "把只说明一个例子、时间或动作的句子归为支持细节。",
    ],
    workedExample: {
      passage:
        "The art club puts a cloth over the tables before painting. The cloth catches drops of paint and makes cleanup faster.",
      mainIdea: "The art club prepares the tables so painting is easier to clean up.",
      supportingDetail: "The cloth catches drops of paint.",
      explicitEvidence: "The passage directly says the cloth makes cleanup faster.",
    },
    ...reviewedMetadata,
  },
  baseline: [
    {
      id: "reading_baseline_shade_labels",
      phase: "baseline",
      passage: {
        id: "passage_baseline_shade_labels",
        title: "Labels in the Student Garden",
        text:
          "On Tuesday, the student garden team placed blue labels beside plants that need shade. The labels help volunteers avoid moving those pots into direct sun. Green labels mark plants that can stay near the sunny wall.",
      },
      prompt: "What does a blue label tell volunteers?",
      skillMapping: ["locate_explicit_evidence"],
      difficultyIntent: {
        level: "entry",
        description:
          "The answer is stated in the first sentence, while the other labels and actions create nearby but distinct alternatives.",
      },
      options: [
        { id: "shade_labels_option_a", text: "The plant needs shade." },
        { id: "shade_labels_option_b", text: "The plant needs a larger pot." },
        { id: "shade_labels_option_c", text: "The plant can stay by the sunny wall." },
      ],
      correctAnswer: {
        optionId: "shade_labels_option_a",
        rationale:
          "The first sentence directly connects blue labels with plants that need shade.",
      },
      distractorRationales: [
        {
          optionId: "shade_labels_option_b",
          rationale: "The passage never connects any label with pot size.",
        },
        {
          optionId: "shade_labels_option_c",
          rationale: "The sunny-wall detail describes green labels, not blue labels.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能把同一段中的相邻细节当成了蓝色标签的含义，或加入了原文没有说明的信息。",
        whyCorrect:
          "第一句直接写明 blue labels 对应 plants that need shade，因此 A 与原文逐句对应。",
        whyOthersWrong: [
          {
            optionId: "shade_labels_option_b",
            explanation: "原文没有谈到花盆大小。",
          },
          {
            optionId: "shade_labels_option_c",
            explanation: "靠近阳光墙的是绿色标签植物。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "现在重读第一句，圈出 blue labels 和 need shade，再用这两个词核对每个选项。",
        retestTiming: sharedRetestTiming,
      },
      ...reviewedMetadata,
    },
    {
      id: "reading_baseline_friday_plan",
      phase: "baseline",
      passage: {
        id: "passage_baseline_friday_plan",
        title: "Amir's Friday Plan",
        text:
          "Every Friday, Amir spends ten minutes planning the next week. He writes down school deadlines, chooses two evenings for exercise, and leaves Saturday afternoon open for family time. The short routine helps him see how his responsibilities fit together.",
      },
      prompt: "What is the main idea of the passage?",
      skillMapping: ["distinguish_main_idea_from_supporting_detail"],
      difficultyIntent: {
        level: "entry",
        description:
          "The correct option summarizes the routine and its purpose; distractors repeat only one scheduled detail.",
      },
      options: [
        {
          id: "friday_plan_option_a",
          text: "Amir uses a short weekly routine to organize different responsibilities.",
        },
        {
          id: "friday_plan_option_b",
          text: "Amir exercises on two evenings each week.",
        },
        {
          id: "friday_plan_option_c",
          text: "Amir keeps Saturday afternoon open for his family.",
        },
      ],
      correctAnswer: {
        optionId: "friday_plan_option_a",
        rationale:
          "This option covers the planning routine, the different responsibilities, and the purpose stated in the final sentence.",
      },
      distractorRationales: [
        {
          optionId: "friday_plan_option_b",
          rationale: "Exercise is one supporting detail and does not summarize the full routine.",
        },
        {
          optionId: "friday_plan_option_c",
          rationale: "Family time is one supporting detail and does not cover the rest of the passage.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能选择了一个真实细节，但这个细节只覆盖一句话，不能概括整段。",
        whyCorrect:
          "A 同时覆盖每周计划、不同责任和最后一句说明的作用，因此能统领全文。",
        whyOthersWrong: [
          {
            optionId: "friday_plan_option_b",
            explanation: "两个晚上运动只是计划中的一个例子。",
          },
          {
            optionId: "friday_plan_option_c",
            explanation: "周六家庭时间也只是计划中的一个例子。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "给每个选项做覆盖检查：数一数它能解释段落中的几句话，再选能覆盖最多句子的概括。",
        retestTiming: sharedRetestTiming,
      },
      ...reviewedMetadata,
    },
  ],
  practice: [
    {
      id: "reading_practice_return_tray",
      phase: "practice",
      passage: {
        id: "passage_practice_return_tray",
        title: "The Gray Return Tray",
        text:
          "At the community bookshelf, visitors put returned books in the gray tray. A volunteer checks each book for notes or damage before placing it back on a shelf. New donations go in a separate wooden box.",
      },
      prompt: "Why are returned books placed in the gray tray?",
      skillMapping: ["locate_explicit_evidence"],
      difficultyIntent: {
        level: "guided",
        description:
          "The learner must connect the return location in sentence one with the checking action in sentence two.",
      },
      options: [
        {
          id: "return_tray_option_a",
          text: "So a volunteer can check them before shelving them.",
        },
        {
          id: "return_tray_option_b",
          text: "So visitors can write notes inside them.",
        },
        {
          id: "return_tray_option_c",
          text: "So they are kept with new donations.",
        },
      ],
      correctAnswer: {
        optionId: "return_tray_option_a",
        rationale:
          "The first two sentences establish that returned books wait in the tray for a volunteer's check before shelving.",
      },
      distractorRationales: [
        {
          optionId: "return_tray_option_b",
          rationale: "The volunteer checks for notes; the passage does not invite visitors to add them.",
        },
        {
          optionId: "return_tray_option_c",
          rationale: "New donations are explicitly placed in a separate wooden box.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能只匹配了一个相同名词，没有继续检查这个选项描述的动作是否也出现在原文。",
        whyCorrect:
          "A 把第一句的 returned books 与第二句的 volunteer checks 和 before placing it back 连起来。",
        whyOthersWrong: [
          {
            optionId: "return_tray_option_b",
            explanation: "检查便条不等于让访客写便条。",
          },
          {
            optionId: "return_tray_option_c",
            explanation: "新捐赠书明确放在另一个木箱。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "把 returned books、gray tray、checks 和 before 四处画线，然后逐项排除改变动作或地点的选项。",
        retestTiming: sharedRetestTiming,
      },
      ...reviewedMetadata,
    },
    {
      id: "reading_practice_notebook",
      phase: "practice",
      passage: {
        id: "passage_practice_notebook",
        title: "Mei's Question Notebook",
        text:
          "Mei keeps a small notebook beside her while she studies science. When a word or diagram is unclear, she writes one precise question instead of stopping for a long search. At the end of the study session, she reviews the questions and chooses which ones need help from her teacher.",
      },
      prompt: "Which statement best expresses the main idea?",
      skillMapping: ["distinguish_main_idea_from_supporting_detail"],
      difficultyIntent: {
        level: "guided",
        description:
          "The learner must combine what Mei records, when she reviews it, and why the routine helps her study.",
      },
      options: [
        {
          id: "notebook_option_a",
          text: "Mei uses a question notebook to manage confusion without interrupting every study moment.",
        },
        {
          id: "notebook_option_b",
          text: "Mei studies science with a notebook beside her.",
        },
        {
          id: "notebook_option_c",
          text: "Mei asks her teacher about some questions.",
        },
      ],
      correctAnswer: {
        optionId: "notebook_option_a",
        rationale:
          "This option explains both the notebook routine and its overall purpose across all three sentences.",
      },
      distractorRationales: [
        {
          optionId: "notebook_option_b",
          rationale: "This states the setting but leaves out what the notebook is used for.",
        },
        {
          optionId: "notebook_option_c",
          rationale: "Teacher help occurs only after Mei has recorded and reviewed the questions.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能把段落开头的场景或结尾的一个动作误当成了贯穿全文的中心意思。",
        whyCorrect:
          "A 概括了记录问题、不中断学习和课后筛选这三个相连的步骤。",
        whyOthersWrong: [
          {
            optionId: "notebook_option_b",
            explanation: "它只交代学习场景，没有说明笔记本的用途。",
          },
          {
            optionId: "notebook_option_c",
            explanation: "向老师求助只是整个方法的最后一步。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "分别用三个短语概括三句话，再找一个能够把这三个短语连起来的选项。",
        retestTiming: sharedRetestTiming,
      },
      ...reviewedMetadata,
    },
    {
      id: "reading_practice_reusable_cups",
      phase: "practice",
      passage: {
        id: "passage_practice_reusable_cups",
        title: "A Cup Reminder",
        text:
          "The school cafe placed a bright reminder beside the reusable-cup shelf. During the first week, many students paused at the sign and chose a reusable cup. By Friday, the bin held fewer disposable cups than it had on Monday.",
      },
      prompt: "Which detail best supports the idea that the reminder changed some students' choices?",
      skillMapping: [
        "locate_explicit_evidence",
        "distinguish_main_idea_from_supporting_detail",
      ],
      difficultyIntent: {
        level: "guided",
        description:
          "The learner must identify the detail that directly shows a choice, while distinguishing it from setting and later outcome details.",
      },
      options: [
        {
          id: "reusable_cups_option_a",
          text: "Many students paused at the sign and chose a reusable cup.",
        },
        {
          id: "reusable_cups_option_b",
          text: "The reminder was beside the reusable-cup shelf.",
        },
        {
          id: "reusable_cups_option_c",
          text: "The passage describes events during one school week.",
        },
      ],
      correctAnswer: {
        optionId: "reusable_cups_option_a",
        rationale:
          "This sentence directly links attention to the reminder with the students' choice of cup.",
      },
      distractorRationales: [
        {
          optionId: "reusable_cups_option_b",
          rationale: "The reminder's location does not by itself show that a student changed a choice.",
        },
        {
          optionId: "reusable_cups_option_c",
          rationale: "The time span gives context but no evidence of a student's choice.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能选择了与主题相关的背景信息，却没有检查它是否直接证明了题干中的 changed choices。",
        whyCorrect:
          "A 同时出现 students、sign 和 chose，直接呈现看到提示后的选择行为。",
        whyOthersWrong: [
          {
            optionId: "reusable_cups_option_b",
            explanation: "地点只能说明提示放在哪里，不能说明学生做了什么。",
          },
          {
            optionId: "reusable_cups_option_c",
            explanation: "一周的时间范围也不能说明选择发生改变。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "把题干中的 changed 和 choices 换成动作词，再找包含实际选择动作的原句。",
        retestTiming: sharedRetestTiming,
      },
      ...reviewedMetadata,
    },
  ],
  retest: [
    {
      id: "reading_retest_robotics_bins",
      phase: "retest",
      passage: {
        id: "passage_retest_robotics_bins",
        title: "Parts for Robotics Club",
        text:
          "Before robotics club begins, Lina sorts the parts into three bins. Wheels go in the shallow bin, sensors go in the padded bin, and spare cables go in the tall bin. The labels face outward so team members can find parts quickly.",
      },
      prompt: "Where does Lina put the sensors?",
      skillMapping: ["locate_explicit_evidence"],
      difficultyIntent: {
        level: "independent",
        description:
          "A new passage presents three parallel item-location pairs, requiring precise independent matching.",
      },
      options: [
        { id: "robotics_bins_option_a", text: "In the padded bin." },
        { id: "robotics_bins_option_b", text: "In the shallow bin." },
        { id: "robotics_bins_option_c", text: "In the tall bin." },
      ],
      correctAnswer: {
        optionId: "robotics_bins_option_a",
        rationale: "The second sentence directly pairs sensors with the padded bin.",
      },
      distractorRationales: [
        {
          optionId: "robotics_bins_option_b",
          rationale: "The shallow bin is paired with wheels.",
        },
        {
          optionId: "robotics_bins_option_c",
          rationale: "The tall bin is paired with spare cables.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能记住了段落中的一个真实地点，却没有保持物品与地点的一一对应。",
        whyCorrect:
          "原文的 sensors go in the padded bin 与 A 完全对应。",
        whyOthersWrong: [
          {
            optionId: "robotics_bins_option_b",
            explanation: "shallow bin 对应 wheels。",
          },
          {
            optionId: "robotics_bins_option_c",
            explanation: "tall bin 对应 spare cables。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "把第二句改写成三组物品—容器配对，再只核对 sensors 这一组。",
        retestTiming:
          "本轮复测提交后先复盘配对策略；下一次使用新短文时再检查同一能力。",
      },
      ...reviewedMetadata,
    },
    {
      id: "reading_retest_cycle_route",
      phase: "retest",
      passage: {
        id: "passage_retest_cycle_route",
        title: "Jia's New Cycle Route",
        text:
          "Jia used to cycle along the busy market road. This month, she tested a riverside path that is slightly longer but has fewer crossings. She now leaves home five minutes earlier and arrives feeling calmer and more ready for class.",
      },
      prompt: "What is the main idea of the passage?",
      skillMapping: ["distinguish_main_idea_from_supporting_detail"],
      difficultyIntent: {
        level: "independent",
        description:
          "A new passage requires balancing a tradeoff, a routine change, and its effect to select the broadest supported summary.",
      },
      options: [
        {
          id: "cycle_route_option_a",
          text: "Jia changed her route and schedule to make her trip to class feel calmer.",
        },
        {
          id: "cycle_route_option_b",
          text: "The riverside path is slightly longer than the market road.",
        },
        {
          id: "cycle_route_option_c",
          text: "Jia leaves home five minutes earlier this month.",
        },
      ],
      correctAnswer: {
        optionId: "cycle_route_option_a",
        rationale:
          "This option combines the route change, schedule adjustment, and calmer arrival described across the passage.",
      },
      distractorRationales: [
        {
          optionId: "cycle_route_option_b",
          rationale: "The path length is one tradeoff, not the overall point of the change.",
        },
        {
          optionId: "cycle_route_option_c",
          rationale: "Leaving earlier is one supporting adjustment, not a summary of the passage.",
        },
      ],
      wrongFeedback: {
        misconception:
          "你可能抓住了一个准确的时间或路线细节，却没有把改变、做法和结果连成全文概括。",
        whyCorrect:
          "A 覆盖换路线、提前出门和更平静到校三个部分，因此能概括整段。",
        whyOthersWrong: [
          {
            optionId: "cycle_route_option_b",
            explanation: "路线更长只是换路线时的一个取舍。",
          },
          {
            optionId: "cycle_route_option_c",
            explanation: "提前五分钟只是配合新路线的一个细节。",
          },
        ],
        lessonRef: READING_MICRO_LESSON_ID,
        immediatePractice:
          "用改变了什么、怎样调整、结果如何三个问题重述短文，再与 A 的覆盖范围比较。",
        retestTiming:
          "本轮复测提交后记录仍需练习的能力；下一次使用新短文时再检查同一能力。",
      },
      ...reviewedMetadata,
    },
  ],
});

export const ALL_READING_TASKS: readonly ReadingTask[] = Object.freeze([
  ...READING_CONTENT_PACKAGE.baseline,
  ...READING_CONTENT_PACKAGE.practice,
  ...READING_CONTENT_PACKAGE.retest,
]);

const taskById = new Map<ReadingTaskId, ReadingTask>(
  ALL_READING_TASKS.map((task) => [task.id, task]),
);

export function getReadingTasks(phase: ReadingTaskPhase): readonly ReadingTask[] {
  return READING_CONTENT_PACKAGE[phase];
}

export function getReadingTask(taskId: string): ReadingTask | undefined {
  return taskById.get(taskId as ReadingTaskId);
}

export function getReadingOption(taskId: string, optionId: string): ReadingOption | undefined {
  return getReadingTask(taskId)?.options.find((option) => option.id === optionId);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
