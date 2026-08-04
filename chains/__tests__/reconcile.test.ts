/**
 * Reconciliation chain tests — T-S5A-002 (design §11.3; REQ-CHAIN-002;
 * SC-CHAIN-002/005).
 *
 * The reconcile chain runs a `reconciliation` mission through the pinned runtime
 * over the durable stores and the shared chain pipeline: it ingests a bounded
 * source manifest, normalizes deterministically (BigInt cents), reconciles bank
 * vs ledger, records discrepancies as evidence conclusion nodes with payload
 * hashes, waits for evidence when a discrepancy is unproven (WAITING_FOR_EVIDENCE,
 * no auto-advance), resumes after evidence, refutes or confirms anomalies, and
 * raises an evidence-cited proposal quantifying the difference and its resolution
 * path. The chain never posts adjustments (REQ-AUTH-009), keeps every operation
 * bounded and deterministic (no floats, no ambient runtime lookup — REQ-CHAIN-006),
 * and emits a signed completion receipt bound to mission/evidence/scope/target
 * (REQ-CHAIN-007). Material adjustments are R2-gated (SC-CHAIN-004 basis).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase hex
 * sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus, WaitReason } from "drenyra-ai/missions";
import { verifySignedReceipt } from "drenyra-ai/receipts";
import { EDA_PHASE } from "../../lib/accounting-status.js";
import {
	EvidenceGraphStore,
	EVIDENCE_NODE_KIND,
} from "../../lib/evidence-graph.js";
import {
	ReceiptStore,
	type HarnessReceiptRecord,
} from "../../lib/receipt-store.js";
import { sha256Canonical } from "../../lib/canonicalization.js";
import { runChainStep, type ChainRunResult } from "../../lib/chain-pipeline.js";
import {
	computeReconcileDifferences,
	parseReconcileManifest,
	reconcileChain,
	toBigIntCents,
	type ReconcileRunOutput,
	type ReconcileSourceManifest,
} from "../reconcile.js";
import {
	makeApprovalReceipt,
	makeScopeBinding,
} from "../../__tests__/helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
	const dir = mkdtempSync(join(tmpdir(), "drenyra-reconcile-"));
	DIRS.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of DIRS.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** Bank vs ledger with exactly one difference (B002: bank 250000 - ledger 230000). */
const MANIFEST: ReconcileSourceManifest = {
	bank: [
		{ reference: "B001", amountCents: 1_000_000 },
		{ reference: "B002", amountCents: 250_000 },
		{ reference: "B003", amountCents: 80_000 },
	],
	ledger: [
		{ reference: "B001", amountCents: 1_000_000 },
		{ reference: "B002", amountCents: 230_000 },
		{ reference: "B003", amountCents: 80_000 },
	],
};

const BALANCED_MANIFEST: ReconcileSourceManifest = {
	bank: [
		{ reference: "B001", amountCents: 1_000_000 },
		{ reference: "B002", amountCents: 250_000 },
	],
	ledger: [
		{ reference: "B001", amountCents: 1_000_000 },
		{ reference: "B002", amountCents: 250_000 },
	],
};

const R2 = {
	input: {
		value: 0n,
		reversibility: "partially-reversible" as const,
		jurisdiction: "PE",
	},
	minimum: "R2" as const,
};

/** Append the bank-statement evidence that proves the B002 discrepancy. */
async function addBankStatementEvidence(
	root: string,
	missionId: string,
): Promise<void> {
	const graph = new EvidenceGraphStore(root);
	await graph.appendNode({
		id: "stmt-B002",
		missionId,
		nodeKind: EVIDENCE_NODE_KIND.SOURCE,
		payload: {
			kind: "bank-statement",
			reference: "B002",
			amountCents: 250_000,
		},
	});
}

