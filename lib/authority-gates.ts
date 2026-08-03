/**
 * Authority gates — the monotonic mode matrix, explicit materiality
 * derivation, and the fixed-order fail-closed authority pipeline
 * (REQ-AUTH-001..009; design §5).
 *
 * The harness never defaults missing materiality to R0: every
 * candidate-bearing or executing action must supply a complete engine
 * `MaterialityInput`, and monthly close always applies an R2 floor. The
 * pipeline evaluates scope → mode → materiality → mission → approval →
 * receipt in that exact order and stops at the first non-allowed verdict.
 * The `ReceiptGate` is never invoked without a non-empty `trustedKeys`
 * list, removing the engine's embedded-key self-trust fallback.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
 * cents; no float is ever used for money. Digests are lowercase hex sha-256.
 */

import {
  ApprovalGate,
  GateRunner,
  MissionStateGate,
  ReceiptGate,
  type ApprovalRecord,
  type Gate,
  type GateContext,
  type GateResult,
} from "drenyra-ai/gates";
import { deriveMateriality, orderOf } from "drenyra-ai/candidates";
import type { Materiality, MaterialityInput } from "drenyra-ai/candidates";
import type { AccountingMissionStatus } from "drenyra-ai/missions";
import type { MissionSnapshot } from "drenyra-ai/missions";
import type { SignedReceipt, SigningKeyInfo } from "drenyra-ai/receipts";
import { AUTHORITY_MODE, type AuthorityMode } from "../runtime/context.js";
import { bindScope, type ScopeBinding } from "./canonicalization.js";

/** Strict ordinal order of the four authority modes (REQ-AUTH-001; design §5.1). */
export const AUTHORITY_ORDER: Readonly<Record<AuthorityMode, number>> = {
  ASK: 0,
  ANALYZE: 1,
  PREPARE: 2,
  EXECUTE: 3,
};

/**
 * Command families each authority mode may invoke (REQ-AUTH-007/009;
 * design §5.1). ASK/ANALYZE never mutate; PREPARE produces candidates only;
 * EXECUTE targets exact approved work.
 */
export const ACTION_FAMILY = {
  QUERY: "QUERY",
  INVESTIGATE: "INVESTIGATE",
  PREPARE_CANDIDATE: "PREPARE_CANDIDATE",
  APPROVE: "APPROVE",
  EXECUTE_TARGET: "EXECUTE_TARGET",
} as const;

export type ActionFamily = (typeof ACTION_FAMILY)[keyof typeof ACTION_FAMILY];

const ACTION_REQUIRED_MODE: Readonly<Record<ActionFamily, AuthorityMode>> = {
  QUERY: AUTHORITY_MODE.ASK,
  INVESTIGATE: AUTHORITY_MODE.ANALYZE,
  PREPARE_CANDIDATE: AUTHORITY_MODE.PREPARE,
  APPROVE: AUTHORITY_MODE.PREPARE,
  EXECUTE_TARGET: AUTHORITY_MODE.EXECUTE,
};

const READ_ONLY_FAMILIES: ReadonlySet<ActionFamily> = new Set([
  ACTION_FAMILY.QUERY,
  ACTION_FAMILY.INVESTIGATE,
]);

const MATERIALITY_TIERS: readonly Materiality[] = ["R0", "R1", "R2", "R3"];
const REVERSIBILITY_VALUES: readonly string[] = [
  "reversible",
  "partially-reversible",
  "irreversible",
];

/** The mode an action family requires (design §5.1). */
export function requiredModeFor(action: ActionFamily): AuthorityMode {
  return ACTION_REQUIRED_MODE[action];
}

/**
 * Monotonic authority check (REQ-AUTH-002; design §5.1): throws a
 * monotonicity-violation error when the granted mode is lower than the
 * required mode. A lower authorization never permits a higher action and no
 * mode implies any higher mode (REQ-AUTH-006).
 */
export function assertMonotonicAuthority(
  granted: AuthorityMode,
  required: AuthorityMode,
): void {
  if (AUTHORITY_ORDER[granted] < AUTHORITY_ORDER[required]) {
    throw new Error(
      `monotonicity violation: authority ${granted} cannot perform a ${required} action (${granted} < ${required})`,
    );
  }
}

/**
 * A complete engine materiality input request. `minimum` is the policy floor
 * (monthly close always supplies "R2"); the derived tier is never lowered
 * below it.
 */
export interface ExplicitMaterialityRequest {
  input: MaterialityInput;
  minimum?: Materiality;
}

/** Thrown when a required materiality input is missing or invalid. */
export class MaterialityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterialityInputError";
  }
}

