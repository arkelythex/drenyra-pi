# Closed-Period Policy (v0.1)

> Scope: fiscal periods that have been closed in the harness. Status: v0.1
> operating policy.

## Closed periods are final

A closed fiscal period is final for the purposes of ordinary operation. Its
evidence, authorizations, and receipts are immutable history.

## No silent modification of closed periods

**The harness never silently modifies a closed period.** No agent, command, or
chain may change the records of a closed period without an explicit,
evidence-cited, human-approved correction flow. In particular:

- No silent modification of closed periods is allowed in any mode.
- A change to a closed period requires a new `correction` mission with its own
  scope binding, evidence, approval, and receipts.
- The original closed-period records remain untouched; the correction links
  to them by identity, never by rewriting them.

## Fail-closed behavior

- A request that touches a closed period without the correction flow fails
  closed: it reports the blocker and mutates nothing.
- Unknown or ambiguous period state blocks protected work; it never defaults
  to "open".
- Timestamps are evidence, not identity. Hashes, versions, stable ids, and
  append order provide identity and ordering for closed-period records.
