# ARCHIVE REPORT — pi-sdd-010-participation

**Change**: `pi-sdd-010-participation` — Pi's bounded participation slice in the program master's active **SDD-010 (Ecosystem Contracts and Release Train, Wave 0)**
**Repo**: `drenyra-pi` (Bun + TS ESM, vitest, Pi extension package, pinned `drenyra-ai@0.2.0` vendored)
**Archived at**: `openspec/changes/archive/2026-08-14-pi-sdd-010-participation/`
**Archive date**: 2026-08-14
**Artifact store**: HYBRID (openspec/ files authoritative; engram best-effort)
**Status**: **COMPLETED — ARCHIVED — CLOSED**
**Verification**: independent verify **PASS — 23/23 requirements PASS, 0 CRITICAL**

---

## 1. Executive summary

The `pi-sdd-010-participation` change delivered Drenyra Pi's bounded, verification-only
participation slice in the program master's active SDD-010 (Ecosystem Contracts and
Release Train). It restored the known red local baseline, froze Pi's two remaining draft
contracts at v0.1, added proportional machine-readable conformance, and recorded verified
final-candidate facts as participant-checkpoint inputs for the master's next integrated
checkpoint. It preserved the verification-only release posture and implemented nothing
that master Gate 0 or the later SDDs gate. The independent verify phase confirmed
**23/23 requirements PASS, 0 FAIL, 0 CRITICAL** against the exact final candidate.

The change is now closed and moved to the dated archive as an audit trail. No commit, PR,
publish, or master-repository write was performed at any point.

## 2. Deliverables (state at close)

| Deliverable | Status |
| --- | --- |
| `contracts/package-contract.md` + `contracts/runtime-dependency.md` | Frozen at **v0.1** |
| `contracts/README.md` | `0.1 / Frozen` rows for both contracts |
| `contracts/SHA256SUMS.json` | Regenerated; digest `bdbb971e…73f2f7` matches frozen bytes |
| `capability-manifest.yaml` (+ `scripts/verify-capability-manifest.mjs` + validator test + `verify:capability` script entry) | Schema `drenyra.capability-manifest.v1`; 10 master capability names; 7 implemented / 2 partial / 1 planned |
| `docs/architecture/program-lock-facts.json` (+ `scripts/compute-candidate-identity.mjs` + lock-facts test) | Final candidate identity recorded; `participantCheckpoint: true` |
| `__tests__/release-verify-workflow.test.ts` | Release-state assertion corrected (private → public); verification-only posture preserved |
| `ROADMAP.md` | Exactly four Phase 1 items checked (lines 31–34); Phase 0/2/3, national-alignment, Gate 0, SDD-020 unchanged |
| `openspec/config.yaml` | `current_test_state` refreshed: {files 37, tests 582, passing true, failed 0, `bun test`, candidate_identity `f70369f7…`, evidence_date 2026-08-14} |
| `openspec/changes/pi-sdd-010-participation/` | Full change artifact set (proposal, specs, design, tasks, apply-progress, verify-report) |

## 3. Final-state facts (authoritative at close)

These facts describe the state at close and supersede stale intermediate snapshots in
`apply-progress.md`/`verify-report.md` where they differ. They reflect the post-verify
evidence correction and re-finalization described below.

1. **Candidate identity (FINAL):** `dirty-sha256:f70369f7986c3f50d4a08774be604be6841e2e26483140606bab4f49d219108f` — recorded identically in `docs/architecture/program-lock-facts.json` → `candidateIdentity`, `openspec/config.yaml` → `current_test_state.candidate_identity` (quoted YAML scalar), and both `Candidate identity:` labels in `apply-progress.md`. NOTE: `verify-report.md` records the older identity `dirty-sha256:784e1a68…`, which is **STALE** — a post-verify evidence correction (lock-facts test-count record) was applied and the identity re-finalized via the design §7.3 protocol (compute → write → recompute identical). The final, authoritative value is **`f70369f7…`**.
2. **Evidence correction:** apply-progress TDD tables were corrected post-verify. `__tests__/lock-facts.test.ts` has **12 tests (7 shape/cross-artifact/re-derivation + 5 identity-algorithm)**, not the earlier `8+6=14` record. `__tests__/capability-manifest.test.ts` has **13 tests** (unchanged, correct).
3. **Final verification (exact final candidate, re-run by the orchestrator after the correction):** `bun test` → **37 files / 582 pass / 0 fail**; `bun run typecheck` → pass; `node scripts/verify-package-files.mjs` → OK; `bun run verify:style` → OK; `bun run verify:capability` → OK. Identity recompute after writing = recorded value (self-reference normalization D4 verified).
4. **Boundaries (all confirmed, REQ-BOUND-001..005):** no SDD-020/030/040 implementation; drenyra-ai master repo untouched; no commit/PR/publish; unrelated dirty files byte-identical (proven by apply-start snapshot hashes + verify recompute).
5. **Deliverables** as listed in §2.

