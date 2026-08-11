import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import preparationAgendaJson from "@/data/p0-decision-preparation-agenda.v1.json";
import {
  APPROVED_PLAN_SHA256,
  RELEASE_SURFACES,
} from "@/lib/release-governance";
import {
  P0_CANONICAL_DEFINITION_SET_SHA256,
  P0_CURRENT_LEDGER_SHA256,
  P0_DECISION_LOG,
  P0_OWNER_ROLES,
  P0_REQUIRED_DECISION_ROLE_POLICY_SHA256,
  P0_REQUIRED_DECISION_ROLES,
} from "@/lib/p0-decision-log";

export const P0_PREPARATION_AGENDA_PROTOCOL = "sufeiya_p0_decision_preparation_agenda_v1" as const;
export const P0_PREPARATION_PROTOCOL = "sufeiya_p0_decision_preparation_v1" as const;
export const P0_PREPARATION_STATUS = "draft_not_authoritative" as const;
export const P0_PREPARATION_ITEM_COUNT = 29 as const;
export const P0_PREPARATION_TIME_ZONE = "Asia/Taipei" as const;
export const P0_PREPARATION_AGENDA_SHA256 = "ab4f69568fbe72fee87e1402d0ada98cca4b7989378ae065e8320ef6496ae13d" as const;
export const P0_PREPARATION_FILENAME_PREFIX = "Sufeiya_Gate0_P0_DRAFT_NOT_APPROVAL" as const;

const p0IdSchema = z.string().regex(/^p0_[a-f][0-9]{2}_[a-z0-9_]{3,64}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const evidenceIdSchema = z.string().regex(/^prep_ev_[a-z0-9][a-z0-9_-]{0,111}$/);
const ownerRoleSchema = z.enum(P0_OWNER_ROLES);
const releaseSurfaceSchema = z.enum(RELEASE_SURFACES);
const proposedDispositionSchema = z.enum([
  "undecided",
  "propose_adopt",
  "propose_reject",
  "propose_defer",
]);
const preparationStateSchema = z.enum(["empty", "drafting", "draft_fields_complete"]);
const safeDraftTextSchema = (maximumLength: number) =>
  z.string().max(maximumLength).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value),
    "control characters are not allowed",
  );
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}, "expected a real calendar date");
function isStrictRfc3339(value: string): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) return false;
  if (zone !== "Z") {
    if (zone === "-00:00") return false;
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

const strictTimestampSchema = z.string().refine(
  isStrictRfc3339,
  "expected a strict RFC 3339 timestamp with an explicit zone",
);

const agendaItemSchema = z.object({
  itemId: p0IdSchema,
  defaultSuggestion: z.string().min(1).max(2_400),
}).strict();

const preparationAgendaSchema = z.object({
  protocolVersion: z.literal(P0_PREPARATION_AGENDA_PROTOCOL),
  sourcePlanSha256: z.literal(APPROVED_PLAN_SHA256),
  sourceAppendix: z.literal("A"),
  sourcePages: z.tuple([z.literal(17), z.literal(18), z.literal(19)]),
  suggestionAuthority: z.literal("approved_plan_default_suggestion_not_a_meeting_outcome"),
  items: z.array(agendaItemSchema).length(P0_PREPARATION_ITEM_COUNT),
}).strict().superRefine((agenda, context) => {
  const ids = agenda.items.map((item) => item.itemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "duplicate P0 preparation agenda item", path: ["items"] });
  }
  const expectedIds = P0_DECISION_LOG.items.map((item) => item.id);
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    context.addIssue({ code: "custom", message: "P0 preparation agenda order drift", path: ["items"] });
  }
});

const roleReviewSlotSchema = z.object({
  role: ownerRoleSchema,
  candidateEvidenceReferenceId: evidenceIdSchema.nullable(),
  verificationState: z.literal("awaiting_role_material"),
}).strict();

