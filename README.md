# Drenyra Pi

> **Private commercial product** — this repository is **private**; distribution is contractual, never public. See the Drenyra [Private Product Policy](https://github.com/arkelythex/drenyra-app-web/blob/main/docs/products/private-product-policy.md).

> **Pi-native Accounting Operations Harness** — the best way to operate Drenyra AI from Pi.

> **Status: pre-alpha.** The harness is being extracted from `arkelythex/drenyra-app-web` (`packages/pi`) through vertical slices. Nothing here is production-ready yet.

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
| [Drenyra App Web](https://github.com/arkelythex/drenyra-app-web)               | Command Center — web application (consumes AI) |
| [Drenyra AI](https://github.com/arkelythex/drenyra-ai)         | Agent ecosystem (installed, pinned)     |
| [Drenyra Engram](https://github.com/arkelythex/drenyra-engram) | Institutional accounting memory (used)  |

**Direction rule:** Drenyra Pi depends on Drenyra AI and Drenyra Engram. It never leaks into Drenyra AI's contracts, and Drenyra AI never knows Drenyra Pi exists.

## License

Proprietary. © 2026 Arkelythex. All rights reserved. See [LICENSE](LICENSE).
