# Design: Evidence-Driven Accounting Harness

> Change: `evidence-driven-accounting-harness`  
> Product: `drenyra-pi`  
> Status: designed  
> Artifact store: HYBRID — this file is authoritative; Engram is best-effort  
> Runtime baseline: pinned `drenyra-ai@0.2.0`

## 1. Executive design

Build a thin Pi cockpit over the public `drenyra-ai@0.2.0` APIs. Pi handlers gather intent, validate the bound scope, invoke deterministic libraries or chains, and render results. The engine remains authoritative for mission lifecycle transitions, approval semantics, receipt signatures, and recovery rules. File-backed state under the active workspace's `.local/` directory is authoritative; chat and memory are never authority.

The implementation has four layers:

1. **Host layer (`extensions/`)** — command registration, scope preflight, activation banner, and rendering.
2. **Application layer (`chains/`)** — bounded orchestration using one shared scope → mission → gate → receipt pipeline.
3. **Deterministic harness layer (`lib/`)** — canonical scope identity, authority checks, durable adapters, evidence provenance, status projection, and trusted receipt verification.
4. **Engine layer (`drenyra-ai`)** — canonical mission states and transitions, intents, materiality derivation, approval gates, receipt signing and verification, and recovery policy.

### Non-negotiable principles

- The package remains thin; it does not reimplement the accounting engine.
- The engine owns lifecycle transitions. The harness owns the ordered EDA phase plan stored in `MissionStep[]`.
- Deterministic engines calculate and validate; an LLM may interpret or propose but is never the system of record.
- Every mutation is bound to an exact canonical scope, explicit authority mode, explicit materiality inputs, evidence, and a trusted receipt path.
- Missing, stale, unknown, malformed, or inconsistent authority data blocks the operation.
- Monthly close has an R2 floor, even if the engine derives a lower tier.
- One `/drenyra:continue` invocation completes at most one EDA phase. There is no continue-all path.
- Monetary data uses `bigint` cents in TypeScript and integer/decimal-string representations at JSON boundaries.
- Only public package exports of the pinned engine may be imported.

### Verified engine discrepancy

The planning inputs call the engine status set “14 states,” but the installed `drenyra-ai@0.2.0` declaration and runtime both expose **15** enum members: the listed set includes `RECOVERING`, `WAITING_FOR_EVIDENCE`, `BLOCKED_BY_GATE`, and `RETRYING` in addition to the original states. The design treats the installed pinned package as authoritative and derives exhaustive handling from `AccountingMissionStatus`; tests MUST assert the exact v0.2.0 set. The related spec wording/count must be corrected before implementation verification.

## 2. Architecture

### 2.1 Module dependency graph

```text
Pi host
  |
  v
extensions/register.ts  (only Pi entrypoint)
  |-- extensions/scope-guard.ts
  |-- extensions/mission-status.ts
  |-- extensions/startup-panel.ts
  |
  +--> chains/monthly-close.ts
  +--> chains/reconcile.ts
  +--> chains/verify.ts
  +--> chains/evidence.ts
          |
          v
      lib/chain-pipeline.ts
          |-- lib/accounting-status.ts
          |-- lib/authority-gates.ts
          |-- lib/authority-store.ts
          |-- lib/canonicalization.ts
          |-- lib/evidence-graph.ts
          |-- lib/mission-store.ts
          |-- lib/receipt-store.ts
          |-- lib/receipt-verification.ts
          `-- lib/trusted-key-registry.ts
                    |
                    v
 runtime/context.ts + runtime pin/doctor/status
                    |
                    v
 public drenyra-ai subpaths
 missions | candidates | gates | receipts | recovery

assets/ + contracts/ + prompts/ + skills/ + themes/ + agents/
  `-- packaged policy and operator content; never runtime authority by itself
```

Dependency direction is one-way. `lib/` may import public engine APIs and runtime scope types. `runtime/` does not import chains or extensions. Agents and text assets reference commands and contracts but do not authorize operations.

### 2.2 Command data flow

```text
operator command
  -> register.ts parses only command syntax
  -> scope-guard loads and validates scope
  -> canonicalization computes scopeHash
  -> authority preflight checks requested mode
  -> handler delegates to one lib operation or chain
  -> authoritative file stores are read
  -> deterministic operation runs
  -> structured result is persisted
  -> human summary + JSON result are rendered

Any failed stage -> structured denial -> no downstream mutation
```

Read-only bootstrap commands (`doctor`, `capabilities`, scope setup, and limited status diagnostics) use an explicit pre-scope policy. All mission, chain, evidence mutation, approval, and receipt-target commands require a complete valid scope.

### 2.3 Chain and mission lifecycle data flow

```text
validated scope
  -> canonical scope binding + scopeHash
  -> load/create durable mission
  -> select next PENDING MissionStep from persisted snapshot
  -> check phase applicability for mission intent
  -> run exactly one bounded phase operation
  -> append evidence and progress records
  -> when lifecycle state changes, use MissionRuntime.apply()
  -> run authority pipeline for the requested action
  -> create/verify approval receipt before protected execution
  -> perform one exact authorized target
  -> append action evidence
  -> archive step enters COMPLETED
  -> create signed completion receipt
  -> persist receipt and return new status
```

Steady-state phase progress does not invent a lifecycle transition. The durable coordinator atomically updates `MissionStep[]` and appends a `PROGRESS_UPDATE` event while retaining the current engine status. Lifecycle changes always pass through `MissionRuntime` and its transition validation.

### 2.4 Authority pipeline

