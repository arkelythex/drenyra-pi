# Drenyra Pi Adapter Boundary

> Change: `pi-sdd-040-adapter-boundary` · Repo: `drenyra-pi` · Date: 2026-08-15
> Runtime baseline: published, pinned `drenyra-ai@0.4.1` (checksum `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600`)
> Authority-side record: `drenyra-ai/openspec/changes/sdd-040-rda-v2/`, coordinated 2026-08-15 (final closure identity bound during verification)

## The boundary in one sentence

**Pi coordinates and presents; humans decide; Drenyra AI owns fiscal authority.**

Pi is a replaceable agentic-runtime host. It prepares requests, persists
non-authoritative working state, orders kernel calls, and presents results —
it never computes a materiality tier, accepts a lifecycle transition, creates a
gate verdict, or verifies a receipt with Pi-local fiscal rules. Every
authoritative decision in a mission belongs to the pinned
`drenyra-ai@0.4.1` kernel. This document explains the operator-to-result flow;
the per-rule evidence lives in the
[adapter-boundary audit](./rda-adapter-boundary-audit.md).

## Quick path (happy path)

1. Operator starts a monthly close for a bound scope.
2. Pi prepares the request: complete canonical scope + explicit materiality input + bounded evidence.
3. Pi calls Drenyra AI: the kernel derives materiality, runs the mission through engine-validated transitions, and evaluates the approval gate.
4. Pi presents the candidate (proposal with a real evidence hash) to the human.
5. The human decides: an explicit approver record is created.
6. Pi calls Drenyra AI again: the receipt gate verifies the signed completion receipt.
7. Pi projects the result (export artifact, status projection) — presentation only.

## Per-step ownership

| Step | Pi owns | Human owns | Drenyra AI owns | Local persistence | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1. Operator | Receives the operator's close intent and binds the complete ten-element canonical scope (scope-discipline skill) | Chooses the company/period/scope to close | — | Scope context (`~/.drenyra/context.json`) is a convenience input only; complete scope is revalidated (`dev/demo`) | `runtime/context.ts` `assertMissionScopeReady`; `lib/canonicalization.ts` `bindScope` |
| 2. Prepare request | Validates complete materiality input, source refs/evidence, and the declared R2 policy floor; starts the mission with the full 13-phase EDA plan | — | Derives the R0–R3 materiality tier (`deriveMateriality`, `orderOf`) and validates the DRAFT→QUEUED start transition (`MissionRuntime`) | Mission snapshot + events under `.local/missions/**` (`dev/demo`) | `chains/monthly-close.ts` `CLOSE_MATERIALITY` + `startMission`; `lib/authority-gates.ts` `deriveRequiredMateriality` |
| 3. Call Drenyra AI | Orders the pipeline stages (scope → mode → materiality → mission → approval → receipt) and stops at the first non-allowed verdict; validates binding/input completeness | — | Evaluates mission transitions (`MissionRuntime.apply`), the approval gate (`ApprovalGate`), and the receipt gate (`ReceiptGate`) through the kernel `GateRunner` | Authority records under `.local/authority/*.ndjson` (`non-authoritative cache`); a stored `GRANTED` cannot bypass a kernel gate | `lib/authority-gates.ts` `runAuthorityPipeline`; harness equivalence in `__tests__/adapter-boundary-replacement.test.ts` |
| 4. Present candidate | Builds and presents the proposal (evidence hash, summary, risk presentation) and the status projection | Reviews the candidate | Produces the proposal's evidence hash (`computeEvidenceHash`) and the kernel-derived materiality | Evidence graph under `.local/evidence/*.ndjson` (`dev/demo`) | `chains/monthly-close.ts` `buildProposal`; `lib/accounting-status.ts` `buildAccountingStatus` |
| 5. Human decision | Records the explicit human approver input; never treats preparation as approval | Approves or rejects the candidate with an explicit `ApprovalRecord` (identity + reason) | Evaluates the R2 approval gate against the recorded approval | Approval records are passed to the kernel gate, not stored as authority | `chains/monthly-close.ts` `makeApproval` + `runApprovePhase`; audit test `approval:needs_input` guard |
| 6. Verify receipt | Builds the close output and persists the signed completion receipt record; the verify chain stays read-only | — | Builds (`buildSignedReceipt`), verifies (`verifySignedReceipt`), and gate-checks the receipt with a trusted-key list (`ReceiptGate` — never empty) | Receipt records under `.local/receipts/*.json` (`non-authoritative cache`); storage does not establish validity or trust | `chains/monthly-close.ts` `sealClose`; `lib/receipt-store.ts`; harness receipt-claim negative control |
| 7. Project result | Writes the export/status presentation artifact and reports the terminal outcome | Reads the result | Decides the terminal mission status (`COMPLETED` only through `MissionRuntime`) | Monthly-close exports under `.local/exports/*.json` (`non-authoritative cache`); presentation only, never execution proof | `chains/monthly-close.ts` `run` export artifact; verify-chain receipt-binding check |

## Fail-closed behavior

Every failure mode below stops the workflow and names who or what resumes it. Pi never guesses, never defaults, and never auto-advances a waiting or unknown mission.

