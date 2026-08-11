import { z } from "zod";

import releaseDecisionRegisterJson from "@/data/release-decision-register.v1.json";

export const RELEASE_DECISION_PROTOCOL = "sufeiya_release_decisions_v1" as const;
export const APPROVED_PLAN_SHA256 = "6ad237bf7433134961c2b4f9de4cb0f055391b9179e6b4632c269cdd84809169" as const;

export const RELEASE_SURFACES = [
  "local_teaching_review_demo",
  "sofia_first_party_text_processing",
  "sofia_external_text_model",
  "sofia_voice_output",
  "sofia_microphone_input",
  "real_community",
  "real_human_queue",
  "staff_admin_write",
  "real_incentives",
] as const;

export type ReleaseSurface = (typeof RELEASE_SURFACES)[number];

const decisionStatusSchema = z.enum(["approved", "pending_review", "not_approved", "revoked"]);
const reviewStatusSchema = z.enum(["current", "pending_review", "not_approved", "due", "revoked", "superseded"]);
const implementationStatusSchema = z.enum([
  "implemented",
  "partially_implemented",
  "not_implemented",
  "configuration_only",
  "decision_recorded",
]);
const evidenceKindSchema = z.enum(["approved_plan", "user_instruction", "user_assertion", "vendor_documentation", "authorization", "contract", "adr", "test_receipt"]);
const evidenceVerificationStatusSchema = z.enum([
  "verified_file_hash",
  "user_instruction_received",
  "user_assertion_received",
  "verified_for_scope",
  "verified_online_current",
  "pending_review",
  "revoked",
]);
const isoTimestampSchema = z.string().min(1).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "expected an ISO-compatible timestamp",
);
const controlIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,79}$/);
const evidenceIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{2,119}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const evidenceReferenceSchema = z.object({
  id: evidenceIdSchema,
  kind: evidenceKindSchema,
  locator: z.string().min(8).max(500),
  contentSha256: sha256Schema.nullable(),
  verificationStatus: evidenceVerificationStatusSchema,
}).strict();

const releaseBindingsSchema = z.object({
  providers: z.array(z.string().min(1).max(120)).max(12),
  models: z.array(z.string().min(1).max(160)).max(24),
  regions: z.array(z.string().min(1).max(120)).max(12),
  dataModes: z.array(z.string().min(1).max(160)).max(12),
}).strict();

const releaseControlSchema = z.object({
  id: controlIdSchema,
  title: z.string().min(1).max(120),
  status: decisionStatusSchema,
  reviewStatus: reviewStatusSchema,
  scope: z.string().min(1).max(800),
  decisionOwner: z.string().min(1).max(120).nullable(),
  decidedAt: isoTimestampSchema.nullable(),
  reviewDueAt: isoTimestampSchema,
  evidenceReferenceIds: z.array(evidenceIdSchema).max(12),
  implementationStatus: implementationStatusSchema,
  implementationImpact: z.string().min(1).max(800),
  bindings: releaseBindingsSchema.nullable(),
  conditions: z.array(z.string().min(1).max(800)).max(20),
}).strict();

const surfaceRequirementsSchema = z.object({
  local_teaching_review_demo: z.array(controlIdSchema).min(1),
  sofia_first_party_text_processing: z.array(controlIdSchema).min(1),
  sofia_external_text_model: z.array(controlIdSchema).min(1),
  sofia_voice_output: z.array(controlIdSchema).min(1),
  sofia_microphone_input: z.array(controlIdSchema).min(1),
  real_community: z.array(controlIdSchema).min(1),
  real_human_queue: z.array(controlIdSchema).min(1),
  staff_admin_write: z.array(controlIdSchema).min(1),
  real_incentives: z.array(controlIdSchema).min(1),
}).strict();

const bindingRequirements = new Map<string, Array<keyof z.infer<typeof releaseBindingsSchema>>>([
  ["external_text_model_supplier_selection", ["providers", "models"]],
  ["external_text_model_data_flow", ["dataModes"]],
  ["external_provider_region_cross_border", ["regions"]],
  ["voice_supplier_model_selection", ["providers", "models"]],
  ["voice_data_flow", ["dataModes"]],
]);

