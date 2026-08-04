# Evidence-Driven Accounting Harness — Specs

> Change: `evidence-driven-accounting-harness` · Status: **verified (PASS)** · Store: HYBRID (files authoritative)
> These specs define WHAT must be true after the change, per feature area. The verify phase
> validated requirement/scenario counts against these files and updated them (2026-08-04,
> evidence revision `a82a2c2`).

## Feature index

| Feature | Path | Requirements | Scenarios | Summary |
| --- | --- | --- | --- | --- |
| contracts | `specs/contracts/spec.md` | 8 | 5 | Four JSON-schema contract families (mission, evidence, authority, receipts) mirroring the pinned drenyra-ai types, with conformance tests and no-float-money rules |
| scope-binding | `specs/scope-binding/spec.md` | 9 | 6 | 10-element canonical scope, canonical encoding + SHA-256 scope hash, single-element-change invalidation, RUC check-digit and YYYYMM period validation, legacy compatibility |
| authority | `specs/authority/spec.md` | 9 | 6 | Four modes ASK < ANALYZE < PREPARE < EXECUTE, monotonic gating, explicit materiality derivation (never R0 default), R2 monthly-close gate, fail-closed gate pipeline |
| evidence-graph | `specs/evidence-graph/spec.md` | 8 | 5 | Provenance graph source→transformation→conclusion→action, payload hashes, evidence-citation rule, append-only per mission, id-sorted receipt hash binding |
| mission-protocol | `specs/mission-protocol/spec.md` | 10 | 6 | EDA 13-phase MissionStep[] sequence over the 15 engine states and 5 intents, runtime-decided next phase, one step per execute, durable stores, recovery, idempotency |
| commands | `specs/commands/spec.md` | 10 | 6 | 14 intended commands + legacy extras, scope guard before every command, thin handlers, one-step continue, receipt verify subcommand, resume recovery |
| chains | `specs/chains/spec.md` | 8 | 6 | Upgraded monthly close plus reconcile, verify, evidence chains; shared scope→mission→gate→receipt structure; bounded deterministic operations |
| agents | `specs/agents/spec.md` | 9 | 5 | Seven Pi markdown agents with scope guard, evidence-citation rule, broad-deny authority posture, refutation gate, persist-before-respond memory contract |
| skills-prompts-themes | `specs/skills-prompts-themes/spec.md` | 8 | 5 | 1–3 skills, persona + command prompts, one theme, real chain/policy/schema assets encoding the v0.1 non-goals, manifest conformance |

**Totals: 79 requirements · 50 scenarios** (recounted from spec files at verify: 79/79 and 50/50 PASS)

## Verify status (2026-08-04)

- **Verdict: PASS** — 79/79 requirements · 50/50 scenarios satisfied at evidence revision `a82a2c2`.
- Envelope: `gentle-ai.verify-result/v1` in `../verify-report.md` (requirements 79/79, scenarios 50/50, per-spec counts, test/build/package gate hashes).
- Gates: `bun test` 493/0 · `bun run typecheck` clean · `bun run build` OK · `node scripts/verify-package-files.mjs` OK · `node scripts/verify-packed-install.mjs` OK.
- Findings: 0 CRITICAL · 3 WARNING (W1 REQ-MISS-005 harness-op intent widening — design-sanctioned; W2 PR #7/#8 TDD evidence format; W3 GitHub PR numbering drift) · 2 SUGGESTION.
- All 9 domains verified PASS. Implementation tasks 31/31 complete; only parent-owned T-GATE-001..004 remain (archive half of T-GATE-004 pending).

## Notes for verify

- Each spec has countable `### Requirement:` (REQ-&lt;FEATURE&gt;-NNN) and `#### Scenario:` (SC-&lt;FEATURE&gt;-NNN) headings.
- All 9 domains are NEW (no canonical specs exist under `openspec/specs/`), so archive copies each into the canonical tree.
- Drenyra-ai engine names are verified against `node_modules/drenyra-ai@0.2.0` d.ts: 15 `AccountingMissionStatus` states (the engine doc comment still says 14 but the enum has 15), 5 `MissionIntent` values, `WaitReason` mapping (EVIDENCE/APPROVAL/POLICY_GATE/MANUAL_INTERVENTION/EXTERNAL_SYSTEM), `SignedReceipt`/`SigningKeyInfo` shapes.
- Verify phase confirmed the counts above match the spec files exactly (grep of `### Requirement:` / `#### Scenario:` headings across the 9 specs).
