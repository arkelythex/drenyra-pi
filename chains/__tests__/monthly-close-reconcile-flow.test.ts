/**
 * Monthly-close x real reconciliation multi-chain integration test — PR2
 * (pi-monthly-close-journey; REQ-CHAIN-001; SC-CHAIN-001/004).
 *
 * Drives one monthly-close mission carrying a deliberate bank-vs-ledger
 * anomaly through the real runtime: sources -> real reconciliation (RECONCILE
 * now calls `computeReconcileDifferences`, not a no-op) -> evidence ->
 * proposal -> approval (including the R2-gate fail-closed negative case) ->
 * execution -> close -> verify. Uses the same real-runtime harness as
 * `monthly-close-flow.test.ts` (temp-dir stores, real
 * `MissionRuntime`/`ApprovalGate`/receipts — no mocks).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus, WaitReason } from "drenyra-ai/missions";
import { EDA_PHASE } from "../../lib/accounting-status.js";
import { sha256Canonical } from "../../lib/canonicalization.js";
import { EvidenceGraphStore, EVIDENCE_NODE_KIND } from "../../lib/evidence-graph.js";
import { ReceiptStore } from "../../lib/receipt-store.js";
import { runChainStep, type ChainRunResult } from "../../lib/chain-pipeline.js";
import { evidenceChain } from "../evidence.js";
import { verifyChain, type VerifyRunOutput } from "../verify.js";
import { MonthlyCloseChain } from "../monthly-close.js";
import { makeScopeBinding } from "../../__tests__/helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-close-reconcile-flow-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** R2-level materiality (partially-reversible), floored to R2. */
const R2_MATERIALITY = {
  value: 10_000_00n,
  reversibility: "partially-reversible" as const,
  jurisdiction: "PE",
};

/** Deliberate bank-vs-ledger anomaly (design "New Integration Test Fixture"). */
const RECONCILE_MANIFEST = {
  bank: [{ reference: "B002", amountCents: 250_000 }],
  ledger: [{ reference: "B002", amountCents: 230_000 }],
};

/** One evidence source so the mission can leave WAITING_FOR_EVIDENCE. */
const SOURCE_NODES = [
  {
    id: "src-balance",
    kind: "balance-snapshot",
    reference: "BAL-202508",
    amountCents: 1_000_000,
  },
];

/** The verify-chain source manifest — independent of the reconcile anomaly. */
const VERIFY_MANIFEST = {
  ledger: [
    { account: "101", reference: "B001", debitCents: 1_000_000, creditCents: 0 },
    { account: "401", reference: "B001", debitCents: 0, creditCents: 1_000_000 },
  ],
  bank: [{ reference: "B001", amountCents: 1_000_000 }],
  bankAccount: "101",
};

/** A verify-chain binding whose source snapshot digest matches the manifest. */
function matchedBinding() {
  return makeScopeBinding({ sourceSnapshot: sha256Canonical(VERIFY_MANIFEST) });
}