export const releaseDecisionRegisterSchema = z.object({
  protocolVersion: z.literal(RELEASE_DECISION_PROTOCOL),
  effectiveAt: isoTimestampSchema,
  nextRegisterReviewAt: isoTimestampSchema,
  registerReviewStatus: z.enum(["active", "active_with_blockers", "due", "superseded", "revoked"]),
  defaultDisposition: z.literal("deny"),
  environmentPolicy: z.literal("one_register_for_local_preview_and_production"),
  amendmentPolicy: z.string().min(1).max(800),
  evidenceCatalog: z.array(evidenceReferenceSchema).min(1),
  controls: z.array(releaseControlSchema).min(1),
  surfaceRequirements: surfaceRequirementsSchema,
}).strict().superRefine((register, context) => {
  const now = Date.now();
  if (Date.parse(register.effectiveAt) > now) {
    context.addIssue({
      code: "custom",
      message: "release register effective time is in the future",
      path: ["effectiveAt"],
    });
  }

  const evidenceCatalog = new Map<string, (typeof register.evidenceCatalog)[number]>();
  register.evidenceCatalog.forEach((evidence, index) => {
    if (evidenceCatalog.has(evidence.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate release evidence: ${evidence.id}`,
        path: ["evidenceCatalog", index, "id"],
      });
    }
    evidenceCatalog.set(evidence.id, evidence);
    if (evidence.kind === "approved_plan" && !evidence.contentSha256) {
      context.addIssue({
        code: "custom",
        message: `approved plan evidence lacks SHA-256: ${evidence.id}`,
        path: ["evidenceCatalog", index, "contentSha256"],
      });
    }
    if (
      evidence.id === "approved_plan_2026-08-09" &&
      evidence.contentSha256 !== APPROVED_PLAN_SHA256
    ) {
      context.addIssue({
        code: "custom",
        message: "approved plan evidence SHA-256 does not match the reviewed artifact",
        path: ["evidenceCatalog", index, "contentSha256"],
      });
    }
  });

  const controls = new Map<string, (typeof register.controls)[number]>();
  register.controls.forEach((control, index) => {
    if (controls.has(control.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate release control: ${control.id}`,
        path: ["controls", index, "id"],
      });
    }
    controls.set(control.id, control);
    if (
      control.status === "approved" &&
      (
        !control.decisionOwner ||
        !control.decidedAt ||
        control.evidenceReferenceIds.length === 0 ||
        control.reviewStatus !== "current"
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `approved release control lacks owner, decision time, current review, or evidence: ${control.id}`,
        path: ["controls", index],
      });
    }
    if (control.decidedAt && Date.parse(control.decidedAt) > now) {
      context.addIssue({
        code: "custom",
        message: `release control decision time is in the future: ${control.id}`,
        path: ["controls", index, "decidedAt"],
      });
    }
    if (
      control.status === "approved" &&
      control.decidedAt &&
      Date.parse(control.reviewDueAt) <= Date.parse(control.decidedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: `approved release control review is not after its decision: ${control.id}`,
        path: ["controls", index, "reviewDueAt"],
      });
    }
    if (control.status === "pending_review" && control.reviewStatus !== "pending_review") {
      context.addIssue({
        code: "custom",
        message: `pending release control has inconsistent review status: ${control.id}`,
        path: ["controls", index, "reviewStatus"],
      });
    }
    if (control.status === "not_approved" && control.reviewStatus !== "not_approved") {
      context.addIssue({
        code: "custom",
        message: `not-approved release control has inconsistent review status: ${control.id}`,
        path: ["controls", index, "reviewStatus"],
      });
    }
    if (new Set(control.evidenceReferenceIds).size !== control.evidenceReferenceIds.length) {
      context.addIssue({
        code: "custom",
        message: `duplicate evidence reference in release control: ${control.id}`,
        path: ["controls", index, "evidenceReferenceIds"],
      });
    }
    control.evidenceReferenceIds.forEach((evidenceId, evidenceIndex) => {
      const evidence = evidenceCatalog.get(evidenceId);
      if (!evidence) {
        context.addIssue({
          code: "custom",
          message: `unknown release evidence ${evidenceId} referenced by ${control.id}`,
          path: ["controls", index, "evidenceReferenceIds", evidenceIndex],
        });
      } else if (
        control.status === "approved" &&
        ["pending_review", "revoked"].includes(evidence.verificationStatus)
      ) {
        context.addIssue({
          code: "custom",
          message: `approved release control references non-current evidence: ${control.id}`,
          path: ["controls", index, "evidenceReferenceIds", evidenceIndex],
        });
      }
    });
    if (control.id === "voice_written_authorization_verified" && control.status === "approved") {
      const hasVerifiedAuthorization = control.evidenceReferenceIds.some((evidenceId) => {
        const evidence = evidenceCatalog.get(evidenceId);
        return evidence?.kind === "authorization" &&
          evidence.verificationStatus === "verified_for_scope" &&
          Boolean(evidence.contentSha256);
      });
      if (!hasVerifiedAuthorization) {
        context.addIssue({
          code: "custom",
          message: "verified voice authorization requires a hashed authorization artifact",
          path: ["controls", index, "evidenceReferenceIds"],
        });
      }
    }
    if (control.status === "approved") {
      for (const bindingKey of bindingRequirements.get(control.id) ?? []) {
        if (!control.bindings?.[bindingKey].length) {
          context.addIssue({
            code: "custom",
            message: `approved release control lacks ${bindingKey} binding: ${control.id}`,
            path: ["controls", index, "bindings", bindingKey],
          });
        }
      }
    }
  });

  for (const surface of RELEASE_SURFACES) {
    const requirements = register.surfaceRequirements[surface];
    if (new Set(requirements).size !== requirements.length) {
      context.addIssue({
        code: "custom",
        message: `duplicate requirement in release surface: ${surface}`,
        path: ["surfaceRequirements", surface],
      });
    }
    requirements.forEach((controlId, index) => {
      if (!controls.has(controlId)) {
        context.addIssue({
          code: "custom",
          message: `unknown release control ${controlId} required by ${surface}`,
          path: ["surfaceRequirements", surface, index],
        });
      }
    });
  }
});

