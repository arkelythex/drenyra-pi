# Archive Report: pi-accounting-orchestration

**Date Archived**: 2026-09-09  
**Change**: pi-accounting-orchestration  
**Artifact Store**: openspec (hybrid mode)  
**SDD Cycle Status**: Complete  

## Executive Summary

The pi-accounting-orchestration change has been successfully implemented, verified, and archived. The routing adapter's `direct` modality is now wired into a live `/drenyra:status route` command, exposing the preflight and execution stages of the routing pipeline. The change demonstrates 2-of-3 routing modalities (`direct` and `durable`) in production code; the `delegated` modality remains an explicit, tracked follow-up. All 5 requirements and 8 scenarios verified independently as PASS; no CRITICAL issues found.

## What Shipped

### Live Wiring: 2-of-3 Modalities

- **`direct` modality (NEW)**: Wired into `/drenyra:status route` via a new `createChainPipelineRoutingPort()` implementation in `lib/routing/direct-port.ts`. Runs an in-process `verifyChain` through the routing pipeline when the operator supplies the explicit opt-in `route` subcommand token.
- **`durable` modality (EXISTING)**: Already had production wiring via `createDurableMissionRoutingPort` in `lib/mission-commands.ts`; continues to work unchanged.
- **`delegated` modality (OUT-OF-SCOPE, TRACKED FOLLOW-UP)**: No agent-dispatch implementation exists. Explicitly named in capability manifest and conformance matrix as not-yet-implemented, not silently omitted.

### Production Code Changes

| File | Action | Purpose |
|------|--------|---------|
| `lib/routing/direct-port.ts` | New (~100 lines) | Real `direct` port implementation, maps `ChainRunResult` → `RouteExecutionPortResponse` |
| `extensions/register.ts` (`statusHandler`) | Modified (~90 lines) | Unconditional `runRoutingPreflight` call; conditional opt-in `executeRoutingWork` gate behind `route` token |
| `capability-manifest.yaml` | Modified | Folded `direct`-port evidence into existing `drenyra-commands` row with `unit-or-contract-tested` verification level |
| `docs/architecture/capability-conformance-matrix.md` | Modified | Updated `drenyra-commands` row; no new capability key added |

### Test Coverage

| File | Action | Purpose |
|------|--------|---------|
| `__tests__/routing/direct-port.test.ts` | New (~110 lines) | Unit tests for port success/blocked/wait mapping; opt-in proof test |
| `__tests__/routing/executor.test.ts` | Modified | New missing-port fail-closed case (port.direct = undefined) |
| `__tests__/extension.test.ts` | Modified | REQ-ROUTE-001 scenarios: no-flag zero-write path; opt-in path; POLICY_BLOCKED fail-closed |

**Total changed lines**: 381 (under 400-line review budget, per verify-report)

## Verification Status

**Verdict**: `pass_with_warnings` (0 CRITICAL)

### All 5 Requirements PASS

1. **REQ-ROUTE-001** — Live `direct` port wiring, unconditional preflight, opt-in execution: ✅ PASS
   - `runRoutingPreflight` runs unconditionally on every `/drenyra:status` invocation (when scope/mission exist)
   - `executeRoutingWork` runs only when operator supplies `/drenyra:status route` opt-in token
   - Default invocation (no token) performs zero mission-store writes, byte-identical to prior behavior
   - *WARNING*: Spec phrasing "unconditional on every invocation" is technically preconditioned on scope/mission existence; behavior is correct, documentation precision could be improved in a follow-up

2. **REQ-ROUTE-002** — Fail-closed missing-port guard: ✅ PASS
   - Missing `ports.direct` entry rejected with `{ ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: ["ports.direct"] } }`
   - No port dispatch occurs; no stack trace or fallback

3. **REQ-ROUTE-003** — `/drenyra:mission` untouched: ✅ PASS
   - All pre-existing `/drenyra:mission` tests (31/31) pass unmodified
   - `missionHandler` and `coordinator.advance()` call path entirely unchanged

4. **REQ-ROUTE-004** — Honest capability manifest evidence, folded into `drenyra-commands`: ✅ PASS
   - `capability-manifest.yaml` validator passes; no new top-level keys added
   - Evidence folded into existing `drenyra-commands` row per SDD #1 precedent
   - Verification level explicitly marked `unit-or-contract-tested`, not `validated-end-to-end`

5. **REQ-ROUTE-005** — `delegated` modality named as a follow-up: ✅ PASS
   - `capability-manifest.yaml` explicitly states: *"The routing adapter's `delegated` modality has no production port yet — an explicit, tracked follow-up (REQ-ROUTE-005), not silently omitted."*
   - Same language replicated in `docs/architecture/capability-conformance-matrix.md`

### Test Run Summary (Fresh Verification)

```
Full test suite:              bun run test → 48 files / 738 tests PASSED
Type check:                   bun run typecheck → Clean, zero errors
Capability manifest:          bun run verify:capability → OK
Style check:                  bun run verify:style → OK
Build:                        bun run build → Done, exit 0
```

### Disclosed Limitations (Not Blocking)

1. **Intent Mismatch on `/drenyra:status route`** (Verified Honest Limitation)
   - The `verifyChain` input to the `direct` port is keyed by the chain's own intent (`"verify"`), not the operator's active mission intent
   - When an operator runs `/drenyra:status route` with an active mission of a different intent (e.g., `"monthly-close"`), the chain-resolved mission identity differs, and execution correctly routes to `AMBIGUOUS_INPUT` (fail-closed)
   - **Consequence**: The "happy path" (non-fail-closed execution) is only reachable when the active mission intent happens to be `"verify"` — a narrow, mostly-untested-in-practice condition
   - **Design-level Finding**: This is an honest structural limitation of demonstrating the routing adapter against `verifyChain` specifically, not a bug or evasion
   - **Disclosed in**: verify-report (Finding 1); capability-manifest note explicitly says "not validated-end-to-end"
   - **No Required Test Exercises Success Path**: Tasks 2.5a/b do not exercise `/drenyra:status route` on a mission with `intent="verify"` (the only way to reach non-fail-closed behavior), but this is not a coverage gap against the spec as written — all 5 requirements and 8 scenarios verify correctly

