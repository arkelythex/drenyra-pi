/**
 * Adapter-boundary audit — WU1 executable evidence (pi-sdd-040-adapter-boundary).
 *
 * Proves, per rule, that Pi is an adapter: materiality tiers are kernel-derived
 * with only a declared policy floor (REQ-AUDIT-004), agent ceilings are
 * ANALYZE/PREPARE only (REQ-AUDIT-003), UNKNOWN yields zero blind retries
 * (REQ-AUDIT-010), local persistence alone cannot authorize approve or execute
 * (REQ-AUDIT-011), and every authoritative operation delegates to the public
 * pinned `drenyra-ai@0.4.1` entry points (REQ-AUDIT-012). No Pi-local fiscal
 * gate is added; the kernel remains the sole authority on tiers, transitions,
 * approvals, gate verdicts, and receipts.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase hex
 * sha-256. Source assertions read the audited files and cite exact paths,
 * symbols, and bodies — never prose-only verdicts (REQ-AUDIT-001/002).
 */

import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import {
  deriveMateriality,
  orderOf,
  type Materiality,
  type MaterialityInput,
} from "drenyra-ai/candidates";
import { verifySignedReceipt } from "drenyra-ai/receipts";
import {
  ACTION_FAMILY,
  deriveRequiredMateriality,
  runAuthorityPipeline,
} from "../lib/authority-gates.js";
import {
  createEdaSteps,
  derivePreparedStep,
  EDA_PHASE,
} from "../lib/accounting-status.js";
import { createDurableMissionStores } from "../lib/mission-store.js";
import { AuthorityStore } from "../lib/authority-store.js";
import { ReceiptStore } from "../lib/receipt-store.js";
import {
  EvidenceGraphStore,
  EVIDENCE_NODE_KIND,
} from "../lib/evidence-graph.js";
import {
  makeApprovalReceipt,
  makeAuthorization,
  makeMission,
  makeScopeBinding,
} from "./helpers/authority-fixtures.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

/** A table spanning every kernel materiality outcome used by the tested path. */
const TIER_TABLE: readonly { input: MaterialityInput; kernel: Materiality }[] =
  [
    {
      input: { value: 0n, reversibility: "reversible", jurisdiction: "PE" },
      kernel: "R0",
    },
    {
      input: {
        value: 1_000_00n,
        reversibility: "reversible",
        jurisdiction: "PE",
      },
      kernel: "R1",
    },
    {
      input: {
        value: 10_000_00n,
        reversibility: "reversible",
        jurisdiction: "PE",
      },
      kernel: "R2",
    },
    {
      input: {
        value: 100_000_00n,
        reversibility: "reversible",
        jurisdiction: "PE",
      },
      kernel: "R3",
    },
    {
      input: { value: 1n, reversibility: "irreversible", jurisdiction: "PE" },
      kernel: "R3",
    },
    {
      input: {
        value: 1_000_00n,
        reversibility: "reversible",
        jurisdiction: "US",
      },
      kernel: "R2",
    },
  ];

/** The monthly-close R2 materiality used by the store and gate paths. */
const R2_MATERIALITY: MaterialityInput = {
  value: 10_000_00n,
  reversibility: "partially-reversible",
  jurisdiction: "PE",
};

/** Extract the exact body of a named function/arrow from source by brace depth. */
function extractFunctionBody(source: string, signaturePrefix: string): string {
  const start = source.indexOf(signaturePrefix);
  expect(
    start,
    `source must contain ${signaturePrefix}`,
  ).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  expect(open, `${signaturePrefix} must have an opening brace`).toBeGreaterThan(
    start,
  );
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }
  throw new Error(`function body for ${signaturePrefix} never closes`);
}

