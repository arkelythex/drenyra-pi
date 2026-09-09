# Exploration: `pi-operator-onboarding`

## Phase result

**Phase:** `sdd-explore`  
**Status:** partial, honest source inspection only  
**Persistence:** this file is the authoritative OpenSpec artifact.  
**Execution:** no runtime tests, installs, network, builds, packs, fiscal actions, or mutation commands were run. No other artifact was created. Existing archive and dirty team work were preserved.

The prior exploration text was incorrect where it claimed end-to-end UX verification, orchestrator persistence, readiness, auto-derived defaults, or Pi-owned source hashing. Those claims are withdrawn.

## Current implementation map

| Area | Repository evidence | Finding |
|---|---|---|
| Package entrypoint | `extensions/register.ts:~1-130, ~1130-1260` | Registers commands through a minimal structural Pi API. No verified rich UI surface is established. |
| Install/configuration | `lib/configurator.ts:~1-260`; `runtime/installer.ts`; `runtime/doctor.ts` | Package-local pin/install/doctor and managed host composition exist. Configurator is host composition, not fiscal context or source onboarding. |
| Context | `runtime/context.ts:~1-320` | Persists validated legacy company/period and an optional ten-element canonical scope. Legacy setters do not invalidate an existing canonical scope. |
| Manual scope | `extensions/register.ts:~475-530`; `prompts/scope.md` | The only complete-scope path is positional `/drenyra:scope set` with all ten values. |
| Guard | `extensions/scope-guard.ts:~37-190`; `lib/chain-pipeline.ts:~940-970` | Incomplete/invalid/stale bindings fail closed before protected work. Cross-contamination after changing legacy company/period while a canonical scope remains is a genuine candidate safety gap. |
| Mission | `lib/mission-commands.ts`; `extensions/register.ts:~635-760` | Mission creation delegates after scope validation; it is executable integration, but not an onboarding flow. |
| Sources | `chains/reconcile.ts:~50-190`; `chains/verify.ts:~50-80, ~260-365` | Chains consume bounded manifests. No source-selection workflow is present; `sourceSnapshot` is supplied/checked against a manifest digest. |

## Pinned installed runtime inspection

Read-only inspection of the current repository’s `node_modules/drenyra-ai` package (`package.json`, `dist/index.d.ts`, and public subpath declarations) found:

- Public exports include `missions`, `candidates`, `gates`, `receipts`, `evidence`, `tenant`, `adapters`, `configurator`, and `flow`.
- `configurator` exposes managed host composition (`PINNED_AI_COMPOSITION`, host pin/rendering, manifests, diagnostics), but no company/period/source profile importer or canonical fiscal-scope resolver.
- `adapters` exposes `EvidenceAdapter`, `AdapterRegistry`, `EvidenceFetchInput` (`missionId`, `ruc`, `period`, required types), hash-addressed `EvidenceItem`, and `evidenceManifestHash(items)`. This is a connector/evidence framework, not a ten-element scope derivation API. It does not provide tenant, organization, ledger book, operation type, policy version, actor, or authority-level derivation.
- `tenant` exposes tenant-scope validation/comparison, but the inspected index does not expose a user-facing profile importer or selection resolver.
- `missions` exposes mission protocol/runtime/store/types, not an onboarding resolver.

These are **source inspection findings**, not runtime reproduction. No imported API was executed. No public contract was found that authoritatively derives the missing eight fields or defines a company/period/source selection workflow. Therefore Pi must not invent defaults, hash an arbitrary local source set, or treat configurator hashes as fiscal source snapshots.

## Confirmed and unresolved decisions

Confirmed: exact package-local `drenyra-ai@0.4.1`; doctor is fail-closed; canonical scope has ten elements; RUC and `YYYYMM` are validated; protected commands require a complete binding; Pi never owns fiscal authority; frozen contracts/pin cannot change without approval; money remains BigInt cents/no floats.

Unresolved product choices:

1. Which authoritative kernel component, if any, supplies tenant/organization/ledgerBook/operationType/policyVersion/actor/authorityLevel for a selected company and period?
2. What does “sources selection” mean: registered evidence adapter(s), an already-authorized manifest, or another kernel-defined source profile?
3. Does the kernel provide the source manifest and its snapshot, or only evidence items and `evidenceManifestHash`? Pi cannot choose the hash semantics.
4. Is onboarding command-only (the verified host surface currently supports command output) or does a future verified Pi UI adapter exist?
5. Should first mission start automatically after a valid context, or require explicit confirmation?
6. What operator identity/authority provenance is required? No safe default is evidenced.

## Independent safety slice

A separable first slice is **scope invalidation safety**, not a wizard: when legacy company or period changes, an existing canonical binding must no longer be accepted for protected work unless the binding demonstrably matches the changed values. The implementation must preserve fail-closed behavior and avoid mutation. This slice can be reviewed independently of source selection or guided onboarding.

The affected evidence is `runtime/context.ts` setter merge behavior and `extensions/scope-guard.ts` evaluation. Add tests for canonical RUC A → legacy company RUC B and period changes, asserting mission/chain commands reject and no mission/store mutation occurs. Whether invalidation means clearing canonical state or marking it stale is a product/contract choice; do not assume it here.

## First reviewable units (each ≤400 lines)

1. **Safety unit (recommended first):** tests plus minimal scope-binding invalidation/rejection, estimated 100–220 changed lines. No kernel or contract changes.
2. **Kernel-contract adapter unit:** only after the public authoritative API is identified/approved; thin Pi adapter and tests for selected company/period/source provenance, estimated 180–300 lines.
3. **Guided onboarding unit:** command-first workflow and structured output, only after source and derivation semantics are settled, estimated 200–350 lines.
4. **Closure evidence unit:** controlled clean-package fixture → doctor → valid context → first mission; no live fiscal action or network.

## Safe validation commands and fixtures

For later authorized work, the configured actual runner is Vitest via `bun run test`; do not use a stale bare `bun test` entry. Focused commands may target `__tests__/context.test.ts`, `__tests__/context-scope.test.ts`, `__tests__/extension-scope-guard.test.ts`, `__tests__/doctor.test.ts`, and relevant chain tests. Also use `bun run typecheck`; package/capability/style verification only after implementation authorization.

Use existing temporary-directory fake runtime and balanced-manifest fixtures. Assert file snapshots before/after rejected scope changes. Do not run installs, network fallback, builds/packs, live fiscal actions, or mutation commands during exploration.

## Master/Dominion trace

Repository evidence only: `docs/architecture/program-lock-facts.json` states Pi-local input does not promote the program master; `docs/architecture/capability-conformance-matrix.md:43-57` labels related configurator work as scaffolding/reference. No new master ID or decision is inferred. Conformance #1 is treated as archived per the user’s confirmed state.

## Dependency blocker and recommendation

The blocker is an absent observed public contract for authoritative onboarding derivation and source provenance—not a reason to fabricate local defaults. Request/verify an approved pinned-kernel contract that accepts validated company/period and an explicitly defined source selection, then returns a complete canonical scope plus provenance and source snapshot (or a typed fail-closed result). Pi should pass that result to existing canonical binding/guards and delegate mission creation to the kernel.

Do not proceed to proposal/product approval while those choices remain unresolved. If a proposal phase is later authorized, use the installed command name `sdd-proposal`, not `sdd-propose`.
