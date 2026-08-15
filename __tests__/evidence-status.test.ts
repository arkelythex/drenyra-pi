/**
 * Evidence status — RED/GREEN tests for the evidence-status projection work
 * unit (design §7/§9): replace the placeholder evidence state in the accounting
 * status with a truthful read-only projection of the mission's evidence graph.
 *
 * Fail-closed contract (REQ-EVID-008; SC-EVID-003): a missing, malformed, or
 * integrity-invalid graph is reported unavailable and is NEVER implied valid.
 * A verified view carries every evidence node id so displayed conclusions and
 * actions retain their citations (REQ-EVID-002/007) — no authority conclusion
 * is fabricated from graph data.
 *
 * Fiscal convention: monetary values are BigInt cents; no float is ever used
 * for money. Digests are lowercase hex sha-256; version/sequence numbers are
 * JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountingMissionStatus } from "drenyra-ai/missions";
import {
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
  EvidenceGraphStore,
  type EvidenceNode,
} from "../lib/evidence-graph.js";
import {
  buildAccountingStatus,
  projectEvidenceStatus,
  type AccountingStatusInput,
  type EvidenceStatusProjectionInput,
  type EvidenceStatusView,
} from "../lib/accounting-status.js";
import { loadEvidenceStatus } from "../lib/evidence-status.js";
import { renderStatusView } from "../extensions/mission-status.js";
import {
  registerDrenyraPiExtension,
  type PiCommandContext,
  type PiExtensionApi,
} from "../extensions/register.js";
import { ScopeContextStore } from "../runtime/context.js";
import type { RuntimeStatus } from "../runtime/status.js";
import { makeCanonicalScope, makeMission, makeScopeBinding } from "./helpers/authority-fixtures.js";

const TS = "2026-07-01T00:00:00.000Z";
const MISSION = "mission-close-001";

/** The four fixture source nodes the evidence chain lands in a mission graph. */
const SOURCE_NODES = [
  {
    id: "src-balance",
    nodeKind: "source",
    payload: { kind: "balance-snapshot", reference: "BAL-202507", amountCents: 1_000_000 },
  },
  {
    id: "src-mayor",
    nodeKind: "source",
    payload: { kind: "mayor-snapshot", reference: "MAY-202507", amountCents: 600_000 },
  },
  {
    id: "src-auxiliaries",
    nodeKind: "source",
    payload: { kind: "auxiliaries-snapshot", reference: "AUX-202507", amountCents: 400_000 },
  },
  {
    id: "src-bank",
    nodeKind: "source",
    payload: { kind: "bank-movements", reference: "BNK-202507", amountCents: 250_000 },
  },
];

interface RegisteredCommand {
  name: string;
  description: string;
  handler: (args: string, ctx: PiCommandContext) => Promise<void>;
}

function makeMockPi(): { pi: PiExtensionApi; registered: RegisteredCommand[] } {
  const registered: RegisteredCommand[] = [];
  const pi: PiExtensionApi = {
    registerCommand(name, options) {
      registered.push({
        name,
        description: options.description ?? "",
        handler: options.handler,
      });
    },
  };
  return { pi, registered };
}

/** Parse the pretty-printed machine JSON block that starts after the summary. */
function parseMachineOutput(output: string): unknown {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => line.startsWith("{"));
  expect(start).toBeGreaterThanOrEqual(0);
  return JSON.parse(lines.slice(start).join("\n")) as unknown;
}

async function runHandler(
  handler: (args: string, ctx: PiCommandContext) => Promise<void>,
  args: string,
): Promise<string> {
  let output = "";
  const originalLog = console.log;
  console.log = (line: unknown) => {
    output += `${String(line)}\n`;
  };
  try {
    await handler(args, { cwd: process.cwd() });
  } finally {
    console.log = originalLog;
  }
  return output;
}

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-evidence-status-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function logPath(root: string, missionId: string): string {
  return join(root, ".local", "evidence", `${missionId}.ndjson`);
}

/** Write a raw log line, creating the evidence store directory first. */
function writeRawLog(root: string, missionId: string, content: string): void {
  mkdirSync(join(root, ".local", "evidence"), { recursive: true });
  writeFileSync(logPath(root, missionId), content);
}

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

