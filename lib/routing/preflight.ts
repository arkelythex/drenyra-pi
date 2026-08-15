/**
 * Seven-stage preflight (pi-sdd-030-routing-adapter; design D2 §4).
 *
 * `runRoutingPreflight(request)` evaluates the fixed stages in order — canonical
 * scope, permissions, evidence, materiality, reversibility, systems, approval —
 * and stops at the first failure, writing nothing. After stage 7, budgets are
 * normalized and the published `createWorkUnit` + `validateWorkUnit` helpers
 * build and revalidate the bounded `WorkUnit`.
 *
 * Authority boundary: materiality comes ONLY from `deriveRequiredMateriality`
 * (which delegates the tier to the kernel `deriveMateriality`); permission
 * sufficiency comes ONLY from `requiredModeFor` + `assertMonotonicAuthority`
 * and the bound authorization; evidence integrity comes ONLY from the
 * `EvidenceGraphStore`; approvals are never granted. The only emitted stop
 * kinds are the nine published `WorkStopReason` literals; an already-UNKNOWN
 * mission or a malformed identity is `AMBIGUOUS_INPUT` + a `MISSION_UNKNOWN`
 * exception at execution time, never an invented stop kind.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { createWorkUnit, parseSha256Hash, toJsonInteger, validateWorkUnit, type JsonInteger, type MissionIntent, type Sha256Hash, type VersionPin, type WorkBudgets, type WorkScope, type WorkUnitInput } from "drenyra-ai";
import {
  assertMonotonicAuthority,
  deriveRequiredMateriality,
  requiredModeFor,
  type ExplicitMaterialityRequest,
} from "../authority-gates.js";
import {
  bindScope,
  validateCanonicalScope,
} from "../canonicalization.js";
import { EvidenceGraphStore } from "../evidence-graph.js";
import { EDA_INTENTS } from "../mission-commands.js";
import type {
  RoutingReversibility,
  PreflightRequest,
  PreflightResult,
  RiskBand,
  SystemAvailability,
} from "./types.js";

const WORK_SCOPE_KEYS: readonly (keyof WorkScope)[] = [
  "tenantId",
  "ruc",
  "companyId",
  "companyName",
  "period",
  "intent",
];

/** Canonical element → WorkScope key projection (the five mappable ones). */
const CANONICAL_TO_WORK_SCOPE: Readonly<Record<string, keyof WorkScope>> = {
  tenant: "tenantId",
  company: "ruc",
  fiscalPeriod: "period",
};

const REVERSIBILITY_MAP: Readonly<
  Record<string, RoutingReversibility>
> = {
  reversible: "REVERSIBLE",
  "partially-reversible": "PARTIALLY_REVERSIBLE",
  irreversible: "IRREVERSIBLE",
};
    
