# Apply Progress: Shell Capability Conformance

## PR 1 — Manifest evidence schema and deterministic offline guard

**Status:** complete — PR 1 only. No PR 2–4 work was started.

### Structured status consumed

- Native status: `gentle-ai.sdd-status` v2; `changeName: pi-capability-conformance`; `artifactStore: openspec`; `applyState: ready`; `nextRecommended: apply`.
- `actionContext`: `repo-local`; authoritative workspace and allowed edit root both `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`.
- Warning: none. The supplied native attempt token was treated as opaque and was not persisted.

### Allowlist and pre-existing work

- Captured `git status --short` before edits. The worktree already had modified/untracked files outside PR 1; none overlapped `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, or `capability-manifest.yaml`.
- PR 1 owned implementation files: `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, and `capability-manifest.yaml`.
- The only additional artifact mutation is this change's required task-checkbox/progress persistence. Pre-existing dirty work was neither edited nor deleted.

### Completed implementation tasks and checkbox evidence

The six implementation-owned PR 1 rows are visibly marked `- [x]` in `openspec/changes/pi-capability-conformance/tasks.md`:

1. worktree status/allowlist recorded;
2. RED negative cases added;
3. GREEN additive schema and offline guard implemented;
4. triangulation coverage added;
5. vocabulary/parsing/diagnostic and test-factory refactor completed;
6. focused verification completed.

### Files changed

- `__tests__/capability-manifest.test.ts`
  - Added deterministic temporary-root coverage for required/unknown verification levels; ownership and authority vocabularies; snapshot completeness, calendar dates, and identity classifications; unsupported/qualified end-to-end evidence; all four levels; and sorted deterministic diagnostics.
  - Replaced test-factory `any` types with explicit manifest/evidence interfaces.
- `scripts/verify-capability-manifest.mjs`
  - Added closed verification, ownership, authority, and snapshot-classification vocabularies.
  - Requires point-in-time snapshot command, result, date, classification, and classification-specific candidate identity.
  - Restricts end-to-end claims to recorded installed-package/runtime qualifications and sorts capability diagnostics deterministically.
- `capability-manifest.yaml`
  - Added per-capability verification/ownership/authority metadata and point-in-time snapshot metadata without changing capability states.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 1 manifest guard | `__tests__/capability-manifest.test.ts` | Unit / spawned offline CLI | 13 pass / 0 fail | 4 new negative cases: expected 13 pass / 4 fail | 17 pass / 0 fail | Added valid levels/runtime, baseline-vs-dirty, and ordering cases; expected 19 pass / 1 fail, then 20 pass / 0 fail | Centralized vocabulary/snapshot helpers; typed fixtures; 20 pass / 0 fail and typecheck passed |

### Verification evidence

| Command | Result |
| --- | --- |
| `bun test __tests__/capability-manifest.test.ts` (safety net) | 13 pass, 0 fail |
| `bun test __tests__/capability-manifest.test.ts` (RED) | Expected failure: 13 pass, 4 fail; the existing validator accepted all new invalid metadata |
| `bun test __tests__/capability-manifest.test.ts` (GREEN) | 17 pass, 0 fail |
| `bun test __tests__/capability-manifest.test.ts` (triangulation RED) | Expected failure: 19 pass, 1 fail; diagnostics were insertion-ordered rather than sorted |
| `bun test __tests__/capability-manifest.test.ts` (triangulation GREEN) | 20 pass, 0 fail |
| `bun test __tests__/capability-manifest.test.ts && bun run typecheck` | 20 pass, 0 fail; `tsc --noEmit` passed after fixture type hardening |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| Runtime-harness verification | N/A — the guard is read-only/offline and invokes no Shell runtime boundary |

No network, ambient secrets, fiscal operations, authority, receipts, or runtime boundary were invoked.

### Deviations

- None from PR 1 design. The implementation keeps the schema additive and does not evaluate cross-surface consistency; that is explicitly PR 2 work.

### Workload / PR boundary and rollback