describe("T-WU1-001 materiality ownership (REQ-AUDIT-004)", () => {
  it("delegates materiality tier derivation to the kernel and only applies a policy floor", () => {
    // 1. Across R0/R1/R2/R3, irreversible, and non-PE inputs, the harness result
    //    equals the public kernel deriveMateriality result exactly.
    for (const row of TIER_TABLE) {
      const harness = deriveRequiredMateriality({ input: row.input });
      const kernel = deriveMateriality(row.input);
      expect(harness, `input derives ${row.kernel}`).toBe(kernel);
      expect(harness, `input derives ${row.kernel}`).toBe(row.kernel);
    }

    // 2. With a declared minimum, the result is max(kernel, minimum) per the
    //    kernel orderOf — the floor raises but never lowers the kernel result.
    for (const row of TIER_TABLE) {
      const kernel = deriveMateriality(row.input);
      const expected = orderOf(kernel) >= orderOf("R2") ? kernel : "R2";
      expect(
        deriveRequiredMateriality({ input: row.input, minimum: "R2" }),
        `input with R2 floor derives ${expected}`,
      ).toBe(expected);
      if (orderOf(kernel) >= orderOf("R2")) {
        expect(
          deriveRequiredMateriality({ input: row.input, minimum: "R2" }),
          `input with R2 floor keeps ${kernel}`,
        ).toBe(kernel);
      }
    }

    // 3. Missing/invalid value, reversibility, or jurisdiction fails closed and
    //    never defaults to R0.
    expect(() =>
      deriveRequiredMateriality({
        input: {
          value: undefined as unknown as bigint,
          reversibility: "reversible",
          jurisdiction: "PE",
        },
      }),
    ).toThrow(/value/i);
    expect(() =>
      deriveRequiredMateriality({
        input: {
          value: 100n,
          reversibility: "partial" as never,
          jurisdiction: "PE",
        },
      }),
    ).toThrow(/reversibility/i);
    expect(() =>
      deriveRequiredMateriality({
        input: { value: 100n, reversibility: "reversible", jurisdiction: "" },
      }),
    ).toThrow(/jurisdiction/i);
    expect(() =>
      deriveRequiredMateriality({ input: undefined as never }),
    ).toThrow();

    // 4. Source-level ownership: lib/authority-gates.ts calls the kernel
    //    deriveMateriality(request.input) directly before any floor comparison
    //    and carries no Pi-local thresholds, jurisdiction table, or R0-R3 switch.
    const gatesSource = readFileSync(
      join(REPO_ROOT, "lib", "authority-gates.ts"),
      "utf8",
    );
    const body = extractFunctionBody(
      gatesSource,
      "export function deriveRequiredMateriality(",
    );
    const kernelCall = "deriveMateriality(request.input)";
    const floorReturn = "return request.minimum";
    expect(body).toContain(kernelCall);
    expect(body).toContain("orderOf(derived)");
    expect(body.indexOf(kernelCall)).toBeLessThan(
      body.indexOf("orderOf(derived)"),
    );
    expect(body.indexOf(kernelCall)).toBeLessThan(body.indexOf(floorReturn));
    // No Pi-local monetary thresholds (BigInt cents literals), no jurisdiction
    // escalation table, no local R0-R3 derivation switch inside the body.
    expect(body).not.toMatch(/\d_?\d*_?\d*00n/);
    expect(body).not.toContain('"US"');
    expect(body).not.toMatch(/\bswitch\s*\(/);
    expect(body).not.toMatch(/\bcase\s+"R[0-3]"/);

    // 5. chains/monthly-close.ts supplies CLOSE_MATERIALITY input + R2 floor and
    //    re-derives through the harness/kernel — it owns no tier threshold.
    const closeSource = readFileSync(
      join(REPO_ROOT, "chains", "monthly-close.ts"),
      "utf8",
    );
    expect(closeSource).toMatch(
      /export const CLOSE_MATERIALITY:\s*ExplicitMaterialityRequest\s*=\s*\{/,
    );
    expect(closeSource).toMatch(/input:\s*\{/);
    expect(closeSource).toMatch(/minimum:\s*"R2"/);
    const assertBody = extractFunctionBody(
      closeSource,
      "private assertMateriality(",
    );
    expect(assertBody).toContain(
      'deriveRequiredMateriality({ input, minimum: "R2" })',
    );
    expect(assertBody).not.toMatch(/\bswitch\s*\(/);
  });
});

describe("T-WU1-002 agent authority ceilings (REQ-AUDIT-003)", () => {
  const agentFiles = (): string[] =>
    readdirSync(join(REPO_ROOT, "agents"))
      .filter(
        (entry) => entry.endsWith(".md") && entry.toLowerCase() !== "readme.md",
      )
      .sort();

  it("every agents/*.md frontmatter ceiling is ANALYZE or PREPARE — never EXECUTE", () => {
    const files = agentFiles();
    expect(files).toHaveLength(10);
    for (const file of files) {
      const text = readFileSync(join(REPO_ROOT, "agents", file), "utf8");
      const match = /^authority:\s*(.+)$/m.exec(text);
      expect(match, `${file} must declare an authority ceiling`).not.toBeNull();
      const ceiling = match![1]!.trim();
      expect(["ANALYZE", "PREPARE"], `${file} ceiling is ${ceiling}`).toContain(
        ceiling,
      );
    }
  });

  it("the agents/README.md inventory reports ANALYZE or PREPARE only", () => {
    const readme = readFileSync(join(REPO_ROOT, "agents", "README.md"), "utf8");
    const rows = [
      ...readme.matchAll(
        /^\|\s*`([^`]+)`\s*\|\s*[^|]*\|\s*(ASK|ANALYZE|PREPARE|EXECUTE)\s*\|/gm,
      ),
    ];
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      expect(
        ["ANALYZE", "PREPARE"],
        `README inventory row ${row[1]} reports ${row[2]}`,
      ).toContain(row[2]);
    }
  });

  it("no agent prose grants EXECUTE work (signing, granting, posting)", () => {
    for (const file of agentFiles()) {
      const text = readFileSync(join(REPO_ROOT, "agents", file), "utf8");
      const lowered = text.toLowerCase();
      const sentences = lowered.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (sentence.includes("execute")) {
          expect(
            sentence,
            `${file}: EXECUTE outside a prohibition sentence`,
          ).toMatch(/(never|no|not)/);
        }
      }
      // The prohibition itself must be present in every definition.
      expect(lowered, `${file} must forbid EXECUTE work`).toMatch(
        /(never|no|not)[^.\n]*execute/,
      );
    }
  });
});

describe("T-WU1-002 UNKNOWN zero blind retries (REQ-AUDIT-010)", () => {
  /** A continuation driver: advance prepared steps; stop when none is derived. */
  function driveUntilStopped(
    snapshot: MissionSnapshot,
    maxSteps: number,
  ): string[] {
    const advanced: string[] = [];
    let current = snapshot;
    for (let index = 0; index < maxSteps; index += 1) {
      const prepared = derivePreparedStep(current);
      if (prepared === null) {
        break;
      }
      advanced.push(prepared.phase);
      // The continuation would mutate through the engine; a blind retry would
      // call apply() here. Version bump only models a retry attempt.
      current = { ...current, version: current.version + 1 };
    }
    return advanced;
  }

  it("derivePreparedStep returns null for UNKNOWN and the driver performs zero attempts", () => {
    const unknown = makeMission(
      { status: AccountingMissionStatus.UNKNOWN },
      createEdaSteps("monthly-close"),
    );
    expect(derivePreparedStep(unknown)).toBeNull();
    expect(driveUntilStopped(unknown, 8)).toEqual([]);
  });

  it("triangulates: the same driver advances a RUNNING mission, proving the zero is UNKNOWN-specific", () => {
    const running = makeMission(
      {
        status: AccountingMissionStatus.RUNNING,
        currentStep: EDA_PHASE.INTAKE,
      },
      createEdaSteps("monthly-close"),
    );
    const prepared = derivePreparedStep(running);
    expect(prepared).not.toBeNull();
    expect(prepared?.disposition).toBe("RUN");
    expect(driveUntilStopped(running, 8).length).toBeGreaterThan(0);
  });
});

describe("T-WU1-002 local stores are non-authoritative (REQ-AUDIT-011)", () => {
  it("local persistence alone cannot authorize approve or execute", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-audit-stores-"));
    try {
      const binding = makeScopeBinding();
      const mission = makeMission(
        { status: AccountingMissionStatus.AWAITING_APPROVAL },
        createEdaSteps("monthly-close"),
      );

      // Pre-populate local persistence: mission snapshot, forged/local GRANTED
      // authority record, evidence node, export artifact, and context-shaped data.
      const stores = createDurableMissionStores(root);
      await stores.store.save(mission);
      const forged = makeAuthorization(
        {
          decision: "GRANTED",
          scopeHash: binding.scopeHash,
          missionId: mission.id,
        },
        binding,
      );
      await new AuthorityStore(root).appendAuthorization(forged);
      await new EvidenceGraphStore(root).appendNode({
        id: "src-forged",
        missionId: mission.id,
        nodeKind: EVIDENCE_NODE_KIND.SOURCE,
        payload: { kind: "ledger", reference: "B001", amountCents: 1_000_000 },
      });
      mkdirSync(join(root, ".local", "exports"), { recursive: true });
      writeFileSync(
        join(root, ".local", "exports", `${mission.id}.json`),
        `${JSON.stringify({ kind: "monthly-close-export", missionId: mission.id })}\n`,
      );
      writeFileSync(
        join(root, ".local", "context.json"),
        `${JSON.stringify({ company: binding.scope.company, fiscalPeriod: binding.scope.fiscalPeriod })}\n`,
      );

      // The forged local GRANTED is the only authority artifact present; the
      // human approval and the kernel receipt are omitted.
      const loaded = await new AuthorityStore(root).findBoundAuthorization({
        missionId: mission.id,
        scopeHash: binding.scopeHash,
        actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
        actorId: binding.scope.actor,
      });
      expect(loaded?.decision).toBe("GRANTED");

      const results = await runAuthorityPipeline({
        binding,
        authorization: loaded!,
        action: ACTION_FAMILY.EXECUTE_TARGET,
        mission,
        targetStatus: AccountingMissionStatus.APPROVED,
        materiality: { input: R2_MATERIALITY },
        approvals: [],
        approvalReceipt: undefined,
        trustedKeys: [],
      });
      expect(
        results.map((result) => `${result.stage}:${result.verdict}`),
      ).toEqual([
        "scope:allowed",
        "mode:allowed",
        "materiality:allowed",
        "mission:allowed",
        "approval:needs_input",
      ]);
      // No execute/close transition is performed: the mission is never mutated,
      // no receipt stage is reached, and the kernel gate still needs the human.
      expect(mission.status).toBe(AccountingMissionStatus.AWAITING_APPROVAL);
      expect(results.some((result) => result.stage === "receipt")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a stored receipt without a trusted verification path cannot become execution proof", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-audit-receipt-"));
    try {
      const binding = makeScopeBinding();
      const mission = makeMission(
        { status: AccountingMissionStatus.AWAITING_APPROVAL },
        createEdaSteps("monthly-close"),
      );
      const { receipt } = makeApprovalReceipt();
      await new ReceiptStore(root).save({
        binding: {
          version: "drenyra.receipt-binding.v1",
          scopeHash: binding.scopeHash,
          authorizationId: `auth-${mission.id}-close`,
          policyVersion: binding.scope.policyVersion,
          targetHash: "d".repeat(64),
          evidenceHash: receipt.content.evidenceHash,
        },
        receipt,
      });
      const stored = await new ReceiptStore(root).load(receipt.receiptHash);
      expect(stored).toBeDefined();

      // Integrity and signature hold, but storage alone never establishes trust.
      const verified = verifySignedReceipt(stored!.receipt);
      expect(verified.valid).toBe(true);
      expect(verified.hashValid).toBe(true);
      expect(verified.signatureValid).toBe(true);

      // The kernel receipt gate still blocks EXECUTE without a trusted-key list:
      // the cached record cannot become execution proof.
      const results = await runAuthorityPipeline({
        binding,
        authorization: makeAuthorization(
          { scopeHash: binding.scopeHash, missionId: mission.id },
          binding,
        ),
        action: ACTION_FAMILY.EXECUTE_TARGET,
        mission,
        targetStatus: AccountingMissionStatus.APPROVED,
        materiality: { input: R2_MATERIALITY },
        approvals: [
          {
            approverId: "alice",
            at: "2026-07-01T00:00:00.000Z",
            reason: "close",
          },
        ],
        approvalReceipt: stored!.receipt,
        trustedKeys: [],
      });
      const receiptStage = results[5];
      expect(receiptStage?.stage).toBe("receipt");
      expect(receiptStage?.verdict).toBe("blocked");
      expect(receiptStage?.reason).toMatch(/trustedKeys/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("T-WU1-002 delegation to the published pinned runtime (REQ-AUDIT-012)", () => {
  it("authoritative operations import only the four public kernel entry points", () => {
    const audited = [
      "lib/authority-gates.ts",
      "lib/accounting-status.ts",
      "lib/chain-pipeline.ts",
      "chains/monthly-close.ts",
    ];
    const allowed = new Set([
      "drenyra-ai/missions",
      "drenyra-ai/candidates",
      "drenyra-ai/gates",
      "drenyra-ai/receipts",
    ]);
    const seen = new Set<string>();
    for (const file of audited) {
      const source = readFileSync(join(REPO_ROOT, file), "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (m) => m[1],
      );
      for (const specifier of imports) {
        if (specifier.startsWith("drenyra-ai")) {
          expect(
            allowed,
            `${file} imports ${specifier} outside the public kernel surface`,
          ).toContain(specifier);
          seen.add(specifier);
        }
      }
    }
    // The tested mission collectively consumes all four authority entry points.
    expect([...seen].sort()).toEqual([
      "drenyra-ai/candidates",
      "drenyra-ai/gates",
      "drenyra-ai/missions",
      "drenyra-ai/receipts",
    ]);
  });
});
