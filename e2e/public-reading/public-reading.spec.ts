import { readFile } from "node:fs/promises";

import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const publicStateKey = "sufeiya_public_reading_p0_v1";
const publicEventsKey = "sufeiya_public_learning_events_v1";
const contentPackageVersion = "reading_p0_original_v1";
const legacyValues = {
  sufeiya_workspace_v1: '{"e2e":"legacy-workspace"}',
  sufeiya_super_teacher_v1: '{"e2e":"legacy-sofia"}',
  sufeiya_teaching_review_demo_v1: '{"e2e":"legacy-teaching-review"}',
} as const;

async function seedLegacyNamespaces(context: BrowserContext) {
  await context.addInitScript((entries) => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, Object.entries(legacyValues));
}

async function assertLegacyNamespacesUnchanged(page: Page) {
  const values = await page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), Object.keys(legacyValues));
  expect(values).toEqual(legacyValues);
}

async function answerCurrentTask(page: Page, optionIndex = 2) {
  const task = page.locator("[data-reading-task]");
  await expect(task).toBeVisible();
  const radios = task.getByRole("radio");
  await radios.nth(Math.min(optionIndex, await radios.count() - 1)).check();
  await task.getByRole("button", { name: "提交并查看解释" }).click();
  await expect(page.locator("[data-reading-feedback]")).toBeVisible();
}

async function continueFromFeedback(page: Page) {
  await page.locator("[data-reading-feedback]").getByRole("button").click();
}

async function answerCurrentRetestTask(page: Page, optionIndex = 2) {
  const task = page.locator("[data-reading-task]");
  await expect(task).toBeVisible();
  const radios = task.getByRole("radio");
  await radios.nth(Math.min(optionIndex, await radios.count() - 1)).check();
  await task.getByRole("button", { name: "提交并查看解释" }).click();
  await expect(page.locator("[data-retest-answer-locked]")).toBeVisible();
  await expect(page.locator("[data-reading-feedback]")).toHaveCount(0);
}

async function continueFromRetestLock(page: Page) {
  await page.locator("[data-retest-answer-locked]").getByRole("button").click();
}

async function tabTo(page: Page, locator: Locator) {
  for (let index = 0; index < 80; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement).catch(() => false)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Keyboard focus did not reach the requested control.");
}

async function tabToAndActivate(page: Page, locator: Locator) {
  await tabTo(page, locator);
  await page.keyboard.press("Enter");
}

async function answerCurrentTaskByKeyboard(page: Page, retest = false) {
  const task = page.locator("[data-reading-task]");
  await expect(task).toBeVisible();
  await tabTo(page, task.getByRole("radio").first());
  await page.keyboard.press("Space");
  await tabToAndActivate(page, task.getByRole("button", { name: "提交并查看解释" }));
  await expect(page.locator(retest ? "[data-retest-answer-locked]" : "[data-reading-feedback]")).toBeVisible();
}

async function minimumTextContrast(locator: Locator) {
  return locator.evaluateAll((elements) => {
    type Color = { red: number; green: number; blue: number; alpha: number };
    const parse = (value: string): Color => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        red: parts[0] ?? 0,
        green: parts[1] ?? 0,
        blue: parts[2] ?? 0,
        alpha: parts[3] ?? 1,
      };
    };
    const composite = (foreground: Color, background: Color): Color => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
      if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
      return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
        blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
      };
    };
    const backgroundFor = (element: Element): Color => {
      const layers: Color[] = [];
      let current: Element | null = element.parentElement;
      while (current) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color.alpha > 0) layers.push(color);
        if (color.alpha === 1) break;
        current = current.parentElement;
      }
      return layers.reverse().reduce(
        (background, foreground) => composite(foreground, background),
        { red: 255, green: 255, blue: 255, alpha: 1 },
      );
    };
    const luminance = (color: Color) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue);
    };
    return Math.min(...elements.map((element) => {
      const background = backgroundFor(element);
      const foreground = composite(parse(getComputedStyle(element).color), background);
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    }));
  });
}