/** Stage 1 — canonical scope: validation, recompute, mission, projection. */
function stageScope(request: PreflightRequest): PreflightResult | undefined {
  const { binding, mission } = request;
  const validation = validateCanonicalScope(binding.scope);
  if (!validation.valid) {
    const mappable: (keyof WorkScope)[] = [];
    const opaque: string[] = [];
    for (const error of validation.errors) {
      const element = error.split(":")[0]?.trim() ?? "";
      const mapped = CANONICAL_TO_WORK_SCOPE[element];
      if (mapped !== undefined) {
        mappable.push(mapped);
      } else if (element.length > 0) {
        opaque.push(element);
      }
    }
    if (opaque.length > 0) {
      return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: opaque } };
    }
    if (mappable.length > 0) {
      return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: [...new Set(mappable)] } };
    }
    return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: ["binding.scope"] } };
  }

  let recomputed: ReturnType<typeof bindScope>;
  try {
    recomputed = bindScope(binding.scope);
  } catch {
    return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: ["binding.scope"] } };
  }
  if (
    recomputed.canonical !== binding.canonical ||
    recomputed.scopeHash !== binding.scopeHash
  ) {
    const mappable: (keyof WorkScope)[] = [];
    const opaque: string[] = [];
    // Compare the recomputed scope against the ORIGINAL canonical bytes so a
    // mutated binding scope is still measured against the bound identity.
    let original: Record<string, unknown>;
    try {
      original = JSON.parse(binding.canonical) as Record<string, unknown>;
    } catch {
      return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: ["binding.canonical"] } };
    }
    for (const element of Object.keys(recomputed.scope)) {
      const before = original[element];
      const after = recomputed.scope[element as keyof typeof recomputed.scope];
      if (before !== after) {
        const mapped = CANONICAL_TO_WORK_SCOPE[element];
        if (mapped === undefined) {
          opaque.push(element);
        } else {
          mappable.push(mapped);
        }
      }
    }
    if (opaque.length > 0) {
      return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: opaque } };
    }
    if (mappable.length > 0) {
      return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: [...new Set(mappable)] } };
    }
    // The canonical bytes/hash mismatch with no differing element: the binding's
    // hash field itself is stale or forged — not expressible by WorkScope keys.
    return { ok: false, stage: "scope", reason: { kind: "AMBIGUOUS_INPUT", fields: ["binding.scopeHash"] } };
  }

  if (binding.scope.company !== mission.companyId) {
    return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: ["companyId"] } };
  }
  if (binding.scope.fiscalPeriod !== mission.fiscalPeriod) {
    return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: ["period"] } };
  }
  if (request.workUnitInput.scope.tenantId !== binding.scope.tenant) {
    return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: ["tenantId"] } };
  }
  if (request.workUnitInput.scope.ruc !== binding.scope.company) {
    return { ok: false, stage: "scope", reason: { kind: "SCOPE_MISMATCH", fields: ["ruc"] } };
  }
  return undefined;
}

/** Stage 2 — permissions: required mode + bound authorization + monotonicity. */
function stagePermissions(request: PreflightRequest): PreflightResult | undefined {
  const { governingPolicy, authorization, mission, binding, actionFamily } = request;
  if (
    typeof governingPolicy.id !== "string" ||
    governingPolicy.id.trim().length === 0 ||
    typeof governingPolicy.version !== "string" ||
    governingPolicy.version.trim().length === 0
  ) {
    return { ok: false, stage: "permissions", reason: { kind: "AMBIGUOUS_INPUT", fields: ["governingPolicy"] } };
  }
      const policyPin: VersionPin =
        governingPolicy.contentHash === undefined
          ? { id: governingPolicy.id, version: governingPolicy.version }
          : {
              id: governingPolicy.id,
              version: governingPolicy.version,
              contentHash: governingPolicy.contentHash as Sha256Hash,
            };
  const required = requiredModeFor(actionFamily);
  const denied = (reason: string): PreflightResult => {
    void reason;
    return { ok: false, stage: "permissions", reason: { kind: "POLICY_BLOCKED", policy: policyPin } };
  };
  if (authorization.decision !== "GRANTED") return denied("authorization not GRANTED");
  if (authorization.missionId !== mission.id) return denied("authorization bound to another mission");
  if (authorization.scopeHash !== binding.scopeHash) return denied("authorization bound to another scope");
  if (authorization.actorId !== binding.scope.actor) return denied("authorization actor mismatch");
  if (authorization.actionFamily !== actionFamily) return denied("authorization family mismatch");
  if (
    authorization.expiresAt !== undefined &&
    Date.parse(authorization.expiresAt) <= Date.now()
  ) {
    return denied("authorization expired");
  }
  try {
    assertMonotonicAuthority(authorization.authorityMode, required);
  } catch {
    return denied("bound authority mode below the required mode");
  }
  return undefined;
}

