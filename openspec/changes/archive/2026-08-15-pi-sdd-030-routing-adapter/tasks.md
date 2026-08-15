# Tasks — pi-sdd-030-routing-adapter

> Change: `pi-sdd-030-routing-adapter`
> Runtime baseline: published, pinned `drenyra-ai@0.3.0` (no pin bump, no unpublished source)
> Delivery method: strict TDD (`RED → GREEN → TRIANGULATE → REFACTOR`) via `bun test` (Vitest runner, `strict_tdd: true`)
> Authority boundary: Pi preflights, proposes a route, and executes authorized work; Core owns materiality derivation, gates, mission transitions, approvals, and fiscal authority.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,140–1,700 (authored additions + deletions; generated output excluded) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 |
| Delivery strategy | exception-ok |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

**Decision rationale (standing precedent):** This is a verification-heavy change (six routing test files, an integration seam regression, and a full pinned-runtime journey with negative controls). It falls under the orchestrator's standing **size-exception precedent** for verification-heavy changes, and the user's **no-pares** directive instructs the orchestrator to apply the exception and record it rather than stop. The forecast reveals **nothing beyond that precedent**: each work unit carries an independent rollback boundary, the PR split keeps every intermediate candidate under review, and production units remain independently testable. The orchestrator therefore applies and records the size exception and proceeds; **no ask-on-risk prompt is required**.

**Chained PR split (each PR maps to independent rollback boundaries):**

- **PR1** = WU1 — Pi-owned adapter types + seven-stage preflight + budget normalization + fixtures + tests (300–430).
- **PR2** = WU2 — 18-cell route selector + budget isolation + barrel + tests (150–230).
- **PR3** = WU3 + WU4 — bounded executor + structured result + durable-mission one-step seam + tests (450–680; split WU3/WU4 if the measured authored change approaches 400).
- **PR4** = WU5 — pinned-runtime journey + negative controls + fixture refinements + full-suite/typecheck/package/style/capability evidence (240–360).

Each PR merges to `main` in order (stacked-to-main); every slice is independently testable and independently rollbackable, so intermediate mains stay valid.

---

## Scope guard

Apply may touch **only** the paths listed in design §9 (D7). The allowed set:

- `lib/routing/types.ts`, `lib/routing/preflight.ts`, `lib/routing/route-selector.ts`, `lib/routing/executor.ts`, `lib/routing/index.ts`
- `lib/mission-commands.ts` (narrow seam only)
- `__tests__/routing/preflight.test.ts`, `__tests__/routing/route-selector.test.ts`, `__tests__/routing/executor.test.ts`, `__tests__/routing/mission-routing-seam.test.ts`, `__tests__/routing/routing-adapter-journey.test.ts`, `__tests__/routing/fixtures.ts`
- `__tests__/extension-mission-commands.test.ts` (only a seam regression assertion)
- `__tests__/chain-pipeline.test.ts` (only if RED proves an export-only seam is needed; no chain semantics change)
- OpenSpec artifacts for this change

**Hard exclusions:** `runtime/**`, `chains/**`, `agents/**`, commands/registries/extensions/prompts/operator workflows, `node_modules/**`, `dist/**`, `vendored/**`, `drenyra-ai` repo/master artifacts, `package.json`, lockfiles, `runtime/pin.ts` (read-only), and any local transition matrix, fiscal threshold, gate implementation, approval grant, receipt authority, or parallel routing contract. An apply actor stops before editing an unlisted path and returns to design/tasks.

---

## WU1 — Published-contract fixtures and seven-stage preflight

**Scope:** `lib/routing/types.ts`, `lib/routing/preflight.ts`, `__tests__/routing/preflight.test.ts`, `__tests__/routing/fixtures.ts`
**Focused evidence:** `bun test __tests__/routing/preflight.test.ts`
**Rollback boundary:** Remove `lib/routing/types.ts`, `lib/routing/preflight.ts`, `__tests__/routing/preflight.test.ts`, `__tests__/routing/fixtures.ts`. No persisted state migration; nothing else depends on them yet.

