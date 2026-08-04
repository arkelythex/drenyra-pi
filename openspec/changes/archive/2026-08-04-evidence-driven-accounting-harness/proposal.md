# Proposal: Evidence-Driven Accounting Harness

> Change: `evidence-driven-accounting-harness`  
> Product: `drenyra-pi`  
> Status: proposed  
> Artifact store: HYBRID — this file is authoritative; Engram is best-effort  
> Delivery: full vision planned now, implemented in independently testable slices

## Executive decision

Build the v0.1 Evidence-Driven Accounting (EDA) product vision in `drenyra-pi`: **turn Pi into an evidence-bound accounting operations harness** over the pinned `drenyra-ai@0.2.0` engine.

The harness will control how accounting work is scoped, analyzed, prepared, approved, executed, evidenced, resumed, and audited. It will not become an accounting engine or system of record. The operating doctrine is:

> **AI assists; the system validates; the professional reviews; the evidence remains.**

“Todo el documento” means the planning artifacts cover the complete v0.1 vision and its foundations. Implementation remains bounded by slices S1–S6. The post-v0.1 roadmap is explicitly deferred.

---

## 1. Problem statement and opportunity

### Problem

A conversational accounting assistant can produce plausible analysis without proving its source, respecting an exact operating scope, or distinguishing advice from authorized execution. In accounting, this ambiguity can affect money, tax obligations, closed periods, auditability, and professional responsibility.

The current package has a strong runtime-verification foundation, a partial company/period context, a monthly-close chain, an R2 approval gate, signed receipts, and 6 of the intended 14 commands. It does not yet provide the complete operating discipline required by the vision:

- mission progression is not wired to the canonical EDA sequence;
- only 2 of 10 scope elements are bound;
- authority modes are absent;
- missions are not durable across restarts;
- evidence is not represented as a provenance graph;
- receipt verification lacks a harness-managed trusted-key registry;
- most commands, extension modules, chains, agents, contracts, and packaged assets are missing or placeholders.

### Opportunity

Create a distinct category of **Agentic Accounting Infrastructure**: a Pi-native cockpit that makes accounting operations controlled, verifiable, resumable, and auditable while preserving Drenyra Core and `drenyra-ai` as the deterministic authority.

The product separation is deliberate:

```text
AI interprets and proposes.
Deterministic engines calculate and validate.
The professional reviews and authorizes.
The system executes only within approved scope.
The evidence remains.
```

The LLM coordinates intent and explains outcomes. It never determines authoritative readiness, authorizes a higher-risk action, or becomes the accounting system of record.

---

## 2. Positioning

**Product statement:** Turn Pi into an evidence-bound accounting operations harness.

`gentle-pi` disciplines how software is built. `drenyra-pi` disciplines how accounting work is performed.

| Software delivery discipline | Accounting operations discipline |
| --- | --- |
| Source code and requirements | Books, vouchers, banks, declarations, scope, period, and policy |
| SDD/OpenSpec workflow | EDA accounting mission protocol |
| Tests and CI gates | Reconciliations, equations, integrity, evidence, and compliance gates |
| Diff and pull request | Accounting/fiscal delta and review package |
| Reviewer | Accountant, supervisor, or auditor |
| Commit or merge | Approved entry, adjustment, close, export, or submission |
| Review receipt | Signed accounting receipt bound to evidence and scope |

The accounting harness must be stricter than a software workflow because an incorrect posting, close, or filing may create monetary, fiscal, audit, and professional consequences that cannot be treated as an ordinary reversible deployment defect.

---

## 3. Users and operating situations

| User | Primary responsibility | Typical authority use |
| --- | --- | --- |
| Accountant / operator (`contador`) | Gather sources, investigate differences, prepare reconciliations and adjustments | `ASK` for evidenced answers; `ANALYZE` for investigation; `PREPARE` for draft adjustments and review packages |
| Supervisor / approver | Review material conclusions, scope, evidence, and proposed actions | `ANALYZE` to inspect; `PREPARE` to refine; explicit approval before eligible `EXECUTE` actions |
| Auditor / controller | Trace provenance, verify receipts, challenge anomalies, and assess policy compliance | Primarily `ASK` and `ANALYZE`; no implied mutation authority |

