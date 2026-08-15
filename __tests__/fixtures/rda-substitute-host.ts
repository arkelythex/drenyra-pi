/**
 * Independent substitute host for the two-host replacement harness
 * (pi-sdd-040-adapter-boundary, WU2; design §4.2/§4.3).
 *
 * This module consumes ONLY the public pinned kernel surface plus the shared
 * fixture: `drenyra-ai/missions`, `drenyra-ai/candidates`, `drenyra-ai/gates`,
 * `drenyra-ai/receipts`, and `./rda-replacement-fixture.js`. It MUST NOT
 * import Pi's `chains/`, `lib/`, `runtime/`, `extensions/`, stores, built
 * output, or package root — the harness anti-circularity test (REQ-HARNESS-002)
 * asserts that closure. `node:crypto` is used only for the minimal canonical
 * serialization/hashing the host needs to mirror Pi's binding bytes.
 *
 * The host constructs an in-memory mission runtime, derives materiality through
 * the kernel, runs mission/approval/receipt gates in declared order, builds and
 * verifies the completion receipt through the kernel, and returns raw
 * artifacts. The phase driver is bounded by the 13 EDA phases plus finite
 * continuation slack (no unbounded loop).
 *
 * Fiscal convention: monetary values are BigInt cents; no float is ever used.
 * Digests are lowercase hex sha-256.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  AccountingMissionStatus,
  IntentRegistryImpl,
  InMemoryIdempotencyStore,
  InMemoryMissionEventStore,
  InMemoryMissionStore,
  MissionEventType,
  MissionRuntime,
  type BoundMissionCommand,
  type IntentHandler,
  type IntentRegistry,
  type MissionEvent,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import {
  deriveMateriality,
  orderOf,
  type Materiality,
  type MaterialityInput,
} from "drenyra-ai/candidates";
import {
  ApprovalGate,
  GateRunner,
  MissionStateGate,
  ReceiptGate,
  type GateResult,
} from "drenyra-ai/gates";
import {
  buildSignedReceipt,
  computeEvidenceHash,
  generateReceiptKeyPair,
  verifySignedReceipt,
  type EvidenceItem,
  type ReceiptType,
  type SignedReceipt,
  type SigningKeyInfo,
} from "drenyra-ai/receipts";
import type { RdaReplacementFixture } from "./rda-replacement-fixture.js";

/** The 13 canonical EDA phases in declared order (REQ-MISS-001). */
export const EDA_STEPS: readonly { id: string; name: string }[] = [
  { id: "intake", name: "Intake" },
  { id: "bind-scope", name: "Bind scope" },
  { id: "ingest", name: "Ingest" },
  { id: "normalize", name: "Normalize" },
  { id: "classify", name: "Classify" },
  { id: "reconcile", name: "Reconcile" },
  { id: "investigate", name: "Investigate" },
  { id: "propose", name: "Propose" },
  { id: "verify", name: "Verify" },
  { id: "approve", name: "Approve" },
  { id: "execute", name: "Execute" },
  { id: "close", name: "Close" },
  { id: "archive", name: "Archive" },
];

/** Lifecycle phases advance through the engine; the rest advance phase-only. */
const LIFECYCLE_PHASES: ReadonlySet<string> = new Set([
  "intake",
  "bind-scope",
  "archive",
]);

/** Upper bound for the run: 13 phases plus gate/evidence resolution slack. */
const MAX_ADVANCES = 16;

/** A canonical scope with the ten elements (design §4.3). */
export interface HostScopeElements {
  tenant: string;
  organization: string;
  company: string;
  fiscalPeriod: string;
  ledgerBook: string;
  operationType: string;
  sourceSnapshot: string;
  policyVersion: string;
  actor: string;
  authorityLevel: string;
}

/** One ordered kernel gate verdict (design §4.4 `gates`). */
export type HostGateStage = "mission" | "approval" | "receipt";
export type HostGateVerdict = "allowed" | "blocked" | "needs_input";

export interface HostGateVerdictRecord {
  order: number;
  stage: HostGateStage;
  verdict: HostGateVerdict;
}

