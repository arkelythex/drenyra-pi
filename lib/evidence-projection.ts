/**
 * Deterministic, read-only evidence provenance projection for audit/review output.
 * It recomputes payload hashes and projects lineage only; it never mutates the
 * evidence graph or creates authority, approvals, materiality decisions, or receipts.
 */

import { computeEvidenceHash, type EvidenceItem } from "drenyra-ai/receipts";
import { sha256Canonical } from "./canonicalization.js";
import {
  EVIDENCE_NODE_KIND,
  type EvidenceEdge,
  type EvidenceGraph,
  type EvidenceGraphValidation,
  type EvidenceNode,
  type EvidenceNodeKind,
  type EvidenceRelation,
} from "./evidence-graph.js";

export const EVIDENCE_PROJECTION_VALIDATION_STATE = {
  VERIFIED: "verified",
  BLOCKED: "blocked",
} as const;

export type EvidenceProjectionValidationState =
  (typeof EVIDENCE_PROJECTION_VALIDATION_STATE)[keyof typeof EVIDENCE_PROJECTION_VALIDATION_STATE];

/** Stable identity of the requested terminal evidence node. */
export interface EvidenceTerminalIdentity {
  missionId: string;
  nodeId: string;
  nodeKind?: EvidenceNodeKind;
  payloadHash?: string;
}

/** Payload-integrity evidence for one node in the terminal's ancestor closure. */
export interface EvidenceProvenanceNode {
  id: string;
  nodeKind: EvidenceNodeKind;
  storedPayloadHash: string;
  recomputedPayloadHash?: string;
  payloadHashVerified: boolean;
}

/** One directed edge in the complete projected lineage, including the terminal edge. */
export interface EvidenceProvenanceEdge {
  id: string;
  from: string;
  to: string;
  relation: EvidenceRelation;
}

/** Read-only audit projection for one terminal conclusion/action (or queried node). */
export interface EvidenceProvenanceProjection {
  terminal: EvidenceTerminalIdentity;
  validationState: EvidenceProjectionValidationState;
  nodes: readonly EvidenceProvenanceNode[];
  edges: readonly EvidenceProvenanceEdge[];
  receiptEvidenceHash?: string;
  blockingReasons: readonly string[];
}

export interface EvidenceProvenanceProjectionInput {
  graph: EvidenceGraph;
  validation?: EvidenceGraphValidation;
  terminalNodeId: string;
}

function ancestorClosure(
  graph: EvidenceGraph,
  terminalNodeId: string,
): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const parents = incoming.get(edge.to) ?? [];
    parents.push(edge.from);
    incoming.set(edge.to, parents);
  }
  for (const parents of incoming.values()) {
    parents.sort();
  }

  const closure = new Set<string>([terminalNodeId]);
  const pending = [terminalNodeId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    for (const parent of incoming.get(current) ?? []) {
      if (!closure.has(parent)) {
        closure.add(parent);
        pending.push(parent);
      }
    }
  }
  return closure;
}

function topologicalNodeIds(
  closure: ReadonlySet<string>,
  edges: readonly EvidenceEdge[],
): string[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of closure) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    if (!closure.has(edge.from) || !closure.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  for (const targets of outgoing.values()) targets.sort();

  const queue = [...closure]
    .filter((id) => (incoming.get(id) ?? 0) === 0)
    .sort();
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    ordered.push(current);
    for (const target of outgoing.get(current) ?? []) {
      const nextCount = (incoming.get(target) ?? 0) - 1;
      incoming.set(target, nextCount);
      if (nextCount === 0) {
        queue.push(target);
        queue.sort();
      }
    }
  }
  return ordered;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(reasons: readonly string[]): string[] {
  return [...new Set(reasons)].sort(compareText);
}

/**
 * Project complete provenance for one terminal without writing any state.
 * Receipt evidence hashes are exposed only when the graph validation and every
 * recomputed payload hash are verified.
 */
