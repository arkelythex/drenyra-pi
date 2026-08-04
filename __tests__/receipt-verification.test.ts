/**
 * Receipt store + trusted verification — RED/GREEN tests for T-S3B-004
 * (immutable `.local/receipts/` store and `verifyHarnessReceipt`; design
 * §6.2/§3.3). Verification order: schema → engine content hash → Ed25519
 * signature → registry lookup and key match → key lifecycle → binding digest →
 * scope/mission/actor/policy/evidence/target expectations. No path ever falls
 * back to the public key embedded in the receipt (design §15).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSignedReceipt,
  generateReceiptKeyPair,
  type ReceiptContent,
  type SigningKeyInfo,
} from "drenyra-ai/receipts";
import { sha256Canonical, type ScopeBinding } from "../lib/canonicalization.js";
import { ReceiptStore, type HarnessReceiptRecord, type ReceiptBinding } from "../lib/receipt-store.js";
import { TrustedKeyRegistry } from "../lib/trusted-key-registry.js";
import { verifyHarnessReceipt } from "../lib/receipt-verification.js";
import { makeScopeBinding } from "./helpers/authority-fixtures.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-receipts-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function keyPath(root: string): string {
  return join(root, ".local", "trusted-keys.json");
}

function makeBinding(overrides: Partial<ReceiptBinding> = {}): ReceiptBinding {
  return {
    version: "drenyra.receipt-binding.v1",
    scopeHash: makeScopeBinding().scopeHash,
    authorizationId: "auth-001",
    policyVersion: "policies.v1",
    targetHash: "d".repeat(64),
    evidenceHash: "e".repeat(64),
    ...overrides,
  };
}

function makeContent(binding: ReceiptBinding, overrides: Partial<ReceiptContent> = {}): ReceiptContent {
  return {
    missionId: "mission-close-001",
    companyId: makeScopeBinding().scope.company,
    actorId: "alice",
    decision: "APPROVE",
    proposalVersion: 1,
    evidenceHash: binding.evidenceHash,
    previousStatus: "AWAITING_APPROVAL",
    newStatus: "APPROVED",
    payloadHash: sha256Canonical(binding),
    timestamp: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

interface HarnessFixture {
  record: HarnessReceiptRecord;
  key: SigningKeyInfo;
  binding: ReceiptBinding;
}

/** A valid harness receipt: binding digest signed through the engine payloadHash. */
function makeHarnessReceipt(
  bindingOverrides: Partial<ReceiptBinding> = {},
  contentOverrides: Partial<ReceiptContent> = {},
  keyId = "trusted-signer-001",
): HarnessFixture {
  const binding = makeBinding(bindingOverrides);
  const keyPair = generateReceiptKeyPair(keyId);
  const receipt = buildSignedReceipt(makeContent(binding, contentOverrides), keyPair);
  const key: SigningKeyInfo = {
    keyId: keyPair.keyId,
    publicKey: keyPair.publicKey,
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  return { record: { binding, receipt }, key, binding };
}

function makeRegistry(root: string): TrustedKeyRegistry {
  return new TrustedKeyRegistry(keyPath(root), root);
}

const EXPECTED = {
  scope: makeScopeBinding(),
  missionId: "mission-close-001",
  actorId: "alice",
  policyVersion: "policies.v1",
  targetHash: "d".repeat(64),
};

async function putAndVerify(
  registry: TrustedKeyRegistry,
  fixture: HarnessFixture,
  input: Partial<{
    scope: ScopeBinding;
    missionId: string;
    actorId: string;
    policyVersion: string;
    targetHash: string;
  }> = {},
) {
  await registry.put(fixture.key);
  return verifyHarnessReceipt(
    {
      record: fixture.record,
      expectedScope: input.scope ?? EXPECTED.scope,
      expectedMissionId: input.missionId ?? EXPECTED.missionId,
      expectedActorId: input.actorId ?? EXPECTED.actorId,
      expectedPolicyVersion: input.policyVersion ?? EXPECTED.policyVersion,
      expectedTargetHash: input.targetHash ?? EXPECTED.targetHash,
    },
    registry,
  );
}

describe("T-S3B-004 verifyHarnessReceipt (design §6.2)", () => {
  it("passes a valid receipt with a current trusted key (full matrix)", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const result = await putAndVerify(registry, fixture);

    expect(result.valid).toBe(true);
    expect(result.engineStatus).toBe("SIGNER_TRUSTED");
    expect(result.bindingValid).toBe(true);
    expect(result.scopeValid).toBe(true);
    expect(result.targetValid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects tampered content with PAYLOAD_TAMPERED", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put(fixture.key);
    // Tamper the signed content AFTER signing: the receipt hash no longer matches.
    const tampered = {
      ...fixture.record,
      receipt: {
        ...fixture.record.receipt,
        content: { ...fixture.record.receipt.content, timestamp: "2026-07-02T00:00:00.000Z" },
      },
    };
    const result = await verifyHarnessReceipt(
      {
        record: tampered,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("PAYLOAD_TAMPERED");
    expect(result.reasons.join("; ")).toMatch(/content|tamper/i);
  });

  it("rejects a tampered binding (binding digest mismatch)", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put(fixture.key);
    const tampered = { ...fixture.record, binding: { ...fixture.binding, targetHash: "f".repeat(64) } };
    const result = await verifyHarnessReceipt(
      {
        record: tampered,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
        expectedTargetHash: EXPECTED.targetHash,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.bindingValid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/binding/i);
  });

  it("rejects a wrong scope (scope hash mismatch)", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const wrongScope = makeScopeBinding({ fiscalPeriod: "202608" });
    const result = await putAndVerify(registry, fixture, { scope: wrongScope });
    expect(result.valid).toBe(false);
    expect(result.scopeValid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/scope/i);
  });

  it("rejects a wrong mission id", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const result = await putAndVerify(registry, fixture, { missionId: "mission-other" });
    expect(result.valid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/mission/i);
  });

  it("rejects a wrong actor id", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const result = await putAndVerify(registry, fixture, { actorId: "mallory" });
    expect(result.valid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/actor/i);
  });

  it("rejects a wrong policy version", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const result = await putAndVerify(registry, fixture, { policyVersion: "policies.v9" });
    expect(result.valid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/policy/i);
  });

  it("rejects a wrong target hash", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    const result = await putAndVerify(registry, fixture, { targetHash: "f".repeat(64) });
    expect(result.valid).toBe(false);
    expect(result.targetValid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/target/i);
  });

  it("rejects an unknown signer with UNKNOWN_SIGNER", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt({}, {}, "not-in-registry-001");
    const registry = makeRegistry(root);
    // The registry trusts a different key; the receipt signer is unknown.
    const otherPair = generateReceiptKeyPair("trusted-other-001");
    await registry.put({
      keyId: otherPair.keyId,
      publicKey: otherPair.publicKey,
      issuedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("UNKNOWN_SIGNER");
    expect(result.reasons.join("; ")).toMatch(/signer/i);
  });

      it("blocks when the registry is empty (no keys -> UNKNOWN_SIGNER)", async () => {
        const root = tempRoot();
        const fixture = makeHarnessReceipt();
        const registry = new TrustedKeyRegistry(keyPath(root), root);
        const result = await verifyHarnessReceipt(
          {
            record: fixture.record,
            expectedScope: EXPECTED.scope,
            expectedMissionId: EXPECTED.missionId,
          },
          registry,
        );
        expect(result.valid).toBe(false);
        expect(result.engineStatus).toBe("UNKNOWN_SIGNER");
      });

  it("rejects an embedded-key-only receipt (no embedded-key fallback; design §15)", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt({}, {}, "embedded-only-001");
    const registry = new TrustedKeyRegistry(keyPath(root), root);
    // The registry holds a DIFFERENT key id that happens to carry the same public
    // key — the embedded public key must never be trusted by itself.
    await registry.put({
      keyId: "other-key-id",
      publicKey: fixture.key.publicKey,
      issuedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("UNKNOWN_SIGNER");
  });

  it("rejects a signer whose registered public key does not match the receipt", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt({}, {}, "mismatch-001");
    const registry = makeRegistry(root);
    // Same key id but a different public key in the registry.
    await registry.put({ ...fixture.key, publicKey: generateReceiptKeyPair("other").publicKey });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("UNKNOWN_SIGNER");
  });

  it("rejects an expired key with KEY_EXPIRED", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put({
      ...fixture.key,
      issuedAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("KEY_EXPIRED");
  });

  it("rejects a revoked key with KEY_REVOKED", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put({ ...fixture.key, revokedAt: "2026-01-02T00:00:00.000Z" });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("KEY_REVOKED");
  });

  it("rejects a schema-invalid record before any engine stage", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put(fixture.key);
    const malformed = {
      binding: fixture.binding,
      receipt: { ...fixture.record.receipt, receiptHash: "not-a-hash" },
    } as unknown as HarnessReceiptRecord;
    const result = await verifyHarnessReceipt(
      {
        record: malformed,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.reasons.join("; ")).toMatch(/schema/i);
  });

  it("revocation takes effect without recreating the registry (fresh read)", async () => {
    const root = tempRoot();
    const fixture = makeHarnessReceipt();
    const registry = makeRegistry(root);
    await registry.put(fixture.key);
    expect((await putAndVerify(registry, fixture)).valid).toBe(true);

    await registry.put({ ...fixture.key, revokedAt: "2026-01-02T00:00:00.000Z" });
    const result = await verifyHarnessReceipt(
      {
        record: fixture.record,
        expectedScope: EXPECTED.scope,
        expectedMissionId: EXPECTED.missionId,
      },
      registry,
    );
    expect(result.valid).toBe(false);
    expect(result.engineStatus).toBe("KEY_REVOKED");
  });
});

