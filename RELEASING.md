# Releasing — Drenyra Pi

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Version policy

- Until the first contract is frozen, releases use **`0.0.1-prealpha.x`** (x increments per release).
- The first release that freezes a contract (`package-contract`, `runtime-dependency` — per the ROADMAP's Phase 1) is **`0.1.0`**.
- After `0.1.0`, **Semantic Versioning** applies: MAJOR = breaking contract change or a breaking runtime-pin move, MINOR = backward-compatible addition, PATCH = backward-compatible fix.
- **A runtime pin change is a release event**: new pin, migration note, and package version bump — never a silent patch.

## Release checklist

Every release must pass, in order:

1. **Typecheck** — the repo's configured typecheck is clean.
2. **Tests** — full test suite passes (commands, chains, permissions).
3. **Conformance vectors** — install/doctor/pin verification vectors pass against the exact release candidate.
4. **Package build + pack verification** — build and verify the packed artifact contains exactly the intended files.
5. **Packed-install test** — install the packed tarball in a clean Pi, run `drenyra-pi` install + doctor, and verify the pinned Drenyra AI runtime installs, verifies, and answers a smoke command.

## Commit and release discipline

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with scope when useful.
- **No AI attribution** in commit messages or release notes — no "Generated with" or "Co-Authored-By" AI markers.
- Contract and pin changes are high-materiality: proportional risk review before publish.
- The pinned `drenyra-ai` version must be a released artifact — never a checkout.
