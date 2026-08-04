# Mission Protocol Specification

## Purpose

Defines the mapping of the canonical EDA flow onto the pinned drenyra-ai mission protocol — the 15 mission states (enum has 15 values; engine doc comment says 14 but is outdated) and 5 intents — the rule that the runtime decides the next phase, the ordered `MissionStep[]` sequence model, durable storage, and recovery/idempotency. The engine remains the sole authority on mission transitions; the harness only wires and disciplines.

## Requirements

### Requirement: REQ-MISS-001 — EDA phase sequence

The system MUST represent the canonical EDA flow as an ordered `MissionStep[]` sequence covering all 13 phases: intake, bind-scope, ingest, normalize, classify, reconcile, investigate, propose, verify, approve, execute, close, archive.

### Requirement: REQ-MISS-002 — Canonical engine states only

The system MUST drive missions exclusively through the pinned drenyra-ai `AccountingMissionStatus` enum (15 states: DRAFT, QUEUED, RUNNING, BLOCKED, AWAITING_APPROVAL, APPROVED, REJECTED, REVISION_REQUESTED, COMPLETED, FAILED, UNKNOWN, RECOVERING, WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE, RETRYING — the engine doc comment says 14 but the enum has 15) and MUST validate every transition against the engine's VALID_TRANSITIONS.

### Requirement: REQ-MISS-003 — Runtime decides next phase

The system MUST derive the next legal mission phase from persisted mission state using the engine predicates (isRunnable, isResumable, isAwaitingApproval, waitReasonFor) and MUST NOT infer readiness from chat content or model confidence.

### Requirement: REQ-MISS-004 — One legal step per execute

The system MUST execute exactly one protocol-legal step per execute call, honoring the engine's one-step-per-execute intent-handler constraint, and MUST return null when no further step is legal.

### Requirement: REQ-MISS-005 — Canonical intents

The system MUST scope every mission to one of the 5 canonical drenyra-ai mission intents: monthly-close, correction, reconciliation, invoice-review, compliance-check.

### Requirement: REQ-MISS-006 — Durable store adapters

The system MUST implement its own file-backed adapters for `MissionStore`, `MissionEventStore`, and `IdempotencyStore` with atomic writes (temp + fsync + rename) and a versioned store schema, and MUST NOT deep-import the unexported `MissionFileStore`.

### Requirement: REQ-MISS-007 — Recovery

The system MUST recover interrupted missions via the engine `recoverIncomplete` and event-log `replayMission`, following the engine recovery policy: in-flight missions recover to UNKNOWN, UNKNOWN missions are decided by evidence, human-wait states are left untouched, and terminal states are never replayed.

### Requirement: REQ-MISS-008 — Idempotent replay

The system MUST return the cached result when a mission command is replayed with the same idempotency key and MUST reject conflicting keys with an IdempotencyConflict error.

### Requirement: REQ-MISS-009 — Human-wait states

The system MUST use WAITING_FOR_EVIDENCE and BLOCKED_BY_GATE for human-wait phases and MUST NOT auto-advance a mission out of any wait state.

### Requirement: REQ-MISS-010 — Snapshot integrity

The system MUST maintain the full `MissionSnapshot` fields (id, companyId, fiscalPeriod, intent, status, version, progress, steps, currentStep, blockers, proposal, rejection, receiptId, receiptHash, lastEventSequence, createdAt, updatedAt) on every persisted mission.

## Scenarios

#### Scenario: SC-MISS-001 — Full EDA sequence

- GIVEN a newly created monthly-close mission with the full 13-phase step sequence
- WHEN continue is invoked repeatedly
- THEN each invocation advances exactly one legal phase and the mission reaches archive without any invalid transition

#### Scenario: SC-MISS-002 — Invalid transition rejected

- GIVEN a mission in DRAFT state
- WHEN a transition directly to COMPLETED is attempted
- THEN the engine rejects it as invalid

#### Scenario: SC-MISS-003 — Restart recovery

- GIVEN a mission interrupted while RUNNING and stores recreated from disk
- WHEN recovery runs
- THEN the mission is recovered to a consistent state and resumes via the next legal step

#### Scenario: SC-MISS-004 — Idempotent replay

- GIVEN a mission command executed with key K
- WHEN the same command with key K is replayed
- THEN the cached result is returned and no duplicate transition occurs

#### Scenario: SC-MISS-005 — Evidence wait does not auto-advance

- GIVEN a mission in WAITING_FOR_EVIDENCE
- WHEN continue is invoked without new evidence
- THEN the mission stays in WAITING_FOR_EVIDENCE and the engine reports waitReason EVIDENCE

#### Scenario: SC-MISS-006 — Gate block reported

- GIVEN a mission in BLOCKED_BY_GATE with an unfilled approval
- WHEN status or readiness is queried
- THEN the status reports waitReason POLICY_GATE and the next authorized action, and no phase advances

## Out of Scope

A competing state machine: all transitions are owned and validated by the pinned drenyra-ai engine, never by harness-local state logic.