/** The raw host authority result projected by the harness (design §4.4). */
export interface SubstituteHostResult {
  hostMissionId: string;
  scope: {
    elements: HostScopeElements;
    scopeHash: string;
  };
  evidence: {
    items: EvidenceItem[];
    evidenceHash: string;
  };
  policyVersion: string;
  materiality: {
    input: MaterialityInput;
    declaredMinimum: Materiality;
    kernelTier: Materiality;
    effectiveTier: Materiality;
  };
  gates: HostGateVerdictRecord[];
  candidate: {
    targetHash: string;
    contentHash: string;
    content: {
      intent: string;
      company: string;
      fiscalPeriod: string;
      evidenceHash: string;
      policyVersion: string;
      operation: string;
      payload: unknown;
    };
  };
  approval: {
    humanApproverId: string;
    candidateContentHash: string;
    evidenceHash: string;
  };
  receipt: {
    type: ReceiptType;
    missionId: string;
    binding: {
      scopeHash: string;
      evidenceHash: string;
      policyVersion: string;
      targetHash: string;
    };
    claims: {
      company: string;
      actor: string;
      decision: string;
      evidenceHash: string;
      previousStatus: string;
      newStatus: string;
      payloadHash: string;
    };
    verified: boolean;
  };
  unknownHandling: {
    attemptsAfterUnknown: number;
  };
  terminal: {
    missionStatus: string;
  };
  /**
   * Runtime-generated, non-authoritative artifacts (design §4.5): generated
   * ids, timestamps, and ephemeral signing material. The canonical projection
   * NEVER includes these fields — they are documented normalization exclusions.
   */
  runtimeMetadata: {
    missionId: string;
    missionCreatedAt: string;
    missionUpdatedAt: string;
    receiptHash: string;
    signerKeyId: string;
    signature: string;
    issuedAt: string;
  };
}

/** The canonical scope JSON with the exact key order Pi's binding uses. */
function canonicalScopeJson(scope: HostScopeElements): string {
  const parts = [
    `"actor":${JSON.stringify(scope.actor)}`,
    `"authorityLevel":${JSON.stringify(scope.authorityLevel)}`,
    `"company":${JSON.stringify(scope.company)}`,
    `"fiscalPeriod":${JSON.stringify(scope.fiscalPeriod)}`,
    `"ledgerBook":${JSON.stringify(scope.ledgerBook)}`,
    `"operationType":${JSON.stringify(scope.operationType)}`,
    `"organization":${JSON.stringify(scope.organization)}`,
    `"policyVersion":${JSON.stringify(scope.policyVersion)}`,
    `"sourceSnapshot":${JSON.stringify(scope.sourceSnapshot)}`,
    `"tenant":${JSON.stringify(scope.tenant)}`,
  ];
  return `{${parts.join(",")}}`;
}

/** Lowercase hex sha-256 over the canonical scope bytes. */
function scopeHashOf(scope: HostScopeElements): string {
  return createHash("sha256").update(canonicalScopeJson(scope), "utf8").digest("hex");
}

/** Deterministic canonical JSON: keys sorted recursively, BigInt as integers. */
function canonicalizePayload(payload: unknown): string {
  if (payload === null) return "null";
  if (typeof payload === "string") return JSON.stringify(payload);
  if (typeof payload === "boolean") return payload ? "true" : "false";
  if (typeof payload === "bigint") return payload.toString();
  if (typeof payload === "number") {
    if (!Number.isFinite(payload) || !Number.isInteger(payload)) {
      throw new Error("canonicalizePayload: float/non-finite money rejected — use BigInt cents");
    }
    return JSON.stringify(payload);
  }
  if (typeof payload === "object") {
    if (Array.isArray(payload)) {
      return `[${payload.map((item) => canonicalizePayload(item)).join(",")}]`;
    }
    const record = payload as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizePayload(record[key])}`).join(",")}}`;
  }
  throw new Error("canonicalizePayload: unsupported value (undefined, function, or symbol)");
}

/** Lowercase hex sha-256 over the canonical payload bytes. */
function sha256Canonical(payload: unknown): string {
  return createHash("sha256").update(canonicalizePayload(payload), "utf8").digest("hex");
}

function edaSteps(): MissionSnapshot["steps"] {
  return EDA_STEPS.map((step) => ({
    id: step.id,
    name: step.name,
    description: `${step.name} phase (required for intent monthly-close)`,
    status: "PENDING",
  }));
}

