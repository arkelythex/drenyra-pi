# Change: Prove Drenyra Pi Is a Replaceable RDA Host

> Change: `pi-sdd-040-adapter-boundary`
> Product: `drenyra-pi`
> Status: proposed (real SDD pipeline: `proposal → specs → design → tasks → apply → verify → archive`)
> Artifact store: OpenSpec
> Date: 2026-08-15
> Runtime baseline: published and pinned `drenyra-ai@0.2.0`
> Program authority: master change `sdd-040-rda-v2` in `drenyra-ai` (docs-only closure coordinated 2026-08-15)

## 0. Decision

Drenyra Pi will prove, rather than merely document, that it is a replaceable
agentic-runtime host for Drenyra AI's deterministic fiscal-authority kernel.
This change audits every prohibited authority behavior, fixes any Pi-local
boundary violation found, adds a harness-replacement test that compares Pi with
an independent minimal host over the same pinned runtime and mission, and
publishes the adapter boundary for maintainers.

The intended result is structural evidence that changing the host does not
change the authoritative candidate, gate, or receipt outcome. Pi may coordinate,
prepare requests, persist non-authoritative working state, and present results;
it must not become a second fiscal-authority implementation.

## 1. Intent and business problem

The program master is closing SDD-040 as a documentation-only reconciliation
because RDA v2 is already implemented and verified in `drenyra-ai`. Pi already
imports that kernel, but source imports and policy prose alone do not prove that
Pi adds no fiscal authority. Without host-replacement evidence, maintainers and
reviewers must infer the boundary from a mixed orchestration pipeline, creating
three risks:

1. a Pi-local helper may silently duplicate materiality, transition, gate, or
   receipt decisions;
2. local JSON stores may be mistaken for authoritative fiscal records; and
3. a future Pi change may preserve outputs in ordinary tests while making Pi
   operationally irreplaceable.

This change closes that proof gap on the host side. The master closure remains
the authority record for RDA v2 behavior; this Pi-local SDD supplies the missing
adapter-boundary evidence and does not duplicate the master's requirement
mapping.

## 2. Verified starting state

These are proposal inputs, not completion claims. The apply and verify phases
must produce fresh evidence against the final candidate.

