import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import preparationAgendaJson from "../data/p0-decision-preparation-agenda.v1.json";
import {
  P0_PREPARATION_AGENDA_PROTOCOL,
  P0_PREPARATION_AGENDA_SHA256,
  P0_PREPARATION_ITEM_COUNT,
  P0_PREPARATION_PROTOCOL,
  P0_PREPARATION_STATUS,
  type P0DecisionPreparationItem,
  type P0DecisionPreparationPack,
  type P0PreparationDraftInput,
  canonicalPreparationJson,
  createP0DecisionPreparationPack,
  deriveP0PreparationState,
  inspectP0DecisionPreparationPack,
  parseP0DecisionPreparationPack,
  parseP0PreparationAgenda,
  serializeP0DecisionPreparationPack,
  sha256PreparationValue,
  summarizeP0PreparationItems,
  updateP0DecisionPreparationPack,
} from "../lib/p0-decision-preparation";
import {
  P0_CANONICAL_DEFINITION_SET_SHA256,
  P0_CURRENT_LEDGER_SHA256,
  P0_DECISION_IDS,
  P0_DECISION_LOG,
  P0_OWNER_ROLES,
  P0_REQUIRED_DECISION_ROLE_POLICY_SHA256,
  P0_REQUIRED_DECISION_ROLES,
  summarizeP0DecisionLog,
} from "../lib/p0-decision-log";
import {
  APPROVED_PLAN_SHA256,
  RELEASE_SURFACES,
  releaseGovernanceSummary,
} from "../lib/release-governance";

const GENERATED_AT = "2026-08-11T12:00:00+08:00";
const UPDATED_AT = "2026-08-11T13:00:00+08:00";
const PACK_ID = "123e4567-e89b-42d3-a456-426614174000";

function initialPack() {
  return createP0DecisionPreparationPack({ generatedAt: GENERATED_AT, packId: PACK_ID });
}

function contentWithoutDigest(pack: P0DecisionPreparationPack): Record<string, unknown> {
  const content = structuredClone(pack) as unknown as Record<string, unknown>;
  delete content.contentSha256;
  return content;
}

function rehashPack(pack: P0DecisionPreparationPack) {
  pack.contentSha256 = sha256PreparationValue(contentWithoutDigest(pack));
}

function completeDraftFor(
  item: P0DecisionPreparationItem,
  itemIndex: number,
): P0PreparationDraftInput {
  const primary = item.agenda.requiredRoles[0];
  const backup = item.agenda.requiredRoles[1];
  assert.ok(primary);
  assert.ok(backup);
  return {
    proposedDisposition: itemIndex % 3 === 0
      ? "propose_adopt"
      : itemIndex % 3 === 1
        ? "propose_reject"
        : "propose_defer",
    decisionSummaryDraft: `Meeting preparation draft for Appendix A item ${itemIndex + 1}; this is not a signed decision.`,
    proposedPrimaryResponsibleRole: primary,
    proposedBackupResponsibleRole: backup,
    roleReviewSlots: item.agenda.requiredRoles.map((role) => ({
      role,
      candidateEvidenceReferenceId: `prep_ev_${String(itemIndex + 1).padStart(2, "0")}_${role}`,
      verificationState: "awaiting_role_material",
    })),
    additionalEvidenceReferenceIds: [],
    implementationImpactDraft: `Planning impact draft for item ${itemIndex + 1}; no runtime or release authority is granted.`,
    implementationDueDateDraft: "2026-08-20",
    reviewConditionDraft: `Review the written role evidence and implementation boundary for item ${itemIndex + 1}.`,
    reviewDueDateDraft: "2026-08-30",
    proposedPermittedImpactSurfaceIds: [],
    meetingNotesDraft: "Meeting preparation only; owner and required roles must review the material.",
  };
}

