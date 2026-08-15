/**
 * Test fixtures for the Pi routing adapter (pi-sdd-030-routing-adapter).
 *
 * Builds a complete valid `PreflightRequest` (canonical scope binding, mission
 * snapshot, bound authorization, seeded evidence graph, explicit materiality,
 * systems, approval, published `WorkUnitInput`, policy maxima) and an
 * evidence graph with full source → transformation → conclusion → action
 * lineage (evidence-citation skill). The fixture is shared by the preflight,
 * selector, executor, seam, and journey tests.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AccountingException,
  AccountingMissionStatus,
  MissionSnapshot,
} from "drenyra-ai/missions";
import type {
  Candidate,
  Materiality,
  MaterialityInput,
  Sha256Hash,
} from "drenyra-ai";
import {
  AUTHORITY_MODE,
  type CanonicalScope,
} from "../../runtime/context.js";
import {
  bindScope,
  sha256Canonical,
  type ScopeBinding,
} from "../../lib/canonicalization.js";
import { EvidenceGraphStore } from "../../lib/evidence-graph.js";
import {
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
} from "../../lib/evidence-graph.js";
import { makeCanonicalScope, makeMission } from "../helpers/authority-fixtures.js";
import type {
  ActionFamily,
  AuthorizationRecord,
  ExplicitMaterialityRequest,
} from "../../lib/authority-gates.js";
import type {
  PreflightRequest,
  SystemAvailability,
} from "../../lib/routing/types.js";

/** The governing policy pin every fixture request carries. */
export const FIXTURE_POLICY_PIN = {
  id: "policies.v1",
  version: "1.0.0",
  contentHash: "f".repeat(64) as Sha256Hash,
} as const;

/** A deterministic 64-char lowercase hex digest (never a real hash). */
export function digest(seed: string): string {
  return seed.repeat(64).slice(0, 64);
}

/** Materiality input that derives R0: zero reversible PE value. */
export function makeR0MaterialityRequest(): ExplicitMaterialityRequest {
  return {
    input: { value: 0n, reversibility: "reversible", jurisdiction: "PE" },
    minimum: undefined,
  };
}

/** Seed a full source → transformation → conclusion → action evidence graph. */
export async function seedRoutingEvidenceGraph(
  storesRoot: string,
  missionId: string,
): Promise<{ requiredHashes: string[]; terminalNodeIds: string[]; graph: EvidenceGraphStore }> {
  const graph = new EvidenceGraphStore(storesRoot);
  const source = await graph.appendNode({
    id: `${missionId}:src-ledger`,
    missionId,
    nodeKind: EVIDENCE_NODE_KIND.SOURCE,
    payload: { kind: "ledger-source", book: "general-ledger" },
  });
  const transformation = await graph.appendNode({
    id: `${missionId}:t-sum`,
    missionId,
    nodeKind: EVIDENCE_NODE_KIND.TRANSFORMATION,
    payload: { kind: "sum", value: 0n },
  });
  const conclusion = await graph.appendNode({
    id: `${missionId}:c-balanced`,
    missionId,
    nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
    payload: { kind: "balanced", finding: "ledger balances" },
  });
  const action = await graph.appendNode({
    id: `${missionId}:a-report`,
    missionId,
    nodeKind: EVIDENCE_NODE_KIND.ACTION,
    payload: { kind: "report", target: "monthly-close" },
  });
  await graph.appendEdge({
    id: `${missionId}:e1`,
    missionId,
    from: source.id,
    to: transformation.id,
    relation: EVIDENCE_RELATION.DERIVED_FROM,
  });
  await graph.appendEdge({
    id: `${missionId}:e2`,
    missionId,
    from: transformation.id,
    to: conclusion.id,
    relation: EVIDENCE_RELATION.SUPPORTS,
  });
  await graph.appendEdge({
    id: `${missionId}:e3`,
    missionId,
    from: conclusion.id,
    to: action.id,
    relation: EVIDENCE_RELATION.EXECUTES,
  });
  return {
    requiredHashes: [action.payloadHash],
    terminalNodeIds: [action.id],
    graph,
  };
}

