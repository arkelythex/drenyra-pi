# Scope Binding Specification

## Purpose

Defines the 10-element canonical scope every mission and authorization is bound to, its canonical encoding and scope hash, and the invalidation rule: changing any element invalidates prior authorization. It also pins the Peruvian identity and period rules — RUC check-digit validation and canonical YYYYMM periods — as fail-closed validation.

## Requirements

### Requirement: REQ-SCOPE-001 — Ten canonical scope elements

The system MUST bind every mission and authorization to exactly 10 scope elements: tenant, organization, company, fiscal period, ledger/book, operation type, source snapshot, policy version, actor, and authority level.

### Requirement: REQ-SCOPE-002 — RUC check-digit validation

The system MUST validate company RUC identifiers as exactly 11 digits passing the official Peruvian check-digit algorithm; format-only checks MUST NOT be accepted.

### Requirement: REQ-SCOPE-003 — Canonical fiscal period

The system MUST represent fiscal periods as canonical `YYYYMM` and MUST reject months outside 01–12.

### Requirement: REQ-SCOPE-004 — Canonical encoding and hash

The system MUST serialize a scope binding to a canonical, key-sorted, deterministic JSON form and MUST compute a lowercase hex SHA-256 scope hash over that form.

### Requirement: REQ-SCOPE-005 — Single-element sensitivity

The system MUST produce a different scope hash when any single one of the 10 elements changes while the other 9 remain identical.

### Requirement: REQ-SCOPE-006 — Scope-change invalidation

The system MUST invalidate prior authorizations, approvals, and scope-bound decisions when any bound scope element changes, and MUST require a new explicitly bound decision.

### Requirement: REQ-SCOPE-007 — Backward-compatible loading

The system MUST load a legacy company/period-only context into the full canonical scope model without data loss and MUST remain compatible with the existing company and period commands.

### Requirement: REQ-SCOPE-008 — Binding into authorization and receipts

The system MUST include the canonical scope hash in the mission binding record, in authorization records, and in signed receipt content so every receipt is traceable to the exact scope.

### Requirement: REQ-SCOPE-009 — Fail-closed incomplete scope

The system MUST reject mission creation, authorization, or execution when any of the 10 scope elements is missing or invalid.

## Scenarios

#### Scenario: SC-SCOPE-001 — Valid RUC accepted

- GIVEN an 11-digit RUC with a correct check digit
- WHEN the company scope element is validated
- THEN it is accepted

#### Scenario: SC-SCOPE-002 — Bad check digit rejected

- GIVEN an 11-digit RUC with an incorrect check digit
- WHEN the company scope element is validated
- THEN it is rejected and the error explains the check-digit failure

#### Scenario: SC-SCOPE-003 — Period boundary validation

- GIVEN the periods "202507" and "202513"
- WHEN they are validated
- THEN "202507" is accepted and "202513" is rejected

#### Scenario: SC-SCOPE-004 — Ten single-field mutations change the hash

- GIVEN a fully bound canonical scope
- WHEN each of the 10 elements is mutated individually
- THEN each mutation yields a different scope hash and the original hash is unchanged

#### Scenario: SC-SCOPE-005 — Authorization invalidated by scope change

- GIVEN an approved authorization bound to a canonical scope
- WHEN the fiscal period element changes
- THEN the prior authorization is invalid and any receipt bound to the old scope is no longer valid for the new scope

#### Scenario: SC-SCOPE-006 — Legacy context loads canonically

- GIVEN a persisted legacy context containing only company and period
- WHEN it is loaded into the new scope model
- THEN company and period map to the canonical elements and the scope is reported incomplete until the remaining 8 elements are bound

## Out of Scope

Tenant isolation and canonical multi-user storage; the development-grade single-user context store remains for this change.
