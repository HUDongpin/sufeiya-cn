import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { CAPABILITY_MATRIX } from "../lib/capability-matrix";

describe("public privacy, terms, and support pages", () => {
  it("keeps legal status partial until external review", async () => {
    const capability = CAPABILITY_MATRIX.capabilities.find(
      (item) => item.id === "public_legal_information",
    );
    assert.equal(capability?.status, "partial");
    assert.ok(capability?.externalEvidence.includes("professional_legal_review_pending"));

    for (const path of ["../app/privacy/page.tsx", "../app/terms/page.tsx", "../app/support/page.tsx"]) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      assert.match(source, /PublicSiteShell/);
      assert.match(source, /robots: \{ index: false, follow: false \}/);
    }
  });

  it("separates browser data, Clerk identity, optional sync, analytics, and future AI", async () => {
    const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    for (const required of [
      "浏览器本机",
      "Clerk",
      "Vercel Web Analytics",
      "阿里云",
      "Qwen",
      "登录不等于同步",
    ]) {
      assert.ok(privacy.includes(required), required);
    }
  });

  it("does not invent an automated queue or credential intake path", async () => {
    const support = await readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8");
    assert.match(support, /没有自动客服或教师案例队列/);
    assert.match(support, /不会自动发送/);
    assert.match(support, /不要发送密码/);
  });
});
