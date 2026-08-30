import { z } from "zod";

import capabilityMatrixJson from "@/data/capability-matrix.v1.json";

export const CAPABILITY_MATRIX_PROTOCOL = "sufeiya_capability_matrix_v1" as const;
export const CAPABILITY_STATUSES = [
  "done",
  "partial",
  "not_started",
  "intentionally_blocked",
] as const;

const isoTimestampSchema = z.string().min(1).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "expected an ISO-compatible timestamp",
);
const capabilityIdSchema = z.string().regex(/^[a-z][a-z0-9_]{2,79}$/);
const evidenceSchema = z.string().min(3).max(300);
const reviewStatusSchema = z.enum(["pending", "accepted", "rejected", "superseded"]);

const capabilitySchema = z.object({
  id: capabilityIdSchema,
  userFacingName: z.string().min(2).max(120),
  publicSummary: z.string().min(8).max(400),
  status: z.enum(CAPABILITY_STATUSES),
  accessCondition: z.string().min(2).max(300),
  dataLocations: z.array(z.string().min(2).max(160)).min(1).max(8),
  externalVendors: z.array(z.string().min(2).max(160)).max(8),
  humanQueue: z.string().min(1).max(240),
  codeEvidence: z.array(evidenceSchema).max(12),
  externalEvidence: z.array(evidenceSchema).max(12),
  owner: z.string().regex(/^[a-z][a-z0-9_]{2,79}$/),
  reviewStatus: reviewStatusSchema,
  reviewedAt: isoTimestampSchema.nullable(),
  releaseGate: capabilityIdSchema,
}).strict();

export const capabilityMatrixSchema = z.object({
  protocolVersion: z.literal(CAPABILITY_MATRIX_PROTOCOL),
  effectiveAt: isoTimestampSchema,
  defaultDisposition: z.literal("unavailable_unless_done"),
  capabilities: z.array(capabilitySchema).min(1),
}).strict().superRefine((matrix, context) => {
  const ids = new Set<string>();
  matrix.capabilities.forEach((capability, index) => {
    if (ids.has(capability.id)) {
      context.addIssue({
        code: "custom",
        message: `duplicate capability: ${capability.id}`,
        path: ["capabilities", index, "id"],
      });
    }
    ids.add(capability.id);

    if (capability.status === "done" && (
      capability.reviewStatus !== "accepted"
      || capability.reviewedAt === null
      || capability.codeEvidence.length === 0
      || capability.externalEvidence.length === 0
      || capability.externalEvidence.some((evidence) => evidence.includes("pending"))
    )) {
      context.addIssue({
        code: "custom",
        message: `done capability is missing accepted review or verified evidence: ${capability.id}`,
        path: ["capabilities", index],
      });
    }
    if (
      capability.status === "not_started"
      && (
        capability.reviewStatus !== "pending"
        || capability.reviewedAt !== null
        || capability.codeEvidence.length !== 0
        || capability.externalEvidence.length !== 0
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `not-started capability must not claim implementation or review evidence: ${capability.id}`,
        path: ["capabilities", index],
      });
    }
    if (
      ["partial", "intentionally_blocked"].includes(capability.status)
      && capability.codeEvidence.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: `current or blocked capability requires a code or release-control boundary: ${capability.id}`,
        path: ["capabilities", index, "codeEvidence"],
      });
    }
    if (capability.reviewStatus === "pending" && capability.reviewedAt !== null) {
      context.addIssue({
        code: "custom",
        message: `pending review must not have a reviewedAt timestamp: ${capability.id}`,
        path: ["capabilities", index, "reviewedAt"],
      });
    }
  });
});

export type CapabilityMatrixV1 = z.infer<typeof capabilityMatrixSchema>;
export type CapabilityMatrixEntry = CapabilityMatrixV1["capabilities"][number];

export function parseCapabilityMatrix(candidate: unknown): CapabilityMatrixV1 {
  const parsed = capabilityMatrixSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const issuePath = firstIssue?.path.length ? firstIssue.path.join(".") : "matrix";
    throw new Error(
      `Invalid Sufeiya capability matrix at ${issuePath}: ${firstIssue?.message ?? "unknown issue"}`,
    );
  }
  return parsed.data;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export const CAPABILITY_MATRIX = deepFreeze(parseCapabilityMatrix(capabilityMatrixJson));

export function publicCapabilityMatrixSummary() {
  return {
    protocolVersion: CAPABILITY_MATRIX.protocolVersion,
    asOf: CAPABILITY_MATRIX.effectiveAt,
    defaultDisposition: CAPABILITY_MATRIX.defaultDisposition,
    capabilities: CAPABILITY_MATRIX.capabilities.map((capability) => ({
      id: capability.id,
      name: capability.userFacingName,
      summary: capability.publicSummary,
      status: capability.status,
      reviewStatus: capability.reviewStatus,
      accessCondition: capability.accessCondition,
      dataLocations: capability.dataLocations,
      externalVendors: capability.externalVendors,
      humanQueue: capability.humanQueue,
      releaseGate: capability.releaseGate,
    })),
  };
}
