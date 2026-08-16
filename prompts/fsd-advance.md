---
description: Advance to the next fiscal phase in the FSD lifecycle
---
Validate gates and advance to the next fiscal phase.

## Process

1. **Verify current phase** from session state.
2. **Validate gate conditions** for the transition:

   | From | Gate | Condition |
   |------|------|-----------|
   | captura | captura-complete | CPEs captured > 0 |
   | clasificacion | clasificacion-complete | Coverage >= 95% |
   | conciliacion | conciliacion-variance | Variance < 5% |
   | cierre | cierre-approval | Human approval required |
   | declaracion | declaracion-filed | SUNAT acceptance + CDR |
   | auditoria | auditoria-done | Confidence score > 0.8 |

3. **Use the `verify_fiscal_phase` tool** to confirm the transition is valid.
4. **Record the phase change** in session state.
5. **Notify the user** of the completed transition.

## Risk Tiers

| Phase | Risk | Gate Type |
|-------|------|-----------|
| captura → clasificacion | R0 | Auto (gate check) |
| clasificacion → conciliacion | R0 | Auto (gate check) |
| conciliacion → cierre | R1 | Warning if variance > 5% |
| cierre → declaracion | R2 | Human approval required |
| declaracion → auditoria | R1 | Auto if CDR valid |
| auditoria → done | R3 | Dual approval required |
