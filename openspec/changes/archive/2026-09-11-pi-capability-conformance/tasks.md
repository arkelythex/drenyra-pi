# Tasks: Shell Capability Conformance

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 750–1,050 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 evidence-schema guard → PR 1.5 generated lock-fact refresh → PR 2 cross-surface guard and reconciliation (delivered as chained 2a/2b) → PR 2.5 verified lock-fact refresh → PR 3 verified snapshot/lock facts → PR 4 legacy inventory |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Measured PR 2 size | 892 changed lines (native attempt ledger, ordinal 9) |
| Delivery slicing for PR 2 | 2a projection guard core (~400) → 2b authority boundary, deterministic diagnostics, and truthful public projections (~330); enforced at commit boundaries, not by splitting the authored work |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

## Scope and boundaries

**Dependencies:** This is local SDD 1 of 6. It depends only on the approved `proposal.md`, `design.md`, and `specs/program-conformance/spec.md` in this change. SDDs 2–6 are read-only dependencies/follow-ups and must not be opened, edited, or advanced.

**Global allowed edit surface:** `scripts/verify-capability-manifest.mjs`, `__tests__/capability-manifest.test.ts`, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `README.md`, `ROADMAP.md`, `openspec/config.yaml`, `docs/architecture/program-lock-facts.json`, `scripts/refresh-program-lock-facts.mjs` only if needed to preserve generated lock-fact semantics, a new narrowly scoped legacy-inventory document under `docs/architecture/`, and this change's own OpenSpec artifacts. `contracts/`, `vendored/`, runtime pin/checksums, fiscal/authority code, and all SDD 2–6 artifacts are prohibited edit surfaces.

**Legacy-retention boundary:** Inventory only. A legacy helper, compatibility path, historical document, or archived artifact remains in place unless a separate bounded change supplies its replacement or explicit compatibility decision, focused regression proof, and package verification. This SDD must not delete legacy files merely because current wiring is absent.

**Evidence rule:** Capture `git status --short` before apply and preserve pre-existing modifications outside the owned-file allowlist. A snapshot is current only when its exact command, complete result, date, candidate identity, and `baseline` or `dirty-candidate` classification are recorded; all other retained counts/identities must be explicitly historical/generated and sourced.

## PR 1 — Manifest evidence schema and offline guard

**Start / finish:** Start from the classified worktree with the existing manifest validator. Finish with an offline, deterministic guard that validates the additive manifest evidence schema without changing capability states, contracts, or runtime behavior.

**Allowed edits:** `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, and `capability-manifest.yaml` only.

- [x] Record `git status --short`, establish the owned-file allowlist, and stop/report if pre-existing modifications overlap the PR 1 surface or make candidate identity attribution ambiguous. <!-- sdd-owner: implementation -->
- [x] **RED:** Extend `__tests__/capability-manifest.test.ts` deterministic temporary-root fixtures with failing cases for missing/unknown verification levels, invalid ownership/authority values, incomplete or malformed current snapshot fields, and `validated-end-to-end` without recorded installed-package/runtime evidence; assert stable diagnostic fragments and offline execution. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add the smallest additive evidence metadata to `capability-manifest.yaml` and extend `scripts/verify-capability-manifest.mjs` to parse it, enforce the four verification levels separately from state/ownership/authority, require complete point-in-time snapshot metadata, and reject unsupported end-to-end evidence without reading network, secrets, or fiscal authority. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Add fixture cases covering valid `declared-only`/`implemented`/`unit-or-contract-tested` evidence, a valid recorded runtime qualification, baseline versus dirty-candidate identity, malformed dates/identities, invalid capability keys/states, and deterministic violation ordering; keep the real-repository positive test. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Consolidate manifest vocabulary, snapshot parsing, and diagnostic construction in `scripts/verify-capability-manifest.mjs` without broadening accepted states or changing diagnostic contracts; keep test factories typed without introducing `any`. <!-- sdd-owner: implementation -->
- [x] Verify PR 1 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun run typecheck`, and `bun run verify:style`; record each exact result, with runtime-harness verification explicitly `N/A` because this guard is offline and invokes no Shell runtime boundary. <!-- sdd-owner: implementation -->

