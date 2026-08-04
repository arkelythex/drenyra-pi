/**
 * Reconciliation chain — the EDA `reconciliation` intent chain (design §11.3;
 * REQ-CHAIN-002; SC-CHAIN-002/005).
 *
 * The chain ingests a bounded source manifest (bank movements + ledger entries),
 * normalizes deterministically into BigInt cents (no floats, no ambient runtime
 * lookup — REQ-CHAIN-006), reconciles bank vs ledger, records each discrepancy
 * as an evidence conclusion node with a canonical payload hash, waits for
 * evidence when a discrepancy is unproven (WAITING_FOR_EVIDENCE, no
 * auto-advance — REQ-MISS-009), resumes after evidence, refutes or confirms the
 * anomalies (design §11.3 anomaly refutation), and raises an evidence-cited
 * candidate proposal quantifying the difference and its resolution path. The
 * chain NEVER posts adjustments (REQ-AUTH-009): the execute phase is a
 * candidate-only no-op and the close phase seals a signed completion receipt
 * bound to mission, evidence hash, scope hash, and executed target
 * (REQ-CHAIN-007). Material adjustments are R2-gated (explicit materiality with
 * an R2 floor).
 *
 * The chain runs through the shared `runChainStep` pipeline; `runStep` is the
 * bounded per-phase domain computation and records all evidence nodes/edges on
 * the append-only evidence graph.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or integer decimal strings at JSON boundaries — never floats);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { AUTHORITY_MODE } from "../runtime/context.js";
import { EDA_PHASE, type EdaPhase } from "../lib/accounting-status.js";
import type { ExplicitMaterialityRequest } from "../lib/authority-gates.js";
import { sha256Canonical } from "../lib/canonicalization.js";
import {
	EVIDENCE_NODE_KIND,
	EVIDENCE_RELATION,
	type EvidenceGraphStore,
} from "../lib/evidence-graph.js";
import type {
	ChainDefinition,
	ChainStepContext,
	ChainStepOutcome,
} from "../lib/chain-pipeline.js";

/** One manifest entry: a reference plus money at the JSON boundary. */
export interface ReconcileManifestEntry {
	reference: string;
	/** Money as JSON integer cents or an integer decimal string — never a float. */
	amountCents: number | string;
}

/** The bounded source manifest the chain ingests (no ambient lookup). */
export interface ReconcileSourceManifest {
	bank: readonly ReconcileManifestEntry[];
	ledger: readonly ReconcileManifestEntry[];
	/** Optional digest of the frozen source snapshot (lowercase hex sha-256). */
	sourceSnapshot?: string;
}

/** Chain input: the bounded manifest for this run. */
export interface ReconcileChainInput {
	manifest?: ReconcileSourceManifest;
}

/** One detected bank-vs-ledger discrepancy. */
export interface ReconcileDifference {
	reference: string;
	bankCents: bigint;
	ledgerCents: bigint;
	differenceCents: bigint;
	/** Lowercase hex sha-256 over the canonical difference payload. */
	payloadHash: string;
}

/** The chain's deterministic outcome for one phase. */
export interface ReconcileRunOutput {
	phase: EdaPhase;
	ingested?: boolean;
	balanced?: boolean;
	anomalies?: readonly ReconcileDifference[];
	awaitingEvidence?: boolean;
	confirmed?: number;
	refuted?: number;
	proposal?: { discrepancies: number; totalDifferenceCents: bigint };
	/** Always false: the chain never posts adjustments (REQ-AUTH-009). */
	adjustmentsPosted: boolean;
	closed?: boolean;
}

/** Bounded manifest size (REQ-CHAIN-006: bounded operations). */
const MAX_MANIFEST_ENTRIES = 500;

/** Safe evidence record ids (letters, digits, dot, underscore, colon, slash, dash). */
const REFERENCE_RE = /^[A-Za-z0-9._:/-]{1,256}$/;

