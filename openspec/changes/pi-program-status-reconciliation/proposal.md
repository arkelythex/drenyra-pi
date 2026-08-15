# Change: Pi Program Status Reconciliation

> Change: `pi-program-status-reconciliation`
> Product: `drenyra-pi`
> Status: reconciled (documentation/state reconciliation — **NOT an SDD**)
> Artifact store: openspec (files authoritative; engram best-effort)
> Date: 2026-08-14
> Baseline: checked-out `main` (`c354274`)

## 0. What this change is — and is not

**This is NOT an SDD change.** It runs no SDD phase (`proposal → specs → design →
tasks → apply → verify → archive`) and creates **no** `SDD-PI-*` artifacts.

- It is a **local state reconciliation**: it aligns this repository's public
  documentation with the verified state of the checked-out `main` baseline and
  with the user-decided public repository policy (2026-08-14).
- It **does not duplicate or re-define** any Drenyra Dominion program-master
  artifact. Master SDDs keep living in `arkelythex/drenyra-ai`; this change only
  **links/references** them (see §2).
- It changes **documentation and configuration only** (`ROADMAP.md`, `README.md`,
  `RELEASING.md`, `openspec/config.yaml`, the two draft contracts,
  `docs/architecture/ecosystem-boundaries.md`). No implementation code and no
  user-owned dirty changes were touched.
- No commit was created (handoff boundary: `Do not commit`).

## 1. Executive summary

The repository's documentation lagged its own `main` baseline in four places:

1. **Visibility claim.** README, RELEASING, and `openspec/config.yaml` described
   the repository as **private**. The user selected **public repository policy**
   on 2026-08-14; the docs now state public, source-available visibility under
   the existing proprietary license.
2. **Runtime pin.** The two draft contracts still described `DEFAULT_PIN` as
   `pending-release` (`0.0.1-prealpha.1`). The source (`runtime/pin.ts`) pins
   **`drenyra-ai@0.2.0`, state `released`**, with entry-artifact checksum
   `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`
   (`vendored/drenyra-ai-0.2.0.tgz` present).
3. **"No implementation" claim.** `docs/architecture/ecosystem-boundaries.md`
   said "contracts only … no implementation yet". `main` actually ships a wired
   harness: **16 registered `/drenyra:*` commands**, **4 chains**, **7 agents**,
   pinned runtime bootstrap, and fail-closed doctor.
4. **Obsolete PR #7/#8 / `not_available` claims.** `contracts/package-contract.md`
   claimed `evidence`/`verify`/`reconcile` register `not_available` denials
   "until their chains land (PR #7/#8)". Those chains **have landed** and are
   wired (`chains/evidence.ts`, `chains/verify.ts`, `chains/reconcile.ts`,
   `chains/monthly-close.ts`); the claims were removed.

## 2. Program alignment — links to the master SDDs (no duplication)

Drenyra Pi is a participant in the [Drenyra Dominion Program](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion)
(the federated program master in `arkelythex/drenyra-ai`). Per the program's
master + vertical SDD model, this repository holds only its local change plus a
reference to the master; **full specs are never copied here**.

