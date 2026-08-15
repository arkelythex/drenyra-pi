/**
 * WU4 — durable mission routing seam tests (pi-sdd-030-routing-adapter; design
 * D5 §7, D6 §8). Proves the ONE exported adapter function
 * `createDurableMissionRoutingPort` drives the existing `EdaMissionCoordinator`
 * with EXACTLY ONE `RUN`/`SKIP`/`WAIT` decision per invocation: one continue
 * call executes one step derived from persisted state only; WAIT and authority
 * denial perform no write and never loop; UNKNOWN yields no prepared step and is
 * reported as a typed `AMBIGUOUS_INPUT` adapter stop plus a `MISSION_UNKNOWN`
 * exception; no synthetic tool provenance or candidate is ever emitted. Existing
 * `start` / `advance` / `resumeAll` behavior is untouched (verified by the
 * existing mission regression suites).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AccountingMissionStatus,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import {
  createWorkUnit,
  validateWorkUnit,
  type WorkUnit,
  type WorkUnitInput,
} from "drenyra-ai";
import { bindScope, type ScopeBinding } from "../../lib/canonicalization.js";
import {
  EdaMissionCoordinator,
  createDurableMissionRoutingPort,
  type AdvanceEdaMissionResult,
} from "../../lib/mission-commands.js";
import {
  BudgetLedger,
  type RoutingExecutionPorts,
} from "../../lib/routing/types.js";
import { AUTHORITY_MODE } from "../../runtime/context.js";
import {
  makeCanonicalScope,
} from "../helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-routing-seam-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Counts `coordinator.advance` invocations to prove exactly-one-per-call. */
class CountingCoordinator extends EdaMissionCoordinator {
  advanceCalls = 0;

  override async advance(
    input: { missionId: string; storesRoot?: string },
  ): Promise<AdvanceEdaMissionResult> {
    this.advanceCalls += 1;
    return super.advance(input);
  }
}

/** A stub chain; the durable seam ignores it (it is passed through untouched). */
function makeStubChain(): { name: string; intent: string; requiredMode: string; runStep: () => Promise<{ output: null }> } {
  return {
    name: "stub-chain",
    intent: "monthly-close",
    requiredMode: "EXECUTE",
    runStep: async () => ({ output: null }),
  };
}

