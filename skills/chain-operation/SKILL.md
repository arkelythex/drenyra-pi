---
name: chain-operation
description: "Drenyra chain operation: run one EDA phase per continue, respect RUN/SKIP/WAIT, never auto-advance waits, and require R2 approval plus receipts for execute."
license: Apache-2.0
metadata:
  author: drenyra-pi
  version: "0.1"
  layer: foundation
  jurisdiction: global
---

# Chain Operation

Drenyra chains (monthly-close, reconcile, verify, evidence) advance one EDA
phase at a time. The runtime decides the next step from persisted state —
never from chat.

## When to use

Load this skill before running any chain, continuing a mission, resuming
interrupted work, or closing a period.

## One phase per step

- `/drenyra:continue` executes EXACTLY ONE protocol-declared prepared
  transition (RUN/SKIP/WAIT). There is no continue-all path.
- WAIT states never auto-advance: `WAITING_FOR_EVIDENCE`,
  `BLOCKED_BY_GATE`, and `AWAITING_APPROVAL` stay until the required input
  arrives.
- Terminal states are never replayed.

## The EDA phases

```text
intake -> bind-scope -> ingest -> normalize -> classify -> reconcile ->
investigate -> propose -> approve -> execute -> verify -> close -> archive
```

Every intent uses one applicability policy: lifecycle phases transition the
engine state; steady-state phases advance phase-only and never fabricate an
engine transition.

## Authority and approvals

- The chain runs the fixed stage order: scope -> mode -> materiality ->
  mission -> approval -> receipt. The first non-allowed stage stops the run.
- Monthly close requires the R2 floor: explicit materiality input and an
  explicit human approver; the materiality default is never R0.
- An approve phase without approval reports `BLOCKED_BY_GATE` /
  `AWAITING_APPROVAL` and advances nothing.
- Execute requires approval AND a trusted-key receipt gate; a completion
  receipt never self-authorizes its own action.

## Fail-closed rules

- Incomplete scope, stale scope hash, missing materiality, unknown signer,
  empty trusted-key list, malformed graph, or a mixed schema version blocks
  protected work.
- Verify chains are read-only: they never mutate accounting outputs.
- Idempotency: a completed idempotency key returns the cached result; a
  conflicting payload is rejected.