/** Stage 3 — evidence availability and integrity (hash-valid, lineage, grounded). */
async function stageEvidence(
  request: PreflightRequest,
): Promise<PreflightResult | undefined> {
  const hashes: Sha256Hash[] = [];
  for (const candidate of request.requiredEvidenceHashes) {
    const parsed = parseSha256Hash(candidate);
    if (!parsed.ok) {
      return {
        ok: false,
        stage: "evidence",
        reason: { kind: "AMBIGUOUS_INPUT", fields: ["requiredEvidenceHashes"] },
      };
    }
    hashes.push(parsed.value);
  }
  const graph = new EvidenceGraphStore(request.evidenceStoresRoot);
  const missing = (): PreflightResult => ({
    ok: false,
    stage: "evidence",
    reason: { kind: "MISSING_EVIDENCE", requiredHashes: hashes },
  });
  let validation: Awaited<ReturnType<EvidenceGraphStore["validate"]>>;
  try {
    validation = await graph.validate(request.mission.id);
  } catch {
    return missing();
  }
  if (!validation.valid) return missing();
  for (const terminalId of request.terminalNodeIds) {
    try {
      await graph.lineage(request.mission.id, terminalId);
    } catch {
      return missing();
    }
  }
  let loaded: Awaited<ReturnType<EvidenceGraphStore["load"]>>;
  try {
    loaded = await graph.load(request.mission.id);
  } catch {
    return missing();
  }
  const present = new Set(loaded.nodes.map((node) => node.payloadHash));
  for (const hash of hashes) {
    if (!present.has(hash)) return missing();
  }
  return undefined;
}

/** Stage 4 — risk/materiality: delegated derivation, no R0 default, no conflict. */
function stageMateriality(request: PreflightRequest): PreflightResult | undefined {
  const intent = request.mission.intent;
  if (!(EDA_INTENTS as readonly string[]).includes(intent)) {
    return {
      ok: false,
      stage: "materiality",
      reason: { kind: "UNSUPPORTED_WORK", intent: intent as MissionIntent },
    };
  }
  let tier: import("drenyra-ai").Materiality;
  try {
    tier = deriveRequiredMateriality(request.materiality as ExplicitMaterialityRequest);
  } catch {
    return {
      ok: false,
      stage: "materiality",
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["materiality.input"] },
    };
  }
  if (request.declaredRiskTier !== undefined && request.declaredRiskTier !== tier) {
    return {
      ok: false,
      stage: "materiality",
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["declaredRiskTier"] },
    };
  }
  return undefined;
}

/** Stage 5 — reversibility projection (validated materiality input). */
function stageReversibility(request: PreflightRequest): PreflightResult | undefined {
  const input = request.materiality.input;
  const mapped = REVERSIBILITY_MAP[input.reversibility];
  if (mapped === undefined) {
    return {
      ok: false,
      stage: "reversibility",
      reason: { kind: "AMBIGUOUS_INPUT", fields: ["materiality.input.reversibility"] },
    };
  }
  if (
    request.declaredReversibility !== undefined &&
    request.declaredReversibility !== mapped
  ) {
    return {
      ok: false,
      stage: "reversibility",
      reason: {
        kind: "AMBIGUOUS_INPUT",
        fields: ["materiality.input.reversibility", "declaredReversibility"],
      },
    };
  }
  return undefined;
}

/** Stage 6 — systems availability and allow-list cross-check. */
function stageSystems(
  request: PreflightRequest,
  workUnitInput: WorkUnitInput,
): PreflightResult | undefined {
  const systems = request.systems as readonly SystemAvailability[];
  for (let index = 0; index < systems.length; index += 1) {
    const system = systems[index] ?? { systemId: "", available: false };
    if (typeof system.systemId !== "string" || system.systemId.trim().length === 0) {
      return {
        ok: false,
        stage: "systems",
        reason: { kind: "AMBIGUOUS_INPUT", fields: [`systems[${index}].systemId`] },
      };
    }
    if (typeof system.available !== "boolean") {
      return {
        ok: false,
        stage: "systems",
        reason: { kind: "AMBIGUOUS_INPUT", fields: [`systems[${index}].available`] },
      };
    }
    if (!system.available) {
      return {
        ok: false,
        stage: "systems",
        reason: { kind: "EXTERNAL_SYSTEM_UNAVAILABLE", systemId: system.systemId },
      };
    }
    for (const op of system.requiredToolOperations ?? []) {
      const tool = workUnitInput.authorizedTools.find(
        (candidate) => candidate.id === op.toolId,
      );
      if (tool === undefined || !tool.operations.includes(op.operation)) {
        return {
          ok: false,
          stage: "systems",
          reason: {
            kind: "AMBIGUOUS_INPUT",
            fields: [`systems[${index}].requiredToolOperations`],
          },
        };
      }
    }
    for (const destinationId of system.requiredDestinationIds ?? []) {
      if (
        !workUnitInput.authorizedDestinations.some(
          (destination) => destination.id === destinationId,
        )
      ) {
        return {
          ok: false,
          stage: "systems",
          reason: {
            kind: "AMBIGUOUS_INPUT",
            fields: [`systems[${index}].requiredDestinationIds`],
          },
        };
      }
    }
  }
  return undefined;
}

