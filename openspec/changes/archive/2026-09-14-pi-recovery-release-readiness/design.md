# Design — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6 in the Drenyra Shell program)
**Phase:** design — read-only against the repository. **The only write performed by this phase is this file.**
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`, so Engram is best-effort only)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Inputs read by this phase:** `proposal.md`, `specs/release-readiness/spec.md`, `preproposal.md` (§5 + **D11 binding**), `exploration.md` (§4 falsification table and §5.2 out-of-scope table binding), and the current bytes of every file named for edit in the proposal's §7.
**Authority:** the preproposal's confirmed decision record. No settled decision is re-opened; no new product decision is invented.

**Scope reminder, stated up front so the reader does not expect more.** This design covers four release-facing documents (plus one link-only edit), a version bump across five carriers with one new guard, one small behavioural change to `postinstall`, and one 4-line prose-correction addendum this phase discovered. It deliberately does **not** build recovery (already enforced), a vector runner (D9), a docs-drift guard (U7 declined), a publication path (D8), a pin upgrade, or any change to `contracts/**`, `MASTER_CAPABILITIES`, the capability state counts, or `PARTICIPATION_PATHS_V1`.

**Evidence convention.** Every factual claim below cites a source (`path:line`) or a requirement id. The traceability matrix is §14. Command-shaped claims that require a shell are marked **inherited**; this phase has no execution tool.

---

## 1. Baseline this design builds on — already delivered, not re-planned

The proposal §3 records these as delivered. The design consumes them as baseline and re-plans none of them.

| # | Baseline item | State | Evidence |
| --- | --- | --- | --- |
| B1 | Commit/push boundary (U1): PR #70 → PR #69, merge commit `70d87ac` on protected `main` | **done** | inherited (proposal §3) |
| B2 | npm 10.9.x postinstall crash in Arborist `#loadPeerSet`, fixed with `--legacy-peer-deps` | **done, source-level visible** | `runtime/installer.ts:74-88` (the flag and its rationale comment) |
| B3 | `scripts/verify-packed-install.mjs` diagnostics repaired to surface npm's captured `stdout`/`stderr` verbatim | **done, source-level visible** | `scripts/verify-packed-install.mjs:64-77` |
| B4 | Stray `./~/` tree removed + `~*` ignore guard (U6) | **done** | inherited (proposal §3) |
| B5 | `pi-skills-memory-integration` archived as superseded with explicit absences (D3/D6/D10) | **done** | inherited (proposal §3) |

**Design consequence.** B2 and B3 constrain §6: the `postinstall` warning must be one bounded line and must not change exit 0, because B3's repair exists to make a *package* failure readable and a *source-clone* warning must not be mistaken for it.

**Measured baseline this design is anchored to** (read this phase, no shell):

| Fact | Value | Source |
| --- | --- | --- |
| `package.json#/version` | `0.0.1-prealpha.1` | `package.json:3` |
| `capability-manifest.yaml#/repository/version` | `0.0.1-prealpha.1` | `capability-manifest.yaml:7` |
| `program-lock-facts.json#/packageVersion` | `0.0.1-prealpha.1` | `docs/architecture/program-lock-facts.json:7` |
| Harness-version constants | `0.0.1-prealpha.1` × 2 | `extensions/register.ts:95`, `extensions/fiscal-guard.ts:49` |
| Test-local mirror | `0.0.1-prealpha.1` | `__tests__/configurator.test.ts:26` |
| `DEFAULT_PIN.state` | `released` | `runtime/pin.ts` (`DEFAULT_PIN`), `RUNTIME_VERSION = "0.4.1"` |
| `PARTICIPATION_PATHS_V1` members that this change writes | `package.json`, `capability-manifest.yaml`, `openspec/config.yaml`, `docs/architecture/program-lock-facts.json` | `scripts/compute-candidate-identity.mjs:45-67` |
| `extensions/**` in `PARTICIPATION_PATHS_V1` | **no** | same list — verified member-by-member |
| `RELEASING.md`, `CHANGELOG.md`, `runtime/installer.ts`, `.github/workflows/**`, `docs/architecture/*.md`, `openspec/README.md`, `__tests__/configurator.test.ts` in the allowlist | **no** | same list |

---

## 2. The seven design questions, answered

| # | Question | Answer (detail in §) |
| --- | --- | --- |
| 1 | Canonical location for the recovery sequence | `docs/architecture/program-lock-facts.md` is the one canonical statement. Links (never copies) from `openspec/README.md` and `RELEASING.md`; plus one **newly discovered** restatement must be reduced to a link — `docs/architecture/legacy-capability-surface-inventory.md:99-101`. | §3 |
| 2 | The exact `RELEASING.md` edits | Step 7 rewritten to delegate the trigger set/rationale and invoke the three commands; checklist item 3 rewritten to the four ratified gates. Full replacement text given. | §4 |
| 3 | U4 at D11 width — five carriers + one guard | Four hand-edited carriers + one **generated** carrier (+ the third guarded surface is generated, not hand-edited); the test mirror is converted from a literal to an import; new guard `__tests__/harness-version.test.ts` asserts **code-level equality** via real imports, never prose. | §5 |
| 4 | The `postinstall` warning (D5) | One-line, in-place, stderr-only warning + `process.exit(0)`; the path literal stays inline. Inline is **forced** by `package.json#files` and by `verify-package-files.mjs:242-246`. | §6 |
| 5 | U5 prose corrections | Exact replacement wording for all three items, plus a discovered addendum (U5b) for three further files that assert the old version as a current fact. | §7 |
| 6 | Sequencing and the recovery pair | Six apply units; **two** force the pair (`D5`, `U4`) plus the archive; exact ordered command blocks per unit; the partial-refresh trap named. | §8 |
| 7 | Already-delivered context | §1 — recorded as baseline, not designed again. | §1 |

Plus two design-level discoveries this phase must surface (§16): a **requirement intersection** between `REQ-REL-001` and `REQ-REL-002` that needs an explicit interpretation rule, and a **count-record sync** decision (`DR-6`).

---

## 3. Q1 — Canonical location and exact insertion points

### 3.1 Decision

`docs/architecture/program-lock-facts.md` is the **single canonical, non-archived operating document** that owns the recovery sequence and the `refresh:lock-facts` command. It states:

- **the two trigger classes** (`REQ-REL-001` scenario 1),
- **the four ordered steps** (scenario 2),
- **the ordering rationale** — the mirror is normalization-exempt and omitting it leaves `verify:capability` red with no other symptom (scenario 3),
- **the prohibition** on hand-editing `candidateIdentity`, a checksum or digest, or `headSha` (scenario 4).

Everything else links and delegates. Rationale: that document already owns the command (`docs/architecture/program-lock-facts.md:5-8`), its title is literally *"Refresh the participant checkpoint"*, and it is the only document whose subject *is* the checkpoint.

### 3.2 The restatement this phase discovered (must also be fixed)

`REQ-REL-001` scenario 2 requires the ordered steps in **exactly one** document. Two untouched files currently contain them:

| File | Current content | Verdict |
| --- | --- | --- |
| `docs/architecture/program-lock-facts.md:5-8` | the two commands (no mirror, no ordering rationale) | becomes the canonical statement |
| `docs/architecture/legacy-capability-surface-inventory.md:99-101` | the **full** sequence inline: ``(`bun run refresh:lock-facts` → rewrite the identity-normalized field in `openspec/config.yaml` → `node scripts/refresh-program-lock-facts.mjs --check`)`` | **must be reduced to a link** — no requirement mandates the sequence there, and it is the only other non-archived full statement today (exploration G2) |

The proposal's §7 file table predates this measurement. The design adds the inventory edit to U2. **No other non-archived document states the sequence** (verified: `grep` for `refresh:lock-facts|refresh-program-lock-facts|candidate_identity` outside `**/archive/**` returns only the canonical doc, that inventory line, `scripts/**`, `package.json`, `openspec/config.yaml`'s own mirror line, and this change's own artifacts).

Archived change artifacts also restate it, and are **exempt**: the requirement is scoped to non-archived documents, and the retention bar (`REQ-CONF-008`) forbids editing them.

### 3.3 Exact insertion points and replacement content

#### (a) `docs/architecture/program-lock-facts.md` — canonical statement

**Insertion point.** Replace lines 3-8 (the intro sentence plus its two-command fence) with the block below. Keep line 10 in place ("Run the command only from the canonical Git top-level…") as the tail of the sequence section; keep `## What changes` and `## Boundary` **byte-identical**.

````md
`program-lock-facts.json` is a hand-authored participant checkpoint. Refresh its current repository metadata whenever the tree it describes has moved.

> **This document is the single canonical statement of the lock-fact recovery sequence.** Other documents
> link here. None of them restates the steps, the trigger set, or the ordering rationale.

## When the sequence is mandatory

The sequence below is mandatory after either trigger class:

1. **A participation-path mutation.** Any change to a path listed in `PARTICIPATION_PATHS_V1`
   (`scripts/compute-candidate-identity.mjs`) — by an apply unit, by a formatter or autofix pass, or by
   another session acting outside any attempt.
2. **A change-folder lifecycle event.** Opening or archiving a change under `openspec/changes/` moves the
   generated `activeChanges` field, which lives inside an allowlisted file. This trigger needs no mistake,
   no budget trip, and no tooling failure: it fires on the ordinary first step of every change.

## The sequence (run in this order)

```sh
# 1. Regenerate the checkpoint through the sanctioned generator. Never hand-edit a
#    candidate identity, a checksum or digest, or headSha — the generator derives them.
bun run refresh:lock-facts

# 2. Rewrite the normalization-exempt mirror with the value step 1 produced.
node -e "const{readFileSync,writeFileSync}=require('node:fs');const facts=JSON.parse(readFileSync('docs/architecture/program-lock-facts.json','utf8'));const id=facts.candidateIdentity;const p='openspec/config.yaml';const before=readFileSync(p,'utf8');const after=before.replace(/^(\s*candidate_identity:\s*).*$/m,'$1\"'+id+'\"');if(after===before)throw new Error('openspec/config.yaml has no candidate_identity line to rewrite');writeFileSync(p,after);console.log('config.yaml mirror <- '+id);"

# 3. The checkpoint must now be current — this also proves step 2 did not move the identity.
node scripts/refresh-program-lock-facts.mjs --check

# 4. Full verification.
bun run typecheck && bun run test && bun run verify:style && bun run verify:capability && bun run verify:package && node scripts/verify-packed-install.mjs
```

**Why the order matters.** `openspec/config.yaml#/current_test_state/candidate_identity` is the one field
the identity algorithm normalizes (`normalizeConfigYaml` in `scripts/compute-candidate-identity.mjs`), so
rewriting the mirror does not itself move the candidate identity — but a refresh **without** the mirror
rewrite leaves `bun run verify:capability` red with no other symptom: the generator's own `--check` still
exits 0, because the mirror is not an input to the checkpoint. The mirror must carry exactly the value step 1
produced, and step 3 must follow it. **Steps 1-3 are one indivisible operation.**

Write the mirror **last** among the edits of a unit: every other field of `openspec/config.yaml` (the recorded
counts included) participates in the identity, so the mirror is only stable once those edits are final.
````

**Then keep the existing paragraph** (line 10) verbatim: *"Run the command only from the canonical Git top-level. The default command and explicit `--write` mode atomically update the checkpoint. `--check` is read-only and exits non-zero when the prospective bytes differ…"*

**Why the full verification set is spelled out at step 4:** `REQ-REL-001` requires "full verification" to be part of the ordered sequence, and the release checklist (`RELEASING.md:46`, `:53-102`) plus `release-verify` define what that means. Naming it removes an operator's freedom to stop after `--check`.

#### (b) `openspec/README.md` — reachability from the SDD entry document

**Insertion point.** Between the `## Persistence model` bullet list (ends line 26) and `## Testing & TDD` (line 28). Four lines, link only, no steps:

```md
## Lock facts: the one mandatory post-step

Opening or archiving a change folder, or mutating any path in `PARTICIPATION_PATHS_V1` — including through a
formatter, an autofix pass, or another session — invalidates the generated program lock facts. The mandatory
recovery sequence and the reason its order matters are stated once, in
[docs/architecture/program-lock-facts.md](../docs/architecture/program-lock-facts.md). Run it, in that order,
before claiming a green suite.
```

Says: *when* (both trigger classes, one line each) and *where*. Delegates: the steps, the ordering rationale, the mirror mechanics.

#### (c) `RELEASING.md` — reachability from the release document

**Insertion point.** Inside step 7 (see §4), which `REQ-REL-002` already requires to invoke the sequence. No separate link block is added to the "Current state" section: `REQ-REL-001` asks for reachability and the link inside step 7 is the reachability, placed exactly where an operator performing the only procedure that forces the sequence will read it.

> **Interpretation note (see §16.1).** `REQ-REL-002` mandates that step 7 *contain* the three commands, while `REQ-REL-001` scenario 2 says `RELEASING.md` reaches the canonical document "without restating the steps". The design satisfies both by making step 7 an **invocation** (the commands the pin bump must run) and confining the **normative statement** (trigger set + ordering rationale + the single home of the rule) to the canonical document. Step 7 explicitly states that it does not restate those.

#### (d) `docs/architecture/legacy-capability-surface-inventory.md` — dedupe

**Insertion point.** The "Identity-input candidates" bullet inside `## Removal bar applied to these candidates` (lines 98-101). Replace the parenthetical command chain with a delegation:

```md
- **Identity-input candidates.** A3, B4, D2 and A4's guard coupling touch `capability-manifest.yaml`,
  `scripts/verify-capability-manifest.mjs`, and `__tests__/capability-manifest.test.ts`, all members of
  the candidate-identity participation set. Any future change that mutates them additionally
  invalidates `docs/architecture/program-lock-facts.json` and must run the mandatory recovery sequence —
  stated once, with its trigger set and ordering rationale, in
  [program-lock-facts.md](program-lock-facts.md).
```

**Net result of U2:** the ordered steps exist in exactly one normative document; `RELEASING.md` step 7 holds the pin-bump's invocation (mandated by `REQ-REL-002`); `openspec/README.md` and the inventory delegate by link.

---

## 4. Q2 — The exact `RELEASING.md` edits

Only two regions of `RELEASING.md` change (`RELEASING.md:46` and `:82-87`). Steps 1-6, 8, 9, the "Gotchas" block, the version policy, the "Current state" section, and the "Conditions for a future publish step" section stay **byte-identical** (proposal §6.7).

**Hard constraint discovered by this phase.** `__tests__/release-verify-workflow.test.ts:211` asserts `expect(releasing).not.toContain("npm publish")`, and that test file is itself an identity-allowlisted member. **The replacement text must not contain the literal string `npm publish`.** Neither block below does.

### 4.1 Checklist item 3 (`RELEASING.md:46`) — replacement

Replace the single line `3. **Conformance vectors** — install/doctor/pin verification vectors pass against the exact release candidate.` with:

```md
3. **Conformance gates** — the gates that exist and can be cited as run, all green against the exact
   release candidate:
   - `bun run test` — the full suite, including the install, doctor, pin, and status suites and the
     real-repository capability guard;
   - `bun run verify:package` — build, tests, and packed-file reconciliation;
   - `node scripts/verify-packed-install.mjs` — pack → install → postinstall → runtime verified;
   - `bun run verify:capability` — capability-manifest and projection-surface conformance.
```

**Why these four and no vector runner.** D9 settled it: "conformance vectors" has no executable implementation (exploration G4, falsified candidates table), the invariant is already gated transitively, and building a runner is scope inflation. Each named command resolves: `test`, `verify:package`, `verify:capability` exist in `package.json#/scripts` (`package.json:41,44,45`), and `scripts/verify-packed-install.mjs` exists and runs in CI and `release-verify`.

### 4.2 Pin-bump step 7 (`RELEASING.md:82-87`) — replacement

Replace the whole step with:

````md
7. **Regenerate the program lock-facts through the sanctioned sequence.** The canonical statement of this
   sequence — its trigger set, the reason the mirror is rewritten before `--check`, and the normalization
   exemption that makes that write safe — lives in
   [docs/architecture/program-lock-facts.md](docs/architecture/program-lock-facts.md) and is **not restated
   here**. This pin bump forces the sequence, because `package.json` and `capability-manifest.yaml` are
   participation paths. Run, in this order:

   ```sh
   bun run refresh:lock-facts
   # then rewrite the identity-normalized field
   # openspec/config.yaml#/current_test_state/candidate_identity with the value the generator just
   # produced (exact command: docs/architecture/program-lock-facts.md, step 2)
   node scripts/refresh-program-lock-facts.mjs --check
   ```

   The generator derives `headSha`, `packageVersion`, the generated `activeChanges`, the content-manifest
   and capability-manifest digests, and `candidateIdentity`. **Never hand-edit `candidateIdentity`, a
   checksum or digest, or `headSha`.** A `--check` that exits 0 without the mirror rewrite is not evidence
   of a consistent tree: `bun run verify:capability` is the other half of the proof.
````

**What this fixes (each item is one exploration finding):**

| Defect in the old step 7 | Fixed by |
| --- | --- |
| Instructed a hand-edit of `candidateIdentity` and two digests (G3) | the "never hand-edit" sentence + the generator |
| Omitted the `openspec/config.yaml` mirror, so a documented pin bump leaves `verify:capability` red (G2) | the explicit mirror line |
| Omitted `--check` entirely (G3) | the explicit `--check` command |
| Cited a stale convention — `compute-candidate-identity.mjs` "(last line)" prints one line and is no longer the regeneration route (G3) | the whole step now routes through `refresh:lock-facts` |
| Silent about *why* the order matters (R5 "silent red state") | the trailing sentence naming `verify:capability` as the other half of the proof |

**Note on reachability:** step 8 ("Gates") already names `verify:capability` and `verify:package`; it is unchanged, and it now agrees with checklist item 3 rather than contradicting it.

---

## 5. Q3 — U4 at D11 width: five carriers, four hand-edited, one generated, plus one guard

### 5.1 The carrier census (D11 binding, corrected by measurement)

| # | Carrier | Old | New | How it is set | Guarded today by |
| --- | --- | --- | --- | --- | --- |
| C1 | `package.json#/version` | `0.0.1-prealpha.1` | `0.1.0` | hand-edit (`package.json:3`) | **it is the reference** |
| C2 | `capability-manifest.yaml#/repository/version` | `0.0.1-prealpha.1` | `0.1.0` | hand-edit (`capability-manifest.yaml:7`) | `scripts/verify-capability-manifest.mjs:990-995` |
| C3 | `docs/architecture/program-lock-facts.json#/packageVersion` | `0.0.1-prealpha.1` | `0.1.0` | **generated** by `bun run refresh:lock-facts` | `__tests__/lock-facts.test.ts:156-158`, `:325` |
| C4 | `extensions/register.ts:95` `DRENYRA_PI_VERSION` | `0.0.1-prealpha.1` | `0.1.0` | hand-edit | **nothing** |
| C5 | `extensions/fiscal-guard.ts:49` `VERSION` | `0.0.1-prealpha.1` | `0.1.0` | hand-edit + rename to an exported `FISCAL_GUARD_VERSION` | **nothing** |
| C6 | `__tests__/configurator.test.ts:26` `PACKAGED_VERSION` | `0.0.1-prealpha.1` | *eliminated* — becomes `drenyraPiExtension.version` | import, not a literal | **nothing** (it is a test-local mirror) |

**Correction to the proposal's U4 wording.** The proposal says "edit the three surfaces". The producer derives `packageVersion` (`docs/architecture/program-lock-facts.md:12-14`: "The producer derives only `headSha`, `packageVersion`, sorted immediate `activeChanges`, …"). Only **C1 and C2** are hand-edited; **C3 falls out of the refresh**. Hand-editing C3 would be a forbidden trust-anchor edit and `--check` would then overwrite it. The design states this explicitly so the apply phase does not "edit three surfaces" literally.

### 5.2 Where the guard lives

**New focused test file: `__tests__/harness-version.test.ts`.** Not an extension of `__tests__/extension.test.ts`.

Rationale: the guard has exactly one invariant; a reviewer can read it whole; and `extension.test.ts` is a command-surface suite where a version-agreement assertion would be invisible. Neither file is in `PARTICIPATION_PATHS_V1`, so neither choice moves the candidate identity (see §5.4).

### 5.3 What it asserts, and how it avoids brittleness

Two real imports, one reference value, zero prose parsing:

```ts
// __tests__/harness-version.test.ts — the harness reports its own version; nothing
// else couples the two constants to package.json. This guard is that coupling.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { drenyraPiExtension } from "../extensions/register.js";
import { FISCAL_GUARD_VERSION } from "../extensions/fiscal-guard.js";

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string };
```

It asserts:

1. `drenyraPiExtension.version === pkg.version` — the harness version the operator sees via `/drenyra:capabilities` (`extensions/register.ts:195`, `:648`) equals the package version.
2. `FISCAL_GUARD_VERSION === pkg.version` — the version the fiscal guard's session status prints (`extensions/fiscal-guard.ts:235`) equals the package version.
3. A **triangulated** case: the comparison is factored into a tiny local `versionViolations(version: string): string[]` helper, and the test asserts it returns a violation for a synthetic `"9.9.9"` and none for `pkg.version`. This proves the guard is a detector, not a tautology.

**Why this is not a brittle prose check** (the exploration's R4 / U7 concern):

- No `.md` is read, no sentence is matched, no regex runs over prose. The U7 risk was *"a test that fails when docs drift has to parse prose or hardcode a sentence"*. This guard parses nothing: it imports a typed value from a module.
- The two constants must be **exported values**, not text: `drenyraPiExtension.version` already is (`extensions/register.ts:193-195`); `extensions/fiscal-guard.ts:49` gains an additive `export const FISCAL_GUARD_VERSION` and its single internal use (`:235`) is updated. No `readFileSync` + regex over `.ts` source (the repo does have that idiom in `__tests__/adapter-boundary-audit.test.ts:205`, and this design deliberately does not copy it).
- It asserts the **invariant** (`=== pkg.version`), never the literal `"0.1.0"`. Every future bump leaves the guard untouched — so it cannot become a second place to update and cannot produce a false RED on a legitimate release.
- It covers only the two carriers that have **no** guard. C2's equality is already asserted by `verify:capability` and C3's by `__tests__/lock-facts.test.ts`; re-asserting them here would create a third failure site for the same invariant and blur attribution. The test header names which guard owns which surface.
- U7 stays declined: this is a **code-coupling** guard, not a docs-drift guard, and it is required by D11 rather than by the declined option.

### 5.4 The identity-allowlist asymmetry, and what it implies

| Edit | In `PARTICIPATION_PATHS_V1`? | Effect on the candidate identity | Recovery pair? |
| --- | --- | --- | --- |
| `package.json` (C1, and `D5`'s `postinstall`) | **yes** | moves it | **forced** |
| `capability-manifest.yaml` (C2) | **yes** | moves it; also invalidates `capabilityStates.digestSha256` | **forced** (and its digest is regenerated by the refresh) |
| `extensions/register.ts`, `extensions/fiscal-guard.ts` (C4, C5) | **no** | none | not forced by themselves |
| `__tests__/configurator.test.ts` (C6) | **no** | none | not forced |
| `__tests__/harness-version.test.ts` (new) | **no** | none | not forced |

**Three consequences the apply phase must respect:**

1. The two constant edits are **invisible to the checkpoint**. A future drift of `extensions/**` alone would pass `--check`, pass `verify:capability`, and pass every existing test — the new guard is the *only* coverage for a non-allowlisted carrier. That is the whole reason D11 asks for it.
2. Because the guard test file is not allowlisted, its content never enters the identity digest. It therefore cannot make the identity self-referential, and editing it later never forces a recovery pair. (Contrast: `__tests__/lock-facts.test.ts` and `__tests__/capability-manifest.test.ts` **are** allowlisted, which is why this change must not touch them.)
3. U4 still forces exactly **one** pair for the whole unit — from C1/C2, not from C4/C5/C6. Do not run a pair per file.

### 5.5 U4's exact ordered commands

See §8.3. U4's atomic block is: edit C1, C2 (+ record sync, §5.6) → edit C4, C5, C6 → add the guard test → RED/GREEN evidence → `bun run refresh:lock-facts` → mirror rewrite → `--check` → full verification.

### 5.6 `DR-6` — the recorded count sync (a design decision, cheap to reverse)

`openspec/config.yaml#/current_test_state` is labeled `evidence_scope: current` with `classification: dirty-candidate` and records `files: 50` / `tests: 767` (`openspec/config.yaml:33-41`); `capability-manifest.yaml#/evidenceSnapshot` is `evidenceScope: current` and records `result: "767 passed, 0 failed"` plus a `note` that repeats "767 tests across 50 files" (`capability-manifest.yaml:~176-186`). This change adds two test files, so both records describe a tree that will no longer exist.

**Decision: sync them, inside U4's atomic block.** Exact edits:

| Location | Edit |
| --- | --- |
| `openspec/config.yaml#/current_test_state` | `files` and `tests` → the counts observed in the final full `bun run test`; `evidence_date` → that run's date |
| `capability-manifest.yaml#/evidenceSnapshot` | `result` → `"<N> passed, 0 failed"` (must equal `completeResult(tests, failed)`); `date` → the same run date; the two numbers inside `note` |

Constraints the validator enforces (`scripts/verify-capability-manifest.mjs:838-870`): `config.yaml` `command`, `evidence_date`, `classification` must equal the manifest's, and `completeResult(files.tests, files.failed)` (normalized) must equal `evidenceSnapshot.result`. The live projection markers (`README.md:47`, `ROADMAP.md:12`, `docs/architecture/capability-conformance-matrix.md:15-16`) are the **delegation form** (scope + source, no restated values), so **no projection surface needs editing** for this.

**Reversal cost if a reviewer declines `DR-6`:** zero requirements fail; the design records the staleness in the change's own record instead. It is included because a `current`-scoped snapshot that names counts the tree no longer produces is the same defect class the change exists to remove (proposal §1.3). `DR-6` must be applied **before** `refresh:lock-facts`, because both files participate in the identity.

---

## 6. Q4 — The `postinstall` warning (D5)

### 6.1 The shape

Replace the whole `postinstall` value (`package.json:44`):

```json
"postinstall": "node -e \"const{existsSync}=require('node:fs');const{spawnSync}=require('node:child_process');const t='dist/scripts/install-drenyra-ai.js';if(!existsSync(t)){console.warn('drenyra-shell: WARNING — '+t+' is missing, so the pinned Drenyra AI runtime was NOT installed. Run `bun run build`, then re-run your install.');process.exit(0);}process.exit(spawnSync(process.execPath,[t],{stdio:'inherit'}).status??1)\""
```

Properties, each one a requirement:

| Property | Reason |
| --- | --- |
| `console.warn(...)` — **stderr**, one line | `REQ-REL-004` "visible warning"; `console.warn` writes to stderr, so a caller's captured **stdout** (npm's) is untouched |
| `process.exit(0)` in the branch | `REQ-REL-004` "MUST still exit 0"; CI and `release-verify` run `bun install --frozen-lockfile` **before** any build, so a non-zero exit would fail every job (exploration G12, proposal R6) |
| the literal `dist/scripts/install-drenyra-ai.js` remains inline, once | `scripts/verify-package-files.mjs:242-246` requires `pkg.scripts.postinstall` to be a string **containing** that path; a variable assignment keeps the literal present |
| `spawnSync(...).status ?? 1` + `process.exit` unchanged | `REQ-REL-004` "propagate its exit status" and D5's "keep exit 0" apply only to the absence branch |
| no warning on the present path | `REQ-REL-004` scenario 2 ("prints no missing-installer warning") and `verify-packed-install.mjs`'s postinstall probe |
| the warning names the missing file and the remedy | a diagnostic that cannot be acted on is the defect B3 just fixed in the sibling script |

**Why inline, and why no helper module.** `package.json#files` ships `dist`, `assets`, `contracts`, `prompts`, `skills`, `agents`, `chains`, `vendored`, `themes`, `README.md`, `LICENSE` (`package.json:9-13`) — **not** `scripts/`. `scripts/build.mjs:30-38` copies exactly one script (`scripts/install-drenyra-ai.mjs` → `dist/scripts/install-drenyra-ai.js`). A helper module would therefore require (a) a new build-copy step, (b) an expected-entry update in `scripts/verify-package-files.mjs:50-67`, and (c) a package-file check for the new artifact — three touch points to print one line. The proposal's §12.4 preferred inline; the measurement confirms it. **Inline is forced, not merely preferred.**

**Why it cannot pollute B3's repaired diagnostics.** The warning is one stderr line, emitted only when the compiled installer is absent. In `scripts/verify-packed-install.mjs` the packed artifact **contains** `dist/scripts/install-drenyra-ai.js` (it is in `files`), so the npm install path (`stdio: "pipe"`) and the direct-invocation probe both take the present branch: no warning, no change to captured npm output, no change to the `out.includes("verified")` assertion.

### 6.2 The focused test — `__tests__/postinstall-hook.test.ts`

The test reads `scripts.postinstall` from `package.json` and spawns `node -e <that string>` with `cwd` set to a temp directory (`mkdtempSync(join(tmpdir(), "pi-postinstall-"))`), capturing `stdout`, `stderr`, and `status`.

| Case | Fixture in the temp cwd | Asserts |
| --- | --- | --- |
| **1. Absent installer (the new behaviour, RED first)** | nothing | `status === 0`; `stderr` contains the warning and names `dist/scripts/install-drenyra-ai.js`; `stdout` is empty |
| **2. Present installer** | `dist/scripts/install-drenyra-ai.js` writing a marker to stdout | `status === 0`; `stdout` contains the fixture's marker (the installer really ran); `stderr` contains no warning |
| **3. Triangulation: present installer that fails** | same, but the fixture exits 3 | `status === 3` (status propagation, not swallowed by the `?? 1` fallback) |

Case 2 and 3 run the fixture through `process.execPath` exactly as the script does, so `stdio: "inherit"` in the child inherits the test's pipes — no output leaks into the vitest reporter.

This is the change's only strict-TDD behavioural unit (proposal §6.10): `bun test __tests__/postinstall-hook.test.ts` is RED on case 1 before the `package.json` edit and GREEN after.

---

## 7. Q5 — U5 prose corrections, with exact replacement wording

### 7.1 `runtime/installer.ts:108-115` (doc comment on the live postinstall entry)

**Current closing sentence:** *"Until the first real drenyra-ai release this branch is exercised only through test fixtures; the pending-release branch below is live today."*

**Replacement:**

```ts
/**
 * Run the postinstall for a package root.
 *
 * The "released" branch installs the exact pinned version package-local
 * (drenyra-shell never trusts an ambient binary) and then runs the same doctor()
 * used by /drenyra:doctor — the install is only accepted when the verdict is
 * "verified". The released path is the one in force: `DEFAULT_PIN.state` is
 * "released" in `runtime/pin.ts`, with the entry-artifact checksum pinned, so
 * this function installs the pinned runtime for real. The pending-release branch
 * below is a retained fallback for a pin with no published artifact — its notice
 * is covered by tests — and it is not the live path.
 */
