# Drenyra Pi Participation in SDD-010 — Specification

> Change: `pi-sdd-010-participation`
> Product: `drenyra-pi`
> Phase: specs (real SDD pipeline)
> Date: 2026-08-14
> Baseline: checked-out `main` (`c354274`) with an intentionally dirty worktree; no commit boundary
> Program authority: `arkelythex/drenyra-ai@4975f4f`, SDD-010 (active, Wave 0)
> Requirement ID prefixes: `REQ-BASE`, `REQ-CON`, `REQ-CONF`, `REQ-CAP`, `REQ-LOCK`, `REQ-ROAD`, `REQ-BOUND`

## Purpose

Defines what must be true after Drenyra Pi delivers its bounded participation slice in
the program master's active SDD-010 (Ecosystem Contracts and Release Train): a green
local baseline, two frozen v0.1 local contracts whose claims agree with canonical specs
and runtime source, proportional conformance evidence, a validated machine-readable
Pi-local capability manifest, verified dated lock-delta facts for the master's next
checkpoint, and planning state that reflects only delivered evidence — all without
advancing master Gate 0, editing master-owned files, publishing, or committing.

This is a **participation slice, not a platform**. It defines WHAT the final candidate
must satisfy; exact artifact paths, schemas, and ownership boundaries beyond those
named here belong to the design phase. The master remains authoritative for the
federated capability matrix, program lock, gates, and release train.

## Requirements

## REQ-BASE — Baseline restoration (strict TDD RED → GREEN)

### Requirement: REQ-BASE-001 — Release-state assertion corrected to reconciled public state

The system MUST replace the obsolete private-repository visibility expectation in
`__tests__/release-verify-workflow.test.ts` (currently at line 203:
`expect(releasing).toContain("private")`) with the reconciled public repository state
decided 2026-08-14, and MUST retain every verification-only assertion in that test:
the `release-verify.yml` reference, the
`/no publish|verification-only|does not publish/i` match, the `/future publish/` match,
and `expect(releasing).not.toContain("npm publish")`.

This is the minimum GREEN correction for the observed RED baseline (2 failures); it
MUST NOT remove, weaken, or rename the verification-only release safeguards.

#### Scenario: SC-BASE-001 — Corrected assertion with retained safeguards

- GIVEN the current `__tests__/release-verify-workflow.test.ts` with the failing
  private-visibility expectation at line 203
- WHEN the expectation is corrected to assert the reconciled public repository state
  and the test file is run under `bun test`
- THEN the corrected test passes AND it still asserts `release-verify.yml`, matches
  `/no publish|verification-only|does not publish/i` and `/future publish/`, and
  asserts `not.toContain("npm publish")`

### Requirement: REQ-BASE-002 — Content manifest matches every covered file

The system MUST ensure `contracts/SHA256SUMS.json` cryptographically reconciles every
file it covers (per `scripts/lib/package-verify.mjs`) after all contract edits are
final, regenerated through the existing tooling
(`node scripts/verify-package-files.mjs --update`) and verified by
`__tests__/package-verify.test.ts` (manifest reconciliation assertion at line 181).
The manifest MUST NOT be regenerated before the final contract bytes are stable.

#### Scenario: SC-BASE-002 — Regenerated manifest passes package verification

- GIVEN the two Markdown contracts edited to their final v0.1 content
- WHEN the manifest is regenerated via `node scripts/verify-package-files.mjs --update`
  and package verification runs (`bun test __tests__/package-verify.test.ts` and the
  package verification script)
- THEN every covered file digest in `contracts/SHA256SUMS.json` matches the real file
  contents, no covered file is missing, no uncovered addition is accepted, and the
  reconciliation assertion at `__tests__/package-verify.test.ts:181` passes

### Requirement: REQ-BASE-003 — Full suite green before any completion claim

The system MUST produce a full `bun test` run with zero failures across all files
(including the corrected release-state test and the package verification test) before
any ROADMAP item or `openspec/config.yaml.current_test_state` completion claim is
made. `bun run typecheck` and the applicable package/style verification commands MUST
pass on the final candidate; any pre-existing unrelated failure MUST be isolated and
reported without a false success claim.

