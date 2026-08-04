/**
 * Durable mission stores — RED/GREEN tests for T-S3A-001 (file-backed
 * mission/event/idempotency adapters; design §8.1/§8.2) and T-S3A-002
 * (fail-closed recovery + idempotent replay; design §8.3).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money. Digests are lowercase hex sha-256; version
 * and sequence numbers are JSON integers.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AccountingMissionStatus,
  IdempotencyConflict,
  IntentRegistryImpl,
  MissionEventType,
  MissionRuntime,
  type IntentHandler,
  type MissionEvent,
  type MissionSnapshot,
} from "drenyra-ai/missions";
import { makeMission } from "./helpers/authority-fixtures.js";
import {
  MISSION_STORE_SCHEMA_VERSION,
  createDurableMissionStores,
  recoverDurableMissions,
  type DurableMissionStores,
} from "../lib/mission-store.js";

const DIRS: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-mission-store-"));
  DIRS.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeEvent(missionId: string, sequence: number, snapshot: MissionSnapshot): MissionEvent {
  return {
    id: `evt_${missionId}_${sequence}`,
    missionId,
    sequence,
    eventType: MissionEventType.STATE_TRANSITION,
    snapshot,
    createdAt: snapshot.updatedAt,
  };
}

/** A minimal monthly-close intent handler that walks the engine lifecycle. */
function lifecycleHandler(): IntentHandler {
  return {
    intent: "monthly-close",
    async execute(mission: MissionSnapshot) {
      if (mission.status === AccountingMissionStatus.DRAFT) {
        return { ...mission, status: AccountingMissionStatus.QUEUED };
      }
      if (mission.status === AccountingMissionStatus.QUEUED) {
        return { ...mission, status: AccountingMissionStatus.RUNNING };
      }
      if (mission.status === AccountingMissionStatus.RUNNING) {
        return { ...mission, status: AccountingMissionStatus.COMPLETED };
      }
      return null;
    },
  };
}

function makeRuntime(stores: DurableMissionStores): MissionRuntime {
  const registry = new IntentRegistryImpl();
  registry.register(lifecycleHandler());
  return new MissionRuntime({
    store: stores.store,
    events: stores.events,
    idempotency: stores.idempotency,
    registry,
  });
}

describe("T-S3A-001 createDurableMissionStores layout (design §8.1)", () => {
  it("creates the .local/missions/{snapshots,events,idempotency,recovery} layout", () => {
    const root = tempRoot();
    createDurableMissionStores(root);
    for (const sub of ["snapshots", "events", "idempotency", "recovery"]) {
      expect(existsSync(join(root, ".local", "missions", sub)), sub).toBe(true);
    }
  });
});