/** Integer decimal money at the boundary (JSON integer or decimal string). */
const INTEGER_RE = /^-?\d+$/;

const SOURCE_SNAPSHOT_RE = /^[0-9a-f]{64}$/;

/**
 * Convert money at the JSON boundary to BigInt cents deterministically. Floats
 * are rejected (REQ-CONTRACTS-008; REQ-CHAIN-006); JSON integers and integer
 * decimal strings are the only accepted forms.
 */
export function toBigIntCents(value: number | string): bigint {
	if (typeof value === "number") {
		if (!Number.isInteger(value)) {
			throw new Error(
				`reconcile: float money rejected at the manifest boundary (${value}) — use integer cents or an integer decimal string`,
			);
		}
		return BigInt(value);
	}
	if (typeof value === "bigint") {
		throw new Error(
			"reconcile: money at the JSON boundary must be integer cents or an integer decimal string — bigint is not a JSON type; convert with BigInt() after parsing",
		);
	}
	if (typeof value !== "string" || !INTEGER_RE.test(value)) {
		throw new Error(
			`reconcile: money must be integer cents or an integer decimal string (got ${String(value)})`,
		);
	}
	return BigInt(value);
}

/** Validate one entry list; returns the entries with unknown props rejected. */
function parseEntryList(
	value: unknown,
	label: string,
): ReconcileManifestEntry[] {
	if (!Array.isArray(value)) {
		throw new Error(`reconcile: manifest.${label} must be an array of entries`);
	}
	if (value.length > MAX_MANIFEST_ENTRIES) {
		throw new Error(
			`reconcile: manifest.${label} exceeds the bounded limit of ${MAX_MANIFEST_ENTRIES} entries`,
		);
	}
	return value.map((entry, index) => {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
			throw new Error(
				`reconcile: manifest.${label}[${index}] must be an object with reference and amountCents`,
			);
		}
		const record = entry as Record<string, unknown>;
		for (const key of Object.keys(record)) {
			if (key !== "reference" && key !== "amountCents") {
				throw new Error(
					`reconcile: manifest.${label}[${index}] unknown property "${key}" is rejected`,
				);
			}
		}
		const { reference, amountCents } = record;
		if (typeof reference !== "string" || !REFERENCE_RE.test(reference)) {
			throw new Error(
				`reconcile: manifest.${label}[${index}] reference must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'`,
			);
		}
		if (typeof amountCents !== "number" && typeof amountCents !== "string") {
			throw new Error(
				`reconcile: manifest.${label}[${index}].amountCents must be integer cents or an integer decimal string`,
			);
		}
		toBigIntCents(amountCents);
		return { reference, amountCents };
	});
}

/**
 * Parse and validate a bounded source manifest from JSON (the command boundary).
 * Floats, unknown properties, malformed references, invalid source digests, and
 * over-limit entry lists all fail closed.
 */
export function parseReconcileManifest(json: string): ReconcileSourceManifest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json) as unknown;
	} catch (error) {
		throw new Error(
			`reconcile: the source manifest is not valid JSON — ${(error as Error).message}`,
		);
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(
			"reconcile: the source manifest must be an object with bank and ledger entry lists",
		);
	}
	const record = parsed as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (key !== "bank" && key !== "ledger" && key !== "sourceSnapshot") {
			throw new Error(
				`reconcile: manifest unknown property "${key}" is rejected`,
			);
		}
	}
	const bank = parseEntryList(record.bank, "bank");
	const ledger = parseEntryList(record.ledger, "ledger");
	const sourceSnapshot = record.sourceSnapshot;
	if (
		sourceSnapshot !== undefined &&
		(typeof sourceSnapshot !== "string" ||
			!SOURCE_SNAPSHOT_RE.test(sourceSnapshot))
	) {
		throw new Error(
			"reconcile: sourceSnapshot must be a lowercase hex sha-256 digest",
		);
	}
	return {
		bank,
		ledger,
		...(sourceSnapshot === undefined ? {} : { sourceSnapshot }),
	};
}