```text
requested action
  -> [1] complete canonical scope + exact scopeHash
  -> [2] authority-mode monotonic check
  -> [3] explicit materiality input validation and derivation
  -> [4] MissionStateGate
  -> [5] ApprovalGate
  -> [6] trusted approval ReceiptGate
  -> execute exact bound target
  -> signed completion receipt

first non-allowed result stops the pipeline
```

The first three stages are harness gates because the engine `GateName` union has no scope or materiality names. Stages 4–6 wrap public engine gates. The harness returns one ordered result model across both groups.

## 3. Canonical scope and binding

### 3.1 Scope model

```ts
export const AUTHORITY_MODE = {
  ASK: "ASK",
  ANALYZE: "ANALYZE",
  PREPARE: "PREPARE",
  EXECUTE: "EXECUTE",
} as const;

export type AuthorityMode =
  (typeof AUTHORITY_MODE)[keyof typeof AUTHORITY_MODE];

export interface CanonicalScope {
  tenant: string;
  organization: string;
  company: string;
  fiscalPeriod: string;
  ledgerBook: string;
  operationType: string;
  sourceSnapshot: string;
  policyVersion: string;
  actor: string;
  authorityLevel: AuthorityMode;
}

export interface ScopeBinding {
  version: "drenyra.scope.v1";
  scope: CanonicalScope;
  canonical: string;
  scopeHash: string;
}
```

All ten fields are non-empty strings after normalization. `company` uses the existing full check-digit validator. `fiscalPeriod` is `YYYYMM` with month 01–12. Identifiers reject leading/trailing whitespace after normalization. `sourceSnapshot` is a lowercase SHA-256 digest of the frozen source manifest, not a path.

Legacy `{company: {ruc}, period: {period}}` data loads into a partial scope preserving both fields. It is reported as incomplete and cannot create, authorize, or execute a mission until the remaining fields are explicitly bound.

### 3.2 Exact canonical encoding

`canonicalizeScope` produces one UTF-8 JSON object with no insignificant whitespace. Keys are in this exact lexicographic order:

```text
actor
authorityLevel
company
fiscalPeriod
ledgerBook
operationType
organization
policyVersion
sourceSnapshot
tenant
```

The exact shape is:

```json
{"actor":"...","authorityLevel":"...","company":"...","fiscalPeriod":"...","ledgerBook":"...","operationType":"...","organization":"...","policyVersion":"...","sourceSnapshot":"...","tenant":"..."}
```

Rules:

1. Normalize each string to Unicode NFC before encoding.
2. Use JSON string escaping for quotes, reverse solidus, and control characters. Do not use a custom delimiter; JSON punctuation therefore cannot collide with field content.
3. Do not escape ordinary non-ASCII characters; encode the resulting string as UTF-8.
4. Emit no byte-order mark, trailing newline, optional property, `null`, or extra key.
5. Reject lone surrogate code points and non-string coercion.
6. Compute `scopeHash = sha256(utf8(canonical)).digest("hex")`; output is exactly 64 lowercase hexadecimal characters.

This explicit order is compatible with a key-sorted canonical JSON implementation while remaining reviewable across languages.

### 3.3 Binding records and receipts

```ts
export interface AuthorizationRecord {
  id: string;
  missionId: string;
  scopeHash: string;
  authorityMode: AuthorityMode;
  actionFamily: ActionFamily;
  actorId: string;
  decision: "GRANTED" | "DENIED";
  issuedAt: string;
  expiresAt?: string;
}

export interface ReceiptBinding {
  version: "drenyra.receipt-binding.v1";
  scopeHash: string;
  authorizationId: string;
  policyVersion: string;
  targetHash: string;
  evidenceHash: string;
}

export interface HarnessReceiptRecord {
  binding: ReceiptBinding;
  receipt: SignedReceipt;
}
```

The engine `SignedReceipt.content` shape cannot be extended without breaking the pinned receipt contract. Therefore the harness canonicalizes `ReceiptBinding`, hashes it, and places that digest in `receipt.content.payloadHash`. The scope hash is thereby signed transitively while the nested engine receipt remains byte-for-byte compatible. Verification recomputes the binding digest and rejects a mismatch. Authorization lookup also requires exact `scopeHash`, actor, action family, and mission identity.

Changing any scope field changes `scopeHash`; all old authorization records and receipts remain immutable historical evidence but are invalid for the new scope.

### 3.4 Canonicalization API and tests

`lib/canonicalization.ts` exports:

```ts
export function normalizeScope(scope: CanonicalScope): CanonicalScope;
export function validateCanonicalScope(scope: CanonicalScope): ScopeValidation;
export function canonicalizeScope(scope: CanonicalScope): string;
export function bindScope(scope: CanonicalScope): ScopeBinding;
export function canonicalizePayload(payload: unknown): string;
export function sha256Canonical(payload: unknown): string;
```

Tests cover exact golden bytes, escaping, NFC equivalence, lone-surrogate rejection, deterministic output, all ten single-field mutations, incomplete legacy load, and no float money at JSON boundaries.

## 4. EDA phase, engine state, and intent design

### 4.1 Two coordinated state dimensions

`AccountingMissionStatus` is the lifecycle authority. `MissionStep[]` records ordered EDA work. They are related but not one-to-one: several deterministic phases occur while the lifecycle remains `RUNNING` or `APPROVED`. A phase-only update MUST NOT fabricate an engine state transition.

Every mission is created with all 13 steps in the same order. Intent policy marks a phase as `required`, `conditional`, or `skip`. A skip is itself one deterministic continuation result and changes only that one step to `SKIPPED`.

### 4.2 Phase mapping

