# Style Standard and Verification Gate

This document defines the durable, low-churn formatting/lint standard for
drenyra-pi and the gate that enforces it. The gate is deliberately **diff-scoped**
so it checks newly written code without requiring a whole-repository reformat
and without touching pre-existing legacy whitespace debt.

## The standard

Owned source surface (mirrors `tsconfig.json` include plus `scripts/`):

- `lib/`, `chains/`, `runtime/`, `extensions/`, `scripts/`, `__tests__/`
- root sources: `index.ts`, `vitest.config.ts`

### Rules

| Rule | Scope | Enforced today |
| --- | --- | --- |
| No byte-order mark (BOM) | repo-wide, every owned file | yes |
| No CRLF line endings | repo-wide, every owned file | yes |
| Single final newline at EOF | repo-wide, every owned file | yes |
| No trailing whitespace | added lines of tracked diffs + full content of untracked owned files | yes |
| No trailing whitespace | full content of every owned file | no — see legacy debt |

## How the gate works

`bun run verify:style` runs `scripts/verify-style.mjs` (zero dependencies;
implementation in `scripts/lib/style-verify.mjs` with focused tests in
`__tests__/style-verify.test.ts`):

1. **Repo-wide file-level invariants** (BOM / CRLF / final newline) over every
   owned file. The whole tree satisfies these today, so the gate is strong from
   day one.
2. **Trailing whitespace on newly added lines** of tracked changes — the
   committed branch work (`base..HEAD`) and the uncommitted working tree
   (`HEAD`) — using the same added-line semantics as `git diff --check`.
3. **Untracked owned files** are checked in full (every line is new code).

Baseline resolution: `git merge-base HEAD origin/main` when `origin/main` is
available and differs from `HEAD` (CI runs `actions/checkout` with
`fetch-depth: 0`, so a PR's full branch diff is checked); otherwise `HEAD~1`.
Override with `--base <ref>`.

### Exit and reporting

The gate fails closed: any violation prints `verify-style: FAILED` with
`file:line: rule` entries and exits 1. A clean run prints `verify-style: OK`.

## CI

`.github/workflows/style.yml` runs the identical command (`bun run verify:style`)
on push to `main` and on pull requests, with read-only contents permission and
the same immutable action pins as the rest of the pipeline. No write access is
granted.

## Legacy debt and gradual adoption

The following pre-existing trailing-whitespace lines exist in the committed
baseline and in current uncommitted work. The gate does **not** flag them (they
are not newly added lines), so no broad reformat is forced. When any of these
lines is rewritten, the gate flags it and it is fixed as part of that change —
the debt drains naturally:

- `lib/accounting-status.ts:244`
- `lib/chain-pipeline.ts:776`
- `lib/evidence-graph.ts:450`
- `extensions/register.ts:232, 541, 545, 588, 639, 693, 696`

To inspect (never to silence) the debt, run `node scripts/verify-style.mjs --all`.
It checks every rule against the full content of every owned file and is
**expected to fail today**; adopt a file by fixing its reported lines, after
which the default gate covers it fully.

## Deliberately not enforced (deferred decisions)

- **Indentation width**: the tree is genuinely mixed today — 4-space in
  `lib/`, `chains/`, `runtime/`, `extensions/`; tabs in `__tests__/` and some
  `scripts/`; internally mixed in `lib/chain-pipeline.ts`,
  `extensions/register.ts`, and `extensions/startup-panel.ts`. Unifying this is
  a product decision (reformat or per-file conventions) that belongs outside
  this gate.
- **Deeper lint rules** (unused vars, type patterns): `tsc --noEmit` already
  enforces `noUnusedLocals`/`noUnusedParameters` and strict mode. Adopting
  ESLint or Prettier would add dependencies and require resolving the
  indentation decision first.
