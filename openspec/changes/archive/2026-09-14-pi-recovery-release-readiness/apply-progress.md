# Apply Progress — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6)
**Phase:** apply — **Slices 1 and 2**. Slice 1 (U2 + U3 + U5 + U5b, documentation) is recorded in §1–§11 exactly as written; Slice 2 (D5, the `postinstall` warning, `REQ-REL-004`) is appended in §12–§25.
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
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
- `actionContext.mode`: `repo-local`; `workspaceRoot`: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; `allowedEditRoots`: `[/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell]`; `warnings`: `[]`
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
| `docs/architecture/ecosystem-boundaries.md` | U5b | Release-cadence line → pre-release with contracts frozen at v0.1 (`drenyra-shell@0.1.0`). |

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
- `actionContext.mode`: `repo-local`; `workspaceRoot`: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; `allowedEditRoots`: `[/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell]`; **`warnings`: `[]`**.
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

      at <anonymous> (/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell/__tests__/postinstall-hook.test.ts:78:25)
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
drenyra-shell: WARNING — dist/scripts/install-drenyra-ai.js is missing, so the pinned Drenyra AI runtime was NOT installed. Run , then re-run your install.
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

---

# Slice 3 — U4, version `0.1.0` at D11 width (TDD; recovery pair FORCED once for the unit)

**Run scope:** Slice 3 only (`T-S3-001` … `T-S3-010`). §1–§25 (Slice 1 and Slice 2) are preserved byte-for-byte; this section is appended, never a rewrite.

**Attribution — read this first.** This completion pass did **not** author the substantive work of Slice 3. A previous run of this same work unit performed the implementation (carrier edits, the guard, `DR-6`, the `CHANGELOG.md` entry, and the indivisible recovery pair) and then **stalled before reporting**: it persisted no Slice 3 section here and left all ten `T-S3-*` rows `- [ ]`. Every item below is therefore labelled (a) **inherited bytes, re-verified by this pass**, (b) **written by this pass** — only the prose verdict, the task checkboxes, and this record — or (c) **inherited-but-missing evidence**, disclosed rather than reconstructed.

**Committed / branched / pushed by this run:** **no.** No `git add`, `git commit`, `git push`, branch, tag, or PR. No child subagent. **Prose, source and test bytes written by this pass: none** (see §32).

## 26. Item 1 — version-status prose re-check (verdict: no edit was needed, none was invented)

The premise handed to this pass — *“Slice 1 updated `README.md`, `docs/intended-usage.md` and `docs/architecture/ecosystem-boundaries.md` to describe the version as current, so the bump makes all three stale”* — **does not hold**. Slice 1 (`604332e`) wrote the **target** version into those three files, not the then-current one; `git show 604332e -- <those files>` shows `0.0.1-prealpha.1 → 0.1.0` as the Slice 1 edit itself.

Measured now, all three already read `0.1.0` and are **byte-identical to `HEAD`**:

| File | Current-fact version statement | Verdict |
| --- | --- | --- |
| `README.md:7`, `:11` | ``> **Status: contracts frozen, pre-release (`v0.1.0`).**`` … ``which is the `0.1.0` step of the version policy`` | already `0.1.0` — **no edit** |
| `docs/intended-usage.md:27` | ``Status is **pre-release**: contracts are frozen at v0.1 and the package version is `0.1.0`.`` | already `0.1.0` — **no edit** |
| `docs/architecture/ecosystem-boundaries.md:274` | ``(`drenyra-shell@0.1.0`).`` | already `0.1.0` — **no edit** |

```
$ git diff --stat README.md docs/intended-usage.md docs/architecture/ecosystem-boundaries.md docs/architecture/capability-conformance-matrix.md
(empty — all four unmodified against HEAD)
```

Because the files are byte-unchanged, their `conformance:` markers (`README.md:45-46`) were never at risk: nothing was written in their vicinity.

**`docs/architecture/capability-conformance-matrix.md` — does it state the version as a current fact? Answer: no.** A case-insensitive search for `version`, `0.1.0`, `pre-release`, `pre-alpha` over the file returns **nothing**, and the file states the delegation itself at `:20-22`:

> *“This matrix restates none of those values, so it cannot drift from them.”*

Its only version-shaped content is a **labeled historical** snapshot identity (`:24-27`, `dirty-sha256:38ee713f…`, evidence date 2026-09-09). No edit was made and none is needed.

Also inspected, reported, **not** edited (neither is a current-fact claim; the second is outside every allowlist in this change):

- `RELEASING.md:35` — the version **policy** (“Until the first contract is frozen, releases use **`0.0.1-prealpha.x`**”). A rule for future releases, not a status claim about this tree.
- `__tests__/extension-mission-status.test.ts:147`, `:158`, `:170` — `"0.0.1-prealpha.1"` is an arbitrary synthetic input passed to `renderCapabilitiesView` and echoed back by the assertion; it claims nothing about the real harness version.
- `__tests__/capability-manifest.test.ts:269`, `:310` — synthetic temp-root manifests in an identity-allowlisted file (tasks.md guard 3: do not edit).

## 27. Item 2 — persisted task checkboxes (done)

All ten Slice 3 rows were flipped `- [ ]` → `- [x]` in `openspec/changes/pi-recovery-release-readiness/tasks.md` (lines 144-153), each keeping its terminal `<!-- sdd-owner: implementation -->` marker. Re-read **after** the edit:

| Check | Command | Result |
| --- | --- | --- |
| zero unchecked rows | `grep -c "^- \[ \]" tasks.md` | **0** |
| completed rows | `grep -c "^- \[x\]" tasks.md` | **26** |
| terminal implementation markers | `grep -c "<!-- sdd-owner: implementation -->$" tasks.md` | **26** (26 of 26) |
| `sdd-owner: parent` rows | `grep -n "sdd-owner: parent" tasks.md` | **none** (no parent-owned row exists in this change) |
| malformed markers | markers not matching the terminal form | **none** |

`tasks.md` is **not** a `PARTICIPATION_PATHS_V1` member (the list at `scripts/compute-candidate-identity.mjs:45-67` names only `pi-sdd-010-*` artifacts), so this write cannot move the candidate identity — confirmed by re-running `--check` afterwards (§30).

## 28. Item 3 — U4 exit evidence

### 28.1 Carrier census — all five, plus the mirror elimination

