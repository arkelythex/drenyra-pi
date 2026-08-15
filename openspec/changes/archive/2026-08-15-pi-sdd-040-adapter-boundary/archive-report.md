# ARCHIVE REPORT — pi-sdd-040-adapter-boundary

**Change**: `pi-sdd-040-adapter-boundary` — prove Drenyra Pi is a replaceable RDA host
**Repo**: `drenyra-pi` (Bun + TS ESM, vitest, Pi extension package, pinned `drenyra-ai@0.2.0` vendored)
**Archived at**: `openspec/changes/archive/2026-08-15-pi-sdd-040-adapter-boundary/`
**Archive date**: 2026-08-15
**Artifact store**: HYBRID (openspec/ files authoritative; engram best-effort)
**Status**: **COMPLETED — CLOSED** (archive PASS)

---

## 1. Executive summary

This change proved, rather than merely documented, that Drenyra Pi is a
replaceable agentic-runtime host for Drenyra AI's deterministic fiscal-authority
kernel. It audited every prohibited authority behavior, delivered an independent
two-host replacement harness comparing Pi against a minimal substitute host over
the same pinned, published runtime and mission, and published the adapter
boundary for maintainers. No Pi-local boundary violation was found; the audit
recorded zero tracked-source changes and the ownership criterion held on every
rule. The change is closed at **verify PASS 30/30 requirements** and the master
closure identity is bound.

## 2. Final-state facts (authoritative at close)

- **Verify verdict: PASS 30/30 requirements** (REQ-AUDIT-001..012, REQ-HARNESS-001..005,
  REQ-DOC-001..004, REQ-ALIGN-001..003, REQ-BOUND-001..006), 31/31 scenarios covered,
  **0 CRITICAL, 1 WARNING, 2 SUGGESTION**.
- **Independent re-runs** (all match apply claims, none trusted):
  - `bun test` → **623 pass / 0 fail**, 39 files, 3023 expect calls
  - `bun test __tests__/adapter-boundary-audit.test.ts` → **9 pass / 0 fail** (140 expect calls)
  - `bun test __tests__/adapter-boundary-replacement.test.ts` → **8 pass / 0 fail** (258 expect calls)
  - `bun run typecheck` → clean (`tsc --noEmit` exit 0)
  - `node scripts/verify-package-files.mjs` → OK (runtime `drenyra-ai@0.2.0` reconciled, checksum `e4e81914…c047`)
  - `bun run verify:style` → OK; `bun run verify:capability` → OK
- **Master closure identity BOUND during verify:** `drenyra-ai` archived change
  `openspec/changes/archive/2026-08-15-sdd-040-rda-v2/` at commit `c4d2b6a`
  (`docs(openspec): close and archive SDD-040 RDA v2 core (#42)`), branch
  `docs/final-hygiene` @ `4c5e15f`, master verify `PASS` (843/843, docs-only
  closure). This binds REQ-ALIGN-001.
- **Deliverables:**
  - `docs/architecture/rda-adapter-boundary-audit.md` — 10/10 rule verdicts PASS, evidence-cited
  - `docs/architecture/rda-adapter-boundary.md` — 7-step flow, per-step ownership, fail-closed, store classification
  - `__tests__/adapter-boundary-audit.test.ts` — 9 tests
  - `__tests__/adapter-boundary-replacement.test.ts` — 8 tests incl. 5 negative controls
  - `__tests__/fixtures/rda-replacement-fixture.ts` + `rda-substitute-host.ts` — kernel-only imports, anti-circularity proven
- **Size exception recorded:** PR-2 (harness) measured **1,742 authored lines** vs
  the 300–420 forecast (total 2,329 vs 670–1,010 forecast) — carried under the
  orchestrator's standing size exception for verification-heavy changes
  (user-approved single-pass pattern + no-pares directive). Delivery planned as a
  3-PR chain stacked-to-main (PR1=audit, PR2=harness, PR3=doc+evidence) per repo
  #34/#35 precedent.
- **Boundaries confirmed:** no `drenyra-ai` edit; pin `drenyra-ai@0.2.0` + checksum
  unchanged; no new commands/agents; no runtime/vendored changes; no commit/PR
  created by apply; stores remain dev/demo | non-authoritative cache; no unreleased
  module consumption.
- **Known non-blocking items:** W-1 PR-2 volume (delivery shape decision recorded,
  T-GATE-002); S-1 source-level assertions coupling (future refactor watch);
  S-2 pre-existing untracked `openspec/changes/archive/2026-08-15-pi-roadmap-publication/proposal.md`
  — unrelated leftover state from an earlier preservation, NOT part of this change
  (left untouched).

## 3. Delivered artifacts (moved to archive, unchanged)

- `proposal.md` — decision, intent, non-goals, first-slice scope
- `design.md` — §3.3 ownership proof mandate, §4.5 exact normalization exclusions
- `tasks.md` — 12 implementation tasks, all `- [x]`
- `apply-progress.md` — TDD cycle evidence + apply record
- `verify-report.md` — PASS 30/30
- `specs/adapter-boundary/spec.md` + `specs/README.md`

## 4. Spec sync disposition

- **No canonical sync performed** (no `sync-report.md`; parent explicitly directed
  a filesystem-only move preserving all files incl. `specs/`).