### Authority modes by situation

| Mode | Intended situation | Product boundary |
| --- | --- | --- |
| `ASK` | Answer a question from available, cited evidence | No investigation workflow or mutation |
| `ANALYZE` | Reconcile, investigate, classify, and detect anomalies | May produce conclusions, never draft or execute higher-authority actions |
| `PREPARE` | Prepare adjustments, entries, reports, declarations, or review packages | Produces candidates only; does not post, export, or submit |
| `EXECUTE` | Register, export, or submit an explicitly approved action | Requires exact scope, materiality, approval, evidence, and receipt gates |

The ordering is strict and monotonic:

```text
ASK < ANALYZE < PREPARE < EXECUTE
```

A lower mode never implies a higher mode. A user may inspect a higher-mode result only when policy permits, but inspection never grants execution authority.

---

## 4. Goals and non-goals

### Goals

1. Wire the canonical EDA flow over `drenyra-ai` missions as an ordered `MissionStep[]` sequence:
   `intake → bind-scope → ingest → normalize → classify → reconcile → investigate → propose → verify → approve → execute → close → archive`.
2. Make the runtime, not chat interpretation, decide the next legal mission transition.
3. Bind every mission and authorization to all 10 required scope elements and invalidate authorization when any element changes.
4. Enforce the four authority modes and materiality-proportional approval without reachable fail-open defaults.
5. Persist missions, events, and idempotency state durably across process restarts.
6. Preserve provenance through an evidence graph from source to action.
7. Issue and locally verify Ed25519 receipts against a trusted-key registry.
8. Deliver all 14 intended `/drenyra:*` commands, production extension modules, v0.1 chains, seven bounded accounting agents, and real packaged contracts/assets.
9. Keep Pi commands and extensions thin; deterministic and reusable behavior belongs in `lib/` or the pinned engine.
10. Deliver every slice with strict TDD and an independently reviewable rollback boundary.

### Non-goals

This change does **not** deliver:

- autonomous SUNAT filing;
- irreversible posting without explicit approval;
- free interpretation without evidence citation;
- material tax decisions based only on an LLM;
- replacement of the responsible accountant;
- silent modification of closed periods;
- the post-v0.1 roadmap: SIRE purchases/sales, advanced bank reconciliation, AP/AR, monthly taxes, continuous audit, or the v1.0 accounting operations platform.

It also does not move accounting-engine authority into `drenyra-pi`, authorize operations from Engram memory, trust an ambient `PATH` runtime, or import private/unexported `drenyra-ai` implementation files.

### Scope discipline

The user's “todo el documento” decision is the largest delivery risk. It means **full v0.1 planning**, not one oversized implementation diff. S1–S6 are binding product boundaries. Deferred roadmap work requires a later change and cannot enter this chain as incidental refinement.

---

## 5. Requirements and slice plan

Every slice must be independently testable, preserve all prior slice behavior, use strict RED → GREEN → TRIANGULATE → REFACTOR, and remain a coherent work unit. Tests and user-facing documentation ship with the behavior they verify. Chained PRs are expected; each PR should remain within the reviewable changed-line budget where practical.