## 4. Verification verdict (23/23)

| Family | Requirements | Verdict |
| --- | --- | --- |
| REQ-BASE (001–003) | 3 | PASS |
| REQ-CON (001–004) | 4 | PASS |
| REQ-CONF (001–002) | 2 | PASS |
| REQ-CAP (001–004) | 4 | PASS |
| REQ-LOCK (001–003) | 3 | PASS |
| REQ-ROAD (001–002) | 2 | PASS |
| REQ-BOUND (001–005) | 5 | PASS |
| **Total** | **23** | **23 PASS / 0 FAIL** |

All 25 SC-* scenarios covered by re-executed evidence. CRITICAL: 0 · WARNING: 1
(lock-facts test-count record — **corrected** at close, see §3.2) · SUGGESTION: 1
(missing apply-start hash for `scripts/verify-package-files.mjs`; informational only).

## 5. Boundary compliance (REQ-BOUND-001..005)

- **REQ-BOUND-001 — No gated SDD implementation:** no SDD-020/030/040 implementation, spec, or surrogate artifact anywhere in the change; matches are only the spec's prohibition/plan text and ROADMAP gate notes.
- **REQ-BOUND-002 — drenyra-ai untouched:** `git -C …/drenyra-ai status --porcelain` shows only pre-existing master-side dirty state; no write under drenyra-ai.
- **REQ-BOUND-003 — No commit/PR/publish:** HEAD unchanged (`c354274dd5…`); zero staged entries; no publish workflow, `publishConfig`, or credentials added; release gate remains verification-only.
- **REQ-BOUND-004 — No unrelated dirty-file mutation:** all nine apply-start-recorded out-of-scope tracked files byte-identical (recomputed); out-of-scope untracked paths untouched; changed-path set equals the §13 whitelist.
- **REQ-BOUND-005 — No Gate 0 promotion claim:** boundary report makes no claim the master Gate 0 is complete/advanced; participant artifacts carry `participantCheckpoint: true` / "Pi-local input; does not modify or promote the program master".

## 6. Size exception record

- **User-approved single-pass apply.** The `ask-on-risk` guard forecast ≈705–1,100 changed lines (>400-line budget High). Confirmed with the user before apply; single-pass apply with an approved exception, per `tasks.md` Review Workload Forecast and design §14. Recorded explicitly in `apply-progress.md` ("Size exception (user-approved, recorded)").
- Chain strategy (`chained-pr` / `stacked-to-main` vs `feature-branch-chain`) forecast "Chained PRs recommended: Yes"; not applicable because delivery is uncommitted by design (REQ-BOUND-003 — no commit/PR). The five-work-unit boundary (WU1–WU5) was the reviewable split.

## 7. Gated-SDD status (reference only)

SDD-020/030/040 **remain gated** by the master's **Gate 0 (R10)** and are not implemented
by or in this change. This change delivers only the Pi-local participation slice that Pi
can own while master Gate 0 is pending. The master owns the gate decision, the federated
capability matrix, the program lock, and the cross-repository release train. No Pi-local
implementation of any gated SDD proceeds until the master promotes readiness. This
archive does not alter, close, or advance that gating.

## 8. Program alignment

- **SDD-010 is active in Wave 0** at the program master (`arkelythex/drenyra-ai@4975f4f`).
- `pi-sdd-010-participation` is the **Pi participation slice** of SDD-010, delivered as a real Pi-local SDD change through the full `proposal → specs → design → tasks → apply → verify → archive` pipeline.
- The master remains authoritative; Pi references but does not duplicate program-master SDD artifacts.
- **Master checkpoint handoff note:** `docs/architecture/program-lock-facts.json` and `capability-manifest.yaml` are **Pi-owned inputs** (non-authoritative for program promotion) for the master's next integrated checkpoint. They carry `participantCheckpoint: true` / "Pi-local input; does not modify or promote the program master".

## 9. Rollback notes

- **Identity note (CRITICAL):** The recorded candidate identity `f70369f7…` refers to the **verified candidate before the archival move**. Re-running `scripts/compute-candidate-identity.mjs` after the move would (correctly) produce a **different** value because the change paths moved from `openspec/changes/pi-sdd-010-participation/` to `openspec/changes/archive/2026-08-14-pi-sdd-010-participation/`. The identity must not be recomputed or re-validated against the archived layout.
- No recomputation or modification was performed on `docs/architecture/program-lock-facts.json`, `openspec/config.yaml`, `capability-manifest.yaml`, or any implementation file during archive. The move is filesystem-only archival state.
- **Rollback boundary for archive:** reverse the directory move (`archive/2026-08-14-pi-sdd-010-participation/` → `openspec/changes/pi-sdd-010-participation/`) and remove this archive-report; no implementation bytes changed by archive.
- No git operation (commit/stage/reset), no PR, no publish was performed; the archive move is filesystem-only.