- [x] **WU1-RED** Write `__tests__/routing/preflight.test.ts` and `__tests__/routing/fixtures.ts` asserting each of the seven ordered stages fails closed with the exact published stop kind, plus helper validation (`createWorkUnit` + `validateWorkUnit`) fails closed on malformed input. Run `bun test __tests__/routing/preflight.test.ts` and record the expected failures before any production code. <!-- sdd-owner: implementation -->
- [x] **WU1-GREEN-TYPES** Create `lib/routing/types.ts` defining only Pi-owned adapter shapes: `RoutingRoute`, `RiskBand`, `EvidenceSufficiency`, `RoutingReversibility`, `PreflightResult`, `RouteSelection`, `RouteExecutionPortResponse`, `RoutingExecutionPorts`, `PreflightRequest`, `RouteExecutionInput`, and a `BudgetLedger` description. Use type-only imports from `drenyra-ai/routing`; do **not** duplicate `WorkUnit`, `WorkResult`, or `WorkStopReason`. Record the full canonical `ScopeBinding`, mission snapshot, action family, bound `AuthorizationRecord`, evidence hashes/terminal node IDs, materiality request/declared tier, systems availability, approval requirement/evidence, published `WorkUnitInput` fields, and policy budget maxima. <!-- sdd-owner: implementation -->
- [x] **WU1-GREEN-PREFLIGHT** Create `lib/routing/preflight.ts` implementing `runRoutingPreflight(request)` evaluating the seven stages in fixed order, stopping at the first failure, writing nothing. Import `createWorkUnit`, `validateWorkUnit`, `parseSha256Hash`, `toJsonInteger` as runtime values from `drenyra-ai/routing`, and `deriveRequiredMateriality` from `lib/authority-gates.ts` (never `deriveMateriality` directly, no R0–R3 thresholds). Map each stage to the published nine-kind `WorkStopReason` union; never emit an invented `UNKNOWN` kind. <!-- sdd-owner: implementation -->
  - Stage 1 canonical scope: `validateCanonicalScope` + `bindScope` recompute + mission company/period + routing scope projection → `SCOPE_MISMATCH` or `AMBIGUOUS_INPUT { fields }`; never coerce the ten canonical elements into the smaller `WorkScope` union.
  - Stage 2 permissions: `requiredModeFor(actionFamily)` + bound authorization match (mission, scope hash, actor, family, non-expiry, `GRANTED`) + `assertMonotonicAuthority` → `POLICY_BLOCKED`; missing policy pin → `AMBIGUOUS_INPUT`.
  - Stage 3 evidence: `EvidenceGraphStore.validate(mission.id)` + `parseSha256Hash` + mission-local lineage + grounded conclusions/actions → `MISSING_EVIDENCE`; unknown required identity → `AMBIGUOUS_INPUT`, never an invented digest.
  - Stage 4 risk/materiality: explicit `MaterialityInput`, only `deriveRequiredMateriality`, optional declared-tier conflict check → `AMBIGUOUS_INPUT` or `UNSUPPORTED_WORK`; **no R0 default**.
  - Stage 5 reversibility: project `materiality.reversibility` unchanged → `REVERSIBLE` / `PARTIALLY_REVERSIBLE` / `IRREVERSIBLE`; missing/conflicting → `AMBIGUOUS_INPUT`.
  - Stage 6 systems: non-empty ID + explicit availability + allow-list cross-check → `EXTERNAL_SYSTEM_UNAVAILABLE { systemId }` or `AMBIGUOUS_INPUT`.
  - Stage 7 approval: verify applicability + bound evidence, never grant → retain `APPROVAL_REQUIRED` stop condition or `AMBIGUOUS_INPUT`.
- [x] **WU1-GREEN-BUDGET** Add budget normalization in `preflight.ts`: `researchAttemptLimit = min(requested, 3)` valid `1|2|3`; `correctionAttemptLimit = 1` (below invalid, above clamped); `costLimitCents = min(requested, governingPolicy.maxCostLimitCents)` as explicit non-negative BigInt cents with no implicit fiscal default; `timeLimitMs`/`tokenLimit` as explicit safe JSON integers bounded by version-pinned policy maxima. Construct `createWorkUnit(mission, input)` then `validateWorkUnit(unit, mission)`; project helper issues to `SCOPE_MISMATCH`/`MISSING_EVIDENCE`/`AMBIGUOUS_INPUT` without inventing a stop kind. <!-- sdd-owner: implementation -->
- [x] **WU1-TRIANGULATE** Extend `__tests__/routing/preflight.test.ts` boundary cases: corrupted evidence hash, conflicting declared tier, approval requirement, invalid helper issue paths, unavailable system, insufficient permission, and scope mismatch. Assert each fails closed with the exact published stop kind and no store write. Run `bun test __tests__/routing/preflight.test.ts` to GREEN. <!-- sdd-owner: implementation -->
- [x] **WU1-EVIDENCE** Record the focused command/result, runtime scenario/result (or justified `N/A`), and the WU1 rollback boundary in `openspec/changes/pi-sdd-030-routing-adapter/apply-progress.md`. <!-- sdd-owner: implementation -->

