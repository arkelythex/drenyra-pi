# Pre-proposal — pi-engram-integration

**Change:** `pi-engram-integration`
**Phase:** pre-proposal gate — confirms the product decisions `exploration.md` §5 left open
**Confirmed by:** maintainer (`dreamcoder08`), interactive session, 2026-09-14

---

## Confirmed decisions

### D1 — Consumption mode: **MCP stdio**

Shell will spawn `drenyra-engram mcp` as a child process and speak the same Model Context Protocol every other agent on this machine already uses to reach it (`docs/CONSUMING.md` §2 in the sibling repo). Not HTTP REST (`drenyra-engram serve`), and not deferred.

**Why:** matches the existing, already-proven consumption pattern on this machine (this very Claude Code session reaches its own `engram` memory the same way); avoids standing up and supervising a separate long-lived HTTP service; the MCP surface has no `authorize`/`approve` tool by construction, which is a stronger structural guarantee of "memory never authorizes" than an HTTP client would need to enforce itself.

**Consequence for design:** Shell needs a child-process lifecycle (spawn, health-check, graceful shutdown, restart-on-crash policy) for `drenyra-engram mcp`, analogous to how `runtime/doctor.ts` already fail-closes on a verification failure for the `drenyra-ai` pin. This lifecycle management is a real design surface, not a one-liner.

### D2 — Dependency maturity: **accept pre-alpha, pin exact version**

A direct runtime dependency on `drenyra-engram@0.0.1-prealpha.1` (unpublished) is accepted now, mirroring how `drenyra-ai` was pinned and vendored while itself pre-alpha.

**Why:** `runtime-dependency.md`'s existing contract already establishes the pattern (exact pin, package-local, vendored tarball, checksum-verified, fail-closed on mismatch) — reusing it for a second pinned dependency is consistent architecture, not a new risk class. `drenyra-engram` is a sibling first-party repository, not a third-party unknown.

**Consequence for design:** a second `vendored/drenyra-engram-<version>.tgz`-shaped install source and a second pin record are needed. Whether this becomes its own frozen contract file (`contracts/engram-dependency.md`) or an extension of the existing `runtime-dependency.md` contract is a design-phase decision, not decided here.

### D3 — Depth: **minimal, scope only**

This first slice reads and persists company/period scope (`ScopeContext` — RUC + fiscal period) through Engram instead of (or alongside) `runtime/context.ts`'s development-grade local JSON file. It does **not** wire `engram_search`/`accounting_current_context` into any command's proposal logic yet.

**Why:** keeps the first slice bounded and independently verifiable — matches this repository's own established discipline (SDD 6 shipped three small slices, not one large one). Proposal-informing memory reads (the fuller `trust-model.md` §5 vision) are real, valuable follow-on work, but coupling them to the first-ever `drenyra-engram` dependency wire-up would make the first slice's blast radius (and its rollback story) much harder to reason about.

**Consequence for design:** `REQ-BOUND-001`'s "canonical memory integration is a later concern" language stays partially true even after this change — only the scope-store half moves off the dev-grade JSON file. `capability-manifest.yaml#/capabilities/engram-integration` should be updated to reflect exactly this (scope persistence Engram-backed; proposal-informing reads still not evidenced), not silently upgraded past what was actually built — the existing guard tests in `__tests__/capability-manifest.test.ts` will enforce this either way.

---

## Explicitly out of scope (unchanged from exploration.md §4)

- `accounting_approve` / `accounting_review_reject` / `accounting_review_return` — human-only, never called by Shell, regardless of any future slice.
- Any change inside the `drenyra-engram` repository itself.
- Publication of `drenyra-shell` to any registry.
- Command-level proposal-informing memory reads (deferred to a later slice, not this change).

## Not selected

`sdd-research` was not selected for this change — the exploration phase's own reading of the sibling repository's `package.json`, `README.md`, and `docs/CONSUMING.md` was judged sufficient first-party evidence for these three decisions. No external/unverified claim underlies D1–D3.

## Next phase

`sdd-propose` may now run, scoped to D1 (MCP stdio spawn), D2 (pinned pre-alpha vendored dependency), D3 (scope-only, no proposal-informing reads).