**Rollback:** Revert only the three PR 1 files; this removes the additive evidence schema and guard behavior without touching existing capability implementations, contracts, or pre-existing work.

## PR 1.5 — Generated lock-fact refresh and phantom change removal

**Provenance:** Pulled forward from PR 3 tasks 3–4, by explicit user decision. PR 2 task 6 requires a recorded `bun test`, but PR 3's lock-fact refresh otherwise runs after PR 2, leaving the full suite red throughout PR 2 (three `lock-facts.test.ts` failures: stale `capabilityStates.digestSha256` caused by PR 1's manifest edit, plus a pre-existing `activeChanges` mismatch). PR 3 retains its snapshot *guard* work; only the generator run moved earlier.

**Allowed edits:** `docs/architecture/program-lock-facts.json` (generator output only) and the removal of the empty untracked directory `openspec/changes/pi-recovery-release-readiness/`.

- [x] Remove the empty, untracked `openspec/changes/pi-recovery-release-readiness/` directory, which the native engine counted as an active change and which polluted the recorded `activeChanges` set. <!-- sdd-owner: implementation -->
- [x] Refresh `docs/architecture/program-lock-facts.json` only through the established `bun run refresh:lock-facts` path; do not hand-edit checksums or candidate identities. <!-- sdd-owner: implementation -->
- [x] Verify with `node scripts/refresh-program-lock-facts.mjs --check`, `bun test __tests__/lock-facts.test.ts`, `bun test`, `bun run typecheck`, and `bun run verify:capability`; record each exact result. <!-- sdd-owner: implementation -->

**TDD note:** No RED/GREEN cycle applies. This unit regenerates a derived artifact through its existing, already-tested generator and removes an empty directory. No production behavior, schema, vocabulary, or diagnostic changed, so there is nothing to write a failing test against.

**Rollback:** Re-run `bun run refresh:lock-facts` after reverting this unit, and recreate the empty directory if the change is wanted back. No source, contract, or capability-manifest file is touched.

## PR 2 — Cross-surface consistency and truthful public projections

**Dependency:** PR 1 is passing.  
**Start / finish:** Start with manifest-level vocabulary enforcement. Finish with current claims consistently projected across the matrix and narratives, and a guard that rejects contradictory/current operational claims.

