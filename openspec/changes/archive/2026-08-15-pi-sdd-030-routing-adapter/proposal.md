# Change: Add Deterministic Work Routing to Drenyra Pi

> Change: `pi-sdd-030-routing-adapter`
> Product: `drenyra-pi`
> Status: proposed (real SDD pipeline: `proposal → specs → design → tasks → apply → verify → archive`)
> Artifact store: OpenSpec
> Date: 2026-08-15
> Runtime baseline: published and pinned `drenyra-ai@0.3.0`
> Program authority: master change SDD-030, Organic Accounting Work Routing

## 0. Decision

Drenyra Pi will add the host-side routing adapter for Organic Accounting Work Routing. The adapter will consume the published `drenyra-ai/routing` contracts, perform a deterministic seven-step preflight, propose one of three execution routes, execute authorized work through Pi's existing chain and mission machinery, enforce bounded attempts and cost, and return a structured `WorkResult`.

The authority boundary is fixed: Pi proposes routes and executes authorized work; Drenyra AI Core determines transitions and fiscal authority. Pi must inject the canonical transition validator into the published routing helpers and must not reproduce the transition matrix, materiality derivation, risk authority, approvals, or gates.

## 1. Intent and business problem

Pi already coordinates durable accounting missions, one-step continuation, chain execution, evidence, and authority gates. The newly published routing surface supplies immutable `WorkUnit` and `WorkResult` contracts, but Pi does not yet have one deterministic adapter that turns an accounting-work request into a bounded route, drives the authorized execution path, and reports the result with complete provenance.

Without that adapter, routing remains vulnerable to inconsistent or ad hoc host behavior:

1. incomplete scope, permissions, or evidence may reach execution machinery before a uniform preflight rejects them;
2. direct analysis, delegated-agent work, and durable missions may be selected without one reproducible risk/evidence/reversibility rule;
3. attempts and cost may be tracked differently across execution paths;
4. results may omit evidence hashes, policy and skill versions, model/tool provenance, unresolved exceptions, or transition eligibility; and
5. host logic may accidentally drift into Core-owned fiscal authority or transition decisions.

This change closes the Pi-side integration gap. It does not implement the deferred Core preflight router from the master change and does not modify the frozen routing contracts.

## 2. Verified starting state

These are proposal inputs, not completion claims. Apply and verify must produce fresh evidence against the final candidate.

| Starting fact | Evidence |
| --- | --- |
| The routing contracts and helpers are delivered by the published runtime | Coordinated master input: `drenyra-ai@0.3.0` exports `drenyra-ai/routing` with immutable `WorkUnit`, `WorkResult`, and `WorkStopReason` surfaces plus `createWorkUnit` and `createWorkResult` |
| Pi already consumes the required runtime release | Coordinated repository input, 2026-08-15: the Pi pin bump to `drenyra-ai@0.3.0` is merged |
| The routing helpers deliberately receive transition validation from the authority owner | Coordinated master input: helpers use an injected canonical transition validator; Pi must pass that validator rather than derive a transition matrix |
| Pi has a durable mission coordinator with bounded single-step continuation | `lib/mission-commands.ts`: mission start, one-step `RUN`/`SKIP`/`WAIT` continuation, authority-bound advance, and fail-closed recovery |
| Pi has a shared execution pipeline and accounting chains | `lib/chain-pipeline.ts`; `chains/monthly-close.ts`; `chains/reconcile.ts`; `chains/verify.ts`; `chains/evidence.ts` |
| Pi already delegates authority-sensitive decisions to the kernel | `lib/authority-gates.ts`; `deriveRequiredMateriality` delegation supplied by the coordinated SDD-040 boundary evidence |
| Scope and evidence are existing Pi foundations to reuse | `lib/accounting-status.ts`; scope-binding and evidence-graph machinery identified in the coordinated implementation context |
| Host replaceability is already an established boundary requirement | Archived change `openspec/changes/archive/2026-08-15-pi-sdd-040-adapter-boundary/`: Pi coordinates and executes authorized work while Core determines authoritative outcomes |
| Core-side preflight routing is not available for this slice | Master SDD-030 coordination: Slice C is deferred in `drenyra-ai`; this change implements the separate Pi adapter/executor side without redefining the shared surface |

Proposal citations identify stable source and coordination inputs. During implementation, accounting conclusions and proposed actions must also satisfy the evidence graph's `source → transformation → conclusion → action` lineage and canonical payload-hash rules. This proposal does not invent evidence node IDs before a mission run exists.

## 3. Scope

### 3.1 Consume the published routing surface

Import the `WorkUnit`, `WorkResult`, and `WorkStopReason` types and the `createWorkUnit` and `createWorkResult` helpers from `drenyra-ai/routing`, using type-only imports where possible.