describe("T-S3B-004 ReceiptStore (immutable .local/receipts/)", () => {
  it("saves a record at .local/receipts/<receipt-hash>.json and loads it back", async () => {
    const root = tempRoot();
    const store = new ReceiptStore(root);
    const fixture = makeHarnessReceipt();
    await store.save(fixture.record);

    const path = join(root, ".local", "receipts", `${fixture.record.receipt.receiptHash}.json`);
    expect(existsSync(path)).toBe(true);
    const loaded = await store.load(fixture.record.receipt.receiptHash);
    expect(loaded).toEqual(fixture.record);
  });

  it("returns undefined for an unknown receipt hash", async () => {
    const store = new ReceiptStore(tempRoot());
    expect(await store.load("a".repeat(64))).toBeUndefined();
  });

  it("replays an identical record idempotently (same identity, same bytes)", async () => {
    const root = tempRoot();
    const store = new ReceiptStore(root);
    const fixture = makeHarnessReceipt();
    await store.save(fixture.record);
    await store.save(fixture.record);
    const path = join(root, ".local", "receipts", `${fixture.record.receipt.receiptHash}.json`);
    const raw = readFileSync(path, "utf8");
    expect(JSON.parse(raw)).toEqual(fixture.record);
  });

  it("blocks differing bytes at the same receipt identity as corruption", async () => {
    const root = tempRoot();
    const store = new ReceiptStore(root);
    const fixture = makeHarnessReceipt();
    await store.save(fixture.record);

    // Same content identity (same receiptHash) but signed by a different key:
    // identical content, different signature bytes.
    const otherKey = generateReceiptKeyPair("other-signer");
    const rebuilt = buildSignedReceipt(fixture.record.receipt.content, otherKey);
    await expect(
      store.save({ binding: fixture.record.binding, receipt: rebuilt }),
    ).rejects.toThrow(/corrupt|differ/i);
  });

  it("lists stored records", async () => {
    const root = tempRoot();
    const store = new ReceiptStore(root);
    const a = makeHarnessReceipt({}, {}, "signer-a");
    const b = makeHarnessReceipt({ evidenceHash: "f".repeat(64) }, {}, "signer-b");
    await store.save(a.record);
    await store.save(b.record);
    const all = await store.list();
    expect(all).toHaveLength(2);
    expect(all.map((record: HarnessReceiptRecord) => record.receipt.receiptHash).sort()).toEqual(
      [a.record.receipt.receiptHash, b.record.receipt.receiptHash].sort(),
    );
  });

  it("fails closed on a corrupt stored record", async () => {
    const root = tempRoot();
    const store = new ReceiptStore(root);
    const fixture = makeHarnessReceipt();
    await store.save(fixture.record);
    const path = join(root, ".local", "receipts", `${fixture.record.receipt.receiptHash}.json`);
    writeFileSync(path, "not valid json {");
    await expect(store.load(fixture.record.receipt.receiptHash)).rejects.toThrow(
      /corrupt|repair/i,
    );
    await expect(store.list()).rejects.toThrow(/corrupt|repair/i);
  });

  it("rejects a receipt hash that could traverse paths (design §15)", async () => {
    const store = new ReceiptStore(tempRoot());
    await expect(store.load("../escape")).rejects.toThrow(/hex|hash/i);
    await expect(store.load("A".repeat(64))).rejects.toThrow(/hex|hash/i);
  });
});
