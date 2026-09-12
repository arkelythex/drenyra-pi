# Exploration: pi-capability-conformance

Phase: sdd-explore
Status: partial (content complete; persisted by orchestrator — the sdd-explore execution context had no Write/Edit tool)
Audited against: dirty working tree, drenyra-pi @ main, 2026-09-08 (see git status note under Risks — several files are uncommitted at the time of this audit)

## Current State

`drenyra-pi` is materially more implemented than a first read of ROADMAP.md alone suggests, and the drift is not one contradiction but a *pattern* of stale point-in-time audit artifacts that no longer agree with each other or with `main`:

- **`extensions/register.ts`** registers **20 real `/drenyra:*` commands** (19 in `register.ts` + `persona` in `extensions/fiscal-guard.ts`, confirmed by reading the full command-registration block, lines 1147–1249). Every handler traced (`statusHandler`, `closeHandler`, `reconcileHandler`, `verifyHandler`, `evidenceHandler`, `missionHandler`, `receiptHandler`) calls real chain/lib code — `MonthlyCloseChain.run()`, `runChainStep(reconcileChain, …)`, `runChainStep(verifyChain, …)`, `runChainStep(evidenceChain, …)` — not stubs. The historical `not_available` denial pattern an older reconciliation doc describes is gone.
- **`chains/`** has 4 wired chains: `monthly-close.ts`, `reconcile.ts`, `verify.ts`, `evidence.ts`.
- **Two brand-new, currently-uncommitted lib modules** (`lib/accounting-semantics.ts`, `lib/evidence-projection.ts`, both git-status `??`) are **already consumed in production**, not orphaned: `chains/verify.ts:30` and `chains/reconcile.ts:35` import from `accounting-semantics.js`; `chains/evidence.ts:40`, `lib/accounting-status.ts:50`, and `lib/evidence-status.ts:24` import from `evidence-projection.js` (confirmed by grepping for the exact import specifiers, not filename coincidence). Both have dedicated unit tests (`__tests__/accounting-semantics.test.ts`, `__tests__/evidence-projection.test.ts`, also uncommitted). This is genuinely mid-flight hardening work on the reconcile/verify/evidence path.
- **`lib/routing/executor.ts`** — `BudgetLedger` (types.ts:227–339) and `executeRoutingWork` — implements real fail-closed budget/context/scope re-verification (context/evidence checks via `verifyResponse()` and `bindScope()` re-derivation, budget control via `ledger.check()`/`ledger.recordConsumption()` failing closed with `BUDGET_EXHAUSTED`, UNKNOWN-state halting with no auto-advance).
- **`extensions/register.ts:1186–1190`** (`modelsHandler`/`drenyra:models` description) explicitly says "advisory; no Pi model-routing API in this slice". `capability-manifest.yaml` independently marks `model-routing: partial` with an honest limitation string — this is the one place in the repo that already does the implemented/partial distinction correctly.
- **Contradiction is bidirectional, not just README-overstates-vs-ROADMAP-understates**: root `ROADMAP.md` Phase 2 still shows `- [ ]` for persona+panel, status+company+period, mission+receipt+ledger, monthly-close chain, Engram integration, and npm release — all of which are demonstrably wired and tested in the code above (ROADMAP *understates*). Simultaneously, `README.md`'s `## Install` section (`pi install npm:drenyra-pi`) implies a published npm package that ROADMAP's own unchecked item ("Package released as `drenyra-pi` on npm") says hasn't happened (README *overstates*).

**Three separate stale/contradictory reconciliation artifacts were found, beyond the README/ROADMAP pair:**

