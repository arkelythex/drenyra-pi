# Release Readiness Specification

## Purpose

Defines how `drenyra-shell` documents the mandatory lock-fact recovery sequence
and keeps its release-facing procedure, version surfaces, and install
diagnostics consistent with what the repository actually enforces. The
recovery mechanism, the version-agreement guards, and the release gate already
exist and fail closed; what this specification binds is that they are
documented once, discoverably, and honestly, and that the package install hook
never fails silently and never fails hard.

This is a new domain with no prior canonical spec; every requirement below is
additive. Nothing here authorizes publication, a pin upgrade, or any change to
the frozen contract surface.

## Requirements

### Requirement: REQ-REL-001 — Single canonical, discoverable recovery sequence

Whenever a change folder is opened or archived, or any path in
`PARTICIPATION_PATHS_V1` is mutated — including by a formatter, an autofix
pass, or another session acting outside any attempt — the lock-fact recovery
sequence is mandatory. The repository MUST state that sequence in exactly one
canonical, non-archived operating document. That document MUST name both
trigger classes, the ordered steps, and the reason the order matters. Other
documents MUST reach the sequence by link and MUST NOT restate the ordered
steps.

The ordered sequence is: `bun run refresh:lock-facts`, then rewrite
`openspec/config.yaml#/current_test_state/candidate_identity`, then
`node scripts/refresh-program-lock-facts.mjs --check`, then full verification.

The reason the order matters MUST be stated: the mirror field is
normalization-exempt, so rewriting it does not itself move the candidate
identity, while a refresh performed without the mirror rewrite leaves
`verify:capability` red with no other symptom.

#### Scenario: Both trigger classes are named

- GIVEN the canonical recovery document
- WHEN a reader looks for when the sequence is mandatory
- THEN it names a mutation of any `PARTICIPATION_PATHS_V1` path, including one
  made by a formatter, autofix, or another session outside any attempt, AND a
  change-folder lifecycle event (opening or archiving a change), because that
  event moves the generated `activeChanges` field inside an allowlisted file

#### Scenario: Ordered sequence appears once

- GIVEN the repository's non-archived documents
- WHEN the ordered recovery steps are searched for
- THEN they appear in exactly one document — the operating document that owns
  the `refresh:lock-facts` command — in the order refresh → mirror rewrite →
  `--check` → full verification, and `openspec/README.md` and `RELEASING.md`
  reach that document by link without restating the steps

#### Scenario: Ordering rationale is stated

- GIVEN the canonical recovery document
- WHEN the reader asks why the mirror is rewritten before `--check`
- THEN the document states that the mirror is normalization-exempt and does not
  move the candidate identity, and that omitting it leaves `verify:capability`
  red with no other symptom

#### Scenario: No step hand-edits a trust anchor

- GIVEN the canonical recovery document
- WHEN an operator follows the sequence
- THEN no step instructs a hand-edit of `candidateIdentity`, a checksum or
  digest, or `headSha`

### Requirement: REQ-REL-002 — Release procedure uses the sanctioned generator and cites only runnable gates

`RELEASING.md` MUST NOT instruct an operator to hand-edit a trust anchor. Its
runtime pin-bump procedure MUST invoke the sanctioned generator
`bun run refresh:lock-facts`, MUST include the normalization-exempt mirror
rewrite in `openspec/config.yaml#/current_test_state/candidate_identity`, and
MUST include `node scripts/refresh-program-lock-facts.mjs --check`. The release
checklist MUST name only gates that exist and can be cited as run —
`bun run test`, `bun run verify:package`,
`node scripts/verify-packed-install.mjs`, `bun run verify:capability` — and
MUST NOT require a gate with no executable implementation. No vector runner is
required by, or built for, this change.

#### Scenario: Pin-bump step invokes the sanctioned generator

- GIVEN the `RELEASING.md` runtime pin-bump procedure
- WHEN its lock-fact regeneration step is read
- THEN it invokes `bun run refresh:lock-facts`, includes the
  `openspec/config.yaml` mirror rewrite, and includes
  `node scripts/refresh-program-lock-facts.mjs --check`

#### Scenario: No hand-edit instruction survives

- GIVEN `RELEASING.md` in full
- WHEN it is searched for instructions to set a trust anchor by hand
- THEN no instruction to hand-edit `candidateIdentity`, a checksum or digest,
  or `headSha` remains

#### Scenario: Checklist names only runnable gates

- GIVEN the release checklist
- WHEN each named gate is resolved
- THEN every one exists in `package.json#/scripts` or as a runnable script
  under `scripts/`, the four ratified gates are named, and no checklist item
  requires a gate that no script or workflow implements

### Requirement: REQ-REL-003 — Version agreement across three coupled surfaces

The package version MUST be `0.1.0` and MUST be identical in
`package.json#/version`, `capability-manifest.yaml#/repository/version`, and
`docs/architecture/program-lock-facts.json#/packageVersion`. Because two
independent guards already assert those equalities —
`scripts/verify-capability-manifest.mjs` and `__tests__/lock-facts.test.ts` —
the version change MUST be applied as one atomic unit: edit the three
surfaces, run the sanctioned refresh so the derived fields
(`capabilityStates.digestSha256`, `headSha`, and the generated `activeChanges`
included) are regenerated rather than hand-edited, rewrite the
normalization-exempt mirror, run `--check`, then run full verification.
`CHANGELOG.md` MUST record the bump and MUST NOT imply that a release was
published.

#### Scenario: Three surfaces agree on 0.1.0

- GIVEN the change's final candidate
- WHEN the three version-bearing surfaces are read
- THEN `package.json#/version`, `capability-manifest.yaml#/repository/version`,
  and `docs/architecture/program-lock-facts.json#/packageVersion` all read
  `0.1.0`

