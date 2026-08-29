import type { ReactNode } from "react";

export type PublicDocumentSection = {
  id: string;
  title: string;
  content: ReactNode;
};

export function PublicDocumentPage({
  eyebrow,
  title,
  lead,
  sections,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: readonly PublicDocumentSection[];
}) {
  return (
    <main id="main-content" className="public-document-page">
      <header className="public-document-hero">
        <div>
          <p className="page-label"><span>GOV</span>{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
          <dl>
            <div><dt>版本日期</dt><dd>2026-08-29</dd></div>
            <div><dt>当前状态</dt><dd>Owner 与专业法律审查前的公开说明稿</dd></div>
          </dl>
        </div>
      </header>
      <div className="public-document-layout">
        <nav aria-label={`${title}目录`}>
          <strong>本页目录</strong>
          {sections.map((section, index) => (
            <a href={`#${section.id}`} key={section.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>{section.title}
            </a>
          ))}
        </nav>
        <article>
          <aside className="public-document-review-note" role="note">
            这份说明用于准确披露当前产品与数据边界，不替代针对具体业务、地区或争议的专业法律意见。正式对外发布前仍需 Owner 与适用的专业法律审查。
          </aside>
          {sections.map((section, index) => (
            <section id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <p>{String(index + 1).padStart(2, "0")}</p>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <div>{section.content}</div>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
