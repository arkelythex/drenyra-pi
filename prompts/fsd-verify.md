---
description: Verify implementation against fiscal spec
---
Verify that implemented changes satisfy the fiscal spec and compliance gates.

## Process

1. **Review spec** acceptance criteria.
2. **Run compliance gates:**
   - bun run compliance:sire-gate (if available)
   - bun run typecheck
   - bun run test -- packages/fiscal-*
3. **Check RED trail:** Every mutation has a receipt.
4. **Check RUC scope:** No cross-RUC leaks.
5. **Check money types:** No floats.
6. **Report findings:** PASS, WARNING, or FAIL per criterion.
