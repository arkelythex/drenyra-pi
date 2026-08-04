/**
 * Monthly-close 12-step fixture flow — T-S5B-003 (REQ-CHAIN-001; SC-CHAIN-001).
 *
 * Proves the full v0.1 monthly-close happy path end-to-end on bounded fixture
 * sources: company/period bound → ingest balance, mayor, auxiliaries, and bank
 * movements → validate source integrity → reconcile → anomaly → evidence
 * request/satisfaction (through the evidence chain) → proposal with a real
 * evidence hash → human approval → signed receipt → export artifact. The flow
 * also covers the evidence-wait loop (SC-CHAIN-002 resolution), the R2 gate-block
 * path (SC-CHAIN-004), and closes with a verify-chain pass over the mission's
 * graph and persisted receipt (SC-CHAIN-003/006 basis).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase hex
 * sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AccountingMissionStatus,
  WaitReason,
} from "drenyra-ai/missions";
import { computeEvidenceHash } from "drenyra-ai/receipts";
import { EDA_PHASE } from "../../lib/accounting-status.js";
import { sha256Canonical } from "../../lib/canonicalization.js";
import {
  EvidenceGraphStore,
  EVIDENCE_NODE_KIND,
} from "../../lib/evidence-graph.js";
import { ReceiptStore } from "../../lib/receipt-store.js";
import { runChainStep, type ChainRunResult } from "../../lib/chain-pipeline.js";
import { evidenceChain } from "../evidence.js";
import { verifyChain, type VerifyRunOutput } from "../verify.js";
import { MonthlyCloseChain, MonthlyCloseWaitError } from "../monthly-close.js";
import { makeScopeBinding } from "../../__tests__/helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-close-flow-"));
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

/** Fixture sources: balance, mayor, auxiliaries, bank movements. */
const SOURCE_NODES = [
  {
    id: "src-balance",
    kind: "balance-snapshot",
    reference: "BAL-202507",
    amountCents: 1_000_000,
  },
  {
    id: "src-mayor",
    kind: "mayor-snapshot",
    reference: "MAY-202507",
    amountCents: 600_000,
  },
  {
    id: "src-auxiliaries",
    kind: "auxiliaries-snapshot",
    reference: "AUX-202507",
    amountCents: 400_000,
  },
  {
    id: "src-bank",
    kind: "bank-movements",
    reference: "BNK-202507",
    amountCents: 250_000,
  },
];

/** The verify-chain source manifest for the close mission's fixtures. */
const VERIFY_MANIFEST = {
  ledger: [
    { account: "101", reference: "B001", debitCents: 1_000_000, creditCents: 0 },
    { account: "401", reference: "B001", debitCents: 0, creditCents: 1_000_000 },
    { account: "101", reference: "B002", debitCents: 250_000, creditCents: 0 },
    { account: "401", reference: "B002", debitCents: 0, creditCents: 250_000 },
  ],
  bank: [
    { reference: "B001", amountCents: 1_000_000 },
    { reference: "B002", amountCents: 250_000 },
  ],
  bankAccount: "101",
};

/** A verify-chain binding whose source snapshot digest matches the manifest. */
function matchedBinding() {
  return makeScopeBinding({ sourceSnapshot: sha256Canonical(VERIFY_MANIFEST) });
}

