# Capability conformance snapshot

This matrix is the point-in-time capability inventory for Drenyra Pi. It uses
concrete source and test evidence so public status claims can be checked without
treating the manifest as self-attestation.

`capability-manifest.yaml` is the machine-readable capability record; this matrix
and the narrative surfaces are projections of it. `bun run verify:capability`
reads every surface declared in the manifest's `currentProjection` and fails on a
contradicting capability state, verification level, or ownership, on disagreeing
current snapshot facts, on an unlabeled historical value, and on any claim that
grants Pi fiscal authority.

<!-- conformance:surface id=matrix authority=pi-operates-never-authorizes source=AGENTS.md#non-negotiable-rules -->
<!-- conformance:snapshot scope=current source=openspec/config.yaml#/current_test_state -->
<!-- conformance:snapshot scope=current source=capability-manifest.yaml#/evidenceSnapshot -->

Current snapshot facts are published in `openspec/config.yaml`
(`current_test_state`): exact command, complete result, evidence date, candidate
identity, and dirty-candidate classification. `capability-manifest.yaml`
(`evidenceSnapshot`) mirrors that same snapshot and delegates its identity to the
generated `program-lock-facts.json` candidate identity, because the manifest's own
bytes participate in that identity and restating it there would invalidate it.
This matrix restates none of those values, so it cannot drift from them.

> **Preserved historical snapshot identity — not the current dirty candidate:**
> `dirty-sha256:38ee713f27740b1dbdb43288a1a165d2d1e0bfb1ecbf805f1bb2fd0470464097`
> (evidence date: 2026-09-09). This was computed with
> `node scripts/compute-candidate-identity.mjs` after the README/ROADMAP and
> capability-manifest slices. The script covers its approved participation
> allowlist, not the full working tree, and therefore is not a full-tree receipt.
>
> **Preserved historical evidence baseline:**
> `dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c`
> with 47 test files / 717 passing / 0 failed. That independently verified run
> predates this documentation/manifest reconciliation and is preserved as a
> baseline rather than relabeled as a run of the final candidate.
>
> **Not evergreen:** status applies only to the identities and date above. Re-run
> the cited checks and publish a new snapshot after implementation evidence
> changes.

<!-- conformance:snapshot scope=historical identity=dirty-sha256:38ee713f27740b1dbdb43288a1a165d2d1e0bfb1ecbf805f1bb2fd0470464097 source=docs/architecture/capability-conformance-matrix.md -->
<!-- conformance:snapshot scope=historical identity=dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c result="47 test files / 717 passing / 0 failed" source=docs/architecture/capability-conformance-matrix.md -->

## How to read the levels

Each capability has exactly one verification level:

| Level | Meaning |
| --- | --- |
| `declared-only` | Named in documentation or the manifest, without cited source or test evidence. |
| `implemented` | Cited source exists, but no cited automated test establishes the capability behavior. |
| `unit-or-contract-tested` | A cited unit or contract test exercises the capability in isolation. |
| `validated-end-to-end` | A cited recorded run covers the full operational invocation path through observable output. |

This four-level scheme is Drenyra Pi's own synthesis of Kubernetes-style
evidence-gated readiness and Backstage-style manifest embedding. It is not a
1:1 copy of either standard. In-process fixtures count as unit or contract
evidence here; they do not establish operational end-to-end validation.

## Capability matrix

The Program reference column reuses the assignments already named in README's
Drenyra Dominion Program table; it is a program reference, not an ownership claim.
Ownership is `pi-local` for every row except `pinned-ai-runtime`, which is
`kernel-consumed`; no row is `referenced-only` or
`unavailable-operational-integration`, and no row is `validated-end-to-end`.

