# Delta for Commands

## MODIFIED Requirements

### Requirement: REQ-CMD-003 — Scope guard before every command

The system MUST enforce the scope guard before every command: commands that require scope MUST fail closed with an explanatory error when scope is missing, invalid, stale, or inconsistent with persisted company/period selections. The guard MUST run before delegation to protected mission, chain, evidence-mutation, approval, or receipt-target code, and rejection MUST mutate nothing.
(Previously: Commands requiring scope failed closed with an explanatory error when scope was missing or invalid.)

#### Scenario: Fail closed without scope

- GIVEN a command requiring scope (for example `/drenyra:close`) and no company or period bound
- WHEN the command runs
- THEN it fails closed with an explanatory scope error and mutates nothing

#### Scenario: Rejection after company or period change

- GIVEN a complete canonical scope and a valid subsequent company or fiscal-period selection
- WHEN a protected mission, chain, evidence-mutation, approval, or receipt-target command runs
- THEN the guard rejects the command before protected code executes and no protected state is mutated

#### Scenario: Legacy/canonical mismatch is rejected

- GIVEN persisted legacy company or period values that disagree with the canonical binding
- WHEN a protected command runs
- THEN the guard fails closed with an explanatory error and no protected code executes

#### Scenario: Changing away and back does not bypass the guard

- GIVEN a canonical binding for an earlier company or fiscal period
- WHEN the selection changes away and then returns to the earlier value without a fresh explicit complete bind
- THEN the protected command remains rejected and the prior binding is not silently reused
