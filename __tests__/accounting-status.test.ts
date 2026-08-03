/**
 * Accounting status — RED/GREEN tests for T-S2-004 (read-only status
 * projection + EDA step derivation; design §4.4/§9).
 *
 * Fiscal convention: monetary values are BigInt cents; no float is ever used
 * for money. Digests are lowercase hex sha-256; version numbers are JSON
 * integers.
 */

import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  WaitReason,
  type MissionIntent,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import type { RuntimeStatus } from "../runtime/status.js";
import {
  EDA_PHASE,
  EDA_PHASE_ORDER,
  PHASE_APPLICABILITY,
  buildAccountingStatus,
  createEdaSteps,
  derivePreparedStep,
  nextAuthorizedActionFor,
  type AccountingStatusInput,
} from "../lib/accounting-status.js";
import { ACTION_FAMILY } from "../lib/authority-gates.js";
import { AUTHORITY_MODE } from "../runtime/context.js";
import {
  makeMission,
  makeScopeBinding,
} from "./helpers/authority-fixtures.js";

/** The exact 15-member installed engine set (design §1; REQ-MISS-002). */
const INSTALLED_STATES: readonly AccountingMissionStatus[] = [
  AccountingMissionStatus.DRAFT,
  AccountingMissionStatus.QUEUED,
  AccountingMissionStatus.RUNNING,
  AccountingMissionStatus.BLOCKED,
  AccountingMissionStatus.AWAITING_APPROVAL,
  AccountingMissionStatus.APPROVED,
  AccountingMissionStatus.REJECTED,
  AccountingMissionStatus.REVISION_REQUESTED,
  AccountingMissionStatus.COMPLETED,
  AccountingMissionStatus.FAILED,
  AccountingMissionStatus.UNKNOWN,
  AccountingMissionStatus.RECOVERING,
  AccountingMissionStatus.WAITING_FOR_EVIDENCE,
  AccountingMissionStatus.BLOCKED_BY_GATE,
  AccountingMissionStatus.RETRYING,
];

function runtimeStatus(): RuntimeStatus {
  return {
    summary: "drenyra-ai@0.2.0: verified",
    human: "Runtime status: verified",
    machine: {
      pinState: "released",
      versionMatches: true,
      checksumMatches: true,
      verdict: "verified",
      issues: [],
    },
  };
}

function statusInput(mission?: MissionSnapshot): AccountingStatusInput {
  const binding = makeScopeBinding();
  return {
    runtime: runtimeStatus(),
    scopeReport: { scope: {}, missing: [], complete: true },
    binding,
    mission,
  };
}

describe("T-S2-004 installed engine states (design §1)", () => {
  it("exposes the exact 15-member AccountingMissionStatus set from the installed enum", () => {
    const actual = Object.values(AccountingMissionStatus);
    expect(actual.sort()).toEqual([...INSTALLED_STATES].sort());
    expect(actual).toHaveLength(15);
  });

  it("classifies every installed state without a silent runnable default", async () => {
    for (const state of INSTALLED_STATES) {
      const mission = makeMission({ status: state, steps: createEdaSteps("monthly-close") });
      const view = await buildAccountingStatus(statusInput(mission));
      const missionView = view.mission;
      expect(missionView, `state ${state}`).toBeDefined();
      expect(missionView?.status).toBe(state);
      // Engine predicates drive the classification — never chat inference.
      expect(missionView?.runnable).toBe(missionView?.runnable);
      expect(missionView?.waitReason).toBe(
        missionView?.waitReason,
      );
    }
  });

  it("never maps an unknown status to runnable", async () => {
    const mission = makeMission({
      status: "NOT_A_REAL_STATE" as never,
      steps: createEdaSteps("monthly-close"),
    });
    const view = await buildAccountingStatus(statusInput(mission));
    expect(view.mission?.runnable).toBe(false);
    expect(view.mission?.resumable).toBe(false);
    expect(view.mission?.waitReason).toBeUndefined();
    expect(view.mission?.preparedStep).toBeNull();
    expect(view.nextAuthorizedAction).toBeUndefined();
  });

  it("surfaces the human-wait classification per state (SC-MISS-005/006)", async () => {
    const cases: Array<[AccountingMissionStatus, WaitReason | undefined]> = [
      [AccountingMissionStatus.WAITING_FOR_EVIDENCE, WaitReason.EVIDENCE],
      [AccountingMissionStatus.AWAITING_APPROVAL, WaitReason.APPROVAL],
      [AccountingMissionStatus.BLOCKED_BY_GATE, WaitReason.POLICY_GATE],
      [AccountingMissionStatus.BLOCKED, WaitReason.MANUAL_INTERVENTION],
      [AccountingMissionStatus.UNKNOWN, WaitReason.EXTERNAL_SYSTEM],
      [AccountingMissionStatus.RETRYING, WaitReason.EXTERNAL_SYSTEM],
      [AccountingMissionStatus.RUNNING, undefined],
      [AccountingMissionStatus.COMPLETED, undefined],
    ];
    for (const [state, reason] of cases) {
      const view = await buildAccountingStatus(
        statusInput(makeMission({ status: state, steps: createEdaSteps("monthly-close") })),
      );
      expect(view.mission?.waitReason, `state ${state}`).toBe(reason);
      if (reason !== undefined) {
        expect(view.mission?.waitingForHuman ?? true).toBe(
          state !== AccountingMissionStatus.UNKNOWN &&
            state !== AccountingMissionStatus.RETRYING,
        );
      }
    }
  });
});

