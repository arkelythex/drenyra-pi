# Drenyra Pi Routing Adapter — Specification

> Change: `pi-sdd-030-routing-adapter`
> Product: `drenyra-pi`
> Phase: specs (real SDD pipeline)
> Date: 2026-08-15
> Runtime baseline: published and pinned `drenyra-ai@0.3.0`
> Program authority: master change `sdd-030-routing` in `drenyra-ai` (organic accounting work routing; slices A+B delivered 2026-08-15, preflight router slice C deferred)
> Requirement ID prefixes: `REQ-PRE`, `REQ-ROUTE`, `REQ-EXEC`, `REQ-INTEG`, `REQ-BOUND`

## Purpose

Defines what must be true after Drenyra Pi consumes the published
`drenyra-ai@0.3.0` routing surface as a deterministic, fail-closed host-side
adapter for Organic Accounting Work Routing: a fixed seven-stage preflight that
produces a bounded `WorkUnit` request only when every stage is complete and
unambiguous; a deterministic route proposal (direct analysis, delegated agent,
or durable mission) derived from risk tier, evidence sufficiency, and
reversibility; bounded execution through Pi's existing chain pipeline and
mission machinery with the injected canonical transition validator; a
structured `WorkResult` with complete provenance; durable-mission integration
that preserves exactly one-step continuation; and strict authority-boundary
discipline.

The authority boundary is fixed and unchanged from the SDD-040 adapter
boundary: Pi proposes routes and executes authorized work; Drenyra AI Core
determines transitions, materiality, gate verdicts, approvals, and fiscal
authority. Pi injects the Core-owned canonical transition validator into the
published routing helpers and must never reproduce the transition matrix,
materiality derivation, risk authority, approvals, or gates. Accounting
conclusions and proposed actions inside a mission must satisfy the evidence
graph's `source → transformation → conclusion → action` lineage and canonical
payload-hash rules; evidence references in work units and results are SHA-256
hashes. This change does not implement the deferred Core-side preflight router
(slice C) and does not modify the frozen routing contracts.

## Requirements

## REQ-PRE — Deterministic preflight

### Requirement: REQ-PRE-001 — Seven-stage preflight in fixed order

The system MUST evaluate every work request through the fixed seven-stage
preflight in this exact order: (1) canonical scope, (2) permissions, (3)
evidence availability and integrity, (4) risk and materiality requirements,
(5) reversibility, (6) systems involved, and (7) required human approval. The
preflight MUST produce a bounded `WorkUnit` request only after every applicable
stage is complete and unambiguous. Missing, conflicting, corrupted, or
ambiguous input at any stage MUST fail closed with a typed `WorkStopReason`
from the published union, and no execution path MAY be reached without a
completed preflight.

#### Scenario: SC-PRE-001 — All seven stages pass and a work unit is produced

- GIVEN a complete request with a valid canonical scope, granted permissions,
  integrity-verified evidence, complete materiality input, a valid
  reversibility value, available systems, and no required approval
- WHEN the seven-stage preflight runs in order
- THEN every stage completes unambiguously and a bounded `WorkUnit` request is
  produced; no stage is skipped or reordered

#### Scenario: SC-PRE-002 — Any incomplete or ambiguous stage fails closed

- GIVEN a request in which one stage is missing, conflicting, corrupted, or
  ambiguous (for example a scope element is absent or evidence is hash-invalid)
- WHEN the preflight reaches that stage
- THEN the preflight stops with a typed `WorkStopReason` naming the failure,
  no `WorkUnit` is produced, and no execution path is reached

### Requirement: REQ-PRE-002 — Reuse existing Pi foundations; never reimplement them

The preflight MUST reuse Pi's existing canonical scope binding
(`lib/canonicalization.ts` — `validateCanonicalScope`, `bindScope`, and scope
hash recomputation), the evidence graph (`lib/evidence-graph.ts` — integrity
validation, payload-hash recomputation, and mission-local lineage), and the
authority gates (`lib/authority-gates.ts` — `requiredModeFor`,
`assertMonotonicAuthority`, and bound authorization records). The preflight
MUST NOT reimplement scope validation, evidence verification, permission
evaluation, or gate logic; it MAY order and validate inputs and stop at the
first non-passing stage.

