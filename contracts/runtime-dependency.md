# Contract: runtime-dependency

> Version: v0.1 · Status: frozen · Applies to: Drenyra Pi ↔ Drenyra AI.

This contract defines how Drenyra Pi consumes the Drenyra AI runtime. It follows the Gentle Pi ↔ Gentle AI pattern: **exact, verified, package-local** — never an ambient binary.

## Rules

1. **Pinned exact version.** The Drenyra AI version is fixed in the Drenyra Pi package manifest (or a lockfile). Range pins are not allowed for fiscal operations.

2. **Package-local install.** The runtime lives inside Drenyra Pi's own package tree:

   ```text
   drenyra-pi/
   └── runtime/
       └── drenyra-ai@<exact.version>
   ```

3. **Install source.** The package ships a **vendored tarball** of the exact
   pinned version at `vendored/drenyra-ai-<version>.tgz` (preferred source:
   keeps installs offline and independent of the private release endpoint).
   The installer (`runtime/installer.ts` + postinstall) installs from the
   vendored artifact when present; otherwise it falls back to the
   **GitHub Release tarball URL**
   (`https://github.com/arkelythex/drenyra-ai/releases/download/v<version>/drenyra-ai-<version>.tgz`,
   via `installUrlFor`). The tarball is the same artifact verified by
   `verify-packed-install`; when drenyra-ai reaches the registry this becomes a
   plain `drenyra-ai@<version>` install — the pin contract is unchanged.

4. **Never `PATH`.** Ambient `drenyra-ai` binaries are not trusted. All commands, chains, and subagents resolve the pinned runtime explicitly.

5. **Verification on install and doctor.**
   - Checksum of the packaged runtime matches the published artifact.
   - Version matches the pin exactly.
   - If verification fails → harness refuses fiscal operations (fail closed).

6. **Upgrade is explicit.** Changing the pin is a release of Drenyra Pi itself, with:
   - a changelog entry,
   - a migration note describing contract impact,
   - re-run of `doctor` and conformance tests.

7. **Single source of truth.** The pinned runtime's contracts (`mission-protocol`, `candidate`, `receipt`, `gate` from `arkelythex/drenyra-ai/contracts`) are authoritative. Drenyra Pi never forks or redefines them.

## Verification procedure (reference)

```text
1. Read pin: drenyra-ai@<exact.version>
2. Resolve package-local runtime path
3. Verify checksum against published artifact
4. Run: drenyra-ai doctor --expect-version <exact.version>
5. Run conformance vectors for the pinned version
6. Report status to the startup panel; fail closed on any mismatch
```

## What this protects against

- Drift: a newer/older Drenyra AI silently changing fiscal behavior.
- Ambiguity: two runtimes on the machine; results depending on `PATH`.
- Tampering: a replaced binary producing unreceipted or forged results.
- Unreviewed upgrades: a runtime change landing without a migration note.

## Reference implementation

The first verifiable vertical of the pinned-runtime core lives in this package:

| Contract rule | Implementation |
| --- | --- |
| Pinned exact version | `runtime/pin.ts` — `RuntimePin`, `createPin` (validates exact semver, hex checksum, state) and `DEFAULT_PIN` (package `drenyra-ai`, version `0.4.1`, state `released`; `checksumSha256` `09df8d696204337a9b62ddd28c354b414b62e81924caaf68a50b61131d5b7600` — SHA-256 of the release entry artifact `dist/cmd/cli.js`, per `runtime/doctor.ts`; v0.4.1 MINOR addition: configurator host integration + the routing preflight router `routing/router.ts`, which Pi's routing adapter consumes for the route decision) |
| Package-local install / never PATH | `runtime/resolve.ts` — `resolvePackageLocal` consults only `<packageRoot>/runtime/<package>` then `<packageRoot>/node_modules/<package>`; never PATH, `which`, or env |
| Checksum verification | `runtime/checksum.ts` — `sha256File` (lowercase hex sha256, streamed via `node:crypto`); `runtime/doctor.ts` checksums the resolved runtime's entry artifact |
| Doctor fail-closed | `runtime/doctor.ts` — verdicts `verified`, `missing`, `pending-release`, `version-mismatch`, `checksum-mismatch`; a `pending-release` pin is never `verified` |
| Status / startup panel | `runtime/status.ts` — human + machine status reusing `doctor`; `extensions/register.ts` registers `/drenyra:status` and `/drenyra:doctor` |

Conformance tests: `__tests__/doctor.test.ts` (fail-closed matrix with fixture runtimes in the temp dir), `__tests__/resolve.test.ts` (package-locality incl. PATH immunity), `__tests__/pin.test.ts`, `__tests__/status.test.ts`.

## Conformance

Tests cover: pin resolution, checksum mismatch → fail closed, version mismatch → fail closed, package-locality (runtime not found on `PATH` still works), and explicit upgrade flow.
