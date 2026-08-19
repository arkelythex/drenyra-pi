---
name: drenyra-chained-pr
description: "Trigger: chained-pr, chained pr, stacked prs, split pr, large pr, oversized, fiscal PR boundaries. Split large fiscal changes (>400 lines) into reviewable chained pull requests while preserving accounting integrity. Use when planning PR boundaries for fiscal/SUNAT/IGV changes, cierre mensual, or changes touching both schema and logic."
---
    
# Chained PRs for Fiscal Changes

Split large fiscal changes into reviewable PRs while maintaining
accounting integrity across the chain.

## When to Chain

- Fiscal/SUNAT/IGV changes > 400 lines
- Changes touching both schema AND logic
- Changes needing compliance review per PR
- Cierre mensual changes (R2/R3 risk)

## Chain Strategy: feature-branch-chain

PR #1 → PR #2 → ... → PR #n → main

Each PR targets the same feature branch so the full diff accumulates.
Reviewer reviews each PR independently, not the final merged diff.

## PR Boundaries for Fiscal Changes

| PR | Content | Risk | Review Lens |
|----|---------|------|-------------|
| 1 | Schema + migration | R0 | tenant-isolation |
| 2 | Domain logic + tests | R1 | ledger-integrity |
| 3 | API + integration | R1 | audit-trail |
| 4 | SUNAT/SIRE compliance | R2 | sunat-compliance |
| 5 | Docs + verification | R0 | readability |

## Usage

```bash
/fsd:propose  # Create proposal with PR boundaries
/fsd:tasks    # Break into PR-sized tasks
forecast_fiscal_review  # Estimate and check budget
```
