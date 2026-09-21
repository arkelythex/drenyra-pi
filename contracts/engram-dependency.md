# Contract: engram-dependency

> Version: 0.2.1-SNAPSHOT-6a371a9 · Status: tracked, not frozen (pre-release build) · Applies to: Drenyra Shell ↔ Drenyra Engram.

This contract defines how Drenyra Shell consumes the `drenyra-engram` binary. It follows the same **exact, verified, package-local** discipline [`runtime-dependency`](runtime-dependency.md) establishes for Drenyra AI — but the artifact shape is different: `drenyra-engram` is a **compiled Go binary spawned as an MCP child process**, not an npm-imported library, so it needs a per-platform pin instead of one portable tarball.

## Why `tracked, not frozen`, unlike `runtime-dependency`'s `frozen`

The pinned build (`0.2.1-SNAPSHOT-6a371a9`) is an explicit pre-release snapshot, not a tagged release — `runtime-dependency.md`'s `frozen` status asserts a compatibility policy across future pin bumps that would be premature to claim for a moving snapshot target. This mirrors `preproposal.md` D2's confirmed decision (accept a pre-alpha dependency now, the same way `drenyra-ai` was pinned while itself pre-alpha) without overclaiming stability this build does not have.

## Rules

1. **Pinned exact build, per platform.** The exact upstream build identifier (`drenyra-engram_0.2.1-SNAPSHOT-6a371a9_<platform>`) is fixed per supported platform in `runtime/engram-pin.ts`. No range, no "latest," no live fetch.

2. **Package-local, four platforms, no Windows.** Vendored under:

   ```text
   drenyra-shell/
   └── vendored/
       └── drenyra-engram/
           ├── drenyra-engram-0.2.1-SNAPSHOT-6a371a9-linux_amd64.tar.gz
           ├── drenyra-engram-0.2.1-SNAPSHOT-6a371a9-linux_arm64.tar.gz
           ├── drenyra-engram-0.2.1-SNAPSHOT-6a371a9-darwin_amd64.tar.gz
           └── drenyra-engram-0.2.1-SNAPSHOT-6a371a9-darwin_arm64.tar.gz
   ```

   **Windows is explicitly not vendored in this pin.** `runtime/engram-pin.ts` reports a clear "unsupported platform" diagnostic on `win32` rather than silently failing or pretending support (`design.md` §1). This is a disclosed limitation, not an oversight.

3. **Disclosed cost.** Four platform artifacts total ~18 MB (measured, `contracts/engram-dependency.md`'s own apply record — see `openspec/changes/pi-engram-integration/tasks.md` T-A-002), materially larger than `runtime-dependency.md`'s ~640 KB single vendored tarball, because a compiled Go binary has no portable single-file form the way an npm package does. This size ships in every `drenyra-shell` install (`vendored` is in `package.json#/files`).

4. **Never `PATH`.** Ambient `drenyra-engram` binaries are not trusted, exactly as rule 4 of `runtime-dependency.md` requires for `drenyra-ai`.

5. **Verification.** Platform detection (`process.platform` + `process.arch`) selects the one artifact to verify; sha256 checksum match is required before spawning; any mismatch or unsupported platform fails closed — never a silent fallback to an unverified binary. See "Verification procedure" below.

6. **Read-only consumption.** Pi calls only `engram_context` and `engram_search` (`engram_*` general tools, both read-only) through the spawned MCP child process. It never calls any `accounting_*` tool and never calls a write-shaped `engram_*` tool (`engram_save`, `engram_reject`, `engram_void`, `engram_supersede`) — this pin's consumption surface is a strict subset of what the binary exposes, by deliberate design (`pi-engram-integration` design.md §6; widened to include `engram_search` by `pi-engram-memory-reads` proposal.md §2), not a limitation of the binary itself.

7. **Upgrade is explicit.** Changing the pinned build is a release of Drenyra Shell itself, following the same discipline `runtime-dependency.md` rule 6 requires: changelog entry, migration note, re-run of verification.

## Pinned artifacts

| Platform | Build | sha256 |
| --- | --- | --- |
| `linux_amd64` | `drenyra-engram_0.2.1-SNAPSHOT-6a371a9_linux_amd64` | `caa6f3298601536520db82b1d6b099cde454160b3a262164163055d71366aadf` |
| `linux_arm64` | `drenyra-engram_0.2.1-SNAPSHOT-6a371a9_linux_arm64` | `4f644dc869237a73dcc6ff8d189afebffec23407c7f4b528c073bcd300728af9` |
| `darwin_amd64` | `drenyra-engram_0.2.1-SNAPSHOT-6a371a9_darwin_amd64` | `ac71f6dee50d5030f167dd6f705652bcc6aa8b885a582257ae744bda48beb64d` |
| `darwin_arm64` | `drenyra-engram_0.2.1-SNAPSHOT-6a371a9_darwin_arm64` | `39aeeb5517af259237aa4965e330b5807aacdb08e92f203310431ff0798446d4` |
| `win32` (any arch) | not vendored | n/a — unsupported platform, disclosed |

## Verification procedure (reference)

```text
1. Read process.platform + process.arch; map to one of the four supported platforms, or report "unsupported platform" and stop.
2. Resolve the package-local vendored tarball path for that platform.
3. Verify its sha256 against the table above.
4. On any mismatch or missing file: fail closed, report which check failed. Never spawn an unverified binary.
5. On success: extract (or reuse an already-extracted, checksum-stamped copy) and spawn `drenyra-engram mcp --db <path>`.
```

## Known, disclosed gap (not fixed by this change)

`scripts/verify-package-files.mjs` (the pre-publish packaging gate) reconciles the single `drenyra-ai` vendored tarball via `DEFAULT_PIN`, but its `collectCoveredFiles` walk covers only `contracts/` and `assets/schemas/` — it does **not** scan `vendored/`, and has no generic multi-platform reconciliation logic. Extending it for `drenyra-engram`'s four-platform matrix is out of scope for this change (`tasks.md`'s allowed edit surface does not include `scripts/lib/package-verify.mjs`). `runtime/engram-pin.ts` is therefore the **sole** verifier of these four checksums today. Since `drenyra-shell` publication is itself out of scope (`REQ-REL-006`, unaffected by this change), this gap has no live consequence yet, but a future change that authorizes publication must close it before a `drenyra-engram`-dependent package can be safely published.

## Reference implementation

| Contract rule | Implementation |
| --- | --- |
| Pinned exact build, per platform | `runtime/engram-pin.ts` — the platform→build/checksum table and `verifyEngramPin` |
| Package-local, never PATH | same module — resolves only `<packageRoot>/vendored/drenyra-engram/<artifact>`, never `PATH` |
| Verification / fail-closed | same module — checksum mismatch, missing artifact, or unsupported platform all report a typed failure, never a silent pass |
| Child-process lifecycle | `runtime/engram-client.ts` — spawn, `initialize` handshake, graceful shutdown (see `design.md` §6) |
| Read-only consumption surface | `extensions/register.ts`'s `:context` handler (`engram_context`) and `drenyra_institutional_memory` tool (`engram_search`, reachable only by `journal-candidate-agent`) — the only two callers |

Conformance tests: `__tests__/engram-pin.test.ts`, `__tests__/engram-client.test.ts`.

## Migration notes

- 2026-09-21: Project renamed from Drenyra Pi to Drenyra Shell (drenyra-pi → drenyra-shell). No schema, field, or pinned-build changes — this is a naming-only update. The header `Version:` is the pinned `drenyra-engram` build (`0.2.1-SNAPSHOT-6a371a9`), not a contract revision, so it is left unchanged; see CHANGELOG.md.
