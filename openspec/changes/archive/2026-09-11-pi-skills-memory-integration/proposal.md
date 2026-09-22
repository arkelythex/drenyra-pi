# Proposal: Contract-First Production Skill Selection

**Status:** Proposal complete as a dependency proposal. Shell implementation is blocked until an authoritative task-to-skill requirements contract is published by the pinned kernel and separately approved for consumption.

## Decision Summary

| Topic | Confirmed decision |
| --- | --- |
| Delivery direction | `functional_selection_contract_first`; a no-op adapter is not acceptable. |
| Effective date | `explicit_task_asof`; every task supplies a visible, verifiable fiscal `asOf` date. |
| Selection owner | The kernel owns `MissionIntent`-to-skill requirements and required/optional policy. Shell only consumes published descriptors and outcomes. |
| Jurisdiction | `PE` is an explicit product jurisdiction input. It is not inferred as an ISO country code from a RUC. |
| Authorization | Skill selection, an empty requirement set, memory, and errors never authorize fiscal work. Existing kernel authority and receipt boundaries remain controlling. |
| Memory | The Shell host/backend memory contract is a separate unresolved dependency. |
| Research | External research was not selected and was not performed. |

These decisions are recorded in `preproposal.md` and supersede the adapter-only direction in the current `design.md` and `specs/skills-selection/spec.md`. Those files remain historical planning inputs requiring a later revision; they are not implementation authority.

## Intent

Make the eventual production path translate an actual `MissionIntent`, explicit `PE` product jurisdiction, and required fiscal `asOf` date into authoritative, version-pinned skills selected by the kernel. The result must be usable by Shell without Shell inventing a mission-to-skill mapping, optionality rule, checksum, fiscal date, or authorization decision.

The installed public `drenyra-ai@0.4.1` surface does not currently provide that contract:

- `SkillRegistry.resolveAt(id, at, jurisdiction)` resolves an already-known skill **ID**; it does not determine requirements for a mission.
- `IntentRegistry` maps `MissionIntent` values to execution handlers, not fiscal skill requirements.
- `MonthlyCloseInput.igvSkill` is supplied by its caller, not selected from an authoritative task descriptor.

The existing design passes an unmatched `MissionIntent` to `BASE_PE_SKILLS`, catches every `SkillError`, returns `[]`, and permits nonblocking continuation. That behavior is intentionally inert and must not be represented as functional selection, fail-closed protection, or successful implementation.

## Scope

### In scope for this proposal phase

- Define the minimal upstream dependency needed for authoritative task-based selection; see `upstream-contract-proposal.md`.
- Define Shell's future acceptance boundary for successful selection, explicit no-skills-required, unsupported tasks, and resolution errors.
- Require an explicit, visible, verifiable fiscal `asOf` date on every task selection request and result.
- Require explicit `PE` product jurisdiction input independently of RUC validation.
- Define production-path acceptance tests that begin with a real `MissionIntent` and prove authoritative pins, validity, jurisdiction, staleness, and integrity behavior.
- Plan future evidence under the existing `drenyra-commands` capability row only.

### Out of scope

- Implementing or approving the kernel contract.
- Calling `resolveAt(mission.intent, ...)` as an adapter-only substitute.
- Adding a Shell-local `MissionIntent`-to-skill mapping table, requirement policy, skill registry, checksum, or fallback.
- Rewriting the existing design or specification in this phase.
- Advancing tasks or apply/implementation while the upstream contract is absent.
- Changing the runtime pin, package version, frozen contracts, or files in an external repository.
- Adding a new capability or `MASTER_CAPABILITIES` row, or changing capability states.
- Implementing memory, selecting a memory host/backend, network access, issue submission, publication, or lifecycle operations.

## Proposed Product Flow

1. A production task provides its real `MissionIntent`, explicit product jurisdiction `PE`, and explicit fiscal `asOf` date.
2. Shell passes those values unchanged to a future public kernel task-requirements API.
3. The kernel uses its authoritative descriptor to determine skill requirements, required/optional semantics, and optional-skill policy.
4. Shell handles the kernel result without reinterpretation:
   - **Selected:** preserve the authoritative skill pins and descriptor provenance, then continue through all existing scope, authority, gate, and receipt controls.
   - **No skills required:** accept only an explicit kernel `no-skills-required` result with descriptor provenance. This is not equivalent to an empty/error fallback and grants no authority.
   - **Unsupported:** stop selection for that task; do not reinterpret it as no skills required.
   - **Error:** preserve the distinction. A required-skill error, including missing, stale, wrong-jurisdiction, or integrity failure, prevents protected continuation.
5. Optional-skill behavior is whatever the explicit kernel descriptor and resolver contract state. Shell must not infer optionality from an empty list or catch errors into a local default.

No outcome in this flow authorizes fiscal action. Shell remains an operator and consumer of kernel decisions, never an authority.

## Fiscal Date and Jurisdiction Rules

### Required `asOf`

`asOf` is the task's fiscal applicability date in `YYYY-MM-DD` form. It must be visible to the user/operator, available for verification, passed to the kernel, and preserved in the observable selection result or provenance.

If `asOf` is missing or invalid, selection is blocked before any skill lookup. Shell must never default it to:

- the current system date;
- the fiscal period or a date derived from that period;
- a transaction or document date; or
- any other implicit clock or scope value.

### Explicit PE jurisdiction