---

## WU2 — Exhaustive route selector and budget isolation

**Scope:** `lib/routing/route-selector.ts`, `__tests__/routing/route-selector.test.ts`, `lib/routing/index.ts`
**Focused evidence:** `bun test __tests__/routing/route-selector.test.ts`
**Rollback boundary:** Remove `lib/routing/route-selector.ts`, `lib/routing/route-selector.test.ts`, and any WU2 barrel entry; WU1 preflight/types remain independently valid.

- [x] **WU2-RED** Write `__tests__/routing/route-selector.test.ts` asserting all 18 normalized cells (2 risk bands × 3 evidence states × 3 reversibility) plus invalid-domain and conflicting-tier cases. Run `bun test __tests__/routing/route-selector.test.ts` and record the expected failures before production code. <!-- sdd-owner: implementation -->
- [x] **WU2-GREEN** Create `lib/routing/route-selector.ts` implementing `selectRoutingRoute(input)` as a total pure function over the 18-cell table (per design §5): R0_R1+SUFFICIENT → direct/delegated/delegated; R2_R3+SUFFICIENT → delegated/durable/durable; INSUFFICIENT → `MISSING_EVIDENCE`; AMBIGUOUS → `AMBIGUOUS_INPUT`. Normalize the kernel tier (`R0..R3`) internally to a risk band; a missing/out-of-domain/conflicting value returns `AMBIGUOUS_INPUT` before indexing. Output is a `{ route, basis }` proposal carrying **no** authorization or transition. <!-- sdd-owner: implementation -->
- [x] **WU2-GREEN-BUDGET** Assert the no-leak invariant in `route-selector.test.ts`: a `BudgetLedger` is keyed to one `WorkUnit.id`, never transferred to another route, never reused, and a route change requires a new preflight/new `WorkUnit.id`. Exhaustion returns `BUDGET_EXHAUSTED` naming `TIME | TOKENS | COST | RESEARCH_ATTEMPTS | CORRECTION`. <!-- sdd-owner: implementation -->
- [x] **WU2-BARREL** Add `lib/routing/index.ts` as the public barrel exporting the WU1/WU2 surface. <!-- sdd-owner: implementation -->
- [x] **WU2-TRIANGULATE** Extend `__tests__/routing/route-selector.test.ts` for all six SUFFICIENT rows and the invalid/contradictory domain; assert no cell is uncovered or non-deterministic and no proposal grants authority. Run `bun test __tests__/routing/route-selector.test.ts` to GREEN. <!-- sdd-owner: implementation -->
- [x] **WU2-EVIDENCE** Record focused command/result, runtime scenario/result (or justified `N/A`), and the WU2 rollback boundary in `apply-progress.md`. <!-- sdd-owner: implementation -->

---

## WU3 — Bounded executor and structured result

**Scope:** `lib/routing/executor.ts`, `__tests__/routing/executor.test.ts`, supporting `lib/routing/types.ts`/`index.ts` edits
**Focused evidence:** `bun test __tests__/routing/executor.test.ts`
**Rollback boundary:** Remove `lib/routing/executor.ts`, `__tests__/routing/executor.test.ts`, and supporting exports; selector/preflight remain.