| Slice | Product outcome | Main requirements | Acceptance posture |
| --- | --- | --- | --- |
| **S1 — Contracts, full scope, canonicalization** | Missions and authorizations have a stable, explainable identity | Real mission/evidence/authority/receipt contracts; all 10 scope elements; canonical encoding and hash; backward-compatible company/period loading; scope-change invalidation | Contract readback; validation matrix; each single-element scope change produces a different binding and invalidates prior authorization |
| **S2 — Authority gates and accounting status** | Users can see what is allowed now and why | `ASK < ANALYZE < PREPARE < EXECUTE`; command-family matrix; mandatory `deriveMateriality`; gate ordering; fail-closed missing scope/materiality; next-authorized-action status | Exhaustive escalation tests; lower authority never permits a higher action; R0/R1 missing-materiality path is unreachable; wait/readiness status derives from runtime predicates |
| **S3 — Durable missions, monthly close, evidence, receipts** | Missions survive restarts and produce evidence-bound, verifiable outcomes | Own durable mission/event/idempotency adapters; recovery and replay; upgraded monthly-close flow; evidence graph; evidence hashes; trusted-key registry; local receipt verification | Restart/rehydration and idempotency tests; human-wait states do not auto-advance; graph integrity; receipt valid/tampered/unknown/expired/revoked paths |
| **S4 — Pi extensions and complete command surface** | Operators can control and inspect the protocol from Pi | Main extension plus mission-status, scope-guard, startup-panel; complete 14 commands: status, doctor, capabilities, scope, period, mission, continue, reconcile, close, evidence, verify, receipt, resume, models; `receipt verify <id>`; continue advances one transition only | 14/14 registration and handler coverage; fail-closed scope guard; descriptor/package contract conformance; command happy/failure paths; no “continue all” behavior |
| **S5 — Reconcile, verify, and evidence chains** | The v0.1 monthly-close workflow can ingest, validate, reconcile, investigate, propose, approve, receipt, and export | Reconcile, verify, and evidence chains plus upgraded monthly-close orchestration; source-snapshot integrity; anomaly-to-missing-evidence loop; review package; signed completion | Fixture-backed 12-step monthly-close path; anomaly/evidence wait path; equations and source integrity; proposal-to-approval-to-receipt traceability |
| **S6 — Agents and packaged operating assets** | The package ships usable accounting roles and operating guidance, not placeholders | Seven Pi markdown agents and mirrored assets; real skills, prompts, themes, policies, chain assets, and schemas; package-file verification | Exactly 7 required agent roles; definitions parse; permissions fail closed; manifest/package conformance; policies encode every v0.1 non-goal |

### Slice decomposition and PR boundaries

S3 may be split into durable-store/monthly-close and evidence/receipt work units. S4 may be split into extension foundations and mission lifecycle commands. S5 may split reconcile and verify/evidence chains if its changed-line forecast exceeds the bounded review budget.

The expected delivery is approximately **6–7 chained PRs**. A slice may map to more than one PR when necessary for reviewer load, but no PR may separate behavior from its tests or required documentation.

---

## 6. Cross-slice business rules

These invariants apply from the first slice that can exercise them and must remain true thereafter.

1. **Money:** Monetary values are `BigInt` cents. Floating-point values are forbidden for money and materiality calculations.
2. **Company identity:** Peruvian RUC values must pass the SUNAT checksum validation, not only formatting checks.
3. **Fiscal period:** Periods use canonical `YYYYMM` form and reject invalid months.
4. **Monthly-close materiality:** Monthly close is at least R2 and requires the corresponding human approval gate. Materiality must always be derived explicitly before `ApprovalGate`; an absent tier must fail closed.
5. **Receipt authenticity:** Receipts are signed with Ed25519 and verified against a harness-managed trusted-key registry supporting unknown, expired, and revoked keys. Embedded-key self-trust is not accepted.
6. **Authority monotonicity:** `ASK < ANALYZE < PREPARE < EXECUTE`; authorization never escalates implicitly.
7. **Scope binding:** Every mission binds tenant, organization, company, fiscal period, ledger/book, operation type, source snapshot, policy version, actor, and authority level.
8. **Scope invalidation:** Changing any bound scope element invalidates prior authorization and requires a new bound decision.
9. **Mission authority:** The runtime and persisted mission state determine the next legal phase. Chat content and model confidence do not.
10. **Single-step continuation:** `/drenyra:continue` executes only the next protocol-declared prepared transition.
11. **Evidence provenance:** Every material conclusion and action is traceable through `source → transformation → conclusion → action`.
12. **System of record:** The LLM and Engram memory are never the accounting system of record and never authorize an operation.
13. **Closed periods:** Closed periods cannot be modified silently; any allowed correction follows an explicit, evidenced, approved mission.
14. **Runtime trust:** Fiscal operations use only the pinned, checksum-verified, package-local Drenyra AI runtime; never an ambient executable from `PATH`.

