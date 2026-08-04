---
name: monthly-close
description: Operator map for the monthly-close chain — the 13-phase EDA close flow over durable mission stores with R2 approval.
---

## monthly-close chain operator map

The monthly-close chain runs the full 13-phase EDA plan for the `monthly-close`
intent over the durable mission stores. Each `/drenyra:continue` advances
exactly one phase; the runtime decides RUN / SKIP / WAIT from persisted state,
never from chat.

## intake

output: mission snapshot
progress: true

Start the mission: create the durable mission for the bound company + fiscal
period with the full 13-step plan, the bound authority mode, and the source
references.

## bind-scope

reads: mission snapshot
output: scope binding
progress: true

Bind the canonical scope. The scope hash is computed from all ten elements;
a stale scope invalidates the prepared step before any write.

## ingest

reads: scope binding
output: ingested sources
progress: true

Ingest the bounded source manifest (balances, mayor, auxiliaries, bank) into
BigInt cents at the JSON boundary. No floats are ever used for money.

## normalize

reads: ingested sources
output: normalized records
progress: true

Deterministic normalization: canonical encoding, stable hashes, ledger-book
classification. Normalization output is deterministic and reproducible.

## classify

reads: normalized records
output: classified movements
progress: true

Classify movements by ledger book and operation type within the bound scope.
Unknown classifications block rather than degrade.

## reconcile

reads: classified movements
output: reconciliation differences
progress: true

Reconcile ledger vs bank and auxiliary references. Discrepancies become
evidence-cited anomalies with DERIVED_FROM edges to their sources.

## investigate

reads: anomalies
output: evidence wait or resolution
progress: true

Unproven discrepancies wait for evidence (WAITING_FOR_EVIDENCE, never
auto-advanced). Evidence satisfaction resumes investigation; refutation
before elevation applies to every anomaly.

## propose

reads: evidence + investigation
output: evidence-cited proposal
progress: true

Build the proposal with a real evidence hash and a quantified difference.
The proposal is candidate-only: it never posts anything.

## approve

reads: proposal
output: approval gate decision
progress: true

The R2 approval gate requires explicit materiality and an explicit human
approver. Without approval the mission reports POLICY_GATE / AWAITING_APPROVAL
and no phase advances.

## execute

reads: approval
output: executed target
progress: true

Execute only the approved target, bound to mission, evidence, scope, and the
approved receipt. No execute without approval; no approval without receipts.

## verify

reads: executed records
output: integrity verdicts
progress: true

Run the read-only integrity checks: source integrity, ledger equations,
reconciliation correctness, graph integrity, scope binding, receipt binding.
First failing verdict stops protected work.

## close

reads: verify verdicts
output: signed close receipt
progress: true

Seal the close: persist the signed completion receipt and the export
artifact. The close receipt never self-authorizes its own action.

## archive

reads: close receipt
output: archived mission
progress: true

Archive the closed mission. Closed periods are final: corrections are new
`correction` missions, never silent rewrites.