function statusInput(evidence?: EvidenceStatusProjectionInput): AccountingStatusInput {
  return {
    runtime: runtimeStatus(),
    scopeReport: { scope: {}, missing: [], complete: true },
    binding: makeScopeBinding(),
    mission: makeMission({ status: AccountingMissionStatus.RUNNING }),
    ...(evidence === undefined ? {} : { evidence }),
  };
}

/** Append the canonical source→transformation→conclusion→action chain. */
async function addFullChain(store: EvidenceGraphStore): Promise<EvidenceNode[]> {
  const s1 = await store.appendNode({
    id: "s1",
    missionId: MISSION,
    nodeKind: EVIDENCE_NODE_KIND.SOURCE,
    payload: { ref: "bank-statement", period: "202507" },
    createdAt: TS,
  });
  const t1 = await store.appendNode({
    id: "t1",
    missionId: MISSION,
    nodeKind: EVIDENCE_NODE_KIND.TRANSFORMATION,
    payload: { rule: "normalize-balance" },
    createdAt: TS,
  });
  const c1 = await store.appendNode({
    id: "c1",
    missionId: MISSION,
    nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
    payload: { verdict: "reconciled" },
    createdAt: TS,
  });
  const a1 = await store.appendNode({
    id: "a1",
    missionId: MISSION,
    nodeKind: EVIDENCE_NODE_KIND.ACTION,
    payload: { target: "export-close" },
    createdAt: TS,
  });
  await store.appendEdge({
    id: "e1",
    missionId: MISSION,
    from: "s1",
    to: "t1",
    relation: EVIDENCE_RELATION.DERIVED_FROM,
    createdAt: TS,
  });
  await store.appendEdge({
    id: "e2",
    missionId: MISSION,
    from: "t1",
    to: "c1",
    relation: EVIDENCE_RELATION.DERIVED_FROM,
    createdAt: TS,
  });
  await store.appendEdge({
    id: "e3",
    missionId: MISSION,
    from: "c1",
    to: "a1",
    relation: EVIDENCE_RELATION.EXECUTES,
    createdAt: TS,
  });
  return [s1, t1, c1, a1];
}

/** Rewrite a mission's log with a tampered payload hash (simulates corruption). */
function tamperNodeHash(root: string, missionId: string, digest: string): void {
  const raw = readFileSync(logPath(root, missionId), "utf8");
  const record = JSON.parse(raw) as { payloadHash: string };
  record.payloadHash = digest;
  writeRawLog(root, missionId, `${JSON.stringify(record)}\n`);
}

describe("projectEvidenceStatus — truthful verified projection (design §7/§9)", () => {
  it("projects a verified graph with every node id, kind counts, and conclusion/action ids", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await addFullChain(store);
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });

    const view = projectEvidenceStatus(input);
    expect(view.available).toBe(true);
    expect(view.integrity).toBe("verified");
    expect(view.missionId).toBe(MISSION);
    expect(view.nodeIds).toEqual(["s1", "t1", "c1", "a1"]);
    expect(view.nodeCounts).toEqual({
      source: 1,
      transformation: 1,
      conclusion: 1,
      action: 1,
    });
    expect(view.conclusionIds).toEqual(["c1"]);
    expect(view.actionIds).toEqual(["a1"]);
    expect(view.summary).toContain("4 node(s) verified");
    expect(view.summary).toContain("1 conclusion(s)");
    expect(view.summary).toContain("1 action(s)");
  });

  it("reports a verified empty graph truthfully (0 nodes, no fabricated authority)", async () => {
    const root = tempRoot();
    writeRawLog(root, MISSION, "");
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });

    const view = projectEvidenceStatus(input);
    expect(view.available).toBe(true);
    expect(view.integrity).toBe("verified");
    expect(view.nodeIds).toEqual([]);
    expect(view.nodeCounts).toEqual({
      source: 0,
      transformation: 0,
      conclusion: 0,
      action: 0,
    });
    expect(view.conclusionIds).toEqual([]);
    expect(view.actionIds).toEqual([]);
  });

  it("fails closed when no projection input is supplied", () => {
    const view = projectEvidenceStatus({});
    expect(view.available).toBe(false);
    expect(view.integrity).toBe("unavailable");
    expect(view.nodeIds).toBeUndefined();
    expect(view.conclusionIds).toBeUndefined();
    expect(view.reason).toBeDefined();
  });

  it("fails closed when the graph has no integrity validation", () => {
    const view = projectEvidenceStatus({
      missionId: MISSION,
      graph: { missionId: MISSION, nodes: [], edges: [] },
    });
    expect(view.available).toBe(false);
    expect(view.integrity).toBe("unavailable");
  });

  it("fails closed on an integrity-invalid graph and reports the validation reason", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await store.appendNode({
      id: "s1",
      missionId: MISSION,
      nodeKind: EVIDENCE_NODE_KIND.SOURCE,
      payload: { ref: "bank" },
      createdAt: TS,
    });
    tamperNodeHash(root, MISSION, "0".repeat(64));
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });

    const view = projectEvidenceStatus(input);
    expect(view.available).toBe(false);
    expect(view.integrity).toBe("unavailable");
    expect(view.reason).toMatch(/hash|tamper/i);
  });

  it("surfaces a load error as unavailable with the reason", () => {
    const view = projectEvidenceStatus({
      missionId: MISSION,
      error: "no evidence graph log for mission x — evidence unavailable",
    });
    expect(view.available).toBe(false);
    expect(view.integrity).toBe("unavailable");
    expect(view.reason).toContain("no evidence graph log");
  });
});

