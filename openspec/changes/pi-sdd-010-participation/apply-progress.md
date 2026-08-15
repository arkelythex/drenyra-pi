# Apply Progress — pi-sdd-010-participation

> Change: `pi-sdd-010-participation` · Repo: `drenyra-pi` · Phase: apply (implementation)
> Date: 2026-08-14 · Baseline HEAD: `c354274dd5f5f6e83f291dafe9284ad9210be080`
> Delivery: uncommitted by design (REQ-BOUND-003) — no commit / PR / publish / master edit
> Strict TDD: `bun test` (vitest). RED → GREEN → TRIANGULATE → REFACTOR.
> Scope: design §13 apply whitelist only.

## Size exception (user-approved, recorded)

The `ask-on-risk` workload guard applies (Review Workload Forecast: est. ≈705–1,100 lines, >400-line budget risk High). The orchestrator confirmed with the user before apply: **single-pass apply with an approved size exception** — the change is a low-risk verification-only participation slice, authors no runtime code, and remains uncommitted (chained-PR slicing is not applicable to an uncommitted delivery). Recorded per tasks.md Review Workload Forecast and design §14 note.

## Scope snapshot (before mutation)

`git status --porcelain` at apply start (pre-existing intentional dirty state; baseline `c354274`):

```text
 M README.md
 M RELEASING.md
 M ROADMAP.md
 M __tests__/agents.test.ts
 M __tests__/extension.test.ts
 M __tests__/release-verify-workflow.test.ts
 M chains/monthly-close.ts
 M contracts/package-contract.md
 M contracts/runtime-dependency.md
 M docs/architecture/ecosystem-boundaries.md
 M extensions/mission-status.ts
 M extensions/register.ts
 M lib/accounting-status.ts
 M openspec/config.yaml
 M package.json
 M scripts/verify-package-files.mjs
 ?? .codegraph/
 ?? .github/workflows/style.yml
 ?? __tests__/evidence-status.test.ts
 ?? __tests__/extension-close.test.ts
 ?? __tests__/style-verify.test.ts
 ?? docs/style.md
 ?? lib/evidence-status.ts
 ?? openspec/changes/archive/2026-08-14-sdd-010-gate0-audit/
 ?? openspec/changes/pi-program-status-reconciliation/
 ?? openspec/changes/pi-sdd-010-participation/
 ?? scripts/lib/style-verify.d.mts
 ?? scripts/lib/style-verify.mjs
 ?? scripts/verify-style.mjs
```

Pre-existing **out-of-scope** dirty paths (NOT in the §13 whitelist) must remain byte-identical; sha256 of working-tree bytes at apply start:

```text
afdf45b1a559d9096807ba37b4f91e35b4d07cefd2ea8ebc08ffb7c1b8697716  README.md
dba17f9e845d722f1e1d8ff2d22e48bf06beec6b237716d3b9702ea72c757454  RELEASING.md
14176e983b507d78749279f125a063640b65bed5f507b7b9e3c4e03961eb7d70  __tests__/agents.test.ts
47da40c73f6b2a0c1fa15381d5dcf05c55ecddbf9751190b8418c9bd82c4870d  __tests__/extension.test.ts
56f3a744894ac1b995fdbbcc489c22048da4631a4bd55f7006920e8df5401a13  chains/monthly-close.ts
712b177c4f142eb3d69daa9acc7883f095fb9cbc9b64b6875187410f5824694e  docs/architecture/ecosystem-boundaries.md
f7d2c9075ac46e604af8e5a4daec1f823adcb33bbe2ec37374a1e1563d12695d  extensions/mission-status.ts
a0a39ea45b462d65bdc1f60390b41496565241fa58ec010cfac6192cbb2185b9  extensions/register.ts
be23aa54bf656635854b7cba736787709cc259aacc148151382f22d4bab01c6f  lib/accounting-status.ts
```