#### Scenario: SC-BASE-003 — Green suite gates completion claims

- GIVEN all baseline corrections and contract edits applied to the final candidate
- WHEN `bun test`, `bun run typecheck`, and the applicable package/style verification
  commands run against that exact candidate
- THEN the full suite reports zero failures, typecheck passes, and no ROADMAP or
  configuration item is marked complete before this evidence exists

## REQ-CON — Contract freeze at v0.1

### Requirement: REQ-CON-001 — Package contract frozen only after claim agreement

The system MUST NOT change `contracts/package-contract.md` status from `0.1-draft` to
frozen `v0.1` until every frozen claim agrees with source and canonical specs: the
16-command surface (`/drenyra:status`, `:doctor`, `:company`, `:period`, `:context`,
`:capabilities`, `:scope`, `:models`, `:close`, `:mission`, `:continue`, `:resume`,
`:receipt`, `:evidence`, `:verify`, `:reconcile`) matches `extensions/register.ts` and
REQ-CMD-001..010; the seven-agent inventory matches `agents/` and REQ-AGENT-001; the
pin claim (`drenyra-ai@0.2.0`, state `released`, entry checksum
`e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`) matches
`runtime/pin.ts`.

#### Scenario: SC-CON-001 — Freeze blocked until claims match source

- GIVEN `contracts/package-contract.md` at `0.1-draft` whose command, agent, or pin
  claims disagree with `extensions/register.ts`, `agents/`, or `runtime/pin.ts`
- WHEN the contract status change to frozen `v0.1` is attempted
- THEN the status MUST remain `0.1-draft` until every claim is reconciled and a
  claim-to-source check passes

#### Scenario: SC-CON-002 — Freeze proceeds on full agreement

- GIVEN all 16 command claims match `extensions/register.ts` and REQ-CMD-001..010, the
  seven agents match `agents/` and REQ-AGENT-001, and the pin/checksum matches
  `runtime/pin.ts`
- WHEN the status is changed to frozen `v0.1`
- THEN `contracts/package-contract.md` identifies version `0.1` and status frozen

### Requirement: REQ-CON-002 — Runtime dependency contract frozen only after pin agreement

The system MUST NOT change `contracts/runtime-dependency.md` status from `0.1-draft`
to frozen `v0.1` until its pin, version, checksum, package-locality, and fail-closed
claims agree with `runtime/pin.ts`, `runtime/resolve.ts`, `runtime/checksum.ts`, and
`runtime/doctor.ts` and with the existing conformance tests
(`__tests__/pin.test.ts`, `__tests__/resolve.test.ts`, `__tests__/doctor.test.ts`,
`__tests__/status.test.ts`).

#### Scenario: SC-CON-003 — Runtime contract frozen only on verified pin facts

- GIVEN `contracts/runtime-dependency.md` claims a pin, version, or checksum that
  disagrees with `runtime/pin.ts` (`drenyra-ai@0.2.0`, state `released`, checksum
  `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`)
- WHEN the freeze status change is attempted
- THEN the status MUST remain `0.1-draft` until the claims are corrected and verified

### Requirement: REQ-CON-003 — Contract index reports both contracts Frozen

The system MUST update `contracts/README.md` so that both `package-contract` and
`runtime-dependency` are identified as Frozen v0.1 contracts, and the index MUST NOT
report either as Frozen before the corresponding contract file states frozen `v0.1`.

#### Scenario: SC-CON-004 — Index matches contract file status

- GIVEN both contract files declare frozen `v0.1`
- WHEN `contracts/README.md` is inspected
- THEN both rows report version `0.1` and status Frozen, consistent with the contract
  files and with no other contract row misreported

### Requirement: REQ-CON-004 — Manifest regenerated after final contract bytes

The system MUST regenerate `contracts/SHA256SUMS.json` only after the final bytes of
both contracts and `contracts/README.md` are stable, and MUST re-run package
verification immediately afterward so the frozen bytes are the verified bytes.

#### Scenario: SC-CON-005 — Final bytes are the verified bytes

