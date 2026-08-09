import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkSuperTeacherRateLimit } from "../lib/super-teacher/rate-limit";

describe("Sofia authenticated-user rate limit", () => {
  it("allows eight requests per Clerk subject and rejects the ninth", () => {
    const subject = `user_test_primary_${process.pid}`;
    const results = Array.from({ length: 9 }, () => checkSuperTeacherRateLimit(subject));

    assert.deepEqual(results.slice(0, 8).map((result) => result.allowed), Array(8).fill(true));
    assert.equal(results[8]?.allowed, false);
    assert.equal(results[8]?.remaining, 0);
  });

  it("keeps a different authenticated subject in a separate bucket", () => {
    const result = checkSuperTeacherRateLimit(`user_test_secondary_${process.pid}`);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 7);
  });
});
