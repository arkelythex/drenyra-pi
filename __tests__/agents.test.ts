/**
 * Seven-agent conformance tests (T-S6-001; REQ-AGENT-001..009).
 *
 * Asserts that exactly seven parseable Pi markdown agent definitions ship under
 * agents/, that each definition carries the common operating contract (scope
 * guard, evidence citation, broad-deny authority posture, persist-before-respond
 * memory contract), that role authority ceilings match design §12, that the
 * anomaly-refuter enforces refutation before elevation, and that assets/agents/
 * mirrors agents/ byte-for-byte (REQ-AGENT-002; SC-AGENT-001).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; digests are lowercase hex sha-256.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(HERE, "..", "agents");
const ASSETS_AGENTS_DIR = join(HERE, "..", "assets", "agents");

/** The seven required roles (REQ-AGENT-001; design §12). */
const REQUIRED_ROLES = [
  "accounting-scout",
  "evidence-builder",
  "ledger-analyst",
  "reconciliation-agent",
  "tax-controller-pe",
  "anomaly-refuter",
  "close-controller",
] as const;

/** Design §12 authority ceilings (REQ-AGENT-008). */
const ROLE_CEILINGS: Record<string, string> = {
  "accounting-scout": "ANALYZE",
  "evidence-builder": "ANALYZE",
  "ledger-analyst": "ANALYZE",
  "reconciliation-agent": "ANALYZE",
  "tax-controller-pe": "ANALYZE",
  "anomaly-refuter": "ANALYZE",
  "close-controller": "PREPARE",
};

/** The modes an agent ceiling may take; EXECUTE is never an agent ceiling. */
const ALLOWED_CEILINGS = ["ASK", "ANALYZE", "PREPARE"] as const;

/** Every agent definition must carry these contract fragments (REQ-AGENT-003..006). */
const COMMON_FRAGMENTS = [
  "fail closed",
  "scope",
  "evidence",
  "broad-deny",
  "narrow allow",
  "EXECUTE",
  "persist",
  "before responding",
  "never grants authority",
  "backend",
  "stop",
] as const;

interface ParsedAgent {
  name: string;
  description: string;
  authority: string;
  tools: string[];
  body: string;
}

/** Parse the frontmatter block of a Pi markdown agent definition. */
function parseAgent(relativePath: string): ParsedAgent {
  const full = join(AGENTS_DIR, relativePath);
  const text = readFileSync(full, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (match === null) {
    throw new Error(`${relativePath}: missing frontmatter fence`);
  }
  const frontmatter = match[1];
  const body = match[2];
  if (body.trim().length === 0) {
    throw new Error(`${relativePath}: empty body after frontmatter`);
  }
  const get = (key: string): string | undefined => {
    const found = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter);
    return found?.[1]?.trim();
  };
  const toolsRaw = get("tools") ?? "";
  const tools = toolsRaw
    .split(/[\s,]+/)
    .map((token) => token.replace(/^- /, ""))
    .filter((token) => token.length > 0);
  return {
    name: get("name") ?? "",
    description: get("description") ?? "",
    authority: get("authority") ?? "",
    tools,
    body,
  };
}

/** The agent definition basenames under agents/ (excluding README.md). */
function agentFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".md") && entry.toLowerCase() !== "readme.md")
    .map((entry) => entry.slice(0, -".md".length))
    .sort();
}

describe("T-S6-001 seven agent definitions (REQ-AGENT-001)", () => {
  it("ships exactly the seven required roles under agents/", () => {
    const files = agentFiles(AGENTS_DIR);
    expect(files).toEqual([...REQUIRED_ROLES].sort());
    expect(files).toHaveLength(7);
  });

  it("mirrors every definition byte-for-byte under assets/agents/ (REQ-AGENT-002; SC-AGENT-001)", () => {
    const files = agentFiles(AGENTS_DIR);
    const mirrored = agentFiles(ASSETS_AGENTS_DIR);
    expect(mirrored).toEqual(files);
    for (const file of files) {
      const source = readFileSync(join(AGENTS_DIR, `${file}.md`), "utf8");
      const mirror = readFileSync(join(ASSETS_AGENTS_DIR, `${file}.md`), "utf8");
      expect(mirror, `${file} mirror must match`).toBe(source);
    }
  });
});

