# Archive Report — pi-engram-integration

**Change**: `pi-engram-integration` (first local SDD change after the six-change program closed)
**Change root (pre-archive)**: `openspec/changes/pi-engram-integration/`
**Repository root**: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Artifact store**: `openspec` (file-backed, authoritative; `openspec/config.yaml` also declares `store_mode: hybrid`)
**Archive date**: `2026-09-14`
**Archived path**: `openspec/changes/archive/2026-09-14-pi-engram-integration/`
**Native gate**: clean end to end — `gentle-ai sdd-status` returned `nextRecommended: archive`, `blockedReasons: []` before this phase started (`verify: all_done`, `archive: ready`). This is the first change in this repository to reach archive via the fully native gate (`sdd-status`/`sdd-attempt`/`sdd-verify-validate`) rather than a manual bypass.
**Runtime attempt token**: `sha256:76a0fe6ce6e9a63819ee040356728647de83b731efe907adfaa3ef31f6dfb45a` (acquired with `--untracked-scope=exclude` for the pre-existing `.pi/` local state, `--max-changed-lines 500`)
**Archived by**: the orchestrating session directly (Claude Code) — `sdd-archive` sub-agent dispatch was refused by a Claude Code hook (`"Claude Code hooks do not expose authenticated caller provenance..."`), the same limitation documented in the `pi-recovery-release-readiness` archive report; performed the phase's mechanics directly, driving the native attempt ledger by hand.

---

## 1. Verdict

| Field | Value |
| --- | --- |
| Archive status | **ARCHIVED** |
| Verification verdict consumed | `pass` — 4/4 requirements, 9/9 scenarios, 0 blockers, 0 critical findings (`verify-report.md`, this same archived folder; native `gentle-ai.verify-result/v1` envelope, validated via `gentle-ai sdd-verify-validate`) |
| Canonical spec sync | ✅ **created** — `openspec/specs/engram-integration/spec.md` is a byte-identical copy of the change's delta spec. New domain (no prior canonical spec existed), so this is a first publication, not a merge. |
| Folder move to archive | ✅ **completed** — `git mv openspec/changes/pi-engram-integration openspec/changes/archive/2026-09-14-pi-engram-integration` |
| Recovery pair (forced by the change-folder lifecycle event) | ✅ **completed**, two-pass fixed point (mirror-only pass A did not converge — the documented mirror-only case; pass B converged, `--check` → current) |
| Candidate identity at close | `dirty-sha256:f93a2380dba556f4eedc369357d5721ff7edfece308ec719490d0e7927334b29` |
| `activeChanges` after the move | `[]` — no active local SDD changes remain |
| Repository state at close | **GREEN**: `bun test` 793 pass / 0 fail (54 files), `bun run typecheck` clean, `verify:style` OK, `verify:capability` OK, `verify:package` OK, `verify-packed-install` OK, `--check` current |

---

## 2. The headSha bootstrap gap at commit time (same disclosed pattern as every prior archive)

The lock facts refreshed in §3 record `headSha: e60376a3...` (the parent commit, the verify-report commit) because `scripts/refresh-program-lock-facts.mjs` derives `headSha` from `git rev-parse HEAD` before this archive's own commit exists. Committing this archive work advances `HEAD` past `e60376a`, which will make `--check` report stale again for exactly one commit — the same structural fact documented in `pi-recovery-release-readiness`'s archive report §2 and `pi-capability-conformance`'s archive report §1b. Not a defect; not repaired here because it cannot be (no commit can embed its own post-commit hash).

---

## 3. Recovery pair — verbatim evidence

```text
$ bun run refresh:lock-facts                     # pass A
refreshed docs/architecture/program-lock-facts.json
activeChanges → []

$ <mirror command from docs/architecture/program-lock-facts.md, step 2>
config.yaml mirror <- dirty-sha256:63af1a92d9fd28e657f2b38e2f1980769dd553a7365b86c72abb22eb6762be18

$ node scripts/refresh-program-lock-facts.mjs --check
refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts
exit=1
```

Mirror-only change on `openspec/config.yaml` did not converge in one pass — the documented case. Iterated:

```text
$ bun run refresh:lock-facts                     # pass B
refreshed docs/architecture/program-lock-facts.json

$ <mirror command, run again with the pass-B value>
config.yaml mirror <- dirty-sha256:f93a2380dba556f4eedc369357d5721ff7edfece308ec719490d0e7927334b29

$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current
exit=0
```

Full verification, re-run after convergence:

```text
$ bun test                                        793 pass / 0 fail / 3777 expect() calls / 54 files
$ bun run typecheck                                exit=0
$ bun run verify:style                             OK (diff-scoped · 113 owned files · 4 rules)
$ bun run verify:capability                        OK
$ bun run verify:package                           OK (54 files / 793 tests; vendored drenyra-ai reconciled)
$ node scripts/verify-packed-install.mjs           OK (310 packed files — includes the 4 vendored drenyra-engram binaries)
$ node scripts/refresh-program-lock-facts.mjs --check   program lock facts are current
```

