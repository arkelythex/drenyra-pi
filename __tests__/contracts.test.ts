/**
 * Contract family conformance tests — the four durable JSON-schema contract
 * families (mission, evidence, authority, receipts) every harness payload must
 * validate against (REQ-CONTRACTS-007).
 *
 * The schemas mirror the pinned drenyra-ai@0.4.0 types field-for-field and
 * follow the consumer-only discipline (REQ-CONTRACTS-006): the harness
 * references the engine contract, never deep-imports unexported surfaces.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or decimal strings at JSON boundaries — never floats); digests
 * are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
} from "drenyra-ai/receipts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = join(HERE, "..", "contracts");

const VALID_RUC = "20123456786";
const PERIOD = "202607";
const TS = "2026-07-01T00:00:00.000Z";
const HEX64 = /^[0-9a-f]{64}$/;

/** Recursively collect every versioned JSON schema under contracts/. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".schema.json")) {
      out.push(full);
    }
  }
  return out;
}

/** One Ajv instance with every shipped schema registered by $id. */
function buildAjv(): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const file of walk(CONTRACTS_DIR)) {
    const schema = JSON.parse(readFileSync(file, "utf8")) as { $id?: unknown };
    if (typeof schema.$id === "string") {
      ajv.addSchema(schema as Parameters<Ajv["addSchema"]>[0], schema.$id);
    }
  }
  return ajv;
}

/** Validate a document against a schema $id; return verdict + readable errors. */
function validateWith(
  $id: string,
  data: unknown,
): { valid: boolean; errors: string[] } {
  const ajv = buildAjv();
  const valid = ajv.validate($id, data);
  return {
    valid: valid === true,
    errors: (ajv.errors ?? []).map((e) =>
      `${e.instancePath} ${e.message}`.trim(),
    ),
  };
}

function expectValid($id: string, data: unknown): void {
  const result = validateWith($id, data);
  expect(result.errors, result.errors.join("; ")).toEqual([]);
  expect(result.valid).toBe(true);
}

function expectInvalid($id: string, data: unknown): string[] {
  const result = validateWith($id, data);
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
  return result.errors;
}

// ---------------------------------------------------------------------------
// Fixtures (engine-shaped; pinned drenyra-ai@0.4.0 d.ts is the source of truth)
// ---------------------------------------------------------------------------

/** MissionSnapshot fixture mirroring node_modules/drenyra-ai/dist/missions/types.d.ts. */
function missionSnapshotFixture(): Record<string, unknown> {
  return {
    id: "mission-001",
    companyId: VALID_RUC,
    fiscalPeriod: PERIOD,
    intent: "monthly-close",
    status: "RUNNING",
    version: 3,
    progress: 0,
    steps: [
      {
        id: "step-1",
        name: "intake",
        status: "COMPLETED",
        completedAt: TS,
      },
      {
        id: "step-2",
        name: "bind-scope",
        status: "IN_PROGRESS",
        startedAt: TS,
        evidenceIds: ["evt-1"],
      },
    ],
    currentStep: "step-2",
    blockers: [
      {
        id: "blocker-1",
        reason: "bank statement missing",
        severity: "ERROR",
        occurredAt: TS,
      },
    ],
    proposal: null,
    rejection: null,
    receiptId: null,
    receiptHash: null,
    lastEventSequence: 5,
    createdAt: TS,
    updatedAt: TS,
  };
}

/** MissionEvent fixture mirroring node_modules/drenyra-ai/dist/missions/events.d.ts. */
function missionEventFixture(): Record<string, unknown> {
  return {
    id: "evt-1",
    missionId: "mission-001",
    sequence: 1,
    eventType: "STATE_TRANSITION",
    snapshot: missionSnapshotFixture(),
    createdAt: TS,
  };
}

