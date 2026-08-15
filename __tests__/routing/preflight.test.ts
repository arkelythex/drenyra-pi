/**
 * WU1 — seven-stage preflight tests (pi-sdd-030-routing-adapter).
 *
 * RED: every ordered stage fails closed with the exact published stop kind and
 * no store write; helper validation (createWorkUnit + validateWorkUnit) fails
 * closed on malformed input. GREEN: the happy path produces a helper-built and
 * helper-validated `WorkUnit` carrying the normalized budgets.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import type { WorkStopReason } from "drenyra-ai";
import { runRoutingPreflight } from "../../lib/routing/preflight.js";
import type {
  PreflightRequest,
  PreflightResult,
} from "../../lib/routing/types.js";
import { makeRoutingPreflightRequest, digest } from "./fixtures.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The typed stop reason of a failing preflight (fails the test on ok). */
function reasonOf(result: PreflightResult): WorkStopReason {
  if (result.ok) {
    throw new Error("expected a failing preflight but it succeeded");
  }
  return result.reason;
}

/** Assert the stop kind then narrow the union for field access. */
function fieldsOf(
  reason: WorkStopReason,
  kind: "AMBIGUOUS_INPUT" | "SCOPE_MISMATCH",
): readonly string[] {
  expect(reason.kind).toBe(kind);
  if (reason.kind === "AMBIGUOUS_INPUT" || reason.kind === "SCOPE_MISMATCH") {
    return reason.fields;
  }
  return [];
}