1. **`openspec/changes/pi-program-status-reconciliation/proposal.md`** (dated 2026-08-14, still an **active, unarchived** change folder) claims: `drenyra-ai@0.2.0` pin, **16** commands, `package-contract`/`runtime-dependency` still `0.1-draft`. All three claims are now false: `package.json` pins `drenyra-ai@0.4.1` (`file:./vendored/drenyra-ai-0.4.1.tgz`), `register.ts` registers 20 commands, and `contracts/README.md` line 3 says all four contract families are **Frozen**, not draft. This active-but-superseded change folder is itself a live contradiction source and should be explicitly archived/superseded as part of resolving this audit — not left open alongside a new answer.
2. **`docs/architecture/harness-draft-conformance.md`** (2026-08-18) is the most current-looking of the three (20 commands, `drenyra-ai@0.4.1`, 703/44 tests) but is *itself* already one snapshot behind the current dirty tree (it doesn't know about `accounting-semantics.ts`/`evidence-projection.ts`).
3. **`capability-manifest.yaml`** (`generatedAt: 2026-08-14T00:00:00Z`, 700/44 tests) has a `rda-chains` capability entry whose `evidence.sources` lists **only** `chains/monthly-close.ts` and whose `evidence.tests` lists only `chains/__tests__/monthly-close-flow.test.ts` — `chains/reconcile.ts`, `chains/verify.ts`, and `chains/evidence.ts` (all three demonstrably wired to live `/drenyra:*` commands) have **no capability-manifest row at all**. `docs/architecture/program-lock-facts.json` (evidenceDate 2026-08-15) independently shows a different test total (700) and lists `activeChanges: ["pi-program-status-reconciliation"]` — the same stale change from point 1.

**Root cause**: every "point-in-time audit" document in this repo (the two docs/architecture snapshots, the capability manifest, and the program-lock-facts snapshot) is hand-authored once and never regenerated or lint-checked against source. That is the systemic problem this change should fix, not just the one README/ROADMAP pair.

**A real (non-documentation) governance tension**, distinct from stale prose: README's own Dominion Program table states "**No Pi-local implementation of SDD-020 proceeds until the master promotes readiness**" (SDD-020 = configurator, gated at master Gate 0, "in progress"), yet `/drenyra:install` and `/drenyra:sync` are already registered, real, tested commands (`installHandler`/`syncHandler`, `register.ts:345–387`, backed by `lib/configurator.ts`; `capability-manifest.yaml` marks `configurator-install-doctor-sync: implemented`). This needs an explicit resolution (relabel as pre-Wave-1 scaffolding, or correct the blocking sentence) — it is a substantive claim conflict, not just a stale count.

**Existing master-SDD linkage is already correct and should be reused, not reinvented**: README.md's own Dominion Program table (lines 50–58) already assigns Pi's served capabilities: SDD-020 (configurator) served-by-Pi/gated, SDD-030 (routing) direct/delegated/durable, SDD-040 (RDA v2). Master-owned-only, referenced not duplicated: SDD-010 (contracts/release train), SDD-050 (monthly close), SDD-070 (skills), SDD-080 (Engram memory), SDD-090 (Guardian), SDD-110 (production), plus 000/060/100. `docs/architecture/program-lock-facts.json`'s `contracts.consumed`/`contracts.produced` blocks corroborate this. Any capability matrix should tag rows against this exact table — no new program names should be invented.

## Affected Areas

- `README.md` — "What it provides" bullet list does not distinguish advisory-only (`model-routing`) or master-gated (`SDD-020` configurator) capabilities from fully wired ones; `## Install` implies an npm release ROADMAP says hasn't happened.
- `ROADMAP.md` — Phase 2 checkboxes (persona/panel, status+company+period, mission/receipt/ledger, monthly-close chain, Engram integration) understate reality; npm-release checkbox is the one item that's genuinely still open.
- `openspec/changes/pi-program-status-reconciliation/proposal.md` — active, unarchived, and now factually superseded (pin version, command count, contract-freeze state); needs archiving/superseding.
- `docs/architecture/harness-draft-conformance.md` — needs either a refresh or an explicit "point-in-time, not live" disclaimer given it's already behind the dirty tree.
- `docs/architecture/ecosystem-boundaries.md` — "Current state and maturity" section (20 commands/4 chains claim) doesn't yet account for the two new deterministic lib modules.
- `capability-manifest.yaml` — missing capability rows for `chains/reconcile.ts`, `chains/verify.ts`, `chains/evidence.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts`; has no field to express the required implemented/unit-tested/contract-tested/validated-e2e distinction.
- `docs/architecture/program-lock-facts.json` — stale evidence snapshot (2026-08-15), still lists the superseded `pi-program-status-reconciliation` as the active change.
- `contracts/README.md` / `contracts/SHA256SUMS.json` — currently uncommitted; any matrix built now should note it's auditing a moving target and either wait for these to land or snapshot the exact dirty SHA (as `program-lock-facts.json` already does elsewhere in this repo).

## Approaches

1. **Extend `capability-manifest.yaml` with a `verificationLevel` field + an audit script, and directly correct the found contradictions** (README/ROADMAP wording, archive `pi-program-status-reconciliation`, refresh the two docs/architecture/ snapshots) as part of the same change.
   - Pros: matches the acceptance bar almost verbatim ("capability matrix with code/test references; each capability distinguishes implementation, simulation, and full validation"); reuses the repo's existing frozen-schema discipline (same pattern as `contracts/SHA256SUMS.json`); closes the systemic recurring-staleness problem instead of adding a fourth stale document.
   - Cons: highest effort; touches manifest schema + generator + several docs; likely needs chained/stacked PR slices under the 400-line review budget.
   - Effort: High.

2. **Hand-author a standalone `capability-matrix.md`** (e.g., under `docs/architecture/` or the change's `design.md`) with the matrix as one-time prose, without touching `capability-manifest.yaml`'s schema or adding tooling.
   - Pros: fastest; lowest risk; no schema/tooling change.
   - Cons: reproduces the exact failure mode already found three times in this repo (a hand-authored snapshot that goes stale within days); doesn't fix the systemic problem.
   - Effort: Low.

3. **Middle ground**: hand-author the matrix now (Approach 2) but make it explicitly point-in-time (tie it to a specific commit/dirty-SHA like `program-lock-facts.json` does), and open a *separate, explicitly scoped* follow-up item for the `capability-manifest.yaml` schema/tooling extension (Approach 1) rather than bundling both into one PR.
   - Pros: keeps this change's diff small and within the 400-line review budget; still resolves the concrete README/ROADMAP contradictions; defers the larger tooling investment to a deliberate follow-up instead of scope-creeping this change.
   - Cons: the matrix will still go stale eventually unless the follow-up actually lands; requires explicit tracking so the follow-up isn't silently dropped (matching what already happened to `pi-program-status-reconciliation`).
   - Effort: Medium.

## Recommendation

Approach 3. The deliverable bar ("capability matrix with code/test references...") is satisfiable now with a point-in-time matrix carrying explicit code:line/test-name citations (as demonstrated above for the sample already audited), and resolving the concrete README/ROADMAP/`pi-program-status-reconciliation`/`capability-manifest.yaml` contradictions is squarely in scope and low-risk. Bundling the full `capability-manifest.yaml` schema redesign into the same change risks a large diff and repeats this repo's own demonstrated pattern of ambitious one-shot audits that then go stale — better to land the matrix + contradiction fixes now, and track the tooling investment as an explicit, separate follow-up so it doesn't get silently dropped the way the prior reconciliation effort was.

## Risks

- Auditing against an actively-changing working tree: `lib/accounting-semantics.ts`, `lib/evidence-projection.ts`, and three `chains/*.ts` files are uncommitted right now; the matrix should either wait for this work to land or explicitly snapshot the dirty SHA it was audited against.
- Demonstrated recurring-staleness pattern (3 independent stale artifacts found in one pass) means any new matrix not backed by tooling will likely repeat the failure within weeks — flag this explicitly in the proposal rather than implying the new document is permanent.
- The SDD-020/configurator governance tension (README says gated, but `/drenyra:install`/`/drenyra:sync` are shipped) is a substantive claim conflict, not merely a doc-staleness issue, and needs an explicit human-owned resolution direction before the matrix can state a single unambiguous status for that row.
- No existing in-repo convention tags tests as unit/contract/e2e; that taxonomy needs to be defined from scratch in `sdd-spec`/`sdd-design`, using `__tests__/adapter-boundary-replacement.test.ts`'s full-cycle Pi-branch fixture (`runPiBranch`, close to "validated end-to-end" but still fixture/substitute-host, not a live network call to `drenyra-ai`) as the closest existing precedent for the "validated end-to-end" tier.
- Any capability gap that traces back to `drenyra-ai` itself (e.g., the absent model-routing enforcement API, `G30`) is out of scope for this drenyra-pi-only change (`allowedEditRoots` is drenyra-pi only) and must be recorded as an external finding for a drenyra-ai change, not resolved here.

## Ready for Proposal

Yes, with one process caveat already resolved: the sdd-explore phase agent could not persist this file directly (no Write/Edit tool in that execution context); the orchestrator persisted this content verbatim instead. Scope is well-bounded and evidence-backed (concrete file:line citations gathered above), the master-SDD linkage table already exists in README.md and should be reused verbatim, and the recommended approach is a point-in-time matrix + direct contradiction fixes now, with the `capability-manifest.yaml` tooling extension tracked as an explicit separate follow-up rather than bundled in.
