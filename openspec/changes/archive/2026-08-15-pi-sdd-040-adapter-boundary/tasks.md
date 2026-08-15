# Tasks — Prove the Drenyra Pi Adapter Boundary

> Change: `pi-sdd-040-adapter-boundary` · Repo: `drenyra-pi` · Status: tasks drafted
> Store: HYBRID — this file is authoritative; Engram is best-effort
> Runtime baseline: published, pinned `drenyra-ai@0.2.0` (checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`)
> Authority-side record: `drenyra-ai/openspec/changes/sdd-040-rda-v2/`, coordinated 2026-08-15 (final closure identity bound during verification)
> Delivery: PR-based, chained, strict TDD (`bun test`), every PR ends green
> Scope bound: host-side structural proof only — Pi is an adapter; Drenyra AI owns fiscal authority. No RDA v2 implementation, no new commands/agents/workflows.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ≈670–1,010 (authored source + tests + docs; exclude generated package output, which is not allowed in the diff) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU1) → PR 2 (WU2) → PR 3 (WU3 + WU4) |
| Delivery strategy | ask-on-risk (standing size-exception applies — see below) |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

**Why High and why Yes:** the four work units span an evidence-backed per-rule audit (10 rules), a two-host replacement harness with five mutation negative controls, an adapter boundary document with per-step ownership, and final full-suite evidence. Authored additions + deletions are forecast at 670–1,010 (design §10), materially above one reviewable diff.

**Decision needed before apply — orchestrator standing exception:** `ask-on-risk` normally requires a user decision before apply. This change is a **verification-heavy, docs-plus-tests proof** (not a product-behavior surface), and the user's **no-pares directive** means the orchestrator holds standing authority to apply the size-exception precedent for verification-heavy changes. The orchestrator therefore applies and records the exception for each PR slice and proceeds to apply unless the forecast reveals something beyond that precedent (e.g. a demonstrated code-path violation in WU1 that cannot be fixed within the design whitelist — that would STOP and report a blocker). Apply must still honor the chosen `chain_strategy` once the orchestrator sets it.

### Per-WU estimate and PR boundary plan (planning budgets)

| WU | PR | Deliverable | Est. files | Est. lines | Size watch |
|----|----|-------------|-----------|------------|------------|
| WU1 | PR 1 | Audit evidence + proven violations (`rda-adapter-boundary-audit.md` + `adapter-boundary-audit.test.ts` + only applicable conditional fix/test pairs) | 2 + conditional | 180–280 | Split store-guard proof into its own commit if needed |
| WU2 | PR 2 | Independent replacement harness (test + fixture + substitute host) | 3 | 300–420 | If measured >450, split projection tests (WU2b) into the next PR |
| WU3 | PR 3 | Boundary guide + store classification + only proven store/guard test pair | 1 + conditional | 140–220 | — |
| WU4 | PR 3 (with WU3) | Full-suite evidence + apply-progress + candidate identity | OpenSpec artifacts + audit updates | 50–90 | Evidence-only; no behavior |

**Natural chain:** PR 1 (WU1) → PR 2 (WU2) → PR 3 (WU3 + WU4). Tasks MAY combine WU1 with WU2 only if the measured authored diff remains reviewable (design §10); otherwise keep the three-PR split. Each work unit keeps its test and behavior/evidence together and records an exact focused result, runtime scenario (or justified `N/A`), and rollback boundary.

## Strict TDD note (applies to every code task)

- **Commands:** `bun test` (runner vitest; include pattern `**/__tests__/**/*.test.ts`), `bun run typecheck` (tsc strict, noEmit), `bun run verify:package` (build + test + `node scripts/verify-package-files.mjs`), `bun run verify:style`, `bun run verify:capability`.
- **Sequence per task that adds code:** RED (write the failing test first, name the test file in the task) → GREEN (minimal implementation) → TRIANGULATE (edge cases from the SC list) → REFACTOR. Record per-phase evidence in apply-progress.
- **Engine truth:** import only public `drenyra-ai` subpaths (`/missions`, `/candidates`, `/gates`, `/receipts`). Never deep-import unexported surfaces. `AccountingMissionStatus` has 15 members — assert exhaustiveness against the installed enum.
- **Conventions:** money is `bigint` cents (never floats); digests are lowercase hex sha-256; flat interfaces; no `any`; local ESM imports use `.js` suffixes; evidence conclusions cite stable paths, symbols, and test cases (evidence-citation skill); nothing outside the design §8 whitelist may be edited (scope-discipline skill).

## Whitelist (design §5.1 / §8 — D5)

Required evidence/docs: `docs/architecture/rda-adapter-boundary-audit.md`, `docs/architecture/rda-adapter-boundary.md`, `__tests__/adapter-boundary-audit.test.ts`, `__tests__/adapter-boundary-replacement.test.ts`, `__tests__/fixtures/rda-replacement-fixture.ts`, `__tests__/fixtures/rda-substitute-host.ts`.

Conditional smallest-fix paths (ONLY when WU1 first records a demonstrated violation AND the same work unit adds regression evidence): `lib/authority-gates.ts`, `__tests__/authority-gates.test.ts`, `lib/chain-pipeline.ts`, `__tests__/chain-pipeline.test.ts`, `chains/monthly-close.ts`, `chains/__tests__/monthly-close-flow.test.ts`, `lib/accounting-status.ts`, `__tests__/accounting-status.test.ts`, `lib/authority-store.ts`, `__tests__/authority-store.test.ts`, `lib/receipt-store.ts`, `__tests__/receipt-verification.test.ts`, `lib/mission-store.ts`, `__tests__/mission-store.test.ts`, `lib/evidence-graph.ts`, `__tests__/evidence-graph.test.ts`, `lib/trusted-key-registry.ts`, `__tests__/trusted-key-registry.test.ts`, `runtime/context.ts`, `__tests__/context.test.ts`.

OpenSpec evidence: `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `state.yaml` (when managed by OpenSpec workflow).

Explicitly excluded from all edits: the `drenyra-ai` repository and master change; `vendored/drenyra-ai-0.2.0.tgz` and other vendored artifacts; all `runtime/*` except conditional `runtime/context.ts`; `package.json` and lockfiles (read-only pin verification only); `node_modules/**`, `dist/**`, generated package output, commands, command registries, extensions, agents, prompts; any new command/agent/operator workflow/fiscal logic/unpublished runtime adapter. ROADMAP/config updates are NOT owned by this change — leave planning state to its own records. Apply MUST stop before editing any unlisted path and return to tasks/design for scope review.

---

## PR 1 — WU1 · Audit evidence and proven violations

> Start with failing audit assertions for materiality ownership, agent ceilings, delegation, UNKNOWN, and local-store non-authority. Make only the smallest pinned-kernel delegation/removal fix if a real violation is reproduced. Publish all ten audit rows only after evidence passes. If a violation needs new kernel behavior, an unpublished module, a runtime release, or a master edit → stop and write a BLOCKED finding; do NOT implement a Pi surrogate.

### T-WU1-001 — RED: materiality ownership proof test (`delegates materiality tier derivation to the kernel and only applies a policy floor`)

- **WU/PR:** WU1 / PR 1 · **Deps:** none · **Est. lines:** 50–80
- **Description:** Write the failing test in `__tests__/adapter-boundary-audit.test.ts` with the exact name `delegates materiality tier derivation to the kernel and only applies a policy floor`. It must assert, per design §3.3:
  1. For a table spanning R0, R1, R2, R3, irreversible input, and non-PE input, `deriveRequiredMateriality({ input })` equals the public kernel `deriveMateriality(input)`.
  2. With `minimum`, the result equals `max(kernel deriveMateriality(input), minimum)` via the public kernel `orderOf`; it never lowers the kernel result.
  3. Missing/invalid `value`, `reversibility`, or `jurisdiction` throws and never defaults to R0.
  4. A source-level assertion reads `lib/authority-gates.ts`, scopes the `deriveRequiredMateriality` function body, and requires the direct `deriveMateriality(request.input)` call before the floor comparison; it rejects Pi-local monetary thresholds, jurisdiction escalation tables, or a local R0–R3 derivation switch in that body.
  5. `chains/monthly-close.ts` supplies `CLOSE_MATERIALITY.input` and `minimum: "R2"`; it does not own a tier threshold.
- **Evidence:** `bun test __tests__/adapter-boundary-audit.test.ts -t "delegates materiality tier derivation to the kernel and only applies a policy floor"`
- **Rollback:** Remove the test; no production code touched. The test targets the existing green kernel-delegation path in `lib/authority-gates.ts` (source confirmed: `deriveMateriality(request.input)` then `orderOf` floor), so it is expected to pass (GREEN is within this task's RED→GREEN).
- [x] T-WU1-001 — materiality ownership proof test. <!-- sdd-owner: implementation -->

### T-WU1-002 — RED→GREEN: agent ceiling + UNKNOWN + store non-authority guard tests

- **WU/PR:** WU1 / PR 1 · **Deps:** T-WU1-001 · **Est. lines:** 60–90
- **Description:** Extend `__tests__/adapter-boundary-audit.test.ts` (RED) with:
  - **Agent ceilings:** extend or invoke `__tests__/agents.test.ts` so every `agents/*.md` frontmatter ceiling and the `agents/README.md` inventory reports ANALYZE or PREPARE only; assert no definition or prose grants EXECUTE work (signing receipts, granting authority, posting/mutating accounting records). The audit records the exact final command.
  - **UNKNOWN zero-retry:** `derivePreparedStep` returns `null` for `AccountingMissionStatus.UNKNOWN` (existing `__tests__/accounting-status.test.ts`), plus a harness-retry control asserting zero attempts occur after UNKNOWN until reconciliation or explicit human action (REQ-AUDIT-010).
  - **Local-store non-authority:** the guard test named exactly `local persistence alone cannot authorize approve or execute` pre-populates local mission/authority/evidence/receipt/export/context-shaped data including a forged/local `GRANTED` record, then omits or corrupts the required human/kernel authority artifact; it must show Pi stops at the applicable kernel gate and performs no execute/close transition. A second assertion stores a receipt record without a trusted valid verification path and proves it cannot become execution proof (REQ-AUDIT-011).
  - **Delegation/anti-circularity:** assert every authoritative operation used by the tested mission traces to public `drenyra-ai@0.2.0` entry points (`/missions`, `/candidates`, `/gates`, `/receipts`) and not to Pi-local code (REQ-AUDIT-012).
- **Evidence:**
  - `bun test __tests__/adapter-boundary-audit.test.ts -t "local persistence alone cannot authorize approve or execute"`
  - `bun test __tests__/adapter-boundary-audit.test.ts`
  - `bun test __tests__/agents.test.ts` (extended ceiling command as recorded in the audit)
  - `bun test __tests__/accounting-status.test.ts`
- **Rollback:** Remove the audit test additions; if this task's guard surfaces a real bypass, escalate to T-WU1-003 before any source change.
- [x] T-WU1-002 — agent ceiling + UNKNOWN + store non-authority guards. <!-- sdd-owner: implementation -->

### T-WU1-003 — Only-if-proven conditional source correction (smallest pinned-kernel delegation/removal fix)

- **WU/PR:** WU1 / PR 1 · **Deps:** T-WU1-001, T-WU1-002 · **Est. lines:** 0–60 (conditional)
- **Description:** ONLY if a WU1 guard reproduces a real Pi-local boundary violation: apply the smallest fix on the applicable conditional whitelist path (e.g. `lib/authority-gates.ts`, `chains/monthly-close.ts`, `lib/accounting-status.ts`, `lib/authority-store.ts`, `lib/receipt-store.ts`, `lib/mission-store.ts`, `lib/evidence-graph.ts`, `lib/trusted-key-registry.ts`, `runtime/context.ts`) that removes/bypasses the local authority effect or delegates the verdict to the existing pinned kernel. Add the paired regression test to the applicable conditional test file in the SAME task. The correction may never add a Pi-local fiscal gate. If the violation requires new kernel behavior, an unpublished module, a runtime release, or a master-repository edit → STOP: do not implement a surrogate; write the audit row verdict as `BLOCKED` with the blocker named. If no violation was reproduced, mark this task `N/A` with the reason in apply-progress and do not touch any production path.
- **Evidence:** `bun test` on the affected conditional test file + `bun run typecheck` (record exact output).
- **Rollback:** Revert only the demonstrated conditional correction with its paired regression test; no other source changes are made.
- [x] T-WU1-003 — proven-violation conditional correction (or N/A). <!-- sdd-owner: implementation -->

### T-WU1-004 — Publish the per-rule audit artifact (`docs/architecture/rda-adapter-boundary-audit.md`)

- **WU/PR:** WU1 / PR 1 · **Deps:** T-WU1-001..003 · **Est. lines:** 70–110
- **Description:** Author `docs/architecture/rda-adapter-boundary-audit.md` with exactly one row per proposal §3.1 rule (10 rules) using the design §3.2 table schema: `Rule`, `Requirement IDs` (`REQ-AUDIT-*`, `REQ-HARNESS-*`, `REQ-BOUND-*`), `Verdict` (`PASS` / `VIOLATION-FIXED` / `BLOCKED`), `Source evidence` (stable paths and symbols, not prose-only), `Executable evidence` (exact test name and command), `Runtime evidence` (harness scenario/result, or `N/A` with reason), `Conclusion` (narrow statement supported by cited evidence). `PASS` is forbidden when source or applicable executable evidence is absent. Mission-model conclusions cite evidence-graph node IDs and verified payload hashes where the mission emits such a conclusion; source-level ownership findings cite paths, symbols, and tests (evidence-citation skill). Publish rows only after their evidence passes. This doc is the evidence table; the boundary doc links to it and does not copy it (design §3.1).
- **Evidence:** readback: table has 10 rule rows, every PASS row carries source + executable evidence; no BLOCKED row without a named blocker.
- **Rollback:** Remove the audit doc (revert with its paired test).
- [x] T-WU1-004 — publish per-rule audit artifact. <!-- sdd-owner: implementation -->

**WU1 gate (PR 1 green):** `bun test __tests__/adapter-boundary-audit.test.ts`; `bun test __tests__/agents.test.ts`; `bun test __tests__/accounting-status.test.ts`; `bun run typecheck`; then `bun test` (full suite) and `bun run verify:package`. Record exact output in apply-progress.
**Rollback boundary (WU1):** Remove the audit test + audit doc; revert only a demonstrated conditional correction with its paired regression test. No stores, missions, or production behavior migrate.

---

## PR 2 — WU2 · Independent replacement harness

> RED: baseline equivalence / anti-circularity / normalization / each negative control fails for the right reason. GREEN: implement fixture and substitute host through public kernel entry points until baseline passes and all five controls still fail.

### T-WU2-001 — RED: bounded fixture + anti-circularity import closure assertion

- **WU/PR:** WU2 / PR 2 · **Deps:** none (fixture is independent) · **Est. lines:** 60–90
- **Description:** RED first in `__tests__/adapter-boundary-replacement.test.ts`: write the anti-circularity assertion (REQ-HARNESS-002) that parses static and dynamic import specifiers in both substitute files (`__tests__/fixtures/rda-replacement-fixture.ts` and `__tests__/fixtures/rda-substitute-host.ts`) and recursively checks their local import closure, allowing only the five specifiers (`drenyra-ai/missions`, `drenyra-ai/candidates`, `drenyra-ai/gates`, `drenyra-ai/receipts`, `./rda-replacement-fixture.js`), rejecting path aliases and package-root imports, and failing on any specifier resolving under `chains/`, `lib/`, `runtime/`, `extensions/`, `dist/`, or `.local/`. GREEN: author `__tests__/fixtures/rda-replacement-fixture.ts` — plain constants/types only (the `RdaReplacementFixture` shape from design §4.3 with a deeply frozen value), importing NO Pi production module. Fixture uses existing test RUC/period conventions, BigInt cents, deterministic evidence references, a source snapshot derived from the fixture manifest, and an explicit R2 floor; it contains no precomputed gate verdicts, materiality tier, or receipt.
- **Evidence:** `bun test __tests__/adapter-boundary-replacement.test.ts -t "<anti-circularity test name>"`
- **Rollback:** Remove the fixture and the anti-circularity test; no production state migration.
- [x] T-WU2-001 — fixture + anti-circularity closure assertion. <!-- sdd-owner: implementation -->

### T-WU2-002 — RED→GREEN: substitute host through public kernel entry points only

- **WU/PR:** WU2 / PR 2 · **Deps:** T-WU2-001 · **Est. lines:** 120–160
- **Description:** Author `__tests__/fixtures/rda-substitute-host.ts` importing ONLY `drenyra-ai/missions`, `drenyra-ai/candidates`, `drenyra-ai/gates`, `drenyra-ai/receipts`, and `./rda-replacement-fixture.js`. It may contain minimal in-memory fixture/store adapters required by `MissionRuntime`, but must not import Pi's `chains/`, `lib/`, `runtime/`, `extensions/`, stores, built output, or package root. It constructs an in-memory mission runtime, derives materiality, runs mission/approval/receipt gates in declared order, builds/verifies the completion receipt, and returns raw artifacts — bounded by the 13 phases plus existing finite continuation slack, no unbounded loop. GREEN: get the anti-circularity closure assertion and a stub run passing through the substitute host alone.
- **Evidence:** `bun test __tests__/adapter-boundary-replacement.test.ts` (anti-circularity + host smoke)
- **Rollback:** Remove the substitute host and its smoke test together.
- [x] T-WU2-002 — substitute host implementation. <!-- sdd-owner: implementation -->

### T-WU2-003 — Canonical authority projection + normalization tests

- **WU/PR:** WU2 / PR 2 · **Deps:** T-WU2-002 · **Est. lines:** 70–100
- **Description:** Define in the harness test (test evidence, not a production API): `RawHostAuthorityResult` interface, the pure `canonicalAuthorityProjection(result)` function returning `CanonicalAuthorityProjection` (schema `drenyra.authority-projection.v1`, per design §4.4 — scope elements + `scopeHash`, evidence/policy binding, materiality `kernelTier`/`declaredMinimum`/`effectiveTier`, ordered gate verdicts, candidate target/content hash, approval relationship, receipt type/binding/claims/verified, `unknownHandling`, terminal status/decision). BigInt cents convert to canonical decimal strings ONLY at this projection boundary. Projection construction validates all cross-artifact relationships before replacing generated IDs with relationship tokens (e.g. `missionRelationship: "same-mission"` emitted only when receipt mission ID equals the actual host mission ID; a mismatch throws). Add the exact normalization exclusions per design §4.5 (generated IDs, runtime timestamps, ephemeral signing material, host-local paths/serialization) and assert NOTHING authority-bearing is excluded. Normalization tests run the same host twice and demonstrate at least the documented generated IDs/timestamps/signatures differ while the canonical projection remains equal; separate mutations of every retained authority-bearing category must change the projection or make projection validation throw (REQ-HARNESS-004).
- **Evidence:** `bun test __tests__/adapter-boundary-replacement.test.ts -t "<normalization test name>"`
- **Rollback:** Remove the projection + normalization tests with the harness.
- [x] T-WU2-003 — canonical projection + normalization. <!-- sdd-owner: implementation -->

### T-WU2-004 — Two-host equivalence (Pi pipeline vs substitute host) baseline

- **WU/PR:** WU2 / PR 2 · **Deps:** T-WU2-002, T-WU2-003 · **Est. lines:** 50–80
- **Description:** In the harness test, run the same bounded `RdaReplacementFixture` (fresh clone of the same frozen logical value) through (a) Pi's `MonthlyCloseChain` / `runChainStep` over an isolated temporary `storesRoot`, and (b) the substitute host. Project both raw results via `canonicalAuthorityProjection` and require exact plain-data equivalence (REQ-HARNESS-001/003; SC-HARNESS-001/004). Both branches bounded by the 13 phases plus finite continuation slack; no unbounded loops. GREEN: baseline passes.
- **Evidence:** `bun test __tests__/adapter-boundary-replacement.test.ts` (baseline equivalence)
- **Rollback:** Remove the harness test with the fixture and substitute host together; no production state migration.
- [x] T-WU2-004 — two-host equivalence baseline. <!-- sdd-owner: implementation -->

### T-WU2-005 — Five mandatory negative controls each failing equivalence

- **WU/PR:** WU2 / PR 2 · **Deps:** T-WU2-004 · **Est. lines:** 70–90
- **Description:** RED: each control starts from the equivalent baseline, mutates exactly one host result, and asserts the same equivalence matcher fails with the NAMED field (design §4.6; REQ-HARNESS-005):
  1. Override a Core decision — change `materiality.effectiveTier` (or a kernel terminal verdict) without changing the bound input → fails on `materiality.effectiveTier` / `terminal.authorityDecision`.
  2. Change a bound input — change `scope.sourceSnapshot` and recomputed/claimed binding on one side only → fails on `scope.elements.sourceSnapshot` / `scope.scopeHash`.
  3. Reorder/substitute a gate — swap approval and receipt order, or replace the approval stage → fails on the `gates` ordered sequence.
  4. Upgrade a receipt claim — change `COMPLETION` or its completion claims into execution proof → fails on `receipt.type` / `receipt.claims`.
  5. Retry UNKNOWN — set `attemptsAfterUnknown` to `1` and attempt continuation without reconciliation/human input → fails on `unknownHandling.attemptsAfterUnknown`.
  The test must exercise the comparator failure (call the comparator and assert it throws/returns the named mismatch); it must NOT merely assert mutated objects are unequal (REQ-HARNESS-005).
- **Evidence:** `bun test __tests__/adapter-boundary-replacement.test.ts` (all five controls fail with named fields)
- **Rollback:** Remove the negative controls with the harness.
- [x] T-WU2-005 — five negative controls. <!-- sdd-owner: implementation -->

**WU2 gate (PR 2 green):** `bun test __tests__/adapter-boundary-replacement.test.ts`; `bun run typecheck`; `bun test` (full suite). Record exact output in apply-progress.
**Rollback boundary (WU2):** Remove the harness test, fixture, and substitute host together; no production state migration.

---

## PR 3 — WU3 · Boundary guide and store classification, then WU4 · Final evidence

### T-WU3-001 — Author the adapter boundary document (`docs/architecture/rda-adapter-boundary.md`)

- **WU/PR:** WU3 / PR 3 · **Deps:** T-WU1-004 (audit exists to link) · **Est. lines:** 90–140
- **Description:** Author `docs/architecture/rda-adapter-boundary.md` in the repo's answer-first architecture style (cognitive-doc-design skill). It must contain: (1) the boundary in one sentence — Pi coordinates and presents; humans decide; Drenyra AI owns fiscal authority; (2) the happy path — operator → prepare request → call Drenyra AI → present candidate → human decision → verify receipt → project result; (3) a per-step ownership table with columns `Step`, `Pi owns`, `Human owns`, `Drenyra AI owns`, `Local persistence`, `Evidence`; (4) a fail-closed table for incomplete scope, invalid/corrupt evidence, gate denial, UNKNOWN, receipt verification failure, and unavailable runtime — each row names the stop behavior and the required resumption actor/action (REQ-DOC-003); (5) the local-store classification using the design §6 labels (`dev/demo` vs `non-authoritative cache`); (6) evidence links to `./rda-adapter-boundary-audit.md`, `../../__tests__/adapter-boundary-replacement.test.ts`, and the OpenSpec verify report when it exists (REQ-DOC-004); (7) master alignment — reference the stable `sdd-040-rda-v2` change and coordination date 2026-08-15, state that its final closure identity must be bound during verification, and do NOT reproduce the master's 41-requirement mapping or its five deferred vocabulary differences (REQ-ALIGN-001/002/003). No second mapping of Core internals.
- **Evidence:** link readback — `./rda-adapter-boundary-audit.md` and the harness test resolve; no duplicated master mapping.
- **Rollback:** Remove the boundary doc (revert with its paired store-label change if any).
- [x] T-WU3-001 — author adapter boundary document. <!-- sdd-owner: implementation -->

### T-WU3-002 — Only-if-proven store label/guard correction with paired test

- **WU/PR:** WU3 / PR 3 · **Deps:** T-WU3-001, T-WU1-002 (guard proof) · **Est. lines:** 0–50 (conditional)
- **Description:** ONLY if WU1 proved a store label/guard gap: apply the smallest conditional fix on the applicable store/context path (e.g. `lib/authority-store.ts`, `lib/receipt-store.ts`, `lib/mission-store.ts`, `lib/evidence-graph.ts`, `lib/trusted-key-registry.ts`, `runtime/context.ts`) and add the paired test to the applicable conditional test file (e.g. `__tests__/authority-store.test.ts`, `__tests__/receipt-verification.test.ts`, `__tests__/context.test.ts`), asserting local persistence cannot authorize approve or execute. The correction may only remove/bypass a local authority effect or delegate the verdict to the existing pinned kernel; it must never add a Pi-local fiscal gate and must preserve the non-authority property (REQ-BOUND-004). If no gap was proven, mark this task `N/A` with the reason in apply-progress.
- **Evidence:** `bun test` on the affected conditional test file + `bun run typecheck` (exact output).
- **Rollback:** Revert only the paired store label/guard change with its regression test.
- [x] T-WU3-002 — proven store label/guard correction (or N/A). <!-- sdd-owner: implementation -->

### T-WU4-001 — Full-suite final candidate evidence and planning closure

- **WU/PR:** WU4 / PR 3 · **Deps:** T-WU3-001, T-WU3-002 · **Est. lines:** 30–50
- **Description:** On one final candidate, re-run every focused and full check and record exact output in `apply-progress.md`: `bun test` (full suite); `bun run typecheck`; `node scripts/verify-package-files.mjs`; `bun run verify:style`; `bun run verify:capability`. Verify `git diff --name-only` stays within the whitelist (design §8), verify the package/runtime pin and checksum (`drenyra-ai@0.2.0`, `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`) WITHOUT modification, confirm the substitute-host import closure, resolve document links, reconcile audit links/verdicts against the final candidate, and bind the final master closure identity (`sdd-040-rda-v2`) if available. Reconcile the forecast estimate against measured authored additions+deletions. Do NOT update ROADMAP/config or planning state — this change does not own it; leave planning state to its own records. No new product behavior. Record the final candidate identity (revision) and workload evidence in apply-progress.
- **Evidence:** `bun test`; `bun run typecheck`; `node scripts/verify-package-files.mjs`; `bun run verify:style`; `bun run verify:capability`; `git diff --name-only` vs whitelist.
- **Rollback:** Revert evidence-only updates; do NOT revert previously verified work units.
- [x] T-WU4-001 — full-suite final candidate evidence. <!-- sdd-owner: implementation -->

**WU3+WU4 gate (PR 3 green):** `bun test`, `bun run typecheck`, `node scripts/verify-package-files.mjs`, `bun run verify:style`, `bun run verify:capability` all pass; whitelist/pin inspection clean; audit links/verdicts reconciled.
**Rollback boundary (WU3+WU4):** Remove the boundary doc and any paired store label/guard change; revert evidence-only updates only — never revert previously verified work units.

---

## Parent-owned lifecycle gates (post-apply, per PR)

- [ ] **T-GATE-001 — Confirm chain strategy before apply.** The orchestrator has applied the standing size-exception for this verification-heavy change per the user's no-pares directive, but must still set the concrete `chain_strategy` (stacked-to-main vs feature-branch-chain) for the PR chain (PR 1 → PR 2 → PR 3) before apply starts. <!-- sdd-owner: parent -->
- [ ] **T-GATE-002 — Per-PR bounded review and delivery.** For each PR 1–3: run source-mutating normalization first, start or reuse the bounded review on the frozen candidate, then validate the pre-commit/pre-push/pre-PR gates with the approved receipt and deliver exactly the reviewed bytes (work-unit-commits skill: behavior + tests + docs in the same unit; commit per work unit). <!-- sdd-owner: parent -->
- [ ] **T-GATE-003 — Chain context and PR shape.** Create each child PR with a chain-context section and a dependency diagram marking the current PR (📍) per the chosen chain strategy; keep a feature-branch-chain tracker draft/no-merge until all PRs integrate; treat polluted diffs as base bugs and retarget instead of mixing chain strategies. <!-- sdd-owner: parent -->
- [ ] **T-GATE-004 — Final verify and archive.** After PR 3, run `sdd-verify` against the spec (REQ-AUDIT-001..012, REQ-HARNESS-001..005, REQ-DOC-001..004, REQ-ALIGN-001..003, REQ-BOUND-001..006), bind the master closure identity, and escalate any CRITICAL finding (including any WU1 BLOCKED) before `sdd-archive`. <!-- sdd-owner: parent -->

## Definition of done and rollback

- Each PR keeps a coherent package state (behavior/evidence + tests + docs colocated; design §10 work units).
- At the end of the chain: the audit publishes one demonstrated verdict per proposal §3.1 rule (10 rows, all PASS or VIOLATION-FIXED, or a named BLOCKED), the two-host replacement harness passes baseline equivalence and all five negative controls fail with named fields, the boundary doc walks the seven-step flow with per-step ownership and fail-closed behaviors, all local stores are labeled `dev/demo` or `non-authoritative cache`, and every full-suite check passes against the pinned `drenyra-ai@0.2.0` with the documented checksum.
- Rollback is per-PR: a failing slice is reverted as a complete unit; prior accepted slices remain usable; no store, mission, or authority behavior is migrated or rewritten.
- Note for verify: the final verify phase runs after PR 3 and binds the master `sdd-040-rda-v2` closure identity.