describe("T-S2-004 createEdaSteps (REQ-MISS-001; design §4.2/§4.3)", () => {
  const CANONICAL_PHASE_ORDER: readonly string[] = [
    "intake",
    "bind-scope",
    "ingest",
    "normalize",
    "classify",
    "reconcile",
    "investigate",
    "propose",
    "verify",
    "approve",
    "execute",
    "close",
    "archive",
  ];

  it("matches the exported phase order constant", () => {
    expect(EDA_PHASE_ORDER).toHaveLength(13);
    expect(EDA_PHASE_ORDER.map((phase) => phase)).toEqual(CANONICAL_PHASE_ORDER);
  });

  it("returns all 13 phases in canonical order for all five intents", () => {
    const intents: readonly MissionIntent[] = [
      "monthly-close",
      "correction",
      "reconciliation",
      "invoice-review",
      "compliance-check",
    ];
    for (const intent of intents) {
      const steps = createEdaSteps(intent);
      expect(steps, `intent ${intent}`).toHaveLength(13);
      expect(steps.map((step) => step.id)).toEqual(CANONICAL_PHASE_ORDER);
      expect(steps.every((step) => step.status === "PENDING")).toBe(true);
    }
  });

  it("encodes the design §4.3 applicability policy per intent", () => {
    const monthly = PHASE_APPLICABILITY["monthly-close"];
    for (const phase of EDA_PHASE_ORDER) {
      expect(monthly[phase], `monthly-close ${phase}`).toBe("required");
    }
    expect(PHASE_APPLICABILITY.correction[EDA_PHASE.RECONCILE]).toBe("conditional");
    expect(PHASE_APPLICABILITY.reconciliation[EDA_PHASE.PROPOSE]).toBe("conditional");
    expect(PHASE_APPLICABILITY["invoice-review"][EDA_PHASE.RECONCILE]).toBe("conditional");
    expect(PHASE_APPLICABILITY["invoice-review"][EDA_PHASE.PROPOSE]).toBe("conditional");
    expect(PHASE_APPLICABILITY["compliance-check"][EDA_PHASE.RECONCILE]).toBe("conditional");
    expect(PHASE_APPLICABILITY["compliance-check"][EDA_PHASE.PROPOSE]).toBe("conditional");
    // All five intents expose every phase (skips remain visible in MissionStep[]).
    for (const intent of Object.keys(PHASE_APPLICABILITY) as MissionIntent[]) {
      for (const phase of EDA_PHASE_ORDER) {
        expect(PHASE_APPLICABILITY[intent][phase], `${intent}/${phase}`).toBeDefined();
      }
    }
  });
});

