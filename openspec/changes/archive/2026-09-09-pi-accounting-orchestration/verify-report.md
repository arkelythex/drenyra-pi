```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:6ee1cba320537a6c2a7079c8914d8c08675dccf751bf6ed528149ebb73e381af
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 8/8
test_command: "bun run test"
test_exit_code: 0
test_output_hash: sha256:c4a5f702b21a4c7e7861357b12e85103f0050eda18ad10acdea9621fca2f2a49
build_command: "bun run build"
build_exit_code: 0
build_output_hash: sha256:627d23ef6f9b2d3ee904fad69af3c60a8fac8899a4657fbfd54343ce9cfa4829
```

# Verify Report: pi-accounting-orchestration

## Verdict: PASS WITH WARNINGS

0 CRITICAL, 3 WARNING, 1 SUGGESTION. All 5 requirements and all 8 scenarios in
`specs/routing-adapter/spec.md` independently confirmed against live code and
a live test run. No blocking issues found; the two disclosed apply-progress
findings were independently re-derived and confirmed honest, not silently
wrong.

## Independent full-suite re-verification (run fresh in this session)

| Check | Command | Result |
|---|---|---|
| Full test suite | `bun run test` | **48 files / 738 tests passed**, 0 failed |
| Type check | `bun run typecheck` | Clean, zero errors |
| Capability manifest | `bun run verify:capability` | `verify-capability-manifest: OK` |
| Style | `bun run verify:style` | `verify-style: OK (diff-scoped · 104 owned files · 4 rules)` |
| Build | `bun run build` | `build: done`, exit 0 |
| `__tests__/routing/` (PR1 scope) | `bun run test __tests__/routing/` | 5 files / 61 tests passed |
| `__tests__/routing/direct-port.test.ts` + `executor.test.ts` | `bun run test __tests__/routing/direct-port.test.ts __tests__/routing/executor.test.ts` | 2 files / 20 tests passed |
| `__tests__/extension.test.ts` | `bun run test __tests__/extension.test.ts` | 1 file / 24 tests passed |
| `__tests__/extension-mission-commands.test.ts` | `bun run test __tests__/extension-mission-commands.test.ts` | 1 file / 31 tests passed |

The orchestrator's claim of "48 files / 738 tests, all passing" is confirmed
still true right now, with the `docs/architecture/program-lock-facts.json`
drift fix holding (`lock-facts.test.ts` passes cleanly in the full run, no
exclusion needed — unlike apply-progress's PR1/PR2-time reports, which had to
exclude it).

## Requirement-by-requirement verdicts

### REQ-ROUTE-001 — Live `direct` port wiring, unconditional preflight, opt-in execution: **PASS**

