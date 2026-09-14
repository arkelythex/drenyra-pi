# Tasks — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6)
**Phase:** tasks — read-only against the repository. **The only write performed by this phase is this file.**
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Authority:** `design.md` (the authority for this phase), `specs/release-readiness/spec.md` (`REQ-REL-001`..`006`, 21 scenarios), `preproposal.md` §5 + **D11 (binding)**, `exploration.md` §4 (falsification table, binding) and §5.2.

**Scope in one sentence.** Four release-facing documents (plus one link-only dedupe), one version unit across five carriers with one new guard, one small behavioural change to `postinstall`, and one 4-line prose addendum (`U5b`) — plus the indivisible recovery pair after each unit that writes an allowlisted path.

---

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 340–440 total; Slice 1 ≈ 135–165, Slice 2 ≈ 90–115, Slice 3 ≈ 95–125 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (U2 + U3 + U5 + U5b, documentation) → PR 2 (D5, one behavioural change + its test) → PR 3 (U4, version + guard + record sync) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

**Why Medium and not Low.** No slice is near the budget on its own (largest estimated slice ≈ 165 lines), so a single slice is Low risk. Medium reflects two facts stated plainly rather than trimmed: the aggregate estimate straddles 400, and each of Slice 2 and Slice 3 also rewrites generated artifacts (`docs/architecture/program-lock-facts.json`, the `openspec/config.yaml` mirror) whose diff size is not fully predictable before apply. The chained split is what protects the budget; it is not a substitute for doing the work. No decision is needed before apply because `auto-chain` + `feature-branch-chain` are already resolved in the session preflight.

---

## Recovery-pair verdict and the indivisible command block

### Per-unit verdict (from `design.md` §8.1)

| Unit | Writes a `PARTICIPATION_PATHS_V1` path? | Recovery pair |
| --- | --- | --- |
| **U2** — canonical sequence + links + inventory dedupe | no | **not forced** |
| **U3** — `RELEASING.md` step 7 + checklist item 3 | no | **not forced** |
| **U5** / **U5b** — six prose corrections | no | **not forced** |
| **D5** — `postinstall` warning + `__tests__/postinstall-hook.test.ts` | **yes — `package.json`** | **FORCED** |
| **U4** — `0.1.0` across C1–C6 + guard + `CHANGELOG.md` + `DR-6` | **yes — `package.json`, `capability-manifest.yaml`, and `openspec/config.yaml` through the mirror** | **FORCED** |
| **Archive step** (after verify, parent-owned) | **yes — the generated `activeChanges` inside `docs/architecture/program-lock-facts.json`** | **FORCED** |

**Design correction carried forward:** U2, U3, U5 and U5b do **not** force the pair. **D5, U4 and the archive step do.** U4 forces **exactly one** pair for the whole unit — from C1/C2, not from C4/C5/C6. Do not run a pair per file.

### The indivisible command block (byte-exact; identical for D5, U4, and the archive step)

```sh
# 0. the unit's own edits are complete, including every recorded count
bun run refresh:lock-facts

# 1. copy the identity the generator just produced into the normalization-exempt mirror. The
#    payload is single-quoted and supplies the replacement as a function, so neither the shell
#    nor String.replace can interpret a dollar pattern.
node -e 'const{readFileSync,writeFileSync}=require("node:fs");const facts=JSON.parse(readFileSync("docs/architecture/program-lock-facts.json","utf8"));const id=facts.candidateIdentity;const p="openspec/config.yaml";const before=readFileSync(p,"utf8");const after=before.replace(/^(\s*candidate_identity:\s*).*$/m,function(_match,key){return key+JSON.stringify(id);});if(after===before)throw new Error("openspec/config.yaml has no candidate_identity line to rewrite");writeFileSync(p,after);console.log("config.yaml mirror <- "+id);'

# 2. the checkpoint is current. `openspec/config.yaml` is allowlisted as a *path* even though
#    its mirror field is normalization-exempt as a *value*: if the mirror write was that file's
#    only change, run step 0-1 again first (see docs/architecture/program-lock-facts.md).
node scripts/refresh-program-lock-facts.mjs --check

# 3. full verification — every command a release record can cite
bun run typecheck && bun run test && bun run verify:style && bun run verify:capability && bun run verify:package && node scripts/verify-packed-install.mjs
```

