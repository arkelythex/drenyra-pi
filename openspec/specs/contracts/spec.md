# Contracts Specification

## Purpose

Defines the four frozen v0.1 Pi-local JSON Schema families — mission, evidence, authority, and receipts — used to validate documents the harness consumes, persists, or projects. These schemas are Drenyra Pi conformance/adaptation boundaries, not copies or redefinitions of external Dominion/Drenyra AI engine contracts. The pinned `drenyra-ai@0.4.1` public exports remain authoritative for engine semantics; the harness never deep-imports unexported surfaces.

## Version and ownership

| Family | Pi-local version marker | Pi boundary |
| --- | --- | --- |
| Mission | Family v0.1; engine-shaped documents carry their exported version/sequence fields rather than a Pi wrapper version | Validate consumed snapshots, steps, statuses, and events |
| Evidence | Family v0.1; graph, node, and edge records use `schemaVersion: 1` | Persist and validate Pi evidence graph records |
| Authority | Family v0.1; authorization records use `schemaVersion: 1` | Validate canonical scope and authorization records before local use |
| Receipts | Family v0.1; `ReceiptBinding.version` is `drenyra.receipt-binding.v1`, trusted-key registries use `schemaVersion: 1`, and consumed signed receipts use engine protocol `1.0` | Adapt local binding/trust data and validate receipts produced by the pinned engine |

Changing accepted fields, enum values, schema identifiers, hash constraints, or any version marker is a compatibility change. A breaking change requires a family version bump and migration note. This specification freeze changes documentation and tests only; schema bytes and accepted shapes remain unchanged, so no bump or migration is required.

## Requirements

### Requirement: REQ-CONTRACTS-001 — Mission contract family

The system MUST ship a frozen v0.1 JSON Schema mission consumption family under `contracts/mission/` covering the exported mission statuses, steps, snapshots, and events that Pi accepts. Mission transition semantics remain owned by the external engine; Pi MUST NOT redefine them.

### Requirement: REQ-CONTRACTS-002 — Evidence contract family

The system MUST ship a frozen v0.1 Pi-local JSON Schema evidence family under `contracts/evidence/` covering `schemaVersion: 1` graph nodes, edges, and payload-hash fields, and MUST validate evidence-graph documents against it.

### Requirement: REQ-CONTRACTS-003 — Authority contract family

The system MUST ship a frozen v0.1 Pi-local JSON Schema authority family under `contracts/authority/` covering the four consumed authority modes (ASK, ANALYZE, PREPARE, EXECUTE), the 10-element scope record, and `schemaVersion: 1` authorization records. Gate evaluation and authorization semantics remain engine-owned.

### Requirement: REQ-CONTRACTS-004 — Receipt contract family

The system MUST ship a frozen v0.1 Pi-local receipt adaptation family under `contracts/receipts/`. Pi owns its `drenyra.receipt-binding.v1` binding and trusted-key registry documents; its SignedReceipt schema validates the public shape produced by the pinned engine protocol `1.0` without claiming ownership of signing, cryptography, or protocol semantics.

### Requirement: REQ-CONTRACTS-005 — Trusted-key registry schema

The system MUST ship a trusted-key registry schema matching the engine `SigningKeyInfo` (keyId, publicKey, issuedAt, optional expiresAt, optional revokedAt) and MUST validate registry entries against it before a key is trusted for receipt verification.

### Requirement: REQ-CONTRACTS-006 — Consumer-only discipline

The harness contract families MUST treat pinned public Drenyra AI exports as the source of truth for external semantics, MUST NOT deep-import unexported implementation files, and MUST NOT present Pi-local adapters as authoritative external Dominion/Drenyra AI contracts.

### Requirement: REQ-CONTRACTS-007 — Versioned and tested schemas

Every Pi-local contract family MUST declare its compatibility marker and frozen status. Conformance tests MUST validate representative valid documents and reject tampered/malformed and incompatible documents for each family.

### Requirement: REQ-CONTRACTS-008 — No float money in schemas

Schema definitions for monetary fields MUST declare money as BigInt cents (JSON integer or decimal string) and MUST reject floating-point representations.

## Scenarios

### Scenario: SC-CONTRACTS-001 — Mission snapshot validates

- GIVEN a mission snapshot fixture with status, steps, blockers, and events
- WHEN it is validated against the mission contract family
- THEN it passes without errors

### Scenario: SC-CONTRACTS-002 — Evidence graph validates

- GIVEN an evidence graph document with nodes, edges, and payload hashes
- WHEN it is validated against the evidence contract family
- THEN it passes without errors

### Scenario: SC-CONTRACTS-003 — Authority binding record validates

- GIVEN an authority record with a 10-element scope binding and an authority mode
- WHEN it is validated against the authority contract family
- THEN it passes without errors

### Scenario: SC-CONTRACTS-004 — Engine receipt mirrors harness schema

- GIVEN a SignedReceipt produced by the pinned drenyra-ai receipt fixtures
- WHEN it is validated against the harness receipt schema
- THEN it passes and every field matches the engine type

### Scenario: SC-CONTRACTS-005 — Tampered payload rejected

- GIVEN a receipt whose content field has been tampered with (wrong type or missing field)
- WHEN it is validated against the receipt schema
- THEN validation fails with a descriptive error

## Out of Scope

Defining external Dominion/Drenyra AI engine contracts, mission transition semantics, receipt cryptography, gate behavior, or ledger rules; canonical storage beyond Pi schema documents and validation; and post-v0.1 families (SIRE, AP/AR, monthly taxes, continuous audit).
