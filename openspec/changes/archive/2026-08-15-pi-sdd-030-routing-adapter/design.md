# Design: Add the Drenyra Pi Routing Adapter

> Change: `pi-sdd-030-routing-adapter`  
> Runtime baseline: published, pinned `drenyra-ai@0.3.0`  
> Authority boundary: Pi preflights, proposes a route, and executes authorized work; Core owns materiality derivation, gates, mission transitions, approvals, and fiscal authority  
> Delivery method: strict TDD (`RED → GREEN → TRIANGULATE`) with `bun test`

## 1. Decision summary

Pi will add a cohesive routing subsystem under `lib/routing/`:

- `lib/routing/types.ts` defines only Pi-owned adapter inputs, route proposals, execution-port responses, and fail-closed outcomes. It does **not** duplicate `WorkUnit`, `WorkResult`, or `WorkStopReason`.
- `lib/routing/preflight.ts` executes the fixed seven-stage preflight and constructs a validated published `WorkUnit`.
- `lib/routing/route-selector.ts` implements the normalized 18-cell decision table as a pure function.
- `lib/routing/executor.ts` enforces per-work-unit budgets, dispatches one bounded route operation through an injected chain-pipeline port, advances work only through the injected canonical validator, and constructs the published `WorkResult`.
- `lib/routing/index.ts` is the public barrel for the Pi-owned adapter surface.

The narrow durable-mission seam is one exported adapter function in `lib/mission-commands.ts`. It invokes `EdaMissionCoordinator.advance` exactly once and projects that existing result into the executor port response. Existing `start`, `advance`, `resumeAll`, persisted-state derivation, authority checks, and recovery behavior remain unchanged.

All runtime `WorkUnit`, `WorkResult`, validation, candidate-ref, and stop-reason types come from `drenyra-ai/routing`. `validateTransition` is imported as a runtime value from `drenyra-ai/missions` and passed directly to `advanceWorkUnit`, `createWorkResult`, and `validateWorkResult`. Pi contains no transition table.

CodeGraph was unavailable in this executor environment and `.codegraph/` was absent, so this design used direct inspection of the authoritative proposal/spec, the pinned package declarations and implementation, and the named Pi modules.

## 2. Verified contract facts

| Fact | Stable evidence |
| --- | --- |
| `CanonicalTransitionValidator` is exactly `typeof validateTransition` | `node_modules/drenyra-ai/dist/routing/types.d.ts` — `CanonicalTransitionValidator` |
| `createWorkUnit(mission, input)` derives `missionId`, `companyId`, `period`, `intent`, and `DRAFT` stage | `node_modules/drenyra-ai/dist/routing/helpers.d.ts` and `helpers.js` — `createWorkUnit` |
| `advanceWorkUnit(unit, to, validator)` leaves the original unit unchanged when the injected validator rejects | `node_modules/drenyra-ai/dist/routing/helpers.d.ts` and `helpers.js` — `advanceWorkUnit` |
| `createWorkResult(unit, input, validator)` requires a declared `nextTransition`, then validates it through the injected validator | `node_modules/drenyra-ai/dist/routing/helpers.d.ts` and `helpers.js` — `WorkResultInput`, `createWorkResult`, `checkResultFields` |
| `validateWorkResult(result, unit, validator)` revalidates the same transition and structured fields | `node_modules/drenyra-ai/dist/routing/helpers.d.ts` and `helpers.js` — `validateWorkResult` |
| `validateTransition(from, to): void` is the published Core validator and throws on denial | `node_modules/drenyra-ai/dist/missions/index.d.ts`; `missions/transitions.d.ts` — `validateTransition` |
| `UNKNOWN` has no ordinary outgoing transition; recovery is a separate reconciliation operation | `node_modules/drenyra-ai/dist/missions/transitions.js` — `UNKNOWN_RECOVERY_TRANSITIONS`, `reconcileTransition` |
| The published stop union contains nine kinds and no `UNKNOWN` kind | `node_modules/drenyra-ai/dist/routing/types.d.ts` — `WorkStopReason` |
| Pi already has canonical binding, evidence integrity/lineage, authority delegation, one-step execution, and UNKNOWN suppression | `lib/canonicalization.ts`; `lib/evidence-graph.ts`; `lib/authority-gates.ts`; `lib/chain-pipeline.ts`; `lib/accounting-status.ts` |

