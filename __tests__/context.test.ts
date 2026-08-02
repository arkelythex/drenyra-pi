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
} from "../runtime/context.js";
import { isValidRuc } from "../runtime/ruc.js";

function makeStore(): { store: ScopeContextStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "drenyra-pi-context-"));
  return { store: new ScopeContextStore(join(dir, "context.json")), dir };
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
