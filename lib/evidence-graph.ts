/**
 * Evidence graph — append-only per-mission provenance store (design §7). Each
 * mission has one NDJSON log at `<workspace>/.local/evidence/<mission-id>.ndjson`
 * where every line is one complete UTF-8 JSON record with no byte-order mark.
 *
 * Nodes (source → transformation → conclusion → action) carry a lowercase hex
 * sha-256 payload hash computed over `canonicalizePayload(payload)` (REQ-EVID-003);
 * directed edges (DERIVED_FROM / SUPPORTS / EXECUTES) express lineage
 * (REQ-EVID-002). The graph is append-only: a duplicate id is allowed only when
 * its canonical record is byte-identical, there is no update/delete API, and
 * new content always becomes new nodes (REQ-EVID-005; SC-EVID-004).
 *
 * Fail-closed invariants (design §7.2): every edge endpoint exists in the same
 * mission, edges never create a cycle, a conclusion must cite at least one
 * source or transformation (REQ-EVID-004; SC-EVID-002), an action must have a
 * complete source→conclusion→action lineage (REQ-EVID-007), payload integrity
 * is recomputed on every load used for authorization or receipt creation
 * (REQ-EVID-008; SC-EVID-003), and a malformed or truncated line makes the
 * graph unavailable for authority decisions — repair is explicit and never
 * automatic. Receipt evidence hashes project the ancestor closure to engine
 * `EvidenceItem` records and use the engine's id-sorted `computeEvidenceHash`
 * (REQ-EVID-006; SC-EVID-005).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { computeEvidenceHash, type EvidenceItem } from "drenyra-ai/receipts";
import { sha256Canonical, canonicalizePayload } from "./canonicalization.js";
import { eachNdjsonLine, parseJsonOrThrow } from "./parse.js";
import { isSafeStoreIdentifier } from "./authority-store.js";

export const EVIDENCE_RECORD_KIND = {
  NODE: "node",
  EDGE: "edge",
} as const;

export const EVIDENCE_NODE_KIND = {
  SOURCE: "source",
  TRANSFORMATION: "transformation",
  CONCLUSION: "conclusion",
  ACTION: "action",
} as const;

export const EVIDENCE_RELATION = {
  DERIVED_FROM: "DERIVED_FROM",
  SUPPORTS: "SUPPORTS",
  EXECUTES: "EXECUTES",
} as const;

export type EvidenceRecordKind =
  (typeof EVIDENCE_RECORD_KIND)[keyof typeof EVIDENCE_RECORD_KIND];

export type EvidenceNodeKind = (typeof EVIDENCE_NODE_KIND)[keyof typeof EVIDENCE_NODE_KIND];

export type EvidenceRelation = (typeof EVIDENCE_RELATION)[keyof typeof EVIDENCE_RELATION];

/** One immutable evidence graph node (design §7.1). */
export interface EvidenceNode {
  schemaVersion: 1;
  recordKind: "node";
  id: string;
  missionId: string;
  nodeKind: EvidenceNodeKind;
  payload: unknown;
  payloadHash: string;
  createdAt: string;
}

/** One directed lineage edge between nodes of the same mission (design §7.1). */
export interface EvidenceEdge {
  schemaVersion: 1;
  recordKind: "edge";
  id: string;
  missionId: string;
  from: string;
  to: string;
  relation: EvidenceRelation;
  createdAt: string;
}

/** The complete graph document for one mission. */
export interface EvidenceGraph {
  missionId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

/** Input for `appendNode`; the payload hash is computed by the store. */
export interface AppendEvidenceNodeInput {
  id: string;
  missionId: string;
  nodeKind: EvidenceNodeKind;
  payload: unknown;
  createdAt?: string;
}

/** Input for `appendEdge`; endpoints must already exist in the same mission. */
export interface AppendEvidenceEdgeInput {
  id: string;
  missionId: string;
  from: string;
  to: string;
  relation: EvidenceRelation;
  createdAt?: string;
}

/** Fail-closed integrity result: tampered node ids plus invariant errors. */
export interface EvidenceGraphValidation {
  valid: boolean;
  tamperedNodeIds: readonly string[];
  errors: readonly string[];
}

/** The traversable lineage of one node: ordered ancestors and connecting edges. */
export interface EvidenceLineage {
  missionId: string;
  nodeId: string;
  /** Ancestor nodes ordered from root sources toward the target node. */
  ancestors: readonly EvidenceNode[];
  /** The edges that connect the ancestor closure. */
  edges: readonly EvidenceEdge[];
}

const NODE_KIND_VALUES: readonly string[] = Object.values(EVIDENCE_NODE_KIND);
const RELATION_VALUES: readonly string[] = Object.values(EVIDENCE_RELATION);
const HEX64 = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9._:/-]{1,256}$/;

