# Commands Specification

## Purpose

Defines the complete `/drenyra:*` command surface — the 14 intended commands plus preserved legacy extras — the scope guard that precedes every command, thin-handler discipline, and the one-step continue and local receipt-verification semantics that make the protocol controllable from Pi without chat inference.

## Requirements

### Requirement: REQ-CMD-001 — Fourteen intended commands

The system MUST register the 14 intended commands: status, doctor, capabilities, scope, period, mission, continue, reconcile, close, evidence, verify, receipt, resume, models.

### Requirement: REQ-CMD-002 — Legacy extras preserved

The system MUST keep company and context registered as backward-compatible extras alongside the 14 intended commands.

### Requirement: REQ-CMD-003 — Scope guard before every command

The system MUST enforce the scope guard before every command: commands that require scope MUST fail closed with an explanatory error when scope is missing or invalid.

### Requirement: REQ-CMD-004 — Thin handlers

The system MUST keep command handlers thin: validate scope, delegate to lib/ or a chain, then render output; handlers MUST NOT contain accounting or fiscal logic.

### Requirement: REQ-CMD-005 — One-step continue

The system MUST make /drenyra:continue execute exactly one protocol-declared prepared transition and MUST NOT provide a continue-all behavior.

### Requirement: REQ-CMD-006 — Receipt verify subcommand

The system MUST implement /drenyra:receipt verify <id> to verify locally against the trusted-key registry: signature, content hash, scope binding, actor, policy applied, conclusion, executed target, and receipt currency (valid, expired, revoked, or unknown signer).

### Requirement: REQ-CMD-007 — Resume recovery

The system MUST implement /drenyra:resume to recover UNKNOWN or interrupted missions using the engine recovery policy and MUST leave human-wait and terminal missions untouched.

### Requirement: REQ-CMD-008 — Structured output

The system MUST return structured machine-readable output (JSON where appropriate) plus a concise human summary for every command.

### Requirement: REQ-CMD-009 — Status view

The system MUST render in /drenyra:status: active company and period, active mission state and next authorized action, linked sources, pending reconciliations, material anomalies, and required approvals.

### Requirement: REQ-CMD-010 — Capabilities view

The system MUST make /drenyra:capabilities report the engine getCapabilities() plus harness capabilities: authority modes, registered commands, and the 10 scope elements.

## Scenarios

#### Scenario: SC-CMD-001 — Full registration

- GIVEN the installed extension
- WHEN the extension descriptor is inspected
- THEN all 14 intended commands plus company and context are registered and the descriptor passes package-contract conformance

#### Scenario: SC-CMD-002 — Fail closed without scope

- GIVEN a command requiring scope (for example /drenyra:close) and no company or period bound
- WHEN the command runs
- THEN it fails closed with an explanatory scope error and mutates nothing

#### Scenario: SC-CMD-003 — Continue advances one step

- GIVEN a mission with several prepared transitions
- WHEN /drenyra:continue is invoked
- THEN exactly one transition occurs and the status shows the new next authorized action

#### Scenario: SC-CMD-004 — Receipt verify valid path

- GIVEN a receipt signed by a current, trusted key
- WHEN /drenyra:receipt verify <id> runs
- THEN the command reports content-valid, signature-valid, signer-trusted, and in-currency results with the bound scope and executed target

#### Scenario: SC-CMD-005 — Receipt verify rejection paths

- GIVEN receipts that are tampered, unknown-signer, expired-key, and revoked-key
- WHEN /drenyra:receipt verify <id> runs for each
- THEN each is rejected with the corresponding reason and none is reported valid

#### Scenario: SC-CMD-006 — Resume recovery behavior

- GIVEN an UNKNOWN mission and a WAITING_FOR_EVIDENCE mission
- WHEN /drenyra:resume runs
- THEN the UNKNOWN mission is recovered via evidence-based decision and the wait mission is left untouched

## Out of Scope

Command-line flags and argument parsing beyond the declared subcommands; any command that would mutate accounting state without an approved, receipted mission.
