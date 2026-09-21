# Dependency Direction — Drenyra Shell (Shell-native Accounting Operations Harness)

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Ecosystem dependency graph

```text
                        ┌───────────────────┐
                        │ Drenyra-Engram    │
                        │ Accounting Memory │
                        └─────────▲─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
           ┌────────┴────────┐        ┌──────────────────────┐
           │ Drenyra-AI      │        │ Drenyra-Shell        │
           │ Agent Ecosystem │◄───────│ Shell-native Harness │
           └────────▲────────┘        └──────────────────────┘
                    │
           ┌────────┴────────┐
           │ Drenyra         │
           │ Command Center  │
           └─────────────────┘
```

Arrows point toward the dependency. Drenyra Shell is a **pure consumer**: it depends on Drenyra AI (pinned) and Drenyra Engram (memory reads), and nothing depends on it.

## Direction rules applied to Drenyra Shell

### Drenyra Shell MAY depend on

| Repo             | How                                                        | Constraint |
| ---------------- | ---------------------------------------------------------- | ---------- |
| `drenyra-ai`     | pinned, checksum-verified, package-local runtime           | never `PATH`; upgrade = release with migration note |
| `drenyra-engram` | memory reads/context through its surfaces                  | memory never authorizes |

### Drenyra Shell must NEVER be depended on

- **`drenyra-ai` must never depend on Drenyra Shell.** Drenyra AI must not even know this harness exists.
- **`drenyra-engram` must never depend on Drenyra Shell.**
- **Drenyra must never depend on Drenyra Shell.** The product and the harness are separate surfaces.

### Who must never depend on Drenyra Shell

Drenyra Shell's contracts are **consumer-only**: they define how the harness uses the ecosystem, never how the ecosystem works.

## Rules in practice

1. Drenyra Shell installs an exact, verified version of Drenyra AI inside its own package tree; verification (checksum + version) runs on install.
2. Commands are thin — they delegate to Drenyra AI domain operations and render results.
3. Shell specifics never leak into Drenyra AI's contracts.
4. Drenyra Shell never defines canonical fiscal contracts; it documents how it consumes them.

## Why this matters

The harness earns trust through **pinning and fail-closed tooling**, not through owning the engine. If Drenyra Shell started defining the ecosystem, consumers would lose a single source of truth for the runtime.
