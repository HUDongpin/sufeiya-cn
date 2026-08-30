import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

const publicRoutes = [
  { id: "home", path: "/" },
  { id: "learning-path", path: "/learning-path" },
  { id: "platform", path: "/platform" },
  { id: "resources-filtered", path: "/resources?query=Reading&skill=Reading" },
  { id: "about", path: "/about" },
  { id: "super-teacher", path: "/super-teacher" },
  { id: "privacy", path: "/privacy" },
  { id: "terms", path: "/terms" },
  { id: "support", path: "/support" },
  { id: "my-data", path: "/my-data" },
  { id: "reading", path: "/learn/reading" },
] as const;

const performanceRoutes = publicRoutes;

const representativeViewportCases = [
  { id: "mobile-360-home", path: "/", width: 360, height: 800 },
  { id: "mobile-390-resources", path: "/resources?query=Reading&skill=Reading", width: 390, height: 844 },
  { id: "compact-720-sofia", path: "/super-teacher", width: 720, height: 900 },
  { id: "tablet-768-privacy", path: "/privacy", width: 768, height: 1024 },
  { id: "tablet-1024-data", path: "/my-data", width: 1024, height: 900 },
  { id: "desktop-1440-reading", path: "/learn/reading", width: 1440, height: 1000 },
] as const;

// A 1280 CSS-pixel layout viewed at 400% exposes roughly 320 CSS pixels;
// at 200% it exposes roughly 640 CSS pixels. Playwright browser zoom is not
// interoperable across engines, so these equivalent CSS viewports exercise
// the WCAG reflow boundary directly and reproducibly.
const zoomEquivalentCases = [
  { id: "zoom-400-equivalent-320-support", path: "/support", width: 320, height: 800 },
  { id: "zoom-200-equivalent-640-reading", path: "/learn/reading", width: 640, height: 900 },
] as const;

const localLearningRoutes = [
  "/learn/reading",
  "/my-data",
] as const;

type RuntimeProblems = {
  consoleErrors: string[];
  pageErrors: string[];
};

type SeriousAxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  targets: string[][];
};

function collectRuntimeProblems(page: Page): RuntimeProblems {
  const problems: RuntimeProblems = { consoleErrors: [], pageErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.consoleErrors.push(`${page.url()} :: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.pageErrors.push(`${page.url()} :: ${error.stack ?? error.message}`);
  });
  return problems;
}

async function settlePublicPage(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
  // Allow afterInteractive scripts and delayed hydration errors to surface.
  await page.waitForTimeout(150);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
}

async function seriousAxeViolations(page: Page): Promise<SeriousAxeViolation[]> {
  const results = await new AxeBuilder({ page }).analyze();

  return results.violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact: impact ?? null,
      help,
      targets: nodes.map(({ target }) => target.map(String)),
    }));
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}

async function assertPublicPageQuality({
  page,
  testInfo,
  path,
  artifactId,
}: {
  page: Page;
  testInfo: TestInfo;
  path: string;
  artifactId: string;
}) {
  const runtimeProblems = collectRuntimeProblems(page);
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await settlePublicPage(page);

  const overflow = await horizontalOverflow(page);
  const violations = await seriousAxeViolations(page);
  if (violations.length > 0) {
    await attachJson(testInfo, `${artifactId}-axe-serious-critical.json`, violations);
  }

  expect.soft(response?.ok(), `${path} must return a successful document response`).toBe(true);
  await expect.soft(page.locator("main"), `${path} must expose a main landmark`).toBeVisible();
  expect.soft(
    overflow.scrollWidth,
    `${path} horizontally overflows: ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect.soft(
    runtimeProblems.consoleErrors,
    `${path} emitted browser console errors`,
  ).toEqual([]);
  expect.soft(
    runtimeProblems.pageErrors,
    `${path} emitted uncaught page errors`,
  ).toEqual([]);
  expect.soft(
    violations,
    `${path} has critical or serious Axe violations`,
  ).toEqual([]);
}

function forwardTab(browserName: string) {
  return browserName === "webkit" ? "Alt+Tab" : "Tab";
}

function backwardTab(browserName: string) {
  return browserName === "webkit" ? "Shift+Alt+Tab" : "Shift+Tab";
}

async function tabUntilFocused(page: Page, selector: string, browserName: string) {
  for (let index = 0; index < 40; index += 1) {
    const focused = await page.locator(selector).evaluate(
      (element) => element === document.activeElement,
    ).catch(() => false);
    if (focused) return;
    await page.keyboard.press(forwardTab(browserName));
  }
  throw new Error(`Keyboard focus never reached ${selector}`);
}

async function moveWithinMenuUntilFocused(
  page: Page,
  target: Locator,
  key: string,
) {
  for (let index = 0; index < 3; index += 1) {
    const focused = await target.evaluate(
      (element) => element === document.activeElement,
    ).catch(() => false);
    if (focused) return;
    await page.keyboard.press(key);
    const stayedInside = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.matches(".nav-toggle")
        || Boolean(active && document.querySelector("#mobile-nav")?.contains(active));
    });
    expect(stayedInside).toBe(true);
  }
  throw new Error("Keyboard focus left the open mobile menu");
}

