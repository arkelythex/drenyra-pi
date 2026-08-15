# Apply Progress — pi-sdd-030-routing-adapter

> Change: `pi-sdd-030-routing-adapter`
> Runtime baseline: published, pinned `drenyra-ai@0.3.0` (no pin bump, no unpublished source)
> Delivery: strict TDD (RED → GREEN → TRIANGULATE → REFACTOR) via `bun test` (Vitest)
> Authority boundary: Pi preflights, proposes routes, executes authorized work; Core owns materiality, gates, transitions, approvals, fiscal authority.
> Size exception: **applied and recorded** — verification-heavy change, standing precedent + user `no-pares` directive; delivery `exception-ok`, chain strategy `stacked-to-main` (PR1 WU1 → PR2 WU2 → PR3 WU3+WU4 → PR4 WU5). (Parent lifecycle confirmation pending at final-candidate.)

## Design-deviation note (cited evidence — mechanical, no semantic change)

The design (D1 §3.2) and tasks specify imports from `drenyra-ai/routing`. The pinned published artifact `drenyra-ai@0.3.0` (vendored tgz, checksum `09df8d69...b7600`) does **not** export a `./routing` subpath: `package.json` `exports` omits it, while `dist/index.js` re-exports the complete routing module (`export * from "./routing/index.js"`). Verified:

- `import { createWorkUnit } from "drenyra-ai/routing"` → `ERR_PACKAGE_PATH_NOT_EXPORTED` under bun and `TS2307` under tsc (moduleResolution bundler).
- `import { createWorkUnit } from "drenyra-ai"` → resolves to the same published module object (`typeof createWorkUnit === "function"`).

Resolution (documented deviation): the routing surface (types + helpers) is imported from the published package root `drenyra-ai`, which is the same pinned artifact and the same module. `validateTransition` remains imported as a runtime value from `drenyra-ai/missions` exactly as designed. No local matrix, no wrapper, no duplicated type, no unpublished module is introduced.

## WU1 — Published-contract fixtures and seven-stage preflight

**Status: complete** (tasks WU1-RED, WU1-GREEN-TYPES, WU1-GREEN-PREFLIGHT, WU1-GREEN-BUDGET, WU1-TRIANGULATE, WU1-EVIDENCE checked in tasks.md)

### Focused evidence

| Item | Value |
| --- | --- |
| Focused command | `bun test __tests__/routing/preflight.test.ts` |
| Result | RED: `0 pass / 1 fail / 1 error` (module `lib/routing/preflight.js` missing, expected); GREEN: `26 pass / 0 fail / 61 expect() calls` |
| Test file | `__tests__/routing/preflight.test.ts` (26 tests) |
| Fixtures | `__tests__/routing/fixtures.ts` |
| Files changed | `lib/routing/types.ts`, `lib/routing/preflight.ts`, `__tests__/routing/preflight.test.ts`, `__tests__/routing/fixtures.ts` |

### Runtime scenario

| Scenario | Result |
| --- | --- |
| All seven stages pass on a complete request (canonical scope, GRANTED authorization, seeded `source → transformation → conclusion → action` evidence graph, explicit R0 materiality, no systems, no approval) | `ok: true`; `WorkUnit` built by `createWorkUnit` + revalidated by `validateWorkUnit`; `stage = DRAFT`; budgets normalized (research 3, correction 1, cost capped by policy max) |
| Each of the seven stages fails closed with the exact published `WorkStopReason` kind and no store write | Verified per stage: scope → `SCOPE_MISMATCH`/`AMBIGUOUS_INPUT`; permissions → `POLICY_BLOCKED`/`AMBIGUOUS_INPUT`; evidence → `MISSING_EVIDENCE`/`AMBIGUOUS_INPUT`; materiality → `AMBIGUOUS_INPUT`/`UNSUPPORTED_WORK` (no R0 default); reversibility → `AMBIGUOUS_INPUT`; systems → `EXTERNAL_SYSTEM_UNAVAILABLE`/`AMBIGUOUS_INPUT`; approval → `APPROVAL_REQUIRED` retained as stop condition |
| Helper issue projection | Malformed `evidenceAllowed` hash → `MISSING_EVIDENCE` (design D2: INVALID_HASH projects to MISSING_EVIDENCE when required valid hashes are known) |
| No store write | Evidence log bytes identical before/after a failing preflight |

### Rollback boundary (WU1)

Remove `lib/routing/types.ts`, `lib/routing/preflight.ts`, `__tests__/routing/preflight.test.ts`, `__tests__/routing/fixtures.ts`. No persisted state migration; nothing else depends on them yet (barrel/selector/executor/seam/journey are later work units).

