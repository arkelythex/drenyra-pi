# ARCHIVE REPORT — pi-sdd-030-routing-adapter

**Change**: `pi-sdd-030-routing-adapter` — durable mission routing adapter for the pinned runtime
**Repo**: `drenyra-pi` (Bun + TS ESM, bun test, Pi extension package, pinned `drenyra-ai@0.3.0` vendored)
**Archived at**: `openspec/changes/archive/2026-08-15-pi-sdd-030-routing-adapter/`
**Archive date**: 2026-08-15
**Artifact store**: openspec (file-based; engram best-effort)
**Status**: **COMPLETED — CLOSED** (archive PASS)

---

## 1. Executive summary

This change delivered Drenyra Pi's durable mission routing adapter: a Pi-owned
`preflight → route-select → execute` pipeline that runs the shared
`WorkUnit`/`WorkResult` contract from the pinned `drenyra-ai@0.3.0` runtime with
**no local transition authority**. A 7-stage preflight, an exhaustive 18-cell
route selector, a bounded executor whose transition eligibility is decided
exclusively by the validator **injected from `drenyra-ai/missions`**, and a
one-step-continuing seam in `lib/mission-commands.ts` compose the durable route.
Independent verification found one CRITICAL — the spec-required end-to-end
journey test was missing — which the orchestrator remediated with
`__tests__/routing/routing-adapter-journey.test.ts` (5 tests). Final state is
**687 pass / 0 fail** with all gates green. The change is closed at verify PASS
(21/21 requirements, 20 original PASS + the 1 CRITICAL remediated).

## 2. Final-state facts (authoritative at close)

- **Verify + remediation:** independent verify found **1 CRITICAL** (missing
  journey test `__tests__/routing/routing-adapter-journey.test.ts`,
  REQ-EXEC-005 / SC-EXEC-007). The orchestrator remediated it: 5 tests
  exercising `preflight → route → execute → validated WorkResult` against the
  pinned runtime, with negative controls (MISSING_EVIDENCE preflight fail-closed,
  typed BUDGET_EXHAUSTED with zero port calls, UNKNOWN never retried /
  auto-advanced, validator denial → INVALID_TRANSITION proving the injected
  validator is the sole transition authority). Remediation note appended to
  `verify-report.md`.
- **Final suite:** `bun test` → **687 pass / 0 fail across 44 files**;
  `bun run typecheck`, `node scripts/verify-package-files.mjs` (0.3.0 reconciled),
  `bun run verify:style`, `bun run verify:capability` all green.
- **Deliverables:**
  - `lib/routing/{types,preflight,route-selector,executor,index}.ts` — Pi-owned
    adapter: 7-stage preflight, 18-cell selector, bounded executor with
    **injected `validateTransition`** (no transition table, no catch-and-approve).
  - `createDurableMissionRoutingPort` seam in `lib/mission-commands.ts` — one
    advance per invocation, existing lifecycle unchanged.
  - `__tests__/routing/{preflight,route-selector,executor,mission-routing-seam,
    routing-adapter-journey}.test.ts` + `fixtures.ts` — **62 tests total**
    (26 preflight + 13 selector + 13 executor + 6 seam + 5 journey + 1 extension
    seam regression).
- **Size exception recorded:** forecast 1,140–1,700 authored lines; carried under
  the orchestrator's standing verification-heavy size exception (user `no-pares`
  directive); delivery as a chained PR set stacked-to-main (orchestrator-owned).

## 3. Authority-invariant proof summary

1. **Injected validator is the only transition authority.** `executor.ts` imports
   `validateTransition` from `drenyra-ai/missions` as a runtime value
   (constructor-injectable) and passes it to `advanceWorkUnit`, `createWorkResult`,
   `validateWorkResult`. No local transition table; no catch-and-approve wrapper.
   The single locally named pair (`canonicalEntryStage`, DRAFT→QUEUED) mirrors the
   engine's `genericIntentHandler` entry edge and is still eligibility-gated by the
   injected validator; a rejected pair produces no result.
2. **No duplicated contract types.** `WorkUnit`, `WorkResult`, `WorkStopReason`
   imported from the published `drenyra-ai` (root export; the `./routing` subpath is
   not exported — deviation documented and verified). `lib/routing/types.ts` defines
   only Pi-owned adapter shapes.
3. **UNKNOWN is honest.** No invented stop kind (grep confirms no
   `kind: "UNKNOWN"`); `AMBIGUOUS_INPUT { fields: ["mission.status"] }` +
   `MISSION_UNKNOWN` exception (published semantics) in both directions;
   already-UNKNOWN rejected before dispatch; no blind retry.
4. **Budgets bounded, per-unit, no leak.** research ≤3 / correction =1 (clamped),
   cost ceiling = min(requested, policy max) in BigInt cents;
   `BudgetLedger` keyed to one `WorkUnit.id`, cross-unit throws, **no transfer API**.
5. **Materiality kernel-delegated.** `preflight.ts` uses `deriveRequiredMateriality`
   (authority-gates.ts delegates to kernel `deriveMateriality`); no Pi-local tier
   thresholds, no R0 default.
