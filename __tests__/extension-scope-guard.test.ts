/**
 * Scope-guard tests (T-S4A-001) — per-command scope policy (design §2.2, §10.1).
 *
 * Every command validates canonical scope before acting: bootstrap/read commands
 * (doctor, capabilities, scope setup, limited status diagnostics) run under an
 * explicit pre-scope policy; mission/chain/evidence-mutation/approval/receipt
 * commands require a complete 10-element scope and fail closed with an
 * explanatory error, mutating nothing (REQ-CMD-003; SC-CMD-002). A changed
 * scope hash blocks the command (REQ-SCOPE-006).
 *
 * The test also covers the canonical-scope persistence extension on
 * `ScopeContextStore` (S4a): `/drenyra:scope` binds and stores the full
 * 10-element scope while legacy company/period stay compatible.
 *
 * Fiscal convention: monetary values are BigInt cents (none appear here);
 * digests are lowercase hex sha-256; version/sequence numbers are JSON integers.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUTHORITY_MODE, loadCanonicalScope, ScopeContextStore } from "../runtime/context.js";
import {
  COMMAND_SCOPE_POLICY,
  DEFAULT_SCOPE_POLICY,
  evaluateScopeGuard,
  isScopeRequiringCommand,
  policyForCommand,
  ScopeGuard,
  type CommandScopePolicy,
} from "../extensions/scope-guard.js";
import { makeCanonicalScope, makeScopeBinding } from "./helpers/authority-fixtures.js";

const PRE_SCOPE_COMMANDS = [
  "drenyra:status",
  "drenyra:doctor",
  "drenyra:capabilities",
  "drenyra:scope",
  "drenyra:company",
  "drenyra:period",
  "drenyra:context",
  "drenyra:models",
];

const SCOPE_REQUIRING_COMMANDS = [
  "drenyra:mission",
  "drenyra:continue",
  "drenyra:resume",
  "drenyra:close",
  "drenyra:reconcile",
  "drenyra:evidence",
  "drenyra:verify",
  "drenyra:receipt",
];

function makeTempStore(): { store: ScopeContextStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-scope-guard-"));
  return { store: new ScopeContextStore(join(dir, "context.json")), dir };
}

describe("command scope policy table (REQ-CMD-003; design §2.2)", () => {
  it("declares an explicit pre-scope policy for bootstrap/read commands", () => {
    for (const command of PRE_SCOPE_COMMANDS) {
      expect(policyForCommand(command), command).toBe<CommandScopePolicy>("pre-scope");
      expect(isScopeRequiringCommand(command), command).toBe(false);
      expect(COMMAND_SCOPE_POLICY[command], command).toBe("pre-scope");
    }
  });

  it("requires a complete scope for mission/chain/evidence/approval/receipt commands", () => {
    for (const command of SCOPE_REQUIRING_COMMANDS) {
      expect(policyForCommand(command), command).toBe<CommandScopePolicy>("requires-scope");
      expect(isScopeRequiringCommand(command), command).toBe(true);
      expect(COMMAND_SCOPE_POLICY[command], command).toBe("requires-scope");
    }
  });

  it("defaults unknown commands to requires-scope (fail-closed default)", () => {
    expect(DEFAULT_SCOPE_POLICY).toBe("requires-scope");
    expect(policyForCommand("drenyra:unknown")).toBe("requires-scope");
    expect(isScopeRequiringCommand("drenyra:unknown")).toBe(true);
  });
});

describe("evaluateScopeGuard — fail-closed scope policy", () => {
  it("fails closed with a 10-element missing list when no context is bound", () => {
    const { store, dir } = makeTempStore();
    try {
      const outcome = evaluateScopeGuard({ command: "drenyra:close", context: store.load() });
      expect(outcome.ok).toBe(false);
      expect(outcome.complete).toBe(false);
      expect(outcome.missing).toHaveLength(10);
      expect(outcome.missing).toContain("tenant");
      expect(outcome.missing).toContain("authorityLevel");
      expect(outcome.error).toContain("drenyra:close");
      expect(outcome.error).toContain("missing");
      expect(outcome.binding).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("legacy company/period context still reports 8 missing canonical elements", () => {
    const { store, dir } = makeTempStore();
    try {
      store.setCompany("20123456786");
      store.setPeriod("202507");
      const outcome = evaluateScopeGuard({ command: "drenyra:close", context: store.load() });
      expect(outcome.ok).toBe(false);
      expect(outcome.complete).toBe(false);
      expect(outcome.missing).toHaveLength(8);
      expect(outcome.missing).not.toContain("company");
      expect(outcome.missing).not.toContain("fiscalPeriod");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("binds a complete canonical scope to a stable lowercase hex scope hash", () => {
    const { store, dir } = makeTempStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const outcome = evaluateScopeGuard({ command: "drenyra:close", context: store.load() });
      expect(outcome.ok).toBe(true);
      expect(outcome.complete).toBe(true);
      expect(outcome.binding).toBeDefined();
      expect(outcome.binding?.scopeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(outcome.binding?.version).toBe("drenyra.scope.v1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when the canonical scope is present but invalid for binding", () => {
    const { store, dir } = makeTempStore();
    try {
      // sourceSnapshot is present but not a lowercase hex sha-256 digest.
      store.setCanonicalScope(makeCanonicalScope({ sourceSnapshot: "not-a-digest" }));
      const outcome = evaluateScopeGuard({ command: "drenyra:close", context: store.load() });
      expect(outcome.complete).toBe(true);
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toContain("invalid");
      expect(outcome.binding).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("pre-scope commands never block and report completeness for diagnostics", () => {
    const { store, dir } = makeTempStore();
    try {
      const outcome = evaluateScopeGuard({ command: "drenyra:capabilities", context: store.load() });
      expect(outcome.ok).toBe(true);
      expect(outcome.complete).toBe(false);
      expect(outcome.missing).toHaveLength(10);
      expect(outcome.error).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("pre-scope commands ignore a stale expected hash (diagnostics never block)", () => {
    const { store, dir } = makeTempStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const outcome = evaluateScopeGuard({
        command: "drenyra:status",
        context: store.load(),
        expectedScopeHash: "0".repeat(64),
      });
      expect(outcome.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks a scope-requiring command when the scope hash changed (REQ-SCOPE-006)", () => {
    const { store, dir } = makeTempStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      // A different (still valid) scope binding produces a different hash.
      const staleHash = makeScopeBinding({ tenant: "acme-stale" }).scopeHash;
      const outcome = evaluateScopeGuard({
        command: "drenyra:close",
        context: store.load(),
        expectedScopeHash: staleHash,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toContain("changed");
      expect(outcome.binding?.scopeHash).not.toBe(staleHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes a scope-requiring command when the expected hash matches", () => {
    const { store, dir } = makeTempStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const binding = makeScopeBinding();
      const outcome = evaluateScopeGuard({
        command: "drenyra:close",
        context: store.load(),
        expectedScopeHash: binding.scopeHash,
      });
      expect(outcome.ok).toBe(true);
      expect(outcome.binding?.scopeHash).toBe(binding.scopeHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ScopeGuard class wrapper", () => {
  it("loads scope from the injected store and applies the command policy", () => {
    const { store, dir } = makeTempStore();
    try {
      const guard = new ScopeGuard(store);
      const denied = guard.evaluate("drenyra:close");
      expect(denied.ok).toBe(false);
      expect(denied.missing).toHaveLength(10);

      store.setCompany("20123456786");
      const stillDenied = guard.evaluate("drenyra:close");
      expect(stillDenied.ok).toBe(false);

      store.setCanonicalScope(makeCanonicalScope());
      const allowed = guard.evaluate("drenyra:close");
      expect(allowed.ok).toBe(true);
      expect(allowed.binding?.scopeHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ScopeContextStore canonical-scope persistence (S4a extension)", () => {
  it("persists and reloads the full 10-element canonical scope atomically", () => {
    const dir = mkdtempSync(join(tmpdir(), "drenyra-scope-guard-store-"));
    const file = join(dir, "context.json");
    try {
      const store = new ScopeContextStore(file);
      store.setCompany("20123456786");
      store.setPeriod("202507");
      store.setCanonicalScope(makeCanonicalScope());

      const reloaded = new ScopeContextStore(file);
      const scope = reloaded.load();
      expect(scope.company?.ruc).toBe("20123456786");
      expect(scope.period?.period).toBe("202507");
      expect(scope.canonical?.company).toBe("20123456786");
      expect(scope.canonical?.authorityLevel).toBe(AUTHORITY_MODE.EXECUTE);

      const report = loadCanonicalScope(scope);
      expect(report.complete).toBe(true);
      expect(report.missing).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects an incomplete canonical scope at persist time", () => {
    const { store, dir } = makeTempStore();
    try {
      const incomplete = makeCanonicalScope({ tenant: "", organization: "  " });
      expect(() => store.setCanonicalScope(incomplete)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads a corrupt canonical field as absent (fail closed, never fabricate)", () => {
    const dir = mkdtempSync(join(tmpdir(), "drenyra-scope-guard-corrupt-"));
    const file = join(dir, "context.json");
    try {
      const store = new ScopeContextStore(file);
      store.setCompany("20123456786");
      writeFileSync(
        file,
        JSON.stringify({ company: { ruc: "20123456786" }, canonical: { company: 42 } }),
        "utf8",
      );
      const reloaded = new ScopeContextStore(file);
      const scope = reloaded.load();
      expect(scope.canonical).toBeUndefined();
      expect(scope.company?.ruc).toBe("20123456786");
      expect(loadCanonicalScope(scope).complete).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
