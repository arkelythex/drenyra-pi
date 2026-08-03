/**
 * Canonicalization tests — the exact canonical scope encoding, the scope hash,
 * and canonical payload encoding (REQ-SCOPE-004/005; design §3.2/§3.4).
 *
 * The golden vector asserts the exact compact JSON bytes and key order, the
 * lowercase hex sha-256 scope hash, single-element sensitivity across all 10
 * elements, NFC equivalence, lone-surrogate rejection, deterministic output,
 * and the no-float-money rule at JSON boundaries.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or decimal strings at JSON boundaries — never floats); digests
 * are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bindScope,
  canonicalizePayload,
  canonicalizeScope,
  normalizeScope,
  sha256Canonical,
  validateCanonicalScope,
} from "../lib/canonicalization.js";
import type { CanonicalScope, AuthorityMode } from "../runtime/context.js";

const VALID_RUC = "20123456786";
const OTHER_VALID_RUC = "20512345671";
const SNAPSHOT_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/** The golden 10-element scope from design §3.2. */
function goldenScope(): CanonicalScope {
  return {
    tenant: "tenant-acme",
    organization: "org-acme",
    company: VALID_RUC,
    fiscalPeriod: "202607",
    ledgerBook: "general-ledger",
    operationType: "monthly-close",
    sourceSnapshot: SNAPSHOT_HEX,
    policyVersion: "drenyra.policy.v1",
    actor: "user-01",
    authorityLevel: "PREPARE",
  };
}

/**
 * The exact canonical encoding required by design §3.2: one compact UTF-8 JSON
 * object, keys in the exact lexicographic order, no BOM, no trailing newline,
 * no optional properties.
 */
const GOLDEN_JSON =
  '{"actor":"user-01","authorityLevel":"PREPARE","company":"20123456786",' +
  '"fiscalPeriod":"202607","ledgerBook":"general-ledger","operationType":"monthly-close",' +
  '"organization":"org-acme","policyVersion":"drenyra.policy.v1",' +
  '"sourceSnapshot":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",' +
  '"tenant":"tenant-acme"}';

const EXPECTED_KEY_ORDER = [
  "actor",
  "authorityLevel",
  "company",
  "fiscalPeriod",
  "ledgerBook",
  "operationType",
  "organization",
  "policyVersion",
  "sourceSnapshot",
  "tenant",
];

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("canonicalizeScope golden vector (REQ-SCOPE-004; design §3.2)", () => {
  it("produces the exact compact JSON bytes with the exact key order", () => {
    const result = canonicalizeScope(goldenScope());
    expect(result).toBe(GOLDEN_JSON);
  });

  it("emits no byte-order mark and no trailing newline", () => {
    const result = canonicalizeScope(goldenScope());
    expect(result.startsWith("\uFEFF")).toBe(false);
    expect(result.endsWith("\n")).toBe(false);
    expect(result.includes("\uFEFF")).toBe(false);
  });

  it("orders keys exactly as actor, authorityLevel, company, fiscalPeriod, ledgerBook, operationType, organization, policyVersion, sourceSnapshot, tenant", () => {
    const result = canonicalizeScope(goldenScope());
    expect(Object.keys(JSON.parse(result))).toEqual(EXPECTED_KEY_ORDER);
    // The golden fixture itself is in the required order.
    expect(Object.keys(JSON.parse(GOLDEN_JSON))).toEqual(EXPECTED_KEY_ORDER);
  });

  it("is deterministic: repeated calls return identical bytes", () => {
    expect(canonicalizeScope(goldenScope())).toBe(canonicalizeScope(goldenScope()));
  });

  it("escapes quotes, reverse solidus, and control characters with JSON escaping", () => {
    const scope = goldenScope();
    scope.tenant = 'a"b\\c\u0001d';
    const result = canonicalizeScope(scope);
    expect(result).toContain('"a\\"b\\\\c\\u0001d"');
    expect(JSON.parse(result).tenant).toBe('a"b\\c\u0001d');
  });
});