Pi must supply the Core-owned canonical transition validator through the helpers' injection point. It must not copy the contracts, loosen their validation, create a parallel result shape, or reconstruct transition eligibility locally.

### 3.2 Add the deterministic seven-step preflight

Evaluate each request in this fixed order:

1. canonical scope;
2. permissions;
3. evidence availability and integrity;
4. risk and materiality requirements;
5. reversibility;
6. systems involved; and
7. required human approval.

The preflight produces a bounded `WorkUnit` request only after all applicable steps are complete and unambiguous. It must reuse Pi's existing scope binding, evidence graph, and authority gates. Missing, conflicting, corrupted, or ambiguous inputs fail closed with a typed stop cause; the adapter never guesses scope, evidence, authority, or approval.

The resulting work unit must preserve the published contract fields for objective, scope, evidence references by hash, version-pinned skills and policies, authorized tools and destinations, time/token/cost/attempt budgets, verifiable success condition, and typed stop causes.

Pi may collect or project materiality inputs, but authoritative materiality derivation remains delegated through the existing Core path. The preflight cannot establish fiscal authority.

### 3.3 Select a route deterministically

Propose exactly one eligible execution route from:

- direct analysis;
- delegated agent; or
- durable mission.

Selection must be reproducible from the request's risk tier, evidence sufficiency, and reversibility. The specs and design must define the complete decision table, including fail-closed outcomes for incomplete or contradictory classifications, before implementation.

Route selection is advisory to authority: neither the selected route nor any model recommendation authorizes a fiscal operation. Core gates every transition and retains all approval and R0–R3 authority.

### 3.4 Execute through the Pi adapter

Execute an eligible `WorkUnit` through Pi's existing chain pipeline and authority machinery. The adapter must:

1. preserve the canonical scope and evidence-hash bindings;
2. enforce authorized tools and destinations;
3. enforce time, token, cost, and attempt ceilings;
4. use at most three research attempts and one correction attempt, without allowing a broader configured budget to weaken those ceilings;
5. stop rather than blind-retry `UNKNOWN` or any non-retryable typed stop cause;
6. preserve Core gate and transition decisions without host overrides; and
7. build the final result with `createWorkResult` and the injected canonical transition validator.

The `WorkResult` must carry the structured outcome, evidence references by hash, proposed candidates with `subjectHash` and `materialityBasis`, unresolved exceptions, policy and skill versions, model and tool provenance, cost and attempts consumed, and the next eligible Core-determined transition.

The specifications must make budget accounting units and exhaustion behavior explicit without changing the published contract semantics.

### 3.5 Integrate durable missions

Integrate the adapter with `lib/mission-commands.ts` so a selected durable mission can be started and advanced through the new routing path. Existing one-step continuation semantics remain intact: one continuation performs one `RUN`, `SKIP`, or `WAIT` decision and never turns into an unbounded execution loop.

Direct analysis and delegated-agent routes must use the same `WorkUnit`/`WorkResult`, preflight, budget, evidence, and stop-cause rules even when their execution mechanics differ.

### 3.6 Prove the journey with strict TDD

Implement in strict `RED → GREEN → TRIANGULATE` order. Add unit and integration coverage for:

- each preflight stage and fail-closed boundary;
- the complete deterministic route-selection table;
- attempts, correction, and cost exhaustion;
- evidence hashes, pinned policy/skill versions, provenance, proposed-candidate fields, and unresolved exceptions in results;
- canonical transition-validator injection and rejection behavior;
- typed stop reasons, including zero blind retries after `UNKNOWN`;
- durable-mission one-step continuation; and
- a full journey from preflight through route selection and execution to `WorkResult`.

The journey test must follow the SDD-040 harness style: exercise the real host boundary against the pinned published runtime, assert authority-relevant projections, and include negative controls that fail when Pi substitutes a Core decision or drops a binding. Exact test paths and commands belong to specs/design and repository conventions.

## 4. Affected areas

| Area | Expected effect |
| --- | --- |
| Routing adapter | Add the Pi-owned preflight, deterministic route proposal, execution adaptation, budget enforcement, and result projection |
| `lib/mission-commands.ts` | Integrate durable-mission routing while preserving one-step continuation and authority-bound advance |
| `lib/chain-pipeline.ts` | Expose or reuse the smallest execution seam needed by bounded `WorkUnit` execution; do not duplicate pipeline authority logic |
| Scope and accounting status | Reuse canonical scope binding and status inputs; change only where adapter integration requires an existing public seam |
| Evidence graph | Reuse hash verification and citation lineage for work inputs, conclusions, and proposed actions |
| `lib/authority-gates.ts` | Continue delegating authority and materiality decisions to Core; adapt inputs only if required by the routing boundary |
| Accounting chains | Route eligible work into existing chains without changing their fiscal semantics |
| Tests and fixtures | Add strict-TDD unit, integration, negative-control, budget, mission-continuation, and end-to-end journey evidence |
| OpenSpec artifacts | Specify the decision table and acceptance criteria, design the adapter boundary, plan work units, record apply/verify evidence, and archive the change |
| `drenyra-ai` | No source or master artifact changes; consumed only through published `drenyra-ai@0.3.0` APIs |

