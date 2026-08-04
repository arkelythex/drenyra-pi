/**
 * Monthly-close RDA chain tests — T-S3A-003 (durable stores + full EDA step
 * plan + one-phase continuation; design §11.2). The chain runs a monthly-close
 * mission over the durable mission stores, enforces the R2 approval gate with
 * explicit materiality derivation, and produces a signed receipt bound to a
 * real evidence hash. Fail-closed: incomplete scope, missing approver, missing
 * evidence, or a blocked approval gate never auto-advance.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  IntentRegistryImpl,
  MissionRuntime,
  WaitReason,
} from "drenyra-ai/missions";
import { computeEvidenceHash, verifySignedReceipt } from "drenyra-ai/receipts";
import type { MaterialityInput } from "drenyra-ai/candidates";
import { makeScopeBinding } from "../../__tests__/helpers/authority-fixtures.js";
import { createEdaSteps, EDA_PHASE, EDA_PHASE_ORDER } from "../../lib/accounting-status.js";
import { recoverDurableMissions } from "../../lib/mission-store.js";
import {
  MonthlyCloseChain,
  MonthlyCloseWaitError,
} from "../monthly-close.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-monthly-close-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** R2-level materiality input (partially-reversible), floored to R2. */
const R2_MATERIALITY = {
  value: 10_000_00n,
  reversibility: "partially-reversible" as const,
  jurisdiction: "PE",
};

const SOURCE_REFS = [
  "balance-general.csv",
  "mayor.csv",
  "auxiliares.csv",
  "estado-bancos.csv",
];

function startInput(
  overrides: Partial<{ sourceRefs: string[]; materiality: MaterialityInput }> = {},
) {
  return {
    sourceRefs: SOURCE_REFS,
    materiality: R2_MATERIALITY,
    ...overrides,
  };
}

