# Delta for Chains

## Verification Result: No Delta Required

This change (`pi-monthly-close-journey`) makes `chains/monthly-close.ts`'s
RECONCILE phase call real reconciliation logic instead of falling through to
a no-op `completeStep`. The existing main spec `openspec/specs/chains/spec.md`
already fully specifies this behavior. No `ADDED`/`MODIFIED`/`REMOVED`/
`RENAMED` requirement text is written by this change.

### Evidence

**REQ-CHAIN-001 — Monthly-close upgrade** (verbatim):

> The system MUST upgrade the monthly-close chain to: durable stores, real
> proposal creation with evidence binding (no hardcoded evidence hash),
> WAITING_FOR_EVIDENCE and BLOCKED_BY_GATE handling, and the full v0.1
> 12-step flow from company/period selection through export.

The requirement text names "the full v0.1 12-step flow," which includes the
`reconcile` and `verify` phases (`EDA_PHASE_ORDER` in
`lib/accounting-status.ts` lists `reconcile` and `verify` as two of the 13
canonical phases the monthly-close mission ships).

**SC-CHAIN-001 — Monthly-close happy path** (verbatim, the scenario tied to
REQ-CHAIN-001):

> GIVEN a company/period bound and fixture sources (balance, mayor,
> auxiliaries, bank movements)
> WHEN the monthly-close chain runs through all 12 steps
> THEN reconciliations run, anomalies are detected, evidence is requested
> and satisfied, a proposal is created with a real evidence hash, approval
> is recorded, a signed receipt is emitted, and results export

This scenario already requires — as testable, observable outcomes of one
monthly-close mission run — that reconciliations run and anomalies are
detected, that a real (non-hardcoded) evidence hash backs the proposal, and
that approval, receipt, and export all follow. A proposal's evidence hash
being "real" over cited evidence necessarily includes whatever evidence the
reconciliation step produces (including anomaly conclusions), so citing
reconciliation anomalies into the evidence graph is already implied WHAT,
not new WHAT.

**SC-CHAIN-004 — Gate-blocked close** already covers the R2-gate
fail-closed case this change's integration test must exercise as a negative
path:

> GIVEN a monthly-close mission at R2 without approval records
> WHEN the chain reaches the approval gate
> THEN it stops in BLOCKED_BY_GATE or AWAITING_APPROVAL and reports the
> required approval as the next action

### Why this is a conformance gap, not a spec gap

`chains/monthly-close.ts`'s `advance()` switch statement handles `INTAKE`,
`BIND_SCOPE`, `INGEST`, `PROPOSE`, `APPROVE`, `EXECUTE`, `CLOSE`, and
`ARCHIVE` explicitly; `RECONCILE` and `VERIFY` fall through to the
`default:` branch, which only calls phase-only `completeStep` — zero domain
computation. This is a real-code deviation from the already-declared
`REQ-CHAIN-001`/`SC-CHAIN-001` contract, not a case where the spec fails to
describe the required behavior.

### What this change adds beyond the spec (not spec-level)

The genuinely new artifact this change introduces — one multi-chain
integration test using the real `MissionRuntime`/`ApprovalGate`/receipts
stack (no mocks) that exercises SC-CHAIN-001 and SC-CHAIN-004 together in
one run, plus the `unit-or-contract-tested` (not `validated-end-to-end`)
manifest/matrix labeling — is a **verification method**, not new required
system behavior. Per the `sdd-spec` contract, specs describe WHAT the system
must do, not HOW conformance is proven or which test shape demonstrates it.
Mandating a specific test's construction or a documentation label belongs
to `tasks.md`/implementation, not to `chains/spec.md`.

### Scope guard

This delta intentionally specifies nothing about "exceptions"/"candidates"
structured concepts, dossier assembly, or `approverId` identity
verification — all explicitly out of scope per the proposal — and does not
represent this change as SDD-050 delivery.

## Conclusion

`openspec/specs/chains/spec.md` already fully covers the WHAT this change
must conform to. No delta requirements are added, modified, removed, or
renamed.
