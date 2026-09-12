# Refresh the participant checkpoint

`program-lock-facts.json` is a hand-authored participant checkpoint. Refresh its current repository metadata after applying or archiving an OpenSpec change:

```sh
bun run refresh:lock-facts
node scripts/refresh-program-lock-facts.mjs --check
```

Run the command only from the canonical Git top-level. The default command and explicit `--write` mode atomically update the checkpoint. `--check` is read-only and exits non-zero when the prospective bytes differ. Both modes reject nested execution and symlinked fixed paths. Tests and lifecycle commands never invoke write mode automatically.

## What changes

The producer derives only `headSha`, `packageVersion`, sorted immediate `activeChanges` (excluding `archive`), the existing content and capability manifest digests, and `candidateIdentity`. Candidate identity uses the canonical participation algorithm with an in-memory lock-facts override, so checking never requires a temporary checkpoint write.

The command preserves contract declarations, schema and authority fields, the pinned runtime entry checksum, and historical test evidence. In particular, `tests`, `evidenceDate`, and old `derivationCommands` describe their recorded evidence date; they do not claim current test counts. Verified test-result ingestion is intentionally out of scope.

## Boundary

The digests cover the two referenced manifests, not every file in the repository. Candidate identity covers only the immutable participation allowlist documented by `compute-candidate-identity.mjs`; it is not a full-tree hash. The producer fails closed on malformed checkpoint/manifests, missing referenced files, redirected or symlinked paths, a changed pin trust anchor, or an atomic replacement failure. Failed replacement removes its owned temporary file without changing the checkpoint.