- Delivery path: assigned `auto-chain` PR 1 slice only; PR boundary is manifest schema plus deterministic offline guard and its focused tests.
- Rollback boundary: revert only `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, and `capability-manifest.yaml`; retain this progress/task evidence as SDD history. No pre-existing dirty work, contract, runtime, or other SDD artifact belongs to the rollback.

### Remaining unchecked tasks

- [ ] **RED:** Add deterministic fixture/repository assertions in `__tests__/capability-manifest.test.ts` for conflicting current command/result/identity/classification across manifest and matrix, an unlabeled historical count, ownership escalation of kernel-consumed or referenced-only behavior, and Engram/packaged-skills or fixture-only evidence falsely advertised as operational end-to-end. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Extend `scripts/verify-capability-manifest.mjs` using repository-relative, read-only parsing of the manifest, matrix, README, and ROADMAP; validate explicit source links/markers and reject the PR 2 negative cases while retaining a deterministic offline CLI interface. <!-- sdd-owner: implementation -->
- [ ] Reconcile `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `README.md`, and `ROADMAP.md` to one current point-in-time vocabulary: every advertised capability has state, verification level, ownership, authority boundary, source/test evidence, and an honest local/operational limitation; label all preserved baseline or historical statements rather than treating them as the dirty candidate. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Cover matrix-only historical labels, generated-value source labels, case/order-independent deterministic diagnostics, kernel-consumed versus referenced-only ownership, and a valid all-local non-E2E repository projection; confirm no local text grants Shell fiscal authority or represents the master/Dominion program as Shell delivery. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Centralize cross-surface marker names and ownership/verification comparisons in the verifier, remove only duplicated conformance prose, and retain human-readable matrix evidence citations and explicit limitations. <!-- sdd-owner: implementation -->
- [ ] Verify PR 2 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun test`, `bun run typecheck`, and `bun run verify:style`; record exact outputs, with runtime-harness verification `N/A` because the changed behavior is a read-only offline conformance guard. <!-- sdd-owner: implementation -->
- [ ] **RED:** Add focused conformance cases that fail when `openspec/config.yaml` or `docs/architecture/program-lock-facts.json` presents stale/current snapshot facts without the required command, complete result, date, identity, classification, and historical/generated source distinction. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Make the smallest verifier and evidence-record changes needed to compare OpenSpec context and lock facts with the approved current snapshot semantics; retain lock facts as generated/locked evidence rather than a new ownership authority, and do not hand-edit checksums or candidate identities. <!-- sdd-owner: implementation -->
- [ ] Run the complete final evidence sequence from the canonical repository root: `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`; record exact command output, date, complete test result, and candidate identity before updating any current snapshot field. <!-- sdd-owner: implementation -->
- [ ] Refresh `docs/architecture/program-lock-facts.json` only through the established `bun run refresh:lock-facts` path after the stable evidence run; update `openspec/config.yaml`, manifest, and matrix only with facts proven by that run, otherwise retain and label their values historical/generated with source references. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Prove the guard rejects a mismatched dirty identity, an old baseline represented as current, a stale test count/result, and a generated lock fact lacking its source label; prove the checked-in candidate passes the same commands a second time without network or ambient secrets. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Keep snapshot field names and derivation-command references consistent across the config, manifest, matrix, lock facts, refresh script (if changed), and tests; do not refresh frozen contract checksums or change runtime pin facts. <!-- sdd-owner: implementation -->
- [ ] Record the final PR 3 verification evidence for `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`; record runtime-harness verification as `N/A` with rationale unless a real installed-package invocation was actually run and independently evidenced. <!-- sdd-owner: implementation -->
- [ ] Discover legacy candidates only within the concrete conformance surfaces (`capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `docs/architecture/harness-draft-conformance.md`, `README.md`, `ROADMAP.md`, `scripts/verify-capability-manifest.mjs`, and `scripts/refresh-program-lock-facts.mjs`); record known consumers, current disposition, and evidence source without editing or deleting the candidate surfaces. <!-- sdd-owner: implementation -->
- [ ] **RED:** If the conformance guard will enforce inventory presence, add a focused failing test for a missing inventory/reference or a disposition that permits removal without replacement/compatibility decision, package verification, and focused regression evidence. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Create the bounded legacy inventory and link it from the matrix; explicitly mark each unproven surface retained and state that deletion belongs to a later SDD/change with the required replacement, compatibility, package, and regression proof. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Validate inventory coverage for a historical snapshot/document and a legacy helper/compatibility-path candidate (when discoverable), including unknown-consumer wording that does not falsely prove safety. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Remove duplicated retention language only within the inventory/link surface; verify no legacy source, archived OpenSpec artifact, compatibility path, or frozen contract was deleted. <!-- sdd-owner: implementation -->
- [ ] Verify PR 4 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun run typecheck`, `bun run verify:style`, and `bun run verify:package`; record exact results and runtime-harness verification as `N/A` because this work is documentation/conformance-only. <!-- sdd-owner: implementation -->
- [ ] Start or reuse bounded review for PR 1 after its focused verification evidence and allowlist are available; assess only manifest schema, deterministic guard behavior, and authority boundaries. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for PR 2 after its focused verification evidence is available; assess only cross-surface truthfulness, ownership labels, and non-E2E claims. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for PR 3 after final verification evidence is available; assess only snapshot reproducibility, generated lock-fact handling, and accidental stale/dirty attribution. <!-- sdd-owner: parent -->
- [ ] Start or reuse bounded review for PR 4 after its focused verification evidence is available; assess only legacy retention evidence and confirmation that no legacy or frozen surface was deleted. <!-- sdd-owner: parent -->

### Deferred parent lifecycle actions

The four parent-owned bounded-review rows remain byte-for-byte unchecked and deferred. No review, receipt, approval, delivery gate, or commit was started by apply.

## PR 2 — Earlier apply attempt blocked before implementation (superseded)

**Status:** blocked — no PR 2 production or test files were edited by that attempt. Superseded by the PR 2 section below, which ran to implementation once the parent corrected the edit allowlist.

### Structured status consumed

- Native status: `gentle-ai.sdd-status` v2; `changeName: pi-capability-conformance`; `artifactStore: openspec`; `applyState: ready`; `nextRecommended: apply`.
- `actionContext`: `repo-local`; authoritative workspace and allowed edit root both `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`.
- Assigned delivery boundary: PR 2 only (cross-surface consistency and truthful public projections); PR 1 is recorded complete. No PR 3–4 or parent-owned lifecycle work was started.
- Native attempt continuity was read from provider authority only. **Correction by the parent orchestrator (this session):** an earlier revision of this entry pasted the opaque native attempt token into this artifact, which violates the rule that attempt tokens are never persisted in OpenSpec artifacts or any Shell-owned state. That token text has been removed here. Its authority remains in the native attempt ledger under the Git common directory, which is the sole attempt and changed-line authority; no attempt state is reconstructed from this file.

### Blocker

The exact PR 2 edit allowlist supplied for this attempt excludes `openspec/changes/pi-capability-conformance/tasks.md`. Apply is required to mark each completed implementation-owned task in that authoritative artifact immediately and to re-read it before reporting completion. Therefore the task-checkbox contract cannot be met under the supplied edit restriction. No tests were written or run, preserving strict TDD ordering; no implementation-owned checkbox was changed.

**Decision needed:** authorize edits to `openspec/changes/pi-capability-conformance/tasks.md` for the six PR 2 implementation-owned checkbox updates, or explicitly provide an approved alternate persistence mechanism.

### Files changed

- `openspec/changes/pi-capability-conformance/apply-progress.md` — appended this blocked attempt only.

### Remaining work / rollback

- All six PR 2 implementation-owned task lines remain unchecked in the authoritative tasks artifact; parent-owned lifecycle rows remain deferred and byte-for-byte unchanged.
- Workload / PR boundary: PR 2 only; no delivery exception was used.

## PR 1.5 — Generated lock-fact refresh and phantom change removal

**Status:** complete. Pulled forward from PR 3 tasks 3–4 by explicit user decision.

### Why this unit exists

PR 2 task 6 requires a recorded `bun test`. Before this unit, `bun test` failed with 3 failures in `__tests__/lock-facts.test.ts` against `docs/architecture/program-lock-facts.json`:

- `capabilityStates.digestSha256 must match the current manifest bytes` — caused by PR 1's edit to `capability-manifest.yaml`.
- `activeChanges must exactly match the discovered active OpenSpec changes` — pre-existing drift; the recorded set did not match the discovered active changes.
- Candidate identity mismatch: recorded `dirty-sha256:f8a49fde63b0d1d2ec15211b2d003c4f0b42b1c1bba5228c5bc238419fd86c29` versus derived `dirty-sha256:9d6a9b86d006f89645cc7f498f8d4e3e3ddd29e02337bfb72229ef42a42eb610`.

PR 3's refresh tasks would have corrected this, but PR 3 runs after PR 2, so PR 2's full-suite verification could not have been green. The user approved pulling the generator run forward.

### Actions taken

1. Removed the empty, untracked directory `openspec/changes/pi-recovery-release-readiness/` (0 files). The native status engine counted it as an active change, which polluted both `activeChanges` and change selection. Approved explicitly by the user because it removes a directory.
2. Refreshed `docs/architecture/program-lock-facts.json` through the established `bun run refresh:lock-facts` path only. No checksum or candidate identity was hand-edited.

### Verification evidence

| Command | Result |
| --- | --- |
| `node scripts/refresh-program-lock-facts.mjs --check` (before) | `FAILED: program lock facts are stale` |
| `node scripts/refresh-program-lock-facts.mjs --check` (after) | `program lock facts are current` |
| `bun test __tests__/lock-facts.test.ts` | 12 pass, 0 fail |
| `bun test` | **752 pass, 0 fail** (50 files); before this unit: 749 pass, 3 fail |
| `bun run typecheck` | `tsc --noEmit` passed |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| Runtime-harness verification | N/A — generator run and directory removal only; no Shell runtime boundary invoked |

### TDD note

No RED/GREEN cycle applies. This unit regenerates a derived artifact through its existing, already-tested generator (`__tests__/refresh-program-lock-facts.test.ts` covers idempotency, fail-closed behavior, and path escapes) and removes an empty directory. No production behavior, schema, vocabulary, diagnostic, or contract changed, so there is no behavior to write a failing test against.

### Discrepancy recorded for the reviewer

The native attempt ledger records PR 1's attempt (ordinal 5, work unit `PR 1 manifest evidence schema and offline guard`) as **`failed` / `harness_disposition: invalidated`** because the authored diff was 466 lines (445 additions, 21 deletions), exceeding the 400-line review budget. The PR 1 section above presents PR 1 as complete, which is true functionally but not true for delivery sizing. Under the confirmed `auto-chain` delivery strategy this is resolved automatically at delivery time by splitting PR 1 into two slices; no further user decision is required. This note exists so the reviewer does not have to reconcile the two artifacts itself.

### Rollback boundary

Re-run `bun run refresh:lock-facts` after reverting `docs/architecture/program-lock-facts.json`, and recreate the empty `openspec/changes/pi-recovery-release-readiness/` directory if the phantom active change is wanted back. No source, test, contract, manifest, or runtime file belongs to this unit's rollback.

No network, ambient secrets, fiscal operations, authority, receipts, or runtime boundary were invoked.

## PR 2 — Cross-surface consistency and truthful public projections

**Status:** blocked. Implementation is complete and the focused guard is green, but PR 2 cannot be closed green or within budget. Two hard blockers are recorded below. Five of the six implementation-owned PR 2 rows are marked `- [x]`; the verification row remains `- [ ]`.

### Structured status consumed

- Native status: `gentle-ai.sdd-status` v2; `changeName: pi-capability-conformance`; `artifactStore: openspec` (file-backed, authoritative); `applyState: ready`; `nextRecommended: apply`; `blockedReasons: []`.
- `actionContext`: `mode: repo-local`; `workspaceRoot` and the only allowed edit root are both `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; warnings: none.
- `taskProgress` on entry: 32 total, 9 completed, 23 pending. Assigned boundary: PR 2 only. PR 3, PR 4, and the four parent-owned lifecycle rows were not started.
- Native attempt continuity was read from provider authority only; the opaque attempt token is not persisted in this artifact or anywhere else in OpenSpec state. The attempt ledger under the Git common directory is the sole attempt and changed-line authority.

### Allowlist and pre-existing work

