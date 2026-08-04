/**
 * Durable mission adapters — file-backed implementations of the pinned
 * drenyra-ai mission persistence ports (design §8). The harness never
 * deep-imports the unexported `MissionFileStore`; these adapters implement the
 * public `MissionStore`, `MissionEventStore`, and `IdempotencyStore` ports over
 * workspace-local files (REQ-MISS-006).
 *
 * Layout (design §8.1):
 *
 * ```text
 * .local/missions/
 *   snapshots/<mission-id>.json
 *   events/<mission-id>.ndjson
 *   idempotency/<sha256-of-key>.json
 *   recovery/<mission-id>.json
 * ```
 *
 * Snapshot and idempotency writes are atomic (unique temp file -> write ->
 * fsync -> rename -> directory fsync); a crash mid-write never truncates a
 * committed file. Event records are append-only and synced before success.
 * Stored documents use versioned schema envelopes; unknown schema versions and
 * corrupt records block instead of silently resetting (design §15).
 *
 * Recovery is fail-closed (design §8.3): the event log is the replay source,
 * the replayed snapshot identity/version is compared with the snapshot file,
 * inconsistent or in-flight missions are marked unresolved and reach UNKNOWN
 * through engine policy without re-running any command, and human-wait and
 * terminal states are never auto-advanced (REQ-MISS-007/009).
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
import { createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import {
  AccountingMissionStatus,
  MissionEventType,
  type IdempotencyRecord,
  type IdempotencyStore,
  type MissionEvent,
  type MissionEventStore,
  type MissionSnapshot,
  type MissionStore,
} from "drenyra-ai/missions";
import type { MissionRuntime } from "drenyra-ai/missions";
import { isSafeStoreIdentifier } from "./authority-store.js";

/** The versioned store schema shared by every envelope (design §8.1). */
export const MISSION_STORE_SCHEMA_VERSION = 1;

const SCHEMA_IDS = {
  SNAPSHOT: "drenyra.mission-snapshot.v1",
  EVENT: "drenyra.mission-event.v1",
  IDEMPOTENCY: "drenyra.idempotency.v1",
  RECOVERY: "drenyra.mission-recovery.v1",
} as const;

type Envelope<T> = {
  schema: string;
  schemaVersion: number;
  payload: T;
};

const MISSION_INTENTS = [
  "monthly-close",
  "correction",
  "reconciliation",
  "invoice-review",
  "compliance-check",
  // Harness-only chain intents (design §11.4/§11.5): the verify and evidence
  // chains persist their own missions through the shared pipeline.
  "verify",
  "evidence",
] as const;

const STEP_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "SKIPPED"] as const;
const IDEMPOTENCY_STATUSES = ["EXECUTING", "COMPLETED", "FAILED"] as const;
const PROPOSAL_RISKS = ["LOW", "MEDIUM", "HIGH"] as const;

function assertSafeIdentifier(value: string, label: string): void {
  if (!isSafeStoreIdentifier(value)) {
    throw new Error(
      `${label} "${value}" is not a safe store identifier (letters, digits, '.', '_', '-' only; no path separators, no '..')`,
    );
  }
}

function assertInteger(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`mission store corrupt: ${label} must be a JSON integer`);
  }
}

function assertIsoInstant(value: unknown, label: string): void {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`mission store corrupt: ${label} must be a valid ISO instant`);
  }
}

/**
 * Validate a persisted mission snapshot against the full REQ-MISS-010 field
 * set. Any missing, mistyped, or unknown-status field fails closed.
 */
