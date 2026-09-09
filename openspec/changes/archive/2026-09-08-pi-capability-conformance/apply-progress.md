# Apply progress: pi-capability-conformance

## Status

- Phase: `apply`
- Status: `completed-with-deferred-followups`
- Structured status consumed: `gentle-ai.sdd-status` v2; change
  `pi-capability-conformance`; authoritative OpenSpec store; `apply` ready.
- Action context: `repo-local`; workspace and sole allowed edit root were
  `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`; no warnings.
- Delivery: `auto-chain`, `stacked-to-main`; three ordered, uncommitted review
  slices. No branch, commit, PR, publication, receipt, or lifecycle settlement.
- Native acquire context was parent-owned. Apply did not acquire, settle, reset,
  or otherwise mutate the parent's proceed token.

## Review slices and budgets

Counts compare this apply's starting bytes with final bytes. The archived
proposal is a byte-identical move and contributes zero authored changed lines.
SDD bookkeeping is reported separately from review-slice content.

| Slice | Boundary | Additions | Deletions | Total | Budget |
| --- | --- | ---: | ---: | ---: | --- |
| PR1 | README/ROADMAP status correction | 16 | 10 | 26 | within 400 |
| PR2 | `rda-chains` manifest evidence | 14 | 3 | 17 | within 400 |
| PR3 | matrix, proposal archive, audit docs, lock-fact reconciliation | 140 | 24 | 164 | within 400 |
| SDD bookkeeping | `tasks.md` + this progress artifact | 169 | 20 | 189 | outside future PR content slices |
| Final apply total | all rows above | 339 | 57 | 396 | within native 500 |

PR order is `PR1 → PR2 → PR3`, stacked to main. Rollback boundaries are the
files named by each row; PR3 restores the proposal folder if its archive is
reverted. No size exception was used.

## Completed implementation tasks

Persisted checkboxes are visibly `[x]` for tasks 1.1–1.5, 2.1–2.4, and
3.1–3.11. Highlights:

- README now distinguishes pre-Wave-1 configurator scaffolding from master
  SDD-020 and labels npm publication pending.
- ROADMAP marks only Slices 1–4 shipped; Slice 5 Engram and npm remain unchecked.
- `rda-chains` cites all five added source/test pairs with
  `unit-or-contract-tested` notes and no operational-E2E claim.
- The matrix has exactly 10 capability rows, one verification level each,
  concrete citations, the synthesis disclaimer, point-in-time identities, and
  explicit Engram/fixture limitations.
- The obsolete reconciliation proposal is preserved proposal-only under the
  archive path with a SUPERSEDED report; no implementation or verification is
  attributed to it.
- Historical 44/703 and manifest 44/700 snapshots remain clearly historical;
  they were not relabeled as the observed 47/717 run.
- The required focused test exposed stale manifest digest and active-change
  metadata in `program-lock-facts.json`; only the resulting digest, candidate,
  date, and active set were reconciled. No infrastructure or test-discovery code
  was reimplemented.

## Remaining tasks

These tracking-only follow-ups are intentionally unchecked and are not claimed
as implemented:

- [ ] 2.5 REFACTOR: track, but do not execute in this change, formalizing `verificationLevel` as a typed field with generator/lint support in `scripts/verify-capability-manifest.mjs`. <!-- sdd-owner: implementation -->
- [ ] 2.6 REFACTOR: track, but do not execute in this change, backfilling `verificationLevel` notes on the other nine manifest rows; keep this follow-up separate to protect PR2's review budget. <!-- sdd-owner: implementation -->

Also deferred: executable Engram integration/operational E2E and any full-tree
receipt/tooling expansion. There are no parent-owned task rows.

## Files changed by this apply

- `README.md`
- `ROADMAP.md`
- `capability-manifest.yaml`
- `docs/architecture/capability-conformance-matrix.md`
- `docs/architecture/harness-draft-conformance.md`
- `docs/architecture/program-lock-facts.json`
- `docs/architecture/ecosystem-boundaries.md`
- `openspec/changes/pi-program-status-reconciliation/proposal.md` (moved)
- `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/proposal.md`
- `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/archive-report.md`
- `openspec/changes/pi-capability-conformance/tasks.md`
- `openspec/changes/pi-capability-conformance/apply-progress.md`

All pre-existing team dirty paths outside these apply edits were preserved.

## Verification evidence

