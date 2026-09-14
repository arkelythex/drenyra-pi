// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver-like, checksums
// are lowercase hex sha256, and exit/status codes are JSON integers — never
// floats. Fail-closed lifecycle tests for the drenyra-engram MCP child
// process (contracts/engram-dependency.md, design.md §6).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnEngramClient } from "../runtime/engram-client.js";

const REAL_VENDORED_ROOT = join(process.cwd(), "vendored", "drenyra-engram");

describe("spawnEngramClient", () => {
  let dbDir: string;

  beforeEach(() => {
    dbDir = mkdtempSync(join(tmpdir(), "pi-engram-client-"));
  });

  afterEach(() => {
    rmSync(dbDir, { recursive: true, force: true });
  });

  it("reports verification-failed without attempting to spawn when the pin is missing", async () => {
    const emptyVendoredRoot = mkdtempSync(join(tmpdir(), "pi-engram-empty-"));
    try {
      const result = await spawnEngramClient({
        vendoredRoot: emptyVendoredRoot,
        platform: "linux",
        arch: "x64",
        dbPath: join(dbDir, "engram.db"),
      });
      expect(result.status).toBe("verification-failed");
      if (result.status === "verification-failed") {
        expect(result.report.verdict).toBe("missing-artifact");
      }
    } finally {
      rmSync(emptyVendoredRoot, { recursive: true, force: true });
    }
  });

  it("reports verification-failed on an unsupported platform, never attempting to spawn", async () => {
    const result = await spawnEngramClient({
      vendoredRoot: REAL_VENDORED_ROOT,
      platform: "win32",
      arch: "x64",
      dbPath: join(dbDir, "engram.db"),
    });
    expect(result.status).toBe("verification-failed");
    if (result.status === "verification-failed") {
      expect(result.report.verdict).toBe("unsupported-platform");
    }
  });

  it("spawns, completes the MCP initialize handshake, and reports healthy for the real vendored binary", async () => {
    const result = await spawnEngramClient({
      vendoredRoot: REAL_VENDORED_ROOT,
      platform: process.platform,
      arch: process.arch,
      dbPath: join(dbDir, "engram.db"),
      handshakeTimeoutMs: 4000,
    });
    expect(result.status).toBe("healthy");
    if (result.status !== "healthy") return;
    expect(result.client.isHealthy()).toBe(true);
    expect(result.client.serverInfo.name).toBe("drenyra-engram");
    await result.client.shutdown();
  }, 10000);

  it("calls a read-only tool and returns its parsed content", async () => {
    const result = await spawnEngramClient({
      vendoredRoot: REAL_VENDORED_ROOT,
      platform: process.platform,
      arch: process.arch,
      dbPath: join(dbDir, "engram.db"),
      handshakeTimeoutMs: 4000,
    });
    expect(result.status).toBe("healthy");
    if (result.status !== "healthy") return;
    try {
      const outcome = await result.client.callTool("engram_context", {
        scope: {
          kind: "company",
          organizationId: "firm-1",
          companyId: "20100039201",
          ruc: "20100039201",
        },
      });
      expect(outcome.isError).toBe(false);
      expect(typeof outcome.text).toBe("string");
      expect(() => JSON.parse(outcome.text)).not.toThrow();
    } finally {
      await result.client.shutdown();
    }
  }, 10000);

  it("terminates the child process on shutdown — no orphan remains", async () => {
    const result = await spawnEngramClient({
      vendoredRoot: REAL_VENDORED_ROOT,
      platform: process.platform,
      arch: process.arch,
      dbPath: join(dbDir, "engram.db"),
      handshakeTimeoutMs: 4000,
    });
    expect(result.status).toBe("healthy");
    if (result.status !== "healthy") return;
    const pid = result.client.pid;
    await result.client.shutdown();
    expect(() => process.kill(pid, 0)).toThrow();
  }, 10000);

  it("reports unhealthy and rejects a call after the child is killed externally mid-session", async () => {
    const result = await spawnEngramClient({
      vendoredRoot: REAL_VENDORED_ROOT,
      platform: process.platform,
      arch: process.arch,
      dbPath: join(dbDir, "engram.db"),
      handshakeTimeoutMs: 4000,
    });
    expect(result.status).toBe("healthy");
    if (result.status !== "healthy") return;

    process.kill(result.client.pid, "SIGKILL");
    // Give the child process's "exit" event a moment to propagate.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(result.client.isHealthy()).toBe(false);
    await expect(
      result.client.callTool("engram_context", {
        scope: { kind: "company", organizationId: "firm-1", ruc: "20100039201" },
      }),
    ).rejects.toThrow(/not healthy/i);
  }, 10000);
});
