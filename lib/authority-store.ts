/**
 * Authority store — append-only authorization records bound to an exact scope
 * hash, actor, action family, and mission identity (REQ-AUTH-003;
 * REQ-SCOPE-006/008; design §5.4).
 *
 * Records live at `<workspace>/.local/authority/<mission-id>.ndjson`. Each
 * append validates the record, rejects conflicting replays (identical
 * canonical bytes replay idempotently), and syncs the file before success.
 * Changing any scope element changes the scope hash, so prior authorizations
 * become immutable history and are never returned by `findBoundAuthorization`
 * for the new scope. Store identifiers are validated so they can never become
 * raw paths; a malformed or truncated log fails closed instead of silently
 * rewriting history.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt
 * cents; no float is ever used for money. Digests are lowercase hex sha-256;
 * version/sequence numbers are JSON integers.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { ACTION_FAMILY, type ActionFamily, type AuthorizationRecord } from "./authority-gates.js";
import { AUTHORITY_MODE } from "../runtime/context.js";
import { sha256Canonical } from "./canonicalization.js";

const SAFE_IDENTIFIER_RE = /^[A-Za-z0-9._-]{1,128}$/;
const SCOPE_HASH_RE = /^[0-9a-f]{64}$/;

/**
 * Conservative store-identifier validation (design §15): 1–128 characters of
 * letters, digits, `.`, `_`, `-`, with no path separators and no dot-dot.
 * Identifiers validated here can never become raw paths.
 */
export function isSafeStoreIdentifier(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    return false;
  }
  if (!SAFE_IDENTIFIER_RE.test(value)) {
    return false;
  }
  if (value === "." || value === ".." || value.includes("..")) {
    return false;
  }
  return true;
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!isSafeStoreIdentifier(value)) {
    throw new Error(
      `${label} "${value}" is not a safe store identifier (letters, digits, '.', '_', '-' only; no path separators, no '..')`,
    );
  }
}

function assertScopeHash(scopeHash: string): void {
  if (!SCOPE_HASH_RE.test(scopeHash)) {
    throw new Error(`scope hash "${scopeHash}" must be a 64-character lowercase hex sha-256 digest`);
  }
}