describe("T-S3A-001 FileMissionStore (REQ-MISS-006/010)", () => {
  it("persists and rehydrates every MissionSnapshot field (REQ-MISS-010)", async () => {
    const stores = createDurableMissionStores(tempRoot());
    const snapshot = makeMission({
      status: AccountingMissionStatus.RUNNING,
      steps: [
        { id: "intake", name: "Intake", status: "COMPLETED" },
        { id: "ingest", name: "Ingest", status: "PENDING" },
      ],
      blockers: [
        {
          id: "blk-1",
          reason: "bank statement pending",
          severity: "ERROR",
          occurredAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      proposal: {
        id: "prop-1",
        missionId: "mission-close-001",
        version: 2,
        evidence: [{ id: "src-1", label: "bank.csv", type: "source-reference" }],
        evidenceHash: "b".repeat(64),
        summary: "Close books",
        riskLevel: "MEDIUM",
        generatedAt: "2026-07-01T00:00:00.000Z",
      },
      receiptId: "rcpt-1",
      receiptHash: "c".repeat(64),
      lastEventSequence: 4,
    });
    await stores.store.save(snapshot);

    const loaded = await stores.store.findById(snapshot.id);
    expect(loaded).toEqual(snapshot);
  });

  it("filters by status and lists every saved mission", async () => {
    const stores = createDurableMissionStores(tempRoot());
    const running = makeMission({ id: "mission-a", status: AccountingMissionStatus.RUNNING });
    const completed = makeMission({
      id: "mission-b",
      status: AccountingMissionStatus.COMPLETED,
    });
    await stores.store.save(running);
    await stores.store.save(completed);

    const byStatus = await stores.store.findByStatus([AccountingMissionStatus.COMPLETED]);
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0]?.id).toBe("mission-b");

    const all = await stores.store.list();
    expect(all.map((m) => m.id).sort()).toEqual(["mission-a", "mission-b"]);
  });

  it("returns undefined for an unknown mission id", async () => {
    const stores = createDurableMissionStores(tempRoot());
    expect(await stores.store.findById("mission-missing")).toBeUndefined();
  });

  it("ignores stale temp files from a crash mid-write — the committed file is never truncated", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const mission = makeMission({ version: 1 });
    await stores.store.save(mission);

    // Simulate a crash that left a unique temp file with garbage bytes.
    const snapshotFile = join(root, ".local", "missions", "snapshots", `${mission.id}.json`);
    writeFileSync(`${snapshotFile}.12345.deadbeef.tmp`, '{"schema": "drenyra.mission-snap', "utf8");

    // The committed file is complete JSON (never truncated by the crash).
    const raw = readFileSync(snapshotFile, "utf8");
    const parsed = JSON.parse(raw) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(MISSION_STORE_SCHEMA_VERSION);

    // Reads ignore the stale temp and return the committed snapshot.
    expect(await stores.store.findById(mission.id)).toEqual(mission);
    expect(await stores.store.list()).toHaveLength(1);

    // A new save still works and leaves the stale temp harmless.
    await stores.store.save({ ...mission, version: 2, updatedAt: "2026-07-02T00:00:00.000Z" });
    expect((await stores.store.findById(mission.id))?.version).toBe(2);
    expect(await stores.store.list()).toHaveLength(1);
  });

  it("blocks unknown schema versions instead of silently resetting (design §15)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const mission = makeMission();
    const snapshotFile = join(root, ".local", "missions", "snapshots", `${mission.id}.json`);
    writeFileSync(
      snapshotFile,
      JSON.stringify({
        schema: "drenyra.mission-snapshot.v1",
        schemaVersion: 2,
        payload: mission,
      }),
      "utf8",
    );
    await expect(stores.store.findById(mission.id)).rejects.toThrow(/schema version 2/);
    await expect(stores.store.list()).rejects.toThrow(/schema version 2/);
  });

  it("fails closed on corrupt snapshot JSON", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const snapshotFile = join(root, ".local", "missions", "snapshots", "mission-broken.json");
    writeFileSync(snapshotFile, '{"schema": "drenyra.mission-snapshot.v1", "schemaVersion": 1', "utf8");
    await expect(stores.store.findById("mission-broken")).rejects.toThrow(/corrupt/);
    await expect(stores.store.list()).rejects.toThrow(/corrupt/);
  });

  it("rejects a snapshot with a truncated/wrong shape (fail closed)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const broken = makeMission();
    delete (broken as Partial<MissionSnapshot>).companyId;
    await expect(stores.store.save(broken)).rejects.toThrow(/companyId/);
  });

  it("rejects path-traversal mission ids (design §15)", async () => {
    const stores = createDurableMissionStores(tempRoot());
    await expect(stores.store.findById("../../etc/passwd")).rejects.toThrow(/safe store identifier/);
    const evil = makeMission({ id: "../evil" });
    await expect(stores.store.save(evil)).rejects.toThrow(/safe store identifier/);
    await expect(stores.events.list("../../etc/passwd")).rejects.toThrow(/safe store identifier/);
  });
});