```

Doc comment only; no behaviour change. `REQ-REL-005` scenario 1.

### 7.2 `.github/workflows/ci.yml:49-51` (test job comment)

**Current:** `# (devDependency file:./vendored/drenyra-ai-0.2.0.tgz) — this job`

**Replacement block:**

```yaml
          # The suite imports the pinned drenyra-ai runtime directly
          # (devDependency file:./vendored/drenyra-ai-0.4.1.tgz — keep this version
          # in sync with package.json#devDependencies.drenyra-ai) — this job
          # exercises the REAL pinned runtime library, not a stub.
```

Comment only; no workflow behaviour change. `REQ-REL-005` scenario 2 needs the *same version* in both places, so the literal `0.4.1` stays and a keep-in-sync pointer is added (a version literal in a comment has no guard; the pointer is the only durable mitigation available inside the declined-U7 boundary).

### 7.3 `CHANGELOG.md:31`

**Current:** ``- `themes/Drenyra.json`; `typebox` added as a devDependency for tool`` / `schemas.`

**Replacement:**

```md
  - `themes/fiscal-operator/fiscal-operator-light.json` and
    `themes/fiscal-operator/fiscal-operator-dark.json` (the two Pi themes declared in
    `package.json#pi.themes`); `typebox` added as a devDependency for tool schemas.