- [x] **WU3-RED** Write `__tests__/routing/executor.test.ts` asserting validator denial, budget exhaustion, provenance loss, UNKNOWN resubmission, and mutated `nextTransition` all fail. Run `bun test __tests__/routing/executor.test.ts` and record expected failures before production code. <!-- sdd-owner: implementation -->
- [x] **WU3-GREEN** Create `lib/routing/executor.ts` implementing `executeRoutingWork({ workUnit, selection, binding, ports, validator = validateTransition })`:
  1. Revalidate immutable identity and scope (scopeHash, mission ID, company, period, intent, all evidence hashes).
  2. Reject `mission.status === UNKNOWN` immediately with `AMBIGUOUS_INPUT` + unresolved `MISSION_UNKNOWN` exception; no port call, no retry, no auto-advance, no ordinary transition validation for UNKNOWN recovery.
  3. Check pre-execution time/token/cost/attempt ceilings and authorized tool/destination declarations before dispatch.
  4. Invoke exactly one of `ports.direct|delegated|durable`; each production port runs one bounded operation through `runChainStep`/`executePreparedStep` and never loops.
  5. Verify returned mission IDs/scope, evidence hashes, tool ops/destinations, consumption; reject over-consumption even on success.
  6. Observe `missionBefore.status → missionAfter.status`; if changed, call `advanceWorkUnit(workUnit, after, validator)`; on rejection return `INVALID_TRANSITION { from, to }` retaining the original unit.
  7. Build candidate refs only with `createProposedCandidateRef(candidate, materialityBasis)`.
  8. Build and validate the result through one shared `buildRoutingWorkResult` path.
  Import `validateTransition` as the runtime value from `drenyra-ai/missions`; constructor-injectable for tests, but production composition passes the exact imported function. No local wrapper may catch a denial and approve it. <!-- sdd-owner: implementation -->
- [x] **WU3-GREEN-RESULT** Add the structured `WorkResultInput` construction in `executor.ts` (per design §6.2): `outcome`, `evidenceRefs` (validated lowercase sha-256), `proposedCandidates` (helper outputs only), `unresolvedExceptions`, `policyVersions`, `toolProvenance`, `costAndAttempts` (BigInt cents + `toJsonInteger`-branded attempts), `nextTransition { from, to }`, `explanation`. Call `createWorkResult(resultUnit, input, validator)` then `validateWorkResult(result, resultUnit, validator)`; both must return `ok: true`. Same-status phase-only updates are not fabricated as transitions — pass the observed Core-proposed target, and fail closed with `INVALID_TRANSITION` if no Core-valid target exists. <!-- sdd-owner: implementation -->
- [x] **WU3-GREEN-LEDGER** Enforce per-unit `BudgetLedger`: research attempts capped at three, correction at one, each debit checked against the unit ceiling before dispatch; non-retryable stop or UNKNOWN closes the ledger. Zero blind retries. <!-- sdd-owner: implementation -->
- [x] **WU3-TRIANGULATE** Extend `__tests__/routing/executor.test.ts` with shared assertions across direct/delegated/durable ports: same construction path, same evidence/budget/stop-cause/UNKNOWN rules. Add negative controls: injected validator spy rejecting the observed edge → `INVALID_TRANSITION` with original unit unchanged; separately mutate `nextTransition` after construction → `validateWorkResult` rejects; drop `subjectHash`/`materialityBasis` → candidate/result validation fails. Run `bun test __tests__/routing/executor.test.ts` to GREEN. <!-- sdd-owner: implementation -->
- [x] **WU3-EVIDENCE** Record focused command/result, runtime scenario/result (or justified `N/A`), and the WU3 rollback boundary in `apply-progress.md`. <!-- sdd-owner: implementation -->

---

## WU4 — Durable mission one-step seam

**Scope:** `lib/mission-commands.ts`, `__tests__/routing/mission-routing-seam.test.ts`, optionally `__tests__/extension-mission-commands.test.ts` (seam regression assertion only)
**Focused evidence:** `bun test __tests__/routing/mission-routing-seam.test.ts`; `bun test __tests__/extension-mission-commands.test.ts`
**Rollback boundary:** Revert only the exported `createDurableMissionRoutingPort` and its tests; existing `EdaMissionCoordinator.start/advance/resumeAll` behavior is untouched.

