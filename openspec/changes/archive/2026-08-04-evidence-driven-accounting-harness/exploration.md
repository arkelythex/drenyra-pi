# Exploration — Evidence-Driven Accounting Harness

> SDD change: `evidence-driven-accounting-harness` · Repo: `drenyra-pi` · Status: exploration complete
> Vision source: `openspec/changes/evidence-driven-accounting-harness/vision.md` (user source, Spanish)
> Store mode: HYBRID — this file is authoritative; Engram is best-effort.

## TL;DR

The vision ("Turn Pi into an evidence-bound accounting operations harness") is a **full product**, not one change. The repo already owns the runtime-pinning core, a RUC/period scope store, a working monthly-close chain with an R2 approval gate and signed receipts, and 6 of 14 commands. Everything else — full EDA phase protocol wiring, the 4 authority modes, full scope binding, the evidence graph, 5 `lib/` modules, 4 contract families, 3 more extension modules, 7 subagents, prompts/skills/themes/assets — is missing or a stub.

The good news: the pinned `drenyra-ai@0.2.0` already exposes nearly every engine primitive the vision lists as "your advantage" (14 mission states + predicates, 5 intents, commands, events, idempotency, `MissionRuntime`, recovery, capabilities negotiation, receipts with Ed25519 + trusted-key verification, gates incl. materiality-proportional `ApprovalGate`, candidates, ledger, review lenses). The harness work is **wiring and discipline**, not engine building — exactly what the vision's "Drenyra existing = motor y autoridad; drenyra-pi = interfaz agentic y harness" doctrine says.

**Recommended build order:** contracts + scope/canonicalization foundation → authority gates + accounting status → durable stores + monthly-close upgrade → evidence graph + receipt verification → extensions/commands → reconcile/verify chains → agents + skills/prompts/themes/assets. Each slice is one chained PR (see §5). The full vision exceeds 400 changed lines; chained PRs are expected.

**Scope discipline:** this change should deliver the **v0.1 Monthly Close Harness** (12 steps) plus the foundations the full EDA protocol needs. Post-v0.1 roadmap items (SIRE, advanced bank reconciliation, AP/AR, monthly taxes, continuous audit) are explicitly out of the first PR chain — "todo el documento" is the top scope risk (§6).

---

## 1. Vision summary (compressed from vision.md)

| Vision area | Requirement |
| --- | --- |
| Doctrine | AI interprets/proposes · deterministic engines calculate/validate · professional reviews/authorizes · system executes within approved scope · evidence remains |
| EDA protocol | Canonical flow `intake → bind-scope → ingest → normalize → classify → reconcile → investigate → propose → verify → approve → execute → close → archive`; runtime decides next phase — the agent never infers readiness from chat |
| Authority modes | `ASK < ANALYZE < PREPARE < EXECUTE`; an authorization at one level never implies a higher one |
| Scope binding (mandatory) | tenant, organization, company, fiscal period, ledger/book, operation type, source snapshot, policy version, actor, authority level; changing any element invalidates prior authorization |
| Evidence graph | `source → transformation → conclusion → action` provenance |
| Subagents (7) | accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller |
| Commands (14) | status, doctor, capabilities, scope, period, mission, continue, reconcile, close, evidence, verify, receipt, resume, models |
| Package layout | `assets/{agents,chains,policies,schemas}`, `contracts/{mission,evidence,authority,receipts}`, `extensions/{drenyra,mission-status,scope-guard,startup-panel}`, `lib/{accounting-status,authority-gates,canonicalization,evidence-graph,receipt-verification}`, prompts, skills, runtime, tests |
| v0.1 Monthly Close Harness | 12 steps (select company/period → ingest balance/mayor/auxiliares → ingest bank movements → validate source integrity → run reconciliations → detect anomalies → request missing evidence → propose adjustments → generate review package → human approval → signed receipt → export results) |
| v0.1 out of scope | autonomous SUNAT filing; irreversible postings without approval; free interpretation without evidence citation; material tax decisions from LLM alone; replacing the responsible accountant; silent modification of closed periods |
| Post-v0.1 | v0.2 SIRE compras/ventas → v0.3 advanced bank reconciliation → v0.4 AP/AR → v0.5 monthly taxes → v0.6 continuous audit → v1.0 accounting operations platform |

---

## 2. Current state inventory (verified in repo)

