/**
 * Pi-owned routing adapter surface (pi-sdd-030-routing-adapter; design D1 §3.3).
 *
 * This module defines ONLY Pi-owned adapter shapes: routing routes, risk bands,
 * evidence sufficiency, reversibility, preflight results, route selections,
 * execution-port responses, the per-work-unit budget ledger, and the input
 * envelopes the adapter composes. It does NOT duplicate the published
 * `WorkUnit`, `WorkResult`, `WorkStopReason`, or validation helpers.
 *
 * Authority boundary (REQ-BOUND-001): local types describe inputs, observations,
 * and proposals only. They carry no materiality threshold, gate verdict
 * algorithm, approval grant, transition matrix, or fiscal authorization flag.
 * Every authoritative value comes from the published pinned runtime:
 *
 * | Value | Source |
 * | --- | --- |
 * | WorkUnit/WorkResult/stop kinds | `drenyra-ai` routing surface (published root entry) |
 * | Mission transition validator | `drenyra-ai/missions` `validateTransition`, injected |
 * | Materiality tier | `deriveRequiredMateriality` (delegates to kernel `deriveMateriality`) |
 * | Permission requirement | `requiredModeFor` + `assertMonotonicAuthority` + bound authorization |
 * | Mission/gate outcome | `runChainStep` / `executePreparedStep` / `EdaMissionCoordinator.advance` |
 *
 * Import-path note (deviation, cited evidence): the pinned `drenyra-ai@0.3.0`
 * exports map omits the `./routing` subpath even though `dist/index.js`
 * re-exports the complete routing module (`export * from "./routing/index.js"`).
 * The routing surface is therefore imported from the published package root,
 * which is the same pinned artifact and the same module object; nothing
 * unpublished or Pi-copied is consumed.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import type { ChainDefinition, ChainRunInput } from "../chain-pipeline.js";
import type { ScopeBinding } from "../canonicalization.js";
import type {
  ActionFamily,
  AuthorizationRecord,
  ExplicitMaterialityRequest,
} from "../authority-gates.js";
import type {
  AccountingException,
  AccountingMissionStatus,
  MissionSnapshot,
} from "drenyra-ai/missions";
import type {
  Candidate,
  CanonicalTransitionValidator,
  Materiality,
  MaterialityInput,
  Sha256Hash,
  WorkBudgets,
  WorkUnit,
  WorkUnitInput,
} from "drenyra-ai";
import type {
  EvidenceRef,
  ProposedCandidateRef,
  ToolProvenance,
  WorkResult,
  WorkStopReason,
} from "drenyra-ai";

/** The three eligible routing routes (design §5). */
export type RoutingRoute = "direct" | "delegated" | "durable";

/** Normalized kernel risk band (2 cells). */
export type RiskBand = "R0_R1" | "R2_R3";

/** Evidence sufficiency classification (3 cells). */
export type EvidenceSufficiency = "SUFFICIENT" | "INSUFFICIENT" | "AMBIGUOUS";

/** Routing reversibility classification (3 cells). */
export type RoutingReversibility =
  | "REVERSIBLE"
  | "PARTIALLY_REVERSIBLE"
  | "IRREVERSIBLE";

/** The fixed preflight stages in evaluation order; `workunit` is the helper step. */
export type PreflightStage =
  | "scope"
  | "permissions"
  | "evidence"
  | "materiality"
  | "reversibility"
  | "systems"
  | "approval"
  | "workunit";

/** One typed system/tool/destination dependency with explicit availability. */
export interface SystemAvailability {
  /** Non-empty system identifier (never a raw path). */
  systemId: string;
  /** Explicit availability; absent/conflicting declarations fail closed. */
  available: boolean;
  /** Tool operations this dependency requires (cross-checked vs the allow-list). */
  requiredToolOperations?: readonly { toolId: string; operation: string }[];
  /** Destination ids this dependency requires (cross-checked vs the allow-list). */
  requiredDestinationIds?: readonly string[];
}