Exact source and test file boundaries beyond the required integration points belong to specs/design. The implementation must prefer existing seams over broad refactoring.

## 5. Non-goals

- No reimplementation, extension, or semantic change of `WorkUnit`, `WorkResult`, `WorkStopReason`, `createWorkUnit`, or `createWorkResult`.
- No Pi-local transition matrix or next-transition derivation; the canonical validator is injected from Core.
- No Pi decision of fiscal authority, authoritative R0–R3 risk, materiality, approvals, gate outcomes, or execution permission.
- No implementation of the deferred `drenyra-ai` Slice C preflight router.
- No new command, agent, or operator workflow.
- No runtime pin bump; the baseline remains the already-merged `drenyra-ai@0.3.0`.
- No edit to the `drenyra-ai` master SDD-030 or any other master artifact.
- No change to existing one-step mission continuation semantics.
- No blind retry of `UNKNOWN` and no unbounded research, correction, cost, token, or time loop.
- No SDD-020, SDD-050, SDD-070, SDD-080, SDD-090, or SDD-110 work; SDD-040 remains completed context, not reopened scope.
- No unrelated redesign of chains, stores, accounting status, authority gates, or evidence infrastructure.

## 6. Success criteria

The change is successful only when all applicable criteria pass against the same final candidate:

1. Pi imports and uses the published `drenyra-ai/routing` contracts and helpers without a parallel local contract implementation.
2. Every request passes the seven preflight stages in order, and incomplete, corrupt, contradictory, or ambiguous input stops before execution with a typed cause.
3. Canonical scope is complete and hash-bound; evidence references are canonical SHA-256 hashes with valid mission-local lineage where required.
4. The route selector deterministically proposes direct analysis, delegated agent, or durable mission from the specified risk, evidence, and reversibility inputs, with complete table coverage.
5. Route or model selection never decides fiscal authority; Core remains the owner of materiality, R0–R3 outcomes, approvals, gates, and transitions.
6. Pi injects and obeys the canonical Core transition validator; negative controls fail if Pi fabricates or overrides a next transition.
7. Execution enforces the work unit's authorized tools/destinations and time, token, cost, and attempt budgets, including hard ceilings of three research attempts and one correction attempt.
8. Budget exhaustion produces a typed stop and a structured partial or stopped result where the published contract permits it; it never opens an unbounded retry path.
9. `UNKNOWN` produces zero blind retries and leaves an explicit unresolved exception or required reconciliation/human action in the result.
10. Every `WorkResult` includes the structured outcome, evidence refs, candidate `subjectHash` and `materialityBasis`, unresolved exceptions, policy/skill versions, model/tool provenance, consumed cost/attempts, and validator-derived next transition as applicable.
11. A durable mission is started and advanced through the adapter while preserving exactly one `RUN`, `SKIP`, or `WAIT` action per continuation.
12. Strict-TDD unit and integration tests cover preflight, route selection, budget enforcement, stop causes, result construction, and mission integration.
13. The end-to-end journey test executes `preflight → route → execute → result` against the pinned published runtime and includes authority-boundary negative controls modeled on the SDD-040 harness approach.
14. Focused tests, the full test suite, typecheck, and applicable package verification pass with exact commands and results recorded in apply and verify evidence.
15. Verification confirms every non-goal and identifies the exact final candidate, runtime pin, policy/skill versions, and test evidence used for the verdict.

## 7. Risks and mitigations

