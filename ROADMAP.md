# Drenyra Pi — Roadmap

> **Last updated:** 2026-08-01. Status: pre-alpha.

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

## Non-goals (for now)

- Full accounting engine (that is `arkelythex/drenyra-app-web`)
- Agent runtime (that is `arkelythex/drenyra-ai`)
- Memory engine (that is `arkelythex/drenyra-engram`)
