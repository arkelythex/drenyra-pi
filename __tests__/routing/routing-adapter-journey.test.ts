/**
 * WU5 — end-to-end routing-adapter journey test (pi-sdd-030-routing-adapter;
 * REQ-EXEC-005 / SC-EXEC-007).
 *
 * Exercises the full pinned-runtime journey against the real drenyra-ai@0.4.0
 * kernel:
 *
 *   preflight (8-stage) -> Core route decision (drenyra-ai routing/router.ts)
 *   -> execute (bounded dispatch through the injected port, advance ONLY via
 *   the injected validateTransition) -> validated WorkResult.
 *
 * Negative controls prove fail-closed behavior: evidence-insufficient preflight
 * never produces a WorkUnit; budget exhaustion stops with a typed
 * BUDGET_EXHAUSTED reason and zero port calls; an UNKNOWN outcome is never
 * retried and never auto-advanced; a validator that denies an observed edge
 * yields INVALID_TRANSITION and leaves the unit unchanged (the injected
 * validator is the sole transition authority — REQ-BOUND-001).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import {
	AccountingMissionStatus,
	type CanonicalTransitionValidator,
	type MissionSnapshot,
	validateTransition,
} from "drenyra-ai";
import { validateWorkResult } from "drenyra-ai";
import { runRoutingPreflight } from "../../lib/routing/preflight.js";
import { executeRoutingWork } from "../../lib/routing/executor.js";
import { BudgetLedger } from "../../lib/routing/types.js";
import type {
	ExecuteRoutingWorkInput,
	RouteExecutionPortResponse,
	RouteExecutionResult,
	RoutingExecutionPorts,
} from "../../lib/routing/types.js";
import type { WorkUnit } from "drenyra-ai";
import type { ChainDefinition } from "../../lib/chain-pipeline.js";
import { digest, makeCoreRoute, makeRoutingPreflightRequest } from "./fixtures.js";

function makeStubChain(): ChainDefinition<unknown, unknown> {
	return {
		name: "stub-chain",
		intent: "monthly-close",
		requiredMode: "EXECUTE",
		runStep: async () => ({ output: null }),
	};
}

function makeSuccessResponse(
	unit: WorkUnit,
	mission: MissionSnapshot,
	overrides: Partial<RouteExecutionPortResponse> = {},
): RouteExecutionPortResponse {
	const after: MissionSnapshot = { ...mission, status: AccountingMissionStatus.QUEUED };
	return {
		missionBefore: mission,
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

function makePorts(
	handler: (
		state: { count: number },
	) => (
		input: { workUnit: WorkUnit },
	) => Promise<RouteExecutionPortResponse>,
): { ports: RoutingExecutionPorts; calls: Record<string, () => number> } {
	const trackers = { direct: { count: 0 }, delegated: { count: 0 }, durable: { count: 0 } };
	const wrap =
		(tracker: { count: number }) =>
		async (input: { workUnit: WorkUnit }) => {
			tracker.count += 1;
			return handler(tracker)(input);
		};
	return {
		ports: {
			direct: wrap(trackers.direct),
			delegated: wrap(trackers.delegated),
			durable: wrap(trackers.durable),
		},
		calls: {
			direct: () => trackers.direct.count,
			delegated: () => trackers.delegated.count,
			durable: () => trackers.durable.count,
		},
	};
}

function expectFailure(result: RouteExecutionResult): Extract<RouteExecutionResult, { ok: false }> {
	expect(result.ok).toBe(false);
	return result as Extract<RouteExecutionResult, { ok: false }>;
}

describe("routing-adapter journey (REQ-EXEC-005 / SC-EXEC-007)", () => {
	it("preflight -> route -> execute -> validated WorkResult on the real pinned runtime", async () => {
		const { request, mission, binding } = await makeRoutingPreflightRequest();
		const preflight = await runRoutingPreflight(request);
		expect(preflight.ok).toBe(true);
		if (!preflight.ok) return;
		// The route DECISION comes from the Core router (routing/router.ts): the
		// fixture axes (R0, reversible, read-only, single system) route direct-analysis.
		expect(preflight.route.kind).toBe("direct-analysis");

		const { ports, calls } = makePorts((_state) => async ({ workUnit }) =>
			makeSuccessResponse(workUnit, mission),
		);
		const input: ExecuteRoutingWorkInput = {
			workUnit: preflight.workUnit,
			route: preflight.route,
			binding,
			mission,
			ports,
			ledger: BudgetLedger.create(preflight.workUnit),
			chain: makeStubChain(),
			chainRun: { binding, input: {} },
			validator: validateTransition,
		};
		const result = await executeRoutingWork(input);

		expect(result.ok).toBe(true);
		expect(calls.direct()).toBe(1);
		if (result.ok) {
			// The result is a structured WorkResult produced via the published
			// helpers and validated against the injected canonical validator.
			expect(result.result.workUnitId).toBe(preflight.workUnit.id);
			expect(result.result.outcome.kind).toBe("SUCCEEDED");
			expect(result.result.nextTransition.from).toBe(AccountingMissionStatus.QUEUED);
			expect(result.result.nextTransition.to).toBe(AccountingMissionStatus.RUNNING);
			expect(result.result.costAndAttempts.researchAttempts).toBe(1);
			expect(typeof result.result.costAndAttempts.costIncurredCents).toBe("bigint");
			// Re-validation of the emitted result succeeds under the same validator
			// (published helper signature: validateWorkResult(result, unit, validator)).
			expect(() =>
				validateWorkResult(result.result, preflight.workUnit, validateTransition),
			).not.toThrow();
		}
	});

	it("evidence-insufficient preflight fails closed: no WorkUnit, no route, no dispatch", async () => {
		const { request } = await makeRoutingPreflightRequest();
		const mutated: typeof request = {
			...request,
			// A required hash absent from the seeded evidence graph fails closed.
			requiredEvidenceHashes: [digest("b")],
		};
		const preflight = await runRoutingPreflight(mutated);
		expect(preflight.ok).toBe(false);
	});

	it("budget exhaustion stops with a typed BUDGET_EXHAUSTED reason and no dispatch", async () => {
		const { request, mission, binding } = await makeRoutingPreflightRequest();
		const preflight = await runRoutingPreflight(request);
		expect(preflight.ok).toBe(true);
		if (!preflight.ok) return;

		const { ports, calls } = makePorts((_state) => async ({ workUnit }) =>
			makeSuccessResponse(workUnit, mission),
		);
		const exhausted = BudgetLedger.create(preflight.workUnit);
		exhausted.debit("research");
		exhausted.debit("research");
		exhausted.debit("research"); // at the ceiling of 3
		const input: ExecuteRoutingWorkInput = {
			workUnit: preflight.workUnit,
			route: makeCoreRoute("direct-analysis"),
			binding,
			mission,
			ports,
			ledger: exhausted,
			chain: makeStubChain(),
			chainRun: { binding, input: {} },
			validator: validateTransition,
		};
		const failure = expectFailure(await executeRoutingWork(input));
		expect(failure.reason.kind).toBe("BUDGET_EXHAUSTED");
		if (failure.reason.kind === "BUDGET_EXHAUSTED") {
			expect(failure.reason.budget).toBe("RESEARCH_ATTEMPTS");
		}
		expect(calls.direct()).toBe(0);
	});

	it("UNKNOWN outcome is never retried and never auto-advanced", async () => {
		const { request, mission, binding } = await makeRoutingPreflightRequest();
		const preflight = await runRoutingPreflight(request);
		expect(preflight.ok).toBe(true);
		if (!preflight.ok) return;

		const unknownAfter: MissionSnapshot = { ...mission, status: AccountingMissionStatus.UNKNOWN };
		const { ports, calls } = makePorts((_state) => async ({ workUnit }) =>
			makeSuccessResponse(workUnit, mission, {
				missionAfter: unknownAfter,
				coreProposedTarget: undefined,
			}),
		);
		const input: ExecuteRoutingWorkInput = {
			workUnit: preflight.workUnit,
			route: makeCoreRoute("direct-analysis"),
			binding,
			mission,
			ports,
			ledger: BudgetLedger.create(preflight.workUnit),
			chain: makeStubChain(),
			chainRun: { binding, input: {} },
			validator: validateTransition,
		};
		const failure = expectFailure(await executeRoutingWork(input));
		// Exactly one dispatch; the port returned UNKNOWN and the executor never
		// resubmitted the unit. A typed stop + exception, no blind retry.
		expect(calls.direct()).toBe(1);
		expect(failure.portCalls).toBe(1);
		expect(failure.reason.kind).toBe("AMBIGUOUS_INPUT");
		expect(failure.unresolvedExceptions.some((e) => e.code === "MISSION_UNKNOWN")).toBe(true);
	});

	it("the injected validator is the sole transition authority: a denial yields INVALID_TRANSITION", async () => {
		const { request, mission, binding } = await makeRoutingPreflightRequest();
		const preflight = await runRoutingPreflight(request);
		expect(preflight.ok).toBe(true);
		if (!preflight.ok) return;

		const denying: CanonicalTransitionValidator = (from, to) => {
			if (from === AccountingMissionStatus.DRAFT && to === AccountingMissionStatus.QUEUED) {
				throw new Error("spy denial");
			}
			validateTransition(from, to);
		};
		const { ports, calls } = makePorts((_state) => async ({ workUnit }) =>
			makeSuccessResponse(workUnit, mission),
		);
		const input: ExecuteRoutingWorkInput = {
			workUnit: preflight.workUnit,
			route: makeCoreRoute("direct-analysis"),
			binding,
			mission,
			ports,
			ledger: BudgetLedger.create(preflight.workUnit),
			chain: makeStubChain(),
			chainRun: { binding, input: {} },
			validator: denying,
		};
		const failure = expectFailure(await executeRoutingWork(input));
		expect(failure.reason.kind).toBe("INVALID_TRANSITION");
		expect(calls.direct()).toBe(1);
	});
});


