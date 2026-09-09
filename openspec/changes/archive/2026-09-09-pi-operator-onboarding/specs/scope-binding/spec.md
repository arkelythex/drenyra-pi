# Delta for Scope Binding

## ADDED Requirements

### Requirement: REQ-SCOPE-010 — Safe company and period selection transitions

The system MUST validate company and fiscal-period selections before persistence, MUST preserve a matching canonical binding when a selection is unchanged, and MUST leave operator-visible legacy and canonical company/period values aligned after a fresh complete canonical bind.

#### Scenario: Invalid selection causes no persistence mutation

- GIVEN a persisted context and canonical binding
- WHEN an invalid RUC or invalid `YYYYMM` period is selected
- THEN the selection is rejected before persistence and neither the selected context nor canonical binding changes

#### Scenario: Same selection preserves the binding

- GIVEN a complete canonical binding whose company and period match the persisted selections
- WHEN the operator selects the same company or period again
- THEN the canonical binding and its scope hash remain usable and unchanged

#### Scenario: Fresh bind aligns visible values

- GIVEN a selected company and period that require a fresh canonical bind
- WHEN the operator explicitly binds a valid complete canonical scope
- THEN the operator-visible company and period agree with the canonical company and fiscal-period values

## MODIFIED Requirements

### Requirement: REQ-SCOPE-006 — Scope-change invalidation

The system MUST invalidate prior authorizations, approvals, and scope-bound decisions when any bound scope element changes, and MUST require a new explicitly bound decision. A valid change to the selected company or fiscal period MUST invalidate the prior canonical binding for protected work; changing away and later back MUST NOT resurrect that prior binding without a fresh explicit complete canonical bind.
(Previously: Changing any bound scope element invalidated prior authorizations, approvals, and scope-bound decisions and required a new explicitly bound decision.)

#### Scenario: Authorization invalidated by scope change

- GIVEN an approved authorization bound to a canonical scope
- WHEN the fiscal period element changes
- THEN the prior authorization is invalid and any receipt bound to the old scope is no longer valid for the new scope

#### Scenario: Company change requires a fresh bind

- GIVEN a complete canonical scope for company A
- WHEN a valid company B is selected
- THEN protected mission, chain, evidence-mutation, approval, and receipt-target commands fail closed until a fresh complete canonical scope for company B is explicitly bound

#### Scenario: Period change requires a fresh bind

- GIVEN a complete canonical scope for period P1
- WHEN a valid period P2 is selected
- THEN protected mission, chain, evidence-mutation, approval, and receipt-target commands fail closed until a fresh complete canonical scope for period P2 is explicitly bound

#### Scenario: Changing away and back does not resurrect a binding

- GIVEN a canonical binding for company A and/or period P1
- WHEN the operator changes to another valid company or period and then changes back
- THEN the pre-change binding remains unusable and protected work stays blocked until a fresh explicit complete canonical bind

### Requirement: REQ-SCOPE-007 — Backward-compatible loading

The system MUST load a legacy company/period-only context into the full canonical scope model without data loss and MUST remain compatible with the existing company and period commands. If persisted legacy company/period values disagree with canonical company/fiscal-period values, the loaded scope MUST be treated as stale or incomplete and MUST fail closed for protected work.
(Previously: Legacy company/period-only context was loaded into the full canonical scope model without data loss and remained compatible with existing company and period commands.)

#### Scenario: Legacy context loads canonically

- GIVEN a persisted legacy context containing only company and period
- WHEN it is loaded into the new scope model
- THEN company and period map to the canonical elements and the scope is reported incomplete until the remaining 8 elements are bound

#### Scenario: Legacy/canonical mismatch fails closed

- GIVEN persisted legacy company or period values that differ from the canonical company or fiscal-period values
- WHEN the scope is loaded or a protected command is evaluated
- THEN the mismatch is reported as stale or incomplete and the protected command is rejected without protected mutation

### Requirement: REQ-SCOPE-009 — Fail-closed incomplete scope

The system MUST reject mission creation, authorization, or execution when any of the 10 scope elements is missing, invalid, stale, or inconsistent with persisted company/period selections. Rejection MUST occur before protected mission, chain, evidence, approval, or receipt-target code executes and MUST mutate nothing.
(Previously: Mission creation, authorization, or execution was rejected when any of the 10 scope elements was missing or invalid.)

#### Scenario: Incomplete scope is rejected

- GIVEN a scope with one or more missing canonical elements
- WHEN mission creation, authorization, or execution is attempted
- THEN the operation is rejected before protected work and no mutation occurs

#### Scenario: Stale selection is rejected before delegation

- GIVEN a canonical binding that was invalidated by a company or period change
- WHEN a protected mission, chain, evidence-mutation, approval, or receipt-target command runs
- THEN the scope guard rejects it before protected code executes and no protected state is written
