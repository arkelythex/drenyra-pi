# Harness Draft Conformance — "SDD-050 — Drenyra Pi" (historical draft)

> **Last updated:** 2026-08-18 (reconciliation + fresh verification evidence).
> **Status:** delivered — the historical Drenyra Pi harness draft maps to the
> implemented harness in this repository. This record is the requirement →
> evidence conformance mapping, the SDD-050 numbering reconciliation, and the
> fresh verification snapshot. Documentation-only change; no source code was
> modified.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
> no float is ever used for money; version/sequence numbers are JSON integers,
> never floats.

## 1. What this record is — and the numbering note

The historical draft titled **"SDD-050 — Drenyra Pi"** (marked `DRAFT`, Fase 0)
described the Pi-native accounting harness: a pinned consumer of `drenyra-ai`,
a conversational persona for the Peruvian accounting domain, per-intent
subagents, per-phase model routing, and a strict no-execution boundary.

**Numbering reconciliation.** That draft reused the `SDD-050` number. In the
Drenyra Dominion program master
(`drenyra-ai/openspec/programs/drenyra-dominion/sdds/`) the `SDD-050` number
belongs to **`sdd-050-monthly-close`** (monthly close), not to the harness. The
harness described by the draft was actually delivered through:

- `pi-sdd-010-participation` (archived 2026-08-15) — contracts, capability
  manifest, participation slice;
- `pi-sdd-030-routing-adapter` (archived) — work routing adapter;
- `pi-sdd-040-adapter-boundary` (archived) — public-surface boundary proof;
- the harness extraction commits `41938a0`, `8b214e5`, `1eec8e9`.

The master catalog remains authoritative. This repository never re-numbers or
re-defines a master SDD; the draft is treated here as the historical
requirement set, and this record maps each requirement to delivered evidence.

## 2. Verification evidence (fresh, 2026-08-18)

| Check | Command | Result |
| --- | --- | --- |
| Tests | `bun test` | 44 files / 703 passed / 0 failed |
| Typecheck | `bun run typecheck` | clean (`tsc --noEmit`) |
| Package verify | `bun run verify:package` | OK — build + tests + vendored pin reconciled (`drenyra-ai@0.4.1`, entry artifact sha256 `09df8d69…5b7600`) |
| Capability manifest | `bun run verify:capability` | OK |
| Style | `bun run verify:style` | OK (diff-scoped, 97 owned files, 4 rules) |

Baseline: `HEAD` = `1eec8e9` (docs: model routing, Engram boundary, host
strategy).

## 3. Requirement → evidence matrix

### Draft §2 — Frontera y autoridad

| Draft requirement | Delivered evidence | Verdict |
| --- | --- | --- |
| Pi is a pinned consumer of `drenyra-ai` — never reimplements materiality, gates, or receipts | `runtime/pin.ts` (`DEFAULT_PIN`, released pin), `runtime/doctor.ts` (checksum verify, fails closed), `vendored/drenyra-ai-0.4.1.tgz`; `__tests__/pin.test.ts`, `__tests__/doctor.test.ts` | DELIVERED |
| Pi is not the engine, not the UI, not the fiscal authority | `docs/architecture/ecosystem-boundaries.md` (explicit non-goals); `extensions/register.ts` (handlers are thin: parse → scope policy → delegation → render) | DELIVERED |
| Dependency rule: `drenyra-pi → drenyra-ai`, never reverse; Engram never input to gates | `docs/architecture/dependency-direction.md`; `docs/architecture/trust-model.md` ("Memory informs; it never authorizes", sharpened in `1eec8e9`); `README.md` ("Drenyra Pi executes agents and tools with pinned versions and never authorizes fiscal operations") | DELIVERED |

### Draft §4 — Commands

