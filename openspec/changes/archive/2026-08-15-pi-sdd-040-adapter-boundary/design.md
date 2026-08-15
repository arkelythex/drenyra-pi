# Design: Prove the Drenyra Pi Adapter Boundary

> Change: `pi-sdd-040-adapter-boundary`  
> Runtime baseline: published, pinned `drenyra-ai@0.2.0`  
> Authority-side record: `drenyra-ai/openspec/changes/sdd-040-rda-v2/`, coordinated 2026-08-15  
> Host-side evidence owner: this Drenyra Pi change

## 1. Decision summary

This change will prove that Pi is replaceable by combining three independent forms of evidence:

1. `docs/architecture/rda-adapter-boundary-audit.md` will record one demonstrated verdict for each of the ten proposal §3.1 rules.
2. `__tests__/adapter-boundary-replacement.test.ts` will run the same bounded monthly-close fixture through Pi and an independent host, project both results to the same plain-data authority schema, and require exact equivalence.
3. `docs/architecture/rda-adapter-boundary.md` will explain the operator-to-result flow and classify all local persistence as `dev/demo` or `non-authoritative cache`.

Pi remains an adapter. Materiality tiers, mission transitions, approval verdicts, receipt verdicts, and receipt construction/verification remain calls to public entry points in the pinned kernel. Pi may validate complete inputs, apply a declared minimum policy tier, order calls, persist non-authoritative working state, and present results.

The source audit found that `deriveRequiredMateriality` does **not** independently compute R0-R3. In `lib/authority-gates.ts`, it validates the input, calls the imported kernel `deriveMateriality(request.input)`, and then compares that result with an optional declared `minimum` through the imported kernel `orderOf`. Returning the minimum only raises the kernel result to a policy floor; it never lowers or replaces the kernel derivation. This is allowed input/policy behavior, but WU1 must turn that source observation into executable ownership evidence before the audit can report PASS.

If any audit rule cannot pass without new kernel behavior, unpublished modules, a runtime release, or an edit to the master repository, apply stops and writes a blocked finding in the audit artifact. It must not implement a Pi surrogate.

## 2. Evidence architecture

```text
same bounded fixture
        |
        +--> Pi host: MonthlyCloseChain / runChainStep --> raw host result
        |
        +--> substitute host: public drenyra-ai entry points only --> raw host result
                                                               |
                      canonicalAuthorityProjection(raw result) |
                                                               v
                                  exact plain-data equivalence
                                           + five failing controls
```

The test is not a snapshot of two mocked return values. Both hosts execute public `drenyra-ai@0.2.0` mission, candidate/materiality, gate, and receipt functions. The Pi branch additionally exercises Pi coordination and stores. The substitute branch contains no import path to Pi production code or stores.

## 3. D1 — Audit artifact and proof protocol

### 3.1 Artifact

The per-rule audit lives at:

- `docs/architecture/rda-adapter-boundary-audit.md`

It is separate from the explanatory boundary document so the evidence table can be updated and reviewed without turning the architecture guide into an acceptance ledger. The boundary document links to it; it does not copy it.

### 3.2 Required table schema

The audit contains exactly one row per proposal §3.1 rule:

| Field | Meaning |
| --- | --- |
| Rule | Agent authority, materiality, transitions, risk level, approvals, gates, receipts, UNKNOWN, stores, or delegation |
| Requirement IDs | Applicable `REQ-AUDIT-*`, `REQ-HARNESS-*`, or `REQ-BOUND-*` IDs |
| Verdict | `PASS`, `VIOLATION-FIXED`, or `BLOCKED` |
| Source evidence | Stable paths and symbols, not prose-only claims |
| Executable evidence | Exact test name and command |
| Runtime evidence | Harness scenario/result, or `N/A` with reason |
| Conclusion | A narrow statement supported by the cited evidence |

`PASS` is forbidden when either source evidence or applicable executable evidence is absent. A mission-model conclusion cites evidence-graph node IDs and verified payload hashes when the mission emits such a conclusion. Source-level ownership findings cite paths, symbols, and tests instead of inventing mission node IDs.

### 3.3 Materiality ownership evidence

The decisive test is added to `__tests__/adapter-boundary-audit.test.ts` with the exact name:

`delegates materiality tier derivation to the kernel and only applies a policy floor`

Run it with:

```bash
bun test __tests__/adapter-boundary-audit.test.ts -t "delegates materiality tier derivation to the kernel and only applies a policy floor"
```