```

`REQ-REL-005` scenario 3. Verified: `themes/Drenyra.json` appears **only** at `CHANGELOG.md:31` among non-archived files, and the two replacement paths exist and are the ones `package.json#pi.themes` and `scripts/verify-package-files.mjs:209-213` declare. This is inside the `## Unreleased` section, so correcting it does not rewrite a released record. The historical `## 0.0.1-prealpha.1 — 2026-08-01` entry (including its `drenyra-ai@0.2.0` reference at `:108`) stays **byte-identical**.

### 7.4 `U5b` (discovered) — three further files that state the old version as a current fact

Not named by `REQ-REL-005`, and **not required** by any requirement. Recommended, because after `0.1.0` these lines assert a false current fact on reader-facing surfaces:

| File | Current | Replacement |
| --- | --- | --- |
| `README.md:7-12` | `**Status: pre-alpha (v0.0.1-prealpha.1).**` … `version policy is \`0.0.1-prealpha.x\` until the first frozen contract, then \`0.1.0\`.` | `**Status: contracts frozen, pre-release (\`v0.1.0\`).**` … `Nothing here is production-ready; the two produced contracts are frozen at v0.1, which is the \`0.1.0\` step of the version policy.` |
| `docs/intended-usage.md:27` | `Status is **pre-alpha** (\`0.0.1-prealpha.1\`).` | `Status is **pre-release**: contracts are frozen at v0.1 and the package version is \`0.1.0\`.` |
| `docs/architecture/ecosystem-boundaries.md:273-274` | `Release cadence remains pre-alpha (\`drenyra-shell@0.0.1-prealpha.1\`).` | `Release cadence remains pre-release, with the produced contracts frozen at v0.1 (\`drenyra-shell@0.1.0\`).` |

