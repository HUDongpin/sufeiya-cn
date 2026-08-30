import {
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
  releaseGovernanceSummary,
} from "@/lib/release-governance";
import { publicCapabilityMatrixSummary } from "@/lib/capability-matrix";
import { P0_DECISION_PROTOCOL, summarizeP0DecisionLog } from "@/lib/p0-decision-log";
import { sourceGovernanceSummary } from "@/lib/super-teacher/sources";

export async function GET() {
  const summary = releaseGovernanceSummary();
  const p0Summary = summarizeP0DecisionLog();
  const sourceSummary = sourceGovernanceSummary();
  const capabilityMatrix = publicCapabilityMatrixSummary();
  const surfaces = Object.fromEntries(
    RELEASE_SURFACES.map((surface) => {
      const evaluation = summary[surface];
      return [surface, {
        enabled: evaluation.enabled,
        status: evaluation.status,
        reasonCode: evaluation.reasonCode,
      }];
    }),
  );

  return Response.json({
    protocolVersion: RELEASE_DECISION_REGISTER.protocolVersion,
    defaultDisposition: RELEASE_DECISION_REGISTER.defaultDisposition,
    mode: "sanitized_read_only_status",
    capabilityMatrix,
    p0Gate: {
      scope: "full_platform_plan_appendix_a_29_item_decision_ledger",
      doesNotRepresent: ["public_reading_p0_release"],
      protocolVersion: p0Summary.protocolVersion,
      status: p0Summary.status,
      total: p0Summary.total,
      resolved: p0Summary.resolved,
      unresolved: p0Summary.unresolved,
      defaultDisposition: p0Summary.defaultDisposition,
      formalGate0Pass: p0Summary.formalGate0Pass,
      releaseAuthorization: p0Summary.releaseAuthorization,
    },
    sourceGovernance: sourceSummary,
    surfaces,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Sufeiya-Governance-Mode": "read-only-no-mutations",
      "X-Sufeiya-P0-Protocol": P0_DECISION_PROTOCOL,
    },
  });
}
