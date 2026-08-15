/**
 * Bounded executor and structured result (pi-sdd-030-routing-adapter; design D4
 * §6, rebased to consume the Core `route()` decision). `executeRoutingWork`
 * performs ONE bounded dispatch through the injected
 * route port, advancing work ONLY through the injected canonical validator
 * (`drenyra-ai/missions` `validateTransition`, constructor-injectable for
 * negative controls), enforces the per-work-unit `BudgetLedger` (research ≤ 3,
 * correction = 1, cost/time/token ceilings, no cross-unit or cross-route leak),
 * and builds every result through the published `createWorkResult` +
 * `validateWorkResult` helpers.
 *
 * Authority boundary (REQ-BOUND-001): this module contains NO transition table
 * and NO catch-and-approve wrapper. Transition eligibility is decided ONLY by
 * the injected Core validator through `advanceWorkUnit` / `createWorkResult` /
 * `validateWorkResult`. The single exception is a documented fallback that names
 * the engine's canonical ENTRY edge (DRAFT → QUEUED) so a pre-dispatch typed
 * budget stop can still carry the mandatory structured STOPPED result
 * (REQ-EXEC-004); the injected validator remains the eligibility authority for
 * that pair too.
 *
 * UNKNOWN is never blind-retried and never auto-advanced: an already-UNKNOWN
 * mission is rejected before dispatch with `AMBIGUOUS_INPUT` + an unresolved
 * `MISSION_UNKNOWN` exception; a port moving a known mission into UNKNOWN
 * records the exception, emits the observed known-state → UNKNOWN edge as the
 * (validator-approved) `nextTransition`, and performs zero further port calls.
 * Recovery stays outside ordinary routing execution
 * (reconciliation / explicit human action only).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import {
  AccountingMissionStatus,
  type AccountingException,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import { validateTransition } from "drenyra-ai/missions";
import {
  advanceWorkUnit,
  createProposedCandidateRef,
  createWorkResult,
  toJsonInteger,
  validateWorkResult,
  type CanonicalTransitionValidator,
  type ProposedCandidateRef,
  type Route,
  type WorkOutcome,
  type WorkResult,
  type WorkResultInput,
  type WorkUnit,
} from "drenyra-ai";
import { bindScope } from "../canonicalization.js";
import type {
  BudgetExhaustedDimension,
  ExecuteRoutingWorkInput,
  RouteExecutionPortResponse,
  RouteExecutionResult,
  RoutingRoute,
} from "./types.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Core route kind → Pi execution-port name (Pi proposes/executes only). */
const ROUTE_PORTS: Readonly<Record<Route["kind"], RoutingRoute>> = {
  "direct-analysis": "direct",
  "specialized-agent": "delegated",
  "durable-mission": "durable",
};
const TERMINAL_STATUSES: ReadonlySet<AccountingMissionStatus> = new Set([
  AccountingMissionStatus.COMPLETED,
  AccountingMissionStatus.FAILED,
  AccountingMissionStatus.REJECTED,
]);

/** Build a published `AccountingException` with every required field. */
function makeException(
  missionId: string,
  code: string,
  severity: string,
  subjectRef: string,
  evidenceRefs: string[],
  resolutionStatus: string,
): AccountingException {
  return {
    id: `exc-${code.toLowerCase()}-${missionId}`,
    missionId,
    code,
    severity,
    subjectRef,
    evidenceRefs,
    resolutionStatus,
  };
}

/** The explicit unresolved exception for an UNKNOWN mission (design §6.3). */
function missionUnknownException(mission: MissionSnapshot): AccountingException {
  return makeException(
    mission.id,
    "MISSION_UNKNOWN",
    "ERROR",
    mission.id,
    [],
    "RECONCILIATION_OR_EXPLICIT_HUMAN_ACTION_REQUIRED",
  );
}

/** The explicit unresolved exception for a typed budget exhaustion stop. */
function budgetException(
  unit: WorkUnit,
  dimension: BudgetExhaustedDimension,
): AccountingException {
  return makeException(
    unit.missionId,
    `BUDGET_EXHAUSTED_${dimension}`,
    "WARNING",
    unit.id,
    unit.evidenceAllowed.map((ref) => ref.hash),
    "STOPPED_BY_POLICY",
  );
}

