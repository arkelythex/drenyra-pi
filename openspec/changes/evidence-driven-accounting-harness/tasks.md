# Tasks — Evidence-Driven Accounting Harness

> Change: `evidence-driven-accounting-harness` · Repo: `drenyra-pi` · Status: tasks drafted
> Store: HYBRID — this file is authoritative; Engram is best-effort
> Runtime baseline: pinned `drenyra-ai@0.2.0` (15 `AccountingMissionStatus` members — design §1, verified against `node_modules/drenyra-ai@0.2.0` d.ts)
> Delivery: **9 chained PRs**, strategy `ask-on-risk`, strict TDD (`bun test`), every PR ends green
> Scope bound: v0.1 Monthly Close Harness + EDA foundations (slices S1–S6). Post-v0.1 roadmap is out of scope.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ≈2,600–4,000 (source + tests + static content; planning estimate — apply must measure actual additions+deletions per PR) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → PR 9 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

**Why High and why Yes:** the change spans 9 feature areas, 6 slices, 9 new `lib/` modules, 4 contract families, 4 chains, 4 extension modules, 14+ commands, 7 agents, and packaged content — materially above one reviewable diff. Per `ask-on-risk`, the orchestrator must confirm the concrete chain boundary (and the missing `chain_strategy`) with the user before apply starts.

### Per-PR estimate table (planning budgets)

| PR | Boundary (branch) | Slice(s) | Est. files | Est. lines | Size watch |
|----|-------------------|----------|-----------|------------|------------|
| #1 | `eda/s1-contracts-scope-canonicalization` | S1 | ~14–18 | 380–480 | Yes — split contracts (T-S1-002/003) into a leading PR #1a if measured >450 |
| #2 | `eda/s2-authority-status` | S2 | ~10–14 | 380–470 | Yes — split status projection (T-S2-004) to its own PR if measured >450 |
| #3 | `eda/s3a-durable-missions` | S3a | ~8–10 | 350–450 | — |
| #4 | `eda/s3b-evidence-receipts` | S3b | ~10–12 | 320–420 | — |
| #5 | `eda/s4a-extension-foundations` | S4a | ~10–12 | 290–380 | — |
| #6 | `eda/s4b-mission-commands` | S4b | ~10–12 | 290–390 | — |
| #7 | `eda/s5a-reconcile-chain` | S5a | ~6–8 | 250–320 | — |
| #8 | `eda/s5b-verify-evidence-chains` | S5b | ~6–8 | 270–350 | — |
| #9 | `eda/s6-operating-content` | S6 | ~30–40 | 400–520 | Yes — mostly static; apply MUST land two work-unit commit groups (agents/assets, then skills/prompts/themes) and split into PR #9a/#9b if measured >450 |

## PR boundary plan

Slices follow design §17. The proposal's rough "6–7 PRs" is refined to **9** because (a) the contract families are versioned JSON Schemas plus conformance tests (REQ-CONTRACTS), not markdown docs, and (b) design §17 explicitly splits S3, S4, and S5 into work units. Dependencies are strict: each PR composes the contracts, scope identity, gates, and stores shipped by its predecessors; no PR invents parallel scope, state, or gate logic.

```text
PR #1  S1  contracts + scope model + canonicalization
  -> PR #2  S2  authority gates + store + accounting status
    -> PR #3  S3a durable mission stores + recovery + monthly-close upgrade
      -> PR #4  S3b evidence graph + trusted keys + receipt store/verification
        -> PR #5  S4a extension foundations (scope guard, status, banner, entrypoint, read commands)
          -> PR #6  S4b mission lifecycle commands (mission/continue/resume/receipt + pending shims)
            -> PR #7  S5a shared chain pipeline + reconcile chain
              -> PR #8  S5b verify + evidence chains + full monthly-close 12-step flow
                -> PR #9  S6 seven agents + assets + skills/prompts/themes + package verification
```

| PR | Name | Work unit (start → finish) | Verification gate | Rollback |
|----|------|----------------------------|-------------------|----------|
| #1 | S1 contracts/scope/canonicalization | contract families ship and validate → `bindScope` produces a stable `scopeHash` sensitive to all 10 elements | `bun test`, `bun run typecheck`, `bun run build`, `node scripts/verify-package-files.mjs` (unchanged script still passes) | Revert PR as unit; no stores or missions exist yet |
| #2 | S2 authority/status | mode matrix + gate pipeline + append-only authority store → status projection + EDA step derivation | `bun test`, `bun run typecheck`, `bun run build` | Revert; no durable mission data is written by this PR |
| #3 | S3a durable missions | `createDurableMissionStores` → fail-closed recovery → monthly-close chain on durable stores + 13-step plan | `bun test` incl. crash/replay; typecheck; build | Store schema versioned (v1); new stores only — no migration of old data |
| #4 | S3b evidence/receipts | evidence graph append/validate → trusted-key registry → receipt store + trusted verification | `bun test` incl. tamper/unknown/expired/revoked; typecheck; build | Immutable logs; disabling future writes never rewrites prior records |
| #5 | S4a extension foundations | scope-guard + mission-status + startup banner + entrypoint packaging + capabilities/scope/models | `bun test` incl. registration; `bun run build`; `node scripts/verify-package-files.mjs` (script updated in T-S4A-004) | Commands/panels removable by reverting registration; no persisted data touched |
| #6 | S4b mission commands | mission/continue/resume/receipt verify + evidence/verify/reconcile shim registrations (14/14 surface) | `bun test` incl. one-step continue + receipt matrix; typecheck; build | Handlers read/write stores only through lib; no new schemas |
| #7 | S5a reconcile chain | shared chain pipeline → reconcile chain (intent `reconciliation`) → wire `/drenyra:reconcile` body | `bun test` incl. anomaly/evidence-wait/proposal; typecheck; build | Chain is opt-in; monthly-close behavior unchanged |
| #8 | S5b verify/evidence chains | verify chain → evidence chain → wire remaining handler bodies → full monthly-close 12-step fixture flow | `bun test` incl. SC-CHAIN-001..006; typecheck; build | Verify chain never mutates; evidence additions append-only |
| #9 | S6 operating content | seven agents + asset mirrors + policies/schemas/chains → skills/prompts/theme → package-file verification | `bun test`, `bun run build`, `node scripts/verify-package-files.mjs` | Static content; no runtime authority (REQ-AGENT-005/006) |

**Chain strategy:** `pending` — the user chooses under `ask-on-risk` before apply: `stacked-to-main` (each PR merges to main in order; recommended default for this private repo: independent, revertible units per proposal §10) or `feature-branch-chain` (tracker `eda/v0.1-monthly-close`; children target the parent branch). Once chosen, it is fixed for the whole chain; do not mix strategies.

## Strict TDD note (applies to every code task)

