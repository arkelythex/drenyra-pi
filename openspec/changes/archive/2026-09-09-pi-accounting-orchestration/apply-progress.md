# Apply Progress: pi-accounting-orchestration

## Mode: Strict TDD

## PR1 (Phase 1) — `direct` port + missing-port fail-closed test — COMPLETE

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `__tests__/routing/direct-port.test.ts` | Unit/contract (real `runChainStep`, isolated tmp stores) | N/A (new file) | ✅ Written — imported `createChainPipelineRoutingPort` from a not-yet-existing `lib/routing/direct-port.ts`, confirmed module-not-found failure | ✅ Passed — 4/4 after implementing `lib/routing/direct-port.ts` | ✅ 4 cases: success (no stop), blocked (mode stage, AMBIGUOUS_INPUT), wait (evidence, MISSING_EVIDENCE), opt-in-proof (0 calls before invocation, 1 after) | ✅ Clean — no restructuring needed after GREEN |
| 1.2 | `__tests__/routing/direct-port.test.ts` | Unit/contract | N/A (new file) | ✅ Written (same RED as 1.1 — one coherent file) | ✅ Passed | ✅ (see 1.1) | ✅ Clean |
| 1.3 | `__tests__/routing/executor.test.ts` | Unit/contract | ✅ 15/15 (pre-existing suite passed before the new case was added) | ✅ Written — new case referencing the untested `typeof port !== "function"` branch (pre-existing production code, already correct; test backfills coverage per exploration.md's identified gap) | ✅ Passed on first run (production branch already correct) | ➖ Single scenario per design's exact test shape | ➖ None needed |
| 1.4 | `__tests__/routing/direct-port.test.ts` (`"opt-in proof"` test) | Unit/contract | N/A (new file) | ✅ Written — call-counting wrapper around the constructed port, asserted `calls === 0` before any invocation | ✅ Passed | ✅ Triangulated with a second real `executeRoutingWork` dispatch proving `calls === 1` (not a tautology — real production code, would fail if the port dispatched eagerly, zero times, or more than once) | ✅ Clean |
| 1.5 | (verification task, not a code task) | — | — | — | — | — | — |

### Test Summary
- **Total tests written**: 5 (4 in `direct-port.test.ts` + 1 in `executor.test.ts`)
- **Total tests passing**: 61/61 in `__tests__/routing/` (5 files), 20/20 across the two touched files run in isolation
- **Layers used**: Unit/contract (5), no Integration/E2E needed (pure library code, no live command surface in PR1)
- **Approval tests** (refactoring): None — no refactoring tasks, `lib/routing/direct-port.ts` is a new file
- **Pure functions created**: 2 (`waitStopForChain`, `blockedStopForChain`) + 1 factory (`createChainPipelineRoutingPort`)

### Work Unit Evidence (PR1)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `bun run test __tests__/routing/direct-port.test.ts __tests__/routing/executor.test.ts` → 20/20 passed. Full `__tests__/routing/` → 61/61 passed (zero regressions). |
| Runtime harness command/scenario and exact result | N/A — pure unit/contract test, no live command surface touched in PR1 (per tasks.md's own forecast table) |
| Rollback boundary | Delete `lib/routing/direct-port.ts` and `__tests__/routing/direct-port.test.ts`; revert the one added case in `__tests__/routing/executor.test.ts`. Zero callers elsewhere — PR1 is independently revertible. |

### Full-suite verification (PR1)
- `bun run test` (full suite): 1 file / 2 tests failed — **pre-existing, unrelated**: `__tests__/lock-facts.test.ts` fails against `docs/architecture/program-lock-facts.json`, both already modified/dirty in the working tree BEFORE this session started (per orchestrator-provided git status: `M docs/architecture/program-lock-facts.json`, plus several untracked/deleted `openspec/changes/*` entries from unrelated in-flight SDD work). Confirmed via `git status --short` — not touched by this change. Excluding that one file: `bunx vitest run --exclude '**/lock-facts.test.ts'` → **47 files / 724 tests passed**.
- `bun run typecheck` → clean, zero errors.
- `bun run verify:capability` → `verify-capability-manifest: OK` (no manifest changes yet in PR1; run to confirm PR1 didn't regress the closed-list validator).

### Files Changed (PR1)
| File | Action | What Was Done |
|------|--------|----------------|
| `lib/routing/direct-port.ts` | Created | `createChainPipelineRoutingPort(chain)` — the `direct` execution port; dispatches `runChainStep` exactly once, maps `ChainRunResult` → `RouteExecutionPortResponse` |
| `__tests__/routing/direct-port.test.ts` | Created | 4 tests: success mapping, blocked mapping, wait mapping, opt-in-proof/triangulation |
| `__tests__/routing/executor.test.ts` | Modified | Added the missing-port fail-closed test case (task 1.3) |

## PR2 (Phase 2) — `statusHandler` wiring + evidence fold — COMPLETE

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1–2.4 (statusHandler wiring) | `__tests__/extension.test.ts` (new `REQ-ROUTE-001` describe block) | Integration (real `PiExtensionApi` mock, real `runRoutingPreflight`/`executeRoutingWork`, isolated tmp `storesRoot`) | ✅ 24/24 pre-existing `extension.test.ts` tests + 31/31 `extension-mission-commands.test.ts` run and passed BEFORE the wiring was verified GREEN | ✅ Written, then confirmed RED by design (see below) | ✅ Passed — 24/24 after restoring the implementation | ✅ 2 cases: default invocation (additive field, zero writes) and `route` on a fresh mission (POLICY_BLOCKED, never a silent grant) | ✅ Clean — no restructuring after GREEN |
| 2.5 | `__tests__/extension.test.ts` | Integration | (see above) | ✅ Written | ✅ Passed | ✅ (see above) | ✅ Clean |
| 2.6 | `__tests__/extension-mission-commands.test.ts` (unmodified) | Integration | ✅ 31/31 | N/A — no new test; this task is a non-regression proof | ✅ 31/31 still passing, byte-for-byte unmodified test file, byte-for-byte unmodified `missionHandler` region (confirmed via `git diff` hunk ranges — all hunks fall inside imports/new-helpers/`statusHandler`, none touch `missionHandler`) | N/A | N/A |
| 2.7–2.9 (manifest/matrix evidence) | N/A (data, not code) | — | — | — | Verified via `bun run verify:capability` → `OK` | — | — |
| 2.10 | (verification task, not a code task) | — | — | — | — | — | — |

**RED/GREEN methodology note (2.1–2.4, honesty disclosure)**: unlike PR1's textbook write-test-first cycle, `statusHandler`'s wiring required first reading `lib/routing/preflight.ts`'s 8 validation stages to discover the ~20 required `PreflightRequest` fields (RouteRequest axes, budgets, workUnitInput, etc. — none of which design.md enumerated exactly). The implementation and the `PreflightRequest` builder were written together with that exploration. To recover genuine RED→GREEN evidence rather than fabricate it, the two new `__tests__/extension.test.ts` cases were written, then `extensions/register.ts` was TEMPORARILY REVERTED to its pre-change `HEAD` state via `git stash push -- extensions/register.ts` (patch saved first and diffed byte-identical after restore), the test run confirmed RED (2 failures — one a real test-fixture bug in the mission-start output field name, fixed; one a real "routing field missing" failure), then `git stash pop` restored the implementation and the run confirmed GREEN (24/24). This is disclosed rather than silently presented as if it were textbook RED-first.

### Test Summary
- **Total tests written**: 2 new integration tests in `__tests__/extension.test.ts` (PR1's 5 also apply to the overall change)
- **Total tests passing**: 55/55 across `__tests__/extension.test.ts` (24) + `__tests__/extension-mission-commands.test.ts` (31)
- **Layers used**: Integration (2) — real `PiExtensionApi` mock, real preflight/executor/store code, isolated temp `storesRoot`, no mocks of production logic
- **Approval tests** (refactoring): None — `statusHandler` is additive-only; `missionHandler` untouched
- **Pure functions created**: `buildStatusPreflightRequest` (async, but pure-ish: derives its request only from its arguments + a read-only `AuthorityStore` lookup), `notImplementedPort`, `stringifyMachineOutput`

### Work Unit Evidence (PR2)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `bun run test __tests__/extension.test.ts __tests__/extension-mission-commands.test.ts` → 55/55 passed |
| Runtime harness command/scenario and exact result | `/drenyra:status` (no flag) and `/drenyra:status route` invoked against a bound scope + a mission started via `/drenyra:mission monthly-close`, through the real `registerDrenyraPiExtension` + mock `PiExtensionApi` — the closest available runtime harness (no live Pi host in this repo's test environment). Confirmed: default invocation leaves the mission snapshot file's bytes and mtime unchanged (zero writes); `route` on a fresh mission fails closed `POLICY_BLOCKED` at `stagePermissions`. |
| Rollback boundary | Revert the `statusHandler` diff in `extensions/register.ts` (imports + 3 new helper functions + `statusHandler` body) and the two new tests in `__tests__/extension.test.ts`; `capability-manifest.yaml` and the conformance-matrix row revert independently. `lib/routing/direct-port.ts` (PR1) stays inert and unused if PR2 is reverted alone. |

### Known limitation (disclosed, not silently absorbed)
`verifyChain` (the chain the `direct` port is wired to) runs under intent `"verify"` — a **different** intent from the operator's actively loaded mission (e.g. `"monthly-close"`). `runChainStep` resolves/creates its mission by `(binding, intent)`, not by the caller's mission id, so `executeRoutingWork`'s post-dispatch identity check (`verifyResponse`: `missionAfter.id !== mission.id`) will typically fail closed with `AMBIGUOUS_INPUT` when `/drenyra:status route` executes against a non-`"verify"` active mission. This is a real, honest fail-closed behavior (never a crash, never a silent success) — not a bug introduced by this change, but a structural consequence of reusing `verifyChain` as the demonstration chain per design's own choice ("the only chain marked read-only"). It is exactly why `capability-manifest.yaml`'s new note says `unit-or-contract-tested ... not validated-end-to-end`. Neither required PR2 test (2.5a/b) exercises this path (2.5a never opts in; 2.5b fails closed earlier at `stagePermissions`), so it did not block GREEN, but it is disclosed here as a design-level limitation for `sdd-verify`/the maintainer to weigh.

### Files Changed (PR2)
| File | Action | What Was Done |
|------|--------|----------------|
| `extensions/register.ts` | Modified | Added `buildStatusPreflightRequest`, `notImplementedPort`, `stringifyMachineOutput` helpers + new imports; wired unconditional `runRoutingPreflight` and opt-in-gated `executeRoutingWork` into `statusHandler`, surfaced as additive `routing.{preflight,execution}` fields |
| `__tests__/extension.test.ts` | Modified | Added `REQ-ROUTE-001 /drenyra:status routing-adapter wiring` describe block with the 2 required assertions (2.5a/b) |
| `capability-manifest.yaml` | Modified | Folded `lib/routing/{direct-port,types,executor,preflight}.ts` + new tests into the existing `drenyra-commands` row; added `evidence.note` with `verificationLevel` + explicit `delegated`/`durable` follow-up disclosure |
| `docs/architecture/capability-conformance-matrix.md` | Modified | Updated the existing `drenyra-commands` row (no new row) with the same evidence + follow-up disclosure |

### Full-suite verification (PR2)
- `bun run test` (full suite): same pre-existing, unrelated `__tests__/lock-facts.test.ts` failure as PR1 (2 tests), otherwise 736/738 passed (up from 734/736 in PR1 — the 2 new PR2 tests). `bunx vitest run --exclude '**/lock-facts.test.ts'` → **47 files / 726 tests passed**.
- `bun run typecheck` → clean, zero errors.
- `bun run verify:capability` → `verify-capability-manifest: OK`.

### Review Budget (honest report — over the 400-line single-PR guideline for this slice)
- PR2 authored diff (tracked files): `git diff --stat` → **356 insertions + 25 deletions = 381 changed lines** across `extensions/register.ts`, `__tests__/extension.test.ts`, `capability-manifest.yaml`, plus one small row edit in the untracked `docs/architecture/capability-conformance-matrix.md`.
- This exceeds design.md's own ~121-line PR2 estimate. Design.md explicitly flagged the reason in advance: *"the `PreflightRequest` construction in `statusHandler` (~20 required fields) is the most likely line-count underestimate."* That prediction held — `PreflightRequest` has ~20 required fields across 8 preflight validation stages (scope, permissions, evidence, materiality, reversibility, systems, approval, workunit), each needing an honest, non-fabricated real or structurally-true value, which the `buildStatusPreflightRequest` helper alone accounts for roughly half of `register.ts`'s diff.
- No comments, blank lines, docs, or tests were deleted/compressed to fit a budget (per the chained-pr skill's hard rule). This is reported as `size:exception`-relevant for PR2 specifically: the work is one cohesive, non-splittable unit (the preflight-request builder cannot be usefully split from the handler wiring it serves) — recommend the maintainer accept PR2 as `size:exception` rather than force a further split.

## Overall status: 15/15 tasks complete (PR1: 5/5, PR2: 10/10). Ready for `sdd-verify`.
