/**
 * Evidence graph — RED/GREEN tests for T-S3B-001 (append-only per-mission graph
 * store; design §7.1/§7.4) and T-S3B-002 (integrity validation + receipt
 * evidence hash; design §7.2/§7.3). The graph is the durable provenance trail
 * receipts and conclusions bind to.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { computeEvidenceHash, type EvidenceItem } from "drenyra-ai/receipts";
import {
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
  EvidenceGraphStore,
  type EvidenceGraph,
  type EvidenceNode,
} from "../lib/evidence-graph.js";
import { sha256Canonical } from "../lib/canonicalization.js";

const TS = "2026-07-01T00:00:00.000Z";
const MISSION = "mission-close-001";
const HEX64 = /^[0-9a-f]{64}$/;

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-evidence-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeStore(root: string): EvidenceGraphStore {
  return new EvidenceGraphStore(root);
}

function logPath(root: string, missionId: string): string {
  return join(root, ".local", "evidence", `${missionId}.ndjson`);
}

/** Append a node with the fixed fixture timestamp (deterministic replay). */
async function addNode(
  store: EvidenceGraphStore,
  id: string,
  nodeKind: keyof typeof EVIDENCE_NODE_KIND,
  payload: unknown = { ref: id },
): Promise<EvidenceNode> {
  return store.appendNode({
    id,
    missionId: MISSION,
    nodeKind: EVIDENCE_NODE_KIND[nodeKind],
    payload,
    createdAt: TS,
  });
}

