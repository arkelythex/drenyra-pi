/**
 * Authority store — RED/GREEN tests for T-S2-003 (append-only authorization
 * records, atomic append, scope binding, idempotent replay).
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACTION_FAMILY } from "../lib/authority-gates.js";
import { AUTHORITY_MODE } from "../runtime/context.js";
import {
  AuthorityStore,
  isSafeStoreIdentifier,
} from "../lib/authority-store.js";
import {
  makeAuthorization,
  makeScopeBinding,
} from "./helpers/authority-fixtures.js";

describe("isSafeStoreIdentifier (design §15)", () => {
  it("accepts conservative identifier characters", () => {
    expect(isSafeStoreIdentifier("mission-close-001")).toBe(true);
    expect(isSafeStoreIdentifier("auth.001")).toBe(true);
    expect(isSafeStoreIdentifier("AUTH_42")).toBe(true);
  });

  it("rejects path-traversal and separator shapes", () => {
    expect(isSafeStoreIdentifier("..")).toBe(false);
    expect(isSafeStoreIdentifier(".")).toBe(false);
    expect(isSafeStoreIdentifier("../etc/passwd")).toBe(false);
    expect(isSafeStoreIdentifier("a/b")).toBe(false);
    expect(isSafeStoreIdentifier("a\\b")).toBe(false);
    expect(isSafeStoreIdentifier("..hidden")).toBe(false);
    expect(isSafeStoreIdentifier("")).toBe(false);
  });
});

describe("AuthorityStore", () => {
  let root: string;
  let store: AuthorityStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "drenyra-pi-authority-"));
    store = new AuthorityStore(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function logPath(missionId: string): string {
    return join(root, ".local", "authority", `${missionId}.ndjson`);
  }

  it("appends a record to <workspace>/.local/authority/<mission-id>.ndjson (design §5.4)", async () => {
    const binding = makeScopeBinding();
    const record = makeAuthorization({}, binding);
    await store.appendAuthorization(record);

    expect(existsSync(logPath(record.missionId))).toBe(true);
    const lines = readFileSync(logPath(record.missionId), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual(record);

    const listed = await store.listAuthorizations(record.missionId);
    expect(listed).toEqual([record]);
  });

  it("replays idempotently when the same canonical record is appended again", async () => {
    const binding = makeScopeBinding();
    const record = makeAuthorization({}, binding);
    await store.appendAuthorization(record);
    await store.appendAuthorization(record);

    const lines = readFileSync(logPath(record.missionId), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(await store.listAuthorizations(record.missionId)).toHaveLength(1);
  });

  it("blocks a conflicting record with the same id but different bytes", async () => {
    const binding = makeScopeBinding();
    const record = makeAuthorization({}, binding);
    await store.appendAuthorization(record);

    const conflicting = makeAuthorization({ actorId: "eve" }, binding);
    await expect(store.appendAuthorization(conflicting)).rejects.toThrow(
      /conflict|already exists/i,
    );

    // The original record is untouched (append-only).
    expect(await store.listAuthorizations(record.missionId)).toEqual([record]);
  });

  it("finds a bound authorization by exact scope hash, actor, family, and mission (REQ-AUTH-003; REQ-SCOPE-008)", async () => {
    const binding = makeScopeBinding();
    const record = makeAuthorization({}, binding);
    await store.appendAuthorization(record);

    const found = await store.findBoundAuthorization({
      missionId: record.missionId,
      scopeHash: binding.scopeHash,
      actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
      actorId: "alice",
    });
    expect(found).toEqual(record);
  });

  it("returns the most recent matching record when the mode was re-authorized", async () => {
    const binding = makeScopeBinding();
    const first = makeAuthorization(
      { authorityMode: AUTHORITY_MODE.ANALYZE, actionFamily: ACTION_FAMILY.INVESTIGATE },
      binding,
    );
    const second = makeAuthorization(
      { id: "auth-002", authorityMode: AUTHORITY_MODE.EXECUTE, actionFamily: ACTION_FAMILY.EXECUTE_TARGET },
      binding,
    );
    await store.appendAuthorization(first);
    await store.appendAuthorization(second);

    const found = await store.findBoundAuthorization({
      missionId: "mission-close-001",
      scopeHash: binding.scopeHash,
      actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
      actorId: "alice",
    });
    expect(found?.id).toBe("auth-002");
  });

  it("never returns a DENIED decision from findBoundAuthorization", async () => {
    const binding = makeScopeBinding();
    await store.appendAuthorization(
      makeAuthorization({ decision: "DENIED" }, binding),
    );
    const found = await store.findBoundAuthorization({
      missionId: "mission-close-001",
      scopeHash: binding.scopeHash,
      actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
      actorId: "alice",
    });
    expect(found).toBeUndefined();
  });

  it("invalidates prior authorization when any scope element changes (REQ-SCOPE-006; SC-SCOPE-005)", async () => {
    const bindingA = makeScopeBinding();
    await store.appendAuthorization(makeAuthorization({}, bindingA));

    const bindingB = makeScopeBinding({ fiscalPeriod: "202608" });
    expect(bindingB.scopeHash).not.toBe(bindingA.scopeHash);

    const found = await store.findBoundAuthorization({
      missionId: "mission-close-001",
      scopeHash: bindingB.scopeHash,
      actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
      actorId: "alice",
    });
    expect(found).toBeUndefined();

    // Old records remain immutable history.
    const history = await store.listAuthorizations("mission-close-001");
    expect(history).toHaveLength(1);
    expect(history[0]?.scopeHash).toBe(bindingA.scopeHash);
  });

  it("rejects mission ids that could become raw paths", async () => {
    const binding = makeScopeBinding();
    await expect(
      store.appendAuthorization(makeAuthorization({ missionId: "../../escape" }, binding)),
    ).rejects.toThrow(/identifier/i);
    await expect(store.listAuthorizations("../etc")).rejects.toThrow(/identifier/i);
    await expect(
      store.findBoundAuthorization({
        missionId: "a/b",
        scopeHash: binding.scopeHash,
        actionFamily: ACTION_FAMILY.EXECUTE_TARGET,
        actorId: "alice",
      }),
    ).rejects.toThrow(/identifier/i);
  });

  it("rejects malformed records (bad scope hash, mode, family, decision, dates)", async () => {
    const binding = makeScopeBinding();
    const base = makeAuthorization({}, binding);
    await expect(
      store.appendAuthorization({ ...base, scopeHash: "not-a-digest" }),
    ).rejects.toThrow(/scope hash/i);
    await expect(
      store.appendAuthorization({ ...base, authorityMode: "SUDO" as never }),
    ).rejects.toThrow(/authority mode/i);
    await expect(
      store.appendAuthorization({ ...base, actionFamily: "DELETE" as never }),
    ).rejects.toThrow(/action family/i);
    await expect(
      store.appendAuthorization({ ...base, decision: "MAYBE" as never }),
    ).rejects.toThrow(/decision/i);
    await expect(
      store.appendAuthorization({ ...base, issuedAt: "not-a-date" }),
    ).rejects.toThrow(/issuedAt/i);
    await expect(
      store.appendAuthorization({
        ...base,
        issuedAt: "2026-07-01T00:00:00.000Z",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(/expiresAt/i);
    await expect(
      store.appendAuthorization({ ...base, actorId: "" }),
    ).rejects.toThrow(/actor/i);
  });

  it("fails closed on a malformed or truncated log line", async () => {
    const binding = makeScopeBinding();
    const record = makeAuthorization({}, binding);
    await store.appendAuthorization(record);
    const path = logPath(record.missionId);
    writeFileSync(path, `${readFileSync(path, "utf8")}{"truncated":\n`, "utf8");

    await expect(store.listAuthorizations(record.missionId)).rejects.toThrow(
      /corrupt|malformed|truncated/i,
    );
  });
});