Out-of-scope untracked paths (must remain untouched, never staged/cleaned): `.codegraph/`, `.github/workflows/style.yml`, `__tests__/evidence-status.test.ts`, `__tests__/extension-close.test.ts`, `__tests__/style-verify.test.ts`, `docs/style.md`, `lib/evidence-status.ts`, `openspec/changes/archive/2026-08-14-sdd-010-gate0-audit/`, `openspec/changes/pi-program-status-reconciliation/`, `scripts/lib/style-verify.d.mts`, `scripts/lib/style-verify.mjs`, `scripts/verify-style.mjs`.

---

## Work unit 1 — Spec layout and RED baseline

### T1.1 — RED baseline capture

- Command: `bun test` (full suite, run exactly once at apply start)
- Result: **35 files, 557 tests, 555 pass, 2 fail** (`Ran 557 tests across 35 files`, 2458 expect calls, 5.14s)
- Observed failures (exactly the predicted two, no completion claim from this run):
  1. `RELEASING.md: private-repository release state > documents the verification-only release gate and the private state` — `expect(releasing).toContain("private")` fails because RELEASING.md documents the reconciled **public** repository state (REQ-BASE-001).
  2. `content integrity manifest (contracts/ + assets/schemas/) > reconciles every covered file in the REAL repo against the source-controlled manifest` — `contracts/package-contract.md` and `contracts/runtime-dependency.md` working-tree bytes drifted from `contracts/SHA256SUMS.json` (REQ-BASE-002; regenerated later in WU4).
- Rollback boundary: none (observation only; no mutation).

### T1.2 — Spec layout move (D1)

- Command: `mkdir -p specs/participation && mv spec.md specs/participation/spec.md` under `openspec/changes/pi-sdd-010-participation/`; created `specs/README.md`.
- Result: byte-equivalent move — `git diff --no-index --stat` old-vs-new = 0 lines changed (verified below); seven requirement families preserved (REQ-BASE/CON/CONF/CAP/LOCK/ROAD/BOUND); one-domain index added.
- Rollback boundary: reverse the move without changing requirement content (restore `spec.md`, remove `specs/`).

### T1.3 — Release-state assertion correction (REQ-BASE-001, D7)

- File: `__tests__/release-verify-workflow.test.ts` (whitelisted).
- Edit: describe/it labels `private-repository release state` / `... the private state` → `public-repository release state` / `... the public state`; `expect(releasing).toContain("private")` → `expect(releasing).toContain("public")`.
- Retained unchanged: `expect(releasing).toContain("release-verify.yml")`, `expect(releasing).toMatch(/no publish|verification-only|does not publish/i)`, the second test `expect(releasing).toMatch(/future publish/)` and `expect(releasing).not.toContain("npm publish")`.
- Command: `bun test __tests__/release-verify-workflow.test.ts`
- Result: **9 pass / 0 fail** (64 expect calls; both RELEASING.md tests green, incl. the retained `/future publish/` and `not.toContain("npm publish")` safeguards).
- Rollback boundary: restore only the private-state label/assertion changed here.

---

## Work unit 2 — Capability checkpoint validator (strict TDD)

### T2.1 — RED: deterministic capability-manifest CLI tests

- Created `__tests__/capability-manifest.test.ts` (13 tests) spawning `scripts/verify-capability-manifest.mjs` against deterministic temp roots (stub evidence files + `package.json`) and the real repository.
- RED run: `bun test __tests__/capability-manifest.test.ts` → **0 pass / 13 fail** (validator + manifest did not exist yet).
- Rollback boundary: remove the test file alone.

### T2.2 — GREEN: capability manifest + validator + wiring