These facts constrain the design: UNKNOWN is represented by a published `AMBIGUOUS_INPUT` stop plus an `AccountingException`, never by an invented stop kind. A result can name `nextTransition.to = UNKNOWN` only when the work unit's current stage has a Core-valid transition to UNKNOWN. An already-UNKNOWN mission has no ordinary next transition; it must be rejected before route execution and resumed only through the existing reconciliation/human path rather than fabricating a `WorkResult` that the published helper cannot validate.

## 3. D1 — Module layout and contracts

### 3.1 Exact paths

```text
lib/routing/
  types.ts
  preflight.ts
  route-selector.ts
  executor.ts
  index.ts
```

Four focused modules are preferable to one `lib/routing-adapter.ts`: preflight is I/O-bound and fail-closed, route selection is pure and exhaustive, execution is stateful and budgeted, and the local types are adapter ports rather than Core contract copies.

### 3.2 Import boundary

`lib/routing/types.ts`, `preflight.ts`, and `route-selector.ts` use type-only imports from `drenyra-ai/routing` whenever no runtime helper is called. `preflight.ts` imports `createWorkUnit`, `validateWorkUnit`, `parseSha256Hash`, and `toJsonInteger` as runtime values. `executor.ts` imports `advanceWorkUnit`, `createProposedCandidateRef`, `createWorkResult`, and `validateWorkResult` as runtime values.

Only `lib/routing/executor.ts` imports:

```ts
import { validateTransition } from "drenyra-ai/missions";
```

The validator is also constructor-injectable for negative-control tests, but production composition passes that exact imported function. No local wrapper may catch a denial and approve it.

### 3.3 Pi-owned adapter schemas

`lib/routing/types.ts` defines these shapes (names may be exported, fields are normative):

```ts
export type RoutingRoute = "direct" | "delegated" | "durable";
export type RiskBand = "R0_R1" | "R2_R3";
export type EvidenceSufficiency = "SUFFICIENT" | "INSUFFICIENT" | "AMBIGUOUS";
export type RoutingReversibility =
  | "REVERSIBLE"
  | "PARTIALLY_REVERSIBLE"
  | "IRREVERSIBLE";

export type PreflightResult =
  | {
      ok: true;
      workUnit: WorkUnit;
      riskTier: Materiality;       // returned by deriveRequiredMateriality
      riskBand: RiskBand;
      evidenceSufficiency: "SUFFICIENT";
      reversibility: RoutingReversibility;
      approvalRequired?: WorkStopReason & { kind: "APPROVAL_REQUIRED" };
    }
  | { ok: false; stage: PreflightStage; reason: WorkStopReason };

export type RouteSelection =
  | { ok: true; route: RoutingRoute; basis: RouteBasis }
  | { ok: false; reason: WorkStopReason };

export interface RouteExecutionPortResponse {
  missionBefore: MissionSnapshot;
  missionAfter: MissionSnapshot;
  evidenceRefs: readonly EvidenceRef[];
  candidates: readonly { candidate: Candidate; materialityBasis: MaterialityInput }[];
  unresolvedExceptions: readonly AccountingException[];
  toolProvenance: readonly ToolProvenance[];
  consumption: {
    elapsedMs: number;
    tokens: number;
    costIncurredCents: bigint;
    researchAttempts: number;
    correctionAttempts: number;
  };
  explanation?: string;
}

export interface RoutingExecutionPorts {
  direct(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
  delegated(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
  durable(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
}
```

`PreflightRequest` contains the complete canonical `ScopeBinding`, mission snapshot, requested action family, bound `AuthorizationRecord`, required evidence hashes and terminal node IDs, explicit materiality request, optional declared risk tier for conflict detection, systems with availability, approval requirement/evidence, published `WorkUnitInput` fields, and explicit policy budget maxima. It references existing Pi types rather than redefining scope, authorization, evidence nodes, or materiality.

`RouteExecutionInput` carries the immutable `WorkUnit`, route proposal, binding, one `ChainDefinition`, one `ChainRunInput`, and a per-unit `BudgetLedger`. Route ports may differ in orchestration mechanics, but each must call `runChainStep` or the `executePreparedStep` seam exactly once per executor invocation. This change creates no agent and no command; a delegated port is supplied by existing host composition.

### 3.4 Core and Pi ownership invariant

Local types may describe **inputs, observations, and proposals** only. They cannot contain a local materiality threshold, gate verdict algorithm, approval grant, transition matrix, or fiscal authorization flag. The source of each authoritative value is explicit:

| Value | Source |
| --- | --- |
| Materiality tier | `deriveRequiredMateriality`, which calls Core `deriveMateriality` |
| Permission requirement | `requiredModeFor`; sufficiency via `assertMonotonicAuthority` and bound authorization |
| Mission/gate outcome | `runChainStep` / `runAuthorityPipeline` |
| Work-unit transition | injected `validateTransition` through `advanceWorkUnit` |
| Result transition eligibility | injected `validateTransition` through `createWorkResult` and `validateWorkResult` |

## 4. D2 — Seven-stage preflight

`runRoutingPreflight(request)` evaluates the following stages in this exact order and returns at the first failure. No mission, authority, or evidence store is written during preflight.

| # | Stage and reused machinery | Pass output | Fail-closed mapping |
| ---: | --- | --- | --- |
| 1 | **Canonical scope.** Run `validateCanonicalScope`, recompute with `bindScope`, compare canonical bytes/hash, then compare mission company/period and routing scope projection. | Verified `ScopeBinding` and mission-aligned `WorkScope` projection. | A mismatch expressible by published `WorkScope` keys → `SCOPE_MISMATCH { fields }`; missing/conflicting canonical-only fields such as `organization`, `ledgerBook`, `sourceSnapshot`, `policyVersion`, `actor`, or `authorityLevel` → `AMBIGUOUS_INPUT { fields }`. Never coerce ten canonical elements into the smaller `WorkScope` key union. |
| 2 | **Permissions.** Compute required mode with `requiredModeFor(request.actionFamily)`, require the authorization to match mission, scope hash, actor, family, non-expiry, and `GRANTED`, then call `assertMonotonicAuthority`. | Verified bound permission observation; no authority is granted. | `POLICY_BLOCKED { policy: request.governingPolicy }`. Missing/malformed policy pin itself → `AMBIGUOUS_INPUT { fields: ["governingPolicy"] }`. |
| 3 | **Evidence availability and integrity.** Load `EvidenceGraphStore`, call `validate(mission.id)`, require every declared hash through `parseSha256Hash`, require the requested terminal IDs to have mission-local lineage, and verify every required conclusion/action is grounded. | `EvidenceSufficiency = SUFFICIENT` and immutable `EvidenceRef[]`. | Missing known required hashes, absent nodes, hash corruption, malformed log, cross-mission lineage, or ungrounded conclusion/action → `MISSING_EVIDENCE { requiredHashes }`. If required evidence identity is itself absent/contradictory so no valid hash can be listed, use `AMBIGUOUS_INPUT { fields: ["requiredEvidenceHashes"] }`; never invent a digest. |
| 4 | **Risk and materiality.** Require explicit `MaterialityInput`, call only `deriveRequiredMateriality(request.materiality)`, and compare an optional declared tier with the delegated result. | Kernel-derived `R0..R3`, normalized to `R0_R1` or `R2_R3`. | Missing/invalid input or declared/derived conflict → `AMBIGUOUS_INPUT` naming `materiality.input` or `declaredRiskTier`. Unsupported mission intent → `UNSUPPORTED_WORK { intent }`. No default to R0. |
| 5 | **Reversibility.** Project the already validated `MaterialityInput.reversibility`: `reversible → REVERSIBLE`, `partially-reversible → PARTIALLY_REVERSIBLE`, `irreversible → IRREVERSIBLE`. | One unchanged normalized routing classification. | Missing, malformed, or conflict with a separately declared value → `AMBIGUOUS_INPUT { fields: ["materiality.input.reversibility", ...] }`. |
| 6 | **Systems involved.** Require a non-empty ID and explicit availability for every system/tool/destination dependency; cross-check requested tool operations and destinations against the work-unit allow-list. | Complete system availability observation and exact allow-list. | Known unavailable system → `EXTERNAL_SYSTEM_UNAVAILABLE { systemId }`; absent/conflicting availability or allow-list declaration → `AMBIGUOUS_INPUT` naming the system field. |
| 7 | **Human approval.** Verify whether approval is applicable and whether supplied approval evidence is bound to this mission/scope/candidate evidence. Do not create or grant an approval. | Either “not required”, “bound evidence present”, or `approvalRequired` retained as a stop condition. | Missing required approval evidence is represented by published `APPROVAL_REQUIRED { approvalType }`. The preflight may still construct the advisory `WorkUnit` with `APPROVAL_REQUIRED` in `stopConditions`, but execution remains blocked until Core gates accept bound evidence. An ambiguous approval rule/evidence binding → `AMBIGUOUS_INPUT`. |