- `git status --short` was captured before the first edit. The dirty worktree contained pre-existing `M`/`D`/`??` entries outside PR 2 (`contracts/`, `chains/`, `lib/`, `themes/`, `package.json`, `.pi/`, and a stray `./~/` directory).
- None of those pre-existing modifications overlapped PR 2's surface. The only files this attempt touched are: `__tests__/capability-manifest.test.ts`, `scripts/verify-capability-manifest.mjs`, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `README.md`, `ROADMAP.md`, plus this change's own `tasks.md` and `apply-progress.md`.
- A post-change `git status --short` shows exactly the same pre-existing entries plus `README.md`, `ROADMAP.md`, and `docs/architecture/capability-conformance-matrix.md` as newly modified by this attempt. No pre-existing modification was reverted, deleted, staged, or committed. No branch, tag, or PR was created; no `git add`/`commit`/`push` ran.

### Completed implementation tasks and checkbox evidence

The five completed PR 2 implementation-owned rows are visibly marked `- [x]` in `openspec/changes/pi-capability-conformance/tasks.md`:

1. RED cross-surface negative cases added;
2. GREEN verifier cross-surface parsing/validation implemented;
3. `capability-manifest.yaml`, matrix, README, and ROADMAP reconciled to one vocabulary;
4. TRIANGULATE coverage added;
5. REFACTOR (centralized literals, de-duplicated prose) completed.

The sixth row, "Verify PR 2 with ...", **remains `- [ ]`** because `bun test` is red (Blocker 1) and the slice exceeds the review budget (Blocker 2). The four `<!-- sdd-owner: parent -->` rows remain byte-for-byte unchanged and unchecked.

### What was implemented

`scripts/verify-capability-manifest.mjs` gained a read-only, offline cross-surface projection guard. When the manifest declares the additive `currentProjection.surfaces`, each declared repository-relative surface is read and its `<!-- conformance:<kind> ... -->` markers are validated against the manifest in sorted surface order:

- `conformance:surface` — must self-identify and must carry `authority=pi-operates-never-authorizes` plus a non-empty `source` link;
- `conformance:snapshot` — `scope` must be `current` or `historical`; every snapshot marker needs a `source`; a `historical` marker without a source is rejected as an **unlabeled historical snapshot**; a `current` marker that restates a snapshot fact must agree with `evidenceSnapshot` in `command`, `result`, `date`, `classification`, and `identity`, and a marker with no values is the accepted delegation form;
- `conformance:capability` — `name` must exist, `state`/`verification`/`ownership` must agree with the manifest (case-insensitively), a `pi-local` ownership claim over `kernel-consumed`, `referenced-only`, or `unavailable-operational-integration` is rejected as **ownership escalation**, and a `validated-end-to-end` verification or `operational=end-to-end` claim for a capability the manifest does not record as end-to-end is rejected as an **unsupported operational end-to-end claim**;
- a normalized forbidden-phrase scan rejects any declared surface that claims Shell fiscal authority or Shell delivery of the master program.

Diagnostics are deterministic and surface-order independent. No network, secret, ambient user data, fiscal operation, receipt, or approval is read; the guard cannot authorize anything.

Reconciliation: the manifest declares its three projection surfaces and labels its recorded snapshot as preserved rather than live; the matrix's two conflicting verification levels were aligned to the manifest (and the manifest's internally inconsistent `declared-only` level for `configurator-install-doctor-sync` — which has cited tests — was corrected to `unit-or-contract-tested`); the matrix's "Program" column that read as ownership was renamed to "Program reference" and its two `Referenced-only` program cells were restated as master SDD references so they can no longer contradict the manifest's `pi-local` ownership; the matrix's preserved identities are labeled historical with sources; README and ROADMAP gained the authority-boundary and current-snapshot markers and an explicit "no capability is `validated-end-to-end`" statement; README's "per-phase model selection for fiscal work" bullet was corrected to the advisory registry it actually is.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 2 cross-surface guard | `__tests__/capability-manifest.test.ts` | Unit / spawned offline CLI against deterministic temp roots and the real repository | 20 pass / 0 fail | 6 new assertions: expected 20 pass / 6 fail — the verifier ignored `currentProjection`, so no contradiction was detected | First run 21 pass / 5 fail: the marker grammar rejected space-bearing values (`result=9999 passed, 0 failed`) and 4 markers parsed as malformed. Quoted-value grammar added → 25 pass / 1 fail (only the real-repository projection assertion). Manifest `currentProjection` + real-surface markers added → 28 pass / 0 fail; `verify:capability` OK | Two coverage cases added (referenced-only and unavailable-operational-integration escalation; missing surface, escaping path, unsourced capability claim). Both passed on first run because the implementation generalized correctly rather than special-casing the kernel-consumed fixture — recorded as a passing triangulation, not a new RED | Centralized `END_TO_END_LEVEL`, `PI_LOCAL_OWNERSHIP`, `AUTHORITY_VALUE`, and `SNAPSHOT_SCOPES` and derived `NON_LOCAL_OWNERSHIP` from `OWNERSHIP_VALUES`; removed the duplicated rule list from README in favour of the matrix. 28 pass / 0 fail; `tsc --noEmit` and `verify:capability` clean |

One implementation defect was found and fixed during GREEN, not by weakening a test: the ownership-escalation rule initially also fired on `state=implemented` for a `kernel-consumed` capability, which wrongly rejected the manifest's own legitimate `pinned-ai-runtime` state. REQ-CONF-007 is about ownership escalation, so the state trigger was removed from that rule; the `pi-local`-over-non-local trigger (and its test) is unchanged.

### Verification evidence

