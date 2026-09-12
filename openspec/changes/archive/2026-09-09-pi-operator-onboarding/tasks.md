# Tasks: pi-operator-onboarding safety slice

Implement only the approved `safety_slice_first` local correctness fix: a valid company or fiscal-period selection change invalidates the prior canonical binding, while protected work remains fail-closed until an explicit fresh complete bind. This is not the full onboarding journey or SDD-020 completion.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 155–270 implementation lines: `runtime/context.ts` 35–60 + focused tests 115–175 + README 5–10 + metadata 0–25; anticipated `openspec/changes/pi-operator-onboarding/tasks.md` and `openspec/changes/pi-operator-onboarding/apply-progress.md` bookkeeping is an additional 35–80 lines, for an honest total review surface of 190–350 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR/work unit: `fix(scope): invalidate stale canonical bindings` |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Implementation work unit

### RED — encode the invariant first

- [x] In `__tests__/context.test.ts`, add failing Vitest cases for valid company/period changes removing the incompatible canonical binding, same-value idempotence preserving canonical bytes and `scopeHash`, invalid RUC/period causing no `save` and no state mutation, and changing away then back not resurrecting the binding. Also cover an explicit complete bind synchronizing legacy company/period and direct `save` rejecting a valid-but-contradictory selector/canonical document. Run `bun run test -- __tests__/context.test.ts __tests__/context-scope.test.ts __tests__/extension-scope-guard.test.ts __tests__/extension.test.ts` and record only expected new failures versus baseline. <!-- sdd-owner: implementation -->
- [x] In `__tests__/context-scope.test.ts`, add failing mismatch-projection cases for company and period disagreement, rejection of invalid canonical company before identity comparison, and proof that rejected canonical-only fields are not projected into a hybrid complete scope. Treat fail-closed incompleteness as the invariant; do not require legacy diagnostics if the store load path discards the mismatched document. <!-- sdd-owner: implementation -->
- [x] In `__tests__/extension-scope-guard.test.ts`, add failing guard cases for a persisted legacy/canonical mismatch and a real selector change, plus a matching-scope preservation case. Assert an explanatory rejection and no binding/delegation. <!-- sdd-owner: implementation -->
- [x] In `__tests__/extension.test.ts`, add failing end-to-end handler cases that bind A/P1, change company or period, invoke `/drenyra:mission` (read-only) and a valid evidence-add operation, and verify both stop at the existing guard before creating or changing protected `.local` mission/evidence state. <!-- sdd-owner: implementation -->

### GREEN — minimal local production change

- [x] In `runtime/context.ts`, add one private consistency predicate reused by projection, persistence validation, and setter retention decisions: first validate the canonical scope, then require every present validated legacy company/period to equal canonical values. Reject contradictory `save` input; project only independently validated legacy selectors when canonical data is invalid or inconsistent, without copying any rejected canonical-only fields. <!-- sdd-owner: implementation -->
- [x] In `runtime/context.ts`, validate setter input before load/save; retain canonical only for an already-consistent context and equal proposed value, otherwise omit it and atomically persist the new selector. Ensure `setCanonicalScope` persists canonical scope together with matching legacy company and period. Preserve existing public types, validation, serialization, hashing, and no-default/no-authority behavior. <!-- sdd-owner: implementation -->
- [x] In `README.md`, add the concise operator-facing note that a real company-selector or period-selector change requires a fresh complete canonical scope binding before protected commands. Keep full onboarding claims and deferred provenance/source/first-mission work out of this slice. <!-- sdd-owner: implementation -->

### TRIANGULATE — boundary and regression verification

- [x] Rerun the focused suites with `bun run test -- __tests__/context.test.ts __tests__/context-scope.test.ts __tests__/extension-scope-guard.test.ts __tests__/extension.test.ts`; verify fresh bind success, same-value idempotence, invalid-input no-write, away/back no-resurrection, mismatch fail-closed behavior, and zero protected mutation. <!-- sdd-owner: implementation -->
- [x] Run the full Vitest suite with `bun run test` (not stale `bun test` discovery), then run `bun run typecheck`, `bun run verify:style`, and `bun run verify:capability`; record exact results and investigate failures without weakening assertions or changing non-allowlisted production files. <!-- sdd-owner: implementation -->

### REFACTOR and scope check

- [x] Review the diff against the exact implementation allowlist: `runtime/context.ts`, `__tests__/context.test.ts`, `__tests__/context-scope.test.ts`, `__tests__/extension-scope-guard.test.ts`, `__tests__/extension.test.ts`, `README.md`, and the approved additive `docs/architecture/program-lock-facts.json` metadata surface; remove unrelated edits and confirm no changes to `extensions/scope-guard.ts` (read-only), `extensions/register.ts` (read-only), `lib/` (read-only), contracts, runtime pin, vendored artifacts, archived changes, or independent specs. <!-- sdd-owner: implementation -->
- [x] Confirm the work-unit rollback boundary is limited to those seven files and that rollback would reintroduce the isolation defect, so protected work must remain operationally disabled until explicit rebinding. Runtime harness verification is `N/A` because hermetic extension tests cover local persistence and pre-delegation behavior; no install, network, doctor, package, publication, lifecycle, or fiscal-action command is permitted. <!-- sdd-owner: implementation -->

## Evidence bookkeeping

- [x] In `docs/architecture/program-lock-facts.json`, add the approved additive `activeChanges` entry for `pi-operator-onboarding` and refresh only the observed counts, digests, and normalized candidate-identity inputs that the existing snapshot contract requires. Preserve the existing team snapshot, runtime pin/checksum, schema, and `scripts/compute-candidate-identity.mjs` allowlist limitations; do not bypass or ignore `__tests__/lock-facts.test.ts`. <!-- sdd-owner: implementation -->
- [x] Record the metadata refresh and its exact verification result in `apply-progress.md` if that apply artifact is produced by the phase; count its authored bookkeeping delta in the review surface without compressing code or omitting evidence. <!-- sdd-owner: implementation -->

## Parent planning notes

The parent may coordinate the independent `sdd-verify` phase after apply. SDD completion does not automatically launch ordinary review actors. The full onboarding requirements remain deferred, not waived: clean install, doctor, guided company/period UX, authoritative source selection and manifest provenance, missing canonical-field provenance, and explicit first-mission guidance/start. This slice must not be reported as onboarding or SDD-020 readiness.

If authored changes approach or exceed 400 lines, use the configured `ask-on-risk` gate; do not infer chaining or `size:exception`.
