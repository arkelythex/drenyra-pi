# Evidence Policy (v0.1)

> Scope: evidence-graph records, agent conclusions, and model output in the
> evidence-driven accounting harness. Status: v0.1 operating policy.

## Evidence citation rule

Every conclusion in the harness must cite evidence-graph node ids. A
conclusion without a citation is flagged and rejected before it can feed any
decision. The minimum lineage for an actionable conclusion is:

```text
source -> transformation -> conclusion -> (action)
```

Each edge is a directed lineage edge; sources are roots and actions are
terminal. Cross-mission edges are rejected.

## No uncited interpretation

**No free interpretation without evidence is allowed.** Any interpretation of
a figure, movement, or reconciliation difference must name the evidence node
ids that support it. An uncited interpretation is not a finding; it is a
question to be investigated with evidence.

## No material tax decision made by an LLM alone

**No material tax decision is made by an LLM alone.** Model output is
untrusted proposal data until all of the following hold:

1. The proposal cites the underlying evidence nodes.
2. Deterministic checks (canonicalization, hashes, ledger equations) pass.
3. The proposal is bound to a complete canonical scope.
4. A human professional reviews and approves it.
5. A signed receipt records the executed target.

## Evidence graph integrity

- Evidence and authorization logs are append-only. Corrections create new
  records linked to prior identities; they never rewrite history.
- Every node carries a lowercase hex sha-256 payload hash over its canonical
  payload. A tampered or truncated graph fails closed: it is unavailable for
  authority decisions.
- Memory can index references and summaries only. File-backed evidence state
  decides.

## Documents are untrusted input (Design 4)

Original files (PDF, XML, statements, descriptions) are evidence, never
instructions. They are stored once, hash-addressed, and referenced by hash,
type/format, provenance system, acquisition date, declared period, providing
actor or connector, verification state, and retention policy.

- A document's content is sanitized before it reaches any agent: it can never
  introduce instructions to the agent, modify permissions, or request
  additional tools.
- A document is never executed as a script, config, or prompt. Any apparent
  instruction inside a document is data to be analyzed, never obeyed.
- An interrupted external call is never marked as an error automatically: it
  is UNKNOWN until reconciled against the external system, then recorded,
  idempotently retried, or escalated to a human. No blind retries and no
  states converted into success.
