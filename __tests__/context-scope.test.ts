/**
 * Canonical scope model tests — the 10-element scope every mission and
 * authorization is bound to (REQ-SCOPE-001) and the backward-compatible legacy
 * load path (REQ-SCOPE-007; SC-SCOPE-006).
 *
 * The runtime scope layer reuses the existing RUC check-digit validator and the
 * YYYYMM period validator (REQ-SCOPE-002/003); incomplete or invalid scope
 * fails closed at the mission-use boundary (REQ-SCOPE-009).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC/period digits are integers.
 */

import { describe, expect, it } from "vitest";
import {
  AUTHORITY_MODE,
  assertMissionScopeReady,
  loadCanonicalScope,
  type AuthorityMode,
  type CanonicalScope,
  type ScopeContext,
} from "../runtime/context.js";
import { isValidPeriod } from "../runtime/context.js";
import { isValidRuc } from "../runtime/ruc.js";

const VALID_RUC = "20123456786";
const OTHER_VALID_RUC = "20512345671";
const PERIOD = "202607";

function fullScope(): CanonicalScope {
  return {
    tenant: "tenant-acme",
    organization: "org-acme",
    company: VALID_RUC,
    fiscalPeriod: PERIOD,
    ledgerBook: "general-ledger",
    operationType: "monthly-close",
    sourceSnapshot: "0".repeat(64),
    policyVersion: "drenyra.policy.v1",
    actor: "user-01",
    authorityLevel: "PREPARE",
  };
}

describe("AUTHORITY_MODE (design §3.1)", () => {
  it("exposes exactly four modes in strict order ASK < ANALYZE < PREPARE < EXECUTE", () => {
    expect(Object.values(AUTHORITY_MODE)).toEqual([
      "ASK",
      "ANALYZE",
      "PREPARE",
      "EXECUTE",
    ]);
    const modes: readonly AuthorityMode[] = Object.values(AUTHORITY_MODE);
    const order = new Map<AuthorityMode, number>(
      modes.map((mode, index) => [mode, index]),
    );
    expect(order.get("ASK")).toBeLessThan(order.get("ANALYZE")!);
    expect(order.get("ANALYZE")).toBeLessThan(order.get("PREPARE")!);
    expect(order.get("PREPARE")).toBeLessThan(order.get("EXECUTE")!);
  });
});

describe("loadCanonicalScope (REQ-SCOPE-007; SC-SCOPE-006)", () => {
  it("loads a legacy company/period context into canonical elements without data loss", () => {
    const legacy: ScopeContext = {
      company: { ruc: VALID_RUC },
      period: { period: PERIOD },
    };
    const report = loadCanonicalScope(legacy);
    expect(report.scope.company).toBe(VALID_RUC);
    expect(report.scope.fiscalPeriod).toBe(PERIOD);
  });

  it("reports the scope incomplete until the remaining 8 elements are bound", () => {
    const legacy: ScopeContext = {
      company: { ruc: VALID_RUC },
      period: { period: PERIOD },
    };
    const report = loadCanonicalScope(legacy);
    expect(report.complete).toBe(false);
    expect(report.missing).toHaveLength(8);
    for (const element of [
      "tenant",
      "organization",
      "ledgerBook",
      "operationType",
      "sourceSnapshot",
      "policyVersion",
      "actor",
      "authorityLevel",
    ]) {
      expect(report.missing).toContain(element);
    }
    expect(report.missing).not.toContain("company");
    expect(report.missing).not.toContain("fiscalPeriod");
  });

  it("drops only invalid legacy values and reports an empty scope from scratch", () => {
    const badRuc: ScopeContext = { company: { ruc: "20123456789" } };
    const badRucReport = loadCanonicalScope(badRuc);
    expect(badRucReport.scope.company).toBeUndefined();
    expect(badRucReport.missing).toContain("company");

    const badPeriod: ScopeContext = { period: { period: "202513" } };
    const badPeriodReport = loadCanonicalScope(badPeriod);
    expect(badPeriodReport.scope.fiscalPeriod).toBeUndefined();
    expect(badPeriodReport.missing).toContain("fiscalPeriod");

    const empty = loadCanonicalScope({});
    expect(empty.complete).toBe(false);
    expect(empty.missing).toHaveLength(10);
  });
});

describe("assertMissionScopeReady (REQ-SCOPE-009)", () => {
  it("passes for a complete valid 10-element scope", () => {
    expect(() => assertMissionScopeReady(fullScope())).not.toThrow();
  });

  it("blocks mission use when the scope is missing entirely", () => {
    expect(() => assertMissionScopeReady(undefined)).toThrow(/scope required|incomplete/i);
  });

  it("blocks mission use for a partial scope (only company + period bound)", () => {
    const partial: CanonicalScope = {
      company: VALID_RUC,
      fiscalPeriod: PERIOD,
    } as CanonicalScope;
    expect(() => assertMissionScopeReady(partial)).toThrow(/incomplete|missing/i);
  });

  it("blocks mission use when the company RUC fails the check digit (SC-SCOPE-002)", () => {
    const scope = fullScope();
    scope.company = "20123456789"; // wrong check digit
    expect(() => assertMissionScopeReady(scope)).toThrow(/RUC|company/i);
  });

  it("accepts a valid RUC and rejects a bad check digit at element level (SC-SCOPE-001/002)", () => {
    expect(isValidRuc(VALID_RUC)).toBe(true);
    expect(isValidRuc(OTHER_VALID_RUC)).toBe(true);
    expect(isValidRuc("20123456789")).toBe(false);
  });

  it("blocks mission use for an invalid fiscal period (SC-SCOPE-003)", () => {
    const scope = fullScope();
    scope.fiscalPeriod = "202513";
    expect(() => assertMissionScopeReady(scope)).toThrow(/period/i);
    expect(isValidPeriod("202507")).toBe(true);
    expect(isValidPeriod("202513")).toBe(false);
  });

  it("blocks mission use for an unknown authority level", () => {
    const scope = fullScope();
    scope.authorityLevel = "SUDO" as AuthorityMode;
    expect(() => assertMissionScopeReady(scope)).toThrow(/authority/i);
  });

  it("blocks mission use when a required element is an empty string", () => {
    const scope = fullScope();
    scope.tenant = "   ";
    expect(() => assertMissionScopeReady(scope)).toThrow(/tenant|incomplete/i);
  });
});
