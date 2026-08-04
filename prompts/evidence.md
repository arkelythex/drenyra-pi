# /drenyra:evidence

Run one bounded evidence operation against the target mission's evidence
graph.

## Operations

- `add-node` / `add-edge` — append-only graph mutations with citation and
  lineage rules (a conclusion without citations is rejected).
- `query-node` / `query-lineage` — read-only queries returning the node or
  the full source-to-action lineage.

## Output

- The operation outcome, mission, phase, and the affected node or lineage.
  Structured JSON plus a human summary.