function assertRecordId(value: string, label: string): void {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    throw new Error(`${label} "${value}" is not a valid record id (1-256 characters)`);
  }
}

function assertMissionId(value: string, label: string): void {
  if (!isSafeStoreIdentifier(value)) {
    throw new Error(
      `${label} "${value}" is not a safe store identifier (letters, digits, '.', '_', '-' only; no path separators, no '..')`,
    );
  }
}

function assertIsoInstant(value: unknown, label: string): void {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO-8601 instant`);
  }
}

function assertPayloadHash(value: unknown, label: string): void {
  if (typeof value !== "string" || !HEX64.test(value)) {
    throw new Error(`${label} must be a 64-character lowercase hex sha-256 digest`);
  }
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object (contracts/evidence/node.schema.json)`);
  }
}

function stripUndefined(record: EvidenceNode | EvidenceEdge): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/** Canonical bytes used for byte-identical replay comparison (keys sorted). */
function canonicalRecordBytes(record: EvidenceNode | EvidenceEdge): string {
  return sha256Canonical(stripUndefined(record));
}

/** Structural validation of one persisted node record (fail closed). */
function assertValidNode(record: unknown): asserts record is EvidenceNode {
  if (typeof record !== "object" || record === null) {
    throw new Error("evidence log corrupt: node record must be an object");
  }
  const node = record as Record<string, unknown>;
  if (node.schemaVersion !== 1) {
    throw new Error(`evidence log corrupt: unsupported node schemaVersion ${String(node.schemaVersion)}`);
  }
  if (node.recordKind !== "node") {
    throw new Error(`evidence log corrupt: recordKind must be "node"`);
  }
  assertRecordId(String(node.id), "node id");
  assertMissionId(String(node.missionId), "node missionId");
  if (typeof node.nodeKind !== "string" || !NODE_KIND_VALUES.includes(node.nodeKind)) {
    throw new Error(
      `evidence log corrupt: nodeKind "${String(node.nodeKind)}" must be one of ${NODE_KIND_VALUES.join(", ")}`,
    );
  }
  assertPlainObject(node.payload, "node payload");
  assertPayloadHash(node.payloadHash, "node payloadHash");
  assertIsoInstant(node.createdAt, "node createdAt");
}

/** Structural validation of one persisted edge record (fail closed). */
function assertValidEdge(record: unknown): asserts record is EvidenceEdge {
  if (typeof record !== "object" || record === null) {
    throw new Error("evidence log corrupt: edge record must be an object");
  }
  const edge = record as Record<string, unknown>;
  if (edge.schemaVersion !== 1) {
    throw new Error(`evidence log corrupt: unsupported edge schemaVersion ${String(edge.schemaVersion)}`);
  }
  if (edge.recordKind !== "edge") {
    throw new Error(`evidence log corrupt: recordKind must be "edge"`);
  }
  assertRecordId(String(edge.id), "edge id");
  assertMissionId(String(edge.missionId), "edge missionId");
  assertRecordId(String(edge.from), "edge from");
  assertRecordId(String(edge.to), "edge to");
  if (typeof edge.relation !== "string" || !RELATION_VALUES.includes(edge.relation)) {
    throw new Error(
      `evidence log corrupt: relation "${String(edge.relation)}" must be one of ${RELATION_VALUES.join(", ")}`,
    );
  }
  assertIsoInstant(edge.createdAt, "edge createdAt");
}

/** The immutable, fail-closed per-mission evidence graph store (design §7.4). */
export class EvidenceGraphStore {
  private readonly dir: string;

