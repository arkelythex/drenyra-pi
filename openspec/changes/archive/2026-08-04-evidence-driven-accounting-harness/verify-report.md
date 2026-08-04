```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:49b3a58aaad4fe5cad381ae280cb1a863a9900796c112af944bc71a71566a55e
verdict: pass
blockers: 0
critical_findings: 0
warning_findings: 3
suggestion_findings: 2
requirements: 79/79
scenarios: 50/50
per_spec:
  contracts: { requirements: 8/8, scenarios: 5/5 }
  scope-binding: { requirements: 9/9, scenarios: 6/6 }
  authority: { requirements: 9/9, scenarios: 6/6 }
  evidence-graph: { requirements: 8/8, scenarios: 5/5 }
  mission-protocol: { requirements: 10/10, scenarios: 6/6 }
  commands: { requirements: 10/10, scenarios: 6/6 }
  chains: { requirements: 8/8, scenarios: 6/6 }
  agents: { requirements: 9/9, scenarios: 6/6 }
  skills-prompts-themes: { requirements: 8/8, scenarios: 5/5 }
test_command: bun test
test_exit_code: 0
test_output_hash: sha256:ce1eeda57b7815f31b071621d803f9ea8ea6a9bd30043fa9bf9d3f2ffc9ade8f
typecheck_command: bun run typecheck
typecheck_exit_code: 0
typecheck_output_hash: sha256:1383d3b3e514b0940d50f6b0e77596f839420a9680372de8c536ec57c0ce6e98
build_command: bun run build
build_exit_code: 0
build_output_hash: sha256:627d23ef6f9b2d3ee904fad69af3c60a8fac8899a4657fbfd54343ce9cfa4829
package_files_command: node scripts/verify-package-files.mjs
package_files_exit_code: 0
package_files_output_hash: sha256:7dfe1e3d42b0e141b97711630dea14a6727410df52ed2cade5e4cf8c15f72895
packed_install_command: node scripts/verify-packed-install.mjs
packed_install_exit_code: 0
packed_install_output_hash: sha256:074f0433c164b2baf9aa826ef50a89c013e27f64fa06f8b2b86a76bb0c8b53e1
```

# EVIDENCE-DRIVEN-ACCOUNTING-HARNESS — Verification Report

**Change**: `evidence-driven-accounting-harness`
**Repo**: `drenyra-pi` (Bun + TS ESM, vitest, Pi extension package, pinned `drenyra-ai@0.2.0` vendored)
**Evidence revision**: `a82a2c2b3b4759ae6ee452d076929c32e52390a6` (main HEAD; tree clean)
**Date**: verify phase (post-apply, all slices S1..S6 merged)
**Artifact store**: hybrid (openspec/ authoritative; engram best-effort)
**Status**: **PASS — 79/79 requirements · 50/50 scenarios verified with real commands**

---

## 1. Envelope summary

| Field | Value |
| --- | --- |
| verdict | pass |
| blockers | 0 |
| critical findings | 0 |
| requirements | 79/79 (recounted from spec files, matches README claim) |
| scenarios | 50/50 (recounted from spec files, matches README claim) |
| evidence revision | `sha256:49b3a58a…` over commit `a82a2c2` |

The requirement/scenario counts were **recounted directly from the 9 spec files** (not copied from the README): `grep -c '^### Requirement:'` and `grep -c '^#### Scenario:'` per spec — totals 79/50, matching `specs/README.md`.

## 2. Gates — real command results

| Gate | Command | Result | Hash (sha256) |
| --- | --- | --- | --- |
| Tests | `bun test` | ✅ 493 pass / 0 fail, 2224 expect() calls, 29 files | `ce1eeda5…` |
| Typecheck | `bun run typecheck` | ✅ clean (tsc strict, noEmit, exit 0) | `1383d3b3…` |
| Build | `bun run build` | ✅ emits dist (exit 0) | `627d23ef…` |
| Package files | `node scripts/verify-package-files.mjs` | ✅ OK (dist tree + packaged files complete) | `7dfe1e3d…` |
| Packed install | `node scripts/verify-packed-install.mjs` | ✅ OK (clean-dir install, pi manifest + factory resolve, postinstall verified) | `074f0433…` |

All five gates green at evidence revision `a82a2c2`. The 493-test claim matches the parent brief exactly.

## 3. Structured status consumed