After stage 7, budget values are normalized, `createWorkUnit(mission, input)` constructs the unit, and `validateWorkUnit(unit, mission)` immediately revalidates it. Any helper issue is projected without inventing a stop kind:

- `MISSION_MISMATCH` or scope issue → `SCOPE_MISMATCH` when valid `WorkScope` fields can be named, otherwise `AMBIGUOUS_INPUT` with helper issue paths;
- missing/invalid evidence hash → `MISSING_EVIDENCE` only when the required valid hashes are known, otherwise `AMBIGUOUS_INPUT`;
- `INVALID_BUDGET`, `INVALID_INTEGER`, `INVALID_ID`, `MISSING_CONDITION`, `INVALID_STOP_REASON`, or entry-stage `INVALID_TRANSITION` → `AMBIGUOUS_INPUT { fields: issuePaths }`.

### Published stop-reason proof

The only emitted kinds are the nine literals present in `WorkStopReason` at `node_modules/drenyra-ai/dist/routing/types.d.ts`: `MISSING_EVIDENCE`, `POLICY_BLOCKED`, `APPROVAL_REQUIRED`, `BUDGET_EXHAUSTED`, `SCOPE_MISMATCH`, `INVALID_TRANSITION`, `EXTERNAL_SYSTEM_UNAVAILABLE`, `AMBIGUOUS_INPUT`, and `UNSUPPORTED_WORK`. There is no `UNKNOWN` literal. UNKNOWN handling therefore uses `AMBIGUOUS_INPUT { fields: ["mission.status"] }` plus an unresolved `AccountingException` with code `MISSION_UNKNOWN`, evidence references, and `resolutionStatus: "RECONCILIATION_OR_EXPLICIT_HUMAN_ACTION_REQUIRED"`.

### Materiality invariant

`preflight.ts` imports `deriveRequiredMateriality` from `lib/authority-gates.ts`; it never imports `deriveMateriality` directly and contains no R0–R3 thresholds. The policy floor remains the existing monotonic floor inside `deriveRequiredMateriality`.

## 5. D3 — Deterministic 18-cell route selector

`selectRoutingRoute(input)` is a total pure function over two risk bands, three evidence states, and three reversibility values: `2 × 3 × 3 = 18` normalized cells. This expands the grouped rows in `REQ-ROUTE-002` without changing their meaning.

| Risk band | Evidence | REVERSIBLE | PARTIALLY_REVERSIBLE | IRREVERSIBLE |
| --- | --- | --- | --- | --- |
| R0_R1 | SUFFICIENT | `direct` | `delegated` | `delegated` |
| R2_R3 | SUFFICIENT | `delegated` | `durable` | `durable` |
| R0_R1 | INSUFFICIENT | `MISSING_EVIDENCE` | `MISSING_EVIDENCE` | `MISSING_EVIDENCE` |
| R2_R3 | INSUFFICIENT | `MISSING_EVIDENCE` | `MISSING_EVIDENCE` | `MISSING_EVIDENCE` |
| R0_R1 | AMBIGUOUS | `AMBIGUOUS_INPUT` | `AMBIGUOUS_INPUT` | `AMBIGUOUS_INPUT` |
| R2_R3 | AMBIGUOUS | `AMBIGUOUS_INPUT` | `AMBIGUOUS_INPUT` | `AMBIGUOUS_INPUT` |

The input accepts the exact kernel-derived tier (`R0..R3`) and normalizes it internally to a risk band. A missing value, a value outside the closed domains, or a declared tier conflicting with the preflight tier returns `AMBIGUOUS_INPUT` before indexing the table. Insufficient evidence returns `MISSING_EVIDENCE` with the already validated required hashes. The result is a proposal containing `{ route, basis: { kernelRiskTier, evidenceSufficiency, reversibility } }`; it contains no authorization or transition.

### Budget ceilings and no-leak invariant

Budget normalization occurs once per work unit:

- `researchAttemptLimit = min(requestedResearchAttempts, 3)` after requiring a positive integer; valid output is `1 | 2 | 3`.
- `correctionAttemptLimit = 1`; any request below one is invalid and any request above one is clamped to one.
- `costLimitCents = min(requestedCostLimitCents, governingPolicy.maxCostLimitCents)`, both explicit non-negative BigInt cents. There is no implicit fiscal default.
- `timeLimitMs` and `tokenLimit` are explicit safe JSON integers and are bounded by their explicit version-pinned policy maxima.