- GIVEN both contracts and the index are in their final frozen state
- WHEN the manifest is regenerated and package verification runs
- THEN the manifest digests match the frozen contract files exactly and package
  verification passes with no subsequent content edit

## REQ-CONF — Proportional conformance

### Requirement: REQ-CONF-001 — Existing conformance coverage explicitly mapped

The system MUST produce and record a mapping of which existing tests assert install,
doctor, pin, package integrity, and release-verification behavior (for example
`__tests__/doctor.test.ts`, `__tests__/resolve.test.ts`, `__tests__/pin.test.ts`,
`__tests__/status.test.ts`, `__tests__/package-verify.test.ts`,
`__tests__/release-verify-workflow.test.ts`, plus the verification scripts), naming
for each area which assertions cover which frozen contract claim. The mapping MUST be
part of the change evidence (design/apply artifacts) and MUST NOT be replaced by a
new test file name.

#### Scenario: SC-CONF-001 — Mapping accounts for every frozen claim area

- GIVEN the existing test suite
- WHEN the conformance mapping is produced
- THEN every area (install, doctor, pin, package integrity, release verification) maps
  to at least one named existing test or is explicitly listed as uncovered

### Requirement: REQ-CONF-002 — Dedicated conformance test only for a named gap

The system MAY add a dedicated contract-conformance test if and only if the
REQ-CONF-001 mapping finds a material frozen claim with no existing coverage — for
example binding all 16 registered commands to real code, binding the released pin and
entry checksum to real code, or binding all seven agents to their definitions. Such a
test MUST NOT duplicate existing coverage, MUST be deterministic, MUST run under the
existing `bun test` (Vitest) command, and the gap it closes MUST be named in this
spec and in the apply evidence. If the mapping finds no material gap, no dedicated
test MUST be added.

#### Scenario: SC-CONF-002 — No new test when coverage is complete

- GIVEN the mapping shows every material frozen claim already covered by an existing
  test
- WHEN the conformance decision is made
- THEN no dedicated conformance test is added and the mapping is recorded as the
  conformance evidence

#### Scenario: SC-CONF-003 — Gap-bound test when coverage is missing

- GIVEN the mapping finds a material uncovered frozen claim (for example the
  16-command surface is not bound to any test)
- WHEN a dedicated conformance test is added
- THEN the test asserts the specific uncovered claim against real code, does not
  duplicate existing assertions, and the spec/apply evidence names the closed gap

## REQ-CAP — Local capability manifest

### Requirement: REQ-CAP-001 — Machine-readable per-repository capability manifest

The system MUST provide a machine-readable Pi-local capability manifest whose shape
aligns with the Pi row of the master `capability-matrix.yaml`, declaring repository
identity, role `agentic-runtime`, and explicit states for the master's established
Pi capability names: `persona-startup-panel`, `drenyra-commands`, `pi-subagents`,
`model-routing`, `packaged-skills`, `rda-chains`, `tool-safety-broad-deny`,
`engram-integration`, `pinned-ai-runtime`, and `configurator-install-doctor-sync`.
Capability states MUST use the master's vocabulary (`implemented`, `partial`,
`planned`, or equivalent established states) and MUST cite current executable
evidence; `partial` MUST be used wherever evidence is incomplete. New program
capability names MUST NOT be invented.

#### Scenario: SC-CAP-001 — Manifest matches master row vocabulary

- GIVEN the Pi-local capability manifest
- WHEN it is parsed and compared against the master `capability-matrix.yaml` Pi row
- THEN the manifest declares role `agentic-runtime`, uses exactly the master's
  capability names for the states it reports, and each state is backed by cited
  executable evidence

### Requirement: REQ-CAP-002 — Version/schema identity and test state

The system MUST give the manifest a version or schema identity sufficient to validate
it safely, and MUST include test/conformance state derived from the final candidate
evidence (command, result, and counts or a reference to the lock-fact record).

#### Scenario: SC-CAP-002 — Manifest validates with versioned schema

- GIVEN the capability manifest with its declared schema/version
- WHEN the validator parses it
- THEN the version/schema identity is recognized, the test/conformance state is
  present and consistent with the final candidate evidence, and validation passes

