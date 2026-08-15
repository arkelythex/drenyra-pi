# Exploration — SDD-010 Gate 0 Audit

**Repo**: `drenyra-pi` (Bun + TS ESM, vitest, Pi extension package, pinned `drenyra-ai@0.2.0`)
**Phase**: `sdd-explore` (read-only) — Gate 0 audit only
**Artifact store**: openspec (files authoritative; engram best-effort)
**Scope discipline**: fail-closed on missing/misreferenced scope
**Date**: session-relative
**Status**: **BLOCKED** — audit foundation is not present in this repository

---

## 1. Executive summary

The Gate 0 audit cannot be closed from the evidence available in this worktree.
Every audited item except the "frozen contracts / root documents" item references
program-level artifacts (`SDD-010`, `Gate 0`, `fiscal-authority-kernel`,
`bounded-agent-roles`, `capability-matrix` recalculation, `program-lock`) that do
**not exist anywhere** in `drenyra-pi`. The repository's own documentation
(`README.md`, `ROADMAP.md`) locates the SDD program master — including `SDD-020`,
`SDD-030`, `SDD-040` — in the **parent** `arkelythex/drenyra-ai` repository under
`openspec/programs/drenyra-dominion/sdds/`, which is **not present in this worktree**.
The only change in this repo's OpenSpec store is fully archived and closed.

Recommendation: **do NOT create a proposal** in `drenyra-pi` until the orchestrator
supplies the Drenyra Dominion program-master context (the SDD-010/Gate 0 artifacts)
or confirms the intended planning location is the parent program repo. Creating a
proposal here would fabricate scope outside the authoritative store.

---

## 2. Method & evidence references (commands unavailable — file evidence only)

This executor has **no shell tool** and **no `mem_search` tool**. It could not run
`bun test`, `git status`, `git log`, or read Engram planning topics. All evidence is
**file-based**, via `read`/`grep` against the worktree. Current gate/test reproduction
is therefore **not independently reproducible in this session**; the most recent
reproducible gate evidence is the archived verify/archive records at revision
`a82a2c2` (see §3).

Evidence anchors inspected:

| Evidence | Path | Finding |
| --- | --- | --- |
| Config (authoritative) | `openspec/config.yaml` | store_mode `hybrid` (openspec files authoritative); strict_tdd true; test_command `bun test` |
| OpenSpec changes tree | `openspec/changes/**` | only `archive/2026-08-04-evidence-driven-accounting-harness/`; **no active change, no `sdd-010/` dir** |
| Canonical specs | `openspec/specs/{contracts,scope-binding,authority,evidence-graph,mission-protocol,commands,chains,agents,skills-prompts-themes}/spec.md` | 9 frozen domain specs |
| Frozen contracts | `contracts/**` (15 schemas + `SHA256SUMS.json`) | 4 families: mission, evidence, authority, receipts |
| Program alignment | `README.md`, `ROADMAP.md` | SDD-020/030/040 live in `arkelythex/drenyra-ai` Drenyra Dominion program, **not here** |
| Archival record | `openspec/changes/archive/2026-08-04-evidence-driven-accounting-harness/archive-report.md` | status PASS, evidence revision `a82a2c2`, 493 tests, 5 gates green, 31/31 tasks |

**Terminal search result**: repo-wide grep for
`Gate 0|fiscal-authority-kernel|bounded-agent-roles|program-lock|SDD-010` returned
**no matches** (the only `T-GATE-*` hits are the unrelated parent-owned lifecycle
gates of the archived change). No `SDD-010` directory, `Gate 0` checklist, or
issue-first document exists in this repository.

---

## 3. Audit items — explicit verdicts

### 3.1 Gate 0 — can it be closed with current reproducible evidence? — **BLOCKED**

- `Gate 0` is **not defined** anywhere in this repo (no checklist, readiness
  criteria, or gate definition file). It is a Drenyra Dominion program-master
  concept per `README.md`/`ROADMAP.md`, living in `arkelythex/drenyra-ai`.
- Current, reproducible gate evidence for *this* repo cannot be regenerated in
  this session (no shell). The most recent reproducible evidence is the archived
  change at `a82a2c2` (493 tests / 0 fail, typecheck+build+package-verify green) —
  that is the **archived v0.1 change**, not "Gate 0".
- **Verdict: BLOCKED.** Gate 0 cannot be closed from this worktree.

### 3.2 fiscal-authority-kernel — actual closure status — **FAIL (artifact not found)**

- No file, module, or artifact named `fiscal-authority-kernel` exists in this repo.
- Closest content is the archived authority machinery (`lib/authority-gates.ts`,
  `openspec/specs/authority/spec.md` REQ-AUTH-001..009), which belongs to the
  **archived** `evidence-driven-accounting-harness` change and has no standalone
  "kernel" closure status.
- **Verdict: FAIL.** Closure status is unverifiable here; no such artifact exists.

### 3.3 bounded-agent-roles — actual closure status — **FAIL (artifact not found)**

- No artifact named `bounded-agent-roles` exists in this repo.
- The archived change shipped exactly seven bounded accounting agents
  (`agents/`, `assets/agents/`, REQ-AGENT-001..009) — that change is closed/archived
  — but there is no distinct `bounded-agent-roles` auditable item with a closure status.
- **Verdict: FAIL.** Unverifiable here.

### 3.4 capability-matrix — recalculation from repository evidence — **BLOCKED**

- The only "capability matrix" in this repo is the archived command-family matrix
  (REQ-AUTH-007, `lib/authority-gates.ts` `AUTHORITY_ORDER`/`ACTION_FAMILY`), closed
  as part of the archived change.
