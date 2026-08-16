---
description: Show the current FSD (Fiscal Spec-Driven Execution) status
---
Report the current fiscal period state.

## Process

1. **Read the FSD session state** from the conversation history.
2. **Format a status report:**

```markdown
## FSD Status

- RUC: {ruc}
- Período: {periodo}
- Current phase: {phase} ({label})
- Status: {status}

### Phase Progress

- [x] Captura de Comprobantes
- [ ] Clasificación PCGE
- [ ] Conciliación Bancaria
- [ ] Cierre Contable Mensual
- [ ] Declaración SUNAT
- [ ] Auditoría y Cierre Fiscal
```

1. **Show phase labels:**
   - captura → Captura de Comprobantes
   - clasificacion → Clasificación PCGE
   - conciliacion → Conciliación Bancaria
   - cierre → Cierre Contable Mensual
   - declaracion → Declaración SUNAT
   - auditoria → Auditoría y Cierre Fiscal