describe("loadEvidenceStatus — read-only, fail-closed loader (design §7)", () => {
  it("reports a missing graph log as unavailable evidence", async () => {
    const root = tempRoot();
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });
    expect(input.missionId).toBe(MISSION);
    expect(input.graph).toBeUndefined();
    expect(input.validation).toBeUndefined();
    expect(input.error).toMatch(/no evidence graph log/i);
  });

  it("fails closed on a malformed (truncated) log line", async () => {
    const root = tempRoot();
    writeRawLog(root, MISSION, '{"schemaVersion":1,"recordKind":"node",\n');
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });
    expect(input.graph).toBeUndefined();
    expect(input.error).toMatch(/malformed|corrupt/i);
  });

  it("fails closed on an unsafe mission id (no path escape)", async () => {
    const root = tempRoot();
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: "../escape" });
    expect(input.error).toBeDefined();
    expect(input.graph).toBeUndefined();
  });

  it("loads a verified graph for a mission that has evidence", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await addFullChain(store);
    const input = await loadEvidenceStatus({ storesRoot: root, missionId: MISSION });
    expect(input.graph).toBeDefined();
    expect(input.graph?.nodes).toHaveLength(4);
    expect(input.graph?.edges).toHaveLength(3);
    expect(input.validation?.valid).toBe(true);
  });
});

describe("buildAccountingStatus + renderStatusView evidence projection (design §9)", () => {
  it("projects the supplied evidence graph into the status view", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await addFullChain(store);
    const view = await buildAccountingStatus(
      statusInput(await loadEvidenceStatus({ storesRoot: root, missionId: MISSION })),
    );
    expect(view.evidence.available).toBe(true);
    expect(view.evidence.integrity).toBe("verified");
    expect(view.evidence.nodeIds).toEqual(["s1", "t1", "c1", "a1"]);
    expect(view.evidence.conclusionIds).toEqual(["c1"]);
    expect(view.evidence.actionIds).toEqual(["a1"]);
  });

  it("reports evidence unavailable — never the PR #4 placeholder — when no graph is supplied", async () => {
    const view = await buildAccountingStatus(statusInput());
    expect(view.evidence.available).toBe(false);
    expect(view.evidence.integrity).toBe("unavailable");
    expect(view.evidence.summary).not.toContain("PR #4");
    expect(view.evidence.summary).not.toContain("S3b");
    expect(view.evidence.reason).toBeDefined();
  });

  it("renders the evidence projection through renderStatusView", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await addFullChain(store);
    const output = await renderStatusView({
      company: "20123456786",
      period: "202507",
      runtime: runtimeStatus(),
      scopeReport: { scope: {}, missing: [], complete: true },
      binding: makeScopeBinding(),
      mission: makeMission({ status: AccountingMissionStatus.RUNNING }),
      evidence: await loadEvidenceStatus({ storesRoot: root, missionId: MISSION }),
    });
    const machine = output.machine as { evidence: EvidenceStatusView };
    expect(machine.evidence.available).toBe(true);
    expect(machine.evidence.nodeIds).toEqual(["s1", "t1", "c1", "a1"]);
    expect(output.summary).toContain("evidence");
  });

  it("fails closed end-to-end: a tampered graph stays unavailable in the status view", async () => {
    const root = tempRoot();
    const store = new EvidenceGraphStore(root);
    await store.appendNode({
      id: "s1",
      missionId: MISSION,
      nodeKind: EVIDENCE_NODE_KIND.SOURCE,
      payload: { ref: "bank" },
      createdAt: TS,
    });
    tamperNodeHash(root, MISSION, "1".repeat(64));
    const view = await buildAccountingStatus(
      statusInput(await loadEvidenceStatus({ storesRoot: root, missionId: MISSION })),
    );
    expect(view.evidence.available).toBe(false);
    expect(view.evidence.integrity).toBe("unavailable");
    expect(view.evidence.nodeIds).toBeUndefined();
  });
});