function assertValidSnapshot(snapshot: unknown): asserts snapshot is MissionSnapshot {
  if (typeof snapshot !== "object" || snapshot === null) {
    throw new Error("mission store corrupt: snapshot must be an object");
  }
  const record = snapshot as Record<string, unknown>;
  if (typeof record.id !== "string" || !isSafeStoreIdentifier(record.id)) {
    throw new Error("mission store corrupt: snapshot id must be a safe store identifier");
  }
  if (typeof record.companyId !== "string" || record.companyId.length === 0) {
    throw new Error("mission store corrupt: snapshot companyId must be a non-empty string");
  }
  if (typeof record.fiscalPeriod !== "string" || record.fiscalPeriod.length === 0) {
    throw new Error("mission store corrupt: snapshot fiscalPeriod must be a non-empty string");
  }
  if (typeof record.intent !== "string" || !MISSION_INTENTS.includes(record.intent as never)) {
    throw new Error(
      `mission store corrupt: snapshot intent "${String(record.intent)}" is not a canonical intent`,
    );
  }
  if (
    typeof record.status !== "string" ||
    !Object.values(AccountingMissionStatus).includes(record.status as AccountingMissionStatus)
  ) {
    throw new Error(
      `mission store corrupt: snapshot status "${String(record.status)}" is not an installed engine state`,
    );
  }
  assertInteger(record.version, "snapshot version");
  if ((record.version as number) < 1) {
    throw new Error("mission store corrupt: snapshot version must be >= 1");
  }
  if (typeof record.progress !== "number") {
    throw new Error("mission store corrupt: snapshot progress must be a number");
  }
  assertInteger(record.lastEventSequence, "snapshot lastEventSequence");
  if ((record.lastEventSequence as number) < 0) {
    throw new Error("mission store corrupt: snapshot lastEventSequence must be >= 0");
  }
  if (typeof record.currentStep !== "string") {
    throw new Error("mission store corrupt: snapshot currentStep must be a string");
  }
  if (!Array.isArray(record.steps)) {
    throw new Error("mission store corrupt: snapshot steps must be an array");
  }
  for (const step of record.steps) {
    if (typeof step !== "object" || step === null) {
      throw new Error("mission store corrupt: snapshot step must be an object");
    }
    const stepRecord = step as Record<string, unknown>;
    if (typeof stepRecord.id !== "string" || typeof stepRecord.name !== "string") {
      throw new Error("mission store corrupt: snapshot step must carry id and name strings");
    }
    if (
      typeof stepRecord.status !== "string" ||
      !STEP_STATUSES.includes(stepRecord.status as never)
    ) {
      throw new Error(
        `mission store corrupt: snapshot step status "${String(stepRecord.status)}" is unknown`,
      );
    }
  }
  if (!Array.isArray(record.blockers)) {
    throw new Error("mission store corrupt: snapshot blockers must be an array");
  }
  if (record.proposal !== null) {
    if (typeof record.proposal !== "object") {
      throw new Error("mission store corrupt: snapshot proposal must be an object or null");
    }
    const proposal = record.proposal as Record<string, unknown>;
    for (const field of ["id", "missionId", "summary", "evidenceHash", "generatedAt"]) {
      if (typeof proposal[field] !== "string") {
        throw new Error(`mission store corrupt: snapshot proposal ${field} must be a string`);
      }
    }
    assertInteger(proposal.version, "snapshot proposal version");
    if (!Array.isArray(proposal.evidence)) {
      throw new Error("mission store corrupt: snapshot proposal evidence must be an array");
    }
    if (
      typeof proposal.riskLevel !== "string" ||
      !PROPOSAL_RISKS.includes(proposal.riskLevel as never)
    ) {
      throw new Error("mission store corrupt: snapshot proposal riskLevel is unknown");
    }
  }
  if (record.rejection !== null) {
    if (typeof record.rejection !== "object") {
      throw new Error("mission store corrupt: snapshot rejection must be an object or null");
    }
    const rejection = record.rejection as Record<string, unknown>;
    for (const field of ["reason", "rejectedBy", "rejectedAt"]) {
      if (typeof rejection[field] !== "string") {
        throw new Error(`mission store corrupt: snapshot rejection ${field} must be a string`);
      }
    }
    assertInteger(rejection.proposalVersion, "snapshot rejection proposalVersion");
  }
  if (record.receiptId !== null && typeof record.receiptId !== "string") {
    throw new Error("mission store corrupt: snapshot receiptId must be a string or null");
  }
  if (record.receiptHash !== null && typeof record.receiptHash !== "string") {
    throw new Error("mission store corrupt: snapshot receiptHash must be a string or null");
  }
  assertIsoInstant(record.createdAt, "snapshot createdAt");
  assertIsoInstant(record.updatedAt, "snapshot updatedAt");
}

