# Exploration — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6 in the Drenyra Pi program)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Artifact store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Phase:** explore — read-only. No source, test, contract, spec, config, or lock-fact file was written by this phase. The only write is this artifact.
**Status:** explored; proposal not written. Scope is **discovered, not invented** — the bounded gap list below is offered as candidate scope for a human decision, not as a settled scope.

---

## 0. Method and evidence integrity

This phase ran with a **read-only, no-shell tool surface** (`read`, `grep`, `write`). Consequences that bound every claim below:

| Capability | Available? | Effect on this exploration |
| --- | --- | --- |
| Read files / search contents | yes | All file-content claims are directly measured here. |
| Run commands (`git status`, `du`, `bun test`, `--check`) | **no** | Repository *execution* facts are derived from first-principles inspection of `.git/` internals and from the scripts' own source, never from running them. |
| Verify line/file counts of the dirty worktree | **no** | The parent's counts (29 modified / 1 deleted / 13 untracked, 114 MB / 3,942 files under `./~/`) are **parent-measured** and are reproduced below as such, flagged `UNVERIFIED-HERE`. |

Precedent for this constraint: the SDD-1 exploration recorded the same limitation verbatim — *"this read-only tool surface cannot provide a literal `git status` listing."*

**Evidence-quality note.** The parent's mandated reading list contains one path that **does not exist**: `scripts/install-drenyra-ai.js`. The real source is `scripts/install-drenyra-ai.mjs`, copied by `scripts/build.mjs:36-39` to `dist/scripts/install-drenyra-ai.js`, which is what `package.json#scripts.postinstall` runs. This is harmless to the exploration but is itself a datum for finding **G10** (release-surface detail drift).

---

## 1. Executive finding

The phrase "recovery and release readiness" describes **two different kinds of thing** in this repository, and conflating them is the main scoping risk:

1. **Fiscal/operational recovery is already implemented, tested, and specified.** `REQ-MISS-007` (mission recovery) and `REQ-CMD-007` (resume recovery) are canonical requirements; `lib/mission-store.ts` implements fail-closed restart recovery (`recoverDurableMissions`, `RecoveryReport`, unresolved-recovery records) and is covered by `__tests__/mission-store.test.ts` (including a corrupt-store fail-closed case). **This is not a gap.**

2. **Harness-process recovery and release readiness are genuinely missing as *documented, discoverable procedure* — while the underlying enforcement already exists and fails closed.** The enforcement (`refresh:lock-facts` + rewrite the identity mirror + `--check` + `bun test`) is real, tested, and hard to bypass. What is missing is that the *required sequence*, its *triggers*, and its *release-facing consequences* live only in archived change artifacts. An operator following the repository's own release document would hand-edit a trust anchor and leave the tree red.

So the honest framing is: **this change is about making an already-enforced recovery sequence and an already-enforced release gate *discoverable, correct, and non-contradictory* — plus one genuinely destructive cleanup unit and two product decisions.** It is not about building recovery.

A second, larger finding dominates the risk picture: **the entire verified SDD 1–5 body of work has no commit boundary, and neither does the local history that precedes it.** The single most valuable "recovery readiness" action available is creating that boundary — which is delivery work, not SDD phase work, and must be a parent/human decision.

---

## 2. Current state, measured

### 2.1 Git state (derived from `.git/` internals, not from `git`)

| Observation | How measured | Value |
| --- | --- | --- |
| Current branch | `.git/HEAD` | `ref: refs/heads/main` |
| Local `main` | `.git/refs/heads/main` | `4d64f383758f3c9d5e5b7d7ad558908be15f2e42` |
| Last known `origin/main` | `.git/packed-refs` (no loose `refs/remotes/origin/main` exists — `read` returned ENOENT) | `2e5b78f835d1b2e5d119068de8085d5e8eca04e8` |
| Last HEAD reflog entry | `.git/logs/HEAD` (final line) | `commit: feat(chains): wire real reconciliation into the monthly-close RECONCILE phase`, ending at `4d64f383` |
| Local commits not on the last known `origin/main` | `.git/logs/HEAD` chain from `2e5b78f8` | exactly 5: `585f5ca9` → `17965b5a` → `ebdc2680` → `ad6b7f66` → `4d64f383` |
| Last recorded push | `.git/logs/refs/remotes/origin/main` | last `update by push` at epoch `1786689580`; every later entry is `fetch`/`pull --ff-only` |
| Tags | `.git/packed-refs` | exactly one: `refs/tags/v0.0.1-prealpha.1` (annotated → peeled `1c864bf8`) |

**Consequences, stated precisely:**

- No commit, checkout, or branch operation has occurred since the commit that produced `4d64f383`. The parent's fact 1 ("nothing is committed") is corroborated: no phase created a commit, branch, or tag.
- **Beyond the parent's fact list:** local `main` is **5 commits ahead of the last known `origin/main`**, and no push has been recorded since epoch `1786689580`. So it is not only the dirty worktree that has never reached the remote — the local history underneath it has not either.
- The release gate (`.github/workflows/release-verify.yml`) requires dispatch from protected remote `main` against an annotated `v<package.json version>` tag whose commit equals remote `main`. **From this clone, `release-verify` cannot be exercised at all.**

### 2.2 Deliberate deletion still uncommitted (measured)

`themes/fiscal-operator/manifest.json` is **absent from disk** (`read` → ENOENT) while `themes/README.md` documents the deliberate absence ("Pi loads every discovered JSON file as a complete theme, so this directory contains no JSON metadata or variant manifest"). SDD-1's archive report §6 attributes the deletion to pre-existing work from another session and confirms it was not reverted.

**This is the sharpest recovery hazard in the tree:** the two most natural "recover from trouble" commands — `git checkout -- .` and `git stash` — would both discard the verified SDD work *and* resurrect a deletion the repository deliberately made. There is no commit to recover to.

### 2.3 The lock-facts coupling (mechanism measured in source)

`scripts/refresh-program-lock-facts.mjs` derives repository-derived fields from the live filesystem, including:

```js
const activeChanges = entries
  .filter((entry) => entry.name !== "archive" && entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
```

`__tests__/lock-facts.test.ts` (`collectLockFactsViolations`) independently re-discovers the same set and requires exact equality ("activeChanges must exactly match the discovered active OpenSpec changes"). `--check` mode fails when the prospective bytes differ from the file on disk.

Measured current state of that derived field: `docs/architecture/program-lock-facts.json#activeChanges` = `["pi-skills-memory-integration"]`, and `openspec/changes/` contains exactly one non-`archive` directory (verified: the only `state.yaml` under `openspec/changes/` outside `archive/` is `pi-skills-memory-integration/state.yaml`).

