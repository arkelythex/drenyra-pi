/**
 * Style verification — tests for scripts/lib/style-verify.mjs, the rules engine
 * behind `bun run verify:style` (see docs/style.md).
 *
 * The gate is deliberately diff-scoped: file-level invariants (BOM, CRLF, final
 * newline) run repo-wide, while trailing whitespace is only enforced on newly
 * added lines of tracked files and on the full content of untracked files. This
 * checks newly written code without requiring a whole-repository reformat and
 * without disturbing pre-existing legacy whitespace debt.
 */

import { describe, expect, it } from "vitest";

// Mirrors the typed dynamic import idiom of package-verify.test.ts: the runtime
// module is plain ESM, and the public types come from the sibling .d.mts.
const STYLE_VERIFY_URL = new URL(
	"../scripts/lib/style-verify.mjs",
	import.meta.url,
).href;
const { checkAddedLines, checkSourceContent } = (await import(
	STYLE_VERIFY_URL
)) as typeof import("../scripts/lib/style-verify.d.mts");

describe("checkSourceContent", () => {
	it("returns no violations for clean content", () => {
		expect(checkSourceContent("line one\nline two\n")).toEqual([]);
	});

	it("returns no violations for empty content", () => {
		expect(checkSourceContent("")).toEqual([]);
	});

	it("flags trailing whitespace with the source line number", () => {
		const violations = checkSourceContent("a  \nb\t\nc\n");
		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({
			line: 1,
			rule: "trailing-whitespace",
		});
		expect(violations[1]).toMatchObject({
			line: 2,
			rule: "trailing-whitespace",
		});
	});

	it("flags a missing final newline", () => {
		const violations = checkSourceContent("a\nb");
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatchObject({ rule: "no-final-newline" });
	});

	it("flags CRLF line endings", () => {
		const violations = checkSourceContent("a\r\nb\n");
		expect(violations.some((v) => v.rule === "crlf")).toBe(true);
	});

	it("flags a BOM", () => {
		const violations = checkSourceContent("\uFEFFa\n");
		expect(violations.some((v) => v.rule === "bom")).toBe(true);
	});

	it("honors the rules option (repo-wide file-level subset)", () => {
		const violations = checkSourceContent("a  \nb\n", {
			label: "lib/owned.ts",
			rules: ["bom", "crlf", "no-final-newline"],
		});
		expect(violations).toEqual([]);
	});
});

describe("checkAddedLines", () => {
	const DIFF = [
		"diff --git a/lib/a.ts b/lib/a.ts",
		"index 1111111..2222222 100644",
		"--- a/lib/a.ts",
		"+++ b/lib/a.ts",
		"@@ -1,3 +1,3 @@",
		" context",
		"-removed",
		"+added-with-trailing   ",
		"+clean-added",
		"\\ No newline at end of file",
		"@@ -5,1 +5,1 @@",
		"+also-clean",
	].join("\n");

	it("flags only added lines with trailing whitespace, at the source line", () => {
		const violations = checkAddedLines(DIFF, { label: "<diff>" });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatchObject({
			file: "lib/a.ts",
			line: 2,
			rule: "trailing-whitespace",
		});
	});

	it("ignores headers, context, removed lines and newline markers", () => {
		expect(checkAddedLines(DIFF)).toHaveLength(1);
	});

	it("reports violations on their own file and resets on each hunk", () => {
		const multi = [
			"diff --git a/lib/b.ts b/lib/b.ts",
			"--- a/lib/b.ts",
			"+++ b/lib/b.ts",
			"@@ -1,1 +1,1 @@",
			"+bad ",
			"@@ -10,1 +10,1 @@",
			"+bad2\t",
		].join("\n");
		const violations = checkAddedLines(multi);
		expect(violations).toHaveLength(2);
		expect(violations[0]).toMatchObject({ file: "lib/b.ts", line: 1 });
		expect(violations[1]).toMatchObject({ file: "lib/b.ts", line: 10 });
	});

	it("returns no violations for a clean diff", () => {
		const clean = [
			"diff --git a/a.ts b/a.ts",
			"--- a/a.ts",
			"+++ b/a.ts",
			"@@ -1 +1 @@",
			"+clean",
		].join("\n");
		expect(checkAddedLines(clean)).toEqual([]);
	});
});