| Command | Result |
| --- | --- |
| `bun test __tests__/capability-manifest.test.ts` (safety net, before edits) | 20 pass, 0 fail |
| `bun test __tests__/capability-manifest.test.ts` (RED) | Expected failure: 20 pass, 6 fail |
| `bun test __tests__/capability-manifest.test.ts` (GREEN, first run) | 21 pass, 5 fail (marker grammar gap) |
| `bun test __tests__/capability-manifest.test.ts` (GREEN, complete) | 28 pass, 0 fail; 83 expect() calls |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun test` | **757 pass, 3 fail** — `Ran 760 tests across 50 files`. Baseline before this attempt: 752 pass, 0 fail. All 3 failures are in `__tests__/lock-facts.test.ts`, none in PR 2's own behavior |
| `bun run typecheck` | `tsc --noEmit` passed (no diagnostics) |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| `node scripts/refresh-program-lock-facts.mjs --check` | `refresh-program-lock-facts: FAILED: program lock facts are stale; run bun run refresh:lock-facts` |
| Runtime-harness verification | **N/A** — the changed behavior is a read-only, offline conformance guard that invokes no Shell runtime boundary |

### Blocker 1 — `bun test` cannot be green inside PR 2's allowlist

All three failures are in `__tests__/lock-facts.test.ts`:

- `capabilityStates.digestSha256 must match the current manifest bytes` — reported by both "reports zero violations against the real repository state" and "rejects a mismatched pin checksum, package version, digest, or active-change set". Caused by PR 2's required `capability-manifest.yaml` edit.
- `re-derives the recorded candidate identity via the CLI`: recorded `dirty-sha256:69ce276aff72979eebbc3515fc33bdb25fcb66ffbe7f75585e325bc2ca870e88` versus derived `dirty-sha256:899673f8e0e9bd2b6f0c185517bf3c9351008e1adacc80fa84a9759501869e30`.

Root cause, proven by experiment before any code was written: `scripts/compute-candidate-identity.mjs`'s `PARTICIPATION_PATHS_V1` includes `scripts/verify-capability-manifest.mjs`, `__tests__/capability-manifest.test.ts`, `capability-manifest.yaml`, and `ROADMAP.md`, and `docs/architecture/program-lock-facts.json` records both a digest of the manifest bytes and an identity derived from those paths. Appending a single trailing newline to the verifier alone was enough to break the identity assertion (recorded identity unchanged at `dirty-sha256:69ce...`, derived identity moved to `dirty-sha256:e0b7...`, then restored byte-for-byte). PR 2's mandatory RED and GREEN tasks edit three of those files, so the lock facts necessarily go stale — exactly as they did for PR 1.

PR 1.5 was pulled forward specifically so that PR 2's `bun test` would be green, but that remedy is structurally insufficient here: the refresh has to run *after* the edits that invalidate it, and PR 2 is explicitly prohibited from touching `docs/architecture/program-lock-facts.json` or `scripts/refresh-program-lock-facts.mjs`. Scope was **not** widened.

Required unblock — one command, with the PR 1.5 precedent: authorise `bun run refresh:lock-facts` as PR 2's derived-artifact regeneration, or run it in a parent-owned follow-up unit exactly as PR 1.5 did. Nothing else is red, and no unrelated file is implicated.

### Blocker 2 — the 400-line review budget cannot hold PR 2

Measured on the ledger's counting basis (additions + deletions; PR 1's ledger value was 466):

| File | PR 1 | PR 2 |
| --- | --- | --- |
| `scripts/verify-capability-manifest.mjs` | ~104 | ~275 |
| `__tests__/capability-manifest.test.ts` | ~280 | ~341 |
| `capability-manifest.yaml` | ~37 | ~34 |
| `docs/architecture/capability-conformance-matrix.md` | 0 | 64 |
| `README.md` | 0 | 21 |
| `ROADMAP.md` | 0 | 15 |
| **Total** | **421 (ledger: 466)** | **≈705–750** |

The machine-enforced guard (verifier plus its strict-TDD focused tests) is ≈616 changed lines on its own, before any truthful-projection reconciliation (≈100). Four of the six PR 2 rows are RED/GREEN/TRIANGULATE/REFACTOR tasks whose tests are mandatory under the active strict-TDD gate, so the overrun is not compressible prose or formatting.

Required split boundary — parent decision; two chained slices under `feature-branch-chain`, each under 400:

- **Slice 2a — projection guard core (~400):** verifier `surface`/`snapshot`/`capability` marker grammar and surface reading; current-snapshot agreement; capability state/verification/ownership agreement; ownership escalation. Plus the matching RED/GREEN tests, the manifest `currentProjection` declaration, and the delegating `surface` + `snapshot` markers in the three real surfaces (needed for `verify:capability` to stay green).
- **Slice 2b — authority boundary, deterministic diagnostics, and truthful public projections (~330):** the forbidden-authority-claim scan; ordering and case guarantees; `referenced-only` and `unavailable-operational-integration` escalation coverage; missing/escaping surface hardening; the matrix/README/ROADMAP reconciliation and the ten per-capability projection markers.

No delivery exception was requested, assumed, or invoked. `size:exception` was not used, and neither `single-pr` nor a chained mode was invented; `auto-chain` / `feature-branch-chain` is the confirmed strategy and this slice was attempted as a single unit.

### Deviations from design

- The design left "the exact verifier filename and manifest field shape" to be confirmed; both were confirmed in place: the guard extends the existing `scripts/verify-capability-manifest.mjs` and adds one additive manifest field (`currentProjection`) with no capability state, contract, or runtime change.
- The ownership-escalation rule described above was narrowed to ownership-only claims during GREEN.
- `docs/architecture/program-lock-facts.json` was deliberately left untouched, which is why Blocker 1 remains open. No checksum, identity, or generated fact was hand-edited anywhere.
- The unused `relative` import in the verifier predates this attempt (it is also unused at HEAD) and was intentionally left alone as unrelated to PR 2.

### Workload / PR boundary and rollback

- Delivery path: assigned `auto-chain` / `feature-branch-chain` PR 2 slice only. PR boundary: the cross-surface projection guard, its focused tests, and the reconciled manifest/matrix/README/ROADMAP projections. PR 3, PR 4, and all parent-owned lifecycle actions are untouched.
- Rollback boundary: revert only PR 2's six allowed files, restoring the prior narrative projections while preserving PR 1's manifest-only guard. The lock-fact refresh, once authorised, belongs to a follow-up unit and is not part of this rollback. No pre-existing dirty work, contract, runtime pin, fiscal surface, or other SDD artifact belongs to the rollback.

### Remaining unchecked tasks

- [ ] Verify PR 2 with `bun test __tests__/capability-manifest.test.ts`, `bun run verify:capability`, `bun test`, `bun run typecheck`, and `bun run verify:style`; record exact outputs, with runtime-harness verification `N/A` because the changed behavior is a read-only offline conformance guard. PR 1.5 has already refreshed the generated lock facts, so `bun test` starts green and any failure here is attributable to PR 2. <!-- sdd-owner: implementation -->

All exact command outputs are recorded in the verification table above; the row stays unchecked because `bun test` is red (Blocker 1) and the slice is over budget (Blocker 2), not because a command was left unrun.

### Deferred parent lifecycle actions

The four parent-owned bounded-review rows remain byte-for-byte unchecked and deferred. No bounded review, refutation, correction, validation actor, receipt, approval, or delivery gate was started by apply.

## PR 2.5 — Parent-owned recovery: objective reset and lock-fact refresh

**Status:** complete. Executed by the parent orchestrator under explicit user authorization, after the native attempt ledger locked the objective.

### What the ledger recorded for PR 2

The PR 2 apply attempt (ordinal 9) settled **`failed`** with `changed_lines: 892` and `harness_disposition: invalidated`. The provider then returned `blocked` / `maintainer_decision`, set `decision_required: true`, `next_action: reset`, and refused to open another work unit:

> this work unit's attempt or changed-line budget needs a maintainer decision

The author-set bound was 400 changed lines; the measured slice was 892. The apply child did not overrun silently — it stopped, reported both blockers, and left the PR 2 verification row unchecked.

### Maintainer decisions taken (explicit, this session)

1. **Do not split the authored work.** Keep the verified PR 2 implementation intact and enforce the 400-line reviewer budget at commit boundaries instead, delivering the slice as chained **PR 2a** (projection guard core, ~400) and **PR 2b** (authority boundary, deterministic diagnostics, truthful public projections, ~330).
2. **Authorize the objective reset** so the unit bound reflects measured reality rather than an assumption made before the edit surfaces were understood.
3. **Authorize the lock-fact refresh** as a parent-owned post-step.

### Actions taken

1. Reset the native objective with `--expected-revision sha256:bd7eb7d769e72d94e37e188a75b80dd6c73b332be786ec53d80dc977511e2230`, actor `maintainer:dreamcoder08`, and a reason recording decision 1. Result: `decision_required: false`, `next_action: begin`, `cumulative_attempts: 0`, `cumulative_changed_lines: 0`.
2. Refreshed `docs/architecture/program-lock-facts.json` through the established `bun run refresh:lock-facts` path only. No checksum or candidate identity was hand-edited.

### Verification evidence (parent-executed, after the refresh)

| Command | Result |
| --- | --- |
| `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current` |
| `bun test __tests__/capability-manifest.test.ts` | 28 pass, 0 fail (83 expect calls) |
| `bun test` | **760 pass, 0 fail** (50 files) |
| `bun run typecheck` | `tsc --noEmit` passed |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| Runtime-harness verification | N/A — generator run plus a read-only offline guard; no Shell runtime boundary invoked |

### Independent gatekeeper validation of the PR 2 report

Before accepting the child's envelope, the parent re-ran the focused suite, the full suite, the lock-fact check, `tasks.md` checkbox accounting, and a `git status --short` scope check, and confirmed every claim: focused 28/0; full suite 3 failures all in `__tests__/lock-facts.test.ts`; lock facts stale; exactly the six allowlisted files mutated by PR 2; 14 `- [x]` / 18 `- [ ]` / 4 parent markers, with all four parent rows byte-for-byte unchanged.

### Declared post-turn drift

The `pi-lens` formatter reformatted four files after the apply child closed its report, so the authored bytes differ from the ones the child's evidence was recorded against. The parent re-ran every verification command afterwards; all results above are the post-reformat values. This note exists so the reviewer does not treat the byte difference as unreported work.

### Systemic sequencing rule adopted

`program-lock-facts.json` digests `capability-manifest.yaml` bytes and derives an identity over `PARTICIPATION_PATHS_V1`, which includes the verifier, its test, the manifest, and `ROADMAP.md`. Any unit editing an allowlisted input re-stales the facts, so the refresh is a required post-step of **every** such unit — PR 3 and PR 4 included. Placing the refresh only in PR 3 is what made PR 2 unclosable, and this unit supersedes that ordering.

### Rollback boundary

Re-run `bun run refresh:lock-facts` after reverting `docs/architecture/program-lock-facts.json`. The objective reset is a ledger event and is not reverted by editing files. No source, test, contract, manifest, or runtime file belongs to this unit's rollback. The PR 2 report above is retained unedited as the record of what the apply attempt produced and what the ledger measured.

## PR 3 — Verified current snapshot and generated lock-fact alignment

**Status:** complete — the snapshot guard, the reconciled current snapshot, the generated lock-fact refresh, and the five-command verification are all green. The four `<!-- sdd-owner: parent -->` bounded-review rows remain byte-for-byte unchecked and deferred.

### Structured status consumed

- Native status: `gentle-ai.sdd-status` v2; `changeName: pi-capability-conformance`; `artifactStore: openspec` (file-backed, authoritative); `applyState: ready`; `nextRecommended: apply`; `blockedReasons: []`.
- `actionContext`: `mode: repo-local`; `workspaceRoot` and the only allowed edit root are both `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; warnings: none.
- `taskProgress` on entry: 35 total, 18 completed, 17 pending. Assigned boundary: **PR 3 only**. PR 4 and the parent lifecycle rows were not started.
- Candidate-carrier decision recorded as an explicit deviation below, because the manifest's `evidenceSnapshot.candidateIdentity` could not be kept live.

