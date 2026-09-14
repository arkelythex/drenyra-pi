# Proposal — pi-engram-integration

**Change:** `pi-engram-integration` (first local SDD change after the six-change program closed)
**Phase:** proposal (openspec artifact store, file-backed authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Inputs:** `exploration.md`, `preproposal.md` (gate **CLOSED**, decisions D1–D3 confirmed by the maintainer)
**Authority:** the preproposal's confirmed decision record. The human was not re-interviewed for this proposal; no settled decision is reopened — one baseline correction (§2) is reported, not a re-litigated decision.
**Writes performed by this phase:** this file only. No source, test, contract, config, or lock fact was written. Nothing was committed.

**One-sentence verdict (corrected by design, see `design.md` §6 — this file is kept as originally written, not silently rewritten).** ~~Replace `runtime/context.ts`'s development-grade `~/.drenyra/context.json` scope store with a Drenyra Engram–backed read/write path~~ — direct testing against the live MCP server showed Engram's schema has no session-pointer concept, so the local scope store **stays** as the source of truth for the active RUC/period; this change instead adds a **read-only institutional-context surface** on `/drenyra:context` for whatever scope the local pointer already supplies, reached by spawning the pinned `drenyra-engram mcp` binary as a child process. Nothing about command proposal logic, fiscal memory, or authority changes.

---

## 1. Intent

`REQ-BOUND-001` deliberately deferred "canonical memory integration" while Pi's own program (SDD 1–6) was still being built. That program is now closed. The deferred capability is still marked `partial` in `capability-manifest.yaml`, with an honest limitation string and three guard tests (`__tests__/capability-manifest.test.ts`) actively preventing anyone from silently claiming otherwise. This proposal closes the smallest honest piece of that gap: the scope store Pi already has (`ScopeContext` — RUC + period, the same shape every `/drenyra:*` command threads) moves from a bespoke local JSON file to Engram's own scope-first storage, reached the same way this very development environment already reaches its own Engram-backed memory (MCP stdio).

**Why now.** The gap is real (confirmed in exploration, not assumed), not blocked by the Drenyra Dominion master program's gates (unlike SDD-020), and the dependency it needs (`drenyra-engram`) is a real, locally buildable sibling repository — not a future promise.

**Why bounded to scope only, not proposal-informing memory.** Coupling the first-ever Engram dependency wire-up to command-level "memory informs a proposal" logic (`trust-model.md` §5's fuller vision) would make this change's blast radius and rollback story much harder to reason about. This repository's own delivery discipline (SDD 6: three small slices, not one) favors a small first slice whose only job is proving the dependency, the child-process lifecycle, and the fail-closed behavior work — before anything reads institutional memory to shape a proposal.

**Product outcome.** Company/period scope, once set via `/drenyra:company` / `/drenyra:period` / `/drenyra:scope`, is durable in Drenyra Engram instead of a single local JSON file — recoverable across machines/sessions the same way any other Engram-backed context already is, with the existing fail-closed doctor/verification discipline extended to cover "is Engram reachable and does it hold a valid scope."

---

## 2. Baseline measured at proposal time (one correction to exploration.md's framing)

| Surface | Measured value | Source |
| --- | --- | --- |
| `package.json#/dependencies` (this repo) | `{}` — no Engram dependency of any kind | read here |
| `runtime/context.ts` current persistence | `~/.drenyra/context.json`, atomic writes (temp + rename), doc comment states "canonical storage is a later concern" | read here |
| `capability-manifest.yaml#/capabilities/engram-integration` | `state: partial`, `verificationLevel: unit-or-contract-tested`, `ownership: pi-local` | read here |
| Guard tests fencing this capability | `__tests__/capability-manifest.test.ts` lines 961–978 (blocks `operational=end-to-end` claim), 1095–1118 (blocks ownership escalation) | read here |

**Correction to exploration.md's D2 framing.** The exploration and preproposal discussed pinning "`drenyra-engram`" as if it were one npm-shaped dependency, by analogy to `drenyra-ai`'s vendored-tarball pattern. Direct inspection of the sibling repository at proposal time shows **two distinct artifacts**, not one:

1. An npm/TypeScript library (`drenyra-engram` on npm, `package.json` version `0.0.1-prealpha.1`, `exports` for `./core`, `./store`, `./search`, `./lifecycle`, `./authority`) — for programmatic embedding inside a Node/Bun process.
2. A **compiled Go binary** (`module github.com/arkelythex/drenyra-engram`, `go.mod`) that provides the `drenyra-engram mcp` / `drenyra-engram serve` CLI `docs/CONSUMING.md` describes — version `0.2.1-SNAPSHOT`, already built for `linux_amd64`, `linux_arm64`, `darwin_amd64`, `darwin_arm64`, `windows_amd64`, `windows_arm64` (GoReleaser-shaped `dist/` output, with per-platform SPDX SBOM files and a `checksums.txt`).

**D1 (MCP stdio) needs artifact 2 — the compiled binary — not the npm package.** `drenyra-ai`'s single-tarball, platform-agnostic vendoring pattern (`vendored/drenyra-ai-0.4.1.tgz`, one file, `file:` npm dependency) does not transfer directly: a compiled binary needs per-platform selection, and `0.2.1-SNAPSHOT` is not even a proper tagged release (the `-SNAPSHOT` suffix marks a pre-release dev build, consistent with D2's already-confirmed "pre-alpha, accept it" answer, but sharper than "pre-alpha npm package" — this is a pre-release native binary).

This does not change D1, D2, or D3 — all three still hold — it refines *how* D1 and D2 get implemented, and becomes the design phase's first concrete question (§3).

---

## 3. Scope

### In scope

- A pinned, checksum-verified `drenyra-engram` binary for at least `linux_amd64` (this development machine's platform; `linux_arm64` optional/design-phase decision), vendored the same fail-closed way `runtime/doctor.ts` already verifies the `drenyra-ai` pin.
- A child-process lifecycle for `drenyra-engram mcp` (spawn, health-check via a real MCP `initialize` handshake, graceful shutdown, and a documented failure mode when the binary is absent or unhealthy — matching this repository's own `REQ-REL-004` precedent of "never silent, never hard-failing" for a similar install-time gap).
- ~~`runtime/context.ts`'s `ScopeContext`... read from and written to Engram via its MCP tools, replacing or fronting `~/.drenyra/context.json`~~ — **corrected by design §6:** `runtime/context.ts` is unchanged; `/drenyra:context` gains a read-only institutional-context addendum for the RUC + period the local pointer already supplies.
- An honest `capability-manifest.yaml#/capabilities/engram-integration` state update reflecting exactly what this slice does (scope persistence only) — verified against the three existing guard tests, which must keep passing or be deliberately and visibly updated with new evidence.
- A `contracts/`-shaped record of the new dependency (exact file/section TBD — design phase, per preproposal D2's consequence note).

### Out of scope (carried from preproposal.md, unchanged)

- `accounting_approve` / `accounting_review_reject` / `accounting_review_return` — human-only, never called by Pi.
- Any code change inside the `drenyra-engram` repository.
- Command-level proposal-informing memory reads (`engram_search`, `accounting_current_context` used to shape a proposal) — a later slice, not this change.
- Publication of `drenyra-pi` to any registry (`REQ-REL-006`, unaffected).
- Widening the canonical 10-element scope model beyond RUC + period.
- A pin/version-freeze contract as rigorous as `runtime-dependency.md`'s final form, if design finds `0.2.1-SNAPSHOT`'s pre-release nature makes that premature — design may recommend a lighter "tracked, not yet frozen" record instead, consistent with D2's "accept pre-alpha" spirit.

---

## 4. Open questions for design (not blocking proposal, not reopening D1–D3)

1. Exact vendoring shape for a per-platform compiled binary (one platform now, matrix later? which checksum manifest entry pattern?).
2. Whether `~/.drenyra/context.json` is fully replaced or kept as a fail-open local cache when the Engram child process is unreachable (fail-closed for fiscal operations is Pi's existing posture generally, but scope-read failure specifically may warrant a narrower policy — design's call, with `trust-model.md` as the authority to reconcile against).
3. Where the new dependency's contract record lives: extend `runtime-dependency.md`, or a new sibling `contracts/engram-dependency.md`.
4. Whether `DRENYRA_DEFAULT_SCOPE`-shaped MCP initialize metadata (`docs/CONSUMING.md` §2 in the sibling repo) is the right binding point, or whether Pi should call explicit `engram_*`/`accounting_*` tools after a plain `initialize`.

---

## 5. Risks

| # | Risk | Severity | Mitigation direction |
| --- | --- | --- | --- |
| R1 | `0.2.1-SNAPSHOT` is a moving pre-release target; the exact binary pinned today may not exist at that build identifier tomorrow. | Medium | Vendor the binary the same way `drenyra-ai`'s tarball is vendored — a local, checksummed, committed artifact, not a live fetch. |
| R2 | A child-process MCP server introduces a new failure mode (crash, hang, port/pipe contention) that `doctor()`/startup panel must now account for. | Medium | Reuse the fail-closed pattern already proven for the `drenyra-ai` pin; never let scope-store failure silently corrupt or invent a RUC/period. |
| R3 | Capability-manifest guard tests could be weakened instead of honestly updated, understating what changed. | Low (tests already exist to catch this) | Design/tasks phase must show the exact before/after manifest diff against the existing guard assertions. |

---

## 6. Next phase

`sdd-spec` and `sdd-design` may now run against this bounded scope.