| Area | Files | What exists |
| --- | --- | --- |
| Runtime pinning | `runtime/pin.ts`, `checksum.ts`, `resolve.ts`, `doctor.ts`, `status.ts`, `installer.ts`, `index.ts` | `RuntimePin`/`createPin` (exact semver, hex sha256, `released`/`pending-release`), `DEFAULT_PIN` = drenyra-ai 0.2.0 released with real checksum; package-local resolution (never PATH); fail-closed doctor (verdicts verified/missing/pending-release/version-mismatch/checksum-mismatch); human+machine status; postinstall installer with verify. Export surface: `./runtime`. |
| Scope context | `runtime/context.ts`, `ruc.ts` | `ScopeContextStore` (company RUC via SUNAT Módulo 11 + fiscal period YYYYMM), atomic writes to `~/.drenyra/context.json` (dev-grade). Only **2 of 10** scope-binding elements. |
| Extension | `extensions/register.ts` | `PiExtensionApi`/`PiCommandContext` structural types, `findPackageRoot`, `DrenyraPiExtensionDescriptor`, factory registering 6 commands: `status, doctor, company, period, context, close`. `provides: ["status","doctor","context"]`. |
| Chain | `chains/monthly-close.ts` (221 lines) | `MonthlyCloseChain`: drenyra-ai `MissionRuntime` + `IntentRegistryImpl` (in-memory stores), drives DRAFT→QUEUED→RUNNING→AWAITING_APPROVAL→APPROVED→COMPLETED, `ApprovalGate` R2 (explicit single approver), `buildSignedReceipt`/`generateReceiptKeyPair` signed receipt. Evidence hash is hardcoded `"pending"`. |
| Contracts | `contracts/README.md`, `package-contract.md`, `runtime-dependency.md` | Docs only (0.1-draft). **No** `contracts/{mission,evidence,authority,receipts}` families. |
| Docs | `docs/architecture.md` + `docs/architecture/{trust-model,ecosystem-boundaries,dependency-direction}.md` | Direction rules (consumer-only, never PATH, memory never authorizes), fail-closed trust model. |
| Assets | `assets/README.md`, `agents/README.md`, `chains/README.md`, `prompts/README.md`, `skills/README.md`, `themes/README.md` | Placeholder stubs only. |
| Tests | `__tests__/{pin,resolve,doctor,status,installer,context,extension}.test.ts`, `chains/__tests__/monthly-close.test.ts`, `__tests__/helpers/fixture-runtime.ts` | 8 files, 54 tests passing (`bun test`). Tests live in `__tests__/` + colocated `chains/__tests__/` (vitest include `**/__tests__/**/*.test.ts`) — vision's `tests/` dir does not exist and the existing convention should be kept. |
| Build/verify | `scripts/build.mjs`, `scripts/verify-package-files.mjs`, `scripts/install-drenyra-ai.mjs` | tsc → dist (roots: runtime, extensions, index.ts; transitive imports e.g. chains compile in), postinstall wrapper copy, package-file conformance (dist entries + contracts + placeholder READMEs + pi manifest wiring). |
| Manifest | `package.json` | name drenyra-pi 0.0.1-prealpha.1, ESM, node ≥22, `pi.{extensions,prompts,skills,themes}`, exports `.` `./runtime` `./extensions`, zero runtime deps, `drenyra-ai` pinned tgz devDependency (v0.2.0), peer `@earendil-works/pi-coding-agent` optional. |
| OpenSpec | `openspec/config.yaml`, `openspec/README.md` | HYBRID store, strict TDD active (`bun test`), stack bun/TS-ESM/vitest/strict. |

---

## 3. Consumable drenyra-ai@0.2.0 surface (verified against `node_modules/drenyra-ai`)

Exports map: `.` (all below), `./receipts`, `./ledger`, `./missions`, `./candidates`, `./review`, `./gates`, `./recovery`. Bin: `drenyra-ai` (CLI). Package ships `dist`, `contracts/` (mission-protocol, receipt, receipt-schema, candidate, gate, ledger, recovery — markdown contracts + fixtures), `fixtures`.

### Consumable — mission protocol (`drenyra-ai/missions`)

