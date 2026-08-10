---
name: scope-discipline
description: "Drenyra scope discipline: bind and verify the complete canonical scope before any protected work, and fail closed on mismatch or change."
license: Apache-2.0
metadata:
  author: drenyra-pi
  version: "0.1"
  layer: foundation
  jurisdiction: global
---

# Scope Discipline

Every Drenyra Pi operation is bound to a canonical scope. Scope discipline is
the first gate: read the scope, verify it, and never work outside it.

## When to use

Load this skill before any mission, chain, evidence, approval, or receipt
operation, and whenever you are asked to read or analyze accounting data.

## The canonical scope

The complete canonical scope has exactly ten elements:

```text
tenant, organization, company, fiscalPeriod, ledgerBook, operationType,
sourceSnapshot, policyVersion, actor, authorityLevel
```

- `company` is an 11-digit Peruvian RUC validated by check digit.
- `fiscalPeriod` is canonical YYYYMM with a real month (01-12).
- `sourceSnapshot` is the lowercase hex sha-256 of the frozen source manifest.
- `authorityLevel` is one of ASK, ANALYZE, PREPARE, EXECUTE.

## Fail closed

1. Read the active scope binding and the mission id FIRST, before any other
   work.
2. If the scope is missing, incomplete, or changed (a different scope hash),
   STOP with a scope-guard error. Never guess a missing element.
3. Never work for a different company or a different fiscal period than the
   bound scope.
4. Every prepared step and target carries its scope hash; a reloaded mismatch
   invalidates the action BEFORE any mutation.

## Verify the binding

- Recompute the scope hash from the ten elements; compare it to the binding.
- Confirm the mission's company and fiscal period match the binding.
- A scope change invalidates prior authorizations: request a new bound
  decision before continuing.