The test proves all of the following:

1. For a table spanning R0, R1, R2, R3, irreversible input, and non-PE input, `deriveRequiredMateriality({ input })` equals the public kernel `deriveMateriality(input)`.
2. With `minimum`, the result equals `max(kernel deriveMateriality(input), minimum)` according to the public kernel `orderOf`; it never lowers the kernel result.
3. Missing/invalid `value`, `reversibility`, or `jurisdiction` throws and never defaults to R0.
4. A source-level assertion reads `lib/authority-gates.ts`, scopes the `deriveRequiredMateriality` function body, and requires the direct `deriveMateriality(request.input)` call before the floor comparison. It rejects Pi-local monetary thresholds, jurisdiction escalation tables, or a local R0-R3 derivation switch in that body.
5. `chains/monthly-close.ts` supplies `CLOSE_MATERIALITY.input` and `minimum: "R2"`; it does not own a tier threshold.

The audit also cites:

```bash
bun test __tests__/authority-gates.test.ts -t "T-S2-001 explicit materiality"
bun test __tests__/adapter-boundary-replacement.test.ts
```

Together, these prove ownership rather than output coincidence: source evidence proves delegation; the focused test compares directly with the public kernel; the replacement harness proves that changing hosts does not change the derived tier or downstream verdicts.

Kernel ownership of the other authoritative decisions is evidenced as follows:

| Authority decision | Required source trace | Required executable evidence |
| --- | --- | --- |
| Mission status transition | `MissionRuntime.apply` call sites in `lib/chain-pipeline.ts`, `lib/mission-commands.ts`, and `chains/monthly-close.ts`; `PROGRESS_UPDATE` must preserve engine status | Existing transition tests plus replacement harness ordered status/terminal projection |
| Approval verdict | `GateRunner`, `ApprovalGate`, and explicit human `ApprovalRecord` creation | Audit test and replacement harness approval relationship |
| Receipt verdict | `ReceiptGate` with a non-empty trusted-key list | Authority-gate tests and negative receipt control |
| Receipt claims/signature | `buildSignedReceipt` / `verifySignedReceipt` from `drenyra-ai/receipts` | Replacement projection plus receipt-claim negative control |
| UNKNOWN | `derivePreparedStep` returns `null` for `AccountingMissionStatus.UNKNOWN` | Existing `__tests__/accounting-status.test.ts` test plus harness retry control |

Agent authority is checked by extending or invoking `__tests__/agents.test.ts`; the audit records the exact final command and confirms every `agents/*.md` frontmatter ceiling and `agents/README.md` inventory is ANALYZE or PREPARE.

## 4. D2 — Replacement harness

### 4.1 Exact paths

- Harness test: `__tests__/adapter-boundary-replacement.test.ts`
- Shared bounded fixture: `__tests__/fixtures/rda-replacement-fixture.ts`
- Independent host: `__tests__/fixtures/rda-substitute-host.ts`

The canonical projection function, its TypeScript interface, comparator, mutation helpers, and normalization tests live in the harness test. They are test evidence, not a production API.

### 4.2 Substitute-host dependency rule

`rda-substitute-host.ts` may import only:

- `drenyra-ai/missions`
- `drenyra-ai/candidates`
- `drenyra-ai/gates`
- `drenyra-ai/receipts`
- `./rda-replacement-fixture.js`

It may contain minimal in-memory fixture/store adapters required by `MissionRuntime`, but it must not import from Pi's `chains/`, `lib/`, `runtime/`, `extensions/`, stores, built output, or package root. The fixture module contains plain constants/types only and imports no Pi production module.

The harness parses static and dynamic import specifiers in both substitute files and recursively checks their local import closure. It allows only the five specifiers above, rejects path aliases and package-root imports, and specifically fails on any specifier resolving under `chains/`, `lib/`, `runtime/`, `extensions/`, `dist/`, or `.local/`. This is the anti-circularity assertion required by `REQ-HARNESS-002`.

### 4.3 Bounded mission fixture

Both hosts receive one deeply frozen `RdaReplacementFixture` value:

```ts
interface RdaReplacementFixture {
  scope: {
    tenant: string;
    organization: string;
    company: string;          // valid 11-digit RUC
    fiscalPeriod: string;     // YYYYMM
    ledgerBook: string;
    operationType: "monthly-close";
    sourceSnapshot: string;   // lowercase sha-256
    policyVersion: string;
    actor: string;
    authorityLevel: "EXECUTE";
  };
  evidence: readonly {
    id: string;
    kind: string;
    reference: string;
    amountCents: bigint;
  }[];
  materiality: {
    input: MaterialityInput;
    minimum: "R2";
  };
  humanApproval: {
    approverId: string;
    reason: string;
  };
  target: {
    operation: "monthly-close";
    content: Readonly<Record<string, unknown>>;
  };
}
```

The fixed values use the existing test RUC/period conventions, BigInt cents, deterministic evidence references, a source snapshot derived from the fixture manifest, and an explicit R2 floor. Each host receives a fresh clone of the same frozen logical value. The fixture does not contain precomputed gate verdicts, a precomputed materiality tier, or a receipt; those must be produced through the kernel.

The Pi branch drives `MonthlyCloseChain` and the shared chain path over an isolated temporary `storesRoot`. The substitute branch constructs an in-memory mission runtime, derives materiality, runs mission/approval/receipt gates in declared order, builds/verifies the completion receipt, and returns raw artifacts. Both branches are bounded by the 13 phases plus the existing finite continuation slack; neither may use an unbounded loop.

### 4.4 Canonical authority projection

The harness defines a pure function:

```ts
function canonicalAuthorityProjection(
  result: RawHostAuthorityResult,
): CanonicalAuthorityProjection
```

It returns JSON-compatible plain data (BigInt cents are converted to canonical decimal strings only at this projection boundary):

```ts
interface CanonicalAuthorityProjection {
  schema: "drenyra.authority-projection.v1";
  scope: {
    elements: {
      tenant: string;
      organization: string;
      company: string;
      fiscalPeriod: string;
      ledgerBook: string;
      operationType: string;
      sourceSnapshot: string;
      policyVersion: string;
      actor: string;
      authorityLevel: string;
    };
    scopeHash: string;
  };
  binding: {
    evidenceHash: string;
    policyVersion: string;
  };
  materiality: {
    kernelTier: "R0" | "R1" | "R2" | "R3";
    declaredMinimum: "R0" | "R1" | "R2" | "R3" | null;
    effectiveTier: "R0" | "R1" | "R2" | "R3";
  };
  gates: readonly {
    order: number;
    stage: "mission" | "approval" | "receipt";
    verdict: "allowed" | "blocked" | "needs_input";
  }[];
  candidate: {
    targetHash: string;
    contentHash: string;
    content: {
      intent: string;
      company: string;
      fiscalPeriod: string;
      evidenceHash: string;
      policyVersion: string;
      operation: string;
      payload: unknown;
    };
  };
  approval: {
    required: boolean;
    humanApproverId: string;
    relationship: "approves-candidate";
    candidateContentHash: string;
    evidenceHash: string;
  };
  receipt: {
    type: string;
    binding: {
      scopeHash: string;
      evidenceHash: string;
      policyVersion: string;
      targetHash: string;
    };
    claims: {
      missionRelationship: "same-mission";
      company: string;
      actor: string;
      decision: string;
      evidenceHash: string;
      previousStatus: string;
      newStatus: string;
      payloadHash: string;
    };
    verified: boolean;
  };
  unknownHandling: {
    attemptsAfterUnknown: 0;
    resumeRequirement: "reconciliation-or-explicit-human-action";
  };
  terminal: {
    missionStatus: string;
    authorityDecision: "allowed" | "blocked" | "unknown";
  };
}
```

`kernelTier` is captured before the policy floor, while `effectiveTier` is the max of that kernel result and the declared minimum. This prevents a floor from being mistaken for Pi-owned tier derivation. Gate projection contains only kernel gate stages; Pi's scope/input/mode checks are separately audited as adapter guards and are not relabeled as Core gate verdicts.

Projection construction validates all cross-artifact relationships before replacing generated IDs with relationship tokens. For example, `missionRelationship: "same-mission"` is emitted only when the receipt mission ID equals the actual host mission ID. A mismatch throws instead of being normalized.

### 4.5 Exact normalization exclusions

Only these runtime-generated, non-authoritative values are excluded from literal comparison:

1. Raw mission, mission-event, proposal/candidate, blocker, authorization-record, receipt-record, and idempotency-record IDs. Required relationships are retained as equality checks and semantic relationship tokens.
2. Runtime timestamps: mission/event `createdAt` and `updatedAt`, proposal `generatedAt`, approval `at`, authorization `issuedAt`/`expiresAt`, receipt content timestamp, and step start/completion timestamps.
3. Ephemeral signing material: private/public key bytes, generated key ID, signature bytes, and the resulting receipt hash when that hash includes the signature.
4. Host-local temporary `storesRoot`, file names, export paths, and JSON/NDJSON serialization order/whitespace.