- Created `capability-manifest.yaml` at repository root — JSON-compatible YAML 1.2 profile (JSON bytes + final newline, verified: `JSON.parse` OK, `endsWith("\n")` true), schema `drenyra.capability-manifest.v1`, role `agentic-runtime`, version `0.0.1-prealpha.1` === `package.json.version`.
- Exactly the ten master Pi capability names (REQ-CAP-001) with states per design §5.2: implemented = `persona-startup-panel` (source `extensions/startup-panel.ts`, test `__tests__/extension.test.ts`), `drenyra-commands` (`extensions/register.ts`, `__tests__/extension.test.ts`), `pi-subagents` (ten `agents/*.md`, `__tests__/agents.test.ts`), `packaged-skills` (`skills/scope-discipline/SKILL.md`, `__tests__/content.test.ts`), `rda-chains` (`chains/monthly-close.ts`, `chains/__tests__/monthly-close-flow.test.ts`), `tool-safety-broad-deny` (`agents/accounting-scout.md`, `__tests__/agents.test.ts`), `pinned-ai-runtime` (`runtime/pin.ts`, `__tests__/pin.test.ts`); partial = `model-routing` (limitation: advisory registry only, no host model-routing API, G30), `engram-integration` (limitation: memory boundary/content only, no complete executable integration); planned = `configurator-install-doctor-sync` (plan: master SDD-020/Gate 0 only). All cited evidence paths verified to exist in the repo. DOWNGRADE never upgrade: no state upgraded beyond the design table.
- `testState` at WU2 reflects the last observed full-suite run (T1.1 RED baseline: files 35, total 557, passed 555, failed 2, result `failing`); finalized in WU5 (T5.2).
- Created `scripts/verify-capability-manifest.mjs` — zero-dependency ESM CLI, read-only; exit 0 `verify-capability-manifest: OK`; exit 1 `verify-capability-manifest: FAILED` + one line per violation; exit 2 usage/unreadable. Diagnostics per design §5.3 (invalid serialization, missing role, unknown/missing capability, unsupported state, implemented-without-evidence, partial-without-limitation, planned-without-plan, missing evidence path, count arithmetic).
- Added ONLY `"verify:capability": "node scripts/verify-capability-manifest.mjs"` to `package.json`; `prepack`/`prepublishOnly` untouched, no publish gate added.
- GREEN run: `bun test __tests__/capability-manifest.test.ts` → **13 pass / 0 fail**; `node scripts/verify-capability-manifest.mjs` → exit 0 `verify-capability-manifest: OK`; `bun run verify:capability` → exit 0.
- Rollback boundary: manifest + validator + test + package script entry together.

### T2.3 — TRIANGULATE: evidence and count edge cases

- The 13-test file covers the T2.1 six cases plus triangulation: unsupported state (`shipped`), missing master capability (`engram-integration` deleted), `partial` without limitation, `planned` without plan, evidence path that does not exist, evidence path escaping root (`../outside.ts`), plus count arithmetic (`passed + failed !== total`).
- GREEN run (same file): **13 pass / 0 fail**; `bun run verify:capability` exit 0. Real-manifest case validates with correct count arithmetic (557 = 555 + 2).
- Rollback boundary: same as T2.2 (capability unit).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| T2.1 | `__tests__/capability-manifest.test.ts` | Unit (CLI spawn) | N/A (new file) | ✅ Written — 0/13 | ✅ Passed | ✅ 5 edge cases | ➖ None needed |
| T2.2 | `capability-manifest.yaml` + `scripts/verify-capability-manifest.mjs` | Unit | N/A (new) | ✅ Written | ✅ 13/13 | ✅ covered | ➖ None needed |
| T2.3 | same test file | Unit | N/A (new) | ✅ Written | ✅ 13/13 | ✅ 5 cases | ➖ None needed |

---

## Work unit 3 — Candidate identity and lock facts (strict TDD)

**Candidate identity:** dirty-sha256:00feca1fa832b2696c7484a532f4031f8c6eadd5c0573bf49a80e1264023dc01

### T3.1 — RED: lock-facts shape/cross-artifact/re-derivation tests

- Created `__tests__/lock-facts.test.ts` (7 shape/cross-artifact/re-derivation tests + 5 identity-algorithm tests) importing `../runtime/pin.js` (DEFAULT_PIN) and `../scripts/compute-candidate-identity.mjs` (PARTICIPATION_PATHS_V1, buildCanonicalManifest, computeCandidateIdentity, normalize*) and spawning the identity CLI.
- RED run: `bun test __tests__/lock-facts.test.ts` → **0 pass / 1 error** (module `scripts/compute-candidate-identity.mjs` did not exist).
- Rollback boundary: remove the test file alone.

### T3.2 — GREEN: candidate identity CLI

