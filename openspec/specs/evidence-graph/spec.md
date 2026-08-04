# Evidence Graph Specification

## Purpose

Defines the provenance graph model `source → transformation → conclusion → action`, the payload-hash integrity of every node, the evidence-citation rule, and the append-only behavior of the graph within a mission. The graph is the durable "verdad contable" trail that receipts and conclusions bind to.

## Requirements

### Requirement: REQ-EVID-001 — Graph node kinds

The system MUST model evidence graphs with four node kinds: source, transformation, conclusion, and action.

### Requirement: REQ-EVID-002 — Provenance edges

The system MUST record directed edges that express lineage (for example source→transformation, transformation→conclusion, conclusion→action) and MUST make the full lineage of any node traversable.

### Requirement: REQ-EVID-003 — Payload hashes

The system MUST attach a lowercase hex SHA-256 payload hash to every graph node, computed over that node's canonical payload.

### Requirement: REQ-EVID-004 — Evidence citation rule

The system MUST require every conclusion node to cite at least one source or transformation node, and MUST reject conclusions with no cited evidence.

### Requirement: REQ-EVID-005 — Append-only per mission

The system MUST treat the graph as append-only within a mission: nodes and edges may only be added, never mutated or removed in place.

### Requirement: REQ-EVID-006 — Receipt-bound evidence hash

The system MUST compute the receipt evidence hash with the engine's id-sorted `computeEvidenceHash` so the same evidence set always yields the same hash regardless of insertion order.

### Requirement: REQ-EVID-007 — Action traceability

The system MUST ensure every recorded action node references its supporting conclusion and the evidence chain it executes, making source→action traceability complete.

### Requirement: REQ-EVID-008 — Integrity validation

The system MUST validate graph integrity by recomputing node payload hashes and MUST fail closed when any hash does not match its node content.

## Scenarios

#### Scenario: SC-EVID-001 — Full lineage traversable

- GIVEN a graph with source, transformation, conclusion, and action nodes
- WHEN the lineage of the action node is traversed
- THEN all four nodes are reachable in order

#### Scenario: SC-EVID-002 — Uncited conclusion rejected

- GIVEN a conclusion node with no cited source or transformation
- WHEN the conclusion is added to the graph
- THEN it is rejected with an evidence-citation error

#### Scenario: SC-EVID-003 — Tampered node detected

- GIVEN a graph whose node content was altered after insertion
- WHEN integrity validation runs
- THEN validation fails and identifies the tampered node

#### Scenario: SC-EVID-004 — Append-only enforced

- GIVEN an existing graph node
- WHEN an attempt is made to mutate or remove it in place
- THEN the operation is rejected; new content is added as new nodes

#### Scenario: SC-EVID-005 — Hash order stability

- GIVEN the same evidence set inserted in two different orders
- WHEN `computeEvidenceHash` runs on both
- THEN both hashes are identical

## Out of Scope

Cross-mission graph traversal and multi-tenant graph stores; v0.1 graphs are per-mission only.
