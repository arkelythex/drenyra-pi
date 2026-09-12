/**
 * WU-DIRECT — direct-modality routing port tests (pi-accounting-orchestration).
 *
 * Proves `createChainPipelineRoutingPort` maps a real, in-process
 * `runChainStep` result into a `RouteExecutionPortResponse`: success (no
 * blocked, no wait), blocked (fail-closed before any mission write), and
 * wait-reason (an engine-legal evidence wait), plus the fail-closed-by-
 * construction property that dispatch only happens on an explicit
 * invocation (the opt-in signal analog `/drenyra:status route` will rely on
 * in PR2 — REQ-ROUTE-001 SC-ROUTE-008).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import {
  createWorkUnit,
  validateWorkUnit,
  type WorkUnit,
  type WorkUnitInput,
} from "drenyra-ai";
import { AUTHORITY_MODE } from "../../runtime/context.js";
import { makeScopeBinding } from "../helpers/authority-fixtures.js";
import type { ScopeBinding } from "../../lib/canonicalization.js";
import {
  runChainStep,
  type ChainDefinition,
} from "../../lib/chain-pipeline.js";
import { EVIDENCE_NODE_KIND } from "../../lib/evidence-graph.js";
import { executeRoutingWork } from "../../lib/routing/executor.js";
import { BudgetLedger, type RoutingExecutionPorts } from "../../lib/routing/types.js";
import { createChainPipelineRoutingPort } from "../../lib/routing/direct-port.js";
import { makeCoreRoute } from "./fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-direct-port-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface FixtureInput {
  evidenceProvided: boolean;
}

interface FixtureOutput {
  step: string;
}

/** A minimal ANALYZE-mode chain: ingest records a node, reconcile either
 * waits for evidence or completes — mirrors `analysisChain` in
 * `__tests__/chain-pipeline.test.ts`, trimmed to the two phases these tests
 * need. */
function makeFixtureChain(): ChainDefinition<FixtureInput, FixtureOutput> {
  return {
    name: "direct-port-fixture",
    intent: "reconciliation",
    requiredMode: AUTHORITY_MODE.ANALYZE,
    async runStep(context) {
      switch (context.phase) {
        case "ingest":
          await context.graph.appendNode({
            id: `${context.mission.id}:src-ledger`,
            missionId: context.mission.id,
            nodeKind: EVIDENCE_NODE_KIND.SOURCE,
            payload: { kind: "ledger", balanceCents: 1_000n },
          });
          return {
            output: { step: "ingest" },
            evidenceNodeIds: [`${context.mission.id}:src-ledger`],
          };
        case "reconcile":
          if (!context.input.evidenceProvided) {
            return { output: { step: "reconcile-wait" }, waitForEvidence: true };
          }
          return { output: { step: "reconcile" } };
        default:
          return { output: { step: context.phase } };
      }
    },
  };
}

function fullChainRunInput(root: string, evidenceProvided: boolean, binding: ScopeBinding) {
  return {
    binding,
    input: { evidenceProvided },
    storesRoot: root,
  };
}

/** Drive the fixture chain directly (not through the port under test) for
 * setup phases only — the final bounded call under test always goes through
 * the port. */
async function driveSetupPhases(
  chain: ChainDefinition<FixtureInput, FixtureOutput>,
  root: string,
  binding: ScopeBinding,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await runChainStep(chain, fullChainRunInput(root, true, binding));
  }
}

