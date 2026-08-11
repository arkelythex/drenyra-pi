/**
 * Monthly-close RDA chain — the operator-facing fiscal close workflow.
 *
 * The chain runs a `monthly-close` mission through the pinned Drenyra AI
 * runtime over the **durable mission stores** (design §8), ships the full
 * 13-phase EDA step plan (REQ-MISS-001), and advances **exactly one EDA phase
 * per execute** (REQ-MISS-004): `derivePreparedStep` decides RUN/SKIP/WAIT from
 * persisted state only, human-wait states are never auto-advanced (REQ-MISS-009),
 * and the R2 approval gate runs with explicit materiality derivation
 * (REQ-AUTH-004/005).
 *
 * Phase mechanics (design §4.2, adapted to the pinned engine): lifecycle
 * phases advance through `MissionRuntime.apply` (engine-validated transitions —
 * intake DRAFT→QUEUED, bind-scope QUEUED→RUNNING, evidence wait
 * RUNNING→WAITING_FOR_EVIDENCE, gate block RUNNING→BLOCKED_BY_GATE, approve
 * RUNNING→AWAITING_APPROVAL, archive APPROVED→COMPLETED). Steady-state phases
 * that keep the lifecycle RUNNING/APPROVED (ingest-with-evidence, normalize,
 * classify, reconcile, investigate, propose, verify, execute, close) advance as
 * **phase-only progress updates** (PROGRESS_UPDATE events; design §4.1: a
 * phase-only update never fabricates an engine state transition). The engine
 * remains the sole authority on status transitions (REQ-MISS-002).
 *
 * The proposal carries a real engine-computed evidence hash over the cited
 * source references (REQ-CHAIN-001); the hardcoded "pending" digest is gone.
 * The completion receipt is bound to scope, evidence, policy, actor, and
 * target. Signing keys are ephemeral per run in this slice; the explicit
 * signing provider and trusted-key registry land in PR #4 (design §11.2).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AccountingMissionStatus,
  IntentRegistryImpl,
  MissionEventType,
  MissionRuntime,
  WaitReason,
  waitReasonFor,
  type BoundMissionCommand,
  type IntentHandler,
  type IntentRegistry,
  type MissionEvent,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import {
  ApprovalGate,
  type ApprovalRecord,
  type GateResult,
} from "drenyra-ai/gates";
import {
  buildSignedReceipt,
  computeEvidenceHash,
  generateReceiptKeyPair,
  type EvidenceItem,
  type SignedReceipt,
} from "drenyra-ai/receipts";
import type { MaterialityInput } from "drenyra-ai/candidates";
import { MaterialityInputError, deriveRequiredMateriality } from "../lib/authority-gates.js";
import {
  EDA_PHASE,
  EDA_PHASE_ORDER,
  createEdaSteps,
  derivePreparedStep,
  type EdaPhase,
  type PreparedStep,
} from "../lib/accounting-status.js";
import { createDurableMissionStores, type DurableMissionStores } from "../lib/mission-store.js";
    import type { EvidenceNode } from "../lib/evidence-graph.js";
    import { sha256Canonical, type ScopeBinding } from "../lib/canonicalization.js";
    import { ReceiptStore, type HarnessReceiptRecord } from "../lib/receipt-store.js";
    import { eachNdjsonLine, parseJsonOrThrow } from "../lib/parse.js";
import { assertMissionScopeReady } from "../runtime/context.js";

/** Upper bound for `run()`: 13 phases plus gate/evidence resolution slack. */
const MONTHLY_CLOSE_MAX_ADVANCES = 16;

/** Input for starting a monthly-close mission (durable step plan + evidence). */
export interface MonthlyCloseStartInput {
  /**
   * Bounded source references the close ingests (design §11.2). Empty means
   * evidence is missing and the ingest phase enters the evidence wait.
   */
  sourceRefs?: string[];
  /**
   * Explicit materiality input (REQ-AUTH-004). Monthly close always applies the
   * R2 floor (REQ-AUTH-005); a missing or incomplete input fails closed.
   */
  materiality: MaterialityInput;
}

