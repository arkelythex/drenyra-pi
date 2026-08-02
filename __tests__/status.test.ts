// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Status shape tests: one-line summary, multi-line human status, and the
// machine report reuses doctor() — a single verification path.

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPin } from "../runtime/pin.js";
import { status } from "../runtime/status.js";
import {
  cleanupFakeRuntime,
  createFakeRuntime,
  type FakeRuntime,
} from "./helpers/fixture-runtime.js";

const EXACT_VERSION = "0.1.0";

describe("status", () => {
  let fixture: FakeRuntime | undefined;

  afterEach(() => {
    if (fixture !== undefined) {
      cleanupFakeRuntime(fixture.root);
      fixture = undefined;
    }
  });

  it("verified: one-line summary + multi-line human + machine report", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const result = await status({ pin, packageRoot: fixture.root });

    expect(result.summary.split("\n")).toHaveLength(1);
    expect(result.summary).toContain("verified");
    expect(result.human).toContain("Runtime status: verified");
    expect(result.human).toContain(fixture.runtimeDir);
    expect(result.machine.verdict).toBe("verified");
  });

  it("machine report is the doctor report (single verification path)", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const result = await status({ pin, packageRoot: fixture.root });

    expect(result.machine.verdict).toBe("verified");
    expect(result.machine.versionMatches).toBe(true);
    expect(result.machine.checksumMatches).toBe(true);
    expect(result.machine.resolvedPath).toBe(fixture.runtimeDir);
  });

  it("pending-release: summary and human both surface the fail-closed state", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const result = await status({ pin: createPin(), packageRoot: fixture.root });

    expect(result.summary).toContain("pending-release");
    expect(result.summary.split("\n")).toHaveLength(1);
    expect(result.human).toContain("pending-release");
    expect(result.machine.verdict).toBe("pending-release");
    expect(result.machine.resolvedPath).toBeUndefined();
  });

  it("missing: summary mentions the missing runtime", async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "drenyra-pi-status-empty-"));
    try {
      const pin = createPin({ state: "released", checksumSha256: "a".repeat(64) });
      const result = await status({ pin, packageRoot: emptyRoot });

      expect(result.summary).toContain("missing");
      expect(result.summary.split("\n")).toHaveLength(1);
      expect(result.machine.verdict).toBe("missing");
      expect(result.human).toContain("Resolved path: none");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("machine report is JSON-serializable (JSON integers, never floats)", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const result = await status({ pin, packageRoot: fixture.root });

    const roundTripped = JSON.parse(JSON.stringify(result.machine)) as {
      verdict: string;
      pinState: string;
    };
    expect(roundTripped.verdict).toBe("verified");
    expect(roundTripped.pinState).toBe("released");
  });
});
