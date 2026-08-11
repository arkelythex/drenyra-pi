/**
 * Receipt store — immutable `HarnessReceiptRecord` documents addressed by
 * receipt hash at `<workspace>/.local/receipts/<receipt-hash>.json` (design
 * §6.2). An existing identical record at the same receipt hash is an idempotent
 * replay; differing bytes at the same identity are corruption and block. The
 * store never rewrites, updates, or deletes a persisted record.
 *
 * The harness record pairs the engine `SignedReceipt` (byte-for-byte engine
 * compatible) with the harness `ReceiptBinding`; the canonical digest of the
 * binding is signed through `content.payloadHash` (design §3.3, REQ-SCOPE-008).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import type { ReceiptContent, ReceiptType, SignedReceipt } from "drenyra-ai/receipts";
import { sha256Canonical } from "./canonicalization.js";
import { parseJsonOrThrow } from "./parse.js";

/** The harness receipt binding (design §3.3) signed through the engine payloadHash. */
export interface ReceiptBinding {
  version: "drenyra.receipt-binding.v1";
  scopeHash: string;
  authorizationId: string;
  policyVersion: string;
  targetHash: string;
  evidenceHash: string;
}

/** The complete harness receipt record: binding + engine-signed receipt. */
export interface HarnessReceiptRecord {
  binding: ReceiptBinding;
  receipt: SignedReceipt;
}

const HEX64 = /^[0-9a-f]{64}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const RECEIPT_TYPES: readonly ReceiptType[] = [
  "APPROVAL",
  "EXECUTION",
  "COMPLETION",
  "EXTERNAL_SUBMISSION",
];

function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`receipt record: ${label} must be a non-empty string`);
  }
}

function assertHex64(value: unknown, label: string): void {
  if (typeof value !== "string" || !HEX64.test(value)) {
    throw new Error(`${label} must be a 64-character lowercase hex sha-256 digest`);
  }
}

function assertIsoInstant(value: unknown, label: string): void {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`receipt record: ${label} must be a valid ISO-8601 instant`);
  }
}

function assertBase64(value: unknown, label: string): void {
  if (typeof value !== "string" || !BASE64_RE.test(value)) {
    throw new Error(`receipt record: ${label} must be base64-encoded`);
  }
}

function assertBinding(binding: ReceiptBinding): void {
  if (typeof binding !== "object" || binding === null) {
    throw new Error("receipt record: binding must be an object");
  }
  const record = binding as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (
      key !== "version" &&
      key !== "scopeHash" &&
      key !== "authorizationId" &&
      key !== "policyVersion" &&
      key !== "targetHash" &&
      key !== "evidenceHash"
    ) {
      throw new Error(`receipt record: unknown binding property "${key}" is rejected`);
    }
  }
  if (binding.version !== "drenyra.receipt-binding.v1") {
    throw new Error(
      `receipt record: binding version must be "drenyra.receipt-binding.v1" (got "${String(binding.version)}")`,
    );
  }
  assertHex64(binding.scopeHash, "binding.scopeHash");
  assertNonEmptyString(binding.authorizationId, "binding.authorizationId");
  assertNonEmptyString(binding.policyVersion, "binding.policyVersion");
  assertHex64(binding.targetHash, "binding.targetHash");
  assertHex64(binding.evidenceHash, "binding.evidenceHash");
}

function assertReceiptContent(content: ReceiptContent): void {
  if (typeof content !== "object" || content === null) {
    throw new Error("receipt record: content must be an object");
  }
  const record = content as unknown as Record<string, unknown>;
  const known = new Set([
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
  ]);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      throw new Error(`receipt record: unknown content property "${key}" is rejected`);
    }
  }
  assertNonEmptyString(content.missionId, "content.missionId");
  assertNonEmptyString(content.companyId, "content.companyId");
  assertNonEmptyString(content.actorId, "content.actorId");
  if (content.decision !== "APPROVE" && content.decision !== "REJECT") {
    throw new Error(`receipt record: content.decision must be APPROVE or REJECT`);
  }
  if (typeof content.proposalVersion !== "number" || !Number.isInteger(content.proposalVersion)) {
    throw new Error("receipt record: content.proposalVersion must be a JSON integer");
  }
  if (content.proposalVersion < 0) {
    throw new Error("receipt record: content.proposalVersion must be >= 0");
  }
  assertHex64(content.evidenceHash, "content.evidenceHash");
  assertNonEmptyString(content.previousStatus, "content.previousStatus");
  assertNonEmptyString(content.newStatus, "content.newStatus");
  assertHex64(content.payloadHash, "content.payloadHash");
  assertIsoInstant(content.timestamp, "content.timestamp");
}

