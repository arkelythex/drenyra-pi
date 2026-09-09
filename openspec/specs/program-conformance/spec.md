# Program Conformance Specification

## Purpose

Defines the evidence-cited capability conformance matrix: a point-in-time,
commit-scoped artifact that tags every `drenyra-pi` capability with a
verification level backed by a checkable citation, so README, ROADMAP, and
`capability-manifest.yaml` cannot silently drift into contradiction again.
This is a new capability with no prior spec; every requirement below is
additive.

## ADDED Requirements

### Requirement: REQ-CONF-001 — Evidence-cited capability rows

The capability matrix MUST cite concrete, checkable evidence for every listed
capability: a `file:line` reference, an exact test name, or both. A row MUST
NOT be published on self-reported status alone.

#### Scenario: Citation present on publish

- GIVEN a capability row drafted for the matrix
- WHEN the matrix is published
- THEN the row carries at least one `file:line` reference or exact test name

#### Scenario: Uncited row rejected

- GIVEN a drafted row with no `file:line` or test-name citation
- WHEN the matrix is finalized
- THEN that row MUST be excluded until a citation is added

### Requirement: REQ-CONF-002 — Four-tier verification level taxonomy

Every row MUST be tagged with exactly one of four verification levels:

| Level | Entry criteria |
|---|---|
| `declared-only` | Named in docs/manifest; no cited source file and no cited test |
| `implemented` | Source exists at a cited `file:line`; no automated test cited |
| `unit-or-contract-tested` | A cited unit or contract test exercises the capability's logic in isolation |
| `validated-end-to-end` | A cited test or recorded run exercises the full invocation path (command/chain through observable output) |

The matrix MUST state that this four-level scheme synthesizes Kubernetes-style
evidence-gated readiness and Backstage-style manifest embedding as this
project's own taxonomy, and MUST NOT claim it mirrors either standard 1:1.

#### Scenario: Single tag per row

- GIVEN a capability row
- WHEN the matrix is built
- THEN it is tagged with exactly one of the four defined levels

#### Scenario: Level matches strongest citation

- GIVEN a capability cited only by source location, with no test
- WHEN its level is assigned
- THEN it is tagged `implemented`, not `unit-or-contract-tested` or higher

### Requirement: REQ-CONF-003 — Commit-scoped, non-evergreen snapshot

The matrix MUST declare the exact commit SHA or `dirty-sha256:<hash>` it was
audited against, following the `docs/architecture/program-lock-facts.json`
convention, plus an evidence date, and MUST state it is a point-in-time
snapshot rather than an evergreen document.

#### Scenario: Dirty tree labeled

- GIVEN the matrix is audited against an uncommitted working tree
- WHEN it is published
- THEN it records a `dirty-sha256:<hash>` identity and an evidence date

#### Scenario: Snapshot disclaimer present

- GIVEN the published matrix
- WHEN a reader opens it
- THEN it explicitly disclaims evergreen accuracy beyond its recorded SHA

### Requirement: REQ-CONF-004 — README/ROADMAP/matrix non-contradiction

README.md and ROADMAP.md MUST NOT contradict each other or the matrix on any
capability's shipped/unshipped status.

#### Scenario: Consistent shipped status

- GIVEN a capability marked shipped in the matrix
- WHEN README.md and ROADMAP.md are checked
- THEN neither document marks that capability unshipped or missing

#### Scenario: Contradiction blocks publication

- GIVEN README.md and ROADMAP.md disagree on a capability's status
- WHEN the matrix is finalized
- THEN the contradiction MUST be resolved before publication

### Requirement: REQ-CONF-005 — Single active conformance change

At most one OpenSpec change folder governing capability-conformance or
reconciliation status MAY be open under `openspec/changes/` at a time. A
superseded change MUST be archived, not left open alongside a newer one.

#### Scenario: Superseded change archived

- GIVEN a newer conformance change supersedes an older open one
- WHEN the newer change is finalized
- THEN the older change folder is moved under `openspec/changes/archive/`

#### Scenario: Duplicate active change flagged

- GIVEN two open change folders both governing conformance status
- WHEN this is detected
- THEN one MUST be archived before either is treated as current

### Requirement: REQ-CONF-006 — Manifest coverage for wired capabilities

`capability-manifest.yaml` MUST have a row, using its existing schema fields
(`state`, `evidence.sources`, `evidence.tests`), for every capability backed
by a live, tested `/drenyra:*` command or chain.

#### Scenario: Wired chain has a manifest row

- GIVEN a chain module wired to a `/drenyra:*` command and covered by tests
- WHEN the manifest is checked
- THEN it has a row citing that chain's source and test files

#### Scenario: Untested chain not overclaimed

- GIVEN a chain module with no cited test
- WHEN its manifest row is written
- THEN its `state` MUST NOT claim a tested level it has no citation for

## Out of Scope

`capability-manifest.yaml` schema/tooling redesign (generator, lint-check);
fixes inside `drenyra-ai` itself; and any rewrite of
`docs/architecture/ecosystem-boundaries.md` beyond correcting stale counts.
