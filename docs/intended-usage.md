# Intended Usage — Drenyra Pi

> [!IMPORTANT]
> **The frontier:** Drenyra Pi is not an accounting engine and never the fiscal authority. It is the operator-experience layer that lets a professional run Drenyra AI from Pi — with a pinned, verified runtime underneath.

<!-- -->

> **The institutional thesis (shared with Drenyra AI):** The AI proposes. The system validates. The professional decides. The evidence remains. Pi makes that thesis operable from the Pi host.

## Definition

**Drenyra Pi is the Pi-native Accounting Operations Harness: the best way to operate Drenyra AI from Pi.**

It is a **Pi extension** — a thin operator layer, the accounting-domain counterpart of `gentle-pi`:

- **Operator experience** — an accounting-operator persona, a startup panel that surfaces company and fiscal-period context, `/drenyra:*` commands (doctor, scope, status, capabilities, missions, receipts, evidence, verify, close), Pi-native subagents, model routing, and Receipt-Driven Accounting (RDA) command chains.
- **Pinned, sealed runtime** — it installs and consumes an **exact, verified, package-local version of Drenyra AI** (`drenyra-ai@0.4.1`, checksum-verified, never `PATH`). Everything the harness runs is backed by that pinned kernel.
- **Fiscal tooling with guards** — fiscal tools and write guards (money / SQL / RUC) registered through `extensions/fiscal-guard.ts`, with broad-deny, narrow-allow tool permissions.

## What it is NOT

| Drenyra Pi is NOT | Because |
| --- | --- |
| The accounting engine | The engine, materiality policy, gates, and approvals live in `drenyra-ai`. Pi holds **no money logic, no gate logic, no receipt authority** — it registers guards and renders results. |
| The fiscal authority | Pi executes agents and tools with pinned versions and **never authorizes fiscal operations**. Fiscal authority remains in `drenyra-ai`; the human accountant is the final authority. |
| A reimplementation of the ecosystem | Pi is a **consumer**. It depends on Drenyra AI and Drenyra Engram; it never defines how they work, and they never know Pi exists. |
| Production accounting software (yet) | Status is **pre-alpha** (`0.0.1-prealpha.1`). The harness extraction is complete, but nothing here is production-ready. |
| A source of truth | Memory (Engram) informs, never authorizes; authoritative state lives in the pinned kernel's evidence, receipts, and ledger — never in the conversation or model memory. |

## The responsibility split

```text
Drenyra AI      defines the fiscal kernel: missions, candidates, materiality,
                gates, approvals, receipts, ledger (authoritative)
Drenyra Engram  holds institutional memory — informs, never authorizes
Drenyra Pi      packages the operator experience: persona, commands, chains,
                skills, model routing, scope context (never authorizes)
Human           decides, approves, and owns the outcome (final authority)
```

## Target experience

The professional should never have to learn to operate an agent orchestration. With Drenyra Pi they:

1. Run `/drenyra:doctor` — the startup panel does the same — to confirm the pinned runtime is intact (checksum + version, fails closed on mismatch).
2. Bind the fiscal scope with `/drenyra:scope` (RUC + period among the 10 canonical elements) — missions, chains, approvals, and receipt targets fail closed until the scope is complete.
3. Start a mission (`/drenyra:mission <intent>`), follow the RDA chains, review evidence, and receive a signed, verifiable receipt for every material action.
4. Approve or reject — the human decision, never the harness.

Everything runs on the pinned `drenyra-ai@0.4.1` artifact; a missing or mismatched runtime stops mission work immediately (fail closed).

## Next steps

- [Architecture](architecture.md) — the harness's position in the ecosystem and its component model.
- [Codebase Guide](CODEBASE-GUIDE.md) — repository map, layering, and where a change goes.
- [Contracts](../contracts/README.md) — the frozen package and runtime contracts.
- [README](../README.md) — install, first run, and the command reference.
