# Tasks: Capability Conformance Matrix and Stale Audit Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~20–35; PR2 ~25–40; PR3 ~180–260; total ~225–335 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

The three units are explicitly approved for stacked-to-main delivery. No size exception is authorized. Each unit has an independent rollback boundary and the exact future edit roots are listed below. Current evidence is the independently verified baseline of 47 test files / 717 passing tests with program-lock-facts identity `dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c`; identity calculations use the approved allowlist, not a full-tree scan.

## Work Units

| Unit | Exact edit roots | Goal | Verification | Rollback boundary |
|------|------------------|------|--------------|-------------------|
| PR1 | `README.md`; `ROADMAP.md` | Correct public capability and release-status statements | Focused manual cross-document checklist; monthly-close fixture command in 1.3 | Revert only PR1 hunks |
| PR2 | `capability-manifest.yaml` | Add RDA-chain evidence without changing the manifest schema or capability key set | `bun run verify:capability`; `bun run test -- __tests__/capability-manifest.test.ts` | Revert only the manifest hunk |
| PR3 | `docs/architecture/capability-conformance-matrix.md`; `openspec/changes/pi-program-status-reconciliation/`; `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/`; `docs/architecture/harness-draft-conformance.md`; `docs/architecture/ecosystem-boundaries.md` | Publish the matrix, archive the superseded proposal, and refresh dated audit prose | Final capability verification plus cross-document checklist | Revert matrix/archive/doc hunks; restore the proposal folder if archive review fails |

The infrastructure unit that fixed test discovery and `activeChanges` is separate from this SDD. PR3 must not reimplement or duplicate that unit.

## Phase 1: PR1 — README/ROADMAP correction

- [x] 1.1 Edit `README.md` line 56: reconcile the SDD-020 sentence with `capability-manifest.yaml`'s read-only `configurator-install-doctor-sync` entry. Describe `install`/`doctor`/`sync` as pre-Wave-1 scaffolding consuming the public configurator contract, not as a Wave-1 SDD-020 implementation, without claiming new fiscal authority. <!-- sdd-owner: implementation -->
- [x] 1.2 Edit `README.md` `## Install` (around lines 60–64): state that npm publication is pending because the `ROADMAP.md` npm-release item remains unchecked; do not make `pi install npm:drenyra-shell` appear currently available. <!-- sdd-owner: implementation -->
- [x] 1.3 RED → GREEN: validate the real in-process monthly-close fixture at `chains/__tests__/monthly-close-flow.test.ts` with `bun run test -- chains/__tests__/monthly-close-flow.test.ts`; then update `ROADMAP.md` to mark only the demonstrably shipped slices (Slices 1–4) as complete. This fixture proves in-process chain behavior, not operational E2E. <!-- sdd-owner: implementation -->
- [x] 1.4 Keep ROADMAP Slice 5 (Engram integration: context/memory reads) unchecked. Do not infer memory reads from `runtime/context.ts`, static prose, or context JSON: `capability-manifest.yaml` explicitly records no executable integration. Record the operational-E2E limitation rather than overclaiming completion; leave an implementation follow-up for a separate change. <!-- sdd-owner: implementation -->
- [x] 1.5 TRIANGULATE → REFACTOR: manually confirm the README Dominion Program table and edited sentence agree with frozen `contracts/README.md`, ROADMAP's checked/unchecked state, and the distinction between fixture validation and operational E2E (REQ-CONF-004). <!-- sdd-owner: implementation -->

## Phase 2: PR2 — capability-manifest.yaml RDA-chain evidence

- [x] 2.1 RED: identify the existing `rda-chains.evidence.sources` and `tests` entries in `capability-manifest.yaml`; preserve `state: implemented` and the closed `MASTER_CAPABILITIES` list enforced by `scripts/verify-capability-manifest.mjs`. <!-- sdd-owner: implementation -->
- [x] 2.2 GREEN: append `chains/reconcile.ts`, `chains/verify.ts`, `chains/evidence.ts`, `lib/accounting-semantics.ts`, and `lib/evidence-projection.ts` to `rda-chains.evidence.sources`, and append their corresponding tests (`chains/__tests__/reconcile.test.ts`, `chains/__tests__/verify.test.ts`, `chains/__tests__/evidence.test.ts`, `__tests__/accounting-semantics.test.ts`, `__tests__/evidence-projection.test.ts`) to `evidence.tests`. <!-- sdd-owner: implementation -->
- [x] 2.3 Add the controlled-vocabulary `verificationLevel` lines to the existing `rda-chains.evidence.note`, one per newly cited source, without changing the `STATES` enum or validator code. Use `unit-or-contract-tested` only where the cited test supports it; do not label these entries `validated-end-to-end` merely because in-process fixtures pass. <!-- sdd-owner: implementation -->
- [x] 2.4 TRIANGULATE: run `bun run verify:capability` and `bun run test -- __tests__/capability-manifest.test.ts`; confirm the real-manifest assertion passes and that no Engram operational-E2E claim was introduced. <!-- sdd-owner: implementation -->
### Deferred follow-ups — outside this change, not implemented