A new in-memory `BudgetLedger` is created from each `WorkUnit.id` and cannot be reused with another ID. It records start time, tokens, BigInt-cent cost, research attempts, and correction attempts. Every debit checks the unit ceiling before the route port runs or retries. Exhaustion returns `BUDGET_EXHAUSTED` naming `TIME`, `TOKENS`, `COST`, `RESEARCH_ATTEMPTS`, or `CORRECTION`.

No-leak invariant: `executeRoutingWork` accepts one work unit and one fresh ledger; it dispatches exactly one selected route; it never falls through to another route, transfers unused budget, or creates a second ledger. Changing the route requires a new preflight and a new `WorkUnit.id`.

## 6. D4 — Executor and result construction

### 6.1 One bounded execution

`executeRoutingWork({ workUnit, selection, binding, ports, validator = validateTransition })` performs:

1. Revalidate immutable identity and scope: `binding.scopeHash`, mission ID, company, period, intent, and all evidence hashes must match the preflight snapshot.
2. Reject `mission.status === UNKNOWN` immediately with `AMBIGUOUS_INPUT` and a `MISSION_UNKNOWN` unresolved exception; do not call a route port, retry, auto-advance, or call ordinary transition validation for an UNKNOWN recovery.
3. Check pre-execution time/token/cost/attempt ceilings and authorized tool/destination declarations.
4. Invoke exactly one of `ports.direct`, `ports.delegated`, or `ports.durable`. Each production port executes one bounded operation through `runChainStep` or `executePreparedStep`; no port loops.
5. Verify the returned mission IDs/scope, evidence hashes, tool operations/destinations, and consumption. Reject over-consumption even if the port reports success.
6. Determine the observed Core transition from `missionBefore.status` to `missionAfter.status`. If status changed, call `advanceWorkUnit(workUnit, missionAfter.status, validator)`. On helper rejection, return `INVALID_TRANSITION { from, to }` and retain the original unit.
7. Build candidate refs only with `createProposedCandidateRef(candidate, materialityBasis)`.
8. Construct and validate the result through one shared `buildRoutingWorkResult` path.

A same-status phase-only update is not fabricated as a transition. In that case, the execution port must provide the next Core-proposed target observed from persisted mission state; the executor passes that pair to `createWorkResult`, which accepts it only if the injected validator allows it. If no Core-valid next target exists, result construction fails closed with `INVALID_TRANSITION`; Pi does not invent one to satisfy the non-optional `nextTransition` field.

### 6.2 Structured `WorkResultInput`

The exact input to `createWorkResult` is:

```ts
const input: WorkResultInput = {
  outcome,                         // SUCCEEDED, STOPPED, or FAILED + published reason
  evidenceRefs,                   // validated lowercase sha-256 refs
  proposedCandidates,             // createProposedCandidateRef outputs only
  unresolvedExceptions,           // includes explicit UNKNOWN/budget exceptions
  policyVersions: workUnit.policies,
  toolProvenance,                 // toolId/version/operation/outputHash
  costAndAttempts: {
    costIncurredCents,
    researchAttempts: jsonResearchAttempts,
    correctionAttempts: jsonCorrectionAttempts,
  },
  nextTransition: {
    from: resultUnit.stage,
    to: coreObservedOrProposedTarget,
  },
  explanation,
};
```

`toJsonInteger` brands consumed attempt counts. Cost remains BigInt cents. Elapsed time and tokens are enforced by the private ledger but cannot be added to `WorkResult`, whose published `CostAndAttempts` has only cost/research/correction fields. Exhausted time or tokens remain explicit in `outcome.reason.budget` and the unresolved exception.

The executor calls:

```ts
createWorkResult(resultUnit, input, validator);
validateWorkResult(result, resultUnit, validator);
```

Both must return `ok: true`. The `nextTransition` is not returned *by* the validator—the validator is `void`/throwing—but its eligibility is determined only by that injected function. The design deliberately avoids claiming a richer return contract than the pinned helper exposes.

### 6.3 UNKNOWN and retry behavior