Read `extensions/register.ts` `statusHandler` (lines 392–480) directly (not
from memory of apply-progress's description). Confirmed:
- `runRoutingPreflight` runs whenever `outcome.binding !== undefined && mission !== undefined` — the same precondition the pre-existing `evidence` field already uses (line 426) — with **no** dependency on the `route` opt-in token.
- `executeRoutingWork` is gated strictly behind `if (args.trim() === "route")` (line 434) — genuinely conditional, zero other gates.
- Ran the RED-turned-GREEN test proving the no-flag path performs zero mission-store writes: `__tests__/extension.test.ts:799` ("default `/drenyra:status` surfaces `routing.preflight` additively... and performs zero mission-store writes (SC-ROUTE-008)") reads the mission snapshot file's exact bytes and `mtimeMs` before and after a no-token invocation and asserts both unchanged. **Ran it directly — passed** (part of the 24/24 `extension.test.ts` run above).
- Also ran the opt-in path test (`__tests__/extension.test.ts:839`, `/drenyra:status route`) and the PR1 "opt-in proof" test (`__tests__/routing/direct-port.test.ts:329`, asserting `calls === 0` before invocation and `calls === 1` after, via a real counting wrapper around the real port, not a mock) — both passed.

**WARNING** (not blocking): the spec's normative sentence — "`runRoutingPreflight` MUST run unconditionally on every `/drenyra:status` invocation" — is imprecise when read without its own scenario's `GIVEN` clause. `PreflightRequest` structurally requires a `MissionSnapshot` (see `lib/routing/types.ts`), so preflight genuinely cannot run on an invocation with no active mission or unbound scope — it is unconditional only relative to the opt-in flag, not to mission/binding existence. Both the spec's own SC-ROUTE-008 scenario and design.md's data-flow diagram implicitly assume a bound scope + active mission as the baseline, and the implementation is consistent with that narrower reading. This is a documentation-precision gap, not a behavioral defect — recommend `sdd-archive` note the qualification, or a follow-up spec wording tweak. Not CRITICAL because behavior fails closed honestly (the `routing` field is simply absent, never fabricated) and mirrors the pre-existing `evidence` field's identical conditioning.

### REQ-ROUTE-002 — Fail-closed missing-port guard: **PASS**

Read `lib/routing/executor.ts:422–427` directly: `if (typeof port !== "function")` returns `{ ok: false, reason: { kind: "AMBIGUOUS_INPUT", fields: [\`ports.${routePort}\`] }, portCalls: 0 }` before any dispatch — genuinely fail-closed, no port call. Read and ran the new test case `__tests__/routing/executor.test.ts:298` ("missing port: a route resolved to \"direct\" with no direct port fails closed..."): constructs `ports = { direct: undefined as unknown as ..., delegated: async()=>..., durable: async()=>... }`, asserts `reason.kind === "AMBIGUOUS_INPUT"`, `reason.fields` contains `"ports.direct"`, `portCalls === 0`. **Ran it directly — passed.** The pre-existing "unknown route kind" sibling case (line 275) and `SC-ROUTE-004` "present port dispatches normally" pre-existing tests also still pass, confirming the guard doesn't regress the happy path.

### REQ-ROUTE-003 — `/drenyra:mission` untouched: **PASS**

Ran the full pre-existing `/drenyra:mission` test suite fresh: `__tests__/extension-mission-commands.test.ts` → **31/31 passed**, unmodified file (not in `git status` as `M`). Independently ran `git diff extensions/register.ts | grep '^@@'`: five hunks, all confined to old-file line ranges 17–287 (imports, new helper functions, `statusHandler` body). `missionHandler` starts at line 853 in the current file (well past any hunk's end range) and its `coordinator.advance()` call is inside that untouched region. Confirmed independently — not just trusting apply-progress's own hunk-range claim.

### REQ-ROUTE-004 — Honest capability manifest evidence, folded into `drenyra-commands`: **PASS**

Ran `bun run verify:capability` fresh → `verify-capability-manifest: OK`. Read `capability-manifest.yaml`'s actual diff (`git diff capability-manifest.yaml`): the `drenyra-commands` row's `evidence.sources`/`evidence.tests` gained the new routing-adapter files, and a new `evidence.note` field was added reading `"verificationLevel: lib/routing/direct-port.ts = unit-or-contract-tested (wired into /drenyra:status route; not validated-end-to-end). ..."` — matches the required convention exactly, explicitly says `unit-or-contract-tested` (not `validated-end-to-end`). Listed all top-level keys in the file (`grep '"[a-z-]*": {$'`) — no new `routing-adapter` (or other) key exists; the only two hunks in the diff touch `drenyra-commands` and an unrelated `rda-chains`/monthly-close row from a different in-flight change, neither adds a key. `MASTER_CAPABILITIES` (`scripts/verify-capability-manifest.mjs:35`) is untouched by this change (no diff to that script) and the validator's closed-list check passed.

### REQ-ROUTE-005 — `delegated` modality named as a follow-up: **PASS**

Confirmed in both artifacts by direct read, not by trusting the note text alone: `capability-manifest.yaml`'s new `evidence.note` explicitly states *"The routing adapter's `delegated` modality has no production port yet — an explicit, tracked follow-up (REQ-ROUTE-005), not silently omitted."* `docs/architecture/capability-conformance-matrix.md`'s single `drenyra-commands` row (confirmed exactly one occurrence via `grep -c`, i.e. no new row was added) carries the matching sentence. Both are explicit "not-yet-implemented / tracked follow-up" statements, not mere absence.

## Independent verification of apply-progress's two disclosed findings

### Finding 1 — `verifyChain` intent mismatch causes `/drenyra:status route` to typically fail closed with `AMBIGUOUS_INPUT`: **CONFIRMED, genuinely fail-closed**

Traced the actual code path, not the narrative. `lib/chain-pipeline.ts:996–1000`: `runChainStep` resolves/creates its mission via `findActiveChainMission(stores, definition.intent as MissionIntent, binding)` — keyed by the **chain definition's own `intent`** (`"verify"` for `verifyChain`) and the scope binding, never by the caller-supplied `mission` object passed into `executeRoutingWork`/the port. `statusHandler`'s `chainRun` input (`{ binding, input: {}, storesRoot }`, line 452) carries no mission id at all. So when the operator's actively loaded mission has a different intent (e.g. `"monthly-close"`), the chain-resolved `missionAfter` will have a different `.id` than the `mission` parameter. `lib/routing/executor.ts:184` (`verifyResponse`) explicitly checks `response.missionAfter.id !== mission.id` and pushes `"missionAfter.id"` into the field-mismatch list, which routes to the `AMBIGUOUS_INPUT` branch at line 503 (`reason: { kind: "AMBIGUOUS_INPUT", fields: responseIssue }`) — never a crash, never a silent pass-through, never a wrong mission silently accepted. **The disclosed finding is accurate and the behavior is honestly fail-closed**, exactly as claimed. This is a genuine structural limitation of demonstrating the `direct` port against `verifyChain` specifically (an intent-keyed chain reused for a mission of a different intent) — correctly reflected in the manifest's `unit-or-contract-tested ... not validated-end-to-end` qualifier.

**WARNING** (not blocking, design-level): this means `/drenyra:status route`'s "happy path" (a real, non-`AMBIGUOUS_INPUT` execution) is only reachable when the operator's active mission intent happens to be `"verify"` — a narrow, mostly-untested-in-practice condition. No required test (2.5a/b) exercises this branch, so it is not a coverage gap against the tasks/spec as written, but it does mean the wiring's "success" path is effectively undemonstrated end-to-end outside the two required fail-closed/no-op scenarios. Already transparently disclosed by apply-progress and appropriately reflected in the manifest note — flagging here only so `sdd-archive` doesn't lose this context.

### Finding 2 — PR2 is 381 changed lines (vs. design's ~121-line estimate): **CONFIRMED EXACTLY**

Ran `git diff --stat extensions/register.ts __tests__/extension.test.ts capability-manifest.yaml docs/architecture/capability-conformance-matrix.md` fresh (the matrix file itself is untracked/new-to-git from a prior unrelated change, so `git diff --stat` only counted it as absent — confirmed separately with `git diff --no-index /dev/null docs/architecture/capability-conformance-matrix.md`, 81 lines, all new). For the three tracked files: **356 insertions(+), 25 deletions(-) = 381 changed lines** — matches apply-progress's number exactly, digit for digit.

**SUGGESTION**: apply-progress recommends the maintainer accept PR2 as `size:exception` given the 400-line review-budget guard (381 < 400, so it is technically still under budget, contrary to the apply-progress section header's own framing "over the 400-line single-PR guideline" — worth a light correction: 381 is under 400, not over it, though it is tight/near the ceiling as tasks.md's forecast already flagged "High" risk). Recommend `sdd-archive` note the actual number (381, under the 400-line budget) rather than propagate apply-progress's own header wording, which slightly overstates the overage.

## TDD Compliance (Strict TDD Mode)

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | Yes | Full RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR table present for both PRs in apply-progress.md |
| All tasks have tests | Yes | 15/15 tasks map to a test file or are explicitly marked verification-only |
| RED confirmed (tests exist) | Yes | `__tests__/routing/direct-port.test.ts`, `__tests__/routing/executor.test.ts`, `__tests__/extension.test.ts` all exist and were read directly |
| GREEN confirmed (tests pass) | Yes | All listed test files ran fresh in this session and passed (20/20, 61/61, 24/24, 31/31, 738/738 full suite) |
| Triangulation adequate | Yes | `direct-port.test.ts` has 4 distinct cases (success/blocked/wait/opt-in-proof) with genuinely different expected values, not repeated trivial checks |
| Safety Net for modified files | Yes | PR1: 15/15 pre-existing `executor.test.ts` cases run before the new case added; PR2: 24/24 + 31/31 pre-existing tests run before/after |

**TDD Compliance**: 6/6 checks passed.

**PR2's disclosed RED/GREEN methodology deviation** (git-stash-based reconstruction rather than textbook write-test-first) is transparently reported by apply-progress, not silently presented as ideal. Independently judged reasonable: `PreflightRequest`'s ~20 required fields genuinely could not be test-written before their shape was discovered by reading `preflight.ts`'s validation stages — the stash-and-diff recovery technique is a legitimate way to recover genuine RED evidence after the fact, and is disclosed rather than fabricated. No penalty applied.

## Assertion Quality Audit

Scanned `__tests__/routing/direct-port.test.ts` (367 lines, 4 tests), the new case in `__tests__/routing/executor.test.ts` (lines 298–314), and the new `REQ-ROUTE-001` describe block in `__tests__/extension.test.ts` (lines 798–874).

- No tautologies found.
- No orphan empty-collection checks without a companion non-empty test.
- No smoke-test-only patterns (`render()` + `toBeInTheDocument()` with nothing else) — every test asserts concrete values (mission status, stop reason/fields, byte-identical file content + mtime, port call counts).
- No implementation-detail coupling (no CSS class, no internal-state, no mock-call-count-only assertions).
- No ghost loops.
- Mock/assertion ratio: low — tests dispatch through real `runChainStep`/`executeRoutingWork`/`PiExtensionApi` mock harness, not over-mocked production logic. The "opt-in proof" test's counting wrapper is a legitimate call-count instrument around real production code (would fail if the port dispatched eagerly, zero times, or more than once), not a mock-heavy anti-pattern.

**Assertion quality**: All assertions verify real behavior.

## Files changed — confirmed via `git status --short` and `git diff`

Matches apply-progress's own "Files Changed" tables for both PRs exactly:
`lib/routing/direct-port.ts` (new), `__tests__/routing/direct-port.test.ts` (new),
`__tests__/routing/executor.test.ts` (modified), `extensions/register.ts` (modified),
`__tests__/extension.test.ts` (modified), `capability-manifest.yaml` (modified),
`docs/architecture/capability-conformance-matrix.md` (untracked, pre-existing from a
different in-flight SDD change — this change edits its one `drenyra-commands` row).

## Native runtime attempt ledger

Token `sha256:6b7d8ba83a825cafd19162a66598572a4fe1d2be0d0be0c006e2e7dde08fd7a8`,
work-unit `verify-pr1-pr2` — not acquired, not settled, not reset by this
agent, per explicit instruction. Outcome reported to the orchestrator below
for it to handle the ledger.

## Key Learnings

1. `lib/chain-pipeline.ts` resolves a chain's mission by `(binding, chain.intent)`, never by a caller-supplied mission id, so reusing `verifyChain` against a non-verify active mission structurally routes to `AMBIGUOUS_INPUT` on the mission-identity check in `verifyResponse`.
2. `PreflightRequest` requires a concrete `MissionSnapshot`, so a spec requirement phrased as "unconditional on every invocation" cannot be literally unconditional independent of scope/mission existence without contradicting its own type contract.
3. The 400-line PR review-budget guard was correctly stayed under at 381 changed lines for PR2, even though apply-progress's own section header described it as "over" the guideline.
4. `git diff --stat` on tracked files undercounts an untracked pre-existing file's row edit, so cross-checking disclosed line-count claims requires separately diffing untracked files against `/dev/null`.
5. The capability-manifest evidence-fold pattern established by the earlier `pi-capability-conformance` change (fold into existing rows, never add a top-level key) was correctly reused here for the routing-adapter evidence.
