# Sufeiya Learning Event Contract v1

This contract describes a privacy-minimized internal event envelope. It is xAPI-ready, not an xAPI implementation. Runtime event emission is disabled, and no production LRS is configured or contacted by this contract.

## Source files

- Registry: `data/sufeiya-learning-event-register-v1.json`
- JSON Schema: `schemas/sufeiya-learning-event-v1.schema.json`
- Synthetic examples: `data/sufeiya-learning-event-examples-v1.json`
- Verifier: `scripts/verify-learning-event-contract.mjs`
- Architecture decision: `docs/decisions/0001-xapi-ready-lrs-deferred.md`

## Envelope

Every accepted event contains:

| Field | Purpose |
| --- | --- |
| `contractId`, `schemaVersion` | Freeze the interpretation of the record. |
| `eventId` | UUID v4 unique to the immutable event. |
| `idempotencyKey` | Exact `evt:<eventId>` derivative; it cannot carry caller text. |
| `eventType` | One registered canonical semantic event. |
| `occurredAt`, `recordedAt` | Learner-device occurrence time and accepted-record time, each in exact 24-character UTC millisecond form (`YYYY-MM-DDTHH:mm:ss.sssZ`). |
| `subject` | CSPRNG UUID alias, subject class, assurance class, and assigning boundary. |
| `source` | Exact registered application-release alias, locale, surface, and event-source protocol. |
| `context` | Event-layer UUID aliases for business-chain records and causation/supersession links. |
| `activity` | Exact registry-cataloged `https://sufeiya.cn/activities/...` IRI, version, and activity kind. |
| `attributes` | Bounded numbers, enums, and the registered quality-flag bitmask only; no arbitrary metadata. |
| `privacy` | Constants proving the envelope contains no direct identifier, free text, raw response, audio, or conversation content. |
| `governance` | Data-use, notice, retention, and—only for a future pilot—consent receipt. |

Unknown fields are rejected even when their value is empty or `null`. The registry also defines separate required and optional context/attribute keys for every event type, so a field that is valid for Sofia support cannot be inserted into a diagnostic event. Fixed values and compatibility matrices reject individually valid but jointly false claims, such as “skipped + matched,” “Reading activity + Listening skill,” “reopened by automated practice,” or “AI answer without a model attempt.” The serialized envelope must not exceed 2 KiB; verification exercises every complete event shape with maximum-width registered values rather than testing only minimal examples.

## Canonical taxonomy

The v1 registry contains fourteen core business events and one optional P1 support-usage event:

1. `learning_cycle.started`
2. `learning_cycle.superseded`
3. `diagnostic_task.terminal`
4. `diagnostic.completed`
5. `plan.committed`
6. `recommendation.decided`
7. `planned_task.status_changed`
8. `practice_attempt.finalized`
9. `focus_session.ended`
10. `check_in.committed`
11. `review.confirmed`
12. `peer_help.preference_recorded`
13. `retest.completed`
14. `learning_cycle.completed`
15. `learning_support.interaction_finished` (P1, internal-only by default)

The taxonomy intentionally avoids duplicate events:

- Diagnostic completion includes the learner-confirmed priority; there is no second `priority_skill.confirmed` event.
- Recommendation acceptance and skipping are one event with a `decision` enum.
- A focus session produces one terminal event with an `outcome`; timer ticks and pause/resume actions are not events.
- Updated-plan confirmation closes the cycle in `learning_cycle.completed`; there is no duplicate `plan.updated` event for the same atomic commit.
- Practice completion and a resulting plan-task status change are separate business objects. When both occur, the latter uses `causationEventId` so reports do not count them as two independent learning sessions.
- `learning_cycle.superseded` is emitted only when an unfinished predecessor and a successor cycle are committed together. Reset-without-successor and the archival of an already completed cycle do not emit it.

The synthetic peer-help preference is retained as an internal state event but is not xAPI-eligible because it does not prove a real peer interaction. Sofia usage is P1 and not xAPI-eligible because viewing an answer is product/support telemetry rather than portable learning evidence.

## Data that may be represented