| # | EDA phase | Lifecycle before → after on successful phase | Required mode | Primary engine intent behavior |
| --- | --- | --- | --- | --- |
| 1 | intake | `DRAFT → QUEUED` via `MissionRuntime.apply(execute)` | ASK | All five intents capture instruction and source references. |
| 2 | bind-scope | `QUEUED → RUNNING` via runtime execute | ASK | All intents require complete scope and persist `scopeHash`. |
| 3 | ingest | `RUNNING` steady state; may enter `WAITING_FOR_EVIDENCE` | ANALYZE | Required for all; invoice review may ingest one bounded invoice set. |
| 4 | normalize | `RUNNING` steady state | ANALYZE | Required for all; deterministic normalization only. |
| 5 | classify | `RUNNING` steady state | ANALYZE | Required for all; classification output cites evidence. |
| 6 | reconcile | `RUNNING` steady state; discrepancies may enter `WAITING_FOR_EVIDENCE` | ANALYZE | Required for monthly-close and reconciliation; conditional for correction, invoice-review, compliance-check. |
| 7 | investigate | `RUNNING` steady state; unresolved input may enter `WAITING_FOR_EVIDENCE` | ANALYZE | Required for all; anomaly-refutation applies before elevation. |
| 8 | propose | `RUNNING` steady state | PREPARE | Produces a candidate only. Conditional no-op proposals are explicitly skipped. |
| 9 | verify | `RUNNING` steady state; failed policy may enter `BLOCKED_BY_GATE` | ANALYZE | Required for all; checks source integrity and intent-specific controls. |
| 10 | approve | `RUNNING → AWAITING_APPROVAL`; human command yields `APPROVED`, `REJECTED`, or revision flow | PREPARE | Required when a candidate or protected action exists; otherwise one explicit skip. |
| 11 | execute | `APPROVED` steady state; terminal failure is allowed | EXECUTE | Monthly close executes the exact approved export/close target; correction executes only approved correction; other intents execute only their bounded approved target or skip. |
| 12 | close | `APPROVED` steady state | EXECUTE | Final deterministic checks and output sealing; no new business scope. |
| 13 | archive | `APPROVED → COMPLETED` via runtime execute | EXECUTE | All intents seal evidence, receipt references, and immutable result metadata. |

The wait-state return path is always engine-legal: `WAITING_FOR_EVIDENCE → RUNNING`; gate resolution uses `BLOCKED_BY_GATE → RUNNING` or `AWAITING_APPROVAL`. Rejection uses `AWAITING_APPROVAL → REJECTED → REVISION_REQUESTED → QUEUED`, preserving the engine's revision path. Interrupted `RUNNING` missions recover through `UNKNOWN` according to engine policy. `RECOVERING` and `RETRYING` are used only when the engine recovery policy selects them; they are never ordinary phase markers. `BLOCKED` represents manual intervention, and `FAILED` is terminal.

### 4.3 Intent applicability matrix

| Phase group | monthly-close | correction | reconciliation | invoice-review | compliance-check |
| --- | --- | --- | --- | --- | --- |
| intake, bind-scope, ingest, normalize, classify | required | required | required | required | required |
| reconcile | required | conditional | required | conditional | conditional |
| investigate, verify | required | required | required | required | required |
| propose | required when adjustment/output exists | required | required when discrepancy exists | conditional | conditional |
| approve | required for protected candidate | required | materiality-driven | materiality-driven | materiality-driven |
| execute | approved close target | approved correction only | approved reconciliation output only | approved review output only | approved compliance output only |
| close, archive | required | required | required | required | required |

“Conditional” is resolved only from persisted evidence and policy, never model confidence. All skipped phases remain visible in `MissionStep[]`.

### 4.4 Step coordinator API

`lib/accounting-status.ts` and `lib/chain-pipeline.ts` expose:

```ts
export const EDA_PHASE = { /* 13 runtime constants */ } as const;
export type EdaPhase = (typeof EDA_PHASE)[keyof typeof EDA_PHASE];

export interface PreparedStep {
  missionId: string;
  expectedMissionVersion: number;
  phase: EdaPhase;
  intent: MissionIntent;
  scopeHash: string;
  disposition: "RUN" | "SKIP" | "WAIT";
}

export function createEdaSteps(intent: MissionIntent): MissionStep[];
export function derivePreparedStep(snapshot: MissionSnapshot): PreparedStep | null;
export async function executePreparedStep(
  input: ExecutePreparedStepInput,
): Promise<ExecutePreparedStepResult>;
```

The coordinator uses optimistic versioning and an idempotency key derived from mission ID, phase ID, mission version, scope hash, and target hash. It completes at most one step. A changed scope hash invalidates the prepared step before any write.

## 5. Authority design

### 5.1 Mode ordering and action families

```ts
export const AUTHORITY_ORDER: Readonly<Record<AuthorityMode, number>>;

export const ACTION_FAMILY = {
  QUERY: "QUERY",
  INVESTIGATE: "INVESTIGATE",
  PREPARE_CANDIDATE: "PREPARE_CANDIDATE",
  APPROVE: "APPROVE",
  EXECUTE_TARGET: "EXECUTE_TARGET",
} as const;

export function requiredModeFor(action: ActionFamily): AuthorityMode;
export function assertMonotonicAuthority(
  granted: AuthorityMode,
  required: AuthorityMode,
): void;
```

`ASK` permits query and cited explanation. `ANALYZE` adds investigation, classification, reconciliation, and verification. `PREPARE` adds candidate and review-package creation. `EXECUTE` adds only exact approved targets. Inspection never changes the bound mode.

### 5.2 Explicit materiality rule

```ts
export interface ExplicitMaterialityRequest {
  input: MaterialityInput;
  minimum?: Materiality;
}

export function deriveRequiredMateriality(
  request: ExplicitMaterialityRequest,
): Materiality;
```

