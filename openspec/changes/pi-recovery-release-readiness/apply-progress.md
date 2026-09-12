# Apply Progress — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6)
**Phase:** apply — **Slices 1 and 2**. Slice 1 (U2 + U3 + U5 + U5b, documentation) is recorded in §1–§11 exactly as written; Slice 2 (D5, the `postinstall` warning, `REQ-REL-004`) is appended in §12–§25.
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Branch:** `feat/sdd-6-recovery-release-readiness`
**Authority:** `design.md` (the authority for this phase), `tasks.md` (Slice 1 and Slice 2 rows), `specs/release-readiness/spec.md` (`REQ-REL-001`, `REQ-REL-002`, `REQ-REL-005` for Slice 1; `REQ-REL-004` for Slice 2).
**Committed / branched / pushed by this phase:** **no.** No `git add`, `git commit`, `git push`, branch, or PR was run.
**Child subagents launched:** none.

---

## 1. Status and action context consumed

Structured SDD status (injected by the parent, `gentle-pi.sdd-status`, schemaVersion 1):

- `changeName`: `pi-recovery-release-readiness`
- `artifactStore`: `openspec`; `applyState`: `ready`; `nextRecommended`: `sdd-apply`
- `isNonAuthoritative`: `false`; `blockedReasons`: `[]`
- `actionContext.mode`: `repo-local`; `workspaceRoot`: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`; `allowedEditRoots`: `[/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi]`; `warnings`: `[]`
- `taskProgress`: 26 implementation tasks, 0 complete at start; **9 are Slice 1** and were assigned to this run.
- `deferredParentActions`: 0/0.

All Slice 1 edits landed inside `allowedEditRoots`. No target file fell outside the authoritative workspace or the Slice 1 allowlist.

### Review Workload Gate (from `tasks.md`)

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

The session preflight resolves delivery as `auto-chain` + `feature-branch-chain`, so the chained path is already selected. This run implements **only** the assigned Slice 1 work-unit slice; the PR boundary is recorded in §8.

---

## 2. Strict TDD: not applicable to Slice 1 (stated rationale, no test manufactured)

**No RED/GREEN cycle applies to this slice.** Every unit in Slice 1 (U2, U3, U5, U5b) changes documentation, doc comments, a workflow comment, and changelog/README prose only. There is **no production behaviour, schema, vocabulary, diagnostic, or contract change**, so there is nothing to write a failing test against. No test was manufactured.

Strict TDD (`openspec/config.yaml`, `openspec/README.md:28`) applies to Slices 2 and 3 — the `postinstall` hook (`REQ-REL-004`) and the version guard (`REQ-REL-003`) — which this run did **not** execute. The Slice 1 "test" is the reviewer's read plus the `REQ-REL-00x` scenario checks recorded in §4.

---

## 3. Completed tasks and persisted checkbox updates

All nine Slice 1 rows are now `- [x]` in `openspec/changes/pi-recovery-release-readiness/tasks.md` (persisted, verified by re-read; see §6). Slice 2 (7 rows) and Slice 3 (10 rows) remain `- [ ]`.

| Task | Persisted checkbox | Deliverable |
| --- | --- | --- |
| T-S1-001 | `- [x]` | `git status --short` recorded; attribution unambiguous (§5) |
| T-S1-002 | `- [x]` | Canonical recovery statement in `docs/architecture/program-lock-facts.md` |
| T-S1-003 | `- [x]` | Inventory restatement reduced to a link |
| T-S1-004 | `- [x]` | `openspec/README.md` reachability block (when + link, no steps) |
| T-S1-005 | `- [x]` | `RELEASING.md` checklist item 3 → four ratified gates |
| T-S1-006 | `- [x]` | `RELEASING.md` pin-bump step 7 → sanctioned sequence invocation |
| T-S1-007 | `- [x]` | Three stale release-facing items corrected (installer comment, CI comment, changelog themes) |
| T-S1-008 | `- [x]` | U5b version-status prose (three files) — **included**, not declined |
| T-S1-009 | `- [x]` | Slice 1 verification set (a)–(f) recorded |

### Checkbox evidence

Re-read of `tasks.md` after the update:

```
checked S1: 9
unchecked S1: 0
unchecked S2: 7
unchecked S3: 10
```

26 implementation rows total (9 + 7 + 10), matching the status engine.

---

## 4. Files changed (all inside the Slice 1 allowlist)

`git diff --stat`:

```
 .github/workflows/ci.yml                           |  3 +-
 CHANGELOG.md                                       |  5 +--
 README.md                                          |  5 ++-
 RELEASING.md                                       | 33 +++++++++++++++----
 docs/architecture/ecosystem-boundaries.md          |  4 +--
 .../legacy-capability-surface-inventory.md         |  6 ++--
 docs/architecture/program-lock-facts.md            | 38 +++++++++++++++++++++-
 docs/intended-usage.md                             |  2 +-
 openspec/README.md                                 |  8 +++++
 runtime/installer.ts                               |  7 ++--
 10 files changed, 89 insertions(+), 22 deletions(-)
```

| File | Unit | Change |
| --- | --- | --- |
| `docs/architecture/program-lock-facts.md` | U2 | Lines 3-8 replaced by the canonical statement: "single canonical statement" banner, the two trigger classes, the four ordered steps, the "Why the order matters" paragraph naming `normalizeConfigYaml`, the mirror-last note, and the closing prohibition. Line 10 ("Run the command only from the canonical Git top-level…") kept as the tail; `## What changes` / `## Boundary` byte-identical. |
| `docs/architecture/legacy-capability-surface-inventory.md` | U2 | The "Identity-input candidates" bullet reduced to a link delegation (ordered sequence removed — the dedupe that `REQ-REL-001` scenario 2 requires). |
| `openspec/README.md` | U2 | New `## Lock facts: the one mandatory post-step` block (when + link only) inserted after the Persistence-model bullets, before `## Testing & TDD`. |
| `RELEASING.md` | U3 | Checklist item 3 → four ratified gates; pin-bump step 7 → sanctioned-sequence invocation with delegation sentence, mirror line, `--check`, derived-field list, "never hand-edit", and the "other half of the proof" closing. Steps 1-6, 8, 9, Gotchas, version policy, "Current state", and "Conditions for a future publish step" untouched. |
| `runtime/installer.ts` | U5 | Doc comment on the postinstall entry: the released branch is now described as in force; the pending-release branch as a retained fallback, not the live path. **Comment only — no behaviour change.** |
| `.github/workflows/ci.yml` | U5 | Test-job comment corrected to `vendored/drenyra-ai-0.4.1.tgz` + keep-in-sync pointer to `package.json#devDependencies.drenyra-ai`. **Comment only — no workflow behaviour change.** |
| `CHANGELOG.md` | U5 | `themes/Drenyra.json` (non-existent) → the two real themes. Unreleased-section correction; the historical `## 0.0.1-prealpha.1 — 2026-08-01` entry and its `drenyra-ai@0.2.0` reference stay byte-identical. |
| `README.md` | U5b | Status line → contracts-frozen pre-release (`v0.1.0`); closing policy sentence updated. `conformance:surface` / `conformance:snapshot` markers untouched. |
| `docs/intended-usage.md` | U5b | Status cell → pre-release, contracts frozen at v0.1, version `0.1.0`. |
| `docs/architecture/ecosystem-boundaries.md` | U5b | Release-cadence line → pre-release with contracts frozen at v0.1 (`drenyra-pi@0.1.0`). |

