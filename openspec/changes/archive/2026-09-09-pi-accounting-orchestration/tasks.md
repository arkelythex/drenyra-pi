# Tasks: Wire the Routing Adapter's Direct Modality Into a Live Command

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~361 (design estimate; tight against budget) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `direct` port (`createChainPipelineRoutingPort`) + its unit tests + missing-port RED test | PR 1 | `bun test __tests__/routing/direct-port.test.ts __tests__/routing/executor.test.ts` | N/A — pure unit/contract test, no live command surface touched | Delete `lib/routing/direct-port.ts` and its test file; revert the `executor.test.ts` addition; zero callers elsewhere |
| 2 | `statusHandler` opt-in wiring + manifest/matrix evidence fold | PR 2 | `bun test __tests__/extension.test.ts` | `/drenyra:status` (no flag) and `/drenyra:status route` against a bound scope | Revert the `statusHandler` diff in `extensions/register.ts`; `direct-port.ts` stays inert and unused (PR1 is independently valid) |

## Opt-in signal decision

House convention (`/drenyra:receipt verify <id>`, `/drenyra:scope set ...`) uses a
positional subcommand word as the first `args` token, never a `--flag`
(confirmed: zero `--` occurrences in `extensions/register.ts`). Chosen token:
**`route`** — invoked as `/drenyra:status route`. `statusHandler` parses
`_args.trim() === "route"` to gate `executeRoutingWork`; any other value
(including empty) takes the unconditional preflight-only path.

## Phase 1: PR 1 — `direct` port + missing-port fail-closed test

- [x] 1.1 Create `lib/routing/direct-port.ts` exporting
  `createChainPipelineRoutingPort(chain: ChainDefinition<unknown, unknown>): RoutingExecutionPorts["direct"]`
  per design's exact shape: calls `runChainStep(chain, input.chainRun)`,
  maps `ChainRunResult` → `RouteExecutionPortResponse` (`missionBefore` =
  pre-call snapshot, `missionAfter` = `result.mission`, `stop` derived from
  `result.blocked`/`waitReason`, `consumption` synthesized as
  `{elapsedMs: 0, tokens: 0, costIncurredCents: 0n, researchAttempts: 1,
  correctionAttempts: 0}` — same pattern as
  `createDurableMissionRoutingPort`, `lib/mission-commands.ts:672-752`).
- [x] 1.2 Create `__tests__/routing/direct-port.test.ts` (style of
  `__tests__/routing/mission-routing-seam.test.ts`): cover success mapping,
  blocked/wait-reason mapping, and UNKNOWN-outcome mapping from
  `ChainRunResult` into `RouteExecutionPortResponse`.
- [x] 1.3 Add the missing-port fail-closed case to
  `__tests__/routing/executor.test.ts` per design's exact test shape:
  `ports = { direct: undefined, delegated: async()=>..., durable: async()=>... }`,
  `route = makeCoreRoute("direct-analysis")`; assert
  `reason.kind === "AMBIGUOUS_INPUT"`, `reason.fields` contains
  `"ports.direct"`, and `portCalls === 0` (mirrors the existing
  `"an unknown route kind fails closed..."` case, `executor.test.ts:275-295`).
- [x] 1.4 RED test (Threat Matrix): in `__tests__/routing/direct-port.test.ts`
  or `executor.test.ts`, assert that with no opt-in signal supplied,
  `executeRoutingWork`/`runChainStep`/`AuthorityStore` are never called and
  zero mission-store writes occur (spy or call-count fixture assertion) —
  proves the fail-closed default path before any command wiring exists.
- [x] 1.5 Run `bun test __tests__/routing/direct-port.test.ts __tests__/routing/executor.test.ts` and confirm all pass, zero regressions in the rest of `__tests__/routing/`.

## Phase 2: PR 2 — `statusHandler` wiring + evidence fold

- [x] 2.1 In `extensions/register.ts` `statusHandler` (line 253), call
  `runRoutingPreflight` unconditionally with a real `PreflightRequest` built
  from `outcome.binding`, `mission`, and evidence already computed in this
  handler; surface the result as an additive `routing.preflight` field on
  `output.machine` — write-free, always runs.
