/**
 * Monthly-close RDA chain tests — the operator fiscal close workflow.
 *
 * The chain runs a monthly-close mission through the pinned Drenyra AI
 * runtime, enforces the R2 approval gate (explicit single approver), and
 * produces a signed receipt. Fail-closed: no scope or no approver blocks.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { verifySignedReceipt } from "drenyra-ai/receipts";
import { MonthlyCloseChain } from "../monthly-close.js";

const VALID_RUC = "20123456786";
const SCOPE = {
  company: { ruc: VALID_RUC },
  period: { period: "202607" },
};

describe("MonthlyCloseChain", () => {
  it("completes the close with an explicit R2 approver and a signed receipt", async () => {
    const chain = new MonthlyCloseChain(SCOPE);
    const result = await chain.run({ approverId: "contador-01", reason: "cierre mensual" });

    expect(result.mission.status).toBe("COMPLETED");
    expect(result.mission.intent).toBe("monthly-close");
    expect(result.mission.companyId).toBe(VALID_RUC);
    expect(result.mission.fiscalPeriod).toBe("202607");
    expect(result.approval.approverId).toBe("contador-01");

    // The receipt is self-verifying: hash + Ed25519 signature valid.
    const verification = verifySignedReceipt(result.receipt);
    expect(verification.valid).toBe(true);
    expect(result.receipt.content.decision).toBe("APPROVE");
    expect(result.receipt.content.companyId).toBe(VALID_RUC);
    expect(result.receipt.content.actorId).toBe("contador-01");
    expect(result.receipt.content.newStatus).toBe("COMPLETED");
  });

  it("fails closed without a company or period scope", async () => {
    const chain = new MonthlyCloseChain({});
    await expect(chain.run({ approverId: "contador-01" })).rejects.toThrow(
      /scope are required/,
    );
  });

  it("fails closed without an approver (R2 requires explicit human approval)", async () => {
    const chain = new MonthlyCloseChain(SCOPE);
    await expect(chain.run({ approverId: "   " })).rejects.toThrow(/approver is required/);
  });
});