- Domain `adapter-boundary` has **no counterpart** under `openspec/specs/` — this is
  a new, evidence-only domain and this change makes **zero tracked production
  changes** (REQ-BOUND-001). No ADDED/MODIFIED/REMOVED canonical requirement
  merge applies. No destructive merge guard triggered.
- No same-domain active change under `openspec/changes/*/specs/adapter-boundary/`
  was detected at archive time.

## 5. `payloadHash` exclusion rationale (design §4.5 exclusion #1)

The `receipt.claims.payloadHash` normalization exclusion is **justified, narrow,
and does not hide an authority difference**:

- **Justification:** the payload hash covers the binding record which embeds the
  runtime-generated authorization-record id (`auth-<host-mission-id>-close`);
  exact cross-host equality would require changing Pi production `sealClose`
  (whitelist-forbidden absent a demonstrated violation).
- **Narrowness:** it is 1 of 8 enumerated exclusions (the other 7 are
  `runtimeMetadata` ids/timestamps/signing material). All other authority-bearing
  fields are compared exactly (`receipt.type`, `receipt.binding.scopeHash/evidenceHash/
  policyVersion/targetHash`, `receipt.claims.*`, `receipt.verified`).
- **Tested:** the harness proves the payloadHash differs between runs while
  `receipt.binding` and the claims stay exactly equal; a tampered payload fails
  `verifySignedReceipt` → `receipt.verified` false → compared and caught; the
  21-entry authority-category mutation matrix proves every retained category
  changes the projection.
- **Residual (SUGGESTION):** if the kernel ever makes the authorization id
  deterministic, this exclusion should be re-evaluated.

## 6. Audit finding — materiality ownership (REQ-AUDIT-004)

The source audit found `deriveRequiredMateriality` **does not independently compute
R0–R3**: in `lib/authority-gates.ts` it validates the input, calls the imported
kernel `deriveMateriality(request.input)`, then compares against an optional
declared `minimum` through the imported kernel `orderOf` — the floor only raises
the kernel result, never lowers or replaces it. **Ownership criterion holds; no
Pi-local violation was found.** WU1 turned this into executable ownership evidence:
a live comparison against the public kernel over a 6-row R0–R3/irreversible/non-PE
table, a `max(kernel, minimum)` via `orderOf` that never lowers, fail-closed rows
that throw on missing/invalid input (never R0), and a source-level body assertion
requiring the direct `deriveMateriality(request.input)` call before the floor.

## 7. Program alignment

The program master closed **SDD-040 (RDA v2)** as a documentation-only
reconciliation (RDA v2 already implemented and verified in `drenyra-ai`). Pi
contributes the **host-side structural proof** only — no `drenyra-ai` file was
changed and no master content was duplicated. REQ-ALIGN-001..003 verified: master
closure referenced as authority record (`sdd-040-rda-v2`, coord. 2026-08-15,
commit `c4d2b6a`), no duplication of the master's 41-requirement mapping, kernel
vocabulary preserved unchanged.

## 8. Non-goals confirmed

- **No RDA v2 implementation in Pi** (REQ-BOUND-001): `git diff --name-only` empty;
  no materiality/transition/risk/approval/gate/receipt/ledger/UNKNOWN-retry logic added.
- **No runtime pin change** (REQ-BOUND-002): `drenyra-ai@0.2.0` + checksum unchanged.
- **No new command, agent, or operator workflow** (REQ-BOUND-003).
- **No local store becomes authoritative** (REQ-BOUND-004): guard tests prove local
  persistence alone cannot authorize/approve/execute.
- **No master-repository edit, no out-of-band delivery** (REQ-BOUND-006).

## 9. Rollback notes

The change is **purely additive** (new tests/docs/fixtures) with **zero tracked
production modifications** — a full rollback is simply deleting the added files
`docs/architecture/rda-adapter-boundary(-audit).md`, `__tests__/adapter-boundary-*`,
`__tests__/fixtures/rda-replacement-fixture.ts` and `rda-substitute-host.ts`. No
existing behavior, dependency, pin, or store semantics changed, so no behavioral
reversal is required. The archived OpenSpec artifacts preserve the full audit trail.

## 10. Archive move record

- **Source**: `openspec/changes/pi-sdd-040-adapter-boundary/`
- **Destination**: `openspec/changes/archive/2026-08-15-pi-sdd-040-adapter-boundary/`
- **Operation**: `mkdir -p` + `mv` of the whole directory (all files incl. `specs/`).
- **Move verified**: all files present at destination, old root gone.
- **Out of scope / untouched**: implementation files, the `drenyra-ai` repo, the
  unrelated `openspec/changes/archive/2026-08-15-pi-roadmap-publication/`, and no
  commit/PR created.
- **Post-archive**: the change is closed; delivery of the code artifacts proceeds
  via the orchestrator's 3-PR chain (separate, after archive).

## 11. Structured status / actionContext findings

- Artifact store mode: HYBRID (openspec authoritative; engram best-effort).
- Native status treated as non-authoritative for this change; readiness resolved
  from the persisted artifacts (verify PASS present).
- No archive blockers: verify report present and passing; tasks complete (no
  unchecked implementation `- [ ]`; only parent-owned T-GATE-* delivery gates
  remain); no destructive canonical merge; allowed edit roots respected
  (all writes under `openspec/changes/`).
