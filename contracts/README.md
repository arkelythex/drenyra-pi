# Drenyra Pi — Contracts

> **Status: draft (pre-alpha).** These contracts define what Drenyra Pi provides and how it consumes the Drenyra AI runtime. Nothing is frozen until Phase 1 of the [ROADMAP](../ROADMAP.md) completes.

## Index

| Contract                              | Version | Status | Governs                          |
| ------------------------------------- | ------- | ------ | -------------------------------- |
| [package-contract](package-contract.md) | 0.1-draft | Draft | Install surface and provided capabilities |
| [runtime-dependency](runtime-dependency.md) | 0.1-draft | Draft | Pinned, verified Drenyra AI runtime |

## Contract requirements

1. **Versioned.** Every contract declares `version` and a compatibility policy.
2. **Verifiable.** Install and pin verification ship with conformance tests.
3. **Scope-safe.** Command outputs always carry RUC/company/period context.
4. **Consumer-only.** Drenyra Pi defines how it *uses* the ecosystem, never how the ecosystem works.
