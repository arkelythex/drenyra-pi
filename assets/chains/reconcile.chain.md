---
name: reconcile
description: Operator map for the reconciliation chain — ingest, normalize, detect evidence-cited anomalies, wait for evidence, and raise a proposal (intent reconciliation).
---

## reconcile chain operator map

The reconciliation chain runs for the `reconciliation` intent through the
shared chain pipeline. It detects discrepancies, proves them with evidence,
and raises an evidence-cited proposal. It can never post adjustments
(REQ-AUTH-009).

## ingest

output: bounded source manifest
progress: true

Ingest the bounded source manifest (bank + ledger references). The manifest
boundary is enforced: only declared references enter the chain.

## normalize

reads: source manifest
output: normalized references
progress: true

Deterministic normalization into BigInt cents at the boundary. Float money is
rejected; canonical hashes are stable.

## reconcile

reads: normalized references
output: reconciliation result
progress: true

Match bank and ledger references; compute quantified differences per
reference. Matching uses stable references, never ambient runtime lookup.

## investigate

reads: reconciliation result
output: anomaly or evidence wait
progress: true

Every discrepancy becomes an evidence-cited anomaly (conclusion node with
DERIVED_FROM edges to its sources). Unproven discrepancies wait for evidence
(WAITING_FOR_EVIDENCE); the chain never auto-advances a wait.

## propose

reads: evidence + anomalies
output: evidence-cited proposal
progress: true

After evidence, resume and raise a proposal quantifying the difference and the
resolution path, citing the supporting evidence node ids. The proposal is
candidate-only.

## close

reads: proposal
output: signed completion receipt
progress: true

Close the reconciliation mission with a signed completion receipt bound to
mission, evidence, scope, and the executed target.