test.describe("public route quality at the desktop reference viewport", () => {
  for (const route of publicRoutes) {
    test(`${route.id}: Axe critical/serious, console, and overflow gate`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await assertPublicPageQuality({
        page,
        testInfo,
        path: route.path,
        artifactId: route.id,
      });
    });
  }
});

test.describe("responsive and zoom-equivalent reflow quality", () => {
  for (const viewportCase of [...representativeViewportCases, ...zoomEquivalentCases]) {
    test(`${viewportCase.id}: ${viewportCase.width}px reflow has no serious regressions`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width: viewportCase.width,
        height: viewportCase.height,
      });
      await assertPublicPageQuality({
        page,
        testInfo,
        path: viewportCase.path,
        artifactId: viewportCase.id,
      });
    });
  }
});

test("390px mobile menu is keyboard operable, traps focus, and restores focus", async ({ browserName, page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeProblems = collectRuntimeProblems(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await settlePublicPage(page);

  const toggleSelector = ".nav-toggle";
  const toggle = page.locator(toggleSelector);
  await expect(toggle).toBeVisible();
  await tabUntilFocused(page, toggleSelector, browserName);
  await page.keyboard.press("Enter");

  const mobileNav = page.locator("#mobile-nav");
  const firstMenuLink = mobileNav.locator("a[href]").first();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-label", "关闭导航菜单");
  await expect(mobileNav).toBeVisible();
  await expect(firstMenuLink).toBeFocused();

  const openMenuViolations = await seriousAxeViolations(page);
  if (openMenuViolations.length > 0) {
    await attachJson(testInfo, "mobile-menu-open-axe-serious-critical.json", openMenuViolations);
  }
  expect.soft(openMenuViolations, "the open mobile menu has critical or serious Axe violations").toEqual([]);

  await moveWithinMenuUntilFocused(page, toggle, backwardTab(browserName));
  const lastMenuLink = mobileNav.locator("a[href]").last();
  await page.keyboard.press(backwardTab(browserName));
  await expect(lastMenuLink).toBeFocused();
  await page.keyboard.press(forwardTab(browserName));
  await expect(toggle).toBeFocused();
  await moveWithinMenuUntilFocused(page, firstMenuLink, forwardTab(browserName));

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-label", "打开导航菜单");
  await expect(mobileNav).toBeHidden();
  await expect(toggle).toBeFocused();
  expect.soft(runtimeProblems.consoleErrors).toEqual([]);
  expect.soft(runtimeProblems.pageErrors).toEqual([]);
});

test("governance cross-page navigation rematerializes the mobile navigation runtime", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeProblems = collectRuntimeProblems(page);
  await page.goto("/privacy", { waitUntil: "domcontentloaded" });
  await settlePublicPage(page);
  await page.evaluate(() => {
    Object.defineProperty(window, "__phase0aDocumentMarker", {
      configurable: true,
      value: "privacy",
    });
  });

  const supportLink = page.locator("main").getByRole("link", { name: "支持说明" });
  await expect(supportLink).toHaveAttribute("data-full-document-navigation-ready", "true");
  await supportLink.click();
  await expect(page).toHaveURL(/\/support$/);
  await settlePublicPage(page);
  expect(await page.evaluate(() => Object.hasOwn(window, "__phase0aDocumentMarker"))).toBe(false);

  const toggle = page.locator(".nav-toggle");
  const mobileNav = page.locator("#mobile-nav");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-label", "关闭导航菜单");
  await expect(mobileNav).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-label", "打开导航菜单");
  await expect(mobileNav).toBeHidden();
  expect.soft(runtimeProblems.consoleErrors).toEqual([]);
  expect.soft(runtimeProblems.pageErrors).toEqual([]);
});

test.describe("prefers-reduced-motion public runtime", () => {
  test("honors the media preference without a11y, console, or overflow regression", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertPublicPageQuality({
      page,
      testInfo,
      path: "/super-teacher",
      artifactId: "reduced-motion-super-teacher",
    });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  });
});

