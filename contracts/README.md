# Drenyra Shell — Contracts

> **Status: Shell-local contract surface frozen.** The package/runtime regime is frozen at v0.2 (renamed from Drenyra Pi to Drenyra Shell; naming-only, no schema/field changes), and the evidence, authority, receipt, and mission schema families remain frozen at v0.1, accurately recording their implemented Shell-local consumption and adaptation boundaries. They do not copy or redefine Dominion/Drenyra AI engine contracts.

## Contract index

| Contract family | Shell-local version | Status | Boundary governed |
| --- | --- | --- | --- |
| [package-contract](package-contract.md) | 0.2 | Frozen | Install surface and provided capabilities |
| [runtime-dependency](runtime-dependency.md) | 0.2 | Frozen | Exact, verified, package-local Drenyra AI runtime |
| [`evidence/`](evidence/) | 0.1 (`schemaVersion: 1`) | Frozen | Shell persistence and validation of evidence nodes, edges, and mission graphs |
| [`authority/`](authority/) | 0.1 (`schemaVersion: 1` where enveloped) | Frozen | Shell validation of canonical scope and authorization records |
| [`receipts/`](receipts/) | 0.1 (`drenyra.receipt-binding.v1`; engine protocol `1.0`) | Frozen | Shell receipt binding, trusted-key registry, and validation of consumed signed receipts |
| [`mission/`](mission/) | 0.1 | Frozen | Shell validation of mission snapshots, steps, events, and statuses consumed from the pinned runtime |
| [engram-dependency](engram-dependency.md) | 0.2.1-SNAPSHOT-6a371a9 | Tracked, not frozen | Pinned, verified, package-local `drenyra-engram` binary and its read-only MCP consumption surface |

## Ownership boundary

These JSON Schemas are **consumer conformance adapters owned by Drenyra Shell**. They describe the documents Shell accepts, stores, or projects at its package boundary. Published Dominion/Drenyra AI exports remain authoritative for engine mission and signed-receipt semantics; Shell does not claim ownership of engine state transitions, signing, gates, ledger behavior, or protocol evolution.

| Family | Shell owns | External authority retained |
| --- | --- | --- |
| Evidence | Local graph record envelopes, payload-hash fields, and schema validation | Evidence-hash computation and engine authority decisions |
| Authority | Local scope/authorization record validation and fail-closed adaptation | Gate evaluation and authorization semantics |
| Receipts | `ReceiptBinding`, trusted-key registry storage, and consumed-document validation | Signed-receipt construction, cryptography, and receipt protocol semantics |
| Mission | Validation/projection of exported mission documents | Mission lifecycle and transition semantics |

No deep import or copied private engine schema is permitted. Conformance fixtures are built from the pinned package's public exports where runtime construction is available.

## Compatibility policy

1. **Frozen bytes.** Every shipped contract and schema is covered by [`SHA256SUMS.json`](SHA256SUMS.json); package verification rejects drift, missing entries, and uncovered additions.
2. **Compatible change.** Clarifying documentation or adding tests does not change accepted document bytes and requires no schema version bump.
3. **Breaking change.** Changing required fields, accepted values, hash rules, schema identifiers, local `schemaVersion`, `ReceiptBinding.version`, or the consumed engine protocol requires an explicit compatibility review, version bump, and migration note before schemas change.
4. **External evolution.** A new Dominion/Drenyra AI contract is first evaluated at the adapter boundary. Shell must not silently widen a schema or relabel an incompatible external document as v0.1.
5. **Current decision.** This freeze documents existing implementation without changing schema bytes or accepted shapes; therefore no version bump or migration is required.

## Verification

- `__tests__/contracts.test.ts` exercises representative valid, tampered/malformed, and incompatible documents.
- `__tests__/package-verify.test.ts` verifies the checksum manifest and fails closed on content drift or unsupported manifest versions.
- Monetary values remain BigInt cents at JSON boundaries; digests remain lowercase hexadecimal SHA-256.
