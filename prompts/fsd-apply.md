---
description: Implement the next task from FSD task list
---
Implement one batch of tasks from the FSD task list.

## Process

1. **Read the task list** and identify the current batch.
2. **RED before every mutation:** Use record_receipt tool before data changes.
3. **Implement** following the design.
4. **Test** each change with compliance gates.
5. **Commit** with work-unit format: `feat(fiscal): {scope} - {description}`
6. **Mark task complete** and note next batch.

## RED Requirement

Every material data mutation MUST be preceded by a RED receipt via the record_receipt tool. This creates the immutable audit trail.
