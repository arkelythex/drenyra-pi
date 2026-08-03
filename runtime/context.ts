/**
 * Company + fiscal period context — the scope every Drenyra Pi command runs in.
 *
 * The startup panel and every /drenyra:* command thread this context:
 * company (RUC, check-digit-validated) and fiscal period (YYYYMM). A command
 * that requires scope fails closed when it is not set. The context also hosts
 * the 10-element canonical scope model (REQ-SCOPE-001) and the
 * backward-compatible legacy load path (REQ-SCOPE-007).
 *
 * Persistence is a development-grade JSON file (~/.drenyra/context.json) with
 * atomic writes (temp + rename); canonical storage is a later concern.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC digits and period digits are integers.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isValidRuc } from "./ruc.js";

/** A validated company scope: the 11-digit check-digit-validated RUC. */
export interface CompanyContext {
  ruc: string;
}

/** A validated fiscal period: YYYYMM with a real month (01–12). */
export interface FiscalPeriodContext {
  period: string;
}

/** The full operational scope carried by the harness. */
export interface ScopeContext {
  company?: CompanyContext;
  period?: FiscalPeriodContext;
}

/**
 * The four canonical authority modes in strict order
 * ASK < ANALYZE < PREPARE < EXECUTE (REQ-AUTH-001; design §3.1).
 */
export const AUTHORITY_MODE = {
  ASK: "ASK",
  ANALYZE: "ANALYZE",
  PREPARE: "PREPARE",
  EXECUTE: "EXECUTE",
} as const;

export type AuthorityMode = (typeof AUTHORITY_MODE)[keyof typeof AUTHORITY_MODE];

/**
 * The 10-element canonical scope every mission and authorization is bound to
 * (REQ-SCOPE-001; design §3.1). All ten fields are non-empty strings after
 * normalization; company is a check-digit-validated RUC, fiscalPeriod is
 * YYYYMM with month 01–12, and sourceSnapshot is a lowercase hex sha-256
 * digest of the frozen source manifest (never a path).
 */
export interface CanonicalScope {
  tenant: string;
  organization: string;
  company: string;
  fiscalPeriod: string;
  ledgerBook: string;
  operationType: string;
  sourceSnapshot: string;
  policyVersion: string;
  actor: string;
  authorityLevel: AuthorityMode;
}

/** The 10 canonical element names in a stable order. */
export const CANONICAL_SCOPE_ELEMENTS = [
  "tenant",
  "organization",
  "company",
  "fiscalPeriod",
  "ledgerBook",
  "operationType",
  "sourceSnapshot",
  "policyVersion",
  "actor",
  "authorityLevel",
] as const;

export type CanonicalScopeElement = (typeof CANONICAL_SCOPE_ELEMENTS)[number];

/**
 * Partial-scope report from loading legacy company/period context into the
 * canonical model (REQ-SCOPE-007; SC-SCOPE-006). `complete` is true only when
 * all 10 elements are present; a legacy context is reported incomplete until
 * the remaining 8 elements are explicitly bound.
 */
export interface CanonicalScopeReport {
  /** Canonical elements derivable from the loaded context (never data loss). */
  scope: Partial<CanonicalScope>;
  /** Canonical element names still missing. */
  missing: readonly CanonicalScopeElement[];
  /** True only when all 10 elements are present. */
  complete: boolean;
}

const AUTHORITY_MODE_VALUES: readonly string[] = Object.values(AUTHORITY_MODE);

/**
 * Load legacy company/period context into the canonical scope model. Valid
 * values map to the `company` and `fiscalPeriod` elements; everything else is
 * reported missing until explicitly bound.
 */
export function loadCanonicalScope(context: ScopeContext): CanonicalScopeReport {
  const scope: Partial<CanonicalScope> = {};
  if (context.company !== undefined && isValidRuc(context.company.ruc)) {
    scope.company = context.company.ruc;
  }
  if (context.period !== undefined && isValidPeriod(context.period.period)) {
    scope.fiscalPeriod = context.period.period;
  }
  const missing = CANONICAL_SCOPE_ELEMENTS.filter(
    (element) => scope[element] === undefined,
  );
  return { scope, missing, complete: missing.length === 0 };
}