function requireMaterialityInput(input: unknown): asserts input is MaterialityInput {
  if (typeof input !== "object" || input === null) {
    throw new MaterialityInputError("materiality input missing: complete input required");
  }
  const record = input as Partial<MaterialityInput>;
  if (typeof record.value !== "bigint") {
    throw new MaterialityInputError(
      "materiality input missing: value must be BigInt cents",
    );
  }
  if (
    typeof record.reversibility !== "string" ||
    !REVERSIBILITY_VALUES.includes(record.reversibility)
  ) {
    throw new MaterialityInputError(
      "materiality input missing: reversibility must be reversible, partially-reversible, or irreversible",
    );
  }
  if (
    typeof record.jurisdiction !== "string" ||
    record.jurisdiction.trim().length === 0
  ) {
    throw new MaterialityInputError(
      "materiality input missing: jurisdiction must be a non-empty string",
    );
  }
}

/**
 * Derive the required materiality from a complete explicit input
 * (REQ-AUTH-004; design §5.2). Missing BigInt-cents value, reversibility, or
 * jurisdiction fails closed with a `MaterialityInputError`; the harness never
 * defaults to R0. The derived tier is raised to `minimum` when policy
 * requires a floor (monthly close → R2, REQ-AUTH-005).
 */
export function deriveRequiredMateriality(
  request: ExplicitMaterialityRequest,
): Materiality {
  if (typeof request !== "object" || request === null) {
    throw new MaterialityInputError("materiality request missing");
  }
  requireMaterialityInput(request.input);
  const derived = deriveMateriality(request.input);
  if (request.minimum !== undefined) {
    if (!MATERIALITY_TIERS.includes(request.minimum)) {
      throw new MaterialityInputError(
        `invalid materiality minimum "${request.minimum}" (must be one of ${MATERIALITY_TIERS.join(", ")})`,
      );
    }
    if (orderOf(derived) < orderOf(request.minimum)) {
      return request.minimum;
    }
  }
  return derived;
}

/**
 * An append-only authorization record (design §3.3): one decision bound to an
 * exact scope hash, actor, action family, and mission identity.
 */
export interface AuthorizationRecord {
  id: string;
  missionId: string;
  scopeHash: string;
  authorityMode: AuthorityMode;
  actionFamily: ActionFamily;
  actorId: string;
  decision: "GRANTED" | "DENIED";
  issuedAt: string;
  expiresAt?: string;
}

/** Pipeline stage names in fixed evaluation order (REQ-AUTH-008). */
export type AuthorityGateStage =
  | "scope"
  | "mode"
  | "materiality"
  | "mission"
  | "approval"
  | "receipt";

/** A pipeline verdict; `not_applicable` records stages the action skips. */
export type AuthorityGateVerdict =
  | "allowed"
  | "blocked"
  | "needs_input"
  | "not_applicable";

/** Everything the authority pipeline needs to evaluate one requested action. */
export interface AuthorityGateInput {
  /** The complete canonical scope binding the action runs under. */
  binding: ScopeBinding;
  /** The persisted authorization decision for this scope/mission/actor. */
  authorization: AuthorizationRecord;
  /** The requested action family. */
  action: ActionFamily;
  /** The exact current mission snapshot. */
  mission: MissionSnapshot;
  /**
   * The transition target for transition-bearing actions. Read-only and
   * steady-state actions omit it; APPROVE/EXECUTE require it (fail closed).
   */
  targetStatus?: AccountingMissionStatus;
  /** Explicit materiality input; required for candidate-bearing actions. */
  materiality?: ExplicitMaterialityRequest;
  /** Persisted human approval records. */
  approvals: ApprovalRecord[];
  /** The trusted approval receipt; required for EXECUTE. */
  approvalReceipt?: SignedReceipt;
  /** Explicit trusted-key allow-list; EXECUTE requires a non-empty list. */
  trustedKeys: SigningKeyInfo[];
}

/** One ordered pipeline result (design §5.3). */
export interface AuthorityGateResult {
  stage: AuthorityGateStage;
  verdict: AuthorityGateVerdict;
  reason: string;
  envelope?: unknown;
}

function isNonAllowed(verdict: AuthorityGateVerdict): boolean {
  return verdict === "blocked" || verdict === "needs_input";
}

function result(
  stage: AuthorityGateStage,
  verdict: AuthorityGateVerdict,
  reason: string,
  envelope?: unknown,
): AuthorityGateResult {
  return envelope === undefined
    ? { stage, verdict, reason }
    : { stage, verdict, reason, envelope };
}

