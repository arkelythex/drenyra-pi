# Trust Model — Drenyra Pi (Pi-native Accounting Operations Harness)

> **Last updated:** 2026-08-01.

> Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; version/sequence numbers are JSON integers, never floats.

## Model in one line

**Pinned verified runtime, fail-closed.** Drenyra Pi trusts exactly one engine — the exact version of Drenyra AI it pinned and verified at install — and every fiscal action is default-denied until scope and authority are proven.

## Trust boundaries

### 1. The runtime is pinned, verified, package-local

- An exact, checksum-verified version of Drenyra AI is installed inside the package tree.
- **Never `PATH`.** Ambient binaries are not trusted for fiscal operations.
- Verification runs on install (`doctor` confirms); a failed check makes the runtime unusable.

### 2. Tool safety is default-deny

- Fiscal tools follow **broad-deny, narrow-allow** permissions.
- Permissions are part of the contract and reviewed like code.

### 3. Context is threaded, never assumed

- Company (RUC) and fiscal period are loaded at startup and threaded through every tool, command, and subagent.
- Missing context fails closed: the operation does not proceed.

### 4. Authority comes from Drenyra AI gates and humans

- Drenyra Pi never invents authority. Missions, candidates, gates, and approvals run in Drenyra AI.
- Explicit human approval is required for material actions (R2/R3 chains such as monthly close).

### 5. Memory informs; it never authorizes

- Drenyra Engram provides context and institutional knowledge.
- No memory observation is ever treated as permission to act.

## Fail-closed default

When the pin is unverifiable, the context is missing, or permissions are insufficient, Drenyra Pi **fails closed**: the command refuses, explains why, and waits for a human. There is no ambient-binary fallback and no permission escalation.

## Interaction with consumers

Drenyra Pi is the operator layer: it packages the Drenyra AI experience for Pi and enforces scope at the surface. The engine's contracts remain the source of truth for fiscal behavior.

## Operational consequences

- A failed pin verification blocks every fiscal command, not just the one that tripped it.
- Permission changes ship as reviewed contract changes, never as ad hoc edits.