```yaml
schemaName: spec-driven
changeName: evidence-driven-accounting-harness
artifactStore: both            # openspec/ dir exists -> authoritative; engram best-effort
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: done, verifyReport: done }
taskProgress: { total: 31 implementation-owned, complete: 31, remaining: 0, unchecked: [] }
deferredParentActions: { total: 4 (T-GATE-001..004), complete: 0, remaining: 4 }
actionContext:
  mode: repo-local
  workspaceRoot: /home/dreamcoder08/Documents/PROYECTOS/drenyra-pi
  allowedEditRoots: [workspace root]   # no warnings
nextRecommended: archive (T-GATE-004 verify half done here; archive owned by parent/orchestrator)
```

## 4. Per-spec verification (all 9 domains)

### 4.1 contracts — 8/8 REQ · 5/5 SC — PASS

- 15 versioned schemas across 4 families: `contracts/mission/` (4: status/step/snapshot/event), `contracts/evidence/` (3: node/edge/graph), `contracts/authority/` (3: authority-mode/scope-binding/authorization-record), `contracts/receipts/` (5: receipt-content/signed-receipt/receipt-binding/signing-key-info/trusted-key-registry).
- `signed-receipt.schema.json` top-level keys verified against REQ-CONTRACTS-004 field-for-field: `protocolVersion, receiptType, algorithm (const "Ed25519"), content, receiptHash, signerKeyId, signerPublicKey, signature, issuedAt`. ✅
- 15-state enum present in `contracts/mission/status.schema.json` (doc comment notes the outdated "14" engine comment). ✅
- Conformance suite `__tests__/contracts.test.ts` (24 tests) validates engine-built receipts (SC-CONTRACTS-004), tampered rejection (SC-CONTRACTS-005), no-float-money rules (REQ-CONTRACTS-008; floats rejected at schema boundary). ✅
- Consumer-only discipline (REQ-CONTRACTS-006): no deep imports of engine internals — verified in lib/ imports (`/missions`, `/gates`, `/receipts`, `/candidates`, `/ledger`, `/review`, `/recovery` public subpaths only).

### 4.2 scope-binding — 9/9 REQ · 6/6 SC — PASS

- 10-element canonical scope confirmed (`CANONICAL_SCOPE_ELEMENTS` in `runtime/context.ts`). ✅
- RUC check-digit and period validation: `isValidPeriod("202507")===true` / `isValidPeriod("202513")===false` tested (SC-SCOPE-003); RUC check-digit tests (SC-SCOPE-001/002). ✅
- Golden-bytes canonicalization + lowercase-hex sha-256 scopeHash (`lib/canonicalization.ts`; 21 golden/edge tests incl. 10 single-field mutations → 10 distinct hashes, SC-SCOPE-004). ✅
- Legacy company/period loads canonically, incomplete until 8 remaining elements bound (SC-SCOPE-006); scope-change invalidation in authority-store + scope-guard stale-hash paths (REQ-SCOPE-006, SC-SCOPE-005). ✅
- Binding carries `scopeHash` into authorization records and signed receipt content via `payloadHash = sha256Canonical(binding)` with a verify-chain digest check (REQ-SCOPE-008). ✅
- Fail-closed incomplete scope: `bindScope` rejects missing/invalid elements before any write; `/drenyra:close` and all scope-requiring commands fail closed (REQ-SCOPE-009). ✅

### 4.3 authority — 9/9 REQ · 6/6 SC — PASS

- Four modes `ASK < ANALYZE < PREPARE < EXECUTE` (`AUTHORITY_ORDER`), monotonicity asserted via `assertMonotonicAuthority` (REQ-AUTH-001/002; SC-AUTH-001, 005). ✅
- `deriveRequiredMateriality` calls engine `deriveMateriality` with explicit value/reversibility/jurisdiction, throws on missing input, `minimum` floor (monthly-close → R2) — R0 default unreachable (REQ-AUTH-004/005; SC-AUTH-002). ✅
- Fixed-order `runAuthorityPipeline` scope → mode → materiality → mission → approval → receipt, first non-allowed stops; `trustedKeys: []` blocks at receipt stage (tests at `__tests__/authority-gates.test.ts:313-323`) (REQ-AUTH-008; SC-AUTH-004). ✅
- Command-family capability matrix exposed via `renderCapabilitiesView` and enforced per handler through the scope guard + coordinator authority-bound advance (REQ-AUTH-007). ✅
- No implicit escalation: read-only/pre-scope commands produce no mutation; PREPARE produces candidates only; EXECUTE gated by approval/evidence/receipt (REQ-AUTH-006/009). ✅
- Bound-level change invalidation via scope-hash binding (REQ-AUTH-003; SC-AUTH-006). ✅