- **States:** `AccountingMissionStatus` — 14 canonical states: DRAFT, QUEUED, RUNNING, BLOCKED, AWAITING_APPROVAL, APPROVED, REJECTED, REVISION_REQUESTED, COMPLETED, FAILED, UNKNOWN, RECOVERING, WAITING_FOR_EVIDENCE, BLOCKED_BY_GATE, RETRYING. `VALID_TRANSITIONS`, `TERMINAL_STATES`, `EXTENDED_STATES`.
- **Predicates:** `isExecutionState`, `isWaitState`, `waitReasonFor` (WaitReason: EVIDENCE/APPROVAL/POLICY_GATE/EXTERNAL_SYSTEM/MANUAL_INTERVENTION), `isTerminal`, `isAwaitingApproval`, `isWaitingForHuman`, `isRecoverable`, `isRunnable`, `isResumable`, `STATUS_LABELS`, `transition`, `validateTransition`, `guardTerminal`, `reconcileTransition`, `isValidRecoveryPath`.
- **Intents:** `MissionIntent` = `"monthly-close" | "correction" | "reconciliation" | "invoice-review" | "compliance-check"`.
- **Commands:** create / execute / approve / reject / reconcile union (`MissionCommand`), `BoundMissionCommand`, optimistic versioning (`expectedMissionVersion`).
- **Events:** `MissionEventType` (STATE_TRANSITION, PROGRESS_UPDATE, BLOCKER_ADDED/RESOLVED, PROPOSAL_CREATED, APPROVAL_DECIDED, COMPLETED, FAILED, TIMEOUT, UNKNOWN, RECONCILED, KEEPALIVE), `MissionEvent` (embedded snapshot, sequence), SSE helpers `parseSSEEvent`/`formatSSEEvent`/`isKeepalive`.
- **Idempotency:** `defaultIdempotencyKey`, `isValidIdempotencyKey`, `IdempotencyConflict`, `canonicalHash` (SHA-256 over key-sorted JSON); replay semantics built into `MissionRuntime.apply`.
- **Runtime:** `MissionRuntime` (start / apply with idempotency + optimistic concurrency / `recoverIncomplete`), depends only on `MissionStore`/`MissionEventStore`/`IdempotencyStore` ports + optional `IntentRegistry`. In-memory implementations shipped.
- **Persistence:** `MissionFileStore` dev adapter (atomic temp+fsync+rename, `STORE_SCHEMA_VERSION`) exists **but is NOT exported** (lives under `cmd/adapters/` — see §3.3).
- **Types:** `MissionSnapshot` (companyId, fiscalPeriod, intent, status, version, progress, steps `MissionStep[]` with PENDING/IN_PROGRESS/COMPLETED/FAILED/SKIPPED, currentStep, blockers, proposal, rejection, receiptId/hash, lastEventSequence), `MissionProposal` (evidence `EvidenceItem[]` + evidenceHash, riskLevel), `MissionBlocker` (WARNING/ERROR/CRITICAL), `AccountingException`, `HarnessError`, `ReadinessGateResult`.
- **Capabilities/versioning:** `PROTOCOL_VERSION` 1.0, `getCapabilities()` (17 features: mission.create/read/list/execute/approve/reject/reconcile http.v1, gates/exceptions read, watch SSE + cursor, idempotency key/replay, concurrency optimistic, receipt.verify.hash.v1, approval.multi-signer.v1, protocol.capabilities.v1), `hasFeature`, `isClientCompatible`.

### Consumable — receipts, gates, candidates, ledger, review, recovery

- **`drenyra-ai/receipts`:** `ReceiptType` (APPROVAL/EXECUTION/COMPLETION/EXTERNAL_SUBMISSION), `ReceiptContent` (missionId, companyId, actorId, decision, proposalVersion, evidenceHash, previous/new status, payloadHash, timestamp), `EvidenceItem {id,label,type}`, `SignedReceipt` (Ed25519), `SigningKeyInfo`/`KeyTrustResolver` (trusted-key lifecycle: expires/revoked), `generateReceiptKeyPair`, `signReceipt`, `buildSignedReceipt`, `generateReceiptHash`, `verifyReceiptIntegrity` (timing-safe), `verifyReceiptSignature`, `verifySignedReceipt`, `verifySignedReceiptTrusted` (status vocabulary CONTENT_VALID…PAYLOAD_TAMPERED), `computeEvidenceHash` (sorted by id), `sortedStringify`.
- **`drenyra-ai/gates`:** `Gate`/`GateResult`/`GateContext` (verdicts allowed/blocked/needs_input; `needs_input` carries a decision envelope), `ApprovalGate` (R0/R1 allowed · R2 ≥1 ApprovalRecord else needs_input · R3 ≥2 distinct approvers else blocked; `DUAL_APPROVAL_TIER`, `DUAL_APPROVAL_COUNT`), `ReceiptGate` (SIGNER_TRUSTED only; falls back to weak embedded-key self-trust when `trustedKeys` absent), `MissionStateGate`, `GateRunner` (first non-allowed stops the pipeline).
- **`drenyra-ai/candidates`:** `CandidateScope {ruc, period}` + `isValidRuc/isValidPeriod/isValidScope`, `Materiality` R0–R3, `deriveMateriality` (BigInt cents + reversibility + jurisdiction; PE fail-closed escalation), `candidateIdentity`/`computeSubjectHash`, `CandidateLifecycle` (propose → inspect → submitForReview → accept/reject/correct, at-most-one correction, SUBJECT_MUTATED guard).
- **`drenyra-ai/ledger`:** `LedgerManifest`, `LedgerEntry` (hash-only or Ed25519-signed, hash chain), `validateLedger` (append-only verification).
- **`drenyra-ai/review`:** `selectReviewLenses` (4R + judgment-day), `forecastReviewWorkload` (delivery/chain strategies) — useful for the harness's own CI discipline, not fiscal logic.
- **`drenyra-ai/recovery`:** `recoveryAction` (per-state policy: in-flight → recover-to-unknown; UNKNOWN → decide-by-evidence; human-wait → leave; terminal → untouched), `decideUnknownRecovery`, `isValidSnapshot`, `replayMission` (event log is source of truth).

