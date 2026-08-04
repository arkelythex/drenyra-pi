/**
 * Trusted-key registry — RED/GREEN tests for T-S3B-003 (workspace-local trusted
 * public-key registry; design §6.1). Entries validate against the engine
 * `SigningKeyInfo` shape (REQ-CONTRACTS-005) before a key is trusted for
 * receipt verification; the registry is read fresh for every protected
 * verification so revocation takes effect immediately; atomic writes and path
 * safety follow design §15.
 *
 * Lifecycle interpretation (documented in apply-progress): entries whose
 * lifecycle metadata is self-inconsistent (invalid date order) or malformed
 * fail validation; entries that are merely expired or revoked by the clock are
 * representable in the registry and are blocked at verification time
 * (KEY_EXPIRED / KEY_REVOKED).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateReceiptKeyPair, type SigningKeyInfo } from "drenyra-ai/receipts";
import { TrustedKeyRegistry, type TrustedKeyRegistryDocument } from "../lib/trusted-key-registry.js";

const ISSUED = "2026-01-01T00:00:00.000Z";
const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-keys-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function defaultKeyPath(root: string): string {
  return join(root, ".local", "trusted-keys.json");
}

/** A current, non-expired, non-revoked signing key backed by a real Ed25519 pair. */
function makeKeyInfo(overrides: Partial<SigningKeyInfo> = {}): SigningKeyInfo {
  const pair = generateReceiptKeyPair(`key-${Math.random().toString(36).slice(2, 10)}`);
  return {
    keyId: pair.keyId,
    publicKey: pair.publicKey,
    issuedAt: ISSUED,
    ...overrides,
  };
}