**Never** hand-edit `candidateIdentity`, `checksums.*`, `capabilityStates.digestSha256`, or `headSha`. **Never** split steps 1–3: the mirror is **not an input to the checkpoint**, so `--check` alone is **never** evidence that recovery completed. A refresh without the mirror rewrite leaves `node scripts/refresh-program-lock-facts.mjs --check` reporting **current** while `bun run verify:capability` goes red with `conflicting current snapshot identity in openspec/config.yaml: <old> != <new>` (and `__tests__/capability-manifest.test.ts` fails inside `bun run test` with the same message). Steps 2 and 3 are the two halves of the proof.

**Two further traps.** (a) Editing the recorded counts **after** the refresh changes `capability-manifest.yaml` bytes and invalidates `capabilityStates.digestSha256` and the mirror in one step — `DR-6` therefore precedes `refresh:lock-facts` inside U4. (b) A formatter or autofix run after a unit closes re-classifies an allowlisted file; re-run steps 2–3 after any tool that rewrites tracked bytes.

---

## Recorded decisions the verify phase applies (not open questions)

**DECISION-1 — `REQ-REL-001` × `REQ-REL-002` intersection (`design.md` §16.1).** The verify phase applies the **normative-statement-vs-invocation rule**: `REQ-REL-001` governs the **normative statement** — trigger set, ordered steps as the repository rule, and the ordering rationale — and that statement lives in exactly one document; `REQ-REL-002` governs the **release procedure's invocation** of that rule, so `RELEASING.md` step 7 contains the three commands because the pin bump must run them and explicitly declines to restate the trigger set or the rationale. Consequence for verification: `REQ-REL-001` scenario 2 is checked as *trigger set and ordering rationale in exactly one document, other documents reaching it by link*; `REQ-REL-002` scenario 1 is checked as *step 7 contains the three commands*.
**If the verify phase instead applies the strictest reading** (no ordered commands anywhere but the canonical document), the required change is **one edit**: step 7 keeps its link, its "not restated here" sentence, and states its three obligations in prose — *"the sanctioned generator has run"*, *"the mirror carries the value the generator produced"*, *"`--check` exits 0"*. Flag it to the parent; it is a spec-authoring conflict, not an implementation detail. T-S1-006 below authors the interpreted form, which is the recorded default.

**DECISION-2 — `DR-6` is a judgement call (`design.md` §16.3, §5.6).** It is included (implemented by T-S3-007). Declining it fails no requirement; if a reviewer declines it, restore the recorded counts and note the staleness in this change's own record.

**DECISION-3 — accepted limitation of D5's mode (`design.md` §16.2).** `console.warn` writes to stderr; npm 7+ may buffer lifecycle-script output on success while `bun install` prints it. The requirement is satisfied at the level the change controls (the hook prints; direct execution is asserted by T-S2-002/003/004). Exit-non-zero is forbidden by D5.

---

## External guards that constrain edits from outside this change's scope

These are **not** editable by this change. No task below proposes violating them.

1. `__tests__/release-verify-workflow.test.ts:211` asserts `expect(releasing).not.toContain("npm publish")` over `RELEASING.md`. **The replacement text for T-S1-005 and T-S1-006 must not contain the literal `npm publish`.** Neither design block does.
2. `scripts/verify-package-files.mjs:242-246` requires `pkg.scripts.postinstall` to be a string **containing** the literal `dist/scripts/install-drenyra-ai.js`, and `package.json#files` ships only `dist` (plus assets/contracts/prompts/skills/agents/chains/vendored/themes/README/LICENSE). Together these **force** the D5 warning to stay an inline one-liner: a helper module would need a new build-copy step, a new expected-entry in `scripts/verify-package-files.mjs`, and a new package-file check.
3. `__tests__/lock-facts.test.ts` and `__tests__/capability-manifest.test.ts` are identity-allowlisted; touching them would force a second recovery pair for no coverage. **Do not edit them.**
4. `.github/workflows/release-verify.yml` stays byte-identical (`REQ-REL-006` scenario 3).

---

## Hard boundaries (apply phase)

