# Archive Report — pi-recovery-release-readiness

**Change**: `pi-recovery-release-readiness` (local SDD 6 of 6 — the last change in the Drenyra Pi program)
**Change root (pre-archive)**: `openspec/changes/pi-recovery-release-readiness/`
**Repository root**: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Artifact store**: `openspec` (file-backed, authoritative; `openspec/config.yaml` also declares `store_mode: hybrid`)
**Archive date**: `2026-09-14`
**Archived path**: `openspec/changes/archive/2026-09-14-pi-recovery-release-readiness/`
**Archived by**: the orchestrating session directly (Claude Code), not `gentle-ai sdd-archive` — see §0.
**Committed / branched / pushed by this phase**: not yet — this report is written before the archive commit so its own evidence (`git status`, identity) describes the pre-commit state, matching the pattern already established by `verify-report.md` and `apply-progress.md` in this change.

---

## 0. Native gate bypass (continuation of verify-report.md §0)

`gentle-ai sdd-status` still returns `nextRecommended: resolve-blockers` for this change, now for two reasons:

1. `blocked(cross_common_dir_runtime_target): tasks.md targets repositories with a different Git common directory: "/home/dreamcoder08"` — unresolved, same as during verify (see `verify-report.md` §0 for the full investigation; ruled out an orphaned worktree, ambiguous `~` prose in `tasks.md`, stray absolute paths, symlinks, git config, env vars; root cause not confirmed — flagged to the user).
2. `verification evidence is incomplete: missing valid gentle-ai.verify-result/v1 envelope` — `verify-report.md` is a manually authored markdown report (see verify-report §0), not the native tool's expected fenced-YAML envelope format, because `gentle-ai sdd-verify` itself could not run (blocked by #1, and `sdd-verify` sub-agent dispatch was separately refused by a Claude Code hook: *"Claude Code hooks do not expose authenticated caller provenance, so parent-confirmed preflight cannot be transported safely"*).

The maintainer (`dreamcoder08`) explicitly authorized continuing to archive under the same manual-bypass terms as verify, in the same interactive session (2026-09-14), after reviewing the verify-report verdict (PASS, all 21 scenarios). `gentle-ai sdd-archive` was **not** run. No native runtime-attempt token was acquired for this phase, for the same reason given in `verify-report.md` §0.

**Standing follow-up owed to the user** (unchanged from verify): investigate or report the `cross_common_dir_runtime_target` false positive to the `gentle-ai` maintainers, or resolve whatever `/home/dreamcoder08` being its own near-empty git repository actually is, so future SDD changes in this repository do not need a manual bypass.

---

## 1. Verdict

| Field | Value |
| --- | --- |
| Archive status | **ARCHIVED** |
| Verification verdict consumed | `PASS` — 26/26 tasks, 6/6 requirements, 21/21 scenarios, 0 CRITICAL, 0 blockers (`verify-report.md`, this same archived folder) |
| Canonical spec sync | ✅ **created** — `openspec/specs/release-readiness/spec.md` is a byte-identical copy of the change's delta spec. This is a **new domain** (the spec's own Purpose section states "no prior canonical spec; every requirement below is additive"), so this is a first publication, not a merge — no destructive-merge risk existed. |
| Folder move to archive | ✅ **completed** — `git mv openspec/changes/pi-recovery-release-readiness openspec/changes/archive/2026-09-14-pi-recovery-release-readiness` |
| Recovery pair (forced by the change-folder lifecycle event) | ✅ **completed**, iterating to the fixed point exactly as `docs/architecture/program-lock-facts.md`'s "Why the order matters" paragraph (repaired by repair unit 3b) documents for a mirror-only `openspec/config.yaml` change: pass A did not converge (`--check` reported stale after the first refresh + mirror write, because `activeChanges` moving in `program-lock-facts.json` is a *different* file than the mirror in `config.yaml`, and the mirror was `config.yaml`'s only change); pass B (refresh again, then mirror again) converged (`--check` → `program lock facts are current`, exit 0). |
| Candidate identity at close (pre-archive-commit, dirty) | `dirty-sha256:e8659629fa00d9e65b4e08abd1791d4d51887129013712ecc845d66086ce6bab` |
| `activeChanges` after the move | `[]` — this was the last active local SDD change; the program now has zero open changes |
| Repository state at close | **GREEN**: `bun test` 773 pass / 0 fail (52 files), `bun run typecheck` clean, `bun run verify:capability` OK, `bun run verify:style` OK, `bun run verify:package` OK, `node scripts/verify-packed-install.mjs` OK, `node scripts/refresh-program-lock-facts.mjs --check` → current (all re-run after the fixed-point convergence, §3) |

