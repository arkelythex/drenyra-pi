# Design: Shell Capability Conformance

## Technical approach

Introduce a single repository-local conformance evidence model for the capability manifest and matrix, while preserving the existing public manifest shape unless a compatibility-safe additive field is required. The implementation should prefer a deterministic verifier over duplicated hand-written claims. Documentation consumes the verifier's vocabulary; it does not infer operational status from source-file existence alone.

The first implementation unit is an offline evidence validator. It reads the manifest, matrix metadata, OpenSpec context, and lock-facts using repository-relative paths, validates closed vocabularies and snapshot identity semantics, and reports actionable failures. A second unit reconciles the current documentation and generated facts against the validator's output. Existing user modifications must be classified before either unit is applied.

## Architecture decisions

### Evidence authority

`capability-manifest.yaml` remains the machine-readable capability inventory. The conformance matrix remains the human-readable evidence explanation. `docs/architecture/program-lock-facts.json` remains generated/locked evidence, not a source of truth for capability ownership. README and ROADMAP are narrative projections and must link to or summarize the machine-readable evidence without creating contradictory current-state facts.

### Verification vocabulary

Use the four existing matrix levels: `declared-only`, `implemented`, `unit-or-contract-tested`, and `validated-end-to-end`. Keep capability state (`implemented`/`partial`), verification level, ownership, and authority as separate concepts. Do not broaden `validated-end-to-end`: only reproducible installed-package or runtime evidence qualifies.

### Snapshot model

A current snapshot must be represented by a command, complete result, date, candidate identity, and explicit baseline/dirty classification. Historical snapshots remain valid only when labeled historical/baseline and sourced. The verifier should compare current claims across surfaces and fail on incompatible unlabeled values. It must not calculate or refresh identities automatically during normal verification.

### Ownership and legacy

Ownership is a documentation/conformance concern, not a new runtime authority. The validator checks that referenced-only/kernel-consumed rows are not advertised as Shell-owned or operationally complete. Legacy inventory is additive evidence. Deletion is intentionally deferred until a later work unit has replacement and compatibility proof.

## Data flow

```text
manifest + matrix + README/ROADMAP references + OpenSpec config + lock facts
        │
        ▼
parse and validate current evidence records
        │
        ├── vocabulary / required-field checks
        ├── snapshot and historical distinction checks
        ├── ownership / verification boundary checks
        └── cross-surface consistency checks
        │
        ▼
deterministic conformance result (pass or diagnostics)
        │
        ▼
updated documentation and focused tests
```

## Proposed file changes

| File or area | Change |
| --- | --- |
| `scripts/verify-capability-manifest.mjs` or a new narrowly scoped verifier | Parse and validate evidence, snapshots, ownership, and end-to-end claims offline. Reuse existing package conventions; do not duplicate fiscal logic. |
| `__tests__/capability-manifest.test.ts` and/or a focused conformance test | Positive fixture-free repository validation plus deterministic negative cases for malformed evidence. Keep tests with the guard. |
| `capability-manifest.yaml` | Add only the minimum additive metadata needed for explicit verification level/ownership/snapshot semantics, or document why matrix-only metadata is retained. |
| `docs/architecture/capability-conformance-matrix.md` | Reconcile rows, levels, snapshot labels, Engram/skills limitations, and historical command wording. |
| `README.md`, `ROADMAP.md` | Remove stale current-state implications and link to the reconciled evidence source. |
| `openspec/config.yaml` | Update only verified current test-state metadata if the change's exact verification run supports it. |
| `docs/architecture/program-lock-facts.json` and generator inputs | Refresh only through the established exact command after the candidate is stable; never hand-edit a checksum or identity. |
| legacy files | Inventory/disposition only; no deletion without separate replacement evidence. |

The exact verifier filename and manifest field shape remain design details to confirm against existing scripts and package verification before tasks are finalized. Frozen `contracts/` files and external `drenyra-ai` sources are outside the edit surface.

## Testing strategy

Strict TDD applies:

1. **RED:** add tests that fail for conflicting current snapshots, invalid levels/ownership, unsupported end-to-end claims, and missing evidence fields.
2. **GREEN:** implement the smallest parser/validator and update only the evidence records needed for a truthful pass.
3. **TRIANGULATE:** test historical-vs-current records, dirty-vs-baseline identity, malformed input, deterministic ordering, and package verification interactions.
4. **REFACTOR:** remove duplicated parsing/constants, keep diagnostics stable, and document the final evidence command.

Focused checks should include `bun test`, `bun run typecheck`, `bun run verify:capability`, `bun run verify:package`, and `bun run verify:style`. A failing check is a blocker, not a reason to weaken the guard.

## Rollout and rollback

Apply as reviewable work units:

1. validator and focused tests;
2. evidence/documentation reconciliation;
3. generated snapshot refresh and package verification, only if justified by exact evidence;
4. legacy inventory/disposition documentation.

Rollback each unit independently by reverting its owned files. Never revert pre-existing dirty work or regenerate identities from an unrelated worktree. If the validator cannot represent the current evidence without changing a frozen contract, stop and record the dependency for a separately approved contract change.

## Security and authority boundaries

The verifier is read-only with respect to fiscal authority, network, credentials, receipts, and approvals. It must not invoke fiscal operations or interpret a conformance pass as authorization. It runs offline and must not read secrets or ambient user data. Shell remains an operator and evidence consumer; the pinned kernel remains the authority for fiscal semantics.

## Open decisions for tasks

- Confirm whether the existing manifest format can carry verification/ownership metadata additively or whether matrix-only metadata plus a verifier is safer.
- Confirm the established generator/identity command before refreshing lock facts.
- Resolve the exact set of legacy files eligible only for inventory; deletion is not part of this SDD by default.