| Failure mode | What happens (stop behavior) | Required to resume |
| --- | --- | --- |
| Incomplete scope | `assertMissionScopeReady` / `bindScope` throw or the scope stage blocks: missing/changed elements never guess a missing element; no store is touched before the scope passes | Operator supplies the complete ten-element canonical scope; a changed scope hash requires a new bound decision |
| Invalid/corrupt evidence | Evidence graph integrity validation fails closed → graph is `unavailable`; a proposal or action that cites an unverifiable graph is never produced; a corrupt graph line makes the graph unavailable | Operator/human supplies valid cited evidence with verified payload hashes (evidence-builder), then explicitly resumes |
| Gate denial | The pipeline stops at the first non-allowed verdict (e.g. `BLOCKED_BY_GATE` at approval, or a receipt `UNKNOWN_SIGNER`/empty trusted-key block); no phase advances, no receipt is treated as valid | Human resolves the gate input (explicit approval, trusted key list) and re-runs the phase |
| UNKNOWN | `derivePreparedStep` returns `null` for an UNKNOWN mission: no step is prepared and zero blind retries occur | Reconciliation or explicit human action (the engine-legal UNKNOWN→RUNNING recovery is never auto-driven) |
| Receipt verification failure | `verifySignedReceipt` fails or the receipt gate blocks (tampered payload, revoked/expired/unknown signer): the receipt is never treated as valid or execution proof | Human/maintainer repairs the receipt or the trusted-key registry and re-verifies (read-only) |
| Unavailable runtime | The pinned runtime is missing, mismatched, or unverifiable (checksum mismatch): the harness reports the runtime failure and performs no mission work | Maintainer restores the published pinned `drenyra-ai@0.4.1` artifact (checksum `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600`) |

## Local store classification

Local persistence is **never authoritative**. No combination of local files
substitutes for a valid kernel mission, gate, or receipt outcome
(REQ-AUDIT-011; REQ-BOUND-004). The guard test
`local persistence alone cannot authorize approve or execute`
(pre-populates a forged local `GRANTED` record plus local mission/evidence/
receipt/export/context data and proves the kernel pipeline still stops at
`approval:needs_input`) is executable evidence for every row below.

| Local persistence | Exact location | Label | Meaning |
| --- | --- | --- | --- |
| Mission snapshots, events, idempotency, recovery | `<storesRoot>/.local/missions/**` | `dev/demo` | Development adapter for driving/recovering kernel missions; persistence alone is not an approval or execution proof |
| Authority records | `<storesRoot>/.local/authority/*.ndjson` | `non-authoritative cache` | Cache of an operator/scope/action binding; a stored `GRANTED` value cannot bypass kernel mission, approval, or receipt gates |
| Evidence graph | `<storesRoot>/.local/evidence/*.ndjson` | `dev/demo` | Local evidence fixture/log; unusable for authority when lineage or payload-hash validation fails |
| Receipt records | `<storesRoot>/.local/receipts/*.json` | `non-authoritative cache` | Cached kernel receipt; storage does not establish validity or signer trust |
| Trusted key registry | `<storesRoot>/.local/trusted-keys.json` | `dev/demo` | Local trust configuration for the harness; the public kernel receipt gate still performs verification |
| Monthly-close exports | `<storesRoot>/.local/exports/*.json` | `non-authoritative cache` | Presentation/export artifact only; never proof of execution |
| Scope context | `~/.drenyra/context.json` | `dev/demo` | Operator convenience input; complete canonical scope is revalidated and cannot supply an approval/receipt |

## Evidence links

- Per-rule audit verdict table (10 rules, one demonstrated verdict each):
  [`./rda-adapter-boundary-audit.md`](./rda-adapter-boundary-audit.md)
- Two-host replacement harness (same bounded fixture through Pi and an
  independent substitute host over the pinned kernel; canonical authority
  projection equivalence + five negative controls):
  [`../../__tests__/adapter-boundary-replacement.test.ts`](../../__tests__/adapter-boundary-replacement.test.ts)
  and its fixtures
  [`../../__tests__/fixtures/rda-replacement-fixture.ts`](../../__tests__/fixtures/rda-replacement-fixture.ts),
  [`../../__tests__/fixtures/rda-substitute-host.ts`](../../__tests__/fixtures/rda-substitute-host.ts)
- Audit guard tests (materiality ownership, agent ceilings, UNKNOWN zero
  retries, store non-authority, delegation closure):
  [`../../__tests__/adapter-boundary-audit.test.ts`](../../__tests__/adapter-boundary-audit.test.ts)
- OpenSpec verify report: `openspec/changes/pi-sdd-040-adapter-boundary/verify-report.md` (when it exists)

## Master alignment

Pi contributes **host-side structural proof only**. The authority record for
RDA v2 behavior is the master change
`drenyra-ai/openspec/changes/sdd-040-rda-v2/`, coordinated on 2026-08-15. Its
final closure identity is bound during verification of this change. This
document does **not** reproduce the master's 41-requirement implementation
mapping or its acceptance evidence, and it does not resolve, relabel, or
re-implement the master's five deferred vocabulary differences — those remain
master-owned follow-up context. Audit, harness, and documentation evidence use
the kernel vocabulary unchanged (materiality tiers R0–R3, receipt types,
mission statuses, gate stages).

## Checklist for maintainers

- [ ] The seven-step flow matches the operator experience end to end.
- [ ] Every local store reference above is labeled `dev/demo` or `non-authoritative cache`; no sentence implies local data can authorize, approve, or prove fiscal execution.
- [ ] Every fail-closed row names both the stop behavior and the resumption actor/action.
- [ ] The audit table and the harness test links resolve; the master's mapping is not duplicated here.