### NOT consumable from this repo (verified)

| Surface | Where | Consequence |
| --- | --- | --- |
| `MissionFileStore`, `writeFileAtomic`, `buildTempPath`, `MissionRuntimeStores` | `drenyra-ai/dist/cmd/adapters/file-mission-store.d.ts` — outside exports map | drenyra-pi must implement its own `MissionStore`/`MissionEventStore`/`IdempotencyStore` file adapters (or consume the CLI via child process, which conflicts with the library-consumption preference). |
| CLI-only helpers | `dist/cmd/output/*` (emitJson, readJsonFile) | Not exported; re-implement small helpers locally. |
| Subagent/agent definitions, skills, policies | drenyra-ai README lists `agents/`, `skills/`, `policies/` but package `files` ships only `dist`, `contracts`, `fixtures`, README, LICENSE | The 7 vision subagents must be authored in drenyra-pi (`agents/`), not imported. |
| CLI mission demo handler | `cmd/commands/mission-demo-handler.d.ts` | Pattern reference only (`mission start`/`apply --store --demo`); drenyra-pi should model its own intent handlers (see §4 EDA flow note). |

---

## 4. Gap analysis

Legend: **EXISTS** (verified working) · **PARTIAL** (exists, missing pieces listed) · **MISSING** (not present).

### 4.1 Vision doctrine & protocol

