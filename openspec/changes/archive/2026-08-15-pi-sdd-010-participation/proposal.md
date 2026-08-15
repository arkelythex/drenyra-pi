# Change: Pi Participation in SDD-010 Ecosystem Contracts and Release Train

> Change: `pi-sdd-010-participation`
> Product: `drenyra-pi`
> Status: proposed (real SDD pipeline: `proposal → specs → design → tasks → apply → verify → archive`)
> Artifact store: hybrid (OpenSpec files authoritative; Engram best-effort)
> Date: 2026-08-14
> Baseline: checked-out `main` (`c354274`) with an intentionally dirty worktree
> Program authority: `arkelythex/drenyra-ai@4975f4f`, SDD-010 (active, Wave 0)

## 0. What this change is — and is not

**This is a real Pi-local SDD change.** It delivers Drenyra Pi's bounded
participation slice in the program master's active **SDD-010 — Ecosystem
Contracts and Release Train**. It proceeds through the complete local SDD
pipeline and produces implementation plus verification evidence.

- It first restores the known red local baseline, then freezes Pi's two remaining
  draft contracts, adds proportional machine-readable conformance, and records
  verified facts for the master's next integrated checkpoint.
- It implements only obligations that Pi can own locally while master Gate 0 is
  pending. It does not start any gated vertical or later integration.
- It references, but does not duplicate, program-master SDD artifacts. The master
  remains authoritative for the federated capability matrix, program lock, gates,
  and cross-repository release train.
- It preserves the verification-only release posture. No package publication,
  commit, or pull request is part of this change.
- It does not modify unrelated user-owned dirty work, including in-flight
  style/evidence-status work from prior sessions.

## 1. Executive summary

Drenyra Pi already implements much of the runtime surface that the program
master currently describes as partial, but its participation evidence is not yet
checkpoint-ready:

1. **The local baseline is red.** `bun test` currently reports **555 passing and
   2 failing tests across 35 files**. One test still expects the superseded
   private-repository wording; the package content manifest is stale after the
   reconciliation edits.
2. **Two local contracts remain drafts.** `contracts/package-contract.md` and
   `contracts/runtime-dependency.md` are still marked `0.1-draft`, while ROADMAP
   Phase 1 requires both v0.1 contracts to be frozen.
3. **Implemented claims lack one proportional contract-to-runtime check.** Pi has
   existing install, doctor, pin, package, and release verification coverage, but
   the SDD must confirm whether those tests adequately bind frozen claims such as
   the 16-command surface, released pin/checksum, and seven-agent inventory.
4. **The master cannot consume a current Pi checkpoint from this repository.**
   The master `program-lock.json` Pi row is stale relative to local HEAD and test
   reality. Pi needs a local machine-readable capability manifest and a dated,
   verified lock-fact record without writing master-owned files.
5. **Local planning state is stale.** ROADMAP Phase 1 and
   `openspec/config.yaml.current_test_state` must reflect only evidence actually
   delivered and verified by this SDD.

The intended outcome is a green, internally consistent Pi repository with frozen
v0.1 local contracts, proportional conformance checks, and checkpoint facts that
the program master can consume without inference.

## 2. Program alignment — active SDD-010 only

