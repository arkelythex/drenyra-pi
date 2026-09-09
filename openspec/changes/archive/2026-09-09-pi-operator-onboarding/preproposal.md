# Preproposal record: `pi-operator-onboarding`

## Confirmed product selection

The user selected `safety_slice_first`:

> Corregir primero el aislamiento del contexto.

The first delivery is narrowed to canonical-scope invalidation when the selected company or fiscal period changes. This is an independent local correctness defect supported by repository evidence; the partial exploration is sufficient for this slice even though it is not sufficient to design the full onboarding assistant.

## Selected outcome

- A real valid company or period change cannot silently retain or later resurrect the previous canonical binding.
- Protected mission, chain, evidence-mutation, approval, and receipt-target work requires an explicit fresh complete canonical scope.
- Same-selection behavior remains idempotent.
- Existing RUC and `YYYYMM` validation remains unchanged; invalid input causes no mutation.
- Persisted legacy/canonical mismatches fail closed.
- A successful fresh canonical bind must leave operator-visible company/period consistent with canonical values; implementation mechanics remain for design.

## Alternatives not selected

- Full onboarding/wizard implementation in the first delivery.
- External research or operator interview before this safety slice.
- Pi-local scope defaults or derivation.
- Pi-owned source selection, provenance, or hashing semantics.
- Kernel authority changes, runtime upgrade, or frozen contract changes.

External research was offered as an alternative and was not selected. No research or interview is launched in this phase.

## Product boundary retained

The user’s whole six-block SDD2 onboarding requirement remains later scope: clean install, doctor, guided company and period selection, authoritative source/canonical-scope provenance, and first-mission guidance. It is pending—not waived—and this safety slice must not be presented as complete SDD2 or complete master SDD-020.

Local SDD-020 linkage is limited to the already evidenced pre-Wave-1 configurator scaffolding and this safety prerequisite; no master promotion or completion claim is made.

## Delivery controls

- Artifact store: OpenSpec.
- Delivery strategy: `ask-on-risk`.
- Review budget: 400 changed lines; safety slice estimate 100–220 lines.
- Chain strategy: deferred for this new scope.
- Implementation is authorized, but commits, publication, runtime upgrades, contract changes, and fiscal actions are not.
- Completed archived conformance artifacts and unrelated dirty team work must remain untouched.
- This phase creates proposal artifacts only: no spec, design, tasks, or implementation.