2. **Spec Precision: Unconditional vs. Scope-Dependent Preflight** (Non-Blocking Warning)
   - REQ-ROUTE-001 normatively states: "`runRoutingPreflight` MUST run unconditionally on every `/drenyra:status` invocation"
   - `PreflightRequest` structurally requires a `MissionSnapshot`, so the call cannot run without an active mission and bound scope
   - **Actual Behavior**: `runRoutingPreflight` is unconditional *relative to the opt-in flag*, but preconditioned on scope/mission existence — same as the pre-existing `evidence` field
   - **Impact**: None — implementation is correct, behavior is fail-closed honest (field is absent, never fabricated)
   - **Recommendation**: Follow-up spec wording could clarify the baseline precondition

## Explicitly Open Follow-Ups (Tracked, Not Silently Dropped)

### 1. `delegated` Modality Implementation
- **What**: Agent-dispatch implementation for the `delegated` routing modality
- **Why**: Requires its own design decision (agent-dispatch semantics, per-agent budget model), out of scope for this change
- **Status**: Explicitly named in capability manifest and conformance matrix as not-yet-implemented
- **Not Silently Dropped**: Every artifact this change touches mentions the follow-up by name

### 2. Agents and Models Connected with Budgets
- **What**: The proposal's acceptance clause *"Agents and models connected with budgets"* remains not met
- **Why**: `BudgetLedger` is real but only instantiated in tests; `agents/*.md` definitions have zero code-level budget linkage; the model-routing registry remains advisory-only
- **Status**: This change did not attempt to address this clause
- **Record**: The clause remains open, not resolved
- **Not Silently Dropped**: Proposal explicitly scopes this out as an acceptability clause that **remains unmet**

## Artifacts Merged and Archived

### Main Specs Updated
- **`openspec/specs/routing-adapter/spec.md`** (NEW)
  - Created from delta spec in `openspec/changes/pi-accounting-orchestration/specs/routing-adapter/spec.md`
  - Contains all 5 requirements and 8 scenarios in final form
  - Mechanical copy verified byte-for-byte with empty diff

### Change Folder Archived
- **Source**: `openspec/changes/pi-accounting-orchestration/`
- **Destination**: `openspec/changes/archive/2026-09-09-pi-accounting-orchestration/`
- Moved via `git mv` with pre/post-move snapshot verification
- **Empty diff confirms**: Zero byte changes, zero truncation, zero alteration
- **All artifacts preserved**: proposal.md, design.md, tasks.md (all tasks `[x]` checked), verify-report.md, specs/, apply-progress.md, exploration.md

### Archive Contents
- ✅ `proposal.md` (scope, approach, acceptance criteria)
- ✅ `specs/routing-adapter/spec.md` (5 requirements, 8 scenarios)
- ✅ `design.md` (technical decisions, data flow, file changes, testing strategy)
- ✅ `tasks.md` (2 PR phases, 15 tasks total, **all 15 checked `[x]`**)
- ✅ `verify-report.md` (pass_with_warnings, all requirements independently PASS)
- ✅ `apply-progress.md` (PR1/PR2 work log, disclosed findings)
- ✅ `exploration.md` (pre-proposal discovery)
- ✅ `state.yaml` (SDD state DAG)

## Delivery Status

**Delivery (commit/push/PR) is a separate, pending human step.**

- ✅ Implementation complete (all code changes applied to working tree)
- ✅ Verification complete (pass_with_warnings, all 5 requirements PASS)
- ✅ Archival complete (change folder moved, main spec created)
- ⏳ Commit/push/PR: **Not yet performed** — working tree is dirty with all work uncommitted
- ℹ️ **Attribution**: If committed, git messages should end with `Claude-Session: https://claude.ai/code/session_012AGfJLMg7Z61EV7kQruRNS`

## SDD Cycle Summary

| Phase | Status | Notes |
|-------|--------|-------|
| proposal | ✅ Complete | Scope: 2-of-3 modalities, delegated tracked as follow-up |
| spec | ✅ Complete | 5 requirements, 8 scenarios; routing-adapter spec created |
| design | ✅ Complete | Technical decisions documented; 2 PR phases defined |
| tasks | ✅ Complete | 15 tasks across 2 PRs; all checked `[x]` |
| apply | ✅ Complete | PR1 + PR2 applied; 361 changed lines (under 400-line budget) |
| verify | ✅ Complete | pass_with_warnings; all 5 requirements PASS; 0 CRITICAL; 738/738 tests |
| archive | ✅ Complete | Specs merged, change folder moved, archive report written |

## Key Facts for Traceability

- **Proposal**: 2-of-3 modalities; delegated named as follow-up; agents/budgets remain unmet
- **Verify Verdict**: pass_with_warnings, 0 CRITICAL, all 5 requirements PASS
- **Changed Lines**: 381 (under 400-line budget)
- **Test Coverage**: 48 files / 738 tests passing
- **Disclosed Limitation**: verifyChain intent mismatch causes typical fail-closed behavior; "happy path" only reachable on missions with intent="verify"
- **Archive Completeness**: All artifacts moved, all tasks checked, no stale checkboxes, verbatim diff-readback passed