**Global allowed edit surface:** `docs/architecture/program-lock-facts.md`, `docs/architecture/legacy-capability-surface-inventory.md`, `openspec/README.md`, `RELEASING.md`, `runtime/installer.ts`, `.github/workflows/ci.yml`, `CHANGELOG.md`, `README.md`, `docs/intended-usage.md`, `docs/architecture/ecosystem-boundaries.md`, `package.json`, `capability-manifest.yaml`, `extensions/register.ts`, `extensions/fiscal-guard.ts`, `__tests__/configurator.test.ts`, new `__tests__/harness-version.test.ts`, new `__tests__/postinstall-hook.test.ts`, `openspec/config.yaml` (mirror + recorded counts), `docs/architecture/program-lock-facts.json` (generator output only), and this change's own artifacts.

**Prohibited:** `contracts/**` (incl. `SHA256SUMS.json`), `openspec/specs/**`, `MASTER_CAPABILITIES` and the 8/2/0 capability-state counts, `PARTICIPATION_PATHS_V1` and `scripts/compute-candidate-identity.mjs`, `scripts/verify-capability-manifest.mjs`, `__tests__/lock-facts.test.ts`, `__tests__/capability-manifest.test.ts`, `__tests__/release-verify-workflow.test.ts`, `.github/workflows/release-verify.yml`, `ROADMAP.md` (its npm item stays unchecked), any pin upgrade, any publication surface (`publishConfig`, publish step, dist-tag, tag), `pi-skills-memory-integration` and every archived change, `.git/**`. No U7, no vector runner, no `postinstall` fail-closed.

**Not to be re-planned (already delivered — `design.md` §1):** PRs #70/#69 and merge `70d87ac`; the npm 10.9.x `--legacy-peer-deps` postinstall fix (`runtime/installer.ts:74-88`); the `scripts/verify-packed-install.mjs` diagnostics repair (`:64-77`); removal of the stray repository-root directory literally named with a single tilde character (a misquoted-shell-command artifact, not a home-directory reference); the superseded-change archive. **No task exists for any of these.**

---

## Slice 1 — Documentation (U2 + U3 + U5 + U5b). No allowlisted path, no recovery pair

**Start / finish:** Start from a clean baseline read of the six documentation files. Finish with the recovery sequence stated once and reachable, `RELEASING.md` repaired, and every stale release-facing prose line corrected.
**Allowlisted:** none of these files is in `PARTICIPATION_PATHS_V1` — verified member-by-member in `design.md` §1. **No recovery pair for this slice.**

