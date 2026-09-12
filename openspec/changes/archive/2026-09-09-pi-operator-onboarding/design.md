# Design: canonical-scope invalidation on operator selection changes

## Scope and status

This design covers only the approved `safety_slice_first` outcome from `proposal.md` and `preproposal.md`: changing the selected company or fiscal period invalidates an incompatible canonical binding and protected work remains blocked until an explicit fresh ten-element bind.

It does not design the guided onboarding journey, source selection or provenance, automatic mission start, scope defaults, or any fiscal/kernel behavior. The independent spec phase is not an input to this design and its files are not read or modified.

## Source findings

The current defect is local to the context projection and persistence path:

1. `ScopeContextStore.setCompany` and `setPeriod` validate their new input, spread the loaded context, and overwrite only the legacy selector. A previously persisted `canonical` object therefore survives a real selector change.
2. `loadCanonicalScope` copies a valid canonical scope before considering legacy company/period. Because canonical values win, contradictory legacy selectors cannot make the report incomplete.
3. `evaluateScopeGuard` in `extensions/scope-guard.ts` correctly fails closed when `loadCanonicalScope` reports an incomplete scope or canonical binding fails. Its policy and hash checks are not the defect.
4. Protected handlers in `extensions/register.ts` already evaluate `ScopeGuard` before constructing an `EdaMissionCoordinator` or calling `runChainStep`; mission and evidence side effects can therefore remain behind the existing boundary if the context report becomes incomplete.
5. `/drenyra:scope set` already calls strict `bindScope` before persistence. `ScopeContextStore.setCanonicalScope` currently persists canonical scope without synchronizing legacy `company` and `period`, so displays can diverge.
6. The source has no function named `validateScopeContext`; the relevant persisted-context validator is `isValidScope` in `runtime/context.ts`.
7. `runtime/ruc.ts` accepts only `^\d{11}$` values whose SUNAT Módulo 11 check digit is valid. Canonical-company equality can therefore be exact string equality, but only after `isValidCanonicalScopeValue` has established that the canonical company is a validated RUC. RUC values must never be converted to numbers or normalized heuristically.

## Architecture decision

Use absence of `ScopeContext.canonical` as the sole local invalidated state. Do not add a stale marker, binding history, selector cache, version field, migration schema, or Pi-local authority decision.

This is the smallest safe representation because the previous canonical bytes are removed by the existing atomic save. Once removed, changing a selector away and then back cannot resurrect them. Only `setCanonicalScope` can persist a complete binding again.

### 1. One consistency rule

A canonical scope is usable alongside legacy selectors only when:

- the canonical object first passes `isValidCanonicalScopeValue`;
- every present, validated legacy company equals `canonical.company`; and
- every present, validated legacy period equals `canonical.fiscalPeriod`.

Canonical validity must be established before any comparison. In particular, malformed or non-check-digit-valid canonical company text is never treated as an identity to compare or retain.

Implement this as a small private consistency predicate in `runtime/context.ts` and reuse it from projection, persistence validation, and setter retention decisions. This remains context consistency logic, not fiscal or authorization logic.

### 2. Setter transitions

`setCompany(ruc)` and `setPeriod(period)` keep their public return types and follow this order:

1. Validate the proposed RUC or period before loading or saving anything. Invalid input throws through the existing error path, invokes no save, and changes neither selector nor canonical state.
2. Load the current context.
3. Retain `canonical` only if the entire loaded selector/canonical state is already consistent and the proposed value equals the corresponding canonical value.
4. Otherwise omit `canonical` from the next context.
5. Save the next context atomically with the selected value.

Consequences:

- Setting an already-bound matching company or period is semantically idempotent and preserves the same canonical bytes and scope hash.
- A real valid change persists the new selector and removes the old canonical binding.
- A pre-existing company or period mismatch from an older version or manual edit cannot be repaired by selecting back to the canonical value; the setter removes the suspect canonical binding. A fresh explicit bind is still required.
- Once a change removes canonical state, later selector changes operate on a context with no canonical value and cannot restore it.

`isValidScope` will also reject a context containing a valid canonical object plus a contradictory present selector. This prevents direct `save` callers from creating new mismatch files. Canonical-only legacy files remain valid for backward compatibility because an absent selector is not a contradiction.

### 3. Load and mismatch handling

`loadCanonicalScope(context)` must never merge contradictory sources or fall back to the old canonical identity.

- If canonical is valid and consistent with every present selector, project all ten canonical elements as today.
- If either present selector disagrees, treat the entire canonical object as unusable for this report. Project only independently validated legacy company/period selections and report the other eight elements missing.
- If canonical itself is invalid, retain the existing fail-closed behavior: ignore it and project only independently valid legacy selectors.
- Do not copy tenant, organization, source snapshot, actor, authority, or any other field from a rejected canonical object.