#### Scenario: A partial bump fails closed

- GIVEN a candidate in which only one version-bearing surface was updated
- WHEN `bun run verify:capability` and `bun run test` run
- THEN verification fails, so the three-surface edit plus the recovery pair is
  the atomic unit of this requirement

#### Scenario: Derived fields are regenerated, never hand-edited

- GIVEN the three version surfaces were edited
- WHEN the lock facts are updated
- THEN the update runs through `bun run refresh:lock-facts`, the mirror rewrite
  carries the value that refresh produced, and
  `node scripts/refresh-program-lock-facts.mjs --check` exits 0

#### Scenario: Changelog records the bump without claiming a release

- GIVEN the `0.1.0` `CHANGELOG.md` entry
- WHEN it is read
- THEN it records the version bump and states that publication remains off, and
  it does not claim that a package was released

### Requirement: REQ-REL-004 — Install hook is never silent and never hard-failing

The `postinstall` hook MUST NOT complete without a diagnostic when the compiled
installer is absent. When `dist/scripts/install-drenyra-ai.js` does not exist,
`postinstall` MUST print a visible warning identifying the missing compiled
installer and MUST still exit 0. When the file exists, `postinstall` MUST run it
and propagate its exit status. The hook MUST NOT fail closed, because CI and
`release-verify` run `bun install --frozen-lockfile` before any build step,
when no compiled installer can exist.

#### Scenario: Absent installer warns and exits 0

- GIVEN a working directory in which `dist/scripts/install-drenyra-ai.js` does
  not exist
- WHEN the `postinstall` hook runs
- THEN it prints a visible warning naming the missing compiled installer and
  exits with status 0

#### Scenario: Present installer behavior is unchanged

- GIVEN `dist/scripts/install-drenyra-ai.js` exists
- WHEN the `postinstall` hook runs
- THEN it executes the compiled installer, propagates its exit status, and
  prints no missing-installer warning

#### Scenario: Frozen install before build still succeeds

- GIVEN a clean checkout with no `dist/` build
- WHEN `bun install --frozen-lockfile` runs
- THEN the install succeeds with exit status 0 while the warning is printed

#### Scenario: Packed-install proof stays green

- GIVEN `node scripts/verify-packed-install.mjs`
- WHEN it runs against the change's candidate
- THEN the warning remains a single bounded line that does not corrupt the
  captured npm diagnostics, and the proof passes

### Requirement: REQ-REL-005 — Release-facing prose states the current truth

Release-facing comments and changelog text MUST describe the state the
repository is actually in. `runtime/installer.ts` MUST NOT describe the
pending-release branch as live while `DEFAULT_PIN.state` is `released`.
`.github/workflows/ci.yml` MUST NOT name a vendored runtime artifact different
from the one `package.json`'s `drenyra-ai` devDependency names. `CHANGELOG.md`
MUST NOT record a theme file that does not exist under `themes/`.

#### Scenario: Installer comment matches the live pin branch

- GIVEN `DEFAULT_PIN.state` is `released` in `runtime/pin.ts`
- WHEN the `runtime/installer.ts` doc comment on the postinstall entry is read
- THEN it does not claim the pending-release branch is live, and it describes
  the released branch as the one in force

#### Scenario: CI comment matches the pinned dependency

- GIVEN `.github/workflows/ci.yml`'s test-job comment about the pinned runtime
  devDependency
- WHEN it is compared with `package.json#/devDependencies/drenyra-ai`
- THEN both name the same vendored runtime version

#### Scenario: Changelog names only existing themes

- GIVEN every theme path named in `CHANGELOG.md`
- WHEN each is resolved under `themes/`
- THEN it exists — the recorded theme artifacts are
  `themes/fiscal-operator/fiscal-operator-light.json` and
  `themes/fiscal-operator/fiscal-operator-dark.json`

### Requirement: REQ-REL-006 — No publication boundary

This change MUST stop at a verified gate plus honest documentation. It MUST NOT
add or modify `publishConfig`, MUST NOT add a publish step or publish job, MUST
NOT create, move, or delete a tag or dist-tag, MUST NOT invoke any registry
publication command, and MUST NOT check `ROADMAP.md`'s item "Package released
as `drenyra-shell` on npm". The `release-verify` workflow MUST remain a pure
verification gate.

#### Scenario: No publication surface is added

- GIVEN the change's final diff
- WHEN `package.json` and `.github/workflows/` are inspected
- THEN there is no `publishConfig` entry, no publish step or publish job, and
  no registry publication command

#### Scenario: Roadmap npm item stays unchecked

- GIVEN `ROADMAP.md`
- WHEN the npm package item is read
- THEN it remains unchecked

#### Scenario: Verification-only gate is preserved

- GIVEN `.github/workflows/release-verify.yml`
- WHEN it is inspected after this change
- THEN it still invokes no registry publication command and still requests only
  its recorded read-only permissions

## Out of Scope

Any runtime pin upgrade; any change to `contracts/**` or
`contracts/SHA256SUMS.json`; any change to the ten-name `MASTER_CAPABILITIES`
set or the capability state counts; any rework of `PARTICIPATION_PATHS_V1` or
the candidate-identity algorithm; fiscal/operational recovery
(`REQ-MISS-007`, `REQ-CMD-007` — already implemented, specified, and tested);
enabling npm publication; the archived `pi-skills-memory-integration` change;
an executable docs-drift guard, including the optional narrow static
assertion, which the proposal declined; and the commit/push boundary, the
stray `./~/` cleanup, and the superseded-change archive, which the change
records as already delivered rather than re-planned.
