/**
 * Authority gates — RED/GREEN tests for T-S2-001 (modes, action families,
 * monotonicity, explicit materiality) and T-S2-002 (fixed-order
 * `runAuthorityPipeline`).
 *
 * Fiscal convention: monetary values are BigInt cents; the materiality value
 * inputs below use BigInt literals (never floats).
 */

import { describe, expect, it } from "vitest";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import { AUTHORITY_MODE, type AuthorityMode } from "../runtime/context.js";
import {
  ACTION_FAMILY,
  AUTHORITY_ORDER,
  assertMonotonicAuthority,
  deriveRequiredMateriality,
  requiredModeFor,
  runAuthorityPipeline,
  type AuthorityGateInput,
  type AuthorityGateResult,
} from "../lib/authority-gates.js";
import {
  makeApprovalReceipt,
  makeAuthorization,
  makeMission,
  makeScopeBinding,
} from "./helpers/authority-fixtures.js";

const MODES: readonly AuthorityMode[] = [
  AUTHORITY_MODE.ASK,
  AUTHORITY_MODE.ANALYZE,
  AUTHORITY_MODE.PREPARE,
  AUTHORITY_MODE.EXECUTE,
];

describe("T-S2-001 authority modes (REQ-AUTH-001)", () => {
  it("defines exactly four modes in strict order ASK < ANALYZE < PREPARE < EXECUTE", () => {
    expect(Object.keys(AUTHORITY_ORDER).sort()).toEqual([...MODES].sort());
    expect(AUTHORITY_ORDER[AUTHORITY_MODE.ASK]).toBe(0);
    expect(AUTHORITY_ORDER[AUTHORITY_MODE.ANALYZE]).toBe(1);
    expect(AUTHORITY_ORDER[AUTHORITY_MODE.PREPARE]).toBe(2);
    expect(AUTHORITY_ORDER[AUTHORITY_MODE.EXECUTE]).toBe(3);
    // The harness order must cover exactly the runtime AuthorityMode set.
    expect(Object.keys(AUTHORITY_ORDER)).toEqual(Object.keys(AUTHORITY_MODE));
  });

  it("maps every action family to its required mode", () => {
    expect(requiredModeFor(ACTION_FAMILY.QUERY)).toBe(AUTHORITY_MODE.ASK);
    expect(requiredModeFor(ACTION_FAMILY.INVESTIGATE)).toBe(AUTHORITY_MODE.ANALYZE);
    expect(requiredModeFor(ACTION_FAMILY.PREPARE_CANDIDATE)).toBe(AUTHORITY_MODE.PREPARE);
    expect(requiredModeFor(ACTION_FAMILY.APPROVE)).toBe(AUTHORITY_MODE.PREPARE);
    expect(requiredModeFor(ACTION_FAMILY.EXECUTE_TARGET)).toBe(AUTHORITY_MODE.EXECUTE);
  });

  it("accepts an equal or higher granted mode (monotonic, non-decreasing)", () => {
    expect(() =>
      assertMonotonicAuthority(AUTHORITY_MODE.EXECUTE, AUTHORITY_MODE.ASK),
    ).not.toThrow();
    expect(() =>
      assertMonotonicAuthority(AUTHORITY_MODE.PREPARE, AUTHORITY_MODE.PREPARE),
    ).not.toThrow();
  });

  it("denies a lower authority performing a higher action (SC-AUTH-001)", () => {
    expect(() =>
      assertMonotonicAuthority(AUTHORITY_MODE.ANALYZE, AUTHORITY_MODE.PREPARE),
    ).toThrow(/monotonicity violation/);
    expect(() =>
      assertMonotonicAuthority(AUTHORITY_MODE.ASK, AUTHORITY_MODE.EXECUTE),
    ).toThrow(/monotonicity violation/);
  });

  it("covers the exhaustive mode x family escalation table (SC-AUTH-005)", () => {
    const families = Object.values(ACTION_FAMILY);
    for (const mode of MODES) {
      for (const family of families) {
        const required = requiredModeFor(family);
        if (AUTHORITY_ORDER[mode] >= AUTHORITY_ORDER[required]) {
          expect(() => assertMonotonicAuthority(mode, required)).not.toThrow();
        } else {
          expect(() => assertMonotonicAuthority(mode, required)).toThrow(
            /monotonicity violation/,
          );
        }
      }
    }
  });

  it("encodes the per-mode action boundaries (REQ-AUTH-009)", () => {
    // ASK/ANALYZE never mutate; PREPARE produces candidates only; EXECUTE
    // targets exact approved work only.
    expect(requiredModeFor(ACTION_FAMILY.QUERY)).toBe(AUTHORITY_MODE.ASK);
    expect(requiredModeFor(ACTION_FAMILY.INVESTIGATE)).toBe(AUTHORITY_MODE.ANALYZE);
    expect(requiredModeFor(ACTION_FAMILY.PREPARE_CANDIDATE)).toBe(AUTHORITY_MODE.PREPARE);
    expect(requiredModeFor(ACTION_FAMILY.APPROVE)).toBe(AUTHORITY_MODE.PREPARE);
    expect(requiredModeFor(ACTION_FAMILY.EXECUTE_TARGET)).toBe(AUTHORITY_MODE.EXECUTE);
  });
});