test("resources filter is a no-JavaScript GET contract with refresh and history", async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, locale: "zh-CN" });
  const page = await context.newPage();
  try {
    await page.goto("/resources", { waitUntil: "load" });
    await expect(page.locator(".resource-catalog-card")).toHaveCount(15);
    await expect(page.locator(".resource-catalog-card[href]")).toHaveCount(0);
    await expect(page.locator(".resource-catalog-status")).toHaveCount(15);
    await expect(page.locator(".resource-catalog-status").first()).toHaveText("外链暂缓");
    await expect(page.locator('a[href*="BV14P411r7hv"]')).toHaveCount(0);
    await page.locator('input[name="query"]').fill("Reading");
    await page.locator('select[name="skill"]').selectOption("Reading");
    await Promise.all([
      page.waitForURL(/\/resources\?query=Reading&skill=Reading$/),
      page.locator("#resource-search-form").evaluate(
        (form) => (form as HTMLFormElement).requestSubmit(),
      ),
    ]);
    await expect(page).toHaveURL(/\/resources\?query=Reading&skill=Reading$/);
    await expect(page.locator('input[name="query"]')).toHaveValue("Reading");
    await expect(page.locator('select[name="skill"]')).toHaveValue("Reading");
    const readingCount = await page.locator(".resource-catalog-card").count();
    expect(readingCount).toBeGreaterThan(0);
    await expect(page.locator(".resource-catalog-card[href]")).toHaveCount(0);

    await page.reload({ waitUntil: "load" });
    await expect(page.locator('input[name="query"]')).toHaveValue("Reading");
    await expect(page.locator('select[name="skill"]')).toHaveValue("Reading");
    expect(await page.locator(".resource-catalog-card").count()).toBe(readingCount);

    await page.locator('input[name="query"]').fill("");
    await page.locator('select[name="skill"]').selectOption("Listening");
    await Promise.all([
      page.waitForURL(/\/resources\?query=&skill=Listening$/),
      page.locator("#resource-search-form").evaluate(
        (form) => (form as HTMLFormElement).requestSubmit(),
      ),
    ]);
    await expect(page.locator('select[name="skill"]')).toHaveValue("Listening");

    await page.evaluate(() => history.back());
    await expect(page).toHaveURL(/\/resources\?query=Reading&skill=Reading$/);
    await expect(page.locator('input[name="query"]')).toHaveValue("Reading");
    await expect(page.locator('select[name="skill"]')).toHaveValue("Reading");
    await page.evaluate(() => history.forward());
    await expect(page).toHaveURL(/\/resources\?query=&skill=Listening$/);
    await expect(page.locator('select[name="skill"]')).toHaveValue("Listening");
  } finally {
    await context.close();
  }
});

test("custom 404 remains accessible and uses the responsive display logo", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeProblems = collectRuntimeProblems(page);
  const response = await page.goto("/phase0a-definitely-missing", { waitUntil: "domcontentloaded" });
  await settlePublicPage(page);
  expect(response?.status()).toBe(404);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('main img[src="/assets/sufeiya-logo-header.webp"]')).toBeVisible();
  expect(await horizontalOverflow(page)).toMatchObject({
    clientWidth: 390,
    viewportWidth: 390,
  });
  const violations = await seriousAxeViolations(page);
  if (violations.length > 0) await attachJson(testInfo, "custom-404-axe.json", violations);
  expect(violations).toEqual([]);
  expect(
    runtimeProblems.consoleErrors.every((message) =>
      /Failed to load resource: the server responded with a status of 404/.test(message)),
  ).toBe(true);
  expect(runtimeProblems.consoleErrors.length).toBeLessThanOrEqual(1);
  expect(runtimeProblems.pageErrors).toEqual([]);
});

test("localhost anonymous learning and data routes send no remote write request", async ({ page }) => {
  const writeRequests: string[] = [];
  const runtimeProblems = collectRuntimeProblems(page);
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  for (const path of localLearningRoutes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settlePublicPage(page);
  }

  expect.soft(writeRequests, "localhost public learning/data navigation must not issue remote writes").toEqual([]);
  expect.soft(runtimeProblems.consoleErrors).toEqual([]);
  expect.soft(runtimeProblems.pageErrors).toEqual([]);
});

test.describe("Chromium local-production laboratory Web Vitals", () => {
  for (const route of performanceRoutes) {
    test(`${route.id}: LCP <= 2.5s and CLS < 0.1`, async ({ browserName, page }, testInfo) => {
      test.skip(browserName !== "chromium", "The release performance Gate is a controlled Chromium laboratory sample.");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        const metrics = { lcp: 0, cls: 0 };
        Object.defineProperty(window, "__sufeiyaLabVitals", {
          configurable: false,
          enumerable: false,
          value: metrics,
          writable: false,
        });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      const runtimeProblems = collectRuntimeProblems(page);
      const response = await page.goto(route.path, { waitUntil: "load" });
      await settlePublicPage(page);
      // LCP may continue until the first user input. This bounded quiet window
      // captures late images/fonts without turning the lab sample into a field claim.
      await page.waitForTimeout(750);

      const vitals = await page.evaluate(() => {
        type LabWindow = Window & { __sufeiyaLabVitals: { lcp: number; cls: number } };
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        return {
          ...(window as unknown as LabWindow).__sufeiyaLabVitals,
          documentResponseEnd: navigation?.responseEnd ?? null,
          kind: "local_production_chromium_lab",
        };
      });
      await attachJson(testInfo, `${route.id}-chromium-lab-vitals.json`, vitals);

      expect.soft(response?.ok()).toBe(true);
      expect.soft(vitals.lcp, "LCP observer must produce a real paint sample").toBeGreaterThan(0);
      expect.soft(vitals.lcp, `${route.path} local production LCP exceeds 2.5s`).toBeLessThanOrEqual(2_500);
      expect.soft(vitals.cls, `${route.path} local production CLS must stay below 0.1`).toBeLessThan(0.1);
      expect.soft(runtimeProblems.consoleErrors).toEqual([]);
      expect.soft(runtimeProblems.pageErrors).toEqual([]);
    });
  }
});
