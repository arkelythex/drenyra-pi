/**
 * Regression tests pinning the consolidated fail-closed parse helpers
 * (lib/parse.ts, refactor 60342fe / bf6c10a).
 *
 * The consolidation moved per-site inline try/catch JSON.parse loops and
 * NDJSON line iteration into two shared helpers while PRESERVING every
 * per-site semantic: throw-with-label vs label+parser-message, and "\n" vs
 * /\r?\n/ splitting. These tests pin exactly those semantics so future
 * refactors cannot silently drift them apart.
 *
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money; digests are lowercase hex sha-256.
 */
import { describe, expect, it } from "vitest";
import { eachNdjsonLine, parseJsonOrThrow } from "../lib/parse.js";

describe("parseJsonOrThrow (fail-closed single-document parse)", () => {
  it("parses valid JSON and returns the value", () => {
    expect(parseJsonOrThrow<{ ok: boolean }>('{"ok":true}', "corrupt")).toEqual({ ok: true });
  });

  it("throws the label verbatim when includeMessage is unset (store/chain semantics)", () => {
    expect(() => parseJsonOrThrow("not json", "receipt store corrupt: x is not valid JSON — repair is explicit and never automatic")).toThrow(
      "receipt store corrupt: x is not valid JSON — repair is explicit and never automatic",
    );
  });

  it("throws label with the raw parser message appended when includeMessage is true", () => {
    expect(() => parseJsonOrThrow("{bad", "corrupt record", { includeMessage: true })).toThrow(/^corrupt record — /);
  });

  it("does not swallow the parser error when includeMessage is true", () => {
    let message = "";
    try {
      parseJsonOrThrow("{bad", "corrupt record", { includeMessage: true });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("corrupt record");
    expect(message.startsWith("corrupt record — ")).toBe(true);
  });
});

describe("eachNdjsonLine (fail-closed NDJSON iteration)", () => {
  it("defaults to \"\\n\" split and skips blank/whitespace lines", () => {
    const lines: string[] = [];
    eachNdjsonLine('{"a":1}\n\n   \n{"b":2}\n', (line) => lines.push(line));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("supports /\\r?\\n/ split for CRLF sources (chain semantics)", () => {
    const lines: string[] = [];
    eachNdjsonLine('{"a":1}\r\n{"b":2}\r\n', (line) => lines.push(line), /\r?\n/);
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("preserves a trailing line without a final newline", () => {
    const lines: string[] = [];
    eachNdjsonLine('{"a":1}\n{"b":2}', (line) => lines.push(line));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });
});