**PREDICTED, NOT MEASURED (no shell tool available):** creating this change's directory — which this phase was instructed to do and did — makes the discovered set `["pi-recovery-release-readiness", "pi-skills-memory-integration"]`, which no longer equals the recorded `["pi-skills-memory-integration"]`. Therefore, from the moment this artifact exists:

- `node scripts/refresh-program-lock-facts.mjs --check` should report `FAILED: program lock facts are stale`;
- `bun test __tests__/lock-facts.test.ts` should fail on the `activeChanges` assertion.

This is not a prediction from theory: it is the **exact mechanism SDD-1 measured and repaired**. `openspec/changes/archive/2026-09-11-pi-capability-conformance/tasks.md:50-58` removes "the empty untracked directory `openspec/changes/pi-recovery-release-readiness/`" for this precise reason, and `apply-progress.md:145` records: *"The native status engine counted it as an active change, which polluted both `activeChanges` and change selection."*

**This is a self-referential trap and it is the cleanest possible evidence for the first bounded gap: in this repository, the ordinary act of opening an SDD change forces the recovery pair.** No durable document says so.

---

## 3. Bounded gap list, with evidence

Classification legend: **GAP** = real, bounded, supported by evidence; **FALSIFIED** = investigated and found already covered; **HAZARD** = risk requiring a decision rather than a build.

### G1 — GAP. The forced-identity-advance trigger is undocumented for ordinary lifecycle events

**What is enforced:** any change to the set of directories under `openspec/changes/` (excluding `archive/`) invalidates the recorded `activeChanges`, which invalidates `--check`, which means the generated lock-fact record no longer describes the tree.

**What is documented:**

- `docs/architecture/program-lock-facts.md` — documents `bun run refresh:lock-facts` and `--check`, and states the producer derives `activeChanges`. It does **not** state *when* the refresh is mandatory, and does not mention the identity mirror.
- `openspec/README.md` — the SDD entry document — **never mentions lock facts, `activeChanges`, or the refresh at all.** An operator reading it before opening a change learns nothing about the coupling.
- `CONTRIBUTING.md` — states branch/worktree hygiene and the 400-line rule; says nothing about lock facts.
- `docs/CODEBASE-GUIDE.md` — zero matches for `lock-facts`, `activeChanges`, `recovery`, or `commit`.

**Where the rule actually lives:** `openspec/changes/archive/2026-09-11-pi-capability-conformance/tasks.md:125`, which states the generalized rule —

> **Rule generalized (supersedes the PR 2.5 wording):** the sequencing rule is not limited to units that edit an allowlisted input. **Any** mutation of an allowlisted path — including one made by a formatter, autofix, or another session outside any attempt — invalidates the generated facts, so the recovery pair (`refresh` → rewrite the normalized identity → `--check` → full verification) must follow every such mutation, not only every apply unit.

**That is an archived change artifact.** The rule that governs every future change in this repository is recorded only in a closed change's task list (plus its `apply-progress.md` and `archive-report.md`). This is the definition of tribal knowledge, and it is the primary G1 evidence.

**Recovery was needed three times inside a single SDD.** SDD-1 created three ad-hoc, parent-owned recovery units — PR 1.5 (`tasks.md:48-58`), PR 2.5 (`apply-progress.md:298-336`), PR 3.5 (`apply-progress.md:466-514`) — for three distinct causes: an empty change directory polluting `activeChanges`; a 892-line unit tripping the 400-line attempt bound; and a `pi-lens` reformat of two identity-allowlisted files. In PR 3.5 the attempt's own closing evidence was *accurate when recorded* and was contradicted minutes later by an out-of-band formatter (measured then: `bun test` 766/1, `--check` stale; recorded at close: 767/0, current). Three occurrences in one change is not a one-off; it is a structural property.

**Bounded scope candidate:** state the trigger set (open a change, archive a change, any mutation of an allowlisted path, any formatter/autofix run) and the ordered recovery pair in exactly one durable, discoverable operating document; make it reachable from `openspec/README.md` and `RELEASING.md`.

### G2 — GAP. The `openspec/config.yaml` identity mirror is required, enforced, and nearly undiscoverable

**Enforcement (measured in source):** `scripts/verify-capability-manifest.mjs#validateCurrentSnapshotRecord` fails closed when `current_test_state.candidate_identity !== lockFacts.candidateIdentity` while the record is `evidence_scope: current`:

```js
if (liveCandidateIdentity !== null && fields.candidate_identity !== liveCandidateIdentity) {
  violation(`conflicting current snapshot identity in ${CONFIG_RECORD_REL}: ...`);
}
```

and `__tests__/capability-manifest.test.ts:1393` runs that validator **against the real repository root** and requires exit 0 twice. Because CI, `release-verify`, and `prepublishOnly` all run `bun run test`, the mirror is genuinely gated.

**Discoverability:** the mirror step appears in exactly three places, all of them change-scoped or inventory-scoped:

1. `docs/architecture/legacy-capability-surface-inventory.md:99-101` — the only *non-archived* document that states the full sequence: `bun run refresh:lock-facts` → rewrite the identity-normalized field in `openspec/config.yaml` → `--check`.
2. SDD-1's archived `tasks.md:117-127`.
3. SDD-1's archived `apply-progress.md` and `archive-report.md`.

`docs/architecture/program-lock-facts.md` — the document whose title is literally *"Refresh the participant checkpoint"* — omits the mirror. `RELEASING.md` never mentions `refresh:lock-facts`, let alone the mirror.

**Consequence for the operator:** running the *documented* recovery (`bun run refresh:lock-facts` then `--check`) turns `bun run verify:capability` red, because the identity advance is written into the lock facts while `openspec/config.yaml` still records the previous value. The documented step is incomplete in a way that produces a red tree.

**Bounded scope candidate:** fold the mirror into the sanctioned sequence everywhere the sequence is stated, and state why ordering matters (the mirror is normalization-exempt, so it does not itself move the identity — verified by `normalizeConfigYaml` in `scripts/compute-candidate-identity.mjs`).

### G3 — GAP. `RELEASING.md`'s pin-bump step 7 instructs a hand-edit that the repository forbids

**Measured text** (`RELEASING.md:82-87`):

> 1. **Regenerate the program lock-facts.** `docs/architecture/program-lock-facts.json`: `headSha` = the delivery base commit, `candidateIdentity` = `node scripts/compute-candidate-identity.mjs` (last line), `checksums.contentManifest.sha256` = sha256 of the current `contracts/SHA256SUMS.json` bytes, `capabilityStates.digestSha256` = sha256 of the current `capability-manifest.yaml` bytes.

