// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module resolves the pinned runtime path; it holds no money logic.

import { statSync } from "node:fs";
import { join } from "node:path";

/**
 * Package-local runtime resolution.
 *
 * Package-local rule (contracts/runtime-dependency.md):
 *   The runtime lives inside Drenyra Pi's own package tree — never an ambient
 *   binary. Resolution consults ONLY:
 *
 *     1. <packageRoot>/runtime/<packageName>       (installed runtime override)
 *     2. <packageRoot>/node_modules/<packageName>  (package-local install)
 *
 * It NEVER consults PATH, `which`, shell lookup, or any environment variable.
 * Ambient `drenyra-ai` binaries are not trusted for fiscal operations.
 *
 * Returns the resolved directory, or undefined when no package-local runtime
 * exists — the caller (doctor) fails closed on undefined.
 */
export function resolvePackageLocal(
  packageRoot: string,
  packageName: string,
): string | undefined {
  const runtimeOverride = join(packageRoot, "runtime", packageName);
  if (isDirectory(runtimeOverride)) return runtimeOverride;

  const nodeModules = join(packageRoot, "node_modules", packageName);
  if (isDirectory(nodeModules)) return nodeModules;

  return undefined;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
