# Delta for Program Conformance

## MODIFIED Requirements

### Requirement: REQ-CONF-001 — Evidence-cited capability rows

Every advertised capability MUST have current, checkable evidence and an explicit verification classification. Evidence MUST identify the supporting source, exact test, recorded runtime/package result, or an explicit statement that no such evidence exists. A capability MUST NOT be presented as implemented, tested, or operational solely on self-reported status.

(Previously: Matrix rows required a source or test citation but did not require explicit current-evidence classification across advertised surfaces.)

#### Scenario: Evidence supports an advertised classification

- GIVEN a capability is advertised in a current-state surface
- WHEN its conformance evidence is evaluated
- THEN its classification and claim are supported by checkable evidence appropriate to that classification

#### Scenario: Unsupported capability claim is rejected

- GIVEN an advertised capability has no supporting current evidence
- WHEN conformance is verified
- THEN the capability MUST NOT be represented as implemented, tested, or validated

### Requirement: REQ-CONF-002 — Four-tier verification level taxonomy

Every current capability claim MUST use exactly one of these verification levels: `declared-only`, `implemented`, `unit-or-contract-tested`, or `validated-end-to-end`. `validated-end-to-end` MUST be supported by reproducible installed-package or runtime evidence exercising the complete observable invocation path; fixture-only, isolated unit, contract, or in-process evidence MUST NOT qualify. The taxonomy MUST remain distinct from capability state and ownership, and MUST NOT be represented as a one-to-one adoption of an external standard.

(Previously: End-to-end validation could be established by any cited full invocation-path test, without requiring reproducible installed-package or runtime evidence.)

#### Scenario: Single verification level per current claim

- GIVEN a current capability claim
- WHEN its verification level is published
- THEN it has exactly one defined verification level

#### Scenario: Fixture-only evidence does not qualify as end-to-end

- GIVEN a capability is supported only by fixture, isolated unit, contract, or in-process evidence
- WHEN its verification level is evaluated
- THEN it MUST NOT be classified as `validated-end-to-end`

#### Scenario: Reproducible runtime evidence qualifies for end-to-end

- GIVEN a recorded, reproducible installed-package or runtime execution exercises a complete observable invocation path
- WHEN its verification level is evaluated
- THEN it MAY be classified as `validated-end-to-end`

### Requirement: REQ-CONF-003 — Identified, non-evergreen evidence snapshots

Every current evidence snapshot MUST identify the exact verification command, complete result, evidence date, candidate identity, and whether it is a verified baseline or a dirty candidate. A snapshot MUST state that it is point-in-time evidence rather than evergreen status. Historical baselines and historical command-count or test-count claims MUST be explicitly labeled historical and MUST NOT be presented as evidence for the current dirty candidate. Conflicting or stale current snapshot metadata MUST cause conformance verification to fail.

(Previously: The matrix required candidate identity and date, but not command, result, baseline/dirty distinction, or failure on conflicting current metadata.)

#### Scenario: Current dirty candidate is fully identified

- GIVEN evidence is recorded for an uncommitted candidate
- WHEN it is published as current evidence
- THEN it records the verification command, complete result, evidence date, `dirty-sha256:<hash>` identity, and dirty-candidate classification

#### Scenario: Verified baseline is distinguished from current candidate

- GIVEN a historical or verified baseline is retained beside current evidence
- WHEN a reader or verifier evaluates the records
- THEN the baseline is labeled historical or baseline and is not presented as the current dirty candidate

#### Scenario: Conflicting current snapshots fail

- GIVEN two current-state surfaces report incompatible command results, candidate identities, or snapshot classifications without an explicit historical distinction
- WHEN conformance verification runs
- THEN verification MUST fail

### Requirement: REQ-CONF-004 — Cross-surface capability consistency

