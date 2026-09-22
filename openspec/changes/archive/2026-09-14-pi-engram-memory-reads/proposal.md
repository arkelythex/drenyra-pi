# Proposal — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads`
**Phase:** proposal (openspec artifact store, file-backed authoritative; `openspec/config.yaml` declares `store_mode: hybrid`)
**Repository root:** `/home/dreamcoder08/Documents/PROYECTOS/drenyra-shell`
**Inputs:** `exploration.md`, `preproposal.md` (gate **CLOSED**, D1–D3 confirmed by the maintainer)
**Authority:** the preproposal's confirmed decision record. One shape correction is reported below, not a re-litigated decision.

**One-sentence verdict.** Give `journal-candidate-agent` a new custom Pi tool, backed by the already-built `runtime/engram-client.ts`, that lets it search `drenyra-engram`'s institutional accounting memory for its own case-specific query when drafting a candidate journal-entry correction — the first real use of `trust-model.md` §5's "memory decides WHAT to propose."

---

## 1. Intent

`pi-engram-integration` deliberately stopped at a read-only institutional-context addendum on `/drenyra:context`, disclosing that "no command reads memory to shape a proposal yet." This change closes that gap for exactly one agent, exactly one tool, matching `trust-model.md` §5's own example: *"this provider always has 12% detracción"* — an institutional pattern that should shape which journal-entry correction `journal-candidate-agent` drafts, never how much review it gets (that stays the deterministic materiality policy's job, untouched).

**Why now.** `pi-engram-integration` already built and shipped the hard infrastructure (pinned binary, fail-closed child-process lifecycle, MCP client). What remains is a comparatively small, well-scoped consumption step: one new `pi.registerTool()` call and one agent frontmatter edit.

**Why bounded to one agent, one tool.** Matches this repository's own established discipline (small, independently verifiable slices) and the preproposal's D2 (smallest blast radius, closest match to the trust-model example).

## 2. Shape correction found while starting this phase (D1/D3 reconciled, not reopened)

**D1 said "`engram_context` only"; D3 said "the agent forms its own query."** Re-reading `engram_context`'s own input schema (captured live during `pi-engram-integration`'s design phase): it takes only `{ scope }` — no free-text query field. It cannot do what D3 asked for. `engram_search` — a sibling tool in the same general, read-only `engram_*` family (not `accounting_*`, not write-shaped) — takes `{ query, scope, matchMode, limit, includeInstitutional }` and is the one that actually supports an agent-chosen query.

**Resolution, preserving both decisions' actual intent:** use `engram_search` instead of the literal tool name `engram_context`. This still satisfies D1's real intent (stay inside the already-approved general `engram_*` surface; zero `accounting_*`; zero write-shaped tool) — it just names the one sibling tool that can actually be queried, which D3 requires. `contracts/engram-dependency.md` rule 6 needs one small, disclosed addition: `engram_search` joins `engram_context` as an allowed call. No `accounting_*` tool, no write-shaped tool, no re-opening of D1/D2/D3's actual decisions.

## 3. Scope

### In scope

- `extensions/register.ts`: one new `pi.registerTool()` call (name TBD at design, e.g. `drenyra_institutional_memory`) whose `execute()` spawns/reuses an `engram-client` (via the existing `spawnEngramClient`) and calls `engram_search` with the agent-supplied query, scoped to the currently-known company RUC (the same local pointer `/drenyra:context` already reads — never a different RUC, never cross-company).
- `agents/journal-candidate-agent.md`: add the new tool's name to its `tools:` frontmatter line. No other agent file changes.
- `contracts/engram-dependency.md`: rule 6 gains `engram_search` alongside `engram_context`.
- `capability-manifest.yaml#/capabilities/engram-integration`: honest state update reflecting that one agent now has institutional-memory-informed proposing.

### Out of scope (unchanged from `pi-engram-integration`'s own carried boundary, plus this slice's own cuts)

- Any `accounting_*` tool call.
- Any write-shaped `engram_*` tool (`engram_save`, `engram_reject`, `engram_void`, `engram_supersede`).
- `reconciliation-agent` or any other of the remaining 9 agents (D2).
- Any change to gate logic, materiality policy, or approval flow — memory shapes proposal content only, never review depth or authorization (`trust-model.md` §5, unconditional).
- Any change to `runtime/engram-client.ts` or `runtime/engram-pin.ts`'s own logic — this slice is a new caller, not a change to the client.

## 4. Risks

| # | Risk | Severity | Mitigation direction |
| --- | --- | --- | --- |
| R1 | An agent-driven free-text query could accidentally search outside the current company's scope. | Medium | The new tool's `execute()` hard-codes `scope.ruc` from the local pointer; the agent supplies only the query text, never the scope object — same pattern proven in `/drenyra:context`'s handler. |
| R2 | `journal-candidate-agent`'s PREPARE ceiling could be misread as widened by having more input. | Low | No authority change; document explicitly in the agent file and in `capability-manifest.yaml` that this is additional input, not additional authority. |
| R3 | The child-process spawn cost (tarball extraction, per `engram-client.ts`'s current no-cache design) now happens per agent invocation, not just per `/drenyra:context` call. | Low | Already a disclosed, deliberate scope cut in `pi-engram-integration`; unaffected by this slice, just exercised more often. |

## 5. Next phase

`sdd-spec` and `sdd-design` may now run against this bounded scope.
