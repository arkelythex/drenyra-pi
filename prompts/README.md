# prompts/

Operator prompts bundled with Drenyra Pi, declared via the `pi.prompts`
manifest entry (REQ-SKPT-002).

| File | Purpose |
|------|---------|
| `persona.md` | Operator persona for the evidence-driven accounting harness |
| `status.md` | Runtime + scope + mission projection |
| `doctor.md` | Fail-closed runtime doctor |
| `capabilities.md` | Engine + harness capabilities |
| `scope.md` | Read/bind the 10-element canonical scope |
| `period.md` | Fiscal period context |
| `mission.md` | Start an EDA mission |
| `continue.md` | Advance exactly one EDA phase |
| `reconcile.md` | Reconciliation chain |
| `close.md` | Monthly close with R2 approval |
| `evidence.md` | Evidence graph operations |
| `verify.md` | Read-only integrity verify chain |
| `receipt.md` | Receipt show/verify |
| `resume.md` | Recovery of interrupted missions |
| `models.md` | Model-routing capability registry |

Prompts instruct; they never bypass runtime checks. Conformance:
`__tests__/content.test.ts` (every intended command has a prompt; no prompt
references an unregistered command — SC-SKPT-005).
