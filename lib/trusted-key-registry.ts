/**
 * Trusted-key registry — workspace-local trusted public-key registry (design
 * §6.1). The document lives at `<workspace>/.local/trusted-keys.json`, maps
 * key ids to engine `SigningKeyInfo` entries, and is validated against the
 * `contracts/receipts/trusted-key-registry` schema family before any key is
 * trusted for receipt verification (REQ-CONTRACTS-005).
 *
 * The map key MUST equal each entry's `keyId`; unknown properties, malformed
 * keys (non-base64 or non-32-byte public keys), duplicate semantic ids, and
 * invalid lifecycle date order fail validation. Lifecycle states that are
 * merely expired or revoked by the clock remain representable and are blocked
 * at verification time (KEY_EXPIRED / KEY_REVOKED). Private keys are never
 * stored in this registry.
 *
 * The registry is read fresh for each protected verification so revocation
 * takes effect immediately (design §6.1). Writes are atomic (unique temp file
 * -> fsync -> rename -> parent-directory fsync). Symlinks and paths that
 * resolve outside the workspace root are rejected (design §15).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { SigningKeyInfo } from "drenyra-ai/receipts";
import { parseJsonOrThrow } from "./parse.js";

/** The workspace-local trusted-key registry document (design §6.1). */
export interface TrustedKeyRegistryDocument {
  schemaVersion: 1;
  keys: Record<string, SigningKeyInfo>;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;
/** DER SPKI (SubjectPublicKeyInfo) prefix for Ed25519 public keys. */
const ED25519_SPKI_PREFIX = "302a300506032b6570032100";

function assertIsoInstant(value: unknown, label: string): number {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a canonical ISO-8601 instant`);
  }
  return Date.parse(value);
}

function assertValidKeyInfo(info: SigningKeyInfo, label = "key"): void {
  if (typeof info !== "object" || info === null) {
    throw new Error(`${label}: must be an object`);
  }
  const record = info as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (
      key !== "keyId" &&
      key !== "publicKey" &&
      key !== "issuedAt" &&
      key !== "expiresAt" &&
      key !== "revokedAt"
    ) {
      throw new Error(
        `${label}: unknown property "${key}" is rejected (private keys are never stored)`,
      );
    }
  }
  if (typeof info.keyId !== "string" || info.keyId.trim().length === 0) {
    throw new Error(`${label}: keyId must be a non-empty string`);
  }
  if (typeof info.publicKey !== "string" || !BASE64_RE.test(info.publicKey)) {
    throw new Error(`${label}: publicKey must be base64-encoded Ed25519 material`);
  }
      const decoded = Buffer.from(info.publicKey, "base64");
      if (
        decoded.length !== 44 ||
        decoded.subarray(0, 12).toString("hex") !== ED25519_SPKI_PREFIX
      ) {
        throw new Error(
          `${label}: publicKey must decode to a 44-byte DER SPKI Ed25519 public key (engine format)`,
        );
      }
  const issued = assertIsoInstant(info.issuedAt, `${label}.issuedAt`);
  if (info.expiresAt !== undefined) {
    const expires = assertIsoInstant(info.expiresAt, `${label}.expiresAt`);
    if (expires < issued) {
      throw new Error(`${label}: expiresAt must not be earlier than issuedAt`);
    }
  }
  if (info.revokedAt !== undefined) {
    const revoked = assertIsoInstant(info.revokedAt, `${label}.revokedAt`);
    if (revoked < issued) {
      throw new Error(`${label}: revokedAt must not be earlier than issuedAt`);
    }
  }
}

function assertValidDocument(document: TrustedKeyRegistryDocument): void {
  if (typeof document !== "object" || document === null) {
    throw new Error("trusted-key registry corrupt: document must be an object");
  }
  const record = document as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "schemaVersion" && key !== "keys") {
      throw new Error(`trusted-key registry corrupt: unknown property "${key}" is rejected`);
    }
  }
  if (document.schemaVersion !== 1) {
    throw new Error(
      `trusted-key registry corrupt: unsupported schemaVersion ${String(document.schemaVersion)} — migration is explicit and never automatic`,
    );
  }
  if (typeof document.keys !== "object" || document.keys === null || Array.isArray(document.keys)) {
    throw new Error("trusted-key registry corrupt: keys must be an object map");
  }
  const seen = new Set<string>();
  for (const [mapKey, entry] of Object.entries(document.keys)) {
    assertValidKeyInfo(entry, `key "${mapKey}"`);
    if (seen.has(entry.keyId)) {
      throw new Error(
        `trusted-key registry corrupt: duplicate semantic keyId "${entry.keyId}" across map entries`,
      );
    }
    seen.add(entry.keyId);
  }
  for (const [mapKey, entry] of Object.entries(document.keys)) {
    if (entry.keyId !== mapKey) {
      throw new Error(
        `trusted-key registry corrupt: map key "${mapKey}" must equal the entry keyId "${entry.keyId}"`,
      );
    }
  }
}

/** Reject symlinked path components from the deepest existing ancestor down. */
function assertNoSymlinkComponents(target: string): void {
  let current = resolve(target);
  const stack: string[] = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    stack.unshift(basename(current));
    current = parent;
  }
  if (isSymlink(current)) {
    throw new Error(`trusted-key registry: symlinked path component rejected: ${current}`);
  }
  for (const part of stack) {
    current = join(current, part);
    if (isSymlink(current)) {
      throw new Error(`trusted-key registry: symlinked path component rejected: ${current}`);
    }
  }
}

function isSymlink(path: string): boolean {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return false; // Missing components are checked once they exist.
  }
  return stat.isSymbolicLink();
}

/** Atomic write: unique temp file -> write -> fsync -> rename -> dir fsync. */
function atomicWriteJson(targetPath: string, payload: unknown): void {
  mkdirSync(dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, `${JSON.stringify(payload, null, 2)}\n`, null, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, targetPath);
  const dirFd = openSync(dirname(targetPath), "r");
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
}

/**
 * Workspace-local trusted public-key registry (design §6.1/§6.2). The default
 * file path is `<cwd>/.local/trusted-keys.json`; an explicit path and an
 * optional workspace root scope the containment check.
 */
export class TrustedKeyRegistry {
  private readonly filePath: string;
  private readonly workspaceRoot: string;

  constructor(filePath?: string, workspaceRoot?: string) {
    const configured = filePath ?? join(process.cwd(), ".local", "trusted-keys.json");
    this.filePath = resolve(configured);
    // The default layout (<workspace>/.local/trusted-keys.json) makes the .local
    // parent the workspace root; explicit custom paths scope to their own directory.
    this.workspaceRoot =
      workspaceRoot !== undefined
        ? resolve(workspaceRoot)
        : basename(dirname(this.filePath)) === ".local" && basename(this.filePath) === "trusted-keys.json"
          ? dirname(dirname(this.filePath))
          : dirname(this.filePath);
  }

  /** Load the registry document; a missing file is an empty registry. */
  async load(): Promise<TrustedKeyRegistryDocument> {
    this.assertPathSafe();
    if (!existsSync(this.filePath)) {
      return { schemaVersion: 1, keys: {} };
    }
    let raw: string;
    try {
      raw = readFileSync(this.filePath, "utf8");
    } catch {
      throw new Error(`trusted-key registry corrupt: ${this.filePath} is unreadable`);
    }
    const parsed = parseJsonOrThrow(
      raw,
      `trusted-key registry corrupt: ${this.filePath} is not valid JSON — repair is explicit and never automatic`,
    );
    assertValidDocument(parsed as TrustedKeyRegistryDocument);
    return parsed as TrustedKeyRegistryDocument;
  }

  /**
   * Resolve a trusted key by id with a FRESH read of the registry file, so
   * revocation and expiry take effect immediately (design §6.1). An unknown
   * key id resolves to undefined and blocks verification (UNKNOWN_SIGNER).
   */
  async resolve(keyId: string): Promise<SigningKeyInfo | undefined> {
    if (typeof keyId !== "string" || keyId.length === 0) {
      return undefined;
    }
    const document = await this.load();
    return document.keys[keyId];
  }

  /**
   * Put a trusted key entry. Lifecycle metadata (expiresAt/revokedAt) may be
   * updated for an existing keyId (revocation must take effect immediately);
   * the public key bound to a keyId is immutable once registered.
   */
  async put(info: SigningKeyInfo): Promise<void> {
    assertValidKeyInfo(info);
    this.assertPathSafe();
    const document = await this.load();
    const existing = document.keys[info.keyId];
    if (existing !== undefined && existing.publicKey !== info.publicKey) {
      throw new Error(
        `trusted-key registry: keyId "${info.keyId}" is already registered with a different public key`,
      );
    }
    const next: TrustedKeyRegistryDocument = {
      schemaVersion: 1,
      keys: { ...document.keys, [info.keyId]: info },
    };
    assertValidDocument(next);
    atomicWriteJson(this.filePath, next);
  }

  /** Fail-closed path safety (design §15): no escape and no symlink components. */
  private assertPathSafe(): void {
    const root = this.workspaceRoot;
    const resolved = resolve(this.filePath);
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      throw new Error(
        `trusted-key registry: path ${resolved} resolves outside the workspace root ${root}`,
      );
    }
    assertNoSymlinkComponents(resolved);
  }
}