/** Approval requirement/evidence declaration (never an approval grant). */
export interface ApprovalRequirement {
  required: boolean;
  approvalType?: string;
  /** True when approval evidence is bound to this mission/scope/candidate evidence. */
  evidenceBound?: boolean;
}

/**
 * The complete input for one preflight (design §3.3). References existing Pi
 * types rather than redefining scope, authorization, evidence nodes, or
 * materiality. The published `WorkUnitInput` fields are carried here with
 * budgets excluded; budgets are normalized by the preflight against the
 * explicit policy maxima.
 */
export interface PreflightRequest {
  binding: ScopeBinding;
  mission: MissionSnapshot;
  actionFamily: ActionFamily;
  /** Bound authorization record; never a local grant. */
  authorization: AuthorizationRecord;
  /** The governing policy pin named by POLICY_BLOCKED / AMBIGUOUS_INPUT. */
  governingPolicy: { id: string; version: string; contentHash?: string };
  /** Required evidence hashes (lowercase hex sha-256) for the bound objective. */
  requiredEvidenceHashes: readonly string[];
  /** Terminal evidence node ids whose mission-local lineage is required. */
  terminalNodeIds: readonly string[];
  /** Explicit materiality; deriveRequiredMateriality only, no R0 default. */
  materiality: ExplicitMaterialityRequest;
  /** Optional declared tier for kernel-derivation conflict detection. */
  declaredRiskTier?: Materiality;
  /** Optional separately declared reversibility for conflict detection. */
  declaredReversibility?: RoutingReversibility;
  /** Systems/tools/destinations with explicit availability. */
  systems: readonly SystemAvailability[];
  approval: ApprovalRequirement;
  /** Evidence store root (isolated in tests; defaults to cwd). */
  evidenceStoresRoot?: string;
  /** Published WorkUnitInput fields, budgets excluded (normalized below). */
  workUnitInput: Omit<WorkUnitInput, "budgets">;
  /** Requested budget ceilings before policy clamping. */
  requestedBudgets: {
    timeLimitMs: number;
    tokenLimit: number;
    costLimitCents: bigint;
    researchAttempts: number;
    correctionAttempts: number;
  };
  /** Explicit version-pinned policy budget maxima. */
  policyMax: {
    maxCostLimitCents: bigint;
    maxTimeLimitMs: number;
    maxTokenLimit: number;
  };
}

/** A passed preflight: helper-built, helper-validated WorkUnit + classifications. */
export type PreflightResult =
  | {
      ok: true;
      workUnit: WorkUnit;
      riskTier: Materiality;
      riskBand: RiskBand;
      evidenceSufficiency: "SUFFICIENT";
      reversibility: RoutingReversibility;
      approvalRequired?: WorkStopReason & { kind: "APPROVAL_REQUIRED" };
    }
  | { ok: false; stage: PreflightStage; reason: WorkStopReason };

/** The basis a route proposal records (advisory only, no authority). */
export interface RouteBasis {
  kernelRiskTier: Materiality;
  evidenceSufficiency: EvidenceSufficiency;
  reversibility: RoutingReversibility;
}

/** A route proposal: exactly one route + basis, carrying no authorization. */
export type RouteSelection =
  | { ok: true; route: RoutingRoute; basis: RouteBasis }
  | { ok: false; reason: WorkStopReason };

/** The input to the pure 18-cell route selector (design §5). */
export interface RouteSelectionInput {
  kernelRiskTier: Materiality;
  evidenceSufficiency: EvidenceSufficiency;
  reversibility: RoutingReversibility;
  /** Already-validated required hashes (named by MISSING_EVIDENCE). */
  requiredEvidenceHashes: readonly Sha256Hash[];
  /** Optional declared tier; a conflict with the kernel tier is AMBIGUOUS_INPUT. */
  declaredRiskTier?: Materiality;
}