The harness never invokes `ApprovalGate` until a complete engine `MaterialityInput` has been validated. No harness default exists. Missing bigint cents, reversibility, or jurisdiction returns a blocking `materiality-input-missing` result. The derived tier is `deriveMateriality(input)`, raised to `minimum` when policy requires a floor. Monthly close always supplies `minimum: "R2"`.

Read-only ASK/ANALYZE actions that do not evaluate `ApprovalGate` do not invent materiality; the pipeline records the approval and receipt stages as not applicable. PREPARE and EXECUTE actions require explicit materiality.

### 5.3 Pipeline contract

`lib/authority-gates.ts` exports:

```ts
export interface AuthorityGateInput {
  binding: ScopeBinding;
  authorization: AuthorizationRecord;
  action: ActionFamily;
  mission: MissionSnapshot;
  targetStatus: AccountingMissionStatus;
  materiality?: ExplicitMaterialityRequest;
  approvals: ApprovalRecord[];
  approvalReceipt?: SignedReceipt;
  trustedKeys: SigningKeyInfo[];
}

export interface AuthorityGateResult {
  stage: "scope" | "mode" | "materiality" | "mission" | "approval" | "receipt";
  verdict: "allowed" | "blocked" | "needs_input" | "not_applicable";
  reason: string;
  envelope?: unknown;
}

export async function runAuthorityPipeline(
  input: AuthorityGateInput,
): Promise<readonly AuthorityGateResult[]>;
```

Fixed evaluation order:

1. **Scope** — complete, canonical hash recomputes, and matches mission, authorization, target, and receipt binding.
2. **Mode** — authorization actor/action/scope match and bound mode meets the required mode.
3. **Materiality** — explicit input is validated and derived for candidate-bearing actions; monthly-close floor applied.
4. **Mission** — wrap `MissionStateGate` for an exact current snapshot and target state.
5. **Approval** — wrap `ApprovalGate` with the derived tier and persisted approval records.
6. **Receipt** — wrap `ReceiptGate` with a non-empty explicit trusted-key list and the approval receipt.

A `GateRunner` is used for the contiguous engine gate segment when all stages apply. The harness checks and translates each result without weakening `needs_input`. It stops at the first non-allowed verdict. `ReceiptGate` is never called without `trustedKeys`; this removes the engine's embedded-key self-trust fallback.

For PREPARE, stages 5–6 are not applicable because the output is only a candidate. For EXECUTE, all six stages are mandatory. After successful execution, a separate completion receipt is created and persisted; it does not retroactively authorize its own action.

### 5.4 Authorization store

`lib/authority-store.ts` stores append-only records at:

```text
<workspace>/.local/authority/<mission-id>.ndjson
```

It exports `appendAuthorization`, `listAuthorizations`, and `findBoundAuthorization`. IDs and mission IDs are validated before path construction. Duplicate record IDs are accepted only when canonical bytes are identical; conflicting replay blocks.

Tests exhaustively cover the mode matrix, exact stage order, first-failure stop, missing inputs, R2 monthly close, R3 distinct approvers, stale scope, mismatched actor, and absence of trusted keys.

## 6. Trusted keys and receipt verification

### 6.1 Registry storage

The registry is workspace-local:

```text
<workspace>/.local/trusted-keys.json
```

```ts
export interface TrustedKeyRegistryDocument {
  schemaVersion: 1;
  keys: Record<string, SigningKeyInfo>;
}
```

The map key MUST equal `SigningKeyInfo.keyId`. Public keys are base64-encoded Ed25519 public keys. Dates are canonical ISO-8601 instants. Unknown properties, malformed keys, duplicate semantic IDs, invalid date order, expired entries, and revoked entries fail validation. Private keys are never stored in this registry.

Writes use a unique temporary file, file sync, rename, and parent-directory sync. The registry is read fresh for each protected verification so revocation takes effect immediately. Symlinks and paths outside the workspace root are rejected.

### 6.2 Verification path

`lib/trusted-key-registry.ts` exports:

```ts
export class TrustedKeyRegistry {
  constructor(filePath?: string);
  load(): Promise<TrustedKeyRegistryDocument>;
  resolve(keyId: string): Promise<SigningKeyInfo | undefined>;
  put(info: SigningKeyInfo): Promise<void>;
}
```

`lib/receipt-verification.ts` exports:

```ts
export interface VerifyHarnessReceiptInput {
  record: HarnessReceiptRecord;
  expectedScope: ScopeBinding;
  expectedMissionId: string;
  expectedActorId?: string;
  expectedPolicyVersion?: string;
  expectedTargetHash?: string;
}

export interface HarnessReceiptVerification {
  valid: boolean;
  engineStatus: ReceiptVerificationStatus;
  bindingValid: boolean;
  scopeValid: boolean;
  targetValid: boolean;
  reasons: string[];
}

export async function verifyHarnessReceipt(
  input: VerifyHarnessReceiptInput,
  registry: TrustedKeyRegistry,
): Promise<HarnessReceiptVerification>;
```

Verification order is schema → engine content hash → Ed25519 signature → registry lookup and key match → key lifecycle → binding digest → scope, mission, actor, policy, evidence, and target expectations. Unknown key ID returns `UNKNOWN_SIGNER` and blocks. No path falls back to the public key embedded in the receipt.

`lib/receipt-store.ts` persists immutable `HarnessReceiptRecord` documents at `.local/receipts/<receipt-hash>.json`. An existing identical record is an idempotent replay; differing bytes at the same identity are corruption and block.

Tests use generated keys and cover valid, tampered content, tampered binding, wrong scope, wrong target, unknown signer, expired key, revoked key, and embedded-key-only rejection.

## 7. Evidence graph

