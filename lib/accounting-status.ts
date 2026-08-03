/**
 * Accounting status — read-only projection of runtime, scope, mission,
 * evidence, authority, and the next authorized EDA step (design §4.4, §9).
 *
 * This module performs NO mutations. It derives the next phase and the
 * human-wait classification exclusively from persisted engine state via the
 * engine predicates (`isRunnable`, `isResumable`, `isAwaitingApproval`,
 * `isWaitingForHuman`, `waitReasonFor`); readiness is never inferred from
 * chat or model confidence (REQ-MISS-003). Every one of the 15 installed
 * engine states is handled and an unknown status never maps to runnable.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
 * cents; no float is ever used for money. Digests are lowercase hex sha-256;
 * version/sequence numbers are JSON integers.
 */

import {
  AccountingMissionStatus,
  WaitReason,
  isAwaitingApproval,
  isResumable,
  isRunnable,
  isTerminal,
  isWaitingForHuman,
  waitReasonFor,
  type MissionIntent,
  type MissionSnapshot,
  type MissionStep,
} from "drenyra-ai/missions";
import type { AuthorityMode, CanonicalScopeReport } from "../runtime/context.js";
import type { RuntimeStatus } from "../runtime/status.js";
import { ACTION_FAMILY, requiredModeFor, type ActionFamily } from "./authority-gates.js";
import type { ScopeBinding } from "./canonicalization.js";

/** The 13 canonical EDA phases (REQ-MISS-001; design §4.2). */
export const EDA_PHASE = {
  INTAKE: "intake",
  BIND_SCOPE: "bind-scope",
  INGEST: "ingest",
  NORMALIZE: "normalize",
  CLASSIFY: "classify",
  RECONCILE: "reconcile",
  INVESTIGATE: "investigate",
  PROPOSE: "propose",
  VERIFY: "verify",
  APPROVE: "approve",
  EXECUTE: "execute",
  CLOSE: "close",
  ARCHIVE: "archive",
} as const;

export type EdaPhase = (typeof EDA_PHASE)[keyof typeof EDA_PHASE];

/** The canonical phase order; every mission ships all 13 steps (REQ-MISS-001). */
export const EDA_PHASE_ORDER: readonly EdaPhase[] = [
  EDA_PHASE.INTAKE,
  EDA_PHASE.BIND_SCOPE,
  EDA_PHASE.INGEST,
  EDA_PHASE.NORMALIZE,
  EDA_PHASE.CLASSIFY,
  EDA_PHASE.RECONCILE,
  EDA_PHASE.INVESTIGATE,
  EDA_PHASE.PROPOSE,
  EDA_PHASE.VERIFY,
  EDA_PHASE.APPROVE,
  EDA_PHASE.EXECUTE,
  EDA_PHASE.CLOSE,
  EDA_PHASE.ARCHIVE,
];

const PHASE_NAMES: Readonly<Record<EdaPhase, string>> = {
  intake: "Intake",
  "bind-scope": "Bind scope",
  ingest: "Ingest",
  normalize: "Normalize",
  classify: "Classify",
  reconcile: "Reconcile",
  investigate: "Investigate",
  propose: "Propose",
  verify: "Verify",
  approve: "Approve",
  execute: "Execute",
  close: "Close",
  archive: "Archive",
};

/** The phase applicability policy (design §4.3). */
export type PhaseApplicability = "required" | "conditional";

const REQUIRED: PhaseApplicability = "required";
const CONDITIONAL: PhaseApplicability = "conditional";

/**
 * The design §4.3 intent applicability matrix. Every phase is present for
 * every intent (skips remain visible in `MissionStep[]`); "materiality-driven"
 * approve/execute rows are represented as "conditional" in v0.1 and are
 * resolved from persisted evidence once the evidence graph lands (PR #4).
 */
export const PHASE_APPLICABILITY: Readonly<
  Record<MissionIntent, Readonly<Record<EdaPhase, PhaseApplicability>>>