There is no retry loop in `executor.ts`. Research attempts are separate explicit invocations by the caller, each debited before dispatch and capped at three. Correction is a single explicit invocation after a supported failed/partial result and is capped at one. A non-retryable stop or UNKNOWN closes the ledger.

When execution moves a known mission into UNKNOWN, the result uses:

- `outcome: { kind: "STOPPED", reason: { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] } }`;
- an unresolved `AccountingException` with `code: "MISSION_UNKNOWN"` and cited evidence refs;
- zero subsequent route-port calls;
- `nextTransition` equal to the observed known-state → UNKNOWN edge only if `validateTransition` accepts it.

An already-UNKNOWN mission is not executable and ordinary `validateTransition` cannot authorize recovery. Recovery remains `recoverDurableMissions`/Core reconciliation plus explicit human action. This is the honest boundary required by the published API.

## 7. D5 — Mission integration seam

`lib/mission-commands.ts` adds only:

```ts
export function createDurableMissionRoutingPort(
  coordinator: EdaMissionCoordinator,
): RoutingExecutionPorts["durable"];
```

The returned function:

1. verifies `input.workUnit.missionId === input.mission.id`;
2. calls `coordinator.advance({ missionId })` exactly once;
3. maps the existing `AdvanceEdaMissionResult` to `RouteExecutionPortResponse` without changing the mission;
4. reports WAIT and authority denial as unresolved exceptions/typed adapter stops;
5. reports no synthetic tool provenance or candidate; those fields are supplied only by real chain output.

The existing `EdaMissionCoordinator.advance` body is not routed back through the adapter and is not rewritten. This avoids recursion and preserves current behavior:

- `derivePreparedStep` remains the only RUN/SKIP/WAIT source;
- one call performs at most one phase;
- WAIT performs no write or auto-advance;
- `assertMonotonicAuthority` denies insufficient mode before a write;
- `runtime.apply` remains the lifecycle transition owner;
- `resumeAll` still delegates to `recoverDurableMissions`;
- UNKNOWN still yields no prepared step in `lib/accounting-status.ts`.

The coordinator-facing adapter is opt-in composition for routing execution. Existing commands and handlers continue calling `start`, `advance`, and `resumeAll` unchanged, so no command, agent, or operator workflow is added.

## 8. D6 — Strict-TDD tests and journey

### 8.1 Exact test paths

- `__tests__/routing/preflight.test.ts`
- `__tests__/routing/route-selector.test.ts`
- `__tests__/routing/executor.test.ts`
- `__tests__/routing/mission-routing-seam.test.ts`
- `__tests__/routing/routing-adapter-journey.test.ts`
- `__tests__/routing/fixtures.ts`

Existing regression suites remain unchanged unless the mission seam requires a focused assertion in `__tests__/extension-mission-commands.test.ts`.

### 8.2 TDD sequence

Every work unit starts RED with the focused test, implements the smallest behavior, then triangulates with a second boundary case. Tests remain in the same work unit as production code.

Focused commands:

```bash
bun test __tests__/routing/preflight.test.ts
bun test __tests__/routing/route-selector.test.ts
bun test __tests__/routing/executor.test.ts
bun test __tests__/routing/mission-routing-seam.test.ts
bun test __tests__/routing/routing-adapter-journey.test.ts
```

Final candidate checks:

```bash
bun test
bun run typecheck
bun run verify:package
```

### 8.3 Journey harness

`routing-adapter-journey.test.ts` uses the actual installed `drenyra-ai@0.3.0` package and real Pi canonicalization, evidence graph, authority gates, chain pipeline, and mission coordinator over an isolated `storesRoot`. The happy path is:

```text
canonical request
  → seven-stage preflight
  → helper-built and validated WorkUnit
  → 18-cell selector
  → one bounded chain execution
  → advanceWorkUnit with imported validateTransition
  → createProposedCandidateRef
  → createWorkResult + validateWorkResult
```

The result assertions cover work/mission identity, scope and evidence hashes, policy/skill pins, authorized tools/destinations, candidate `subjectHash` and `materialityBasis`, tool provenance, BigInt-cent cost, attempts, unresolved exceptions, and validator-approved next transition.

SDD-040-style negative controls mutate one boundary at a time and assert the harness fails for the named reason:

| Control | Mutation | Required failure |
| --- | --- | --- |
| Budget exhaustion | Consume cost, tokens, research attempt 4, or correction attempt 2 before dispatch | `BUDGET_EXHAUSTED` with exact dimension; route port call count does not increase |
| Evidence insufficiency | Remove a required hash, corrupt a payload hash, or break mission-local lineage | preflight/selector `MISSING_EVIDENCE`; execution call count is zero |
| UNKNOWN no retry | Return `missionAfter.status = UNKNOWN`, then attempt automatic resubmission | first result records exception; subsequent port call count remains zero |
| Validator injection honesty | Inject a validator spy that rejects the observed edge, and separately mutate `nextTransition` after construction | `INVALID_TRANSITION`; original unit unchanged; `validateWorkResult` rejects mutation |
| Scope binding retention | Change one canonical scope element or mission company/period after preflight | `SCOPE_MISMATCH`/`AMBIGUOUS_INPUT`; no store mutation |
| Candidate provenance | Drop `subjectHash` or `materialityBasis` | `createProposedCandidateRef`/result validation fails |
| No local authority | Return a local “allowed” claim while Core gate/validator denies | denial remains authoritative; no result can claim success |

The mission seam test additionally proves exactly one RUN, SKIP, or WAIT decision per call, authority denial before writes, and fail-closed UNKNOWN recovery.

## 9. D7 — Exact apply whitelist

Apply may touch only:

### New production modules

- `lib/routing/types.ts`
- `lib/routing/preflight.ts`
- `lib/routing/route-selector.ts`
- `lib/routing/executor.ts`
- `lib/routing/index.ts`

### Narrow integration seam

- `lib/mission-commands.ts`

`lib/chain-pipeline.ts` is read-only by default. It may be edited only if RED proves the existing exported `runChainStep`/`executePreparedStep` seam cannot provide one bounded port call; tasks must name the exact missing seam and pair the smallest export-only change with `__tests__/chain-pipeline.test.ts`. No chain semantics may change.

### Tests

- `__tests__/routing/preflight.test.ts`
- `__tests__/routing/route-selector.test.ts`
- `__tests__/routing/executor.test.ts`
- `__tests__/routing/mission-routing-seam.test.ts`
- `__tests__/routing/routing-adapter-journey.test.ts`
- `__tests__/routing/fixtures.ts`
- `__tests__/extension-mission-commands.test.ts` only for a seam regression assertion
- `__tests__/chain-pipeline.test.ts` only with the conditional export-only seam above

### OpenSpec artifacts

- `openspec/changes/pi-sdd-030-routing-adapter/design.md`
- `openspec/changes/pi-sdd-030-routing-adapter/tasks.md`
- `openspec/changes/pi-sdd-030-routing-adapter/apply-progress.md`
- `openspec/changes/pi-sdd-030-routing-adapter/verify-report.md`
- `openspec/changes/pi-sdd-030-routing-adapter/state.yaml` when managed by OpenSpec

Explicitly excluded:

- `runtime/**`;
- `chains/**`;
- `agents/**`, commands, command registries, extensions, prompts, or operator workflows;
- `node_modules/**`, `dist/**`, `vendored/**`, and the `drenyra-ai` repository/master artifacts;
- `package.json`, lockfiles, and `runtime/pin.ts` (read-only pin evidence only);
- local transition matrices, fiscal thresholds, gate implementations, approval grant logic, receipt authority, or parallel routing contracts.

An apply actor stops before editing an unlisted path and returns to design/tasks for explicit scope review.

## 10. Work-unit breakdown and forecast

Changed-line estimates count authored additions plus deletions. Tests stay with behavior; generated output is excluded and must not be committed.

