import { expect, test, type Page } from "@playwright/test";

const workspaceKey = "sufeiya_workspace_v1";
const sofiaKey = "sufeiya_super_teacher_v1";
const teachingReviewKey = "sufeiya_teaching_review_demo_v1";

async function installStorageObserver(page: Page) {
  await page.evaluate(({ workspaceKey, sofiaKey, teachingReviewKey }) => {
    localStorage.setItem(workspaceKey, '{"offline_test":"workspace"}');
    localStorage.setItem(sofiaKey, '{"offline_test":"sofia"}');
    localStorage.setItem(teachingReviewKey, '{"offline_test":"teaching-review"}');

    const calls: string[] = [];
    const state = window as typeof window & { __offlineStorageCalls?: string[] };
    Object.defineProperty(state, "__offlineStorageCalls", {
      configurable: true,
      value: calls,
    });

    const prototype = Storage.prototype;
    const originalSetItem = prototype.setItem;
    const originalRemoveItem = prototype.removeItem;
    const originalClear = prototype.clear;

    prototype.setItem = function setItem(key, value) {
      calls.push(`setItem:${this === localStorage ? "local" : "session"}:${String(key)}`);
      return originalSetItem.call(this, key, value);
    };
    prototype.removeItem = function removeItem(key) {
      calls.push(`removeItem:${this === localStorage ? "local" : "session"}:${String(key)}`);
      return originalRemoveItem.call(this, key);
    };
    prototype.clear = function clear() {
      calls.push(`clear:${this === localStorage ? "local" : "session"}`);
      return originalClear.call(this);
    };
  }, { workspaceKey, sofiaKey, teachingReviewKey });
}

async function storageSnapshot(page: Page) {
  return page.evaluate(({ workspaceKey, sofiaKey, teachingReviewKey }) => {
    const snapshot = (storage: Storage) => Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key !== null)
      .sort()
      .map((key) => [key, storage.getItem(key)] as const);
    const state = window as typeof window & { __offlineStorageCalls?: string[] };
    return {
      local: snapshot(localStorage),
      session: snapshot(sessionStorage),
      workspace: localStorage.getItem(workspaceKey),
      sofia: localStorage.getItem(sofiaKey),
      teachingReview: localStorage.getItem(teachingReviewKey),
      calls: [...(state.__offlineStorageCalls ?? [])],
    };
  }, { workspaceKey, sofiaKey, teachingReviewKey });
}

test("keeps an already-loaded page and every local namespace intact while offline", async ({ context, page }, testInfo) => {
  await page.goto("/");

  const notice = page.locator("[data-offline-navigation-notice]");
  await expect(notice).toHaveCount(1);
  await expect(notice).toBeHidden();
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toHaveAttribute("aria-live", "polite");
  await expect(notice).toHaveAttribute("aria-atomic", "true");
  await expect(notice).not.toHaveAttribute("tabindex", /.+/);
  await page.screenshot({ path: testInfo.outputPath("online-notice-hidden.png") });

  await installStorageObserver(page);
  const before = await storageSnapshot(page);
  const documentAttempts: string[] = [];
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentAttempts.push(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writeRequests.push(`${request.method()}:${request.url()}`);
    }
  });

  const learningPathLink = page.locator('[data-page-link="learning-path"]');
  await learningPathLink.focus();
  const focusedHref = await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.href ?? null);
  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-state", "offline");
  await expect(notice).toContainText("当前离线");
  await expect(notice).toContainText("不要刷新或关闭");
  expect(await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.href ?? null)).toBe(focusedHref);
  await page.screenshot({ path: testInfo.outputPath("offline-notice-visible.png") });

  const offlineURL = page.url();
  await learningPathLink.click();
  await expect(notice).toHaveAttribute("data-state", "blocked");
  await expect(notice).toContainText("未进入新页面");
  expect(page.url()).toBe(offlineURL);
  expect(await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.href ?? null)).toBe(focusedHref);
  expect(documentAttempts).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("blocked-stays-on-page.png") });

  await learningPathLink.press("Enter");
  expect(page.url()).toBe(offlineURL);
  expect(documentAttempts).toEqual([]);
  await expect(notice).toHaveCount(1);

  const rawLegacyLink = page.getByRole("link", { name: "查看学习路径", exact: true });
  await rawLegacyLink.focus();
  await rawLegacyLink.click();
  expect(page.url()).toBe(offlineURL);
  expect(documentAttempts).toEqual([]);

  const sofiaLauncher = page.getByRole("button", { name: "打开 Sofia智能老师公开介绍" });
  await sofiaLauncher.click();
  const nextLink = page.getByRole("link", { name: "打开完整公开介绍 →" });
  await expect(nextLink).toBeVisible();
  await nextLink.click();
  expect(page.url()).toBe(offlineURL);
  expect(documentAttempts).toEqual([]);
  await page.getByRole("button", { name: "关闭 Sofia智能老师介绍" }).click();

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-state", "offline");

  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await skipLink.focus();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  expect(documentAttempts).toEqual([]);

  expect(await storageSnapshot(page)).toEqual(before);
  expect(writeRequests).toEqual([]);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(notice).toHaveAttribute("data-state", "recovered");
  await expect(notice).toContainText("已重新连接");
  await expect(notice).toContainText("现在可以继续进入其他页面");
  await page.screenshot({ path: testInfo.outputPath("recovered.png") });

  await learningPathLink.click();
  await expect(page).toHaveURL(/\/learning-path$/);
  await expect(page.locator("[data-offline-navigation-notice]")).toBeHidden();
  expect(documentAttempts.length).toBe(1);
});