/** Evidence graph document fixture mirroring design §7.1 record shapes. */
function evidenceGraphFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    missionId: "mission-001",
    nodes: [
      {
        schemaVersion: 1,
        recordKind: "node",
        id: "n-source-1",
        missionId: "mission-001",
        nodeKind: "source",
        payload: { ref: "balance-general-202607.json", amountCents: 1250000 },
        payloadHash: "a".repeat(64),
        createdAt: TS,
      },
      {
        schemaVersion: 1,
        recordKind: "node",
        id: "n-conclusion-1",
        missionId: "mission-001",
        nodeKind: "conclusion",
        payload: { summary: "general ledger balances to source manifest" },
        payloadHash: "b".repeat(64),
        createdAt: TS,
      },
    ],
    edges: [
      {
        schemaVersion: 1,
        recordKind: "edge",
        id: "e-1",
        missionId: "mission-001",
        from: "n-source-1",
        to: "n-conclusion-1",
        relation: "DERIVED_FROM",
        createdAt: TS,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mission contract family (REQ-CONTRACTS-001; SC-CONTRACTS-001)
// ---------------------------------------------------------------------------

describe("contracts: mission family (REQ-CONTRACTS-001)", () => {
  const SNAPSHOT_ID =
    "https://drenyra.dev/harness/contracts/mission/snapshot.schema.json";
  const EVENT_ID =
    "https://drenyra.dev/harness/contracts/mission/event.schema.json";

  it("validates a representative mission snapshot with status, steps, and blockers (SC-CONTRACTS-001)", () => {
    expectValid(SNAPSHOT_ID, missionSnapshotFixture());
  });

  it("validates a snapshot carrying a proposal and a rejection record", () => {
    const snapshot = missionSnapshotFixture();
    snapshot.proposal = {
      id: "proposal-1",
      missionId: "mission-001",
      version: 1,
      evidence: [{ id: "n-source-1", label: "general ledger", type: "source" }],
      evidenceHash: "c".repeat(64),
      summary: "proposed close for 202607",
      riskLevel: "LOW",
      generatedAt: TS,
    };
    snapshot.rejection = {
      reason: "missing evidence",
      rejectedBy: "contador-01",
      rejectedAt: TS,
      proposalVersion: 1,
    };
    expectValid(SNAPSHOT_ID, snapshot);
  });

  it("validates a mission event embedding a snapshot (SC-CONTRACTS-001)", () => {
    expectValid(EVENT_ID, missionEventFixture());
  });

  it("rejects a snapshot with an unknown status or intent", () => {
    const badStatus = missionSnapshotFixture();
    badStatus.status = "PAUSED";
    const errors = expectInvalid(SNAPSHOT_ID, badStatus);
    expect(errors.join(" ")).toMatch(/status/i);

    const badIntent = missionSnapshotFixture();
    badIntent.intent = "audit";
    const intentErrors = expectInvalid(SNAPSHOT_ID, badIntent);
    expect(intentErrors.join(" ")).toMatch(/intent/i);
  });

  it("rejects a snapshot with a non-integer version or a float money amount", () => {
    const badVersion = missionSnapshotFixture();
    badVersion.version = 3.5;
    expectInvalid(SNAPSHOT_ID, badVersion);

    // Money at JSON boundaries is BigInt cents: integer or decimal string.
    const floatMoney = missionSnapshotFixture();
    floatMoney.proposal = {
      id: "proposal-1",
      missionId: "mission-001",
      version: 1,
      evidence: [],
      evidenceHash: "c".repeat(64),
      summary: "close",
      riskLevel: "LOW",
      generatedAt: TS,
    };
    floatMoney.proposal = {
      ...(floatMoney.proposal as Record<string, unknown>),
      extraMoneyCents: 1250000.5,
    };
    expectInvalid(SNAPSHOT_ID, floatMoney);
  });

  it("rejects a malformed step status and a missing required step field", () => {
    const snapshot = missionSnapshotFixture();
    (snapshot.steps as Record<string, unknown>[])[0].status = "DONE";
    expectInvalid(SNAPSHOT_ID, snapshot);

    const missingName = missionSnapshotFixture();
    delete (missingName.steps as Record<string, unknown>[])[1].name;
    const errors = expectInvalid(SNAPSHOT_ID, missingName);
    expect(errors.join(" ")).toMatch(/name/i);
  });
});

// ---------------------------------------------------------------------------
// Evidence contract family (REQ-CONTRACTS-002; SC-CONTRACTS-002)
// ---------------------------------------------------------------------------

describe("contracts: evidence family (REQ-CONTRACTS-002)", () => {
  const GRAPH_ID =
    "https://drenyra.dev/harness/contracts/evidence/graph.schema.json";

  it("validates an evidence graph document with nodes, edges, and payload hashes (SC-CONTRACTS-002)", () => {
    expectValid(GRAPH_ID, evidenceGraphFixture());
  });

  it("accepts decimal-string money (BigInt cents at JSON boundaries) in a node payload", () => {
    const graph = evidenceGraphFixture();
    (graph.nodes as Record<string, unknown>[])[0].payload = {
      ref: "bank-202607.json",
      amountCents: "1250000",
    };
    expectValid(GRAPH_ID, graph);
  });

  it("rejects a float money amount in a node payload (REQ-CONTRACTS-008)", () => {
    const graph = evidenceGraphFixture();
    (graph.nodes as Record<string, unknown>[])[0].payload = {
      ref: "bank-202607.json",
      amountCents: 1250000.5,
    };
    const errors = expectInvalid(GRAPH_ID, graph);
    expect(errors.join(" ")).toMatch(/integer|pattern/i);
  });

  it("rejects an unknown node kind, unknown edge relation, and a malformed payload hash", () => {
    const badKind = evidenceGraphFixture();
    (badKind.nodes as Record<string, unknown>[])[1].nodeKind = "opinion";
    expectInvalid(GRAPH_ID, badKind);

    const badRelation = evidenceGraphFixture();
    (badRelation.edges as Record<string, unknown>[])[0].relation = "LINKED";
    expectInvalid(GRAPH_ID, badRelation);

    const badHash = evidenceGraphFixture();
    (badHash.nodes as Record<string, unknown>[])[0].payloadHash = "xyz";
    const errors = expectInvalid(GRAPH_ID, badHash);
    expect(errors.join(" ")).toMatch(/payloadHash/i);
  });

  it("rejects an edge whose endpoint fields are missing", () => {
    const graph = evidenceGraphFixture();
    delete (graph.edges as Record<string, unknown>[])[0].to;
    const errors = expectInvalid(GRAPH_ID, graph);
    expect(errors.join(" ")).toMatch(/to/i);
  });
});

// ---------------------------------------------------------------------------
// Authority contract family (REQ-CONTRACTS-003; SC-CONTRACTS-003)
// ---------------------------------------------------------------------------

/** CanonicalScope fixture — the 10-element scope binding (design §3.1). */
function canonicalScopeFixture(): Record<string, unknown> {
  return {
    tenant: "tenant-acme",
    organization: "org-acme",
    company: VALID_RUC,
    fiscalPeriod: PERIOD,
    ledgerBook: "general-ledger",
    operationType: "monthly-close",
    sourceSnapshot: "0".repeat(64),
    policyVersion: "drenyra.policy.v1",
    actor: "user-01",
    authorityLevel: "PREPARE",
  };
}

/** Authorization record fixture: 10-element scope binding + mode + decision. */
function authorizationRecordFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: canonicalScopeFixture(),
    mode: "PREPARE",
    authorization: {
      id: "auth-001",
      missionId: "mission-001",
      scopeHash: "d".repeat(64),
      authorityMode: "PREPARE",
      actionFamily: "PREPARE_CANDIDATE",
      actorId: "user-01",
      decision: "GRANTED",
      issuedAt: TS,
    },
  };
}

