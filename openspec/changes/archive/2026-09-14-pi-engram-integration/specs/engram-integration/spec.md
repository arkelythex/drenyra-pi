# Engram Integration Specification

## Purpose

Defines how `drenyra-shell` consumes the `drenyra-engram` memory engine for a **read-only institutional-context surface, bounded to the already-known active scope**: the pinned dependency, its fail-closed child-process lifecycle, the `/drenyra:context` read contract, and the honesty requirement on `capability-manifest.yaml`. The active company/period *pointer* itself stays local (`runtime/context.ts`, unchanged) — Engram's own scope model has no session/app-state concept to hold it (see `design.md` §6). This is a new domain with no prior canonical spec; every requirement below is additive.

Out of scope by design (see `proposal.md` §3): proposal-informing memory reads (`engram_search`/`accounting_current_context` used to shape a fiscal proposal), any `accounting_approve`/`accounting_review_reject`/`accounting_review_return` call, and the full 10-element canonical scope model (`REQ-SCOPE-001`, unaffected — this domain governs RUC + period persistence, not scope validation, which stays owned by `scope-binding`).

## Requirements

### Requirement: REQ-ENG-001 — Pinned, checksummed Engram binary

The `drenyra-engram` binary MUST be vendored at an exact, checksummed version for the target platform(s); no floating version, no live fetch at install or run time, and no ambient-`PATH` resolution — the same discipline `runtime-dependency.md` already enforces for `drenyra-ai`.

#### Scenario: Exact version vendored and checksummed

- GIVEN the vendored `drenyra-engram` binary
- WHEN its version and checksum are read
- THEN they match a recorded pin (analogous to `runtime/pin.ts#DEFAULT_PIN`), and no other version of the binary is present in the package tree

#### Scenario: No ambient binary is trusted

- GIVEN a `drenyra-engram` binary is present on the system `PATH`
- WHEN Shell starts the Engram child process
- THEN it launches the vendored, package-local binary — never the `PATH` one

### Requirement: REQ-ENG-002 — Fail-closed child-process lifecycle

Starting, health-checking, and stopping the `drenyra-engram mcp` child process MUST never leave the scope store in an inconsistent or silently-empty state, and a failure to reach a healthy MCP session MUST be visible (never silent) and MUST NOT crash the host command.

#### Scenario: Healthy start

- GIVEN the vendored binary and a clean environment
- WHEN Shell spawns `drenyra-engram mcp` and performs the MCP `initialize` handshake
- THEN the handshake succeeds within a bounded timeout and the process is usable for scope reads/writes

#### Scenario: Binary absent or unhealthy

- GIVEN the vendored binary is missing, fails to start, or the `initialize` handshake fails
- WHEN a command needs scope
- THEN Shell reports a visible, specific diagnostic naming the failure and falls back per the design-phase-decided policy (§ design.md, not restated here) — it does not crash the command and does not silently invent or discard scope

#### Scenario: Graceful shutdown

- GIVEN a running `drenyra-engram mcp` child process
- WHEN the host Shell process exits normally
- THEN the child process is terminated cleanly, with no orphaned process left running

### Requirement: REQ-ENG-003 — Institutional context read for an already-known scope

**Corrected during design (see `design.md` §6): Engram's `scope.kind` enum (`company` | `institutional`) has no session/app-state kind, so it cannot serve as the source of truth for "what is Shell's currently active company/period" — that would be circular (`company` scope requires the RUC to already be known) or a semantic misuse (`institutional` scope means cross-company accounting knowledge, not app state).** `runtime/context.ts`'s existing local pointer (`~/.drenyra/context.json`) remains the sole source of truth for the active `ScopeContext`; this requirement governs only the read that follows once that pointer already supplies a valid RUC + period.

Once `ScopeContext` (company RUC + fiscal period) is known from the existing local pointer, `/drenyra:context` MUST be able to fetch institutional context for that exact scope from Engram (`engram_context`) and surface it alongside the RUC/period it already reports — read-only, no fiscal-effect claim, no proposal shaped by it in this slice.

#### Scenario: Context command surfaces Engram-backed institutional context

- GIVEN a company RUC and fiscal period already set via the existing scope-setting commands
- WHEN `/drenyra:context` runs and the Engram child process is healthy
- THEN it reports the RUC/period exactly as it does today, plus whatever institutional context `engram_context` returns for that scope

#### Scenario: RUC/period validation is unchanged

- GIVEN an invalid RUC (fails the check-digit algorithm) or an invalid period (month outside 01–12)
- WHEN scope is set via the existing scope-setting commands
- THEN the existing `REQ-SCOPE-002`/`REQ-SCOPE-003` validation still rejects it exactly as today — this domain adds a read, and touches no validation path

### Requirement: REQ-ENG-004 — Honest capability state

`capability-manifest.yaml#/capabilities/engram-integration` MUST accurately describe exactly what this change delivers (scope persistence via Engram) and MUST NOT claim `operational=end-to-end` or an ownership level the existing guard tests (`__tests__/capability-manifest.test.ts`) do not support, unless those tests are also deliberately and visibly updated with new evidence in the same change.

#### Scenario: Manifest state matches delivered scope

- GIVEN this change's final candidate
- WHEN `capability-manifest.yaml#/capabilities/engram-integration` is read
- THEN its `evidence.limitation` text accurately states that scope persistence is Engram-backed while proposal-informing memory reads remain unimplemented

#### Scenario: Existing guard tests still pass or are honestly updated

- GIVEN `__tests__/capability-manifest.test.ts` lines 961-978 (blocks an `operational=end-to-end` claim) and 1095-1118 (blocks ownership escalation)
- WHEN `bun test` runs against this change's final candidate
- THEN both guards pass unchanged, or are updated in the same change with a diff that a reviewer can see states honest new evidence — never silently loosened

## Out of Scope

Proposal-informing memory reads (`engram_search`/`accounting_current_context` wired into any command's proposal logic); any `accounting_approve`/`accounting_review_reject`/`accounting_review_return` call; widening `ScopeContext` beyond RUC + period; any change to the 10-element canonical scope model (`REQ-SCOPE-001`..`005`, `scope-binding` domain); any change inside the `drenyra-engram` repository; publication of `drenyra-shell` to any registry (`REQ-REL-006`).