/**
 * The single canonical successor of the published initial stage (DRAFT → QUEUED).
 * This is NOT a transition matrix: it names only the engine's entry edge
 * (cited: `drenyra-ai` routing helpers `INITIAL_STAGE = "DRAFT"`; the EDA
 * coordinator maps the intake phase to QUEUED). For every other stage it returns
 * undefined and the executor fails closed when no observed/proposed Core target
 * exists. Eligibility of the pair is still decided by the injected validator
 * through `createWorkResult`.
 */
function canonicalEntryStage(
  stage: AccountingMissionStatus,
): AccountingMissionStatus | undefined {
  if (stage === AccountingMissionStatus.DRAFT) {
    return AccountingMissionStatus.QUEUED;
  }
  return undefined;
}

/**
 * Resolve the `to` of the result's `nextTransition` from Core-observed or
 * Core-proposed state only. Priority: (1) the port's `coreProposedTarget`, (2)
 * the observed `missionBefore → missionAfter` edge when the unit was not
 * advanced into it (UNKNOWN / terminal / over-consumption stops). Every pair is
 * probed through the injected validator; a rejected pair never becomes a
 * transition and returns undefined (fail closed).
 */
function resolveNextTarget(
  unit: WorkUnit,
  observed: { before: MissionSnapshot; after: MissionSnapshot } | undefined,
  coreProposedTarget: AccountingMissionStatus | undefined,
  validator: CanonicalTransitionValidator,
): AccountingMissionStatus | undefined {
  if (coreProposedTarget !== undefined) {
    try {
      validator(unit.stage, coreProposedTarget);
      return coreProposedTarget;
    } catch {
      // not Core-eligible — fall through to the observed edge
    }
  }
  if (
    observed !== undefined &&
    observed.before.status !== observed.after.status &&
    observed.after.status !== unit.stage
  ) {
    try {
      validator(unit.stage, observed.after.status);
      return observed.after.status;
    } catch {
      // not Core-eligible — fail closed
    }
  }
  return undefined;
}

/** Verify a port response: mission identity, evidence hashes, tool allow-list, consumption. */
function verifyResponse(
  workUnit: WorkUnit,
  mission: MissionSnapshot,
  response: RouteExecutionPortResponse,
): string[] | undefined {
  const fields: string[] = [];
  if (response.missionAfter.id !== mission.id) {
    fields.push("missionAfter.id");
  }
  if (response.missionAfter.companyId !== mission.companyId) {
    fields.push("missionAfter.companyId");
  }
  if (response.missionAfter.fiscalPeriod !== mission.fiscalPeriod) {
    fields.push("missionAfter.fiscalPeriod");
  }
  for (let index = 0; index < response.evidenceRefs.length; index += 1) {
    const ref = response.evidenceRefs[index];
    if (
      ref === undefined ||
      ref.algorithm !== "sha256" ||
      typeof ref.hash !== "string" ||
      !SHA256_HEX.test(ref.hash)
    ) {
      fields.push(`evidenceRefs[${index}].hash`);
    }
  }
  for (let index = 0; index < response.toolProvenance.length; index += 1) {
    const tool = response.toolProvenance[index];
    const authorized = workUnit.authorizedTools.find(
      (candidate) => candidate.id === tool.toolId,
    );
    if (
      authorized === undefined ||
      !authorized.operations.includes(tool.operation) ||
      typeof tool.outputHash !== "string" ||
      !SHA256_HEX.test(tool.outputHash)
    ) {
      fields.push(`toolProvenance[${index}]`);
    }
  }
  const consumption = response.consumption;
  if (
    typeof consumption.elapsedMs !== "number" ||
    !Number.isSafeInteger(consumption.elapsedMs) ||
    consumption.elapsedMs < 0
  ) {
    fields.push("consumption.elapsedMs");
  }
  if (
    typeof consumption.tokens !== "number" ||
    !Number.isSafeInteger(consumption.tokens) ||
    consumption.tokens < 0
  ) {
    fields.push("consumption.tokens");
  }
  if (
    typeof consumption.costIncurredCents !== "bigint" ||
    consumption.costIncurredCents < 0n
  ) {
    fields.push("consumption.costIncurredCents");
  }
  return fields.length > 0 ? fields : undefined;
}

