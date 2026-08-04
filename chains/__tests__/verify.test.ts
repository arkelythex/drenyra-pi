/**
 * Verify chain tests — T-S5B-001 (design §11.4; REQ-CHAIN-003; SC-CHAIN-003).
 *
 * The verify chain runs a `verify` mission through the shared chain pipeline and
 * performs a fixed check list — source snapshot integrity, ledger equations,
 * reconciliation correctness, graph integrity, scope binding, and receipt binding
 * where applicable — returning per-check verdicts and stopping protected
 * downstream work at the first blocking verdict. The chain is read-only: it never
 * appends evidence nodes/edges, never writes receipts, and never mutates
 * accounting outputs (REQ-AUTH-009).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or integer decimal strings at JSON boundaries — never floats);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import { EDA_PHASE } from "../../lib/accounting-status.js";
import { sha256Canonical } from "../../lib/canonicalization.js";
import {
  EvidenceGraphStore,
  EVIDENCE_NODE_KIND,
} from "../../lib/evidence-graph.js";
import { createDurableMissionStores } from "../../lib/mission-store.js";
import { ReceiptStore, type HarnessReceiptRecord } from "../../lib/receipt-store.js";
import { runChainStep, type ChainRunResult } from "../../lib/chain-pipeline.js";
import {
  checkLedgerEquations,
  checkReceiptBinding,
  checkReconciliationCorrectness,
  checkSourceSnapshotIntegrity,
  parseVerifyInput,
  verifyChain,
  VerifyChainBlockedError,
  type VerifyChainInput,
  type VerifyRunOutput,
} from "../verify.js";
import {
  makeApprovalReceipt,
  makeMission,
  makeScopeBinding,
} from "../../__tests__/helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-verify-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A balanced fixture source manifest: ledger debits equal credits; bank matches. */
const BALANCED_MANIFEST = {
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

/** A binding whose frozen source-snapshot digest matches the balanced manifest. */
function matchedBinding() {
  return makeScopeBinding({ sourceSnapshot: sha256Canonical(BALANCED_MANIFEST) });
}

/** Drive the verify chain until it throws VerifyChainBlockedError. */
async function driveUntilBlocked(
  root: string,
  input: VerifyChainInput,
  maxSteps = 12,
): Promise<VerifyChainBlockedError> {
  for (let index = 0; index < maxSteps; index += 1) {
    try {
      await runChainStep(verifyChain, {
        binding: matchedBinding(),
        input,
        storesRoot: root,
      });
    } catch (error) {
      if (error instanceof VerifyChainBlockedError) {
        return error;
      }
      throw error;
    }
  }
  throw new Error("verify chain never blocked");
}

describe("verify chain (REQ-CHAIN-003; SC-CHAIN-003)", () => {
  it("reports per-check verdicts and completes the fixed check list (REQ-CHAIN-003)", async () => {
    const root = tempRoot();
    let result: ChainRunResult<VerifyRunOutput> | undefined;
    let verifyPhaseResult: ChainRunResult<VerifyRunOutput> | undefined;
    for (let index = 0; index < 24; index += 1) {
      result = await runChainStep(verifyChain, {
        binding: matchedBinding(),
        input: { manifest: BALANCED_MANIFEST },
        storesRoot: root,
      });
      if (result.phase === EDA_PHASE.VERIFY) {
        verifyPhaseResult = result;
      }
      if (result.mission?.status === AccountingMissionStatus.COMPLETED) {
        break;
      }
    }
    expect(result?.mission?.status).toBe(AccountingMissionStatus.COMPLETED);
    // Every step either completed or was deterministically skipped.
    expect(
      result?.mission?.steps.every(
        (step) => step.status === "COMPLETED" || step.status === "SKIPPED",
      ),
    ).toBe(true);

    // The verify phase ran the graph/scope/receipt binding checks with pass verdicts.
    expect(verifyPhaseResult).toBeDefined();
    const checks = verifyPhaseResult!.output?.checks ?? [];
    expect(checks.map((check) => check.check)).toEqual(
      expect.arrayContaining(["graph-integrity", "scope-binding", "receipt-binding"]),
    );
    expect(checks.every((check) => check.verdict === "pass")).toBe(true);
    expect(verifyPhaseResult!.output?.verdict).toBe("verified");
  });

  it("blocks with a source-integrity failure and no further stage runs (SC-CHAIN-003)", async () => {
    const root = tempRoot();
    // makeScopeBinding() carries sourceSnapshot "a"*64, which can never match the
    // canonical hash of the supplied manifest: the source-integrity check fails.
    const binding = makeScopeBinding();
    let blocked: VerifyChainBlockedError | undefined;
    for (let index = 0; index < 12 && blocked === undefined; index += 1) {
      try {
        await runChainStep(verifyChain, {
          binding,
          input: { manifest: BALANCED_MANIFEST },
          storesRoot: root,
        });
      } catch (error) {
        if (error instanceof VerifyChainBlockedError) {
          blocked = error;
          break;
        }
        throw error;
      }
    }
    expect(blocked).toBeDefined();
    expect(
      blocked!.checks.some(
        (check) => check.check === "source-integrity" && check.verdict === "fail",
      ),
    ).toBe(true);
    expect(blocked!.phase).toBe(EDA_PHASE.INGEST);

    // No further stage ran: the ingest step never completed and no phase advanced
    // past the source-integrity failure.
    const stores = createDurableMissionStores(root);
    const missions = await stores.store.list();
    expect(missions.length).toBeGreaterThan(0);
    const mission = missions[missions.length - 1]!;
    const ingestStep = mission.steps.find((step) => step.id === EDA_PHASE.INGEST);
    expect(ingestStep?.status).toBe("PENDING");

    // Read-only: no evidence nodes and no receipts were written.
    const graph = new EvidenceGraphStore(root);
    expect((await graph.load(mission.id)).nodes).toHaveLength(0);
    const receipts = await new ReceiptStore(root).list();
    expect(receipts).toHaveLength(0);
  });

  it("blocks on a ledger-equations failure at the reconcile check", async () => {
    const root = tempRoot();
    const unbalanced = {
      ...BALANCED_MANIFEST,
      ledger: [
        { account: "101", reference: "B001", debitCents: 1_000_000, creditCents: 0 },
        { account: "401", reference: "B001", debitCents: 0, creditCents: 999_000 },
      ],
    };
    const binding = makeScopeBinding({ sourceSnapshot: sha256Canonical(unbalanced) });
    let blocked: VerifyChainBlockedError | undefined;
    for (let index = 0; index < 12 && blocked === undefined; index += 1) {
      try {
        await runChainStep(verifyChain, {
          binding,
          input: { manifest: unbalanced },
          storesRoot: root,
        });
      } catch (error) {
        if (error instanceof VerifyChainBlockedError) {
          blocked = error;
          break;
        }
        throw error;
      }
    }
    expect(blocked).toBeDefined();
    expect(
      blocked!.checks.some(
        (check) => check.check === "ledger-equations" && check.verdict === "fail",
      ),
    ).toBe(true);
  });

  it("blocks on a reconciliation-correctness failure at the investigate check", async () => {
    const root = tempRoot();
    const wrongBank = {
      ...BALANCED_MANIFEST,
      bank: [
        { reference: "B001", amountCents: 1_000_000 },
        { reference: "B002", amountCents: 200_000 },
      ],
    };
    const binding = makeScopeBinding({ sourceSnapshot: sha256Canonical(wrongBank) });
    let blocked: VerifyChainBlockedError | undefined;
    for (let index = 0; index < 12 && blocked === undefined; index += 1) {
      try {
        await runChainStep(verifyChain, {
          binding,
          input: { manifest: wrongBank },
          storesRoot: root,
        });
      } catch (error) {
        if (error instanceof VerifyChainBlockedError) {
          blocked = error;
          break;
        }
        throw error;
      }
    }
    expect(blocked).toBeDefined();
    expect(
      blocked!.checks.some(
        (check) =>
          check.check === "reconciliation-correctness" && check.verdict === "fail",
      ),
    ).toBe(true);
  });

  it("blocks when the evidence graph integrity is broken (graph-integrity check)", async () => {
    const root = tempRoot();
    // A target mission whose graph holds a tampered node.
    const targetMissionId = "mission-verify-target";
    const graph = new EvidenceGraphStore(root);
    await graph.appendNode({
      id: "src-x",
      missionId: targetMissionId,
      nodeKind: EVIDENCE_NODE_KIND.SOURCE,
      payload: { kind: "ledger", amountCents: 100 },
    });
    // Tamper the persisted payload: the hash no longer matches the content.
    const logPath = join(root, ".local", "evidence", `${targetMissionId}.ndjson`);
    const tampered = readFileSync(logPath, "utf8").replace(
      '"amountCents":100',
      '"amountCents":101',
    );
    expect(tampered).not.toContain('"amountCents":100');
    writeFileSync(logPath, tampered);

    const blocked = await driveUntilBlocked(root, {
      manifest: BALANCED_MANIFEST,
      missionId: targetMissionId,
    });
    expect(
      blocked.checks.some(
        (check) => check.check === "graph-integrity" && check.verdict === "fail",
      ),
    ).toBe(true);
  });

  it("reports a failing receipt-binding check for a record whose evidence hash diverges", async () => {
    // Unit-level: the receipt record's binding evidence hash does not match the
    // mission proposal's evidence hash -> the receipt-binding check fails.
    const mission = makeMission({
      id: "mission-close-001",
      proposal: {
        id: "prop-mission-close-001",
        missionId: "mission-close-001",
        version: 3,
        evidence: [],
        evidenceHash: "a".repeat(64),
        summary: "close",
        riskLevel: "LOW",
        generatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    const approval = makeApprovalReceipt();
    const record: HarnessReceiptRecord = {
      binding: {
        version: "drenyra.receipt-binding.v1",
        scopeHash: "b".repeat(64),
        authorizationId: "auth-001",
        policyVersion: "policies.v1",
        targetHash: "c".repeat(64),
        evidenceHash: "d".repeat(64),
      },
      receipt: approval.receipt,
    };
    const check = await checkReceiptBinding({ record, mission });
    expect(check.verdict).toBe("fail");
    expect(check.detail.toLowerCase()).toContain("evidence");
  });

  it("keeps every operation bounded and deterministic — no floats, stable hashes (REQ-CHAIN-006)", () => {
    // Float money is rejected at the JSON boundary by the parser.
    expect(() =>
      parseVerifyInput(
        JSON.stringify({
          ledger: [{ account: "101", reference: "B1", debitCents: 10.5, creditCents: 0 }],
          bank: [],
        }),
      ),
    ).toThrow(/float/i);
    expect(() =>
      parseVerifyInput(JSON.stringify({ ledger: [], bank: [], extra: true })),
    ).toThrow(/unknown property/i);
    // The pure check functions are deterministic.
    const first = checkSourceSnapshotIntegrity(
      BALANCED_MANIFEST,
      sha256Canonical(BALANCED_MANIFEST),
    );
    const second = checkSourceSnapshotIntegrity(
      BALANCED_MANIFEST,
      sha256Canonical(BALANCED_MANIFEST),
    );
    expect(first.verdict).toBe("pass");
    expect(second).toEqual(first);
    expect(checkLedgerEquations(BALANCED_MANIFEST.ledger).verdict).toBe("pass");
    expect(checkReconciliationCorrectness(BALANCED_MANIFEST).verdict).toBe("pass");
  });

  it("parses a bounded verify input envelope (manifest | manifest + missionId + receiptHash)", () => {
    const bare = parseVerifyInput(JSON.stringify(BALANCED_MANIFEST));
    expect(bare.manifest).toBeDefined();
    expect(bare.missionId).toBeUndefined();
    const envelope = parseVerifyInput(
      JSON.stringify({
        manifest: BALANCED_MANIFEST,
        missionId: "mission-close-001",
        receiptHash: "a".repeat(64),
      }),
    );
    expect(envelope.manifest).toBeDefined();
    expect(envelope.missionId).toBe("mission-close-001");
    expect(envelope.receiptHash).toBe("a".repeat(64));
    expect(() => parseVerifyInput("{ not json")).toThrow(/not valid JSON/i);
    expect(() => parseVerifyInput(JSON.stringify({ ledger: "x" }))).toThrow(
      /ledger.*array/i,
    );
  });
});
