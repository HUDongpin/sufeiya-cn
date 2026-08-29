import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { CAPABILITY_MATRIX } from "../lib/capability-matrix";

describe("public privacy, terms, and support pages", () => {
  it("keeps legal status partial until the Owner completes the Mainland internal review", async () => {
    const capability = CAPABILITY_MATRIX.capabilities.find(
      (item) => item.id === "public_legal_information",
    );
    assert.equal(capability?.status, "partial");
    assert.ok(
      capability?.externalEvidence.includes(
        "owner_mainland_internal_compliance_review_pending_2026_08_29",
      ),
    );
    assert.equal(capability?.releaseGate, "owner_mainland_internal_compliance_review");

    for (const path of ["../app/privacy/page.tsx", "../app/terms/page.tsx", "../app/support/page.tsx"]) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      assert.match(source, /PublicSiteShell/);
      assert.match(source, /robots: \{ index: false, follow: false \}/);
    }

    const sharedDocument = await readFile(
      new URL("../components/public-document-page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(sharedDocument, /中国大陆适用规则完成内部合规复核/);
    assert.doesNotMatch(sharedDocument, /正式对外发布前仍需 Owner 与适用的专业法律审查/);
  });

  it("separates browser data, Clerk identity, optional sync, disabled analytics, and future AI", async () => {
    const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    for (const required of [
      "浏览器本机",
      "Clerk",
      "Vercel Web Analytics",
      "已在代码、依赖和构建图中硬禁用",
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