describe("monthly-close 12-step fixture flow (REQ-CHAIN-001; SC-CHAIN-001)", () => {
  it("runs intake → evidence wait → evidence satisfaction → proposal → approval → receipt → export", async () => {
    const root = tempRoot();
    const binding = makeScopeBinding();
    const chain = new MonthlyCloseChain(binding, { storesRoot: root });

    // Step 1-2: company/period bound; the mission starts with the full EDA plan.
    const started = await chain.startMission({
      sourceRefs: [],
      materiality: R2_MATERIALITY,
    });
    expect(started.steps).toHaveLength(13);
    expect(started.companyId).toBe(binding.scope.company);
    expect(started.fiscalPeriod).toBe(binding.scope.fiscalPeriod);

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

    // Step 6-7: evidence is satisfied through the EVIDENCE CHAIN (balance, mayor,
    // auxiliaries, bank movements land in the close mission's evidence graph).
    for (const source of SOURCE_NODES) {
      const result = await runChainStep(evidenceChain, {
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
      expect(result.mission?.status).toBeDefined();
    }
    const graph = new EvidenceGraphStore(root);
    expect((await graph.load(current.id)).nodes).toHaveLength(SOURCE_NODES.length);

    // Resume from the evidence wait (explicit; never auto-advanced), then the
    // ingest phase completes with the graph evidence.
    const resumed = await chain.advance({
      missionId: current.id,
      satisfyEvidence: true,
    });
    expect(resumed.mission.status).toBe(AccountingMissionStatus.RUNNING);
    const ingested = await chain.advance({ missionId: current.id });
    expect(ingested.phase).toBe(EDA_PHASE.INGEST);
    expect(ingested.mission.status).toBe(AccountingMissionStatus.RUNNING);

    // Step 8-10: proposal with a REAL evidence hash over the graph, approval, receipt.
    let close: Awaited<ReturnType<MonthlyCloseChain["run"]>> | undefined;
    try {
      const result = await chain.run({
        approverId: "contador-01",
        reason: "cierre mensual v0.1",
        sourceRefs: [],
        materiality: R2_MATERIALITY,
      });
      close = result;
    } catch (error) {
      // The evidence-wait loop must resolve or raise a proposal (SC-CHAIN-002):
      // the mission already has evidence, so the close must complete.
      expect(error).toBeInstanceOf(MonthlyCloseWaitError);
      throw error;
    }
    expect(close).toBeDefined();
    expect(close!.mission.status).toBe(AccountingMissionStatus.COMPLETED);
    expect(close!.approval.approverId).toBe("contador-01");

    // The proposal carries a real evidence hash bound to the graph evidence.
    const proposal = close!.mission.proposal;
    expect(proposal).not.toBeNull();
    expect(proposal?.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal?.evidenceHash).not.toBe("pending");
    const citedIds = proposal?.evidence.map((item) => item.id) ?? [];
    for (const source of SOURCE_NODES) {
      expect(citedIds).toContain(source.id);
    }
    expect(proposal?.evidenceHash).toBe(computeEvidenceHash(proposal?.evidence ?? []));

    // Step 11: the signed receipt is persisted in the immutable receipt store and
    // bound to the mission, evidence, scope, and target.
    const receiptStore = new ReceiptStore(root);
    const persisted = await receiptStore.load(close!.receipt.receiptHash);
    expect(persisted).toBeDefined();
    expect(persisted!.binding.scopeHash).toBe(binding.scopeHash);
    expect(persisted!.binding.evidenceHash).toBe(proposal?.evidenceHash);
    expect(persisted!.receipt.content.missionId).toBe(close!.mission.id);
    expect(close!.mission.receiptHash).toBe(close!.receipt.receiptHash);

    // Step 12: the export artifact exists (v0.1 step 12).
    const exportPath = join(root, ".local", "exports", `${close!.mission.id}.json`);
    expect(existsSync(exportPath)).toBe(true);
    const exported = JSON.parse(readFileSync(exportPath, "utf8")) as {
      schemaVersion?: number;
      kind?: string;
      missionId?: string;
      evidenceHash?: string;
      receiptHash?: string;
    };
    expect(exported.schemaVersion).toBe(1);
    expect(exported.kind).toBe("monthly-close-export");
    expect(exported.missionId).toBe(close!.mission.id);
    expect(exported.evidenceHash).toBe(proposal?.evidenceHash);
    expect(exported.receiptHash).toBe(close!.receipt.receiptHash);

    // Verify chain: the close mission's graph is intact and the persisted receipt
    // binding matches the mission and proposal (SC-CHAIN-003/006 basis).
    let verifyResult: ChainRunResult<VerifyRunOutput> | undefined;
    for (let index = 0; index < 24; index += 1) {
      verifyResult = await runChainStep(verifyChain, {
        binding: matchedBinding(),
        input: { manifest: VERIFY_MANIFEST, missionId: close!.mission.id },
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
    expect(checks.some((check) => check.check === "graph-integrity" && check.verdict === "pass")).toBe(true);
    expect(checks.some((check) => check.check === "receipt-binding" && check.verdict === "pass")).toBe(true);
    expect(verifyResult?.output?.verdict).toBe("verified");
  });

  it("an R2 close without approvals stops at BLOCKED_BY_GATE and reports the approval as next action (SC-CHAIN-004)", async () => {
    const root = tempRoot();
    const chain = new MonthlyCloseChain(makeScopeBinding(), { storesRoot: root });
    const mission = await chain.startMission({
      sourceRefs: ["balance-general.csv"],
      materiality: R2_MATERIALITY,
    });

    let current = mission;
    let gateBlocked = false;
    for (let index = 0; index < 14; index += 1) {
      const step = await chain.advance({ missionId: current.id });
      current = step.mission;
      if (step.waitReason === WaitReason.POLICY_GATE) {
        gateBlocked = true;
        break;
      }
    }
    expect(gateBlocked).toBe(true);
    expect(current.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
    const approveStep = current.steps.find((step) => step.id === EDA_PHASE.APPROVE);
    expect(approveStep?.status).toBe("PENDING");
    // No phase advances without an approver.
    const again = await chain.advance({ missionId: current.id });
    expect(again.phase).toBeNull();
    expect(again.mission.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
  });
});
