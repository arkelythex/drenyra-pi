/**
 * Startup-panel tests (T-S4A-003) — activation banner (design §10.2).
 *
 * `showStartupPanel({writeLine, packageRoot, contextStore})` prints one concise
 * banner with the pinned-runtime verdict and the default context's scope
 * completeness through the injected writeLine. A banner failure renders degraded
 * status and grants no mission capability. The default extension factory is
 * async: it registers commands first, then emits the banner. No unverified
 * `ctx.ui` dependency is used — the verified Pi ExtensionAPI slice exposes
 * `registerCommand` + command-time `cwd` only, so the banner degrades to a
 * printed line.
 *
 * Fiscal convention: monetary values are BigInt cents; digests are lowercase
 * hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScopeContextStore } from "../runtime/context.js";
import { showStartupPanel, type StartupPanelResult } from "../extensions/startup-panel.js";
import type { PiExtensionApi } from "../extensions/register.js";
import { makeCanonicalScope } from "./helpers/authority-fixtures.js";

function makeDeps(writeLine: (line: string) => void = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-startup-panel-"));
  const contextStore = new ScopeContextStore(join(dir, "context.json"));
  return {
    deps: { writeLine, packageRoot: process.cwd(), contextStore } as const,
    dir,
    store: contextStore,
  };
}

describe("showStartupPanel", () => {
  it("prints one concise banner with the runtime verdict and scope completeness", async () => {
    const lines: string[] = [];
    const { deps, dir } = makeDeps((line) => lines.push(line));
    try {
      const result = await showStartupPanel(deps);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const banner = lines[0];
      expect(banner).toContain("drenyra-pi");
      expect(banner).toContain("runtime");
      expect(banner).toContain("verified");
      expect(banner).toContain("incomplete");
      expect(banner).toContain("missing");
      expect(result.degraded).toBe(false);
      expect(result.runtimeVerdict).toBe("verified");
      expect(result.scopeComplete).toBe(false);
      expect(result.missing).toHaveLength(10);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a complete scope once the full canonical scope is bound", async () => {
    const lines: string[] = [];
    const { deps, dir, store } = makeDeps((line) => lines.push(line));
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const result: StartupPanelResult = await showStartupPanel(deps);
      expect(result.scopeComplete).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(lines[0]).toContain("complete");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("degrades without throwing and grants no mission capability when writeLine fails", async () => {
    const { deps, dir } = makeDeps(() => {
      throw new Error("banner sink unavailable");
    });
    try {
      const result = await showStartupPanel(deps);
      expect(result.degraded).toBe(true);
      expect(result.runtimeVerdict).toBe("banner-failed");
      // Degraded status never grants mission capability (design §10.2).
      expect(result.capabilityGranted).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("default extension factory (async activation)", () => {
  it("registers commands first, then emits the startup banner", async () => {
    const { default: drenyraPi } = await import("../extensions/register.js");
    const registered: string[] = [];
    const pi: PiExtensionApi = {
      registerCommand(name, options) {
        registered.push(name);
        void options;
      },
    };
    let output = "";
    const originalLog = console.log;
    console.log = (line: unknown) => {
      output += `${String(line)}\n`;
    };
    try {
      const pending = drenyraPi(pi, {
        writeLine: (line) => {
          output += `${line}\n`;
        },
        packageRoot: process.cwd(),
        contextStore: new ScopeContextStore(
          join(mkdtempSync(join(tmpdir(), "drenyra-factory-")), "context.json"),
        ),
      });
      expect(typeof pending?.then).toBe("function");
      await pending;
    } finally {
      console.log = originalLog;
    }
    expect(registered).toContain("drenyra:status");
    expect(registered).toContain("drenyra:capabilities");
    expect(output).toContain("drenyra-pi");
    expect(output).toContain("runtime");
  });
});
