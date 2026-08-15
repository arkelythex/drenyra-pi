/**
 * EDA mission command coordinator — the S4b delegation target for the
 * `/drenyra:mission`, `/drenyra:continue` and `/drenyra:resume` handlers
 * (design §10.3; REQ-CMD-004 thin handlers).
 *
 * The coordinator runs any of the 5 canonical intents over the durable mission
 * stores (design §8): `start` creates the engine DRAFT mission and injects the
 * full 13-phase EDA step plan (REQ-MISS-001); `advance` executes EXACTLY ONE
 * protocol-declared prepared transition per call (REQ-MISS-004) — RUN/SKIP/WAIT
 * is derived from persisted state only via `derivePreparedStep`, never from
 * chat (REQ-MISS-003), and human-wait states never auto-advance (REQ-MISS-009);
 * `resumeAll` runs the fail-closed engine recovery policy (REQ-MISS-007).
 *
 * The mission is bound to the canonical scope: creation requires the complete
 * 10-element binding, and each advance checks the bound authority mode against
 * the prepared phase's required action family (design §4.2, §5.1) — a phase
 * whose required mode exceeds the bound mode is denied before any write.
 *
 * Full per-phase authority gates and the shared chain pipeline (scope -> mission
 * -> one phase -> gates -> receipt persistence, `executePreparedStep`) land in
 * PR #7 (T-S5A-001); this module is the PR #3/T-S2-004-ready step coordinator
 * the S4b handlers delegate to. No fiscal logic lives here: steady-state phases
 * advance as phase-only progress updates (design §4.1) and proposals are
 * candidates only (REQ-AUTH-009).
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
  type AccountingException,
  type IntentHandler,
  type IntentRegistry,
  type MissionEvent,
  type MissionIntent,
  type MissionSnapshot,
  WaitReason,
} from "drenyra-ai/missions";
import { computeEvidenceHash } from "drenyra-ai/receipts";
import type { WorkStopReason, WorkUnit } from "drenyra-ai";
import type { RoutingExecutionPorts } from "./routing/types.js";
import {
  EDA_PHASE,
  EDA_PHASE_ORDER,
  createEdaSteps,
  derivePreparedStep,
  nextAuthorizedActionFor,
  type EdaPhase,
  type PreparedStep,
} from "./accounting-status.js";
import {
  assertMonotonicAuthority,
  type ActionFamily,
} from "./authority-gates.js";
import {
  createDurableMissionStores,
  recoverDurableMissions,
  type DurableMissionStores,
  type RecoveryReport,
} from "./mission-store.js";
import type { ScopeBinding } from "./canonicalization.js";
import type { AuthorityMode } from "../runtime/context.js";
import { assertMissionScopeReady } from "../runtime/context.js";

/** The 5 canonical engine mission intents (REQ-MISS-005). */
export const EDA_INTENTS: readonly MissionIntent[] = [
  "monthly-close",
  "correction",
  "reconciliation",
  "invoice-review",
  "compliance-check",
];

function isMissionIntent(value: string): value is MissionIntent {
  return (EDA_INTENTS as readonly string[]).includes(value);
}

/** Terminal engine statuses are never advanced and never replayed. */
const TERMINAL_STATUSES: ReadonlySet<AccountingMissionStatus> = new Set([
  AccountingMissionStatus.COMPLETED,
  AccountingMissionStatus.FAILED,
  AccountingMissionStatus.REJECTED,
]);

/** Input for starting one EDA mission (design §4.4 start side). */
export interface StartEdaMissionInput {
  intent: MissionIntent;
  /** Bounded source references ingested at the ingest phase (design §11.2). */
  sourceRefs?: string[];
  storesRoot?: string;
}

/** Input for one bounded continuation of an existing EDA mission. */
export interface AdvanceEdaMissionInput {
  missionId: string;
  storesRoot?: string;
}

/** A structured authority denial: the bound mode is below the phase's family. */
export interface AuthorityDenied {
  actionFamily: ActionFamily;
  requiredMode: AuthorityMode;
  reason: string;
}

