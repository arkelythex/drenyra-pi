# Design: Shell Skills Registry Consumption (Skills-Only Scope)

## Technical Approach

Add one new dedicated adapter file, `lib/routing/skill-resolver.ts`, that
constructs an in-memory `SkillRegistry` populated from the Core's
`BASE_PE_SKILLS` and exposes one pure, fail-closed function mapping
`(taskId, at, jurisdiction) -> readonly VersionPin[]`. Call it once from
`buildStatusPreflightRequest` in `extensions/register.ts` to populate
`workUnitInput.skills`, replacing the hardcoded `[]`. This is the same "thin
adapter over Core API" shape as `lib/routing/direct-port.ts` (SDD #3): one
small file, one bounded Core call, an explicit typed mapping, no invented
business logic. Both readings below correct concrete gaps the exploration/
proposal did not resolve: `SkillRegistry` is an *empty* class requiring
`register()` before `resolveAt()` finds anything, and `WorkUnitInput.skills`
is typed `readonly VersionPin[]` (id/version/contentHash), not
`SkillDefinition[]` — `resolveAt()`'s return value must be projected, not
passed through.

## Architecture Decisions

### Decision: `taskId` source — no invented task→skill mapping

**Choice**: Pass `mission.intent` (the `MissionIntent` string already on the
loaded `MissionSnapshot` at the call site, `extensions/register.ts:266-268`)
directly as `taskId` into `resolveAt`. No mapping table is introduced.
**Alternatives considered**: A `MissionIntent -> skill id` lookup table
(e.g. `"compliance-check" -> "pe.igv-validate"`); the literal command name
`"status"`.
**Rationale**: `MissionIntent` is `"monthly-close" | "correction" |
"reconciliation" | "invoice-review" | "compliance-check"`
(`node_modules/drenyra-ai/dist/missions/commands.d.ts:16`); `BASE_PE_SKILLS`
ids are `"pe.igv-validate"`, `"pe.sire-compare"`, `"pe.detraction-check"`,
`"pe.retention-check"`, `"pe.perception-check"`, `"pe.sire-filing"`
(`node_modules/drenyra-ai/dist/skills/pe.js:31-49`). **None of the five
intents match any base skill id today.** Inventing a mapping would be
exactly the local skill-selection judgment call the README's Dominion
Program table reserves to the master (SDD-070) — `packaged-skills` is
already tagged `Referenced-only`. Using `mission.intent` literally means:
in production, every real `/drenyra:status` call deterministically resolves
`SKILL_NOT_FOUND` -> `skills: []` today, behaviorally identical to the prior
hardcoded `[]`, but now sourced through the real Core mechanism instead of a
literal. This is an honest, stated limitation (see capability-manifest
note below), not a hidden gap.

### Decision: `jurisdiction` — hardcoded `"PE"` constant, not derived

**Choice**: `jurisdiction = "PE"`, a hardcoded literal.
**Alternatives considered**: Deriving jurisdiction from
`CanonicalScope.company`'s RUC.
**Rationale**: An 11-digit RUC (`runtime/context.ts:67`, validated by
`isValidRuc`) is Peru-specific by construction — the check-digit algorithm
and the `scope-discipline` skill both assume Peru; the RUC string itself
encodes no ISO-3166 country code to "derive". `CanonicalScope` has no
multi-jurisdiction concept anywhere in this repo today. Stating `"PE"` as a
hardcoded constant (not a derivation) is the honest description; the
exploration's "implied by RUC" framing is imprecise and is corrected here.

### Decision: `at` — calendar date only, not a full timestamp

**Choice**: `new Date().toISOString().slice(0, 10)` (`YYYY-MM-DD`).
**Alternatives considered**: `new Date().toISOString()` unmodified.
**Rationale**: `IsoDate` is documented as "ISO-8601 calendar date
(YYYY-MM-DD)" (`skills/types.d.ts:17`) and `isValidIsoDate` in the Core
registry enforces `/^\d{4}-\d{2}-\d{2}$/`
(`node_modules/drenyra-ai/dist/skills/registry.js:65-68`). A full timestamp
fails that regex, making `isSkillInForce` always return `false` and every
resolution silently fail as `SKILL_OUT_OF_VALIDITY` — a real correctness
bug the exploration did not catch. `.slice(0, 10)` is required.

### Decision: fail-closed mapping — every `SkillError` code, not just two

**Choice**: `resolveWorkUnitSkills` catches `SkillError` (all five codes:
`SKILL_INVALID`, `SKILL_CHECKSUM_MISMATCH`, `SKILL_NOT_FOUND`,
`SKILL_OUT_OF_VALIDITY`, `SKILL_JURISDICTION_MISMATCH`) and returns `[]`.
**Alternatives considered**: Catching only `SKILL_OUT_OF_VALIDITY`/
`SKILL_JURISDICTION_MISMATCH` per the proposal's success-criteria wording;
surfacing failure as a preflight-blocking stop.
**Rationale**: `resolveAt` also throws `SKILL_NOT_FOUND` for an unmatched
`taskId` (the expected production outcome per the decision above), which
must not be uncaught. `lib/routing/preflight.ts`'s eight stages never read
`workUnitInput.skills`; only the published `createWorkUnit`/
`validateWorkUnit` helpers touch it, via `checkVersionPin` requiring a
well-formed (non-empty id/version) entry — `[]` always satisfies this, same
as today. An empty `skills` therefore never blocks preflight; this matches
the proposal's own risk-table claim ("additive only... unrelated callers
unchanged").

