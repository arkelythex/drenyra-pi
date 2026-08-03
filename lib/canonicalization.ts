/**
 * Canonical scope and payload encoding — the exact byte contract for scope
 * identity (REQ-SCOPE-004/005; design §3.2/§3.4).
 *
 * `canonicalizeScope` emits one compact UTF-8 JSON object with keys in the
 * exact lexicographic order, NFC-normalized strings, JSON escaping, no BOM, no
 * trailing newline, and no optional property. `scopeHash` is the lowercase hex
 * sha-256 over those exact bytes, so any single-element change yields a
 * different hash (REQ-SCOPE-005) and every authorization/receipt can be bound
 * to the exact scope (REQ-SCOPE-008).
 *
 * `canonicalizePayload` is the deterministic payload encoder used for evidence
 * and target hashes: keys sorted recursively, BigInt cents serialized as JSON
 * integers, and floating-point money rejected at JSON boundaries.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents
 * (JSON integers or decimal strings at JSON boundaries — never floats); digests
 * are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { createHash } from "node:crypto";
import {
  AUTHORITY_MODE,
  CANONICAL_SCOPE_ELEMENTS,
  isValidPeriod,
  type AuthorityMode,
  type CanonicalScope,
} from "../runtime/context.js";
import { isValidRuc } from "../runtime/ruc.js";

/** Result of validating a canonical scope; `errors` is empty when `valid`. */
export interface ScopeValidation {
  valid: boolean;
  errors: readonly string[];
}

/** The stable scope binding (design §3.1): version, canonical bytes, hash. */
export interface ScopeBinding {
  version: "drenyra.scope.v1";
  scope: CanonicalScope;
  canonical: string;
  scopeHash: string;
}

const AUTHORITY_MODE_VALUES: readonly string[] = Object.values(AUTHORITY_MODE);
const SOURCE_SNAPSHOT_RE = /^[0-9a-f]{64}$/;

/** True when the string contains an unpaired UTF-16 surrogate code point. */
function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize every scope string to Unicode NFC. Normalization never coerces
 * types, trims, or invents values: whitespace-padded identifiers are rejected
 * by validation, not silently stripped (design §3.1).
 */
export function normalizeScope(scope: CanonicalScope): CanonicalScope {
  return {
    tenant: scope.tenant.normalize("NFC"),
    organization: scope.organization.normalize("NFC"),
    company: scope.company.normalize("NFC"),
    fiscalPeriod: scope.fiscalPeriod.normalize("NFC"),
    ledgerBook: scope.ledgerBook.normalize("NFC"),
    operationType: scope.operationType.normalize("NFC"),
    sourceSnapshot: scope.sourceSnapshot.normalize("NFC"),
    policyVersion: scope.policyVersion.normalize("NFC"),
    actor: scope.actor.normalize("NFC"),
    authorityLevel: scope.authorityLevel.normalize("NFC") as AuthorityMode,
  };
}

/**
 * Fail-closed scope validation (REQ-SCOPE-001/002/003): all 10 elements must
 * be present, non-empty after normalization, free of leading/trailing
 * whitespace and lone surrogates; company must pass the RUC check digit,
 * fiscalPeriod must be YYYYMM with month 01–12, authorityLevel must be one of
 * the four modes, and sourceSnapshot must be a lowercase hex sha-256 digest.
 */
export function validateCanonicalScope(scope: CanonicalScope): ScopeValidation {
  const errors: string[] = [];
  if (typeof scope !== "object" || scope === null) {
    return { valid: false, errors: ["scope must be an object"] };
  }
  for (const element of CANONICAL_SCOPE_ELEMENTS) {
    const value = scope[element];
    if (typeof value !== "string") {
      errors.push(`${element}: must be a string`);
      continue;
    }
    const normalized = value.normalize("NFC");
    if (normalized.length === 0) {
      errors.push(`${element}: must be non-empty after normalization`);
    }
    if (normalized.trim() !== normalized) {
      errors.push(`${element}: leading/trailing whitespace is rejected`);
    }
    if (hasLoneSurrogate(normalized)) {
      errors.push(`${element}: contains a lone surrogate code point`);
    }
  }
  if (!isValidRuc(scope.company)) {
    errors.push("company: invalid RUC (must be 11 digits with a valid check digit)");
  }
  if (!isValidPeriod(scope.fiscalPeriod)) {
    errors.push("fiscalPeriod: invalid period (must be YYYYMM with month 01-12)");
  }
  if (!AUTHORITY_MODE_VALUES.includes(scope.authorityLevel)) {
    errors.push(
      `authorityLevel: must be one of ${AUTHORITY_MODE_VALUES.join(", ")}`,
    );
  }
  if (!SOURCE_SNAPSHOT_RE.test(scope.sourceSnapshot)) {
    errors.push("sourceSnapshot: must be a lowercase hex sha-256 digest (64 hex characters)");
  }
  return { valid: errors.length === 0, errors };
}

