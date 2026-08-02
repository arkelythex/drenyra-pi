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

### Notes

- **Contracts only — no implementation yet.** No install, commands, panels, agents, skills, or chains exist in this release.
- Pre-alpha: nothing is production-ready; contracts are not frozen.
- Version policy: `0.0.1-prealpha.x` until the first frozen contract, then `0.1.0`.
