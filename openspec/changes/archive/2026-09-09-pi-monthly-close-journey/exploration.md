# Exploration: pi-monthly-close-journey

Phase: sdd-explore. Audited against dirty working tree, drenyra-shell @ main, 2026-09-09.

## Master linkage (CRITICAL — verbatim from README)

README's Dominion Program table states: *"The master owns the full program catalog — SDD-010 (ecosystem contracts / release train), SDD-050 (monthly close), SDD-070 (skills), SDD-080 (Engram memory), SDD-090 (Guardian), SDD-110 (production), plus SDD-000/060/100 — which Drenyra Shell references only and never duplicates."*

SDD-050 (monthly close) sits in the **master-owned-only, referenced-not-duplicated** bucket — the same bucket as SDD-070/080/090/110 — and is explicitly **not** in the Pi-served bucket (SDD-020 configurator, SDD-030 routing, SDD-040 RDA v2).

This is sharpened further by `docs/architecture/harness-draft-conformance.md`: a historical draft once reused the `SDD-050` label for the Pi harness itself, and the doc explicitly reconciles this — *"the master assigns SDD-050 to monthly close, and the harness was delivered via `pi-sdd-010-participation` + extraction"* (i.e., `chains/monthly-close.ts` traces to SDD-040/adapter-boundary lineage, not to SDD-050 delivery), adding: *"this repository never re-numbers or re-defines a master SDD."*

**Consequence**: a change literally named `pi-monthly-close-journey` risks implicitly claiming SDD-050 delivery, which the repo explicitly forbids. This is the same tension class SDD #1 found for SDD-020 (`/drenyra:install`/`sync` = "pre-Wave-1 scaffolding", not master delivery). **This must be explicitly resolved and scoped before `sdd-propose`** — frame any proposal as Pi-local RDA-v2/SDD-040 tooling that composes existing chains into one operator journey, never as delivering master SDD-050.

## Current State — stage by stage (file:line evidence)

1. **Sources**: Still no first-class representation. `sourceRefs` remains an opaque `string[]` threaded through (`chains/monthly-close.ts:92,222,353,424`; `lib/mission-commands.ts:96,261`); `sourceSnapshot` remains a single opaque hex-64 hash checked in `chains/verify.ts` `checkSourceSnapshotIntegrity`. SDD #2's finding is reconfirmed true, unchanged.

2. **Reconciliation**: `chains/reconcile.ts` is real, unit/contract-tested bank-vs-ledger matching (`computeReconcileDifferences`, `normalizeReferencedAmounts`, BigInt cents throughout) — not a stub, confirmed by `chains/__tests__/reconcile.test.ts`. But it runs as a **separate mission/chain** (intent `"reconciliation"`) wired to its own `/drenyra:reconcile` command (`extensions/register.ts:1092,1127,1433`), with **zero cross-wiring** to `MonthlyCloseChain`.

3. **Exceptions**: No distinct stage or concept exists. Anomalies (`ReconcileDifference`) are simply the `RECONCILE` phase's own output field inside `chains/reconcile.ts`, appended as evidence `CONCLUSION` nodes with a `WARNING`/`ERROR` blocker — folded entirely into reconciliation's output, never a first-class "exceptions" stage.

4. **Candidates**: `drenyra-ai/candidates` supplies only `Materiality`/`MaterialityInput`/`deriveMateriality` (materiality-tier gating), consumed by `lib/authority-gates.ts:28-29` and `chains/monthly-close.ts:62`. `CandidateLifecycle` (propose → inspect → submitForReview → accept/reject/correct, noted in the archived 2026-08-04 evidence-driven-accounting-harness exploration) exists in the pinned package but has **zero production or test usage anywhere in drenyra-shell** — grep confirmed only a `node_modules` package test and the archived doc reference it. The closest analog is `mission.proposal` (`buildProposal` in `monthly-close.ts`/`reconcile.ts`), a flat summary+evidenceHash bundle, not a structured multi-state candidate.

5. **Review**: `chains/verify.ts` is the closest bounded-review mechanism — a fixed 7-check list (`source-integrity`, `normalization`, `ledger-equations`, `reconciliation-correctness`, `graph-integrity`, `scope-binding`, `receipt-binding`), read-only (`readOnly: true`), first blocking verdict throws `VerifyChainBlockedError` (no further stages run). It is its own separate mission/chain, invoked explicitly via `/drenyra:verify` or directly from tests — never auto-run inside the monthly-close journey.

6. **Decision**: `ApprovalGate` (`drenyra-ai/gates`) plus an explicit `approverId` is the real decision-capture point (`chains/monthly-close.ts:399-409,570-599,615-687`), distinct from execution (`CLOSE` phase). The R2 gate blocks to `BLOCKED_BY_GATE` with zero phase advance until a real approver is supplied — confirmed fail-closed by test (`monthly-close-flow.test.ts:255-281`).