/** The exact exhausted budget dimension (published WorkStopReason budget). */
export type BudgetExhaustedDimension =
  | "TIME"
  | "TOKENS"
  | "COST"
  | "RESEARCH_ATTEMPTS"
  | "CORRECTION";

/** A ledger check verdict against the unit ceilings. */
export type LedgerCheck =
  | { ok: true }
  | { ok: false; dimension: BudgetExhaustedDimension };

/** Read-only projection of the per-unit budget ledger. */
export interface BudgetLedgerSnapshot {
  workUnitId: string;
  elapsedMs: number;
  tokensConsumed: number;
  costIncurredCents: bigint;
  researchAttempts: number;
  correctionAttempts: number;
  closed: boolean;
}

/**
 * The per-work-unit in-memory budget ledger (design §5). Created from exactly
 * one `WorkUnit.id`, never transferred to another unit or route, never reused:
 * a route change requires a new preflight and a new `WorkUnit.id`. Every debit
 * is checked against the unit ceiling; exhaustion returns a typed dimension
 * naming TIME | TOKENS | COST | RESEARCH_ATTEMPTS | CORRECTION.
 */
export class BudgetLedger {
  private readonly budgets: WorkBudgets;
  private elapsedMs = 0;
  private tokensConsumed = 0;
  private costIncurredCents = 0n;
  private researchAttempts = 0;
  private correctionAttempts = 0;
  private closed = false;

  private constructor(
    readonly workUnitId: string,
    budgets: WorkBudgets,
  ) {
    this.budgets = budgets;
  }

  /** Create a ledger bound to one work unit id (never reused across units). */
  static create(workUnit: Pick<WorkUnit, "id" | "budgets">): BudgetLedger {
    return new BudgetLedger(workUnit.id, workUnit.budgets);
  }

  /** Fail closed when a ledger is presented for a different work unit. */
  assertWorkUnit(workUnit: Pick<WorkUnit, "id">): void {
    if (workUnit.id !== this.workUnitId) {
      throw new Error(
        `BudgetLedger bound to work unit ${this.workUnitId}, presented for ${workUnit.id} — ledgers never transfer across work units`,
      );
    }
  }

