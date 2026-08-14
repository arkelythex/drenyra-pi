# Drenyra Pi — Architecture

> **Last updated:** 2026-08-14 (Design 4 — persistence, security, and recovery).

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

## Design 03 — agents, skills, and integrations

Approved in `drenyra-ai` (`docs/design/design-03-agents-skills-integrations.md`),
Design 03 fixes the whole-ecosystem flow. Pi is one of the hosts on the left:

```text
Drenyra · Pi · External hosts
  → SDK · MCP · CLI
  → Mission Orchestrator      (splits jobs, selects agents/skills, controls
  → Specialized agents         budget/attempts/concurrency — never authorizes)
  → Structured candidates
  → Deterministic Core        (only component able to accept a transition)
  → Gates · Receipts · Ledger
```

- **Agents propose, never decide.** Each returns a known schema (evidence
    manifest, exceptions and candidates, explained differences, candidate
    journal entries, compliance findings, close plan); free text never replaces
    structured values, references, hashes, or states. Pi ships the ten subagents
    in `agents/` (seven Design 03 ecosystem roles + three Pi work agents).
- **Skills are layered** (Foundation / Peru / Practice-sector) and versioned by
    validity period; Pi ships the Foundation skills in `skills/`.
- **Models are provider-agnostic** — selected by capability, cost, and risk,
    recorded as provenance, validated against schemas before entering the Core.

## Design 04 — persistence, security, and recovery

Approved in `drenyra-ai` (`docs/design/design-04-persistence-security-recovery.md`),
Design 04 fixes where authoritative state lives and how the harness stays safe:

- **Authoritative state lives in persisted events, evidence, and receipts** —
    never in the conversation or the model's memory. The harness's file-backed
    stores are dev/demo only; production state, transactions, concurrency, and
    durable persistence belong to `drenyra-ai` (PostgreSQL, object storage,
    append-only ledger, KMS, Policy Registry; Engram is non-authoritative memory).
- **Scope is part of queries, mutations, unique constraints, idempotency keys,
    and hashes** — filtering after reading is not enough.
- **Documents are untrusted input**: a PDF, XML, or description can never
    inject agent instructions, modify permissions, or request tools.
- **Approvals bind to the exact candidate hash, scope, materiality, evidence,
    approver, and policy** — a changed candidate stops being governed by the old
    approval; R3 needs two distinct approvers.
- **Idempotent, concurrent, unknown-safe**: idempotency keys derived from
    `tenant + company + fiscalPeriod + intent + candidateIdentity`, optimistic
    concurrency with fencing, inbox/outbox, retry deduplication, and external
    confirmation before repeating mutations. Interrupted external calls are
    UNKNOWN and reconciled before any retry — no blind retries, no silent
    errors, no states converted into success.
- **Security controls**: encryption in transit/at rest, secrets outside
    prompts/logs/receipts, tools by capability and mission, limited egress,
    read/propose/approve/execute separation, document sanitization, signature
    verification, evidence access audit, configurable retention, connector and
    key revocation, and Guardian Angel read-only over frozen candidates.

## Direction rules

1. Drenyra Pi → Drenyra AI: consumed (pinned). One-way.
2. Drenyra Pi → Drenyra Engram: memory reads/context. Memory **never authorizes**.
3. Drenyra AI → Drenyra Pi: **never**. Drenyra AI must not know this harness exists.

## Repository scope

This repo is the Pi harness only. The accounting engine, UI, and product surfaces live in `arkelythex/drenyra-command-center`; the agent runtime in `arkelythex/drenyra-ai`; the memory engine in `arkelythex/drenyra-engram`.

## National alignment (positioning)

National alignment is **strategy and roadmap direction**, not implemented compliance. The harness does not currently implement a full data catalog, a retention engine, an official digital signature, PIDE access, or a public-sector institutional edition.

| National reference | Relevance |
| --- | --- |
| [ENGD 2026–2030](https://www.gob.pe/99097-estrategia-nacional-de-gobierno-de-datos-2026-2030) — approved by [RM N.° 049-2026-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7739698-049-2026-pcm), derived from the Política Nacional de Transformación Digital 2030 | Vision of a trusted, innovative, secure digital ecosystem; six action lines including data regulatory framework; data quality, management and privacy; open data and interoperability; infrastructure/platforms, talent/culture, ecosystem/collaboration. Frames the governed-data direction. |
| [PIDE](https://guias.servicios.gob.pe/creacion-servicios-digitales/reutilizables/interoperabilidad) | State-entity electronic data exchange used by more than 450 public entities. No automatic access: any integration requires applicable authorization, purpose, and agreements. |
| [Reglamento de la Ley N.º 29733](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus) (DS N.º 016-2024-JUS) | Context for security/privacy-by-design work. |
| [ENIA 2026–2030](https://busquedas.elperuano.pe/dispositivo/NL/2511535-1) (RM N.° 152-2026-PCM) | Public-sector AI governance (OIA, Catálogo IA Perú) as context; not a private-sector legal classification of Drenyra's tax AI. |

**Differentiators:** governed data, explicit provenance, evidence receipts, human authorization, interoperable adapters, security/privacy by design, and supervised AI. Internal Ed25519 integrity receipts verify harness state; they are distinct from Peruvian legally-valid digital signatures.