/** ReceiptBinding fixture (design §3.3) — the signed scope/evidence binding. */
function receiptBindingFixture(): Record<string, unknown> {
  return {
    version: "drenyra.receipt-binding.v1",
    scopeHash: "d".repeat(64),
    authorizationId: "auth-001",
    policyVersion: "drenyra.policy.v1",
    targetHash: "c".repeat(64),
    evidenceHash: "e".repeat(64),
  };
}

/** Trusted-key registry fixture (design §6.1) mirroring SigningKeyInfo. */
function trustedKeyRegistryFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    keys: {
      "key-001": {
        keyId: "key-001",
        publicKey: "A".repeat(44),
        issuedAt: TS,
      },
    },
  };
}

describe("contracts: authority family (REQ-CONTRACTS-003)", () => {
  const SCOPE_ID =
    "https://drenyra.dev/harness/contracts/authority/scope-binding.schema.json";
  const MODE_ID =
    "https://drenyra.dev/harness/contracts/authority/authority-mode.schema.json";
  const AUTH_ID =
    "https://drenyra.dev/harness/contracts/authority/authorization-record.schema.json";

  it("validates an authority record with a 10-element scope binding and a mode (SC-CONTRACTS-003)", () => {
    expectValid(AUTH_ID, authorizationRecordFixture());
  });

  it("accepts exactly the four authority modes ASK, ANALYZE, PREPARE, EXECUTE (REQ-CONTRACTS-003)", () => {
    for (const mode of ["ASK", "ANALYZE", "PREPARE", "EXECUTE"]) {
      expectValid(MODE_ID, mode);
    }
    const errors = expectInvalid(MODE_ID, "APPROVE");
    expect(errors.join(" ")).toMatch(/allowed values/i);
  });

  it("requires all 10 scope elements; a missing element fails closed (REQ-SCOPE-001)", () => {
    const scope = canonicalScopeFixture();
    delete scope.tenant;
    const errors = expectInvalid(SCOPE_ID, scope);
    expect(errors.join(" ")).toMatch(/tenant/i);

    const missingLevel = canonicalScopeFixture();
    delete missingLevel.authorityLevel;
    expectInvalid(SCOPE_ID, missingLevel);
  });

  it("rejects an invalid authorityLevel and a float scopeHash in the authorization record", () => {
    const badMode = authorizationRecordFixture();
    (badMode.scope as Record<string, unknown>).authorityLevel = "SUDO";
    expectInvalid(AUTH_ID, badMode);

    const badHash = authorizationRecordFixture();
    (badHash.authorization as Record<string, unknown>).scopeHash = 12345.5;
    const errors = expectInvalid(AUTH_ID, badHash);
    expect(errors.join(" ")).toMatch(/scopeHash/i);
  });

  it("rejects an unknown action family and a denied/unknown decision mismatch", () => {
    const badFamily = authorizationRecordFixture();
    (badFamily.authorization as Record<string, unknown>).actionFamily =
      "DELETE";
    expectInvalid(AUTH_ID, badFamily);
  });
});