- **Commands:** `bun test` (runner vitest; include pattern `**/__tests__/**/*.test.ts`), `bun run typecheck` (tsc strict, noEmit), `bun run build` (tsc → dist), `node scripts/verify-package-files.mjs`.
- **Sequence per task that adds code:** RED (write the failing test first, name the test file in the task) → GREEN (minimal implementation) → TRIANGULATE (edge cases from the SC list) → REFACTOR. Record per-phase evidence in apply-progress.
- **Test placement:** lib/unit tests under `__tests__/` (e.g. `__tests__/canonicalization.test.ts`); chain tests colocated under `chains/__tests__/`; extension tests extend `__tests__/extension.test.ts` or add `__tests__/extension-*.test.ts`.
- **Green gate per PR:** at the end of every PR, `bun test` (all suites incl. the 54 baseline tests — REQ-CHAIN-008), `bun run typecheck`, `bun run build` must pass. From PR #5 on, `node scripts/verify-package-files.mjs` must also pass.
- **Conventions:** money is `bigint` cents (never floats); digests are lowercase hex sha-256; new enums use the const-object-then-type pattern (`as const` + indexed type); flat interfaces; no `any`; local ESM imports use `.js` suffixes; new file stores mirror the atomic write pattern in `runtime/context.ts` (temp file + fsync + rename).
- **Build caveat (design §14):** `tsconfig.build.json` roots are `runtime`, `extensions`, `index.ts`; `lib/` and `chains/` ship in `dist/` only when included in the build. T-S1-001 adds both to the include sets, so every later module ships regardless of transitive imports.
- **Engine truth:** import only public `drenyra-ai` subpaths (`/missions`, `/gates`, `/receipts`, `/candidates`, `/ledger`, `/review`, `/recovery`). Never deep-import unexported surfaces (REQ-CONTRACTS-006). `AccountingMissionStatus` has **15** members — assert exhaustiveness against the installed enum, not the outdated doc comment.

---

## Task list

### PR #1 — S1 · Contracts, complete scope, canonicalization

#### T-S1-001 — Wire `lib/` and `chains/` into the TypeScript build roots

- **Slice/PR:** S1 / PR #1 · **Deps:** none · **Est. lines:** 6–10
- **Description:** Add `"lib"` and `"chains"` to the `include` arrays of `tsconfig.json` and `tsconfig.build.json`, preserving the existing entries (`runtime`, `extensions`, `index.ts`, `__tests__`, `vitest.config.ts`) and the existing `exclude` sets. Do not change `package.json` yet.
- **Acceptance criteria:**
  - `bun run typecheck` passes with the new includes (no new errors).
  - `bun run build` succeeds and `node scripts/verify-package-files.mjs` still passes (existing checks unchanged).
  - After T-S1-005 lands, `dist/lib/canonicalization.js` and `dist/lib/canonicalization.d.ts` are emitted by the build (proves the root wiring ships lib modules — design §14).
- [x] T-S1-001 — build roots wiring. <!-- sdd-owner: implementation -->

#### T-S1-002 — Mission + evidence JSON-schema contract families with conformance tests

- **Slice/PR:** S1 / PR #1 · **Deps:** T-S1-001 · **Est. lines:** 90–120
- **Description:** RED first: write `__tests__/contracts.test.ts` asserting that representative valid documents validate and invalid/tampered documents are rejected (REQ-CONTRACTS-007). GREEN: author versioned JSON Schema documents under `contracts/mission/` (snapshot, event, step, status) and `contracts/evidence/` (node, edge, graph), mirroring the pinned engine `MissionSnapshot`/`MissionEvent`/`MissionStep` shapes and the design §7.1 record shapes; money fields are declared as BigInt cents (JSON integer or decimal string) and floating-point money is rejected (REQ-CONTRACTS-008). No schema deep-imports package internals (REQ-CONTRACTS-006).
- **Acceptance criteria:**
  - Mission snapshot/event/step fixtures validate (REQ-CONTRACTS-001; SC-CONTRACTS-001).
  - Evidence graph document with nodes, edges, payload hashes validates (REQ-CONTRACTS-002; SC-CONTRACTS-002).
  - Tampered/malformed payloads are rejected with a descriptive error (SC-CONTRACTS-005).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S1-002 — mission + evidence contract families. <!-- sdd-owner: implementation -->

#### T-S1-003 — Authority + receipts + trusted-key JSON-schema contract families with conformance tests

- **Slice/PR:** S1 / PR #1 · **Deps:** T-S1-001 · **Est. lines:** 100–130
- **Description:** Extend `__tests__/contracts.test.ts` (RED): authority record fixture with the 10-element scope binding + authorization decision (SC-CONTRACTS-003), a `SignedReceipt` fixture mirroring the pinned engine type field-for-field (SC-CONTRACTS-004), tampered receipt rejection (SC-CONTRACTS-005), and a trusted-key registry document (REQ-CONTRACTS-005). GREEN: author `contracts/authority/` (scope binding, authority mode, authorization record) and `contracts/receipts/` (`SignedReceipt` exactly matching engine shape: protocolVersion, receiptType APPROVAL/EXECUTION/COMPLETION/EXTERNAL_SUBMISSION, algorithm "Ed25519", content fields incl. payloadHash, receiptHash, signerKeyId, signerPublicKey, signature, issuedAt; plus receipt binding and trusted-key registry per REQ-CONTRACTS-004/005).
- **Acceptance criteria:**
  - Authority record with 10-element scope + mode validates (REQ-CONTRACTS-003; SC-CONTRACTS-003).
  - Engine `SignedReceipt` fixture validates and every field matches the engine type (REQ-CONTRACTS-004; SC-CONTRACTS-004).
  - Tampered receipt content fails validation (SC-CONTRACTS-005).
  - Registry entries validate against `SigningKeyInfo` before trust (REQ-CONTRACTS-005).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S1-003 — authority + receipts + trusted-key contract families. <!-- sdd-owner: implementation -->

#### T-S1-004 — Extend `runtime/context.ts` with the 10-element canonical scope model (backward compatible)

- **Slice/PR:** S1 / PR #1 · **Deps:** T-S1-001 · **Est. lines:** 90–120
- **Description:** RED first: write `__tests__/context-scope.test.ts` asserting legacy `{company:{ruc}, period:{period}}` loads into canonical elements without data loss and is reported incomplete until the remaining 8 elements are bound (REQ-SCOPE-007; SC-SCOPE-006), incomplete scope rejects mission use (REQ-SCOPE-009), valid RUC accepted / bad check digit rejected (SC-SCOPE-001/002), period boundary `202507` accepted / `202513` rejected (SC-SCOPE-003). GREEN: add to `runtime/context.ts` the `AUTHORITY_MODE` const object + `AuthorityMode` type and `CanonicalScope` (10 non-empty string elements per design §3.1, incl. `authorityLevel`), a `loadCanonicalScope`/partial-scope report keeping `ScopeContextStore`, `CompanyContext`, `FiscalPeriodContext`, `isValidRuc`, `isValidPeriod`, `isValidScope` fully backward compatible; reuse the existing RUC check-digit and period validators. `runtime/` must not import `lib/` (dependency direction: `lib/` → `runtime/`).
- **Acceptance criteria:**
  - `CanonicalScope` carries exactly the 10 required elements (REQ-SCOPE-001).
  - RUC and period validation rules hold (REQ-SCOPE-002, REQ-SCOPE-003; SC-SCOPE-001, 002, 003).
  - Legacy context loads canonically and reports incomplete (REQ-SCOPE-007; SC-SCOPE-006).
  - Missing/invalid element blocks mission creation path (REQ-SCOPE-009).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S1-004 — canonical scope model in `runtime/context.ts`. <!-- sdd-owner: implementation -->

