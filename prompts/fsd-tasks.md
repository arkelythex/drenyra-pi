---
description: Break a fiscal design into implementable tasks
---
Break an approved fiscal design into small, testable, reviewable tasks.

## Process

1. **Review design** and identify implementation units.
2. **Group by PR boundary:** Each chained PR gets its own task group.
3. **For each task:** What files change, what tests are needed, what gates apply.
4. **Estimate effort** per task (files, lines, complexity).
5. **Identify dependencies** between tasks.

## Task Format

```markdown
### PR 1: {title}
- [ ] Schema/migration: {description} ({files})
- [ ] Domain logic: {description} ({files})
- [ ] API endpoint: {description} ({files})
- [ ] Tests: {description} ({tests})
- [ ] Compliance: {gates to verify}

### PR 2: {title}
...
```