describe("T-S2-001 explicit materiality (REQ-AUTH-004/005)", () => {
  it("derives R0 for a zero reversible PE input", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 0n, reversibility: "reversible", jurisdiction: "PE" },
      }),
    ).toBe("R0");
  });

  it("derives R3 for an irreversible input", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 1n, reversibility: "irreversible", jurisdiction: "PE" },
      }),
    ).toBe("R3");
  });

  it("derives R3 at the high-value threshold (S/100,000.00 in BigInt cents)", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 100_000_00n, reversibility: "reversible", jurisdiction: "PE" },
      }),
    ).toBe("R3");
  });

  it("derives R2 at the medium-value threshold", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 10_000_00n, reversibility: "reversible", jurisdiction: "PE" },
      }),
    ).toBe("R2");
  });

  it("derives R1 for an ordinary input", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 1_000_00n, reversibility: "reversible", jurisdiction: "PE" },
      }),
    ).toBe("R1");
  });

  it("escalates one tier for a non-PE jurisdiction (fail-closed ceiling)", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 1_000_00n, reversibility: "reversible", jurisdiction: "US" },
      }),
    ).toBe("R2");
  });

  it("fails closed when any materiality input is missing — never defaults to R0 (SC-AUTH-002)", () => {
    expect(() =>
      deriveRequiredMateriality({
        input: { value: undefined as unknown as bigint, reversibility: "reversible", jurisdiction: "PE" },
      }),
    ).toThrow(/value/i);
    expect(() =>
      deriveRequiredMateriality({
        input: { value: 100n, reversibility: "partial" as never, jurisdiction: "PE" },
      }),
    ).toThrow(/reversibility/i);
    expect(() =>
      deriveRequiredMateriality({
        input: { value: 100n, reversibility: "reversible", jurisdiction: "" },
      }),
    ).toThrow(/jurisdiction/i);
    expect(() =>
      deriveRequiredMateriality({ input: undefined as never }),
    ).toThrow();
  });

  it("applies the monthly-close R2 floor when the engine derives R0 (REQ-AUTH-005)", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 0n, reversibility: "reversible", jurisdiction: "PE" },
        minimum: "R2",
      }),
    ).toBe("R2");
  });

  it("never lowers a derived tier below the minimum", () => {
    expect(
      deriveRequiredMateriality({
        input: { value: 100_000_00n, reversibility: "reversible", jurisdiction: "PE" },
        minimum: "R2",
      }),
    ).toBe("R3");
  });

  it("rejects an unknown minimum tier", () => {
    expect(() =>
      deriveRequiredMateriality({
        input: { value: 0n, reversibility: "reversible", jurisdiction: "PE" },
        minimum: "R9" as never,
      }),
    ).toThrow(/minimum/i);
  });
});

