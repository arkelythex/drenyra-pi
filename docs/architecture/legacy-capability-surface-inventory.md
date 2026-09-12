# Legacy capability surface inventory and retention decision record

**Change:** `pi-capability-conformance` — PR 4, the final implementation unit of local SDD 1 of 6.
**Requirement:** REQ-CONF-008 — Legacy surface retention criteria.
**Decision:** every candidate recorded below is **retained**. This change deletes nothing.

The retention checks in this record were run from the canonical repository root on the dirty
candidate whose identity is published in
[`program-lock-facts.json`](program-lock-facts.json#/candidateIdentity). Exact command outputs are
recorded in `openspec/changes/pi-capability-conformance/apply-progress.md` (PR 4 section).

## Retention boundary

A legacy helper, compatibility path, historical document, or archived artifact **stays in place**
unless a separately bounded change supplies all four of:

1. a **replacement**, or an **explicit compatibility decision** recorded with its approver and date;
2. **package verification** over the resulting candidate (`bun run verify:package`);
3. **focused regression evidence** that the recorded consumer's behavior is preserved;
4. an updated **snapshot record** — command, complete result, date, candidate identity, and
   baseline/dirty classification — proving steps 1–3 ran on the very candidate that performs the
   removal.

Lack of current wiring is **not** one of those conditions and never substitutes for them
(REQ-CONF-008). "No caller found" is a finding to record, not a removal proof: an unproven consumer
is written here as **unknown**, never as "safe to delete".

## Scope of discovery

Candidates were discovered only from the seven concrete conformance surfaces PR 4 names:

- `capability-manifest.yaml`
- `docs/architecture/capability-conformance-matrix.md`
- `docs/architecture/harness-draft-conformance.md`
- `README.md`
- `ROADMAP.md`
- `scripts/verify-capability-manifest.mjs`
- `scripts/refresh-program-lock-facts.mjs`

Each was read read-only. None was edited or deleted by this unit, and the inventory itself is **not**
declared as a verified projection surface, so `bun run verify:capability` neither reads nor enforces
it (see the PR 4 RED note in `tasks.md`). Consumers were checked by repository-wide search, so
`known` below means at least one concrete consumer was found and cited. `openspec/changes/pi-skills-memory-integration/`
(SDD 2) and every other change are outside these surfaces and are not inventoried here.

## Inventory

Consumer certainty: `known` = at least one concrete consumer found and cited; `unknown` = no consumer
found in the seven surfaces or by repository-wide search. `unknown` is not a safety proof.

### A. Historical snapshot and evidence records

| ID | Candidate | Named by (evidence source) | Known consumers | Disposition |
| --- | --- | --- | --- | --- |
| A1 | Preserved historical candidate identity `dirty-sha256:38ee713f27740b1dbdb43288a1a165d2d1e0bfb1ecbf805f1bb2fd0470464097` (evidence date 2026-09-09) | matrix, "Preserved historical snapshot identity" note and its `conformance:snapshot scope=historical` marker | `scripts/verify-capability-manifest.mjs` requires every `conformance:snapshot` marker to carry a source and rejects a historical snapshot that is not labeled; the matrix snapshot reconciliation | retained |
| A2 | Preserved historical evidence baseline `dirty-sha256:a4ea5d711584c94b175f585384991c37714a8b5e9690192a2d84655456ba601c` with 47 test files / 717 passing / 0 failed | matrix, "Preserved historical evidence baseline" note and its `conformance:snapshot scope=historical … result="47 test files / 717 passing / 0 failed"` marker | same guard rule as A1; the matrix reconciliation row that separates it from the 44/700 and 48/738 records | retained |
| A3 | `capability-manifest.yaml#testState` — 44 files / 700 passing, `evidenceScope: historical`, `evidenceSource: docs/architecture/ecosystem-boundaries.md#current-state-and-maturity` | `capability-manifest.yaml` `testState`; matrix "Manifest embedded test state" row; the manifest `evidenceSnapshot.note` | `scripts/verify-capability-manifest.mjs` `testState` validation (scope label plus required `evidenceRef`); the matrix reconciliation row | retained |
| A4 | `program-lock-facts.json` preserved `tests` block (48 files / 738 passing), `evidenceDate: 2026-09-09`, and the older `derivationCommands`, with the `snapshotRecord` label | `scripts/refresh-program-lock-facts.mjs` `validatePreservedFields`; matrix "Generated lock-fact test evidence" row | `scripts/refresh-program-lock-facts.mjs` fails closed when `evidenceDate` or `derivationCommands` is malformed; `__tests__/refresh-program-lock-facts.test.ts` preserves the block byte-for-byte; `scripts/verify-capability-manifest.mjs` pins `EXPECTED_EVIDENCE_REF = "docs/architecture/program-lock-facts.json#/tests"`; the matrix row | retained |
| A5 | Historical run recorded in `harness-draft-conformance.md` §2 — 44 files / 703 passing / 0 failed, with typecheck, package, capability and style gates green at baseline `HEAD = 1eec8e9` (observed 2026-08-18) | `harness-draft-conformance.md` §2, self-labeled "preserved as historical evidence and is not relabeled" | readers following the README link to that document; no machine consumer found — **unknown** beyond the document itself | retained |
| A6 | Superseded contract-version assertion `0.1-draft` (2026-08-18) | `harness-draft-conformance.md` §5 open/partial items row | `contracts/README.md` is the current authority (Frozen v0.1); the harness record keeps the superseded observation | retained |

### B. Historical documents and archived artifacts

| ID | Candidate | Named by (evidence source) | Known consumers | Disposition |
| --- | --- | --- | --- | --- |
| B1 | `docs/architecture/harness-draft-conformance.md` — the historical "SDD-050 — Drenyra Pi" draft conformance record | its own historical-snapshot disclaimer header; README, "Drenyra Dominion Program" section (inline link) | the README link is the only inbound link found in the seven surfaces; the document links out to the matrix | retained |
| B2 | Archived OpenSpec changes `2026-08-15-pi-sdd-010-participation`, `2026-08-15-pi-sdd-030-routing-adapter`, `2026-08-15-pi-sdd-040-adapter-boundary` | `harness-draft-conformance.md` §1 numbering reconciliation and §4 deviations table; `capability-manifest.yaml#derivedFrom` | those citations; all three directories exist under `openspec/changes/archive/` and hold the delivered evidence for the harness record | retained |
| B3 | `openspec/changes/archive/2026-09-09-pi-accounting-orchestration/verify-report.md` | `program-lock-facts.json#snapshotRecord.evidenceSource`; matrix "Generated lock-fact test evidence" row | the lock-facts `snapshotRecord.evidenceSource` label; the matrix row that cites it as the source of the 48/738 record | retained |
| B4 | `capability-manifest.yaml` provenance fields `generatedAt: 2026-08-14T00:00:00Z` and `derivedFrom` (`arkelythex/drenyra-ai@4975f4f capability-matrix.yaml Pi row (read-only)`, `package.json version (drenyra-pi)`, `design §5.2 state table (pi-sdd-010-participation)`) | `capability-manifest.yaml` | **unknown** — repository-wide search found no script or test that reads `generatedAt` or `derivedFrom`; the `design §5.2 state table` entry additionally cross-references B2 | retained |

### C. Legacy helpers and compatibility paths

| ID | Candidate | Named by (evidence source) | Known consumers | Disposition |
| --- | --- | --- | --- | --- |
| C1 | `lib/mission-commands.ts` `createDurableMissionRoutingPort` — a production routing port with no live command consumer | matrix `drenyra-commands` row; `capability-manifest.yaml#capabilities.drenyra-commands.evidence.note` | `__tests__/routing/mission-routing-seam.test.ts` and `__tests__/extension-mission-commands.test.ts` (test-only); the matrix and manifest both state it is not wired into any live command, so the non-test consumer is **unknown** | retained |
| C2 | `chains/monthly-close.ts` RECONCILE no-op phase-only fallback, taken whenever `reconcileManifest` is omitted | matrix `rda-chains` row; `harness-draft-conformance.md` §3 (Draft §7 criterion 5) | **a live consumer** — the `/drenyra:close` handler (`extensions/register.ts`, `closeHandler`) calls `MonthlyCloseChain.run` without `reconcileManifest`, so the fallback is the current production RECONCILE path; also `chains/__tests__/monthly-close-flow.test.ts` | retained |
| C3 | `chains/reconcile.ts` two-tier bank-movement / bank-statement confirmation model | matrix `rda-chains` row ("the two-tier bank-movement/bank-statement confirmation model from `reconcile.ts` is intentionally not replicated here (tracked follow-up)") | `chains/reconcile.ts` itself and `chains/__tests__/reconcile.test.ts`; the monthly-close journey deliberately bypasses it, so a consumer outside `reconcile.ts` is **unknown** | retained |
| C4 | `runtime/context.ts` development-grade local JSON context store standing in for canonical Engram memory integration (REQ-BOUND-001) | matrix `engram-integration` row; `capability-manifest.yaml#capabilities.engram-integration.evidence.limitation`; `ROADMAP.md` Phase 2 note | `runtime/context.ts` `ScopeContextStore`, extension handlers that read context, and `__tests__/extension.test.ts`; it is the only implemented context store while the canonical replacement is explicitly deferred | retained |
| C5 | `lib/routing/direct-port.ts` compatibility convention mirroring `createDurableMissionRoutingPort`'s synthetic provenance (`elapsedMs: 0`, `tokens: 0`) | matrix `drenyra-commands` row; the module's own doc comment (read as discovery input, not edited) | `extensions/register.ts` `statusHandler` — wired into `/drenyra:status route`; `__tests__/routing/direct-port.test.ts` | retained |

### D. Historical labels retained inside current surfaces

| ID | Candidate | Named by (evidence source) | Known consumers | Disposition |
| --- | --- | --- | --- | --- |
| D1 | Historical test title "registers the 15 intended commands plus company, context, install and sync (19 commands)" in `__tests__/extension.test.ts` | matrix `drenyra-commands` row ("The test name is historical wording; its assertion and current surface are 20 commands") | the matrix citation; the test's own assertion of 20 registered commands | retained |
| D2 | `capability-manifest.yaml#testState.evidenceRef` → `docs/architecture/program-lock-facts.json#/tests` — a current-surface field that must point at the historical lock-facts block | `scripts/verify-capability-manifest.mjs` `EXPECTED_EVIDENCE_REF`, which fails closed when `testState.evidenceRef` differs; `capability-manifest.yaml#testState` | `scripts/verify-capability-manifest.mjs`; `__tests__/capability-manifest.test.ts` | retained |
| D3 | `ROADMAP.md` historical date labels (`Last updated: 2026-08-14`; "Gate note (reference-only, 2026-08-14)") | `ROADMAP.md` | the guard's `conformance:surface` and `conformance:snapshot scope=current` markers declared in the same file; readers | retained |

## Removal bar applied to these candidates

None of A1–A6, B1–B4, C1–C5 or D1–D3 satisfies the four-part bar above, so every one is retained and
recorded for later bounded review. Two properties make the bar strictly harder for several of them:

- **Live-path candidates.** C2's fallback is the current production RECONCILE path, not idle code, so
  its removal needs a replacement plus regression evidence for `/drenyra:close`.
- **Identity-input candidates.** A3, B4, D2 and A4's guard coupling touch `capability-manifest.yaml`,
  `scripts/verify-capability-manifest.mjs`, and `__tests__/capability-manifest.test.ts`, all members of
  the candidate-identity participation set. Any future change that mutates them additionally
  invalidates `docs/architecture/program-lock-facts.json` and must run the mandatory recovery sequence —
  stated once, with its trigger set and ordering rationale, in
  [program-lock-facts.md](program-lock-facts.md).

## Negative verification — nothing was deleted

| Check | Method | Result |
| --- | --- | --- |
| Archived artifacts intact | `ls openspec/changes/archive/` and confirmation that B2/B3's cited directories exist | all cited archives present |
| Surface citations resolve | existence check of every source, test, and document cited in the retention-relevant rows above | every citation resolves |
| No new tracked deletion | `git status --short` compared before and after this unit's edits | no new `D` entry; the only deletion, `themes/fiscal-operator/manifest.json`, is pre-existing work from another session and was not touched |
| Frozen and prohibited surfaces untouched | `git status --short` attribution of `contracts/README.md` and `contracts/SHA256SUMS.json` | modified by pre-existing work, not by this unit; read-only discovery inputs |
| Candidate-identity inputs untouched | `node scripts/refresh-program-lock-facts.mjs --check` | no identity input in the participation set was mutated, so the generated facts remained current and no refresh was required |

## Consumer unknowns — recorded, not resolved

- B4 `generatedAt` / `derivedFrom`: no machine consumer found.
- A5 the 44/703 run and A6 the `0.1-draft` assertion: no machine consumer found.
- C1 `createDurableMissionRoutingPort`: no non-test consumer found.
- C3 the two-tier confirmation model: no consumer found outside `chains/reconcile.ts`.

Each remains **retained**. An unknown consumer is the reason a later change must supply compatibility
evidence, not the reason this one may delete.

## Authority boundary

This record is additive conformance evidence. It creates no new authority, grants Pi no fiscal
authority, promotes no capability's verification level, and authorizes no removal. Pi operates and
never authorizes; fiscal authority remains in the pinned `drenyra-ai` kernel.
