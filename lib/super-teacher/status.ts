import {
  SUPER_TEACHER_PROTOCOL,
  SUPER_TEACHER_STATUS_PROTOCOL,
  superTeacherStatusResponseSchema,
  type SuperTeacherStatusResponse,
} from "@/lib/super-teacher/contracts";
import { evaluateReleaseSurface } from "@/lib/release-governance";
import { teacherModelReleaseStatus } from "@/lib/super-teacher/model-runtime";
import { superTeacherSourceBoundary } from "@/lib/super-teacher/sources";

type Environment = Record<string, string | undefined>;

export function buildSuperTeacherStatusResponse(
  environment: Environment = process.env,
): SuperTeacherStatusResponse {
  const modelStatus = teacherModelReleaseStatus(environment);
  const firstPartyProcessing = evaluateReleaseSurface("sofia_first_party_text_processing");
  return superTeacherStatusResponseSchema.parse({
    protocolVersion: SUPER_TEACHER_STATUS_PROTOCOL,
    interactionProtocolVersion: SUPER_TEACHER_PROTOCOL,
    status: "gate_a_limited",
    answerMode: modelStatus.enabled ? "grounded_ai_with_local_manual_fallback" : "local_manual_grounded",
    localManualExplanationEnabled: true,
    firstPartyServerProcessingEnabled: firstPartyProcessing.enabled,
    externalModelProcessingEnabled: modelStatus.enabled,
    modelGenerationEnabled: modelStatus.enabled,
    modelConfigurationPresent: modelStatus.configured,
    modelProvider: modelStatus.provider,
    model: modelStatus.model,
    modelRegion: modelStatus.region,
    releaseGovernance: {
      protocolVersion: modelStatus.governanceProtocolVersion,
      status: modelStatus.governanceStatus,
      reasonCode: modelStatus.governanceReasonCode,
      blockedDecisionIds: modelStatus.blockedDecisionIds,
      blockedBindingIds: modelStatus.blockedBindingIds,
    },
    teacherSurfaceAccess: "public_teaser",
    interactiveTeacherAccess: "clerk_authenticated",
    modelSubmitAccess: firstPartyProcessing.enabled
      ? "clerk_authenticated"
      : "disabled_pending_first_party_processing_approval",
    learningPageAccess: "clerk_protected",
    learningDataStorage: "browser_local_not_account_bound",
    sourceBoundary: superTeacherSourceBoundary(),
  });
}