- [x] **WU4-RED** Write `__tests__/routing/mission-routing-seam.test.ts` proving one invocation performs exactly one RUN/SKIP/WAIT decision, and UNKNOWN/WAIT/authority denial cannot write or loop. Run `bun test __tests__/routing/mission-routing-seam.test.ts` and record expected failures before production code. <!-- sdd-owner: implementation -->
- [x] **WU4-GREEN** Add to `lib/mission-commands.ts` exactly one exported function `createDurableMissionRoutingPort(coordinator: EdaMissionCoordinator): RoutingExecutionPorts["durable"]`. The returned function: (1) verifies `input.workUnit.missionId === input.mission.id`; (2) calls `coordinator.advance({ missionId })` exactly once; (3) maps the existing `AdvanceEdaMissionResult` to `RouteExecutionPortResponse` without changing the mission; (4) reports WAIT and authority denial as unresolved exceptions / typed adapter stops; (5) reports no synthetic tool provenance or candidate. The existing `advance` body is not routed back through the adapter and is not rewritten (no recursion). <!-- sdd-owner: implementation -->
- [x] **WU4-TRIANGULATE** Add a focused seam regression assertion in `__tests__/extension-mission-commands.test.ts` and extend `mission-routing-seam.test.ts`: exactly one RUN/SKIP/WAIT per call, WAIT performs no write/auto-advance, `assertMonotonicAuthority` denies insufficient mode before a write, `runtime.apply` remains the lifecycle transition owner, `resumeAll` still delegates to `recoverDurableMissions`, UNKNOWN yields no prepared step. Run `bun test __tests__/routing/mission-routing-seam.test.ts` and `bun test __tests__/extension-mission-commands.test.ts` to GREEN. <!-- sdd-owner: implementation -->
- [x] **WU4-EVIDENCE** Record focused command/result, runtime scenario/result (or justified `N/A`), and the WU4 rollback boundary in `apply-progress.md`. <!-- sdd-owner: implementation -->

---

## WU5 — Pinned-runtime journey and negative controls

**Scope:** `__tests__/routing/routing-adapter-journey.test.ts`, fixture refinements in `__tests__/routing/fixtures.ts`, OpenSpec evidence
**Focused evidence:** focused journey command, then `bun test`, `bun run typecheck`, `bun run verify:package`, `bun run verify:style`, `bun run verify:capability`
**Rollback boundary:** Remove journey-only test/fixture additions and evidence updates; production units remain independently testable.

- [x] **WU5-RED** Write `__tests__/routing/routing-adapter-journey.test.ts` using the real installed `drenyra-ai@0.3.0` package and real Pi canonicalization, evidence graph, authority gates, chain pipeline, and mission coordinator over an isolated `storesRoot`. Encode each SDD-040-style negative control (budget exhaustion, evidence insufficiency, UNKNOWN no-retry, validator-injection honesty, scope-binding retention, candidate provenance, no local authority) so each mutation fails for its named reason. Run the journey and record expected failures before production code. <!-- sdd-owner: implementation -->
- [x] **WU5-GREEN** Implement the happy-path journey harness: canonical request → seven-stage preflight → helper-built/validated `WorkUnit` → 18-cell selector → one bounded chain execution → `advanceWorkUnit` with imported `validateTransition` → `createProposedCandidateRef` → `createWorkResult` + `validateWorkResult`. Assert work/mission identity, scope and evidence hashes, policy/skill pins, authorized tools/destinations, candidate `subjectHash`/`materialityBasis`, tool provenance, BigInt-cent cost, attempts, unresolved exceptions, and validator-approved next transition. <!-- sdd-owner: implementation -->
- [x] **WU5-TRIANGULATE** Extend the journey across all three routes (direct, delegated, durable) asserting uniform `WorkResult` construction, evidence/budget/stop-cause/UNKNOWN rules, and each negative control failing for its named binding with zero store mutation on preflight/scope failures. Run the focused journey command to GREEN. <!-- sdd-owner: implementation -->
- [x] **WU5-SUITE** Run and record the full candidate checks without source mutation: `bun test` (all files, capture file/pass/fail/total counts), `bun run typecheck`, `bun run verify:package`, `bun run verify:style`, `bun run verify:capability`. If any count or byte differs from prior evidence, update evidence, recompute identity, and repeat once from the affected invariant; never claim stale evidence. <!-- sdd-owner: implementation -->
- [x] **WU5-EVIDENCE** Record the final-candidate identity, focused commands/results, runtime scenarios/results, and the WU5 rollback boundary in `apply-progress.md`, including the per-WU focused-command/result and runtime scenario/result (or justified `N/A`) rows. <!-- sdd-owner: implementation -->

---

## Parent (lifecycle) actions — run only after WU1–WU5 implementation work

- [ ] Start or reuse the bounded review for the assembled candidate across PR1–PR4 after final-candidate identity is frozen. <!-- sdd-owner: parent -->
- [ ] Confirm the applied size-exception is recorded (per the standing verification-heavy precedent and the user's no-pares directive) before proceeding to `sdd-verify`. <!-- sdd-owner: parent -->
- [ ] Open or continue the chained PRs (PR1 WU1 → PR2 WU2 → PR3 WU3+WU4 → PR4 WU5) in stacked-to-main order, each with its independent rollback boundary. <!-- sdd-owner: parent -->
