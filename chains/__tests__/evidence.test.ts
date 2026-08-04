/**
 * Evidence chain tests — T-S5B-002 (design §11.5; REQ-CHAIN-004; SC-CHAIN-006).
 *
 * The evidence chain runs an `evidence` mission through the shared chain pipeline
 * and performs append-only evidence operations on the target mission's evidence
 * graph: add a source/transformation/conclusion node with a canonical payload
 * hash, add a lineage edge, query the full lineage of a node, and query a node by
 * id. Add operations enforce node/edge schemas and lineage rules — a conclusion
 * without citations is rejected (REQ-EVID-004) — and queries are read-only. The
 * graph stays bound to the mission: cross-mission edges are rejected (design
 * §7.2). Inputs are bounded and fail closed on invalid payloads.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or integer decimal strings at JSON boundaries — never floats);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Canonical } from "../../lib/canonicalization.js";
import {
  EvidenceGraphStore,
  EVIDENCE_NODE_KIND,
  EVIDENCE_RELATION,
} from "../../lib/evidence-graph.js";
import { runChainStep, type ChainRunResult } from "../../lib/chain-pipeline.js";
import {
  evidenceChain,
  parseEvidenceOp,
  type EvidenceChainInput,
  type EvidenceRunOutput,
} from "../evidence.js";
import {
  FIXTURE_RUC,
  FIXTURE_RUC_B,
  makeScopeBinding,
} from "../../__tests__/helpers/authority-fixtures.js";
import type { ScopeBinding } from "../../lib/canonicalization.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-evidence-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Run one evidence-chain step (one op per invocation) over a fresh stores root. */
async function runOp(
  root: string,
  input: EvidenceChainInput,
  binding: ScopeBinding = makeScopeBinding(),
): Promise<ChainRunResult<EvidenceRunOutput>> {
  return runChainStep(evidenceChain, {
    binding,
    input,
    storesRoot: root,
  });
}

