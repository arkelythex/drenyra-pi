# Tasks: Wire Real Reconciliation into the Monthly-Close Journey

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300-360 |
| 400-line budget risk | Medium (single PR) / Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | RECONCILE wiring + unit assertion | 1 | `bun test chains/__tests__/monthly-close.test.ts` | Real `MissionRuntime`/durable stores (existing harness) | Revert `RECONCILE` case to prior `default`; evidence graph is append-only |
| 2 | Multi-chain integration test + honest docs | 2 (after PR1) | `bun test chains/__tests__/monthly-close-reconcile-flow.test.ts` | Real `MissionRuntime`/`ApprovalGate`/receipts, temp-dir stores, per `monthly-close-flow.test.ts` | Delete new test file + revert manifest/matrix/doc lines |

**Note (not a task)**: PR 1's commit must bundle the currently-uncommitted `chains/reconcile.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts` plus their tests — calling into uncommitted code is otherwise incomplete standalone.

## Phase 1: RED — Failing Unit Test (PR 1, strict_tdd)

- [x] 1.1 Verify `chains/__tests__/reconcile.test.ts`, `__tests__/accounting-semantics.test.ts`, `__tests__/evidence-projection.test.ts` still pass before building on them.
- [x] 1.2 `chains/__tests__/monthly-close.test.ts`: add failing case — a discrepancy `reconcileManifest` must produce `anomaly-*` CONCLUSION node + ERROR blocker at RECONCILE.

## Phase 2: GREEN — RECONCILE Wiring (PR 1)

- [x] 2.1 `chains/monthly-close.ts`: add optional `reconcileManifest?: ReconcileSourceManifest` to `MonthlyCloseStartInput` + `reconcileManifestByMission` map in `startMission`.
- [x] 2.2 `chains/monthly-close.ts`: import `computeReconcileDifferences`/`ReconcileSourceManifest` from `../chains/reconcile.js` (read-only reuse) plus `EvidenceGraphStore`/`EVIDENCE_NODE_KIND`/`EVIDENCE_RELATION`.
- [x] 2.3 `chains/monthly-close.ts`: add private `runReconcilePhase()` — append `src-bank-{ref}`/`src-ledger-{ref}` SOURCE nodes, call `computeReconcileDifferences`, append `anomaly-{ref}` CONCLUSION nodes with `DERIVED_FROM` edges (shape matches `reconcile.ts`'s nodes).
- [x] 2.4 `chains/monthly-close.ts`: replace `advance()`'s `RECONCILE` fallthrough with `case EDA_PHASE.RECONCILE` calling `runReconcilePhase()`; always `completeStep(COMPLETED)`, attach ERROR blocker only when differences exist, never halt.
- [x] 2.5 `chains/monthly-close.ts`: no manifest supplied falls back to prior no-op `completeStep`, byte-identical to today; task 1.2's test now passes.

## Phase 3: TRIANGULATE / REFACTOR (PR 1)

- [x] 3.1 Confirm existing no-manifest cases in `chains/__tests__/monthly-close.test.ts` and `chains/__tests__/monthly-close-flow.test.ts` (read-only) stay unchanged (backward-compat edge case).
- [x] 3.2 Review `runReconcilePhase()` for cleanup opportunities against `reconcile.ts`'s node-shape precedent; no shared-module extraction (per design).

## Phase 4: Multi-Chain Integration Test (PR 2, depends on PR 1)

- [x] 4.1 Create `chains/__tests__/monthly-close-reconcile-flow.test.ts`, modeled on `chains/__tests__/monthly-close-flow.test.ts` (read-only reference)'s real-runtime harness (temp-dir stores, real `MissionRuntime`/`ApprovalGate`/`EvidenceGraphStore`/`ReceiptStore`).
- [x] 4.2 Use deliberate anomaly manifest: bank `B002` 250,000 cents vs ledger `B002` 230,000 cents.
- [x] 4.3 Advance INTAKE/BIND_SCOPE/INGEST then RECONCILE; assert `anomaly-B002` CONCLUSION node + ERROR blocker (SC-CHAIN-001).
- [x] 4.4 Assert PROPOSE yields `riskLevel: "MEDIUM"` citing `anomaly-B002`.
- [x] 4.5 Assert APPROVE negative case (`BLOCKED_BY_GATE`, SC-CHAIN-004), then approve, EXECUTE, CLOSE (signed receipt), `verifyChain` pass (`graph-integrity`, `receipt-binding`).

## Phase 5: Documentation and Manifest Corrections (PR 2)

- [x] 5.1 `capability-manifest.yaml`: cite new test in `rda-chains.evidence.tests`/`note`; keep `verificationLevel: unit-or-contract-tested`.
- [x] 5.2 `docs/architecture/capability-conformance-matrix.md`: extend `rda-chains` row citation to match 5.1.
- [x] 5.3 `docs/architecture/harness-draft-conformance.md`: correct DoD row 5 prose so "-> reconcile ->" reflects real, cited evidence.

## Phase 6: Full-Suite Verification

- [x] 6.1 Run full `bun test`; confirm INTAKE/BIND_SCOPE/INGEST/PROPOSE/APPROVE/EXECUTE/CLOSE/ARCHIVE and their tests stay byte-for-byte unchanged and passing.