  constructor(root?: string) {
    this.dir = join(root ?? process.cwd(), ".local", "evidence");
  }

  private pathFor(missionId: string): string {
    assertMissionId(missionId, "mission id");
    return join(this.dir, `${missionId}.ndjson`);
  }

  /**
   * Append one node. The payload hash is the lowercase hex sha-256 over
   * `canonicalizePayload(payload)`; a duplicate id replays only when the
   * canonical record is byte-identical. No update/delete API exists
   * (REQ-EVID-005).
   */
  async appendNode(input: AppendEvidenceNodeInput): Promise<EvidenceNode> {
    assertRecordId(input.id, "node id");
    assertMissionId(input.missionId, "mission id");
    if (typeof input.nodeKind !== "string" || !NODE_KIND_VALUES.includes(input.nodeKind)) {
      throw new Error(
        `nodeKind "${String(input.nodeKind)}" must be one of ${NODE_KIND_VALUES.join(", ")}`,
      );
    }
    assertPlainObject(input.payload, "node payload");
    const createdAt = input.createdAt ?? new Date().toISOString();
    assertIsoInstant(createdAt, "createdAt");

    const record: EvidenceNode = {
      schemaVersion: 1,
      recordKind: "node",
      id: input.id,
      missionId: input.missionId,
      nodeKind: input.nodeKind,
      payload: input.payload,
      payloadHash: sha256Canonical(input.payload),
      createdAt,
    };

    const graph = await this.load(input.missionId);
    const existing = graph.nodes.find((node) => node.id === input.id);
    if (existing !== undefined) {
      if (canonicalRecordBytes(existing) === canonicalRecordBytes(record)) {
        return existing; // Idempotent replay of byte-identical record.
      }
      throw new Error(
        `evidence graph: duplicate node id "${input.id}" with differing bytes is rejected — the graph is append-only`,
      );
    }
    this.appendLine(input.missionId, canonicalizePayload(stripUndefined(record)));
    return record;
  }

  /**
   * Append one directed edge. Endpoints must exist in the same mission,
   * the edge must not create a cycle, a conclusion must be cited by a source or
   * transformation, and an action must have a complete source→conclusion→action
   * lineage (design §7.2; REQ-EVID-002/004/007).
   */
  async appendEdge(input: AppendEvidenceEdgeInput): Promise<EvidenceEdge> {
    assertRecordId(input.id, "edge id");
    assertMissionId(input.missionId, "mission id");
    assertRecordId(input.from, "edge from");
    assertRecordId(input.to, "edge to");
    if (typeof input.relation !== "string" || !RELATION_VALUES.includes(input.relation)) {
      throw new Error(
        `relation "${String(input.relation)}" must be one of ${RELATION_VALUES.join(", ")}`,
      );
    }
    const createdAt = input.createdAt ?? new Date().toISOString();
    assertIsoInstant(createdAt, "createdAt");

    const graph = await this.load(input.missionId);
    const existing = graph.edges.find((edge) => edge.id === input.id);
    const record: EvidenceEdge = {
      schemaVersion: 1,
      recordKind: "edge",
      id: input.id,
      missionId: input.missionId,
      from: input.from,
      to: input.to,
      relation: input.relation,
      createdAt,
    };
    if (existing !== undefined) {
      if (canonicalRecordBytes(existing) === canonicalRecordBytes(record)) {
        return existing; // Idempotent replay of byte-identical record.
      }
      throw new Error(
        `evidence graph: duplicate edge id "${input.id}" with differing bytes is rejected — the graph is append-only`,
      );
    }

    const from = graph.nodes.find((node) => node.id === input.from);
    const to = graph.nodes.find((node) => node.id === input.to);
    if (from === undefined || to === undefined) {
      throw new Error(
        `evidence graph: edge endpoints must exist in the same mission (missing ${input.from}/${input.to})`,
      );
    }
    if (createsCycle(graph, input.from, input.to)) {
      throw new Error(`evidence graph: edge ${input.from} -> ${input.to} would create a cycle`);
    }
    if (from.nodeKind === EVIDENCE_NODE_KIND.ACTION) {
      throw new Error("evidence graph: an action node is terminal and has no outgoing edges");
    }
    if (to.nodeKind === EVIDENCE_NODE_KIND.SOURCE) {
      throw new Error("evidence graph: a source node is a root and accepts no incoming edges");
    }

    const wouldBeGraph: EvidenceGraph = {
      missionId: input.missionId,
      nodes: graph.nodes,
      edges: [...graph.edges, record],
    };
    if (to.nodeKind === EVIDENCE_NODE_KIND.CONCLUSION && !conclusionGrounded(to, wouldBeGraph)) {
      throw new Error(
        `evidence graph: conclusion "${input.to}" has no cited source or transformation (REQ-EVID-004)`,
      );
    }
    if (to.nodeKind === EVIDENCE_NODE_KIND.ACTION && !actionGrounded(to, wouldBeGraph)) {
      throw new Error(
        `evidence graph: action "${input.to}" is ungrounded — it needs a supporting conclusion with complete source-to-action lineage (REQ-EVID-007)`,
      );
    }

    this.appendLine(input.missionId, canonicalizePayload(stripUndefined(record)));
    return record;
  }

