# skills/

Packaged Drenyra skills shipped with the extension, declared via the
`pi.skills` manifest entry (REQ-SKPT-001).

| Skill | Focus |
|-------|-------|
| `scope-discipline` | Bind and verify the complete canonical scope; fail closed on mismatch or change |
| `evidence-citation` | Cite evidence-graph node ids; follow the source-to-action lineage; verify payload hashes |
| `chain-operation` | One EDA phase per continue; RUN/SKIP/WAIT; R2 approval plus receipts for execute |

Each skill carries real operational instruction — no stubs. Conformance:
`__tests__/content.test.ts` (SC-SKPT-004).