const preparationAgendaBindingSchema = z.object({
  itemId: p0IdSchema,
  order: z.number().int().min(1).max(P0_PREPARATION_ITEM_COUNT),
  section: z.enum(["A", "B", "C", "D", "E", "F"]),
  question: z.string().min(1).max(240),
  defaultSuggestion: z.string().min(1).max(2_400),
  defaultSuggestionAuthority: z.literal("approved_plan_default_suggestion_not_a_meeting_outcome"),
  operationalGuardrail: z.string().min(1).max(1_200),
  sourcePages: z.array(z.number().int().min(17).max(19)).min(1).max(2),
  itemDefinitionSha256: sha256Schema,
  requiredRoles: z.array(ownerRoleSchema).min(2).max(P0_OWNER_ROLES.length),
}).strict();

const preparationDraftSchema = z.object({
  preparationState: preparationStateSchema,
  proposedDisposition: proposedDispositionSchema,
  decisionSummaryDraft: safeDraftTextSchema(800),
  proposedPrimaryResponsibleRole: ownerRoleSchema.nullable(),
  proposedBackupResponsibleRole: ownerRoleSchema.nullable(),
  roleReviewSlots: z.array(roleReviewSlotSchema).min(2).max(P0_OWNER_ROLES.length),
  additionalEvidenceReferenceIds: z.array(evidenceIdSchema).max(12),
  implementationImpactDraft: safeDraftTextSchema(800),
  implementationDueDateDraft: dateOnlySchema.nullable(),
  reviewConditionDraft: safeDraftTextSchema(800),
  reviewDueDateDraft: dateOnlySchema.nullable(),
  proposedPermittedImpactSurfaceIds: z.array(releaseSurfaceSchema).max(RELEASE_SURFACES.length),
  meetingNotesDraft: safeDraftTextSchema(3_000),
}).strict();

const preparationDraftInputSchema = preparationDraftSchema.omit({ preparationState: true }).strict();
const preparationDraftUpdateSchema = z.object({
  itemId: p0IdSchema,
  draft: preparationDraftInputSchema,
}).strict();

const preparationItemSchema = z.object({
  agenda: preparationAgendaBindingSchema,
  draft: preparationDraftSchema,
}).strict();

const authorityBoundarySchema = z.object({
  formalAuthority: z.literal(false),
  staffIdentityVerified: z.literal(false),
  reviewerQualificationVerified: z.literal(false),
  canonicalLedgerWrite: z.literal(false),
  releaseAuthorization: z.literal(false),
  formalGate0Pass: z.literal(false),
}).strict();

const preparationBaseSchema = z.object({
  sourcePlanSha256: sha256Schema,
  canonicalDefinitionSetSha256: sha256Schema,
  decisionRolePolicySha256: sha256Schema,
  ledgerRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ledgerContentSha256: sha256Schema,
}).strict();

const preparationSummarySchema = z.object({
  total: z.literal(P0_PREPARATION_ITEM_COUNT),
  empty: z.number().int().min(0).max(P0_PREPARATION_ITEM_COUNT),
  drafting: z.number().int().min(0).max(P0_PREPARATION_ITEM_COUNT),
  draftFieldsComplete: z.number().int().min(0).max(P0_PREPARATION_ITEM_COUNT),
  formalResolved: z.literal(0),
}).strict();

const p0DecisionPreparationPackSchemaBase = z.object({
  protocolVersion: z.literal(P0_PREPARATION_PROTOCOL),
  packId: z.string().uuid(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.literal(P0_PREPARATION_STATUS),
  calendarTimeZone: z.literal(P0_PREPARATION_TIME_ZONE),
  generatedAt: strictTimestampSchema,
  updatedAt: strictTimestampSchema,
  integrityBoundary: z.object({
    algorithm: z.literal("sha256"),
    authority: z.literal("unsigned_self_digest_integrity_only_not_identity_or_approval"),
  }).strict(),
  authorityBoundary: authorityBoundarySchema,
  base: preparationBaseSchema,
  items: z.array(preparationItemSchema).length(P0_PREPARATION_ITEM_COUNT),
  summary: preparationSummarySchema,
  contentSha256: sha256Schema,
}).strict();

export type P0PreparationAgendaBinding = z.infer<typeof preparationAgendaBindingSchema>;
export type P0PreparationDraft = z.infer<typeof preparationDraftSchema>;
export type P0PreparationDraftInput = z.infer<typeof preparationDraftInputSchema>;
export type P0PreparationDraftUpdate = z.infer<typeof preparationDraftUpdateSchema>;
export type P0DecisionPreparationItem = z.infer<typeof preparationItemSchema>;
export type P0DecisionPreparationPack = z.infer<typeof p0DecisionPreparationPackSchemaBase>;

function canonicalize(value: unknown, ancestors = new WeakSet<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Sufeiya canonical JSON requires finite numbers");
    return value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("Sufeiya canonical JSON rejects cyclic data");
    ancestors.add(value);
    const result = value.map((nested) => canonicalize(nested, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Sufeiya canonical JSON requires plain objects");
    }
    if (ancestors.has(value)) throw new TypeError("Sufeiya canonical JSON rejects cyclic data");
    ancestors.add(value);
    const result = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested, ancestors)]),
    );
    ancestors.delete(value);
    return result;
  }
  throw new TypeError("Sufeiya canonical JSON rejects non-JSON values");
}