README.md, ROADMAP.md, `capability-manifest.yaml`, the capability conformance matrix, OpenSpec project context, and program lock-facts MUST agree on each current capability's state, verification level where represented, ownership, and snapshot semantics. A surface MAY retain a differing value only when it explicitly identifies that value as historical or generated and identifies its source. Current surfaces MUST NOT imply operational Engram or packaged-skills integration, or end-to-end validation, when only local, unit, contract, or referenced-only evidence exists.

(Previously: Consistency was limited to README, ROADMAP, and matrix shipped/unshipped status.)

#### Scenario: Current surfaces agree

- GIVEN a capability has a current conformance record
- WHEN all current-state surfaces are checked
- THEN their capability state, ownership, verification claim, and snapshot meaning are consistent with that record

#### Scenario: Historical or generated value remains explainable

- GIVEN a surface retains a value different from the current snapshot
- WHEN conformance is verified
- THEN the value is explicitly labeled historical or generated and identifies its source

#### Scenario: Unsupported operational implication is rejected

- GIVEN a current surface portrays Engram or packaged skills as an operational end-to-end integration
- WHEN the available evidence is only local or referenced-only
- THEN conformance verification MUST fail

## ADDED Requirements

### Requirement: REQ-CONF-007 — Ownership and authority boundaries

Capability evidence MUST identify whether behavior is Shell-local, consumed from the pinned kernel, referenced-only under Dominion/master ownership, or unavailable as an operational integration. Shell-local documentation, tests, and conformance records MUST NOT upgrade kernel or Dominion/master-owned behavior to Shell ownership, grant Shell fiscal authority, or represent referenced-only behavior as locally validated end-to-end.

#### Scenario: Kernel-consumed behavior retains kernel ownership

- GIVEN Shell invokes behavior exposed by the pinned Drenyra AI kernel
- WHEN the capability is documented or verified
- THEN the record identifies the behavior as kernel-consumed and does not attribute fiscal authority to Shell

#### Scenario: Referenced-only capability remains bounded

- GIVEN a Dominion/master-owned capability is referenced by Shell
- WHEN current conformance is published
- THEN it is identified as referenced-only and is not represented as Shell-local implementation or validation

#### Scenario: Ownership escalation is rejected

- GIVEN a current capability claim upgrades referenced-only or kernel-consumed behavior to Shell-local ownership
- WHEN conformance verification runs
- THEN verification MUST fail

### Requirement: REQ-CONF-008 — Legacy surface retention criteria

Every identified legacy capability, helper, compatibility path, or historical surface MUST have a recorded disposition and known consumers where discoverable. A legacy surface MUST remain retained unless a separately bounded change provides a replacement or explicit compatibility decision, package verification, and focused regression evidence. Lack of current wiring alone MUST NOT justify removal.

#### Scenario: Unproven legacy remains retained

- GIVEN a legacy helper has no proven replacement or compatibility decision
- WHEN this conformance change is completed
- THEN the helper remains retained and is recorded for later bounded review

#### Scenario: Evidence-backed future removal is eligible

- GIVEN a separately bounded change supplies a replacement or compatibility decision, package verification, and focused regression evidence
- WHEN the legacy surface is evaluated for removal
- THEN it MAY be removed by that separately bounded change

### Requirement: REQ-CONF-009 — Deterministic conformance guard

The repository MUST provide a focused, reproducible conformance guard that runs without network access or ambient secrets and rejects invalid capability keys or states, contradictory verification levels, stale or conflicting current snapshots, ownership escalation, and unsupported `validated-end-to-end` claims. The guard MUST produce a deterministic pass or failure result from the repository evidence supplied to it.

#### Scenario: Valid evidence passes reproducibly

- GIVEN consistent capability records, valid vocabulary, correctly classified ownership, and current snapshot evidence
- WHEN the conformance guard runs in equivalent offline environments
- THEN it produces a passing result

#### Scenario: Invalid evidence fails deterministically

- GIVEN capability records contain an invalid key or state, contradictory verification, stale current snapshot, ownership escalation, or unsupported end-to-end claim
- WHEN the conformance guard runs
- THEN it produces a failing result identifying the violated conformance condition
