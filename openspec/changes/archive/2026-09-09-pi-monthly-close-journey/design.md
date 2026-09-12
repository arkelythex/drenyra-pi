# Design: Wire Real Reconciliation into the Monthly-Close Journey

## Pre-design verification (uncommitted-dependency risk)

Read in full: `chains/reconcile.ts`, `lib/accounting-semantics.ts`,
`lib/evidence-projection.ts`, plus their test suites
(`chains/__tests__/reconcile.test.ts`, `__tests__/accounting-semantics.test.ts`,
`__tests__/evidence-projection.test.ts`) and `chains/verify.ts`,
`lib/chain-pipeline.ts`, `lib/accounting-status.ts`,
`chains/__tests__/monthly-close-flow.test.ts`. **No Bash/execute tool is
available in this design session**, so `bun test` could not literally be
invoked. Static cross-check found no defects: every import/export pair
resolves (`toBigIntCents`, `normalizeReferencedAmounts`,
`computeReferenceDifferences`, `computeReconcileDifferences`,
`projectEvidenceProvenance(Set)`), test assertions match the real function
signatures and returned shapes field-for-field, and `EvidenceGraphStore`'s
append/validate/grounding invariants are internally consistent with how
`reconcile.ts` uses them. **This is not a substitute for actually running the
suites** — `sdd-apply`/`sdd-verify` MUST run `bun test` for these three
suites before/while building on them; if that surfaces a failure, treat it as
a blocking finding at that point, not something this design silently assumed
away.

## Technical Approach

`MonthlyCloseChain` (`chains/monthly-close.ts`) is a **hand-rolled class**,
not a `ChainDefinition`/`runChainStep` chain like `reconcile.ts`/`verify.ts`.
Its `advance()` has an explicit switch per phase; RECONCILE currently falls
to the `default` branch (phase-only `completeStep`, zero computation). The
fix adds one new `case EDA_PHASE.RECONCILE` there, backed by a private
`runReconcilePhase()` that reuses `reconcile.ts`'s pure, already-exported
`computeReconcileDifferences` directly — no shared-module extraction, no
`runChainStep` migration (out of scope; would be a rewrite, not a bounded fix).

## Architecture Decisions

| # | Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|---|
| 1 | Callable seam | `monthly-close.ts` imports `computeReconcileDifferences`/types directly from `../chains/reconcile.js` (already exported, pure, correct shape) | Extract a shared `lib/` module | Direct import is zero new lines in `reconcile.ts`, smaller diff, no premature abstraction for two call sites — matches "bounded handler change" |
| 2 | Evidence node shape | RECONCILE handler appends `src-bank-{ref}`/`src-ledger-{ref}` SOURCE nodes from the manifest, then `anomaly-{ref}` CONCLUSION nodes with `DERIVED_FROM` edges from `src-bank-{ref}` — byte-identical payload shape to `reconcile.ts`'s own CONCLUSION nodes | Reuse a shared node-builder helper | No such helper is exported from `reconcile.ts`; inlining the same shape (kind/reference/bankCents/ledgerCents/differenceCents/payloadHash) keeps parity without a new export surface |
| 3 | Phase advancement | RECONCILE always **completes** (`completeStep`, COMPLETED), attaching an ERROR-severity blocker to `mission.blockers` only when `differences.length > 0` — it never halts the mission | Halt/block like `verify.ts`'s `VerifyChainBlockedError` or `WAITING_FOR_EVIDENCE` | No precedent exists for a REQUIRED phase halting on its own domain logic inside `MonthlyCloseChain`/`buildChainRegistry` — only APPROVE's R2 gate and read-only `verify.ts` block. `reconcile.ts`'s own RECONCILE case (once bank-statement evidence exists) also just completes with an attached blocker, never halts. Since every monthly-close phase is `REQUIRED` (not `CONDITIONAL`, see `PHASE_APPLICABILITY`), the blocker cannot gate SKIP/RUN anyway — it only feeds `buildProposal`'s existing `hasUnresolvedBlocker` → `riskLevel: MEDIUM`, and the CONCLUSION node is auto-cited by the existing generic `evidenceFor()`/`buildProposal()` (zero PROPOSE changes needed) |
| 4 | Evidence-confirmation scope | Do **not** replicate `reconcile.ts`'s two-tier bank-movement vs. bank-statement confirmation/`WAITING_FOR_EVIDENCE` model inside monthly-close | Full two-tier model | Explicitly out of scope for this bounded fix; tracked as a named follow-up, not silently dropped |

