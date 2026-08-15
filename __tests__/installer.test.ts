// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Postinstall installer tests: the pending-release path is LIVE today; the
// released branch is exercised only through injected fixtures until the first
// real drenyra-ai release.

import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPin } from "../runtime/pin.js";
import {
  decideInstall,
  runInstaller,
  type InstallerDeps,
} from "../runtime/installer.js";

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), "drenyra-pi-installer-"));
}

describe("decideInstall", () => {
  it("pending-release: nothing to install, notice names the pin", () => {
    const decision = decideInstall(createPin());
    expect(decision.kind).toBe("pending-release");
    if (decision.kind === "pending-release") {
      expect(decision.notice).toContain("pending-release");
      expect(decision.notice).toContain("drenyra-ai@0.4.0");
    }
  });

  it("released: install the exact pinned version, never a range", () => {
    const pin = createPin({
      state: "released",
      checksumSha256: "a".repeat(64),
    });
    const decision = decideInstall(pin);
    expect(decision.kind).toBe("released");
    if (decision.kind === "released") {
      expect(decision.packageName).toBe("drenyra-ai");
      expect(decision.version).toBe("0.4.0");
      expect(decision.installUrl).toBe(
        "https://github.com/arkelythex/drenyra-ai/releases/download/v0.4.0/drenyra-ai-0.4.0.tgz",
      );
    }
  });
});

describe("runInstaller", () => {
  it("pending-release: prints a clear notice and exits 0 without touching npm", async () => {
    const root = makeRoot();
    try {
      const result = await runInstaller({
        pin: createPin(),
        packageRoot: root,
      });
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain("pending-release");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("released + doctor verified: exits 0", async () => {
    const root = makeRoot();
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "b".repeat(64),
      });
      const deps: InstallerDeps = {
        install: async () => undefined,
        verify: async () => ({
          pinState: "released",
          versionMatches: true,
          checksumMatches: true,
          verdict: "verified",
          issues: [],
        }),
      };
      const result = await runInstaller({ pin, packageRoot: root, deps });
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain("verified");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("released + npm install failure: exits 1 with the npm error", async () => {
    const root = makeRoot();
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "c".repeat(64),
      });
      const deps: InstallerDeps = {
        install: async () => {
          throw new Error("npm error: 404 Not Found");
        },
      };
      const result = await runInstaller({ pin, packageRoot: root, deps });
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain("404 Not Found");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("released + doctor not verified: exits 1 listing the doctor issues", async () => {
    const root = makeRoot();
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "d".repeat(64),
      });
      const deps: InstallerDeps = {
        install: async () => undefined,
        verify: async () => ({
          pinState: "released",
          versionMatches: false,
          checksumMatches: false,
          verdict: "checksum-mismatch",
          issues: ["Checksum mismatch for /tmp/fake-runtime/index.mjs"],
        }),
      };
      const result = await runInstaller({ pin, packageRoot: root, deps });
      expect(result.exitCode).toBe(1);
      expect(result.message).toContain("checksum-mismatch");
      expect(result.message).toContain("Checksum mismatch");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("released with a vendored tarball: installs from the vendored path", async () => {
    const root = makeRoot();
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "e".repeat(64),
      });
      mkdirSync(join(root, "vendored"), { recursive: true });
      writeFileSync(join(root, "vendored", "drenyra-ai-0.4.0.tgz"), "fake-tgz");
      let receivedSource: string | undefined;
      const deps: InstallerDeps = {
        install: async (_root, source) => {
          receivedSource = source;
        },
        verify: async () => ({
          pinState: "released",
          versionMatches: true,
          checksumMatches: true,
          verdict: "verified",
          issues: [],
        }),
      };
      const result = await runInstaller({ pin, packageRoot: root, deps });
      expect(result.exitCode).toBe(0);
      expect(receivedSource).toBe(
        join(root, "vendored", "drenyra-ai-0.4.0.tgz"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("released without a vendored tarball: installs from the release URL", async () => {
    const root = makeRoot();
    try {
      const pin = createPin({
        state: "released",
        checksumSha256: "f".repeat(64),
      });
      let receivedSource: string | undefined;
      const deps: InstallerDeps = {
        install: async (_root, source) => {
          receivedSource = source;
        },
        verify: async () => ({
          pinState: "released",
          versionMatches: true,
          checksumMatches: true,
          verdict: "verified",
          issues: [],
        }),
      };
      const result = await runInstaller({ pin, packageRoot: root, deps });
      expect(result.exitCode).toBe(0);
      expect(receivedSource).toBe(
        "https://github.com/arkelythex/drenyra-ai/releases/download/v0.4.0/drenyra-ai-0.4.0.tgz",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