/** The next legal phase from the persisted step list, or null when done. */
function nextPhaseOf(snapshot: MissionSnapshot): string | null {
  const steps = snapshot.steps;
  if (steps.length === 0) return null;
  const index = steps.findIndex((step) => step.id === snapshot.currentStep);
  if (index === -1) {
    const pending = steps.findIndex((step) => step.status === "PENDING");
    return pending === -1 ? null : (steps[pending]?.id ?? null);
  }
  for (let i = index; i < steps.length; i += 1) {
    const step = steps[i];
    if (step === undefined) continue;
    if (step.status === "PENDING" || step.status === "IN_PROGRESS") {
      return step.id;
    }
  }
  return null;
}

function completeStep(
  mission: MissionSnapshot,
  phase: string,
  status: "COMPLETED" | "SKIPPED",
  evidenceIds?: string[],
): MissionSnapshot {
  const now = new Date().toISOString();
  const steps = mission.steps.map((step) =>
    step.id === phase
      ? { ...step, status, evidenceIds: evidenceIds ?? step.evidenceIds, completedAt: now }
      : step,
  );
  const done = steps.filter(
    (step) => step.status === "COMPLETED" || step.status === "SKIPPED",
  ).length;
  return {
    ...mission,
    steps,
    currentStep: phase,
    progress: steps.length === 0 ? 0 : done / steps.length,
  };
}

function markInProgress(mission: MissionSnapshot, phase: string): MissionSnapshot {
  const now = new Date().toISOString();
  const steps = mission.steps.map((step) =>
    step.id === phase
      ? { ...step, status: "IN_PROGRESS" as const, startedAt: step.startedAt ?? now }
      : step,
  );
  return { ...mission, steps, currentStep: phase };
}