No scope element/hash, evidence hash, policy version, materiality tier/floor, gate order/stage/verdict, candidate target/content hash, approver identity/relationship, receipt type/binding/claims, verification result, UNKNOWN retry count, or terminal decision is excluded.

Normalization tests run the same host twice and demonstrate that at least the documented generated IDs/timestamps/signatures differ while the canonical projection remains equal. Separate mutations of every retained authority-bearing category must change the projection or make projection validation throw.

### 4.6 Five mandatory negative controls

Each control starts from the equivalent baseline, mutates exactly one host result, and asserts that the same equivalence matcher fails with the named field:

| Control | Mutation | Required mismatch |
| --- | --- | --- |
| Override Core decision | Change `materiality.effectiveTier` (or a kernel-produced terminal verdict) without changing the bound input | `materiality.effectiveTier` or `terminal.authorityDecision` |
| Change bound input | Change `scope.sourceSnapshot` and recomputed/claimed binding on one side only | `scope.elements.sourceSnapshot` / `scope.scopeHash` |
| Reorder/substitute gate | Swap approval and receipt order, or replace the approval stage | `gates` ordered sequence |
| Upgrade receipt claim | Change `COMPLETION` or its completion claims into execution proof | `receipt.type` / `receipt.claims` |
| Retry UNKNOWN | Set `attemptsAfterUnknown` to `1` and attempt continuation without reconciliation/human input | `unknownHandling.attemptsAfterUnknown` |

The test must exercise the comparator failure; it must not merely assert that mutated objects are unequal.

## 5. D3 — Adapter boundary document

`docs/architecture/rda-adapter-boundary.md` uses the repository's answer-first architecture style and contains:

1. **Boundary in one sentence** — Pi coordinates and presents; humans decide; Drenyra AI owns fiscal authority.
2. **Happy path** — `operator → prepare request → call Drenyra AI → present candidate → human decision → verify receipt → project result`.
3. **Per-step ownership table** with columns `Step`, `Pi owns`, `Human owns`, `Drenyra AI owns`, `Local persistence`, and `Evidence`.
4. **Fail-closed table** for incomplete scope, invalid/corrupt evidence, gate denial, UNKNOWN, receipt verification failure, and unavailable runtime. Each row names the stop behavior and the required resumption actor/action.
5. **Local-store classification** using the labels in §6.
6. **Evidence links** to `./rda-adapter-boundary-audit.md`, `../../__tests__/adapter-boundary-replacement.test.ts`, and the OpenSpec verify report when it exists.
7. **Master alignment** — reference the stable `sdd-040-rda-v2` change and coordination date, state that its final closure identity must be bound during verification, and do not reproduce its 41-requirement mapping or five deferred vocabulary differences.

The document does not introduce a second mapping of Core internals. Detailed requirement verdicts remain in the audit; Core behavior remains in the master closure.

## 6. D4 — Local store classification and non-authority guard

The boundary document classifies the current file-backed surfaces as follows:

| Local persistence | Exact location | Label | Meaning |
| --- | --- | --- | --- |
| Mission snapshots, events, idempotency, recovery | `<storesRoot>/.local/missions/**` | `dev/demo` | Development adapter for driving/recovering kernel missions; persistence alone is not an approval or execution proof |
| Authority records | `<storesRoot>/.local/authority/*.ndjson` | `non-authoritative cache` | Cache of an operator/scope/action binding; a stored `GRANTED` value cannot bypass kernel mission, approval, or receipt gates |
| Evidence graph | `<storesRoot>/.local/evidence/*.ndjson` | `dev/demo` | Local evidence fixture/log; unusable for authority when lineage or payload-hash validation fails |
| Receipt records | `<storesRoot>/.local/receipts/*.json` | `non-authoritative cache` | Cached kernel receipt; storage does not establish validity or signer trust |
| Trusted key registry | `<storesRoot>/.local/trusted-keys.json` | `dev/demo` | Local trust configuration for the harness; the public kernel receipt gate still performs verification |
| Monthly-close exports | `<storesRoot>/.local/exports/*.json` | `non-authoritative cache` | Presentation/export artifact only; never proof of execution |
| Scope context | `~/.drenyra/context.json` | `dev/demo` | Operator convenience input; complete canonical scope is revalidated and cannot supply an approval/receipt |