#### Scenario: SC-PRE-003 — Scope mismatch fails closed before any store touch

- GIVEN a request whose scope recomputes to a hash different from the bound
  scope hash
- WHEN the scope stage runs
- THEN the preflight fails closed with `SCOPE_MISMATCH` naming the differing
  fields, and no store is touched before the failure

#### Scenario: SC-PRE-004 — Corrupted evidence and insufficient permission fail closed

- GIVEN a request whose evidence graph fails integrity validation, or whose
  bound authority mode is below the required mode for the requested work
- WHEN the evidence stage, respectively the permissions stage, runs
- THEN the evidence failure stops with `MISSING_EVIDENCE` listing the required
  hashes, and the permission failure stops with `POLICY_BLOCKED` naming the
  governing policy pin; neither failure is guessed around

### Requirement: REQ-PRE-003 — Materiality stays delegated; no fiscal authority

The preflight MUST NOT derive authoritative materiality itself. It MAY collect
or project explicit `MaterialityInput` values and declared policy floors (for
example the monthly-close R2 floor), but the materiality tier MUST be obtained
only through the existing delegated path (`lib/authority-gates.ts`
`deriveRequiredMateriality`, which delegates the tier to the kernel
`deriveMateriality`). Missing or invalid materiality input MUST fail closed and
MUST NOT default to R0, and a declared tier that conflicts with the
kernel-derived tier MUST fail closed. The preflight MUST NOT establish fiscal
authority, grant approvals, or decide gate outcomes.

#### Scenario: SC-PRE-005 — Missing materiality input never defaults to R0

- GIVEN a candidate-bearing request with no explicit `MaterialityInput` or with
  an invalid one
- WHEN the risk and materiality stage runs
- THEN the preflight fails closed with a typed stop cause, and no default tier
  (in particular no R0) is assumed

#### Scenario: SC-PRE-006 — Tier comes from the kernel with the floor as minimum

- GIVEN a request with a complete explicit `MaterialityInput` and a declared
  policy floor
- WHEN the materiality tier is obtained through the existing delegated path
- THEN the tier is the kernel-derived tier raised at most to the declared
  minimum floor, no Pi-local module computes the tier, and a conflicting
  declared classification fails closed as ambiguous

### Requirement: REQ-PRE-004 — Reversibility classified deterministically

The preflight MUST classify reversibility as `REVERSIBLE`,
`PARTIALLY_REVERSIBLE`, or `IRREVERSIBLE` from the validated materiality
input's reversibility field (or the request's declared classification where the
published contract permits). A missing or invalid reversibility value MUST fail
closed and MUST NOT be defaulted; the classification MUST be carried into route
selection unchanged.

#### Scenario: SC-PRE-007 — Invalid reversibility fails closed; valid value flows to routing

- GIVEN a request whose reversibility value is missing, malformed, or outside
  the three legal values
- WHEN the reversibility stage runs
- THEN the preflight fails closed with a typed stop cause
- GIVEN a request with a valid reversibility value
- WHEN the reversibility stage completes
- THEN the classification is passed deterministically to route selection

### Requirement: REQ-PRE-005 — Systems and approval requirements recorded; approvals never self-granted

The preflight MUST verify the availability of every system the work requires,
failing closed with `EXTERNAL_SYSTEM_UNAVAILABLE` naming the `systemId` when a
required system is unavailable, and MUST record approval requirements or
existing bound approval evidence as typed stop conditions without granting
approval. A discovered approval requirement MUST NOT make a route executable:
only Core gates determine whether the next transition is authorized.

#### Scenario: SC-PRE-008 — Unavailable system and required approval both fail closed

- GIVEN a request whose work depends on an unavailable external system
- WHEN the systems stage runs
- THEN the preflight fails closed with `EXTERNAL_SYSTEM_UNAVAILABLE` naming the
  system
