# Design: Pi Participation in SDD-010

> Change: `pi-sdd-010-participation`
> Product: `drenyra-pi`
> Status: designed
> Artifact store: HYBRID — OpenSpec files are authoritative; Engram is best-effort
> Date: 2026-08-14
> Baseline: `main` at `c354274`, intentionally dirty, with no-commit handoff
> Program authority: `arkelythex/drenyra-ai@4975f4f`, SDD-010 Wave 0

## 1. Executive design

This change is a bounded participation/evidence slice, not a new runtime platform. It restores the two known failing tests, freezes Pi's two local contracts after checking their claims against real source and tests, adds a validated master-compatible capability checkpoint, and records final-candidate lock facts without modifying the program master.

The implementation has four owned outputs:

1. **Frozen local contracts** — final v0.1 bytes plus a regenerated package content manifest.
2. **Conformance evidence** — an explicit claim-to-source/test matrix; no duplicate conformance test because the inspected suite already binds the 16 commands, seven agents, released pin/checksum, install, doctor, package integrity, and release posture.
3. **Participant checkpoint artifacts** — root `capability-manifest.yaml` and `docs/architecture/program-lock-facts.json`, both Pi-owned and non-authoritative for program promotion.
4. **Final-candidate evidence** — a reproducible dirty-candidate identity over an exact Pi-local path set, then ROADMAP/OpenSpec state updated last.

No output advances Gate 0. The master capability matrix, program lock, gates, and later SDDs remain master-owned.

## 2. Decisions at a glance

| ID | Decision |
| --- | --- |
| D1 | Move the flat spec to `openspec/changes/pi-sdd-010-participation/specs/participation/spec.md` and add `specs/README.md`. Do not create `openspec/specs/participation/spec.md`. |
| D2 | Add `capability-manifest.yaml` at repository root using the JSON-compatible YAML 1.2 serialization profile, validated by `scripts/verify-capability-manifest.mjs` and `__tests__/capability-manifest.test.ts`. Wire a separate `verify:capability` script only. |
| D3 | Add static, apply-authored `docs/architecture/program-lock-facts.json`; verify its shape and cross-artifact consistency in `__tests__/lock-facts.test.ts`. |
| D4 | Add `scripts/compute-candidate-identity.mjs`; identity is `dirty-sha256:<digest>` over HEAD plus sorted changed/new/deleted allowlisted paths and normalized per-file hashes. |
| D5 | Freeze contract headers to `Version: v0.1 · Status: frozen`, update the index to `0.1 / Frozen`, then regenerate `contracts/SHA256SUMS.json` once final contract bytes are stable. |
| D6 | Record the conformance map in `apply-progress.md`. Existing tests close all inspected claims, so `__tests__/contracts-conformance.test.ts` is not added. |
| D7 | Correct only the stale private-state assertion to public state while preserving every no-publish assertion. Follow RED → contract/artifact work → manifest regeneration → GREEN → typecheck/checks → planning state last. |
| D8 | Check exactly four ROADMAP Phase 1 items only after fresh evidence; replace `current_test_state` with final counts, command, result, candidate identity, and evidence date. |

## 3. Ownership and dependency boundaries

```text
program master (read-only)
  capability-matrix.yaml Pi row
  program-lock.json Pi row
             |
             | names and checkpoint shape only
             v
Pi-owned participation artifacts
  capability-manifest.yaml
  docs/architecture/program-lock-facts.json
             |
             | verified against local source/tests
             v
Pi contracts and runtime truth
  contracts/*.md + contracts/SHA256SUMS.json
  extensions/register.ts
  agents/
  runtime/{pin,resolve,checksum,doctor}.ts
  existing Vitest suites and verification scripts
```

Ownership invariants:

- `capability-manifest.yaml` and `program-lock-facts.json` are **participant checkpoint inputs**, never replacements for master artifacts.
- Validators read only the Pi repository and never write either repository.
- The apply and verify phases may read the master Pi rows but must not write anywhere under `/home/dreamcoder08/Documents/PROYECTOS/drenyra-ai`.
- `scripts/verify-package-files.mjs --update` is the only writer for `contracts/SHA256SUMS.json`.
- Timestamps are evidence metadata, not candidate identity.
- No command, agent, chain, runtime behavior, publication path, commit, or PR is introduced.

