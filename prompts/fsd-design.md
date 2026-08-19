---
description: Design the implementation for a fiscal spec
---
Design the technical implementation for an approved fiscal spec.

## Process

1. **Review spec** for fiscal rules and acceptance criteria.
2. **Design data structures:** PCGE accounts, document types, SUNAT fields.
3. **Design API surface:** Input/output contracts with tenant scope.
4. **Design tests:** Unit tests, compliance tests, SIRE repro tests.
5. **Identify risks:** Performance, SUNAT rejection, data integrity.
6. **Phase boundaries:** What goes in PR 1, PR 2, PR 3?

## Design Checklist

- [ ] Money values use BigInt (cents), never floats
- [ ] RUC scope in every query/mutation
- [ ] Immutable audit log for mutations
- [ ] SUNAT document series validation
- [ ] IGV calculation deterministic (base x 0.18)
- [ ] Estate boundaries for period closure