describe("evidence chain (REQ-CHAIN-004; SC-CHAIN-006)", () => {
  it("adds a source node with a canonical payload hash", async () => {
    const root = tempRoot();
    const result = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-balance",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "balance-snapshot", amountCents: 1_000_000 },
        },
      },
    });
    const missionId = result.mission!.id;
    expect(result.output?.op).toBe("add-node");
    expect(result.output?.node?.nodeKind).toBe(EVIDENCE_NODE_KIND.SOURCE);
    expect(result.output?.node?.missionId).toBe(missionId);
    expect(result.output?.node?.payloadHash).toMatch(/^[0-9a-f]{64}$/);

    const graph = new EvidenceGraphStore(root);
    const loaded = await graph.load(missionId);
    const node = loaded.nodes.find((candidate) => candidate.id === "src-balance");
    expect(node).toBeDefined();
    expect(node?.payloadHash).toBe(sha256Canonical(node!.payload));
  });

  it("adds a conclusion with citations and queries the full source→transformation→conclusion→action lineage (SC-CHAIN-006)", async () => {
    const root = tempRoot();
    // Op 1: the source node.
    const result = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-1",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "bank-movement", reference: "B001", amountCents: 250_000 },
        },
      },
    });
    const missionId = result.mission!.id;

    // Op 2: the transformation node, derived from the source.
    await runOp(root, {
      missionId,
      op: {
        op: "add-node",
        node: {
          id: "trans-1",
          nodeKind: EVIDENCE_NODE_KIND.TRANSFORMATION,
          payload: { kind: "normalize", algorithm: "bigint-cents" },
        },
      },
    });
    await runOp(root, {
      missionId,
      op: {
        op: "add-edge",
        edge: {
          id: "edge-src-trans",
          from: "src-1",
          to: "trans-1",
          relation: EVIDENCE_RELATION.DERIVED_FROM,
        },
      },
    });

    // Op 3: the conclusion node, citing the source and the transformation.
    await runOp(root, {
      missionId,
      op: {
        op: "add-node",
        node: {
          id: "concl-1",
          nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
          payload: {
            kind: "discrepancy",
            reference: "B001",
            differenceCents: 20_000,
            citations: ["src-1", "trans-1"],
          },
        },
      },
    });

    // Op 4: the action node, supported by the conclusion.
    await runOp(root, {
      missionId,
      op: {
        op: "add-node",
        node: {
          id: "action-1",
          nodeKind: EVIDENCE_NODE_KIND.ACTION,
          payload: { kind: "propose-correction", reference: "B001" },
        },
      },
    });
    await runOp(root, {
      missionId,
      op: {
        op: "add-edge",
        edge: {
          id: "edge-concl-action",
          from: "concl-1",
          to: "action-1",
          relation: EVIDENCE_RELATION.EXECUTES,
        },
      },
    });

    // Query the lineage of the action: the full chain is returned.
    const lineageResult = await runOp(root, {
      missionId,
      op: { op: "query-lineage", nodeId: "action-1" },
    });
    expect(lineageResult.output?.lineage).toBeDefined();
    const ancestors = lineageResult.output!.lineage!.ancestors.map((node) => node.id);
    expect(ancestors).toEqual(["src-1", "trans-1", "concl-1"]);
    // The kinds follow source → transformation → conclusion → action.
    const kinds = lineageResult.output!.lineage!.ancestors.map(
      (node) => node.nodeKind,
    );
    expect(kinds).toEqual([
      EVIDENCE_NODE_KIND.SOURCE,
      EVIDENCE_NODE_KIND.TRANSFORMATION,
      EVIDENCE_NODE_KIND.CONCLUSION,
    ]);
    // The connecting edges are part of the lineage.
    expect(lineageResult.output!.lineage!.edges.length).toBeGreaterThan(0);
  });

  it("rejects a conclusion without citations (REQ-EVID-004)", async () => {
    const root = tempRoot();
    const first = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-1",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "bank-movement", reference: "B001", amountCents: 100 },
        },
      },
    });
    const missionId = first.mission!.id;

    await expect(
      runOp(root, {
        missionId,
        op: {
          op: "add-node",
          node: {
            id: "concl-uncited",
            nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
            payload: { kind: "discrepancy", reference: "B001" },
          },
        },
      }),
    ).rejects.toThrow(/citation/i);

    // Nothing was appended: the graph holds only the source node.
    const graph = new EvidenceGraphStore(root);
    const loaded = await graph.load(missionId);
    expect(loaded.nodes.some((node) => node.id === "concl-uncited")).toBe(false);
  });

  it("rejects citations that do not exist in the target mission (fail closed)", async () => {
    const root = tempRoot();
    const first = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-1",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "bank-movement", reference: "B001", amountCents: 100 },
        },
      },
    });
    const missionId = first.mission!.id;
    await expect(
      runOp(root, {
        missionId,
        op: {
          op: "add-node",
          node: {
            id: "concl-bad",
            nodeKind: EVIDENCE_NODE_KIND.CONCLUSION,
            payload: {
              kind: "discrepancy",
              reference: "B001",
              citations: ["ghost-node"],
            },
          },
        },
      }),
    ).rejects.toThrow(/ghost-node|does not exist/i);
  });

  it("queries a node by id and fails closed for an unknown id", async () => {
    const root = tempRoot();
    const first = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-1",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "ledger-entry", reference: "B001", amountCents: 100 },
        },
      },
    });
    const missionId = first.mission!.id;

    const query = await runOp(root, {
      missionId,
      op: { op: "query-node", nodeId: "src-1" },
    });
    expect(query.output?.queriedNode?.id).toBe("src-1");
    expect(query.output?.queriedNode?.nodeKind).toBe(EVIDENCE_NODE_KIND.SOURCE);

    await expect(
      runOp(root, { missionId, op: { op: "query-node", nodeId: "nope" } }),
    ).rejects.toThrow(/unknown node/i);
  });

      it("rejects cross-mission edges (the graph stays bound to the mission — design §7.2)", async () => {
        const root = tempRoot();
        // Mission A holds a source node; mission B holds an unrelated source node
        // under a DIFFERENT company scope (active-mission reuse matches by
        // company + fiscal period, so a different company starts a second mission).
        const bindingA = makeScopeBinding({ company: FIXTURE_RUC });
        const bindingB = makeScopeBinding({ company: FIXTURE_RUC_B });
        const missionA = (await runOp(
          root,
          {
            op: {
              op: "add-node",
              node: {
                id: "src-a",
                nodeKind: EVIDENCE_NODE_KIND.SOURCE,
                payload: { kind: "ledger-entry", reference: "A001", amountCents: 100 },
              },
            },
          },
          bindingA,
        )).mission!;
        const missionB = (await runOp(
          root,
          {
            op: {
              op: "add-node",
              node: {
                id: "src-b",
                nodeKind: EVIDENCE_NODE_KIND.SOURCE,
                payload: { kind: "ledger-entry", reference: "B001", amountCents: 100 },
              },
            },
          },
          bindingB,
        )).mission!;
        expect(missionA.id).not.toBe(missionB.id);

    // An edge in mission A referencing a node that only exists in mission B fails.
    await expect(
      runOp(root, {
        missionId: missionA.id,
        op: {
          op: "add-edge",
          edge: {
            id: "edge-cross",
            from: "src-a",
            to: "src-b",
            relation: EVIDENCE_RELATION.DERIVED_FROM,
          },
        },
      }),
    ).rejects.toThrow(/endpoint|does not exist/i);
  });

  it("keeps queries read-only (no new nodes after a query)", async () => {
    const root = tempRoot();
    const first = await runOp(root, {
      op: {
        op: "add-node",
        node: {
          id: "src-1",
          nodeKind: EVIDENCE_NODE_KIND.SOURCE,
          payload: { kind: "ledger-entry", reference: "B001", amountCents: 100 },
        },
      },
    });
    const missionId = first.mission!.id;
    const before = (await new EvidenceGraphStore(root).load(missionId)).nodes.length;

    await runOp(root, { missionId, op: { op: "query-node", nodeId: "src-1" } });
    await runOp(root, {
      missionId,
      op: { op: "query-lineage", nodeId: "src-1" },
    });
    const after = (await new EvidenceGraphStore(root).load(missionId)).nodes.length;
    expect(after).toBe(before);
  });

  it("parses a bounded evidence op envelope and fails closed on invalid input", () => {
    const parsed = parseEvidenceOp(
      JSON.stringify({
        op: "add-node",
        missionId: "mission-x",
        node: {
          id: "src-1",
          nodeKind: "source",
          payload: { kind: "ledger-entry", reference: "B1", amountCents: 100 },
        },
      }),
    );
    expect(parsed.missionId).toBe("mission-x");
    expect(parsed.op.op).toBe("add-node");
    if (parsed.op.op === "add-node") {
      expect(parsed.op.node.id).toBe("src-1");
    }

    expect(() => parseEvidenceOp("{ not json")).toThrow(/not valid JSON/i);
    expect(() => parseEvidenceOp(JSON.stringify({ op: "explode" }))).toThrow(
      /unknown op|unsupported/i,
    );
    expect(() =>
      parseEvidenceOp(
        JSON.stringify({ op: "add-node", node: { id: "x", nodeKind: "source" } }),
      ),
    ).toThrow(/payload/i);
    expect(() =>
      parseEvidenceOp(
        JSON.stringify({
          op: "add-node",
          node: {
            id: "x",
            nodeKind: "source",
            payload: { kind: "ledger-entry", reference: "B1", amountCents: 10.5 },
          },
        }),
      ),
    ).toThrow(/float/i);
    expect(() =>
      parseEvidenceOp(
        JSON.stringify({ op: "query-lineage", nodeId: "x", extra: 1 }),
      ),
    ).toThrow(/unknown property/i);
  });
});