## 4. D1 — OpenSpec layout

The final change-local spec layout follows the archived project convention:

```text
openspec/changes/pi-sdd-010-participation/
  proposal.md
  design.md
  tasks.md
  apply-progress.md                 # created during apply
  specs/
    README.md
    participation/
      spec.md
```

The tasks/apply sequence moves, without changing requirement semantics:

```text
openspec/changes/pi-sdd-010-participation/spec.md
  -> openspec/changes/pi-sdd-010-participation/specs/participation/spec.md
```

`specs/README.md` indexes one domain, `participation`, and records the requirement families `REQ-BASE`, `REQ-CON`, `REQ-CONF`, `REQ-CAP`, `REQ-LOCK`, `REQ-ROAD`, and `REQ-BOUND`. This is change-local organization only. A canonical `openspec/specs/participation/spec.md` is explicitly out of scope because canonical specs describe runtime domains; promoting this program-participation contract can be considered only as a later archive-policy follow-up.

## 5. D2 — Capability manifest

### 5.1 Path and serialization

Use repository-root `capability-manifest.yaml`. Root placement makes it discoverable as a per-repository program checkpoint, while YAML naming aligns with the master's `capability-matrix.yaml`.

To avoid adding a parser dependency to a zero-runtime-dependency package, the file uses the **JSON-compatible YAML 1.2 profile**: UTF-8 JSON object bytes with a final newline. JSON is a valid YAML 1.2 subset, remains readable by master YAML tooling, and is parsed deterministically with `JSON.parse`. Arbitrary YAML features such as anchors, tags, and implicit scalars are intentionally unsupported.

### 5.2 Exact schema

```ts
interface CapabilityManifestV1 {
  schemaVersion: "drenyra.capability-manifest.v1";
  repository: {
    name: "drenyra-pi";
    package: "drenyra-pi";
    role: "agentic-runtime";
    version: string; // exactly package.json.version
  };
  capabilities: Record<MasterPiCapabilityName, CapabilityEntry>;
  testState: {
    command: "bun test";
    result: "passing" | "failing";
    files: number;  // non-negative integer
    total: number;  // non-negative integer
    passed: number; // non-negative integer
    failed: number; // non-negative integer; must be 0 when result=passing
    evidenceRef: "docs/architecture/program-lock-facts.json#/tests";
  };
  generatedAt: string; // canonical UTC ISO-8601 instant
  derivedFrom: readonly string[]; // non-empty, stable source references
}

type MasterPiCapabilityName =
  | "persona-startup-panel"
  | "drenyra-commands"
  | "pi-subagents"
  | "model-routing"
  | "packaged-skills"
  | "rda-chains"
  | "tool-safety-broad-deny"
  | "engram-integration"
  | "pinned-ai-runtime"
  | "configurator-install-doctor-sync";

type CapabilityState = "implemented" | "partial" | "planned";

interface CapabilityEntry {
  state: CapabilityState;
  evidence: {
    sources: readonly string[];
    tests: readonly string[];
    limitation?: string;
    plan?: string;
  };
}
```

No additional capability key is allowed and all ten keys are required exactly once. `derivedFrom` includes the read-only master matrix reference at `arkelythex/drenyra-ai@4975f4f`, the local package version source, and the local conformance evidence reference.

State/evidence invariants:

- `implemented`: at least one existing local source path and one existing local test path; `limitation` and `plan` absent.
- `partial`: at least one existing local source/test reference and a non-empty `limitation`; `plan` absent.
- `planned`: non-empty `plan`; no executable claim is inferred from it. Sources/tests may cite planning guards but cannot be used to report the state as implemented.
- Evidence paths are repository-relative, cannot contain `..`, and must exist.
- `passed + failed === total` and all counts match the lock-fact test object.
- The initial evidence-backed state assignment is:

