# Proposal: invalidate canonical scope when operator selection changes

## Decision

Deliver only the first safety slice of `pi-operator-onboarding`: changing the selected company or fiscal period must invalidate the prior canonical binding and block protected work until the operator explicitly binds a fresh complete canonical scope.

This is a local correctness fix and a prerequisite beneath the company/period blocks of the user-confirmed six-block onboarding journey. It does **not** complete the onboarding assistant or master SDD-020.

## Intent

Prevent cross-company or cross-period work caused by a stale ten-element binding surviving a valid `/drenyra:company` or `/drenyra:period` change. Today, `ScopeContextStore.setCompany` and `setPeriod` merge legacy selections while retaining `canonical`, and `loadCanonicalScope` prefers the retained canonical company and period (`runtime/context.ts`). The existing guard can therefore accept the old binding (`extensions/scope-guard.ts`).

The slice aligns local behavior with `REQ-SCOPE-006` (scope-change invalidation), `REQ-SCOPE-007` (legacy compatibility), `REQ-SCOPE-009` (fail closed), and `REQ-CMD-003` (guard protected commands before delegation).

## Scope

### In scope

- Make a valid company change invalidate any canonical binding for the previous company.
- Make a valid fiscal-period change invalidate any canonical binding for the previous period.
- Require an explicit fresh ten-element canonical bind before any scope-requiring mission, chain, evidence-mutation, approval, or receipt-target command can proceed.
- Preserve same-selection idempotence: setting the already-bound company or period must not invalidate a matching canonical binding.
- Preserve validation behavior: an invalid RUC or period is rejected before persistence and changes neither the selected context nor the canonical binding.
- Fail closed when persisted legacy company/period and canonical company/fiscal period disagree, including files created by older versions or manual edits.
- Ensure a successful fresh canonical bind leaves operator-visible company/period and canonical company/fiscal period consistent. This is an acceptance outcome, not a prescribed implementation mechanism.
- Add focused tests at context persistence and scope-guard boundaries, including proof that rejected guarded operations cause no protected mission/evidence mutation.

### Safety invariant

After a real valid company or period change, the previous canonical binding must not become usable again merely because the selector is later changed back. Protected work remains blocked until a fresh explicit canonical scope is bound.

### Explicit non-goals

- No guided onboarding assistant, wizard, rich UI, or automatic first-mission start.
- No defaults or Pi-local derivation for tenant, organization, ledger book, operation type, policy version, actor, authority level, or any other scope element.
- No source-selection workflow, source-manifest authority, provenance model, or source hashing invention.
- No kernel authority, gate, receipt, approval, materiality, or mission-protocol changes.
- No `drenyra-ai` runtime upgrade and no frozen contract change.
- No install, doctor, packaging, publication, commit, PR, live network, or fiscal action.
- No modification of the completed archived conformance change or unrelated dirty team work.

## Acceptance scenarios

### Positive

1. **Fresh company selection:** given canonical scope for company A, when a valid company B is selected, protected commands fail closed until an explicit complete scope for B is bound; after that bind they may pass the existing guard.
2. **Fresh period selection:** given canonical scope for period P1, when valid period P2 is selected, protected commands fail closed until an explicit complete scope for P2 is bound.
3. **Same-selection idempotence:** selecting the company and period already represented by the canonical scope preserves the binding and scope hash.
4. **Fresh bind synchronizes views:** after a valid explicit canonical bind, legacy context/status displays and canonical reporting agree on company and fiscal period.

### Significant failure paths

1. A company or period change leaves the old canonical binding accepted by a scope-requiring command.
2. Changing away and then back silently resurrects a pre-change binding without a fresh explicit bind.
3. A persisted legacy/canonical mismatch is reported complete or is accepted by a protected command.
4. Invalid RUC or period input changes any persisted context or invalidates an otherwise valid matching binding.
5. A rejected mission, chain, or evidence mutation writes protected state before or after the guard failure.
6. A fresh canonical bind leaves company/period displays inconsistent with canonical values.

Any of these is a release-blocking failure for this slice.

## Affected areas

| Area | Expected impact |
|---|---|
| `runtime/context.ts` | Context transition and load consistency behavior |
| `extensions/scope-guard.ts` | Fail-closed handling of stale or mismatched persisted state, if needed |
| `__tests__/context.test.ts` / `__tests__/context-scope.test.ts` | Validation, idempotence, invalidation, persistence, and synchronization coverage |
| `__tests__/extension-scope-guard.test.ts` and focused command tests | Guard rejection and zero protected mutation coverage |

The exact implementation is deferred to design. The proposal does not choose between clearing canonical state, recording staleness, or another minimal local representation.

## Risks and controls

| Risk | Control |
|---|---|
| Operators are blocked more often after changing context | Explain that a fresh complete bind is required; never restore the old binding implicitly |
| Legacy files contain contradictory values | Treat mismatches as incomplete/stale and fail closed |
| A fix breaks same-selection workflows | Explicit idempotence acceptance tests |
| Context and status displays diverge after rebinding | Require visible values to match the new canonical binding |
| Scope expands into onboarding provenance or fiscal authority | Keep source/derivation/kernel work explicitly deferred |
| Shared dirty work is disturbed | Limit later implementation to the named local context/guard/tests and inspect ownership before edits |

## Rollback

Revert only the local context/guard behavior and its focused tests; there is no runtime pin, contract, source manifest, or fiscal-data migration to reverse. Because rollback would reintroduce the isolation defect, protected commands must remain disabled or operators must explicitly rebind scope before work resumes.

## Success criteria

- All positive and significant failure scenarios above are covered by focused tests.
- Every actual valid company/period change invalidates the old canonical binding until explicit rebinding.
- Same-value setters remain idempotent, and invalid input causes no mutation.
- Legacy/canonical mismatches fail closed.
- Guard rejection occurs before protected mission/chain/evidence mutation.
- Existing RUC check-digit, `YYYYMM`, ten-element binding, and kernel-authority boundaries remain unchanged.
- Estimated implementation is **100–220 changed lines**, within the 400-line review budget; chaining remains deferred unless design reveals new review-budget risk.

## Later: full onboarding exit criteria

The whole SDD2/onboarding outcome remains pending and is not waived. A later proposal may claim completion only when one controlled, fixture-backed journey covers the six user blocks: clean package install, fail-closed doctor, guided company selection, guided fiscal-period selection, authoritative source selection plus complete canonical-scope provenance, and explicit first-mission guidance/start behavior. That later work requires an approved authoritative scope/source-provenance contract; Pi must not infer missing values or hashing semantics.

Pi-local linkage is limited to evidenced pre-Wave-1 SDD-020 scaffolding and this independent safety prerequisite. This proposal neither promotes the master program nor claims master SDD-020 completion.

## Proposal question round

No additional interview or research round was run because the user explicitly selected `safety_slice_first` and confirmed the safety behavior. There is no open product decision blocking this slice.

The following PRD questions remain intentionally deferred to the later full-onboarding proposal: which authoritative component supplies missing scope values; what source selection means; who owns source-manifest and snapshot provenance; what operator identity/authority provenance is required; and whether first-mission start requires explicit confirmation. They are not answered or defaulted here.