### Allowlist and pre-existing work

- `git status --short` was captured before the first edit. Pre-existing dirty work from other sessions (`contracts/`, `chains/`, `lib/`, `themes/`, `package.json`, `.pi/`, the stray `./~/`) was neither edited, reverted, staged, deleted, nor committed.
- The five PR 1/PR 2 files (`capability-manifest.yaml`, `scripts/verify-capability-manifest.mjs`, `docs/architecture/capability-conformance-matrix.md`, `docs/architecture/program-lock-facts.json`, `__tests__/capability-manifest.test.ts`) were already modified by earlier units of this same change. Nothing outside PR 3's allowlist was touched by this attempt.
- `openspec/config.yaml` was clean at HEAD before this attempt; it is the only newly modified file attributable to PR 3.
- The post-change `git status --short` shows exactly the same pre-existing entries plus `openspec/config.yaml`; `bun run verify:package` builds `dist/`, which is gitignored, so no tracked build noise was created. No branch, tag, PR, `git add`, `git commit`, or `git push` ran.

### Completed implementation tasks and checkbox evidence

The seven implementation-owned PR 3 rows are visibly marked `- [x]` in `openspec/changes/pi-capability-conformance/tasks.md` (re-read after the edit: 25 `- [x]`, 10 `- [ ]`, of which 4 are parent-owned):

1. RED snapshot-record cases added;
2. GREEN evidence-record guard implemented;
3. the final evidence sequence run from the canonical root and recorded;
4. lock facts refreshed through the established path and the snapshot surfaces updated only with proven facts;
5. TRIANGULATE coverage for mismatched identity, baseline-as-current, stale counts, and an unsourced generated lock fact, plus a second identical offline pass;
6. REFACTOR to one shared snapshot-result comparison and consistent labels;
7. final verification evidence recorded.

### What was implemented

`scripts/verify-capability-manifest.mjs` gained a read-only snapshot-evidence guard. It reads the two declared evidence records by **fixed repository-relative path**, so a manifest that drops the declaration cannot skip the check:

- `currentProjection.evidenceRecords` (required, closed to the two known records) and `currentProjection.currentSnapshot` (must be `openspec/config.yaml#/current_test_state`) are validated; `currentProjection` itself is now required, which closes PR 2's recorded caveat.
- `openspec/config.yaml#current_test_state` is the canonical current snapshot. It must carry `command`, `files`, `tests`, `passing`, `failed`, `classification`, `evidence_scope`, `candidate_identity`, and `evidence_date`; while labeled `current` it must agree with the manifest's current snapshot on command/result/date/classification and with the generated live identity.
- `capability-manifest.yaml#evidenceSnapshot` must carry `evidenceScope` (and a `evidenceSource` whenever it is not current). Its identity may be a concrete identity or a delegation, and a current record's identity must equal the generated live identity.
- `docs/architecture/program-lock-facts.json` must carry a `snapshotRecord` label with a source; while labeled `current` its preserved test block and date must match the canonical snapshot exactly. The generated `candidateIdentity` is read, never recomputed, rewritten, or hand-edited.
- `capability-manifest.yaml#testState` must carry a scope label; a `current` test state must match the canonical snapshot.

A bespoke flat reader handles the one non-JSON surface (`current_test_state`): only the block's own scalar `key: value` lines are parsed, deeper block-scalar prose is skipped, and no YAML dependency is introduced.

Evidence-record reconciliation:

- `openspec/config.yaml#current_test_state` now records the proven current run (50 files / 767 passing / 0 failed, `bun test`, 2026-09-11, `dirty-candidate`, labeled `current`) and the final derived identity.
- `capability-manifest.yaml`: `currentProjection` declares the two evidence records and the canonical locator; `evidenceSnapshot` mirrors the current run with a **delegated** identity (`candidateIdentityRef` → the generated lock-facts identity) and `evidenceScope: current`; `testState` (preserved 44 files / 700 passing) is now explicitly `evidenceScope: historical` with `evidenceSource` pointing at the document that records it as an older scoped snapshot.
- `docs/architecture/program-lock-facts.json`: new `snapshotRecord` labeling the preserved `tests`/`evidenceDate`/old `derivationCommands` as `historical` with a source (the archived `2026-09-09-pi-accounting-orchestration` verify report). `tests` itself was **not** modified: `__tests__/refresh-program-lock-facts.test.ts` asserts that block byte-for-byte, so adding label fields inside it would have been an out-of-allowlist test break.
- `docs/architecture/capability-conformance-matrix.md`: the current snapshot is documented where it is published (canonical config record + manifest mirror with delegated identity), a second `conformance:snapshot scope=current` marker names the canonical record, and the preserved 44/700 and 48/738 records are listed as distinct labeled historical snapshots.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 3 snapshot guard | `__tests__/capability-manifest.test.ts` | Unit / spawned offline CLI against deterministic temp roots and the real repository | 28 pass / 0 fail | 7 new cases added: expected 24 pass / 11 fail — the validator ignored snapshot evidence records entirely | Iterations 30 pass / 5 fail → 32 pass / 3 fail → 34 pass / 1 fail (only the real-repository assertion, pending the data update) → **35 pass / 0 fail** after the records were reconciled; `verify:capability` OK | Negative cases cover incomplete/unlabeled records, unsupported scope, unsourced generated lock fact, mismatched dirty identity, baseline presented as current, stale count/result, a lock fact claiming `current` with different counts, a manifest test state that disagrees, and a declaration-less manifest; the real-repository case runs the guard twice offline and compares byte-identical stdout | Extracted `CURRENT_RESULT_FIELDS` + `compareCurrentResult` so the lock-facts and manifest test-state comparisons share one vocabulary |

Defects found and fixed during the cycle (none by weakening a check):

1. **Test helper defect:** `lockFactsText` spread the default `evidenceSource` under an override, so the "generated lock fact lacking its source label" case was not actually exercising the rule. Fixed by explicitly clearing the source in that fixture.
2. **Guard correctness defect:** comparing the canonical current record against a manifest snapshot that was itself labeled `historical` wrongly rejected the legitimate "verified baseline retained beside the current dirty candidate" case (REQ-CONF-003, scenario 2). The comparison is now gated on the manifest record also claiming `current`; agreement is still enforced whenever both claim current.
3. **Fixture defect:** the surface-order determinism case replaced `currentProjection` wholesale when reversing surfaces, dropping the new declaration. Fixed by preserving `evidenceRecords`/`currentSnapshot`.
4. **Test defect:** a hand-written 64-hex literal in an expectation was 62 characters; replaced with a computed string.

### Verification evidence

Final run, canonical repository root `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`, 2026-09-11 (records frozen at this candidate identity):

| Command | Result |
| --- | --- |
| `bun test` | **767 pass, 0 fail** — `Ran 767 tests across 50 files`, 3715 `expect()` calls |
| `bun run typecheck` | `tsc --noEmit` passed (no diagnostics) |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun run verify:package` | `Test Files 50 passed (50)`; `Tests 767 passed (767)`; `verify-package-files: OK (dist tree + packaged files + content hashes reconciled)`; exit 0 |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current` |
| `node scripts/compute-candidate-identity.mjs` | `dirty-sha256:68a2badddb243f2994b92afc8c74b167241c2c075146d6c7016bbc9e3b778dec` |
| Runtime-harness verification | **N/A** — no installed-package invocation was run or independently evidenced. The changed behavior is a read-only, offline conformance guard plus a generated-artifact refresh; the guard cannot authorize anything and reads no network, secrets, or fiscal state. |

Sequencing actually executed (the constraint that settled PR 2 `failed`):

