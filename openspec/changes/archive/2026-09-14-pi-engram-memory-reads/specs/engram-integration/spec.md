# Engram Integration Specification — Delta (pi-engram-memory-reads)

**Extends:** `openspec/specs/engram-integration/spec.md` (published by `pi-engram-integration`, archived `2026-09-14-pi-engram-integration`). This delta adds two requirements (`REQ-ENG-005`, `REQ-ENG-006`) to that existing domain; it does not modify `REQ-ENG-001`..`004`.

## Added Requirements

### Requirement: REQ-ENG-005 — Agent-driven institutional-memory search

`journal-candidate-agent` MUST be able to call a new tool that searches `drenyra-engram`'s general institutional memory (`engram_search`) with a query the agent itself chooses, scoped to the company RUC already known from the local scope pointer — never a RUC the agent supplies, never a different company.

#### Scenario: Agent-supplied query, host-supplied scope

- GIVEN `journal-candidate-agent` calls the new tool with a query string
- WHEN the tool executes
- THEN it calls `engram_search` with that exact query and a `scope` built from the currently-known local RUC — the agent's input controls only the query text, never the scope

#### Scenario: No scope known yet

- GIVEN no company RUC is set in the local scope pointer
- WHEN the tool is called
- THEN it returns a clear, typed "no scope known" result — it does not call `engram_search` with a guessed or empty RUC, and it does not throw

#### Scenario: Engram unreachable

- GIVEN the `drenyra-engram` child process cannot be reached (same fail-closed verdicts as `REQ-ENG-002`)
- WHEN the tool is called
- THEN it returns a clear, typed "unavailable" result — the calling agent can proceed without institutional context, never blocked or crashed by this tool

### Requirement: REQ-ENG-006 — Memory shapes proposals, never authority

The new tool's result MUST NOT be connected to any gate (`mission-state`, `receipt`, `approval`) or to the deterministic materiality policy, and MUST NOT change `journal-candidate-agent`'s authority ceiling (PREPARE, propose-only, never posts).

#### Scenario: No gate wiring exists

- GIVEN the full diff of this change
- WHEN it is searched for any reference to a gate type, the materiality policy, or an authority-ceiling change
- THEN none exists — the tool's result reaches only the agent's own reasoning about what to propose

#### Scenario: Candidate artifact shape is unchanged

- GIVEN `journal-candidate-agent`'s output contract (a structured candidate-entries artifact citing evidence node ids)
- WHEN a candidate is drafted with the new tool's input available
- THEN the artifact's required shape (debit/credit lines, accounts, period, evidence references) is unchanged — institutional context may inform which correction is proposed, never the artifact's structural contract

## Out of Scope

`accounting_*` tools of any kind; `engram_save`/`engram_reject`/`engram_void`/`engram_supersede` (write-shaped); any agent other than `journal-candidate-agent`; any change to `runtime/engram-client.ts`/`runtime/engram-pin.ts`'s own logic; any change to gate, approval, or materiality logic.