---

## 2. The headSha bootstrap gap at commit time (disclosed, not a defect — same pattern as prior archives)

The lock facts refreshed in §3 record `headSha: d915231b76...` (the parent commit, `docs(openspec): SDD 6 verify report`) because `scripts/refresh-program-lock-facts.mjs` derives `headSha` from `git rev-parse HEAD` **before** this archive's own commit exists — it cannot cite a commit that does not exist yet. Committing this archive work will advance `HEAD` past `d915231`, which makes `node scripts/refresh-program-lock-facts.mjs --check` report stale again **immediately after this commit**, for exactly one commit, until the next participation-path mutation runs the sequence again.

This is the same structural fact recorded throughout this change's own `apply-progress.md` (§7: *"`--check` may report stale after any commit in the branch's history; `bun test` is the authoritative gate for a committed state because the lock-fact test accepts an ancestor `headSha`"*) and in the prior `pi-capability-conformance` archive (`openspec/changes/archive/2026-09-11-pi-capability-conformance/archive-report.md` §1b: *"the identity advance is caused by the mandatory refresh rewriting `activeChanges`, not by the move itself"*). It is not repaired here because it cannot be: no commit can embed its own post-commit hash. The recorded `headSha: d915231b76...` will be an **ancestor** of the archive commit, which is the condition `__tests__/lock-facts.test.ts` and this repository's whole recovery design already accept as correct.

---

## 3. Recovery pair — verbatim evidence

```text
$ bun run refresh:lock-facts                     # pass A
refreshed docs/architecture/program-lock-facts.json
candidateIdentity → dirty-sha256:eae25884f7169ffc9153da2b697e6b5521e2a602c111ade055e0886d19eb203a
activeChanges → []

$ <mirror command from docs/architecture/program-lock-facts.md, step 2>
config.yaml mirror <- dirty-sha256:eae25884f7169ffc9153da2b697e6b5521e2a602c111ade055e0886d19eb203a

$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts
exit=1
```

Mirror-only change on `openspec/config.yaml` did not converge in one pass — exactly the documented case. Iterated:

```text
$ bun run refresh:lock-facts                     # pass B
refreshed docs/architecture/program-lock-facts.json
candidateIdentity → dirty-sha256:e8659629fa00d9e65b4e08abd1791d4d51887129013712ecc845d66086ce6bab

$ <mirror command, run again with the pass-B value>
config.yaml mirror <- dirty-sha256:e8659629fa00d9e65b4e08abd1791d4d51887129013712ecc845d66086ce6bab

$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current
exit=0
```

Full verification, re-run after convergence:

```text
$ bun run typecheck                              exit=0
$ bun run test          (vitest)  52 files / 773 tests passed
$ bun test               (bun)    773 pass / 0 fail / 3730 expect() calls / 52 files
$ bun run verify:style                            verify-style: OK (diff-scoped · 109 owned files · 4 rules)
$ bun run verify:capability                       verify-capability-manifest: OK
$ bun run verify:package  (build + vitest + files) verify-package-files: OK
$ node scripts/verify-packed-install.mjs          verify-packed-install: OK
$ node scripts/refresh-program-lock-facts.mjs --check   program lock facts are current
```

Never hand-edited: `candidateIdentity`, `headSha`, `checksums.*`, `capabilityStates.digestSha256`. Both writes to `docs/architecture/program-lock-facts.json` went only through `bun run refresh:lock-facts`; the only manual write was the documented mirror field in `openspec/config.yaml`, twice, once per fixed-point pass.