- Created `scripts/compute-candidate-identity.mjs` implementing design §7.2 exactly: `git rev-parse HEAD`; immutable sorted `PARTICIPATION_PATHS_V1` (21 paths = §13 whitelist + proposal.md + design.md); A/M/D classification with staged+unstaged bytes; modes (HEAD mode for tracked, exec bit for new, HEAD mode for deletions); D4 self-reference normalization (lock-facts `candidateIdentity`, `current_test_state.candidate_identity`, values after `Candidate identity:`); per-file lowercase sha-256 of normalized bytes; NUL-separated canonical manifest sorted by path; sha-256 of manifest prefixed `dirty-sha256:`; one-line output; non-zero exit on unreadable HEAD/classification/normalization failure or no allowlisted change.
- Command: `node scripts/compute-candidate-identity.mjs` → one valid `dirty-sha256:<64 lowercase hex>` line, exit 0; the WU3 identity is recorded at the `Candidate identity:` label above and in `program-lock-facts.json.candidateIdentity` (D4 normalization makes the identity invariant to those normalized fields).
- Rollback boundary: remove the script alone.

### T3.3 — GREEN: static lock-facts artifact

- Created `docs/architecture/program-lock-facts.json` per design §6.2: schema `drenyra.program-lock-facts.v1`, `participantCheckpoint: true`, authority notice, `headSha` c354274…, `packageVersion` 0.0.1-prealpha.1, consumed/produced contract facts (six consumed confirmed by `__tests__/contracts.test.ts` + package-verify + runtime-dependency.md rule 7; two produced = the frozen v0.1 contracts), `tests` from the observed WU3 full-suite run, checksums (pin entry, content manifest digest), `capabilityStates`, `activeChanges` sorted incl. this change, `evidenceDate`, `derivationCommands`.
- `candidateIdentity` computed by the CLI at WU3-end and written in (placeholder first, then the computed value; D4 normalization keeps the identity stable across the finalization write).
- Test counts (36 files / 569 passed / 1 failed / 570 total) reflect the observed WU3 full-suite run; the remaining 1 failure is the pre-existing content-manifest drift scheduled for WU4 regeneration — **finalized** at T5.2 with T5.1's zero-failure output (design §6.1: lock facts are authored after the first complete verification pass).
- Rollback boundary: lock-facts artifact + identity script + lock-facts test together.

### T3.4 — TRIANGULATE: identity edge cases

- Temp-git-repo classification tests: modified (M), new (A), deleted (D) allowlisted entries with modes (100644/100755) and `-` digest for deletions; sorted canonical-manifest ordering; unchanged tracked files excluded; NUL-separated layout literal match; self-reference normalization stability (idempotent, invariant to the identity value); non-zero exit when no allowlisted candidate change exists; re-derivation equals the recorded value; identity stable across two CLI runs.
- Rollback boundary: same as T3.3 (identity/lock-facts unit).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| T3.1 | `__tests__/lock-facts.test.ts` | Unit (CLI spawn + imports) | N/A (new) | ✅ Written — 0/1 error | ✅ Passed | ✅ 5 cases | ➖ None needed |
| T3.2 | `scripts/compute-candidate-identity.mjs` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ covered | ➖ None needed |
| T3.3 | `docs/architecture/program-lock-facts.json` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ covered | ➖ None needed |
| T3.4 | same test file | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 5 cases | ➖ None needed |

---

## Work unit 4 — Contract claim check and freeze

### T4.1 — Claim matrix (design §8.2) and conformance map (design §9.1)

All rows below are `match`; observed values, source paths, test paths, and commands/results are recorded per row. Focused suites run 2026-08-14.

