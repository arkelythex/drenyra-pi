# Routing Adapter Specification

## Purpose

Defines the production wiring of the `lib/routing/` pipeline's `direct`
modality — preflight, Core-delegated route decision, and executor — into a
live `/drenyra:status` invocation, without reimplementing fiscal-authority
logic or claiming coverage for the `delegated`/`durable` modalities beyond
what is actually wired.

## Requirements

### Requirement: REQ-ROUTE-001 — Live `direct` port wiring, unconditional preflight, opt-in execution

The system MUST provide a real, non-stub `RoutingExecutionPorts["direct"]`
that runs an in-process chain-pipeline task, reached through
`runRoutingPreflight` and `executeRoutingWork`. The port MUST NOT dispatch to
an external agent and MUST NOT reimplement fiscal-authority, materiality, or
Core route-decision logic.

`runRoutingPreflight` MUST run unconditionally on every `/drenyra:status`
invocation as an additive, write-free field. `executeRoutingWork`'s dispatch
to the real `direct` port MUST run only when the operator supplies an
explicit opt-in signal on the `/drenyra:status` invocation, and MUST NOT run
on a default invocation that carries no such signal. A default
`/drenyra:status` invocation (no opt-in signal) MUST perform zero
mission-store writes, byte-identical to current behavior.

#### Scenario: SC-ROUTE-001 — Explicit opt-in invokes the direct port

- GIVEN a bound scope, an active mission eligible for a `direct`-routed work
  unit, and an explicit opt-in signal supplied to the `/drenyra:status`
  invocation
- WHEN `/drenyra:status` is invoked with that opt-in signal
- THEN `runRoutingPreflight` runs, `executeRoutingWork` dispatches to the
  real `direct` port, and the port completes an in-process chain-pipeline
  task without calling an external agent

#### Scenario: SC-ROUTE-002 — Core route decision is authoritative

- GIVEN a route decision returned by the pinned `drenyra-ai` Core `route()`
- WHEN the `direct` port executes the routed work unit
- THEN the port maps and executes that exact route kind and neither
  overrides nor recomputes the routing decision itself

#### Scenario: SC-ROUTE-008 — Default invocation performs zero mission-store writes

- GIVEN a bound scope and an active mission eligible for a `direct`-routed
  work unit
- WHEN `/drenyra:status` is invoked with no opt-in signal
- THEN `runRoutingPreflight` still runs and surfaces its additive,
  write-free field, `executeRoutingWork` is never called, and the invocation
  performs zero mission-store writes, byte-identical to current behavior

### Requirement: REQ-ROUTE-002 — Fail-closed missing-port guard

The system MUST fail closed with `AMBIGUOUS_INPUT { fields: ["ports.<name>"] }`
when `executeRoutingWork` is given a route whose corresponding port is
missing or is not a function, and MUST NOT dispatch to that port.

#### Scenario: SC-ROUTE-003 — Missing port rejected before dispatch

- GIVEN an `executeRoutingWork` call whose `ports` object has no `direct`
  entry (or a non-function value) for a route resolved to `"direct"`
- WHEN execution runs
- THEN the result is `ok: false` with
  `reason: { kind: "AMBIGUOUS_INPUT", fields: ["ports.direct"] }` and no
  chain-pipeline task starts

#### Scenario: SC-ROUTE-004 — Present port dispatches normally

- GIVEN an `executeRoutingWork` call whose `ports` object has a valid
  function for the resolved route kind
- WHEN execution runs
- THEN the matching port is invoked with the route's execution input and no
  `AMBIGUOUS_INPUT` rejection occurs for that reason

### Requirement: REQ-ROUTE-003 — `/drenyra:mission` untouched

The system MUST leave `missionHandler` and `/drenyra:mission`'s existing
`coordinator.advance()` call path unchanged by this wiring; the `direct`-port
wiring MUST be additive to `/drenyra:status` only.

#### Scenario: SC-ROUTE-005 — Mission command behavior unchanged

- GIVEN the pre-existing `/drenyra:mission` test suite
- WHEN it runs after the `direct` port is wired into `/drenyra:status`
- THEN every pre-existing test passes unmodified and `missionHandler` still
  calls `coordinator.advance()` exactly as before

### Requirement: REQ-ROUTE-004 — Honest capability manifest evidence, folded into `drenyra-commands`

The system MUST add the `direct`-port evidence — its source file(s), test
file(s), and a `verificationLevel` line reading `unit-or-contract-tested`
(explicitly not `validated-end-to-end`) — into the EXISTING
`drenyra-commands` capability row's `evidence.sources`, `evidence.tests`,
and `evidence.note` fields in `capability-manifest.yaml`, following the
already-established `evidence.note` convention:
`verificationLevel: <path> = <tag> (<citation>)`. The system MUST NOT add a
new top-level `routing-adapter` (or other) capability key, and MUST NOT
modify `MASTER_CAPABILITIES` or the `state` enum.

#### Scenario: SC-ROUTE-006 — Direct-port evidence folded into the existing `drenyra-commands` row

- GIVEN `capability-manifest.yaml` after this change
- WHEN the `drenyra-commands` capability row is inspected
- THEN its `evidence.sources` and `evidence.tests` include the new
  `direct`-port source and test files, its `evidence.note` carries a
  `verificationLevel: <path> = unit-or-contract-tested (...)` line,
  `MASTER_CAPABILITIES` and the `state` enum remain unmodified, and no new
  top-level capability key exists

### Requirement: REQ-ROUTE-005 — `delegated` modality named as a follow-up

The system MUST explicitly name the `delegated` modality as an out-of-scope,
tracked follow-up in every capability or status artifact this change
touches (`capability-manifest.yaml`, the conformance matrix); it MUST NOT be
silently omitted.

#### Scenario: SC-ROUTE-007 — Delegated modality is visible, not silent

- GIVEN the capability manifest and conformance matrix rows this change adds
  or edits
- WHEN they are inspected for modality coverage
- THEN `delegated` appears explicitly marked as not-yet-implemented /
  tracked follow-up rather than being absent from the artifact

## Out of Scope

The `delegated` modality's agent-dispatch implementation; any change to
`BudgetLedger`'s per-work-unit design; Core route-decision or
fiscal-authority logic, which remains owned by the pinned `drenyra-ai`
package.
