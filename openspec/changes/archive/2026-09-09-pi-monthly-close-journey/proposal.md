# Proposal: Wire Real Reconciliation into the Monthly-Close Journey

## Intent

`chains/monthly-close.ts`'s RECONCILE phase is currently a no-op: it falls
through to phase-only `completeStep`, doing zero domain computation, even
though `chains/reconcile.ts` already contains real, tested bank-vs-ledger
logic (`computeReconcileDifferences`, `normalizeReferencedAmounts`).
Reconciliation and monthly-close are two disconnected chains today, not
stages of one pipeline — despite `chains/spec.md` (REQ-CHAIN-001,
SC-CHAIN-001) already requiring that the monthly-close flow performs
reconciliation with anomaly detection. The implementation does not yet
satisfy its own declared spec. This change closes that gap with one bounded,
real fix plus a genuine multi-chain integration test, and corrects doc prose
that currently overstates the tested flow.

**Master linkage**: SDD-050 (monthly close) is master-owned-only per
README's Dominion Program table (same bucket as SDD-070/080/090/110). This
change does **not** claim SDD-050 delivery. It composes existing Pi-served
SDD-040 RDA-v2 chain tooling (`monthly-close.ts`, `reconcile.ts`) into one
operator journey — mirroring how SDD #1 scoped SDD-020 (`/drenyra:install`
/`sync` as pre-Wave-1 scaffolding, not master delivery).

## Scope

### In Scope
- Wire `chains/monthly-close.ts`'s RECONCILE phase to call
  `chains/reconcile.ts`'s real `computeReconcileDifferences`/
  `normalizeReferencedAmounts` logic.
- Thread real reconciliation results (including `ReconcileDifference`
  anomalies) into the mission's evidence graph as real `CONCLUSION` nodes,
  matching `reconcile.ts`'s existing standalone pattern.
- Add one genuine multi-chain integration test (real
  `MissionRuntime`/`ApprovalGate`/receipts, temp-dir durable store, matching
  `monthly-close-flow.test.ts`'s style): sources → real reconciliation
  (≥1 deliberate anomaly) → evidence → proposal → approval (incl. existing
  R2-gate fail-closed negative case) → execution → verify.
- Update `capability-manifest.yaml` / `docs/architecture/capability-conformance-matrix.md`
  with an honest tag: `unit-or-contract-tested`, never `validated-end-to-end`.
- Correct `docs/architecture/harness-draft-conformance.md`'s DoD-row prose
  that overstates reconciliation as already part of the tested close flow.

### Out of Scope
- "Exceptions"/"candidates" structured multi-state concepts (`CandidateLifecycle`
  is unused in this repo; likely kernel-owned).
- Dossier/expediente assembly beyond the existing minimal
  `.local/exports/<mission-id>.json` pointer.
- `approverId` identity verification (accepted as a trusted string today —
  limitation stated, not fixed; likely kernel-owned).
- Any `drenyra-ai` runtime/contract change.
- Claiming SDD-050 delivery.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `chains`: no requirement TEXT change expected — REQ-CHAIN-001/SC-CHAIN-001
  already require reconciliation-with-anomaly-detection inside monthly-close;
  this change makes the implementation conform. `sdd-spec` should verify
  current wording already covers this; only add a scenario delta if it finds
  a genuine coverage gap for the new integration test.

## Approach

1. Add a callable seam in `reconcile.ts` (or reuse existing exports) so
   `monthly-close.ts`'s RECONCILE handler can invoke the same logic.
2. Replace the RECONCILE default-branch fallthrough with a real handler:
   compute differences, append `CONCLUSION` nodes citing source evidence,
   advance phase state based on real results (not unconditionally).
3. Write the multi-chain integration test alongside existing
   `monthly-close-flow.test.ts` conventions.
4. Update manifest/matrix and correct doc prose in the same change.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `chains/monthly-close.ts` | Modified | RECONCILE phase becomes real, not no-op |
| `chains/reconcile.ts` | Modified (seam) | Expose logic for reuse by monthly-close |
| `chains/__tests__/` | New | Multi-chain integration test |
| `capability-manifest.yaml` | Modified | Add/update honest verification-level entry |
| `docs/architecture/capability-conformance-matrix.md` | Modified | Same |
| `docs/architecture/harness-draft-conformance.md` | Modified | Correct DoD-row prose |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Uncommitted dependency: `chains/reconcile.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts` are concurrent-session work, not yet committed | High | Verify their current `bun test` suite passes before building on them; this change's eventual commit must include those files + their existing tests as one package (see Dependencies) |
| Behavior change on live command `/drenyra:close` (RECONCILE goes from no-op to real computation) | Medium | Bounded handler change only; no phase-order or gate semantics change; rollback plan below |
| Review budget (400 lines) likely exceeded (new test + wiring + doc fixes ≈ 300–450 lines) | Medium | Session already caches `delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main`; `sdd-tasks` should slice into deliverable, independently-verifiable units if forecast is High |
| Inventing kernel-owned semantics (exceptions/candidates) under pressure | Low (mitigated by scope) | Explicitly deferred as tracked follow-ups, not invented here |

## Rollback Plan

Revert `chains/monthly-close.ts`'s RECONCILE handler to the prior no-op
`completeStep` call. No data or schema migration is needed: the evidence
graph is append-only, so any `CONCLUSION` nodes added by the new logic are
additive and safe to leave in place or ignore; no reconciliation-derived
state is written outside the evidence graph and receipts.

## Dependencies

- `chains/reconcile.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts`
  are currently **uncommitted** work from a concurrent session. This change
  depends on them but does not author them. Before building on them: verify
  their existing test suite (`bun test`) currently passes. At apply/commit
  time, this change's commit must include those files and their existing
  tests as part of the same commit — code that calls into uncommitted files
  would otherwise be incomplete/broken on its own.

## Success Criteria

- [ ] `chains/monthly-close.ts`'s RECONCILE phase calls real
      `computeReconcileDifferences`/`normalizeReferencedAmounts` logic
- [ ] Reconciliation anomalies appear as cited `CONCLUSION` nodes in the
      mission's evidence graph
- [ ] New multi-chain integration test passes: sources → real reconcile
      (with ≥1 anomaly) → evidence → proposal → approval (incl. R2-gate
      fail-closed case) → execution → verify
- [ ] `capability-manifest.yaml`/conformance matrix reflect
      `unit-or-contract-tested`, not `validated-end-to-end`
- [ ] `harness-draft-conformance.md` DoD-row prose no longer overstates
      tested reconciliation coverage
- [ ] Full `bun test` suite (existing 582 + new tests) passes
