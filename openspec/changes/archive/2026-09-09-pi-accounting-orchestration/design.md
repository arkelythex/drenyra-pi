# Design: Wire the Routing Adapter's Direct Modality Into a Live Command

## Technical Approach

Mirror the one existing production port (`createDurableMissionRoutingPort`,
`lib/mission-commands.ts:672-752`) with a new `direct` port that dispatches
through `runChainStep` (`lib/chain-pipeline.ts:934`) instead of
`EdaMissionCoordinator.advance()`. Wire `runRoutingPreflight` unconditionally
into `statusHandler` as a genuinely write-free additive block; gate the
write-bearing `executeRoutingWork` dispatch behind an explicit opt-in flag.
Fold the new manifest evidence into the existing `drenyra-commands` row —
`MASTER_CAPABILITIES` is a closed, validator-enforced 10-name list
(`scripts/verify-capability-manifest.mjs:35-46`), so a new `routing-adapter`
top-level key is a schema change the proposal put out of scope.

## Architecture Decisions

### Decision: `executeRoutingWork` is NOT unconditional in `/drenyra:status`

**Finding**: every reachable `runChainStep` path writes. `phaseOnlyUpdate`
(`chain-pipeline.ts:579-607`) and every `runtime.apply` call persist a
mission-store write — RUN, SKIP (line 751-756, "no-op" in its own comment is
inaccurate: it still calls `phaseOnlyUpdate`), and first-run mission creation
(`startChainMissionInternal`) all write. The only zero-write path is a mission
already at rest with `derivePreparedStep` returning `null`
(lines 1013-1027) — too narrow to guarantee for a general demonstration.
Unconditionally calling `executeRoutingWork` from every `/drenyra:status`
invocation would turn a command with zero writes today into one with a write
on every call — not "additive," a real behavior change the proposal's own
risk table understates.
**Choice**: `runRoutingPreflight` (documented "writes nothing",
`preflight.ts:627`) runs unconditionally and is always additive/safe. The
`direct` port dispatch (`executeRoutingWork`) runs only when the operator
passes an explicit flag, e.g. `/drenyra:status --demonstrate-routing`, using
`chains/verify.ts`'s `verifyChain` (`readOnly: true`, `verify.ts:696-703` —
the only chain marked read-only, though it still persists step-completion
state like any chain).
**Alternatives considered**: always-on write (rejected — behavior drift);
inventing a genuinely no-op chain (rejected — not a real chain, would be a
"stub dressed up as a port call," explicitly disallowed).
**Rationale**: keeps default `/drenyra:status` byte-for-byte read-only;
still makes `executeRoutingWork` genuinely reachable from a live command.

### Decision: `direct` port implementation shape

**Choice**: new `lib/routing/direct-port.ts`,
`createChainPipelineRoutingPort(chain: ChainDefinition): RoutingExecutionPorts["direct"]`.
Calls `runChainStep(chain, input.chainRun)`, maps `ChainRunResult` →
`RouteExecutionPortResponse` (missionBefore/After from before-call snapshot
vs. `result.mission`; `stop` from `result.blocked`/`waitReason`;
`consumption` synthesized as `{elapsedMs: 0, tokens: 0, costIncurredCents: 0n,
researchAttempts: 1, correctionAttempts: 0}` since chains don't report
token/cost consumption — same pattern `createDurableMissionRoutingPort` uses
for its `elapsedMs: 0, tokens: 0`).
**Alternatives considered**: reuse `createDurableMissionRoutingPort`'s
`AdvanceEdaMissionResult` mapping (rejected — wrong input shape, chains don't
use `EdaMissionCoordinator`).
**Rationale**: same seam pattern (design D5 §7 precedent), same file family.

### Decision: `authorization` sourcing — real lookup, DENIED sentinel on absence

**Finding**: `stagePermissions` (`preflight.ts:210-250`) requires a concrete
`AuthorizationRecord`; none is fabricated as GRANTED (REQ-BOUND-001). QUERY
is the correct `actionFamily` (`requiredModeFor(QUERY) === ASK`,
`authority-gates.ts:60`), and only `boundAuthorizationFor`
(`chain-pipeline.ts:457-498`, called for the intake/bind-scope phase family)
ever persists a QUERY record — `EdaMissionCoordinator` never calls it
(confirmed: zero references in `mission-commands.ts`). A mission touched only
via `/drenyra:mission` will have no QUERY record on disk.
**Choice**: `AuthorityStore.findBoundAuthorization({missionId, scopeHash,
actionFamily: "QUERY", actorId})`; if found, pass it as-is (a real prior
grant). If absent, construct `{..., decision: "DENIED", issuedAt: now}` — not
a self-issued grant, an honest "no bound authorization" marker that correctly
routes `stagePermissions` to `POLICY_BLOCKED`.
**Rationale**: lets the preflight legitimately demonstrate BOTH the pass path
(mission previously touched by a chain command) and the fail-closed path
(fresh mission) without inventing authority.

### Decision: manifest/matrix fold into `drenyra-commands`, no new key