- [x] T-S1-001 — Record `git status --short`, confirm no pre-existing modification overlaps the Slice 1 allowlist, and stop and report if the attribution is ambiguous. <!-- sdd-owner: implementation -->
- [x] T-S1-002 — **U2, canonical statement.** Rewrite `docs/architecture/program-lock-facts.md` lines 3–8 with the block in `design.md` §3.3(a): the "single canonical statement" banner, the two trigger classes (**a `PARTICIPATION_PATHS_V1` mutation** — including via a formatter, autofix, or another session — and **a change-folder lifecycle event**), the four ordered steps, the "Why the order matters" paragraph naming `normalizeConfigYaml` and the `verify:capability` symptom, and the closing prohibition on hand-editing `candidateIdentity`, a checksum or digest, or `headSha`. Keep line 10 ("Run the command only from the canonical Git top-level…") as the tail and keep `## What changes` / `## Boundary` byte-identical. <!-- sdd-owner: implementation -->
- [x] T-S1-003 — **U2, dedupe (design correction to proposal §7).** Reduce `docs/architecture/legacy-capability-surface-inventory.md:98-101` to the link delegation in `design.md` §3.3(d): that parenthetical is the **only other non-archived full statement** of the sequence, so leaving it in place fails `REQ-REL-001` scenario 2. One canonical statement, links elsewhere. <!-- sdd-owner: implementation -->
- [x] T-S1-004 — **U2, reachability.** Insert the four-line link block (`design.md` §3.3(b)) into `openspec/README.md` between the `## Persistence model` bullet list (ends line 26) and `## Testing & TDD` (line 28). Link and *when* only — no steps. <!-- sdd-owner: implementation -->
- [x] T-S1-005 — **U3, checklist item 3.** Replace `RELEASING.md:46` with the four ratified gates (`design.md` §4.1): `bun run test`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`, `bun run verify:capability`. Per **D9** no vector runner is built and no gate without an executable implementation is named. The text must not contain the literal `npm publish`. <!-- sdd-owner: implementation -->
- [x] T-S1-006 — **U3, pin-bump step 7.** Replace `RELEASING.md:82-87` with `design.md` §4.2: the delegation sentence (canonical statement linked, trigger set and rationale **not restated here**), the invocation of `bun run refresh:lock-facts`, the mirror rewrite, `node scripts/refresh-program-lock-facts.mjs --check`, the generator's derived-field list, the "never hand-edit" sentence, and the closing "`--check` without the mirror rewrite is not evidence — `verify:capability` is the other half of the proof". This is the authored form of **DECISION-1**; if the verify phase applies the strict reading, replace the three commands with the three prose obligations per DECISION-1. Steps 1–6, 8, 9, the Gotchas block, the version policy, the "Current state" section, and the "Conditions for a future publish step" section stay byte-identical. The text must not contain the literal `npm publish`. <!-- sdd-owner: implementation -->
- [x] T-S1-007 — **U5, three stale release-facing items.** (a) `runtime/installer.ts:108-115` doc comment → the replacement in `design.md` §7.1 (the **released** branch is the one in force; the pending-release branch is a retained fallback and not the live path). (b) `.github/workflows/ci.yml:49-51` → the comment block in `design.md` §7.2 naming `vendored/drenyra-ai-0.4.1.tgz` plus the keep-in-sync pointer to `package.json#devDependencies.drenyra-ai`; comment only, no workflow behaviour change. (c) `CHANGELOG.md:31` → the two real theme paths per `design.md` §7.3; the historical `## 0.0.1-prealpha.1 — 2026-08-01` entry (including its `drenyra-ai@0.2.0` reference) stays byte-identical. <!-- sdd-owner: implementation -->
- [x] T-S1-008 — **U5b, version-status prose (recommended, reversible).** Update `README.md:7-12`, `docs/intended-usage.md:27`, and `docs/architecture/ecosystem-boundaries.md:273-274` per `design.md` §7.4. Leave the `conformance:surface` / `conformance:snapshot` markers in `README.md:46-47` untouched — they are the delegation form and the prose edit around them cannot break marker validation. <!-- sdd-owner: implementation -->
- [x] T-S1-009 — Verify Slice 1: (a) `grep -rn "refresh:lock-facts" --include=*.md .` excluding `**/archive/**` → ordered steps in exactly one document (canonical doc), step 7's invocation in `RELEASING.md`, link-only mentions in `openspec/README.md` and the inventory; (b) `grep -n -e candidateIdentity -e headSha -e "sha256 of the current" RELEASING.md` → only the prohibition sentence and the generator's derived-field list; (c) `grep -n "themes/" CHANGELOG.md` → every path resolves under `themes/`; (d) `grep -n "vendored/drenyra-ai" .github/workflows/ci.yml package.json` → both `0.4.1`; (e) `bun test __tests__/release-verify-workflow.test.ts`; (f) `bun run typecheck` and `bun run verify:style`. Record each exact result. <!-- sdd-owner: implementation -->

**Rollback:** `git revert` of Slice 1's commits, taken together so the canonical statement and its links revert as one and no dangling pointer survives. No behaviour, no coupling, no derived state.

---

## Slice 2 — D5, the `postinstall` warning (behavioural; strict TDD; **pair FORCED**)

**Allowlisted write:** `package.json` — a member of `PARTICIPATION_PATHS_V1`. The recovery pair is **mandatory** and **indivisible**. `__tests__/postinstall-hook.test.ts` is not allowlisted, so it never enters the identity digest.
**Ordering:** D5 precedes U4. U4 is the last unit that changes the test suite, so `DR-6`'s count sync (which must precede the refresh) belongs to U4.