describe("T-S3A-001 FileMissionEventStore (append-only, synced)", () => {
  it("appends and lists events in append order", async () => {
    const stores = createDurableMissionStores(tempRoot());
    const v1 = makeMission({ version: 1 });
    const v2 = { ...v1, version: 2, updatedAt: "2026-07-01T00:00:01.000Z" } as MissionSnapshot;
    await stores.events.append(makeEvent(v1.id, 1, v1));
    await stores.events.append(makeEvent(v1.id, 2, v2));

    const events = await stores.events.list(v1.id);
    expect(events.map((e) => e.sequence)).toEqual([1, 2]);
    expect(events[1]?.snapshot.version).toBe(2);
  });

  it("returns an empty list when a mission has no events", async () => {
    const stores = createDurableMissionStores(tempRoot());
    expect(await stores.events.list("mission-quiet")).toEqual([]);
  });

  it("fails closed on a truncated event log line", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const mission = makeMission();
    await stores.events.append(makeEvent(mission.id, 1, mission));
    const eventFile = join(root, ".local", "missions", "events", `${mission.id}.ndjson`);
    writeFileSync(
      eventFile,
      `${readFileSync(eventFile, "utf8")}{"schema": "drenyra.mission-event.v1", "schemaVersion": 1, "payload": {"id": "evt_trunc`,
      "utf8",
    );
    await expect(stores.events.list(mission.id)).rejects.toThrow(/corrupt/);
  });

  it("rejects an event for a different mission than the log file (fail closed)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const mission = makeMission();
    await stores.events.append(makeEvent(mission.id, 1, mission));
    const eventFile = join(root, ".local", "missions", "events", `${mission.id}.ndjson`);
    const line = JSON.stringify({
      schema: "drenyra.mission-event.v1",
      schemaVersion: MISSION_STORE_SCHEMA_VERSION,
      payload: makeEvent("mission-other", 1, { ...mission, id: "mission-other" }),
    });
    writeFileSync(eventFile, `${line}\n`, "utf8");
    await expect(stores.events.list(mission.id)).rejects.toThrow(/different mission/);
  });
});

describe("T-S3A-001 FileIdempotencyStore", () => {
  it("round-trips idempotency records and hashes keys into safe filenames", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const record = {
      key: "mc:mission-close-001:ingest:v3",
      payloadHash: "a".repeat(64),
      status: "COMPLETED" as const,
      result: { snapshot: makeMission(), createdAt: "2026-07-01T00:00:00.000Z" },
      expiresAt: Date.now() + 60_000,
    };
    await stores.idempotency.put(record);
    expect(await stores.idempotency.get(record.key)).toEqual(record);

    // The key is sha-256-hashed into the filename — arbitrary key bytes never
    // become a path component: exactly one 64-hex-digest file exists.
    const idemDir = join(root, ".local", "missions", "idempotency");
    const names = readdirSync(idemDir).filter((name) => name.endsWith(".json"));
    expect(names).toHaveLength(1);
    const expectedStem = createHash("sha256").update(record.key, "utf8").digest("hex");
    expect(names[0]).toBe(`${expectedStem}.json`);
  });

  it("treats an expired record as absent (engine TTL semantics)", async () => {
    const stores = createDurableMissionStores(tempRoot());
    const record = {
      key: "mc:expired",
      payloadHash: "d".repeat(64),
      status: "COMPLETED" as const,
      result: { createdAt: "2026-07-01T00:00:00.000Z" },
      expiresAt: Date.now() - 1,
    };
    await stores.idempotency.put(record);
    expect(await stores.idempotency.get("mc:expired")).toBeUndefined();
  });

  it("rejects an empty idempotency key (never a raw path)", async () => {
    const stores = createDurableMissionStores(tempRoot());
    await expect(stores.idempotency.get("")).rejects.toThrow(/non-empty/);
    await expect(
      stores.idempotency.put({
        key: "",
        payloadHash: "e".repeat(64),
        status: "EXECUTING",
        result: undefined,
        expiresAt: Date.now() + 1_000,
      }),
    ).rejects.toThrow(/non-empty/);
  });

  it("fails closed on a corrupt idempotency record file", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const expectedStem = createHash("sha256").update("x", "utf8").digest("hex");
    writeFileSync(
      join(root, ".local", "missions", "idempotency", `${expectedStem}.json`),
      '{"schema": "drenyra.idempotency.v1", "schemaVersion": 1, "payload": {"key": "x"',
      "utf8",
    );
    await expect(stores.idempotency.get("x")).rejects.toThrow(/corrupt/);
  });
});