**Finding**: `MASTER_CAPABILITIES` rejects both `unknown capability` and
`missing capability` (validator lines 188-197) — a `routing-adapter` key
fails `bun run verify:capability` immediately. This is the same closed-list
conflict SDD #1's design (`archive/2026-09-08-pi-capability-conformance/design.md`
"Decision: The 5 new files are evidence, not new capability keys") already
resolved by folding into an existing row.
**Choice**: add `lib/routing/direct-port.ts` (+ existing `lib/routing/{types,
executor,preflight}.ts` if not already cited) to `drenyra-commands.evidence.
sources`, the new tests to `.tests`, and a `verificationLevel` line in
`.evidence.note` per SDD #1's convention: `verificationLevel:
lib/routing/direct-port.ts = unit-or-contract-tested (wired into
/drenyra:status --demonstrate-routing; not validated-end-to-end)`. Update the
matching `drenyra-commands` row in
`docs/architecture/capability-conformance-matrix.md`, not a new row.
**Rationale**: zero validator changes; the proposal's "New row" wording in
Affected Areas is corrected here to "evidence addition," a scope-conflict
flag for `sdd-tasks`.

## Data Flow

    /drenyra:status
        │
        ├─ scopeGuard.evaluate() ─ findActiveEdaMission() ─ loadEvidenceStatus()  (unchanged)
        │
        ├─ [always] build PreflightRequest (real binding+mission+QUERY auth)
        │       └─ runRoutingPreflight ──▶ routing.preflight (additive field)
        │
        └─ [--demonstrate-routing only]
                └─ executeRoutingWork(route, ports={direct: chainPipelinePort, ...stubs})
                        └─ direct port ──▶ runChainStep(verifyChain, chainRun)
                                └─ routing.execution (additive field)

## File Changes

| File | Action | Est. lines |
|------|--------|------------|
| `lib/routing/direct-port.ts` | Create | ~100 |
| `extensions/register.ts` (`statusHandler`) | Modify | ~90 |
| `__tests__/routing/executor.test.ts` | Modify (missing-port test) | ~30 |
| `__tests__/routing/direct-port.test.ts` | Create | ~110 |
| `__tests__/extension.test.ts` | Modify (additive `routing` field assertion) | ~20 |
| `capability-manifest.yaml` | Modify (`drenyra-commands` evidence) | ~8 |
| `docs/architecture/capability-conformance-matrix.md` | Modify (row update) | ~3 |

**Total ≈ 361 lines** — under the 400-line budget but tight; `sdd-tasks`
should still slice `direct-port.ts`+tests as PR1 and the `register.ts`
wiring+manifest+matrix as PR2, since the `PreflightRequest` construction in
`statusHandler` (~20 required fields) is the most likely line-count
underestimate.

## Interfaces / Contracts

```typescript
// lib/routing/direct-port.ts
export function createChainPipelineRoutingPort(
  chain: ChainDefinition<unknown, unknown>,
): RoutingExecutionPorts["direct"];
```

No changes to `lib/routing/types.ts` or `executor.ts` signatures.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `createChainPipelineRoutingPort` maps `ChainRunResult` → response correctly (success, blocked, wait) | `__tests__/routing/direct-port.test.ts`, style of `mission-routing-seam.test.ts` |
| Unit | Missing-port fail-closed | New case in `executor.test.ts`: `ports = { direct: undefined as unknown as RoutingExecutionPorts["direct"], delegated: async()=>..., durable: async()=>... }`, `route = makeCoreRoute("direct-analysis")`; assert `reason.kind === "AMBIGUOUS_INPUT"`, `reason.fields` contains `"ports.direct"`, `portCalls === 0` |
| Integration | `statusHandler` surfaces `routing.preflight` additively, existing fields unchanged | New case in `__tests__/extension.test.ts` |
| Integration | `--demonstrate-routing` fail-closed on fresh mission (no QUERY auth) | New case: asserts `POLICY_BLOCKED`, no mission-store write beyond the one the flag explicitly warns about |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification.
Routing/process-integration is applicable at one row: **command wiring adds a
conditional write path to a previously read-only command.** Expected safe
behavior: default `/drenyra:status` (no flag) performs zero writes, byte-
identical to today. Expected failure behavior: `--demonstrate-routing` on a
mission with no bound QUERY authorization fails closed at `stagePermissions`
with `POLICY_BLOCKED`, never silently grants. RED test: assert the no-flag
path makes zero calls into `runChainStep`/`AuthorityStore`/mission-store
writes (spy or fixture-count assertion).

## Migration / Rollout

No migration. Additive-only: `/drenyra:status` output gains an optional
`routing` field; absent flag, absent field content changes. Rollback = revert
the `statusHandler` diff; `direct-port.ts` and its tests are inert if unused
elsewhere.

## Open Questions

- [ ] Exact flag name (`--demonstrate-routing` vs. a subcommand) — product-tone decision for `sdd-tasks`.
- [ ] Whether `verifyChain`'s `ANALYZE`-mode requirement (`verify.ts:699`) should be checked before offering the flag in `statusHandler`, or left to fail closed inside `runChainStep`'s own mode gate (leaning: let it fail closed, one fewer duplicated check).
