# Contract: runtime-dependency

> Version: 0.1-draft · Status: draft · Applies to: Drenyra Pi ↔ Drenyra AI.

This contract defines how Drenyra Pi consumes the Drenyra AI runtime. It follows the Gentle Pi ↔ Gentle AI pattern: **exact, verified, package-local** — never an ambient binary.

## Rules

1. **Pinned exact version.** The Drenyra AI version is fixed in the Drenyra Pi package manifest (or a lockfile). Range pins are not allowed for fiscal operations.

2. **Package-local install.** The runtime lives inside Drenyra Pi's own package tree:

   ```text
   drenyra-pi/
   └── runtime/
       └── drenyra-ai@<exact.version>
   ```

3. **Never `PATH`.** Ambient `drenyra-ai` binaries are not trusted. All commands, chains, and subagents resolve the pinned runtime explicitly.

4. **Verification on install and doctor.**
   - Checksum of the packaged runtime matches the published artifact.
   - Version matches the pin exactly.
   - If verification fails → harness refuses fiscal operations (fail closed).

5. **Upgrade is explicit.** Changing the pin is a release of Drenyra Pi itself, with:
   - a changelog entry,
   - a migration note describing contract impact,
   - re-run of `doctor` and conformance tests.

6. **Single source of truth.** The pinned runtime's contracts (`mission-protocol`, `candidate`, `receipt`, `gate` from `arkelythex/drenyra-ai/contracts`) are authoritative. Drenyra Pi never forks or redefines them.

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

## Conformance

Tests cover: pin resolution, checksum mismatch → fail closed, version mismatch → fail closed, package-locality (runtime not found on `PATH` still works), and explicit upgrade flow.