### 7.1 Storage

Each mission has one append-only log:

```text
<workspace>/.local/evidence/<mission-id>.ndjson
```

Every line is one complete UTF-8 JSON record with no byte-order mark:

```ts
export const EVIDENCE_RECORD_KIND = {
  NODE: "node",
  EDGE: "edge",
} as const;

export const EVIDENCE_NODE_KIND = {
  SOURCE: "source",
  TRANSFORMATION: "transformation",
  CONCLUSION: "conclusion",
  ACTION: "action",
} as const;

export interface EvidenceNode {
  schemaVersion: 1;
  recordKind: "node";
  id: string;
  missionId: string;
  nodeKind: EvidenceNodeKind;
  payload: unknown;
  payloadHash: string;
  createdAt: string;
}

export interface EvidenceEdge {
  schemaVersion: 1;
  recordKind: "edge";
  id: string;
  missionId: string;
  from: string;
  to: string;
  relation: "DERIVED_FROM" | "SUPPORTS" | "EXECUTES";
  createdAt: string;
}
```

Payload hashes are lowercase SHA-256 over `canonicalizePayload(payload)`. IDs are immutable. A duplicate ID is allowed only if its canonical record is byte-identical. No update or delete API exists. Each append opens with no-follow semantics where available, appends one line, and syncs the file before success.

### 7.2 Graph invariants

- Every edge endpoint exists in the same mission.
- Edges cannot create a cycle.
- A conclusion must have at least one incoming path from a source or transformation.
- An action must reference a supporting conclusion and must have a complete source-to-action lineage.
- Payload integrity is recomputed on every load used for authorization or receipt creation.
- Cross-mission edges are rejected.
- A malformed or truncated line makes the graph unavailable for authority decisions; repair is explicit and never automatic.

### 7.3 Receipt evidence binding

Graph nodes are projected to engine `EvidenceItem` records using `{id, label, type}`. The selected evidence closure is deduplicated by ID and passed to engine `computeEvidenceHash`, which sorts by ID. Selection policy includes every ancestor of the protected conclusion/action. The resulting hash is stored in the proposal, receipt binding, and engine receipt content.

### 7.4 API and tests

`lib/evidence-graph.ts` exports:

```ts
export class EvidenceGraphStore {
  appendNode(input: AppendEvidenceNodeInput): Promise<EvidenceNode>;
  appendEdge(input: AppendEvidenceEdgeInput): Promise<EvidenceEdge>;
  load(missionId: string): Promise<EvidenceGraph>;
  lineage(missionId: string, nodeId: string): Promise<EvidenceLineage>;
  validate(missionId: string): Promise<EvidenceGraphValidation>;
  computeReceiptEvidenceHash(
    missionId: string,
    terminalNodeIds: readonly string[],
  ): Promise<string>;
}
```

Tests cover insertion-order stability, full lineage, duplicate replay, conflicting duplicate rejection, cycles, missing endpoints, uncited conclusions, ungrounded actions, payload tampering, truncated logs, and mission path traversal.

## 8. Durable mission adapters

### 8.1 Layout

All mission data is workspace-local:

```text
.local/missions/
  snapshots/<mission-id>.json
  events/<mission-id>.ndjson
  idempotency/<sha256-of-key>.json
  recovery/<mission-id>.json
```

The adapters implement only public engine ports and never import the unexported `MissionFileStore`.

### 8.2 API

`lib/mission-store.ts` exports:

```ts
export const MISSION_STORE_SCHEMA_VERSION = 1;

export class FileMissionStore implements MissionStore {
  save(snapshot: MissionSnapshot): Promise<void>;
  findById(id: string): Promise<MissionSnapshot | undefined>;
  findByStatus(statuses: AccountingMissionStatus[]): Promise<MissionSnapshot[]>;
  list(): Promise<MissionSnapshot[]>;
}

export class FileMissionEventStore implements MissionEventStore {
  append(event: MissionEvent): Promise<void>;
  list(missionId: string): Promise<MissionEvent[]>;
}

export class FileIdempotencyStore implements IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  put(record: IdempotencyRecord): Promise<void>;
}

export interface DurableMissionStores {
  store: FileMissionStore;
  events: FileMissionEventStore;
  idempotency: FileIdempotencyStore;
}

export function createDurableMissionStores(root?: string): DurableMissionStores;
export async function recoverDurableMissions(
  runtime: MissionRuntime,
  stores: DurableMissionStores,
): Promise<RecoveryReport>;
```

### 8.3 Durability and replay rules

Snapshot and idempotency writes use unique temp file → write → file sync → rename → directory sync. Event records are append-only and synced before return. Stored documents use schema envelopes and are validated before use. IDs must match a conservative identifier pattern and never become raw paths.

`MissionRuntime` writes snapshot, event, then completed idempotency state. A crash can therefore expose a partial command across those three ports. Recovery is fail-closed:

1. Load and validate the event log as the replay source.
2. Compare the replayed snapshot identity/version with the snapshot file.
3. If equal, preserve it.
4. If a snapshot is ahead of its event log or an idempotency record remains `EXECUTING` without a complete visible result, mark the mission recovery record unresolved and use engine recovery to reach `UNKNOWN` where legal; do not re-run the command.
5. Resolve `UNKNOWN` only from persisted event/evidence facts through the engine recovery policy.
6. Never auto-advance human-wait or terminal states.

A repeated completed idempotency key returns the cached result. Reuse with a different canonical payload remains an engine `IdempotencyConflict`. Store corruption and mixed schema versions block with an export/recovery diagnostic rather than silently resetting data.

