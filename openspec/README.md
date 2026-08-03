# OpenSpec — drenyra-pi

Spec-Driven Development (SDD) artifacts for the **Pi-native Accounting Operations Harness**.

## What this is

This directory is the **authoritative file-back** for SDD phases. Every phase
(`proposal → specs → design → tasks → apply → verify → archive`) persists its
artifact here so the full decision trail is committable, reviewable, and
recoverable across sessions and machines.

- `openspec/changes/` — one folder per change (proposal, specs, design, tasks,
  apply-progress, verify-report, archive-report).
- `openspec/specs/` — durable cross-change specifications.
- `openspec/config.yaml` — stack, testing, and TDD configuration.

## Persistence model

- **Store mode: HYBRID.** `openspec/` files are AUTHORITATIVE. Engram is
  persisted best-effort only (the Engram HTTP server is flaky in this
  environment and must never block SDD progress).
- Re-running a phase overwrites its artifact (no history) — use git for history.
- `sdd-init` only bootstraps this directory; it does not create changes.

## Testing & TDD

- Test command: `bun test` (vitest runner, fast suite — 54 tests, ~1s).
- Typecheck: `bun run typecheck`.
- **STRICT TDD is active**: RED → GREEN → TRIANGULATE → REFACTOR with recorded
  evidence. Do not fall back to Standard Mode.
