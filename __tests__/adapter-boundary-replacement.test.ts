/**
 * Two-host replacement harness — WU2 executable evidence
 * (pi-sdd-040-adapter-boundary; design §4; REQ-HARNESS-001..005).
 *
 * Runs one bounded monthly-close fixture through (a) Pi's chain pipeline
 * (`MonthlyCloseChain` over an isolated temporary stores root) and (b) an
 * independent substitute host that consumes ONLY public `drenyra-ai@0.2.0`
 * entry points (`/missions`, `/candidates`, `/gates`, `/receipts`) plus the
 * shared fixture. Both raw results are projected through the canonical
 * `drenyra.authority-projection.v1` schema and compared for exact plain-data
 * equivalence. Five mutation negative controls prove the comparator fails with
 * the named field when a Core decision is overridden, a bound input changes, a
 * gate reorders, a receipt claim upgrades, or UNKNOWN is retried blindly.
 *
 * The canonical projection, its TypeScript interface, the comparator, mutation
 * helpers, and the normalization tests live HERE — they are test evidence, not
 * a production API (design §4.1). BigInt cents convert to canonical decimal
 * strings only at this projection boundary.
 *
 * Fiscal convention: monetary values are BigInt cents; no float is ever used.
 * Digests are lowercase hex sha-256.
 */

import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AccountingMissionStatus, type MissionSnapshot } from "drenyra-ai/missions";
import {
  deriveMateriality,
  orderOf,
  type Materiality,
} from "drenyra-ai/candidates";
import type { SigningKeyInfo } from "drenyra-ai/receipts";
import { verifySignedReceipt } from "drenyra-ai/receipts";
import { MonthlyCloseChain } from "../chains/monthly-close.js";
import {
  ACTION_FAMILY,
  runAuthorityPipeline,
  type AuthorityGateResult,
} from "../lib/authority-gates.js";
import {
  makeAuthorization,
  makeScopeBinding,
} from "./helpers/authority-fixtures.js";
import { EvidenceGraphStore, EVIDENCE_NODE_KIND } from "../lib/evidence-graph.js";
import { ReceiptStore } from "../lib/receipt-store.js";
import { sha256Canonical } from "../lib/canonicalization.js";
import {
  createRdaReplacementFixture,
  type RdaReplacementFixture,
} from "./fixtures/rda-replacement-fixture.js";
import {
  runSubstituteHost,
  type HostGateVerdictRecord,
  type SubstituteHostResult,
} from "./fixtures/rda-substitute-host.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");

/** The raw host result shape shared by both branches (design §4.4). */
type RawHostAuthorityResult = SubstituteHostResult;

// ---------------------------------------------------------------------------
// T-WU2-001 — anti-circularity import closure (REQ-HARNESS-002)
// ---------------------------------------------------------------------------

const SUBSTITUTE_FILES = [
  join(REPO_ROOT, "__tests__", "fixtures", "rda-substitute-host.ts"),
  join(REPO_ROOT, "__tests__", "fixtures", "rda-replacement-fixture.ts"),
];

/** The ONLY non-node import specifiers the substitute closure may use. */
const ALLOWED_SPECIFIERS = new Set([
  "drenyra-ai/missions",
  "drenyra-ai/candidates",
  "drenyra-ai/gates",
  "drenyra-ai/receipts",
  "./rda-replacement-fixture.js",
]);

/** Pi production path prefixes the closure must never resolve under. */
const FORBIDDEN_PI_PREFIXES = [
  "chains/",
  "lib/",
  "runtime/",
  "extensions/",
  "dist/",
  ".local/",
] as const;

function collectImportSpecifiers(filePath: string): string[] {
  const source = readFileText(filePath);
  const specifiers: string[] = [];
  for (const match of source.matchAll(
    /import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
  )) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
  for (const match of source.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    if (match[1] !== undefined) specifiers.push(match[1]);
  }
  return specifiers;
}

function readFileText(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  return readFileSync(filePath, "utf8");
}