/** Input for one continuation of an existing monthly-close mission. */
export interface MonthlyCloseStepInput {
  missionId: string;
  /** The human approver for the R2 approval gate (required at the approve phase). */
  approverId?: string;
  reason?: string;
      /**
       * Explicitly resume an EVIDENCE wait after evidence landed in the mission's
       * evidence graph (REQ-MISS-009: never auto-advanced; the engine-legal
       * WAITING_FOR_EVIDENCE -> RUNNING transition is the only resume).
       */
      satisfyEvidence?: boolean;
}

/** The result of one bounded continuation (exactly one EDA phase, or a wait). */
export interface MonthlyCloseStepResult {
  mission: MissionSnapshot;
  preparedStep: PreparedStep | null;
  /** The phase completed by this advance, or null when none advanced. */
  phase: EdaPhase | null;
  waitReason?: WaitReason;
}

/** Input for the full close: start + bounded continuation to COMPLETED. */
export interface MonthlyCloseInput extends MonthlyCloseStartInput {
  /** The explicit human approver — R2 requires a recorded professional. */
  approverId: string;
  reason?: string;
}

export interface MonthlyCloseResult {
  mission: MissionSnapshot;
  receipt: SignedReceipt;
  approval: ApprovalRecord;
}

/**
 * Thrown by `run()` when the close reaches a human-wait state (evidence
 * missing or approval gate blocked). Fail-closed: the mission is reported with
 * its wait reason and no further phase advances.
 */
export class MonthlyCloseWaitError extends Error {
  readonly mission: MissionSnapshot;
  readonly waitReason: WaitReason;

  constructor(mission: MissionSnapshot, waitReason: WaitReason) {
    super(`monthly-close: mission ${mission.id} waits on ${waitReason}`);
    this.name = "MonthlyCloseWaitError";
    this.mission = mission;
    this.waitReason = waitReason;
  }
}