| # | Carrier | Value now | Measured evidence |
| --- | --- | --- | --- |
| C1 | `package.json#/version` | `0.1.0` | `package.json:3` `"version": "0.1.0",` |
| C2 | `capability-manifest.yaml#/repository/version` | `0.1.0` | `capability-manifest.yaml:7` `version: 0.1.0` |
| C3 | `docs/architecture/program-lock-facts.json#/packageVersion` — **generated, never hand-edited** | `0.1.0` | `program-lock-facts.json:7`; `--check` → `program lock facts are current` |
| C4 | `extensions/register.ts` `DRENYRA_PI_VERSION` | `0.1.0` | `extensions/register.ts:95`, consumed at `:195`, `:497`, `:546`, `:569`, `:648` |
| C5 | `extensions/fiscal-guard.ts` `FISCAL_GUARD_VERSION` | `0.1.0` | `extensions/fiscal-guard.ts:53` (`export const FISCAL_GUARD_VERSION = "0.1.0";`), single internal use at `:239` (`drenyra-shell v${FISCAL_GUARD_VERSION}`), session-status output unchanged |
| C6 | `__tests__/configurator.test.ts` `PACKAGED_VERSION` | **mirror eliminated** | `:31` `const PACKAGED_VERSION = drenyraPiExtension.version;` — header at `:27-29` records that a literal is no longer mirrored |

**Line-citation drift vs `design.md`** (content-identical, no requirement affected): the design cites `extensions/fiscal-guard.ts:49` and its internal use at `:235`; the tree has `:53` and `:239` because the rename moved them. Design cites `__tests__/configurator.test.ts:26`; the tree has `:31`.

### 28.2 TDD Cycle Evidence (version unit)

Strict TDD is declared for this unit by `tasks.md` ("TDD; pair FORCED once for the unit") and by `openspec/config.yaml`'s `tdd_discipline`. Steps 1-2 were executed by the **inherited** run; steps 3-5 are re-verified here.

| Step | Task | Required by the task row | Status in this tree |
| --- | --- | --- | --- |
| **RED ①** | T-S3-001 | set **only** `package.json#/version` to `0.1.0`; `verify:capability` → `repository version 0.0.1-prealpha.1 does not match package.json version 0.1.0`; `lock-facts` test → `packageVersion must equal package.json version (0.1.0)` | **INHERITED, NOT PERSISTED — gap E-1 (§31).** Both detectors exist at the exact cited sites: `scripts/verify-capability-manifest.mjs:991-994` emits that message verbatim, `__tests__/lock-facts.test.ts:156-158` emits the other. Neither *executed* RED output survives in any artifact I can read. |
| **RED ②** | T-S3-002 | guard RED for C4 (`expected 0.0.1-prealpha.1 to be 0.1.0`), then C5 (module exposes no `FISCAL_GUARD_VERSION`) | **INHERITED, NOT PERSISTED — gap E-1 (§31).** The guard file exists with the designed real-import assertions (`__tests__/harness-version.test.ts:23-24` import `drenyraPiExtension` and `FISCAL_GUARD_VERSION`; `readPackageVersion()` reads `package.json`). No literal `0.1.0`, no prose, no regex over `.ts` source. |
| **GREEN** | T-S3-003 | C2/C4/C5 hand-edited, C6 mirror eliminated, C3 left to the generator | **Verified green** (§28.1 + §28.3): `bun test __tests__/harness-version.test.ts` → `3 pass / 0 fail`; `bun test __tests__/configurator.test.ts` passes inside the full `bun test` (773/0). |
| **TRIANGULATE** | T-S3-004 | `versionViolations("9.9.9")` returns a violation; none for `pkg.version` — detector, not tautology | **Verified green, and this is the present-tense substitute for the missing RED:** test name `detects a mismatching version instead of being a tautology` passes (§28.3). The helper is at `__tests__/harness-version.test.ts:37+`. |
| **REFACTOR** | T-S3-005 | typed `readPackageVersion()` helper; ownership split named in the test header | **Verified in the file:** `readPackageVersion(): string` at `__tests__/harness-version.test.ts:27-33`, no `any` anywhere in the file; the header at `:1-21` names the split (C2 → `verify:capability`, C3 → `__tests__/lock-facts.test.ts`, C4/C5 → this guard) and states why a third failure site was deliberately avoided. |

**Why RED cannot be recovered now.** Re-capturing RED ① means writing `package.json#version` — an identity-allowlisted path — which would force the indivisible recovery pair, and the pass instruction forbids re-running the pair. Re-capturing RED ② would require reverting C4/C5 within a dirty tree. Both are out of this pass's authority; the gap is reported instead of fabricated. It is **not** a code defect: the detectors are present, cited, and currently green, and the triangulation case (T-S3-004) proves the guard discriminates.

### 28.3 Verbatim gates re-run by this pass (ANSI stripped; Slice 3 tree)

```
$ bun test

 773 pass
 0 fail
 3730 expect() calls
Ran 773 tests across 52 files. [10.06s]

$ bun run typecheck
$ tsc --noEmit
(exit 0, no diagnostics)

$ bun run verify:capability
$ node scripts/verify-capability-manifest.mjs
verify-capability-manifest: OK

$ bun run verify:style
$ node scripts/verify-style.mjs
verify-style: OK (diff-scoped · 109 owned files · 4 rules)

$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current

$ bun test __tests__/harness-version.test.ts
__tests__/harness-version.test.ts:
✓ harness version agreement > reports the package version as the extension version [0.08ms]
✓ harness version agreement > reports the package version as the fiscal guard version [0.04ms]
✓ harness version agreement > detects a mismatching version instead of being a tautology [0.10ms]

 3 pass
 0 fail
 4 expect() calls
Ran 3 tests across 1 file. [149.00ms]

$ bun run verify:package
verify-package-files: vendored runtime drenyra-ai@0.4.1 reconciled with the pin (entry artifact package/dist/cmd/cli.js sha256 09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600)
verify-package-files: OK (dist tree + packaged files + content hashes reconciled)

$ node scripts/verify-packed-install.mjs
npm notice package size: 1.1 MB
npm notice total files: 297
drenyra-shell-0.1.0.tgz
install: npm install --no-save the tgz into a clean dir
packed-install: pi manifest present with a ./dist/extensions entry — OK
packed-install: extension factory resolves — OK
packed-install: postinstall ran under Node, runtime verified — OK
verify-packed-install: OK

$ git status --short
 M CHANGELOG.md
 M __tests__/configurator.test.ts
 M capability-manifest.yaml
 M docs/architecture/program-lock-facts.json
 M extensions/fiscal-guard.ts
 M extensions/register.ts
 M openspec/config.yaml
 M package.json
?? .pi/
?? __tests__/harness-version.test.ts
```

