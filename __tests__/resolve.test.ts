// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Package-locality tests: resolution is strictly <packageRoot>/runtime or
// <packageRoot>/node_modules — never PATH, which, or any environment lookup.

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolvePackageLocal } from "../runtime/resolve.js";

describe("resolvePackageLocal — package-locality", () => {
  let root = "";

  afterEach(() => {
    if (root !== "") {
      rmSync(root, { recursive: true, force: true });
      root = "";
    }
  });

  function makeRoot(): string {
    root = mkdtempSync(join(tmpdir(), "drenyra-pi-resolve-"));
    return root;
  }

  it("resolves a runtime placed only under <packageRoot>/node_modules/<package>", () => {
    const packageRoot = makeRoot();
    const runtimeDir = join(packageRoot, "node_modules", "drenyra-ai");
    mkdirSync(runtimeDir, { recursive: true });
    expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBe(runtimeDir);
  });

  it("resolves a runtime under <packageRoot>/runtime/<package> (override dir)", () => {
    const packageRoot = makeRoot();
    const overrideDir = join(packageRoot, "runtime", "drenyra-ai");
    mkdirSync(overrideDir, { recursive: true });
    expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBe(overrideDir);
  });

  it("prefers the runtime/ override when both locations exist", () => {
    const packageRoot = makeRoot();
    const overrideDir = join(packageRoot, "runtime", "drenyra-ai");
    const nodeModulesDir = join(packageRoot, "node_modules", "drenyra-ai");
    mkdirSync(overrideDir, { recursive: true });
    mkdirSync(nodeModulesDir, { recursive: true });
    expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBe(overrideDir);
  });

  it("returns undefined when no package-local runtime exists", () => {
    const packageRoot = makeRoot();
    expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBeUndefined();
  });

  it("never picks up an ambient binary on PATH", () => {
    const packageRoot = makeRoot();
    const binDir = join(packageRoot, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "drenyra-ai"), "#!/bin/sh\necho ambient\n", {
      mode: 0o755,
    });

    const savedPath = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${savedPath ?? ""}`;
    try {
      // The ambient binary IS on the test PATH, but resolution is
      // package-local only — it must not be found.
      expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBeUndefined();
    } finally {
      process.env.PATH = savedPath;
    }
  });

  it("returns undefined for a non-directory entry at the expected path", () => {
    const packageRoot = makeRoot();
    mkdirSync(join(packageRoot, "runtime"), { recursive: true });
    writeFileSync(join(packageRoot, "runtime", "drenyra-ai"), "not a directory");
    expect(resolvePackageLocal(packageRoot, "drenyra-ai")).toBeUndefined();
  });
});
