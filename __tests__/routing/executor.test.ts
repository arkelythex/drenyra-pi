/**
 * WU3 — bounded executor and structured result tests (pi-sdd-030-routing-adapter).
 *
 * RED: validator denial, budget exhaustion, provenance loss, UNKNOWN
 * resubmission, and a mutated nextTransition all fail. GREEN: one bounded
 * dispatch through an injected port, transition advance ONLY through the
 * injected validator, `WorkResult` built via `createWorkResult` +
 * `validateWorkResult`, typed budget exhaustion, zero blind retries.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { AccountingMissionStatus, type MissionSnapshot } from "drenyra-ai/missions";
import {
  advanceWorkUnit,
  createWorkUnit,
  validateWorkResult,
  type CanonicalTransitionValidator,
  type Route,
  type WorkUnit,
  type WorkUnitInput,
} from "drenyra-ai";
import { validateTransition } from "drenyra-ai/missions";
import { executeRoutingWork } from "../../lib/routing/executor.js";
import { BudgetLedger } from "../../lib/routing/types.js";
import type {
  ExecuteRoutingWorkInput,
  RouteExecutionPortResponse,
  RouteExecutionResult,
  RoutingExecutionPorts,
} from "../../lib/routing/types.js";
import type { ScopeBinding } from "../../lib/canonicalization.js";
import { bindScope } from "../../lib/canonicalization.js";
import type { ChainDefinition } from "../../lib/chain-pipeline.js";
import { makeCanonicalScope, makeMission } from "../helpers/authority-fixtures.js";
import {
  digest,
  makeCoreRoute,
  makeRoutingCandidate,
  makeRoutingMaterialityBasis,
} from "./fixtures.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Build a helper-created DRAFT unit (optionally advanced to a stage). */
function buildUnit(
  mission: MissionSnapshot,
  stage?: AccountingMissionStatus,
): WorkUnit {
  const hash = digest("a");
  const input: WorkUnitInput = {
    id: `work-${mission.id}`,
    objective: "executor fixture objective",
    scope: { tenantId: "acme", ruc: mission.companyId },
    evidenceAllowed: [{ algorithm: "sha256", hash: hash as never }],
    skills: [],
    policies: [{ id: "policies.v1", version: "1.0.0" }],
    authorizedTools: [
      { id: "chain-pipeline", version: "0.3.0", operations: ["execute-step"] },
    ],
    authorizedDestinations: [{ kind: "EVIDENCE_STORE", id: "evidence" }],
    outputSchema: {
      id: "schema",
      version: "1.0.0",
      contentHash: digest("b") as never,
    },
    budgets: {
      timeLimitMs: 60_000 as never,
      tokenLimit: 100_000 as never,
      costLimitCents: 1_000_000n,
      researchAttemptLimit: 3,
      correctionAttemptLimit: 1,
    },
    successConditions: [
      {
        kind: "EVIDENCE_HASHES_PRESENT",
        required: [hash as never],
      },
    ],
    stopConditions: ["BUDGET_EXHAUSTED"],
  };
  const created = createWorkUnit(mission, input);
  if (!created.ok) {
    throw new Error(`fixture createWorkUnit failed: ${JSON.stringify(created.issues)}`);
  }
  let unit = created.value;
  if (stage === AccountingMissionStatus.QUEUED) {
    const advanced = advanceWorkUnit(unit, AccountingMissionStatus.QUEUED, validateTransition);
    if (!advanced.ok) throw new Error("fixture advance to QUEUED failed");
    unit = advanced.value;
  }
  if (stage === AccountingMissionStatus.RUNNING) {
    const queued = advanceWorkUnit(unit, AccountingMissionStatus.QUEUED, validateTransition);
    if (!queued.ok) throw new Error("fixture advance to QUEUED failed");
    const running = advanceWorkUnit(queued.value, AccountingMissionStatus.RUNNING, validateTransition);
    if (!running.ok) throw new Error("fixture advance to RUNNING failed");
    unit = running.value;
  }
  return unit;
}

/** A stub chain definition; ports in these unit tests ignore it. */
function makeStubChain(): ChainDefinition<unknown, unknown> {
  return {
    name: "stub-chain",
    intent: "monthly-close",
    requiredMode: "EXECUTE",
    runStep: async () => ({ output: null }),
  };
}

