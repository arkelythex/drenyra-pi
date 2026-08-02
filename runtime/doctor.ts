// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module verifies the pinned runtime; it holds no money logic.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256File } from "./checksum.js";
import { PENDING_CHECKSUM, type PinState, type RuntimePin } from "./pin.js";
import { resolvePackageLocal } from "./resolve.js";

export type DoctorVerdict =
  | "verified"
  | "missing"
  | "pending-release"
  | "version-mismatch"
  | "checksum-mismatch";

export interface DoctorReport {
  pinState: PinState;
  /** Resolved package-local runtime directory, when one exists. */
  resolvedPath?: string;
  /** Version read from the resolved runtime's own package.json, when readable. */
  version?: string;
  versionMatches: boolean;
  checksumMatches: boolean;
  verdict: DoctorVerdict;
  /** Human-readable issues; empty when verdict is "verified". */
  issues: string[];
}

export interface DoctorInput {
  pin: RuntimePin;
  /** Drenyra Pi package root — resolution is always package-local. */
  packageRoot: string;
}

const PACKAGE_JSON = "package.json";

/**
 * Fail-closed runtime doctor.
 *
 * Rules (contracts/runtime-dependency.md):
 *   - pending-release pin  → "pending-release" (NEVER "verified", even if a
 *     perfect runtime is installed — the artifact has not been published).
 *   - no package-local path → "missing" (PATH/ambient binaries are ignored).
 *   - resolved runtime's own version mismatch → "version-mismatch".
 *   - artifact checksum mismatch → "checksum-mismatch" (possible tampering).
 *   - all checks pass       → "verified".
 *
 * When both version and checksum mismatch, "version-mismatch" wins: the pin's
 * version is the primary identity of the runtime.
 */
export async function doctor({ pin, packageRoot }: DoctorInput): Promise<DoctorReport> {
  const issues: string[] = [];

  if (pin.state === "pending-release") {
    return {
      pinState: pin.state,
      versionMatches: false,
      checksumMatches: false,
      verdict: "pending-release",
      issues: [
        `drenyra-ai@${pin.version} has not been released yet; the pin is in "pending-release" state.`,
        "The harness refuses fiscal operations until the first release fills " +
          `checksumSha256 (currently "${PENDING_CHECKSUM}") and flips state to "released".`,
      ],
    };
  }

  const resolvedPath = resolvePackageLocal(packageRoot, pin.package);
  if (resolvedPath === undefined) {
    return {
      pinState: pin.state,
      versionMatches: false,
      checksumMatches: false,
      verdict: "missing",
      issues: [
        `Runtime ${pin.package}@${pin.version} not found package-local.`,
        `Install it under ${packageRoot}/runtime/${pin.package} or ` +
          `${packageRoot}/node_modules/${pin.package}.`,
        "Ambient binaries on PATH are never trusted for fiscal operations.",
      ],
    };
  }

  const { version, entryArtifact } = readRuntimeManifest(resolvedPath);
  if (version === undefined || entryArtifact === undefined) {
    return {
      pinState: pin.state,
      resolvedPath,
      versionMatches: false,
      checksumMatches: false,
      verdict: "missing",
      issues: [
        `Runtime directory ${resolvedPath} exists but is not a valid package ` +
          `(missing or unreadable ${PACKAGE_JSON}).`,
      ],
    };
  }

  const versionMatches = version === pin.version;

  let checksumMatches = false;
  try {
    const digest = await sha256File(entryArtifact);
    checksumMatches = digest === pin.checksumSha256;
    if (!checksumMatches) {
      issues.push(
        `Checksum mismatch for ${entryArtifact}: computed ${digest}, ` +
          `pinned ${pin.checksumSha256}. The packaged runtime may have been tampered with.`,
      );
    }
  } catch {
    issues.push(
      `Could not read artifact ${entryArtifact} to verify its checksum — fail closed.`,
    );
  }

  if (!versionMatches) {
    issues.unshift(
      `Runtime version mismatch: resolved runtime reports ${version}, ` +
        `pin requires ${pin.version}.`,
    );
    return {
      pinState: pin.state,
      resolvedPath,
      version,
      versionMatches: false,
      checksumMatches,
      verdict: "version-mismatch",
      issues,
    };
  }

  if (!checksumMatches) {
    return {
      pinState: pin.state,
      resolvedPath,
      version,
      versionMatches: true,
      checksumMatches: false,
      verdict: "checksum-mismatch",
      issues,
    };
  }

  return {
    pinState: pin.state,
    resolvedPath,
    version,
    versionMatches: true,
    checksumMatches: true,
    verdict: "verified",
    issues,
  };
}

interface RuntimeManifest {
  version?: string;
  /** Absolute path of the artifact that is checksummed. */
  entryArtifact?: string;
}

/**
 * Read the resolved runtime's own package.json.
 *
 * The checksummed artifact is the runtime's entry point: `main`, or the first
 * `bin` target when present, falling back to package.json itself. This mirrors
 * "Checksum of the packaged runtime matches the published artifact": the file
 * an attacker would replace is the file we verify.
 */
function readRuntimeManifest(runtimeDir: string): RuntimeManifest {
  let raw: string;
  try {
    raw = readFileSync(join(runtimeDir, PACKAGE_JSON), "utf8");
  } catch {
    return {};
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return {};
  }
  const record = manifest as Record<string, unknown>;
  const version = typeof record.version === "string" ? record.version : undefined;

  let entry: string | undefined;
  if (typeof record.main === "string" && record.main.length > 0) {
    entry = record.main;
  } else if (typeof record.bin === "string" && record.bin.length > 0) {
    entry = record.bin;
  } else if (
    typeof record.bin === "object" &&
    record.bin !== null &&
    !Array.isArray(record.bin)
  ) {
    const first = Object.values(record.bin).find((value): value is string =>
      typeof value === "string",
    );
    entry = first;
  }

  const entryArtifact =
    entry === undefined ? join(runtimeDir, PACKAGE_JSON) : join(runtimeDir, entry);

  return { version, entryArtifact };
}
