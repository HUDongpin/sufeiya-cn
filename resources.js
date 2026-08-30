(() => {
  const form = document.querySelector("#resource-search-form");
  const queryInput = document.querySelector("[data-resource-query]");
  const skillSelect = document.querySelector("[data-resource-skill]");
  const results = document.querySelector("[data-resource-results]");
  const status = document.querySelector("[data-resource-status]");
  if (!form || !queryInput || !skillSelect || !results || !status) return;

  let resources = [];

  const safeResources = (value) => {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        !("url" in item) &&
        Array.isArray(item.skills) &&
        item.reviewDisposition === "requires_edit" &&
        item.reviewStatus === "teacher_reviewed_requires_remediation" &&
        item.linkStatus === "blocked_pending_edit" &&
        typeof item.reviewNote === "string",
    );
  };

  const formatPublishedDate = (value) => {
    const date = new Date(`${value}T12:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Shanghai",
    }).format(date);
  };

  const matchesSkill = (item, selected) => {
    if (selected === "all") return true;
    if (selected === "General") return item.skills.some((skill) => ["考试概览", "Vocabulary"].includes(skill));
    return item.skills.includes(selected);
  };

  const render = () => {
    const query = queryInput.value.trim().toLocaleLowerCase("zh-CN");
    const selectedSkill = skillSelect.value;
    const filtered = resources.filter((item) => {
      const searchable = `${item.title} ${item.skills.join(" ")} ${item.type || ""} ${item.reviewNote}`.toLocaleLowerCase("zh-CN");
      return (!query || searchable.includes(query)) && matchesSkill(item, selectedSkill);
    });

    results.replaceChildren();
    filtered.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "resource-catalog-card is-blocked";
      card.setAttribute("aria-labelledby", `resource-title-${item.id}`);

      const number = document.createElement("span");
      number.className = "resource-catalog-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      const skills = document.createElement("p");
      skills.textContent = `${item.skills.join(" · ")} · 修改中`;
      const sourceTitleLabel = document.createElement("span");
      sourceTitleLabel.className = "resource-source-title-label";
      sourceTitleLabel.textContent = "来源标题（非本站背书）";
      const title = document.createElement("h3");
      title.id = `resource-title-${item.id}`;
      title.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${formatPublishedDate(item.publishedAt)} · ${item.durationText} · ${item.source}`;
      const reviewNote = document.createElement("p");
      reviewNote.className = "resource-review-note";
      reviewNote.textContent = item.reviewNote;
      copy.append(skills, sourceTitleLabel, title, meta, reviewNote);

      const statusBadge = document.createElement("span");
      statusBadge.className = "resource-catalog-status";
      statusBadge.textContent = "外链暂缓";

      card.append(number, copy, statusBadge);
      results.append(card);
    });

    if (filtered.length) status.textContent = `找到 ${filtered.length} 条待修改课程元数据；外链暂未开放。`;
    else status.textContent = "没有找到匹配课程。可以更换关键词或选择“全部能力”。";
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  queryInput.addEventListener("input", render);
  skillSelect.addEventListener("change", render);

  fetch("/data/resources.json", { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      resources = safeResources(data);
      if (!resources.length) throw new Error("empty catalog");
      render();
    })
    .catch(() => {
      status.textContent = "公开资源目录暂时无法读取。你仍可使用下方 Bilibili 课程入口。";
      results.replaceChildren();
    });
})();