test("keeps the status readable without overflow at mobile, desktop, and 200%-reflow widths", async ({ context, page }, testInfo) => {
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.setOffline(true);

  const notice = page.locator("[data-offline-navigation-notice]");
  await expect(notice).toBeVisible();

  for (const viewport of [
    { name: "mobile-360", width: 360, height: 800 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "reflow-720", width: 720, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const metrics = await notice.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const textStyle = getComputedStyle(element.querySelector("span")!);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        position: style.position,
        zIndex: Number(style.zIndex),
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
        textFontSize: Number.parseFloat(textStyle.fontSize),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(viewport.width);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(viewport.height);
    expect(metrics.position).toBe("fixed");
    expect(metrics.zIndex).toBe(70);
    expect(Number.parseFloat(metrics.animationDuration)).toBeLessThanOrEqual(0.00001);
    expect(Number.parseFloat(metrics.transitionDuration)).toBeLessThanOrEqual(0.00001);
    expect(metrics.textFontSize).toBeGreaterThanOrEqual(14);
    expect(metrics.overflow).toBeLessThanOrEqual(0);

    const overlapArea = await page.evaluate(() => {
      const noticeElement = document.querySelector<HTMLElement>("[data-offline-navigation-notice]");
      const launcherElement = document.querySelector<HTMLElement>('button[aria-label="打开 Sofia智能老师公开介绍"]');
      if (!noticeElement || !launcherElement) return -1;
      const noticeRect = noticeElement.getBoundingClientRect();
      const launcherRect = launcherElement.getBoundingClientRect();
      const width = Math.max(0, Math.min(noticeRect.right, launcherRect.right) - Math.max(noticeRect.left, launcherRect.left));
      const height = Math.max(0, Math.min(noticeRect.bottom, launcherRect.bottom) - Math.max(noticeRect.top, launcherRect.top));
      return width * height;
    });
    expect(overlapArea).toBe(0);

    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-offline.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 360, height: 800 });
  const menuToggle = page.getByRole("button", { name: "打开导航菜单" });
  await menuToggle.click();
  const mobileNavigation = page.getByRole("navigation", { name: "移动端主导航" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link").first()).toBeFocused();
  const layerOrder = await page.evaluate(() => ({
    notice: Number(getComputedStyle(document.querySelector<HTMLElement>("[data-offline-navigation-notice]")!).zIndex),
    mobileNavigation: Number(getComputedStyle(document.querySelector<HTMLElement>("#mobile-nav")!).zIndex),
  }));
  expect(layerOrder.notice).toBeLessThan(layerOrder.mobileNavigation);
  await page.getByRole("button", { name: "关闭导航菜单" }).click();

  await context.setOffline(false);
  await expect(notice).toHaveAttribute("data-state", "recovered");
});
