# Drenyra Pi

> **Private commercial product** — this repository is **private**; distribution is contractual, never public. See the Drenyra [Private Product Policy](https://github.com/arkelythex/drenyra-command-center/blob/main/docs/products/private-product-policy.md).

> **Pi-native Accounting Operations Harness** — the best way to operate Drenyra AI from Pi.

> **Status: pre-alpha.** The harness is being extracted from `arkelythex/drenyra-command-center` (`packages/pi`) through vertical slices. Nothing here is production-ready yet.

Drenyra Pi is the direct counterpart of `gentle-pi` for the accounting domain: a Pi extension that packages the operator experience for Drenyra AI. It does **not** contain the full accounting engine — it installs and consumes a pinned, verified, package-local version of Drenyra AI, exactly like Gentle Pi does with Gentle AI.

## What it provides

- **Accounting operator persona** — warm, direct, fiscal-first operator behavior.
- **Startup panel** — company and fiscal period context on session start.
- **`/drenyra:*` commands** — status, company, period, mission, receipt, ledger.
- **Pi-native subagents** — accounting agents for exploration, apply, verify, review.
- **Model routing** — per-phase model selection for fiscal work.
- **Packaged skills** — Drenyra-specific skills shipped with the extension.
- **RDA chains** — Receipt-Driven Accounting command chains.
- **Tool safety** — broad-deny, narrow-allow tool permissions for fiscal actions.
- **Company & period context** — RUC-scoped context threading across tools and agents.
- **Drenyra Engram integration** — institutional memory access (memory never authorizes).
- **Pinned Drenyra AI runtime** — exact verified version, package-local, never `PATH`.

### Drenyra Dominion Program

Drenyra Pi is a participant in the [Drenyra Dominion Program](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion), the federated program master in `drenyra-ai` that fixes vision, authority, contracts, dependencies, gates, and sequencing across every Drenyra repository. The program follows a master + vertical SDD model: one master SDD fixes the constitution, and vertical SDDs deliver complete capabilities that may traverse repositories while each repository preserves its ownership and boundaries. Drenyra Pi holds only its local change plus a reference to this master — full specs are never copied here.

| SDD | Role in Drenyra Pi |
| --- | --- |
| [SDD-020 — Universal Agent Configurator](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-020-configurator) | Served primarily by Drenyra Pi: `install`, `doctor`, `sync`, `upgrade`, `rollback` plus host integration |
| [SDD-030 — Organic Accounting Work Routing](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-030-routing) | Direct / delegated / durable-mission routing from evidence and risk |
| [SDD-040 — Receipt-Driven Accounting v2](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2) | Frozen candidate, proportional review, bounded correction, reusable receipt (RDA v2 chains) |

Drenyra Pi executes agents and tools with pinned versions and **never authorizes fiscal operations** — fiscal authority remains in `drenyra-ai`.

## Install

```bash
pi install npm:drenyra-pi
```

Then, inside Pi:

```text
/drenyra:status
/drenyra:company
/drenyra:period
/drenyra:mission
/drenyra:receipt
/drenyra:ledger
```

## Layout

```text
assets/      Static assets (persona, branding, panels)
contracts/   Package and runtime contracts (see contracts/)
extensions/  Pi extension entrypoints and registration
prompts/     Prompt templates and command chains
skills/      Packaged Drenyra skills
agents/      Pi-native accounting subagents
chains/      RDA command chains
themes/      Pi themes
runtime/     Runtime bootstrap, drenyra-ai pinning and verification
scripts/     Install, doctor, update scripts
tests/       Test suites for commands, chains, and permissions
```

## Dependency

```text
drenyra-pi
  └── installs and consumes drenyra-ai (pinned, verified, package-local)
```

Drenyra Pi uses an **exact, verified, package-local version of Drenyra AI** — never whatever binary happens to be on `PATH`. See [contracts/runtime-dependency.md](contracts/runtime-dependency.md).

## Ecosystem

| Project                                                        | Role                                    |
| -------------------------------------------------------------- | --------------------------------------- |
| [Drenyra Command Center](https://github.com/arkelythex/drenyra-command-center)               | Command Center — web application (consumes AI) |
| [Drenyra AI](https://github.com/arkelythex/drenyra-ai)         | Agent ecosystem (installed, pinned)     |
| [Drenyra Engram](https://github.com/arkelythex/drenyra-engram) | Institutional accounting memory (used)  |

**Direction rule:** Drenyra Pi depends on Drenyra AI and Drenyra Engram. It never leaks into Drenyra AI's contracts, and Drenyra AI never knows Drenyra Pi exists.

## License

Proprietary. © 2026 Arkelythex. All rights reserved. See [LICENSE](LICENSE).