> = {
  "monthly-close": {
    intake: REQUIRED,
    "bind-scope": REQUIRED,
    ingest: REQUIRED,
    normalize: REQUIRED,
    classify: REQUIRED,
    reconcile: REQUIRED,
    investigate: REQUIRED,
    propose: REQUIRED,
    verify: REQUIRED,
    approve: REQUIRED,
    execute: REQUIRED,
    close: REQUIRED,
    archive: REQUIRED,
  },
  correction: {
    intake: REQUIRED,
    "bind-scope": REQUIRED,
    ingest: REQUIRED,
    normalize: REQUIRED,
    classify: REQUIRED,
    reconcile: CONDITIONAL,
    investigate: REQUIRED,
    propose: REQUIRED,
    verify: REQUIRED,
    approve: REQUIRED,
    execute: REQUIRED,
    close: REQUIRED,
    archive: REQUIRED,
  },
  reconciliation: {
    intake: REQUIRED,
    "bind-scope": REQUIRED,
    ingest: REQUIRED,
    normalize: REQUIRED,
    classify: REQUIRED,
    reconcile: REQUIRED,
    investigate: REQUIRED,
    propose: CONDITIONAL,
    verify: REQUIRED,
    approve: CONDITIONAL,
    execute: CONDITIONAL,
    close: REQUIRED,
    archive: REQUIRED,
  },
  "invoice-review": {
    intake: REQUIRED,
    "bind-scope": REQUIRED,
    ingest: REQUIRED,
    normalize: REQUIRED,
    classify: REQUIRED,
    reconcile: CONDITIONAL,
    investigate: REQUIRED,
    propose: CONDITIONAL,
    verify: REQUIRED,
    approve: CONDITIONAL,
    execute: CONDITIONAL,
    close: REQUIRED,
    archive: REQUIRED,
  },
  "compliance-check": {
    intake: REQUIRED,
    "bind-scope": REQUIRED,
    ingest: REQUIRED,
    normalize: REQUIRED,
    classify: REQUIRED,
    reconcile: CONDITIONAL,
    investigate: REQUIRED,
    propose: CONDITIONAL,
    verify: REQUIRED,
    approve: CONDITIONAL,
    execute: CONDITIONAL,
    close: REQUIRED,
    archive: REQUIRED,
  },
};

/** The applicability of one phase for one intent (design §4.3). */
export function applicabilityFor(
  intent: MissionIntent,
  phase: EdaPhase,
): PhaseApplicability {
  return PHASE_APPLICABILITY[intent][phase];
}

function isEdaPhase(value: string): value is EdaPhase {
  return (EDA_PHASE_ORDER as readonly string[]).includes(value);
}

/**
 * Build the ordered 13-step plan for an intent (REQ-MISS-001). Every step is
 * PENDING and stays visible even when the intent marks it conditional.
 */
export function createEdaSteps(intent: MissionIntent): MissionStep[] {
  return EDA_PHASE_ORDER.map((phase) => ({
    id: phase,
    name: PHASE_NAMES[phase],
    description: `${PHASE_NAMES[phase]} phase (${applicabilityFor(intent, phase)} for intent ${intent})`,
    status: "PENDING",
  }));
}

/** The next legal phase from the persisted step list, or null when done. */
function nextPendingPhase(snapshot: MissionSnapshot): EdaPhase | null {
  const steps = snapshot.steps;
  if (steps.length === 0) {
    return null;
  }
  let index = steps.findIndex((step) => step.id === snapshot.currentStep);
  if (index === -1) {
    index = steps.findIndex((step) => step.status === "PENDING");
    if (index === -1) return null;
    const phase = steps[index]?.id;
    return phase !== undefined && isEdaPhase(phase) ? phase : null;
  }
  for (let i = index; i < steps.length; i += 1) {
    const step = steps[i];
    if (step === undefined) continue;
    if (step.status === "PENDING" || step.status === "IN_PROGRESS") {
      if (!isEdaPhase(step.id)) return null;
      return step.id;
    }
  }
  return null;
}

/**
 * A persisted triggering condition for a conditional phase: an unresolved
 * ERROR/CRITICAL blocker or an existing proposal. In v0.1 this is the
 * snapshot-only signal; the evidence graph (PR #4) extends it.
 */
function hasTriggeringCondition(snapshot: MissionSnapshot): boolean {
  if (snapshot.proposal !== null) {
    return true;
  }
  return snapshot.blockers.some(
    (blocker) =>
      blocker.resolvedAt === undefined &&
      (blocker.severity === "ERROR" || blocker.severity === "CRITICAL"),
  );
}

