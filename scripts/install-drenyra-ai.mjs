/**
 * drenyra-pi postinstall entry.
 *
 * Thin wrapper around runtime/installer.ts (compiled to dist/runtime/installer.js):
 * resolves the package root from its own location, runs the installer against
 * the DEFAULT_PIN, prints the outcome, and propagates the exit code.
 *
 * scripts/build.mjs copies this file to dist/scripts/install-drenyra-ai.js — the
 * copied file is what the published package's postinstall runs. The relative
 * import ../runtime/installer.js resolves to the compiled installer from both
 * locations (scripts/ and dist/scripts/).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; version/checksum/exit codes are JSON integers
 * or hex strings, never floats.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { runInstaller, DEFAULT_PIN } = await import(
  pathToFileURL(join(here, "..", "runtime", "installer.js")).href
);

/**
 * Walk up from this module's location to the first package.json named
 * "drenyra-pi". Correct from both scripts/ (dev) and dist/scripts/ (packed).
 */
function findPackageRoot(fromDir) {
  let dir = fromDir;
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (manifest.name === "drenyra-pi") return dir;
    } catch {
      // not this directory — keep walking up
    }
    dir = dirname(dir);
  }
  throw new Error(`drenyra-pi: package root not found above ${fromDir}`);
}

const result = await runInstaller({ pin: DEFAULT_PIN, packageRoot: findPackageRoot(here) });
console.log(result.message);
process.exit(result.exitCode);
