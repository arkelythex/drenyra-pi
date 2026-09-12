# Exploration — pi-capability-conformance

**Status:** explored; proposal not yet written. This is SDD 1 of 6, and the user's six-change order is authoritative. No implementation, deletion, cleanup, commit, or scope expansion was performed.

## Executive finding

The repository has a capability manifest and a richer conformance matrix, but they are not generated from one authoritative evidence model and carry conflicting snapshots and verification vocabulary. The bounded first slice should reconcile/document capability evidence and stale references only; it must not implement new capabilities, alter frozen contracts, change Dominion ownership, or pursue Engram integration.

## Repository and authority context

- `openspec/config.yaml` establishes Bun/TypeScript ESM, Vitest, strict TDD, and file-backed OpenSpec artifacts. It is itself stale (`37 files / 582 tests`, dated 2026-08-14) relative to the newer matrix evidence.
- `AGENTS.md`, `README.md`, `contracts/README.md`, and `docs/architecture/ecosystem-boundaries.md` consistently establish Pi as an operator/adapter: fiscal authority, gates, receipts, and engine semantics remain in the pinned `drenyra-ai`; Pi must not duplicate them.
- `README.md` and `ROADMAP.md` state that the Dominion master owns the complete SDD catalog and Pi references rather than duplicates it. Local active roles are the SDD-020/030/040 participant surfaces; SDD-050/070/080/090/110 and other master SDDs must remain reference-only.
- `openspec/changes/archive/` contains historical and superseded changes, including prior participation and program-status reconciliation work. Those artifacts are historical evidence, not current implementation authority.

## Capability evidence audit

### Manifest (`capability-manifest.yaml`)

Ten capability keys are present. States are `implemented` or `partial`; no manifest verification-level field exists. Evidence is hand-authored and the embedded test state says `44 files / 700 passing`, generated 2026-08-14. The `engram-integration` row is correctly limited to a development-grade local JSON context store and says no complete executable integration is evidenced.

### Matrix (`docs/architecture/capability-conformance-matrix.md`)

The matrix is the stronger current point-in-time evidence surface. It records a dirty candidate identity dated 2026-09-09 and an independently verified baseline of `47 test files / 717 passing / 0 failed`. It defines four levels (`declared-only`, `implemented`, `unit-or-contract-tested`, `validated-end-to-end`) and explicitly says no capability is currently validated end-to-end.

The matrix documents 20 registered commands, exact source/test citations, bounded in-process chain evidence, advisory model routing, referenced-only packaged skills and Engram ownership, and the pinned `drenyra-ai@0.4.1` checksum anchor. It also records follow-ups: typed verification levels/generator support, controlled-vocabulary notes, operational Engram E2E, and keeping full-tree receipt expansion separate.

## Contradictions and stale claims

1. **Snapshot drift:** manifest `44/700` (2026-08-14), OpenSpec config `37/582` (2026-08-14), matrix `47/717` (baseline, 2026-09-09), plus distinct dirty identities in matrix and lock facts. These must not be presented as one run.
2. **Verification semantics:** manifest states capability status but cannot express the matrix's four evidence levels. The matrix calls `engram-integration` `implemented` while its boundary text says only a local store is evidenced and no operational integration exists; this is semantically confusing and should likely become `partial`/equivalent without inventing a new enum.
3. **Command-count wording:** matrix notes a historical test name claiming 15 commands while asserting 20; README exposes the current 20-command surface. Historical wording must not be treated as current evidence.
4. **Ownership ambiguity:** `packaged-skills` and `engram-integration` are local content/boundary rows but explicitly `Referenced-only` programs. Any conformance work must not upgrade ownership or add top-level master capability names.
5. **README visual flow:** the operational-flow image depicts Engram, while prose explicitly says executable Engram integration is absent. This is a communication risk, not evidence of implementation.
6. **Legacy surface:** `contracts/package-contract.md` mentions legacy structured `not_available` helpers in `extensions/mission-commands.ts` that are no longer wired. They should be tracked, not deleted in this change; deletion could affect frozen/package verification or historical consumers.

## Tests and verification surface

Relevant checks are `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`. Existing evidence is primarily unit/contract and in-process integration; no live installed operational E2E is claimed. Capability tests include `__tests__/capability-manifest.test.ts`, extension/routing tests, content/agent tests, chain tests, pin/configurator tests, and contract/package verification tests. A future proposal should first establish the authoritative snapshot and test command, then add tests for reconciliation/invariants before changing claims.

## Dirty work and safety

The matrix and lock-facts contain dirty candidate identities, demonstrating worktree-sensitive state, but this read-only tool surface cannot provide a literal `git status` listing. Preserve all existing user changes. Before implementation, the parent must obtain and record `git status --short` and separate pre-existing modifications from owned files. Do not refresh lock facts, checksums, snapshots, or generated artifacts during exploration or opportunistic cleanup.

## Bounded first-slice recommendation

Propose a documentation/conformance slice limited to:

- define one current snapshot convention and distinguish verified baseline from dirty candidate identity;
- reconcile README, ROADMAP, manifest, matrix, OpenSpec config, and lock-facts references without changing frozen schemas/contracts or master ownership;
- make capability verification-level terminology and the `engram-integration` limitation internally consistent using existing vocabulary;
- add/adjust static conformance tests or a verifier only if required to prevent recurrence, with no new capability implementation;
- explicitly retain legacy files/helpers and defer Engram, model-routing APIs, full-tree receipts, and all other five proposed changes.

**Next phase input:** proposal should decide whether this slice is documentation-only or includes a narrowly scoped manifest/matrix consistency test. It must define acceptance evidence and a stop condition before any write beyond this artifact.

## Risks and unresolved ambiguity

- The actual six-change list and their dependency boundaries are not present in this repository; only the user's ordering is authoritative here. Do not infer the other five scopes.
- Current dirty status, exact test counts, and lock-facts may change before proposal/apply; stale evidence must fail closed rather than be silently refreshed.
- `contracts/` and checksum manifests are frozen; even apparently editorial changes may trigger package verification or require explicit review.
- Removing legacy helpers or archived artifacts is unsafe and explicitly out of scope.
