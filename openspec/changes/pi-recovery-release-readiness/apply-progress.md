# Apply Progress — pi-recovery-release-readiness

**Change:** `pi-recovery-release-readiness` (local SDD 6 of 6)
**Phase:** apply — **Slice 1 only** (U2 + U3 + U5 + U5b, documentation)
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Branch:** `feat/sdd-6-recovery-release-readiness`
**Authority:** `design.md` (the authority for this phase), `tasks.md` (Slice 1 rows), `specs/release-readiness/spec.md` (`REQ-REL-001`, `REQ-REL-002`, `REQ-REL-005`).
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