7. **Authorized execution**: `MonthlyCloseChain` is confirmed real and wired to `/drenyra:close <approverId>`. "Authorized" here means an `ApprovalGate.evaluate()` verdict gated by `deriveRequiredMateriality` (R2 floor) plus a **non-empty `approverId` string** (`chains/monthly-close.ts:399-403`, `makeApproval`). There is **no check that the approverId corresponds to a real, authenticated identity** — it is accepted as a trusted caller-supplied string. Fiscal authority is asserted to live in `drenyra-ai`, but approver-identity verification itself is not visibly performed anywhere in this repo.

8. **Case file / dossier**: The closest artifact is the export written at `.local/exports/<mission-id>.json` (`chains/monthly-close.ts:742-756`), but it is minimal: `{schemaVersion, kind, missionId, evidenceHash, receiptHash}` only. It does **not** assemble the full evidence graph, reconciliation anomalies, or the approval record into one document — evidence stays scattered across the evidence-graph ndjson log, the receipt store, and this thin export pointer. No "expediente" concept exists that aggregates preparation + approval + execution into one retrievable record.

## Critical cross-stage finding: the RECONCILE phase inside monthly-close is a no-op

`chains/monthly-close.ts`'s own header comment lists "reconcile" among *"steady-state phases that keep the lifecycle RUNNING... advance as phase-only progress updates."* Confirmed in code: both the intent handler's switch (`buildRegistry`) and the `advance()` switch explicitly implement only `INTAKE`, `BIND_SCOPE`, `INGEST`, `PROPOSE`, `APPROVE`, `EXECUTE`, `CLOSE`, `ARCHIVE`. `RECONCILE` (and `NORMALIZE`/`CLASSIFY`/`INVESTIGATE`/`VERIFY`) fall through to the default branch, which does `completeStep(m, prepared.phase, "COMPLETED")` with **zero domain computation**.

This means the monthly-close journey's own "reconciliation" step never calls `chains/reconcile.ts`'s real bank-vs-ledger logic — reconciliation and monthly-close are two disconnected chains, not stages of one pipeline, despite both being part of the same conceptual "recorrido contable." `docs/architecture/harness-draft-conformance.md`'s DoD row #5 prose (*"bound → ingest → reconcile → evidence → proposal → ..."*) is misleading against this: `monthly-close-flow.test.ts` never exercises real reconciliation logic — it injects evidence source nodes directly via the evidence chain, bypassing `computeReconcileDifferences` entirely.

## Evidence-bar assessment (rigorous standard, matching SDD #4's bar)

`chains/__tests__/monthly-close-flow.test.ts` **is** a genuine multi-stage integration test using the real runtime (`MonthlyCloseChain`, `runChainStep` with real `evidenceChain`/`verifyChain`, real `EvidenceGraphStore`, real `ReceiptStore`, real `drenyra-ai` `MissionRuntime`/`ApprovalGate`/receipts) over a temp-dir durable store — not mocks/stubs at the domain-logic level. It distinguishes preparation (proposal with a real `evidenceHash`), approval (explicit `approverId` + R2 gate + a `BLOCKED_BY_GATE` negative-path test), and execution (signed receipt + export artifact), and closes with a real `verifyChain` pass asserting `graph-integrity` and `receipt-binding` checks pass. This is real, credible end-to-end evidence **for the monthly-close chain in isolation**.

It does **not**, however, satisfy the full "recorrido contable completo" bar as literally stated:
- It never invokes `chains/reconcile.ts`'s real anomaly-detection logic (RECONCILE is a no-op inside monthly-close; reconcile.ts has its own, never-cross-tested suite).
- There is no "exceptions" or "candidates" concept to exercise (none exists).
- No test runs one task through sources → reconcile → exceptions → candidate → review(verify) → decision → execution → dossier as **one continuous pipeline** across the two disconnected chains. The closest the repo has is two separately, individually tested chains that never call each other in any test or production path.

Per this repo's own `capability-conformance-matrix.md` taxonomy, this stays at `unit-or-contract-tested` (in-process fixture), never `validated-end-to-end` — the matrix already says so explicitly for `rda-chains`.

## Affected Areas

- `chains/monthly-close.ts` — RECONCILE phase is a no-op; wiring real reconciliation here changes a live, tested command path (`/drenyra:close`).
- `chains/reconcile.ts` — real logic exists but is isolated; would need a callable seam for monthly-close to reuse.
- `chains/verify.ts` — candidate "review" stage; currently a separate command, not embedded in the close journey.
- `lib/evidence-projection.ts` / `lib/evidence-status.ts` — closest existing machinery for an eventual dossier/expediente assembly, but currently produce per-node provenance projections, not a single case-file document.
- `capability-manifest.yaml` / `docs/architecture/capability-conformance-matrix.md` — no `monthly-close-journey` row exists; any new claim needs an honest verification-level tag (almost certainly `unit-or-contract-tested` at best).
- README's Dominion Program table / `docs/architecture/harness-draft-conformance.md` — the SDD-050 ownership boundary must be referenced, not re-negotiated, by any proposal.

## Approaches