/** A complete valid preflight request over a fresh isolated stores root. */
export async function makeRoutingPreflightRequest(
  overrides: Partial<PreflightRequest> = {},
): Promise<{ request: PreflightRequest; storesRoot: string; mission: MissionSnapshot; binding: ScopeBinding; evidence: { requiredHashes: string[]; terminalNodeIds: string[] } }> {
  const storesRoot = mkdtempSync(join(tmpdir(), "pi-routing-fixture-"));
  const scope: CanonicalScope = makeCanonicalScope({
    authorityLevel: AUTHORITY_MODE.EXECUTE,
    actor: "alice",
  });
  const binding = bindScope(scope);
  const mission = makeMission({
    id: `mission-${randomUUID()}`,
    companyId: binding.scope.company,
    fiscalPeriod: binding.scope.fiscalPeriod,
    status: "DRAFT" as AccountingMissionStatus,
    steps: [],
  });
  const evidence = await seedRoutingEvidenceGraph(storesRoot, mission.id);
  const requiredHash = evidence.requiredHashes[0] ?? digest("f");
  const materiality = makeR0MaterialityRequest();
  const authorization: AuthorizationRecord = {
    id: `auth-${mission.id}-query`,
    missionId: mission.id,
    scopeHash: binding.scopeHash,
    authorityMode: binding.scope.authorityLevel,
    actionFamily: "QUERY",
    actorId: binding.scope.actor,
    decision: "GRANTED",
    issuedAt: "2026-07-01T00:00:00.000Z",
  };
  const request: PreflightRequest = {
    binding,
    mission,
    actionFamily: "QUERY" as ActionFamily,
    authorization,
    governingPolicy: { ...FIXTURE_POLICY_PIN },
    requiredEvidenceHashes: evidence.requiredHashes,
    terminalNodeIds: evidence.terminalNodeIds,
    materiality,
    declaredRiskTier: "R0" as Materiality,
    systems: [],
    approval: { required: false },
    evidenceStoresRoot: storesRoot,
    workUnitInput: {
      id: `work-${mission.id}`,
      objective: "Run the monthly-close intake step",
      scope: { tenantId: binding.scope.tenant, ruc: binding.scope.company },
      evidenceAllowed: [
        { algorithm: "sha256", hash: requiredHash as `x${string}` & { readonly __brand: "Sha256Hash" } },
      ],
      skills: [],
      policies: [{ ...FIXTURE_POLICY_PIN }],
      authorizedTools: [
        { id: "chain-pipeline", version: "0.3.0", operations: ["execute-step"] },
      ],
      authorizedDestinations: [
        { kind: "EVIDENCE_STORE", id: "evidence" },
      ],
      outputSchema: {
        id: "monthly-close/intake-output",
        version: "1.0.0",
        contentHash: digest("e") as Sha256Hash,
      },
      successConditions: [
        {
          kind: "EVIDENCE_HASHES_PRESENT",
          required: [requiredHash as `x${string}` & { readonly __brand: "Sha256Hash" }],
        },
      ],
      stopConditions: ["BUDGET_EXHAUSTED"],
    },
    requestedBudgets: {
      timeLimitMs: 60_000,
      tokenLimit: 100_000,
      costLimitCents: 1_000_000n,
      researchAttempts: 3,
      correctionAttempts: 1,
    },
    policyMax: {
      maxCostLimitCents: 2_000_000n,
      maxTimeLimitMs: 120_000,
      maxTokenLimit: 200_000,
    },
  };
  return { request: { ...request, ...overrides }, storesRoot, mission, binding, evidence };
}

/** A candidate matching the fixture scope (subjectHash computed over its payload). */
export function makeRoutingCandidate(mission: MissionSnapshot): Candidate {
  const subjectPayload = { action: "monthly-close-report", missionId: mission.id };
  return {
    id: `cand-${mission.id}`,
    subjectHash: sha256Canonical(subjectPayload),
    scope: { ruc: mission.companyId, period: mission.fiscalPeriod },
    materiality: "R0",
    status: "proposed",
    reviews: [],
    corrections: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    version: 1,
  };
}

/** The materiality basis carried with a candidate (the preflight input). */
export function makeRoutingMaterialityBasis(): MaterialityInput {
  return { value: 0n, reversibility: "reversible", jurisdiction: "PE" };
}

/** A well-formed WAIT accounting exception for the seam tests. */
export function makeWaitException(missionId: string, refs: string[]): AccountingException {
  return {
    id: `exc-wait-${missionId}`,
    missionId,
    code: "WAIT_REQUIRED",
    severity: "WARNING",
    subjectRef: missionId,
    evidenceRefs: refs,
    resolutionStatus: "HUMAN_INPUT_REQUIRED",
  };
}

/** A typed system availability declaration. */
export function makeSystemAvailability(
  systemId: string,
  available: boolean,
  overrides: Partial<SystemAvailability> = {},
): SystemAvailability {
  return { systemId, available, ...overrides };
}