| Master SDD (in `arkelythex/drenyra-ai`) | Role in Drenyra Pi | Reference status |
| --- | --- | --- |
| [SDD-020 — Universal Agent Configurator](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-020-configurator) | Served primarily by Drenyra Pi: `install`, `doctor`, `sync`, `upgrade`, `rollback` plus host integration | Referenced from this repo's `README.md`; master artifacts **not** present here |
| [SDD-030 — Organic Accounting Work Routing](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-030-routing) | Direct / delegated / durable-mission routing from evidence and risk | Referenced from this repo's `README.md`; master artifacts **not** present here |
| [SDD-040 — Receipt-Driven Accounting v2](https://github.com/arkelythex/drenyra-ai/tree/main/openspec/programs/drenyra-dominion/sdds/sdd-040-rda-v2) | Frozen candidate, proportional review, bounded correction, reusable receipt (RDA v2 chains) | Referenced from this repo's `README.md`; master artifacts **not** present here |
| SDD-010, SDD-050, SDD-070, SDD-080, SDD-090, SDD-110 | Program-master SDDs identified by the broad audit (Gate 0 / fiscal-authority-kernel / capability-matrix / program-lock lineage) | **Reference-only, verified 2026-08-14** — master `drenyra-ai/openspec/programs/drenyra-dominion/` catalog defines SDDs 000–110 incl. 010/050/070/080/090/110; **not copied here, no Pi-local artifacts** |

**Blocker B1 (federated) — RESOLVED 2026-08-14:** the SDD-010/050/070/080/090/110
master artifacts are not present in this repository (by design — participant repos
hold only references). The authoritative master context in
`arkelythex/drenyra-ai/openspec/programs/drenyra-dominion/` was verified this date:
the master owns those SDDs; Pi's served SDD-020 is **planned** (Wave 1) and gated
by master Gate 0 (**IN PROGRESS**); **no Pi-local implementation proceeds until the
master promotes readiness**. The sibling `sdd-010-gate0-audit` exploration is
archived/closed with this outcome (see
`openspec/changes/archive/2026-08-14-sdd-010-gate0-audit/archive-report.md`).

## 3. Verified local state (reconciled facts)

Every fact below is corroborated from tracked `main` sources in this worktree;
no tests or package verification were re-run (documentation-only change), so
**no new test/verification evidence is claimed**.

| Item | Verified fact | Evidence source |
| --- | --- | --- |
| Runtime pin | `drenyra-ai@0.2.0`, state `released`, checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047` (SHA-256 of release entry artifact `dist/cmd/cli.js`, the artifact `doctor()` checksums) | `runtime/pin.ts` (`DEFAULT_PIN`); `runtime/doctor.ts`; `vendored/drenyra-ai-0.2.0.tgz` present |
| Command surface | **16 commands** registered: `status`, `doctor`, `company`, `period`, `context`, `capabilities`, `scope`, `models`, `close`, `mission`, `continue`, `resume`, `receipt`, `evidence`, `verify`, `reconcile` (13 `provides`) | `extensions/register.ts` (`drenyraPiExtension.commands`) |
| Chains | **4 wired chains**: `monthly-close`, `reconcile`, `verify`, `evidence` — handlers are behavioral (parse → scope policy → chain → structured render); the legacy `not_available` denial helpers remain in `extensions/mission-commands.ts` but are **no longer wired** | `chains/*.ts` (tracked); `extensions/register.ts`; `lib/chain-pipeline.ts` |
| Agents | **7 roles** with mirrored assets: accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller | `agents/` + `agents/README.md`; `assets/agents/` |
| Contracts — frozen | 15 versioned JSON schemas + `contracts/SHA256SUMS.json`; 9 canonical specs in `openspec/specs/` | `contracts/`; `openspec/specs/` |
| Contracts — still open (draft) | `package-contract` and `runtime-dependency` remain **0.1-draft** — not frozen; contract freeze is ROADMAP Phase 1, still open | `contracts/package-contract.md`, `contracts/runtime-dependency.md`, `contracts/README.md` |
| Package | `drenyra-pi@0.0.1-prealpha.1` (ESM, node ≥22, zero runtime deps, `drenyra-ai` pinned tgz devDependency) | `package.json` (read-only) |
| Release gate | Verification-only gate (`release-verify` workflow); no publication anywhere in automation | `RELEASING.md`; `.github/workflows/release-verify.yml` |
| Test evidence (archived) | 493 tests / 29 files passing at revision `a82a2c2` (2026-08-04, archived change verify-report); **not re-run** in this change | `openspec/changes/archive/2026-08-04-evidence-driven-accounting-harness/verify-report.md` |

## 4. Documentation changes and decisions

| Path | Change | Rationale |
| --- | --- | --- |
| `README.md` | Replaced "Private commercial product — repository is private" with public, source-available visibility under the proprietary license | User-decided public repository policy (2026-08-14) |
| `RELEASING.md` | "Current state" updated: public repository, verification-only release gate unchanged; publish step condition #1 (repo made public) now satisfied | Same decision; npm publication remains off |
| `openspec/config.yaml` | `description` visibility updated to public/source-available; `current_test_state` attributed to archived evidence (not re-run) | Same decision; no unsupported test claims |
| `ROADMAP.md` | "Public roadmap and architecture published" checked; date/status refreshed; contract-freeze items stay unchecked | Docs committed + visibility decided; contracts still draft |
| `contracts/runtime-dependency.md` | Reference-implementation row updated: `DEFAULT_PIN` is `released` at `0.2.0` with the real entry-artifact checksum | Fact from `runtime/pin.ts` |
| `contracts/package-contract.md` | Removed obsolete PR #7/#8 + `not_available` claims (commands row, mission-commands row, mission-coordinator row); pin row updated to released state | Chains landed and wired on `main` |
| `docs/architecture/ecosystem-boundaries.md` | "Current state and maturity" corrected: harness is implemented (16 commands / 4 chains / 7 agents / released pin); only the two draft contracts remain open | Corrects the stale "no implementation yet" claim |

## 5. Remaining blockers (open state, not fabricated as done)

| ID | Severity | Blocker |
| --- | --- | --- |
| B1 | HIGH → **RESOLVED (2026-08-14)** | Program-master SDDs (SDD-010/050/070/080/090/110) absent from this worktree — resolved by verifying the master context at `arkelythex/drenyra-ai/openspec/programs/drenyra-dominion/` (master owns them; SDD-020 planned, gated by Gate 0 / Wave 1) and by archiving/closing the `sdd-010-gate0-audit` exploration with that outcome |
| B2 | HIGH | GitHub-side visibility setting not verifiable from this worktree; the public decision is recorded here, but the remote `Settings` state must be confirmed outside this change |
| B3 | MEDIUM | `package-contract` and `runtime-dependency` remain `0.1-draft`; Phase 1 freeze (ROADMAP) is still open — no contract freeze is claimed |
| B4 | MEDIUM | npm publication still off (verification-only gate); explicit recorded decision required before any publish step |
| B5 | LOW | Current test/verification counts were not re-run in this documentation-only change; archived evidence (493/29 at `a82a2c2`) is the most recent corroborated record |

## 6. Scope and non-goals

- **In scope:** public-visibility documentation, pin/state reconciliation,
  obsolete-claim removal, OpenSpec reconciliation record.
- **Non-goals:** no SDD phases, no `SDD-PI-*` artifacts, no master-SDD
  duplication, no source-code edits, no commit/PR, no test-suite runs, no
  contract freeze, no npm publish, no modification of user-owned dirty changes
  (the `sdd-010-gate0-audit` exploration was **archived/closed 2026-08-14**
  under explicit user authorization — see
  `openspec/changes/archive/2026-08-14-sdd-010-gate0-audit/archive-report.md`;
  it was not modified as part of this reconciliation).

## 7. Risks

| ID | Severity | Risk |
| --- | --- | --- |
| R1 | MEDIUM | Claiming "public" before the remote visibility is confirmed on GitHub (B2) — the docs state the decision; remote confirmation remains pending |
| R2 | LOW | Archived test evidence (`a82a2c2`) may not match the current dirty worktree; no current-session run was performed, and none is claimed |

## 8. Result contract

- `status`: `completed` (documentation-only slice; no tests to run)
- `executive_summary`: reconciled this repo's public docs to its own `main`
  baseline and the user-decided public visibility; corrected the stale
  `pending-release` pin description, the "no implementation" claim, and the
  obsolete PR #7/#8 / `not_available` claims; recorded program-master references
  without duplicating them; listed remaining federated blockers.
- `artifacts`: this record at
  `openspec/changes/pi-program-status-reconciliation/proposal.md` (+ the seven
  reconciled documentation/configuration files listed in §4).
- `next_recommended`: confirm GitHub-side visibility (B2); **B1 resolved** — no
  Pi-local action until the master promotes Gate 0 / Wave 1 readiness (SDD-020
  stays gated); decide contract freeze (B3) and npm publication (B4) as
  separate, human-owned changes.
- `risks`: R1..R2 (§7).
- `skill_resolution`: `paths-injected` (scope-discipline, evidence-citation,
  cognitive-doc-design, work-unit-commits loaded before work).
