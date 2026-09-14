# Exploration — pi-engram-integration

**Change:** `pi-engram-integration` (candidate, local SDD — first change after the six-change program closed)
**Phase:** explore — read-only against the repository (and the sibling `drenyra-engram` checkout, read-only)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Sibling repository read for context (read-only, not modified):** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-engram`
**Topic:** `ROADMAP.md` Phase 2, unchecked: "Slice 5: Drenyra Engram integration (context, memory reads)"

---

## 1. Why this is genuinely unstarted work (unlike the Phase 0 contract item)

Confirmed by direct inspection, not assumption:

- `package.json#/dependencies` is `{}`; `drenyra-engram` is not a dependency of any kind (compare `drenyra-ai`, which is a real `devDependencies` entry: `"file:./vendored/drenyra-ai-0.4.1.tgz"`).
- No `.ts` source file in this repository references "engram" at all. Every reference is in docs (`README.md`, `docs/architecture/*.md`, `contracts/package-contract.md`) or in `capability-manifest.yaml`.
- `capability-manifest.yaml#/capabilities/engram-integration`: `state: partial`, `verificationLevel: unit-or-contract-tested`, with the limitation stated verbatim: *"Pi reads Drenyra Engram context at the memory boundary and never authorizes operations, but no complete executable Engram integration is evidenced; context persistence is a development-grade local JSON store and canonical memory integration is a later concern (REQ-BOUND-001)."*
- `runtime/context.ts`'s own doc comment: *"Persistence is a development-grade JSON file (`~/.drenyra/context.json`) with atomic writes... canonical storage is a later concern."* This is Pi's company/period **scope** store — it stands in for, but is not, Engram integration.
- `__tests__/capability-manifest.test.ts` has three guard assertions specifically preventing this capability from silently claiming `operational=end-to-end` or `ownership` escalation without deliberate work (lines 961–978, 1095–1118) — the test suite treats this gap as a known, fenced boundary, not an oversight.
- `docs/architecture/harness-draft-conformance.md:139`: *"Engram integration | Dev-grade local JSON store | Canonical Engram MCP integration deferred (REQ-BOUND-001)."* — explicitly names **MCP** as the deferred integration mode.

**Verdict: real, unstarted, deliberately-deferred work exists here.** REQ-BOUND-001 is a Pi-local decision to defer, not an external gate — unlike SDD-020 (configurator), this is not blocked by the `drenyra-ai` master program's Gate 0. Nothing in `ROADMAP.md`'s "Program alignment" section names Engram integration as one of the master-owned SDD numbers (SDD-000/010/050/060/070/080/090/100/110).

---

## 2. What exists to integrate with (read from the sibling repository, for context only)

`/home/dreamcoder08/Documents/PROYECTOS/drenyra-engram` is a real, local, buildable TypeScript package:

- `package.json`: `"name": "drenyra-engram"`, `"version": "0.0.1-prealpha.1"` — **pre-alpha, same maturity tier as drenyra-pi itself.** Not yet published to any registry (no evidence checked here of an npm publish; matches this repo's own "no publication" posture).
- README states explicitly: *"Drenyra Engram is the open component of the Drenyra ecosystem... mirroring `Gentleman-Programming/engram`."* — i.e., it is the same underlying memory engine as the `engram` CLI/MCP tool already installed and running on this machine (used for this very session's memory), rebranded/scoped for the Drenyra accounting domain with fiscal-specific tools layered on top.
- `docs/CONSUMING.md` documents two consumption modes:
  - **MCP stdio**: `drenyra-engram mcp` — 57 tools (13 general `engram_*` + 44 fiscal `accounting_*`). **No `authorize`/`approve` tool exists** — memory genuinely cannot authorize, matching Pi's `trust-model.md` §5 ("Memory informs; it never authorizes") by construction, not just by policy.
  - **HTTP REST**: `drenyra-engram serve` on `127.0.0.1:8787`, `/v1/observations`, `/v1/search`, `/v1/context`, `/v1/chain`, `/accounting/review/queue`, `/accounting/rules/.../impact`.
- The scope model matches Pi's exactly: `{"kind":"company","organizationId":...,"companyId":...,"ruc":...,"period":...}` is structurally the same RUC + period pair `runtime/context.ts#ScopeContext` already carries.
- Fiscal-specific tools relevant to Pi's command surface: `accounting_current_context` (read), `accounting_record` (propose an observation), `accounting_object_store` (WORM evidence), `accounting_review_queue` (read). Explicitly excluded from agent capability: `accounting_approve`, `accounting_review_reject/return` — human-only.

---

## 3. Bounded gap list

| # | Gap | Evidence |
| --- | --- | --- |
| G1 | No dependency (of any kind) on `drenyra-engram` exists in `package.json`. | §1 |
| G2 | No source file constructs an MCP client, spawns `drenyra-engram mcp`, or calls its HTTP API. | §1 (grep, zero `.ts` hits) |
| G3 | `runtime/context.ts`'s scope persistence is a bespoke local JSON file, not backed by Engram's `accounting_current_context` / scope-first store. | §1 |
| G4 | No command handler reads institutional memory (`engram_search`/`accounting_current_context`) to inform a proposal, as `trust-model.md` §5 describes as the intended shape ("Memory decides WHAT to propose"). | §1, §2 |
| G5 | No version-pin or install-surface contract exists for `drenyra-engram`, unlike the frozen `runtime-dependency.md` contract that governs `drenyra-ai`. | Confirmed no `contracts/*engram*` file exists. |
| G6 | `drenyra-engram` itself is pre-alpha and (as far as this exploration checked) unpublished — there is no equivalent of `drenyra-ai`'s vendored-tarball release artifact to pin against yet. | §2 |

---

## 4. In scope / out of scope (candidate boundary — not yet confirmed by the maintainer)

**Candidate in scope**, pending the decisions in §5:
- Deciding and documenting the consumption mode (MCP stdio vs. HTTP vs. deferred).
- A `runtime/engram-context.ts` (or renamed `context.ts`) read path for company/period scope, backed by Engram instead of (or alongside) the local JSON file.
- A `contracts/engram-dependency.md`-shaped contract, if the maintainer wants the same frozen-contract discipline `runtime-dependency.md` gives `drenyra-ai`.
- Updating `capability-manifest.yaml#/capabilities/engram-integration` state, with the existing guard tests in `__tests__/capability-manifest.test.ts` as the acceptance bar for any claimed state change.

**Explicitly out of scope for a first slice** (mirrors `trust-model.md` and Pi's own non-goals, and SDD 6's own discipline of small, bounded changes):
- Any `accounting_approve`/`accounting_review_reject`/`accounting_review_return` call — these are human-only by the sibling repo's own design; Pi must never call them regardless of scope decisions.
- Building or modifying anything inside the `drenyra-engram` repository itself — this change only consumes it.
- A pin/version-freeze contract as rigorous as `runtime-dependency.md`'s if `drenyra-engram` has no stable release yet (see D2 below) — freezing against a moving pre-alpha target may not be meaningful yet.
- Publication of drenyra-pi to any registry (carried forward from SDD 6/`REQ-REL-006`, unaffected by this change).

---

## 5. Product decisions the maintainer must make before a proposal (blocking)

Presented to the maintainer via a grouped prompt (see the conversation turn following this document) rather than assumed:

- **D1 — Consumption mode.** MCP stdio (spawn `drenyra-engram mcp` as a child process, matching how other MCP agents already consume it on this machine), HTTP client (`drenyra-engram serve` + REST, no child-process lifecycle to manage), or defer this change entirely until `drenyra-engram` reaches a stable release.
- **D2 — Dependency maturity gate.** `drenyra-engram@0.0.1-prealpha.1` is unpublished pre-alpha. Is a direct runtime dependency on it acceptable now (mirroring how `drenyra-ai` was pinned pre-alpha too), or should this change be scoped to design/contract-only work until a real release exists to pin against?
- **D3 — Depth of this first slice.** Minimal (replace/complement `runtime/context.ts`'s persistence with Engram-backed scope reads only — no proposal-shaping) vs. fuller (also wire `engram_search`/`accounting_current_context` into at least one command handler so memory genuinely informs a proposal, per `trust-model.md` §5's intended shape) vs. read-only reconnaissance (a design doc only, no code, because D1/D2 need to settle first).

Non-blocking / deferrable to the design phase (not asked now): the exact contract file shape for a `drenyra-engram` dependency; whether `~/.drenyra/context.json` is fully replaced or kept as a fail-open cache when Engram is unreachable; which of the 13 general `engram_*` tools (beyond `accounting_*`) are relevant to an accounting harness.

---

## Key Learnings

1. `drenyra-engram` is not a hypothetical dependency — it exists as a real, local, buildable pre-alpha TypeScript package at `/home/dreamcoder08/Documents/PROYECTOS/drenyra-engram`, version `0.0.1-prealpha.1`.
2. `drenyra-engram` explicitly mirrors `Gentleman-Programming/engram`, the same memory engine already running as an MCP server for this Claude Code session's own persistent memory.
3. REQ-BOUND-001 is a deliberate Pi-local deferral, not a master-program gate like SDD-020's Gate 0 — this change is not blocked by the Drenyra Dominion master program.
4. `drenyra-engram`'s MCP surface has no `authorize`/`approve` tool by construction, structurally enforcing the same "memory never authorizes" rule Pi's own `trust-model.md` already states as policy.
5. Three existing guard tests in `__tests__/capability-manifest.test.ts` (lines 961-978, 1095-1118) will need to keep passing (or be deliberately and honestly updated) by any real integration work — they currently block silent claims of operational/end-to-end status for this capability.