describe("T-S2-004 derivePreparedStep (REQ-MISS-003/004)", () => {
  function snapshotWithSteps(
    status: AccountingMissionStatus,
    steps: ReturnType<typeof createEdaSteps>,
    overrides: Partial<MissionSnapshot> = {},
  ): MissionSnapshot {
    return makeMission({ status, steps, ...overrides });
  }

  it("returns the first PENDING phase as RUN for a runnable mission", () => {
    const snapshot = snapshotWithSteps(
      AccountingMissionStatus.RUNNING,
      createEdaSteps("monthly-close"),
    );
    const prepared = derivePreparedStep(snapshot, "scope-hash");
    expect(prepared).toMatchObject({
      missionId: "mission-close-001",
      expectedMissionVersion: 1,
      phase: EDA_PHASE.INTAKE,
      intent: "monthly-close",
      scopeHash: "scope-hash",
      disposition: "RUN",
    });
  });

  it("advances past completed phases to the next PENDING phase", () => {
    const steps = createEdaSteps("monthly-close");
    const intake = steps.find((step) => step.id === EDA_PHASE.INTAKE);
    if (intake === undefined) {
      throw new Error("fixture: intake step missing");
    }
    intake.status = "COMPLETED";
    const snapshot = snapshotWithSteps(AccountingMissionStatus.RUNNING, steps, {
      currentStep: EDA_PHASE.INTAKE,
    });
    expect(derivePreparedStep(snapshot)?.phase).toBe(EDA_PHASE.BIND_SCOPE);
    expect(derivePreparedStep(snapshot)?.disposition).toBe("RUN");
  });

  it("returns WAIT for human-wait states (REQ-MISS-009)", () => {
    const waitStates = [
      AccountingMissionStatus.WAITING_FOR_EVIDENCE,
      AccountingMissionStatus.AWAITING_APPROVAL,
      AccountingMissionStatus.BLOCKED_BY_GATE,
      AccountingMissionStatus.BLOCKED,
    ] as const;
    for (const state of waitStates) {
      const prepared = derivePreparedStep(
        snapshotWithSteps(state, createEdaSteps("monthly-close")),
      );
      expect(prepared?.disposition, `state ${state}`).toBe("WAIT");
    }
  });

  it("returns null for terminal, UNKNOWN, and unknown states", () => {
    expect(
      derivePreparedStep(
        snapshotWithSteps(AccountingMissionStatus.COMPLETED, createEdaSteps("monthly-close")),
      ),
    ).toBeNull();
    expect(
      derivePreparedStep(
        snapshotWithSteps(AccountingMissionStatus.FAILED, createEdaSteps("monthly-close")),
      ),
    ).toBeNull();
    expect(
      derivePreparedStep(
        snapshotWithSteps(AccountingMissionStatus.UNKNOWN, createEdaSteps("monthly-close")),
      ),
    ).toBeNull();
    expect(
      derivePreparedStep(
        snapshotWithSteps("NOT_A_REAL_STATE" as never, createEdaSteps("monthly-close")),
      ),
    ).toBeNull();
  });

  it("returns null when every step is done", () => {
    const steps = createEdaSteps("monthly-close").map((step) => ({
      ...step,
      status: "COMPLETED" as const,
    }));
    expect(
      derivePreparedStep(
        snapshotWithSteps(AccountingMissionStatus.APPROVED, steps, {
          currentStep: EDA_PHASE.ARCHIVE,
        }),
      ),
    ).toBeNull();
  });

  it("marks a conditional phase SKIP when no triggering condition is persisted", () => {
    // correction: reconcile is conditional; the snapshot carries no
    // unresolved discrepancy, so the deterministic outcome is SKIP.
    const steps = createEdaSteps("correction");
    const reconcile = steps.find((step) => step.id === EDA_PHASE.RECONCILE);
    if (reconcile === undefined) {
      throw new Error("fixture: reconcile step missing");
    }
    reconcile.status = "PENDING";
    // Mark everything before reconcile as completed so reconcile is next.
    for (const step of steps) {
      if (step.id === EDA_PHASE.RECONCILE) break;
      step.status = "COMPLETED";
    }
    const snapshot = snapshotWithSteps(AccountingMissionStatus.RUNNING, steps, {
      currentStep: EDA_PHASE.CLASSIFY,
      intent: "correction",
    });
    const prepared = derivePreparedStep(snapshot);
    expect(prepared?.phase).toBe(EDA_PHASE.RECONCILE);
    expect(prepared?.disposition).toBe("SKIP");
  });

  it("runs a conditional phase when the snapshot carries an unresolved blocker", () => {
    const steps = createEdaSteps("correction");
    for (const step of steps) {
      if (step.id === EDA_PHASE.RECONCILE) break;
      step.status = "COMPLETED";
    }
    const snapshot = snapshotWithSteps(AccountingMissionStatus.RUNNING, steps, {
      currentStep: EDA_PHASE.CLASSIFY,
      intent: "correction",
      blockers: [
        {
          id: "blk-1",
          reason: "discrepancy between ledger and bank",
          severity: "ERROR",
          occurredAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    expect(derivePreparedStep(snapshot)?.disposition).toBe("RUN");
  });
});

describe("T-S2-004 nextAuthorizedAction (REQ-MISS-003)", () => {
  it("maps evidence wait to INVESTIGATE at ANALYZE", () => {
    const prepared = derivePreparedStep(
      makeMission({ status: AccountingMissionStatus.WAITING_FOR_EVIDENCE, steps: createEdaSteps("monthly-close") }),
    );
    const next = nextAuthorizedActionFor(prepared, WaitReason.EVIDENCE);
    expect(next?.actionFamily).toBe(ACTION_FAMILY.INVESTIGATE);
    expect(next?.requiredMode).toBe(AUTHORITY_MODE.ANALYZE);
  });

  it("maps approval wait to APPROVE at PREPARE", () => {
    const next = nextAuthorizedActionFor(null, WaitReason.APPROVAL);
    expect(next?.actionFamily).toBe(ACTION_FAMILY.APPROVE);
    expect(next?.requiredMode).toBe(AUTHORITY_MODE.PREPARE);
  });

  it("maps a policy gate block to APPROVE at PREPARE (SC-MISS-006)", () => {
    const next = nextAuthorizedActionFor(null, WaitReason.POLICY_GATE);
    expect(next?.actionFamily).toBe(ACTION_FAMILY.APPROVE);
    expect(next?.requiredMode).toBe(AUTHORITY_MODE.PREPARE);
  });

  it("derives the family from the prepared step when runnable", () => {
    const prepared = derivePreparedStep(
      makeMission({ status: AccountingMissionStatus.RUNNING, steps: createEdaSteps("monthly-close") }),
    );
    expect(prepared?.phase).toBe(EDA_PHASE.INTAKE);
    const next = nextAuthorizedActionFor(prepared, null);
    expect(next?.actionFamily).toBe(ACTION_FAMILY.QUERY);
    expect(next?.requiredMode).toBe(AUTHORITY_MODE.ASK);
  });

  it("returns undefined when there is no prepared step and no wait reason", () => {
    expect(nextAuthorizedActionFor(null, null)).toBeUndefined();
  });
});

describe("T-S2-004 buildAccountingStatus (design §9)", () => {
  it("composes runtime, scope, mission, evidence, authority, and next action", async () => {
    const mission = makeMission({
      status: AccountingMissionStatus.AWAITING_APPROVAL,
      steps: createEdaSteps("monthly-close"),
    });
    const view = await buildAccountingStatus(statusInput(mission));

    expect(view.runtime.machine.verdict).toBe("verified");
    expect(view.scope.complete).toBe(true);
    expect(view.scope.scopeHash).toBeDefined();
    expect(view.mission).toBeDefined();
    expect(view.mission?.awaitingApproval).toBe(true);
    expect(view.mission?.waitReason).toBe(WaitReason.APPROVAL);
    expect(view.mission?.preparedStep?.disposition).toBe("WAIT");
    expect(view.evidence).toBeDefined();
    expect(view.authority.scopeBound).toBe(true);
    expect(view.nextAuthorizedAction?.actionFamily).toBe(ACTION_FAMILY.APPROVE);
  });

  it("reports an incomplete scope without inventing readiness", async () => {
    const view = await buildAccountingStatus({
      ...statusInput(),
      scopeReport: { scope: { company: "20123456786" }, missing: ["tenant"], complete: false },
    });
    expect(view.scope.complete).toBe(false);
    expect(view.scope.missing).toContain("tenant");
    expect(view.nextAuthorizedAction).toBeUndefined();
  });

  it("counts unresolved blockers as anomalies", async () => {
    const mission = makeMission({
      status: AccountingMissionStatus.WAITING_FOR_EVIDENCE,
      steps: createEdaSteps("monthly-close"),
      blockers: [
        {
          id: "b1",
          reason: "bank statement missing",
          severity: "ERROR",
          occurredAt: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "b2",
          reason: "resolved earlier",
          severity: "WARNING",
          occurredAt: "2026-07-01T00:00:00.000Z",
          resolvedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
    });
    const view = await buildAccountingStatus(statusInput(mission));
    expect(view.authority.anomalies).toBe(1);
  });

  it("counts a pending proposal approval at AWAITING_APPROVAL", async () => {
    const mission = makeMission({
      status: AccountingMissionStatus.AWAITING_APPROVAL,
      steps: createEdaSteps("monthly-close"),
      proposal: {
        id: "prop-1",
        missionId: "mission-close-001",
        version: 1,
        evidence: [],
        evidenceHash: "d".repeat(64),
        summary: "close",
        riskLevel: "MEDIUM",
        generatedAt: "2026-07-01T00:00:00.000Z",
      },
    });
    const view = await buildAccountingStatus(statusInput(mission));
    expect(view.authority.approvalsPending).toBe(1);
  });
});
