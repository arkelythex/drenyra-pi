# Drenyra Pi — Roadmap

> **Last updated:** 2026-08-01. Status: pre-alpha.

## Program alignment

Drenyra Pi participates in the [Drenyra Dominion Program](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion), the federated program master in `drenyra-ai` that fixes vision, authority, contracts, dependencies, gates, and sequencing across every Drenyra repository. The roadmap phases below align to the program waves:

| Roadmap phase | Drenyra Dominion wave |
| --- | --- |
| Phase 1 — Contracts | Wave 0 (Constitution: authority, contracts, multi-repo compatibility) |
| Phase 2 — Vertical slices | Wave 1 (Universal runtime: SDD-020 configurator, SDD-030 routing, SDD-040 RDA) |
| Phase 3 — Ecosystem maturity | Waves 2–3 (Fiscal intelligence and flagship product) |

## Phase 0 — Identity (current)

- [x] Repository created with identity scaffolding (README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS)
- [x] Contract index drafted (`contracts/`)
- [ ] Contract review and freeze: package-contract, runtime-dependency
- [ ] Public roadmap and architecture published

## Phase 1 — Contracts (v0.1)

- [ ] Freeze `package-contract` v0.1 (install surface, provided capabilities, versioning)
- [ ] Freeze `runtime-dependency` v0.1 (pin strategy, verification, package-locality)
- [ ] Command contract: `/drenyra:*` surface and expected outputs
- [ ] Conformance tests for install/doctor/pin verification

## Phase 2 — Vertical slices from Drenyra

Extracted via vertical PRs and versioned releases, **not** a bulk move:

- [ ] Slice 1: persona + startup panel
- [ ] Slice 2: `/drenyra:status` + `/drenyra:company` + `/drenyra:period` context threading
- [ ] Slice 3: `/drenyra:mission` + `/drenyra:receipt` + `/drenyra:ledger`
- [ ] Slice 4: monthly-close chain (R2 gate, explicit approval)
- [ ] Slice 5: Drenyra Engram integration (context, memory reads)
- [ ] Package released as `drenyra-pi` on npm with pinned `drenyra-ai`

## Phase 3 — Ecosystem maturity (alpha → beta)

- [ ] Model routing profiles for fiscal phases
- [ ] Skills registry integration (when `arkelythex/drenyra-skills` exists)
- [ ] Multi-jurisdiction operator personas (Perú → LATAM)
- [ ] v1.0 candidate when the harness runs a full monthly close end-to-end

## National alignment direction

Positioning for the Peruvian digital-government and data-protection context — roadmap direction, not implemented compliance:

- [ ] Map the evidence/provenance design to the data quality, management and privacy action line of the [ENGD 2026–2030](https://www.gob.pe/99097-estrategia-nacional-de-gobierno-de-datos-2026-2030), approved by [RM N.° 049-2026-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7739698-049-2026-pcm) and derived from the Política Nacional de Transformación Digital 2030
- [ ] Track the [Reglamento de la Ley N.º 29733](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus) (DS N.º 016-2024-JUS) as privacy-by-design input
- [ ] Evaluate interoperable evidence adapters against the PIDE exchange model used by 450+ public entities — only with applicable authorization, purpose, and agreements ([PIDE guide](https://guias.servicios.gob.pe/creacion-servicios-digitales/reutilizables/interoperabilidad))
- [ ] Track [ENIA 2026–2030](https://busquedas.elperuano.pe/dispositivo/NL/2511535-1) (RM N.° 152-2026-PCM) public-sector AI governance (OIA, Catálogo IA Perú) as context for supervised-AI positioning

National alignment never weakens the fail-closed and no-autonomous-filing stance: integrity receipts remain internal (not legally-valid digital signatures), and State-entity exchange is never assumed.

## Non-goals (for now)

- Full accounting engine (that is `arkelythex/drenyra-command-center`)
- Agent runtime (that is `arkelythex/drenyra-ai`)
- Memory engine (that is `arkelythex/drenyra-engram`)
