# ARCHIVE REPORT — Evidence-Driven Accounting Harness

**Change**: `evidence-driven-accounting-harness`
**Repo**: `drenyra-pi` (Bun + TS ESM, vitest, Pi extension package, pinned `drenyra-ai@0.2.0` vendored)
**Archived at**: `openspec/changes/archive/2026-08-04-evidence-driven-accounting-harness/`
**Evidence revision**: `a82a2c2b3b4759ae6ee452d076929c32e52390a6` (main HEAD; verified before archive)
**Archive date**: 2026-08-04
**Artifact store**: HYBRID (openspec/ files authoritative; engram best-effort)
**Status**: **ARCHIVED — PASS** (all verification gates green; 31/31 implementation tasks complete)

---

## 1. Final-state facts (authoritative at close)

- **All 9 implementation slices S1..S6 complete and merged to main.** 14 PRs merged (#6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20); PRs #4/#5 auto-merged by GitHub (commits carried via #6 topology); PR #17 closed as superseded by #16 (the S5a split was recombined). The 9-PR plan became 14+ merged PRs due to size-driven splits (#1→#6, #2→#7/#8, #3→#9/#10, #4→#11/#12, #5→#13/#14, #6→#15, #7→#16, #8→#18, #9→#19/#20).
- **493 tests / 0 fail** on main (54 baseline → 493 final; +439 tests across the change), 2224 expect() calls, 29 files.
- **Verify PASS**: 79/79 requirements, 50/50 scenarios at `a82a2c2`; 5 gates green (`bun test`, `bun run typecheck`, `bun run build`, `node scripts/verify-package-files.mjs`, `node scripts/verify-packed-install.mjs`). 0 CRITICAL, 3 WARNING (W1 EdaIntent widening design-sanctioned; W2 PR #7/#8 TDD evidence format; W3 PR numbering drift), 2 SUGGESTION (S1 `config.yaml current_test_state` stale — **fixed at archive**, see §6; S2 6 REQ / 4 SC lack literal test-title IDs with confirmed behavioral coverage).
- **All 31/31 implementation tasks checked** in `tasks.md`. Only parent-owned T-GATE rows remain unchecked; **archive completes T-GATE-004**.
- **CI fix merged**: drenyra-ai runtime vendored (PR #6) — the repo went private Aug 3, breaking public release-tgz fetches; `vendored/drenyra-ai-0.2.0.tgz` restores offline installs and CI.

## 2. Artifacts read (archive preconditions)

| Artifact | Result |
| --- | --- |
| `proposal.md` | ✅ read (scope S1–S6, non-goals, rollback §10, metrics §11) |
| `specs/README.md` + 9 `specs/<domain>/spec.md` | ✅ read; 79 REQ / 50 SC recounted and re-confirmed |
| `design.md` | ✅ read (architecture, §1..§17, engine 15-state discrepancy) |
| `tasks.md` | ✅ read — 31/31 implementation tasks `- [x]`; 4 parent-owned T-GATE rows only |
| `apply-progress.md` | ✅ read (PR #1..#9 sections, TDD evidence, gate results) |
| `verify-report.md` | ✅ read — verdict `pass`, 0 blockers, 0 critical, 3 warnings, 2 suggestions |
| `openspec/config.yaml` | ✅ read and updated (current_test_state 54 → 493) |
| `sync-report.md` | N/A — no separate sync phase; archive performed the canonical-spec copy per parent instruction |

**Verification report missing / failing?** No. Verdict `pass`, `blockers: 0`, `critical_findings: 0`; all five gate hashes recorded.

## 3. Canonical spec sync (domains added)

All 9 domains were **NEW** (no canonical specs existed under `openspec/specs/`), so each change spec was copied in full as the canonical domain spec (no merge, no REMOVED requirements, no destructive operation):

| Domain | Canonical path | REQ / SC |
| --- | --- | --- |
| contracts | `openspec/specs/contracts/spec.md` | 8 / 5 |
| scope-binding | `openspec/specs/scope-binding/spec.md` | 9 / 6 |
| authority | `openspec/specs/authority/spec.md` | 9 / 6 |
| evidence-graph | `openspec/specs/evidence-graph/spec.md` | 8 / 5 |
| mission-protocol | `openspec/specs/mission-protocol/spec.md` | 10 / 6 |
| commands | `openspec/specs/commands/spec.md` | 10 / 6 |
| chains | `openspec/specs/chains/spec.md` | 8 / 6 |
| agents | `openspec/specs/agents/spec.md` | 9 / 5 |
| skills-prompts-themes | `openspec/specs/skills-prompts-themes/spec.md` | 8 / 5 |
| **Total** | | **79 / 50** |

- **ADDED requirement names** (79, by domain): REQ-CONTRACTS-001..008; REQ-SCOPE-001..009; REQ-AUTH-001..009; REQ-EVID-001..008; REQ-MISS-001..010; REQ-CMD-001..010; REQ-CHAIN-001..008; REQ-AGENT-001..009; REQ-SKPT-001..008.
- **MODIFIED / REMOVED**: none (all new canonical specs).
- **Active same-domain change warnings**: none — `evidence-driven-accounting-harness` was the only change under `openspec/changes/`.

## 4. Archive action

- Moved `openspec/changes/evidence-driven-accounting-harness/` → `openspec/changes/archive/2026-08-04-evidence-driven-accounting-harness/` (`git mv`; created `openspec/changes/archive/`).
- 16 tracked files + `verify-report.md` (verify-phase addition) and updated `specs/README.md` moved intact. Archive is an audit trail — no archived artifact was deleted or modified.
- Not committed — orchestrator commits the archive.

## 5. Task completion gate

- **Implementation tasks**: 31/31 `- [x]` in persisted `tasks.md` (T-S1-001..005, T-S2-001..005, T-S3A-001..003, T-S3B-001..004, T-S4A-001..004, T-S4B-001..004, T-S5A-001..002, T-S5B-001..003, T-S6-001..004).
- **Unchecked implementation rows**: **none**. No stale-checkbox reconciliation was needed (no unchecked `- [ ]` implementation task markers).
- **Remaining unchecked rows are parent-owned lifecycle gates only**: T-GATE-001 (delivery boundary — completed in practice: `stacked-to-main` confirmed, 14 merges landed), T-GATE-002/003 (per-PR review/delivery — completed in practice per PR), T-GATE-004 (final verify + archive — verify half done by `sdd-verify`, **archive half completed by this phase**).

## 6. Config update

- `openspec/config.yaml` `current_test_state`: `files 8 → 29`, `tests 54 → 493` (S1 suggestion resolved).
- `openspec/config.yaml` `conventions.testing`: "fast suite (54 tests / ~1s)" → "fast suite (493 tests / ~1s)" — same stale-count fix within the same file.
- No `archived-changes` note exists in the config (checked); nothing to append.

## 7. Verify envelope summary

| Field | Value |
| --- | --- |
| verdict | pass (`gentle-ai.verify-result/v1`, evidence `sha256:49b3a58a…`) |
| blockers / critical / warning / suggestion | 0 / 0 / 3 / 2 |
| requirements / scenarios | 79/79 · 50/50 (recounted from spec files) |
| tests | 493 pass / 0 fail, 2224 expect() calls, 29 files |
| gates | bun test ✅ · typecheck ✅ · build ✅ · verify-package-files ✅ · verify-packed-install ✅ (all at `a82a2c2`) |
| TDD compliance | 6/6 checks passed (strict_tdd: true); per-PR RED/GREEN/TRIANGULATE/REFACTOR evidence; baseline preserved at every PR |

**Test count progression (per PR)**: 54 (baseline) → 111 (#1) → 180 (#2) → 211 (#3) → 284 (#4) → 317 (#5) → 345 (#6) → 373 (#7) → 391 (#8) → 493 (#9). +439 across the change; all baselines preserved (REQ-CHAIN-008).

**Findings disposition**:

- W1 (EdaIntent widening: harness-op chains use `verify`/`evidence` intents cast at the engine boundary) — design-sanctioned (§11.4/§11.5); no accounting mission violates REQ-MISS-005. **Carried as accepted deviation.**
- W2 (PR #7/#8 condensed TDD evidence format) — content verified (test files exist and pass); format-only variance. **Carried; recommended follow-up: convert to standard tables.**
- W3 (PR numbering/branch-name drift vs plan) — bookkeeping only; all content present and green. **Carried.**
- S1 (stale `current_test_state`) — **fixed at archive** (§6).
- S2 (6 REQ / 4 SC lack literal test-title IDs) — behavioral coverage confirmed; **follow-up: add IDs to test titles.**

## 8. Artifact inventory (shipped package surface at close)

| Area | Contents |
| --- | --- |
| `contracts/` | 15 versioned JSON schemas, 4 families: `mission/` (4: status/step/snapshot/event), `evidence/` (3: node/edge/graph), `authority/` (3: authority-mode/scope-binding/authorization-record), `receipts/` (5: receipt-content/signed-receipt/receipt-binding/signing-key-info/trusted-key-registry) |
| `lib/` | 11 modules: accounting-status, authority-gates, authority-store, canonicalization, chain-pipeline, evidence-graph, mission-commands, mission-store, receipt-store, receipt-verification, trusted-key-registry |
| `chains/` | 4 chains: `monthly-close.ts`, `reconcile.ts`, `verify.ts` (read-only), `evidence.ts`; full 12-step fixture flow + export artifact |
| `extensions/` | `register.ts` (only Pi entrypoint, `pi.extensions = ["./dist/extensions/register.js"]`), scope-guard, mission-status, startup-panel, mission-commands; 16 `pi.registerCommand` calls (14 intended + legacy company/context) |
| `agents/` | Exactly 7: accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller (byte-for-byte mirrors under `assets/agents/`) |
| `assets/` | `agents/` mirrors, `policies/` (v0.1 non-goals), `schemas/` (scope/evidence/authority mirrors), `chains/` (4 operator chain maps) |
| `skills/` | 3 real skills: scope-discipline, evidence-citation, chain-operation |
| `prompts/` | `persona.md` + 14 command prompts (matches 14 intended commands exactly) |
| `themes/` | One theme `fiscal-operator/` with manifest.json + light/dark variants (51 color keys) |
| `runtime/` | `context.ts` extended: 10-element `CANONICAL_SCOPE_ELEMENTS`, `AuthorityMode`, legacy-compatible canonical scope |
| `vendored/` | `drenyra-ai-0.2.0.tgz` (CI fix; private-repo offline install) |
| `dist/` | Emitted by build; `dist/lib/*`, `dist/chains/*`, `dist/extensions/register.js` verified by package scripts |

## 9. PR history (delivered)

| Plan (tasks.md) | GitHub PRs merged | Slices |
| --- | --- | --- |
| PR #1 (S1) | #6 (`fix/vendor-drenyra-ai`, carried S1 commits `72f7ef1` + `9eb4322`) | contracts + scope + canonicalization + vendor fix |
| PR #2 (S2) | #7, #8 | authority gates/store + accounting status |
| PR #3 (S3a) | #9, #10 | durable missions + monthly-close upgrade |
| PR #4 (S3b) | #11, #12 | evidence graph + trusted keys + receipts (#4/#5 auto-merged, commits carried via #6 topology) |
| PR #5 (S4a) | #13, #14 | extension foundations |
| PR #6 (S4b) | #15 | mission lifecycle commands |
| PR #7 (S5a) | #16 (#17 superseded/closed) | shared chain pipeline + reconcile chain |
| PR #8 (S5b) | #18 | verify + evidence chains + 12-step flow |
| PR #9 (S6) | #19, #20 | agents + assets + skills/prompts/themes + package verification |

All 9 apply batches present in history; all slices green at `a82a2c2`.

## 10. Structured status and actionContext findings

```yaml
schemaName: spec-driven
changeName: evidence-driven-accounting-harness
artifactStore: both          # openspec/ dir exists -> authoritative; engram best-effort
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: done, verifyReport: done }
taskProgress: { total: 31 implementation-owned, complete: 31, remaining: 0, unchecked: [] }
deferredParentActions: { total: 4 (T-GATE-001..004), complete: 0, remaining: 4 -> archive completes T-GATE-004 }
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-pi
  allowedEditRoots: [workspace root]   # no warnings
nextRecommended: none (change complete)
```

No blockers; `nextRecommended` at verify was `archive`, which this phase executed.

## 11. Lessons learned

1. **Provider flakiness on `sdd-apply` → orchestrator inline recovery.** PR #7/#8 apply sub-agents failed repeatedly (2 provider failures + 1 timeout on #7; 1 timeout + provider API errors on #8) leaving partial work. Recovery was orchestrated inline (task completion verified, RED/GREEN evidence completed manually). **Lesson**: for long multi-batch chains, treat sub-agent failure as an expected path, verify the persisted task checkboxes + suite totals after each batch, and keep the orchestrator able to finish a slice inline without losing TDD evidence format (see W2).
2. **Formatter tab-churn cleanup.** Staging discipline excluded formatter churn (staging note in PR #9: "no formatter churn"); one `edit` to `__tests__/extension.test.ts` was mangled by the wrapper's auto-fix (stripped template-literal backtick → TS1005/TS1002) and repaired via `perl`/`python` line patches. **Lesson**: verify auto-fix wrappers after large edits; keep formatting normalization separate from functional edits.
3. **Guard fiscal false positives.** The fiscal guard blocked a `JSON.parse` without try/catch (wrapped as a genuine improvement) and required careful phrasing in static content (Peruvian tax authority references; money words carry BigInt cents context). **Lesson**: content authors must pre-flight phrasing against the guard; linter-mandated changes (try/catch, `$id`-based schema registration) were genuine improvements, not ceremony.
4. **Split dependency pitfalls — `chain-pipeline`/`accounting-status` and `verify`/`readOnly` cross-dependencies.** (a) The PR #2/PR #7 boundary was entangled: `derivePreparedStep(snapshot, scopeHash?)` takes an optional scope hash because the engine `MissionSnapshot` carries none — the caller (chain pipeline, PR #7) supplies the current binding hash, so the stale-scope check had to live in `chain-pipeline.ts`. (b) The PR #7/PR #8 boundary required a `readOnly` flag on `ChainDefinition`: the verify chain's archive completes as a state record with EXECUTE-family ceremony `not_applicable` and never-R0 materiality preserved for write chains; SKIP-before-gates means deterministic no-op ceremony phases never evaluate materiality/approval/receipt. **Lesson**: cross-slice dependencies are the highest-risk split points; document the interface contract (signature + ownership of invariant checks) at the boundary so the later slice doesn't re-derive or duplicate it.

## 12. Engram persistence (best-effort)

| Topic key | Action | Result |
| --- | --- | --- |
| `sdd/evidence-driven-accounting-harness/state` | updated → archived, archive path | ✅ / ⚠️ (see observation IDs below) |
| `sdd/evidence-driven-accounting-harness/archive-report` | saved (hybrid rule) | ✅ / ⚠️ (see observation IDs below) |

Engram server is flaky in this environment; files under `openspec/` remain authoritative. Observation IDs: state → **9372**, archive-report → **9373** (both `saved`; project `drenyra-pi`).

## 13. Next steps (follow-ups, not blockers)

- Orchestrator commits the archive (staged: archive move, 9 canonical specs, `config.yaml` update).
- Reconcile T-GATE-001..004 checkboxes in the archived `tasks.md` (parent-owned).
- Optional: convert PR #7/#8 TDD evidence to standard RED/GREEN/TRIANGULATE/REFACTOR tables (W2).
- Optional: add literal requirement/scenario IDs to the 6 REQ / 4 SC test titles (S2).
- Optional: update `openspec/README.md` "54 tests" references (same stale-count class as S1; config.yaml now fixed).