export function canonicalPreparationJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256PreparationValue(value: unknown): string {
  return createHash("sha256").update(canonicalPreparationJson(value)).digest("hex");
}

function packWithoutDigest(pack: P0DecisionPreparationPack | Record<string, unknown>) {
  const content = { ...pack } as Record<string, unknown>;
  delete content.contentSha256;
  return content;
}

function roleSlotsMatch(item: P0DecisionPreparationItem) {
  const required = item.agenda.requiredRoles;
  const actual = item.draft.roleReviewSlots.map((slot) => slot.role);
  return JSON.stringify(actual) === JSON.stringify(required);
}

function distinctEvidenceReferences(pack: P0DecisionPreparationPack) {
  const seen = new Set<string>();
  for (const item of pack.items) {
    const references = [
      ...item.draft.roleReviewSlots.map((slot) => slot.candidateEvidenceReferenceId),
      ...item.draft.additionalEvidenceReferenceIds,
    ].filter((value): value is string => Boolean(value));
    for (const reference of references) {
      if (seen.has(reference)) return false;
      seen.add(reference);
    }
  }
  return true;
}

function dateBefore(left: string | null, right: string | null) {
  if (!left || !right) return false;
  return Date.parse(`${left}T00:00:00Z`) < Date.parse(`${right}T00:00:00Z`);
}