| Capability | State | Evidence basis |
| --- | --- | --- |
| `persona-startup-panel` | implemented | `extensions/startup-panel.ts`, persona content, startup/extension tests |
| `drenyra-commands` | implemented | `extensions/register.ts`, exact 16-command assertions in `__tests__/extension.test.ts` |
| `pi-subagents` | implemented | seven definitions and `__tests__/agents.test.ts` |
| `model-routing` | partial | advisory registry exists, but the host exposes no model-routing API |
| `packaged-skills` | implemented | three packaged skills and package/extension tests |
| `rda-chains` | implemented | monthly-close/reconcile/verify/evidence chains and their tests |
| `tool-safety-broad-deny` | implemented | agent definitions plus broad-deny assertions in `__tests__/agents.test.ts` |
| `engram-integration` | partial | memory boundary/content exists, but no complete executable integration is evidenced |
| `pinned-ai-runtime` | implemented | `runtime/pin.ts`, doctor/resolve/package verification suites |
| `configurator-install-doctor-sync` | planned | master SDD-020/Gate 0 plan only; no local implementation |

The apply phase must downgrade, never upgrade, a state if an evidence path or test does not support this table.

### 5.3 Validator contract

Add `scripts/verify-capability-manifest.mjs` as a zero-dependency ESM CLI.

```text
node scripts/verify-capability-manifest.mjs
node scripts/verify-capability-manifest.mjs --manifest <path> --root <path>
```

Behavior:

- Exit `0`: valid manifest; print `verify-capability-manifest: OK`.
- Exit `1`: syntax/schema/semantic inconsistency; print `verify-capability-manifest: FAILED` and one line per violation.
- Exit `2`: invalid CLI usage or unreadable requested file/root.
- The validator is read-only.

Required diagnostic forms include:

```text
invalid YAML/JSON serialization: <parser message>
missing required role: expected agentic-runtime
unknown capability: <name>
missing capability: <name>
unsupported capability state for <name>: <state>
state implemented for <name> is not backed by executable evidence
state partial for <name> requires a non-empty limitation
state planned for <name> requires a non-empty plan
missing evidence path for <name>: <path>
testState counts are inconsistent: passed + failed must equal total
```

Add `__tests__/capability-manifest.test.ts`. It spawns the CLI against deterministic temporary roots and covers: valid manifest passes; unknown capability fails; missing role fails; invalid YAML/JSON fails; implemented state without source/test evidence fails; inconsistent counts fail. A final real-repository case validates `capability-manifest.yaml`.

### 5.4 Package script wiring

Add only:

```json
"verify:capability": "node scripts/verify-capability-manifest.mjs"
```

Keep it separate from `verify:package`. The capability file is program-participation evidence, not shipped package content, and folding it into `verify:package` would add a checkpoint concern to `prepack` and `prepublishOnly`. Do not change `prepack` or `prepublishOnly`, and do not add any publish gate.

## 6. D3 — Program lock facts

### 6.1 Path and production model

Use `docs/architecture/program-lock-facts.json`. The path keeps machine-readable architecture/checkpoint evidence near the existing architecture documentation without placing a Pi-local record beside master authority.

This is a **static artifact authored during apply from actual command output**, not a generator's speculative snapshot. The apply phase writes it after the first complete verification pass, then the final verification phase checks it against the same candidate. A generated artifact would still require trusted capture of test counts and active changes; generation adds machinery without improving authority. Shape and cross-artifact consistency are automated instead.

### 6.2 Exact schema

```ts
interface ProgramLockFactsV1 {
  schemaVersion: "drenyra.program-lock-facts.v1";
  participantCheckpoint: true;
  authorityNotice: "Pi-local input; does not modify or promote the program master";
  headSha: string; // full 40-char lowercase Git SHA, beginning with c354274 at this baseline
  candidateIdentity: `dirty-sha256:${string}`; // D4, exactly 64 lowercase hex chars after prefix
  packageVersion: string; // package.json.version
  contracts: {
    consumed: readonly ContractFact[];
    produced: readonly ContractFact[];
  };
  tests: {
    files: number;
    passed: number;
    failed: number;
    total: number;
    command: "bun test";
  };
  checksums: {
    pinEntrySha256: string;
    contentManifest: {
      path: "contracts/SHA256SUMS.json";
      sha256: string; // digest of the manifest file itself
    };
  };
  capabilityStates: {
    manifest: "capability-manifest.yaml";
    schemaVersion: "drenyra.capability-manifest.v1";
    digestSha256: string;
  };
  activeChanges: readonly string[];
  evidenceDate: string; // YYYY-MM-DD UTC
  derivationCommands: readonly string[];
}

interface ContractFact {
  name: string;
  version: string;
}
```