### Requirement: REQ-CAP-003 — Validator and test reject inconsistencies

The system MUST provide a verification script and a test that reject shape, state, or
evidence inconsistencies in the manifest, including unknown capability names, missing
role, missing version/schema identity, states inconsistent with the cited evidence,
and structurally invalid documents.

#### Scenario: SC-CAP-003 — Invalid manifest rejected

- GIVEN a manifest with an unknown capability name, a missing role, or a state
  unsupported by its cited evidence
- WHEN the validator and its test run
- THEN validation fails with an explanatory error naming the inconsistency, and the
  test asserts the rejection

### Requirement: REQ-CAP-004 — Manifest never mutates the master matrix

The system MUST ensure the local capability manifest, its validator, and its test
operate on Pi-owned artifacts only and MUST NOT write to the master
`capability-matrix.yaml` or any other master-owned file in `arkelythex/drenyra-ai`.

#### Scenario: SC-CAP-004 — Master matrix untouched

- GIVEN the manifest validator and test run successfully
- WHEN the master repository state is inspected
- THEN no master-owned file (including `capability-matrix.yaml`) was created,
  modified, or deleted

## REQ-LOCK — Verified lock-delta facts

### Requirement: REQ-LOCK-001 — HEAD distinguished from uncommitted final candidate

The system MUST provide a dated, machine-readable lock-fact record that explicitly
distinguishes the repository HEAD (`c354274`) from the uncommitted final candidate
(verified worktree bytes). The record MUST NOT represent `c354274` as the identity of
the final candidate bytes; candidate identity MUST be expressed through a distinct
dirty-candidate identifier plus content checksums of the final verified bytes.

#### Scenario: SC-LOCK-001 — Candidate identity never conflated with HEAD

- GIVEN the no-commit boundary and a final uncommitted candidate
- WHEN the lock-fact record is read
- THEN it contains both a HEAD field (`c354274`) and a separate candidate identity
  field that differs from HEAD, with checksums identifying the final bytes

### Requirement: REQ-LOCK-002 — Complete verified fact set

The lock-fact record MUST include only facts verified at the final candidate: package
version; consumed and produced contract names and versions (including the two frozen
v0.1 contracts and the consumed drenyra-ai contracts); final test file, pass, fail,
and total counts; relevant contract/content checksums (including the pin entry
checksum); capability states from the local manifest; active local OpenSpec changes
(including this SDD while active); evidence date; and the exact commands used to
derive the mutable facts.

#### Scenario: SC-LOCK-002 — Every required field present and verified

- GIVEN the final candidate and its verification evidence
- WHEN the lock-fact record is parsed
- THEN it contains package version, consumed/produced contract names+versions, final
  test file/pass/fail/total counts, relevant checksums, capability states, active
  changes, evidence date, and derivation commands, and every field matches the
  final-candidate evidence

### Requirement: REQ-LOCK-003 — No master lock or matrix edit

The system MUST NOT edit the master `program-lock.json` or `capability-matrix.yaml`
(or any master-owned file); the lock-fact record is a Pi-local input for the master's
next integrated checkpoint.

#### Scenario: SC-LOCK-003 — Master lock untouched

- GIVEN the lock-fact record created
- WHEN the master repository state is inspected
- THEN `program-lock.json`, `capability-matrix.yaml`, and all other master-owned files
  are unchanged

## REQ-ROAD — Planning state last

### Requirement: REQ-ROAD-001 — ROADMAP completion requires fresh final-candidate evidence

The system MUST mark ROADMAP Phase 1 contract and conformance items complete only when
their success criteria have fresh evidence from the final candidate (frozen v0.1
contracts, README Frozen status, conformance mapping/test decision, green full suite).
Any undelivered item MUST remain unchecked.

#### Scenario: SC-ROAD-001 — Undelivered items stay open

- GIVEN the final candidate evidence
- WHEN ROADMAP Phase 1 checkboxes are updated
- THEN items whose success criteria have fresh evidence are checked, and every other
  Phase 1 item remains unchecked

### Requirement: REQ-ROAD-002 — OpenSpec test state refreshed with final evidence