/**
 * One shared result-construction path (design §6.2): builds the structured
 * `WorkResultInput`, calls `createWorkResult` then `validateWorkResult` with the
 * injected validator, and requires BOTH to return `ok: true`. Candidate refs are
 * produced ONLY through `createProposedCandidateRef`; provenance loss fails
 * closed before any result exists.
 */
function buildRoutingWorkResult(
  unit: WorkUnit,
  outcome: WorkOutcome,
  response: RouteExecutionPortResponse | undefined,
  ledger: Pick<import("./types.js").BudgetLedger, "researchCount" | "correctionCount" | "snapshot">,
  target: AccountingMissionStatus,
  validator: CanonicalTransitionValidator,
): { ok: true; value: WorkResult } | { ok: false; fields: string[] } {
  const proposedCandidates: ProposedCandidateRef[] = [];
  const candidates = response?.candidates ?? [];
  for (let index = 0; index < candidates.length; index += 1) {
    const entry = candidates[index];
    if (entry === undefined) continue;
    const subjectHash = entry.candidate?.subjectHash;
    if (typeof subjectHash !== "string" || !SHA256_HEX.test(subjectHash)) {
      return { ok: false, fields: [`proposedCandidates[${index}].subjectHash`] };
    }
    const ref = createProposedCandidateRef(
      entry.candidate,
      entry.materialityBasis,
    );
    if (!ref.ok) {
      return {
        ok: false,
        fields: [`proposedCandidates[${index}].materialityBasis`],
      };
    }
    proposedCandidates.push(ref.value);
  }

  const researchJson = toJsonInteger(ledger.researchCount);
  const correctionJson = toJsonInteger(ledger.correctionCount);
  if (!researchJson.ok || !correctionJson.ok) {
    return { ok: false, fields: ["costAndAttempts.researchAttempts"] };
  }

  const input: WorkResultInput = {
    outcome,
    evidenceRefs: response?.evidenceRefs ?? unit.evidenceAllowed,
    proposedCandidates,
    unresolvedExceptions: response?.unresolvedExceptions ?? [],
    policyVersions: unit.policies,
    toolProvenance: response?.toolProvenance ?? [],
    costAndAttempts: {
      costIncurredCents: ledger.snapshot().costIncurredCents,
      researchAttempts: researchJson.value,
      correctionAttempts: correctionJson.value,
    },
    nextTransition: { from: unit.stage, to: target },
    ...(response?.explanation === undefined
      ? {}
      : { explanation: response.explanation }),
  };

  const created = createWorkResult(unit, input, validator);
  if (!created.ok) {
    return { ok: false, fields: created.issues.map((issue) => issue.path) };
  }
  const validated = validateWorkResult(created.value, unit, validator);
  if (!validated.ok) {
    return { ok: false, fields: validated.issues.map((issue) => issue.path) };
  }
  return { ok: true, value: validated.value };
}

/**
 * Execute ONE bounded routing operation (design §6.1). Dispatches exactly one
 * selected route port, never falls through to another route, never transfers a
 * ledger, and never retries. All authoritative decisions (transition
 * eligibility, result construction) flow through the injected Core validator.
 */
