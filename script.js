(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector("#mobile-nav");
  const header = document.querySelector("[data-header]");
  const progressBar = document.querySelector(".reading-progress span");
  const currentPage = document.body.dataset.page;

  if (currentPage && currentPage !== "home") {
    document.querySelectorAll(`[data-page-link="${currentPage}"]`).forEach((link) => {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    });
  }

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!navToggle || !mobileNav) return;
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "打开导航菜单");
    mobileNav.hidden = true;
    document.body.classList.remove("menu-open");
    if (restoreFocus) navToggle.focus();
  };

  const openMenu = () => {
    if (!navToggle || !mobileNav) return;
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "关闭导航菜单");
    mobileNav.hidden = false;
    document.body.classList.add("menu-open");
    mobileNav.querySelector("a")?.focus();
  };

  navToggle?.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) closeMenu();
    else openMenu();
  });

  mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  document.addEventListener("keydown", (event) => {
    const menuIsOpen = navToggle?.getAttribute("aria-expanded") === "true";
    if (!menuIsOpen) return;

    if (event.key === "Escape") {
      closeMenu({ restoreFocus: true });
      return;
    }

    if (event.key === "Tab" && navToggle && mobileNav) {
      const focusable = [navToggle, ...mobileNav.querySelectorAll("a[href]")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1080 && navToggle?.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  });

  const updateProgress = () => {
    if (!progressBar) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    progressBar.style.transform = `scaleX(${progress})`;
    header?.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });

  document.querySelectorAll(".faq-list details").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      document.querySelectorAll(".faq-list details[open]").forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