describe("MonthlyCloseChain over durable stores", () => {
  it("completes the close with an R2 approver, a signed receipt, and a real evidence hash", async () => {
    const root = tempRoot();
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: root });
    const result = await chain.run({
      approverId: "contador-01",
      reason: "cierre mensual",
      ...startInput(),
    });

    expect(result.mission.status).toBe("COMPLETED");
    expect(result.mission.intent).toBe("monthly-close");
    expect(result.mission.companyId).toBe("20123456786");
    expect(result.mission.fiscalPeriod).toBe("202507");
    expect(result.approval.approverId).toBe("contador-01");

    // The receipt is self-verifying: hash + Ed25519 signature valid.
    const verification = verifySignedReceipt(result.receipt);
    expect(verification.valid).toBe(true);
    expect(result.receipt.content.decision).toBe("APPROVE");
    expect(result.receipt.content.companyId).toBe("20123456786");
    expect(result.receipt.content.actorId).toBe("contador-01");
    expect(result.receipt.content.newStatus).toBe("COMPLETED");

    // REQ-CHAIN-001: the proposal carries a real evidence hash — the hardcoded
    // "pending" digest is gone.
    expect(result.mission.proposal).not.toBeNull();
    const proposal = result.mission.proposal;
    expect(proposal?.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal?.evidenceHash).not.toBe("pending");
    expect(proposal?.evidenceHash).toBe(computeEvidenceHash(proposal?.evidence ?? []));
    expect(result.receipt.content.evidenceHash).toBe(proposal?.evidenceHash);
  });

  it("fails closed without a complete canonical scope (REQ-SCOPE-009)", () => {
    // bindScope rejects the incomplete scope before the chain constructor runs
    // (fail-closed either way: no close can start without a complete scope).
    expect(() => new MonthlyCloseChain(makeScopeBinding({ tenant: "" }))).toThrow(
      /non-empty|incomplete canonical scope/,
    );
  });

  it("fails closed without an approver (R2 requires explicit human approval)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    await expect(
      chain.run({ approverId: "   ", ...startInput() }),
    ).rejects.toThrow(/approver is required/);
  });

  it("fails closed when the explicit materiality input is missing (REQ-AUTH-004/005)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    await expect(
      chain.run({
        approverId: "contador-01",
        ...startInput({ materiality: undefined }),
      }),
    ).rejects.toThrow(/materiality input missing/);
  });

  it("runs over durable stores and the mission survives store re-creation (SC-MISS-003)", async () => {
    const root = tempRoot();
    const chainA = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: root });
    const result = await chainA.run({ approverId: "contador-01", ...startInput() });

    // A fresh chain over the same root sees the same durable mission.
    const chainB = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: root });
    const reloaded = await chainB.stores.store.findById(result.mission.id);
    expect(reloaded).toBeDefined();
    expect(reloaded?.status).toBe("COMPLETED");
    expect(reloaded?.steps).toHaveLength(13);
    expect(reloaded?.steps.every((step) => step.status === "COMPLETED")).toBe(true);

    // Recovery over the recreated stores preserves the terminal mission.
    const runtime = new MissionRuntime({
      store: chainB.stores.store,
      events: chainB.stores.events,
      idempotency: chainB.stores.idempotency,
      registry: new IntentRegistryImpl(),
    });
    const report = await recoverDurableMissions(runtime, chainB.stores);
    expect(report.unresolved).toEqual([]);
    expect(report.preserved.map((m) => m.id)).toContain(result.mission.id);
    expect(report.recovered).toEqual([]);
  });

  it("creates the mission with the full 13-step EDA plan (REQ-MISS-001)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    const mission = await chain.startMission(startInput());
    expect(mission.steps).toHaveLength(13);
    expect(mission.steps.map((step) => step.id)).toEqual(EDA_PHASE_ORDER);
    expect(mission.steps.every((step) => step.status === "PENDING")).toBe(true);
    expect(mission.steps).toEqual(createEdaSteps("monthly-close"));
  });

  it("advances exactly one EDA phase per execute (REQ-MISS-004; SC-MISS-001)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    const mission = await chain.startMission(startInput());

    const phases: string[] = [];
    let current = mission;
    let guard = 0;
    while (guard < 20) {
      guard += 1;
      const before = current.steps.filter(
        (step) => step.status !== "PENDING",
      ).length;
      const step = await chain.advance({
        missionId: current.id,
        approverId: "contador-01",
      });
      current = step.mission;
      if (step.phase === null) {
        break; // terminal or wait
      }
      const after = current.steps.filter((stepStatus) => stepStatus.status !== "PENDING").length;
      expect(after, `phase ${step.phase ?? "none"} must advance exactly one step`).toBe(
        before + 1,
      );
      phases.push(step.phase);
      if (current.status === AccountingMissionStatus.COMPLETED) {
        break;
      }
    }

    // The whole canonical sequence, one phase per advance, ending at archive.
    expect(phases).toEqual(EDA_PHASE_ORDER);
    expect(current.status).toBe(AccountingMissionStatus.COMPLETED);
    expect(current.steps.every((step) => step.status === "COMPLETED")).toBe(true);
    expect(current.currentStep).toBe(EDA_PHASE.ARCHIVE);
  });

  it("lands in WAITING_FOR_EVIDENCE with no auto-advance when evidence is missing (SC-MISS-005)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    const mission = await chain.startMission(startInput({ sourceRefs: [] }));

    // Drive to the ingest phase; evidence missing -> engine-legal evidence wait.
    let current = mission;
    let sawWait = false;
    for (let i = 0; i < 10; i += 1) {
      const step = await chain.advance({ missionId: current.id });
      current = step.mission;
      if (step.waitReason === WaitReason.EVIDENCE) {
        sawWait = true;
        break;
      }
    }
    expect(sawWait).toBe(true);
    expect(current.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    expect(
      current.blockers.some(
        (blocker) => blocker.reason.toLowerCase().includes("evidence"),
      ),
    ).toBe(true);

    // No auto-advance: the next continuation stays in the wait, phase unchanged.
    const again = await chain.advance({ missionId: current.id });
    expect(again.waitReason).toBe(WaitReason.EVIDENCE);
    expect(again.phase).toBeNull();
    expect(again.mission.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    const ingestStep = again.mission.steps.find((step) => step.id === EDA_PHASE.INGEST);
    expect(ingestStep?.status).toBe("IN_PROGRESS");
  });

  it("run() fails closed with a structured wait error when evidence is missing", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    try {
      await chain.run({ approverId: "contador-01", ...startInput({ sourceRefs: [] }) });
      throw new Error("expected run() to fail closed at the evidence wait");
    } catch (error) {
      expect(error).toBeInstanceOf(MonthlyCloseWaitError);
      const waitError = error as MonthlyCloseWaitError;
      expect(waitError.waitReason).toBe(WaitReason.EVIDENCE);
      expect(waitError.mission.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    }
  });

  it("reports a POLICY_GATE wait and never advances when the approval gate blocks (SC-MISS-006)", async () => {
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: tempRoot() });
    const mission = await chain.startMission(startInput());

    // Drive through the nine pre-approval phases WITHOUT an approver.
    let current = mission;
    let gateBlocked = false;
    for (let i = 0; i < 12; i += 1) {
      const step = await chain.advance({ missionId: current.id });
      current = step.mission;
      if (step.waitReason === WaitReason.POLICY_GATE) {
        gateBlocked = true;
        break;
      }
    }
    expect(gateBlocked).toBe(true);
    expect(current.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
    // The approve phase never advanced.
    const approveStep = current.steps.find((step) => step.id === EDA_PHASE.APPROVE);
    expect(approveStep?.status).toBe("PENDING");

    // No phase advances on further continuation: POLICY_GATE wait reported.
    const again = await chain.advance({ missionId: current.id });
    expect(again.waitReason).toBe(WaitReason.POLICY_GATE);
    expect(again.phase).toBeNull();
    expect(again.mission.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
  });
});
