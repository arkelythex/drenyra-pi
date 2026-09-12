# Supersession Record — pi-skills-memory-integration

**Change:** `pi-skills-memory-integration` (local SDD 4 of 6)
**Disposition:** **`superseded` — NOT completed, NOT verified, NOT delivered.**
**Recorded:** 2026-09-11
**Authority:** explicit maintainer decision taken this session (decisions D6 and D3 of `openspec/changes/pi-recovery-release-readiness/preproposal.md`).

> A reader must never interpret this record as evidence that the change was implemented. No implementation was delivered, no verification report exists, and nothing in this change was ever verified.

## 1. Why it is superseded

The change is blocked on a contract that does not exist in this repository and cannot be created here:

- The pinned kernel `drenyra-ai@0.4.1` ships `SkillRegistry.resolveAt()`, which resolves an already-known skill ID. **No kernel API determines which skills a given `MissionIntent` requires**, so an adapter calling `resolveAt(mission.intent, …)` always returns `SKILL_NOT_FOUND` in production — real code, functionally a no-op.
- The missing contract belongs to the external `drenyra-ai` repository, which is **outside this repository's edit roots**.
- Its own `state.yaml` already records `status: blocked_superseded` and states the blocker "is not something this change can resolve locally". A concurrent session's rewritten `proposal.md` superseded the original adapter-only direction and explicitly instructed that "tasks/apply must not advance".

## 2. Artifact inventory at supersession (measured)

| Artifact | State |
| --- | --- |
| `exploration.md` | present |
| `preproposal.md` | present |
| `proposal.md` | present (contract-first direction, supersedes the adapter-only direction) |
| `design.md` | present — built against the now-superseded adapter-only proposal; its own finding is what rejected that approach |
| `specs/skills-selection/spec.md` | present — superseded along with the proposal |
| `state.yaml` | present — records the supersession and the blocker |
| `tasks.md` | **ABSENT** — `sdd-tasks` correctly refused to build tasks against stale authority |
| `upstream-contract-proposal.md` | **ABSENT** — `state.yaml` cites this file twice, but it does not exist on disk |
| `apply-progress.md` | absent |
| `verify-report.md` | absent |
| `sync-report.md` | absent |
| `archive-report.md` | absent (this record replaces it — see §4) |

**Explicit absence record (decision D10).** The two missing artifacts are recorded here as *absences*, deliberately, so that no later status change can launder a missing artifact into "done". The design and spec files are retained as historical planning inputs, not as implementation authority — the superseded proposal says exactly that of them.

## 3. Canonical requirement satisfied

`openspec/specs/program-conformance/spec.md#REQ-CONF-005` states that at most one open change folder may govern capability-conformance or reconciliation status, and that **a superseded change MUST be archived, not left open alongside a newer one**. This change self-described as superseded while remaining open under `openspec/changes/`, which is the precise condition the requirement forbids. Archiving it removes that violation and frees the slot for `pi-recovery-release-readiness`.

## 4. Recorded deviation — this archive did not pass through the archive phase

`sdd-archive` was not launched, and this is deliberate and disclosed:

- Native status for this change reports `dependencies.archive: blocked`, with `tasks: blocked` because `tasks.md` is absent. The archive phase "cannot proceed unless native status says `dependencies.archive` is `ready` or `all_done`", and the non-authoritative store carve-out does not apply (this is an authoritative `openspec` store with an `openspec/` directory).
- A superseded change whose blocker is an external contract, and which therefore has no tasks artifact, can never satisfy the archive dependency. Routing `sdd-archive` would have been an unauthorized launch, not a workaround.

Therefore this is a **maintainer-owned supersession archive**, and its disposition is `superseded`. It is not an archive of completed work and must not be cited as one. This record replaces an archive report because there is nothing verified to report.

## 5. Consequences

1. `openspec/changes/` no longer contains this change; it moves to `openspec/changes/archive/2026-09-11-pi-skills-memory-integration/`.
2. Removing it from `openspec/changes/` changes the live-derived `activeChanges` set in `docs/architecture/program-lock-facts.json`, so the mandated recovery pair runs as part of this operation: `bun run refresh:lock-facts` → rewrite the normalization-exempt mirror in `openspec/config.yaml#current_test_state.candidate_identity` → `--check` → full verification.
3. The external dependency remains unresolved. Archiving does **not** discharge it. If the kernel contract is ever published, this change must be reopened as a new change rather than resumed from these artifacts, whose proposal, design, and spec are all superseded.

## 6. Rollback

Move the folder back to `openspec/changes/pi-skills-memory-integration/` and re-run the recovery pair. No source, test, contract, spec, or runtime file belongs to this operation's rollback.
