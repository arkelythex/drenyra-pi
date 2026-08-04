# assets/

Static operating assets for Drenyra Pi, shipped in the published package
(`files` includes `assets/`).

| Directory | Content |
|-----------|---------|
| `agents/` | Byte-for-byte mirrors of the seven agent definitions (REQ-AGENT-002) |
| `chains/` | Operator maps for the monthly-close, reconcile, verify, and evidence chains (REQ-SKPT-004) |
| `policies/` | Authority, evidence, closed-period, and v0.1 boundary policies (REQ-SKPT-005) |
| `schemas/` | Distributable JSON Schema mirrors of the scope, evidence, and authority contract families (REQ-SKPT-006) |

Conformance: `__tests__/assets.test.ts`.