| Draft command | Delivered form | Verdict |
| --- | --- | --- |
| `/drenyra:status` | `extensions/register.ts` `statusHandler` — company, period, mission state, next authorized action | DELIVERED |
| `/contador:persona` / `/drenyra:persona` | `extensions/fiscal-guard.ts` — persona toggle `on\|off` (session-scoped system-prompt injection) | DELIVERED (deviation: toggle, not two modes — see §4) |
| `/drenyra:models` | `modelsHandler` — advisory `drenyra.model-routing.v1` registry | DELIVERED (advisory per G30) |
| `/drenyra:mission start` / `status` | `/drenyra:mission <intent>`, `/drenyra:continue`, `/drenyra:resume` (`extensions/mission-commands.ts`, `lib/mission-commands.ts`) | DELIVERED |
| `/drenyra:tenant switch <ruc>` | Delivered as `/drenyra:company <ruc>` (11 digits, check-digit-validated) + tenant as element 1 of the 10-element canonical scope; fail-closed pre-scope | DELIVERED (evolved naming) |
| Config `.pi/drenyra/{persona,models,tenant}.json` | Delivered as `~/.drenyra/context.json` (`runtime/context.ts` `ScopeContextStore`) + configurator-managed composition (`lib/configurator.ts`) | DELIVERED (evolved location) |

Full command surface: **20 registered commands** — `status`, `doctor`,
`preflight`, `company`, `period`, `context`, `capabilities`, `scope`, `models`,
`close`, `mission`, `continue`, `resume`, `receipt`, `evidence`, `verify`,
`reconcile`, `install`, `sync` (in `extensions/register.ts`) plus `persona` (in
`extensions/fiscal-guard.ts`).

### Draft §5 — Model assignment per mission phase

Delivered: `README.md` "Model routing" section (`1eec8e9`) documents the
advisory tiers by mission state — cheap/flash for `WAITING_FOR_EVIDENCE`, no
LLM for materiality/gates (deterministic core), high reasoning for
`AWAITING_APPROVAL` summaries, independent provider for Guardian. Registry:
`/drenyra:models` + `prompts/models.md`.

**Partial:** the installed Pi host slice exposes no model-routing API (G30), so
the registry is advisory — it documents intent, never grants authority, and
model choice stays operator-owned (capability manifest `model-routing:
partial`).

### Draft §6 — Persona

Delivered: `prompts/persona.md` (operator persona: scope-first, evidence-cited,
one-step-at-a-time, no authority shortcuts, BigInt cents), injected at
activation (`extensions/startup-panel.ts`) and toggleable via
`/drenyra:persona on|off` (`extensions/fiscal-guard.ts`).

**Deviation / open item:** the draft proposed two modes (`contador-senior`
pedagogical + `neutral` formal). The shipped harness provides a single operator
persona with an on/off toggle. Two-mode persona is not shipped (see §5).

### Draft §7 — Acceptance criteria (Definition of Done)

| # | Criterion | Delivered evidence | Verdict |
| --- | --- | --- | --- |
| 1 | No `drenyra-pi` function writes directly to `ledger/`/`receipts/` or decides a gate — every mutation goes through `drenyra-ai` | Thin handlers in `extensions/register.ts`; agents never EXECUTE (`agents/README.md`, REQ-AGENT-005); `__tests__/authority-gates.test.ts`; `__tests__/adapter-boundary-replacement.test.ts` (5 negative controls prove the comparator fails when a Core decision is overridden, a bound input changes, a gate reorders, a receipt claim upgrades, or UNKNOWN is retried) | PASS |
| 2 | `drenyra-engram-pi` strictly read-mostly: session context only, never materiality/review decisions | `docs/architecture/trust-model.md` ("Memory informs; it never authorizes"); `runtime/context.ts` reads at the memory boundary; capability manifest `engram-integration: partial` with `REQ-BOUND-001` (dev-grade local store; canonical Engram integration later) | PASS (partial integration) |
| 3 | Every mission requires an explicit tenant (RUC) before `RUNNING` — fail-closed | `ScopeGuard` (`extensions/scope-guard.ts`): 10-element canonical scope with tenant as element 1, pre-scope policy; `__tests__/extension-scope-guard.test.ts`; `__tests__/extension-mission-commands.test.ts` (SC-CMD-002: mission creation requires complete scope) | PASS |
| 4 | Per-intent agents are 1:1 with the frozen `IntentHandler`s; no new intents without `mission-protocol` contract | `agents/README.md` maps roles to Design 03 ecosystem roles; `openspec/specs/mission-protocol/spec.md` REQ-MISS-005 fixes the 5 canonical intents; `__tests__/agents.test.ts` | PASS |
| 5 | Conformance test: full cycle (`mission start` → `candidate` → `gate` → `receipt`) using only the public `drenyra-ai` surface | `__tests__/adapter-boundary-replacement.test.ts` — full monthly-close fixture through public entry points (`/missions`, `/candidates`, `/gates`, `/receipts`) projected to `drenyra.authority-projection.v1` and compared for exact equivalence; `chains/__tests__/monthly-close-flow.test.ts` (T-S5B-003: bound → ingest → reconcile → evidence → proposal → human approval → signed receipt → export); `__tests__/extension-mission-commands.test.ts` imports only public `drenyra-ai` entry points | PASS |