- [x] T-S2-001 — **RED.** Create `__tests__/postinstall-hook.test.ts` per `design.md` §6.2: it reads `scripts.postinstall` from `package.json` and spawns `node -e <that string>` with `cwd` set to `mkdtempSync(join(tmpdir(), "pi-postinstall-"))`, capturing `stdout`, `stderr`, and `status`. Case 1 (absent installer, no fixture) asserts `status === 0`, `stderr` contains the warning and names `dist/scripts/install-drenyra-ai.js`, and `stdout` is empty. Case 2 (present installer writing a marker) and case 3 (present installer exiting 3) are written now as well. Run `bun test __tests__/postinstall-hook.test.ts`; record the verbatim RED output of case 1 (no warning, `stderr === ""`). <!-- sdd-owner: implementation -->
- [x] T-S2-002 — **GREEN.** Replace the whole `postinstall` value (`package.json:44`) with the exact one-liner in `design.md` §6.1. Constraints, each one a requirement: `console.warn(...)` — **stderr**, one line; `process.exit(0)` in the absence branch (`REQ-REL-004` "MUST still exit 0" — CI and `release-verify` install before building); the literal `dist/scripts/install-drenyra-ai.js` stays **inline once** (`scripts/verify-package-files.mjs:242-246`); `spawnSync(...).status ?? 1` + `process.exit` unchanged so the present path propagates its status and prints no warning. The warning names the missing file and the remedy (`bun run build`, then re-run the install). Do not extract a helper module — inline is **forced**, not merely preferred. <!-- sdd-owner: implementation -->
- [x] T-S2-003 — **TRIANGULATE.** Case 3: the present fixture installer exits 3 and the hook must propagate status `3` — proving the `?? 1` fallback does not swallow a real failure. Re-run `bun test __tests__/postinstall-hook.test.ts`; record the verbatim GREEN output for all three cases. <!-- sdd-owner: implementation -->
- [x] T-S2-004 — **REFACTOR.** Extract the spawn-and-capture runner helper in the test; typed, no `any`; no assertion weakened. Re-run the focused test. <!-- sdd-owner: implementation -->
- [x] T-S2-005 — **Environment-faithful check for D5.** Validate the hook where it actually failed: `npm install --prefix /tmp/npm10 --no-save --no-package-lock npm@10.9.0`, then write the shim — `printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$(command -v node)" /tmp/npm10/node_modules/npm/bin/npm-cli.js > /tmp/npm10shim/npm`, `chmod +x /tmp/npm10shim/npm` — then `PATH=/tmp/npm10shim:$PATH node scripts/verify-packed-install.mjs`. On npm 10.9.x this passes because of the already-merged `--legacy-peer-deps` fix (baseline B2, not re-planned); on a broken build it fails. Record the exact result. Note in `apply-progress.md` that the shim must be rebuilt if `/tmp` is cleared. <!-- sdd-owner: implementation -->
- [x] T-S2-006 — **Recovery pair (indivisible) after the `package.json` write.** Run the four steps of the indivisible block above in order: `bun run refresh:lock-facts` → the mirror rewrite → `node scripts/refresh-program-lock-facts.mjs --check` → full verification. State in the evidence that a refresh without the mirror leaves `--check` reporting **current** while `bun run verify:capability` goes red with the conflicting-identity message, so `--check` alone is never evidence. Never hand-edit a trust anchor. <!-- sdd-owner: implementation -->
- [x] T-S2-007 — Record Slice 2's evidence in `apply-progress.md`: the RED output, the GREEN and triangulation outputs, the environment-faithful npm 10.9 check, the pair's four results, and confirmation that `node scripts/verify-packed-install.mjs` stayed green with its captured npm diagnostics uncorrupted (the packed artifact contains `dist/scripts/install-drenyra-ai.js`, so the present branch runs and no warning is emitted). <!-- sdd-owner: implementation -->

**Rollback:** restore the one-line `postinstall` and re-run the pair. That restores the previously accepted fail-open (exploration G12) — a known state, not a regression. No consumer depends on the warning.

---

## Slice 3 — U4, version `0.1.0` at D11 width (TDD; **pair FORCED once for the unit**)

**Carriers (D11 binding, measured):** C1 `package.json#/version` and C2 `capability-manifest.yaml#/repository/version` are **hand-edited**; C3 `docs/architecture/program-lock-facts.json#/packageVersion` is **generated** by the refresh and must **never** be hand-edited (`--check` would overwrite it, and it is a trust anchor); C4 `extensions/register.ts:95` `DRENYRA_PI_VERSION` and C5 `extensions/fiscal-guard.ts:49` `VERSION` are hand-edited; C6 `__tests__/configurator.test.ts:26` `PACKAGED_VERSION` is **eliminated** in favour of a real import. Only C1/C2 are allowlisted; the unit still runs **one** pair from them, not one per file.