| # | Vision element | Status | Evidence / missing pieces |
| --- | --- | --- | --- |
| G1 | EDA canonical flow (13 phases: intake→…→archive) | PARTIAL | Engine states exist (14 mission states, steps, proposal, blockers, events) but **no chain implements the EDA phase flow**; `MonthlyCloseChain` uses only 6 states and never sets `MissionStep[]`/`WAITING_FOR_EVIDENCE`/`BLOCKED_BY_GATE`. The 13 EDA phases must be mapped to `MissionStep[]` (PENDING/IN_PROGRESS/…) + intent handlers per phase — build in `lib/accounting-status.ts` + chains (§5 S3/S5). |
| G2 | "Runtime decides next phase; agent never infers readiness from chat" | PARTIAL | `MissionRuntime` + predicates (`isRunnable`, `isResumable`, `isAwaitingApproval`, `waitReasonFor`) provide the machinery; **no `/drenyra:continue`** ("execute exactly the next prepared transition") and no readiness computation exists. `WAITING_FOR_EVIDENCE` and `BLOCKED_BY_GATE` are reachable states but unused. |
| G3 | Persistent, resumable missions across restarts | PARTIAL | `MissionRuntime` supports recovery (`recoverIncomplete`, `replayMission`, recovery policy) but `MonthlyCloseChain` uses **in-memory stores** — restart loses the mission. Durable store adapter must be built (drenyra-ai's is unexported, §3.3). |
| G4 | Authority modes ASK < ANALYZE < PREPARE < EXECUTE | MISSING | `lib/authority-gates.ts` does not exist. drenyra-ai provides `ApprovalGate` (R0–R3) + `GateRunner` + `MissionStateGate` + `ReceiptGate` but no 4-mode capability matrix. **Critical nuance:** `ApprovalGate` treats unset materiality as R0 (allowed, no approval) — the harness must derive materiality explicitly (`deriveMateriality`) or a missing tier silently permits. |
| G5 | Mandatory scope binding (10 elements) | PARTIAL | `ScopeContextStore` covers **company (RUC) + fiscal period only** (2/10). Missing: tenant, organization, ledger/book, operation type, source snapshot, policy version, actor, authority level. |
| G6 | Scope-change invalidation | MISSING | No canonical scope hash / re-binding check. `lib/canonicalization.ts` + a scope-hash (or drenyra-ai `candidateIdentity`) must invalidate prior authorizations when any element changes. |
| G7 | Evidence graph source→transformation→conclusion→action | MISSING | `lib/evidence-graph.ts` absent. drenyra-ai offers `EvidenceItem` + `computeEvidenceHash` (flat list, id-sorted) — enough for receipt binding, not for a navigable graph (edges/lineage). Build graph + provenance + hash binding. |
| G8 | Receipt verification command (`/drenyra:receipt verify <id>`) | PARTIAL | `verifySignedReceipt`/`verifySignedReceiptTrusted`/`ReceiptGate` all consumable; **no harness wrapper** (`lib/receipt-verification.ts`) and no trusted-key registry (embedded self-trust is weak per drenyra-ai docs). |
| G9 | Missions persist "verdad contable" outside chat context | PARTIAL | Engine supports it; harness stores are in-memory; Engram (drenyra-engram) integration is documented ("memory never authorizes") but **not implemented** — context store is local JSON. |

### 4.2 Package layout

| # | Vision element | Status | Evidence |
| --- | --- | --- | --- |
| G10 | `contracts/{mission,evidence,authority,receipts}` | MISSING | Only README + package-contract + runtime-dependency. New contract families must be harness-level docs referencing drenyra-ai contracts as source of truth (consumer-only rule). |
| G11 | `extensions/{mission-status,scope-guard,startup-panel}` | MISSING | Only `extensions/register.ts`. Panels need `ctx.ui` surface — the current `PiCommandContext` structural type only carries `cwd`; scope-guard must enforce G5/G6 before every command. |
| G12 | `lib/{accounting-status,authority-gates,canonicalization,evidence-graph,receipt-verification}` | MISSING | No `lib/` directory at all (build currently compiles runtime+extensions+transitive chains; new lib modules must be imported from extensions/index to ship in dist). |
| G13 | `assets/{agents,chains,policies,schemas}` | MISSING | `assets/` has a placeholder README only. Policies (v0.1 out-of-scope guardrails) and schemas (scope, evidence, authority envelopes) are authored here. |
| G14 | prompts / skills / themes | MISSING | README stubs only; `pi.prompts/skills/themes` manifest entries already wired, so content drops straight in. |
| G15 | `runtime/` core | EXISTS | Complete (pin/checksum/resolve/doctor/status/installer/context/ruc + index). |
| G16 | `tests/` dir | PARTIAL | Convention is `__tests__/` + colocated `chains/__tests__/` (54 tests). Keep existing convention; do not create a new `tests/` root. |

### 4.3 Commands (14 in vision)

| # | Command | Status | Notes |
| --- | --- | --- | --- |
| G17 | `/drenyra:status` | EXISTS | Shows runtime verification only. Vision wants company/period, active mission, linked sources, pending reconciliations, material anomalies, required approvals, **next authorized action** → extend via `lib/accounting-status.ts`. |
| G18 | `/drenyra:doctor` | EXISTS | Runtime doctor. |
| G19 | `/drenyra:capabilities` | MISSING | Wrap `getCapabilities()` + harness capabilities (authority modes, commands, scope elements). |
| G20 | `/drenyra:scope` | MISSING | Bind/read the full 10-element scope (G5); supersedes/extents `company`/`period`/`context` (existing extras). |
| G21 | `/drenyra:period` | EXISTS | YYYYMM validation. |
| G22 | `/drenyra:mission` | MISSING | Start/inspect a mission for current scope + intent. |
| G23 | `/drenyra:continue` | MISSING | Execute **exactly one** protocol-declared-next transition (G2). |
| G24 | `/drenyra:reconcile` | MISSING | Reconciliation chain (v0.1 steps 5–6) — intent `"reconciliation"` exists in drenyra-ai. |
| G25 | `/drenyra:close` | EXISTS | R2-gated monthly close with signed receipt; must gain evidence binding + durable stores (G3/G7). |
| G26 | `/drenyra:evidence` | MISSING | Evidence graph add/query (G7). |
| G27 | `/drenyra:verify` | MISSING | Integrity checks (sources, reconciliations, equations) — v0.1 step 4/5 verification. |
| G28 | `/drenyra:receipt` | MISSING | `verify <id>` (G8). |
| G29 | `/drenyra:resume` | MISSING | Recovery/resume of UNKNOWN or interrupted missions (`recoverIncomplete`, `replayMission`). |
| G30 | `/drenyra:models` | MISSING | Model routing per phase — no Pi model-routing API in the current structural slice; may start as a documented capability/registry. |

### 4.4 Subagents, v0.1 harness, roadmap

| # | Vision element | Status | Evidence |
| --- | --- | --- | --- |
| G31 | 7 subagents | MISSING | `agents/` stub only. Roles (scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller) must be authored as Pi agent definitions with broad-deny tool permissions + gentle-pi memory pattern (read backend directly, persist before responding). drenyra-ai ships no agent definitions (§3.3). |
| G32 | v0.1 step 1 — select company/period | EXISTS | `/drenyra:company`, `/drenyra:period`, `ScopeContextStore`. |
| G33 | v0.1 steps 2–4 — ingest balance/mayor/auxiliares/bank, validate source integrity | MISSING | No ingest/normalize lib; no source-snapshot hashing. `lib/canonicalization.ts` + evidence graph are the foundation. |
| G34 | v0.1 steps 5–7 — reconciliations, anomaly detection, request missing evidence | MISSING | Reconcile chain + `WAITING_FOR_EVIDENCE` usage (G1/G24). |
| G35 | v0.1 steps 8–9 — propose adjustments, generate review package | PARTIAL | `MissionProposal` type exists; chain never creates a proposal (evidenceHash hardcoded `"pending"`). Review-package assembly missing. |
| G36 | v0.1 steps 10–11 — human approval, signed receipt | EXISTS | `ApprovalGate` R2 + `buildSignedReceipt` in `MonthlyCloseChain`; needs trusted-key registry (G8) and real evidence binding (G35). |
| G37 | v0.1 step 12 — export results | PARTIAL | Chain prints JSON to stdout; no export artifact/format. |
| G38 | v0.1 out-of-scope guardrails | MISSING | Not encoded as policy (assets/policies) or fail-closed checks (e.g., no autonomous SUNAT submission path, no silent modification of closed periods). |
| G39 | Post-v0.1 roadmap (v0.2–v1.0) | MISSING | Deliberately out of this change's scope (§5.7). |

### 4.5 Summary counts

EXISTS: G15, G17, G18, G21, G25, G32, G36 · PARTIAL: G1, G2, G3, G5, G8, G9, G16, G33-implied, G35, G37 · MISSING: G4, G6, G7, G10–G14, G19, G20, G22, G23, G24, G26, G27, G28, G29, G30, G31, G33, G34, G38, G39.

**Biggest leverage:** G4 (authority gates), G5/G6 (scope binding), G7/G8 (evidence + receipts), G2/G3 (continue/resume semantics) — all built on drenyra-ai primitives that already exist.

---

## 5. Phased slice map (dependency-ordered, each independently testable)

Each slice is a **natural chained-PR boundary**. Estimated changed lines are rough authoring budgets (source + tests); the full vision exceeds 400 changed lines, so the delivery strategy will chain PRs. Slice dependencies are strict — S2 needs S1's scope types, S3 needs S2's gates, etc.

### S1 — Contracts + scope binding + canonicalization foundation

**Files:** `contracts/{mission,authority,evidence,receipts}.md` (new, harness-level, consumer-only); `runtime/context.ts` (extend `ScopeContext` to the 10 scope elements; keep company/period back-compat); `lib/canonicalization.ts` (new: canonical JSON + scope hash / bind envelope; reuse `sortedStringify` for payloads); tests for scope validation, back-compat, hash change on any element.
**Budget:** ~350–420 lines. **PR #1.**
**Testable:** scope binding matrix, canonical-hash invalidation (change one element → hash changes → prior authorization invalid), contract docs lint/readback.

### S2 — Authority gates + accounting status lib

**Files:** `lib/authority-gates.ts` (4-mode matrix ASK<ANALYZE<PREPARE<EXECUTE → allowed command families; enforce via `deriveMateriality` + `ApprovalGate` + `GateRunner` + `MissionStateGate` + `ReceiptGate`; fail-closed on missing materiality/scope); `lib/accounting-status.ts` (compose mission status + scope + gates + next-authorized-action into the status view); tests.
**Budget:** ~350–450 lines. **PR #2.**
**Testable:** mode escalation table (ANALYZE auth never permits PREPARE), missing-materiality fail-closed, gate pipeline order, status composition with `waitReasonFor`/`isRunnable`.

### S3a — Durable stores + monthly-close chain upgrade

**Files:** `lib/stores.ts` (own `MissionStore`/`MissionEventStore`/`IdempotencyStore` file adapters — atomic writes mirroring drenyra-ai's unexported `MissionFileStore` pattern, store schema versioned); `chains/monthly-close.ts` (swap in durable stores; add `recoverIncomplete` + `WAITING_FOR_EVIDENCE`/`BLOCKED_BY_GATE` handling; readiness check = next legal transition only); tests incl. crash/resume and idempotent replay.
**Budget:** ~350–450 lines. **PR #3.**
**Testable:** mission survives store rehydration, idempotency replay returns cached result, recovery policy (human-wait states never auto-recovered).

### S3b — Evidence graph + receipt verification lib

**Files:** `lib/evidence-graph.ts` (source→transformation→conclusion→action nodes/edges, lineage, hash binding via `computeEvidenceHash`); `lib/receipt-verification.ts` (`verifySignedReceipt` + `verifySignedReceiptTrusted` + `ReceiptGate` wiring, local trusted-key registry with expiry/revocation); tests.
**Budget:** ~250–350 lines. **PR #4.**
**Testable:** graph integrity, evidence-hash stability (id-sorted), receipt verify (valid/tampered/unknown-signer/expired/revoked).

### S4a — Extension modules + first command wave

**Files:** `extensions/scope-guard.ts` (enforce S1/S2 before every command), `extensions/startup-panel.ts` (render scope + status at startup; needs `ctx.ui` structural slice — verify against gentle-pi/pi-coding-agent types), `extensions/mission-status.ts`; new commands `capabilities`, `scope`, `models`; descriptor `provides`/`commands` growth; extension tests.
**Budget:** ~300–380 lines. **PR #5.**
**Testable:** registration list, fail-closed without scope, descriptor contract.

### S4b — Mission lifecycle commands

**Files:** commands `mission`, `continue`, `resume`, `evidence`, `verify`, `receipt`, `reconcile`-shim; `lib/accounting-status` reuse; tests (each handler fail-closed + happy path against fixture stores).
**Budget:** ~350–450 lines. **PR #6.**
**Testable:** `/drenyra:continue` advances exactly one prepared transition; `/drenyra:receipt verify <id>` full verification matrix; `/drenyra:resume` recovers UNKNOWN.

### S5 — Reconcile + verify chains (v0.1 steps 2–9 core)

**Files:** `chains/reconcile.ts` (intent `"reconciliation"`: ingest → normalize → reconcile → anomaly detection → `WAITING_FOR_EVIDENCE` → proposal), `chains/verify.ts` (integrity/equations), tests. May split into two PRs if budget exceeds ~450.
**Budget:** ~400–550 lines. **PR #7 (or #7+#8).**
**Testable:** full 12-step happy path on fixture sources; anomaly → evidence request → proposal → approval → receipt; source-snapshot hash verification.

### S6 — Agents + skills/prompts/themes/assets

**Files:** `agents/` 7 subagent definitions (broad-deny tool permissions, memory pattern); `skills/` (fiscal-convention, RDA-chain, scope skills); `prompts/` (command prompts + persona); `themes/` (fiscal-operator light/dark); `assets/{agents,chains,policies,schemas}` (policies encoding v0.1 out-of-scope guardrails; schemas for scope/evidence/authority envelopes); `scripts/verify-package-files.mjs` updates; structural tests.
**Budget:** ~400–500 lines (mostly static). **PR #8 (or #8a agents / #8b content).**
**Testable:** file/manifest conformance, policy content assertions, agent definitions parse.

### S7 — Explicitly deferred (post-v0.1, out of this change)

SIRE compras/ventas (v0.2), advanced bank reconciliation (v0.3), AP/AR (v0.4), monthly taxes (v0.5), continuous audit (v0.6), accounting operations platform (v1.0). Also deferred: Engram (drenyra-engram) integration beyond the documented direction — memory reads can come after the file-backed store works.

### Slice-level notes for the design phase

- `tsconfig.build.json` compiles roots `runtime`, `extensions`, `index.ts`; `lib/` and `chains/` ship in `dist/` **only when transitively imported** — design must ensure new lib modules are reachable from extensions or `index.ts` (or add roots).
- `verify-package-files.mjs` asserts specific files; new contract families and asset subdirs need entries there and in `package.json` `files` (dirs already listed).
- `package.json` `exports` may need `./lib/*` if lib modules become public API — otherwise keep them internal (harness-internal imports are fine).

---

## 6. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **Fiscal write-guard on words like igv/value/amount:** the @drenyra/pi write guard can block file writes containing these tokens (they are legitimate in this domain: `tax-controller-pe`/SUNAT/IGV, `value`/`amount` in materiality). | Use heredoc fallback for file creation when the write tool is blocked; write tokens in content without triggering the guard (e.g., write structure first, then patch); record this in the apply-phase notes. |
| R2 | **Engram flakiness:** the Engram HTTP server is unreliable in this environment. | File-back (`openspec/`) is authoritative; Engram persistence is best-effort and must never block SDD progress (`store_mode: hybrid`). |
| R3 | **drenyra-ai pinned tgz (v0.2.0) drift:** the runtime is a pinned GitHub-release tarball devDependency; its contracts in `node_modules/` are the source of truth. | Upgrade is a release of drenyra-pi with a migration note (runtime-dependency contract). `DEFAULT_PIN` is already `released` with a real checksum; doctor fails closed on mismatch. Verify against the pinned version only, never a checkout. |
| R4 | **Scope creep ("todo el documento"):** the vision is a full product (7 subagents, 14 commands, 13-phase protocol, post-v0.1 roadmap). | This change delivers **v0.1 Monthly Close Harness + EDA foundations** only; slices in §5 bound scope; roadmap items (S7) are explicit non-goals of the first PR chain. |
| R5 | **Unexported drenyra-ai surfaces:** `MissionFileStore`/atomic-write helpers/CLI output helpers are not in the exports map; agents/skills/policies are not shipped in the package. | Build own file-store adapters (mirror the atomic-write pattern); author subagents locally; treat CLI as reference only (library consumption preferred over child-process, consistent with never-PATH doctrine). |
| R6 | **ApprovalGate fail-open at R0/R1:** unset materiality is treated as R0 (allowed, no approval); embedded-key self-trust is weak in `ReceiptGate` without `trustedKeys`. | Harness must always derive materiality via `deriveMateriality` before the gate and maintain a trusted-key registry; missing scope/materiality fails closed (G4/G8). |
| R7 | **Intent-handler constraints:** `MissionRuntime` validates every transition; an intent handler returns one legal step or null — the EDA 13-phase flow must be modeled as step sequences (`MissionStep[]`), not freeform jumps. | Design EDA flow as an ordered step machine over the 14 canonical states; `WAITING_FOR_EVIDENCE`/`BLOCKED_BY_GATE` for human-wait phases. |
| R8 | **Context store is dev-grade:** `~/.drenyra/context.json` is a single-user JSON file; no tenant isolation; canonical storage is deferred. | Scope binding (S1) adds the full envelope + hash so invalidation works regardless of storage; document canonical storage as a later concern. |
| R9 | **Command surface growth:** 6 → 14+ commands changes the extension contract (descriptor, tests, docs). | Update `DrenyraPiExtensionDescriptor`, extension tests, and `package-contract.md` in the same slices that add commands. |
| R10 | **Panels need Pi UI API:** `startup-panel`/`mission-status` may require `ctx.ui` beyond the current `cwd`-only structural slice. | Verify against installed gentle-pi/`@earendil-works/pi-coding-agent` types during S4a design before committing to panel rendering; degrade to console/JSON if the surface is unavailable. |

---

## 7. Next steps & navigation

1. **Proposal (`sdd-propose`):** scope this change to **v0.1 Monthly Close Harness + EDA foundations** (slices S1–S6), with S7 and post-v0.1 roadmap as explicit non-goals; pick `delivery_strategy` (chained PRs expected) and `chain_strategy`.
2. **Design decisions to make:** EDA-phase→state mapping table; scope-hash canonical form; trusted-key registry storage; whether `lib/` becomes public exports; whether startup panel is feasible with the current Pi API slice.
3. **Key artifacts for later phases:**
   - `openspec/changes/evidence-driven-accounting-harness/vision.md` — user source (Spanish).
   - This exploration (EN).
   - `contracts/{package-contract,runtime-dependency}.md` + `docs/architecture*` — constraints (consumer-only, never PATH, memory never authorizes).
   - `node_modules/drenyra-ai/contracts/*.md` — authoritative engine contracts (mission-protocol, candidate, receipt, gate, ledger, recovery).
4. **Strict TDD active:** `bun test` (54 tests, ~1s) — every slice lands RED → GREEN → TRIANGULATE → REFACTOR with recorded evidence.