function evaluateScopeStage(input: AuthorityGateInput): AuthorityGateResult {
  const { binding, authorization, mission } = input;
  if (mission === undefined) {
    return result("scope", "blocked", "mission snapshot required for scope binding checks");
  }
  let bound;
  try {
    bound = bindScope(binding.scope);
  } catch (error) {
    return result(
      "scope",
      "blocked",
      `scope binding invalid: ${(error as Error).message}`,
    );
  }
  if (bound.canonical !== binding.canonical) {
    return result(
      "scope",
      "blocked",
      "scope binding canonical bytes do not match the bound scope",
    );
  }
  if (bound.scopeHash !== binding.scopeHash) {
    return result(
      "scope",
      "blocked",
      "scope binding hash does not match the canonical scope (stale or forged binding)",
    );
  }
  if (authorization.scopeHash !== binding.scopeHash) {
    return result(
      "scope",
      "blocked",
      "authorization is bound to a different scope hash — re-authorize for the current scope",
    );
  }
  if (authorization.missionId !== mission.id) {
    return result(
      "scope",
      "blocked",
      "authorization is bound to a different mission identity",
    );
  }
  if (binding.scope.company !== mission.companyId) {
    return result(
      "scope",
      "blocked",
      "scope binding company does not match the mission company",
    );
  }
  if (binding.scope.fiscalPeriod !== mission.fiscalPeriod) {
    return result(
      "scope",
      "blocked",
      "scope binding fiscal period does not match the mission fiscal period",
    );
  }
  return result(
    "scope",
    "allowed",
    "complete canonical scope recomputes to the bound hash and matches mission and authorization",
  );
}

function evaluateModeStage(input: AuthorityGateInput): AuthorityGateResult {
  const { authorization, action, binding } = input;
  if (authorization.decision !== "GRANTED") {
    return result(
      "mode",
      "blocked",
      `authorization decision is ${authorization.decision}, not GRANTED`,
    );
  }
  if (authorization.actorId !== binding.scope.actor) {
    return result(
      "mode",
      "blocked",
      "authorization actor does not match the bound scope actor",
    );
  }
  if (authorization.actionFamily !== action) {
    return result(
      "mode",
      "blocked",
      `authorization family ${authorization.actionFamily} does not cover the requested action ${action}`,
    );
  }
  if (
    authorization.expiresAt !== undefined &&
    Date.parse(authorization.expiresAt) <= Date.now()
  ) {
    return result("mode", "blocked", "authorization expired; a new bound decision is required");
  }
  const required = requiredModeFor(action);
  try {
    assertMonotonicAuthority(authorization.authorityMode, required);
  } catch (error) {
    return result("mode", "blocked", (error as Error).message);
  }
  return result(
    "mode",
    "allowed",
    `${authorization.authorityMode} meets the required mode ${required} for ${action}`,
  );
}

function evaluateMaterialityStage(input: AuthorityGateInput): AuthorityGateResult {
  const { action, materiality } = input;
  if (READ_ONLY_FAMILIES.has(action)) {
    return result(
      "materiality",
      "not_applicable",
      `read-only ${action} does not evaluate materiality`,
    );
  }
  if (materiality === undefined) {
    return result(
      "materiality",
      "blocked",
      "materiality-input-missing: explicit materiality is required for this action and is never defaulted",
    );
  }
  try {
    const derived = deriveRequiredMateriality(materiality);
    return result(
      "materiality",
      "allowed",
      `materiality derived: ${derived}`,
      { materiality: derived },
    );
  } catch (error) {
    return result(
      "materiality",
      "blocked",
      `materiality-input-missing: ${(error as Error).message}`,
    );
  }
}

function translateEngineResult(engine: GateResult, stage: AuthorityGateStage): AuthorityGateResult {
  return engine.envelope === undefined
    ? { stage, verdict: engine.verdict, reason: engine.reason }
    : { stage, verdict: engine.verdict, reason: engine.reason, envelope: engine.envelope };
}

interface EngineSegment {
  gates: Gate[];
  /** Mission gate cannot run (transition-bearing action without a target). */
  missionBlockedReason?: string;
  /** Receipt gate must not run: EXECUTE with an empty trusted-key list. */
  receiptBlockedReason?: string;
}

/**
 * Build the contiguous engine gate segment for the requested action. Read-only
 * and steady-state PREPARE actions evaluate no engine gate; APPROVE and
 * EXECUTE require a target status; EXECUTE additionally requires a non-empty
 * trusted-key list (the `ReceiptGate` is never invoked with embedded-key
 * self-trust).
 */
