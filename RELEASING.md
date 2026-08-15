# Releasing — Drenyra Pi

> **Last updated:** 2026-08-15.
>
> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Current state: public repository, verification-only release gate

Drenyra Pi is currently a **public repository** (`arkelythex/drenyra-pi`, source-available under a proprietary license — see [LICENSE](LICENSE)). Publication of the npm **package** stays off until an explicit, recorded decision flips the package to a publishing state (see below); the release process is **verification only**:

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

1. An explicit, recorded decision to publish the npm package is made (the repository itself is now public; the package is still unpublished).
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

## Runtime pin bump procedure (reference)

The following procedure was executed for 0.3.0 → 0.4.0 → 0.4.1 (2026-08-15);
follow it in order for every runtime pin change.

1. **Download and verify the artifact.** `gh release download v<version>` for
   `drenyra-ai-<version>.tgz` and `checksums.txt`; extract the tgz; run
   `sha256sum -c checksums.txt` from inside the extracted `package/dist`
   directory (the manifest paths are relative to it). Require **zero** failures.
2. **Vendor.** `cp` the tgz into `vendored/`, remove the previous vendored tgz,
   and record the tgz's own sha256 (`sha256sum vendored/drenyra-ai-<v>.tgz`) for
   the `vendored/drenyra-ai-<v>.tgz` entry in `contracts/SHA256SUMS.json`.
3. **Update the pin identity.** `runtime/pin.ts`: `RUNTIME_VERSION`, the
   `DEFAULT_PIN` doc comment, and `checksumSha256`. The checksum is the sha256 of
   the release's **entry artifact** `dist/cmd/cli.js` (from `checksums.txt`) —
   it may be **identical across versions** (cli.js was byte-identical across
   0.3.0 → 0.4.0 → 0.4.1); confirm, never assume.
4. **Update the manifest and references.** `package.json` devDependency
   (`file:./vendored/drenyra-ai-<v>.tgz`), `bun.lock` (via install), then sed the
   exact version across the pin-asserting tests (`pin`, `installer`, `doctor`,
   `status`, `extension`, `package-verify`, `contracts`, `evidence-status`,
   `accounting-status`, adapter-boundary audit/replacement) and the docs
   (`contracts/runtime-dependency.md`, `openspec/config.yaml`). Fixture tool
   versions that merely coincidentally match the runtime version are left alone.
5. **Rebuild dist BEFORE `bun install`.** The postinstall hook runs
   `dist/scripts/install-drenyra-ai.js`, which is a stale build artifact: if it
   still embeds the old pin, it will re-install the OLD runtime over the freshly
   linked one. Always `node scripts/build.mjs` first, then `bun install`.
6. **Reconcile content hashes.** If any covered contract bytes changed (e.g.
   `contracts/runtime-dependency.md`), run `node scripts/verify-package-files.mjs
   --update` — never hand-edit the manifest.
7. **Regenerate the program lock-facts.**
   `docs/architecture/program-lock-facts.json`: `headSha` = the delivery base
   commit, `candidateIdentity` = `node scripts/compute-candidate-identity.mjs`
   (last line), `checksums.contentManifest.sha256` = sha256 of the current
   `contracts/SHA256SUMS.json` bytes, `capabilityStates.digestSha256` = sha256 of
   the current `capability-manifest.yaml` bytes.
8. **Gates.** `bun run typecheck`, `bun run test`, `bun run verify:style`,
   `bun run verify:capability`, `bun run verify:package` — all green.
9. **Delivery.** Conventional commit + PR chain. The lock-facts `headSha` must
   be an **ancestor** of any CI branch: stack dependent PRs (or point `headSha`
   at the PR base) so the `lock-facts.test.ts` ancestor check passes.

Gotchas that cost time in the 0.4.0/0.4.1 bumps:

- The stale-`dist` postinstall clobber (step 5) silently replaces the correct
  runtime — always rebuild first.
- The entry-artifact hash not changing (step 3) is expected when the CLI
  entrypoint is untouched; do not "fix" it.
- With the gentle-ai harness, `git commit`/`git push`/`gh pr create` must be
  single direct commands: any compound (prefix `cd ... &&`, trailing `| pipe`,
  `;`) fails closed as an ambiguous wrapped lifecycle command.

## Commit and release discipline

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with scope when useful.
- **No AI attribution** in commit messages or release notes — no "Generated with" or "Co-Authored-By" AI markers.
- Contract and pin changes are high-materiality: proportional risk review before publish.
- The pinned `drenyra-ai` version must be a released artifact — never a checkout.