`__tests__/adapter-boundary-audit.test.ts` adds the guard test named:

`local persistence alone cannot authorize approve or execute`

The test pre-populates local mission/authority/evidence/receipt/export/context-shaped data, including a forged/local `GRANTED` record, then omits or corrupts the required human/kernel authority artifact. It must show that Pi stops at the applicable kernel gate and performs no execute/close transition. A second assertion stores a receipt record without a trusted valid verification path and proves it cannot become execution proof. The exact focused command is:

```bash
bun test __tests__/adapter-boundary-audit.test.ts -t "local persistence alone cannot authorize approve or execute"
```

If this test exposes a real bypass, the correction may only remove/bypass the local authority effect or delegate the verdict to the existing pinned kernel. If `drenyra-ai@0.2.0` lacks the required public behavior, the audit records `BLOCKED`; Pi must not add its own fiscal gate.

## 7. Invariants and failure behavior

1. **Released-only runtime:** `package.json` and `runtime/pin.ts` remain at `drenyra-ai@0.2.0` and checksum `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047`.
2. **Kernel decision ownership:** Pi never computes a tier, accepts a lifecycle transition, creates a gate verdict, or verifies a receipt with Pi-local fiscal rules.
3. **Policy floor monotonicity:** a declared floor may raise but never lower the kernel-derived materiality tier.
4. **Human approval:** approver identity is explicit and bound to the exact candidate/evidence relationship; preparation is not approval.
5. **No local authorization:** local files are inputs/cache only. No combination of local files substitutes for a valid kernel mission/gate/receipt outcome.
6. **UNKNOWN is terminal for automatic continuation:** zero attempts occur after UNKNOWN until reconciliation or explicit human action.
7. **Projection conservatism:** a missing field, broken relationship, unverifiable receipt, or unknown gate stage makes projection fail; it is never omitted or coerced to equivalence.
8. **No circular host:** substitute-host source and its local closure contain no Pi production import.
9. **Evidence integrity:** mission conclusions/actions retain source-to-action lineage and valid payload hashes; invalid graphs are unavailable.
10. **No master duplication:** Pi records host-side structural proof only.

## 8. D5 — Exact apply whitelist

Apply may touch only the following paths. Conditional correction paths are allowed only when WU1 first records a demonstrated violation and the same work unit adds regression evidence.

### Required evidence and documentation

- `docs/architecture/rda-adapter-boundary-audit.md`
- `docs/architecture/rda-adapter-boundary.md`
- `__tests__/adapter-boundary-audit.test.ts`
- `__tests__/adapter-boundary-replacement.test.ts`
- `__tests__/fixtures/rda-replacement-fixture.ts`
- `__tests__/fixtures/rda-substitute-host.ts`

### Conditional smallest-fix paths

- `lib/authority-gates.ts`
- `__tests__/authority-gates.test.ts`
- `lib/chain-pipeline.ts`
- `__tests__/chain-pipeline.test.ts`
- `chains/monthly-close.ts`
- `chains/__tests__/monthly-close-flow.test.ts`
- `lib/accounting-status.ts`
- `__tests__/accounting-status.test.ts`
- `lib/authority-store.ts`
- `__tests__/authority-store.test.ts`
- `lib/receipt-store.ts`
- `__tests__/receipt-verification.test.ts`
- `lib/mission-store.ts`
- `__tests__/mission-store.test.ts`
- `lib/evidence-graph.ts`
- `__tests__/evidence-graph.test.ts`
- `lib/trusted-key-registry.ts`
- `__tests__/trusted-key-registry.test.ts`
- `runtime/context.ts`
- `__tests__/context.test.ts`

### OpenSpec evidence

- `openspec/changes/pi-sdd-040-adapter-boundary/design.md`
- `openspec/changes/pi-sdd-040-adapter-boundary/tasks.md`
- `openspec/changes/pi-sdd-040-adapter-boundary/apply-progress.md`
- `openspec/changes/pi-sdd-040-adapter-boundary/verify-report.md`
- `openspec/changes/pi-sdd-040-adapter-boundary/state.yaml` when managed by the OpenSpec workflow

Explicitly excluded from all edits:

- the `drenyra-ai` repository or master change;
- `vendored/drenyra-ai-0.2.0.tgz` and every other vendored artifact;
- all `runtime/*` except the conditional `runtime/context.ts` labeling/guard path above; `runtime/pin.ts` is read-only evidence;
- `package.json` and lockfiles except read-only pin verification;
- `node_modules/**`, `dist/**`, generated package output, commands, command registries, extensions, agents, and prompts;
- new commands, new agents, new operator workflows, fiscal logic, or unpublished runtime adapters.

An apply actor must stop before editing any unlisted path and return to tasks/design for explicit scope review.

## 9. Test and verification plan

### Focused checks

```bash
bun test __tests__/adapter-boundary-audit.test.ts
bun test __tests__/adapter-boundary-replacement.test.ts
bun test __tests__/authority-gates.test.ts
bun test __tests__/accounting-status.test.ts
bun test __tests__/agents.test.ts
bun test __tests__/chain-pipeline.test.ts
bun test chains/__tests__/monthly-close-flow.test.ts
```

### Final candidate checks

```bash
bun test
bun run typecheck
bun run verify:package
```

Verification also inspects `git diff --name-only` against the whitelist, verifies the package/runtime pin and checksum without modification, confirms the substitute-host import closure, resolves document links, and binds the final master closure identity if available. Exact command output belongs in apply progress and the verify report, not in this design.

## 10. D6 — Reviewable work units for tasks

Changed-line estimates count authored additions plus deletions and exclude generated package output (which is not allowed in the diff).

| Work unit | Deliverable and TDD boundary | Expected paths | Focused evidence | Estimated changed lines | Rollback boundary |
| --- | --- | --- | --- | ---: | --- |
| WU1 — Audit evidence and proven violations | Start with failing audit assertions for materiality ownership, agent ceilings, delegation, UNKNOWN, and local-store non-authority. Make only the smallest pinned-kernel delegation/removal fix if a real violation is reproduced. Publish all ten audit rows only after evidence passes. | `__tests__/adapter-boundary-audit.test.ts`, audit doc, and only applicable conditional fix/test pairs | Focused audit tests plus existing authority/agent/UNKNOWN tests | 180-280 | Remove the audit test/doc and revert only a demonstrated conditional correction with its paired regression test |
| WU2 — Independent replacement harness | **RED:** baseline equivalence/anti-circularity/normalization/each negative control fails for the right reason. **GREEN:** implement fixture and substitute host through public kernel entry points until baseline passes and all five controls still fail. | replacement test and two fixture modules | `bun test __tests__/adapter-boundary-replacement.test.ts` | 300-420 | Remove the harness test, fixture, and substitute host together; no production state migration |
| WU3 — Boundary guide and store classification | Document the seven-step flow, ownership, fail-closed behavior, store labels, and links. Complete any already-proven store label/guard correction with its test; do not add authority behavior. | boundary doc and, only if WU1 proved need, listed store/guard test pair | Document link/readback checks plus local-persistence guard | 140-220 | Remove the boundary doc and revert only the paired store label/guard change |
| WU4 — Final evidence and planning closure | Re-run focused/full checks on one final candidate, reconcile audit links/verdicts, record exact results and workload evidence, and prepare verify handoff. No new product behavior. | OpenSpec apply/verify/state artifacts and final audit evidence updates | `bun test`, `bun run typecheck`, `bun run verify:package`, whitelist/pin inspection | 50-90 | Revert evidence-only updates; do not revert previously verified work units |

**Forecast:** 670-1,010 authored changed lines. `400-line budget risk: High`. `Chained PRs recommended: Yes`. `Decision needed before apply: Yes` under `ask-on-risk`; tasks must honor the orchestrator's cached delivery strategy. A natural chain is WU1, WU2, then WU3+WU4, but tasks may combine WU1 with WU2 only if the measured authored diff remains reviewable. Each work unit keeps its test and behavior/evidence together and records an exact focused result, runtime scenario (or justified N/A), and rollback boundary.

## 11. Requirement coverage

| Requirements | Design location |
| --- | --- |
| `REQ-AUDIT-001..012` | §§3, 6, 7, 9; WU1 |
| `REQ-HARNESS-001..005` | §4; WU2 |
| `REQ-DOC-001..004` | §§5-6; WU3 |
| `REQ-ALIGN-001..003` | §§1, 5, 7, 9 |
| `REQ-BOUND-001..006` | §§7-9 and whitelist exclusions |

No requirement expands Pi into an authority implementation. When evidence and the published kernel cannot satisfy a requirement, the only designed outcome is a cited blocked report.
