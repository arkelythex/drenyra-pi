// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Configurator host integration tests (SDD-020 slice 2): Pi consumes the Core
// configurator library (drenyra-ai@0.4.1 public subpath) — these tests lock
// the public-export fix, the drenyra-pi pin record, the fresh-home bootstrap,
// idempotency, and the fail-closed typed outcomes. No money logic here.

import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ASSET_FILENAMES,
  PINNED_AI_COMPOSITION,
  renderPinnedAiRuntime,
} from "drenyra-ai/configurator";
import {
  drenyraPiHostConfigDir,
  runConfiguratorDoctor,
  runConfiguratorInstall,
  runConfiguratorSync,
} from "../lib/configurator.js";

/** Mirrors DRENYRA_PI_VERSION in extensions/register.ts (the harness version). */
const PACKAGED_VERSION = "0.0.1-prealpha.1";

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "pi-configurator-"));
}

function cleanupTempHome(home: string): void {
  rmSync(home, { recursive: true, force: true });
}

describe("drenyra-ai/configurator public surface (0.4.1)", () => {
  it("resolves the public subpath and renders the reviewed drenyra-pi pin record", () => {
    // The subpath import at the top of this file is the regression: it only
    // resolves when the master publishes configurator/ (drenyra-ai@0.4.1).
    const record = JSON.parse(renderPinnedAiRuntime("drenyra-pi")) as {
      kind: string;
      schemaVersion: number;
      host: string;
      runtime: { id: string; version: number };
      model: { id: string; version: number };
      tool: { id: string; version: number };
    };
    expect(record).toEqual({
      kind: "pinned-ai-runtime",
      schemaVersion: 1,
      host: "drenyra-pi",
      runtime: { id: "drenyra-pi", version: 1 },
      model: { id: "drenyra-pi-package-default", version: 1 },
      tool: { id: "drenyra-ai-host-tools", version: 1 },
    });
    expect(PINNED_AI_COMPOSITION["drenyra-pi"].runtime.id).toBe("drenyra-pi");
    expect(PINNED_AI_COMPOSITION["drenyra-pi"].model.id).toBe(
      "drenyra-pi-package-default",
    );
  });
});

describe("drenyraPiHostConfigDir", () => {
  it("derives <home>/.drenyra from the Core HOST_DIR_MAP", () => {
    const home = makeTempHome();
    try {
      expect(drenyraPiHostConfigDir(home)).toBe(join(home, ".drenyra"));
    } finally {
      cleanupTempHome(home);
    }
  });
});

