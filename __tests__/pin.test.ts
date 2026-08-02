// Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
// no float is ever used for money. Version strings are semver, checksums are
// lowercase hex sha256, and exit/status codes are JSON integers — never floats.
// Pin shape validation tests — createPin fails closed on any invalid shape.

import { describe, expect, it } from "vitest";
import {
  createPin,
  DEFAULT_PIN,
  PENDING_CHECKSUM,
  RUNTIME_PACKAGE,
  RUNTIME_VERSION,
  type RuntimePin,
} from "../runtime/pin.js";

describe("createPin", () => {
  it("builds the DEFAULT_PIN shape when called without overrides", () => {
    const pin = createPin();
    expect(pin).toEqual(DEFAULT_PIN);
    expect(pin.package).toBe(RUNTIME_PACKAGE);
    expect(pin.version).toBe(RUNTIME_VERSION);
    expect(pin.checksumSha256).toBe(PENDING_CHECKSUM);
    expect(pin.state).toBe("pending-release");
  });

  it("merges valid overrides onto the defaults", () => {
    const checksum = "a".repeat(64);
    const pin = createPin({ state: "released", checksumSha256: checksum });
    expect(pin.state).toBe("released");
    expect(pin.checksumSha256).toBe(checksum);
    expect(pin.package).toBe(RUNTIME_PACKAGE);
    expect(pin.version).toBe(RUNTIME_VERSION);
  });

  it("rejects an empty package name", () => {
    expect(() => createPin({ package: "   " })).toThrow(/package/);
  });

  it("rejects range pins instead of an exact semver", () => {
    expect(() => createPin({ version: "^0.1.0" })).toThrow(/semver/);
    expect(() => createPin({ version: "1.x" })).toThrow(/semver/);
    expect(() => createPin({ version: "latest" })).toThrow(/semver/);
  });

  it("rejects a malformed checksum", () => {
    expect(() => createPin({ state: "released", checksumSha256: "abc" })).toThrow(
      /checksum/,
    );
    expect(() =>
      createPin({ state: "released", checksumSha256: "ZZ".repeat(32) }),
    ).toThrow(/checksum/);
  });

  it("rejects an unknown state", () => {
    expect(() =>
      createPin({ state: "shipped" } as unknown as Partial<RuntimePin>),
    ).toThrow(/state/);
  });

  it("fail-closes: a released pin cannot carry the pending placeholder", () => {
    expect(() =>
      createPin({ state: "released", checksumSha256: PENDING_CHECKSUM }),
    ).toThrow(/released pin requires a real checksum/);
  });

  it("fail-closes: a pending-release pin cannot carry a real checksum", () => {
    expect(() => createPin({ checksumSha256: "b".repeat(64) })).toThrow(
      /pending-release/,
    );
  });
});

describe("DEFAULT_PIN", () => {
  it("is pending-release with the pending placeholder until the first release", () => {
    expect(DEFAULT_PIN.state).toBe("pending-release");
    expect(DEFAULT_PIN.checksumSha256).toBe(PENDING_CHECKSUM);
    expect(DEFAULT_PIN.version).toBe("0.0.1-prealpha.1");
  });
});
