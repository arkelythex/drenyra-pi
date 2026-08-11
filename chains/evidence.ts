/**
 * Evidence chain — the EDA `evidence` intent chain (design §11.5; REQ-CHAIN-004;
 * SC-CHAIN-006).
 *
 * The chain runs an `evidence` mission through the shared `runChainStep`
 * pipeline and performs append-only evidence operations on the TARGET mission's
 * evidence graph (the input `missionId`, or its own mission when absent): add a
 * source/transformation/conclusion/action node with a canonical payload hash,
 * add a lineage edge, query a node by id, or query the full lineage of a node.
 * Add operations enforce node/edge schemas and lineage rules — a conclusion
 * without citations is rejected (REQ-EVID-004) and every citation must exist in
 * the target mission (the graph stays bound to the mission; cross-mission edges
 * are rejected, design §7.2). Queries are read-only and fail closed on unknown
 * ids. Inputs are bounded and fail closed on invalid payloads (floats, unknown
 * properties, malformed ops).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or integer decimal strings at JSON boundaries — never floats);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { AUTHORITY_MODE } from "../runtime/context.js";
import type { EdaPhase } from "../lib/accounting-status.js";
import {
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
  type EvidenceGraphStore,
  type EvidenceNode,
  type EvidenceNodeKind,
} from "../lib/evidence-graph.js";
import type {
  ChainDefinition,
  ChainStepContext,
  ChainStepOutcome,
} from "../lib/chain-pipeline.js";
import { parseJsonOrThrow } from "../lib/parse.js";

/** One bounded evidence op envelope (the command boundary). */
export type EvidenceOp =
  | {
      op: "add-node";
      node: {
        id: string;
        nodeKind: EvidenceNodeKind;
        /** For conclusions, `citations` must name existing nodes (REQ-EVID-004). */
        payload: Record<string, unknown> & { citations?: readonly string[] };
      };
    }
  | {
      op: "add-edge";
      edge: {
        id: string;
        from: string;
        to: string;
        relation: (typeof EVIDENCE_RELATION)[keyof typeof EVIDENCE_RELATION];
      };
    }
  | { op: "query-node"; nodeId: string }
  | { op: "query-lineage"; nodeId: string };

/** Chain input: the target mission plus one bounded op per invocation. */
export interface EvidenceChainInput {
  /** The mission whose graph the op targets; defaults to the chain's mission. */
  missionId?: string;
  op: EvidenceOp;
}

/** The chain's deterministic outcome for one op. */
export interface EvidenceRunOutput {
  op: string;
  phase: EdaPhase;
  /** Present for `add-node` outcomes. */
  node?: EvidenceNode;
  /** Present for `query-node` outcomes. */
  queriedNode?: EvidenceNode;
  /** Present for `query-lineage` outcomes. */
  lineage?: Awaited<ReturnType<EvidenceGraphStore["lineage"]>>;
}

/** Safe record ids (letters, digits, dot, underscore, colon, slash, dash). */
const RECORD_ID_RE = /^[A-Za-z0-9._:/-]{1,256}$/;

/** Integer decimal money at the boundary (JSON integer or decimal string). */
const INTEGER_RE = /^-?\d+$/;

/** The op kinds the chain accepts (fail closed on anything else). */
const OP_KINDS = ["add-node", "add-edge", "query-node", "query-lineage"] as const;

function assertRecordId(value: unknown, label: string): string {
  if (typeof value !== "string" || !RECORD_ID_RE.test(value)) {
    throw new Error(
      `evidence: ${label} must be 1-256 characters of letters, digits, '.', '_', ':', '/', '-'`,
    );
  }
  return value;
}

/** Reject float money and unknown properties inside a node payload. */
function validatePayload(payload: unknown): void {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("evidence: a node payload object is required");
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key === "amountCents" || key.endsWith("Cents")) {
      if (typeof value === "number") {
        if (!Number.isInteger(value)) {
          throw new Error(
            `evidence: float money rejected in the payload (${key}: ${value}) — use integer cents or an integer decimal string`,
          );
        }
        continue;
      }
      if (typeof value === "string") {
        if (!INTEGER_RE.test(value)) {
          throw new Error(
            `evidence: payload ${key} must be integer cents or an integer decimal string (got ${value})`,
          );
        }
        continue;
      }
      throw new Error(
        `evidence: payload ${key} must be integer cents or an integer decimal string`,
      );
    }
  }
}