export async function executeRoutingWork(
  input: ExecuteRoutingWorkInput,
): Promise<RouteExecutionResult> {
  const {
    workUnit,
    route,
    binding,
    mission,
    ports,
    ledger,
    chain,
    chainRun,
    validator,
  } = input;
  const canonical: CanonicalTransitionValidator = validator ?? validateTransition;

  // 1. Immutable identity and scope (design §6.1 step 1) — pre-dispatch, no port call.
  try {
    ledger.assertWorkUnit(workUnit);
  } catch {
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["ledger.workUnitId"] },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [],
    };
  }

  let recomputedScopeHash: string | undefined;
  try {
    recomputedScopeHash = bindScope(binding.scope).scopeHash;
  } catch {
    recomputedScopeHash = undefined;
  }
  if (recomputedScopeHash !== binding.scopeHash) {
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["binding.scopeHash"] },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [],
    };
  }

  if (
    workUnit.missionId !== mission.id ||
    workUnit.scope.companyId !== mission.companyId ||
    workUnit.scope.period !== mission.fiscalPeriod ||
    workUnit.scope.intent !== mission.intent
  ) {
    return {
      ok: false,
      reason: {
        kind: "AMBIGUOUS_INPUT",
        fields: [
          "workUnit.missionId",
          "workUnit.scope.companyId",
          "workUnit.scope.period",
          "workUnit.scope.intent",
        ],
      },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [],
    };
  }

  for (let index = 0; index < workUnit.evidenceAllowed.length; index += 1) {
    const ref = workUnit.evidenceAllowed[index];
    if (
      ref === undefined ||
      ref.algorithm !== "sha256" ||
      typeof ref.hash !== "string" ||
      !SHA256_HEX.test(ref.hash)
    ) {
      return {
        ok: false,
        reason: {
          kind: "AMBIGUOUS_INPUT",
          fields: [`workUnit.evidenceAllowed[${index}].hash`],
        },
        workUnit,
        portCalls: 0,
        unresolvedExceptions: [],
      };
    }
  }

  const routePort = (ROUTE_PORTS as Readonly<
    Record<string, RoutingRoute | undefined>
  >)[route.kind];
  if (routePort === undefined) {
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["route.kind"] },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [],
    };
  }
  const port = ports[routePort];
  if (typeof port !== "function") {
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: [`ports.${routePort}`] },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [],
    };
  }

  // 2. Already-UNKNOWN missions are not executable (design §6.1 step 2, §6.3):
  //    no port call, no retry, no auto-advance, no ordinary transition for recovery.
  if (mission.status === AccountingMissionStatus.UNKNOWN) {
    const exception = missionUnknownException(mission);
    ledger.close();
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] },
      workUnit,
      portCalls: 0,
      unresolvedExceptions: [exception],
    };
  }

  // 3. Pre-dispatch budget ceilings (design §6.1 step 3).
  const preCheck = ledger.check();
  if (!preCheck.ok) {
    ledger.close();
    const exception = budgetException(workUnit, preCheck.dimension);
    const entryStage = canonicalEntryStage(workUnit.stage);
    const built =
      entryStage === undefined
        ? undefined
        : buildRoutingWorkResult(
            workUnit,
            { kind: "STOPPED", reason: { kind: "BUDGET_EXHAUSTED", budget: preCheck.dimension } },
            undefined,
            ledger,
            entryStage,
            canonical,
          );
    return {
      ok: false,
      reason: { kind: "BUDGET_EXHAUSTED", budget: preCheck.dimension },
      workUnit,
      portCalls: 0,
      ...(built?.ok === true ? { result: built.value } : {}),
      unresolvedExceptions: [exception],
    };
  }

  // 4. Exactly ONE bounded dispatch (design §6.1 step 4; no loop, no fall-through).
  let response: RouteExecutionPortResponse;
  try {
    response = await port({
      workUnit,
      route: routePort,
      binding,
      mission,
      chain,
      chainRun,
      ledger,
    });
  } catch {
    ledger.close();
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: [`ports.${routePort}`] },
      workUnit,
      portCalls: 1,
      unresolvedExceptions: [],
    };
  }

  // 5. Verify the returned mission IDs/scope, evidence hashes, tool operations,
  //    destinations, and consumption (design §6.1 step 5).
  const responseIssue = verifyResponse(workUnit, mission, response);
  if (responseIssue !== undefined) {
    ledger.close();
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: responseIssue },
      workUnit,
      portCalls: 1,
      unresolvedExceptions: [],
    };
  }

  // 6. Account consumption into the per-unit ledger; reject over-consumption
  //    even when the port reports success (design §6.1 step 5).
  for (let index = 0; index < response.consumption.researchAttempts; index += 1) {
    ledger.debit("research");
  }
  for (let index = 0; index < response.consumption.correctionAttempts; index += 1) {
    ledger.debit("correction");
  }
  const postCheck = ledger.recordConsumption({
    elapsedMs: response.consumption.elapsedMs,
    tokens: response.consumption.tokens,
    costIncurredCents: response.consumption.costIncurredCents,
  });
  if (!postCheck.ok) {
    ledger.close();
    const exception = budgetException(workUnit, postCheck.dimension);
    const observed = { before: response.missionBefore, after: response.missionAfter };
    const target = resolveNextTarget(
      workUnit,
      observed,
      undefined,
      canonical,
    );
    const built =
      target === undefined
        ? undefined
        : buildRoutingWorkResult(
            workUnit,
            { kind: "STOPPED", reason: { kind: "BUDGET_EXHAUSTED", budget: postCheck.dimension } },
            response,
            ledger,
            target,
            canonical,
          );
    return {
      ok: false,
      reason: { kind: "BUDGET_EXHAUSTED", budget: postCheck.dimension },
      workUnit,
      portCalls: 1,
      ...(built?.ok === true ? { result: built.value } : {}),
      unresolvedExceptions: [exception],
    };
  }

  // 7. Observe the Core transition and advance ONLY through the injected validator
  //    (design §6.1 step 6). UNKNOWN and terminal targets are never advanced into:
  //    the unit keeps its stage and the observed edge is declared (design §6.3).
  const observedFrom = response.missionBefore.status;
  const observedTo = response.missionAfter.status;
  let resultUnit = workUnit;
  if (
    observedTo !== observedFrom &&
    observedTo !== AccountingMissionStatus.UNKNOWN &&
    !TERMINAL_STATUSES.has(observedTo)
  ) {
    const advanced = advanceWorkUnit(workUnit, observedTo, canonical);
    if (!advanced.ok) {
      ledger.close();
      return {
        ok: false,
        reason: { kind: "INVALID_TRANSITION", from: observedFrom, to: observedTo },
        workUnit,
        portCalls: 1,
        unresolvedExceptions: [],
      };
    }
    resultUnit = advanced.value;
  }

  // 8. Outcome + unresolved exceptions (typed stops only; no invented kind).
  const unresolvedExceptions: AccountingException[] = [
    ...response.unresolvedExceptions,
  ];
  let outcome: WorkOutcome;
  if (
    observedTo === AccountingMissionStatus.UNKNOWN &&
    observedTo !== observedFrom
  ) {
    unresolvedExceptions.push(missionUnknownException(mission));
    outcome = {
      kind: "STOPPED",
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] },
    };
  } else if (observedTo !== observedFrom && TERMINAL_STATUSES.has(observedTo)) {
    if (observedTo === AccountingMissionStatus.COMPLETED) {
      outcome = { kind: "SUCCEEDED" };
    } else {
      unresolvedExceptions.push(
        makeException(
          mission.id,
          "MISSION_FAILED",
          "ERROR",
          mission.id,
          response.evidenceRefs.map((ref) => ref.hash),
          "TERMINAL_FAILURE_REQUIRES_HUMAN_ACTION",
        ),
      );
      outcome = {
        kind: "STOPPED",
        reason: { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] },
      };
    }
  } else if (response.stop === undefined) {
    outcome = { kind: "SUCCEEDED" };
  } else {
    outcome = { kind: "STOPPED", reason: response.stop };
  }

  // 9. Resolve the next Core target and build/validate the result through one
  //    shared path (design §6.1 steps 7–8). No valid target → fail closed.
  const observed = { before: response.missionBefore, after: response.missionAfter };
  const target =
    resolveNextTarget(resultUnit, observed, response.coreProposedTarget, canonical) ??
    canonicalEntryStage(resultUnit.stage);
  if (target === undefined) {
    ledger.close();
    return {
      ok: false,
      reason: { kind: "INVALID_TRANSITION", from: resultUnit.stage, to: observedTo },
      workUnit,
      portCalls: 1,
      unresolvedExceptions,
    };
  }

  const built = buildRoutingWorkResult(
    resultUnit,
    outcome,
    response,
    ledger,
    target,
    canonical,
  );
  if (!built.ok) {
    ledger.close();
    return {
      ok: false,
      reason: { kind: "AMBIGUOUS_INPUT", fields: built.fields },
      workUnit,
      portCalls: 1,
      unresolvedExceptions,
    };
  }

  // A STOPPED/FAILED outcome is a typed stop, never a success (design §6.2): the
  // structured result is still built and validated through the shared path, but
  // the call returns `ok: false` with the published stop reason and the
  // unresolved exceptions (UNKNOWN, WAIT/authority adapter stops, budget stops).
  if (outcome.kind !== "SUCCEEDED") {
    ledger.close();
    return {
      ok: false,
      reason: outcome.reason,
      workUnit,
      portCalls: 1,
      result: built.value,
      unresolvedExceptions,
    };
  }

  return { ok: true, workUnit: resultUnit, result: built.value, portCalls: 1 };
}