- GIVEN a request that requires human approval with no bound approval evidence
- WHEN the approval stage runs
- THEN the requirement is recorded as an `APPROVAL_REQUIRED` stop condition on
  the work unit, and the preflight neither grants the approval nor treats the
  recorded requirement as authorization

### Requirement: REQ-PRE-006 — WorkUnit preserves the full published contract

A produced `WorkUnit` request MUST preserve every published contract field:
`id`, `missionId`, `objective`, `stage`, `scope` (`tenantId`, `ruc`,
`companyId`, `period`, `intent`), `evidenceAllowed` by lowercase hex SHA-256
hash, version-pinned `skills` and `policies`, `authorizedTools` and
`authorizedDestinations`, `outputSchema`, `budgets` (time, tokens, BigInt-cent
cost, research attempts, correction attempts), verifiable `successConditions`,
and typed `stopConditions`. The work unit MUST be built with the published
`createWorkUnit` helper against the mission snapshot (with `missionId`,
`companyId`, `period`, `intent`, and the DRAFT entry stage derived by the
helper) and MUST pass `validateWorkUnit` before it may be used for execution.

#### Scenario: SC-PRE-009 — Helper-built unit validates; a malformed unit never executes

- GIVEN a completed preflight over a valid mission snapshot
- WHEN `createWorkUnit` builds the request and `validateWorkUnit` runs
- THEN the unit carries every contract field and passes validation
- GIVEN a unit missing a required evidence hash or carrying a malformed budget
- WHEN the helper validation runs
- THEN validation fails with a typed issue and the unit never reaches execution

## REQ-ROUTE — Route selection

### Requirement: REQ-ROUTE-001 — Deterministic route proposal from three inputs

The system MUST propose exactly one eligible route — direct analysis, delegated
agent, or durable mission — from the request's (a) risk tier, (b) evidence
sufficiency, and (c) reversibility classification, using the complete decision
table in REQ-ROUTE-002. The risk tier MUST be the kernel-derived materiality
tier obtained through the existing delegated path. Evidence sufficiency is
`SUFFICIENT` only when all evidence required by the bound objective and
applicable policy is present, hash-valid, and connected by valid mission-local
lineage where the mission model requires it; uncertainty fails closed rather
than being treated as sufficient. The selection MUST be a proposal only: it
MUST NOT authorize a fiscal operation, grant a transition, or decide a gate
outcome — Core gates every transition.

#### Scenario: SC-ROUTE-001 — Exactly one route proposed; proposal never authorizes

- GIVEN a completed preflight with a kernel-derived risk tier, a sufficiency
  classification, and a reversibility classification
- WHEN the route selector runs
- THEN exactly one of direct analysis, delegated agent, or durable mission is
  proposed with its basis, the proposal grants no authority, and the next
  transition still requires the Core validator and gates

### Requirement: REQ-ROUTE-002 — Complete, exhaustive decision table with fail-closed cells

The system MUST implement the full deterministic decision table over risk tier
× evidence sufficiency × reversibility, with no uncovered or non-deterministic
cell. Incomplete or contradictory classifications MUST fail closed with
`AMBIGUOUS_INPUT` and MUST NOT default to a route. The table is:

| Risk tier (kernel-derived) | Evidence sufficiency | Reversibility | Proposed route |
| --- | --- | --- | --- |
| R0–R1 | SUFFICIENT | REVERSIBLE | direct analysis |
| R0–R1 | SUFFICIENT | PARTIALLY_REVERSIBLE | delegated agent |
| R0–R1 | SUFFICIENT | IRREVERSIBLE | delegated agent |
| R2–R3 | SUFFICIENT | REVERSIBLE | delegated agent |
| R2–R3 | SUFFICIENT | PARTIALLY_REVERSIBLE | durable mission |
| R2–R3 | SUFFICIENT | IRREVERSIBLE | durable mission |
| any | INSUFFICIENT | any | no route — fail closed (`MISSING_EVIDENCE`) |
| incomplete or contradictory classification | — | — | no route — fail closed (`AMBIGUOUS_INPUT`) |

