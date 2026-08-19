---
name: lens-audit-trail
description: "Review lens verifying every mutation is logged with RUC, periodo, timestamp, actor, reason and that ledger entries are append-only. Use when reviewing code touching accounting tables or fiscal packages."
---
    
# Review Lens: audit-trail

Verify every mutation is logged with RUC, periodo, timestamp, actor, reason

## Checks

- [ ] Every mutation has: RUC, periodo, timestamp, actor, reason\n- [ ] Ledger entries are append-only (no UPDATE)\n- [ ] Period closures logged with human approver\n- [ ] Cross-RUC operations have explicit authorization

## Trigger

Run this lens when changes affect:

- Files in packages/fiscal-*, packages/domain/src/fiscal/
- Files with SUNAT, IGV, RUC, SIRE, detracción in name
- Any SQL query touching accounting tables
- API endpoints with RUC parameter