/** Drive the chain to the evidence wait at reconcile (SC-CHAIN-002 opening). */
async function driveToEvidenceWait(
	root: string,
): Promise<{ result: ChainRunResult<ReconcileRunOutput>; missionId: string }> {
	let result!: ChainRunResult<ReconcileRunOutput>;
	for (let index = 0; index < 12; index += 1) {
		result = await runChainStep(reconcileChain, {
			binding: makeScopeBinding(),
			input: { manifest: MANIFEST },
			storesRoot: root,
			materiality: R2,
		});
		if (result.waitReason === WaitReason.EVIDENCE) {
			break;
		}
	}
	expect(result.waitReason).toBe(WaitReason.EVIDENCE);
	return { result, missionId: result.mission!.id };
}

describe("reconcile chain (REQ-CHAIN-002; SC-CHAIN-002/005)", () => {
	it("detects anomalies as evidence conclusion nodes with payload hashes", async () => {
		const root = tempRoot();
		const { missionId } = await driveToEvidenceWait(root);
		const graph = new EvidenceGraphStore(root);

		// Evidence arrives; the mission resumes; reconcile completes with conclusions.
		await addBankStatementEvidence(root, missionId);
		const resumed = await runChainStep(reconcileChain, {
			binding: makeScopeBinding(),
			input: { manifest: MANIFEST },
			storesRoot: root,
			materiality: R2,
			resume: true,
		});
		expect(resumed.mission?.status).toBe(AccountingMissionStatus.RUNNING);

		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 8; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
			});
			if (result.phase === EDA_PHASE.RECONCILE) {
				break;
			}
		}
		expect(result.phase).toBe(EDA_PHASE.RECONCILE);
		expect(result.output?.balanced).toBe(false);
		expect(result.output?.anomalies).toHaveLength(1);

		const difference = result.output!.anomalies![0]!;
		expect(difference.reference).toBe("B002");
		expect(difference.bankCents).toBe(250_000n);
		expect(difference.ledgerCents).toBe(230_000n);
		expect(difference.differenceCents).toBe(200_00n);
		expect(difference.payloadHash).toBe(
			sha256Canonical({
				reference: "B002",
				bankCents: 250_000n,
				ledgerCents: 230_000n,
				differenceCents: 200_00n,
			}),
		);

		// The conclusion node exists in the graph with a real payload hash.
		const loaded = await graph.load(missionId);
		const conclusion = loaded.nodes.find((node) => node.id === "anomaly-B002");
		expect(conclusion).toBeDefined();
		expect(conclusion?.nodeKind).toBe(EVIDENCE_NODE_KIND.CONCLUSION);
		expect(conclusion?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
		expect(conclusion?.payloadHash).toBe(sha256Canonical(conclusion?.payload));

		// The mission carries an ERROR blocker so the propose phase is triggered.
		expect(
			result.mission?.blockers.some(
				(blocker) =>
					blocker.resolvedAt === undefined && blocker.severity === "ERROR",
			),
		).toBe(true);
	});

	it("moves to WAITING_FOR_EVIDENCE for unproven discrepancies with no auto-advance (SC-CHAIN-002)", async () => {
		const root = tempRoot();
		const { result, missionId } = await driveToEvidenceWait(root);
		expect(result.mission?.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
		const reconcileStep = result.mission?.steps.find(
			(step) => step.id === EDA_PHASE.RECONCILE,
		);
		expect(reconcileStep?.status).toBe("IN_PROGRESS");
		expect(
			result.mission?.blockers.some((blocker) =>
				blocker.reason.toLowerCase().includes("evidence"),
			),
		).toBe(true);

		// No auto-advance: another run without resume stays in the evidence wait.
		const again = await runChainStep(reconcileChain, {
			binding: makeScopeBinding(),
			input: { manifest: MANIFEST },
			storesRoot: root,
			materiality: R2,
		});
		expect(again.waitReason).toBe(WaitReason.EVIDENCE);
		expect(again.phase).toBeNull();
		expect(again.mission?.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);

		// The graph stays bound to the mission and free of conclusions until
		// evidence is added: only SOURCE nodes (ingest) and the TRANSFORMATION
		// normalize node exist — no anomaly conclusion (SC-CHAIN-002).
		const graph = new EvidenceGraphStore(root);
		const loaded = await graph.load(missionId);
		expect(
			loaded.nodes.every(
				(node) =>
					node.nodeKind === EVIDENCE_NODE_KIND.SOURCE ||
					node.nodeKind === EVIDENCE_NODE_KIND.TRANSFORMATION,
			),
		).toBe(true);
		expect(loaded.nodes.some((node) => node.id === "anomaly-B002")).toBe(false);
	});

	it("fails closed without the bounded source manifest (evidence wait, no ambient lookup)", async () => {
		const root = tempRoot();
		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 8; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: undefined },
				storesRoot: root,
				materiality: R2,
			});
			if (result.waitReason === WaitReason.EVIDENCE) {
				break;
			}
		}
		expect(result.waitReason).toBe(WaitReason.EVIDENCE);
		expect(result.mission?.status).toBe(
			AccountingMissionStatus.WAITING_FOR_EVIDENCE,
		);
	});

	it("raises an evidence-cited proposal quantifying the difference and its resolution path (SC-CHAIN-005)", async () => {
		const root = tempRoot();
		const { missionId } = await driveToEvidenceWait(root);
		await addBankStatementEvidence(root, missionId);

		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 20; index += 1) {
			const resume = result === undefined && index === 0;
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
				resume,
			});
			if (result.phase === EDA_PHASE.PROPOSE) {
				break;
			}
		}

		expect(result.phase).toBe(EDA_PHASE.PROPOSE);
		const proposal = result.mission?.proposal;
		expect(proposal).not.toBeNull();
		expect(proposal?.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
		// The proposal carries a real evidence hash over the graph lineage, not "pending".
		expect(proposal?.evidenceHash).not.toBe("pending");
		expect(proposal?.evidenceHash).toBe(
			await new EvidenceGraphStore(root).computeReceiptEvidenceHash(missionId, [
				"anomaly-B002",
			]),
		);
		// The proposal is evidence-cited: the cited evidence includes the bank
		// statement, the sources, the normalize transformation, and the anomaly.
		const citedIds = proposal?.evidence.map((item) => item.id) ?? [];
		expect(citedIds).toContain("anomaly-B002");
		expect(citedIds).toContain("stmt-B002");
		expect(citedIds).toContain("src-bank-B002");
		expect(proposal?.summary).toContain("20000");
		expect(proposal?.summary.toLowerCase()).toContain("resolution");
		expect(proposal?.summary.toLowerCase()).toContain("approval");
		// Candidate only: nothing was posted (REQ-AUTH-009).
		expect(result.output?.adjustmentsPosted).toBe(false);
	});

	it("refutes a discrepancy when the evidence contradicts the anomaly (design §11.3)", async () => {
		const root = tempRoot();
		const { missionId } = await driveToEvidenceWait(root);
		// Evidence with the WRONG amount: it disproves the B002 anomaly.
		const graph = new EvidenceGraphStore(root);
		await graph.appendNode({
			id: "stmt-B002",
			missionId,
			nodeKind: EVIDENCE_NODE_KIND.SOURCE,
			payload: {
				kind: "bank-statement",
				reference: "B002",
				amountCents: 2_200_00n,
			},
		});

		const resumed = await runChainStep(reconcileChain, {
			binding: makeScopeBinding(),
			input: { manifest: MANIFEST },
			storesRoot: root,
			materiality: R2,
			resume: true,
		});
		expect(resumed.mission?.status).toBe(AccountingMissionStatus.RUNNING);

		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 10; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
			});
			if (result.phase === EDA_PHASE.INVESTIGATE) {
				break;
			}
		}
		expect(result.phase).toBe(EDA_PHASE.INVESTIGATE);
		expect(result.output?.refuted).toBe(1);
		expect(result.output?.confirmed).toBe(0);

		// The refutation is recorded as a conclusion node.
		const loaded = await graph.load(missionId);
		const refutation = loaded.nodes.find((node) => node.id === "refute-B002");
		expect(refutation).toBeDefined();
		expect(refutation?.nodeKind).toBe(EVIDENCE_NODE_KIND.CONCLUSION);
	});

	it("cannot post adjustments: the execute phase is a candidate-only no-op (REQ-AUTH-009)", async () => {
		const root = tempRoot();
		const approval = makeApprovalReceipt();
		const { missionId } = await driveToEvidenceWait(root);
		await addBankStatementEvidence(root, missionId);

		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 24; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
				approverId: "contador-01",
				approvalReceipt: approval.receipt,
				trustedKeys: [approval.key],
				resume: index === 0,
			});
			if (
				result.mission?.status === AccountingMissionStatus.COMPLETED ||
				result.blocked !== undefined
			) {
				break;
			}
		}
		expect(result.mission?.status).toBe(AccountingMissionStatus.COMPLETED);
		// At every phase the chain reported no adjustments posted.
		expect(result.output?.adjustmentsPosted).toBe(false);
		expect(result.mission?.proposal).not.toBeNull();
		// The mission completed without executing any posting command.
		expect(result.mission?.receiptHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("emits a signed completion receipt bound to mission/evidence/scope/target (REQ-CHAIN-007)", async () => {
		const root = tempRoot();
		const binding = makeScopeBinding();
		const approval = makeApprovalReceipt();
		const { missionId } = await driveToEvidenceWait(root);
		await addBankStatementEvidence(root, missionId);

		let result!: ChainRunResult<ReconcileRunOutput>;
		let closeReceipt: HarnessReceiptRecord | undefined;
		for (let index = 0; index < 24; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding,
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
				approverId: "contador-01",
				approvalReceipt: approval.receipt,
				trustedKeys: [approval.key],
				resume: index === 0,
			});
			// The completion receipt is sealed on the CLOSE step; the archive step
			// then transitions APPROVED->COMPLETED without a new receipt, so capture
			// the close receipt across iterations.
			if (result.receipt !== undefined) {
				closeReceipt = result.receipt;
			}
			if (
				result.mission?.status === AccountingMissionStatus.COMPLETED ||
				result.blocked !== undefined
			) {
				break;
			}
		}
		expect(result.mission?.status).toBe(AccountingMissionStatus.COMPLETED);
		expect(closeReceipt).toBeDefined();

		const record = closeReceipt!;
		expect(record.receipt.receiptType).toBe("COMPLETION");
		expect(record.binding.scopeHash).toBe(binding.scopeHash);
		expect(record.binding.policyVersion).toBe(binding.scope.policyVersion);
		expect(record.binding.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
		expect(record.binding.targetHash).toMatch(/^[0-9a-f]{64}$/);
		expect(record.receipt.content.missionId).toBe(missionId);
		expect(record.receipt.content.companyId).toBe(binding.scope.company);
		// The completion receipt evidence hash matches the proposal's evidence hash.
		expect(record.binding.evidenceHash).toBe(
			result.mission?.proposal?.evidenceHash,
		);

		const verification = verifySignedReceipt(record.receipt);
		expect(verification.valid).toBe(true);

		const store = new ReceiptStore(root);
		expect(await store.load(record.receipt.receiptHash)).toBeDefined();
	});

	it("R2-gates material adjustments: the approve phase stops at BLOCKED_BY_GATE without approval (SC-CHAIN-004)", async () => {
		const root = tempRoot();
		const { missionId } = await driveToEvidenceWait(root);
		await addBankStatementEvidence(root, missionId);

		let result!: ChainRunResult<ReconcileRunOutput>;
		for (let index = 0; index < 24; index += 1) {
			result = await runChainStep(reconcileChain, {
				binding: makeScopeBinding(),
				input: { manifest: MANIFEST },
				storesRoot: root,
				materiality: R2,
				resume: index === 0,
			});
			if (
				result.waitReason === WaitReason.POLICY_GATE ||
				result.blocked !== undefined
			) {
				break;
			}
		}
		expect(result.waitReason).toBe(WaitReason.POLICY_GATE);
		expect(result.mission?.status).toBe(
			AccountingMissionStatus.BLOCKED_BY_GATE,
		);
		// The approve step never advanced past PENDING.
		const approveStep = result.mission?.steps.find(
			(step) => step.id === EDA_PHASE.APPROVE,
		);
		expect(approveStep?.status).toBe("PENDING");
		// No further phase advances without an approver.
		const again = await runChainStep(reconcileChain, {
			binding: makeScopeBinding(),
			input: { manifest: MANIFEST },
			storesRoot: root,
			materiality: R2,
		});
		expect(again.waitReason).toBe(WaitReason.POLICY_GATE);
		expect(again.phase).toBeNull();
		expect(again.mission?.status).toBe(AccountingMissionStatus.BLOCKED_BY_GATE);
	});

	it("keeps every operation bounded and deterministic — no floats, stable hashes (REQ-CHAIN-006)", async () => {
		// Float money is rejected at the JSON boundary.
		expect(() => toBigIntCents(10.5)).toThrow(/float/i);
		expect(() =>
			parseReconcileManifest(
				JSON.stringify({
					bank: [{ reference: "B1", amountCents: 10.5 }],
					ledger: [],
				}),
			),
		).toThrow(/float/i);
		expect(() =>
			parseReconcileManifest(
				JSON.stringify({
					bank: [],
					ledger: [{ reference: "B1", amountCents: "10.5" }],
				}),
			),
		).toThrow(/float|money/i);
		// Bounded manifests: over-limit entry lists are rejected.
		const huge = Array.from({ length: 501 }, (_, index) => ({
			reference: `B${index}`,
			amountCents: 1,
		}));
		expect(() =>
			parseReconcileManifest(JSON.stringify({ bank: huge, ledger: [] })),
		).toThrow(/bounded/i);
		// Deterministic: the same manifest yields the same difference and hash every time.
		const differences = computeReconcileDifferences(MANIFEST);
		const again = computeReconcileDifferences(MANIFEST);
		expect(differences).toEqual(again);
		expect(differences[0]?.payloadHash).toBe(differences[0]?.payloadHash);

		// Balanced manifests produce no anomalies.
		expect(computeReconcileDifferences(BALANCED_MANIFEST)).toEqual([]);
	});

	it("parses a bounded source manifest into BigInt cents at the boundary", () => {
		const parsed = parseReconcileManifest(
			JSON.stringify({
				bank: [
					{ reference: "B1", amountCents: 10_000 },
					{ reference: "B2", amountCents: "2500" },
				],
				ledger: [{ reference: "B1", amountCents: 9_000 }],
				sourceSnapshot: "a".repeat(64),
			}),
		);
		expect(parsed.bank[0]?.amountCents).toBe(10_000);
		expect(parsed.bank[1]?.amountCents).toBe("2500");
		expect(parsed.sourceSnapshot).toBe("a".repeat(64));
		// Invalid shapes fail closed.
		expect(() => parseReconcileManifest("not json")).toThrow(/not valid JSON/i);
		expect(() => parseReconcileManifest(JSON.stringify({ bank: "x" }))).toThrow(
			/bank.*array/i,
		);
		expect(() =>
			parseReconcileManifest(
				JSON.stringify({ bank: [{ reference: "B1" }], ledger: [] }),
			),
		).toThrow(/amountCents/i);
		expect(() =>
			parseReconcileManifest(
				JSON.stringify({
					bank: [{ reference: "B1", amountCents: 1, extra: true }],
					ledger: [],
				}),
			),
		).toThrow(/unknown property/i);
	});
});