Rationale: direct analysis is the smallest safe route (low risk, fully
reversible); delegated agent is the bounded supervised route (low risk with
partial or irreversible impact, or high risk that remains fully reversible);
durable mission is the stateful, authority-bound route for work that cannot
safely complete as one bounded operation (high risk with partial or
irreversible impact). Approval requirements and systems involved are preflight
completions recorded on the work unit; they do not change the proposed route,
and no model recommendation may override the table.

#### Scenario: SC-ROUTE-002 — Every SUFFICIENT cell maps to its route

- GIVEN each of the six `SUFFICIENT` rows of the table with consistent inputs
- WHEN the route selector runs for each row
- THEN each row deterministically produces its mapped route, and exhaustive
  table tests pass for all six rows

#### Scenario: SC-ROUTE-003 — Insufficient evidence never routes

- GIVEN a request whose evidence is missing, hash-invalid, or lineage-invalid
- WHEN the route selector runs
- THEN no route is proposed, the selector fails closed with `MISSING_EVIDENCE`
  listing the required hashes, and uncertainty is never treated as sufficient

#### Scenario: SC-ROUTE-004 — Contradictory classification fails closed

- GIVEN a request whose declared risk tier conflicts with the kernel-derived
  tier, or whose reversibility value is absent or invalid
- WHEN the route selector runs
- THEN no route is proposed and the selector fails closed with
  `AMBIGUOUS_INPUT` naming the conflicting fields

### Requirement: REQ-ROUTE-003 — Budgets bounded, per work unit, and route-scoped

Every `WorkUnit` MUST carry bounded budgets — `timeLimitMs`, `tokenLimit`, and
`costLimitCents` (BigInt cents) as JSON integers/BigInt, `researchAttemptLimit`
of 1..3, and `correctionAttemptLimit` of exactly 1 — and MUST encode the hard
ceilings of at most three research attempts and one correction attempt. No
broader configuration MAY weaken those ceilings. Budget consumption MUST be
accounted per work unit and MUST NOT leak across routes: each route execution
carries its own `costAndAttempts`, and exhaustion MUST produce a typed
`BUDGET_EXHAUSTED` stop naming the exhausted dimension and MUST NOT open an
unbounded retry path.

#### Scenario: SC-ROUTE-005 — Hard ceilings cannot be weakened

- GIVEN a configuration that requests more than three research attempts or more
  than one correction attempt
- WHEN the work unit budgets are built
- THEN the ceilings are clamped to three research and one correction attempt,
  and the unit never carries a weaker budget

#### Scenario: SC-ROUTE-006 — Exhaustion stops typed; no cross-route leakage

- GIVEN a route execution that consumes its research, correction, time, token,
  or cost budget
- WHEN the budget is exhausted
- THEN execution stops with `BUDGET_EXHAUSTED` naming the exhausted dimension,
  a structured partial or stopped result is produced where the published
  contract permits it, no retry loop opens, and the consumption is carried only
  in that work unit's `costAndAttempts`

## REQ-EXEC — Executor adapter

### Requirement: REQ-EXEC-001 — Execute through the chain pipeline with the injected canonical validator

An eligible `WorkUnit` MUST execute through Pi's existing chain pipeline and
authority machinery (`lib/chain-pipeline.ts` — `runChainStep` /
`executePreparedStep`) with the canonical scope and evidence-hash bindings
preserved, authorized tools and destinations enforced, and stage transitions
advanced ONLY through the injected canonical transition validator
(`drenyra-ai/missions` `validateTransition`, passed into the published routing
helpers' injection point for `advanceWorkUnit`, `createWorkResult`, and
`validateWorkResult`). The system MUST NOT derive, reconstruct, or store a
Pi-local transition matrix. Validator rejection MUST return an
`INVALID_TRANSITION` typed stop with `from`/`to` and leave the unit unchanged.

#### Scenario: SC-EXEC-001 — Authorized work runs through the existing pipeline

- GIVEN an eligible `WorkUnit` whose transitions the canonical validator allows
- WHEN the adapter executes the unit through the chain pipeline
- THEN the work runs through Pi's existing pipeline and authority machinery with
  the bound scope and evidence hashes preserved, and every stage transition is
  validated by the injected canonical validator

#### Scenario: SC-EXEC-002 — Validator denial stops; no local override