/** Stage 7 — approval: verify applicability + bound evidence; never grant. */
function stageApproval(
  request: PreflightRequest,
): { result?: PreflightResult; approvalRequired?: Extract<PreflightResult, { ok: true }>["approvalRequired"] } {
  const approval = request.approval;
  if (typeof approval.required !== "boolean") {
    return {
      result: {
        ok: false,
        stage: "approval",
        reason: { kind: "AMBIGUOUS_INPUT", fields: ["approval.required"] },
      },
    };
  }
  if (!approval.required) {
    return {};
  }
  if (
    typeof approval.approvalType !== "string" ||
    approval.approvalType.trim().length === 0
  ) {
    return {
      result: {
        ok: false,
        stage: "approval",
        reason: { kind: "AMBIGUOUS_INPUT", fields: ["approval.approvalType"] },
      },
    };
  }
  const approvalRequired = {
    kind: "APPROVAL_REQUIRED" as const,
    approvalType: approval.approvalType,
  };
  return { approvalRequired };
}

/** Normalize requested budgets against explicit policy maxima (design §5). */
function normalizeBudgets(
  requested: PreflightRequest["requestedBudgets"],
  policyMax: PreflightRequest["policyMax"],
): { ok: true; budgets: WorkBudgets } | { ok: false; fields: string[] } {
  const fields: string[] = [];
  if (!Number.isSafeInteger(requested.timeLimitMs) || requested.timeLimitMs < 0) {
    fields.push("requestedBudgets.timeLimitMs");
  }
  if (!Number.isSafeInteger(requested.tokenLimit) || requested.tokenLimit < 0) {
    fields.push("requestedBudgets.tokenLimit");
  }
  if (typeof requested.costLimitCents !== "bigint" || requested.costLimitCents < 0n) {
    fields.push("requestedBudgets.costLimitCents");
  }
  if (!Number.isSafeInteger(requested.researchAttempts) || requested.researchAttempts < 1) {
    fields.push("requestedBudgets.researchAttempts");
  }
  if (!Number.isSafeInteger(requested.correctionAttempts) || requested.correctionAttempts < 1) {
    fields.push("requestedBudgets.correctionAttempts");
  }
  if (typeof policyMax.maxCostLimitCents !== "bigint" || policyMax.maxCostLimitCents < 0n) {
    fields.push("policyMax.maxCostLimitCents");
  }
  if (!Number.isSafeInteger(policyMax.maxTimeLimitMs) || policyMax.maxTimeLimitMs < 0) {
    fields.push("policyMax.maxTimeLimitMs");
  }
  if (!Number.isSafeInteger(policyMax.maxTokenLimit) || policyMax.maxTokenLimit < 0) {
    fields.push("policyMax.maxTokenLimit");
  }
  if (fields.length > 0) return { ok: false, fields };

  const research = Math.min(requested.researchAttempts, 3);
  const researchAttemptLimit = research as WorkBudgets["researchAttemptLimit"];
  const timeMs = Math.min(requested.timeLimitMs, policyMax.maxTimeLimitMs);
  const tokens = Math.min(requested.tokenLimit, policyMax.maxTokenLimit);
  const cost = requested.costLimitCents < policyMax.maxCostLimitCents
    ? requested.costLimitCents
    : policyMax.maxCostLimitCents;
  const timeInteger = toJsonInteger(timeMs);
  const tokenInteger = toJsonInteger(tokens);
  if (!timeInteger.ok || !tokenInteger.ok) {
    return { ok: false, fields: ["requestedBudgets.timeLimitMs", "requestedBudgets.tokenLimit"] };
  }
  return {
    ok: true,
    budgets: {
      timeLimitMs: timeInteger.value as JsonInteger,
      tokenLimit: tokenInteger.value as JsonInteger,
      costLimitCents: cost,
      researchAttemptLimit,
      correctionAttemptLimit: 1,
    },
  };
}

