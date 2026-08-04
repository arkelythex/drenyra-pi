/**
 * Per-command scope policy — the scope guard that precedes every `/drenyra:*`
 * command (design §2.2, §10.1; REQ-CMD-003).
 *
 * Bootstrap/read commands (doctor, capabilities, scope setup, limited status
 * diagnostics) run under an explicit `pre-scope` policy: they never block and
 * report scope completeness for diagnostics. Mission, chain, evidence-mutation,
 * approval, and receipt-target commands require a complete 10-element canonical
 * scope and fail closed with an explanatory error, mutating nothing (SC-CMD-002).
 *
 * Scope loading follows the parse → scope policy → delegation order: the guard
 * loads the context store, maps it into the canonical model, binds the complete
 * scope to its canonical bytes, and computes the scope hash. A stale expected
 * scope hash (REQ-SCOPE-006) invalidates the command before any mutation.
 *
 * This module holds no fiscal logic; it only enforces scope discipline.
 * Fiscal convention: digests are lowercase hex sha-256; version/sequence
 * numbers are JSON integers.
 */

import type { CanonicalScopeElement, ScopeContext, ScopeContextStore } from "../runtime/context.js";
import { loadCanonicalScope, type CanonicalScopeReport } from "../runtime/context.js";
import { bindScope, type ScopeBinding } from "../lib/canonicalization.js";
import type { CanonicalScope } from "../runtime/context.js";

/** The two command-scope policies (design §2.2). */
export type CommandScopePolicy = "pre-scope" | "requires-scope";

const PRE_SCOPE = "pre-scope" as const;
const REQUIRES_SCOPE = "requires-scope" as const;

/**
 * The per-command policy table (design §10.3). Bootstrap/read commands use the
 * explicit pre-scope policy; everything that mutates or targets a mission,
 * chain, evidence, approval, or receipt requires a complete canonical scope.
 */
export const COMMAND_SCOPE_POLICY: Readonly<Record<string, CommandScopePolicy>> = {
  "drenyra:status": PRE_SCOPE,
  "drenyra:doctor": PRE_SCOPE,
  "drenyra:capabilities": PRE_SCOPE,
  "drenyra:scope": PRE_SCOPE,
  "drenyra:company": PRE_SCOPE,
  "drenyra:period": PRE_SCOPE,
  "drenyra:context": PRE_SCOPE,
  "drenyra:models": PRE_SCOPE,
  "drenyra:mission": REQUIRES_SCOPE,
  "drenyra:continue": REQUIRES_SCOPE,
  "drenyra:resume": REQUIRES_SCOPE,
  "drenyra:close": REQUIRES_SCOPE,
  "drenyra:reconcile": REQUIRES_SCOPE,
  "drenyra:evidence": REQUIRES_SCOPE,
  "drenyra:verify": REQUIRES_SCOPE,
  "drenyra:receipt": REQUIRES_SCOPE,
};

/** Unknown commands default to requires-scope (fail closed, never a bypass). */
export const DEFAULT_SCOPE_POLICY: CommandScopePolicy = REQUIRES_SCOPE;

/** The scope policy declared for a command (unknown commands fail closed). */
export function policyForCommand(command: string): CommandScopePolicy {
  return COMMAND_SCOPE_POLICY[command] ?? DEFAULT_SCOPE_POLICY;
}

/** True when the command requires a complete canonical scope before acting. */
export function isScopeRequiringCommand(command: string): boolean {
  return policyForCommand(command) === REQUIRES_SCOPE;
}

/** Inputs for one scope-guard evaluation. */
export interface ScopeGuardInput {
  command: string;
  /** The loaded legacy/canonical context (company, period, canonical). */
  context: ScopeContext;
  /** When the command was prepared against a prior binding (REQ-SCOPE-006). */
  expectedScopeHash?: string;
}

/** The outcome of one scope-guard evaluation (fail-closed). */
export interface ScopeGuardOutcome {
  command: string;
  policy: CommandScopePolicy;
  /** True when the command may proceed under its declared policy. */
  ok: boolean;
  /** True only when all 10 canonical elements are present and valid. */
  complete: boolean;
  /** Canonical element names still missing. */
  missing: readonly CanonicalScopeElement[];
  /** The load report (complete or partial canonical scope). */
  report: CanonicalScopeReport;
  /** The canonical binding, present when the scope is complete and valid. */
  binding?: ScopeBinding;
  /** Fail-closed explanation; present when `ok` is false. */
  error?: string;
}

/** Bind the report's scope when complete; never throws. */
function tryBind(report: CanonicalScopeReport): ScopeBinding | undefined {
  if (!report.complete) {
    return undefined;
  }
  try {
    return bindScope(report.scope as CanonicalScope);
  } catch {
    return undefined;
  }
}

/**
 * Evaluate the scope guard for one command (design §2.2):
 *
 * 1. Declared policy lookup (unknown → requires-scope).
 * 2. Scope load + canonical report (legacy and full-scope sources).
 * 3. Canonical binding + scope hash when complete.
 * 4. Fail-closed outcome: incomplete, invalid, or changed scope blocks.
 */
export function evaluateScopeGuard(input: ScopeGuardInput): ScopeGuardOutcome {
  const { command, context, expectedScopeHash } = input;
  const policy = policyForCommand(command);
  const report = loadCanonicalScope(context);
  const binding = tryBind(report);

  if (policy === PRE_SCOPE) {
    // Bootstrap/read diagnostics never block; completeness is reported only.
    return {
      command,
      policy,
      ok: true,
      complete: report.complete,
      missing: report.missing,
      report,
      ...(binding === undefined ? {} : { binding }),
    };
  }

  if (!report.complete) {
    return {
      command,
      policy,
      ok: false,
      complete: false,
      missing: report.missing,
      report,
      error:
        `command ${command} requires a complete 10-element canonical scope; missing: ` +
        `${report.missing.join(", ")}`,
    };
  }

  if (binding === undefined) {
    return {
      command,
      policy,
      ok: false,
      complete: true,
      missing: report.missing,
      report,
      error: `command ${command}: canonical scope present but invalid — re-bind via /drenyra:scope`,
    };
  }

  if (expectedScopeHash !== undefined && expectedScopeHash !== binding.scopeHash) {
    return {
      command,
      policy,
      ok: false,
      complete: true,
      missing: report.missing,
      report,
      binding,
      error:
        `command ${command}: scope changed since preparation — expected scope hash ` +
        `${expectedScopeHash}, current ${binding.scopeHash} (REQ-SCOPE-006)`,
    };
  }

  return {
    command,
    policy,
    ok: true,
    complete: true,
    missing: report.missing,
    report,
    binding,
  };
}

/**
 * Store-backed scope guard used by the extension handlers: every handler
 * evaluates its declared policy before delegating (design §10.3).
 */
export class ScopeGuard {
  constructor(private readonly contextStore: ScopeContextStore) {}

  /** Evaluate the guard for a command against the injected store's scope. */
  evaluate(command: string, expectedScopeHash?: string): ScopeGuardOutcome {
    return evaluateScopeGuard({
      command,
      context: this.contextStore.load(),
      expectedScopeHash,
    });
  }
}
