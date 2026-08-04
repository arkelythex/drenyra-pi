/**
 * Shared chain pipeline — the single scope → mission → one phase operation →
 * authority gates → receipt structure every chain follows (REQ-CHAIN-005;
 * design §11.1). Fail-closed at the first failing stage; exactly one legal EDA
 * step per call (REQ-MISS-004; REQ-CHAIN-006); no unbounded loops, no
 * continue-all; money is BigInt cents everywhere; every operation is bounded
 * and deterministic.
 *
 * `runChainStep` always performs:
 *
 *   1. scope validation (complete canonical scope; hash recomputes; chain
 *      required mode is met) — no store is touched before this passes,
 *   2. mission load/start (the durable `reconciliation`/`monthly-close`/...
 *      mission for the bound company + fiscal period + intent),
 *   3. one prepared step (RUN/SKIP/WAIT derived from persisted state only),
 *   4. stale-scope invalidation: a running mission whose scope hash changed
 *      since its bound authorization is invalidated before any write
 *      (design §15; REQ-SCOPE-006 — the S4b deferral lands here),
 *   5. the authority pipeline (mode/materiality/mission/approval/receipt as
 *      applicable — `runAuthorityPipeline`, first non-allowed verdict stops),
 *   6. the chain's bounded phase operation (domain computation + evidence node
 *      appends + candidate proposal; no accounting mutation),
 *   7. receipt persistence: a signed COMPLETION receipt bound to mission,
 *      evidence hash, scope hash, and executed target when the outcome
 *      warrants one (REQ-CHAIN-007).
 *
 * `executePreparedStep` is the step executor (design §4.4): optimistic
 * versioning (engine VERSION_CONFLICT), an idempotency key derived from mission
 * id + phase + mission version + scope hash + target hash (the engine replays a
 * cached result — REQ-MISS-008), and a stale-scope check that invalidates the
 * prepared step before any write. Lifecycle phases go through engine-validated
 * transitions; steady-state phases advance phase-only (PROGRESS_UPDATE events;
 * design §4.1 — never fabricates an engine state transition).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { randomUUID } from "node:crypto";
import {
	AccountingMissionStatus,
	IntentRegistryImpl,
	MissionEventType,
	MissionRuntime,
	waitReasonFor,
	type IntentRegistry,
	type MissionEvent,
	type MissionIntent,
	type MissionSnapshot,
	WaitReason,
} from "drenyra-ai/missions";
import type { ApprovalRecord } from "drenyra-ai/gates";
import {
	ReceiptType,
	buildSignedReceipt,
	computeEvidenceHash,
	generateReceiptKeyPair,
	type EvidenceItem,
	type ReceiptContent,
	type SignedReceipt,
	type SigningKeyInfo,
} from "drenyra-ai/receipts";
import {
	assertMissionScopeReady,
	type AuthorityMode,
} from "../runtime/context.js";
import {
	EDA_PHASE,
	EDA_PHASE_ORDER,
	createEdaSteps,
	derivePreparedStep,
	familyForPhase,
	type EdaPhase,
	type PreparedStep,
} from "./accounting-status.js";
import {
	ACTION_FAMILY,
	AUTHORITY_ORDER,
	runAuthorityPipeline,
	type ActionFamily,
	type AuthorizationRecord,
	type AuthorityGateResult,
	type ExplicitMaterialityRequest,
} from "./authority-gates.js";
import { AuthorityStore } from "./authority-store.js";
import {
	bindScope,
	sha256Canonical,
	type ScopeBinding,
} from "./canonicalization.js";
import { EvidenceGraphStore } from "./evidence-graph.js";
import {
	createDurableMissionStores,
	type DurableMissionStores,
} from "./mission-store.js";
import {
	ReceiptStore,
	type HarnessReceiptRecord,
	type ReceiptBinding,
} from "./receipt-store.js";

/** A chain's domain computation for one phase (design §11.1). */
export interface ChainStepContext<I> {
	chain: string;
	binding: ScopeBinding;
	stores: DurableMissionStores;
	/** The append-only evidence graph; the chain records nodes/edges here. */
	graph: EvidenceGraphStore;
	/** The mission snapshot BEFORE this step's persistence. */
	mission: MissionSnapshot;
	phase: EdaPhase;
	/** The bounded chain input for this run (no ambient runtime lookup). */
	input: I;
}