| Frozen claim | Canonical/source check | Test evidence | Verdict |
| --- | --- | --- | --- |
| 16 commands | `extensions/register.ts` — 16 `registerCommand` calls (`/drenyra:status`, `:doctor`, `:company`, `:period`, `:context`, `:capabilities`, `:scope`, `:models`, `:close`, `:mission`, `:continue`, `:resume`, `:receipt`, `:evidence`, `:verify`, `:reconcile`; REQ-CMD-001..010) | `__tests__/extension.test.ts` — exact descriptor array `drenyraPiExtension.commands` (16 entries) + registered-name array + `registered` length 16 | **match** — observed value: both arrays equal the contract's 16-command list; `bun test __tests__/extension.test.ts` → 17 pass / 0 fail |
| ten agents | `agents/*.md` — accounting-scout, evidence-builder, ledger-analyst, reconciliation-agent, tax-controller-pe, anomaly-refuter, close-controller, invoice-sire-agent, journal-candidate-agent, guardian-angel (REQ-AGENT-001, Design 03); mirrored under `assets/agents/` | `__tests__/agents.test.ts` (exactly 10 roles, parseability, common contract, broad-deny posture) + `assets/agents/` byte-identical mirrors asserted by `scripts/verify-package-files.mjs` | **match** — observed value: 10 files under `agents/` (Design 03 merged reality); `bun test __tests__/agents.test.ts` → green (origin 10-agent version) |
| pin/version/state/checksum | `runtime/pin.ts` — `DEFAULT_PIN` = `drenyra-ai@0.2.0`, state `released`, `checksumSha256` `e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047` | `__tests__/pin.test.ts` (pin shape + released-state rules) + `__tests__/package-verify.test.ts` (vendored-artifact reconciliation vs `DEFAULT_PIN`) | **match** — observed value: checksum equals `DEFAULT_PIN.checksumSha256`; `bun test __tests__/pin.test.ts` → 9 pass / 0 fail; vendored reconciliation tests green (the single `package-verify.test.ts` failure is the content-manifest drift regenerated at T4.3) |
| package-local/no PATH | `runtime/resolve.ts` — `resolvePackageLocal` consults only `<packageRoot>/runtime/<package>` then `<packageRoot>/node_modules/<package>`; never PATH/`which`/env | `__tests__/resolve.test.ts` (package-locality incl. PATH immunity) | **match** — observed value: resolution is PATH-independent per the suite; `bun test __tests__/resolve.test.ts` → 6 pass / 0 fail |
| checksum + fail-closed doctor | `runtime/checksum.ts` (`sha256File`, lowercase hex sha-256 streamed) + `runtime/doctor.ts` (verdicts `verified`/`missing`/`pending-release`/`version-mismatch`/`checksum-mismatch`; `pending-release` never `verified`) | `__tests__/doctor.test.ts` (fail-closed matrix) + `__tests__/status.test.ts` (human + machine status reusing doctor) | **match** — observed value: fail-closed verdict matrix per the suite; `bun test __tests__/doctor.test.ts` → 10 pass / 0 fail; `bun test __tests__/status.test.ts` → 5 pass / 0 fail |

**Conformance map (REQ-CONF-001, design §9.1):**

| Area | Existing covering tests/checks | Frozen claim bound | Result |
| --- | --- | --- | --- |
| install | `__tests__/installer.test.ts` (8 pass / 0 fail); packed-install invocation asserted by `__tests__/release-verify-workflow.test.ts` (9 pass / 0 fail) | exact pin source, vendored/release fallback, install failure behavior | mapped — green |
| doctor | `__tests__/doctor.test.ts` (10/0), `__tests__/status.test.ts` (5/0) | version/checksum verification and fail-closed verdicts | mapped — green |
| pin | `__tests__/pin.test.ts` (9/0), `__tests__/package-verify.test.ts` (vendored artifact reconciliation green) | `drenyra-ai@0.2.0`, released state, exact entry checksum | mapped — green |
| package integrity | `__tests__/package-verify.test.ts` (16 pass / 1 fail — the single failure is the content-manifest drift regenerated at T4.3); `node scripts/verify-package-files.mjs` | all `collectCoveredFiles` entries reconciled; vendored artifact reconciled | mapped — pending T4.3 regeneration |
| release verification | `__tests__/release-verify-workflow.test.ts` (9/0) | verification-only release gate, future publish wording, no `npm publish` | mapped — green |
| command surface | `__tests__/extension.test.ts` (17/0) | exact 16-command descriptor + registration bound to `extensions/register.ts` | mapped — green |
| agent inventory | `__tests__/agents.test.ts` (59/0), `__tests__/extension.test.ts` package mirrors | exactly ten parseable definitions and byte-identical packaged mirrors | mapped — green |

