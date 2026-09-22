# Proposal — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6 in the Drenyra Shell program)
**Phase:** proposal (openspec artifact store, file-backed authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Inputs:** `exploration.md` (447 lines), `preproposal.md` (gate **CLOSED**, status `confirmed`)
**Authority:** the preproposal's confirmed decision record §5. The human was **not** interviewed for this proposal; no settled decision is re-opened.
**Writes performed by this phase:** this file only. No source, test, contract, spec, config, lock fact, or other change artifact was written. Nothing was committed.

**One-sentence verdict.** What remains of SDD 6 is a **documentation repair across four release-facing files, one version bump across three coupled surfaces, and one small behavioural change to `postinstall`** — plus the recovery pair after every unit that writes an allowlisted path. It is small on purpose. The proposal declines to inflate it to fill the "SDD 6" slot, and it records the delivery, the `./~/` cleanup, and the superseded-change archive as **already delivered**, not as re-planned scope.

---

## 1. Intent

Three defects, all in the release-facing surface, none of them a missing mechanism:

1. **The recovery sequence is enforced but undocumented.** The sequence `bun run refresh:lock-facts` → rewrite the normalization-exempt mirror `openspec/config.yaml#/current_test_state/candidate_identity` → `--check` → full verification fails closed through `__tests__/lock-facts.test.ts` (`activeChanges must exactly match` at `__tests__/lock-facts.test.ts:261`; `packageVersion must equal package.json version` at `:156-158`) and through the real-repository capability guard inside `bun run test`. The *rule that governs every future change in this repository* — when the pair is mandatory — currently lives only in an **archived** change's task list (`openspec/changes/archive/2026-09-11-pi-capability-conformance/tasks.md`). `docs/architecture/program-lock-facts.md` (the document titled *"Refresh the participant checkpoint"*) states the command but never the trigger set and never mentions the mirror. `openspec/README.md` and `RELEASING.md` do not mention lock facts at all.
2. **The release procedure instructs a forbidden hand-edit.** `RELEASING.md:82-87` (pin-bump step 7) tells the operator to hand-set `candidateIdentity` and two digests; the repository's own contract forbids hand-editing a checksum, digest, or candidate identity, and the documented sequence omits the mirror and `--check`, so a pin bump performed *exactly as documented* leaves `verify:capability` red.
3. **The release record is not honest about what ran or what version exists.** `RELEASING.md:46` requires a "conformance vectors" gate that no script or workflow implements (falsified candidates table, exploration §4). `RELEASING.md`'s own version policy (`RELEASING.md:35-38`) implies `0.1.0` because both produced contracts are frozen, while all three version-bearing surfaces still read `0.0.1-prealpha.1`. Several release-facing comments and one CHANGELOG line name things that no longer exist.

**Why now.** This is the last local SDD of the program, and the program's own history proves the recovery pair is not a theoretical concern: it was forced **four** times, the fourth by the *routine act of opening an SDD change directory* (preproposal §1). Every future change pays this cost. Documenting it once is the cheapest durable improvement available.

**Why this is worth doing as its own change rather than an unrecorded edit.** The gaps are unclaimed by any canonical spec (no `Recovery|Release|Commit|Rollback` requirement exists in `openspec/specs/**` outside the already-implemented `REQ-MISS-007` / `REQ-CMD-007`), and this change touches the release document, the program document, the SDD entry document, and the version policy at once. It has no capability row it could occupy (`MASTER_CAPABILITIES` is a closed 10-name list).

**Product outcome.** An operator who opens, applies, or archives a change, or who runs any formatter, can find the mandatory recovery sequence in one place, follow it, and end green — without reading an archived task list. A maintainer performing a release follows a procedure that invokes the sanctioned generator, cites only gates that actually run, and states a version consistent with the repository's own policy.

---

## 2. Baseline measured at proposal time

Read-only inspection by this phase. Command-shaped claims that require a shell are marked **inherited** (from `preproposal.md`, itself parent-measured) — this phase has no execution tool.

| Surface | Measured value | Source |
| --- | --- | --- |
| Discovered active changes | `["pi-recovery-release-readiness"]` only | `docs/architecture/program-lock-facts.json#/activeChanges`, read here |
| `headSha` | `deddc86090d1914781ebf3c071a1de91f3c089fd` | same file, read here |
| `candidateIdentity` | `dirty-sha256:70ca1dfa4faf05c7190400ba52d95c3c9e3852feb00c9ff6f4ddb0a13b0cd45d` | same file, read here |
| `openspec/config.yaml` mirror | same value as `candidateIdentity` (mirror currently agrees; tree consistent) | `openspec/config.yaml:41`, read here |
| `packageVersion` | `0.0.1-prealpha.1` | `program-lock-facts.json#/packageVersion`, `package.json:3`, `capability-manifest.yaml:7` |
| Full verification | 767 pass / 0 fail, `--check` current, `verify:capability` OK | **inherited** (preproposal §1, measured after the directory-opening recovery) |
| Delivery state | local `main` fast-forwarded through PR #70 → PR #69; merge commit `70d87ac` on protected `main` | **inherited** (preproposal §5, D1 executed) |

**Note for the next phase.** The preproposal recorded identity `dirty-sha256:2011db34…`; the current value is `dirty-sha256:70ca1dfa…`. The delivery created commits and moved the tracked-entry classification, so the identity legitimately advanced afterwards. The verify phase must re-measure every inherited row before citing it.

---

## 3. Already delivered — recorded as context, not re-planned

These belong to this change's subject matter and landed early. The proposal accounts for them and re-plans none of them.

**U1 — commit/push boundary (D1, executed).** Two chained PRs merged to protected `main`: PR #70 (`feat/capability-conformance-guard` → `sync/accumulated-main`, ten commits by work area, all four required checks green) and PR #69 (`sync/accumulated-main` → `main`, merge commit `70d87ac`). The entire accumulated local history — SDD 1's verified work, the capability guard, the legacy inventory under `docs/architecture/legacy-capability-surface-inventory.md`, the lock-fact machinery, and the superseded archive — is on the remote. This was the program's single critical risk (exploration R2: worktree-wide revert would have destroyed ≈2,179 verified lines **and** resurrected a deliberate deletion); it is now closed.

**Release gate repair (part of the same delivery).** The required `package` check had been failing on **every** branch, blocking all merges. Root cause: `postinstall` runs a nested `npm install` whose `cwd` is inside the installed package, so npm reads drenyra-shell's published manifest, walks its devDependency tree, and npm 10.9.x crashes in Arborist `#loadPeerSet` (`Cannot read properties of null (reading 'edgesOut')`). Reproduced by pinning npm 10.9.0 locally; fixed with `--legacy-peer-deps`; verified on npm 10.9.0 and 11.19.0. In addition, `scripts/verify-packed-install.mjs` was swallowing npm's captured output while its downstream probes printed with `stdio: "inherit"`, so the gate reported a consequence it could not explain; it now surfaces npm's diagnostics verbatim. **This is release-readiness work, and it is done.**

**U6 — stray `./~/` tree (D4, executed).** Verified here: `<repo>/~/.bun/install/cache/…` no longer exists, and `.gitignore:34-35` carries the `~*` guard with a comment naming the accidental literal-tilde artifact. Nothing remains.

**D3 / D6 / D10 — superseded change (executed).** `pi-skills-memory-integration` was archived as superseded: it now lives at `openspec/changes/archive/2026-09-11-pi-skills-memory-integration/` with a `supersession-record.md` that records `tasks.md` and `upstream-contract-proposal.md` as **explicit absences**, so no later status change can launder them into "done". `REQ-CONF-005` (`openspec/specs/program-conformance/spec.md`) is satisfied: exactly one change folder governs conformance status, and it is this one. Do not reopen, edit, or advance the archived change.

---

## 4. Scope — the confirmed units

Ordered by review value, not by file count. "Allowlisted?" = whether the unit writes a member of `PARTICIPATION_PATHS_V1` (`scripts/compute-candidate-identity.mjs:45-67`), which forces the recovery pair per D7.

| # | Unit | Content | Allowlisted? | Recovery pair after |
| --- | --- | --- | --- | --- |
| **U2** | Publish the recovery sequence **once**, durably and discoverably | State the **trigger set** and the **ordered pair** in exactly one canonical place — `docs/architecture/program-lock-facts.md`, the document that already owns the command — and make it reachable by link from `openspec/README.md` and `RELEASING.md`. Trigger set to state: (i) opening a change, (ii) archiving a change, (iii) mutating any `PARTICIPATION_PATHS_V1` path — including via a formatter, autofix, or another session — and (iv) the ordinary case that produced event 4 of the program's recovery history. Ordered pair to state: `bun run refresh:lock-facts` → rewrite `openspec/config.yaml#/current_test_state/candidate_identity` → `node scripts/refresh-program-lock-facts.mjs --check` → full verification, with the reason ordering matters. | no | no (the `.md` is not allowlisted; the `.json` is untouched) |
| **U3** | Repair `RELEASING.md` (D9) | (a) Pin-bump **step 7** (`RELEASING.md:82-87`) must invoke the sanctioned generator instead of instructing a hand-edit of `candidateIdentity`/digests, and must add the mirror and `--check`. (b) **Checklist item 3** (`RELEASING.md:46`) must name the gates that actually run — `bun run test`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`, `bun run verify:capability` — replacing the uncitable "conformance vectors" gate. No vector runner is built. | no | no |
| **U4** | Version **`0.1.0`** (D2) | Three coupled surfaces plus the derived record: `package.json:3`, `capability-manifest.yaml:7` (`#/repository/version`), `program-lock-facts.json#/packageVersion` — then `bun run refresh:lock-facts` (which regenerates `capabilityStates.digestSha256`, `headSha`, and the generated fields) and the mirror rewrite. A minimal `CHANGELOG.md` entry records the bump and states that publication remains off. | **yes** — `package.json`, `capability-manifest.yaml` | **yes** |
| **U5** | Correct stale release-facing prose (G10) | (a) `runtime/installer.ts:113-114` — the doc comment claims *"the pending-release branch below is live today"*; the pin is `state: "released"`, so the **released** branch is live. (b) `.github/workflows/ci.yml:51` — names `devDependency file:./vendored/drenyra-ai-0.2.0.tgz`; the actual dependency is `0.4.1`. (c) `CHANGELOG.md:31` — records adding `themes/Drenyra.json`, which does not exist; the real themes are `themes/fiscal-operator/fiscal-operator-{light,dark}.json`. | no | no |
| **D5** | `postinstall` warns when the compiled installer is absent | `package.json:44` currently exits **0 with no output** when `dist/scripts/install-drenyra-ai.js` is missing, so a source clone can complete `bun install` without installing the pinned runtime and without a diagnostic. Requirement: print a **visible warning** and **keep exit 0** — no fail-closed, because CI and `release-verify` run `bun install --frozen-lockfile` **before** the build. | **yes** — `package.json` | **yes** |
| **U7** *(optional)* | Executable docs-drift guard | **Declined** — see §5.3. | — | — |

**Change-folder lifecycle note.** Opening this change folder (already done) and later archiving it both move the generated `activeChanges` field, which alone makes `--check` stale. The trigger set U2 publishes therefore names change-folder lifecycle events explicitly, because that is the case that fired with no mistake and no tooling failure.

---

## 5. Out of scope — binding

### 5.1 Carried verbatim from `exploration.md` §5.2 (restricted to what survives D8)

| Excluded | Reason |
| --- | --- |
| Resolving `pi-skills-memory-integration` (state, tasks, artifacts) | Blocked on a kernel contract in the external `drenyra-ai` repository. Its disposition was decided (D3) and **executed**; the archive and `supersession-record.md` are the outcome. Do not reopen. |
| Any change to the 10-name `MASTER_CAPABILITIES` set or the `8/2/0` capability-state counts | Requires master authority; would break `scripts/verify-capability-manifest.mjs` and a hard assertion in `__tests__/lock-facts.test.ts` simultaneously. |
| Any change to `contracts/**` or `contracts/SHA256SUMS.json` | Frozen and checksum-covered; governed by `contracts/README.md`'s compatibility policy. |
| Any pin upgrade (`drenyra-ai@0.4.1` → newer) | A release event under `contracts/runtime-dependency.md` rule 6, requiring a changelog entry, a migration note, a re-run of `doctor`, and a version bump. Not this change. The pin, its checksum `09df8d69…`, `RUNTIME_VERSION`, `AGENTS.md`, `RELEASING.md`, and the contract's reference table are mutually consistent and correct today. |
| **Publishing to npm, adding `publishConfig`, or adding a publish step** | **D8: confirmed no publication.** The change stops at a verified gate plus honest documentation. `ROADMAP.md`'s item "Package released as `drenyra-shell` on npm" stays **unchecked**. `RELEASING.md`'s "verification-only" posture is unchanged. |
| Fiscal/operational recovery — `REQ-MISS-007`, `REQ-CMD-007`, `recoverDurableMissions`, resume recovery | Already implemented, specified, and tested (`lib/mission-store.ts`, `__tests__/mission-store.test.ts`, including the corrupt-store fail-closed case). This is the change's own falsification, not a gap. |
| Engram integration, model-routing API (G30), full-tree receipt expansion, typed `verificationLevel` generator support, batch manifest back-fill | Already recorded as deferred follow-ups in `docs/architecture/capability-conformance-matrix.md` and the `2026-09-08` archive report. |
| Rewriting `PARTICIPATION_PATHS_V1` or replacing the candidate-identity algorithm | Design `§7.2`-derived, test-covered (A/M/D classification, canonical manifest, normalization stability), and the allowlist is deliberately immutable. |
| Editing `.git/**`, the attempt ledger, or performing `sdd-attempt reset` | Consent-bearing, audit-visible, and outside SDD phase authority (D7). |
| Deleting any legacy surface or archived artifact | `REQ-CONF-008` retention bar; `docs/architecture/legacy-capability-surface-inventory.md` retains all 18 candidates. |
| Making `postinstall` **fail closed** | Rejected by D5: it would break CI's install-before-build ordering. |
| Building a "conformance vectors" runner | Rejected by D9. |

### 5.2 Carried from the falsification table — must not be resurrected

The exploration's falsification table (`exploration.md` §4) is **binding**. In particular, this proposal must not present as scope: `verify:capability` being "ungoverned" (falsified — it runs against the real repository root inside `bun run test` at `__tests__/capability-manifest.test.ts`), `refresh:lock-facts --check` being "ungoverned" (falsified — asserted inside `bun run test`), the pin/checksum being wrong (falsified — matches), the packed-install proof being aspirational (falsified — real and in CI), `doctor` not being fail-closed (falsified — five verdicts; `createPin` throws on a `released` pin with a `"pending"` checksum), fiscal mission recovery being missing (falsified), `prepublishOnly` not gating the build (falsified), or a new "recovery" capability row expressing this work (impossible — closed name list plus a hard 8/2/0 assertion).

### 5.3 Declined — U7, the docs-drift guard

U7 is **declined**, with the reasoning stated so a reviewer can reverse it cheaply.

- The divergence that matters is already gated transitively: the coupling is asserted by `__tests__/lock-facts.test.ts` and by the real-repository capability guard that `bun run test` runs (`scripts/verify-capability-manifest.mjs:862-867` for the mirror, `:990-995` for the version agreement). A doc-drift test would not add coverage of the *mechanism*; it would only assert that prose mentions it.
- A test that "fails when docs drift" has to parse prose or hardcode a sentence, which produces false RED on a legitimate wording improvement and false GREEN the moment the sentence is reflowed. That is the over-engineering failure mode the exploration named, and it would spend reviewer budget on the weakest unit in the change.
- The real mitigation is **placement discipline**, which U2 already imposes: one canonical statement, with pointers (not copies) from `openspec/README.md` and `RELEASING.md`. Two copies of a sequence is the drift mechanism; one copy plus links is the guard.
- If a reviewer insists on one executable artefact, the only defensible form is a narrow static assertion that the commands named by the documented sequence exist in `package.json#scripts`. That is a ~15-line test with no prose parsing. Recorded here as an available, explicitly optional alternative rather than as planned scope.

---

## 6. Binding constraints for the next phases

1. **No publication.** No npm publish, no `publishConfig`, no publish job, no dist-tag mutation, no tag push, no GitHub release. The `release-verify` workflow stays a pure verification gate. D8 is settled.
2. **The version bump is a three-surface edit, not one line.** `scripts/verify-capability-manifest.mjs:990-995` fails when `capability-manifest.yaml#/repository/version` differs from `package.json#/version`, and `__tests__/lock-facts.test.ts:156-158` (and `:325`) fails when `program-lock-facts.json#/packageVersion` differs from `package.json#/version`.
3. **Order inside U4 and D5 is load-bearing.** Edit the three surfaces → `bun run refresh:lock-facts` (this regenerates `capabilityStates.digestSha256` over the changed `capability-manifest.yaml`, plus `headSha` and the generated `activeChanges`) → rewrite the mirror → `--check` → full verification. Never hand-edit `candidateIdentity`, a digest, or `headSha`.
4. **The mirror is normalization-exempt, so it must be written last and verified not to move the identity.** `scripts/compute-candidate-identity.mjs:104-108` normalizes only the `current_test_state.candidate_identity` scalar; `:19-21` lists that same normalization. Writing the mirror is therefore safe only when it carries the value the refresh just produced.
5. **D5 must stay testable without repackaging.** `package.json#/files` ships only `dist` (`package.json:9-13`), and `scripts/build.mjs` copies exactly one script — `scripts/install-drenyra-ai.mjs` → `dist/scripts/install-drenyra-ai.js`. Extracting a new helper module would therefore require a build-copy step **and** an expected-file list update in `scripts/verify-package-files.mjs`. The cheapest testable route keeps the guard inline in `postinstall` and drives the same one-liner from a focused test in a temporary working directory where `dist/scripts/install-drenyra-ai.js` is absent (the inline script resolves that path relative to `cwd`), asserting the warning text on stderr/stdout and exit code 0. The present branch must be exercised too, and `scripts/verify-packed-install.mjs` must stay green: the warning must not corrupt its captured output, and exit 0 must not change.
6. **U2 must not create a second copy of the sequence.** `docs/architecture/program-lock-facts.md` is the canonical owner; `openspec/README.md` and `RELEASING.md` get a link and at most a one-line statement of *when* the pair is mandatory.
7. **U3 must leave the rest of `RELEASING.md` intact.** Steps 1–6, step 8, step 9, the "Gotchas" block, and the verification-only posture are correct today (including the correct pin-check, the byte-identical `dist/cmd/cli.js` note, and the stale-`dist` warning). Only step 7 and checklist item 3 change.
8. **The CHANGELOG must not claim a release that has not happened.** The `0.1.0` entry records a version bump and the D2 rationale; it must not imply publication, and it should record that it supersedes the earlier "verification-only release posture, version stays pre-alpha" note whose reasoning D2 overrode.
9. **The recovery pair is a mandatory post-step of every unit that writes an allowlisted path** (D7) — here, **U4** and **D5**, both of which write `package.json`. It is also mandatory after archiving this change.
10. **Strict TDD applies.** `openspec/README.md` declares strict TDD active; the behavioural unit (D5) owes RED → GREEN → TRIANGULATE → REFACTOR evidence, and the record must state the test command and its result.

---

## 7. Affected areas

| Path | Unit | Kind of change |
| --- | --- | --- |
| `docs/architecture/program-lock-facts.md` | U2 | docs — canonical recovery sequence (trigger set + ordered pair) |
| `openspec/README.md` | U2 | docs — reachability link from the SDD entry document |
| `RELEASING.md` | U2, U3 | docs — reachability link; step 7 rewrite; checklist item 3 rewrite |
| `package.json` | U4, D5 | version string; `postinstall` warning |
| `capability-manifest.yaml` | U4 | `#/repository/version` |
| `docs/architecture/program-lock-facts.json` | U4 | generated via `bun run refresh:lock-facts` (never hand-edited) |
| `openspec/config.yaml` | U4 | mirror `#/current_test_state/candidate_identity` (normalization-exempt) |
| `CHANGELOG.md` | U4, U5 | `0.1.0` entry; correction of the non-existent `themes/Drenyra.json` line |
| `runtime/installer.ts` | U5 | doc comment only — no behaviour change |
| `.github/workflows/ci.yml` | U5 | comment only — no behaviour change |
| `__tests__/` (one new focused test) | D5 | test for the warning + exit-0 contract |
| `openspec/changes/pi-recovery-release-readiness/**` | — | this change's own artifacts (proposal, specs, design, tasks, apply-progress, verify-report) |

**Not touched:** `contracts/**`, `openspec/specs/**`, `MASTER_CAPABILITIES`, `PARTICIPATION_PATHS_V1`, `scripts/compute-candidate-identity.mjs`, every archived change, `pi-skills-memory-integration`, and `.git/**`.

---

## 8. Risks

| # | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| R1 | **The recovery pair is skipped after a unit that writes an allowlisted path** (U4, D5 write `package.json`), leaving `--check` stale and `bun test` red with no other symptom. Four prior recovery events prove this is the default failure mode, not an unlikely one. | High | Constraint §6.3/§6.9; the pair is written into the task list as a per-unit post-step, and U2 publishes it as an ordered, indivisible operation. |
| R2 | **A partial version bump.** Editing `package.json` but not `capability-manifest.yaml` (or not the lock facts) fails `verify:capability` at `scripts/verify-capability-manifest.mjs:990-995` or `__tests__/lock-facts.test.ts:156-158`. | High | Constraint §6.2; the task list enumerates all three surfaces plus the refresh and mirror as one atomic unit. |
| R3 | **Stale digest after the manifest edit.** `capability-manifest.yaml` bytes are covered by `capabilityStates.digestSha256`; a version edit invalidates it. | High | `bun run refresh:lock-facts` is mandated after the three-surface edit and before `--check`. |
| R4 | **Docs-drift from duplicated prose.** Writing the sequence in three files creates three sources of truth. | Medium | Constraint §6.6: one canonical statement, links elsewhere. This is also the reason U7 is declined as a guard (§5.3). |
| R5 | **The pin-bump procedure is damaged while being repaired.** `RELEASING.md` is the repository's definition of a release event. | Medium | Constraint §6.7: only step 7 and checklist item 3 change; steps 1–6, 8, 9 and the gotchas stay byte-identical. |
| R6 | **The `postinstall` warning breaks the frozen install.** CI and `release-verify` run `bun install --frozen-lockfile` before the build, when `dist/` does not exist, so a warning that changes the exit code would fail every job. | High | Constraint §6.5 and D5: warning only, **exit 0 preserved**; verified by the focused test's exit-code assertion and by `verify:package` + `verify-packed-install`. |
| R7 | **The warning pollutes `verify-packed-install.mjs` output**, whose diagnostics were just repaired to surface npm output verbatim. | Medium | Constraint §6.5: the warning is a single bounded line; the packed-install proof must stay green and its captured npm diagnostics must stay intact. |
| R8 | **The CHANGELOG overclaims.** A `0.1.0` entry can read as "released". | Medium | Constraint §6.8; D8's no-publication posture is restated in the entry and in the change's own summary. |
| R9 | **Scope inflation from the broad title.** "Recovery and release readiness" can absorb Engram integration, npm publication, the pin upgrade, and capability promotion. | High | §5.1/§5.2 carried verbatim from the exploration, plus this proposal's explicit statement that remaining scope is four docs files, three version surfaces, and one behavioural change. Any addition is a new decision, not a silent extension. |
| R10 | **Version `0.1.0` changes the derived release channel.** The workflow prints `latest` for a stable version and `next` for any pre-release, so this decision changes what a future publish would be tagged. | Medium | Accepted by D2 and stated here for the record; no dist-tag is ever set by this change (D8), and the workflow's output is informational only. |
| R11 | **`headSha` ancestor coupling on stacked PRs** (RELEASING.md step 9). | Medium | Delivery keeps dependent PRs stacked per the auto-chain strategy, or points `headSha` at the PR base, so the ancestor check in `__tests__/lock-facts.test.ts` passes. |
| R12 | **Evidence inheritance.** Command-shaped baseline rows in §2 are inherited, not measured by this phase. | Medium | §2 marks each row's provenance; the verify phase re-measures before citing. |
| R13 | **Reopening settled decisions.** A reviewer may want to relitigate `0.1.0`, the archive, or publication. | Low | The preproposal gate is closed and §5 states the boundary; reversal requires a new recorded decision, not a proposal edit. |

---

## 9. Rollback

- **Docs units (U2, U3, U5).** Reverted by `git revert` of their own commits. No behaviour, no coupling, no derived state. The only correctness condition is that the canonical statement and its links are reverted together, so no dangling pointer survives.
- **U4 (version).** Reverted by editing the same three surfaces back and re-running the **full** recovery pair. The identity must never be hand-edited to a previous value; reverting the version without the refresh leaves `--check` stale, `__tests__/lock-facts.test.ts` red, and `verify:capability` red.
- **D5 (postinstall warning).** Reverted by restoring the one-line `postinstall` command. Removing the warning restores the fail-open path documented in the exploration (G12) — a known, previously accepted state, not a regression introduced here. No consumer depends on the warning.
- **Nothing to unpublish or unrelease.** D8 forbids publication, `publishConfig`, and any publish step; the ROADMAP item stays unchecked; no tag is created; no dist-tag is set. Rollback of this change has **zero** external effect.
- **No contract rollback needed.** `contracts/**` and `contracts/SHA256SUMS.json` are untouched, so no consumer of the frozen public surface is affected.

---

## 10. Success criteria

Verifiable by the verify phase, each with a command or a file assertion.

1. `node scripts/refresh-program-lock-facts.mjs --check` exits 0 on the final candidate.
2. `bun run verify:capability` exits 0 — the mirror in `openspec/config.yaml#/current_test_state/candidate_identity` equals the live generated identity.
3. `bun run test` is green, including the new focused test for the `postinstall` warning, and `bun run typecheck`, `bun run verify:style`, `bun run verify:package`, and `node scripts/verify-packed-install.mjs` are green.
4. `package.json#/version` = `capability-manifest.yaml#/repository/version` = `program-lock-facts.json#/packageVersion` = **`0.1.0`**.
5. The trigger set and the ordered recovery pair appear in **exactly one** durable non-archived document (`docs/architecture/program-lock-facts.md`), and that document is reachable by link from `openspec/README.md` and `RELEASING.md`.
6. `RELEASING.md` pin-bump step 7 names the sanctioned generator and includes the mirror and `--check`; **no instruction to hand-edit an identity, digest, or `headSha` remains anywhere in `RELEASING.md`**.
7. `RELEASING.md` checklist item 3 names only gates that exist in `package.json#/scripts` and that a release record can cite as run.
8. The three stale prose items are corrected: no claim that the pending-release branch is live, no `drenyra-ai-0.2.0` reference in `.github/workflows/ci.yml`, no `themes/Drenyra.json` reference in `CHANGELOG.md`.
9. With `dist/scripts/install-drenyra-ai.js` absent, `postinstall` prints a visible warning **and exits 0**; with it present, behaviour is unchanged.
10. No `publishConfig`, no publish step, no dist-tag mutation, no tag; `ROADMAP.md`'s npm item remains unchecked.
11. `git diff --stat` over the change shows no modification under `contracts/**`, `openspec/specs/**`, `scripts/compute-candidate-identity.mjs`, or `PARTICIPATION_PATHS_V1`, and no change to `pi-skills-memory-integration` or any archived change.
12. The change's own record states plainly that the remaining work is documentation, one version bump, and one behavioural change — and does not claim to have built recovery, publication readiness, or a release process.

---

## 11. Delivery shape

`auto-chain` is the resolved delivery strategy (session preflight), with a **400-changed-line** review budget enforced at commit boundaries. The units group naturally into two reviewable slices, and the second must follow the first because both end with the recovery pair and the version change moves the identity:

| Slice | Units | Character | Budget note |
| --- | --- | --- | --- |
| 1 | U2, U3, U5 | documentation only — no allowlisted path, no derived state | Well inside budget; reviewer reads prose, not mechanics. |
| 2 | U4, D5 | three-surface version bump + one behavioural change + the recovery pair | Contains the only behavioural change; the focused test is the largest single addition. |

Both slices end with the full verification set (§10 items 1–3). The change's own SDD artifacts (`specs/`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`) are additional changed lines and count toward the delivery budget; if a slice exceeds 400 lines, it is split at a commit boundary rather than by diluting the change. `headSha` must remain an ancestor of any CI branch (RELEASING.md step 9). The delivery is committed conventionally with **no AI attribution**, and the parent owns the commit/push route.

---

## 12. Proposal question round — waived, with residual assumptions

A proposal question round is normally offered to surface business rules, edge cases, and tradeoffs before finalizing. It is **waived here**: `preproposal.md` §5 is a **confirmed** decision record answering all ten decisions, and this phase is explicitly forbidden to interview the human or re-open a settled decision. No product decision in this section overrides §5.

The following are **non-product, proposal-level** assumptions a reviewer may correct without touching a confirmed decision:

1. **Canonical location.** The recovery sequence's single home is `docs/architecture/program-lock-facts.md`, with links from `openspec/README.md` and `RELEASING.md` — rather than `openspec/README.md` or `RELEASING.md` itself. Rationale: that document already owns `refresh:lock-facts` and `--check`; the other two are entry points.
2. **U7 declined** (§5.3), with the narrow static-assertion alternative recorded if a reviewer prefers a guard to placement discipline.
3. **A `CHANGELOG.md` entry for `0.1.0` is included in U4**, because the same file is already edited by U5 and the version policy's own record-keeping implies it. If a reviewer judges the entry unnecessary, U4 loses one small edit and loses nothing else.
4. **D5's testability route** (keep the guard inline; drive it from a temporary working directory) is preferred over extracting a helper module, on measured packaging grounds (`package.json:9-13`, `scripts/build.mjs`, `scripts/verify-package-files.mjs`).
5. **`verify:capability` is named in the rewritten checklist item 3** per D9 and the parent's confirmed unit boundary, even though no workflow invokes it as a discrete step: it is a real script (`package.json:48`), it runs against the real repository inside `bun run test`, and it is citable as a run command.
6. **The `0.0.1-prealpha.1` → `0.1.0` change is recorded in `CHANGELOG.md` as superseding the earlier pre-alpha rationale.** D2 settles the version; this only settles where the reason is written down.

---

## 13. Evidence provenance and citation index

- **Measured by this phase (read-only, no shell):** the contents and line references of `exploration.md`, `preproposal.md`, `docs/architecture/program-lock-facts.md`, `docs/architecture/program-lock-facts.json`, `openspec/README.md`, `openspec/config.yaml:33-41`, `CONTRIBUTING.md`, `RELEASING.md`, `package.json`, `capability-manifest.yaml`, `.gitignore:34-35`, `scripts/build.mjs`, `scripts/compute-candidate-identity.mjs:45-67,104-108`, `scripts/verify-capability-manifest.mjs:756-757,862-867,990-995`, `__tests__/lock-facts.test.ts:156-158,261,325`, `runtime/installer.ts:113-114`, `.github/workflows/ci.yml:51`, `CHANGELOG.md:31`, `docs/architecture/legacy-capability-surface-inventory.md`, `openspec/specs/program-conformance/spec.md#REQ-CONF-005`, and the absence of `<repo>/~/.bun/install/cache/…`.
- **Inherited and flagged as such:** test counts (767/0), `--check` currency, `verify:capability` OK, PR numbers #70/#69, merge commit `70d87ac`, the npm 10.9.x Arborist diagnosis, and the `./~/` size figures (114 MB / 3,942 files). The parent and the preproposal measured these; this phase could not execute anything and the verify phase must re-measure.
- **Binding inputs:** `exploration.md` §4 (falsified candidates) and §5.2 (out-of-scope table); `preproposal.md` §5 (confirmed decisions).
- **Line references are as of this proposal's baseline** (`headSha` `deddc860…`, identity `dirty-sha256:70ca1dfa…`). Re-derived after the change's own writes, the cited line numbers may shift; the quoted text is the stable anchor.

**This phase wrote only `openspec/changes/pi-recovery-release-readiness/proposal.md`. It wrote no source, test, contract, spec, config, or lock fact; it did not open, edit, or advance `pi-skills-memory-integration` or any archived change; it did not attempt publication; and it committed nothing.**
