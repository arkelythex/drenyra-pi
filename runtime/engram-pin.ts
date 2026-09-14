// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are build identifiers,
// checksums are lowercase hex sha256, and exit/status codes are JSON
// integers — never floats. This module contains no money logic; it pins and
// fail-closed verifies the vendored drenyra-engram binary.
/**
 * Runtime pin for the drenyra-engram binary consumed by Drenyra Pi.
 *
 * Contract: contracts/engram-dependency.md
 *   - Pinned exact build, per platform. No range, no "latest", no live fetch.
 *   - Package-local, four platforms (linux/darwin × amd64/arm64); win32 is an
 *     explicitly disclosed unsupported platform, not a silent failure.
 *   - Never PATH: only the vendored, checksum-verified artifact is trusted.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { sha256File } from "./checksum.js";

/** The exact upstream build identifier this pin targets. */
export const ENGRAM_PIN_BUILD = "0.2.1-SNAPSHOT-6a371a9";

/** The four platforms this pin vendors an artifact for. win32 is absent on purpose. */
export type EngramPlatformKey =
  | "linux_amd64"
  | "linux_arm64"
  | "darwin_amd64"
  | "darwin_arm64";

/**
 * sha256 (lowercase hex) of each vendored tarball, per platform — the source
 * of truth is contracts/engram-dependency.md's "Pinned artifacts" table;
 * these values must stay identical to that table.
 */
export const ENGRAM_PIN_CHECKSUMS: Readonly<Record<EngramPlatformKey, string>> = {
  linux_amd64:
    "caa6f3298601536520db82b1d6b099cde454160b3a262164163055d71366aadf",
  linux_arm64:
    "4f644dc869237a73dcc6ff8d189afebffec23407c7f4b528c073bcd300728af9",
  darwin_amd64:
    "ac71f6dee50d5030f167dd6f705652bcc6aa8b885a582257ae744bda48beb64d",
  darwin_arm64:
    "39aeeb5517af259237aa4965e330b5807aacdb08e92f203310431ff0798446d4",
};

const PLATFORM_ARCH_MAP: Readonly<
  Record<string, Readonly<Record<string, EngramPlatformKey>>>
> = {
  linux: { x64: "linux_amd64", arm64: "linux_arm64" },
  darwin: { x64: "darwin_amd64", arm64: "darwin_arm64" },
};

/**
 * Map a Node-shaped `process.platform`/`process.arch` pair to one of the
 * four vendored pin keys, or `undefined` when the combination is not
 * vendored — including every `win32` case, disclosed in
 * contracts/engram-dependency.md rather than silently failing later.
 */
export function resolveEngramPlatformKey(
  platform: string,
  arch: string,
): EngramPlatformKey | undefined {
  return PLATFORM_ARCH_MAP[platform]?.[arch];
}

export type EngramPinVerdict =
  | "verified"
  | "unsupported-platform"
  | "missing-artifact"
  | "checksum-mismatch";

export interface EngramPinReport {
  verdict: EngramPinVerdict;
  platformKey?: EngramPlatformKey;
  /** Absolute path to the resolved vendored artifact, when one was found. */
  resolvedPath?: string;
  /** Human-readable issues; empty when verdict is "verified". */
  issues: string[];
}

export interface VerifyEngramPinInput {
  /** Directory the platform-named tarballs live in (vendored/drenyra-engram in production). */
  vendoredRoot: string;
  platform: string;
  arch: string;
}

function vendoredArtifactName(platformKey: EngramPlatformKey): string {
  return `drenyra-engram-${ENGRAM_PIN_BUILD}-${platformKey}.tar.gz`;
}

/**
 * Fail-closed verification of the vendored drenyra-engram binary.
 *
 * Rules (contracts/engram-dependency.md):
 *   - platform/arch not in the vendored four → "unsupported-platform"
 *     (NEVER attempts a fallback to a different platform's artifact).
 *   - vendored tarball absent → "missing-artifact".
 *   - tarball present but checksum mismatch → "checksum-mismatch"
 *     (possible tampering or a wrong/corrupted copy).
 *   - checksum matches → "verified".
 *
 * Never spawns or extracts anything itself — that is engram-client.ts's job,
 * and it must only proceed past a "verified" report.
 */
export async function verifyEngramPin({
  vendoredRoot,
  platform,
  arch,
}: VerifyEngramPinInput): Promise<EngramPinReport> {
  const platformKey = resolveEngramPlatformKey(platform, arch);
  if (!platformKey) {
    return {
      verdict: "unsupported-platform",
      issues: [
        `drenyra-engram has no vendored artifact for platform "${platform}"/arch "${arch}" ` +
          '(supported: linux_amd64, linux_arm64, darwin_amd64, darwin_arm64; win32 is not vendored — contracts/engram-dependency.md rule 2).',
      ],
    };
  }

  const artifactName = vendoredArtifactName(platformKey);
  const resolvedPath = join(vendoredRoot, artifactName);
  if (!existsSync(resolvedPath)) {
    return {
      verdict: "missing-artifact",
      platformKey,
      issues: [
        `vendored artifact missing for pin ${ENGRAM_PIN_BUILD} (${platformKey}): ${resolvedPath}`,
      ],
    };
  }

  const expected = ENGRAM_PIN_CHECKSUMS[platformKey];
  let actual: string;
  try {
    actual = await sha256File(resolvedPath);
  } catch (error) {
    return {
      verdict: "checksum-mismatch",
      platformKey,
      resolvedPath,
      issues: [
        `failed to read vendored artifact for checksum verification: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  if (actual !== expected) {
    return {
      verdict: "checksum-mismatch",
      platformKey,
      resolvedPath,
      issues: [
        `checksum mismatch for ${artifactName}: expected ${expected}, got ${actual}. ` +
          "Never trust an unverified binary — the pinned artifact may be corrupted or tampered.",
      ],
    };
  }

  return {
    verdict: "verified",
    platformKey,
    resolvedPath,
    issues: [],
  };
}
