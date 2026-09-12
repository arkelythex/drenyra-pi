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

### Requirement: REQ-SCOPE-010 — Safe company and period selection transitions

The system MUST validate company and fiscal-period selections before persistence, MUST preserve a matching canonical binding when a selection is unchanged, and MUST leave operator-visible legacy and canonical company/period values aligned after a fresh complete canonical bind.

### Requirement: REQ-SCOPE-006 — Scope-change invalidation

The system MUST invalidate prior authorizations, approvals, and scope-bound decisions when any bound scope element changes, and MUST require a new explicitly bound decision. A valid change to the selected company or fiscal period MUST invalidate the prior canonical binding for protected work; changing away and later back MUST NOT resurrect that prior binding without a fresh explicit complete canonical bind.
(Previously: Changing any bound scope element invalidated prior authorizations, approvals, and scope-bound decisions and required a new explicitly bound decision.)

### Requirement: REQ-SCOPE-007 — Backward-compatible loading

The system MUST load a legacy company/period-only context into the full canonical scope model without data loss and MUST remain compatible with the existing company and period commands. If persisted legacy company/period values disagree with canonical company/fiscal-period values, the loaded scope MUST be treated as stale or incomplete and MUST fail closed for protected work.
(Previously: Legacy company/period-only context was loaded into the full canonical scope model without data loss and remained compatible with existing company and period commands.)

### Requirement: REQ-SCOPE-008 — Binding into authorization and receipts

The system MUST include the canonical scope hash in the mission binding record, in authorization records, and in signed receipt content so every receipt is traceable to the exact scope.

### Requirement: REQ-SCOPE-009 — Fail-closed incomplete scope

The system MUST reject mission creation, authorization, or execution when any of the 10 scope elements is missing, invalid, stale, or inconsistent with persisted company/period selections. Rejection MUST occur before protected mission, chain, evidence, approval, or receipt-target code executes and MUST mutate nothing.
(Previously: Mission creation, authorization, or execution was rejected when any of the 10 scope elements was missing or invalid.)

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

#### Scenario: SC-SCOPE-006-001 — Company change requires a fresh bind

- GIVEN a complete canonical scope for company A
- WHEN a valid company B is selected
- THEN protected mission, chain, evidence-mutation, approval, and receipt-target commands fail closed until a fresh complete canonical scope for company B is explicitly bound

#### Scenario: SC-SCOPE-006-002 — Period change requires a fresh bind

- GIVEN a complete canonical scope for period P1
- WHEN a valid period P2 is selected
- THEN protected mission, chain, evidence-mutation, approval, and receipt-target commands fail closed until a fresh complete canonical scope for period P2 is explicitly bound

#### Scenario: SC-SCOPE-006-003 — Changing away and back does not resurrect a binding

- GIVEN a canonical binding for company A and/or period P1
- WHEN the operator changes to another valid company or period and then changes back
- THEN the pre-change binding remains unusable and protected work stays blocked until a fresh explicit complete canonical bind

#### Scenario: SC-SCOPE-006 — Legacy context loads canonically

- GIVEN a persisted legacy context containing only company and period
- WHEN it is loaded into the new scope model
- THEN company and period map to the canonical elements and the scope is reported incomplete until the remaining 8 elements are bound

#### Scenario: SC-SCOPE-007-001 — Legacy/canonical mismatch fails closed

- GIVEN persisted legacy company or period values that differ from the canonical company or fiscal-period values
- WHEN the scope is loaded or a protected command is evaluated
- THEN the mismatch is reported as stale or incomplete and the protected command is rejected without protected mutation

#### Scenario: SC-SCOPE-010-001 — Invalid selection causes no persistence mutation

- GIVEN a persisted context and canonical binding
- WHEN an invalid RUC or invalid `YYYYMM` period is selected
- THEN the selection is rejected before persistence and neither the selected context nor canonical binding changes

#### Scenario: SC-SCOPE-010-002 — Same selection preserves the binding

- GIVEN a complete canonical binding whose company and period match the persisted selections
- WHEN the operator selects the same company or period again
- THEN the canonical binding and its scope hash remain usable and unchanged

#### Scenario: SC-SCOPE-010-003 — Fresh bind aligns visible values

- GIVEN a selected company and period that require a fresh canonical bind
- WHEN the operator explicitly binds a valid complete canonical scope
- THEN the operator-visible company and period agree with the canonical company and fiscal-period values

#### Scenario: SC-SCOPE-009-002 — Stale selection is rejected before delegation

- GIVEN a canonical binding that was invalidated by a company or period change
- WHEN a protected mission, chain, evidence-mutation, approval, or receipt-target command runs
- THEN the scope guard rejects it before protected code executes and no protected state is written

## Out of Scope

Tenant isolation and canonical multi-user storage; the development-grade single-user context store remains for this change.