The system MUST refresh `openspec/config.yaml.current_test_state` with the final
observed file/test counts, the command run (`bun test`), the result (pass/fail),
candidate identity, and evidence date, replacing the archived 493-test evidence that
was not re-run.

#### Scenario: SC-ROAD-002 — Test state reflects the final candidate

- GIVEN the final full-suite run
- WHEN `openspec/config.yaml.current_test_state` is inspected
- THEN it records the final file count, test count, pass result, the exact command,
  the candidate identity, and the evidence date, and does not claim the archived
  counts as current

## REQ-BOUND — Boundaries

### Requirement: REQ-BOUND-001 — No gated SDD implementation

The system MUST NOT implement SDD-020 (Universal Agent Configurator), SDD-030
(Organic Accounting Work Routing), SDD-040 (Receipt-Driven Accounting v2), or any
later integration; these remain gated by master Gate 0 and program sequencing (master
Gate 0 R10). No local surrogate artifacts for gated SDDs MAY be created.

#### Scenario: SC-BOUND-001 — Gated SDDs absent from the candidate

- GIVEN the final candidate
- WHEN the changed paths and artifacts are inspected
- THEN no SDD-020/030/040 (or later) implementation, spec, or surrogate artifact is
  present, and the verify report confirms this

### Requirement: REQ-BOUND-002 — No master-owned file edits

The system MUST NOT create, modify, or delete files in the master repository
(`arkelythex/drenyra-ai`), including `capability-matrix.yaml`, `program-lock.json`,
Gate 0 artifacts, and master SDD artifacts.

#### Scenario: SC-BOUND-002 — Master repository unchanged

- GIVEN the final candidate
- WHEN the master repository working tree is inspected
- THEN no master-owned file was changed by this change

### Requirement: REQ-BOUND-003 — No publish, commit, or pull request

The system MUST NOT publish to npm, create a commit, or open a pull request. The
handoff boundary is **do not commit**; the verification-only release posture is
unchanged and no registry credentials or publication workflow are introduced.

#### Scenario: SC-BOUND-003 — Handoff remains uncommitted and unpublished

- GIVEN the final candidate
- WHEN the repository state is inspected
- THEN the work is uncommitted, no PR exists, no publish workflow or credential was
  added, and the release gate remains verification-only

### Requirement: REQ-BOUND-004 — Unrelated dirty work untouched

The system MUST NOT modify, clean, stage, or roll back unrelated user-owned dirty
changes, including prior-session style/evidence-status work; the intended path set
MUST be limited to this change's scope and the final diff MUST be inspected to reject
out-of-scope paths.

#### Scenario: SC-BOUND-004 — Out-of-scope paths rejected

- GIVEN pre-existing unrelated dirty files in the worktree
- WHEN the change is applied and the final diff is inspected
- THEN none of the unrelated dirty files was modified, staged, or removed, and any
  out-of-scope path is rejected

### Requirement: REQ-BOUND-005 — Gate 0 never claimed complete

The system MUST NOT claim master Gate 0 complete, bypass it, or use local progress to
advance it; participation artifacts MUST be labeled as participant checkpoint inputs,
and the verify report MUST confirm gated SDDs were not implemented, master files were
not changed, publishing was not introduced, no commit/PR was created, and unrelated
dirty files were not modified.

#### Scenario: SC-BOUND-005 — Verify report confirms boundary compliance

- GIVEN the completed change
- WHEN the verify report is read
- THEN it explicitly confirms each boundary in REQ-BOUND-001..004 and makes no claim
  that Gate 0 is complete or advanced

## Out of Scope

- Implementation of SDD-020/030/040 or any later master integration (gated by master
  Gate 0).
- Any edit to master-owned files in `arkelythex/drenyra-ai`.
- npm publishing, publication workflow changes, or registry credentials.
- Any commit or pull request.
- New architecture, product feature, command, agent, chain, capability, or runtime
  behavior beyond freezing and verifying existing claims.
- Broad test-suite rewrites when existing tests already provide the required
  conformance evidence.
- Modification of unrelated user-owned dirty changes.
- Any claim that master Gate 0, visibility alignment, E-009 approvals, or a later
  wave is complete.
