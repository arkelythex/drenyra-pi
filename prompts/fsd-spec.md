---
description: Write a fiscal specification from an approved proposal
---
Write a detailed fiscal specification for an approved FSD proposal.

## Process

1. **Review the proposal** and extract acceptance criteria.
2. **Define fiscal rules:**
   - Tax base calculation (IGV 18%, detracción %, retención %)
   - SUNAT document series and UBL 2.1 structure
   - Accounting entries (debe/haber with PCGE accounts)
   - SIRE reconciliation requirements
3. **Define compliance gates:**
   - What must pass before this change is deployed?
   - What SUNAT/SIRE tests verify correctness?
4. **Define acceptance criteria** (must be testable).
5. **Link to normativa:** SUNAT resolution, Decreto Legislativo, etc.

## Output Format

```markdown
## FSD Spec: {title}

- **Source proposal:** {link}
- **Normativa:** {DL-xxx, RS-xxx}
- **RUCs:** {list}
- **Periods:** {list}

### Fiscal Rules
{detailed rules}

### Accounting Entries
{debe/haber}

### Compliance Gates
{gate list}

### Acceptance Criteria
{criteria list}
```