**Allowed edits:** `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `README.md`, and `ROADMAP.md` only.

- [x] **RED:** Add deterministic fixture/repository assertions in `__tests__/capability-manifest.test.ts` for conflicting current command/result/identity/classification across manifest and matrix, an unlabeled historical count, ownership escalation of kernel-consumed or referenced-only behavior, and Engram/packaged-skills or fixture-only evidence falsely advertised as operational end-to-end. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Extend `scripts/verify-capability-manifest.mjs` using repository-relative, read-only parsing of the manifest, matrix, README, and ROADMAP; validate explicit source links/markers and reject the PR 2 negative cases while retaining a deterministic offline CLI interface. <!-- sdd-owner: implementation -->
- [x] Reconcile `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `README.md`, and `ROADMAP.md` to one current point-in-time vocabulary: every advertised capability has state, verification level, ownership, authority boundary, source/test evidence, and an honest local/operational limitation; label all preserved baseline or historical statements rather than treating them as the dirty candidate. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Cover matrix-only historical labels, generated-value source labels, case/order-independent deterministic diagnostics, kernel-consumed versus referenced-only ownership, and a valid all-local non-E2E repository projection; confirm no local text grants Shell fiscal authority or represents the master/Dominion program as Shell delivery. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Centralize cross-surface marker names and ownership/verification comparisons in the verifier, remove only duplicated conformance prose, and retain human-readable matrix evidence citations and explicit limitations. <!-- sdd-owner: implementation -->
- [x] Verify PR 2 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun test`, `bun run typecheck`, and `bun run verify:style`; record exact outputs, with runtime-harness verification `N/A` because the changed behavior is a read-only offline conformance guard. Executed by the **parent** in PR 2.5, not by the PR 2 apply attempt: PR 2's authored edits invalidate `program-lock-facts.json`, whose refresh path was outside PR 2's allowlist, so this row could not be satisfied from inside the slice. See PR 2.5 below. <!-- sdd-owner: implementation -->

**Rollback:** Revert only PR 2's six allowed files, restoring the prior narrative projections while preserving PR 1's manifest-only guard; do not revert any runtime or contract file.

## PR 2.5 — Parent-owned lock-fact refresh after the PR 2 invalidation

**Provenance:** Parent-executed immediately after PR 2, by explicit user authorization. Not a child unit: the refresh path is outside PR 2's allowlist.

**Why this unit exists (systemic defect, not a one-off):** `collectLockFactsViolations` compares `program-lock-facts.json` against the live tree on two axes — a raw digest of `capability-manifest.yaml` bytes, and a candidate identity derived from `PARTICIPATION_PATHS_V1`, which includes `scripts/verify-capability-manifest.mjs`, `__tests__/capability-manifest.test.ts`, `capability-manifest.yaml`, and `ROADMAP.md`. Every one of those is a PR 2 (and PR 3, and PR 4) edit surface. So **any** unit that edits an allowlisted input re-stales the generated facts, and `bun test` cannot be green inside that unit. PR 2 proved this before writing code: appending a single trailing newline to the verifier was enough to move the derived identity. The refresh therefore belongs to each invalidating unit, not to PR 3.

**Allowed edits:** `docs/architecture/program-lock-facts.json` through the established generator only.

- [x] Refresh `docs/architecture/program-lock-facts.json` through the established `bun run refresh:lock-facts` path only; do not hand-edit checksums or candidate identities. <!-- sdd-owner: implementation -->
- [x] Verify with `node scripts/refresh-program-lock-facts.mjs --check`, `bun test`, `bun run typecheck`, `bun run verify:capability`, and `bun run verify:style`; record each exact result. <!-- sdd-owner: implementation -->
- [x] Complete PR 2's verification row from the parent, because the PR 2 slice could not satisfy it by construction. <!-- sdd-owner: implementation -->

**TDD note:** No RED/GREEN cycle applies. This unit regenerates a derived artifact through its existing, already-tested generator. No production behavior, schema, vocabulary, or diagnostic changed.

**Sequencing rule adopted:** every future unit touching an allowlisted identity input must run this refresh as its own post-step before claiming a green suite. PR 3 keeps its snapshot *guard* work; it no longer owns the refresh.

**Rollback:** Re-run `bun run refresh:lock-facts` after reverting `docs/architecture/program-lock-facts.json`. No source, test, contract, or manifest file belongs to this unit's rollback.

## PR 3 — Verified current snapshot and generated lock-fact alignment

**Dependency:** PR 2 is passing and the worktree's owned-file attribution is still unambiguous.  
**Start / finish:** Start after all final content and tests are stable. Finish with one exact, reproducible current snapshot and any retained lock/config values explicitly historical or generated.

**Allowed edits:** `openspec/config.yaml`, `docs/architecture/program-lock-facts.json`, `scripts/refresh-program-lock-facts.mjs` only if its preservation/validation rules require a minimal change, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, and `__tests__/capability-manifest.test.ts` only for snapshot-guard coverage.

- [x] **RED:** Add focused conformance cases that fail when `openspec/config.yaml` or `docs/architecture/program-lock-facts.json` presents stale/current snapshot facts without the required command, complete result, date, identity, classification, and historical/generated source distinction. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Make the smallest verifier and evidence-record changes needed to compare OpenSpec context and lock facts with the approved current snapshot semantics; retain lock facts as generated/locked evidence rather than a new ownership authority, and do not hand-edit checksums or candidate identities. <!-- sdd-owner: implementation -->
- [x] Run the complete final evidence sequence from the canonical repository root: `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`; record exact command output, date, complete test result, and candidate identity before updating any current snapshot field. <!-- sdd-owner: implementation -->
- [x] Refresh `docs/architecture/program-lock-facts.json` only through the established `bun run refresh:lock-facts` path after the stable evidence run; update `openspec/config.yaml`, manifest, and matrix only with facts proven by that run, otherwise retain and label their values historical/generated with source references. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Prove the guard rejects a mismatched dirty identity, an old baseline represented as current, a stale test count/result, and a generated lock fact lacking its source label; prove the checked-in candidate passes the same commands a second time without network or ambient secrets. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Keep snapshot field names and derivation-command references consistent across the config, manifest, matrix, lock facts, refresh script (if changed), and tests; do not refresh frozen contract checksums or change runtime pin facts. <!-- sdd-owner: implementation -->
- [x] Record the final PR 3 verification evidence for `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`; record runtime-harness verification as `N/A` with rationale unless a real installed-package invocation was actually run and independently evidenced. <!-- sdd-owner: implementation -->

**Rollback:** Revert only snapshot metadata and any minimal refresh-script/test changes in this PR. Never regenerate lock facts from another worktree, revert pre-existing dirty work, or alter `contracts/SHA256SUMS.json`.

## PR 3.5 — Parent-owned recovery of an out-of-band reformat invalidation

**Provenance:** Parent-executed after PR 3 closed, when a `pi-lens` reformat of two identity-allowlisted files re-staled the generated facts outside any attempt.

**Why this unit exists:** `PARTICIPATION_PATHS_V1` contains `scripts/verify-capability-manifest.mjs` and `__tests__/capability-manifest.test.ts`. A reformat of either one moves the derived candidate identity, so `program-lock-facts.json` — generated moments earlier by the PR 3 attempt against the pre-reformat bytes — became stale. The parent's independent re-verification measured `bun test` 766 pass / 1 fail and `--check` reporting stale, against the attempt's `767/0` and `current`. The attempt's evidence was true for the bytes that existed when it ran; the formatter changed them afterwards.

**Allowed edits:** `docs/architecture/program-lock-facts.json` through the established generator only, and the identity-normalized `candidate_identity` field in `openspec/config.yaml`.

- [x] Re-run `bun run refresh:lock-facts` against the post-reformat bytes; do not hand-edit checksums or candidate identities. <!-- sdd-owner: implementation -->
- [x] Write the freshly derived identity into `openspec/config.yaml#current_test_state.candidate_identity`, and prove the write does not move the identity because that field is normalization-exempt. <!-- sdd-owner: implementation -->
- [x] Re-verify with `node scripts/refresh-program-lock-facts.mjs --check`, `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`; record each exact result. <!-- sdd-owner: implementation -->