Required contract facts are:

- consumed: `mission-protocol@0.1`, `candidate@0.1`, `receipt@0.1`, `gate@0.1`, `ledger@0.1`, and `recovery@0.1`, limited to contracts confirmed by local imports/tests;
- produced: `package-contract@0.1` and `runtime-dependency@0.1`.

`activeChanges` is sorted and includes `pi-sdd-010-participation` while active plus every other real local OpenSpec change discovered at evidence time; it does not copy the stale master row. `derivationCommands` includes, at minimum, the exact HEAD query, candidate identity command, full test command, typecheck, package verification, style verification, capability validation, and manifest-file checksum command used by apply.

### 6.3 Shape validation

Add the separate `__tests__/lock-facts.test.ts`, rather than mixing two authority surfaces in the capability test. It validates:

- exact schema/version/notice and no missing required field;
- full HEAD SHA and distinct `dirty-sha256:<64 lowercase hex>` candidate identity;
- package version equals `package.json`;
- contract names/versions are unique and include the required consumed/produced set;
- integer test arithmetic and zero failures;
- pin checksum equals `DEFAULT_PIN.checksumSha256`;
- manifest and capability digests are valid and match current bytes;
- capability reference/state counts agree with `capability-manifest.yaml`;
- active changes are sorted and include this change;
- candidate identity re-derived by `scripts/compute-candidate-identity.mjs` equals the recorded value.

## 7. D4 — Dirty-candidate identity

### 7.1 Identity scope

The identity intentionally excludes unrelated dirty files and `.codegraph/`. Its exact intended path set is the apply whitelist in §13 plus these immutable planning inputs: `openspec/changes/pi-sdd-010-participation/proposal.md` and `openspec/changes/pi-sdd-010-participation/design.md`. (`tasks.md` is already in the apply whitelist because apply records task completion.) This prevents pre-existing user work from contaminating Pi's checkpoint while covering every tracked change, deletion, and new file owned by this change through the apply boundary.

Add `scripts/compute-candidate-identity.mjs`. Both apply and verify invoke exactly:

```bash
node scripts/compute-candidate-identity.mjs
```

It prints one line: `dirty-sha256:<64 lowercase hex>` and exits non-zero if Git/HEAD cannot be read, an allowlisted path cannot be classified, normalization fails, or no allowlisted candidate change exists.

### 7.2 Canonical algorithm

1. Resolve full HEAD with `git rev-parse HEAD`; require 40 lowercase hex characters.
2. Use the immutable, lexicographically sorted path list in §13, embedded in the script as `PARTICIPATION_PATHS_V1`.
3. For each allowlisted path, compare HEAD to the working tree/index and classify only changed entries as `A` (new), `M` (modified), or `D` (deleted). Include staged and unstaged bytes; for an existing file, hash the working-tree bytes. A deleted path has digest `-`.
4. Record Git mode (`100644` or `100755`) from HEAD for tracked files and from the executable bit for new files. A deletion records the HEAD mode.
5. Before hashing identity-bearing files, normalize self-references only:
   - in `docs/architecture/program-lock-facts.json`, parse JSON and replace `candidateIdentity` with the exact string `__CANDIDATE_IDENTITY__`, then serialize as compact JSON with recursively lexicographically sorted object keys and a final newline;
   - in `openspec/config.yaml`, replace only the scalar value of `current_test_state.candidate_identity` with `__CANDIDATE_IDENTITY__`, preserving all other bytes;
   - in `openspec/changes/pi-sdd-010-participation/apply-progress.md`, replace only values following the literal label `Candidate identity:` with `__CANDIDATE_IDENTITY__`.
6. Compute lowercase SHA-256 for each existing normalized byte sequence.
7. Build this UTF-8 canonical manifest, with entries sorted by path and literal NUL separators (`\0`):

```text
candidate-format\0drenyra.pi.participation.v1\n
head\0<FULL_HEAD_SHA>\n
path\0<PATH>\0state\0<A|M|D>\0mode\0<MODE>\0sha256\0<DIGEST_OR_DASH>\n
...
```

**Step 8.** Compute SHA-256 of the canonical manifest and prefix it with `dirty-sha256:`.