### 4.4 evidence-graph — 8/8 REQ · 5/5 SC — PASS

- Four node kinds + DERIVED_FROM/SUPPORTS/EXECUTES edges, full lineage traversal (REQ-EVID-001/002; SC-EVID-001). ✅
- Canonical payload sha-256 hashes (BigInt-safe) per node; tamper detection identifies the node (REQ-EVID-003/008; SC-EVID-003). ✅
- Citation rule enforced at append (uncited conclusion rejected; REQ-EVID-004; SC-EVID-002). ✅
- Append-only per mission with byte-identical replay; in-place mutation/removal rejected (REQ-EVID-005; SC-EVID-004). ✅
- Receipt evidence hash via engine id-sorted `computeEvidenceHash` (dedupe by id, insertion-order stable; REQ-EVID-006; SC-EVID-005). ✅
- Action traceability: every action references a supporting conclusion; terminal-position guards (REQ-EVID-007). ✅

### 4.5 mission-protocol — 10/10 REQ · 6/6 SC — PASS

- 13-phase ordered `EDA_PHASE_ORDER` (intake → … → archive) shipped in every mission (`createEdaSteps`; REQ-MISS-001; SC-MISS-001 basis). ✅
- Missions driven through the pinned engine enum only (15 states); schema mirrors the installed enum; transitions validated by the engine (REQ-MISS-002; SC-MISS-002 engine-rejected). ✅
- Next phase derived from persisted state via engine predicates (`isRunnable/isResumable/isAwaitingApproval/waitReasonFor`) — `derivePreparedStep` returns RUN/SKIP/WAIT/null from snapshot only (REQ-MISS-003). ✅
- Exactly one protocol-legal step per continue/run; null when no step legal; no continue-all (REQ-MISS-004). ✅
- Accounting missions scoped to the 5 canonical intents (REQ-MISS-005) — see W1 for the harness-op-chain widening. ✅ (with WARNING)
- Durable `MissionStore/MissionEventStore/IdempotencyStore` adapters with atomic writes (temp + fsync + rename), versioned schema v1, no deep-import of `MissionFileStore` (REQ-MISS-006). ✅
- `recoverDurableMissions` per engine recovery policy: in-flight → UNKNOWN, evidence-decided, human-wait untouched, terminal never replayed (REQ-MISS-007; SC-MISS-003). ✅
- Idempotent replay returns cached result; conflicting keys raise IdempotencyConflict (REQ-MISS-008; SC-MISS-004). ✅
- WAITING_FOR_EVIDENCE / BLOCKED_BY_GATE never auto-advanced (REQ-MISS-009; SC-MISS-005/006). ✅
- Full `MissionSnapshot` fields persisted/rehydrated (REQ-MISS-010). ✅

### 4.6 commands — 10/10 REQ · 6/6 SC — PASS

- 16 commands registered (`register.ts`): 14 intended (status, doctor, capabilities, scope, period, mission, continue, reconcile, close, evidence, verify, receipt, resume, models) + legacy company, context (REQ-CMD-001/002; SC-CMD-001). ✅
- Scope guard before every command: `COMMAND_SCOPE_POLICY` 8 pre-scope (status/doctor/capabilities/scope/company/period/context/models) + 8 requires-scope (mission/continue/resume/close/reconcile/evidence/verify/receipt), unknown defaults to requires-scope (REQ-CMD-003; SC-CMD-002). ✅
- Thin handlers: parse → scope policy → lib/chain delegate → render; no accounting/fiscal logic in handlers (REQ-CMD-004). ✅
- One-step continue, no continue-all (REQ-CMD-005; SC-CMD-003). ✅
- `/drenyra:receipt verify <id>` local verification matrix: content/signature/trusted/in-currency + tampered/unknown-signer/expired/revoked rejection (REQ-CMD-006; SC-CMD-004/005). ✅
- `/drenyra:resume` recovers UNKNOWN via engine policy, leaves human-wait/terminal untouched (REQ-CMD-007; SC-CMD-006). ✅
- Structured machine output + human summary on every command (REQ-CMD-008). ✅
- Status view: company/period, active mission + next authorized action, linked sources, pending reconciliations, anomalies, approvals (REQ-CMD-009). ✅
- Capabilities view: engine `getCapabilities()` + authority modes + registered commands + 10 scope elements (REQ-CMD-010). ✅