/** Build a helper-created DRAFT work unit over the started mission. */
function buildUnit(mission: MissionSnapshot): WorkUnit {
  const input: WorkUnitInput = {
    id: `work-${mission.id}`,
    objective: "durable seam fixture objective",
    scope: { tenantId: "acme", ruc: mission.companyId },
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
  const created = createWorkUnit(mission, input);
  if (!created.ok) {
    throw new Error(`fixture createWorkUnit failed: ${JSON.stringify(created.issues)}`);
  }
  const validated = validateWorkUnit(created.value, mission);
  if (!validated.ok) {
    throw new Error(`fixture validateWorkUnit failed: ${JSON.stringify(validated.issues)}`);
  }
  return validated.value;
}

/** The full port input for one bounded seam invocation. */
function makePortInput(
  workUnit: WorkUnit,
  mission: MissionSnapshot,
  binding: ScopeBinding,
  ledger: BudgetLedger,
): Parameters<RoutingExecutionPorts["durable"]>[0] {
  const chain = makeStubChain() as unknown as Parameters<RoutingExecutionPorts["durable"]>[0]["chain"];
  return {
    workUnit,
    route: "durable",
    binding,
    mission,
    chain,
    chainRun: { binding, input: {} },
    ledger,
  };
}

describe("createDurableMissionRoutingPort — exactly one decision per call", () => {
  it("RUN: one advance maps DRAFT→QUEUED with the next Core-proposed target and no stop", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.EXECUTE, actor: "alice" }),
    );
    const coordinator = new CountingCoordinator(binding, { storesRoot });
    const mission = await coordinator.start({
      intent: "monthly-close",
      sourceRefs: [],
    });
    const workUnit = buildUnit(mission);
    const ledger = BudgetLedger.create(workUnit);

    const port = createDurableMissionRoutingPort(coordinator);
    const response = await port(
      makePortInput(workUnit, mission, binding, ledger),
    );

    // Exactly one advance call and exactly one completed step in the store.
    expect(coordinator.advanceCalls).toBe(1);
    const after = await coordinator.stores.store.findById(mission.id);
    expect(after?.steps.filter((step) => step.status === "COMPLETED")).toHaveLength(1);
    expect(after?.steps.find((step) => step.id === "intake")?.status).toBe("COMPLETED");

    // The observed Core edge is DRAFT → QUEUED, and the next proposed target is
    // the engine's next lifecycle phase (bind-scope → RUNNING).
    expect(response.missionBefore.status).toBe(AccountingMissionStatus.DRAFT);
    expect(response.missionAfter.status).toBe(AccountingMissionStatus.QUEUED);
    expect(response.missionAfter.id).toBe(mission.id);
    expect(response.coreProposedTarget).toBe(AccountingMissionStatus.RUNNING);
    expect(response.stop).toBeUndefined();
    expect(response.unresolvedExceptions).toHaveLength(0);
    // No synthetic provenance: real chain output is the only source.
    expect(response.toolProvenance).toHaveLength(0);
    expect(response.candidates).toHaveLength(0);
    expect(response.evidenceRefs.map((ref) => ref.hash)).toEqual(
      workUnit.evidenceAllowed.map((ref) => ref.hash),
    );
  });

  it("one invocation never loops: a second call advances exactly one more step", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.EXECUTE, actor: "alice" }),
    );
    const coordinator = new CountingCoordinator(binding, { storesRoot });
    const mission = await coordinator.start({
      intent: "monthly-close",
      sourceRefs: [],
    });
    const workUnit = buildUnit(mission);
    const ledger = BudgetLedger.create(workUnit);
    const port = createDurableMissionRoutingPort(coordinator);

    await port(makePortInput(workUnit, mission, binding, ledger));
    expect(coordinator.advanceCalls).toBe(1);
    let after = await coordinator.stores.store.findById(mission.id);
    expect(after?.steps.filter((step) => step.status === "COMPLETED")).toHaveLength(1);

    await port(makePortInput(workUnit, mission, binding, ledger));
    expect(coordinator.advanceCalls).toBe(2);
    after = await coordinator.stores.store.findById(mission.id);
    expect(after?.steps.filter((step) => step.status === "COMPLETED")).toHaveLength(2);
    expect(after?.steps.find((step) => step.id === "bind-scope")?.status).toBe("COMPLETED");
  });

  it("WAIT: approval wait reports an APPROVAL_REQUIRED stop + WAIT_REQUIRED exception and performs no write", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.EXECUTE, actor: "alice" }),
    );
    const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
    let mission = await coordinator.start({
      intent: "monthly-close",
      sourceRefs: ["src-1", "src-2"],
    });
    // Drive the mission to the approval wait (one bounded phase per advance).
    for (let index = 0; index < 14 && mission.status !== AccountingMissionStatus.AWAITING_APPROVAL; index += 1) {
      const result = await coordinator.advance({ missionId: mission.id });
      mission = result.mission;
    }
    expect(mission.status).toBe(AccountingMissionStatus.AWAITING_APPROVAL);
    const before = await coordinator.stores.store.findById(mission.id);

    const workUnit = buildUnit(mission);
    const ledger = BudgetLedger.create(workUnit);
    const port = createDurableMissionRoutingPort(coordinator);
    const response = await port(
      makePortInput(workUnit, mission, binding, ledger),
    );

    expect(response.stop?.kind).toBe("APPROVAL_REQUIRED");
    if (response.stop?.kind === "APPROVAL_REQUIRED") {
      expect(response.stop.approvalType).toBe("human");
    }
    expect(response.unresolvedExceptions.some((exception) => exception.code === "WAIT_REQUIRED")).toBe(true);
    // WAIT never writes and never auto-advances.
    expect(response.missionAfter.status).toBe(AccountingMissionStatus.AWAITING_APPROVAL);
    expect(response.missionAfter.version).toBe(before?.version);
    expect(response.missionAfter.updatedAt).toBe(before?.updatedAt);
    const after = await coordinator.stores.store.findById(mission.id);
    expect(after?.version).toBe(before?.version);
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  it("authority denial: insufficient bound mode stops with POLICY_BLOCKED before any write", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.ANALYZE, actor: "alice" }),
    );
    const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
    let mission = await coordinator.start({ intent: "monthly-close", sourceRefs: ["src-1"] });
    // Advance until the bound ANALYZE mode is denied (PREPARE_CANDIDATE at propose).
    let denied = false;
    for (let index = 0; index < 14 && !denied; index += 1) {
      const result = await coordinator.advance({ missionId: mission.id });
      mission = result.mission;
      denied = result.authorityDenied !== undefined;
    }
    expect(denied).toBe(true);

    const workUnit = buildUnit(mission);
    const ledger = BudgetLedger.create(workUnit);
    const port = createDurableMissionRoutingPort(coordinator);
    const response = await port(
      makePortInput(workUnit, mission, binding, ledger),
    );

    expect(response.stop?.kind).toBe("POLICY_BLOCKED");
    if (response.stop?.kind === "POLICY_BLOCKED") {
      expect(response.stop.policy.id).toBe("policies.v1");
    }
    expect(response.unresolvedExceptions.some((exception) => exception.code === "AUTHORITY_DENIED")).toBe(true);
    // Denial happens before any write: the mission snapshot is unchanged.
    expect(response.missionAfter.version).toBe(mission.version);
    const after = await coordinator.stores.store.findById(mission.id);
    expect(after?.version).toBe(mission.version);
  });

  it("UNKNOWN: no prepared step, typed AMBIGUOUS_INPUT stop + MISSION_UNKNOWN exception, no write, no loop", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.EXECUTE, actor: "alice" }),
    );
    const coordinator = new EdaMissionCoordinator(binding, { storesRoot });
    const mission = await coordinator.start({ intent: "monthly-close", sourceRefs: [] });
    // Forge an UNKNOWN snapshot in the durable store (engine-legal recovery state).
    const unknown: MissionSnapshot = {
      ...mission,
      status: AccountingMissionStatus.UNKNOWN,
      version: mission.version + 1,
      lastEventSequence: mission.lastEventSequence + 1,
      updatedAt: new Date().toISOString(),
    };
    await coordinator.stores.store.save(unknown);

    const workUnit = buildUnit(unknown);
    const ledger = BudgetLedger.create(workUnit);
    const port = createDurableMissionRoutingPort(coordinator);
    const response = await port(
      makePortInput(workUnit, unknown, binding, ledger),
    );

    expect(response.stop?.kind).toBe("AMBIGUOUS_INPUT");
    expect(response.unresolvedExceptions.some((exception) => exception.code === "MISSION_UNKNOWN")).toBe(true);
    expect(response.missionAfter.status).toBe(AccountingMissionStatus.UNKNOWN);
    expect(response.missionAfter.version).toBe(unknown.version);
    const after = await coordinator.stores.store.findById(mission.id);
    expect(after?.status).toBe(AccountingMissionStatus.UNKNOWN);
    expect(after?.version).toBe(unknown.version);
  });

  it("rejects a work unit bound to a different mission before any advance", async () => {
    const storesRoot = tempRoot();
    const binding = bindScope(
      makeCanonicalScope({ authorityLevel: AUTHORITY_MODE.EXECUTE, actor: "alice" }),
    );
    const coordinator = new CountingCoordinator(binding, { storesRoot });
    const mission = await coordinator.start({ intent: "monthly-close", sourceRefs: [] });
    const other = await coordinator.start({ intent: "correction", sourceRefs: [] });
    const workUnit = buildUnit(mission);
    const ledger = BudgetLedger.create(workUnit);

    const port = createDurableMissionRoutingPort(coordinator);
    await expect(
      port(makePortInput(workUnit, other, binding, ledger)),
    ).rejects.toThrow(/bound to mission/);
    expect(coordinator.advanceCalls).toBe(0);
  });
});