/** A success-shaped port response for one completed step. */
function makeSuccessResponse(
  unit: WorkUnit,
  mission: MissionSnapshot,
  overrides: Partial<RouteExecutionPortResponse> = {},
): RouteExecutionPortResponse {
  const before = mission;
  const after: MissionSnapshot = { ...before, status: AccountingMissionStatus.QUEUED };
  return {
    missionBefore: before,
    missionAfter: after,
    evidenceRefs: unit.evidenceAllowed,
    candidates: [],
    unresolvedExceptions: [],
    toolProvenance: [],
    consumption: {
      elapsedMs: 1,
      tokens: 1,
      costIncurredCents: 1n,
      researchAttempts: 1,
      correctionAttempts: 0,
    },
    coreProposedTarget: AccountingMissionStatus.RUNNING,
    ...overrides,
  };
}

/** A counting fake port set around one handler per route. */
function makePorts(
  handler: (calls: { count: number }) => (input: { workUnit: WorkUnit }) => Promise<RouteExecutionPortResponse>,
): { ports: RoutingExecutionPorts; calls: Record<string, () => number> } {
  const direct = { count: 0 };
  const delegated = { count: 0 };
  const durable = { count: 0 };
  const wrap =
    (tracker: { count: number }) =>
    async (input: { workUnit: WorkUnit }) => {
      tracker.count += 1;
      return handler(tracker)(input);
    };
  return {
    ports: { direct: wrap(direct), delegated: wrap(delegated), durable: wrap(durable) },
    calls: {
      direct: () => direct.count,
      delegated: () => delegated.count,
      durable: () => durable.count,
    },
  };
}

interface Harness {
  workUnit: WorkUnit;
  mission: MissionSnapshot;
  binding: ScopeBinding;
  ledger: BudgetLedger;
  chain: ChainDefinition<unknown, unknown>;
}

function makeHarness(
  stage?: AccountingMissionStatus,
): Harness {
  const binding = bindScope(makeCanonicalScope());
  const mission = makeMission({
    id: "mission-executor-001",
    companyId: binding.scope.company,
    fiscalPeriod: binding.scope.fiscalPeriod,
    status: AccountingMissionStatus.DRAFT,
  });
  const workUnit = buildUnit(mission, stage);
  const ledger = BudgetLedger.create(workUnit);
  return { workUnit, mission, binding, ledger, chain: makeStubChain() };
}

function makeExecutionInput(
  harness: Harness,
  ports: RoutingExecutionPorts,
  validator?: CanonicalTransitionValidator,
  route: Route = makeCoreRoute("direct-analysis"),
): ExecuteRoutingWorkInput {
  return {
    workUnit: harness.workUnit,
    route,
    binding: harness.binding,
    mission: harness.mission,
    ports,
    ledger: harness.ledger,
    chain: harness.chain,
    chainRun: { binding: harness.binding, input: {} },
    validator,
  };
}