describe("T-S3A-002 recoverDurableMissions (REQ-MISS-007/009; SC-MISS-003)", () => {
  it("preserves consistent missions and never re-runs their events", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    const queued = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } },
      { expectedMissionVersion: 1 },
    );

    const eventsBefore = (await stores.events.list(mission.id)).length;
    const report = await recoverDurableMissions(runtime, stores);
    expect(report.unresolved).toEqual([]);
    expect(report.preserved.map((m) => m.id)).toContain(mission.id);
    expect(report.preserved.find((m) => m.id === mission.id)?.status).toBe(
      AccountingMissionStatus.QUEUED,
    );
    expect(report.recovered.map((m) => m.id)).not.toContain(mission.id);
    expect((await stores.events.list(mission.id)).length).toBe(eventsBefore);
    expect((await stores.store.findById(mission.id))?.status).toBe(AccountingMissionStatus.QUEUED);
    expect(queued.snapshot.version).toBe(2);
  });

  it("never auto-advances human-wait states (REQ-MISS-009; SC-MISS-005/006)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    // A handler whose RUNNING path enters the evidence wait (engine-legal).
    const waitRegistry = new IntentRegistryImpl();
    waitRegistry.register({
      intent: "monthly-close",
      async execute(mission: MissionSnapshot) {
        if (mission.status === AccountingMissionStatus.DRAFT) {
          return { ...mission, status: AccountingMissionStatus.QUEUED };
        }
        if (mission.status === AccountingMissionStatus.QUEUED) {
          return { ...mission, status: AccountingMissionStatus.RUNNING };
        }
        if (mission.status === AccountingMissionStatus.RUNNING) {
          return { ...mission, status: AccountingMissionStatus.WAITING_FOR_EVIDENCE };
        }
        return null;
      },
    });
    const runtime = new MissionRuntime({
      store: stores.store,
      events: stores.events,
      idempotency: stores.idempotency,
      registry: waitRegistry,
    });
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } },
      { expectedMissionVersion: 1 },
    );
    const running = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 2 } },
      { expectedMissionVersion: 2 },
    );
    // Move RUNNING -> WAITING_FOR_EVIDENCE (engine-legal) to model a human wait.
    const waiting = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 3 } },
      { expectedMissionVersion: 3 },
    );
    expect(waiting.snapshot.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);

    const report = await recoverDurableMissions(runtime, stores);
    const preserved = report.preserved.find((m) => m.id === mission.id);
    expect(preserved?.status).toBe(AccountingMissionStatus.WAITING_FOR_EVIDENCE);
    expect(report.recovered.map((m) => m.id)).not.toContain(mission.id);
    expect((await stores.store.findById(mission.id))?.status).toBe(
      AccountingMissionStatus.WAITING_FOR_EVIDENCE,
    );
    expect(running.snapshot.status).toBe(AccountingMissionStatus.RUNNING);
  });

  it("never replays terminal missions (REQ-MISS-007)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } },
      { expectedMissionVersion: 1 },
    );
    await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 2 } },
      { expectedMissionVersion: 2 },
    );
    const completed = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 3 } },
      { expectedMissionVersion: 3 },
    );
    expect(completed.snapshot.status).toBe(AccountingMissionStatus.COMPLETED);

    const eventsBefore = (await stores.events.list(mission.id)).length;
    const report = await recoverDurableMissions(runtime, stores);
    expect(report.preserved.map((m) => m.id)).toContain(mission.id);
    expect(report.recovered).toEqual([]);
    expect((await stores.events.list(mission.id)).length).toBe(eventsBefore);
    expect((await stores.store.findById(mission.id))?.status).toBe(
      AccountingMissionStatus.COMPLETED,
    );
  });

  it("marks a snapshot ahead of its event log unresolved and recovers RUNNING to UNKNOWN", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } },
      { expectedMissionVersion: 1 },
    );
    const running = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 2 } },
      { expectedMissionVersion: 2 },
    );
    expect(running.snapshot.status).toBe(AccountingMissionStatus.RUNNING);

    // Simulate a crash between store.save and events.append: the snapshot file
    // is one version ahead of the event log.
    await stores.store.save({ ...running.snapshot, version: running.snapshot.version + 1 });
    const eventsBefore = (await stores.events.list(mission.id)).length;

    const report = await recoverDurableMissions(runtime, stores);
    const unresolved = report.unresolved.find((u) => u.missionId === mission.id);
    expect(unresolved?.reason).toBe("snapshot-ahead-of-events");
    expect(unresolved?.snapshotVersion).toBe(4);
    expect(unresolved?.lastEventVersion).toBe(3);
    expect(report.preserved.map((m) => m.id)).not.toContain(mission.id);
    // Engine policy reached UNKNOWN without re-running the command.
    const recovered = report.recovered.find((m) => m.id === mission.id);
    expect(recovered?.status).toBe(AccountingMissionStatus.UNKNOWN);
    expect((await stores.store.findById(mission.id))?.status).toBe(AccountingMissionStatus.UNKNOWN);
    // Only the recovery transition event was appended — no command replay.
    expect((await stores.events.list(mission.id)).length).toBe(eventsBefore + 1);
    const last = (await stores.events.list(mission.id)).at(-1);
    expect(last?.snapshot.status).toBe(AccountingMissionStatus.UNKNOWN);
  });

  it("marks an EXECUTING idempotency record without a visible result unresolved (REQ-MISS-008)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 1 } },
      { expectedMissionVersion: 1 },
    );
    const running = await runtime.apply(
      { type: "execute", missionId: mission.id, payload: { expectedMissionVersion: 2 } },
      { expectedMissionVersion: 2 },
    );
    expect(running.snapshot.status).toBe(AccountingMissionStatus.RUNNING);

    // A crashed command left an EXECUTING record with no cached outcome.
    const key = `mc:${mission.id}:ingest:v3`;
    await stores.idempotency.put({
      key,
      payloadHash: "ab".repeat(32),
      status: "EXECUTING",
      result: { createdAt: new Date().toISOString() },
      expiresAt: Date.now() + 60_000,
    });

    const report = await recoverDurableMissions(runtime, stores);
    const unresolved = report.unresolved.find((u) => u.missionId === mission.id);
    expect(unresolved?.reason).toBe("executing-without-result");
    const recovered = report.recovered.find((m) => m.id === mission.id);
    expect(recovered?.status).toBe(AccountingMissionStatus.UNKNOWN);
    // The command was NOT re-run: the record stays EXECUTING.
    expect((await stores.idempotency.get(key))?.status).toBe("EXECUTING");
  });

  it("fails closed on a corrupt event log — never silently skips (design §8.3)", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    const eventFile = join(root, ".local", "missions", "events", `${mission.id}.ndjson`);
    writeFileSync(
      eventFile,
      `${readFileSync(eventFile, "utf8")}{"schema": "drenyra.mission-event.v1", "schemaVersion": 1, "payload": {"id": "evt_broken`,
      "utf8",
    );
    await expect(recoverDurableMissions(runtime, stores)).rejects.toThrow(/corrupt/);
  });
});

