# Proposal: Capability Conformance Matrix and Stale Audit Cleanup

## Intent

`drenyra-shell`'s point-in-time audit artifacts (README, ROADMAP, `docs/architecture/*`, `capability-manifest.yaml`, an unarchived reconciliation change) contradict each other and the actual `main` tree: ROADMAP understates shipped work (Phase 2 items are wired and tested), README overstates it (implies an npm release that hasn't happened), and three independent audit documents disagree on command count, pinned version, and contract-freeze state. This change fixes the concrete contradictions now and publishes one evidence-cited capability matrix, so the next audit has a single trustworthy source instead of a fourth stale document.

## Scope

### In Scope
- Correct README.md/ROADMAP.md so neither over- nor understates shipped capability.
- Correct README.md's SDD-020 sentence: `/drenyra:install`/`/drenyra:sync` are legitimate pre-Wave-1 scaffolding, not a gate violation — no command quarantine, no Dominion escalation.
- Archive/supersede `openspec/changes/pi-program-status-reconciliation/` (wrong pin, wrong command count, wrong contract-freeze state).
- Refresh or explicitly timestamp/disclaim `docs/architecture/harness-draft-conformance.md` and `docs/architecture/program-lock-facts.json`.
- Add `capability-manifest.yaml` rows for `chains/reconcile.ts`, `chains/verify.ts`, `chains/evidence.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts`, using the manifest's existing schema fields only.
- Publish a point-in-time capability matrix citing file:line/test-name evidence per capability, tagged with verification levels: declared-only / implemented / unit-or-contract-tested / validated-end-to-end. State explicitly that this four-level split (K8s-style gated levels + Backstage-style manifest embedding) is this project's own synthesis, not a 1:1 external standard.

### Out of Scope
- `capability-manifest.yaml` schema/tooling redesign (generator, lint-check) — tracked as a separate follow-up change.
- Any fix inside `drenyra-ai` itself (e.g., missing model-routing enforcement API) — recorded as an external finding only; `allowedEditRoots` is `drenyra-shell`-only.
- Deep rewrite of `docs/architecture/ecosystem-boundaries.md` beyond correcting stale command/chain counts.

## Capabilities

### New Capabilities
- `program-conformance-matrix`: normative requirements that the capability matrix must cite concrete evidence per capability and tag a verification level from the four-tier taxonomy above.

### Modified Capabilities
- None. README/ROADMAP/docs corrections are prose fixes, not governed by an existing spec.

## Approach

Exploration Approach 3: hand-author the matrix now, snapshot it against the current dirty-tree SHA (like `program-lock-facts.json` already does), and defer the manifest schema/tooling investment to an explicit separate change so it isn't silently dropped. Reuse README's existing Dominion Program table (SDD-020/030/040 served-by-Pi; others referenced-only) rather than inventing new program tags.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `README.md` | Modified | Fix install/npm overstatement; correct SDD-020 sentence |
| `ROADMAP.md` | Modified | Check off shipped Phase 2 items |
| `openspec/changes/pi-program-status-reconciliation/` | Archived | Superseded, factually stale |
| `docs/architecture/harness-draft-conformance.md` | Modified | Refresh or timestamp/disclaim |
| `docs/architecture/program-lock-facts.json` | Modified | Refresh counts/active-changes list |
| `docs/architecture/ecosystem-boundaries.md` | Modified | Correct stale counts only |
| `capability-manifest.yaml` | Modified | Add 5 missing capability rows |
| new capability matrix doc | New | Evidence-cited matrix deliverable |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Diff likely exceeds 400-line review budget across 8 files + new doc | High | `sdd-tasks` MUST slice into chained PRs (feature-branch-chain or stacked); flagged here, not decided here |
| Auditing a dirty/moving working tree | Medium | Snapshot exact dirty SHA in the matrix, as `program-lock-facts.json` already does |
| Matrix goes stale again (3rd recurrence pattern) | Medium | Explicitly labeled point-in-time; tooling follow-up tracked separately, not silently dropped |
| Overclaiming drenyra-ai fixes | Low | Model-routing gap recorded as external finding only, no drenyra-ai edits |

## Rollback Plan

All changes are documentation/manifest-only, no runtime behavior touched. Revert via `git revert` of the change's commits; the archived reconciliation folder can be restored from `openspec/changes/archive/` if archiving proves premature.

## Dependencies

- Currently-uncommitted `chains/reconcile.ts`, `chains/verify.ts`, `chains/evidence.ts`, `lib/accounting-semantics.ts`, `lib/evidence-projection.ts` are the evidence source for new manifest rows; matrix must cite the exact dirty-SHA state audited.

## Success Criteria

- [ ] README.md and ROADMAP.md no longer contradict each other or shipped `main`
- [ ] `pi-program-status-reconciliation` archived; no two contradictory open change folders remain
- [ ] `capability-manifest.yaml` has rows for all 5 missing files
- [ ] Capability matrix published with file:line/test-name citations, verification-level tags, and explicit synthesis disclaimer
- [ ] README's SDD-020 sentence reflects pre-Wave-1 scaffolding, not a gate violation