/** The result of one bounded continuation (exactly one phase, a skip, or a wait). */
export interface AdvanceEdaMissionResult {
  mission: MissionSnapshot;
  /** The next prepared step after this advance (or null when done). */
  preparedStep: PreparedStep | null;
  /** The phase completed by this advance, or null when none advanced. */
  phase: EdaPhase | null;
  waitReason?: WaitReason;
  /** Present when the advance was blocked by the bound authority mode. */
  authorityDenied?: AuthorityDenied;
}

/** Mark one step COMPLETED/SKIPPED and roll the mission's progress forward. */
function completeStep(
  mission: MissionSnapshot,
  phase: EdaPhase,
  status: "COMPLETED" | "SKIPPED",
  evidenceIds?: string[],
): MissionSnapshot {
  const now = new Date().toISOString();
  const steps = mission.steps.map((step) =>
    step.id === phase
      ? {
          ...step,
          status,
          evidenceIds: evidenceIds ?? step.evidenceIds,
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

/**
 * The generic per-intent engine handler: lifecycle phases go through engine
 * transitions (intake DRAFT→QUEUED, bind-scope QUEUED→RUNNING, approve
 * RUNNING→AWAITING_APPROVAL, archive APPROVED→COMPLETED); missing evidence
 * enters the engine-legal WAITING_FOR_EVIDENCE wait (REQ-MISS-009); steady-state
 * phases return null so the coordinator advances them phase-only (design §4.1).
 */
function genericIntentHandler(intent: MissionIntent): IntentHandler {
  return {
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
          return {
            ...markInProgress(mission, EDA_PHASE.INGEST),
            status: AccountingMissionStatus.WAITING_FOR_EVIDENCE,
            blockers: [
              ...mission.blockers,
              {
                id: `blk-evidence-${mission.version}`,
                reason: "evidence required: source references are missing",
                severity: "ERROR",
                occurredAt: new Date().toISOString(),
              },
            ],
          };
        case EDA_PHASE.APPROVE:
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
  };
}

function buildRegistry(): IntentRegistry {
	return buildEdaIntentRegistry(EDA_INTENTS);
}

/**
 * Build the generic per-intent engine registry over the canonical EDA
 * transitions (lifecycle phases through engine-legal transitions, evidence
 * waits, steady-state phases as null so the coordinator advances them
 * phase-only). Shared by the S4b coordinator and the PR #7 chain pipeline so
 * every mission runs the same engine semantics.
 */
export function buildEdaIntentRegistry(
	intents: readonly MissionIntent[] = EDA_INTENTS,
): IntentRegistry {
  const registry = new IntentRegistryImpl();
	for (const intent of intents) {
    registry.register(genericIntentHandler(intent));
  }
  return registry;
}

/**
 * The S4b EDA mission coordinator (design §4.4 step-coordinator-ready logic).
 * Constructing it over a binding requires the complete canonical scope; the
 * durable store set is created under the given root (default: cwd).
 */
export class EdaMissionCoordinator {
  /** The durable store set the coordinator runs over (design §8). */
  readonly stores: DurableMissionStores;

  private readonly binding: ScopeBinding;
  private readonly runtime: MissionRuntime;
  private readonly sourceRefsByMission = new Map<string, string[]>();

  constructor(binding: ScopeBinding, options: { storesRoot?: string } = {}) {
    assertMissionScopeReady(binding.scope);
    this.binding = binding;
    this.stores = createDurableMissionStores(options.storesRoot);
    this.runtime = new MissionRuntime({
      store: this.stores.store,
      events: this.stores.events,
      idempotency: this.stores.idempotency,
      registry: buildRegistry(),
    });
  }

  /**
   * Start an EDA mission: engine DRAFT mission + the full 13-step EDA plan
   * injected as a phase-only progress update (REQ-MISS-001), bound to the
   * canonical scope binding.
   */
  async start(input: StartEdaMissionInput): Promise<MissionSnapshot> {
    assertMissionScopeReady(this.binding.scope);
    if (!isMissionIntent(input.intent)) {
      throw new Error(
        `mission-commands: unknown intent "${String(input.intent)}" — expected one of ${EDA_INTENTS.join(", ")}`,
      );
    }
    const started = await this.runtime.start({
      companyId: this.binding.scope.company,
      fiscalPeriod: this.binding.scope.fiscalPeriod,
      intent: input.intent,
			input: {
				instruction: `Run ${input.intent} for ${this.binding.scope.fiscalPeriod}`,
			},
    });
    this.sourceRefsByMission.set(started.id, input.sourceRefs ?? []);
    return this.phaseOnlyUpdate(started, (mission) => ({
      ...mission,
      steps: createEdaSteps(input.intent),
      currentStep: EDA_PHASE_ORDER[0] ?? "",
    }));
  }

  /**
   * Advance exactly one EDA phase (REQ-MISS-004). The disposition (RUN/SKIP/WAIT)
   * is derived from the persisted snapshot only; human-wait states never
   * auto-advance; a phase whose required authority mode exceeds the bound mode
   * is denied before any write (design §5.1).
   */
	async advance(
		input: AdvanceEdaMissionInput,
	): Promise<AdvanceEdaMissionResult> {
    const snapshot = await this.stores.store.findById(input.missionId);
    if (snapshot === undefined) {
      throw new Error(`mission-commands: mission ${input.missionId} not found`);
    }
    // Scope boundary (REQ-SCOPE-006): a mission is only advanceable under the
    // canonical scope it was created for.
    if (
      snapshot.companyId !== this.binding.scope.company ||
      snapshot.fiscalPeriod !== this.binding.scope.fiscalPeriod
    ) {
      throw new Error(
        `mission-commands: mission ${input.missionId} is outside the bound scope ` +
          `(${this.binding.scope.company}/${this.binding.scope.fiscalPeriod})`,
      );
    }
    const prepared = derivePreparedStep(snapshot, this.binding.scopeHash);
    const wait = waitReasonFor(snapshot.status);

    if (prepared === null) {
			return {
				mission: snapshot,
				preparedStep: null,
				phase: null,
				waitReason: wait ?? undefined,
			};
    }

    // Authority binding: the scope's bound mode must permit the prepared phase's
    // action family (design §4.2/§5.1). WAIT steps only report; they never run.
    const next = nextAuthorizedActionFor(prepared, wait);
    if (prepared.disposition !== "WAIT" && next !== undefined) {
      try {
				assertMonotonicAuthority(
					this.binding.scope.authorityLevel,
					next.requiredMode,
				);
      } catch {
        return {
          mission: snapshot,
          preparedStep: prepared,
          phase: null,
          waitReason: wait ?? undefined,
          authorityDenied: {
            actionFamily: next.actionFamily,
            requiredMode: next.requiredMode,
            reason: next.reason,
          },
        };
      }
    }

    if (prepared.disposition === "WAIT") {
			return {
				mission: snapshot,
				preparedStep: prepared,
				phase: null,
				waitReason: wait ?? undefined,
			};
    }

    if (prepared.disposition === "SKIP") {
      const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
        completeStep(m, prepared.phase, "SKIPPED"),
      );
      return this.resultFor(mission, prepared.phase);
    }

    // RUN: one bounded phase per advance.
    switch (prepared.phase) {
      case EDA_PHASE.INGEST: {
        const refs = this.sourceRefsByMission.get(snapshot.id) ?? [];
        if (refs.length === 0) {
          const applied = await this.runtime.apply(
            this.executeCommand(snapshot.id, snapshot.version),
            {
              expectedMissionVersion: snapshot.version,
							idempotencyKey: this.idempotencyKeyFor(
								snapshot.id,
								EDA_PHASE.INGEST,
								snapshot.version,
							),
            },
          );
          return this.resultFor(applied.snapshot, null);
        }
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          completeStep(
            m,
            EDA_PHASE.INGEST,
            "COMPLETED",
            this.evidenceFor(m.id).map((item) => item.id),
          ),
        );
        return this.resultFor(mission, EDA_PHASE.INGEST);
      }
      case EDA_PHASE.PROPOSE: {
        const mission = await this.phaseOnlyUpdate(snapshot, (m) => ({
          ...completeStep(m, EDA_PHASE.PROPOSE, "COMPLETED"),
          proposal: this.buildProposal(m),
        }));
        return this.resultFor(mission, EDA_PHASE.PROPOSE);
      }
      case EDA_PHASE.INTAKE:
      case EDA_PHASE.BIND_SCOPE:
      case EDA_PHASE.APPROVE:
      case EDA_PHASE.ARCHIVE: {
        const applied = await this.runtime.apply(
          this.executeCommand(snapshot.id, snapshot.version),
          {
            expectedMissionVersion: snapshot.version,
						idempotencyKey: this.idempotencyKeyFor(
							snapshot.id,
							prepared.phase,
							snapshot.version,
						),
          },
        );
        return this.resultFor(applied.snapshot, prepared.phase);
      }
      default: {
        // Steady-state phases advance phase-only (design §4.1): the lifecycle
        // status is unchanged and no engine transition is fabricated.
        const mission = await this.phaseOnlyUpdate(snapshot, (m) =>
          completeStep(m, prepared.phase, "COMPLETED"),
        );
        return this.resultFor(mission, prepared.phase);
      }
    }
  }

  /**
   * The active mission for the bound scope: the most recently updated
   * non-terminal mission for the bound company + fiscal period, or undefined.
   */
  async findActiveMission(): Promise<MissionSnapshot | undefined> {
    return pickActiveMission(await this.stores.store.list(), this.binding);
  }

  /**
   * Run the fail-closed restart recovery pass over the durable stores
   * (REQ-MISS-007; design §8.3): interrupted missions recover per the engine
   * policy, human-wait and terminal states are preserved, and unresolved
   * recovery records fail closed. Idempotent: safe to run repeatedly.
   */
  async resumeAll(): Promise<RecoveryReport> {
    return recoverDurableMissions(this.runtime, this.stores);
  }

  private executeCommand(missionId: string, expectedVersion: number) {
    return {
      type: "execute" as const,
      missionId,
      payload: { expectedMissionVersion: expectedVersion },
    };
  }

	private idempotencyKeyFor(
		missionId: string,
		phase: EdaPhase,
		version: number,
	): string {
    return `eda:${missionId}:${phase}:v${version}`;
  }

  private evidenceFor(missionId: string) {
    const refs = this.sourceRefsByMission.get(missionId) ?? [];
    return refs.map((ref, index) => ({
      id: `src-${index + 1}`,
      label: ref,
      type: "source-reference",
    }));
  }

  /** Produce a candidate only (REQ-AUTH-009): the propose phase never mutates. */
  private buildProposal(mission: MissionSnapshot): MissionSnapshot["proposal"] {
    const evidence = this.evidenceFor(mission.id);
    const evidenceHash = computeEvidenceHash(evidence);
    const hasUnresolvedBlocker = mission.blockers.some(
      (blocker) =>
        blocker.resolvedAt === undefined &&
        (blocker.severity === "ERROR" || blocker.severity === "CRITICAL"),
    );
    return {
      id: `prop-${mission.id}`,
      missionId: mission.id,
      version: mission.version,
      evidence,
      evidenceHash,
      summary: `${mission.intent} for ${mission.fiscalPeriod} — ${evidence.length} cited source reference(s)`,
      riskLevel: hasUnresolvedBlocker ? "MEDIUM" : "LOW",
      generatedAt: new Date().toISOString(),
    };
  }

	private resultFor(
		mission: MissionSnapshot,
		phase: EdaPhase | null,
	): AdvanceEdaMissionResult {
    return {
      mission,
      preparedStep: derivePreparedStep(mission, this.binding.scopeHash),
      phase,
      waitReason: waitReasonFor(mission.status) ?? undefined,
    };
  }

  /**
   * Phase-only progress update: advances steps while keeping the engine status
   * unchanged (design §4.1 — never fabricates a state transition). The snapshot
   * and a PROGRESS_UPDATE event are written with a version bump so the durable
   * snapshot/event comparison stays consistent for recovery (design §8.3).
   */
  private async phaseOnlyUpdate(
    snapshot: MissionSnapshot,
    mutate: (mission: MissionSnapshot) => MissionSnapshot,
  ): Promise<MissionSnapshot> {
    const current = await this.stores.store.findById(snapshot.id);
    if (current === undefined || current.version !== snapshot.version) {
      throw new Error(
        `mission-commands: stale mission version — expected ${snapshot.version}, got ${current?.version}`,
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
    await this.stores.store.save(next);
    await this.stores.events.append(event);
    return next;
  }
}

/**
 * Read-only active-mission lookup for the status view (REQ-CMD-009). Never
 * constructs a runtime or writes mission state; returns undefined when the
 * durable mission layout does not exist yet (a fresh workspace has no missions).
 */
export async function findActiveEdaMission(
  binding: ScopeBinding,
  storesRoot?: string,
): Promise<MissionSnapshot | undefined> {
  const stores = createDurableMissionStores(storesRoot);
  return pickActiveMission(await stores.store.list(), binding);
}

    /** The most recently updated non-terminal mission matching the binding's scope. */
    function pickActiveMission(
      all: MissionSnapshot[],
      binding: ScopeBinding,
    ): MissionSnapshot | undefined {
      const candidates = all.filter(
        (mission) =>
          mission.companyId === binding.scope.company &&
          mission.fiscalPeriod === binding.scope.fiscalPeriod &&
          !TERMINAL_STATUSES.has(mission.status),
      );
      if (candidates.length === 0) {
        return undefined;
      }
      candidates.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      return candidates[candidates.length - 1];
    }

    /**
     * The engine status a lifecycle EDA phase enters on completion (design §4.2;
     * mirror of `genericIntentHandler`). Steady-state phases return undefined:
     * they advance phase-only with no engine status change (design §4.1). Used
     * ONLY to PROPOSE the next Core target to the routing executor; the injected
     * Core validator remains the transition authority (REQ-BOUND-001).
     */
    function lifecycleStatusForPhase(
      phase: EdaPhase,
    ): AccountingMissionStatus | undefined {
      switch (phase) {
        case EDA_PHASE.INTAKE:
          return AccountingMissionStatus.QUEUED;
        case EDA_PHASE.BIND_SCOPE:
          return AccountingMissionStatus.RUNNING;
        case EDA_PHASE.INGEST:
          return AccountingMissionStatus.WAITING_FOR_EVIDENCE;
        case EDA_PHASE.APPROVE:
          return AccountingMissionStatus.AWAITING_APPROVAL;
        case EDA_PHASE.ARCHIVE:
          return AccountingMissionStatus.COMPLETED;
        default:
          return undefined;
      }
    }

    /** A typed adapter stop for a human-wait state (published kinds only). */
    function waitStopFor(
      unit: WorkUnit,
      waitReason: WaitReason,
    ): WorkStopReason {
      switch (waitReason) {
        case WaitReason.EVIDENCE: {
          const hashes = unit.evidenceAllowed.map((ref) => ref.hash);
          if (hashes.length > 0) {
            return { kind: "MISSING_EVIDENCE", requiredHashes: hashes };
          }
          return { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] };
        }
        case WaitReason.APPROVAL:
        case WaitReason.POLICY_GATE:
          return { kind: "APPROVAL_REQUIRED", approvalType: "human" };
        case WaitReason.EXTERNAL_SYSTEM:
          return {
            kind: "EXTERNAL_SYSTEM_UNAVAILABLE",
            systemId: "durable-mission",
          };
        case WaitReason.MANUAL_INTERVENTION:
          return {
            kind: "APPROVAL_REQUIRED",
            approvalType: "manual-intervention",
          };
      }
    }

    /** One well-formed seam accounting exception (never invented stop kinds). */
    function seamException(
      missionId: string,
      code: string,
      severity: string,
      evidenceRefs: string[],
      resolutionStatus: string,
    ): AccountingException {
      return {
        id: `exc-${code.toLowerCase()}-${missionId}`,
        missionId,
        code,
        severity,
        subjectRef: missionId,
        evidenceRefs,
        resolutionStatus,
      };
    }

    /**
     * D5 — durable-mission routing seam (pi-sdd-030-routing-adapter; design D5
     * §7). The ONE exported adapter function: it verifies the work-unit/mission
     * binding, calls `coordinator.advance({ missionId })` EXACTLY ONCE, and maps
     * the existing `AdvanceEdaMissionResult` into the executor port response
     * WITHOUT changing the mission or re-routing the advance back through the
     * adapter (no recursion). WAIT and authority denial are reported as typed
     * adapter stops (published `WorkStopReason` kinds) plus unresolved
     * exceptions; no synthetic tool provenance or candidate is ever emitted.
     *
     * Existing `start` / `advance` / `resumeAll` / recovery behavior is
     * untouched; this seam is opt-in composition for routing execution.
     */
    export function createDurableMissionRoutingPort(
      coordinator: EdaMissionCoordinator,
    ): RoutingExecutionPorts["durable"] {
      return async (input) => {
        if (input.workUnit.missionId !== input.mission.id) {
          throw new Error(
            `durable routing port: work unit ${input.workUnit.id} is bound to mission ` +
              `${input.workUnit.missionId}, presented mission ${input.mission.id} — no execution`,
          );
        }
        const advance = await coordinator.advance({ missionId: input.mission.id });
        const evidenceHashes = input.workUnit.evidenceAllowed.map((ref) => ref.hash);
        const exceptions: AccountingException[] = [];
        let stop: WorkStopReason | undefined;
        let coreProposedTarget: AccountingMissionStatus | undefined;

        if (advance.authorityDenied !== undefined) {
          const policy = input.workUnit.policies[0];
          stop =
            policy === undefined
              ? { kind: "AMBIGUOUS_INPUT", fields: ["workUnit.policies"] }
              : { kind: "POLICY_BLOCKED", policy };
          exceptions.push(
            seamException(
              input.mission.id,
              "AUTHORITY_DENIED",
              "ERROR",
              evidenceHashes,
              "BLOCKED_BY_BOUND_AUTHORITY",
            ),
          );
        } else if (advance.mission.status === AccountingMissionStatus.UNKNOWN) {
          stop = { kind: "AMBIGUOUS_INPUT", fields: ["mission.status"] };
          exceptions.push(
            seamException(
              input.mission.id,
              "MISSION_UNKNOWN",
              "ERROR",
              evidenceHashes,
              "RECONCILIATION_OR_EXPLICIT_HUMAN_ACTION_REQUIRED",
            ),
          );
        } else if (advance.waitReason !== undefined) {
          stop = waitStopFor(input.workUnit, advance.waitReason);
          exceptions.push(
            seamException(
              input.mission.id,
              "WAIT_REQUIRED",
              "WARNING",
              evidenceHashes,
              "HUMAN_INPUT_REQUIRED",
            ),
          );
        } else if (advance.preparedStep !== null) {
          coreProposedTarget = lifecycleStatusForPhase(advance.preparedStep.phase);
        }

        return {
          missionBefore: input.mission,
          missionAfter: advance.mission,
          evidenceRefs: input.workUnit.evidenceAllowed,
          candidates: [],
          unresolvedExceptions: exceptions,
          toolProvenance: [],
          consumption: {
            elapsedMs: 0,
            tokens: 0,
            costIncurredCents: 0n,
            researchAttempts: 1,
            correctionAttempts: 0,
          },
          ...(coreProposedTarget === undefined ? {} : { coreProposedTarget }),
          ...(stop === undefined ? {} : { stop }),
          ...(advance.preparedStep === null
            ? {}
            : {
                explanation: `durable advance: ${advance.preparedStep.disposition} phase ${advance.preparedStep.phase}`,
              }),
        };
      };
    }
