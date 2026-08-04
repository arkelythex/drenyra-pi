# chains/

Drenyra chains shipped with Drenyra Pi: the EDA chain implementations over
the durable mission stores, evidence graph, and shared chain pipeline.

| Chain | Intent | Behavior |
|-------|--------|----------|
| `monthly-close.ts` | monthly-close | Full 13-phase EDA close flow with R2 approval and signed close receipt |
| `reconcile.ts` | reconciliation | Ingest → normalize → reconcile → evidence-cited anomaly → proposal (never posts) |
| `verify.ts` | verify | Read-only integrity chain (source, equations, graph, scope, receipt) — never mutates |
| `evidence.ts` | evidence | Append-only add-node/add-edge + read-only query-node/query-lineage |

Operator maps ship under `assets/chains/` (REQ-SKPT-004). Tests:
`chains/__tests__/`.
