---
name: evidence-citation
description: "Drenyra evidence citation: cite evidence-graph node ids for every conclusion, follow the source-to-action lineage, and verify payload hashes."
license: Apache-2.0
metadata:
  author: drenyra-pi
  version: "0.1"
  layer: foundation
  jurisdiction: global
---

# Evidence Citation

Every conclusion in the evidence-driven accounting harness must cite
evidence-graph node ids. An uncited conclusion is not a finding — it is a
question to be investigated.

## When to use

Load this skill before producing any analysis, reconciliation difference,
proposal, compliance finding, or close-readiness conclusion.

## Node kinds and lineage

The graph has four node kinds:

```text
source -> transformation -> conclusion -> action
```

- `source`: a frozen input record (ledger entry, bank statement line, file).
- `transformation`: a deterministic computation over sources.
- `conclusion`: an interpretation that MUST cite its supporting nodes.
- `action`: a proposed or executed operation that MUST trace to a conclusion.

Edges are directed: `DERIVED_FROM`, `SUPPORTS`, `EXECUTES`. Sources are
roots; actions are terminal. Cross-mission edges are rejected.

## Citation rule

1. Every conclusion cites at least one source or transformation node id.
2. Every action node references a supporting conclusion with a complete
   source -> action lineage.
3. A conclusion without citations is rejected at the graph boundary.
4. An anomaly must be refuted before it is elevated; the refutation cites the
   finding's lineage.

## Verify integrity

- Every node carries a lowercase hex sha-256 payload hash over its canonical
  payload (BigInt cents serialize as JSON integers; floats are rejected).
- Recompute hashes before trusting a node. A tampered or truncated graph is
  unavailable for authority decisions — never work from a corrupted graph.
