// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// FAIL-CLOSED MATRIX for the runtime doctor, against a fixture fake runtime
// created in the OS temp dir per test and cleaned up in teardown.

import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctor } from "../runtime/doctor.js";
import { createPin } from "../runtime/pin.js";
import {
  cleanupFakeRuntime,
  createFakeRuntime,
  type FakeRuntime,
} from "./helpers/fixture-runtime.js";

const EXACT_VERSION = "0.4.0";

describe("doctor — fail-closed matrix", () => {
  let fixture: FakeRuntime | undefined;

  afterEach(() => {
    if (fixture !== undefined) {
      cleanupFakeRuntime(fixture.root);
      fixture = undefined;
    }
  });

  it("verified: correct file + correct checksum + correct version", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("verified");
    expect(report.pinState).toBe("released");
    expect(report.resolvedPath).toBe(fixture.runtimeDir);
    expect(report.version).toBe(EXACT_VERSION);
    expect(report.versionMatches).toBe(true);
    expect(report.checksumMatches).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("missing: no package-local runtime → fail closed", async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "drenyra-pi-doctor-empty-"));
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "a".repeat(64),
      });
      const report = await doctor({ pin, packageRoot: emptyRoot });

      expect(report.verdict).toBe("missing");
      expect(report.resolvedPath).toBeUndefined();
      expect(report.versionMatches).toBe(false);
      expect(report.checksumMatches).toBe(false);
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues.join("\n")).toContain("not found package-local");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("checksum-mismatch: digest differs from the pin → fail closed", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const pin = createPin({
      state: "released",
      checksumSha256: "0".repeat(64),
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("checksum-mismatch");
    expect(report.versionMatches).toBe(true);
    expect(report.checksumMatches).toBe(false);
    expect(
      report.issues.some((issue) => issue.includes("Checksum mismatch")),
    ).toBe(true);
  });

  it("checksum-mismatch: tampered artifact content is detected", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    writeFileSync(fixture.artifactPath, 'export const runtime = "tampered";\n');
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("checksum-mismatch");
    expect(report.checksumMatches).toBe(false);
  });

  it("version-mismatch: resolved runtime reports a different version → fail closed", async () => {
    fixture = await createFakeRuntime({ version: "0.2.0" });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("version-mismatch");
    expect(report.version).toBe("0.2.0");
    expect(report.versionMatches).toBe(false);
    expect(
      report.issues.some((issue) => issue.includes("version mismatch")),
    ).toBe(true);
  });

  it("fail-closed ordering: version mismatch wins when both version and checksum mismatch", async () => {
    fixture = await createFakeRuntime({ version: "0.2.0" });
    const pin = createPin({
      state: "released",
      checksumSha256: "0".repeat(64),
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("version-mismatch");
  });

  it("pending-release: NEVER verified, even with a perfect runtime installed", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    const report = await doctor({
      pin: createPin(),
      packageRoot: fixture.root,
    });

    expect(report.verdict).toBe("pending-release");
    expect(report.pinState).toBe("pending-release");
    expect(report.resolvedPath).toBeUndefined();
    expect(report.versionMatches).toBe(false);
    expect(report.checksumMatches).toBe(false);
    expect(
      report.issues.some((issue) => issue.includes("pending-release")),
    ).toBe(true);
  });

  it("missing: runtime dir exists but package.json is not readable → fail closed", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    rmSync(join(fixture.runtimeDir, "package.json"));
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("missing");
    expect(report.resolvedPath).toBe(fixture.runtimeDir);
  });

  it("checksum-mismatch: entry artifact missing → fail closed", async () => {
    fixture = await createFakeRuntime({ version: EXACT_VERSION });
    rmSync(fixture.artifactPath);
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("checksum-mismatch");
    expect(report.checksumMatches).toBe(false);
    expect(
      report.issues.some((issue) => issue.includes("Could not read artifact")),
    ).toBe(true);
  });

  it("verified: runtime installed under the runtime/ override dir is resolved and verified", async () => {
    fixture = await createFakeRuntime({
      version: EXACT_VERSION,
      installUnder: "runtime",
    });
    const pin = createPin({
      state: "released",
      checksumSha256: fixture.artifactChecksum,
    });
    const report = await doctor({ pin, packageRoot: fixture.root });

    expect(report.verdict).toBe("verified");
    expect(report.resolvedPath).toBe(fixture.runtimeDir);
  });
});