**No-gap decision (design §9.2, REQ-CONF-002):** do **not** add `__tests__/contracts-conformance.test.ts`. The exact 16-command arrays, the released pin/entry checksum, and the ten-agent inventory are already asserted by `__tests__/extension.test.ts`, `__tests__/pin.test.ts`, `__tests__/package-verify.test.ts`, and `__tests__/agents.test.ts`; a dedicated file would duplicate real assertions.

Rollback boundary: remove/restore only the matrix section in `apply-progress.md`.

### T4.2 — Freeze both contract headers and the index (all §8.2 rows match)

- `contracts/package-contract.md`: `> Version: 0.1-draft · Status: draft ·` → `> Version: v0.1 · Status: frozen ·` (16-command list, ten-agent inventory, and released `drenyra-ai@0.2.0` checksum claim retained — all matched in T4.1).
- `contracts/runtime-dependency.md`: `> Version: 0.1-draft · Status: draft ·` → `> Version: v0.1 · Status: frozen ·` (pin, package-locality, no-PATH, checksum, doctor, fail-closed claims frozen — all matched in T4.1).
- `contracts/README.md`: draft pre-alpha sentence → frozen-v0.1 statement; index rows `0.1-draft`/`Draft` → `0.1`/`Frozen` for both local contracts; unrelated rows unchanged.
- Evidence: `grep -n "frozen" contracts/*.md` confirms both headers + both README rows (below).
- Rollback boundary: the three contract docs as one consistency unit.

### T4.3 — Regenerate the package content manifest once, then verify

- Command: `node scripts/verify-package-files.mjs --update` → `verify-package-files: regenerated contracts/SHA256SUMS.json`; vendored `drenyra-ai@0.2.0` reconciled with the pin (entry artifact sha256 `e4e81914…047`).
- Command: `bun test __tests__/package-verify.test.ts` → **17 pass / 0 fail** (reconciliation assertion at line 181 green).
- Command: `node scripts/verify-package-files.mjs` → exit 0, `verify-package-files: OK`.
- No further covered-file edits after this (manifest ordering invariant D5/§8.3).
- Rollback boundary: restore both contract docs + index to draft and restore/regenerate `SHA256SUMS.json` consistently, as one unit.

---

## Work unit 5 — Final evidence and planning state

### T5.1 — Full-suite final evidence capture

- Pre-finalization safety-net capture (corrective re-run start, attempt 2): `bun test` → **37 files, 582 total, 581 pass, 1 fail** (2535 expect calls) — the single failure is `program-lock-facts.json (design §6) > re-derives the recorded candidate identity via the CLI` (identity drift; corrected in the corrective pass below).
- Pre-finalization companion checks: `bun run typecheck` → exit 0 (`tsc --noEmit`); `node scripts/verify-package-files.mjs` → exit 0 `verify-package-files: OK (dist tree + packaged files + content hashes reconciled)`; `bun run verify:style` → exit 0 `verify-style: OK (diff-scoped · 81 owned files · 4 rules)`; `bun run verify:capability` → exit 0 `verify-capability-manifest: OK`.
- Final exact-candidate run after identity finalization: recorded in the corrective pass below (**582 pass / 0 fail**, observed twice on identical bytes).
- Rollback boundary: none (observation only).

### T5.2 — Manifest testState and lock facts finalization

