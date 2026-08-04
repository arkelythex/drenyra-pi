# agents/

Pi-native accounting subagents for Drenyra Pi (REQ-AGENT-001). Seven roles
ship as parseable markdown definitions with a shared fail-closed contract;
`assets/agents/` mirrors them byte-for-byte for the packaged artifact.

| Role | Authority ceiling | Reads | Persists |
| --- | --- | --- | --- |
| `accounting-scout` | ANALYZE | scope and source references | source inventory |
| `evidence-builder` | ANALYZE | mission and source references | graph node/edge requests |
| `ledger-analyst` | ANALYZE | normalized ledger references | cited analysis |
| `reconciliation-agent` | ANALYZE | ledger and bank references | reconciliation result |
| `tax-controller-pe` | ANALYZE | policy and evidence references | cited compliance findings |
| `anomaly-refuter` | ANALYZE | finding and cited lineage | refutation outcome |
| `close-controller` | PREPARE | mission/status/evidence references | close readiness package |

## Common contract

Every definition enforces: scope-first read and fail closed (REQ-AGENT-003),
evidence-node citation for every conclusion (REQ-AGENT-004), broad-deny
permissions with narrow allows and no EXECUTE mutation (REQ-AGENT-005), and
persist-before-respond with memory never granting authority (REQ-AGENT-006).
The anomaly-refuter attempts refutation before any finding is elevated
(REQ-AGENT-007). Conformance: `__tests__/agents.test.ts`.