- GIVEN a work unit whose requested stage transition the canonical validator
  denies
- WHEN the adapter attempts to advance the unit
- THEN the adapter returns an `INVALID_TRANSITION` typed stop naming `from` and
  `to`, the unit is unchanged, and no Pi-local rule substitutes the verdict

### Requirement: REQ-EXEC-002 — Structured WorkResult with complete provenance

The executor MUST build every result with the published `createWorkResult`
helper and the injected canonical validator, and MUST pass `validateWorkResult`.
The result MUST carry: the structured outcome (`SUCCEEDED`, or `STOPPED`/`FAILED`
with a typed reason from the published `WorkStopReason` union); evidence
references by lowercase hex SHA-256 hash; proposed candidates with
`subjectHash` and `materialityBasis` (built via `createProposedCandidateRef`
from a real candidate and `MaterialityInput`); unresolved exceptions; pinned
policy and skill versions; tool provenance (`toolId`, `version`, `operation`,
`outputHash`); cost and attempts in the fiscal convention (BigInt cents and
JSON integers); and the next eligible Core-determined transition derived only
from the injected validator.

#### Scenario: SC-EXEC-003 — Result carries every provenance field

- GIVEN a completed execution
- WHEN `createWorkResult` builds the result with the injected validator
- THEN the result passes `validateWorkResult` and carries the structured
  outcome, evidence refs by hash, candidate `subjectHash` and
  `materialityBasis`, unresolved exceptions, policy/skill versions, tool
  provenance, consumed cost and attempts, and a validator-derived
  `nextTransition`

#### Scenario: SC-EXEC-004 — Fabricated transitions and dropped bindings fail negative controls

- GIVEN a result whose `nextTransition` was not produced by the injected
  validator, or whose candidate refs lack `subjectHash`/`materialityBasis`, or
  whose evidence refs were dropped
- WHEN the authority-boundary negative control runs
- THEN the control fails and names the substituted Core decision or dropped
  binding

### Requirement: REQ-EXEC-003 — Zero blind retries after UNKNOWN

The executor MUST NOT blindly retry an UNKNOWN outcome or any non-retryable
typed stop cause. An UNKNOWN mission MUST yield no prepared step, no
re-submission, and no auto-advance; the result MUST record an explicit
unresolved exception and a typed stop outcome using only the published
`WorkStopReason` union (never an invented kind), and recovery MUST proceed only
through reconciliation or explicit human action.

#### Scenario: SC-EXEC-005 — UNKNOWN stops and waits for reconciliation or human action

- GIVEN a work unit whose execution resolves to UNKNOWN
- WHEN the executor handles the outcome
- THEN zero blind retries occur, no loop re-submits the unit, an explicit
  unresolved exception and a typed stop cause are recorded in the result, and
  only reconciliation or explicit human action can resume

### Requirement: REQ-EXEC-004 — Budget enforcement with typed exhaustion

Execution MUST enforce the work unit's authorized tools and destinations and
its time, token, cost, and attempt budgets. Exhaustion MUST produce a typed
`BUDGET_EXHAUSTED` stop and a structured `STOPPED` (or `FAILED` where the
published contract permits) result carrying the consumed `costAndAttempts`,
preserving supported partial output and evidence; no exhaustion MAY open a
retry loop.

#### Scenario: SC-EXEC-006 — Exhaustion preserves partial work and never loops

- GIVEN an execution whose cost or token budget is exhausted after useful
  partial work
- WHEN the executor detects exhaustion
- THEN execution stops immediately with `BUDGET_EXHAUSTED` naming the
  exhausted dimension, supported partial output and evidence are preserved in
  the result, the consumed cost and attempts are reported, and no retry path
  opens

### Requirement: REQ-EXEC-005 — Strict-TDD journey with authority-boundary negative controls