- [x] T-S3-001 — **RED ① (`REQ-REL-003` scenario 2, captured on purpose).** Set **only** `package.json#/version` to `0.1.0`, then run `bun run verify:capability` → `repository version 0.0.1-prealpha.1 does not match package.json version 0.1.0`, and `bun test __tests__/lock-facts.test.ts` → `packageVersion must equal package.json version (0.1.0)`. Record both verbatim as the fail-closed evidence for a partial bump; do **not** leave the tree in this state. <!-- sdd-owner: implementation -->
- [x] T-S3-002 — **RED ② (the D11 guard).** Create `__tests__/harness-version.test.ts` per `design.md` §5.3: it imports `drenyraPiExtension` from `../extensions/register.js` and `FISCAL_GUARD_VERSION` from `../extensions/fiscal-guard.js`, reads `pkg.version` from `package.json`, and asserts `drenyraPiExtension.version === pkg.version` and `FISCAL_GUARD_VERSION === pkg.version` via **real imports** — never the literal `0.1.0`, never prose, never a regex over `.ts` source (so it cannot false-RED on the next legitimate bump). Run it; record RED for C4 (`expected 0.0.1-prealpha.1 to be 0.1.0`), then extend it for C5 and record RED because the module exposes no `FISCAL_GUARD_VERSION`. <!-- sdd-owner: implementation -->
- [x] T-S3-003 — **GREEN.** Edit C2 `capability-manifest.yaml#/repository/version` → `0.1.0`; C4 `extensions/register.ts:95` `DRENYRA_PI_VERSION` → `0.1.0`; C5 `extensions/fiscal-guard.ts:49` — rename to an additive `export const FISCAL_GUARD_VERSION` with value `0.1.0` and update its single internal use (`extensions/fiscal-guard.ts:235`), leaving its session-status output unchanged; C6 `__tests__/configurator.test.ts:26` — replace the `PACKAGED_VERSION` literal with an import of the real `drenyraPiExtension.version`. Leave C3 to the generator. Run the focused guard and `bun test __tests__/configurator.test.ts`; record GREEN. <!-- sdd-owner: implementation -->
- [x] T-S3-004 — **TRIANGULATE.** Factor the comparison into a local `versionViolations(version: string): string[]` helper and assert it returns a violation for a synthetic `"9.9.9"` and none for `pkg.version` — proving the guard is a detector, not a tautology. <!-- sdd-owner: implementation -->
- [x] T-S3-005 — **REFACTOR.** Extract the `readPackageVersion()` helper in the test file; typed, no `any`. The guard covers only C4/C5 — C2's equality is owned by `verify:capability` and C3's by `__tests__/lock-facts.test.ts`; re-asserting them here would create a third failure site for the same invariant. Name that ownership split in the test header. <!-- sdd-owner: implementation -->
- [x] T-S3-006 — **`DR-6` count sync — BEFORE the refresh (design correction; ordering is load-bearing).** This change adds two test files, so `openspec/config.yaml#/current_test_state` (`files`, `tests`, `evidence_date`; lines 33-41) and `capability-manifest.yaml#/evidenceSnapshot` (`result`, `date`, and the two numbers inside `note`) record a tree that will no longer exist. Sync them using the counts observed in the final full `bun run test`. Constraints enforced by `scripts/verify-capability-manifest.mjs:838-870`: `config.yaml`'s `command`, `evidence_date`, and `classification` must equal the manifest's, and the normalized `completeResult(files.tests, files.failed)` must equal `evidenceSnapshot.result`. The live projection markers (`README.md:47`, `ROADMAP.md:12`, `docs/architecture/capability-conformance-matrix.md:15-16`) are the delegation form, so **no projection surface is edited**. These edits **must precede** `refresh:lock-facts`, because both files participate in the identity and editing them afterwards invalidates `capabilityStates.digestSha256` and the mirror in one step. <!-- sdd-owner: implementation -->
- [x] T-S3-007 — `CHANGELOG.md`: add the `0.1.0` entry recording the version bump and the D2 rationale, stating that **publication remains off**, and noting that it supersedes the earlier "verification-only posture, version stays pre-alpha" note whose reasoning D2 overrode. It must **not** claim that a package was released (`REQ-REL-003` scenario 4; constraint 6.8). <!-- sdd-owner: implementation -->
- [x] T-S3-008 — **Recovery pair (indivisible) after the allowlisted writes.** With C1, C2, C4, C5, C6, the guard, the `CHANGELOG.md` entry, and `DR-6` all in place, run the four steps of the indivisible block in order. Required outcomes: `--check` exits 0, C3 regenerated by the generator (never hand-edited), the mirror carries the value the refresh produced, and `bun run verify:capability` exits 0. Record each result and the final candidate identity. <!-- sdd-owner: implementation -->
- [x] T-S3-009 — Record U4's exit evidence in `apply-progress.md`: the three surfaces read `0.1.0`; RED ① and RED ② verbatim; the guard green; the pair's four results; and the full verification set green — `bun run typecheck`, `bun run test`, `bun run verify:style`, `bun run verify:capability`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`. <!-- sdd-owner: implementation -->
- [x] T-S3-010 — **`REQ-REL-006` boundary check.** Confirm the final diff adds no `publishConfig`, no publish step or job, and no registry publication command; `.github/workflows/release-verify.yml` is byte-identical; `grep -n "Package released" ROADMAP.md` still shows the item unchecked; and no file under `contracts/**`, `openspec/specs/**`, `scripts/compute-candidate-identity.mjs`, or `PARTICIPATION_PATHS_V1` was modified. `git diff --stat` is the evidence. <!-- sdd-owner: implementation -->

**Rollback:** edit C1/C2 back and re-run the **full** pair — never hand-edit `candidateIdentity` to a previous value; a version revert without the refresh leaves `--check`, `__tests__/lock-facts.test.ts`, and `verify:capability` red. `DR-6` rollback is restoring the recorded counts (fails nothing). Guard rollback is deleting `__tests__/harness-version.test.ts`; record the silent drift returning as the accepted cost.

---

## Already-delivered and out-of-scope — no tasks

No task exists for: PRs #70/#69 and merge `70d87ac`; the npm 10.9.x `--legacy-peer-deps` postinstall fix; the `scripts/verify-packed-install.mjs` diagnostics repair; removal of the stray repository-root directory literally named with a single tilde character; the `pi-skills-memory-integration` archive. No task builds a vector runner (D9), a docs-drift guard (U7 declined), publication (D8), a pin upgrade, a `contracts/**` change, a `MASTER_CAPABILITIES` or capability-count change, a `PARTICIPATION_PATHS_V1` rework, or anything touching the archived `pi-skills-memory-integration`. The falsification table (`exploration.md` §4) is binding: no task claims `verify:capability` or `--check` are ungoverned, that the pin or checksum is wrong, that the packed-install proof is aspirational, that `doctor` is not fail-closed, or that fiscal mission recovery is missing.

---

## Parent-owned actions (prose only — deliberately **no** checkbox rows)

These are the parent's, not implementation work, and are recorded here as prose so the native engine never counts them as unchecked implementation rows:

1. **Commit/push route.** Conventional Commits only, no AI attribution (`AGENTS.md:8`, `RELEASING.md:118-119`). Three slices, `feature-branch-chain` (each PR targets the accumulating feature branch), `headSha` must remain an ancestor of any CI branch (`RELEASING.md` step 9).
2. **Bounded review** of each slice after its evidence block exists — Slice 1: prose accuracy and the single-statement rule; Slice 2: the warn/exit-0 contract and the packed-install proof; Slice 3: version agreement, the guard's non-brittleness, and `DR-6`.
3. **Archive step, after verify.** Archiving this change folder moves the generated `activeChanges` inside `docs/architecture/program-lock-facts.json`, so it **forces the recovery pair** — the same indivisible block, run by the parent outside apply authority. `REQ-REL-001` scenario 1 names change-folder lifecycle events precisely because this event fires with no mistake, no budget trip, and no tooling failure.

---

## Exit criteria (from proposal §10 / design §11, unchanged)

`--check` exit 0; `verify:capability` exit 0; `bun run test` / `typecheck` / `verify:style` / `verify:package` / `verify-packed-install.mjs` green; the three version surfaces read `0.1.0`; the sequence stated once and linked twice; no hand-edit instruction in `RELEASING.md`; checklist item 3 names only runnable gates; the three prose items corrected; the absent installer warns and exits 0; no publication surface; no `contracts/**` or `PARTICIPATION_PATHS_V1` modification. **This phase wrote only `openspec/changes/pi-recovery-release-readiness/tasks.md`; it wrote no source, test, spec, config, or lock fact, and committed nothing.**