/** Run the same bounded monthly-close fixture through the pinned kernel. */
export async function runSubstituteHost(
  fixture: RdaReplacementFixture,
): Promise<SubstituteHostResult> {
  const scope = fixture.scope;
  const scopeHash = scopeHashOf(scope);
  const evidenceItems: EvidenceItem[] = fixture.evidence.map((entry) => ({
    id: entry.id,
    label: "source",
    type: "source",
  }));
  const evidenceHash = computeEvidenceHash(evidenceItems);
  const evidenceIds = evidenceItems.map((item) => item.id);

  // Kernel-derived materiality: kernel tier before the policy floor, then the
  // declared minimum applied as a floor (never lowering the kernel result).
  const kernelTier = deriveMateriality(fixture.materiality.input);
  const declaredMinimum = fixture.materiality.minimum;
  const effectiveTier =
    orderOf(kernelTier) >= orderOf(declaredMinimum) ? kernelTier : declaredMinimum;

  const approvals = [
    { approverId: fixture.humanApproval.approverId, at: "", reason: fixture.humanApproval.reason },
  ];

  const store = new InMemoryMissionStore();
  const events = new InMemoryMissionEventStore();
  const idempotency = new InMemoryIdempotencyStore();

  let approveGateBlocked = false;
  let lastReceipt: SignedReceipt | undefined;
  let lastReceiptBinding: SubstituteHostResult["receipt"]["binding"] | undefined;

  const handler: IntentHandler = {
    intent: "monthly-close",
    async execute(mission: MissionSnapshot): Promise<MissionSnapshot | null> {
      const phase = nextPhaseOf(mission);
      switch (phase) {
        case "intake":
          return {
            ...completeStep(mission, "intake", "COMPLETED"),
            status: AccountingMissionStatus.QUEUED,
          };
        case "bind-scope":
          return {
            ...completeStep(mission, "bind-scope", "COMPLETED"),
            status: AccountingMissionStatus.RUNNING,
          };
        case "ingest":
          return {
            ...markInProgress(mission, "ingest"),
            status: AccountingMissionStatus.WAITING_FOR_EVIDENCE,
            blockers: [
              ...mission.blockers,
              {
                id: `blk-evidence-${mission.version}`,
                reason: "evidence required: source references are missing",
                severity: "ERROR",
                occurredAt: new Date().toISOString(),
              },
            ],
          };
        case "approve":
          if (approveGateBlocked) {
            return {
              ...mission,
              status: AccountingMissionStatus.BLOCKED_BY_GATE,
              blockers: [
                ...mission.blockers,
                {
                  id: `blk-gate-${mission.version}`,
                  reason: "approval required: R2 gate blocked the close",
                  severity: "ERROR",
                  occurredAt: new Date().toISOString(),
                },
              ],
            };
          }
          return {
            ...markInProgress(mission, "approve"),
            status: AccountingMissionStatus.AWAITING_APPROVAL,
          };
        case "archive":
          return {
            ...completeStep(mission, "archive", "COMPLETED"),
            status: AccountingMissionStatus.COMPLETED,
          };
        default:
          // Steady-state phases advance phase-only through the driver.
          return null;
      }
    },
  };
  const registry: IntentRegistry = new IntentRegistryImpl();
  registry.register(handler);
  const runtime = new MissionRuntime({ store, events, idempotency, registry });

  const executeCommand = (
    missionId: string,
    expectedVersion: number,
  ): BoundMissionCommand => ({
    type: "execute",
    missionId,
    payload: { expectedMissionVersion: expectedVersion },
  });

  const phaseOnlyUpdate = async (
    snapshot: MissionSnapshot,
    mutate: (mission: MissionSnapshot) => MissionSnapshot,
  ): Promise<MissionSnapshot> => {
    const current = await store.findById(snapshot.id);
    if (current === undefined || current.version !== snapshot.version) {
      throw new Error(
        `substitute host: stale mission version — expected ${snapshot.version}, got ${current?.version}`,
      );
    }
    const next: MissionSnapshot = {
      ...mutate(current),
      version: current.version + 1,
      lastEventSequence: current.lastEventSequence + 1,
      updatedAt: new Date().toISOString(),
    };
    const event: MissionEvent = {
      id: `evt_${randomUUID()}`,
      missionId: next.id,
      sequence: next.lastEventSequence,
      eventType: MissionEventType.PROGRESS_UPDATE,
      snapshot: next,
      createdAt: next.updatedAt,
    };
    await store.save(next);
    await events.append(event);
    return next;
  };

  const completeApproval = async (snapshot: MissionSnapshot): Promise<MissionSnapshot> => {
    const proposal = snapshot.proposal;
    if (proposal === null) {
      throw new Error("substitute host: no proposal to approve");
    }
    let mission = snapshot;
    if (mission.status === AccountingMissionStatus.BLOCKED_BY_GATE) {
      mission = (
        await runtime.apply(executeCommand(mission.id, mission.version), {
          expectedMissionVersion: mission.version,
        })
      ).snapshot;
    }
    if (mission.status === AccountingMissionStatus.RUNNING) {
      mission = (
        await runtime.apply(executeCommand(mission.id, mission.version), {
          expectedMissionVersion: mission.version,
        })
      ).snapshot;
    }
    if (mission.status !== AccountingMissionStatus.AWAITING_APPROVAL) {
      throw new Error(
        `substitute host: expected AWAITING_APPROVAL before approval, got ${mission.status}`,
      );
    }
    const approved = (
      await runtime.apply(
        {
          type: "approve",
          missionId: mission.id,
          payload: {
            proposalId: proposal.id,
            proposalVersion: proposal.version,
            evidenceHash: proposal.evidenceHash,
            expectedMissionVersion: mission.version,
          },
        },
        { expectedMissionVersion: mission.version },
      )
    ).snapshot;
    return phaseOnlyUpdate(approved, (m) => completeStep(m, "approve", "COMPLETED"));
  };

  const sealClose = (mission: MissionSnapshot): MissionSnapshot => {
    const proposal = mission.proposal;
    const proposalEvidenceHash = proposal?.evidenceHash ?? computeEvidenceHash([]);
    const proposalVersion = proposal?.version ?? mission.version;
    const targetHash = sha256Canonical({
      chain: "monthly-close",
      phase: "close",
      proposalVersion,
      evidenceHash: proposalEvidenceHash,
    });
    const binding = {
      version: "drenyra.receipt-binding.v1",
      scopeHash,
      authorizationId: `auth-${mission.id}-close`,
      policyVersion: scope.policyVersion,
      targetHash,
      evidenceHash: proposalEvidenceHash,
    };
    const keyPair = generateReceiptKeyPair("close_" + mission.id.slice(0, 8));
    const receipt = buildSignedReceipt(
      {
        missionId: mission.id,
        companyId: mission.companyId,
        // Mirrors Pi's close: the receipt is bound to the sealing actor, which
        // is the explicit human approver when one is supplied.
        actorId: fixture.humanApproval.approverId,
        decision: "APPROVE",
        proposalVersion,
        evidenceHash: proposalEvidenceHash,
        previousStatus: AccountingMissionStatus.APPROVED,
        newStatus: AccountingMissionStatus.COMPLETED,
        payloadHash: sha256Canonical(binding),
        timestamp: new Date().toISOString(),
      },
      keyPair,
    );
    lastReceipt = receipt;
    lastReceiptBinding = {
      scopeHash,
      evidenceHash: proposalEvidenceHash,
      policyVersion: scope.policyVersion,
      targetHash,
    };
    return {
      ...completeStep(mission, "close", "COMPLETED"),
      receiptId: receipt.receiptHash,
      receiptHash: receipt.receiptHash,
    };
  };

  // Start the mission and inject the full 13-step EDA plan (phase-only).
  let mission = await runtime.start({
    companyId: scope.company,
    fiscalPeriod: scope.fiscalPeriod,
    intent: "monthly-close",
    input: { instruction: `Close books for ${scope.fiscalPeriod}` },
  });
  mission = await phaseOnlyUpdate(mission, (m) => ({
    ...m,
    steps: edaSteps(),
    currentStep: EDA_STEPS[0]?.id ?? "",
  }));

  // Drive the bounded 13-phase mission (plus finite slack); no unbounded loop.
  let approvedMission: MissionSnapshot | undefined;
  for (let index = 0; index < MAX_ADVANCES; index += 1) {
    if (mission.status === AccountingMissionStatus.COMPLETED) break;
    const phase = nextPhaseOf(mission);
    if (phase === null) break;

    if (phase === "approve") {
      approvals[0] = {
        approverId: fixture.humanApproval.approverId,
        at: new Date().toISOString(),
        reason: fixture.humanApproval.reason,
      };
      const gateResult: GateResult = new ApprovalGate().evaluate({
        materiality: effectiveTier,
        approval: approvals,
      });
      approveGateBlocked = gateResult.verdict !== "allowed";
      const applied = await runtime.apply(executeCommand(mission.id, mission.version), {
        expectedMissionVersion: mission.version,
      });
      mission = applied.snapshot;
      if (approveGateBlocked) {
        break; // BLOCKED_BY_GATE — fail closed.
      } else {
        mission = await completeApproval(mission);
        approvedMission = mission;
      }
      continue;
    }

    if (phase === "ingest") {
      if (evidenceIds.length === 0) {
        mission = (
          await runtime.apply(executeCommand(mission.id, mission.version), {
            expectedMissionVersion: mission.version,
          })
        ).snapshot;
      } else {
        mission = await phaseOnlyUpdate(mission, (m) =>
          completeStep(m, "ingest", "COMPLETED", evidenceIds),
        );
      }
      continue;
    }

    if (phase === "propose") {
      mission = await phaseOnlyUpdate(mission, (m) => ({
        ...completeStep(m, "propose", "COMPLETED"),
        proposal: {
          id: `prop-${m.id}`,
          missionId: m.id,
          version: m.version,
          evidence: evidenceItems,
          evidenceHash,
          summary: `Close books for ${m.fiscalPeriod} — ${evidenceItems.length} cited source reference(s)`,
          riskLevel: "LOW",
          generatedAt: new Date().toISOString(),
        },
      }));
      continue;
    }

    if (phase === "close") {
      mission = await phaseOnlyUpdate(mission, (m) => sealClose(m));
      continue;
    }

    if (LIFECYCLE_PHASES.has(phase)) {
      mission = (
        await runtime.apply(executeCommand(mission.id, mission.version), {
          expectedMissionVersion: mission.version,
        })
      ).snapshot;
      continue;
    }

    // Steady-state phases advance phase-only (PROGRESS_UPDATE; engine status
    // unchanged) — never an engine state transition.
    mission = await phaseOnlyUpdate(mission, (m) => completeStep(m, phase, "COMPLETED"));
  }

  if (mission.status !== AccountingMissionStatus.COMPLETED) {
    throw new Error(
      `substitute host: mission did not complete within the bounded budget (status ${mission.status})`,
    );
  }
  if (approvedMission === undefined) {
    throw new Error("substitute host: no approved mission captured for the gate checkpoint");
  }
  const receipt = lastReceipt;
  const receiptBinding = lastReceiptBinding;
  if (receipt === undefined || receiptBinding === undefined) {
    throw new Error("substitute host: completion receipt missing after the close");
  }

  // Ordered kernel gate verdicts at the closing authority checkpoint:
  // mission (APPROVED -> COMPLETED), approval (R2, human), receipt (trusted key).
  const gateRunner = new GateRunner();
  const missionGate = await gateRunner.run([new MissionStateGate()], {
    mission: approvedMission,
    targetStatus: AccountingMissionStatus.COMPLETED,
  });
  const approvalGateResult: GateResult = new ApprovalGate().evaluate({
    materiality: effectiveTier,
    approval: approvals,
  });
  const trustedKey: SigningKeyInfo = {
    keyId: receipt.signerKeyId,
    publicKey: receipt.signerPublicKey,
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  const receiptGate = await gateRunner.run([new ReceiptGate()], {
    receipt,
    trustedKeys: [trustedKey],
  });
  const gates: HostGateVerdictRecord[] = [
    { order: 1, stage: "mission", verdict: missionGate[0]?.verdict ?? "blocked" },
    { order: 2, stage: "approval", verdict: approvalGateResult.verdict },
    { order: 3, stage: "receipt", verdict: receiptGate[0]?.verdict ?? "blocked" },
  ];

  const proposal = mission.proposal;
  if (proposal === null) {
    throw new Error("substitute host: completed mission has no proposal");
  }
  const targetHash = sha256Canonical({
    chain: "monthly-close",
    phase: "close",
    proposalVersion: proposal.version,
    evidenceHash: proposal.evidenceHash,
  });
  const candidateContent = {
    intent: mission.intent,
    company: mission.companyId,
    fiscalPeriod: mission.fiscalPeriod,
    evidenceHash: proposal.evidenceHash,
    policyVersion: scope.policyVersion,
    operation: fixture.target.operation,
    payload: fixture.target.content,
  };
  const contentHash = sha256Canonical(candidateContent);
  const verified = verifySignedReceipt(receipt).valid;

  return {
    hostMissionId: mission.id,
    scope: {
      elements: {
        tenant: scope.tenant,
        organization: scope.organization,
        company: scope.company,
        fiscalPeriod: scope.fiscalPeriod,
        ledgerBook: scope.ledgerBook,
        operationType: scope.operationType,
        sourceSnapshot: scope.sourceSnapshot,
        policyVersion: scope.policyVersion,
        actor: scope.actor,
        authorityLevel: scope.authorityLevel,
      },
      scopeHash,
    },
    evidence: { items: evidenceItems, evidenceHash },
    policyVersion: scope.policyVersion,
    materiality: {
      input: fixture.materiality.input,
      declaredMinimum,
      kernelTier,
      effectiveTier,
    },
    gates,
    candidate: { targetHash, contentHash, content: candidateContent },
    approval: {
      humanApproverId: fixture.humanApproval.approverId,
      candidateContentHash: contentHash,
      evidenceHash: proposal.evidenceHash,
    },
    receipt: {
      type: receipt.receiptType,
      missionId: receipt.content.missionId,
      binding: receiptBinding,
      claims: {
        company: receipt.content.companyId,
        actor: receipt.content.actorId,
        decision: receipt.content.decision,
        evidenceHash: receipt.content.evidenceHash,
        previousStatus: receipt.content.previousStatus,
        newStatus: receipt.content.newStatus,
        payloadHash: receipt.content.payloadHash,
      },
      verified,
    },
    unknownHandling: { attemptsAfterUnknown: 0 },
    terminal: { missionStatus: mission.status },
    runtimeMetadata: {
      missionId: mission.id,
      missionCreatedAt: mission.createdAt,
      missionUpdatedAt: mission.updatedAt,
      receiptHash: receipt.receiptHash,
      signerKeyId: receipt.signerKeyId,
      signature: receipt.signature,
      issuedAt: receipt.issuedAt,
    },
  };
}