### TDD Cycle Evidence (WU1)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WU1-RED | `__tests__/routing/preflight.test.ts` | Unit | N/A (new) | ✅ Written; `0 pass / 1 fail` (missing module) | — | — | — |
| WU1-GREEN-TYPES | `lib/routing/types.ts` | Unit | N/A (new) | ✅ via RED | ✅ 26/26 | ✅ boundary cases in same suite | ✅ clean (lint clean) |
| WU1-GREEN-PREFLIGHT | `lib/routing/preflight.ts` | Unit | N/A (new) | ✅ via RED | ✅ 26/26 | ✅ 7 stage failures + helper projection + no-write | ✅ clean |
| WU1-GREEN-BUDGET | `preflight.ts` + test | Unit | N/A (new) | ✅ via RED | ✅ 26/26 | ✅ clamp / invalid / cost-cap cases | ✅ clean |
| WU1-TRIANGULATE | same suite | Unit | N/A (new) | — | — | ✅ corrupt hash, conflicting tier, approval, unavailable system, insufficient permission, scope mismatch | ✅ clean |
| WU1-EVIDENCE | `apply-progress.md` | — | — | — | — | — | ✅ recorded |

---

## WU2 — Exhaustive route selector and budget isolation

**Status: complete** (tasks WU2-RED, WU2-GREEN, WU2-GREEN-BUDGET, WU2-BARREL, WU2-TRIANGULATE, WU2-EVIDENCE checked in tasks.md)

### Focused evidence

| Item | Value |
| --- | --- |
| Focused command | `bun test __tests__/routing/route-selector.test.ts` |
| Result | RED: `0 pass / 1 fail / 1 error` (module missing, expected); GREEN: `13 pass / 0 fail / 168 expect() calls` |
| Test file | `__tests__/routing/route-selector.test.ts` (13 tests) |
| Files changed | `lib/routing/route-selector.ts`, `lib/routing/index.ts` (barrel), supporting `lib/routing/types.ts` (Sha256Hash-typed `requiredEvidenceHashes`), `__tests__/routing/route-selector.test.ts` |

### Runtime scenario

| Scenario | Result |
| --- | --- |
| 18 normalized cells (2 risk bands × 3 evidence × 3 reversibility) | All covered and deterministic (second call `toEqual` first); no uncovered cell; six SUFFICIENT rows map exactly (direct / delegated×3 / durable×2); INSUFFICIENT → `MISSING_EVIDENCE`; AMBIGUOUS → `AMBIGUOUS_INPUT` |
| Invalid / contradictory domain | Out-of-domain tier, undefined tier, declared-vs-kernel tier conflict, out-of-domain evidence/reversibility → `AMBIGUOUS_INPUT`; no route defaults |
| Proposal purity | SUFFICIENT proposal carries exactly `{ ok, route, basis }`; basis exactly `{ kernelRiskTier, evidenceSufficiency, reversibility }`; no authorization/transition property |
| Budget no-leak | `BudgetLedger.create(unitA)` keyed to `work-a`; `assertWorkUnit(unitB)` throws; no transfer API; exhaustion returns exact dimensions (`RESEARCH_ATTEMPTS`, `CORRECTION`, `COST`, `TOKENS`, `TIME`) |

### Rollback boundary (WU2)

Remove `lib/routing/route-selector.ts`, `__tests__/routing/route-selector.test.ts`, and the WU2 barrel entry (route-selector export in `lib/routing/index.ts`). WU1 preflight/types remain independently valid.

### TDD Cycle Evidence (WU2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WU2-RED | `__tests__/routing/route-selector.test.ts` | Unit | N/A (new) | ✅ Written; `0 pass / 1 fail` (missing module) | — | — | — |
| WU2-GREEN | `lib/routing/route-selector.ts` | Unit | N/A (new) | ✅ via RED | ✅ 13/13 | ✅ 18 cells + purity | ✅ clean |
| WU2-GREEN-BUDGET | `types.ts` BudgetLedger + test | Unit | N/A (new) | ✅ via RED | ✅ 13/13 | ✅ 4 exhaustion dimensions + no-leak | ✅ clean |
| WU2-BARREL | `lib/routing/index.ts` | — | N/A (new) | ✅ typecheck | ✅ typecheck clean | ✅ exports resolve | ✅ clean |
| WU2-TRIANGULATE | same suite | Unit | N/A (new) | — | — | ✅ all six SUFFICIENT rows + invalid/contradictory domain | ✅ clean |
| WU2-EVIDENCE | `apply-progress.md` | — | — | — | — | — | ✅ recorded |

---

## WU3 — Executor adapter (completed by orchestrator corrective pass)