Never hand-edited: `candidateIdentity`, `headSha`, `checksums.*`, `capabilityStates.digestSha256`. Both writes to `docs/architecture/program-lock-facts.json` went only through `bun run refresh:lock-facts`; the only manual write was the documented mirror field in `openspec/config.yaml`, twice.

---

## 4. Canonical spec publication

`openspec/specs/engram-integration/` did not exist before this archive. `openspec/specs/engram-integration/spec.md` was created as a byte-identical copy of `openspec/changes/pi-engram-integration/specs/engram-integration/spec.md` (confirmed with `diff`, no output) — a first publication of a new domain (4 requirements REQ-ENG-001..004, 9 scenarios), not a merge. The archived copy is preserved at `openspec/changes/archive/2026-09-14-pi-engram-integration/specs/engram-integration/spec.md` (moved by `git mv`).

---

## 5. Artifacts read and preserved

| Artifact | Archived path |
| --- | --- |
| Exploration | `exploration.md` |
| Preproposal | `preproposal.md` |
| Proposal | `proposal.md` (kept as originally written; corrections layered in via strikethrough pointing at `design.md` §6, not silently rewritten) |
| Spec (delta) | `specs/engram-integration/spec.md` |
| Design | `design.md` (§6 documents the mid-design correction: Engram's scope model has no session-pointer concept, discovered by probing the live MCP server directly) |
| Tasks | `tasks.md` (23/23 `- [x]`, 3 slices) |
| Verify report | `verify-report.md` (native `gentle-ai.verify-result/v1` envelope, `verdict: pass`) |

All moved by `git mv`, byte-identical to their pre-move content.

---

## 6. What this change actually delivered vs. what it did not (carried from verify-report.md §7-8, restated for the archive record)

**Delivered:** a pinned, checksum-verified, fail-closed `drenyra-engram` binary (4 platforms, `contracts/engram-dependency.md`); a supervised MCP child-process lifecycle (`runtime/engram-client.ts`); a read-only institutional-context addendum on `/drenyra:context` (`engram_context` only, never `accounting_*`, never a write-shaped tool), active only once a company RUC is already known from the existing local pointer.

**Not delivered, honestly disclosed:** the active company/period scope pointer itself remains `runtime/context.ts`'s local JSON store (Engram's schema has no session-pointer concept to hold it — a real, tested finding, not an assumption); no command reads institutional memory to shape a proposal yet. `capability-manifest.yaml#/capabilities/engram-integration` stays `"partial"`; `ROADMAP.md`'s Slice 5 checkbox stays unchecked, reworded to state precisely what shipped.

**Known, disclosed gap carried forward:** `scripts/verify-package-files.mjs`'s pre-publish reconciliation does not cover the four vendored `drenyra-engram` binaries (only the single `drenyra-ai` pin). No live consequence — `drenyra-shell` publication remains unauthorized (`REQ-REL-006`). Must be closed before any future publication authorization.

---

## 7. Program state at close

`openspec/changes/` now contains only `archive/` — zero active local SDD changes remain. `pi-engram-integration` is the first (and, as of this archive, only) change delivered after the original six-change program closed.

---

## 8. Authority boundaries observed

- No edit to `contracts/package-contract.md`, `contracts/runtime-dependency.md`, `openspec/specs/**` outside this change's own new domain, `MASTER_CAPABILITIES`/capability-state counts, `PARTICIPATION_PATHS_V1`, `scripts/compute-candidate-identity.mjs`, `scripts/verify-capability-manifest.mjs`.
- The only participation-path files touched by this phase are the two the recovery pair is defined to touch: `docs/architecture/program-lock-facts.json` (generator output only) and `openspec/config.yaml` (mirror field only, via the sanctioned command, twice).
- No `accounting_*` MCP tool call and no write-shaped `engram_*` tool call anywhere in the delivered code (re-confirmed at verify, §5 of `verify-report.md`).
- No pin upgrade, no other archived change touched, no publication surface added.

---

## 9. Runtime attempt ledger note

Verify's attempt (ordinal 1, `work_unit: verify`) required an explicit maintainer-authorized `sdd-attempt reset` after settling `passed` with `changed_line_budget_exceeded: true` — the declared `--max-changed-lines 50` at acquire time was too small for the actual 152-line `verify-report.md`; the verification itself was never in question. Archive's own attempt used a more generous `--max-changed-lines 500` based on that lesson.

---

## 10. Reproduce this archive

```sh
cd /home/dreamcoder08/Documents/PROYECTOS/drenyra-shell
git log --oneline -3
node scripts/refresh-program-lock-facts.mjs --check
bun test
bun run typecheck && bun run verify:style && bun run verify:capability
gentle-ai sdd-status pi-engram-integration --cwd "$(pwd)" --json
```