Safety analysis: none of the three is in `PARTICIPATION_PATHS_V1`, so no recovery pair; `README.md` is a declared projection surface (`capability-manifest.yaml` `currentProjection.surfaces`), and its `conformance:surface` / `conformance:snapshot` markers (`README.md:46-47`) are the delegation form and must be left untouched — the prose edit around them cannot break the marker validation.

**Deliberately unchanged, with reason:**

| Location | Why it keeps the old string |
| --- | --- |
| `CHANGELOG.md:76`, `:119` | a released historical entry and its version-policy note; Keep-a-Changelog entries are immutable |
| `__tests__/extension-mission-status.test.ts:147,158,170` | local **inputs** to `renderCapabilitiesView` plus an assertion that the input round-trips; they do not reference the real constant and stay green either way |
| `__tests__/capability-manifest.test.ts:269,310` | fixture values inside an isolated temp root (`tempRoot(...)`), not the repository. This file is also allowlisted — editing it would force a second recovery pair for no coverage |
| `.github/workflows/release-verify.yml:7` | an illustrative `(for example, v0.0.1-prealpha.1)` in a dispatch input description; no current-fact claim |
| `.git/**` refs/tags | outside phase authority |

---

## 8. Q6 — Sequencing and the recovery pair

### 8.1 Per-unit recovery-pair verdict