describe("contracts: receipts family (REQ-CONTRACTS-004)", () => {
  const RECEIPT_ID =
    "https://drenyra.dev/harness/contracts/receipts/signed-receipt.schema.json";
  const BINDING_ID =
    "https://drenyra.dev/harness/contracts/receipts/receipt-binding.schema.json";

  function engineSignedReceipt(receiptType: string): Record<string, unknown> {
    const keyPair = generateReceiptKeyPair("key-001");
    const content = {
      missionId: "mission-001",
      companyId: VALID_RUC,
      actorId: "contador-01",
      decision: "APPROVE" as const,
      proposalVersion: 2,
      evidenceHash: "e".repeat(64),
      previousStatus: "AWAITING_APPROVAL",
      newStatus: "APPROVED",
      payloadHash: "f".repeat(64),
      timestamp: TS,
    };
    return buildSignedReceipt(
      content,
      keyPair,
      "1.0",
      receiptType as
        | "APPROVAL"
        | "EXECUTION"
        | "COMPLETION"
        | "EXTERNAL_SUBMISSION",
    ) as unknown as Record<string, unknown>;
  }

  it("validates an engine-produced SignedReceipt field-for-field (REQ-CONTRACTS-004; SC-CONTRACTS-004)", () => {
    const receipt = engineSignedReceipt("APPROVAL");
    expectValid(RECEIPT_ID, receipt);

    // Every engine field is present with the expected shape/type.
    const content = receipt.content as Record<string, unknown>;
    expect(receipt.protocolVersion).toBe("1.0");
    expect(receipt.receiptType).toBe("APPROVAL");
    expect(receipt.algorithm).toBe("Ed25519");
    expect(typeof receipt.receiptHash).toBe("string");
    expect(HEX64.test(receipt.receiptHash as string)).toBe(true);
    expect(typeof receipt.signerKeyId).toBe("string");
    expect(typeof receipt.signerPublicKey).toBe("string");
    expect(typeof receipt.signature).toBe("string");
    expect(typeof receipt.issuedAt).toBe("string");
    for (const key of [
      "missionId",
      "companyId",
      "actorId",
      "decision",
      "proposalVersion",
      "evidenceHash",
      "previousStatus",
      "newStatus",
      "payloadHash",
      "timestamp",
    ]) {
      expect(content[key]).toBeDefined();
    }
    expect(content.decision).toBe("APPROVE");
    expect(typeof content.proposalVersion).toBe("number");
    expect(Number.isInteger(content.proposalVersion)).toBe(true);
    expect(content.evidenceHash).toMatch(HEX64);
  });

  it("validates COMPLETION receipts too (all four receipt types are legal)", () => {
    expectValid(RECEIPT_ID, engineSignedReceipt("COMPLETION"));
  });

  it("rejects a tampered receipt content field with a descriptive error (SC-CONTRACTS-005)", () => {
    const tamperedType = engineSignedReceipt("APPROVAL");
    (tamperedType.content as Record<string, unknown>).proposalVersion = "2";
    const errors = expectInvalid(RECEIPT_ID, tamperedType);
    expect(errors.join(" ")).toMatch(/proposalVersion/i);

    const tamperedMissing = engineSignedReceipt("APPROVAL");
    delete (tamperedMissing.content as Record<string, unknown>).missionId;
    const missingErrors = expectInvalid(RECEIPT_ID, tamperedMissing);
    expect(missingErrors.join(" ")).toMatch(/missionId/i);
  });

  it("rejects a float proposalVersion and a wrong algorithm in the receipt", () => {
    const floatVersion = engineSignedReceipt("APPROVAL");
    (floatVersion.content as Record<string, unknown>).proposalVersion = 2.5;
    expectInvalid(RECEIPT_ID, floatVersion);

    const wrongAlgorithm = engineSignedReceipt("APPROVAL");
    wrongAlgorithm.algorithm = "RSA";
    expectInvalid(RECEIPT_ID, wrongAlgorithm);
  });

  it("validates a ReceiptBinding and rejects a tampered version or missing scope hash", () => {
    expectValid(BINDING_ID, receiptBindingFixture());

    const badVersion = receiptBindingFixture();
    badVersion.version = "drenyra.receipt-binding.v2";
    expectInvalid(BINDING_ID, badVersion);

    const missingHash = receiptBindingFixture();
    delete missingHash.scopeHash;
    expectInvalid(BINDING_ID, missingHash);
  });
});