**TDD note:** No RED/GREEN cycle applies. This unit regenerates a derived artifact through its existing, already-tested generator and rewrites one identity-normalized metadata field. No production behavior, guard rule, schema, or diagnostic changed.

**Rule generalized (supersedes the PR 2.5 wording):** the sequencing rule is not limited to units that edit an allowlisted input. **Any** mutation of an allowlisted path — including one made by a formatter, autofix, or another session outside any attempt — invalidates the generated facts, so the recovery pair (`refresh` → rewrite the normalized identity → `--check` → full verification) must follow every such mutation, not only every apply unit.

**Rollback:** Re-run `bun run refresh:lock-facts` and restore the prior `candidate_identity`. No source, test, guard, schema, or contract behavior belongs to this unit's rollback.

## PR 4 — Legacy-surface inventory and retention decision record

**Dependency:** PRs 1–3 are passing.  
**Start / finish:** Start with the reconciled evidence model. Finish with discoverable legacy surfaces and consumers recorded, all retained, and a precise future-removal bar.

**Allowed edits:** one new `docs/architecture/legacy-capability-surface-inventory.md` (or an existing dedicated legacy inventory document if discovered), `docs/architecture/capability-conformance-matrix.md` only for a link, and `__tests__/capability-manifest.test.ts` / `scripts/verify-capability-manifest.mjs` only if needed to require the inventory reference.

