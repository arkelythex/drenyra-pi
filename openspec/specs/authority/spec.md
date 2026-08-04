# Authority Specification

## Purpose

Defines the four authority modes, their strict monotonic ordering, the fail-closed materiality rule, and the requirement that authorization never escalates implicitly. Authority decisions come from bound scope and persisted mission state; the harness must never default missing materiality to R0 and must never grant a higher mode from a lower one.

## Requirements

### Requirement: REQ-AUTH-001 — Four authority modes

The system MUST define exactly four authority modes in strict order: `ASK < ANALYZE < PREPARE < EXECUTE`.

### Requirement: REQ-AUTH-002 — Monotonic gating

The system MUST deny any action whose required mode is higher than the actor's bound authority level; a lower-level authorization MUST NEVER permit a higher-level action.

### Requirement: REQ-AUTH-003 — Authority level bound to mission scope

The system MUST bind the authority level as one of the 10 scope elements of every mission and authorization, and MUST invalidate authorization when the bound level changes.

### Requirement: REQ-AUTH-004 — Explicit materiality derivation

The system MUST call the engine's `deriveMateriality` with explicit BigInt-cents value, reversibility, and jurisdiction inputs before evaluating any `ApprovalGate`, and MUST fail closed when any materiality input is missing; the harness MUST NEVER default materiality to R0.

### Requirement: REQ-AUTH-005 — Monthly-close approval gate

The system MUST require at least R2 materiality and an explicit human approval record for monthly-close execution.

### Requirement: REQ-AUTH-006 — No implicit escalation

The system MUST NOT escalate authority implicitly: inspecting a higher-mode result grants no execution authority, and no mode implies any higher mode.

### Requirement: REQ-AUTH-007 — Command-family capability matrix

The system MUST expose a capability matrix mapping each authority mode to the command families it may invoke, and MUST enforce it in every command handler.

### Requirement: REQ-AUTH-008 — Fail-closed gate pipeline

The system MUST evaluate gates in a fixed order (scope, materiality, mission state, approval, receipt) and MUST stop at the first non-allowed verdict; missing scope, materiality, approval, or trusted keys MUST block.

### Requirement: REQ-AUTH-009 — Action boundaries per mode

The system MUST ensure ASK and ANALYZE modes never produce mutation, PREPARE produces candidates only (never postings, export, or submission), and EXECUTE runs only after approval, evidence, and receipt gates all pass.

## Scenarios

#### Scenario: SC-AUTH-001 — Escalation denied

- GIVEN an actor authorized at ANALYZE level
- WHEN the actor attempts a PREPARE-level action (draft adjustment)
- THEN the action is denied with a monotonicity violation error

#### Scenario: SC-AUTH-002 — Missing materiality fails closed

- GIVEN a mission with no materiality input (missing value or reversibility)
- WHEN the approval gate pipeline runs
- THEN the mission is blocked and no R0 default is applied

#### Scenario: SC-AUTH-003 — Monthly close requires approval

- GIVEN a monthly-close mission with derived R2 materiality and no approval records
- WHEN the approval gate evaluates
- THEN the gate returns needs_input or blocked with an explicit approval request

#### Scenario: SC-AUTH-004 — Execute blocked without full gate chain

- GIVEN an EXECUTE-level authorization and a prepared action
- WHEN approval, evidence, or trusted-key receipt verification is missing
- THEN execution is blocked at the first failing gate

#### Scenario: SC-AUTH-005 — Mode escalation table covered

- GIVEN the mode-to-command-family matrix across all four modes
- WHEN every higher-than-bound action in the matrix is exercised
- THEN every exercise is denied and every allowed action passes

#### Scenario: SC-AUTH-006 — Bound level change invalidates

- GIVEN an approved authorization bound at ANALYZE level
- WHEN the authority level element in the scope is changed to PREPARE
- THEN the prior authorization is invalidated and a new bound decision is required

## Out of Scope

Multi-signer approval workflows beyond the engine `ApprovalGate` semantics, and any autonomous authority grant (no mode is ever auto-escalated by the harness).