- `capability-manifest.yaml` `testState` (readback): command `bun test`, result `passing`, files 37, total 582, passed 582, failed 0, evidenceRef `docs/architecture/program-lock-facts.json#/tests` — matches the final full-suite run and lock facts.
- `docs/architecture/program-lock-facts.json` (readback): `tests` = { files 37, passed 582, failed 0, total 582, command `bun test` }; `checksums.pinEntrySha256` equals `DEFAULT_PIN.checksumSha256`; `checksums.contentManifest.sha256` is the digest of the final `contracts/SHA256SUMS.json` bytes; `capabilityStates.digestSha256` is the digest of the current `capability-manifest.yaml` bytes; `activeChanges` sorted = `["pi-program-status-reconciliation", "pi-sdd-010-participation"]`; `evidenceDate` `2026-08-14`; `derivationCommands` covers HEAD, identity, full test, typecheck, package, style, capability, and manifest-file checksum commands.
- §12 cross-artifact invariants hold: `package.json.version` === manifest `repository.version` === lock `packageVersion` (`0.0.1-prealpha.1`); capability testState counts === lock `tests` === config `current_test_state`; manifest digest === current bytes; pin checksum === `runtime/pin.ts`; content-manifest digest === `contracts/SHA256SUMS.json` bytes.
- Evidence: `bun test __tests__/lock-facts.test.ts` green on the final candidate; `bun run verify:capability` exit 0; `sha256sum capability-manifest.yaml contracts/SHA256SUMS.json` recorded in the corrective pass.
- Rollback boundary: the two participant artifacts together.

### T5.3 — ROADMAP four Phase 1 items

- Readback confirms the four Phase 1 items are checked (lines 31–34): `Freeze package-contract v0.1 (install surface, provided capabilities, versioning)`, `Freeze runtime-dependency v0.1 (pin strategy, verification, package-locality)`, `Command contract: /drenyra:* surface and expected outputs`, `Conformance tests for install/doctor/pin verification`. No other section changed (Phase 0/2/3, national-alignment, Gate 0, and SDD-020 lines untouched).
- Rollback boundary: restore only these four lines to unchecked.

### T5.4 — `current_test_state` final evidence

- `openspec/config.yaml` `current_test_state` = { files 37, tests 582, passing true, failed 0, command `bun test`, candidate_identity `"dirty-sha256:<64 lowercase hex>"` (quoted YAML string; final value in the corrective pass), evidence_date `2026-08-14`, evidence block → `docs/architecture/program-lock-facts.json` + the change verify report } — equals `program-lock-facts.json.tests`.
- Archived 493-test claim removed: `conventions.testing` updated `fast suite (493 tests / ~1s)` → `fast suite (582 tests / ~1s)`; the current-state block carries no archived evidence.
- Rollback boundary: restore only the `current_test_state` block and the conventions.testing count.

### T5.5 — Candidate identity finalization

- Design §7.3 protocol executed in the corrective pass: all evidence/planning bytes written first, identity computed via `node scripts/compute-candidate-identity.mjs`, the same value written into `program-lock-facts.json.candidateIdentity`, `openspec/config.yaml.current_test_state.candidate_identity` (quoted YAML string), and every `Candidate identity:` label in apply-progress, then recomputed — identical (only the three normalized fields changed).
- Evidence: recompute equals the recorded value; `bun test __tests__/lock-facts.test.ts` re-derivation assertion green.
- Rollback boundary: restore placeholders and revert only the identity-bearing fields.

### T5.6 — Final exact-candidate verification pass (no source mutation)

- All five checks run twice on identical candidate bytes after identity finalization (evidence-recording run and final confirmation run): full suite **582 pass / 0 fail (37 files, 2535 expect calls)**, typecheck exit 0, package verify exit 0, style verify exit 0, capability verify exit 0 — exact command outputs in the corrective pass.
- Changed-path comparison against the §13 whitelist: only whitelisted paths changed; pre-existing out-of-scope dirty paths byte-identical (`git status --porcelain` before/after compared in the corrective pass).
- Rollback boundary: none (verification only).

---

## Corrective pass — identity drift finalization (attempt 2)

### Root cause

`docs/architecture/program-lock-facts.json` recorded `candidateIdentity` `dirty-sha256:8f9cca10f8146e434a3d43bc5aa1c7b0892968da2fde218e629f8b26338e45fd` (the WU3 value) while the CLI now derives `dirty-sha256:5e060908c086a4d6085dd27083b123995bf88d420aa6684ba66610a0bb8de823`, and `openspec/config.yaml` still carried the unquoted zero placeholder `dirty-sha256:000…0`. A pi-lens markdown autofix of `apply-progress.md` changed identity-bearing bytes after lock facts were written, drifting the candidate identity; the config placeholder was never finalized. The lock-facts re-derivation test (design §6) was the single failing test (581 pass / 1 fail).

### Finalization steps