### Decision: dedicated file, module-level lazy singleton registry

**Choice**: `lib/routing/skill-resolver.ts` exports `buildBasePeSkillRegistry()`
(pure, registers `BASE_PE_SKILLS`) and `resolveWorkUnitSkills(registry,
taskId, at, jurisdiction)` (pure, fail-closed, projects `SkillDefinition ->
VersionPin`). `extensions/register.ts` calls a lazily-memoized module-level
registry built once, mirroring `PACKAGE_ROOT`'s eager-once pattern.
**Alternatives considered**: Inline resolution in `register.ts`.
**Rationale**: Follows this repo's established "small dedicated Core-adapter
file" pattern (`lib/routing/direct-port.ts`); splitting registry
construction from resolution keeps both independently unit-testable without
reaching into module-private state.

## Data Flow

    extensions/register.ts (buildStatusPreflightRequest)
        │  mission.intent, "PE", today's date
        ▼
    lib/routing/skill-resolver.ts
        buildBasePeSkillRegistry()  ──registers──▶ BASE_PE_SKILLS (drenyra-ai/skills)
        resolveWorkUnitSkills(registry, taskId, at, jurisdiction)
        │  SkillRegistry.resolveAt() → SkillDefinition | throws SkillError
        ▼  map to VersionPin{id,version,contentHash} or [] on any SkillError
    workUnitInput.skills: readonly VersionPin[]
        ▼
    runRoutingPreflight → createWorkUnit/validateWorkUnit (checkVersionPin) → WorkUnit

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `lib/routing/skill-resolver.ts` | Create | `buildBasePeSkillRegistry()` + `resolveWorkUnitSkills()`; imports `SkillRegistry`, `SkillError`, `BASE_PE_SKILLS` from `drenyra-ai/skills`, `VersionPin`/`Sha256Hash` from `drenyra-ai` |
| `extensions/register.ts` | Modify | `buildStatusPreflightRequest` calls the resolver; `skills: []` (line 321) becomes the resolved array |
| `__tests__/routing/skill-resolver.test.ts` | Create | Three success-criteria tests (below) |
| `capability-manifest.yaml` | Modify | Extend the existing `drenyra-commands` row's `sources`/`tests`/`note` — no new top-level key |
| `docs/architecture/capability-conformance-matrix.md` | Modify | Extend the `drenyra-commands` row evidence/boundary text |

## Interfaces / Contracts

```typescript
// lib/routing/skill-resolver.ts
export function buildBasePeSkillRegistry(): SkillRegistry;
export function resolveWorkUnitSkills(
  registry: SkillRegistry,
  taskId: string,
  at: string,        // YYYY-MM-DD
  jurisdiction: string,
): readonly VersionPin[]; // [] on any SkillError; else exactly one pin
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | Correct selection | `resolveWorkUnitSkills(registry, "pe.igv-validate", "2026-06-01", "PE")` → one `VersionPin` matching `IGV_VALIDATE` |
| Unit | `SKILL_OUT_OF_VALIDITY` fail-closed | Same id, `at="2025-01-01"` (before `validity.from`) → `[]` |
| Unit | `SKILL_JURISDICTION_MISMATCH` fail-closed | Same id/date, `jurisdiction="MX"` → `[]` |
| Unit | `SKILL_NOT_FOUND` fail-closed | `taskId` = a real `MissionIntent` value (e.g. `"monthly-close"`) → `[]` |
| Integration | `/drenyra:status route` unaffected | Existing `__tests__/extension.test.ts` / `__tests__/routing/direct-port.test.ts` pass unmodified |

All three proposal success-criteria fixtures use real `BASE_PE_SKILLS`
constants imported from `drenyra-ai/skills` directly — no synthetic
`SkillDefinition` is needed; `IGV_VALIDATE` alone (jurisdiction `"PE"`,
`validity.from: "2026-01-01"`, no `to`) exercises all three cases by varying
`at`/`jurisdiction`. Never fork/copy skill bytes into a Shell fixture.

## Threat Matrix

N/A — no shell command, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. The change is in-process
TypeScript data population feeding an advisory `WorkUnitInput` field already
validated by the published `createWorkUnit`/`validateWorkUnit` helpers; it
does not touch the Core `route()` decision or any of the eight preflight
stages.

## Migration / Rollout

No migration required. Revert `extensions/register.ts` to `skills: []` and
delete `lib/routing/skill-resolver.ts` + its test to roll back fully (per
proposal's rollback plan).

## Open Questions

- [ ] Whether a future SDD should define a real `MissionIntent -> skill id`
      mapping (master-owned per Dominion Program, out of this change's
      authority) so production calls can ever resolve a hit.
