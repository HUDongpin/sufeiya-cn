import { createHash, createHmac } from "node:crypto";

import {
  CLERK_PRODUCTION_CANONICAL_ORIGIN,
  CLERK_PRODUCTION_FRONTEND_API_HOST,
  type ClerkProductionHumanSourceSnapshot,
} from "../e2e/clerk-production/clerk-production-human-config";

export const CLERK_PRODUCTION_INVITATION_CREATE_ACK =
  "I_AUTHORIZE_ONE_PRODUCTION_CLERK_APPLICATION_INVITATION_FOR_THE_BOUND_RECIPIENT_WITH_SEVEN_DAY_EMAIL_DELIVERY_PERSISTENT_HISTORY_AND_NO_AUTOMATIC_RETRY";
export const CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION =
  "sufeiya_clerk_production_invitation_clean_launcher_v1";

export const CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS = 7;
export const CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA =
  "787142821c2714122deb3a13f5dd12dfb5b74135";
export const CLERK_PRODUCTION_INVITATION_DEPLOYMENT_ID =
  "dpl_GWc75MJEYkvr6iidFJvth7LhKRrE";
export const CLERK_PRODUCTION_INSTANCE_BINDING_PROTOCOL =
  "sufeiya_clerk_production_instance_binding_v1";
export const CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT =
  "3c26b6a4d74bb54886a15e6c91a27e5fb6578f700f73d31d7546884ff91dfd0a";
export const CLERK_PRODUCTION_INVITATION_COMMITMENT_PROTOCOL =
  "sufeiya_clerk_production_invitation_commitment_v1";
export const CLERK_PRODUCTION_RECIPIENT_COMMITMENT_PROTOCOL =
  "sufeiya_clerk_production_recipient_commitment_v1";
export const CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT_PROTOCOL =
  "sufeiya_clerk_production_provider_baseline_v1";

export const CLERK_PRODUCTION_INVITATION_METADATA = Object.freeze({
  sufeiyaBetaAccess: Object.freeze({
    protocolVersion: "sufeiya_invite_only_beta_v1",
    status: "approved",
  }),
});

export const CLERK_PRODUCTION_INVITATION_RECEIPT_CHECKS = [
  "production_instance_pass",
  "frontend_api_binding_pass",
  "public_environment_pass",
  "exact_recipient_user_absent_before",
  "exact_recipient_invitation_history_absent_before",
  "request_redirect_exact",
  "request_metadata_exact",
  "email_delivery_requested",
  "request_ignore_existing_false",
  "request_template_invitation",
  "create_response_pending",
  "create_response_metadata_exact",
  "create_response_acceptance_url_shape_pass",
] as const;

export type ClerkProductionInvitationMode = "execute" | "preflight" | "status";
type InvitationStatus = "accepted" | "expired" | "pending" | "revoked";

type ClerkProductionInvitationEnvironment = Record<string, string | undefined> & {
  SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID?: string;
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA?: string;
  SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID?: string;
  SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA?: string;
  SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK?: string;
  SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION?: string;
  SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT?: string;
  SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT?: string;
};

export type ClerkProductionProviderCounts = Readonly<{
  invitations: Readonly<Record<InvitationStatus, number>>;
  users: number;
}>;

export type ClerkProductionInvitationOwnerPublicInput = Readonly<{
  authorizationRunId: string | null;
  authorizedHelperSourceGitSha: string | null;
  authorizedRecipientCommitment: string | null;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  helperSourceGitSha: string;
  mode: ClerkProductionInvitationMode;
  providerBaselineCommitment: string | null;
  productionInstanceBindingCommitment:
    typeof CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT;
}>;

export type ClerkProductionInvitationOwnerInput = Readonly<{
  authorizationRunId: string | null;
  authorizedHelperSourceGitSha: string | null;
  authorizedRecipientCommitment: string | null;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  helperSourceGitSha: string;
  mode: ClerkProductionInvitationMode;
  providerBaselineCommitment: string | null;
  productionInstanceBindingCommitment:
    typeof CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT;
  recipientEmail: string;
  secretKey: string;
}>;

export type ClerkProductionInvitationRequest = Readonly<{
  emailAddress: string;
  expiresInDays: typeof CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS;
  ignoreExisting: false;
  notify: true;
  publicMetadata: typeof CLERK_PRODUCTION_INVITATION_METADATA;
  redirectUrl: "https://sufeiya.cn/sign-up";
  templateSlug: "invitation";
}>;

type UserLike = Readonly<{
  emailAddresses: ReadonlyArray<Readonly<{ emailAddress: string }>>;
  id: string;
  publicMetadata: unknown;
}>;

export type InvitationLike = Readonly<{
  createdAt: number;
  emailAddress: string;
  id: string;
  publicMetadata: unknown;
  revoked?: boolean;
  status: InvitationStatus;
  updatedAt: number;
  url?: string;
}>;