| ID | Severity | Risk | Mitigation |
| --- | --- | --- | --- |
| R1 | HIGH | Pi's preflight or route selector could become a second fiscal-authority engine | Limit outputs to bounded work requests and route proposals; delegate materiality, gates, approvals, risk authority, and transitions to Core; add authority-substitution negative controls |
| R2 | HIGH | A locally reconstructed transition rule could diverge from the kernel | Require helper use with the injected canonical validator; prohibit a local matrix; test rejection when the validator denies a transition |
| R3 | HIGH | Budget accounting could permit hidden retries or overspend across route boundaries | Define one accounting model in specs/design, carry consumption into `WorkResult`, enforce three-research/one-correction hard ceilings, and test cross-boundary exhaustion |
| R4 | HIGH | Evidence or scope could be accepted after mutation, mismatch, or hash corruption | Recompute canonical bindings before protected work, fail closed on mismatch, and preserve evidence lineage in results and candidates |
| R5 | MEDIUM | Route-selection criteria could remain underspecified and produce inconsistent choices | Define a complete risk/evidence/reversibility decision table with contradictory and incomplete states before implementation; exhaustively test it |
| R6 | MEDIUM | Mission integration could accidentally turn one-step continuation into an execution loop | Keep the existing `RUN`/`SKIP`/`WAIT` boundary and assert one transition attempt per continue call |
| R7 | MEDIUM | Different execution routes could emit inconsistent result provenance | Use one result-construction path and shared assertions for evidence, versions, tools, model, cost, attempts, exceptions, and next transition |
| R8 | MEDIUM | `UNKNOWN` handling could consume retries without new authority or evidence | Treat `UNKNOWN` as non-blind-retryable; stop with typed cause and require reconciliation or explicit human action |
| R9 | MEDIUM | Broad changes to mature chain machinery could create unrelated regressions | Adapt through the narrowest existing seams, preserve chain semantics, and keep focused tests with each work unit |
| R10 | LOW | Strict-TDD and journey coverage may exceed a comfortable single review unit | Tasks must forecast authored changed lines and split coherent behavior-plus-test work units according to the configured delivery strategy |

## 8. Rollback

Rollback is bounded by behavior and must not remove unrelated work:

1. Remove the routing adapter's preflight and route selector with their unit tests as one coherent work unit.
2. Remove executor adaptation and budget/result enforcement with their focused integration tests; leave existing chain behavior intact.
3. Revert only the mission-coordinator integration seam and its one-step continuation tests; do not remove or rewrite existing mission state.
4. Remove the journey harness and dedicated fixtures without changing the completed SDD-040 harness or shared runtime pin.
5. Re-run the focused pre-change mission/chain checks, full suite, and typecheck after each rollback boundary.

No rollback step may change the published routing contracts, alter the runtime tarball or pin, edit a master repository/artifact, delete persisted user data, use a blanket reset/clean, or touch unrelated work.

## 9. Delivery and evidence constraints

- Implement in strict `RED → GREEN → TRIANGULATE` order; tests remain in the same work unit as the behavior they establish.
- Organize work by reviewable outcomes rather than file type. Each work unit records its focused test command/result, relevant runtime journey scenario/result, and exact rollback boundary.
- The tasks phase must include a Review Workload Forecast and honor the orchestrator's delivery strategy before apply. If authored changes exceed 400 lines, apply the configured split/exception policy rather than silently creating an oversized review.
- Runtime accounting conclusions and actions must cite valid evidence-graph lineage and verified payload hashes. Source-level architectural claims must cite stable paths, symbols, tests, and the pinned runtime API.
- Verification must use the published pinned `drenyra-ai@0.3.0` artifact, not a workspace checkout, unpublished build, or locally modified replacement.
- Apply and verify evidence must distinguish Core-determined authority from Pi-proposed routing and Pi-executed authorized work.

## 10. Proposal question round

A live product-question round was not available in this delegated authoring step. The following questions and working assumptions require user review before or during the specs phase; they do not expand scope automatically.

1. **When should evidence be considered sufficient for route selection?** Assumption: sufficiency means all evidence required by the bound objective and applicable policy is present, hash-valid, and connected by valid mission-local lineage; uncertainty fails closed rather than being treated as sufficient.
2. **How should the three routes divide work at boundary cases?** Assumption: the specifications will define one exhaustive risk/evidence/reversibility table, with durable missions handling work that cannot safely complete as a bounded direct or delegated operation; no model may override the table.
3. **What should happen when cost is exhausted after useful partial work?** Assumption: execution stops immediately, preserves supported partial output and evidence in `WorkResult`, records an unresolved exception and typed cause, and proposes only a validator-eligible next transition without obtaining new authority.
4. **Can a human approval discovered during preflight make a route executable?** Assumption: no. Preflight records approval requirements or existing bound approval evidence, but only Core gates determine whether the next transition is authorized.
5. **What is the first product slice if mission integration exposes broad refactoring pressure?** Assumption: keep the slice to one narrow adapter seam that preserves existing one-step mission behavior; defer unrelated chain or coordinator redesign rather than expanding this change.

## 11. Result contract

- `status`: `proposed`
- `executive_summary`: consume the published routing contracts to add a deterministic, fail-closed Pi preflight, route proposal, budgeted executor, structured result, and durable-mission integration while keeping all fiscal authority and transition decisions in Drenyra AI Core.
- `artifacts`: `openspec/changes/pi-sdd-030-routing-adapter/proposal.md`
- `next_recommended`: `spec`
- `risks`: R1..R10 (§7)
- `skill_resolution`: `paths-injected` (`cognitive-doc-design`, `work-unit-commits`, `evidence-citation`, and `scope-discipline` loaded before work)
