/**
 * Operating-asset conformance tests (T-S6-002; REQ-SKPT-004/005/006/008).
 *
 * Asserts that every v0.1 non-goal maps to at least one explicit policy
 * statement under assets/policies/, that assets/schemas/ ships valid JSON
 * Schema documents for the scope-binding, evidence, and authority envelopes,
 * and that assets/chains/ ships real operator maps for the monthly-close,
 * reconcile, verify, and evidence chains — no placeholders (REQ-SKPT-004;
 * SC-SKPT-002).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; digests are lowercase hex sha-256.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const POLICIES_DIR = join(ROOT, "assets", "policies");
const SCHEMAS_DIR = join(ROOT, "assets", "schemas");
const CHAINS_DIR = join(ROOT, "assets", "chains");

const PLACEHOLDER_PATTERN = /TODO|PLACEHOLDER|lorem\s+ipsum|^Planned:/i;

/** Recursively collect files under a dir matching a suffix. */
function walk(dir: string, suffix: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, suffix, out);
    } else if (entry.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The v0.1 non-goals (REQ-SKPT-005; design §13.2): each maps to at least one
 * explicit policy statement under assets/policies/ (REQ-SKPT-008; SC-SKPT-002).
 */
const NON_GOALS: Array<[string, RegExp]> = [
  [
    "no autonomous filing with the Peruvian tax authority",
    /no autonomous filing with the (Peruvian tax authority|national tax service)/i,
  ],
  [
    "no irreversible posting without approval",
    /no irreversible posting without (explicit |prior )?approval/i,
  ],
  [
    "no free interpretation without evidence",
    /no (free|uncited) interpretation without evidence/i,
  ],
  [
    "no material tax decisions from an LLM alone",
    /no material tax (decision|decisions) (from|made by) an LLM alone/i,
  ],
  [
    "no silent modification of closed periods",
    /no silent (modification|modifications?) of closed periods?/i,
  ],
  [
    "no replacement of the responsible professional",
    /no replacement of the responsible professional/i,
  ],
] as const;

const REQUIRED_CHAINS = ["monthly-close", "reconcile", "verify", "evidence"] as const;

/** The schema envelopes that must exist under assets/schemas/ (REQ-SKPT-006). */
const SCHEMA_ENVELOPES = [
  {
    envelope: "scope binding",
    match: (title: string, path: string): boolean =>
      /scope/i.test(path) || /scope/i.test(title),
  },
  {
    envelope: "evidence",
    match: (_title: string, path: string): boolean => /evidence|graph|node|edge/i.test(path),
  },
  {
    envelope: "authority",
    match: (title: string, path: string): boolean =>
      /authority|authorization/i.test(path) || /authorization/i.test(title),
  },
] as const;

describe("T-S6-002 policy assets encode every v0.1 non-goal (REQ-SKPT-005/008; SC-SKPT-002)", () => {
  const policyFiles = walk(POLICIES_DIR, ".md");
  const policyTexts = policyFiles.map((file) => readFileSync(file, "utf8"));

  it("ships at least one policy document under assets/policies/", () => {
    expect(policyFiles.length).toBeGreaterThan(0);
  });

  it("contains no placeholder content", () => {
    for (const file of policyFiles) {
      const text = readFileSync(file, "utf8");
      expect(PLACEHOLDER_PATTERN.test(text), `${file} must not be a stub`).toBe(false);
    }
  });

  for (const [goal, pattern] of NON_GOALS) {
    it(`encodes non-goal: ${goal}`, () => {
      expect(
        policyTexts.some((text) => pattern.test(text)),
        `no policy document encodes: ${goal}`,
      ).toBe(true);
    });
  }

  it("explicitly denies post-v0.1 roadmap behavior (design §13.2)", () => {
    const combined = policyTexts.join("\n");
    expect(/post-v0\.1/i.test(combined)).toBe(true);
    expect(/out of scope|not provided|explicitly denied/i.test(combined)).toBe(true);
  });
});

describe("T-S6-002 schema assets are valid JSON Schema (REQ-SKPT-006)", () => {
  const schemaFiles = walk(SCHEMAS_DIR, ".schema.json");

  it("ships schema documents for the scope, evidence, and authority envelopes", () => {
    const described: Array<{ title: string; path: string }> = schemaFiles.map((file) => {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { title?: string };
      return { title: raw.title ?? "", path: file };
    });
    for (const envelope of SCHEMA_ENVELOPES) {
      expect(
        described.some((entry) => envelope.match(entry.title, entry.path)),
        `missing ${envelope.envelope} envelope schema`,
      ).toBe(true);
    }
  });

  it("compiles every shipped schema as valid JSON Schema (draft-07)", () => {
    expect(schemaFiles.length).toBeGreaterThan(0);
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    // Register every distinct schema $id first so sibling $refs resolve across
    // files (relative refs resolve against the $id base URI). Mirrored files
    // sharing an $id are byte-identical copies; they register once.
    const seen = new Set<string>();
    for (const file of schemaFiles) {
      const schema = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      expect(typeof schema, `${file} must parse as JSON`).toBe("object");
      expect(schema.$schema, `${file} must declare $schema`).toBeTruthy();
      const id = typeof schema.$id === "string" ? schema.$id : file;
      if (!seen.has(id)) {
        seen.add(id);
        ajv.addSchema(schema, id);
      }
    }
    // Compiling proves each distinct document is a valid JSON Schema
    // (REQ-SKPT-006).
    expect(seen.size).toBeGreaterThan(0);
    for (const id of seen) {
      expect(ajv.getSchema(id), `${id} must compile as a JSON Schema`).toBeDefined();
    }
  });

  it("the scope-binding envelope carries all ten canonical elements (REQ-SCOPE-001)", () => {
    const scopeFile = schemaFiles.find((file) => /scope-binding/i.test(file));
    expect(scopeFile).toBeDefined();
    const schema = JSON.parse(readFileSync(scopeFile!, "utf8")) as {
      required?: string[];
    };
    expect(schema.required).toEqual(
      expect.arrayContaining([
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
      ]),
    );
  });
});

describe("T-S6-002 chain assets describe the four chains (REQ-SKPT-004)", () => {
  const chainFiles = readdirSync(CHAINS_DIR)
    .filter((entry) => entry.endsWith(".chain.md"))
    .map((entry) => entry.slice(0, -".chain.md".length))
    .sort();

  it("ships exactly monthly-close, reconcile, verify, and evidence chain maps", () => {
    expect(chainFiles).toEqual([...REQUIRED_CHAINS].sort());
  });

  for (const chain of REQUIRED_CHAINS) {
    it(`${chain} map parses and carries real operator content`, () => {
      const text = readFileSync(join(CHAINS_DIR, `${chain}.chain.md`), "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
      expect(match, `${chain}.chain.md must have frontmatter`).not.toBeNull();
      const body = match![2];
      expect(body.trim().length).toBeGreaterThan(200);
      expect(PLACEHOLDER_PATTERN.test(text)).toBe(false);
      expect(body).toMatch(/^#{1,3} /m); // real section structure
    });
  }
});