/** A candidate proposal spec the pipeline attaches at the propose phase. */
export interface ChainProposalSpec {
	summary: string;
	riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

/** A mission blocker the pipeline attaches when the outcome requires attention. */
export interface ChainBlockerSpec {
	reason: string;
	severity: "WARNING" | "ERROR" | "CRITICAL";
}

/** The chain's bounded outcome for one phase. */
export interface ChainStepOutcome<O> {
	output: O;
	/**
	 * Terminal evidence node ids grounding this outcome (used for the receipt
	 * evidence hash and the proposal evidence binding).
	 */
	evidenceNodeIds?: readonly string[];
	/** Deterministic target hash; default = sha256Canonical({chain, phase, output}). */
	targetHash?: string;
	/** When true, the pipeline persists a signed COMPLETION receipt (REQ-CHAIN-007). */
	receiptWarranted?: boolean;
	/** A candidate proposal to attach when the phase completes (REQ-AUTH-009). */
	proposal?: ChainProposalSpec;
	/** A mission blocker to attach with the step completion. */
	blocker?: ChainBlockerSpec;
	/** Enter the engine-legal evidence wait for this step (REQ-MISS-009). */
	waitForEvidence?: boolean;
}

/** One chain definition (design §11.1). */
export interface ChainDefinition<I, O> {
	name: string;
	intent: MissionIntent;
	/** The minimum bound authority mode the whole chain requires. */
	requiredMode: AuthorityMode;
	runStep(context: ChainStepContext<I>): Promise<ChainStepOutcome<O>>;
}

/** Input for one bounded chain run. */
export interface ChainRunInput<I> {
	binding: ScopeBinding;
	input: I;
	storesRoot?: string;
	/** Explicit materiality (REQ-AUTH-004); candidate-bearing phases require it. */
	materiality?: ExplicitMaterialityRequest;
	/** The human approver for the R2 approval gate. */
	approverId?: string;
	reason?: string;
	/** Trusted approval receipt required by the receipt gate for EXECUTE phases. */
	approvalReceipt?: SignedReceipt;
	/** Explicit trusted-key allow-list; EXECUTE requires a non-empty list. */
	trustedKeys?: SigningKeyInfo[];
	/** Explicitly resume an EVIDENCE wait after evidence was added. */
	resume?: boolean;
}

/** A fail-closed block: the stage that stopped evaluation and why. */
export interface ChainBlocked {
	stage: string;
	reason: string;
}

/** The result of one bounded chain run (at most one EDA phase). */
export interface ChainRunResult<O> {
	chain: string;
	intent: MissionIntent;
	/** The mission after this run; absent when scope/mode blocked before start. */
	mission?: MissionSnapshot;
	preparedStep: PreparedStep | null;
	/** The chain's outcome for the phase completed by this run, or null. */
	output: O | null;
	/** The phase completed by this run, or null when nothing advanced. */
	phase: EdaPhase | null;
	waitReason?: WaitReason;
	/** The authority pipeline verdicts in fixed order (empty for scope/mode blocks). */
	gates: readonly AuthorityGateResult[];
	/** The persisted completion receipt when the outcome warranted one. */
	receipt?: HarnessReceiptRecord;
	/** True when the run replayed a cached idempotent result (REQ-MISS-008). */
	replayed: boolean;
	blocked?: ChainBlocked;
}

/** Terminal engine statuses are never advanced and never replayed. */
const TERMINAL_STATUSES: ReadonlySet<AccountingMissionStatus> = new Set([
	AccountingMissionStatus.COMPLETED,
	AccountingMissionStatus.FAILED,
	AccountingMissionStatus.REJECTED,
]);

/** Registry flags the engine handler reads at apply time (per run). */
interface ChainRegistryState {
	approveGateBlocked: boolean;
	waitForEvidence: boolean;
}

/** Thrown when a prepared step's scope hash no longer matches the binding. */
export class ScopeStaleError extends Error {
	readonly missionId: string;
	readonly phase: EdaPhase;