### Not touched (confirmed absent from `git status`)

`contracts/**`, `scripts/**`, `package.json`, `capability-manifest.yaml`, `docs/architecture/program-lock-facts.json`, `openspec/config.yaml`, `extensions/**`, `__tests__/**`, `.github/workflows/release-verify.yml`, `ROADMAP.md`. The only untracked entry is a pre-existing `?? .pi/`.

---

## 5. T-S1-001 — `git status --short` and attribution

Recorded at the start of this run (before any edit):

```
?? .pi/
```

No pre-existing **tracked** modification overlapped the Slice 1 allowlist. (The pi-lens autofix notice claimed it had reformatted four files outside this turn, including `scripts/verify-packed-install.mjs`; the measured `git status` shows **no** such modification in the working tree, and `git log` shows that formatter pass was **already committed** as `6b3b2d5 style(runtime): apply the formatter pass to the installer and packed-install gate`. Attribution is therefore unambiguous: this run's working-tree delta contains only the 10 files in §4.) `T-S1-001` is complete.

---

## 6. T-S1-009 — Slice 1 verification, verbatim results

### (a) Ordered steps appear once

```
$ grep -rn "refresh:lock-facts" --include=*.md . --exclude-dir=archive | grep -v openspec/changes/pi-recovery-release-readiness/
./docs/architecture/program-lock-facts.md:24:bun run refresh:lock-facts
./RELEASING.md:96:   bun run refresh:lock-facts
```

The ordered steps (trigger set + sequence + rationale) exist in exactly one normative document — `docs/architecture/program-lock-facts.md`. `RELEASING.md` step 7 holds the pin-bump's **invocation** (mandated by `REQ-REL-002`, per DECISION-1), and explicitly states the trigger set and rationale are not restated there. `openspec/README.md:30` and the inventory `docs/architecture/legacy-capability-surface-inventory.md:101` reach the canonical doc **by link only**; neither contains the ordered sequence:

```
$ grep -n "refresh:lock-facts\|refresh-program-lock-facts" openspec/README.md
NONE (good)

$ grep -n "refresh:lock-facts\|refresh-program-lock-facts" docs/architecture/legacy-capability-surface-inventory.md
38:- `scripts/refresh-program-lock-facts.mjs`          # script reference, not a step
58:| A4 | … `program-lock-facts.json` preserved …     # citation
111:| Candidate-identity inputs untouched | `node scripts/refresh-program-lock-facts.mjs --check` | …   # a single --check citation, not the ordered sequence
```

### (b) `RELEASING.md` trust-anchor mentions

```
$ grep -n -e candidateIdentity -e headSha -e "sha256 of the current" RELEASING.md
103:   The generator derives `headSha`, `packageVersion`, the generated `activeChanges`, the content-manifest
104:   and capability-manifest digests, and `candidateIdentity`. **Never hand-edit `candidateIdentity`, a
105:   checksum or digest, or `headSha`.** A `--check` that exits 0 without the mirror rewrite is not evidence
109:9. **Delivery.** Conventional commit + PR chain. The lock-facts `headSha` must
110:   be an **ancestor** of any CI branch: stack dependent PRs (or point `headSha`
```

Only the prohibition sentence, the generator's derived-field list, and the (byte-identical) step-9 ancestor note remain. No hand-edit instruction survives. `sha256 of the current` is absent.

### (c) `CHANGELOG.md` themes

```
$ grep -n "themes/" CHANGELOG.md
31:  - `themes/fiscal-operator/fiscal-operator-light.json` and
32:    `themes/fiscal-operator/fiscal-operator-dark.json` (the two Pi themes declared in
111:  - Placeholder asset dirs (assets/, prompts/, skills/, agents/, chains/, themes/) per the README layout.
```

Lines 31-32 resolve under `themes/fiscal-operator/`; line 111 is a directory list, not a theme path.

### (d) CI comment vs pinned devDependency

```
$ grep -n "vendored/drenyra-ai" .github/workflows/ci.yml package.json
.github/workflows/ci.yml:51:      # (devDependency file:./vendored/drenyra-ai-0.4.1.tgz — keep this version
package.json:67:    "drenyra-ai": "file:./vendored/drenyra-ai-0.4.1.tgz",
```

Both `0.4.1`.

### (e) Focused release-verify test

```
$ bun test __tests__/release-verify-workflow.test.ts
 9 pass
 0 fail
 64 expect() calls
Ran 9 tests across 1 file. [48.00ms]
```

### (f) Typecheck and style

```
$ bun run typecheck
$ tsc --noEmit
typecheck exit=0

$ bun run verify:style
verify-style: OK (diff-scoped · 107 owned files · 4 rules)
verify:style exit=0
```

### Additional consumer guard

```
$ grep -n "npm publish" RELEASING.md
ABSENT (good)
```

`__tests__/release-verify-workflow.test.ts:211`'s `not.toContain("npm publish")` assertion is satisfied.

---

## 7. Full verification set (prompt-required) — verbatim

```
$ bun test
 767 pass
 0 fail
 3717 expect() calls
Ran 767 tests across 50 files. [10.17s]
bun test exit=0
```

```
$ bun run typecheck
$ tsc --noEmit
typecheck exit=0
```

```
$ bun run verify:capability
$ node scripts/verify-capability-manifest.mjs
verify-capability-manifest: OK
verify:capability exit=0
```

```
$ bun run verify:style
verify-style: OK (diff-scoped · 107 owned files · 4 rules)
verify:style exit=0
```

```
$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts
lock-facts --check exit=1
```

```
$ git status --short
 M .github/workflows/ci.yml
 M CHANGELOG.md
 M README.md
 M RELEASING.md
 M docs/architecture/ecosystem-boundaries.md
 M docs/architecture/legacy-capability-surface-inventory.md
 M docs/architecture/program-lock-facts.md
 M docs/intended-usage.md
 M openspec/README.md
 M runtime/installer.ts
?? .pi/
```

### `git status` delta against the allowlist

Every modified path is one of the 10 Slice 1 allowlisted documentation files. Nothing outside the allowlist changed; nothing was staged, committed, reverted, or deleted. `?? .pi/` is a pre-existing untracked directory, not part of this change.

### The `--check` staleness is pre-existing, not caused by Slice 1 — measured

`node scripts/refresh-program-lock-facts.mjs --check` exits 1 here. The prompt pre-declares this condition: *"`--check` may report stale after any commit in the branch's history; `bun test` is the authoritative gate for a committed state because the lock-fact test accepts an ancestor `headSha`."* This run confirmed the cause rather than assuming it.

1. **The recorded `headSha` is an ancestor of HEAD.** Recorded: `deddc86090d1914781ebf3c071a1de91f3c089fd`; HEAD: `6b3b2d58bb644f8149a537485e8f33713cee33c5`. `git merge-base --is-ancestor deddc860 HEAD` → **YES**.
2. **HEAD moved after the last lock-facts refresh.** The refresh that recorded `deddc860` is `e48ed25 chore(lock-facts): refresh the generated checkpoint and identity mirror`; five commits followed (including `6b3b2d5 style(runtime): …` — the committed pi-lens formatter pass).
3. **The script derives `headSha` from HEAD.** `scripts/refresh-program-lock-facts.mjs:91` runs `git rev-parse HEAD`; `:148` sets `headSha: gitHead(root)`.
4. **Only git-derived fields differ.** Using the script's own read-only `deriveProgramLockFacts(cwd)` and diffing `currentBytes` vs `finalBytes`:

   ```
   FIELD DIFF: headSha
     recorded:    "deddc86090d1914781ebf3c071a1de91f3c089fd"
     prospective: "6b3b2d58bb644f8149a537485e8f33713cee33c5"
   FIELD DIFF: candidateIdentity
     recorded:    "dirty-sha256:70ca1dfa4faf05c7190400ba52d95c3c9e3852feb00c9ff6f4ddb0a13b0cd45d"
     prospective: "dirty-sha256:f9ca6b45bc94757e1665532ffa7c86bb2ff110a253519a6f3b0ad333b75249b5"
   total differing top-level fields = 2
   ```

   `packageVersion` (from `package.json`), `checksums.contentManifest.sha256` (`contracts/SHA256SUMS.json` bytes), `capabilityStates.digestSha256` (`capability-manifest.yaml` bytes), and `activeChanges` (change folders) are **unchanged** — Slice 1 edits touch none of those inputs. `candidateIdentity` differs only because the canonical identity hash consumes the lock-facts bytes, which embed `headSha`; it is downstream of the `headSha` delta.
5. **No Slice 1 file is a participation path.** Verified against the `PARTICIPATION_PATHS_V1` array literal (`scripts/compute-candidate-identity.mjs:45-66`): the array contains `docs/architecture/program-lock-facts.json` (the generated JSON) but **not** the `.md`; it contains `contracts/README.md` but **not** the root `README.md`. None of the 10 edited files is a member. The design (§8.1) and the tasks breakdown reach the same verdict: **Slice 1 does not force the recovery pair.**

**Conclusion.** The staleness is the pre-existing committed-history condition. `bun test` — the authoritative gate for a committed state — is green (767/0), the recorded `headSha` is an ancestor, and `bun run verify:capability` exits 0. **No recovery pair was run, because Slice 1 forces none** (no allowlisted path was written). Running `bun run refresh:lock-facts` here would mutate `docs/architecture/program-lock-facts.json` and the `openspec/config.yaml` mirror — generated state owned by the later allowlisted write (Slice 3), not by this docs slice.

---

## 8. Deviations from design, and delivery boundary

No requirement-affecting deviation. Three cosmetic implementations differ from the design's illustrative line numbers/indentation, recorded for the reviewer:

1. **`docs/architecture/legacy-capability-surface-inventory.md`:** the design cites lines 98-101; the bullet actually spans lines 96-101. Same bullet, same content.
2. **`openspec/README.md`:** the design cites insertion "ends line 26 / line 28"; the live file has the Persistence-model bullets ending before line 24 and `## Testing & TDD` at line 25. The block was inserted at the same semantic point (after the bullets, before `## Testing & TDD`).
3. **`.github/workflows/ci.yml`:** the design's replacement block shows a deeper illustrative indent; the comment was aligned to the file's existing 6-space indentation. The four comment lines, the `0.4.1` literal, and the keep-in-sync pointer are exactly as designed. Comment only; no behaviour change.

**U5b:** included (not declined). All three target files are inside the allowlist and none is a participation path; `REQ-REL-005` does not require it, and it is reversible by `git revert`.

**Delivery shape (parent-owned):** Slice 1 of a three-slice `feature-branch-chain`. Changed lines: 89 insertions / 22 deletions = **111 changed lines**, inside the ≈135-165 forecast and well under the 400-line budget. This run did not commit, branch, tag, or open a PR.

---

## 9. Remaining work (not this run)

Per the status engine, 17 implementation rows remain, all unchecked in `tasks.md`:

- **Slice 2 — D5 (`postinstall` warning), strict TDD, recovery pair FORCED:** `T-S2-001` … `T-S2-007` (7 rows, all `- [ ]`).
- **Slice 3 — U4 (version `0.1.0` at D11 width), TDD, one recovery pair FORCED:** `T-S3-001` … `T-S3-010` (10 rows, all `- [ ]`).

No `- [ ]` Slice 1 row remains. The parent owns commit/push, bounded review, and the archive step (which itself forces the recovery pair).

---

## 10. Risks and notes for verify

| # | Note | Severity |
| --- | --- | --- |
| 1 | `--check` reports stale — **pre-existing**, caused by HEAD advancing past the recorded `headSha` (`e48ed25` refresh, `6b3b2d5` formatter commit). Proven by the field-level diff in §7. `bun test` is authoritative and green. | Low (documented) |
| 2 | DECISION-1: this run authored the **interpreted** form (`RELEASING.md` step 7 holds the invocation; the canonical doc holds the normative statement). If verify applies the strictest reading, only `T-S1-006`'s block changes (three commands → three prose obligations), per `tasks.md` DECISION-1. | Medium (spec-authoring conflict, pre-recorded) |
| 3 | U5b is reversible at zero requirement cost (`git revert`). | Low |
| 4 | The `RELEASING.md` rewrite must not regress the `not.toContain("npm publish")` guard; the literal is absent in the working tree (verified) and the focused test passes. | Low |

---

## 11. Skill resolution

- `skills/drenyra-sdd/SKILL.md` — **loaded** (project skill, injected path).
- `skills/cognitive-doc-design/SKILL.md` — **path injected but not present** (`ENOENT: no such file or directory`). This is a project skill path that does not exist in this repository. Fallback was **not** triggered for additional skill discovery; the phase proceeded with the injected `drenyra-sdd` skill plus the design/tasks/spec artifacts.

`skill_resolution`: **paths-injected** (one injected path resolved, one injected in-repo path was absent; no registry fallback was used).

---

# Slice 2 — D5, the `postinstall` warning (`REQ-REL-004`). Strict TDD; recovery pair FORCED

**Run scope:** Slice 2 only (7 implementation rows, `T-S2-001` … `T-S2-007`). Slice 3 (`T-S3-*`) was not started. Slice 1's record above (§1–§11) is preserved byte-for-byte.
**Committed / branched / pushed by this run:** **no.** No `git add`, `git commit`, `git push`, branch, tag, or PR. No child subagent.

## 12. Status and action context consumed (Slice 2)

Structured SDD status injected by the parent (`gentle-pi.sdd-status`, schemaVersion 1), consumed before any edit:

- `changeName`: `pi-recovery-release-readiness`; `artifactStore`: `openspec`; `isNonAuthoritative`: `false`; `nextRecommended`: `sdd-apply`.
- `applyState`: `ready`; `blockedReasons`: `[]`; `deferredParentActions`: 0/0.
- `actionContext.mode`: `repo-local`; `workspaceRoot`: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`; `allowedEditRoots`: `[/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi]`; **`warnings`: `[]`**.
- `taskProgress` at start: 26 implementation rows, 9 complete (Slice 1), 17 remaining (Slice 2 + Slice 3).
- **Owner markers:** every Slice 2 row carries a terminal `<!-- sdd-owner: implementation -->`; no parent-owned row and no malformed `sdd-owner` marker exists. Only implementation-owned rows were selected, checked, and reported.

### Review Workload Gate (from `tasks.md`, unchanged)

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

`auto-chain` + `feature-branch-chain` were already resolved in session preflight, so the chained path was taken; this run implemented only the assigned Slice 2 work-unit slice. PR boundary in §23.

## 13. Completed tasks and persisted checkbox updates

All seven Slice 2 rows are now `- [x]` in `openspec/changes/pi-recovery-release-readiness/tasks.md`, persisted and re-verified by re-read:

```text
checked   S1: 9
unchecked S1: 0
checked   S2: 7
unchecked S2: 0
unchecked S3: 10   (not this run; unchanged)
```

| Task | Persisted checkbox | Deliverable |
| --- | --- | --- |
| `T-S2-001` | `- [x]` | `__tests__/postinstall-hook.test.ts` created; case 1 RED captured verbatim (§16) |
| `T-S2-002` | `- [x]` | `package.json#scripts.postinstall` one-liner: stderr warning + `process.exit(0)`, path literal inline once |
| `T-S2-003` | `- [x]` | Triangulation: failing fixture installer propagates status `3` (§17) |
| `T-S2-004` | `- [x]` | `runHook()` spawn-and-capture helper extracted; typed, no assertion weakened |
| `T-S2-005` | `- [x]` | Environment-faithful npm 10.9.0 harness check + default-npm regression check (§18) |
| `T-S2-006` | `- [x]` | Recovery pair run as one indivisible block; all four steps recorded (§19) |
| `T-S2-007` | `- [x]` | This evidence record |

## 14. Files changed (Slice 2)

`git diff --numstat` plus the new untracked test file:

```text
132     0       __tests__/postinstall-hook.test.ts   (new)
2       2       docs/architecture/program-lock-facts.json
1       1       openspec/config.yaml
1       1       package.json
7       7       openspec/changes/pi-recovery-release-readiness/tasks.md
```

| File | Change |
| --- | --- |
| `package.json` | `scripts.postinstall` replaced whole (one value, one line): `const t='dist/scripts/install-drenyra-ai.js'` + `if(!existsSync(t)){console.warn(...);process.exit(0);}` + unchanged `process.exit(spawnSync(process.execPath,[t],{stdio:'inherit'}).status??1)`. The literal path appears **inline exactly once** (measured), so `scripts/verify-package-files.mjs:242-246` still holds. |
| `__tests__/postinstall-hook.test.ts` | **New.** Reads `scripts.postinstall` from `package.json` and executes that exact shell command through `sh -c` in a `mkdtempSync(join(tmpdir(), "pi-postinstall-"))` cwd, capturing `status`/`stdout`/`stderr`. Three behavioural cases (absent / present / failing). |
| `docs/architecture/program-lock-facts.json` | Generator output only (`bun run refresh:lock-facts`, twice — see §19). Two changed lines: `headSha`, `candidateIdentity`. Never hand-edited. |
| `openspec/config.yaml` | The normalization-exempt mirror field only (`current_test_state.candidate_identity`). No count, version, date, or classification field was touched in this slice (`DR-6` is Slice 3's). |
| `tasks.md`, this file | This change's own artifacts. |

**Not touched (confirmed by `git status`):** `contracts/**`, `openspec/specs/**`, `capability-manifest.yaml`, `extensions/**`, `scripts/**`, `docs/**` (other than the generated lock facts), `.github/workflows/**`, `ROADMAP.md`, `README.md`, `RELEASING.md`. The only untracked entries are `?? .pi/` (pre-existing) and the new test file.

## 15. TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `T-S2-001` / `T-S2-002` / `T-S2-003` | `__tests__/postinstall-hook.test.ts` | Integration — executes the real manifest value through the real lifecycle shell | pre-change full suite 767/767 green (`bun test`), so the RED is attributable to the new behaviour | `bun test __tests__/postinstall-hook.test.ts` → **1 fail / 2 pass**: case 1 `expect(received).toMatch(/WARNING/i)` → `Received: ""` (hook exited 0 silently) | same file → **3 pass / 0 fail**, 11 `expect()` calls | case 3: present fixture that exits `3` must propagate `3`, proving the `?? 1` fallback does not swallow a real failure | `runHook(cwd): HookResult` extracted; re-run **3 pass / 0 fail**, 11 `expect()` calls — no assertion weakened or removed |

`strict_tdd: true` (`openspec/config.yaml`) ⇒ RED → GREEN → TRIANGULATE → REFACTOR, all four recorded below.

## 16. RED evidence (verbatim, ANSI stripped)

`bun test __tests__/postinstall-hook.test.ts` with all three cases present and `package.json` **unmodified**:

```text
bun test v1.4.0 (34cbb9a40)

__tests__/postinstall-hook.test.ts:
77 |   expect(result.status).toBe(0);
78 |   expect(result.stderr).toMatch(WARNING_PATTERN);
                                 ^
error: expect(received).toMatch(expected)

Expected substring or pattern: /WARNING/i
Received: ""

      at <anonymous> (/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi/__tests__/postinstall-hook.test.ts:78:25)
✗ package.json postinstall hook > warns on stderr and still exits 0 when the compiled installer is absent [93.56ms]
✓ package.json postinstall hook > runs the compiled installer, propagates success, and prints no warning [151.18ms]
✓ package.json postinstall hook > propagates a failing installer's exit status instead of the ?? 1 fallback [135.80ms]

 2 pass
 1 fail
 7 expect() calls
Ran 3 tests across 1 file. [429.00ms]
```

Exit status `1`. This is exactly the design's predicted RED: `status === 0` already held, and `stderr === ""` — the old absence branch yielded `undefined` and exited 0 with **no output**.

## 17. GREEN and TRIANGULATE evidence (verbatim, ANSI stripped)

After the `package.json` write — `bun test __tests__/postinstall-hook.test.ts`:

```text
bun test v1.4.0 (34cbb9a40)

__tests__/postinstall-hook.test.ts:
✓ package.json postinstall hook > warns on stderr and still exits 0 when the compiled installer is absent [93.35ms]
✓ package.json postinstall hook > runs the compiled installer, propagates success, and prints no warning [149.59ms]
✓ package.json postinstall hook > propagates a failing installer's exit status instead of the ?? 1 fallback [154.04ms]

 3 pass
 0 fail
 11 expect() calls
Ran 3 tests across 1 file. [456.00ms]
```

Exit status `0`. The single RED assertion (`/WARNING/i` on stderr) is GREEN, the present path is unchanged (installer runs, marker on stdout, no warning), and the triangulated case propagates the fixture's `3` rather than the `?? 1` fallback.

**Refactor re-run (T-S2-004):** `runHook(cwd): HookResult` extracted (typed, no `any`), all three cases call it → `3 pass / 0 fail`, `11 expect() calls`, exit `0`. Assertion count is unchanged before and after the refactor, evidencing that nothing was weakened.

## 18. T-S2-005 — Environment-faithful verification (where D5 actually failed)

Harness rebuilt/confirmed: `/tmp/npm10shim/npm --version` → `10.9.0`.

```text
$ /tmp/npm10shim/npm --version
10.9.0
$ PATH=/tmp/npm10shim:$PATH node scripts/verify-packed-install.mjs
pack: npm pack
install: npm install --no-save the tgz into a clean dir
packed-install: pi manifest present with a ./dist/extensions entry — OK
packed-install: extension factory resolves — OK
packed-install: postinstall ran under Node, runtime verified — OK
verify-packed-install: OK
exit=0
```

Default-npm regression check (no `PATH` override):

```text
$ node scripts/verify-packed-install.mjs      # npm 11.19.0
verify-packed-install: OK
exit=0
```

**Diagnostics not disturbed (T-S2-007 item).** `grep -c "WARNING"` on both captured logs → `0` for each. The packed artifact **contains** `dist/scripts/install-drenyra-ai.js` (it is in `package.json#files`), so both the npm install path and the direct-invocation probe take the **present** branch: no warning is emitted, npm's captured `stdout`/`stderr` stay uncorrupted, and the `out.includes("verified")` assertion still holds (B3's repair intact).

> **Shim rebuild note:** the npm 10.9.0 harness lives under `/tmp` (`/tmp/npm10`, `/tmp/npm10shim`). **If `/tmp` is cleared, rebuild it** with the three commands in `tasks.md` `T-S2-005` before re-running this check.
>
> **No recovery-pair interaction:** the first attempt of this check failed on the *forced pair* (§19) — `lock-facts.test.ts` re-derived `95a1b43c…` vs the recorded `70ca1dfa…` — not on npm 10.9. `npm@10.9.0`'s postinstall path is green once the checkpoint converged.

## 19. T-S2-006 — The recovery pair as one indivisible block

`package.json` is a `PARTICIPATION_PATHS_V1` member, so the pair was forced. Recorded in order:

| Step | Command | Result |
| --- | --- | --- |
| 0 | `bun run refresh:lock-facts` (pass A) | `refreshed docs/architecture/program-lock-facts.json` (exit 0). `packageVersion` unchanged (`0.0.1-prealpha.1` — Slice 3 owns it), `candidateIdentity = dirty-sha256:ce409bb2…`, `headSha = 604332ee…` |
| 1 | mirror write | **First attempt corrupted the file** (defect D-1, §20). Corrected with the fixed-point write from `node scripts/compute-candidate-identity.mjs` → mirror `dirty-sha256:48af05da…` |
| 1b | `bun run refresh:lock-facts` (pass B, required — defect D-2) | `refreshed …`; `candidateIdentity = dirty-sha256:48af05da…` = the mirror value |
| 2 | `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current`, **exit 0**; re-run immediately → still `current`, exit 0 (idempotent, so the mirror write did not move the identity at the fixed point) |
| 3 | full verification | see the table below, all exit 0 |

**Final candidate identity:** `dirty-sha256:48af05dafe98033853e207da673ca053e46a2c563b9018e502b120e0286cbb36` — identical in `docs/architecture/program-lock-facts.json#/candidateIdentity` and `openspec/config.yaml#/current_test_state/candidate_identity`.

### Step 3 — full verification set (verbatim results)

```text
$ bun run typecheck
$ tsc --noEmit
typecheck exit=0

$ bun run test                      # vitest run
 Test Files  51 passed (51)
      Tests  770 passed (770)
test exit=0

$ bun test                          # the recorded `test_command`
 770 pass
 0 fail
 3726 expect() calls
Ran 770 tests across 51 files. [13.42s]
exit=0

$ bun run verify:style
verify-style: OK (diff-scoped · 108 owned files · 4 rules)
verify:style exit=0

$ bun run verify:capability
verify-capability-manifest: OK
verify:capability exit=0

$ bun run verify:package
verify-package-files: vendored runtime drenyra-ai@0.4.1 reconciled with the pin (entry artifact package/dist/cmd/cli.js sha256 09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600)
verify-package-files: OK (dist tree + packaged files + content hashes reconciled)
verify:package exit=0

$ node scripts/verify-packed-install.mjs
verify-packed-install: OK
exit=0
```

Post-tooling re-check (the design's third trap — a formatter/build pass after the block re-classifies an allowlisted file):

```text
$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current          exit 0
$ bun run verify:capability
verify-capability-manifest: OK          exit 0
```

### The trap, demonstrated rather than asserted (`--check` alone is never evidence)

Reproduced on purpose with the facts recording `ce409bb2…` while `openspec/config.yaml` was byte-identical to HEAD (mirror left at the old value `70ca1dfa…`):

```text
$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current
--check exit=0
```

```text
$ bun run verify:capability
verify-capability-manifest: FAILED
  conflicting current snapshot identity in openspec/config.yaml: dirty-sha256:70ca1dfa4faf05c7190400ba52d95c3c9e3852feb00c9ff6f4ddb0a13b0cd45d != dirty-sha256:ce409bb20a41496cb70f4af74e18eab4a393484cdb5e690b91249c5416683a18
verify:capability exit=1
```

Step 2 and step 3 are the two halves of the proof, exactly as the canonical document states. The tree was restored to the converged state (§19 final identity) immediately afterwards, and both commands were re-run green.

**Never hand-edited:** `candidateIdentity`, `checksums.*`, `capabilityStates.digestSha256`, `headSha`. `docs/architecture/program-lock-facts.json` was written **only** by `bun run refresh:lock-facts`; the single manual write in the pair was the documented mirror field in `openspec/config.yaml`.

## 20. Deviations from design — four, each forced and evidenced

### D-1 (HIGH, cross-slice defect): the prescribed mirror command is not shell-safe

`design.md` §8.2 step 1 / `tasks.md` "indivisible command block" step 1 — and therefore `docs/architecture/program-lock-facts.md` step 2, authored by Slice 1 and **already committed** in `604332e` — presents this inside a `sh` fence:

```sh
node -e "...before.replace(/^(\s*candidate_identity:\s*).*$/m,'$1\"'+id+'\"');..."
```

Run as written in a shell, **`$1` is expanded by the shell** (positional parameter, empty), so the replacement string loses its backreference and the whole match — including the `candidate_identity:` key and its indentation — is replaced by the bare quoted value. Measured result:

```text
$ git diff -- openspec/config.yaml
-      candidate_identity: "dirty-sha256:70ca1dfa4faf05c7190400ba52d95c3c9e3852feb00c9ff6f4ddb0a13b0cd45d"
+"dirty-sha256:ce409bb20a41496cb70f4af74e18eab4a393484cdb5e690b91249c5416683a18"
```

`openspec/config.yaml` became invalid YAML (the editor lint reported `L41: Implicit map keys need to be followed by map values`) and the mirror key was gone. This is precisely the defect class the change exists to remove: **the canonical recovery sequence, followed literally, breaks the file it is meant to repair** (it also interacts with `REQ-REL-001` scenario 4 in spirit, though no trust anchor is hand-edited).

- **Deviation taken here:** the mirror was repaired with a reviewable targeted edit and the pair was completed with a shell-safe write (`node -e '…'` in single quotes, replacement supplied as a **function**, so no `$`-pattern can be interpreted by either the shell or `String.replace`).
- **Escalated, not fixed:** the source of the defect is `docs/architecture/program-lock-facts.md` step 2 (also mirrored in `RELEASING.md` step 7 by reference). That file is **outside this slice's exhaustive allowlist**, so it was not touched. **It needs a follow-up edit** (e.g. drop `\"`-escaping by single-quoting the `node -e` payload, or use `\$1`), otherwise the next operator who follows the canonical sequence reproduces this corruption. Owning slice: a Slice 1 correction or the parent, by decision.

### D-2 (HIGH, design premise falsified): the mirror write *can* move the candidate identity

`design.md` §8.3 / §3.3(a) assert "the mirror is normalization-exempt, so rewriting it does not itself move the candidate identity". Measurement shows the premise is **conditionally false**:

| State | `openspec/config.yaml` vs HEAD | In the participation manifest? | Derived identity |
| --- | --- | --- | --- |
| Step 0 output written into the mirror (`ce409bb2…`) | modified | **yes** — `M 100644 e31ce0fd…` | `48af05da…` |
| Mirror left at the old value (`70ca1dfa…`) | byte-identical | **no** | `ce409bb2…` |

`computeCandidateIdentity` decides membership with `workingTreeChanged()` → `git diff --quiet HEAD -- <path>` over **raw bytes**; the normalizer (`normalizeConfigYaml`) only makes the *digest* value-independent, never the membership. So when the mirror is `openspec/config.yaml`'s **only** change — which is exactly the Slice 2 case — the one-pass sequence `refresh → mirror → --check` can never converge: `--check` reports `program lock facts are stale; run bun run refresh:lock-facts` (exit 1).

- **Deviation taken here (forced):** iterate to the fixed point — run the refresh **again** after the mirror line exists, so the facts record the identity computed *with* `config.yaml` modified, then write that value into the mirror (a no-op for the digest, since it is normalization-exempt). Two refreshes, one mirror write, then `--check` → `current`. This is the parent prompt's route ("write the derived identity from `node scripts/compute-candidate-identity.mjs`").
- **Consequence for Slice 3 (`U4`):** `DR-6` also edits `openspec/config.yaml`, so `config.yaml` is modified for reasons other than the mirror and the design's one-pass order does converge there. The defect is specific to a mirror-only change, but the documented sequence should still say so.
- **Not fixed:** the affected prose lives in `docs/architecture/program-lock-facts.md` (outside this slice's allowlist) and in `design.md`/`tasks.md` (authoring artifacts owned by earlier phases). Escalated.

### D-3 (MEDIUM): the designed one-liner's backticks are command-substituted by the lifecycle shell

`design.md` §6.1's literal warning text is ``Run `bun run build`, then re-run your install.`` Inside the double-quoted `node -e "…"` shell command, the backticks are **command substitution**. Measured with the design's string verbatim:

```text
status=0  stdout=[]
stderr verbatim:
error: Script not found "build"
drenyra-pi: WARNING — dist/scripts/install-drenyra-ai.js is missing, so the pinned Drenyra AI runtime was NOT installed. Run , then re-run your install.
stderr line count (non-empty)=2
```

Two defects in one: the remedy text is destroyed (`Run , then re-run your install.`), and an **unrequested `bun run build` executes during postinstall** — on a real source clone that would run a build from inside the install hook.

- **Deviation taken (minimal):** the two backticks were removed from the warning prose; the remedy is still named (`bun run build`), which is the property `design.md` §6.1 requires. Every other property of the designed one-liner is byte-identical to the design (stderr-only via `console.warn`, one line, `process.exit(0)` in the absence branch, the inline path literal appearing once, unchanged `spawnSync(...).status ?? 1` + `process.exit`).
- **Test strengthened at the same time (not weakened):** case 1 now also asserts the warning is **one bounded line** (`stderr` non-empty lines `toHaveLength(1)`), the property that just failed and that `REQ-REL-004` scenario 4 states ("the warning remains a single bounded line that does not corrupt the captured npm diagnostics").

### D-4 (LOW): the test drives the hook through `sh -c`, not `node -e <value>`

`design.md` §6.2 says the test "spawns `node -e <that string>`". The stored value is not a bare JS body — it is the shell command `node -e "…"` — so spawning `node -e <value>` double-wraps it (and under `bun test` `process.execPath` is bun, which has no CommonJS `require` in `-e`: measured exit `1` for all three cases). The faithful invocation is npm's POSIX lifecycle shell.

- **Deviation taken:** the test executes the manifest value through `sh -c` — the shell npm itself uses for lifecycle scripts. This is the same execution model that exposes D-3, which a `node -e` wrapper would have hidden. Also a `HOOK_RUNTIME = "sh"` constant documents why the test-runner's `process.execPath` is not used.

No requirement-affecting deviation beyond these four. All constraints the design calls "forced, not preferences" hold: exit 0 preserved, the inline path literal present exactly once, no warning on the present path, and the packed-install diagnostics uncorrupted.

## 21. Count drift — reported, deliberately NOT synced

The new test file changes the live counts:

| Record | Recorded (as of this change) | Live after Slice 2 |
| --- | --- | --- |
| `openspec/config.yaml#/current_test_state` | `files: 50`, `tests: 767` | 51 files / 770 tests |
| `capability-manifest.yaml#/evidenceSnapshot` | `"767 passed, 0 failed"` + `note` "767 tests across 50 files" | 770 passed / 0 failed |

**No guard broke on this drift.** `bun run test` (770/770), `bun test` (770/0), `bun run typecheck`, `bun run verify:style`, `bun run verify:capability`, `bun run verify:package`, and both `verify-packed-install.mjs` runs are all exit 0. `scripts/verify-capability-manifest.mjs:838-870` compares the two *recorded* records with each other, not with a live test run, and the lock-facts refresh preserves `tests.*` (hand-authored). Per the design's `DR-6` ordering (and the prompt), the sync belongs to **Slice 3 before its refresh**; it was **not** performed here, and no check was weakened to accommodate the drift.

**`bun test` end state: 770 pass / 0 fail / 3726 expect() calls, 51 files.**

## 22. Remaining tasks (exact unchecked lines, none of them Slice 2)

None of Slice 2 remains. 10 implementation rows remain, all Slice 3, all still `- [ ]` (verbatim from `tasks.md`):

- [ ] T-S3-001 — **RED ① (`REQ-REL-003` scenario 2, captured on purpose).** Set **only** `package.json#/version` to `0.1.0`, then run `bun run verify:capability` → `repository version 0.0.1-prealpha.1 does not match package.json version 0.1.0`, and `bun test __tests__/lock-facts.test.ts` → `packageVersion must equal package.json version (0.1.0)`. Record both verbatim as the fail-closed evidence for a partial bump; do **not** leave the tree in this state. <!-- sdd-owner: implementation -->
- [ ] T-S3-002 — **RED ② (the D11 guard).** Create `__tests__/harness-version.test.ts` per `design.md` §5.3: it imports `drenyraPiExtension` from `../extensions/register.js` and `FISCAL_GUARD_VERSION` from `../extensions/fiscal-guard.js`, reads `pkg.version` from `package.json`, and asserts `drenyraPiExtension.version === pkg.version` and `FISCAL_GUARD_VERSION === pkg.version` via **real imports** — never the literal `0.1.0`, never prose, never a regex over `.ts` source (so it cannot false-RED on the next legitimate bump). Run it; record RED for C4 (`expected 0.0.1-prealpha.1 to be 0.1.0`), then extend it for C5 and record RED because the module exposes no `FISCAL_GUARD_VERSION`. <!-- sdd-owner: implementation -->
- [ ] T-S3-003 — **GREEN.** Edit C2 `capability-manifest.yaml#/repository/version` → `0.1.0`; C4 `extensions/register.ts:95` `DRENYRA_PI_VERSION` → `0.1.0`; C5 `extensions/fiscal-guard.ts:49` — rename to an additive `export const FISCAL_GUARD_VERSION` with value `0.1.0` and update its single internal use (`extensions/fiscal-guard.ts:235`), leaving its session-status output unchanged; C6 `__tests__/configurator.test.ts:26` — replace the `PACKAGED_VERSION` literal with an import of the real `drenyraPiExtension.version`. Leave C3 to the generator. Run the focused guard and `bun test __tests__/configurator.test.ts`; record GREEN. <!-- sdd-owner: implementation -->
- [ ] T-S3-004 — **TRIANGULATE.** Factor the comparison into a local `versionViolations(version: string): string[]` helper and assert it returns a violation for a synthetic `"9.9.9"` and none for `pkg.version` — proving the guard is a detector, not a tautology. <!-- sdd-owner: implementation -->
- [ ] T-S3-005 — **REFACTOR.** Extract the `readPackageVersion()` helper in the test file; typed, no `any`. The guard covers only C4/C5 — C2's equality is owned by `verify:capability` and C3's by `__tests__/lock-facts.test.ts`; re-asserting them here would create a third failure site for the same invariant. Name that ownership split in the test header. <!-- sdd-owner: implementation -->
- [ ] T-S3-006 — **`DR-6` count sync — BEFORE the refresh (design correction; ordering is load-bearing).** This change adds two test files, so `openspec/config.yaml#/current_test_state` (`files`, `tests`, `evidence_date`; lines 33-41) and `capability-manifest.yaml#/evidenceSnapshot` (`result`, `date`, and the two numbers inside `note`) record a tree that will no longer exist. Sync them using the counts observed in the final full `bun run test`. Constraints enforced by `scripts/verify-capability-manifest.mjs:838-870`: `config.yaml`'s `command`, `evidence_date`, and `classification` must equal the manifest's, and the normalized `completeResult(files.tests, files.failed)` must equal `evidenceSnapshot.result`. The live projection markers (`README.md:47`, `ROADMAP.md:12`, `docs/architecture/capability-conformance-matrix.md:15-16`) are the delegation form, so **no projection surface is edited**. These edits **must precede** `refresh:lock-facts`, because both files participate in the identity and editing them afterwards invalidates `capabilityStates.digestSha256` and the mirror in one step. <!-- sdd-owner: implementation -->
- [ ] T-S3-007 — `CHANGELOG.md`: add the `0.1.0` entry recording the version bump and the D2 rationale, stating that **publication remains off**, and noting that it supersedes the earlier "verification-only posture, version stays pre-alpha" note whose reasoning D2 overrode. It must **not** claim that a package was released (`REQ-REL-003` scenario 4; constraint 6.8). <!-- sdd-owner: implementation -->
- [ ] T-S3-008 — **Recovery pair (indivisible) after the allowlisted writes.** With C1, C2, C4, C5, C6, the guard, the `CHANGELOG.md` entry, and `DR-6` all in place, run the four steps of the indivisible block in order. Required outcomes: `--check` exits 0, C3 regenerated by the generator (never hand-edited), the mirror carries the value the refresh produced, and `bun run verify:capability` exits 0. Record each result and the final candidate identity. <!-- sdd-owner: implementation -->
- [ ] T-S3-009 — Record U4's exit evidence in `apply-progress.md`: the three surfaces read `0.1.0`; RED ① and RED ② verbatim; the guard green; the pair's four results; and the full verification set green — `bun run typecheck`, `bun run test`, `bun run verify:style`, `bun run verify:capability`, `bun run verify:package`, `node scripts/verify-packed-install.mjs`. <!-- sdd-owner: implementation -->
- [ ] T-S3-010 — **`REQ-REL-006` boundary check.** Confirm the final diff adds no `publishConfig`, no publish step or job, and no registry publication command; `.github/workflows/release-verify.yml` is byte-identical; `grep -n "Package released" ROADMAP.md` still shows the item unchecked; and no file under `contracts/**`, `openspec/specs/**`, `scripts/compute-candidate-identity.mjs`, or `PARTICIPATION_PATHS_V1` was modified. `git diff --stat` is the evidence. <!-- sdd-owner: implementation -->

## 23. Workload / PR boundary

- **Slice 2 changed lines:** 132 new test lines + 1 `package.json` line + 1 mirror line + 2 generated lock-fact lines = **~136 changed lines**. Under the 400-line reviewer budget on its own, so the commit boundary is a single reviewable unit.
- **Delivery shape:** Slice 2 of three, `feature-branch-chain` (each PR targets the accumulating feature branch). This run did **not** commit, branch, tag, or open a PR — the parent owns the commit/push route, bounded review, and the archive step (which itself forces the pair). Unit bound is 2000 changed lines for the branch cumulative change; the reviewer budget of 400 applies at the commit boundary, which the parent owns.
- **Rollback:** restore the one-line `postinstall` and re-run the pair. That restores the previously accepted fail-open (a known state, not a regression). Keep the new test file (it will then RED, which is the point) or delete it; the generated `docs/architecture/program-lock-facts.json` and the mirror must be re-derived together — never hand-edited to a previous value.

## 24. Risks and notes for verify

| # | Note | Severity |
| --- | --- | --- |
| 1 | **D-1:** `docs/architecture/program-lock-facts.md` step 2 (committed in `604332e`) prescribes a `node -e` command whose `$1` is expanded by the shell, deleting the `candidate_identity:` key and corrupting `openspec/config.yaml`. Outside this slice's allowlist — **needs a follow-up edit**. | High |
| 2 | **D-2:** the design's "the mirror write does not move the identity" premise is false when the mirror is `config.yaml`'s only change (membership is raw-git-byte based). The one-pass sequence cannot converge; a second refresh after the mirror write is required. Documented sequence should say so. | High |
| 3 | **D-3:** the design's warning prose used backticks, which the lifecycle shell substitutes (destroys the remedy text, executes `bun run build`). Backticks removed; the one-line assertion now guards the class. Any future edit to the warning must keep it shell-safe (no backticks, no `$`). | Medium |
| 4 | **D-4:** the test uses `sh -c`, not `node -e <value>`; a reviewer comparing the test to `design.md` §6.2 will see the deviation, justified in §20. | Low |
| 5 | Count drift (51/770 vs recorded 50/767) is real and intentional — `DR-6` owns it in Slice 3, **before** its refresh. Do not sync it in a Slice 2 review. | Low |
| 6 | The npm 10.9.0 harness is `/tmp`-resident; if `/tmp` is cleared the check must be rebuilt (three commands in `T-S2-005`) before it can be cited. | Low |
| 7 | Slice 1's recorded `--check` staleness note (§7) is now superseded: after this slice the checkpoint is **current** at `48af05da…`, and it will go stale again the moment HEAD advances or any other participation path is written. | Low |

## 25. Skill resolution (Slice 2)

- `skills/drenyra-sdd/SKILL.md` — **present and read** (project skill, injected path).
- `skills/evidence-citation/SKILL.md` — **present and read** (project skill, injected path). Its citation rule was applied to this record: every claim above carries a command, a `path:line`, or a verbatim output; nothing is asserted without one.
- No project/user registry discovery was performed; no skill path resolved by fallback.

`skill_resolution`: **paths-injected** (both injected in-repo paths existed and were read; no registry or path fallback used).
