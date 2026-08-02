/**
 * Company + fiscal period context — the scope every Drenyra Pi command runs in.
 *
 * The startup panel and every /drenyra:* command thread this context:
 * company (RUC, checksummed) and fiscal period (YYYYMM). A command that
 * requires scope fails closed when it is not set.
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

/** A validated company scope: the 11-digit checksummed RUC. */
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