| Manifest capability | Program reference | Verification level | Checkable evidence | Authority boundary and limitation |
| --- | --- | --- | --- | --- |
| `persona-startup-panel` | SDD-020 | `unit-or-contract-tested` | `extensions/startup-panel.ts:48` (`showStartupPanel`); `extensions/fiscal-guard.ts:248` (`/drenyra:persona`); exact test: `__tests__/extension.test.ts` | Source and cited tests cover the panel registration surface; no live activation run exists, so this is not `validated-end-to-end`. |
| `drenyra-commands` | SDD-020 / SDD-030 / SDD-040 | `unit-or-contract-tested` | `extensions/register.ts:1147`; exact test: “registers the 15 intended commands plus company, context, install and sync (19 commands)” in `__tests__/extension.test.ts:312` (asserts 20 registered commands); routing-adapter `direct` modality: `lib/routing/direct-port.ts:80` (`createChainPipelineRoutingPort`), wired into `statusHandler` (`extensions/register.ts`); exact tests: `__tests__/routing/direct-port.test.ts` and “default /drenyra:status surfaces routing.preflight additively…” in `__tests__/extension.test.ts:798` | The test name is historical wording; its assertion and current surface are 20 commands. The routing adapter's `direct` modality is unit/contract-tested and wired into `/drenyra:status route` (not `validated-end-to-end`); `delegated` has no production port — an explicit, tracked follow-up (REQ-ROUTE-005), not silently omitted; `durable` has a production port (`lib/mission-commands.ts` `createDurableMissionRoutingPort`) but is not wired into any live command. |
| `pi-subagents` | SDD-030 | `unit-or-contract-tested` | `agents/README.md:15`; exact tests: “ships exactly the ten required roles under agents/” and “grants a read/query tool and never grants an execute tool (REQ-AGENT-005)” in `__tests__/agents.test.ts:119,149` | Ten Pi definitions are packaged; agents propose and analyze but do not authorize. |
| `model-routing` | SDD-030 | `unit-or-contract-tested` | `extensions/register.ts:540`; exact test: “registers drenyra:models with the documented model-routing registry” in `__tests__/extension.test.ts:281` | Advisory registry only; the Pi host exposes no model-routing authority API. |
| `packaged-skills` | SDD-070 (master, referenced-only) | `unit-or-contract-tested` | `skills/scope-discipline/SKILL.md:2`; exact tests: “ships at least the core fiscal skills” and “has real instructional content” in `__tests__/content.test.ts:121,126` | Packaged content is tested; the master-owned skills program remains external. |
| `rda-chains` | SDD-040 | `unit-or-contract-tested` | `chains/monthly-close.ts:1`, `chains/reconcile.ts:1`, `chains/verify.ts:1`, `chains/evidence.ts:1`; exact tests: “runs intake → evidence wait → evidence satisfaction → proposal → approval → receipt → export” (`chains/__tests__/monthly-close-flow.test.ts:109`), “wires real reconciliation into RECONCILE: a discrepancy manifest produces an anomaly conclusion node and an ERROR blocker (REQ-CHAIN-001)” (`chains/__tests__/monthly-close.test.ts`), “runs sources → real reconciliation anomaly → evidence → proposal → approval (incl. R2-gate negative case) → execution → close → verify” (`chains/__tests__/monthly-close-reconcile-flow.test.ts`), “detects anomalies as evidence conclusion nodes with payload hashes” (`chains/__tests__/reconcile.test.ts:138`), “reports per-check verdicts and completes the fixed check list (REQ-CHAIN-003)” (`chains/__tests__/verify.test.ts:106`), and “adds a source node with a canonical payload hash” (`chains/__tests__/evidence.test.ts:99`) | These are bounded, in-process fixtures, not a live operational E2E run. The monthly-close journey now invokes `chains/reconcile.ts`'s real `computeReconcileDifferences` inside its own RECONCILE phase instead of the prior no-op; the two-tier bank-movement/bank-statement confirmation model from `reconcile.ts` is intentionally not replicated here (tracked follow-up). |
| `tool-safety-broad-deny` | SDD-040 | `unit-or-contract-tested` | `agents/accounting-scout.md:20-23`; exact test: “grants a read/query tool and never grants an execute tool (REQ-AGENT-005)” in `__tests__/agents.test.ts:149` | Broad-deny agent tooling is tested; fiscal authority remains in the pinned Core. |
| `engram-integration` | SDD-080 (master, referenced-only) | `unit-or-contract-tested` | `runtime/context.ts:10-11` and `runtime/context.ts:225`; exact test: `__tests__/extension.test.ts` | Only a development-grade local JSON context store is evidenced. No executable Engram memory integration or operational E2E is claimed. |
| `pinned-ai-runtime` | SDD-020 | `unit-or-contract-tested` | `runtime/pin.ts:128`; exact test: “is released at v0.4.1 with the real entry-artifact checksum” in `__tests__/pin.test.ts:73` | Exact, package-local `drenyra-ai@0.4.1`; never `PATH`. |
| `configurator-install-doctor-sync` | SDD-020 | `unit-or-contract-tested` | `lib/configurator.ts:126,151,163`; exact tests: “reports all-ok configurator diagnostics after install (composition is current-schema)” and “is idempotent: a second install and a sync report unchanged with zero writes” in `__tests__/configurator.test.ts:105,174` | Legitimate pre-Wave-1 scaffolding that consumes the public configurator contract; not delivery of master SDD-020. |