export type ReleaseDecisionRegister = z.infer<typeof releaseDecisionRegisterSchema>;
export type ReleaseDecisionStatus = z.infer<typeof decisionStatusSchema>;

export function parseReleaseDecisionRegister(candidate: unknown): ReleaseDecisionRegister {
  const parsed = releaseDecisionRegisterSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const issuePath = firstIssue?.path.length ? firstIssue.path.join(".") : "register";
    throw new Error(`Invalid Sufeiya release decision register at ${issuePath}`);
  }
  return parsed.data;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export const RELEASE_DECISION_REGISTER = deepFreeze(
  parseReleaseDecisionRegister(releaseDecisionRegisterJson),
);

export type ReleaseEvaluationContext = {
  provider?: string | null;
  model?: string | null;
  region?: string | null;
  dataMode?: string | null;
};

export type ReleaseSurfaceEvaluation = {
  surface: ReleaseSurface;
  enabled: boolean;
  status: "approved" | "blocked";
  reasonCode:
    | "allowed_for_declared_scope"
    | "decision_not_approved"
    | "implementation_not_ready"
    | "register_review_not_current"
    | "register_review_expired"
    | "review_not_current"
    | "review_expired"
    | "binding_mismatch";
  protocolVersion: typeof RELEASE_DECISION_PROTOCOL;
  effectiveAt: string;
  blockedControlIds: string[];
  pendingControlIds: string[];
  notApprovedControlIds: string[];
  revokedControlIds: string[];
  implementationBlockedControlIds: string[];
  reviewBlockedControlIds: string[];
  expiredControlIds: string[];
  blockedBindingIds: string[];
  registerReviewBlocked: boolean;
  registerReviewExpired: boolean;
};

const implementedDecisionStatuses = new Set([
  "implemented",
  "configuration_only",
  "decision_recorded",
]);