- [x] Discover legacy candidates only within the concrete conformance surfaces (`capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `docs/architecture/harness-draft-conformance.md`, `README.md`, `ROADMAP.md`, `scripts/verify-capability-manifest.mjs`, and `scripts/refresh-program-lock-facts.mjs`); record known consumers, current disposition, and evidence source without editing or deleting the candidate surfaces. <!-- sdd-owner: implementation -->
- [x] **RED:** If the conformance guard will enforce inventory presence, add a focused failing test for a missing inventory/reference or a disposition that permits removal without replacement/compatibility decision, package verification, and focused regression evidence. **Decision: the guard does not enforce inventory presence, so no test was added.** `capability-manifest.yaml` — the only carrier of the `currentProjection.surfaces` declaration — is outside PR 4's edit allowlist, so the inventory cannot be declared as a verified projection surface; requiring the reference there would also re-stale `docs/architecture/program-lock-facts.json` and force the refresh pair past this unit's 400-line bound. REQ-CONF-008 requires a recorded disposition, not guard enforcement, and a test that asserts nothing is prohibited. No behavior changed and no guard/test file was touched. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Create the bounded legacy inventory and link it from the matrix; explicitly mark each unproven surface retained and state that deletion belongs to a later SDD/change with the required replacement, compatibility, package, and regression proof. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Validate inventory coverage for a historical snapshot/document and a legacy helper/compatibility-path candidate (when discoverable), including unknown-consumer wording that does not falsely prove safety. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Remove duplicated retention language only within the inventory/link surface; verify no legacy source, archived OpenSpec artifact, compatibility path, or frozen contract was deleted. <!-- sdd-owner: implementation -->
- [x] Verify PR 4 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun run typecheck`, `bun run verify:style`, and `bun run verify:package`; record exact results and runtime-harness verification as `N/A` because this work is documentation/conformance-only. <!-- sdd-owner: implementation -->

**Rollback:** Delete/revert only the new inventory, its matrix link, and any narrowly related guard/test changes. Retained legacy files and all contracts remain untouched.

## Parent lifecycle actions

- [x] Start or reuse bounded review for PR 1 after its focused verification evidence and allowlist are available; assess only manifest schema, deterministic guard behavior, and authority boundaries. Resolved as not applicable: the clone-local review switch is disabled (`gentle-ai review mode status` reports global on / clone-local off, and off wins), so no bounded review is required for this candidate. Recorded in `apply-progress.md`. <!-- sdd-owner: parent -->
- [x] Start or reuse bounded review for PR 2 after its focused verification evidence is available; assess only cross-surface truthfulness, ownership labels, and non-E2E claims. Resolved as not applicable: the clone-local review switch is disabled, so no bounded review is required; the PR 2 evidence was instead validated by the parent gatekeeper and recorded in `apply-progress.md`. <!-- sdd-owner: parent -->
- [x] Start or reuse bounded review for PR 3 after final verification evidence is available; assess only snapshot reproducibility, generated lock-fact handling, and accidental stale/dirty attribution. Resolved as not applicable: the clone-local review switch is disabled, so no bounded review is required; the out-of-band reformat drift was instead detected and recovered by the parent in PR 3.5 and recorded in `apply-progress.md`. <!-- sdd-owner: parent -->
- [x] Start or reuse bounded review for PR 4 after its focused verification evidence is available; assess only legacy retention evidence and confirmation that no legacy or frozen surface was deleted. Resolved as not applicable: the clone-local review switch is disabled, so no bounded review is required; retention was instead verified by the parent against `git status` and recorded in `apply-progress.md`. <!-- sdd-owner: parent -->
