# /drenyra:preflight — FSD pre-flight check

Runs the fail-closed pre-flight checks before any fiscal lifecycle work starts.
Satisfies the same guarantees as the packaged FSD prompts: nothing authorizes
fiscal operations; this command only reports readiness.

## What it checks

1. **Runtime** — the pinned Drenyra AI runtime resolves with a matching
   checksum (same fail-closed check as `/drenyra:doctor`).
2. **Scope** — the 10-element canonical scope is complete for the bound
   company/period (same gate as `/drenyra:scope`).
3. **Command surface** — the FSD flow prompts (`fsd-init`, `fsd-propose`,
   `fsd-spec`, `fsd-design`, `fsd-tasks`, `fsd-apply`, `fsd-verify`,
   `fsd-archive`) resolve from `prompts/`.

## Output

A short readiness report: `scope: bound|incomplete`, `runtime: ok|FAIL`, and
the list of missing scope elements when incomplete.

## Fails closed

- Missing or mismatched pinned runtime → `runtime: FAIL`.
- Incomplete canonical scope → `scope: incomplete` with the missing elements.
- A non-zero readiness condition never implies authority: the fiscal guard
  still rejects any operation that lacks an explicit, authorized scope.
