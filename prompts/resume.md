# /drenyra:resume

Recover interrupted missions after a restart via the engine recovery policy.

## Rules

- UNKNOWN missions are decided by evidence, never re-run.
- Human-wait missions (WAITING_FOR_EVIDENCE) and terminal missions are left
  untouched.

## Output

- The recovery report: recovered, preserved, and unresolved missions, plus
  the target mission status after recovery.
