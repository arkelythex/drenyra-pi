# Ecosystem Boundaries — Drenyra Pi (Pi-native Accounting Operations Harness)

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Role in the ecosystem

Drenyra Pi is the **Pi-native Accounting Operations Harness**: a Pi extension that packages the operator experience for Drenyra AI. It is the direct accounting-domain counterpart of `gentle-pi`.

Drenyra Pi does **not** contain the accounting engine. It **installs and consumes a pinned, verified, package-local version of Drenyra AI** — never whatever binary happens to be on `PATH`.

## What Drenyra Pi is (in scope)

- Accounting operator persona: warm, direct, fiscal-first behavior.
- Startup panel: company and fiscal period context on session start.
- `/drenyra:*` commands: status, company, period, mission, receipt, ledger.
- Pi-native subagents: exploration, apply, verify, review.
- Model routing: per-phase model selection for fiscal work.
- Packaged skills and RDA (Receipt-Driven Accounting) command chains.
- Tool safety: broad-deny, narrow-allow permissions for fiscal actions.
- Company & period context: RUC-scoped context threaded across tools and agents.
- Drenyra Engram integration: institutional memory access (memory never authorizes).

## Explicit non-goals

Drenyra Pi is **not**:

- The accounting engine — that is `arkelythex/Drenyra` (product) and `arkelythex/drenyra-ai` (runtime).
- An agent runtime — missions, candidates, receipts, gates, and ledger belong to `drenyra-ai`.
- A memory engine — observations and scope-first search belong to `drenyra-engram`.

## What Drenyra Pi must NOT contain long-term

- **Fiscal logic in command handlers.** Commands are thin: validate scope, delegate to Drenyra AI domain operations, render results.
- **A second copy of the runtime.** The engine is installed and pinned, never vendored or re-implemented.
- **Product surfaces** (UI, tenants, documents, SUNAT flows) — those live in Drenyra.

## Consumers and producers

| Direction | Party | Relation |
| --------- | ----- | -------- |
| Consumes | `drenyra-ai` | pinned, verified, package-local runtime (never `PATH`) |
| Consumes | `drenyra-engram` | memory reads/context (memory never authorizes) |
| Produces for | Pi users | the disciplined accounting operator experience |
| Provides | `drenyra-pi` package | installable via `pi install npm:drenyra-pi` |

## Current state and maturity

- Pre-alpha: contracts only (`package-contract`, `runtime-dependency`); no implementation yet.
- Slices will land as vertical PRs on released, pinned versions of `drenyra-ai` — never a checkout.

## Ownership and accountability

- Harness behavior, tool permissions, and pinning strategy: this repo.
- Runtime contracts and gates: `drenyra-ai`. Memory: `drenyra-engram`. Product: Drenyra.
- A pin verification failure is filed here with the full `doctor` output attached.

## Boundary enforcement

- Direction violations are caught in review: a PR that defines fiscal logic or duplicates runtime contracts in Drenyra Pi is rejected and redirected.
- Runtime pinning is part of the package contract (`contracts/runtime-dependency.md`); changing a pin is a release with a migration note.
