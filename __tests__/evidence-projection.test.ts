import { describe, expect, it } from "vitest";
import { computeEvidenceHash } from "drenyra-ai/receipts";
import { sha256Canonical } from "../lib/canonicalization.js";
import {
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
  type EvidenceEdge,
  type EvidenceGraph,
  type EvidenceGraphValidation,
  type EvidenceNode,
} from "../lib/evidence-graph.js";
import {
  projectEvidenceProvenance,
  projectEvidenceProvenanceSet,
} from "../lib/evidence-projection.js";

const MISSION = "mission-audit-001";
const TS = "2026-07-01T00:00:00.000Z";

function node(
  id: string,
  nodeKind: EvidenceNode["nodeKind"],
  payload: Record<string, unknown>,
): EvidenceNode {
  return {
    schemaVersion: 1,
    recordKind: "node",
    id,
    missionId: MISSION,
    nodeKind,
    payload,
    payloadHash: sha256Canonical(payload),
    createdAt: TS,
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  relation: EvidenceEdge["relation"],
): EvidenceEdge {
  return {
    schemaVersion: 1,
    recordKind: "edge",
    id,
    missionId: MISSION,
    from,
    to,
    relation,
    createdAt: TS,
  };
}

function fullGraph(): EvidenceGraph {
  return {
    missionId: MISSION,
    nodes: [
      node("action-1", EVIDENCE_NODE_KIND.ACTION, { target: "close" }),
      node("source-1", EVIDENCE_NODE_KIND.SOURCE, { ref: "bank" }),
      node("conclusion-1", EVIDENCE_NODE_KIND.CONCLUSION, {
        verdict: "reconciled",
      }),
      node("transform-1", EVIDENCE_NODE_KIND.TRANSFORMATION, {
        rule: "normalize",
      }),
    ],
    edges: [
      edge("edge-3", "conclusion-1", "action-1", EVIDENCE_RELATION.EXECUTES),
      edge("edge-1", "source-1", "transform-1", EVIDENCE_RELATION.DERIVED_FROM),
      edge(
        "edge-2",
        "transform-1",
        "conclusion-1",
        EVIDENCE_RELATION.DERIVED_FROM,
      ),
    ],
  };
}

const VERIFIED: EvidenceGraphValidation = {
  valid: true,
  tamperedNodeIds: [],
  errors: [],
};

describe("projectEvidenceProvenance", () => {
  it("projects deterministic terminal identity, complete lineage, verified hashes, and receipt evidence hash", () => {
    const graph = fullGraph();
    const before = structuredClone(graph);

    const projection = projectEvidenceProvenance({
      graph,
      validation: VERIFIED,
      terminalNodeId: "action-1",
    });

    expect(projection.terminal).toEqual({
      missionId: MISSION,
      nodeId: "action-1",
      nodeKind: EVIDENCE_NODE_KIND.ACTION,
      payloadHash: graph.nodes[0]?.payloadHash,
    });
    expect(projection.validationState).toBe("verified");
    expect(projection.nodes.map((item) => item.id)).toEqual([
      "source-1",
      "transform-1",
      "conclusion-1",
      "action-1",
    ]);
    expect(projection.nodes.every((item) => item.payloadHashVerified)).toBe(
      true,
    );
    expect(
      projection.nodes.every(
        (item) => item.recomputedPayloadHash === item.storedPayloadHash,
      ),
    ).toBe(true);
    expect(projection.edges.map((item) => item.id)).toEqual([
      "edge-3",
      "edge-1",
      "edge-2",
    ]);
    expect(projection.receiptEvidenceHash).toBe(
      computeEvidenceHash([
        { id: "source-1", label: "source", type: "source" },
        { id: "transform-1", label: "transformation", type: "transformation" },
        { id: "conclusion-1", label: "conclusion", type: "conclusion" },
        { id: "action-1", label: "action", type: "action" },
      ]),
    );
    expect(projection.blockingReasons).toEqual([]);
    expect(graph).toEqual(before);
  });

  it("fails closed with concise reasons and no receipt evidence hash when payload validation fails", () => {
    const graph = fullGraph();
    const source = graph.nodes.find((candidate) => candidate.id === "source-1");
    expect(source).toBeDefined();
    source!.payloadHash = "0".repeat(64);

    const projection = projectEvidenceProvenance({
      graph,
      validation: {
        valid: false,
        tamperedNodeIds: ["source-1"],
        errors: ["node source-1: payload hash does not match its content"],
      },
      terminalNodeId: "action-1",
    });

    expect(projection.validationState).toBe("blocked");
    expect(projection.receiptEvidenceHash).toBeUndefined();
    expect(
      projection.nodes.find((item) => item.id === "source-1")
        ?.payloadHashVerified,
    ).toBe(false);
    expect(projection.blockingReasons.join("; ")).toMatch(
      /validation failed|hash mismatch/i,
    );
  });

  it("fails closed for an unknown terminal and never invents terminal authority", () => {
    const projection = projectEvidenceProvenance({
      graph: fullGraph(),
      validation: VERIFIED,
      terminalNodeId: "missing",
    });
    expect(projection.validationState).toBe("blocked");
    expect(projection.terminal).toEqual({
      missionId: MISSION,
      nodeId: "missing",
    });
    expect(projection.nodes).toEqual([]);
    expect(projection.receiptEvidenceHash).toBeUndefined();
    expect(projection.blockingReasons).toContain(
      "terminal node missing does not exist",
    );
  });

  it("projects only leaf conclusions and actions in stable terminal-id order", () => {
    const graph = fullGraph();
    graph.nodes.push(
      node("conclusion-2", EVIDENCE_NODE_KIND.CONCLUSION, {
        verdict: "review",
      }),
    );
    graph.edges.push(
      edge(
        "edge-4",
        "source-1",
        "conclusion-2",
        EVIDENCE_RELATION.DERIVED_FROM,
      ),
    );

    const projections = projectEvidenceProvenanceSet(graph, VERIFIED);
    expect(projections.map((item) => item.terminal.nodeId)).toEqual([
      "action-1",
      "conclusion-2",
    ]);
  });
});