function completePack() {
  const pack = initialPack();
  return updateP0DecisionPreparationPack({
    pack,
    updates: pack.items.map((item, itemIndex) => ({
      itemId: item.agenda.itemId,
      draft: completeDraftFor(item, itemIndex),
    })),
    updatedAt: UPDATED_AT,
  });
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    keys.add(key);
    collectKeys(nested, keys);
  });
  return keys;
}

describe("Gate 0 P0 decision preparation pack", () => {
  it("round-trips the generator and validator without network or browser persistence capability", () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "sufeiya-p0-prep-test-"));
    const outputDirectory = path.join(temporaryRoot, "generated");
    const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    try {
      const generation = spawnSync(process.execPath, [
        tsxCli,
        path.join(process.cwd(), "scripts", "generate-p0-decision-preparation.ts"),
        "--output-dir",
        outputDirectory,
      ], { encoding: "utf8" });
      assert.equal(generation.status, 0, generation.stderr);
      const receipt = JSON.parse(generation.stdout) as {
        formalResolved: number;
        draftFieldsComplete: number;
        jsonPath: string;
        htmlPath: string;
      };
      assert.equal(receipt.formalResolved, 0);
      assert.equal(receipt.draftFieldsComplete, 0);
      assert.equal(path.dirname(receipt.jsonPath), outputDirectory);
      assert.equal(path.dirname(receipt.htmlPath), outputDirectory);
      assert.deepEqual(
        readdirSync(outputDirectory).sort(),
        [path.basename(receipt.htmlPath), path.basename(receipt.jsonPath)].sort(),
      );

      const html = readFileSync(receipt.htmlPath, "utf8");
      assert.equal(html.includes("__P0_INITIAL_PACK_JSON__"), false);
      assert.match(html, /connect-src 'none'/);
      assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB)\b/);
      assert.match(html, /function strictRfc3339\(value\)/);
      assert.match(html, /exactKeys\(item, itemKeys\)/);
      assert.match(html, /currentBindingDriftReasons\(pack\)/);
      assert.match(html, /#digest-display\s*\{[\s\S]*?word-break:\s*break-all/);

      const validation = spawnSync(process.execPath, [
        tsxCli,
        path.join(process.cwd(), "scripts", "validate-p0-decision-preparation.ts"),
        receipt.jsonPath,
      ], { encoding: "utf8" });
      assert.equal(validation.status, 0, validation.stderr);
      const validationReceipt = JSON.parse(validation.stdout) as {
        validUnsignedIntegrity: boolean;
        currentBindingStatus: string;
        summary: { formalResolved: number; draftFieldsComplete: number };
        authorityBoundary: Record<string, boolean>;
      };
      assert.equal(validationReceipt.validUnsignedIntegrity, true);
      assert.equal(validationReceipt.currentBindingStatus, "current");
      assert.equal(validationReceipt.summary.formalResolved, 0);
      assert.equal(validationReceipt.summary.draftFieldsComplete, 0);
      assert.ok(Object.values(validationReceipt.authorityBoundary).every((value) => value === false));

      const noOverwrite = spawnSync(process.execPath, [
        tsxCli,
        path.join(process.cwd(), "scripts", "generate-p0-decision-preparation.ts"),
        "--output-dir",
        outputDirectory,
      ], { encoding: "utf8" });
      assert.equal(noOverwrite.status, 1);
      assert.match(noOverwrite.stderr, /EEXIST|already exists/i);
      assert.equal(readdirSync(outputDirectory).length, 2);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("preserves all 29 Appendix A items in canonical order and never treats a default suggestion as a meeting outcome", () => {
    const agenda = parseP0PreparationAgenda(preparationAgendaJson);
    const pack = initialPack();

    assert.equal(agenda.protocolVersion, P0_PREPARATION_AGENDA_PROTOCOL);
    assert.equal(agenda.sourcePlanSha256, APPROVED_PLAN_SHA256);
    assert.equal(agenda.sourceAppendix, "A");
    assert.deepEqual(agenda.sourcePages, [17, 18, 19]);
    assert.equal(agenda.suggestionAuthority, "approved_plan_default_suggestion_not_a_meeting_outcome");
    assert.equal(sha256PreparationValue(agenda), P0_PREPARATION_AGENDA_SHA256);
    assert.equal(agenda.items.length, P0_PREPARATION_ITEM_COUNT);
    assert.deepEqual(agenda.items.map((item) => item.itemId), [...P0_DECISION_IDS]);

    assert.equal(pack.protocolVersion, P0_PREPARATION_PROTOCOL);
    assert.equal(pack.status, P0_PREPARATION_STATUS);
    assert.equal(pack.items.length, P0_PREPARATION_ITEM_COUNT);
    assert.deepEqual(pack.items.map((item) => item.agenda.itemId), [...P0_DECISION_IDS]);
    assert.deepEqual(
      pack.items.map((item) => item.agenda.order),
      Array.from({ length: P0_PREPARATION_ITEM_COUNT }, (_, index) => index + 1),
    );
    assert.ok(pack.items.every((item) => item.agenda.defaultSuggestion.length > 0));
    assert.ok(pack.items.every(
      (item) => item.agenda.defaultSuggestionAuthority === "approved_plan_default_suggestion_not_a_meeting_outcome",
    ));
    assert.ok(pack.items.every((item) => item.draft.preparationState === "empty"));
    assert.ok(pack.items.every((item) => item.draft.proposedDisposition === "undecided"));
    assert.ok(pack.items.every((item) => item.draft.decisionSummaryDraft === ""));
    assert.ok(pack.items.every((item) => item.draft.decisionSummaryDraft !== item.agenda.defaultSuggestion));
    assert.deepEqual(pack.summary, {
      total: 29,
      empty: 29,
      drafting: 0,
      draftFieldsComplete: 0,
      formalResolved: 0,
    });
  });

  it("starts with zero formal decisions and fixes every authority boundary to false", () => {
    const pack = initialPack();
    const canonicalSummary = summarizeP0DecisionLog();

    assert.equal(pack.summary.formalResolved, 0);
    assert.equal(canonicalSummary.resolved, 0);
    assert.equal(canonicalSummary.unresolved, 29);
    assert.equal(canonicalSummary.formalGate0Pass, false);
    assert.deepEqual(pack.authorityBoundary, {
      formalAuthority: false,
      staffIdentityVerified: false,
      reviewerQualificationVerified: false,
      canonicalLedgerWrite: false,
      releaseAuthorization: false,
      formalGate0Pass: false,
    });
    assert.ok(Object.values(pack.authorityBoundary).every((value) => value === false));
    assert.deepEqual(pack.integrityBoundary, {
      algorithm: "sha256",
      authority: "unsigned_self_digest_integrity_only_not_identity_or_approval",
    });
    assert.ok(P0_DECISION_LOG.items.every((item) => item.decisionHistory.length === 0));
  });

  it("binds the approved plan, canonical definitions, role policy, ledger, item definitions, and pack digest", () => {
    const pack = parseP0DecisionPreparationPack(initialPack());

    assert.deepEqual(pack.base, {
      sourcePlanSha256: APPROVED_PLAN_SHA256,
      canonicalDefinitionSetSha256: P0_CANONICAL_DEFINITION_SET_SHA256,
      decisionRolePolicySha256: P0_REQUIRED_DECISION_ROLE_POLICY_SHA256,
      ledgerRevision: P0_DECISION_LOG.ledgerRevision,
      ledgerContentSha256: P0_CURRENT_LEDGER_SHA256,
    });
    pack.items.forEach((item, index) => {
      const canonical = P0_DECISION_LOG.items[index];
      assert.ok(canonical);
      assert.equal(item.agenda.itemId, canonical.id);
      assert.equal(item.agenda.itemDefinitionSha256, canonical.definitionSha256);
      assert.deepEqual(item.agenda.sourcePages, canonical.sourcePages);
      assert.deepEqual(
        item.agenda.requiredRoles,
        P0_REQUIRED_DECISION_ROLES[canonical.id as keyof typeof P0_REQUIRED_DECISION_ROLES],
      );
      assert.deepEqual(
        item.draft.roleReviewSlots.map((slot) => slot.role),
        item.agenda.requiredRoles,
      );
    });
    assert.equal(pack.contentSha256, sha256PreparationValue(contentWithoutDigest(pack)));
  });

  it("matches the browser WebCrypto digest and classifies intact old bindings as stale rather than authoritative", async () => {
    const pack = initialPack();
    const digestBytes = await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalPreparationJson(contentWithoutDigest(pack))),
    );
    assert.equal(Buffer.from(digestBytes).toString("hex"), pack.contentSha256);

    const oldBinding = structuredClone(pack);
    oldBinding.base.ledgerRevision += 1;
    oldBinding.base.ledgerContentSha256 = "f".repeat(64);
    rehashPack(oldBinding);
    const inspection = inspectP0DecisionPreparationPack(oldBinding);
    assert.equal(inspection.currentBindingStatus, "stale");
    assert.deepEqual(inspection.staleReasons, ["ledger_revision", "ledger_content_sha256"]);
    assert.throws(() => parseP0DecisionPreparationPack(oldBinding), /pack at base/);

    const oldAgenda = structuredClone(pack);
    oldAgenda.items[0]!.agenda.question = "历史完整包中的旧版问题定义";
    rehashPack(oldAgenda);
    const oldAgendaInspection = inspectP0DecisionPreparationPack(oldAgenda);
    assert.equal(oldAgendaInspection.currentBindingStatus, "stale");
    assert.deepEqual(oldAgendaInspection.staleReasons, ["item_1_agenda"]);
    assert.throws(() => parseP0DecisionPreparationPack(oldAgenda), /pack at base/);
  });

  it("rejects unknown fields at every object boundary and requires strict RFC 3339 timestamps", () => {
    const unknownFieldMutations: Array<(pack: P0DecisionPreparationPack) => void> = [
      (pack) => { (pack as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.integrityBoundary as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.authorityBoundary as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.base as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.items[0] as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.items[0]!.agenda as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => { (pack.items[0]!.draft as unknown as Record<string, unknown>).unexpected = true; },
      (pack) => {
        (pack.items[0]!.draft.roleReviewSlots[0] as unknown as Record<string, unknown>).unexpected = true;
      },
      (pack) => { (pack.summary as unknown as Record<string, unknown>).unexpected = true; },
    ];
    unknownFieldMutations.forEach((mutate) => {
      const candidate = structuredClone(initialPack());
      mutate(candidate);
      rehashPack(candidate);
      assert.throws(
        () => inspectP0DecisionPreparationPack(candidate),
        /Invalid Sufeiya P0 decision preparation pack integrity/,
      );
    });

    for (const generatedAt of [
      "2026-08-11",
      "2026-08-11T12:00Z",
      "2026-08-11T12:00:00-00:00",
      "2026-02-30T12:00:00Z",
      "2026-08-11T12:00:00+14:01",
    ]) {
      const candidate = structuredClone(initialPack());
      candidate.generatedAt = generatedAt;
      rehashPack(candidate);
      assert.throws(
        () => inspectP0DecisionPreparationPack(candidate),
        /Invalid Sufeiya P0 decision preparation pack integrity at generatedAt/,
      );
    }
  });

  it("rejects re-signed canonical agenda drift and any stale or forged pack digest", () => {
    const reorderedAgenda = structuredClone(preparationAgendaJson);
    [reorderedAgenda.items[0], reorderedAgenda.items[1]] = [reorderedAgenda.items[1]!, reorderedAgenda.items[0]!];
    assert.throws(() => parseP0PreparationAgenda(reorderedAgenda), /Invalid Sufeiya P0 preparation agenda/);
    assert.throws(
      () => parseP0PreparationAgenda({
        ...preparationAgendaJson,
        suggestionAuthority: "meeting_outcome",
      }),
      /Invalid Sufeiya P0 preparation agenda/,
    );
    const alteredSuggestion = structuredClone(preparationAgendaJson);
    alteredSuggestion.items[0]!.defaultSuggestion = "把所有能力视为已经批准。";
    assert.throws(
      () => parseP0PreparationAgenda(alteredSuggestion),
      /Invalid Sufeiya P0 preparation agenda at contentSha256/,
    );

    const mutations: Array<(pack: P0DecisionPreparationPack) => void> = [
      (pack) => {
        [pack.items[0], pack.items[1]] = [pack.items[1]!, pack.items[0]!];
      },
      (pack) => {
        pack.items[0]!.agenda.question = "Altered question that is not in Appendix A.";
      },
      (pack) => {
        pack.items[0]!.agenda.defaultSuggestion = "Treat this draft suggestion as a final approval.";
      },
      (pack) => {
        pack.items[0]!.agenda.operationalGuardrail = "Open every release surface.";
      },
      (pack) => {
        pack.items[0]!.agenda.itemDefinitionSha256 = "f".repeat(64);
      },
      (pack) => {
        (pack.base as unknown as { ledgerContentSha256: string }).ledgerContentSha256 = "f".repeat(64);
      },
    ];
    for (const mutate of mutations) {
      const tampered = structuredClone(initialPack());
      mutate(tampered);
      rehashPack(tampered);
      assert.throws(
        () => parseP0DecisionPreparationPack(tampered),
        /Invalid Sufeiya P0 decision preparation pack/,
      );
    }

    const staleDigest = structuredClone(initialPack());
    staleDigest.items[0]!.draft.meetingNotesDraft = "Changed without recomputing the pack digest.";
    assert.throws(
      () => parseP0DecisionPreparationPack(staleDigest),
      /Invalid Sufeiya P0 decision preparation pack/,
    );

    const forgedDigest = structuredClone(initialPack());
    forgedDigest.contentSha256 = "f".repeat(64);
    assert.throws(
      () => parseP0DecisionPreparationPack(forgedDigest),
      /Invalid Sufeiya P0 decision preparation pack/,
    );
  });

  it("enforces exact role slots and unique evidence references across all 29 items", () => {
    const pack = initialPack();
    const firstDraft = completeDraftFor(pack.items[0]!, 0);
    const reversedSlots = [...firstDraft.roleReviewSlots].reverse();
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{
          itemId: pack.items[0]!.agenda.itemId,
          draft: { ...firstDraft, roleReviewSlots: reversedSlots },
        }],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 decision preparation pack/,
    );

    const first = completeDraftFor(pack.items[0]!, 0);
    const second = completeDraftFor(pack.items[1]!, 1);
    const reusedEvidenceId = first.roleReviewSlots[0]!.candidateEvidenceReferenceId;
    assert.ok(reusedEvidenceId);
    second.roleReviewSlots[0] = {
      ...second.roleReviewSlots[0]!,
      candidateEvidenceReferenceId: reusedEvidenceId,
    };
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [
          { itemId: pack.items[0]!.agenda.itemId, draft: first },
          { itemId: pack.items[1]!.agenda.itemId, draft: second },
        ],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 decision preparation pack/,
    );
  });

  it("keeps unsafe primary/backup choices and date order in drafting instead of accepting a false complete state", () => {
    const pack = initialPack();
    const item = pack.items[0]!;

    const sameOwnerDraft = completeDraftFor(item, 0);
    sameOwnerDraft.proposedBackupResponsibleRole = sameOwnerDraft.proposedPrimaryResponsibleRole;
    const sameOwner = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: item.agenda.itemId, draft: sameOwnerDraft }],
      updatedAt: UPDATED_AT,
    });
    assert.equal(sameOwner.items[0]!.draft.preparationState, "drafting");
    assert.equal(deriveP0PreparationState(sameOwner.items[0]!), "drafting");
    assert.deepEqual(sameOwner.summary, {
      total: 29,
      empty: 28,
      drafting: 1,
      draftFieldsComplete: 0,
      formalResolved: 0,
    });

    const unauthorizedRole = P0_OWNER_ROLES.find((role) => !item.agenda.requiredRoles.includes(role));
    assert.ok(unauthorizedRole);
    const unauthorizedDraft = completeDraftFor(item, 0);
    unauthorizedDraft.proposedPrimaryResponsibleRole = unauthorizedRole;
    const unauthorized = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: item.agenda.itemId, draft: unauthorizedDraft }],
      updatedAt: UPDATED_AT,
    });
    assert.equal(unauthorized.items[0]!.draft.preparationState, "drafting");

    const reversedDatesDraft = completeDraftFor(item, 0);
    reversedDatesDraft.implementationDueDateDraft = "2026-08-30";
    reversedDatesDraft.reviewDueDateDraft = "2026-08-20";
    const reversedDates = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: item.agenda.itemId, draft: reversedDatesDraft }],
      updatedAt: UPDATED_AT,
    });
    assert.equal(reversedDates.items[0]!.draft.preparationState, "drafting");

    const invalidCalendarDate = completeDraftFor(item, 0);
    invalidCalendarDate.implementationDueDateDraft = "2026-02-30";
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: item.agenda.itemId, draft: invalidCalendarDate }],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 preparation update/,
    );

    const overdueDraft = completeDraftFor(item, 0);
    overdueDraft.implementationDueDateDraft = "2020-01-01";
    overdueDraft.reviewDueDateDraft = "2020-01-02";
    const overdue = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: item.agenda.itemId, draft: overdueDraft }],
      updatedAt: UPDATED_AT,
    });
    assert.equal(overdue.items[0]!.draft.preparationState, "drafting");

    const tooManyEvidenceReferences = completeDraftFor(item, 0);
    const extraCount = 13 - tooManyEvidenceReferences.roleReviewSlots.length;
    tooManyEvidenceReferences.additionalEvidenceReferenceIds = Array.from(
      { length: extraCount },
      (_, index) => `prep_ev_extra_${index + 1}`,
    );
    const tooMany = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: item.agenda.itemId, draft: tooManyEvidenceReferences }],
      updatedAt: UPDATED_AT,
    });
    assert.equal(tooMany.items[0]!.draft.preparationState, "drafting");

    const oldProtocolEvidenceId = completeDraftFor(item, 0);
    oldProtocolEvidenceId.roleReviewSlots[0]!.candidateEvidenceReferenceId = "ev_old_protocol";
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: item.agenda.itemId, draft: oldProtocolEvidenceId }],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 preparation update/,
    );

    const overlongSummary = completeDraftFor(item, 0);
    overlongSummary.decisionSummaryDraft = "a".repeat(801);
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: item.agenda.itemId, draft: overlongSummary }],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 preparation update/,
    );
  });

  it("rejects future or retrograde pack timestamps and unsafe control characters", () => {
    assert.throws(
      () => createP0DecisionPreparationPack({
        generatedAt: "2999-01-01T00:00:00Z",
        packId: PACK_ID,
      }),
      /Invalid Sufeiya P0 decision preparation pack/,
    );

    const pack = initialPack();
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: pack.items[0]!.agenda.itemId, draft: completeDraftFor(pack.items[0]!, 0) }],
        updatedAt: "2999-01-01T00:00:00Z",
      }),
      /Invalid Sufeiya P0 decision preparation pack/,
    );
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: pack.items[0]!.agenda.itemId, draft: completeDraftFor(pack.items[0]!, 0) }],
        updatedAt: "2026-08-11T11:59:59+08:00",
      }),
      /timestamp must advance/,
    );
    const revisionTwo = updateP0DecisionPreparationPack({
      pack,
      updates: [{ itemId: pack.items[0]!.agenda.itemId, draft: completeDraftFor(pack.items[0]!, 0) }],
      updatedAt: UPDATED_AT,
    });
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack: revisionTwo,
        updates: [{ itemId: pack.items[0]!.agenda.itemId, draft: completeDraftFor(pack.items[0]!, 0) }],
        updatedAt: "2026-08-11T12:30:00+08:00",
      }),
      /timestamp must advance/,
    );

    const unsafeDraft = completeDraftFor(pack.items[0]!, 0);
    unsafeDraft.meetingNotesDraft = "Unsafe embedded control character:\u0000";
    assert.throws(
      () => updateP0DecisionPreparationPack({
        pack,
        updates: [{ itemId: pack.items[0]!.agenda.itemId, draft: unsafeDraft }],
        updatedAt: UPDATED_AT,
      }),
      /Invalid Sufeiya P0 preparation update/,
    );
  });

  it("can complete every draft field without changing canonical P0 status or any release surface", () => {
    const p0Before = summarizeP0DecisionLog();
    const releaseBefore = releaseGovernanceSummary();
    const canonicalBefore = JSON.stringify(P0_DECISION_LOG);

    const parsed = parseP0DecisionPreparationPack(completePack());

    assert.equal(parsed.revision, 2);
    assert.equal(parsed.status, "draft_not_authoritative");
    assert.ok(parsed.items.every((item) => item.draft.preparationState === "draft_fields_complete"));
    assert.deepEqual(parsed.summary, {
      total: 29,
      empty: 0,
      drafting: 0,
      draftFieldsComplete: 29,
      formalResolved: 0,
    });
    assert.equal(summarizeP0PreparationItems(parsed.items).formalResolved, 0);
    assert.ok(Object.values(parsed.authorityBoundary).every((value) => value === false));

    const p0After = summarizeP0DecisionLog();
    const releaseAfter = releaseGovernanceSummary();
    assert.deepEqual(p0After, p0Before);
    assert.equal(p0After.resolved, 0);
    assert.equal(p0After.unresolved, 29);
    assert.equal(p0After.formalGate0Pass, false);
    assert.equal(JSON.stringify(P0_DECISION_LOG), canonicalBefore);
    assert.deepEqual(releaseAfter, releaseBefore);
    for (const surface of RELEASE_SURFACES) {
      assert.equal(releaseAfter[surface].enabled, releaseBefore[surface].enabled, surface);
    }
  });

  it("serializes only opaque preparation data without locators, Clerk identity, or secret fields", () => {
    const pack = completePack();
    const serialized = serializeP0DecisionPreparationPack(pack);
    const roundTripped = parseP0DecisionPreparationPack(JSON.parse(serialized));
    assert.equal(roundTripped.contentSha256, pack.contentSha256);

    const keys = collectKeys(roundTripped);
    for (const forbiddenKey of [
      "locator",
      "evidenceLocator",
      "evidenceLocation",
      "clerkId",
      "clerkUserId",
      "userId",
      "accountId",
      "email",
      "secret",
      "secretKey",
      "apiKey",
      "token",
      "sessionToken",
    ]) {
      assert.equal(keys.has(forbiddenKey), false, forbiddenKey);
    }

    const lower = serialized.toLowerCase();
    for (const forbiddenText of [
      "clerk",
      "locator",
      "secret",
      "dashscope_api_key",
      "clerk_secret_key",
      "pk_live_",
      "pk_test_",
      "sk-",
    ]) {
      assert.equal(lower.includes(forbiddenText), false, forbiddenText);
    }
  });
});
