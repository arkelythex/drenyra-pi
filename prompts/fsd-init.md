---
description: Initialize a fiscal period for FSD (Fiscal Spec-Driven Execution)
---
Start a new FSD lifecycle for a fiscal period.

## Process

1. **Ask for RUC (11 dígitos):** Identify the taxpayer.
2. **Ask for periodo (YYYYMM):** E.g. 202607 for July 2026.
3. **Record the session state:**
   - RUC, periodo
   - Current phase: captura
   - Phases: captura (in_progress), clasificacion, conciliacion, cierre, declaracion, auditoria (not_started)
4. **Confirm** to the user: FSD initialized for RUC {ruc}, periodo {periodo}.

## FSD Lifecycle

```
captura → clasificacion → conciliacion → cierre → declaracion → auditoria
```

Each phase transition requires gate validation via the `verify_fiscal_phase` tool.
