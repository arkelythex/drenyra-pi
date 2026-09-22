# Proposal: Wire the Routing Adapter's Direct Modality Into a Live Command

## Intent

`lib/routing/` (preflight → Core-delegated route decision → executor with real
`BudgetLedger` enforcement) is architecturally sound and unit/contract-tested
(62 tests), but no `/drenyra:*` command ever calls
`runRoutingPreflight`/`executeRoutingWork` in production
(`exploration.md` — "Nothing in production ever calls..."). Only the
`"durable"` port has a real implementation
(`createDurableMissionRoutingPort`, `lib/mission-commands.ts:672-752`);
`"direct"` and `"delegated"` have zero real implementations, only test
stubs. This change closes that gap for one modality — `"direct"` — so the
routing pipeline becomes observable in a live command instead of only in its
own test suite.

## Scope

### In Scope
- A real, non-stub implementation of `RoutingExecutionPorts["direct"]`: an
  in-process `chain-pipeline` run, no external agent, no fiscal-authority
  reimplementation.
- Wire `runRoutingPreflight` + `executeRoutingWork` into `/drenyra:status`
  (read-only, does not touch `EdaMissionCoordinator`).
- A dedicated test for the missing-port fail-closed branch
  (`executor.ts:421-430`, `typeof port !== "function"` → `AMBIGUOUS_INPUT`),
  currently uncovered per exploration.
- A `routing-adapter` row in `capability-manifest.yaml` with an honest
  verification level (`unit-or-contract-tested`, not `validated-end-to-end`).
- A matching new row in `docs/architecture/capability-conformance-matrix.md`.

### Out of Scope
- The `"delegated"` modality / dispatch to `agents/*.md` roles — needs its
  own design decision (agent-dispatch semantics, per-agent budget model).
  Tracked as an explicit follow-up.
- Any change to `BudgetLedger`'s per-work-unit design.
- Any change to `missionHandler` / `/drenyra:mission`'s existing behavior
  (`coordinator.advance()` call path stays untouched).
- Fiscal authority, materiality, or Core route-decision logic — Shell delegates
  the route decision to the pinned `drenyra-ai` Core `route()` (same
  `REQ-BOUND-001` constraint the archived `pi-sdd-030-routing-adapter`
  change enforced).
- Claiming SDD-030 completion — Shell serves/scaffolds SDD-030, never owns it.

## Capabilities

### New Capabilities
- `routing-adapter`: direct-modality production wiring for
  preflight → Core route decision → executor, exposed through
  `/drenyra:status`; excludes delegated/durable modality claims.

### Modified Capabilities
None.

## Approach

Exploration Approach 3 (recommended): build a real `direct` port
(`chain-pipeline` in-process run) and inject it, alongside the preflight
call, into `/drenyra:status`'s existing read-only handler
(`extensions/register.ts:253-284`). This demonstrates 2-of-3 modalities live
(`durable` already has production wiring via `lib/mission-commands.ts`;
`direct` gets a first real port) without touching the live, tested
`missionHandler` path.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `lib/mission-commands.ts` (or a sibling file) | New | `createDirectRoutingPort`-equivalent: real in-process chain-pipeline port |
| `extensions/register.ts` (`statusHandler`) | Modified | Additive call to `runRoutingPreflight` + `executeRoutingWork` |
| `__tests__/routing/executor.test.ts` | New test | Missing-port fail-closed branch coverage |
| `capability-manifest.yaml` | New row | `routing-adapter`, `unit-or-contract-tested` |
| `docs/architecture/capability-conformance-matrix.md` | New row | Matches manifest, states 2-of-3 modalities live |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Acceptance bar reads as "all three modalities" | Med | Explicit scope note: 2-of-3 live, `delegated` tracked as named follow-up |
| `/drenyra:status` output/behavior drift | Low | Wiring is additive only; new fields, no removal of existing status output |
| Diff exceeds 400-line review budget | Med | Flagged for `sdd-tasks` to slice into chained/stacked PRs if needed |

## Rollback Plan

The wiring is additive: `/drenyra:status` can revert to not calling
`lib/routing/` at all (drop the preflight/executor call, keep the prior
handler body) since nothing else in the repo depends on this wiring yet. No
data migration, no schema change, no mission-state impact.

## Dependencies

None external. Depends on the already-merged, already-tested `lib/routing/`
module from the archived `pi-sdd-030-routing-adapter` change.

## Success Criteria

- [ ] A real `direct` port runs an in-process chain-pipeline task through
      `/drenyra:status`, observable end to end.
- [ ] The missing-port fail-closed branch (`executor.ts:421-430`) has a
      passing dedicated test.
- [ ] `capability-manifest.yaml` and the conformance matrix both carry an
      honest `routing-adapter` row (`unit-or-contract-tested`).
- [ ] `missionHandler`/`/drenyra:mission` behavior is unchanged (existing
      tests pass unmodified).
- [ ] `delegated` modality is explicitly named as a tracked follow-up, not
      silently dropped.