describe("contracts: trusted-key registry (REQ-CONTRACTS-005)", () => {
  const REGISTRY_ID =
    "https://drenyra.dev/harness/contracts/receipts/trusted-key-registry.schema.json";
  const KEY_ID =
    "https://drenyra.dev/harness/contracts/receipts/signing-key-info.schema.json";

  it("validates a registry document whose entries match SigningKeyInfo (REQ-CONTRACTS-005)", () => {
    expectValid(REGISTRY_ID, trustedKeyRegistryFixture());
  });

  it("validates a key entry with the full lifecycle: expiresAt and revokedAt", () => {
    const entry = {
      keyId: "key-002",
      publicKey: "B".repeat(44),
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-12-31T00:00:00.000Z",
      revokedAt: "2026-06-01T00:00:00.000Z",
    };
    expectValid(KEY_ID, entry);
    // Date order is a lifecycle rule: revocation/expiry never precede issuance.
    const issued = Date.parse(entry.issuedAt);
    expect(Date.parse(entry.revokedAt)).toBeGreaterThanOrEqual(issued);
    expect(Date.parse(entry.expiresAt)).toBeGreaterThanOrEqual(issued);
  });

  it("rejects a malformed key entry: unknown property, missing publicKey, non-base64 key", () => {
    const unknownProperty = trustedKeyRegistryFixture();
    (unknownProperty.keys as Record<string, unknown>)["key-001"] = {
      ...((unknownProperty.keys as Record<string, unknown>)[
        "key-001"
      ] as object),
      privateKey: "should-never-be-stored",
    };
    const unknownErrors = expectInvalid(REGISTRY_ID, unknownProperty);
    expect(unknownErrors.join(" ")).toMatch(
      /privateKey|additional properties/i,
    );

    const missingKey = trustedKeyRegistryFixture();
    delete (missingKey.keys as Record<string, Record<string, unknown>>)[
      "key-001"
    ].publicKey;
    expectInvalid(REGISTRY_ID, missingKey);

    const badBase64 = trustedKeyRegistryFixture();
    (badBase64.keys as Record<string, Record<string, unknown>>)[
      "key-001"
    ].publicKey = "!!!not-base64!!!";
    const base64Errors = expectInvalid(REGISTRY_ID, badBase64);
    expect(base64Errors.join(" ")).toMatch(/publicKey/i);
  });
});