describe("runRoutingPreflight — seven ordered stages fail closed", () => {
  it("stage 1 scope: a canonical-only element change is AMBIGUOUS_INPUT naming the field", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      binding: {
        ...request.binding,
        scope: { ...request.binding.scope, actor: "mallory" },
      },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("actor");
  });

  it("stage 1 scope: a WorkScope-mappable element change is SCOPE_MISMATCH naming tenantId", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      binding: {
        ...request.binding,
        scope: { ...request.binding.scope, tenant: "other-tenant" },
      },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "SCOPE_MISMATCH")).toContain("tenantId");
  });

  it("stage 1 scope: a forged binding hash is AMBIGUOUS_INPUT (no WorkScope key expressible)", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      binding: { ...request.binding, scopeHash: digest("0") },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("binding.scopeHash");
  });

  it("stage 1 scope: a mission company mismatch fails closed naming companyId", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      mission: { ...request.mission, companyId: "20123456808" },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "SCOPE_MISMATCH")).toContain("companyId");
  });

  it("stage 2 permissions: a DENIED authorization fails closed with POLICY_BLOCKED", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      authorization: { ...request.authorization, decision: "DENIED" },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(reason.kind).toBe("POLICY_BLOCKED");
    if (reason.kind === "POLICY_BLOCKED") {
      expect(reason.policy.id).toBe(request.governingPolicy.id);
    }
  });

  it("stage 2 permissions: a bound mode below the required mode fails closed", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      actionFamily: "EXECUTE_TARGET",
      authorization: {
        ...request.authorization,
        actionFamily: "EXECUTE_TARGET",
        authorityMode: "ASK",
      },
    };
    const result = await runRoutingPreflight(mutated);
    expect(reasonOf(result).kind).toBe("POLICY_BLOCKED");
  });

  it("stage 2 permissions: a missing policy pin is AMBIGUOUS_INPUT naming governingPolicy", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      governingPolicy: { id: "", version: "" },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("governingPolicy");
  });

  it("stage 3 evidence: a malformed required hash is AMBIGUOUS_INPUT (no invented digest)", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      requiredEvidenceHashes: ["not-a-hash"],
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("requiredEvidenceHashes");
  });

  it("stage 3 evidence: a missing required hash fails closed with MISSING_EVIDENCE", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      requiredEvidenceHashes: [digest("b")],
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(reason.kind).toBe("MISSING_EVIDENCE");
    if (reason.kind === "MISSING_EVIDENCE") {
      expect(reason.requiredHashes).toContain(digest("b"));
    }
  });

  it("stage 3 evidence: a corrupted payload fails closed with MISSING_EVIDENCE", async () => {
    const { request, storesRoot, mission } = await makeRoutingPreflightRequest();
    const path = join(storesRoot, ".local", "evidence", `${mission.id}.ndjson`);
    const raw = readFileSync(path, "utf8");
    const lines = raw.split("\n").filter((line) => line.length > 0);
    const corrupted = lines.map((line) => {
      const record = JSON.parse(line) as { id?: string; payloadHash?: string };
      if (record.id === `${mission.id}:a-report`) {
        return JSON.stringify({ ...record, payloadHash: digest("9") });
      }
      return line;
    });
    writeFileSync(path, `${corrupted.join("\n")}\n`, "utf8");
    const result = await runRoutingPreflight(request);
    expect(reasonOf(result).kind).toBe("MISSING_EVIDENCE");
  });

  it("stage 3 evidence: an unknown terminal node id fails closed with MISSING_EVIDENCE", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = { ...request, terminalNodeIds: ["missing-terminal"] };
    const result = await runRoutingPreflight(mutated);
    expect(reasonOf(result).kind).toBe("MISSING_EVIDENCE");
  });

  it("stage 4 materiality: missing materiality input never defaults to R0", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated = {
      ...request,
      materiality: { input: undefined, minimum: undefined },
    } as unknown as PreflightRequest;
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("materiality.input");
  });

  it("stage 4 materiality: a declared tier conflicting with the derived tier fails closed", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = { ...request, declaredRiskTier: "R3" };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain("declaredRiskTier");
  });

  it("stage 4 materiality: an unsupported mission intent fails closed with UNSUPPORTED_WORK", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated = {
      ...request,
      mission: { ...request.mission, intent: "verify" },
    } as unknown as PreflightRequest;
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(reason.kind).toBe("UNSUPPORTED_WORK");
    if (reason.kind === "UNSUPPORTED_WORK") {
      expect(reason.intent).toBe("verify");
    }
  });

  it("stage 5 reversibility: a conflicting declared reversibility fails closed", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      declaredReversibility: "IRREVERSIBLE",
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(fieldsOf(reason, "AMBIGUOUS_INPUT")).toContain(
      "materiality.input.reversibility",
    );
  });

  it("stage 6 systems: an unavailable required system fails closed", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      systems: [{ systemId: "bank-api", available: false }],
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    expect(reason.kind).toBe("EXTERNAL_SYSTEM_UNAVAILABLE");
    if (reason.kind === "EXTERNAL_SYSTEM_UNAVAILABLE") {
      expect(reason.systemId).toBe("bank-api");
    }
  });

  it("stage 6 systems: an absent availability declaration is AMBIGUOUS_INPUT", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      systems: [{ systemId: "", available: true }],
    };
    const result = await runRoutingPreflight(mutated);
    expect(reasonOf(result).kind).toBe("AMBIGUOUS_INPUT");
  });

  it("stage 6 systems: a tool operation outside the unit allow-list is AMBIGUOUS_INPUT", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      systems: [
        {
          systemId: "bank-api",
          available: true,
          requiredToolOperations: [{ toolId: "bank-client", operation: "transfer" }],
        },
      ],
    };
    const result = await runRoutingPreflight(mutated);
    expect(reasonOf(result).kind).toBe("AMBIGUOUS_INPUT");
  });

  it("stage 7 approval: a required approval with bound evidence is retained as a stop condition", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      approval: { required: true, approvalType: "human-approver", evidenceBound: true },
    };
    const result = await runRoutingPreflight(mutated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.approvalRequired?.kind).toBe("APPROVAL_REQUIRED");
      expect(result.workUnit.stopConditions).toContain("APPROVAL_REQUIRED");
    }
  });

  it("stage 7 approval: a required approval without evidence keeps execution blocked", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      approval: { required: true, approvalType: "human-approver", evidenceBound: false },
    };
    const result = await runRoutingPreflight(mutated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.approvalRequired?.kind).toBe("APPROVAL_REQUIRED");
      expect(result.workUnit.stopConditions).toContain("APPROVAL_REQUIRED");
    }
  });

  it("budget normalization: research above 3 clamps to 3; correction above 1 clamps to 1", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      requestedBudgets: {
        ...request.requestedBudgets,
        researchAttempts: 9,
        correctionAttempts: 5,
      },
    };
    const result = await runRoutingPreflight(mutated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workUnit.budgets.researchAttemptLimit).toBe(3);
      expect(result.workUnit.budgets.correctionAttemptLimit).toBe(1);
    }
  });

  it("budget normalization: a requested research below one is AMBIGUOUS_INPUT", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      requestedBudgets: { ...request.requestedBudgets, researchAttempts: 0 },
    };
    const result = await runRoutingPreflight(mutated);
    expect(reasonOf(result).kind).toBe("AMBIGUOUS_INPUT");
  });

  it("budget normalization: cost is capped by the governing policy maximum", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      requestedBudgets: {
        ...request.requestedBudgets,
        costLimitCents: 9_000_000n,
      },
    };
    const result = await runRoutingPreflight(mutated);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workUnit.budgets.costLimitCents).toBe(
        request.policyMax.maxCostLimitCents,
      );
    }
  });

  it("helper validation: malformed evidence hashes fail closed at the workunit stage", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const mutated: PreflightRequest = {
      ...request,
      workUnitInput: {
        ...request.workUnitInput,
        evidenceAllowed: [{ algorithm: "sha256", hash: "broken" as never }],
      },
    };
    const result = await runRoutingPreflight(mutated);
    const reason = reasonOf(result);
    // Design D2: helper INVALID_HASH projects to MISSING_EVIDENCE when the
    // required valid hashes are known (never an invented digest).
    expect(reason.kind).toBe("MISSING_EVIDENCE");
    if (reason.kind === "MISSING_EVIDENCE") {
      expect(reason.requiredHashes.length).toBeGreaterThan(0);
    }
  });

  it("no store write on a failing preflight: the evidence log is untouched", async () => {
    const { request, storesRoot, mission } = await makeRoutingPreflightRequest();
    const path = join(storesRoot, ".local", "evidence", `${mission.id}.ndjson`);
    const before = readFileSync(path, "utf8");
    const mutated: PreflightRequest = {
      ...request,
      binding: { ...request.binding, scopeHash: digest("7") },
    };
    const result = await runRoutingPreflight(mutated);
    expect(result.ok).toBe(false);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("happy path: all seven stages pass and a validated WorkUnit is produced", async () => {
    const { request } = await makeRoutingPreflightRequest();
    const result = await runRoutingPreflight(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.riskTier).toBe("R0");
      expect(result.riskBand).toBe("R0_R1");
      expect(result.evidenceSufficiency).toBe("SUFFICIENT");
      expect(result.reversibility).toBe("REVERSIBLE");
      expect(result.workUnit.missionId).toBe(request.mission.id);
      expect(result.workUnit.stage).toBe(AccountingMissionStatus.DRAFT);
      expect(result.workUnit.scope.companyId).toBe(request.mission.companyId);
      expect(result.workUnit.scope.period).toBe(request.mission.fiscalPeriod);
      expect(result.workUnit.scope.intent).toBe(request.mission.intent);
      expect(result.workUnit.budgets.researchAttemptLimit).toBe(3);
      expect(result.workUnit.budgets.correctionAttemptLimit).toBe(1);
      expect(typeof result.workUnit.budgets.costLimitCents).toBe("bigint");
      for (const ref of result.workUnit.evidenceAllowed) {
        expect(SHA256_HEX.test(ref.hash)).toBe(true);
      }
    }
  });
});