- stable activity and task versions;
- skill enum;
- terminal status or decision enum;
- bounded duration, count, word-count, or self-check count;
- evidence type and confidence enum;
- a bounded integer quality-flag mask whose bit order is frozen in the registry;
- task-set SHA-256 digest;
- response mode and aggregate support outcome without content.

Canonical diagnostic terminal states, evidence confidence, and quality-flag bit positions reuse the frozen Gate A vocabulary, including `evidence_insufficient`, `medium`, `audio_not_completed`, `transcript_used`, and `writing_paste_detected`; the event layer does not silently rename them. The bitmask retains the exact registered meanings without repeating as many as 21 long strings in every event, and a per-skill mask prevents Reading from claiming audio flags or Speaking from claiming writing flags. Terminal-state/skill rules likewise reserve `unavailable` for Listening and `evidence_insufficient` for the current Writing completion condition. Practice duration is absent because the current practice records do not measure it; practice `attemptCount` is limited to Reading/Listening, `wordCount` to Writing, and `selfCheckCount` to Writing/Speaking. A focus event separates required `plannedDurationMs` from optional `activeDurationMs`, and never substitutes planned time for observed active time. Retest currently carries only evidence type plus Writing `wordCount`; it does not invent duration, self-check counts, or quality flags that the current retest record does not store.

`taskSetDigest` must match a digest registered in the event registry; a merely SHA-256-shaped value is rejected. Source protocol and notice versions are also allowlisted. Activity IDs and versions must match an exact first-party catalog entry, and skill-specific activities are bound to their cataloged Reading, Listening, Writing, or Speaking value. Base-plan focus is limited to the four diagnostic skills; the learner-confirmed post-retest focus may also be `Balanced`, matching the current Gate A UI. App releases are not accepted merely because they look hexadecimal: each 7–12-character alias must be an exact release-manifest member and a prefix of its recorded full Git commit. None of these fields accepts a caller-supplied URL or descriptive string.

`skipped`, `unavailable`, `needs_retry`, and `not_assessed` are not zero scores and are never converted into failure or ability claims. Writing, speaking, retest, or self-review events cannot express an official DET score, predicted score, growth claim, or formal diagnosis.

## Data that is always rejected

- name, email, phone, address, student number, school or class identity;
- raw Clerk/OAuth IDs, JWTs, session tokens, cookies, authorization headers, API keys, IP addresses, or device fingerprints;
- question text, selected-answer text, writing, drafts, check-in text, clipboard data, or arbitrary notes;
- audio, recording references, transcripts, media URLs, object-storage keys, attachments, Base64, or blobs;
- Sofia questions, answers, prompts, model output, conversation summaries, tool calls, or reasoning;
- arbitrary `metadata`, `payload`, `details`, `properties`, or other unregistered objects;
- per-keypress, scroll, pointer, timer-tick, audio-progress, render, or hover signals.

Rejected values are never echoed in logs. Validation returns only a stable error code and field path. Invalid input is rejected; it is never silently cleaned and saved. Variable IDs are UUID v4 aliases; idempotency is derived from `eventId`; release, activity, protocol, notice, and digest values come from registries. Exact UTC timestamp width prevents arbitrary digits or text from being hidden in fractional seconds. The remaining bounded-string checks also reject percent-encoded and readable Base64/Base64URL content. This avoids treating regex-based “PII detection” as the primary privacy boundary.

## Identity mapping

`subject.subjectId` is `anon_<uuid-v4>` for `anonymous_installation` or `sub_<uuid-v4>` for `registered_account`, assigned by the declared local-runtime or Sufeiya identity boundary using a cryptographically secure random generator. The prefix and subject type are validated together. The UUID must not be derived from an email, phone, Clerk ID, device fingerprint, or another identity value.

JSON Schema can verify UUID shape, not randomness or provenance. Because runtime emission is disabled in this release, the future producer/acceptance implementation must separately prove CSPRNG generation, reject caller-selected aliases, and test the domain-record-to-alias binding before any event persistence is enabled.

