// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver-like, checksums
// are lowercase hex sha256, and exit/status codes are JSON integers — never
// floats. Fail-closed verification tests for the vendored drenyra-engram
// binary pin (contracts/engram-dependency.md).

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ENGRAM_PIN_BUILD,
  ENGRAM_PIN_CHECKSUMS,
  resolveEngramPlatformKey,
  verifyEngramPin,
} from "../runtime/engram-pin.js";

describe("resolveEngramPlatformKey", () => {
  it("maps supported platform+arch combinations to a pin key", () => {
    expect(resolveEngramPlatformKey("linux", "x64")).toBe("linux_amd64");
    expect(resolveEngramPlatformKey("linux", "arm64")).toBe("linux_arm64");
    expect(resolveEngramPlatformKey("darwin", "x64")).toBe("darwin_amd64");
    expect(resolveEngramPlatformKey("darwin", "arm64")).toBe("darwin_arm64");
  });

  it("returns undefined for win32 (disclosed unsupported platform)", () => {
    expect(resolveEngramPlatformKey("win32", "x64")).toBeUndefined();
  });

  it("returns undefined for an unrecognized arch on a supported platform", () => {
    expect(resolveEngramPlatformKey("linux", "ia32")).toBeUndefined();
  });
});

describe("verifyEngramPin", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pi-engram-pin-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed with an unsupported-platform verdict on win32", async () => {
    const report = await verifyEngramPin({
      vendoredRoot: dir,
      platform: "win32",
      arch: "x64",
    });
    expect(report.verdict).toBe("unsupported-platform");
    expect(report.issues.join(" ")).toMatch(/win32/i);
  });

  it("fails closed with a missing-artifact verdict when the vendored tarball is absent", async () => {
    const report = await verifyEngramPin({
      vendoredRoot: dir,
      platform: "linux",
      arch: "x64",
    });
    expect(report.verdict).toBe("missing-artifact");
    expect(report.issues.join(" ")).toMatch(/linux_amd64/);
  });

  it("fails closed with a checksum-mismatch verdict when the vendored tarball's bytes are wrong", async () => {
    const platformKey = "linux_amd64" as const;
    const expected = ENGRAM_PIN_CHECKSUMS[platformKey];
    const artifactName = `drenyra-engram-${ENGRAM_PIN_BUILD}-${platformKey}.tar.gz`;
    writeFileSync(join(dir, artifactName), "not the real binary");

    const report = await verifyEngramPin({
      vendoredRoot: dir,
      platform: "linux",
      arch: "x64",
    });
    expect(report.verdict).toBe("checksum-mismatch");
    expect(report.issues.join(" ")).toContain(expected.slice(0, 8));
  });

  it("fails closed without throwing when the artifact path is a directory, not a file", async () => {
    // A genuinely distinct failure mode from "missing" or "wrong bytes": the
    // path exists (existsSync passes) but reading it as a file errors inside
    // sha256File's stream — this exercises that catch branch, not a checksum
    // string comparison. (A checksum-matching-but-corrupted-gzip case is a
    // logical impossibility for sha256: if the bytes hash to the pinned
    // value they are byte-identical to the pinned, valid artifact.)
    const platformKey = "linux_amd64" as const;
    const artifactName = `drenyra-engram-${ENGRAM_PIN_BUILD}-${platformKey}.tar.gz`;
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, artifactName));

    const report = await verifyEngramPin({
      vendoredRoot: dir,
      platform: "linux",
      arch: "x64",
    });
    expect(report.verdict).toBe("checksum-mismatch");
    expect(report.issues.join(" ")).toMatch(/failed to read/i);
  });

  it("verifies when the vendored tarball's checksum matches the pin", async () => {
    const platformKey = "linux_amd64" as const;
    const artifactName = `drenyra-engram-${ENGRAM_PIN_BUILD}-${platformKey}.tar.gz`;
    // Reuse the real vendored artifact shipped by this repository so this
    // test proves the real pinned bytes verify, not a synthetic fixture.
    const { readFileSync } = await import("node:fs");
    const real = readFileSync(
      join(process.cwd(), "vendored", "drenyra-engram", artifactName),
    );
    writeFileSync(join(dir, artifactName), real);

    const report = await verifyEngramPin({
      vendoredRoot: dir,
      platform: "linux",
      arch: "x64",
    });
    expect(report.verdict).toBe("verified");
    expect(report.issues).toEqual([]);
    expect(report.resolvedPath).toBe(join(dir, artifactName));
  });
});
