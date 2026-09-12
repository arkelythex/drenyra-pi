# Design: Capability Conformance Matrix and Stale Audit Cleanup

## Technical Approach

Documentation/manifest-only change (no runtime code). Five architecture
decisions close the gaps the proposal left open: matrix location, how the
four-tier verification tag is expressed without a schema redesign, rollout
order across 8 affected areas, archive mechanics, and PR slicing. All
decisions honor the proposal's out-of-scope line: no `capability-manifest.yaml`
schema/tooling redesign, no `drenyra-ai` edits.

## Architecture Decisions

### Decision: Matrix lives in a new file, not folded into an existing doc

**Choice**: New file `docs/architecture/capability-conformance-matrix.md`.
**Alternatives considered**: (a) fold into `harness-draft-conformance.md` —
rejected: that doc is a closed, dated reconciliation of one historical draft
(SDD-050 numbering) with its own "Result contract" section; it is not shaped
as a per-capability table and mixing concerns would overload an already-
completed record. (b) fold into `ecosystem-boundaries.md`'s "Current state
and maturity" section — rejected: that section is a 4-bullet summary inside
a boundary/architecture-contract doc; a 10+ row, per-capability,
verification-level-tagged evidence table does not fit its shape or its role.
**Rationale**: This repo already has three stale, overloaded point-in-time
docs (root cause per `exploration.md`); a fourth overloaded section repeats
the pattern the proposal is fixing. `ecosystem-boundaries.md`'s summary is
trimmed to a one-line pointer to the new file instead of duplicating counts.

### Decision: Verification-level tag rides in `evidence.note`, not `state`

**Choice**: Add a controlled-vocabulary line inside the existing free-text
`evidence.note` field (already present on `configurator-install-doctor-sync`,
untyped and unvalidated by `scripts/verify-capability-manifest.mjs`).
Format per source: `verificationLevel: <path> = <tag> (<evidence>)`.
**Finding (not a workaround of convenience)**: `state` cannot honestly carry
this. `scripts/verify-capability-manifest.mjs` enforces a **closed, tested**
enum `{implemented, partial, planned}` (`STATES` set, line 47) with
co-required-field rules per value — e.g. `implemented` MUST NOT carry
`limitation` (line 121-123), `partial` MUST carry `limitation`, `planned`
MUST carry `plan`. Renaming/expanding this enum to the four-tier taxonomy,
or repurposing `limitation`, requires editing the validator — that **is**
the schema/tooling redesign the proposal puts out of scope. `evidence.note`
is the narrowest carrier the validator never inspects.
**Alternatives considered**: extend `STATES` (rejected — out of scope);
overload `limitation` (rejected — blocked by validator rule for
`implemented`); new top-level key (rejected — explicit constraint).
**Rationale**: zero validator changes, zero risk of breaking
`__tests__/capability-manifest.test.ts`'s real-manifest assertion.
**Scope of application**: mandatory on the modified `rda-chains` row (below);
backfilling `note` on the other 9 existing rows is recommended but **deferred
as an explicit follow-up bullet in tasks.md**, not silently dropped, to keep
PR2 (below) inside the review budget.

### Decision: The 5 new files are evidence, not new capability keys

**Finding**: `MASTER_CAPABILITIES` (validator line 35-46) is a closed list of
exactly 10 names; the validator rejects any `unknown capability` and any
`missing capability`. The proposal's "add rows for `chains/reconcile.ts`..."
cannot mean 5 new top-level capability keys — that fails validation and
would itself be a schema change. **Choice**: add all 5 files as
`evidence.sources`/`evidence.tests` entries under the existing `rda-chains`
capability (state stays `implemented`), since `reconcile.ts`/`verify.ts`/
`evidence.ts` are the other 3 RDA chains beyond `monthly-close.ts`, and
`accounting-semantics.ts`/`evidence-projection.ts` are the deterministic
libs those chains import (`chains/verify.ts:30`, `chains/reconcile.ts:35`,
`chains/evidence.ts:40` — cited in `exploration.md`).

### Decision: Rollout order — README/ROADMAP → manifest → matrix → archive+docs

**Choice**: fix README/ROADMAP first (self-contained), update
`capability-manifest.yaml` second, publish the new matrix third, and only
then archive `pi-program-status-reconciliation/` + refresh
`harness-draft-conformance.md`/`program-lock-facts.json`/
`ecosystem-boundaries.md` counts, in one slice.
**Rationale**: archiving the stale reconciliation change before the matrix
exists would leave a window with no current reconciliation source of truth
— the exact broken-intermediate-state the task calls out. The matrix must
exist (and cite the already-updated manifest) before the doc it replaces is
retired.

