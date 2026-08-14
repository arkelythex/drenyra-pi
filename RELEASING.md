# Releasing — Drenyra Pi

> **Last updated:** 2026-08-14.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Current state: private repository, verification-only release gate

Drenyra Pi is currently a **private repository** (`arkelythex/drenyra-pi`). Until a human decision flips the repository to a publishing state (see below), the release process is **verification only**:

- **No publication happens anywhere in automation**: no npm registry publication, no dist-tag mutations, no GitHub releases, no tag pushes.
- The release gate is `.github/workflows/release-verify.yml`, a manually dispatched workflow whose single input is the exact annotated `v<semver>` tag. It must be dispatched from the protected default `main` branch.
- The gate **fails closed** unless every one of the following holds:
  - the tag is strict, exact `vSemVer` syntax;
  - the remote tag and remote `main` each resolve **exactly once**;
  - the tag is **annotated** (a tag object, not a lightweight pointer);
  - the peeled tag commit, the remote `main` commit, the dispatch commit, the checkout commit, and the `package.json` version all agree (`v{package.json version}` === tag);
  - remote authority is re-queried **after** all verification steps and still matches — an advanced `main` or a moved/removed tag fails closed.
- On the verified (detached) tag target it re-runs the full checklist below: frozen install, typecheck, tests, package build + pack verification, and the packed-install proof.
- It derives and prints the **future dist-tag** (`latest` for a stable version, `beta` for `-beta`/`-beta.x`, `next` for any other pre-release) purely as information; **no dist-tag is ever set** and no publishing command is invoked.
- The workflow requests only read-only `contents` permission, pins actions to immutable commit SHAs, uses `persist-credentials: false`, installs with a frozen lockfile, and needs **no registry credentials** (remote reads use the ephemeral `GITHUB_TOKEN`, never persisted into the git configuration).

## Conditions for a future publish step

Publication stays off until a human explicitly decides to publish. A future publish step may be added only when:

1. The repository is made public **or** an explicit, recorded decision to publish this private package is made.
2. The publish step follows the trusted GitHub Actions pattern: dispatched from protected `main` only, OIDC + npm provenance with the npm registry secret held in a protected environment, the same fail-closed authority checks above re-run immediately before the publish command, and the verification steps kept in front of it.
3. This document and the checklist below are updated, release notes and the CHANGELOG record the release, and the derived dist-tag is set by that publish step — never by this verification gate.

Until then, **do not** add `publishConfig` to `package.json` and **do not** otherwise change npm publication behavior: the verification gate must remain a pure verification gate.

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
6. **Release gate** — the `release-verify` workflow (verification only) passes against the exact annotated tag on protected `main`, with remote authority rechecked after verification (see "Current state" above).

## Commit and release discipline

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with scope when useful.
- **No AI attribution** in commit messages or release notes — no "Generated with" or "Co-Authored-By" AI markers.
- Contract and pin changes are high-materiality: proportional risk review before publish.
- The pinned `drenyra-ai` version must be a released artifact — never a checkout.
