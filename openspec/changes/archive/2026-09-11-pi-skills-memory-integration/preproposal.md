# Pending decision: executable skill selection

Status: `functional_selection_contract_first` selected explicitly by the user. Define the missing contract before production wiring. No implementation or native lifecycle state is asserted by this note. External research is unselected.

## Evidence

The existing `design.md` explicitly states that none of the five `MissionIntent` values matches a `BASE_PE_SKILLS` identifier. Passing `mission.intent` to `resolveAt` therefore produces `SKILL_NOT_FOUND` and an empty skills array for every currently described production mission.

The same design states that an empty array passes existing work-unit validation and does not block preflight. This is absence of skill pins, not a fail-closed operational stop. An adapter-only test using a literal skill identifier cannot demonstrate task-based production selection.

The proposal's new capability row conflicts with the design/specification's extension of an existing row. These artifacts need alignment before tasks. Memory remains separately unimplemented, with no confirmed host/backend integration contract.

## Confirmed contract gap and pending effective-date decision

Read-only inspection of the installed pinned runtime found ID-based `SkillRegistry.resolveAt`, handler-based `IntentRegistry`, and caller-supplied `MonthlyCloseInput.igvSkill`; none supplies authoritative mission-to-skill requirements. This is a proposed upstream dependency, not approval to change the pin or frozen contracts.

The user explicitly selected `explicit_task_asof`: every task declares a visible, verifiable fiscal `asOf` date. Missing `asOf` must not default to the current system day, a transaction date, or a fiscal-period rule. Required versus optional skill requirements must be explicit in the upstream descriptor, never inferred from an empty result. No optional-skill policy or task mapping is authorized for Pi to invent.

## Scope decision (answered)

Choose one scope before further phase execution:

1. `functional_selection_contract_first`: define the missing task-to-skill/provenance contract and observable missing-skill behavior before production wiring; keep master-owned selection decisions in the kernel/program, not Pi-local mappings. Recommended to meet the original functional goal.
2. `adapter_only_explicit`: deliberately build only the technical adapter; record that current mission-based calls resolve no skill and that neither task-based selection nor memory integration is complete.
3. `defer_skills_advance_journey`: leave this change pending and investigate the monthly-close journey next without claiming skills/memory readiness.

No option authorizes runtime upgrades, frozen contract changes, edits to another repository, publication, or fiscal operations. The user selected option 1; options 2 and 3 were not selected. Existing proposal, specification, and design remain untouched until the contract analysis is complete.
