# Archive Report: pi-operator-onboarding

**Change Name**: pi-operator-onboarding  
**Archived**: 2026-09-09  
**Status**: Complete (safety slice only)  
**Verdict**: PASS (5/5 requirements, 15/15 scenarios, 0 CRITICAL findings)

## What Shipped

This change delivered the **first safety slice** of pi-operator-onboarding: a local correctness fix that ensures changing the selected company or fiscal period invalidates the prior canonical scope binding. Protected work (missions, chains, evidence mutations, approvals, receipt targets) remains fail-closed until an explicit fresh complete canonical scope is bound.

### Implementation Summary

- **Scope**: Limited to canonical-scope invalidation on operator selection changes
- **Files changed**: 
  - `runtime/context.ts` — consistency predicate, projection behavior, setter invalidation logic, and explicit-bind synchronization (35–60 lines)
  - `__tests__/context.test.ts` — persistence, idempotence, invalid-input, away/back resurrection tests (new cases)
  - `__tests__/context-scope.test.ts` — canonical/legacy mismatch projection tests (new cases)
  - `__tests__/extension-scope-guard.test.ts` — guard rejection and matching-scope preservation tests (new cases)
  - `__tests__/extension.test.ts` — mission/evidence handler zero protected-mutation integration tests (new cases)
  - `README.md` — operator-facing note about fresh bind requirement (5–10 lines)
  - `docs/architecture/program-lock-facts.json` — approved additive metadata refresh (0–25 lines)

- **Total authored review surface**: 393 lines (155–270 behavior/test/docs + 35–80 bookkeeping)

### Key Behaviors Implemented

1. **Invalidation on selection change**: A valid company or period change removes the prior canonical binding unless the new value equals the existing matching canonical value (idempotence).
2. **Safe selector transitions**: Invalid RUC or period input is rejected before any load/save, changing neither selected context nor canonical binding.
3. **Away-and-back protection**: After invalidation, changing the selector back to its prior value does not resurrect the old binding; a fresh explicit bind is required.
4. **Mismatch fail-closed**: Persisted legacy/canonical disagreement is detected and treated as incomplete; protected commands are rejected before delegation.
5. **Explicit bind synchronization**: `setCanonicalScope` atomically persists canonical scope together with matching legacy company and period, aligning visible values.
6. **Guard pre-delegation enforcement**: The existing scope guard receives an incomplete report after invalidation and rejects protected commands before protected state construction.

## Verification

**Verdict**: PASS  
**Evidence revision**: sha256:5c1a6746f5d8f7b7324047311ed2f1a6f6e48b9032f1946495b467ef17bad036

### Test Results

| Command | Exit | Result |
|---------|------|--------|
| Focused tests (4 files) | 0 | 73/73 passed |
| Full suite (`bun run test`) | 0 | 47/47 files; 731/731 tests passed |
| Type checking (`bun run typecheck`) | 0 | No diagnostics |
| Style check (`bun run verify:style`) | 0 | OK |
| Capability check (`bun run verify:capability`) | 0 | OK |

### Requirements Verification

All 5 requirements met; all 15 scenarios passed:
- **REQ-SCOPE-010** (new): Safe company and period selection transitions — 3 scenarios PASS
- **REQ-SCOPE-006** (modified): Scope-change invalidation — 4 scenarios PASS (1 pre-existing + 3 new)
- **REQ-SCOPE-007** (modified): Backward-compatible loading — 2 scenarios PASS (1 pre-existing + 1 new)
- **REQ-SCOPE-009** (modified): Fail-closed incomplete scope — 2 scenarios PASS (1 pre-existing + 1 new)
- **REQ-CMD-003** (modified): Scope guard before every command — 4 scenarios PASS (1 pre-existing + 3 new)

**Critical findings**: 0  
**Warnings**: 0

## Scope Narrowing Rationale

This change delivers **only** the safety-fix slice and **explicitly defers** the full guided onboarding wizard. The narrowing reason is documented in the proposal's "Later: full onboarding exit criteria" section and confirmed by verification:

### Why the scope was narrowed

The full onboarding wizard requires deriving or sourcing 8 non-company/period canonical scope fields (tenant, organization, ledger book, operation type, source snapshot, policy version, actor, authority level) from an authoritative Pi-local or kernel API. No confirmed `drenyra-ai` kernel contract exists to supply these derivations (verified against `drenyra-ai@0.4.1` public `.d.ts` exports).

