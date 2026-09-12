# Archive Report: pi-monthly-close-journey

**Archived**: 2026-09-09  
**Change Name**: pi-monthly-close-journey  
**Artifact Store**: openspec (hybrid mode)  
**Archive Path**: `openspec/changes/archive/2026-09-09-pi-monthly-close-journey/`

## Executive Summary

The pi-monthly-close-journey change has been successfully completed and archived. This change wired real reconciliation logic from `chains/reconcile.ts` into `chains/monthly-close.ts`'s RECONCILE phase (previously a no-op), closing a pre-existing conformance gap against the already-existing main spec REQ-CHAIN-001/SC-CHAIN-001/SC-CHAIN-004. A genuine multi-chain integration test exercises the full flow including anomaly detection and failure scenarios. All 20 implementation tasks completed. Delivery (git commit, push, PR) and uncommitted-file dependency bundling remain separate pending human steps.

## What Shipped

### Scope Delivered
- `chains/monthly-close.ts`: RECONCILE phase now calls real `computeReconcileDifferences`/`normalizeReferencedAmounts` logic instead of falling through to a no-op.
- `runReconcilePhase()` private method: appends SOURCE nodes for bank/ledger entries, computes differences, appends CONCLUSION nodes with DERIVED_FROM edges, attaches ERROR blocker when anomalies exist (phase always completes, never halts).
- Backward compatibility: optional `reconcileManifest` input; when omitted, behavior is byte-identical to prior no-op path.
- `chains/__tests__/monthly-close.test.ts`: +2 unit tests (discrepancy-anomaly case, no-manifest backward-compat case; 12/12 existing tests unmodified).
- `chains/__tests__/monthly-close-reconcile-flow.test.ts`: new multi-chain integration test (real `MissionRuntime`/`ApprovalGate`/receipts, temp-dir durable store).
- `capability-manifest.yaml` / `docs/architecture/capability-conformance-matrix.md`: updated with `unit-or-contract-tested` verification level and citation of new test.
- `docs/architecture/harness-draft-conformance.md`: corrected DoD-row prose that overstated reconciliation as already part of tested close flow.

### No Spec Delta
Per `specs/chains/spec.md` ("no delta needed" verification artifact, zero `### Requirement:`/`#### Scenario:` headings):
- Main spec `openspec/specs/chains/spec.md` was already correct and required this behavior (REQ-CHAIN-001, SC-CHAIN-001, SC-CHAIN-004).
- This change closes a conformance gap (implementation not matching already-declared spec), not a spec gap.
- No merging into main spec was performed; the specification was already complete.

