/**
 * Style verification core — the rules engine behind `bun run verify:style`
 * (see docs/style.md). Plain ESM, zero runtime dependencies, deterministic.
 *
 * Scope model (deliberately diff-scoped to avoid a whole-repository reformat):
 *   - File-level invariants (BOM, CRLF, final newline) run repo-wide over the
 *     owned source surface — every owned file must satisfy them today.
 *   - Trailing whitespace is enforced only on newly added lines of tracked
 *     files (checkAddedLines over `git diff`) and on the full content of
 *     untracked files (every line is new). Pre-existing legacy whitespace debt
 *     stays untouched and invisible to the gate until the lines are rewritten;
 *     `scripts/verify-style.mjs --all` surfaces the debt on demand.
 *
 * Fiscal convention: this repo never uses floats for money or versioning; this
 * module contains no monetary logic.
 */

/** Owned source surface the gate covers (mirrors tsconfig include + scripts). */
export const OWNED_SOURCE_PATHS = [
	"lib",
	"chains",
	"runtime",
	"extensions",
	"scripts",
	"__tests__",
	"index.ts",
	"vitest.config.ts",
];

/** Every rule the engine can enforce, in report-stable order. */
export const STYLE_RULES = [
	"bom",
	"crlf",
	"no-final-newline",
	"trailing-whitespace",
];

/** True when the path is inside the owned source surface. */
export function isOwnedSourcePath(relPath) {
	return OWNED_SOURCE_PATHS.some(
		(entry) => relPath === entry || relPath.startsWith(`${entry}/`),
	);
}

/**
 * Check a file's full content against the requested rules. Returns every
 * violation; an empty array means the content is clean for the given rules.
 */
export function checkSourceContent(
	content,
	{ label = "<file>", rules = STYLE_RULES } = {},
) {
	const violations = [];
	const active = new Set(rules);
	if (active.has("bom") && content.charCodeAt(0) === 0xfeff) {
		violations.push({
			file: label,
			line: 1,
			rule: "bom",
			message: "file starts with a byte-order mark (BOM)",
		});
	}
	if (active.has("crlf") && content.includes("\r")) {
		violations.push({
			file: label,
			line: 0,
			rule: "crlf",
			message: "file contains carriage-return line endings (CRLF)",
		});
	}
	const lines = content.split("\n");
	if (active.has("no-final-newline") && lines[lines.length - 1] !== "") {
		violations.push({
			file: label,
			line: lines.length,
			rule: "no-final-newline",
			message: "file must end with a single final newline",
		});
	}
	if (active.has("trailing-whitespace")) {
		for (const [index, line] of lines.entries()) {
			if (/[ \t]+$/.test(line)) {
				violations.push({
					file: label,
					line: index + 1,
					rule: "trailing-whitespace",
					message: "line ends with trailing whitespace",
				});
			}
		}
	}
	return violations;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Check the added lines of a unified diff for trailing whitespace. Tracks
 * `+++ b/<path>` headers and hunk counters so violations carry the source file
 * and source line, not the diff line. Context lines advance the added-side
 * counter, removed lines do not, and `\ No newline at end of file` markers are
 * ignored entirely.
 */
export function checkAddedLines(diffText, { label = "<diff>" } = {}) {
	const violations = [];
	let currentFile = label;
	let addedLine = 0;
	for (const line of diffText.split("\n")) {
		if (line.startsWith("diff ") || line.startsWith("index ")) continue;
		if (line.startsWith("--- ") || line.startsWith("+++ ")) {
			if (line.startsWith("+++ ")) {
				const header = line.slice(4);
				if (header !== "/dev/null" && header !== "") {
					currentFile = header.replace(/^[ab]\//, "");
				}
			}
			continue;
		}
		const hunk = line.match(HUNK_HEADER);
		if (hunk) {
			addedLine = Number(hunk[2]);
			continue;
		}
		if (line.startsWith("\\")) continue;
		if (line.startsWith("+")) {
			const content = line.slice(1);
			if (/[ \t]+$/.test(content)) {
				violations.push({
					file: currentFile,
					line: addedLine,
					rule: "trailing-whitespace",
					message: "added line ends with trailing whitespace",
				});
			}
			addedLine += 1;
		} else if (!line.startsWith("-")) {
			addedLine += 1;
		}
	}
	return violations;
}