function assertValidEvent(event: unknown): asserts event is MissionEvent {
  if (typeof event !== "object" || event === null) {
    throw new Error("mission store corrupt: event must be an object");
  }
  const record = event as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new Error("mission store corrupt: event id must be a non-empty string");
  }
  if (typeof record.missionId !== "string" || !isSafeStoreIdentifier(record.missionId)) {
    throw new Error("mission store corrupt: event missionId must be a safe store identifier");
  }
  assertInteger(record.sequence, "event sequence");
  if (
    typeof record.eventType !== "string" ||
    !Object.values(MissionEventType).includes(record.eventType as MissionEventType)
  ) {
    throw new Error(`mission store corrupt: event eventType "${String(record.eventType)}" is unknown`);
  }
  if (typeof record.snapshot !== "object" || record.snapshot === null) {
    throw new Error("mission store corrupt: event snapshot must be an object");
  }
  const snapshot = record.snapshot as Record<string, unknown>;
  if (typeof snapshot.id !== "string" || snapshot.id !== record.missionId) {
    throw new Error("mission store corrupt: event snapshot id must match the event mission id");
  }
  assertInteger(snapshot.version, "event snapshot version");
  assertIsoInstant(record.createdAt, "event createdAt");
}

function assertValidIdempotencyRecord(record: unknown): asserts record is IdempotencyRecord {
  if (typeof record !== "object" || record === null) {
    throw new Error("mission store corrupt: idempotency record must be an object");
  }
  const value = record as Record<string, unknown>;
  if (typeof value.key !== "string" || value.key.length === 0) {
    throw new Error("mission store corrupt: idempotency key must be a non-empty string");
  }
  if (typeof value.payloadHash !== "string" || !/^[0-9a-f]{64}$/.test(value.payloadHash)) {
    throw new Error(
      "mission store corrupt: idempotency payloadHash must be a 64-character lowercase hex sha-256 digest",
    );
  }
  if (
    typeof value.status !== "string" ||
    !IDEMPOTENCY_STATUSES.includes(value.status as never)
  ) {
    throw new Error(
      `mission store corrupt: idempotency status "${String(value.status)}" is unknown`,
    );
  }
  if (typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)) {
    throw new Error("mission store corrupt: idempotency expiresAt must be a finite epoch millisecond number");
  }
  if (value.result !== undefined && (typeof value.result !== "object" || value.result === null)) {
    throw new Error("mission store corrupt: idempotency result must be an object or absent");
  }
}

function envelopeOf<T>(schema: string, payload: T): Envelope<T> {
  return { schema, schemaVersion: MISSION_STORE_SCHEMA_VERSION, payload };
}

function assertEnvelopeVersion(raw: unknown, path: string): Envelope<unknown> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(
      `mission store corrupt: ${path} has no schema envelope — repair is explicit and never automatic`,
    );
  }
  const envelope = raw as Record<string, unknown>;
  if (typeof envelope.schema !== "string" || typeof envelope.schemaVersion !== "number") {
    throw new Error(
      `mission store corrupt: ${path} has an incomplete schema envelope — repair is explicit and never automatic`,
    );
  }
  if (envelope.schemaVersion !== MISSION_STORE_SCHEMA_VERSION) {
    throw new Error(
      `mission store schema version ${String(envelope.schemaVersion)} at ${path} is not supported (expected ${MISSION_STORE_SCHEMA_VERSION}) — migration is explicit and never automatic`,
    );
  }
  return envelope as Envelope<unknown>;
}

function parseJsonFile(path: string, label: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`mission store corrupt: ${label} at ${path} is unreadable`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `mission store corrupt: ${label} at ${path} is not valid JSON — repair is explicit and never automatic`,
    );
  }
}

