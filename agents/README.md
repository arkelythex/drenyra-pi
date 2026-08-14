# agents/

Pi-native accounting subagents for Drenyra Pi (REQ-AGENT-001). Ten roles ship
as parseable markdown definitions with a shared fail-closed contract;
`assets/agents/` mirrors them byte-for-byte for the packaged artifact.

The seven **Design 03 ecosystem roles** (approved in `drenyra-ai/docs/design/design-03-agents-skills-integrations.md`)
have a direct Pi counterpart and return the allowed result the design fixes;
the three **Pi work agents** support the harness with bounded analysis work.
Every agent proposes or analyzes — the deterministic Core is the only
component able to accept a transition.

| Role | Ecosystem role (Design 03) | Authority ceiling | Reads | Persists |
| --- | --- | --- | --- | --- |
| `accounting-scout` | — (Pi work agent) | ANALYZE | scope and source references | source inventory |
| `evidence-builder` | Evidence Agent | ANALYZE | mission and source references | graph node/edge requests |
| `ledger-analyst` | — (Pi work agent) | ANALYZE | normalized ledger references | cited analysis |
| `reconciliation-agent` | Reconciliation Agent | ANALYZE | ledger and bank references | reconciliation result |
| `tax-controller-pe` | Compliance Agent | ANALYZE | policy and evidence references | cited compliance findings |
| `anomaly-refuter` | — (Pi work agent) | ANALYZE | finding and cited lineage | refutation outcome |
| `close-controller` | Close Coordinator | PREPARE | mission/status/evidence references | close readiness package |
| `invoice-sire-agent` | Invoice/SIRE Agent | ANALYZE | vouchers, ERP, and SIRE references | exceptions and candidates |
| `journal-candidate-agent` | Journal Candidate Agent | PREPARE | ledger, reconciliation, and source references | candidate journal entries |
| `guardian-angel` | Guardian Angel | ANALYZE | package, evidence, and candidate references | findings — never approval |

## Design 03 result contract

Every ecosystem-role agent returns the **allowed result** the design fixes —
evidence manifest, exceptions and candidates, explained differences, candidate
journal entries, compliance findings, close plan — as a **known schema**.
Free text may accompany the explanation but never replaces structured values,
references, hashes, or states (REQ-AGENT-004). Candidate values are whole-number
BigInt cents; no float is ever used for money.

## Common contract

Every definition enforces: scope-first read and fail closed (REQ-AGENT-003),
evidence-node citation for every conclusion (REQ-AGENT-004), broad-deny
permissions with narrow allows and no EXECUTE mutation (REQ-AGENT-005), and
persist-before-respond with memory never granting authority (REQ-AGENT-006).
The anomaly-refuter attempts refutation before any finding is elevated
(REQ-AGENT-007). Conformance: `__tests__/agents.test.ts`.