/** One deterministic continuation decision (design §4.4). */
export interface PreparedStep {
  missionId: string;
  expectedMissionVersion: number;
  phase: EdaPhase;
  intent: MissionIntent;
  scopeHash: string;
  disposition: "RUN" | "SKIP" | "WAIT";
}

const KNOWN_STATUSES: ReadonlySet<AccountingMissionStatus> = new Set(
  Object.values(AccountingMissionStatus),
);

/**
 * Derive the next legal phase from the persisted snapshot only (REQ-MISS-003/
 * 004). Terminal, UNKNOWN, unknown-status, and fully-completed missions yield
 * null; human-wait states yield WAIT; conditional phases without a persisted
 * triggering condition yield SKIP. `scopeHash` is supplied by the caller (the
 * engine snapshot carries no scope hash; the chain supplies the current
 * binding in PR #7).
 */
export function derivePreparedStep(
  snapshot: MissionSnapshot,
  scopeHash?: string,
): PreparedStep | null {
  if (!KNOWN_STATUSES.has(snapshot.status)) {
    return null;
  }
  if (isTerminal(snapshot.status)) {
    return null;
  }
  if (snapshot.status === AccountingMissionStatus.UNKNOWN) {
    return null;
  }
  const phase = nextPendingPhase(snapshot);
  if (phase === null) {
    return null;
  }

  const wait = waitReasonFor(snapshot.status);
  let disposition: PreparedStep["disposition"];
  if (wait !== null) {
    disposition = "WAIT";
  } else {
    const policy = applicabilityFor(snapshot.intent, phase);
    disposition = policy === "conditional" && !hasTriggeringCondition(snapshot)
      ? "SKIP"
      : "RUN";
  }

  return {
    missionId: snapshot.id,
    expectedMissionVersion: snapshot.version,
    phase,
    intent: snapshot.intent,
    scopeHash: scopeHash ?? "",
    disposition,
  };
}

/** The next authorized action (REQ-MISS-003; design §9). */
export interface NextAuthorizedAction {
  actionFamily: ActionFamily;
  requiredMode: AuthorityMode;
  reason: string;
}

const PHASE_FAMILY: Readonly<Record<EdaPhase, ActionFamily>> = {
  intake: ACTION_FAMILY.QUERY,
  "bind-scope": ACTION_FAMILY.QUERY,
  ingest: ACTION_FAMILY.INVESTIGATE,
  normalize: ACTION_FAMILY.INVESTIGATE,
  classify: ACTION_FAMILY.INVESTIGATE,
  reconcile: ACTION_FAMILY.INVESTIGATE,
  investigate: ACTION_FAMILY.INVESTIGATE,
  propose: ACTION_FAMILY.PREPARE_CANDIDATE,
  verify: ACTION_FAMILY.INVESTIGATE,
  approve: ACTION_FAMILY.APPROVE,
  execute: ACTION_FAMILY.EXECUTE_TARGET,
  close: ACTION_FAMILY.EXECUTE_TARGET,
  archive: ACTION_FAMILY.EXECUTE_TARGET,
};

/**
 * Map the current wait reason (or the prepared step) to the next authorized
 * action family and its required mode. Returns undefined when neither applies.
 */
export function nextAuthorizedActionFor(
  preparedStep: PreparedStep | null,
  waitReason: WaitReason | null,
): NextAuthorizedAction | undefined {
  if (waitReason !== null) {
    switch (waitReason) {
      case WaitReason.EVIDENCE:
        return {
          actionFamily: ACTION_FAMILY.INVESTIGATE,
          requiredMode: requiredModeFor(ACTION_FAMILY.INVESTIGATE),
          reason: "mission waits for evidence — provide cited evidence to resume",
        };
      case WaitReason.APPROVAL:
        return {
          actionFamily: ACTION_FAMILY.APPROVE,
          requiredMode: requiredModeFor(ACTION_FAMILY.APPROVE),
          reason: "mission awaits human approval before execution",
        };
      case WaitReason.POLICY_GATE:
        return {
          actionFamily: ACTION_FAMILY.APPROVE,
          requiredMode: requiredModeFor(ACTION_FAMILY.APPROVE),
          reason: "policy gate requires approval input before the phase advances",
        };
      case WaitReason.MANUAL_INTERVENTION:
        return {
          actionFamily: ACTION_FAMILY.INVESTIGATE,
          requiredMode: requiredModeFor(ACTION_FAMILY.INVESTIGATE),
          reason: "manual intervention required to resume the mission",
        };
      case WaitReason.EXTERNAL_SYSTEM:
        return {
          actionFamily: ACTION_FAMILY.QUERY,
          requiredMode: requiredModeFor(ACTION_FAMILY.QUERY),
          reason: "external system input required before resuming",
        };
    }
  }
  if (preparedStep === null) {
    return undefined;
  }
  const family = PHASE_FAMILY[preparedStep.phase];
  return {
    actionFamily: family,
    requiredMode: requiredModeFor(family),
    reason: `next EDA phase ${preparedStep.phase} (${preparedStep.disposition})`,
  };
}

