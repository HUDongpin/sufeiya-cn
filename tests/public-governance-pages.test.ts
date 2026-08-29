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

  it("separates local data, paused identity, current hosting, disabled analytics, and unfinished migration", async () => {
    const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
    for (const required of [
      "浏览器本机",
      "Clerk",
      "Vercel Web Analytics",
      "已在代码、依赖和构建图中硬禁用",
      "阿里云",
      "Qwen",
      "当前规范 Production",
      "相关请求以 fail-closed 状态结束，不进入 Clerk",
      "Dr. Peter Hu",
      "SofiaTang2020",
      "权利请求",
      "数据投诉",
      "未满十四周岁",
    ]) {
      assert.ok(privacy.includes(required), required);
    }
  });

  it("publishes the designated rights channel without inventing a queue or credential intake", async () => {
    const [support, terms] = await Promise.all([
      readFile(new URL("../app/support/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    ]);
    assert.match(support, /没有自动客服或教师案例队列/);
    assert.match(support, /不会自动发送/);
    assert.match(support, /不要发送密码/);
    assert.match(support, /个人信息处理者及内部合规责任人为 <strong>Dr\. Peter Hu/);
    assert.match(support, /指定公开个人微信 <strong>SofiaTang2020/);
    assert.match(support, /收件、处理状态、拒绝理由（如有）和结案结果/);
    assert.match(terms, /迁移、备案、身份替换和独立回归完成前/);
    assert.match(terms, /不要继续使用旧邀请链接/);
  });

  it("keeps the account service intentionally blocked until the Mainland identity migration is accepted", () => {
    const capability = CAPABILITY_MATRIX.capabilities.find(
      (item) => item.id === "clerk_invite_account",
    );
    assert.equal(capability?.status, "intentionally_blocked");
    assert.equal(
      capability?.releaseGate,
      "server_student_data_processing",
    );
    assert.match(capability?.publicSummary ?? "", /迁往中国大陆阿里云并替换 Clerk/);
  });
});