/** Deterministic normalization: BigInt cents, sorted by reference. */
function normalizedEntries(
	entries: readonly ReconcileManifestEntry[],
): ReadonlyArray<{ reference: string; amountCents: bigint }> {
	return [...entries]
		.map((entry) => ({
			reference: entry.reference,
			amountCents: toBigIntCents(entry.amountCents),
		}))
		.sort((a, b) => a.reference.localeCompare(b.reference));
}

/**
 * Deterministic reconciliation: match bank vs ledger by reference and compute
 * the difference in BigInt cents. A reference present on only one side is a
 * discrepancy. Returns zero differences for a balanced manifest.
 */
export function computeReconcileDifferences(
	manifest: ReconcileSourceManifest,
): ReconcileDifference[] {
	const bank = new Map<string, bigint>(
		normalizedEntries(manifest.bank).map((entry) => [
			entry.reference,
			entry.amountCents,
		]),
	);
	const ledger = new Map<string, bigint>(
		normalizedEntries(manifest.ledger).map((entry) => [
			entry.reference,
			entry.amountCents,
		]),
	);
	const references = new Set<string>([...bank.keys(), ...ledger.keys()]);
	const differences: ReconcileDifference[] = [];
	for (const reference of [...references].sort()) {
		const bankCents = bank.get(reference) ?? 0n;
		const ledgerCents = ledger.get(reference) ?? 0n;
		const differenceCents = bankCents - ledgerCents;
		if (differenceCents !== 0n) {
			differences.push({
				reference,
				bankCents,
				ledgerCents,
				differenceCents,
				payloadHash: sha256Canonical({
					reference,
					bankCents,
					ledgerCents,
					differenceCents,
				}),
			});
		}
	}
	return differences;
}

/** True when a bank-statement evidence node covers the reference. */
async function hasEvidenceFor(
	graph: EvidenceGraphStore,
	missionId: string,
	reference: string,
): Promise<boolean> {
	const loaded = await graph.load(missionId);
	return loaded.nodes.some(
		(node) =>
			node.nodeKind === EVIDENCE_NODE_KIND.SOURCE &&
			typeof node.payload === "object" &&
			node.payload !== null &&
			(node.payload as Record<string, unknown>).kind === "bank-statement" &&
			(node.payload as Record<string, unknown>).reference === reference,
	);
}

/** True when the bank-statement evidence confirms the anomaly's bank amount. */
async function evidenceConfirms(
	graph: EvidenceGraphStore,
	missionId: string,
	difference: ReconcileDifference,
): Promise<boolean> {
	const loaded = await graph.load(missionId);
	const statement = loaded.nodes.find(
		(node) =>
			node.nodeKind === EVIDENCE_NODE_KIND.SOURCE &&
			typeof node.payload === "object" &&
			node.payload !== null &&
			(node.payload as Record<string, unknown>).kind === "bank-statement" &&
			(node.payload as Record<string, unknown>).reference ===
				difference.reference,
	);
	if (statement === undefined) {
		return false;
	}
	const amount = (statement.payload as Record<string, unknown>).amountCents;
	if (typeof amount === "bigint") {
		return amount === difference.bankCents;
	}
	return toBigIntCents(amount as number | string) === difference.bankCents;
}

/** The manifest is mandatory for computation phases (no ambient lookup). */
function requireManifest(input: ReconcileChainInput): ReconcileSourceManifest {
	if (input.manifest === undefined) {
		throw new Error(
			"reconcile: the bounded source manifest is required for this phase (no ambient runtime lookup; REQ-CHAIN-006)",
		);
	}
	return input.manifest;
}