describe("monthly-close x real reconciliation (REQ-CHAIN-001; SC-CHAIN-001/004)", () => {
  it(
    "runs sources -> real reconciliation anomaly -> evidence -> proposal -> " +
      "approval (incl. R2-gate negative case) -> execution -> close -> verify",
    async () => {
      const root = tempRoot();
      const binding = makeScopeBinding();
      const chain = new MonthlyCloseChain(binding, { storesRoot: root });

      // Step 1-2: company/period bound with a bounded reconciliation manifest.
      const started = await chain.startMission({
        sourceRefs: [],
        materiality: R2_MATERIALITY,
        reconcileManifest: RECONCILE_MANIFEST,
      });
      expect(started.steps).toHaveLength(13);

      // Step 3-5: drive to the ingest phase; evidence is missing -> evidence wait.
      let current = started;
      let evidenceWait = false;
      for (let index = 0; index < 8; index += 1) {
        const step = await chain.advance({ missionId: current.id });
        current = step.mission;
        if (step.waitReason === WaitReason.EVIDENCE) {
          evidenceWait = true;
          break;
        }
      }
      expect(evidenceWait).toBe(true);
      expect(current.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);

      // Step 6-7: satisfy evidence through the evidence chain, then resume ingest.
      for (const source of SOURCE_NODES) {
        await runChainStep(evidenceChain, {
          binding,
          input: {
            missionId: current.id,
            op: {
              op: "add-node",
              node: {
                id: source.id,
                nodeKind: EVIDENCE_NODE_KIND.SOURCE,
                payload: {
                  kind: source.kind,
                  reference: source.reference,
                  amountCents: source.amountCents,
                },
              },
            },
          },
          storesRoot: root,
        });
      }
      const resumed = await chain.advance({ missionId: current.id, satisfyEvidence: true });
      expect(resumed.mission.status).toBe(AccountingMissionStatus.RUNNING);
      const ingested = await chain.advance({ missionId: current.id });
      expect(ingested.phase).toBe(EDA_PHASE.INGEST);
      current = ingested.mission;

      // NORMALIZE, CLASSIFY: unaffected phase-only advances (REQ-MISS-004: one
      // bounded phase per advance).
      for (let index = 0; index < 2; index += 1) {
        const step = await chain.advance({ missionId: current.id });
        current = step.mission;
      }

      // RECONCILE: real reconciliation now runs (not a no-op) — the deliberate
      // B002 discrepancy becomes an anomaly-B002 CONCLUSION node cited by a
      // DERIVED_FROM edge from src-bank-B002, plus an ERROR blocker, and the
      // phase still completes (design decision 3: RECONCILE never halts).
      const reconciled = await chain.advance({ missionId: current.id });
      expect(reconciled.phase).toBe(EDA_PHASE.RECONCILE);
      current = reconciled.mission;
      const reconcileStep = current.steps.find((step) => step.id === EDA_PHASE.RECONCILE);
      expect(reconcileStep?.status).toBe("COMPLETED");

      const graph = new EvidenceGraphStore(root);
      const loaded = await graph.load(current.id);
      const anomaly = loaded.nodes.find((node) => node.id === "anomaly-B002");
      expect(anomaly).toBeDefined();
      expect(anomaly?.nodeKind).toBe(EVIDENCE_NODE_KIND.CONCLUSION);
      expect(
        loaded.edges.some(
          (edge) =>
            edge.from === "src-bank-B002" &&
            edge.to === "anomaly-B002" &&
            edge.relation === "DERIVED_FROM",
        ),
      ).toBe(true);
      expect(
        current.blockers.some(
          (blocker) =>
            blocker.severity === "ERROR" &&
            blocker.resolvedAt === undefined &&
            blocker.reason.toLowerCase().includes("reconcil"),
        ),
      ).toBe(true);

      // INVESTIGATE: unaffected phase-only advance.
      const investigated = await chain.advance({ missionId: current.id });
      current = investigated.mission;

      // PROPOSE: the anomaly conclusion is auto-cited by the existing generic
      // evidenceFor()/buildProposal() (zero PROPOSE changes needed) and bumps
      // riskLevel to MEDIUM.
      const proposed = await chain.advance({ missionId: current.id });
      expect(proposed.phase).toBe(EDA_PHASE.PROPOSE);
      current = proposed.mission;
      expect(current.proposal?.riskLevel).toBe("MEDIUM");
      const citedIds = current.proposal?.evidence.map((item) => item.id) ?? [];
      expect(citedIds).toContain("anomaly-B002");

      // VERIFY: harness phase-only advance inside the monthly-close journey
      // (distinct from the standalone verify chain exercised further below).
      const verifiedPhase = await chain.advance({ missionId: current.id });
      current = verifiedPhase.mission;

      // APPROVE negative case (SC-CHAIN-004): no approver -> BLOCKED_BY_GATE,
      // no phase advance.
      const blocked = await chain.advance({ missionId: current.id });
      expect(blocked.waitReason).toBe(WaitReason.POLICY_GATE);
      expect(blocked.mission.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
      const pendingApproveStep = blocked.mission.steps.find(
        (step) => step.id === EDA_PHASE.APPROVE,
      );
      expect(pendingApproveStep?.status).toBe("PENDING");
      current = blocked.mission;

      // Approve with an explicit R2 approver: the gate opens and APPROVE completes.
      const approved = await chain.advance({
        missionId: current.id,
        approverId: "contador-01",
        reason: "cierre con reconciliación real",
      });
      expect(approved.phase).toBe(EDA_PHASE.APPROVE);
      current = approved.mission;
      const approveStep = current.steps.find((step) => step.id === EDA_PHASE.APPROVE);
      expect(approveStep?.status).toBe("COMPLETED");

      // EXECUTE, CLOSE: the close phase seals a signed receipt (REQ-CHAIN-007).
      const executed = await chain.advance({ missionId: current.id });
      expect(executed.phase).toBe(EDA_PHASE.EXECUTE);
      current = executed.mission;

      const closed = await chain.advance({
        missionId: current.id,
        approverId: "contador-01",
      });
      expect(closed.phase).toBe(EDA_PHASE.CLOSE);
      current = closed.mission;
      expect(current.receiptHash).toBeDefined();
      const receiptHash = current.receiptHash as string;

      const receiptStore = new ReceiptStore(root);
      const receiptRecord = await receiptStore.load(receiptHash);
      expect(receiptRecord).toBeDefined();
      expect(receiptRecord?.receipt.content.missionId).toBe(current.id);
      expect(receiptRecord?.binding.evidenceHash).toBe(current.proposal?.evidenceHash);

      // ARCHIVE: the mission reaches COMPLETED.
      const archived = await chain.advance({ missionId: current.id });
      current = archived.mission;
      expect(current.status).toBe(AccountingMissionStatus.COMPLETED);

      // Verify chain: the mission's evidence graph is intact and the persisted
      // receipt binding matches the mission and proposal (SC-CHAIN-003/006 basis).
      let verifyResult: ChainRunResult<VerifyRunOutput> | undefined;
      for (let index = 0; index < 24; index += 1) {
        verifyResult = await runChainStep(verifyChain, {
          binding: matchedBinding(),
          input: { manifest: VERIFY_MANIFEST, missionId: current.id },
          storesRoot: root,
        });
        if (verifyResult.phase === EDA_PHASE.VERIFY) {
          break;
        }
        if (verifyResult.mission?.status === AccountingMissionStatus.COMPLETED) {
          break;
        }
      }
      expect(verifyResult?.output).toBeDefined();
      const checks = verifyResult?.output?.checks ?? [];
      expect(
        checks.some((check) => check.check === "graph-integrity" && check.verdict === "pass"),
      ).toBe(true);
      expect(
        checks.some((check) => check.check === "receipt-binding" && check.verdict === "pass"),
      ).toBe(true);
      expect(verifyResult?.output?.verdict).toBe("verified");
    },
  );
});