describe("T-S2-002 runAuthorityPipeline", () => {
  const approval: AuthorityGateInput["approvals"] = [
    { approverId: "alice", at: "2026-07-01T00:00:00.000Z", reason: "monthly close" },
  ];

  /** A fully prepared EXECUTE input: legal transition, R2+, approval, trusted receipt. */
  function executeInput(overrides: Partial<AuthorityGateInput> = {}): AuthorityGateInput {
    const binding = makeScopeBinding();
    const { receipt, key } = makeApprovalReceipt();
    return {
      binding,
      authorization: makeAuthorization({ scopeHash: binding.scopeHash }, binding),
      action: ACTION_FAMILY.EXECUTE_TARGET,
      mission: makeMission({ status: AccountingMissionStatus.AWAITING_APPROVAL }),
      targetStatus: AccountingMissionStatus.APPROVED,
      materiality: {
        input: { value: 10_000_00n, reversibility: "partially-reversible", jurisdiction: "PE" },
      },
      approvals: approval,
      approvalReceipt: receipt,
      trustedKeys: [key],
      ...overrides,
    };
  }

  function stages(results: readonly AuthorityGateResult[]): string[] {
    return results.map((result) => result.stage);
  }

  it("evaluates the six stages in the exact fixed order (REQ-AUTH-008)", async () => {
    const results = await runAuthorityPipeline(executeInput());
    expect(stages(results)).toEqual([
      "scope",
      "mode",
      "materiality",
      "mission",
      "approval",
      "receipt",
    ]);
    expect(results.every((result) => result.verdict === "allowed")).toBe(true);
  });

  it("stops at the first non-allowed verdict (mode stage)", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          { authorityMode: AUTHORITY_MODE.ANALYZE, scopeHash: binding.scopeHash },
          binding,
        ),
      }),
    );
    expect(stages(results)).toEqual(["scope", "mode"]);
    expect(results[1]).toMatchObject({
      stage: "mode",
      verdict: "blocked",
    });
    expect(results[1]?.reason).toMatch(/monotonicity violation/);
  });

  it("denies an action below the bound mode through the pipeline (SC-AUTH-001)", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          { authorityMode: AUTHORITY_MODE.ANALYZE, scopeHash: binding.scopeHash },
          binding,
        ),
      }),
    );
    expect(results[1]?.verdict).toBe("blocked");
  });

  it("blocks at the materiality stage when explicit materiality is missing — no R0 default (SC-AUTH-002)", async () => {
    const results = await runAuthorityPipeline(
      executeInput({ materiality: undefined }),
    );
    expect(stages(results)).toEqual(["scope", "mode", "materiality"]);
    expect(results[2]).toMatchObject({
      stage: "materiality",
      verdict: "blocked",
    });
    expect(results[2]?.reason).toMatch(/materiality-input-missing/);
    expect(results[2]?.reason).not.toMatch(/R0/);
  });

  it("stops at the mission stage on an illegal transition", async () => {
    const results = await runAuthorityPipeline(
      executeInput({
        mission: makeMission({ status: AccountingMissionStatus.RUNNING }),
        targetStatus: AccountingMissionStatus.APPROVED,
      }),
    );
    expect(stages(results)).toEqual(["scope", "mode", "materiality", "mission"]);
    expect(results[3]).toMatchObject({ stage: "mission", verdict: "blocked" });
  });

  it("preserves needs_input at the approval stage without weakening (SC-AUTH-003)", async () => {
    const results = await runAuthorityPipeline(executeInput({ approvals: [] }));
    expect(stages(results)).toEqual([
      "scope",
      "mode",
      "materiality",
      "mission",
      "approval",
    ]);
    expect(results[4]).toMatchObject({
      stage: "approval",
      verdict: "needs_input",
    });
    expect(results[4]?.envelope).toMatchObject({ materiality: "R2" });
  });

  it("blocks at the receipt stage when trusted keys are empty — no embedded-key self-trust (REQ-AUTH-008)", async () => {
    const results = await runAuthorityPipeline(executeInput({ trustedKeys: [] }));
    expect(stages(results)).toEqual([
      "scope",
      "mode",
      "materiality",
      "mission",
      "approval",
      "receipt",
    ]);
    expect(results[5]).toMatchObject({ stage: "receipt", verdict: "blocked" });
    expect(results[5]?.reason).toMatch(/trustedKeys/);
  });

  it("blocks at the receipt stage when the signer is not in the trusted-key list", async () => {
    const stranger = makeApprovalReceipt();
    const results = await runAuthorityPipeline(
      executeInput({ trustedKeys: [stranger.key] }),
    );
    expect(results[5]).toMatchObject({ stage: "receipt", verdict: "blocked" });
    expect((results[5]?.envelope as { status?: string } | undefined)?.status).toBe(
      "UNKNOWN_SIGNER",
    );
  });

  it("records approval and receipt as not_applicable for PREPARE (design §5.3)", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        action: ACTION_FAMILY.PREPARE_CANDIDATE,
        authorization: makeAuthorization(
          {
            authorityMode: AUTHORITY_MODE.PREPARE,
            actionFamily: ACTION_FAMILY.PREPARE_CANDIDATE,
            scopeHash: binding.scopeHash,
          },
          binding,
        ),
        mission: makeMission({ status: AccountingMissionStatus.RUNNING }),
        targetStatus: undefined,
        approvals: [],
        approvalReceipt: undefined,
        trustedKeys: [],
      }),
    );
    expect(stages(results)).toEqual([
      "scope",
      "mode",
      "materiality",
      "mission",
      "approval",
      "receipt",
    ]);
    expect(results[3]).toMatchObject({ stage: "mission", verdict: "not_applicable" });
    expect(results[4]).toMatchObject({ stage: "approval", verdict: "not_applicable" });
    expect(results[5]).toMatchObject({ stage: "receipt", verdict: "not_applicable" });
  });

  it("records materiality, mission, approval, receipt as not_applicable for read-only actions (design §5.2)", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        action: ACTION_FAMILY.QUERY,
        authorization: makeAuthorization(
          { authorityMode: AUTHORITY_MODE.ASK, actionFamily: ACTION_FAMILY.QUERY, scopeHash: binding.scopeHash },
          binding,
        ),
        mission: makeMission({ status: AccountingMissionStatus.RUNNING }),
        targetStatus: undefined,
        materiality: undefined,
        approvals: [],
        approvalReceipt: undefined,
        trustedKeys: [],
      }),
    );
    expect(stages(results)).toEqual([
      "scope",
      "mode",
      "materiality",
      "mission",
      "approval",
      "receipt",
    ]);
    expect(results.slice(2).every((result) => result.verdict === "not_applicable")).toBe(true);
  });

  it("requires targetStatus for APPROVE and EXECUTE (fail closed)", async () => {
    const executeResults = await runAuthorityPipeline(
      executeInput({ targetStatus: undefined }),
    );
    expect(executeResults[3]).toMatchObject({ stage: "mission", verdict: "blocked" });

    const binding = makeScopeBinding();
    const approveResults = await runAuthorityPipeline(
      executeInput({
        action: ACTION_FAMILY.APPROVE,
        authorization: makeAuthorization(
          { authorityMode: AUTHORITY_MODE.PREPARE, actionFamily: ACTION_FAMILY.APPROVE, scopeHash: binding.scopeHash },
          binding,
        ),
        targetStatus: undefined,
        approvalReceipt: undefined,
        trustedKeys: [],
      }),
    );
    expect(approveResults[3]).toMatchObject({ stage: "mission", verdict: "blocked" });
  });

  it("denies a stale scope binding at the scope stage (REQ-SCOPE-006; SC-SCOPE-005)", async () => {
    const otherBinding = makeScopeBinding({ actor: "bob" });
    const results = await runAuthorityPipeline(
      executeInput({ authorization: makeAuthorization({ scopeHash: otherBinding.scopeHash }) }),
    );
    expect(results[0]).toMatchObject({ stage: "scope", verdict: "blocked" });
    expect(results[0]?.reason).toMatch(/scope hash/);
  });

  it("denies an authorization bound to a different mission", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          { missionId: "mission-other-002", scopeHash: binding.scopeHash },
          binding,
        ),
      }),
    );
    expect(results[0]).toMatchObject({ stage: "scope", verdict: "blocked" });
  });

  it("denies a DENIED authorization decision", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          { decision: "DENIED", scopeHash: binding.scopeHash },
          binding,
        ),
      }),
    );
    expect(results[1]).toMatchObject({ stage: "mode", verdict: "blocked" });
    expect(results[1]?.reason).toMatch(/DENIED/);
  });

  it("denies an authorization whose actor does not match the bound scope", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          { actorId: "eve", scopeHash: binding.scopeHash },
          binding,
        ),
      }),
    );
    expect(results[1]).toMatchObject({ stage: "mode", verdict: "blocked" });
  });

  it("denies an expired authorization", async () => {
    const binding = makeScopeBinding();
    const results = await runAuthorityPipeline(
      executeInput({
        authorization: makeAuthorization(
          {
            scopeHash: binding.scopeHash,
            expiresAt: "2020-01-01T00:00:00.000Z",
          },
          binding,
        ),
      }),
    );
    expect(results[1]).toMatchObject({ stage: "mode", verdict: "blocked" });
    expect(results[1]?.reason).toMatch(/expired/);
  });
});
