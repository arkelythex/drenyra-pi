# Archive Report — pi-engram-memory-reads

**Change**: `pi-engram-memory-reads` (second follow-on to `pi-engram-integration`)
**Change root (pre-archive)**: `openspec/changes/pi-engram-memory-reads/`
**Repository root**: `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Artifact store**: `openspec` (file-backed, authoritative; `openspec/config.yaml` also declares `store_mode: hybrid`)
**Archive date**: `2026-09-14`
**Archived path**: `openspec/changes/archive/2026-09-14-pi-engram-memory-reads/`
**Native gate**: clean end to end — third consecutive change in this repository to reach archive via the fully native gate (`sdd-status`/`sdd-attempt`/`sdd-verify-validate`), no manual bypass.
**Runtime attempt token**: `sha256:bb99b1c118f484145843582296a82c012eeb45f86e7cd2f921e5a77bd5cb4066`

---

## 1. Verdict

| Field | Value |
| --- | --- |
| Archive status | **ARCHIVED** |
| Verification verdict consumed | `pass` — 2/2 requirements, 5/5 scenarios, 0 blockers, 0 critical findings |
| Canonical spec sync | ✅ **merged** — `openspec/specs/engram-integration/spec.md` (an existing domain, published by `pi-engram-integration`) gains `REQ-ENG-005`/`REQ-ENG-006`; `REQ-ENG-001`..`004` are byte-unchanged. Purpose and Out-of-Scope prose updated precisely, not overclaimed. **This is the first merge into an already-canonical domain in this repository's history** — the prior two archives (`pi-recovery-release-readiness`, `pi-engram-integration`) each published a brand-new domain. |
| Folder move to archive | ✅ **completed** |
| Recovery pair | ✅ **completed**, two-pass fixed point (mirror-only case, as every prior archive) |
| Candidate identity at close | `dirty-sha256:60b3b0b490eeb68d562badefe99d48dda80a5414a79f91514d022df21693ed6c` |
| `activeChanges` after the move | `[]` |
| Repository state at close | **GREEN**: `bun test` 799 pass / 0 fail (54 files), typecheck clean, `verify:style`/`verify:capability`/`verify:package`/`verify-packed-install` all OK, `--check` current |

---

## 2. Canonical spec merge — the real work this archive did differently

Unlike the prior two archives, this one **merges into an existing canonical spec** rather than publishing a new domain. The merge:

- Appended `REQ-ENG-005` (agent-driven institutional-memory search, 3 scenarios) and `REQ-ENG-006` (memory shapes proposals, never authority, 2 scenarios) after the existing `REQ-ENG-004`.
- Left `REQ-ENG-001`..`004` byte-identical — confirmed by diffing the merged file's first 82 lines against the pre-merge canonical spec.
- Updated the `## Purpose` paragraph to name both contributing changes and both requirement ranges, replacing the now-stale "new domain with no prior canonical spec" framing (which was true when `pi-engram-integration` wrote it, and is no longer true).
- Updated `## Out of Scope`: removed the now-partially-false "proposal-informing memory reads... out of scope" line (false — `journal-candidate-agent` now has exactly one bounded proposal-informing read) and replaced it with the precise, narrower remaining boundary (no `accounting_*`, no write-shaped tool, no agent other than `journal-candidate-agent`, no gate/materiality change) — never silently widened beyond what the two changes together actually deliver.

The archived copy of the delta spec (`specs/engram-integration/spec.md` inside this archived folder) is preserved as originally written by the `sdd-spec` phase — the merge happened only in the canonical `openspec/specs/` copy, matching this repository's established archive convention.

---

## 3. The headSha bootstrap gap (same disclosed pattern, third occurrence)

Recorded `headSha: 8ef3332...` (the parent verify-report commit); this archive's own commit will advance `HEAD` past it, making `--check` report stale again for exactly one commit — the same structural fact disclosed in both prior archive reports. Not a defect.

---

## 4. Recovery pair — verbatim evidence

```text
$ bun run refresh:lock-facts                     # pass A
activeChanges → []

$ <mirror command>
config.yaml mirror <- dirty-sha256:69fb8242239c8b4055b997e076e29d29bd30a407f8f9594f139a1ff7b8882e9c

$ node scripts/refresh-program-lock-facts.mjs --check
FAILED: stale (exit 1)                            # mirror-only case, expected
```

Iterated:

```text
$ bun run refresh:lock-facts                     # pass B
$ <mirror command, pass-B value>
config.yaml mirror <- dirty-sha256:60b3b0b490eeb68d562badefe99d48dda80a5414a79f91514d022df21693ed6c

$ node scripts/refresh-program-lock-facts.mjs --check
program lock facts are current                    exit=0
```

Full verification, re-run after convergence:

```text
$ bun test                    799 pass / 0 fail / 3794 expect() calls / 54 files
$ bun run typecheck           exit=0
$ bun run verify:style        OK (diff-scoped · 113 owned files · 4 rules)
$ bun run verify:capability   OK
$ bun run verify:package      OK (54 files / 799 tests; vendored drenyra-ai reconciled)
$ node scripts/verify-packed-install.mjs   OK (310 packed files)
$ node scripts/refresh-program-lock-facts.mjs --check   program lock facts are current
```

Never hand-edited: `candidateIdentity`, `headSha`, `checksums.*`, `capabilityStates.digestSha256`.

---

## 5. Artifacts read and preserved

| Artifact | Archived path |
| --- | --- |
| Exploration | `exploration.md` |
| Preproposal | `preproposal.md` |
| Proposal | `proposal.md` |
| Spec (delta, extends `engram-integration`) | `specs/engram-integration/spec.md` |
| Design | `design.md` |
| Tasks | `tasks.md` (11/11 `- [x]`) |
| Verify report | `verify-report.md` (native `gentle-ai.verify-result/v1`, `verdict: pass`) |

---

## 6. What this change delivered vs. what remains, honestly

**Delivered:** `journal-candidate-agent` (only) can call `drenyra_institutional_memory` (only), which calls `engram_search` (only) on the already-pinned `drenyra-engram` binary, scoped to the current company RUC only, never touching any gate or the materiality policy.

**Not delivered, disclosed:** the other 9 agents remain without institutional-memory access; `reconciliation-agent` was a considered-and-declined second target for this slice (`preproposal.md` D2); no `accounting_*` tool is called by anything in this repository yet; the active company/period pointer is still local (unchanged by either Engram change).

**Two findings worth carrying forward for whoever picks up the remaining work:**
1. `agents/*.md`'s pre-existing `mem_search`/`mem_save` tools are the generic `Gentleman-Programming/engram` dev-memory, unrelated to `drenyra-engram` — do not confuse them in a future slice.
2. `assets/agents/*.md` is a required byte-for-byte mirror of `agents/*.md` (enforced by `__tests__/agents.test.ts`) — any future agent-file edit must update both.

---

## 7. Program state at close

`openspec/changes/` contains only `archive/` — zero active local SDD changes remain. This is the third change delivered after the original six-change program closed (`pi-engram-integration`, then this one).

---

## 8. Authority boundaries observed

Same boundaries as `pi-engram-integration`'s own archive, plus: no agent file other than `journal-candidate-agent.md` (and its required mirror) touched; no `accounting_*` or write-shaped `engram_*` tool call anywhere in the delivered code (re-confirmed at verify).

---

## 9. Reproduce this archive

```sh
cd /home/dreamcoder08/Documents/PROYECTOS/drenyra-pi
git log --oneline -3
node scripts/refresh-program-lock-facts.mjs --check
bun test
gentle-ai sdd-status pi-engram-memory-reads --cwd "$(pwd)" --json
```