## Data Flow

    startMission({reconcileManifest}) ─▶ reconcileManifestByMission.set(id, manifest)
    advance() RECONCILE ─▶ runReconcilePhase()
      ├─▶ EvidenceGraphStore.appendNode(SOURCE × bank/ledger entries)
      ├─▶ computeReconcileDifferences(manifest)   [reconcile.ts, pure]
      ├─▶ EvidenceGraphStore.appendNode(CONCLUSION × anomaly) + appendEdge(DERIVED_FROM)
      └─▶ completeStep(RECONCILE, COMPLETED, evidenceIds) [+ ERROR blocker if anomalies]
    advance() PROPOSE ─▶ evidenceFor()/buildProposal() (unchanged; auto-cites + riskLevel MEDIUM)
    advance() APPROVE ─▶ unchanged (R2 gate, fail-closed on missing approver)

No manifest supplied ⇒ `runReconcilePhase` falls back to the prior no-op
`completeStep` (byte-identical to today) — fully backward compatible with
`monthly-close-flow.test.ts`/`monthly-close.test.ts`, which never pass one.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `chains/monthly-close.ts` | Modify | New `reconcileManifest?` field on `MonthlyCloseStartInput`; `reconcileManifestByMission` map; new `RECONCILE` case + `runReconcilePhase()`; imports `EvidenceGraphStore`/`EVIDENCE_NODE_KIND`/`EVIDENCE_RELATION` and `computeReconcileDifferences`/`ReconcileSourceManifest` |
| `chains/reconcile.ts` | None | No change — existing exports are sufficient (Decision 1) |
| `chains/__tests__/monthly-close.test.ts` | Modify | PR1: one unit-level assertion — a mission with a discrepancy manifest produces the `anomaly-*` CONCLUSION node + ERROR blocker at RECONCILE |
| `chains/__tests__/monthly-close-reconcile-flow.test.ts` | Create | PR2: new multi-chain integration test (see below) |
| `capability-manifest.yaml` | Modify | `rda-chains.evidence.tests`/`note` cites the new test; verificationLevel stays `unit-or-contract-tested` |
| `docs/architecture/capability-conformance-matrix.md` | Modify | `rda-chains` row citation extended with the new test name |
| `docs/architecture/harness-draft-conformance.md` | Modify | DoD row 5 citation updated so "→ reconcile →" is backed by real evidence, not overstated |

## New Integration Test Fixture

Modeled directly on `monthly-close-flow.test.ts`'s real-runtime harness
(temp-dir `createDurableMissionStores`, real `MissionRuntime`/`ApprovalGate`,
`EvidenceGraphStore`, `ReceiptStore`). Deliberate anomaly, same shape as
`reconcile.test.ts`'s manifest: `reconcileManifest = { bank: [{reference:
"B002", amountCents: 250_000}], ledger: [{reference: "B002", amountCents:
230_000}] }` (both sides present ⇒ `src-bank-B002` always exists for the
`DERIVED_FROM` edge, avoiding the ungrounded-conclusion edge case).
Sequence: `startMission({reconcileManifest, ...})` → advance through
INTAKE/BIND_SCOPE/INGEST (evidence via `evidenceChain`, as today) → advance
RECONCILE → assert `anomaly-B002` CONCLUSION node + ERROR blocker exist →
PROPOSE (assert `riskLevel: "MEDIUM"`, `anomaly-B002` cited) → APPROVE
negative case (no approver ⇒ `BLOCKED_BY_GATE`, reusing the existing
`monthly-close-flow.test.ts` R2-gate pattern) → APPROVE with `approverId` →
EXECUTE → CLOSE (signed receipt) → `verifyChain` pass (`graph-integrity`,
`receipt-binding`).

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `runReconcilePhase` produces correct node/blocker shape | `monthly-close.test.ts` (PR1) |
| Integration | Full multi-chain journey with a real anomaly | `monthly-close-reconcile-flow.test.ts` (PR2) |
| Regression | Existing no-manifest paths unaffected | Existing `monthly-close.test.ts`/`monthly-close-flow.test.ts` must still pass unmodified in behavior |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary is touched.

## Migration / Rollout

No migration. Additive evidence-graph nodes only; rollback = revert the
`RECONCILE` case to the prior `default` fallthrough (per proposal).

## Sequencing / PR split (400-line budget)

Estimate: `monthly-close.ts` ~60-70 lines; new integration test ~200-250
lines; unit assertion ~20-30 lines; docs ~10 lines ⇒ **~300-360 total**,
consistent with the proposal's 300-450 estimate and **Medium** risk as one
PR. Recommended split (matches proposal's own suggestion):

- **PR1** (~90-110 lines): `monthly-close.ts` wiring + `monthly-close.test.ts` unit assertion. Independently verifiable, independently revertible.
- **PR2** (~210-260 lines): new integration test + manifest/matrix/doc corrections (depends on PR1 merging first).

Decision needed before apply: No (split already resolves budget risk).
Chained PRs recommended: Yes.
400-line budget risk: Low per-slice / Medium if delivered as one PR.

## Open Questions

- [ ] Confirm `bun test` actually passes for the three uncommitted-dependency suites before PR1 lands (could not execute in this session — no Bash tool available).
