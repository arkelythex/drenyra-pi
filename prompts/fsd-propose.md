---
description: Propose a new fiscal obligation or accounting feature
---
Create a structured proposal for a fiscal obligation or accounting change.

## Process

1. **Identify the fiscal obligation:** IGV, detracción, retención, SIRE, PLAME, PDT, etc.
2. **Define scope:** What RUCs, periods, and document types are affected.
3. **Map current state:** How is this handled today (manual, automated, not handled)?
4. **Define target state:** What should change? What does success look like?
5. **Identify risks:** Compliance, audit, SUNAT rejection, data loss.
6. **Estimate effort:** Files, lines, fiscal tests needed.
7. **Propose delivery strategy:** Single PR or chained PRs?

## Output Format

```markdown
## FSD Proposal: {title}

- **Obligation:** {IGV/Detracción/SIRE/etc}
- **RUCs affected:** {list}
- **Periods affected:** {list}
- **Risk tier:** {R0-R3}
- **Current state:** {summary}
- **Target state:** {summary}
- **Risks:** {list}
- **Estimate:** {files}/{lines}
- **Strategy:** {single-pr | chained-prs}
```
