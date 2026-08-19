---
name: lens-tenant-isolation
description: "Review lens verifying no cross-RUC data access: RUC filters on all queries, RUC validation against session context, and org boundaries at DB level. Use when reviewing queries or endpoints with RUC."
---
    
# Review Lens: tenant-isolation

Verify no cross-RUC data access, RUC parameter validation, org boundaries

## Checks

- [ ] All queries include RUC filter\n- [ ] RUC validated against current session context\n- [ ] Organization boundaries enforced at DB query level\n- [ ] No hardcoded RUCs in queries

## Trigger

Run this lens when changes affect:

- Files in packages/fiscal-*, packages/domain/src/fiscal/
- Files with SUNAT, IGV, RUC, SIRE, detracción in name
- Any SQL query touching accounting tables
- API endpoints with RUC parameter