function calendarDateInTaipei(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: P0_PREPARATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function deriveP0PreparationState(
  item: P0DecisionPreparationItem,
  earliestDueDate = "0000-01-01",
): P0PreparationDraft["preparationState"] {
  const draft = item.draft;
  const empty =
    draft.proposedDisposition === "undecided" &&
    draft.decisionSummaryDraft.length === 0 &&
    draft.proposedPrimaryResponsibleRole === null &&
    draft.proposedBackupResponsibleRole === null &&
    draft.roleReviewSlots.every((slot) => slot.candidateEvidenceReferenceId === null) &&
    draft.additionalEvidenceReferenceIds.length === 0 &&
    draft.implementationImpactDraft.length === 0 &&
    draft.implementationDueDateDraft === null &&
    draft.reviewConditionDraft.length === 0 &&
    draft.reviewDueDateDraft === null &&
    draft.proposedPermittedImpactSurfaceIds.length === 0 &&
    draft.meetingNotesDraft.length === 0;
  if (empty) return "empty";

  const fieldsComplete =
    draft.proposedDisposition !== "undecided" &&
    draft.decisionSummaryDraft.trim().length >= 20 &&
    draft.proposedPrimaryResponsibleRole !== null &&
    draft.proposedBackupResponsibleRole !== null &&
    draft.proposedPrimaryResponsibleRole !== draft.proposedBackupResponsibleRole &&
    item.agenda.requiredRoles.includes(draft.proposedPrimaryResponsibleRole) &&
    item.agenda.requiredRoles.includes(draft.proposedBackupResponsibleRole) &&
    roleSlotsMatch(item) &&
    draft.roleReviewSlots.every((slot) => slot.candidateEvidenceReferenceId !== null) &&
    draft.roleReviewSlots.length + draft.additionalEvidenceReferenceIds.length <= 12 &&
    draft.implementationImpactDraft.trim().length >= 20 &&
    draft.implementationDueDateDraft !== null &&
    draft.implementationDueDateDraft >= earliestDueDate &&
    draft.reviewConditionDraft.trim().length >= 20 &&
    dateBefore(draft.implementationDueDateDraft, draft.reviewDueDateDraft);
  return fieldsComplete ? "draft_fields_complete" : "drafting";
}

export function summarizeP0PreparationItems(items: P0DecisionPreparationItem[], earliestDueDate = "0000-01-01") {
  const states = items.map((item) => deriveP0PreparationState(item, earliestDueDate));
  return {
    total: P0_PREPARATION_ITEM_COUNT,
    empty: states.filter((state) => state === "empty").length,
    drafting: states.filter((state) => state === "drafting").length,
    draftFieldsComplete: states.filter((state) => state === "draft_fields_complete").length,
    formalResolved: 0 as const,
  };
}

function validatePreparationIntegrity(pack: P0DecisionPreparationPack, context: z.RefinementCtx) {
  pack.items.forEach((item, index) => {
    if (!roleSlotsMatch(item)) {
      context.addIssue({ code: "custom", message: "P0 preparation role slot drift", path: ["items", index, "draft", "roleReviewSlots"] });
    }
    if (item.draft.preparationState !== deriveP0PreparationState(item, calendarDateInTaipei(pack.updatedAt))) {
      context.addIssue({ code: "custom", message: "P0 preparation state mismatch", path: ["items", index, "draft", "preparationState"] });
    }
  });
  if (JSON.stringify(pack.summary) !== JSON.stringify(summarizeP0PreparationItems(pack.items, calendarDateInTaipei(pack.updatedAt)))) {
    context.addIssue({ code: "custom", message: "P0 preparation summary mismatch", path: ["summary"] });
  }
  if (!distinctEvidenceReferences(pack)) {
    context.addIssue({ code: "custom", message: "P0 preparation evidence reference reused", path: ["items"] });
  }
  if (Date.parse(pack.updatedAt) < Date.parse(pack.generatedAt)) {
    context.addIssue({ code: "custom", message: "P0 preparation update precedes generation", path: ["updatedAt"] });
  }
  const maximumAcceptedTime = Date.now() + 5 * 60 * 1_000;
  if (Date.parse(pack.generatedAt) > maximumAcceptedTime || Date.parse(pack.updatedAt) > maximumAcceptedTime) {
    context.addIssue({ code: "custom", message: "P0 preparation timestamp is in the future", path: ["updatedAt"] });
  }
  if (sha256PreparationValue(packWithoutDigest(pack)) !== pack.contentSha256) {
    context.addIssue({ code: "custom", message: "P0 preparation digest mismatch", path: ["contentSha256"] });
  }
}

function currentBindingDriftReasons(pack: P0DecisionPreparationPack): string[] {
  const reasons: string[] = [];
  if (pack.base.sourcePlanSha256 !== APPROVED_PLAN_SHA256) reasons.push("source_plan_sha256");
  if (pack.base.canonicalDefinitionSetSha256 !== P0_CANONICAL_DEFINITION_SET_SHA256) reasons.push("canonical_definition_set_sha256");
  if (pack.base.decisionRolePolicySha256 !== P0_REQUIRED_DECISION_ROLE_POLICY_SHA256) reasons.push("decision_role_policy_sha256");
  if (pack.base.ledgerRevision !== P0_DECISION_LOG.ledgerRevision) reasons.push("ledger_revision");
  if (pack.base.ledgerContentSha256 !== P0_CURRENT_LEDGER_SHA256) reasons.push("ledger_content_sha256");
  const agenda = parseP0PreparationAgenda(preparationAgendaJson);
  const suggestions = new Map(agenda.items.map((item) => [item.itemId, item.defaultSuggestion]));
  pack.items.forEach((item, index) => {
    const canonicalItem = P0_DECISION_LOG.items[index];
    const expectedRoles = P0_REQUIRED_DECISION_ROLES[item.agenda.itemId as keyof typeof P0_REQUIRED_DECISION_ROLES];
    if (
      !canonicalItem ||
      item.agenda.itemId !== canonicalItem.id ||
      item.agenda.order !== canonicalItem.order ||
      item.agenda.section !== canonicalItem.section ||
      item.agenda.question !== canonicalItem.question ||
      item.agenda.operationalGuardrail !== canonicalItem.operationalGuardrail ||
      item.agenda.itemDefinitionSha256 !== canonicalItem.definitionSha256 ||
      JSON.stringify(item.agenda.sourcePages) !== JSON.stringify(canonicalItem.sourcePages) ||
      item.agenda.defaultSuggestion !== suggestions.get(canonicalItem.id) ||
      JSON.stringify(item.agenda.requiredRoles) !== JSON.stringify(expectedRoles)
    ) {
      reasons.push(`item_${index + 1}_agenda`);
    }
  });
  return reasons;
}

export const p0DecisionPreparationIntegritySchema = p0DecisionPreparationPackSchemaBase.superRefine(
  validatePreparationIntegrity,
);

export const p0DecisionPreparationPackSchema = p0DecisionPreparationIntegritySchema.superRefine((pack, context) => {
  const reasons = currentBindingDriftReasons(pack);
  if (reasons.length > 0) {
    context.addIssue({ code: "custom", message: `P0 preparation current binding drift: ${reasons.join(",")}`, path: ["base"] });
  }
});

export function parseP0PreparationAgenda(candidate: unknown) {
  const parsed = preparationAgendaSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid Sufeiya P0 preparation agenda at ${issue?.path.join(".") || "agenda"}`);
  }
  if (sha256PreparationValue(parsed.data) !== P0_PREPARATION_AGENDA_SHA256) {
    throw new Error("Invalid Sufeiya P0 preparation agenda at contentSha256");
  }
  return parsed.data;
}

export function parseP0DecisionPreparationPack(candidate: unknown): P0DecisionPreparationPack {
  const parsed = p0DecisionPreparationPackSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid Sufeiya P0 decision preparation pack at ${issue?.path.join(".") || "pack"}`);
  }
  return parsed.data;
}