  /** Load the full graph for one mission; malformed/truncated lines fail closed. */
  async load(missionId: string): Promise<EvidenceGraph> {
    const path = this.pathFor(missionId);
    if (!existsSync(path)) {
      return { missionId, nodes: [], edges: [] };
    }
    const raw = readFileSync(path, "utf8");
    const nodes: EvidenceNode[] = [];
    const edges: EvidenceEdge[] = [];
    eachNdjsonLine(raw, (line) => {
      const parsed = parseJsonOrThrow(
        line,
        `evidence log corrupt: ${path} contains a malformed or truncated line — repair is explicit and never automatic`,
      );
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error(
          `evidence log corrupt: ${path} contains a non-object record — repair is explicit and never automatic`,
        );
      }
      const record = parsed as Record<string, unknown>;
      const kind = record.recordKind;
      if (kind === "node") {
        assertValidNode(parsed);
        const node = parsed as EvidenceNode;
        if (node.missionId !== missionId) {
          throw new Error(
            `evidence log corrupt: ${path} contains a node for a different mission (${node.missionId})`,
          );
        }
        nodes.push(node);
      } else if (kind === "edge") {
        assertValidEdge(parsed);
        const edge = parsed as EvidenceEdge;
        if (edge.missionId !== missionId) {
          throw new Error(
            `evidence log corrupt: ${path} contains an edge for a different mission (${edge.missionId})`,
          );
        }
        edges.push(edge);
      } else {
        throw new Error(
          `evidence log corrupt: ${path} contains an unknown record kind "${String(kind)}" — repair is explicit and never automatic`,
        );
      }
    });
        return { missionId, nodes, edges };
      }

      /**
       * Structural load plus full usability check: payload integrity, endpoint
       * existence, and acyclicity. Throws on any violation so lineage and receipt
       * hashing fail closed for authority decisions (design §7.2).
       */
      private async loadIntegrityChecked(missionId: string): Promise<EvidenceGraph> {
        const graph = await this.load(missionId);
        for (const node of graph.nodes) {
          if (sha256Canonical(node.payload) !== node.payloadHash) {
            throw new Error(
              `evidence graph integrity check failed: node "${node.id}" payload hash does not match its content — the graph is unavailable for authority decisions until repaired`,
            );
          }
        }
        for (const edge of graph.edges) {
          const fromExists = graph.nodes.some((node) => node.id === edge.from);
          const toExists = graph.nodes.some((node) => node.id === edge.to);
          if (!fromExists || !toExists) {
            throw new Error(
              `evidence graph integrity check failed: edge "${edge.id}" references endpoint ${!fromExists ? edge.from : edge.to} that does not exist in mission ${missionId}`,
            );
          }
        }
        const cycle = findCycle(graph);
        if (cycle !== undefined) {
          throw new Error(
            `evidence graph integrity check failed: cycle detected (${cycle.join(" -> ")}) — the graph is unavailable for authority decisions until repaired`,
          );
        }
        return graph;
      }
    
  /**
   * Traverse the full lineage of one node (REQ-EVID-002; SC-EVID-001). Ancestors
   * are ordered from root sources toward the node. Payload integrity is recomputed
   * before the lineage is trusted for authority decisions (design §7.2).
   */
  async lineage(missionId: string, nodeId: string): Promise<EvidenceLineage> {
    const graph = await this.loadIntegrityChecked(missionId);
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (node === undefined) {
      throw new Error(`evidence graph: unknown node "${nodeId}" in mission ${missionId}`);
    }
    const closure = ancestorClosure(graph, nodeId);
    const order = topologicalOrder(closure, graph.edges);
    const ancestors = order
      .filter((id) => id !== nodeId)
      .map((id) => graph.nodes.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is EvidenceNode => candidate !== undefined);
    const edges = graph.edges.filter(
      (edge) =>
        edge.from !== nodeId &&
        edge.to !== nodeId &&
        closure.has(edge.from) &&
        closure.has(edge.to),
    );
    return { missionId, nodeId, ancestors, edges };
  }

  /**
   * Integrity validation (REQ-EVID-008; SC-EVID-003): recompute every payload
   * hash and identify tampered nodes, then verify graph invariants (cycles,
   * conclusion citation, action traceability).
   */
  async validate(missionId: string): Promise<EvidenceGraphValidation> {
    const graph = await this.load(missionId);
    const errors: string[] = [];
    const tamperedNodeIds: string[] = [];

    for (const node of graph.nodes) {
      let computed: string;
      try {
        computed = sha256Canonical(node.payload);
      } catch (cause) {
        errors.push(`node ${node.id}: payload is not canonicalizable — ${(cause as Error).message}`);
        continue;
      }
      if (computed !== node.payloadHash) {
        tamperedNodeIds.push(node.id);
        errors.push(`node ${node.id}: payload hash does not match its content (REQ-EVID-008)`);
      }
    }

    for (const edge of graph.edges) {
      const fromExists = graph.nodes.some((node) => node.id === edge.from);
      const toExists = graph.nodes.some((node) => node.id === edge.to);
      if (!fromExists || !toExists) {
        errors.push(
          `edge ${edge.id}: endpoint ${!fromExists ? edge.from : edge.to} does not exist in mission ${missionId}`,
        );
      }
    }

    const cycle = findCycle(graph);
    if (cycle !== undefined) {
      errors.push(`cycle detected: ${cycle.join(" -> ")}`);
    }

    for (const node of graph.nodes) {
      if (node.nodeKind === EVIDENCE_NODE_KIND.CONCLUSION && !conclusionGrounded(node, graph)) {
        errors.push(
          `conclusion ${node.id}: has no cited source or transformation (REQ-EVID-004)`,
        );
      }
      if (node.nodeKind === EVIDENCE_NODE_KIND.ACTION && !actionGrounded(node, graph)) {
        errors.push(
          `action ${node.id}: ungrounded — no supporting conclusion with complete source-to-action lineage (REQ-EVID-007)`,
        );
      }
    }

    return {
      valid: errors.length === 0 && tamperedNodeIds.length === 0,
      tamperedNodeIds,
      errors,
    };
  }

  /**
   * Compute the receipt evidence hash (design §7.3; REQ-EVID-006/007): every
   * ancestor of the protected terminal nodes is projected to engine
   * `EvidenceItem` records, deduplicated by id, and hashed with the engine's
   * id-sorted `computeEvidenceHash` so the same evidence set always yields the
   * same hash regardless of insertion order (SC-EVID-005).
   */
  async computeReceiptEvidenceHash(
    missionId: string,
    terminalNodeIds: readonly string[],
  ): Promise<string> {
    const graph = await this.loadIntegrityChecked(missionId);
    const closure = new Set<string>();
    for (const terminalId of terminalNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === terminalId);
      if (node === undefined) {
        throw new Error(
          `evidence graph: unknown terminal node "${terminalId}" in mission ${missionId}`,
        );
      }
      for (const id of ancestorClosure(graph, terminalId)) {
        closure.add(id);
      }
    }
    const items: EvidenceItem[] = [];
    for (const id of [...closure].sort()) {
      const node = graph.nodes.find((candidate) => candidate.id === id);
      if (node === undefined) {
        continue;
      }
      items.push({ id: node.id, label: node.nodeKind, type: node.nodeKind });
    }
    return computeEvidenceHash(items);
  }



  /** Append one NDJSON line, synced before success, refusing symlinked logs. */
  private appendLine(missionId: string, line: string): void {
    mkdirSync(this.dir, { recursive: true });
    const path = this.pathFor(missionId);
    const st = lstatSync(path, { throwIfNoEntry: false });
    if (st !== undefined && st.isSymbolicLink()) {
      throw new Error(
        `evidence log: ${path} is a symbolic link — symlinked store paths are rejected (design §15)`,
      );
    }
    const flags = constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0);
    const fd = openSync(path, flags);
    try {
      writeSync(fd, `${line}\n`, null, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
}

/** True when adding from→to would close a cycle (to can already reach from). */
function createsCycle(graph: EvidenceGraph, from: string, to: string): boolean {
  if (from === to) {
    return true;
  }
  return reachable(graph, to, from);
}

/** Depth-first reachability from `start` to `target` following edge direction. */
function reachable(graph: EvidenceGraph, start: string, target: string): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    if (current === target) {
      return true;
    }
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

/** All nodes reachable by walking incoming edges from `nodeId` (inclusive). */
function ancestorClosure(graph: EvidenceGraph, nodeId: string): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = incoming.get(edge.to) ?? [];
    list.push(edge.from);
    incoming.set(edge.to, list);
  }
  const closure = new Set<string>([nodeId]);
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    for (const parent of incoming.get(current) ?? []) {
      if (!closure.has(parent)) {
        closure.add(parent);
        stack.push(parent);
      }
    }
  }
  return closure;
}