Tests simulate restart after each durable boundary, completed replay, conflicting replay, stale optimistic version, truncated events, unknown schema, human-wait preservation, terminal preservation, and recovery to `UNKNOWN`.

## 9. Accounting status

`lib/accounting-status.ts` is a read-only projection. It combines runtime verification, scope completeness/hash, active mission, engine predicates, EDA next step, evidence summary, anomalies, approvals, and the next authorized action.

```ts
export interface AccountingStatusView {
  runtime: RuntimeStatus;
  scope: ScopeStatus;
  mission?: MissionStatusView;
  evidence: EvidenceStatusView;
  authority: AuthorityStatusView;
  nextAuthorizedAction?: NextAuthorizedAction;
}

export async function buildAccountingStatus(
  input: AccountingStatusInput,
): Promise<AccountingStatusView>;
```

It uses `isRunnable`, `isResumable`, `isAwaitingApproval`, `isWaitingForHuman`, and `waitReasonFor`; it never infers readiness from chat. Tests cover every installed engine state, including the verified 15-member enum, and ensure no unknown state silently maps to runnable.

## 10. Extension composition

### 10.1 Entry point decision

`extensions/register.ts` remains the only Pi entrypoint and composes:

- `scope-guard.ts` — per-command policy, scope loading, canonical binding, and fail-closed errors;
- `mission-status.ts` — status/capabilities rendering and structured result helpers;
- `startup-panel.ts` — activation-time status presentation.

Because Pi treats files in an extension directory as potential entrypoints, `package.json` changes `pi.extensions` from the directory to the exact file `./dist/extensions/register.js`. Helper modules have named exports only and are imported by `register.ts`.

### 10.2 Minimal host API and startup panel

The verified local structural slice exposes `registerCommand` and command-time `cwd`; it does not establish a safe `ctx.ui` activation surface. The design therefore does **not** add an unverified UI dependency.

On activation, `startup-panel.ts` prints one concise status banner through an injected output function. It reports pinned-runtime verdict and the default context's scope completeness. Rich rendering is optional only if a future, verified host adapter supplies a UI capability; command behavior never depends on it.

```ts
export interface StartupPanelDeps {
  writeLine(line: string): void;
  packageRoot: string;
  contextStore: ScopeContextStore;
}

export async function showStartupPanel(deps: StartupPanelDeps): Promise<void>;
```

The default extension factory becomes async, registers commands first, then emits the banner. Banner failure is rendered as degraded status and does not grant mission capability.

### 10.3 Registration composition

`register.ts` owns command names and syntax only. Every handler follows:

```text
parse -> scope policy -> lib/chain call -> structured render
```

The 14 intended commands plus legacy `company` and `context` are registered. `status`, `doctor`, `capabilities`, `scope`, `company`, `period`, `context`, and `models` have explicit bootstrap/read policies. Mission mutation commands require complete scope. `continue` invokes one prepared phase only. `receipt verify` is local and trusted-registry-backed.

Extension tests assert exact registration, one entrypoint, scope policy for every command, output structure, activation fallback, and no fiscal logic in handlers.

## 11. Shared chain design

### 11.1 Shared pipeline

`lib/chain-pipeline.ts` exports:

```ts
export interface ChainDefinition<I, O> {
  name: string;
  intent: MissionIntent;
  requiredMode: AuthorityMode;
  runStep(context: ChainStepContext<I>): Promise<ChainStepOutcome<O>>;
}

export async function runChainStep<I, O>(
  definition: ChainDefinition<I, O>,
  input: ChainRunInput<I>,
): Promise<ChainRunResult<O>>;
```

The function always performs scope validation → mission load/start → one phase operation → applicable authority gates → receipt persistence. It accepts no unbounded loop and no continue-all flag.

### 11.2 Monthly close

`chains/monthly-close.ts` is upgraded to:

- use durable stores and the full EDA step plan;
- require complete ten-field scope and explicit materiality input with R2 floor;
- ingest source references rather than chat blobs;
- create real proposals using the graph-derived evidence hash;
- enter evidence and gate wait states when required;
- verify a trusted approval receipt before exact execution;
- seal output during close and enter `COMPLETED` only at archive;
- persist a completion receipt bound to scope, evidence, policy, actor, and target.

Ephemeral per-run signing keys are removed. Signing keys are supplied by an explicit signing provider; public trust metadata must already exist in the registry. Private key storage is outside the trusted-public-key registry and must be injected by the operator/runtime adapter.

### 11.3 Reconcile chain

`chains/reconcile.ts` uses intent `reconciliation`. It ingests a bounded source manifest, normalizes deterministically, computes reconciliation results with bigint cents, records discrepancies as conclusions, invokes anomaly refutation, and either waits for evidence or creates an evidence-cited candidate. It cannot post adjustments on its own.

### 11.4 Verify chain

`chains/verify.ts` performs a fixed check list: source snapshot integrity, graph integrity, ledger equations, reconciliation correctness, scope binding, and receipt binding where applicable. It returns per-check verdicts and stops protected downstream work on the first blocking verdict. It does not mutate accounting outputs.

### 11.5 Evidence chain

`chains/evidence.ts` adds or queries graph records for the active mission. Add operations enforce node/edge schemas and lineage rules. Query operations are read-only. The chain never accepts a conclusion without supporting evidence references.

### 11.6 Chain tests

Each chain has colocated tests for deterministic happy paths, first-stage failure, evidence wait/resume, gate block, one-phase continuation, stale scope, idempotent replay, and receipt binding. Fixture sources are bounded and contain no external network dependency.

## 12. Agents

Exactly seven parseable Pi markdown definitions ship under `agents/` and are mirrored byte-for-byte under `assets/agents/`:

| Agent | Ceiling | Reads | Persists |
| --- | --- | --- | --- |
| accounting-scout | ANALYZE | scope and source references | source inventory |
| evidence-builder | ANALYZE | mission and source references | graph node/edge requests |
| ledger-analyst | ANALYZE | normalized ledger references | cited analysis |
| reconciliation-agent | ANALYZE | ledger and bank references | reconciliation result |
| tax-controller-pe | ANALYZE | policy and evidence references | cited compliance findings |
| anomaly-refuter | ANALYZE | finding and cited lineage | refutation outcome |
| close-controller | PREPARE | mission/status/evidence references | close readiness package |

All definitions share this contract:

1. Read the active scope binding and mission ID first; stop on mismatch or incomplete scope.
2. Read mission/evidence artifacts by stable references from the file-backed backend; do not receive copied source blobs in prompts.
3. Cite evidence node IDs for every conclusion.
4. Use broad-deny permissions with only role-required read/query and bounded artifact-write capabilities.
5. Never grant authority, sign a receipt, or perform EXECUTE work.
6. Persist the role artifact before responding. Best-effort memory may receive a reference, but memory failure neither authorizes work nor replaces the file artifact.
7. The anomaly refuter must attempt falsification before a finding can be elevated.

Agent conformance tests parse frontmatter, compare mirrors, inspect authority ceilings and permissions, and assert the common contract appears in every definition.

## 13. Contracts, assets, prompts, skills, and theme

### 13.1 Contracts

Versioned JSON Schemas ship under:

```text
contracts/mission/
contracts/evidence/
contracts/authority/
contracts/receipts/
```

They cover engine-compatible mission payloads, evidence records, authority/scope records, the exact nested `SignedReceipt`, `ReceiptBinding`, and trusted-key registry. Representative engine fixtures validate against the harness schemas. No schema deep-imports package internals.

### 13.2 Assets

```text
assets/agents/       mirrored seven role definitions
assets/chains/       monthly-close, reconcile, verify, evidence operator maps
assets/policies/     authority, evidence, closed-period, and v0.1 boundary policies
assets/schemas/      distributable scope, evidence, authority envelope schemas
```

Policy assets encode all v0.1 non-goals: no autonomous filing with the national tax service, no irreversible posting without approval, no uncited interpretation, no material tax decision from an LLM alone, no replacement of the responsible professional, and no silent closed-period modification. Post-v0.1 roadmap behavior is absent and explicitly denied.

### 13.3 Skills, prompts, and theme

- `skills/`: three focused skills — scope discipline, evidence citation, and chain operation.
- `prompts/`: one operator persona plus prompts aligned to all 14 intended commands. Prompts instruct; they never bypass runtime checks.
- `themes/`: one `fiscal-operator` theme with light and dark variants in one manifest-resolved asset.

Package tests assert real non-placeholder content, command-prompt alignment, policy coverage, theme resolution, and shipped paths.

## 14. Build and public exports

New `lib/` modules remain package-internal in v0.1. No `./lib/*` export is added, avoiding a premature semver commitment. Existing public exports remain `.` , `./runtime`, and `./extensions`.

To guarantee shipping independent of incidental imports:

- add `lib`, `chains`, and the exact extension source set to `tsconfig.json` and `tsconfig.build.json` includes;
- keep `register.ts` as the only manifest entrypoint;
- use `.js` suffixes for local ESM imports;
- update `scripts/verify-package-files.mjs` to assert emitted modules, declarations, contracts, agents, prompts, skills, theme, and assets;
- keep package directories in `package.json.files` and change `pi.extensions` to the exact compiled entry file.

This is safer than relying on an `extensions/index.ts` that does not currently exist. A private `lib/index.ts` barrel may be used for internal composition, but explicit build roots remain authoritative.

## 15. Security and audit notes

- **Fail closed:** incomplete scope, absent materiality input, stale mission version, unknown signer, empty trusted-key list, malformed graph, mixed schema version, or runtime pin failure blocks protected work.
- **Immutable evidence:** evidence and authorization logs are append-only. Receipts are immutable files addressed by receipt hash. Corrections create new records linked to prior identities.
- **Scope invalidation:** every prepared step and target carries `scopeHash`; a reloaded mismatch invalidates the action before mutation.
- **Receipt separation:** approval receipts authorize exact targets; completion receipts prove results. A completion receipt never self-authorizes its preceding action.
- **No embedded trust:** an embedded receipt public key proves internal signature consistency only and is never sufficient for fiscal authority.
- **No path trust:** runtime resolution stays package-local; store identifiers are validated and cannot traverse paths; symlink escapes are rejected.
- **No memory authority:** memory can index references and summaries only. File-backed mission, evidence, authorization, key, and receipt state decides.
- **No model authority:** model output is untrusted proposal data until deterministic checks, evidence binding, and professional approval succeed.
- **Closed-period protection:** any correction is a new `correction` mission with new scope binding, evidence, approval, and receipts.
- **Audit timestamps:** timestamps are evidence, not identity. Hashes, versions, stable IDs, and append order provide identity and ordering.
- **Schema migration:** unknown future versions block. Migration is explicit, tested, and never performed during a protected command.

## 16. Module test strategy summary

| Module | Primary tests |
| --- | --- |
| canonicalization | golden bytes, escaping, normalization, ten-field sensitivity |
| accounting-status | every installed engine state, wait reason, next action |
| authority-gates | full mode matrix, stage order, materiality missing, R2 floor, trusted receipt |
| authority-store | append-only replay, conflicts, path safety |
| evidence-graph | lineage, hashes, cycles, citations, tampering, truncation |
| mission-store | atomic boundaries, restart, replay, conflict, recovery |
| trusted-key-registry | schema, unknown/expired/revoked, atomic update |
| receipt-verification/store | engine vectors, binding mismatch, immutability |
| chain-pipeline | one step, first failure, stale scope, idempotency |
| extension modules | command list, guard policy, thin delegation, startup degradation |
| chains | fixture lifecycle, wait/resume, gate block, signed completion |
| agents/assets | parsing, mirror equality, policy and package conformance |

