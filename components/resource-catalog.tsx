import type { LearningResource, ResourceSkillFilter } from "@/lib/resources";

const skillLabels: Record<ResourceSkillFilter, string> = {
  all: "全部能力",
  Reading: "Reading · 阅读",
  Listening: "Listening · 听力",
  Writing: "Writing · 写作",
  Speaking: "Speaking · 口语",
  General: "General · 综合",
};

function formatPublishedDate(value: string) {
  const date = new Date(`${value}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function ResourceCatalog({
  query,
  skill,
  resources,
}: {
  query: string;
  skill: ResourceSkillFilter;
  resources: readonly LearningResource[];
}) {
  return (
    <section className="resource-browser section" aria-labelledby="resource-browser-title">
      <div className="section-inner">
        <div className="section-kicker"><span>02</span><p>站内资源检索</p></div>
        <div className="resource-browser-heading">
          <div>
            <p className="status-pill"><span />公开目录 · URL 可分享</p>
            <h2 id="resource-browser-title">按能力找到课程，<br />再回到原始发布页学习。</h2>
          </div>
          <p>目录只展示公开元数据，点击后进入苏肥鸭 Bilibili 原始页面。课程原文和视频不复制到本站。</p>
        </div>
        <form id="resource-search-form" className="resource-search" role="search" method="get" action="/resources" autoComplete="off">
          <label>
            <span>搜索课程</span>
            <input
              type="search"
              name="query"
              autoComplete="off"
              defaultValue={query}
              maxLength={120}
              placeholder="输入题型、能力或关键词"
            />
          </label>
          <label>
            <span>能力分类</span>
            <select name="skill" defaultValue={skill} autoComplete="off">
              {Object.entries(skillLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="button button-ink" type="submit">查找资源</button>
        </form>
        <p className="resource-results-status" role="status">
          {resources.length
            ? `找到 ${resources.length} 条公开课程；点击后进入 Bilibili 原始发布页。`
            : "没有找到匹配课程。可以更换关键词或选择“全部能力”。"}
        </p>
        <div className="resource-catalog">
          {resources.map((resource, index) => (
            <a
              className="resource-catalog-card"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              key={resource.id}
            >
              <span className="resource-catalog-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{resource.skills.join(" · ")}</p>
                <h3>{resource.title}</h3>
                <small>{formatPublishedDate(resource.publishedAt)} · {resource.durationText} · {resource.source}</small>
              </div>
              <span className="resource-catalog-arrow" aria-hidden="true">↗</span>
              <span className="sr-only">（在新窗口打开）</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