## 10. Archive move record

- **Moved** `openspec/changes/pi-sdd-010-participation/` → `openspec/changes/archive/2026-08-14-pi-sdd-010-participation/` (via `mkdir -p` + `mv`), preserving all files including `specs/`.
- Files preserved: `proposal.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `specs/README.md`, `specs/participation/spec.md`, plus this `archive-report.md`.
- Verified complete: all files present; the flat spec is no longer at the old change root; nothing orphaned.
- Archive is an audit trail; no artifact was deleted or modified.

## 11. Result contract

- `status`: `completed` (success — 23/23 PASS, 0 CRITICAL; archive move complete)
- `executive_summary`: Pi's SDD-010 participation slice is formally closed: 23/23 requirements verified PASS, final candidate identity `f70369f7…`, final suite 37/582/0 all gates green, boundaries REQ-BOUND-001..005 confirmed, size exception recorded, and the change moved to the dated archive as an audit trail with no commit/PR/publish.
- `artifacts`: this archive-report + the archived change directory at `openspec/changes/archive/2026-08-14-pi-sdd-010-participation/`.
- `next_recommended`: `complete` — none further for Pi until the master promotes Gate 0 / Wave 1 readiness.
- `risks`: R1 — the recorded candidate identity `f70369f7…` refers to the pre-archive layout; any post-archive identity recompute will legitimately differ (documented in §9). R2 — lock-facts / capability-manifest are Pi-owned checkpoint inputs; the master's next integrated checkpoint must treat them as participant evidence, not authority. R3 — delivery remains uncommitted by design; the orchestrator owns any future commit.
  - `skill_resolution`: `paths-injected` (cognitive-doc-design, evidence-citation, scope-discipline loaded before work).

---

## 12. Amendment — close in place (orchestrator decision, 2026-08-14)

**The archive move (§10) was REVERTED. The change is closed in place at
`openspec/changes/pi-sdd-010-participation/`.**

**Why:** the candidate-identity protocol (design §7.2/§13) pins the change paths
(`openspec/changes/pi-sdd-010-participation/*`) as immutable planning inputs.
Moving the directory to `openspec/changes/archive/2026-08-14-pi-sdd-010-participation/`
invalidated the recorded candidate identity `f70369f7…` and broke the integrity
re-derivation test (`__tests__/lock-facts.test.ts` → suite 582 → 581). Re-finalizing
the identity for the archived layout would have forced the whitelist-embedding test
to diverge from the (now historical) design §13 whitelist, and would re-define the
checkpoint evidence to describe moved files. Closing in place preserves one
consistent story: the verified candidate, its identity, and its evidence all live
at the paths the identity pins.

**Design-gap finding (for future changes):** the project's archive-by-move
convention conflicts with any identity protocol whose path set includes the change
directory itself. Future identity-pinned changes must either (a) close in place, or
(b) define the identity path set relative to a stable location that survives
archiving (e.g. the change directory resolved dynamically). Recorded here as a
known project convention gap.

**Final state (verified):** change closed at
`openspec/changes/pi-sdd-010-participation/` (proposal, design, tasks,
apply-progress, verify-report, specs/, archive-report); candidate identity
`dirty-sha256:f70369f7986c3f50d4a08774be604be6841e2e26483140606bab4f49d219108f`
recomputes identically; `bun test` **582 pass / 0 fail** (37 files); typecheck,
package, style, and capability verification all green. No commit/PR/publish;
`pi-program-status-reconciliation` untouched; drenyra-ai untouched.

    - `next_recommended` (amended): `complete` — the slice is closed; the master's
      next integrated checkpoint consumes the lock-facts + capability manifest as
      Pi-owned participant inputs once master Gate 0 / Wave 1 readiness is promoted.

## 13. Amendment — manifest corruption incident (2026-08-14)

A Prettier-style auto-formatter reformatted `capability-manifest.yaml` into a
JSON5-ish layout (expanded `"key":\n {` + trailing commas), breaking the strict
JSON-compatible YAML 1.2 profile and failing 4 tests (capability validator +
lock-facts violations + re-derivation). Fixed: restored strict JSON
(`sha256 5526f363…`), added `.prettierignore` protecting
`capability-manifest.yaml`, `docs/architecture/program-lock-facts.json`, and
`contracts/SHA256SUMS.json`, and re-finalized the candidate identity via the
design §7.3 protocol to **`dirty-sha256:f70369f7986c3f50d4a08774be604be6841e2e26483140606bab4f49d219108f`**
(recorded in lock-facts `candidateIdentity` + `capabilityStates.digestSha256`,
config `current_test_state.candidate_identity`, and both apply-progress labels).
Full suite green: 582 pass / 0 fail.
