# Refresh the participant checkpoint

`program-lock-facts.json` is a hand-authored participant checkpoint. Refresh its current repository metadata whenever the tree it describes has moved.

> **This document is the single canonical statement of the lock-fact recovery sequence.** Other documents
> link here. None of them restates the steps, the trigger set, or the ordering rationale.

## When the sequence is mandatory

The sequence below is mandatory after either trigger class:

1. **A participation-path mutation.** Any change to a path listed in `PARTICIPATION_PATHS_V1`
   (`scripts/compute-candidate-identity.mjs`) — by an apply unit, by a formatter or autofix pass, or by
   another session acting outside any attempt.
2. **A change-folder lifecycle event.** Opening or archiving a change under `openspec/changes/` moves the
   generated `activeChanges` field, which lives inside an allowlisted file. This trigger needs no mistake,
   no budget trip, and no tooling failure: it fires on the ordinary first step of every change.

## The sequence (run in this order)

```sh
# 1. Regenerate the checkpoint through the sanctioned generator. Never hand-edit a
#    candidate identity, a checksum or digest, or headSha — the generator derives them.
bun run refresh:lock-facts

# 2. Rewrite the normalization-exempt mirror with the value step 1 produced. The payload is
#    single-quoted and supplies the replacement as a function, so neither the shell nor
#    String.replace can interpret a dollar pattern.
node -e 'const{readFileSync,writeFileSync}=require("node:fs");const facts=JSON.parse(readFileSync("docs/architecture/program-lock-facts.json","utf8"));const id=facts.candidateIdentity;const p="openspec/config.yaml";const before=readFileSync(p,"utf8");const after=before.replace(/^(\s*candidate_identity:\s*).*$/m,function(_match,key){return key+JSON.stringify(id);});if(after===before)throw new Error("openspec/config.yaml has no candidate_identity line to rewrite");writeFileSync(p,after);console.log("config.yaml mirror <- "+id);'

# 3. The checkpoint must now be current. If the mirror write was openspec/config.yaml's only
#    change, the identity moved with it: repeat steps 1-2, then run this check (see below).
node scripts/refresh-program-lock-facts.mjs --check

# 4. Full verification.
bun run typecheck && bun run test && bun run verify:style && bun run verify:capability && bun run verify:package && node scripts/verify-packed-install.mjs
```

**Why the order matters.** `openspec/config.yaml#/current_test_state/candidate_identity` is the one field the
identity algorithm normalizes (`normalizeConfigYaml` in `scripts/compute-candidate-identity.mjs`): the mirror
is normalization-exempt as a **value**, never as a **path**. Membership is decided by `workingTreeChanged()`
→ `git diff --quiet HEAD -- <path>` over raw bytes, so when the mirror write is `openspec/config.yaml`'s
**only** change the identity moves with that write, and `refresh → mirror → --check` cannot converge in one
pass: `--check` reports `program lock facts are stale`. Iterate to the fixed point — run the refresh **again**
once the mirror line exists, then `--check`. When other `openspec/config.yaml` fields change in the same unit
(the usual case: the recorded counts participate in the identity), the first refresh already computed the
identity with the file modified, so the single pass converges.

A refresh **without** the mirror rewrite is the other failure mode, and it is silent: `bun run
verify:capability` goes red while the generator's own `--check` still exits 0, because the mirror is not an
input to the checkpoint. The mirror must carry exactly the value the last refresh produced, and step 3 must
follow it. **Steps 1-3 are one indivisible operation.**

Write the mirror **last** among the edits of a unit: every other field of `openspec/config.yaml` (the recorded
counts included) participates in the identity, so the mirror is only stable once those edits are final.

Run the command only from the canonical Git top-level. The default command and explicit `--write` mode atomically update the checkpoint. `--check` is read-only and exits non-zero when the prospective bytes differ. Both modes reject nested execution and symlinked fixed paths. Tests and lifecycle commands never invoke write mode automatically.

## What changes

The producer derives only `headSha`, `packageVersion`, sorted immediate `activeChanges` (excluding `archive`), the existing content and capability manifest digests, and `candidateIdentity`. Candidate identity uses the canonical participation algorithm with an in-memory lock-facts override, so checking never requires a temporary checkpoint write.

The command preserves contract declarations, schema and authority fields, the pinned runtime entry checksum, and historical test evidence. In particular, `tests`, `evidenceDate`, and old `derivationCommands` describe their recorded evidence date; they do not claim current test counts. Verified test-result ingestion is intentionally out of scope.

## Boundary

The digests cover the two referenced manifests, not every file in the repository. Candidate identity covers only the immutable participation allowlist documented by `compute-candidate-identity.mjs`; it is not a full-tree hash. The producer fails closed on malformed checkpoint/manifests, missing referenced files, redirected or symlinked paths, a changed pin trust anchor, or an atomic replacement failure. Failed replacement removes its owned temporary file without changing the checkpoint.
