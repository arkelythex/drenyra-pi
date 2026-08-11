# Contributing to Drenyra Pi

**Status: pre-alpha.** Drenyra Pi is extracted from `arkelythex/drenyra-app-web` (`packages/pi`) through vertical slices. The maintainer (Arkelythex) drives the extraction; external contributions are welcome only after the contracts in `contracts/` stabilize.

## Ground rules

- **Fiscal correctness is a product safety requirement.** Commands and chains never bypass receipts, gates, or audit trails.
- **No floats for money.** Money is whole-number cents (BigInt) or the Drenyra `Money` model.
- **Tenant/RUC scope is mandatory.** Company and period context threads through every command; never operate cross-RUC.
- **No secrets.** No credentials, tokens, or customer data in code, docs, tests, or prompts.
- **Tool safety is default-deny.** Fiscal tools are broad-deny, narrow-allow; permissions are reviewed like code.

## Workflow

1. Create a dedicated branch (or isolated worktree for medium/large changes).
2. Keep `main` clean.
3. Prefer small, verifiable, reversible changes. Split changes over 400 lines into chained PRs.
4. Update docs in the same PR as code (docs-as-code). Stale docs are a bug.
5. Add tests for changed commands, chains, and permission rules.
6. Conventional commits only (no AI attribution).
7. The review gate rejects: silent error handling, production `console.log`, missing scope checks, missing tests, permission loosening without justification, contract changes without docs.

## Drenyra AI runtime

The pinned Drenyra AI runtime is a **package contract** — see [contracts/runtime-dependency.md](contracts/runtime-dependency.md). Never change the pin without updating the contract, the verification steps, and the migration note.

## Getting help

Open an issue with a clear description. For security issues, use Private Vulnerability Reporting — see [SECURITY.md](SECURITY.md).