/**
 * Parse and validate a bounded evidence op envelope from JSON (the command
 * boundary). Floats, unknown ops, missing payloads, malformed ids, and unknown
 * envelope properties all fail closed.
 */
export function parseEvidenceOp(json: string): {
  missionId?: string;
  op: EvidenceOp;
} {
  const parsed = parseJsonOrThrow<unknown>(
    json,
    "evidence: the op envelope is not valid JSON",
    { includeMessage: true },
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("evidence: the op envelope must be an object");
  }
  const record = parsed as Record<string, unknown>;
  const missionId = record.missionId;
  if (
    missionId !== undefined &&
    (typeof missionId !== "string" || missionId.length === 0)
  ) {
    throw new Error("evidence: missionId must be a non-empty string");
  }
  const opKind = record.op;
  if (typeof opKind !== "string" || !(OP_KINDS as readonly string[]).includes(opKind)) {
    throw new Error(
      `evidence: unsupported op "${String(opKind)}" — expected one of ${OP_KINDS.join(", ")}`,
    );
  }

  switch (opKind) {
    case "add-node": {
      for (const key of Object.keys(record)) {
        if (key !== "op" && key !== "missionId" && key !== "node") {
          throw new Error(`evidence: unknown property "${key}" is rejected`);
        }
      }
      const node = record.node;
      if (typeof node !== "object" || node === null || Array.isArray(node)) {
        throw new Error("evidence: add-node requires a node object");
      }
      const nodeRecord = node as Record<string, unknown>;
      for (const key of Object.keys(nodeRecord)) {
        if (key !== "id" && key !== "nodeKind" && key !== "payload") {
          throw new Error(`evidence: node unknown property "${key}" is rejected`);
        }
      }
      const id = assertRecordId(nodeRecord.id, "node id");
      const nodeKind = nodeRecord.nodeKind;
      if (
        typeof nodeKind !== "string" ||
        !(Object.values(EVIDENCE_NODE_KIND) as string[]).includes(nodeKind)
      ) {
        throw new Error(
          `evidence: nodeKind must be one of ${Object.values(EVIDENCE_NODE_KIND).join(", ")}`,
        );
      }
      if (nodeRecord.payload === undefined) {
        throw new Error("evidence: add-node requires a payload object");
      }
      validatePayload(nodeRecord.payload);
      return {
        ...(missionId === undefined ? {} : { missionId: missionId as string }),
        op: {
          op: "add-node",
          node: {
            id,
            nodeKind: nodeKind as EvidenceNodeKind,
            payload: nodeRecord.payload as Record<string, unknown> & {
              citations?: readonly string[];
            },
          },
        },
      };
    }
    case "add-edge": {
      for (const key of Object.keys(record)) {
        if (key !== "op" && key !== "missionId" && key !== "edge") {
          throw new Error(`evidence: unknown property "${key}" is rejected`);
        }
      }
      const edge = record.edge;
      if (typeof edge !== "object" || edge === null || Array.isArray(edge)) {
        throw new Error("evidence: add-edge requires an edge object");
      }
      const edgeRecord = edge as Record<string, unknown>;
      for (const key of Object.keys(edgeRecord)) {
        if (key !== "id" && key !== "from" && key !== "to" && key !== "relation") {
          throw new Error(`evidence: edge unknown property "${key}" is rejected`);
        }
      }
      const id = assertRecordId(edgeRecord.id, "edge id");
      const from = assertRecordId(edgeRecord.from, "edge from");
      const to = assertRecordId(edgeRecord.to, "edge to");
      const relation = edgeRecord.relation;
      if (
        typeof relation !== "string" ||
        !(Object.values(EVIDENCE_RELATION) as string[]).includes(relation)
      ) {
        throw new Error(
          `evidence: relation must be one of ${Object.values(EVIDENCE_RELATION).join(", ")}`,
        );
      }
      return {
        ...(missionId === undefined ? {} : { missionId: missionId as string }),
        op: {
          op: "add-edge",
          edge: {
            id,
            from,
            to,
            relation: relation as (typeof EVIDENCE_RELATION)[keyof typeof EVIDENCE_RELATION],
          },
        },
      };
    }
    case "query-node":
    case "query-lineage": {
      for (const key of Object.keys(record)) {
        if (key !== "op" && key !== "missionId" && key !== "nodeId") {
          throw new Error(`evidence: unknown property "${key}" is rejected`);
        }
      }
      const nodeId = assertRecordId(record.nodeId, "node id");
      return {
        ...(missionId === undefined ? {} : { missionId: missionId as string }),
        op: { op: opKind, nodeId },
      };
    }
  }
  throw new Error(`evidence: unsupported op "${opKind}"`);
}