type Page<T> = Readonly<{ data: readonly T[]; totalCount: number }>;

type ReceiptChecks = {
  [Key in typeof CLERK_PRODUCTION_INVITATION_RECEIPT_CHECKS[number]]: true;
};

export type ClerkProductionInvitationAttemptMarker = Readonly<{
  authorizationRunId: string;
  contractExpiresInDays: typeof CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  helperSourceGitSha: string;
  instanceCommitment: typeof CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT;
  providerBaselineCommitment: string;
  protocolVersion: "sufeiya_clerk_production_invitation_attempt_v1";
  recipientCommitment: string;
  startedAt: string;
}>;

export type ClerkProductionInvitationCreationReceipt = Readonly<{
  authorizationRunId: string;
  createResponseStatus: "pending";
  checks: Readonly<ReceiptChecks>;
  acknowledgedAt: string;
  declaredVercelDeploymentGitSha: string;
  declaredVercelDeploymentId: string;
  emailDeliveryRequested: true;
  helperSourceGitSha: string;
  instanceCommitment: string;
  instanceCommitmentProtocol: typeof CLERK_PRODUCTION_INSTANCE_BINDING_PROTOCOL;
  invitationCommitment: string;
  invitationCommitmentProtocol: typeof CLERK_PRODUCTION_INVITATION_COMMITMENT_PROTOCOL;
  outcome: "acknowledged";
  protocolVersion: "sufeiya_clerk_production_invitation_creation_ack_v1";
  providerBaselineCommitment: string;
  recipientCommitment: string;
  requestedExpiresInDays: typeof CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS;
  startedAt: string;
}>;

export type ClerkProductionInvitationPostObservationReceipt = Readonly<{
  authorizationRunId: string;
  completedAt: string;
  exactUserCount: 0 | 1 | null;
  invitationCommitment: string;
  invitationStatus: InvitationStatus | null;
  observation:
    | "accepted_observed"
    | "pending_confirmed"
    | "terminal_state_observed"
    | "unavailable_or_inconsistent";
  protocolVersion: "sufeiya_clerk_production_invitation_post_observation_v1";
  providerStateCommitment: string | null;
}>;

export type ClerkProductionInvitationOwnerDependencies = Readonly<{
  assertStatusAttempt(input: ClerkProductionInvitationOwnerInput): Promise<void>;
  createInvitation(request: ClerkProductionInvitationRequest): Promise<InvitationLike>;
  now(): Date;
  persistAttempt(marker: ClerkProductionInvitationAttemptMarker): Promise<void>;
  persistCreationReceipt(receipt: ClerkProductionInvitationCreationReceipt): Promise<void>;
  persistPostObservation(
    receipt: ClerkProductionInvitationPostObservationReceipt,
  ): Promise<void>;
  readDeploymentBinding(): Promise<void>;
  readDomains(): Promise<Readonly<{
    data: ReadonlyArray<Readonly<{
      frontendApiUrl: string;
      isSatellite: boolean;
      name: string;
    }>>;
  }>>;
  readInstance(): Promise<Readonly<{
    environmentType: string;
    instanceBindingCommitment: string;
  }>>;
  readInvitations(params: Readonly<{
    limit: number;
    offset: number;
    query: string;
    status: InvitationStatus;
  }>): Promise<Page<InvitationLike>>;
  readGlobalInvitationCount(status: InvitationStatus): Promise<number>;
  readGlobalUserCount(): Promise<number>;
  readPublicEnvironment(): Promise<void>;
  readUsers(params: Readonly<{
    emailAddress: string[];
    limit: number;
    offset: number;
  }>): Promise<Page<UserLike>>;
}>;

export type ClerkProductionInvitationOwnerResult = Readonly<{
  exactInvitationCount?: number;
  exactUserCount?: number;
  helperSourceGitSha?: string;
  mode: ClerkProductionInvitationMode;
  outcome?: "acknowledged";
  providerBaselineCommitment?: string;
  providerStateCommitment?: string;
  recipientCommitment?: string;
  status:
    | "accepted_resource_compatible"
    | "ambiguous"
    | "expired_resource_compatible"
    | "inconsistent"
    | "none"
    | "pending"
    | "pending_resource_compatible"
    | "revoked_resource_compatible"
    | "ready";
}>;

const INPUT_ERROR =
  "Clerk Production invitation Owner command refused unsafe or incomplete input.";
const COMMAND_LINE_ERROR =
  "Clerk Production invitation Owner command requires the exact direct command.";
const PROVIDER_BOUNDARY_ERROR =
  "Clerk Production invitation Owner command refused the Production provider boundary.";
const BASELINE_ERROR =
  "Clerk Production invitation Owner command refused the exact recipient baseline before creation.";
const RESPONSE_ERROR =
  "Clerk Production invitation Owner command refused the invitation response boundary.";
