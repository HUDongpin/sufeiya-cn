import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  isClerkBetaProtectedPathname,
  isClerkProtectedPathname,
} from "../lib/auth/clerk-config";
import { CAPABILITY_MATRIX } from "../lib/capability-matrix";

describe("account data governance boundary", () => {
  it("keeps account cloud data protected but outside the invitation-learning gate", () => {
    assert.equal(isClerkProtectedPathname("/account/data"), true);
    assert.equal(isClerkBetaProtectedPathname("/account/data"), false);
  });

  it("renders only the blocked matrix state without service or localStorage access", async () => {
    const source = await readFile(new URL("../app/account/data/page.tsx", import.meta.url), "utf8");
    const capability = CAPABILITY_MATRIX.capabilities.find((entry) => entry.id === "optional_account_sync");
    assert.equal(capability?.status, "intentionally_blocked");
    assert.match(source, /CAPABILITY_MATRIX/);
    assert.match(source, /data-service-state="governance-hold"/);
    assert.match(source, /href="\/my-data"/);
    assert.doesNotMatch(source, /localStorage|fetch\(|api\.sufeiya\.cn\/v1|services\/sufeiya-api|infra\/alicloud/);
    for (const forbiddenControl of ["同步数据", "云端导出", "解除同步", "删除云端数据"]) {
      assert.equal(source.includes(`>${forbiddenControl}<`), false, forbiddenControl);
    }
  });
});