/**
 * Execute one bounded evidence op against the target mission's graph. The op
 * runs on every prepared phase (pass-through): exactly one op per chain step.
 */
async function executeOp(
  graph: EvidenceGraphStore,
  missionId: string,
  op: EvidenceOp,
): Promise<Pick<EvidenceRunOutput, "node" | "queriedNode" | "lineage">> {
  switch (op.op) {
    case "add-node": {
      const { id, nodeKind, payload } = op.node;
      if (nodeKind === EVIDENCE_NODE_KIND.CONCLUSION) {
        const citations = payload.citations;
        if (citations === undefined || citations.length === 0) {
          throw new Error(
            "evidence: a conclusion must have citations — at least one supporting node (REQ-EVID-004)",
          );
        }
        const loaded = await graph.load(missionId);
        const existing = new Set(loaded.nodes.map((node) => node.id));
        for (const citation of citations) {
          if (!existing.has(citation)) {
            throw new Error(
              `evidence: citation "${citation}" does not exist in mission ${missionId} — the graph stays bound to the mission (design §7.2)`,
            );
          }
        }
      }
      const appended = await graph.appendNode({
        id,
        missionId,
        nodeKind,
        payload,
      });
      if (nodeKind === EVIDENCE_NODE_KIND.CONCLUSION) {
        // DERIVED_FROM edges run FROM each citation INTO the conclusion (sources
        // are roots and accept no incoming edges; lineage walks incoming edges).
        for (const citation of op.node.payload.citations ?? []) {
          await graph.appendEdge({
            id: `edge-${citation}-${id}`,
            missionId,
            from: citation,
            to: id,
            relation: EVIDENCE_RELATION.DERIVED_FROM,
          });
        }
      }
      return { node: appended };
    }
    case "add-edge": {
      const { id, from, to, relation } = op.edge;
      await graph.appendEdge({ id, missionId, from, to, relation });
      return {};
    }
    case "query-node": {
      const loaded = await graph.load(missionId);
      const node = loaded.nodes.find((candidate) => candidate.id === op.nodeId);
      if (node === undefined) {
        throw new Error(`evidence: unknown node "${op.nodeId}" in mission ${missionId}`);
      }
      return { queriedNode: node };
    }
    case "query-lineage": {
      const lineage = await graph.lineage(missionId, op.nodeId);
      return { lineage };
    }
  }
}

/** The bounded per-phase domain computation of the evidence chain. */
async function runStep(
  context: ChainStepContext<EvidenceChainInput>,
): Promise<ChainStepOutcome<EvidenceRunOutput>> {
  const { graph, mission, phase, input } = context;
  const targetMissionId = input.missionId ?? mission.id;
  const { node, queriedNode, lineage } = await executeOp(graph, targetMissionId, input.op);
  return {
    output: {
      op: input.op.op,
      phase,
      ...(node === undefined ? {} : { node }),
      ...(queriedNode === undefined ? {} : { queriedNode }),
      ...(lineage === undefined ? {} : { lineage }),
    },
  };
}

/** The evidence chain definition (intent `evidence`; design §11.5; REQ-CHAIN-004). */
export const evidenceChain: ChainDefinition<EvidenceChainInput, EvidenceRunOutput> = {
  name: "evidence",
  intent: "evidence",
  requiredMode: AUTHORITY_MODE.ANALYZE,
  runStep,
};
