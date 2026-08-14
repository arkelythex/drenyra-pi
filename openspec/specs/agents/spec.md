# Agents Specification

## Purpose

Defines the ten Pi markdown accounting agents — the seven Design 03 ecosystem roles (Close Coordinator, Evidence Agent, Invoice/SIRE Agent, Reconciliation Agent, Journal Candidate Agent, Compliance Agent, Guardian Angel) plus three Pi work agents — the scope guard and evidence-citation rules every agent follows, the fail-closed authority posture, and the memory write-back contract that keeps accounting truth outside the transient chat context.

## Requirements

### Requirement: REQ-AGENT-001 — Ten agent roles

The system MUST ship exactly ten accounting agent definitions: accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller, invoice-sire-agent, journal-candidate-agent, and guardian-angel — the seven Design 03 ecosystem roles plus three Pi work agents.

### Requirement: REQ-AGENT-002 — Parseable definitions

The system MUST ship every agent as a parseable Pi markdown definition (valid frontmatter plus body) under agents/, and MUST mirror the definitions under assets/agents/.

### Requirement: REQ-AGENT-003 — Scope guard

The system MUST require every agent to operate only within the bound mission scope and MUST fail closed when scope is missing, invalid, or changed.

### Requirement: REQ-AGENT-004 — Evidence citation rule

The system MUST require every agent conclusion to cite evidence-graph nodes and MUST reject or flag conclusions without citations.

### Requirement: REQ-AGENT-005 — Fail-closed authority posture

The system MUST grant agents broad-deny tool permissions with narrow allows, MUST prevent any agent from mutating beyond its bound authority level, and MUST prevent implicit escalation.

### Requirement: REQ-AGENT-006 — Memory write-back contract

The system MUST require every agent to read its inputs directly from the backend and to persist its artifact before responding; memory unavailability MUST NOT grant authority and MUST NOT block file-backed artifacts.

### Requirement: REQ-AGENT-007 — Refutation before elevation

The system MUST require the anomaly-refuter to attempt refutation of every finding before it is elevated, and MUST only elevate findings that survive refutation with evidence.

### Requirement: REQ-AGENT-008 — Role-to-authority mapping

The system MUST assign each agent a documented authority ceiling (scout, analyst, and refuter at ASK–ANALYZE; close-controller and journal-candidate-agent at PREPARE candidate/coordination only) and MUST enforce those ceilings in agent prompts and permissions. The guardian-angel MUST stay at ANALYZE: it produces findings and never approval.

### Requirement: REQ-AGENT-009 — Asset conformance

The system MUST include the agent definitions in package verification (manifest and shipped-file checks) so shipped agents match the declared roles.

## Scenarios

#### Scenario: SC-AGENT-001 — Definitions parse and permissions fail closed

- GIVEN the ten agent definition files
- WHEN they are parsed and their permissions inspected
- THEN all ten parse, the mirrored assets match, and tool permissions are broad-deny with narrow allows

#### Scenario: SC-AGENT-002 — Out-of-scope operation fails closed

- GIVEN an agent bound to company A's scope
- WHEN it attempts work referencing company B or a different period
- THEN the operation fails closed with a scope-guard error

#### Scenario: SC-AGENT-003 — Uncited conclusion rejected

- GIVEN an agent conclusion that cites no evidence node
- WHEN the conclusion is submitted
- THEN it is flagged or rejected for missing citations

#### Scenario: SC-AGENT-004 — Refutation gate

- GIVEN a finding proposed for elevation
- WHEN the anomaly-refuter evaluates it
- THEN a refuted finding is not elevated and a confirmed finding is elevated only with its evidence

#### Scenario: SC-AGENT-005 — Persist before respond

- GIVEN an agent that produced an artifact
- WHEN the artifact is persisted and the agent responds
- THEN the artifact exists in the backend before the response, and a memory outage neither grants authority nor loses the file-backed artifact

## Out of Scope

More than the ten v0.1 roles, and any agent with EXECUTE-level mutation authority on its own.