/** Recursively assert the substitute closure imports nothing from Pi. */
function assertSubstituteImportClosure(rootFiles: readonly string[]): void {
  const visited = new Set<string>();
  const queue = [...rootFiles];
  while (queue.length > 0) {
    const file = queue.shift()!;
    const absolute = resolve(file);
    if (visited.has(absolute)) continue;
    visited.add(absolute);
    const relative = absolute.replace(`${resolve(REPO_ROOT)}${"/"}`, "");
    for (const spec of collectImportSpecifiers(absolute)) {
      if (spec.startsWith("node:")) {
        // Environment built-ins (hashing/serialization only) are not Pi
        // production imports and carry no authority surface.
        continue;
      }
      if (spec.startsWith("drenyra-ai")) {
        expect(
          ALLOWED_SPECIFIERS.has(spec),
          `${relative} imports disallowed drenyra-ai surface "${spec}" — only the four public entry points are allowed`,
        ).toBe(true);
        continue;
      }
      if (spec.startsWith("./") || spec.startsWith("../")) {
        expect(
          ALLOWED_SPECIFIERS.has(spec),
          `${relative} imports disallowed local module "${spec}" — only the shared fixture is allowed`,
        ).toBe(true);
        for (const prefix of FORBIDDEN_PI_PREFIXES) {
          expect(
            new RegExp(`(\\.\\.?/)+${prefix}`).test(spec),
            `${relative} must never import under Pi "${prefix}"`,
          ).toBe(false);
        }
        const target = resolve(dirname(absolute), spec);
        if (existsSync(target)) queue.push(target);
        continue;
      }
      expect.fail(
        `${relative} imports disallowed bare specifier "${spec}" — path aliases and package-root imports are rejected`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Canonical authority projection + comparator (T-WU2-003; design §4.4)
// ---------------------------------------------------------------------------

/** The canonical plain-data authority projection (schema v1). */
export interface CanonicalAuthorityProjection {
  schema: "drenyra.authority-projection.v1";
  scope: {
    elements: {
      tenant: string;
      organization: string;
      company: string;
      fiscalPeriod: string;
      ledgerBook: string;
      operationType: string;
      sourceSnapshot: string;
      policyVersion: string;
      actor: string;
      authorityLevel: string;
    };
    scopeHash: string;
  };
  binding: {
    evidenceHash: string;
    policyVersion: string;
  };
  materiality: {
    kernelTier: "R0" | "R1" | "R2" | "R3";
    declaredMinimum: "R0" | "R1" | "R2" | "R3" | null;
    effectiveTier: "R0" | "R1" | "R2" | "R3";
  };
  gates: readonly {
    order: number;
    stage: "mission" | "approval" | "receipt";
    verdict: "allowed" | "blocked" | "needs_input";
  }[];
  candidate: {
    targetHash: string;
    contentHash: string;
    content: {
      intent: string;
      company: string;
      fiscalPeriod: string;
      evidenceHash: string;
      policyVersion: string;
      operation: string;
      payload: unknown;
    };
  };
  approval: {
    required: boolean;
    humanApproverId: string;
    relationship: "approves-candidate";
    candidateContentHash: string;
    evidenceHash: string;
  };
  receipt: {
    type: string;
    binding: {
      scopeHash: string;
      evidenceHash: string;
      policyVersion: string;
      targetHash: string;
    };
    claims: {
      missionRelationship: "same-mission";
      company: string;
      actor: string;
      decision: string;
      evidenceHash: string;
      previousStatus: string;
      newStatus: string;
    };
    verified: boolean;
  };
  unknownHandling: {
    attemptsAfterUnknown: 0;
    resumeRequirement: "reconciliation-or-explicit-human-action";
  };
  terminal: {
    missionStatus: string;
    authorityDecision: "allowed" | "blocked" | "unknown";
  };
}

/**
 * Pure projection of a raw host result into the canonical authority schema.
 * Validates cross-artifact relationships before emitting relationship tokens:
 * `missionRelationship: "same-mission"` is emitted only when the receipt
 * mission id equals the actual host mission id — a mismatch throws instead of
 * being normalized (design §4.4).
 */
export function canonicalAuthorityProjection(
  raw: RawHostAuthorityResult,
): CanonicalAuthorityProjection {
  if (raw.receipt.missionId !== raw.hostMissionId) {
    throw new Error(
      `projection validation failed: receipt mission id "${raw.receipt.missionId}" does not match the host mission id "${raw.hostMissionId}" (missionRelationship)`,
    );
  }
  const blocked = raw.gates.some((gate) => gate.verdict === "blocked");
  const needsInput = raw.gates.some((gate) => gate.verdict === "needs_input");
  const authorityDecision: CanonicalAuthorityProjection["terminal"]["authorityDecision"] =
    blocked ? "blocked" : needsInput ? "unknown" : "allowed";
  const effectiveTier = raw.materiality.effectiveTier as Materiality;
  const required = orderOf(effectiveTier) >= orderOf("R2");

  return {
    schema: "drenyra.authority-projection.v1",
    scope: {
      elements: {
        tenant: raw.scope.elements.tenant,
        organization: raw.scope.elements.organization,
        company: raw.scope.elements.company,
        fiscalPeriod: raw.scope.elements.fiscalPeriod,
        ledgerBook: raw.scope.elements.ledgerBook,
        operationType: raw.scope.elements.operationType,
        sourceSnapshot: raw.scope.elements.sourceSnapshot,
        policyVersion: raw.scope.elements.policyVersion,
        actor: raw.scope.elements.actor,
        authorityLevel: raw.scope.elements.authorityLevel,
      },
      scopeHash: raw.scope.scopeHash,
    },
    binding: {
      evidenceHash: raw.evidence.evidenceHash,
      policyVersion: raw.policyVersion,
    },
    materiality: {
      kernelTier: raw.materiality.kernelTier,
      declaredMinimum: raw.materiality.declaredMinimum,
      effectiveTier: raw.materiality.effectiveTier,
    },
    gates: raw.gates.map((gate) => ({
      order: gate.order,
      stage: gate.stage,
      verdict: gate.verdict,
    })),
    candidate: {
      targetHash: raw.candidate.targetHash,
      contentHash: raw.candidate.contentHash,
      content: {
        intent: raw.candidate.content.intent,
        company: raw.candidate.content.company,
        fiscalPeriod: raw.candidate.content.fiscalPeriod,
        evidenceHash: raw.candidate.content.evidenceHash,
        policyVersion: raw.candidate.content.policyVersion,
        operation: raw.candidate.content.operation,
        payload: raw.candidate.content.payload,
      },
    },
    approval: {
      required,
      humanApproverId: raw.approval.humanApproverId,
      relationship: "approves-candidate",
      candidateContentHash: raw.approval.candidateContentHash,
      evidenceHash: raw.approval.evidenceHash,
    },
    receipt: {
      type: raw.receipt.type,
      binding: {
        scopeHash: raw.receipt.binding.scopeHash,
        evidenceHash: raw.receipt.binding.evidenceHash,
        policyVersion: raw.receipt.binding.policyVersion,
        targetHash: raw.receipt.binding.targetHash,
      },
      claims: {
        missionRelationship: "same-mission",
        company: raw.receipt.claims.company,
        actor: raw.receipt.claims.actor,
        decision: raw.receipt.claims.decision,
        evidenceHash: raw.receipt.claims.evidenceHash,
        previousStatus: raw.receipt.claims.previousStatus,
        newStatus: raw.receipt.claims.newStatus,
      },
      verified: raw.receipt.verified,
    },
    unknownHandling: {
      attemptsAfterUnknown: raw.unknownHandling.attemptsAfterUnknown as 0,
      resumeRequirement: "reconciliation-or-explicit-human-action",
    },
    terminal: {
      missionStatus: raw.terminal.missionStatus,
      authorityDecision,
    },
  };
}

/** Exact plain-data equivalence matcher; returns the first differing path. */
export function compareProjections(
  a: CanonicalAuthorityProjection,
  b: CanonicalAuthorityProjection,
): { equal: boolean; mismatch: string | null } {
  const path: string[] = [];
  const walk = (x: unknown, y: unknown): string | null => {
    if (x === y) return null;
    if (typeof x !== typeof y) return path.join(".") || "root";
    if (x === null || y === null) return path.join(".") || "root";
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) return `${path.join(".") || "root"}.length`;
      for (let index = 0; index < x.length; index += 1) {
        path.push(String(index));
        const diff = walk(x[index], y[index]);
        path.pop();
        if (diff !== null) return diff;
      }
      return null;
    }
    if (typeof x === "object") {
      const keys = new Set([...Object.keys(x as object), ...Object.keys(y as object)]);
      for (const key of keys) {
        path.push(key);
        const diff = walk(
          (x as Record<string, unknown>)[key],
          (y as Record<string, unknown>)[key],
        );
        path.pop();
        if (diff !== null) return diff;
      }
      return null;
    }
    return path.join(".") || "root";
  };
  const mismatch = walk(a, b);
  return { equal: mismatch === null, mismatch };
}

/** The exact, enumerated normalization exclusions (design §4.5). */
const NORMALIZED_RUNTIME_FIELDS: readonly { path: string; justification: string }[] = [
  { path: "runtimeMetadata.missionId", justification: "generated mission id; mission identity is retained via the same-mission relationship token" },
  { path: "runtimeMetadata.missionCreatedAt", justification: "runtime timestamp; cannot alter fiscal meaning" },
  { path: "runtimeMetadata.missionUpdatedAt", justification: "runtime timestamp; cannot alter fiscal meaning" },
  { path: "runtimeMetadata.receiptHash", justification: "generated receipt hash that includes the ephemeral signature" },
  { path: "runtimeMetadata.signerKeyId", justification: "ephemeral signing material" },
  { path: "runtimeMetadata.signature", justification: "ephemeral signing material" },
  { path: "runtimeMetadata.issuedAt", justification: "runtime timestamp; cannot alter fiscal meaning" },
  {
    path: "receipt.claims.payloadHash",
    justification:
      "the receipt payload hash covers the binding record, which embeds the runtime-generated authorization-record id (auth-<host-mission-id>-close, design §4.5 exclusion #1); the binding's authority-bearing fields (scopeHash, evidenceHash, policyVersion, targetHash) are retained and compared exactly, and receipt internal validity is retained via receipt.verified",
  },
];

/** Recursively assert no normalized runtime field leaks into the projection. */
function assertNoNormalizedFieldLeak(projection: unknown, at?: string): void {
  const current = at ?? "projection";
  expect(projection, `${current} must not be null`).not.toBeNull();
  if (Array.isArray(projection)) {
    projection.forEach((item, index) => assertNoNormalizedFieldLeak(item, `${current}[${index}]`));
    return;
  }
  if (typeof projection === "object") {
    for (const [key, value] of Object.entries(projection as Record<string, unknown>)) {
      if (NORMALIZED_RUNTIME_FIELDS.some((field) => field.path.endsWith(`.${key}`) || field.path === key)) {
        expect.fail(`normalized runtime field "${key}" leaked into ${current}`);
      }
      if (["signature", "signerKeyId", "issuedAt", "receiptHash", "createdAt", "updatedAt", "payloadHash"].includes(key)) {
        expect.fail(`runtime-generated field "${key}" leaked into ${current}`);
      }
      assertNoNormalizedFieldLeak(value, `${current}.${key}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Pi branch (T-WU2-004): run the fixture through Pi's chain pipeline
// ---------------------------------------------------------------------------

async function runPiBranch(
  fixture: RdaReplacementFixture,
  storesRoot: string,
): Promise<RawHostAuthorityResult> {
  const binding = makeScopeBinding({
    tenant: fixture.scope.tenant,
    organization: fixture.scope.organization,
    company: fixture.scope.company,
    fiscalPeriod: fixture.scope.fiscalPeriod,
    ledgerBook: fixture.scope.ledgerBook,
    operationType: fixture.scope.operationType,
    sourceSnapshot: fixture.scope.sourceSnapshot,
    policyVersion: fixture.scope.policyVersion,
    actor: fixture.scope.actor,
    authorityLevel: fixture.scope.authorityLevel,
  });

  const chain = new MonthlyCloseChain(binding, { storesRoot });
  let mission = await chain.startMission({
    sourceRefs: [],
    materiality: fixture.materiality.input,
  });

  // Land the fixture evidence in the close mission's evidence graph.
  const graph = new EvidenceGraphStore(storesRoot);
  for (const entry of fixture.evidence) {
    await graph.appendNode({
      id: entry.id,
      missionId: mission.id,
      nodeKind: EVIDENCE_NODE_KIND.SOURCE,
      payload: {
        kind: entry.kind,
        reference: entry.reference,
        amountCents: entry.amountCents,
      },
    });
  }

  // Drive the bounded 13-phase close; capture the APPROVED snapshot at the
  // approve phase for the authority checkpoint.
  let approvedMission: MissionSnapshot | undefined;
  for (let index = 0; index < 16 && mission.status !== AccountingMissionStatus.COMPLETED; index += 1) {
    const step = await chain.advance({
      missionId: mission.id,
      approverId: fixture.humanApproval.approverId,
      reason: fixture.humanApproval.reason,
      satisfyEvidence: mission.status === AccountingMissionStatus.WAITING_FOR_EVIDENCE,
    });
    mission = step.mission;
    if (step.phase === "approve") approvedMission = mission;
    if (step.waitReason !== undefined) {
      throw new Error(`pi branch stopped at wait ${step.waitReason}`);
    }
  }
  if (mission.status !== AccountingMissionStatus.COMPLETED) {
    throw new Error(`pi branch did not complete (status ${mission.status})`);
  }
  if (approvedMission === undefined) {
    throw new Error("pi branch: no approved mission captured");
  }
  if (mission.proposal === null) {
    throw new Error("pi branch: completed mission has no proposal");
  }
  if (mission.receiptHash === null) {
    throw new Error("pi branch: completed mission has no receipt hash");
  }

  const proposal = mission.proposal;
  const receiptStore = new ReceiptStore(storesRoot);
  const record = await receiptStore.load(mission.receiptHash);
  if (record === undefined) {
    throw new Error("pi branch: persisted receipt not found");
  }
  const receipt = record.receipt;

  const evidenceItems = fixture.evidence.map((entry) => ({
    id: entry.id,
    label: "source" as const,
    type: "source" as const,
  }));
  const evidenceHash = proposal.evidenceHash;

  const kernelTier = deriveMateriality(fixture.materiality.input);
  const declaredMinimum = fixture.materiality.minimum;
  const effectiveTier =
    orderOf(kernelTier) >= orderOf(declaredMinimum) ? kernelTier : declaredMinimum;

  // Pi's own authority pipeline at the closing checkpoint: the kernel gates
  // evaluate mission (APPROVED -> COMPLETED), approval, and receipt in order.
  const trustedKey: SigningKeyInfo = {
    keyId: receipt.signerKeyId,
    publicKey: receipt.signerPublicKey,
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  const pipeline: readonly AuthorityGateResult[] = await runAuthorityPipeline({
    binding,
    authorization: makeAuthorization(
      { scopeHash: binding.scopeHash, missionId: mission.id },
      binding,
    ),
    action: ACTION_FAMILY.EXECUTE_TARGET,
    mission: approvedMission,
    targetStatus: AccountingMissionStatus.COMPLETED,
    materiality: { input: fixture.materiality.input, minimum: fixture.materiality.minimum },
    approvals: [
      {
        approverId: fixture.humanApproval.approverId,
        at: approvedMission.updatedAt,
        reason: fixture.humanApproval.reason,
      },
    ],
    approvalReceipt: receipt,
    trustedKeys: [trustedKey],
  });
  const kernelStages: HostGateVerdictRecord[] = pipeline
    .filter(
      (result) =>
        result.stage === "mission" || result.stage === "approval" || result.stage === "receipt",
    )
    .map((result, index) => ({
      order: index + 1,
      stage: result.stage as HostGateVerdictRecord["stage"],
      verdict: result.verdict as HostGateVerdictRecord["verdict"],
    }));

  const targetHash = sha256Canonical({
    chain: "monthly-close",
    phase: "close",
    proposalVersion: proposal.version,
    evidenceHash,
  });
  const candidateContent = {
    intent: mission.intent,
    company: mission.companyId,
    fiscalPeriod: mission.fiscalPeriod,
    evidenceHash,
    policyVersion: binding.scope.policyVersion,
    operation: fixture.target.operation,
    payload: fixture.target.content,
  };
  const contentHash = sha256Canonical(candidateContent);
  const verified = verifySignedReceipt(receipt).valid;

  return {
    hostMissionId: mission.id,
    scope: {
      elements: {
        tenant: fixture.scope.tenant,
        organization: fixture.scope.organization,
        company: fixture.scope.company,
        fiscalPeriod: fixture.scope.fiscalPeriod,
        ledgerBook: fixture.scope.ledgerBook,
        operationType: fixture.scope.operationType,
        sourceSnapshot: fixture.scope.sourceSnapshot,
        policyVersion: fixture.scope.policyVersion,
        actor: fixture.scope.actor,
        authorityLevel: fixture.scope.authorityLevel,
      },
      scopeHash: binding.scopeHash,
    },
    evidence: { items: evidenceItems, evidenceHash },
    policyVersion: binding.scope.policyVersion,
    materiality: { input: fixture.materiality.input, declaredMinimum, kernelTier, effectiveTier },
    gates: kernelStages,
    candidate: { targetHash, contentHash, content: candidateContent },
    approval: {
      humanApproverId: fixture.humanApproval.approverId,
      candidateContentHash: contentHash,
      evidenceHash,
    },
    receipt: {
      type: receipt.receiptType,
      missionId: receipt.content.missionId,
      binding: {
        scopeHash: binding.scopeHash,
        evidenceHash,
        policyVersion: binding.scope.policyVersion,
        targetHash,
      },
      claims: {
        company: receipt.content.companyId,
        actor: receipt.content.actorId,
        decision: receipt.content.decision,
        evidenceHash: receipt.content.evidenceHash,
        previousStatus: receipt.content.previousStatus,
        newStatus: receipt.content.newStatus,
        payloadHash: receipt.content.payloadHash,
      },
      verified,
    },
    unknownHandling: { attemptsAfterUnknown: 0 },
    terminal: { missionStatus: mission.status },
    runtimeMetadata: {
      missionId: mission.id,
      missionCreatedAt: mission.createdAt,
      missionUpdatedAt: mission.updatedAt,
      receiptHash: receipt.receiptHash,
      signerKeyId: receipt.signerKeyId,
      signature: receipt.signature,
      issuedAt: receipt.issuedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("T-WU2-001 anti-circularity import closure (REQ-HARNESS-002)", () => {
  it("the substitute host and fixture import only the five allowed specifiers", () => {
    assertSubstituteImportClosure(SUBSTITUTE_FILES);
  });

  it("the fixture is deterministic, frozen, manifest-derived, and carries no precomputed authority artifact", () => {
    const a = createRdaReplacementFixture();
    const b = createRdaReplacementFixture();
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.scope)).toBe(true);
    expect(sha256Canonical(a.manifest)).toBe(a.scope.sourceSnapshot);
    expect(a.scope.company).toBe("20123456786");
    expect(a.scope.fiscalPeriod).toMatch(/^\d{4}(0[1-9]|1[0-2])$/);
    expect(a.materiality.minimum).toBe("R2");
    expect(a.evidence.every((entry) => typeof entry.amountCents === "bigint")).toBe(true);
    // No precomputed gate verdicts, materiality tier, or receipt.
    expect(a).not.toHaveProperty("gates");
    expect(a).not.toHaveProperty("receipt");
    expect(a).not.toHaveProperty("materialityTier");
  });
});

describe("T-WU2-002 substitute host smoke (REQ-HARNESS-001 basis)", () => {
  it("runs the bounded fixture to COMPLETED through kernel entry points alone", async () => {
    const raw = await runSubstituteHost(createRdaReplacementFixture());
    expect(raw.terminal.missionStatus).toBe("COMPLETED");
    expect(raw.gates.map((gate) => `${gate.stage}:${gate.verdict}`)).toEqual([
      "mission:allowed",
      "approval:allowed",
      "receipt:allowed",
    ]);
    expect(raw.materiality.kernelTier).toBe("R1");
    expect(raw.materiality.effectiveTier).toBe("R2");
    expect(raw.receipt.verified).toBe(true);
  });
});

describe("T-WU2-003 canonical projection + normalization (REQ-HARNESS-003/004)", () => {
  it("projects a raw host result into the canonical schema and validates the same-mission relationship", async () => {
    const raw = await runSubstituteHost(createRdaReplacementFixture());
    const projection = canonicalAuthorityProjection(raw);
    expect(projection.schema).toBe("drenyra.authority-projection.v1");
    expect(projection.receipt.claims.missionRelationship).toBe("same-mission");
    expect(projection.receipt.verified).toBe(true);
    expect(projection.materiality.effectiveTier).toBe("R2");
    expect(projection.terminal.authorityDecision).toBe("allowed");

    // A receipt bound to a DIFFERENT mission must make projection validation throw.
    const mismatched = {
      ...raw,
      receipt: { ...raw.receipt, missionId: "mission_somewhere_else" },
    };
    expect(() => canonicalAuthorityProjection(mismatched)).toThrow(/mission id/);
  });

  it("normalizes only generated ids/timestamps/signatures; authority-bearing fields never leak", async () => {
    const rawA = await runSubstituteHost(createRdaReplacementFixture());
    const rawB = await runSubstituteHost(createRdaReplacementFixture());

    // At least the documented generated id and ephemeral signing material differ.
    expect(rawA.runtimeMetadata.missionId).not.toBe(rawB.runtimeMetadata.missionId);
    expect(rawA.runtimeMetadata.signature).not.toBe(rawB.runtimeMetadata.signature);

    // The excluded receipt payload hash is runtime-generated (it covers the
    // generated authorization-record id), while the retained authority-bearing
    // binding fields stay exactly equal between runs (design §4.5).
    expect(rawA.receipt.claims.payloadHash).not.toBe(rawB.receipt.claims.payloadHash);
    expect(rawA.receipt.binding).toEqual(rawB.receipt.binding);
    expect(rawA.receipt.claims.company).toBe(rawB.receipt.claims.company);
    expect(rawA.receipt.claims.previousStatus).toBe(rawB.receipt.claims.previousStatus);

    const projectionA = canonicalAuthorityProjection(rawA);
    const projectionB = canonicalAuthorityProjection(rawB);
    expect(compareProjections(projectionA, projectionB).equal).toBe(true);
    assertNoNormalizedFieldLeak(projectionA);
    assertNoNormalizedFieldLeak(projectionB);

    // Every exclusion is documented and named (design §4.5).
    expect(NORMALIZED_RUNTIME_FIELDS.map((field) => field.path).sort()).toEqual([
      "receipt.claims.payloadHash",
      "runtimeMetadata.issuedAt",
      "runtimeMetadata.missionCreatedAt",
      "runtimeMetadata.missionId",
      "runtimeMetadata.missionUpdatedAt",
      "runtimeMetadata.receiptHash",
      "runtimeMetadata.signature",
      "runtimeMetadata.signerKeyId",
    ]);
  });

  it("every retained authority-bearing category changes the projection when mutated", async () => {
    const base = await runSubstituteHost(createRdaReplacementFixture());
    const baseline = canonicalAuthorityProjection(base);
    const mutations: readonly {
      name: string;
      mutate: (raw: RawHostAuthorityResult) => void;
      expected: string;
    }[] = [
      { name: "scope element", mutate: (r) => { r.scope.elements.actor = "bob"; }, expected: "scope.elements.actor" },
      { name: "scope hash", mutate: (r) => { r.scope.scopeHash = "c".repeat(64); }, expected: "scope.scopeHash" },
      { name: "evidence hash", mutate: (r) => { r.evidence.evidenceHash = "d".repeat(64); }, expected: "binding.evidenceHash" },
      { name: "policy version", mutate: (r) => { r.policyVersion = "policies.v2"; }, expected: "binding.policyVersion" },
      { name: "kernel tier", mutate: (r) => { r.materiality.kernelTier = "R3"; }, expected: "materiality.kernelTier" },
      { name: "declared minimum", mutate: (r) => { r.materiality.declaredMinimum = "R0"; }, expected: "materiality.declaredMinimum" },
      { name: "effective tier", mutate: (r) => { r.materiality.effectiveTier = "R3"; }, expected: "materiality.effectiveTier" },
      { name: "gate order", mutate: (r) => { r.gates[0].order = 9; }, expected: "gates.0.order" },
      { name: "gate stage", mutate: (r) => { r.gates[1].stage = "receipt"; }, expected: "gates.1.stage" },
      { name: "gate verdict", mutate: (r) => { r.gates[2].verdict = "blocked"; }, expected: "gates.2.verdict" },
      { name: "candidate target hash", mutate: (r) => { r.candidate.targetHash = "e".repeat(64); }, expected: "candidate.targetHash" },
      { name: "candidate content hash", mutate: (r) => { r.candidate.contentHash = "f".repeat(64); }, expected: "candidate.contentHash" },
      { name: "candidate content", mutate: (r) => { r.candidate.content.operation = "correction"; }, expected: "candidate.content.operation" },
      { name: "approver identity", mutate: (r) => { r.approval.humanApproverId = "contador-02"; }, expected: "approval.humanApproverId" },
      { name: "approval candidate binding", mutate: (r) => { r.approval.candidateContentHash = "f".repeat(64); }, expected: "approval.candidateContentHash" },
      { name: "receipt type", mutate: (r) => { r.receipt.type = "EXECUTION"; }, expected: "receipt.type" },
      { name: "receipt binding", mutate: (r) => { r.receipt.binding.targetHash = "e".repeat(64); }, expected: "receipt.binding.targetHash" },
      { name: "receipt claim", mutate: (r) => { r.receipt.claims.newStatus = "EXECUTED"; }, expected: "receipt.claims.newStatus" },
      { name: "receipt verification", mutate: (r) => { r.receipt.verified = false; }, expected: "receipt.verified" },
      { name: "UNKNOWN retry count", mutate: (r) => { r.unknownHandling.attemptsAfterUnknown = 1; }, expected: "unknownHandling.attemptsAfterUnknown" },
      { name: "terminal status", mutate: (r) => { r.terminal.missionStatus = "FAILED"; }, expected: "terminal.missionStatus" },
    ];
    for (const mutation of mutations) {
      const mutated = structuredClone(base) as RawHostAuthorityResult;
      mutation.mutate(mutated);
      const projection = canonicalAuthorityProjection(mutated);
      const result = compareProjections(baseline, projection);
      expect(result.equal, mutation.name).toBe(false);
      expect(result.mismatch, mutation.name).toBe(mutation.expected);
    }
  });
});

describe("T-WU2-004 two-host equivalence baseline (REQ-HARNESS-001/003)", () => {
  it("runs the same fixture through Pi and the substitute host with equivalent canonical projections", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-replacement-pi-"));
    try {
      const rawPi = await runPiBranch(createRdaReplacementFixture(), root);
      const rawSub = await runSubstituteHost(createRdaReplacementFixture());

      const projectionPi = canonicalAuthorityProjection(rawPi);
      const projectionSub = canonicalAuthorityProjection(rawSub);
      const result = compareProjections(projectionPi, projectionSub);
      expect(result.equal, `projections differ at ${result.mismatch ?? "?"}`).toBe(true);

      // Concrete values prove REAL kernel execution, not mock coincidence.
      expect(projectionPi.materiality.kernelTier).toBe("R1");
      expect(projectionPi.materiality.declaredMinimum).toBe("R2");
      expect(projectionPi.materiality.effectiveTier).toBe("R2");
      expect(projectionPi.gates.map((gate) => `${gate.stage}:${gate.verdict}`)).toEqual([
        "mission:allowed",
        "approval:allowed",
        "receipt:allowed",
      ]);
      expect(projectionPi.approval.humanApproverId).toBe("contador-01");
      expect(projectionPi.receipt.verified).toBe(true);
      expect(projectionPi.receipt.claims.newStatus).toBe("COMPLETED");
      expect(projectionPi.terminal).toEqual({
        missionStatus: "COMPLETED",
        authorityDecision: "allowed",
      });
      expect(projectionPi.scope.scopeHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("T-WU2-005 five negative controls (REQ-HARNESS-005)", () => {
  it("each mutation makes the equivalence fail with the named field", async () => {
    const root = mkdtempSync(join(tmpdir(), "drenyra-replacement-controls-"));
    try {
      const rawPi = await runPiBranch(createRdaReplacementFixture(), root);
      const baselineSub = await runSubstituteHost(createRdaReplacementFixture());
      const baselinePi = canonicalAuthorityProjection(rawPi);
      const baseline = canonicalAuthorityProjection(baselineSub);

      // Sanity: the baseline itself is equivalent.
      const baselineResult = compareProjections(baselinePi, baseline);
      expect(baselineResult.equal, `baseline must be equivalent (${baselineResult.mismatch ?? "?"})`).toBe(true);

      const controls: readonly {
        name: string;
        mutate: (raw: RawHostAuthorityResult) => void;
        expected: RegExp;
      }[] = [
        {
          name: "1. override a Core decision (materiality.effectiveTier)",
          mutate: (r) => { r.materiality.effectiveTier = "R3"; },
          expected: /^materiality\.effectiveTier$/,
        },
        {
          name: "2. change a bound input (scope.sourceSnapshot on one side)",
          mutate: (r) => { r.scope.elements.sourceSnapshot = "b".repeat(64); },
          expected: /^scope\.elements\.sourceSnapshot$/,
        },
        {
          name: "3. reorder/substitute a gate (approval <-> receipt)",
          mutate: (r) => { [r.gates[1], r.gates[2]] = [r.gates[2], r.gates[1]]; },
          expected: /^gates/,
        },
        {
          name: "4. upgrade a receipt claim (COMPLETION -> EXECUTION)",
          mutate: (r) => { r.receipt.type = "EXECUTION"; },
          expected: /^receipt\.type$/,
        },
        {
          name: "5. retry UNKNOWN blindly (attemptsAfterUnknown -> 1)",
          mutate: (r) => { r.unknownHandling.attemptsAfterUnknown = 1; },
          expected: /^unknownHandling\.attemptsAfterUnknown$/,
        },
      ];

      for (const control of controls) {
        const mutated = structuredClone(baselineSub) as RawHostAuthorityResult;
        control.mutate(mutated);
        const projection = canonicalAuthorityProjection(mutated);
        const result = compareProjections(baselinePi, projection);
        expect(result.equal, `${control.name} must break equivalence`).toBe(false);
        expect(result.mismatch, control.name).toMatch(control.expected);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