Drenyra Pi participates in the [Drenyra Dominion Program](https://github.com/arkelythex/drenyra-ai/tree/4975f4f/openspec/programs/drenyra-dominion)
as participant `drenyra-pi` with role `agentic-runtime`. The master owns the
federated program artifacts; this repository owns only its local implementation
and evidence.

| Program item | Pi-local treatment in this change | Boundary |
| --- | --- | --- |
| SDD-010 — Ecosystem Contracts and Release Train | Deliver the local contract-freeze, capability-manifest, conformance, and checkpoint-fact slice | **In scope; active Wave 0 work** |
| Six frozen v0.1 program contracts and protection rule | Report Pi's consumed/produced contract facts where locally verifiable; do not redefine master contracts | Reference and checkpoint evidence only |
| Per-repository capability manifest | Add a Pi-local machine-readable manifest matching the master matrix row shape: role, capability states, and tests | Pi-owned artifact; master remains authoritative for aggregation |
| Versioning/compatibility policy and release train | Ensure Pi's local frozen contracts and verification-only release facts are explicit and consumable | No master policy edits and no npm publish |
| `program-lock.json` composition | Produce a verified dated delta record for the master's next checkpoint | Do not edit the master's lock |
| SDD-020 — Universal Agent Configurator | Keep blocked: master Gate 0 is pending and R10 says it **MUST NOT be started** | **Out of scope and gated** |
| SDD-030, SDD-040, and later integrations | Preserve references only; no implementation or local surrogate artifacts | **Out of scope and gated by master sequencing/Gate 0** |

Master Gate 0 remains `pending` at the reconciled program revision. In
particular, cross-repository visibility alignment and attributable approvals
(E-009) remain pending, and R10 blocks SDD-020. This Pi-local SDD neither claims
those gates complete nor uses local progress to bypass them. The authoritative
gate evidence is the program master's `openspec/programs/drenyra-dominion/gate-0.md`
§4 at `arkelythex/drenyra-ai@4975f4f` (reconciled 2026-08-14).

## 3. Verified starting state

These are proposal inputs, not completion claims. The implementation and verify
phases must produce fresh evidence before any ROADMAP or configuration item is
marked complete.

| Item | Starting fact | Evidence source |
| --- | --- | --- |
| Test baseline | `bun test`: 555 pass, 2 fail, 35 files | Current-session baseline run supplied to this change |
| Release wording failure | `__tests__/release-verify-workflow.test.ts:203` still requires `RELEASING.md` to contain `private`; verification-only assertions remain valid and must be retained | Failing test and reconciled `RELEASING.md` |
| Package manifest failure | `contracts/SHA256SUMS.json` no longer matches covered files after edits to the two Markdown contracts | `__tests__/package-verify.test.ts:181`; existing `scripts/verify-package-files.mjs` regeneration/verification path |
| Open local contracts | `package-contract` and `runtime-dependency` are `0.1-draft`; their index entries are Draft | `contracts/package-contract.md`; `contracts/runtime-dependency.md`; `contracts/README.md` |
| Canonical requirements | Nine canonical specs exist; command requirements are REQ-CMD-001..010 and the agent contract covers seven agents | `openspec/specs/*/spec.md`, especially `commands/spec.md` and `agents/spec.md` |
| Implemented surface to reconcile | 16 registered commands, seven agents, released `drenyra-ai@0.2.0` pin, entry checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047` | `extensions/register.ts`; `agents/`; `runtime/pin.ts` |
| Existing conformance coverage | Doctor, installer, pin, package verification, release verification, extension/status/authority/evidence/style tests and package/style verification scripts already exist | `__tests__/*.test.ts`; `scripts/verify-package-files.mjs`; `scripts/verify-packed-install.mjs`; `scripts/verify-style.mjs`; `package.json` |
| Planning state | ROADMAP Phase 1 contract items remain open; OpenSpec test state still records archived 493-test evidence | `ROADMAP.md`; `openspec/config.yaml` |
| Master lock drift | Master Pi row records commit `ea0518b…`, version `0.0.1-prealpha.1`, zero tests, no active changes, and incomplete local facts; local baseline is `c354274` with 557 tests executed (555 passing, 2 failing) | Master `program-lock.json` at `4975f4f`; current local baseline evidence |

## 4. Proposed scope and work units

### 4.1 Restore a green baseline

Follow strict TDD discipline for the two known failures:

- Replace only the obsolete private-visibility expectation in
  `__tests__/release-verify-workflow.test.ts` with the reconciled public state.
- Preserve assertions that the release workflow is verification-only, does not
  publish, describes publication as future work, and contains no `npm publish`.
- Regenerate `contracts/SHA256SUMS.json` through the existing package verification
  tooling so its covered file digests match the real contract contents.
- Run focused checks, then the full test suite, before treating the baseline as
  green.

### 4.2 Freeze the two Pi-local contracts at v0.1

Perform a final evidence-backed content pass over
`contracts/package-contract.md` and `contracts/runtime-dependency.md`:

- Reconcile command claims with the canonical command spec and actual 16-command
  registration surface.
- Reconcile agent claims with the canonical agent spec and actual seven-agent
  inventory.
- Reconcile runtime pin/version/checksum claims with `runtime/pin.ts` and the
  existing verification behavior.
- Change contract status from `0.1-draft` to frozen `v0.1` only after those claims
  agree with source, specs, and tests.
- Update `contracts/README.md` to identify both contracts as Frozen and regenerate
  the content manifest after final contract bytes are stable.

This is a local contract freeze, not a redefinition of the program master's six
frozen contracts.

### 4.3 Establish proportional conformance evidence

Treat the existing suite as the default. First map its actual assertions for
install, doctor, pin, package integrity, and release verification. Add a dedicated
`contracts-conformance` test only if the mapping identifies a material uncovered
frozen claim.

A new test is justified when it closes a concrete gap such as binding contract
claims to all 16 registered commands, the released pin and checksum, or all seven
agents. It must not duplicate coverage merely to create a new filename. Any new
check must be deterministic, machine-readable where applicable, and run under the
existing Vitest command.

### 4.4 Add the Pi-local capability manifest

Add one machine-readable per-repository manifest whose shape can align directly
with the Pi row in the master `capability-matrix.yaml`:

- repository identity and role (`agentic-runtime`);
- the master's named Pi capabilities with explicit states;
- test/conformance state derived from current evidence;
- sufficient version or schema identity to validate the artifact safely.

Use the capability names already established by the master; do not invent new
program capabilities. Provide a verification script and a test that reject shape,
state, or evidence inconsistencies. The local manifest supplies checkpoint input;
it does not supersede or mutate the master matrix.

### 4.5 Record verified program-lock delta facts

Create a dated Pi-local machine-readable record for the master's next integrated
checkpoint. The exact design and path belong to the design phase, but the record
must include only facts verified at the final candidate:

- final local HEAD SHA or an explicit dirty-candidate identity when no commit
  exists;
- package version;
- consumed and produced contract names/versions;
- final test file, pass, fail, and total counts;
- relevant contract/content checksums;
- capability states from the local manifest;
- active local OpenSpec changes, including this SDD while active;
- evidence date and commands used to derive mutable facts.

Because this change has a no-commit boundary, the record must not misrepresent
`c354274` as the identity of uncommitted final bytes. The design must distinguish
repository HEAD from the verified worktree/candidate facts. No master
`program-lock.json` or `capability-matrix.yaml` edit is permitted.

### 4.6 Reconcile ROADMAP and OpenSpec state last

After implementation verification succeeds:

- Mark ROADMAP Phase 1 contract and conformance items complete only when their
  success criteria have fresh evidence.
- Refresh `openspec/config.yaml.current_test_state` with final observed file/test
  counts, command, result, candidate identity, and evidence date.
- Leave any undelivered item open. Do not convert a proposal intention into a
  completion claim.

## 5. Affected areas

| Area | Expected effect |
| --- | --- |
| Tests | Correct one stale visibility assertion; possibly add one proportional contract-conformance test; retain all verification-only release safeguards |
| Contracts | Freeze two Markdown contracts at v0.1, update their index status, and refresh the package content manifest |
| Verification tooling | Reuse existing package verification; add narrowly scoped manifest validation where required |
| Program participation artifacts | Add a Pi-local capability manifest and dated program-lock delta facts |
| Planning/configuration | Update ROADMAP and OpenSpec test evidence only after successful verification |
| Program master | No files changed; receives consumable facts only at a later master-owned checkpoint |
| User worktree | Unrelated dirty style/evidence-status work remains untouched |

The specs and design phases must name exact artifact paths, schemas, invariants,
and ownership boundaries before implementation begins. This proposal deliberately
does not preempt those design decisions beyond requiring machine readability,
validation, and master-compatible semantics.

## 6. Non-goals

- No SDD-020, SDD-030, SDD-040, or later integration implementation; they remain
  gated by master Gate 0 and program sequencing.
- No edits to master-owned files in `arkelythex/drenyra-ai`, including
  `capability-matrix.yaml`, `program-lock.json`, Gate 0, or master SDD artifacts.
- No duplication or local fork of master SDD specs, policies, gates, or release
  train definitions.
- No npm publish, publication workflow, registry credentials, or change to the
  verification-only release posture.
- No commit or pull request; the handoff boundary is **Do not commit**.
- No new architecture, product feature, command, agent, chain, capability, or
  runtime behavior beyond what is necessary to freeze and verify existing claims.
- No broad test-suite rewrite when existing tests already provide the required
  conformance evidence.
- No modification, cleanup, staging, or rollback of unrelated user-owned dirty
  changes, including prior-session style/evidence-status work.
- No claim that master Gate 0, cross-repository visibility alignment, E-009
  approvals, or any later wave is complete.

## 7. Success criteria

The change is successful only when all applicable criteria are evidenced at the
same final candidate:

1. `bun test` passes with zero failures, including the corrected public-state
   release assertion and all retained verification-only/no-publish assertions.
2. Package verification passes and `contracts/SHA256SUMS.json` matches every file
   it covers after all contract edits are final.
3. `package-contract` and `runtime-dependency` identify frozen v0.1 contracts, and
   `contracts/README.md` reports both as Frozen.
4. Frozen claims for the command surface, agent inventory, pin/version/checksum,
   package behavior, and release posture agree with canonical specs, source, and
   conformance tests.
5. Existing conformance coverage is explicitly mapped; a dedicated test exists
   only if a real gap required it, and that gap is named.
6. A validated Pi-local capability manifest uses the master's capability names
   and row semantics, with explicit role, capability states, and test state.
7. A validated dated lock-fact record distinguishes HEAD from uncommitted
   candidate state and reports version, contracts, checksums, capability states,
   active changes, and exact final test counts without editing master files.
8. ROADMAP Phase 1 and `openspec/config.yaml.current_test_state` reflect only the
   work and evidence actually completed by this SDD.
9. `bun run typecheck` and applicable package/style verification commands pass,
   or any pre-existing unrelated failure is isolated and reported without a false
   success claim.
10. The verify report explicitly confirms that gated SDDs were not implemented,
    master-owned files were not changed, npm publishing was not introduced, no
    commit/PR was created, and unrelated dirty files were not modified.

## 8. Risks and mitigations

| ID | Severity | Risk | Mitigation |
| --- | --- | --- | --- |
| R1 | HIGH | A local artifact could be mistaken for authority to advance Gate 0 or start SDD-020 | Label artifacts as participant checkpoint inputs; cite master authority; verify no gated implementation or master edit occurred |
| R2 | HIGH | The no-commit boundary makes a bare HEAD SHA insufficient to identify final verified bytes | Record HEAD and dirty candidate/worktree identity separately; include checksums and exact verification evidence |
| R3 | MEDIUM | Freezing prose that still disagrees with specs or runtime would turn stale documentation into a versioned contract | Require a source/spec/test claim matrix before changing status to Frozen |
| R4 | MEDIUM | A new conformance test could duplicate existing coverage and increase maintenance cost | Map existing tests first; add only the smallest test that closes a named gap |
| R5 | MEDIUM | Generated checksums can become stale again if regenerated before final edits | Regenerate only after final contract/manifest bytes stabilize; run package verification afterward |
| R6 | MEDIUM | Capability states may be overstated to compensate for the stale master row | Preserve the master's vocabulary and require each local state to cite current executable evidence; use `partial` where evidence is incomplete |
| R7 | MEDIUM | ROADMAP/configuration could claim completion before the full final candidate passes | Update planning state last and verify it against final command output |
| R8 | LOW | Implementation could touch unrelated dirty files or erase prior-session work | Establish the intended path set in design/tasks; inspect the final diff and reject out-of-scope paths |
| R9 | LOW | The work may exceed the single-review comfort budget after schemas, scripts, tests, and evidence are designed | Tasks must forecast authored changed lines; under `ask-on-risk`, stop for a delivery decision if forecast exceeds 400 lines or recommends chained PRs, while retaining the no-commit boundary |

## 9. Rollback

Rollback is local and work-unit based; it must not reset or overwrite the dirty
worktree wholesale.

1. Revert only the stale release assertion and regenerated checksum-manifest
   changes if baseline restoration must be withdrawn.
2. Revert the two contract status/content edits and their `contracts/README.md`
   index entry together; then regenerate or restore `SHA256SUMS.json` consistently.
3. Remove only newly added capability/lock-fact artifacts, their validator, and
   their dedicated tests as one unit.
4. Restore only the ROADMAP and `openspec/config.yaml` lines changed by this SDD.
5. Re-run the original verification commands after each rollback boundary.

No rollback step may use a blanket clean/reset, modify master-owned files, or
alter unrelated user-owned changes. No publication rollback is required because
publishing is explicitly out of scope.

## 10. Delivery and verification constraints

- Strict TDD is active (`openspec/config.yaml`): preserve the observed RED
  baseline, make the minimum GREEN correction, triangulate any newly discovered
  contract gap, and refactor only after conformance passes.
- Tests stay with the behavior or artifact they verify, even though no commit is
  created.
- Every work unit records its focused command/result, full-suite evidence where
  applicable, runtime-harness result or explicit N/A, and exact rollback boundary.
- The tasks phase must include a Review Workload Forecast. Delivery strategy is
  `ask-on-risk`: request a human decision only if forecasted authored changes
  exceed 400 lines or chained PRs are recommended.
- The final handoff remains uncommitted and contains no PR. Verification evidence
  must therefore identify the exact candidate without relying solely on Git HEAD.

## 11. Result contract

- `status`: `proposed`
- `executive_summary`: restore Pi's red baseline, freeze its two remaining local
  v0.1 contracts against canonical specs and runtime evidence, add proportional
  conformance plus a validated local capability manifest, and produce verified
  lock-delta facts for the master SDD-010 checkpoint without advancing Gate 0 or
  editing master-owned artifacts.
- `artifacts`: `openspec/changes/pi-sdd-010-participation/proposal.md`
- `next_recommended`: `spec`
- `risks`: R1..R9 (§8)
- `skill_resolution`: `paths-injected` (cognitive-doc-design,
  work-unit-commits, evidence-citation, and scope-discipline loaded before work)