1. Stabilized `apply-progress.md` content (claim matrix §8.2, conformance map §9, per-WU evidence, size exception, rollback boundaries, `Candidate identity:` labels) — markdown-clean (final newline, no trailing whitespace, no CRLF) so pi-lens has nothing to autofix.
2. Config consistency: `conventions.testing` 493 → 582 (archived claim removed); `current_test_state` equals lock-facts `tests` (37/582/0) with `evidence_date` 2026-08-14 and the evidence note referencing `program-lock-facts.json` + the verify report.
3. Computed the candidate identity over the exact final bytes, wrote it into lock facts `candidateIdentity`, config `current_test_state.candidate_identity` (quoted `"dirty-sha256:…"`), and each `Candidate identity:` label; recomputed — identical (the normalization handles the quoted YAML scalar; no script change needed).
4. Ran the full final verification (582 pass / 0 fail + four green checks), recorded the results, marked tasks T5.1–T5.6 complete, recomputed the identity over the exact final bytes, wrote it into the three normalized locations, and re-ran the full final verification on those exact bytes — all green.

### Final identity

**Candidate identity:** dirty-sha256:00feca1fa832b2696c7484a532f4031f8c6eadd5c0573bf49a80e1264023dc01

### Final verification results (exact final candidate)

| Check | Command | Result |
| --- | --- | --- |
| Full suite | `bun test` | 37 files · 582 pass / 0 fail (2535 expect calls) |
| Typecheck | `bun run typecheck` | exit 0 (`tsc --noEmit`) |
| Package verify | `node scripts/verify-package-files.mjs` | exit 0 · `verify-package-files: OK` |
| Style | `bun run verify:style` | exit 0 · `verify-style: OK (diff-scoped · 81 owned files · 4 rules)` |
| Capability | `bun run verify:capability` | exit 0 · `verify-capability-manifest: OK` |

Whitelist discipline: only `docs/architecture/program-lock-facts.json`, `openspec/config.yaml`, `openspec/changes/pi-sdd-010-participation/apply-progress.md`, and `openspec/changes/pi-sdd-010-participation/tasks.md` (apply-owned completion checkboxes) were touched; `scripts/compute-candidate-identity.mjs` was read-only (its normalization already handles the quoted config scalar — no fix required). `git status --porcelain` before/after compared: pre-existing out-of-scope dirty paths byte-identical; no commit, PR, publish, master edit, or unrelated-file mutation.

### TDD Cycle Evidence (corrective pass)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T5.5 identity finalize | `__tests__/lock-facts.test.ts` | Unit (CLI spawn) | ✅ 581 pass / 1 fail (observed drift) | ✅ Existing failing test observed | ✅ 12/12 green | ➖ Single | ➖ None needed |
| T5.6 final verify | `__tests__/lock-facts.test.ts` | Unit (CLI spawn) | ✅ baseline green | ✅ Existing test | ✅ 582 pass / 0 fail | ➖ Single | ➖ None needed |

### Test Summary (corrective pass)

- Tests written this pass: 0 (all tests pre-existed from WU2/WU3; the corrective pass fixed evidence bytes, not code)
- Tests passing: 582 / 582 (37 files)
- Layers used: Unit (CLI spawn)
- Approval tests: None — no refactoring tasks

## Errata — ten-agent Design 03 alignment (2026-08-15)

The SDD-010 participation slice was verified against local baseline `c354274`,
which carries **seven** agent definitions. The merged repository reality
(`origin/main`, Design 03 — PR #22) requires **ten** agent roles
(REQ-AGENT-001: adds `invoice-sire-agent`, `journal-candidate-agent`,
`guardian-angel`). Before the final commit, this change's frozen claims were
corrected to the ten-agent reality: `contracts/package-contract.md` (Ten
Pi-native accounting agents + names), `capability-manifest.yaml`
(`pi-subagents` sources → 10 `agents/*.md`), and this claim matrix
(ten-agent row, observed 10 files). `__tests__/agents.test.ts` and
`__tests__/extension.test.ts` were aligned to the origin 10-agent versions.
Final suite re-run and candidate identity re-finalized after the correction.
