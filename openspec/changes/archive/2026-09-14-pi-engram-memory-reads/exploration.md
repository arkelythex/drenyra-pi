# Exploration — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads` (candidate; second follow-on to `pi-engram-integration`)
**Phase:** explore — read-only against the repository and local Pi-host packages (not modified)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-pi`
**Topic:** the remaining half of `ROADMAP.md`'s Slice 5 — "memory reads" (proposal-informing), explicitly deferred by `pi-engram-integration`'s design.md §6.

---

## 1. A two-memory-system distinction this exploration had to resolve first

All 10 agent definitions (`agents/*.md`) already declare `tools: read, grep, glob, bash, mem_search, mem_get_observation, mem_save` in their frontmatter. At first read this looks like "memory reads" are already wired. They are not the memory this task means:

- `mem_search`/`mem_get_observation`/`mem_save` are wired, at the Pi host level, to the **generic** `engram` MCP server (`/home/dreamcoder08/.pi/agent/mcp.json`'s `"engram"` entry spawns `engram mcp --tools=agent` — the same `Gentleman-Programming/engram` binary this very session uses for its own memory). It is **project-scoped developer/session memory** ("how did I solve this before"), not accounting-domain knowledge.
- `docs/architecture/trust-model.md` §5 and `ROADMAP.md`'s "Drenyra Engram integration" name a different thing: **`drenyra-engram`**, the RUC/company-scoped **institutional accounting memory** (`accounting_*` tools, "this provider always has 12% detracción" — trust-model.md's own example) that `pi-engram-integration` already vendored, pinned, and built a client for (`runtime/engram-client.ts`, `runtime/engram-pin.ts`).

**Conclusion:** the agents' existing `mem_search` tool is unrelated to this task and must not be confused with it or reused for it. This task is about giving an agent access to `drenyra-engram`'s institutional context specifically — a new, separate tool.

## 2. Where a registered tool actually reaches a subagent

Read `@earendil-works/pi-coding-agent`'s own `docs/extensions.md` (the real host package, not assumed):

- `pi.registerTool()` registers a tool "callable by the LLM" — but a **sub-agent** (like `journal-candidate-agent`) is spawned through Pi's own `subagent/` extension pattern, and each sub-agent's available tool set is filtered to exactly the names listed in its own frontmatter `tools:` line.
- **Consequence:** exposing `drenyra-engram` context to an agent needs two changes, not one: (a) `extensions/register.ts` calls `pi.registerTool()` for a new tool backed by `runtime/engram-client.ts`, and (b) that tool's name is added to the target agent .md file's `tools:` frontmatter list — omitting (b) would register a tool nothing can reach.
- **Corrected during apply:** the first grep was scoped to `extensions/register.ts` only. `pi.registerTool()` is in fact already used — `extensions/fiscal-guard.ts` calls it five times (`verify_fiscal_phase` and four others), with an established, proven pattern (`Type.Object` from `typebox`, `content: [{type: "text", text}]`, `details: Record<string, unknown>` for structured data). `extensions/register.ts` itself still declares the structural type but has never called it — that half of the original finding holds. This change follows `fiscal-guard.ts`'s existing convention exactly rather than inventing a new one.

## 3. Which agent is the right first target

`docs/architecture/trust-model.md` §5 gives its own worked example: *"Institutional patterns ('this provider always has 12% detracción', 'this account was reclassified last month by human error') shape which candidate an agent drafts."* This describes **`journal-candidate-agent`** almost exactly — its own description is *"Proposes structured journal-entry corrections... PREPARE ceiling"* (`agents/journal-candidate-agent.md`). `reconciliation-agent` is a plausible second candidate (also proposes, also PREPARE-adjacent per its own frontmatter `authority: ANALYZE`), but journal-candidate-agent is the closer, more literal match to the trust-model example and to "propose a journal-entry correction."

## 4. What must never happen (carried forward, unconditionally)

- **Memory never feeds a gate.** (trust-model.md §5, verbatim) The new tool's output may shape what the agent proposes; it must never be wired anywhere near `mission-state`/`receipt`/`approval` gate logic or the deterministic materiality policy.
- **No write-shaped or `accounting_*` call without a fresh decision.** `contracts/engram-dependency.md` rule 6 currently restricts consumption to `engram_context` only. Whether this new slice needs `accounting_search`/`accounting_current_context` (richer, fiscal-scoped reads) or can stay within the already-approved `engram_*` general surface is an open decision (§6).
- **The agent still never authorizes.** `journal-candidate-agent`'s own authority ceiling (PREPARE, propose-only, never posts) is unaffected — this change only gives it more informed input, not more authority.

## 5. Bounded gap list

| # | Gap |
| --- | --- |
| G1 | No `pi.registerTool()` call exists anywhere in this codebase. |
| G2 | No agent's `tools:` frontmatter names any `drenyra-engram`-backed tool. |
| G3 | `journal-candidate-agent` currently proposes candidates from ledger/reconciliation/evidence-graph references only — no institutional-memory input shapes the proposal. |
| G4 | `contracts/engram-dependency.md` rule 6 may need a deliberate, disclosed widening (or may not — a real open question, not assumed). |

## 6. Product decisions for the pre-proposal gate (not decided here)

- **D1 — Which tool surface to expose.** Reuse `engram_context` only (matches the already-approved contract, zero new risk) vs. add read-only `accounting_search`/`accounting_current_context` (richer, fiscal-specific, but widens `contracts/engram-dependency.md` rule 6 and needs its own disclosed rationale).
- **D2 — Which agent(s) get the new tool in this first slice.** `journal-candidate-agent` only (matches trust-model.md's own example, smallest blast radius) vs. also `reconciliation-agent` (both propose, but doubles the surface to verify in one slice).
- **D3 — Scope shape.** A generic "institutional context" tool the agent calls with its own query (agent decides what to search for) vs. a narrower, pre-scoped read the command handler performs before invoking the agent and passes in as context (host decides, agent only reads).

## Key Learnings

1. `agents/*.md`'s existing `mem_search`/`mem_save` tools are wired to the generic, project-scoped `Gentleman-Programming/engram` dev-memory server, not to `drenyra-engram`'s institutional accounting memory — a real, easy-to-miss naming collision between two distinct memory systems this repository's agents already declare access to.
2. `pi.registerTool()` is declared in `extensions/register.ts`'s structural `PiExtensionApi` type but has never been called in this codebase — confirmed by direct grep, not assumed.
3. A Pi sub-agent's available tools are filtered to exactly what its own `.md` frontmatter `tools:` line names; registering a new tool in `extensions/register.ts` alone does not make it reachable by any sub-agent without also editing that agent's frontmatter.
4. `docs/architecture/trust-model.md` §5 names `journal-candidate-agent`'s exact use case ("this provider always has 12% detracción" shaping which candidate is drafted) as the canonical example of memory-informed proposing — the clearest, most literal first-slice target.
