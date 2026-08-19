---
name: drenyra-sdd
description: "Drenyra FSD: fiscal spec-driven execution with lifecycle phases captura, clasificacion, conciliacion, cierre, declaracion, auditoria. Use when planning or executing fiscal obligation specifications instead of software specs."
---
    
# Drenyra SDD (Fiscal Spec-Driven Execution)

FSD is the Drenyra adaptation of SDD for accounting. Instead of software specs, it defines fiscal obligation specifications.

## FSD Phases

| Phase | Purpose | Gate |
|-------|---------|------|
| captura | Captura de Comprobantes | All CPEs received from SUNAT/ERP |
| clasificacion | Clasificación PCGE | Coverage >= 95% |
| conciliacion | Conciliación Bancaria | Variance < 5% |
| cierre | Cierre Contable Mensual | Human approval (R2) |
| declaracion | Declaración SUNAT | CDR valid + filed |
| auditoria | Auditoría y Cierre Fiscal | Confidence > 0.8 |

## Gate Rules

- **R0**: Auto-pass with gate check
- **R1**: Auto-pass with warning on threshold breach
- **R2**: Human approval required (contador/accountant)
- **R3**: Dual approval required (contador + compliance officer)

## Usage

```bash
/fsd:init    # Start fiscal period
/fsd:status  # Current state
/fsd:advance # Validate and advance phase
```

## Related

- `packages/fiscal-sdd/` — 97 tests, full pipeline
- `packages/pi/src/phase/` — Phase engine with gates