The current product jurisdiction is explicitly `PE`. RUC validation remains part of company scope discipline, but an 11-digit RUC is not an ISO-3166 jurisdiction source. Shell must not derive `PE` from the RUC or silently replace a missing jurisdiction.

## Capability Evidence

A future implementation may add its source and exact tests to the existing `drenyra-commands` evidence in `capability-manifest.yaml` and the corresponding conformance-matrix row. It must use an honest `unit-or-contract-tested` claim until operational evidence exists.

It must not:

- add a new capability or `MASTER_CAPABILITIES` row;
- change the closed capability state enum;
- upgrade the `packaged-skills` or `engram-integration` ownership posture; or
- claim validated end-to-end behavior from fixture-only ID lookup tests.

## Affected Areas

| Area | This phase | Future impact after dependency approval |
| --- | --- | --- |
| `openspec/changes/pi-skills-memory-integration/proposal.md` | Revised | Planning authority for the dependency boundary. |
| `openspec/changes/pi-skills-memory-integration/upstream-contract-proposal.md` | Added | Proposed, unpublished kernel contract request. |
| Pinned `drenyra-ai` public types | Read-only evidence | Must eventually publish an authoritative task-requirements API; no external edit is authorized here. |
| Production routing/mission composition | Unchanged | Must consume the future API without local mapping or date defaults. |
| `drenyra-commands` capability evidence | Unchanged | May be extended only after production-path tests pass. |
| Existing `design.md` and skills-selection spec | Unchanged and superseded as planning inputs | Must be revised in a later proposal-authorized phase before tasks/apply. |
| Memory host/backend | Unchanged | Separate unresolved dependency and acceptance track. |

## Dependency and Implementation Blocker

The required upstream contract is proposed in `upstream-contract-proposal.md`; it is not present in installed public `drenyra-ai@0.4.1`, not approved by the kernel owner, and not published. No version bump or pin change is authorized by this proposal.

Therefore:

- proposal work may complete;
- design/spec revision must wait for an approved published contract shape;
- tasks/apply must not advance;
- the current unmatched-`MissionIntent`/`[]` design must not be implemented as an interim success.

## Required Future Acceptance Tests

The exact contract and Shell acceptance scenarios are listed in `upstream-contract-proposal.md`. The minimum production evidence is:

- a positive test entering through the real production composition with a real `MissionIntent`, explicit `PE`, and explicit `asOf`, producing the authoritative non-empty pins and descriptor provenance;
- date-boundary tests selecting the authoritative version for each explicit `asOf`;
- negative tests for missing `asOf`, unsupported task/jurisdiction, stale required skill, jurisdiction mismatch, checksum/integrity failure, and missing required skill;
- an explicit descriptor-backed no-skills-required test distinct from unsupported and error;
- an explicit kernel-owned optional-policy test; and
- assertions that none of these results bypasses existing scope, authority, approval, gate, or receipt controls.

A test that directly calls `resolveAt("pe.…", ...)` with a fixture skill ID proves only ID lookup and does not satisfy the production selection goal.

## Risks

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Adapter-only wiring is mislabeled as functional selection | Production continues with no selected pins while evidence appears green. | Require a real `MissionIntent` production-path positive test and prohibit fixture-only ID lookup as acceptance. |
| Shell invents mappings or optionality | Fiscal policy diverges from the kernel and becomes unauditable. | Consume only explicit kernel descriptors and outcomes; no local table or fallback. |
| Missing date is silently defaulted | The wrong validity version can be selected. | Make `asOf` mandatory, visible, preserved, and runtime-validated. |
| Jurisdiction is inferred from RUC | Product scope and ISO jurisdiction semantics are conflated. | Require explicit `PE`; retain RUC solely as company-scope evidence. |
| Empty/error is treated as permission | Protected work could continue without required knowledge. | Distinguish selected, descriptor-backed no-skills-required, unsupported, and errors; block required failures. |
| Proposed contract is mistaken for approval | Work advances against a nonexistent API. | Mark the contract unpublished and keep tasks/apply blocked. |
| Memory is bundled into skills delivery | An unconfirmed host/backend contract is invented. | Keep memory as a separate unresolved dependency. |

## Rollback

This phase changes documentation only. Rollback is limited to restoring the prior `proposal.md` and removing `upstream-contract-proposal.md`. There is no code, data, schema, pin, package, frozen-contract, or external-repository rollback.

## Success Criteria

### Proposal completion

- [x] Records `functional_selection_contract_first` and rejects the no-op adapter as implementation.
- [x] Records `explicit_task_asof` with no date default.
- [x] Establishes explicit `PE` product jurisdiction without RUC inference.
- [x] Keeps task mappings and required/optional policy kernel-owned.
- [x] Defines Shell's non-authorizing acceptance boundary and the separate memory dependency.
- [x] Proposes upstream outcomes and tests without claiming publication or approval.
- [x] Preserves the existing capability-row model and all repository/external boundaries.

### Blocked implementation entry criteria

- [ ] The kernel owner approves and publishes an authoritative task-requirements contract.
- [ ] A separately authorized dependency/pin release exposes that contract to Shell.
- [ ] Design and specification are revised against the actual published types.
- [ ] Production-path acceptance tests prove real `MissionIntent` selection; fixture-only ID lookup is insufficient.
- [ ] The memory host/backend dependency is resolved in its own scope if memory integration is pursued.
