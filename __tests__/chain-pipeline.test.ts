/**
 * Shared chain pipeline tests — T-S5A-001 (design §11.1, §4.4, §15).
 *
 * `runChainStep` implements the shared chain structure every chain follows:
 * scope validation → mission load/start → one phase operation → applicable
 * authority gates → receipt persistence (REQ-CHAIN-005), failing closed at the
 * first failing stage (SC-CHAIN-003 basis). Exactly one legal EDA step runs per
 * call — no unbounded loops, no continue-all (REQ-CHAIN-006; REQ-MISS-004).
 * A changed scope hash invalidates a running mission before any write
 * (design §15; REQ-SCOPE-006), and a completed run persists a signed completion
 * receipt bound to mission, evidence hash, scope hash, and executed target
 * (REQ-CHAIN-007).
 *
 * `executePreparedStep` enforces optimistic versioning and the idempotency key
 * derived from mission id + phase + mission version + scope hash + target hash
 * (design §4.4): the engine replays a cached result for an idempotent key
 * (REQ-MISS-008) and rejects a stale expected version with VERSION_CONFLICT.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	AccountingMissionStatus,
	WaitReason,
	type MissionSnapshot,
} from "drenyra-ai/missions";
import { verifySignedReceipt } from "drenyra-ai/receipts";
import type { MaterialityInput } from "drenyra-ai/candidates";
import { AUTHORITY_MODE } from "../runtime/context.js";
import {
	EDA_PHASE,
	EDA_PHASE_ORDER,
	derivePreparedStep,
	type PreparedStep,
} from "../lib/accounting-status.js";
import { EVIDENCE_NODE_KIND } from "../lib/evidence-graph.js";
import { AuthorityStore } from "../lib/authority-store.js";
import { ReceiptStore } from "../lib/receipt-store.js";
import type { ScopeBinding } from "../lib/canonicalization.js";
import {
	makeApprovalReceipt,
	makeScopeBinding,
} from "./helpers/authority-fixtures.js";
import {
	executePreparedStep,
	runChainStep,
	ScopeStaleError,
	startChainMission,
	type ChainDefinition,
	type ChainRunResult,
} from "../lib/chain-pipeline.js";

const DIRS: string[] = [];

function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-chain-pipeline-"));
	DIRS.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of DIRS.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** R2-level materiality input (partially-reversible), floored to R2. */
const R2_MATERIALITY: MaterialityInput = {
	value: 10_000_00n,
	reversibility: "partially-reversible",
	jurisdiction: "PE",
};

interface AnalysisInput {
	evidenceProvided: boolean;
}

interface AnalysisOutput {
	analyzed: boolean;
	differences: number;
}

/**
 * A minimal fixture chain exercising the pipeline: ingest records a source node,
 * reconcile either waits for evidence or records an anomaly conclusion, propose
 * produces a candidate proposal, and close warrants a signed completion receipt.
 */
const analysisChain: ChainDefinition<AnalysisInput, AnalysisOutput> = {
	name: "analysis",
	intent: "reconciliation",
	requiredMode: AUTHORITY_MODE.ANALYZE,
	async runStep(context) {
		switch (context.phase) {
			case EDA_PHASE.INGEST:
				await context.graph.appendNode({
					id: "src-ledger",
					missionId: context.mission.id,
					nodeKind: EVIDENCE_NODE_KIND.SOURCE,
					payload: { kind: "ledger", balanceCents: 1_000n },
				});
				return {
					output: { analyzed: false, differences: 0 },
					evidenceNodeIds: ["src-ledger"],
				};
			case EDA_PHASE.RECONCILE:
				if (!context.input.evidenceProvided) {
					return {
						output: { analyzed: false, differences: 1 },
						waitForEvidence: true,
					};
				}
				await context.graph.appendNode({
					id: "concl-anomaly",
					missionId: context.mission.id,
					nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
					payload: {
						kind: "discrepancy",
						reference: "REFA",
						differenceCents: 500n,
					},
				});
				return {
					output: { analyzed: true, differences: 1 },
					evidenceNodeIds: ["concl-anomaly"],
					blocker: { reason: "one unresolved difference", severity: "ERROR" },
				};
			case EDA_PHASE.PROPOSE:
				return {
					output: { analyzed: true, differences: 1 },
					proposal: { summary: "analysis result", riskLevel: "MEDIUM" },
				};
			case EDA_PHASE.CLOSE:
				return {
					output: { analyzed: true, differences: 0 },
					receiptWarranted: true,
				};
			default:
				return { output: { analyzed: false, differences: 0 } };
		}
	},
};

