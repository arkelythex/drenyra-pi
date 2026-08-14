# Changelog

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

All notable changes to Drenyra Pi will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the version policy in [RELEASING.md](RELEASING.md).

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
