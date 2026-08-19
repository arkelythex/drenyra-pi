# Changelog

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

All notable changes to Drenyra Pi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the version policy in [RELEASING.md](RELEASING.md).

## Unreleased — runtime pin → 0.4.1 (release event, pre-alpha)

### Added

- **Fiscal harness extraction complete** — the harness that lived in
  `drenyra-command-center/packages/pi` now ships from this repository, the
  single source of truth for the Pi accounting harness:
  - Packaged skills: `lens-audit-trail`, `lens-ledger-integrity`,
    `lens-sunat-compliance`, `lens-tenant-isolation`, `ruc-scope`,
    `fiscal-compliance`, `fiscal-review`, `drenyra-sdd`, `drenyra-chained-pr`.
  - FSD lifecycle prompts (`fsd-init` … `fsd-archive`) plus `preflight.md` and
    the new `/drenyra:preflight` command (fail-closed scope + pinned-runtime
    check).
  - RED contract schemas under `contracts/` (receipt, evidence, mission,
    authority) with regenerated `SHA256SUMS.json`.
  - `extensions/fiscal-guard.ts`: the five fiscal tools
    (`verify_fiscal_phase`, `list_fiscal_phases`, `record_receipt`,
    `run_fiscal_lens`, `forecast_fiscal_review`), the `/drenyra:persona`
    command, and the money/SQL/RUC write guards — registered from the single
    `register.js` entrypoint. The money guard evaluates only introduced text
    (newText), never replaced oldText (false-positive fix).
  - `themes/Drenyra.json`; `typebox` added as a devDependency for tool
    schemas.
  - Verification: `verify:package` entry list extended for `fiscal-guard.js`;
    capability-manifest and program-lock-facts refreshed (703 tests, 44 files).

### Changed

- **Runtime pin bumped to `drenyra-ai@0.4.1`** (release event per
  `contracts/runtime-dependency.md` "Upgrade is explicit"; version stays
  pre-alpha per the current verification-only release posture):
  - Vendored tarball `vendored/drenyra-ai-0.4.1.tgz`; entry-artifact checksum
    `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600`
    (`dist/cmd/cli.js`), reconciled by `verify:package`.
  - v0.4.1 is a MINOR backward-compatible addition (released 2026-08-15):
    configurator host integration (PinnedComposition, PINNED_AI_COMPOSITION,
    drenyra-pi as the fourth managed host) and the routing preflight router
    (`routing/router.ts`, deterministic `route()` over the eight §5 axes). The
    fiscal-authority kernel surface Pi consumes is unchanged — no breaking
    API change.
  - `runtime/pin.ts`, `contracts/runtime-dependency.md`,
    `contracts/package-contract.md`, `docs/architecture/program-lock-facts.json`
    updated to the new pin; doctor + conformance + full suite re-run.

### Added

- **SDD-040 adapter boundary slice** (Pi is a replaceable RDA host):
  - `docs/architecture/rda-adapter-boundary-audit.md` — 10/10 boundary rules
    PASS with executable evidence (no Pi-local violation).
  - `__tests__/adapter-boundary-replacement.test.ts` + fixtures — harness
    replacement test: same mission through Pi and an independent substitute
    host yields equivalent canonical authority projections (candidates, gates,
    receipts); five negative controls fail on any authority difference.
  - `docs/architecture/rda-adapter-boundary.md` — adapter contract
    (operator → prepare → call → present → human decision → verify receipt →
    project result), per-step ownership, fail-closed behaviors.
  - Master closure reference: `drenyra-ai` sdd-040-rda-v2 @ `c4d2b6a` (#42).

### Migration note

The pin change is a release event: re-run `/drenyra:doctor` and the
conformance suite after updating; consumers must install the vendored
`drenyra-ai-0.4.1.tgz` (exact pin + checksum). No breaking API change from the
0.2.0 kernel surface; the new configurator/routing modules are additions for
upcoming SDD-020/030 slices.

## 0.0.1-prealpha.1 — 2026-08-01

### Added

- Repository identity scaffolding: README, LICENSE, SECURITY, CONTRIBUTING, CODEOWNERS, architecture and roadmap docs.
- Draft contract index (`contracts/`):
  - `package-contract` — install surface and provided capabilities.
  - `runtime-dependency` — pinned, verified, package-local Drenyra AI runtime strategy.
- **PR 1 — Pinned runtime verification core:**
  - `runtime/` — pin, package-local resolution (never PATH), checksum, fail-closed doctor, status.
  - Pi extension registration (`extensions/register.ts`) against the gentle-pi model.
  - CLI-exposed doctor/status machinery; fail-closed matrix tests (30 tests).
- **Release hardening:**
  - Build to `dist/` (tsc, NodeNext, declarations), `engines >= 22`, complete `files` manifest, `pi` manifest pointing at `dist/extensions`, optional Pi peer dependency, subpath `exports`.
  - Private Drenyra AI installer (`runtime/installer.ts` + postinstall wrapper).
  - **End-to-end install vertical:** the postinstall now installs the pinned
    `drenyra-ai@0.2.0` from its **GitHub Release tarball URL** (`installUrlFor`,
    `npm install <tarball>` — the registry is not used until drenyra-ai publishes)
    and verifies with doctor; the packed-install test proves the full chain
    (pack → install → postinstall → runtime verified). Extension registration
    tested against a structural Pi API (39 tests total).
  - **Company + period context vertical:** `runtime/context.ts` (RUC via SUNAT
    Módulo 11 checksum — ported from Drenyra; verified against known-valid RUCs —
    plus YYYYMM period validation) with an atomic JSON scope store; extension
    commands `/drenyra:company`, `/drenyra:period`, `/drenyra:context` wired and
    tested (51 tests total).
  - **Monthly-close RDA chain:** `chains/monthly-close.ts` runs a
    monthly-close mission through the pinned Drenyra AI runtime (in-memory
    stores, protocol-legal transitions), enforces the **R2 approval gate**
    (explicit single approver — never automatic), and produces a **signed
    receipt** as the immutable close proof. `/drenyra:close <approverId>`
    command wired; fail-closed without scope or approver (54 tests total).
  - **Pin released:** `DEFAULT_PIN` points at `drenyra-ai@0.2.0` (git tag `v0.2.0`, entry-artifact checksum `e4e81914…`; all six contracts frozen — mission-protocol, candidate, receipt, gate, ledger, recovery). `doctor` fail-closed verification is live against the released artifact.
  - `verify:package` + `verify-packed-install` (pack → install → extension factory loads under Node) + prepack/prepublishOnly gates + CI package job.
  - Placeholder asset dirs (assets/, prompts/, skills/, agents/, chains/, themes/) per the README layout.

    ### Notes

    - The DEFAULT_PIN is **`released`**: `drenyra-ai@0.2.0` (git tag `v0.2.0`) is pinned with the
      entry-artifact checksum `e4e81914…`, the vendored tarball ships in `vendored/`, and the
      postinstall installs it package-local and verifies it with doctor (the GitHub Release URL
      remains the fallback install source). The `pending-release` path is exercised only in tests.
    - Pre-alpha: nothing is production-ready; contracts are not frozen.
    - Version policy: `0.0.1-prealpha.x` until the first frozen contract, then `0.1.0`.
