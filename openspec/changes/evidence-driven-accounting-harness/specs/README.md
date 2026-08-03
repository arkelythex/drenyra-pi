# Evidence-Driven Accounting Harness — Specs

> Change: `evidence-driven-accounting-harness` · Status: speced · Store: HYBRID (files authoritative)
> These specs define WHAT must be true after the change, per feature area. The verify phase
> later validates requirement/scenario counts against these files and updates them.

## Feature index

| Feature | Path | Requirements | Scenarios | Summary |
| --- | --- | --- | --- | --- |
| contracts | `specs/contracts/spec.md` | 8 | 5 | Four JSON-schema contract families (mission, evidence, authority, receipts) mirroring the pinned drenyra-ai types, with conformance tests and no-float-money rules |
| scope-binding | `specs/scope-binding/spec.md` | 9 | 6 | 10-element canonical scope, canonical encoding + SHA-256 scope hash, single-element-change invalidation, RUC check-digit and YYYYMM period validation, legacy compatibility |
| authority | `specs/authority/spec.md` | 9 | 6 | Four modes ASK < ANALYZE < PREPARE < EXECUTE, monotonic gating, explicit materiality derivation (never R0 default), R2 monthly-close gate, fail-closed gate pipeline |
| evidence-graph | `specs/evidence-graph/spec.md` | 8 | 5 | Provenance graph source→transformation→conclusion→action, payload hashes, evidence-citation rule, append-only per mission, id-sorted receipt hash binding |
| mission-protocol | `specs/mission-protocol/spec.md` | 10 | 6 | EDA 13-phase MissionStep[] sequence over the 14 engine states and 5 intents, runtime-decided next phase, one step per execute, durable stores, recovery, idempotency |
| commands | `specs/commands/spec.md` | 10 | 6 | 14 intended commands + legacy extras, scope guard before every command, thin handlers, one-step continue, receipt verify subcommand, resume recovery |
| chains | `specs/chains/spec.md` | 8 | 6 | Upgraded monthly close plus reconcile, verify, evidence chains; shared scope→mission→gate→receipt structure; bounded deterministic operations |
| agents | `specs/agents/spec.md` | 9 | 5 | Seven Pi markdown agents with scope guard, evidence-citation rule, broad-deny authority posture, refutation gate, persist-before-respond memory contract |
| skills-prompts-themes | `specs/skills-prompts-themes/spec.md` | 8 | 5 | 1–3 skills, persona + command prompts, one theme, real chain/policy/schema assets encoding the v0.1 non-goals, manifest conformance |

**Totals: 79 requirements · 50 scenarios**

## Notes for verify

- Each spec has countable `### Requirement:` (REQ-&lt;FEATURE&gt;-NNN) and `#### Scenario:` (SC-&lt;FEATURE&gt;-NNN) headings.
- All 9 domains are NEW (no canonical specs exist under `openspec/specs/`), so archive copies each into the canonical tree.
- Drenyra-ai engine names are verified against `node_modules/drenyra-ai@0.2.0` d.ts: 14 `AccountingMissionStatus` states, 5 `MissionIntent` values, `WaitReason` mapping (EVIDENCE/APPROVAL/POLICY_GATE/MANUAL_INTERVENTION/EXTERNAL_SYSTEM), `SignedReceipt`/`SigningKeyInfo` shapes.