/** Append the canonical source→transformation→conclusion→action chain. */
async function addFullChain(store: EvidenceGraphStore): Promise<EvidenceNode[]> {
  const s1 = await addNode(store, "s1", "SOURCE", { ref: "bank-statement", period: "202507" });
  const t1 = await addNode(store, "t1", "TRANSFORMATION", { rule: "normalize-balance" });
  const c1 = await addNode(store, "c1", "CONCLUSION", { verdict: "reconciled" });
  const a1 = await addNode(store, "a1", "ACTION", { target: "export-close" });
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

/** Project graph nodes to engine evidence items the same way the store does. */
function projectEvidence(nodes: readonly EvidenceNode[]): EvidenceItem[] {
  const seen = new Set<string>();
  const items: EvidenceItem[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    items.push({ id: node.id, label: node.nodeKind, type: node.nodeKind });
  }
  return items;
}

/** Append a raw NDJSON line to a mission log (simulates external tampering). */
function appendRawLine(root: string, missionId: string, line: string): void {
  writeFileSync(logPath(root, missionId), `${line}\n`, { flag: "a" });
}

describe("T-S3B-001 EvidenceGraphStore (design §7.1)", () => {
  it("appends all four node kinds with lowercase hex sha-256 payload hashes (REQ-EVID-001/003)", async () => {
    const store = makeStore(tempRoot());
    const s1 = await addNode(store, "s1", "SOURCE");
    const t1 = await addNode(store, "t1", "TRANSFORMATION");
    const c1 = await addNode(store, "c1", "CONCLUSION");
    const a1 = await addNode(store, "a1", "ACTION");

    for (const node of [s1, t1, c1, a1]) {
      expect(node.schemaVersion).toBe(1);
      expect(node.recordKind).toBe("node");
      expect(node.missionId).toBe(MISSION);
      expect(node.payloadHash).toMatch(HEX64);
      expect(node.createdAt).toBe(TS);
    }
    expect([s1, t1, c1, a1].map((node) => node.nodeKind)).toEqual([
      "source",
      "transformation",
      "conclusion",
      "action",
    ]);
  });

  it("computes the payload hash over the canonical payload (REQ-EVID-003)", async () => {
    const store = makeStore(tempRoot());
    const node = await addNode(store, "s1", "SOURCE", { ref: "bank", amount: 150n });
    expect(node.payloadHash).toBe(sha256Canonical({ ref: "bank", amount: 150n }));
  });

  it("rejects a float money payload at the JSON boundary (REQ-CONTRACTS-008)", async () => {
    const store = makeStore(tempRoot());
    await expect(addNode(store, "s1", "SOURCE", { ref: "bank", amount: 1.5 })).rejects.toThrow(
      /float/,
    );
  });

  it("records DERIVED_FROM/SUPPORTS/EXECUTES edges and traverses the full lineage (REQ-EVID-002; SC-EVID-001)", async () => {
    const store = makeStore(tempRoot());
    await addFullChain(store);
    const graph = await store.load(MISSION);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.map((edge) => edge.relation)).toEqual([
      "DERIVED_FROM",
      "DERIVED_FROM",
      "EXECUTES",
    ]);

    const lineage = await store.lineage(MISSION, "a1");
    expect(lineage.ancestors.map((node) => node.id)).toEqual(["s1", "t1", "c1"]);
    expect(lineage.edges.map((edge) => edge.id)).toEqual(["e1", "e2"]);
  });

  it("rejects a conclusion with no cited source or transformation (REQ-EVID-004; SC-EVID-002)", async () => {
    const store = makeStore(tempRoot());
    await addNode(store, "c1", "CONCLUSION");
    await addNode(store, "c2", "CONCLUSION");
    await expect(
      store.appendEdge({
        id: "e1",
        missionId: MISSION,
        from: "c2",
        to: "c1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    ).rejects.toThrow(/citation|cite/i);
  });

  it("rejects an edge into a source and an edge out of an action (terminal lineage)", async () => {
    const store = makeStore(tempRoot());
    await addNode(store, "s1", "SOURCE");
    await addNode(store, "s2", "SOURCE");
    await addNode(store, "a1", "ACTION");
    await expect(
      store.appendEdge({
        id: "e1",
        missionId: MISSION,
        from: "s2",
        to: "s1",
        relation: EVIDENCE_RELATION.SUPPORTS,
        createdAt: TS,
      }),
    ).rejects.toThrow(/source/i);
    await expect(
      store.appendEdge({
        id: "e2",
        missionId: MISSION,
        from: "a1",
        to: "s1",
        relation: EVIDENCE_RELATION.SUPPORTS,
        createdAt: TS,
      }),
    ).rejects.toThrow(/action/i);
  });

  it("is append-only: no update/delete API and changed content becomes new nodes (REQ-EVID-005; SC-EVID-004)", async () => {
    const store = makeStore(tempRoot());
    const original = await addNode(store, "s1", "SOURCE", { ref: "bank" });
    expect("updateNode" in store).toBe(false);
    expect("deleteNode" in store).toBe(false);

    // Mutating in place is rejected: same id, different payload bytes.
    await expect(
      addNode(store, "s1", "SOURCE", { ref: "bank-altered" }),
    ).rejects.toThrow(/duplicate|conflict/i);

    // New content becomes a new node; the original is untouched immutable history.
    const s2 = await addNode(store, "s2", "SOURCE", { ref: "bank-altered" });
    expect(s2.id).toBe("s2");
    const graph = await store.load(MISSION);
    expect(graph.nodes.map((node) => node.id)).toEqual(["s1", "s2"]);
    expect(graph.nodes[0]).toEqual(original);
  });

  it("replays a byte-identical duplicate node id idempotently", async () => {
    const store = makeStore(tempRoot());
    const first = await addNode(store, "s1", "SOURCE", { ref: "bank" });
    const replay = await addNode(store, "s1", "SOURCE", { ref: "bank" });
    expect(replay).toEqual(first);
    const graph = await store.load(MISSION);
    expect(graph.nodes).toHaveLength(1);
  });

  it("replays a byte-identical duplicate edge id idempotently", async () => {
    const store = makeStore(tempRoot());
    await addFullChain(store);
    await store.appendEdge({
      id: "e1",
      missionId: MISSION,
      from: "s1",
      to: "t1",
      relation: EVIDENCE_RELATION.DERIVED_FROM,
      createdAt: TS,
    });
    const graph = await store.load(MISSION);
    expect(graph.edges).toHaveLength(3);
  });

  it("blocks a duplicate edge id with differing bytes", async () => {
    const store = makeStore(tempRoot());
    await addFullChain(store);
    await expect(
      store.appendEdge({
        id: "e1",
        missionId: MISSION,
        from: "t1",
        to: "c1",
        relation: EVIDENCE_RELATION.SUPPORTS,
        createdAt: TS,
      }),
    ).rejects.toThrow(/duplicate|conflict/i);
  });

  it("rejects edges whose endpoints do not exist in the same mission (REQ-EVID-002; cross-mission)", async () => {
    const store = makeStore(tempRoot());
    await addNode(store, "s1", "SOURCE");
    await addNode(store, "c1", "CONCLUSION");
    await addNode(store, "s2", "SOURCE");
    // Endpoint missing entirely.
    await expect(
      store.appendEdge({
        id: "e1",
        missionId: MISSION,
        from: "s1",
        to: "ghost",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    ).rejects.toThrow(/endpoint|exist/i);
    // Cross-mission edge: s2 belongs to another mission's log.
    await expect(
      store.appendEdge({
        id: "e2",
        missionId: "mission-other",
        from: "s2",
        to: "s1",
        relation: EVIDENCE_RELATION.SUPPORTS,
        createdAt: TS,
      }),
    ).rejects.toThrow(/endpoint|exist/i);
  });

  it("rejects an edge that would create a cycle (design §7.2)", async () => {
    const store = makeStore(tempRoot());
    await addFullChain(store);
    await expect(
      store.appendEdge({
        id: "e4",
        missionId: MISSION,
        from: "c1",
        to: "s1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    ).rejects.toThrow(/cycle/i);
    await expect(
      store.appendEdge({
        id: "e5",
        missionId: MISSION,
        from: "s1",
        to: "s1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    ).rejects.toThrow(/cycle/i);
  });

  it("fails closed on a malformed line (design §7.2, §15)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addNode(store, "s1", "SOURCE");
    appendRawLine(root, MISSION, "this is not json");
    await expect(store.load(MISSION)).rejects.toThrow(/malformed|repair/i);
  });

  it("fails closed on a truncated line (design §7.2, §15)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addNode(store, "s1", "SOURCE");
    appendRawLine(root, MISSION, '{"schemaVersion":1,"recordKind":"node","id":"s2"');
    await expect(store.load(MISSION)).rejects.toThrow(/malformed|repair/i);
  });

  it("fails closed when a line belongs to a different mission", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addNode(store, "s1", "SOURCE");
    appendRawLine(
      root,
      MISSION,
      JSON.stringify({
        schemaVersion: 1,
        recordKind: "node",
        id: "s9",
        missionId: "mission-other",
        nodeKind: "source",
        payload: { ref: "x" },
        payloadHash: sha256Canonical({ ref: "x" }),
        createdAt: TS,
      }),
    );
    await expect(store.load(MISSION)).rejects.toThrow(/mission/i);
  });

  it("rejects a mission id that could traverse paths (design §15)", async () => {
    const store = makeStore(tempRoot());
    await expect(addNode(store, "s1", "SOURCE").then((n) => n)).resolves.toBeTruthy();
    await expect(
      store.appendNode({
        id: "s1",
        missionId: "../escape",
        nodeKind: EVIDENCE_NODE_KIND.SOURCE,
        payload: { ref: "bank" },
        createdAt: TS,
      }),
    ).rejects.toThrow(/safe store identifier/i);
    await expect(store.load("../escape")).rejects.toThrow(/safe store identifier/i);
  });

  it("emitted records validate against the evidence contract schemas (REQ-CONTRACTS-002)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    const graph = await store.load(MISSION);
    const document = { schemaVersion: 1, missionId: MISSION, nodes: graph.nodes, edges: graph.edges };

    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const HERE = dirname(fileURLToPath(import.meta.url));
    const schemaDir = join(HERE, "..", "contracts", "evidence");
    for (const name of ["node.schema.json", "edge.schema.json", "graph.schema.json"]) {
      const schema = JSON.parse(readFileSync(join(schemaDir, name), "utf8")) as { $id?: string };
      if (typeof schema.$id === "string") {
        ajv.addSchema(schema as Parameters<Ajv["addSchema"]>[0], schema.$id);
      }
    }
    const valid = ajv.validate(
      "https://drenyra.dev/harness/contracts/evidence/graph.schema.json",
      document,
    );
    expect(valid, JSON.stringify(ajv.errors, null, 2)).toBe(true);
  });
});

describe("T-S3B-002 integrity validation + receipt evidence hash (design §7.2/§7.3)", () => {
  it("validate() recomputes payload hashes and identifies a tampered node (REQ-EVID-008; SC-EVID-003)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);

    const lines = readFileSync(logPath(root, MISSION), "utf8").trim().split("\n");
    const tampered = lines.map((line) => {
      const record = JSON.parse(line) as EvidenceNode & { relation?: string };
      if (record.recordKind !== "node" || record.id !== "s1") {
        return line;
      }
      return JSON.stringify({
        ...record,
        payload: { ref: "bank-statement", period: "202507" },
        payloadHash: "0".repeat(64),
      });
    });
    writeFileSync(logPath(root, MISSION), `${tampered.join("\n")}\n`);

    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(false);
    expect(validation.tamperedNodeIds).toEqual(["s1"]);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("lineage() and computeReceiptEvidenceHash() fail closed on a tampered payload", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    appendRawLine(
      root,
      MISSION,
      JSON.stringify({
        schemaVersion: 1,
        recordKind: "node",
        id: "s2",
        missionId: MISSION,
        nodeKind: "source",
        payload: { ref: "bank-2" },
        payloadHash: "0".repeat(64),
        createdAt: TS,
      }),
    );
    await expect(store.lineage(MISSION, "a1")).rejects.toThrow(/tamper|integrity/i);
    await expect(store.computeReceiptEvidenceHash(MISSION, ["a1"])).rejects.toThrow(
      /tamper|integrity/i,
    );
  });

  it("computeReceiptEvidenceHash is insertion-order stable (REQ-EVID-006; SC-EVID-005)", async () => {
    const rootA = tempRoot();
    const rootB = tempRoot();
    const storeA = makeStore(rootA);
    const storeB = makeStore(rootB);

    await addNode(storeA, "s1", "SOURCE");
    await addNode(storeA, "c1", "CONCLUSION");
    await storeA.appendEdge({
      id: "e1",
      missionId: MISSION,
      from: "s1",
      to: "c1",
      relation: EVIDENCE_RELATION.DERIVED_FROM,
      createdAt: TS,
    });

    // Reversed insertion order in the second mission.
    await addNode(storeB, "c1", "CONCLUSION");
    await addNode(storeB, "s1", "SOURCE");
    await storeB.appendEdge({
      id: "e1",
      missionId: MISSION,
      from: "s1",
      to: "c1",
      relation: EVIDENCE_RELATION.DERIVED_FROM,
      createdAt: TS,
    });

    const hashA = await storeA.computeReceiptEvidenceHash(MISSION, ["c1"]);
    const hashB = await storeB.computeReceiptEvidenceHash(MISSION, ["c1"]);
    expect(hashA).toMatch(HEX64);
    expect(hashA).toBe(hashB);
  });

  it("covers the full ancestor closure of the terminal nodes (REQ-EVID-007)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    const [s1, t1, c1, a1] = await addFullChain(store);

    const hash = await store.computeReceiptEvidenceHash(MISSION, ["a1"]);
    const expected = computeEvidenceHash(projectEvidence([s1, t1, c1, a1]));
    expect(hash).toBe(expected);

    // Only the conclusion closure: source + conclusion, no action.
    const partial = await store.computeReceiptEvidenceHash(MISSION, ["c1"]);
    expect(partial).toBe(computeEvidenceHash(projectEvidence([s1, t1, c1])));
  });

  it("deduplicates evidence by node id in the receipt hash", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    const [s1, t1, c1, a1] = await addFullChain(store);
    const single = await store.computeReceiptEvidenceHash(MISSION, ["a1"]);
    const repeated = await store.computeReceiptEvidenceHash(MISSION, ["a1", "a1", "a1"]);
    expect(repeated).toBe(single);
    expect(single).toBe(computeEvidenceHash(projectEvidence([s1, t1, c1, a1])));
  });

  it("rejects an unknown terminal node id (fail closed)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    await expect(store.computeReceiptEvidenceHash(MISSION, ["ghost"])).rejects.toThrow(
      /unknown|exist/i,
    );
  });

  it("validate() rejects an uncited conclusion left in the graph", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    await addNode(store, "c9", "CONCLUSION", { verdict: "unsupported" });
    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join("; ")).toMatch(/c9/i);
  });

  it("validate() rejects an ungrounded action (REQ-EVID-007)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    await addNode(store, "a9", "ACTION", { target: "no-evidence" });
    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join("; ")).toMatch(/a9/i);
  });

  it("validate() detects a cycle introduced by a raw file edit", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    appendRawLine(
      root,
      MISSION,
      JSON.stringify({
        schemaVersion: 1,
        recordKind: "edge",
        id: "e9",
        missionId: MISSION,
        from: "t1",
        to: "s1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    );
    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join("; ")).toMatch(/cycle/i);
  });

  it("validate() rejects an edge with a dangling endpoint (raw file edit)", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    appendRawLine(
      root,
      MISSION,
      JSON.stringify({
        schemaVersion: 1,
        recordKind: "edge",
        id: "e9",
        missionId: MISSION,
        from: "ghost",
        to: "c1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    );
    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join("; ")).toMatch(/endpoint/i);
  });

  it("lineage() and computeReceiptEvidenceHash() fail closed on a dangling edge", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    appendRawLine(
      root,
      MISSION,
      JSON.stringify({
        schemaVersion: 1,
        recordKind: "edge",
        id: "e9",
        missionId: MISSION,
        from: "ghost",
        to: "c1",
        relation: EVIDENCE_RELATION.DERIVED_FROM,
        createdAt: TS,
      }),
    );
    await expect(store.lineage(MISSION, "a1")).rejects.toThrow(/integrity/i);
    await expect(store.computeReceiptEvidenceHash(MISSION, ["a1"])).rejects.toThrow(/integrity/i);
  });

  it("validate() reports a clean graph as valid", async () => {
    const root = tempRoot();
    const store = makeStore(root);
    await addFullChain(store);
    const validation = await store.validate(MISSION);
    expect(validation.valid).toBe(true);
    expect(validation.tamperedNodeIds).toEqual([]);
    expect(validation.errors).toEqual([]);
  });

  it("load() returns an empty graph for a mission with no records", async () => {
    const store = makeStore(tempRoot());
    const graph: EvidenceGraph = await store.load("mission-empty");
    expect(graph.missionId).toBe("mission-empty");
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