- 2.5: Formalize `verificationLevel` as a typed field with generator/lint support in `scripts/verify-capability-manifest.mjs`. This remains unimplemented follow-up work, not an implementation task or closure claim for this change.
- 2.6: Backfill `verificationLevel` notes on the other nine manifest rows. This remains unimplemented follow-up work, kept separate to protect PR2's review budget.

## Phase 3: PR3 — matrix, archive, and audit-document refresh

- [x] 3.1 RED: confirm the existing `__tests__/capability-manifest.test.ts` real-manifest assertion is the only automated check needed for manifest content; do not add a test file for the documentation matrix. Preserve the design's N/A threat-matrix conclusion for routing, shell, subprocess, VCS-automation, and process-integration boundaries. <!-- sdd-owner: implementation -->
- [x] 3.2 GREEN: create `docs/architecture/capability-conformance-matrix.md` with one row per `capability-manifest.yaml` key (10 rows), concrete file:line and/or exact test-name citations, and exactly one tag from `declared-only`, `implemented`, `unit-or-contract-tested`, or `validated-end-to-end`. Include the required disclaimer that this taxonomy is this project's synthesis of Kubernetes-style evidence gating and Backstage-style manifest embedding, not a 1:1 copy. Distinguish in-process fixture evidence from operational E2E and leave Engram uncompleted. <!-- sdd-owner: implementation -->
- [x] 3.3 Record `dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c` and the evidence date in the matrix, using the same approved allowlist method as `docs/architecture/program-lock-facts.json`; do not recompute or claim a full-tree identity. Add an explicit point-in-time, not evergreen, disclaimer and the verified 47-file / 717-passing baseline. <!-- sdd-owner: implementation -->
- [x] 3.4 Tag each matrix row against README's existing Dominion Program SDD table, reusing SDD-020/SDD-030/SDD-040 assignments verbatim and inventing no new program names. <!-- sdd-owner: implementation -->
- [x] 3.5 Archive `openspec/changes/pi-program-status-reconciliation/` to `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/` (REQ-CONF-005). Treat this as archiving a superseded proposal-only historical record, not as evidence of a verified or completed implementation; only its existing `proposal.md` is preserved. <!-- sdd-owner: implementation -->
- [x] 3.6 Create `openspec/changes/archive/2026-09-08-pi-program-status-reconciliation/archive-report.md` explaining the supersession (wrong `drenyra-ai@0.2.0` pin, wrong 16-command count versus 20, and wrong `0.1-draft` versus Frozen contract state) and pointing to the new matrix as current source of truth. Do not imply the archived proposal reached design, tasks, apply, or verify. <!-- sdd-owner: implementation -->
- [x] 3.7 Refresh or explicitly supersede `docs/architecture/harness-draft-conformance.md`: reconcile its dated 44-file / 703-test snapshot with the verified 47-file / 717-passing baseline, or clearly state that the matrix is the current point-in-time source of truth. <!-- sdd-owner: implementation -->
- [x] 3.8 Do not duplicate the separate infrastructure unit's `activeChanges` fix or test-discovery fix. Track any remaining program-lock-facts reconciliation as a separate follow-up, without requiring infrastructure implementation in this SDD. <!-- sdd-owner: implementation -->
- [x] 3.9 Refresh only the stale count prose in `docs/architecture/ecosystem-boundaries.md` and add a pointer to the matrix; distinguish its scoped manifest `testState` from the independently verified 47-file / 717-passing baseline rather than conflating them. <!-- sdd-owner: implementation -->
- [x] 3.10 TRIANGULATE: run the final `bun run verify:capability` and complete a manual checklist confirming command count 20, pin `drenyra-ai@0.4.1`, Frozen v0.1 contracts, monthly-close in-process fixture evidence, and unchecked Engram operational E2E across README, ecosystem-boundaries, program-lock-facts, and the matrix. <!-- sdd-owner: implementation -->
- [x] 3.11 REFACTOR: remove duplicated or ambiguous wording while preserving the matrix's point-in-time disclaimer, proposal-versus-implementation archive distinction, requirements mapping, and explicit deferred follow-ups. <!-- sdd-owner: implementation -->

## Requirements Mapping and Deferred Follow-ups

| Requirement | Tasks |
|-------------|-------|
| REQ-CONF-001 | 3.2, 3.4 |
| REQ-CONF-002 | 3.2, 3.3 |
| REQ-CONF-003 | 3.3, 3.7 |
| REQ-CONF-004 | 1.5, 3.10 |
| REQ-CONF-005 | 3.5, 3.6 |
| REQ-CONF-006 | 2.4, 3.10 |

Deferred and explicitly out of scope: executable Engram integration/operational E2E; manifest schema and generator/lint redesign; backfilling all manifest notes; and the separate infrastructure fixes for test discovery and `activeChanges`. These remain tracked without being claimed complete or implemented here. <!-- sdd-owner: implementation -->