const UNKNOWN_OUTCOME_ERROR =
  "Clerk Production invitation creation outcome is unknown; do not retry and use the read-only status command.";
const POST_CREATE_STATE_ERROR =
  "Clerk Production invitation response was acknowledged but the provider post-state is not the approved pending handoff; do not retry.";

const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
const PAGE_LIMIT = 100;
const MAX_PROVIDER_RESULTS = 10_000;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value !== "object") throw new Error(RESPONSE_ERROR);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function isCanonicalUuidV4(value: string | undefined): value is string {
  return value !== undefined
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

function isRealRecipientEmail(value: string | undefined): value is string {
  if (
    value === undefined
    || value !== value.trim()
    || value !== value.toLowerCase()
    || value.length > 254
    || /[\s\0-\x1f\x7f/\\]/.test(value)
  ) return false;
  const separatorIndex = value.indexOf("@");
  if (separatorIndex < 1 || separatorIndex !== value.lastIndexOf("@")) return false;
  const local = value.slice(0, separatorIndex);
  const domain = value.slice(separatorIndex + 1);
  if (
    local.length > 64
    || local.startsWith(".")
    || local.endsWith(".")
    || local.includes("..")
    || local.includes("+clerk_test")
    || local.startsWith("sufeiya-invitation-")
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])$/.test(domain)
    || !domain.includes(".")
    || domain.includes("..")
    || domain === "example.com"
    || domain.endsWith(".example.com")
    || domain === "example.net"
    || domain.endsWith(".example.net")
    || domain === "example.org"
    || domain.endsWith(".example.org")
    || domain === "example"
    || domain.endsWith(".example")
    || domain === "clerk.dev"
    || domain.endsWith(".clerk.dev")
    || domain.endsWith(".invalid")
    || domain === "localhost"
    || domain.endsWith(".localhost")
    || domain.endsWith(".local")
    || domain.endsWith(".test")
  ) return false;
  return domain.split(".").every((label) => (
    label.length >= 1
    && label.length <= 63
    && !label.startsWith("-")
    && !label.endsWith("-")
    && /^[a-z0-9-]+$/.test(label)
  ));
}

function hasForbiddenAmbientState(environment: ClerkProductionInvitationEnvironment) {
  const allowedSufeiyaKeys = new Set([
    "SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID",
    "SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA",
    "SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID",
    "SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA",
    "SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK",
    "SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION",
    "SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT",
    "SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT",
  ]);
  const exactForbiddenKeys = new Set([
    "ALL_PROXY",
    "CI",
    "DEBUG",
    "DEBUG_FILE",
    "GITHUB_ACTIONS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NODE_DEBUG",
    "NODE_DEBUG_NATIVE",
    "NODE_EXTRA_CA_CERTS",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "NODE_USE_ENV_PROXY",
    "NO_PROXY",
    "OPENSSL_CONF",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SSLKEYLOGFILE",
    "VERCEL",
  ]);
  const lowercaseProxyKeys = new Set([
    "all_proxy",
    "http_proxy",
    "https_proxy",
    "no_proxy",
  ]);
  return Object.entries(environment).some(([key, value]) => {
    if (value === undefined || value === "") return false;
    if (key.startsWith("CLERK_")) return true;
    if (key.startsWith("NEXT_PUBLIC_CLERK_")) return true;
    if (key.startsWith("SUFEIYA_CLERK_") && !allowedSufeiyaKeys.has(key)) return true;
    if (key.startsWith("GIT_") || key.startsWith("TSX_")) return true;
    return exactForbiddenKeys.has(key) || lowercaseProxyKeys.has(key);
  });
}

export function assertClerkProductionInvitationCommandLine(
  argv: readonly string[] = process.argv,
): ClerkProductionInvitationMode {
  const actual = argv.slice(2);
  if (
    actual.length !== 1
    || !(["execute", "preflight", "status"] as const).includes(
      actual[0] as ClerkProductionInvitationMode,
    )
  ) throw new Error(COMMAND_LINE_ERROR);
  return actual[0] as ClerkProductionInvitationMode;
}

