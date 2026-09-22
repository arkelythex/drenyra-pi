# Exploration: pi-skills-memory-integration

Phase: sdd-explore
Audited against: dirty working tree, drenyra-shell @ main, 2026-09-09.

## Current State

Acceptance bar (verbatim): "Skills seleccionadas por tarea, jurisdicción y vigencia; memoria recuperada con procedencia y aislamiento por empresa." Evidence bar: correct selection, stale-info handling, isolation, memory never grants authorization.

**Skills selection — the mechanism exists, but ONLY in the pinned `drenyra-ai` Core, and Shell consumes zero of it.**
`node_modules/drenyra-ai@0.4.1` publishes a real `./skills` subpath export (`package.json:36`, confirmed via direct `.d.ts` inspection per SDD #2's method) containing a complete, versioned, jurisdiction- and validity-scoped skill registry — this is *exactly* the acceptance bar's mechanism, already built, in Core:
- `skills/types.d.ts`: `SkillDefinition { id, version, jurisdiction: string (ISO-3166-1 alpha-2, e.g. "PE"), validity: { from: IsoDate, to?: IsoDate }, normativeSources, inputs, outputs, requiredPermissions, maxAutonomy: Materiality (R0-R3), contractCompatibility, checksum, retirementPolicy }`.
- `skills/registry.d.ts`: `SkillRegistry.resolveAt(id, at: IsoDate, jurisdiction?: string)` — resolves the skill in force for an id at a date, i.e. task + jurisdiction + validity-period selection in one call. `isSkillInForce(skill, at)` for staleness. `SkillError` codes include `SKILL_OUT_OF_VALIDITY` and `SKILL_JURISDICTION_MISMATCH` — fail-closed on stale/wrong-jurisdiction skills, not silent fallback.
- `skills/pe.d.ts`: `BASE_PE_SKILLS` — six real Peru-jurisdiction skill definitions (IGV_VALIDATE, SIRE_COMPARE, DETRACTION_CHECK, RETENTION_CHECK, PERCEPTION_CHECK, SIRE_FILING), each citing its normative source (e.g. "D.S. 055-99-EF").

Grepping the entire drenyra-shell repo for `SkillRegistry|SkillDefinition|BASE_PE_SKILLS|drenyra-ai/skills` returns **zero matches**. No file in this repo imports the Core's `./skills` subpath. This is the same shape of finding as SDD #2 ("no confirmed kernel API") but inverted: here the kernel API DOES exist and is well-formed, Shell just never wires to it.

**Shell's own `skills/` directory is static markdown, wholesale-loaded, with no in-repo selection code.** The 10 packaged skills (`chain-operation`, `evidence-citation`, `fiscal-compliance`, `fiscal-review`, `lens-*` x4, `ruc-scope`, `scope-discipline`) are all `layer: foundation`, `jurisdiction: global` (confirmed by frontmatter grep — no skill declares a non-global jurisdiction or a validity window today). `skills/README.md:6-21` explicitly documents Design 03's three-layer model (Foundation/Peru/Practice) and states "Peru and practice/sector skills ship later, versioned by validity period" — i.e. Shell's own docs already acknowledge jurisdiction/validity-scoped skills are a *future* layer, not present v0.1 content. `skills/README.md:31-47` lists jurisdiction+validity as *required skill metadata per Design 03* but notes "the remaining fields are declared as the Peru and practice layers land" — only `author/version/layer/jurisdiction` exist today, and `jurisdiction` is hardcoded to `"global"` for all ten. The only in-repo code touching "skills" as a concept:
- `lib/configurator.ts:44,228` `renderManagedSkills()` — imported from `drenyra-ai/configurator` (a different Core subpath than `./skills`), renders a static bundle of skill markdown content for host installation (asset packaging at install time). This is NOT task/jurisdiction/validity selection — it is install-time asset materialization, always all skills, unconditionally.
- `extensions/register.ts:321` — a `WorkUnitInput.skills: []` field, always populated with an empty array, in the one live wired `runRoutingPreflight` caller (`/drenyra:status route`). `WorkUnitInput` is a type imported FROM `drenyra-ai` Core (`lib/routing/types.ts:65`, `lib/routing/preflight.ts:46`), not defined in this repo — this is a Core-owned schema slot for skill references that Shell's routing preflight never populates. This is the closest in-repo hook to "skills selected per work unit," and it is currently inert (always `[]`).

**Conclusion on selection**: There is NO code-level mechanism in drenyra-shell that selects a skill by task type, jurisdiction, or validity period. The mechanism exists fully-formed in the pinned Core (`drenyra-ai/skills`) and is completely unconsumed. Shell's local skills are static, globally-scoped markdown with no time-bound or jurisdiction-bound content today.

**Memory (Engram) — confirmed still zero executable integration, no stub, no client dependency.**
- `package.json`, `node_modules/drenyra-ai/package.json` exports map (`package.json:19-42`): no `"./engram"` (or any engram-named) subpath exists anywhere in the pinned Core's 21 exported subpaths.
- Repo-wide grep for `engram|Engram` across `*.ts` returns exactly one file: `__tests__/capability-manifest.test.ts` (an assertion about manifest text, not integration code).
- `capability-manifest.yaml`'s `engram-integration` row (`state: "partial"`, lines 125-136) and `docs/architecture/capability-conformance-matrix.md` (`engram-integration` row, `implemented` verification level, evidence `runtime/context.ts:10-11,225`) both independently confirm: only a development-grade local JSON context store exists (`runtime/context.ts`'s `ScopeContext`/`CanonicalScope` persistence), no executable Engram memory read/write path, no Engram client dependency. This matches and reconfirms SDD #1's already-archived finding — nothing has changed since.
- README.md:30 already states this correctly today: "The current harness has no complete executable Engram integration; that memory step remains planned and never authorizes." No overclaim exists in the current dirty tree to correct here (unlike SDD #1's original finding against an older README revision).

**Provenance and per-company isolation — real precedents exist and should be reused, not invented.**
- Provenance: `lib/evidence-projection.ts` (`projectEvidenceProvenanceSet`, cited `lib/evidence-status.ts:77-78`) already implements deterministic, read-only evidence-provenance projection over the evidence graph (source → transformation → conclusion → action lineage per the `evidence-citation` skill). This is the closest existing "retrieved-with-provenance" pattern in the repo.
- Isolation: the 10-element `CanonicalScope` (`runtime/context.ts:64-91`: tenant, organization, company (RUC), fiscalPeriod, ledgerBook, operationType, sourceSnapshot, policyVersion, actor, authorityLevel) plus `lib/routing/preflight.ts:127` `stageScope()` (recomputes and compares scope hash before any protected work; `preflight.ts:159`) plus the `ruc-scope`/`scope-discipline` skills are the established fail-closed per-company isolation pattern already enforced across chains, routing, and missions. A future memory integration should bind retrieval to this same `CanonicalScope`/scope-hash mechanism rather than invent a new company-scoping concept.

**"Memory never grants authorization" — the fail-closed sentinel precedent is real and directly reusable.**
`lib/authority-store.ts`'s `AuthorityStore.findBoundAuthorization` (also used in `extensions/register.ts:271-288`) returns `undefined` on no bound authorization, which the caller maps to an explicit `decision: "DENIED"` sentinel object — never a self-issued grant. This is the exact pattern SDD #2/#3 already established for "Shell never authorizes." Separately, the Core's `SkillDefinition.maxAutonomy: Materiality` (R0-R3, `skills/types.d.ts:44-45`) is architecturally a ceiling declaration only (like the existing `authorityLevel` scope element), not a grant mechanism — consistent with the invariant, but nothing in Shell today exercises this because nothing consumes `drenyra-ai/skills` yet. There is no memory-adjacent code in Shell today that violates (or even touches) this invariant — it is simply unbuilt.

## Master SDD linkage — critical scope-defining finding

README's Dominion Program table (`README.md:56`, reused verbatim in `docs/architecture/capability-conformance-matrix.md:42-44`) states unambiguously: "The master owns the full program catalog — SDD-010..., SDD-070 (skills), SDD-080 (Engram memory)... which Drenyra Shell references only and never duplicates." Both `capability-manifest.yaml` and the capability conformance matrix already tag `packaged-skills` and `engram-integration` as **Referenced-only** programs.

This is a materially different and more constraining posture than SDD-020/SDD-030/SDD-040 (which Shell actively serves/scaffolds). It means: **Shell has no local authority to implement task/jurisdiction/validity-based skill SELECTION LOGIC, and no local authority to implement Engram memory READ/WRITE logic** — both belong to the master program (SDD-070, SDD-080) and the concrete selection/retrieval mechanism already exists Core-side for skills (`drenyra-ai/skills`) and does not exist anywhere (Core or Shell) for Engram. Building either mechanism natively inside drenyra-shell would encroach on master-owned territory exactly as SDD #2 found for onboarding/scope-derivation, and would duplicate a mechanism the Core already ships for skills.

What Shell CAN legitimately do without encroaching: (a) become a *consumer/wiring* layer for the Core's existing `drenyra-ai/skills` registry — call `resolveAt(taskId, date, jurisdiction)` from a routing/preflight/mission call site and populate the currently-empty `WorkUnitInput.skills` field, the same "thin adapter over Core API" pattern already used for `configurator`, `routing`, `missions`, `evidence` subpaths; (b) if/when a future Core `drenyra-ai/engram` (or similarly named) subpath ships, wire it the same way; (c) reuse existing provenance (`evidence-projection.ts`) and isolation (`CanonicalScope`/scope-hash) precedents rather than invent new ones for any memory-retrieval surface; (d) extend `capability-manifest.yaml`/the conformance matrix with honest rows reflecting exactly this state. What Shell should NOT do: author its own skill-resolution/validity/jurisdiction engine, or its own Engram client/protocol, since no Core Engram API is evidenced at all and a Core skills API already exists and would be duplicated by a local reimplementation.

## Affected Areas

- `lib/routing/preflight.ts:127,670` / `lib/routing/types.ts:65` — `WorkUnitInput.skills` field currently always `[]`; the wiring point if Shell becomes a `drenyra-ai/skills` consumer.
- `extensions/register.ts:319-324` — the one live call site constructing `workUnitInput` with `skills: []`; would need a real resolver call.
- `lib/configurator.ts:44,228` (`renderManagedSkills`) — install-time asset bundling; unrelated to runtime selection, do not conflate.
- `skills/README.md`, `skills/*/SKILL.md` — all `jurisdiction: global`, no validity metadata; any "Peru layer" or validity-scoped skill content is explicitly future work per this file's own text.
- `capability-manifest.yaml` (`packaged-skills`, `engram-integration` rows) and `docs/architecture/capability-conformance-matrix.md` (`packaged-skills | Referenced-only`, `engram-integration | Referenced-only` rows) — the accurate current-state anchors any new claim must not contradict.
- `lib/evidence-projection.ts`, `lib/evidence-status.ts` — existing provenance precedent.
- `runtime/context.ts` (`CanonicalScope`), `lib/routing/preflight.ts:127` (`stageScope`), `skills/ruc-scope/SKILL.md`, `skills/scope-discipline/SKILL.md` — existing per-company isolation precedent.
- `lib/authority-store.ts` (`AuthorityStore.findBoundAuthorization`, `DENIED` sentinel) — existing fail-closed non-self-authorization precedent.
- `node_modules/drenyra-ai/dist/skills/{index,types,registry,pe}.d.ts` — Core-owned, read-only reference; never edit here (out of `allowedEditRoots`).

## Approaches

1. **Wire Shell as a thin consumer of the Core's existing `drenyra-ai/skills` registry** (populate `WorkUnitInput.skills` via `SkillRegistry.resolveAt(taskId, date, jurisdiction)` at the one live routing call site; add a `capability-manifest.yaml`/matrix row reflecting real selection evidence) and explicitly scope Engram memory OUT (documented as master-owned, no Core API evidenced, tracked as a separate future change once/if a Core Engram subpath ships).
   - Pros: uses an already-built, already-tested Core mechanism exactly matching the acceptance bar's selection half (task+jurisdiction+validity); same low-risk "thin adapter" pattern already proven for `configurator`/`routing`/`missions`; does not duplicate master-owned logic; bounded diff.
   - Cons: only satisfies half the acceptance bar (skills selection); memory provenance/isolation/never-authorizes remains undemonstrated since there is nothing to wire to; needs an explicit, honest scope-reduction statement.
   - Effort: Medium (wiring + tests), assuming no jurisdiction/date derivation design gap — task id and jurisdiction inputs to `resolveAt` still need a defined source (likely `CanonicalScope.company`'s RUC-implied "PE" and the active mission/command name), which is itself a small design decision, not exploration-blocking.

2. **Document the gap only** (capability-matrix rows stating skills selection is Core-available-but-unwired and Engram memory has zero Core API at all), with no code change.
   - Pros: lowest risk, fastest, avoids inventing task-id/jurisdiction-derivation semantics under time pressure.
   - Cons: does not close the acceptance bar's evidence requirement at all ("cases that prove correct selection..."); repeats the exact "hand-authored snapshot with no forcing function" pattern SDD #1 already found three times in this repo; leaves a real, ready-to-use Core capability unused.
   - Effort: Low.

3. **Attempt to build BOTH skill-selection AND a local Engram integration natively in Shell.**
   - Pros: would nominally satisfy the full acceptance bar text.
   - Cons: directly contradicts the README's own Dominion Program table (SDD-070/SDD-080 master-owned-only, "references only and never duplicates"); for skills specifically it would duplicate a mechanism the Core already ships (worse than reinventing — it would produce two divergent skill-validity engines); for Engram it would require inventing a protocol/wire-format with zero Core API evidence, exactly the fabrication SDD #2 was warned against. Not recommended under any framing.
   - Effort: High, and out of Shell's legitimate authority regardless of effort.

## Recommendation

Approach 1, with the same honest scope-reduction discipline SDD #1-#3 already established: wire the skills half against the real, already-shipped Core `drenyra-ai/skills` registry (the acceptance bar's selection/jurisdiction/validity requirement is concretely satisfiable this way, with real evidence — `SkillError` codes for out-of-validity/wrong-jurisdiction give a direct "stale information" test surface), and explicitly declare the memory (Engram) half of the acceptance bar UNSERVICEABLE in this change because no Core Engram API exists anywhere to consume — same posture as SDD #2's onboarding blocker and SDD #3's two-of-three routing-modality reduction. Provenance and per-company isolation for a *future* memory integration can still be documented now as "reuse `evidence-projection.ts` + `CanonicalScope`/`stageScope`," without building anything memory-specific today.

## Risks

- The acceptance bar bundles skills-selection and memory-provenance/isolation into one sentence; a scoped change that only closes the skills half needs explicit user/orchestrator sign-off before `sdd-propose`, exactly as SDD #3 required for its two-of-three routing-modality reduction.
- `SkillRegistry.resolveAt(id, at, jurisdiction)` needs a task-id and jurisdiction input at the call site; deriving these (e.g. from `CanonicalScope.company`'s RUC or from a per-command mapping) is a real design decision for `sdd-design`, not resolved here.
- `BASE_PE_SKILLS` are Core-owned constants; Shell must not fork or copy their content — checksums (`SkillDefinition.checksum`) are load-bearing (`SKILL_CHECKSUM_MISMATCH` fail-closed), so any wiring must resolve from the Core module directly, never re-embed skill bytes in Shell.
- If a future Core `drenyra-ai/engram`-shaped subpath does ship, this change's provenance/isolation precedent recommendations (reuse `evidence-projection.ts`, reuse `CanonicalScope`) should be revisited against whatever shape the Core actually publishes, the same way `drenyra-ai/skills` turned out to already have shape not anticipated by Shell's own `skills/README.md` prose.
- Both `packaged-skills` and `engram-integration` are already tagged `Referenced-only` in the capability matrix; any new capability row this change adds must not silently upgrade either program's ownership tag without an explicit master-alignment statement.

## Ready for Proposal

Yes, with one explicit scope decision the orchestrator/user must confirm before `sdd-propose`: whether this change proceeds skills-selection-only (Approach 1, recommended, wiring Shell to the Core's existing `drenyra-ai/skills` registry) with Engram memory explicitly deferred as blocked-on-master (no Core API exists), or whether the user wants a documentation-only gap statement for both halves (Approach 2). Building a native Shell-local Engram client (any variant of Approach 3) is not recommended under any framing — it is out of Shell's legitimate authority per the Dominion Program table and has zero Core API to bind to.