/** Project published-helper issues to typed stop reasons (no invented kind). */
function projectHelperIssues(
  issues: readonly { code: string; path: string }[],
  requiredHashes: readonly Sha256Hash[],
): PreflightResult {
  const paths = issues.map((issue) => issue.path);
  const scopePaths = paths.filter((path) => path.startsWith("scope."));
  const workScopeFields = scopePaths
    .map((path) => path.slice("scope.".length))
    .filter((field): field is keyof WorkScope =>
      (WORK_SCOPE_KEYS as readonly string[]).includes(field),
    );
  const hasScopeOrMissionIssue = issues.some(
    (issue) => issue.code === "MISSION_MISMATCH" || issue.code === "INVALID_SCOPE",
  );
  if (hasScopeOrMissionIssue && workScopeFields.length > 0) {
    return {
      ok: false,
      stage: "workunit",
      reason: { kind: "SCOPE_MISMATCH", fields: [...new Set(workScopeFields)] },
    };
  }
  const hasHashIssue = issues.some((issue) => issue.code === "INVALID_HASH");
  if (hasHashIssue && requiredHashes.length > 0) {
    return {
      ok: false,
      stage: "workunit",
      reason: { kind: "MISSING_EVIDENCE", requiredHashes: [...requiredHashes] },
    };
  }
  return { ok: false, stage: "workunit", reason: { kind: "AMBIGUOUS_INPUT", fields: paths } };
}

/**
 * Run the seven-stage preflight in fixed order and produce a bounded,
 * helper-validated `WorkUnit` only when every stage passes. Writes nothing.
 */
export async function runRoutingPreflight(
  request: PreflightRequest,
): Promise<PreflightResult> {
  const scopeResult = stageScope(request);
  if (scopeResult !== undefined) return scopeResult;

  const permissionResult = stagePermissions(request);
  if (permissionResult !== undefined) return permissionResult;

  const evidenceResult = await stageEvidence(request);
  if (evidenceResult !== undefined) return evidenceResult;

  const materialityResult = stageMateriality(request);
  if (materialityResult !== undefined) return materialityResult;

  const tier = deriveRequiredMateriality(request.materiality as ExplicitMaterialityRequest);
  const riskBand: RiskBand = tier === "R0" || tier === "R1" ? "R0_R1" : "R2_R3";

  const reversibilityResult = stageReversibility(request);
  if (reversibilityResult !== undefined) return reversibilityResult;

  const reversibility = REVERSIBILITY_MAP[request.materiality.input.reversibility];

  const unitFields = request.workUnitInput;

  const systemsResult = stageSystems(request, unitFields as WorkUnitInput);
  if (systemsResult !== undefined) return systemsResult;

  const approval = stageApproval(request);
  if (approval.result !== undefined) return approval.result;

  const baseStopConditions = [...unitFields.stopConditions];
  if (baseStopConditions.length === 0) {
    baseStopConditions.push("BUDGET_EXHAUSTED");
  }
  if (approval.approvalRequired !== undefined) {
    baseStopConditions.push("APPROVAL_REQUIRED");
  }

  const budgetsResult = normalizeBudgets(request.requestedBudgets, request.policyMax);
  if (!budgetsResult.ok) {
    return { ok: false, stage: "workunit", reason: { kind: "AMBIGUOUS_INPUT", fields: budgetsResult.fields } };
  }
  const workUnitInput: WorkUnitInput = {
    ...unitFields,
    stopConditions: baseStopConditions,
    budgets: budgetsResult.budgets,
  };

  const created = createWorkUnit(request.mission, workUnitInput);
  if (!created.ok) {
    return projectHelperIssues(created.issues, request.requiredEvidenceHashes as Sha256Hash[]);
  }
  const validated = validateWorkUnit(created.value, request.mission);
  if (!validated.ok) {
    return projectHelperIssues(validated.issues, request.requiredEvidenceHashes as Sha256Hash[]);
  }

  return {
    ok: true,
    workUnit: validated.value,
    riskTier: tier,
    riskBand,
    evidenceSufficiency: "SUFFICIENT",
    reversibility,
    approvalRequired: approval.approvalRequired,
  };
}