function expectFailure(result: RouteExecutionResult): Extract<RouteExecutionResult, { ok: false }> {
  expect(result.ok).toBe(false);
  return result as Extract<RouteExecutionResult, { ok: false }>;
}

    /** Core route kind → the Pi execution-port name it must dispatch through. */
    const KIND_TO_PORT: Record<Route["kind"], "direct" | "delegated" | "durable"> = {
      "direct-analysis": "direct",
      "specialized-agent": "delegated",
      "durable-mission": "durable",
    };

    describe("executeRoutingWork — bounded dispatch and validator authority", () => {
  it("happy path: one dispatch, validator-approved advance, validated WorkResult", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    expect(result.ok).toBe(true);
    expect(calls.direct()).toBe(1);
    if (result.ok) {
      expect(result.result.workUnitId).toBe(harness.workUnit.id);
      expect(result.result.missionId).toBe(harness.mission.id);
      expect(result.result.outcome.kind).toBe("SUCCEEDED");
      expect(result.result.nextTransition.from).toBe(AccountingMissionStatus.QUEUED);
      expect(result.result.nextTransition.to).toBe(AccountingMissionStatus.RUNNING);
      expect(result.result.costAndAttempts.researchAttempts).toBe(1);
      expect(typeof result.result.costAndAttempts.costIncurredCents).toBe("bigint");
      // The unit was advanced only through the injected validator.
      expect(result.workUnit.stage).toBe(AccountingMissionStatus.QUEUED);
    }
  });

  it("shared assertions hold across every Core route kind", async () => {
    for (const kind of ["direct-analysis", "specialized-agent", "durable-mission"] as Route["kind"][]) {
      const harness = makeHarness();
      const { ports, calls } = makePorts((_callsState) => async () =>
        makeSuccessResponse(harness.workUnit, harness.mission),
      );
      const result = await executeRoutingWork(
        makeExecutionInput(harness, ports, validateTransition, makeCoreRoute(kind)),
      );
      expect(result.ok).toBe(true);
      expect(calls[KIND_TO_PORT[kind]]()).toBe(1);
      if (result.ok) {
        expect(result.result.workUnitId).toBe(harness.workUnit.id);
        expect(result.result.outcome.kind).toBe("SUCCEEDED");
        expect(result.result.nextTransition.to).toBe(AccountingMissionStatus.RUNNING);
      }
    }
  });

  it("kind→port mapping: durable-mission dispatches through the durable port only", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition, makeCoreRoute("durable-mission")),
    );
    expect(result.ok).toBe(true);
    expect(calls.durable()).toBe(1);
    expect(calls.direct()).toBe(0);
    expect(calls.delegated()).toBe(0);
  });

  it("an unknown route kind fails closed with AMBIGUOUS_INPUT and zero port calls", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const tampered = {
      ...makeCoreRoute("direct-analysis"),
      kind: "rogue-route",
    } as unknown as Route;
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition, tampered),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
    if (failure.reason.kind === "AMBIGUOUS_INPUT") {
      expect(failure.reason.fields).toContain("route.kind");
    }
    expect(failure.portCalls).toBe(0);
    expect(calls.direct()).toBe(0);
    expect(calls.delegated()).toBe(0);
    expect(calls.durable()).toBe(0);
  });

  it("validator denial: an injected validator rejecting the observed edge returns INVALID_TRANSITION and leaves the unit unchanged", async () => {
    const harness = makeHarness();
    const spy: CanonicalTransitionValidator = (from, to) => {
      if (from === AccountingMissionStatus.DRAFT && to === AccountingMissionStatus.QUEUED) {
        throw new Error("spy denial");
      }
      validateTransition(from, to);
    };
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, spy),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("INVALID_TRANSITION");
    if (failure.reason.kind === "INVALID_TRANSITION") {
      expect(failure.reason.from).toBe(AccountingMissionStatus.DRAFT);
      expect(failure.reason.to).toBe(AccountingMissionStatus.QUEUED);
    }
    expect(calls.direct()).toBe(1);
    // The original unit is unchanged.
    expect(result.workUnit.stage).toBe(AccountingMissionStatus.DRAFT);
    expect(result.result).toBeUndefined();
  });

  it("budget exhaustion before dispatch: typed BUDGET_EXHAUSTED with zero port calls", async () => {
    const harness = makeHarness();
    harness.ledger.debit("research");
    harness.ledger.debit("research");
    harness.ledger.debit("research"); // at the ceiling of 3
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("BUDGET_EXHAUSTED");
    if (failure.reason.kind === "BUDGET_EXHAUSTED") {
      expect(failure.reason.budget).toBe("RESEARCH_ATTEMPTS");
    }
    expect(calls.direct()).toBe(0);
    expect(failure.portCalls).toBe(0);
    // A structured STOPPED result is produced where the contract permits it.
    expect(failure.result).toBeDefined();
    if (failure.result) {
      expect(failure.result.outcome.kind).toBe("STOPPED");
    }
    expect(harness.ledger.isClosed()).toBe(true);
  });

  it("over-consumption after dispatch: BUDGET_EXHAUSTED with exactly one port call and no retry", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission, {
        consumption: {
          elapsedMs: 1,
          tokens: 1,
          costIncurredCents: 2_000_000n,
          researchAttempts: 1,
          correctionAttempts: 0,
        },
      }),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("BUDGET_EXHAUSTED");
    if (failure.reason.kind === "BUDGET_EXHAUSTED") {
      expect(failure.reason.budget).toBe("COST");
    }
    expect(calls.direct()).toBe(1);
    expect(failure.portCalls).toBe(1);
    expect(harness.ledger.isClosed()).toBe(true);
  });

  it("provenance loss: a candidate without subjectHash fails closed with no result", async () => {
    const harness = makeHarness();
    const brokenCandidate = { ...makeRoutingCandidate(harness.mission), subjectHash: "" };
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission, {
        candidates: [
          { candidate: brokenCandidate, materialityBasis: makeRoutingMaterialityBasis() },
        ],
      }),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
    if (failure.reason.kind === "AMBIGUOUS_INPUT") {
      expect(failure.reason.fields.some((field) => field.includes("subjectHash"))).toBe(true);
    }
    expect(failure.result).toBeUndefined();
    expect(calls.direct()).toBe(1);
  });

  it("candidate provenance: a valid candidate becomes a ProposedCandidateRef with subjectHash and materialityBasis", async () => {
    const harness = makeHarness();
    const candidate = makeRoutingCandidate(harness.mission);
    const { ports } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission, {
        candidates: [{ candidate, materialityBasis: makeRoutingMaterialityBasis() }],
      }),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.proposedCandidates).toHaveLength(1);
      expect(SHA256_HEX.test(result.result.proposedCandidates[0]?.subjectHash ?? "")).toBe(true);
      expect(result.result.proposedCandidates[0]?.materialityBasis.value).toBe(0n);
    }
  });

  it("UNKNOWN no retry: an already-UNKNOWN mission is rejected before dispatch with a MISSION_UNKNOWN exception", async () => {
    const harness = makeHarness();
    const unknownMission: MissionSnapshot = {
      ...harness.mission,
      status: AccountingMissionStatus.UNKNOWN,
    };
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, unknownMission),
    );
    const result = await executeRoutingWork(
      {
        ...makeExecutionInput(harness, ports, validateTransition),
        mission: unknownMission,
      },
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
    expect(calls.direct()).toBe(0);
    expect(failure.portCalls).toBe(0);
    expect(failure.unresolvedExceptions.some((e) => e.code === "MISSION_UNKNOWN")).toBe(true);
    expect(harness.ledger.isClosed()).toBe(true);
  });

  it("UNKNOWN no retry: a port returning UNKNOWN records the exception, builds a STOPPED result, and never resubmits", async () => {
    const harness = makeHarness(AccountingMissionStatus.RUNNING);
    const unknownAfter: MissionSnapshot = {
      ...harness.mission,
      status: AccountingMissionStatus.UNKNOWN,
    };
    const { ports, calls } = makePorts((_callsState) => async () => ({
      missionBefore: harness.mission,
      missionAfter: unknownAfter,
      evidenceRefs: harness.workUnit.evidenceAllowed,
      candidates: [],
      unresolvedExceptions: [],
      toolProvenance: [],
      consumption: {
        elapsedMs: 1,
        tokens: 1,
        costIncurredCents: 1n,
        researchAttempts: 1,
        correctionAttempts: 0,
      },
      coreProposedTarget: undefined,
    }));
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    const failure = expectFailure(result);
    expect(failure.portCalls).toBe(1);
    expect(calls.direct()).toBe(1);
    expect(failure.unresolvedExceptions.some((e) => e.code === "MISSION_UNKNOWN")).toBe(true);
    if (failure.result) {
      expect(failure.result.outcome.kind).toBe("STOPPED");
      if (failure.result.outcome.kind === "STOPPED") {
        expect(failure.result.outcome.reason.kind).toBe("AMBIGUOUS_INPUT");
      }
    }
    expect(harness.ledger.isClosed()).toBe(true);
    // No second invocation is attempted after UNKNOWN.
    expect(calls.direct()).toBe(1);
  });

  it("mutated nextTransition after construction is rejected by validateWorkResult", async () => {
    const harness = makeHarness();
    const { ports } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // QUEUED -> FAILED is a legal Core edge, so it would NOT be rejected;
      // the tamper example must be an edge the canonical validator denies
      // (QUEUED -> COMPLETED) to prove post-construction mutation is caught.
      const mutated = {
        ...result.result,
        nextTransition: {
          from: AccountingMissionStatus.QUEUED,
          to: AccountingMissionStatus.COMPLETED,
        },
      };
      const validation = validateWorkResult(
        mutated,
        result.workUnit,
        validateTransition,
      );
      expect(validation.ok).toBe(false);
    }
  });

  it("scope binding retention: a changed scope hash after preflight fails before dispatch", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const mutatedBinding: ScopeBinding = {
      ...harness.binding,
      scopeHash: digest("0"),
    };
    const result = await executeRoutingWork(
      {
        ...makeExecutionInput(harness, ports, validateTransition),
        binding: mutatedBinding,
      },
    );
    const failure = expectFailure(result);
    expect(failure.portCalls).toBe(0);
    expect(calls.direct()).toBe(0);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
  });

      it("no-leak: a ledger bound to another work unit fails closed", async () => {
        const harness = makeHarness();
        // A genuinely foreign unit: buildUnit derives its id from the mission id,
        // so a different mission id yields a different WorkUnit.id.
        const other = buildUnit({
          ...harness.mission,
          id: "mission-executor-002",
        });
        const foreignLedger = BudgetLedger.create(other);
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission),
    );
    const result = await executeRoutingWork({
      ...makeExecutionInput(harness, ports, validateTransition),
      ledger: foreignLedger,
    });
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
    expect(calls.direct()).toBe(0);
  });

  it("a port reporting a mission identity change fails closed", async () => {
    const harness = makeHarness();
    const { ports, calls } = makePorts((_callsState) => async () =>
      makeSuccessResponse(harness.workUnit, harness.mission, {
        missionAfter: { ...harness.mission, id: "mission-other" },
      }),
    );
    const result = await executeRoutingWork(
      makeExecutionInput(harness, ports, validateTransition),
    );
    const failure = expectFailure(result);
    expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
    expect(calls.direct()).toBe(1);
    expect(failure.result).toBeUndefined();
  });
});