export function getClerkProductionInvitationOwnerPublicInput(
  source: ClerkProductionHumanSourceSnapshot,
  mode: ClerkProductionInvitationMode,
  interactive: boolean,
  environment: ClerkProductionInvitationEnvironment = process.env,
): ClerkProductionInvitationOwnerPublicInput {
  if (hasForbiddenAmbientState(environment)) throw new Error(INPUT_ERROR);
  const authorizationRunId = environment.SUFEIYA_CLERK_PRODUCTION_AUTHORIZATION_RUN_ID;
  const createAck = environment.SUFEIYA_CLERK_PRODUCTION_INVITATION_CREATE_ACK;
  const launcherAttestation =
    environment.SUFEIYA_CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION;
  const authorizedHelperSourceGitSha =
    environment.SUFEIYA_CLERK_PRODUCTION_HELPER_SOURCE_GIT_SHA;
  const providerBaselineCommitment =
    environment.SUFEIYA_CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT;
  const authorizedRecipientCommitment =
    environment.SUFEIYA_CLERK_PRODUCTION_RECIPIENT_COMMITMENT;
  const declaredVercelDeploymentGitSha =
    environment.SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_GIT_SHA;
  const declaredVercelDeploymentId = environment.SUFEIYA_CLERK_PRODUCTION_DEPLOYMENT_ID;
  const executeInputValid = mode !== "execute" || (
    interactive
    && createAck === CLERK_PRODUCTION_INVITATION_CREATE_ACK
    && isCanonicalUuidV4(authorizationRunId)
    && typeof providerBaselineCommitment === "string"
    && /^[0-9a-f]{64}$/.test(providerBaselineCommitment)
    && typeof authorizedRecipientCommitment === "string"
    && /^[0-9a-f]{64}$/.test(authorizedRecipientCommitment)
    && authorizedHelperSourceGitSha === source.gitSha
  );
  const statusInputValid = mode !== "status" || (
    createAck === undefined
    && isCanonicalUuidV4(authorizationRunId)
    && providerBaselineCommitment === undefined
    && authorizedRecipientCommitment === undefined
    && authorizedHelperSourceGitSha === undefined
  );
  const preflightInputValid = mode !== "preflight" || (
    (createAck === undefined || createAck === "")
    && isCanonicalUuidV4(authorizationRunId)
    && (providerBaselineCommitment === undefined || providerBaselineCommitment === "")
    && (
      authorizedRecipientCommitment === undefined
      || authorizedRecipientCommitment === ""
    )
    && (
      authorizedHelperSourceGitSha === undefined
      || authorizedHelperSourceGitSha === ""
    )
  );

  if (
    !interactive
    || launcherAttestation !== CLERK_PRODUCTION_INVITATION_LAUNCHER_ATTESTATION
    || !source.clean
    || !/^[0-9a-f]{40}$/.test(source.gitSha)
    || declaredVercelDeploymentGitSha
      !== CLERK_PRODUCTION_INVITATION_DEPLOYMENT_GIT_SHA
    || declaredVercelDeploymentId !== CLERK_PRODUCTION_INVITATION_DEPLOYMENT_ID
    || !executeInputValid
    || !statusInputValid
    || !preflightInputValid
  ) throw new Error(INPUT_ERROR);

  return Object.freeze({
    authorizationRunId: authorizationRunId || null,
    authorizedHelperSourceGitSha: authorizedHelperSourceGitSha || null,
    authorizedRecipientCommitment: authorizedRecipientCommitment || null,
    declaredVercelDeploymentGitSha,
    declaredVercelDeploymentId,
    helperSourceGitSha: source.gitSha,
    mode,
    providerBaselineCommitment: providerBaselineCommitment || null,
    productionInstanceBindingCommitment:
      CLERK_PRODUCTION_INSTANCE_BINDING_COMMITMENT,
  });
}

export function getClerkProductionInvitationOwnerInput(
  publicInput: ClerkProductionInvitationOwnerPublicInput,
  sensitiveInput: Readonly<{ recipientEmail: string; secretKey: string }>,
): ClerkProductionInvitationOwnerInput {
  const { recipientEmail, secretKey } = sensitiveInput;
  if (
    secretKey !== secretKey.trim()
    || secretKey.length > 512
    || !/^sk_live_[A-Za-z0-9_-]{12,}$/.test(secretKey)
    || !isRealRecipientEmail(recipientEmail)
  ) throw new Error(INPUT_ERROR);
  const input = Object.freeze({
    ...publicInput,
    recipientEmail,
    secretKey,
  });
  if (
    input.mode === "execute"
    && input.authorizedRecipientCommitment
      !== buildClerkProductionRecipientCommitment(input)
  ) throw new Error(INPUT_ERROR);
  return input;
}

export function buildClerkProductionInvitationRequest(
  recipientEmail: string,
): ClerkProductionInvitationRequest {
  if (!isRealRecipientEmail(recipientEmail)) throw new Error(INPUT_ERROR);
  return Object.freeze({
    emailAddress: recipientEmail,
    expiresInDays: CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS,
    ignoreExisting: false,
    notify: true,
    publicMetadata: CLERK_PRODUCTION_INVITATION_METADATA,
    redirectUrl: `${CLERK_PRODUCTION_CANONICAL_ORIGIN}/sign-up`,
    templateSlug: "invitation",
  });
}