describe("T-S3A-002 idempotent replay through the durable stores (REQ-MISS-008; SC-MISS-004)", () => {
  it("replays a completed key with the cached result and rejects conflicting payloads", async () => {
    const root = tempRoot();
    const stores = createDurableMissionStores(root);
    const runtime = makeRuntime(stores);
    const mission = await runtime.start({
      companyId: "20123456786",
      fiscalPeriod: "202507",
      intent: "monthly-close",
      input: { instruction: "close" },
    });
    const command = {
      type: "execute" as const,
      missionId: mission.id,
      payload: { expectedMissionVersion: 1 },
    };
    const key = `mc:${mission.id}:intake:v1`;

    const first = await runtime.apply(command, { idempotencyKey: key, expectedMissionVersion: 1 });
    expect(first.replayed).toBeUndefined();
    expect(first.snapshot.status).toBe(AccountingMissionStatus.QUEUED);

    // Same key + same payload -> cached result, no duplicate transition.
    const replayed = await runtime.apply(command, { idempotencyKey: key, expectedMissionVersion: 1 });
    expect(replayed.replayed).toBe(true);
    expect(replayed.snapshot.id).toBe(first.snapshot.id);
    expect(replayed.snapshot.version).toBe(first.snapshot.version);
    expect((await stores.events.list(mission.id)).length).toBe(2); // start + one execute

    // Same key + different payload -> engine IdempotencyConflict.
    const conflicting = {
      type: "execute" as const,
      missionId: mission.id,
      payload: { expectedMissionVersion: 99 },
    };
    await expect(
      runtime.apply(conflicting, { idempotencyKey: key, expectedMissionVersion: 99 }),
    ).rejects.toBeInstanceOf(IdempotencyConflict);
  });
});