The prefix and inclusion of HEAD make the candidate identity structurally and semantically different from bare HEAD `c354274`. Deletions cover the flat-spec move; new files cover the manifest, scripts, tests, nested spec, and lock facts. The normalization removes only unavoidable self-reference, so changing any other byte, path state, mode, or HEAD changes the identity.

### 7.3 Finalization protocol

1. Write all implementation/evidence/planning bytes with `candidateIdentity` placeholders.
2. Compute the identity.
3. Write the same value into lock facts, `current_test_state.candidate_identity`, and apply progress.
4. Recompute; it must be identical because only normalized fields changed.
5. Run final checks without modifying source bytes.
6. Verify recomputes the identity independently and rejects any mismatch.

## 8. D5 — Contract freeze mechanics

### 8.1 Exact edits

In `contracts/package-contract.md`:

```text
> Version: 0.1-draft · Status: draft · Applies to: `drenyra-pi` npm package.
```

becomes:

```text
> Version: v0.1 · Status: frozen · Applies to: `drenyra-pi` npm package.
```

The content pass retains the exact 16-command list, seven-agent inventory, and released `drenyra-ai@0.2.0` checksum claim, correcting prose only if the source check below finds a mismatch.

In `contracts/runtime-dependency.md`:

```text
> Version: 0.1-draft · Status: draft · Applies to: Drenyra Pi ↔ Drenyra AI.
```

becomes:

```text
> Version: v0.1 · Status: frozen · Applies to: Drenyra Pi ↔ Drenyra AI.
```

Its pin, package-locality, no-PATH, checksum, doctor, and fail-closed claims remain frozen only if they match runtime source and tests.

In `contracts/README.md`:

- replace the draft pre-alpha status sentence with a frozen-v0.1 statement for these two local contracts;
- change both index versions from `0.1-draft` to `0.1`;
- change both statuses from `Draft` to `Frozen`;
- leave unrelated requirements unchanged.

### 8.2 Claim-to-source check

Before changing either status, apply records this matrix in `openspec/changes/pi-sdd-010-participation/apply-progress.md`:

| Frozen claim | Canonical/source check | Test evidence |
| --- | --- | --- |
| 16 commands | `extensions/register.ts` descriptor and registrations; canonical commands REQ-CMD-001..010 | `__tests__/extension.test.ts` exact descriptor/registration arrays and total 16 |
| seven agents | exact `agents/*.md` inventory | `__tests__/agents.test.ts`; package mirror assertions in `__tests__/extension.test.ts` |
| pin/version/state/checksum | `runtime/pin.ts` | `__tests__/pin.test.ts`, `__tests__/package-verify.test.ts` |
| package-local/no PATH | `runtime/resolve.ts` | `__tests__/resolve.test.ts` |
| checksum + fail-closed doctor | `runtime/checksum.ts`, `runtime/doctor.ts` | `__tests__/doctor.test.ts`, `__tests__/status.test.ts` |

Each row records `match` or `blocked`, the observed value, exact source path, exact test path, and command/result. Any `blocked` row prevents the corresponding freeze.

### 8.3 Manifest ordering invariant

The only valid sequence is:

```text
finalize package-contract.md bytes
-> finalize runtime-dependency.md bytes
-> finalize contracts/README.md bytes
-> node scripts/verify-package-files.mjs --update
-> bun test __tests__/package-verify.test.ts
-> node scripts/verify-package-files.mjs
-> no further edit to any covered contract/schema byte
```

Because `collectCoveredFiles` recursively covers all files under `contracts/` except `contracts/SHA256SUMS.json`, plus `assets/schemas/`, adding the root capability manifest or lock-fact record does not alter package-manifest coverage. Any later covered-file edit invalidates the evidence and requires regeneration plus both verification commands again.

## 9. D6 — Conformance map and gap decision

### 9.1 Required apply evidence

`apply-progress.md` contains this completed table with actual command results:

| Area | Existing covering tests/checks | Frozen claim bound |
| --- | --- | --- |
| install | `__tests__/installer.test.ts`; packed-install invocation asserted by `__tests__/release-verify-workflow.test.ts` | exact pin source, vendored/release fallback, install failure behavior |
| doctor | `__tests__/doctor.test.ts`, `__tests__/status.test.ts` | version/checksum verification and fail-closed verdicts |
| pin | `__tests__/pin.test.ts`, `__tests__/package-verify.test.ts` | `drenyra-ai@0.2.0`, released state, exact entry checksum |
| package integrity | `__tests__/package-verify.test.ts`; `node scripts/verify-package-files.mjs` | all `collectCoveredFiles` entries reconciled; vendored artifact reconciled |
| release verification | `__tests__/release-verify-workflow.test.ts` | verification-only release gate, future publish wording, no `npm publish` |
| command surface | `__tests__/extension.test.ts` | exact 16-command descriptor and registration surface bound to `extensions/register.ts` |
| agent inventory | `__tests__/agents.test.ts`, `__tests__/extension.test.ts` | exactly seven parseable definitions and byte-identical packaged mirrors |

### 9.2 Gap decision

The source inspection resolves the deferred decision: **do not add `__tests__/contracts-conformance.test.ts`.**

- The exact 16-command list is already asserted as arrays against the exported descriptor and registration behavior in `__tests__/extension.test.ts`.
- The pin version, released state, and exact checksum are asserted in `__tests__/pin.test.ts`; the same checksum is bound to the real vendored entry artifact in `__tests__/package-verify.test.ts`.
- The seven-agent inventory is asserted exactly in `__tests__/agents.test.ts`, including parseability and mirrors.

A dedicated file would duplicate real assertions rather than close a gap, violating REQ-CONF-002. Apply must revisit this decision only if one of those existing assertions is absent or removed in the actual candidate; in that case it stops and returns to design/tasks rather than inventing a broader test during apply.

## 10. D7 — Baseline correction and execution order

### 10.1 Exact release-test edit

In `__tests__/release-verify-workflow.test.ts`, rename the documentation describe/test labels from private state to public state and replace only the obsolete assertion. The resulting assertion block is:

```ts
expect(releasing).toContain("release-verify.yml");
expect(releasing).toMatch(/no publish|verification-only|does not publish/i);
expect(releasing).toContain("public");
```

The following existing test remains unchanged:

```ts
expect(releasing).toMatch(/future publish/);
expect(releasing).not.toContain("npm publish");
```

This is deliberately a positive public-state assertion. It does not weaken workflow verification or merely delete the old private assertion.

### 10.2 Whole-change order

1. **RED capture:** run `bun test`; record the expected 2 failures (release wording and package manifest), with no completion claim.
2. **TDD tests first:** add failing capability-manifest and lock-facts tests; make the minimum validator/identity/artifact implementation green.
3. **Baseline wording:** apply the exact public-state assertion edit and run its focused test.
4. **Claim matrix:** compare contracts to canonical specs, source, inventory, and existing tests; block freeze on any mismatch.
5. **Freeze contracts:** edit the two headers/content and `contracts/README.md` exactly as §8 requires.
6. **Regenerate once:** run `node scripts/verify-package-files.mjs --update` only after final covered bytes.
7. **Focused GREEN:** run release, package, capability, and lock-fact focused tests/checks.
8. **Full GREEN:** run `bun test`, capture final file/pass/fail/total counts, then `bun run typecheck`, `node scripts/verify-package-files.mjs`, `bun run verify:style`, and `bun run verify:capability`.
9. **Checkpoint facts:** populate final manifest/lock facts from observed output and active-change discovery.
10. **Planning state last:** update exactly the ROADMAP/config fields in §11.
11. **Candidate identity:** compute/write/recompute per §7.
12. **Exact-candidate verification:** rerun `bun test`, typecheck, package, style, and capability checks without source mutation. If counts or bytes differ, update evidence, recompute identity, and repeat once from the affected invariant; never claim stale evidence.

## 11. D8 — ROADMAP and OpenSpec state

### 11.1 ROADMAP

Only these existing Phase 1 lines may change from `[ ]` to `[x]`, each after its evidence condition is true:

| Exact item | Required evidence before checking |
| --- | --- |
| `Freeze package-contract v0.1 (install surface, provided capabilities, versioning)` | package header frozen, README row Frozen, command/agent/pin claim rows all `match`, package verification green |
| `Freeze runtime-dependency v0.1 (pin strategy, verification, package-locality)` | runtime header frozen, README row Frozen, pin/resolve/doctor claim rows all `match`, focused suites green |
| `Command contract: /drenyra:* surface and expected outputs` | exact 16-command `extension.test.ts` assertions green and mapped in apply evidence |
| `Conformance tests for install/doctor/pin verification` | installer/doctor/resolve/pin/package map complete and full suite green; no duplicate-test gap |