```
README/ROADMAP fix ──▶ manifest rows (rda-chains) ──▶ new matrix doc
                                                            │
                                                            ▼
                          archive pi-program-status-reconciliation/
                                            │
                                            ▼
        refresh harness-draft-conformance.md, program-lock-facts.json
                  (drop stale activeChanges, link matrix),
                       ecosystem-boundaries.md counts
```

### Decision: Archive mechanics

**Choice**: `git mv openspec/changes/pi-program-status-reconciliation/` →
`openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/`
(today's date, ISO, per `openspec-convention.md`). Add one
`archive-report.md` inside stating the supersession reason (wrong pin,
wrong command count, wrong contract-freeze state) and pointing to the new
matrix — matching the `archive-report.md` precedent in
`archive/2026-08-15-pi-sdd-010-participation/`. The folder only ever had
`proposal.md` (never reached design/tasks/verify) — archive it as-is,
additive, never destructive; do not fabricate missing phase files.

## Data Flow

```
capability-manifest.yaml (rda-chains.evidence.sources/tests/note)
        │  cited by
        ▼
docs/architecture/capability-conformance-matrix.md (per-capability
verification-level rows, file:line + test-name citations, dirty-SHA
snapshot like program-lock-facts.json)
        │  referenced by
        ▼
ecosystem-boundaries.md "Current state and maturity" (pointer, not duplicate)
program-lock-facts.json (activeChanges refreshed, points to same evidence)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `README.md` | Modify | Fix npm/install overstatement; correct SDD-020 sentence (line 56) using `configurator-install-doctor-sync`'s manifest note as ground truth |
| `ROADMAP.md` | Modify | Check off shipped Phase 2 items (lines 40-44) |
| `capability-manifest.yaml` | Modify | Add 5 evidence entries to `rda-chains`; add `verificationLevel` note |
| `docs/architecture/capability-conformance-matrix.md` | Create | New evidence-cited matrix, dirty-SHA snapshot |
| `openspec/changes/pi-program-status-reconciliation/` | Move | → `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/` + `archive-report.md` |
| `docs/architecture/harness-draft-conformance.md` | Modify | Refresh or timestamp-disclaim vs. dirty tree |
| `docs/architecture/program-lock-facts.json` | Modify | Drop stale `activeChanges` entry, refresh counts |
| `docs/architecture/ecosystem-boundaries.md` | Modify | Correct counts; point to new matrix |

## Interfaces / Contracts

`evidence.note` controlled vocabulary (informal, validator-transparent):
```
verificationLevel: <source-path> = declared-only|implemented|unit-or-contract-tested|validated-end-to-end (<citation>)
```
No `schemaVersion` bump; `drenyra.capability-manifest.v1` unchanged.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Manifest still validates | `bun run verify:capability` (existing validator, unchanged) |
| Contract | Real-manifest assertion still passes | `__tests__/capability-manifest.test.ts` last case |
| Consistency | No cross-doc contradiction remains | Manual checklist: command count (20), pin (`drenyra-ai@0.4.1`), contract-freeze (Frozen v0.1) agree across README, ecosystem-boundaries.md, program-lock-facts.json, matrix |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary; documentation/manifest only.

## Migration / Rollout

Three chained PRs, in dependency order (deviates from a naive doc-grouping
split because of the sequencing hazard above):
- **PR1**: README.md + ROADMAP.md correction. Small, self-contained, lowest risk.
- **PR2**: `capability-manifest.yaml` `rda-chains` evidence + note. Small, validator-checked.
- **PR3**: new matrix doc + archive `pi-program-status-reconciliation/` + refresh the 3 docs. Largest slice (new-file citations); bundled because archive/refresh is only safe once the matrix lands in the same PR.

No data migration; no feature flags; no runtime behavior touched.

## Open Questions

- [ ] Should the other 9 `capability-manifest.yaml` rows get `verificationLevel` notes now (PR2) or as a tracked follow-up (recommended, to protect the review budget)?
- [ ] Exact replacement wording for README line 56 (SDD-020 sentence) is a product-tone decision for `sdd-tasks`/`sdd-apply`, not fixed here.