describe("drenyra:status command integration — evidence projection wiring (design §9)", () => {
  it("reports evidence unavailable when the active mission has no graph", async () => {
    const root = tempRoot();
    const { pi, registered } = makeMockPi();
    const store = new ScopeContextStore(join(root, "context.json"));
    registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
    store.setCanonicalScope(makeCanonicalScope());
    const closeCmd = registered.find((c) => c.name === "drenyra:close");
    const statusCmd = registered.find((c) => c.name === "drenyra:status");
    expect(closeCmd).toBeDefined();
    expect(statusCmd).toBeDefined();

    // The close creates a mission that waits for evidence (REQ-MISS-009).
    const output = await runHandler(closeCmd!.handler, "contador-01");
    const close = parseMachineOutput(output) as { missionId: string; status: string };
    expect(close.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);

    // The active mission's graph log does not exist yet: evidence is
    // unavailable with the mission id — never implied valid.
    const statusOut = await runHandler(statusCmd!.handler, "");
    const machine = parseMachineOutput(statusOut) as {
      mission: { id: string } | undefined;
      evidence: EvidenceStatusView;
    };
    expect(machine.mission?.id).toBe(close.missionId);
    expect(machine.evidence.available).toBe(false);
    expect(machine.evidence.integrity).toBe("unavailable");
    expect(machine.evidence.missionId).toBe(close.missionId);
    expect(machine.evidence.reason).toMatch(/no evidence graph log/i);
  });

  it("projects the active mission's verified evidence graph through /drenyra:status", async () => {
    const root = tempRoot();
    const { pi, registered } = makeMockPi();
    const store = new ScopeContextStore(join(root, "context.json"));
    registerDrenyraPiExtension(pi, { contextStore: store, storesRoot: root });
    store.setCanonicalScope(makeCanonicalScope());
    const evidenceCmd = registered.find((c) => c.name === "drenyra:evidence");
    const statusCmd = registered.find((c) => c.name === "drenyra:status");
    expect(evidenceCmd).toBeDefined();
    expect(statusCmd).toBeDefined();

    // An evidence op without an explicit missionId targets the chain's own
    // mission — the same mission the status command reports as active.
    const output = await runHandler(
      evidenceCmd!.handler,
      JSON.stringify({
        op: "add-node",
        node: SOURCE_NODES[0],
      }),
    );
    expect(output).toContain("drenyra:evidence:");

    // Status projects the verified graph with every evidence node id.
    const statusOut = await runHandler(statusCmd!.handler, "");
    expect(statusOut).toContain("evidence: verified");
    const machine = parseMachineOutput(statusOut) as {
      mission: { id: string } | undefined;
      evidence: EvidenceStatusView;
    };
    expect(machine.mission?.id).toBeDefined();
    expect(machine.evidence.available).toBe(true);
    expect(machine.evidence.integrity).toBe("verified");
    expect(machine.evidence.missionId).toBe(machine.mission?.id);
    expect(machine.evidence.nodeIds).toEqual(["src-balance"]);
    expect(machine.evidence.nodeCounts?.source).toBe(1);
  });
});