Do not change Phase 0, Phase 2, Phase 3, national-alignment, Gate 0, or SDD-020 checkboxes in this change.

### 11.2 `current_test_state`

Replace the stale block with this exact shape, using observed values rather than design-time numbers:

```yaml
current_test_state:
  files: <final integer>
  tests: <final integer total>
  passing: <true only when failed=0>
  failed: <final integer>
  command: bun test
  candidate_identity: dirty-sha256:<64 lowercase hex>
  evidence_date: 2026-08-14
  evidence: >-
    pi-sdd-010-participation final-candidate verification; see
    docs/architecture/program-lock-facts.json and the change verify report
```

The values must equal `program-lock-facts.json.tests`; the candidate identity is normalized only for D4 hashing. The archived 493-test evidence is removed from the current-state claim, not retained as current evidence.

## 12. Data flow and verification contracts

```text
master Pi row (read-only names/states)
  + local source/tests
  -> claim matrix
  -> frozen contract bytes
  -> package content manifest regeneration
  -> capability-manifest.yaml
  -> capability validator
  -> first full test/check pass
  -> static program-lock-facts.json
  -> ROADMAP/config last
  -> deterministic dirty candidate identity
  -> final exact-candidate test/check pass
  -> verify re-derives identity and boundary evidence
```

Cross-artifact invariants:

- `package.json.version === capability-manifest.repository.version === program-lock-facts.packageVersion`.
- Capability keys equal the ten master Pi names exactly.
- Capability test counts equal lock-fact test counts and final `current_test_state` counts.
- Capability manifest digest in lock facts equals current manifest bytes.
- Pin checksum in lock facts equals `runtime/pin.ts` and the real package-verification result.
- Content-manifest digest identifies the final `contracts/SHA256SUMS.json` bytes.
- HEAD and candidate identity are both present and never equal or conflated.
- Every completion claim is made only after the final candidate is green.

## 13. Exact apply whitelist

The apply phase may create, modify, move, or delete **only** these paths:

```text
__tests__/capability-manifest.test.ts
__tests__/lock-facts.test.ts
__tests__/release-verify-workflow.test.ts
capability-manifest.yaml
contracts/README.md
contracts/SHA256SUMS.json
contracts/package-contract.md
contracts/runtime-dependency.md
docs/architecture/program-lock-facts.json
openspec/changes/pi-sdd-010-participation/apply-progress.md
openspec/changes/pi-sdd-010-participation/spec.md                         # delete after verified move
openspec/changes/pi-sdd-010-participation/specs/README.md
openspec/changes/pi-sdd-010-participation/specs/participation/spec.md
openspec/changes/pi-sdd-010-participation/tasks.md
openspec/config.yaml
package.json
ROADMAP.md
scripts/compute-candidate-identity.mjs
scripts/verify-capability-manifest.mjs
```

`proposal.md` and `design.md` are read-only planning inputs during apply but remain in the candidate-identity path set. `tasks.md` is apply-owned only for task-status/evidence updates. A verify report/archive artifact may be created only by its own later SDD phase and is not part of the apply candidate identity.

Before mutation, apply snapshots the status of all dirty paths. After mutation, it compares changed paths with this whitelist and confirms pre-existing out-of-scope path identities are unchanged. Any unexpected path is a hard scope failure; do not clean, reset, stage, or repair it. `.codegraph/` and all master-repository paths are always excluded.

## 14. Build plan for tasks/apply

### Work unit 1 — Spec layout and RED baseline

- Move the flat spec into `specs/participation/spec.md`; add the one-domain index.
- Run and record `bun test` with the expected two baseline failures.
- Apply the precise release assertion correction and run its focused test.
- Rollback boundary: spec move/index and release test only.

### Work unit 2 — Capability checkpoint validator (strict TDD)

