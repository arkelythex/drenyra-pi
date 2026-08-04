# /drenyra:reconcile

Run the reconciliation chain for the current scope: ingest the bounded source
manifest, detect bank-vs-ledger discrepancies as evidence-cited anomalies,
wait for evidence, and raise an evidence-cited proposal.

## Output

- The chain outcome: mission, phase, and status. Denied below the ANALYZE
  authority minimum; malformed manifests are rejected without running.
