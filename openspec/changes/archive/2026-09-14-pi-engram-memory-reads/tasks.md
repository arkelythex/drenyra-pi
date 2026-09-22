# Tasks — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads`
**Phase:** tasks — read-only against the repository. **The only write performed by this phase is this file.**
**Store:** `openspec` (file-backed, authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Authority:** `design.md` (authority for this phase), `specs/engram-integration/spec.md` delta (`REQ-ENG-005`, `REQ-ENG-006`, 5 scenarios), `proposal.md`.

**Scope in one sentence.** One new Pi tool (`drenyra_institutional_memory`), backed by the already-built Engram client, reachable only by `journal-candidate-agent`, calling only `engram_search` — nothing else changes.

---

## Hard boundaries (apply phase)

**Global allowed edit surface:** `extensions/register.ts` (the new tool registration + its execute function only), `agents/journal-candidate-agent.md` (`tools:` frontmatter line + one short usage paragraph only), `contracts/engram-dependency.md` (rule 6 only), `capability-manifest.yaml` (only the `engram-integration` capability entry), `__tests__/extension.test.ts` (new tests only), `__tests__/capability-manifest.test.ts` (only if honestly updating existing guard assertions with new evidence), `docs/architecture/ecosystem-boundaries.md` (only if the Engram-boundary lines need a precise update — check before assuming), and this change's own artifacts.

**Prohibited:** every path prohibited by `pi-engram-integration`'s own hard boundaries (unchanged: `contracts/package-contract.md`, `contracts/runtime-dependency.md`, `openspec/specs/**` outside this change's own delta, `MASTER_CAPABILITIES`/counts, `PARTICIPATION_PATHS_V1`, `scripts/compute-candidate-identity.mjs`, `scripts/verify-capability-manifest.mjs`, `.git/**`), plus: `runtime/engram-client.ts`, `runtime/engram-pin.ts` (no change to the client itself — `design.md` §5), any agent file other than `journal-candidate-agent.md`, any `accounting_*` tool call, any write-shaped `engram_*` tool call, any gate/materiality/approval logic.

---

## Slice A — `drenyra_institutional_memory` tool (`REQ-ENG-005`, `REQ-ENG-006`)

- [x] T-001 — Recorded `git status --short` (clean). Re-read `contextHandler`/`spawnEngramClientFn`/`DrenyraPiExtensionDeps` in full. <!-- sdd-owner: implementation -->
- [x] T-002 — **RED.** Extended `makeMockPi` to capture `registerTool` calls (it was previously a no-op stub, discarding tools). Added 5 cases to `__tests__/extension.test.ts`. **RED confirmed verbatim: `30 pass / 5 fail`** (tool not found). <!-- sdd-owner: implementation -->
- [x] T-003 — **GREEN.** Added `institutionalMemoryExecute` (local function, alongside `contextHandler`) and its `pi.registerTool()` call, mirroring `extensions/fiscal-guard.ts`'s already-established `registerTool` pattern (`Type.Object`, `content`/`details` shape) — **corrected exploration.md**: `pi.registerTool()` was already used 5x in `fiscal-guard.ts`, the first grep was scoped too narrowly. **GREEN: `35 pass / 0 fail / 206 expect() calls`.** <!-- sdd-owner: implementation -->
- [x] T-004 — **TRIANGULATE.** Added the tool-level-error case. **Confirmed verbatim: `36 pass / 0 fail / 208 expect() calls`** — passed against the existing GREEN implementation with no code change. <!-- sdd-owner: implementation -->
- [x] T-005 — **REFACTOR.** Reviewed: modest duplication against `contextHandler`'s spawn/shutdown pattern exists but extracting it risks blurring the two tools' distinct authority framing (`design.md` §2's own caution) for a small saving. No change made. <!-- sdd-owner: implementation -->
- [x] T-006 — Updated `contracts/engram-dependency.md` rule 6 (added `engram_search`) and its Reference Implementation table row (now names both callers). <!-- sdd-owner: implementation -->
- [x] T-007 — Updated `agents/journal-candidate-agent.md`: frontmatter + new "Institutional memory" section. **Caught by CI-equivalent local test, not anticipated in this task's original wording:** `assets/agents/journal-candidate-agent.md` is a required byte-for-byte mirror (`__tests__/agents.test.ts` T-S6-001/T-S6-004) — copied the same edit there. <!-- sdd-owner: implementation -->
- [x] T-008 — Updated `capability-manifest.yaml#/capabilities/engram-integration`: sources/tests/limitation updated precisely; `state` stayed `"partial"`. <!-- sdd-owner: implementation -->
- [x] T-009 — `__tests__/capability-manifest.test.ts` → **`35 pass / 0 fail / 121 expect() calls`**, both guards unchanged. <!-- sdd-owner: implementation -->
- [x] T-010 — Full verification. First pass surfaced 6 failures (not the expected 3): the `assets/agents/` mirror gap (T-007's addendum) and a stale `contracts/SHA256SUMS.json` (fixed via `node scripts/verify-package-files.mjs --update`, since `contracts/engram-dependency.md` changed). Both fixed; re-ran, forced the recovery pair (`capability-manifest.yaml` and `contracts/SHA256SUMS.json` are both `PARTICIPATION_PATHS_V1` members) — two-pass, mirror-only case, converged. **Final evidence: `bun test` → 799 pass / 0 fail / 3794 expect() calls (54 files); typecheck clean; `verify:style` OK (113 owned files); `verify:capability` OK; `--check` current.** <!-- sdd-owner: implementation -->
- [x] T-011 — Scanned `git diff main -- extensions/ runtime/ __tests__/ agents/` for forbidden tool names and gate references — no matches outside this change's own citations of the rules it verifies. <!-- sdd-owner: implementation -->

---

## Review Workload Forecast

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: n/a
400-line budget risk: Low
```

Estimated changed lines (source, not binary — no new binaries in this slice): ≈ 250–350 (new tool + execute function, tests, contract/agent/manifest updates). Comfortably a single reviewable PR; no chaining needed.

---

## Not to be re-planned / already delivered

`runtime/engram-client.ts`, `runtime/engram-pin.ts`, the vendored binary, and `/drenyra:context`'s own read addendum are all delivered by `pi-engram-integration` and explicitly out of scope here (`proposal.md` §3).
