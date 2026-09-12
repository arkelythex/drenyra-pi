# Evidence Graph Specification

## Purpose

Defines Drenyra Pi's frozen v0.1 evidence-record boundary: the `schemaVersion: 1` provenance graph model `source → transformation → conclusion → action`, payload-hash integrity, citation rules, and append-only behavior within one mission. These are Pi-local persisted records consumed by the harness; external Dominion/Drenyra AI evidence hashing and authority semantics remain external contracts and are not redefined here.

## Compatibility boundary

The shipped graph, node, and edge schemas use JSON Schema Draft 7 and require `schemaVersion: 1`. Changing record fields, node or relation enums, canonical payload-hash rules, or the version marker is a compatibility change. Incompatible documents fail closed. This documentation freeze does not alter schema bytes, so it requires neither a version bump nor a migration.

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

The system MUST consume the pinned engine's public id-sorted `computeEvidenceHash` behavior so the same evidence set yields the same hash regardless of insertion order. Pi MUST NOT copy or redefine that engine algorithm as a local contract.

### Requirement: REQ-EVID-007 — Action traceability

The system MUST ensure every recorded action node references its supporting conclusion and the evidence chain it executes, making source→action traceability complete.

### Requirement: REQ-EVID-008 — Integrity validation

The system MUST validate graph integrity by recomputing node payload hashes and MUST fail closed when any hash does not match its node content.

## Scenarios

### Scenario: SC-EVID-001 — Full lineage traversable

- GIVEN a graph with source, transformation, conclusion, and action nodes
- WHEN the lineage of the action node is traversed
- THEN all four nodes are reachable in order

### Scenario: SC-EVID-002 — Uncited conclusion rejected

- GIVEN a conclusion node with no cited source or transformation
- WHEN the conclusion is added to the graph
- THEN it is rejected with an evidence-citation error

### Scenario: SC-EVID-003 — Tampered node detected

- GIVEN a graph whose node content was altered after insertion
- WHEN integrity validation runs
- THEN validation fails and identifies the tampered node

### Scenario: SC-EVID-004 — Append-only enforced

- GIVEN an existing graph node
- WHEN an attempt is made to mutate or remove it in place
- THEN the operation is rejected; new content is added as new nodes

### Scenario: SC-EVID-005 — Hash order stability

- GIVEN the same evidence set inserted in two different orders
- WHEN `computeEvidenceHash` runs on both
- THEN both hashes are identical

## Out of Scope

External engine evidence contracts or authority decisions, cross-mission graph traversal, and multi-tenant graph stores; v0.1 Pi graphs are per-mission only.