/** The full R2 approval ceremony: approver + trusted approval receipt. */
const approval = makeApprovalReceipt();

function fullFlowInput(evidenceProvided: boolean, root: string) {
	return {
		binding: makeScopeBinding(),
		input: { evidenceProvided },
		storesRoot: root,
		materiality: { input: R2_MATERIALITY, minimum: "R2" as const },
		approverId: "contador-01",
		approvalReceipt: approval.receipt,
		trustedKeys: [approval.key],
	};
}

/** Drive the fixture chain one bounded phase per call until done/blocked. */
async function driveToCompletion(
	root: string,
	options: {
		evidenceProvided?: boolean;
		binding?: ReturnType<typeof makeScopeBinding>;
		maxSteps?: number;
	} = {},
): Promise<ChainRunResult<AnalysisOutput>> {
	const {
		evidenceProvided = true,
		binding = makeScopeBinding(),
		maxSteps = 24,
	} = options;
	let result: ChainRunResult<AnalysisOutput> | undefined;
	let lastReceipt: ChainRunResult<AnalysisOutput>["receipt"];
	for (let index = 0; index < maxSteps; index += 1) {
		result = await runChainStep(analysisChain, {
			...fullFlowInput(evidenceProvided, root),
			binding,
		});
		if (result.receipt !== undefined) {
			lastReceipt = result.receipt;
		}
		if (
			result.mission?.status === AccountingMissionStatus.COMPLETED ||
			result.blocked !== undefined ||
			result.waitReason !== undefined
		) {
			break;
		}
	}
	return { ...result!, receipt: lastReceipt };
}

