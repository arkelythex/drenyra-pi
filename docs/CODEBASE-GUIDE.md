# Drenyra Pi — Codebase Guide

Maintainer-oriented map of this repository: where things live, how the layers relate, what is frozen, and how to verify a change. For the conceptual architecture, read [Architecture](architecture.md) and the [Trust Model](architecture/trust-model.md) first.

> [!IMPORTANT]
> **Fiscal convention:** monetary values in the Drenyra ecosystem are BigInt cents (never floats); sequence/index/version fields and exit/status codes are JSON integers, never floats. Violations are product defects, not style choices.

---

## Repository map

```text
extensions/         Flat Pi extension entrypoints — thin handlers + guards only
  ├─ register.ts            registration + /drenyra:* dispatch (single entrypoint)
  ├─ fiscal-guard.ts        the five fiscal tools + /drenyra:persona + money/SQL/RUC write guards
  ├─ scope-guard.ts         per-command scope policy (pre-scope / requires-scope, fail closed)
  ├─ mission-commands.ts    mission/receipt command rendering
  ├─ mission-status.ts      status + capabilities + models registry rendering
  └─ startup-panel.ts       activation banner (doctor + scope completeness)

lib/                Top-level domain logic (delegated to by handlers)
  ├─ canonicalization.ts        canonical scope binding + hashing
  ├─ mission-commands.ts        EDA mission lifecycle coordinator
  ├─ mission-store.ts           durable mission store
  ├─ receipt-store.ts           durable receipt store
  ├─ receipt-verification.ts    receipt verification
  ├─ trusted-key-registry.ts    trusted key registry
  ├─ authority-gates.ts / authority-store.ts   authority modes (never Pi-authorized)
  ├─ chain-pipeline.ts / evidence-graph.ts     chain + evidence plumbing
  ├─ accounting-status.ts       read-only status projection
  ├─ configurator.ts            SDD-020 composition helpers (pin-aware, deterministic only)
  └─ parse.ts                   shared parse helpers

runtime/            Pinned drenyra-ai bootstrap + verification
  ├─ pin.ts               DEFAULT_PIN — drenyra-ai@0.4.1, state released, checksum-verified
  ├─ doctor.ts            checksum + version verification, fails closed
  ├─ installer.ts         package-local install (vendored tarball first, URL fallback)
  ├─ status.ts / context.ts   status projection + company/period context store

chains/             RDA command chains (close, reconcile, verify, evidence)
agents/             Pi-native accounting subagents
skills/             Packaged Drenyra skills (fiscal compliance, review lenses, RUC scope, …)
prompts/            Persona + command prompts
contracts/          Package + runtime contracts — versioned; two frozen at v0.1
  ├─ package-contract.md        install surface and provided capabilities (frozen v0.1)
  ├─ runtime-dependency.md      pinned runtime rules (frozen v0.1)
  ├─ authority/ evidence/ mission/ receipts/   JSON schemas (RED contract surface)
  └─ SHA256SUMS.json            checksums of packaged contract/schema artifacts

docs/               Architecture series, boundary docs, style
assets/             Static assets (branding, chain maps, policies, schemas)
vendored/           Pinned drenyra-ai release tarball (never PATH)
scripts/            Build, package-verification, and capability-verification tooling
openspec/           SDD artifacts (changes/, specs/)
__tests__/          Test suites for commands, chains, and permissions
```

## Layering (who may import whom)

```text
extensions/  ──►  lib/  ──►  pinned drenyra-ai public kernel (drenyra-ai/missions,
                            candidates, gates, receipts)  +  runtime/ (pin/doctor)
runtime/  ──►  vendored/drenyra-ai-0.4.1.tgz (package-local, checksum-verified)
```

- **Extensions are a flat, thin layer.** Each file registers commands, enforces the scope guard, and renders structured results; **no fiscal logic lives there**.
- **Domain logic lives in top-level `lib/`.** Handlers validate scope, delegate to `lib/` modules and Drenyra AI domain ops, and render results.
- **Pi-local code holds no authority.** Authoritative operations (missions, candidates, gates, receipts) import **only** the pinned kernel's public entry points; the anti-circularity boundary is enforced by audit (see `docs/architecture/rda-adapter-boundary-audit.md`).
- **Never the reverse.** Drenyra AI never depends on Drenyra Pi, and Pi never leaks into AI's contracts.

## Where a change goes

- A **new command or handler** — `extensions/` (thin) + `lib/` (logic) + `__tests__/`, same change.
- A **fiscal tool, persona, or write guard** — `extensions/fiscal-guard.ts` (registers tools/guards) with tests; the money guard evaluates **only introduced text (`newText`)**, never replaced text.
- A **scope policy change** — `extensions/scope-guard.ts`; mission/chain/approval/receipt commands require a complete 10-element canonical scope and fail closed.
- A **pin upgrade** — `runtime/pin.ts` + `vendored/` + `contracts/runtime-dependency.md` + `contracts/package-contract.md` + changelog + migration note + `doctor`/conformance re-run (upgrade is itself a release).
- A **contract change** — the [contract regime](contracts/README.md) first: version bump, migration path, explicit approval.
- A **chain** — `chains/`; a **skill** — `skills/`; a **prompt** — `prompts/`; a **subagent** — `agents/`.
- **Docs-as-code:** behavioral changes carry their docs in the same change.

## Invariants

1. **Money is BigInt cents, never floats.** No monetary amount is a JavaScript `Number`; version/sequence/exit codes are JSON integers. Enforced by the money guard in `extensions/fiscal-guard.ts` (introduced text only) and by `scripts/verify-style.mjs`.
2. **SQL writes are guarded.** `extensions/fiscal-guard.ts` blocks SQL write patterns — no mutation path may be introduced through unguarded text.
3. **RUC/period scope is mandatory.** `extensions/scope-guard.ts` precedes every `/drenyra:*` command: pre-scope commands run read-only diagnostics; mission, chain, evidence-mutation, approval, and receipt-target commands **fail closed, mutating nothing** without a complete canonical scope (a stale scope hash invalidates before any mutation).
4. **The runtime is pinned and sealed.** `runtime/pin.ts` `DEFAULT_PIN` = `drenyra-ai@0.4.1` (state `released`, entry-artifact checksum `09df8d69…5b7600`), installed package-local from `vendored/`, verified by `doctor` — **never `PATH`**.
5. **Pi never authorizes.** No Pi-local code implements materiality, gates, approvals, or receipt authority; those come from the pinned kernel.
6. **Contracts are frozen public surface.** `contracts/` is versioned; frozen contracts change only via the contract regime.

## Testing and verification

- `bun run test` — Vitest suite (commands, chains, permissions, fail-closed matrix).
- `bun run typecheck` — `tsc --noEmit`.
- `bun run verify:package` — build + tests + package-file verification (vendored pin reconciled).
- `bun run verify:capability` — capability-manifest consistency.
- `bun run verify:style` — style/fiscal-convention gate (no float money, no AI attribution).

## Conventions

- ESM, Node >= 22, TypeScript strict; `node:crypto` only in library modules.
- Conventional Commits, **no AI attribution** markers.
- Command outputs always carry RUC/company/period context (contract requirement).

## Read next

- [Architecture](architecture.md) — ecosystem position, component model, designs 03/04.
- [Intended Usage](intended-usage.md) — what the harness is and is not.
- [Trust Model](architecture/trust-model.md) — authority boundaries.
- [Contracts](../contracts/README.md) — the frozen package and runtime contracts.
- [AGENTS](../AGENTS.md) — non-negotiable rules for contributors.