  /** Close the ledger (non-retryable stop or UNKNOWN). Further debits fail. */
  close(): void {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  /** Full pre-dispatch check against every unit ceiling. */
  check(): LedgerCheck {
    if (this.closed) return { ok: false, dimension: "TIME" };
    if (this.elapsedMs >= this.budgets.timeLimitMs) {
      return { ok: false, dimension: "TIME" };
    }
    if (this.tokensConsumed >= this.budgets.tokenLimit) {
      return { ok: false, dimension: "TOKENS" };
    }
    if (this.costIncurredCents >= this.budgets.costLimitCents) {
      return { ok: false, dimension: "COST" };
    }
    if (this.researchAttempts >= this.budgets.researchAttemptLimit) {
      return { ok: false, dimension: "RESEARCH_ATTEMPTS" };
    }
    if (this.correctionAttempts >= this.budgets.correctionAttemptLimit) {
      return { ok: false, dimension: "CORRECTION" };
    }
    return { ok: true };
  }

  /**
   * Debit one research or correction attempt. The debit itself is allowed up
   * to the unit ceiling (`<=`); a debit past the ceiling is exhausted.
   */
  debit(attempt: "research" | "correction"): LedgerCheck {
    if (this.closed) return { ok: false, dimension: attempt === "research" ? "RESEARCH_ATTEMPTS" : "CORRECTION" };
    if (attempt === "research") {
      this.researchAttempts += 1;
      if (this.researchAttempts > this.budgets.researchAttemptLimit) {
        return { ok: false, dimension: "RESEARCH_ATTEMPTS" };
      }
      return { ok: true };
    }
    this.correctionAttempts += 1;
    if (this.correctionAttempts > this.budgets.correctionAttemptLimit) {
      return { ok: false, dimension: "CORRECTION" };
    }
    return { ok: true };
  }

  /** Record a port-reported consumption and re-check TIME/TOKENS/COST. */
  recordConsumption(consumption: {
    elapsedMs: number;
    tokens: number;
    costIncurredCents: bigint;
  }): LedgerCheck {
    if (this.closed) return { ok: false, dimension: "TIME" };
    this.elapsedMs += consumption.elapsedMs;
    this.tokensConsumed += consumption.tokens;
    this.costIncurredCents += consumption.costIncurredCents;
    return this.check();
  }

  snapshot(): BudgetLedgerSnapshot {
    return {
      workUnitId: this.workUnitId,
      elapsedMs: this.elapsedMs,
      tokensConsumed: this.tokensConsumed,
      costIncurredCents: this.costIncurredCents,
      researchAttempts: this.researchAttempts,
      correctionAttempts: this.correctionAttempts,
      closed: this.closed,
    };
  }

  get researchCount(): number {
    return this.researchAttempts;
  }

  get correctionCount(): number {
    return this.correctionAttempts;
  }
}

/** Consumption reported by one port after one bounded execution. */
export interface RouteConsumption {
  elapsedMs: number;
  tokens: number;
  costIncurredCents: bigint;
  researchAttempts: number;
  correctionAttempts: number;
}

/**
 * One execution-port response (design §3.3). `coreProposedTarget` is the next
 * Core-proposed target observed from persisted mission state (design §6.1/6.2);
 * `stop` is a typed adapter stop derived from the coordinator/chain result —
 * never fabricated, never an authority grant.
 */
export interface RouteExecutionPortResponse {
  missionBefore: MissionSnapshot;
  missionAfter: MissionSnapshot;
  evidenceRefs: readonly EvidenceRef[];
  candidates: readonly { candidate: Candidate; materialityBasis: MaterialityInput }[];
  unresolvedExceptions: readonly AccountingException[];
  toolProvenance: readonly ToolProvenance[];
  consumption: RouteConsumption;
  /** Next Core-proposed target observed from persisted mission state. */
  coreProposedTarget?: AccountingMissionStatus;
  /** Typed adapter stop (WAIT/authority denial mapping); never invented. */
  stop?: WorkStopReason;
  explanation?: string;
}

/** Everything one port receives for exactly one bounded execution. */
export interface RouteExecutionInput<I = unknown, O = unknown> {
  workUnit: WorkUnit;
  route: RoutingRoute;
  binding: ScopeBinding;
  mission: MissionSnapshot;
  chain: ChainDefinition<I, O>;
  chainRun: ChainRunInput<I>;
  ledger: BudgetLedger;
}

/** The injected execution ports; each performs at most one bounded operation. */
export interface RoutingExecutionPorts {
  direct(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
  delegated(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
  durable(input: RouteExecutionInput): Promise<RouteExecutionPortResponse>;
}

/** Everything the executor needs for one bounded execution. */
export interface ExecuteRoutingWorkInput {
  workUnit: WorkUnit;
  selection: RouteSelection & { ok: true };
  binding: ScopeBinding;
  mission: MissionSnapshot;
  ports: RoutingExecutionPorts;
  ledger: BudgetLedger;
  chain: ChainDefinition<unknown, unknown>;
  chainRun: ChainRunInput<unknown>;
  /** Core validator; production composition passes the imported value. */
  validator?: CanonicalTransitionValidator;
}

/** The result of one `executeRoutingWork` call. */
export type RouteExecutionResult =
  | {
      ok: true;
      workUnit: WorkUnit;
      result: WorkResult;
      portCalls: number;
    }
  | {
      ok: false;
      reason: WorkStopReason;
      workUnit: WorkUnit;
      /** A structured STOPPED/FAILED result when the published contract permits one. */
      result?: WorkResult;
      portCalls: number;
      unresolvedExceptions: readonly AccountingException[];
    };

/** Candidate refs produced through the published helper only. */
export type { ProposedCandidateRef };