describe("runChainStep — shared chain pipeline (REQ-CHAIN-005/006/007)", () => {
	it("fails closed at the scope stage before any mission write (REQ-CHAIN-005)", async () => {
		const root = tempRoot();
		// A binding whose scope is incomplete cannot even bind: fail closed at stage 1.
		const invalidBinding: ScopeBinding = {
			version: "drenyra.scope.v1",
			scope: {
				tenant: "",
				organization: "acme-accounting",
				company: "20123456786",
				fiscalPeriod: "202507",
				ledgerBook: "general-ledger",
				operationType: "monthly-close",
				sourceSnapshot: "a".repeat(64),
				policyVersion: "policies.v1",
				actor: "alice",
				authorityLevel: "EXECUTE",
			},
			canonical: "{}",
			scopeHash: "b".repeat(64),
		};
		const result = await runChainStep(analysisChain, {
			binding: invalidBinding,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		expect(result.blocked?.stage).toBe("scope");
		expect(result.blocked?.reason).toMatch(/incomplete|invalid|non-empty/i);
		expect(result.mission).toBeUndefined();
		expect(existsSync(join(root, ".local", "missions"))).toBe(false);
	});

	it("fails closed at the required-mode stage before any mission write (first failing stage stops)", async () => {
		const root = tempRoot();
		const highChain: ChainDefinition<AnalysisInput, AnalysisOutput> = {
			...analysisChain,
			requiredMode: AUTHORITY_MODE.EXECUTE,
		};
		const result = await runChainStep(highChain, {
			binding: makeScopeBinding({ authorityLevel: AUTHORITY_MODE.ANALYZE }),
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		expect(result.blocked?.stage).toBe("mode");
		expect(result.blocked?.reason).toMatch(/requires at least EXECUTE/i);
		expect(existsSync(join(root, ".local", "missions"))).toBe(false);
	});

	it("starts a mission and advances exactly one EDA phase per call (REQ-MISS-004; REQ-CHAIN-006)", async () => {
		const root = tempRoot();
		const phases: string[] = [];
		let result: ChainRunResult<AnalysisOutput> | undefined;
		for (let index = 0; index < 24; index += 1) {
			result = await runChainStep(analysisChain, fullFlowInput(true, root));
			expect(result.phase === null || result.phase !== undefined).toBe(true);
			if (result.phase !== null) {
				phases.push(result.phase);
			}
			if (
				result.mission?.status === AccountingMissionStatus.COMPLETED ||
				result.blocked !== undefined
			) {
				break;
			}
		}
		// The full canonical sequence, one phase per call, ending at archive.
		expect(phases).toEqual(EDA_PHASE_ORDER);
		expect(result!.mission?.status).toBe(AccountingMissionStatus.COMPLETED);
		expect(
			result!.mission?.steps.every((step) => step.status === "COMPLETED"),
		).toBe(true);
	});

	it("reuses the active mission across calls (mission load/start)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const first = await runChainStep(analysisChain, {
			binding,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		const second = await runChainStep(analysisChain, {
			binding,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		expect(second.mission?.id).toBe(first.mission?.id);
		expect(second.mission?.version).toBeGreaterThan(
			first.mission?.version ?? 0,
		);
		// Only one snapshot file exists: the second call loaded, not restarted.
		const snapshotsDir = join(root, ".local", "missions", "snapshots");
		expect(
			readdirSync(snapshotsDir).filter((name) => name.endsWith(".json")),
		).toHaveLength(1);
	});

	it("invalidates a running mission when the scope hash changed before any write (design §15)", async () => {
		const root = tempRoot();
		const bindingA = makeScopeBinding();
		const first = await runChainStep(analysisChain, {
			binding: bindingA,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		const versionAfterFirst = first.mission?.version ?? 0;
		const missionId = first.mission!.id;

		// Same company/period, different actor -> different scope hash.
		const bindingB = makeScopeBinding({ actor: "bob" });
		const second = await runChainStep(analysisChain, {
			binding: bindingB,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		expect(second.blocked?.stage).toBe("scope");
		expect(second.blocked?.reason).toMatch(/different scope/i);
		expect(second.mission?.id).toBe(missionId);
		expect(second.mission?.version).toBe(versionAfterFirst);
		// No authorization was appended for scope B (the mission is bound to scope A).
		const store = new AuthorityStore(root);
		const records = await store.listAuthorizations(missionId);
		expect(
			records.every((record) => record.scopeHash === bindingA.scopeHash),
		).toBe(true);
	});

	it("denies a phase whose action family exceeds the bound mode before any write (REQ-AUTH-002)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding({
			authorityLevel: AUTHORITY_MODE.ANALYZE,
		});
		let result: ChainRunResult<AnalysisOutput> | undefined;
		for (let index = 0; index < 16; index += 1) {
			result = await runChainStep(analysisChain, {
				binding,
				input: { evidenceProvided: true },
				storesRoot: root,
			});
			if (result.blocked !== undefined) {
				break;
			}
		}
		// ANALYZE can detect, but the propose phase is PREPARE_CANDIDATE.
		expect(result!.blocked?.stage).toBe("mode");
		expect(result!.blocked?.reason).toMatch(/PREPARE_CANDIDATE|monotonic/i);
		const versionAtBlock = result!.mission?.version ?? 0;
		// No write happened at the blocked phase and nothing advances on retry.
		const again = await runChainStep(analysisChain, {
			binding,
			input: { evidenceProvided: true },
			storesRoot: root,
		});
		expect(again.blocked?.stage).toBe("mode");
		expect(again.mission?.version).toBe(versionAtBlock);
	});

	it("enters the engine evidence wait when the chain declares missing evidence (REQ-MISS-009)", async () => {
		const root = tempRoot();
		let result: ChainRunResult<AnalysisOutput> | undefined;
		for (let index = 0; index < 12; index += 1) {
			result = await runChainStep(analysisChain, {
				binding: makeScopeBinding(),
				input: { evidenceProvided: false },
				storesRoot: root,
			});
			if (result.waitReason === WaitReason.EVIDENCE) {
				break;
			}
		}
		expect(result!.waitReason).toBe(WaitReason.EVIDENCE);
		expect(result!.mission?.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
		expect(result!.phase).toBeNull();
		// No auto-advance: a further continuation stays in the wait, phase unchanged.
		const again = await runChainStep(analysisChain, {
			binding: makeScopeBinding(),
			input: { evidenceProvided: false },
			storesRoot: root,
		});
		expect(again.waitReason).toBe(WaitReason.EVIDENCE);
		expect(again.phase).toBeNull();
		expect(again.mission?.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
	});

	it("resumes from WAITING_FOR_EVIDENCE only when resume is requested (SC-CHAIN-002)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		let result: ChainRunResult<AnalysisOutput> | undefined;
		for (let index = 0; index < 12; index += 1) {
			result = await runChainStep(analysisChain, {
				binding,
				input: { evidenceProvided: false },
				storesRoot: root,
			});
			if (result.waitReason === WaitReason.EVIDENCE) {
				break;
			}
		}
		expect(result!.waitReason).toBe(WaitReason.EVIDENCE);

		// Without resume: still waiting.
		const stayed = await runChainStep(analysisChain, {
			binding,
			input: { evidenceProvided: false },
			storesRoot: root,
		});
		expect(stayed.waitReason).toBe(WaitReason.EVIDENCE);

		// With resume: WAITING_FOR_EVIDENCE -> RUNNING is an engine-legal transition.
		const resumed = await runChainStep(analysisChain, {
			binding,
			input: { evidenceProvided: true },
			storesRoot: root,
			resume: true,
		});
		expect(resumed.mission?.status).toBe(AccountingMissionStatus.RUNNING);
		expect(resumed.waitReason).toBeUndefined();
		expect(resumed.phase).toBeNull();
	});

	it("persists a signed completion receipt bound to mission/evidence/scope/target (REQ-CHAIN-007)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const result = await driveToCompletion(root, { binding });
		expect(result.mission?.status).toBe(AccountingMissionStatus.COMPLETED);
		expect(result.receipt).toBeDefined();

		const record = result.receipt!;
		expect(record.receipt.receiptType).toBe("COMPLETION");
		expect(record.binding.scopeHash).toBe(binding.scopeHash);
		expect(record.binding.policyVersion).toBe(binding.scope.policyVersion);
		expect(record.binding.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
		expect(record.binding.targetHash).toMatch(/^[0-9a-f]{64}$/);
		expect(record.receipt.content.missionId).toBe(result.mission!.id);
		expect(record.receipt.content.companyId).toBe(binding.scope.company);
		expect(record.receipt.content.evidenceHash).toBe(
			record.binding.evidenceHash,
		);
		expect(record.receipt.content.payloadHash).toBe(
			// The binding digest is signed through the engine payloadHash (design §3.3).
			(await import("../lib/canonicalization.js")).sha256Canonical(
				record.binding,
			),
		);

		const verification = verifySignedReceipt(record.receipt);
		expect(verification.valid).toBe(true);

		// The receipt is persisted in the immutable receipt store.
		const store = new ReceiptStore(root);
		expect(await store.load(record.receipt.receiptHash)).toBeDefined();
		// The mission snapshot carries the receipt identity.
		expect(result.mission?.receiptId).toBe(record.receipt.receiptHash);
		expect(result.mission?.receiptHash).toBe(record.receipt.receiptHash);
	});

	it("stops at the first non-allowed authority stage (REQ-AUTH-008) without a receipt", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding({
			authorityLevel: AUTHORITY_MODE.ANALYZE,
		});
		const result = await driveToCompletion(root, { binding });
		expect(result.blocked).toBeDefined();
		expect(result.receipt).toBeUndefined();
		// The gates reported the blocking stage.
		expect(result.gates.length).toBeGreaterThan(0);
		expect(
			result.gates.some(
				(gate) =>
					gate.stage === result.blocked!.stage && gate.verdict !== "allowed",
			),
		).toBe(true);
	});
});

describe("executePreparedStep — optimistic versioning, idempotency, stale scope", () => {
	it("invalidates the prepared step on a stale scope hash before any write (design §15)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const { stores, mission } = await startChainMission(
			analysisChain,
			binding,
			{
				storesRoot: root,
			},
		);
		const prepared = derivePreparedStep(mission, binding.scopeHash)!;
		expect(prepared.phase).toBe(EDA_PHASE.INTAKE);

		const stalePrepared: PreparedStep = {
			...prepared,
			scopeHash: "a".repeat(64),
		};
		await expect(
			executePreparedStep({
				binding,
				stores,
				mission,
				prepared: stalePrepared,
				targetHash: "b".repeat(64),
			}),
		).rejects.toBeInstanceOf(ScopeStaleError);

		// Nothing was written: the mission is untouched at its start version.
		const reloaded = await stores.store.findById(mission.id);
		expect(reloaded?.version).toBe(mission.version);
		const events = await stores.events.list(mission.id);
		expect(events.length).toBeGreaterThan(0);
		const phasesAfter =
			reloaded?.steps.filter((step) => step.status !== "PENDING") ?? [];
		expect(phasesAfter).toHaveLength(0);
	});

	it("rejects a stale expected mission version with VERSION_CONFLICT (optimistic versioning)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const { stores, mission } = await startChainMission(
			analysisChain,
			binding,
			{
				storesRoot: root,
			},
		);
		const prepared = derivePreparedStep(mission, binding.scopeHash)!;
		const targetHash = "c".repeat(64);
		await executePreparedStep({
			binding,
			stores,
			mission,
			prepared,
			targetHash,
		});
		// Same prepared step but a different target hash -> different idempotency key
		// -> the engine's optimistic version check rejects the stale version.
		await expect(
			executePreparedStep({
				binding,
				stores,
				mission,
				prepared,
				targetHash: "d".repeat(64),
			}),
		).rejects.toThrow(/VERSION_CONFLICT/i);
	});

	it("replays the cached engine result for an idempotent key (REQ-MISS-008)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const { stores, mission } = await startChainMission(
			analysisChain,
			binding,
			{
				storesRoot: root,
			},
		);
		const prepared = derivePreparedStep(mission, binding.scopeHash)!;
		const targetHash = "e".repeat(64);

		const first = await executePreparedStep({
			binding,
			stores,
			mission,
			prepared,
			targetHash,
		});
		expect(first.replayed).toBe(false);
		expect(first.phase).toBe(EDA_PHASE.INTAKE);
		expect(first.mission.status).toBe(AccountingMissionStatus.QUEUED);
		const firstVersion = first.mission.version;

		// The same prepared step + target hash -> the same idempotency key: the
		// cached result is replayed without re-executing (REQ-MISS-008).
		const replay = await executePreparedStep({
			binding,
			stores,
			mission,
			prepared,
			targetHash,
		});
		expect(replay.replayed).toBe(true);
		expect(replay.mission.id).toBe(first.mission.id);
		expect(replay.mission.version).toBe(firstVersion);
		expect(replay.mission.status).toBe(AccountingMissionStatus.QUEUED);
	});

	it("completes at most one step per call with a deterministic idempotency key", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const { stores, mission } = await startChainMission(
			analysisChain,
			binding,
			{
				storesRoot: root,
			},
		);
		const prepared = derivePreparedStep(mission, binding.scopeHash)!;
		const targetHash = "f".repeat(64);
		const first = await executePreparedStep({
			binding,
			stores,
			mission,
			prepared,
			targetHash,
		});
		const second = await executePreparedStep({
			binding,
			stores,
			mission: first.mission,
			prepared: derivePreparedStep(first.mission, binding.scopeHash)!,
			targetHash,
		});
		expect(first.phase).toBe(EDA_PHASE.INTAKE);
		expect(second.phase).toBe(EDA_PHASE.BIND_SCOPE);
		expect(second.mission.version).toBeGreaterThan(first.mission.version);
		// The phase-only updates never fabricated an engine state transition.
		expect(first.mission.status).toBe(AccountingMissionStatus.QUEUED);
		expect(second.mission.status).toBe(AccountingMissionStatus.RUNNING);
	});
});

/** Type-level sanity: mission survives a wait result for later continuation. */
void (null as unknown as MissionSnapshot);
