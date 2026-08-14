# Drenyra Pi — Architecture

> **Last updated:** 2026-08-14.

## Position in the ecosystem

```text
                    ┌───────────────────┐
                    │ Drenyra-Engram    │
                    │ Accounting Memory │
                    └─────────▲─────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
       ┌────────┴────────┐        ┌─────────┴─────────┐
       │ Drenyra-AI      │        │ Drenyra-Pi       │
       │ Agent Ecosystem │◄───────│ Pi-native Harness│
       └────────▲────────┘        └───────────────────┘
                │
       ┌────────┴────────┐
       │ Drenyra         │
       │ Command Center  │
       └─────────────────┘
```

Drenyra Pi depends on Drenyra AI (pinned, package-local) and Drenyra Engram (memory access). It is a consumer — it never defines the agent ecosystem or the memory engine.

## Core principle: package-local pinned runtime

Drenyra Pi installs an **exact, verified version of Drenyra AI** inside its own package tree:

```text
drenyra-pi/
└── runtime/
    └── drenyra-ai@<exact.version>   # pinned + checksum-verified
```

- **Never `PATH`.** Ambient binaries are not trusted for fiscal operations.
- **Verification on install.** Checksum + version check before the runtime is usable.
- **Upgrade is explicit.** A new pin is a release of this package, with a migration note.

## Component model

```text
Pi host
  │
  ├── extensions/          flat extension entrypoints (thin handlers only)
  │     ├── register.ts           registration + /drenyra:* dispatch
  │     ├── scope-guard.ts        per-command scope policy (pre-scope / requires-scope)
  │     ├── mission-status.ts     status + capabilities rendering
  │     ├── mission-commands.ts   mission/receipt command rendering
  │     └── startup-panel.ts      activation banner (doctor + scope completeness)
  │
  ├── lib/                 top-level domain logic (delegated to by handlers)
  │     ├── canonicalization.ts   canonical scope binding + hashing
  │     ├── mission-commands.ts   EDA mission lifecycle coordinator
  │     ├── mission-store.ts      durable mission store
  │     ├── receipt-store.ts      durable receipt store
  │     ├── receipt-verification.ts  receipt verification
  │     ├── trusted-key-registry.ts  trusted key registry
  │     ├── authority-gates.ts / authority-store.ts   authority modes
  │     ├── chain-pipeline.ts / evidence-graph.ts     chain + evidence plumbing
  │     ├── accounting-status.ts  read-only status projection
  │     └── parse.ts              shared parse helpers
  │
  ├── runtime/             pinned drenyra-ai bootstrap + verification
  ├── chains/              RDA command chains (close, reconcile, verify, evidence)
  ├── agents/              Pi-native accounting subagents
  ├── skills/              packaged Drenyra skills
  ├── prompts/             persona + command prompts
  └── contracts/           package + runtime contracts
```

- **Extensions are a flat, thin layer.** Each file under `extensions/` registers commands, enforces the scope guard, and renders structured results; no fiscal logic lives there.
- **Domain logic lives in top-level `lib/`.** Handlers validate scope, delegate to `lib/` modules and Drenyra AI domain ops, and render results. No fiscal logic lives in command handlers.
- **Context threads everywhere.** Company (RUC) and fiscal period are loaded at startup and threaded through every tool, command, and subagent prompt.
- **Tool safety is default-deny.** Fiscal tools follow broad-deny, narrow-allow; permissions are part of the contract and reviewed like code.

## Direction rules

1. Drenyra Pi → Drenyra AI: consumed (pinned). One-way.
2. Drenyra Pi → Drenyra Engram: memory reads/context. Memory **never authorizes**.
3. Drenyra AI → Drenyra Pi: **never**. Drenyra AI must not know this harness exists.

## Repository scope

This repo is the Pi harness only. The accounting engine, UI, and product surfaces live in `arkelythex/drenyra-command-center`; the agent runtime in `arkelythex/drenyra-ai`; the memory engine in `arkelythex/drenyra-engram`.