- A standalone `capability-matrix` to "recalculate" does **not** exist as an artifact.
- **Verdict: BLOCKED.** Cannot recalculate an artifact that is not present.

### 3.5 program-lock — recalculation from repository evidence — **BLOCKED**

- `program-lock` does **not** exist anywhere in this repo (no file, variable, or
  doc reference). It is a program-master concept.
- **Verdict: BLOCKED.** Cannot be determined from this worktree.

### 3.6 SDD-010 state & exact pending deliverables — **BLOCKED**

- No `openspec/changes/sdd-010/` directory and no SDD-010 artifact exists in this
  repo. The README/ROADMAP reference only SDD-020/030/040 (from the parent program).
- SDD-010 state and pending deliverables are therefore **undeterminable** from the
  OpenSpec file store in this worktree.
- **Verdict: BLOCKED.** No active SDD change exists; SDD-010 is not evidenced here.

### 3.7 Frozen contracts & root documents that must remain untouched — **PASS (identifiable)**

These exist in this repo and must not be modified by the audit or any proposal:

- `contracts/` — 15 versioned JSON schemas (4 families: mission, evidence,
  authority, receipts) + `contracts/SHA256SUMS.json` (frozen package contracts).
- `openspec/specs/` — 9 canonical domain specs (contracts, scope-binding, authority,
  evidence-graph, mission-protocol, commands, chains, agents, skills-prompts-themes).
- `openspec/config.yaml` — authoritative config.
- `package.json` — pi manifest / exports / scripts (frozen install surface).
- `vendored/drenyra-ai-0.2.0.tgz` — pinned runtime artifact (never `PATH`).
- `openspec/changes/archive/2026-08-04-evidence-driven-accounting-harness/` —
  archived audit trail (appendix, not to be re-opened).
- `README.md`, `ROADMAP.md`, `docs/architecture/*`, `docs/style.md`,
  `RELEASING.md` — public/product boundaries and direction documents.
- **Verdict: PASS.** Identifiable; none were modified by this exploration.

### 3.8 Issue-first readiness — no branch/commit/PR before an approved issue — **BLOCKED**

- This exploration performed **no** branch/commit/PR and no source edits (read-only);
  the unrelated dirty worktree was left untouched (never cleaned/staged/reverted).
  So "no implementation before approval" is trivially preserved.
- However, **no approved-issue evidence** exists for SDD-010 in this store (issues
  are GitHub-side; no GitHub/issue tooling in this session, and no issue reference
  is recorded in the openspec store).
- **Verdict: BLOCKED.** Issue-first readiness is preserved by inaction but the
  required approved issue for SDD-010 is not evidenced or verifiable here.

---

## 4. Scope & non-goals

- **In scope (this phase):** read-only Gate 0 audit; identify frozen/root documents;
  verify closure status where artifacts exist; recommend next action.
- **Explicit non-goal:** implementing **SDD-020** (Universal Agent Configurator) is
  **prohibited** — no `install`/`doctor`/`sync`/`upgrade`/`rollback` or host
  integration work. Nothing was implemented.
- **Non-goals:** no source-code edits, no branches, no commits, no PRs, no archive
  of the audit, no creation of a proposal (recommended against, §5).
- **Preservation:** all existing unrelated worktree changes are immutable evidence;
  none were modified.

---

## 5. Recommendation

**Do NOT create a proposal.** The Gate 0 audit foundation is absent from this
repository. Before any proposal for SDD-010 work is meaningful, the orchestrator must
either:

1. **Supply the Drenyra Dominion program-master context** — the SDD-010 / Gate 0
   definitions, `fiscal-authority-kernel`, `bounded-agent-roles`, `capability-matrix`,
   and `program-lock` — which live in `arkelythex/drenyra-ai` (per README/ROADMAP), or
2. **Confirm the planning location** is the parent program repo (not `drenyra-pi`),
   or
3. **Restore/persist the missing planning artifacts** into this store so the audit
   can be re-run against real evidence.

Optionally, the orchestrator should confirm whether the artifacts exist only in the
Engram best-effort store (not readable by this executor, which lacks `mem_search`),
in which case the planning context must be injected or persisted to `openspec/`.

---

## 6. Risks

| ID | Severity | Risk |
| --- | --- | --- |
| R1 | CRITICAL | Auditing against artifacts that live in a different repo (parent program master) risks fabricating a proposal/scope outside the authoritative store. |
| R2 | HIGH | Without a defined Gate 0, "closing Gate 0" is meaningless; a proposal would enshrine an unverified precondition. |
| R3 | HIGH | SDD-020 is explicitly prohibited; any proposal drift toward configurator implementation would violate scope discipline. |
| R4 | MEDIUM | This session lacks shell + `mem_search`; gate/test reproduction and Engram recovery were impossible, limiting evidence to files. |

## 7. Result contract

- `status`: `blocked`
- `executive_summary`: Gate 0 audit cannot close — every referenced program artifact
  (SDD-010, Gate 0, fiscal-authority-kernel, bounded-agent-roles, capability-matrix,
  program-lock) lives in the parent Drenyra Dominion program, not in `drenyra-pi`;
  no active SDD change exists; frozen contracts/root documents are identified and
  untouched; issue-first is preserved by inaction but the required approved issue is
  unverified.
- `artifacts`: this exploration at `openspec/changes/sdd-010-gate0-audit/exploration.md`
  (+ best-effort Engram topic).
- `next_recommended`: no proposal — orchestrator must inject the program-master
  context or confirm the planning repo before proceeding.
- `risks`: R1..R4 (§6).
- `skill_resolution`: `paths-injected` (chain-operation, evidence-citation,
  scope-discipline loaded before work).