Rejecting the whole canonical object, rather than substituting just the mismatched field, prevents a hybrid scope from appearing complete and ensures the guard cannot bind old canonical fields under a new company or period.

The development store may still load an older/manual file containing individually valid but contradictory values so diagnostics can show the selected company/period. The projection is nevertheless incomplete, and protected commands fail closed. No migration or automatic rewrite is required.

### 4. Explicit bind synchronization

After validating the complete input, `setCanonicalScope(scope)` atomically persists:

- `company: { ruc: scope.company }`;
- `period: { period: scope.fiscalPeriod }`; and
- `canonical: scope`.

This makes the explicit canonical bind the only operation that restores completeness and makes `/drenyra:context`, status projections, and canonical reporting agree immediately. Existing strict `bindScope` validation in `/drenyra:scope set` remains before this persistence call. No missing value is inferred.

### 5. Guard and handler boundary

No production edit is planned for `extensions/scope-guard.ts` or `extensions/register.ts`.

The context report is the guard input. After invalidation or mismatch it is incomplete, so every existing `requires-scope` command returns `ok: false` before a binding is available. Existing handler order then returns before protected delegation:

```text
selector change or mismatched file
  -> ScopeContextStore.load
  -> loadCanonicalScope: reject old canonical, incomplete report
  -> ScopeGuard.evaluate: ok = false
  -> handler returns
  -> no coordinator start/advance, chain step, evidence append, approval, or receipt target
```

Pre-scope commands remain available for diagnosis and rebinding. The command policy table, expected-hash behavior, canonical hashing, and pinned-kernel delegation remain unchanged.

## State-transition table

| Current state | Operation | Persisted result | Protected work |
| --- | --- | --- | --- |
| Matching selectors + canonical A/P1 | set company A | Canonical retained; hash unchanged | Existing guard may pass |
| Matching selectors + canonical A/P1 | set period P1 | Canonical retained; hash unchanged | Existing guard may pass |
| Matching selectors + canonical A/P1 | set company B | Company B, period P1, no canonical | Blocked until explicit bind |
| Matching selectors + canonical A/P1 | set period P2 | Company A, period P2, no canonical | Blocked until explicit bind |
| No canonical after A -> B | set company A | Company A, no canonical | Still blocked; no resurrection |
| Valid legacy/canonical mismatch | load/guard | Legacy selections projected; canonical-only fields missing | Blocked |
| Any valid state | invalid RUC/period setter | No save; state byte-for-byte unchanged | Prior state unchanged |
| Incomplete or stale state | explicit valid ten-element bind B/P2 | Company B, period P2, canonical B/P2 | Existing guard may pass |

## Data and contract impact

- `ScopeContext`, `CanonicalScope`, `CanonicalScopeReport`, setter signatures, JSON field names, and canonical serialization remain unchanged.
- There is no monetary data in this slice; BigInt-cent conventions are unaffected.
- Scope hashes continue to come only from `lib/canonicalization.bindScope`.
- The context store remains a development-grade atomic JSON adapter, not authoritative fiscal state.
- No runtime pin, vendored artifact, package/runtime contract, kernel entry point, gate, approval, receipt, materiality rule, or archived conformance artifact changes.

## Exact implementation allowlist

Later implementation is limited to these files:

1. `runtime/context.ts` — consistency predicate, projection behavior, setter invalidation, save consistency, and explicit-bind synchronization.
2. `__tests__/context.test.ts` — persisted setter transitions, invalid-input/no-save behavior, idempotence, away/back non-resurrection, and bind synchronization.
3. `__tests__/context-scope.test.ts` — canonical/legacy mismatch projection and no-hybrid/no-old-canonical behavior.
4. `__tests__/extension-scope-guard.test.ts` — complete guard rejection for mismatched and invalidated contexts, plus matching-scope preservation.
5. `__tests__/extension.test.ts` — actual mission and evidence-chain handler rejection before protected durable side effects.
6. `README.md` — docs-as-code note that a real `/drenyra:company` or `/drenyra:period` change requires a fresh complete `/drenyra:scope set` before protected commands.

`extensions/scope-guard.ts`, `extensions/register.ts`, all `lib/` fiscal/mission/evidence modules, `contracts/`, `runtime/pin.ts`, `vendored/`, archived OpenSpec changes, and independent spec files are explicitly outside the implementation allowlist. If RED tests show that the existing guard/handler ordering cannot enforce this design without changing a non-allowlisted production file, implementation must stop and return for design review rather than expand scope silently.