#### T-S1-005 — `lib/canonicalization.ts`: canonical encoding, scope hash, payload canonicalization

- **Slice/PR:** S1 / PR #1 · **Deps:** T-S1-004 · **Est. lines:** 130–170
- **Description:** RED first: write `__tests__/canonicalization.test.ts` with the design §3.2 golden vector (exact compact JSON, exact key order `actor, authorityLevel, company, fiscalPeriod, ledgerBook, operationType, organization, policyVersion, sourceSnapshot, tenant`, no BOM/trailing newline), ten single-field mutations producing ten distinct 64-char lowercase hex hashes with the original unchanged (REQ-SCOPE-005; SC-SCOPE-004), NFC-equivalent strings equal, lone-surrogate rejection, deterministic output, and no float money accepted at JSON boundaries. GREEN: implement in `lib/canonicalization.ts` (importing `CanonicalScope`/`AuthorityMode` from `../runtime/context.js`): `normalizeScope`, `validateCanonicalScope`, `canonicalizeScope`, `bindScope` → `ScopeBinding` (`version: "drenyra.scope.v1"`, `canonical`, `scopeHash` = sha-256 hex), `canonicalizePayload`, `sha256Canonical`.
- **Acceptance criteria:**
  - Golden bytes match design §3.2 exactly (REQ-SCOPE-004).
  - Each of the 10 single-field mutations yields a different hash (REQ-SCOPE-005; SC-SCOPE-004).
  - `bindScope` output includes the scope hash for binding into authorization/receipts (REQ-SCOPE-008).
  - Scope-change invalidation precondition: any element change → different `scopeHash` (SC-SCOPE-005 basis, exercised fully in PR #2/#4).
  - `bun test`, `bun run typecheck`, `bun run build` green; `dist/lib/canonicalization.js` ships (T-S1-001 wiring).
- [x] T-S1-005 — canonicalization library. <!-- sdd-owner: implementation -->

---

### PR #2 — S2 · Authority gates and accounting status

#### T-S2-001 — `lib/authority-gates.ts`: modes, action families, monotonicity, explicit materiality

- **Slice/PR:** S2 / PR #2 · **Deps:** T-S1-005 · **Est. lines:** 110–140
- **Description:** RED first: write `__tests__/authority-gates.test.ts` covering the exhaustive mode×family escalation table (SC-AUTH-005): every action whose required mode exceeds the bound mode is denied (SC-AUTH-001; REQ-AUTH-002), allowed actions pass, `deriveRequiredMateriality` fails closed when value/reversibility/jurisdiction is missing (SC-AUTH-002; REQ-AUTH-004) and never defaults to R0, and monthly close always applies the R2 floor (REQ-AUTH-005). GREEN: implement `AUTHORITY_ORDER`, `ACTION_FAMILY` (QUERY/INVESTIGATE/PREPARE_CANDIDATE/APPROVE/EXECUTE_TARGET), `requiredModeFor`, `assertMonotonicAuthority` (design §5.1), `ExplicitMaterialityRequest`, `deriveRequiredMateriality` wrapping engine `deriveMateriality` with the `minimum` floor (design §5.2). Reuse `AuthorityMode` from `runtime/context.js`.
- **Acceptance criteria:**
  - Exactly four modes in strict order ASK < ANALYZE < PREPARE < EXECUTE (REQ-AUTH-001).
  - Lower authority never permits a higher action (REQ-AUTH-002; SC-AUTH-001, 005).
  - Missing materiality input blocks; R0 default unreachable (REQ-AUTH-004; SC-AUTH-002).
  - Monthly close requires at least R2 (REQ-AUTH-005).
  - ASK/ANALYZE never mutate; PREPARE produces candidates only (REQ-AUTH-009).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S2-001 — authority modes + materiality. <!-- sdd-owner: implementation -->

#### T-S2-002 — `lib/authority-gates.ts`: fixed-order `runAuthorityPipeline`

- **Slice/PR:** S2 / PR #2 · **Deps:** T-S2-001 · **Est. lines:** 120–150
- **Description:** RED first: pipeline tests asserting the exact stage order scope → mode → materiality → mission → approval → receipt (REQ-AUTH-008), first non-allowed verdict stops evaluation, missing scope/materiality/approval/trusted keys block (SC-AUTH-004), `ReceiptGate` is never invoked without a non-empty `trustedKeys` list (removes embedded-key self-trust — design §5.3), PREPARE marks approval+receipt stages `not_applicable`, EXECUTE requires all six stages, and `needs_input` verdicts are preserved without weakening. GREEN: implement `AuthorityGateInput`/`AuthorityGateResult` and `runAuthorityPipeline` (design §5.3) wrapping engine `MissionStateGate`, `ApprovalGate` (with the derived tier), and `ReceiptGate`; use the engine `GateRunner` for the contiguous engine segment and translate results without weakening `needs_input`.
- **Acceptance criteria:**
  - Fixed gate order enforced; first non-allowed stops (REQ-AUTH-008).
  - Execute blocked when approval/evidence/trusted-key receipt verification missing (SC-AUTH-004).
  - Missing trusted keys block at the receipt stage (REQ-AUTH-008; design §6.2).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S2-002 — authority gate pipeline. <!-- sdd-owner: implementation -->

#### T-S2-003 — `lib/authority-store.ts`: append-only authorization records

- **Slice/PR:** S2 / PR #2 · **Deps:** T-S2-001 · **Est. lines:** 70–90
- **Description:** RED first: write `__tests__/authority-store.test.ts` asserting `appendAuthorization`/`listAuthorizations`/`findBoundAuthorization` against `<workspace>/.local/authority/<mission-id>.ndjson` (design §5.4): duplicate record ID with identical canonical bytes replays idempotently, conflicting bytes block, IDs/mission IDs are validated so they can never become raw paths, and after any scope element changes, `findBoundAuthorization` with the new `scopeHash` returns nothing while old records remain immutable history (REQ-SCOPE-006; SC-SCOPE-005). GREEN: implement the store with append+sync semantics.
- **Acceptance criteria:**
  - Authority records are append-only and bound to exact `scopeHash`, actor, action family, and mission identity (REQ-AUTH-003; REQ-SCOPE-008).
  - Scope change invalidates prior authorization; new bound decision required (REQ-SCOPE-006; SC-SCOPE-005).
  - Path-traversal identifiers are rejected (design §15).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S2-003 — authority store. <!-- sdd-owner: implementation -->

#### T-S2-004 — `lib/accounting-status.ts`: read-only status projection + EDA step derivation

- **Slice/PR:** S2 / PR #2 · **Deps:** T-S2-002 · **Est. lines:** 100–130
- **Description:** RED first: write `__tests__/accounting-status.test.ts` covering every installed engine state (assert the exact 15-member `AccountingMissionStatus` set from the installed enum — design §1), so no unknown state silently maps to runnable; `waitReasonFor` surfaces EVIDENCE/APPROVAL/POLICY_GATE; `isRunnable`/`isResumable`/`isAwaitingApproval`/`isWaitingForHuman` drive `nextAuthorizedAction` (REQ-MISS-003); `createEdaSteps(intent)` returns all 13 phases in canonical order for all five intents with the design §4.3 applicability policy (REQ-MISS-001); `derivePreparedStep` yields RUN/SKIP/WAIT or null from persisted snapshot only. GREEN: implement `EDA_PHASE`, `EdaPhase`, `PreparedStep`, `AccountingStatusView`, `buildAccountingStatus`, `createEdaSteps`, `derivePreparedStep` (design §4.4, §9).
- **Acceptance criteria:**
  - Full 13-phase ordered step sequence produced (REQ-MISS-001; SC-MISS-001 basis).
  - Next phase derived from persisted state via engine predicates, never chat (REQ-MISS-003).
  - All 15 installed engine states handled; unknown states never map to runnable.
  - `bun test` green; `bun run typecheck` green.
- [x] T-S2-004 — accounting status projection. <!-- sdd-owner: implementation -->

#### T-S2-005 — Correct spec count references (14 → 15 engine states) in `specs/README.md`

- **Slice/PR:** S2 / PR #2 · **Deps:** T-S2-004 · **Est. lines:** 2–5
- **Description:** Update `openspec/changes/evidence-driven-accounting-harness/specs/README.md`: the mission-protocol feature-index line ("over the 14 engine states") and the "Notes for verify" line ("14 `AccountingMissionStatus` states") to say **15**, matching the spec body and the installed enum. No requirement/scenario counts change (79/50).
- **Acceptance criteria:**
  - README references 15 states consistently; no doc contradicts the installed enum (design §1 risk note).
  - `bun test` still green.
- [x] T-S2-005 — spec count correction. <!-- sdd-owner: implementation -->

---

### PR #3 — S3a · Durable missions and monthly-close upgrade

#### T-S3A-001 — `lib/mission-store.ts`: file-backed mission/event/idempotency adapters

- **Slice/PR:** S3a / PR #3 · **Deps:** T-S1-005 · **Est. lines:** 110–140
- **Description:** RED first: write `__tests__/mission-store.test.ts` covering save/load/findByStatus/list against `.local/missions/{snapshots,events,idempotency}/` (design §8.1), atomic snapshot/idempotency writes (temp + fsync + rename; a crash mid-write never truncates), append-only event logs synced before return, schema envelope versioned (`MISSION_STORE_SCHEMA_VERSION = 1`), unknown schema versions block, and ID validation that prevents path traversal (REQ-MISS-006). GREEN: implement `FileMissionStore`, `FileMissionEventStore`, `FileIdempotencyStore`, `DurableMissionStores`, `createDurableMissionStores` (design §8.2) over the public engine port types only — never deep-import `MissionFileStore` (REQ-MISS-006; REQ-CONTRACTS-006).
- **Acceptance criteria:**
  - Full `MissionSnapshot` fields persist and rehydrate (REQ-MISS-010; SC-MISS-003 basis).
  - Atomic write + append-only guarantees hold (REQ-MISS-006).
  - Unknown schema version blocks rather than silently resetting (design §15).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3A-001 — durable mission store adapters. <!-- sdd-owner: implementation -->

#### T-S3A-002 — `lib/mission-store.ts`: fail-closed recovery + idempotent replay

- **Slice/PR:** S3a / PR #3 · **Deps:** T-S3A-001 · **Est. lines:** 90–120
- **Description:** RED first: crash/recovery tests — event log is the replay source; replayed snapshot identity/version compared to the snapshot file; snapshot ahead of its event log or an `EXECUTING` idempotency record without a complete visible result marks the recovery record unresolved and reaches `UNKNOWN` via engine policy without re-running the command (REQ-MISS-007; SC-MISS-003); human-wait states (`WAITING_FOR_EVIDENCE`, `BLOCKED_BY_GATE`, `AWAITING_APPROVAL`) are never auto-advanced (REQ-MISS-009); terminal states never replayed (REQ-MISS-007); a completed idempotency key returns the cached result and a conflicting payload raises the engine `IdempotencyConflict` (REQ-MISS-008; SC-MISS-004). GREEN: implement `recoverDurableMissions(runtime, stores)` using engine `recoverIncomplete` + `replayMission` (design §8.3).
- **Acceptance criteria:**
  - Interrupted missions recover to a consistent state per engine recovery policy (REQ-MISS-007; SC-MISS-003).
  - Human-wait and terminal states preserved (REQ-MISS-007, 009).
  - Idempotent replay returns cached result; conflicts rejected (REQ-MISS-008; SC-MISS-004).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3A-002 — recovery + idempotency. <!-- sdd-owner: implementation -->

#### T-S3A-003 — Upgrade `chains/monthly-close.ts` to durable stores and the full EDA step plan

- **Slice/PR:** S3a / PR #3 · **Deps:** T-S3A-002, T-S2-004 · **Est. lines:** 150–190
- **Description:** RED first: extend `chains/__tests__/monthly-close.test.ts` — the chain runs over durable stores and the mission survives store re-creation (REQ-CHAIN-001; SC-MISS-003); the mission carries the full 13-step plan from `createEdaSteps("monthly-close")` (REQ-MISS-001); continuation advances exactly one EDA phase per execute (REQ-MISS-004; SC-MISS-001); missing evidence lands in `WAITING_FOR_EVIDENCE` with no auto-advance and `waitReasonFor` = EVIDENCE (REQ-MISS-009; SC-MISS-005); reaching the approval gate without approvals reports POLICY_GATE wait and no phase advances (SC-MISS-006); the proposal carries a real evidence hash — the hardcoded `"pending"` evidence hash is gone (REQ-CHAIN-001). GREEN: swap the in-memory stores for `createDurableMissionStores`; create the mission with the step plan; drive progress via `derivePreparedStep` + one bounded phase per execute; keep the R2 `ApprovalGate` with explicit materiality derivation (REQ-AUTH-005); readiness = next legal transition only.
- **Acceptance criteria:**
  - Durable monthly-close flow with 13-step plan and one-step continuation (REQ-CHAIN-001; REQ-MISS-001, 004; SC-MISS-001).
  - Evidence wait and gate-block states behave per engine predicates (REQ-MISS-009; SC-MISS-005, 006).
  - Real proposal evidence binding replaces the hardcoded hash (REQ-CHAIN-001).
  - All 54 baseline tests stay green (REQ-CHAIN-008).
  - `bun test`, `bun run typecheck`, `bun run build` green.
- [x] T-S3A-003 — monthly-close chain upgrade. <!-- sdd-owner: implementation -->

---

### PR #4 — S3b · Evidence graph, trusted keys, receipt verification

#### T-S3B-001 — `lib/evidence-graph.ts`: append-only per-mission graph store

- **Slice/PR:** S3b / PR #4 · **Deps:** T-S1-005 · **Est. lines:** 100–130
- **Description:** RED first: write `__tests__/evidence-graph.test.ts` — four node kinds source/transformation/conclusion/action (REQ-EVID-001); directed lineage edges `DERIVED_FROM`/`SUPPORTS`/`EXECUTES` with full lineage traversal (REQ-EVID-002; SC-EVID-001); lowercase hex sha-256 payload hash per node over the canonical payload (REQ-EVID-003); citation rule — a conclusion with no cited source/transformation is rejected (REQ-EVID-004; SC-EVID-002); append-only — mutation/removal in place rejected, new content becomes new nodes (REQ-EVID-005; SC-EVID-004); duplicate ID allowed only when byte-identical, differing bytes block; cross-mission edges rejected; cycles rejected; a malformed/truncated line makes the graph unavailable for authority decisions (design §7.2). GREEN: implement `EvidenceGraphStore` (appendNode/appendEdge/load/lineage) over `.local/evidence/<mission-id>.ndjson` per design §7.1/§7.4.
- **Acceptance criteria:**
  - Node kinds, lineage, hashes, citation, append-only invariants hold (REQ-EVID-001..005; SC-EVID-001, 002, 004).
  - Corruption/truncation fails closed (design §7.2, §15).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3B-001 — evidence graph store. <!-- sdd-owner: implementation -->

#### T-S3B-002 — `lib/evidence-graph.ts`: integrity validation + receipt evidence hash

- **Slice/PR:** S3b / PR #4 · **Deps:** T-S3B-001 · **Est. lines:** 70–90
- **Description:** RED first: `validate()` recomputes every payload hash and identifies the tampered node (REQ-EVID-008; SC-EVID-003); `computeReceiptEvidenceHash` uses the engine's id-sorted `computeEvidenceHash` so the same evidence set yields the same hash regardless of insertion order (REQ-EVID-006; SC-EVID-005); every action node references a supporting conclusion with complete source→action lineage (REQ-EVID-007); ungrounded actions rejected. GREEN: implement `validate`, `computeReceiptEvidenceHash` (project nodes to engine `EvidenceItem {id,label,type}`, dedupe by id, engine hash — design §7.3).
- **Acceptance criteria:**
  - Tampered node detected by hash recomputation (REQ-EVID-008; SC-EVID-003).
  - Evidence hash is insertion-order stable (REQ-EVID-006; SC-EVID-005).
  - Action traceability complete (REQ-EVID-007).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3B-002 — graph validation + receipt hash. <!-- sdd-owner: implementation -->

#### T-S3B-003 — `lib/trusted-key-registry.ts`: workspace-local trusted public-key registry

- **Slice/PR:** S3b / PR #4 · **Deps:** T-S1-003 · **Est. lines:** 60–80
- **Description:** RED first: write `__tests__/trusted-key-registry.test.ts` — load/put/resolve by keyId against `.local/trusted-keys.json` (design §6.1); schema validation rejects unknown properties, malformed keys, duplicate semantic IDs, invalid date order, expired entries, and revoked entries (REQ-CONTRACTS-005); the registry is read fresh for each protected verification so revocation takes effect immediately; atomic writes (unique temp file + sync + rename + parent-dir sync); symlinks and paths outside the workspace root rejected; private keys are never stored. GREEN: implement `TrustedKeyRegistry` per design §6.1.
- **Acceptance criteria:**
  - Registry document schema matches `SigningKeyInfo` and validates entries (REQ-CONTRACTS-005).
  - Unknown/expired/revoked key states are representable and blocked at verification time.
  - Fresh read per verification; atomic writes; path safety (design §15).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3B-003 — trusted-key registry. <!-- sdd-owner: implementation -->

#### T-S3B-004 — `lib/receipt-store.ts` + `lib/receipt-verification.ts`: immutable records + trusted verification

- **Slice/PR:** S3b / PR #4 · **Deps:** T-S3B-002, T-S3B-003 · **Est. lines:** 90–120
- **Description:** RED first: write `__tests__/receipt-verification.test.ts` — valid receipt passes all sub-checks (schema → engine content hash → Ed25519 signature → registry key match → key lifecycle → binding digest → scope/mission/actor/policy/target expectations, design §6.2); tampered content; tampered binding; wrong scope; wrong target; unknown signer (UNKNOWN_SIGNER); expired key; revoked key; embedded-key-only receipt rejected (no embedded-key fallback — design §15). Store tests: an identical record at the same receipt hash replays idempotently; differing bytes at the same identity block as corruption. GREEN: implement `verifyHarnessReceipt` and the immutable receipt store at `.local/receipts/<receipt-hash>.json` (REQ-SCOPE-008: binding digest carries the scope hash through `payloadHash`).
- **Acceptance criteria:**
  - Full local verification matrix: valid, tampered content, tampered binding, wrong scope/target, unknown signer, expired, revoked (REQ-AUTH-008 receipt stage; SC-CMD-004/005 lib-level basis).
  - No path trusts an embedded public key (design §15).
  - Receipt store is immutable and replay-safe.
  - `bun test` green; `bun run typecheck` green.
- [x] T-S3B-004 — receipt store + verification. <!-- sdd-owner: implementation -->

---

### PR #5 — S4a · Extension foundations

#### T-S4A-001 — `extensions/scope-guard.ts`: per-command scope policy

- **Slice/PR:** S4a / PR #5 · **Deps:** T-S1-004, T-S1-005 · **Est. lines:** 80–100
- **Description:** RED first: write `__tests__/extension-scope-guard.test.ts` — bootstrap/read commands (`doctor`, `capabilities`, scope setup, limited status diagnostics) use an explicit pre-scope policy; all mission/chain/evidence-mutation/approval/receipt commands require a complete 10-element scope and fail closed with an explanatory error mutating nothing (REQ-CMD-003; SC-CMD-002); scope loads → canonical binding → `scopeHash`; a changed scope hash blocks the command (REQ-SCOPE-006). GREEN: implement the scope-guard module (named exports only; imported by `register.ts` — design §10.1) enforcing design §2.2's parse → scope policy → delegation order.
- **Acceptance criteria:**
  - Every scope-requiring command fails closed without valid complete scope (REQ-CMD-003; SC-CMD-002).
  - Read-only bootstrap commands run under an explicit pre-scope policy (design §2.2).
  - Scope change invalidates command execution (REQ-SCOPE-006).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4A-001 — scope guard. <!-- sdd-owner: implementation -->

#### T-S4A-002 — `extensions/mission-status.ts`: status/capabilities rendering + structured results

- **Slice/PR:** S4a / PR #5 · **Deps:** T-S2-004 · **Est. lines:** 80–100
- **Description:** RED first: extend `__tests__/extension.test.ts` (or add `__tests__/extension-mission-status.test.ts`) — the status view renders active company and period, active mission state, next authorized action, linked sources, pending reconciliations, material anomalies, and required approvals (REQ-CMD-009); the capabilities view reports engine `getCapabilities()` plus harness capabilities — authority modes, registered commands, and the 10 scope elements (REQ-CMD-010); every command returns structured machine-readable output plus a concise human summary (REQ-CMD-008). GREEN: implement rendering helpers composing `buildAccountingStatus` and engine `getCapabilities()`; keep them thin (no fiscal logic).
- **Acceptance criteria:**
  - Status view contains all REQ-CMD-009 elements.
  - Capabilities view contains engine + harness capabilities (REQ-CMD-010).
  - Structured JSON + human summary output shape (REQ-CMD-008).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4A-002 — mission-status rendering. <!-- sdd-owner: implementation -->

#### T-S4A-003 — `extensions/startup-panel.ts`: activation banner

- **Slice/PR:** S4a / PR #5 · **Deps:** T-S4A-001 · **Est. lines:** 40–60
- **Description:** RED first: write `__tests__/extension-startup-panel.test.ts` — `showStartupPanel({writeLine, packageRoot, contextStore})` prints one concise banner with the pinned-runtime verdict and the default context's scope completeness through the injected `writeLine` (design §10.2); a banner failure renders degraded status and grants no mission capability. GREEN: implement `StartupPanelDeps`-based banner; make the default extension factory async — registers commands first, then emits the banner. Do not add an unverified `ctx.ui` dependency (design §10.2).
- **Acceptance criteria:**
  - Banner renders runtime verdict + scope completeness (design §10.2).
  - Banner failure degrades without granting capability.
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4A-003 — startup panel. <!-- sdd-owner: implementation -->

#### T-S4A-004 — Entrypoint packaging + read commands (`capabilities`, `scope`, `models`)

- **Slice/PR:** S4a / PR #5 · **Deps:** T-S4A-001..003 · **Est. lines:** 90–120
- **Description:** RED first: extend `__tests__/extension.test.ts` — descriptor registers `capabilities`, `scope`, `models`; `pi.extensions` points at the exact compiled entry file `./dist/extensions/register.js` (one entrypoint); handlers are thin (REQ-CMD-004). GREEN: update `package.json` `pi.extensions` from the directory to the exact file; keep `exports["./extensions"] = "./dist/extensions/register.js"`; update `scripts/verify-package-files.mjs` so the `pi.extensions` assertion matches the exact file (the current `includes("./dist/extensions")` check must be updated in this same task or it will fail); register `drenyra:capabilities` (engine `getCapabilities()` + harness capabilities via T-S4A-002), `drenyra:scope` (bind/read the full 10-element scope, superseding but staying compatible with `company`/`period`/`context`), and `drenyra:models` (documented model-routing registry — G30: no Pi model-routing API in the current slice, so a documented capability registry is acceptable); update the descriptor `provides`/`commands` and `contracts/package-contract.md` in the same unit (R9).
- **Acceptance criteria:**
  - `capabilities`, `scope`, `models` registered (REQ-CMD-001 — 3 of 14); legacy `company`/`period`/`context` preserved (REQ-CMD-002).
  - Handlers contain no accounting/fiscal logic (REQ-CMD-004).
  - `pi.extensions` = exact compiled entry file; verify-package-files passes (design §10.1, §14; SC-CMD-001 basis).
  - `bun test`, `bun run typecheck`, `bun run build`, `node scripts/verify-package-files.mjs` green.
- [x] T-S4A-004 — entrypoint + read commands. <!-- sdd-owner: implementation -->

---

### PR #6 — S4b · Mission lifecycle commands

#### T-S4B-001 — `mission` + `continue` handlers

- **Slice/PR:** S4b / PR #6 · **Deps:** T-S4A-004, T-S2-004, T-S3A-003 · **Est. lines:** 100–130
- **Description:** RED first: write `__tests__/extension-mission-commands.test.ts` — `/drenyra:mission` starts/inspects a mission for the current scope + intent; `/drenyra:continue` executes exactly one protocol-declared prepared transition (REQ-CMD-005; SC-CMD-003) and there is no continue-all path; scope-requiring commands fail closed without scope (SC-CMD-002); output is structured JSON + human summary (REQ-CMD-008). GREEN: register `drenyra:mission` and `drenyra:continue`; handlers follow parse → scope policy → lib/chain delegation → render (design §10.3), delegating to `derivePreparedStep`/`executePreparedStep`-ready logic from PR #3 and the T-S2-004 step plan.
- **Acceptance criteria:**
  - Mission start/inspect + one-step continue registered (REQ-CMD-001, 005).
  - Continue advances exactly one prepared transition; no continue-all (REQ-CMD-005; SC-CMD-003; REQ-MISS-004).
  - Fail closed without complete scope (REQ-CMD-003; SC-CMD-002).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4B-001 — mission + continue handlers. <!-- sdd-owner: implementation -->

#### T-S4B-002 — `resume` handler

- **Slice/PR:** S4b / PR #6 · **Deps:** T-S4B-001, T-S3A-002 · **Est. lines:** 40–60
- **Description:** RED first: extend `__tests__/extension-mission-commands.test.ts` — `/drenyra:resume` recovers UNKNOWN/interrupted missions via the engine recovery policy and leaves `WAITING_FOR_EVIDENCE` and terminal missions untouched (REQ-CMD-007; SC-CMD-006). GREEN: register `drenyra:resume` delegating to `recoverDurableMissions` (PR #3).
- **Acceptance criteria:**
  - UNKNOWN mission recovered via evidence-based decision; wait mission untouched (REQ-CMD-007; SC-CMD-006).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4B-002 — resume handler. <!-- sdd-owner: implementation -->

#### T-S4B-003 — `receipt` handler with `verify <id>` subcommand

- **Slice/PR:** S4b / PR #6 · **Deps:** T-S4B-001, T-S3B-004 · **Est. lines:** 70–90
- **Description:** RED first: extend the command tests — `/drenyra:receipt verify <id>` reports content-valid, signature-valid, signer-trusted, in-currency results with bound scope and executed target for a current trusted key (REQ-CMD-006; SC-CMD-004); tampered, unknown-signer, expired-key, and revoked-key receipts are each rejected with the corresponding reason (SC-CMD-005). GREEN: register `drenyra:receipt` parsing the `verify <id>` subcommand and delegating to `verifyHarnessReceipt` + `TrustedKeyRegistry` (PR #4).
- **Acceptance criteria:**
  - Local trusted-registry-backed verification with full rejection matrix (REQ-CMD-006; SC-CMD-004, 005).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4B-003 — receipt verify handler. <!-- sdd-owner: implementation -->

#### T-S4B-004 — `evidence`, `verify`, `reconcile` handlers (registration + structured pending denial)

- **Slice/PR:** S4b / PR #6 · **Deps:** T-S4B-001 · **Est. lines:** 80–110
- **Description:** RED first: extend `__tests__/extension.test.ts` — all 14 intended commands plus `company` and `context` are registered and the descriptor passes package-contract conformance (REQ-CMD-001, 002; SC-CMD-001); each new handler fails closed without scope (SC-CMD-002) and returns structured output (REQ-CMD-008); handlers contain no fiscal logic (REQ-CMD-004). GREEN: register `drenyra:evidence`, `drenyra:verify`, `drenyra:reconcile` with parse → scope policy → structured render; until the chains land (PR #7/#8) the bodies return a documented `not_available` denial (registration complete, behavior wired by T-S5A-002 and T-S5B-003). Note in apply-progress that SC-CHAIN-002/003/006 and full command behavior are only fully green after PR #8.
- **Acceptance criteria:**
  - 14/14 intended commands + legacy extras registered; conformance passes (REQ-CMD-001, 002; SC-CMD-001).
  - All handlers thin and fail closed without scope (REQ-CMD-003, 004; SC-CMD-002).
  - `bun test` green; `bun run typecheck` green.
- [x] T-S4B-004 — remaining command registrations. <!-- sdd-owner: implementation -->

---

### PR #7 — S5a · Shared chain pipeline and reconcile chain

#### T-S5A-001 — `lib/chain-pipeline.ts`: shared scope → mission → gate → receipt pipeline

- **Slice/PR:** S5a / PR #7 · **Deps:** T-S3A-003, T-S3B-002, T-S3B-004 · **Est. lines:** 120–150
- **Description:** RED first: write `__tests__/chain-pipeline.test.ts` — every chain runs scope validation → mission load/start → one phase operation → applicable authority gates → receipt persistence (REQ-CHAIN-005); first failing stage stops (SC-CHAIN-003 basis); one legal step per run with no unbounded loops and no continue-all (REQ-MISS-004; REQ-CHAIN-006); stale scope hash invalidates the prepared step before any write (design §15); idempotency replay returns the cached result (REQ-MISS-008); completion receipt bound to mission, evidence hash, scope hash, and executed target (REQ-CHAIN-007). GREEN: implement `ChainDefinition`, `runChainStep`, and `executePreparedStep` (optimistic versioning; idempotency key from mission ID + phase ID + mission version + scope hash + target hash — design §4.4, §11.1).
- **Acceptance criteria:**
  - Shared structure and first-failure stop enforced (REQ-CHAIN-005; REQ-AUTH-008).
  - One step per call; bounded and deterministic (REQ-CHAIN-006; REQ-MISS-004).
  - Signed completion receipt bound to mission/evidence/scope/target (REQ-CHAIN-007).
  - `bun test` green; `bun run typecheck` green.
- [ ] T-S5A-001 — shared chain pipeline. <!-- sdd-owner: implementation -->

#### T-S5A-002 — `chains/reconcile.ts`: reconciliation intent chain + wire `/drenyra:reconcile`

- **Slice/PR:** S5a / PR #7 · **Deps:** T-S5A-001, T-S4B-004 · **Est. lines:** 130–170
- **Description:** RED first: write `chains/__tests__/reconcile.test.ts` — ingest a bounded source manifest → deterministic normalize (bigint cents) → reconcile → anomaly detection → `WAITING_FOR_EVIDENCE` for unproven discrepancies → after evidence, resume → evidence-cited proposal quantifying the difference and resolution path (REQ-CHAIN-002; SC-CHAIN-002, 005); the chain cannot post adjustments (REQ-AUTH-009); no floats, no ambient runtime lookup, no unbounded loops (REQ-CHAIN-006); signed completion receipt (REQ-CHAIN-007). GREEN: implement the chain scoped to intent `reconciliation` via `runChainStep`; replace the `/drenyra:reconcile` denial body from T-S4B-004 with real delegation.
- **Acceptance criteria:**
  - Reconcile chain performs ingest → normalize → reconcile → anomaly → evidence wait → proposal (REQ-CHAIN-002; SC-CHAIN-002, 005).
  - No mutation beyond proposal/candidate (REQ-AUTH-009).
  - `bun test` green; `bun run typecheck` green.
- [ ] T-S5A-002 — reconcile chain. <!-- sdd-owner: implementation -->

---

### PR #8 — S5b · Verify and evidence chains, full monthly-close flow

#### T-S5B-001 — `chains/verify.ts`: integrity verify chain

- **Slice/PR:** S5b / PR #8 · **Deps:** T-S5A-001 · **Est. lines:** 90–120
- **Description:** RED first: write `chains/__tests__/verify.test.ts` — source-snapshot integrity (a hash mismatch blocks with a source-integrity failure and no further stage runs — SC-CHAIN-003; REQ-CHAIN-003), graph integrity via `EvidenceGraphStore.validate`, ledger equations with bigint cents, reconciliation correctness, scope binding, and receipt binding; per-check verdicts; first blocking verdict stops protected downstream work; the chain never mutates accounting outputs (REQ-AUTH-009). GREEN: implement the verify chain over `EvidenceGraphStore` + source manifest digests + ledger fixtures.
- **Acceptance criteria:**
  - Fixed check list with per-check verdicts and first-failure stop (REQ-CHAIN-003, 005; SC-CHAIN-003).
  - Read-only: no mutation of accounting outputs (REQ-AUTH-009).
  - `bun test` green; `bun run typecheck` green.
- [ ] T-S5B-001 — verify chain. <!-- sdd-owner: implementation -->

#### T-S5B-002 — `chains/evidence.ts`: evidence add/query chain

- **Slice/PR:** S5b / PR #8 · **Deps:** T-S5A-001 · **Est. lines:** 70–90
- **Description:** RED first: write `chains/__tests__/evidence.test.ts` — add operations enforce node/edge schemas and lineage rules (a conclusion without citations is rejected — REQ-EVID-004); query operations return the full source→transformation→conclusion→action lineage (REQ-CHAIN-004; SC-CHAIN-006); queries are read-only; the graph stays bound to the mission (cross-mission edges rejected — design §7.2). GREEN: implement the evidence chain over `EvidenceGraphStore`.
- **Acceptance criteria:**
  - Evidence chain adds and queries graph records with lineage rules (REQ-CHAIN-004; SC-CHAIN-006).
  - No uncited conclusions accepted (REQ-EVID-004).
  - `bun test` green; `bun run typecheck` green.
- [ ] T-S5B-002 — evidence chain. <!-- sdd-owner: implementation -->

#### T-S5B-003 — Wire `verify`/`evidence` handler bodies + complete the monthly-close 12-step fixture flow

- **Slice/PR:** S5b / PR #8 · **Deps:** T-S5B-001, T-S5B-002, T-S4B-004 · **Est. lines:** 110–140
- **Description:** RED first: extend `chains/__tests__/monthly-close.test.ts` and the command tests — the full v0.1 12-step happy path on fixture sources (company/period → ingest balance, mayor, auxiliaries, bank → validate source integrity → reconcile → anomaly → evidence request/satisfaction → proposal with a real evidence hash → human approval → signed receipt → export) (REQ-CHAIN-001; SC-CHAIN-001); the anomaly→evidence loop resolves or raises a proposal (SC-CHAIN-002); an R2 close without approvals stops in `BLOCKED_BY_GATE`/`AWAITING_APPROVAL` and reports the required approval as next action (SC-CHAIN-004); `/drenyra:verify` and `/drenyra:evidence` delegate to their chains (REQ-CMD-004). GREEN: replace the T-S4B-004 denial bodies with real delegation; finish monthly-close orchestration to the 12-step flow with an export artifact (v0.1 step 12).
- **Acceptance criteria:**
  - Full monthly-close 12-step flow passes on fixtures (REQ-CHAIN-001; SC-CHAIN-001).
  - Evidence-wait loop and gate-block paths behave per spec (SC-CHAIN-002, 004).
  - All 14 command handlers delegate to lib/chains (REQ-CMD-004).
  - Baseline 54 tests preserved (REQ-CHAIN-008); `bun test`, `bun run typecheck`, `bun run build` green.
- [ ] T-S5B-003 — handler wiring + full close flow. <!-- sdd-owner: implementation -->

---

### PR #9 — S6 · Agents and packaged operating content

> Apply MUST land this PR as two work-unit commit groups: (a) T-S6-001 + T-S6-002 (agents and assets), then (b) T-S6-003 + T-S6-004 (skills/prompts/theme + package verification). If measured additions+deletions exceed 450, STOP and split into PR #9a/#9b.

#### T-S6-001 — Seven agent definitions + byte-for-byte asset mirrors + conformance tests

- **Slice/PR:** S6 / PR #9 · **Deps:** none (references stable command/contract docs from prior PRs) · **Est. lines:** 140–180
- **Description:** RED first: write `__tests__/agents.test.ts` — exactly 7 required roles (accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller — REQ-AGENT-001); each parses (valid frontmatter + body) and mirrors byte-for-byte under `assets/agents/` (REQ-AGENT-002; SC-AGENT-001); authority ceilings per design §12 (scout/analyst/refuter at ASK–ANALYZE; close-controller at PREPARE coordination only — REQ-AGENT-008); tool permissions broad-deny with narrow allows and no EXECUTE mutation (REQ-AGENT-005); every definition contains the common contract — scope-first read + fail closed (REQ-AGENT-003), evidence citation (REQ-AGENT-004; SC-AGENT-003), persist-before-respond with memory never granting authority (REQ-AGENT-006; SC-AGENT-005), and refutation-before-elevation for the anomaly-refuter (REQ-AGENT-007; SC-AGENT-004). GREEN: author the seven markdown definitions under `agents/` and mirror them under `assets/agents/`.
- **Acceptance criteria:**
  - Exactly 7 agents ship, parse, and mirror (REQ-AGENT-001, 002; SC-AGENT-001).
  - Common contract present in every definition (REQ-AGENT-003..006; SC-AGENT-002, 003, 005).
  - Refutation gate enforced for anomaly-refuter (REQ-AGENT-007; SC-AGENT-004).
  - `bun test` green; `bun run typecheck` green.
- [ ] T-S6-001 — agents + mirrors. <!-- sdd-owner: implementation -->

#### T-S6-002 — Policy, schema, and chain assets

- **Slice/PR:** S6 / PR #9 · **Deps:** T-S1-002, T-S1-003 · **Est. lines:** 90–120
- **Description:** RED first: write `__tests__/assets.test.ts` — every v0.1 non-goal maps to at least one explicit policy statement under `assets/policies/` (REQ-SKPT-005, 008; SC-SKPT-002): no autonomous filing with the Peruvian tax authority, no irreversible posting without approval, no free interpretation without evidence, no material tax decisions from an LLM alone, no silent modification of closed periods; schema assets under `assets/schemas/` are valid JSON Schema for the scope binding, evidence, and authority envelopes (REQ-SKPT-006); chain assets under `assets/chains/` describe monthly-close, reconcile, verify, and evidence chains (REQ-SKPT-004); no placeholder content. GREEN: author the asset tree.
- **Acceptance criteria:**
  - Policies encode all five v0.1 non-goals (REQ-SKPT-005, 008; SC-SKPT-002).
  - Schema + chain assets are real, valid content (REQ-SKPT-004, 006).
  - `bun test` green.
- [ ] T-S6-002 — policy/schema/chain assets. <!-- sdd-owner: implementation -->

#### T-S6-003 — Skills, prompts, and fiscal-operator theme

- **Slice/PR:** S6 / PR #9 · **Deps:** T-S6-002 · **Est. lines:** 100–130
- **Description:** RED first: write `__tests__/content.test.ts` — between 1 and 3 Drenyra skills with real instructional content (scope discipline, evidence citation, chain operation) and no stubs (REQ-SKPT-001; SC-SKPT-004); a persona prompt plus command prompts covering all 14 intended commands, with no prompt referencing an unregistered command (REQ-SKPT-002; SC-SKPT-005); exactly one theme `fiscal-operator` with light and dark variants resolving through the pi manifest (REQ-SKPT-003; SC-SKPT-003). GREEN: author `skills/`, `prompts/`, and `themes/`.
- **Acceptance criteria:**
  - 1–3 real skills; persona + 14-command prompts aligned (REQ-SKPT-001, 002; SC-SKPT-004, 005).
  - One theme with light/dark variants resolving via manifest (REQ-SKPT-003; SC-SKPT-003).
  - `bun test` green.
- [ ] T-S6-003 — skills, prompts, theme. <!-- sdd-owner: implementation -->

#### T-S6-004 — Package verification extension: manifest + shipped-file conformance

- **Slice/PR:** S6 / PR #9 · **Deps:** T-S6-001..003 · **Est. lines:** 70–90
- **Description:** RED first: extend the conformance checks (script-level or `__tests__`-driven) — `verify-package-files` asserts the emitted `dist/lib/*` and `dist/chains/*` modules, the four contract families, agents, prompts, skills, theme, and the new asset tree; `pi.prompts`/`pi.skills`/`pi.themes` entries resolve to real files (REQ-AGENT-009; REQ-SKPT-007; SC-SKPT-001). GREEN: update `scripts/verify-package-files.mjs` (new entries: `dist/lib`, `dist/chains`, `contracts/mission|evidence|authority|receipts`, `agents/`, `assets/agents|policies|schemas|chains`, prompts, skills, themes) and `package.json` `files` additions if any directory is missing.
- **Acceptance criteria:**
  - Agent definitions included in package verification (REQ-AGENT-009).
  - Manifest conformance for prompts/skills/themes + asset tree (REQ-SKPT-007; SC-SKPT-001).
  - `bun test`, `bun run build`, `node scripts/verify-package-files.mjs` all green.
- [ ] T-S6-004 — package verification. <!-- sdd-owner: implementation -->

---

## Parent-owned lifecycle gates (post-apply, per PR)

These run after the implementation tasks of each PR are normalized, reviewed, and verified. They are owned by the orchestrator/parent, not by apply.

- [ ] **T-GATE-001 — Confirm delivery boundary and chain strategy before apply.** Present the 9-PR boundary plan and the missing `chain_strategy` (stacked-to-main vs feature-branch-chain) to the user under `ask-on-risk`; do not start apply until confirmed. <!-- sdd-owner: parent -->
- [ ] **T-GATE-002 — Per-PR bounded review and delivery.** For each PR #1–#9: run source-mutating normalization first, start or reuse the bounded review on the frozen candidate, then validate the pre-commit/pre-push/pre-PR gates with the approved receipt and deliver exactly the reviewed bytes (work-unit-commits skill: behavior + tests + docs in the same unit; commit per work unit). <!-- sdd-owner: parent -->
- [ ] **T-GATE-003 — Chain context and PR shape.** Create each child PR with the chain-context section and a dependency diagram marking the current PR (📍) per the chosen chain strategy; keep a feature-branch-chain tracker draft/no-merge until all PRs integrate; treat polluted diffs as base bugs and retarget instead of mixing chain strategies. <!-- sdd-owner: parent -->
- [ ] **T-GATE-004 — Final verify and archive.** After PR #9, run `sdd-verify` against all 9 specs (79 REQ / 50 SC), refresh spec counts, and escalate any CRITICAL finding before `sdd-archive`. <!-- sdd-owner: parent -->

## Definition of done and rollback

- Each PR keeps a coherent package state (tests, docs, and behavior colocated; design §17 "Delivery boundaries").
- At the end of the chain: 14/14 commands registered, 10/10 scope elements validated and hash-sensitive, 4/4 authority modes enforced with no reachable fail-open default, 13/13 EDA steps ordered, durable recovery verified, evidence graph + trusted receipt verification shipped, exactly 7 agents, and package verification passing (proposal §11 metrics).
- Rollback is per-PR: a failing slice is reverted as a complete unit; prior accepted slices remain usable; immutable receipts and evidence logs are never rewritten; gates fail closed during rollback (proposal §10).
- Note for verify: SC-CHAIN-002/003/006 and the full 14-command behavior surface are only completely green after PR #8; the final verify phase runs after PR #9.
