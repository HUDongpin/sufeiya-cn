import { z } from "zod";

import releaseDecisionRegisterJson from "@/data/release-decision-register.v1.json";

export const RELEASE_DECISION_PROTOCOL = "sufeiya_release_decisions_v1" as const;

export const RELEASE_SURFACES = [
  "local_teaching_review_demo",
  "sofia_external_text_model",
  "sofia_voice_output",
  "sofia_microphone_input",
  "real_community",
  "real_human_queue",
  "staff_admin_write",
  "real_incentives",
] as const;

export type ReleaseSurface = (typeof RELEASE_SURFACES)[number];

const decisionStatusSchema = z.enum(["approved", "pending_review", "not_approved"]);
const isoTimestampSchema = z.string().min(1).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "expected an ISO-compatible timestamp",
);
const controlIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,79}$/);

const releaseControlSchema = z.object({
  id: controlIdSchema,
  title: z.string().min(1).max(120),
  status: decisionStatusSchema,
  scope: z.string().min(1).max(800),
  decisionOwner: z.string().min(1).max(120).nullable(),
  decidedAt: isoTimestampSchema.nullable(),
  evidenceReferences: z.array(z.string().min(1).max(200)).max(12),
  conditions: z.array(z.string().min(1).max(800)).max(20),
}).strict();

const surfaceRequirementsSchema = z.object({
  local_teaching_review_demo: z.array(controlIdSchema).min(1),
  sofia_external_text_model: z.array(controlIdSchema).min(1),
  sofia_voice_output: z.array(controlIdSchema).min(1),
  sofia_microphone_input: z.array(controlIdSchema).min(1),
  real_community: z.array(controlIdSchema).min(1),
  real_human_queue: z.array(controlIdSchema).min(1),
  staff_admin_write: z.array(controlIdSchema).min(1),
  real_incentives: z.array(controlIdSchema).min(1),
}).strict();

export const releaseDecisionRegisterSchema = z.object({
  protocolVersion: z.literal(RELEASE_DECISION_PROTOCOL),
  effectiveAt: isoTimestampSchema,
  defaultDisposition: z.literal("deny"),
  environmentPolicy: z.literal("one_register_for_local_preview_and_production"),
  amendmentPolicy: z.string().min(1).max(800),
  controls: z.array(releaseControlSchema).min(1),
  surfaceRequirements: surfaceRequirementsSchema,
}).strict().superRefine((register, context) => {
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
      (!control.decisionOwner || !control.decidedAt || control.evidenceReferences.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: `approved release control lacks owner, decision time, or evidence: ${control.id}`,
        path: ["controls", index],
      });
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

export const RELEASE_DECISION_REGISTER = parseReleaseDecisionRegister(releaseDecisionRegisterJson);

export type ReleaseSurfaceEvaluation = {
  surface: ReleaseSurface;
  enabled: boolean;
  status: "approved" | "blocked";
  protocolVersion: typeof RELEASE_DECISION_PROTOCOL;
  effectiveAt: string;
  blockedControlIds: string[];
  pendingControlIds: string[];
  notApprovedControlIds: string[];
};

export function evaluateReleaseSurface(
  surface: ReleaseSurface,
  register: ReleaseDecisionRegister = RELEASE_DECISION_REGISTER,
): ReleaseSurfaceEvaluation {
  const controls = new Map(register.controls.map((control) => [control.id, control]));
  const requiredControlIds = register.surfaceRequirements[surface] ?? [];
  const blockedControlIds: string[] = [];
  const pendingControlIds: string[] = [];
  const notApprovedControlIds: string[] = [];

  for (const controlId of requiredControlIds) {
    const control = controls.get(controlId);
    if (!control || control.status === "not_approved") {
      blockedControlIds.push(controlId);
      notApprovedControlIds.push(controlId);
    } else if (control.status === "pending_review") {
      blockedControlIds.push(controlId);
      pendingControlIds.push(controlId);
    }
  }

  return {
    surface,
    enabled: requiredControlIds.length > 0 && blockedControlIds.length === 0,
    status: requiredControlIds.length > 0 && blockedControlIds.length === 0 ? "approved" : "blocked",
    protocolVersion: RELEASE_DECISION_PROTOCOL,
    effectiveAt: register.effectiveAt,
    blockedControlIds,
    pendingControlIds,
    notApprovedControlIds,
  };
}

export function releaseGovernanceSummary() {
  return Object.fromEntries(
    RELEASE_SURFACES.map((surface) => [surface, evaluateReleaseSurface(surface)]),
  ) as Record<ReleaseSurface, ReleaseSurfaceEvaluation>;
}