### Approved metadata design amendment

The gatekeeper authorizes the additive `docs/architecture/program-lock-facts.json` surface now, before apply, so the active-change snapshot cannot become a predictable mid-apply blocker. This does not change the scope-fix behavior or any schema. Preserve the existing team snapshot, runtime pin and checksum, schema, and `scripts/compute-candidate-identity.mjs` allowlist limitations; refresh only the new `activeChanges` entry and required observed counts, digests, and normalized identity inputs. Metadata additions are authored review lines and are included in the task forecast. Rollback removes only this metadata refresh, leaving the safety-slice code/tests/docs independently revertible.

## Test strategy

All tests use Vitest through the repository script. Do not use stale `bun test` discovery.

### RED

Add focused failing cases before production changes:

- `context.test.ts`
  - company A/P1 canonical -> valid company B removes canonical and persists B;
  - valid period P2 removes canonical;
  - selecting matching A and P1 preserves canonical and its binding hash;
  - invalid RUC and invalid period call no `save` (a recording subclass or equivalent observable) and preserve the full prior context;
  - A -> B -> A leaves canonical absent;
  - explicit canonical bind overwrites stale/absent legacy selectors with canonical company/period in one persisted document;
  - direct `save` rejects valid-but-contradictory selector/canonical state.
- `context-scope.test.ts`
  - valid company mismatch and valid period mismatch each produce `complete: false`;
  - the report uses validated legacy selector values but contains none of the rejected canonical-only fields;
  - invalid canonical company is rejected before identity comparison and cannot be made usable by matching text.
- `extension-scope-guard.test.ts`
  - an older/manual valid mismatch is rejected for a representative `requires-scope` command with no binding;
  - a real setter change is rejected;
  - same-value setters preserve the accepted binding and hash.
- `extension.test.ts`
  - bind A/P1, change a selector, invoke `/drenyra:mission` and a valid evidence add operation, and assert both return at the scope guard while no `.local` mission/evidence store is created or changed. This exercises the actual callbacks and proves the rejection precedes protected side effects.

Focused RED command:

```bash
bun run test -- __tests__/context.test.ts __tests__/context-scope.test.ts __tests__/extension-scope-guard.test.ts __tests__/extension.test.ts
```

Record the expected failing assertions, not unrelated baseline failures.

### GREEN

Implement only the `runtime/context.ts` decisions above, then rerun the same focused command until all added and existing focused cases pass. Do not weaken assertions, alter command policy, or add fallback behavior to make tests green.

Also run strict type checking:

```bash
bun run typecheck
```

### TRIANGULATE

Run the focused suites once more as a group to detect shared-state/order issues, then preserve the existing 700+ test baseline with the complete repository suite:

```bash
bun run test -- __tests__/context.test.ts __tests__/context-scope.test.ts __tests__/extension-scope-guard.test.ts __tests__/extension.test.ts
bun run test
```

No install, doctor, package publication, network, runtime lifecycle, or fiscal action is part of verification. Runtime harness verification is `N/A`: this slice changes local context persistence and command pre-delegation behavior, fully exercised through hermetic extension handlers with injected temporary stores.

## Rollout and rollback

The behavior takes effect on the next context load; no migration is needed. Existing consistent contexts continue to work. Existing valid mismatches become incomplete at guard evaluation. A selector change atomically removes the incompatible canonical field, and the operator must explicitly bind a fresh complete scope.

Rollback is limited to the six allowlisted files. Because rollback restores the cross-company/cross-period isolation defect, protected commands must remain disabled operationally until operators explicitly rebind their intended scope.

## Review workload forecast

This is one coherent correctness work unit: context invariant + focused boundary tests + operator documentation.

| Area | Forecast changed lines |
| --- | ---: |
| `runtime/context.ts` | 35–60 |
| Four focused test files | 115–175 |
| `README.md` | 5–10 |
    | `docs/architecture/program-lock-facts.json` metadata | 0–25 |
| **Total** | **155–270** |

The forecast remains below the 400-line review budget, so the delivery strategy stays a single coherent review unit and no chain decision is needed. If implementation exceeds 400 authored changed lines, `ask-on-risk` requires a pause before further work; no chain strategy or `size:exception` may be inferred.

Suggested work-unit outcome: `fix(scope): invalidate stale canonical bindings`. Tests and docs remain in the same unit as the behavior; rollback removes only this local safety slice.

## Deferred work

The complete guided onboarding/source-provenance journey remains pending: clean install guidance, doctor journey, guided company/period UI, authoritative source selection and manifest provenance, missing canonical-field provenance, and explicit first-mission guidance/start. This design neither supplies defaults for those fields nor claims SDD-020 completion.