describe("runConfiguratorDoctor", () => {
  it("reports healthy not-applicable diagnostics on a fresh home", () => {
    const home = makeTempHome();
    try {
      const report = runConfiguratorDoctor(home, PACKAGED_VERSION);
      expect(report.ok).toBe(true);
      if (!report.ok) throw new Error("unreachable");
      expect(report.diagnostics.map((d) => d.name)).toEqual([
        "managed-state",
        "managed-drift",
        "package-pin",
        "host-prerequisites",
        "pinned-ai-runtime",
      ]);
      for (const diagnostic of report.diagnostics) {
        expect(diagnostic.ok, diagnostic.name).toBe(true);
      }
      const pinned = report.diagnostics.find(
        (d) => d.name === "pinned-ai-runtime",
      );
      expect(pinned?.ok).toBe(true);
      if (pinned?.name === "pinned-ai-runtime") {
        expect(pinned.detail).toContain("not applicable");
        expect(pinned.applicability).toBe("not-applicable");
        expect(pinned.hosts).toEqual([]);
      }
    } finally {
      cleanupTempHome(home);
    }
  });

  it("reports all-ok configurator diagnostics after install (composition is current-schema)", () => {
    const home = makeTempHome();
    try {
      runConfiguratorInstall(home, PACKAGED_VERSION);
      const report = runConfiguratorDoctor(home, PACKAGED_VERSION);
      expect(report.ok).toBe(true);
      if (!report.ok) throw new Error("unreachable");
      for (const diagnostic of report.diagnostics) {
        expect(diagnostic.ok, diagnostic.name).toBe(true);
      }
      const pinned = report.diagnostics.find(
        (d) => d.name === "pinned-ai-runtime",
      );
      expect(pinned).toEqual(
        expect.objectContaining({
          ok: true,
          applicability: "applicable",
          hosts: [expect.objectContaining({ host: "drenyra-pi", state: "managed" })],
        }),
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("returns failing diagnostics (not a throw) for an invalid managed manifest", () => {
    const home = makeTempHome();
    try {
      const managedDir = join(home, ".drenyra");
      mkdirSync(managedDir, { recursive: true });
      writeFileSync(join(managedDir, "managed.json"), "{ not json");
      const report = runConfiguratorDoctor(home, PACKAGED_VERSION);
      expect(report.ok).toBe(true);
      if (!report.ok) throw new Error("unreachable");
      expect(
        report.diagnostics.find((d) => d.name === "managed-state")?.ok,
      ).toBe(false);
    } finally {
      cleanupTempHome(home);
    }
  });
});

describe("runConfiguratorInstall / runConfiguratorSync", () => {
  it("bootstraps the drenyra-pi managed composition + pin asset on a fresh home", () => {
    const home = makeTempHome();
    try {
      const outcome = runConfiguratorInstall(home, PACKAGED_VERSION);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("unreachable");
      expect(outcome.status).toBe("upgraded");
      expect(outcome.from).toBe("absent");
      expect(outcome.to).toBe(PACKAGED_VERSION);
      expect(outcome.manifestPath.endsWith("managed.json")).toBe(true);
      expect(outcome.manifestPath).toBe(join(home, ".drenyra", "managed.json"));
      expect(existsSync(outcome.manifestPath)).toBe(true);
      // The manifest classifies as current-schema: a second call is unchanged
      // (exercised below), which proves readManagedState accepts the bytes.
      const pinPath = join(home, ".drenyra", ASSET_FILENAMES.pin);
      expect(existsSync(pinPath)).toBe(true);
      expect(readFileSync(pinPath, "utf8")).toBe(renderPinnedAiRuntime("drenyra-pi"));
      expect(JSON.parse(readFileSync(pinPath, "utf8"))).toEqual(
        JSON.parse(renderPinnedAiRuntime("drenyra-pi")),
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("is idempotent: a second install and a sync report unchanged with zero writes", () => {
    const home = makeTempHome();
    try {
      const first = runConfiguratorInstall(home, PACKAGED_VERSION);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error("unreachable");
      expect(first.status).toBe("upgraded");

      const second = runConfiguratorInstall(home, PACKAGED_VERSION);
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error("unreachable");
      expect(second.status).toBe("unchanged");
      expect(second.results).toEqual([]);
      expect(second.from).toBe(PACKAGED_VERSION);
      expect(second.to).toBe(PACKAGED_VERSION);

      const sync = runConfiguratorSync(home, PACKAGED_VERSION);
      expect(sync.ok).toBe(true);
      if (!sync.ok) throw new Error("unreachable");
      expect(sync.status).toBe("unchanged");
      expect(sync.results).toEqual([]);
    } finally {
      cleanupTempHome(home);
    }
  });

  it("fails closed with a typed reason when the home path is a file (never throws)", () => {
    const home = makeTempHome();
    const filePath = join(home, "not-a-home");
    writeFileSync(filePath, "x");
    try {
      // Doctor: observed Core behavior (probe against drenyra-ai@0.4.1) — a
      // file path reads as an absent home, so runConfigDiagnostics reports
      // healthy not-applicable diagnostics instead of throwing.
      const doctor = runConfiguratorDoctor(filePath, PACKAGED_VERSION);
      expect(doctor.ok).toBe(true);
      if (!doctor.ok) throw new Error("unreachable");
      expect(doctor.diagnostics.every((d) => d.ok)).toBe(true);
      expect(doctor.diagnostics.map((d) => d.name)).toContain("pinned-ai-runtime");

      // Install/sync: absent state cannot be bootstrapped over a file path
      // (the managed dir cannot be created), so the wrapper maps the failure
      // to a typed ok:false — the caller never sees a throw.
      const install = runConfiguratorInstall(filePath, PACKAGED_VERSION);
      expect(install.ok).toBe(false);
      if (install.ok) throw new Error("unreachable");
      expect(install.reason.kind).toBe("MANAGED_STATE_UNKNOWN");
      expect(install.reason.message.length).toBeGreaterThan(0);

      const sync = runConfiguratorSync(filePath, PACKAGED_VERSION);
      expect(sync.ok).toBe(false);
      if (sync.ok) throw new Error("unreachable");
      expect(sync.reason.kind).toBe("MANAGED_STATE_UNKNOWN");
    } finally {
      cleanupTempHome(home);
    }
  });

  it("fails closed on an invalid managed manifest without touching it", () => {
    const home = makeTempHome();
    try {
      const managedDir = join(home, ".drenyra");
      mkdirSync(managedDir, { recursive: true });
      const manifestPath = join(managedDir, "managed.json");
      writeFileSync(manifestPath, "{ not json");

      const install = runConfiguratorInstall(home, PACKAGED_VERSION);
      expect(install.ok).toBe(false);
      if (install.ok) throw new Error("unreachable");
      expect(install.reason.kind).toBe("MANAGED_STATE_UNKNOWN");

      const sync = runConfiguratorSync(home, PACKAGED_VERSION);
      expect(sync.ok).toBe(false);
      if (sync.ok) throw new Error("unreachable");
      expect(sync.reason.kind).toBe("MANAGED_STATE_UNKNOWN");

      // Fail-closed: the invalid manifest bytes were never replaced.
      expect(readFileSync(manifestPath, "utf8")).toBe("{ not json");
    } finally {
      cleanupTempHome(home);
    }
  });
});
