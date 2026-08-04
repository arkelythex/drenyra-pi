# assets/schemas/

Distributable JSON Schema copies of the authoritative contract families under
`contracts/` (REQ-SKPT-006). The harness ships these so consumers and packaged
operating content can validate scope-binding, evidence, and authority
envelopes without importing package internals.

## Layout

| Directory | Envelope | Schemas |
|-----------|----------|---------|
| `scope/` | Canonical scope binding | `scope-binding.schema.json`, `authority-mode.schema.json` |
| `evidence/` | Evidence graph records | `node.schema.json`, `edge.schema.json`, `graph.schema.json` |
| `authority/` | Authority records | `authority-mode.schema.json`, `scope-binding.schema.json`, `authorization-record.schema.json` |

## Authority

`contracts/` is the authoritative source. These files are byte-for-byte
mirrors; any change lands in `contracts/` first and is copied here.