	constructor(prepared: PreparedStep, binding: ScopeBinding) {
		super(
			`chain-pipeline: stale scope hash invalidates the prepared step before any write — ` +
				`step bound to ${prepared.scopeHash}, current binding ${binding.scopeHash} (REQ-SCOPE-006)`,
		);
		this.name = "ScopeStaleError";
		this.missionId = prepared.missionId;
		this.phase = prepared.phase;
	}
}

/** Mark one step COMPLETED/SKIPPED and roll the mission's progress forward. */
function completeStep(
	mission: MissionSnapshot,
	phase: EdaPhase,
	status: "COMPLETED" | "SKIPPED",
	evidenceIds?: readonly string[],
): MissionSnapshot {
	const now = new Date().toISOString();
	const steps = mission.steps.map((step) =>
		step.id === phase
			? {
					...step,
					status,
					evidenceIds:
						evidenceIds === undefined ? step.evidenceIds : [...evidenceIds],
					completedAt: now,
				}
			: step,
	);
	const done = steps.filter(
		(step) => step.status === "COMPLETED" || step.status === "SKIPPED",
	).length;
	return {
		...mission,
		steps,
		currentStep: phase,
		progress: steps.length === 0 ? 0 : done / steps.length,
	};
}

/** Mark one step IN_PROGRESS (phase started but not completed). */
function markInProgress(
	mission: MissionSnapshot,
	phase: EdaPhase,
): MissionSnapshot {
	const now = new Date().toISOString();
	const steps = mission.steps.map((step) =>
		step.id === phase
			? {
					...step,
					status: "IN_PROGRESS" as const,
					startedAt: step.startedAt ?? now,
				}
			: step,
	);
	return { ...mission, steps, currentStep: phase };
}

/** Attach a blocker with a deterministic id when the outcome requires one. */
function withBlocker(
	mission: MissionSnapshot,
	phase: EdaPhase,
	blocker?: ChainBlockerSpec,
): MissionSnapshot {
	if (blocker === undefined) {
		return mission;
	}
	return {
		...mission,
		blockers: [
			...mission.blockers,
			{
				id: `blk-${phase}-${mission.version}`,
				reason: blocker.reason,
				severity: blocker.severity,
				occurredAt: new Date().toISOString(),
			},
		],
	};
}

/** The engine execute command bound to a mission with optimistic versioning. */
function executeCommand(missionId: string, expectedVersion: number) {
	return {
		type: "execute" as const,
		missionId,
		payload: { expectedMissionVersion: expectedVersion },
	};
}

/**
 * The design §4.4 idempotency key: mission id + phase + mission version +
 * scope hash + target hash. Used for engine-driven applies; the engine replays a
 * cached result for the same key + payload (REQ-MISS-008).
 */
export function idempotencyKeyFor(
	prepared: Pick<
		PreparedStep,
		"missionId" | "phase" | "expectedMissionVersion"
	>,
	scopeHash: string,
	targetHash: string,
): string {
	return `chain:${prepared.missionId}:${prepared.phase}:v${prepared.expectedMissionVersion}:${scopeHash}:${targetHash}`;
}

/**
 * The pipeline's engine registry: lifecycle phases through engine-legal
 * transitions (intake DRAFT→QUEUED, bind-scope QUEUED→RUNNING, archive
 * APPROVED→COMPLETED), evidence waits (RUNNING→WAITING_FOR_EVIDENCE when the
 * chain declared missing evidence), the approve gate-block
 * (RUNNING/BLOCKED_BY_GATE→BLOCKED_BY_GATE with the step staying PENDING), and
 * steady-state phases as null so the pipeline advances them phase-only.
 */
function buildChainRegistry(
	intent: MissionIntent,
	state: ChainRegistryState,
): IntentRegistry {
	const registry = new IntentRegistryImpl();
	registry.register({
		intent,
		async execute(mission: MissionSnapshot): Promise<MissionSnapshot | null> {
			const prepared = derivePreparedStep(mission);
			if (prepared === null || prepared.disposition !== "RUN") {
				return null;
			}
			switch (prepared.phase) {
				case EDA_PHASE.INTAKE:
					return {
						...completeStep(mission, EDA_PHASE.INTAKE, "COMPLETED"),
						status: AccountingMissionStatus.QUEUED,
					};
				case EDA_PHASE.BIND_SCOPE:
					return {
						...completeStep(mission, EDA_PHASE.BIND_SCOPE, "COMPLETED"),
						status: AccountingMissionStatus.RUNNING,
					};
				case EDA_PHASE.INGEST:
				case EDA_PHASE.RECONCILE:
					if (state.waitForEvidence) {
						return {
							...markInProgress(mission, prepared.phase),
							status: AccountingMissionStatus.WAITING_FOR_EVIDENCE,
							blockers: [
								...mission.blockers,
								{
									id: `blk-evidence-${mission.version}`,
									reason:
										"evidence required: supporting evidence is missing for this phase (REQ-MISS-009)",
									severity: "ERROR",
									occurredAt: new Date().toISOString(),
								},
							],
						};
					}
					return null;
				case EDA_PHASE.APPROVE:
					if (state.approveGateBlocked) {
						return {
							...mission,
							status: AccountingMissionStatus.BLOCKED_BY_GATE,
							blockers: [
								...mission.blockers,
								{
									id: `blk-gate-${mission.version}`,
									reason:
										"approval required: the materiality gate blocked this phase",
									severity: "ERROR",
									occurredAt: new Date().toISOString(),
								},
							],
						};
					}
					return {
						...markInProgress(mission, EDA_PHASE.APPROVE),
						status: AccountingMissionStatus.AWAITING_APPROVAL,
					};
				case EDA_PHASE.ARCHIVE:
					return {
						...completeStep(mission, EDA_PHASE.ARCHIVE, "COMPLETED"),
						status: AccountingMissionStatus.COMPLETED,
					};
				default:
					return null;
			}
		},
	});
	return registry;
}

/**
 * The transition target for transition-bearing families. Read-only and
 * steady-state phases omit it; APPROVE/EXECUTE require it (fail closed).
 */
function targetStatusFor(
	family: ActionFamily,
): AccountingMissionStatus | undefined {
	if (family === ACTION_FAMILY.APPROVE) {
		return AccountingMissionStatus.AWAITING_APPROVAL;
	}
	if (family === ACTION_FAMILY.EXECUTE_TARGET) {
		return AccountingMissionStatus.COMPLETED;
	}
	return undefined;
}

/** The ApprovalRecords for a run: the explicit approver or none. */
function approvalsFrom(approverId?: string, reason?: string): ApprovalRecord[] {
	if (approverId === undefined) {
		return [];
	}
	return [
		{
			approverId,
			at: new Date().toISOString(),
			reason: reason ?? "chain approval",
		},
	];
}

/**
 * Find or persist the authorization bound to the exact scope hash, actor,
 * family, and mission. Every action family a mission uses gets its own
 * authorization record (design §5.3/§5.4: per-family decisions). A mission
 * started under scope A is never silently re-authorized for scope B: when a
 * running mission has NO authorization bound to the current scope hash at all,
 * the pipeline fails closed (REQ-SCOPE-006; design §15).
 */
async function boundAuthorizationFor(
	storesRoot: string,
	binding: ScopeBinding,
	mission: MissionSnapshot,
	family: ActionFamily,
	startedNow: boolean,
): Promise<AuthorizationRecord | undefined> {
	const store = new AuthorityStore(storesRoot);
	const existing = await store.findBoundAuthorization({
		missionId: mission.id,
		scopeHash: binding.scopeHash,
		actionFamily: family,
		actorId: binding.scope.actor,
	});
	if (existing !== undefined) {
		return existing;
	}
	if (!startedNow) {
		const records = await store.listAuthorizations(mission.id);
		const scopeBound = records.some(
			(record) =>
				record.decision === "GRANTED" &&
				record.scopeHash === binding.scopeHash &&
				record.actorId === binding.scope.actor,
		);
		if (!scopeBound) {
			return undefined;
		}
	}
	const record: AuthorizationRecord = {
		id: `auth-${mission.id}-${family.toLowerCase()}`,
		missionId: mission.id,
		scopeHash: binding.scopeHash,
		authorityMode: binding.scope.authorityLevel,
		actionFamily: family,
		actorId: binding.scope.actor,
		decision: "GRANTED",
		issuedAt: new Date().toISOString(),
	};
	await store.appendAuthorization(record);
	return record;
}

/** The active non-terminal mission for the bound scope + intent. */
async function findActiveChainMission(
	stores: DurableMissionStores,
	intent: MissionIntent,
	binding: ScopeBinding,
): Promise<MissionSnapshot | undefined> {
	const all = await stores.store.list();
	const candidates = all.filter(
		(mission) =>
			mission.companyId === binding.scope.company &&
			mission.fiscalPeriod === binding.scope.fiscalPeriod &&
			mission.intent === intent &&
			!TERMINAL_STATUSES.has(mission.status),
	);
	if (candidates.length === 0) {
		return undefined;
	}
	candidates.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
	return candidates[candidates.length - 1];
}

/** Start the durable mission for the chain: DRAFT + the full 13-step plan. */
async function startChainMissionInternal<I, O>(
	runtime: MissionRuntime,
	stores: DurableMissionStores,
	definition: ChainDefinition<I, O>,
	binding: ScopeBinding,
): Promise<MissionSnapshot> {
	const started = await runtime.start({
		companyId: binding.scope.company,
		fiscalPeriod: binding.scope.fiscalPeriod,
		intent: definition.intent,
		input: {
			instruction: `Run ${definition.name} chain for ${binding.scope.fiscalPeriod}`,
		},
	});
	return phaseOnlyUpdate(stores, started, (mission) => ({
		...mission,
		steps: createEdaSteps(definition.intent),
		currentStep: EDA_PHASE_ORDER[0] ?? "",
	}));
}

/**
 * Test/support export: start the chain mission over fresh durable stores and
 * return the stores + DRAFT mission with the 13-step plan (no phase advanced).
 */
export async function startChainMission<I, O>(
	definition: ChainDefinition<I, O>,
	binding: ScopeBinding,
	options: { storesRoot?: string } = {},
): Promise<{ stores: DurableMissionStores; mission: MissionSnapshot }> {
	const storesRoot = options.storesRoot ?? process.cwd();
	const stores = createDurableMissionStores(storesRoot);
	const state: ChainRegistryState = {
		approveGateBlocked: false,
		waitForEvidence: false,
	};
	const runtime = new MissionRuntime({
		store: stores.store,
		events: stores.events,
		idempotency: stores.idempotency,
		registry: buildChainRegistry(definition.intent, state),
	});
	const mission = await startChainMissionInternal(
		runtime,
		stores,
		definition,
		binding,
	);
	return { stores, mission };
}

/**
 * Phase-only progress update: advances steps while keeping the engine status
 * unchanged (design §4.1 — never fabricates a state transition). The snapshot
 * and a PROGRESS_UPDATE event are written with a version bump so the durable
 * snapshot/event comparison stays consistent for recovery (design §8.3).
 */
async function phaseOnlyUpdate(
	stores: DurableMissionStores,
	snapshot: MissionSnapshot,
	mutate: (mission: MissionSnapshot) => MissionSnapshot,
): Promise<MissionSnapshot> {
	const current = await stores.store.findById(snapshot.id);
	if (current === undefined || current.version !== snapshot.version) {
		throw new Error(
			`chain-pipeline: stale mission version — expected ${snapshot.version}, got ${current?.version}`,
		);
	}
	const next: MissionSnapshot = {
		...mutate(current),
		version: current.version + 1,
		lastEventSequence: current.lastEventSequence + 1,
		updatedAt: new Date().toISOString(),
	};
	const event: MissionEvent = {
		id: `evt_${randomUUID()}`,
		missionId: next.id,
		sequence: next.lastEventSequence,
		eventType: MissionEventType.PROGRESS_UPDATE,
		snapshot: next,
		createdAt: next.updatedAt,
	};
	await stores.store.save(next);
	await stores.events.append(event);
	return next;
}

/** Project the ancestor closure of the terminal ids to engine EvidenceItems. */
async function projectEvidence(
	graph: EvidenceGraphStore,
	missionId: string,
	terminalIds: readonly string[],
): Promise<{ items: EvidenceItem[]; evidenceHash: string }> {
	const loaded = await graph.load(missionId);
	const closure = new Set<string>();
	for (const terminalId of terminalIds) {
		closure.add(terminalId);
		const lineage = await graph.lineage(missionId, terminalId);
		for (const ancestor of lineage.ancestors) {
			closure.add(ancestor.id);
		}
	}
	const items: EvidenceItem[] = [...closure].sort().map((id) => {
		const node = loaded.nodes.find((candidate) => candidate.id === id);
		const kind = node?.nodeKind ?? "evidence";
		return { id, label: kind, type: kind };
	});
	return { items, evidenceHash: computeEvidenceHash(items) };
}

/** Build a signed COMPLETION receipt bound to mission/evidence/scope/target. */
function buildCompletionReceipt(input: {
	mission: MissionSnapshot;
	binding: ReceiptBinding;
	actorId: string;
	proposalVersion: number;
}): HarnessReceiptRecord {
	const keyPair = generateReceiptKeyPair(
		`chain_${input.mission.id.slice(0, 8)}`,
	);
	const content: ReceiptContent = {
		missionId: input.mission.id,
		companyId: input.mission.companyId,
		actorId: input.actorId,
		decision: "APPROVE",
		proposalVersion: input.proposalVersion,
		evidenceHash: input.binding.evidenceHash,
		previousStatus: input.mission.status,
		newStatus: AccountingMissionStatus.COMPLETED,
		payloadHash: sha256Canonical(input.binding),
		timestamp: new Date().toISOString(),
	};
	const receipt = buildSignedReceipt(
		content,
		keyPair,
		"1.0",
		ReceiptType.COMPLETION,
	);
	return { binding: input.binding, receipt };
}

/** Build the mission proposal (candidate only; REQ-AUTH-009) from the chain spec. */
function buildProposal(
	mission: MissionSnapshot,
	proposal?: ChainProposalSpec,
	proposalEvidence?: { items: EvidenceItem[]; evidenceHash: string },
): MissionSnapshot["proposal"] {
	const items = proposalEvidence?.items ?? [];
	const evidenceHash =
		proposalEvidence?.evidenceHash ?? computeEvidenceHash(items);
	return {
		id: `prop-${mission.id}`,
		missionId: mission.id,
		version: mission.version,
		evidence: items,
		evidenceHash,
		summary:
			proposal?.summary ?? `${mission.intent} for ${mission.fiscalPeriod}`,
		riskLevel: proposal?.riskLevel ?? "LOW",
		generatedAt: new Date().toISOString(),
	};
}

/** Everything `executePreparedStep` needs for exactly one prepared step. */
export interface ExecutePreparedStepInput {
	binding: ScopeBinding;
	stores: DurableMissionStores;
	/** The optimistic base snapshot (version checked by the engine). */
	mission: MissionSnapshot;
	prepared: PreparedStep;
	/** Deterministic target hash for the idempotency key + receipt binding. */
	targetHash: string;
	proposal?: ChainProposalSpec;
	proposalEvidence?: { items: EvidenceItem[]; evidenceHash: string };
	evidenceNodeIds?: readonly string[];
	blocker?: ChainBlockerSpec;
	waitForEvidence?: boolean;
	materiality?: ExplicitMaterialityRequest;
	approvals?: ApprovalRecord[];
	approverId?: string;
	reason?: string;
	approvalReceipt?: SignedReceipt;
	trustedKeys?: SigningKeyInfo[];
	/** Receipt identity to attach when the close phase seals the run. */
	receiptFields?: { receiptId: string; receiptHash: string };
	/** The approve gate verdict: true blocks the phase at BLOCKED_BY_GATE. */
	approveGateBlocked?: boolean;
}

/** The result of executing exactly one prepared step. */
export interface ExecutePreparedStepResult {
	mission: MissionSnapshot;
	/** The phase completed by this step, or null when none advanced. */
	phase: EdaPhase | null;
	replayed: boolean;
	waitReason?: WaitReason;
}

/**
 * Execute exactly one prepared step (design §4.4). A changed scope hash
 * invalidates the prepared step BEFORE any write (design §15). Engine-driven
 * applies use the mission+phase+version+scope+target idempotency key, so a
 * repeated call replays the cached result (REQ-MISS-008) and a stale expected
 * version raises the engine VERSION_CONFLICT. Lifecycle phases go through
 * engine-validated transitions; steady-state phases advance phase-only.
 */
export async function executePreparedStep(
	input: ExecutePreparedStepInput,
): Promise<ExecutePreparedStepResult> {
	const { binding, stores, mission, prepared } = input;

	// Fail-closed: a changed scope hash invalidates the step before any write.
	if (prepared.scopeHash !== binding.scopeHash) {
		throw new ScopeStaleError(prepared, binding);
	}

	const state: ChainRegistryState = {
		approveGateBlocked: input.approveGateBlocked === true,
		waitForEvidence: false,
	};
	const runtime = new MissionRuntime({
		store: stores.store,
		events: stores.events,
		idempotency: stores.idempotency,
		registry: buildChainRegistry(prepared.intent, state),
	});

	const key = idempotencyKeyFor(prepared, binding.scopeHash, input.targetHash);

	if (prepared.disposition === "SKIP") {
		const skipped = await phaseOnlyUpdate(stores, mission, (m) =>
			completeStep(m, prepared.phase, "SKIPPED"),
		);
		return { mission: skipped, phase: prepared.phase, replayed: false };
	}

	switch (prepared.phase) {
		case EDA_PHASE.INTAKE:
		case EDA_PHASE.BIND_SCOPE:
		case EDA_PHASE.ARCHIVE: {
			const applied = await runtime.apply(
				executeCommand(mission.id, mission.version),
				{
					expectedMissionVersion: mission.version,
					idempotencyKey: key,
				},
			);
			return {
				mission: applied.snapshot,
				phase: prepared.phase,
				replayed: applied.replayed === true,
			};
		}
		case EDA_PHASE.INGEST:
		case EDA_PHASE.RECONCILE: { 
     			if (input.waitForEvidence === true) {
     				state.waitForEvidence = true;
     				try {
     					const applied = await runtime.apply(
     						executeCommand(mission.id, mission.version),
     						{
     							expectedMissionVersion: mission.version,
     							idempotencyKey: key,
     						},
     					);
     					// Persist the chain-declared evidence-wait blocker so the wait is
     					// visible to later status reads, not just this response (REQ-CHAIN-003).
     					const snapshot =
     						input.blocker === undefined
     							? applied.snapshot
     							: await phaseOnlyUpdate(stores, applied.snapshot, (m) =>
     									withBlocker(m, prepared.phase, input.blocker),
     							);
     					return {
     						mission: snapshot,
     						phase: null,
     						replayed: applied.replayed === true,
     						waitReason: waitReasonFor(applied.snapshot.status) ?? undefined,
     					};
     				} finally {
     					state.waitForEvidence = false;
     				}
     			}
			const done = await phaseOnlyUpdate(stores, mission, (m) =>
				withBlocker(
					completeStep(m, prepared.phase, "COMPLETED", input.evidenceNodeIds),
					prepared.phase,
					input.blocker,
				),
			);
			return { mission: done, phase: prepared.phase, replayed: false };
		}
		case EDA_PHASE.APPROVE: {
			// Gate-block path: RUNNING/BLOCKED_BY_GATE -> BLOCKED_BY_GATE; the approve
			// step stays PENDING so no phase advances (SC-CHAIN-004/SC-MISS-006).
			if (state.approveGateBlocked) {
				const applied = await runtime.apply(
					executeCommand(mission.id, mission.version),
					{
						expectedMissionVersion: mission.version,
						idempotencyKey: key,
					},
				);
				return {
					mission: applied.snapshot,
					phase: null,
					replayed: applied.replayed === true,
					waitReason: WaitReason.POLICY_GATE,
				};
			}
			// Allowed path: -> AWAITING_APPROVAL (engine-legal), then the approve
			// command bound to the real proposal evidence hash.
			let current = mission;
			if (current.status !== AccountingMissionStatus.AWAITING_APPROVAL) {
				const applied = await runtime.apply(
					executeCommand(current.id, current.version),
					{
						expectedMissionVersion: current.version,
						idempotencyKey: key,
					},
				);
				current = applied.snapshot;
			}
			const proposal = current.proposal;
			if (proposal === null) {
				throw new Error(
					`chain-pipeline: mission ${current.id} has no proposal to approve`,
				);
			}
			const approved = await runtime.apply(
				{
					type: "approve",
					missionId: current.id,
					payload: {
						proposalId: proposal.id,
						proposalVersion: proposal.version,
						evidenceHash: proposal.evidenceHash,
						expectedMissionVersion: current.version,
					},
				},
				{
					expectedMissionVersion: current.version,
					idempotencyKey: `chain:${current.id}:approve-cmd:v${current.version}`,
				},
			);
			const done = await phaseOnlyUpdate(stores, approved.snapshot, (m) =>
				completeStep(m, EDA_PHASE.APPROVE, "COMPLETED"),
			);
			return { mission: done, phase: EDA_PHASE.APPROVE, replayed: false };
		}
		case EDA_PHASE.PROPOSE: {
			const done = await phaseOnlyUpdate(stores, mission, (m) => ({
				...completeStep(
					m,
					EDA_PHASE.PROPOSE,
					"COMPLETED",
					input.evidenceNodeIds,
				),
				proposal: buildProposal(m, input.proposal, input.proposalEvidence),
			}));
			return { mission: done, phase: EDA_PHASE.PROPOSE, replayed: false };
		}
		case EDA_PHASE.CLOSE: {
			const fields = input.receiptFields;
			const done = await phaseOnlyUpdate(stores, mission, (m) => ({
				...completeStep(m, EDA_PHASE.CLOSE, "COMPLETED", input.evidenceNodeIds),
				...(fields === undefined
					? {}
					: { receiptId: fields.receiptId, receiptHash: fields.receiptHash }),
			}));
			return { mission: done, phase: EDA_PHASE.CLOSE, replayed: false };
		}
		default: {
			const done = await phaseOnlyUpdate(stores, mission, (m) =>
				withBlocker(
					completeStep(m, prepared.phase, "COMPLETED", input.evidenceNodeIds),
					prepared.phase,
					input.blocker,
				),
			);
			return { mission: done, phase: prepared.phase, replayed: false };
		}
	}
}

/** A blocked run result (scope/mode/gate failures before a phase persists). */
function blockedResult<O>(
	definition: Pick<ChainDefinition<unknown, unknown>, "name" | "intent">,
	stage: string,
	reason: string,
	partial: Partial<ChainRunResult<O>> = {},
): ChainRunResult<O> {
	return {
		chain: definition.name,
		intent: definition.intent,
		preparedStep: null,
		output: null,
		phase: null,
		gates: [],
		replayed: false,
		blocked: { stage, reason },
		...partial,
	};
}

/**
 * Run one bounded chain step (REQ-CHAIN-005/006/007; design §11.1). The fixed
 * stage order is scope → required mode → mission load/start → prepared step →
 * stale-scope invalidation → authority gates → one phase operation → receipt
 * persistence. The first non-allowed stage stops; no write happens before the
 * gates allow the phase.
 */
export async function runChainStep<I, O>(
	definition: ChainDefinition<I, O>,
	input: ChainRunInput<I>,
): Promise<ChainRunResult<O>> {
	// Stage 1: scope validation (fail closed; no store is touched before this).
	let binding: ScopeBinding;
	try {
		binding = bindScope(input.binding.scope);
	} catch (error) {
		return blockedResult(
			definition,
			"scope",
			`scope binding invalid: ${(error as Error).message}`,
		);
	}
	if (binding.scopeHash !== input.binding.scopeHash) {
		return blockedResult(
			definition,
			"scope",
			"scope binding hash does not match the canonical scope (stale or forged binding)",
		);
	}
	try {
		assertMissionScopeReady(binding.scope);
	} catch (error) {
		return blockedResult(
			definition,
			"scope",
			`incomplete canonical scope: ${(error as Error).message}`,
		);
	}

	const storesRoot = input.storesRoot ?? process.cwd();

	// Stage 2: the chain's required mode (first failing stage stops).
	if (
		AUTHORITY_ORDER[binding.scope.authorityLevel] <
		AUTHORITY_ORDER[definition.requiredMode]
	) {
		return blockedResult(
			definition,
			"mode",
			`chain ${definition.name} requires at least ${definition.requiredMode} authority ` +
				`(bound ${binding.scope.authorityLevel})`,
		);
	}

	const stores = createDurableMissionStores(storesRoot);
	const graph = new EvidenceGraphStore(storesRoot);

	// Stage 3: mission load/start over the durable stores.
	const state: ChainRegistryState = {
		approveGateBlocked: false,
		waitForEvidence: false,
	};
	const runtime = new MissionRuntime({
		store: stores.store,
		events: stores.events,
		idempotency: stores.idempotency,
		registry: buildChainRegistry(definition.intent, state),
	});
	let mission: MissionSnapshot;
	const loadedMission = await findActiveChainMission(
		stores,
		definition.intent,
		binding,
	);
	const startedNow = loadedMission === undefined;
	if (loadedMission !== undefined) {
		mission = loadedMission;
	} else {
		mission = await startChainMissionInternal(
			runtime,
			stores,
			definition,
			binding,
		);
	}

	// Stage 4: the prepared step (RUN/SKIP/WAIT from persisted state only).
	const prepared = derivePreparedStep(mission, binding.scopeHash);
	if (prepared === null) {
		return {
			chain: definition.name,
			intent: definition.intent,
			mission,
			preparedStep: null,
			output: null,
			phase: null,
			waitReason: waitReasonFor(mission.status) ?? undefined,
			gates: [],
			replayed: false,
		};
	}

	if (prepared.disposition === "WAIT") {
		// Evidence wait resume: explicit `resume` only; WAITING_FOR_EVIDENCE->RUNNING
		// is an engine-validated transition, never an auto-advance (REQ-MISS-009).
		if (
			input.resume === true &&
			waitReasonFor(mission.status) === WaitReason.EVIDENCE
		) {
			const targetHash = sha256Canonical({
				chain: definition.name,
				phase: "resume",
			});
			const applied = await runtime.apply(
				executeCommand(mission.id, mission.version),
				{
					expectedMissionVersion: mission.version,
					idempotencyKey: idempotencyKeyFor(
						{ ...prepared, phase: "resume" as EdaPhase },
						binding.scopeHash,
						targetHash,
					),
				},
			);
			return {
				chain: definition.name,
				intent: definition.intent,
				mission: applied.snapshot,
				preparedStep: derivePreparedStep(applied.snapshot, binding.scopeHash),
				output: null,
				phase: null,
				waitReason: undefined,
				gates: [],
				replayed: applied.replayed === true,
			};
		}
		// Approve resolution: an explicit approver resolves the R2 gate from
		// BLOCKED_BY_GATE/AWAITING_APPROVAL (SC-CHAIN-004).
		if (
			prepared.phase === EDA_PHASE.APPROVE &&
			input.approverId !== undefined &&
			(mission.status === AccountingMissionStatus.BLOCKED_BY_GATE ||
				mission.status === AccountingMissionStatus.AWAITING_APPROVAL)
		) {
			const family = familyForPhase(prepared.phase);
			const authorization = await boundAuthorizationFor(
				storesRoot,
				binding,
				mission,
				family,
				false,
			);
			if (authorization === undefined) {
				return blockedResult(
					definition,
					"scope",
					`mission ${mission.id} is bound to a different scope — no authorization exists for the current scope hash (REQ-SCOPE-006)`,
					{ mission, preparedStep: prepared },
				);
			}
			const approvals = approvalsFrom(input.approverId, input.reason);
			const gates = await runAuthorityPipeline({
				binding,
				authorization,
				action: family,
				mission,
				targetStatus: AccountingMissionStatus.AWAITING_APPROVAL,
				materiality: input.materiality,
				approvals,
				approvalReceipt: input.approvalReceipt,
				trustedKeys: input.trustedKeys ?? [],
			});
			const firstBlocked = gates.find(
				(gate) => gate.verdict === "blocked" || gate.verdict === "needs_input",
			);
			if (firstBlocked !== undefined) {
				return blockedResult(
					definition,
					firstBlocked.stage,
					firstBlocked.reason,
					{
						mission,
						preparedStep: prepared,
						gates,
					},
				);
			}
			const targetHash = sha256Canonical({
				chain: definition.name,
				phase: prepared.phase,
				approver: input.approverId,
			});
			const executed = await executePreparedStep({
				binding,
				stores,
				mission,
				prepared,
				targetHash,
				approverId: input.approverId,
				reason: input.reason,
				materiality: input.materiality,
				approvals,
			});
			return {
				chain: definition.name,
				intent: definition.intent,
				mission: executed.mission,
				preparedStep: derivePreparedStep(executed.mission, binding.scopeHash),
				output: null,
				phase: executed.phase,
				waitReason: executed.waitReason,
				gates,
				replayed: executed.replayed,
			};
		}
		return {
			chain: definition.name,
			intent: definition.intent,
			mission,
			preparedStep: prepared,
			output: null,
			phase: null,
			waitReason: waitReasonFor(mission.status) ?? undefined,
			gates: [],
			replayed: false,
		};
	}

	// Stage 5: stale-scope invalidation for a running mission (before any write).
	const family = familyForPhase(prepared.phase);
	const authorization = await boundAuthorizationFor(
		storesRoot,
		binding,
		mission,
		family,
		startedNow,
	);
	if (authorization === undefined) {
		return blockedResult(
			definition,
			"scope",
			`mission ${mission.id} is bound to a different scope — no authorization exists for the current scope hash (REQ-SCOPE-006)`,
			{ mission, preparedStep: prepared },
		);
	}

	// Stage 6: authority gates; the first non-allowed verdict stops (REQ-AUTH-008).
	const approvals = approvalsFrom(input.approverId, input.reason);
	const gateResults = await runAuthorityPipeline({
		binding,
		authorization,
		action: family,
		mission,
		targetStatus: targetStatusFor(family),
		materiality: input.materiality,
		approvals,
		approvalReceipt: input.approvalReceipt,
		trustedKeys: input.trustedKeys ?? [],
	});
	const firstBlocked = gateResults.find(
		(gate) => gate.verdict === "blocked" || gate.verdict === "needs_input",
	);
	if (firstBlocked !== undefined) {
		// The approve gate-block is recorded as the engine-legal BLOCKED_BY_GATE
		// wait (the step stays PENDING; SC-CHAIN-004).
		if (
			prepared.phase === EDA_PHASE.APPROVE &&
			firstBlocked.stage === "approval"
		) {
			state.approveGateBlocked = true;
			const applied = await runtime.apply(
				executeCommand(mission.id, mission.version),
				{
					expectedMissionVersion: mission.version,
					idempotencyKey: idempotencyKeyFor(
						prepared,
						binding.scopeHash,
						sha256Canonical({
							chain: definition.name,
							phase: prepared.phase,
							blocked: true,
						}),
					),
				},
			);
			return {
				chain: definition.name,
				intent: definition.intent,
				mission: applied.snapshot,
				preparedStep: derivePreparedStep(applied.snapshot, binding.scopeHash),
				output: null,
				phase: null,
				waitReason: WaitReason.POLICY_GATE,
				gates: gateResults,
				replayed: applied.replayed === true,
			};
		}
		return blockedResult(definition, firstBlocked.stage, firstBlocked.reason, {
			mission,
			preparedStep: prepared,
			gates: gateResults,
		});
	}

	// Stage 7: one phase operation — SKIP is a deterministic disposition.
	if (prepared.disposition === "SKIP") {
		const skipped = await executePreparedStep({
			binding,
			stores,
			mission,
			prepared,
			targetHash: sha256Canonical({
				chain: definition.name,
				phase: prepared.phase,
				skip: true,
			}),
			materiality: input.materiality,
			approvals,
		});
		return {
			chain: definition.name,
			intent: definition.intent,
			mission: skipped.mission,
			preparedStep: derivePreparedStep(skipped.mission, binding.scopeHash),
			output: null,
			phase: skipped.phase,
			waitReason: skipped.waitReason,
			gates: gateResults,
			replayed: skipped.replayed,
		};
	}

	// RUN: the chain's bounded domain computation for this phase.
	const outcome = await definition.runStep({
		chain: definition.name,
		binding,
		stores,
		graph,
		mission,
		phase: prepared.phase,
		input: input.input,
	});
	const targetHash =
		outcome.targetHash ??
		sha256Canonical({
			chain: definition.name,
			phase: prepared.phase,
			output: outcome.output,
		});
	const proposalEvidence =
		outcome.proposal !== undefined
			? await projectEvidence(graph, mission.id, outcome.evidenceNodeIds ?? [])
			: undefined;

	// Receipt preparation happens before the mission write so CLOSE can attach
	// the receipt identity to the snapshot (REQ-CHAIN-007).
	let receipt: HarnessReceiptRecord | undefined;
	let receiptFields: { receiptId: string; receiptHash: string } | undefined;
     	if (outcome.receiptWarranted) {
     		// The receipt binds the EXACT evidence hash the mission was proposed and
     		// approved against when a proposal exists (REQ-CHAIN-007); otherwise it
     		// falls back to the id-sorted lineage hash over the outcome's terminals.
     		const evidenceHash =
     			mission.proposal !== null
     				? mission.proposal.evidenceHash
     				: await graph.computeReceiptEvidenceHash(
     						mission.id,
     						outcome.evidenceNodeIds ?? [],
     					);
		const receiptBinding: ReceiptBinding = {
			version: "drenyra.receipt-binding.v1",
			scopeHash: binding.scopeHash,
			authorizationId: authorization.id,
			policyVersion: binding.scope.policyVersion,
			targetHash,
			evidenceHash,
		};
		receipt = buildCompletionReceipt({
			mission,
			binding: receiptBinding,
			actorId: binding.scope.actor,
			proposalVersion: mission.proposal?.version ?? mission.version,
		});
		receiptFields = {
			receiptId: receipt.receipt.receiptHash,
			receiptHash: receipt.receipt.receiptHash,
		};
	}

	const executed = await executePreparedStep({
		binding,
		stores,
		mission,
		prepared,
		targetHash,
		proposal: outcome.proposal,
		proposalEvidence,
		evidenceNodeIds: outcome.evidenceNodeIds,
		blocker: outcome.blocker,
		waitForEvidence: outcome.waitForEvidence,
		materiality: input.materiality,
		approvals,
		approverId: input.approverId,
		reason: input.reason,
		approvalReceipt: input.approvalReceipt,
		trustedKeys: input.trustedKeys,
		receiptFields,
	});

	if (receipt !== undefined) {
		await new ReceiptStore(storesRoot).save(receipt);
	}

	return {
		chain: definition.name,
		intent: definition.intent,
		mission: executed.mission,
		preparedStep: derivePreparedStep(executed.mission, binding.scopeHash),
		output: executed.phase === null ? null : outcome.output,
		phase: executed.phase,
		waitReason: executed.waitReason,
		gates: gateResults,
		receipt,
		replayed: executed.replayed,
	};
}
