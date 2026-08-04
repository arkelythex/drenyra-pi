# Contract: package-contract

> Version: 0.1-draft · Status: draft · Applies to: `drenyra-pi` npm package.

This contract defines the **install surface** and the **provided capabilities** of Drenyra Pi. It is the promise a consumer gets when running `pi install npm:drenyra-pi`.

## Install surface

```bash
pi install npm:drenyra-pi
```

The package must:

1. Install cleanly into a Pi extension directory.
2. Register its extensions, commands, agents, skills, and themes without manual steps.
3. Run `install` + `doctor` before first use: verifies the pinned Drenyra AI runtime (checksum + version), checks permissions, and reports company/period configuration state.
4. Fail closed: if the runtime pin cannot be verified, the harness refuses fiscal operations.

## Provided capabilities

| Capability       | Contract                                                        |
| ---------------- | --------------------------------------------------------------- |
| Persona          | Accounting operator persona, fiscal-first, warm and direct      |
| Startup panel    | Loads and shows company + fiscal period context at session start |
| Commands         | `/drenyra:status`, `:doctor`, `:company`, `:period`, `:context`, `:capabilities`, `:scope`, `:models`, `:close`, `:mission`, `:continue`, `:resume`, `:receipt`, `:evidence`, `:verify`, `:reconcile` — the 14 intended commands (REQ-CMD-001) plus legacy extras; `evidence`/`verify`/`reconcile` register with structured `not_available` denials until their chains land (PR #7/#8) |
| Subagents        | Pi-native accounting agents (explore, apply, verify, review)    |
| Skills           | Drenyra-specific skills shipped with the package                |
| Chains           | RDA chains (monthly close, reconcile, review)                   |
| Themes           | Pi themes                                                        |
| Model routing    | Documented model-routing capability registry (`/drenyra:models`); advisory only — the installed Pi host slice exposes no model-routing API (G30) and model suggestions never grant authority |
| Memory access    | Reads Drenyra Engram context; never authorizes operations       |

## Command contract

Every `/drenyra:*` command:

- Validates company (RUC) and period scope before executing.
- Returns structured output (JSON where machine-readable) and a human summary.
- Never mutates without a receipt from Drenyra AI.
- Never echoes secrets or customer data.

## Versioning

- Drenyra Pi follows semver. Major = breaking command, extension, or runtime-pin contract change.
- The pinned Drenyra AI version is part of the package manifest and changes with the pin — see [runtime-dependency](runtime-dependency.md).
- Command output shape is versioned; consumers (chains, scripts) declare the version they parse.

## Reference implementation

The first verifiable vertical of this contract ships in `runtime/` and `extensions/`:

- `runtime/pin.ts` — the pinned Drenyra AI runtime (`DEFAULT_PIN`, currently `pending-release`), validated by `createPin`.
- `runtime/doctor.ts` — fail-closed verification (checksum + version, package-local); `runtime/status.ts` renders human + machine status for the startup panel.
- `extensions/register.ts` — the exact compiled entrypoint (`pi.extensions` → `./dist/extensions/register.js`), registering `/drenyra:status`, `:doctor`, `:company`, `:period`, `:context`, `:capabilities`, `:scope`, `:models`, `:close`.
- `extensions/scope-guard.ts` — per-command scope policy: bootstrap/read commands run pre-scope; scope-requiring commands fail closed on incomplete or changed canonical scope.
- `extensions/mission-status.ts` — status/capabilities rendering: status projection (company/period, mission, next authorized action, sources, reconciliations, anomalies, approvals) plus engine and harness capabilities; every command returns a human summary + structured JSON.
- `extensions/startup-panel.ts` — activation banner (runtime verdict + scope completeness) printed through an injected output function; no unverified `ctx.ui` dependency in v0.1.
- `extensions/mission-commands.ts` — mission lifecycle command rendering: mission/continue/resume/receipt show+verify outputs and the structured `not_available` denials (REQ-CMD-008).
- `lib/mission-commands.ts` — EDA mission coordinator (S4b): durable mission start with the 13-step plan, one-step continue (RUN/SKIP/WAIT from persisted state; no continue-all), authority-bound advance, and fail-closed restart recovery via `recoverDurableMissions` (PR #7's `executePreparedStep` replaces it for full chains).

Install + doctor behavior (contract item 3) is exercised by `__tests__/doctor.test.ts` and `__tests__/status.test.ts`; fail-closed behavior (contract item 4) is the fail-closed matrix in `__tests__/doctor.test.ts`.

## Conformance

Tests cover: clean install, doctor verification, permission defaults, command scope validation, receipt enforcement, and fail-closed behavior on an unverifiable runtime.
