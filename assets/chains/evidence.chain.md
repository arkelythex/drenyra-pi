---
name: evidence
description: Operator map for the evidence chain — append-only add-node/add-edge operations and read-only query-node/query-lineage operations bound to the mission graph.
---

## evidence chain operator map

The evidence chain operates the mission evidence graph: append-only mutation
operations and read-only query operations. The graph stays bound to the
mission: cross-mission edges are rejected (design §7.2).

## add-node

output: graph node
progress: true

Append one node (source | transformation | conclusion | action) with a
canonical payload hash. A conclusion without cited source/transformation
nodes is rejected (REQ-EVID-004).

## add-edge

reads: graph nodes
output: graph edge
progress: true

Append one directed lineage edge (DERIVED_FROM | SUPPORTS | EXECUTES) between
existing nodes. Cycles, dangling endpoints, and terminal-position violations
are rejected; duplicate ids must be byte-identical or they block.

## query-node

reads: graph node
output: queried node
progress: true

Read one node by id. Queries are read-only and never mutate the graph.

## query-lineage

reads: graph lineage
output: lineage
progress: true

Return the full source -> transformation -> conclusion -> action lineage for a
node. Queries are read-only; an unreadable or corrupted graph fails closed
rather than returning partial lineage.