---

## 7. Product and architecture decisions

| Decision | Choice | Tradeoff / rationale |
| --- | --- | --- |
| Pi package boundary | Keep commands/extensions thin; place reusable deterministic behavior in `lib/` and consume `drenyra-ai` as engine authority | More adapter code, but prevents fiscal policy from becoming conversational handler logic |
| Mission model | Map EDA phases to ordered `MissionStep[]` over canonical `drenyra-ai` mission states | Preserves engine transition validation; avoids inventing a competing state machine |
| Unexported engine surfaces | Implement local adapters for `MissionStore`, `MissionEventStore`, and `IdempotencyStore`; do not deep-import `MissionFileStore` | Duplicates a small persistence pattern, but respects package exports and upgrade safety |
| Persistence authority | File-backed mission/evidence/receipt state is authoritative; Engram is best-effort context only | Less distributed convenience initially, but deterministic recovery and authorization remain independent of memory availability |
| Receipt trust | Maintain an explicit trusted-key registry and call trusted verification paths | Requires key lifecycle management, but avoids `ReceiptGate` weak embedded-key self-trust |
| Materiality | Always call `deriveMateriality`; missing inputs fail closed | May require more operator input, but prevents R0/R1 default allowance |
| Library exports | Keep new `lib/` modules internal unless a later public API requirement is approved | Minimizes package contract surface and semver burden |
| Build roots | Ensure every new `lib/` module is transitively reachable from a build root or explicitly add it to `tsconfig.build.json` | Prevents source that passes local tests but is absent from `dist`; package verification must check shipped output |
| UI panels | Verify the installed Pi structural API before using `ctx.ui`; degrade to structured console/JSON output if unavailable | Preserves compatibility without coupling to an unverified host API |
| Delivery | Chained, independently testable work units with tests/docs colocated | More PR coordination, but reduces review fatigue and enables safe rollback |

---

## 8. Affected areas

| Area | Expected impact |
| --- | --- |
| `contracts/` | Four real harness contract families and updated package promises |
| `runtime/context.ts` and runtime exports | Full scope model, validation, compatibility, and canonical binding |
| New `lib/` modules | Accounting status, authority gates, canonicalization, durable stores, evidence graph, and receipt verification |
| `chains/` | Upgraded monthly close plus reconcile, verify, and evidence flows |
| `extensions/` | Main registration, mission status, scope guard, startup panel, and 14-command surface |
| `agents/`, `skills/`, `prompts/`, `themes/`, `assets/` | Seven roles and production package content replacing stubs |
| Build and package scripts | Build-root reachability, manifest/files verification, and shipped-artifact checks |
| Tests and documentation | Strict-TDD matrices, fixture flows, package conformance, architecture and operator guidance |
| Operations/support | New scope-binding errors, key-registry lifecycle, mission recovery, and receipt-verification diagnostics must be explainable to accountants and supervisors |

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Full-vision scope creep | Oversized diffs, delayed value, inconsistent partial behavior | Bind work to S1–S6; defer S7 roadmap; use chained PRs and stop at each accepted slice boundary |
| Incorrect authority or materiality default | Unauthorized preparation or execution | Exhaustive monotonicity tests; mandatory materiality derivation; fail closed on missing inputs |
| Scope canonicalization ambiguity | Authorization may survive a meaningful scope change | Version canonical form; test all 10 single-field mutations; bind hashes into authorization and receipts |
| Weak signer trust | A self-signed or stale receipt may be accepted | Explicit trusted-key registry with expiry/revocation; test all rejection paths |
| Durable-store corruption or partial write | Mission loss or inconsistent replay | Atomic file writes, schema versioning, event replay, idempotency, and crash/restart tests |
| Pinned engine drift | Harness assumptions diverge from runtime behavior | Verify only against `drenyra-ai@0.2.0`; no deep imports; upgrades require package release and migration notes |
| Pi host API mismatch | Startup/status UI cannot render as designed | Verify installed types in S4; retain structured console/JSON fallback |
| Build-root omission | New modules pass source tests but are absent from package output | Make modules transitively reachable or add explicit roots; extend package-file verification |
| Engram unavailability | Context persistence may fail | File-backed artifacts and stores remain authoritative; Engram failure never grants authority or blocks local SDD artifacts |
| Reviewer overload | Security/accounting errors are missed in a large review | Approximately 6–7 chained PRs; bounded changed lines; one coherent behavior with tests/docs per work unit |