function readSnapshotFile(path: string): MissionSnapshot {
  const parsed = parseJsonFile(path, "snapshot");
  const envelope = assertEnvelopeVersion(parsed, path);
  if (envelope.schema !== SCHEMA_IDS.SNAPSHOT) {
    throw new Error(`mission store corrupt: ${path} is not a mission snapshot document`);
  }
  assertValidSnapshot(envelope.payload);
  return envelope.payload;
}

function readEventLine(line: string, path: string, missionId: string): MissionEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    throw new Error(
      `mission event log corrupt: ${path} contains a malformed line — repair is explicit and never automatic`,
    );
  }
  const envelope = assertEnvelopeVersion(parsed, path);
  if (envelope.schema !== SCHEMA_IDS.EVENT) {
    throw new Error(`mission event log corrupt: ${path} is not a mission event document`);
  }
  assertValidEvent(envelope.payload);
  const event = envelope.payload;
  if (event.missionId !== missionId) {
    throw new Error(
      `mission event log corrupt: ${path} contains an event for a different mission (${event.missionId})`,
    );
  }
  return event;
}

function readIdempotencyFile(path: string): IdempotencyRecord {
  const parsed = parseJsonFile(path, "idempotency record");
  const envelope = assertEnvelopeVersion(parsed, path);
  if (envelope.schema !== SCHEMA_IDS.IDEMPOTENCY) {
    throw new Error(`mission store corrupt: ${path} is not an idempotency document`);
  }
  assertValidIdempotencyRecord(envelope.payload);
  return envelope.payload;
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
  syncDirectory(dirname(targetPath));
}

