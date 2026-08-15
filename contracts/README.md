# Drenyra Pi — Contracts

> **Status: two local contracts frozen at v0.1 (2026-08-14).** `package-contract` and `runtime-dependency` are frozen v0.1 contracts; every frozen claim was checked against source and the existing conformance suite (claim matrix in `openspec/changes/pi-sdd-010-participation/apply-progress.md`). Other contract families remain draft until Phase 1 of the [ROADMAP](../ROADMAP.md) completes.

## Index

| Contract                              | Version | Status | Governs                          |
| ------------------------------------- | ------- | ------ | -------------------------------- |
| [package-contract](package-contract.md) | 0.1 | Frozen | Install surface and provided capabilities |
| [runtime-dependency](runtime-dependency.md) | 0.1 | Frozen | Pinned, verified Drenyra AI runtime |

## Contract requirements

1. **Versioned.** Every contract declares `version` and a compatibility policy.
2. **Verifiable.** Install and pin verification ship with conformance tests.
3. **Scope-safe.** Command outputs always carry RUC/company/period context.
4. **Consumer-only.** Drenyra Pi defines how it *uses* the ecosystem, never how the ecosystem works.