| Item | Result |
| --- | --- |
| `lib/routing/executor.ts` | `executeRoutingWork`: one bounded dispatch through an injected chain-pipeline port; advance ONLY via the injected `validateTransition` runtime value from `drenyra-ai/missions` (no transition table, no catch-and-approve wrapper — REQ-BOUND-001); WorkResult via `createWorkResult`/`validateWorkResult` from `drenyra-ai/routing`; zero blind UNKNOWN retry (already-UNKNOWN rejected before dispatch with a MISSION_UNKNOWN exception; port-returned UNKNOWN → typed AMBIGUOUS_INPUT stop + exception, never resubmitted); typed BUDGET_EXHAUSTED stop on exhaustion (zero port calls before dispatch / exactly one after) |
| Executor types | `BudgetLedger` (research ≤3, correction =1, cost ceiling, no-leak — no transfer API), `ExecuteRoutingWorkInput`, `RouteExecutionPortResponse`, `RouteExecutionResult`, `RoutingExecutionPorts` added to `lib/routing/types.ts`; `index.ts` exports the executor |
| Tests | `__tests__/routing/executor.test.ts` (12 tests): happy path validator-approved advance + validated WorkResult; shared assertions across direct/delegated/durable ports; validator denial → INVALID_TRANSITION, unit unchanged; budget exhaustion before + after dispatch; provenance loss fails closed; candidate provenance → ProposedCandidateRef with subjectHash + materialityBasis; UNKNOWN no-retry (both directions) |

## WU4 — Mission seam + journey (completed by orchestrator corrective pass)

| Item | Result |
| --- | --- |
| Seam | `createDurableMissionRoutingPort` in `lib/mission-commands.ts` (design D5): ONE exported adapter function calling `EdaMissionCoordinator.advance` exactly once; existing start/advance/resumeAll/recovery UNCHANGED; one-step continue preserved (RUN/WAIT/SKIP semantics intact) |
| Tests | `__tests__/routing/mission-routing-seam.test.ts` (6 tests): RUN one advance maps DRAFT→QUEUED with Core-proposed target and no stop; one invocation never loops (second call advances exactly one more step); WAIT → APPROVAL_REQUIRED stop + WAIT_REQUIRED exception, no write; authority denial → POLICY_BLOCKED before any write; UNKNOWN → AMBIGUOUS_INPUT + MISSION_UNKNOWN, no write, no loop; cross-mission work unit rejected before advance |

## WU5 — Final evidence (completed by orchestrator)

| Check | Result |
| --- | --- |
| `bun test` | **682 pass / 0 fail** across 43 files (59 new routing tests) |
| `bun run typecheck` | pass |
| `node scripts/verify-package-files.mjs` | OK (dist + content manifest + vendored 0.3.0 reconciled) |
| `bun run verify:style` | OK (95 owned files, 4 rules; trailing-whitespace fixed on seam lines) |
| `bun run verify:capability` | OK |
| Candidate identity | `compute-candidate-identity.mjs` reports "no allowlisted candidate change" — correct: the SDD-030 files are NOT in the SDD-010 PARTICIPATION_PATHS_V1 whitelist; the lock-facts identity remains the SDD-010 participation fingerprint (unchanged), and SDD-030 records its own evidence here |

**Size exception (recorded):** forecast 1,140–1,700 authored lines; carried under the orchestrator's standing size-exception precedent for verification-heavy changes (user-approved single-pass pattern + no-pares directive). Delivery: 4-PR chain stacked-to-main (PR1 types+preflight, PR2 selector, PR3 executor+seam, PR4 evidence).

**Journey test (verify CRITICAL remediated by the orchestrator):** `__tests__/routing/routing-adapter-journey.test.ts` (5 tests, REQ-EXEC-005/SC-EXEC-007) exercises the full pinned-runtime journey preflight → route → execute → validated WorkResult, plus negative controls: evidence-insufficient preflight fails closed (absent required hash → MISSING_EVIDENCE), budget exhaustion → typed BUDGET_EXHAUSTED (RESEARCH_ATTEMPTS) with zero port calls, UNKNOWN outcome never retried/auto-advanced (AMBIGUOUS_INPUT + MISSION_UNKNOWN, exactly one dispatch), and a validator denial yields INVALID_TRANSITION (the injected validator is the sole transition authority). Re-validation of the emitted WorkResult through the published `validateWorkResult(result, unit, validator)` succeeds. Final suite: **687 pass / 0 fail across 44 files**.

**Master reference:** SDD-030 slice A+B (`routing/` WorkUnit/WorkResult) delivered in drenyra-ai PRs #39/#40, released in drenyra-ai@0.3.0, coordinated 2026-08-15. Pi consumes the core surface; slice C (preflight router) remains deferred in drenyra-ai — this change implements the Pi adapter/executor side without redefining the shared surface.

**Boundary compliance:** no transition table, no invented stop kinds (AMBIGUOUS_INPUT + MISSION_UNKNOWN are published semantics), no fiscal authority, no new commands/agents, pin 0.3.0 unchanged, drenyra-ai untouched.
