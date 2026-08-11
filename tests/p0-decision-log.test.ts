import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  P0_CANONICAL_DEFINITION_SET_SHA256,
  P0_CURRENT_LEDGER_SHA256,
  P0_DECISION_IDS,
  P0_DECISION_LOG,
  P0_PUBLISHED_BASELINE,
  P0_REQUIRED_DECISION_ROLES,
  P0_REQUIRED_DECISION_ROLE_POLICY_SHA256,
  type P0DecisionLog,
  computeP0DecisionEventSha256,
  computeP0DecisionLogContentSha256,
  computeP0DefinitionSetSha256,
  computeP0ItemDefinitionSha256,
  parseP0DecisionLog,
  summarizeP0DecisionLog,
  validateP0AppendOnlyRevision,
  validateP0DecisionLogAgainstPublishedBaseline,
} from "../lib/p0-decision-log";
import { releaseGovernanceSummary } from "../lib/release-governance";

const cloneLog = () => structuredClone(P0_DECISION_LOG);

const hashText = (value: string) => createHash("sha256").update(value).digest("hex");

function rehashLedger(candidate: P0DecisionLog) {
  candidate.ledgerContentSha256 = computeP0DecisionLogContentSha256(
    candidate as unknown as Record<string, unknown>,
  );
}

function rehashDefinitionSet(candidate: P0DecisionLog) {
  candidate.items.forEach((item) => {
    item.definitionSha256 = computeP0ItemDefinitionSha256(item);
  });
  candidate.canonicalDefinitionSetSha256 = computeP0DefinitionSetSha256(candidate.items);
}

function appendDecision(
  candidate: P0DecisionLog,
  itemIndex: number,
  outcome: "adopted" | "rejected" | "deferred" | "revoked" = "adopted",
) {
  const item = candidate.items[itemIndex];
  assert.ok(item);
  const requiredRoles = P0_REQUIRED_DECISION_ROLES[item.id as keyof typeof P0_REQUIRED_DECISION_ROLES];
  assert.ok(requiredRoles.length >= 2);
  const sequence = item.decisionHistory.length + 1;
  const prior = item.decisionHistory.at(-1);
  const decisionId = item.id + "__d" + String(sequence).padStart(4, "0");
  const evidenceReferenceIds = requiredRoles.map(
    (role) => "ev_" + String(item.order).padStart(2, "0") + "_" + String(sequence).padStart(2, "0") + "_" + role,
  );
  const decidedAt = sequence === 1
    ? "2026-08-11T00:01:00+08:00"
    : "2026-08-11T00:03:00+08:00";
  const reviewedAt = sequence === 1
    ? "2026-08-11T00:02:00+08:00"
    : "2026-08-11T00:04:00+08:00";
  const event: P0DecisionLog["items"][number]["decisionHistory"][number] = {
    id: decisionId,
    outcome,
    decisionSummary: "Recorded " + outcome + " decision for one fixed Appendix A item.",
    ownerRole: requiredRoles[0]!,
    backupOwnerRole: requiredRoles[1]!,
    decidedAt,
    evidenceReferenceIds,
    implementationImpact: "The outcome changes planning only and does not authorize a release surface.",
    implementationDueAt: "2026-08-20T23:59:59+08:00",
    reviewCondition: "Review when scope, evidence, supplier, policy, or implementation changes.",
    reviewDueAt: "2026-08-30T23:59:59+08:00",
    permittedImpactSurfaceIds: [],
    supersedesDecisionId: prior?.id ?? null,
    previousDecisionSha256: prior?.eventSha256 ?? null,
    eventSha256: "0".repeat(64),
  };
  event.eventSha256 = computeP0DecisionEventSha256(item.definitionSha256, event);
  requiredRoles.forEach((role, roleIndex) => {
    const evidenceId = evidenceReferenceIds[roleIndex]!;
    candidate.evidenceCatalog.push({
      id: evidenceId,
      kind: "owner_decision",
      verificationStatus: "verified_current",
      reviewedAt,
      reviewedByRole: role,
      contentSha256: hashText("signed-artifact:" + evidenceId),
      decisionBinding: {
        itemId: item.id,
        decisionId,
        outcome,
        decisionEventSha256: event.eventSha256,
      },
    });
  });
  item.decisionHistory.push(event);
}

