import {
  SUPER_TEACHER_PROTOCOL,
  SUPER_TEACHER_STATUS_PROTOCOL,
  superTeacherStatusResponseSchema,
  type SuperTeacherStatusResponse,
} from "@/lib/super-teacher/contracts";
import { teacherModelReleaseStatus } from "@/lib/super-teacher/model-runtime";
import { superTeacherSourceBoundary } from "@/lib/super-teacher/sources";

type Environment = Record<string, string | undefined>;

export function buildSuperTeacherStatusResponse(
  environment: Environment = process.env,
): SuperTeacherStatusResponse {
  const modelStatus = teacherModelReleaseStatus(environment);
  return superTeacherStatusResponseSchema.parse({
    protocolVersion: SUPER_TEACHER_STATUS_PROTOCOL,
    interactionProtocolVersion: SUPER_TEACHER_PROTOCOL,
    status: "gate_a_limited",
    answerMode: modelStatus.enabled ? "grounded_ai_with_manual_fallback" : "manual_grounded_fallback",
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
    teacherSurfaceAccess: "public",
    modelSubmitAccess: "clerk_authenticated",
    learningPageAccess: "clerk_protected",
    learningDataStorage: "browser_local_not_account_bound",
    sourceBoundary: superTeacherSourceBoundary(),
  });
}
