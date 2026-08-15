# Apply Progress — Prove the Drenyra Pi Adapter Boundary

> Change: `pi-sdd-040-adapter-boundary` · Repo: `drenyra-pi` · Phase: apply (sdd-apply)
> Store: HYBRID — this file is authoritative; Engram is best-effort
> Runtime baseline: published, pinned `drenyra-ai@0.2.0` (checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`)
> Authority-side record: `drenyra-ai/openspec/changes/sdd-040-rda-v2/`, coordinated 2026-08-15 (final closure identity bound during verification)
> Execution mode: Strict TDD (`bun test`); no commits/PRs during apply — the orchestrator owns the PR chain.

## Structured status consumed

| Field | Value |
|---|---|
| applyState | `ready` (native status non-authoritative — HYBRID store with authoritative `openspec/changes/pi-sdd-040-adapter-boundary/` artifacts present; resolved readiness from the tasks/design/spec files directly) |
| actionContext.mode | `workspace-apply` (implied by the apply delegation; allowed edit roots = the design §8 whitelist) |
| reviewWorkloadGate | `High` / `Decision needed before apply: Yes` — resolved by the orchestrator's standing size exception (recorded below) |
| chainStrategy | `pending` at apply start (orchestrator-owned T-GATE-001) — apply implements WU1→WU2→WU3+WU4 in order and reports the PR boundary |

## Size exception (recorded)

The tasks forecast 670–1,010 authored changed lines with `400-line budget risk: High` and `Chained PRs recommended: Yes`.
The orchestrator's standing size exception applies per its tasks.md note: this is a **verification-heavy, docs-plus-tests
proof** (not a product-behavior surface), the user's **no-pares directive** grants standing authority to apply the size-exception
precedent for verification-heavy changes, and the delivery is a **3-PR chain stacked-to-main** per repo #34/#35 precedent.
Apply proceeded under that recorded exception; no new product behavior, command, agent, or fiscal logic was added.

**Measured authored additions+deletions (final candidate, excludes generated output):**

| PR slice | Planned | Measured (new files, additions only — no deletions) |
|---|---|---|
| PR 1 (WU1) | 180–280 | `__tests__/adapter-boundary-audit.test.ts` 440 + `docs/architecture/rda-adapter-boundary-audit.md` 38 = **478** |
| PR 2 (WU2) | 300–420 | `__tests__/adapter-boundary-replacement.test.ts` 859 + `__tests__/fixtures/rda-replacement-fixture.ts` 135 + `__tests__/fixtures/rda-substitute-host.ts` 748 = **1,742** |
| PR 3 (WU3+WU4) | 190–310 | `docs/architecture/rda-adapter-boundary.md` 109 = **109** |
| Total | 670–1,010 | **2,329** |

**PR boundary recommendation for the orchestrator:** keep the three-PR split (PR 1 = WU1, PR 2 = WU2, PR 3 = WU3+WU4).
PR 2 measured >450, so per tasks.md the orchestrator should commit WU2 as reviewable work-unit commits
(fixture+closure → substitute host → projection/normalization → equivalence → negative controls) or carry PR 2 under the
recorded size exception for verification-heavy evidence. No production path was touched; rollback is per-PR below.

## Work units executed

### WU1 — Audit evidence and proven violations (PR 1)

- [x] **T-WU1-001** — materiality ownership proof test.
  - Test: `__tests__/adapter-boundary-audit.test.ts` — `delegates materiality tier derivation to the kernel and only applies a policy floor` (R0/R1/R2/R3 + irreversible + non-PE table; `max(kernel, minimum)` via kernel `orderOf`, never lowers; fail-closed on missing/invalid value/reversibility/jurisdiction — never R0; source-level body assertion on `lib/authority-gates.ts` requiring `deriveMateriality(request.input)` before the `orderOf` floor and rejecting Pi-local thresholds/jurisdiction tables/R0–R3 switches; `chains/monthly-close.ts` `CLOSE_MATERIALITY` supplies `input` + `minimum: "R2"` only).
  - Evidence: `bun test __tests__/adapter-boundary-audit.test.ts -t "delegates materiality tier derivation to the kernel and only applies a policy floor"` → **pass** (part of 9/9 file run; see below).
  - Rollback: remove the test; no production code touched.
- [x] **T-WU1-002** — agent ceiling + UNKNOWN + store non-authority guards.
  - Agent ceilings: every `agents/*.md` frontmatter ceiling is ANALYZE/PREPARE (never EXECUTE); `agents/README.md` inventory reports ANALYZE/PREPARE only; no agent prose grants EXECUTE work (every EXECUTE mention is a prohibition sentence).
  - UNKNOWN zero-retry: `derivePreparedStep` returns `null` for `AccountingMissionStatus.UNKNOWN`; a retry driver performs zero advances, triangulated against a RUNNING mission that does advance.
  - Local-store non-authority: guard named `local persistence alone cannot authorize approve or execute` pre-populates local mission snapshot, forged/local `GRANTED` authority record, evidence node, export artifact, and context-shaped data, then omits the human/kernel authority artifact → the kernel pipeline stops at `approval:needs_input` and performs no execute/close transition. Second assertion: a stored receipt without a trusted verification path (integrity+signature valid but no trusted key list) cannot become execution proof — the receipt gate blocks.
  - Delegation/anti-circularity: the four authoritative modules import only `drenyra-ai/missions|candidates|gates|receipts`; the audited set collectively consumes all four entry points.
  - Evidence (all pass): `bun test __tests__/adapter-boundary-audit.test.ts` (9/9), `bun test __tests__/agents.test.ts` (83), `bun test __tests__/accounting-status.test.ts` (23), `bun test __tests__/chain-pipeline.test.ts chains/__tests__/monthly-close-flow.test.ts` (16), `bun test __tests__/authority-gates.test.ts -t "T-S2-001 explicit materiality"` (10).
  - Rollback: remove the audit test additions; no source change was required.
- [x] **T-WU1-003** — proven-violation conditional correction → **N/A**: every WU1 guard passed against the existing green kernel-delegation path; no Pi-local boundary violation was reproduced, so no conditional source correction was applied and no production path was touched.
- [x] **T-WU1-004** — publish per-rule audit artifact `docs/architecture/rda-adapter-boundary-audit.md`: exactly 10 rule rows (agent authority, materiality, transitions, risk level, approvals, gates, receipts, UNKNOWN, stores, delegation) in the design §3.2 schema — `Rule`, `Requirement IDs`, `Verdict`, `Source evidence`, `Executable evidence`, `Runtime evidence`, `Conclusion`. All 10 verdicts `PASS`; every PASS row cites concrete source paths/symbols + an executable test name/command; runtime evidence cites the WU2 harness where a runtime boundary exists, `N/A` with reason otherwise. No BLOCKED rows.
- **WU1 gate (PR 1 green):** `bun test __tests__/adapter-boundary-audit.test.ts` (9 pass); `bun test __tests__/agents.test.ts` (83 pass); `bun test __tests__/accounting-status.test.ts` (23 pass); `bun run typecheck` (clean); full `bun test` (615 pass, 38 files); `bun run verify:package` (OK, checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`).
- **Rollback boundary (WU1):** remove `__tests__/adapter-boundary-audit.test.ts` + `docs/architecture/rda-adapter-boundary-audit.md` together; no stores, missions, or production behavior migrate.

### WU2 — Independent replacement harness (PR 2)

- [x] **T-WU2-001** — fixture + anti-circularity closure assertion.
  - `__tests__/fixtures/rda-replacement-fixture.ts`: plain constants/types only, deeply frozen, imports NO Pi production module and no drenyra-ai module; RUC/period per existing test conventions, BigInt cents, deterministic evidence references, `sourceSnapshot` derived from the fixture `manifest` (asserted via `sha256Canonical(manifest)`), explicit R2 floor; no precomputed gate verdicts/materiality tier/receipt.
  - Anti-circularity assertion (REQ-HARNESS-002) parses static/dynamic imports in both substitute files and recursively checks the local closure: only the five specifiers (`drenyra-ai/missions|candidates|gates|receipts`, `./rda-replacement-fixture.js`) plus `node:` builtins (environment hashing/serialization only); rejects path aliases, package-root imports, and any specifier resolving under `chains/`, `lib/`, `runtime/`, `extensions/`, `dist/`, `.local/`.
  - Evidence: `bun test __tests__/adapter-boundary-replacement.test.ts -t "the substitute host and fixture import only the five allowed specifiers"` → **pass**.
  - Rollback: remove the fixture + closure test; no production state migration.
- [x] **T-WU2-002** — substitute host `__tests__/fixtures/rda-substitute-host.ts`: imports ONLY the five allowed specifiers + `node:crypto`; in-memory `MissionRuntime` (InMemory stores), kernel materiality derivation, ordered mission/approval/receipt gates through `GateRunner`, kernel-built/verified completion receipt, raw artifacts; phase driver bounded by the 13 EDA phases plus finite slack (16 advances max, no unbounded loop).
  - Evidence: `bun test __tests__/adapter-boundary-replacement.test.ts` (host smoke → COMPLETED, gates all allowed) → **pass**.
  - Rollback: remove the substitute host + smoke test together.
- [x] **T-WU2-003** — canonical projection + normalization (in the harness test, test evidence): `RawHostAuthorityResult` interface, pure `canonicalAuthorityProjection` (schema `drenyra.authority-projection.v1`), `compareProjections` exact matcher, enumerated normalization exclusions, same-mission relationship validation (mismatch throws), and a 21-entry authority-category mutation matrix where every retained category changes the projection.
  - **Documented deviation (design §4.5 application):** `receipt.claims.payloadHash` is excluded from the canonical comparison with a tested justification — the receipt payload hash covers the binding record which embeds the runtime-generated authorization-record id (`auth-<host-mission-id>-close`, exclusion #1: authorization-record IDs); the binding's authority-bearing fields (scopeHash, evidenceHash, policyVersion, targetHash) are retained and compared exactly, and receipt internal validity is retained via `receipt.verified`. This is required because exact payload-hash equality across hosts would require changing Pi production code (`chains/monthly-close.ts` `sealClose`), which the whitelist forbids without a demonstrated violation.
  - Evidence: `bun test __tests__/adapter-boundary-replacement.test.ts` (projection + normalization + mutation matrix) → **pass**.
  - Rollback: remove the projection/normalization tests with the harness.
- [x] **T-WU2-004** — two-host equivalence baseline: the same frozen `RdaReplacementFixture` runs through (a) Pi's `MonthlyCloseChain` over an isolated temporary `storesRoot` (evidence landed via `EvidenceGraphStore`, bounded advance loop, authority checkpoint through Pi's `runAuthorityPipeline`) and (b) the substitute host; both projected → exact plain-data equivalence. Concrete values asserted: kernelTier R1, declaredMinimum R2, effectiveTier R2, gates `mission:allowed, approval:allowed, receipt:allowed`, approver `contador-01`, receipt verified, newStatus COMPLETED, terminal COMPLETED/allowed.
  - Evidence: `bun test __tests__/adapter-boundary-replacement.test.ts` (baseline equivalence) → **pass**.
  - Rollback: remove the harness test with the fixture and substitute host together.
- [x] **T-WU2-005** — five mandatory negative controls, each starting from the equivalent baseline, mutating exactly one host result, and exercising the comparator failure with the named field (REQ-HARNESS-005): (1) override Core decision → `materiality.effectiveTier`; (2) change bound input → `scope.elements.sourceSnapshot`; (3) reorder gate → `gates` sequence; (4) upgrade receipt claim (COMPLETION→EXECUTION) → `receipt.type`; (5) blind UNKNOWN retry → `unknownHandling.attemptsAfterUnknown`. The comparator is called and asserts the mismatch — not mere object inequality.
  - Evidence: `bun test __tests__/adapter-boundary-replacement.test.ts` (all five controls fail with named fields) → **pass**.
  - Rollback: remove the negative controls with the harness.
- **WU2 gate (PR 2 green):** `bun test __tests__/adapter-boundary-replacement.test.ts` (8 pass); `bun run typecheck` (clean); full `bun test` (623 pass, 39 files).
- **Rollback boundary (WU2):** remove `__tests__/adapter-boundary-replacement.test.ts` + `__tests__/fixtures/rda-replacement-fixture.ts` + `__tests__/fixtures/rda-substitute-host.ts` together; no production state migration.

### WU3 — Boundary guide and store classification (PR 3)

- [x] **T-WU3-001** — `docs/architecture/rda-adapter-boundary.md`: boundary in one sentence (Pi coordinates and presents; humans decide; Drenyra AI owns fiscal authority); seven-step happy path (operator → prepare request → call Drenyra AI → present candidate → human decision → verify receipt → project result); per-step ownership table (`Step | Pi owns | Human owns | Drenyra AI owns | Local persistence | Evidence`); fail-closed table for incomplete scope, invalid/corrupt evidence, gate denial, UNKNOWN, receipt verification failure, and unavailable runtime — each row names the stop behavior and the required resumption actor/action (REQ-DOC-003); local-store classification with the design §6 labels; evidence links to `./rda-adapter-boundary-audit.md`, `../../__tests__/adapter-boundary-replacement.test.ts`, the fixtures, the audit test, and the OpenSpec verify report when it exists (REQ-DOC-004); master alignment referencing `sdd-040-rda-v2` + coordination date 2026-08-15, final closure identity bound during verification, and NO duplication of the master's 41-requirement mapping or its five deferred vocabulary differences (REQ-ALIGN-001/002/003).
  - Evidence: link readback — all five relative links resolve; no duplicated master mapping.
  - Rollback: remove the boundary doc (no paired store change).
- [x] **T-WU3-002** — proven store label/guard correction → **N/A**: WU1 proved no store label/guard gap — the guard `local persistence alone cannot authorize approve or execute` passed against the existing code, so no store/context path needed a label or guard fix. The store classification is documented in the boundary doc; the non-authority property is preserved (REQ-BOUND-004).
- **Rollback boundary (WU3):** remove the boundary doc; no store/context source change exists to revert.

### WU4 — Final evidence and planning closure (PR 3)

- [x] **T-WU4-001** — full-suite final candidate evidence on the working-tree candidate (revision `3cced95` base; all change files new/untracked — see whitelist below):
  - `bun test` → **623 pass, 0 fail** (39 files, 3023 expect calls)
  - `bun run typecheck` → **pass** (`tsc --noEmit`)
  - `node scripts/verify-package-files.mjs` → **OK** — `vendored runtime drenyra-ai@0.2.0 reconciled with the pin (entry artifact package/dist/cmd/cli.js sha256 e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047)` (pin read-only, NOT modified)
  - `bun run verify:style` → **OK** (diff-scoped · 85 owned files · 4 rules)
  - `bun run verify:capability` → **OK**
  - `git diff --name-only` → empty (all change files are new/untracked); untracked set verified against the design §8 whitelist (below)
  - Substitute-host import closure confirmed by the anti-circularity test; document links resolve; audit links/verdicts reconciled against the final candidate (runtime evidence column updated with WU2 harness results)
  - Master closure identity (`sdd-040-rda-v2`) referenced by stable change name + coordination date; final closure identity binding is deferred to verification per tasks/design (T-GATE-004)
  - No ROADMAP/config/planning state touched; no new product behavior
- **Rollback boundary (WU4):** revert evidence-only updates (apply-progress, audit runtime-evidence rows); never revert previously verified work units.

## Audit verdict table (10 rules — all PASS)

| # | Rule | Verdict | Key evidence |
|---|------|---------|--------------|
| 1 | Agent authority | PASS | `agents/*.md` ceilings + `agents/README.md` inventory ANALYZE/PREPARE only; `bun test __tests__/adapter-boundary-audit.test.ts` (ceiling tests) + `bun test __tests__/agents.test.ts` (83) |
| 2 | Materiality | PASS | `lib/authority-gates.ts` `deriveRequiredMateriality` delegates to kernel `deriveMateriality` + `orderOf` floor; harness equivalence (`kernelTier R1`/`effectiveTier R2`) + negative control 1 |
| 3 | Transitions | PASS | `MissionRuntime.apply` + `PROGRESS_UPDATE` phase-only updates; harness terminal projection `COMPLETED` on both hosts |
| 4 | Risk level | PASS | `buildProposal` riskLevel is presentation only; tiers kernel-derived; harness compares kernel tiers only |
| 5 | Approvals | PASS | `makeApproval` human-only; kernel `ApprovalGate`; harness `approval.humanApproverId` equality |
| 6 | Gates | PASS | Kernel gates via `GateRunner`; fixed order; empty trustedKeys blocked; harness ordered `mission/approval/receipt` + negative control 3 |
| 7 | Receipts | PASS | `sealClose` completion claims (newStatus COMPLETED), read-only verify; stored receipt without trusted path cannot authorize (guard); harness receipt claims equality + negative control 4 |
| 8 | UNKNOWN | PASS | `derivePreparedStep` null for UNKNOWN + zero-retry driver; harness negative control 5 |
| 9 | Stores | PASS | All local persistence labeled `dev/demo`/`non-authoritative cache` (boundary doc §Store classification); guard proves local persistence cannot authorize |
| 10 | Delegation | PASS | Four modules import only the public kernel entry points; pin/checksum verified; substitute host import closure + full harness equivalence |

No `VIOLATION-FIXED` rows (no violation reproduced — T-WU1-003 and T-WU3-002 are `N/A`); no `BLOCKED` rows.

## Harness equivalence result

- Baseline: same bounded fixture through Pi's `MonthlyCloseChain` (isolated stores) and the substitute host (kernel entry points only) → canonical authority projections **exactly equivalent** (schema `drenyra.authority-projection.v1`; scope, binding, materiality, ordered gates, candidate, approval, receipt, unknownHandling, terminal).
- Negative controls: **5/5 fail with the named field** (`materiality.effectiveTier`, `scope.elements.sourceSnapshot`, `gates` sequence, `receipt.type`, `unknownHandling.attemptsAfterUnknown`).
- Normalization: generated ids/timestamps/signatures differ between runs while projections stay equal; no authority-bearing field leaks; exclusions enumerated (7 `runtimeMetadata` fields + `receipt.claims.payloadHash` with justification).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| T-WU1-001 | `__tests__/adapter-boundary-audit.test.ts` | Integration (kernel delegation) | ✅ 606/606 (baseline) | ✅ Written first | ✅ Passed (9/9 file) | ✅ 6-tier table + fail-closed + source body | ➖ None needed (test-only) |
| T-WU1-002 | `__tests__/adapter-boundary-audit.test.ts` | Unit + source-level | ✅ 606/606 | ✅ Written first | ✅ Passed | ✅ UNKNOWN zero vs RUNNING advance; receipts-with/without-trust | ➖ None needed |
| T-WU1-003 | — | N/A | N/A | N/A | N/A | N/A | N/A — no violation reproduced |
| T-WU1-004 | `docs/architecture/rda-adapter-boundary-audit.md` | Evidence doc | N/A | N/A | ✅ 10 rows, all PASS with source+executable evidence | N/A | ✅ Reconciled with WU2 harness results |
| T-WU2-001 | `__tests__/adapter-boundary-replacement.test.ts` + fixture | Unit + closure parser | ✅ 615/615 | ✅ Closure assertion first | ✅ Passed | ✅ Fixture determinism + manifest-derived snapshot | ➖ None needed |
| T-WU2-002 | `__tests__/fixtures/rda-substitute-host.ts` | Integration (kernel runtime) | ✅ 615/615 | ✅ Smoke test first | ✅ Passed (COMPLETED, gates allowed) | ✅ Evidence-present + approval gate paths | ✅ Proposal creation added at PROPOSE; actor binding aligned to approver |
| T-WU2-003 | `__tests__/adapter-boundary-replacement.test.ts` | Unit (projection) | ✅ 615/615 | ✅ Projection/validation tests first | ✅ Passed | ✅ 21-entry authority mutation matrix | ✅ payloadHash excluded with tested justification |
| T-WU2-004 | `__tests__/adapter-boundary-replacement.test.ts` | Integration (two hosts) | ✅ 615/615 | ✅ Equivalence test first | ✅ Passed | ✅ Concrete value assertions (tiers, gates, approver, terminal) | ✅ receipt actor aligned to Pi's approver binding |
| T-WU2-005 | `__tests__/adapter-boundary-replacement.test.ts` | Integration (mutation controls) | ✅ 615/615 | ✅ Controls first | ✅ Passed | ✅ 5 controls, comparator-exercised | ✅ projection reads raw attemptsAfterUnknown |
| T-WU3-001 | `docs/architecture/rda-adapter-boundary.md` | Doc | N/A | N/A | ✅ link readback passes | N/A | ➖ None needed |
| T-WU3-002 | — | N/A | N/A | N/A | N/A | N/A | N/A — no store gap proven |
| T-WU4-001 | — (evidence) | Verification | ✅ 623/623 final | N/A | ✅ all gates green | N/A | ➖ None needed |

### Test Summary

- **Total tests written**: 17 (9 audit + 8 harness)
- **Total tests passing**: 17 (final suite 623/623, 0 fail)
- **Layers used**: Unit (13), Integration (4: harness equivalence, controls, substitute-host smoke, kernel delegation)
- **Approval tests** (refactoring): none — no existing production file was modified
- **Pure functions created**: `canonicalAuthorityProjection`, `compareProjections`, `canonicalScopeJson`, `sha256Canonical`, `extractFunctionBody` (test/evidence code, not production)

## Files changed (whitelist check — design §8)

All change files are NEW (untracked); `git diff --name-only` is empty (no tracked file modified, no deletions).

Whitelisted required evidence/docs:

- `docs/architecture/rda-adapter-boundary-audit.md` ✓
- `docs/architecture/rda-adapter-boundary.md` ✓
- `__tests__/adapter-boundary-audit.test.ts` ✓
- `__tests__/adapter-boundary-replacement.test.ts` ✓
- `__tests__/fixtures/rda-replacement-fixture.ts` ✓
- `__tests__/fixtures/rda-substitute-host.ts` ✓

OpenSpec evidence (workflow-owned): `openspec/changes/pi-sdd-040-adapter-boundary/tasks.md` (checkboxes), `apply-progress.md` (this file). No conditional production paths were touched (T-WU1-003/T-WU3-002 N/A). No `runtime/*`, `package.json`, lockfiles, `vendored/`, `node_modules/`, `dist/`, commands, agents, extensions, prompts, or ROADMAP/config were edited. The pin `drenyra-ai@0.2.0` + checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047` were verified read-only (never modified).

## Deviations from design

1. **`receipt.claims.payloadHash` normalization (documented exclusion, design §4.5):** the payload hash covers the binding record which embeds the runtime-generated authorization-record id (`auth-<host-mission-id>-close`), so exact cross-host equality is impossible without changing Pi production code (forbidden by the whitelist). It is excluded from the canonical comparison with a tested justification; all authority-bearing binding fields and `receipt.verified` are retained. This is the design-conformant §4.5 exclusion #1 (authorization-record IDs), applied narrowly and tested.
2. **Audit row 7 wording corrected during reconciliation:** the actual completion receipt carries the engine-default `receiptType` `APPROVAL` (Pi's `sealClose` calls `buildSignedReceipt` without a receipt type); the completion claim is `newStatus COMPLETED`. The audit now states the accurate claim (close-completion claim, never execution proof).
3. **Agent ceiling checks live in the audit test file (not `__tests__/agents.test.ts`):** `agents.test.ts` is not on the apply whitelist, so the ceiling/inventory/prose assertions were added to the whitelisted `__tests__/adapter-boundary-audit.test.ts`; the existing `agents.test.ts` (83 tests) was invoked as cited executable evidence.

## Remaining tasks (parent-owned, deferred lifecycle)

- [ ] **T-GATE-001 — Confirm chain strategy before apply.** Orchestrator-owned: sets `chain_strategy` (stacked-to-main per #34/#35 precedent) and records the size exception per PR slice.
- [ ] **T-GATE-002 — Per-PR bounded review and delivery.** Orchestrator-owned: normalize → bounded review → pre-commit/pre-push/pre-PR gates → deliver exactly the reviewed bytes (work-unit commits; behavior + tests + docs in the same unit).
- [ ] **T-GATE-003 — Chain context and PR shape.** Orchestrator-owned: child PRs with chain-context + dependency diagram (📍), tracker draft/no-merge for feature-branch-chain, retarget on polluted diffs.
- [ ] **T-GATE-004 — Final verify and archive.** Orchestrator-owned: run `sdd-verify` (REQ-AUDIT/HARNESS/DOC/ALIGN/BOUND), bind the master closure identity, escalate CRITICAL findings (none expected — no BLOCKED rows) before `sdd-archive`.

## Master closure reference

Authority record: `drenyra-ai/openspec/changes/sdd-040-rda-v2/` (stable change name), coordinated 2026-08-15. Pi contributes host-side structural proof only; the final closure identity is bound during verification (T-GATE-004). No `drenyra-ai` file was edited; no publication/release/delivery occurred during apply.
