# Contracts Specification

## Purpose

Defines the four durable JSON-schema contract families for the harness — mission, evidence, authority, and receipts — that act as the durable, code-validated contract for every payload the harness produces or consumes. The schemas mirror the pinned `drenyra-ai@0.2.0` types as the source of truth and follow the consumer-only discipline: the harness references the engine contract, never deep-imports its unexported surfaces.

## Requirements

### Requirement: REQ-CONTRACTS-001 — Mission contract family

The system MUST ship a JSON-schema mission contract family under `contracts/mission/` covering mission states, valid transitions, and mission events, and MUST validate every mission payload the harness produces or consumes against these schemas.

### Requirement: REQ-CONTRACTS-002 — Evidence contract family

The system MUST ship a JSON-schema evidence contract family under `contracts/evidence/` covering evidence graph nodes, edges, and payload-hash fields, and MUST validate evidence-graph documents against it.

### Requirement: REQ-CONTRACTS-003 — Authority contract family

The system MUST ship a JSON-schema authority contract family under `contracts/authority/` covering the four authority modes (ASK, ANALYZE, PREPARE, EXECUTE), the 10-element scope binding record, and authorization decisions, and MUST validate authority records against it.

### Requirement: REQ-CONTRACTS-004 — Receipt contract family

The system MUST ship a JSON-schema receipt contract family under `contracts/receipts/` whose SignedReceipt shape mirrors the pinned drenyra-ai `SignedReceipt` exactly: protocolVersion, receiptType (APPROVAL | EXECUTION | COMPLETION | EXTERNAL_SUBMISSION), algorithm "Ed25519", content (missionId, companyId, actorId, decision, proposalVersion, evidenceHash, previousStatus, newStatus, payloadHash, timestamp), receiptHash, signerKeyId, signerPublicKey, signature, and issuedAt.

### Requirement: REQ-CONTRACTS-005 — Trusted-key registry schema

The system MUST ship a trusted-key registry schema matching the engine `SigningKeyInfo` (keyId, publicKey, issuedAt, optional expiresAt, optional revokedAt) and MUST validate registry entries against it before a key is trusted for receipt verification.

### Requirement: REQ-CONTRACTS-006 — Consumer-only discipline

The harness contract families MUST reference the pinned drenyra-ai contracts as the source of truth and MUST NOT deep-import unexported drenyra-ai implementation files.

### Requirement: REQ-CONTRACTS-007 — Versioned and tested schemas

Every contract family MUST be versioned and MUST have conformance tests that validate representative valid documents and reject invalid documents for each family.

### Requirement: REQ-CONTRACTS-008 — No float money in schemas

Schema definitions for monetary fields MUST declare money as BigInt cents (JSON integer or decimal string) and MUST reject floating-point representations.

## Scenarios

#### Scenario: SC-CONTRACTS-001 — Mission snapshot validates

- GIVEN a mission snapshot fixture with status, steps, blockers, and events
- WHEN it is validated against the mission contract family
- THEN it passes without errors

#### Scenario: SC-CONTRACTS-002 — Evidence graph validates

- GIVEN an evidence graph document with nodes, edges, and payload hashes
- WHEN it is validated against the evidence contract family
- THEN it passes without errors

#### Scenario: SC-CONTRACTS-003 — Authority binding record validates

- GIVEN an authority record with a 10-element scope binding and an authority mode
- WHEN it is validated against the authority contract family
- THEN it passes without errors

#### Scenario: SC-CONTRACTS-004 — Engine receipt mirrors harness schema

- GIVEN a SignedReceipt produced by the pinned drenyra-ai receipt fixtures
- WHEN it is validated against the harness receipt schema
- THEN it passes and every field matches the engine type

#### Scenario: SC-CONTRACTS-005 — Tampered payload rejected

- GIVEN a receipt whose content field has been tampered with (wrong type or missing field)
- WHEN it is validated against the receipt schema
- THEN validation fails with a descriptive error

## Out of Scope

Canonical storage of contracts beyond schema documents and validation, and any post-v0.1 contract families (SIRE, AP/AR, monthly taxes, continuous audit).
