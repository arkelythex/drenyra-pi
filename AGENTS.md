# Drenyra Pi — Agent Guide

This file is for AI agents and their humans working in this repository. It answers: *what are the non-negotiable rules, what should I read first, and where do changes belong?*

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); sequence/index/version fields and exit/status codes are JSON integers, never floats. Violations are product defects, not style choices.

## Non-Negotiable Rules

Every change — code, docs, tests, or CI — must respect these. They are also enforced by the review gate.

1. **Pi operates; it never authorizes.** Drenyra Pi executes agents, chains, and tools with pinned versions but **never authorizes fiscal operations** — fiscal authority lives in `drenyra-ai`. No Pi-local code may reimplement materiality, gates, receipts, or approval logic; those are consumed from the pinned runtime's public kernel entry points (`drenyra-ai/missions`, `candidates`, `gates`, `receipts`).
2. **Checksum-verified pinned runtime.** The harness runs an **exact, verified, package-local** Drenyra AI (`DEFAULT_PIN` = `drenyra-ai@0.4.1`, entry-artifact checksum `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600`). Never `PATH`. `doctor` fails closed on any mismatch, and upgrading the pin is itself a release of this package.
3. **RUC and period scope is mandatory.** Company (RUC, check-digit-validated) and fiscal period (`YYYYMM`) context is loaded at startup and threaded through every tool, command, and subagent prompt. Mission, chain, evidence-mutation, approval, and receipt-target commands require a **complete 10-element canonical scope** and fail closed — mutating nothing — when it is missing or stale.
4. **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model. No monetary amount is ever a JavaScript `Number`, and no version/sequence/exit code is ever a float.
5. **Nothing material happens without a receipt.** Every material action produces an immutable, signed receipt. No receipt, no mutation.
6. **Contracts are frozen public surface.** `contracts/` is versioned and consumed by external systems; `package-contract` and `runtime-dependency` are frozen at v0.1. Changing one requires a version bump, migration path, and explicit approval.
7. **No `any`, no secrets.** Use precise types; never commit credentials, tokens, or customer data.
8. **No AI attribution.** Conventional Commits only. No `Co-Authored-By`, "Generated with", or similar markers.

## Read Before Working

| Goal | Start here |
| --- | --- |
| Understand what the project is and is not | [Intended Usage](docs/intended-usage.md) |
| Conceptual architecture and boundaries | [Architecture](docs/architecture.md) |
| Codebase layout and conventions | [Codebase Guide](docs/CODEBASE-GUIDE.md) |
| The frozen public surface | [Contracts](contracts/README.md) |
| The runtime pin contract (upgrades are releases) | [runtime-dependency](contracts/runtime-dependency.md) |
| Trust model and authority boundaries | [Trust Model](docs/architecture/trust-model.md) |

## Where Changes Belong

```text
extensions/         Flat Pi extension entrypoints (thin handlers + guards only)
lib/                Top-level domain logic (delegated to by handlers)
runtime/            Pinned drenyra-ai bootstrap, pin, doctor, installer, context
chains/             RDA command chains (close, reconcile, verify, evidence)
agents/             Pi-native accounting subagents
skills/             Packaged Drenyra skills (versioned knowledge, shipped here)
prompts/            Persona + command prompts
contracts/          Package and runtime contracts — FROZEN, versioned
docs/               Architecture, boundary, and style documentation
__tests__/          Test suites for commands, chains, and permissions
```

- **Extensions are a flat, thin layer.** Each file under `extensions/` registers commands, enforces the scope guard, and renders structured results; **no fiscal logic lives there**. Extensions delegate to `lib/` and the pinned Drenyra AI domain ops.
- A **behavioral** change goes with its subsystem module, its tests, and its docs — in the same change (docs-as-code).
- A **pin** change goes through [runtime-dependency](contracts/runtime-dependency.md) first: changelog entry, migration note, re-run of `doctor` and the conformance suite.
- A **contract** change goes through the [contract regime](contracts/README.md) first.
- A **fiscal or mission** change follows the authority boundaries in [trust-model](docs/architecture/trust-model.md); authority-critical behavior stays in the pinned kernel, never in Pi-local code.

## Skills

Drenyra Pi ships packaged Drenyra skills in `skills/` (fiscal compliance, fiscal review lenses, RUC scope, evidence citation, chain operation, SDD, chained PR). They are part of the Drenyra Skills ecosystem: versioned, jurisdiction-scoped accounting and tax knowledge (PE). When working in this repository, resolve the matching `SKILL.md` by task context and read it **before** writing code or docs that touch its domain.