export function projectEvidenceProvenance(
  input: EvidenceProvenanceProjectionInput,
): EvidenceProvenanceProjection {
  const { graph, validation, terminalNodeId } = input;
  const reasons: string[] = [];
  const matchingTerminals = graph.nodes.filter(
    (node) => node.id === terminalNodeId,
  );
  const terminal = matchingTerminals[0];

  if (graph.missionId.length === 0) {
    reasons.push("evidence graph mission identity is missing");
  }
  if (validation === undefined) {
    reasons.push("evidence validation is unavailable");
  } else if (!validation.valid) {
    reasons.push(
      ...validation.errors.map(
        (error) => `evidence validation failed: ${error}`,
      ),
    );
    if (validation.errors.length === 0) {
      reasons.push("evidence validation failed");
    }
  }
  if (matchingTerminals.length === 0) {
    reasons.push(`terminal node ${terminalNodeId} does not exist`);
  } else if (matchingTerminals.length > 1) {
    reasons.push(`terminal node ${terminalNodeId} is duplicated`);
  }

  const duplicateNodeIds = graph.nodes
    .map((node) => node.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  for (const id of duplicateNodeIds)
    reasons.push(`evidence node ${id} is duplicated`);

  const closure =
    terminal === undefined
      ? new Set<string>()
      : ancestorClosure(graph, terminalNodeId);
  const orderedIds = topologicalNodeIds(closure, graph.edges);
  if (closure.size > 0 && orderedIds.length !== closure.size) {
    reasons.push("terminal lineage contains a cycle");
  }

  const nodeById = new Map<string, EvidenceNode>();
  for (const node of graph.nodes) {
    if (!nodeById.has(node.id)) nodeById.set(node.id, node);
  }

  const nodes: EvidenceProvenanceNode[] = [];
  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (node === undefined) {
      reasons.push(`lineage node ${id} is unavailable`);
      continue;
    }
    let recomputedPayloadHash: string | undefined;
    try {
      recomputedPayloadHash = sha256Canonical(node.payload);
    } catch {
      reasons.push(`node ${node.id} payload cannot be hashed canonically`);
    }
    const payloadHashVerified =
      recomputedPayloadHash !== undefined &&
      recomputedPayloadHash === node.payloadHash;
    if (!payloadHashVerified && recomputedPayloadHash !== undefined) {
      reasons.push(`node ${node.id} payload hash mismatch`);
    }
    nodes.push({
      id: node.id,
      nodeKind: node.nodeKind,
      storedPayloadHash: node.payloadHash,
      ...(recomputedPayloadHash === undefined ? {} : { recomputedPayloadHash }),
      payloadHashVerified,
    });
  }

  const edges = graph.edges
    .filter((edge) => closure.has(edge.from) && closure.has(edge.to))
    .map(
      (edge): EvidenceProvenanceEdge => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        relation: edge.relation,
      }),
    )
    .sort(
      (left, right) =>
        compareText(left.from, right.from) ||
        compareText(left.to, right.to) ||
        compareText(left.relation, right.relation) ||
        compareText(left.id, right.id),
    );

  const blockingReasons = uniqueSorted(reasons);
  let receiptEvidenceHash: string | undefined;
  if (blockingReasons.length === 0 && terminal !== undefined) {
    const items: EvidenceItem[] = nodes
      .map((node) => ({
        id: node.id,
        label: node.nodeKind,
        type: node.nodeKind,
      }))
      .sort((left, right) => compareText(left.id, right.id));
    receiptEvidenceHash = computeEvidenceHash(items);
  }

  return {
    terminal: {
      missionId: graph.missionId,
      nodeId: terminalNodeId,
      ...(terminal === undefined
        ? {}
        : { nodeKind: terminal.nodeKind, payloadHash: terminal.payloadHash }),
    },
    validationState:
      blockingReasons.length === 0
        ? EVIDENCE_PROJECTION_VALIDATION_STATE.VERIFIED
        : EVIDENCE_PROJECTION_VALIDATION_STATE.BLOCKED,
    nodes,
    edges,
    ...(receiptEvidenceHash === undefined ? {} : { receiptEvidenceHash }),
    blockingReasons,
  };
}

/**
 * Project every leaf conclusion and action in deterministic id order. Actions are
 * terminal by graph invariant; a conclusion is terminal only when it has no
 * outgoing edge, avoiding duplicate projections when an action supersedes it.
 */
export function projectEvidenceProvenanceSet(
  graph: EvidenceGraph,
  validation?: EvidenceGraphValidation,
): readonly EvidenceProvenanceProjection[] {
  const nodesWithOutgoing = new Set(graph.edges.map((edge) => edge.from));
  return [
    ...new Set(
      graph.nodes
        .filter(
          (node) =>
            node.nodeKind === EVIDENCE_NODE_KIND.ACTION ||
            (node.nodeKind === EVIDENCE_NODE_KIND.CONCLUSION &&
              !nodesWithOutgoing.has(node.id)),
        )
        .map((node) => node.id),
    ),
  ]
    .sort(compareText)
    .map((terminalNodeId) =>
      projectEvidenceProvenance({ graph, validation, terminalNodeId }),
    );
}