function engineSegmentFor(action: ActionFamily, input: AuthorityGateInput): EngineSegment {
  if (READ_ONLY_FAMILIES.has(action)) {
    return { gates: [] };
  }
  if (action === ACTION_FAMILY.PREPARE_CANDIDATE) {
    if (input.targetStatus === undefined) {
      return { gates: [] };
    }
    return { gates: [new MissionStateGate()] };
  }
  // APPROVE and EXECUTE_TARGET are transition-bearing.
  if (input.targetStatus === undefined) {
    return {
      gates: [],
      missionBlockedReason: `targetStatus required for ${action} — the mission gate cannot guess a transition target`,
    };
  }
  const gates: Gate[] = [new MissionStateGate(), new ApprovalGate()];
  if (action === ACTION_FAMILY.APPROVE) {
    return { gates };
  }
  if (input.trustedKeys.length === 0) {
    return {
      gates,
      receiptBlockedReason:
        "receipt gate requires a non-empty trustedKeys list — embedded-key self-trust is never accepted",
    };
  }
  gates.push(new ReceiptGate());
  return { gates };
}

/**
 * Run the fixed-order authority pipeline (REQ-AUTH-008; design §5.3):
 * scope → mode → materiality → mission → approval → receipt. The first
 * non-allowed verdict stops evaluation; `not_applicable` stages are recorded
 * without stopping. The engine gates run through the engine `GateRunner` for
 * the contiguous engine segment, and engine `needs_input` verdicts are
 * preserved without weakening.
 */
export async function runAuthorityPipeline(
  input: AuthorityGateInput,
): Promise<readonly AuthorityGateResult[]> {
  const results: AuthorityGateResult[] = [];

  const scopeResult = evaluateScopeStage(input);
  results.push(scopeResult);
  if (isNonAllowed(scopeResult.verdict)) return results;

  const modeResult = evaluateModeStage(input);
  results.push(modeResult);
  if (isNonAllowed(modeResult.verdict)) return results;

  const materialityResult = evaluateMaterialityStage(input);
  results.push(materialityResult);
  if (isNonAllowed(materialityResult.verdict)) return results;

  const derivedMateriality =
    materialityResult.verdict === "allowed"
      ? (materialityResult.envelope as { materiality?: Materiality } | undefined)
          ?.materiality
      : undefined;

  const segment = engineSegmentFor(input.action, input);
  if (segment.missionBlockedReason !== undefined) {
    results.push(result("mission", "blocked", segment.missionBlockedReason));
    return results;
  }

  if (segment.gates.length === 0) {
    // Read-only or steady-state PREPARE: no engine segment applies.
    const readOnly = READ_ONLY_FAMILIES.has(input.action);
    results.push(
      result(
        "mission",
        "not_applicable",
        readOnly
          ? "read-only action evaluates no mission transition"
          : "steady-state PREPARE evaluates no mission transition",
      ),
      result("approval", "not_applicable", "no approval decision is evaluated here"),
      result("receipt", "not_applicable", "no receipt is evaluated here"),
    );
    return results;
  }

  const engineContext: GateContext = {
    mission: input.mission,
    targetStatus: input.targetStatus,
    materiality: derivedMateriality,
    approval: input.approvals,
    receipt: input.approvalReceipt,
    trustedKeys: input.trustedKeys,
  };

  const engineResults = await new GateRunner().run(segment.gates, engineContext);
  for (const engineResult of engineResults) {
    const stage: AuthorityGateStage =
      engineResult.gate === "mission"
        ? "mission"
        : engineResult.gate === "approval"
          ? "approval"
          : "receipt";
    results.push(translateEngineResult(engineResult, stage));
  }

  const lastVerdict = results[results.length - 1]?.verdict;
  if (lastVerdict !== "allowed") {
    // The engine segment stopped on a non-allowed verdict: nothing follows.
    return results;
  }

  // EXECUTE with an empty trusted-key list: mission and approval passed, but
  // the receipt gate is never invoked — the harness blocks instead of falling
  // back to embedded-key self-trust.
  if (segment.receiptBlockedReason !== undefined) {
    results.push(result("receipt", "blocked", segment.receiptBlockedReason));
    return results;
  }

  // Record the stages the action skips, in pipeline order, only when the
  // engine segment fully allowed the action.
  if (input.action === ACTION_FAMILY.PREPARE_CANDIDATE) {
    results.push(
      result("approval", "not_applicable", "PREPARE produces a candidate only; no approval decision here"),
      result("receipt", "not_applicable", "PREPARE produces a candidate only; no receipt yet"),
    );
  } else if (input.action === ACTION_FAMILY.APPROVE) {
    results.push(
      result("receipt", "not_applicable", "the approval receipt is created after approval"),
    );
  }

  return results;
}
