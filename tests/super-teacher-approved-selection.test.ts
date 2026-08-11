import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ModelTeacherSelection, TeacherClaim } from "../lib/super-teacher/contracts";
import {
  materializeApprovedModelSelection,
  type ApprovedModelCatalog,
} from "../lib/super-teacher/responder";

const approvedClaim: TeacherClaim = {
  text: "当前计划重点来自学习者已经确认的本机摘要。",
  citations: [{
    id: "learner-local-plan",
    title: "用户设备提交的未签名 7 天计划摘要",
    href: "/plan",
    sourceClass: "learner_local_record",
  }],
};

const catalog: ApprovedModelCatalog = {
  headline: { id: "headline-1", text: "解释当前计划" },
  claims: [{ id: "claim-1", value: approvedClaim }],
  limitations: [{ id: "limitation-1", text: "计划不是成绩保证。" }],
  handoffRecommended: false,
};

describe("Sofia server-approved model selection", () => {
  it("materializes only exact server-authored claims and citations", () => {
    const selection: ModelTeacherSelection = {
      headlineId: "headline-1",
      claimIds: ["claim-1"],
      limitationIds: ["limitation-1"],
    };
    assert.deepEqual(materializeApprovedModelSelection(selection, catalog), {
      headline: catalog.headline.text,
      claims: [approvedClaim],
      limitations: [catalog.limitations[0]?.text],
      handoffRecommended: false,
    });
  });

  it("rejects missing, duplicate, and unapproved IDs instead of publishing free-form claims", () => {
    const invalidSelections = [
      { headlineId: "headline-1", claimIds: [], limitationIds: ["limitation-1"] },
      { headlineId: "headline-1", claimIds: ["claim-1", "claim-1"], limitationIds: ["limitation-1"] },
      { headlineId: "headline-1", claimIds: ["claim-2"], limitationIds: ["limitation-1"] },
      { headlineId: "headline-1", claimIds: ["claim-1"], limitationIds: ["limitation-2"] },
    ];
    for (const selection of invalidSelections) {
      assert.equal(
        materializeApprovedModelSelection(selection as ModelTeacherSelection, catalog),
        null,
      );
    }
  });
});
