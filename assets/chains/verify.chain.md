---
name: verify
description: Operator map for the read-only integrity verify chain — source integrity, normalization, ledger equations, reconciliation, graph integrity, scope and receipt binding.
---

## verify chain operator map

The verify chain is a read-only integrity chain: it never mutates accounting
outputs (REQ-AUTH-009). It runs fixed checks with per-check verdicts; the
first blocking verdict stops protected downstream work (SC-CHAIN-003).

## intake

output: verify mission
progress: true

Start the verify mission bound to the current scope. The verify chain
completes as a state record; the EXECUTE-family ceremony is not applicable.

## source-integrity

reads: source manifest digest
output: integrity verdict
progress: true

Recompute the source manifest digest and compare it to the bound scope hash.
A mismatch blocks with a source-integrity failure and no further stage runs.

## normalization

reads: source manifest
output: normalization verdict
progress: true

Verify deterministic normalization: canonical encoding and BigInt-cent
boundary rules hold; floats are absent.

## ledger-equations

reads: normalized records
output: equation verdict
progress: true

Verify ledger equations with BigInt cents: debits equal credits per book,
totals balance. Any imbalance is a failing verdict.

## reconciliation-correctness

reads: reconciliation result
output: correctness verdict
progress: true

Verify reconciliation correctness: quantified differences match the bound
reconciliation result and its evidence.

## graph-integrity

reads: evidence graph
output: graph verdict
progress: true

Verify the evidence graph: every payload hash recomputes, lineage rules hold,
and no tampered or truncated record exists. A corrupted graph fails closed.

## scope-binding

reads: scope binding
output: binding verdict
progress: true

Verify the scope binding: all ten canonical elements present and the scope
hash matches the mission binding.

## receipt-binding

reads: receipts
output: receipt verdict
progress: true

Verify receipt binding: the persisted completion receipt binds mission,
evidence hash, scope hash, and executed target. A mismatch is a failing
verdict.
