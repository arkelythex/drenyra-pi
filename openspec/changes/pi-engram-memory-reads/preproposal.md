# Pre-proposal — pi-engram-memory-reads

**Change:** `pi-engram-memory-reads`
**Phase:** pre-proposal gate — confirms the product decisions `exploration.md` §6 left open
**Confirmed by:** maintainer (`dreamcoder08`), interactive session, 2026-09-14

---

## Confirmed decisions

### D1 — Tool surface: **`engram_context` only**

No widening of `contracts/engram-dependency.md` rule 6. This slice adds no new consumed tool name — it reuses exactly the general, read-only `engram_context` call `pi-engram-integration` already built a client for and got approved.

**Why:** zero new risk surface; the existing contract already covers everything this slice needs.

### D2 — Target agent: **`journal-candidate-agent` only**

**Why:** matches `trust-model.md` §5's own worked example almost verbatim ("this provider always has 12% detracción" shaping which candidate is drafted); smallest possible blast radius for a first slice — one agent, one new tool, one contract already in force.

**Consequence for design:** only `agents/journal-candidate-agent.md`'s `tools:` frontmatter line gains the new tool name; the other 9 agents are untouched.

### D3 — Query shape: **agent-driven**

The agent calls the new tool with its own query at the moment it needs institutional context (e.g., a specific provider name or account it is currently evaluating) — the host does not pre-fetch or pre-scope the read.

**Why:** the agent already holds the case-specific context (which provider, which account, which discrepancy) by the time it would want institutional memory; a host-prescoped read would have to guess that in advance, which no design decision here can do reliably.

---

## Not selected

`sdd-research` was not selected — this change reuses `pi-engram-integration`'s already-verified `runtime/engram-client.ts` and the real `@earendil-works/pi-coding-agent` extension docs already read during exploration. No new external evidence is needed.

## Next phase

`sdd-propose` may now run, scoped to D1 (`engram_context` only), D2 (`journal-candidate-agent` only), D3 (agent-driven query).
