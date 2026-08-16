---
name: ruc-scope
description: "Enforce tenant isolation by RUC in every fiscal operation: RUC-scoped queries, checksum validation, and cross-RUC authorization with audit logging. Use when writing or reviewing fiscal queries and endpoints."
---
    
# RUC Scope

Enforces tenant isolation by RUC in every fiscal operation.

## Rules

1. Every API query, mutation, job, seed, export, and test must be scoped by RUC
2. Never accept a RUC from user input without validating it belongs to the current organization
3. RUC checksum validation: use `sunat/ruc.ts` utilities
4. Queries must include `WHERE ruc = :ruc` or equivalent filter
5. Cross-RUC operations require explicit authorization and audit logging

## RUC Validation

- 11 digits, validated by SUNAT modulo-11 algorithm
- First digit: type (1=dni, 2=personal, 6=natural, 7=juridic, etc.)
- Last digit: checksum

## Rejected Patterns

```sql
-- ❌ No RUC filter
SELECT * FROM asientos;

-- ✅ Scoped by RUC
SELECT * FROM asientos WHERE ruc = :currentRuc;
```