/** Drop undefined optional fields so canonical bytes are stable and JSON-safe. */
function stripUndefined(record: AuthorizationRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/** Deterministic canonical bytes for replay comparison. */
function canonicalRecordBytes(record: AuthorizationRecord): string {
  return sha256Canonical(stripUndefined(record));
}

function serializeRecord(record: AuthorizationRecord): string {
  return JSON.stringify(stripUndefined(record));
}

function assertValidRecord(record: AuthorizationRecord): void {
  assertSafeIdentifier(record.id, "authorization id");
  assertSafeIdentifier(record.missionId, "mission id");
  assertScopeHash(record.scopeHash);
  if (!Object.values(AUTHORITY_MODE).includes(record.authorityMode)) {
    throw new Error(
      `authority mode "${record.authorityMode}" must be one of ${Object.values(AUTHORITY_MODE).join(", ")}`,
    );
  }
  if (!Object.values(ACTION_FAMILY).includes(record.actionFamily)) {
    throw new Error(
      `action family "${record.actionFamily}" must be one of ${Object.values(ACTION_FAMILY).join(", ")}`,
    );
  }
  if (record.decision !== "GRANTED" && record.decision !== "DENIED") {
    throw new Error(`decision "${record.decision}" must be GRANTED or DENIED`);
  }
  if (typeof record.actorId !== "string" || record.actorId.trim().length === 0) {
    throw new Error("actor id must be a non-empty string");
  }
  const issued = Date.parse(record.issuedAt);
  if (Number.isNaN(issued)) {
    throw new Error(`issuedAt "${record.issuedAt}" is not a valid ISO instant`);
  }
  if (record.expiresAt !== undefined) {
    const expires = Date.parse(record.expiresAt);
    if (Number.isNaN(expires)) {
      throw new Error(`expiresAt "${record.expiresAt}" is not a valid ISO instant`);
    }
    if (expires < issued) {
      throw new Error("expiresAt must not be earlier than issuedAt");
    }
  }
}

/** Thrown when a replay would rewrite an existing record's canonical bytes. */
export class AuthorityReplayConflict extends Error {
  constructor(recordId: string) {
    super(
      `authorization replay conflict: record "${recordId}" already exists with different bytes — history is append-only`,
    );
    this.name = "AuthorityReplayConflict";
  }
}

/**
 * File-backed append-only authorization store (design §5.4). `root` is the
 * workspace root; records are written to `.local/authority/<mission-id>.ndjson`.
 */
export class AuthorityStore {
  constructor(private readonly root: string) {}

  private logPath(missionId: string): string {
    assertSafeIdentifier(missionId, "mission id");
    const path = resolve(join(this.root, ".local", "authority", `${missionId}.ndjson`));
    const rootPrefix = `${resolve(this.root)}${sep}`;
    if (!path.startsWith(rootPrefix)) {
      throw new Error("authority store path escapes the workspace root");
    }
    return path;
  }

  private async readRecords(missionId: string): Promise<AuthorizationRecord[]> {
    const path = this.logPath(missionId);
    if (!existsSync(path)) {
      return [];
    }
    const raw = readFileSync(path, "utf8");
    const records: AuthorizationRecord[] = [];
    const lines = raw.split("\n");
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch {
        throw new Error(
          `authority log corrupt: ${path} contains a malformed line — repair is explicit and never automatic`,
        );
      }
      const record = parsed as AuthorizationRecord;
      if (
        typeof record !== "object" ||
        record === null ||
        typeof record.id !== "string" ||
        typeof record.missionId !== "string" ||
        typeof record.scopeHash !== "string"
      ) {
        throw new Error(
          `authority log corrupt: ${path} contains a truncated or non-record line — repair is explicit and never automatic`,
        );
      }
      records.push(record);
    }
    return records;
  }

  /**
   * Append one authorization record. An identical canonical record replays
   * idempotently; a conflicting record at the same id blocks. The file is
   * synced before the append reports success.
   */
  async appendAuthorization(record: AuthorizationRecord): Promise<void> {
    assertValidRecord(record);
    const path = this.logPath(record.missionId);
    const existing = await this.readRecords(record.missionId);
    const bytes = canonicalRecordBytes(record);
    for (const prior of existing) {
      if (prior.id === record.id) {
        if (canonicalRecordBytes(prior) === bytes) {
          return; // Idempotent replay.
        }
        throw new AuthorityReplayConflict(record.id);
      }
    }

    mkdirSync(dirname(path), { recursive: true });
    const fd = openSync(path, "a");
    try {
      writeSync(fd, `${serializeRecord(record)}\n`, null, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }

  /** List every record for a mission in append order (immutable history). */
  async listAuthorizations(missionId: string): Promise<AuthorizationRecord[]> {
    return this.readRecords(missionId);
  }

  /**
   * Find the most recent GRANTED authorization bound to the exact scope hash,
   * actor, action family, and mission identity. Any scope element change
   * yields a different scope hash, so prior decisions are never returned for
   * the new scope (REQ-SCOPE-006; SC-SCOPE-005).
   */
  async findBoundAuthorization(input: {
    missionId: string;
    scopeHash: string;
    actionFamily: ActionFamily;
    actorId: string;
  }): Promise<AuthorizationRecord | undefined> {
    assertSafeIdentifier(input.missionId, "mission id");
    assertScopeHash(input.scopeHash);
    if (!Object.values(ACTION_FAMILY).includes(input.actionFamily)) {
      throw new Error(`action family "${input.actionFamily}" is not a known family`);
    }
    if (typeof input.actorId !== "string" || input.actorId.trim().length === 0) {
      throw new Error("actor id must be a non-empty string");
    }
    const records = await this.readRecords(input.missionId);
    let match: AuthorizationRecord | undefined;
    for (const record of records) {
      if (
        record.decision === "GRANTED" &&
        record.scopeHash === input.scopeHash &&
        record.actionFamily === input.actionFamily &&
        record.actorId === input.actorId
      ) {
        match = record;
      }
    }
    return match;
  }
}