The system MUST include strict-TDD unit and integration tests covering each
preflight stage and fail-closed boundary, the complete route-selection table,
budget exhaustion, typed stop causes, result construction, canonical
transition-validator injection and rejection, zero blind retries after UNKNOWN,
durable-mission one-step continuation, and an end-to-end journey
`preflight → route → execute → result` against the pinned published runtime.
The journey MUST include authority-boundary negative controls, modeled on the
SDD-040 harness style, that fail when Pi substitutes a Core decision or drops a
binding. Focused tests, the full test suite, and typecheck MUST pass, with
exact commands and results recorded in apply and verify evidence.

#### Scenario: SC-EXEC-007 — Full journey executes against the pinned runtime

- GIVEN the pinned `drenyra-ai@0.3.0` artifact and a bounded work fixture
- WHEN the journey test runs preflight through route selection through
  execution to `WorkResult`
- THEN the journey completes against the pinned published runtime (never a
  workspace checkout or unpublished build) and the result satisfies the
  provenance assertions

#### Scenario: SC-EXEC-008 — Negative controls fail; verification evidence recorded

- GIVEN the journey harness and one of the authority-boundary mutations
  (substitute a Core transition decision or drop a scope/evidence binding)
- WHEN the negative control runs
- THEN the control fails and names the mutated authority decision or binding;
  the focused tests, full suite, and typecheck pass with exact commands and
  results recorded in apply and verify evidence

## REQ-INTEG — Mission integration

### Requirement: REQ-INTEG-001 — Durable mission driven through the adapter with one-step continuation

The durable-mission coordinator (`lib/mission-commands.ts`
`EdaMissionCoordinator`) MUST drive a durable-mission route through the routing
adapter preserving exactly one `RUN`, `SKIP`, or `WAIT` decision per
continuation: one continue call executes one step derived from persisted state
only (`derivePreparedStep`), never from chat; human-wait states MUST NOT
auto-advance; and an advance whose required authority mode exceeds the bound
mode MUST be denied before any write. The existing mission lifecycle MUST NOT
regress.

#### Scenario: SC-INTEG-001 — One continuation executes exactly one decision

- GIVEN a durable mission with a prepared step derived from persisted state
- WHEN one continue call drives the mission through the routing adapter
- THEN exactly one `RUN`, `SKIP`, or `WAIT` decision executes, one phase at most
  advances, and the mission never turns into an unbounded execution loop

#### Scenario: SC-INTEG-002 — WAIT never auto-advances; authority denials precede writes

- GIVEN a durable mission in a human-wait state, or a prepared phase whose
  required authority mode exceeds the bound mode
- WHEN a continue call runs
- THEN the WAIT state is reported without auto-advance, and an authority
  shortfall is denied with the required family and mode before any write

### Requirement: REQ-INTEG-002 — Fail-closed recovery preserved

The integration MUST preserve the existing fail-closed engine recovery
(`lib/mission-store.ts` `recoverDurableMissions` / `resumeAll`): interrupted
missions recover per the engine policy, human-wait and terminal states are
preserved, unresolved recovery records fail closed, and UNKNOWN recovery
requires reconciliation or explicit human action.

#### Scenario: SC-INTEG-003 — Recovery preserves state and never auto-advances UNKNOWN

- GIVEN an interrupted mission, a human-wait or terminal mission, and an UNKNOWN
  mission in the durable stores
- WHEN the fail-closed recovery pass runs
- THEN the interrupted mission recovers per engine policy, human-wait and
  terminal states are preserved unchanged, unresolved recovery records fail
  closed, and the UNKNOWN mission is not auto-advanced

### Requirement: REQ-INTEG-003 — Uniform rules across all three routes

Direct analysis and delegated-agent routes MUST use the same `WorkUnit` /
`WorkResult` contract, preflight, budget accounting, evidence binding,
stop-cause, and UNKNOWN rules as durable missions even when their execution
mechanics differ.

#### Scenario: SC-INTEG-004 — Shared assertions hold across routes

- GIVEN an execution of each of the three routes over the same bounded work
  request
- WHEN the result projections are compared
- THEN every route produces a `WorkResult` through the same construction path
  with the same evidence, budget, stop-cause, and UNKNOWN rules asserted

## REQ-BOUND — Boundaries

### Requirement: REQ-BOUND-001 — No reimplementation of Core-owned behavior