function rehashItemDecisionChain(candidate: P0DecisionLog, itemIndex: number) {
  const item = candidate.items[itemIndex];
  assert.ok(item);
  item.decisionHistory.forEach((event, eventIndex) => {
    const prior = item.decisionHistory[eventIndex - 1];
    event.supersedesDecisionId = prior?.id ?? null;
    event.previousDecisionSha256 = prior?.eventSha256 ?? null;
    event.eventSha256 = computeP0DecisionEventSha256(item.definitionSha256, event);
    event.evidenceReferenceIds.forEach((evidenceId) => {
      const evidence = candidate.evidenceCatalog.find((entry) => entry.id === evidenceId);
      if (evidence?.kind === "owner_decision") {
        evidence.decisionBinding = {
          itemId: item.id,
          decisionId: event.id,
          outcome: event.outcome,
          decisionEventSha256: event.eventSha256,
        };
      }
    });
  });
}

describe("Appendix A P0 decision log", () => {
  it("binds exactly 29 source-labeled items to the reviewed plan and defaults every open item to deny", () => {
    const parsed = parseP0DecisionLog(P0_DECISION_LOG);
    assert.equal(parsed.protocolVersion, "sufeiya_p0_decision_log_v1");
    assert.equal(parsed.sourcePlan.contentSha256, "6ad237bf7433134961c2b4f9de4cb0f055391b9179e6b4632c269cdd84809169");
    assert.equal(parsed.sourcePlan.expectedItemCount, 29);
    assert.equal(parsed.defaultDisposition, "deny");
    assert.equal(parsed.authorityPolicy, "decision_log_never_authorizes_release_surfaces");
    assert.equal(parsed.guardrailTextPolicy, "conservative_source_paraphrase_never_a_meeting_outcome");
    assert.equal(parsed.ownerDecisionArtifactPolicy, "unique_artifact_per_item_role_event_until_signed_batch_manifest_v1");
    assert.equal(parsed.historyPolicy, "hash_chained_events_with_published_baseline");
    assert.equal(parsed.canonicalDefinitionSetSha256, P0_CANONICAL_DEFINITION_SET_SHA256);
    assert.equal(parsed.decisionRolePolicySha256, P0_REQUIRED_DECISION_ROLE_POLICY_SHA256);
    assert.equal(parsed.ledgerContentSha256, P0_CURRENT_LEDGER_SHA256);
    assert.equal(parsed.items.length, 29);
    assert.deepEqual(parsed.items.map((item) => item.id), [...P0_DECISION_IDS]);
    assert.deepEqual(parsed.items.map((item) => item.order), Array.from({ length: 29 }, (_, index) => index + 1));
    assert.equal(parsed.items[5]?.question, "声音/数字人");
    assert.equal(parsed.items[8]?.question, "学生评论/案例（部分已确认）");
    assert.equal(parsed.items[27]?.question, "Gate A / Gate B 与参考评分");
    assert.deepEqual(
      Object.fromEntries(
        ["A", "B", "C", "D", "E", "F"].map((section) => [
          section,
          parsed.items.filter((item) => item.section === section).length,
        ]),
      ),
      { A: 4, B: 6, C: 4, D: 6, E: 4, F: 5 },
    );
    assert.ok(parsed.items.every((item) => item.decisionHistory.length === 0));

    const summary = summarizeP0DecisionLog(parsed);
    assert.deepEqual(summary, {
      protocolVersion: "sufeiya_p0_decision_log_v1",
      status: "blocked",
      total: 29,
      resolved: 0,
      unresolved: 29,
      adopted: 0,
      rejected: 0,
      deferred: 0,
      revoked: 0,
      notApproved: 29,
      needsRenewal: 0,
      defaultDisposition: "deny",
      formalGate0Pass: false,
      releaseAuthorization: "separate_explicit_controls_required",
    });
  });

  it("rejects structural drift, altered guardrails or mappings, and non-RFC3339 timestamps", () => {
    assert.throws(
      () => parseP0DecisionLog({ ...cloneLog(), protocolVersion: "unversioned" }),
      /Invalid Sufeiya P0 decision log/,
    );
    assert.throws(
      () => parseP0DecisionLog({ ...cloneLog(), defaultDisposition: "allow" }),
      /Invalid Sufeiya P0 decision log/,
    );

    const wrongHash = cloneLog();
    wrongHash.sourcePlan.contentSha256 = "f".repeat(64) as typeof wrongHash.sourcePlan.contentSha256;
    rehashLedger(wrongHash);
    assert.throws(() => parseP0DecisionLog(wrongHash), /Invalid Sufeiya P0 decision log/);

    const missing = cloneLog();
    missing.items.pop();
    rehashLedger(missing);
    assert.throws(() => parseP0DecisionLog(missing), /Invalid Sufeiya P0 decision log/);

    const reordered = cloneLog();
    [reordered.items[0], reordered.items[1]] = [reordered.items[1]!, reordered.items[0]!];
    rehashLedger(reordered);
    assert.throws(() => parseP0DecisionLog(reordered), /Invalid Sufeiya P0 decision log/);

    const alteredGuardrail = cloneLog();
    alteredGuardrail.items[0]!.operationalGuardrail = "Open all production features immediately.";
    rehashDefinitionSet(alteredGuardrail);
    rehashLedger(alteredGuardrail);
    assert.notEqual(alteredGuardrail.canonicalDefinitionSetSha256, P0_CANONICAL_DEFINITION_SET_SHA256);
    assert.throws(() => parseP0DecisionLog(alteredGuardrail), /Invalid Sufeiya P0 decision log/);

    const remapped = cloneLog();
    remapped.items[0]!.relatedReleaseControlIds = ["voice_data_flow"];
    rehashDefinitionSet(remapped);
    rehashLedger(remapped);
    assert.throws(() => parseP0DecisionLog(remapped), /Invalid Sufeiya P0 decision log/);

    for (const invalidTimestamp of [
      "2026-08-11",
      "2026-08-11T00:00:00",
      "2026-02-30T00:00:00+08:00",
      "2026-08-11T24:00:00+08:00",
      "2026-08-11T00:00:00+14:30",
      "2026-08-11T00:00:00-00:00",
    ]) {
      const invalid = cloneLog();
      invalid.effectiveAt = invalidTimestamp;
      rehashLedger(invalid);
      assert.throws(() => parseP0DecisionLog(invalid), /Invalid Sufeiya P0 decision log/);
    }
  });

  it("accepts one fully item-bound, outcome-bound, role-separated event without changing release authority", () => {
    const candidate = cloneLog();
    appendDecision(candidate, 0, "adopted");
    rehashLedger(candidate);
    const releaseBefore = releaseGovernanceSummary();
    const parsed = parseP0DecisionLog(candidate);
    const releaseAfter = releaseGovernanceSummary();

    assert.equal(parsed.items[0]?.decisionHistory[0]?.outcome, "adopted");
    assert.deepEqual(releaseAfter, releaseBefore);
    const summary = summarizeP0DecisionLog(parsed, Date.parse("2026-08-12T00:00:00+08:00"));
    assert.equal(summary.resolved, 1);
    assert.equal(summary.adopted, 1);
    assert.equal(summary.unresolved, 28);
    assert.equal(summary.status, "blocked");
    assert.equal(summary.formalGate0Pass, false);
  });

  it("rejects generic overall approval, cross-item evidence reuse, missing roles, and weak evidence", () => {
    const generic = cloneLog();
    appendDecision(generic, 0);
    const firstEvent = generic.items[0]!.decisionHistory[0]!;
    const firstEvidence = generic.evidenceCatalog[0]!;
    generic.evidenceCatalog = [{
      ...firstEvidence,
      id: "generic_project_approval",
      reviewedByRole: "project_owner",
      decisionBinding: null,
    }];
    firstEvent.evidenceReferenceIds = ["generic_project_approval"];
    firstEvent.eventSha256 = computeP0DecisionEventSha256(generic.items[0]!.definitionSha256, firstEvent);
    rehashLedger(generic);
    assert.throws(() => parseP0DecisionLog(generic), /Invalid Sufeiya P0 decision log/);

    const reused = cloneLog();
    appendDecision(reused, 0);
    appendDecision(reused, 1);
    const firstEvidenceIds = [...reused.items[0]!.decisionHistory[0]!.evidenceReferenceIds];
    const secondEvent = reused.items[1]!.decisionHistory[0]!;
    secondEvent.evidenceReferenceIds = firstEvidenceIds;
    secondEvent.eventSha256 = computeP0DecisionEventSha256(reused.items[1]!.definitionSha256, secondEvent);
    rehashLedger(reused);
    assert.throws(() => parseP0DecisionLog(reused), /Invalid Sufeiya P0 decision log/);

    const missingRole = cloneLog();
    appendDecision(missingRole, 10);
    const c1Event = missingRole.items[10]!.decisionHistory[0]!;
    const measurementEvidenceId = c1Event.evidenceReferenceIds.find((id) => id.endsWith("measurement_review_owner"));
    assert.ok(measurementEvidenceId);
    c1Event.evidenceReferenceIds = c1Event.evidenceReferenceIds.filter((id) => id !== measurementEvidenceId);
    c1Event.eventSha256 = computeP0DecisionEventSha256(missingRole.items[10]!.definitionSha256, c1Event);
    c1Event.evidenceReferenceIds.forEach((id) => {
      const evidence = missingRole.evidenceCatalog.find((entry) => entry.id === id);
      if (evidence?.decisionBinding) evidence.decisionBinding.decisionEventSha256 = c1Event.eventSha256;
    });
    rehashLedger(missingRole);
    assert.throws(() => parseP0DecisionLog(missingRole), /Invalid Sufeiya P0 decision log/);

    const pendingEvidence = cloneLog();
    appendDecision(pendingEvidence, 0);
    pendingEvidence.evidenceCatalog[0]!.verificationStatus = "pending_review";
    rehashLedger(pendingEvidence);
    assert.throws(() => parseP0DecisionLog(pendingEvidence), /Invalid Sufeiya P0 decision log/);

    const noArtifactDigest = cloneLog();
    appendDecision(noArtifactDigest, 0);
    noArtifactDigest.evidenceCatalog[0]!.contentSha256 = null as unknown as string;
    rehashLedger(noArtifactDigest);
    assert.throws(() => parseP0DecisionLog(noArtifactDigest), /Invalid Sufeiya P0 decision log/);

    const copiedOverallArtifact = cloneLog();
    copiedOverallArtifact.registerStatus = "decision_complete";
    copiedOverallArtifact.items.forEach((_, index) => appendDecision(copiedOverallArtifact, index, "adopted"));
    const overallApprovalHash = hashText("Project approved overall; no item-level outcomes.");
    copiedOverallArtifact.evidenceCatalog.forEach((evidence) => {
      evidence.contentSha256 = overallApprovalHash;
    });
    rehashLedger(copiedOverallArtifact);
    assert.equal(new Set(copiedOverallArtifact.evidenceCatalog.map((evidence) => evidence.contentSha256)).size, 1);
    assert.throws(() => parseP0DecisionLog(copiedOverallArtifact), /Invalid Sufeiya P0 decision log/);
  });

  it("rejects unsafe ownership, broken event digests, and invalid hash-chain chronology", () => {
    const sameOwner = cloneLog();
    appendDecision(sameOwner, 0);
    sameOwner.items[0]!.decisionHistory[0]!.backupOwnerRole = sameOwner.items[0]!.decisionHistory[0]!.ownerRole;
    rehashItemDecisionChain(sameOwner, 0);
    rehashLedger(sameOwner);
    assert.throws(() => parseP0DecisionLog(sameOwner), /Invalid Sufeiya P0 decision log/);

    const badDigest = cloneLog();
    appendDecision(badDigest, 0);
    badDigest.items[0]!.decisionHistory[0]!.eventSha256 = "f".repeat(64);
    rehashLedger(badDigest);
    assert.throws(() => parseP0DecisionLog(badDigest), /Invalid Sufeiya P0 decision log/);

    const badRevision = cloneLog();
    appendDecision(badRevision, 0);
    appendDecision(badRevision, 0, "rejected");
    badRevision.items[0]!.decisionHistory[1]!.previousDecisionSha256 = "f".repeat(64);
    badRevision.items[0]!.decisionHistory[1]!.eventSha256 = computeP0DecisionEventSha256(
      badRevision.items[0]!.definitionSha256,
      badRevision.items[0]!.decisionHistory[1]!,
    );
    rehashLedger(badRevision);
    assert.throws(() => parseP0DecisionLog(badRevision), /Invalid Sufeiya P0 decision log/);

    const badReview = cloneLog();
    appendDecision(badReview, 0);
    badReview.items[0]!.decisionHistory[0]!.reviewDueAt = "2026-08-10T00:00:00+08:00";
    rehashItemDecisionChain(badReview, 0);
    rehashLedger(badReview);
    assert.throws(() => parseP0DecisionLog(badReview), /Invalid Sufeiya P0 decision log/);
  });

  it("requires all 29 current outcomes before decision-complete while never granting formal Gate 0 or release", () => {
    const complete = cloneLog();
    complete.registerStatus = "decision_complete";
    complete.items.forEach((_, index) => appendDecision(complete, index, index % 2 === 0 ? "adopted" : "rejected"));
    rehashLedger(complete);
    const parsed = parseP0DecisionLog(complete);
    const currentSummary = summarizeP0DecisionLog(parsed, Date.parse("2026-08-12T00:00:00+08:00"));
    assert.equal(currentSummary.status, "decision_complete");
    assert.equal(currentSummary.resolved, 29);
    assert.equal(currentSummary.unresolved, 0);
    assert.equal(currentSummary.formalGate0Pass, false);
    assert.equal(currentSummary.releaseAuthorization, "separate_explicit_controls_required");

    const expiredSummary = summarizeP0DecisionLog(parsed, Date.parse("2026-08-31T00:00:00+08:00"));
    assert.equal(expiredSummary.status, "blocked");
    assert.equal(expiredSummary.needsRenewal, 29);
    assert.equal(expiredSummary.resolved, 0);

    const deferred = cloneLog();
    deferred.registerStatus = "decision_complete";
    deferred.items.forEach((_, index) => appendDecision(deferred, index, index === 28 ? "deferred" : "adopted"));
    rehashLedger(deferred);
    const deferredSummary = summarizeP0DecisionLog(
      parseP0DecisionLog(deferred),
      Date.parse("2026-08-12T00:00:00+08:00"),
    );
    assert.equal(deferredSummary.status, "blocked");
    assert.equal(deferredSummary.resolved, 28);
    assert.equal(deferredSummary.deferred, 1);
  });

  it("seals the published baseline and rejects cross-revision deletion or replacement", () => {
    assert.equal(
      validateP0DecisionLogAgainstPublishedBaseline(P0_DECISION_LOG, P0_PUBLISHED_BASELINE),
      P0_DECISION_LOG,
    );

    const sameRevisionDrift = cloneLog();
    appendDecision(sameRevisionDrift, 0);
    rehashLedger(sameRevisionDrift);
    assert.throws(
      () => validateP0DecisionLogAgainstPublishedBaseline(parseP0DecisionLog(sameRevisionDrift), P0_PUBLISHED_BASELINE),
      /published-baseline ledger digest/,
    );

    const previous = cloneLog();
    appendDecision(previous, 0);
    rehashLedger(previous);
    const next = structuredClone(previous);
    next.ledgerRevision = previous.ledgerRevision + 1;
    next.previousLedgerSha256 = previous.ledgerContentSha256;
    appendDecision(next, 0, "rejected");
    rehashLedger(next);
    assert.equal(validateP0AppendOnlyRevision(previous, next).ledgerRevision, 2);

    const tampered = structuredClone(next);
    tampered.items[0]!.decisionHistory[0]!.decisionSummary = "Rewritten historical decision.";
    rehashItemDecisionChain(tampered, 0);
    rehashLedger(tampered);
    assert.doesNotThrow(() => parseP0DecisionLog(tampered));
    assert.throws(() => validateP0AppendOnlyRevision(previous, tampered), /append-only (?:evidence|decision) history/);
  });

  it("deep-freezes the canonical ledger, baseline, IDs, and role-separation policy", () => {
    assert.equal(Object.isFrozen(P0_DECISION_LOG), true);
    assert.equal(Object.isFrozen(P0_DECISION_LOG.items), true);
    assert.equal(Object.isFrozen(P0_DECISION_LOG.items[0]), true);
    assert.equal(Object.isFrozen(P0_DECISION_LOG.items[0]?.decisionHistory), true);
    assert.equal(Object.isFrozen(P0_PUBLISHED_BASELINE), true);
    assert.equal(Object.isFrozen(P0_DECISION_IDS), true);
    assert.equal(Object.isFrozen(P0_REQUIRED_DECISION_ROLES), true);
    assert.equal(Object.isFrozen(P0_REQUIRED_DECISION_ROLES.p0_c01_diagnostic_scope_item_approval), true);
    assert.throws(() => {
      P0_DECISION_LOG.items[0]!.decisionDueAt = "2026-08-20T00:00:00+08:00";
    }, TypeError);
    assert.equal(summarizeP0DecisionLog().unresolved, 29);
  });
});
