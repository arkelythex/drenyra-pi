# Skills Selection Specification

## Purpose

Defines Shell's consumption of the pinned Core's `drenyra-ai/skills`
`SkillRegistry.resolveAt()` at the routing-preflight call site, so
`WorkUnitInput.skills` reflects real, validity- and jurisdiction-scoped
skill resolution instead of a permanently hardcoded empty array. Shell remains
a thin consumer: it never forks, reimplements, or locally re-derives skill
selection logic that the Core already owns.

**Production-reality disclosure**: no `MissionIntent -> skill id` mapping
exists in Shell today; none of the five `MissionIntent` values match any
`BASE_PE_SKILLS` id. A production call built from a real
`MissionIntent`-derived `taskId` therefore typically raises
`SKILL_NOT_FOUND` and resolves an empty `WorkUnitInput.skills`. This wiring
is real and correctly fails closed, but it will not usually select a skill
in current production traffic; inventing a mapping to force a match is out
of this change's authority.

## Requirements

### Requirement: REQ-SKILLS-001 — Real resolver call populates `WorkUnitInput.skills`

The system MUST populate `WorkUnitInput.skills` at the routing-preflight
call site by calling the pinned Core's `SkillRegistry.resolveAt(taskId, at,
jurisdiction)` from the `drenyra-ai/skills` subpath. The system MUST NOT
populate `WorkUnitInput.skills` with a hardcoded empty array, a locally
computed value, or any locally-reimplemented selection mechanism.

#### Scenario: SC-SKILLS-001 — Resolver call replaces the hardcoded empty array

- GIVEN a routing-preflight invocation that constructs `WorkUnitInput`
- WHEN the construction site runs
- THEN `SkillRegistry.resolveAt(taskId, at, jurisdiction)` is called from
  the `drenyra-ai/skills` subpath and its result populates
  `WorkUnitInput.skills`, and no hardcoded `[]` or local selection logic is
  used

#### Scenario: SC-SKILLS-002 — Valid resolution selects the matching skill

- GIVEN a valid task, jurisdiction, and date for which the Core resolves a
  current, jurisdiction-matching skill (a test fixture supplying a matching
  `taskId` directly — demonstrates the mechanism, not a claim about
  production `MissionIntent` traffic; see Purpose)
- WHEN `SkillRegistry.resolveAt()` is called at the routing-preflight call
  site
- THEN the resolved skill is present in `WorkUnitInput.skills`

### Requirement: REQ-SKILLS-002 — Fail-closed rejection on any `SkillError` code

A skill resolution that raises `SkillError` MUST be rejected and excluded
from `WorkUnitInput.skills`, regardless of which of its five codes is
raised (`SKILL_INVALID`, `SKILL_CHECKSUM_MISMATCH`, `SKILL_NOT_FOUND`,
`SKILL_OUT_OF_VALIDITY`, `SKILL_JURISDICTION_MISMATCH`). The system MUST
NOT silently substitute a different match, silently serve a stale skill as
if it were still current, or silently serve a skill across jurisdictions.

#### Scenario: SC-SKILLS-003 — Out-of-validity skill is excluded, not served

- GIVEN a skill resolution that raises `SkillError` with code
  `SKILL_OUT_OF_VALIDITY`
- WHEN the routing-preflight call site processes that result
- THEN the stale skill is excluded from `WorkUnitInput.skills` and is never
  silently substituted as current

#### Scenario: SC-SKILLS-004 — Jurisdiction-mismatched skill is excluded, not served

- GIVEN a skill resolution that raises `SkillError` with code
  `SKILL_JURISDICTION_MISMATCH`
- WHEN the routing-preflight call site processes that result
- THEN the mismatched skill is excluded from `WorkUnitInput.skills` and is
  never silently served across jurisdictions

#### Scenario: SC-SKILLS-008 — Unmatched task resolves `SKILL_NOT_FOUND` and is excluded

- GIVEN a skill resolution called with a `taskId` that matches no
  registered skill id — the honest production case, since no
  `MissionIntent` value matches any `BASE_PE_SKILLS` id today
- WHEN the routing-preflight call site processes the raised `SkillError`
  with code `SKILL_NOT_FOUND`
- THEN `WorkUnitInput.skills` resolves to an empty array and no skill is
  silently substituted

### Requirement: REQ-SKILLS-004 — No fork, copy, or re-embed of Core skill content

The system MUST NOT fork, copy, or re-embed `BASE_PE_SKILLS` or any other
Core skill content or checksums into Shell. Skill resolution MUST always call
the Core `drenyra-ai/skills` module directly.

#### Scenario: SC-SKILLS-005 — No local skill content exists in Shell

- GIVEN the Shell codebase after this change
- WHEN it is inspected for skill content or checksums
- THEN no `BASE_PE_SKILLS` (or equivalent) content is forked, copied, or
  re-embedded, and every resolution path calls the Core module directly

### Requirement: REQ-SKILLS-005 — Honest capability manifest evidence

Skill-resolver evidence (source file, test file, and a `verificationLevel`
note reading `unit-or-contract-tested`, not `validated-end-to-end`) MUST be
added into the EXISTING `drenyra-commands` capability row's
`evidence.sources`, `evidence.tests`, and `evidence.note` fields in
`capability-manifest.yaml` and the conformance matrix, following the
existing `evidence.note` convention (`verificationLevel: <path> = <tag>
(<citation>)`). The system MUST NOT add a new top-level capability key, and
MUST NOT modify `MASTER_CAPABILITIES` or the `state` enum — that list is
closed at exactly ten names with no free slot. This change MUST NOT alter
the existing `Referenced-only` program-ownership tag for `packaged-skills`
(SDD-070).

#### Scenario: SC-SKILLS-006 — Manifest evidence is folded into the existing `drenyra-commands` row

- GIVEN `capability-manifest.yaml` and the conformance matrix after this
  change
- WHEN the `drenyra-commands` row is inspected
- THEN `evidence.sources`/`evidence.tests` list the skill-resolver source
  and test files, `evidence.note` carries a `verificationLevel:
  lib/routing/skill-resolver.ts = unit-or-contract-tested` line with no
  `validated-end-to-end` claim, no new top-level capability key exists,
  `MASTER_CAPABILITIES` and the `state` enum are unmodified, and
  `packaged-skills`'s `Referenced-only` tag is unchanged

### Requirement: REQ-SKILLS-006 — Unrelated routing behavior unchanged

Existing `/drenyra:status route` behavior for callers unrelated to skill
resolution MUST remain unchanged. This wiring MUST be additive only.

#### Scenario: SC-SKILLS-007 — Non-skill-relevant callers unaffected

- GIVEN the pre-existing `/drenyra:status route` test suite for callers
  unrelated to skill resolution
- WHEN it runs after `WorkUnitInput.skills` is wired to the real resolver
- THEN every pre-existing test passes unmodified

## Out of Scope

Engram/memory client, protocol, or read/write path — no Core API exists to
consume it, and this spec makes no claim about memory integration.