1. **Wire real reconcile logic into monthly-close's RECONCILE phase, and add one continuous multi-chain journey test.** Compose `computeReconcileDifferences` into the monthly-close intent handler's RECONCILE case; add a new integration test driving sources → real reconciliation → anomaly evidence → proposal → approval → close → verify → (new) assembled dossier export, all via the real runtime.
   - Pros: closes the literal architectural gap; makes the "recorrido contable completo" claim genuinely defensible; reuses already-correct, tested primitives (reconcile logic, evidence graph, verify checks).
   - Cons: highest effort; touches a live command path (`/drenyra:close`) with real behavior-drift risk; still leaves "candidates"/"exceptions" as undefined first-class concepts unless separately scoped; risks a large diff exceeding the 400-line review budget.
   - Effort: High.

2. **Document the gap honestly (capability-matrix-style) without touching the live monthly-close chain.** Add a `monthly-close-journey` row stating precisely what is real (each chain individually) vs. disconnected (reconcile/verify never called from within monthly-close); no code change.
   - Pros: low risk, fast, matches the pattern already established for `pi-capability-conformance` and `pi-accounting-orchestration`.
   - Cons: does not deliver the user's stated acceptance bar at all — it only documents the gap; risks becoming a fifth stale point-in-time artifact if not tied to a tracked follow-up.
   - Effort: Low.

3. **Middle ground: wire reconcile into monthly-close's RECONCILE phase only (smallest real architectural fix), add a targeted multi-chain test covering sources→reconcile→evidence→propose→decision→execute, and explicitly defer "candidates"/"exceptions" as first-class concepts plus dossier assembly as tracked follow-ups.** Do not invent candidate/exception semantics that may belong to the kernel.
   - Pros: bounded, reviewable diff; closes the single most damaging finding (reconcile is a no-op inside the close journey) with real evidence; avoids inventing kernel-owned concepts under time pressure; consistent with this repo's demonstrated pattern (SDD #1 Approach 3, SDD #3 Approach 3) of landing real, bounded progress plus an explicit, tracked gap rather than either overclaiming or only documenting.
   - Cons: still does not close the "candidates"/"exceptions"/"dossier" gaps; needs explicit user sign-off that this reduced scope is acceptable against the literal 8-stage acceptance bar.
   - Effort: Medium.

## Recommendation

Approach 3, contingent on first resolving the SDD-050 master-ownership framing explicitly with the user/orchestrator (this change must state it composes existing SDD-040 chain tooling into one operator journey, and does **not** claim SDD-050 delivery). Approach 1 is the only way to fully satisfy the literal acceptance bar but requires inventing kernel-adjacent concepts (candidates, exceptions) under exploration-phase time pressure — exactly the trap the `pi-skills-memory-integration` preproposal already flagged for a different domain. Approach 2 under-delivers against the user's explicit bar of an integral test with distinguishable preparation/approval/execution. Approach 3 makes the single most consequential architectural fix (reconcile actually runs inside the close journey) with real, checkable evidence, while keeping "candidates"/"exceptions"/"dossier" as named, tracked, not-silently-dropped follow-ups.

## Risks

- The SDD-050 ownership tension is unresolved and should block `sdd-propose` until the user/orchestrator explicitly scopes this change as non-SDD-050-claiming (same governance pattern already required for SDD-020).
- Wiring reconcile's real logic into monthly-close's RECONCILE phase changes behavior on a live, tested command path (`/drenyra:close`) — needs careful scoping to avoid silently altering `MonthlyCloseChain`'s existing one-phase-per-advance semantics.
- "Candidates" and "exceptions" as first-class concepts do not exist in this codebase or, as far as this exploration found, are only partially exposed by the kernel (`CandidateLifecycle` unused, materiality-only consumption today); inventing Pi-local semantics for them risks the same "Pi must never invent fiscal dates/mappings/optionality that belong to the kernel" failure mode the `pi-skills-memory-integration` preproposal already flagged for a different domain.
- The approverId-as-trusted-string authorization gap (no identity verification visible in this repo) may be out of scope (kernel-owned), but any proposal claiming "authorized execution" should state this limitation explicitly rather than silently implying identity verification exists.
- `docs/architecture/harness-draft-conformance.md`'s own DoD-row prose overstates what `monthly-close-flow.test.ts` actually exercises (it implies "reconcile" is part of the tested flow when the real reconciliation computation is never invoked) — this drift should be corrected as part of any change that touches this area, not left to compound further.

## Ready for Proposal

Yes, with one explicit scope decision the orchestrator/user must confirm before `sdd-propose`: whether this change (a) fully wires reconcile into the monthly-close journey plus invents candidate/exception concepts and a dossier assembly in one pass (Approach 1, high effort, risks inventing kernel-owned semantics), or (b) makes the single bounded architectural fix (real reconcile-in-close-journey) plus one genuine multi-chain integration test, with candidates/exceptions/dossier explicitly named as tracked follow-ups (Approach 3, recommended). Either way, the SDD-050 master-ownership framing must be resolved first and stated explicitly in the proposal.