The system MUST NOT re-implement, extend, or change the published routing
surface, transition matrix, materiality derivation, gate verdicts, approvals,
receipts, or fiscal authority. It MUST consume the published `drenyra-ai@0.3.0`
routing contracts and helpers, inject the Core-owned canonical validator, and
MUST NOT reconstruct transition eligibility locally. The change MUST NOT carry
SDD-020, SDD-050, SDD-070, SDD-080, SDD-090, or SDD-110 work; SDD-040 remains
completed context, not reopened scope.

#### Scenario: SC-BOUND-001 — No local matrix or parallel contract in the candidate

- GIVEN the final candidate's changed paths
- WHEN the changed paths are inspected and the authority-substitution negative
  controls run
- THEN no local transition matrix, parallel contract implementation, or
  Pi-decided authority exists, no other gated SDD work is present, and a
  substituted Core decision makes a negative control fail

### Requirement: REQ-BOUND-002 — No new commands, agents, or operator workflows

The change MUST NOT add a new command, agent, or operator workflow: the command
registry, `agents/`, and operator-facing surfaces MUST remain unchanged, and
additions are limited to the adapter modules, integration seams, tests, and
fixtures.

#### Scenario: SC-BOUND-002 — Operator surfaces unchanged

- GIVEN the final candidate
- WHEN the command registry, `agents/`, and operator-facing surfaces are
  inspected
- THEN no new command, agent, or operator workflow was added

### Requirement: REQ-BOUND-003 — Frozen contracts and runtime pin untouched

The change MUST NOT edit the frozen `WorkUnit`, `WorkResult`, or
`WorkStopReason` contracts or the semantics of `createWorkUnit` /
`createWorkResult`, MUST NOT consume or require unpublished `drenyra-ai`
modules, MUST NOT edit the `drenyra-ai` repository or its master SDD-030
artifact, and MUST keep the runtime pinned to the published `drenyra-ai@0.3.0`
artifact (no pin bump).

#### Scenario: SC-BOUND-003 — Pin unchanged and master untouched

- GIVEN the final candidate
- WHEN `package.json`, the runtime pin, and the master repository state are
  inspected
- THEN the runtime remains the published `drenyra-ai@0.3.0` artifact, no
  unpublished module is consumed, no `drenyra-ai` file or master SDD-030
  artifact was changed, and the frozen routing contracts were not edited

### Requirement: REQ-BOUND-004 — Zero blind retries and no unbounded loops

No code path in the candidate MAY blind-retry UNKNOWN or any non-retryable
typed stop cause, and no path MAY create an unbounded research, correction,
cost, token, or time loop.

#### Scenario: SC-BOUND-004 — No blind retry or unbounded loop path in the candidate

- GIVEN the final candidate
- WHEN the retry and loop paths are inspected and the UNKNOWN negative control
  runs
- THEN no blind retry or auto-advance of UNKNOWN exists, budget exhaustion never
  reopens execution, and inserting a blind retry makes a negative control fail

## Out of Scope

- Any reimplementation, extension, or semantic change of `WorkUnit`,
  `WorkResult`, `WorkStopReason`, `createWorkUnit`, or `createWorkResult`.
- Any Pi-local transition matrix or next-transition derivation; the canonical
  validator is injected from Core.
- Any Pi decision of fiscal authority, authoritative R0–R3 risk, materiality,
  approvals, gate outcomes, or execution permission.
- Any implementation of the deferred `drenyra-ai` Slice C preflight router.
- New commands, agents, operator workflows, or unbounded loops of any kind.
- A runtime pin bump or consumption of unpublished drenyra-ai modules; the
  baseline remains the already-merged `drenyra-ai@0.3.0`.
- Any edit to the `drenyra-ai` repository or its master SDD-030 artifact.
- Any change to the existing one-step mission continuation semantics.
- Blind retries or auto-advance after UNKNOWN.
- SDD-020, SDD-050, SDD-070, SDD-080, SDD-090, or SDD-110 work; SDD-040 remains
  completed context, not reopened scope.
- Unrelated redesign of chains, stores, accounting status, authority gates, or
  evidence infrastructure.