function normalizeFrontendApiHost(value: string) {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function readAllPages<T>(
  readPage: (offset: number) => Promise<Page<T>>,
): Promise<T[]> {
  const collected: T[] = [];
  let expectedTotal: number | null = null;
  for (;;) {
    const page = await readPage(collected.length);
    if (
      !Number.isSafeInteger(page.totalCount)
      || page.totalCount < 0
      || page.totalCount > MAX_PROVIDER_RESULTS
      || page.data.length > PAGE_LIMIT
      || (expectedTotal !== null && page.totalCount !== expectedTotal)
    ) throw new Error(PROVIDER_BOUNDARY_ERROR);
    expectedTotal ??= page.totalCount;
    collected.push(...page.data);
    if (collected.length === expectedTotal) return collected;
    if (collected.length > expectedTotal || page.data.length === 0) {
      throw new Error(PROVIDER_BOUNDARY_ERROR);
    }
  }
}

async function readExactUsers(
  dependencies: ClerkProductionInvitationOwnerDependencies,
  recipientEmail: string,
) {
  const users = await readAllPages((offset) => dependencies.readUsers({
    emailAddress: [recipientEmail],
    limit: PAGE_LIMIT,
    offset,
  }));
  const exactUsers = users.filter((user) => user.emailAddresses.some(
    (email) => email.emailAddress.toLowerCase() === recipientEmail,
  ));
  const exactUserIds = new Set<string>();
  for (const user of exactUsers) {
    if (!/^user_[A-Za-z0-9_-]{1,249}$/.test(user.id) || exactUserIds.has(user.id)) {
      throw new Error(PROVIDER_BOUNDARY_ERROR);
    }
    exactUserIds.add(user.id);
  }
  return exactUsers;
}

async function readExactInvitations(
  dependencies: ClerkProductionInvitationOwnerDependencies,
  recipientEmail: string,
) {
  const exactById = new Map<string, InvitationLike>();
  for (const status of INVITATION_STATUSES) {
    const invitations = await readAllPages((offset) => dependencies.readInvitations({
      limit: PAGE_LIMIT,
      offset,
      query: recipientEmail,
      status,
    }));
    for (const candidate of invitations) {
      if (candidate.emailAddress.toLowerCase() !== recipientEmail) continue;
      const existing = exactById.get(candidate.id);
      if (existing) throw new Error(PROVIDER_BOUNDARY_ERROR);
      exactById.set(candidate.id, candidate);
    }
  }
  return [...exactById.values()];
}

function assertProductionProviderBinding(
  input: ClerkProductionInvitationOwnerInput,
  instance: Readonly<{
    environmentType: string;
    instanceBindingCommitment: string;
  }>,
  domains: Readonly<{
    data: ReadonlyArray<Readonly<{
      frontendApiUrl: string;
      isSatellite: boolean;
      name: string;
    }>>;
  }>,
) {
  const exactDomains = domains.data.filter((domain) => (
    domain.name === "sufeiya.cn"
    && domain.isSatellite === false
    && normalizeFrontendApiHost(domain.frontendApiUrl)
      === CLERK_PRODUCTION_FRONTEND_API_HOST
  ));
  if (
    instance.instanceBindingCommitment
      !== input.productionInstanceBindingCommitment
    || instance.environmentType !== "production"
    || exactDomains.length !== 1
  ) throw new Error(PROVIDER_BOUNDARY_ERROR);
}

function assertExactInvitationResponse(
  invitation: InvitationLike,
  input: ClerkProductionInvitationOwnerInput,
) {
  try {
    assertExactInvitationReadback(invitation, input);
  } catch {
    throw new Error(RESPONSE_ERROR);
  }
  if (invitation.status !== "pending" || invitation.revoked === true || !invitation.url) {
    throw new Error(RESPONSE_ERROR);
  }
  assertAcceptanceUrl(invitation.url);
}

function assertAcceptanceUrl(value: string) {
  let acceptanceUrl: URL;
  try {
    acceptanceUrl = new URL(value);
  } catch {
    throw new Error(RESPONSE_ERROR);
  }
  const queryKeys = [...acceptanceUrl.searchParams.keys()];
  const ticketValues = acceptanceUrl.searchParams.getAll("ticket");
  if (
    acceptanceUrl.protocol !== "https:"
    || acceptanceUrl.host !== CLERK_PRODUCTION_FRONTEND_API_HOST
    || acceptanceUrl.pathname !== "/v1/tickets/accept"
    || acceptanceUrl.username
    || acceptanceUrl.password
    || acceptanceUrl.hash
    || queryKeys.length !== 1
    || queryKeys[0] !== "ticket"
    || ticketValues.length !== 1
    || ticketValues[0].length < 16
    || ticketValues[0].length > 4_096
    || /[\s<>&"']/.test(ticketValues[0])
  ) throw new Error(RESPONSE_ERROR);
}

function assertExactInvitationReadback(
  invitation: InvitationLike,
  input: ClerkProductionInvitationOwnerInput,
) {
  if (
    !/^inv_[A-Za-z0-9_-]{1,249}$/.test(invitation.id)
    || invitation.emailAddress.toLowerCase() !== input.recipientEmail
    || !INVITATION_STATUSES.includes(invitation.status)
    || !Number.isSafeInteger(invitation.createdAt)
    || !Number.isSafeInteger(invitation.updatedAt)
    || (
      invitation.status === "revoked"
        ? invitation.revoked !== true
        : invitation.revoked === true
    )
    || canonicalJson(invitation.publicMetadata)
      !== canonicalJson(CLERK_PRODUCTION_INVITATION_METADATA)
  ) throw new Error(PROVIDER_BOUNDARY_ERROR);
  if (invitation.url !== undefined) assertAcceptanceUrl(invitation.url);
}

function commitment(protocol: string, runId: string, opaqueId: string) {
  return createHash("sha256")
    .update(`${protocol}\0${runId}\0${opaqueId}`)
    .digest("hex");
}

export function buildClerkProductionProviderBaselineCommitment(
  counts: ClerkProductionProviderCounts,
) {
  const values = [
    counts.users,
    counts.invitations.pending,
    counts.invitations.accepted,
    counts.invitations.revoked,
    counts.invitations.expired,
  ];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(PROVIDER_BOUNDARY_ERROR);
  }
  return createHash("sha256")
    .update(
      `${CLERK_PRODUCTION_PROVIDER_BASELINE_COMMITMENT_PROTOCOL}\0${values.join("\0")}`,
    )
    .digest("hex");
}

export function buildClerkProductionInstanceBindingCommitment(instanceId: string) {
  if (!/^ins_[A-Za-z0-9_-]{1,249}$/.test(instanceId)) {
    throw new Error(PROVIDER_BOUNDARY_ERROR);
  }
  return createHash("sha256")
    .update(`${CLERK_PRODUCTION_INSTANCE_BINDING_PROTOCOL}\0${instanceId}`)
    .digest("hex");
}

function buildAttemptMarker(
  input: ClerkProductionInvitationOwnerInput,
  startedAt: string,
): ClerkProductionInvitationAttemptMarker {
  if (!input.authorizationRunId || !input.providerBaselineCommitment) {
    throw new Error(INPUT_ERROR);
  }
  return {
    authorizationRunId: input.authorizationRunId,
    contractExpiresInDays: CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS,
    declaredVercelDeploymentGitSha: input.declaredVercelDeploymentGitSha,
    declaredVercelDeploymentId: input.declaredVercelDeploymentId,
    helperSourceGitSha: input.helperSourceGitSha,
    instanceCommitment: input.productionInstanceBindingCommitment,
    providerBaselineCommitment: input.providerBaselineCommitment,
    protocolVersion: "sufeiya_clerk_production_invitation_attempt_v1",
    recipientCommitment: buildClerkProductionRecipientCommitment(input),
    startedAt,
  };
}

export function buildClerkProductionRecipientCommitment(
  input: Readonly<{
    authorizationRunId: string | null;
    recipientEmail: string;
    secretKey: string;
  }>,
) {
  if (!input.authorizationRunId) throw new Error(INPUT_ERROR);
  return createHmac("sha256", input.secretKey)
    .update(
      `${CLERK_PRODUCTION_RECIPIENT_COMMITMENT_PROTOCOL}\0${input.authorizationRunId}\0${input.recipientEmail}`,
    )
    .digest("hex");
}

function buildCreationReceipt(
  input: ClerkProductionInvitationOwnerInput,
  invitation: InvitationLike,
  startedAt: string,
  acknowledgedAt: string,
): ClerkProductionInvitationCreationReceipt {
  if (!input.authorizationRunId || !input.providerBaselineCommitment) {
    throw new Error(INPUT_ERROR);
  }
  const checks = Object.fromEntries(
    CLERK_PRODUCTION_INVITATION_RECEIPT_CHECKS.map((key) => [key, true]),
  ) as ReceiptChecks;
  return {
    acknowledgedAt,
    authorizationRunId: input.authorizationRunId,
    checks,
    createResponseStatus: "pending",
    declaredVercelDeploymentGitSha: input.declaredVercelDeploymentGitSha,
    declaredVercelDeploymentId: input.declaredVercelDeploymentId,
    emailDeliveryRequested: true,
    helperSourceGitSha: input.helperSourceGitSha,
    instanceCommitment: input.productionInstanceBindingCommitment,
    instanceCommitmentProtocol: CLERK_PRODUCTION_INSTANCE_BINDING_PROTOCOL,
    invitationCommitment: commitment(
      CLERK_PRODUCTION_INVITATION_COMMITMENT_PROTOCOL,
      input.authorizationRunId,
      invitation.id,
    ),
    invitationCommitmentProtocol: CLERK_PRODUCTION_INVITATION_COMMITMENT_PROTOCOL,
    outcome: "acknowledged",
    protocolVersion: "sufeiya_clerk_production_invitation_creation_ack_v1",
    providerBaselineCommitment: input.providerBaselineCommitment,
    recipientCommitment: buildClerkProductionRecipientCommitment(input),
    requestedExpiresInDays: CLERK_PRODUCTION_INVITATION_EXPIRES_IN_DAYS,
    startedAt,
  };
}

function buildPostObservationReceipt(
  input: ClerkProductionInvitationOwnerInput,
  invitation: InvitationLike,
  completedAt: string,
  observation: Readonly<{
    exactUserCount: 0 | 1 | null;
    invitationStatus: InvitationStatus | null;
    outcome: ClerkProductionInvitationPostObservationReceipt["observation"];
    providerStateCommitment: string | null;
  }>,
): ClerkProductionInvitationPostObservationReceipt {
  if (!input.authorizationRunId) throw new Error(INPUT_ERROR);
  return {
    authorizationRunId: input.authorizationRunId,
    completedAt,
    exactUserCount: observation.exactUserCount,
    invitationCommitment: commitment(
      CLERK_PRODUCTION_INVITATION_COMMITMENT_PROTOCOL,
      input.authorizationRunId,
      invitation.id,
    ),
    invitationStatus: observation.invitationStatus,
    observation: observation.outcome,
    protocolVersion: "sufeiya_clerk_production_invitation_post_observation_v1",
    providerStateCommitment: observation.providerStateCommitment,
  };
}

async function readProviderState(
  input: ClerkProductionInvitationOwnerInput,
  dependencies: ClerkProductionInvitationOwnerDependencies,
) {
  const [instance, domains] = await Promise.all([
    dependencies.readInstance(),
    dependencies.readDomains(),
    dependencies.readDeploymentBinding(),
  ]);
  assertProductionProviderBinding(input, instance, domains);
  await dependencies.readPublicEnvironment();
  const [users, invitations, globalUserCount, invitationCountEntries] = await Promise.all([
    readExactUsers(dependencies, input.recipientEmail),
    readExactInvitations(dependencies, input.recipientEmail),
    dependencies.readGlobalUserCount(),
    Promise.all(INVITATION_STATUSES.map(async (status) => (
      [status, await dependencies.readGlobalInvitationCount(status)] as const
    ))),
  ]);
  const providerCounts: ClerkProductionProviderCounts = {
    invitations: Object.fromEntries(invitationCountEntries) as Record<
      InvitationStatus,
      number
    >,
    users: globalUserCount,
  };
  const exactInvitationCounts = Object.fromEntries(INVITATION_STATUSES.map((status) => [
    status,
    invitations.filter((invitation) => invitation.status === status).length,
  ])) as Record<InvitationStatus, number>;
  if (
    users.length > providerCounts.users
    || INVITATION_STATUSES.some((status) => (
      exactInvitationCounts[status] > providerCounts.invitations[status]
    ))
  ) throw new Error(PROVIDER_BOUNDARY_ERROR);
  return {
    invitations,
    providerCounts,
    providerStateCommitment:
      buildClerkProductionProviderBaselineCommitment(providerCounts),
    users,
  };
}

function statusOf(
  invitations: readonly InvitationLike[],
  users: readonly UserLike[],
) {
  if (invitations.length > 1 || users.length > 1) return "ambiguous" as const;
  if (invitations.length === 0) {
    return users.length === 0 ? "none" as const : "inconsistent" as const;
  }
  const invitationStatus = invitations[0].status;
  if (invitationStatus === "accepted") {
    return users.length === 1
      && canonicalJson(users[0].publicMetadata)
        === canonicalJson(CLERK_PRODUCTION_INVITATION_METADATA)
      ? "accepted_resource_compatible" as const
      : "inconsistent" as const;
  }
  if (users.length !== 0) return "inconsistent" as const;
  if (invitationStatus === "pending") return "pending_resource_compatible" as const;
  if (invitationStatus === "revoked") return "revoked_resource_compatible" as const;
  return "expired_resource_compatible" as const;
}

function hasExpectedPostCreateCounts(
  baseline: ClerkProductionProviderCounts,
  post: ClerkProductionProviderCounts,
  invitationStatus: InvitationStatus,
  exactUserCount: 0 | 1,
) {
  if (
    post.users !== baseline.users + (invitationStatus === "accepted" ? 1 : 0)
    || exactUserCount !== (invitationStatus === "accepted" ? 1 : 0)
  ) return false;
  return INVITATION_STATUSES.every((status) => (
    post.invitations[status]
      === baseline.invitations[status] + (status === invitationStatus ? 1 : 0)
  ));
}

export async function runClerkProductionInvitationOwner(
  input: ClerkProductionInvitationOwnerInput,
  dependencies: ClerkProductionInvitationOwnerDependencies,
): Promise<ClerkProductionInvitationOwnerResult> {
  if (input.mode === "status") {
    await dependencies.assertStatusAttempt(input);
  }
  let providerState: Awaited<ReturnType<typeof readProviderState>>;
  try {
    providerState = await readProviderState(input, dependencies);
  } catch {
    throw new Error(PROVIDER_BOUNDARY_ERROR);
  }

  if (input.mode === "status") {
    for (const invitation of providerState.invitations) {
      assertExactInvitationReadback(invitation, input);
    }
    return {
      exactInvitationCount: providerState.invitations.length,
      exactUserCount: providerState.users.length,
      mode: "status",
      providerStateCommitment: providerState.providerStateCommitment,
      status: statusOf(providerState.invitations, providerState.users),
    };
  }
  if (providerState.users.length !== 0 || providerState.invitations.length !== 0) {
    throw new Error(BASELINE_ERROR);
  }
  buildClerkProductionInvitationRequest(input.recipientEmail);
  if (input.mode === "preflight") {
    return {
      helperSourceGitSha: input.helperSourceGitSha,
      mode: "preflight",
      providerBaselineCommitment: providerState.providerStateCommitment,
      recipientCommitment: buildClerkProductionRecipientCommitment(input),
      status: "ready",
    };
  }
  if (providerState.providerStateCommitment !== input.providerBaselineCommitment) {
    throw new Error(BASELINE_ERROR);
  }

  let finalPreCreateState: Awaited<ReturnType<typeof readProviderState>>;
  try {
    finalPreCreateState = await readProviderState(input, dependencies);
  } catch {
    throw new Error(PROVIDER_BOUNDARY_ERROR);
  }
  if (
    finalPreCreateState.users.length !== 0
    || finalPreCreateState.invitations.length !== 0
    || finalPreCreateState.providerStateCommitment
      !== input.providerBaselineCommitment
  ) throw new Error(BASELINE_ERROR);

  const startedAt = dependencies.now().toISOString();
  await dependencies.persistAttempt(buildAttemptMarker(input, startedAt));

  const request = buildClerkProductionInvitationRequest(input.recipientEmail);
  let observedInvitation: InvitationLike;
  try {
    observedInvitation = await dependencies.createInvitation(request);
  } catch {
    throw new Error(UNKNOWN_OUTCOME_ERROR);
  }
  assertExactInvitationResponse(observedInvitation, input);

  const creationReceipt = buildCreationReceipt(
    input,
    observedInvitation,
    startedAt,
    dependencies.now().toISOString(),
  );
  await dependencies.persistCreationReceipt(creationReceipt);

  let postCreateObservation: Readonly<{
    exactUserCount: 0 | 1 | null;
    invitationStatus: InvitationStatus | null;
    outcome: ClerkProductionInvitationPostObservationReceipt["observation"];
    providerStateCommitment: string | null;
  }> = {
    exactUserCount: null,
    invitationStatus: null,
    outcome: "unavailable_or_inconsistent",
    providerStateCommitment: null,
  };
  try {
    const postState = await readProviderState(input, dependencies);
    const postUsers = postState.users;
    const postInvitations = postState.invitations;
    if (
      postUsers.length <= 1
      && postInvitations.length === 1
      && postInvitations[0].id === observedInvitation.id
    ) {
      assertExactInvitationReadback(postInvitations[0], input);
      const invitationStatus = postInvitations[0].status;
      const exactUserCount = postUsers.length as 0 | 1;
      if (hasExpectedPostCreateCounts(
        providerState.providerCounts,
        postState.providerCounts,
        invitationStatus,
        exactUserCount,
      ) && (
        invitationStatus !== "accepted"
        || canonicalJson(postUsers[0].publicMetadata)
          === canonicalJson(CLERK_PRODUCTION_INVITATION_METADATA)
      )) {
        postCreateObservation = {
          exactUserCount,
          invitationStatus,
          outcome: invitationStatus === "pending"
            ? "pending_confirmed"
            : invitationStatus === "accepted"
              ? "accepted_observed"
              : "terminal_state_observed",
          providerStateCommitment: postState.providerStateCommitment,
        };
      }
    }
  } catch {
    postCreateObservation = {
      exactUserCount: null,
      invitationStatus: null,
      outcome: "unavailable_or_inconsistent",
      providerStateCommitment: null,
    };
  }

  const postObservationReceipt = buildPostObservationReceipt(
    input,
    observedInvitation,
    dependencies.now().toISOString(),
    postCreateObservation,
  );
  await dependencies.persistPostObservation(postObservationReceipt);
  if (postCreateObservation.outcome !== "pending_confirmed") {
    throw new Error(POST_CREATE_STATE_ERROR);
  }
  return {
    mode: "execute",
    outcome: "acknowledged",
    status: "pending",
  };
}