### 4.7 chains — 8/8 REQ · 6/6 SC — PASS

- Monthly-close upgraded: durable stores, real proposal evidence binding (no hardcoded hash), WAITING_FOR_EVIDENCE/BLOCKED_BY_GATE handling, full 12-step fixture flow with export artifact (REQ-CHAIN-001; SC-CHAIN-001, 004). ✅
- Reconcile chain: ingest → normalize → reconcile → anomaly detection → evidence wait → evidence-cited proposal; no posting (REQ-CHAIN-002; SC-CHAIN-002, 005). ✅
- Verify chain: source-integrity, normalization, ledger equations, reconciliation-correctness, graph-integrity, scope-binding, receipt-binding checks with per-check verdicts, first-failure stop, read-only (REQ-CHAIN-003; SC-CHAIN-003). ✅
- Evidence chain: add/query nodes+edges with lineage rules and citation enforcement, bound to the mission (REQ-CHAIN-004; SC-CHAIN-006). ✅
- Shared `runChainStep`/`executePreparedStep` structure scope → mission → gates → receipt, fail closed at first failing stage (REQ-CHAIN-005). ✅
- Bounded deterministic operations: no floats (BigInt cents at boundary), no ambient PATH lookup, no unbounded loops (REQ-CHAIN-006). ✅
- Signed completion receipts bound to mission, evidence hash, scope hash, executed target (REQ-CHAIN-007). ✅
- Baseline preservation: 54 original tests still green inside the 493-suite; chain tests/docs colocated under `chains/` (REQ-CHAIN-008). ✅

### 4.8 agents — 9/9 REQ · 5/5 SC — PASS

- Exactly 7 agents under `agents/`: accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller (REQ-AGENT-001). ✅
- All parseable Pi markdown (valid frontmatter + body); byte-for-byte mirrors under `assets/agents/` verified with `cmp` (REQ-AGENT-002; SC-AGENT-001). ✅
- Common contract in every body: scope-first read + fail closed (REQ-AGENT-003), evidence citation (REQ-AGENT-004; SC-AGENT-003), broad-deny/narrow-allow + authority ceiling frontmatter (REQ-AGENT-005/008), persist-before-respond (REQ-AGENT-006; SC-AGENT-005), refutation-before-elevation for anomaly-refuter (REQ-AGENT-007; SC-AGENT-004). ✅
- Agents included in `verify-package-files.mjs` manifest/shipped-file checks (REQ-AGENT-009). ✅
- 59-test `__tests__/agents.test.ts` conformance suite green. ✅

### 4.9 skills-prompts-themes — 8/8 REQ · 5/5 SC — PASS

- 3 skills with real instructional content: scope-discipline, evidence-citation, chain-operation (no stubs; REQ-SKPT-001; SC-SKPT-004). ✅
- persona.md + 14 command prompts (status/doctor/capabilities/scope/period/mission/continue/reconcile/close/evidence/verify/receipt/resume/models) — verified filename set matches the 14 intended commands exactly; no unregistered command refs (REQ-SKPT-002; SC-SKPT-005). ✅
- Exactly one theme `themes/fiscal-operator/` with manifest.json + light/dark variants (REQ-SKPT-003; SC-SKPT-003). ✅
- Real chain assets `assets/chains/` (monthly-close, reconcile, verify, evidence) (REQ-SKPT-004). ✅
- Policy assets `assets/policies/` encode the v0.1 non-goals; `__tests__/assets.test.ts` asserts each non-goal maps to an explicit statement (REQ-SKPT-005/008; SC-SKPT-002). ✅
- Schema assets `assets/schemas/` mirror scope/evidence/authority envelopes (REQ-SKPT-006). ✅
- Manifest conformance: pi.prompts/pi.skills/pi.themes resolve; verify-package-files checks the asset tree (REQ-SKPT-007; SC-SKPT-001 via the script runs). ✅

## 5. Strict TDD compliance (strict_tdd: true)

