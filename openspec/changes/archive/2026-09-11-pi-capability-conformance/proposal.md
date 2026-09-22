# Proposal: Shell Capability Conformance

**Status:** Proposal ready for specification, subject to native SDD status validation.

## Intent

Make Drenyra-Shell's public capability story truthful and reproducible. README, roadmap, capability manifest, conformance matrix, OpenSpec project context, and lock-facts must distinguish current implementation, test evidence, operational validation, master-owned references, and historical snapshots. This change is the first local SDD in the six-change sequence and establishes the evidence discipline used by later changes.

## Problem

The repository currently contains multiple point-in-time test counts and candidate identities, while the manifest and matrix use different verification vocabularies. Some wording makes partial local behavior look like complete operational integration, especially for Engram and packaged skills. Legacy helpers and frozen contract files also exist, but their removal has not been proven safe.

## Scope

1. Define one explicit snapshot convention for current evidence, including command, timestamp, candidate identity, test count, and baseline/dirty distinction.
2. Reconcile README, ROADMAP, `capability-manifest.yaml`, `docs/architecture/capability-conformance-matrix.md`, `openspec/config.yaml`, and program lock-facts where they make current-state claims.
3. Align capability verification terminology with the existing matrix vocabulary without changing frozen public contract schemas or inventing a new capability state.
4. Make ownership boundaries explicit: Shell consumes the pinned kernel; Dominion/master-owned capabilities remain referenced-only; local partial behavior is not advertised as end-to-end validation.
5. Add narrowly scoped static/conformance tests or verifier assertions only where they prevent the same contradiction from recurring.
6. Inventory legacy surfaces and document a safe removal criterion. Do not delete a legacy helper solely because it is unused.

## Non-goals

- Implementing new fiscal, routing, skill, memory, monthly-close, recovery, or release capabilities.
- Implementing Engram or selecting a memory backend.
- Changing `drenyra-ai`, its pin, public contracts, receipts, gates, or authority decisions.
- Adding Shell-local mission-to-skill mappings or replacing kernel-owned policy.
- Deleting archived OpenSpec artifacts, legacy helpers, compatibility paths, or frozen contract files without a separately verified migration boundary.
- Refreshing generated checksums or lock facts opportunistically from an unverified dirty worktree.
- Advancing SDDs 2–6 inside this change.

## Requirements

### R1 — Truthful capability evidence

Every advertised capability has a current evidence classification using the repository's existing vocabulary: declared-only, implemented, unit-or-contract-tested, or validated-end-to-end. A claim of validated end-to-end requires reproducible installed-package/runtime evidence, not fixture-only tests.

### R2 — Snapshot integrity

Current evidence identifies its exact test command, result, date, and candidate identity. Historical baselines are labeled as historical and cannot be presented as the current dirty candidate. Stale or conflicting snapshots fail verification rather than being silently merged.

### R3 — Ownership boundaries

Documentation and tests preserve the distinction between Shell-local implementation, kernel-consumed behavior, referenced-only Dominion capabilities, and unavailable operational integrations. No local evidence upgrades master ownership or grants fiscal authority.

### R4 — Cross-surface consistency

README, roadmap, manifest, matrix, OpenSpec context, and lock-facts agree on capability state, verification level, ownership, and snapshot semantics, or explicitly identify why a value is historical or generated.

### R5 — Legacy safety

The change records legacy surfaces and their consumers. Removal is permitted only when a replacement, compatibility decision, package verification, and focused regression evidence exist. Unproven legacy remains retained and explicitly marked for a later bounded change.

### R6 — Reproducible conformance guard

A focused verifier or test suite detects at least: contradictory verification levels, stale current snapshot claims, invalid capability keys/states, ownership upgrades, and unlabelled end-to-end claims. It must be deterministic and must not depend on network access or ambient secrets.

## Affected areas

- `README.md`, `ROADMAP.md`
- `capability-manifest.yaml`
- `docs/architecture/capability-conformance-matrix.md`
- `openspec/config.yaml`
- `docs/architecture/program-lock-facts.json` and any documented generator/source
- focused capability/package/conformance tests and, if justified, one verifier script
- `openspec/changes/pi-capability-conformance/` artifacts

`contracts/` is read-only unless a separately approved contract version/migration is required. Existing user modifications must be preserved and separated from this change before implementation.

## Acceptance evidence

- A reproducible verification command reports a single clearly labeled current snapshot and distinguishes it from historical baselines.
- Every capability row has an internally consistent state, verification level, owner, source, and test evidence.
- The matrix and manifest no longer imply operational Engram/skills integration or end-to-end validation when only local/unit evidence exists.
- README and roadmap point to the same current capability/conformance source and retain Dominion ownership boundaries.
- Negative tests fail for stale/conflicting snapshot metadata, unknown states/levels, ownership escalation, and unsupported end-to-end claims.
- `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style` pass for the resulting candidate, or any failure is recorded as an explicit blocker.
- No legacy file is deleted in this SDD unless its replacement and compatibility evidence are included in the same bounded work unit.

## Implementation constraints

Use strict TDD: RED, GREEN, TRIANGULATE, REFACTOR. Keep tests with the behavior they verify. Do not compress or omit documentation to meet the 400-line review budget; if the honest slice exceeds it, split by work unit using the approved auto-chain strategy.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Dirty work is mistaken for this SDD's work | Capture and preserve `git status --short`; use an explicit owned-file allowlist before apply. |
| Generated lock facts or checksums are refreshed from stale evidence | Require exact command output and candidate identity before regeneration. |
| Partial implementation is advertised as production integration | Keep verification level and ownership separate; require installed/runtime evidence for end-to-end claims. |
| Legacy cleanup breaks compatibility or package verification | Inventory first; defer deletion until a separate acceptance-backed removal unit. |
| Scope expands into the other five SDDs | Stop at evidence/conformance; record dependencies for later changes. |

## Rollback

Rollback is limited to reverting the files owned by this SDD's work units and removing its conformance guard if it proves incompatible. Do not revert pre-existing dirty changes, frozen contracts, or unrelated chain/runtime work. Documentation-only corrections can be reverted independently from any verifier/test addition.

## Success criteria

- The repository has one honest, reproducible capability evidence model.
- Contradictory snapshot and verification claims are either reconciled or explicitly labeled historical.
- Ownership and non-authority boundaries remain visible and testable.
- Legacy surfaces have a documented disposition without unsafe deletion.
- The resulting artifact is a safe foundation for SDD 2 and does not claim completion of any later SDD.

## Blockers and dependencies

The pinned kernel remains authoritative for fiscal behavior and any future skill/memory contract. This SDD cannot resolve missing upstream capabilities. Existing dirty work must be classified before apply. A native SDD status/phase gate must approve the next phase before specification work begins.
