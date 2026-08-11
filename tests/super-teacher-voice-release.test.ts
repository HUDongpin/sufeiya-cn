import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SOFIA_TTS_MODEL,
  SOFIA_VOICE_DISCLOSURE_VERSION,
  sofiaVoiceReleaseStatus,
} from "../lib/super-teacher/voice-release";

describe("Sofia voice release status", () => {
  it("is disabled and evidence-pending by default", () => {
    assert.deepEqual(sofiaVoiceReleaseStatus({}), {
      status: "disabled_pending_evidence",
      ttsEnabled: false,
      microphoneEnabled: false,
      transportImplemented: false,
      outputRequested: false,
      microphoneRequested: false,
      voiceProfileApproved: false,
      voiceIdConfigured: false,
      authorizationEvidenceStatus: "pending_review",
      dataFlowStatus: "pending_review",
      deletionProcedureStatus: "pending_review",
      model: SOFIA_TTS_MODEL,
      modelMatches: true,
      region: null,
      asrModel: null,
      disclosureVersion: SOFIA_VOICE_DISCLOSURE_VERSION,
      governanceProtocolVersion: "sufeiya_release_decisions_v1",
      outputGovernanceStatus: "blocked",
      microphoneGovernanceStatus: "blocked",
      outputGovernanceReasonCode: "decision_not_approved",
      microphoneGovernanceReasonCode: "decision_not_approved",
      outputBlockedDecisionIds: [
        "voice_written_authorization_verified",
        "voice_data_flow",
        "voice_retention_deletion",
        "voice_ai_disclosure",
        "voice_transport_security_review",
        "external_provider_region_cross_border",
      ],
      microphoneBlockedDecisionIds: [
        "microphone_input_policy",
        "voice_data_flow",
        "voice_retention_deletion",
        "voice_ai_disclosure",
        "voice_transport_security_review",
        "external_provider_region_cross_border",
      ],
      outputBlockedBindingIds: [],
      microphoneBlockedBindingIds: [],
    });
  });

  it("never enables audio merely because a DashScope key exists", () => {
    const status = sofiaVoiceReleaseStatus({
      DASHSCOPE_API_KEY: "sk-secret-is-intentionally-ignored",
      DASHSCOPE_REGION: "beijing",
    });
    assert.equal(status.ttsEnabled, false);
    assert.equal(status.microphoneEnabled, false);
    assert.equal(status.voiceIdConfigured, false);
  });

  it("remains disabled when environment claims are approved but the canonical decisions are not", () => {
    const status = sofiaVoiceReleaseStatus({
      SUFEIYA_VOICE_AUTHORIZATION_STATUS: "approved",
      SUFEIYA_VOICE_DATA_FLOW_STATUS: "approved",
      SUFEIYA_VOICE_DELETION_STATUS: "approved",
      SUFEIYA_VOICE_PROFILE_APPROVED: "true",
      SUFEIYA_VOICE_OUTPUT_ENABLED: "true",
      SUFEIYA_MIC_INPUT_ENABLED: "true",
      SUFEIYA_TTS_MODEL: SOFIA_TTS_MODEL,
      SUFEIYA_QWEN_VOICE_ID: "voice-test-id",
      DASHSCOPE_REGION: "beijing",
    });
    assert.equal(status.status, "disabled_pending_governance");
    assert.equal(status.ttsEnabled, false);
    assert.equal(status.microphoneEnabled, false);
    assert.equal(status.transportImplemented, false);
    assert.equal(status.outputGovernanceStatus, "blocked");
    assert.equal(status.microphoneGovernanceStatus, "blocked");
  });

  it("rejects unreviewed regions and model drift", () => {
    const status = sofiaVoiceReleaseStatus({
      DASHSCOPE_REGION: "auto",
      SUFEIYA_TTS_MODEL: "qwen3-tts-vc-realtime-latest",
    });
    assert.equal(status.region, null);
    assert.equal(status.modelMatches, false);
    assert.equal(status.status, "disabled_pending_evidence");
    assert.equal(status.outputGovernanceReasonCode, "binding_mismatch");
    assert.deepEqual(status.outputBlockedBindingIds, [
      "voice_supplier_model_selection.model",
    ]);
  });
});