---

## 10. Rollback strategy

Rollback is slice-based, never an in-place weakening of gates.

1. Each PR must preserve a coherent package state and include its own migrations, compatibility handling, tests, and docs.
2. A failing slice is reverted as a complete work unit; prior accepted slices remain usable.
3. New commands and panels may be removed by reverting their registration slice without changing persisted mission data.
4. Store/schema changes must be versioned and retain read compatibility for data written by earlier accepted slices, or ship an explicit recovery/export path before adoption.
5. Authority, materiality, scope, and receipt gates must fail closed during rollback or mixed-version detection. Rollback must never substitute a weaker trust path.
6. Closed-period actions and signed receipts are immutable evidence; rollback may disable future operations but must not silently rewrite prior records.
7. A `drenyra-ai` pin change, if later required, is a separate package release and is not an emergency rollback shortcut.

---

## 11. Success criteria and metrics

The change is complete when all S1–S6 outcomes are delivered and the following are demonstrably true:

| Metric | Target |
| --- | --- |
| Baseline regression | All existing 54 tests continue to pass throughout the chain |
| New behavior tests | Every slice adds passing tests for its acceptance posture; final report records total tests and per-slice evidence |
| Command coverage | 14/14 intended `/drenyra:*` commands registered and exercised; `/drenyra:receipt verify <id>` covers valid and rejection paths |
| Scope coverage | 10/10 required scope elements validated, canonicalized, and included in invalidation tests |
| Authority coverage | 4/4 modes and every upward-escalation denial covered; missing materiality/scope fails closed |
| Mission coverage | All 13 EDA steps represented in order; `continue` advances exactly one runtime-authorized step; restart/resume is verified |
| Chain coverage | Monthly close, reconcile, verify, and evidence chains covered, including happy, evidence-wait, gate-blocked, recovery, and failure paths |
| Receipt verification | Valid, content-tampered, payload-tampered, unknown-signer, expired-key, and revoked-key paths covered using trusted verification |
| Agent coverage | Exactly 7 required accounting agents ship as parseable Pi definitions and package assets |
| Documentation/package coverage | Mission, evidence, authority, and receipt contracts; command/operator docs; package manifest and shipped-file checks all pass |
| Architecture discipline | No money floats, no ambient runtime lookup, no memory-based authorization, and no deep import of unexported engine surfaces |

### Review workload forecast

**Chained PRs recommended: Yes.** The full vision is materially larger than 400 changed lines. Expected delivery is approximately **6–7 PRs**, with an additional split only if a slice cannot remain independently reviewable within the bounded changed-line budget. The cached `ask-on-risk` strategy requires the orchestrator to confirm the concrete chain boundary before apply begins.

---

## 12. Acceptance summary

The proposal succeeds when an accountant can start or resume a durably stored, exactly scoped mission; the runtime identifies one legal next phase; deterministic gates enforce authority, materiality, evidence, and approval; a professional can review the result; and the harness can execute only within that approved scope while preserving a trusted, signed, locally verifiable evidence trail.

Anything that relies on chat inference, implicit escalation, missing materiality, mutable scope, embedded-key self-trust, memory authorization, or an unverified runtime is rejected by design.