| Check | Result | Details |
| --- | --- | --- |
| TDD evidence reported | ✅ | Per-PR TDD Cycle Evidence tables in `apply-progress.md` (PR #1–#6, #9 full RED/GREEN/TRIANGULATE/REFACTOR tables; PR #7/#8 condensed evidence bullets — see W2) |
| All tasks have tests | ✅ | 31/31 implementation tasks map to named test files that exist in the codebase |
| RED confirmed (tests exist) | ✅ | All reported test files verified present and green on execution |
| GREEN confirmed | ✅ | 493/493 pass at evidence revision |
| Triangulation adequate | ✅ | Reported case counts match spec scenario breadth (e.g. 20-case mode×family matrix, 28-case graph suite, 24-case contract suite) |
| Safety net for modified files | ✅ | Baseline preserved at every PR (54 → 111 → 180 → 211 → 284 → 317 → 345 → 373 → 391 → 493) |
| Assertion quality | ✅ | No tautologies, no ghost loops (0 forEach-assert loops), no mocks (0 `vi.mock`), 37 `toBeDefined()`/2 `toBeTruthy()` uses all paired with value assertions in the same test (sampled) |

**TDD Compliance: 6/6 checks passed** (W2 documents the PR #7/#8 evidence-format variance).

**Test layer distribution**: Unit/conformance 461 across 24 files · Integration 32 across 5 files (extension/chain over real durable stores + real engine-signed receipts). Coverage tool: not configured — coverage analysis skipped, not a failure.

## 6. Review workload / PR boundary findings

- **All slices implemented**: S1..S6 complete. Implementation tasks 31/31 checked (`tasks.md`). Only parent-owned gates T-GATE-001..004 remain unchecked (T-GATE-004's verify half is this phase; archive remains parent-owned).
- **Delivery**: 14 GitHub merges landed on main (#6..#20, **PR #17 never merged**) — see W3. All 9 apply batches (S1..S6) are present in the history; S1 (contracts + scope + canonicalization) rode inside PR #6 (`fix/vendor-drenyra-ai`) as commits `72f7ef1` + `9eb4322`.
- **Scope creep**: none found — implemented scope matches the 9 feature areas and the task list; post-v0.1 content (SIRE, AP/AR, monthly taxes, continuous audit) explicitly out of scope and denied in policy assets.
- **Review workload**: every apply batch exceeded the 400-line review budget and was recorded in apply-progress (chained-pr discipline); all size notes were escalated to the parent at apply time as instructed.

## 7. Findings

### CRITICAL (0)

None.

### WARNING (3)

- **W1 — REQ-MISS-005 letter deviation: harness-op chain intents (design-sanctioned).** The verify and evidence chains run their own missions through the shared pipeline with harness-only intents (`verify`, `evidence`; `EdaIntent = MissionIntent | HarnessIntent`), cast to `MissionIntent` at the engine boundary (`chain-pipeline.ts:531`). The engine accepts the strings at runtime (verified by green integration tests against the real engine). The 5 canonical intents remain the exclusive accounting-mission intents (monthly-close, correction, reconciliation, invoice-review, compliance-check) and all 13-phase accounting flows use them. This was explicitly design-sanctioned (§11.4/§11.5) and documented in apply-progress PR #8 deviations. No accounting mission violates REQ-MISS-005.
- **W2 — TDD evidence format variance for PR #7/#8.** S5a/S5b apply records used condensed `**TDD evidence:**` bullets (RED test-first, fixes, gate results) instead of the full RED/GREEN/TRIANGULATE/REFACTOR tables used by PR #1–#6/#9. Evidence content is present and independently verified (test files exist and pass); only the table format differs. Recommended: convert to the standard table at archive for consistency.
- **W3 — PR numbering/branch-name drift vs plan.** The parent brief's "15 merged PRs (#6..#20)" maps to 14 merges on main; GitHub PR #17 has no merge commit. Branch names also drifted from apply-progress's slice labels (e.g. GitHub #11 `eda/s4a-evidence-graph` carried S3b evidence-graph content; GitHub #16 `eda/s7a-chain-pipeline` carried the S5a reconcile chain). All content is present and green; this is a naming/bookkeeping inconsistency only.

### SUGGESTION (2)

- **S1 — `openspec/config.yaml` `current_test_state` is stale.** It records the pre-change baseline (54 tests / 8 files) while the suite is now 493/29. Informational; refresh at archive.
- **S2 — Literal requirement-ID references absent for 6 REQ / 4 SC in test text.** Behavioral coverage was confirmed for every one (e.g. `isValidPeriod("202513")` for REQ-SCOPE-003, `trustedKeys: []` receipt-stage block for SC-AUTH-004, engine-validated transitions for SC-MISS-002, script runs for SC-SKPT-001). Adding the ID to the test titles would make coverage machine-auditable.

### Accepted design-sanctioned deviations (S5a/S5b, evaluated — none violate a spec requirement)

| Deviation | Spec evaluation |
| --- | --- |
| Read-only ceremony exemption (verify chain archive completes as a state record; EXECUTE-family ceremony `not_applicable` for `readOnly` chains) | No violation: REQ-CHAIN-003 mandates read-only verify; REQ-AUTH-009 forbids mutation — satisfied. |
| SKIP-before-gates branch (deterministic no-op ceremony phases never evaluate materiality/approval/receipt) | No violation: gates apply to acting phases only; SKIP derives from persisted state, is deterministic, and writes no action. |
| EdaIntent widening | W1 above. |
| Steady-state phase-only advancement (PROGRESS_UPDATE events; no fabricated engine state transition) | No violation: REQ-MISS-002 transitions remain engine-validated (same-status transitions throw in the pinned engine — verified); REQ-MISS-004 one-step-per-execute holds (phase-only is one step). Design §4.1 sanctions. |
| Receipt `payloadHash = sha256Canonical(binding)` binding | No violation — strengthens REQ-SCOPE-008: verify chain checks `sha256Canonical(binding) === receipt.content.payloadHash` (`chains/verify.ts:590`). |

## 8. Task completion status

- **Implementation tasks**: 31/31 `- [x]` in `tasks.md` (T-S1-001..005, T-S2-001..005, T-S3A-001..003, T-S3B-001..004, T-S4A-001..004, T-S4B-001..004, T-S5A-001..002, T-S5B-001..003, T-S6-001..004).
- **Unchecked lines**: none among implementation-owned tasks. The only remaining `- [ ]` rows are parent-owned lifecycle gates (`<!-- sdd-owner: parent -->`):
  - `- [ ] **T-GATE-001 — Confirm delivery boundary and chain strategy before apply.**` (completed in practice — chain strategy `stacked-to-main` confirmed and 14 merges landed; checkbox not reconciled)
  - `- [ ] **T-GATE-002 — Per-PR bounded review and delivery.**` (parent-owned, per-PR)
  - `- [ ] **T-GATE-003 — Chain context and PR shape.**` (parent-owned, per-PR)
  - `- [ ] **T-GATE-004 — Final verify and archive.**` (verify half completed by this phase; archive remains)
- Archive readiness: this verify phase is complete with a PASS verdict; T-GATE-004's archive half (and checkbox reconciliation of T-GATE-001..004) belongs to the parent/orchestrator.

## 9. Artifact spot-checks (concrete claims vs disk)

| Claim | Result |
| --- | --- |
| 15 contract schemas | ✅ 15 (`mission` 4, `evidence` 3, `authority` 3, `receipts` 5) |
| 11 `lib/` modules | ✅ accounting-status, authority-gates, authority-store, canonicalization, chain-pipeline, evidence-graph, mission-commands, mission-store, receipt-store, receipt-verification, trusted-key-registry |
| 4 chains | ✅ `chains/{monthly-close,reconcile,verify,evidence}.ts` |
| 7 agents + mirrors | ✅ 7 files, `cmp`-verified byte-for-byte under `assets/agents/` |
| 3 skills | ✅ `skills/{scope-discipline,evidence-citation,chain-operation}/SKILL.md` |
| 15 prompts | ✅ persona.md + 14 command prompts (set matches the 14 intended commands exactly) |
| One theme | ✅ `themes/fiscal-operator/` with manifest.json + light/dark variants |
| Extension surface | ✅ 16 `pi.registerCommand` calls; descriptor `commands`/`provides` lists |
| Entrypoint | ✅ `pi.extensions = ["./dist/extensions/register.js"]`, asserted by verify-package-files |
| Baseline preserved | ✅ original suites (context, extension, chains) green inside the 493 |

## 10. Next step

`archive` — all 9 specs verified PASS, all implementation tasks complete, all gates green at `a82a2c2`. Parent-owned T-GATE-004 archive half remains (plus checkbox reconciliation of T-GATE-001..004 and the S1/S2 suggestions).
