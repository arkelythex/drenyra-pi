# Research: pi-capability-conformance

Phase: sdd-research
Lane: capability-maturity-taxonomy-prior-art
Status: done (persisted by orchestrator — the research collector role does not read/write repo state itself)
Collected: 2026-09-08

## Executive Summary

Kubernetes' alpha/beta/stable API graduation is the strongest precedent for a test-gated maturity ladder: alpha requires no guarantees, beta requires end-to-end tests complete plus thorough API review, and stable/GA requires SIG-Architecture-approved conformance tests in a defined profile — each transition is evidence-gated, not self-declared. OpenTelemetry semantic conventions use a parallel five-level ladder (development→alpha→beta→release_candidate→stable) with a hard monotonicity rule: stability never regresses. Terraform Registry tiers (official/partner/partner premier/community) are ownership/support tiers, not implementation-verification levels, and are a weaker analog. Backstage's `catalog-info.yaml` ships a real machine-readable `lifecycle` field (experimental/production/deprecated) — direct precedent for embedding maturity in a manifest — but leaves entry-criteria enforcement to the adopting org. OpenFeature/CNCF separate project-level maturity (sandbox/incubating/graduated) from per-provider runtime status (READY/STALE/ERROR), a different axis than "has this been tested." Critically, OpenSpec's own upstream docs define **no** requirement/spec maturity or verification-status taxonomy — only RFC-2119 keyword strength and an optional, unstructured `/opsx:verify` step — so this repo's proposed `verificationLevel` field fills a genuine gap rather than diverging from an existing OpenSpec convention.

## Sources

1. **S1** — documentation — "API Versioning" — Kubernetes docs — https://kubernetes.io/docs/reference/using-api/ — accessed 2026-09-08 — excerpt: "alpha ... may change or be dropped without notice; beta ... well tested, not recommended for production; stable/GA ... production-ready, long-term support."
2. **S2** — documentation — "API Changes (SIG Architecture)" — kubernetes/community GitHub — https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api_changes.md — accessed 2026-09-08 — excerpt: beta requires "end-to-end tests complete"; stable "must have conformance tests, approved by SIG Architecture, in the appropriate conformance profile."
3. **S3** — documentation — "Semantic convention groups" — OpenTelemetry docs — https://opentelemetry.io/docs/specs/semconv/general/semantic-convention-groups/ — accessed 2026-09-08 — excerpt: stability levels "development, alpha, beta, release_candidate, and stable"; "Group stability MUST NOT change from stable to any other level."
4. **S4** — documentation — "OTEP 0232: maturity of otel" — open-telemetry/opentelemetry-specification GitHub — https://github.com/open-telemetry/opentelemetry-specification/blob/v1.50.0/oteps/0232-maturity-of-otel.md — accessed 2026-09-08 — excerpt: formalizes the experimental→stable maturity progression rationale.
5. **S5** — documentation — "Providers overview" — HashiCorp Developer — https://developer.hashicorp.com/terraform/registry/providers — accessed 2026-09-08 — excerpt: "Official ... owned and maintained by HashiCorp. Partner ... maintain a direct partnership with HashiCorp ... Community providers are published and maintained by individual contributors."
6. **S6** — documentation — "Concepts" — Fission-AI/OpenSpec GitHub — https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md — accessed 2026-09-08 — excerpt: only RFC-2119 keyword strength documented; `/opsx:verify` is "optional," with no formal maturity/status taxonomy found.
7. **S7** — documentation — "Descriptor Format of Catalog Entities" — Backstage docs — https://backstage.io/docs/features/software-catalog/descriptor-format/ — accessed 2026-09-08 — excerpt: `lifecycle` field values "experimental," "production," "deprecated" describe "the maturity or operational state" of a catalog object; org must define its own taxonomy.
8. **S8** — open-web — "OpenFeature specification / CNCF maturity" — openfeature.dev + CNCF — https://openfeature.dev/specification/sections/providers/ ; https://github.com/open-feature/spec — accessed 2026-09-08 — excerpt: provider status values "NOT_READY, READY, STALE, ERROR, RECONCILING"; OpenFeature itself is a CNCF Incubating project — project-level maturity is separate from flag-level state.

## Claims

- **C1** (S1, S2): Kubernetes' alpha/beta/stable ladder is evidence-gated at each transition — beta requires completed end-to-end tests, stable requires SIG-Architecture-approved conformance tests — not a self-reported label.
- **C2** (S3, S4): OpenTelemetry's semantic-convention maturity levels (development/alpha/beta/release_candidate/stable) are monotonic — a group's stability can only advance, never regress, once published.
- **C3** (S5): Terraform's provider tiers (official/partner/partner premier/community) encode *maintainer/ownership* trust, not implementation-verification depth, and are the weakest analog for a "declared→tested→validated" ladder.
- **C4** (S7): Backstage's `catalog-info.yaml` `lifecycle` field is a real, shipped, machine-readable precedent for putting a maturity value directly in a project manifest — but Backstage explicitly delegates entry-criteria definition/enforcement to the adopting organization; it is a labeling convention, not a verification pipeline.
- **C5** (S8): OpenFeature/CNCF separates two different maturity axes — project-level (sandbox/incubating/graduated, governance-driven) and provider-runtime-level (READY/STALE/ERROR, operational) — neither of which maps to "has this capability been unit-tested vs. e2e-validated."
- **C6** (S6): OpenSpec's own current upstream documentation defines no requirement/spec/capability maturity or verification-status taxonomy; this change's planned `verificationLevel` field is original work filling a real gap, not a divergence from an existing OpenSpec norm.

## Gaps

- No external, citable project was found whose manifest schema uses the *exact* four-stage shape requested (declared-only → implemented → unit/contract-tested → e2e-validated-against-real-runtime). The closest structural analog (Kubernetes) collapses "implemented" and "unit-tested" into its beta gate and treats GA as the only "validated against real usage" gate — i.e., it has 3 gated levels, not 4.
- Could not confirm any real project that distinguishes "covered by unit/contract tests" from "validated end-to-end" as two *separate, named* manifest-level statuses; every precedent found either merges them (Kubernetes beta/GA) or leaves the distinction to informal org convention (Backstage `lifecycle`).
- WebFetch/WebSearch results above are AI-generated readbacks of primary-source pages, not verbatim primary text; if any single wording (e.g., exact OTEP 0232 phrasing) becomes contractually load-bearing in the design doc, re-fetch and quote the primary source directly at design time.

## Risks

- Design-phase risk: naming the new field `verificationLevel` with four levels has no single external precedent to point to as "this is how X does it" — the design doc should present it as a deliberate synthesis (K8s-style gated levels + Backstage-style manifest embedding) rather than imply it mirrors one canonical external standard.
- Low risk of source drift: HashiCorp/Kubernetes/OpenTelemetry docs are actively maintained and could restate criteria differently by the time `sdd-design` runs; treat the exact wording above as time-stamped (2026-09-08).

## Recommendation for sdd-design

Ground the `verificationLevel` field design explicitly in: (1) Kubernetes' evidence-gated alpha/beta/stable model as the structural precedent for "each level requires artifact proof, not self-report," and (2) Backstage's `catalog-info.yaml` `lifecycle` field as precedent for embedding the value directly in a machine-readable manifest. Explicitly document in the design that the fourth, finer-grained "unit/contract-tested" level is an original refinement with no single external 1:1 precedent (per Gaps above), and that no upstream OpenSpec convention exists to align with or diverge from.