async function borderContrast(locator: Locator) {
  return locator.evaluate((element) => {
    const channels = (value: string) => value.match(/[\d.]+/g)?.map(Number) ?? [];
    const luminance = (value: string) => {
      const [red = 0, green = 0, blue = 0] = channels(value);
      const channel = (component: number) => {
        const normalized = component / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    };
    const border = luminance(getComputedStyle(element).borderTopColor);
    const background = luminance(getComputedStyle(element.parentElement!).backgroundColor);
    return (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
  });
}

test("starts anonymously from the homepage in two clicks without touching legacy namespaces", async ({ context, page }) => {
  await seedLegacyNamespaces(context);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writeRequests.push(`${request.method()}:${request.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.locator("main").getByRole("link", { name: "开始 3 分钟入门检查" }).first()).toBeVisible();
  await page.locator("main").getByRole("link", { name: "开始 3 分钟入门检查" }).first().click();
  await expect(page).toHaveURL(/\/learn\/reading$/);
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  await expect(page.getByText("无需登录，不收集自由文本，不启用 AI。")).toBeVisible();

  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  await expect(page.locator('[data-reading-task="reading_baseline_shade_labels"]')).toBeVisible();
  await assertLegacyNamespacesUnchanged(page);

  const publicState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), publicStateKey);
  expect(publicState).toMatchObject({
    protocolVersion: publicStateKey,
    storageMode: "browser_local_not_account_bound",
    currentStep: "baseline",
    activeTaskId: "reading_baseline_shade_labels",
  });
  expect(writeRequests).toEqual([]);

  const signUpPage = await context.newPage();
  await signUpPage.goto("/sign-up");
  await expect(signUpPage.locator('[data-clerk-invitation-entry="ticket-present"]')).toHaveCount(0);
  await expect(signUpPage.getByRole("heading", {
    name: /账户服务暂不可用。|当前仅接受受邀学习者。/,
  })).toBeVisible();
  await expect(signUpPage.locator("form")).toHaveCount(0);
  await signUpPage.close();
});

test("serializes rapid same-tab submissions without overwriting state or duplicating answer events", async ({ page }) => {
  await page.goto("/learn/reading");
  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  const task = page.locator('[data-reading-task="reading_baseline_shade_labels"]');
  await task.getByRole("radio").last().check();
  await task.locator("form").evaluate((form) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect(page.locator("[data-reading-feedback]")).toBeVisible();

  const persisted = await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: JSON.parse(localStorage.getItem(publicStateKey) ?? "null"),
    events: JSON.parse(localStorage.getItem(publicEventsKey) ?? "[]"),
  }), { publicStateKey, publicEventsKey });
  expect(persisted.state.responses).toHaveLength(1);
  expect(persisted.state.revision).toBe(2);
  expect(persisted.events.filter((event: { eventName: string }) => event.eventName === "task_answered")).toHaveLength(1);
  expect(persisted.events.filter((event: { eventName: string }) => event.eventName === "feedback_viewed")).toHaveLength(1);
});

test("completes the learning loop, verifies every replacement CTA, export, recovery, and deletion", async ({ context, page }) => {
  await seedLegacyNamespaces(context);
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writeRequests.push(`${request.method()}:${request.url()}`);
    }
  });

  await page.goto("/learn/reading");
  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();

  await answerCurrentTask(page);
  const fivePartFeedback = page.locator('[data-reading-feedback="five-part-wrong"]');
  await expect(fivePartFeedback).toContainText("错在哪里");
  await expect(fivePartFeedback).toContainText("正确答案为什么成立");
  await expect(fivePartFeedback).toContainText("其他选项为什么不成立");
  await expect(fivePartFeedback).toContainText("回看哪个微课");
  await expect(fivePartFeedback).toContainText("立即重练与复测");
  await continueFromFeedback(page);

  await answerCurrentTask(page);
  await continueFromFeedback(page);
  await expect(page.getByText("证据 → 能力 → 资源 → 任务 → 复测")).toBeVisible();
  await expect(page.locator('[data-reading-stage="lesson"]')).toBeFocused();
  await expect(page.getByText("这不是 AI 判断，也不是正式诊断")).toBeVisible();
  await page.getByRole("button", { name: "开始 3 道主动练习" }).click();

  for (let index = 0; index < 3; index += 1) {
    await answerCurrentTask(page);
    await continueFromFeedback(page);
  }
  await expect(page.getByRole("heading", { name: "3 道主动练习已完成。" })).toBeVisible();
  await expect(page.locator('[data-reading-stage="practice-complete"]')).toBeFocused();
  await expect(page.getByText("复测没有复用基线或练习的短文、题目或选项")).toBeVisible();
  await page.getByRole("button", { name: "开始独立平行复测" }).click();

  for (let index = 0; index < 2; index += 1) {
    await answerCurrentRetestTask(page);
    await continueFromRetestLock(page);
  }
  await expect(page.locator('[data-reading-complete="true"]')).toBeVisible();
  await expect(page.locator('[data-reading-stage="plan"]')).toBeFocused();
  await expect(page.getByRole("heading", { name: "两道首次作答都锁定后，再统一核对。" })).toBeVisible();
  await expect(page.locator("[data-retest-review]")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "更新后的“今天优先练什么”" })).toBeVisible();
  await expect(page.getByText("不是正式诊断、官方分数或能力增长证明")).toBeVisible();
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  const updatedChain = page.locator("[data-updated-recommendation-chain]");
  await expect(updatedChain).toContainText("证据");
  await expect(updatedChain).toContainText("能力");
  await expect(updatedChain).toContainText("资源");
  await expect(updatedChain).toContainText("任务");
  await expect(updatedChain).toContainText("复测");
  expect(await minimumTextContrast(updatedChain.locator("span, strong, small"))).toBeGreaterThanOrEqual(4.5);

  const persisted = await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: JSON.parse(localStorage.getItem(publicStateKey) ?? "null"),
    events: JSON.parse(localStorage.getItem(publicEventsKey) ?? "null"),
  }), { publicStateKey, publicEventsKey });
  expect(persisted.state.currentStep).toBe("plan");
  expect(persisted.state.responses).toHaveLength(7);
  expect(persisted.events).toHaveLength(24);
  expect(persisted.events.every((event: { dispatchMode?: string }) => event.dispatchMode === "local_only_no_network")).toBe(true);
  expect(persisted.events.map((event: { eventName: string }) => event.eventName)).toEqual(expect.arrayContaining([
    "learning_entry_viewed",
    "first_task_started",
    "task_answered",
    "feedback_viewed",
    "next_task_started",
    "practice_completed",
    "retest_started",
    "retest_completed",
    "plan_offered",
  ]));
  await assertLegacyNamespacesUnchanged(page);
  expect(writeRequests).toEqual([]);

  const dataControls = page.locator("#local-data-controls");
  await dataControls.getByRole("button", { name: "查看本机记录" }).click();
  await expect(dataControls.getByText("作答 7 条；事件 24 条")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dataControls.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(await readFile(downloadPath!, "utf8"));
  expect(exported).toMatchObject({
    protocolVersion: "sufeiya.public-reading-export.v1",
    state: { protocolVersion: publicStateKey, responses: persisted.state.responses },
  });
  expect(exported.events).toHaveLength(24);

  const finalPlan = page.locator('[data-reading-complete="true"]');
  await finalPlan.getByRole("button", { name: "本机保留，稍后继续" }).click();
  await expect(finalPlan.getByRole("status")).toContainText("不会跨设备同步");
  await expect.poll(() => page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? "null");
    return state?.continuation;
  }, publicStateKey)).toBe("local_continue");

  await finalPlan.getByRole("button", { name: "了解等候名单" }).click();
  await expect(finalPlan.getByRole("status")).toContainText("尚未收集身份信息");

  const continuationDownloadPromise = page.waitForEvent("download");
  await finalPlan.getByRole("button", { name: "导出本轮记录" }).click();
  const continuationDownload = await continuationDownloadPromise;
  const continuationExport = JSON.parse(
    await readFile((await continuationDownload.path())!, "utf8"),
  );
  expect(continuationExport.state.continuation).toBe("local_export");
  expect(continuationExport.events.at(-1)).toMatchObject({
    eventName: "post_value_continuation_started",
    payload: { continuation: "local_export" },
  });

  await finalPlan.getByRole("button", { name: "受邀内测登录" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "登录后核验内测资格。" })).toBeVisible();
  await expect(page.locator('main a[href="/sign-up"]')).toHaveCount(0);
  const invitationLinkLabels = await page.locator('a[href="/sign-up"]').allTextContents();
  expect(invitationLinkLabels.length).toBeGreaterThan(0);
  expect(invitationLinkLabels.every((label) => /受邀|邀请/.test(label))).toBe(true);
  await page.goto("/learn/reading");
  await expect(page.locator('[data-public-reading-runtime="ready"]')).toBeVisible();
  await expect.poll(() => page.evaluate((key) => {
    const events = JSON.parse(localStorage.getItem(key) ?? "[]");
    return {
      count: events.length,
      continuations: events
        .filter((event: { eventName: string }) => event.eventName === "post_value_continuation_started")
        .map((event: { payload: { continuation: string } }) => event.payload.continuation),
    };
  }, publicEventsKey)).toEqual({
    count: 29,
    continuations: ["local_continue", "waitlist", "local_export", "invite_login"],
  });

  await page.evaluate((key) => {
    const events = JSON.parse(localStorage.getItem(key) ?? "[]");
    const plan = events.find((event: { eventName: string }) => event.eventName === "plan_offered");
    plan.payload.ability = plan.payload.ability === "locate_explicit_evidence"
      ? "distinguish_main_idea_from_supporting_detail"
      : "locate_explicit_evidence";
    localStorage.setItem(key, JSON.stringify(events));
  }, publicEventsKey);
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="read_only"]')).toBeVisible();
  const recoveryControls = page.locator("#local-data-controls");
  await expect(recoveryControls.locator('[role="status"]').filter({
    hasText: "不符合合同的本机记录",
  })).toBeVisible();
  await recoveryControls.getByRole("button", { name: "删除本机记录" }).click();
  await expect(recoveryControls.getByRole("button", { name: "确认永久删除两类记录" })).toBeVisible();
  await recoveryControls.getByRole("button", { name: "确认永久删除两类记录" }).click();
  await expect.poll(() => page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: localStorage.getItem(publicStateKey),
    events: localStorage.getItem(publicEventsKey),
  }), { publicStateKey, publicEventsKey })).toEqual({ state: null, events: null });
  await assertLegacyNamespacesUnchanged(page);
});

test("preserves corrupt and unknown-version values until explicit export and two-step deletion", async ({ context, page }) => {
  const unknownState = JSON.stringify({ protocolVersion: "sufeiya_public_reading_p0_v99", privateDraft: "preserve-me" });
  const corruptEvents = "{not-json";
  await context.addInitScript(({ publicStateKey, publicEventsKey, unknownState, corruptEvents }) => {
    localStorage.setItem(publicStateKey, unknownState);
    localStorage.setItem(publicEventsKey, corruptEvents);
  }, { publicStateKey, publicEventsKey, unknownState, corruptEvents });

  await page.goto("/learn/reading");
  await expect(page.locator('[data-public-reading-runtime="read_only"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "本页没有覆盖不确定的本机记录。" })).toBeVisible();
  expect(await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: localStorage.getItem(publicStateKey),
    events: localStorage.getItem(publicEventsKey),
  }), { publicStateKey, publicEventsKey })).toEqual({ state: unknownState, events: corruptEvents });

  const controls = page.locator("#local-data-controls");
  await controls.getByRole("button", { name: "查看本机记录" }).click();
  await controls.getByText("展开完整 JSON").click();
  await expect(controls.locator("pre")).toContainText("preserve-me");
  await expect(controls.locator("pre")).toContainText("{not-json");

  const downloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.recovery.stateRaw).toBe(unknownState);
  expect(exported.recovery.eventRaw).toBe(corruptEvents);

  await controls.getByRole("button", { name: "删除本机记录" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), publicStateKey)).toBe(unknownState);
  await controls.getByRole("button", { name: "确认永久删除两类记录" }).click();
  await expect(page.locator('[data-public-reading-runtime="ready"]')).toBeVisible();
  expect(await page.evaluate(({ publicStateKey, publicEventsKey }) => [
    localStorage.getItem(publicStateKey),
    localStorage.getItem(publicEventsKey),
  ], { publicStateKey, publicEventsKey })).toEqual([null, null]);

  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  await expect.poll(() => page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    stateStep: JSON.parse(localStorage.getItem(publicStateKey) ?? "null")?.currentStep,
    eventNames: JSON.parse(localStorage.getItem(publicEventsKey) ?? "[]")
      .map((event: { eventName: string }) => event.eventName),
  }), { publicStateKey, publicEventsKey })).toEqual({
    stateStep: "baseline",
    eventNames: ["learning_entry_viewed", "first_task_started"],
  });
});

test("preserves each namespace independently when only state or events require recovery", async ({ page }) => {
  await page.goto("/learn/reading");
  const validState = {
    protocolVersion: publicStateKey,
    contentPackageVersion,
    storageMode: "browser_local_not_account_bound",
    revision: 0,
    currentStep: "entry",
    activeTaskId: null,
    responses: [],
    continuation: null,
  };
  const validEvents = [{
    protocolVersion: publicEventsKey,
    contentPackageVersion,
    dispatchMode: "local_only_no_network",
    sequence: 0,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  }];
  const corruptEvents = "{events-corrupt";
  await page.evaluate(({ publicStateKey, publicEventsKey, validState, corruptEvents }) => {
    localStorage.setItem(publicStateKey, JSON.stringify(validState));
    localStorage.setItem(publicEventsKey, corruptEvents);
  }, { publicStateKey, publicEventsKey, validState, corruptEvents });
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="read_only"]')).toBeVisible();
  const controls = page.locator("#local-data-controls");
  await controls.getByRole("button", { name: "查看本机记录" }).click();
  await controls.getByText("展开完整 JSON").click();
  await expect(controls.locator("pre")).toContainText(`"protocolVersion": "${publicStateKey}"`);
  await expect(controls.locator("pre")).toContainText(corruptEvents);
  const firstDownloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const firstDownload = await firstDownloadPromise;
  const firstExport = JSON.parse(await readFile((await firstDownload.path())!, "utf8"));
  expect(firstExport.state).toEqual(validState);
  expect(firstExport.recovery.eventRaw).toBe(corruptEvents);

  const corruptState = "{state-corrupt";
  await page.evaluate(({ publicStateKey, publicEventsKey, corruptState, validEvents }) => {
    localStorage.setItem(publicStateKey, corruptState);
    localStorage.setItem(publicEventsKey, JSON.stringify(validEvents));
  }, { publicStateKey, publicEventsKey, corruptState, validEvents });
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="read_only"]')).toBeVisible();
  const secondControls = page.locator("#local-data-controls");
  await secondControls.getByRole("button", { name: "查看本机记录" }).click();
  await secondControls.getByText("展开完整 JSON").click();
  await expect(secondControls.locator("pre")).toContainText(corruptState);
  await expect(secondControls.locator("pre")).toContainText("learning_entry_viewed");
  const secondDownloadPromise = page.waitForEvent("download");
  await secondControls.getByRole("button", { name: "导出 JSON" }).click();
  const secondDownload = await secondDownloadPromise;
  const secondExport = JSON.parse(await readFile((await secondDownload.path())!, "utf8"));
  expect(secondExport.recovery.stateRaw).toBe(corruptState);
  expect(secondExport.events).toEqual(validEvents);
});

test("disables persistent writes and continues in exportable memory when Web Locks are unavailable", async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "locks", {
      configurable: true,
      get: () => undefined,
    });
  });
  await page.goto("/learn/reading");
  await expect(page.locator('[data-public-reading-runtime="memory"]')).toBeVisible();
  await expect(page.getByText("此浏览器不支持安全的跨标签页写锁")).toBeVisible();
  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  await expect(page.locator('[data-reading-task="reading_baseline_shade_labels"]')).toBeVisible();
  expect(await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: localStorage.getItem(publicStateKey),
    events: localStorage.getItem(publicEventsKey),
  }), { publicStateKey, publicEventsKey })).toEqual({ state: null, events: null });

  const controls = page.locator("#local-data-controls");
  await expect(controls.getByText("仅当前页面内存")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.state.currentStep).toBe("baseline");
  expect(exported.events).toEqual([]);

  const entryEvent = {
    protocolVersion: publicEventsKey,
    contentPackageVersion,
    dispatchMode: "local_only_no_network",
    sequence: 0,
    eventName: "learning_entry_viewed",
    payload: { entryPoint: "direct_public_path" },
  };
  await page.evaluate(({ publicStateKey, publicEventsKey, state, entryEvent }) => {
    localStorage.setItem(publicStateKey, JSON.stringify(state));
    localStorage.setItem(publicEventsKey, JSON.stringify([entryEvent]));
  }, { publicStateKey, publicEventsKey, state: exported.state, entryEvent });
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="read_only"]')).toBeVisible();
  const recoveryControls = page.locator("#local-data-controls");
  await recoveryControls.getByRole("button", { name: "删除本机记录" }).click();
  await recoveryControls.getByRole("button", { name: "确认永久删除两类记录" }).click();
  await expect(page.locator('[data-public-reading-runtime="memory"]')).toBeVisible();
  expect(await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: localStorage.getItem(publicStateKey),
    events: localStorage.getItem(publicEventsKey),
  }), { publicStateKey, publicEventsKey })).toEqual({ state: null, events: null });
});

test("fails closed and exports the latest snapshots when another tab changes state and events", async ({ context, page }) => {
  await page.goto("/learn/reading");
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, publicEventsKey)).toBe(1);

  const secondPage = await context.newPage();
  await secondPage.goto("/learn/reading");
  await expect.poll(() => secondPage.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, publicEventsKey)).toBe(2);
  await secondPage.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  await expect(page.locator('[data-public-reading-runtime="conflict"]')).toBeVisible();
  await expect(page.getByRole("region", { name: "本页没有覆盖不确定的本机记录。" })).toContainText("当前页已转为只读，避免覆盖并发修改");
  await expect(page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" })).toHaveCount(0);
  const controls = page.locator("#local-data-controls");
  await controls.getByRole("button", { name: "查看本机记录" }).click();
  await controls.getByText("展开完整 JSON").click();
  await expect(controls.locator("pre")).toContainText('"currentStep": "baseline"');
  const downloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.state.currentStep).toBe("baseline");
  expect(exported.events.at(-1).eventName).toBe("first_task_started");
  await secondPage.close();
});

test("surfaces cross-namespace drift as event-degraded while preserving learning, export, and reset", async ({ page }) => {
  await page.goto("/learn/reading");
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, publicEventsKey)).toBe(1);
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      protocolVersion: key,
      contentPackageVersion: "reading_p0_original_v1",
      storageMode: "browser_local_not_account_bound",
      revision: 1,
      currentStep: "baseline",
      activeTaskId: "reading_baseline_shade_labels",
      responses: [],
      continuation: null,
    }));
  }, publicStateKey);
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="event_degraded"]')).toBeVisible();
  await expect(page.getByText("学习可继续 · 事件只读")).toBeVisible();
  await expect(page.getByText("事件记录保持只读且不会再追加")).toBeVisible();

  await answerCurrentTask(page);
  const snapshots = await page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    state: JSON.parse(localStorage.getItem(publicStateKey) ?? "null"),
    events: JSON.parse(localStorage.getItem(publicEventsKey) ?? "[]"),
  }), { publicStateKey, publicEventsKey });
  expect(snapshots.state.responses).toHaveLength(1);
  expect(snapshots.events).toHaveLength(1);

  const controls = page.locator("#local-data-controls");
  await controls.getByRole("button", { name: "查看本机记录" }).click();
  await controls.getByText("展开完整 JSON").click();
  await expect(controls.locator("pre")).toContainText('"status": "event_degraded"');
  const downloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.state.responses).toHaveLength(1);
  expect(exported.events).toHaveLength(1);
  expect(exported.compatibility.status).toBe("event_degraded");
  expect(exported.compatibility.issues.join(" ")).toContain("responses do not match");

  await controls.getByRole("button", { name: "删除本机记录" }).click();
  await controls.getByRole("button", { name: "确认永久删除两类记录" }).click();
  await expect(page.locator('[data-public-reading-runtime="ready"]')).toBeVisible();
  await expect(page.getByText("The Reading state")).toHaveCount(0);
  await page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first().click();
  await expect.poll(() => page.evaluate(({ publicStateKey, publicEventsKey }) => ({
    stateStep: JSON.parse(localStorage.getItem(publicStateKey) ?? "null")?.currentStep,
    eventNames: JSON.parse(localStorage.getItem(publicEventsKey) ?? "[]")
      .map((event: { eventName: string }) => event.eventName),
  }), { publicStateKey, publicEventsKey })).toEqual({
    stateStep: "baseline",
    eventNames: ["learning_entry_viewed", "first_task_started"],
  });
});

test("keeps single-namespace gaps event-degraded in both the viewer and export", async ({ page }) => {
  await page.goto("/learn/reading");
  await expect.poll(() => page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "[]").length,
    publicEventsKey,
  )).toBe(1);

  await page.evaluate(({ publicStateKey, publicEventsKey }) => {
    localStorage.setItem(publicStateKey, JSON.stringify({
      protocolVersion: publicStateKey,
      contentPackageVersion: "reading_p0_original_v1",
      storageMode: "browser_local_not_account_bound",
      revision: 1,
      currentStep: "baseline",
      activeTaskId: "reading_baseline_shade_labels",
      responses: [],
      continuation: null,
    }));
    localStorage.removeItem(publicEventsKey);
  }, { publicStateKey, publicEventsKey });
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="event_degraded"]')).toBeVisible();

  const controls = page.locator("#local-data-controls");
  await controls.getByRole("button", { name: "查看本机记录" }).click();
  await controls.getByText("展开完整 JSON").click();
  await expect(controls.locator("pre")).toContainText('"status": "event_degraded"');
  await expect(controls.locator("pre")).toContainText("expects 1 journey events");
  const eventsMissingDownloadPromise = page.waitForEvent("download");
  await controls.getByRole("button", { name: "导出 JSON" }).click();
  const eventsMissingDownload = await eventsMissingDownloadPromise;
  const eventsMissingExport = JSON.parse(
    await readFile((await eventsMissingDownload.path())!, "utf8"),
  );
  expect(eventsMissingExport.compatibility.status).toBe("event_degraded");
  expect(eventsMissingExport.compatibility.issues.join(" ")).toContain(
    "expects 1 journey events",
  );

  await page.evaluate(({ publicStateKey, publicEventsKey, contentPackageVersion }) => {
    localStorage.removeItem(publicStateKey);
    localStorage.setItem(publicEventsKey, JSON.stringify([
      {
        protocolVersion: publicEventsKey,
        contentPackageVersion,
        dispatchMode: "local_only_no_network",
        sequence: 0,
        eventName: "learning_entry_viewed",
        payload: { entryPoint: "direct_public_path" },
      },
      {
        protocolVersion: publicEventsKey,
        contentPackageVersion,
        dispatchMode: "local_only_no_network",
        sequence: 1,
        eventName: "first_task_started",
        payload: { taskId: "reading_baseline_shade_labels" },
      },
    ]));
  }, { publicStateKey, publicEventsKey, contentPackageVersion });
  await page.reload();
  await expect(page.locator('[data-public-reading-runtime="event_degraded"]')).toBeVisible();
  const stateMissingDownloadPromise = page.waitForEvent("download");
  await page.locator("#local-data-controls").getByRole("button", { name: "导出 JSON" }).click();
  const stateMissingDownload = await stateMissingDownloadPromise;
  const stateMissingExport = JSON.parse(
    await readFile((await stateMissingDownload.path())!, "utf8"),
  );
  expect(stateMissingExport.compatibility.status).toBe("event_degraded");
  expect(stateMissingExport.compatibility.issues.join(" ")).toContain(
    "expects 0 journey events",
  );
});

test("completes the entire objective learning path with keyboard controls only", async ({ page }) => {
  await page.goto("/learn/reading");
  await page.evaluate(() => {
    (window as typeof window & { __readingPointerCount?: number }).__readingPointerCount = 0;
    window.addEventListener("pointerdown", () => {
      const target = window as typeof window & { __readingPointerCount?: number };
      target.__readingPointerCount = (target.__readingPointerCount ?? 0) + 1;
    });
  });

  await tabToAndActivate(
    page,
    page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first(),
  );
  for (let index = 0; index < 2; index += 1) {
    await answerCurrentTaskByKeyboard(page);
    await tabToAndActivate(page, page.locator("[data-reading-feedback]").getByRole("button"));
  }
  await expect(page.locator('[data-reading-stage="lesson"]')).toBeFocused();
  await tabToAndActivate(page, page.getByRole("button", { name: "开始 3 道主动练习" }));
  for (let index = 0; index < 3; index += 1) {
    await answerCurrentTaskByKeyboard(page);
    await tabToAndActivate(page, page.locator("[data-reading-feedback]").getByRole("button"));
  }
  await expect(page.locator('[data-reading-stage="practice-complete"]')).toBeFocused();
  await tabToAndActivate(page, page.getByRole("button", { name: "开始独立平行复测" }));
  for (let index = 0; index < 2; index += 1) {
    await answerCurrentTaskByKeyboard(page, true);
    await tabToAndActivate(page, page.locator("[data-retest-answer-locked]").getByRole("button"));
  }
  await expect(page.locator('[data-reading-stage="plan"]')).toBeFocused();
  await expect(page.locator("[data-updated-recommendation-chain]")).toBeVisible();
  expect(await page.evaluate(() => (
    window as typeof window & { __readingPointerCount?: number }
  ).__readingPointerCount ?? 0)).toBe(0);
});

test("keeps the portrait, focus state, and learning surface usable at mobile and 200-percent reflow widths", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const portrait = page.getByRole("img", { name: "苏肥鸭老师戴黑色帽子、微笑并手持教鞭的半身肖像" });
  await expect(portrait).toBeVisible();
  const portraitDetails = await portrait.evaluate((image) => ({
    currentSrc: (image as HTMLImageElement).currentSrc,
    naturalWidth: (image as HTMLImageElement).naturalWidth,
    naturalHeight: (image as HTMLImageElement).naturalHeight,
  }));
  expect(portraitDetails.currentSrc).toMatch(/sufeiyalaoshi-homepage-(640|960|1280)w\.(avif|webp)$/);
  expect(portraitDetails.currentSrc).not.toContain("最新微笑版.jpg");
  expect(portraitDetails.naturalWidth / portraitDetails.naturalHeight).toBeCloseTo(0.8, 2);
  const resource = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => entry as PerformanceResourceTiming)
    .find((entry) => entry.name.includes("sufeiyalaoshi-homepage-"))
    ?.["decodedBodySize"] ?? null);
  expect(resource).not.toBeNull();
  expect(resource!).toBeLessThan(80_000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page.locator("main").getByRole("link", { name: "开始 3 分钟入门检查" }).first().click();
  await expect(page.getByRole("img", { name: "苏肥鸭老师戴黑色帽子、微笑并手持教鞭的半身肖像" })).toHaveCount(0);
  expect(await page.evaluate(() => performance.getEntriesByType("resource")
    .some((entry) => entry.name.includes("teacher-portrait")))).toBe(false);
  const startButton = page.locator("main").getByRole("button", { name: "开始第 1 道入门检查" }).first();
  await startButton.focus();
  const focusStyle = await startButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineWidth: Number.parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle };
  });
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(await minimumTextContrast(page.locator("ol[aria-label='学习阶段'] li span"))).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await startButton.click();
  const task = page.locator("[data-reading-task]");
  await expect(task.locator("legend")).toHaveAttribute("lang", "en");
  await expect(task.locator("label strong").first()).toHaveAttribute("lang", "en");
  expect(await borderContrast(task.locator("label > span").first())).toBeGreaterThanOrEqual(3);

  await page.setViewportSize({ width: 720, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const controlMetrics = await task.getByRole("button", { name: "提交并查看解释" }).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(controlMetrics.width).toBeGreaterThanOrEqual(44);
    expect(controlMetrics.height).toBeGreaterThanOrEqual(44);
  }
  expect(consoleErrors).toEqual([]);
});
