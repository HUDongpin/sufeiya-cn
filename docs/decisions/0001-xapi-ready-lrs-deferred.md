# ADR 0001: approve an xAPI-ready event contract and defer production LRS delivery

- Status: Accepted
- Decision date: 2026-08-10
- Owner: Sufeiya
- Contract: `sufeiya.learning-event.v1`

## Context

Sufeiya currently has a local-first Gate A learning journey with versioned diagnostic tasks, plans, recommendations, practice, focus sessions, evidence check-ins, learner review, a synthetic peer-help preference, retest, and an updated plan. The current browser state already carries stable business identifiers and task-set digests, but it is not yet an authenticated, cross-device, first-party learning record system.

xAPI is valuable when Sufeiya must exchange learning records with another LMS, institutional customer, research partner, or independent learning application. It is not required for the current student workflow, product analytics, cloud profile storage, or Sofia context aggregation.

## Decision

Sufeiya will maintain a strict, versioned, first-party learning-event contract that is designed for later xAPI mapping. The approved sequence is:

1. validate a canonical event against the local contract;
2. persist it atomically with the successful business transition in a future first-party learning database;
3. place an immutable copy in a future durable outbox;
4. map eligible events to xAPI on the server;
5. deliver them asynchronously to an LRS only after a separate production approval.

The first-party learning database remains authoritative. An LRS, if approved later, is a downstream interoperability replica. LRS availability must never block a learner from saving work or continuing the journey.

## Approved scope

This decision adds only design and verification artifacts:

- a machine-readable event registry;
- a JSON Schema event envelope;
- synthetic privacy-safe examples;
- a contract verifier and negative tests;
- a documented draft mapping to xAPI verbs and activity types.

It does not add a runtime event emitter or persist any new learning event.

## Explicitly deferred

This decision does not authorize or add:

- an LRS vendor account, endpoint, tenant, or store;
- an LRS SDK or runtime client;
- LRS credentials or environment variables;
- browser-to-LRS delivery;
- a database table, outbox worker, queue, cron, webhook, or statement forwarder;
- production xAPI Statements;
- historical localStorage upload;
- a change to the current learner-facing UI or data flow.

All draft xAPI mappings remain `provisional_not_for_production_delivery`. A future production mapping requires a published Sufeiya xAPI Profile, vendor endpoint verification, identity and consent controls, mainland-China network testing, retention and deletion decisions, and a separate release approval.

## Privacy and identity boundary

Events are pseudonymous metadata, not anonymous data. The contract rejects direct identifiers, free text, raw answers, writing, audio, transcripts, Sofia conversation content, authentication secrets, precise IP addresses, and device fingerprints.

Each event type has its own field allowlist and cross-field compatibility rules. Variable subject/context values are CSPRNG UUID aliases, typed subject prefixes must match their subject class, idempotency is derived from `eventId`, activity IDs/versions/skills must match an exact first-party catalog entry, and application releases/task-set digests/protocols/notices must match their registries. Timestamps have one fixed UTC millisecond shape. Caller-supplied opaque strings are not accepted as identifiers.

The internal `subjectId` is a random Sufeiya UUID alias assigned by the local runtime or identity service, never a hash of email/phone or a raw provider identifier. A future external xAPI actor must use a separate tenant-scoped pseudonym derived on the server. It must not expose an email address, phone number, raw Clerk identifier, OAuth identifier, or reusable cross-tenant identifier.

Local-device events may remain local for Gate A demonstrations, but they cannot be uploaded as a durable learner history until identity, notice, consent, and deletion controls are approved.

## Event semantics

An event is created only after the related business state has been validated and durably committed. A button click, form open, validation error, cancelled confirmation, write-lock failure, or failed localStorage write is not a learning event.

Business record IDs are not copied into the portable event. Each accepted domain record receives an event-layer UUID alias; each event has its own UUID and exact `evt:<eventId>` idempotency derivative. A future first-party acceptance service must resolve aliases against the committed domain chain. When one event causes another state transition, `causationEventId` links them. Corrections and revisions create a new event and use `supersedesEventId`; previously accepted events are never silently rewritten.

`learning_cycle.superseded` has a narrower boundary than the current general archive helper: it exists only when an unfinished predecessor and a committed successor are both known. Reset-only actions and archival of a completed cycle do not produce this event. Practice durations remain absent when they were not measured, and focus events distinguish planned duration from measured active duration. The base plan uses one of the four diagnostic skills; a learner-confirmed post-retest update may use `Balanced`. The registered quality-flag vocabulary is represented by a compact bitmask so maximum-width event fixtures remain under 2 KiB without losing the frozen flag meanings.

## Production LRS reconsideration triggers

Start a separate LRS proof of concept only when at least one real requirement exists:

- an institution contract requires an xAPI endpoint or forwarding;
- two or more independent learning systems must exchange records;
- a formal research protocol requires standardized cross-system event reconciliation;
- an LMS or cmi5 content integration requires xAPI;
- a customer requires portable records in its own LRS.

Production delivery additionally requires a stable event taxonomy, an authenticated and consented subject model, verified export/deletion behavior, a bounded retention policy, endpoint conformance checks, retry and reconciliation evidence, and explicit approval of the selected hosting region.

## Consequences

This preserves future interoperability without making Sufeiya dependent on an LRS today. It adds a small maintenance obligation: changes to learning-event semantics must update the registry, schema, examples, and verifier together. Breaking changes require a new contract version; v1 accepted events cannot be reinterpreted in place. Static no-LRS checks cover declared contract references and known endpoint/SDK/credential patterns, but they are not a substitute for explicit release review of any future generic network sink.