Strict TDD applies per slice: RED → GREEN → TRIANGULATE → REFACTOR. Existing tests remain green after every work unit.

## 17. Implementation order and chained slices

### S1 — Contracts, complete scope, canonicalization

Implement contract schemas, extend `runtime/context.ts`, and add `canonicalization.ts`. This establishes stable identities used by every later gate and store. Include exact canonical golden vectors and legacy partial-load behavior.

**Dependency rationale:** no authorization, mission, evidence, or receipt can be safely built before exact scope identity exists.

### S2 — Authority and status

Implement `authority-gates.ts`, `authority-store.ts`, and `accounting-status.ts`. Add the exhaustive mode matrix, explicit materiality path, monthly-close R2 floor, and ordered wrapper around engine gates.

**Dependency rationale:** chains and commands need a single fail-closed policy surface before they can mutate durable state.

### S3 — Durable missions, evidence, and receipts

First work unit: `mission-store.ts`, durable runtime composition, recovery, and the monthly-close phase-plan upgrade. Second work unit: `evidence-graph.ts`, `trusted-key-registry.ts`, `receipt-store.ts`, and `receipt-verification.ts`.

**Dependency rationale:** durable mission identity precedes evidence logs; evidence and trusted receipt bindings precede protected execution. Splitting S3 limits review load without separating behavior from tests.

### S4 — Extension modules and complete commands

First work unit: scope guard, status projection, startup banner, capabilities/scope/models, exact entrypoint packaging. Second work unit: mission, continue, resume, evidence, verify, receipt, and reconcile handlers.

**Dependency rationale:** handlers remain thin because all durable and authority behavior already exists. The entrypoint change lands with registration tests.

### S5 — Reconcile, verify, and evidence chains

Implement the shared chain pipeline, then reconcile, verify, and evidence chains; finish the full monthly-close fixture flow. Split reconcile from verify/evidence if the review forecast exceeds the bounded PR budget.

**Dependency rationale:** these chains compose S1–S4 contracts rather than inventing parallel scope, state, or gate logic.

### S6 — Agents and packaged operating content

Replace stubs with seven agents, mirrored assets, policies, schemas, three skills, command/persona prompts, and one theme. Extend package verification.

**Dependency rationale:** prompts and roles must point to stable command, scope, evidence, and authority contracts. Shipping them earlier would encode unstable behavior.

### Delivery boundaries

The implementation is a chained series of independently testable PRs. Each PR contains behavior, tests, and required docs together. No slice may weaken gates to ease rollout. A failed work unit is reverted as a unit while immutable receipts and evidence remain untouched.

## 18. Design decisions resolved

| Decision | Resolution |
| --- | --- |
| EDA mapping | Ordered 13-step plan orthogonal to the engine lifecycle; exact mapping above; one phase per continuation; all five intents use one applicability policy. |
| Engine status count | Pinned v0.2.0 exposes 15 members, not 14; derive exhaustiveness from the installed enum and correct spec counts. |
| Canonical scope | NFC-normalized, exact lexicographic-key compact JSON; JSON escaping; UTF-8 SHA-256 lowercase hex. |
| Scope in receipts | `ReceiptBinding` contains scope hash; its canonical digest is signed as engine `payloadHash`, preserving exact `SignedReceipt` compatibility. |
| Authority pipeline | scope → mode → explicit materiality → mission → approval → trusted receipt; first non-allowed stops. |
| Materiality | No harness default; complete engine input required; monthly close has R2 floor. |
| Trusted keys | Workspace `.local/trusted-keys.json`, public Ed25519 metadata by key ID, fresh lookup, unknown blocks. |
| Evidence graph | Append-only per-mission NDJSON under `.local/evidence/`, canonical node hashes, acyclic lineage, engine id-sorted receipt hash. |
| Mission persistence | Local public-port adapters under `.local/missions/`, atomic snapshot/idempotency writes, synced event logs, fail-closed recovery. |
| Library boundary | Nine internal modules plus private barrel if useful; no public `./lib/*` export in v0.1; explicit build roots. |
| Extension split | `register.ts` is the exact sole entrypoint; three named helper modules compose under it. |
| Startup UI | No unverified `ctx.ui`; activation prints a concise status banner and can later accept an optional verified UI adapter. |
| Chains | Shared single-step scope → mission → gate → receipt pipeline; monthly close upgraded; reconcile, verify, and evidence added. |
| Agents | Seven bounded markdown agents, reference-based reads, evidence citations, broad-deny posture, persist-before-respond. |
| Assets | Real contracts, agents, chain maps, policies, schemas, prompts, three skills, and one light/dark theme; v0.1 non-goals encoded as policy. |

## 19. Risks carried into tasks

1. The mission spec's status count conflicts with the pinned package and must be corrected without changing the actual listed states.
2. Phase-only snapshot/event persistence must be implemented as a carefully tested durable coordinator so it cannot bypass engine lifecycle validation.
3. The engine receipt type has no direct scope-hash field; conformance tests must prove the signed binding-through-`payloadHash` design.
4. Cross-file atomicity is not provided by the engine ports; crash tests must validate the fail-closed `UNKNOWN` recovery path.
5. Rich Pi UI remains unverified; only the activation banner is committed for v0.1.
6. The full change remains well above one reviewable diff and must retain the chained slice boundaries.