/** JSON string escaping — standard JSON.stringify escaping (design §3.2 rule 2). */
function jsonString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Emit the canonical scope JSON with the exact key order from design §3.2:
 * actor, authorityLevel, company, fiscalPeriod, ledgerBook, operationType,
 * organization, policyVersion, sourceSnapshot, tenant. No BOM, no trailing
 * newline, no optional property, no null.
 */
export function canonicalizeScope(scope: CanonicalScope): string {
  const normalized = normalizeScope(scope);
  const validation = validateCanonicalScope(normalized);
  if (!validation.valid) {
    throw new Error(`canonicalizeScope: invalid canonical scope — ${validation.errors.join("; ")}`);
  }
  const parts = [
    `"actor":${jsonString(normalized.actor)}`,
    `"authorityLevel":${jsonString(normalized.authorityLevel)}`,
    `"company":${jsonString(normalized.company)}`,
    `"fiscalPeriod":${jsonString(normalized.fiscalPeriod)}`,
    `"ledgerBook":${jsonString(normalized.ledgerBook)}`,
    `"operationType":${jsonString(normalized.operationType)}`,
    `"organization":${jsonString(normalized.organization)}`,
    `"policyVersion":${jsonString(normalized.policyVersion)}`,
    `"sourceSnapshot":${jsonString(normalized.sourceSnapshot)}`,
    `"tenant":${jsonString(normalized.tenant)}`,
  ];
  return `{${parts.join(",")}}`;
}

/**
 * Bind a canonical scope: NFC-normalize, validate fail-closed, emit the exact
 * canonical bytes, and compute the lowercase hex sha-256 scope hash
 * (REQ-SCOPE-004/008; design §3.1).
 */
export function bindScope(scope: CanonicalScope): ScopeBinding {
  const normalized = normalizeScope(scope);
  const canonical = canonicalizeScope(normalized);
  const scopeHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return { version: "drenyra.scope.v1", scope: normalized, canonical, scopeHash };
}

/**
 * Deterministic canonical JSON for arbitrary payloads: keys sorted recursively
 * (design §3.2 rule 4), BigInt cents serialized as JSON integers, and
 * floating-point money rejected at JSON boundaries (REQ-CONTRACTS-008). Lone
 * surrogates in strings are rejected so the UTF-8 encoding is always defined.
 */
export function canonicalizePayload(payload: unknown): string {
  if (payload === null) return "null";
  if (typeof payload === "string") {
    if (hasLoneSurrogate(payload)) {
      throw new Error("canonicalizePayload: string contains a lone surrogate code point");
    }
    return JSON.stringify(payload);
  }
  if (typeof payload === "boolean") return payload ? "true" : "false";
  if (typeof payload === "bigint") return payload.toString();
  if (typeof payload === "number") {
    if (!Number.isFinite(payload)) {
      throw new Error("canonicalizePayload: non-finite number rejected");
    }
    if (!Number.isInteger(payload)) {
      throw new Error(
        "canonicalizePayload: float money rejected at JSON boundaries — use BigInt cents or a decimal string",
      );
    }
    return JSON.stringify(payload);
  }
  if (typeof payload === "object") {
    if (Array.isArray(payload)) {
      return `[${payload.map((item) => canonicalizePayload(item)).join(",")}]`;
    }
    const record = payload as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map(
      (key) => `${jsonString(key)}:${canonicalizePayload(record[key])}`,
    );
    return `{${parts.join(",")}}`;
  }
  throw new Error("canonicalizePayload: unsupported value (undefined, function, or symbol)");
}

/** Lowercase hex sha-256 over the canonical payload bytes (design §3.2 rule 6). */
export function sha256Canonical(payload: unknown): string {
  return createHash("sha256").update(canonicalizePayload(payload), "utf8").digest("hex");
}