describe("TrustedKeyRegistry (design §6.1)", () => {
  it("persists at <workspace>/.local/trusted-keys.json and resolves by keyId", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    await registry.put(key);

    expect(existsSync(defaultKeyPath(root))).toBe(true);
    expect((await registry.resolve(key.keyId))?.publicKey).toBe(key.publicKey);

    const raw = JSON.parse(readFileSync(defaultKeyPath(root), "utf8")) as TrustedKeyRegistryDocument;
    expect(raw.schemaVersion).toBe(1);
    expect(raw.keys[key.keyId]).toEqual(key);
  });

  it("load() returns an empty document when the registry file is absent", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const doc = await registry.load();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.keys).toEqual({});
  });

  it("resolve() returns undefined for an unknown key id (fail closed)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    expect(await registry.resolve("no-such-key")).toBeUndefined();
  });

  it("rejects unknown properties in the registry document", async () => {
    const root = tempRoot();
    mkdirSync(join(root, ".local"), { recursive: true });
    writeFileSync(
      defaultKeyPath(root),
      JSON.stringify({ schemaVersion: 1, keys: {}, extra: "nope" }),
    );
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(registry.load()).rejects.toThrow(/unknown|property/i);
  });

  it("rejects unknown properties on a key entry (private keys are never stored)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo() as SigningKeyInfo & { privateKey?: string };
    key.privateKey = "c2VjcmV0"; // a private key must never be stored
    await expect(registry.put(key)).rejects.toThrow(/unknown|property/i);
  });

  it("rejects a malformed public key (non-base64)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(registry.put(makeKeyInfo({ publicKey: "!!!not-base64" }))).rejects.toThrow(
      /public/i,
    );
  });

  it("rejects a public key that does not decode to an Ed25519 SPKI key", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(registry.put(makeKeyInfo({ publicKey: "AAAA" }))).rejects.toThrow(/44 byte|SPKI/i);
  });

  it("rejects a duplicate semantic key id with different bytes", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    await registry.put(key);
    await expect(
      registry.put({ ...key, publicKey: generateReceiptKeyPair("other").publicKey }),
    ).rejects.toThrow(/public key/i);
  });

  it("re-putting the identical key is idempotent", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    await registry.put(key);
    await registry.put(key);
    const doc = await registry.load();
    expect(Object.keys(doc.keys)).toHaveLength(1);
  });

  it("allows lifecycle updates (revocation) through put()", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    await registry.put(key);
    await registry.put({ ...key, revokedAt: "2026-06-01T00:00:00.000Z" });
    expect((await registry.resolve(key.keyId))?.revokedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("rejects an invalid date order (expiresAt before issuedAt)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(
      registry.put(makeKeyInfo({ expiresAt: "2025-01-01T00:00:00.000Z" })),
    ).rejects.toThrow(/expiresAt|date order/i);
  });

  it("rejects an invalid date order (revokedAt before issuedAt)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(
      registry.put(makeKeyInfo({ revokedAt: "2025-01-01T00:00:00.000Z" })),
    ).rejects.toThrow(/revokedAt|date order/i);
  });

  it("rejects non-ISO lifecycle dates", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(registry.put(makeKeyInfo({ expiresAt: "not-a-date" }))).rejects.toThrow(
      /ISO|instant/i,
    );
    await expect(registry.put(makeKeyInfo({ issuedAt: "not-a-date" }))).rejects.toThrow(
      /ISO|instant/i,
    );
  });

  it("represents expired and revoked keys (blocked later at verification)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const expired = makeKeyInfo({
      issuedAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:00:00.000Z",
    });
    const revoked = makeKeyInfo({ revokedAt: "2026-01-02T00:00:00.000Z" });
    await registry.put(expired);
    await registry.put(revoked);
    expect((await registry.resolve(expired.keyId))?.expiresAt).toBe(expired.expiresAt);
    expect((await registry.resolve(revoked.keyId))?.revokedAt).toBe(revoked.revokedAt);
  });

  it("rejects a document whose map key differs from the entry keyId", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    mkdirSync(join(root, ".local"), { recursive: true });
    writeFileSync(
      defaultKeyPath(root),
      JSON.stringify({ schemaVersion: 1, keys: { "wrong-map-key": key } }),
    );
    await expect(registry.load()).rejects.toThrow(/keyId|map key/i);
  });

  it("rejects a document with duplicate semantic key ids across map entries", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    const other = makeKeyInfo();
    mkdirSync(join(root, ".local"), { recursive: true });
    writeFileSync(
      defaultKeyPath(root),
      JSON.stringify({
        schemaVersion: 1,
        keys: { [key.keyId]: key, [other.keyId]: { ...key, keyId: key.keyId } },
      }),
    );
    await expect(registry.load()).rejects.toThrow(/keyId|duplicate|map key/i);
  });

  it("is read fresh for each resolve so revocation takes effect immediately (design §6.1)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    const key = makeKeyInfo();
    await registry.put(key);
    expect((await registry.resolve(key.keyId))?.revokedAt).toBeUndefined();

    // Simulate an external operator rewriting the registry file.
    const revoked = { ...key, revokedAt: "2026-06-01T00:00:00.000Z" };
    writeFileSync(defaultKeyPath(root), `${JSON.stringify({ schemaVersion: 1, keys: { [key.keyId]: revoked } }, null, 2)}\n`);

    expect((await registry.resolve(key.keyId))?.revokedAt).toBe(revoked.revokedAt);
  });

  it("writes atomically and leaves no stray temp files (design §6.1)", async () => {
    const root = tempRoot();
    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await registry.put(makeKeyInfo());
    await registry.put(makeKeyInfo());
    const leftovers = readdirSync(join(root, ".local")).filter((name) => name.includes(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("rejects a symlinked registry path (design §15)", async () => {
    const root = tempRoot();
    const outside = join(root, "outside-keys.json");
    writeFileSync(outside, JSON.stringify({ schemaVersion: 1, keys: {} }));
    mkdirSync(join(root, ".local"), { recursive: true });
    symlinkSync(outside, defaultKeyPath(root));

    const registry = new TrustedKeyRegistry(defaultKeyPath(root), root);
    await expect(registry.put(makeKeyInfo())).rejects.toThrow(/symlink/i);
    await expect(registry.load()).rejects.toThrow(/symlink/i);
  });

  it("rejects a path that resolves outside the workspace root (design §15)", async () => {
    const root = tempRoot();
    const parent = join(root, "..");
    const registry = new TrustedKeyRegistry(join(parent, "escaped-keys.json"), root);
    await expect(registry.put(makeKeyInfo())).rejects.toThrow(/outside|escape/i);
  });
});
