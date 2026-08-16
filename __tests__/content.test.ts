/**
 * Packaged operating-content conformance tests (T-S6-003; REQ-SKPT-001..003).
 *
 * Asserts that 1-3 real Drenyra skills ship under skills/ with operational
 * instruction (no stubs), that a persona prompt plus one prompt per intended
 * command ship under prompts/ with no reference to an unregistered command,
 * and that exactly one fiscal-operator theme with light and dark variants
 * resolves through the pi manifest (REQ-SKPT-003; SC-SKPT-003).
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; digests are lowercase hex sha-256.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SKILLS_DIR = join(ROOT, "skills");
const PROMPTS_DIR = join(ROOT, "prompts");
const THEMES_DIR = join(ROOT, "themes");

const PLACEHOLDER_PATTERN = /TODO|PLACEHOLDER|lorem\s+ipsum|^Planned:/i;

/** The 14 intended commands (REQ-CMD-001). */
const INTENDED_COMMANDS = [
  "status",
  "doctor",
  "capabilities",
  "scope",
  "period",
  "mission",
  "continue",
  "reconcile",
  "close",
  "evidence",
  "verify",
  "receipt",
  "resume",
  "models",
  "preflight",
  "persona",
] as const;

/** The full registered command surface (14 intended + company + context). */
const REGISTERED_COMMANDS = [...INTENDED_COMMANDS, "company", "context"] as const;

/** Theme color keys required by the Pi theme schema (required + optional). */
const REQUIRED_THEME_COLORS = [
  "accent",
  "border",
  "borderAccent",
  "borderMuted",
  "success",
  "error",
  "warning",
  "muted",
  "dim",
  "text",
  "thinkingText",
  "selectedBg",
  "userMessageBg",
  "userMessageText",
  "customMessageBg",
  "customMessageText",
  "customMessageLabel",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
  "toolTitle",
  "toolOutput",
  "mdHeading",
  "mdLink",
  "mdLinkUrl",
  "mdCode",
  "mdCodeBlock",
  "mdCodeBlockBorder",
  "mdQuote",
  "mdQuoteBorder",
  "mdHr",
  "mdListBullet",
  "toolDiffAdded",
  "toolDiffRemoved",
  "toolDiffContext",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
  "thinkingOff",
  "thinkingMinimal",
  "thinkingLow",
  "thinkingMedium",
  "thinkingHigh",
  "thinkingXhigh",
  "bashMode",
] as const;

/** Recursively collect files under a dir matching a basename. */
function walk(dir: string, basename: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, basename, out);
    } else if (entry === basename) {
      out.push(full);
    }
  }
  return out;
}

describe("T-S6-003 packaged skills (REQ-SKPT-001; SC-SKPT-004)", () => {
  const skillFiles = walk(SKILLS_DIR, "SKILL.md");

  it("ships at least the core fiscal skills", () => {
    expect(skillFiles.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of skillFiles) {
    it(`${join(ROOT, file).slice(SKILLS_DIR.length)} has real instructional content`, () => {
      const text = readFileSync(file, "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
      expect(match, `${file} must have frontmatter`).not.toBeNull();
      const frontmatter = match![1];
      expect(/^name:\s*\S+/m.test(frontmatter)).toBe(true);
      expect(/^description:\s*\S+/m.test(frontmatter)).toBe(true);
      const body = match![2];
      expect(body.trim().length).toBeGreaterThan(200);
      expect(PLACEHOLDER_PATTERN.test(text)).toBe(false);
    });
  }
});

describe("T-S6-003 prompts cover the command surface (REQ-SKPT-002; SC-SKPT-005)", () => {
  it("ships a persona prompt", () => {
    const persona = readFileSync(join(PROMPTS_DIR, "persona.md"), "utf8");
    expect(persona.trim().length).toBeGreaterThan(200);
    expect(PLACEHOLDER_PATTERN.test(persona)).toBe(false);
  });

  for (const command of INTENDED_COMMANDS) {
    it(`ships a prompt for /drenyra:${command}`, () => {
      const file = join(PROMPTS_DIR, `${command}.md`);
      const text = readFileSync(file, "utf8");
      expect(text.trim().length).toBeGreaterThan(100);
      expect(PLACEHOLDER_PATTERN.test(text)).toBe(false);
    });
  }

  it("no prompt references an unregistered command (SC-SKPT-005)", () => {
    const promptFiles = readdirSync(PROMPTS_DIR)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => join(PROMPTS_DIR, entry));
    const referenced = new Set<string>();
    for (const file of promptFiles) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/drenyra:([a-z-]+)/gi)) {
        referenced.add(match[1].toLowerCase());
      }
    }
    for (const command of referenced) {
      expect(
        (REGISTERED_COMMANDS as readonly string[]).includes(command),
        `prompt references unregistered command drenyra:${command}`,
      ).toBe(true);
    }
  });
});

describe("T-S6-003 fiscal-operator theme (REQ-SKPT-003; SC-SKPT-003)", () => {
  const themeDirs = readdirSync(THEMES_DIR).filter((entry) =>
    statSync(join(THEMES_DIR, entry)).isDirectory(),
  );

  it("ships exactly one theme directory", () => {
    expect(themeDirs).toEqual(["fiscal-operator"]);
  });

  it("declares light and dark variants in one manifest that resolve to real files", () => {
    const manifest = JSON.parse(
      readFileSync(join(THEMES_DIR, "fiscal-operator", "manifest.json"), "utf8"),
    ) as { name?: string; variants?: Record<string, string> };
    expect(manifest.name).toBe("fiscal-operator");
    expect(manifest.variants).toBeDefined();
    for (const [variant, file] of Object.entries(manifest.variants ?? {})) {
      expect(variant, "variants must be light/dark").toMatch(/^(light|dark)$/);
      const full = join(THEMES_DIR, "fiscal-operator", file);
      expect(readFileSync(full, "utf8").length, `${file} must exist`).toBeGreaterThan(0);
    }
  });

  it("light and dark variants satisfy the Pi theme schema (name + colors)", () => {
    const manifest = JSON.parse(
      readFileSync(join(THEMES_DIR, "fiscal-operator", "manifest.json"), "utf8"),
    ) as { variants?: Record<string, string> };
    for (const file of Object.values(manifest.variants ?? {})) {
      const theme = JSON.parse(
        readFileSync(join(THEMES_DIR, "fiscal-operator", file), "utf8"),
      ) as { name?: string; colors?: Record<string, unknown> };
      expect(theme.name).toBeDefined();
      expect(theme.colors).toBeDefined();
      for (const key of REQUIRED_THEME_COLORS) {
        expect(theme.colors, `${file} missing theme color ${key}`).toHaveProperty(key);
      }
    }
  });

  it("resolves through the pi manifest entry", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      pi?: { themes?: unknown };
    };
    expect(Array.isArray(pkg.pi?.themes)).toBe(true);
    expect((pkg.pi?.themes as string[]).includes("./themes")).toBe(true);
  });
});
