/**
 * WU2 — exhaustive 18-cell route selector tests (pi-sdd-030-routing-adapter).
 *
 * RED: all 18 normalized cells (2 risk bands × 3 evidence states × 3
 * reversibility) plus invalid-domain and conflicting-tier cases. GREEN: the
 * pure 18-cell table returns a proposal `{ route, basis }` carrying no
 * authorization or transition. Budget: the per-work-unit ledger never leaks
 * across units/routes and exhaustion returns a typed dimension.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { selectRoutingRoute } from "../../lib/routing/route-selector.js";
import { BudgetLedger } from "../../lib/routing/types.js";
import type {
  RouteSelection,
  RouteSelectionInput,
  RoutingReversibility,
} from "../../lib/routing/types.js";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import {
  parseSha256Hash,
  toJsonInteger,
  type Sha256Hash,
  type WorkUnit,
} from "drenyra-ai";
import { digest } from "./fixtures.js";
    
function input(overrides: Partial<RouteSelectionInput> = {}): RouteSelectionInput {
  return {
    kernelRiskTier: "R0",
    evidenceSufficiency: "SUFFICIENT",
    reversibility: "REVERSIBLE",
    requiredEvidenceHashes: [digest("a") as Sha256Hash],
    ...overrides,
  };
}

function expectRoute(selection: RouteSelection, route: string): void {
  expect(selection.ok).toBe(true);
  if (selection.ok) {
    expect(selection.route).toBe(route);
    expect(selection.basis.kernelRiskTier).toBeDefined();
    expect(selection.basis.evidenceSufficiency).toBeDefined();
    expect(selection.basis.reversibility).toBeDefined();
    // A proposal grants no authority and carries no transition.
    expect(selection).not.toHaveProperty("authorization");
    expect(selection).not.toHaveProperty("transition");
  }
}

function expectKind(selection: RouteSelection, kind: string): void {
  expect(selection.ok).toBe(false);
  if (!selection.ok) {
    expect(selection.reason.kind).toBe(kind);
  }
}

describe("selectRoutingRoute — exhaustive 18-cell table", () => {
  it("all 18 normalized cells are covered and deterministic (no uncovered cell)", () => {
    const riskBands = ["R0_R1", "R2_R3"] as const;
    const evidenceStates = ["SUFFICIENT", "INSUFFICIENT", "AMBIGUOUS"] as const;
    const reversibilities = [
      "REVERSIBLE",
      "PARTIALLY_REVERSIBLE",
      "IRREVERSIBLE",
    ] as const;
    const seen = new Set<string>();
    for (const band of riskBands) {
      for (const evidence of evidenceStates) {
        for (const reversibility of reversibilities) {
          const tier = band === "R0_R1" ? "R0" : "R2";
          const selection = selectRoutingRoute(
            input({
              kernelRiskTier: tier,
              evidenceSufficiency: evidence,
              reversibility,
            }),
          );
          const key = `${band}|${evidence}|${reversibility}`;
          seen.add(key);
          // Deterministic: two calls produce the identical proposal.
          const second = selectRoutingRoute(
            input({
              kernelRiskTier: tier,
              evidenceSufficiency: evidence,
              reversibility,
            }),
          );
          expect(second).toEqual(selection);
          if (evidence === "SUFFICIENT") {
            const expected =
              band === "R0_R1" && reversibility === "REVERSIBLE"
                ? "direct"
                : band === "R0_R1"
                  ? "delegated"
                  : reversibility === "REVERSIBLE"
                    ? "delegated"
                    : "durable";
            expectRoute(selection, expected);
          } else if (evidence === "INSUFFICIENT") {
            expectKind(selection, "MISSING_EVIDENCE");
            if (!selection.ok && selection.reason.kind === "MISSING_EVIDENCE") {
              expect(selection.reason.requiredHashes).toContain(digest("a"));
            }
          } else {
            expectKind(selection, "AMBIGUOUS_INPUT");
          }
        }
      }
    }
    expect(seen.size).toBe(18);
  });

  it("six SUFFICIENT rows map to their exact routes (SC-ROUTE-002)", () => {
    const rows: { band: string; reversibility: RoutingReversibility; route: string }[] = [
      { band: "R0_R1", reversibility: "REVERSIBLE", route: "direct" },
      { band: "R0_R1", reversibility: "PARTIALLY_REVERSIBLE", route: "delegated" },
      { band: "R0_R1", reversibility: "IRREVERSIBLE", route: "delegated" },
      { band: "R2_R3", reversibility: "REVERSIBLE", route: "delegated" },
      { band: "R2_R3", reversibility: "PARTIALLY_REVERSIBLE", route: "durable" },
      { band: "R2_R3", reversibility: "IRREVERSIBLE", route: "durable" },
    ];
    for (const row of rows) {
      const tier = row.band === "R0_R1" ? "R1" : "R3";
      const selection = selectRoutingRoute(
        input({ kernelRiskTier: tier, reversibility: row.reversibility }),
      );
      expectRoute(selection, row.route);
    }
  });

  it("a missing or out-of-domain kernel tier fails closed with AMBIGUOUS_INPUT", () => {
    expectKind(
      selectRoutingRoute(input({ kernelRiskTier: "R9" as never })),
      "AMBIGUOUS_INPUT",
    );
    expectKind(
      selectRoutingRoute(input({ kernelRiskTier: undefined as never })),
      "AMBIGUOUS_INPUT",
    );
  });

  it("a declared tier conflicting with the kernel tier fails closed (SC-ROUTE-004)", () => {
    expectKind(
      selectRoutingRoute(input({ kernelRiskTier: "R0", declaredRiskTier: "R3" })),
      "AMBIGUOUS_INPUT",
    );
  });

  it("an out-of-domain evidence state or reversibility fails closed", () => {
    expectKind(
      selectRoutingRoute(
        input({ evidenceSufficiency: "UNKNOWN" as never }),
      ),
      "AMBIGUOUS_INPUT",
    );
    expectKind(
      selectRoutingRoute(input({ reversibility: "MAYBE" as never })),
      "AMBIGUOUS_INPUT",
    );
  });

  it("insufficient evidence never routes and names the required hashes (SC-ROUTE-003)", () => {
    const selection = selectRoutingRoute(
      input({ evidenceSufficiency: "INSUFFICIENT" }),
    );
    expect(selection.ok).toBe(false);
    if (!selection.ok) {
      expect(selection.reason.kind).toBe("MISSING_EVIDENCE");
      if (selection.reason.kind === "MISSING_EVIDENCE") {
        expect(selection.reason.requiredHashes).toEqual([digest("a")]);
      }
    }
  });
});

describe("BudgetLedger — per-unit isolation and typed exhaustion", () => {
  function makeUnit(
    id: string,
    budgets: Record<string, unknown> = {},
  ): WorkUnit {
    const hashA = parseSha256Hash(digest("a"));
    const hashB = parseSha256Hash(digest("b"));
    const time = toJsonInteger(1_000);
    const tokens = toJsonInteger(100);
    if (!hashA.ok || !hashB.ok || !time.ok || !tokens.ok) {
      throw new Error("fixture hashes/integers must be valid");
    }
    return {
      id,
      missionId: "mission-close-001",
      objective: "objective",
      stage: AccountingMissionStatus.DRAFT,
      scope: {
        tenantId: "acme",
        ruc: "20123456786",
        companyId: "20123456786",
        period: "202507",
        intent: "monthly-close",
      },
      evidenceAllowed: [{ algorithm: "sha256", hash: hashA.value }],
      skills: [],
      policies: [],
      authorizedTools: [],
      authorizedDestinations: [],
      outputSchema: {
        id: "schema",
        version: "1.0.0",
        contentHash: hashB.value,
      },
      budgets: {
        timeLimitMs: time.value,
        tokenLimit: tokens.value,
        costLimitCents: 1_000n,
        researchAttemptLimit: 3,
        correctionAttemptLimit: 1,
        ...budgets,
      } as WorkUnit["budgets"],
      successConditions: [
        {
          kind: "OUTPUT_SCHEMA_VALID",
          schema: { id: "schema", version: "1.0.0", contentHash: hashB.value },
        },
      ],
      stopConditions: ["BUDGET_EXHAUSTED"],
    };
  }

  it("a ledger is keyed to one WorkUnit.id and never transfers across units", () => {
    const unitA = makeUnit("work-a");
    const unitB = makeUnit("work-b");
    const ledger = BudgetLedger.create(unitA);
    expect(ledger.workUnitId).toBe("work-a");
    expect(() => ledger.assertWorkUnit(unitB)).toThrow(/never transfer/);
    // Same id is allowed (same unit); a different id always fails.
    ledger.assertWorkUnit(unitA);
  });

  it("research exhaustion returns RESEARCH_ATTEMPTS at the ceiling (SC-ROUTE-006)", () => {
    const unit = makeUnit("work-a", { researchAttemptLimit: 3 });
    const ledger = BudgetLedger.create(unit);
    expect(ledger.debit("research")).toEqual({ ok: true });
    expect(ledger.debit("research")).toEqual({ ok: true });
    expect(ledger.debit("research")).toEqual({ ok: true });
    // A fourth attempt is past the ceiling: exhausted before dispatch.
    expect(ledger.debit("research")).toEqual({
      ok: false,
      dimension: "RESEARCH_ATTEMPTS",
    });
    expect(ledger.check()).toEqual({ ok: false, dimension: "RESEARCH_ATTEMPTS" });
  });

  it("correction exhaustion returns CORRECTION at the ceiling of one", () => {
    const unit = makeUnit("work-a", { correctionAttemptLimit: 1 });
    const ledger = BudgetLedger.create(unit);
    expect(ledger.debit("correction")).toEqual({ ok: true });
    expect(ledger.debit("correction")).toEqual({ ok: false, dimension: "CORRECTION" });
  });

  it("cost, token, and time consumption exhaust with their exact dimensions", () => {
    const unit = makeUnit("work-a", {
      costLimitCents: 1_000n,
      tokenLimit: 100,
      timeLimitMs: 1_000,
    });
    const ledger = BudgetLedger.create(unit);
    expect(
      ledger.recordConsumption({ elapsedMs: 0, tokens: 0, costIncurredCents: 2_000n }),
    ).toEqual({ ok: false, dimension: "COST" });
    const ledgerTokens = BudgetLedger.create(unit);
    expect(
      ledgerTokens.recordConsumption({ elapsedMs: 0, tokens: 200, costIncurredCents: 0n }),
    ).toEqual({ ok: false, dimension: "TOKENS" });
    const ledgerTime = BudgetLedger.create(unit);
    expect(
      ledgerTime.recordConsumption({ elapsedMs: 2_000, tokens: 0, costIncurredCents: 0n }),
    ).toEqual({ ok: false, dimension: "TIME" });
  });

  it("a route change requires a new preflight and a new WorkUnit.id (no-leak)", () => {
    // The no-leak invariant: a ledger bound to one unit cannot be presented for
    // another unit, and route change means a new preflight → new work unit id →
    // new ledger. There is no transfer API and no second ledger inside one
    // execution.
    const unitA = makeUnit("work-a");
    const unitB = makeUnit("work-b");
    const ledgerForA = BudgetLedger.create(unitA);
    const ledgerForB = BudgetLedger.create(unitB);
    expect(ledgerForA.workUnitId).not.toBe(ledgerForB.workUnitId);
    expect(() => ledgerForA.assertWorkUnit(unitB)).toThrow();
    expect(() => ledgerForB.assertWorkUnit(unitA)).toThrow();
    // Exhaustion is recorded only in that unit's own ledger.
    ledgerForA.debit("correction");
    expect(ledgerForA.snapshot().correctionAttempts).toBe(1);
    expect(ledgerForB.snapshot().correctionAttempts).toBe(0);
  });
});

describe("selectRoutingRoute — proposal purity", () => {
  it("a SUFFICIENT proposal carries only { route, basis } and no authority", () => {
    const selection = selectRoutingRoute(input());
    expect(selection.ok).toBe(true);
    if (selection.ok) {
      expect(Object.keys(selection).sort()).toEqual(["basis", "ok", "route"]);
      expect(Object.keys(selection.basis).sort()).toEqual([
        "evidenceSufficiency",
        "kernelRiskTier",
        "reversibility",
      ]);
    }
  });

  it("a contradictory classification (invalid domain) never defaults to a route", () => {
    const selection = selectRoutingRoute(
      input({ evidenceSufficiency: "AMBIGUOUS", kernelRiskTier: "R3" }),
    );
    expectKind(selection, "AMBIGUOUS_INPUT");
  });
});