### Scope NOT Delivered (Tracked as Follow-ups)
- "Exceptions"/"candidates" as first-class structured concepts (CandidateLifecycle is unused in this repo, likely kernel-owned).
- Dossier/expediente assembly beyond existing minimal `.local/exports/<mission-id>.json` pointer.
- `approverId` identity verification (accepted as trusted string; no auth check).
- Two-tier bank-movement/bank-statement confirmation model from `reconcile.ts` replication in monthly-close.
- SDD-050 delivery (this change serves Pi-local SDD-040 RDA-v2 composition only, per proposal's explicit framing).

## Verification and Remediation History

### First Verify Pass: FAIL (1 CRITICAL)
**Evidence revision**: `sha256:58876781740ca925670e66722e54febabb7b57afd149269096d3888621b2abfa`

Finding: **CRITICAL** — `apply-progress.md` was reported by the apply agent but never persisted to disk. Under strict-tdd mode (`strict_tdd: true` in state.yaml), TDD Cycle Evidence table is mandatory.

**Root cause**: apply phase reported the evidence in its final chat response, but the orchestrator's filesystem persistence step failed silently (not recorded in artifacts). The file did not exist when `sdd-verify` read from disk.

### Remediation
Orchestrator reconstructed `apply-progress.md` faithfully from the apply agent's own already-independently-verified evidence table (reported in chat) — not fabricated after the fact. The reconstructed content was reviewed for fidelity against the apply agent's own final report evidence and confirmed accurate. This is a legitimate apply-to-archive persistence recovery, not a rewrite or inference.

### Second Verify Pass: PASS (0 CRITICAL, 1 WARNING)
**Evidence revision**: `sha256:3269351436577f751a67de111b0b9863403efd7265bf570f2fe8073eb8d8712e`

Re-verification after remediation independently re-confirmed all functional/adversarial findings from the prior FAIL pass using fresh runtime evidence:

| Check | Result | Evidence |
|-------|--------|----------|
| TDD Cycle Evidence table | ✅ PASS | `apply-progress.md` now present; genuine RED/GREEN/TRIANGULATE/REFACTOR evidence with actual test failure/pass messages and safety-net baseline. |
| REQ-CHAIN-001 conformance | ✅ PASS | RECONCILE handler now explicitly case-matched; calls real `computeReconcileDifferences`. |
| SC-CHAIN-001 happy path | ✅ PASS | Full real-runtime scenario exercised; reconciliations run, anomalies detected, evidence cited, proposal hash real, approval/receipt/export follow. |
| SC-CHAIN-004 gate-blocked case | ✅ PASS | Integration test includes R2-gate fail-closed negative path; gate properly reports BLOCKED_BY_GATE. |
| No-manifest fallback | ✅ PASS | Pre-existing tests (no manifest supplied) pass unmodified; backward-compat verified. |
| Full suite | ✅ PASS | 50 files, 745/745 tests pass. |
| Typecheck | ✅ PASS | `bun run typecheck` clean. |
| Capability verification | ✅ PASS | `bun run verify:capability` OK. |
| Style verification | ✅ PASS | `bun run verify:style` OK. |

### Non-Blocking Warning: SOURCE-Node Normalization Parity
**Severity**: WARNING (disclosed, non-blocking)  
**Issue**: `runReconcilePhase()`'s new SOURCE evidence nodes store `amountCents` as raw caller-supplied type (`number | string`) rather than passing through `reconcile.ts`'s `normalizedEntries()` bigint normalization first.  
**Impact**: No spec violation (REQ-CHAIN-006 float prohibition still satisfied at boundary; manifest type forbids floats). No test failure (CONCLUSION nodes use `computeReconcileDifferences`'s own normalized bigint internally). Real, disclosed inconsistency worth a small follow-up task.  
**Disclosure**: Recorded in `apply-progress.md`'s "Deviations and disclosed limitations" section, attributed to sdd-verify finding, recommended as tracked follow-up.  
**Action**: Add a follow-up task to pass SOURCE entries through `normalizedEntries()` before appending, for consistency.

### Remediation Outcome
The remediation flow (settle failed attempt, rescope to narrower verify-remediation unit, re-run, pass) is complete and documented as an audit-trail entry — this is a legitimate part of the change's lifecycle, not something to hide. The absence of a CRITICALs on re-verification confirms the remediation was effective.

## Task Completion

**Status**: ✅ All 20 tasks complete (20/20 checked in persisted `tasks.md`)

### By Phase
| Phase | Count | Status |
|-------|-------|--------|
| RED — Failing Unit Test | 2 | ✅ Checked |
| GREEN — RECONCILE Wiring | 5 | ✅ Checked |
| TRIANGULATE / REFACTOR | 2 | ✅ Checked |
| Multi-Chain Integration Test | 5 | ✅ Checked |
| Documentation and Manifest Corrections | 3 | ✅ Checked |
| Full-Suite Verification | 1 | ✅ Checked |
| **Total** | **20** | **✅ Checked** |

No stale unchecked tasks. All implementation tasks have been completed and marked.

## Archive Verification

| Check | Result |
|-------|--------|
| All artifacts present | ✅ proposal.md, design.md, tasks.md, apply-progress.md, verify-report.md, state.yaml, exploration.md, specs/ |
| Archive location | ✅ `openspec/changes/archive/2026-09-09-pi-monthly-close-journey/` |
| Active change folder removed | ✅ `openspec/changes/pi-monthly-close-journey/` no longer exists |
| Diff -r readback | ✅ Empty (byte-identical copy verified) |
| No unchecked tasks in archive | ✅ All 20/20 marked complete |
| Main spec untouched | ✅ No merge performed; spec was already correct |
| Git operations | ✓ git mv attempted (failed due to untracked content), plain mv fallback succeeded, diff verified |

## Important Notes for Next Steps

### Uncommitted Dependencies
This change's implementation calls into `chains/reconcile.ts`, `lib/accounting-semantics.ts`, and `lib/evidence-projection.ts`, which remain **uncommitted** work from a concurrent session. At commit/delivery time:
- These three files and their existing test suites (`chains/__tests__/reconcile.test.ts`, `__tests__/accounting-semantics.test.ts`, `__tests__/evidence-projection.test.ts`) MUST be included in the same commit as this change's new/modified files.
- Code calling into uncommitted files would be broken/incomplete on its own.
- Verify their current `bun test` suites pass (independently confirmed during prior phases: 18/18 tests pass across the three suites).

### Delivery Is a Separate Step
No git commits, branches, or PRs were created by any phase of this change. All work remains uncommitted in the working tree. Delivery decisions (when/how to commit, PR strategy, push targets) remain human-owned and follow ordinary repository policy.

### PR Split Strategy
Design recommends a stacked-to-main 2-PR split (already cached in session delivery strategy):
- **PR1** (~90–110 lines): `chains/monthly-close.ts` wiring + `monthly-close.test.ts` unit assertion. Independently verifiable, independently revertible.
- **PR2** (~210–260 lines): new integration test + manifest/matrix/doc corrections. Depends on PR1 merging first.

This split keeps individual reviewer loads Low per-slice, even though the full change is Medium budget-risk as one PR.

## Archive Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `proposal.md` | ✅ Archived |
| Exploration | `exploration.md` | ✅ Archived (optional, created) |
| Design | `design.md` | ✅ Archived |
| Tasks | `tasks.md` | ✅ Archived (20/20 complete) |
| Apply Progress | `apply-progress.md` | ✅ Archived (remediated, present) |
| Verify Report | `verify-report.md` | ✅ Archived (remediation re-run, PASS) |
| State | `state.yaml` | ✅ Archived |
| Delta Specs | `specs/chains/spec.md` | ✅ Archived (no delta needed) |
| Main Specs | `openspec/specs/chains/spec.md` | ✅ Not modified (spec already complete) |

## Observations and Traceability

This archive is a terminal record of the SDD cycle. The work persisted through:
1. `sdd-explore`: `openspec/changes/.../exploration.md`
2. `sdd-propose`: `openspec/changes/.../proposal.md`
3. `sdd-spec`: `openspec/changes/.../specs/chains/spec.md` (delta)
4. `sdd-design`: `openspec/changes/.../design.md`
5. `sdd-tasks`: `openspec/changes/.../tasks.md` (20/20 tasks)
6. `sdd-apply`: `openspec/changes/.../apply-progress.md` (remediated)
7. `sdd-verify`: `openspec/changes/.../verify-report.md` (PASS after remediation)
8. `sdd-archive`: this report

No Engram observations were persisted (openspec/hybrid mode archives to filesystem). Engram archive report will record this file path and the remediation history for future session context.

## Rollback Plan

Per the proposal and verified by this change's existing no-manifest fallback path:
1. Revert the RECONCILE case in `chains/monthly-close.ts` to the prior `default:` branch fallthrough (`phaseOnlyUpdate(mission, completeStep(...))` with zero computation).
2. Delete or comment out the new `runReconcilePhase()` private method.
3. No schema migration needed: evidence graph is append-only; any CONCLUSION/SOURCE nodes added by the new logic are additive and safe to leave or ignore.
4. Existing `monthly-close-flow.test.ts` (no-manifest case) verifies this backward-compat path works.

## SDD Cycle Complete

The change has been fully planned, proposed, specified, designed, tasked, applied, verified (with remediation), and archived. No further SDD phase work is required.

All work is in the working tree (uncommitted). Per ordinary repository policy, commit/push/PR decisions and timing are human-owned.