/** The bounded per-phase domain computation of the reconcile chain. */
async function runStep(
	context: ChainStepContext<ReconcileChainInput>,
): Promise<ChainStepOutcome<ReconcileRunOutput>> {
	const { graph, mission, phase, input } = context;

	switch (phase) {
		case EDA_PHASE.INGEST: {
			const manifest = input.manifest;
			if (
				manifest === undefined ||
				manifest.bank.length === 0 ||
				manifest.ledger.length === 0
			) {
				return {
					output: { phase, ingested: false, adjustmentsPosted: false },
					waitForEvidence: true,
				};
			}
			const nodeIds: string[] = [];
			for (const entry of normalizedEntries(manifest.bank)) {
				const id = `src-bank-${entry.reference}`;
				await graph.appendNode({
					id,
					missionId: mission.id,
					nodeKind: EVIDENCE_NODE_KIND.SOURCE,
					payload: {
						kind: "bank-movement",
						reference: entry.reference,
						amountCents: entry.amountCents,
					},
				});
				nodeIds.push(id);
			}
			for (const entry of normalizedEntries(manifest.ledger)) {
				const id = `src-ledger-${entry.reference}`;
				await graph.appendNode({
					id,
					missionId: mission.id,
					nodeKind: EVIDENCE_NODE_KIND.SOURCE,
					payload: {
						kind: "ledger-entry",
						reference: entry.reference,
						amountCents: entry.amountCents,
					},
				});
				nodeIds.push(id);
			}
			return {
				output: { phase, ingested: true, adjustmentsPosted: false },
				evidenceNodeIds: nodeIds,
			};
		}
		case EDA_PHASE.NORMALIZE: {
			const manifest = requireManifest(input);
			const count = normalizedEntries([
				...manifest.bank,
				...manifest.ledger,
			]).length;
			const id = `norm-${mission.id}`;
			await graph.appendNode({
				id,
				missionId: mission.id,
				nodeKind: EVIDENCE_NODE_KIND.TRANSFORMATION,
				payload: {
					kind: "normalize",
					algorithm: "bigint-cents",
					entries: count,
				},
			});
			return {
				output: { phase, adjustmentsPosted: false },
				evidenceNodeIds: [id],
			};
		}
		case EDA_PHASE.RECONCILE: {
			const manifest = requireManifest(input);
			const differences = computeReconcileDifferences(manifest);
			if (differences.length === 0) {
				return {
					output: {
						phase,
						balanced: true,
						anomalies: [],
						adjustmentsPosted: false,
					},
				};
			}
			const missingEvidence: string[] = [];
			for (const difference of differences) {
				if (!(await hasEvidenceFor(graph, mission.id, difference.reference))) {
					missingEvidence.push(difference.reference);
				}
			}
			if (missingEvidence.length > 0) {
				return {
					output: {
						phase,
						balanced: false,
						anomalies: differences,
						awaitingEvidence: true,
						adjustmentsPosted: false,
					},
					waitForEvidence: true,
					blocker: {
						reason: `reconciliation requires evidence: ${missingEvidence.length} unresolved difference(s) await supporting bank-statement evidence`,
						severity: "WARNING",
					},
				};
			}
			const nodeIds: string[] = [];
			for (const difference of differences) {
				const id = `anomaly-${difference.reference}`;
				await graph.appendNode({
					id,
					missionId: mission.id,
					nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
					payload: {
						kind: "discrepancy",
						reference: difference.reference,
						bankCents: difference.bankCents,
						ledgerCents: difference.ledgerCents,
						differenceCents: difference.differenceCents,
						payloadHash: difference.payloadHash,
					},
				});
				nodeIds.push(id);
			}
			// The anomaly conclusions cite their supporting evidence via DERIVED_FROM
			// edges (design §7 lineage): the frozen bank source always exists; the
			// bank-statement evidence edge is added only when evidence arrived.
			const existingIds = new Set(
				(await graph.load(mission.id)).nodes.map((node) => node.id),
			);
			for (const difference of differences) {
				const conclusion = `anomaly-${difference.reference}`;
				const bankSource = `src-bank-${difference.reference}`;
				if (existingIds.has(bankSource)) {
					await graph.appendEdge({
						id: `edge-${bankSource}-${conclusion}`,
						missionId: mission.id,
						from: bankSource,
						to: conclusion,
						relation: EVIDENCE_RELATION.DERIVED_FROM,
					});
				}
				const statement = `stmt-${difference.reference}`;
				if (existingIds.has(statement)) {
					await graph.appendEdge({
						id: `edge-${statement}-${conclusion}`,
						missionId: mission.id,
						from: statement,
						to: conclusion,
						relation: EVIDENCE_RELATION.DERIVED_FROM,
					});
				}
			}
			return {
				output: {
					phase,
					balanced: false,
					anomalies: differences,
					adjustmentsPosted: false,
				},
				evidenceNodeIds: nodeIds,
				blocker: {
					reason: `reconciliation discrepancy: ${differences.length} unresolved difference(s) require attention`,
					severity: "ERROR",
				},
			};
		}
		case EDA_PHASE.INVESTIGATE: {
			const manifest = requireManifest(input);
			const differences = computeReconcileDifferences(manifest);
			const refuted: string[] = [];
			for (const difference of differences) {
				if (!(await evidenceConfirms(graph, mission.id, difference))) {
					refuted.push(difference.reference);
				}
			}
			for (const reference of refuted) {
				await graph.appendNode({
					id: `refute-${reference}`,
					missionId: mission.id,
					nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
					payload: { kind: "refutation", reference, verdict: "refuted" },
				});
			}
			return {
				output: {
					phase,
					confirmed: differences.length - refuted.length,
					refuted: refuted.length,
					adjustmentsPosted: false,
				},
			};
		}
		case EDA_PHASE.PROPOSE: {
			const manifest = requireManifest(input);
			const differences = computeReconcileDifferences(manifest);
			const confirmed: ReconcileDifference[] = [];
			for (const difference of differences) {
				if (await evidenceConfirms(graph, mission.id, difference)) {
					confirmed.push(difference);
				}
			}
			const totalDifferenceCents = confirmed.reduce(
				(accumulator, difference) => accumulator + difference.differenceCents,
				0n,
			);
			return {
				output: {
					phase,
					proposal: { discrepancies: confirmed.length, totalDifferenceCents },
					adjustmentsPosted: false,
				},
				evidenceNodeIds: confirmed.map(
					(difference) => `anomaly-${difference.reference}`,
				),
				proposal: {
					summary:
						`Reconciliation for ${mission.fiscalPeriod}: ${confirmed.length} confirmed discrepancy(ies); ` +
						`net bank-vs-ledger difference ${totalDifferenceCents} cents — resolution: post the cited ` +
						`correcting ledger entries after approval (no autonomous posting; REQ-AUTH-009)`,
					riskLevel: confirmed.length === 0 ? "LOW" : "MEDIUM",
				},
			};
		}
		case EDA_PHASE.EXECUTE:
			// The chain cannot post adjustments: the execute phase is a no-op that
			// records the outcome (REQ-AUTH-009).
			return { output: { phase, adjustmentsPosted: false } };
		case EDA_PHASE.CLOSE:
			return {
				output: { phase, adjustmentsPosted: false, closed: true },
				receiptWarranted: true,
			};
		default:
			return { output: { phase, adjustmentsPosted: false } };
	}
}

/** The reconcile chain definition (intent `reconciliation`; design §11.3). */
export const reconcileChain: ChainDefinition<
	ReconcileChainInput,
	ReconcileRunOutput
> = {
	name: "reconcile",
	intent: "reconciliation",
	requiredMode: AUTHORITY_MODE.ANALYZE,
	runStep,
};

/**
 * Explicit materiality for reconcile runs: R2-gated material adjustments
 * (REQ-AUTH-004/005). The input is complete and the R2 floor is always applied.
 */
export const RECONCILE_MATERIALITY: ExplicitMaterialityRequest = {
	input: {
		value: 0n,
		reversibility: "partially-reversible",
		jurisdiction: "PE",
	},
	minimum: "R2",
};