describe("T-S6-001 parseability and common contract (REQ-AGENT-002..006; SC-AGENT-001/002/003/005)", () => {
  for (const role of REQUIRED_ROLES) {
    describe(role, () => {
      const agent = parseAgent(`${role}.md`);

      it("has parseable frontmatter with name, description, authority, and tools", () => {
        expect(agent.name).toBe(role);
        expect(agent.description.length).toBeGreaterThan(10);
        expect(agent.authority.length).toBeGreaterThan(0);
        expect(agent.tools.length).toBeGreaterThan(0);
      });

      it("grants a read/query tool and never grants an execute tool (REQ-AGENT-005)", () => {
        const hasRead = agent.tools.some((tool) =>
          ["read", "grep", "glob", "mcp"].includes(tool),
        );
        expect(hasRead, `${role} tools must include a read/query tool`).toBe(true);
        expect(agent.tools).not.toContain("execute");
      });

      it("encodes the authority ceiling per design §12 (REQ-AGENT-008)", () => {
        const expected = ROLE_CEILINGS[role];
        expect(agent.authority).toBe(expected);
        expect(ALLOWED_CEILINGS).toContain(agent.authority as (typeof ALLOWED_CEILINGS)[number]);
      });

      it("contains the common operating contract (REQ-AGENT-003..006)", () => {
        const lowered = agent.body.toLowerCase();
        for (const fragment of COMMON_FRAGMENTS) {
          expect(lowered, `${role}: missing contract fragment "${fragment}"`).toContain(
            fragment.toLowerCase(),
          );
        }
      });

      it("requires evidence-node citations for every conclusion (REQ-AGENT-004; SC-AGENT-003)", () => {
        const lowered = agent.body.toLowerCase();
        expect(lowered).toContain("cite");
        expect(lowered).toContain("evidence node");
      });

      it("fails closed on a scope mismatch or incomplete scope (REQ-AGENT-003; SC-AGENT-002)", () => {
        const lowered = agent.body.toLowerCase();
        expect(lowered).toContain("fail closed");
        expect(lowered).toMatch(/different (company|fiscal period)/);
      });

      it("persists the role artifact before responding and never lets memory grant authority (REQ-AGENT-006; SC-AGENT-005)", () => {
        const lowered = agent.body.toLowerCase();
        expect(lowered).toContain("before responding");
        expect(lowered).toContain("never grants authority");
        expect(lowered).toContain("backend");
      });
    });
  }
});

describe("T-S6-001 anomaly-refuter refutation gate (REQ-AGENT-007; SC-AGENT-004)", () => {
  const refuter = parseAgent("anomaly-refuter.md");
  it("requires refutation before any finding is elevated", () => {
    const lowered = refuter.body.toLowerCase();
    expect(lowered).toContain("refutation");
    expect(lowered).toContain("elevated");
    // Refutation must precede elevation — the body must not allow elevation
    // without attempting falsification first.
    const refutationIndex = lowered.indexOf("refutation");
    const elevationIndex = lowered.indexOf("elevated");
    expect(refutationIndex).toBeGreaterThanOrEqual(0);
    expect(elevationIndex).toBeGreaterThan(refutationIndex);
  });
});

describe("T-S6-001 no implicit escalation (REQ-AGENT-005)", () => {
  for (const role of REQUIRED_ROLES) {
    it(`${role} never claims EXECUTE-level mutation authority`, () => {
      const agent = parseAgent(`${role}.md`);
      const lowered = agent.body.toLowerCase();
      // EXECUTE may only appear as a prohibition (never ... EXECUTE, no EXECUTE).
      const executeMentions = lowered.split("execute").length - 1;
      expect(executeMentions).toBeGreaterThan(0);
      expect(lowered).toMatch(/(never|no|not)[^.\n]*execute/);
    });
  }
});