| Work unit | Deliverable and strict-TDD boundary | Expected paths | Focused evidence | Estimated changed lines | Rollback boundary |
| --- | --- | --- | --- | ---: | --- |
| WU1 — Published-contract fixtures and seven-stage preflight | **RED:** each ordered stage and helper validation fails closed with a published stop kind. **GREEN:** add adapter types, preflight, budget normalization, and fixtures. **TRIANGULATE:** corrupt evidence, conflicting tier, approval requirement, and invalid helper issue paths. | `types.ts`, `preflight.ts`, `preflight.test.ts`, `fixtures.ts` | `bun test __tests__/routing/preflight.test.ts` | 300–430 | Remove preflight/types/tests/fixtures; no persisted state migration |
| WU2 — Exhaustive selector and budget isolation | **RED:** all 18 normalized cells plus invalid-domain cases. **GREEN:** pure table/function. **TRIANGULATE:** route cannot transfer ledger or authority. | `route-selector.ts`, `route-selector.test.ts`, barrel | `bun test __tests__/routing/route-selector.test.ts` | 150–230 | Remove selector and its tests; preflight remains independently valid |
| WU3 — Bounded executor and structured result | **RED:** validator denial, budget exhaustion, provenance loss, UNKNOWN resubmission, and mutated next transition fail. **GREEN:** one-dispatch executor, candidate/result helper path, ledger enforcement. **TRIANGULATE:** direct/delegated/durable shared assertions. | `executor.ts`, `executor.test.ts`, supporting type/barrel edits | `bun test __tests__/routing/executor.test.ts` | 330–480 | Remove executor/tests and supporting exports; selector/preflight remain |
| WU4 — Durable one-step seam | **RED:** one invocation can perform only one RUN/SKIP/WAIT; UNKNOWN/WAIT/authority denial cannot write or loop. **GREEN:** add `createDurableMissionRoutingPort` only. **TRIANGULATE:** existing mission regression tests. | `mission-commands.ts`, `mission-routing-seam.test.ts`, optionally existing mission test | `bun test __tests__/routing/mission-routing-seam.test.ts`; `bun test __tests__/extension-mission-commands.test.ts` | 120–200 | Revert only the exported seam and its tests; existing coordinator behavior is untouched |
| WU5 — Pinned-runtime journey and negative controls | **RED:** each mutation fails for its named binding. **GREEN:** full preflight → route → execute → result harness. **TRIANGULATE:** all three routes and final suite. | `routing-adapter-journey.test.ts`, fixture refinements, OpenSpec evidence | focused journey, `bun test`, typecheck, package verification | 240–360 | Remove journey-only test/fixture additions and evidence updates; production units remain independently testable |

**Forecast:** 1,140–1,700 authored changed lines.  
**400-line budget risk:** High.  
**Chained PRs recommended:** Yes.  
**Decision needed before apply:** Yes under `ask-on-risk`.

Natural review slices are WU1, WU2+WU3, and WU4+WU5. WU2 and WU3 may be separated if measured authored changes approach 400 lines. Each work unit records its focused command/result, runtime scenario/result (or justified N/A), and rollback boundary independently of commit creation.

## 11. Invariants and failure behavior

1. The installed pin remains `drenyra-ai@0.3.0`; no unpublished source is consumed.
2. Every request encounters all applicable preflight stages in the fixed order and stops at the first failure.
3. No execution occurs without a helper-built, helper-validated `WorkUnit`.
4. Scope bindings are recomputed; evidence payload hashes and mission-local lineage are verified before use.
5. Materiality comes only from `deriveRequiredMateriality` and its delegated Core call; Pi contains no tier thresholds.
6. Route selection is advisory and total over the normalized 18 cells; incomplete/contradictory input never defaults.
7. Each executor call dispatches one route operation and owns one non-transferable work-unit ledger.
8. Research attempts never exceed three; correction never exceeds one; time, token, and explicit policy-bounded cost ceilings stop before overspend.
9. Authorized tools and destinations are allow-lists; an undeclared operation or destination stops before dispatch.
10. Every transition reaches the imported/injected Core validator through published helpers. No local matrix exists.
11. UNKNOWN causes zero blind retries and an explicit unresolved exception; already-UNKNOWN recovery stays outside ordinary routing execution.
12. Every result uses `createWorkResult` and then `validateWorkResult`; explanation never supplies authority.
13. Durable continuation remains exactly one RUN, SKIP, or WAIT decision and preserves fail-closed recovery.
14. Evidence-backed conclusions/actions retain valid `source → transformation → conclusion → action` lineage and recomputed payload hashes.
15. No new command, agent, fiscal authority, runtime edit, chain redesign, or master artifact edit is permitted.

## 12. Requirement coverage

| Requirements | Design location |
| --- | --- |
| `REQ-PRE-001..006` | §§3–4, WU1 |
| `REQ-ROUTE-001..003` | §5, WU2 |
| `REQ-EXEC-001..005` | §§6, 8, WU3/WU5 |
| `REQ-INTEG-001..003` | §§3.3, 7–8, WU4/WU5 |
| `REQ-BOUND-001..004` | §§2, 9, 11 |

If the pinned helper or Core validator cannot express a required result—especially an ordinary transition out of an already-UNKNOWN mission—the implementation stops with cited evidence. It must not add a Pi surrogate, mutate the published contract, or reproduce Core authority.
