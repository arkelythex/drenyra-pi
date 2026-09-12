/**
 * Company + fiscal period context tests — the scope every command runs in.
 *
 * RUC validation uses the SUNAT Módulo 11 checksum (runtime/ruc.ts, ported from
 * Drenyra); period validation is YYYYMM with month 01–12; the store persists
 * atomically and fails closed on invalid input.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; RUC/period digits are integers.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ScopeContextStore,
  isValidPeriod,
  isValidScope,
  type ScopeContext,
} from "../runtime/context.js";
import { bindScope } from "../lib/canonicalization.js";
import { isValidRuc } from "../runtime/ruc.js";
import { makeCanonicalScope } from "./helpers/authority-fixtures.js";

function makeStore(): { store: ScopeContextStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-context-"));
  return { store: new ScopeContextStore(join(dir, "context.json")), dir };
}

class RecordingStore extends ScopeContextStore {
  loadCalls = 0;
  saveCalls = 0;

  override load(): ScopeContext {
    this.loadCalls += 1;
    return super.load();
  }

  override save(scope: ScopeContext): void {
    this.saveCalls += 1;
    super.save(scope);
  }
}

describe("isValidRuc (SUNAT Módulo 11)", () => {
  it("accepts a valid company RUC", () => {
    expect(isValidRuc("20123456786")).toBe(true);
  });

  it("accepts a valid person RUC", () => {
    expect(isValidRuc("10123456781")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidRuc("20123456789")).toBe(false); // wrong check digit (Drenyra docstring example is itself wrong)
  });

  it("rejects wrong length and non-digits", () => {
    expect(isValidRuc("2012345678")).toBe(false);
    expect(isValidRuc("201234567890")).toBe(false);
    expect(isValidRuc("20100047218")).toBe(true);
    expect(isValidRuc("abc23456789")).toBe(false);
    expect(isValidRuc("")).toBe(false);
  });
});

describe("isValidPeriod", () => {
  it("accepts YYYYMM with a real month", () => {
    expect(isValidPeriod("202607")).toBe(true);
    expect(isValidPeriod("202601")).toBe(true);
    expect(isValidPeriod("202612")).toBe(true);
  });

  it("rejects bad months and wrong shapes", () => {
    expect(isValidPeriod("202613")).toBe(false);
    expect(isValidPeriod("202600")).toBe(false);
    expect(isValidPeriod("2026-07")).toBe(false);
    expect(isValidPeriod("20267")).toBe(false);
  });
});

describe("isValidScope", () => {
  it("accepts an empty scope and a full valid scope", () => {
    expect(isValidScope({})).toBe(true);
    expect(
      isValidScope({ company: { ruc: "20123456786" }, period: { period: "202607" } }),
    ).toBe(true);
  });

  it("rejects an invalid company or period", () => {
    expect(isValidScope({ company: { ruc: "20123456789" } })).toBe(false);
    expect(isValidScope({ period: { period: "202613" } })).toBe(false);
  });
});

describe("ScopeContextStore", () => {
  it("starts empty and persists a set company + period", () => {
    const { store, dir } = makeStore();
    try {
      expect(store.load()).toEqual({});
      store.setCompany("20123456786");
      store.setPeriod("202607");
      expect(store.load()).toEqual({
        company: { ruc: "20123456786" },
        period: { period: "202607" },
      });
      // Persisted to disk, readable JSON.
      const raw = JSON.parse(readFileSync(join(dir, "context.json"), "utf8"));
      expect(raw.company.ruc).toBe("20123456786");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overwrites the company/period in place", () => {
    const { store, dir } = makeStore();
    try {
      store.setCompany("20123456786");
      store.setPeriod("202607");
      store.setCompany("20512345671");
      store.setPeriod("202608");
      const scope = store.load();
      expect(scope.company?.ruc).toBe("20512345671");
      expect(scope.period?.period).toBe("202608");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed on invalid RUC and invalid period", () => {
    const { store, dir } = makeStore();
    try {
      expect(() => store.setCompany("20123456789")).toThrow(/invalid RUC/);
      expect(() => store.setPeriod("202613")).toThrow(/invalid period/);
      // Nothing persisted on failure.
      expect(store.load()).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("invalidates canonical scope after a real company or period change", () => {
    for (const change of [
      (store: ScopeContextStore) => store.setCompany("20512345671"),
      (store: ScopeContextStore) => store.setPeriod("202608"),
    ]) {
      const { store, dir } = makeStore();
      try {
        store.setCanonicalScope(makeCanonicalScope());
        change(store);
        expect(store.load().canonical).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("preserves canonical bytes and scope hash for matching selector values", () => {
    const { store, dir } = makeStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const before = store.load().canonical!;
      const bytes = JSON.stringify(before);
      const scopeHash = bindScope(before).scopeHash;
      store.setCompany(before.company);
      store.setPeriod(before.fiscalPeriod);
      const after = store.load().canonical!;
      expect(JSON.stringify(after)).toBe(bytes);
      expect(bindScope(after).scopeHash).toBe(scopeHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid selectors before loading or saving existing state", () => {
    const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-recording-context-"));
    const file = join(dir, "context.json");
    const store = new RecordingStore(file);
    try {
      store.setCanonicalScope(makeCanonicalScope());
      const before = readFileSync(file, "utf8");
      store.loadCalls = 0;
      store.saveCalls = 0;
      expect(() => store.setCompany("20123456789")).toThrow(/invalid RUC/);
      expect(() => store.setPeriod("202613")).toThrow(/invalid period/);
      expect(store.loadCalls).toBe(0);
      expect(store.saveCalls).toBe(0);
      expect(readFileSync(file, "utf8")).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not resurrect canonical scope after changing away and back", () => {
    const { store, dir } = makeStore();
    try {
      store.setCanonicalScope(makeCanonicalScope());
      store.setCompany("20512345671");
      store.setCompany(makeCanonicalScope().company);
      expect(store.load().canonical).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aligns legacy selectors when explicitly binding canonical scope", () => {
    const { store, dir } = makeStore();
    try {
      store.setCompany("20512345671");
      store.setPeriod("202608");
      const canonical = makeCanonicalScope();
      store.setCanonicalScope(canonical);
      expect(store.load()).toEqual({
        company: { ruc: canonical.company },
        period: { period: canonical.fiscalPeriod },
        canonical,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects direct persistence of contradictory selectors and canonical scope", () => {
    const { store, dir } = makeStore();
    try {
      expect(() =>
        store.save({
          company: { ruc: "20512345671" },
          canonical: makeCanonicalScope(),
        }),
      ).toThrow(/invalid scope/i);
      expect(store.load()).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads an empty scope from a corrupt file (fail closed, no crash)", () => {
    const { store, dir } = makeStore();
    try {
      const { writeFileSync } = require("node:fs");
      writeFileSync(join(dir, "context.json"), "{ not json", "utf8");
      expect(store.load()).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
