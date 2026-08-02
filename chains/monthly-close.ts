/**
 * Monthly-close RDA chain — the operator-facing fiscal close workflow.
 *
 * The chain runs a `monthly-close` mission through the pinned Drenyra AI
 * runtime (package-local), enforces the **R2 approval gate** (monthly close is
 * a batch mutation: explicit human approval, never automatic), and produces a
 * **signed receipt** as the immutable proof of the close.
 *
 * Scope (company RUC + fiscal period) comes from the harness context and is
 * validated fail-closed: a close without scope or without an explicit approver
 * never proceeds.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */

import { createHash } from "node:crypto";
import {
  AccountingMissionStatus,
  MissionRuntime,
  IntentRegistryImpl,
  InMemoryMissionStore,
  InMemoryMissionEventStore,
  InMemoryIdempotencyStore,
  type BoundMissionCommand,
  type IntentHandler,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import {
  ApprovalGate,
  type ApprovalRecord,
  type GateResult,
} from "drenyra-ai/gates";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
  type SignedReceipt,
} from "drenyra-ai/receipts";
import type { ScopeContext } from "../runtime/context.js";

export interface MonthlyCloseInput {
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
 * Intent handler for monthly-close: the close advances through the mission
 * states (queued → running → awaiting-approval) and, once approved, completes.
 * Every transition it returns is protocol-legal (VALID_TRANSITIONS).
 */
const MONTHLY_CLOSE_HANDLER: IntentHandler = {
  intent: "monthly-close",
  async execute(mission: MissionSnapshot): Promise<MissionSnapshot | null> {
    // Advance exactly one legal step per execute (VALID_TRANSITIONS):
    // DRAFT→QUEUED→RUNNING→AWAITING_APPROVAL, and APPROVED→COMPLETED once
    // the R2 approval gate has been passed.
    if (mission.status === AccountingMissionStatus.DRAFT) {
      return { ...mission, status: AccountingMissionStatus.QUEUED };
    }
    if (mission.status === AccountingMissionStatus.QUEUED) {
      return { ...mission, status: AccountingMissionStatus.RUNNING };
    }
    if (mission.status === AccountingMissionStatus.RUNNING) {
      return { ...mission, status: AccountingMissionStatus.AWAITING_APPROVAL };
    }
    if (mission.status === AccountingMissionStatus.APPROVED) {
      return { ...mission, status: AccountingMissionStatus.COMPLETED };
    }
    return null;
  },
};

/**
 * The monthly-close RDA chain. Uses the pinned Drenyra AI runtime with
 * in-memory stores (the chain is a workflow; the signed receipt is the durable
 * proof). Fail-closed: missing scope or missing approver blocks the close.
 */
export class MonthlyCloseChain {
  private readonly scope: ScopeContext;
  private readonly runtime: MissionRuntime;
  private readonly approvalGate: ApprovalGate;

  constructor(scope: ScopeContext) {
    this.scope = scope;
    const registry = new IntentRegistryImpl();
    registry.register(MONTHLY_CLOSE_HANDLER);
    this.runtime = new MissionRuntime({
      store: new InMemoryMissionStore(),
      events: new InMemoryMissionEventStore(),
      idempotency: new InMemoryIdempotencyStore(),
      registry,
    });
    this.approvalGate = new ApprovalGate();
  }

  private requireScope(): { companyId: string; fiscalPeriod: string } {
    if (this.scope.company === undefined || this.scope.period === undefined) {
      throw new Error(
        "monthly-close: company and fiscal period scope are required — set them with /drenyra:company and /drenyra:period",
      );
    }
    return {
      companyId: this.scope.company.ruc,
      fiscalPeriod: this.scope.period.period,
    };
  }

  /** Run the close: mission lifecycle + R2 approval gate + signed receipt. */
  async run(input: MonthlyCloseInput): Promise<MonthlyCloseResult> {
    const { companyId, fiscalPeriod } = this.requireScope();
    const approverId = input.approverId.trim();
    if (approverId.length === 0) {
      throw new Error("monthly-close: an approver is required (R2: explicit human approval)");
    }

    // 1. Create the monthly-close mission (DRAFT).
    const started = await this.runtime.start({
      companyId,
      fiscalPeriod,
      intent: "monthly-close",
      input: { instruction: `Close books for ${fiscalPeriod}` },
    });

    // 2. Drive the lifecycle: queued → running → awaiting-approval.
    let mission = started;
    for (const expected of [1, 2, 3] as const) {
      mission = (
        await this.runtime.apply(executeCommand(mission.id, expected), {
          expectedMissionVersion: expected,
        })
      ).snapshot;
    }
    if (mission.status !== AccountingMissionStatus.AWAITING_APPROVAL) {
      throw new Error(
        `monthly-close: mission did not reach the approval gate (status ${mission.status})`,
      );
    }

    // 3. R2 approval gate: monthly close is R2 — explicit single approval.
    const approval: ApprovalRecord = {
      approverId,
      at: new Date().toISOString(),
      reason: input.reason ?? "monthly close",
    };
    const gateResult: GateResult = this.approvalGate.evaluate({
      materiality: "R2",
      approval: [approval],
    });
    if (gateResult.verdict !== "allowed") {
      throw new Error(
        `monthly-close: approval gate blocked — ${gateResult.reason}${
          gateResult.envelope !== undefined
            ? ` (${JSON.stringify(gateResult.envelope)})`
            : ""
        }`,
      );
    }

    // 4. Approve → APPROVED, then complete → COMPLETED.
    mission = (
      await this.runtime.apply(
                    {
                      type: "approve",
                      missionId: mission.id,
                      payload: {
                        proposalId: "monthly-close",
                        proposalVersion: mission.version,
                        evidenceHash: "pending",
                        expectedMissionVersion: mission.version,
                      },
                    },
        { expectedMissionVersion: mission.version },
      )
    ).snapshot;
    mission = (
      await this.runtime.apply(executeCommand(mission.id, mission.version), {
        expectedMissionVersion: mission.version,
      })
    ).snapshot;

    // 5. Signed receipt: the immutable proof of the close (RED).
    const evidenceHash = createHash("sha256")
      .update(
        JSON.stringify({ missionId: mission.id, status: mission.status, version: mission.version }),
      )
      .digest("hex");
    const keyPair = generateReceiptKeyPair("close_" + mission.id.slice(0, 8));
    const receipt = buildSignedReceipt(
      {
        missionId: mission.id,
        companyId,
        actorId: approverId,
        decision: "APPROVE",
        proposalVersion: mission.version,
        evidenceHash,
        previousStatus: AccountingMissionStatus.APPROVED,
        newStatus: AccountingMissionStatus.COMPLETED,
        payloadHash: evidenceHash,
        timestamp: new Date().toISOString(),
      },
      keyPair,
    );

    return { mission, receipt, approval };
  }
}

function executeCommand(missionId: string, expectedVersion: number): BoundMissionCommand {
  return {
    type: "execute",
    missionId,
    payload: { expectedMissionVersion: expectedVersion },
  };
}