function syncDirectory(dir: string): void {
  const fd = openSync(dir, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Append one NDJSON line and fsync before reporting success. */
function appendLineSync(path: string, line: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a");
  try {
    writeSync(fd, `${line}\n`, null, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * File-backed mission snapshot store (design §8.2). One envelope document per
 * mission under `.local/missions/snapshots/<mission-id>.json`.
 */
export class FileMissionStore implements MissionStore {
  private readonly dir: string;

  constructor(root: string) {
    this.dir = join(root, ".local", "missions", "snapshots");
  }

  private pathFor(missionId: string): string {
    assertSafeIdentifier(missionId, "mission id");
    return join(this.dir, `${missionId}.json`);
  }

  async save(snapshot: MissionSnapshot): Promise<void> {
    assertValidSnapshot(snapshot);
    atomicWriteJson(this.pathFor(snapshot.id), envelopeOf(SCHEMA_IDS.SNAPSHOT, snapshot));
  }

  async findById(id: string): Promise<MissionSnapshot | undefined> {
    const path = this.pathFor(id);
    if (!existsSync(path)) {
      return undefined;
    }
    return readSnapshotFile(path);
  }

  async findByStatus(statuses: AccountingMissionStatus[]): Promise<MissionSnapshot[]> {
    const statusSet = new Set(statuses);
    const all = await this.list();
    return all.filter((mission) => statusSet.has(mission.status));
  }

  async list(): Promise<MissionSnapshot[]> {
    if (!existsSync(this.dir)) {
      return [];
    }
    const missions: MissionSnapshot[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(".json")) {
        continue; // Stale unique temp files from a crash are never read as data.
      }
      missions.push(readSnapshotFile(join(this.dir, name)));
    }
    missions.sort((a, b) =>
      a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
    );
    return missions;
  }
}

/**
 * File-backed append-only mission event log (design §8.2). NDJSON under
 * `.local/missions/events/<mission-id>.ndjson`; every append is synced before
 * success and a malformed/truncated line fails closed.
 */
export class FileMissionEventStore implements MissionEventStore {
  private readonly dir: string;

  constructor(root: string) {
    this.dir = join(root, ".local", "missions", "events");
  }

  private pathFor(missionId: string): string {
    assertSafeIdentifier(missionId, "mission id");
    return join(this.dir, `${missionId}.ndjson`);
  }

  async append(event: MissionEvent): Promise<void> {
    assertValidEvent(event);
    appendLineSync(
      this.pathFor(event.missionId),
      JSON.stringify(envelopeOf(SCHEMA_IDS.EVENT, event)),
    );
  }

  async list(missionId: string): Promise<MissionEvent[]> {
    const path = this.pathFor(missionId);
    if (!existsSync(path)) {
      return [];
    }
    const raw = readFileSync(path, "utf8");
    const events: MissionEvent[] = [];
    for (const line of raw.split("\n")) {
      if (line.trim().length === 0) {
        continue;
      }
      events.push(readEventLine(line, path, missionId));
    }
    events.sort((a, b) => a.sequence - b.sequence);
    return events;
  }
}

/**
 * File-backed idempotency store (design §8.2). Records live under
 * `.local/missions/idempotency/<sha256-of-key>.json`; expired records are
 * treated as absent (matching the engine's in-memory TTL semantics).
 */
export class FileIdempotencyStore implements IdempotencyStore {
  private readonly dir: string;

  constructor(root: string) {
    this.dir = join(root, ".local", "missions", "idempotency");
  }

  private keyPath(key: string): string {
    if (typeof key !== "string" || key.length === 0 || key.length > 512) {
      throw new Error("idempotency key must be a non-empty string of at most 512 characters");
    }
    const digest = createHash("sha256").update(key, "utf8").digest("hex");
    return join(this.dir, `${digest}.json`);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const path = this.keyPath(key);
    if (!existsSync(path)) {
      return undefined;
    }
    const record = readIdempotencyFile(path);
    if (record.expiresAt <= Date.now()) {
      return undefined; // Engine TTL semantics: expired keys re-execute cleanly.
    }
    return record;
  }

  async put(record: IdempotencyRecord): Promise<void> {
    assertValidIdempotencyRecord(record);
    atomicWriteJson(this.keyPath(record.key), envelopeOf(SCHEMA_IDS.IDEMPOTENCY, record));
  }

  /**
   * Every non-expired EXECUTING record (recovery diagnostic; design §8.3).
   * Corrupt records fail closed; stale temp files are ignored.
   */
  async listExecuting(): Promise<IdempotencyRecord[]> {
    if (!existsSync(this.dir)) {
      return [];
    }
    const records: IdempotencyRecord[] = [];
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const record = readIdempotencyFile(join(this.dir, name));
      if (record.status === "EXECUTING" && record.expiresAt > Date.now()) {
        records.push(record);
      }
    }
    return records;
  }
}

/**
 * The composed durable store set (design §8.2). The three adapters implement
 * the public engine ports; `root` is the workspace root the stores live under.
 */
export interface DurableMissionStores {
  store: FileMissionStore;
  events: FileMissionEventStore;
  idempotency: FileIdempotencyStore;
  root: string;
}

/** Create the durable store set under a workspace root (default: cwd). */
export function createDurableMissionStores(root?: string): DurableMissionStores {
  const base = root ?? process.cwd();
  for (const sub of ["snapshots", "events", "idempotency", "recovery"]) {
    mkdirSync(join(base, ".local", "missions", sub), { recursive: true });
  }
  return {
    store: new FileMissionStore(base),
    events: new FileMissionEventStore(base),
    idempotency: new FileIdempotencyStore(base),
    root: base,
  };
}

/** Why a mission's recovery record is unresolved (design §8.3 step 4). */
export type RecoveryUnresolvedReason = "snapshot-ahead-of-events" | "executing-without-result";

/** One fail-closed recovery diagnostic for an interrupted mission. */
export interface RecoveryUnresolved {
  missionId: string;
  reason: RecoveryUnresolvedReason;
  snapshotVersion: number;
  lastEventVersion?: number;
}

/** The result of a restart-time recovery pass (design §8.3). */
export interface RecoveryReport {
  /** Missions the engine policy transitioned to UNKNOWN (never re-run). */
  recovered: MissionSnapshot[];
  /** Consistent missions left untouched (human-wait, terminal, queued, ...). */
  preserved: MissionSnapshot[];
  /** Missions whose recovery record is unresolved; export/recovery diagnostic. */
  unresolved: RecoveryUnresolved[];
}

function writeRecoveryRecord(stores: DurableMissionStores, entry: RecoveryUnresolved): void {
  const path = join(stores.root, ".local", "missions", "recovery", `${entry.missionId}.json`);
  atomicWriteJson(
    path,
    envelopeOf(SCHEMA_IDS.RECOVERY, {
      missionId: entry.missionId,
      reason: entry.reason,
      snapshotVersion: entry.snapshotVersion,
      ...(entry.lastEventVersion !== undefined
        ? { lastEventVersion: entry.lastEventVersion }
        : {}),
      at: new Date().toISOString(),
    }),
  );
}

/**
 * Fail-closed restart recovery (REQ-MISS-007; design §8.3):
 *
 * 1. Load and validate every event log as the replay source (corrupt logs throw).
 * 2. Compare each replayed snapshot identity/version with the snapshot file.
 * 3. Equal -> consistent and preserved.
 * 4. A snapshot ahead of its event log, or an EXECUTING idempotency record
 *    without a complete visible result, marks the recovery record unresolved;
 *    the engine policy then reaches UNKNOWN where legal (RUNNING only) without
 *    re-running the command.
 * 5. Human-wait and terminal states are never auto-advanced.
 */
export async function recoverDurableMissions(
  runtime: MissionRuntime,
  stores: DurableMissionStores,
): Promise<RecoveryReport> {
  const missions = await stores.store.list();
  const executing = await stores.idempotency.listExecuting();

  const unresolved: RecoveryUnresolved[] = [];
  const consistentIds = new Set<string>();

  for (const mission of missions) {
    const events = await stores.events.list(mission.id);
    const last = events[events.length - 1];
    if (last === undefined) {
      throw new Error(
        `mission store corrupt: mission ${mission.id} has a snapshot but no events — repair is explicit and never automatic`,
      );
    }
    if (last.snapshot.id !== mission.id || last.snapshot.version !== mission.version) {
      unresolved.push({
        missionId: mission.id,
        reason: "snapshot-ahead-of-events",
        snapshotVersion: mission.version,
        lastEventVersion: last.snapshot.version,
      });
      continue;
    }
    consistentIds.add(mission.id);
  }

  if (executing.length > 0) {
    for (const mission of missions) {
      if (!consistentIds.has(mission.id)) {
        continue;
      }
      // An EXECUTING record means at least one command may be half-applied;
      // every in-flight mission's recovery record is unresolved.
      if (isExecutionState(mission.status)) {
        unresolved.push({
          missionId: mission.id,
          reason: "executing-without-result",
          snapshotVersion: mission.version,
        });
      }
    }
  }

  for (const entry of unresolved) {
    writeRecoveryRecord(stores, entry);
  }

  // Engine policy: only statuses whose VALID_TRANSITIONS reach UNKNOWN (i.e.
  // RUNNING) are transitioned; the command is never re-executed.
  const recovered = await runtime.recoverIncomplete();
  const recoveredIds = new Set(recovered.map((mission) => mission.id));

  const preserved = missions.filter(
    (mission) => consistentIds.has(mission.id) && !recoveredIds.has(mission.id),
  );

  return { recovered, preserved, unresolved };
}

function isExecutionState(status: AccountingMissionStatus): boolean {
  switch (status) {
    case AccountingMissionStatus.DRAFT:
    case AccountingMissionStatus.QUEUED:
    case AccountingMissionStatus.RUNNING:
    case AccountingMissionStatus.RECOVERING:
    case AccountingMissionStatus.APPROVED:
    case AccountingMissionStatus.REJECTED:
    case AccountingMissionStatus.REVISION_REQUESTED:
      return true;
    default:
      return false;
  }
}
