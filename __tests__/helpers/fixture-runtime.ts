// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Test fixture: a fake drenyra-ai runtime created under the OS temp dir and
// removed in teardown. No money logic here.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256File } from "../../runtime/checksum.js";

export interface FakeRuntime {
  /** Package root passed to doctor/status/resolve as `packageRoot`. */
  root: string;
  /** The resolved runtime directory (<root>/node_modules|runtime/drenyra-ai). */
  runtimeDir: string;
  /** The entry artifact whose sha256 is the fixture checksum. */
  artifactPath: string;
  /** Lowercase hex sha256 of the artifact with the original content. */
  artifactChecksum: string;
}

export interface FakeRuntimeOptions {
  version?: string;
  artifactContent?: string;
  /** Where to install the fake runtime: node_modules (default) or runtime/. */
  installUnder?: "node_modules" | "runtime";
  /** Emit a "main" entry in package.json (default true). */
  withMain?: boolean;
}

const DEFAULT_ARTIFACT = 'export const runtime = "drenyra-ai-fixture";\n';

export async function createFakeRuntime(
  options: FakeRuntimeOptions = {},
): Promise<FakeRuntime> {
  const root = mkdtempSync(join(tmpdir(), "drenyra-pi-fixture-"));
  const installUnder = options.installUnder ?? "node_modules";
  const runtimeDir = join(root, installUnder, "drenyra-ai");
  mkdirSync(runtimeDir, { recursive: true });

  const version = options.version ?? "0.2.0";
  const manifest: Record<string, unknown> = {
    name: "drenyra-ai",
    version,
  };
  if (options.withMain !== false) manifest.main = "./index.mjs";
  writeFileSync(
    join(runtimeDir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const artifactPath = join(runtimeDir, "index.mjs");
  writeFileSync(artifactPath, options.artifactContent ?? DEFAULT_ARTIFACT);

  const artifactChecksum = await sha256File(artifactPath);
  return { root, runtimeDir, artifactPath, artifactChecksum };
}

export function cleanupFakeRuntime(root: string): void {
  rmSync(root, { recursive: true, force: true });
}
