import { evaluateReleaseSurface } from "@/lib/release-governance";

export const SOFIA_TTS_MODEL = "qwen3-tts-vc-realtime-2026-01-15";
export const SOFIA_VOICE_DISCLOSURE_VERSION = "sofia_voice_disclosure_v1";

type Environment = Record<string, string | undefined>;
type ReviewStatus = "approved" | "pending_review";

const TRANSPORT_IMPLEMENTED = false;

function reviewStatus(value: string | undefined): ReviewStatus {
  return value === "approved" ? "approved" : "pending_review";
}

function approvedRegion(value: string | undefined) {
  return value === "beijing" || value === "singapore" ? value : null;
}

export function sofiaVoiceReleaseStatus(environment: Environment = process.env) {
  const authorizationEvidenceStatus = reviewStatus(environment.SUFEIYA_VOICE_AUTHORIZATION_STATUS);
  const dataFlowStatus = reviewStatus(environment.SUFEIYA_VOICE_DATA_FLOW_STATUS);
  const deletionProcedureStatus = reviewStatus(environment.SUFEIYA_VOICE_DELETION_STATUS);
  const voiceProfileApproved = environment.SUFEIYA_VOICE_PROFILE_APPROVED === "true";
  const outputRequested = environment.SUFEIYA_VOICE_OUTPUT_ENABLED === "true";
  const microphoneRequested = environment.SUFEIYA_MIC_INPUT_ENABLED === "true";
  const modelMatches = (environment.SUFEIYA_TTS_MODEL || SOFIA_TTS_MODEL) === SOFIA_TTS_MODEL;
  const region = approvedRegion(environment.DASHSCOPE_REGION);
  const requestedModel = environment.SUFEIYA_TTS_MODEL || SOFIA_TTS_MODEL;
  const outputGovernance = evaluateReleaseSurface("sofia_voice_output", {
    provider: "dashscope",
    model: requestedModel,
    region,
    dataMode: "voice_clone_output",
  });
  const microphoneGovernance = evaluateReleaseSurface("sofia_microphone_input", {
    provider: "dashscope",
    model: requestedModel,
    region,
    dataMode: "microphone_input_realtime_voice",
  });
  const voiceIdConfigured = Boolean(environment.SUFEIYA_QWEN_VOICE_ID?.trim());
  const evidenceApproved = authorizationEvidenceStatus === "approved" &&
    dataFlowStatus === "approved" &&
    deletionProcedureStatus === "approved";
  const configuredPrerequisitesMet = evidenceApproved &&
    voiceProfileApproved &&
    modelMatches &&
    Boolean(region) &&
    voiceIdConfigured;
  const outputPrerequisitesMet = configuredPrerequisitesMet && outputGovernance.enabled;
  const microphonePrerequisitesMet = configuredPrerequisitesMet && microphoneGovernance.enabled;
  const governanceBlocked = (outputRequested && !outputGovernance.enabled) ||
    (microphoneRequested && !microphoneGovernance.enabled);

  return {
    status: governanceBlocked
      ? "disabled_pending_governance"
      : configuredPrerequisitesMet && (outputRequested || microphoneRequested)
        ? "disabled_not_implemented"
        : "disabled_pending_evidence",
    ttsEnabled: TRANSPORT_IMPLEMENTED && outputPrerequisitesMet && outputRequested,
    microphoneEnabled: TRANSPORT_IMPLEMENTED && microphonePrerequisitesMet && microphoneRequested,
    transportImplemented: TRANSPORT_IMPLEMENTED,
    outputRequested,
    microphoneRequested,
    voiceProfileApproved,
    voiceIdConfigured,
    authorizationEvidenceStatus,
    dataFlowStatus,
    deletionProcedureStatus,
    model: SOFIA_TTS_MODEL,
    modelMatches,
    region,
    asrModel: null,
    disclosureVersion: SOFIA_VOICE_DISCLOSURE_VERSION,
    governanceProtocolVersion: outputGovernance.protocolVersion,
    outputGovernanceStatus: outputGovernance.status,
    microphoneGovernanceStatus: microphoneGovernance.status,
    outputGovernanceReasonCode: outputGovernance.reasonCode,
    microphoneGovernanceReasonCode: microphoneGovernance.reasonCode,
    outputBlockedDecisionIds: outputGovernance.blockedControlIds,
    microphoneBlockedDecisionIds: microphoneGovernance.blockedControlIds,
    outputBlockedBindingIds: outputGovernance.blockedBindingIds,
    microphoneBlockedBindingIds: microphoneGovernance.blockedBindingIds,
  } as const;
}
