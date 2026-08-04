# /drenyra:continue

Advance the active mission EXACTLY ONE EDA phase per invocation.

## Rules

- The runtime decides the next step (RUN / SKIP / WAIT) from persisted state.
- WAIT states (evidence, approval, gate) never auto-advance.
- There is no continue-all path. Repeat the command to advance phase by
  phase.

## Output

- The phase completed, the mission status and version, and the next prepared
  step or wait reason. Structured JSON plus a human summary.
