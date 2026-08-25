import type { Metadata } from "next";

import { PublicLearningShell } from "@/components/public-learning-shell";
import { PublicReadingExperience } from "@/components/public-learning/public-reading-experience";

export const metadata: Metadata = {
  title: "3 分钟 Reading 入门检查｜Sufeiya",
  description: "无需登录完成原创 Reading 客观任务、微课、主动练习与平行复测；反馈与记录保存在当前浏览器。",
  alternates: { canonical: "/learn/reading" },
  robots: { index: false, follow: false },
};

export default function PublicReadingPage() {
  return (
    <PublicLearningShell>
      <PublicReadingExperience />
    </PublicLearningShell>
  );
}