/** A conclusion is cited when an ancestor chain reaches a source or transformation. */
function conclusionGrounded(node: EvidenceNode, graph: EvidenceGraph): boolean {
  const closure = ancestorClosure(graph, node.id);
  for (const id of closure) {
    const candidate = graph.nodes.find((n) => n.id === id);
    if (candidate === undefined) {
      continue;
    }
    if (
      candidate.nodeKind === EVIDENCE_NODE_KIND.SOURCE ||
      candidate.nodeKind === EVIDENCE_NODE_KIND.TRANSFORMATION
    ) {
      return true;
    }
  }
  return false;
}

/** An action is grounded when a cited conclusion supports it (complete lineage). */
function actionGrounded(node: EvidenceNode, graph: EvidenceGraph): boolean {
  const closure = ancestorClosure(graph, node.id);
  for (const id of closure) {
    const candidate = graph.nodes.find((n) => n.id === id);
    if (candidate === undefined) {
      continue;
    }
    if (
      candidate.nodeKind === EVIDENCE_NODE_KIND.CONCLUSION &&
      conclusionGrounded(candidate, graph)
    ) {
      return true;
    }
  }
  return false;
}

/** Kahn's algorithm over the given nodes; returns undefined when acyclic. */
function findCycle(graph: EvidenceGraph): string[] | undefined {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!incoming.has(edge.from) || !incoming.has(edge.to)) {
      continue; // Dangling endpoints are reported separately by validate().
    }
    adjacency.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const remaining = new Set(graph.nodes.map((node) => node.id));
  const queue = [...remaining].filter((id) => (incoming.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    remaining.delete(current);
    for (const next of adjacency.get(current) ?? []) {
      const count = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, count);
      if (count === 0 && remaining.has(next)) {
        queue.push(next);
      }
    }
  }
  if (remaining.size === 0) {
    return undefined;
  }
  return [...remaining];
}

/** Deterministic topological order of a node subset (sources first). */
function topologicalOrder(nodes: Set<string>, edges: readonly EvidenceEdge[]): string[] {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of nodes) {
    incoming.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      continue;
    }
    adjacency.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const remaining = new Set(nodes);
  const order: string[] = [];
  const queue = [...remaining].filter((id) => (incoming.get(id) ?? 0) === 0).sort();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    order.push(current);
    remaining.delete(current);
    for (const next of adjacency.get(current) ?? []) {
      const count = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, count);
      if (count === 0 && remaining.has(next)) {
        queue.push(next);
      }
    }
  }
  return order;
}