function assertSignedReceipt(receipt: SignedReceipt): void {
  if (typeof receipt !== "object" || receipt === null) {
    throw new Error("receipt record: receipt must be an object");
  }
  const record = receipt as unknown as Record<string, unknown>;
  const known = new Set([
    "protocolVersion",
    "receiptType",
    "algorithm",
    "content",
    "receiptHash",
    "signerKeyId",
    "signerPublicKey",
    "signature",
    "issuedAt",
  ]);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      throw new Error(`receipt record: unknown receipt property "${key}" is rejected`);
    }
  }
  if (receipt.protocolVersion !== "1.0") {
    throw new Error(`receipt record: protocolVersion must be "1.0"`);
  }
  if (!RECEIPT_TYPES.includes(receipt.receiptType)) {
    throw new Error(
      `receipt record: receiptType must be one of ${RECEIPT_TYPES.join(", ")}`,
    );
  }
  if (receipt.algorithm !== "Ed25519") {
    throw new Error(`receipt record: algorithm must be "Ed25519"`);
  }
  assertReceiptContent(receipt.content);
  assertHex64(receipt.receiptHash, "receipt.receiptHash");
  assertNonEmptyString(receipt.signerKeyId, "receipt.signerKeyId");
  assertBase64(receipt.signerPublicKey, "receipt.signerPublicKey");
  assertBase64(receipt.signature, "receipt.signature");
  assertIsoInstant(receipt.issuedAt, "receipt.issuedAt");
}

/**
 * Structural validation of a harness receipt record against the shipped receipt
 * contract shapes (schema stage of verification; design §6.2). Returns a
 * verdict instead of throwing so verification can report reasons.
 */
export function validateHarnessReceiptRecord(
  record: unknown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (typeof record !== "object" || record === null) {
      throw new Error("record must be an object with binding and receipt");
    }
    const value = record as unknown as Record<string, unknown>;
    for (const key of Object.keys(value)) {
      if (key !== "binding" && key !== "receipt") {
        throw new Error(`unknown record property "${key}" is rejected`);
      }
    }
    assertBinding(value.binding as ReceiptBinding);
    assertSignedReceipt(value.receipt as SignedReceipt);
    return { valid: true, errors };
  } catch (cause) {
    errors.push(`schema: ${(cause as Error).message}`);
    return { valid: false, errors };
  }
}

function canonicalRecordBytes(record: HarnessReceiptRecord): string {
  return sha256Canonical({
    binding: record.binding,
    receipt: record.receipt,
  });
}

function parseRecordFile(path: string): HarnessReceiptRecord {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`receipt store corrupt: ${path} is unreadable`);
  }
  const parsed = parseJsonOrThrow(
    raw,
    `receipt store corrupt: ${path} is not valid JSON — repair is explicit and never automatic`,
  );
  const validation = validateHarnessReceiptRecord(parsed);
  if (!validation.valid) {
    throw new Error(`receipt store corrupt: ${path} — ${validation.errors.join("; ")}`);
  }
  return parsed as HarnessReceiptRecord;
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
 * Immutable append-only-style receipt store (design §6.2). Records are
 * addressed by receipt hash; replay-safe and corruption-blocking.
 */
export class ReceiptStore {
  private readonly dir: string;

  constructor(root?: string) {
    this.dir = join(root ?? process.cwd(), ".local", "receipts");
  }

  private pathFor(receiptHash: string): string {
    assertHex64(receiptHash, "receipt hash");
    return join(this.dir, `${receiptHash}.json`);
  }

  /**
   * Persist one record. An identical record at the same receipt hash replays
   * idempotently; differing bytes at the same identity are corruption and block.
   */
  async save(record: HarnessReceiptRecord): Promise<void> {
    const validation = validateHarnessReceiptRecord(record);
    if (!validation.valid) {
      throw new Error(`receipt store: invalid record — ${validation.errors.join("; ")}`);
    }
    const path = this.pathFor(record.receipt.receiptHash);
    const incoming = canonicalRecordBytes(record);
    if (existsSync(path)) {
      const existing = parseRecordFile(path);
      if (canonicalRecordBytes(existing) !== incoming) {
        throw new Error(
          `receipt store corrupt: differing bytes at receipt identity ${record.receipt.receiptHash} — immutable records never change`,
        );
      }
      return; // Idempotent replay.
    }
    atomicWriteJson(path, record);
  }

  /** Load one record by receipt hash; missing records resolve to undefined. */
  async load(receiptHash: string): Promise<HarnessReceiptRecord | undefined> {
    const path = this.pathFor(receiptHash);
    if (!existsSync(path)) {
      return undefined;
    }
    return parseRecordFile(path);
  }

  /** List every persisted record, sorted by receipt hash. */
  async list(): Promise<HarnessReceiptRecord[]> {
    if (!existsSync(this.dir)) {
      return [];
    }
    const records: HarnessReceiptRecord[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(".json")) {
        continue; // Stale unique temp files from a crash are never read as data.
      }
      records.push(parseRecordFile(join(this.dir, name)));
    }
    records.sort((a, b) => a.receipt.receiptHash.localeCompare(b.receipt.receiptHash));
    return records;
  }
}
