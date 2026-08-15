# Drenyra Pi Adapter Boundary — Specification

> Change: `pi-sdd-040-adapter-boundary`
> Product: `drenyra-pi`
> Phase: specs (real SDD pipeline)
> Date: 2026-08-15
> Runtime baseline: published and pinned `drenyra-ai@0.2.0` (entry checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`)
> Program authority: master change `sdd-040-rda-v2` in `drenyra-ai` (docs-only closure coordinated 2026-08-15)
> Requirement ID prefixes: `REQ-AUDIT`, `REQ-HARNESS`, `REQ-DOC`, `REQ-ALIGN`, `REQ-BOUND`

## Purpose

Defines what must be true after Drenyra Pi proves, rather than merely documents,
that it is a replaceable agentic-runtime host for Drenyra AI's deterministic
fiscal-authority kernel: an evidence-backed audit of every prohibited authority
behavior, the smallest fixes for any Pi-local boundary violation found, a
harness-replacement test that runs the same bounded mission through Pi and
through an independent minimal host over the same published pinned runtime, and
a published adapter contract for maintainers.

This is a **host-side structural proof, not a platform**. The master closure
`drenyra-ai/openspec/changes/sdd-040-rda-v2/` remains the authority record for
RDA v2 behavior; Pi may coordinate, prepare requests, persist non-authoritative
working state, and present results, and must not become a second fiscal-authority
implementation. Exact paths for the harness, substitute host, and audit verdict
artifact beyond the required architecture document belong to the design phase.

## Requirements

## REQ-AUDIT — Authority boundary audit

### Requirement: REQ-AUDIT-001 — Per-rule audit with demonstrated verdicts

The system MUST audit the final candidate against every rule in proposal §3.1
(agent authority, materiality, transitions, risk level, approvals, gates,
receipts, UNKNOWN handling, stores, delegation) and MUST publish a per-rule
verdict table in which every rule carries a PASS verdict or a named violation.
A PASS verdict MUST be demonstrated by executable, source, or test evidence;
policy wording without executable or source evidence MUST NOT be accepted as a
PASS. When a violation is found, the system MUST fix the smallest Pi-local
boundary breach and add regression evidence. When a correction would require
new kernel behavior, an unpublished module, a runtime release, or a
master-repository edit, the system MUST report the blocker rather than
implement a Pi surrogate.

#### Scenario: SC-AUDIT-001 — Every rule carries demonstrated evidence

- GIVEN the final Pi candidate and the ten audit rules in proposal §3.1
- WHEN the per-rule verdict table is produced
- THEN every rule row names concrete source paths, symbols, or test cases as
  evidence, no row claims PASS on policy wording alone, and any violation row is
  either fixed with regression evidence or reported as a blocked dependency

### Requirement: REQ-AUDIT-002 — Evidence discipline for audit conclusions

Audit conclusions MUST cite stable paths, symbols, and test cases, following
the source → transformation → conclusion discipline. Conclusions about behavior
inside an accounting mission MUST additionally satisfy the evidence graph's
citation and payload-hash rules where the mission model requires them. An audit
conclusion without citations MUST NOT be reported as a finding.

#### Scenario: SC-AUDIT-002 — Cited conclusions only

- GIVEN an audit conclusion about the final candidate
- WHEN the conclusion is inspected
- THEN it cites at least one stable source path, symbol, or test case that
  supports it, and a mission-model conclusion also satisfies the evidence
  graph's citation rules or it is not reported

### Requirement: REQ-AUDIT-003 — Agent authority ceilings are ANALYZE or PREPARE

The audit MUST verify that no Pi agent definition grants EXECUTE authority:
every `agents/*.md` authority ceiling MUST be ANALYZE or PREPARE, and agent
prose MUST NOT claim EXECUTE work (signing receipts, granting authority, or
posting/mutating accounting records). The system MUST keep or add an executable
check or test that asserts no agent definition carries an EXECUTE ceiling.

#### Scenario: SC-AUDIT-003 — No EXECUTE ceiling in any agent

- GIVEN the ten `agents/*.md` definitions and the `agents/README.md` authority
  inventory
- WHEN the ceiling audit and its executable check run
- THEN every definition and the inventory report ANALYZE or PREPARE only, no
  EXECUTE ceiling exists, and the check passes against the final candidate

### Requirement: REQ-AUDIT-004 — Materiality tiers are kernel-derived

The audit MUST demonstrate that the authoritative R0–R3 materiality tier in the
tested path is derived by the pinned kernel's `deriveMateriality`
(`drenyra-ai/candidates`), that Pi supplies only explicit `MaterialityInput`
values and declared policy floors (for example the monthly-close R2 floor in
`CLOSE_MATERIALITY`, `chains/monthly-close.ts`), and that no Pi module computes,
fabricates, or lowers a tier independently. Missing or invalid materiality input
MUST fail closed and MUST NOT default to R0.

#### Scenario: SC-AUDIT-004 — Pi supplies inputs and floors; the kernel derives tiers

- GIVEN the final candidate with an explicit materiality request (input plus an
  optional declared minimum)
- WHEN the audit traces the materiality derivation for the tested path
- THEN the evidence shows the tier is produced by the kernel `deriveMateriality`
  with the declared floor applied only as a minimum, missing or invalid input
  fails closed instead of defaulting to R0, and no Pi-local code computes a
  tier independently

### Requirement: REQ-AUDIT-005 — Lifecycle transitions are engine-owned

The audit MUST demonstrate that Pi does not accept, authorize, or fabricate
fiscal lifecycle transitions: every status transition in the tested path MUST go
through the kernel `MissionRuntime.apply` engine-validated transitions,
phase-only progress updates (PROGRESS_UPDATE) MUST NOT fabricate an engine state
transition, and human-wait states MUST NOT auto-advance.

#### Scenario: SC-AUDIT-005 — Engine-validated transitions only

- GIVEN the mission lifecycle writes of the tested path
- WHEN the audit inspects each status change and its event type
- THEN every status transition is produced by the engine (`MissionRuntime.apply`)
  or is a phase-only PROGRESS_UPDATE that leaves the engine status unchanged,
  and no Pi code assigns an engine status outside those mechanisms

### Requirement: REQ-AUDIT-006 — Risk-level outcomes are kernel-derived

The audit MUST demonstrate that Pi does not decide authoritative R0–R3
risk-level outcomes: every tier in the tested path is a kernel result, and any
risk indication Pi presents (for example a proposal summary field) is
non-authoritative presentation that MUST NOT alter a gate or receipt outcome.

#### Scenario: SC-AUDIT-006 — No Pi-decided R0–R3 outcome

- GIVEN the final candidate
- WHEN the audit traces every R0–R3 value in the tested path
- THEN each tier is produced by the kernel materiality derivation, and no Pi
  module assigns or overrides a tier that a gate or receipt outcome depends on

### Requirement: REQ-AUDIT-007 — Approvals are human and kernel-validated

The audit MUST demonstrate that Pi does not create a fiscally valid approval and
does not treat preparation as approval: every `ApprovalRecord` in the tested
path MUST be created only from explicit human approver input, approval verdicts
MUST come from the kernel `ApprovalGate`, and PREPARE-family actions MUST
produce candidates only and MUST NOT be recorded as approvals.

#### Scenario: SC-AUDIT-007 — Approvals require the human and the kernel gate

- GIVEN the approve phase of the tested mission
- WHEN the audit inspects how `ApprovalRecord` values are created and evaluated
- THEN each record is created only from explicit human approver input, the
  verdict comes from the kernel `ApprovalGate`, and no preparation step is
  treated as an approval

### Requirement: REQ-AUDIT-008 — Core gate verdicts are not substituted

The audit MUST demonstrate that Pi does not substitute Pi-local logic for Core
authority gates: the mission, approval, and receipt verdicts in the tested path
MUST be produced by the kernel gates (`GateRunner` with `MissionStateGate`,
`ApprovalGate`, and `ReceiptGate` from `drenyra-ai/gates`). Pi MAY order
pipeline stages, validate binding and input completeness, and stop at the first
non-allowed verdict, but MUST NOT decide a gate verdict the kernel owns, and the
receipt gate MUST NOT be invoked without a non-empty trusted-key list
(embedded-key self-trust is never accepted).

#### Scenario: SC-AUDIT-008 — Gate verdicts come from the kernel

- GIVEN a candidate-bearing, approval, or execution action in the tested path
- WHEN the audit traces the gate verdicts
- THEN the mission, approval, and receipt verdicts originate from kernel gates
  run through `GateRunner`, Pi-local stage logic only validates
  binding/input completeness and orders stages, and the receipt gate is never
  evaluated with an empty trusted-key list

### Requirement: REQ-AUDIT-009 — Receipts prove only what they claim

The audit MUST demonstrate that Pi does not transform a review/completion
receipt into execution proof and does not over-claim what a receipt proves:
receipt types and claims in the tested path MUST match the action actually
performed (for example COMPLETION for a close), the verify path MUST stay
read-only, and no local receipt record or documentation MAY claim execution
proof beyond the receipt's binding.

#### Scenario: SC-AUDIT-009 — Receipt claims match the performed action

- GIVEN the completion receipt and any review/completion claims in the tested
  path
- WHEN the audit compares receipt type, binding, and claims with the performed
  action
- THEN the receipt type and claims match the action (completion is never
  presented as execution proof), and the verify chain performs no mutation

### Requirement: REQ-AUDIT-010 — Zero blind retries after UNKNOWN

The audit MUST demonstrate that the tested path performs zero blind retries
after an UNKNOWN mission result: an UNKNOWN status MUST yield no prepared step,
no loop MAY re-submit an UNKNOWN mission, and recovery MUST proceed only through
reconciliation or explicit human action.

#### Scenario: SC-AUDIT-010 — UNKNOWN stops and waits for reconciliation or human action

- GIVEN a mission whose engine status is UNKNOWN
- WHEN the continuation path is driven
- THEN no step is prepared, no blind retry is issued, and only reconciliation or
  explicit human action can resume the mission

### Requirement: REQ-AUDIT-011 — Local stores are non-authoritative

The audit MUST classify every local JSON store used by the tested path as
development/demo state or non-authoritative cache and MUST demonstrate that no
local record can authorize, approve, or prove fiscal execution. Each store MUST
be labeled accordingly in documentation, and a guard or test MUST prove that
local persistence (mission stores, authority records, receipt store, evidence
logs, exports, context file) cannot substitute for a kernel authority artifact.

#### Scenario: SC-AUDIT-011 — Stores labeled and proven non-authoritative

- GIVEN the local stores touched by the tested path
- WHEN the audit classifies each store and its guard or test runs
- THEN each store is labeled dev/demo or non-authoritative cache in the
  documentation, and the guard or test shows local persistence alone cannot
  authorize, approve, or prove fiscal execution

### Requirement: REQ-AUDIT-012 — Delegation to the published pinned runtime

The audit MUST demonstrate that every authoritative operation used by the tested
mission delegates to the published pinned runtime `drenyra-ai@0.2.0`: mission
runtime and statuses, candidate materiality, gate evaluation, and receipt
signing/verification MUST come from the kernel entry points, and no
authoritative operation MAY be implemented in Pi-local code.

#### Scenario: SC-AUDIT-012 — Authoritative operations trace to the pinned runtime

- GIVEN the authoritative operations of the tested mission
- WHEN the audit traces each operation to its implementation
- THEN each traces to a public kernel module of the pinned `drenyra-ai@0.2.0`
  artifact (for example `drenyra-ai/missions`, `drenyra-ai/candidates`,
  `drenyra-ai/gates`, `drenyra-ai/receipts`), and the runtime remains the
  published artifact with the documented checksum

## REQ-HARNESS — Harness replacement test

### Requirement: REQ-HARNESS-001 — Two-host equivalence integration test

The system MUST add a deterministic integration test that runs one bounded
mission fixture through (a) Pi's chain pipeline (`lib/chain-pipeline.ts` /
`chains/monthly-close.ts` over the durable stores) and (b) an independent
minimal substitute host that calls the pinned `drenyra-ai@0.2.0` public Core
functions directly, and MUST compare both runs' canonical authority projections.
The test MUST run under the repository's standard test command and MUST have its
exact commands and results recorded in apply and verify evidence.

#### Scenario: SC-HARNESS-001 — Same mission through both hosts

- GIVEN a bounded monthly-close (or equivalent) mission fixture and the pinned
  `drenyra-ai@0.2.0` artifact
- WHEN the harness runs the fixture through Pi's chain pipeline and through the
  independent substitute host
- THEN both runs complete against the same fixture and the same pinned runtime,
  and their canonical authority projections are compared for equivalence

#### Scenario: SC-HARNESS-002 — Verification commands and results recorded

- GIVEN the final candidate with the harness in place
- WHEN the focused harness tests, the full test suite, typecheck, and applicable
  package verification run
- THEN all pass and the exact commands and results are recorded in the apply and
  verify evidence

### Requirement: REQ-HARNESS-002 — Substitute host has no Pi dependency

The substitute host MUST contain no Pi chain or store logic: it MUST import only
public `drenyra-ai` entry points plus minimal fixture and serialization code, and
the harness MUST include a path-import assertion test that asserts the substitute
host source imports no Pi `chains/`, `lib/`, or local store module.

#### Scenario: SC-HARNESS-003 — Anti-circularity asserted

- GIVEN the substitute host source
- WHEN the path-import assertion runs
- THEN the assertion passes, proving the substitute host imports nothing from
  Pi's chains, lib, or store modules and consumes only the pinned kernel's
  public surface

### Requirement: REQ-HARNESS-003 — Canonical authority projection defined and compared

The canonical authority projection MUST be defined by this specification (and
detailed by the design) before implementation, and both runs MUST produce
equivalent projections. The projection MUST cover: canonical scope (binding
elements and scope hash), evidence and policy binding (evidence hash, policy
version), materiality result (derived tier), ordered gate verdicts (stage order
and verdicts), candidate target and content, approval relationship (human
approver binding), receipt type and claims (type and binding fields), and
terminal authority decision (final status or decision).

#### Scenario: SC-HARNESS-004 — Projection fields compared for equivalence

- GIVEN both completed runs
- WHEN the projection comparator runs over both projections
- THEN every listed field — scope, evidence/policy binding, materiality result,
  ordered gate verdicts, candidate target/content, approval relationship,
  receipt type/claims, and terminal authority decision — is equivalent between
  the Pi run and the substitute-host run

### Requirement: REQ-HARNESS-004 — Narrow, tested normalization exclusions

The equivalence comparison MAY normalize non-authoritative runtime-generated
metadata (identifiers, timestamps, signatures, serialization details) ONLY when
the pinned runtime makes them intentionally non-deterministic AND when they
cannot alter fiscal meaning. Every exclusion MUST be enumerated, narrow, and
itself tested, and normalization MUST NOT hide an authority difference.

#### Scenario: SC-HARNESS-005 — Exclusions enumerated and proven harmless

- GIVEN the list of normalized fields
- WHEN the comparator and its exclusion tests run
- THEN each excluded field is named with its justification, a test proves the
  field is runtime-generated, intentionally non-deterministic, and unable to
  affect fiscal meaning, and no authority-bearing field is excluded

### Requirement: REQ-HARNESS-005 — Negative controls fail the equivalence

The harness MUST include mutation-style negative controls that make the
equivalence fail when a Core decision is overridden, a bound input changes, a
gate is reordered or substituted, a receipt claim upgrades, or UNKNOWN is
retried blindly. A test that merely mocks both hosts to return the same fixture
MUST NOT satisfy this requirement.

#### Scenario: SC-HARNESS-006 — Each mutation breaks equivalence

- GIVEN the equivalent baseline and one of the five mutation classes (override a
  Core decision, change a bound input, reorder or substitute a gate, upgrade a
  receipt claim, blind-retry UNKNOWN)
- WHEN the negative control for that mutation runs
- THEN the equivalence assertion fails and the failing control names the mutated
  field

## REQ-DOC — Adapter boundary documentation

### Requirement: REQ-DOC-001 — Adapter boundary document with the operator-to-result flow

The system MUST create `docs/architecture/rda-adapter-boundary.md` documenting
the reviewable happy path — operator → prepare request → call Drenyra AI →
present candidate → human decision → verify receipt → project result — and MUST
state, for each step, whether the step is Pi-owned coordination/presentation,
human-owned, or Drenyra AI-owned authority.

#### Scenario: SC-DOC-001 — Flow and ownership documented end to end

- GIVEN the created document
- WHEN it is read
- THEN it walks the seven-step operator-to-result flow and states the ownership
  split for every step

### Requirement: REQ-DOC-002 — No ambiguous authority claims

The document MUST state that local store and cache data is never authoritative
and MUST contain no ambiguous authority claim: receipts, gates, materiality,
transitions, and approval decisions are Drenyra AI-owned, and local stores are
dev/demo state or non-authoritative cache.

#### Scenario: SC-DOC-002 — Store non-authority explicit

- GIVEN the document
- WHEN the ownership statements are checked
- THEN every local store or cache reference is explicitly labeled
  non-authoritative, and no sentence implies local data can authorize, approve,
  or prove fiscal execution

### Requirement: REQ-DOC-003 — Fail-closed behavior documented

The document MUST document fail-closed behavior for incomplete scope, invalid
evidence, gate denial, UNKNOWN, receipt verification failure, and unavailable
runtime, stating what happens and who or what is required to resume.

#### Scenario: SC-DOC-003 — Each failure mode has a fail-closed statement

- GIVEN the document
- WHEN the failure sections are checked
- THEN incomplete scope, invalid evidence, gate denial, UNKNOWN, receipt
  verification failure, and unavailable runtime each have an explicit
  fail-closed behavior statement

### Requirement: REQ-DOC-004 — Evidence linked without duplicating the master

The document MUST link to the audit verdict table and the harness test evidence
and MUST NOT duplicate the master `sdd-040-rda-v2` RDA v2 implementation
mapping.

#### Scenario: SC-DOC-004 — Evidence linked; master mapping not duplicated

- GIVEN the document and the linked artifacts
- WHEN the links resolve and the content is compared with the master closure
- THEN the audit and harness evidence links resolve to real artifacts, and the
  document contains no duplicate of the master's 41-requirement implementation
  mapping

## REQ-ALIGN — Master alignment

### Requirement: REQ-ALIGN-001 — Master closure referenced as the authority record

The change MUST reference the master change `sdd-040-rda-v2` in `drenyra-ai`
(`drenyra-ai/openspec/changes/sdd-040-rda-v2/`) as the authority-side record for
RDA v2 behavior, citing the stable change name and coordination date
(2026-08-15), and MUST bind the final closure identity (path or revision) during
specification or verification. Pi MUST be described as contributing only
host-side structural proof.

#### Scenario: SC-ALIGN-001 — Authority record cited and bound

- GIVEN the change artifacts
- WHEN the master-closure references are inspected
- THEN they name the master change `sdd-040-rda-v2` and the coordination date,
  the final closure identity is bound at specification or verification, and Pi
  is described as contributing host-side structural proof only

### Requirement: REQ-ALIGN-002 — No duplication of the master mapping

The change MUST NOT duplicate the master's 41-requirement implementation mapping
or its acceptance evidence; Pi artifacts MUST reference the master closure for
RDA v2 behavior instead of recreating it.

#### Scenario: SC-ALIGN-002 — No copied mapping

- GIVEN the Pi change's spec, audit, and documentation artifacts
- WHEN they are compared with the master closure's mapping
- THEN no Pi artifact reproduces the master's requirement-to-symbol mapping or
  its acceptance evidence

### Requirement: REQ-ALIGN-003 — Core vocabulary preserved

The change MUST NOT rename or locally redefine Core concepts, and MUST NOT edit
the `drenyra-ai` repository. The master's five deferred vocabulary differences
remain master-owned follow-up context and MUST NOT be resolved, relabeled, or
re-implemented in Pi. Audit, harness, and documentation evidence MUST use the
kernel vocabulary (materiality tiers R0–R3, receipt types, mission statuses,
gate stages).

#### Scenario: SC-ALIGN-003 — Kernel vocabulary used unchanged

- GIVEN the audit, harness, and documentation artifacts
- WHEN Core concept usage is checked
- THEN the artifacts use the kernel vocabulary without renaming or local
  redefinition, the master's deferred differences are not silently resolved in
  Pi, and no `drenyra-ai` file was changed

## REQ-BOUND — Boundaries

### Requirement: REQ-BOUND-001 — No RDA v2 implementation in Pi

The system MUST NOT implement RDA v2 fiscal authority in Pi and MUST NOT carry
SDD-020, SDD-030, SDD-050, SDD-070, SDD-080, SDD-090, or SDD-110 work: no new
materiality, transition, risk-level, approval, gate, receipt, ledger, or
UNKNOWN-retry logic. Source changes are limited to removing or delegating a
demonstrated boundary violation.

#### Scenario: SC-BOUND-001 — Candidate contains no new fiscal authority logic

- GIVEN the final candidate
- WHEN the changed paths are inspected
- THEN no new RDA v2 authority implementation or other gated SDD work exists,
  and any source change is limited to removing or delegating a demonstrated
  boundary violation with regression evidence

### Requirement: REQ-BOUND-002 — Runtime pin unchanged and released-only

The system MUST keep the runtime pinned to the published `drenyra-ai@0.2.0`
artifact with the documented checksum
(`e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`), MUST NOT
consume unreleased drenyra-ai modules (no unpublished configurator or routing
surface), and MUST NOT bump the pin without a separately authorized published
artifact.

#### Scenario: SC-BOUND-002 — Pin and checksum unchanged

- GIVEN the final candidate
- WHEN `package.json` and `runtime/pin.ts` are inspected
- THEN the devDependency remains the published `drenyra-ai@0.2.0` artifact with
  the documented checksum, and no unpublished module is consumed

### Requirement: REQ-BOUND-003 — No new command, agent, or operator workflow

The system MUST NOT add a new command, agent, or operator workflow; additions
are limited to the harness test, the substitute host, test utilities, the audit
artifact, and the architecture document.

#### Scenario: SC-BOUND-003 — No new commands or agents

- GIVEN the final candidate
- WHEN the command registry, `agents/`, and operator-facing surfaces are
  inspected
- THEN no new command, agent, or operator workflow was added

### Requirement: REQ-BOUND-004 — Local stores never become authoritative

The system MUST NOT convert Pi's local stores into an authoritative ledger or
receipt store: no local record MAY authorize, approve, or prove fiscal
execution, and any store guard added by this change MUST preserve that property.

#### Scenario: SC-BOUND-004 — Local persistence cannot authorize

- GIVEN the final candidate's local stores
- WHEN the non-authority guard or test runs
- THEN local persistence still cannot authorize, approve, or prove fiscal
  execution, and no store was reclassified as authoritative

### Requirement: REQ-BOUND-005 — Zero blind UNKNOWN retries

The system MUST NOT retry UNKNOWN blindly: no code path in the candidate MAY
re-submit or auto-advance an UNKNOWN mission without reconciliation or explicit
human action.

#### Scenario: SC-BOUND-005 — No blind retry path in the candidate

- GIVEN the final candidate
- WHEN the UNKNOWN-handling paths are inspected and the harness negative control
  runs
- THEN no blind retry or auto-advance of UNKNOWN exists, and the equivalence
  test fails when a blind retry is introduced

### Requirement: REQ-BOUND-006 — No master-repository edit and no out-of-band delivery

The system MUST NOT edit the `drenyra-ai` repository or its master SDD-040
closure, MUST NOT duplicate the master's 41-requirement mapping, and MUST NOT
perform publication, release, or delivery actions outside the normal PR flow for
this change.

#### Scenario: SC-BOUND-006 — Master untouched and delivery in-band

- GIVEN the final candidate
- WHEN the master repository state and the delivery surface are inspected
- THEN no `drenyra-ai` file was changed by this change, the master's
  41-requirement mapping is not duplicated, and no publication, release, or
  delivery action happened outside the normal PR flow

## Out of Scope

- Any RDA v2 fiscal-authority implementation in Pi or any other gated SDD work.
- Any edit to the `drenyra-ai` repository or its master SDD-040 closure.
- Consumption of unreleased drenyra-ai modules or a pin bump beyond
  `drenyra-ai@0.2.0` without a separately authorized published artifact.
- New commands, agents, operator workflows, or fiscal logic of any kind.
- Conversion of Pi's local stores into an authoritative ledger or receipt store.
- Blind retries or auto-advance after UNKNOWN.
- Duplication of the master's 41-requirement implementation mapping or its
  acceptance evidence.
- Resolving, relabeling, or re-implementing the master's five deferred
  vocabulary differences.
- Publication, release, or delivery outside the normal PR flow for this change.