Unit labels follow the proposal; `U1`/`U6`/`U7` are closed (delivered / declined) and `U5b`, `U4`'s count sync are in design.

| Unit | Content | Writes a `PARTICIPATION_PATHS_V1` path? | **Recovery pair verdict** |
| --- | --- | --- | --- |
| **U2** | canonical sequence + links + inventory dedupe | no — `docs/architecture/program-lock-facts.md`, `openspec/README.md`, `docs/architecture/legacy-capability-surface-inventory.md` | **not forced** |
| **U3** | `RELEASING.md` step 7 + checklist item 3 | no — `RELEASING.md` | **not forced** |
| **U5** (+`U5b`) | three prose corrections (+ three version-status lines) | no — `runtime/installer.ts`, `.github/workflows/ci.yml`, `CHANGELOG.md`, `README.md`, `docs/intended-usage.md`, `docs/architecture/ecosystem-boundaries.md` | **not forced** |
| **D5** | `postinstall` warning + `__tests__/postinstall-hook.test.ts` | **yes — `package.json`** | **FORCED** |
| **U4** | `0.1.0` across C1-C6 + `__tests__/harness-version.test.ts` + `CHANGELOG.md` entry + `DR-6` count sync | **yes — `package.json`, `capability-manifest.yaml`, and `openspec/config.yaml` through the mirror** | **FORCED** |
| **Archive** (after verify, parent-owned) | archiving this change moves the generated `activeChanges` | **yes — generated inside `docs/architecture/program-lock-facts.json`** | **FORCED** (named as a trigger class by `REQ-REL-001`; outside the apply phase's authority) |

**Why D5 precedes U4.** U4 is the last unit that changes the test suite, so `DR-6`'s count sync — which must precede the refresh, because both recorded files participate in the identity — belongs to U4. Ordering U4 last makes the recorded counts final at the moment they are written. The two units have no other ordering dependency (the `postinstall` string and the version string are independent fields).

### 8.2 The exact ordered commands after a write to an allowlisted path

Identical for `D5`, `U4`, and the archive step — **indivisible**:

```sh
# 0. the unit's own edits are complete, including every recorded count
bun run refresh:lock-facts

# 1. copy the identity the generator just produced into the normalization-exempt mirror
node -e "const{readFileSync,writeFileSync}=require('node:fs');const facts=JSON.parse(readFileSync('docs/architecture/program-lock-facts.json','utf8'));const id=facts.candidateIdentity;const p='openspec/config.yaml';const before=readFileSync(p,'utf8');const after=before.replace(/^(\s*candidate_identity:\s*).*$/m,'$1\"'+id+'\"');if(after===before)throw new Error('openspec/config.yaml has no candidate_identity line to rewrite');writeFileSync(p,after);console.log('config.yaml mirror <- '+id);"

# 2. the checkpoint is current AND the mirror write did not move the identity
node scripts/refresh-program-lock-facts.mjs --check

# 3. full verification — every command a release record can cite
bun run typecheck && bun run test && bun run verify:style && bun run verify:capability && bun run verify:package && node scripts/verify-packed-install.mjs
```

**Never** hand-edit `candidateIdentity`, `checksums.*`, `capabilityStates.digestSha256`, or `headSha`.

> **Measurement note — two premises of this block were falsified during apply (repair unit 3b).** The design
> above is **not** rewritten; it is the record of what was designed, not of what was measured. (1) The step-1
> `node -e "…'$1'+id…"` form is **not shell-safe**: inside a double-quoted shell string `$1` is a positional
> parameter, so the backreference is lost and the whole match — the `candidate_identity:` key and its indentation —
> is replaced by a bare value, leaving `openspec/config.yaml` invalid YAML. The canonical document now uses a
> **single-quoted** payload with the replacement supplied as a **function**, so no dollar pattern can be
> interpreted by the shell or by `String.replace`. (2) "the checkpoint is current **and** the mirror write did not
> move the identity" is true of the mirror's *value* only: membership is decided by `workingTreeChanged()` →
> `git diff --quiet HEAD -- <path>` over raw bytes, so when the mirror write is `openspec/config.yaml`'s **only**
> change the identity moves with it and `refresh → mirror → --check` cannot converge in one pass. The corrected rule
> is to iterate to the fixed point: refresh **again** once the mirror line exists, then `--check`.
>
> Both corrections are normative in
> [docs/architecture/program-lock-facts.md](../../../docs/architecture/program-lock-facts.md), which is the single
> canonical statement of the sequence, the shell-safe command, and the ordering rule.

### 8.3 The trap, stated explicitly

**A partial refresh — facts written, mirror not — leaves `verify:capability` red with no other symptom.**

- `node scripts/refresh-program-lock-facts.mjs --check` **exits 0** (the mirror is not an input to the checkpoint).
- `__tests__/lock-facts.test.ts` stays green (the facts agree with `package.json`).
- Only `bun run verify:capability` fails, with `conflicting current snapshot identity in openspec/config.yaml: <old> != <new>` (`scripts/verify-capability-manifest.mjs:862-867`), and the real-repository capability guard inside `bun run test` fails with the same message (`__tests__/capability-manifest.test.ts:1393`).

So `--check` alone is **not** evidence. Step 2 and step 3 of §8.2 are the two halves of the proof, and the canonical document says so (§3.3a).

**Second trap.** Editing the recorded counts *after* the refresh changes `capability-manifest.yaml` bytes, invalidating `capabilityStates.digestSha256` and the mirror in one step. `DR-6`'s edits must precede `refresh:lock-facts` (§5.6).

**Third trap.** A formatter or autofix run after a unit closes re-classifies an allowlisted file (the exact cause of exploration recovery event 3). No pair is "finished" while a formatter may still run: re-run §8.2 steps 2-3 after any tool that rewrites tracked bytes.

### 8.4 Work-unit / commit grouping (delivery shape only — the parent owns the commit/push route)

| Slice | Units | Character | Pair |
| --- | --- | --- | --- |
| 1 | U2, U3, U5(+`U5b`) | documentation only | none |
| 2 | D5 | one behavioural change + its test | one |
| 3 | U4 | version across C1-C6 + guard + record sync | one |

Three commits keep each slice under the 400-changed-line budget and give each allowlisted write its own recovery-pair evidence block. Conventional Commits only, no AI attribution (`AGENTS.md:8`, `RELEASING.md:118-119`).

---

## 9. Data flow and invariants (what actually couples)

```text
package.json#/version  ──(verify-capability-manifest.mjs:990-995)──>  capability-manifest.yaml#/repository/version
        │                                                                      │
        │  (refresh-program-lock-facts.mjs derives packageVersion)              │ (bytes hashed)
        ▼                                                                      ▼
program-lock-facts.json#/packageVersion                       program-lock-facts.json#/capabilityStates.digestSha256
        │                                                                      
        │  generated: headSha, activeChanges, candidateIdentity                
        ▼                                                                      
program-lock-facts.json#/candidateIdentity                                     [NEW GUARD]
        │                                                                      extensions/register.ts  DRENYRA_PI_VERSION ──┐
        │ (enforced: verify-capability-manifest.mjs:862-867)                    extensions/fiscal-guard.ts FISCAL_GUARD_VERSION ┤
        ▼                                                                                                                      ▼
openspec/config.yaml#/current_test_state/candidate_identity  <──equal──  package.json#/version (the reference)
                 (identity-normalized: rewriting it does NOT move the identity)
```

| Invariant | Enforced by | This change |
| --- | --- | --- |
| `package.json#/version` === `capability-manifest.yaml#/repository/version` | `scripts/verify-capability-manifest.mjs:990-995` | keeps it, via C1+C2 |
| `package.json#/version` === `program-lock-facts.json#/packageVersion` | `__tests__/lock-facts.test.ts:156-158`, `:325` | keeps it, C3 generated |
| lock-facts `capabilityStates.digestSha256` === live manifest bytes | `__tests__/lock-facts.test.ts` (`:224-228`) + refresh | regenerated, never hand-edited |
| `config.yaml` mirror === live `candidateIdentity` | `scripts/verify-capability-manifest.mjs:862-867` | written last, then re-proved by `--check` |
| `config.yaml#/current_test_state` agrees with `evidenceSnapshot` (command/date/classification/result) | `scripts/verify-capability-manifest.mjs:838-870` | `DR-6` keeps them in agreement |
| `activeChanges` === live non-archive change folders | `__tests__/lock-facts.test.ts:261` | archive step forces the pair |
| **`package.json#/version` === both harness-version constants** | **nothing today** | **`__tests__/harness-version.test.ts`** |
| `package.json#/scripts.postinstall` contains `dist/scripts/install-drenyra-ai.js` | `scripts/verify-package-files.mjs:242-246` | kept inline; the warning does not change this |

**Contracts touched: none.** `contracts/**` is unchanged (`REQ-REL-006`, proposal §5.1). No new runtime/package contract surface, no `publishConfig`, no publish step.

---

## 10. File-change manifest

| Path | Unit | Allowlisted | Kind of change |
| --- | --- | --- | --- |
| `docs/architecture/program-lock-facts.md` | U2 | no | canonical recovery sequence (trigger set, ordered steps, rationale) |
| `docs/architecture/legacy-capability-surface-inventory.md` | U2 | no | dedupe: inline sequence → link |
| `openspec/README.md` | U2 | no | reachability (when + link) |
| `RELEASING.md` | U3 (+U2 reachability inside step 7) | no | step 7 rewritten; checklist item 3 rewritten |
| `runtime/installer.ts` | U5 | no | doc comment only |
| `.github/workflows/ci.yml` | U5 | no | comment only |
| `CHANGELOG.md` | U5 (themes line), U4 (`0.1.0` entry) | no | correction + new entry |
| `README.md`, `docs/intended-usage.md`, `docs/architecture/ecosystem-boundaries.md` | U5b (recommended) | no | three version-status prose lines |
| `package.json` | D5, U4 | **yes** | `postinstall` warning; `version` `0.1.0` |
| `capability-manifest.yaml` | U4 | **yes** | `#/repository/version`; `DR-6` snapshot counts |
| `extensions/register.ts` | U4 | no | `DRENYRA_PI_VERSION` → `0.1.0` |
| `extensions/fiscal-guard.ts` | U4 | no | `VERSION` → exported `FISCAL_GUARD_VERSION`, value `0.1.0` |
| `__tests__/configurator.test.ts` | U4 | no | literal mirror → import of the real constant |
| `__tests__/harness-version.test.ts` | U4 | no | **new** guard (C4/C5 ↔ `package.json#/version`) |
| `__tests__/postinstall-hook.test.ts` | D5 | no | **new** focused test (warn + exit 0 + status propagation) |
| `openspec/config.yaml` | U4 (pair) | **yes** | mirror + `DR-6` counts |
| `docs/architecture/program-lock-facts.json` | U4 (pair) | **yes** | generated by `refresh:lock-facts` only |
| `openspec/changes/pi-recovery-release-readiness/**` | — | no | this change's own artifacts |

**Untouched:** `contracts/**`, `openspec/specs/**`, `MASTER_CAPABILITIES`, capability state counts (8/2/0), `PARTICIPATION_PATHS_V1`, `scripts/compute-candidate-identity.mjs`, `scripts/verify-capability-manifest.mjs`, `__tests__/capability-manifest.test.ts`, `__tests__/lock-facts.test.ts`, `__tests__/release-verify-workflow.test.ts`, `.github/workflows/release-verify.yml`, `ROADMAP.md` (its npm item stays unchecked), every archived change, `pi-skills-memory-integration`, and `.git/**`.

---

## 11. Tests and evidence plan (strict TDD is active — `openspec/README.md:28`)

| Unit | RED (record verbatim) | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| U2, U3, U5, `U5b` | none — documentation; the "test" is the reviewer's read plus `REQ-REL-00x` scenario checks | text edits | — | — |
| D5 | `bun test __tests__/postinstall-hook.test.ts` → case 1 fails (no warning on stderr, `stderr === ""`) | `postinstall` warning + `exit(0)` | case 3: a failing fixture installer must propagate status 3 | extract the runner helper in the test |
| U4 | ① `package.json#/version` → `0.1.0` alone, then `bun run verify:capability` → `repository version 0.0.1-prealpha.1 does not match package.json version 0.1.0`; and `bun test __tests__/lock-facts.test.ts` → `packageVersion must equal package.json version (0.1.0)`. ② add `__tests__/harness-version.test.ts` → RED for C4 (`expected 0.0.1-prealpha.1 to be 0.1.0`), then extend it for C5 → RED (module exposes no `FISCAL_GUARD_VERSION`) | C2, C3 (refresh), C4, C5, C6, guard, `CHANGELOG.md` entry | `versionViolations("9.9.9")` returns a violation; `versionViolations(pkg.version)` returns none | `readPackageVersion()` helper in the test |

**Mandatory evidence per unit** (recorded in `apply-progress.md`): the command, its verbatim result, and — for D5 and U4 — the RED output before the GREEN edit. `REQ-REL-003`'s "partial bump fails closed" scenario is satisfied by RED ①, which is captured on purpose.

**Exit criteria** (proposal §10, unchanged): `--check` exit 0; `verify:capability` exit 0; `bun run test` / `typecheck` / `verify:style` / `verify:package` / `verify-packed-install.mjs` green; three surfaces read `0.1.0`; the sequence stated once and linked twice; no hand-edit instruction in `RELEASING.md`; checklist item 3 names only runnable gates; three prose items corrected; absent installer warns and exits 0; no publication surface; no `contracts/**` or `PARTICIPATION_PATHS_V1` modification.

---

## 12. Rollout, rollback, boundaries

**Rollout.** Three reviewable slices (§8.4). No migration for consumers: no contract, no pin, no API, no `package.json#exports` change. The only consumer-visible behaviour delta is a stderr warning on a source clone without a build, and `extensions/fiscal-guard.js` gaining one named export.

**Rollback.**

| Unit | Rollback | Correctness condition |
| --- | --- | --- |
| U2, U3, U5(+`U5b`) | `git revert` of their commits | the canonical statement and its links revert together, so no dangling pointer survives |
| D5 | restore the one-line `postinstall` | restores the previously accepted fail-open (exploration G12) — a known state, not a regression |
| U4 | edit C1/C2 back and re-run the **full** pair | never hand-edit `candidateIdentity` to a previous value; a version revert without the refresh leaves `--check`, `lock-facts.test.ts`, and `verify:capability` red |
| `DR-6` | restore the recorded counts | no requirement depends on it; `verify:capability` stays green either way |
| guard test | delete the file | the drift it prevents returns silently — record that as the accepted cost |

**Hard boundaries honored:** no publish step, no `publishConfig`, no dist-tag or tag operation, no registry command, `ROADMAP.md`'s npm item untouched; `release-verify.yml` remains a pure verification gate; no pin upgrade; no `contracts/**` change; no `MASTER_CAPABILITIES` or capability-count change; no `PARTICIPATION_PATHS_V1` rework; no vector runner (D9); no docs-drift guard (U7 declined); no touching of `pi-skills-memory-integration` or any archived change; nothing committed by this phase.

---

## 13. Risks

| # | Risk | Severity | Mitigation in this design |
| --- | --- | --- | --- |
| S1 | **The mirror step is skipped** after a pair-forcing unit → `verify:capability` red with no other symptom | High | §8.2 treats steps 1-3 as indivisible; §8.3 names the exact symptom; the canonical doc records it as "the trap" |
| S2 | **Counts edited after the refresh** → digest and mirror invalidated in one step | Medium | `DR-6` is explicitly placed *before* `refresh:lock-facts` (§5.6, §8.3) |
| S3 | **A partial version bump** (C1 but not C2, or C3 hand-edited) | High | §5.1 corrects the proposal's "three surfaces" wording: C1+C2 hand-edited, C3 generated, `--check` proves it |
| S4 | **The new guard is written as a prose/source-regex check** and starts failing on legitimate rewording | Medium | §5.3 mandates real imports and forbids `readFileSync`-over-`.ts`; the guard asserts `=== pkg.version`, never `"0.1.0"` |
| S5 | **`RELEASING.md`'s repair damages the release document** | Medium | §4 changes exactly two regions; steps 1-6/8/9, gotchas, version policy stay byte-identical; the `not.toContain("npm publish")` guard is respected |
| S6 | **The warning breaks the frozen install or the packed-install diagnostics** | High | §6: stderr-only, one line, exit 0 preserved, literal path kept for `verify-package-files.mjs`; packed artifact takes the present branch |
| S7 | **The `REQ-REL-001` / `REQ-REL-002` intersection is read strictly by the verify phase** | Medium | §16.1 states the interpretation rule and the verification consequence; the design minimizes the conflict (canonical doc owns the trigger set and rationale; `RELEASING.md` holds only the pin bump's invocation, and says so) |
| S8 | **A third restatement survives**, failing `REQ-REL-001` scenario 2 | Medium | §3.2 enumerates every non-archived occurrence and the design fixes the only other one |
| S9 | **The npm buffering caveat**: npm may buffer lifecycle-script output on success, so the warning's visibility is `bun install`-shaped | Low | recorded in §16.2 as an accepted limitation of D5's chosen mode; exit-non-zero is forbidden by the decision |
| S10 | **Scope inflation** (the change's own R9) | High | §1 and §15, plus three explicit deferrals: U7 declined, no vector runner, `U5b` marked reversible |
| S11 | **Evidence inheritance** — the §1 baseline rows are inherited except the file-read rows this phase measured | Medium | the verify phase must re-measure every inherited row before citing it |
| S12 | **`DR-6` is judged out of scope** | Low | it is reversible at zero requirement cost; the design states the consequence of dropping it |

---

## 14. Traceability — requirement → unit → evidence

| Requirement | Unit(s) | Evidence the verify phase can run or read |
| --- | --- | --- |
| `REQ-REL-001` trigger set named | U2 | read `docs/architecture/program-lock-facts.md` §"When the sequence is mandatory" (both classes) |
| `REQ-REL-001` sequence appears once | U2 | `grep -rn "refresh:lock-facts" --include=*.md .` (excluding `**/archive/**`) → the canonical doc, `RELEASING.md` step 7 (an invocation, mandated by `REQ-REL-002`), and link-only mentions in `openspec/README.md` and the legacy inventory |
| `REQ-REL-001` ordering rationale | U2 | the canonical doc's "Why the order matters" paragraph, naming `normalizeConfigYaml` and the `verify:capability` symptom |
| `REQ-REL-001` no trust-anchor hand-edit | U2 | the canonical doc's step 1 comment + the closing "Never hand-edit…" sentence |
| `REQ-REL-002` step 7 invokes the generator + mirror + `--check` | U3 | read `RELEASING.md` step 7 |
| `REQ-REL-002` no hand-edit instruction survives | U3 | `grep -n -e candidateIdentity -e headSha -e "sha256 of the current" RELEASING.md` → only the prohibition sentence and the generator's derived-field list |
| `REQ-REL-002` checklist names only runnable gates | U3 | read item 3; each name resolves in `package.json#/scripts` or `scripts/` |
| `REQ-REL-003` three surfaces read `0.1.0` | U4 | `node -e` reads of the three surfaces, or the existing guards |
| `REQ-REL-003` partial bump fails closed | U4 | recorded RED ① output (`verify:capability` + `lock-facts.test.ts`) |
| `REQ-REL-003` derived fields regenerated | U4 | `node scripts/refresh-program-lock-facts.mjs --check` exit 0 after the mirror write |
| `REQ-REL-003` changelog records the bump, no release claimed | U4 | read the `## 0.1.0` entry |
| `REQ-REL-004` absent → warn + exit 0 | D5 | `bun test __tests__/postinstall-hook.test.ts` case 1 |
| `REQ-REL-004` present → unchanged | D5 | case 2 (executes, no warning) |
| `REQ-REL-004` frozen install still succeeds | D5 | `bun install --frozen-lockfile` exit 0 on a clean checkout (**inherited** until the verify phase runs it) |
| `REQ-REL-004` packed-install proof stays green | D5 | `node scripts/verify-packed-install.mjs` exit 0 |
| `REQ-REL-005` installer comment | U5 | read `runtime/installer.ts` doc comment against `runtime/pin.ts` `DEFAULT_PIN.state` |
| `REQ-REL-005` CI comment | U5 | `grep -n "vendored/drenyra-ai" .github/workflows/ci.yml package.json` → both `0.4.1` |
| `REQ-REL-005` changelog themes | U5 | `grep -n "themes/" CHANGELOG.md`; each path resolves under `themes/` |
| `REQ-REL-006` no publication surface | all | `git diff` shows no `publishConfig`, no publish step, no workflow change; `grep -n "Package released" ROADMAP.md` → unchecked |
| `REQ-REL-006` verification-only gate preserved | all | `.github/workflows/release-verify.yml` unmodified |

**D11 guard (not a numbered requirement, binding via the preproposal):** `__tests__/harness-version.test.ts` green, and RED before C4/C5 were fixed.

---

## 15. Out of scope — bound to the exploration's and proposal's tables

Carried verbatim in effect: any pin upgrade; any change to `contracts/**` or `contracts/SHA256SUMS.json`; any change to the ten-name `MASTER_CAPABILITIES` set or the capability state counts; any rework of `PARTICIPATION_PATHS_V1` or the candidate-identity algorithm; fiscal/operational recovery (`REQ-MISS-007`, `REQ-CMD-007` — implemented, specified, tested); enabling npm publication, `publishConfig`, or a publish step (D8); a "conformance vectors" runner (D9); `postinstall` failing closed (D5); an executable docs-drift guard, including the optional narrow static assertion (U7 declined — the proposal declined it and `specs/release-design/spec.md` "Out of Scope" repeats it); the commit/push boundary, the `./~/` cleanup, and the superseded-change archive (delivered, recorded as baseline); and anything involving the archived `pi-skills-memory-integration`.

The falsification table (`exploration.md` §4) is binding: this design does not claim `verify:capability` or `--check` are ungoverned, does not claim the pin/checksum is wrong, does not treat the packed-install proof as aspirational, does not claim `doctor` is not fail-closed, does not claim fiscal mission recovery is missing, and does not propose a new capability row.

---

## 16. Design-level items the verify phase must apply or arbitrate

### 16.1 The `REQ-REL-001` / `REQ-REL-002` intersection (needs a recorded interpretation)

`REQ-REL-001` scenario 2 requires the ordered steps in **exactly one** document and says `RELEASING.md` "reaches that document by link without restating the steps". `REQ-REL-002` scenario 1 requires `RELEASING.md`'s step 7 to **invoke** `bun run refresh:lock-facts`, **include** the mirror rewrite, and **include** `--check`. Read literally and maximally, the two cannot both hold.

**Interpretation this design applies, and recommends the verify phase record:**

> `REQ-REL-001` governs the **normative statement** — the trigger set, the ordered steps as the repository rule, and the ordering rationale — and that statement lives in exactly one document. `REQ-REL-002` governs the **release procedure's invocation** of that rule: step 7 names the three commands because the pin bump must run them, and explicitly declines to restate the trigger set or the rationale.

**Verification consequence.** `REQ-REL-001` scenario 2 is checked as: the *trigger set* and the *ordering rationale* text appear in exactly one document, and the other documents reach it by link. `REQ-REL-002` scenario 1 is checked as: step 7 contains the three commands. The design already minimizes the overlap: after U2, the only documents containing the commands at all are the canonical doc and step 7 (the inventory restatement is removed), and step 7 carries the delegation sentence.

**If the verify phase instead applies the strictest possible reading** (no ordered commands anywhere but the canonical document), the required change is one edit: step 7 keeps its link, its "not restated here" sentence, and its three obligations in prose (*"the sanctioned generator has run"*, *"the mirror carries the value the generator produced"*, *"`--check` exits 0"*). Flag this to the parent rather than silently choosing; it is a spec-authoring conflict, not an implementation detail.

### 16.2 Accepted limitation of D5's chosen mode

`console.warn` writes to stderr. npm 7+ may buffer lifecycle-script output and only surface it on failure or with `--foreground-scripts`; `bun install` prints it. The requirement is satisfied at the level the change controls (the hook prints; the direct execution is asserted by the focused test). Exit-non-zero — which would guarantee visibility — is forbidden by D5 because CI and `release-verify` install before they build. Recorded here so a reviewer sees the trade-off rather than rediscovering it.

### 16.3 `DR-6` is a judgement call, not a requirement

Nothing in the six requirements or their 21 scenarios depends on the recorded counts. `DR-6` is recommended because a `current`-scoped snapshot naming counts the tree no longer produces is the defect class this change exists to remove. Declining it costs nothing and fails nothing; the design records that either way so the choice is explicit.

---

## 17. Self-check against the phase's hard boundaries

- **No publication designed.** No publish step, no `publishConfig`, no dist-tag or tag operation, no registry command; `ROADMAP.md`'s npm item untouched; `release-verify.yml` untouched (§12).
- **No pin upgrade designed.** The pin, its checksum, `RUNTIME_VERSION`, and the contract's reference table are correct today and are read-only inputs here (§1).
- **No `contracts/**`, `MASTER_CAPABILITIES`, or capability-count change.** The ten names and the 8/2/0 counts are untouched; `verify:capability`'s manifest assertions are preserved, not relaxed (§9, §10).
- **No `PARTICIPATION_PATHS_V1` rework, no candidate-identity algorithm change.** The allowlist is read as an input and never written (§5.4).
- **No fiscal/operational recovery designed.** `REQ-MISS-007` / `REQ-CMD-007` are named only as out of scope (§15).
- **U7 declined, no vector runner.** No executable gate was invented: the six requirements' two command-checkable parts (`REQ-REL-003`, `REQ-REL-004`) carry executable evidence; the other four carry structural assertions and explicit read/grep checks (§11, §14).
- **Read-only.** This phase wrote only `openspec/changes/pi-recovery-release-readiness/design.md`. No source, test, spec, canonical spec, config, or lock fact was written. Nothing was committed. No child subagent was launched.