export function inspectP0DecisionPreparationPack(candidate: unknown): {
  pack: P0DecisionPreparationPack;
  currentBindingStatus: "current" | "stale";
  staleReasons: string[];
} {
  const parsed = p0DecisionPreparationIntegritySchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid Sufeiya P0 decision preparation pack integrity at ${issue?.path.join(".") || "pack"}`);
  }
  const staleReasons = currentBindingDriftReasons(parsed.data);
  return {
    pack: parsed.data,
    currentBindingStatus: staleReasons.length === 0 ? "current" : "stale",
    staleReasons,
  };
}

export function createP0DecisionPreparationPack({
  generatedAt = new Date().toISOString(),
  packId = randomUUID(),
}: {
  generatedAt?: string;
  packId?: string;
} = {}): P0DecisionPreparationPack {
  const agenda = parseP0PreparationAgenda(preparationAgendaJson);
  const suggestions = new Map(agenda.items.map((item) => [item.itemId, item.defaultSuggestion]));
  const items: P0DecisionPreparationItem[] = P0_DECISION_LOG.items.map((item) => {
    const requiredRoles = [...P0_REQUIRED_DECISION_ROLES[item.id as keyof typeof P0_REQUIRED_DECISION_ROLES]];
    return {
      agenda: {
        itemId: item.id,
        order: item.order,
        section: item.section,
        question: item.question,
        defaultSuggestion: suggestions.get(item.id) || "",
        defaultSuggestionAuthority: "approved_plan_default_suggestion_not_a_meeting_outcome",
        operationalGuardrail: item.operationalGuardrail,
        sourcePages: [...item.sourcePages],
        itemDefinitionSha256: item.definitionSha256,
        requiredRoles,
      },
      draft: {
        preparationState: "empty",
        proposedDisposition: "undecided",
        decisionSummaryDraft: "",
        proposedPrimaryResponsibleRole: null,
        proposedBackupResponsibleRole: null,
        roleReviewSlots: requiredRoles.map((role) => ({
          role,
          candidateEvidenceReferenceId: null,
          verificationState: "awaiting_role_material",
        })),
        additionalEvidenceReferenceIds: [],
        implementationImpactDraft: "",
        implementationDueDateDraft: null,
        reviewConditionDraft: "",
        reviewDueDateDraft: null,
        proposedPermittedImpactSurfaceIds: [],
        meetingNotesDraft: "",
      },
    };
  });
  const withoutDigest = {
    protocolVersion: P0_PREPARATION_PROTOCOL,
    packId,
    revision: 1,
    status: P0_PREPARATION_STATUS,
    calendarTimeZone: P0_PREPARATION_TIME_ZONE,
    generatedAt,
    updatedAt: generatedAt,
    integrityBoundary: {
      algorithm: "sha256" as const,
      authority: "unsigned_self_digest_integrity_only_not_identity_or_approval" as const,
    },
    authorityBoundary: {
      formalAuthority: false,
      staffIdentityVerified: false,
      reviewerQualificationVerified: false,
      canonicalLedgerWrite: false,
      releaseAuthorization: false,
      formalGate0Pass: false,
    },
    base: {
      sourcePlanSha256: APPROVED_PLAN_SHA256,
      canonicalDefinitionSetSha256: P0_CANONICAL_DEFINITION_SET_SHA256,
      decisionRolePolicySha256: P0_REQUIRED_DECISION_ROLE_POLICY_SHA256,
      ledgerRevision: P0_DECISION_LOG.ledgerRevision,
      ledgerContentSha256: P0_CURRENT_LEDGER_SHA256,
    },
    items,
    summary: summarizeP0PreparationItems(items),
  };
  return parseP0DecisionPreparationPack({
    ...withoutDigest,
    contentSha256: sha256PreparationValue(withoutDigest),
  });
}

export function updateP0DecisionPreparationPack({
  pack,
  updates,
  updatedAt = new Date().toISOString(),
}: {
  pack: unknown;
  updates: unknown;
  updatedAt?: string;
}): P0DecisionPreparationPack {
  const current = parseP0DecisionPreparationPack(pack);
  const timestamp = strictTimestampSchema.safeParse(updatedAt);
  if (!timestamp.success) {
    throw new Error("Invalid Sufeiya P0 preparation update timestamp");
  }
  const parsedUpdates = z.array(preparationDraftUpdateSchema).max(P0_PREPARATION_ITEM_COUNT).safeParse(updates);
  if (!parsedUpdates.success) {
    const issue = parsedUpdates.error.issues[0];
    throw new Error(`Invalid Sufeiya P0 preparation update at ${issue?.path.join(".") || "updates"}`);
  }
  if (parsedUpdates.data.length === 0) {
    throw new Error("Invalid Sufeiya P0 preparation update: at least one item is required");
  }
  if (Date.parse(timestamp.data) <= Date.parse(current.updatedAt)) {
    throw new Error("Invalid Sufeiya P0 preparation update: timestamp must advance");
  }
  const updateIds = parsedUpdates.data.map((update) => update.itemId);
  if (new Set(updateIds).size !== updateIds.length) {
    throw new Error("Invalid Sufeiya P0 preparation update: duplicate item ID");
  }
  const knownIds = new Set(current.items.map((item) => item.agenda.itemId));
  if (updateIds.some((itemId) => !knownIds.has(itemId))) {
    throw new Error("Invalid Sufeiya P0 preparation update: unknown item ID");
  }

  const updatesById = new Map(parsedUpdates.data.map((update) => [update.itemId, update.draft]));
  const earliestDueDate = calendarDateInTaipei(timestamp.data);
  const items = current.items.map((item) => {
    const draftInput = updatesById.get(item.agenda.itemId);
    if (!draftInput) return item;
    const candidate = {
      ...item,
      draft: {
        ...draftInput,
        preparationState: "drafting" as const,
      },
    };
    return {
      ...candidate,
      draft: {
        ...candidate.draft,
        preparationState: deriveP0PreparationState(candidate, earliestDueDate),
      },
    };
  });
  const withoutDigest = {
    ...current,
    revision: current.revision + 1,
    updatedAt: timestamp.data,
    items,
    summary: summarizeP0PreparationItems(items, earliestDueDate),
  };
  const content = packWithoutDigest(withoutDigest);
  return parseP0DecisionPreparationPack({
    ...content,
    contentSha256: sha256PreparationValue(content),
  });
}

export function serializeP0DecisionPreparationPack(pack: P0DecisionPreparationPack): string {
  return `${JSON.stringify(parseP0DecisionPreparationPack(pack), null, 2)}\n`;
}
