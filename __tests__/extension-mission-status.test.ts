/**
 * Mission-status rendering tests (T-S4A-002) — status/capabilities views and
 * structured results (design §9, §10.3; REQ-CMD-008/009/010).
 *
 * The status view renders active company and period, active mission state and
 * next authorized action, linked sources, pending reconciliations, material
 * anomalies, and required approvals (REQ-CMD-009). The capabilities view
 * reports the engine getCapabilities() plus harness capabilities: authority
 * modes, registered commands, and the 10 scope elements (REQ-CMD-010). Every
 * command output carries a concise human summary plus machine-readable JSON
 * (REQ-CMD-008). These renderers are thin — they compose persisted projections,
 * never fiscal logic.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { AccountingMissionStatus, getCapabilities } from "drenyra-ai/missions";
import { createEdaSteps } from "../lib/accounting-status.js";
import { loadCanonicalScope } from "../runtime/context.js";
import { status } from "../runtime/status.js";
import { DEFAULT_PIN } from "../runtime/pin.js";
import {
  renderCapabilitiesView,
  renderModelsRegistry,
  renderStatusView,
  type StatusViewInput,
} from "../extensions/mission-status.js";
import { makeCanonicalScope, makeMission } from "./helpers/authority-fixtures.js";

async function runtimeStatus() {
  return status({ pin: DEFAULT_PIN, packageRoot: process.cwd() });
}

function completeScopeInput(overrides: Partial<StatusViewInput> = {}): Promise<StatusViewInput> {
  return (async () => ({
    company: "20123456786",
    period: "202507",
    runtime: await runtimeStatus(),
    scopeReport: loadCanonicalScope({ canonical: makeCanonicalScope() }),
    ...overrides,
  }))();
}

describe("renderStatusView (REQ-CMD-009)", () => {
  it("renders company, period, and scope completeness in the human summary", async () => {
    const output = await renderStatusView(await completeScopeInput());
    expect(output.summary).toContain("20123456786");
    expect(output.summary).toContain("202507");
    expect(output.summary).toContain("complete");
    expect(typeof output.machine).toBe("object");
    // REQ-CMD-008: machine output must be JSON-serializable.
    expect(() => JSON.stringify(output.machine)).not.toThrow();
  });

  it("reports an incomplete scope with the missing element list", async () => {
    const scopeReport = loadCanonicalScope({ company: { ruc: "20123456786" } });
    const output = await renderStatusView({
      company: "20123456786",
      runtime: await runtimeStatus(),
      scopeReport,
    });
    expect(output.summary).toContain("incomplete");
    expect(output.summary).toContain("missing");
    const machine = output.machine as { scope: { complete: boolean; missing: string[] } };
    expect(machine.scope.complete).toBe(false);
    expect(machine.scope.missing).toContain("tenant");
  });

  it("renders the active mission state, next authorized action, anomalies, and approvals", async () => {
    const mission = makeMission(
      {
        status: AccountingMissionStatus.AWAITING_APPROVAL,
        proposal: {
          id: "proposal-1",
          missionId: "mission-close-001",
          version: 1,
          evidence: [],
          evidenceHash: "b".repeat(64),
          summary: "close proposal",
          riskLevel: "MEDIUM",
          generatedAt: "2026-07-01T00:00:00.000Z",
        },
        blockers: [
          {
            id: "blocker-1",
            reason: "bank vs ledger difference",
            severity: "ERROR",
            occurredAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
      createEdaSteps("monthly-close"),
    );
    const output = await renderStatusView(
      await completeScopeInput({ mission, linkedSources: ["ref://balance-202507"], pendingReconciliations: 2 }),
    );
    expect(output.summary).toContain("mission-close-001");
    expect(output.summary).toContain("AWAITING_APPROVAL");
    expect(output.summary).toContain("next");
    expect(output.summary).toContain("anomalies: 1");
    expect(output.summary).toContain("approvals: 1");
    expect(output.summary).toContain("sources: 1");
    expect(output.summary).toContain("reconciliations: 2");

    const machine = output.machine as {
      mission: { id: string; status: string };
      nextAuthorizedAction: { actionFamily: string; requiredMode: string } | undefined;
      authority: { anomalies: number; approvalsPending: number };
      linkedSources: string[];
      pendingReconciliations: number;
    };
    expect(machine.mission.id).toBe("mission-close-001");
    expect(machine.mission.status).toBe("AWAITING_APPROVAL");
    expect(machine.nextAuthorizedAction?.actionFamily).toBe("APPROVE");
    expect(machine.authority.anomalies).toBe(1);
    expect(machine.authority.approvalsPending).toBe(1);
    expect(machine.linkedSources).toEqual(["ref://balance-202507"]);
    expect(machine.pendingReconciliations).toBe(2);
  });

  it("omits mission and next action when no mission is active", async () => {
    const output = await renderStatusView(await completeScopeInput());
    const machine = output.machine as { mission?: unknown; nextAuthorizedAction?: unknown };
    expect(machine.mission).toBeUndefined();
    expect(machine.nextAuthorizedAction).toBeUndefined();
  });

  it("renders a RUNNING mission's prepared next phase as the next authorized action", async () => {
    const mission = makeMission({}, createEdaSteps("monthly-close"));
    const output = await renderStatusView(await completeScopeInput({ mission }));
    const machine = output.machine as {
      mission: { preparedStep: { phase: string; disposition: string } | null };
      nextAuthorizedAction: { actionFamily: string } | undefined;
    };
    expect(machine.mission.preparedStep?.phase).toBe("intake");
    expect(machine.nextAuthorizedAction?.actionFamily).toBe("QUERY");
    expect(output.summary).toContain("intake");
  });
});

describe("renderCapabilitiesView (REQ-CMD-010)", () => {
  it("reports engine capabilities plus harness capabilities", () => {
    const engine = getCapabilities();
    const output = renderCapabilitiesView({
      version: "0.0.1-prealpha.1",
      commands: ["/drenyra:status", "/drenyra:capabilities"],
      authorityModes: ["ASK", "ANALYZE", "PREPARE", "EXECUTE"],
      scopeElements: ["tenant", "company", "authorityLevel"],
    });
    const machine = output.machine as {
      engine: { protocolVersion: string; features: string[] };
      harness: { version: string; commands: string[]; authorityModes: string[]; scopeElements: string[] };
    };
    expect(machine.engine.protocolVersion).toBe(engine.protocolVersion);
    expect(machine.engine.features).toEqual(engine.features);
    expect(machine.harness.version).toBe("0.0.1-prealpha.1");
    expect(machine.harness.commands).toContain("/drenyra:capabilities");
    expect(machine.harness.authorityModes).toEqual(["ASK", "ANALYZE", "PREPARE", "EXECUTE"]);
    expect(machine.harness.scopeElements).toContain("authorityLevel");
    expect(output.summary).toContain("capabilities");
    expect(output.summary).toContain("authority modes");
    expect(() => JSON.stringify(output.machine)).not.toThrow();
  });

  it("exposes all four authority modes and ten scope elements when given the real constants", async () => {
    const { AUTHORITY_MODE, CANONICAL_SCOPE_ELEMENTS } = await import("../runtime/context.js");
    const output = renderCapabilitiesView({
      version: "0.0.1-prealpha.1",
      commands: [],
      authorityModes: Object.values(AUTHORITY_MODE),
      scopeElements: [...CANONICAL_SCOPE_ELEMENTS],
    });
    const machine = output.machine as {
      harness: { authorityModes: string[]; scopeElements: string[] };
    };
    expect(machine.harness.authorityModes).toHaveLength(4);
    expect(machine.harness.scopeElements).toHaveLength(10);
  });
});

describe("renderModelsRegistry (T-S4A-004 models command)", () => {
  it("returns the documented model-routing registry covering all 13 EDA phases", () => {
    const output = renderModelsRegistry();
    const machine = output.machine as {
      version: string;
      note: string;
      routing: { phase: string; role: string }[];
    };
    expect(machine.version).toBe("drenyra.model-routing.v1");
    expect(machine.note.length).toBeGreaterThan(0);
    const phases = machine.routing.map((entry) => entry.phase);
    expect(phases).toHaveLength(13);
    expect(phases).toContain("intake");
    expect(phases).toContain("approve");
    expect(phases).toContain("archive");
    expect(output.summary).toContain("model-routing");
    expect(() => JSON.stringify(output.machine)).not.toThrow();
  });
});