/** Canonical scope status inside the projection (design §9). */
export interface ScopeStatus {
  complete: boolean;
  missing: readonly string[];
  scopeHash?: string;
}

/** Engine-predicate view of the active mission (design §9). */
export interface MissionStatusView {
  id: string;
  status: AccountingMissionStatus;
  intent: MissionIntent;
  version: number;
  progress: number;
  currentStep: string;
  runnable: boolean;
  resumable: boolean;
  awaitingApproval: boolean;
  waitingForHuman: boolean;
  waitReason?: WaitReason;
  preparedStep: PreparedStep | null;
}

/** Evidence summary; the graph projection lands with PR #4. */
export interface EvidenceStatusView {
  available: boolean;
  summary: string;
}

/** Authority posture inside the projection (design §9). */
export interface AuthorityStatusView {
  scopeBound: boolean;
  authorityLevel?: AuthorityMode;
  approvalsPending: number;
  anomalies: number;
}

/** The full read-only status projection (design §9). */
export interface AccountingStatusView {
  runtime: RuntimeStatus;
  scope: ScopeStatus;
  mission?: MissionStatusView;
  evidence: EvidenceStatusView;
  authority: AuthorityStatusView;
  nextAuthorizedAction?: NextAuthorizedAction;
}

/** Inputs for `buildAccountingStatus`; every source is persisted state. */
export interface AccountingStatusInput {
  runtime: RuntimeStatus;
  scopeReport: CanonicalScopeReport;
  binding?: ScopeBinding;
  mission?: MissionSnapshot;
  /** Extra pending-approval count reported by callers that ran the gates. */
  pendingApprovals?: number;
}

/**
 * Build the read-only status projection (design §9). No mutation: the module
 * never writes mission, evidence, authority, or receipt state.
 */
export async function buildAccountingStatus(
  input: AccountingStatusInput,
): Promise<AccountingStatusView> {
  const { runtime, scopeReport, binding, mission } = input;

  let missionView: MissionStatusView | undefined;
  let nextAuthorizedAction: NextAuthorizedAction | undefined;
  if (mission !== undefined) {
    const preparedStep = derivePreparedStep(mission, binding?.scopeHash);
    const wait = waitReasonFor(mission.status);
    missionView = {
      id: mission.id,
      status: mission.status,
      intent: mission.intent,
      version: mission.version,
      progress: mission.progress,
      currentStep: mission.currentStep,
      runnable: isRunnable(mission.status),
      resumable: isResumable(mission.status),
      awaitingApproval: isAwaitingApproval(mission.status),
      waitingForHuman: isWaitingForHuman(mission.status),
      waitReason: wait ?? undefined,
      preparedStep,
    };
    nextAuthorizedAction = nextAuthorizedActionFor(preparedStep, wait);
  }

  const anomalies =
    mission === undefined
      ? 0
      : mission.blockers.filter((blocker) => blocker.resolvedAt === undefined).length;

  const proposalPending =
    mission !== undefined &&
    mission.status === AccountingMissionStatus.AWAITING_APPROVAL &&
    mission.proposal !== null
      ? 1
      : 0;

  const authority: AuthorityStatusView = {
    scopeBound: binding !== undefined,
    authorityLevel: binding?.scope.authorityLevel,
    approvalsPending: proposalPending + (input.pendingApprovals ?? 0),
    anomalies,
  };

  return {
    runtime,
    scope: {
      complete: scopeReport.complete,
      missing: scopeReport.missing,
      scopeHash: binding?.scopeHash,
    },
    mission: missionView,
    evidence: {
      available: false,
      summary: "evidence graph projection lands with PR #4 (S3b)",
    },
    authority,
    nextAuthorizedAction,
  };
}