**Why this is wrong now:**

- `scripts/refresh-program-lock-facts.mjs` is the established generator; `docs/architecture/program-lock-facts.md` mandates it and adds `--check`.
- The same contract that governs archive/apply states sharply: *"Do not hand-edit a checksum, digest, or candidate identity"* (quoted in SDD-1's archive report §4.5).
- `compute-candidate-identity.mjs` no longer has a "(last line)" convention — it prints one line.
- The step omits the `config.yaml` mirror, so a pin bump performed exactly as documented leaves `verify:capability` red (G2).
- It omits `--check` entirely.

**Why this is a release-readiness finding and not typo-hunting:** step 7 is inside the **pin-bump procedure** — the repository's definition of a release event. `contracts/runtime-dependency.md` rule 6 ("Upgrade is explicit") makes a pin change a release of Drenyra Pi itself. So the documented release procedure currently tells an operator to hand-edit the trust anchor, contrary to the enforced rule.

### G4 — GAP. Checklist item 3 ("conformance vectors") has no executable implementation

`RELEASING.md:46` requires: *"**Conformance vectors** — install/doctor/pin verification vectors pass against the exact release candidate."*

Measured: no such command exists. `scripts/` contains `build.mjs`, `compute-candidate-identity.mjs`, `install-drenyra-ai.mjs`, `refresh-program-lock-facts.mjs`, `verify-capability-manifest.mjs`, `verify-package-files.mjs`, `verify-packed-install.mjs`, `verify-style.mjs`, and `lib/package-verify.mjs`. `package.json#scripts` has no `verify:conformance` or vector runner. `release-verify.yml` steps (lines 177-190) run only: frozen install, typecheck, test, `verify:package`, packed-install proof.

The requirement is *satisfied in practice* by `bun run test` (which includes `__tests__/doctor.test.ts`, `__tests__/pin.test.ts`, `__tests__/resolve.test.ts`, `__tests__/status.test.ts` and the real-repo capability guard), but the checklist names a gate that cannot be cited as run. Either the checklist item should name the real gates, or a vector runner should exist. That is a small, explicitly bounded decision.

### G5 — FALSIFIED. "`verify:capability` is missing from every automated gate" is not a real gap

This was a strong candidate and it does not survive measurement.

- Measured: **no workflow invokes `verify:capability`.** `grep` over `.github/` for `verify:capability` returns nothing; `ci.yml` runs `verify:package` + `verify-packed-install`; `style.yml` runs `verify:style`; `release-verify.yml` runs typecheck, test, `verify:package`, packed-install.
- But `__tests__/capability-manifest.test.ts:1393` — *"validates the real repository capability-manifest.yaml and projection surfaces"* — spawns the validator with **no arguments** (so it resolves the real repository root and real manifest), asserts `first.code === 0`, `second.code === 0`, and identical stdout. That test is inside `bun run test`, which is inside `verify:package`, which is inside `prepublishOnly`, CI, and `release-verify`.

**Conclusion:** the capability/snapshot guard is transitively gated at every automated boundary. The only residual is presentational (the release record cannot cite a discrete `verify:capability` step). **Recorded as falsified; must not appear as scope.**

The same falsification applies to `refresh:lock-facts --check`: it is not a workflow step, but its invariant is asserted by `__tests__/lock-facts.test.ts` inside `bun run test`. **The recovery mechanism is enforced; only its documentation is missing.**

### G6 — HAZARD. No commit boundary, with only destructive recovery available

Covered in §2.1 and §2.2. The relevant facts:

- `.git/logs/HEAD` ends at the commit producing `4d64f383`; no later entry exists.
- `packed-refs` holds exactly one tag (`v0.0.1-prealpha.1`) — no release tag exists for the current work.
- Local `main` is 5 commits ahead of the last known `origin/main` and no push is recorded after epoch `1786689580`.
- A deliberate tracked deletion (`themes/fiscal-operator/manifest.json`) is uncommitted.

SDD-1's `archive-report.md` W1 carries the delivery risk forward unresolved: change total **≈2,179 owned changed lines** vs a 1,050-line forecast, against a **400-line reviewer budget**; measured units PR 1 `failed` 466, PR 2 `failed` 892, PR 3 `passed` 1022, PR 4 `passed` 266; `size:exception` never requested and never used. The report's own words: *"The chained delivery exists as a recorded decision, not as commits."*

**This is the largest risk in the program and it is not a coding problem.** No amount of recovery documentation protects 2,179 lines of verified work that exist only as working-tree bytes on one machine.

**Bounded scope candidate:** treat the commit/push boundary as the change's first unit — or as a pre-change delivery step owned by the parent — with the maintainer's already-recorded decision applied (400-line budget enforced at **commit** boundaries, not by splitting authored work).

### G7 — GAP. The attempt ledger is clone-local, non-committable, and its recovery path is undocumented

**Measured:** the native SDD ledger lives inside `.git/`:

```text
.git/gentle-ai/sdd-runtime/v1/<change>/records/<sha256>.json
```

Observed change directories include `pi-capability-conformance`, `pi-sdd-010-participation`, `pi-operator-deboarding`/`pi-operator-onboarding`, `pi-sdd-030-routing-adapter`, `pi-sdd-040-adapter-boundary`, `pi-accounting-orchestration`, `monthly-close-integrity-hardening`. Record kinds observed include `attempt/begin`, `attempt/finish`, `objective/advance`, `objective/rescope`, and `objective/reset`.

Two consequences:

1. **Attempt continuity does not travel.** Ordinals, work-unit bounds, cumulative changed lines, and the objective revision chain are local to this clone's `.git`. `git push` cannot carry them. A fresh clone or a new machine begins with no attempt history.
2. **The recovery path exists but is undocumented in the repository.** A maintainer reset was performed with an explicit expected revision and actor: `gentle-ai sdd-attempt reset --expected-revision sha256:bd7eb7d769e72d94e37e188a75b80dd6c73b332be786ec53d80dc977511e2230`, actor `maintainer:dreamcoder08` (SDD-1 `apply-progress.md:317`), after the provider returned `blocked` / `maintainer_decision` / `decision_required: true` / `next_action: reset`. No repository document describes when a reset is warranted, what actor is required, or how to recover a `blocked` objective.

The ledger also carries a **recorded integrity incident**: `openspec/changes/archive/2026-09-08-pi-capability-conformance/archive-report.md:132-140` documents a prior `sdd-attempt reset` whose reason field **falsely claimed the user had "explicitly authorized" a budget override**. It was caught and corrected with genuine consent. So a reset is a consent-bearing, audit-visible operation with demonstrated failure history — precisely the class of thing that must be documented rather than improvised.

### G8 — GAP. The only active change's recorded state contradicts native status, and nothing reconciles them

**Measured divergence:**

| Surface | Value |
| --- | --- |
| `openspec/changes/pi-skills-memory-integration/state.yaml:4` | `status: blocked_superseded` |
| `state.yaml` `phases.tasks.status` | `blocked`, note: *"Blocked pending an approved, published upstream drenyra-ai contract — not something this change can resolve locally."* |
| `docs/architecture/program-lock-facts.json#activeChanges` | lists it as an **active** change |
| Parent-reported native status | `next: tasks` |

**Supporting measurements:** `openspec/changes/pi-skills-memory-integration/tasks.md` **does not exist** (ENOENT) despite native status reporting `next: tasks`; and `state.yaml` twice directs the reader to `upstream-contract-proposal.md` ("see upstream-contract-proposal.md"), which **also does not exist** (ENOENT). So the change's own state record cites a missing artifact.

**Why this belongs to *recovery*:** this is drift between persisted change state and native lifecycle state, and it is the one condition the repository's own canonical spec forbids outright. `openspec/specs/program-conformance/spec.md#REQ-CONF-005`:

> At most one OpenSpec change folder governing capability-conformance or reconciliation status MAY be open under `openspec/changes/` at a time. A superseded change MUST be archived, not left open alongside a newer one.

`state.yaml` self-describes the change as **superseded** while leaving it open — the exact condition `REQ-CONF-005` says MUST NOT persist.

**Why this may NOT belong to this change's *authority*:** resolving it requires either archiving a change whose blocker lives in an external repository (`drenyra-ai`) explicitly outside this repository's `allowedEditRoots`, or recording an authoritative interpretation that neither change "governs capability-conformance or reconciliation status" under `REQ-CONF-005`. Both are maintainer decisions. **This exploration did not open, read beyond the minimum, or advance `pi-skills-memory-integration` in any way; it only read `state.yaml` and checked for file existence, and makes no changes to it.**

### G9 — HAZARD (product decision). Release version discipline is self-contradictory

**Measured contradiction:**

| Surface | Value |
| --- | --- |
| `RELEASING.md:35-37` policy | pre-alpha `0.0.1-prealpha.x` **until the first contract is frozen**; the first release that freezes `package-contract` / `runtime-dependency` is **`0.1.0`** |
| `contracts/README.md` | both produced contracts **Frozen at 0.1**; §"Compatibility policy" item 5 confirms the freeze documents existing implementation |
| `ROADMAP.md` Phase 1 | `- [x] Freeze package-contract v0.1`, `- [x] Freeze runtime-dependency v0.1` — both checked |
| `package.json#version` | `0.0.1-prealpha.1` |
| `capability-manifest.yaml#repository.version` | `0.0.1-prealpha.1` |
| `docs/architecture/program-lock-facts.json#packageVersion` | `0.0.1-prealpha.1` |
| `CHANGELOG.md` Unreleased heading | *"runtime pin → 0.4.1 (release event, pre-alpha)"* — the 0.4.1 pin bump landed with **no version bump at all** |
| `RELEASING.md:38` | **"A runtime pin change is a release event: new pin, migration note, and package version bump — never a silent patch."** |

By RELEASING.md's own policy, the frozen contracts should already have produced `0.1.0`. By RELEASING.md's own rule, the 0.4.1 pin bump required a version bump and did not get one. The CHANGELOG records a rationale ("version stays pre-alpha per the current verification-only release posture") that **appears nowhere in RELEASING.md**.

**Release consequence (measured in the workflow):** `release-verify.yml` derives the future dist-tag from the version — `latest` for a stable version, `beta` for `-beta`/`-beta.x`, `next` for any other pre-release. So the unresolved version question changes the released artifact's channel.

**Guard coupling:** a version bump is not one edit. `verify-capability-manifest.mjs` requires `capability-manifest.yaml#repository.version === package.json#version`, and `__tests__/lock-facts.test.ts` requires `program-lock-facts.json#packageVersion === package.json#version`. A bump is therefore a three-surface edit plus a lock-fact refresh plus the identity mirror. This is the correct time to decide it.

### G10 — GAP. Stale release-facing prose inside exactly the surfaces a release depends on

Each item below is measured directly:

| Surface | Measured content | Ground truth |
| --- | --- | --- |
| `runtime/installer.ts:101-102` (doc comment on the live postinstall entry) | *"the pending-release branch below is live today"* | `runtime/pin.ts` `DEFAULT_PIN` = `createPin({ checksumSha256: "09df8d69…", state: "released" })` — the **released** branch is live; the comment misdescribes the module that performs the install |
| `.github/workflows/ci.yml:49-51` (test job comment) | *"devDependency file:./vendored/drenyra-ai-0.2.0.tgz"* | `package.json` `devDependencies.drenyra-ai` = `file:./vendored/drenyra-ai-0.4.1.tgz` |
| `CHANGELOG.md:31` | records adding "`themes/Drenyra.json`" | `themes/Drenyra.json` **does not exist** (ENOENT); `package.json#pi.themes` and `verify-package-files.mjs` name `themes/fiscal-operator/fiscal-operator-light.json` and `-dark.json` |
| `RELEASING.md:82-87` | pin-bump step 7 | see **G3** |
| `RELEASING.md:6` / `AGENTS.md` | `DEFAULT_PIN` = `drenyra-ai@0.4.1`, checksum `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600` | **CORRECT — verified.** `runtime/pin.ts` `RUNTIME_VERSION = "0.4.1"` and `DEFAULT_PIN.checksumSha256` match `AGENTS.md` and `RELEASING.md` exactly. `RELEASING.md:53-102` correctly explains that `dist/cmd/cli.js` was byte-identical across 0.3.0 → 0.4.0 → 0.4.1 and must not be "fixed". |
| Parent's reading list | `scripts/install-drenyra-ai.js` | does not exist; source is `scripts/install-drenyra-ai.mjs` |

**Pin/doctor readiness verdict (parent fact 6):** the pin, its checksum, `RUNTIME_VERSION`, `AGENTS.md`, `RELEASING.md`, and `contracts/runtime-dependency.md`'s reference table are **mutually consistent and correct**. `doctor` is fail-closed by construction (verdicts `verified` / `missing` / `pending-release` / `version-mismatch` / `checksum-mismatch`; `createPin` throws on a `released` pin with a `"pending"` checksum). **Nothing is missing for a first release on the pin/checksum axis.** The readiness deficit is documentation, version policy, and the commit boundary — not the pin.

### G11 — HAZARD. The stray `./~/` package-cache copy is untracked, un-ignored, and machine-local

**Measured here (independently of the parent's `du`/`find`):**

- `<repo>/~/.bun/install/cache/obug@2.1.4@@@1/package.json` exists inside the repository root; its content is third-party npm package metadata (`"name": "obug"`, MIT, author `Kevin Deng <sxzz@sxzz.moe>`, homepage `github.com/sxzz/obug`).
- A content search rooted at the repository root returned relative paths under `~/.bun/install/cache/…` for `obug`, `picocolors`, `pathe`, `magic-string`, `tinyexec`, `tinyglobby`, `fdir`, `chai`, `ajv@8.20.0`, `ajv-formats`, `json-schema-traverse`, `fast-deep-equal`, `@types/node@26.2.0`, `@standard-schema/spec`, `@jridgewell/sourcemap-codec`, `@T@62b7bc5596c78e78` — i.e. a full bun package cache, consistent with the parent's "misquoted shell command" diagnosis.
- **Not ignored:** `.gitignore` was read in full; it contains no `~` or `~*` entry. So `git status -uall` enumerates this tree and `git add -A` / `git add .` would stage it.
- **Not a nested repository:** a search for `.git/**` under `<repo>/~` returned no matches, so git reports thousands of individual untracked entries rather than one opaque directory.

`UNVERIFIED-HERE`: the parent's measurements — **114 MB, 3,942 files**.

**Why this is a release-readiness hazard, not housekeeping:**

1. `git add -A` before the delivery commit would stage a machine-local third-party cache into the published repository.
2. `git status -uall` becomes unusable for scope attribution — the very technique `CONTRIBUTING.md` and every SDD phase rely on.
3. The native `sdd-attempt acquire`/`settle` digest folds an eligible-untracked inventory; machine-local cache bytes inflate it and can change it for reasons unrelated to the work.
4. It is reproducible: the same shape re-appeared as an SDD-1 repair target.

**Correct disposition (recommended, not executed):** remove it as its own explicitly authorized unit — `rm -rf` on the **absolute** path `…/drenyra-pi/~` — and add a defensive `~*` (or `~`) entry to `.gitignore` so a repetition cannot reach a commit. **This explore phase did not delete it, per its authority boundary.** Note the hazard in the remediation itself: `rm -rf ~` would be catastrophic, so the command must use the absolute repository path.

### G12 — HAZARD (product decision). `postinstall` silently no-ops when the compiled installer is absent

**Measured** (`package.json#scripts.postinstall`, verbatim):

```
node -e "const{existsSync}=require('node:fs');const{spawnSync}=require('node:child_process');existsSync('dist/scripts/install-drenyra-ai.js')?process.exit(spawnSync(process.execPath,['dist/scripts/install-drenyra-ai.js'],{stdio:'inherit'}).status??1):undefined"
```

If `dist/scripts/install-drenyra-ai.js` is missing, the ternary yields `undefined` and the process **exits 0 with no output**. `dist/` is gitignored (`.gitignore`), so a fresh clone has no compiled installer until `node scripts/build.mjs` runs. `scripts/install-drenyra-ai.js` does not exist, so the wrapper cannot run from source either.

**Consequence:** in a source clone, `bun install` can complete successfully while the pinned runtime was never installed and no diagnostic was printed. This is a fail-open path at the one boundary whose entire doctrine is fail-closed (`contracts/runtime-dependency.md` rules 5-6; `docs/architecture/trust-model.md` "Fail-closed default").

**Why it is a decision, not a bug fix:** the silent skip exists for a reason. CI and `release-verify` run `bun install --frozen-lockfile` **before** the build step, so a hard failure would break the frozen install on a clean checkout. RELEASING.md warns about the *inverse* failure (step 5: a stale `dist` installer clobbering a freshly linked runtime) but says nothing about this one. Trade-off to surface, not resolve here.

### G13 — GAP (governance). `REQ-CONF-005` may forbid this change from existing alongside the active change

`openspec/specs/program-conformance/spec.md#REQ-CONF-005` limits **one** open change folder that "governs capability-conformance or reconciliation status." A recovery-and-release-readiness change plausibly does govern conformance status: it would touch `RELEASING.md`, `docs/architecture/program-lock-facts.md`, plausibly `openspec/config.yaml`, and possibly `capability-manifest.yaml` (for the version string). Any of those bring it inside the requirement's scope on a reasonable reading.

So the change's own legitimacy under canonical spec is a **human decision with three resolutions**, none of which this phase may take:

- (a) archive `pi-skills-memory-integration` as superseded first (satisfying `REQ-CONF-005` and G8 together);
- (b) bind SDD 6's scope to exclude conformance/reconciliation status surfaces — which conflicts with G3/G9, since both need those surfaces;
- (c) record an explicit interpretation that neither change governs `REQ-CONF-005`'s subject matter.

---

## 4. Falsified candidates (investigated, not scope)

Recorded so the proposal does not resurrect them.

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| `verify:capability` is an ungoverned guard | **FALSIFIED** | `__tests__/capability-manifest.test.ts:1393` spawns it against the real repo and requires exit 0, inside `bun run test` |
| `refresh:lock-facts --check` is ungoverned | **FALSIFIED** | `__tests__/lock-facts.test.ts` asserts the same invariant inside `bun run test` |
| The pin or checksum is wrong / unreconciled | **FALSIFIED** | `runtime/pin.ts` `RUNTIME_VERSION`/`checksumSha256` match `AGENTS.md`, `RELEASING.md`, and `contracts/runtime-dependency.md` exactly |
| Packed-install proof is aspirational | **FALSIFIED** | `scripts/verify-packed-install.mjs` exists, does pack → install → pi-manifest check → extension-factory load under Node → direct postinstall execution, and runs in CI and `release-verify` |
| `doctor` is not fail-closed | **FALSIFIED** | five verdicts in `runtime/doctor.ts`; `createPin` throws on `released` + `"pending"` checksum; `contracts/runtime-dependency.md` documents the six-step verification procedure |
| Fiscal mission recovery is missing | **FALSIFIED** | `REQ-MISS-007` + `lib/mission-store.ts#recoverDurableMissions` + `__tests__/mission-store.test.ts` (incl. corrupt-store fail-closed) and `REQ-CMD-007` resume recovery |
| `prepublishOnly` does not gate the build | **FALSIFIED** | `prepublishOnly` = `typecheck && verify:package && verify-packed-install`; `verify:package` = `build && test && verify-package-files` |
| A new "recovery" capability row can express this work | **FALSIFIED / BLOCKED** | `MASTER_CAPABILITIES` in `verify-capability-manifest.mjs` is a closed 10-name list inherited from the master (unknown names → violation), and `__tests__/lock-facts.test.ts` hard-asserts `8 implemented / 2 partial / 0 planned`. A recovery row would need master authority and would break both guards |

---

## 5. Proposed scope boundary

### 5.1 Recommended in scope (candidate — for human confirmation)

Ordered so that the highest-value, lowest-risk item comes first.

| # | Unit | Kind | Why bounded |
| --- | --- | --- | --- |
| **U1** | **Establish the commit/push boundary** for the verified SDD 1–5 work, applying the maintainer's recorded decision (400-line budget enforced at commit boundaries: PR 1 466, PR 2 892, PR 3 1022, PR 4 266, archive 800). | delivery | Creates the only recovery point that makes every other unit meaningful. Changes no source. Cannot be performed by an SDD phase. |
| **U2** | **Publish the recovery sequence once, durably, and discoverably**: the trigger set (open a change, archive a change, mutate any `PARTICIPATION_PATHS_V1` path, run any formatter/autofix) and the ordered pair (`refresh:lock-facts` → rewrite `openspec/config.yaml#current_test_state.candidate_identity` → `--check` → full verification), reachable from `openspec/README.md` and `RELEASING.md`. | docs | Extends `docs/architecture/program-lock-facts.md`; adds no behavior. |
| **U3** | **Repair `RELEASING.md`**: step 7 must invoke the sanctioned generator (never hand-edit an identity/digest), add the mirror and `--check`, and checklist item 3 must name the gates that actually run (`bun run test`, `verify:package`, `verify-packed-install`, `verify:capability`) or a vector runner must be specified. | docs | Two bounded edits to one file; no code. |
| **U4** | **Resolve the version-discipline contradiction** and make the three version-bearing surfaces consistent — only after a human picks the version. | decision + bounded edit | `package.json`, `capability-manifest.yaml#repository.version`, `program-lock-facts.json#packageVersion` + refresh + mirror. |
| **U5** | **Correct the stale release-facing prose** (`runtime/installer.ts` comment, `ci.yml` test-job comment, `CHANGELOG.md` theme entry). | docs | Three one-line edits; no behavior. |
| **U6** | **Remove the stray `./~/` tree and defend against recurrence** (`.gitignore` entry). | destructive cleanup | Requires explicit authorization; no tracked file involved. |
| **U7** *(optional, only if U2/U3 are judged insufficient)* | **One executable guard** that fails when the recovery sequence and the enforced coupling diverge — e.g. a test asserting that the documented commands exist in `package.json#scripts` and that the mirror is present in the documented flow. | test | At most one new test file. Explicitly optional: a test that "fails when docs drift" is easy to over-engineer. |

**Ceiling:** if U1–U6 exceed a comfortable reviewer budget, U1 is the unit that matters. Everything else is discoverability.

### 5.2 Recommended out of scope (explicit)

| Excluded | Reason |
| --- | --- |
| Resolving `pi-skills-memory-integration` (state, archive, tasks) | Blocked on a kernel contract in the external `drenyra-ai` repository, outside this repository's `allowedEditRoots`. Do not open, edit, or advance it. Its disposition is a maintainer decision (**D3**). |
| Any change to the 10-name `MASTER_CAPABILITIES` set, or to the `8/2/0` capability-state counts | Requires master authority; breaks `verify-capability-manifest.mjs` and a hard assertion in `__tests__/lock-facts.test.ts` simultaneously. |
| Any change to `contracts/**` or `contracts/SHA256SUMS.json` | Frozen and checksum-covered; governed by `contracts/README.md`'s compatibility policy. |
| Any pin upgrade (`drenyra-ai@0.4.1` → newer) | A release event under `contracts/runtime-dependency.md` rule 6, requiring changelog entry, migration note, re-run of `doctor`/conformance, and a version bump. Not this change. |
| Publishing to npm, adding `publishConfig`, or enabling the publish step | `RELEASING.md` forbids it until an explicit, recorded human decision. "Release readiness" here means *verified gate + honest docs*, not *publishing* (**D8**). |
| Fiscal/operational recovery: `REQ-MISS-007`, `REQ-CMD-007`, `recoverDurableMissions`, resume recovery | Already implemented, specified, and tested — see §1 and the falsification table. |
| Engram integration, model-routing API (G30), full-tree receipt expansion, typed `verificationLevel` generator support, batch manifest back-fill | Already recorded as deferred follow-ups in `docs/architecture/capability-conformance-matrix.md` and the `2026-09-08` archive report. |
| Rewriting `PARTICIPATION_PATHS_V1` or replacing the candidate-identity algorithm | The algorithm is design `§7.2`-derived, test-covered (A/M/D classification, canonical manifest, normalization stability), and the allowlist is deliberately immutable. |
| Editing `.git/**`, the attempt ledger, or performing `sdd-attempt reset` | Consent-bearing, audit-visible, and outside SDD phase authority (**D7**). |
| Committing, pushing, tagging, opening PRs, or staging anything from inside this SDD | `CONTRIBUTING.md`; the archive report's own precedent (delivery is "a separate, human-approved decision"); and this phase's instruction never to commit. |
| Deleting any legacy surface or archived artifact | `REQ-CONF-008` retention bar; `legacy-capability-surface-inventory.md` retains all 18 candidates. |
| Making `postinstall` fail closed | Real trade-off against frozen-install CI ordering — decision first (**D5**). |

### 5.3 Is a separate SDD warranted, or is this an amendment to existing surfaces?

**The honest answer: warranted, but smaller than the label suggests — and the label is the problem.**

Arguments that it is a genuine separate change:

1. It is the only remaining local SDD in the declared 6-change program; SDD-1's exploration recorded that *"the actual six-change list and their dependency boundaries are not present in this repository; only the user's ordering is authoritative here."*
2. The gaps are **unclaimed by any canonical spec**. Measured: `grep` for requirement headings matching `Recovery|Release|Resume|Commit|Delivery|Rollback|Drift` across `openspec/specs/**` returns exactly two — `mission-protocol/spec.md#REQ-MISS-007` and `commands/spec.md#REQ-CMD-007` — both fiscal/operational, neither about harness process or release.
3. It **cannot** be expressed as an amendment to the capability surface: there is no capability row it could occupy (falsification table, last row), and there are no canonical spec domains for release or process recovery (11 domains verified: program-conformance, contracts, chains, authority, routing-adapter, skills-prompts-themes, commands, agents, evidence-graph, scope-binding, mission-protocol).
4. It spans four distinct surfaces — release document, program doc, `openspec/` entry doc, and version policy — plus one destructive cleanup and two product decisions. That is more than an amendment.

Arguments to be wary:

1. **The mechanism is already enforced.** The recovery pair fails closed via `__tests__/lock-facts.test.ts` and `__tests__/capability-manifest.test.ts:1393`; nothing is broken. Most of G1/G2/G3/G4/G10 is *documentation and prose*. A reviewer could fairly say "this is a four-file docs fix and two decisions, not an SDD."
2. **The highest-value action is not an SDD phase.** U1 (the commit boundary) is delivery. If the human handles U1 as a delivery step and U4 as a decision, what remains is U2+U3+U5+U6 — plausibly one bounded change, not a multi-unit program.
3. **`REQ-CONF-005` may forbid co-existence** with the active change (G13).
4. **Scope-inflation risk is severe.** "Recovery and release readiness" can absorb the entire program — Engram integration, npm publication, the pin upgrade, capability promotion, the `pi-skills-memory-integration` blocker. Every one of those is out of scope above.

**Recommendation:** proceed as a **separate but deliberately small** change, **conditional on D1** (the commit boundary being handled first or as its first unit) and **D6** (`REQ-CONF-005`). If the human answers D1 as "handle the commit boundary outside SDD" and D6 as "do not open a second change folder," then this is best delivered as an amendment to `RELEASING.md` + `docs/architecture/program-lock-facts.md` + `openspec/README.md` plus an authorized `./~/` removal — and this change should be closed as superseded rather than inflated to justify itself. **Do not pad the scope to fill the "SDD 6" slot.**

---

## 6. Product decisions a human must confirm before a proposal can be written

| # | Decision | Options | Why it blocks the proposal |
| --- | --- | --- | --- |
| **D1** | **Delivery boundary.** Is the verified SDD 1–5 work committed and pushed **before** this change proceeds, and with what chaining? | (a) U1 as this change's first unit; (b) parent-owned delivery step outside SDD; (c) defer. Maintainer decision already recorded: keep work intact, enforce 400 lines at **commit** boundaries (PR 1 466 / PR 2 892 / PR 3 1022 / PR 4 266 / archive 800). | Without a commit, every recovery item is hypothetical: `git checkout -- .` still destroys ≈2,179 verified lines and resurrects the deliberate `themes/fiscal-operator/manifest.json` deletion. Also, local `main` is 5 commits ahead of the last known `origin/main` with no push recorded since epoch `1786689580`. |
| **D2** | **Version.** `0.1.0` (RELEASING.md's own policy, since `package-contract` and `runtime-dependency` are frozen at 0.1) or `0.0.1-prealpha.2` (the CHANGELOG's recorded posture)? | as stated | Determines the derived dist-tag (`latest` vs `next`), is a three-surface edit (`package.json`, `capability-manifest.yaml`, `program-lock-facts.json`) plus refresh plus mirror, and resolves G9. |
| **D3** | **`pi-skills-memory-integration`.** Archive as superseded, or keep open blocked? | (a) archive as superseded (satisfies `REQ-CONF-005`; its `state.yaml` already says `blocked_superseded`); (b) keep open and record the external blocker at program level; (c) defer. | G8 + G13. This phase may not decide it, and it also determines whether a second change folder may legally exist. |
| **D4** | **`./~/`.** Authorize removal? Add a `.gitignore` guard? | (a) `rm -rf` on the absolute repository path + `.gitignore` entry; (b) `.gitignore` only; (c) leave it. | Destructive and untracked; inflates the SDD attempt inventory digest; `git add -A` would stage a machine-local cache into a release commit. Parent-measured 114 MB / 3,942 files (`UNVERIFIED-HERE`). |
| **D5** | **`postinstall`.** Keep the silent skip, or fail closed when `dist/scripts/install-drenyra-ai.js` is absent? | (a) keep (CI installs before build); (b) fail closed and move CI's `bun install` after the build; (c) add a loud warning but exit 0. | A fail-open at the boundary whose doctrine is fail-closed. The current behavior means a source-clone `bun install` can silently install no runtime. |
| **D6** | **`REQ-CONF-005`.** May a second change folder be open? | (a) archive the active change first; (b) bind SDD 6's scope to exclude the named surfaces; (c) record an explicit interpretation. | Determines whether this change may exist at all under canonical spec, and constrains U3/U4 (which need `openspec/config.yaml` and possibly `capability-manifest.yaml`). |
| **D7** | **Authority over identity-bearing surfaces.** May the change touch `openspec/config.yaml`, `package.json`, `capability-manifest.yaml`, `RELEASING.md`, `docs/architecture/program-lock-facts.md`, and `__tests__/**` — and will the "refresh is a post-step of every unit" rule be honored as the generalized rule states? | as stated | `openspec/config.yaml`, `package.json`, `capability-manifest.yaml`, `ROADMAP.md`, `contracts/README.md`, and the two guard files are all members of `PARTICIPATION_PATHS_V1`; every write to them moves the candidate identity and forces the recovery pair. |
| **D8** | **Publication posture.** Confirm SDD 6 stops at *verified gate + honest docs* and does **not** enable npm publication, add `publishConfig`, or add a publish step. | as stated | `RELEASING.md` requires an explicit recorded decision; the ROADMAP item "Package released as `drenyra-pi` on npm" stays unchecked. |
| **D9** | **"Conformance vectors" (G4).** Implement a vector runner, or rewrite checklist item 3 to name the gates that actually run? | (a) rewrite the checklist item; (b) build a runner; (c) both. | Bounded, cheap, and it removes an uncitable gate from the release record. |
| **D10** | **`pi-skills-memory-integration`'s missing artifacts.** `state.yaml` cites `upstream-contract-proposal.md` (absent) and native status expects `tasks.md` (absent). Record the absence as-is, or require the missing artifact before any status change? | as stated | Prevents a status change from silently laundering a missing artifact into "done". Belongs with D3. |

---

## 7. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **Creating this exploration's directory makes the lock-facts guard red.** Adding `openspec/changes/pi-recovery-release-readiness/` changes the discovered `activeChanges` set, so `--check` and `__tests__/lock-facts.test.ts` fail until the recovery pair runs. | High (functional, immediate) | Either authorize the recovery pair now (`bun run refresh:lock-facts` → rewrite `openspec/config.yaml#current_test_state.candidate_identity` → `--check` → full verification), or delete the directory to restore the prior state — which is exactly the repair SDD-1's PR 1.5 performed. Do not leave it half-done. **PREDICTED, NOT MEASURED** (no shell tool here). |
| R2 | **Recovery-by-revert destroys verified work.** `git checkout -- .`, `git stash`, or `git reset --hard` would discard ≈2,179 lines of verified SDD work and resurrect the deliberate `themes/fiscal-operator/manifest.json` deletion. | Critical | U1 first. Until then, forbid worktree-wide revert commands and treat this exploration's own claims as advisory. |
| R3 | **Hand-editing the trust anchor.** Following `RELEASING.md` step 7 as written means hand-editing `candidateIdentity` / digests, which fails `__tests__/lock-facts.test.ts` ("re-derives the recorded candidate identity via the CLI" asserts `derived === facts.candidateIdentity`). | High | U3 (fix the document) + U2 (name the generator as the only path). |
| R4 | **Scope inflation from a broad title.** "Recovery and release readiness" can absorb Engram integration, npm publication, the pin upgrade, capability promotion, and the `pi-skills-memory-integration` blocker. | High | The explicit out-of-scope table in §5.2 and the D1–D10 gate. Recommend refusing any scope that is not U1–U7. |
| R5 | **Silent red state.** A half-completed recovery pair (refresh applied, mirror not) leaves `verify:capability` red with no other symptom. | Medium | U2 documents the pair as an ordered, indivisible operation, with the reason: the mirror is normalization-exempt, so the second step does not move the identity. |
| R6 | **`rm -rf ./~` typo hazard.** `rm -rf ~` (unescaped) is catastrophic. | Critical | D4 must specify the absolute repository path, never a glob or `~` expansion. |
| R7 | **Third-party cache reaches the release commit.** `git add -A` with an un-ignored 3,942-file `./~/` tree stages machine-local npm cache content. | High | D4; add the `.gitignore` guard in the same unit. |
| R8 | **Two open change folders under `REQ-CONF-005`.** | Medium | D6. |
| R9 | **Evidence-integrity risk for the verifier.** This exploration could not run any command, so `UNVERIFIED-HERE` items (worktree counts, `./~/` size, and the R1 red-state prediction) must be independently measured by the next phase before they are cited as fact. | Medium | §0 method note; the parent should have the verify phase re-run every command-shaped claim. |
| R10 | **Attempt-ledger fragility.** The ledger is in `.git/` and cannot travel; a reset is consent-bearing and has a recorded incident in which a reset's reason falsely claimed authorization. | Medium | D7; document when a reset is warranted and which actor is required. |

---

## 8. Artifacts read for this exploration

Repository documents: `AGENTS.md`, `README.md`, `ROADMAP.md`, `RELEASING.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/intended-usage.md`, `docs/architecture/program-lock-facts.md`, `docs/architecture/program-lock-facts.json`, `docs/architecture/legacy-capability-surface-inventory.md` (retention/recovery sections), `docs/architecture/capability-conformance-matrix.md` (projection + deferred follow-ups), `docs/architecture/trust-model.md`, `capability-manifest.yaml`, `contracts/README.md`, `contracts/runtime-dependency.md`.

Configuration and gates: `package.json`, `openspec/config.yaml`, `openspec/README.md`, `openspec/specs/program-conformance/spec.md`, `type: module` / `tsconfig` implied by `openspec/config.yaml`, `.gitignore`, `.prettierignore`, `.github/workflows/ci.yml`, `.github/workflows/style.yml`, `.github/workflows/release-verify.yml` (gate steps), `.github/workflows/release-verify.yml` (authority-check region).

Scripts and runtime: `scripts/refresh-program-lock-facts.mjs`, `scripts/compute-candidate-identity.mjs`, `scripts/verify-package-files.mjs`, `scripts/verify-capability-manifest.mjs`, `scripts/verify-packed-install.mjs`, `scripts/install-drenyra-ai.mjs` (the real postinstall source; `scripts/install-drenyra-ai.js` does not exist), `runtime/pin.ts`, `runtime/installer.ts`, `runtime/resolve.ts`, `runtime/checksum.ts`, `runtime/context.ts`.

Tests: `__tests__/lock-facts.test.ts` (full), `__tests__/capability-manifest.test.ts` (guard CLI + real-repo run), `__tests__/mission-store.test.ts` and `__tests__/extension-mission-commands.test.ts` (recovery coverage), `__tests__/refresh-program-lock-facts.test.ts` (generator coverage).

OpenSpec change history: `openspec/changes/archive/2026-09-11-pi-capability-conformance/{archive-report.md, exploration.md, tasks.md, apply-progress.md, verify-report.md}` (selected regions), `openspec/changes/archive/2026-09-08-pi-capability-conformance/archive-report.md` (ledger-integrity incident, deferred follow-ups), `openspec/changes/pi-skills-memory-integration/{state.yaml, preproposal.md}` (read-only, not advanced).

Git internals (read-only): `.git/HEAD`, `.git/refs/heads/main`, `.git/packed-refs`, `.git/logs/HEAD`, `.git/logs/refs/remotes/origin/main`, and the existence inventory of `.git/gentle-ai/sdd-runtime/v1/**/records/*.json`.

---

## 9. Handoff to proposal

The proposal phase should:

1. Obtain the D1–D10 answers first. **Do not write a proposal until D1 and D6 are answered** — D1 determines whether the change has any foundation, and D6 determines whether it may exist.
2. Measure the R1 prediction before any artifact is written beyond this one: run `node scripts/refresh-program-lock-facts.mjs --check` and `bun test __tests__/lock-facts.test.ts`, and record both results verbatim.
3. Record `git status --short` (and `git status -uall` only if `./~/` has been removed) before any write, and attribute pre-existing dirty work explicitly — the technique SDD-1's archive report §6 used.
4. Bound the change to the confirmed subset of U1–U7, with the out-of-scope table from §5.2 carried forward verbatim so the boundary cannot drift.
5. Treat U2/U3/U5 as documentation-only units and say so in the reviewer-facing summary, so the reviewer budget is spent on U1 and U4 rather than on prose.

**This exploration writes no proposal, no spec, no design, no tasks, and changes no source, test, contract, spec, config, or lock fact. It does not open, edit, or advance `pi-skills-memory-integration` or any archived change. It does not delete `./~/` or anything else. It commits nothing.**
