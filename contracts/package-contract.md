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
| Commands         | `/drenyra:status`, `:company`, `:period`, `:mission`, `:receipt`, `:ledger` |
| Subagents        | Pi-native accounting agents (explore, apply, verify, review)    |
| Skills           | Drenyra-specific skills shipped with the package                |
| Chains           | RDA chains (monthly close, reconcile, review)                   |
| Themes           | Pi themes                                                        |
| Model routing    | Per-phase model selection for fiscal work                       |
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
- `extensions/register.ts` — Pi extension registration descriptor (`drenyraPiExtension`) and factory, registering `/drenyra:status` and `/drenyra:doctor`.

Install + doctor behavior (contract item 3) is exercised by `__tests__/doctor.test.ts` and `__tests__/status.test.ts`; fail-closed behavior (contract item 4) is the fail-closed matrix in `__tests__/doctor.test.ts`.

## Conformance

Tests cover: clean install, doctor verification, permission defaults, command scope validation, receipt enforcement, and fail-closed behavior on an unverifiable runtime.