describe("bindScope (REQ-SCOPE-004/008)", () => {
  it("returns version, canonical bytes, and a 64-char lowercase hex scopeHash", () => {
    const binding = bindScope(goldenScope());
    expect(binding.version).toBe("drenyra.scope.v1");
    expect(binding.canonical).toBe(GOLDEN_JSON);
    expect(binding.scopeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(binding.scopeHash).toBe(sha256(GOLDEN_JSON));
  });

  it("binds the NFC-normalized scope", () => {
    const scope = goldenScope();
    scope.organization = "caf\u00e9-libros"; // composed NFC
    const binding = bindScope(scope);
    expect(binding.scope.organization).toBe("caf\u00e9-libros");
    expect(binding.scopeHash).toBe(sha256(canonicalizeScope(scope)));
  });
});

describe("ten single-field mutations change the hash (REQ-SCOPE-005; SC-SCOPE-004)", () => {
  it("yields 10 distinct hashes, all different from the original, which stays unchanged", () => {
    const original = bindScope(goldenScope());
    const originalHash = original.scopeHash;

    const mutations: ReadonlyArray<Partial<CanonicalScope>> = [
      { actor: "user-02" },
      { authorityLevel: "EXECUTE" },
      { company: OTHER_VALID_RUC },
      { fiscalPeriod: "202608" },
      { ledgerBook: "auxiliary-ledger" },
      { operationType: "reconciliation" },
      { organization: "org-beta" },
      { policyVersion: "drenyra.policy.v2" },
      { sourceSnapshot: "f".repeat(64) },
      { tenant: "tenant-beta" },
    ];

    const hashes = new Set<string>([originalHash]);
    for (const patch of mutations) {
      const mutated = bindScope({ ...goldenScope(), ...patch });
      expect(mutated.scopeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(mutated.scopeHash).not.toBe(originalHash);
      hashes.add(mutated.scopeHash);
    }
    expect(hashes.size).toBe(11);

    // The original scope still binds to the same hash (no mutation leaked).
    expect(bindScope(goldenScope()).scopeHash).toBe(originalHash);
  });
});

describe("NFC equivalence and lone surrogates (design §3.2)", () => {
  it("treats NFC-equivalent strings as equal (composed vs decomposed)", () => {
    const composed = goldenScope();
    composed.organization = "caf\u00e9-libros"; // é = U+00E9 (composed)
    const decomposed = goldenScope();
    decomposed.organization = "cafe\u0301-libros"; // e + combining acute

    expect(composed.organization).not.toBe(decomposed.organization);
    expect(canonicalizeScope(composed)).toBe(canonicalizeScope(decomposed));
    expect(bindScope(composed).scopeHash).toBe(bindScope(decomposed).scopeHash);
  });

  it("rejects lone surrogate code points", () => {
    const scope = goldenScope();
    scope.organization = "bad\uD800value";
    expect(() => canonicalizeScope(scope)).toThrow(/lone surrogate/i);
    expect(() => bindScope(scope)).toThrow(/lone surrogate/i);

    const validation = validateCanonicalScope(scope);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/surrogate/i);
  });
});

describe("validateCanonicalScope (fail closed)", () => {
  it("accepts the golden scope", () => {
    const validation = validateCanonicalScope(goldenScope());
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("rejects a missing element and an empty string", () => {
    const missing = goldenScope() as Partial<CanonicalScope>;
    delete missing.tenant;
    const missingValidation = validateCanonicalScope(missing as CanonicalScope);
    expect(missingValidation.valid).toBe(false);
    expect(missingValidation.errors.join(" ")).toMatch(/tenant/i);

    const empty = goldenScope();
    empty.actor = "";
    const emptyValidation = validateCanonicalScope(empty);
    expect(emptyValidation.valid).toBe(false);
    expect(emptyValidation.errors.join(" ")).toMatch(/actor/i);
  });

  it("rejects leading/trailing whitespace identifiers", () => {
    const padded = goldenScope();
    padded.actor = " user-01 ";
    const validation = validateCanonicalScope(padded);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/whitespace/i);
  });

  it("rejects a bad RUC, a bad period, and a bad authority level", () => {
    const badRuc = goldenScope();
    badRuc.company = "20123456789";
    expect(validateCanonicalScope(badRuc).valid).toBe(false);

    const badPeriod = goldenScope();
    badPeriod.fiscalPeriod = "202513";
    expect(validateCanonicalScope(badPeriod).valid).toBe(false);

    const badLevel = goldenScope();
    badLevel.authorityLevel = "SUDO" as AuthorityMode;
    expect(validateCanonicalScope(badLevel).valid).toBe(false);
  });

  it("rejects a non-hex sourceSnapshot and a non-string element", () => {
    const badSnapshot = goldenScope();
    badSnapshot.sourceSnapshot = "not-a-digest";
    const snapshotValidation = validateCanonicalScope(badSnapshot);
    expect(snapshotValidation.valid).toBe(false);
    expect(snapshotValidation.errors.join(" ")).toMatch(/sourceSnapshot/i);

    const nonString = goldenScope() as unknown as CanonicalScope;
    (nonString as unknown as Record<string, unknown>).tenant = 42;
    expect(validateCanonicalScope(nonString).valid).toBe(false);
  });
});

describe("normalizeScope (NFC only, no coercion)", () => {
  it("normalizes decomposed strings to NFC but never coerces or trims", () => {
    const scope = goldenScope();
    scope.organization = "cafe\u0301-libros";
    const normalized = normalizeScope(scope);
    expect(normalized.organization).toBe("caf\u00e9-libros");
    expect(normalized.tenant).toBe("tenant-acme");
  });
});

describe("canonicalizePayload and sha256Canonical (no float money at JSON boundaries)", () => {
  it("serializes with sorted keys regardless of insertion order", () => {
    expect(canonicalizePayload({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
    expect(canonicalizePayload({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalizePayload({ b: 2, a: 1 })).toBe(canonicalizePayload({ a: 1, b: 2 }));
  });

  it("serializes BigInt cents as JSON integers and keeps decimal strings as strings", () => {
    expect(canonicalizePayload({ amountCents: 150000n })).toBe('{"amountCents":150000}');
    expect(canonicalizePayload({ amountCents: "150000" })).toBe('{"amountCents":"150000"}');
    expect(canonicalizePayload({ amountCents: 150000 })).toBe('{"amountCents":150000}');
  });

  it("rejects float money at JSON boundaries (REQ-CONTRACTS-008)", () => {
    expect(() => canonicalizePayload({ amountCents: 150000.5 })).toThrow(/integer|float|finite/i);
    expect(() => canonicalizePayload({ amountCents: Number.NaN })).toThrow(/finite|number/i);
    expect(() => canonicalizePayload({ amountCents: Number.POSITIVE_INFINITY })).toThrow(/finite|number/i);
  });

  it("handles nesting and deterministic deep key ordering", () => {
    const left = canonicalizePayload({ b: { y: 2, x: 1 }, a: [3, { d: 4, c: 5 }] });
    const right = canonicalizePayload({ a: [3, { c: 5, d: 4 }], b: { x: 1, y: 2 } });
    expect(left).toBe(right);
    expect(left).toBe('{"a":[3,{"c":5,"d":4}],"b":{"x":1,"y":2}}');
  });

  it("sha256Canonical returns a 64-char lowercase hex digest over the canonical bytes", () => {
    const digest = sha256Canonical({ a: 1, b: 2 });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(sha256('{"a":1,"b":2}'));
    expect(sha256Canonical({ b: 2, a: 1 })).toBe(digest);
  });
});
