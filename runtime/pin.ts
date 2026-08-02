// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// This module contains no money logic; it pins the Drenyra AI runtime.

/**
 * Runtime pin for the Drenyra AI runtime consumed by Drenyra Pi.
 *
 * Contract: contracts/runtime-dependency.md
 *   - Pinned exact version. Range pins are not allowed for fiscal operations.
 *   - The pin is part of the Drenyra Pi package manifest and changes with the
 *     runtime — upgrading the pin is a release of Drenyra Pi itself.
 */

export const RUNTIME_PACKAGE = "drenyra-ai";
export const RUNTIME_VERSION = "0.0.1-prealpha.1";

/**
 * Checksum placeholder while the pinned runtime has not been published yet.
 * A real pin uses a lowercase hex sha256 (64 chars) of the published artifact.
 */
export const PENDING_CHECKSUM = "pending";

export type PinState = "released" | "pending-release";

export interface RuntimePin {
  /** npm package name of the pinned runtime. */
  package: string;
  /** Exact semver version; range pins are never allowed for fiscal operations. */
  version: string;
  /**
   * lowercase hex sha256 (64 chars) of the published artifact,
   * or the literal "pending" while the first release is outstanding.
   */
  checksumSha256: string;
  /**
   * "pending-release" until drenyra-ai publishes a real artifact;
   * "released" once checksumSha256 holds the published value.
   */
  state: PinState;
}

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const HEX_SHA256_RE = /^[0-9a-f]{64}$/;

function assertValidShape(pin: RuntimePin): void {
  if (pin.package.trim().length === 0) {
    throw new Error("createPin: package must be a non-empty string");
  }
  if (!SEMVER_RE.test(pin.version)) {
    throw new Error(
      `createPin: version must be an exact semver string, got "${pin.version}"`,
    );
  }
  if (pin.state !== "released" && pin.state !== "pending-release") {
    throw new Error(`createPin: unknown pin state "${pin.state}"`);
  }
  if (
    pin.checksumSha256 !== PENDING_CHECKSUM &&
    !HEX_SHA256_RE.test(pin.checksumSha256)
  ) {
    throw new Error(
      `createPin: checksumSha256 must be 64 lowercase hex chars or "${PENDING_CHECKSUM}"`,
    );
  }
  if (pin.state === "released" && pin.checksumSha256 === PENDING_CHECKSUM) {
    throw new Error(
      "createPin: a released pin requires a real checksum, not \"pending\"",
    );
  }
  if (pin.state === "pending-release" && pin.checksumSha256 !== PENDING_CHECKSUM) {
    throw new Error(
      'createPin: a pending-release pin must use checksumSha256 "pending"',
    );
  }
}

/**
 * Build a validated RuntimePin. Validation fails closed: any invalid shape
 * throws instead of being silently coerced.
 */
export function createPin(overrides: Partial<RuntimePin> = {}): RuntimePin {
  const pin: RuntimePin = {
    package: RUNTIME_PACKAGE,
    version: RUNTIME_VERSION,
    checksumSha256: PENDING_CHECKSUM,
    state: "pending-release",
    ...overrides,
  };
  assertValidShape(pin);
  return pin;
}

    /**
     * The pinned Drenyra AI runtime for this package.
     *
     * Released at v0.0.1-prealpha.1 (github:arkelythex/drenyra-ai#v0.0.1-prealpha.1,
     * 2026-08-02). checksumSha256 is the SHA-256 of the release's entry artifact
     * dist/cmd/cli.js (the artifact doctor() checksums for a package-local
     * install); the release tarball hash lives in the GitHub Release SHA256SUMS.
     *
     * Upgrading the pin is itself a release of Drenyra Pi (see
     * contracts/runtime-dependency.md, "Upgrade is explicit").
     */
    export const DEFAULT_PIN: RuntimePin = createPin({
      version: RUNTIME_VERSION,
      checksumSha256:
        "e4e81914f5f069121fe281f18be69b4f8099e111b51fe30a7de52dca7078c047",
      state: "released",
    });