6. **Master reference:** drenyra-ai SDD-030 slice A+B (`routing/` WorkUnit/
   WorkResult) delivered in drenyra-ai PRs #39/#40, released `drenyra-ai@0.3.0`,
   coordinated 2026-08-15.

## 4. Delivered artifacts (moved to archive, unchanged)

- `proposal.md` — decision, intent, non-goals, first-slice scope
- `design.md` — D4 transition authority, D6 journey mandate (§8.1), D7 scope whitelist
- `tasks.md` — 27 implementation tasks checked `[x]`; only 3 parent-owned delivery
  tasks remain unchecked (see §8)
- `apply-progress.md` — TDD cycle evidence + apply record (counts corrected per
  remediation W2)
- `verify-report.md` — PARTIAL→remediated; CRITICAL note appended; final PASS 21/21
- `specs/routing-adapter/spec.md` + `specs/README.md`

## 5. Spec sync disposition

- **No canonical sync performed** (no `sync-report.md`; parent explicitly directed a
  filesystem-only move preserving all files incl. `specs/`). Domain `routing-adapter`
  has **no counterpart** under `openspec/specs/` — it is a **new domain** and the
  parent orchestrator decides canonical promotion separately. No
  ADDED/MODIFIED/REMOVED canonical requirement merge applies; no destructive merge
  guard triggered.
- **No same-domain active change** under `openspec/changes/*/specs/routing-adapter/`
  was detected at archive time (the only match is this change's own specs dir).

## 6. Requirements disposition (final PASS 21/21)

20 original requirements PASS unchanged from verify; the 1 previously-failing
requirement closed by remediation:

| Requirement | Verdict | Closure |
| --- | --- | --- |
| REQ-EXEC-005 — strict-TDD suite + journey + negative controls | ✅ PASS (remediated) | Journey test added (5 tests) covering SC-EXEC-007; negative controls (SC-EXEC-008) already independently covered and passing |
| All other REQ-PRE-001..006, REQ-ROUTE-001..003, REQ-EXEC-001..004, REQ-INTEG-001..003, REQ-BOUND-001..004 | ✅ PASS | Unchanged from independent verify (no regressions introduced by remediation) |

## 7. Non-goals confirmed

- **No reimplementation of Core behavior** (REQ-BOUND-001): no local transition
  matrix, no catch-and-approve, no materiality thresholds/gate verdicts/approvals.
- **No new commands, agents, or operator workflows** (REQ-BOUND-002): `git status`
  whitelist-only.
- **Frozen contracts and pin untouched** (REQ-BOUND-003): `package.json` unmodified
  (`file:./vendored/drenyra-ai-0.3.0.tgz`); `drenyra-ai` consumed, never edited.
- **No blind retries, no unbounded loops** (REQ-BOUND-004).
- **drenyra-ai untouched**; **no commit/PR created by apply** (HEAD = `2e480ea`,
  all change files uncommitted working-tree/untracked).

## 8. Known non-blocking items / remaining scope

- **3 parent-owned delivery actions** remain unchecked (`sdd-owner: parent`) in
  `tasks.md` — these are lifecycle actions owned by the orchestrator, not
  implementation tasks, and do not block archive: bounded review across PR1–PR4
  after candidate identity frozen; size-exception confirmation checkbox (substance
  already recorded); opening the chained PRs (PR1 WU1 → PR2 WU2 → PR3 WU3+WU4 →
  PR4 WU5) in stacked-to-main order with independent rollback boundaries.
- W2/S1/S2 observations from verify were addressed/recorded by the orchestrator
  remediation (test counts corrected; `canonicalEntryStage` deviation documented).

## 9. Rollback notes

The change is **purely additive** (new `lib/routing/*`, new `__tests__/routing/*`,
new `lib/mission-commands.ts` seam helper + import additions) with **no existing
behavior removed**. Full rollback: delete `lib/routing/`, the routing tests + fixtures,
and revert the `lib/mission-commands.ts` additions (start/advance/resumeAll/recovery
bodies unchanged per the verify diff check). The seam is one-step-continuing and
fails closed, so reversing it restores the prior durable-mission behavior with no
behavioral residual. Delivery/rollback of the code artifacts proceeds via the
orchestrator's 4-PR chain, each PR carrying an independent rollback boundary.

## 10. Archive move record

- **Source**: `openspec/changes/pi-sdd-030-routing-adapter/`
- **Destination**: `openspec/changes/archive/2026-08-15-pi-sdd-030-routing-adapter/`
- **Operation**: `mkdir -p` + `mv` of the whole directory (all files incl. `specs/`).
- **Move verified**: all files present at destination, old root gone.
- **Out of scope / untouched**: implementation files (`lib/routing/*`,
  `lib/mission-commands.ts`), `__tests__/routing/*`, the `drenyra-ai` repo, canonical
  `openspec/specs/` (new-domain promotion left to the orchestrator), and no commit/PR
  created.

## 11. Structured status / actionContext findings

- Artifact store mode: openspec (file-based).
- No archive blockers: verify report present and passing (CRITICAL remediated);
  all implementation tasks checked (no unchecked implementation `- [ ]`; the 3
  remaining unchecked lines are parent-owned delivery actions); no destructive
  canonical merge; allowed edit roots respected (all writes under
  `openspec/changes/`).