const contextKeys = {
  providers: "provider",
  models: "model",
  regions: "region",
  dataModes: "dataMode",
} as const;

export function evaluateReleaseSurface(
  surface: ReleaseSurface,
  context: ReleaseEvaluationContext = {},
): ReleaseSurfaceEvaluation {
  const register = RELEASE_DECISION_REGISTER;
  const controls = new Map(register.controls.map((control) => [control.id, control]));
  const requiredControlIds = register.surfaceRequirements[surface] ?? [];
  const blockedControlIds: string[] = [];
  const pendingControlIds: string[] = [];
  const notApprovedControlIds: string[] = [];
  const revokedControlIds: string[] = [];
  const implementationBlockedControlIds: string[] = [];
  const reviewBlockedControlIds: string[] = [];
  const expiredControlIds: string[] = [];
  const blockedBindingIds: string[] = [];
  const now = Date.now();
  const registerReviewBlocked = !["active", "active_with_blockers"].includes(register.registerReviewStatus);
  const registerReviewExpired = Date.parse(register.nextRegisterReviewAt) < now;

  const blockControl = (controlId: string, bucket: string[]) => {
    if (!blockedControlIds.includes(controlId)) blockedControlIds.push(controlId);
    if (!bucket.includes(controlId)) bucket.push(controlId);
  };

  for (const controlId of requiredControlIds) {
    const control = controls.get(controlId);
    if (!control || control.status === "not_approved") {
      blockControl(controlId, notApprovedControlIds);
      continue;
    }
    if (control.status === "pending_review") {
      blockControl(controlId, pendingControlIds);
      continue;
    }
    if (control.status === "revoked") {
      blockControl(controlId, revokedControlIds);
      continue;
    }
    if (!implementedDecisionStatuses.has(control.implementationStatus)) {
      blockControl(controlId, implementationBlockedControlIds);
    }
    if (control.reviewStatus !== "current") {
      blockControl(controlId, reviewBlockedControlIds);
    }
    if (Date.parse(control.reviewDueAt) < now) {
      blockControl(controlId, expiredControlIds);
    }
    if (control.bindings) {
      for (const [bindingKey, contextKey] of Object.entries(contextKeys) as Array<
        [keyof typeof contextKeys, (typeof contextKeys)[keyof typeof contextKeys]]
      >) {
        const allowedValues = control.bindings[bindingKey];
        if (!allowedValues.length) continue;
        const actualValue = context[contextKey];
        if (!actualValue || !allowedValues.includes(actualValue)) {
          blockedBindingIds.push(`${control.id}.${contextKey}`);
        }
      }
    }
  }

  const enabled = requiredControlIds.length > 0 &&
    !registerReviewBlocked &&
    !registerReviewExpired &&
    blockedControlIds.length === 0 &&
    blockedBindingIds.length === 0;
  const reasonCode = enabled
    ? "allowed_for_declared_scope"
    : registerReviewExpired
      ? "register_review_expired"
      : registerReviewBlocked
        ? "register_review_not_current"
        : blockedBindingIds.length
          ? "binding_mismatch"
          : expiredControlIds.length
            ? "review_expired"
            : reviewBlockedControlIds.length
              ? "review_not_current"
              : implementationBlockedControlIds.length
                ? "implementation_not_ready"
                : "decision_not_approved";

  return {
    surface,
    enabled,
    status: enabled ? "approved" : "blocked",
    reasonCode,
    protocolVersion: RELEASE_DECISION_PROTOCOL,
    effectiveAt: register.effectiveAt,
    blockedControlIds,
    pendingControlIds,
    notApprovedControlIds,
    revokedControlIds,
    implementationBlockedControlIds,
    reviewBlockedControlIds,
    expiredControlIds,
    blockedBindingIds,
    registerReviewBlocked,
    registerReviewExpired,
  };
}

export function releaseGovernanceSummary() {
  return Object.fromEntries(
    RELEASE_SURFACES.map((surface) => [surface, evaluateReleaseSurface(surface)]),
  ) as Record<ReleaseSurface, ReleaseSurfaceEvaluation>;
}