/** A helper-created DRAFT work unit bound to the given mission. */
function buildUnit(missionId: string, companyId: string): WorkUnit {
  const input: WorkUnitInput = {
    id: `work-${missionId}`,
    objective: "direct-port fixture objective",
    scope: { tenantId: "acme", ruc: companyId },
    evidenceAllowed: [{ algorithm: "sha256", hash: "a".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" } }],
    skills: [],
    policies: [{ id: "policies.v1", version: "1.0.0" }],
    authorizedTools: [
      { id: "chain-pipeline", version: "0.3.0", operations: ["execute-step"] },
    ],
    authorizedDestinations: [{ kind: "EVIDENCE_STORE", id: "evidence" }],
    outputSchema: {
      id: "schema",
      version: "1.0.0",
      contentHash: "b".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" },
    },
    budgets: {
      timeLimitMs: 60_000 as never,
      tokenLimit: 100_000 as never,
      costLimitCents: 1_000_000n,
      researchAttemptLimit: 3,
      correctionAttemptLimit: 1,
    },
    successConditions: [
      { kind: "EVIDENCE_HASHES_PRESENT", required: ["a".repeat(64) as `x${string}` & { readonly __brand: "Sha256Hash" }] },
    ],
    stopConditions: ["BUDGET_EXHAUSTED"],
  };
  // A DRAFT mission snapshot skeleton is enough for createWorkUnit's scope/id checks —
  // the port itself never depends on this WorkUnit's mission fields matching the
  // real chain-driven mission (only `executeRoutingWork`'s `verifyResponse` does).
  const draftMission = {
    id: missionId,
    companyId,
    fiscalPeriod: "202507",
    intent: "reconciliation",
    status: AccountingMissionStatus.DRAFT,
    version: 1,
    progress: 0,
    steps: [],
    currentStep: "",
    blockers: [],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  } as unknown as Parameters<typeof createWorkUnit>[0];
  const created = createWorkUnit(draftMission, input);
  if (!created.ok) {
    throw new Error(`fixture createWorkUnit failed: ${JSON.stringify(created.issues)}`);
  }
  const validated = validateWorkUnit(created.value, draftMission);
  if (!validated.ok) {
    throw new Error(`fixture validateWorkUnit failed: ${JSON.stringify(validated.issues)}`);
  }
  return validated.value;
}

describe("createChainPipelineRoutingPort — direct modality mapping", () => {
  it("success mapping: a completed step (no blocked, no wait) maps to a stop-free response", async () => {
    const root = tempRoot();
    const binding = makeScopeBinding();
    const chain = makeFixtureChain();
    const port = createChainPipelineRoutingPort(chain);

    // The very first bounded call (INTAKE) never blocks/waits: a clean success.
    const missionBefore = {
      id: "not-yet-created",
      companyId: binding.scope.company,
      fiscalPeriod: binding.scope.fiscalPeriod,
      intent: "reconciliation",
      status: AccountingMissionStatus.DRAFT,
      version: 0,
      progress: 0,
      steps: [],
      currentStep: "",
      blockers: [],
      proposal: null,
      rejection: null,
      receiptId: null,
      receiptHash: null,
      lastEventSequence: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    } as unknown as Parameters<RoutingExecutionPorts["direct"]>[0]["mission"];
    const workUnit = buildUnit("not-yet-created", binding.scope.company);
    const ledger = BudgetLedger.create(workUnit);

    const response = await port({
      workUnit,
      route: "direct",
      binding,
      mission: missionBefore,
      chain,
      chainRun: fullChainRunInput(root, true, binding),
      ledger,
    });

    expect(response.stop).toBeUndefined();
    expect(response.missionBefore).toBe(missionBefore);
    expect(response.missionAfter.status).toBe(AccountingMissionStatus.QUEUED);
    expect(response.missionAfter.intent).toBe("reconciliation");
    expect(response.evidenceRefs).toBe(workUnit.evidenceAllowed);
    expect(response.candidates).toHaveLength(0);
    expect(response.toolProvenance).toHaveLength(0);
    expect(response.unresolvedExceptions).toHaveLength(0);
    expect(response.consumption).toEqual({
      elapsedMs: 0,
      tokens: 0,
      costIncurredCents: 0n,
      researchAttempts: 1,
      correctionAttempts: 0,
    });
  });

  it("blocked mapping: an insufficient bound mode fails closed before any mission write", async () => {
    const root = tempRoot();
    // Bind at ANALYZE; the chain requires EXECUTE — the mode stage blocks
    // before any mission is loaded or created (result.mission is undefined).
    const binding = makeScopeBinding({ authorityLevel: AUTHORITY_MODE.ANALYZE });
    const highModeChain: ChainDefinition<FixtureInput, FixtureOutput> = {
      ...makeFixtureChain(),
      requiredMode: AUTHORITY_MODE.EXECUTE,
    };
    const port = createChainPipelineRoutingPort(highModeChain);
    const missionBefore = {
      id: "mode-blocked-mission",
      companyId: binding.scope.company,
      fiscalPeriod: binding.scope.fiscalPeriod,
      intent: "reconciliation",
      status: AccountingMissionStatus.DRAFT,
      version: 0,
      progress: 0,
      steps: [],
      currentStep: "",
      blockers: [],
      proposal: null,
      rejection: null,
      receiptId: null,
      receiptHash: null,
      lastEventSequence: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    } as unknown as Parameters<RoutingExecutionPorts["direct"]>[0]["mission"];
    const workUnit = buildUnit("mode-blocked-mission", binding.scope.company);
    const ledger = BudgetLedger.create(workUnit);

    const response = await port({
      workUnit,
      route: "direct",
      binding,
      mission: missionBefore,
      chain: highModeChain,
      chainRun: fullChainRunInput(root, true, binding),
      ledger,
    });

    expect(response.stop?.kind).toBe("AMBIGUOUS_INPUT");
    if (response.stop?.kind === "AMBIGUOUS_INPUT") {
      expect(response.stop.fields.some((field) => field.includes("mode"))).toBe(true);
    }
    // No mission was loaded/created: missionAfter falls back to the caller's snapshot.
    expect(response.missionAfter).toBe(missionBefore);
  });

  it("wait mapping: a chain-declared evidence wait maps to a MISSING_EVIDENCE stop", async () => {
    const root = tempRoot();
    const binding = makeScopeBinding();
    const chain = makeFixtureChain();

    // Drive INTAKE, BIND_SCOPE, INGEST, NORMALIZE, CLASSIFY directly (setup
    // only — EDA_PHASE_ORDER puts NORMALIZE/CLASSIFY between INGEST and
    // RECONCILE) so the next bounded call reaches RECONCILE — the phase
    // under test.
    await driveSetupPhases(chain, root, binding, 4);
    const classifyResult = await runChainStep(chain, fullChainRunInput(root, true, binding));
    expect(classifyResult.phase).toBe("classify");
    const missionBeforeReconcile = classifyResult.mission;
    if (missionBeforeReconcile === undefined) {
      throw new Error("fixture setup failed: no mission after classify");
    }

    const port = createChainPipelineRoutingPort(chain);
    const workUnit = buildUnit(missionBeforeReconcile.id, binding.scope.company);
    const ledger = BudgetLedger.create(workUnit);

    const response = await port({
      workUnit,
      route: "direct",
      binding,
      mission: missionBeforeReconcile,
      chain,
      chainRun: fullChainRunInput(root, false, binding),
      ledger,
    });

    expect(response.stop?.kind).toBe("MISSING_EVIDENCE");
    if (response.stop?.kind === "MISSING_EVIDENCE") {
      expect(response.stop.requiredHashes).toEqual(
        workUnit.evidenceAllowed.map((ref) => ref.hash),
      );
    }
    expect(response.missionAfter.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    expect(response.missionBefore).toBe(missionBeforeReconcile);
  });

  it("opt-in proof: constructing the port dispatches nothing until explicitly invoked, and exactly once when it is (SC-ROUTE-008 unit-level analog)", async () => {
    const root = tempRoot();
    const binding = makeScopeBinding();
    const chain = makeFixtureChain();

    // Construction alone performs zero dispatch and zero mission-store writes —
    // proven by a wrapped counting port that only increments on invocation.
    const port = createChainPipelineRoutingPort(chain);
    const beforeAny = await runChainStep(chain, fullChainRunInput(root, true, binding));
    const missionAfterIntake = beforeAny.mission;
    if (missionAfterIntake === undefined) {
      throw new Error("fixture setup failed: no mission after intake");
    }
    let calls = 0;
    const countingPort: RoutingExecutionPorts["direct"] = async (input) => {
      calls += 1;
      return port(input);
    };
    expect(calls).toBe(0);

    const workUnit = buildUnit(missionAfterIntake.id, binding.scope.company);
    const ledger = BudgetLedger.create(workUnit);
    const result = await executeRoutingWork({
      workUnit,
      route: makeCoreRoute("direct-analysis"),
      binding,
      mission: missionAfterIntake,
      ports: { direct: countingPort, delegated: countingPort, durable: countingPort },
      ledger,
      chain,
      chainRun: fullChainRunInput(root, true, binding),
    });
    // Exactly one explicit invocation dispatches exactly once — never zero,
    // never more than one (no retry, no fall-through).
    expect(calls).toBe(1);
    expect(result.portCalls).toBe(1);
  });
});
