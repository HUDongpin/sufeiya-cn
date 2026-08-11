import {
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
  releaseGovernanceSummary,
} from "@/lib/release-governance";
import { P0_DECISION_PROTOCOL, summarizeP0DecisionLog } from "@/lib/p0-decision-log";
import { sourceGovernanceSummary } from "@/lib/super-teacher/sources";

export async function GET() {
  const summary = releaseGovernanceSummary();
  const p0Summary = summarizeP0DecisionLog();
  const sourceSummary = sourceGovernanceSummary();
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
    p0Gate: {
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