No row is tagged `validated-end-to-end`: this snapshot has no live operational
run covering an installed Pi command through external services. In particular,
Engram remains incomplete and the monthly-close evidence is an in-process
fixture.

## Snapshot reconciliation

| Fact | Current statement | Evidence |
| --- | --- | --- |
| Current candidate snapshot | `bun test` → 767 passed / 0 failed (50 files), dirty candidate, 2026-09-11 | `openspec/config.yaml#/current_test_state`; identity delegated to `docs/architecture/program-lock-facts.json#/candidateIdentity` |
| Command surface | 20 registered commands | `extensions/register.ts:1147-1247`; `__tests__/extension.test.ts:312` |
| Runtime pin | `drenyra-ai@0.4.1` | `runtime/pin.ts:128`; `__tests__/pin.test.ts:73` |
| Contracts | Pi-local package/runtime and schema families are Frozen v0.1 | `contracts/README.md:3-14` |
| Monthly close | In-process fixture evidence only | `chains/__tests__/monthly-close-flow.test.ts:109` |
| Engram | Executable operational integration incomplete | `runtime/context.ts:10-11`; `capability-manifest.yaml` `engram-integration.limitation` |
| Manifest embedded test state | Preserved historical snapshot: 44 files / 700 passing, labeled `historical`. Not asserted as the live candidate | `capability-manifest.yaml` `testState.evidenceScope` + `evidenceSource`; do not conflate with the preserved 47/717 or 48/738 records |
| Generated lock-fact test evidence | Preserved historical snapshot: 48 files / 738 passing (2026-09-09), labeled `historical` | `docs/architecture/program-lock-facts.json` `snapshotRecord`; `openspec/changes/archive/2026-09-09-pi-accounting-orchestration/verify-report.md` |

## Machine-readable projection

Each capability row above is declared here so `bun run verify:capability` can
reject a projection that contradicts `capability-manifest.yaml`.

<!-- conformance:capability name=persona-startup-panel state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/persona-startup-panel -->
<!-- conformance:capability name=drenyra-commands state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/drenyra-commands -->
<!-- conformance:capability name=pi-subagents state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/pi-subagents -->
<!-- conformance:capability name=model-routing state=partial verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/model-routing -->
<!-- conformance:capability name=packaged-skills state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/packaged-skills -->
<!-- conformance:capability name=rda-chains state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/rda-chains -->
<!-- conformance:capability name=tool-safety-broad-deny state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/tool-safety-broad-deny -->
<!-- conformance:capability name=engram-integration state=partial verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/engram-integration -->
<!-- conformance:capability name=pinned-ai-runtime state=implemented verification=unit-or-contract-tested ownership=kernel-consumed source=capability-manifest.yaml#/capabilities/pinned-ai-runtime -->
<!-- conformance:capability name=configurator-install-doctor-sync state=implemented verification=unit-or-contract-tested ownership=pi-local source=capability-manifest.yaml#/capabilities/configurator-install-doctor-sync -->

## Legacy surface retention

Legacy capability surfaces, their known consumers, and their retention disposition are recorded in
[legacy-capability-surface-inventory.md](legacy-capability-surface-inventory.md).

Every candidate in that inventory is **retained**. This change deletes no legacy helper,
compatibility path, historical document, or archived artifact: removal requires a separately bounded
change that supplies a replacement or an explicit compatibility decision, package verification, and
focused regression evidence. Absent current wiring is not a removal proof.

## Deferred follow-ups

- Add executable Engram integration and an operational E2E run in a separate change.
- Formalize generator support so these matrix verification notes are derived
  rather than hand-maintained.
- Backfill controlled-vocabulary verification notes on the other nine manifest rows.
- Keep any full-tree receipt/tooling expansion separate; `program-lock-facts.json`
  and its candidate identity intentionally cover the approved allowlist only.