Every context ID is also an event-layer UUID v4 alias. Subject, event, consent, and context-record aliases must be pairwise distinct inside one envelope, preventing two different record roles from being silently conflated. An alias is not the current prefixed localStorage business ID, a Clerk session ID, JWT, browser fingerprint, IP-derived value, or an attempt to identify the same anonymous learner across devices. A future first-party acceptance service must resolve these aliases against the committed domain-record chain; the event never copies the original business identifier. Long chains use the cycle/plan alias plus `causationEventId` instead of repeating every predecessor, keeping the record below 2 KiB.

For a future approved LRS delivery, the server creates a tenant-scoped pseudonym and maps it to an xAPI account:

```json
{
  "objectType": "Agent",
  "account": {
    "homePage": "https://sufeiya.cn",
    "name": "tenant_scoped_random_subject"
  }
}
```

The mapping table stays in the first-party identity boundary. It is not placed in the event or sent to the LRS.

## Draft xAPI mapping

The registry targets xAPI 2.0 and reserves a provisional verb IRI and activity-type IRI for eligible events. A future mapper would use:

- `eventId` as the xAPI Statement `id`;
- the external tenant-scoped subject as `actor.account`;
- the registry verb as `verb.id`;
- `activity.activityId` as `object.id`;
- the registry activity type as `object.definition.type`;
- `context.registrationId` as standard `context.registration`;
- `occurredAt` as Statement `timestamp`, provided the future server mapper confirms it is not later than projection time under a separately approved clock-skew tolerance; an out-of-policy future value is held or rejected, never sent;
- LRS-assigned `stored` time, never `recordedAt`, as Statement `stored`;
- a measured `durationMs` or `activeDurationMs`, converted from milliseconds to ISO 8601:2004 Duration with no more than 0.01-second precision, as `result.duration` when that event has measured time;
- `plannedDurationMs` only in an approved extension or omitted, never misrepresented as observed `result.duration`;
- bounded outcome and evidence fields in `result` or approved extensions, with other chain IDs in approved context extensions.

These mappings are drafts. Custom Sufeiya IRIs must be published in a reviewed xAPI Profile before production delivery. No endpoint, credential, request header, or network client belongs in this contract.

## Governance rules

- `local_only_demo` pairs with `local_device`, `local_runtime`, the registered Gate A notice, and `local_until_cleared`; it never leaves the browser under this decision.
- `first_party_learning_record` requires an authenticated account and first-party account-lifecycle controls. No notice currently authorizes this data use, so v1 validation blocks it today.
- `consented_xapi_pilot` requires an authenticated account, a consent receipt, a bounded pilot retention class, and a separately approved server-side delivery process. No pilot notice is registered today.
- The application database is authoritative; an LRS is a downstream replica.
- Delivery is asynchronous and idempotent. LRS failure cannot roll back or block the learner's first-party save.
- LLM prompts receive aggregate learning summaries, never raw event history by default.

For the optional internal Sofia event, `requestId` is a UUID and is required only after a structured server response exists. Network failures may end with no request ID or teacher mode. Successful responses reuse the current `ai_grounded`, `manual_grounded`, `policy_refusal`, `insufficient_sources`, and `handoff` modes; they carry only a bounded aggregate citation count of 1–12, never citation text or URLs. Conditional validation prevents incompatible mode/outcome/model-attempt/handoff combinations.

## Versioning

Additive changes that remain within the existing meaning may update the registry documentation while keeping schema version 1. Any new free-form field, identity behavior, event reinterpretation, required field, or incompatible enum change requires a new contract version and an explicit migration decision.

## Verification

Run:

```bash
npm run check:event-contract
```

The verifier checks registry/schema agreement, release-manifest membership, exact activity/skill membership, per-event allowlists, cross-field semantic matrices, source-code vocabulary drift, positive examples, all registered event shapes, maximum-width 2 KiB fixtures, approved task-set digests/protocols/notices, strict UTC timestamps, typed UUID aliases and derived idempotency, privacy constants, quality-flag bit bounds, forbidden and encoded values, governance pairings, duplicate semantics, provisional xAPI status, and known LRS runtime/config/dependency markers. It also proves that current runtime files do not reference this design-only contract. Static marker scanning is defense in depth, not proof against an intentionally disguised generic network sink; production enablement therefore still requires an explicit code-diff and data-flow review.