- [x] 2.2 Source `authorization` for the `PreflightRequest` via
  `AuthorityStore.findBoundAuthorization({missionId, scopeHash,
  actionFamily: "QUERY", actorId})`; if absent, construct
  `{..., decision: "DENIED", issuedAt: new Date().toISOString()}` — never a
  self-issued `GRANTED` sentinel (per design's exact decision,
  `lib/routing/preflight.ts:210-250` `stagePermissions` contract).
- [x] 2.3 Gate `executeRoutingWork` dispatch behind `_args.trim() === "route"`
  (Phase 1's chosen opt-in token, `/drenyra:status route`); when absent,
  `executeRoutingWork` is never called and the invocation performs zero
  mission-store writes, byte-identical to current behavior.
- [x] 2.4 When the opt-in token is present, build `ports = { direct:
  createChainPipelineRoutingPort(verifyChain), delegated: <stub returning
  AMBIGUOUS_INPUT/not-implemented>, durable: <stub returning
  AMBIGUOUS_INPUT/not-implemented> }` and call `executeRoutingWork(route,
  ports, ...)`; surface the result as an additive `routing.execution` field
  on `output.machine`.
- [x] 2.5 Add assertions to `__tests__/extension.test.ts`: (a) default
  `/drenyra:status` invocation surfaces `routing.preflight` additively with
  all pre-existing fields unchanged and zero mission-store writes; (b)
  `/drenyra:status route` on a fresh mission (no bound QUERY authorization)
  fails closed at `stagePermissions` with `POLICY_BLOCKED`, never silently
  grants.
- [x] 2.6 Confirm `missionHandler` (`extensions/register.ts:657-698`) and its
  `coordinator.advance()` call path are untouched; run the full existing
  `/drenyra:mission` test suite unmodified and verify every pre-existing
  test still passes byte-for-byte.
- [x] 2.7 Update `capability-manifest.yaml`: fold `lib/routing/direct-port.ts`
  (plus `lib/routing/{types,executor,preflight}.ts` if not already cited)
  into the EXISTING `drenyra-commands` row's `evidence.sources`; add
  `__tests__/routing/direct-port.test.ts` and the updated
  `__tests__/extension.test.ts`/`__tests__/routing/executor.test.ts` to
  `evidence.tests`; append an `evidence.note` line:
  `verificationLevel: lib/routing/direct-port.ts = unit-or-contract-tested
  (wired into /drenyra:status route; not validated-end-to-end)`. Do NOT add
  a new top-level capability key; do NOT modify `MASTER_CAPABILITIES` or the
  `state` enum.
- [x] 2.8 In `capability-manifest.yaml`'s `drenyra-commands` row (or its
  `evidence.note`), explicitly name the `delegated` modality as an
  out-of-scope, tracked follow-up — not silently omitted.
- [x] 2.9 Update the matching `drenyra-commands` row in
  `docs/architecture/capability-conformance-matrix.md` to reflect the new
  evidence and the same explicit `delegated`-modality follow-up note; do NOT
  add a new row.
- [x] 2.10 Run `bun test __tests__/extension.test.ts __tests__/extension-mission-commands.test.ts` and `bun run verify:capability` (or the project's manifest validator) to confirm the closed `MASTER_CAPABILITIES` list still validates.

## Key Learnings

1. The codebase's command-argument convention uses positional subcommand words, never `--flag` syntax, confirmed by zero `--` matches across `extensions/register.ts`.
2. The only production `RoutingExecutionPorts` implementation before this change is `createDurableMissionRoutingPort` in `lib/mission-commands.ts`, giving the new `direct` port an exact mapping precedent to follow.
3. `MASTER_CAPABILITIES` is a closed, validator-enforced list, so new capability evidence must fold into the existing `drenyra-commands` row rather than adding a top-level key.
4. `AuthorityStore.findBoundAuthorization` never fabricates a `GRANTED` record, so a fresh mission with no prior QUERY authorization must construct an explicit `DENIED` sentinel to keep `stagePermissions` fail-closed.
5. Every reachable `runChainStep` path performs a mission-store write, so `executeRoutingWork` cannot run unconditionally without turning a zero-write command into one with a write on every call.
