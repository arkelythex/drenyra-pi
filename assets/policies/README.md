# Drenyra Pi — Operating Policies (v0.1)

The v0.1 operating policies of the evidence-driven accounting harness. Every
policy is a fail-closed rule: when the policy cannot be satisfied, the
protected operation does not run.

## Policy documents

| Document | Governs |
|----------|---------|
| [authority-policy.md](authority-policy.md) | Authority modes, agents, approvals, and the no-EXECUTE rule |
| [evidence-policy.md](evidence-policy.md) | Evidence citation, graph integrity, and model-output doctrine |
| [closed-period-policy.md](closed-period-policy.md) | Closed-period protection and corrections |
| [v0.1-boundary-policy.md](v0.1-boundary-policy.md) | The v0.1 non-goals and the explicitly denied post-v0.1 roadmap |

## Non-goals at a glance (v0.1)

- No autonomous filing with the Peruvian tax authority.
- No irreversible posting without explicit approval.
- No uncited interpretation without evidence.
- No material tax decision made by an LLM alone.
- No replacement of the responsible professional.
- No silent modification of closed periods.

See [v0.1-boundary-policy.md](v0.1-boundary-policy.md) for the full statements
and [REQ-SKPT-005] in the change specs for the requirement mapping.