```text
mid-flight evidence run (counts + date + identity: 767 tests / 50 files; identity d84e60cd…)
  → all content edits (config, manifest, matrix, lock-facts labels)
  → bun run refresh:lock-facts (identity → 68a2badd…)
  → write the derived identity into openspec/config.yaml (identity-normalized field)
  → node scripts/refresh-program-lock-facts.mjs --check  → program lock facts are current
  → verifier/test refactor (participation-path edit) → refresh → --check again → still current
  → five-command verification → all green
  → second identical offline pass of all five commands → all green
```

Mid-flight expected-red states, recorded for the reviewer: `bun test` was 765 pass / 2 fail immediately after the content edits and before the refresh (the stale `candidateIdentity` assertion in `__tests__/lock-facts.test.ts` and the not-yet-updated real-repository assertion), exactly as the systemic sequencing rule predicts. `bun run verify:package` failed once on a run that overlapped another vitest invocation (multiple 20–67s timeout failures across unrelated files); re-run alone it passed twice, and the flake is attributed to host contention, not to this candidate.

### Deviations from design

- **The manifest cannot restate the live identity.** `capability-manifest.yaml` bytes participate in the candidate identity, so recording the live value there yields a different identity immediately; `__tests__/lock-facts.test.ts` requires the lock facts to equal the freshly derived identity, so a concrete `evidenceSnapshot.candidateIdentity` can never stay current. PR 3 therefore delegates it (`candidateIdentityRef` → `docs/architecture/program-lock-facts.json#/candidateIdentity`) and keeps the rule strict: a **current** record's identity — concrete or delegated — must equal the generated live identity, and a hand-edited value is rejected. The only surfaces that can carry the live identity are `openspec/config.yaml#current_test_state.candidate_identity` (normalized by `compute-candidate-identity.mjs`) and the generated lock facts; both now record it.
- **The guard never computes an identity**, per design (\"It must not calculate or refresh identities automatically during normal verification\"). It reads the generated identity and compares declared claims; `lock-facts.test.ts` remains the only derivation check.
- **`scripts/refresh-program-lock-facts.mjs` was not changed.** The allowlist permitted a minimal change only if its preservation/validation rules required one; they did not, because the generator preserves unknown top-level fields, so the new `snapshotRecord` label survives regeneration unchanged.
- **PR 2 caveat closed, with a documented fixture change.** Every deterministic temp root now also writes an `openspec/config.yaml` snapshot record and a lock-facts record, and every root manifest declares `currentProjection.evidenceRecords`/`currentSnapshot`. That fixture behavior change is why the reversed-surface determinism case and the baseline/dirty identity case were adjusted; both adjustments preserve the original assertions.
- `testState` counts were **not** updated to the live run. `docs/architecture/ecosystem-boundaries.md` (outside this allowlist) already documents them as an older scoped snapshot, so PR 3 labels them `historical` with a source instead of falsifying that document.
- No frozen contract, checksum, or runtime pin fact was refreshed or altered. `contracts/SHA256SUMS.json` remains in its pre-existing, uncommitted state; the lock-facts `pinEntrySha256` trust anchor is unchanged and still validated by the generator.

### Workload / PR boundary and rollback

- Delivery path: assigned `auto-chain` / `feature-branch-chain` PR 3 slice only. Author-measured slice size ≈850 changed lines (≈450 verifier, ≈330 tests, ≈70 evidence records); the native attempt ledger is the authoritative changed-line measure. The enforce-400-at-commit-boundaries decision keeps this a single authored unit; the natural commit split is guard core + fixtures, then evidence-record reconciliation and the refresh.
- Boundary: snapshot guard, the documented fixture change, the reconciled config/manifest/matrix/lock-fact records, and the generated refresh. PR 4 and all parent-owned lifecycle actions are untouched.
- Rollback: revert only the PR 3 snapshot metadata in `openspec/config.yaml`, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, the `snapshotRecord` label in `docs/architecture/program-lock-facts.json`, the guard plus its tests, and re-run `bun run refresh:lock-facts`. Never regenerate lock facts from another worktree, never revert pre-existing dirty work, and never alter `contracts/SHA256SUMS.json`.

### Remaining unchecked tasks

The six PR 4 implementation-owned rows remain `- [ ]` and are not part of this slice (exact lines in `tasks.md` under `## PR 4`): candidate discovery, its RED case, the bounded inventory, TRIANGULATE coverage, REFACTOR, and the PR 4 verification row.

### Deferred parent lifecycle actions

The four `<!-- sdd-owner: parent -->` bounded-review rows remain byte-for-byte unchecked. Apply started no bounded review, refutation, correction, or validation actor, created or approved no receipt, and validated no delivery gate; `next_recommended` is the parent-owned lifecycle route.

## PR 3.5 — Parent-owned recovery of an out-of-band reformat invalidation

**Status:** complete. Executed by the parent orchestrator after the PR 3 apply attempt reported `complete` and the native ledger settled it `passed`.

### What happened

Immediately after the PR 3 attempt closed, the harness reported that `pi-lens` had reformatted two files — `__tests__/capability-manifest.test.ts` and `scripts/verify-capability-manifest.mjs`. Both are members of `PARTICIPATION_PATHS_V1`, so the reformat moved the derived candidate identity and re-staled `docs/architecture/program-lock-facts.json` after the attempt had already generated them.

Independent gatekeeper re-verification of the tree, run after that reformat, contradicted the attempt's closing evidence:

| Claim at close | Measured by the parent afterwards |
| --- | --- |
| `bun test` 767 pass / 0 fail | **766 pass / 1 fail** |
| `refresh-program-lock-facts --check` → current | **`FAILED: program lock facts are stale`** |
| candidate identity `dirty-sha256:68a2badd…` | **`dirty-sha256:134dae52…`** |

The single failure was `program-lock-facts.json (design §6) > re-derives the recorded candidate identity via the CLI`: recorded `68a2badd…` versus derived `134dae52…`.

This is **not** a defect in the PR 3 implementation and not a false claim by the apply attempt. The attempt's evidence was accurate for the bytes that existed when it ran; an out-of-band formatter then changed those bytes. The same class of drift was declared for PR 2, where it was harmless; here it broke the generated-fact invariant because the reformatted files are identity inputs.

### Actions taken

1. `bun run refresh:lock-facts` — regenerated the lock facts against the post-reformat bytes. No checksum or candidate identity was hand-edited.
2. Wrote the freshly derived identity into `openspec/config.yaml#current_test_state.candidate_identity`. This field is identity-normalized, so the write did **not** move the identity — verified: `134dae52…` before and after.
3. Re-verified the whole suite.

### Verification evidence (parent-executed, after recovery)

| Command | Result |
| --- | --- |
| `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current` |
| `bun test` | **767 pass, 0 fail** (50 files) |
| `bun run typecheck` | `tsc --noEmit` clean |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun run verify:package` | `Test Files 50 passed (50)`; `Tests 767 passed (767)`; `verify-package-files: OK` — pinned runtime `drenyra-ai@0.4.1` entry artifact sha256 `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600`, matching the documented `DEFAULT_PIN` |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| Candidate identity at the stable run | `dirty-sha256:134dae5298fc0214ab76ed581ce633370c93db325c2ac4ea0c6b1aa474649de1` |
| Runtime-harness verification | N/A — the changed behavior is a read-only offline guard; the only real-installed-package boundary exercised was `verify:package` against the vendored pinned runtime, recorded above with its checksum |

### Rule generalized

PR 2.5 recorded the rule as “every unit editing an allowlisted input re-stales the facts.” That was too narrow. The correct rule is: **any mutation of an allowlisted path — including one made by a formatter, autofix, or another session, outside any attempt — invalidates the generated facts.** Recovery is always the same two steps in order, because the second does not move the identity:

```text
bun run refresh:lock-facts  →  write the derived identity into openspec/config.yaml#current_test_state.candidate_identity  →  --check  →  full verification
```

The ledger's `passed` settle for PR 3 carries evidence revision `sha256:4dd84947…`, which describes the pre-reformat bytes. That record is retained as history; the authoritative evidence for the current tree is the table above.

### Rollback boundary

Re-run `bun run refresh:lock-facts` and restore the prior `candidate_identity` value. No source, test, guard, schema, or contract behavior belongs to this unit's rollback.

## PR 4 — Legacy-surface inventory and retention decision record

**Status:** complete — the six implementation-owned PR 4 rows are done and verified. The four `<!-- sdd-owner: parent -->` bounded-review rows remain byte-for-byte unchecked and deferred.

### Structured status consumed

- Native status: `gentle-ai.sdd-status` v2; `changeName: pi-capability-conformance`; `artifactStore: openspec` (file-backed, authoritative); `applyState: ready`; `dependencies.apply: ready`; verify/archive `blocked`; `nextRecommended: apply`; `blockedReasons: []`.
- `actionContext`: `mode: repo-local`; `workspaceRoot` and the only allowed edit root are both `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; warnings: none.
- `taskProgress` on entry: 38 total, 28 completed, 10 pending (6 PR 4 implementation rows, 4 parent lifecycle rows). Assigned boundary: **PR 4 only**.
- Native attempt continuity was read from provider authority only (`gentle-ai sdd-attempt status`: active attempt ordinal 11, work unit `PR 4 legacy-surface inventory`, max 400 changed lines). The opaque attempt token is not persisted in this artifact or anywhere in OpenSpec state.
- Review Workload Forecast gate: `Decision needed before apply: No`, `Chained PRs recommended: Yes`, `Chain strategy: feature-branch-chain`, `400-line budget risk: High`. The confirmed delivery decision is `auto-chain`, so the assigned PR 4 slice was implemented as its own unit with no new decision required.

### Allowlist and pre-existing work

- `git status --short` was captured before the first edit (41 entries). Pre-existing dirty work from other sessions — `contracts/`, `chains/`, `lib/`, `themes/`, `package.json`, `.pi/`, the stray `./~/`, and the deletion `themes/fiscal-operator/manifest.json` — was neither edited, reverted, staged, deleted, nor committed.
- No pre-existing modification overlapped PR 4's surface. This unit touched exactly: `docs/architecture/legacy-capability-surface-inventory.md` (new), `docs/architecture/capability-conformance-matrix.md` (link only), `openspec/changes/pi-capability-conformance/tasks.md`, and this file.
- `docs/architecture/program-lock-facts.json` was already modified by PR 3/PR 3.5 before this unit; it appears as `M` in both the before and after status and was **not** written by this unit.
- No branch, tag, or PR was created; no `git add`, `git commit`, or `git push` ran. No file outside the allowlist was widened into.

### Completed implementation tasks and checkbox evidence

The six implementation-owned PR 4 rows are visibly marked `- [x]` in `openspec/changes/pi-capability-conformance/tasks.md` (re-read after the edit: **34 `- [x]`, 4 `- [ ]`, and those 4 are exactly the parent-owned rows**):

1. candidate discovery recorded with consumers/disposition/evidence source, no candidate surface edited or deleted;
2. the conditional RED row, resolved by the explicit no-enforcement decision recorded on the row itself and below;
3. GREEN — bounded inventory created and linked from the matrix, every unproven surface marked retained with the four-part removal bar;
4. TRIANGULATE — a historical snapshot/document candidate (A5/A6 `harness-draft-conformance.md`, B1 the document itself) and legacy helper/compatibility-path candidates (C1–C5, including the live-path C2 and the identity-coupled D2) plus explicit unknown-consumer wording;
5. REFACTOR — retention language stated once in the inventory and only summarized in the matrix link; negative verification that nothing was deleted;
6. the six-command PR 4 verification recorded below.

### Task 2 (RED) — decision: the guard does **not** enforce inventory presence

No test was added and no behavior changed. Rationale, recorded verbatim on the checkbox row:

- `capability-manifest.yaml` is the only carrier of `currentProjection.surfaces`, and it is **outside PR 4's edit allowlist**. The inventory therefore cannot be declared as a verified projection surface, so the guard cannot observe it.
- Requiring an inventory reference would mean editing an identity input (manifest, verifier, and its test are all in `PARTICIPATION_PATHS_V1`), which re-stales `docs/architecture/program-lock-facts.json` and forces the refresh pair inside a documentation unit, past this unit's 400-line bound and contrary to the explicit sequencing constraint.
- REQ-CONF-008 requires a legacy surface to have a **recorded disposition and known consumers**; it does not require guard enforcement. Guard enforcement of inventory presence is therefore not needed to satisfy the requirement.
- A test that asserts nothing is prohibited, so no test was written. No guard or test file was touched.

### What was implemented

- **New `docs/architecture/legacy-capability-surface-inventory.md` (127 lines).** States the retention boundary, the seven discovery surfaces, and a four-part removal bar (replacement or explicit compatibility decision; package verification; focused regression evidence; an updated snapshot record proving those ran on the removal candidate). Records 18 candidates with evidence source, known consumers, and disposition: A1–A6 historical snapshot/evidence records; B1–B4 historical documents and archived artifacts; C1–C5 legacy helpers and compatibility paths; D1–D3 historical labels retained inside current surfaces. Every candidate is **retained**; consumer certainty is stated as `known` or `unknown`, and each unknown is listed as an explicit unresolved item that is *not* treated as a removal proof.
- **`docs/architecture/capability-conformance-matrix.md` — link only.** Added a `## Legacy surface retention` section pointing at the inventory and restating, once, that nothing is deleted without the separately bounded replacement/compatibility/package/regression evidence. No matrix marker, capability row, snapshot record, or cited evidence was modified, and the guard's `currentProjection` contract is unchanged.

Two findings are worth the reviewer's attention because they raise the bar for any future removal:

- **C2 is on the live path.** `/drenyra:close` (`extensions/register.ts`, `closeHandler`) calls `MonthlyCloseChain.run` **without** `reconcileManifest`, so the RECONCILE no-op phase-only fallback in `chains/monthly-close.ts` is current production behaviour rather than idle code. Absent wiring is not the reason it is retained — present wiring is.
- **D2 is an identity-coupled compatibility indirection.** `scripts/verify-capability-manifest.mjs` pins `EXPECTED_EVIDENCE_REF = "docs/architecture/program-lock-facts.json#/tests"`, so the manifest's current-surface `testState.evidenceRef` is *required* to point at the historical lock-facts block. Changing it is a guard change across three candidate-identity inputs and therefore requires the lock-fact refresh pair.

### Strict-TDD note — no behavior changed, so no RED/GREEN cycle applies

`openspec/config.yaml` declares `strict_tdd: true`, and the contract was followed in ordering: this unit produced **no production or guard behavior**, so there was no failing test to write. The only authored artifacts are a documentation record and a documentation link; task 2 explicitly authorises this outcome when the guard is not made to enforce inventory presence. Writing a test that asserts nothing would violate the gate, so none was added. The RED row is marked `- [x]` with the decision and rationale above rather than left open.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 4 legacy inventory | none (no behavior changed) | Documentation / conformance record | `bun test __tests__/capability-manifest.test.ts` 35 pass / 0 fail; `verify:capability` OK; `--check` current | **N/A — no behavior changed.** The conditional RED case was resolved by the explicit decision that the guard does not enforce inventory presence; no test was added, and a test asserting nothing is prohibited | **N/A** — the GREEN artifact is the inventory + matrix link; no production code path changed. Verified by the six commands below | Coverage checked instead of code: a historical snapshot/document candidate (A5/A6, B1), legacy helper/compatibility-path candidates (C1–C5), and unknown-consumer wording that states the consumer is unknown rather than safe | Retention language stated once in the inventory and only summarized in the matrix link; negative verification re-run to prove no legacy, archived, compatibility, or frozen surface was deleted |

### Verification evidence

Canonical repository root `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`; candidate identity at the stable evidence run `dirty-sha256:134dae5298fc0214ab76ed581ce633370c93db325c2ac4ea0c6b1aa474649de1` — **unchanged** from the pre-unit baseline, which proves no identity input was mutated.

| Command | Result |
| --- | --- |
| `bun test __tests__/capability-manifest.test.ts` | `35 pass`, `0 fail`, 121 `expect()` calls — `Ran 35 tests across 1 file` |
| `bun run verify:capability` | `verify-capability-manifest: OK` |
| `bun run typecheck` | `tsc --noEmit` clean (no diagnostics) |
| `bun run verify:style` | `verify-style: OK (diff-scoped · 107 owned files · 4 rules)` |
| `bun run verify:package` | `Test Files 50 passed (50)`; `Tests 767 passed (767)`; `verify-package-files: OK (dist tree + packaged files + content hashes reconciled)`; vendored runtime `drenyra-ai@0.4.1` entry artifact sha256 `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600` |
| `node scripts/refresh-program-lock-facts.mjs --check` | `program lock facts are current` |
| `bun test` (full suite, canonical command) | `767 pass`, `0 fail`, 3715 `expect()` calls — `Ran 767 tests across 50 files` |
| Runtime-harness verification | **N/A** — this unit is documentation and conformance-record only. No Shell runtime boundary was invoked beyond the real-installed-package reconciliation already performed by `verify:package` against the vendored pinned runtime, recorded above with its checksum. |

### Sequencing case that applied — no lock-fact recovery was needed

The constraint asked for one of two cases to be reported. **The second case applied: no identity invalidation occurred.** This unit's edits stayed within the inventory document and the matrix link, neither of which is a member of `PARTICIPATION_PATHS_V1` (verified by reading `scripts/compute-candidate-identity.mjs`: the list contains `ROADMAP.md`, `capability-manifest.yaml`, `scripts/verify-capability-manifest.mjs`, `__tests__/capability-manifest.test.ts`, `openspec/config.yaml`, and other paths, but **not** `docs/architecture/capability-conformance-matrix.md` and not the new inventory path). Therefore:

- `node scripts/refresh-program-lock-facts.mjs --check` → `program lock facts are current` **without** running `bun run refresh:lock-facts`;
- `node scripts/compute-candidate-identity.mjs` → `dirty-sha256:134dae52…`, byte-identical to the pre-unit baseline;
- no write was made to `docs/architecture/program-lock-facts.json` or to `openspec/config.yaml#current_test_state.candidate_identity`, and no checksum or identity was hand-edited anywhere.
- Out-of-band reformat check: `git status --short` after the verification run shows the same file set as before it (plus this unit's own two files), and `--check` still reports current; no `pi-lens` reformat of an identity input was observed after the evidence run.

### Negative verification — nothing was deleted

- `git status --short` before/after: the only `D` entry is the pre-existing `themes/fiscal-operator/manifest.json` from another session, untouched here. No new deletion exists.
- All archived changes cited by the surfaces still exist under `openspec/changes/archive/` (`2026-08-15-pi-sdd-010-participation`, `2026-08-15-pi-sdd-030-routing-adapter`, `2026-08-15-pi-sdd-040-adapter-boundary`, `2026-09-09-pi-accounting-orchestration`).
- Every source, test, and document path cited in the retention-relevant rows resolves on disk.
- `contracts/` (including `SHA256SUMS.json`), `vendored/`, the runtime pin, `README.md`, `ROADMAP.md`, `docs/architecture/harness-draft-conformance.md`, and every SDD 2–6 artifact were read as discovery inputs only — never edited or deleted. `contracts/README.md` and `contracts/SHA256SUMS.json` show as `M` only because of pre-existing work from another session.

### Deviations from design

- No guard enforcement and no test change. The design left the inventory as "additive evidence" and deferred deletion to a later work unit; PR 4's conditional RED row explicitly permitted not requiring the inventory reference, and neither `capability-manifest.yaml` nor the verifier/test pair is in this unit's allowlist. Recorded on the task row and here rather than silently skipped.
- The inventory records 18 candidates across four categories, including a **live-path** compatibility fallback (C2) and an **identity-coupled** indirection (D2). Both are recorded within the mandated seven-surface discovery scope; no surface outside that scope was inventoried.
- The matrix section states the retention summary in the matrix rather than duplicating the whole inventory, keeping retention language stated once (REFACTOR intent) while making the record discoverable from the conformance surface.

### Workload / PR boundary and rollback

- Delivery path: assigned `auto-chain` / `feature-branch-chain` **PR 4** slice only. Author-measured slice size ≈256 changed lines (inventory 127, matrix link +10/−1, tasks 8, this progress section ≈110) — within the 400-line unit bound; the native attempt ledger remains the authoritative changed-line measure.
- PR boundary: the legacy inventory and its matrix link, plus this change's own task/progress persistence. No guard, manifest, README, ROADMAP, lock-fact, contract, runtime, or SDD 2–6 file was touched.
- Rollback: delete `docs/architecture/legacy-capability-surface-inventory.md` and revert the `## Legacy surface retention` section in `docs/architecture/capability-conformance-matrix.md`. Retained legacy files, all preserved snapshots, `contracts/`, the runtime pin, and pre-existing dirty work are untouched by that rollback and must not be reverted with it.

### Remaining unchecked tasks

Only the four parent-owned lifecycle rows remain `- [ ]` (re-read after the edit and confirmed byte-for-byte unchanged, terminal `<!-- sdd-owner: parent -->` markers intact):

- [ ] Start or reuse bounded review for PR 1 …
- [ ] Start or reuse bounded review for PR 2 …
- [ ] Start or reuse bounded review for PR 3 …
- [ ] Start or reuse bounded review for PR 4 …

No implementation-owned row remains unchecked. PR 4 is the final implementation unit of this change; the next step is the parent-owned lifecycle route.

### Deferred parent lifecycle actions

The four `<!-- sdd-owner: parent -->` bounded-review rows remain byte-for-byte unchecked and deferred. Apply started no bounded review, refutation, correction, or validation actor, created or approved no receipt, and validated no delivery gate; `next_recommended` is `parent-lifecycle`.

## Apply phase closure — parent-owned row resolution

**Status:** complete. Parent-executed under explicit user authorization, after every implementation unit was already complete and verified.

### The deadlock

With 34 of 34 implementation rows checked, the native engine still reported `apply: ready` / `dependencies.verify: blocked` / `nextRecommended: apply` and warned `- apply: blocked` in its own summary. The four unchecked `<!-- sdd-owner: parent -->` rows were the only uncompleted rows, so the change could never advance to verify, sync, or archive.

### Root cause (evidence, not inference)

The native `sdd-status` engine has **no task-ownership concept at all**:

- Go `TaskProgress` carries only `total`, `completed`, `pending`, `allComplete` — no unchecked list and no parent-actions bucket.
- `countTaskProgressText` increments on every checkbox match and never inspects the trailing marker.
- `resolveApplyState` returns `ready` whenever `allComplete` is false.
- `sdd-owner` does not appear anywhere in the native source, including the edit-authority path.

The field this change originally expected, `deferredParentActions`, is declared by the **harness-side** contract (`assets/support/sdd-status-contract.md` in this repository, consumed through the documented lookup order), not by the provider's own contract. The native engine is conformant to its own documented contract; the divergent expectation was ours. This was verified against both contract documents and the Go source before any conclusion was drawn, and it is why **no provider defect was filed**: the mandatory handoff applies only when a Gentle AI invocation's own documented contract refuses, and here it did not.

### Decision and action

The user authorized marking the four parent rows complete. Each row's action is “start or reuse bounded review for PR *N*”, and that action **was** performed: `gentle-ai review mode status` reports global `on` / clone-local `off`, and off wins, so receipt-driven development is disabled for this clone and no bounded review is required for these candidates. Marking them records a real outcome rather than bypassing a gate; each row now carries its rationale inline and keeps its marker terminal.

### Verified outcome

| Measure | Before | After |
| --- | --- | --- |
| `tasks.md` | 34 checked / 4 unchecked | **38 checked / 0 unchecked** |
| `taskProgress` | `total 38, completed 34, pending 4, allComplete false` | `total 38, completed 38, pending 0, **allComplete true**` |
| `applyState` | `ready` | **`all_done`** |
| `dependencies.verify` | `blocked` | **`ready`** |
| `nextRecommended` | `apply` | **`verify`** |
| `blockedReasons` | `[]` | `[]` |

### Consequence for the next unit

Verification can now run. Any future SDD change in this repository should treat unchecked `sdd-owner: parent` rows as a hard pipeline blocker, because the native engine cannot distinguish them from implementation work — the deadlock is structural, not incidental.

### Rollback boundary

Revert the four rows to `- [ ]` and remove their inline rationale. No source, test, guard, schema, contract, or generated fact belongs to this unit's rollback.

### Narrative correction (verify WARNING W2)

The PR 4 section above undercounted the inventory as "16 candidates" in two places. The artifact lists **18**: A1–A6 historical snapshot/evidence records, B1–B4 historical documents and archived artifacts, C1–C5 legacy helpers and compatibility paths, D1–D3 historical labels retained inside current surfaces. Both occurrences were corrected to 18 after the verify phase independently counted them from `docs/architecture/legacy-capability-surface-inventory.md`. REQ-CONF-008 was satisfied either way; this is a narrative-accuracy fix, not a coverage gap. The count is worth stating explicitly because a downstream reader trusting this narrative over the artifact would mis-state inventory coverage.