- RED: add deterministic CLI tests including invalid syntax and semantic evidence failures.
- GREEN: add `capability-manifest.yaml`, zero-dependency validator, and `verify:capability` script.
- TRIANGULATE: unknown/missing capability, missing role, unsupported state, evidence mismatch, bad count arithmetic.
- Rollback boundary: manifest, validator, capability test, and package script entry.

### Work unit 3 — Candidate identity and lock facts (strict TDD)

- RED: add lock-fact shape/cross-artifact/re-derivation test.
- GREEN: add candidate identity CLI and static lock facts with placeholders.
- TRIANGULATE: modified/new/deleted entries, sorted order, self-reference normalization, invalid digest, mismatched package/pin/capability digest.
- Rollback boundary: identity script, lock-fact artifact, and lock-fact test.

### Work unit 4 — Contract claim check and freeze

- Complete the claim matrix from exact source/spec/test evidence.
- Freeze both headers and index rows only if every applicable row matches.
- Regenerate `contracts/SHA256SUMS.json` after final covered bytes, then immediately run focused package verification.
- Rollback boundary: the three contract docs plus generated manifest as one consistency unit.

### Work unit 5 — Final evidence and planning state

- Run focused checks, full `bun test`, typecheck, package, style, and capability validation.
- Populate manifest/lock facts from observed results; enumerate active local changes.
- Update only the four ROADMAP Phase 1 lines and `current_test_state` last.
- Compute/write/recompute candidate identity; rerun all final checks against those exact bytes.
- Rollback boundary: participant artifacts and planning-state lines; never roll back unrelated work.

No work unit creates a commit or PR. If tasks forecast more than 400 authored changed lines, the orchestrator's `ask-on-risk` workload guard applies even though delivery remains uncommitted.

## 15. Test matrix

| Requirement area | Focused proof | Final proof |
| --- | --- | --- |
| REQ-BASE | release test; package verification test/script | full `bun test` zero failures |
| REQ-CON | claim matrix; pin/resolve/doctor/extension/agent focused suites | package verification after final bytes |
| REQ-CONF | completed mapping; no-gap decision | full suite confirms mapped tests |
| REQ-CAP | capability validator deterministic cases | `bun run verify:capability` + real-manifest test |
| REQ-LOCK | shape, digest, arithmetic, and identity re-derivation test | independent identity recomputation in verify |
| REQ-ROAD | ROADMAP/config readback against lock facts | exact-candidate full suite and verify report |
| REQ-BOUND | whitelist/out-of-scope status comparison; master read-only check | verify explicitly confirms no gated work, master edits, publish, commit, PR, or dirty-file mutation |

Runtime harness evidence is `N/A` for the new checkpoint files because they add no runtime behavior; the existing runtime source is exercised through installer/doctor/resolve/pin/package tests. Each apply work unit records its focused command/result and rollback boundary in `apply-progress.md`.

## 16. Risks and mitigations

1. **Self-referential candidate identity** — fixed-field normalization is specified and tested; all other bytes remain identity-bearing.
2. **YAML parser/dependency creep** — use the JSON-compatible YAML 1.2 profile and built-in deterministic parsing.
3. **Overstated capability states** — exact state evidence invariants require executable source/tests and mandatory limitations for partial states.
4. **Stale package hashes** — contract bytes freeze before the single regeneration; no later covered-file edits are allowed.
5. **Duplicate conformance maintenance** — existing exact assertions close the named claims; no new aggregate test is added.
6. **False program authority** — both checkpoint artifacts carry participant/local authority labels and validators never write master files.
7. **Unrelated dirty work contamination** — candidate identity and mutation checks use the exact whitelist, not whole-worktree cleanup.
8. **Planning claims ahead of proof** — ROADMAP/config updates are last and cross-checked against lock facts and the final full-suite run.

## 17. Rollout and rollback

Rollout is local and verification-only. There is no migration, publication, feature flag, commit, PR, or master update. The program master may later consume these facts in a separate master-owned checkpoint after its own validation.

Rollback is path-scoped:

- remove the capability artifact/validator/test/script entry together;
- remove lock facts/identity script/test together;
- restore both contract docs and index together, then regenerate or restore `SHA256SUMS.json` consistently;
- restore only the four ROADMAP lines and `current_test_state` block;
- reverse the spec move without changing requirement content;
- restore only the release assertion changed by this work.

Never use blanket reset/clean and never touch master or unrelated dirty paths.
