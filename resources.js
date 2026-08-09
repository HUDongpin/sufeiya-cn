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
        typeof item.url === "string" &&
        /^https:\/\/(www\.)?bilibili\.com\/video\//.test(item.url) &&
        Array.isArray(item.skills),
    );
  };

  const formatPublishedDate = (value) => {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date);
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
      const searchable = `${item.title} ${item.skills.join(" ")} ${item.type || ""}`.toLocaleLowerCase("zh-CN");
      return (!query || searchable.includes(query)) && matchesSkill(item, selectedSkill);
    });

    results.replaceChildren();
    filtered.forEach((item, index) => {
      const link = document.createElement("a");
      link.className = "resource-catalog-card";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const number = document.createElement("span");
      number.className = "resource-catalog-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      const skills = document.createElement("p");
      skills.textContent = item.skills.join(" · ");
      const title = document.createElement("h3");
      title.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${formatPublishedDate(item.publishedAt)} · ${item.durationText} · ${item.source}`;
      copy.append(skills, title, meta);

      const arrow = document.createElement("span");
      arrow.className = "resource-catalog-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";

      const newWindow = document.createElement("span");
      newWindow.className = "sr-only";
      newWindow.textContent = "（在新窗口打开）";
      link.append(number, copy, arrow, newWindow);
      results.append(link);
    });

    if (filtered.length) status.textContent = `找到 ${filtered.length} 条公开课程；点击后进入 Bilibili 原始发布页。`;
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