### Draft §8 — Roadmap phases

| Phase | State | Evidence |
| --- | --- | --- |
| Fase 0–1 (design; single host Pi) | DELIVERED | Harness extraction complete; README "Host strategy" (`1eec8e9`) — Pi is the v1.0 host, Claude Code the planned second |
| Fase 2 (subagents cover the 5 frozen intents) | DELIVERED | `agents/` — `close-controller` (monthly-close), `journal-candidate-agent` (correction), `reconciliation-agent` (reconciliation), `invoice-sire-agent` (invoice-review), `tax-controller-pe` (compliance-check), plus support roles (`accounting-scout`, `evidence-builder`, `ledger-analyst`, `anomaly-refuter`, `guardian-angel`) |
| Fase 3 (Guardian Angel as independent second model at `AWAITING_APPROVAL`) | PARTIAL — gated | `agents/guardian-angel.md` role exists; wiring as independent verifier is SDD-090 (master-owned, gated); README "Model routing" documents the independent-provider tier |
| Fase 4 (LATAM jurisdiction adapters) | DEFERRED (out of Pi scope) | Jurisdiction-awareness lives in `drenyra-ai` `adapters/`; Pi only consumes it |

## 4. Delivered vs. draft letter — documented deviations

| Draft letter | Delivered | Why |
| --- | --- | --- |
| `/drenyra:tenant switch <ruc>` | `/drenyra:company <ruc>` + scope tenant element | Evolved with the 10-element canonical scope; keeps one RUC binding path |
| `.pi/drenyra/{persona,models,tenant}.json` | `~/.drenyra/context.json` + configurator composition | Consistent with the SDD-020 configurator direction |
| Two persona modes (`contador-senior`/`neutral`) | Single operator persona + `on\|off` toggle | One persona shipped in v0; two-mode remains an open item |
| "SDD-050" as the harness number | Delivered as `pi-sdd-010-participation` + extraction | Master catalog owns `SDD-050 = sdd-050-monthly-close` |

## 5. Open / partial items (honest state)

| Item | Status | Constraint |
| --- | --- | --- |
| Model routing | Advisory registry only | Host slice exposes no model-routing API (G30); model choice operator-owned |
| Engram integration | Dev-grade local JSON store | Canonical Engram MCP integration deferred (REQ-BOUND-001) |
| Two-mode persona | Not shipped | Open product decision |
| Guardian Angel wiring at `AWAITING_APPROVAL` | Role exists, integration pending | SDD-090 master-gated |
| Product contracts (`package-contract`, `runtime-dependency`) | Still `0.1-draft` | ROADMAP Phase 1 contract freeze pending |
| Additional hosts (Claude Code) | Planned | README "Host strategy" |

## 6. Result contract

- `status`: `completed` — reconciliation + verification (documentation-only;
  no source code changed; no commit created).
- `executive_summary`: mapped the historical "SDD-050 — Drenyra Pi" harness
  draft to the delivered implementation; resolved the SDD-050 numbering
  conflict (master owns `sdd-050-monthly-close`; the harness was delivered as
  `pi-sdd-010-participation` + extraction); recorded fresh verification
  evidence (703/44 tests, typecheck, package/capability/style gates green);
  corrected stale command/agent counts in `ecosystem-boundaries.md` and the
  README command reference; listed the honest open/partial items.
- `artifacts`: this record; `docs/architecture/ecosystem-boundaries.md`;
  `README.md`.
- `next_recommended`: the open items in §5 are each a separate, human-owned
  decision; none blocks the harness's delivered scope.
- `risks`: none new — documentation-only change; the stale counts corrected
  here were the only live-doc drift found.
- `skill_resolution`: `paths-injected` (scope-discipline, evidence-citation,
  cognitive-doc-design, work-unit-commits loaded before work).