/**
 * Fail-closed gate for mission creation, authorization, and execution
 * (REQ-SCOPE-009): a missing, incomplete, or invalid canonical scope throws.
 * Reuses the existing RUC check-digit and period validators (REQ-SCOPE-002/003).
 */
export function assertMissionScopeReady(scope: CanonicalScope | undefined): void {
  if (scope === undefined) {
    throw new Error(
      "mission scope required: bind all 10 canonical scope elements before creating or authorizing a mission",
    );
  }
  const missing = CANONICAL_SCOPE_ELEMENTS.filter((element) => {
    const value = scope[element];
    return typeof value !== "string" || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`incomplete canonical scope; missing elements: ${missing.join(", ")}`);
  }
  if (!isValidRuc(scope.company)) {
    throw new Error(`invalid company RUC "${scope.company}" (must be 11 digits with a valid check digit)`);
  }
  if (!isValidPeriod(scope.fiscalPeriod)) {
    throw new Error(`invalid fiscal period "${scope.fiscalPeriod}" (must be YYYYMM with month 01-12)`);
  }
  if (!AUTHORITY_MODE_VALUES.includes(scope.authorityLevel)) {
    throw new Error(
      `invalid authority level "${scope.authorityLevel}" (must be one of ${AUTHORITY_MODE_VALUES.join(", ")})`,
    );
  }
}

const PERIOD_RE = /^\d{4}(0[1-9]|1[0-2])$/;

/** Validate a fiscal period string: YYYYMM with month 01–12. */
export function isValidPeriod(period: string): boolean {
  return PERIOD_RE.test(period);
}

/** Validate a full scope (both fields, when present). */
export function isValidScope(scope: ScopeContext): boolean {
  if (scope.company !== undefined && !isValidRuc(scope.company.ruc)) {
    return false;
  }
  if (scope.period !== undefined && !isValidPeriod(scope.period.period)) {
    return false;
  }
  return true;
}

/** Default context file location (development adapter). */
export function defaultContextPath(): string {
  return join(homedir(), ".drenyra", "context.json");
}

/**
 * Load/save the scope context. Writes are atomic (temp file + rename) so a
 * crash mid-write never truncates the previous context.
 */
export class ScopeContextStore {
  private readonly filePath: string;

  constructor(filePath: string = defaultContextPath()) {
    this.filePath = filePath;
  }

  /** Load the persisted scope; an absent or corrupt file yields an empty scope. */
  load(): ScopeContext {
    try {
      if (!existsSync(this.filePath)) {
        return {};
      }
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
      if (typeof raw !== "object" || raw === null) {
        return {};
      }
      const record = raw as Record<string, unknown>;
      const scope: ScopeContext = {};
      const company = record.company as Record<string, unknown> | undefined;
      const period = record.period as Record<string, unknown> | undefined;
      if (
        company !== undefined &&
        typeof company.ruc === "string" &&
        isValidRuc(company.ruc)
      ) {
        scope.company = { ruc: company.ruc };
      }
      if (
        period !== undefined &&
        typeof period.period === "string" &&
        isValidPeriod(period.period)
      ) {
        scope.period = { period: period.period };
      }
      return scope;
    } catch {
      // Corrupt store → empty scope (fail closed; the user re-sets context).
      return {};
    }
  }

  /** Persist the scope atomically. */
  save(scope: ScopeContext): void {
    if (!isValidScope(scope)) {
      throw new Error("ScopeContextStore.save: invalid scope (bad RUC or period)");
    }
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(scope, null, 2), "utf8");
    renameSync(tmp, this.filePath);
  }

  /** Set the company (validated RUC) and persist. */
  setCompany(ruc: string): CompanyContext {
    if (!isValidRuc(ruc)) {
      throw new Error(`invalid RUC: "${ruc}" (must be 11 digits with a valid check digit)`);
    }
    const next = { ...this.load(), company: { ruc } };
    this.save(next);
    return { ruc };
  }

  /** Set the fiscal period (validated YYYYMM) and persist. */
  setPeriod(period: string): FiscalPeriodContext {
    if (!isValidPeriod(period)) {
      throw new Error(`invalid period: "${period}" (must be YYYYMM with month 01-12)`);
    }
    const next = { ...this.load(), period: { period } };
    this.save(next);
    return { period };
  }
}
