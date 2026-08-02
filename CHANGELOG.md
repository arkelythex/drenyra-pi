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
  - **Pin released:** `DEFAULT_PIN` points at `drenyra-ai@0.1.0` (git tag `v0.1.0`, entry-artifact checksum `e4e81914…`; first frozen-contract release — mission-protocol, candidate, receipt, gate). `doctor` fail-closed verification is live against the released artifact.
  - `verify:package` + `verify-packed-install` (pack → install → extension factory loads under Node) + prepack/prepublishOnly gates + CI package job.
  - Placeholder asset dirs (assets/, prompts/, skills/, agents/, chains/, themes/) per the README layout.

### Notes

- The DEFAULT_PIN is in `pending-release` state until drenyra-ai publishes its first real artifact; the released-install path is fixture-tested.
- Pre-alpha: nothing is production-ready; contracts are not frozen.
- Version policy: `0.0.1-prealpha.x` until the first frozen contract, then `0.1.0`.
