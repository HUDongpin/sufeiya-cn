import {
  RELEASE_DECISION_REGISTER,
  RELEASE_SURFACES,
  releaseGovernanceSummary,
} from "@/lib/release-governance";

export async function GET() {
  const summary = releaseGovernanceSummary();
  const surfaces = Object.fromEntries(
    RELEASE_SURFACES.map((surface) => {
      const evaluation = summary[surface];
      return [surface, {
        enabled: evaluation.enabled,
        status: evaluation.status,
        reasonCode: evaluation.reasonCode,
        blockedDecisionIds: evaluation.blockedControlIds,
        blockedBindingIds: evaluation.blockedBindingIds,
      }];
    }),
  );

  return Response.json({
    protocolVersion: RELEASE_DECISION_REGISTER.protocolVersion,
    effectiveAt: RELEASE_DECISION_REGISTER.effectiveAt,
    nextRegisterReviewAt: RELEASE_DECISION_REGISTER.nextRegisterReviewAt,
    registerReviewStatus: RELEASE_DECISION_REGISTER.registerReviewStatus,
    defaultDisposition: RELEASE_DECISION_REGISTER.defaultDisposition,
    environmentPolicy: RELEASE_DECISION_REGISTER.environmentPolicy,
    mode: "sanitized_read_only_status",
    surfaces,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Sufeiya-Governance-Mode": "read-only-no-mutations",
    },
  });
}