Building a guided onboarding UI or deriving these fields locally without an approved kernel contract would violate the fiscal authority boundary: "Pi never authorizes." The safety slice removes this blocking dependency by fixing the local context invariant, which is itself a prerequisite for the later full onboarding work.

### Explicitly NOT delivered (deferred to SDD #2)

- No guided company-selection UI or wizard
- No guided fiscal-period-selection UI
- No source-selection workflow or source-manifest authority
- No automatic derivation or default values for the 8 missing scope elements
- No first-mission guidance or automatic mission start
- No kernel contract upgrade or `drenyra-ai` runtime pin change
- No Pi-local scope-value hashing or provenance scheme
- No install, doctor, packaging, publication, network, or fiscal-action behavior

## Follow-Up Tracking

**Future SDD #2 (blocked on kernel decision)**:

A later SDD change must first obtain an approved authoritative contract from the `drenyra-ai` kernel (or a bridge/authority component) for:

1. Deriving or supplying the 8 missing canonical scope fields (tenant, organization, ledger book, operation type, source snapshot, policy version, actor, authority level)
2. Defining authoritative source selection and provenance semantics
3. Specifying operator identity/authority provenance requirements

Only after that kernel contract is approved can a guided onboarding journey be built. The acceptance bar remains: clean package install → doctor → guided company selection → guided period selection → authoritative source selection with complete canonical scope provenance → explicit first-mission guidance/start.

This deferral is intentional and tracked, not silently dropped or waived.

## Delivery Status

**This SDD archive closes the cycle for the safety slice.** The change has been:
- ✅ Planned (proposal approved)
- ✅ Designed (design reviewed, allowlist confirmed)
- ✅ Implemented (all tasks marked complete in apply phase)
- ✅ Verified (15/15 scenarios, 0 CRITICAL findings)
- ✅ Archived (move completed, specs merged)

**NOT included in this close**: git commit, branch, or PR creation. Those are separate human decisions under ordinary repository policy. The SDD cycle (proposal → spec → design → tasks → apply → verify → archive) is complete.

## Specs Merged Into Main

Two delta specs were merged into main openspec specs:

| Domain | Changes |
|--------|---------|
| `openspec/specs/commands/spec.md` | Modified REQ-CMD-003; added 3 new scenarios (SC-CMD-002-A, SC-CMD-002-B, SC-CMD-002-C) |
| `openspec/specs/scope-binding/spec.md` | Added REQ-SCOPE-010 (new requirement + 3 scenarios); modified REQ-SCOPE-006 (added 3 scenarios); modified REQ-SCOPE-007 (added 1 scenario); modified REQ-SCOPE-009 (added 1 scenario) |

All merges preserved existing requirements and scenarios not mentioned in the deltas.

## Artifacts Archived

- ✅ `proposal.md` — decision, intent, scope, acceptance scenarios, risks, rollback
- ✅ `design.md` — source findings, architecture decision, state transitions, review workload forecast
- ✅ `tasks.md` — 13/13 implementation tasks marked complete
- ✅ `verify-report.md` — PASS verdict with 15/15 scenarios, 0 CRITICAL
- ✅ `apply-progress.md` — TDD cycle evidence, scope confirmation, deviations/rollback plan
- ✅ `specs/` — delta specs for commands and scope-binding domains
- ✅ `exploration.md` — (present, from sdd-explore phase)
- ✅ `preproposal.md` — (present, from pre-proposal phase)
- ✅ `state.yaml` — DAG state for future reference

## Archive Integrity

- **Source folder status**: Moved to `openspec/changes/archive/2026-09-09-pi-operator-onboarding/`; active changes directory no longer contains this change
- **Diff verification**: Empty (no truncation or alteration detected)
- **Task completion**: All 13 implementation tasks checked; no stale unchecked tasks remain
- **CRITICAL blockers**: None
- **Archive-time exceptional reconciliation**: None (not needed; all tasks were completed during apply)

## Final Notes

This safety slice is minimal, focused, and reversible. Rollback would reintroduce the cross-company/cross-period isolation defect, so protected commands must remain operationally disabled until operators explicitly rebind their intended scope in any production rollback scenario.

The narrow scope is intentional and reflects healthy boundaries: local correctness takes precedence over UI polish, and fiscal authority remains with the kernel until an approved contract defines scope-value provenance. The later full onboarding work is neither waived nor abandoned; it is explicitly tracked as a kernel-contract dependency.
