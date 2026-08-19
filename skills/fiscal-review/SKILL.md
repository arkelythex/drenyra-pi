---
name: fiscal-review
description: "Review lenses for accounting correctness (ledger-integrity, sunat-compliance, audit-trail, tenant-isolation). Use when reviewing fiscal changes for correctness rather than code style."
---
    
# Fiscal Review

Review lenses for accounting correctness, not code style.

## Lenses

### ledger-integrity

- Double-entry bookkeeping is balanced (debe = haber)
- Journal entries reference valid PCGE accounts
- Money values use the project's Money type
- Period boundaries are respected (no postings to closed periods)

### sunat-compliance

- SUNAT document series format is valid (F001-B001, etc.)
- IGV is calculated at 18% on taxable operations
- CDR response is validated and stored
- Detracciones/Retenciones follow current SUNAT annexes
- SIRE reconciliation covers all registered documents

### audit-trail

- Every mutation has: RUC, periodo, timestamp, actor, reason
- Immutable ledger: entries are append-only, never updated
- Fiscal period closures are irreversible after approval
- RUC scope is preserved across all queries

### tenant-isolation

- No cross-RUC data access in queries or mutations
- RUC parameter is validated against current session context
- Organization boundaries are enforced at DB query level

## Verification

Run compliance gates:

```bash
bun run compliance:sire-gate
bun run architecture:check-boundaries
```
