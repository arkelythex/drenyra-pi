---
name: lens-sunat-compliance
description: "Review lens verifying SUNAT document series, statutory IGV calculation, CDR storage, detracciones and retenciones annexes, and SIRE reconciliation. Use when reviewing SUNAT submission code."
---
    
# Review Lens: sunat-compliance

Verify SUNAT document series, IGV calculation, CDR validation, SIRE reconciliation

## Checks

- [ ] Document series format valid (F001-B001, etc.)\n- [ ] IGV calculated at 18% on taxable operations\n- [ ] CDR received and stored for SUNAT submissions\n- [ ] Detracciones/Retenciones follow current annexes\n- [ ] SIRE reconciliation covers all registered documents

## Trigger

Run this lens when changes affect:

- Files in packages/fiscal-*, packages/domain/src/fiscal/
- Files with SUNAT, IGV, RUC, SIRE, detracción in name
- Any SQL query touching accounting tables
- API endpoints with RUC parameter