| Starting fact | Evidence |
| --- | --- |
| Pi consumes the fiscal kernel rather than declaring it as a production dependency | `package.json` pins `drenyra-ai` as `file:./vendored/drenyra-ai-0.2.0.tgz` under `devDependencies`; `dependencies` is empty |
| The shared and monthly-close chains import mission, gate, receipt, and candidate types/functions from the kernel | `chains/monthly-close.ts`; `lib/chain-pipeline.ts` imports from `drenyra-ai/missions`, `drenyra-ai/gates`, `drenyra-ai/receipts`, and `drenyra-ai/candidates` |
| Monthly close supplies explicit materiality input and an R2 floor request | `chains/monthly-close.ts:142` (`CLOSE_MATERIALITY: ExplicitMaterialityRequest`) |
| The shared pipeline currently describes itself as coordinating scope, one prepared phase, authority gates, domain computation, and receipt persistence | `lib/chain-pipeline.ts:1-31`; this mixed surface is precisely why replacement proof is required |
| Pi agents are intended to remain coordination-only | Orchestrator audit input: all 10 `agents/*.md` authority ceilings are ANALYZE or PREPARE, never EXECUTE; the implementation audit must re-check every file |
| The pinned artifact is the only consumable runtime for this change | `package.json`; supplied checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`; no unpublished configurator/routing surface may be consumed |
| The program master has already mapped and verified the RDA v2 authority machinery | Coordinated master closure input for `drenyra-ai/openspec/changes/sdd-040-rda-v2/`, 2026-08-15; Pi references that closure and does not recreate it |

Proposal citations identify source files and coordinated authority artifacts.
Any conclusion created inside an accounting mission during implementation must
also satisfy the evidence graph's `source → transformation → conclusion →
action` citation and payload-hash rules; this proposal does not invent evidence
node IDs before a mission run exists.

## 3. Scope

### 3.1 Produce an authority-boundary audit

Audit the final Pi candidate against each rule below and publish a per-rule
verdict table with concrete source, test, or runtime evidence. A passing verdict
must be demonstrated; policy wording without executable or source evidence is
insufficient.

| Rule | Required verdict |
| --- | --- |
| Agent authority | No Pi agent has EXECUTE authority |
| Materiality | Pi may provide explicit inputs and policy floors, but the kernel derives authoritative materiality |
| Transitions | Pi does not accept, authorize, or fabricate fiscal lifecycle transitions |
| Risk level | Pi does not decide authoritative R0–R3 outcomes |
| Approvals | Pi does not create a fiscally valid approval or treat preparation as approval |
| Gates | Pi does not substitute Pi-local logic for Core authority gates |
| Receipts | Pi does not transform a review/completion receipt into execution proof or over-claim what a receipt proves |
| UNKNOWN | Pi performs zero blind retries after an UNKNOWN result; reconciliation or explicit human action is required |
| Stores | Pi-local JSON stores are exclusively development/demo state or non-authoritative cache and are labeled and tested accordingly |
| Delegation | Every authoritative operation used by the tested mission delegates to the published pinned runtime |

If the audit finds a violation, this change fixes the smallest Pi-local boundary
breach and adds regression evidence. If correction would require new kernel
behavior, an unpublished module, a runtime release, or a master-repository edit,
the change must report the blocker rather than implement a Pi surrogate.

### 3.2 Add the harness-replacement test

Add a deterministic integration test with two hosts over the same bounded
mission fixture and the same published `drenyra-ai@0.2.0` artifact:

1. run the mission through Pi's chain pipeline;
2. run the equivalent mission through a minimal substitute host that directly
   calls the same public Core functions and contains no Pi chain or store logic;
3. capture the authoritative candidate, ordered gate decisions, and receipt
   meaning from both runs; and
4. assert equivalence of their canonical authority projections.

The specification and design must define the exact projection before
implementation. It must compare every field that can affect fiscal meaning,
including scope, evidence/policy binding, materiality result, gate order and
verdicts, candidate target/content, approval relationship, receipt type/claims,
and terminal authority decision. Host-local timestamps, generated identifiers,
key material, or serialization details may be normalized only when the pinned
runtime makes them intentionally non-deterministic and only when they cannot
alter fiscal meaning. Any such exclusion must be explicit, narrow, and tested;
normalization must never hide an authority difference.

The test must fail when the Pi path overrides a Core decision, changes a bound
input, reorders or substitutes gates, upgrades a receipt claim, or retries
UNKNOWN. A test that merely mocks both hosts to return the same fixture does not
satisfy this deliverable.

### 3.3 Document the adapter contract

Create `docs/architecture/rda-adapter-boundary.md` with a reviewable happy path:

`operator → prepare request → call Drenyra AI → present candidate → human decision → verify receipt → project result`

The document must distinguish, for each step:

- Pi-owned coordination and presentation;
- human-owned decisions;
- Drenyra AI-owned authority decisions and artifacts; and
- local store/cache data that is never authoritative.

It must also document fail-closed behavior for incomplete scope, invalid evidence,
gate denial, UNKNOWN, receipt verification failure, and unavailable runtime. It
must link to the audit and harness test evidence rather than repeat the master's
RDA v2 implementation mapping.

### 3.4 Align with the master closure

Reference `drenyra-ai` change `sdd-040-rda-v2` as the authority-side record and
state that Pi contributes only the host-side structural proof. Preserve the
master's five deferred vocabulary differences as master-owned follow-up context;
do not rename or locally redefine Core concepts in this change.

## 4. Affected areas

| Area | Expected effect |
| --- | --- |
| Chain/runtime integration tests | Add the substitute-host equivalence harness and negative controls |
| Pi authority helpers and chains | Audit them; change only a proven boundary violation |
| Agent definitions | Audit all authority ceilings; change only a proven EXECUTE or over-claiming violation |
| Local stores | Classify and document them as dev/demo or non-authoritative cache; add a guard where evidence is currently insufficient |
| Architecture documentation | Add `docs/architecture/rda-adapter-boundary.md` and the per-rule audit evidence |
| OpenSpec artifacts | Define requirements, design the canonical comparison, plan bounded work units, record apply/verify evidence, and archive the change |
| `drenyra-ai` master repository | No files changed; referenced as the authority record only |
| Runtime pin | Remains published `drenyra-ai@0.2.0` with the existing checksum contract |

Exact test and audit-artifact paths beyond the required architecture document
belong to the specs/design phases. They must follow existing repository
conventions and avoid parallel sources of truth.

## 5. Non-goals

- No RDA v2 fiscal-authority implementation in Pi.
- No new materiality, transition, risk-level, approval, gate, receipt, ledger, or
  UNKNOWN-retry logic.
- No new command, agent, or operator workflow.
- No consumption of unreleased configurator/routing modules and no pin bump
  beyond `drenyra-ai@0.2.0` without a separately authorized published artifact.
- No edit to the `drenyra-ai` repository or its master SDD-040 closure.
- No duplication of the master's 41-requirement implementation mapping or its
  acceptance evidence.
- No SDD-020, SDD-030, SDD-050, SDD-070, SDD-080, SDD-090, or SDD-110 work.
- No conversion of Pi's local stores into an authoritative ledger or receipt
  store.
- No publication, release, or delivery action outside the normal PR flow for
  this change.

## 6. Success criteria

The change is successful only when all applicable criteria pass against the same
final candidate:

1. The boundary audit reports a supported PASS for every rule in §3.1, or names
   and fixes each Pi-local violation with regression evidence before reporting
   PASS.
2. All Pi agent authority ceilings are confirmed ANALYZE or PREPARE; none is
   EXECUTE.
3. The replacement harness executes one equivalent bounded mission through Pi
   and through an independent minimal host using the pinned published runtime.
4. Both hosts produce equivalent canonical authority projections for candidate,
   ordered gates, and receipt meaning; exclusions for runtime-generated
   non-authoritative metadata are enumerated and justified.
5. Negative controls prove that changes to a Core decision, materiality result,
   gate order/verdict, candidate binding, receipt claim, or UNKNOWN handling make
   the equivalence test fail.
6. The Pi path supplies materiality inputs only; authoritative R0–R3 derivation
   remains a kernel result.
7. Pi neither accepts transitions nor creates approvals, substitutes Core gates,
   converts receipts into execution proof, or blindly retries UNKNOWN.
8. Every local JSON store used by the tested path is classified and evidenced as
   dev/demo state or non-authoritative cache; documentation contains no ambiguous
   authority claim.
9. `docs/architecture/rda-adapter-boundary.md` documents ownership, delegation,
   failure behavior, and the operator-to-result flow, with links to executable
   evidence.
10. The runtime remains pinned to the same published `drenyra-ai@0.2.0` artifact
    and checksum; no unpublished runtime code or master-repository edit appears in
    the final diff.
11. Focused harness tests, the full test suite, typecheck, and applicable package
    verification pass with exact commands/results recorded in apply and verify
    evidence.
12. The verify report confirms all non-goals, cites the master closure without
    duplicating it, and identifies the exact final candidate under test.

## 7. Risks and mitigations

| ID | Severity | Risk | Mitigation |
| --- | --- | --- | --- |
| R1 | HIGH | A semantic comparison could normalize away a real authority difference | Define the canonical authority projection in specs/design; enumerate every excluded field; add mutation-style negative controls |
| R2 | HIGH | The substitute host could accidentally reuse Pi helpers and make the proof circular | Permit only direct public imports from the pinned kernel plus minimal fixture/serialization code; assert the substitute path has no Pi chain/store dependency |
| R3 | HIGH | Fixing an audit finding in Pi could create a second fiscal implementation | Allow only removal/delegation of Pi authority behavior; block if the kernel or a published release is insufficient |
| R4 | HIGH | Local stores or receipts could be described more authoritatively than their guarantees support | Classify every store and receipt claim, fail closed on ambiguity, and test that local persistence cannot authorize execution |
| R5 | MEDIUM | Runtime-generated IDs, timestamps, or signatures may prevent literal byte equality | Compare canonical fiscal meaning; keep exclusions narrow and prove excluded fields cannot affect authority |
| R6 | MEDIUM | A happy-path-only harness may miss gate denial or UNKNOWN behavior | Include negative/fail-closed scenarios, especially zero blind retries after UNKNOWN |
| R7 | MEDIUM | Documentation may drift from executable behavior | Link each boundary rule to source/test evidence and verify the document against the final audit table |
| R8 | MEDIUM | The current local pipeline may contain mixed coordination and authority-looking helpers | Audit before redesign; make only evidence-required changes and preserve existing behavior where the boundary already holds |
| R9 | LOW | The work may exceed a comfortable single-review unit | Tasks must forecast authored changed lines and split by coherent work unit if the configured delivery strategy requires it |

## 8. Rollback

Rollback is bounded by deliverable and must not remove unrelated work:

1. Remove the harness-replacement test, substitute host fixture, and its dedicated
   test utilities as one work unit.
2. Revert only Pi-local source or agent changes that corrected a demonstrated
   boundary violation, together with their regression tests.
3. Remove `docs/architecture/rda-adapter-boundary.md` and the audit artifact only
   if the boundary documentation is withdrawn.
4. Restore any store labels or guards changed by this SDD together with their
   tests; do not delete user data or authoritative Core artifacts.
5. Re-run the focused pre-change checks and full repository verification after
   each rollback boundary.

No rollback step may alter the runtime tarball, bump the pin, edit the master
repository, use a blanket reset/clean, or touch unrelated changes.

## 9. Delivery and evidence constraints

- Keep tests with the behavior or proof they establish; organize implementation
  as reviewable work units rather than file-type batches.
- Every work unit records a focused command/result, relevant runtime-harness
  scenario/result, and an exact rollback boundary.
- Runtime conclusions must cite valid evidence-graph lineage where the mission
  model requires it; source-level audit conclusions must cite stable paths,
  symbols, and test cases.
- The tasks phase must include a Review Workload Forecast and honor the
  orchestrator's delivery strategy before apply.
- The final verification must run against the exact pinned artifact and must not
  replace it with a workspace checkout or unpublished build.

## 10. Proposal question round

A live product-question round was not available in this delegated authoring
step. The following questions and working assumptions require user review before
or during the specs phase; they do not expand scope automatically.

1. **What counts as replacement equivalence?** Assumption: canonical fiscal
   meaning must be identical, while explicitly enumerated runtime-generated
   metadata may differ only when it cannot affect authority.
2. **What happens if the audit finds a boundary violation that cannot be removed
   against `drenyra-ai@0.2.0`?** Assumption: fail closed and report a blocked
   dependency; do not consume unpublished code or implement a Pi surrogate.
3. **May local stores retain operational history?** Assumption: yes, only as
   dev/demo data or non-authoritative cache; no local record can authorize,
   approve, or prove fiscal execution.
4. **How should the master closure be cited before its final archive identity is
   known?** Assumption: cite the stable change name and coordination date, then
   bind the final path/revision during specs or verification without copying its
   mapping.

## 11. Result contract

- `status`: `proposed`
- `executive_summary`: audit and enforce Pi's no-fiscal-authority boundary, prove
  host replaceability with an independent same-mission harness against pinned
  `drenyra-ai@0.2.0`, and document the adapter/store/delegation contract while
  leaving the RDA v2 implementation and authority record in `drenyra-ai`.
- `artifacts`: `openspec/changes/pi-sdd-040-adapter-boundary/proposal.md`
- `next_recommended`: `spec`
- `risks`: R1..R9 (§7)
- `skill_resolution`: `paths-injected` (`cognitive-doc-design`,
  `work-unit-commits`, `evidence-citation`, and `scope-discipline` loaded before
  work)
