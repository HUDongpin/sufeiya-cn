export const SUFEIYA_BETA_ACCESS_PROTOCOL = "sufeiya_invite_only_beta_v1" as const;
export const SUFEIYA_BETA_ACCESS_METADATA_KEY = "sufeiyaBetaAccess" as const;
export const SUFEIYA_BETA_ACCESS_CONTEXT_HEADER = "x-sufeiya-beta-access-context" as const;

export type SufeiyaBetaAccessContext =
  | "approved"
  | "invitation_required"
  | "verification_unavailable"
  | "signed_out"
  | "not_checked";

export type SufeiyaBetaAccessDecision = Readonly<{
  approved: boolean;
  context: Extract<
    SufeiyaBetaAccessContext,
    "approved" | "invitation_required" | "verification_unavailable"
  >;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function betaAccessFromPublicMetadata(metadata: unknown): SufeiyaBetaAccessDecision {
  if (!isRecord(metadata)) {
    return { approved: false, context: "invitation_required" };
  }

  const access = metadata[SUFEIYA_BETA_ACCESS_METADATA_KEY];
  if (
    !isRecord(access)
    || access.protocolVersion !== SUFEIYA_BETA_ACCESS_PROTOCOL
    || access.status !== "approved"
  ) {
    return { approved: false, context: "invitation_required" };
  }

  return { approved: true, context: "approved" };
}

export function betaAccessFromSessionClaims(claims: unknown): SufeiyaBetaAccessDecision {
  if (!isRecord(claims) || !Object.hasOwn(claims, SUFEIYA_BETA_ACCESS_METADATA_KEY)) {
    return { approved: false, context: "verification_unavailable" };
  }

  return betaAccessFromPublicMetadata({
    [SUFEIYA_BETA_ACCESS_METADATA_KEY]: claims[SUFEIYA_BETA_ACCESS_METADATA_KEY],
  });
}

export function betaAccessContextFromHeader(value: string | null): SufeiyaBetaAccessContext {
  if (
    value === "approved"
    || value === "invitation_required"
    || value === "verification_unavailable"
    || value === "signed_out"
    || value === "not_checked"
  ) {
    return value;
  }
  return "verification_unavailable";
}

export function hasClerkInvitationTicket(value: string | string[] | undefined) {
  return typeof value === "string"
    && value.length >= 16
    && value.length <= 2_048
    && !/[\s<>&"']/.test(value);
}