---

## 4. Canonical spec publication

`openspec/specs/release-readiness/` did not exist before this archive. `openspec/specs/release-readiness/spec.md` was created as a byte-identical copy of `openspec/changes/pi-recovery-release-readiness/specs/release-readiness/spec.md` (confirmed with `diff`, no output). This is a first publication of a new domain, not a merge into an existing canonical spec — the spec's own Purpose section states this explicitly ("This is a new domain with no prior canonical spec; every requirement below is additive"). No destructive-merge guard was needed because there was nothing to merge into.

The archived copy of the same file is preserved at `openspec/changes/archive/2026-09-14-pi-recovery-release-readiness/specs/release-readiness/spec.md` (moved by `git mv`, not copied) — the historical record of what this change proposed and delivered.

---

## 5. Artifacts read and preserved

| Artifact | Archived path | Lines |
| --- | --- | --- |
| Preproposal | `preproposal.md` | 145 |
| Proposal | `proposal.md` | 233 |
| Exploration | `exploration.md` | 446 |
| Spec (delta) | `specs/release-readiness/spec.md` | 262 |
| Design | `design.md` | 711 |
| Tasks | `tasks.md` | 181 (26/26 `- [x]`) |
| Apply-progress | `apply-progress.md` | 1212 (4 slices/units, all `passed` in the native runtime-attempt ledger) |
| Verify report | `verify-report.md` | 193 (PASS, 21/21 scenarios) |

All eight files moved by `git mv` into `openspec/changes/archive/2026-09-14-pi-recovery-release-readiness/`, byte-identical to their pre-move content (a rename, not a rewrite).

---

## 6. Program state at close

`openspec/changes/` now contains only `archive/` — **zero active local SDD changes remain**. This closes the local Drenyra Pi SDD program (SDD 1 `pi-capability-conformance` through SDD 6 `pi-recovery-release-readiness`), consistent with this change's own framing as "local SDD 6 of 6, the last change in the program" (`proposal.md`).

---

## 7. Risks and open items carried past archive

| # | Item | Severity | Disposition |
| --- | --- | --- | --- |
| — | Native `gentle-ai sdd-status` `cross_common_dir_runtime_target` false positive (§0) | Unresolved | Owed to the user; unrelated to this change's substance. |
| — | `headSha` bootstrap gap at commit time (§2) | Expected, self-resolving | Not a defect; will read stale for one commit, exactly as every prior archive in this repository has. |
| E-3 (inherited from apply-progress §31) | Slice 2's D-1/D-2 findings about the canonical document's original prose were already repaired by repair unit 3b before verify; nothing further to do. | Closed | — |
| E-4 (inherited) | Minor line-citation drift in `tasks.md` rows vs. the tree (e.g. `fiscal-guard.ts:49→53`). | Low, informational | Not repaired; content-identical constructs, no functional effect. |

No new defect was found during archive. All items above were already disclosed in `apply-progress.md` or `verify-report.md`.

---

## 8. Authority boundaries observed

- No edit to `contracts/**`, `MASTER_CAPABILITIES`, the capability-state counts, `PARTICIPATION_PATHS_V1`, or `scripts/compute-candidate-identity.mjs`.
- The only participation-path files touched by this phase are the two the recovery pair is defined to touch: `docs/architecture/program-lock-facts.json` (generator output only) and `openspec/config.yaml` (mirror field only, via the sanctioned command, twice).
- No publication surface added; `ROADMAP.md`'s npm item remains unchecked (carried from verify, unaffected by archive).
- No pin upgrade, no `pi-skills-memory-integration` archive re-opened, no other archived change touched.

---

## 9. Reproduce this archive

```sh
cd /home/dreamcoder08/Documents/PROYECTOS/drenyra-pi
git log --oneline -3
node scripts/refresh-program-lock-facts.mjs --check
bun test
bun run typecheck && bun run verify:style && bun run verify:capability
```