| Command | Result |
| --- | --- |
| `bun run test -- chains/__tests__/monthly-close-flow.test.ts` | PASS — 1 file, 2 tests |
| `bun run verify:capability` (PR2 safety/GREEN/final) | PASS — `verify-capability-manifest: OK` on each run |
| `bun run test -- __tests__/capability-manifest.test.ts` (PR2 safety/GREEN) | PASS — 1 file, 13 tests on each run |
| `bun run test -- __tests__/capability-manifest.test.ts __tests__/lock-facts.test.ts __tests__/content.test.ts` (first final RED) | FAIL — 58 passed, 2 failed; current manifest digest and discovered active-change set were stale in lock facts |
| Same focused command after lock-fact reconciliation | PASS — 3 files, 60 tests |
| `bun run typecheck` | PASS — `tsc --noEmit`, no diagnostics |
| `bun run verify:style` | PASS — diff-scoped, 102 owned files, 4 rules |
| `bun run test` | PASS — 47 files, 717 tests |
| Manual conformance checker | PASS after correcting the checker's case-sensitive search (`Frozen` vs `frozen`); 10 rows, one level each, counts/pin/contracts/archive/digest consistent |
| `git diff --check` | PASS |
| `node scripts/compute-candidate-identity.mjs` | `dirty-sha256:38ee713f27740b1dbdb43288a1a165d2d1e0bfb1ecbf805f1bb2fd0470464097` |

The stale config command `bun test` was not executed.

## TDD Cycle Evidence

| Tasks | Layer | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- |
| 1.1–1.5 | Docs + in-process fixture | Docs-only behavioral RED N/A: existing prose/checkbox contradictions were the failing state; monthly-close safety net passed 2/2 before edits | README/ROADMAP corrected | Manual contract/roadmap/fixture-vs-E2E check passed | Wording deduplicated; diff check passed |
| 2.1–2.4 | Structural manifest + contract test | Structural RED: five evidence pairs absent; validator and 13-test safety net passed before edits | Manifest validator and 13/13 tests passed after minimal evidence additions | Closed key/state set preserved; no Engram or operational-E2E claim introduced | No validator/schema refactor; deferred items remain unchecked |
| 3.1–3.11 | Docs/metadata + contract tests | Docs-only test file N/A by design; mandated focused run supplied RED for derived lock metadata (2 failures) | Minimal lock digest/active/candidate metadata reconciliation made 60/60 focused tests pass | Manual 10-row/status/pin/contracts/archive check and full 717-test suite passed | Ambiguous historical/current wording removed; diff check passed |

No production runtime code, pure function, fiscal logic, pin, frozen contract, or
external integration was changed. No new test file was appropriate for the
documentation matrix.

## Candidate and provenance

- Git HEAD used by the identity script:
  `585f5ca910fab257e3a2d27923aadf5a3781ed74`.
- Current approved-allowlist candidate identity:
  `dirty-sha256:38ee713f27740b1dbdb43288a1a165d2d1e0bfb1ecbf805f1bb2fd0470464097`.
- Independently verified incoming baseline preserved in the matrix:
  `dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c`.
- Capability-manifest SHA-256:
  `e9688ad627852f037e427d7fc7c839b724d00067add5d46ea6a1a8ff3c4e142a`.
- Contract content-manifest SHA-256 (unchanged team baseline):
  `bd6471a7d896aa28813a1e4a6a7892965ca4427cae6fff9f126e0ff1afd7de4b`.
- Provenance: `node scripts/compute-candidate-identity.mjs` hashes its immutable
  participation allowlist with HEAD and self-reference normalization. It is not
  a full-tree receipt and no receipt is claimed.

## Process and cleanup facts

All verification ran synchronously in the foreground. No network, live fiscal,
external-service, branch, commit, PR, or publication process was launched.
Vitest's monthly-close fixture used test-owned temporary directories with
registered cleanup. Final process checks found no standalone `vitest` or `tsc`
process; nothing required termination.

## Deviations and key learnings

- The tasks expected remaining program-lock reconciliation to stay separate, but
  the required focused test proved the manifest edit and proposal archive had
  directly invalidated the digest and active-change set. The smallest metadata
  reconciliation restored the existing lock-fact contract without touching the
  separate infrastructure/test-discovery implementation.
- Candidate identity is an approved allowlist digest, not a full-tree receipt;
  both the matrix and this progress record state that limitation.
- In-process monthly-close coverage supports `unit-or-contract-tested`, never an
  operational-E2E claim. Engram remains explicitly incomplete.