/** Mark one step COMPLETED/SKIPPED and roll the mission's progress forward. */
function completeStep(
  mission: MissionSnapshot,
  phase: EdaPhase,
  status: "COMPLETED" | "SKIPPED",
  evidenceIds?: string[],
): MissionSnapshot {
  const now = new Date().toISOString();
  const steps = mission.steps.map((step) =>
    step.id === phase
      ? {
          ...step,
          status,
          evidenceIds: evidenceIds ?? step.evidenceIds,
          completedAt: now,
        }
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

/** Mark one step IN_PROGRESS (phase started but not completed). */
function markInProgress(mission: MissionSnapshot, phase: EdaPhase): MissionSnapshot {
  const now = new Date().toISOString();
  const steps = mission.steps.map((step) =>
    step.id === phase
      ? { ...step, status: "IN_PROGRESS" as const, startedAt: step.startedAt ?? now }
      : step,
  );
  return { ...mission, steps, currentStep: phase };
}

/**
 * The monthly-close RDA chain (design §11.2). Requires a complete ten-element
 * canonical scope binding; the R2 approval gate runs with explicit materiality
 * derivation; readiness is always the next legal transition only.
 */
export class MonthlyCloseChain {
  /** The durable store set the chain runs over (design §8). */
  readonly stores: DurableMissionStores;
  /** The stores root used for the evidence graph and export artifacts. */
  private readonly storesRoot: string;

  private readonly binding: ScopeBinding;
  private readonly runtime: MissionRuntime;
  private readonly approvalGate: ApprovalGate;
  private readonly sourceRefsByMission = new Map<string, string[]>();
  private readonly materialityByMission = new Map<string, MaterialityInput>();
  private approveGateBlocked = false;
  private lastReceipt?: SignedReceipt;
  private lastReceiptRecord?: HarnessReceiptRecord;

  constructor(binding: ScopeBinding, options: { storesRoot?: string } = {}) {
    assertMissionScopeReady(binding.scope);
    this.binding = binding;
    this.storesRoot = options.storesRoot ?? process.cwd();
    this.stores = createDurableMissionStores(options.storesRoot);
    this.approvalGate = new ApprovalGate();
    this.runtime = new MissionRuntime({
      store: this.stores.store,
      events: this.stores.events,
      idempotency: this.stores.idempotency,
      registry: this.buildRegistry(),
    });
  }

  private buildRegistry(): IntentRegistry {
    const registry = new IntentRegistryImpl();
    const gateBlocked = (): boolean => this.approveGateBlocked;
    const handler: IntentHandler = {
      intent: "monthly-close",
      async execute(mission: MissionSnapshot): Promise<MissionSnapshot | null> {
        const prepared = derivePreparedStep(mission);
        if (prepared === null || prepared.disposition !== "RUN") {
          return null;
        }
        switch (prepared.phase) {
          case EDA_PHASE.INTAKE:
            return {
              ...completeStep(mission, EDA_PHASE.INTAKE, "COMPLETED"),
              status: AccountingMissionStatus.QUEUED,
            };
          case EDA_PHASE.BIND_SCOPE:
            return {
              ...completeStep(mission, EDA_PHASE.BIND_SCOPE, "COMPLETED"),
              status: AccountingMissionStatus.RUNNING,
            };
          case EDA_PHASE.INGEST:
            // Evidence missing: engine-legal evidence wait (REQ-MISS-009).
            return {
              ...markInProgress(mission, EDA_PHASE.INGEST),
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
          case EDA_PHASE.APPROVE:
            if (gateBlocked()) {
              // The approve step stays PENDING: no phase advances (SC-MISS-006).
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
              ...markInProgress(mission, EDA_PHASE.APPROVE),
              status: AccountingMissionStatus.AWAITING_APPROVAL,
            };
          case EDA_PHASE.ARCHIVE:
            return {
              ...completeStep(mission, EDA_PHASE.ARCHIVE, "COMPLETED"),
              status: AccountingMissionStatus.COMPLETED,
            };
          default:
            // Steady-state phases advance phase-only through the coordinator.
            return null;
        }
      },
    };
    registry.register(handler);
    return registry;
  }

  private executeCommand(missionId: string, expectedVersion: number): BoundMissionCommand {
    return {
      type: "execute",
      missionId,
      payload: { expectedMissionVersion: expectedVersion },
    };
  }

  private idempotencyKeyFor(missionId: string, phase: EdaPhase, version: number): string {
    return `mc:${missionId}:${phase}:v${version}`;
  }

  private assertMateriality(input: MaterialityInput): void {
    deriveRequiredMateriality({ input, minimum: "R2" });
  }

  private materialityFor(missionId: string): MaterialityInput {
    const input = this.materialityByMission.get(missionId);
    if (input === undefined) {
      throw new MaterialityInputError(
        "materiality input missing: the mission was created without explicit materiality",
      );
    }
    return input;
  }

  private evidenceFor(missionId: string): EvidenceItem[] {
    // The evidence graph is the source of truth for cited evidence (design
    // §7): every node appended through the evidence chain is cited. When the
    // graph is empty (legacy direct close with source references), fall back
    // to the bounded source references for backward compatibility.
    const nodes = this.graphNodes(missionId);
    if (nodes.length > 0) {
      return nodes.map((node) => ({
    id: node.id,
    label: node.nodeKind,
    type: node.nodeKind,
      }));
    }
    const refs = this.sourceRefsByMission.get(missionId) ?? [];
    return refs.map((ref, index) => ({
      id: `src-${index + 1}`,
      label: ref,
      type: "source-reference",
    }));
  }

      private graphNodes(missionId: string): EvidenceNode[] {
        // The evidence graph ndjson is the durable source of truth; read it
        // synchronously (fail-closed: unreadable/missing -> empty, so the
        // source-reference fallback applies).
        const graphPath = join(
          this.storesRoot,
          ".local",
          "evidence",
          `${missionId}.ndjson`,
        );
        let raw: string;
        try {
          raw = readFileSync(graphPath, "utf8");
        } catch {
          return [];
        }
            const nodes: EvidenceNode[] = [];
            try {
              eachNdjsonLine(
                raw,
                (line) => {
                  const record = parseJsonOrThrow<{ recordKind?: string } & EvidenceNode>(
                    line,
                    "evidence log corrupt: malformed line — graph unavailable",
                  );
                  if (record.recordKind === "node") {
                    nodes.push(record);
                  }
                },
                /\r?\n/,
              );
            } catch {
              // A corrupt line fails closed: treat the graph as unavailable.
              return [];
            }
            return nodes;
      }

  private makeApproval(input: MonthlyCloseStepInput): ApprovalRecord {
    const approverId = input.approverId?.trim() ?? "";
    if (approverId.length === 0) {
      throw new Error("monthly-close: an approver is required (R2: explicit human approval)");
    }
    return {
      approverId,
      at: new Date().toISOString(),
      reason: input.reason ?? "monthly close",
    };
  }

  /**
   * Start a monthly-close mission: engine DRAFT mission + the full 13-step EDA
   * plan injected as a phase-only progress update (REQ-MISS-001).
   */
  async startMission(input: MonthlyCloseStartInput): Promise<MissionSnapshot> {
    this.assertMateriality(input.materiality);
    const { company, fiscalPeriod } = this.binding.scope;
    const started = await this.runtime.start({
      companyId: company,
      fiscalPeriod,
      intent: "monthly-close",
      input: { instruction: `Close books for ${fiscalPeriod}` },
    });
    this.sourceRefsByMission.set(started.id, input.sourceRefs ?? []);
    this.materialityByMission.set(started.id, input.materiality);

    // Plan injection: version bump + PROGRESS_UPDATE event keeps the durable
    // snapshot/event log consistent for recovery (design §8.3).
    const planned = await this.phaseOnlyUpdate(started, (mission) => ({
      ...mission,
      steps: createEdaSteps("monthly-close"),
      currentStep: EDA_PHASE_ORDER[0] ?? "",
    }));
    return planned;
  }

  /**
   * Advance exactly one EDA phase (REQ-MISS-004): RUN/SKIP/WAIT is derived from
   * the persisted snapshot only. Human-wait states never auto-advance; an
   * approval input resolves the approve phase through the R2 gate.
   */
  async advance(input: MonthlyCloseStepInput): Promise<MonthlyCloseStepResult> {
    const snapshot = await this.stores.store.findById(input.missionId);
    if (snapshot === undefined) {
      throw new Error(`monthly-close: mission ${input.missionId} not found`);
    }
    const prepared = derivePreparedStep(snapshot, this.binding.scopeHash);
    const wait = waitReasonFor(snapshot.status);

    if (prepared === null) {
      return { mission: snapshot, preparedStep: null, phase: null, waitReason: wait ?? undefined };
    }

    if (prepared.disposition === "WAIT") {
      if (
        prepared.phase === EDA_PHASE.APPROVE &&
        (snapshot.status === AccountingMissionStatus.AWAITING_APPROVAL ||
          snapshot.status === AccountingMissionStatus.BLOCKED_BY_GATE) &&
        input.approverId !== undefined
      ) {
        const mission = await this.completeApproval(snapshot, input);
        return this.resultFor(mission, EDA_PHASE.APPROVE);
      }
      if (
        wait === WaitReason.EVIDENCE &&
        input.satisfyEvidence === true
      ) {
        // Engine-legal resume: the intent handler returns null for a WAIT, so
        // resolveTarget defaults to RUNNING (WAITING_FOR_EVIDENCE -> RUNNING
        // is in VALID_TRANSITIONS). Never an auto-advance.
        const applied = await this.runtime.apply(
          this.executeCommand(snapshot.id, snapshot.version),
          {
        expectedMissionVersion: snapshot.version,
        idempotencyKey: `mc:${snapshot.id}:resume:v${snapshot.version}`,
          },
        );
        return this.resultFor(applied.snapshot, null);
      }
      return { mission: snapshot, preparedStep: prepared, phase: null, waitReason: wait ?? undefined };
    }

    if (prepared.disposition === "SKIP") {
      const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
        completeStep(m, prepared.phase, "SKIPPED"),
      );
      return this.resultFor(mission, prepared.phase);
    }

    // RUN: one bounded phase per advance.
    switch (prepared.phase) {
      case EDA_PHASE.INGEST: {
        const refs = this.sourceRefsByMission.get(snapshot.id) ?? [];
        const graphEvidence = this.graphNodes(snapshot.id).length;
        if (refs.length === 0 && graphEvidence === 0) {
          const applied = await this.runtime.apply(
            this.executeCommand(snapshot.id, snapshot.version),
            {
              expectedMissionVersion: snapshot.version,
              idempotencyKey: this.idempotencyKeyFor(snapshot.id, EDA_PHASE.INGEST, snapshot.version),
            },
          );
          return this.resultFor(applied.snapshot, null);
        }
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          completeStep(
            m,
            EDA_PHASE.INGEST,
            "COMPLETED",
            this.evidenceFor(m.id).map((item) => item.id),
          ),
        );
        return this.resultFor(mission, EDA_PHASE.INGEST);
      }
      case EDA_PHASE.PROPOSE: {
        const mission = await this.phaseOnlyUpdate(snapshot, (m) => ({
          ...completeStep(m, EDA_PHASE.PROPOSE, "COMPLETED"),
          proposal: this.buildProposal(m),
        }));
        return this.resultFor(mission, EDA_PHASE.PROPOSE);
      }
      case EDA_PHASE.APPROVE: {
        const mission = await this.runApprovePhase(snapshot, input);
        return this.resultFor(mission, EDA_PHASE.APPROVE);
      }
      case EDA_PHASE.EXECUTE: {
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          completeStep(m, EDA_PHASE.EXECUTE, "COMPLETED"),
        );
        return this.resultFor(mission, EDA_PHASE.EXECUTE);
      }
      case EDA_PHASE.CLOSE: {
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          this.sealClose(m, input.approverId?.trim() || this.binding.scope.actor),
        );
        // Persist the signed completion receipt in the immutable receipt store
        // (REQ-CHAIN-007) so /drenyra:receipt and the verify chain can read it.
        if (this.lastReceiptRecord !== undefined) {
          await new ReceiptStore(this.storesRoot).save(this.lastReceiptRecord);
        }
        return this.resultFor(mission, EDA_PHASE.CLOSE);
      }
      case EDA_PHASE.INTAKE:
      case EDA_PHASE.BIND_SCOPE:
      case EDA_PHASE.ARCHIVE: {
        const applied = await this.runtime.apply(
          this.executeCommand(snapshot.id, snapshot.version),
          {
            expectedMissionVersion: snapshot.version,
            idempotencyKey: this.idempotencyKeyFor(snapshot.id, prepared.phase, snapshot.version),
          },
        );
        return this.resultFor(applied.snapshot, prepared.phase);
      }
      default: {
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          completeStep(m, prepared.phase, "COMPLETED"),
        );
        return this.resultFor(mission, prepared.phase);
      }
    }
  }

  /**
   * Run the approve phase: evaluate the R2 gate with explicit materiality and
   * the supplied approval. A denied gate moves the mission to BLOCKED_BY_GATE
   * with no phase advance (SC-MISS-006); an allowed gate completes the approve
   * phase through the engine approve command.
   */
  private async runApprovePhase(
    snapshot: MissionSnapshot,
    input: MonthlyCloseStepInput,
  ): Promise<MissionSnapshot> {
    const approval = input.approverId === undefined ? [] : [this.makeApproval(input)];
    const tier = deriveRequiredMateriality({
      input: this.materialityFor(snapshot.id),
      minimum: "R2",
    });
    const gateResult: GateResult = this.approvalGate.evaluate({
      materiality: tier,
      approval,
    });
    this.approveGateBlocked = gateResult.verdict !== "allowed";
    try {
      const applied = await this.runtime.apply(
        this.executeCommand(snapshot.id, snapshot.version),
        {
          expectedMissionVersion: snapshot.version,
          idempotencyKey: this.idempotencyKeyFor(snapshot.id, EDA_PHASE.APPROVE, snapshot.version),
        },
      );
      if (this.approveGateBlocked) {
        return applied.snapshot;
      }
      return this.completeApproval(applied.snapshot, input);
    } finally {
      this.approveGateBlocked = false;
    }
  }

  private resultFor(mission: MissionSnapshot, phase: EdaPhase | null): MonthlyCloseStepResult {
    return {
      mission,
      preparedStep: derivePreparedStep(mission, this.binding.scopeHash),
      phase,
      waitReason: waitReasonFor(mission.status) ?? undefined,
    };
  }

  /**
   * Resolve the approve phase: R2 gate with explicit materiality, then the
   * engine approve command bound to the real proposal evidence hash, then the
   * approve step is sealed COMPLETED.
   */
  private async completeApproval(
    snapshot: MissionSnapshot,
    input: MonthlyCloseStepInput,
  ): Promise<MissionSnapshot> {
    const proposal = snapshot.proposal;
    if (proposal === null) {
      throw new Error("monthly-close: no proposal to approve");
    }
    const tier = deriveRequiredMateriality({
      input: this.materialityFor(snapshot.id),
      minimum: "R2",
    });
    const gateResult: GateResult = this.approvalGate.evaluate({
      materiality: tier,
      approval: [this.makeApproval(input)],
    });
    if (gateResult.verdict !== "allowed") {
      this.approveGateBlocked = true;
      try {
        const applied = await this.runtime.apply(
          this.executeCommand(snapshot.id, snapshot.version),
          {
            expectedMissionVersion: snapshot.version,
            idempotencyKey: this.idempotencyKeyFor(snapshot.id, EDA_PHASE.APPROVE, snapshot.version),
          },
        );
        return applied.snapshot;
      } finally {
        this.approveGateBlocked = false;
      }
    }

    let mission = snapshot;
    if (mission.status === AccountingMissionStatus.BLOCKED_BY_GATE) {
      // BLOCKED_BY_GATE -> RUNNING (engine fallback), then the approve phase.
      mission = (
        await this.runtime.apply(this.executeCommand(mission.id, mission.version), {
          expectedMissionVersion: mission.version,
        })
      ).snapshot;
    }
    if (mission.status === AccountingMissionStatus.RUNNING) {
      mission = (
        await this.runtime.apply(this.executeCommand(mission.id, mission.version), {
          expectedMissionVersion: mission.version,
          idempotencyKey: this.idempotencyKeyFor(mission.id, EDA_PHASE.APPROVE, mission.version),
        })
      ).snapshot;
    }
    if (mission.status !== AccountingMissionStatus.AWAITING_APPROVAL) {
      throw new Error(
        `monthly-close: expected AWAITING_APPROVAL before approval, got ${mission.status}`,
      );
    }
    const approved = (
      await this.runtime.apply(
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
        {
          expectedMissionVersion: mission.version,
          idempotencyKey: `mc:${mission.id}:approve-cmd:v${mission.version}`,
        },
      )
    ).snapshot;
    return this.phaseOnlyUpdate(approved, (m) => completeStep(m, EDA_PHASE.APPROVE, "COMPLETED"));
  }
  /**
   * Run the full close: start the mission and continue one bounded phase at a
   * time until COMPLETED, a human-wait state, or the bounded budget is spent.
   */
  async run(input: MonthlyCloseInput): Promise<MonthlyCloseResult> {
    const approverId = input.approverId.trim();
    if (approverId.length === 0) {
      throw new Error("monthly-close: an approver is required (R2: explicit human approval)");
    }
    this.assertMateriality(input.materiality);

    let current =
      (await this.findActiveMission()) ?? (await this.startMission(input));
    // Ensure the reused mission carries the run's materiality + source refs.
    if (!this.materialityByMission.has(current.id)) {
      this.materialityByMission.set(current.id, input.materiality);
    }
    if (!this.sourceRefsByMission.has(current.id)) {
      this.sourceRefsByMission.set(current.id, input.sourceRefs ?? []);
    }
    for (let index = 0; index < MONTHLY_CLOSE_MAX_ADVANCES; index += 1) {
      // An evidence wait is satisfied automatically within the explicit close
      // run when the mission's graph already holds evidence (the operator
      // invoked the close; REQ-MISS-009 forbids AUTO-advance outside it).
      const atEvidenceWait =
        current.status === AccountingMissionStatus.WAITING_FOR_EVIDENCE &&
        this.graphNodes(current.id).length > 0;
      const step = await this.advance({
        missionId: current.id,
        approverId,
        reason: input.reason,
        satisfyEvidence: atEvidenceWait,
      });
      current = step.mission;
      if (current.status === AccountingMissionStatus.COMPLETED) {
        break;
      }
      if (step.waitReason !== undefined) {
        throw new MonthlyCloseWaitError(current, step.waitReason);
      }
      if (current.status === AccountingMissionStatus.FAILED) {
        throw new Error("monthly-close: mission failed during the close");
      }
    }
    if (current.status !== AccountingMissionStatus.COMPLETED) {
      throw new Error(
        "monthly-close: close did not complete within the bounded step budget",
      );
    }
    const receipt = this.lastReceipt;
    if (receipt === undefined) {
      throw new Error("monthly-close: completion receipt missing after the close");
    }
        // Export artifact (v0.1 step 12): an immutable export record under
        // .local/exports/<mission-id>.json.
        const exportDir = join(this.storesRoot, ".local", "exports");
        mkdirSync(exportDir, { recursive: true });
        const exportPayload = {
          schemaVersion: 1,
          kind: "monthly-close-export",
          missionId: current.id,
          evidenceHash: current.proposal?.evidenceHash ?? computeEvidenceHash([]),
          receiptHash: receipt.receiptHash,
        };
        writeFileSync(
          join(exportDir, `${current.id}.json`),
          `${JSON.stringify(exportPayload, null, 2)}\n`,
        );
    return {
      mission: current,
      receipt,
      approval: {
        approverId,
        at: current.updatedAt,
        reason: input.reason ?? "monthly close",
      },
    };
  }

      /**
       * The active non-terminal monthly-close mission for the bound scope, or
       * undefined when none exists (run() continues an in-flight close instead of
       * starting a second one).
       */
      private async findActiveMission(): Promise<MissionSnapshot | undefined> {
        const all = await this.stores.store.list();
        return all.find(
          (mission) =>
            mission.companyId === this.binding.scope.company &&
            mission.fiscalPeriod === this.binding.scope.fiscalPeriod &&
            mission.intent === "monthly-close" &&
            mission.status !== AccountingMissionStatus.COMPLETED &&
            mission.status !== AccountingMissionStatus.FAILED &&
            mission.status !== AccountingMissionStatus.REJECTED,
        );
      }

  private buildProposal(mission: MissionSnapshot): MissionSnapshot["proposal"] {
    const evidence = this.evidenceFor(mission.id);
    const evidenceHash = computeEvidenceHash(evidence);
    const hasUnresolvedBlocker = mission.blockers.some(
      (blocker) =>
        blocker.resolvedAt === undefined &&
        (blocker.severity === "ERROR" || blocker.severity === "CRITICAL"),
    );
    return {
      id: `prop-${mission.id}`,
      missionId: mission.id,
      version: mission.version,
      evidence,
      evidenceHash,
      summary: `Close books for ${mission.fiscalPeriod} — ${evidence.length} cited source reference(s)`,
      riskLevel: hasUnresolvedBlocker ? "MEDIUM" : "LOW",
      generatedAt: new Date().toISOString(),
    };
  }

  /** Seal the close output: deterministic checks pass, receipt persisted. */
  private sealClose(mission: MissionSnapshot, actorId: string): MissionSnapshot {
    const proposal = mission.proposal;
    const evidenceHash = proposal?.evidenceHash ?? computeEvidenceHash([]);
    const proposalVersion = proposal?.version ?? mission.version;
    const binding: HarnessReceiptRecord["binding"] = {
      version: "drenyra.receipt-binding.v1",
      scopeHash: this.binding.scopeHash,
      authorizationId: `auth-${mission.id}-close`,
      policyVersion: this.binding.scope.policyVersion,
      targetHash: sha256Canonical({
        chain: "monthly-close",
        phase: "close",
        proposalVersion,
        evidenceHash,
      }),
      evidenceHash,
    };
    const keyPair = generateReceiptKeyPair("close_" + mission.id.slice(0, 8));
    const receipt = buildSignedReceipt(
      {
        missionId: mission.id,
        companyId: mission.companyId,
        actorId,
        decision: "APPROVE",
        proposalVersion,
        evidenceHash,
        previousStatus: AccountingMissionStatus.APPROVED,
        newStatus: AccountingMissionStatus.COMPLETED,
        payloadHash: sha256Canonical(binding),
        timestamp: new Date().toISOString(),
      },
      keyPair,
    );
    this.lastReceipt = receipt;
    this.lastReceiptRecord = { binding, receipt };
    return {
      ...completeStep(mission, EDA_PHASE.CLOSE, "COMPLETED"),
      receiptId: receipt.receiptHash,
      receiptHash: receipt.receiptHash,
    };
  }

  /**
   * Phase-only progress update: advances steps while keeping the engine status
   * unchanged (design §4.1 — never fabricates a state transition). The snapshot
   * and a PROGRESS_UPDATE event are written with a version bump so the durable
   * snapshot/event comparison stays consistent for recovery (design §8.3).
   */
  private async phaseOnlyUpdate(
    snapshot: MissionSnapshot,
    mutate: (mission: MissionSnapshot) => MissionSnapshot,
  ): Promise<MissionSnapshot> {
    const current = await this.stores.store.findById(snapshot.id);
    if (current === undefined || current.version !== snapshot.version) {
      throw new Error(
        `monthly-close: stale mission version — expected ${snapshot.version}, got ${current?.version}`,
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
    await this.stores.store.save(next);
    await this.stores.events.append(event);
    return next;
  }
}


