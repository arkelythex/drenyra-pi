# Chains Specification

## Purpose

Defines the four v0.1 chains — the upgraded monthly close plus reconcile, verify, and evidence — and the shared structure every chain follows: scope validation, mission run, gates, and a signed receipt, with bounded, deterministic operations.

## Requirements

### Requirement: REQ-CHAIN-001 — Monthly-close upgrade

The system MUST upgrade the monthly-close chain to: durable stores, real proposal creation with evidence binding (no hardcoded evidence hash), WAITING_FOR_EVIDENCE and BLOCKED_BY_GATE handling, and the full v0.1 12-step flow from company/period selection through export.

### Requirement: REQ-CHAIN-002 — Reconcile chain

The system MUST ship a reconcile chain scoped to the reconciliation intent that performs ingest, normalize, reconcile, anomaly detection, missing-evidence request, and an evidence-cited proposal.

### Requirement: REQ-CHAIN-003 — Verify chain

The system MUST ship a verify chain that checks source-snapshot integrity, ledger equations, and reconciliation correctness, and reports per-check verdicts.

### Requirement: REQ-CHAIN-004 — Evidence chain

The system MUST ship an evidence chain that adds and queries evidence-graph nodes and edges and binds the graph to the mission.

### Requirement: REQ-CHAIN-005 — Shared chain structure

The system MUST structure every chain as scope validation → mission run → gates → signed receipt, and MUST fail closed at the first failing stage.

### Requirement: REQ-CHAIN-006 — Bounded operations

The system MUST keep every chain step bounded and deterministic: no unbounded loops, no ambient runtime lookup from PATH, and no float representation of money in any chain computation.

### Requirement: REQ-CHAIN-007 — Signed completion receipts

The system MUST emit a signed receipt for every completed chain run, bound to the mission, evidence hash, scope hash, and executed target.

### Requirement: REQ-CHAIN-008 — Baseline preservation

The system MUST keep all 54 baseline tests passing throughout the chain work and MUST colocate tests and docs with each chain.

## Scenarios

#### Scenario: SC-CHAIN-001 — Monthly-close happy path

- GIVEN a company/period bound and fixture sources (balance, mayor, auxiliaries, bank movements)
- WHEN the monthly-close chain runs through all 12 steps
- THEN reconciliations run, anomalies are detected, evidence is requested and satisfied, a proposal is created with a real evidence hash, approval is recorded, a signed receipt is emitted, and results export

#### Scenario: SC-CHAIN-002 — Anomaly evidence loop

- GIVEN a reconciliation with a discrepancy
- WHEN the chain detects the anomaly
- THEN the mission moves to WAITING_FOR_EVIDENCE, and after evidence is added and continue runs, the discrepancy is resolved or a proposal is raised

#### Scenario: SC-CHAIN-003 — Source integrity failure

- GIVEN a source snapshot whose hash does not match its recorded hash
- WHEN the verify chain runs
- THEN the chain blocks with a source-integrity failure and no further stage runs

#### Scenario: SC-CHAIN-004 — Gate-blocked close

- GIVEN a monthly-close mission at R2 without approval records
- WHEN the chain reaches the approval gate
- THEN it stops in BLOCKED_BY_GATE or AWAITING_APPROVAL and reports the required approval as the next action

#### Scenario: SC-CHAIN-005 — Reconcile discrepancy proposal

- GIVEN bank and ledger fixtures with a known difference
- WHEN the reconcile chain runs
- THEN it produces an evidence-cited proposal quantifying the difference and its resolution path

#### Scenario: SC-CHAIN-006 — Evidence lineage query

- GIVEN a mission with recorded evidence nodes and edges
- WHEN the evidence chain queries the lineage of an action
- THEN the full source→transformation→conclusion→action chain is returned

## Out of Scope

Post-v0.1 chains (SIRE purchases/sales, advanced bank reconciliation, AP/AR, monthly taxes, continuous audit) and any autonomous submission path.