Note the packed artifact name `drenyra-shell-0.1.0.tgz` — the bump is visible at the pack boundary, and publication surfaces are still absent (§28.6).

### 28.4 `DR-6` count sync (T-S3-006) — verified consistent

| Record | Value measured | Constraint (`scripts/verify-capability-manifest.mjs:838-870`) | Holds |
| --- | --- | --- | --- |
| `openspec/config.yaml#/current_test_state` | `files: 52`, `tests: 773`, `passing: true`, `failed: 0`, `command: bun test`, `classification: dirty-candidate`, `evidence_date: 2026-09-12` | `command`, `evidence_date`, `classification` must equal the manifest's | ✅ |
| `capability-manifest.yaml#/evidenceSnapshot` | `command: "bun test"`, `result: "773 passed, 0 failed"`, `date: "2026-09-12"`, `classification: dirty-candidate`, `note` → “`bun test` ran 773 tests across 52 files with 0 failures … 2026-09-12” | `completeResult(773, 0)` must equal `evidenceSnapshot.result` | ✅ |

The observed `bun test` counts in §28.3 are exactly the recorded ones (773/52/0), so the sync does **not** go stale as the tree stands. No projection surface was edited: `README.md:46`, `ROADMAP.md:12` and `docs/architecture/capability-conformance-matrix.md:15-16` are the delegation form and remain untouched (the matrix's `git diff` is empty, §26). Ordering was load-bearing and was honoured: both records were written **before** `refresh:lock-facts`; editing them afterwards would have changed `capability-manifest.yaml` bytes and invalidated `capabilityStates.digestSha256` and the mirror in one step.

### 28.5 T-S3-008 — the requirement pair for identity recovery: it was run, and both of its halves are green now

**Explicit statement.** The **indivisible recovery pair for U4 was run** — by the inherited run of this unit, in the mandated order (`bun run refresh:lock-facts` → mirror rewrite → `--check` → full verification set). **This pass did not re-run it**, because it wrote **no** identity-allowlisted path (§32): `README.md`, `docs/intended-usage.md`, `docs/architecture/ecosystem-boundaries.md`, `docs/architecture/capability-conformance-matrix.md`, `tasks.md` and `apply-progress.md` are all outside `scripts/compute-candidate-identity.mjs:45-67`. What this pass did do is re-run **both halves of the proof**, which are the only valid evidence of recovery:

| Half | Command | Result |
| --- | --- | --- |
| 1 — the checkpoint is current | `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current` |
| 2 — the mirror did not conflict | `bun run verify:capability` | `verify-capability-manifest: OK` |

| Identity fact | Value |
| --- | --- |
| mirror `openspec/config.yaml:41` `candidate_identity` | `"dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce"` |
| generated `docs/architecture/program-lock-facts.json:6` `candidateIdentity` | `dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce` |
| agreement | **equal** — the mirror carries the value the refresh produced |
| C3 regenerated by the generator | `program-lock-facts.json:7` `"packageVersion": "0.1.0"`, and `--check` reports **current** — so the file matches generator output, never a hand edit |

The **trap is stated, and it did not fire:** a refresh *without* the mirror rewrite leaves `--check` reporting `current` while `bun run verify:capability` goes red with `conflicting current snapshot identity in openspec/config.yaml: <old> != <new>` (source at `scripts/verify-capability-manifest.mjs:866`; the same conflict fails `__tests__/capability-manifest.test.ts` inside `bun run test`). Here **both halves are green simultaneously**, which is precisely what distinguishes a completed recovery from the trap. No second-pass discrepancy was observed at this tree; Slice 2's D-2 note about needing a second refresh after the mirror write is not re-observed here.

### 28.6 T-S3-010 — `REQ-REL-006` boundary check (evidence: the diff itself)

| Boundary | Command | Result |
| --- | --- | --- |
| no `publishConfig` / no publish command added to the manifest | `git diff -U0 -- package.json` piped through `grep -i publish` | **no matches** |
| no publish step or job in the workflow | `git status --porcelain .github/workflows/release-verify.yml` | **empty — byte-identical, unmodified** |
| the roadmap's npm item is still unchecked | `grep -n "Package released" ROADMAP.md` | line 54 — `- [ ] Package released as drenyra-shell on npm with pinned drenyra-ai` (checkbox still unchecked) |
| no frozen/authority path touched | `git status --porcelain -- contracts openspec/specs scripts/compute-candidate-identity.mjs` | **empty** |

```
$ git diff --stat
 CHANGELOG.md                              | 33 +++++++++++++++++++++++++++++--
 __tests__/configurator.test.ts            |  9 +++++++--
 capability-manifest.yaml                  |  8 ++++----
 docs/architecture/program-lock-facts.json |  8 ++++----
 extensions/fiscal-guard.ts                |  8 ++++++--
 extensions/register.ts                    |  2 +-
 openspec/config.yaml                      | 10 +++++-----
 package.json                              |  2 +-
 8 files changed, 59 insertions(+), 21 deletions(-)
```

Plus one untracked file, `__tests__/harness-version.test.ts` (65 lines), which `git diff --stat` cannot show. No `contracts/**`, `openspec/specs/**`, `MASTER_CAPABILITIES`, capability-count, `PARTICIPATION_PATHS_V1` or `scripts/compute-candidate-identity.mjs` change exists in the diff.

## 29. `DR-6` / ordering trap walked once more — this pass's own writes are identity-neutral

The two files this pass wrote (`tasks.md`, this record) are outside `PARTICIPATION_PATHS_V1`, so the candidate identity and the mirror are unchanged by them. Proven, not assumed: `--check` → `program lock facts are current` and `verify:capability` → `OK`, both re-run **after** the checkbox flips (§28.3, §30). Nothing here requires the pair.

## 30. Confirmation that the persisted artifacts and the tree agree

Re-read after all writes: `tasks.md` shows 26 `- [x]` and 0 `- [ ]`; the eight modified files and two untracked paths are the inherited set plus nothing else; `--check` and `verify:capability` are green. Nothing reported as complete in this section is reflected only in this file.

Diff-shape proof that §1–§25 survived: `git diff --numstat` over the two artifacts this pass wrote reports `242 0` for this file (**242 insertions, 0 deletions** — a pure append) and `10 10` for `tasks.md` (exactly the ten checkbox flips).

**Post-write re-run.** The whole gate set in §28.3 was run again after the final write to this record, on the finished tree, with identical results: `bun test` → `773 pass / 0 fail / 3730 expect() calls / Ran 773 tests across 52 files`; `bun run typecheck` → clean; `bun run verify:capability` → `verify-capability-manifest: OK`; `bun run verify:style` → `verify-style: OK (diff-scoped · 109 owned files · 4 rules)`; `node scripts/refresh-program-lock-facts.mjs --check` → `program lock facts are current`; `git status --short` → the eight inherited modified files, this change's two artifacts, and `?? .pi/` + `?? __tests__/harness-version.test.ts` (`.pi/` is pre-existing local state, not written by this pass).

## 31. Deviations, inherited defects and open items (reported, not repaired)

| # | Item | Severity | Detail and exact repair |
| --- | --- | --- | --- |
| **E-1** | **RED ① and RED ② outputs were never persisted** by the stalled run, and cannot be re-captured inside this pass's authority (`package.json` is identity-allowlisted; re-running the pair is forbidden). | **High for evidence quality; not a code defect** | Repairs available only by a wider mandate: (a) accept §28.2's present-tense substitute (guard green + triangulation case + both detectors cited at `scripts/verify-capability-manifest.mjs:991-994`, `__tests__/lock-facts.test.ts:156-158`), or (b) authorise a fresh RED capture, which forces the indivisible pair. |
| **E-2** | **`CHANGELOG.md` indentation defect (introduced by the inherited run).** The new entry — and two **pre-existing** lines — carry four leading spaces, so the whole block renders as a **code block**, not markdown: `CUR 75:[    upcoming SDD-020/030 slices.]`, `CUR 77:[    ## 0.1.0 — 2026-09-12]`, `CUR 106:[    ## 0.0.1-prealpha.1 — 2026-08-01]` (both headings were at column 0 at `HEAD`, lines 75 and 77). | **High (document integrity)** | T-S3-007's *content* contract is met (bump + D2 rationale + “publication remains off” + supersession note; no “released” claim), but the `0.1.0` heading is not a heading and the historical `0.0.1-prealpha.1` heading was demoted too. **Not repaired: `CHANGELOG.md` is outside this pass's allowed writes** (it *is* within tasks.md's global apply surface, and it is **not** a `PARTICIPATION_PATHS_V1` member, so a dedent-by-4-spaces of lines 75 and 77-106 forces **no** recovery pair and moves **no** identity). |
| **E-3** | Slice 2's **D-1** (canonical doc step 2 prescribes a shell-unsafe `node -e` command) and **D-2** (the mirror write can itself move the identity) remain open exactly as recorded in §20/§24. Nothing in Slice 3 changed them. | High (inherited) | Unchanged from the Slice 2 record; the canonical statement lives in `docs/architecture/program-lock-facts.md`. |
| **E-4** | Line-citation drift in the task rows vs the tree (`fiscal-guard.ts:49→:53`, `:235→:239`; `configurator.test.ts:26→:31`). | Low | Informational; the cited constructs all exist, content-identical. |
| **E-5** | This pass's own inheritance: a prior run of this unit stalled mid-report, so this record is a **merge-and-verify** pass, not a fresh implementation run. | Low | Disclosure only; the tree it verified is the tree that exists. |

## 32. Files this pass wrote

| File | Write | Allowlisted? |
| --- | --- | --- |
| `openspec/changes/pi-recovery-release-readiness/tasks.md` | 10 checkbox flips `- [ ]` → `- [x]` (lines 144-153) | not a `PARTICIPATION_PATHS_V1` member |
| `openspec/changes/pi-recovery-release-readiness/apply-progress.md` | appended this section (§26–§32); §1–§25 preserved byte-for-byte | not a member |

**Nothing else.** No prose file, no source file, no test file, no config, no lock fact, no contract. No `git add`, `git commit`, `git push`, branch, tag or PR.

## 33. Workload / PR boundary

- **Slice 3 changed lines:** `git diff --stat` for the slice's eight tracked files = **59 insertions / 21 deletions = 80 changed lines**, plus the untracked `__tests__/harness-version.test.ts` (**65 lines**) → **≈145 changed lines** for the unit.
- **Budget:** well under the 400-line reviewer budget on its own, so the unit is a single reviewable commit boundary. Aggregate change size across the three slices is the reason the change is `auto-chain` / `feature-branch-chain`; the parent owns the commit boundary.
- **This pass's own diff:** 10 checkbox bytes + this record. It is inside Slice 3's boundary, not a new work unit.
- **Rollback:** per `tasks.md` — edit C1/C2 back and re-run the **full** pair; never hand-edit `candidateIdentity` to a previous value. `DR-6` rollback is restoring the recorded counts (fails nothing). Guard rollback is deleting `__tests__/harness-version.test.ts` and recording the silent drift as the accepted cost.

## 34. Skill resolution (Slice 3)

- `skills/drenyra-sdd/SKILL.md` — **present and read** (injected project path). Its FSD gate vocabulary (phase/gate framing, fail-closed reasoning) framed the version-unit reading here.
- `skills/evidence-citation/SKILL.md` — **present and read** (injected project path). Its citation rule was applied to this record: every claim carries a command, a `path:line`, or a verbatim output. In particular, no claim of “RED recorded” is made anywhere, because no evidence node supports it (E-1).
- Unlike Slice 1, **both** injected paths existed this run; no registry or path fallback was used.

`skill_resolution`: **paths-injected** (both injected in-repo paths existed and were read; no registry or path fallback used).

---

# Slice 3b — documentation repair unit (D-1, D-2, E-2). Docs only; no allowlisted path was written, no recovery pair forced

**Run scope.** A parent-mandated bounded repair unit for the three defects already reported in this record: **D-1** (§20, the canonical command is shell-unsafe), **D-2** (§20, the ordering premise is conditionally false) and **E-2** (§31, the `CHANGELOG.md` headings render as code). Nothing else: no source, no test, no config, no contract, no behaviour change, no new test. §1–§34 above are preserved **byte-for-byte**; this section is an append.

**Committed / branched / pushed / tagged / PR'd by this run: no.** No `git add`, `git commit`, `git push`, branch, tag or PR; no child subagent.

## 35. Status and action context consumed (with the guard read explicitly)

Native authority for `pi-recovery-release-readiness`, consumed before any edit: `applyState: all_done`, `taskProgress 26/26`, `unchecked: []`, `deferredParentActions 0/0`, `artifactStore: openspec`, `actionContext.mode: repo-local`, `allowedEditRoots: [<repo root>]`, `isNonAuthoritative: false`, `blockedReasons: []`, `nextRecommended: sdd-verify`.

The engine's guidance for that state is *"All implementation tasks are checked complete; do not edit."* — which forbids re-running this change's 26 implementation rows and forbids touching them. It does not describe this unit: Slice 3b is a **separately authorised repair slice** whose write surface is the six paths named in the parent prompt, and it is not a re-run of `sdd-apply`. Both readings were honoured literally:

| Guard | How this run honoured it | Evidence |
| --- | --- | --- |
| "do not edit" (implementation rows) | **No implementation row was created, selected, checked or unchecked.** `tasks.md` still reads **26 `- [x]` / 0 `- [ ]`** after the run | §41 |
| `allowedEditRoots` | Every write is inside the repo root; no write outside it | §42 |
| `applyState: blocked` / missing artifacts | Not the case — status is `all_done`, and all four apply artifacts (tasks, spec, design, apply-progress) were read from disk before any edit | §35 |
| Review Workload Gate | Read from `tasks.md`: `Decision needed before apply: No`, `Chained PRs recommended: Yes`, `Chain strategy: feature-branch-chain`, `400-line budget risk: Medium` (all four guard lines verified at `tasks.md:18-28`); session preflight resolves `auto-chain`. This unit is **107 changed lines** of repair surface and stays inside its assigned slice boundary, so it implements a slice, not a new work unit | §47 |
| Strict TDD | Not active for this unit: it changes **no** executable artefact, so there is no behaviour to Red-Green. No test was written, none was weakened | §38, §43 |

## 36. Defect D-1 (HIGH) — the canonical command is now shell-safe, and it was executed

**Exact replacement**, in `docs/architecture/program-lock-facts.md` §"The sequence", step 2 (old form deleted, new form is line 29):

```sh
# OLD (deleted) — `$1` is expanded by the POSIX shell inside the double-quoted payload, so the
# backreference is lost and the whole match becomes a bare value:
node -e "…before.replace(/^(\s*candidate_identity:\s*).*$/m,'$1\"'+id+'\"');…"

# NEW (in the document) — single-quoted payload, replacement supplied as a FUNCTION:
node -e 'const{readFileSync,writeFileSync}=require("node:fs");const facts=JSON.parse(readFileSync("docs/architecture/program-lock-facts.json","utf8"));const id=facts.candidateIdentity;const p="openspec/config.yaml";const before=readFileSync(p,"utf8");const after=before.replace(/^(\s*candidate_identity:\s*).*$/m,function(_match,key){return key+JSON.stringify(id);});if(after===before)throw new Error("openspec/config.yaml has no candidate_identity line to rewrite");writeFileSync(p,after);console.log("config.yaml mirror <- "+id);'
```

Shape guarantees, measured on the documented line itself: **0 backticks** (nothing to command-substitute) and **1 dollar sign**, which is the regex end-anchor `$` inside the single-quoted payload — the shell cannot expand it, and the replacement is a function, so `String.replace` cannot interpret a `$` pattern either. `JSON.stringify(id)` reproduces the existing double-quoted YAML scalar exactly.

**Executed proof (verbatim).** The command was extracted from the canonical document by pattern and run in a real POSIX shell against the real tree. Because the mirror already carried the generator's value, the precondition was created first with a byte-neutral, self-reverting perturbation (the corrected command cannot fire when `after === before`, and re-inflicting the old corruption on a committed file would have produced no new evidence — the old form's failure is already measured verbatim in §20):

```text
$ grep -n 'candidate_identity' openspec/config.yaml
41:      candidate_identity: "dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce"
$ sha256sum openspec/config.yaml
270e0122903bdbd5fdafff95b2326028dbb0e513bebae36f18a8f3a7b7b50ecf  openspec/config.yaml

$ node -e 'const fs=require("node:fs");const p="openspec/config.yaml";const b=fs.readFileSync(p,"utf8");const a=b.replace(/^(\s*candidate_identity:\s*).*$/m,function(_m,k){return k+JSON.stringify("dirty-sha256:"+"0".repeat(64))});if(a===b)throw new Error("no mirror line");fs.writeFileSync(p,a);console.log("perturbed (deliberately stale value)")'
perturbed (deliberately stale value)
$ grep -n 'candidate_identity' openspec/config.yaml
41:      candidate_identity: "dirty-sha256:0000000000000000000000000000000000000000000000000000000000000000"

$ CMD=$(grep -m1 "^node -e 'const{readFileSync" docs/architecture/program-lock-facts.md)
$ sh -c "$CMD"
config.yaml mirror <- dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce
exit=0

$ grep -n 'candidate_identity' openspec/config.yaml
41:      candidate_identity: "dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce"
$ sha256sum openspec/config.yaml
270e0122903bdbd5fdafff95b2326028dbb0e513bebae36f18a8f3a7b7b50ecf  openspec/config.yaml
sha256: BYTE-IDENTICAL to baseline (net-zero write)

$ node -e 'const{readFileSync}=require("node:fs");const YAML=require("yaml");const d=YAML.parse(readFileSync("openspec/config.yaml","utf8"));console.log("YAML.parse OK — current_test_state.candidate_identity =",d.current_test_state.candidate_identity)'
YAML.parse OK — current_test_state.candidate_identity = dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce

$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts
exit=1
```

**Verdict against the three required clauses.** (a) the `candidate_identity:` key **survives**, with its indentation and its value; (b) the file stays **valid YAML** (`YAML.parse` succeeds where the old form produced `L41: Implicit map keys need to be followed by map values`); (c) the write is **byte-neutral** — sha256 identical to the pre-proof bytes, so `workingTreeChanged()` for that path is unchanged and the command cannot have moved the identity.

**The third clause as the prompt states it — "`--check` still reports `current`" — is NOT satisfiable at this tree, and that is not caused by this repair.** Measured: `--check` exits **1**. Cause, measured rather than inferred (§44): the recorded `headSha` is `2c74ee24…` (the Slice 2 commit) while `HEAD` is `edcdeed…` (the commit that contains the Slice 3 work), and `deriveProgramLockFacts` sets `prospective.headSha = gitHead(root)` (`scripts/refresh-program-lock-facts.mjs:146`), so the checkpoint is stale **unconditionally** at this commit. The other half of the proof is unaffected: `bun run verify:capability` → `OK` (§43).

## 37. Defect D-2 (HIGH) — the ordering paragraph now states the measured truth

**Exact replacement** of the `**Why the order matters.**` paragraph in `docs/architecture/program-lock-facts.md` (old paragraph deleted in full):

```md
**Why the order matters.** `openspec/config.yaml#/current_test_state/candidate_identity` is the one field the
identity algorithm normalizes (`normalizeConfigYaml` in `scripts/compute-candidate-identity.mjs`): the mirror
is normalization-exempt as a **value**, never as a **path**. Membership is decided by `workingTreeChanged()`
→ `git diff --quiet HEAD -- <path>` over raw bytes, so when the mirror write is `openspec/config.yaml`'s
**only** change the identity moves with that write, and `refresh → mirror → --check` cannot converge in one
pass: `--check` reports `program lock facts are stale`. Iterate to the fixed point — run the refresh **again**
once the mirror line exists, then `--check`. When other `openspec/config.yaml` fields change in the same unit
(the usual case: the recorded counts participate in the identity), the first refresh already computed the
identity with the file modified, so the single pass converges.

A refresh **without** the mirror rewrite is the other failure mode, and it is silent: `bun run
verify:capability` goes red while the generator's own `--check` still exits 0, because the mirror is not an
input to the checkpoint. The mirror must carry exactly the value the last refresh produced, and step 3 must
follow it. **Steps 1-3 are one indivisible operation.**
```

It keeps the true half (the silent-red `verify:capability` symptom, the "write the mirror last" rule, the indivisibility) and replaces the false half with the two cases that were actually measured: mirror-only change → iterate to the fixed point; other `config.yaml` fields changed too → one pass converges.

**One companion line, same defect class.** Step 3's fence comment asserted "*this also proves step 2 did not move the identity*". That is the falsified premise in executable position, so it now reads: `# 3. The checkpoint must now be current. If the mirror write was openspec/config.yaml's only / # change, the identity moved with it: repeat steps 1-2, then run this check (see below).` No other line of the fence changed.

## 38. Defect E-2 (HIGH) — `CHANGELOG.md` headings restored

**Exact change:** the four leading spaces were removed from **line 75** (the `Migration note` continuation) and from **every non-empty line of 77–106** — the `## 0.1.0` entry and the four-space-demoted `## 0.0.1-prealpha.1` heading. 26 non-empty lines affected (75, 77, 79, 81–97, 99, 101–104, 106); blank lines inside the range were already empty and needed no change. Continuation lines went from 6 → 2 spaces, which is their correct list-continuation indent under `-`.

**Rest of the file checked for the same class** (every line with ≥4 leading spaces): lines 18–35, 42–53, 58–67 and 122–149 are legitimate continuations nested under ` - ` items (list content column 4), not inadvertent indentation. Verified by rendering the document, not by eye — at `HEAD` both target headings were a **code block** and after the repair there is none:

```text
--- CHANGELOG.md @ HEAD (damaged) ---
headings: 8 | code tokens: 1 [ '"## 0.1.0 — 2026-09-12"' ]
has 0.1.0 heading: false | has 0.0.1-prealpha.1 heading: false
--- CHANGELOG.md @ repaired working tree ---
headings: 12 | code tokens: 0
has 0.1.0 heading: true | has 0.0.1-prealpha.1 heading: true
```

(`marked.lexer`, walking nested tokens, recursively.) The damaged content predated this change, so the **pre-existing** `## 0.0.1-prealpha.1` heading is restored too. No changelog **content** changed: `git diff` for the file is indentation-only (26 lines out, 26 in).

## 39. `RELEASING.md` — checked, and **left byte-identical** (it does not restate the command)

Verified rather than assumed, by reading the whole of step 7 and grepping the file:

- step 7 contains **no** `node -e` command at all. It names the obligations and delegates the one command: `# produced (exact command: docs/architecture/program-lock-facts.md, step 2)` (`RELEASING.md:98-99`), followed by `node scripts/refresh-program-lock-facts.mjs --check`.
- `grep -n "node -e\|$1" RELEASING.md` → **no matches** for the shell-unsafe form anywhere in the file.

So the canonical statement lives in one place exactly as designed, and no edit was needed. **Disclosed nuance, deliberately not edited:** the same sentence calls the mirror write "safe" via the normalization exemption — a compressed form of the D-2 premise. It is bounded by the link ("is **not restated here**") and the canonical document now states the value/path distinction normatively; the parent prompt's mandate for this file was "fix only if you find restatement", and there is none. Recorded here so a reviewer can decide, rather than silently widened.

## 40. `tasks.md` and `design.md` — the operational artifact corrected, the design record annotated (not rewritten)

**`tasks.md`, "The indivisible command block":** the unsafe step-1 command was replaced with the **same shell-safe form** as the canonical document (§36), and its step-2 comment now states the value/path distinction and the fixed-point rule, pointing at the canonical document. Nothing else in the file changed — **no checkbox, no ownership marker** — and the diff is **7 insertions / 3 deletions**.

**`design.md`:** the design text is **kept as authored**, including both command occurrences (lines 119, 477) and the falsified `# 2. … AND the mirror write did not move the identity` comment. One clearly marked blockquote note was added at §8.2 (the block that carries both defects) titled `> **Measurement note — two premises of this block were falsified during apply (repair unit 3b).**` It (1) names the shell-unsafety of the double-quoted `$1` form and the function-replacement fix, (2) states that value-exemption ≠ path-exemption and gives the fixed-point rule, and (3) points at `docs/architecture/program-lock-facts.md` as the corrected normative statement (relative link `../../../docs/architecture/program-lock-facts.md`). No design prose was deleted or rewritten; the diff is **16 added lines, 0 removed**.

## 41. Persisted task checkboxes — unchanged, and re-read after the run

```text
grep -c '^- \[x\]' openspec/changes/pi-recovery-release-readiness/tasks.md    → 26
grep -c '^- \[ \]' openspec/changes/pi-recovery-release-readiness/tasks.md    → 0
```

The only diff lines in `tasks.md` are inside the command-block fence (§40), i.e. **7 insertions / 3 deletions outside any checkbox line**. No malformed or duplicate `sdd-owner` marker exists; none was added (`grep` finds 26 markers, all of the terminal form `<!-- sdd-owner: implementation -->`). Every implementation row remains `- [x]`, so nothing in this run can leave a completed task reflected only in prose — the phases' completion evidence is unchanged by this unit.

## 42. Scope proof — which allowlisted paths were modified: **none**

`PARTICIPATION_PATHS_V1` (`scripts/compute-candidate-identity.mjs:45-67`) contains 21 paths. None of the files this unit was allowed to write is a member: `CHANGELOG.md`, `RELEASING.md`, `docs/architecture/program-lock-facts.md` (only the `.json` is a member), and the three artifacts under `openspec/changes/pi-recovery-release-readiness/`. Members verbatim from the source: `ROADMAP.md`, `__tests__/{capability-manifest,lock-facts,release-verify-workflow}.test.ts`, `capability-manifest.yaml`, `contracts/{README.md,SHA256SUMS.json,package-contract.md,runtime-dependency.md}`, `docs/architecture/program-lock-facts.json`, the seven `openspec/changes/pi-sdd-010-participation/**` artifacts, `openspec/config.yaml`, `package.json`, `scripts/{compute-candidate-identity,verify-capability-manifest}.mjs`.

The empirical half of the proof:

```text
$ git status --porcelain -- docs/architecture/program-lock-facts.json package.json capability-manifest.yaml \
      openspec/config.yaml contracts __tests__ scripts
[empty]

$ sha256sum openspec/config.yaml
270e0122903bdbd5fdafff95b2326028dbb0e513bebae36f18a8f3a7b7b50ecf  openspec/config.yaml
270e0122903bdbd5fdafff95b2326028dbb0e513bebae36f18a8f3a7b7b50ecf  ← same file, hashed before the proof
```

The transient proof perturbation in §36 is therefore **net-zero at the byte level**, which is the only thing membership depends on: the same raw bytes produce the same `git diff --quiet HEAD --` verdict, hence the same identity. Baseline `git status --short` at the start of this unit was `?? .pi/` only.

## 43. Verification set — verbatim

```text
$ bun test
 773 pass
 0 fail
 3732 expect() calls
 Ran 773 tests across 52 files. [10.46s]
exit=0

$ bun run typecheck
$ tsc --noEmit
exit=0

$ bun run verify:capability
$ node scripts/verify-capability-manifest.mjs
verify-capability-manifest: OK
exit=0

$ bun run verify:style
$ node scripts/verify-style.mjs
verify-style: OK (diff-scoped · 109 owned files · 4 rules)
exit=0

$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts
exit=1

$ git status --short
 M CHANGELOG.md
 M docs/architecture/program-lock-facts.md
 M openspec/changes/pi-recovery-release-readiness/design.md
 M openspec/changes/pi-recovery-release-readiness/tasks.md
?? .pi/
```

(`bun test` output ANSI-stripped; `773/0/52` matches the counts recorded in §28.4, so this repair does not disturb `DR-6`'s recorded evidence. The `--check` failure is the pre-existing condition of §44 — **not** a regression, and not caused by any file this unit wrote: the complete prospective-vs-committed diff of the lock facts is **two** fields, `headSha` and the `candidateIdentity` derived from it, both driven by `HEAD`.)

**Post-record re-run.** The whole set was run once more on the finished tree, with this record written: `bun test` → `773 pass / 0 fail / 3732 expect() calls / Ran 773 tests across 52 files`; `bun run typecheck` → exit 0; `bun run verify:capability` → `OK`; `bun run verify:style` → `OK (diff-scoped · 109 owned files · 4 rules)`; `--check` → unchanged; and `git status --short` shows the same four files **plus this record** and `?? .pi/`. Nothing this unit wrote is an input to any of the gates above (`§42`).

## 44. NEW FINDING D-5 (HIGH for the tree; not introduced here) — the committed tree ships stale lock facts

```text
$ node --input-type=module -e '… deriveProgramLockFacts(process.cwd()) → diff committed vs prospective'
  L5  - "headSha": "2c74ee2423d069208347d536749e8e5b20f07cbb"
      + "headSha": "edcdeed2a72dcf4503e67dbeca70dffb4b12f686"
  L6  - "candidateIdentity": "dirty-sha256:be3734cbf7bc8977af51f9e22a4aaf237ec8ca81fe7357a214c1431be7b11fce"
      + "candidateIdentity": "dirty-sha256:04886d35d0cc61c871f45432cfc9a56c1b380f3f10fcf624056f7ea821c02c22"
differing lines: 2
$ git rev-parse HEAD            → edcdeed2a72dcf4503e67dbeca70dffb4b12f686
$ recorded headSha              → 2c74ee2423d069208347d536749e8e5b20f07cbb   (= the Slice 2 commit `2c74ee2`)
```

**What it means.** `edcdeed` committed the Slice 3 work while `docs/architecture/program-lock-facts.json` still recorded the Slice 2 `headSha` and the dirty candidate identity computed at that moment. Advancing `HEAD` is itself one of the documented trigger classes, so the mandatory sequence is owed **once more** — `node scripts/refresh-program-lock-facts.mjs --check`, a command this repository's own release records cite, exits 1 at the committed tree.

**Why this unit did not repair it.** The repair *is* the recovery pair, and it writes `docs/architecture/program-lock-facts.json` and the `openspec/config.yaml` mirror — both explicitly outside this unit's allowed writes and both `PARTICIPATION_PATHS_V1` members. Repairing it here would have forced the indivisible pair, the full verification set and a second mirror rewrite, i.e. exactly the scope the prompt excluded. **Owning route: the parent** — this is the same pair the archive step forces anyway (`tasks.md:171`), so running it once there covers both.

**Not self-healed by the doc repair.** The files this unit wrote are not inputs to the facts (§42), so no edit inside this unit's mandate can move `--check` to green.

## 45. Recovery pair — not forced, demonstrated rather than assumed

The unit wrote **no** `PARTICIPATION_PATHS_V1` path (§42), so no pair is owed: `openspec/config.yaml` is byte-identical to its pre-unit state (sha256 `270e0122…`), and every member path is clean in `git status --porcelain`. Both halves of the proof were re-run anyway, because they are cheap and they are the only valid evidence of a consistent tree: `bun run verify:capability` → `OK`; `node scripts/refresh-program-lock-facts.mjs --check` → **stale, for the pre-existing reason in §44**. Had this unit touched a member path, the four-step indivisible block would have been run and said so; it did not.

## 46. Files this unit wrote

| File | Write | `PARTICIPATION_PATHS_V1` member? |
| --- | --- | --- |
| `docs/architecture/program-lock-facts.md` | step-2 command → shell-safe function form; step-3 comment; `**Why the order matters.**` paragraph rewritten (20 insertions / 9 deletions) | not a member (only the `.json` is) |
| `CHANGELOG.md` | 4-space dedent, lines 75 and 77–106 (26 in / 26 out, indentation only) | not a member |
| `RELEASING.md` | **nothing** — verified, byte-identical | not a member |
| `openspec/changes/pi-recovery-release-readiness/tasks.md` | command block: step-1 command + step-2 comment (7 insertions / 3 deletions) | not a member |
| `openspec/changes/pi-recovery-release-readiness/design.md` | one marked measurement note at §8.2 (16 insertions / 0 deletions) | not a member |
| `openspec/changes/pi-recovery-release-readiness/apply-progress.md` | appended this section (§35–§48); §1–§34 preserved byte-for-byte | not a member |

**Nothing else.** No source, no test, no `contracts/**`, no `package.json`, no `capability-manifest.yaml`, no `openspec/config.yaml`, no `docs/architecture/program-lock-facts.json`, no script. No `git add`/`commit`/`push`, no branch, tag or PR.

## 47. Workload / PR boundary

```text
$ git diff --numstat -- CHANGELOG.md docs/architecture/program-lock-facts.md \
      openspec/changes/pi-recovery-release-readiness/tasks.md openspec/changes/pi-recovery-release-readiness/design.md
26 26 CHANGELOG.md
20 9 docs/architecture/program-lock-facts.md
16 0 openspec/changes/pi-recovery-release-readiness/design.md
7 3 openspec/changes/pi-recovery-release-readiness/tasks.md

$ git diff --numstat -- openspec/changes/pi-recovery-release-readiness/apply-progress.md
<n> 0 openspec/changes/pi-recovery-release-readiness/apply-progress.md   ← 0 deletions: a pure append
```

**107 changed lines** of repair surface (26+26 for the mechanical dedent, 20+9 for the canonical document, 16 for the design note, 7+3 for the command block) plus this section, which is **append-only** — its deletion count is 0, so §1–§34 are provably intact and no byte of the earlier record was rewritten. (The record's own insertion count `n` is measured at the time of writing and grows with any later in-place correction — this section needed three such corrections while the measurements above were being pinned down, which is itself why only the four repair files are quoted by exact count.) That is comfortably inside the 400-line reviewer budget, so the parent's commit boundary can take it as one reviewable slice of the existing `feature-branch-chain`. Most of the count is the `CHANGELOG.md` dedent, which is one mechanical edit expressed as 26 rewritten lines. **Rollback:** `git checkout -- CHANGELOG.md docs/architecture/program-lock-facts.md openspec/changes/pi-recovery-release-readiness/tasks.md openspec/changes/pi-recovery-release-readiness/design.md` — no allowlisted path, no generated artefact and no recorded count is involved, so rollback forces no recovery pair and invalidates no digest.

## 48. Risks and notes for verify

| # | Note | Severity |
| --- | --- | --- |
| 1 | **D-5 (new):** the committed tree's lock facts are stale (`headSha` records the Slice 2 commit, `HEAD` is the Slice 3 commit), so `node scripts/refresh-program-lock-facts.mjs --check` exits 1 at `HEAD`. Repair = the recovery pair on member paths, i.e. the parent's route (and the archive step forces it anyway). Not caused by, and not fixable inside, this unit. | **High** |
| 2 | The executed D-1 proof perturbed the mirror to make the documented command fire, then restored it byte-identically (sha256 `270e0122…`, verified). A reviewer who prefers no write to a member path even transiently should note that the file is byte-identical, `git status` for every member path is empty, and the pair's two halves were re-run. | Low |
| 3 | `RELEASING.md`'s "the normalization exemption that makes that write safe" is a compressed form of the D-2 premise, left as-is because the file restates no command and explicitly delegates the rationale (§39). Flagged for the reviewer's judgement. | Low |
| 4 | The design record still contains the unsafe command (lines 119, 477) and the falsified comment (line 479), by instruction; only a pointer note was added (§40). A reader who does not read the note will see the old form. | Medium |
| 5 | The `CHANGELOG.md` diff reads as 26 changed lines for a 4-space dedent; the content is unchanged. Render confirmed with `marked` (§38). | Low |
| 6 | `bun run verify:style` is diff-scoped (`109 owned files`), so it does not adjudicate `CHANGELOG.md`/`design.md` prose; the markdown lint and the `marked` render are this unit's prose evidence. | Low |

## 49. Skill resolution (Slice 3b)

- `skills/drenyra-sdd/SKILL.md` — **present and read** (injected path). Its FSD framing (fail-closed gates, "a material action needs its evidence") shaped the decision to run the D-1 command rather than assert it, and to refuse the `--check` clause instead of paraphrasing it green.
- `skills/cognitive-doc-design/SKILL.md` — **NOT loaded: the injected path does not exist in this repository** (`/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell/skills/cognitive-doc-design/SKILL.md` → no such file; a directory listing of `skills/` shows no `cognitive-doc-design`). Reported as unavailable, **not** substituted from another checkout, exactly as the prompt instructed.

`skill_resolution`: **fallback-path** — one injected project path existed and was read; the second injected path does not exist and is reported unavailable. No registry discovery and no substitution from another repository were performed.
