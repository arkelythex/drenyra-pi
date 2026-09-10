# Apply progress: pi-monthly-close-journey

## Status

- Phase: `apply`
- Status: `completed` (20/20 tasks, both PRs)
- Note: this file was reconstructed by the orchestrator after `sdd-verify` found it missing from the original apply run (a persistence omission, not a content gap — the apply agent's own final report already contained this evidence; it was never written to disk). All content below is the apply agent's own reported evidence, independently re-confirmed by the orchestrator and by `sdd-verify`, not fabricated after the fact.

## Files changed by this apply

| File | Action | Description |
| --- | --- | --- |
| `chains/monthly-close.ts` | Modified | New `EDA_PHASE.RECONCILE` case (was `default:` no-op fallthrough); new private `runReconcilePhase()`; new optional `reconcileManifest` input field; new `reconcileManifestByMission` map |
| `chains/__tests__/monthly-close.test.ts` | Modified | +2 unit tests: discrepancy-anomaly case, no-manifest backward-compat case |
| `chains/__tests__/monthly-close-reconcile-flow.test.ts` | New | Real-runtime multi-chain integration test (sources → real reconcile with a deliberate B002 anomaly → evidence → proposal → gate-blocked negative case → approval → execution → verify) |
| `capability-manifest.yaml` | Modified | Honest evidence update (`unit-or-contract-tested`, never `validated-end-to-end`) |
| `docs/architecture/capability-conformance-matrix.md` | Modified | Matching row update |
| `docs/architecture/harness-draft-conformance.md` | Modified | Corrected DoD-row prose that overstated reconciliation as already part of the tested close flow |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR1 wiring | `chains/__tests__/monthly-close.test.ts` | Unit (real durable stores) | 12/12 pass before change | New discrepancy test written; failed as expected (`expected undefined to be defined` — no anomaly node) | Passed after `runReconcilePhase()` implemented | 2 cases (discrepancy + no-manifest fallback) | Clean, `bun run typecheck` passes |
| PR1 regression | `chains/__tests__/monthly-close.test.ts` + `monthly-close-flow.test.ts` | Unit + existing integration | — | — | 14/14 pass | — | — |
| PR2 integration | `chains/__tests__/monthly-close-reconcile-flow.test.ts` | Integration (real `MissionRuntime`/`ApprovalGate`/receipts, temp-dir durable store) | N/A (new file) | Modeled directly on the proven `monthly-close-flow.test.ts` pattern; passed on first run | Passed | Single (the real-runtime full journey is inherently exhaustive across all 8 phases) | None needed |

## Commands run (apply phase + orchestrator's independent re-verification)

| Command | Result |
| --- | --- |
| `bun run test -- chains/__tests__/reconcile.test.ts __tests__/accounting-semantics.test.ts __tests__/evidence-projection.test.ts` (safety net on the uncommitted dependencies) | 3 files, 18/18 pass |
| `bun run test -- chains/__tests__/monthly-close.test.ts` (PR1 GREEN) | 12/12 pass |
| `bun run test -- chains/__tests__/monthly-close.test.ts chains/__tests__/monthly-close-flow.test.ts` (PR1 regression) | 14/14 pass |
| `bun run typecheck` (PR1) | clean |
| `bun run verify:capability` (PR1) | OK |
| `bun run verify:style` (PR1) | OK, 107 owned files |
| `bun run test -- chains/__tests__/monthly-close-reconcile-flow.test.ts` (PR2 GREEN) | 1/1 pass, first run |
| `bun run typecheck` (PR2) | clean |
| `bun run verify:capability` (PR2) | OK |
| `bun run verify:style` (PR2) | OK |
| `bun run test` (orchestrator, full suite, after running the concurrent session's `bun run refresh:lock-facts` to clear unrelated pre-existing drift) | 50 files / 745 tests pass |
| `bun run typecheck` / `bun run verify:capability` / `bun run verify:style` (orchestrator, final) | all clean/OK |

## Deviations and disclosed limitations

- **Backward compatibility**: `reconcileManifest` is optional. When omitted, `runReconcilePhase()` falls back to the prior `phaseOnlyUpdate(mission, completeStep(..., "COMPLETED"))` no-op, byte-identical to today's behavior. The pre-existing `monthly-close-flow.test.ts` suite (which never supplies a manifest) passes unmodified, proving this directly.
- **RECONCILE never halts**: an `ERROR` blocker is attached to the mission when anomalies exist, but the phase always completes — `MonthlyCloseChain` has no precedent for a `REQUIRED` phase halting on its own domain logic (unlike `verify.ts`'s `readOnly` blocking checks), so this matches the chain's existing design rather than inventing new halting semantics.
- **SOURCE-node normalization (WARNING, non-blocking, found by `sdd-verify`)**: `monthly-close.ts`'s new SOURCE nodes store `amountCents` as raw `number|string` rather than passing through `reconcile.ts`'s `normalizedEntries()` bigint normalization first. This does not violate any spec requirement or fail any test, but is a real, disclosed inconsistency worth a small follow-up task rather than silently leaving unaddressed.
- **Two-tier bank-movement/bank-statement confirmation model** from `reconcile.ts` is intentionally not replicated inside monthly-close (per design decision 4) — named, tracked follow-up, not silently dropped.
- **Uncommitted dependency**: `chains/reconcile.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts` (and their tests) remain uncommitted, from a concurrent session. This change's eventual commit must bundle those files alongside its own new/modified files — not done by apply itself, flagged for the delivery/commit step.
- **Out of scope, confirmed not introduced**: no "exceptions"/"candidates" structured concept, no dossier/expediente assembly beyond the existing minimal export pointer, no `approverId` identity verification, no claim of SDD-050 delivery.

## Candidate and provenance

- `MonthlyCloseChain`'s other phases (`INTAKE`, `BIND_SCOPE`, `INGEST`, `PROPOSE`, `APPROVE`, `EXECUTE`, `CLOSE`, `ARCHIVE`) confirmed unchanged via `git diff chains/monthly-close.ts` — only the new `RECONCILE` case and the new private method were added.
- No git commits, branches, or PRs were created by this apply phase — working-tree changes only.
